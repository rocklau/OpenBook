const path = require('path');
const fs = require('fs');

function createArticleService(deps) {
  const {
    reader,
    stableId,
    safeFileName,
    ensureDir,
    ARTICLES_DIR,
    NOTES_DIR,
    queuedFetch,
    htmlToMarkdown,
    downloadResources,
    ACTIVITY_TYPES,
    readJsonIndex,
    writeJsonIndex,
    repositories,
    processArticles,
    initFeeds
  } = deps;

  const materializeInFlight = new Map();
  const stateUpdateInFlight = new Map();

  return {
    listFeeds() {
      return reader.feeds;
    },

    async listArticles(limit = 50) {
      const articles = await reader.getAllArticles(limit);

      const index = readJsonIndex();
      const feedSet = new Map(index.feeds.map(f => [f.url, f]));
      reader.feeds.forEach(f => {
        if (!feedSet.has(f.url)) feedSet.set(f.url, { url: f.url, name: f.name });
      });

      const compact = articles.map(a => ({
        id: stableId(a.feedName || a.feedTitle || '', a.guid || a.link || a.title),
        feed: a.feedName || a.feedTitle,
        title: a.title,
        link: a.link,
        pubDate: a.pubDate,
        author: a.author
      }));

      index.feeds = Array.from(feedSet.values());
      index.articles = compact;
      writeJsonIndex(index);

      processArticles(articles);
      return articles;
    },

    async listArticlesByDate(date) {
      const articles = await reader.getArticlesByDate(date);
      processArticles(articles);
      return articles;
    },

    async getFeedByIndex(index) {
      if (index < 0 || index >= reader.feeds.length) {
        return null;
      }

      const feed = reader.feeds[index];
      const parsed = await reader.parseFeed(feed.url);
      if (!parsed) return undefined;

      processArticles(parsed.items);
      return parsed;
    },

    async refreshFeeds() {
      reader.feeds = [];
      reader.cache.clear();
      await initFeeds();
      return { message: 'Feeds refreshed', count: reader.feeds.length };
    },

    async materializeArticle({ url, feedUrl, title, publishedAt }) {
      const normalizedUrl = new URL(url).toString();

      const inFlight = materializeInFlight.get(normalizedUrl);
      if (inFlight) {
        console.log(`[Materialize] Joined in-flight materialization: ${normalizedUrl}`);
        return inFlight;
      }

      const run = (async () => {
        const u = new URL(normalizedUrl);

        const existingByLink = repositories.getArticleByLink
          ? repositories.getArticleByLink(normalizedUrl)
          : null;
        if (existingByLink?.markdown_path && fs.existsSync(existingByLink.markdown_path)) {
          console.log(`[Materialize] Skipped already materialized article: ${existingByLink.id} (${normalizedUrl})`);
          return {
            ok: true,
            articleId: existingByLink.id,
            markdownPath: existingByLink.markdown_path,
            skipped: true,
            reason: 'already_materialized'
          };
        }

        const htmlRes = await queuedFetch(normalizedUrl, {
          headers: { 'User-Agent': 'OpenBook RSS Reader (+https://github.com/rocklau/OpenBook)' }
        });
        const html = await htmlRes.text();

        const mdBody = htmlToMarkdown(html, { baseUrl: normalizedUrl });

        ensureDir(ARTICLES_DIR);
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const dir = path.join(ARTICLES_DIR, y, m);
        ensureDir(dir);

        const slug = safeFileName(title || u.hostname + '-' + u.pathname.split('/').filter(Boolean).pop());
        const filePath = path.join(dir, `${slug}.md`);

        const frontMatter = {
          title: title || null,
          url: normalizedUrl,
          feed_url: feedUrl || null,
          published_at: publishedAt || null,
          fetched_at: new Date().toISOString(),
          source: 'html'
        };

        const yaml = Object.entries(frontMatter)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');

        const md = `---\n${yaml}\n---\n\n${mdBody}\n`;
        fs.writeFileSync(filePath, md, 'utf-8');

        const articleFeedUrl = feedUrl || u.origin;
        repositories.ensureFeedExists(articleFeedUrl, u.hostname);

        const articleId = stableId(articleFeedUrl, normalizedUrl);
        repositories.upsertArticle({
          id: articleId,
          feed_url: articleFeedUrl,
          guid: null,
          link: normalizedUrl,
          title: title || null,
          author: null,
          published_at: publishedAt || null,
          content_html: null,
          content_snippet: null,
          markdown_path: filePath
        });

        const state = repositories.getArticleState(articleId);
        if (state && state.is_favorite) {
          downloadResources(filePath, articleId).catch(err => {
            console.error(`[Server] Error downloading resources for favorited article ${articleId} during materialize:`, err);
          });
        }

        repositories.logActivity(ACTIVITY_TYPES.MATERIALIZE, articleId, JSON.stringify({
          url: normalizedUrl,
          markdownPath: filePath,
          title: title || null
        }));

        return { ok: true, articleId, markdownPath: filePath };
      })();

      materializeInFlight.set(normalizedUrl, run);
      try {
        return await run;
      } finally {
        materializeInFlight.delete(normalizedUrl);
      }
    },

    async updateArticleState({ articleId, isRead, isFavorite }) {
      const previous = stateUpdateInFlight.get(articleId) || Promise.resolve();

      const run = previous.then(async () => {
        const existing = repositories.getArticleState(articleId) || { is_read: 0, is_favorite: 0 };
        const nextRead = typeof isRead === 'boolean' ? (isRead ? 1 : 0) : existing.is_read;
        const nextFav = typeof isFavorite === 'boolean' ? (isFavorite ? 1 : 0) : existing.is_favorite;

        if (nextRead === existing.is_read && nextFav === existing.is_favorite) {
          return {
            ok: true,
            articleId,
            isRead: !!nextRead,
            isFavorite: !!nextFav,
            skipped: true,
            reason: 'state_unchanged'
          };
        }

        repositories.setArticleState(articleId, nextRead, nextFav);

        if (nextFav && !existing.is_favorite) {
          const article = repositories.getArticleById(articleId);
          if (article && article.markdown_path) {
            downloadResources(article.markdown_path, articleId).catch(err => {
              console.error(`[Server] Error downloading resources for ${articleId}:`, err);
            });
          }
        }

        repositories.logActivity(
          ACTIVITY_TYPES.STATE,
          articleId,
          JSON.stringify({ isRead: !!nextRead, isFavorite: !!nextFav })
        );

        return { ok: true, articleId, isRead: !!nextRead, isFavorite: !!nextFav };
      });

      const tail = run.catch(() => {});
      stateUpdateInFlight.set(articleId, tail);

      try {
        return await run;
      } finally {
        if (stateUpdateInFlight.get(articleId) === tail) {
          stateUpdateInFlight.delete(articleId);
        }
      }
    },

    createNote({ articleId, title, content }) {
      ensureDir(NOTES_DIR);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const dir = path.join(NOTES_DIR, y, m);
      ensureDir(dir);

      const slug = safeFileName(title || `note-${articleId.slice(0, 8)}`);
      const filePath = path.join(dir, `${slug}.md`);

      const yaml = [
        `article_id: ${JSON.stringify(articleId)}`,
        `title: ${JSON.stringify(title || '')}`,
        `created_at: ${JSON.stringify(now.toISOString())}`
      ].join('\n');

      const md = `---\n${yaml}\n---\n\n${content || ''}\n`;
      fs.writeFileSync(filePath, md, 'utf-8');

      repositories.insertNote(articleId, filePath);
      repositories.logActivity(
        ACTIVITY_TYPES.NOTE,
        articleId,
        JSON.stringify({
          notePath: filePath,
          title: title || null,
          content: content || null
        })
      );

      return { ok: true, articleId, notePath: filePath };
    },

    listNotes(articleId) {
      const notes = repositories.listNotesByArticle(articleId);
      return { articleId, notes };
    }
  };
}

module.exports = { createArticleService };
