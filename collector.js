const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { queuedFetch } = require('./http');
const { safeFileName } = require('./utils');

const USER_AGENT = 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)';
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

function parseSourceUrlFromFrontmatter(markdown) {
  const fmMatch = markdown.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return null;

  const urlLine = fmMatch[1]
    .split('\n')
    .find(line => line.startsWith('url: '));

  if (!urlLine) return null;

  try {
    return JSON.parse(urlLine.slice(5).trim());
  } catch {
    return null;
  }
}

function isAlreadyCollected(url, assetsDirName) {
  const normalized = String(url || '').replace(/\\/g, '/');
  return (
    normalized.startsWith(`${assetsDirName}/`) ||
    normalized.startsWith(`./${assetsDirName}/`)
  );
}

function resolveResourceUrl(rawUrl, sourceUrl) {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (!sourceUrl) return null;

  try {
    return new URL(rawUrl, sourceUrl).toString();
  } catch {
    return null;
  }
}

function pickExtension(contentType, resourceUrl) {
  const type = (contentType || '').toLowerCase();
  if (type.includes('image/jpeg')) return '.jpg';
  if (type.includes('image/png')) return '.png';
  if (type.includes('image/gif')) return '.gif';
  if (type.includes('image/webp')) return '.webp';
  if (type.includes('image/svg+xml')) return '.svg';
  if (type.includes('image/avif')) return '.avif';

  try {
    const pathname = new URL(resourceUrl).pathname;
    const ext = path.extname(pathname || '').toLowerCase();
    return ext || '';
  } catch {
    return '';
  }
}

async function ensureLocalAsset({ resolvedUrl, altText, assetsDir, assetsDirName }) {
  const urlHash = crypto.createHash('md5').update(resolvedUrl).digest('hex').slice(0, 12);

  const existing = fs.readdirSync(assetsDir).find(file => file.includes(`-${urlHash}`));
  if (existing) {
    const relativePath = path.posix.join(assetsDirName, existing);
    console.log(`[Collector] Reusing existing asset for ${resolvedUrl} -> ${relativePath}`);
    return relativePath;
  }

  const res = await queuedFetch(resolvedUrl, {
    headers: { 'User-Agent': USER_AGENT }
  });

  const extension = pickExtension(res.headers.get('content-type'), resolvedUrl);
  const baseName = safeFileName(altText || 'image') || 'image';
  const filename = `${baseName}-${urlHash}${extension}`;
  const localPath = path.join(assetsDir, filename);
  const relativePath = path.posix.join(assetsDirName, filename);

  const buffer = await res.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));
  console.log(`[Collector] Downloaded ${resolvedUrl} -> ${relativePath}`);

  return relativePath;
}

function collectImageMatches(markdown, assetsDirName, sourceUrl) {
  const matches = [];
  const stats = {
    totalImageLinks: 0,
    alreadyCollected: 0,
    unresolvedRelative: 0
  };

  for (const match of markdown.matchAll(IMAGE_REGEX)) {
    const [fullMatch, altText, rawUrl, title] = match;
    stats.totalImageLinks += 1;

    if (isAlreadyCollected(rawUrl, assetsDirName)) {
      stats.alreadyCollected += 1;
      continue;
    }

    const resolvedUrl = resolveResourceUrl(rawUrl, sourceUrl);
    if (!resolvedUrl) {
      stats.unresolvedRelative += 1;
      continue;
    }

    matches.push({
      fullMatch,
      altText,
      rawUrl,
      title,
      resolvedUrl
    });
  }

  return { matches, stats };
}

async function downloadResources(markdownPath, articleId) {
  if (!markdownPath || !fs.existsSync(markdownPath)) {
    console.log(`[Collector] Markdown file not found: ${markdownPath}`);
    return;
  }

  const content = fs.readFileSync(markdownPath, 'utf-8');
  const sourceUrl = parseSourceUrlFromFrontmatter(content);

  const articleDir = path.dirname(markdownPath);
  const assetsDirName = `${path.basename(markdownPath, '.md')}-assets`;
  const assetsDir = path.join(articleDir, assetsDirName);

  const { matches: imageMatches, stats } = collectImageMatches(content, assetsDirName, sourceUrl);
  if (imageMatches.length === 0) {
    console.log(
      `[Collector] Skipped article ${articleId}: no collectable images (total=${stats.totalImageLinks}, localized=${stats.alreadyCollected}, unresolved=${stats.unresolvedRelative})`
    );
    return;
  }

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log(`[Collector] Collecting ${imageMatches.length} resources for ${articleId}`);

  const resolvedToLocal = new Map();
  for (const item of imageMatches) {
    if (resolvedToLocal.has(item.resolvedUrl)) continue;

    try {
      const localPath = await ensureLocalAsset({
        resolvedUrl: item.resolvedUrl,
        altText: item.altText,
        assetsDir,
        assetsDirName
      });
      resolvedToLocal.set(item.resolvedUrl, localPath);
    } catch (err) {
      console.error(`[Collector] Failed to download ${item.resolvedUrl}:`, err.message);
    }
  }

  let updatedContent = content;
  for (const item of imageMatches) {
    const localPath = resolvedToLocal.get(item.resolvedUrl);
    if (!localPath) continue;

    const titlePart = item.title ? ` "${item.title}"` : '';
    const replacement = `![${item.altText}](${localPath}${titlePart})`;
    updatedContent = updatedContent.replace(item.fullMatch, replacement);
  }

  if (updatedContent !== content) {
    fs.writeFileSync(markdownPath, updatedContent, 'utf-8');
    console.log(`[Collector] Updated markdown: ${markdownPath}`);
  } else {
    console.log(`[Collector] Skipped markdown rewrite for ${articleId}: no content changes`);
  }
}

module.exports = {
  downloadResources
};
