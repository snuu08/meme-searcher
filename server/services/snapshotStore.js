const fs = require("fs");
const path = require("path");

var queue = Promise.resolve();

function snapshotPath() {
  return path.resolve(
    process.env.SNAPSHOT_FILE || path.join(__dirname, "../../data/trend-snapshots.json")
  );
}

function finite(value) {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}

function perHour(current, previous, hours) {
  var a = finite(current);
  var b = finite(previous);
  if (a == null || b == null || !Number.isFinite(hours) || hours <= 0) return null;
  return Math.max(0, a - b) / hours;
}

function deriveVelocity(post, previous, now) {
  if (!previous || !previous.collectedAt) return {};
  var hours = (now - new Date(previous.collectedAt).getTime()) / 3600000;
  if (!Number.isFinite(hours) || hours < 0.25) return {};
  return {
    snapshotHours: Math.round(hours * 100) / 100,
    recentViewVelocity: perHour(post.views, previous.views, hours),
    recentLikeVelocity: perHour(post.likes, previous.likes, hours),
    recentCommentVelocity: perHour(post.comments, previous.comments, hours),
    recentShareVelocity: perHour(post.shares, previous.shares, hours),
    recentSaveVelocity: perHour(post.saves, previous.saves, hours)
  };
}

async function readStore(file) {
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("[snapshot read]", err.message);
    return {};
  }
}

async function enrichAndSave(posts, now) {
  now = now || Date.now();
  var file = snapshotPath();
  var store = await readStore(file);
  var cutoff = now - 8 * 24 * 60 * 60 * 1000;

  Object.keys(store).forEach(function (key) {
    if (new Date(store[key].collectedAt).getTime() < cutoff) delete store[key];
  });

  var enriched = posts.map(function (post) {
    var key = post.platform + ":" + post.id;
    var velocity = deriveVelocity(post, store[key], now);
    store[key] = {
      collectedAt: new Date(now).toISOString(),
      views: finite(post.views),
      likes: finite(post.likes),
      comments: finite(post.comments),
      shares: finite(post.shares),
      saves: finite(post.saves)
    };
    return Object.assign({}, post, velocity);
  });

  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  var temp = file + ".tmp";
  await fs.promises.writeFile(temp, JSON.stringify(store), "utf8");
  await fs.promises.rename(temp, file);
  return enriched;
}

function enrichPosts(posts, now) {
  var task = queue.then(function () { return enrichAndSave(posts, now); });
  queue = task.catch(function () {});
  return task;
}

module.exports = { deriveVelocity, enrichPosts, perHour, snapshotPath };
