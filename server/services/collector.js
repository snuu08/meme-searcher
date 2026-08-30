const { TREND_CONFIG } = require("../config/trendConfig");
const youtube = require("../platforms/youtube");
const tiktok = require("../platforms/tiktok");
const instagram = require("../platforms/instagram");
const { groupSameMemes, pickName, tokens, normalizeMemeName } = require("./memeGrouper");
const { calculateTrendScore } = require("./trendCalculator");
const { enrichPosts } = require("./snapshotStore");
const { balanceHomepageMemes } = require("./countryBalancer");

function anyKey() {
  return youtube.hasKey() || tiktok.hasKey() || instagram.hasKey();
}

function configuredPlatforms() {
  return {
    youtube: youtube.hasKey(),
    tiktok: tiktok.hasKey(),
    instagram: instagram.hasKey()
  };
}

function extraKeywords(posts) {
  var counts = {};
  posts.forEach(function (p) {
    tokens((p.title || "") + " " + (p.description || "")).forEach(function (t) {
      if (t.length < 3) return;
      counts[t] = (counts[t] || 0) + 1;
    });
    (p.hashtags || []).forEach(function (tag) {
      var n = normalizeMemeName(tag);
      if (!n) return;
      counts[n] = (counts[n] || 0) + 2;
    });
  });
  return Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .slice(0, TREND_CONFIG.limits.extraKeywords);
}

function representativePlatform(scores) {
  var best = null;
  var bestVal = -1;
  TREND_CONFIG.platforms.forEach(function (k) {
    if (scores[k] == null) return;
    if (scores[k] > bestVal) {
      bestVal = scores[k];
      best = k;
    }
  });
  return best;
}

function platformLinks(posts) {
  var links = { tiktok: "", instagram: "", youtube: "" };
  posts.forEach(function (p) {
    if (p.url && !links[p.platform]) links[p.platform] = p.url;
  });
  return links;
}

function exampleVideos(posts) {
  var perPlatform = {};
  return posts
    .filter(function (post) { return post.embedUrl || post.url; })
    .slice()
    .sort(function (a, b) {
      return (b.views || b.likes || 0) - (a.views || a.likes || 0);
    })
    .filter(function (post) {
      perPlatform[post.platform] = (perPlatform[post.platform] || 0) + 1;
      return perPlatform[post.platform] <= 2;
    })
    .slice(0, TREND_CONFIG.videoExamplesPerMeme)
    .map(function (post) {
      return {
        platform: post.platform,
        id: post.id,
        title: post.title,
        url: post.url,
        embedUrl: post.embedUrl,
        image: post.image,
        authorId: post.authorId,
        country: post.country,
        publishedAt: post.publishedAt,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves
      };
    });
}

function countriesOf(posts) {
  var set = {};
  posts.forEach(function (p) {
    set[p.country || "global"] = 1;
  });
  var keys = Object.keys(set);
  if (!keys.length) return ["global"];
  return keys;
}

function keywordsOf(posts, name) {
  var set = {};
  set[normalizeMemeName(name)] = 1;
  posts.forEach(function (p) {
    tokens((p.title || "") + " " + (p.description || "")).slice(0, 8).forEach(function (t) {
      set[t] = 1;
    });
  });
  return Object.keys(set).filter(Boolean).slice(0, 16);
}

function hashtagsOf(posts) {
  var set = {};
  posts.forEach(function (p) {
    (p.hashtags || []).forEach(function (t) {
      var n = normalizeMemeName(t);
      if (n) set["#" + n] = 1;
    });
  });
  return Object.keys(set).slice(0, 12);
}

function slugify(name, index) {
  var slug = normalizeMemeName(name).replace(/\s+/g, "-") || "meme";
  return slug + "-" + index;
}

function metricLine(scored) {
  var bits = [];
  if (scored.metrics.viewVelocity != null) bits.push("시간당 조회 증가 " + scored.metrics.viewVelocity);
  if (scored.metrics.acceleration != null) bits.push("가속도 " + scored.metrics.acceleration + "배");
  if (scored.shareScore != null) bits.push("공유 확산점수 " + scored.shareScore);
  if (scored.metrics.commentRate != null) bits.push("댓글 참여율 " + scored.metrics.commentRate + "%");
  if (scored.crossPlatformScore != null) bits.push("플랫폼 확산점수 " + scored.crossPlatformScore);
  return bits.join(" · ");
}

function discoveryCountries(country) {
  return country === "global" ? TREND_CONFIG.discoveryCountries.slice() : [country];
}

function countryQueries(country) {
  return (TREND_CONFIG.countryQueries[country] || TREND_CONFIG.seedQueries).slice();
}

function instagramDiscoveryQueries(country) {
  if (country !== "global") {
    return (TREND_CONFIG.countryHashtags[country] || TREND_CONFIG.seedHashtags).slice();
  }
  return TREND_CONFIG.discoveryCountries.map(function (targetCountry) {
    var tags = TREND_CONFIG.countryHashtags[targetCountry] || [];
    return tags[0];
  }).filter(Boolean).concat(["viral"]);
}

