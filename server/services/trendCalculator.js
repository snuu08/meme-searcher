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

function modeCountry(posts) {
  var counts = {};
  posts.forEach(function (post) {
    var country = post.country || "global";
    counts[country] = (counts[country] || 0) + 1;
  });
  var keys = Object.keys(counts);
  if (!keys.length) return "global";
  return keys.sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    if (a === "global") return 1;
    if (b === "global") return -1;
    return a.localeCompare(b);
  })[0];
}

function platformBundle(posts, now) {
  var age = oldestAge(posts, now);
  var views = sumAvailable(posts, "views");
  var likes = sumAvailable(posts, "likes");
  var comments = sumAvailable(posts, "comments");
  var shares = sumAvailable(posts, "shares");
  var impressions = sumAvailable(posts, "impressions");
  var viewLikeBase = views != null ? views : impressions;
  var lifetimeViewVelocity = calculateVelocity(views, age);
  var lifetimeLikeVelocity = calculateVelocity(likes, age);
  var recentViewVelocity = sumAvailable(posts, "recentViewVelocity");
  var recentLikeVelocity = sumAvailable(posts, "recentLikeVelocity");
  var recentCommentVelocity = sumAvailable(posts, "recentCommentVelocity");
  var recentShareVelocity = sumAvailable(posts, "recentShareVelocity");
  var viewVelocity = recentViewVelocity != null ? recentViewVelocity : lifetimeViewVelocity;
  var likeVelocity = recentLikeVelocity != null ? recentLikeVelocity : lifetimeLikeVelocity;
  var acceleration = recentViewVelocity != null && lifetimeViewVelocity != null && lifetimeViewVelocity > 0
    ? recentViewVelocity / lifetimeViewVelocity
    : recentLikeVelocity != null && lifetimeLikeVelocity != null && lifetimeLikeVelocity > 0
      ? recentLikeVelocity / lifetimeLikeVelocity
      : null;
  return {
    posts: posts,
    country: modeCountry(posts),
    ageHours: age,
    views: views,
    likes: likes,
    comments: comments,
    shares: shares,
    impressions: impressions,
    viewVelocity: viewVelocity,
    likeVelocity: likeVelocity,
    commentVelocity: recentCommentVelocity != null ? recentCommentVelocity : calculateVelocity(comments, age),
    shareVelocity: recentShareVelocity != null ? recentShareVelocity : calculateVelocity(shares, age),
    impressionVelocity: calculateVelocity(impressions, age),
    acceleration: acceleration,
    likeRate: calculateEngagement(likes, viewLikeBase),
    commentRate: calculateEngagement(comments, viewLikeBase),
    shareRate: calculateEngagement(shares, viewLikeBase),
    saveRate: calculateEngagement(sumAvailable(posts, "saves"), viewLikeBase)
  };
}

