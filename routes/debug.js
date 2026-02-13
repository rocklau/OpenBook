const { toInt, clamp, internalError } = require('../lib/api');
const { getRecentEvents } = require('../lib/observability');

function registerDebugRoutes(app, deps) {
  const { logger = console } = deps;

  app.get('/api/debug/recent-events', (req, res) => {
    try {
      const limit = clamp(toInt(req.query.limit, 100), 1, 1000);
      const events = getRecentEvents(limit);
      logger.info('API/debug', 'recent_events.list', {
        requestId: req.requestId,
        traceId: req.traceId || null,
        actionId: req.actionId || null,
        limit,
        count: events.length
      });
      res.json({ limit, count: events.length, items: events });
    } catch (e) {
      internalError(res, e);
    }
  });
}

module.exports = { registerDebugRoutes };
