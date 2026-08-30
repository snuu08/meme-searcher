const store = new Map();

function cacheMinutes() {
  var raw = process.env.CACHE_MINUTES;
  if (raw === undefined || raw === "") return 1440;
  var n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 1440;
}

function cacheKey(period, scope) {
  return "trends:" + (period || "24h") + ":" + (scope || "global");
}

function get(period, scope) {
  var key = cacheKey(period, scope);
  var entry = store.get(key);
  if (!entry) return null;
  var ttl = cacheMinutes() * 60 * 1000;
  if (ttl === 0) return null;
  if (Date.now() - entry.storedAt > ttl) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(period, scope, value) {
  store.set(cacheKey(period, scope), { value: value, storedAt: Date.now() });
  return value;
}

function clear() {
  store.clear();
}

module.exports = { get, set, clear, cacheMinutes, cacheKey };
