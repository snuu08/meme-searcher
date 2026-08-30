const { TREND_CONFIG } = require("../config/trendConfig");

function bucketFor(meme) {
  var country = meme.primaryCountry || (meme.countries && meme.countries[0]) || "global";
  if (country === "korea" || country === "japan" || country === "china") return country;
  return "other";
}

function byScore(a, b) {
  return (b.trendScore || 0) - (a.trendScore || 0);
}

function slotOrder(limit, mix) {
  var keys = Object.keys(mix);
  var current = {};
  keys.forEach(function (key) { current[key] = 0; });
  var slots = [];
  for (var i = 0; i < limit; i++) {
    var best = keys[0];
    keys.forEach(function (key) {
      current[key] += mix[key];
      if (current[key] > current[best]) best = key;
    });
    current[best] -= 1;
    slots.push(best);
  }
  return slots;
}

function balanceHomepageMemes(memes, limit) {
  limit = Math.max(1, Number(limit) || TREND_CONFIG.homepageLimit);
  var buckets = { korea: [], japan: [], china: [], other: [] };
  memes.forEach(function (meme) { buckets[bucketFor(meme)].push(meme); });
  Object.keys(buckets).forEach(function (key) { buckets[key].sort(byScore); });

  var selected = [];
  var used = {};
  slotOrder(limit, TREND_CONFIG.homepageMix).forEach(function (key) {
    var meme = buckets[key].shift();
    if (!meme || used[meme.id]) return;
    used[meme.id] = 1;
    selected.push(meme);
  });

  if (selected.length < limit) {
    var rest = [];
    Object.keys(buckets).forEach(function (key) { rest = rest.concat(buckets[key]); });
    rest.sort(byScore).forEach(function (meme) {
      if (selected.length >= limit || used[meme.id]) return;
      used[meme.id] = 1;
      selected.push(meme);
    });
  }

  return selected;
}

module.exports = { balanceHomepageMemes, bucketFor, slotOrder };
