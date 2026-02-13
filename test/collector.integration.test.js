const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const test = require('node:test');

const { downloadResources } = require('../collector');

function startAssetServer() {
  let imageHits = 0;

  const server = http.createServer((req, res) => {
    if (req.url === '/img/pic.png') {
      imageHits += 1;
      const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(pngHeader);
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        getImageHits: () => imageHits
      });
    });
    server.on('error', reject);
  });
}

test('Integration: collector should dedupe downloads and avoid recollect on rerun', async (t) => {
  const { server, baseUrl, getImageHits } = await startAssetServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-it-'));
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const markdownPath = path.join(tempDir, 'article.md');
  const markdown = [
    '---',
    `url: ${JSON.stringify(baseUrl + '/post/123')}`,
    '---',
    '',
    `![dup-relative](../img/pic.png)`,
    `![dup-absolute](${baseUrl}/img/pic.png)`,
    `![dup-absolute-2](${baseUrl}/img/pic.png)`
  ].join('\n');

  fs.writeFileSync(markdownPath, markdown, 'utf-8');

  await downloadResources(markdownPath, 'article-1');

  const assetsDir = path.join(tempDir, 'article-assets');
  const files = fs.readdirSync(assetsDir);
  assert.strictEqual(files.length, 1, 'should only create one asset file for duplicated resource');

  const updated = fs.readFileSync(markdownPath, 'utf-8');
  assert.match(updated, /\(article-assets\//, 'markdown should be rewritten to local asset path');
  assert.doesNotMatch(updated, /\(https?:\/\//, 'markdown should not keep remote urls');
  assert.strictEqual(getImageHits(), 1, 'should only fetch duplicated resource once in first run');

  await downloadResources(markdownPath, 'article-1');
  assert.strictEqual(getImageHits(), 1, 'should not fetch again after markdown already localized');
});
