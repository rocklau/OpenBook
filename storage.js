/**
 * OpenBook storage layer.
 * - SQLite for queryable indices/cache
 * - JSON index for quick grep/search
 * - Markdown files with YAML front matter for article/note persistence
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.OPENBOOK_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = process.env.OPENBOOK_DB_PATH || path.join(DATA_DIR, 'openbook.db');
const JSON_INDEX_PATH = process.env.OPENBOOK_JSON_INDEX || path.join(DATA_DIR, 'index.json');
const ARTICLES_DIR = process.env.OPENBOOK_ARTICLES_DIR || path.join(DATA_DIR, 'articles');
const NOTES_DIR = process.env.OPENBOOK_NOTES_DIR || path.join(DATA_DIR, 'notes');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function openDb() {
  ensureDir(DATA_DIR);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Raw fetch cache for RSS XML and article HTML
    CREATE TABLE IF NOT EXISTS fetch_cache (
      url TEXT PRIMARY KEY,
      kind TEXT NOT NULL, -- 'rss' | 'html'
      status INTEGER,
      content_type TEXT,
      etag TEXT,
      last_modified TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      body BLOB
    );
    CREATE INDEX IF NOT EXISTS idx_fetch_cache_kind_time ON fetch_cache(kind, fetched_at);

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY, -- stable hash (feed_url + guid/link)
      feed_url TEXT NOT NULL,
      guid TEXT,
      link TEXT,
      title TEXT,
      author TEXT,
      published_at TEXT,
      content_html TEXT,
      content_snippet TEXT,
      markdown_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(feed_url) REFERENCES feeds(url) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_articles_feed_time ON articles(feed_url, published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_link ON articles(link);

    CREATE TABLE IF NOT EXISTS article_state (
      article_id TEXT PRIMARY KEY,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      note_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_article_notes_article ON article_notes(article_id);

    -- Activity feed: append-only log for all user operations
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'state' | 'note' | 'materialize'
      article_id TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_time ON activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_log_article ON activity_log(article_id);
  `);
}

function readJsonIndex() {
  try {
    const raw = fs.readFileSync(JSON_INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, generated_at: null, feeds: [], articles: [] };
  }
}

function writeJsonIndex(indexObj) {
  ensureDir(DATA_DIR);
  const out = {
    ...indexObj,
    version: 1,
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(JSON_INDEX_PATH, JSON.stringify(out, null, 2), 'utf-8');
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  JSON_INDEX_PATH,
  ARTICLES_DIR,
  NOTES_DIR,
  openDb,
  migrate,
  ensureDir,
  readJsonIndex,
  writeJsonIndex
};
