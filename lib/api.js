function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function internalError(res, error) {
  return res.status(500).json({ error: error?.message || String(error) });
}

module.exports = { toInt, clamp, badRequest, internalError };
