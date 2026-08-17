/* =============================================================================
   99-boot — router, delegated events, theme, keyboard shortcuts, startup.
   ========================================================================== */

var ROUTES = {
  dashboard: renderDashboard,
  calendar: renderCalendar,
  classroom: renderClassroom,
  resources: renderResources,
  notebooks: renderNotebooks,
  map: renderMap,
  stats: renderStats,
  data: renderData
};

var ROUTE_LAST = '';

function route() {
  var hash = location.hash || '#/dashboard';
  var parts = hash.replace(/^#\/?/, '').split('?');
  var page = parts[0] || 'dashboard';
  var q = {};
  (parts[1] || '').split('&').forEach(function (kv) {
    if (!kv) return;
    var p = kv.split('=');
    q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
  });
  if (!ROUTES[page]) page = 'dashboard';

  if (page === 'resources' && q.course != null) RES.courseId = q.course;
  if (page === 'notebooks' && q.course != null) NBF.courseId = q.course;

  $$('#nav a').forEach(function (a) {
    a.classList.toggle('on', a.getAttribute('href').indexOf('#/' + page) === 0);
  });

  if (page !== 'map' && MAP.raf) { cancelAnimationFrame(MAP.raf); MAP.raf = null; }
  if (page === 'dashboard' || page === 'calendar') {
    if (!LOGF.courseId || !courseById(LOGF.courseId)) logReset(page === 'calendar' ? CAL.sel : today());
  }

  var v = $('#view');
  ROUTES[page](v);
  if (page !== ROUTE_LAST) { window.scrollTo(0, 0); ROUTE_LAST = page; }
  renderTopStats();
  pomoPaint();
}

/* The top bar stays empty on the desktop — the timer is the only thing that
   belongs in every view. On a phone it also carries the log button, because
   the form itself is a scroll away. */
function renderTopStats() {
  var t = today();
  var mins = sumMins(DB.sessions.filter(function (s) { return s.date === t; }));
  var goal = DB.profile.dailyGoalMin || 0;
  $('#topstats').innerHTML =
    '<button class="btn sm primary only-narrow" data-act="quick-log">Log a session</button>' +
    '<span class="pill only-narrow"><b>' + fmtMins(mins) + '</b>' + (goal ? ' / ' + fmtMins(goal) : '') + '</span>';
  $('#whoami').textContent = DB.profile.name ? DB.profile.name : 'local & offline';
  storeRefreshLine();          // one owner for the storage line and the footer
}

ACTIONS['quick-log'] = function () {
  if (!DB.courses.length) { location.hash = '#/classroom'; route(); ACTIONS['course-add'](); return; }
  logReset(today());
  modal(logCardHTML({ prefix: 'qlog' }).replace('class="card"', 'class=""'), function () { wireLog(); });
};
ACTIONS['modal-close'] = function () { modalClose(); };

/* ------------------------------- theme ---------------------------------- */
function applyTheme() {
  var dark = DB.profile.theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var b = $('#theme-btn');
  if (b) b.textContent = dark ? 'Paper mode' : 'Dark mode';
  MAP.ink = null;
}
ACTIONS['theme'] = function () {
  DB.profile.theme = DB.profile.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  dbSave(true);
  route();
};

/* --------------------------- global listeners ---------------------------- */

document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el) return;
  var fn = ACTIONS[el.getAttribute('data-act')];
  if (!fn) return;
  if (el.tagName === 'A' && (el.getAttribute('href') === '#' || !el.getAttribute('href'))) e.preventDefault();
  if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault();
  fn(el, e);
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { modalClose(); return; }
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
  if ($('#modal-root').classList.contains('on')) return;
  var k = e.key.toLowerCase();
  if (k === 'l') { e.preventDefault(); ACTIONS['quick-log'](); }
  else if (k === 'p') { e.preventDefault(); ACTIONS['pomo-toggle'](); }
  else if (k === 't') { e.preventDefault(); ACTIONS['theme'](); }
  else if (k === 'm') { location.hash = '#/map'; }
  else if (k === 'c') { location.hash = '#/calendar'; }
  else if (k === '?') {
    modal('<h2>Keyboard shortcuts</h2><div class="mini" style="line-height:1.9">' +
      '<p><b>L</b> — log a session &nbsp;&nbsp; <b>P</b> — start or pause the timer &nbsp;&nbsp; <b>T</b> — switch theme</p>' +
      '<p><b>C</b> — calendar &nbsp;&nbsp; <b>M</b> — brain map &nbsp;&nbsp; <b>Esc</b> — close a dialog</p>' +
      '<p>Inside the log form, <b>Enter</b> saves.</p></div>' +
      '<div class="modal-foot"><button class="btn" data-act="modal-close">Got it</button></div>');
  }
});

