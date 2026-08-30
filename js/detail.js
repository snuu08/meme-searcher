function findMemeBySlug(slug) {
  for (var i = 0; i < memes.length; i++) {
    if (memes[i].slug === slug) return memes[i];
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safePlatformUrl(value, forEmbed) {
  if (!value) return "";
  try {
    var url = new URL(value);
    if (url.protocol !== "https:") return "";
    var host = url.hostname.toLowerCase();
    var allowed = ["youtube.com", "youtube-nocookie.com", "tiktok.com", "instagram.com"];
    var trusted = allowed.some(function (domain) {
      return host === domain || host.endsWith("." + domain);
    });
    if (!trusted) return "";
    if (forEmbed && !/youtube|tiktok|instagram/.test(host)) return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function compactNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
}

function videoMetricLine(video) {
  var parts = [];
  if (video.views != null) parts.push("조회 " + compactNumber(video.views));
  if (video.likes != null) parts.push("좋아요 " + compactNumber(video.likes));
  if (video.comments != null) parts.push("댓글 " + compactNumber(video.comments));
  if (video.shares != null) parts.push("공유 " + compactNumber(video.shares));
  return parts.join(" · ");
}

function renderVideoExamples(videos) {
  if (!videos || !videos.length) return "";
  var cards = "";
  for (var i = 0; i < videos.length; i++) {
    var video = videos[i];
    var embedUrl = safePlatformUrl(video.embedUrl, true);
    var pageUrl = safePlatformUrl(video.url, false);
    if (!embedUrl && !pageUrl) continue;
    var platform = video.platform === "tiktok"
      ? "TikTok"
      : video.platform === "instagram"
        ? "Instagram"
        : "YouTube";
    var country = typeof COUNTRY_LABELS !== "undefined" && COUNTRY_LABELS[video.country]
      ? COUNTRY_LABELS[video.country]
      : "글로벌";
    var media = embedUrl
      ? '<iframe class="video-example-frame" src="' + escapeHtml(embedUrl) +
        '" title="' + escapeHtml((video.title || platform) + " 영상") +
        '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
      : '<img class="video-example-image" src="' + escapeHtml(video.image || "") +
        '" alt="' + escapeHtml(video.title || platform) + '">';
    var title = video.title || platform + " 영상";
    var metricLine = videoMetricLine(video);
    cards +=
      '<article class="video-example-card">' +
      '<div class="video-example-media">' + media + "</div>" +
      '<div class="video-example-body">' +
      '<p class="video-example-source">' + escapeHtml(platform + " · " + country) + "</p>" +
      '<h3>' + escapeHtml(title) + "</h3>" +
      (metricLine ? '<p class="video-example-metrics">' + escapeHtml(metricLine) + "</p>" : "") +
      (pageUrl ? '<a href="' + escapeHtml(pageUrl) + '" target="_blank" rel="noopener noreferrer">원본 보기 ↗</a>' : "") +
      "</div></article>";
  }
  if (!cards) return "";
  return '<section class="detail-video-section"><h2>실제 영상 예시</h2><div class="video-example-grid">' + cards + "</div></section>";
}

function platformButtons(links) {
  var labels = [
    ["tiktok", "TikTok"],
    ["instagram", "Instagram"],
    ["youtube", "YouTube"]
  ];
  var html = "";
  for (var i = 0; i < labels.length; i++) {
    var key = labels[i][0];
    var label = labels[i][1];
    var url = safePlatformUrl(links && links[key], false);
    if (!url) continue;
    html +=
      '<a class="platform-btn" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      label +
      "</a>";
  }
  return html;
}

function usageList(items) {
  if (!items || !items.length) return "";
  var html = "<ul>";
  for (var i = 0; i < items.length; i++) {
    html += "<li>" + escapeHtml(items[i]) + "</li>";
  }
  html += "</ul>";
  return html;
}

function platformScoreList(scores) {
  if (!scores) return "";
  var labels = [
    ["tiktok", "TikTok"],
    ["instagram", "Instagram"],
    ["youtube", "YouTube"]
  ];
  var html = "";
  for (var i = 0; i < labels.length; i++) {
    var key = labels[i][0];
    if (scores[key] == null) continue;
    html +=
      "<li>" +
      escapeHtml(labels[i][1]) +
      " " +
      escapeHtml(String(scores[key])) +
      "</li>";
  }
  return html;
}

function statsBlock(meme) {
  if (meme.trendScore == null && !meme.postCount && !meme.platforms) return "";
  var html = '<section class="detail-section detail-stats">';
  if (meme.trendScore != null) {
    html += '<p class="detail-score">Trend Score ' + escapeHtml(String(meme.trendScore)) + "</p>";
  }
  if (meme.status && STATUS_LABELS && STATUS_LABELS[meme.status]) {
    html += "<p>" + escapeHtml(STATUS_LABELS[meme.status]) + "</p>";
  }
  var counts = [];
  if (meme.postCount != null) counts.push("최근 게시물 수 " + meme.postCount);
  if (meme.creatorCount != null) counts.push("사용 계정 수 " + meme.creatorCount);
  if (counts.length) html += "<p>" + escapeHtml(counts.join(" · ")) + "</p>";
  var scores = platformScoreList(meme.platforms);
  if (scores) html += "<ul>" + scores + "</ul>";
  var metrics = [];
  if (meme.metrics && meme.metrics.viewVelocity != null) {
    metrics.push("시간당 조회 증가 " + meme.metrics.viewVelocity);
  }
  if (meme.metrics && meme.metrics.acceleration != null) {
    metrics.push("가속도 " + meme.metrics.acceleration + "배");
  }
  if (meme.metrics && meme.metrics.shareRate != null) {
    metrics.push("공유율 " + meme.metrics.shareRate + "%");
  }
  if (meme.metrics && meme.metrics.commentRate != null) {
    metrics.push("댓글 참여율 " + meme.metrics.commentRate + "%");
  }
  if (meme.crossPlatformScore != null) {
    metrics.push("플랫폼 확산 " + meme.crossPlatformScore);
  }
  if (metrics.length) html += "<p>" + escapeHtml(metrics.join(" · ")) + "</p>";
  html += "</section>";
  return html;
}

function renderDetail(meme) {
  var platforms = platformButtons(meme.platformLinks);
  var platformBlock = platforms
    ? '<section class="detail-platforms">' +
      "  <h2>이 밈을 더 보기</h2>" +
      '  <div class="platform-list">' +
      platforms +
      "</div>" +
      "</section>"
    : "";

  return (
    '<button type="button" class="detail-back" id="detail-back">← 목록으로</button>' +
    '<h1 class="detail-name">' +
    escapeHtml(meme.name) +
    "</h1>" +
    '<figure class="detail-media">' +
    '<img src="' +
    escapeHtml(meme.image) +
    '" alt="' +
    escapeHtml(meme.name) +
    '">' +
    "</figure>" +
    '<p class="detail-one-liner">' +
    escapeHtml(meme.oneLineDescription) +
    "</p>" +
    statsBlock(meme) +
    renderVideoExamples(meme.videos) +
    platformBlock +
    '<section class="detail-section">' +
    "  <h2>이게 뭐야?</h2>" +
    "  <p>" +
    escapeHtml(meme.description) +
    "</p>" +
    "</section>" +
    '<section class="detail-section">' +
    "  <h2>왜 뜨고 있어?</h2>" +
    "  <p>" +
    escapeHtml(meme.whyTrending) +
    "</p>" +
    "</section>" +
    (meme.usage && meme.usage.length
      ? '<section class="detail-section">' +
        "  <h2>어떻게 사용해?</h2>" +
        usageList(meme.usage) +
        "</section>"
      : "")
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    compactNumber: compactNumber,
    renderDetail: renderDetail,
    renderVideoExamples: renderVideoExamples,
    safePlatformUrl: safePlatformUrl
  };
}
