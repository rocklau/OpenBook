const fs = require('node:fs');
const path = require('node:path');
const { queuedFetch } = require('./http');
const { safeFileName } = require('./utils');
const crypto = require('node:crypto');

async function downloadResources(markdownPath, articleId) {
    if (!markdownPath || !fs.existsSync(markdownPath)) {
        console.log(`[Collector] Markdown file not found: ${markdownPath}`);
        return;
    }

    let content = fs.readFileSync(markdownPath, 'utf-8');

    // Extract source URL from frontmatter
    let sourceUrl = null;
    const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        const urlLine = fm.split('\n').find(l => l.startsWith('url: '));
        if (urlLine) {
            try {
                sourceUrl = JSON.parse(urlLine.substring(5).trim());
            } catch (e) {
                // handle non-json quoted string if necessary, but server.js uses JSON.stringify
            }
        }
    }

    const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    const matches = [...content.matchAll(imgRegex)];

    if (matches.length === 0) {
        return;
    }

    const articleDir = path.dirname(markdownPath);
    const assetsDirName = path.basename(markdownPath, '.md') + '-assets';
    const assetsDir = path.join(articleDir, assetsDirName);

    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    console.log(`[Collector] Downloading ${matches.length} resources for ${articleId}`);

    let updatedContent = content;
    const downloadedUrls = new Set();

    for (const match of matches) {
        const fullMatch = match[0];
        const altText = match[1];
        let url = match[2];

        if (downloadedUrls.has(url)) continue;

        // Resolve relative URL
        let downloadUrl = url;
        if (!url.startsWith('http')) {
            if (!sourceUrl) {
                console.log(`[Collector] Skipping relative URL ${url} because sourceUrl is unknown`);
                continue;
            }
            try {
                downloadUrl = new URL(url, sourceUrl).toString();
            } catch (e) {
                console.error(`[Collector] Failed to resolve URL ${url} against ${sourceUrl}:`, e.message);
                continue;
            }
        }

        try {
            const res = await queuedFetch(downloadUrl, {
                headers: { 'User-Agent': 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)' }
            });

            const contentType = res.headers.get('content-type') || '';
            let extension = '';
            if (contentType.includes('image/jpeg')) extension = '.jpg';
            else if (contentType.includes('image/png')) extension = '.png';
            else if (contentType.includes('image/gif')) extension = '.gif';
            else if (contentType.includes('image/webp')) extension = '.webp';
            else if (contentType.includes('image/svg+xml')) extension = '.svg';
            else {
                // Try to get extension from URL
                const urlPath = new URL(url).pathname;
                const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
                if (extMatch) extension = '.' + extMatch[1];
            }

            const urlHash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
            const filename = `${safeFileName(altText || 'image')}-${urlHash}${extension}`;
            const localPath = path.join(assetsDir, filename);

            const buffer = await res.arrayBuffer();
            fs.writeFileSync(localPath, Buffer.from(buffer));

            const relativePath = path.join(assetsDirName, filename);
            // Replace all occurrences of this URL in markdown link context (url)
            updatedContent = updatedContent.split(`(${url})`).join(`(${relativePath})`);

            downloadedUrls.add(url);
            console.log(`[Collector] Downloaded ${url} to ${relativePath}`);
        } catch (err) {
            console.error(`[Collector] Failed to download ${url}:`, err.message);
        }
    }

    if (updatedContent !== content) {
        fs.writeFileSync(markdownPath, updatedContent, 'utf-8');
        console.log(`[Collector] Updated markdown: ${markdownPath}`);
    }
}

module.exports = {
    downloadResources
};
