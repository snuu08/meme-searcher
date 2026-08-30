const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateCrossPlatformScore,
  calculateTrendScore,
  weightedScore
} = require("../server/services/trendCalculator");

test("세 플랫폼 확산 점수를 100점 기준으로 계산한다", function () {
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80 })), 33);
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, tiktok: 70 })), 67);
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, tiktok: 70, instagram: 60 })), 100);
});

test("지원하지 않는 플랫폼은 확산 점수에 포함하지 않는다", function () {
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, x: 100 })), 33);
});

test("제공되지 않는 지표는 0점으로 벌점 처리하지 않고 가중치를 재분배한다", function () {
  assert.equal(weightedScore([
    { value: 80, weight: 0.4 },
    { value: null, weight: 0.4 },
    { value: 60, weight: 0.2 }
  ]), 80 * (2 / 3) + 60 * (1 / 3));
});

test("국가별 모수 차이가 커도 같은 국가 내 상대 성장 순위는 같은 점수를 받는다", function () {
  var now = Date.parse("2026-08-30T12:00:00.000Z");
  function group(country, rank, scale) {
    var views = rank * scale;
    return {
      posts: [{
        platform: "youtube",
        id: country + "-" + rank,
        title: country + " meme " + rank,
        publishedAt: "2026-08-30T10:00:00.000Z",
        authorId: country + "-creator-" + rank,
        country: country,
        views: views,
        likes: views * 0.1,
        comments: views * 0.01,
        shares: null,
        saves: null
      }]
    };
  }
  var groups = [
    group("korea", 1, 100),
    group("korea", 2, 100),
    group("korea", 3, 100),
    group("us", 1, 100000),
    group("us", 2, 100000),
    group("us", 3, 100000)
  ];
  var scores = calculateTrendScore(groups, now);
  assert.equal(scores[0].trendScore, scores[3].trendScore);
  assert.equal(scores[1].trendScore, scores[4].trendScore);
  assert.equal(scores[2].trendScore, scores[5].trendScore);
});
