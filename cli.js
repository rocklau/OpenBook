const { RSSReader } = require('./rss');
const fs = require('fs');
const { runListNotes, runListFavorites, runShowStats, runShowActivity, runShowBookIndex } = require('./cli/commands-db');
const { runSearchArticles, runOpenArticle, runMaterializeArticle, runShowRecent, runSyncFeeds, runExportData } = require('./cli/commands-core');
const { divider } = require('./cli/formatters');

const reader = new RSSReader();

// Preset some popular RSS feeds
const defaultFeeds = [
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News' },
  { url: 'https://www.reddit.com/r/programming/.rss', name: 'r/programming' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' }
];

async function main() {
  const rawArgs = process.argv.slice(2);
  const jsonMode = rawArgs.includes('--json');
  const args = rawArgs.filter(a => a !== '--json');
  const command = args[0];

  // Load OPML files (if they exist)
  const opmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.opml'));
  if (opmlFiles.length > 0) {
    if (!jsonMode) console.log(`📂 Found ${opmlFiles.length} OPML files, loading...`);
    for (const file of opmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      await reader.loadFromOPML(content);
    }
  }

  // Use default feeds if no feeds are loaded
  if (reader.feeds.length === 0) {
    if (!jsonMode) console.log('📰 Using default RSS feeds...');
    defaultFeeds.forEach(f => reader.addFeed(f.url, f.name));
  }

  if (!jsonMode) console.log(`\n📡 Loaded a total of ${reader.feeds.length} RSS feeds\n`);

  const handlers = {
    list: () => listFeeds(),
    read: () => readFeed(args[1]),
    search: () => searchArticles(args.slice(1).join(' ')),
    notes: () => listNotes(),
    highlights: () => listNotes(),
    favorites: () => listFavorites(),
    stats: () => showStats(),
    open: () => openArticle(args[1]),
    materialize: () => materializeArticle(args[1]),
    recent: () => showRecent(args[1] || 10),
    export: () => exportData(args[1] || '7'),
    sync: () => syncFeeds(args[1] || 50, args[2] || 8000),
    activity: () => showActivity(args[1] || 20),
    help: () => showHelp(),
    '--help': () => showHelp(),
    '-h': () => showHelp(),
    all: () => readAll()
  };

  if (command === 'book') {
    if (args[1] === 'index') {
      await showBookIndex({ jsonMode });
    } else {
      console.log('❌ Unknown book subcommand');
      console.log('   Usage: node cli.js book index [--json]');
    }
    return;
  }

  const handler = handlers[command] || handlers.all;
  await handler();
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
    const source = feedName || item.feedName || item.feedTitle || 'Unknown';

    console.log(divider());
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

async function searchArticles(query) {
  await runSearchArticles(reader, query, displayArticles);
}

async function listNotes() {
  await runListNotes();
}

async function listFavorites() {
  await runListFavorites();
}

async function showStats() {
  await runShowStats(reader.feeds.length);
}

async function openArticle(index) {
  await runOpenArticle(reader, index);
}

async function materializeArticle(index) {
  await runMaterializeArticle(reader, index);
}

async function showRecent(limit) {
  await runShowRecent(reader, limit, displayArticles);
}

async function exportData(days) {
  await runExportData(days);
}

async function syncFeeds(limit, timeoutMs) {
  await runSyncFeeds({ limit: parseInt(limit) || 50, timeoutMs: parseInt(timeoutMs) || 8000 });
}

async function showActivity(limit) {
  await runShowActivity(limit);
}

async function showBookIndex({ jsonMode = false } = {}) {
  await runShowBookIndex({ jsonMode, feedsCount: reader.feeds.length });
}

function showHelp() {
  console.log(`
📖 OpenBook CLI - RSS Reader & Knowledge Collector

Usage: node cli.js [command] [options]

Commands:
  (default)           Show all recent articles
  list                List all RSS feeds
  read <index>        Read articles from specific feed
  search <query>      Search articles by keyword
  recent [n]          Show last n articles (default: 10)
  
Knowledge Management:
  notes               List all notes and highlights
  highlights          Alias for 'notes'
  favorites           List all favorited articles
  activity [n]        Show recent activity log (default: 20)
  
Actions:
  open <index>        Open article in browser
  materialize <index> Save article as Markdown
  sync [limit] [ms]   Explicitly sync feeds (append behavior)
  export [days]       Export notes to Markdown file (default: 7 days)
  
Info:
  stats               Show database statistics
  book index [--json] Show /data knowledge-base index for agents
  help                Show this help message

Examples:
  node cli.js                    # Show all articles
  node cli.js search "AI"        # Search for AI-related articles
  node cli.js recent 20          # Show last 20 articles
  node cli.js open 5             # Open 5th article in browser
  node cli.js notes              # List all notes and highlights
  node cli.js sync 80 10000      # Explicit sync (limit=80, timeout=10s)
  node cli.js export 30          # Export last 30 days as Markdown
  node cli.js book index --json  # Machine-readable /data index for agents
`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  main,
  searchArticles,
  listNotes,
  listFavorites,
  showStats,
  showRecent,
  showActivity,
  showHelp,
  showBookIndex,
  displayArticles,
  materializeArticle,
  openArticle,
  exportData,
  readAll,
  readFeed,
  listFeeds
};