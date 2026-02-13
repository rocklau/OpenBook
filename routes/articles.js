const { toInt, badRequest, internalError } = require('../lib/api');

function registerArticleRoutes(app, deps) {
  const { articleService } = deps;

  app.get('/api/feeds', (req, res) => {
    res.json(articleService.listFeeds());
  });

  app.get('/api/articles', async (req, res) => {
    try {
      const limit = toInt(req.query.limit, 50);
      res.json(await articleService.listArticles(limit));
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

      res.json(await articleService.listArticlesByDate(date));
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
      res.json(parsed);
    } catch (error) {
      console.error('Error parsing feed:', error);
      internalError(res, error);
    }
  });

  app.post('/api/refresh', async (req, res) => {
    res.json(await articleService.refreshFeeds());
  });

  app.post('/api/article/materialize', async (req, res) => {
    try {
      const { url, feedUrl, title, publishedAt } = req.body || {};
      if (!url) return badRequest(res, 'Missing url');
      res.json(await articleService.materializeArticle({ url, feedUrl, title, publishedAt }));
    } catch (e) {
      internalError(res, e);
    }
  });

  app.post('/api/article/state', async (req, res) => {
    try {
      const { articleId, isRead, isFavorite } = req.body || {};
      if (!articleId) return badRequest(res, 'Missing articleId');
      res.json(await articleService.updateArticleState({ articleId, isRead, isFavorite }));
    } catch (e) {
      internalError(res, e);
    }
  });

  app.post('/api/article/note', (req, res) => {
    try {
      const { articleId, title, content } = req.body || {};
      if (!articleId) return badRequest(res, 'Missing articleId');
      res.json(articleService.createNote({ articleId, title, content }));
    } catch (e) {
      internalError(res, e);
    }
  });

  app.get('/api/article/notes', (req, res) => {
    try {
      const articleId = req.query.articleId;
      if (!articleId) return badRequest(res, 'Missing articleId');
      res.json(articleService.listNotes(articleId));
    } catch (e) {
      internalError(res, e);
    }
  });
}

module.exports = { registerArticleRoutes };
