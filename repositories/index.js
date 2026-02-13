function createRepositories(featureDb) {
  const stmtUpsertArticle = featureDb.prepare(`
    INSERT INTO articles(id, feed_url, guid, link, title, author, published_at, content_html, content_snippet, markdown_path, updated_at)
    VALUES (@id, @feed_url, @guid, @link, @title, @author, @published_at, @content_html, @content_snippet, @markdown_path, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      author=excluded.author,
      published_at=excluded.published_at,
      content_html=excluded.content_html,
      content_snippet=excluded.content_snippet,
      markdown_path=COALESCE(excluded.markdown_path, articles.markdown_path),
      updated_at=datetime('now')
  `);

  const stmtSetState = featureDb.prepare(`
    INSERT INTO article_state(article_id, is_read, is_favorite, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(article_id) DO UPDATE SET
      is_read=excluded.is_read,
      is_favorite=excluded.is_favorite,
      updated_at=datetime('now')
  `);

  const stmtGetState = featureDb.prepare('SELECT is_read, is_favorite, updated_at FROM article_state WHERE article_id=?');
  const stmtGetArticle = featureDb.prepare('SELECT * FROM articles WHERE id=?');
  const stmtGetArticleByLink = featureDb.prepare(`
    SELECT * FROM articles
    WHERE link=?
    ORDER BY (markdown_path IS NOT NULL) DESC, updated_at DESC
    LIMIT 1
  `);
  const stmtInsertNote = featureDb.prepare('INSERT INTO article_notes(article_id, note_path) VALUES (?, ?)');
  const stmtListNotes = featureDb.prepare('SELECT id, note_path, created_at FROM article_notes WHERE article_id=? ORDER BY id DESC');

  const stmtLogActivity = featureDb.prepare('INSERT INTO activity_log(type, article_id, payload_json) VALUES (?, ?, ?)');
  const stmtGetActivity = featureDb.prepare(`
    SELECT a.id, a.type, a.article_id, a.payload_json, a.created_at,
           ar.title AS article_title, ar.link AS article_link, ar.feed_url AS feed_url,
           ar.markdown_path AS article_markdown_path
    FROM activity_log a
    LEFT JOIN articles ar ON ar.id = a.article_id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const stmtCheckFeed = featureDb.prepare('SELECT 1 FROM feeds WHERE url = ?');
  const stmtInsertFeed = featureDb.prepare('INSERT OR IGNORE INTO feeds(url, name) VALUES (?, ?)');

  const stmtActivitySince = featureDb.prepare(`
    SELECT a.id, a.type, a.article_id, a.payload_json, a.created_at,
           ar.title AS article_title, ar.link AS article_link, ar.feed_url AS feed_url
    FROM activity_log a
    LEFT JOIN articles ar ON ar.id = a.article_id
    WHERE a.created_at >= ?
    ORDER BY a.created_at DESC
    LIMIT 2000
  `);

  return {
    upsertArticle: (payload) => stmtUpsertArticle.run(payload),
    setArticleState: (articleId, isRead, isFavorite) => stmtSetState.run(articleId, isRead, isFavorite),
    getArticleState: (articleId) => stmtGetState.get(articleId),
    getArticleById: (articleId) => stmtGetArticle.get(articleId),
    getArticleByLink: (link) => stmtGetArticleByLink.get(link),
    insertNote: (articleId, notePath) => stmtInsertNote.run(articleId, notePath),
    listNotesByArticle: (articleId) => stmtListNotes.all(articleId),
    logActivity: (type, articleId, payloadJson) => stmtLogActivity.run(type, articleId, payloadJson),
    listActivity: (limit, offset) => stmtGetActivity.all(limit, offset),
    listActivitySince: (isoDate) => stmtActivitySince.all(isoDate),
    ensureFeedExists: (url, name) => {
      if (!stmtCheckFeed.get(url)) stmtInsertFeed.run(url, name);
    }
  };
}

module.exports = { createRepositories };
