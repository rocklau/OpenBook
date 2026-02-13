const test = require('node:test');
const assert = require('node:assert');

const {
  runSearchArticles,
  runShowRecent
} = require('../cli/commands-core');

function withCapturedLogs(fn) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = original;
    })
    .then(() => logs.join('\n'));
}

test('runSearchArticles should print usage when query missing', async () => {
  const reader = { getAllArticles: async () => [] };
  const out = await withCapturedLogs(() => runSearchArticles(reader, '', () => {}));
  assert.match(out, /Please provide a search query/);
  assert.match(out, /Usage: node cli\.js search <keyword>/);
});

test('runSearchArticles should pass matched results to display function', async () => {
  const reader = {
    getAllArticles: async () => ([
      { title: 'AI News', contentSnippet: 'latest model updates' },
      { title: 'Gardening', contentSnippet: 'plants' }
    ])
  };

  let received = null;
  const out = await withCapturedLogs(() => runSearchArticles(reader, 'ai', (items) => {
    received = items;
  }));

  assert.match(out, /Found 1 articles/);
  assert.ok(received);
  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].title, 'AI News');
});

test('runShowRecent should display requested number of articles', async () => {
  const reader = {
    getAllArticles: async () => ([
      { title: 'A' },
      { title: 'B' },
      { title: 'C' }
    ])
  };

  let received = null;
  const out = await withCapturedLogs(() => runShowRecent(reader, 2, (items) => {
    received = items;
  }));

  assert.match(out, /Last 2 Articles/);
  assert.ok(received);
  assert.strictEqual(received.length, 2);
  assert.strictEqual(received[0].title, 'A');
  assert.strictEqual(received[1].title, 'B');
});
