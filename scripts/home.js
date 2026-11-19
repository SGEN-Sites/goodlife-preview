/* Good Life Collective preview: HOME page behaviours (area: home), v2. Builds on window.GL from site.js (loaded first).
   · hero video: right source for the viewport (portrait file at 760px and below) + portrait poster on phones
   · stores: on phones the store rail scrolls the selected store's tile into view (the rail scrolls, the page does not);
     "My store" buttons are handled by site.js ([data-store-pick])
   · category index: hovering / focusing a word lights its photo; while nobody points at it the index walks itself
   · weekly deals: one big day at a time, opens on today, auto-advances (progress line), tap any day to jump, swipe on
     phones, pause button; today is lit only while shopping Rochester (it is Rochester's board)
   · ON THE MENU: ARIA tabs + draggable rails; rails re-render for the selected store from data/menu-<store>.json with the
     picks home.mjs computed (#home-picks). While a store's menu loads, the previous rails are dimmed and inert, and an
     Add from a card of another store is ignored (it would silently switch the shopper's store)
   · story photo rows: pausable, paused off-screen, static under reduced motion and under the site "Pause motion"
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
  var still = function () { return reduce || motionOff(); };
  var DEF = 'rochester';
  var esc = GL.esc;
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
  var seen = function (el, cb, opts) { if (!el) return; if (!('IntersectionObserver' in window)) { cb(true); return; } new IntersectionObserver(function (es) { cb(es[0].isIntersecting); }, opts || { threshold: 0.25 }).observe(el); };

  /* ---------- hero video ---------- */
  var v = $('.home-hero__video');
  if (v) {
    var phone = window.matchMedia('(max-width: 760px)').matches;
    var want = phone ? 'hero-v2-portrait.mp4' : 'hero-v2.mp4';
    var pp = v.getAttribute('data-poster-portrait');
    if (phone && pp) v.setAttribute('poster', pp);
    var fixSrc = function () {
      var cur = v.currentSrc || '';
      if (!cur || cur.indexOf(want) >= 0) return;
      var src = $$('source', v).map(function (s) { return s.getAttribute('src'); }).filter(function (s) { return s && s.indexOf(want) >= 0 && (phone || s.indexOf('portrait') < 0); })[0];
      if (src) { v.src = src; v.load(); }
    };
    if (v.readyState > 0) fixSrc(); else v.addEventListener('loadedmetadata', fixSrc, { once: true });
    /* "Pause motion" already on at load: site.js stopped the video on its first frame; go back to the poster.
       load() drops the queued pause event, so re-send it for the video's button. "Play motion" starts it again. */
    if (motionOff()) { v.removeAttribute('autoplay'); v.load(); v.dispatchEvent(new Event('pause')); }
    doc.addEventListener('gl:motion', function (e) {
      if (!e.detail || e.detail.off || reduce || !v.paused) return;
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    });
  }

  /* ---------- stores: phones bring the selected store's tile into view inside its rail ---------- */
  var sRail = $('.home-stores__rail');
  var railMq = window.matchMedia('(max-width: 900px)');
  function revealCurrentStore() {
    if (!sRail || !railMq.matches) return;
    var cur = $('.home-stile.is-current', sRail); if (!cur) return;
    var g = sRail.getBoundingClientRect(), c = cur.getBoundingClientRect();
    var pad = parseFloat(getComputedStyle(sRail).paddingLeft) || 0;
    if (c.left >= g.left + pad - 1 && c.right <= g.right + 1) return; // already fully visible
    sRail.scrollLeft += c.left - g.left - pad;
  }

  /* ---------- category index: the hovered / focused word lights its photo; idle, it walks itself ---------- */
  var cats = $('[data-home-cats]');
  var showCat = function () {};
  var catKey = 'all';
  if (cats) {
    var shots = $$('.home-cats__shot', cats), links = $$('.home-cat', cats), list = $('.home-cats__list', cats);
    var catUser = false, catVis = false, catTimer = 0;
    showCat = function (k) {
      catKey = k;
      shots.forEach(function (s) { s.classList.toggle('is-on', s.getAttribute('data-shot') === k); });
      links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('data-cat-key') === k); });
    };
    links.forEach(function (a) {
      var k = a.getAttribute('data-cat-key');
      a.addEventListener('pointerenter', function () { catUser = true; showCat(k); });
      a.addEventListener('focus', function () { catUser = true; showCat(k); });
    });
    if (list) list.addEventListener('pointerleave', function () { catUser = false; });
    var catTick = function () {
      clearTimeout(catTimer);
      catTimer = setTimeout(function () {
        if (!catUser && catVis && !still() && !doc.hidden) {
          var vis = links.filter(function (a) { return !a.hidden; });
          var i = vis.map(function (a) { return a.getAttribute('data-cat-key'); }).indexOf(catKey);
          var nx = vis[(i + 1) % vis.length]; if (nx) showCat(nx.getAttribute('data-cat-key'));
        }
        catTick();
      }, 2400);
    };
    seen(cats, function (on) { catVis = on; }, { threshold: 0.3 });
    showCat('all');
    catTick();
  }

  /* ---------- weekly deals: one big day at a time ---------- */
  var deals = $('[data-home-deals]');
  var syncToday = function () {};
  if (deals) {
    var dTabs = $$('.home-deals__day', deals), dPanels = $$('.home-deal', deals), dShots = $$('.home-deals__shot', deals);
    var dBtn = $('[data-deals-toggle]', deals), dShow = $('[data-deals-show]', deals), dMedia = $('.home-deals__media', deals);
    var boardStore = deals.getAttribute('data-board-store') || DEF;
    var dIdx = 0, dStopped = false, dVis = false, dHover = false;
    var dow = (function () {
      try {
        var wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
      } catch (e) { return new Date().getDay(); }
    })();
    var autoOn = function () { return !dStopped && !still(); };
    var hold = function () { deals.classList.toggle('is-hold', !dVis || dHover || doc.hidden); };
    var runBar = function () {
      $$('.home-deals__prog', deals).forEach(function (p) { p.classList.remove('run'); });
      var p = dTabs[dIdx] && $('.home-deals__prog', dTabs[dIdx]);
      if (p && autoOn()) { void p.offsetWidth; p.classList.add('run'); }
    };
    var syncBtn = function () {
      if (!dBtn) return;
      var p = !autoOn();
      dBtn.hidden = still();
      dBtn.setAttribute('aria-pressed', String(p));
      dBtn.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' the deal slideshow');
      dBtn.innerHTML = p ? PLAY : PAUSE;
    };
    var show = function (i, focus) {
      dIdx = (i + dTabs.length) % dTabs.length;
      var d = dTabs[dIdx].getAttribute('data-dow');
      dTabs.forEach(function (t, j) { var on = j === dIdx; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      dPanels.forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-dow') === d); });
      dShots.forEach(function (s) { s.classList.toggle('is-on', s.getAttribute('data-dow') === d); });
      if (focus) dTabs[dIdx].focus();
      runBar();
    };
    var userPick = function (i, focus) { dStopped = true; if (dShow) dShow.setAttribute('aria-live', 'polite'); show(i, focus); syncBtn(); };
    syncToday = function () {
      var here = GL.storeKey() === boardStore;
      dTabs.forEach(function (t) {
        var today = +t.getAttribute('data-dow') === dow && here;
        t.classList.toggle('is-today', today);
        var lab = $('.home-deals__today', t); if (lab) lab.hidden = !today;
      });
    };
    deals.classList.add('is-live');
    dTabs.forEach(function (t, i) {
      t.addEventListener('click', function () { userPick(i); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = i + 1; else if (e.key === 'ArrowLeft') n = i - 1; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = dTabs.length - 1;
        if (n != null) { e.preventDefault(); userPick(n, true); }
      });
    });
    // the progress line drives the slideshow: when it fills, the next day comes in (paused off-screen / on hover)
    deals.addEventListener('animationend', function (e) { if (e.target.classList && e.target.classList.contains('run') && autoOn()) show(dIdx + 1); });
    if (dBtn) dBtn.addEventListener('click', function () { dStopped = !dStopped; if (dShow) dShow.setAttribute('aria-live', dStopped ? 'polite' : 'off'); syncBtn(); runBar(); });
    if (dMedia) dMedia.addEventListener('click', function () { userPick(dIdx + 1); });
    var sx = null, sy = 0;
    var grid = $('.home-deals__grid', deals);
    if (grid) {
      grid.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      grid.addEventListener('touchend', function (e) {
        if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && !e.target.closest('a, [role="tab"]')) userPick(dIdx + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
    deals.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { dHover = true; hold(); } });
    deals.addEventListener('pointerleave', function () { dHover = false; hold(); });
    deals.addEventListener('focusin', function () { dHover = true; hold(); });
    deals.addEventListener('focusout', function (e) { if (!deals.contains(e.relatedTarget)) { dHover = false; hold(); } });
    doc.addEventListener('visibilitychange', hold);
    seen(deals, function (on) { dVis = on; hold(); }, { threshold: 0.35 });
    doc.addEventListener('gl:motion', function () { syncBtn(); runBar(); });
    if (dShow) dShow.setAttribute('aria-live', 'off');
    syncToday();
    var start = dTabs.map(function (t) { return +t.getAttribute('data-dow'); }).indexOf(dow);
    hold();
    show(start < 0 ? 0 : start);
    syncBtn();
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
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      var p = doc.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
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

  /* client-side product cards: exactly kit.mjs pcard() v2 markup (docs/REDESIGN-V2.md) so base.css styles them identically */
  var STRAIN = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid', 'indica-dom': 'Indica-dom', 'sativa-dom': 'Sativa-dom' };
  function card(p, s) {
    var url = GL.u(p.url), img = GL.u(p.im), dark = !!p.dk, fill = !!p.fl;
    var pot = p.thc != null ? 'THC ' + p.thc + '%' : (p.mg != null ? 'THC ' + p.mg + 'mg' : '');
    var strain = (p.c === 'accessories' || p.c === 'merch' || !STRAIN[p.t]) ? '' : '<span class="strain strain--' + esc(p.t) + '">' + STRAIN[p.t] + '</span>';
    var badges = [];
    (p.d || []).forEach(function (d) { badges.push('<span class="tag tag--amber">' + esc(d) + '</span>'); });
    if (p.off) badges.push('<span class="tag tag--amber">' + p.off + '% off</span>');
    badges = badges.filter(function (b, i) { return badges.indexOf(b) === i; }).slice(0, 1);
    var item = { id: p.i, store: s.key, name: p.n, brand: p.b, price: p.p, priceTax: p.pt, img: img, dark: dark, size: p.z || '', url: url };
    return '<article class="pcard" data-pid="' + esc(p.i) + '">' +
      '<div class="pcard__frame">' +
        '<a class="pcard__media' + (dark ? ' pcard__media--dark' : '') + (fill ? ' pcard__media--fill' : '') + '" style="background:' + esc(p.bg || '#ffffff') + '" href="' + esc(url) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(img) + '" alt="" width="320" height="320" loading="lazy" decoding="async"><span class="pcard__badges">' + badges.join('') + '</span></a>' +
        (p.p > 0 ? '<button type="button" class="add-btn pcard__add" data-add="' + esc(JSON.stringify(item)) + '" aria-label="Add ' + esc(p.n) + ' to your bag">' + PLUS + '</button>' : '') +
      '</div>' +
      '<div class="pcard__body"><p class="pcard__brand">' + esc(p.b || 'Good Life') + '</p>' +
        '<h3 class="pcard__name"><a href="' + esc(url) + '">' + esc(p.n) + '</a></h3>' +
        '<p class="pcard__meta">' + strain + (pot ? '<span>' + esc(pot) + '</span>' : '') + (p.z ? '<span>' + esc(p.z) + '</span>' : '') + '</p>' +
        '<p class="price">' + (p.p > 0 ? '<b>' + GL.money(p.p) + '</b>' : '<small>Price on the live menu</small>') + '</p>' +
      '</div></article>';
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
        for (var i = 0; i < base.length && out.length < 10; i++) {
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
      panels.forEach(function (p) { var tr = $('[data-rail-track]', p); var c = p.getAttribute('data-cat'); if (tr && STATIC[c] != null) { tr.innerHTML = STATIC[c]; tr.scrollLeft = 0; } });
      renderedFor = DEF; setState(null); return;
    }
    setState('loading', s);
    load(key).then(function (list) {
      if (my !== req) return; // the shopper switched again meanwhile
      panels.forEach(function (p) {
        var tr = $('[data-rail-track]', p); if (!tr) return;
        var items = pick(list, p.getAttribute('data-cat'), key);
        tr.innerHTML = items.map(function (x) { return card(x, s); }).join('');
        tr.scrollLeft = 0;
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

  /* ---------- story: gliding photo rows (pausable; paused off-screen) ---------- */
  var rows = $('[data-rows]');
  if (rows) {
    var rb = $('[data-rows-toggle]', rows);
    var rowsStopped = false; // the rows' own button; a site-wide motion change resets it
    var syncR = function () {
      var paused = rowsStopped || still();
      rows.classList.toggle('is-paused', paused);
      if (!rb) return;
      rb.hidden = still();
      rb.setAttribute('aria-pressed', String(paused));
      rb.setAttribute('aria-label', (paused ? 'Play' : 'Pause') + ' the moving photos');
      rb.innerHTML = paused ? PLAY : PAUSE;
    };
    syncR();
    if (rb) rb.addEventListener('click', function () { rowsStopped = !rowsStopped; syncR(); });
    doc.addEventListener('gl:motion', function () { rowsStopped = false; syncR(); });
    seen(rows, function (on) { rows.classList.toggle('is-off', !on); }, { rootMargin: '120px 0px' });
  }

  /* ---------- "Pause motion" has been used: entrance effects stay finished (home.css) ---------- */
  var settle = function () { doc.body.classList.add('home-settled'); };
  if (motionOff()) settle();
  doc.addEventListener('gl:motion', settle);

  /* ---------- store changes ---------- */
  doc.addEventListener('gl:store', function () {
    syncToday(); renderMenu(); revealCurrentStore();
    var on = cats && $('.home-cat[data-cat-key="' + catKey + '"]', cats);
    if (on && on.hidden) showCat('all');
  });
  renderMenu();
  revealCurrentStore();
})();
