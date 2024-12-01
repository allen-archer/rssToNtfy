import fs from 'fs';
import cron from 'node-cron';
import Parser from 'rss-parser';
import * as yaml from "yaml";

const parser = new Parser();

let config;
let previousItems;
let feeds;
let cronJobs = [];

function initialize() {
  config = yaml.parse(fs.readFileSync('./config/config.yml', 'utf-8'));
  feeds = new Map();
  previousItems = new Map();
  config.feeds.forEach(feed => {
    feeds.set(feed.name, feed);
  });
  if (config.ntfy.user && config.ntfy.password) {
    config.ntfy.basicAuth = `Basic ${Buffer.from(config.ntfy.user + ':' + config.ntfy.password, 'utf8').toString('base64')}`;
  } else if (config.ntfy.token) {
    config.ntfy.token = `Bearer ${config.ntfy.token}`;
  }
}

async function getRssFeedItems(urls) {
  const items = new Map();
  for (const url of urls) {
    const rssFeed = await parser.parseURL(url);
    await rssFeed.items.forEach(item => {
      items.set(
          item.title + item.content,
          {title: item.title, content: item.content, link: item.link});
    });
  }
  return items;
}

function sendNotification(feedName, message, title, link) {
  const feed = feeds.get(feedName);
  const formattedMessage = formatMessage(message, feed);
  const {priority, tags} = getPriorityAndTags(title, formattedMessage, feed);
  if (priority === 'ignore') {
    return;
  }
  const options = {
    method: 'POST',
    body: formattedMessage,
    headers: {
      title: title,
      priority: priority,
      click: link
    }
  };
  if (tags) {
    options.headers.tags = tags.join(',');
  }
  if (config.ntfy.basicAuth) {
    options.headers.Authorization = config.ntfy.basicAuth;
  } else if (config.ntfy.token) {
    options.headers.Authorization = config.ntfy.token;
  }
  fetch(config.ntfy.url + '/' + feed.topic, options)
      .then()
      .catch(error => console.error('Error:', error));
}

function getPriorityAndTags(title, message, feed) {
  let tags = feed.tags;
  if (feed.categories) {
    for (const category of feed.categories) {
      let matched = false;
      if (category.title) {
        if (doesCriteriaMatch(category.title, title)) {
          matched = true;
          if (category.tags) {
            if (tags) {
              tags = tags.concat(category.tags);
            } else {
              tags = category.tags;
            }
          }
        }
      }
      if (category.contents) {
        if (doesCriteriaMatch(category.contents, message)) {
          matched = true;
          if (category.tags) {
            if (tags) {
              tags = tags.concat(category.tags);
            } else {
              tags = category.tags;
            }
          }
        }
      }
      if (matched) {
        const priority = category.priority
            ? category.priority
            : feed.defaultPriority
                ? feed.defaultPriority
                : config.defaultPriority;
        return {priority: priority, tags: tags};
      }
    }
  }
  return {priority: feed.priority ? feed.priority : config.defaultPriority, tags: tags};
}

function doesCriteriaMatch(criteria, text) {
  if (criteria.text) {
    const regex = new RegExp(criteria.text.join('|'), 'i');
    if (regex.test(text)) {
      return true;
    }
  } else if (criteria.regex) {
    const regex = new RegExp(criteria.regex, 'm');
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

function formatMessage(message, feed) {
  let formattedMessage = message;
  feed?.replacements?.forEach(replacement => {
    formattedMessage = formattedMessage.replaceAll(replacement.from, replacement.to);
  });
  return formattedMessage
      .split('\n')
      .filter(m => m)
      .map(m => feed.trim ? m.trim() : m)
      .filter(m => m !== '')
      .join('\n');
}

initialize();

feeds.forEach((feed, name) => {
  cronJobs.push(cron.schedule(feed.cronExpression ? feed.cronExpression : config.defaultCronExpression, async () => {
    const newItems = await getRssFeedItems(feed.urls);
    if (previousItems.has(name)) {
      newItems.forEach((itemValue, itemKey) => {
        if (!previousItems.get(name).has(itemKey)) {
          sendNotification(name, itemValue.content, itemValue.title, itemValue.link)
        }
      });
    }
    previousItems.set(name, newItems);
  }));
});

cronJobs.forEach(cronJob => cronJob.start());