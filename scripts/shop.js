/* Good Life Collective preview — SHOP MENUS runtime (shop-menus builder). Builds on window.GL from site.js.
   · The menu engine: every product grid ([data-menu]) loads data/menu-<store>.json, then filters / sorts / searches /
     pages client-side with the URL kept in sync (history.replaceState) so deep links, reloads and Back work.
   · Page bits: /shop/ store switcher, brand-page store chips, brands A–Z filter + folding letters, feelings tiles,
     deals "today" (card + rail order), the Rochester weekly board's lit column.
   · No JS-driven motion lives here (no rAF loops, auto-scrollers or carousels); smooth scrolling is skipped when the
     visitor asked for reduced motion or pressed the site's "Pause motion" (html.motion-off). */
(function () {
  'use strict';
  var GL = window.GL; if (!GL) return;
  var doc = document, body = doc.body, root = doc.documentElement;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function calm() { return reduce || root.classList.contains('motion-off'); }
  var esc = GL.esc;
  function nf(n) { return Number(n).toLocaleString('en-US'); }
  function plural(n, one, many) { return nf(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9.%]+/g, ' ').trim(); }
  function money(n) { return n == null || isNaN(n) ? '' : '$' + Number(n).toFixed(2); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function lower(s) { return String(s).toLowerCase(); }
  /* FNV-1a 32-bit — same function as shop.mjs (menu-JSON alignment check) */
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  var navType = ''; try { navType = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}

  /* ---------- build-time data from shop.mjs (#shop-data): brand spellings, no-strain bitsets, placeholder photos ---------- */
  var SD = {}; try { var sdEl = $('#shop-data'); if (sdEl) SD = JSON.parse(sdEl.textContent); } catch (e) {}
  var BA = SD.ba || {}, BN = SD.bn || {}, BAD = {};
  (SD.bad || []).forEach(function (id) { BAD[id] = 1; });
  function looseB(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/ (co|llc|inc|company)$/, '').replace(/ /g, ''); }
  function normB(s) { var k = looseB(s); return BA[k] || k; }

  /* ---------- day of week in Rochester (the weekly board is Rochester's) ---------- */
  function dowIn(tz) { try { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date())); } catch (e) { return new Date().getDay(); } }
  var rocDow = dowIn('America/New_York');
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var TODAY = DAYS[rocDow];

  /* ================================ the menu engine ================================ */
  var ORDER = ['flower', 'pre-rolls', 'vapes', 'edibles', 'concentrates', 'beverages', 'tinctures', 'topicals', 'cbd', 'accessories'];
  var CAT_NAME = { flower: 'Flower', 'pre-rolls': 'Pre-Rolls', vapes: 'Vapes', edibles: 'Edibles', concentrates: 'Concentrates', beverages: 'Beverages', tinctures: 'Tinctures', topicals: 'Topicals', cbd: 'CBD', accessories: 'Accessories', merch: 'Good Life merch', other: 'Other' };
  /* Good Life's category stills (cat-<img>-360); unknown categories use the kit's default photo */
  var CAT_IMG = { flower: 'flower', 'pre-rolls': 'preroll', vapes: 'vapes', edibles: 'edibles', concentrates: 'concentrates', beverages: 'drinks', tinctures: 'tinctures', topicals: 'topicals', cbd: 'cbd', accessories: 'accessories' };
  function stillPath(cat) { return CAT_IMG[cat] ? 'assets/img/cat/cat-' + CAT_IMG[cat] + '-360.webp' : 'assets/img/live/product-default.webp'; }
  var STRAINS = [['sativa', 'Sativa'], ['sativa-dom', 'Sativa-dominant'], ['hybrid', 'Hybrid'], ['indica-dom', 'Indica-dominant'], ['indica', 'Indica']];
  var STRAIN_ALIAS = { 'sativa-dominant': 'sativa-dom', 'indica-dominant': 'indica-dom' };
  var STRAIN_LABEL = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid', 'indica-dom': 'Indica-dom', 'sativa-dom': 'Sativa-dom' };
  var VAPES = [['aio', 'Disposable / AIO'], ['510', 'Cartridge / 510']];
  var SORTS = ['featured', 'price-asc', 'price-desc', 'thc-desc', 'thc-asc', 'az'];
  var PER = 48;
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var XS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  /* weekly deal names by day (from the catalogs, same on every engine) and the reverse: "doobie tuesday" -> "tuesday" */
  var W0 = {}; try { var m0 = $('[data-menu]'); if (m0) W0 = JSON.parse(m0.getAttribute('data-weekly') || '{}'); } catch (e) {}
  var WDAY = {}; Object.keys(W0).forEach(function (d) { WDAY[lower(W0[d])] = d; });

  var cache = {};
  function load(key) {
    if (!cache[key]) {
      cache[key] = fetch(GL.u('data/menu-' + key + '.json'), { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('menu ' + r.status); return r.json(); })
        .then(function (list) { return prep(list, key); })
        .catch(function (e) { delete cache[key]; throw e; });
    }
    return cache[key];
  }
  /* products with no strain on the menu: x.t is null, and the build's bitset (same order as the menu JSON) confirms it.
     If the order can't be confirmed, x.t alone decides. */
  function noStrain(key, list) {
    var ns = SD.ns && SD.ns[key];
    if (ns && ns.n === list.length && fnv(list.map(function (x) { return x.i; }).join('|')) === ns.h) {
      var bin = atob(ns.b);
      return function (x, i) { return !x.t || ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) === 1; };
    }
    return function (x) { return !x.t; };
  }
  function prep(list, key) {
    var st = GL.byKey[key];
    var unk = noStrain(key, list);
    return list.map(function (x, idx) {
      var e = x.e || [];
      var pid = /\/products\/([a-z0-9]+)\.webp$/.exec(x.im || '');
      var photo = !x.dk && !(pid && BAD[pid[1]]);
      var strain = unk(x, idx) ? '' : (x.t || '');
      var it = {
        id: x.i, slug: x.s, name: x.n || '', brand: BN[x.b] || x.b || '', bk: normB(x.b), cat: x.c, strain: strain, size: x.z || '',
        price: x.p, pt: x.pt, thc: x.thc, mg: x.mg, im: photo ? String(x.im || '') : stillPath(x.c), dk: !photo, fl: photo ? !!x.fl : true, bg: photo ? (x.bg || '#0b1210') : '#0b1210',
        d: x.d || [], off: x.off || 0, wk: x.wk || [], v: x.v || '', e: e, ek: e.map(lower),
        url: x.url || ('location/' + st.slug + '/shop/' + x.s + '/')
      };
      // deal timing: weekly deals run on their day; a % off or a non-weekly named deal runs every day
      var days = it.wk.slice(), now = it.off > 0;
      it.d.forEach(function (n) { var day = WDAY[lower(n)]; if (day) { if (days.indexOf(day) < 0) days.push(day); } else now = true; });
      it.deal = it.d.length > 0 || it.off > 0 || it.wk.length > 0;
      it.today = now || days.indexOf(TODAY) >= 0;
      it.nostrain = !it.strain || it.cat === 'accessories' || it.cat === 'merch';
      it.hay = ' ' + fold([it.name, it.brand, x.b, x.ty, CAT_NAME[it.cat], it.nostrain ? '' : STRAIN_LABEL[it.strain], it.size, e.join(' ')].join(' '));
      return it;
    });
  }
  /* same interleave as the server (shop.mjs featured()) */
  function interleave(list) {
    var b = {}, rest = [];
    ORDER.forEach(function (k) { b[k] = []; });
    list.forEach(function (it) { (b[it.cat] || rest).push(it); });
    var out = [];
    for (var i = 0, more = true; more; i++) { more = false; for (var j = 0; j < ORDER.length; j++) { var a = b[ORDER[j]]; if (i < a.length) { out.push(a[i]); more = true; } } }
    return out.concat(rest);
  }
  /* identical markup to kit pcard() + the repairs shop.mjs card() makes (weekly badge, woven brand label + crop variant on
     photo-less cards, no unknown strain). $0 items show "Price on the live menu" and no Add button, exactly like pcard(). */
  function cardHTML(it, storeKey, W) {
    var url = GL.u(it.url), img = GL.u(it.im);
    var tags = [];
    it.d.forEach(function (d) { tags.push('<span class="tag tag--amber">' + esc(d) + '</span>'); });
    if (it.off) tags.push('<span class="tag tag--amber">' + it.off + '% off</span>');
    tags = uniq(tags).slice(0, 2);
    var have = tags.length;
    uniq(it.wk.map(function (d) { return W[d]; }).filter(Boolean)).forEach(function (w) { if (have < 2 && it.d.indexOf(w) < 0) { tags.push('<span class="tag tag--wk">' + esc(w) + '</span>'); have++; } });
    var pot = it.thc != null ? 'THC ' + it.thc + '%' : (it.mg != null ? 'THC ' + it.mg + 'mg' : '');
    var strain = it.nostrain ? '' : '<span class="strain strain--' + esc(it.strain) + '">' + esc(STRAIN_LABEL[it.strain] || it.strain) + '</span>';
    var brand = it.brand || 'Good Life';
    var media = 'pcard__media' + (it.dk ? ' pcard__media--dark' : '') + (it.fl ? ' pcard__media--fill' : ''); // crop variant: varyStills()
    var buy;
    if (it.price > 0) {
      var item = { id: it.id, store: storeKey, name: it.name, brand: it.brand, price: it.price, priceTax: it.pt, img: img, dark: it.dk, size: it.size || '', url: url };
      buy = '<span class="price"><b>' + money(it.price) + '</b><small>' + money(it.pt) + ' with tax</small></span><button type="button" class="add-btn" data-add="' + esc(JSON.stringify(item)) + '" aria-label="Add ' + esc(it.name) + ' to your bag">' + PLUS + 'Add</button>';
    } else {
      buy = '<span class="price"><small>Price on the live menu</small></span>';
    }
    return '<article class="pcard" data-pid="' + esc(it.id) + '">' +
      '<a class="' + media + '" style="background:' + esc(it.bg) + '" href="' + esc(url) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(img) + '" alt="" width="320" height="320" loading="lazy" decoding="async"><span class="pcard__badges">' + tags.join('') + '</span>' + (it.dk ? '<span class="pcard__ph">' + esc(brand) + '</span>' : '') + '</a>' +
      '<div class="pcard__body"><p class="pcard__brand">' + esc(brand) + '</p>' +
      '<h3 class="pcard__name"><a href="' + esc(url) + '">' + esc(it.name) + '</a></h3>' +
      '<p class="pcard__meta">' + strain + (it.size ? '<span>' + esc(it.size) + '</span>' : '') + (pot ? '<b>' + esc(pot) + '</b>' : '') + '</p>' +
      '<div class="pcard__buy">' + buy + '</div>' +
      '</div></article>';
  }
  function sizeKey(z) {
    var m = /^([\d.]+)\s*(g|mg|ml|fl oz|oz)?/i.exec(z || '');
    if (!m) return [9, 0, z];
    var u = (m[2] || '').toLowerCase();
    var rank = { g: 0, mg: 1, ml: 2, 'fl oz': 3, oz: 3 }[u];
    return [rank == null ? 8 : rank, parseFloat(m[1]) || 0, z];
  }
  var DEAL_LABEL = { '1': 'Has a deal this week', today: 'On deal today' };

  function Engine(root) {
    var self = this;
    var mode = root.getAttribute('data-mode');
    var presetCat = root.getAttribute('data-cat') || '';
    var presetBrand = root.getAttribute('data-brand') || '';
    var presetBk = presetBrand ? normB(presetBrand) : '';
    var W = {}; try { W = JSON.parse(root.getAttribute('data-weekly') || '{}'); } catch (e) {}
    var ssrKey = root.getAttribute('data-store');
    var storeKey = ssrKey;
    var grid = $('[data-menu-grid]', root), countEl = $('[data-menu-count]', root), activeEl = $('[data-menu-active]', root);
    var groupsEl = $('[data-menu-groups]', root), aside = $('[data-menu-filters]', root), scrim = $('.menu__scrim', root);
    var openBtn = $('[data-menu-open]', root), nfEl = $('[data-menu-nf]', root), applyBtn = $('[data-menu-apply]', root);
    var moreWrap = $('[data-menu-morewrap]', root), moreBtn = $('[data-menu-more]', root), shownEl = $('[data-menu-shown]', root);
    var emptyEl = $('[data-menu-empty]', root), emptyT = $('[data-menu-empty-t]', root), errEl = $('[data-menu-err]', root);
    var qEl = $('[data-menu-q]', root), sortEl = $('[data-menu-sort]', root);
    var items = [], base = [], results = [], unit = '%', bounds = [0, 100], shown = PER, autoN = 0, ready = false, firstRender = true;
    var hs = history.state || {};
    var S = readURL();

    function readURL() {
      var P = new URLSearchParams(location.search);
      function multi(k, split) { var out = []; P.getAll(k).forEach(function (v) { (split ? v.split(',') : [v]).forEach(function (x) { x = x.trim(); if (x && out.indexOf(x) < 0) out.push(x); }); }); return out; }
      var m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(P.get('thc') || '');
      var sort = P.get('sort') || 'featured'; if (SORTS.indexOf(sort) < 0) sort = 'featured';
      var dv = P.get('deals');
      return {
        q: (P.get('q') || '').slice(0, 80),
        cat: mode === 'menu' || mode === 'shop' ? multi('cat', true) : [],
        brand: mode === 'brand' ? [] : multi('brand', false),
        strain: multi('strain', true).map(function (s) { s = s.toLowerCase(); return STRAIN_ALIAS[s] || s; }),
        deals: dv === '1' || dv === 'today' ? dv : '',
        size: multi('size', false),
        vape: multi('vape', true).map(function (s) { return s.toLowerCase(); }),
        effect: multi('effect', true),
        thc: m ? [+m[1], +m[2]] : null,
        sort: sort
      };
    }
    function writeURL() {
      var P = new URLSearchParams(location.search);
      ['q', 'cat', 'brand', 'strain', 'deals', 'size', 'vape', 'effect', 'thc', 'sort'].forEach(function (k) { P.delete(k); });
      if (S.q) P.set('q', S.q);
      S.cat.forEach(function (v) { P.append('cat', v); });
      S.brand.forEach(function (v) { P.append('brand', v); });
      S.strain.forEach(function (v) { P.append('strain', v); });
      if (S.deals) P.set('deals', S.deals);
      S.size.forEach(function (v) { P.append('size', v); });
      S.vape.forEach(function (v) { P.append('vape', v); });
      S.effect.forEach(function (v) { P.append('effect', v); });
      if (S.thc) P.set('thc', S.thc[0] + '-' + S.thc[1]);
      if (S.sort !== 'featured') P.set('sort', S.sort);
      var qs = P.toString();
      try { history.replaceState(Object.assign({}, history.state || {}, { shown: shown }), '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
    }
    function derived() {
      S.brandK = S.brand.map(normB);
      S.effectK = S.effect.map(function (e) { return e.toLowerCase(); });
      S.qT = fold(S.q).split(' ').filter(Boolean);
    }
    function nActive() { return S.cat.length + S.brand.length + S.strain.length + (S.deals ? 1 : 0) + S.size.length + S.vape.length + S.effect.length + (S.thc ? 1 : 0); }
    function val(it) { return unit === '%' ? it.thc : it.mg; }
    function pass(it, skip) {
      if (skip !== 'cat' && S.cat.length && S.cat.indexOf(it.cat) < 0) return false;
      if (skip !== 'brand' && S.brandK.length && S.brandK.indexOf(it.bk) < 0) return false;
      if (skip !== 'strain' && S.strain.length && (it.nostrain || S.strain.indexOf(it.strain) < 0)) return false;
      if (skip !== 'deals' && S.deals && !(S.deals === 'today' ? it.today : it.deal)) return false;
      if (skip !== 'size' && S.size.length && S.size.indexOf(it.size) < 0) return false;
      if (skip !== 'vape' && S.vape.length && S.vape.indexOf(it.v) < 0) return false;
      if (skip !== 'effect' && S.effectK.length && !it.ek.some(function (e) { return S.effectK.indexOf(e) >= 0; })) return false;
      if (skip !== 'thc' && S.thc) { var v = val(it); if (v == null || v < S.thc[0] || v > S.thc[1]) return false; }
      if (S.qT.length) { for (var i = 0; i < S.qT.length; i++) if (it.hay.indexOf(S.qT[i]) < 0) return false; }
      return true;
    }
    function sortList(list) {
      var s = S.sort;
      var byF = function (a, b) { return a.f - b.f; };
      var unpriced = function (a, b) { return (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1); };
      if (s === 'price-asc') return list.sort(function (a, b) { return unpriced(a, b) || (a.price - b.price) || byF(a, b); });
      if (s === 'price-desc') return list.sort(function (a, b) { return unpriced(a, b) || (b.price - a.price) || byF(a, b); });
      if (s === 'az') return list.sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || byF(a, b); });
      if (s === 'thc-desc' || s === 'thc-asc') {
        var dir = s === 'thc-asc' ? 1 : -1;
        return list.sort(function (a, b) { var x = val(a), y = val(b); if (x == null && y == null) return byF(a, b); if (x == null) return 1; if (y == null) return -1; return (dir * (x - y)) || byF(a, b); });
      }
      return list.sort(byF);
    }
    function count(skip, keyFn) {
      var m = {};
      base.forEach(function (it) { if (!pass(it, skip)) return; var ks = keyFn(it); if (ks == null) return; (Array.isArray(ks) ? ks : [ks]).forEach(function (k) { if (k !== '' && k != null) m[k] = (m[k] || 0) + 1; }); });
      return m;
    }

    /* ---------- filter UI (built once per store / data load, then counts update in place) ---------- */
    function opt(g, v, label, checked) {
      return '<label class="mf__opt" data-v="' + esc(v) + '"><input type="checkbox" name="' + g + '" value="' + esc(v) + '"' + (checked ? ' checked' : '') + '><span class="mf__box" aria-hidden="true"></span><span class="mf__l">' + esc(label) + '</span><span class="mf__n"></span></label>';
    }
    function group(g, title, inner, open, note) {
      return '<details class="mf" data-g="' + g + '"' + (open ? ' open' : '') + '><summary class="mf__t">' + title + '<span class="mf__dot" aria-hidden="true"></span></summary>' + (note ? '<p class="mf__note">' + note + '</p>' : '') + '<div class="mf__body">' + inner + '</div></details>';
    }
    function buildFilters() {
      derived();
      var h = '';
      var cats = uniq(base.map(function (it) { return it.cat; }));
      if (mode === 'menu' || mode === 'shop') {
        var cl = ORDER.concat(['merch', 'other']).filter(function (c) { return cats.indexOf(c) >= 0; });
        h += group('cat', 'Category', '<div class="mf__opts">' + cl.map(function (c) { return opt('cat', c, CAT_NAME[c] || c, S.cat.indexOf(c) >= 0); }).join('') + '</div>', true);
      }
      h += group('deals', 'Deals', '<div class="mf__opts">' + opt('deals', '1', DEAL_LABEL['1'], S.deals === '1') + opt('deals', 'today', DEAL_LABEL.today, S.deals === 'today') + '</div>', true);
      h += group('strain', 'Strain type', '<div class="mf__opts">' + STRAINS.map(function (s) { return opt('strain', s[0], s[1], S.strain.indexOf(s[0]) >= 0); }).join('') + '</div>', true, 'As listed by the store. Products without one aren’t labelled.');
      if (mode !== 'brand') {
        var bm = {};
        base.forEach(function (it) { if (it.bk && !bm[it.bk]) bm[it.bk] = it.brand; });
        var bl = Object.keys(bm).sort(function (a, b) { return bm[a].localeCompare(bm[b], 'en', { sensitivity: 'base' }); });
        h += group('brand', 'Brand', '<div class="mf__find"><label class="sr-only" for="' + root.id + '-bq">Find a brand</label><input id="' + root.id + '-bq" class="input input--sm" type="search" placeholder="Find a brand" autocomplete="off" data-bfind></div><div class="mf__opts mf__opts--scroll" data-blist>' + bl.map(function (k) { return opt('brand', bm[k], bm[k], S.brandK.indexOf(k) >= 0); }).join('') + '</div>', S.brand.length > 0);
      }
      var sizes = uniq(base.map(function (it) { return it.size; }).filter(Boolean)).sort(function (a, b) { var x = sizeKey(a), y = sizeKey(b); return (x[0] - y[0]) || (x[1] - y[1]) || String(x[2]).localeCompare(String(y[2])); });
      if (sizes.length) h += group('size', 'Size', '<div class="mf__opts mf__opts--scroll">' + sizes.map(function (z) { return opt('size', z, z, S.size.indexOf(z) >= 0); }).join('') + '</div>', S.size.length > 0);
      if (bounds[1] > bounds[0]) {
        var lo = S.thc ? Math.max(bounds[0], S.thc[0]) : bounds[0], hi = S.thc ? Math.min(bounds[1], S.thc[1]) : bounds[1];
        var lbl = unit === '%' ? 'Total THC (%)' : 'THC per package (mg)';
        h += group('thc', lbl, '<div class="rng" style="--a:' + pct(lo) + '%;--b:' + pct(hi) + '%"><span class="rng__track" aria-hidden="true"></span>' +
          '<input type="range" min="' + bounds[0] + '" max="' + bounds[1] + '" step="1" value="' + lo + '" data-thc="0" aria-label="Minimum ' + (unit === '%' ? 'THC percent' : 'THC milligrams') + '">' +
          '<input type="range" min="' + bounds[0] + '" max="' + bounds[1] + '" step="1" value="' + hi + '" data-thc="1" aria-label="Maximum ' + (unit === '%' ? 'THC percent' : 'THC milligrams') + '"></div>' +
          '<p class="rng__v"><span data-thc-v="0">' + lo + unit + '</span><span data-thc-v="1">' + hi + unit + '</span></p>', true);
      }
      if (base.some(function (it) { return it.v; })) h += group('vape', 'Vape type', '<div class="mf__opts">' + VAPES.map(function (v) { return opt('vape', v[0], v[1], S.vape.indexOf(v[0]) >= 0); }).join('') + '</div>', S.vape.length > 0);
      var em = {};
      base.forEach(function (it) { it.e.forEach(function (e) { if (!em[e.toLowerCase()]) em[e.toLowerCase()] = e; }); });
      var el = Object.keys(em).sort();
      if (el.length) h += group('effect', 'Effects', '<div class="mf__opts">' + el.map(function (k) { return opt('effect', em[k], em[k], S.effectK.indexOf(k) >= 0); }).join('') + '</div>', S.effect.length > 0, 'As tagged by the brand. Not medical advice.');
      groupsEl.innerHTML = h;
    }
    function pct(v) { return bounds[1] > bounds[0] ? ((v - bounds[0]) / (bounds[1] - bounds[0]) * 100).toFixed(2) : 0; }
    function updateFilters() {
      var cnt = {
        cat: count('cat', function (it) { return it.cat; }),
        deals: count('deals', function (it) { return it.deal ? (it.today ? ['1', 'today'] : ['1']) : null; }),
        strain: count('strain', function (it) { return it.nostrain ? null : it.strain; }),
        brand: count('brand', function (it) { return it.bk; }),
        size: count('size', function (it) { return it.size; }),
        vape: count('vape', function (it) { return it.v; }),
        effect: count('effect', function (it) { return it.ek; })
      };
      $$('.mf[data-g]', groupsEl).forEach(function (gEl) {
        var g = gEl.getAttribute('data-g');
        if (g === 'thc') { gEl.classList.toggle('is-on', !!S.thc); return; }
        var m = cnt[g] || {}, any = 0;
        $$('.mf__opt', gEl).forEach(function (o) {
          var v = o.getAttribute('data-v'), inp = $('input', o);
          var key = g === 'brand' ? normB(v) : g === 'effect' ? v.toLowerCase() : v;
          var n = m[key] || 0;
          var on = g === 'deals' ? S.deals === v : g === 'brand' ? S.brandK.indexOf(key) >= 0 : g === 'effect' ? S.effectK.indexOf(key) >= 0 : (S[g] || []).indexOf(v) >= 0;
          inp.checked = on;
          o.hidden = !n && !on;
          if (o.getAttribute('data-hide') === '1') o.hidden = true;
          $('.mf__n', o).textContent = n ? nf(n) : '';
          if (n || on) any++;
        });
        gEl.hidden = !any;
        gEl.classList.toggle('is-on', $$('input:checked', gEl).length > 0);
      });
      var vg = $('.mf[data-g="vape"]', groupsEl);
      if (vg && !S.vape.length) { var vc = cnt.vape; vg.hidden = !((vc.aio || 0) + (vc['510'] || 0)); }
    }
    function renderActive() {
      var c = [];
      function chip(g, v, label) { c.push('<button type="button" class="chip chip--x" data-rm="' + g + '" data-rv="' + esc(v) + '">' + esc(label) + XS + '<span class="sr-only"> — remove this filter</span></button>'); }
      if (S.q) chip('q', '', '“' + S.q + '”');
      S.cat.forEach(function (v) { chip('cat', v, CAT_NAME[v] || v); });
      if (S.deals) chip('deals', S.deals, DEAL_LABEL[S.deals]);
      S.strain.forEach(function (v) { var s = STRAINS.filter(function (x) { return x[0] === v; })[0]; chip('strain', v, s ? s[1] : v); });
      S.brand.forEach(function (v) { chip('brand', v, v); });
      S.size.forEach(function (v) { chip('size', v, v); });
      if (S.thc) chip('thc', '', 'THC ' + S.thc[0] + '–' + S.thc[1] + unit);
      S.vape.forEach(function (v) { var s = VAPES.filter(function (x) { return x[0] === v; })[0]; chip('vape', v, s ? s[1] : v); });
      S.effect.forEach(function (v) { chip('effect', v, v); });
      if (c.length > 1) c.push('<button type="button" class="menu__clear" data-menu-clear>Clear all</button>');
      activeEl.innerHTML = c.join('');
      var n = nActive();
      nfEl.hidden = !n; nfEl.textContent = n || '';
    }

    /* ---------- results ---------- */
    function apply(opts) {
      opts = opts || {};
      derived();
      results = sortList(base.filter(function (it) { return pass(it); }));
      if (!opts.keepShown) { shown = PER; autoN = 0; }
      shown = Math.min(Math.max(shown, PER), Math.max(PER, results.length));
      updateFilters();
      renderActive();
      renderGrid();
      writeURL();
    }
    function renderGrid() {
      var n = results.length;
      countEl.innerHTML = '<b>' + nf(n) + '</b> ' + (n === 1 ? 'product' : 'products');
      applyBtn.textContent = n ? 'Show ' + plural(n, 'product') : 'No products — clear a filter';
      emptyEl.hidden = n > 0;
      grid.hidden = n === 0;
      if (!n) {
        emptyT.textContent = S.q ? 'Nothing on this menu matches “' + S.q + '” with those filters.' : 'Try fewer filters — or clear them all.';
        moreWrap.hidden = true; return;
      }
      var slice = results.slice(0, Math.min(shown, n));
      var ids = slice.map(function (it) { return it.id; }).join('|');
      var cur = $$('.pcard', grid).map(function (el) { return el.getAttribute('data-pid'); }).join('|');
      if (!(firstRender && ids === cur)) grid.innerHTML = slice.map(function (it) { return cardHTML(it, storeKey, W); }).join('');
      firstRender = false;
      syncMore();
      varyStills();
      markOrphan();
    }
    /* photo-less cards cycle through 4 crops + label colours in grid order, so neighbours never look identical */
    function varyStills() {
      $$('.pcard__media--dark', grid).forEach(function (m, i) {
        var v = 'pcard__media--v' + (i % 4);
        if (m.classList.contains(v)) return;
        m.classList.remove('pcard__media--v0', 'pcard__media--v1', 'pcard__media--v2', 'pcard__media--v3');
        m.classList.add(v);
      });
    }
    /* owner rule "no lone last-row card": when every result is on screen and the last row holds one card, that card
       spans the row as a wide card (re-checked on resize — the column count changes with the width) */
    function markOrphan() {
      var w = $('.pcard--wide', grid); if (w) w.classList.remove('pcard--wide');
      if (grid.hidden || !results.length) return;
      var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      var cards = grid.children, n = cards.length;
      if (cols > 1 && n === results.length && n % cols === 1) cards[n - 1].classList.add('pcard--wide');
    }
    function syncMore() {
      var n = results.length, s = Math.min(shown, n);
      moreWrap.hidden = s >= n;
      shownEl.textContent = 'Showing ' + nf(s) + ' of ' + nf(n);
    }
    function loadMore() {
      var n = results.length; if (shown >= n) return;
      var from = shown; shown = Math.min(n, shown + PER);
      grid.insertAdjacentHTML('beforeend', results.slice(from, shown).map(function (it) { return cardHTML(it, storeKey, W); }).join(''));
      syncMore();
      varyStills();
      markOrphan();
      try { history.replaceState(Object.assign({}, history.state || {}, { shown: shown }), '', location.href); } catch (e) {}
      GL.announce('Showing ' + nf(shown) + ' of ' + nf(n) + ' products.');
    }

    /* ---------- data ---------- */
    function setData(list) {
      items = list;
      base = interleave(items.filter(function (it) { return (!presetCat || it.cat === presetCat) && (!presetBk || it.bk === presetBk); }));
      base.forEach(function (it, i) { it.f = i; });
      var pc = 0, mc = 0;
      base.forEach(function (it) { if (it.thc != null) pc++; if (it.mg != null) mc++; });
      unit = pc >= mc ? '%' : 'mg';
      var vals = base.map(val).filter(function (v) { return v != null; });
      bounds = vals.length ? [Math.floor(Math.min.apply(null, vals)), Math.ceil(Math.max.apply(null, vals))] : [0, 0];
      if (S.thc) { S.thc = [Math.max(bounds[0], S.thc[0]), Math.min(bounds[1], S.thc[1])]; if (S.thc[0] <= bounds[0] && S.thc[1] >= bounds[1]) S.thc = null; }
      // canonical spelling for brand / effect values that came from a URL (matching is loose / case-insensitive)
      var bm = {}, em = {};
      base.forEach(function (it) { if (it.bk && !bm[it.bk]) bm[it.bk] = it.brand; it.e.forEach(function (e) { if (!em[e.toLowerCase()]) em[e.toLowerCase()] = e; }); });
      S.brand = uniq(S.brand.map(function (b) { return bm[normB(b)] || b; }));
      S.effect = uniq(S.effect.map(function (e) { return em[e.toLowerCase()] || e; }));
      derived();
      ready = true;
      buildFilters();
      if (qEl.value !== S.q) qEl.value = S.q;
      sortEl.value = S.sort;
      if (qEl) qEl.placeholder = 'Search ' + plural(base.length, 'product');
      root.setAttribute('data-store', storeKey);
    }
    function go(key, opts) {
      opts = opts || {};
      storeKey = key;
      root.classList.add('is-loading');
      return load(key).then(function (list) {
        root.classList.remove('is-loading');
        errEl.hidden = true;
        setData(list);
        if (opts.restore && hs.shown) shown = hs.shown;
        apply({ keepShown: !!opts.restore });
        if (opts.restore && navType === 'back_forward' && hs.y) requestAnimationFrame(function () { window.scrollTo(0, hs.y); });
        if (opts.after) opts.after();
      }).catch(function (e) { root.classList.remove('is-loading'); errEl.hidden = false; if (window.console) console.error('Menu engine:', e); });
    }
    self.go = go;
    self.store = function () { return storeKey; };

    /* ---------- events ---------- */
    var qT;
    qEl.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { S.q = qEl.value.trim().slice(0, 80); if (ready) apply(); }, 180); });
    qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(qT); S.q = qEl.value.trim().slice(0, 80); if (ready) apply(); } });
    sortEl.addEventListener('change', function () { S.sort = sortEl.value; if (ready) apply(); });
    groupsEl.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.name) return;
      var g = t.name, v = t.value;
      if (g === 'deals') S.deals = t.checked ? v : (S.deals === v ? '' : S.deals); // "this week" and "today" are one choice
      else if (S[g]) { var a = S[g].filter(function (x) { return g === 'brand' ? normB(x) !== normB(v) : g === 'effect' ? x.toLowerCase() !== v.toLowerCase() : x !== v; }); if (t.checked) a.push(v); S[g] = a; }
      apply();
    });
    var rT;
    groupsEl.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-bfind')) {
        var term = fold(t.value), nterm = normB(t.value);
        $$('[data-blist] .mf__opt', groupsEl).forEach(function (o) { var v = o.getAttribute('data-v'); var hit = !term || fold(v).indexOf(term) >= 0 || (!!nterm && normB(v).indexOf(nterm) >= 0); o.setAttribute('data-hide', hit ? '0' : '1'); });
        updateFilters(); return;
      }
      if (t.hasAttribute('data-thc')) {
        var ins = $$('[data-thc]', groupsEl), lo = +ins[0].value, hi = +ins[1].value;
        if (lo > hi) { if (t === ins[0]) { ins[0].value = hi; lo = hi; } else { ins[1].value = lo; hi = lo; } }
        var r = $('.rng', groupsEl); r.style.setProperty('--a', pct(lo) + '%'); r.style.setProperty('--b', pct(hi) + '%');
        $('[data-thc-v="0"]', groupsEl).textContent = lo + unit; $('[data-thc-v="1"]', groupsEl).textContent = hi + unit;
        clearTimeout(rT); rT = setTimeout(function () { S.thc = (lo <= bounds[0] && hi >= bounds[1]) ? null : [lo, hi]; apply(); }, 140);
      }
    });
    root.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rm]');
      if (rm) {
        var g = rm.getAttribute('data-rm'), v = rm.getAttribute('data-rv');
        if (g === 'q') { S.q = ''; qEl.value = ''; }
        else if (g === 'deals') S.deals = '';
        else if (g === 'thc') S.thc = null;
        else S[g] = S[g].filter(function (x) { return x !== v; });
        if (g === 'thc') buildFilters();
        apply(); GL.announce('Filter removed. ' + plural(results.length, 'product') + '.');
        return;
      }
      if (e.target.closest('[data-menu-clear]')) {
        S = { q: '', cat: [], brand: [], strain: [], deals: '', size: [], vape: [], effect: [], thc: null, sort: S.sort };
        qEl.value = '';
        if (ready) { buildFilters(); apply(); }
        GL.announce('Filters cleared. ' + plural(results.length, 'product') + '.');
        return;
      }
      if (e.target.closest('[data-menu-more]')) { loadMore(); return; }
      if (e.target.closest('[data-menu-open]')) { openF(); return; }
      if (e.target.closest('[data-menu-apply]')) { closeF(false); var m = $('.menu__meta', root); if (m) m.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-menu-close]')) { closeF(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || !ready || moreWrap.hidden || autoN >= 3) return;
        autoN++; loadMore();
      }, { rootMargin: '0px 0px 500px 0px' }).observe(moreWrap);
    }
    var oT; window.addEventListener('resize', function () { clearTimeout(oT); oT = setTimeout(markOrphan, 150); });

    /* ---------- phone / tablet filter drawer ---------- */
    var mq = window.matchMedia('(max-width: 1099px)');
    function openF() {
      if (!mq.matches) { var f = $('summary, input', aside); if (f) f.focus(); return; }
      aside.classList.add('is-open'); scrim.hidden = false;
      aside.setAttribute('role', 'dialog'); aside.setAttribute('aria-modal', 'true');
      body.classList.add('mf-open'); openBtn.setAttribute('aria-expanded', 'true');
      var x = $('.mf__x', aside); if (x) x.focus({ preventScroll: true });
    }
    function closeF(focusBack) {
      if (!aside.classList.contains('is-open')) return;
      aside.classList.remove('is-open'); scrim.hidden = true;
      aside.removeAttribute('role'); aside.removeAttribute('aria-modal');
      body.classList.remove('mf-open'); openBtn.setAttribute('aria-expanded', 'false');
      if (focusBack !== false) openBtn.focus({ preventScroll: true });
    }
    doc.addEventListener('keydown', function (e) {
      if (!aside.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeF(); return; }
      if (e.key === 'Tab') {
        var f = $$('button:not([hidden]), input:not([hidden]), summary, select, a[href]', aside).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { if (!mq.matches) closeF(false); });
    window.addEventListener('pagehide', function () { try { history.replaceState(Object.assign({}, history.state || {}, { shown: shown, y: window.scrollY }), '', location.href); } catch (e) {} });
  }

  /* ---------- wire every engine on the page ---------- */
  var engines = $$('[data-menu]').map(function (root) { return { root: root, e: new Engine(root) }; });
  engines.forEach(function (x) {
    var root = x.root, mode = root.getAttribute('data-mode'), ssr = root.getAttribute('data-store');
    if (mode === 'shop') {
      x.e.go(GL.storeKey(), { restore: true });
      doc.addEventListener('gl:store', function () { if (GL.storeKey() !== x.e.store()) x.e.go(GL.storeKey()); syncSwitch(); });
    } else if (mode === 'brand') {
      /* the store chips show another store's stock WITHOUT changing the store you shop (a note offers the switch) */
      var chips = $$('[data-brand-store]');
      var has = chips.map(function (c) { return c.getAttribute('data-brand-store'); });
      var note = $('[data-brand-note]'), cityEl = $('[data-brand-city]');
      var pinned = null;
      var pickKey = function () { if (pinned && has.indexOf(pinned) >= 0) return pinned; return has.indexOf(GL.storeKey()) >= 0 ? GL.storeKey() : ssr; };
      var sync = function () {
        var k = x.e.store(), mine = GL.store(), city = GL.byKey[k].city;
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-brand-store') === k)); });
        if (cityEl) cityEl.textContent = 'Good Life ' + city;
        if (!note) return;
        if (k === mine.key) { note.hidden = true; note.innerHTML = ''; return; }
        var lead = has.indexOf(mine.key) >= 0 ? 'Showing Good Life ' + city + ' — you’re shopping ' + mine.city + '.' : 'Not on the ' + mine.city + ' menu right now — showing Good Life ' + city + '.';
        note.innerHTML = esc(lead) + ' <button type="button" class="brhero__switch" data-brand-switch="' + esc(k) + '">Shop Good Life ' + esc(city) + ' instead</button>';
        note.hidden = false;
      };
      x.e.go(pickKey(), { restore: true, after: sync });
      chips.forEach(function (c) { c.addEventListener('click', function () { var k = c.getAttribute('data-brand-store'); pinned = k; if (k !== x.e.store()) x.e.go(k, { after: sync }); else sync(); }); });
      if (note) note.addEventListener('click', function (e) { var b = e.target.closest('[data-brand-switch]'); if (!b) return; var k = b.getAttribute('data-brand-switch'); GL.setStore(k); GL.toast('Now shopping Good Life ' + GL.byKey[k].city); });
      doc.addEventListener('gl:store', function () { pinned = null; var k = pickKey(); if (k !== x.e.store()) x.e.go(k, { after: sync }); else sync(); });
    } else {
      x.e.go(ssr, { restore: true });
    }
  });
  /* a store's own menu / category page means you're shopping that store (silent sync; the bag keeps its own store).
     <body data-page-type> is set by the build (layout bodyAttrs). */
  var ptype = body.getAttribute('data-page-type');
  if ((ptype === 'menu' || ptype === 'category') && engines.length) {
    var own = engines[0].root.getAttribute('data-store');
    if (own && GL.storeKey() !== own) GL.setStore(own);
  }

  /* ---------- /shop/ store switcher ---------- */
  function syncSwitch() {
    var k = GL.storeKey();
    $$('[data-shop-store]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-shop-store') === k)); });
    var t = $('[data-shop-total]'); if (t) t.textContent = nf(GL.store().total);
  }
  $$('[data-shop-store]').forEach(function (b) {
    b.addEventListener('click', function () { var k = b.getAttribute('data-shop-store'); if (k !== GL.storeKey()) { GL.setStore(k); GL.toast('Now shopping Good Life ' + GL.byKey[k].city); } });
  });
  if ($('[data-shop-store]')) syncSwitch();

  /* ---------- Rochester weekly board: light today's column; on phones scroll it into view (no animation) ---------- */
  $$('[data-board]').forEach(function (fr) {
    var idx = (rocDow + 6) % 7; // board columns run Monday → Sunday
    var hl = $('[data-board-today]', fr), sc = $('[data-board-scroll]', fr);
    if (hl) { hl.style.left = (idx / 7 * 100).toFixed(3) + '%'; hl.hidden = false; }
    function center() { if (sc && sc.scrollWidth > sc.clientWidth + 4) { var col = sc.scrollWidth / 7; sc.scrollLeft = Math.max(0, idx * col - (sc.clientWidth - col) / 2); } }
    center();
    window.addEventListener('load', center);
  });

  /* ---------- deals: today's card + today's deals first in the "on deal" rail ---------- */
  var days = $$('.day[data-day]');
  if (days.length) {
    var today = null;
    days.forEach(function (d) { var on = +d.getAttribute('data-day') === rocDow; d.classList.toggle('is-today', on); if (on) today = d; });
    var tc = $('[data-today-card]');
    if (today && tc) {
      $('[data-today-name]', tc).textContent = $('.day__name', today).textContent;
      var sub = $('.day__sub', today), ts = $('[data-today-sub]', tc);
      ts.hidden = !sub; ts.textContent = sub ? sub.textContent : '';
      $('[data-today-lines]', tc).innerHTML = $$('.day__lines li', today).map(function (li) { return '<span>' + esc(li.textContent) + '</span>'; }).join('');
    }
  }
  var railT = $('[data-deal-rail]');
  if (railT) {
    $$('.pcard', railT).map(function (el, i) {
      var on = el.hasAttribute('data-now') || (' ' + (el.getAttribute('data-days') || '') + ' ').indexOf(' ' + TODAY + ' ') >= 0;
      el.classList.toggle('is-today', on);
      return { el: el, s: on ? 1 : 0, i: i };
    }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).forEach(function (x) { railT.appendChild(x.el); });
  }

  /* ---------- brands A–Z: live filter, counts + links follow the selected store; letters fold on phones/tablets ---------- */
  var bdir = $('[data-brands]');
  if (bdir) {
    var rows = $$('.bdir__item', bdir).map(function (li) { var per = {}; try { per = JSON.parse(li.getAttribute('data-per')); } catch (e) {} return { li: li, per: per, a: $('a', li), n: $('[data-bn]', li), name: li.getAttribute('data-name'), key: li.getAttribute('data-bname') || '', page: li.getAttribute('data-page') }; });
    var bq = $('[data-brands-q]', bdir), bcount = $('[data-brands-count]', bdir), bempty = $('[data-brands-empty]', bdir), bmode = 'all';
    var groupsB = $$('[data-group]', bdir), letters = $$('.bdir__letters [data-letter]', bdir), brandsK = $('[data-brands-k]');
    var mqAZ = window.matchMedia('(max-width: 1099px)'), azOpen = {};
    /* folding: each letter becomes a disclosure button (aria-expanded) on small screens; plain headings on desktop */
    var azSetup = function () {
      var fold_ = mqAZ.matches;
      bdir.classList.toggle('is-folding', fold_);
      groupsB.forEach(function (g) {
        var h = $('.bdir__L', g), L = g.getAttribute('data-group'), list = $('.bdir__list', g);
        if (fold_ && !$('.bdir__tog', h)) h.innerHTML = '<button type="button" class="bdir__tog" aria-expanded="false" aria-controls="' + list.id + '"><span class="bdir__Lc">' + esc(L) + '</span><span class="bdir__cnt" data-cnt></span></button>';
        if (!fold_ && $('.bdir__tog', h)) { h.textContent = L; list.hidden = false; }
      });
      azRender();
    };
    var azRender = function () {
      var fold_ = mqAZ.matches, term = bq.value.trim(), first = null;
      groupsB.forEach(function (g) {
        if (g.hidden) return;
        var L = g.getAttribute('data-group'), list = $('.bdir__list', g), b = $('.bdir__tog', g);
        if (!first) first = L;
        var open = !fold_ || !!term || (azOpen[L] != null ? azOpen[L] : L === first);
        list.hidden = !open;
        if (b) { b.setAttribute('aria-expanded', String(open)); $('[data-cnt]', b).textContent = plural($$('.bdir__item:not([hidden])', g).length, 'brand'); }
      });
    };
    var bApply = function () {
      var s = GL.store(), term = fold(bq.value), nterm = normB(bq.value), shownN = 0, here = 0;
      rows.forEach(function (r) {
        var c = r.per[s.key] || 0; if (c) here++;
        var show = (!term || fold(r.name).indexOf(term) >= 0 || (!!nterm && r.key.indexOf(nterm) >= 0)) && (bmode === 'all' || c > 0);
        r.li.hidden = !show; if (show) shownN++;
        r.n.textContent = c ? nf(c) : '';
        r.li.classList.toggle('is-here', c > 0);
        $$('.bdir__at', r.li).forEach(function (t) { t.classList.toggle('is-cur', t.getAttribute('data-k') === s.key); });
        if (!r.page) {
          var k = c ? s.key : Object.keys(r.per).sort(function (a, b) { return r.per[b] - r.per[a]; })[0];
          r.a.setAttribute('href', GL.u('location/' + GL.byKey[k].slug + '/shop/') + '?brand=' + encodeURIComponent(r.name) + '#menu');
        }
      });
      groupsB.forEach(function (g) { g.hidden = !$('.bdir__item:not([hidden])', g); });
      letters.forEach(function (a) { var g = $('#brands-' + (a.getAttribute('data-letter') === '#' ? 'num' : a.getAttribute('data-letter'))); var off = !g || g.hidden; a.classList.toggle('is-off', off); if (off) a.setAttribute('aria-disabled', 'true'); else a.removeAttribute('aria-disabled'); });
      bcount.textContent = plural(shownN, 'brand') + (bmode === 'here' ? ' at ' + s.city : '');
      if (brandsK) brandsK.textContent = plural(here, 'brand') + ' at ' + s.city;
      bempty.hidden = shownN > 0;
      var mlink = $('[data-brands-menu]', bdir); if (mlink && term) mlink.setAttribute('href', GL.u('location/' + s.slug + '/shop/') + '?q=' + encodeURIComponent(bq.value.trim()) + '#menu');
      azRender();
    };
    var bT; bq.addEventListener('input', function () { clearTimeout(bT); bT = setTimeout(bApply, 120); });
    $$('[data-brands-mode]', bdir).forEach(function (b) { b.addEventListener('click', function () { bmode = b.getAttribute('data-brands-mode'); $$('[data-brands-mode]', bdir).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); bApply(); }); });
    letters.forEach(function (a) { a.addEventListener('click', function (e) { if (a.classList.contains('is-off')) { e.preventDefault(); return; } if (mqAZ.matches) { azOpen[a.getAttribute('data-letter')] = true; azRender(); } }); });
    bdir.addEventListener('click', function (e) { var b = e.target.closest('.bdir__tog'); if (!b) return; var L = b.closest('[data-group]').getAttribute('data-group'); azOpen[L] = b.getAttribute('aria-expanded') !== 'true'; azRender(); });
    (mqAZ.addEventListener ? mqAZ.addEventListener.bind(mqAZ, 'change') : mqAZ.addListener.bind(mqAZ))(azSetup);
    doc.addEventListener('gl:store', bApply);
    azSetup();
    bApply();
  }

  /* ---------- feelings: tiles for tags with >= 3 products at the selected store; balanced rows ---------- */
  var feel = $('[data-feelings]');
  if (feel) {
    var tiles = $$('.ftile', feel), fgrid = $('[data-fgrid]', feel), fempty = $('[data-feel-empty]', feel);
    var fcta = $('[data-feel-cta]'), fhas = $('[data-feel-has]'), fnone = $('[data-feel-none]');
    var balance = function () {
      var vis = tiles.filter(function (t) { return !t.hidden; });
      vis.forEach(function (t) { t.classList.remove('is-wide'); });
      var n = vis.length; if (!n) return;
      var w = fgrid.clientWidth || window.innerWidth, min = window.innerWidth < 600 ? 150 : 160;
      var maxC = Math.max(2, Math.min(5, Math.floor((w + 16) / (min + 16))));
      var cols = maxC;
      while (cols > 2 && n % cols === 1) cols--;
      if (n < cols) cols = Math.max(2, n);
      fgrid.style.setProperty('--cols', cols);
      if (n % cols === 1) vis[n - 1].classList.add('is-wide');
    };
    var fApply = function () {
      var s = GL.store(), vis = 0;
      tiles.forEach(function (t) {
        var per = {}; try { per = JSON.parse(t.getAttribute('data-per')); } catch (e) {}
        var n = per[s.key] || 0, on = n >= 3;
        t.hidden = !on;
        if (on) { vis++; t.setAttribute('href', GL.u('location/' + s.slug + '/shop/') + '?effect=' + encodeURIComponent(t.getAttribute('data-effect')) + '#menu'); $('[data-fn]', t).textContent = plural(n, 'product'); }
      });
      fempty.hidden = vis > 0; fgrid.hidden = vis === 0;
      // a store without tags: no "Pick a feeling" dead end, and the hero says so
      if (fcta) fcta.hidden = vis === 0;
      if (fhas) fhas.hidden = vis === 0;
      if (fnone) fnone.hidden = vis > 0;
      $$('[data-feel-store]', feel).forEach(function (b) { b.hidden = b.getAttribute('data-feel-store') === s.key; });
      balance();
    };
    $$('[data-feel-store]', feel).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-feel-store'); GL.setStore(k); GL.toast('Now shopping Good Life ' + GL.byKey[k].city); }); });
    doc.addEventListener('gl:store', fApply);
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(balance, 120); });
    fApply();
  }
})();
