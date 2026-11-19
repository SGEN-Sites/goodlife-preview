/* Good Life Collective preview — core runtime (lead-owned). No dependencies.
   Store context · store-aware links · header/mega/drawer · age gate (fail-closed) · store picker · demo cart + drawer ·
   sticky "Good bar" · open-now status · reveal/neon/LED/spotlight/tilt/magnetic/parallax · pausable marquees + video.
   Area scripts (shop.js, merch.js …) build on window.GL. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var DATA = {}; try { DATA = JSON.parse($('#gl-data').textContent); } catch (e) {}
  var BASE = DATA.base || '/';
  var STORES = DATA.stores || [];
  var byKey = {}; STORES.forEach(function (s) { byKey[s.key] = s; });
  var LS = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  };
  var SS = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
  };
  function u(p) { return BASE + String(p).replace(/^\//, ''); }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
  function fill(tpl, s) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return s[k] != null ? s[k] : ''; }); }

  /* ================= store context ================= */
  // the store whose page this is (any /location/<slug>/… URL) — used when the visitor hasn't chosen a store yet, so a
  // first-time visitor on the Batavia page shops Batavia, not the Rochester default
  function urlStore() { var m = location.pathname.match(/\/location\/([^/]+)\//); if (!m) return null; for (var i = 0; i < STORES.length; i++) if (STORES[i].slug === m[1]) return STORES[i].key; return null; }
  function storeKey() { var k = LS.get('glc-store'); if (byKey[k]) return k; var p = urlStore(); return p || DATA.def || 'rochester'; }
  function store() { return byKey[storeKey()]; }
  /* a visitor who hasn't chosen a store and lands on a store's page shops that store from here on */
  (function () { var p = urlStore(); if (p && !byKey[LS.get('glc-store')]) LS.set('glc-store', p); })();
  function setStore(key, opts) {
    if (!byKey[key]) return;
    var prev = storeKey();
    LS.set('glc-store', key);
    applyStore();
    try { doc.dispatchEvent(new CustomEvent('gl:store', { detail: { key: key, prev: prev } })); } catch (e) {}
    if (opts && opts.navigate && prev !== key) navigateEquivalent(byKey[prev], byKey[key]);
  }
  /* on a store-specific page, switching store goes to the same page of the new store (or its menu) */
  function navigateEquivalent(from, to) {
    // on ANY store's page (not only the previously selected store's), go to the same page of the newly picked store
    var path = location.pathname;
    var m = path.match(/\/location\/([^/]+)\/(.*)$/);
    if (!m || !to || m[1] === to.slug) return;
    var rest = m[2] || '';
    var type = body.getAttribute('data-page-type');
    var cat = body.getAttribute('data-cat');
    var dest;
    if (type === 'product' || type === 'category' || /^shop\/[^/]+\/$/.test(rest)) dest = (cat && to.counts[cat] > 0) ? '/location/' + to.slug + '/shop/' + cat + '/' : '/location/' + to.slug + '/shop/#menu';
    else dest = '/location/' + to.slug + '/' + rest;
    location.href = u(dest) + (/#/.test(dest) ? '' : location.search);
  }
  function applyStore() {
    var s = store(); if (!s) return;
    $$('[data-store-text]').forEach(function (el) { el.textContent = fill(el.getAttribute('data-store-text'), s); });
    $$('[data-store-href]').forEach(function (el) {
      var cat = el.getAttribute('data-store-cat');
      var tpl = el.getAttribute('data-store-href');
      if (cat && !(s.counts[cat] > 0)) {
        if (el.hasAttribute('data-store-hide-empty')) { el.hidden = true; return; }
        tpl = '/location/{slug}/shop/#menu';
      }
      el.hidden = false;
      el.setAttribute('href', u(fill(tpl, s)));
    });
    $$('[data-store-count]').forEach(function (el) { var c = el.getAttribute('data-store-count'); var n = c === 'all' ? s.total : (s.counts[c] || 0); el.textContent = n ? n.toLocaleString() : ''; });
    $$('[data-cat-count]').forEach(function (el) { var n = s.counts[el.getAttribute('data-cat-count')] || 0; el.textContent = n.toLocaleString() + (n === 1 ? ' product' : ' products'); });
    $$('[data-store-only]').forEach(function (el) { el.hidden = el.getAttribute('data-store-only').split(',').indexOf(s.key) < 0; });
    /* state-specific legal text follows the page's store (or Oregon page) first, then the chosen store */
    var legalState = /\/(?:location\/oregon|learn\/oregon-cannabis-laws)\//.test(location.pathname) ? 'OR' : (byKey[urlStore()] || s).state;
    $$('[data-state-only]').forEach(function (el) { el.hidden = el.getAttribute('data-state-only') !== legalState; });
    $$('[data-store-delivery]').forEach(function (el) { el.hidden = !s.delivery; });
    $$('[data-store-nodelivery]').forEach(function (el) { el.hidden = !!s.delivery; });
    $$('[data-store-app]').forEach(function (el) { el.hidden = !s.app; });
    $$('[data-store-pick]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-store-pick') === s.key)); });
    $$('[data-store-current]').forEach(function (el) { el.classList.toggle('is-current', el.getAttribute('data-store-current') === s.key); });
    renderStatus();
  }

  /* ================= hours / open-now (store's own timezone) ================= */
  function nowIn(s) {
    var tz = s.state === 'OR' ? 'America/Los_Angeles' : 'America/New_York';
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      var dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
      return { dow: dow, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) { var d = new Date(); return { dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() }; }
  }
  function hm(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function fmt(t) { var p = t.split(':'); var h = +p[0], m = +p[1]; var ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ap; }
  function openStatus(s) {
    if (!s || !s.hours) return null;
    var n = nowIn(s);
    var today = s.hours.filter(function (h) { return h.dow.indexOf(n.dow) >= 0; })[0];
    if (today && n.min >= hm(today.open) && n.min < hm(today.close)) return { open: true, text: 'Open now · until ' + fmt(today.close) };
    if (today && n.min < hm(today.open)) return { open: false, text: 'Closed · opens ' + fmt(today.open) + ' today' };
    var tmr = s.hours.filter(function (h) { return h.dow.indexOf((n.dow + 1) % 7) >= 0; })[0];
    return { open: false, text: tmr ? 'Closed · opens ' + fmt(tmr.open) + ' tomorrow' : 'Closed now' };
  }
  GL_status = openStatus;
  function renderStatus() {
    var s = store(); var st = openStatus(s);
    $$('[data-open-status]').forEach(function (el) {
      el.innerHTML = '';
      var span = doc.createElement('span');
      if (st) { span.className = st.open ? 'open' : ''; span.textContent = st.text; }
      else { span.textContent = s.phone + ' · call for today’s hours'; }
      el.appendChild(span);
    });
    $$('[data-store-status]').forEach(function (el) {
      var k = el.getAttribute('data-store-status'); var ss = byKey[k] || s; var t = openStatus(ss);
      el.textContent = t ? t.text : 'Call ' + ss.phone + ' for today’s hours';
      el.classList.toggle('is-open', !!(t && t.open));
    });
    syncGbar();
  }
  var GL_status;

  /* ================= toast + announcer ================= */
  var toastEl = $('[data-toast]'), toastT;
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600); }
  function announce(msg) { var a = $('[data-announce]'); if (a) { a.textContent = ''; setTimeout(function () { a.textContent = msg; }, 30); } }

  /* ================= dialogs ================= */
  var lastFocus = null;
  // modal dialogs: the page behind goes inert and Tab / Shift+Tab cycle inside the panel
  var BG = ['.site-header', 'main', '.site-footer', '.gbar', '.drawer'];
  function setInert(on) { BG.forEach(function (s) { var n = $(s); if (!n) return; if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }); }
  function focusables(el) { return $$('button:not([disabled]):not([hidden]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', el).filter(function (n) { return n.offsetParent !== null || n === doc.activeElement; }); }
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var open = $$('.dlg').filter(function (d) { return !d.hidden && getComputedStyle(d).display !== 'none'; })[0];
    if (!open) return;
    var f = focusables($('.dlg__panel', open) || open); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!open.contains(doc.activeElement)) { e.preventDefault(); first.focus({ preventScroll: true }); return; }
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  });
  function openDlg(el) { if (!el) return; lastFocus = doc.activeElement; el.hidden = false; body.classList.add('dlg-open'); setInert(true); var f = $('button:not([hidden]), a[href]', el); if (f) f.focus({ preventScroll: true }); syncGbar(); }
  function closeDlg(el) { if (!el) return; el.hidden = true; body.classList.remove('dlg-open'); setInert(false); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); syncGbar(); }

  /* age gate: markup is visible by default (fail-closed); html.age-ok hides it once this browser confirmed 21+ */
  var age = $('[data-age]');
  if (age) {
    if (root.classList.contains('age-ok')) age.hidden = true;
    else { age.hidden = false; var y0 = $('[data-age-yes]', age); if (y0) setTimeout(function () { y0.focus({ preventScroll: true }); }, 60); }
    age.addEventListener('click', function (e) {
      var pick = e.target.closest('[data-store-pick]');
      if (pick) { setStore(pick.getAttribute('data-store-pick')); return; }
      if (e.target.closest('[data-age-yes]')) { LS.set('glc-21', '1'); root.classList.add('age-ok'); age.hidden = true; var m = $('#main'); if (m) m.focus({ preventScroll: true }); syncGbar(); }
      if (e.target.closest('[data-age-no]')) { var msg = $('[data-age-msg]', age); if (msg) msg.hidden = false; }
    });
  }
  var storeDlg = $('[data-store-dlg]');
  doc.addEventListener('click', function (e) {
    if (e.target.closest('[data-store-open]')) { e.preventDefault(); closeDrawer(); openDlg(storeDlg); return; }
    if (e.target.closest('[data-store-close]')) { closeDlg(storeDlg); return; }
    var pick = e.target.closest('[data-store-pick]');
    if (pick && storeDlg && storeDlg.contains(pick)) { var k = pick.getAttribute('data-store-pick'); closeDlg(storeDlg); setStore(k, { navigate: true }); toast('Now shopping Good Life ' + byKey[k].city); }
  });

  /* ================= header: glass on scroll, mega menus, drawer ================= */
  var header = $('[data-header]');
  var mega = $$('[data-mega]');
  function closeMega(except) { mega.forEach(function (it) { if (it !== except) { it.classList.remove('is-open'); var b = $('.nav__top', it); if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  mega.forEach(function (it) {
    var b = $('.nav__top', it), t, at = 0;
    function open() { clearTimeout(t); if (!it.classList.contains('is-open')) at = Date.now(); closeMega(it); it.classList.add('is-open'); b.setAttribute('aria-expanded', 'true'); }
    function close() { t = setTimeout(function () { it.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); }, 170); }
    b.addEventListener('click', function (e) { e.preventDefault(); if (it.classList.contains('is-open') && Date.now() - at > 400) { it.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); } else open(); });
    if (finePointer) { it.addEventListener('mouseenter', open); it.addEventListener('mouseleave', close); }
    it.addEventListener('focusout', function (e) { if (!it.contains(e.relatedTarget)) close(); });
  });
  doc.addEventListener('click', function (e) { if (!e.target.closest('[data-mega]')) closeMega(); });
  var burger = $('[data-burger]'), drawer = $('[data-drawer]');
  function openDrawer() { if (!drawer) return; drawer.classList.add('is-open'); burger.setAttribute('aria-expanded', 'true'); body.classList.add('drawer-open'); var c = $('[data-drawer-close].icon-btn', drawer); if (c) c.focus({ preventScroll: true }); syncGbar(); }
  function closeDrawer() { if (!drawer || !drawer.classList.contains('is-open')) return; drawer.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); body.classList.remove('drawer-open'); burger.focus({ preventScroll: true }); syncGbar(); }
  if (burger) burger.addEventListener('click', openDrawer);
  if (drawer) drawer.addEventListener('click', function (e) { if (e.target.closest('[data-drawer-close]') || e.target.closest('a')) closeDrawer(); });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeMega(); closeDrawer(); closeCart();
    if (storeDlg && !storeDlg.hidden) closeDlg(storeDlg);
    var cf = $('[data-conflict]'); if (cf && !cf.hidden) closeDlg(cf);
  });

  /* ================= cart (demo; one store per bag) ================= */
  var CART_KEY = 'glc-cart';
  function cartGet() { try { var c = JSON.parse(LS.get(CART_KEY) || 'null'); if (c && Array.isArray(c.items)) return c; } catch (e) {} return { store: null, items: [] }; }
  function cartSave(c) { if (!c.items.length) c.store = null; LS.set(CART_KEY, JSON.stringify(c)); renderCart(); try { doc.dispatchEvent(new CustomEvent('gl:cart', { detail: c })); } catch (e) {} }
  function cartCount(c) { return (c || cartGet()).items.reduce(function (a, i) { return a + i.qty; }, 0); }
  function cartSub(c) { return (c || cartGet()).items.reduce(function (a, i) { return a + i.price * i.qty; }, 0); }
  function cartTaxed(c) { return (c || cartGet()).items.reduce(function (a, i) { return a + (i.priceTax || i.price) * i.qty; }, 0); }
  /* some merch lines have no tax estimate: never show the pre-tax total as if it included tax */
  function cartTaxLabel(c) { c = c || cartGet(); return c.items.every(function (i) { return i.priceTax != null; }) ? money(cartTaxed(c)) : 'Subtotal plus tax'; }
  var pendingAdd = null;
  function cartAdd(item, qty) {
    qty = qty || 1;
    var c = cartGet();
    if (c.items.length && c.store && c.store !== item.store) {
      pendingAdd = { item: item, qty: qty };
      var cf = $('[data-conflict]'), tx = $('[data-conflict-text]');
      if (tx) tx.textContent = 'Your bag has items from Good Life ' + byKey[c.store].city + '. This item is from Good Life ' + byKey[item.store].city + '. Start a new bag for ' + byKey[item.store].city + '?';
      openDlg(cf); return false;
    }
    var key = item.id + (item.variant ? '|' + item.variant : '');
    var ex = c.items.filter(function (i) { return i.key === key; })[0];
    if (ex) ex.qty = Math.min(10, ex.qty + qty); else { item.key = key; item.qty = Math.min(10, qty); c.items.push(item); }
    c.store = item.store;
    cartSave(c);
    if (storeKey() !== item.store) setStore(item.store);
    announce('Added ' + item.name + ' to your bag. ' + cartCount(c) + (cartCount(c) === 1 ? ' item.' : ' items.'));
    toast('Added to your bag · ' + cartCount(c) + (cartCount(c) === 1 ? ' item' : ' items'));
    return true;
  }
  function cartSetQty(key, q) { var c = cartGet(); c.items = c.items.map(function (i) { if (i.key === key) i.qty = Math.max(0, Math.min(10, q)); return i; }).filter(function (i) { return i.qty > 0; }); cartSave(c); }
  function cartRemove(key) { var c = cartGet(); c.items = c.items.filter(function (i) { return i.key !== key; }); cartSave(c); announce('Removed from your bag.'); }
  function cartClear() { cartSave({ store: null, items: [] }); }
  var cartEl = $('[data-cart]');
  function openCart() { if (!cartEl) return; closeDrawer(); cartEl.classList.add('is-open'); cartEl.setAttribute('aria-hidden', 'false'); body.classList.add('cart-open'); var c = $('[data-cart-close].icon-btn', cartEl); if (c) c.focus({ preventScroll: true }); syncGbar(); }
  function closeCart() { if (!cartEl || !cartEl.classList.contains('is-open')) return; cartEl.classList.remove('is-open'); cartEl.setAttribute('aria-hidden', 'true'); body.classList.remove('cart-open'); var b = $('[data-cart-open]'); if (b) b.focus({ preventScroll: true }); syncGbar(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function renderCart() {
    var c = cartGet(), n = cartCount(c);
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; el.setAttribute('data-n', n ? String(n) : '0'); });
    var list = $('[data-cart-list]'); if (!list) return;
    var st = c.store ? byKey[c.store] : store();
    var sEl = $('[data-cart-store]');
    if (sEl) sEl.innerHTML = '<span class="code-tag"><b>' + esc(st.code) + '</b>' + esc(st.area) + '</span><span>' + (c.items.length ? 'Order from' : 'Shopping') + ' <b style="color:var(--bone)">Good Life ' + esc(st.city) + '</b></span><button type="button" class="more" data-store-open style="padding:0">Switch</button>';
    if (!c.items.length) {
      list.innerHTML = '<div class="cart__empty"><p class="h3">Your bag is empty</p><p class="muted small">Add something from the ' + esc(st.city) + ' menu.</p><a class="btn btn--neon" href="' + u('/location/' + st.slug + '/shop/#menu') + '">Shop ' + esc(st.city) + '</a></div>';
    } else {
      list.innerHTML = c.items.map(function (i) {
        return '<div class="cline"><a class="cline__img' + (i.dark ? ' cline__img--dark' : '') + '" href="' + esc(i.url) + '"><img src="' + esc(i.img) + '" alt="" loading="lazy" width="64" height="64"></a><div><a class="cline__name" href="' + esc(i.url) + '">' + esc(i.name) + '</a><div class="cline__meta">' + esc([i.brand, i.size, i.variant].filter(Boolean).join(' · ')) + '</div><div class="qty" role="group" aria-label="Quantity"><button type="button" data-qty="-1" data-key="' + esc(i.key) + '" aria-label="One less">−</button><span>' + i.qty + '</span><button type="button" data-qty="1" data-key="' + esc(i.key) + '" aria-label="One more">+</button></div></div><div class="cline__price">' + money(i.price * i.qty) + '<button type="button" class="cline__rm" data-rm="' + esc(i.key) + '">Remove</button></div></div>';
      }).join('');
    }
    var sub = $('[data-cart-subtotal]'); if (sub) sub.textContent = money(cartSub(c));
    var tx = $('[data-cart-taxed]'); if (tx) tx.textContent = cartTaxLabel(c);
    var co = $('[data-cart-checkout]'); if (co) co.classList.toggle('is-disabled', !c.items.length), co.setAttribute('aria-disabled', String(!c.items.length));
    syncGbar();
  }
  doc.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      var item; try { item = JSON.parse(add.getAttribute('data-add')); } catch (er) { return; }
      var q = 1; var qs = add.getAttribute('data-qty-from'); if (qs) { var qi = $(qs); if (qi) q = parseInt(qi.value, 10) || 1; }
      if (cartAdd(item, q)) { add.classList.add('is-added'); setTimeout(function () { add.classList.remove('is-added'); }, 1200); }
      return;
    }
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); openCart(); return; }
    if (e.target.closest('[data-cart-close]')) { closeCart(); return; }
    var qb = e.target.closest('[data-qty]');
    if (qb && qb.closest('[data-cart-list], [data-cart-page]')) { var k = qb.getAttribute('data-key'); var it = cartGet().items.filter(function (i) { return i.key === k; })[0]; if (it) cartSetQty(k, it.qty + parseInt(qb.getAttribute('data-qty'), 10)); return; }
    var rm = e.target.closest('[data-rm]'); if (rm) { cartRemove(rm.getAttribute('data-rm')); return; }
    if (e.target.closest('[data-conflict-new]')) { var cf = $('[data-conflict]'); cartClear(); closeDlg(cf); if (pendingAdd) { cartAdd(pendingAdd.item, pendingAdd.qty); pendingAdd = null; } return; }
    if (e.target.closest('[data-conflict-close]')) { pendingAdd = null; closeDlg($('[data-conflict]')); return; }
    if (e.target.closest('[data-cart-checkout][aria-disabled="true"]')) { e.preventDefault(); }
  });

  /* ================= sticky "Good bar" (every page): past the hero, hidden at footer/typing/drawers ================= */
  var gbar = $('[data-gbar]'), foot = $('.site-footer'), footIn = false, typing = false;
  var gbarX = SS.get('glc-gbar-x') === '1';
  function syncGbar() {
    if (!gbar) return;
    var main = $('main'); var hero = main && main.firstElementChild;
    var pastHero = hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.35 : window.scrollY > window.innerHeight * 0.6;
    var blocked = body.classList.contains('drawer-open') || body.classList.contains('cart-open') || body.classList.contains('dlg-open') || (age && !age.hidden);
    var on = !gbarX && pastHero && !footIn && !typing && !blocked;
    if (on !== gbar.classList.contains('is-visible')) gbar.classList.toggle('is-visible', on);
    root.style.setProperty('--bottom-stack', on ? gbar.offsetHeight + 'px' : '0px');
    // content: a shop page with a bag shows the bag; otherwise the store + how to order
    var s = store(), c = cartGet(), n = cartCount(c);
    var t = $('[data-gbar-title]', gbar), d = $('[data-gbar-text]', gbar), p = $('[data-gbar-primary]', gbar);
    var st = openStatus(s);
    var BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg> ';
    var onCart = /\/cart\/$/.test(location.pathname), onCheckout = /\/checkout\/$/.test(location.pathname);
    if (n && c.store) {
      t.innerHTML = 'Your bag <span class="scr">' + n + (n === 1 ? ' item' : ' items') + '</span>';
      d.textContent = money(cartSub(c)) + ' before tax · from Good Life ' + byKey[c.store].city;
      p.removeAttribute('data-cart-open');
      // on the bag page the bar moves you forward (checkout) instead of reopening the bag over itself
      if (onCart) { p.innerHTML = BAG + 'Checkout'; p.setAttribute('href', u('/checkout/')); }
      else if (onCheckout) { p.innerHTML = BAG + 'Back to bag'; p.setAttribute('href', u('/cart/')); }
      else { p.innerHTML = BAG + 'View bag'; p.setAttribute('href', u('/cart/')); p.setAttribute('data-cart-open', ''); }
    } else {
      t.innerHTML = 'Shopping <span class="scr">' + esc(s.city) + '</span>';
      d.textContent = (st ? st.text + ' · ' : '') + (s.delivery ? 'Pickup or free delivery ($' + (DATA.deliveryMin || 50) + ' min)' : 'Order online for in-store pickup');
      p.innerHTML = BAG + 'Shop the menu';
      p.removeAttribute('data-cart-open'); p.setAttribute('href', u('/location/' + s.slug + '/shop/#menu'));
    }
  }
  if (gbar) {
    if (foot && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { footIn = es[0].isIntersecting; syncGbar(); }, { rootMargin: '0px 0px 40px 0px' }).observe(foot);
    doc.addEventListener('focusin', function (e) { var t = e.target; if (t && t.matches && t.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select')) { typing = true; syncGbar(); } });
    doc.addEventListener('focusout', function () { typing = false; setTimeout(syncGbar, 60); });
    var gx = $('[data-gbar-close]', gbar); if (gx) gx.addEventListener('click', function () { gbarX = true; SS.set('glc-gbar-x', '1'); syncGbar(); });
  }

  /* ================= scroll: header state, parallax, gbar ================= */
  var ticking = false;
  var par = reduce ? [] : $$('[data-parallax]');
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 20);
    var vh = window.innerHeight;
    par.forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
      var sp = parseFloat(el.getAttribute('data-parallax')) || 0.12;
      var mid = r.top + r.height / 2 - vh / 2;
      el.style.setProperty('--py', (-mid * sp).toFixed(1) + 'px');
    });
    syncGbar();
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } });

  /* ================= reveal, neon ignition, LED slabs ================= */
  var rv = $$('[data-reveal]'), neon = $$('[data-neon], [data-sign]'), slabs = $$('.slab');
  if ('IntersectionObserver' in window && !reduce) {
    // a fully clipped element (clip reveal start state) never intersects, so clip reveals are observed via their parent
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; (e.target._rvKids || [e.target]).forEach(function (t) { t.classList.add('is-in'); }); io.unobserve(e.target); }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    rv.forEach(function (el) { if (el.getAttribute('data-reveal') === 'clip' && el.parentElement) { var w = el.parentElement; if (!w._rvKids) { w._rvKids = []; io.observe(w); } w._rvKids.push(el); } else io.observe(el); });
    // low threshold so a fast fling past a heading still ignites it (a 40% threshold missed words passed between frames)
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-lit'); io2.unobserve(e.target); } }); }, { threshold: 0.12 });
    neon.forEach(function (el) { io2.observe(el); });
    var io3 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-on'); io3.unobserve(e.target); } }); }, { rootMargin: '0px 0px -20% 0px' });
    slabs.forEach(function (el) { io3.observe(el); });
    // settle sweep: anything flung past between frames still reveals
    var settleT;
    window.addEventListener('scroll', function () { clearTimeout(settleT); settleT = setTimeout(function () { var vh = window.innerHeight; rv.forEach(function (el) { if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < vh) el.classList.add('is-in'); }); neon.forEach(function (el) { if (!el.classList.contains('is-lit') && el.getBoundingClientRect().top < vh) el.classList.add('is-lit'); }); slabs.forEach(function (el) { if (el.getBoundingClientRect().top < vh) el.classList.add('is-on'); }); }, 140); }, { passive: true });
  } else { rv.forEach(function (el) { el.classList.add('is-in'); }); neon.forEach(function (el) { el.classList.add('is-lit'); }); slabs.forEach(function (el) { el.classList.add('is-on'); }); }

  /* ================= pointer: spotlight, tilt + glare, magnetic ================= */
  if (finePointer && !reduce) {
    $$('[data-spot]').forEach(function (el) {
      var raf = 0, mx = 0, my = 0;
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (!raf) raf = requestAnimationFrame(function () { el.style.setProperty('--mx', mx + 'px'); el.style.setProperty('--my', my + 'px'); raf = 0; }); });
    });
    $$('[data-tilt]').forEach(function (el) {
      if (!$('.glare', el)) { var g = doc.createElement('span'); g.className = 'glare'; g.setAttribute('aria-hidden', 'true'); el.appendChild(g); }
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg'); el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); el.style.transform = 'translate(' + (x * 0.18).toFixed(1) + 'px,' + (y * 0.28).toFixed(1) + 'px)'; });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ================= moving content: pausable marquees + video ================= */
  $$('[data-weave]').forEach(function (w) {
    var b = $('[data-weave-toggle]', w);
    if (reduce) w.classList.add('is-paused');
    if (b) {
      var sync = function () { var p = w.classList.contains('is-paused'); b.setAttribute('aria-pressed', String(p)); b.innerHTML = p ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'; b.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' the moving banner'); };
      sync(); b.addEventListener('click', function () { w.classList.toggle('is-paused'); sync(); });
    }
  });
  $$('video[data-video]').forEach(function (v) {
    var btn = v.parentElement && $('[data-video-toggle]', v.parentElement);
    function sync() { if (!btn) return; var p = v.paused; btn.setAttribute('aria-label', p ? 'Play background video' : 'Pause background video'); btn.innerHTML = p ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'; }
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    else { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { var once = function () { v.play().catch(function () {}); doc.removeEventListener('touchstart', once); doc.removeEventListener('click', once); }; doc.addEventListener('touchstart', once, { passive: true }); doc.addEventListener('click', once); }); }
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    if (btn) btn.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
  });

  /* ================= owner round 2: shared motion + interaction (all respect reduced motion and Pause motion) ================= */
  var still = function () { return reduce || root.classList.contains('motion-off'); };
  // headings come in word by word (text nodes split; the neon script word travels as one piece)
  $$('[data-split]').forEach(function (h) {
    if (h._split) return; h._split = 1; var i = 0;
    Array.prototype.slice.call(h.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
          var s = doc.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part; frag.appendChild(s);
        });
        h.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        var wrap = doc.createElement('span'); wrap.className = 'w'; wrap.style.setProperty('--i', i++); h.replaceChild(wrap, n); wrap.appendChild(n);
      }
    });
  });
  if ('IntersectionObserver' in window && !reduce) {
    var ioS = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); ioS.unobserve(e.target); } }); }, { threshold: 0.2 });
    $$('[data-split]').forEach(function (h) { ioS.observe(h); });
  } else $$('[data-split]').forEach(function (h) { h.classList.add('is-in'); });
  // scroll-scrubbed images: --p runs 0 -> 1 while the element crosses the viewport (CSS turns it into a slow zoom / drift)
  var scrub = $$('[data-scrub]');
  if (scrub.length && !reduce) {
    var sRaf = 0;
    var sRun = function () { sRaf = 0; if (still()) return; var vh = window.innerHeight; scrub.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) return; el.style.setProperty('--p', Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height))).toFixed(3)); }); };
    window.addEventListener('scroll', function () { if (!sRaf) sRaf = requestAnimationFrame(sRun); }, { passive: true }); sRun();
  }
  // drag to scroll any horizontal rail with a mouse (touch already scrolls natively); a drag never fires the click under it
  $$('[data-drag]').forEach(function (el) {
    var down = false, x0 = 0, s0 = 0, moved = false;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; x0 = e.clientX; s0 = el.scrollLeft; });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - x0; if (Math.abs(dx) > 6) { moved = true; el.classList.add('is-dragging'); } if (moved) el.scrollLeft = s0 - dx; });
    window.addEventListener('pointerup', function () { if (!down) return; down = false; setTimeout(function () { el.classList.remove('is-dragging'); }, 0); });
    el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });
  // numbers count up once when they come into view (the final text is the server-rendered value)
  if ('IntersectionObserver' in window && !reduce) {
    var ioC = new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (!e.isIntersecting) return; ioC.unobserve(e.target); var el = e.target, fin = el.textContent, m = fin.match(/\d[\d,]*/); if (!m || still()) return;
      var to = parseInt(m[0].replace(/,/g, ''), 10), t0 = performance.now();
      (function step(t) { var k = Math.min(1, (t - t0) / 1100), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = fin.replace(m[0], v.toLocaleString()); if (k < 1) requestAnimationFrame(step); else el.textContent = fin; })(t0);
    }); }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { ioC.observe(el); });
  }
  // neon sign wall: one sign lights at a time; click/tap shows the next; pausable
  $$('[data-signs]').forEach(function (w) {
    var items = $$('[data-sign-item]', w), bars = $$('.signs__count i', w), btn = $('[data-signs-toggle]', w), k = 0, timer = 0;
    if (items.length < 2) return;
    function show(n) {
      items[k].classList.remove('is-on'); items[k].classList.add('is-off'); if (bars[k]) bars[k].classList.remove('is-on');
      k = (n + items.length) % items.length;
      var it = items[k]; it.classList.remove('is-off'); void it.offsetWidth; it.classList.add('is-on'); if (bars[k]) bars[k].classList.add('is-on');
    }
    function paused() { return w.classList.contains('is-paused') || still(); }
    function tick() { clearTimeout(timer); timer = setTimeout(function () { if (!paused() && !doc.hidden) show(k + 1); tick(); }, 3600); }
    function sync() { var p = w.classList.contains('is-paused'); if (btn) { btn.setAttribute('aria-pressed', String(p)); btn.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' the neon sign'); btn.innerHTML = p ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>'; } }
    if (reduce) w.classList.add('is-paused');
    var stage = $('[data-sign-next]', w); if (stage) stage.addEventListener('click', function () { show(k + 1); tick(); });
    if (btn) btn.addEventListener('click', function () { w.classList.toggle('is-paused'); sync(); });
    sync(); tick();
  });
  // store tiles: details show on hover / focus; on touch the + toggles them (one open at a time)
  function measureTiles() { $$('[data-stile]').forEach(function (c) { var m = $('.stile__more', c); if (m) c.style.setProperty('--more-h', m.offsetHeight + 'px'); }); }
  measureTiles(); window.addEventListener('resize', measureTiles);
  doc.addEventListener('click', function (e) {
    var t = e.target.closest('[data-stile-toggle]'); if (!t) return;
    var c = t.closest('[data-stile]'), open = !c.classList.contains('is-open');
    $$('[data-stile].is-open').forEach(function (x) { x.classList.remove('is-open'); var b = $('[data-stile-toggle]', x); if (b) b.setAttribute('aria-expanded', 'false'); });
    if (open) { c.classList.add('is-open'); t.setAttribute('aria-expanded', 'true'); measureTiles(); }
  });
  // "make this my store" buttons anywhere on a page (dialogs handle their own)
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-store-pick]'); if (!b || b.closest('[data-age], [data-store-dlg]')) return;
    var k = b.getAttribute('data-store-pick'); if (!byKey[k]) return; setStore(k); toast('Now shopping Good Life ' + byKey[k].city);
  });

  /* ================= site-wide "pause motion" (the live Accessibility Statement promises moving content can be paused) */
  function setMotion(off) {
    root.classList.toggle('motion-off', off);
    if (off) root.classList.add('neon-settled'); // once paused, lit neon stays lit when motion resumes (no second flicker)
    LS.set('glc-motion', off ? 'off' : 'on');
    $$('video[data-video]').forEach(function (v) { if (off) v.pause(); });
    $$('[data-signs]').forEach(function (w) { w.classList.toggle('is-paused', off); var b = $('[data-signs-toggle]', w); if (b) b.setAttribute('aria-pressed', String(off)); });
    $$('[data-weave]').forEach(function (w) { w.classList.toggle('is-paused', off); var b = $('[data-weave-toggle]', w); if (b) b.setAttribute('aria-pressed', String(off)); });
    $$('[data-motion-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(off)); var l = $('[data-motion-label]', b); if (l) l.textContent = off ? 'Play motion' : 'Pause motion'; });
    try { doc.dispatchEvent(new CustomEvent('gl:motion', { detail: { off: off } })); } catch (e) {}
  }
  if (LS.get('glc-motion') === 'off') setMotion(true);
  doc.addEventListener('click', function (e) { if (e.target.closest('[data-motion-toggle]')) setMotion(!root.classList.contains('motion-off')); });

  /* ================= public API ================= */
  window.GL = {
    base: BASE, u: u, stores: STORES, byKey: byKey, store: store, storeKey: storeKey, setStore: setStore, money: money, esc: esc,
    status: openStatus, toast: toast, announce: announce,
    cart: { get: cartGet, add: cartAdd, setQty: cartSetQty, remove: cartRemove, clear: cartClear, count: cartCount, subtotal: cartSub, taxed: cartTaxed, taxLabel: cartTaxLabel, open: openCart, close: closeCart, render: renderCart },
    LS: LS, refresh: applyStore
  };
  applyStore();
  renderCart();
  onScroll();
  doc.dispatchEvent(new CustomEvent('gl:ready'));
})();
