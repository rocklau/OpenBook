const PQueue = require('p-queue').default;

// A single shared queue to avoid 429 and smooth bursts.
// Defaults: 4 concurrent, at most 10 requests per second.
const concurrency = parseInt(process.env.OPENBOOK_FETCH_CONCURRENCY || '4', 10);
const intervalCap = parseInt(process.env.OPENBOOK_FETCH_INTERVAL_CAP || '10', 10);
const interval = parseInt(process.env.OPENBOOK_FETCH_INTERVAL_MS || '1000', 10);

const fetchQueue = new PQueue({
  concurrency,
  intervalCap,
  interval
});

async function sleep(ms) {
  await new Promise(r => setTimeout(r, ms));
}

async function withRetry(taskFn, { retries = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await taskFn();
    } catch (e) {
      lastErr = e;
      const status = e?.status;
      // Retry on 429/5xx/network errors
      const shouldRetry = status === 429 || (status >= 500 && status <= 599) || status == null;
      if (!shouldRetry || i === retries) break;
      const delay = baseDelayMs * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw lastErr;
}

module.exports = {
  fetchQueue,
  withRetry
};
