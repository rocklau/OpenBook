const assert = require('node:assert');
const test = require('node:test');

const { createArticleService } = require('../services/articleService');
const { createActivityService } = require('../services/activityService');
const { toInt, clamp } = require('../lib/api');

test('lib/api numeric helpers should parse and clamp correctly', () => {
  assert.strictEqual(toInt('12', 3), 12);
  assert.strictEqual(toInt('x', 3), 3);
  assert.strictEqual(clamp(10, 1, 5), 5);
  assert.strictEqual(clamp(-1, 1, 5), 1);
  assert.strictEqual(clamp(3, 1, 5), 3);
});

test('articleService.listArticles should write compact index and process articles', async () => {
  let wroteIndex;
  let processed;

  const service = createArticleService({
    reader: {
      feeds: [{ url: 'https://example.com/rss', name: 'Example' }],
      getAllArticles: async () => ([
        {
          feedName: 'Example',
          title: 'A',
          link: 'https://example.com/a',
          guid: 'g1',
          pubDate: '2026-01-01',
          author: 'me'
        }
      ])
    },
    stableId: () => 'id-1',
    safeFileName: (s) => s,
    ensureDir: () => {},
    ARTICLES_DIR: '/tmp/articles',
    NOTES_DIR: '/tmp/notes',
    queuedFetch: async () => ({ text: async () => '<html></html>' }),
    htmlToMarkdown: () => 'md',
    downloadResources: async () => {},
    ACTIVITY_TYPES: { NOTE: 'note', STATE: 'state', MATERIALIZE: 'materialize' },
    readJsonIndex: () => ({ feeds: [], articles: [] }),
    writeJsonIndex: (v) => { wroteIndex = v; },
    repositories: {},
    processArticles: (articles) => { processed = articles; },
    initFeeds: async () => {}
  });

  const out = await service.listArticles(50);
  assert.strictEqual(out.length, 1);
  assert.ok(wroteIndex);
  assert.strictEqual(wroteIndex.feeds.length, 1);
  assert.strictEqual(wroteIndex.articles[0].id, 'id-1');
  assert.strictEqual(processed.length, 1);
});

test('activityService.listActivity should parse payload and map article object', () => {
  const service = createActivityService({
    ACTIVITY_TYPES: { NOTE: 'note', STATE: 'state', MATERIALIZE: 'materialize' },
    repositories: {
      listActivity: () => ([
        {
          id: 1,
          type: 'note',
          article_id: 'a1',
          created_at: '2026-01-01T00:00:00Z',
          payload_json: JSON.stringify({ title: 'Note' }),
          article_title: 'Article 1',
          article_link: 'https://example.com',
          feed_url: 'https://example.com/rss',
          article_markdown_path: 'data/articles/a1.md'
        }
      ]),
      listActivitySince: () => []
    }
  });

  const out = service.listActivity({ limit: 10, offset: 0 });
  assert.strictEqual(out.items.length, 1);
  assert.strictEqual(out.items[0].payload.title, 'Note');
  assert.strictEqual(out.items[0].article.id, 'a1');
});

test('articleService.materializeArticle should skip when url already materialized', async () => {
  const existingMd = '/tmp/existing.md';
  const existsSyncOriginal = require('node:fs').existsSync;
  let fetchCalled = false;

  require('node:fs').existsSync = (p) => (p === existingMd ? true : existsSyncOriginal(p));

  try {
    const service = createArticleService({
      reader: { feeds: [] },
      stableId: () => 'id-1',
      safeFileName: (s) => s,
      ensureDir: () => {},
      ARTICLES_DIR: '/tmp/articles',
      NOTES_DIR: '/tmp/notes',
      queuedFetch: async () => {
        fetchCalled = true;
        throw new Error('should not fetch when already materialized');
      },
      htmlToMarkdown: () => 'md',
      downloadResources: async () => {},
      ACTIVITY_TYPES: { NOTE: 'note', STATE: 'state', MATERIALIZE: 'materialize' },
      readJsonIndex: () => ({ feeds: [], articles: [] }),
      writeJsonIndex: () => {},
      repositories: {
        getArticleByLink: () => ({ id: 'a1', markdown_path: existingMd })
      },
      processArticles: () => {},
      initFeeds: async () => {}
    });

    const result = await service.materializeArticle({ url: 'https://example.com/post' });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.articleId, 'a1');
    assert.strictEqual(result.markdownPath, existingMd);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'already_materialized');
    assert.strictEqual(fetchCalled, false);
  } finally {
    require('node:fs').existsSync = existsSyncOriginal;
  }
});

test('articleService.warmSync should expose running and success status', async () => {
  let resolveFetch;
  const started = new Promise(resolve => {
    resolveFetch = () => resolve([
      {
        feedName: 'Example',
        title: 'A',
        link: 'https://example.com/a',
        guid: 'g1',
        pubDate: '2026-01-01',
        author: 'me'
      }
    ]);
  });

  const service = createArticleService({
    reader: {
      feeds: [{ url: 'https://example.com/rss', name: 'Example' }],
      getAllArticles: async () => started
    },
    stableId: () => 'id-1',
    safeFileName: (s) => s,
    ensureDir: () => {},
    ARTICLES_DIR: '/tmp/articles',
    NOTES_DIR: '/tmp/notes',
    queuedFetch: async () => ({ text: async () => '<html></html>' }),
    htmlToMarkdown: () => 'md',
    downloadResources: async () => {},
    ACTIVITY_TYPES: { NOTE: 'note', STATE: 'state', MATERIALIZE: 'materialize' },
    readJsonIndex: () => ({ feeds: [], articles: [] }),
    writeJsonIndex: () => {},
    repositories: {},
    processArticles: () => {},
    initFeeds: async () => {}
  });

  const syncPromise = service.warmSync({ limit: 20, timeoutMs: 3000, reason: 'startup' });
  assert.strictEqual(service.getSyncStatus().status, 'running');

  resolveFetch();
  const result = await syncPromise;

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(service.getSyncStatus().status, 'success');
  assert.strictEqual(service.getSyncStatus().lastCount, 1);
});
