(function () {
  "use strict";

  var state = {
    selectedCountry: "global",
    selectedStatus: "all",
    selectedPeriod: "24h",
    query: "",
    selectedSlug: null
  };

  var els = {
    grid: document.getElementById("meme-grid"),
    empty: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptySub: document.getElementById("empty-sub"),
    count: document.getElementById("result-count"),
    source: document.getElementById("data-source"),
    browse: document.getElementById("browse-view"),
    detail: document.getElementById("detail-view"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    countryNav: document.getElementById("country-nav"),
    mobileCountries: document.getElementById("mobile-countries"),
    infoDialog: document.getElementById("info-dialog"),
    infoTitle: document.getElementById("info-title"),
    infoBody: document.getElementById("info-body"),
    infoClose: document.getElementById("info-close")
  };

  var INFO_PAGES = {
    about: {
      title: "About",
      body: "Meme Searcher는 지금 어떤 밈이 뜨고 있는지 빠르게 확인하고, 그 밈이 무엇인지 이해하기 위한 탐색 서비스입니다. 국가는 비교 대상이 아니라 필터입니다."
    },
    criteria: {
      title: "밈 선정 기준",
      body: "YouTube·TikTok·Instagram 공식 API에서 제공되는 최근 게시물 지표를 정규화해 Trend Score를 계산합니다. API 권한이 없을 때만 Demo 데이터가 표시됩니다."
    },
    contact: {
      title: "문의",
      body: "MVP 단계에서는 별도의 문의 폼이 없습니다."
    },
    privacy: {
      title: "개인정보처리방침",
      body: "이 데모는 브라우저에서만 동작하며 회원가입·로그인·개인정보를 수집하지 않습니다."
    },
    terms: {
      title: "이용약관",
      body: "Trend Score는 세 플랫폼에서 제공 가능한 조회·반응·확산 지표를 바탕으로 한 참고 점수이며 절대적인 인기도를 의미하지 않습니다."
    }
  };

  var PLATFORM_LABELS = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube: "YouTube"
  };

  function cardMeta(meme) {
    var bits = [];
    if (meme.trendScore != null && meme.trendScore !== "") bits.push("Trend " + meme.trendScore);
    if (meme.representativePlatform) {
      bits.push(PLATFORM_LABELS[meme.representativePlatform] || meme.representativePlatform);
    }
    return bits.join(" · ");
  }

  function getMemeFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("meme");
  }

  function setUrl(slug, replace) {
    var url = new URL(window.location.href);
    if (slug) url.searchParams.set("meme", slug);
    else url.searchParams.delete("meme");
    var method = replace ? "replaceState" : "pushState";
    history[method]({ meme: slug || null }, "", url);
  }

  function syncCountryButtons() {
    var buttons = document.querySelectorAll("[data-country]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-country") === state.selectedCountry;
      buttons[i].classList.toggle("is-active", active);
    }
  }

  function syncStatusButtons() {
    var buttons = document.querySelectorAll("[data-status]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-status") === state.selectedStatus;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function syncPeriodButtons() {
    var buttons = document.querySelectorAll("[data-period]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-period") === state.selectedPeriod;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function statusClass(status) {
    if (status === "rising") return "is-rising";
    if (status === "popular") return "is-popular";
    if (status === "new") return "is-new";
    return "";
  }

  function renderCards(list) {
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var meme = list[i];
      html +=
        '<button type="button" class="meme-card" data-slug="' +
        escapeHtml(meme.slug) +
        '">' +
        '<div class="meme-card-media">' +
        '<img src="' +
        escapeHtml(meme.image) +
        '" alt="' +
        escapeHtml(meme.name) +
        '" width="640" height="640">' +
        "</div>" +
        '<div class="meme-card-body">' +
        '<h2 class="meme-card-name">' +
        escapeHtml(meme.name) +
        "</h2>" +
        '<span class="meme-status ' +
        statusClass(meme.status) +
        '">' +
        escapeHtml(STATUS_LABELS[meme.status] || meme.status) +
        "</span>" +
        (cardMeta(meme)
          ? '<span class="meme-card-meta">' + escapeHtml(cardMeta(meme)) + "</span>"
          : "") +
        "</div>" +
        "</button>";
    }
    els.grid.innerHTML = html;
  }

  function visibleMemes() {
    return sortMemes(filterMemes(memes, state));
  }

  function showEmpty(isSearch) {
    els.grid.hidden = true;
    els.empty.hidden = false;
    if (isSearch) {
      els.emptyTitle.textContent = "검색 결과가 없습니다.";
      els.emptySub.textContent = "다른 키워드로 검색해보세요.";
    } else {
      els.emptyTitle.textContent = "아직 확인된 밈이 없습니다.";
      els.emptySub.textContent = "다른 필터를 선택해보세요.";
    }
  }

  function renderBrowse() {
    var list = visibleMemes();
    els.count.textContent = list.length + "개";
    if (!list.length) {
      els.grid.innerHTML = "";
      showEmpty(Boolean(state.query.trim()));
      return;
    }
    els.empty.hidden = true;
    els.grid.hidden = false;
    renderCards(list);
  }

  function showBrowse() {
    state.selectedSlug = null;
    els.browse.hidden = false;
    els.detail.hidden = true;
    els.detail.innerHTML = "";
    document.title = "Meme Searcher";
    renderBrowse();
  }

  function showDetail(slug, push) {
    var meme = findMemeBySlug(slug);
    if (!meme) {
      showBrowse();
      setUrl(null, true);
      return;
    }
    state.selectedSlug = slug;
    els.browse.hidden = true;
    els.detail.hidden = false;
    els.detail.innerHTML = renderDetail(meme);
    document.title = meme.name + " — Meme Searcher";
    if (push) setUrl(slug, false);
  }

  function openMeme(slug) {
    showDetail(slug, true);
    window.scrollTo(0, 0);
  }

  function loadTrends(after) {
    fetchTrends(state).then(function (data) {
      if (data && Array.isArray(data.memes)) {
        memes = data.memes;
      }
      if (data && els.source) {
        var active = Object.keys(data.platforms || {}).filter(function (key) { return data.platforms[key]; });
        var label = data.source === "demo" ? "Demo 데이터" : active.map(function (key) {
          return PLATFORM_LABELS[key] || key;
        }).join(" · ") + " API";
        var updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString("ko-KR") : "";
        els.source.textContent = label + (updated ? " · " + updated + " 갱신" : "");
      }
      if (after) after();
      else if (state.selectedSlug) showDetail(state.selectedSlug, false);
      else renderBrowse();
    });
  }

  function applyCountry(country) {
    state.selectedCountry = country;
    syncCountryButtons();
    if (state.selectedSlug) {
      setUrl(null, false);
    }
    loadTrends(showBrowse);
  }

  function applyStatus(status) {
    state.selectedStatus = status;
    syncStatusButtons();
    if (!state.selectedSlug) renderBrowse();
  }

  function applyPeriod(period) {
    state.selectedPeriod = period;
    syncPeriodButtons();
    if (state.selectedSlug) {
      setUrl(null, false);
    }
    loadTrends(showBrowse);
  }

  function runSearch(rawQuery) {
    state.query = String(rawQuery || "").trim();
    state.selectedCountry = "global";
    syncCountryButtons();
    if (state.selectedSlug) {
      setUrl(null, false);
    }
    loadTrends(showBrowse);
  }

  function bindEvents() {
    els.mobileCountries.innerHTML = els.countryNav.innerHTML;

    document.addEventListener("click", function (event) {
      var countryBtn = event.target.closest("[data-country]");
      if (countryBtn) {
        applyCountry(countryBtn.getAttribute("data-country"));
        return;
      }

      var statusBtn = event.target.closest("[data-status]");
      if (statusBtn) {
        applyStatus(statusBtn.getAttribute("data-status"));
        return;
      }

      var periodBtn = event.target.closest("[data-period]");
      if (periodBtn) {
        applyPeriod(periodBtn.getAttribute("data-period"));
        return;
      }

      var card = event.target.closest(".meme-card");
      if (card) {
        openMeme(card.getAttribute("data-slug"));
        return;
      }

      if (event.target.closest("#detail-back")) {
        setUrl(null, false);
        showBrowse();
        window.scrollTo(0, 0);
      }
    });

    els.searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      runSearch(els.searchInput.value);
    });

    window.addEventListener("popstate", function () {
      var slug = getMemeFromUrl();
      if (slug) showDetail(slug, false);
      else showBrowse();
    });

    document.querySelectorAll(".footer-nav a").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var key = (link.getAttribute("href") || "").replace("#", "");
        var page = INFO_PAGES[key];
        if (!page || !els.infoDialog) return;
        event.preventDefault();
        els.infoTitle.textContent = page.title;
        els.infoBody.textContent = page.body;
        if (typeof els.infoDialog.showModal === "function") els.infoDialog.showModal();
      });
    });

    if (els.infoClose) {
      els.infoClose.addEventListener("click", function () {
        els.infoDialog.close();
      });
    }
  }

  function init() {
    bindEvents();
    syncCountryButtons();
    syncStatusButtons();
    syncPeriodButtons();
    loadTrends(function () {
      var slug = getMemeFromUrl();
      if (slug) showDetail(slug, false);
      else showBrowse();
    });
  }

  init();
})();
