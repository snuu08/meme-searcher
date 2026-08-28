function searchMemes(list, rawQuery) {
  var query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return list.slice();

  return list.filter(function (meme) {
    var haystack = []
      .concat(meme.name || "")
      .concat(meme.oneLineDescription || "")
      .concat(meme.description || "")
      .concat(meme.aliases || [])
      .concat(meme.keywords || [])
      .concat(meme.hashtags || [])
      .join(" ")
      .toLowerCase();
    return haystack.indexOf(query) !== -1;
  });
}
