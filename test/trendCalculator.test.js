const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCrossPlatformScore } = require("../server/services/trendCalculator");

test("세 플랫폼 확산 점수를 100점 기준으로 계산한다", function () {
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80 })), 33);
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, tiktok: 70 })), 67);
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, tiktok: 70, instagram: 60 })), 100);
});

test("지원하지 않는 플랫폼은 확산 점수에 포함하지 않는다", function () {
  assert.equal(Math.round(calculateCrossPlatformScore({ youtube: 80, x: 100 })), 33);
});
