/* visit.js — LOCATIONS + COMPANY pages (visit area). Builds on window.GL from site.js. No dependencies.
   - store pages: today's row in the hours table, today's card on the weekly deals board, "make this my store" when
     the visitor's store is a different one, and the one store-picker case site.js leaves alone (see below)
   - locations hub: find my nearest store (browser geolocation, nothing leaves the device) sorts the store tiles
   - contact: demo form with inline validation — sends nothing
   No JS-driven motion here (no rAF loops / auto-scrollers); the one smooth scroll respects "Pause motion". */
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var GL = window.GL || null;
  var still = function () { return doc.documentElement.classList.contains('motion-off') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* store pages (body data-store-page="<key>", set at build next to data-page-type="store").
     site.js saves the page's store for a visitor with no saved store, and goes to the new store's page whenever a pick
     in the store picker CHANGES the store. The one pick it leaves alone: the store that is already selected, while
     viewing a different store's page. That pick must still land on the picked store, so only that case is handled
     here, and every pick makes at most one navigation. */
  var pageStore = doc.body.getAttribute('data-store-page');
  if (!GL || !GL.byKey[pageStore]) pageStore = null;
  var fromPicker = false;
  doc.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-store-dlg] [data-store-pick]')) { fromPicker = true; setTimeout(function () { fromPicker = false; }, 0); }
  }, true);
  doc.addEventListener('gl:store', function (e) {
    var d = e.detail || {}, s = GL && GL.byKey[d.key];
    var go = fromPicker; fromPicker = false;
    if (go && pageStore && s && d.key === d.prev && d.key !== pageStore) location.href = GL.u('/location/' + s.slug + '/') + location.search;
  });

  /* day of week in a store's own timezone */
  function dowIn(tz) {
    try {
      var w = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date());
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    } catch (e) { return new Date().getDay(); }
  }
  $$('[data-hours-tz]').forEach(function (t) {
    var d = dowIn(t.getAttribute('data-hours-tz'));
    $$('tr[data-dow]', t).forEach(function (tr) { tr.classList.toggle('is-today', tr.getAttribute('data-dow').split(',').indexOf(String(d)) >= 0); });
  });
  $$('[data-board-tz]').forEach(function (b) {
    var d = dowIn(b.getAttribute('data-board-tz'));
    var today = null;
    $$('.v-day[data-dow]', b).forEach(function (li) { var on = li.getAttribute('data-dow') === String(d); li.classList.toggle('is-today', on); if (on) today = li; });
    // the board is a drag rail: bring today's panel to the front of it (horizontal only, the page does not move)
    var rail = today && today.parentElement;
    if (rail && rail.scrollWidth > rail.clientWidth) rail.scrollLeft = Math.max(0, today.offsetLeft - rail.firstElementChild.offsetLeft);
  });

  /* "make this my store" */
  function syncMyStore() {
    if (!GL) return;
    $$('[data-mystore]').forEach(function (el) { el.hidden = GL.storeKey() === el.getAttribute('data-mystore'); });
  }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-make-store]');
    if (!b || !GL) return;
    var k = b.getAttribute('data-make-store');
    GL.setStore(k);
    GL.toast('Now shopping Good Life ' + GL.byKey[k].city);
    syncMyStore();
  });
  doc.addEventListener('gl:store', syncMyStore);
  syncMyStore();

  /* nearest store (geolocation stays in the browser): sorts the store tiles by straight-line distance */
  var nearBtn = $('[data-near]'), list = $('[data-near-list]'), msg = $('[data-near-msg]');
  function miles(a, b, c, d) {
    var R = 3958.8, r = Math.PI / 180;
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function say(t) { if (msg) msg.textContent = t; if (GL) GL.announce(t); }
  if (nearBtn && list) {
    if (!('geolocation' in navigator)) nearBtn.hidden = true;
    nearBtn.addEventListener('click', function () {
      say('Finding your nearest Good Life…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, lo = pos.coords.longitude;
        var cards = $$('[data-lat]', list).map(function (c) { return { c: c, d: miles(la, lo, +c.getAttribute('data-lat'), +c.getAttribute('data-lng')) }; });
        cards.sort(function (a, b) { return a.d - b.d; });
        cards.forEach(function (o) {
          list.appendChild(o.c);
          var t = $('[data-dist]', o.c);
          if (t) { t.hidden = false; t.textContent = (o.d < 10 ? o.d.toFixed(1) : Math.round(o.d).toLocaleString()) + ' mi away (straight line)'; }
        });
        var first = cards[0] && $('.stile__city a', cards[0].c);
        say('Sorted by distance. Closest: Good Life ' + (first ? first.textContent : '') + '.');
        list.scrollLeft = 0;
        list.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
      }, function () {
        say('Location is off — pick your store from the list below.');
      }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
    });
  }

  /* contact form: demo only — validates in the browser, sends nothing */
  var form = $('[data-contact]');
  if (form) {
    var status = $('[data-form-status]', form);
    var rules = {
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address, like name@example.com.'; },
      message: function (v) { return v.trim().length >= 10 ? '' : 'Please write a message (at least 10 characters).'; }
    };
    function check(el) {
      var fn = rules[el.name]; if (!fn) return true;
      var err = fn(el.value || '');
      var box = doc.getElementById(el.id + '-err');
      el.setAttribute('aria-invalid', err ? 'true' : 'false');
      if (box) { box.textContent = err; box.hidden = !err; }
      return !err;
    }
    $$('input, textarea', form).forEach(function (el) {
      el.addEventListener('blur', function () { if (el.value) check(el); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = $$('input, textarea', form).filter(function (el) { return !check(el); });
      if (bad.length) {
        status.className = 'v-form__status is-err';
        status.textContent = bad.length === 1 ? 'One field needs fixing.' : bad.length + ' fields need fixing.';
        bad[0].focus();
        return;
      }
      status.className = 'v-form__status';
      status.textContent = 'Preview: this message was not sent — please call your store.';
    });
  }
})();
