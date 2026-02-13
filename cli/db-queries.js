function getNotes(db) {
  return db.prepare(`
    SELECT al.*, a.title as article_title, a.link as article_link
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    WHERE al.type = 'note'
    ORDER BY al.created_at DESC
    LIMIT 50
  `).all();
}

function getFavorites(db) {
  return db.prepare(`
    SELECT al.*, a.title as article_title, a.link as article_link
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    WHERE al.type = 'state' AND json_extract(al.payload_json, '$.isFavorite') = 1
    ORDER BY al.created_at DESC
    LIMIT 50
  `).all();
}

function getActivity(db, limit) {
  return db.prepare(`
    SELECT al.*, a.title as article_title
    FROM activity_log al
    LEFT JOIN articles a ON al.article_id = a.id
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(limit);
}

function getStats(db) {
  return {
    articles: db.prepare('SELECT COUNT(*) as count FROM articles').get().count,
    notes: db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE type = 'note'").get().count,
    favorites: db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE type = 'state' AND json_extract(payload_json, '$.isFavorite') = 1").get().count,
    highlights: db.prepare(`
      SELECT COUNT(*) as count FROM activity_log
      WHERE type = 'note' AND json_extract(payload_json, '$.title') = 'Highlight'
    `).get().count
  };
}

function getBookDbStats(db) {
  return {
    articles: db.prepare('SELECT COUNT(*) AS c FROM articles').get().c,
    notes: db.prepare("SELECT COUNT(*) AS c FROM activity_log WHERE type='note'").get().c,
    materialized: db.prepare('SELECT COUNT(*) AS c FROM articles WHERE markdown_path IS NOT NULL').get().c,
    favorites: db.prepare("SELECT COUNT(*) AS c FROM article_state WHERE is_favorite=1").get().c
  };
}

module.exports = { getNotes, getFavorites, getActivity, getStats, getBookDbStats };
