const { createAppContext } = require('./app');

const PORT = process.env.PORT || 3000;

const context = createAppContext();
const { app, initFeeds, processArticles, startWarmSync, getSyncStatus } = context;

async function startServer(port = PORT) {
  await initFeeds();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const actualPort = server.address()?.port;
      console.log(`RSS Reader server running at http://localhost:${actualPort}`);

      const shouldWarmSync = String(process.env.OPENBOOK_STARTUP_SYNC || 'true').toLowerCase() !== 'false';
      if (shouldWarmSync) {
        const warmLimit = Number(process.env.OPENBOOK_STARTUP_SYNC_LIMIT || 50);
        const warmTimeoutMs = Number(process.env.OPENBOOK_STARTUP_SYNC_TIMEOUT_MS || 8000);
        const warmVerbose = String(process.env.OPENBOOK_SYNC_VERBOSE || 'false').toLowerCase() === 'true';

        startWarmSync({ limit: warmLimit, timeoutMs: warmTimeoutMs, reason: 'startup', verbose: warmVerbose })
          .then((result) => {
            const tag = result?.ok ? 'completed' : 'finished-with-issues';
            console.log(`[StartupSync] ${tag}:`, result);
          })
          .catch((error) => {
            console.error('[StartupSync] failed:', error.message);
          });
      }

      resolve({ server, port: actualPort });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  initFeeds,
  processArticles,
  getSyncStatus,
  startWarmSync
};
