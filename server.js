const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { RSSReader } = require('./rss');
const { readJsonIndex, writeJsonIndex } = require('./storage');
const { stableId, safeFileName } = require('./utils');
const { ensureDir, ARTICLES_DIR, NOTES_DIR, openDb, migrate, DATA_DIR } = require('./storage');
const { queuedFetch } = require('./http');
const { htmlToMarkdown } = require('./html_to_md');
const { ACTIVITY_TYPES } = require('./activity');
const { downloadResources } = require('./collector');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use('/data', express.static(DATA_DIR));

const reader = new RSSReader();

// Local feature DB (same file as rss.js uses) for article/state persistence
const featureDb = openDb();
migrate(featureDb);

const stmtUpsertArticle = featureDb.prepare(`
  INSERT INTO articles(id, feed_url, guid, link, title, author, published_at, content_html, content_snippet, markdown_path, updated_at)
  VALUES (@id, @feed_url, @guid, @link, @title, @author, @published_at, @content_html, @content_snippet, @markdown_path, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title,
    author=excluded.author,
    published_at=excluded.published_at,
    content_html=excluded.content_html,
    content_snippet=excluded.content_snippet,
    markdown_path=COALESCE(excluded.markdown_path, articles.markdown_path),
    updated_at=datetime('now')
`);

const stmtSetState = featureDb.prepare(`
  INSERT INTO article_state(article_id, is_read, is_favorite, updated_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(article_id) DO UPDATE SET
    is_read=excluded.is_read,
    is_favorite=excluded.is_favorite,
    updated_at=datetime('now')
`);

const stmtGetState = featureDb.prepare('SELECT is_read, is_favorite, updated_at FROM article_state WHERE article_id=?');
const stmtGetArticle = featureDb.prepare('SELECT * FROM articles WHERE id=?');
const stmtInsertNote = featureDb.prepare('INSERT INTO article_notes(article_id, note_path) VALUES (?, ?)');
const stmtListNotes = featureDb.prepare('SELECT id, note_path, created_at FROM article_notes WHERE article_id=? ORDER BY id DESC');

const stmtLogActivity = featureDb.prepare('INSERT INTO activity_log(type, article_id, payload_json) VALUES (?, ?, ?)');
const stmtGetActivity = featureDb.prepare(`
  SELECT a.id, a.type, a.article_id, a.payload_json, a.created_at,
         ar.title AS article_title, ar.link AS article_link, ar.feed_url AS feed_url,
         ar.markdown_path AS article_markdown_path
  FROM activity_log a
  LEFT JOIN articles ar ON ar.id = a.article_id
  ORDER BY a.created_at DESC
  LIMIT ? OFFSET ?
`);

/**
 * Helper to ensure articles are in DB and decorated with IDs and State
 */
function processArticles(articles) {
  for (const a of articles) {
    const feedUrl = a.feedUrl || (reader.feeds.find(f => f.name === (a.feedName || a.feedTitle)) || {}).url;

    if (!feedUrl) {
      console.error(`[Server] Skipping article because feed URL could not be determined: ${a.title}`);
      continue;
    }

    const id = stableId(feedUrl, a.guid || a.link || a.title);
    a.id = id;

    // Upsert metadata
    stmtUpsertArticle.run({
      id,
      feed_url: feedUrl,
      guid: a.guid || null,
      link: a.link || null,
      title: a.title || null,
      author: a.author || null,
      published_at: a.pubDate || null,
      content_html: a.content || a['content:encoded'] || null,
      content_snippet: a.contentSnippet || null,
      markdown_path: null
    });

    // Attach state
    const state = stmtGetState.get(id);
    a.isRead = !!state?.is_read;
    a.isFavorite = !!state?.is_favorite;
  }
}



async function initFeeds() {
  const files = fs.readdirSync('.');
  const opmlFiles = files.filter(f => f.endsWith('.opml'));

  for (const file of opmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    await reader.loadFromOPML(content);
  }

  if (reader.feeds.length === 0) {
    try {
      await reader.addFeed('https://news.ycombinator.com/rss', 'Hacker News');
      await reader.addFeed('https://www.reddit.com/r/programming/.rss', 'r/programming');
    } catch (e) {
      console.error('Failed to add default feeds:', e.message);
    }
  }

  console.log(`Loaded ${reader.feeds.length} RSS feeds`);
}

app.get('/api/feeds', (req, res) => {
  res.json(reader.feeds);
});

