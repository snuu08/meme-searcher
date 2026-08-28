const { TREND_CONFIG } = require("../config/trendConfig");
const { periodStart, iso, extractHashtags, warn, getJson } = require("./http");

function hasKey() {
  return Boolean(process.env.X_BEARER_TOKEN);
}

function mapTweet(tweet, usersById) {
  var metrics = tweet.public_metrics || {};
  var likes = metrics.like_count != null ? Number(metrics.like_count) : null;
  var replies = metrics.reply_count != null ? Number(metrics.reply_count) : null;
  var reposts = metrics.retweet_count != null ? Number(metrics.retweet_count) : null;
  var quotes = metrics.quote_count != null ? Number(metrics.quote_count) : null;
  var impressions = metrics.impression_count != null ? Number(metrics.impression_count) : null;
  var shares = (reposts != null || quotes != null)
    ? (reposts || 0) + (quotes || 0)
    : null;
  var tags = ((tweet.entities && tweet.entities.hashtags) || []).map(function (h) {
    return String(h.tag || "").toLowerCase();
  });
  var text = tweet.text || "";
  return {
    platform: "x",
    id: tweet.id,
    url: "https://x.com/i/web/status/" + tweet.id,
    title: text.slice(0, 80),
    text: text,
    description: text,
    hashtags: tags.concat(extractHashtags(text)),
    image: null,
    publishedAt: tweet.created_at || iso(Date.now()),
    authorId: tweet.author_id || (usersById[tweet.author_id] && usersById[tweet.author_id].id) || null,
    country: "global",
    views: Number.isFinite(impressions) ? impressions : null,
    likes: Number.isFinite(likes) ? likes : null,
    comments: Number.isFinite(replies) ? replies : null,
    shares: Number.isFinite(shares) ? shares : null,
    saves: metrics.bookmark_count != null ? Number(metrics.bookmark_count) : null,
    impressions: Number.isFinite(impressions) ? impressions : null
  };
}

async function searchQuery(query, period, now) {
  var url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query + " -is:retweet");
  url.searchParams.set("max_results", String(TREND_CONFIG.limits.xMaxResults));
  url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id,entities");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("start_time", iso(periodStart(period, now)));
  var data = await getJson(url, {
    headers: { Authorization: "Bearer " + process.env.X_BEARER_TOKEN }
  });
  var users = {};
  ((data.includes && data.includes.users) || []).forEach(function (u) {
    users[u.id] = u;
  });
  return (data.data || []).map(function (t) { return mapTweet(t, users); });
}

async function fetchPosts(options) {
  if (!hasKey()) return { posts: [], warning: null };
  var period = options.period || "24h";
  var now = options.now || Date.now();
  var queries = options.queries || TREND_CONFIG.seedQueries;
  try {
    var jobs = queries.slice(0, TREND_CONFIG.limits.xMaxQueries).map(function (q) {
      return searchQuery(q, period, now);
    });
    var settled = await Promise.allSettled(jobs);
    var posts = [];
    var seen = {};
    var failed = 0;
    settled.forEach(function (result) {
      if (result.status !== "fulfilled") {
        failed += 1;
        console.error("[x]", result.reason && result.reason.message);
        return;
      }
      result.value.forEach(function (p) {
        if (seen[p.id]) return;
        seen[p.id] = true;
        posts.push(p);
      });
    });
    if (!posts.length && failed) return { posts: [], warning: "X 데이터 사용 불가" };
    return { posts: posts, warning: null };
  } catch (err) {
    return warn("x", err);
  }
}

module.exports = { fetchPosts, hasKey };
