require("dotenv").config();

const path = require("path");
const express = require("express");
const cache = require("./services/cache");
const { collectPeriod, anyKey, configuredPlatforms } = require("./services/collector");
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

function cleanQuery(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

async function buildPayload(period, country, query) {
  var scope = (country || "global") + ":" + (query || "trending").toLowerCase();
  var cached = cache.get(period, scope);
  if (cached) return cached;
  var payload;
  if (!anyKey()) {
    payload = mapDemo(period, country);
    payload.query = query;
    payload.platforms = configuredPlatforms();
  } else {
    payload = await collectPeriod(period, { country: country, query: query });
  }
  cache.set(period, scope, payload);
  return payload;
}

app.get("/api/trends", async function (req, res) {
  var period = req.query.period === "7d" ? "7d" : "24h";
  var allowedCountries = ["global", "us", "china", "korea", "japan"];
  var requestedCountry = String(req.query.country || "global");
  var country = allowedCountries.indexOf(requestedCountry) === -1 ? "global" : requestedCountry;
  var query = cleanQuery(req.query.q);
  try {
    var payload = await buildPayload(period, country, query);
    var memes = filterCountry(payload.memes, country);
    if (payload.source === "demo") memes = searchMemes(memes, query);
    res.json({
      updatedAt: payload.updatedAt,
      period: period,
      country: country,
      source: payload.source,
      query: query,
      platforms: payload.platforms || configuredPlatforms(),
      warnings: payload.warnings || [],
      memes: memes
    });
  } catch (err) {
    console.error("[api/trends]", err && err.message);
    if (anyKey()) {
      res.status(500).json({
        updatedAt: new Date().toISOString(),
        period: period,
        country: country,
        source: "api",
        query: query,
        platforms: configuredPlatforms(),
        warnings: ["API 수집 중 서버 오류가 발생했습니다."],
        memes: []
      });
      return;
    }
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
    buildPayload(period, "global", "").catch(function (err) {
      console.error("[warm " + period + "]", err && err.message);
    });
  });
}

app.listen(PORT, function () {
  console.log("Meme Searcher http://127.0.0.1:" + PORT);
  warm();
  setInterval(warm, Math.max(cache.cacheMinutes(), 5) * 60 * 1000);
});
