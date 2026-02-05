const Parser = require('rss-parser');
const { parseStringPromise } = require('xml2js');
const dns = require('node:dns').promises;
const net = require('node:net');

const { queuedFetch } = require('./http');
const { openDb, migrate } = require('./storage');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)'
  }
});

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(n => parseInt(n, 10));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }

  if (net.isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1') return true;
    if (v.startsWith('fe80:')) return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true;
    return false;
  }

  return true;
}

async function validateHttpUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(u.protocol)) {
    return { ok: false, reason: 'Only http/https URLs are allowed' };
  }

  // Allow internal feeds when explicitly enabled
  const allowPrivate = String(process.env.OPENBOOK_ALLOW_PRIVATE_FEEDS || '').toLowerCase() === 'true';
  if (allowPrivate) return { ok: true, reason: '' };

  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    if (addrs.some(a => isPrivateIp(a.address))) {
      return { ok: false, reason: 'Blocked private network address (set OPENBOOK_ALLOW_PRIVATE_FEEDS=true to allow)' };
    }
  } catch {
    return { ok: false, reason: 'DNS lookup failed' };
  }

  return { ok: true, reason: '' };
}

class RSSReader {
  constructor() {
    this.feeds = [];
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;

    // Storage
    this.db = openDb();
    migrate(this.db);

    this.stmtGetCache = this.db.prepare('SELECT url, kind, status, content_type, etag, last_modified, fetched_at, body FROM fetch_cache WHERE url=?');
    this.stmtUpsertCache = this.db.prepare(`
      INSERT INTO fetch_cache(url, kind, status, content_type, etag, last_modified, fetched_at, body)
      VALUES (@url, @kind, @status, @content_type, @etag, @last_modified, datetime('now'), @body)
      ON CONFLICT(url) DO UPDATE SET
        kind=excluded.kind,
        status=excluded.status,
        content_type=excluded.content_type,
        etag=excluded.etag,
        last_modified=excluded.last_modified,
        fetched_at=datetime('now'),
        body=excluded.body
    `);

    this.stmtUpsertFeed = this.db.prepare(`
      INSERT INTO feeds(url, name)
      VALUES (?, ?)
      ON CONFLICT(url) DO UPDATE SET name=excluded.name
    `);
  }

  async addFeed(url, name) {
    const validated = await validateHttpUrl(url);
    if (!validated.ok) throw new Error(`Feed URL rejected: ${validated.reason}`);

    const normalizedUrl = new URL(url).toString();
    const exists = this.feeds.some(f => f.url === normalizedUrl);
    if (exists) return false;

    this.feeds.push({ url: normalizedUrl, name: (name || normalizedUrl).trim() });
    this.stmtUpsertFeed.run(normalizedUrl, (name || '').trim());
    return true;
  }

  async fetchWithCache(url, kind) {
    const normalizedUrl = new URL(url).toString();
    const cached = this.stmtGetCache.get(normalizedUrl);

    const headers = {
      'User-Agent': 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)'
    };
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    if (cached?.last_modified) headers['If-Modified-Since'] = cached.last_modified;

    try {
      const res = await queuedFetch(normalizedUrl, { headers });
      const buf = Buffer.from(await res.arrayBuffer());

      const row = {
        url: normalizedUrl,
        kind,
        status: res.status,
        content_type: res.headers.get('content-type') || null,
        etag: res.headers.get('etag') || null,
        last_modified: res.headers.get('last-modified') || null,
        body: buf
      };
      this.stmtUpsertCache.run(row);
      return { status: res.status, body: buf, fromCache: false };
    } catch (e) {
      // Handle 304 manually because queuedFetch throws on !ok.
      if (e.status === 304 && cached?.body) {
        return { status: 304, body: cached.body, fromCache: true };
      }

      // On failure, fall back to cache if present.
      if (cached?.body) {
        return { status: cached.status || 200, body: cached.body, fromCache: true, error: e.message };
      }
      throw e;
    }
  }

  async parseFeed(url) {
    try {
      // in-memory short cache for UI bursts
      const cachedMem = this.cache.get(url);
      if (cachedMem && Date.now() - cachedMem.timestamp < this.cacheExpiry) return cachedMem.data;

      const { body } = await this.fetchWithCache(url, 'rss');
      const xml = body.toString('utf-8');

      // rss-parser can parseString to avoid duplicate network fetch
      const feed = await parser.parseString(xml);

      const result = {
        title: feed.title || 'Untitled Feed',
        description: feed.description,
        link: feed.link,
        items: (feed.items || []).map(item => ({
          title: item.title || 'Untitled',
          link: item.link,
          guid: item.guid,
          pubDate: item.pubDate || item.isoDate,
          content: item['content:encoded'] || item.content,
          contentSnippet: item.contentSnippet,
          author: item.author || item.creator
        }))
      };

      this.cache.set(url, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error(`Error parsing ${url}:`, error.message);
      return null;
    }
  }

  async getAllArticles(limit = 50) {
    const allArticles = [];
    const batchSize = 10;

    for (let i = 0; i < this.feeds.length; i += batchSize) {
      const batch = this.feeds.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(feed => this.parseFeed(feed.url)));

      results.forEach((parsed, idx) => {
        if (!parsed) return;
        const feed = batch[idx];
        parsed.items.forEach(item => {
          allArticles.push({
            ...item,
            feedTitle: parsed.title,
            feedName: feed.name
          });
        });
      });

      if (allArticles.length >= limit * 3) break;
    }

    return allArticles
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, limit * 2);
  }

  async getArticlesByDate(date, daysWindow = 1) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + daysWindow);
    endDate.setHours(23, 59, 59, 999);

    const allArticles = await this.getAllArticles(100);

    return allArticles.filter(article => {
      if (!article.pubDate) return false;
      const articleDate = new Date(article.pubDate);
      return articleDate >= targetDate && articleDate <= endDate;
    });
  }

  async loadFromOPML(opmlContent) {
    const xml = await parseStringPromise(opmlContent, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });

    const outlinesRoot = xml?.opml?.body?.outline;
    if (!outlinesRoot) return;

    const outlines = Array.isArray(outlinesRoot) ? outlinesRoot : [outlinesRoot];

    const flat = [];
    const walk = node => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(walk);

      const xmlUrl = node.xmlUrl;
      const name = node.title || node.text || (xmlUrl ? new URL(xmlUrl).hostname : 'Unnamed Feed');
      if (xmlUrl) flat.push({ xmlUrl, name });
      if (node.outline) walk(node.outline);
    };

    walk(outlines);

    for (const o of flat) {
      try {
        await this.addFeed(o.xmlUrl, o.name);
      } catch {
        // ignore
      }
    }
  }
}

module.exports = {
  RSSReader,
  validateHttpUrl
};
