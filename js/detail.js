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

function platformButtons(links) {
  var labels = [
    ["tiktok", "TikTok"],
    ["instagram", "Instagram"],
    ["x", "X"],
    ["youtube", "YouTube"]
  ];
  var html = "";
  for (var i = 0; i < labels.length; i++) {
    var key = labels[i][0];
    var label = labels[i][1];
    var url = links && links[key];
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
    ["x", "X"],
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
    metrics.push("조회 확산속도 " + meme.metrics.viewVelocity);
  }
  if (meme.metrics && meme.metrics.shareRate != null) {
    metrics.push("공유 " + meme.metrics.shareRate);
  }
  if (meme.metrics && meme.metrics.commentRate != null) {
    metrics.push("댓글 참여율 " + meme.metrics.commentRate);
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
