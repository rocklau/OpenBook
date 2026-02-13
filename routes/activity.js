const { toInt, clamp, internalError } = require('../lib/api');

function registerActivityRoutes(app, deps) {
  const { activityService } = deps;

  app.get('/api/activity', (req, res) => {
    try {
      const limit = clamp(toInt(req.query.limit, 50), 1, 200);
      const offset = Math.max(toInt(req.query.offset, 0), 0);
      res.json(activityService.listActivity({ limit, offset }));
    } catch (e) {
      internalError(res, e);
    }
  });

  app.get('/api/export/markdown', (req, res) => {
    try {
      const days = clamp(toInt(req.query.days, 7), 1, 365);
      const out = activityService.exportMarkdown(days);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="openbook-review-${days}d.md"`);
      res.send(out);
    } catch (e) {
      internalError(res, e);
    }
  });
}

module.exports = { registerActivityRoutes };
