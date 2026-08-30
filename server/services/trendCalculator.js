const { TREND_CONFIG } = require("../config/trendConfig");

function calculateAgeHours(publishedAt, now) {
  var age = (now - new Date(publishedAt).getTime()) / 3600000;
  if (!Number.isFinite(age)) return TREND_CONFIG.minAgeHours;
  return Math.max(age, TREND_CONFIG.minAgeHours);
}

function calculateVelocity(count, ageHours) {
  if (count == null || !Number.isFinite(count) || !Number.isFinite(ageHours)) return null;
  return count / ageHours;
}

function calculateEngagement(count, views) {
  if (count == null || views == null || !Number.isFinite(count) || !Number.isFinite(views) || views <= 0) {
    return null;
  }
  return count / views;
}

function calculatePercentile(value, values) {
  var list = (values || []).filter(function (v) { return v != null && Number.isFinite(v); });
  if (!list.length || value == null || !Number.isFinite(value)) return null;
  var sorted = list.slice().sort(function (a, b) { return a - b; });
  var rank = 0;
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) rank += 1;
  }
  return (rank / sorted.length) * 100;
}

function weightedScore(parts) {
  var avail = (parts || []).filter(function (p) {
    return p && p.value != null && Number.isFinite(p.value) && p.weight > 0;
  });
  var sumW = 0;
  avail.forEach(function (p) { sumW += p.weight; });
  if (!sumW) return null;
  var sum = 0;
  avail.forEach(function (p) { sum += p.value * p.weight; });
  return sum / sumW;
}

function sumAvailable(posts, field) {
  var total = 0;
  var any = false;
  posts.forEach(function (p) {
    if (p[field] == null || !Number.isFinite(p[field])) return;
    total += p[field];
    any = true;
  });
  return any ? total : null;
}

function oldestAge(posts, now) {
  var min = Infinity;
  posts.forEach(function (p) {
    var age = calculateAgeHours(p.publishedAt, now);
    if (age < min) min = age;
  });
  return min === Infinity ? TREND_CONFIG.minAgeHours : min;
}

function platformBundle(posts, now) {
  var age = oldestAge(posts, now);
  var views = sumAvailable(posts, "views");
  var likes = sumAvailable(posts, "likes");
  var comments = sumAvailable(posts, "comments");
  var shares = sumAvailable(posts, "shares");
  var impressions = sumAvailable(posts, "impressions");
  var viewLikeBase = views != null ? views : impressions;
  return {
    posts: posts,
    ageHours: age,
    views: views,
    likes: likes,
    comments: comments,
    shares: shares,
    impressions: impressions,
    viewVelocity: calculateVelocity(views, age),
    likeVelocity: calculateVelocity(likes, age),
    commentVelocity: calculateVelocity(comments, age),
    shareVelocity: calculateVelocity(shares, age),
    impressionVelocity: calculateVelocity(impressions, age),
    likeRate: calculateEngagement(likes, viewLikeBase),
    commentRate: calculateEngagement(comments, viewLikeBase),
    shareRate: calculateEngagement(shares, viewLikeBase),
    saveRate: calculateEngagement(sumAvailable(posts, "saves"), viewLikeBase)
  };
}

function percentileMap(items, getter) {
  var values = items.map(getter);
  return items.map(function (item, i) {
    return calculatePercentile(values[i], values);
  });
}

function scorePlatform(kind, bundle, pct) {
  var w = TREND_CONFIG.platformWeights[kind] || {};
  if (kind === "tiktok") {
    return weightedScore([
      { value: pct.viewVelocity, weight: w.viewVelocity },
      { value: pct.shareVelocity, weight: w.shareVelocity },
      { value: pct.shareRate, weight: w.shareRate },
      { value: pct.commentRate, weight: w.commentRate },
      { value: pct.likeRate, weight: w.likeRate }
    ]);
  }
  if (kind === "youtube") {
    return weightedScore([
      { value: pct.viewVelocity, weight: w.viewVelocity },
      { value: pct.likeRate, weight: w.likeRate },
      { value: pct.commentRate, weight: w.commentRate }
    ]);
  }
  return weightedScore([
    { value: pct.likeVelocity, weight: w.likeVelocity },
    { value: pct.commentVelocity, weight: w.commentVelocity },
    { value: pct.likeRate, weight: w.likeRate },
    { value: pct.commentRate, weight: w.commentRate }
  ]);
}