function scorePlatform(kind, bundle, pct) {
  var w = TREND_CONFIG.platformWeights[kind] || {};
  if (kind === "tiktok") {
    return weightedScore([
      { value: pct.viewVelocity, weight: w.viewVelocity },
      { value: pct.acceleration, weight: w.acceleration },
      { value: pct.shareVelocity, weight: w.shareVelocity },
      { value: pct.shareRate, weight: w.shareRate },
      { value: pct.commentRate, weight: w.commentRate },
      { value: pct.likeRate, weight: w.likeRate }
    ]);
  }
  if (kind === "youtube") {
    return weightedScore([
      { value: pct.viewVelocity, weight: w.viewVelocity },
      { value: pct.acceleration, weight: w.acceleration },
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
    return { group: group, bundles: bundles, country: modeCountry(group.posts) };
  });

  function platformCohort(list, bundle) {
    var local = list.filter(function (candidate) { return candidate.country === bundle.country; });
    return local.length >= TREND_CONFIG.minCountryCohort ? local : list;
  }

  Object.keys(byPlatform).forEach(function (kind) {
    var list = byPlatform[kind];
    list.forEach(function (bundle) {
      var cohort = platformCohort(list, bundle);
      function pct(field) {
        return calculatePercentile(bundle[field], cohort.map(function (candidate) { return candidate[field]; }));
      }
      bundle.percentiles = {
        viewVelocity: pct("viewVelocity"),
        likeVelocity: pct("likeVelocity"),
        commentVelocity: pct("commentVelocity"),
        shareVelocity: pct("shareVelocity"),
        impressionVelocity: pct("impressionVelocity"),
        acceleration: pct("acceleration"),
        likeRate: pct("likeRate"),
        commentRate: pct("commentRate"),
        shareRate: pct("shareRate"),
        saveRate: pct("saveRate")
      };
      bundle.score = scorePlatform(kind, bundle, bundle.percentiles);
    });
  });

  var creatorCounts = prepared.map(function (row) {
    return uniqueCreators(row.group.posts);
  });

  function averageBundleMetric(row, fields) {
    var values = [];
    Object.keys(row.bundles).forEach(function (kind) {
      var bundle = row.bundles[kind];
      for (var i = 0; i < fields.length; i++) {
        if (bundle[fields[i]] != null) {
          values.push(bundle[fields[i]]);
          break;
        }
      }
    });
    if (!values.length) return null;
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  }

  function averageBundlePercentile(row, fields) {
    var values = [];
    Object.keys(row.bundles).forEach(function (kind) {
      var pct = row.bundles[kind].percentiles || {};
      for (var i = 0; i < fields.length; i++) {
        if (pct[fields[i]] != null) {
          values.push(pct[fields[i]]);
          break;
        }
      }
    });
    if (!values.length) return null;
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  }

  var growthValues = prepared.map(function (row) {
    return averageBundlePercentile(row, ["viewVelocity", "impressionVelocity", "likeVelocity"]);
  });
  var accelerationValues = prepared.map(function (row) {
    return averageBundlePercentile(row, ["acceleration"]);
  });
  var shareValues = prepared.map(function (row) {
    return averageBundlePercentile(row, ["shareVelocity", "shareRate"]);
  });
  var engagementValues = prepared.map(function (row) {
    var values = [];
    Object.keys(row.bundles).forEach(function (kind) {
      var pct = row.bundles[kind].percentiles || {};
      ["likeRate", "commentRate", "shareRate", "saveRate"].forEach(function (field) {
        if (pct[field] != null) values.push(pct[field]);
      });
    });
    return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : null;
  });

  function countryPercentile(value, values, idx) {
    var local = values.filter(function (_, candidateIdx) {
      return prepared[candidateIdx].country === prepared[idx].country;
    });
    if (local.filter(function (v) { return v != null; }).length < TREND_CONFIG.minCountryCohort) local = values;
    return calculatePercentile(value, local);
  }

  return prepared.map(function (row, idx) {
    var platformScores = {};
    Object.keys(row.bundles).forEach(function (kind) {
      var bundle = row.bundles[kind];
      platformScores[kind] = round(bundle.score);
    });

    var growthVelocityScore = growthValues[idx];
    var accelerationScore = accelerationValues[idx];
    var shareScore = shareValues[idx];
    var engagementScore = engagementValues[idx];
    var creatorSpreadScore = creatorCounts[idx]
      ? countryPercentile(creatorCounts[idx], creatorCounts, idx)
      : null;
    var crossPlatformScore = calculateCrossPlatformScore(platformScores);

    var trendScore = weightedScore([
      { value: growthVelocityScore, weight: TREND_CONFIG.memeScoreWeights.growthVelocity },
      { value: accelerationScore, weight: TREND_CONFIG.memeScoreWeights.acceleration },
      { value: shareScore, weight: TREND_CONFIG.memeScoreWeights.share },
      { value: engagementScore, weight: TREND_CONFIG.memeScoreWeights.engagement },
      { value: creatorSpreadScore, weight: TREND_CONFIG.memeScoreWeights.creatorSpread },
      { value: crossPlatformScore, weight: TREND_CONFIG.memeScoreWeights.crossPlatform }
    ]);
    var platformCount = Object.keys(platformScores).filter(function (key) { return platformScores[key] != null; }).length;
    var confidence = Math.min(1, 0.65 + Math.min(creatorCounts[idx], 3) * 0.1 + Math.max(0, platformCount - 1) * 0.05);
    if (trendScore != null) trendScore *= confidence;

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

    var rawViewVelocity = averageBundleMetric(row, ["viewVelocity", "impressionVelocity", "likeVelocity"]);
    var rawAcceleration = averageBundleMetric(row, ["acceleration"]);
    var rawShareVelocity = averageBundleMetric(row, ["shareVelocity"]);
    var metrics = {
      viewVelocity: round(rawViewVelocity),
      acceleration: round(rawAcceleration),
      shareVelocity: round(rawShareVelocity),
      shareRate: null,
      commentRate: null,
      likeRate: null
    };
    var commentRates = [];
    var likeRates = [];
    var shareRates = [];
    Object.keys(row.bundles).forEach(function (k) {
      if (row.bundles[k].commentRate != null) commentRates.push(row.bundles[k].commentRate);
      if (row.bundles[k].likeRate != null) likeRates.push(row.bundles[k].likeRate);
      if (row.bundles[k].shareRate != null) shareRates.push(row.bundles[k].shareRate);
    });
    if (commentRates.length) {
      metrics.commentRate = round(100 * commentRates.reduce(function (a, b) { return a + b; }, 0) / commentRates.length);
    }
    if (likeRates.length) {
      metrics.likeRate = round(100 * likeRates.reduce(function (a, b) { return a + b; }, 0) / likeRates.length);
    }
    if (shareRates.length) {
      metrics.shareRate = round(100 * shareRates.reduce(function (a, b) { return a + b; }, 0) / shareRates.length);
    }

    return {
      bundles: row.bundles,
      platformScores: platformScores,
      trendScore: trendScore == null ? null : Math.round(trendScore),
      growthVelocityScore: round(growthVelocityScore),
      accelerationScore: round(accelerationScore),
      shareScore: round(shareScore),
      engagementScore: round(engagementScore),
      creatorSpreadScore: round(creatorSpreadScore),
      crossPlatformScore: crossPlatformScore,
      confidenceScore: round(confidence * 100),
      primaryCountry: row.country,
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
  assignStatus,
  modeCountry
};
