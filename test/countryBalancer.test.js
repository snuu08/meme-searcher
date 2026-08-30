const test = require("node:test");
const assert = require("node:assert/strict");
const { balanceHomepageMemes, bucketFor, slotOrder } = require("../server/services/countryBalancer");
const { TREND_CONFIG } = require("../server/config/trendConfig");

test("홈 화면 20칸을 한국 50%, 일본 20%, 중국 10%, 기타 20%로 배분한다", function () {
  var slots = slotOrder(20, TREND_CONFIG.homepageMix);
  var counts = slots.reduce(function (acc, key) {
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { korea: 10, japan: 4, other: 4, china: 2 });
});

test("한 국가 후보가 부족하면 남은 고득점 밈으로 안전하게 채운다", function () {
  var memes = [];
  for (var i = 0; i < 12; i++) {
    memes.push({ id: "kr-" + i, primaryCountry: "korea", trendScore: 100 - i });
  }
  for (var j = 0; j < 3; j++) {
    memes.push({ id: "jp-" + j, primaryCountry: "japan", trendScore: 70 - j });
  }
  var result = balanceHomepageMemes(memes, 10);
  assert.equal(result.length, 10);
  assert.equal(new Set(result.map(function (meme) { return meme.id; })).size, 10);
  assert.ok(result.some(function (meme) { return bucketFor(meme) === "japan"; }));
});