function uniqueCreators(posts) {
  var set = {};
  posts.forEach(function (p) {
    if (!p.authorId) return;
    set[p.platform + ":" + p.authorId] = 1;
  });
  return Object.keys(set).length;
}

function calculateCrossPlatformScore(platformScores) {
  var n = 0;
  TREND_CONFIG.platforms.forEach(function (k) {
    if (platformScores[k] != null) n += 1;
  });
  if (!n) return null;
  return n * (100 / TREND_CONFIG.platforms.length);
}

function assignStatus(trendScore, ageHours) {
  var statuses = [];
  if (ageHours <= TREND_CONFIG.newHours) statuses.push("new");
  if (trendScore != null && trendScore >= TREND_CONFIG.risingScore) statuses.push("rising");
  else if (trendScore != null && trendScore >= TREND_CONFIG.popularScore) statuses.push("popular");
  var status = "popular";
  if (statuses.indexOf("rising") !== -1) status = "rising";
  else if (statuses.indexOf("new") !== -1) status = "new";
  else if (statuses.indexOf("popular") !== -1) status = "popular";
  else status = "new";
  return { status: status, statuses: statuses.length ? statuses : [status] };
}

function round(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function calculateTrendScore(groups, now) {
  now = now || Date.now();
  var byPlatform = { tiktok: [], youtube: [], instagram: [] };
  var prepared = groups.map(function (group) {
    var buckets = { tiktok: [], youtube: [], instagram: [] };
    group.posts.forEach(function (p) {
      if (buckets[p.platform]) buckets[p.platform].push(p);
    });
    var bundles = {};
    Object.keys(buckets).forEach(function (k) {
      if (!buckets[k].length) return;
      bundles[k] = platformBundle(buckets[k], now);
      byPlatform[k].push(bundles[k]);
    });
    return { group: group, bundles: bundles };
  });

  function pctField(kind, field) {
    return percentileMap(byPlatform[kind], function (b) { return b[field]; });
  }

  var platformPct = {};
  Object.keys(byPlatform).forEach(function (kind) {
    var list = byPlatform[kind];
    platformPct[kind] = {
      viewVelocity: pctField(kind, "viewVelocity"),
      likeVelocity: pctField(kind, "likeVelocity"),
      commentVelocity: pctField(kind, "commentVelocity"),
      shareVelocity: pctField(kind, "shareVelocity"),
      impressionVelocity: pctField(kind, "impressionVelocity"),
      likeRate: pctField(kind, "likeRate"),
      commentRate: pctField(kind, "commentRate"),
      shareRate: pctField(kind, "shareRate")
    };
    platformPct[kind].replyRate = platformPct[kind].commentRate;
    list.forEach(function (bundle, i) {
      bundle.score = scorePlatform(kind, bundle, {
        viewVelocity: platformPct[kind].viewVelocity[i],
        likeVelocity: platformPct[kind].likeVelocity[i],
        commentVelocity: platformPct[kind].commentVelocity[i],
        shareVelocity: platformPct[kind].shareVelocity[i],
        impressionVelocity: platformPct[kind].impressionVelocity[i],
        likeRate: platformPct[kind].likeRate[i],
        commentRate: platformPct[kind].commentRate[i],
        shareRate: platformPct[kind].shareRate[i],
        replyRate: platformPct[kind].commentRate[i]
      });
    });
  });

  var creatorCounts = prepared.map(function (row) {
    return uniqueCreators(row.group.posts);
  });

  return prepared.map(function (row, idx) {
    var platformScores = {};
    var growthParts = [];
    var shareParts = [];
    var engagementParts = [];
    Object.keys(row.bundles).forEach(function (kind) {
      var bundle = row.bundles[kind];
      platformScores[kind] = round(bundle.score);
      if (bundle.viewVelocity != null) growthParts.push(bundle.viewVelocity);
      else if (bundle.impressionVelocity != null) growthParts.push(bundle.impressionVelocity);
      else if (bundle.likeVelocity != null) growthParts.push(bundle.likeVelocity);
      if (bundle.shareVelocity != null) shareParts.push(bundle.shareVelocity);
      if (bundle.likeRate != null) engagementParts.push(bundle.likeRate);
      if (bundle.commentRate != null) engagementParts.push(bundle.commentRate);
      if (bundle.shareRate != null) engagementParts.push(bundle.shareRate);
    });

    var growthValues = prepared.map(function (r) {
      var vals = [];
      Object.keys(r.bundles).forEach(function (k) {
        var b = r.bundles[k];
        if (b.viewVelocity != null) vals.push(b.viewVelocity);
        else if (b.impressionVelocity != null) vals.push(b.impressionVelocity);
        else if (b.likeVelocity != null) vals.push(b.likeVelocity);
      });
      if (!vals.length) return null;
      return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    });
    var shareValues = prepared.map(function (r) {
      var vals = [];
      Object.keys(r.bundles).forEach(function (k) {
        if (r.bundles[k].shareVelocity != null) vals.push(r.bundles[k].shareVelocity);
      });
      if (!vals.length) return null;
      return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    });
    var engagementValues = prepared.map(function (r) {
      var vals = [];
      Object.keys(r.bundles).forEach(function (k) {
        var b = r.bundles[k];
        if (b.likeRate != null) vals.push(b.likeRate);
        if (b.commentRate != null) vals.push(b.commentRate);
        if (b.shareRate != null) vals.push(b.shareRate);
      });
      if (!vals.length) return null;
      return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    });

    var growthVelocityScore = calculatePercentile(growthValues[idx], growthValues);
    var shareScore = calculatePercentile(shareValues[idx], shareValues);
    var engagementScore = calculatePercentile(engagementValues[idx], engagementValues);
    var creatorSpreadScore = creatorCounts[idx]
      ? calculatePercentile(creatorCounts[idx], creatorCounts.filter(Boolean))
      : null;
    var crossPlatformScore = calculateCrossPlatformScore(platformScores);

    var trendScore = weightedScore([
      { value: growthVelocityScore, weight: TREND_CONFIG.memeScoreWeights.growthVelocity },
      { value: shareScore, weight: TREND_CONFIG.memeScoreWeights.share },
      { value: engagementScore, weight: TREND_CONFIG.memeScoreWeights.engagement },
      { value: creatorSpreadScore, weight: TREND_CONFIG.memeScoreWeights.creatorSpread },
      { value: crossPlatformScore, weight: TREND_CONFIG.memeScoreWeights.crossPlatform }
    ]);

    var minAge = Infinity;
    row.group.posts.forEach(function (p) {
      var age = calculateAgeHours(p.publishedAt, now);
      if (age < minAge) minAge = age;
    });
    var statusInfo = assignStatus(trendScore, minAge);
    var firstImage = null;
    var firstDesc = "";
    row.group.posts.forEach(function (p) {
      if (!firstImage && p.image) firstImage = p.image;
      if (!firstDesc && (p.description || p.text)) firstDesc = p.description || p.text;
    });

    var metrics = {
      viewVelocity: growthValues[idx] != null ? round(growthValues[idx]) : null,
      shareRate: shareValues[idx] != null ? round(shareValues[idx]) : null,
      commentRate: null,
      likeRate: null
    };
    var commentRates = [];
    var likeRates = [];
    Object.keys(row.bundles).forEach(function (k) {
      if (row.bundles[k].commentRate != null) commentRates.push(row.bundles[k].commentRate);
      if (row.bundles[k].likeRate != null) likeRates.push(row.bundles[k].likeRate);
    });
    if (commentRates.length) {
      metrics.commentRate = round(commentRates.reduce(function (a, b) { return a + b; }, 0) / commentRates.length);
    }
    if (likeRates.length) {
      metrics.likeRate = round(likeRates.reduce(function (a, b) { return a + b; }, 0) / likeRates.length);
    }

    return {
      bundles: row.bundles,
      platformScores: platformScores,
      trendScore: trendScore == null ? null : Math.round(trendScore),
      growthVelocityScore: round(growthVelocityScore),
      shareScore: round(shareScore),
      engagementScore: round(engagementScore),
      creatorSpreadScore: round(creatorSpreadScore),
      crossPlatformScore: crossPlatformScore,
      creatorCount: creatorCounts[idx],
      postCount: row.group.posts.length,
      status: statusInfo.status,
      statuses: statusInfo.statuses,
      ageHours: minAge,
      image: firstImage,
      description: firstDesc,
      metrics: metrics
    };
  });
}

module.exports = {
  calculateAgeHours,
  calculateVelocity,
  calculateEngagement,
  calculatePercentile,
  weightedScore,
  calculateCrossPlatformScore,
  calculateTrendScore,
  assignStatus
};
