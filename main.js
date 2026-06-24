/* =============================================================
   札幌交通 TODO ── レンダラ (依存ライブラリなし)
   data/issues.json を読み込み、各ページを生成する。
   ページ側の <body data-issue="..." data-base="..."> で
     issue : 表示する検証ID (overview / kiyota / teine ...)
     base  : ルートまでの相対パス (index は "./" / pages は "../")
   を指定する。
   ============================================================= */
(function () {
  "use strict";

  var body = document.body;
  var ISSUE_ID = body.getAttribute("data-issue") || "overview";
  var BASE = body.getAttribute("data-base") || "./";

  // ---- helpers ---------------------------------------------------------
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // 他ページへのリンクを base に応じて解決
  function hrefFor(file) {
    return file; // フラット構成: 全ファイルが同一階層
  }

  function dotsMarkup(level) {
    // critical=3, high=2, mid=1, low=0  /  on/mid/off で塗り分け
    var n = { critical: 3, high: 2, mid: 1, low: 0 }[level];
    if (n == null) n = 0;
    var out = "";
    for (var i = 0; i < 3; i++) {
      var cls = i < n ? (level === "critical" ? "on" : "mid") : "";
      out += '<i class="' + cls + '"></i>';
    }
    return out;
  }

  // ---- fetch -----------------------------------------------------------
  fetch(BASE + "issues.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) { render(data); })
    .catch(function (err) { renderError(err); });

  // ---- render: error ---------------------------------------------------
  function renderError(err) {
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    var s = el("div", "wrap app-state");
    s.appendChild(el("p", "eyebrow", "DATA / 読み込みエラー"));
    var t = el("h1", "section-title", "データを表示できません");
    s.appendChild(t);
    var m = el("div", "app-state__msg prose");
    m.innerHTML =
      "<p>コンテンツ(<code>issues.json</code>)を読み込めませんでした。" +
      "ファイルを直接開く(<code>file://</code>)とブラウザの制約で読み込みに失敗します。</p>" +
      "<p>ローカルで確認するときは、プロジェクト直下で簡易サーバを起動してください:</p>" +
      "<p><code>python -m http.server</code> &nbsp;→&nbsp; <code>http://localhost:8000/</code></p>" +
      "<p style='color:var(--ink-3);font-size:.8rem'>" + esc(String(err)) + "</p>";
    s.appendChild(m);
    app.appendChild(s);
  }

  // ---- render: main ----------------------------------------------------
  function render(data) {
    var site = data.site || {};
    var issues = data.issues || [];
    var indicators = data.indicators || [];
    var levels = data.levels || {};
    var indexById = {};
    indicators.forEach(function (ind) { indexById[ind.id] = ind; });

    var issue = issues.filter(function (x) { return x.id === ISSUE_ID; })[0] || issues[0];
    var isOverview = issue.id === "overview";

    document.title = (isOverview ? site.title : issue.title + " ── " + site.title);

    renderHeader(site, issues, issue);
    var app = document.getElementById("app");
    app.innerHTML = "";

    app.appendChild(buildHero(issue, issues));
    app.appendChild(buildSection("POLICY SUMMARY / 論点整理", "論点整理", buildSummary(issue)));
    app.appendChild(buildSection("INDICATORS / ガバナンス評価指標", "争点度スコアカード", buildScorecard(issue, indicators, indexById, levels)));
    if (issue.comparison) {
      app.appendChild(buildSection("COMPARISON / 比較", issue.comparison.caption, buildTable(issue.comparison), true));
    }
    app.appendChild(buildSection("SOLUTIONS / 解決の方向", "解決の方向", buildSolutions(issue)));

    if (isOverview) {
      app.appendChild(buildSection("CASES / 地域別検証", "地域別検証", buildCaseList(issues)));
    } else {
      app.appendChild(buildSection("NAVIGATE / 他の検証へ", "他の検証へ", buildPager(issues, issue)));
    }

    app.appendChild(buildSection("SOURCES / 出典", "出典一覧", buildSources(issue)));

    renderFooter(site, issue);
    initReveal();
  }

  // ---- header ----------------------------------------------------------
  function renderHeader(site, issues, current) {
    var head = document.getElementById("site-header");
    if (!head) return;
    head.innerHTML = "";
    var inner = el("div", "wrap site-header__inner");

    var brand = el("a", "brand");
    brand.href = hrefFor("index.html");
    brand.appendChild(el("span", "brand__mark", "市"));
    brand.appendChild(el("span", "brand__name", esc(site.title || "札幌交通 TODO")));
    inner.appendChild(brand);

    var nav = el("nav", "nav");
    nav.setAttribute("aria-label", "検証ページ");
    issues.forEach(function (it) {
      var a = el("a");
      a.href = hrefFor(it.file);
      if (it.id === current.id) a.setAttribute("aria-current", "page");
      a.innerHTML = '<span class="num">' + esc(it.no) + '</span>' + esc(shortTitle(it));
      nav.appendChild(a);
    });
    inner.appendChild(nav);
    head.appendChild(inner);
  }

  function shortTitle(it) {
    return it.id === "overview" ? "総論" : it.title;
  }

  // ---- hero ------------------------------------------------------------
  function buildHero(issue, issues) {
    var sec = el("header", "wrap hero reveal");
    var idline = el("div", "hero__id");
    idline.innerHTML = "検証 " + esc(issue.no) +
      (issue.hero && issue.hero.frame ? ' <span class="frame">' + esc(issue.hero.frame) + "</span>" : "");
    sec.appendChild(idline);

    sec.appendChild(el("h1", "hero__title", esc(issue.title)));
    if (issue.subtitle) sec.appendChild(el("p", "hero__sub", esc(issue.subtitle)));
    if (issue.hero && issue.hero.lead) sec.appendChild(el("p", "hero__lead", esc(issue.hero.lead)));

    // transit-line motif: nodes = all cases, active = current
    var line = el("div", "hero__line");
    line.setAttribute("aria-hidden", "true");
    issues.forEach(function (it, i) {
      var node = el("span", "node" + (it.id === issue.id ? " is-active" : ""));
      line.appendChild(node);
      if (i < issues.length - 1) line.appendChild(el("span", "seg"));
    });
    sec.appendChild(line);
    return sec;
  }

  // ---- generic section wrapper ----------------------------------------
  function buildSection(eyebrow, title, contentNode, fullBleedInner) {
    var sec = el("section", "section reveal");
    var w = el("div", "wrap");
    w.appendChild(el("p", "eyebrow", esc(eyebrow)));
    if (title) w.appendChild(el("h2", "section-title", esc(title)));
    w.appendChild(contentNode);
    sec.appendChild(w);
    return sec;
  }

  // ---- policy summary --------------------------------------------------
  function buildSummary(issue) {
    var ul = el("ul", "summary-list");
    (issue.policySummary || []).forEach(function (p) {
      ul.appendChild(el("li", null, esc(p)));
    });
    return ul;
  }

  // ---- scorecard -------------------------------------------------------
  function buildScorecard(issue, indicators, indexById, levels) {
    var box = el("div");

    var head = el("div", "scorecard__head");
    head.appendChild(el("p", "table-caption", "7つの評価軸で、この地域における各論点の争点度を採点する。"));
    var legend = el("div", "legend");
    legend.innerHTML =
      '<span><span class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></span> 決定的</span>' +
      '<span><span class="dots"><i class="mid"></i><i class="mid"></i></span> 重要</span>' +
      '<span><span class="dots"><i class="mid"></i></span> 中</span>' +
      '<span><span class="dots"></span> 低</span>';
    head.appendChild(legend);
    box.appendChild(head);

    var grid = el("div", "indicator-grid");
    var scoreById = {};
    (issue.indicatorScores || []).forEach(function (s) { scoreById[s.ref] = s; });

    indicators.forEach(function (ind) {
      var s = scoreById[ind.id] || { level: "low", note: "" };
      var lvl = levels[s.level] || { label: s.level };
      var cell = el("div", "indicator" + (s.level === "critical" ? " is-critical" : ""));
      var top = el("div", "indicator__top");
      top.innerHTML =
        '<span class="indicator__no">' + esc(ind.no) + "</span>" +
        '<span class="dots">' + dotsMarkup(s.level) + "</span>";
      cell.appendChild(top);
      cell.appendChild(el("div", "indicator__label", esc(ind.label)));
      cell.appendChild(el("div", "indicator__level", esc(lvl.label || s.level)));
      if (s.note) cell.appendChild(el("p", "indicator__note", esc(s.note)));
      grid.appendChild(cell);
    });
    box.appendChild(grid);
    return box;
  }

  // ---- comparison table ------------------------------------------------
  function buildTable(cmp) {
    var scroll = el("div", "table-scroll");
    var table = el("table", "compare");
    var thead = el("thead");
    var trh = el("tr");
    (cmp.columns || []).forEach(function (c) { trh.appendChild(el("th", null, esc(c))); });
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = el("tbody");
    (cmp.rows || []).forEach(function (row) {
      var cells = Array.isArray(row) ? row : row.cells || [];
      var tr = el("tr");
      cells.forEach(function (cell, i) {
        var node = i === 0 ? el("th", null, esc(cell)) : el("td", null, esc(cell));
        if (i === 0) node.setAttribute("scope", "row");
        tr.appendChild(node);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    return scroll;
  }

  // ---- solutions -------------------------------------------------------
  function buildSolutions(issue) {
    var grid = el("div", "solution-grid");
    (issue.solutions || []).forEach(function (s) {
      var card = el("article", "solution-card");
      card.appendChild(el("div", "solution-card__phase", esc(s.phase || "")));
      card.appendChild(el("h3", "solution-card__title", esc(s.title || "")));
      card.appendChild(el("p", "solution-card__body", esc(s.body || "")));
      grid.appendChild(card);
    });
    return grid;
  }

  // ---- case list (overview) -------------------------------------------
  function buildCaseList(issues) {
    var ul = el("ul", "case-list");
    issues.filter(function (x) { return x.id !== "overview"; }).forEach(function (it) {
      var li = el("li");
      var a = el("a");
      a.href = hrefFor(it.file);
      a.innerHTML =
        '<span class="case-node"><span class="no">検証' + esc(it.no) + '</span><span class="dot"></span></span>' +
        '<span class="case-body"><span class="case-body__title">' + esc(it.title) + "</span>" +
        '<span class="case-body__sub">' + esc(it.subtitle || "") + "</span></span>" +
        '<span class="case-arrow">→</span>';
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  // ---- pager (sub-pages) ----------------------------------------------
  function buildPager(issues, current) {
    var order = issues.slice();
    var idx = order.map(function (x) { return x.id; }).indexOf(current.id);
    var prev = order[idx - 1] || order[order.length - 1];
    var next = order[idx + 1] || order[0];
    var box = el("div", "pager");

    var p = el("a", "prev");
    p.href = hrefFor(prev.file);
    p.innerHTML = '<span class="dir">← 検証' + esc(prev.no) + '</span><span class="t">' + esc(shortTitle(prev)) + "</span>";
    box.appendChild(p);

    var n = el("a", "next");
    n.href = hrefFor(next.file);
    n.innerHTML = '<span class="dir">検証' + esc(next.no) + ' →</span><span class="t">' + esc(shortTitle(next)) + "</span>";
    box.appendChild(n);
    return box;
  }

  // ---- sources ---------------------------------------------------------
  function buildSources(issue) {
    var ol = el("ul", "source-list");
    (issue.sources || []).forEach(function (s) {
      var li = el("li");
      var safeUrl = esc(s.url || "");
      if (safeUrl) {
        li.innerHTML =
          '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + "</a>" +
          '<span class="src-url">' + safeUrl + "</span>";
      } else {
        li.innerHTML =
          '<span class="src-noLink">' + esc(s.title || "") + "</span>" +
          '<span class="src-url">未公開資料 ／ 独自研究</span>';
      }
      ol.appendChild(li);
    });
    return ol;
  }

  // ---- footer ----------------------------------------------------------
  function renderFooter(site, issue) {
    var f = document.getElementById("site-footer");
    if (!f) return;
    f.innerHTML = "";
    var inner = el("div", "wrap site-footer__inner");
    var meta = el("div", "meta");
    meta.innerHTML =
      "<b>" + esc(site.title || "") + "</b> ── " + esc(site.subtitle || "") + "<br>" +
      esc(site.author || "") + "<br>" +
      '<span style="color:var(--ink-3)">' + esc(site.repo || "") + "</span>";
    inner.appendChild(meta);

    var upd = el("div", "updated");
    upd.innerHTML = "このページの更新日 &nbsp;<b>" + esc(issue.updated || site.updated || "") + "</b>";
    inner.appendChild(upd);
    f.appendChild(inner);
  }

  // ---- reveal on scroll ------------------------------------------------
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });
  }
})();