function buildJobs(period, country, now, queries, instagramQueries) {
  var jobs = [];
  discoveryCountries(country).forEach(function (targetCountry) {
    var targetQueries = queries && queries.length ? queries : countryQueries(targetCountry);
    if (youtube.hasKey() && targetCountry !== "china") {
      jobs.push({
        name: "YouTube " + targetCountry,
        promise: youtube.fetchPosts({ period: period, country: targetCountry, now: now, queries: targetQueries })
      });
    }
    if (tiktok.hasKey()) {
      jobs.push({
        name: "TikTok " + targetCountry,
        promise: tiktok.fetchPosts({ period: period, country: targetCountry, now: now, queries: targetQueries })
      });
    }
  });
  if (instagram.hasKey()) {
    jobs.push({
      name: "Instagram",
      promise: instagram.fetchPosts({
        period: period,
        country: country,
        now: now,
        queries: instagramQueries && instagramQueries.length
          ? instagramQueries
          : instagramDiscoveryQueries(country)
      })
    });
  }
  return jobs;
}

async function runJobs(jobs, warnings) {
  var settled = await Promise.allSettled(jobs.map(function (job) { return job.promise; }));
  var posts = [];
  settled.forEach(function (result, i) {
    if (result.status !== "fulfilled") {
      console.error("[" + jobs[i].name + "]", result.reason && result.reason.message);
      if (warnings) warnings.push(jobs[i].name + " 데이터 사용 불가");
      return;
    }
    var pack = result.value || { posts: [] };
    if (warnings && pack.warning) warnings.push(pack.warning);
    (pack.posts || []).forEach(function (post) { posts.push(post); });
  });
  return posts;
}

function dedupePosts(posts) {
  var seen = {};
  return posts.filter(function (post) {
    var key = post.platform + ":" + post.id;
    if (!post.id || seen[key]) return false;
    seen[key] = 1;
    return true;
  });
}

async function collectPeriod(period, options) {
  options = options || {};
  var now = Date.now();
  var country = options.country || "global";
  var query = String(options.query || "").trim();
  var seeds = query ? [query] : null;
  var hashtags = query ? [query] : null;
  var warnings = [];
  if (youtube.hasKey() && discoveryCountries(country).indexOf("china") !== -1) {
    warnings.push("YouTube는 중국 본토 지역 차트를 제공하지 않아 중국/중화권 집계에서 제외됩니다.");
  }
  var posts = await runJobs(buildJobs(period, country, now, seeds, hashtags), warnings);
  posts = dedupePosts(posts);

  var extra = extraKeywords(posts);
  if (extra.length) {
    var extraPosts = await runJobs(buildJobs(period, country, now, extra, extra), null);
    posts = dedupePosts(posts.concat(extraPosts));
  }

  var start = now - (period === "7d" ? 7 : 1) * 24 * 60 * 60 * 1000;
  posts = posts.filter(function (p) {
    var t = new Date(p.publishedAt).getTime();
    return Number.isFinite(t) && t >= start;
  });
  if (posts.length) {
    try {
      posts = await enrichPosts(posts, now);
    } catch (err) {
      console.error("[snapshots]", err.message);
      warnings.push("증가 속도 스냅샷 저장 불가 — 누적 지표로 계산");
    }
  }

  var groups = groupSameMemes(posts);
  var scored = calculateTrendScore(groups, now);

  var memes = groups.map(function (group, i) {
    var s = scored[i];
    var name = pickName(group.posts);
    var desc = (s.description || "").trim().slice(0, 280);
    var why = metricLine(s);
    return {
      id: slugify(name, i + 1),
      slug: slugify(name, i + 1),
      name: name,
      aliases: keywordsOf(group.posts, name).slice(0, 6),
      image: s.image || "./assets/images/demo-01.svg",
      oneLineDescription: desc || why || name,
      description: desc || "수집된 게시물 텍스트입니다. 의미를 단정하지 않습니다.",
      whyTrending: why || "사용 가능한 지표로 계산한 결과입니다.",
      usage: [],
      keywords: keywordsOf(group.posts, name),
      hashtags: hashtagsOf(group.posts),
      countries: countriesOf(group.posts),
      primaryCountry: s.primaryCountry,
      status: s.status,
      statuses: s.statuses,
      popularityScore: s.trendScore == null ? 0 : s.trendScore,
      trendScore: s.trendScore,
      platforms: s.platformScores,
      platformLinks: platformLinks(group.posts),
      videos: exampleVideos(group.posts),
      createdAt: group.posts
        .map(function (p) { return p.publishedAt; })
        .sort()
        .slice(-1)[0],
      postCount: s.postCount,
      creatorCount: s.creatorCount,
      metrics: s.metrics,
      growthVelocityScore: s.growthVelocityScore,
      accelerationScore: s.accelerationScore,
      shareScore: s.shareScore,
      engagementScore: s.engagementScore,
      creatorSpreadScore: s.creatorSpreadScore,
      crossPlatformScore: s.crossPlatformScore,
      confidenceScore: s.confidenceScore,
      representativePlatform: representativePlatform(s.platformScores),
      source: "api"
    };
  });

  memes.sort(function (a, b) { return (b.trendScore || 0) - (a.trendScore || 0); });
  if (country === "global" && !query) {
    memes = balanceHomepageMemes(memes, TREND_CONFIG.homepageLimit);
  } else {
    memes = memes.slice(0, TREND_CONFIG.homepageLimit);
  }

  return {
    updatedAt: new Date(now).toISOString(),
    period: period,
    source: "api",
    query: query,
    platforms: configuredPlatforms(),
    warnings: warnings,
    memes: memes
  };
}

module.exports = { collectPeriod, anyKey, configuredPlatforms };
