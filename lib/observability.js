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

function createLogger({ verbose = false } = {}) {
  function log(scope, message, meta = null) {
    const base = `[${scope}] ${message}`;
    if (meta == null) return console.log(base);
    console.log(`${base} ${safeJson(meta)}`);
  }

  return {
    verbose,
    info(scope, message, meta) {
      log(scope, message, meta);
    },
    debug(scope, message, meta) {
      if (!verbose) return;
      log(scope, message, meta);
    },
    error(scope, message, meta) {
      const base = `[${scope}] ${message}`;
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
    req.requestId = requestId;

    const query = Object.keys(req.query || {}).length ? req.query : undefined;
    const body = logger.verbose && req.body && Object.keys(req.body).length ? req.body : undefined;

    logger.info('API', 'request.start', {
      requestId,
      method: req.method,
      path: req.path,
      query,
      body
    });

    res.on('finish', () => {
      logger.info('API', 'request.end', {
        requestId,
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
  createApiRequestLogger
};