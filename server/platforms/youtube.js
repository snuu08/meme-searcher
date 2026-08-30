const { TREND_CONFIG } = require("../config/trendConfig");
const { periodStart, iso, extractHashtags, warn, getJson } = require("./http");

function hasKey() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

function regionFor(country) {
  return TREND_CONFIG.youtubeRegionMap[country] || null;
}

function durationSeconds(value) {
  var match = String(value || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function isMemeCandidate(item) {
  var sn = item.snippet || {};
  var text = ((sn.title || "") + " " + (sn.description || "") + " " + (sn.tags || []).join(" ")).toLowerCase();
  return TREND_CONFIG.memeTerms.some(function (term) { return text.indexOf(term) !== -1; });
}

function mapVideo(item, country) {
  var sn = item.snippet || {};
  var st = item.statistics || {};
  var thumbs = sn.thumbnails || {};
  var thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
  var views = st.viewCount != null ? Number(st.viewCount) : null;
  var likes = st.likeCount != null ? Number(st.likeCount) : null;
  var comments = st.commentCount != null ? Number(st.commentCount) : null;
  var tags = Array.isArray(sn.tags) ? sn.tags : [];
  return {
    platform: "youtube",
    id: item.id,
    url: "https://www.youtube.com/watch?v=" + item.id,
    embedUrl: item.status && item.status.embeddable === false
      ? ""
      : "https://www.youtube.com/embed/" + item.id,
    title: sn.title || "",
    text: sn.title || "",
    description: sn.description || "",
    hashtags: extractHashtags((sn.title || "") + " " + (sn.description || "")).concat(
      tags.map(function (t) { return String(t).replace(/^#/, "").toLowerCase(); })
    ),
    image: thumb || null,
    publishedAt: sn.publishedAt || iso(Date.now()),
    authorId: sn.channelId || null,
    country: country || "global",
    views: Number.isFinite(views) ? views : null,
    likes: Number.isFinite(likes) ? likes : null,
    comments: Number.isFinite(comments) ? comments : null,
    shares: null,
    saves: null,
    impressions: null,
    durationSeconds: durationSeconds(item.contentDetails && item.contentDetails.duration),
    collectedAt: new Date().toISOString()
  };
}

async function videosByIds(ids, country) {
  if (!ids.length) return [];
  var url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics,contentDetails,status");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("maxResults", String(Math.min(50, ids.length)));
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
  var data = await getJson(url);
  return (data.items || []).map(function (item) { return mapVideo(item, country); });
}

async function fetchPopular(country, now) {
  var region = regionFor(country);
  if (!region && country !== "global") return [];
  region = region || "US";
  var url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics,contentDetails,status");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("maxResults", String(TREND_CONFIG.limits.youtubePopular));
  url.searchParams.set("regionCode", region);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
  var data = await getJson(url);
  var start = periodStart("7d", now).getTime();
  return (data.items || [])
    .filter(isMemeCandidate)
    .map(function (item) { return mapVideo(item, country === "global" ? "global" : country); })
    .filter(function (p) {
      return new Date(p.publishedAt).getTime() >= start &&
        (p.durationSeconds == null || p.durationSeconds <= 240);
    });
}

async function searchQuery(query, country, period, now) {
  var url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("videoDuration", "short");
  url.searchParams.set("maxResults", String(TREND_CONFIG.limits.youtubeSearchPerQuery));
  url.searchParams.set("publishedAfter", iso(periodStart(period, now)));
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
  var region = regionFor(country);
  if (region) url.searchParams.set("regionCode", region);
  var language = TREND_CONFIG.youtubeLanguageMap[country] || null;
  if (language) url.searchParams.set("relevanceLanguage", language);
  var data = await getJson(url);
  var ids = (data.items || [])
    .map(function (item) { return item.id && item.id.videoId; })
    .filter(Boolean);
  return videosByIds(ids, country === "global" ? "global" : country);
}

async function fetchPosts(options) {
  if (!hasKey()) return { posts: [], warning: null };
  var country = options.country || "global";
  if (country === "china") {
    return { posts: [], warning: "YouTube 중국 본토 지역 차트 미지원" };
  }
  var period = options.period || "24h";
  var now = options.now || Date.now();
  var queries = options.queries || TREND_CONFIG.seedQueries;
  try {
    var jobs = [fetchPopular(country, now)];
    queries.slice(0, TREND_CONFIG.limits.youtubeMaxQueries).forEach(function (q) {
      jobs.push(searchQuery(q, country, period, now));
    });
    var settled = await Promise.allSettled(jobs);
    var posts = [];
    var seen = {};
    settled.forEach(function (result) {
      if (result.status !== "fulfilled") {
        console.error("[youtube]", result.reason && result.reason.message);
        return;
      }
      result.value.forEach(function (p) {
        if (seen[p.id]) return;
        seen[p.id] = true;
        posts.push(p);
      });
    });
    var start = periodStart(period, now).getTime();
    posts = posts.filter(function (p) { return new Date(p.publishedAt).getTime() >= start; });
    return { posts: posts, warning: null };
  } catch (err) {
    return warn("youtube", err);
  }
}

module.exports = { fetchPosts, hasKey };
