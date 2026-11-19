/* Good Life preview: LEARN + BLOG behaviour (owner: learn builder). Builds on site.js (window.GL); no dependencies.
   - neon reading-progress line pinned under the sticky header
   - table of contents scroll-spy (desktop sticky list + phone/tablet <details>). A phone/tablet TOC tap folds the list
     FIRST, then scrolls the section to just under the header (jumping first and folding after left the heading hidden).
   - shop rails follow the visitor's store using the build's own per-store picks (real product photos only); a store with
     fewer than 2 photographed products in a category shows the compact button row instead of a rail.
   Nothing here moves on its own: the only scrolling is the one the reader asked for (instant under reduced motion or
   the site-wide "Pause motion"). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var header = $('[data-header]');
  var bar = $('[data-rprog]');
  var art = $('[data-article]');
  var links = $$('[data-toc-link]');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function still() { return reduce || root.classList.contains('motion-off'); }
  var targets = [];
  var seen = {};
  links.forEach(function (a) {
    var id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
    if (!id || seen[id]) return;
    var el = doc.getElementById(id);
    if (el) { seen[id] = 1; targets.push({ id: id, el: el }); }
  });

  function headerBottom() { return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0; }

  var ticking = false, lastActive = null;
  function update() {
    ticking = false;
    var hb = headerBottom();
    var vh = window.innerHeight;
    if (bar && art) {
      bar.style.setProperty('--rp-top', hb + 'px');
      var r = art.getBoundingClientRect();
      var total = r.height - (vh - hb) * 0.6;
      var p = total > 0 ? (hb + 24 - r.top) / total : 0;
      p = Math.max(0, Math.min(1, p));
      bar.firstElementChild.style.setProperty('--p', p.toFixed(4));
    }
    if (targets.length) {
      var line = hb + Math.min(160, vh * 0.25);
      var active = null;
      for (var i = 0; i < targets.length; i++) { if (targets[i].el.getBoundingClientRect().top <= line) active = targets[i].id; }
      if (active !== lastActive) {
        lastActive = active;
        links.forEach(function (a) {
          var on = active && a.getAttribute('href') === '#' + active;
          a.classList.toggle('is-active', !!on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  function focusSection(el) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (er) {}
  }
  /* phone/tablet TOC: fold the open list first (it is 300-500px tall and sits above every section), then land the
     section just under the sticky header, keep the URL hash, and move focus there for keyboard and screen-reader users */
  $$('.toc--mob').forEach(function (d) {
    d.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      var el = id && doc.getElementById(id);
      if (!el) return;
      e.preventDefault();
      d.open = false;
      requestAnimationFrame(function () {
        var y = el.getBoundingClientRect().top + window.pageYOffset - headerBottom() - 16;
        window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: still() ? 'auto' : 'smooth' });
        try { history.replaceState(null, '', '#' + id); } catch (er) {}
        focusSection(el);
      });
    });
  });
  /* desktop TOC: the browser's own anchor jump (scroll-padding keeps it clear of the header); focus follows */
  $$('.toc--desk [data-toc-link]').forEach(function (a) {
    a.addEventListener('click', function () {
      var el = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (el) setTimeout(function () { focusSection(el); }, 30);
    });
  });

  /* ---------- shop rails follow the visitor's store ---------- */
  var rails = $$('[data-rail-picks]');
  var STRAIN = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid', 'indica-dom': 'Indica-dom', 'sativa-dom': 'Sativa-dom' };
  var WEEKLY = {}; try { WEEKLY = JSON.parse((art && art.getAttribute('data-weekly')) || '{}'); } catch (e) {}
  var menuCache = {};
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  /* pcard v2 markup (kit.pcard, docs/REDESIGN-V2.md), same as learn.mjs pcardV2(): one tag at most (the deal, else
     Rochester's weekly-day tag), no tax line, a round + to add; an unbranded item shows its category name */
  function cardHtml(p, s, catName) {
    var G = window.GL, e = G.esc;
    var url = G.u(p.url), img = G.u(p.im);
    var pot = p.thc != null ? 'THC ' + p.thc + '%' : (p.mg != null ? 'THC ' + p.mg + 'mg' : '');
    var tag = '';
    if (p.d && p.d.length) tag = '<span class="tag tag--amber">' + e(p.d[0]) + '</span>';
    else if (p.off) tag = '<span class="tag tag--amber">' + e(p.off) + '% off</span>';
    else (p.wk || []).some(function (k) { var w = WEEKLY[k]; if (w && (p.d || []).indexOf(w) < 0) { tag = '<span class="tag tag--wk">' + e(w) + '</span>'; return true; } return false; });
    var item = { id: p.i, store: s.key, name: p.n, brand: p.b, price: p.p, priceTax: p.pt, img: img, dark: !!p.dk, size: p.z || '', url: url };
    var bg = p.bg || (p.dk ? '#0b1210' : '#ffffff');
    var media = 'pcard__media' + (p.dk ? ' pcard__media--dark' : '') + (p.fl || p.dk ? ' pcard__media--fill' : '');
    var strain = p.c === 'accessories' || !STRAIN[p.t] ? '' : '<span class="strain strain--' + e(p.t) + '">' + STRAIN[p.t] + '</span>';
    return '<article class="pcard" data-pid="' + e(p.i) + '">' +
      '<div class="pcard__frame"><a class="' + media + '" style="background:' + e(bg) + '" href="' + e(url) + '" tabindex="-1" aria-hidden="true"><img src="' + e(img) + '" alt="" width="320" height="320" loading="lazy" decoding="async"><span class="pcard__badges">' + tag + '</span></a>' +
      (p.p > 0 ? '<button type="button" class="add-btn pcard__add" data-add="' + e(JSON.stringify(item)) + '" aria-label="Add ' + e(p.n) + ' to your bag">' + PLUS + '</button>' : '') + '</div>' +
      '<div class="pcard__body"><p class="pcard__brand">' + e(p.b || catName || '') + '</p><h3 class="pcard__name"><a href="' + e(url) + '">' + e(p.n) + '</a></h3>' +
      '<p class="pcard__meta">' + strain + (pot ? '<span>' + e(pot) + '</span>' : '') + (p.z ? '<span>' + e(p.z) + '</span>' : '') + '</p>' +
      '<p class="price">' + (p.p > 0 ? '<b>' + G.money(p.p) + '</b>' : '<small>Price on the live menu</small>') + '</p></div></article>';
  }
  function blockOf(rail) { return rail.closest('[data-shopblk]'); }
  function setSolo(rail, on) {
    var blk = blockOf(rail), note = blk && blk.querySelector('[data-rail-note]');
    rail.hidden = on;
    if (note) note.hidden = on;
    if (blk) blk.classList.toggle('is-solo', on);
    if (on) rail.setAttribute('data-n', '0');
  }
  /* the rail fades out at its right edge while there is more to drag; the fade goes once the end is in view */
  function edge(rail) { rail.classList.toggle('is-end', rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4); }
  $$('.shopblk__rail').forEach(function (rail) {
    rail.addEventListener('scroll', function () { edge(rail); }, { passive: true });
    edge(rail);
  });
  window.addEventListener('resize', function () { $$('.shopblk__rail').forEach(edge); });
  function syncRails() {
    var G = window.GL; if (!G || !rails.length) return;
    var s = G.store(); if (!s) return;
    var key = s.key, need = [];
    rails.forEach(function (rail) {
      if (rail.getAttribute('data-rail-store') === key) return;
      var picks = [];
      try { picks = JSON.parse(rail.getAttribute('data-rail-picks') || '{}')[key] || []; } catch (e) {}
      if (picks.length < 2) { rail.setAttribute('data-rail-store', key); setSolo(rail, true); return; }
      need.push({ rail: rail, picks: picks });
    });
    if (!need.length) return;
    var load = menuCache[key] || (menuCache[key] = fetch(G.u('data/menu-' + key + '.json')).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }));
    load.then(function (list) {
      if (G.store().key !== key) return;
      var byId = {};
      list.forEach(function (p) { byId[p.i] = p; });
      need.forEach(function (x) {
        var rail = x.rail;
        var items = x.picks.map(function (id) { return byId[id]; }).filter(Boolean);
        if (items.length < 2) items = [];
        rail.setAttribute('data-rail-store', key);
        if (!items.length) { setSolo(rail, true); return; }
        rail.innerHTML = items.map(function (p) { return cardHtml(p, s, rail.getAttribute('data-rail-name')); }).join('');
        rail.setAttribute('data-n', String(items.length));
        rail.scrollLeft = 0;
        setSolo(rail, false);
        edge(rail);
        var blk = blockOf(rail), note = blk && blk.querySelector('[data-rail-note]');
        var cat = rail.getAttribute('data-rail-cat');
        if (note) note.textContent = 'From the ' + s.city + ' menu · ' + (s.counts[cat] || items.length).toLocaleString() + ' in ' + String(rail.getAttribute('data-rail-name') || cat).toLowerCase() + ' · prices before tax';
      });
    }).catch(function () { menuCache[key] = null; });
  }
  doc.addEventListener('gl:store', syncRails);
  syncRails();

  update();
  window.addEventListener('load', update);
})();
