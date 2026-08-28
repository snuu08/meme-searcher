require("dotenv").config();

const path = require("path");
const express = require("express");
const cache = require("./services/cache");
const { collectPeriod, anyKey } = require("./services/collector");
const { mapDemo } = require("./services/demo");
const { searchMemes } = require("./services/searchAdapter");

const app = express();
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;

function filterCountry(memes, country) {
  if (!country || country === "global") return memes;
  return memes.filter(function (m) {
    return m.countries && m.countries.indexOf(country) !== -1;
  });
}

async function buildPayload(period) {
  var cached = cache.get(period);
  if (cached) return cached;
  var payload;
  if (!anyKey()) {
    payload = mapDemo(period, "global");
  } else {
    payload = await collectPeriod(period);
    if (!payload.memes.length) {
      var demo = mapDemo(period, "global");
      payload.memes = demo.memes;
      payload.source = "demo";
      payload.warnings = (payload.warnings || []).concat(["수집 결과 없음 — Demo 데이터 사용"]);
    }
  }
  cache.set(period, payload);
  return payload;
}

app.get("/api/trends", async function (req, res) {
  var period = req.query.period === "7d" ? "7d" : "24h";
  var country = String(req.query.country || "global");
  var query = String(req.query.q || "");
  try {
    var payload = await buildPayload(period);
    var memes = filterCountry(payload.memes, country);
    memes = searchMemes(memes, query);
    res.json({
      updatedAt: payload.updatedAt,
      period: period,
      country: country,
      source: payload.source,
      warnings: payload.warnings || [],
      memes: memes
    });
  } catch (err) {
    console.error("[api/trends]", err && err.message);
    var demo = mapDemo(period, country);
    res.json({
      updatedAt: demo.updatedAt,
      period: period,
      country: country,
      source: "demo",
      warnings: ["서버 오류 — Demo 데이터 사용"],
      memes: filterCountry(demo.memes, country)
    });
  }
});

app.use(express.static(ROOT));

function warm() {
  ["24h", "7d"].forEach(function (period) {
    buildPayload(period).catch(function (err) {
      console.error("[warm " + period + "]", err && err.message);
    });
  });
}

app.listen(PORT, function () {
  console.log("Meme Searcher http://127.0.0.1:" + PORT);
  warm();
  setInterval(warm, 24 * 60 * 60 * 1000);
});