// Get recent articles (limited to prevent timeout)
app.get('/api/articles', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const articles = await reader.getAllArticles(limit);

    // Persist minimal index for grep-friendly workflows
    const index = readJsonIndex();
    const feedSet = new Map(index.feeds.map(f => [f.url, f]));
    reader.feeds.forEach(f => {
      if (!feedSet.has(f.url)) feedSet.set(f.url, { url: f.url, name: f.name });
    });

    const compact = articles.map(a => ({
      id: stableId(a.feedName || a.feedTitle || '', a.guid || a.link || a.title),
      feed: a.feedName || a.feedTitle,
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      author: a.author
    }));

    index.feeds = Array.from(feedSet.values());
    index.articles = compact;
    writeJsonIndex(index);

    // Persist into SQLite index
    processArticles(articles);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get articles by date (for date navigation)
app.get('/api/articles/by-date', async (req, res) => {
  try {
    const dateParam = req.query.date;
    const date = dateParam ? new Date(dateParam) : new Date();

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const articles = await reader.getArticlesByDate(date);
    processArticles(articles);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles by date:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/feed/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= reader.feeds.length) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const feed = reader.feeds[index];
    const parsed = await reader.parseFeed(feed.url);

    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse feed' });
    }

    processArticles(parsed.items);
    res.json(parsed);
  } catch (error) {
    console.error('Error parsing feed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  reader.feeds = [];
  reader.cache.clear();
  await initFeeds();
  res.json({ message: 'Feeds refreshed', count: reader.feeds.length });
});

initFeeds().then(() => {
  app.listen(PORT, () => {
    console.log(`RSS Reader server running at http://localhost:${PORT}`);
  });
});

// Fetch article HTML and convert to Markdown, then persist as Markdown with YAML front matter.
app.post('/api/article/materialize', async (req, res) => {
  try {
    const { url, feedUrl, title, publishedAt } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const u = new URL(url);

    const htmlRes = await queuedFetch(u.toString(), {
      headers: { 'User-Agent': 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)' }
    });
    const html = await htmlRes.text();

    const mdBody = htmlToMarkdown(html, { baseUrl: u.toString() });

    ensureDir(ARTICLES_DIR);
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dir = path.join(ARTICLES_DIR, y, m);
    ensureDir(dir);

    const slug = safeFileName(title || u.hostname + '-' + u.pathname.split('/').filter(Boolean).pop());
    const filePath = path.join(dir, `${slug}.md`);

    const frontMatter = {
      title: title || null,
      url: u.toString(),
      feed_url: feedUrl || null,
      published_at: publishedAt || null,
      fetched_at: new Date().toISOString(),
      source: 'html'
    };

    const yaml = Object.entries(frontMatter)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');

    const md = `---\n${yaml}\n---\n\n${mdBody}\n`;
    fs.writeFileSync(filePath, md, 'utf-8');

    const articleFeedUrl = feedUrl || u.origin;

    // Ensure the feed exists in DB to satisfy foreign key (articles -> feeds)
    const stmtCheckFeed = featureDb.prepare('SELECT 1 FROM feeds WHERE url = ?');
    if (!stmtCheckFeed.get(articleFeedUrl)) {
      featureDb.prepare('INSERT OR IGNORE INTO feeds(url, name) VALUES (?, ?)').run(articleFeedUrl, u.hostname);
    }

    const articleId = stableId(articleFeedUrl, u.toString());
    stmtUpsertArticle.run({
      id: articleId,
      feed_url: articleFeedUrl,
      guid: null,
      link: u.toString(),
      title: title || null,
      author: null,
      published_at: publishedAt || null,
      content_html: null,
      content_snippet: null,
      markdown_path: filePath
    });

    // If this article is already favorited, trigger resource download
    const state = stmtGetState.get(articleId);
    if (state && state.is_favorite) {
      downloadResources(filePath, articleId).catch(err => {
        console.error(`[Server] Error downloading resources for favorited article ${articleId} during materialize:`, err);
      });
    }

    // Activity log
    stmtLogActivity.run(ACTIVITY_TYPES.MATERIALIZE, articleId, JSON.stringify({ url: u.toString(), markdownPath: filePath, title: title || null }));

    res.json({ ok: true, articleId, markdownPath: filePath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Update article state (favorite/read)
app.post('/api/article/state', (req, res) => {
  try {
    const { articleId, isRead, isFavorite } = req.body || {};
    if (!articleId) return res.status(400).json({ error: 'Missing articleId' });

    const existing = stmtGetState.get(articleId) || { is_read: 0, is_favorite: 0 };
    const nextRead = typeof isRead === 'boolean' ? (isRead ? 1 : 0) : existing.is_read;
    const nextFav = typeof isFavorite === 'boolean' ? (isFavorite ? 1 : 0) : existing.is_favorite;

    stmtSetState.run(articleId, nextRead, nextFav);

    // If favorited, try to download resources in the markdown file
    if (nextFav && !existing.is_favorite) {
      const article = stmtGetArticle.get(articleId);
      if (article && article.markdown_path) {
        downloadResources(article.markdown_path, articleId).catch(err => {
          console.error(`[Server] Error downloading resources for ${articleId}:`, err);
        });
      }
    }

    stmtLogActivity.run(
      ACTIVITY_TYPES.STATE,
      articleId,
      JSON.stringify({ isRead: !!nextRead, isFavorite: !!nextFav })
    );
    res.json({ ok: true, articleId, isRead: !!nextRead, isFavorite: !!nextFav });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create a Markdown note linked to an article
app.post('/api/article/note', (req, res) => {
  try {
    const { articleId, title, content } = req.body || {};
    if (!articleId) return res.status(400).json({ error: 'Missing articleId' });

    ensureDir(NOTES_DIR);
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dir = path.join(NOTES_DIR, y, m);
    ensureDir(dir);

    const slug = safeFileName(title || `note-${articleId.slice(0, 8)}`);
    const filePath = path.join(dir, `${slug}.md`);

    const yaml = [
      `article_id: ${JSON.stringify(articleId)}`,
      `title: ${JSON.stringify(title || '')}`,
      `created_at: ${JSON.stringify(now.toISOString())}`
    ].join('\n');

    const md = `---\n${yaml}\n---\n\n${content || ''}\n`;
    fs.writeFileSync(filePath, md, 'utf-8');

    stmtInsertNote.run(articleId, filePath);
    stmtLogActivity.run(
      ACTIVITY_TYPES.NOTE,
      articleId,
      JSON.stringify({ notePath: filePath, title: title || null })
    );

    res.json({ ok: true, articleId, notePath: filePath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List notes for an article
app.get('/api/article/notes', (req, res) => {
  try {
    const articleId = req.query.articleId;
    if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
    const notes = stmtListNotes.all(articleId);
    res.json({ articleId, notes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Notes Home: activity waterfall feed
app.get('/api/activity', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const rows = stmtGetActivity.all(limit, offset).map(r => ({
      id: r.id,
      type: r.type,
      articleId: r.article_id,
      createdAt: r.created_at,
      payload: (() => {
        try { return r.payload_json ? JSON.parse(r.payload_json) : {}; } catch { return {}; }
      })(),
      article: r.article_id ? {
        id: r.article_id,
        title: r.article_title,
        link: r.article_link,
        feedUrl: r.feed_url,
        markdownPath: r.article_markdown_path
      } : null
    }));
    res.json({ limit, offset, items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function mdEscape(text) {
  return String(text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// Export a period of activity as a single Markdown document
app.get('/api/export/markdown', (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 365);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const rows = featureDb.prepare(`
      SELECT a.id, a.type, a.article_id, a.payload_json, a.created_at,
             ar.title AS article_title, ar.link AS article_link, ar.feed_url AS feed_url
      FROM activity_log a
      LEFT JOIN articles ar ON ar.id = a.article_id
      WHERE a.created_at >= ?
      ORDER BY a.created_at DESC
      LIMIT 2000
    `).all(since.toISOString());

    const header = [
      '---',
      `title: ${JSON.stringify(`OpenBook Weekly Review (${days}d)`)}`,
      `generated_at: ${JSON.stringify(new Date().toISOString())}`,
      `days: ${days}`,
      '---',
      '',
      `# OpenBook Review (${days} days)`,
      '',
      `Generated at: ${new Date().toISOString()}`,
      ''
    ].join('\n');

    const lines = [header, '## Activity', ''];

    // Markdown table for quick copy to Notion
    lines.push('| Time | Type | Title | Link | Details |');
    lines.push('|---|---|---|---|---|');

    for (const r of rows) {
      let payload = {};
      try { payload = r.payload_json ? JSON.parse(r.payload_json) : {}; } catch { }

      const type = r.type;
      const title = r.article_title || payload.title || '';
      const link = r.article_link || payload.url || '';

      let details = '';
      if (type === ACTIVITY_TYPES.STATE) {
        details = `read=${payload.isRead ? 'yes' : 'no'}, fav=${payload.isFavorite ? 'yes' : 'no'}`;
      } else if (type === ACTIVITY_TYPES.NOTE) {
        details = `note=${payload.notePath || ''}`;
      } else if (type === ACTIVITY_TYPES.MATERIALIZE) {
        details = `md=${payload.markdownPath || ''}`;
      }

      lines.push(`| ${mdEscape(r.created_at)} | ${mdEscape(type)} | ${mdEscape(title)} | ${mdEscape(link)} | ${mdEscape(details)} |`);
    }

    const out = lines.join('\n') + '\n';
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="openbook-review-${days}d.md"`);
    res.send(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
