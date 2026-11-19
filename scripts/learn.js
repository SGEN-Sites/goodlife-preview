/* Good Life preview — LEARN + BLOG behaviour (owner: learn builder). Builds on site.js (window.GL); no dependencies.
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
  /* same markup as learn.mjs mini(): deal tag (amber) first, then Rochester's weekly-day tag (mint), at most two;
     an unbranded item shows its category name */
  function miniHtml(p, s, catName) {
    var G = window.GL, e = G.esc;
    var url = G.u(p.url), img = G.u(p.im);
    var pot = p.thc != null ? 'THC ' + p.thc + '%' : (p.mg != null ? 'THC ' + p.mg + 'mg' : '');
    var tags = [];
    if (p.d && p.d.length) tags.push('<span class="tag tag--amber">' + e(p.d[0]) + '</span>');
    else if (p.off) tags.push('<span class="tag tag--amber">' + e(p.off) + '% off</span>');
    (p.wk || []).forEach(function (k) { var w = WEEKLY[k]; if (w && tags.length < 2 && (p.d || []).indexOf(w) < 0) tags.push('<span class="tag tag--wk">' + e(w) + '</span>'); });
    var item = { id: p.i, store: s.key, name: p.n, brand: p.b, price: p.p, priceTax: p.pt, img: img, dark: !!p.dk, size: p.z || '', url: url };
    var plate = p.bg || '#ffffff';
    return '<article class="mini"><a class="mini__img' + (p.fl ? ' is-fill' : '') + (plate === '#ffffff' ? ' plate-studio' : '') + '" style="background:' + e(plate) + '" href="' + e(url) + '" tabindex="-1" aria-hidden="true"><img src="' + e(img) + '" alt="" width="240" height="240" loading="lazy" decoding="async"></a>' +
      '<div class="mini__body"><p class="mini__brand">' + e(p.b || catName || '') + '</p><p class="mini__name"><a href="' + e(url) + '">' + e(p.n) + '</a></p><p class="mini__meta">' +
      (p.c === 'accessories' || !STRAIN[p.t] ? '' : '<span class="strain strain--' + e(p.t) + '">' + STRAIN[p.t] + '</span>') + (p.z ? '<span>' + e(p.z) + '</span>' : '') + (pot ? '<b>' + e(pot) + '</b>' : '') + '</p>' +
      (tags.length ? '<div class="mini__badges">' + tags.join('') + '</div>' : '') + '</div>' +
      '<div class="mini__buy"><span class="price"><b>' + G.money(p.p) + '</b><small>' + G.money(p.pt) + ' with tax</small></span><button type="button" class="add-btn" data-add="' + e(JSON.stringify(item)) + '" aria-label="Add ' + e(p.n) + ' to your bag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add</button></div></article>';
  }
  function blockOf(rail) { return rail.closest('[data-shopblk]'); }
  function setSolo(rail, on) {
    var blk = blockOf(rail), note = blk && blk.querySelector('[data-rail-note]');
    rail.hidden = on;
    if (note) note.hidden = on;
    if (blk) blk.classList.toggle('is-solo', on);
    if (on) rail.setAttribute('data-n', '0');
  }
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
        items = items.length >= 4 ? items.slice(0, 4) : items.length >= 2 ? items.slice(0, 2) : [];
        rail.setAttribute('data-rail-store', key);
        if (!items.length) { setSolo(rail, true); return; }
        rail.innerHTML = items.map(function (p) { return miniHtml(p, s, rail.getAttribute('data-rail-name')); }).join('');
        rail.setAttribute('data-n', String(items.length));
        setSolo(rail, false);
        var blk = blockOf(rail), note = blk && blk.querySelector('[data-rail-note]');
        var cat = rail.getAttribute('data-rail-cat');
        if (note) note.innerHTML = '<span class="code-tag"><b>' + G.esc(s.code) + '</b>' + G.esc(s.area) + '</span>From the ' + G.esc(s.city) + ' menu · ' + (s.counts[cat] || items.length).toLocaleString() + ' in ' + G.esc(rail.getAttribute('data-rail-name') || cat) + ' · prices before tax and with tax';
      });
    }).catch(function () { delete menuCache[key]; });
  }
  doc.addEventListener('gl:store', syncRails);
  syncRails();

  update();
  window.addEventListener('load', update);
})();
