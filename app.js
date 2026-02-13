const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { RSSReader } = require('./rss');
const { readJsonIndex, writeJsonIndex } = require('./storage');
const { stableId, safeFileName } = require('./utils');
const { ensureDir, ARTICLES_DIR, NOTES_DIR, openDb, migrate, DATA_DIR } = require('./storage');
const { queuedFetch } = require('./http');
const { htmlToMarkdown } = require('./html_to_md');
const { ACTIVITY_TYPES } = require('./activity');
const { downloadResources } = require('./collector');
const { registerArticleRoutes } = require('./routes/articles');
const { registerActivityRoutes } = require('./routes/activity');
const { createArticleService } = require('./services/articleService');
const { createActivityService } = require('./services/activityService');
const { createRepositories } = require('./repositories');
const { isVerboseEnabled, createLogger, createApiRequestLogger } = require('./lib/observability');

function createAppContext() {
  const app = express();
  const reader = new RSSReader();
  const featureDb = openDb();
  migrate(featureDb);

  const logger = createLogger({ verbose: isVerboseEnabled() });

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(createApiRequestLogger({ logger }));
  app.use(express.static('public'));
  app.use('/data', express.static(DATA_DIR));

  const repositories = createRepositories(featureDb);

  function processArticles(articles) {
    for (const a of articles) {
      const feedUrl = a.feedUrl || (reader.feeds.find(f => f.name === (a.feedName || a.feedTitle)) || {}).url;

      if (!feedUrl) {
        console.error(`[Server] Skipping article because feed URL could not be determined: ${a.title}`);
        continue;
      }

      const id = stableId(feedUrl, a.guid || a.link || a.title);
      a.id = id;

      repositories.upsertArticle({
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

      const state = repositories.getArticleState(id);
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

  const baseDeps = {
    app,
    reader,
    featureDb,
    logger,
    stableId,
    safeFileName,
    ensureDir,
    ARTICLES_DIR,
    NOTES_DIR,
    queuedFetch,
    htmlToMarkdown,
    ACTIVITY_TYPES,
    downloadResources,
    readJsonIndex,
    writeJsonIndex,
    repositories,
    processArticles,
    initFeeds
  };

  const articleService = createArticleService(baseDeps);
  const activityService = createActivityService(baseDeps);
  const routeDeps = { articleService, activityService, logger };

  registerArticleRoutes(app, routeDeps);
  registerActivityRoutes(app, routeDeps);

  return {
    app,
    initFeeds,
    processArticles,
    startWarmSync: (opts = {}) => articleService.warmSync({ ...opts, reason: opts.reason || 'startup' }),
    getSyncStatus: () => articleService.getSyncStatus()
  };
}

module.exports = { createAppContext };
