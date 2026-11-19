/* Good Life Collective preview — PRODUCT area runtime (product builder). Builds on window.GL from site.js.
   · product page: quantity stepper, the page's store becomes the shopping store (never splitting it from the bag),
     photo fallback to the category still
   · /cart/: the full bag (qty steppers use site.js's [data-cart-page] handlers), store + fulfilment preview, undo
   · /checkout/: DEMO — inline validation, demo confirmation, clears the bag. Nothing is sent anywhere:
     no fetch/XHR/beacon, no form action, personal fields carry no name attribute.
   Motion: this file runs no loops or auto-scrollers; its one animated scroll obeys html.motion-off and reduced motion. */
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var ICON = {
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v10h16V10M3 10l2-6h14l2 6zM9 20v-6h6v6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
  };
  var DATA = {}; try { DATA = JSON.parse(($('#gl-data') || {}).textContent || '{}'); } catch (e) {}
  var MIN = DATA.deliveryMin || 50;

  function start() {
    var GL = window.GL; if (!GL) return;
    // bag + checkout: the shopping store follows the bag's store, so the header, sticky bar and order agree
    if ($('[data-bagpg]') || $('[data-copg]')) { var cs = GL.cart.get().store; if (cs && GL.byKey[cs] && GL.storeKey() !== cs) GL.setStore(cs); }
    var pdp = $('[data-pdp]'); if (pdp) initProduct(GL, pdp);
    var bag = $('[data-bagpg]'); if (bag) initBag(GL, bag);
    var co = $('[data-copg]'); if (co) initCheckout(GL, co);
  }

  /* ------------------------------------------------------------------ shared helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // only same-site paths from the bag (it lives in localStorage and could be edited by hand)
  function safe(GL, u) { u = String(u || ''); return u.indexOf(GL.base) === 0 && u.indexOf('//') !== 0 ? u : GL.u('/'); }
  function safeImg(GL, u) { u = String(u || ''); return u.indexOf(GL.base) === 0 && u.indexOf('//') !== 0 ? u : GL.u('/assets/img/cat/cat-shop-all-360.webp'); }
  function liveUrl(GL, st) { return st.liveShop || GL.u('/location/' + st.slug + '/shop/'); }
  function calm() { return doc.documentElement.classList.contains('motion-off') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function sameTax(i) { return i.priceTax == null || Math.abs(i.priceTax - i.price) < 0.005; }
  // the delivery minimum in Good Life's own words (from facts.json, carried on the page)
  function minText(el) { return el.getAttribute('data-min-text') || 'Free delivery requires a minimum order of $' + MIN; }
  // a product photo is always shown whole on its plate; only Good Life's dark category still fills its tile
  function thumb(GL, i, size) {
    var still = !!i.dark;
    var bg = /^#[0-9a-f]{3,8}$/i.test(i.bg || '') ? i.bg : (still ? '#0b1210' : '#ffffff');
    // white-background photos sit on the site's lit studio sweep, not on a flat white square
    return '<span class="bthumb' + (still ? ' bthumb--fill' : '') + (/^#f{3}(f{3})?$/i.test(bg) ? ' plate-studio' : '') + '" style="background:' + bg + '"><img src="' + esc(safeImg(GL, i.img)) + '" alt="" loading="lazy" decoding="async" width="' + size + '" height="' + size + '"></span>';
  }
  function storeBlock(st) {
    return '<div class="sumstore"><p class="sumstore__t">Good Life <span>' + esc(st.city) + '</span></p><p class="sumstore__a">' + esc(st.street + ', ' + st.city + ', ' + st.state + ' ' + st.zip) + '</p></div>';
  }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }

  /* ------------------------------------------------------------------ product page */
  function initProduct(GL, root) {
    // the page belongs to one store. It becomes the shopping store (and says so), unless the bag is from another
    // store: then the header stays with the bag and the page explains what adding this item would do.
    var key = root.getAttribute('data-store'), here = GL.byKey[key];
    var note = $('[data-pdp-bagnote]', root);
    function bagElsewhere() {
      var c = GL.cart.get(), other = !!(c.items.length && c.store && c.store !== key && GL.byKey[c.store]);
      if (note) {
        note.hidden = !other;
        var nc = $('[data-pdp-bagcity]', note); if (nc && other) nc.textContent = GL.byKey[c.store].city;
      }
      return other;
    }
    if (!bagElsewhere() && here && GL.storeKey() !== key) { GL.setStore(key); GL.toast('Now shopping Good Life ' + here.city); }
    doc.addEventListener('gl:cart', bagElsewhere);

    var qty = $('#pdp-qty');
    if (qty) {
      var clamp = function (v) { v = parseInt(v, 10); return isNaN(v) ? 1 : Math.max(1, Math.min(10, v)); };
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-step]'); if (!b) return;
        qty.value = clamp(clamp(qty.value) + parseInt(b.getAttribute('data-step'), 10));
      });
      qty.addEventListener('change', function () { qty.value = clamp(qty.value); });
      qty.addEventListener('blur', function () { qty.value = clamp(qty.value); });
    }

    // a product photo that fails to load falls back to Good Life's category still
    var img = $('.stage__plate > img', root);
    if (img) {
      var swap = function () {
        var s = img.getAttribute('data-still'); if (!s || img.getAttribute('src') === s) return;
        img.removeAttribute('srcset'); img.alt = ''; img.src = s;
        var pl = img.closest('.stage__plate'); pl.classList.add('stage__plate--fill'); pl.classList.remove('plate-studio'); pl.style.background = '#0b1210';
        pl.style.setProperty('--ar', '1'); pl.style.removeProperty('--cap');
        var stg = img.closest('.stage'); stg.classList.add('stage--still');
        var cap = $('.stage__note', root); if (cap) { cap.textContent = 'Category photo · product photo unavailable'; cap.hidden = false; }
      };
      if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener('error', swap);
    }
    // a brand badge that fails to load simply goes away
    var logo = $('.stage__logo img', root);
    if (logo) {
      var drop = function () { var b = logo.closest('.stage__logo'); if (b) b.parentNode.removeChild(b); };
      if (logo.complete && logo.naturalWidth === 0) drop(); else logo.addEventListener('error', drop);
    }
  }

  /* ------------------------------------------------------------------ fulfilment preview (bag) */
  function fulHtml(GL, st, sub, min) {
    var h = '<div class="sumful"><span class="sumful__i">' + ICON.store + '</span><div><p><b>Pickup</b> at Good Life ' + esc(st.city) + ' · ' + esc(st.street) + '</p></div></div>';
    if (st.delivery) {
      var left = Math.max(0, MIN - sub), pct = Math.min(100, (sub / MIN) * 100);
      h += '<div class="sumful"><span class="sumful__i">' + ICON.truck + '</span><div><p>' +
        (left > 0 ? '<b>Delivery:</b> ' + esc(min) + ' — add ' + GL.money(left) + ' more.' : '<b>Free delivery</b> available — $' + MIN + ' minimum met.') +
        '</p><span class="dmeter" role="img" aria-label="' + esc(GL.money(sub) + ' of the $' + MIN + ' delivery minimum') + '"><i style="--v:' + pct.toFixed(1) + '%"></i></span></div></div>';
    } else {
      h += '<div class="sumful"><span class="sumful__i">' + ICON.info + '</span><div><p>Delivery runs from Rochester and Buffalo only — ' + esc(st.city) + ' orders are in-store pickup.</p></div></div>';
    }
    return h;
  }

  /* ------------------------------------------------------------------ /cart/ */
  function initBag(GL, root) {
    var full = $('[data-bag-full]', root), empty = $('[data-bag-empty]', root), list = $('[data-bag-lines]', root);
    var lede = $('[data-bag-lede]');
    var undo = $('[data-bag-undo]', root), undoBtn = $('[data-bag-undo-btn]', root), title = $('[data-bag-title]', root);
    var min = minText(root), emptied = null, restoring = false;
    function lineHtml(i) {
      var url = safe(GL, i.url), each = GL.money(i.price), q = i.qty;
      return '<li class="bline" data-line="' + esc(i.key) + '">' +
        '<a class="bline__img" href="' + esc(url) + '" tabindex="-1" aria-hidden="true">' + thumb(GL, i, 96) + '</a>' +
        '<div class="bline__body">' + (i.brand ? '<p class="bline__brand">' + esc(i.brand) + '</p>' : '') +
        '<a class="bline__name" href="' + esc(url) + '">' + esc(i.name) + '</a>' +
        '<p class="bline__meta">' + esc([i.size, i.variant, each + ' each'].filter(Boolean).join(' · ')) + '</p>' +
        '<div class="bline__ctl"><div class="qty" role="group" aria-label="' + esc('Quantity of ' + i.name) + '">' +
        '<button type="button" data-qty="-1" data-key="' + esc(i.key) + '" aria-label="' + (q === 1 ? 'Remove ' : 'One less ') + esc(i.name) + '">−</button>' +
        '<span>' + q + '</span>' +
        '<button type="button" data-qty="1" data-key="' + esc(i.key) + '" aria-label="One more ' + esc(i.name) + '"' + (q >= 10 ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="bline__rm" data-rm="' + esc(i.key) + '">Remove</button></div></div>' +
        '<p class="bline__price"><b>' + GL.money(i.price * q) + '</b><small>' + (sameTax(i) ? 'menu price' : GL.money(i.priceTax * q) + ' with tax') + '</small></p>' +
        '</li>';
    }
    function render() {
      var c = GL.cart.get(), n = GL.cart.count(c);
      // anything added after "Empty bag" replaces the chance to undo it
      if (c.items.length && !restoring && undo && !undo.hidden) { undo.hidden = true; emptied = null; }
      // keep keyboard focus on the same control across a re-render
      var a = doc.activeElement, fk = null;
      if (a && list.contains(a)) fk = { key: a.getAttribute('data-key') || a.getAttribute('data-rm'), q: a.getAttribute('data-qty') };
      if (!c.items.length) {
        full.hidden = true; empty.hidden = false;
        if (lede) lede.textContent = 'Your demo bag is empty. Pick a store and fill it from the menu.';
        if (fk) { var t = $('.bag-empty a', root); if (t) t.focus(); }
        return;
      }
      full.hidden = false; empty.hidden = true;
      var st = GL.byKey[c.store] || GL.store();
      var sub = GL.cart.subtotal(c);
      list.innerHTML = c.items.map(lineHtml).join('');
      $('[data-bag-count]', root).textContent = plural(n, 'item', 'items');
      $('[data-bag-store]', root).innerHTML = storeBlock(st);
      $('[data-bag-ful]', root).innerHTML = fulHtml(GL, st, sub, min);
      $('[data-bag-sub]', root).textContent = GL.money(sub);
      $('[data-bag-tax]', root).textContent = GL.cart.taxLabel(c);
      var more = $('[data-bag-more]', root);
      if (more) { more.setAttribute('href', GL.u('/location/' + st.slug + '/shop/')); more.textContent = 'Keep shopping ' + st.city; }
      if (lede) lede.textContent = plural(n, 'item', 'items') + ' from Good Life ' + st.city + '. Change quantities here, then review your order.';
      if (fk && fk.key) {
        var sel = fk.q ? '[data-key="' + cssq(fk.key) + '"][data-qty="' + cssq(fk.q) + '"]' : '[data-rm="' + cssq(fk.key) + '"]';
        var el = $(sel, list);
        if (el && !el.disabled) el.focus(); else { var nm = $('[data-line="' + cssq(fk.key) + '"] .bline__name', list) || $('.bline__name', list); if (nm) nm.focus(); }
      }
    }
    function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
    // "Empty bag" is one click, so it can be taken back
    var clr = $('[data-bag-clear]', root);
    if (clr) clr.addEventListener('click', function () {
      var c = GL.cart.get(); if (!c.items.length) return;
      emptied = c.items.slice();
      GL.cart.clear();
      if (undo) { undo.hidden = false; if (undoBtn) undoBtn.focus(); }
      GL.announce('Your bag is empty. Choose Undo to bring it back.');
    });
    if (undoBtn) undoBtn.addEventListener('click', function () {
      if (!emptied) return;
      var items = emptied; emptied = null; restoring = true;
      items.forEach(function (i) { GL.cart.add(i, i.qty); });
      restoring = false; undo.hidden = true;
      render();
      var n = plural(GL.cart.count(), 'item', 'items');
      GL.toast('Your bag is back · ' + n); GL.announce('Your bag is back: ' + n + '.');
      if (title) title.focus();
    });
    doc.addEventListener('gl:cart', render);
    doc.addEventListener('gl:store', render);
    render();
  }

  /* ------------------------------------------------------------------ /checkout/ (demo) */
  function initCheckout(GL, root) {
    var min = minText(root), solo = $('.cofl', root);
    var main = $('[data-co-main]', root), empty = $('[data-bag-empty]', root), done = $('[data-co-done]', root), form = $('[data-co-form]', root);
    var addr = $('[data-co-address]', root), errBox = $('[data-co-errors]', root);
    var optD = $('[data-co-opt="delivery"]', root), radD = optD ? $('input', optD) : null, radP = $('[data-co-opt="pickup"] input', root);
    var finished = false, touched = {};

    function ful() { return radD && radD.checked && !radD.disabled ? 'delivery' : 'pickup'; }

    function render() {
      var c = GL.cart.get();
      if (finished) return;
      if (!c.items.length) { main.hidden = true; empty.hidden = false; return; }
      main.hidden = false; empty.hidden = true;
      var st = GL.byKey[c.store] || GL.store(), sub = GL.cart.subtotal(c);
      // live-menu link in the demo notice
      var lk = $('[data-co-live]', root); if (lk) lk.setAttribute('href', liveUrl(GL, st));
      $$('[data-co-city]', root).forEach(function (el) { el.textContent = st.city; });
      $('[data-co-store]', root).innerHTML = storeBlock(st);
      $('[data-co-sumstore]', root).innerHTML = storeBlock(st);
      var pt = $('[data-co-pickup-text]', root); if (pt) pt.textContent = 'At Good Life ' + st.city + ', ' + st.street + '.';
      // delivery: only from a delivering store, only once the bag reaches the minimum order
      var noD = $('[data-co-nodeliv]', root), msg = $('[data-co-deliv-msg]', root);
      if (solo) solo.classList.toggle('cofl--solo', !st.delivery); // pickup-only: its one option takes the full row
      if (!st.delivery) {
        optD.hidden = true; radD.checked = false; radD.disabled = true; noD.hidden = false;
        var c2 = $('[data-co-city2]', root); if (c2) c2.textContent = st.city;
      } else {
        optD.hidden = false; noD.hidden = true;
        if (sub < MIN) {
          if (radD.checked) { radD.checked = false; radP.checked = true; }
          radD.disabled = true;
          msg.textContent = min + ' — add ' + GL.money(MIN - sub) + ' more to choose delivery.';
        } else { radD.disabled = false; msg.textContent = 'Free delivery: $' + MIN + ' minimum met.'; }
      }
      addr.hidden = ful() !== 'delivery';
      // summary
      $('[data-co-lines]', root).innerHTML = c.items.map(function (i) {
        return '<li class="sumline">' + thumb(GL, i, 56) + '<div><p class="sumline__name">' + esc(i.name) + '</p><p class="sumline__meta">' + esc([i.size, i.variant, i.qty + ' × ' + GL.money(i.price)].filter(Boolean).join(' · ')) + '</p></div><p class="sumline__p">' + GL.money(i.price * i.qty) + '</p></li>';
      }).join('');
      $('[data-co-sub]', root).textContent = GL.money(sub);
      $('[data-co-tax]', root).textContent = GL.cart.taxLabel(c);
      var fd = $('[data-co-ful]', root); fd.textContent = ful() === 'delivery' ? 'Free delivery' : 'Pickup'; fd.classList.add('is-text');
    }

    /* inline validation — messages say what to do, fields are labelled, errors are announced */
    var RULES = {
      'co-first': function (v) { return v.trim() ? '' : 'Enter your first name.'; },
      'co-last': function (v) { return v.trim() ? '' : 'Enter your last name.'; },
      'co-email': function (v) { v = v.trim(); return !v ? 'Enter your email address.' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter an email address like name@example.com.'); },
      'co-phone': function (v) { var d = v.replace(/\D/g, ''); if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1); return !v.trim() ? 'Enter your mobile number.' : (d.length === 10 ? '' : 'Enter a 10-digit US phone number.'); },
      'co-street': function (v) { return v.trim() ? '' : 'Enter the street address for delivery.'; },
      'co-city': function (v) { return v.trim() ? '' : 'Enter the city for delivery.'; },
      'co-zip': function (v) { v = v.trim(); return !v ? 'Enter the ZIP code for delivery.' : (/^\d{5}(-\d{4})?$/.test(v) ? '' : 'Enter a 5-digit ZIP code.'); },
      'co-21': function (v, el) { return el.checked ? '' : 'Confirm you’re 21 or older with valid ID to continue.'; }
    };
    var DELIV = { 'co-street': 1, 'co-city': 1, 'co-zip': 1 };
    function active(id) { return !DELIV[id] || ful() === 'delivery'; }
    function check(id) {
      var el = $('#' + id, root), err = $('#' + id + '-err', root); if (!el) return '';
      var m = active(id) ? RULES[id](el.value || '', el) : '';
      el.setAttribute('aria-invalid', m ? 'true' : 'false');
      el.classList.toggle('is-ok', !m && el.type !== 'checkbox' && !!(el.value || '').trim());
      if (err) { err.textContent = m; err.hidden = !m; }
      return m;
    }
    Object.keys(RULES).forEach(function (id) {
      var el = $('#' + id, root); if (!el) return;
      // validate a moment after leaving the field: showing the message moves the layout, and doing that between
      // mousedown and mouseup would swallow the click the person is making on the next control
      el.addEventListener('blur', function () { if (touched[id] || (el.value || '').trim()) { touched[id] = 1; setTimeout(function () { check(id); }, 260); } });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(id); });
      el.addEventListener('change', function () { if (el.type === 'checkbox') { touched[id] = 1; check(id); } });
    });
    root.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'co-ful') { render(); if (ful() === 'delivery') { var s = $('#co-street', root); if (s) s.focus(); } }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // demo: never submitted
      // in page order, so focus lands on the first problem a keyboard or screen-reader user would reach
      var bad = $$('input', form).map(function (el) { return el.id; }).filter(function (id) { if (!RULES[id]) return false; touched[id] = 1; return !!check(id); });
      if (bad.length) {
        errBox.hidden = false;
        errBox.textContent = bad.length === 1 ? 'One field needs attention before the demo order can be placed.' : bad.length + ' fields need attention before the demo order can be placed.';
        var first = $('#' + bad[0], root); if (first) first.focus();
        return;
      }
      errBox.hidden = true;
      place();
    });

    function demoNo(st) {
      var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
      var r = new Uint8Array(6);
      try { window.crypto.getRandomValues(r); } catch (er) { for (var k = 0; k < 6; k++) r[k] = Math.floor(Math.random() * 256); }
      for (var j = 0; j < 6; j++) out += a.charAt(r[j] % a.length);
      return 'GLC-' + st.code + '-' + out;
    }

    function place() {
      var c = GL.cart.get(); if (!c.items.length) return;
      var st = GL.byKey[c.store] || GL.store();
      var snap = { items: c.items.slice(), sub: GL.cart.subtotal(c), tax: GL.cart.taxLabel(c), ful: ful(), n: GL.cart.count(c) };
      var first = ($('#co-first', root).value || '').trim();
      var where = snap.ful === 'delivery'
        ? 'Free delivery to ' + [($('#co-street', root).value || '').trim(), ($('#co-apt', root).value || '').trim(), ($('#co-city', root).value || '').trim(), ($('#co-zip', root).value || '').trim()].filter(Boolean).join(', ')
        : 'Pickup at Good Life ' + st.city + ', ' + st.street;
      done.innerHTML =
        '<span class="codone__check" aria-hidden="true">' + ICON.check + '</span>' +
        '<p class="kicker"><span class="dot" aria-hidden="true"></span>Preview demo · nothing was sent</p>' +
        '<h2 id="co-done-t">Demo order <span class="scr" data-neon>complete</span></h2>' +
        '<p class="codone__no">Demo order no. <b>' + esc(demoNo(st)) + '</b><span class="codone__warn">Not a real order</span></p>' +
        '<p class="lede">' + (first ? 'Thanks, ' + esc(first) + '. ' : '') + 'This was a design preview: nothing went to Good Life and no payment was taken. Your demo bag has been cleared.</p>' +
        '<div class="codone__sum">' + storeBlock(st) +
          '<div class="sumful"><span class="sumful__i">' + (snap.ful === 'delivery' ? ICON.truck : ICON.store) + '</span><div><p>' + esc(where) + '</p></div></div>' +
          '<ul class="sumlines" role="list">' + snap.items.map(function (i) { return '<li class="sumline">' + thumb(GL, i, 56) + '<div><p class="sumline__name">' + esc(i.name) + '</p><p class="sumline__meta">' + esc([i.size, i.variant, i.qty + ' × ' + GL.money(i.price)].filter(Boolean).join(' · ')) + '</p></div><p class="sumline__p">' + GL.money(i.price * i.qty) + '</p></li>'; }).join('') + '</ul>' +
          '<dl class="sumcard__rows"><div><dt>' + esc(plural(snap.n, 'item', 'items')) + ' · subtotal (before tax)</dt><dd>' + GL.money(snap.sub) + '</dd></div><div class="sumcard__tax"><dt>Estimated with tax</dt><dd>' + esc(snap.tax) + '</dd></div></dl>' +
        '</div>' +
        '<p class="codone__cta"><a class="btn btn--neon btn--lg" href="' + esc(liveUrl(GL, st)) + '" target="_blank" rel="noopener">To order for real, use the live ' + esc(st.city) + ' menu' + ICON.ext + '<span class="sr-only"> (opens in a new tab)</span></a>' +
        '<a class="btn btn--ghost btn--lg" href="' + esc(GL.u('/location/' + st.slug + '/shop/')) + '">' + ICON.bag + 'Back to the ' + esc(st.city) + ' menu</a></p>';
      finished = true;
      main.hidden = true; empty.hidden = true; done.hidden = false;
      var steps = $$('[data-co-steps] li');
      steps.forEach(function (li, k) { li.classList.toggle('is-done', k < 2); li.classList.toggle('is-on', k === 2); if (k === 2) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      var neon = $('[data-neon]', done); if (neon) neon.classList.add('is-lit');
      GL.cart.clear();
      var top = root.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: calm() ? 'auto' : 'smooth' });
      done.focus({ preventScroll: true });
      GL.announce('Demo order complete. Nothing was sent and no payment was taken.');
    }

    doc.addEventListener('gl:cart', render);
    doc.addEventListener('gl:store', render);
    render();
  }

  if (window.GL) start(); else doc.addEventListener('gl:ready', start, { once: true });
})();
