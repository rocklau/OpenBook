const { RSSReader } = require('./rss');
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
    case 'search':
      await searchArticles(args.slice(1).join(' '));
      break;
    case 'notes':
    case 'highlights':
      await listNotes();
      break;
    case 'favorites':
      await listFavorites();
      break;
    case 'stats':
      await showStats();
      break;
    case 'open':
      await openArticle(args[1]);
      break;
    case 'materialize':
      await materializeArticle(args[1]);
      break;
    case 'recent':
      await showRecent(args[1] || 10);
      break;
    case 'export':
      await exportData(args[1] || '7');
      break;
    case 'activity':
      await showActivity(args[1] || 20);
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
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

async function searchArticles(query) {
  if (!query) {
    console.log('❌ Please provide a search query');
    console.log('   Usage: node cli.js search <keyword>');
    return;
  }

  console.log(`🔍 Searching for: "${query}"\n`);

  const articles = await reader.getAllArticles();
  const results = articles.filter(item => {
    const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  if (results.length === 0) {
    console.log('❌ No articles found');
    return;
  }

  console.log(`✅ Found ${results.length} articles\n`);
  displayArticles(results);
}

async function listNotes() {
  const dbPath = path.join(process.cwd(), 'data', 'openbook.db');
  if (!fs.existsSync(dbPath)) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  const notes = db.prepare(`
    SELECT al.*, a.title as article_title, a.link as article_link
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    WHERE al.type = 'note'
    ORDER BY al.created_at DESC
    LIMIT 50
  `).all();

  db.close();

  if (notes.length === 0) {
    console.log('📝 No notes found');
    return;
  }

  console.log(`📝 ${notes.length} Notes & Highlights\n`);

  notes.forEach((note, index) => {
    const payload = JSON.parse(note.payload_json || '{}');
    const date = new Date(note.created_at).toLocaleDateString('en-US');

    console.log(`${'─'.repeat(80)}`);
    console.log(`📝 ${index + 1}. ${payload.title || 'Note'}`);
    console.log(`   📰 Article: ${note.article_title || 'Unknown'}`);
    console.log(`   📅 Date: ${date}`);

    if (payload.content) {
      const content = payload.content.replace(/\n/g, ' ').substring(0, 200);
      console.log(`   ✏️  Content: ${content}${payload.content.length > 200 ? '...' : ''}`);
    }

    if (note.article_link) {
      console.log(`   🔗 Link: ${note.article_link}`);
    }
    console.log();
  });
}

async function listFavorites() {
  const dbPath = path.join(process.cwd(), 'data', 'openbook.db');
  if (!fs.existsSync(dbPath)) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  const favorites = db.prepare(`
    SELECT al.*, a.title as article_title, a.link as article_link
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    WHERE al.type = 'state' AND json_extract(al.payload_json, '$.isFavorite') = 1
    ORDER BY al.created_at DESC
    LIMIT 50
  `).all();

  db.close();

  if (favorites.length === 0) {
    console.log('⭐ No favorites found');
    return;
  }

  console.log(`⭐ ${favorites.length} Favorites\n`);

  favorites.forEach((fav, index) => {
    const date = new Date(fav.created_at).toLocaleDateString('en-US');

    console.log(`${'─'.repeat(80)}`);
    console.log(`⭐ ${index + 1}. ${fav.article_title || 'Unknown'}`);
    console.log(`   📅 Favorited: ${date}`);
    if (fav.article_link) {
      console.log(`   🔗 Link: ${fav.article_link}`);
    }
    console.log();
  });
}

async function showStats() {
  const dbPath = path.join(process.cwd(), 'data', 'openbook.db');

  console.log('📊 OpenBook Statistics\n');
  console.log(`${'─'.repeat(80)}`);

  console.log(`📡 RSS Feeds: ${reader.feeds.length}`);

  const hasDatabase = fs.existsSync(dbPath);
  if (hasDatabase) {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    const articlesCount = db.prepare('SELECT COUNT(*) as count FROM articles').get();
    const notesCount = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE type = 'note'").get();
    const favoritesCount = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE type = 'state' AND json_extract(payload_json, '$.isFavorite') = 1").get();
    const highlightsCount = db.prepare(`
      SELECT COUNT(*) as count FROM activity_log
      WHERE type = 'note' AND json_extract(payload_json, '$.title') = 'Highlight'
    `).get();

    db.close();

    console.log(`📄 Articles: ${articlesCount.count}`);
    console.log(`📝 Notes: ${notesCount.count}`);
    console.log(`⭐ Favorites: ${favoritesCount.count}`);
    console.log(`✨ Highlights: ${highlightsCount.count}`);
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    const getDirSize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          size += getDirSize(filePath);
        } else {
          size += fs.statSync(filePath).size;
        }
      }
      return size;
    };

    const sizeBytes = getDirSize(dataDir);
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`💾 Data Size: ${sizeMB} MB`);
  }

  console.log(`${'─'.repeat(80)}`);
}

