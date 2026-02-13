const fs = require('fs');
const path = require('path');
const { getDbPath, hasDb, withDb } = require('../lib/cli-db');
const { divider, formatDate, truncateInline } = require('./formatters');
const { getNotes, getFavorites, getActivity, getStats, getBookDbStats } = require('./db-queries');

async function runListNotes() {
  if (!hasDb()) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const notes = withDb((db) => getNotes(db));
  if (notes.length === 0) {
    console.log('📝 No notes found');
    return;
  }

  console.log(`📝 ${notes.length} Notes & Highlights\n`);
  notes.forEach((note, index) => {
    const payload = JSON.parse(note.payload_json || '{}');
    console.log(divider());
    console.log(`📝 ${index + 1}. ${payload.title || 'Note'}`);
    console.log(`   📰 Article: ${note.article_title || 'Unknown'}`);
    console.log(`   📅 Date: ${formatDate(note.created_at, 'date')}`);
    if (payload.content) console.log(`   ✏️  Content: ${truncateInline(payload.content, 200)}`);
    if (note.article_link) console.log(`   🔗 Link: ${note.article_link}`);
    console.log();
  });
}

async function runListFavorites() {
  if (!hasDb()) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const favorites = withDb((db) => getFavorites(db));
  if (favorites.length === 0) {
    console.log('⭐ No favorites found');
    return;
  }

  console.log(`⭐ ${favorites.length} Favorites\n`);
  favorites.forEach((fav, index) => {
    console.log(divider());
    console.log(`⭐ ${index + 1}. ${fav.article_title || 'Unknown'}`);
    console.log(`   📅 Favorited: ${formatDate(fav.created_at, 'date')}`);
    if (fav.article_link) console.log(`   🔗 Link: ${fav.article_link}`);
    console.log();
  });
}

async function runShowStats(feedsCount) {
  console.log('📊 OpenBook Statistics\n');
  console.log(divider());
  console.log(`📡 RSS Feeds: ${feedsCount}`);

  if (hasDb()) {
    const counts = withDb((db) => getStats(db));
    console.log(`📄 Articles: ${counts.articles}`);
    console.log(`📝 Notes: ${counts.notes}`);
    console.log(`⭐ Favorites: ${counts.favorites}`);
    console.log(`✨ Highlights: ${counts.highlights}`);
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    const getDirSize = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((size, file) => {
      const filePath = path.join(dir, file.name);
      return size + (file.isDirectory() ? getDirSize(filePath) : fs.statSync(filePath).size);
    }, 0);

    const sizeMB = (getDirSize(dataDir) / 1024 / 1024).toFixed(2);
    console.log(`💾 Data Size: ${sizeMB} MB`);
  }

  console.log(divider());
}

async function runShowActivity(limit) {
  if (!hasDb()) {
    console.log('❌ Database not found. Start the web server first to initialize.');
    return;
  }

  const count = parseInt(limit) || 20;
  const activities = withDb((db) => getActivity(db, count));
  console.log(`📋 Last ${activities.length} Activities\n`);

  activities.forEach((activity, index) => {
    const payload = JSON.parse(activity.payload_json || '{}');
    console.log(divider());
    console.log(`${index + 1}. [${activity.type.toUpperCase()}] ${activity.article_title || 'Unknown'}`);
    console.log(`   🕐 ${formatDate(activity.created_at, 'datetime')}`);
    if (payload.isFavorite) console.log('   ⭐ Added to favorites');
    if (payload.isRead) console.log('   👁️  Marked as read');
    if (payload.content) console.log(`   📝 ${truncateInline(payload.content, 150)}`);
    console.log();
  });
}

async function runShowBookIndex({ jsonMode = false, feedsCount = 0 } = {}) {
  const dataDir = path.join(process.cwd(), 'data');
  const dbPath = getDbPath();
  const indexPath = path.join(dataDir, 'index.json');
  const articlesDir = path.join(dataDir, 'articles');
  const notesDir = path.join(dataDir, 'notes');

  const result = {
    bookRoot: dataDir,
    files: {
      db: { path: dbPath, exists: fs.existsSync(dbPath) },
      indexJson: { path: indexPath, exists: fs.existsSync(indexPath) },
      articlesDir: { path: articlesDir, exists: fs.existsSync(articlesDir) },
      notesDir: { path: notesDir, exists: fs.existsSync(notesDir) }
    },
    stats: { feedsLoaded: feedsCount, db: null, index: null },
    nextCommands: ['node cli.js all', 'node cli.js recent 20', 'node cli.js materialize 1', 'node cli.js activity 20']
  };

  if (result.files.db.exists) {
    result.stats.db = withDb((db) => getBookDbStats(db), { dbOptions: { readonly: true } });
  }

  if (result.files.indexJson.exists) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      result.stats.index = {
        version: index.version || 1,
        generatedAt: index.generated_at || null,
        feeds: Array.isArray(index.feeds) ? index.feeds.length : 0,
        articles: Array.isArray(index.articles) ? index.articles.length : 0
      };
    } catch {
      result.stats.index = { error: 'index.json parse failed' };
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('📚 OpenBook Book Index\n');
  console.log(`Root: ${result.bookRoot}\n`);
  console.log('Files:');
  console.log(`  - DB: ${result.files.db.exists ? '✅' : '❌'} ${result.files.db.path}`);
  console.log(`  - index.json: ${result.files.indexJson.exists ? '✅' : '❌'} ${result.files.indexJson.path}`);
  console.log(`  - articles/: ${result.files.articlesDir.exists ? '✅' : '❌'} ${result.files.articlesDir.path}`);
  console.log(`  - notes/: ${result.files.notesDir.exists ? '✅' : '❌'} ${result.files.notesDir.path}\n`);

  console.log('Stats:');
  console.log(`  - Loaded feeds: ${result.stats.feedsLoaded}`);
  if (result.stats.db) {
    console.log(`  - DB articles: ${result.stats.db.articles}`);
    console.log(`  - DB materialized: ${result.stats.db.materialized}`);
    console.log(`  - DB notes: ${result.stats.db.notes}`);
    console.log(`  - DB favorites: ${result.stats.db.favorites}`);
  }
  if (result.stats.index) {
    if (result.stats.index.error) console.log(`  - index.json: ${result.stats.index.error}`);
    else {
      console.log(`  - index.json feeds: ${result.stats.index.feeds}`);
      console.log(`  - index.json articles: ${result.stats.index.articles}`);
      console.log(`  - index generated_at: ${result.stats.index.generatedAt || 'n/a'}`);
    }
  }

  console.log('\nNext:');
  result.nextCommands.forEach(c => console.log(`  - ${c}`));
  console.log('\nTip: node cli.js book index --json');
}

module.exports = {
  runListNotes,
  runListFavorites,
  runShowStats,
  runShowActivity,
  runShowBookIndex
};
