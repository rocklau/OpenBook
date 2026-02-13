const { toInt, badRequest, internalError } = require('../lib/api');

function registerArticleRoutes(app, deps) {
  const { articleService, logger = console } = deps;

  app.get('/api/feeds', (req, res) => {
    const feeds = articleService.listFeeds();
    logger.info('API/articles', 'feeds.list', { requestId: req.requestId, count: feeds.length });
    res.json(feeds);
  });

  app.get('/api/articles', async (req, res) => {
    try {
      const limit = toInt(req.query.limit, 50);
      const items = await articleService.listArticles(limit);
      logger.info('API/articles', 'articles.list', { requestId: req.requestId, limit, count: items.length });
      res.json(items);
    } catch (error) {
      console.error('Error fetching articles:', error);
      internalError(res, error);
    }
  });

  app.get('/api/articles/by-date', async (req, res) => {
    try {
      const dateParam = req.query.date;
      const date = dateParam ? new Date(dateParam) : new Date();
      if (isNaN(date.getTime())) return badRequest(res, 'Invalid date');

      const items = await articleService.listArticlesByDate(date);
      logger.info('API/articles', 'articles.by_date', { requestId: req.requestId, date: date.toISOString().split('T')[0], count: items.length });
      res.json(items);
    } catch (error) {
      console.error('Error fetching articles by date:', error);
      internalError(res, error);
    }
  });

  app.get('/api/feed/:index', async (req, res) => {
    try {
      const index = toInt(req.params.index, -1);
      const parsed = await articleService.getFeedByIndex(index);
      if (parsed === null) return res.status(404).json({ error: 'Feed not found' });
      if (parsed === undefined) return res.status(500).json({ error: 'Failed to parse feed' });
      logger.info('API/articles', 'feed.read', { requestId: req.requestId, index, count: (parsed.items || []).length, title: parsed.title || null });
      res.json(parsed);
    } catch (error) {
      console.error('Error parsing feed:', error);
      internalError(res, error);
    }
  });

  app.post('/api/refresh', async (req, res) => {
    res.json(await articleService.refreshFeeds());
  });

  app.get('/api/sync/status', (req, res) => {
    res.json(articleService.getSyncStatus());
  });

  app.post('/api/sync/warm', async (req, res) => {
    try {
      const limit = toInt(req.body?.limit, 50);
      const timeoutMs = toInt(req.body?.timeoutMs, 8000);
      const verbose = req.body?.verbose === true || String(req.body?.verbose).toLowerCase() === 'true';
      const result = await articleService.warmSync({ limit, timeoutMs, reason: 'manual', verbose });
      logger.info('API/articles', 'sync.warm', {
        requestId: req.requestId,
        limit,
        timeoutMs,
        verbose,
        ok: !!result?.ok,
        status: result?.status,
        count: result?.count || 0,
        summary: result?.summary || null,
        fetchStats: result?.fetchStats || null
      });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });

  app.post('/api/article/materialize', async (req, res) => {
    try {
      const { url, feedUrl, title, publishedAt } = req.body || {};
      if (!url) return badRequest(res, 'Missing url');
      const result = await articleService.materializeArticle({ url, feedUrl, title, publishedAt });
      logger.info('API/articles', 'article.materialize', {
        requestId: req.requestId,
        url,
        articleId: result?.articleId || null,
        skipped: !!result?.skipped,
        reason: result?.reason || null
      });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });

  app.post('/api/article/state', async (req, res) => {
    try {
      const { articleId, isRead, isFavorite } = req.body || {};
      if (!articleId) return badRequest(res, 'Missing articleId');
      const result = await articleService.updateArticleState({ articleId, isRead, isFavorite });
      logger.info('API/articles', 'article.state', {
        requestId: req.requestId,
        articleId,
        isRead,
        isFavorite,
        skipped: !!result?.skipped,
        reason: result?.reason || null
      });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });

  app.post('/api/article/note', (req, res) => {
    try {
      const { articleId, title, content } = req.body || {};
      if (!articleId) return badRequest(res, 'Missing articleId');
      const result = articleService.createNote({ articleId, title, content });
      logger.info('API/articles', 'article.note', {
        requestId: req.requestId,
        articleId,
        title: title || null,
        contentLength: (content || '').length,
        notePath: result?.notePath || null
      });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });

  app.get('/api/article/notes', (req, res) => {
    try {
      const articleId = req.query.articleId;
      if (!articleId) return badRequest(res, 'Missing articleId');
      const result = articleService.listNotes(articleId);
      logger.info('API/articles', 'article.notes.list', { requestId: req.requestId, articleId, count: (result.notes || []).length });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });
}

module.exports = { registerArticleRoutes };
