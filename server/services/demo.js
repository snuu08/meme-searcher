const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadDemoMemes() {
  var code = fs.readFileSync(path.join(__dirname, "../../js/memes.js"), "utf8");
  var ctx = {};
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.memes || [];
}

function mapDemo(period, country) {
  var memes = loadDemoMemes().map(function (m) {
    return Object.assign({}, m, {
      trendScore: m.popularityScore,
      statuses: [m.status],
      platforms: {},
      postCount: null,
      creatorCount: null,
      metrics: {},
      representativePlatform: null,
      source: "demo"
    });
  });
  return {
    updatedAt: new Date().toISOString(),
    period: period,
    country: country,
    source: "demo",
    warnings: ["API Key 없음 — Demo 데이터 사용"],
    memes: memes
  };
}

module.exports = { loadDemoMemes, mapDemo };