async function openArticle(index) {
  const articles = await reader.getAllArticles();
  const articleIndex = parseInt(index) - 1;

  if (isNaN(articleIndex) || articleIndex < 0 || articleIndex >= articles.length) {
    console.log('❌ Invalid article index');
    return;
  }

  const article = articles[articleIndex];
  console.log(`🌐 Opening: ${article.title}`);
  console.log(`   ${article.link}`);

  const { exec } = require('child_process');
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${command} "${article.link}"`, (err) => {
    if (err) {
      console.log('❌ Failed to open browser');
    }
  });
}

async function materializeArticle(index) {
  const articles = await reader.getAllArticles();
  const articleIndex = parseInt(index) - 1;

  if (isNaN(articleIndex) || articleIndex < 0 || articleIndex >= articles.length) {
    console.log('❌ Invalid article index');
    return;
  }

  const article = articles[articleIndex];
  console.log(`💾 Materializing: ${article.title}\n`);

  try {
    const response = await fetch(`http://localhost:3000/api/article/materialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: article.link, title: article.title })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Saved to: ${result.filePath || 'data/articles/'}`);
    console.log(`   Article ID: ${result.articleId}`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    console.log('   Make sure the server is running: npm start');
  }
}

async function showRecent(limit) {
  const count = parseInt(limit) || 10;
  console.log(`📰 Last ${count} Articles\n`);

  const articles = await reader.getAllArticles();
  const recent = articles.slice(0, count);

  displayArticles(recent);
}

async function exportData(days) {
  const daysCount = parseInt(days) || 7;
  console.log(`📤 Exporting last ${daysCount} days...\n`);

  try {
    const response = await fetch(`http://localhost:3000/api/export/markdown?days=${daysCount}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const markdown = await response.text();
    const exportPath = path.join(process.cwd(), 'data', `export-${Date.now()}.md`);

    fs.writeFileSync(exportPath, markdown);
    console.log(`✅ Exported to: ${exportPath}`);
    console.log(`   ${markdown.split('\n').length} lines`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    console.log('   Make sure the server is running: npm start');
  }
}

async function showActivity(limit) {
  const dbPath = path.join(process.cwd(), 'data', 'openbook.db');
  if (!fs.existsSync(dbPath)) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const count = parseInt(limit) || 20;
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  const activities = db.prepare(`
    SELECT al.*, a.title as article_title
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(count);

  db.close();

  console.log(`📋 Last ${activities.length} Activities\n`);

  activities.forEach((activity, index) => {
    const payload = JSON.parse(activity.payload_json || '{}');
    const date = new Date(activity.created_at).toLocaleString('en-US');
    const type = activity.type.toUpperCase();

    console.log(`${'─'.repeat(80)}`);
    console.log(`${index + 1}. [${type}] ${activity.article_title || 'Unknown'}`);
    console.log(`   🕐 ${date}`);

    if (payload.isFavorite) {
      console.log('   ⭐ Added to favorites');
    }
    if (payload.isRead) {
      console.log('   👁️  Marked as read');
    }
    if (payload.content) {
      const content = payload.content.replace(/\n/g, ' ').substring(0, 150);
      console.log(`   📝 ${content}${payload.content.length > 150 ? '...' : ''}`);
    }
    console.log();
  });
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
  export [days]       Export notes to Markdown file (default: 7 days)
  
Info:
  stats               Show database statistics
  help                Show this help message

Examples:
  node cli.js                    # Show all articles
  node cli.js search "AI"        # Search for AI-related articles
  node cli.js recent 20          # Show last 20 articles
  node cli.js open 5             # Open 5th article in browser
  node cli.js notes              # List all notes and highlights
  node cli.js export 30          # Export last 30 days as Markdown
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
  displayArticles,
  materializeArticle,
  openArticle,
  exportData,
  readAll,
  readFeed,
  listFeeds
};