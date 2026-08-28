function periodStart(period, now) {
  var ms = (period === "7d" ? 7 : 1) * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

function iso(date) {
  return new Date(date).toISOString();
}

function extractHashtags(text) {
  var out = [];
  var re = /#([\p{L}\p{N}_]+)/gu;
  var m;
  while ((m = re.exec(String(text || "")))) {
    out.push(m[1].toLowerCase());
  }
  return out;
}

function warn(platform, err) {
  var message = err && err.message ? err.message : String(err);
  console.error("[" + platform + "]", message);
  return { posts: [], warning: platform + " 데이터 사용 불가" };
}

async function getJson(url, options) {
  var res = await fetch(url, options);
  var body = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    var msg = body.error && (body.error.message || body.error) || body.detail || res.statusText;
    var err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return body;
}

module.exports = { periodStart, iso, extractHashtags, warn, getJson };
