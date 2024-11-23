import fs from 'fs';
import cron from 'node-cron';
import Parser from 'rss-parser';
import * as yaml from "yaml";
const parser = new Parser();

let config;
let previousItems;

function initialize() {
    config = yaml.parse(fs.readFileSync('./config/config.yml', 'utf-8'));
}

async function getRssFeedItems() {
    const rssFeed = await parser.parseURL(config.rssUrl);
    const items = new Map();
    await rssFeed.items.forEach(item => {
        items.set(
            item.title + item.content,
            { title: item.title, content: item.content, link: item.link });
    });
    return items;
}

function sendNotification(message, title, link) {
    const isHighPriority = message.includes(config.highPriorityText);
    const options = {
        method: 'POST',
        body: formatMessage(message),
        headers: {
            title: title,
            priority: isHighPriority ? config.highPriority : config.normalPriority,
            tags: isHighPriority ? config.tags : '',
            click: link
        }
    };
    fetch(config.ntfyUrl + '/' + config.topic, options)
        .then()
        .catch(error => console.error('Error:', error));
}

function formatMessage(message) {
    return message
        .replaceAll('<br>', ';')
        .split(';')
        .map(s => s.trim())
        .filter(s => s)
        .join('\n');
}

initialize();

cron.schedule(config.cronExpression, async () => {
    const newItems = await getRssFeedItems();
    if (previousItems) {
        newItems.forEach((value, key) => {
            if (!previousItems.has(key)) {
                sendNotification(value.content, value.title, value.link)
            }
        });
    }
    previousItems = newItems;
});