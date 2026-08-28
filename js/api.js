function fetchTrends(state) {
  var params = new URLSearchParams();
  params.set("period", state.selectedPeriod || "24h");
  params.set("country", state.selectedCountry || "global");
  return fetch("/api/trends?" + params.toString())
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.warnings && data.warnings.length) {
        data.warnings.forEach(function (w) { console.warn(w); });
      }
      return data;
    })
    .catch(function (err) {
      console.error("[api/trends]", err && err.message ? err.message : err);
      return null;
    });
}
