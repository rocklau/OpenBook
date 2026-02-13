const { RSSReader } = require('./rss');
const fs = require('fs');
const { runListNotes, runListFavorites, runShowStats, runShowActivity, runShowBookIndex } = require('./cli/commands-db');
const { runSearchArticles, runOpenArticle, runMaterializeArticle, runShowRecent, runSyncFeeds, runExportData } = require('./cli/commands-core');
const { divider } = require('./cli/formatters');

let reader = null;
let feedsInitialized = false;

// Preset some popular RSS feeds
const defaultFeeds = [
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News' },
  { url: 'https://www.reddit.com/r/programming/.rss', name: 'r/programming' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' }
];

function getReader() {
  if (!reader) reader = new RSSReader();
  return reader;
}

async function initFeeds({ quiet = false, jsonMode = false } = {}) {
  if (feedsInitialized) return;

  const r = getReader();

  const opmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.opml'));
  if (opmlFiles.length > 0) {
    if (!quiet && !jsonMode) console.log(`📂 Found ${opmlFiles.length} OPML files, loading...`);
    for (const file of opmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      await r.loadFromOPML(content);
    }
  }

  if (r.feeds.length === 0) {
    if (!quiet && !jsonMode) console.log('📰 Using default RSS feeds...');
    for (const f of defaultFeeds) {
      try {
        await r.addFeed(f.url, f.name);
      } catch {
        // ignore invalid/unreachable defaults in constrained environments
      }
    }
  }

  if (!quiet && !jsonMode) console.log(`\n📡 Loaded a total of ${r.feeds.length} RSS feeds\n`);
  feedsInitialized = true;
}

function parseArgs(rawArgs) {
  const jsonMode = rawArgs.includes('--json');
  const quiet = rawArgs.includes('--quiet');
  const verbose = rawArgs.includes('--verbose') || rawArgs.includes('-v');
  const args = rawArgs.filter(a => a !== '--json' && a !== '--quiet' && a !== '--verbose' && a !== '-v');
  return { args, jsonMode, quiet, verbose };
}

async function main() {
  const { args, jsonMode, quiet, verbose } = parseArgs(process.argv.slice(2));
  const command = args[0];

  const level0Commands = new Set(['help', '--help', '-h']);
  const level2Commands = new Set(['list', 'read', 'all', 'sync']);

  if (!command) {
    await initFeeds({ quiet, jsonMode });
    await readAll({ verbose });
    return;
  }

  if (command === 'book') {
    if (args[1] === 'index') {
      await showBookIndex({ jsonMode });
      return;
    }
    console.error('Unknown book subcommand');
    console.error('Usage: node cli.js book index [--json]');
    process.exitCode = 1;
    return;
  }

  if (level0Commands.has(command)) {
    showHelp();
    return;
  }

  if (level2Commands.has(command)) {
    await initFeeds({ quiet, jsonMode });
  } else {
    // Level 1: local DB read path only; no OPML loading
    getReader();
  }

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
    sync: () => syncFeeds(args[1] || 50, args[2] || 8000, { jsonMode, quiet }),
    activity: () => showActivity(args[1] || 20),
    all: () => readAll({ verbose })
  };

  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('');
    showHelp();
    process.exitCode = 1;
    return;
  }

  await handler();
}

async function listFeeds() {
  const r = getReader();
  console.log('📋 RSS feed list:\n');
  r.feeds.forEach((feed, index) => {
    console.log(`  ${index + 1}. ${feed.name}`);
    console.log(`     ${feed.url}\n`);
  });
}

async function readFeed(index) {
  const r = getReader();
  const feedIndex = parseInt(index) - 1;
  if (isNaN(feedIndex) || feedIndex < 0 || feedIndex >= r.feeds.length) {
    console.log('❌ Invalid feed index');
    return;
  }

  const feed = r.feeds[feedIndex];
  console.log(`\n📖 Reading: ${feed.name}\n`);

  const parsed = await r.parseFeed(feed.url);
  if (parsed) {
    displayArticles(parsed.items, feed.name);
  }
}

async function readAll({ verbose = false } = {}) {
  const r = getReader();
  console.log('🔄 Fetching all articles...\n');

  const maxFeeds = r.feeds.length;
  console.log(`📡 Total ${maxFeeds} feeds, fetching latest articles...`);

  const articles = await r.getAllArticles(undefined, { verbose });

  if (articles.length === 0) {
    console.log('❌ No articles fetched');
    return;
  }

  console.log(`✅ Total ${articles.length} articles fetched\n`);

  if (verbose && r.lastFetchStats) {
    console.log('🔎 Fetch detail summary:');
    console.log(`   - feeds_seen: ${r.lastFetchStats.feeds_seen || 0}`);
    console.log(`   - network_fetch: ${r.lastFetchStats.network_fetch || 0}`);
    console.log(`   - cache_fallback: ${r.lastFetchStats.cache_fallback || 0}`);
    console.log(`   - min_interval_skip: ${r.lastFetchStats.min_interval_skip || 0}`);
    console.log(`   - memory_cache_hit: ${r.lastFetchStats.memory_cache_hit || 0}`);
    console.log(`   - parse_error: ${r.lastFetchStats.parse_error || 0}`);
    console.log();
  }

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
  await runSearchArticles(getReader(), query, displayArticles);
}

async function listNotes() {
  await runListNotes();
}

async function listFavorites() {
  await runListFavorites();
}

async function showStats() {
  await runShowStats(getReader().feeds.length);
}

async function openArticle(index) {
  await runOpenArticle(getReader(), index);
}

async function materializeArticle(index) {
  await runMaterializeArticle(getReader(), index);
}

async function showRecent(limit) {
  await runShowRecent(getReader(), limit, displayArticles);
}

async function exportData(days) {
  await runExportData(days);
}

async function syncFeeds(limit, timeoutMs, options = {}) {
  await runSyncFeeds({ limit: parseInt(limit) || 50, timeoutMs: parseInt(timeoutMs) || 8000, ...options });
}

async function showActivity(limit) {
  await runShowActivity(limit);
}

async function showBookIndex({ jsonMode = false } = {}) {
  const feedsCount = reader ? reader.feeds.length : 0;
  await runShowBookIndex({ jsonMode, feedsCount });
}

function showHelp() {
  console.log(`
📖 OpenBook CLI - RSS Reader & Knowledge Collector

Usage: node cli.js [command] [options]

Global options:
  --json              JSON output (where supported)
  --quiet             Suppress init/log noise
  --verbose, -v       Print detailed fetch source logs

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
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
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