/* ADITI reader counter.
   Counts, once per browser per day: a visit to this edition, each part of the book the reader reaches,
   each post kept on screen for 5 seconds or more, and the reader's city (looked up from the connection, never stored).
   While the reader is active it also adds one tick every 10 seconds to the part on screen.
   Only counters go up; nothing identifies a person. Add ?track=test to the address to count into a test namespace. */
(function () {
  try {
    var cfg = window.ADITI_TRACK || {};
    var NS = cfg.ns || 'aditi-vp-7k2m9x';
    if (/[?&]track=test/.test(location.search)) NS += '-test';
    var LANG = cfg.lang || 'marathi';
    var API = 'https://abacus.jasoncameron.dev/hit/' + NS + '/';
    var day = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10).replace(/-/g, '');

    var store = {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k) { try { localStorage.setItem(k, '1'); } catch (e) {} }
    };
    function hit(key) { try { fetch(API + key, { keepalive: true }).catch(function () {}); } catch (e) {} }
    function once(key) {
      var mark = 'aditi-' + day + '-' + key;
      if (store.get(mark)) return false;
      store.set(mark);
      hit(key);
      return true;
    }

    // 1. The visit: once per edition per day, plus the day's combined counter.
    if (!store.get('aditi-seen-' + LANG + '-' + day) && once(LANG)) hit('d-' + day);

    // 2. Parts of the book: which one is on screen, ticked every 10 seconds while the reader is active.
    var parts = [];
    function addPart(sel, key) { var els = document.querySelectorAll(sel); for (var i = 0; i < els.length; i++) parts.push({ el: els[i], key: key }); }
    addPart('.titlepage', 'title'); addPart('.cover', 'title'); addPart('.preface', 'son');
    addPart('#viraj', 'viraj'); addPart('#series', 'series'); addPart('#letters', 'letters'); addPart('#voice', 'voice'); addPart('#map', 'map');
    function currentPart() {
      var mid = window.innerHeight / 2, best = null;
      for (var i = 0; i < parts.length; i++) {
        var r = parts[i].el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) return parts[i].key;
        if (r.top <= mid) best = parts[i].key;
      }
      return best;
    }
    var lastActive = Date.now();
    ['scroll', 'mousemove', 'keydown', 'touchstart', 'click', 'wheel'].forEach(function (ev) {
      window.addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true });
    });
    function active() { return !document.hidden && Date.now() - lastActive < 120000; }
    setInterval(function () {
      if (!active()) return;
      var p = currentPart();
      if (!p) return;
      once('s-' + p);
      hit('t-' + p);
    }, 10000);
    var first = currentPart();
    if (first) once('s-' + first);

    // 3. Posts: read when at least half of the post (or half the screen, for long posts) has been on screen for 5 seconds.
    var posts = [];
    var arts = document.querySelectorAll('article.post[data-id]');
    for (var j = 0; j < arts.length; j++) posts.push({ el: arts[j], id: arts[j].getAttribute('data-id'), secs: 0, done: false });
    setInterval(function () {
      if (!active()) return;
      var vh = window.innerHeight;
      for (var i = 0; i < posts.length; i++) {
        var p = posts[i];
        if (p.done) continue;
        var r = p.el.getBoundingClientRect();
        var overlap = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (overlap <= 0) continue;
        if (overlap / Math.min(r.height, vh) >= 0.5) {
          p.secs += 1;
          if (p.secs >= 5) { p.done = true; once('p-' + p.id); }
        }
      }
    }, 1000);

    // 4. Where the reader is: city for India, country otherwise, once per day.
    var CITY = {
      'bengaluru': 'bangalore', 'bangalore': 'bangalore', 'hyderabad': 'hyderabad', 'secunderabad': 'hyderabad',
      'pune': 'pune', 'pimpri-chinchwad': 'pune', 'pimpri': 'pune',
      'mumbai': 'mumbai', 'navi mumbai': 'mumbai', 'thane': 'mumbai', 'kalyan': 'mumbai', 'dombivli': 'mumbai', 'vasai': 'mumbai', 'bhiwandi': 'mumbai',
      'aurangabad': 'aurangabad', 'chhatrapati sambhajinagar': 'aurangabad', 'sambhajinagar': 'aurangabad',
      'parbhani': 'parbhani', 'nanded': 'nanded', 'latur': 'latur', 'jalna': 'jalna', 'hingoli': 'hingoli', 'beed': 'beed', 'bid': 'beed',
      'nagpur': 'nagpur', 'nashik': 'nashik', 'nasik': 'nashik', 'kolhapur': 'kolhapur', 'solapur': 'solapur', 'sholapur': 'solapur',
      'satara': 'satara', 'sangli': 'sangli', 'amravati': 'amravati', 'akola': 'akola', 'ahmednagar': 'ahmednagar', 'ahilyanagar': 'ahmednagar',
      'chennai': 'chennai', 'delhi': 'delhi', 'new delhi': 'delhi', 'gurugram': 'delhi', 'gurgaon': 'delhi', 'noida': 'delhi', 'ghaziabad': 'delhi', 'faridabad': 'delhi',
      'kolkata': 'kolkata', 'ahmedabad': 'ahmedabad', 'surat': 'surat', 'indore': 'indore', 'bhopal': 'bhopal', 'jaipur': 'jaipur',
      'panaji': 'goa', 'vasco da gama': 'goa', 'margao': 'goa', 'kochi': 'kochi', 'cochin': 'kochi'
    };
    var COUNTRIES = ['in', 'us', 'gb', 'ae', 'au', 'ca', 'de', 'sg', 'nz', 'qa', 'sa', 'nl', 'om', 'kw'];
    var geoMark = 'aditi-geo-' + day;
    if (!store.get(geoMark)) {
      store.set(geoMark);
      fetch('https://get.geojs.io/v1/ip/geo.json').then(function (r) { return r.json(); }).then(function (g) {
        var cc = String(g.country_code || '').toLowerCase();
        hit('c-' + (COUNTRIES.indexOf(cc) >= 0 ? cc : 'other'));
        if (cc === 'in') {
          var c = String(g.city || '').toLowerCase().trim();
          hit('city-' + (CITY[c] || 'other-in'));
        }
      }).catch(function () {});
    }
  } catch (e) {}
})();
