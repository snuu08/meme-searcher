const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveVelocity, perHour } = require("../server/services/snapshotStore");

test("두 스냅샷 차이로 시간당 증가량을 계산한다", function () {
  var now = Date.parse("2026-08-30T12:00:00.000Z");
  var previous = {
    collectedAt: "2026-08-30T10:00:00.000Z",
    views: 100,
    likes: 10,
    comments: 2,
    shares: 1
  };
  var velocity = deriveVelocity({ views: 500, likes: 30, comments: 6, shares: 5 }, previous, now);
  assert.equal(velocity.snapshotHours, 2);
  assert.equal(velocity.recentViewVelocity, 200);
  assert.equal(velocity.recentLikeVelocity, 10);
  assert.equal(velocity.recentCommentVelocity, 2);
  assert.equal(velocity.recentShareVelocity, 2);
});

test("카운터가 줄어든 경우 음의 유행 속도를 만들지 않는다", function () {
  assert.equal(perHour(80, 100, 2), 0);
});
