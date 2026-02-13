const EVENT_BUFFER_MAX = Number(process.env.OPENBOOK_EVENT_BUFFER_MAX || 1000);
const eventBuffer = [];

function isVerboseEnabled() {
  const v = String(process.env.OPENBOOK_WEB_VERBOSE || process.env.OPENBOOK_SYNC_VERBOSE || 'false').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function safeJson(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return '"<unserializable>"';
  }
}

function pushEvent(level, scope, message, meta = null) {
  eventBuffer.push({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    meta: meta || null
  });
  if (eventBuffer.length > EVENT_BUFFER_MAX) {
    eventBuffer.splice(0, eventBuffer.length - EVENT_BUFFER_MAX);
  }
}

function getRecentEvents(limit = 100) {
  const n = Math.max(1, Math.min(Number(limit) || 100, EVENT_BUFFER_MAX));
  return eventBuffer.slice(-n);
}

function createLogger({ verbose = false } = {}) {
  function log(level, scope, message, meta = null) {
    const base = `[${scope}] ${message}`;
    pushEvent(level, scope, message, meta);
    if (meta == null) return console.log(base);
    console.log(`${base} ${safeJson(meta)}`);
  }

  return {
    verbose,
    info(scope, message, meta) {
      log('info', scope, message, meta);
    },
    debug(scope, message, meta) {
      pushEvent('debug', scope, message, meta || null);
      if (!verbose) return;
      const base = `[${scope}] ${message}`;
      if (meta == null) return console.log(base);
      console.log(`${base} ${safeJson(meta)}`);
    },
    error(scope, message, meta) {
      const base = `[${scope}] ${message}`;
      pushEvent('error', scope, message, meta || null);
      if (meta == null) return console.error(base);
      console.error(`${base} ${safeJson(meta)}`);
    }
  };
}

function createApiRequestLogger({ logger }) {
  let seq = 0;

  return function apiRequestLogger(req, res, next) {
    if (!req.path.startsWith('/api/')) return next();

    const requestId = ++seq;
    const startedAt = Date.now();
    const traceId = req.headers['x-openbook-trace-id'] || req.headers['x-trace-id'] || null;
    const actionId = req.headers['x-openbook-action-id'] || null;
    req.requestId = requestId;
    req.traceId = traceId;
    req.actionId = actionId;

    res.setHeader('x-openbook-request-id', String(requestId));
    if (traceId) res.setHeader('x-openbook-trace-id', String(traceId));
    if (actionId) res.setHeader('x-openbook-action-id', String(actionId));

    const query = Object.keys(req.query || {}).length ? req.query : undefined;
    const body = logger.verbose && req.body && Object.keys(req.body).length ? req.body : undefined;

    logger.info('API', 'request.start', {
      requestId,
      traceId,
      actionId,
      method: req.method,
      path: req.path,
      query,
      body
    });

    res.on('finish', () => {
      logger.info('API', 'request.end', {
        requestId,
        traceId,
        actionId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - startedAt
      });
    });

    next();
  };
}

module.exports = {
  isVerboseEnabled,
  createLogger,
  createApiRequestLogger,
  getRecentEvents
};