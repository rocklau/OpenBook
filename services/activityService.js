function mdEscape(text) {
  return String(text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function createActivityService(deps) {
  const { repositories, ACTIVITY_TYPES, logger = console } = deps;

  return {
    listActivity({ limit, offset }) {
      const rows = repositories.listActivity(limit, offset).map(r => ({
        id: r.id,
        type: r.type,
        articleId: r.article_id,
        createdAt: r.created_at,
        payload: (() => {
          try { return r.payload_json ? JSON.parse(r.payload_json) : {}; } catch { return {}; }
        })(),
        article: r.article_id ? {
          id: r.article_id,
          title: r.article_title,
          link: r.article_link,
          feedUrl: r.feed_url,
          markdownPath: r.article_markdown_path
        } : null
      }));

      logger.debug('ActivityService', 'listActivity.result', { limit, offset, count: rows.length });
      return { limit, offset, items: rows };
    },

    exportMarkdown(days) {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      const rows = repositories.listActivitySince(since.toISOString());

      const header = [
        '---',
        `title: ${JSON.stringify(`OpenBook Weekly Review (${days}d)`)}`,
        `generated_at: ${JSON.stringify(new Date().toISOString())}`,
        `days: ${days}`,
        '---',
        '',
        `# OpenBook Review (${days} days)`,
        '',
        `Generated at: ${new Date().toISOString()}`,
        ''
      ].join('\n');

      const lines = [header, '## Activity', ''];
      lines.push('| Time | Type | Title | Link | Details |');
      lines.push('|---|---|---|---|---|');

      for (const r of rows) {
        let payload = {};
        try { payload = r.payload_json ? JSON.parse(r.payload_json) : {}; } catch {}

        const type = r.type;
        const title = r.article_title || payload.title || '';
        const link = r.article_link || payload.url || '';

        let details = '';
        if (type === ACTIVITY_TYPES.STATE) {
          details = `read=${payload.isRead ? 'yes' : 'no'}, fav=${payload.isFavorite ? 'yes' : 'no'}`;
        } else if (type === ACTIVITY_TYPES.NOTE) {
          details = `note=${payload.notePath || ''}`;
        } else if (type === ACTIVITY_TYPES.MATERIALIZE) {
          details = `md=${payload.markdownPath || ''}`;
        }

        lines.push(`| ${mdEscape(r.created_at)} | ${mdEscape(type)} | ${mdEscape(title)} | ${mdEscape(link)} | ${mdEscape(details)} |`);
      }

      const output = lines.join('\n') + '\n';
      logger.debug('ActivityService', 'exportMarkdown.result', { days, rows: rows.length, bytes: Buffer.byteLength(output, 'utf-8') });
      return output;
    }
  };
}

module.exports = { createActivityService };
