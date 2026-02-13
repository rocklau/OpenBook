const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const {
  runListNotes,
  runListFavorites,
  runShowStats,
  runShowActivity,
  runShowBookIndex
} = require('../cli/commands-db');

function withCapturedLogs(fn) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => { console.log = original; })
    .then(() => logs.join('\n'));
}

function initDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE articles (id TEXT PRIMARY KEY, title TEXT, link TEXT, markdown_path TEXT);
    CREATE TABLE article_state (article_id TEXT PRIMARY KEY, is_favorite INTEGER);
    CREATE TABLE activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      article_id TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.prepare('INSERT INTO articles(id, title, link, markdown_path) VALUES (?, ?, ?, ?)').run('a1', 'Article One', 'https://example.com/1', 'data/articles/a1.md');
  db.prepare('INSERT INTO article_state(article_id, is_favorite) VALUES (?, ?)').run('a1', 1);
  db.prepare('INSERT INTO activity_log(type, article_id, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run('note', 'a1', JSON.stringify({ title: 'Highlight', content: '> hi' }), '2026-02-11T10:00:00Z');
  db.prepare('INSERT INTO activity_log(type, article_id, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run('state', 'a1', JSON.stringify({ isFavorite: true }), '2026-02-12T10:00:00Z');
  db.close();
}

test('commands-db should render notes/favorites/activity/stats/book-index', async () => {
  const oldCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbook-cli-cdb-'));
  fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
  initDb(path.join(tmpDir, 'data', 'openbook.db'));
  fs.writeFileSync(path.join(tmpDir, 'data', 'index.json'), JSON.stringify({ version: 1, feeds: [1], articles: [1, 2] }), 'utf-8');

  process.chdir(tmpDir);
  try {
    let out = await withCapturedLogs(() => runListNotes());
    assert.match(out, /Notes & Highlights/);

    out = await withCapturedLogs(() => runListFavorites());
    assert.match(out, /Favorites/);

    out = await withCapturedLogs(() => runShowActivity(1));
    assert.match(out, /Last 1 Activities/);

    out = await withCapturedLogs(() => runShowStats(3));
    assert.match(out, /RSS Feeds: 3/);
    assert.match(out, /Notes: 1/);

    out = await withCapturedLogs(() => runShowBookIndex({ jsonMode: false, feedsCount: 3 }));
    assert.match(out, /OpenBook Book Index/);
    assert.match(out, /Loaded feeds: 3/);

    out = await withCapturedLogs(() => runShowBookIndex({ jsonMode: true, feedsCount: 3 }));
    assert.match(out, /"bookRoot"/);
    assert.match(out, /"feedsLoaded": 3/);
  } finally {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
