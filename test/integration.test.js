const assert = require('node:assert');
const test = require('node:test');

const BASE_URL = 'http://localhost:3000';

test('Integration: Highlight and Save Note activity logging', async (t) => {
  // 1. Materialize an article first to get an ID
  const articleData = {
    url: `${BASE_URL}/index.html`,
    title: 'Integration Test Article',
    feedUrl: 'https://example.com/rss'
  };

  console.log('Step 1: Materializing article...');
  const matRes = await fetch(`${BASE_URL}/api/article/materialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(articleData)
  });
  const matJson = await matRes.json();
  if (matRes.status !== 200) {
    console.error('Materialize failed:', matJson);
  }
  assert.strictEqual(matRes.status, 200);
  const articleId = matJson.articleId;
  assert.ok(articleId, 'Article ID should be returned');

  // 2. Simulate a Highlight (which is just a note with a specific title/content)
  console.log('Step 2: Simulating Highlight...');
  const highlightText = 'This is a highlighted snippet from the test article.';
  const highRes = await fetch(`${BASE_URL}/api/article/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId,
      title: 'Highlight',
      content: '> ' + highlightText
    })
  });
  assert.strictEqual(highRes.status, 200);

  // 3. Simulate a Save Note
  console.log('Step 3: Simulating Save Note...');
  const noteText = 'This is a personal note about the article.';
  const noteRes = await fetch(`${BASE_URL}/api/article/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId,
      title: 'Note',
      content: noteText
    })
  });
  assert.strictEqual(noteRes.status, 200);

  // 4. Verify in Activity Log
  console.log('Step 4: Verifying Activity Log...');
  const actRes = await fetch(`${BASE_URL}/api/activity?limit=10`);
  const actJson = await actRes.json();
  assert.ok(actJson.items.length >= 2, 'Should have at least 2 activity items');

  const highlightLog = actJson.items.find(it => it.type === 'note' && it.payload.title === 'Highlight');
  const noteLog = actJson.items.find(it => it.type === 'note' && it.payload.title === 'Note');

  assert.ok(highlightLog, 'Highlight log should exist');
  assert.strictEqual(highlightLog.payload.content, '> ' + highlightText, 'Highlight content should match');

  assert.ok(noteLog, 'Note log should exist');
  assert.strictEqual(noteLog.payload.content, noteText, 'Note content should match');

  console.log('Integration test passed successfully!');
});
