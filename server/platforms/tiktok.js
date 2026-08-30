const { TREND_CONFIG } = require("../config/trendConfig");
const { periodStart, extractHashtags, warn, getJson } = require("./http");

function hasKey() {
  return process.env.TIKTOK_RESEARCH_ENABLED === "true" &&
    Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

async function researchToken() {
  var body = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: "client_credentials"
  });
  var data = await getJson("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body
  });
  if (!data.access_token) throw new Error("TikTok token missing");
  return data.access_token;
}

function mapVideo(item) {
  var stats = (item.like_count != null || item.view_count != null) ? item : (item.statistics || item);
  var views = stats.view_count != null ? Number(stats.view_count) : null;
  var likes = stats.like_count != null ? Number(stats.like_count) : null;
  var comments = stats.comment_count != null ? Number(stats.comment_count) : null;
  var shares = stats.share_count != null ? Number(stats.share_count) : null;
  var saves = stats.favorites_count != null ? Number(stats.favorites_count) : null;
  var desc = item.video_description || item.desc || "";
  var createTime = item.create_time
    ? new Date(Number(item.create_time) * (String(item.create_time).length > 10 ? 1 : 1000)).toISOString()
    : new Date().toISOString();
  var region = item.region_code || item.region || "";
  var country = "global";
  if (region === "US") country = "us";
  if (region === "KR") country = "korea";
  if (region === "JP") country = "japan";
  if (region === "CN") country = "china";
  var id = String(item.id || item.item_id || item.video_id || "");
  var username = item.username || item.author || item.display_name || "";
  var hashtags = Array.isArray(item.hashtag_names)
    ? item.hashtag_names.map(function (tag) { return String(tag).replace(/^#/, "").toLowerCase(); })
    : extractHashtags(desc);
  return {
    platform: "tiktok",
    id: id,
    url: id && username ? "https://www.tiktok.com/@" + encodeURIComponent(username) + "/video/" + id : "",
    embedUrl: id ? "https://www.tiktok.com/player/v1/" + id : "",
    title: desc.slice(0, 80),
    text: desc,
    description: desc,
    hashtags: hashtags,
    image: item.cover_image_url || null,
    publishedAt: createTime,
    authorId: username || null,
    country: country,
    views: Number.isFinite(views) ? views : null,
    likes: Number.isFinite(likes) ? likes : null,
    comments: Number.isFinite(comments) ? comments : null,
    shares: Number.isFinite(shares) ? shares : null,
    saves: Number.isFinite(saves) ? saves : null,
    impressions: null,
    durationSeconds: item.video_duration != null ? Number(item.video_duration) : null,
    musicId: item.music_id != null ? String(item.music_id) : null,
    collectedAt: new Date().toISOString()
  };
}

async function queryVideos(token, query, country, period, now) {
  var start = Math.floor(periodStart(period, now).getTime() / 1000);
  var end = Math.floor(now / 1000);
  var conditions = [{ field_name: "keyword", operation: "IN", field_values: [query] }];
  var region = TREND_CONFIG.tiktokRegionMap[country] || null;
  if (region) conditions.push({ field_name: "region_code", operation: "EQ", field_values: [region] });
  var res = await fetch("https://open.tiktokapis.com/v2/research/video/query/?fields=id,video_description,create_time,username,region_code,view_count,like_count,comment_count,share_count,favorites_count,music_id,hashtag_names,video_duration", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: {
        and: conditions
      },
      max_count: TREND_CONFIG.limits.tiktokMaxResults,
      start_date: new Date(start * 1000).toISOString().slice(0, 10).replace(/-/g, ""),
      end_date: new Date(end * 1000).toISOString().slice(0, 10).replace(/-/g, "")
    })
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error((data.error && data.error.message) || res.statusText);
  }
  var list = (data.data && (data.data.videos || data.data)) || [];
  if (!Array.isArray(list)) list = [];
  return list.map(mapVideo);
}

async function fetchPosts(options) {
  if (!hasKey()) return { posts: [], warning: null };
  var period = options.period || "24h";
  var country = options.country || "global";
  var now = options.now || Date.now();
  var queries = options.queries || TREND_CONFIG.seedQueries;
  try {
    var token = await researchToken();
    var jobs = queries.slice(0, TREND_CONFIG.limits.tiktokMaxQueries).map(function (q) {
      return queryVideos(token, q, country, period, now);
    });
    var settled = await Promise.allSettled(jobs);
    var posts = [];
    var seen = {};
    var failed = 0;
    settled.forEach(function (result) {
      if (result.status !== "fulfilled") {
        failed += 1;
        console.error("[tiktok]", result.reason && result.reason.message);
        return;
      }
      result.value.forEach(function (p) {
        if (!p.id || seen[p.id]) return;
        seen[p.id] = true;
        posts.push(p);
      });
    });
    if (!posts.length && failed) return { posts: [], warning: "TikTok 데이터 사용 불가" };
    return { posts: posts, warning: failed ? "TikTok 일부 지표 사용 불가" : null };
  } catch (err) {
    return warn("tiktok", err);
  }
}

module.exports = { fetchPosts, hasKey };
