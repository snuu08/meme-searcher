const test = require("node:test");
const assert = require("node:assert/strict");

global.COUNTRY_LABELS = { korea: "한국" };
global.STATUS_LABELS = { rising: "급상승" };
const { renderVideoExamples, safePlatformUrl } = require("../js/detail");

test("플랫폼 공식 도메인의 HTTPS 영상 URL만 허용한다", function () {
  assert.equal(safePlatformUrl("javascript:alert(1)", true), "");
  assert.equal(safePlatformUrl("https://youtube.com.evil.example/embed/1", true), "");
  assert.equal(safePlatformUrl("https://www.youtube.com/embed/abc", true), "https://www.youtube.com/embed/abc");
});

test("API 영상 예시를 안전한 iframe과 원본 링크로 만든다", function () {
  var html = renderVideoExamples([{
    platform: "youtube",
    title: "테스트 쇼츠",
    embedUrl: "https://www.youtube.com/embed/abc",
    url: "https://www.youtube.com/watch?v=abc",
    country: "korea",
    views: 12000,
    likes: 500
  }]);
  assert.match(html, /video-example-frame/);
  assert.match(html, /YouTube · 한국/);
  assert.match(html, /원본 보기/);
  assert.doesNotMatch(html, /javascript:/);
});
