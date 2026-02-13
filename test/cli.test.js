const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { spawnSync } = require('child_process');

const cli = require('../cli');

function withCapturedLogs(fn) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = original;
    })
    .then(() => logs.join('\n'));
}

function initDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE articles (
      id TEXT PRIMARY KEY,
      title TEXT,
      link TEXT
    );

    CREATE TABLE activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      article_id TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.prepare('INSERT INTO articles(id, title, link) VALUES (?, ?, ?)').run('a1', 'Article One', 'https://example.com/1');
  db.prepare('INSERT INTO articles(id, title, link) VALUES (?, ?, ?)').run('a2', 'Article Two', 'https://example.com/2');

  db.prepare('INSERT INTO activity_log(type, article_id, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run('note', 'a1', JSON.stringify({ title: 'Note', content: 'hello note content' }), '2026-02-10T10:00:00Z');
  db.prepare('INSERT INTO activity_log(type, article_id, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run('note', 'a2', JSON.stringify({ title: 'Highlight', content: '> highlighted text' }), '2026-02-11T10:00:00Z');
  db.prepare('INSERT INTO activity_log(type, article_id, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run('state', 'a1', JSON.stringify({ isFavorite: true }), '2026-02-12T10:00:00Z');

  db.close();
}

describe('CLI unit-ish tests (real function behavior)', () => {
  let oldCwd;
  let tmpDir;

  beforeEach(() => {
    oldCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbook-cli-test-'));
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
    initDb(path.join(tmpDir, 'data', 'openbook.db'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('showHelp should print core commands', async () => {
    const out = await withCapturedLogs(async () => cli.showHelp());
    assert.match(out, /search <query>/);
    assert.match(out, /notes/);
    assert.match(out, /favorites/);
    assert.match(out, /activity \[n\]/);
  });

  it('listNotes should read from activity_log.payload_json', async () => {
    const out = await withCapturedLogs(async () => cli.listNotes());
    assert.match(out, /Notes & Highlights/);
    assert.match(out, /highlighted text/);
    assert.match(out, /Article One|Article Two/);
  });

  it('listFavorites should filter isFavorite from payload_json', async () => {
    const out = await withCapturedLogs(async () => cli.listFavorites());
    assert.match(out, /Favorites/);
    assert.match(out, /Article One/);
  });

  it('showActivity should honor limit', async () => {
    const out = await withCapturedLogs(async () => cli.showActivity(1));
    assert.match(out, /Last 1 Activities/);
  });

  it('showStats should include notes/favorites/highlights counts', async () => {
    const out = await withCapturedLogs(async () => cli.showStats());
    assert.match(out, /Notes: 2/);
    assert.match(out, /Favorites: 1/);
    assert.match(out, /Highlights: 1/);
  });
});

describe('CLI argv dispatch', () => {
  let oldCwd;
  let tmpDir;

  beforeEach(() => {
    oldCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbook-cli-argv-'));

    // Add a lightweight OPML so cli.js won't fallback to default feeds (which require DNS/network).
    fs.writeFileSync(
      path.join(tmpDir, 'feeds.opml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0">\n  <body>\n    <outline text="Local" title="Local" type="rss" xmlUrl="http://127.0.0.1/rss" />\n  </body>\n</opml>`,
      'utf-8'
    );

    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('node cli.js help should exit 0 and print help text', () => {
    const result = spawnSync('node', [path.join(oldCwd, 'cli.js'), 'help'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      env: { ...process.env, OPENBOOK_ALLOW_PRIVATE_FEEDS: 'true' }
    });

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /OpenBook CLI - RSS Reader & Knowledge Collector/);
    assert.match(result.stdout, /search <query>/);
    assert.doesNotMatch(result.stdout, /Loaded a total of/);
    assert.doesNotMatch(result.stdout, /Found .*OPML/);
  });

  it('node cli.js search without query should print usage hint', () => {
    const result = spawnSync('node', [path.join(oldCwd, 'cli.js'), 'search'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      env: { ...process.env, OPENBOOK_ALLOW_PRIVATE_FEEDS: 'true' }
    });

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /Please provide a search query/);
    assert.match(result.stdout, /Usage: node cli\.js search <keyword>/);
  });

  it('node cli.js unknown command should hard fail with help', () => {
    const result = spawnSync('node', [path.join(oldCwd, 'cli.js'), 'foo'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      env: { ...process.env, OPENBOOK_ALLOW_PRIVATE_FEEDS: 'true' }
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /Unknown command: foo/);
    assert.match(result.stdout, /OpenBook CLI - RSS Reader & Knowledge Collector/);
  });
});
