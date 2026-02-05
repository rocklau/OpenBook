const crypto = require('node:crypto');

function stableId(feedUrl, guidOrLink) {
  const input = `${feedUrl}::${guidOrLink || ''}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

function safeFileName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-._]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'untitled';
}

module.exports = {
  stableId,
  safeFileName
};
