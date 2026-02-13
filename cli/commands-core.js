const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { hasDb, withDb } = require('../lib/cli-db');

function readArticlesFromDb(limit = 200) {
  if (!hasDb()) return [];

  return withDb((db) => db.prepare(`
    SELECT id, title, link, author, published_at, content_snippet, feed_url
    FROM articles
    WHERE link IS NOT NULL
    ORDER BY datetime(published_at) DESC, datetime(updated_at) DESC
    LIMIT ?
  `).all(limit), { dbOptions: { readonly: true } }).map((row) => ({
    id: row.id,
    title: row.title || 'Untitled',
    link: row.link,
    author: row.author,
    pubDate: row.published_at,
    contentSnippet: row.content_snippet,
    feedName: (() => {
      try { return new URL(row.feed_url).hostname; } catch { return row.feed_url || 'Unknown'; }
    })()
  }));
}

async function getArticlesForCli(reader, limit = 200) {
  const looksLikeFullReader = !!(reader && reader.db && typeof reader.parseFeed === 'function');
  if (looksLikeFullReader) {
    const local = readArticlesFromDb(limit);
    if (local.length > 0) return local;
  }
  return reader.getAllArticles(limit);
}

async function runSearchArticles(reader, query, displayArticles) {
  if (!query) {
    console.log('❌ Please provide a search query');
    console.log('   Usage: node cli.js search <keyword>');
    return;
  }

  console.log(`🔍 Searching for: "${query}"\n`);
  const articles = await getArticlesForCli(reader, 400);
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

async function runOpenArticle(reader, index) {
  const articles = await getArticlesForCli(reader, 300);
  const articleIndex = parseInt(index) - 1;

  if (isNaN(articleIndex) || articleIndex < 0 || articleIndex >= articles.length) {
    console.log('❌ Invalid article index');
    return;
  }

  const article = articles[articleIndex];
  console.log(`🌐 Opening: ${article.title}`);
  console.log(`   ${article.link}`);

  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${command} "${article.link}"`, (err) => {
    if (err) console.log('❌ Failed to open browser');
  });
}

async function runMaterializeArticle(reader, index) {
  const articles = await getArticlesForCli(reader, 300);
  const articleIndex = parseInt(index) - 1;

  if (isNaN(articleIndex) || articleIndex < 0 || articleIndex >= articles.length) {
    console.log('❌ Invalid article index');
    return;
  }

  const article = articles[articleIndex];
  console.log(`💾 Materializing: ${article.title}\n`);

  try {
    const response = await fetch('http://localhost:3000/api/article/materialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: article.link, title: article.title })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const label = result.skipped ? 'ℹ️ Already materialized' : '✅ Saved to';
    console.log(`${label}: ${result.markdownPath || result.filePath || 'data/articles/'}`);
    console.log(`   Article ID: ${result.articleId}`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    console.log('   Make sure the server is running: npm start');
  }
}

async function runShowRecent(reader, limit, displayArticles) {
  const count = parseInt(limit) || 10;
  console.log(`📰 Last ${count} Articles\n`);
  const articles = await getArticlesForCli(reader, Math.max(count, 50));
  displayArticles(articles.slice(0, count));
}

async function runSyncFeeds({ limit = 50, timeoutMs = 8000 } = {}) {
  console.log(`🔄 Syncing feeds (limit=${limit}, timeout=${timeoutMs}ms)...`);
  try {
    const response = await fetch('http://localhost:3000/api/sync/warm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, timeoutMs })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Sync status=${result.status}, count=${result.count}`);
    } else {
      console.log(`⚠️ Sync status=${result.status}, error=${result.error || 'unknown'}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    console.log('   Make sure the server is running: npm start');
  }
}

async function runExportData(days) {
  const daysCount = parseInt(days) || 7;
  console.log(`📤 Exporting last ${daysCount} days...\n`);

  try {
    const response = await fetch(`http://localhost:3000/api/export/markdown?days=${daysCount}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

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

module.exports = {
  runSearchArticles,
  runOpenArticle,
  runMaterializeArticle,
  runShowRecent,
  runSyncFeeds,
  runExportData
};
