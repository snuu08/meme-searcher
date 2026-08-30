const { TREND_CONFIG } = require("../config/trendConfig");
const youtube = require("../platforms/youtube");
const tiktok = require("../platforms/tiktok");
const instagram = require("../platforms/instagram");
const { groupSameMemes, pickName, tokens, normalizeMemeName } = require("./memeGrouper");
const { calculateTrendScore } = require("./trendCalculator");

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
  if (scored.metrics.viewVelocity != null) bits.push("조회 확산속도 " + scored.metrics.viewVelocity);
  if (scored.shareScore != null) bits.push("공유 " + scored.shareScore);
  if (scored.metrics.commentRate != null) bits.push("댓글 참여율 " + scored.metrics.commentRate);
  if (scored.crossPlatformScore != null) bits.push("플랫폼 확산 " + scored.crossPlatformScore);
  return bits.join(" · ");
}

async function collectPeriod(period, options) {
  options = options || {};
  var now = Date.now();
  var country = options.country || "global";
  var query = String(options.query || "").trim();
  var seeds = query ? [query] : TREND_CONFIG.seedQueries;
  var hashtags = query ? [query] : TREND_CONFIG.seedHashtags;
  var settled = await Promise.allSettled([
    youtube.fetchPosts({ period: period, country: country, now: now, queries: seeds }),
    tiktok.fetchPosts({ period: period, country: country, now: now, queries: seeds }),
    instagram.fetchPosts({ period: period, country: country, now: now, queries: hashtags })
  ]);

  var warnings = [];
  var posts = [];
  var names = ["YouTube", "TikTok", "Instagram"];
  settled.forEach(function (result, i) {
    if (result.status !== "fulfilled") {
      console.error("[" + names[i] + "]", result.reason && result.reason.message);
      warnings.push(names[i] + " 데이터 사용 불가");
      return;
    }
    var pack = result.value || { posts: [] };
    if (pack.warning) warnings.push(pack.warning);
    (pack.posts || []).forEach(function (p) { posts.push(p); });
  });

  var extra = extraKeywords(posts);
  if (extra.length) {
    var extraSettled = await Promise.allSettled([
      youtube.hasKey() ? youtube.fetchPosts({ period: period, country: country, now: now, queries: extra }) : Promise.resolve({ posts: [] }),
      tiktok.hasKey() ? tiktok.fetchPosts({ period: period, country: country, now: now, queries: extra }) : Promise.resolve({ posts: [] }),
      instagram.hasKey() ? instagram.fetchPosts({ period: period, country: country, now: now, queries: extra }) : Promise.resolve({ posts: [] })
    ]);
    var seen = {};
    posts.forEach(function (p) { seen[p.platform + ":" + p.id] = 1; });
    extraSettled.forEach(function (result) {
      if (result.status !== "fulfilled") return;
      (result.value.posts || []).forEach(function (p) {
        var k = p.platform + ":" + p.id;
        if (seen[k]) return;
        seen[k] = 1;
        posts.push(p);
      });
    });
  }

  var start = now - (period === "7d" ? 7 : 1) * 24 * 60 * 60 * 1000;
  posts = posts.filter(function (p) {
    var t = new Date(p.publishedAt).getTime();
    return Number.isFinite(t) && t >= start;
  });

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
      status: s.status,
      statuses: s.statuses,
      popularityScore: s.trendScore == null ? 0 : s.trendScore,
      trendScore: s.trendScore,
      platforms: s.platformScores,
      platformLinks: platformLinks(group.posts),
      createdAt: group.posts
        .map(function (p) { return p.publishedAt; })
        .sort()
        .slice(-1)[0],
      postCount: s.postCount,
      creatorCount: s.creatorCount,
      metrics: s.metrics,
      growthVelocityScore: s.growthVelocityScore,
      shareScore: s.shareScore,
      engagementScore: s.engagementScore,
      creatorSpreadScore: s.creatorSpreadScore,
      crossPlatformScore: s.crossPlatformScore,
      representativePlatform: representativePlatform(s.platformScores),
      source: "api"
    };
  });

  memes.sort(function (a, b) { return (b.trendScore || 0) - (a.trendScore || 0); });

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
