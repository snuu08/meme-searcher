const store = new Map();

function cacheMinutes() {
  var raw = process.env.CACHE_MINUTES;
  if (raw === undefined || raw === "") return 1440;
  var n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 1440;
}

function cacheKey(period) {
  return "trends:" + (period || "24h");
}

function get(period) {
  var entry = store.get(cacheKey(period));
  if (!entry) return null;
  var ttl = cacheMinutes() * 60 * 1000;
  if (ttl === 0) return null;
  if (Date.now() - entry.storedAt > ttl) {
    store.delete(cacheKey(period));
    return null;
  }
  return entry.value;
}

function set(period, value) {
  store.set(cacheKey(period), { value: value, storedAt: Date.now() });
  return value;
}

function clear() {
  store.clear();
}

module.exports = { get, set, clear, cacheMinutes, cacheKey };
