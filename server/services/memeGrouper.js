const STOP = {
  the: 1, a: 1, an: 1, and: 1, or: 1, of: 1, to: 1, in: 1, on: 1, for: 1,
  with: 1, this: 1, that: 1, meme: 1, viral: 1, video: 1, shorts: 1,
  https: 1, http: 1, www: 1, com: 1, tiktok: 1, instagram: 1, youtube: 1,
  twitter: 1, fyp: 1, trending: 1, official: 1
};

function meaningfulTag(tag) {
  var value = normalizeMemeName(tag);
  return value.length >= 2 && !STOP[value] ? value : "";
}

function normalizeMemeName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/#/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalizeMemeName(text).split(" ").filter(function (t) {
    return t.length >= 2 && !STOP[t];
  });
}

function generateMemeKey(post) {
  var tags = (post.hashtags || [])
    .map(function (t) { return normalizeMemeName(t); })
    .filter(Boolean);
  if (tags.length) return "tag:" + tags[0];
  var kw = tokens(post.title || post.text || post.description || "").slice(0, 3).sort();
  if (kw.length) return "kw:" + kw.join("_");
  return "id:" + post.platform + "_" + post.id;
}

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  var setB = {};
  b.forEach(function (t) { setB[t] = 1; });
  var inter = 0;
  a.forEach(function (t) { if (setB[t]) inter += 1; });
  var union = {};
  a.concat(b).forEach(function (t) { union[t] = 1; });
  return inter / Object.keys(union).length;
}

function postTokens(post) {
  var tagTokens = (post.hashtags || []).map(meaningfulTag).filter(Boolean);
  return tokens((post.title || "") + " " + (post.text || "") + " " + (post.description || "")).concat(tagTokens);
}

function groupSameMemes(posts) {
  var parent = posts.map(function (_, i) { return i; });
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function unite(a, b) {
    var ra = find(a);
    var rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  var tagIndex = {};
  posts.forEach(function (post, i) {
    (post.hashtags || []).forEach(function (tag) {
      var key = meaningfulTag(tag);
      if (!key) return;
      if (!tagIndex[key]) tagIndex[key] = [];
      tagIndex[key].push(i);
    });
  });
  Object.keys(tagIndex).forEach(function (key) {
    var ids = tagIndex[key];
    for (var n = 1; n < ids.length; n++) unite(ids[0], ids[n]);
  });

  var tokenCache = posts.map(postTokens);
  for (var i = 0; i < posts.length; i++) {
    for (var j = i + 1; j < posts.length; j++) {
      if (find(i) === find(j)) continue;
      if (jaccard(tokenCache[i], tokenCache[j]) >= 0.35) unite(i, j);
    }
  }

  var groups = {};
  posts.forEach(function (post, i) {
    var root = find(i);
    if (!groups[root]) groups[root] = [];
    groups[root].push(post);
  });

  return Object.keys(groups).map(function (root) {
    var list = groups[root];
    return {
      key: generateMemeKey(list[0]),
      posts: list
    };
  });
}

function pickName(posts) {
  var counts = {};
  posts.forEach(function (p) {
    (p.hashtags || []).forEach(function (tag) {
      var n = meaningfulTag(tag);
      if (!n) return;
      counts[n] = (counts[n] || 0) + 1;
    });
  });
  var bestTag = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
  if (bestTag) return bestTag;
  var title = posts[0] && (posts[0].title || posts[0].text) || "untitled";
  return title.slice(0, 48).trim() || "untitled";
}

module.exports = {
  normalizeMemeName,
  generateMemeKey,
  groupSameMemes,
  pickName,
  tokens
};
