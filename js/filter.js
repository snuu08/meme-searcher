var COUNTRY_LABELS = {
  global: "전체",
  us: "미국",
  china: "중국/중화권",
  korea: "한국",
  japan: "일본"
};

var STATUS_LABELS = {
  all: "전체",
  popular: "인기",
  rising: "급상승",
  new: "신규"
};

var PERIOD_DAYS = {
  "24h": 1,
  "7d": 7
};

function parseDate(value) {
  if (!value) return new Date(0);
  var text = String(value);
  if (text.indexOf("T") !== -1 || text.length > 10) return new Date(text);
  return new Date(text + "T00:00:00");
}

function getTimelineEnd(list) {
  var hasTime = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].createdAt && String(list[i].createdAt).indexOf("T") !== -1) {
      hasTime = true;
      break;
    }
  }
  if (hasTime) return Date.now();
  var latest = 0;
  for (var j = 0; j < list.length; j++) {
    var time = parseDate(list[j].createdAt).getTime();
    if (time > latest) latest = time;
  }
  return latest || Date.now();
}

function isWithinPeriod(createdAt, period, timelineEnd) {
  var days = PERIOD_DAYS[period] || 1;
  var created = parseDate(createdAt).getTime();
  var diffDays = (timelineEnd - created) / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function filterMemes(list, state) {
  var timelineEnd = getTimelineEnd(memes);
  return list.filter(function (meme) {
    var countryOk =
      state.selectedCountry === "global" ||
      (meme.countries && meme.countries.indexOf(state.selectedCountry) !== -1);
    var statusOk =
      state.selectedStatus === "all" ||
      meme.status === state.selectedStatus ||
      (meme.statuses && meme.statuses.indexOf(state.selectedStatus) !== -1);
    var periodOk = isWithinPeriod(meme.createdAt, state.selectedPeriod, timelineEnd);
    return countryOk && statusOk && periodOk;
  });
}

function sortMemes(list) {
  return list.slice().sort(function (a, b) {
    if (b.popularityScore !== a.popularityScore) {
      return b.popularityScore - a.popularityScore;
    }
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}