window.addEventListener('hashchange', route);
window.addEventListener('resize', function () {
  if (!$('#map')) return;
  mapSizeRing();
  mapFit();
  mapDraw();
});
$('#theme-btn').setAttribute('data-act', 'theme');
$('#modal-root').querySelector('.scrim').addEventListener('click', modalClose);
window.addEventListener('beforeunload', function () { dbSave(true); });

/* deadlines that arrived while you were away — ask once per day, per course */
function deadlineCheck() {
  var due = DB.courses.filter(function (c) {
    return c.status === 'active' && c.deadline && daysLeft(c) <= 0 && c.lastAsked !== today();
  });
  if (!due.length) return;
  var c = due[0];
  c.lastAsked = today();
  dbSave(true);
  setTimeout(function () { deadlineDecide(c.id); }, 700);
}

/* ------------------------------- start ---------------------------------- */
function bootUI(had) {
  applyTheme();
  if (!location.hash) location.hash = '#/dashboard';
  logReset(today());
  route();
  pomoBoot();
  if (!had || !DB.onboarded) onboarding();
  else deadlineCheck();
}

(function boot() {
  var repoRec = storeRepoRecord();
  var localRec = null;
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) localRec = JSON.parse(raw);
  } catch (e) { localRec = null; }

  var pickd = storeChoose(repoRec, localRec);
  var had = !!pickd.rec;

  if (had) {
    DB = Object.assign(blankDB(), pickd.rec);
    DB.profile = Object.assign(blankDB().profile, pickd.rec.profile || {});
    DB.pomoCfg = Object.assign(blankDB().pomoCfg, pickd.rec.pomoCfg || {});
    ['courses', 'sessions', 'resources', 'notebooks'].forEach(function (k) {
      if (!Array.isArray(DB[k])) DB[k] = [];
    });
    /* v1 → v2: re-ink colours saved under the old palette */
    if (!pickd.rec.v || pickd.rec.v < 2) {
      DB.courses.forEach(function (c, i) {
        if (PALETTE.indexOf(c.color) < 0) c.color = PALETTE[i % PALETTE.length];
      });
      DB.v = SCHEMA;
    }
    STORE.fromRepo = pickd.source === 'repo';
    storeMarkSeen(storeSummary(repoRec).savedAt);    // this file version is now accounted for
    /* the file won, but the browser had work of its own: keep it recoverable */
    if (pickd.source === 'repo' && localRec) {
      if (!storeSummary(localRec).empty && storeSig(localRec) !== storeSig(repoRec)) storeStash(localRec);
    }
    /* booted from the browser copy while the file is behind: it needs saving */
    if (pickd.source === 'browser' && repoRec) STORE.dirty = true;
    if (pickd.source === 'browser' && !repoRec) STORE.dirty = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* ignore */ }
  }

  bootUI(had);
  storeReattach();                     // reattach the data file, if we may
  storeRefreshLine();

  if (had && pickd.source === 'repo' && localRec) {
    var stashed = storeStashed();
    if (stashed) {
      toast('Loaded the repo data file — the copy this browser had is kept, see Data', 8000,
            'Open Data', function () { location.hash = '#/data'; route(); });
    } else {
      toast('Loaded the data file from the repo (' + storeSummary(repoRec).sessions + ' sessions)');
    }
  }
})();
