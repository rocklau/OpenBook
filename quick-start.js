const { createAppContext } = require('./app');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const context = createAppContext();
const { app, startWarmSync } = context;

async function quickStart(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, async () => {
      const actualPort = server.address()?.port;
      console.log(`RSS Reader server running at http://localhost:${actualPort}`);
      console.log('Feeds will sync in background...');

      setTimeout(() => {
        startWarmSync({ limit: 20, timeoutMs: 60000, reason: 'startup' })
          .then((result) => {
            console.log('[Startup] Initial sync completed:', result?.ok ? 'success' : 'issues');
          })
          .catch((error) => {
            console.error('[Startup] Initial sync failed:', error.message);
          });
      }, 1000);

      resolve({ server, port: actualPort });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  quickStart().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, quickStart };
