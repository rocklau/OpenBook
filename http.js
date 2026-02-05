const { fetchQueue, withRetry } = require('./queue');

async function queuedFetch(url, options = {}) {
  return fetchQueue.add(() => withRetry(async () => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.url = url;
      throw err;
    }
    return res;
  }));
}

module.exports = {
  queuedFetch
};
