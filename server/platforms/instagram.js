const { TREND_CONFIG } = require("../config/trendConfig");
const { extractHashtags, warn, getJson } = require("./http");

function hasKey() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_IG_USER_ID);
}

async function hashtagId(tag) {
  var url = new URL("https://graph.facebook.com/v21.0/ig_hashtag_search");
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
    title: caption.slice(0, 80),
    text: caption,
    description: caption,
    hashtags: extractHashtags(caption),
    image: item.media_url || null,
    publishedAt: item.timestamp || new Date().toISOString(),
    authorId: null,
    country: "global",
    views: null,
    likes: Number.isFinite(likes) ? likes : null,
    comments: Number.isFinite(comments) ? comments : null,
    shares: null,
    saves: null,
    impressions: null
  };
}

async function recentMedia(id) {
  var url = new URL("https://graph.facebook.com/v21.0/" + id + "/recent_media");
  url.searchParams.set("user_id", process.env.INSTAGRAM_IG_USER_ID);
  url.searchParams.set("fields", "caption,like_count,comments_count,media_type,media_url,permalink,timestamp");
  url.searchParams.set("limit", String(TREND_CONFIG.limits.igMediaPerTag));
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN);
  var data = await getJson(url);
  return (data.data || []).map(mapMedia);
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
