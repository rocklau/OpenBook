const RSSReader = require('./rss');
const fs = require('fs');
const path = require('path');

const reader = new RSSReader();

// Preset some popular RSS feeds
const defaultFeeds = [
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News' },
  { url: 'https://www.reddit.com/r/programming/.rss', name: 'r/programming' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' }
];

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Load OPML files (if they exist)
  const opmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.opml'));
  if (opmlFiles.length > 0) {
    console.log(`📂 Found ${opmlFiles.length} OPML files, loading...`);
    for (const file of opmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      await reader.loadFromOPML(content);
    }
  }

  // Use default feeds if no feeds are loaded
  if (reader.feeds.length === 0) {
    console.log('📰 Using default RSS feeds...');
    defaultFeeds.forEach(f => reader.addFeed(f.url, f.name));
  }

  console.log(`\n📡 Loaded a total of ${reader.feeds.length} RSS feeds\n`);

  switch (command) {
    case 'list':
      await listFeeds();
      break;
    case 'read':
      await readFeed(args[1]);
      break;
    case 'all':
    default:
      await readAll();
      break;
  }
}

async function listFeeds() {
  console.log('📋 RSS feed list:\n');
  reader.feeds.forEach((feed, index) => {
    console.log(`  ${index + 1}. ${feed.name}`);
    console.log(`     ${feed.url}\n`);
  });
}

async function readFeed(index) {
  const feedIndex = parseInt(index) - 1;
  if (isNaN(feedIndex) || feedIndex < 0 || feedIndex >= reader.feeds.length) {
    console.log('❌ Invalid feed index');
    return;
  }

  const feed = reader.feeds[feedIndex];
  console.log(`\n📖 Reading: ${feed.name}\n`);

  const parsed = await reader.parseFeed(feed.url);
  if (parsed) {
    displayArticles(parsed.items, feed.name);
  }
}

async function readAll() {
  console.log('🔄 Fetching all articles...\n');

  // Limit the number of feeds to avoid timeouts
  const maxFeeds = reader.feeds.length;
  console.log(`📡 Total ${maxFeeds} feeds, fetching latest articles...`);

  const articles = await reader.getAllArticles();

  if (articles.length === 0) {
    console.log('❌ No articles fetched');
    return;
  }

  console.log(`✅ Total ${articles.length} articles fetched\n`);
  displayArticles(articles);
}

function displayArticles(articles, feedName = null) {
  articles.slice(0, 20).forEach((item, index) => {
    const date = new Date(item.pubDate).toLocaleDateString('en-US');
    const source = feedName || item.feedTitle || 'Unknown';

    console.log(`${'─'.repeat(80)}`);
    console.log(`📌 ${index + 1}. ${item.title}`);
    console.log(`   📰 Source: ${source}`);
    console.log(`   📅 Date: ${date}`);
    if (item.author) console.log(`   👤 Author: ${item.author}`);
    console.log(`   🔗 Link: ${item.link}`);

    if (item.contentSnippet) {
      const snippet = item.contentSnippet.replace(/\n/g, ' ').substring(0, 150);
      console.log(`   📝 Snippet: ${snippet}...`);
    }
    console.log();
  });

  if (articles.length > 20) {
    console.log(`... and ${articles.length - 20} more articles not shown`);
  }
}

main().catch(console.error);