/* Good Life Collective preview — HOME page behaviours (area: home). Builds on window.GL from site.js (loaded first).
   · hero video: right source for the viewport + portrait poster on phones
   · store cards: "Set as my store" calls GL.setStore (no dialog) — site.js highlights [data-store-current] + aria-pressed;
     on phones the store rail scrolls the selected store into view (load + store change)
   · category tiles: counts and data-n (= visible tiles, drives the no-hole grid) follow the selected store
   · weekly deal board: it is Rochester's board, so today's day is lit only while shopping Rochester
   · ON THE MENU: ARIA tabs + rail arrows; rails re-render for the selected store from data/menu-<store>.json with the
     picks home.mjs computed (#home-picks). While a store's menu loads, the previous rails are dimmed and inert, and an
     Add from a card of another store is ignored (it would silently switch the shopper's store)
   · community photo wall: pausable, paused off-screen, static under reduced motion and under the site "Pause motion"
   · "Pause motion" used: entrance effects stay in their final state (.home-settled), so they never replay on resume */
(function () {
  'use strict';
  var GL = window.GL;
  if (!GL) return;
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionOff = function () { return root.classList.contains('motion-off'); };
  var DEF = 'rochester';
  var esc = GL.esc;
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';

  /* ---------- hero video ---------- */
  var v = $('.home-hero__video');
  if (v) {
    var phone = window.matchMedia('(max-width: 767px)').matches;
    var want = phone ? 'hero-loop-portrait.mp4' : 'hero-loop.mp4';
    var pp = v.getAttribute('data-poster-portrait');
    if (phone && pp) v.setAttribute('poster', pp);
    var fixSrc = function () {
      var cur = v.currentSrc || '';
      if (!cur || cur.indexOf(want) >= 0) return;
      var src = $$('source', v).map(function (s) { return s.getAttribute('src'); }).filter(function (s) { return s && s.indexOf(want) >= 0 && (want !== 'hero-loop.mp4' || s.indexOf('portrait') < 0); })[0];
      if (src) { v.src = src; v.load(); }
    };
    if (v.readyState > 0) fixSrc(); else v.addEventListener('loadedmetadata', fixSrc, { once: true });
    /* "Pause motion" already on at load: site.js stopped the video on its first frame, which is black (the loop fades in
       from black), so go back to the poster. load() drops the queued pause event, so re-send it for the video's button.
       "Play motion" starts the video again. */
    if (motionOff()) { v.removeAttribute('autoplay'); v.load(); v.dispatchEvent(new Event('pause')); }
    doc.addEventListener('gl:motion', function (e) {
      if (!e.detail || e.detail.off || reduce || !v.paused) return;
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    });
  }

  /* ---------- store cards ---------- */
  var storesSec = $('[data-home-stores]');
  var storeGrid = storesSec ? $('.home-stores__grid', storesSec) : null;
  if (storesSec) storesSec.addEventListener('click', function (e) {
    var b = e.target.closest('[data-store-pick]');
    if (!b || !storesSec.contains(b)) return;
    var k = b.getAttribute('data-store-pick'); var s = GL.byKey[k];
    if (!s) return;
    if (k !== GL.storeKey()) GL.setStore(k);
    GL.toast('Now shopping Good Life ' + s.city);
    GL.announce('Your store is now Good Life ' + s.city + '.');
  });
  /* phones: the store cards are a sideways rail — bring the selected store's card into view (scrolls the rail only) */
  var phoneMq = window.matchMedia('(max-width: 700px)');
  function revealCurrentStore() {
    if (!storeGrid || !phoneMq.matches) return;
    var cur = $('.home-store.is-current', storeGrid); if (!cur) return;
    var g = storeGrid.getBoundingClientRect(), c = cur.getBoundingClientRect();
    var pad = parseFloat(getComputedStyle(storeGrid).paddingLeft) || 0;
    if (c.left >= g.left + pad - 1 && c.right <= g.right - pad + 1) return; // already fully visible
    storeGrid.scrollLeft += c.left - g.left - pad;
  }

  /* ---------- category tiles: counts + visible-tile count ---------- */
  var catGrid = $('.home-cats__grid');
  function syncCounts() {
    var s = GL.store(); if (!s) return;
    $$('[data-home-count]').forEach(function (el) { el.textContent = (s.counts[el.getAttribute('data-home-count')] || 0).toLocaleString('en-US'); });
    $$('[data-home-word]').forEach(function (el) { el.textContent = (s.counts[el.getAttribute('data-home-word')] === 1) ? ' product' : ' products'; });
    if (catGrid) catGrid.setAttribute('data-n', String($$('.cat-tile', catGrid).filter(function (t) { return !t.hidden; }).length));
  }

  /* ---------- weekly deal board: today (Rochester's board -> America/New_York; lit only while shopping Rochester) ---------- */
  var dealsSec = $('[data-home-deals]');
  var board = $('.home-board');
  var boardStore = (dealsSec && dealsSec.getAttribute('data-board-store')) || DEF;
  var boardCode = (GL.byKey[boardStore] || {}).code || 'ROC';
  var dow = (function () {
    try {
      var wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
    } catch (e) { return new Date().getDay(); }
  })();
  function syncBoard() {
    if (!board) return;
    var here = GL.storeKey() === boardStore;
    $$('.home-board__day', board).forEach(function (d) {
      var today = +d.getAttribute('data-dow') === dow;
      var lit = today && here;
      d.classList.toggle('is-today', lit);
      if (lit) d.setAttribute('aria-current', 'date'); else d.removeAttribute('aria-current');
      var t = $('.home-board__today', d);
      if (t) { t.hidden = !today; t.textContent = here ? 'Today' : 'Today at ' + boardCode; t.classList.toggle('tag--amber', here); }
    });
  }

  /* ---------- ON THE MENU: tabs + rails ---------- */
  var menu = $('[data-home-menu]');
  var tabs = menu ? $$('[role="tab"]', menu) : [];
  var panels = menu ? $$('.home-panel', menu) : [];
  var statusEl = menu ? $('[data-menu-status]', menu) : null;
  var PICKS = {};
  try { var pj = $('#home-picks'); if (pj) PICKS = JSON.parse(pj.textContent) || {}; } catch (e) { PICKS = {}; }
  var defTab = (tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0] || { getAttribute: function () { return null; } }).getAttribute('data-cat');
  var userTab = false;
  function syncRail(panel) {
    var tr = $('[data-rail-track]', panel); if (!tr) return;
    var prev = $('[data-rail-prev]', panel), next = $('[data-rail-next]', panel);
    var max = tr.scrollWidth - tr.clientWidth - 4;
    if (prev) prev.setAttribute('aria-disabled', String(tr.scrollLeft <= 4));
    if (next) next.setAttribute('aria-disabled', String(tr.scrollLeft >= max));
  }
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      var p = doc.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
    var p = doc.getElementById(tab.getAttribute('aria-controls')); if (p) syncRail(p);
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { userTab = true; select(t); });
    t.addEventListener('keydown', function (e) {
      var vis = tabs.filter(function (x) { return !x.hidden; }); var i = vis.indexOf(t); var n = null;
      if (e.key === 'ArrowRight') n = vis[(i + 1) % vis.length];
      else if (e.key === 'ArrowLeft') n = vis[(i - 1 + vis.length) % vis.length];
      else if (e.key === 'Home') n = vis[0];
      else if (e.key === 'End') n = vis[vis.length - 1];
      if (n) { e.preventDefault(); userTab = true; select(n, true); }
    });
  });
  panels.forEach(function (p) {
    var tr = $('[data-rail-track]', p); if (!tr) return;
    tr.addEventListener('scroll', function () { syncRail(p); }, { passive: true });
    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rail-prev], [data-rail-next]'); if (!b) return;
      var dir = b.hasAttribute('data-rail-next') ? 1 : -1;
      tr.scrollBy({ left: dir * Math.max(240, tr.clientWidth * 0.8), behavior: reduce || motionOff() ? 'auto' : 'smooth' });
    });
    syncRail(p);
  });
  window.addEventListener('resize', function () { panels.forEach(syncRail); });

  /* client-side product cards — same markup as kit.mjs pcard() so base.css styles them identically */
  var STRAIN = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid', 'indica-dom': 'Indica-dom', 'sativa-dom': 'Sativa-dom' };
  function card(p, s) {
    var url = GL.u(p.url), img = GL.u(p.im), dark = !!p.dk, fill = !!p.fl;
    var pot = p.thc != null ? 'THC ' + p.thc + '%' : (p.mg != null ? 'THC ' + p.mg + 'mg' : '');
    var strain = (p.c === 'accessories' || p.c === 'merch' || !STRAIN[p.t]) ? '' : '<span class="strain strain--' + esc(p.t) + '">' + STRAIN[p.t] + '</span>';
    var badges = [];
    (p.d || []).forEach(function (d) { badges.push('<span class="tag tag--amber">' + esc(d) + '</span>'); });
    if (p.off) badges.push('<span class="tag tag--amber">' + p.off + '% off</span>');
    badges = badges.filter(function (b, i) { return badges.indexOf(b) === i; }).slice(0, 2);
    var item = { id: p.i, store: s.key, name: p.n, brand: p.b, price: p.p, priceTax: p.pt, img: img, dark: dark, size: p.z || '', url: url };
    var buy = p.p > 0
      ? '<span class="price"><b>' + GL.money(p.p) + '</b><small>' + GL.money(p.pt) + ' with tax</small></span><button type="button" class="add-btn" data-add="' + esc(JSON.stringify(item)) + '" aria-label="Add ' + esc(p.n) + ' to your bag">' + PLUS + 'Add</button>'
      : '<span class="price"><small>Price on the live menu</small></span>';
    return '<article class="pcard" data-pid="' + esc(p.i) + '">' +
      '<a class="pcard__media' + (dark ? ' pcard__media--dark' : '') + (fill ? ' pcard__media--fill' : '') + '" style="background:' + esc(p.bg || '#ffffff') + '" href="' + esc(url) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(img) + '" alt="" width="320" height="320" loading="lazy" decoding="async"><span class="pcard__badges">' + badges.join('') + '</span></a>' +
      '<div class="pcard__body"><p class="pcard__brand">' + esc(p.b || 'Good Life') + '</p>' +
      '<h3 class="pcard__name"><a href="' + esc(url) + '">' + esc(p.n) + '</a></h3>' +
      '<p class="pcard__meta">' + strain + (p.z ? '<span>' + esc(p.z) + '</span>' : '') + (pot ? '<b>' + esc(pot) + '</b>' : '') + '</p>' +
      '<div class="pcard__buy">' + buy + '</div></div></article>';
  }
  /* the store's picks as home.mjs ranked them (own photos first, deals, build-date rotation, one per brand, no repeated
     image). Fallback when the embedded picks are missing: the same order approximated from the menu JSON. */
  function pick(list, cat, key) {
    var ids = PICKS[key] && PICKS[key][cat];
    if (ids && ids.length) {
      var byId = {}; list.forEach(function (p) { byId[p.i] = p; });
      var got = ids.map(function (id) { return byId[id]; }).filter(function (p) { return p && p.p > 0; });
      if (got.length >= Math.min(4, ids.length)) return got;
    }
    var uses = {}; list.forEach(function (p) { uses[p.im] = (uses[p.im] || 0) + 1; });
    var base = list.filter(function (p) { return p.c === cat && p.p > 0 && String(p.url).indexOf('merch-shop/') !== 0; });
    var tier = function (p) { return p.dk ? 2 : (uses[p.im] <= 2 ? 0 : 1); };
    var deal = function (p) { return ((p.d && p.d.length) || p.off > 0) ? 0 : 1; };
    base.sort(function (a, b) { return tier(a) - tier(b) || deal(a) - deal(b); });
    var out = [], brands = {}, imgs = {};
    [0, 1, 2].forEach(function (t) {
      [true, false].forEach(function (one) {
        for (var i = 0; i < base.length && out.length < 8; i++) {
          var p = base[i], b = String(p.b || '').toLowerCase();
          if (tier(p) !== t || out.indexOf(p) >= 0 || (one && brands[b]) || (!p.dk && imgs[p.im])) continue;
          out.push(p); brands[b] = 1; if (!p.dk) imgs[p.im] = 1;
        }
      });
    });
    return out;
  }
  var STATIC = {};
  panels.forEach(function (p) { var tr = $('[data-rail-track]', p); if (tr) STATIC[p.getAttribute('data-cat')] = tr.innerHTML; });
  var cache = {};
  function load(key) {
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetch(GL.u('data/menu-' + key + '.json')).then(function (r) { if (!r.ok) throw new Error('menu ' + r.status); return r.json(); }).then(function (d) { cache[key] = d; return d; });
  }
  var renderedFor = (menu && menu.getAttribute('data-rail-store')) || DEF;
  var req = 0;
  function setState(state, s) {
    if (!menu) return;
    menu.classList.toggle('is-loading', state === 'loading');
    menu.classList.toggle('is-error', state === 'error');
    $$('.home-rail', menu).forEach(function (r) { if (state) r.setAttribute('inert', ''); else r.removeAttribute('inert'); });
    if (state) menu.setAttribute('aria-busy', 'true'); else menu.removeAttribute('aria-busy');
    if (!statusEl) return;
    if (state === 'loading') {
      statusEl.textContent = 'Loading the ' + s.city + ' menu…'; statusEl.setAttribute('aria-hidden', 'true'); statusEl.hidden = false;
    } else if (state === 'error') {
      statusEl.innerHTML = 'The ' + esc(s.city) + ' picks didn’t load. <a href="' + esc(GL.u('location/' + s.slug + '/shop/#menu')) + '">Open the ' + esc(s.city) + ' menu</a>';
      statusEl.removeAttribute('aria-hidden'); statusEl.hidden = false;
      GL.announce('The ' + s.city + ' picks didn’t load. A link to the full ' + s.city + ' menu is above the products.');
    } else { statusEl.textContent = ''; statusEl.hidden = true; }
  }
  function renderMenu() {
    var s = GL.store(); if (!s || !menu) return;
    var first = null, activeGone = false;
    tabs.forEach(function (t) {
      var has = (s.counts[t.getAttribute('data-cat')] || 0) > 0;
      t.hidden = !has;
      if (has && !first) first = t;
      if (!has && t.getAttribute('aria-selected') === 'true') activeGone = true;
    });
    // until the shopper picks a tab, open on the category with the most real product photos at this store
    var bestKey = s.key === DEF ? defTab : (PICKS[s.key] && PICKS[s.key].tab);
    var best = bestKey ? tabs.filter(function (t) { return t.getAttribute('data-cat') === bestKey && !t.hidden; })[0] : null;
    if (!userTab && best) select(best);
    else if (activeGone && first) select(first);
    if (s.key === renderedFor) { req++; setState(null); return; }
    var key = s.key, my = ++req;
    if (key === DEF) {
      panels.forEach(function (p) { var tr = $('[data-rail-track]', p); var c = p.getAttribute('data-cat'); if (tr && STATIC[c] != null) { tr.innerHTML = STATIC[c]; tr.scrollLeft = 0; syncRail(p); } });
      renderedFor = DEF; setState(null); return;
    }
    setState('loading', s);
    load(key).then(function (list) {
      if (my !== req) return; // the shopper switched again meanwhile
      panels.forEach(function (p) {
        var tr = $('[data-rail-track]', p); if (!tr) return;
        var items = pick(list, p.getAttribute('data-cat'), key);
        tr.innerHTML = items.map(function (x) { return card(x, s); }).join('');
        tr.scrollLeft = 0; syncRail(p);
      });
      renderedFor = key;
      setState(null);
    }).catch(function () { if (my === req) setState('error', s); });
  }
  /* never let a card from another store's rail add to the bag (site.js would switch the shopper's store) */
  if (menu) menu.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-add]');
    if (!b || !menu.contains(b)) return;
    var it; try { it = JSON.parse(b.getAttribute('data-add')); } catch (er) { return; }
    if (it && it.store && it.store !== GL.storeKey()) {
      e.preventDefault(); e.stopPropagation();
      var s = GL.store(); if (s) GL.toast('Loading the ' + s.city + ' menu…');
    }
  }, true);

  /* ---------- community photo wall ---------- */
  var wall = $('[data-wall]');
  if (wall) {
    var wb = $('[data-wall-toggle]', wall);
    var wallStopped = false; // the wall's own button; a site-wide motion change resets it
    var syncW = function () {
      var paused = wallStopped || reduce || motionOff();
      wall.classList.toggle('is-paused', paused);
      if (!wb) return;
      wb.setAttribute('aria-pressed', String(paused));
      wb.setAttribute('aria-label', (paused ? 'Play' : 'Pause') + ' the moving photo wall');
      wb.innerHTML = paused ? PLAY : PAUSE;
    };
    syncW();
    if (wb) wb.addEventListener('click', function () { wallStopped = !wallStopped; syncW(); });
    doc.addEventListener('gl:motion', function () { wallStopped = false; syncW(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { wall.classList.toggle('is-off', !es[0].isIntersecting); }, { rootMargin: '120px 0px' }).observe(wall);
  }

  /* ---------- "Pause motion" has been used: entrance effects stay finished (home.css) ---------- */
  var settle = function () { doc.body.classList.add('home-settled'); };
  if (motionOff()) settle();
  doc.addEventListener('gl:motion', settle);

  /* ---------- store changes ---------- */
  doc.addEventListener('gl:store', function () { syncCounts(); syncBoard(); renderMenu(); revealCurrentStore(); });
  syncCounts();
  syncBoard();
  renderMenu();
  revealCurrentStore();
})();
