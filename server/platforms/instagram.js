const { TREND_CONFIG } = require("../config/trendConfig");
const { extractHashtags, warn, getJson } = require("./http");

function hasKey() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_IG_USER_ID);
}

function graphUrl(path) {
  var configured = String(process.env.META_GRAPH_VERSION || "v23.0");
  var version = /^v\d+\.\d+$/.test(configured) ? configured : "v23.0";
  return "https://graph.facebook.com/" + version + "/" + path;
}

function inferCountry(text) {
  var value = String(text || "");
  if (/[가-힣]/.test(value)) return "korea";
  if (/[ぁ-ゟ゠-ヿ]/.test(value)) return "japan";
  if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(value)) return "china";
  return "global";
}

function instagramEmbedUrl(permalink) {
  if (!permalink) return "";
  try {
    var url = new URL(permalink);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") + "/embed/";
    return url.toString();
  } catch (_) {
    return "";
  }
}

async function hashtagId(tag) {
  var url = new URL(graphUrl("ig_hashtag_search"));
  url.searchParams.set("user_id", process.env.INSTAGRAM_IG_USER_ID);
  url.searchParams.set("q", tag.replace(/^#/, ""));
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN);
  var data = await getJson(url);
  return data.data && data.data[0] && data.data[0].id;
}

function mapMedia(item) {
  var caption = item.caption || "";
  var likes = item.like_count != null ? Number(item.like_count) : null;
  var comments = item.comments_count != null ? Number(item.comments_count) : null;
  return {
    platform: "instagram",
    id: item.id,
    url: item.permalink || "",
    embedUrl: instagramEmbedUrl(item.permalink),
    title: caption.slice(0, 80),
    text: caption,
    description: caption,
    hashtags: extractHashtags(caption),
    image: item.thumbnail_url || item.media_url || null,
    publishedAt: item.timestamp || new Date().toISOString(),
    authorId: item.username || null,
    country: inferCountry(caption),
    countryBasis: "language",
    views: null,
    likes: Number.isFinite(likes) ? likes : null,
    comments: Number.isFinite(comments) ? comments : null,
    shares: null,
    saves: null,
    impressions: null,
    mediaType: item.media_type || null,
    collectedAt: new Date().toISOString()
  };
}

async function recentMedia(id) {
  var url = new URL(graphUrl(id + "/recent_media"));
  url.searchParams.set("user_id", process.env.INSTAGRAM_IG_USER_ID);
  url.searchParams.set("fields", "caption,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,timestamp,username");
  url.searchParams.set("limit", String(TREND_CONFIG.limits.igMediaPerTag));
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN);
  var data = await getJson(url);
  return (data.data || [])
    .filter(function (item) { return item.media_type === "VIDEO"; })
    .map(mapMedia);
}

async function fetchPosts(options) {
  if (!hasKey()) return { posts: [], warning: null };
  var tags = (options.queries || TREND_CONFIG.seedHashtags)
    .map(function (q) { return String(q).replace(/\s+/g, "").replace(/^#/, ""); })
    .filter(Boolean)
    .slice(0, TREND_CONFIG.limits.igMaxHashtags);
  try {
    var posts = [];
    var seen = {};
    var failed = 0;
    for (var i = 0; i < tags.length; i++) {
      try {
        var id = await hashtagId(tags[i]);
        if (!id) continue;
        var media = await recentMedia(id);
        media.forEach(function (p) {
          if (seen[p.id]) return;
          seen[p.id] = true;
          posts.push(p);
        });
      } catch (err) {
        failed += 1;
        console.error("[instagram]", err.message);
      }
    }
    if (!posts.length && failed) return { posts: [], warning: "Instagram 데이터 사용 불가" };
    return { posts: posts, warning: null };
  } catch (err) {
    return warn("instagram", err);
  }
}

module.exports = { fetchPosts, hasKey };
