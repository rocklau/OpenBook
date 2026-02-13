const { toInt, clamp, internalError } = require('../lib/api');

function registerActivityRoutes(app, deps) {
  const { activityService, logger = console } = deps;

  app.get('/api/activity', (req, res) => {
    try {
      const limit = clamp(toInt(req.query.limit, 50), 1, 200);
      const offset = Math.max(toInt(req.query.offset, 0), 0);
      const result = activityService.listActivity({ limit, offset });
      logger.info('API/activity', 'activity.list', { requestId: req.requestId, traceId: req.traceId || null, actionId: req.actionId || null, limit, offset, count: (result.items || []).length });
      res.json(result);
    } catch (e) {
      internalError(res, e);
    }
  });

  app.get('/api/export/markdown', (req, res) => {
    try {
      const days = clamp(toInt(req.query.days, 7), 1, 365);
      const out = activityService.exportMarkdown(days);
      logger.info('API/activity', 'activity.export_markdown', { requestId: req.requestId, traceId: req.traceId || null, actionId: req.actionId || null, days, bytes: Buffer.byteLength(out, 'utf-8') });
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="openbook-review-${days}d.md"`);
      res.send(out);
    } catch (e) {
      internalError(res, e);
    }
  });
}

module.exports = { registerActivityRoutes };
