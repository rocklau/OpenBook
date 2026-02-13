function divider() {
  return '─'.repeat(80);
}

function formatDate(value, mode = 'date') {
  const d = new Date(value);
  return mode === 'datetime' ? d.toLocaleString('en-US') : d.toLocaleDateString('en-US');
}

function truncateInline(text, max = 150) {
  const raw = String(text || '').replace(/\n/g, ' ');
  return raw.length > max ? `${raw.substring(0, max)}...` : raw;
}

module.exports = { divider, formatDate, truncateInline };
