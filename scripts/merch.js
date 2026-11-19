/* Good Life preview: MERCH SHOP area script v2 (owner: merch area). Builds on window.GL from site.js.
   · store filter = a native <select> (no pills) + the big store counts in the "where it's stocked" band; every option shows
     ≥1 style; follows the store the shopper chose (header picker, "Pick your store", a remembered choice); keeps chapter
     counts + store lists honest; a filtered hub drops its editorial beats and any chapter left empty
   · photo walls (heroes, "keep shopping"): the lit panel widens and moves on by itself; the pointer / focus takes over.
     Stops under reduced motion and the site's Pause motion
   · cards: details show on hover / focus; on touch the info button opens them (one at a time)
   · a bag add that switches the store says so (toast + announcement) and leaves the grid where it is
   · lone-card balancing: the first visible card goes wide when the visible count would leave one card alone
   · Rochester weekly-board merch days: "today" lights up on the matching day (America/New_York)
   · style page: colour + size buttons built from real variants only (a missing size moves to the nearest stocked one);
     the chosen variant drives the Add-to-bag item, price, tax line, the selected line and the gallery photo; a note
     explains when the item is stocked somewhere other than the shopper's store or bag */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var money = function (n) { return (window.GL && GL.money) ? GL.money(n) : '$' + Number(n).toFixed(2); };
  function cityOf(key) { return (window.GL && GL.byKey && GL.byKey[key]) ? GL.byKey[key].city : key; }
  function aCity(city) { return (/^[aeiou]/i.test(city) ? 'an ' : 'a ') + city; }
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function calm() { return reduce || root.classList.contains('motion-off'); }
  var renderSwitch = function () {};   // style page only (set below)

  /* ---------- photo walls: one lit panel at a time ---------- */
  $$('[data-mwall]').forEach(function (wall) {
    var ps = $$('[data-mwall-p]', wall); if (ps.length < 2) return;
    var k = 0, hold = false, seen = false, timer = 0;
    ps.forEach(function (p, i) { if (p.classList.contains('is-on')) k = i; });
    function lit(i) { k = (i + ps.length) % ps.length; ps.forEach(function (p, j) { p.classList.toggle('is-on', j === k); }); }
    function tick() { clearTimeout(timer); timer = setTimeout(function () { if (!hold && seen && !calm() && !doc.hidden) lit(k + 1); tick(); }, 3400); }
    ps.forEach(function (p, i) {
      p.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' || e.pointerType === 'pen') { hold = true; lit(i); } });
      p.addEventListener('focus', function () { hold = true; lit(i); });
      p.addEventListener('blur', function () { hold = false; });
    });
    wall.addEventListener('pointerleave', function () { hold = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: 0.25 }).observe(wall);
    else seen = true;
    tick();
  });

  /* ---------- cards: details on tap (touch); hover / focus is pure CSS ---------- */
  function closeCards(except) { $$('[data-mcard].is-open').forEach(function (c) { if (c === except) return; c.classList.remove('is-open'); var t = $('[data-mcard-tip]', c); if (t) t.setAttribute('aria-expanded', 'false'); }); }
  doc.addEventListener('click', function (e) {
    var t = e.target.closest('[data-mcard-tip]');
    if (t) { var c = t.closest('[data-mcard]'), open = !c.classList.contains('is-open'); closeCards(c); c.classList.toggle('is-open', open); t.setAttribute('aria-expanded', String(open)); return; }
    if (!e.target.closest('[data-mcard]')) closeCards(null);
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCards(null); });

  /* ---------- grids: lone-card balancing ---------- */
  function balance(grid) {
    if (grid.classList.contains('mgrid--four') || grid.classList.contains('mgrid--split')) return;
    var all = $$('.mcard', grid);
    all.forEach(function (c) { c.classList.remove('mcard--w4', 'mcard--w3', 'mcard--w2'); });
    var vis = all.filter(function (c) { return !c.hidden; });
    var n = vis.length; if (!n) return;
    if (n % 4 === 1) vis[0].classList.add('mcard--w4');
    if (n % 3 === 1) vis[0].classList.add('mcard--w3');
    if (n % 2 === 1) vis[0].classList.add('mcard--w2');
  }

  /* ---------- store filter ---------- */
  var sel = $('[data-merch-filter]');
  var status = $('[data-merch-status]');
  var chaps = $$('[data-chap]');
  var conts = $$('[data-mshop-cont]');           // hub sections that hold only chapters
  var interludes = $$('[data-interlude]');       // hub editorial beats: results stay together when filtered
  var pinAll = $('[data-pin-all]');
  function hasKey(key) { return key === 'all' || !!(sel && $('option[value="' + key + '"]', sel)); }
  function applyFilter(key) {
    if (!hasKey(key)) key = 'all';
    var total = 0;
    chaps.forEach(function (ch) {
      var n = 0;
      $$('.mcard', ch).forEach(function (c) {
        var on = key === 'all' || (' ' + c.getAttribute('data-store') + ' ').indexOf(' ' + key + ' ') >= 0;
        c.hidden = !on; if (on) n++;
      });
      if (!ch.hasAttribute('data-chap-keep')) ch.hidden = n === 0;
      var num = $('[data-chap-n]', ch); if (num) num.hidden = key !== 'all';
      var cnt = $('[data-chap-count]', ch); if (cnt) cnt.textContent = n + (n === 1 ? ' style' : ' styles');
      var st = $('[data-chap-stores]', ch); if (st) st.textContent = key === 'all' ? st.getAttribute('data-all') : cityOf(key);
      $$('[data-mgrid]', ch).forEach(balance);
      var rail = $('[data-mrail]', ch); if (rail) rail.scrollLeft = 0;
      total += n;
    });
    conts.forEach(function (sec) { sec.hidden = !$$('[data-chap]', sec).some(function (ch) { return !ch.hidden; }); });
    interludes.forEach(function (el) { el.hidden = key !== 'all'; });
    $$('[data-roc-only]').forEach(function (el) { el.hidden = !(key === 'all' || key === 'rochester'); });
    if (pinAll) pinAll.firstChild.textContent = 'All ' + total + ' styles ';
    if (sel) sel.value = key;
    $$('.mstores__btn[data-merch-store]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-merch-store') === key)); });
    var empty = $('[data-merch-empty]'); if (empty) empty.hidden = total > 0;
    if (status) status.textContent = key === 'all' ? 'Showing all ' + total + ' styles.' : 'Showing ' + total + (total === 1 ? ' style' : ' styles') + ' stocked at Good Life ' + cityOf(key) + '.';
    return total;
  }
  /* the shopper's store drives the filter; a store with nothing here falls back to everything, and says so */
  function followStore(key) {
    if (!sel) return;
    if (hasKey(key)) { applyFilter(key); return; }
    var total = applyFilter('all');
    if (status) status.textContent = 'None of these are stocked at Good Life ' + cityOf(key) + '. Showing all ' + total + ' styles.';
  }
  if (sel) {
    sel.addEventListener('change', function () { applyFilter(sel.value); });
    doc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-merch-store]'); if (!b) return;
      applyFilter(b.getAttribute('data-merch-store'));
      var t = $('#filter'); if (t) t.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    });
  }
  $$('[data-mgrid]').forEach(balance);
  $$('.mstores__btn[data-merch-store]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  // a first-time visitor sees everything; once a store has been chosen (it is remembered), the filter starts there
  var chosen = (window.GL && GL.LS) ? GL.LS.get('glc-store') : null;
  if (sel && chosen && window.GL && GL.byKey && GL.byKey[chosen]) followStore(chosen);

  /* ---------- store changes: from the picker the grid follows; from a bag add the grid stays and we say what happened ---------- */
  var adding = null;
  doc.addEventListener('click', function (e) {          // capture: runs before site.js handles the add
    var a = e.target.closest && e.target.closest('[data-add], [data-conflict-new]'); if (!a) return;
    var name = '';
    if (a.hasAttribute('data-add')) { try { name = JSON.parse(a.getAttribute('data-add')).name || ''; } catch (er) {} }
    adding = { name: name };
    setTimeout(function () { adding = null; }, 0);
  }, true);
  doc.addEventListener('gl:store', function (e) {
    var key = e.detail && e.detail.key; if (!key) return;
    if (adding) {
      var city = cityOf(key), name = adding.name;
      setTimeout(function () {                           // after site.js's own toast + announcement for the add
        if (!window.GL) return;
        GL.toast('Added to your bag · now shopping Good Life ' + city);
        GL.announce((name ? 'Added ' + name + ' to your bag. ' : 'Added to your bag. ') + 'You are now shopping Good Life ' + city + '.');
      }, 0);
    } else followStore(key);
    renderSwitch();
  });
  doc.addEventListener('gl:cart', function () { renderSwitch(); });

  /* ---------- Rochester merch days: light up today ---------- */
  function nyDow() {
    try { var w = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date()); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w); } catch (e) { return new Date().getDay(); }
  }
  var dow = nyDow();
  $$('[data-merch-deal]').forEach(function (el) {
    var days = (el.getAttribute('data-merch-deal') || '').split(',').map(Number);
    if (days.indexOf(dow) >= 0) el.classList.add('is-today');
  });

  /* ---------- style page: variant picker + gallery ---------- */
  var dataEl = $('#merch-style');
  if (!dataEl) return;
  var D; try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var addBtn = $('[data-madd]');
  var priceEl = $('[data-mprice]'), taxEl = $('[data-mprice-tax]'), selEl = $('[data-msel]'), switchEl = $('[data-mswitch]');
  var colorLab = $('[data-mopt-color]'), sizeLab = $('[data-mopt-size]');
  var main = $('.mgal__img');
  var c0 = $('.mswatch.is-on'), s0 = $('.msize.is-on');
  var state = { color: c0 ? c0.getAttribute('data-color') : null, size: s0 ? s0.getAttribute('data-size') : null };
  var ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

  function matches(v, color, size) { return (!D.colors.length || v.color === color) && (!D.sizes.length || v.size === size); }
  function variantFor(color, size) { return D.variants.filter(function (v) { return matches(v, color, size); })[0]; }
  function sizesFor(color) { return D.variants.filter(function (v) { return !D.colors.length || v.color === color; }).map(function (v) { return v.size; }); }
  /* the stocked size closest to the one the shopper had (a tie goes to the larger size) */
  function nearestSize(list, prev) {
    var p = ORDER.indexOf(prev);
    return list.slice().sort(function (a, b) {
      var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return p < 0 ? ia - ib : (Math.abs(ia - p) - Math.abs(ib - p)) || (ib - ia);
    })[0];
  }

  function showPhoto(i) {
    var p = D.photos[i]; if (!p || !main) return;
    var box = main.parentElement;
    if (main.getAttribute('src') !== p.src) {
      main.classList.add('is-swapping');
      var im = new Image();
      im.onload = im.onerror = function () { main.setAttribute('src', p.src); main.setAttribute('width', p.w); main.setAttribute('height', p.h); main.classList.remove('is-swapping'); };
      im.src = p.src;
    }
    if (box) box.style.background = p.bg;
    main.alt = D.name + (p.colors && p.colors.length ? ' in ' + p.colors.join(' / ') : '');
    $$('[data-mgal-i]').forEach(function (b) { var on = +b.getAttribute('data-mgal-i') === i; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  }

  /* "stocked elsewhere" note above Add: one bag = one store, so say what adding this will do before it happens */
  renderSwitch = function () {
    if (!switchEl || !window.GL) return;
    var v = variantFor(state.color, state.size) || D.variants[0];
    var here = v.item.store, city = cityOf(here), cur = GL.store().key, c = GL.cart.get(), bag = c.items.length ? c.store : null, msg = '';
    if (bag && bag !== here) msg = 'Your bag is from Good Life ' + cityOf(bag) + '. This is stocked at Good Life ' + city + ', so adding it starts a new ' + city + ' bag.';
    else if (!bag && cur !== here) msg = 'You’re shopping Good Life ' + cityOf(cur) + '. This is stocked at Good Life ' + city + ', so adding it starts ' + aCity(city) + ' bag.';
    switchEl.textContent = msg; switchEl.hidden = !msg;
  };

  function sync(fromColor) {
    if (D.sizes.length) {
      var ok = sizesFor(state.color);
      $$('.msize').forEach(function (b) {
        var sz = b.getAttribute('data-size'), on = ok.indexOf(sz) >= 0;
        b.disabled = !on;
        if (on) { b.removeAttribute('aria-disabled'); b.removeAttribute('aria-label'); }
        else { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-label', sz + ' (not stocked' + (state.color ? ' in ' + state.color : '') + ')'); }
      });
      if (ok.indexOf(state.size) < 0) state.size = nearestSize(ok, state.size);
    }
    $$('.mswatch').forEach(function (b) { var on = b.getAttribute('data-color') === state.color; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('.msize').forEach(function (b) { var on = b.getAttribute('data-size') === state.size; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    var v = variantFor(state.color, state.size);
    if (!v) return;
    if (addBtn) addBtn.setAttribute('data-add', JSON.stringify(v.item));
    if (priceEl && D.variants.length > 1) priceEl.textContent = money(v.item.price);
    if (taxEl) taxEl.textContent = v.item.priceTax != null ? 'est. ' + money(v.item.priceTax) + ' with tax' : 'plus applicable tax';
    if (colorLab) colorLab.textContent = state.color || '';
    if (sizeLab) sizeLab.textContent = state.size || '';
    if (selEl) selEl.textContent = ([state.color, state.size].filter(Boolean).join(' / ') || 'One option') + ' · from Good Life ' + cityOf(v.item.store);
    if (v.ph != null) showPhoto(v.ph);
    else if (fromColor) { for (var i = 0; i < D.photos.length; i++) if ((D.photos[i].colors || []).indexOf(state.color) >= 0) { showPhoto(i); break; } }
    renderSwitch();
  }

  doc.addEventListener('click', function (e) {
    var th = e.target.closest('[data-mgal-i]');
    if (th) {
      var i = +th.getAttribute('data-mgal-i'); showPhoto(i);
      var p = D.photos[i];
      if (p && p.colors && p.colors.length && D.colors.length && p.colors.indexOf(state.color) < 0) { state.color = p.colors[0]; sync(false); }
      return;
    }
    var sw = e.target.closest('.mswatch');
    if (sw) { state.color = sw.getAttribute('data-color'); sync(true); return; }
    var sz = e.target.closest('.msize');
    if (sz && !sz.disabled) { state.size = sz.getAttribute('data-size'); sync(false); }
  });
  sync(false);
})();
