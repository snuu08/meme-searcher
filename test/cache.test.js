const test = require("node:test");
const assert = require("node:assert/strict");
const cache = require("../server/services/cache");

test("검색어와 국가가 다른 결과는 별도로 캐시한다", function () {
  cache.clear();
  process.env.CACHE_MINUTES = "60";

  cache.set("24h", "global:meme", { id: "global" });
  cache.set("24h", "korea:밈", { id: "korea" });

  assert.equal(cache.get("24h", "global:meme").id, "global");
  assert.equal(cache.get("24h", "korea:밈").id, "korea");
  assert.equal(cache.get("7d", "global:meme"), null);
});

test("CACHE_MINUTES가 0이면 캐시를 사용하지 않는다", function () {
  cache.clear();
  process.env.CACHE_MINUTES = "0";
  cache.set("24h", "global:viral", { id: "value" });
  assert.equal(cache.get("24h", "global:viral"), null);
  delete process.env.CACHE_MINUTES;
});
