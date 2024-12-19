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
  if (priority === 'ignore' || priority === 'super_ignore') {
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
  let priority = feed.priority ? feed.priority : config.defaultPriority;
  let matched = false;
  if (feed.categories) {
    for (const category of feed.categories) {
      const types = [{criterion: category.title, content: title}, {criterion: category.contents, content: message}]
      for (const type of types) {
        const criterion = type.criterion;
        const content = type.content;
        if (criterion) {
          if (doesCriterionMatch(criterion, content)) {
            if (!matched) {
              priority = category.priority;
            } else {
              priority = getHigherPriority(priority, category.priority);
            }
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
      }
    }
  }
  return {priority: priority, tags: tags};
}

function getHigherPriority(priorityLeft, priorityRight) {
  const left = priorityLeft === 'super_ignore'
      ? 99 : priorityLeft === 'ignore'
          ? -1 : Number(priorityLeft);
  const right = priorityRight === 'super_ignore'
      ? 99 : priorityRight === 'ignore'
          ? -1 : Number(priorityRight);
  return left > right ? priorityLeft : priorityRight;
}

function doesCriterionMatch(criterion, text) {
  if (criterion.text) {
    const regex = new RegExp(criterion.text.join('|'), 'i');
    if (regex.test(text)) {
      return true;
    }
  } else if (criterion.regex) {
    const regex = new RegExp(criterion.regex, 'm');
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
          try {
            sendNotification(name, itemValue.content, itemValue.title, itemValue.link);
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    previousItems.set(name, newItems);
  }));
});

cronJobs.forEach(cronJob => cronJob.start());