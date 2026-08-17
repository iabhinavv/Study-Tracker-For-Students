/* =============================================================================
   00-core — state, storage, small helpers, derived stats.

   The whole app is ONE localStorage record (key STORE_KEY). Nothing leaves the
   machine: no network calls, no accounts, no cookies. Back up via Data page.
   ========================================================================== */

var STORE_KEY = 'study-tracker-v1';
var SCHEMA = 2;

/* ---- course colours: printerly, muted, legible on paper and on ink ---- */
var PALETTE = [
  '#2F4A85', '#A2402C', '#1F6B4A', '#7A6015', '#5B4A85', '#276E77',
  '#8A4A5A', '#4A6B2A', '#8A5A2B', '#3E6BA8', '#6B4A2A', '#2A5B5B',
  '#7A3F6B', '#556B2F', '#A05A3C', '#3F5C6B'
];

/* ---- note-taking apps we know how to link to ---- */
var NOTE_APPS = {
  obsidian:   { label: 'Obsidian',    hint: 'Right-click a note, then Copy Obsidian URL (obsidian://open?vault=…)' },
  notion:     { label: 'Notion',      hint: 'Page menu, then Copy link (https://notion.so/… or notion://…)' },
  onenote:    { label: 'OneNote',     hint: 'Right-click the page, then Copy Link to Page (onenote:… or 1drv.ms/…)' },
  evernote:   { label: 'Evernote',    hint: 'Note menu, then Copy internal link (evernote:///view/…)' },
  applenotes: { label: 'Apple Notes', hint: 'Note, then Share, then Copy Link — or drag the note into a text field' },
  logseq:     { label: 'Logseq',      hint: 'Page menu, then Copy page URL (logseq://graph/…)' },
  goodnotes:  { label: 'GoodNotes',   hint: 'Share, then Copy Link' },
  keep:       { label: 'Google Keep', hint: 'Note menu, then Copy link' },
  local:      { label: 'Local file',  hint: 'Paste a path like /Users/you/Notes or file:///Users/you/Notes' },
  other:      { label: 'Other',       hint: 'Any URL or file path works' }
};

var RES_TYPES = {
  book:  { label: 'Book' },
  pdf:   { label: 'PDF' },
  video: { label: 'Video' },
  course:{ label: 'Course' },
  sheet: { label: 'Sheet' },
  folder:{ label: 'Folder' },
  site:  { label: 'Website' },
  paper: { label: 'Paper' },
  other: { label: 'Other' }
};

/* ---- topic suggestions, offered when a course is created ---- */
var TOPIC_HINTS = {
  math: ['Algebra', 'Calculus', 'Linear Algebra', 'Probability', 'Trigonometry', 'Series'],
  stat: ['Descriptive Stats', 'Probability', 'Distributions', 'Hypothesis Testing', 'Regression', 'ANOVA'],
  ct: ['Logic', 'Arguments', 'Fallacies', 'Reasoning', 'Problem Solving'],
  cfa: ['Ethics', 'Quantitative Methods', 'Economics', 'FSA', 'Corporate Finance', 'Equity', 'Fixed Income', 'Derivatives', 'Portfolio Mgmt'],
  python: ['Syntax', 'NumPy', 'Pandas', 'Visualisation', 'Sklearn', 'Projects'],
  quant: ['Time Value', 'Portfolio Theory', 'Options', 'Stochastic Calculus', 'Risk', 'Backtesting'],
  dbms: ['ER Model', 'Relational Algebra', 'SQL', 'Normalisation', 'Transactions', 'Indexing'],
  disc: ['Sets', 'Logic', 'Combinatorics', 'Graph Theory', 'Recurrence', 'Number Theory'],
  web: ['HTML', 'CSS', 'JavaScript', 'DOM', 'HTTP', 'Backend', 'Databases', 'Deployment'],
  spanish: ['Vocabulary', 'Grammar', 'Listening', 'Speaking', 'Reading'],
  nism: ['Markets', 'Valuation', 'Financial Statements', 'Ratios', 'Report Writing', 'Regulations'],
  default: ['Basics', 'Theory', 'Practice', 'Problems', 'Revision', 'Exam Prep']
};

function topicHints(name) {
  var n = (name || '').toLowerCase();
  var keys = Object.keys(TOPIC_HINTS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'default' && n.indexOf(keys[i]) >= 0) return TOPIC_HINTS[keys[i]];
  }
  return TOPIC_HINTS.default;
}

/* ---- starter courses, read from the CSV that shipped in this folder.
        Optional: the first-run screen also lets you start empty or import
        your own CSV. ---- */
var STARTER_COURSES = [
  ['Math', 'https://www.youtube.com/playlist?list=PLZ2ps__7DhBb1AyRNidKBrk_N5eTpVQRA', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 90, 90],
  ['Stat', 'https://www.youtube.com/playlist?list=PLZ2ps__7DhBbhK4gNFIWwx9cct193V0_b', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 70, 70],
  ['CT', 'https://www.youtube.com/playlist?list=PLZ2ps__7DhBYSzaAFqpyQKqmoni-EefS7', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 134, 134],
  ['CFA', 'https://www.efinladder.in/mycourses/CFA', '', 0, 0],
  ['Python for DS', 'https://www.youtube.com/playlist?list=PLh2mXjKcTPSACrQxPM2_1Ojus5HX88ht7', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 32, 32],
  ['Quant Finance', 'https://www.youtube.com/playlist?list=PL3F00F1C2D402D45C', '', 26, 25],
  ['DBMS', 'https://www.youtube.com/playlist?list=PLZ2ps__7DhBYc4jkUk_yQAjYEVFzVzhdU', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 81, 79],
  ['Disc Math', 'https://www.youtube.com/playlist?list=PLyqSpQzTE6M_f9q2YVF0rx9oSO_UAteS0', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 61, 61],
  ['Web App Dev', 'https://www.youtube.com/playlist?list=PLZ2ps__7DhBZGVuyXs2l3KJtiHs0KMVE7', 'https://txtghana-my.sharepoint.com/:f:/g/personal/abhinav_gwosevo_com/IgAAWbBzhSn2RIK17FexHfciATG-fUTPW-qczf1Eqrc55hI?e=r4wEe9', 105, 102],
  ['Spanish', '', '', 0, 0],
  ['NISM Research Analyst', 'https://youtube.com/playlist?list=PLMdK_Oe95V-GVbCQMRnd4qowd6OgSqk7A', '', 30, 30]
];

/* =============================== state ================================== */

function blankDB() {
  return {
    v: SCHEMA,
    onboarded: false,
    profile: { name: '', sessionMinutes: 45, dailyGoalMin: 120, weekStart: 1, theme: 'light' },
    courses: [],
    sessions: [],
    resources: [],
    notebooks: [],
    pomo: null,
    pomoCfg: { focus: 25, short: 5, long: 15, cycle: 4, autoLog: true, countAsSession: true, sound: true },
    lastCourseId: null
  };
}

var DB = blankDB();

function dbLoad() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    var got = JSON.parse(raw);
    DB = Object.assign(blankDB(), got);
    DB.profile = Object.assign(blankDB().profile, got.profile || {});
    DB.pomoCfg = Object.assign(blankDB().pomoCfg, got.pomoCfg || {});
    ['courses', 'sessions', 'resources', 'notebooks'].forEach(function (k) {
      if (!Array.isArray(DB[k])) DB[k] = [];
    });
    /* v1 → v2: the palette changed with the paper-and-ink restyle, so any
       course still carrying an old colour is re-inked in course order */
    if (!got.v || got.v < 2) {
      DB.courses.forEach(function (c, i) {
        if (PALETTE.indexOf(c.color) < 0) c.color = PALETTE[i % PALETTE.length];
      });
      DB.v = SCHEMA;
      dbSave(true);
    }
    return true;
  } catch (e) {
    console.warn('could not read saved data', e);
    return false;
  }
}

var saveTimer = null;
function dbSave(immediate) {
  clearTimeout(saveTimer);
  var write = function () {
    DB.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(DB));
    } catch (e) {
      /* full or blocked: in folder mode the file is the real home, so this is
         only a lost cache — say so, but do not pretend nothing was saved */
      toast(STORE.mode === 'folder'
        ? 'Browser cache is full — the folder file is still being written.'
        : 'Could not save — browser storage is full or blocked.', 5000);
    }
    storeQueue();                     // writes data/study-tracker.json in folder mode
  };
  if (immediate) write(); else saveTimer = setTimeout(write, 180);
}

/* ============================== helpers ================================== */

function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function $(sel, root) { return (root || document).querySelector(sel); }
/* phone-sized viewport: charts thin out and shrink rather than becoming unreadable */
function isNarrow() { return window.matchMedia && window.matchMedia('(max-width: 620px)').matches; }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

/* dates — always local, never UTC (a UTC round-trip shifts the day) */
function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fromISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function today() { return iso(new Date()); }
function shiftDays(isoStr, n) { var d = fromISO(isoStr); d.setDate(d.getDate() + n); return iso(d); }
function daysBetween(a, b) { return Math.round((fromISO(b) - fromISO(a)) / 86400000); }
function monthKey(isoStr) { return isoStr.slice(0, 7); }
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  var d = fromISO(isoStr);
  return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
}
function fmtShort(isoStr) { var d = fromISO(isoStr); return d.getDate() + ' ' + MON[d.getMonth()]; }
/* same, but keeps the year when it is not the current one — projections and
   far-off deadlines are meaningless without it */
function fmtShortY(isoStr) {
  var d = fromISO(isoStr), y = d.getFullYear();
  return d.getDate() + ' ' + MON[d.getMonth()] + (y !== new Date().getFullYear() ? " '" + String(y).slice(2) : '');
}
function fmtMonth(mk) { var p = mk.split('-'); return MON[+p[1] - 1] + ' ' + p[0]; }
function fmtMins(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + 'm';
  var h = Math.floor(m / 60), r = m % 60;
  return r ? h + 'h ' + r + 'm' : h + 'h';
}
/* tight variant for calendar cells: 45m, 1h30, 2h */
function fmtMinsTight(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + 'm';
  var h = Math.floor(m / 60), r = m % 60;
  return r ? h + 'h' + pad2(r) : h + 'h';
}

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
}

/* ============================ course model =============================== */

function newCourse(o) {
  o = o || {};
  return {
    id: uid(),
    name: o.name || 'Untitled course',
    color: o.color || PALETTE[DB.courses.length % PALETTE.length],
    link: o.link || '',
    extraLinks: o.extraLinks || [],
    categories: o.categories || [],
    totalSessions: num(o.totalSessions, 0),
    doneOffset: num(o.doneOffset, 0),   // progress that happened before tracking
    deadline: o.deadline || '',
    status: o.status || 'active',       // active | completed | dropped
    notes: o.notes || '',
    extensions: [],
    createdAt: new Date().toISOString()
  };
}

function courseById(id) {
  for (var i = 0; i < DB.courses.length; i++) if (DB.courses[i].id === id) return DB.courses[i];
  return null;
}
function courseName(id) { var c = courseById(id); return c ? c.name : 'Deleted course'; }
/* the printerly palette is mixed for paper; on the blueprint ground the same
   hue has to be lifted toward the light or it disappears into the blue */
function tone(hex) {
  if (document.documentElement.getAttribute('data-theme') !== 'dark') return hex;
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return hex;
  var v = parseInt(m[1], 16), f = 0.46;
  var mix = function (c, t) { return Math.round(c + (t - c) * f); };
  return 'rgb(' + mix((v >> 16) & 255, 226) + ',' + mix((v >> 8) & 255, 238) + ',' + mix(v & 255, 255) + ')';
}
function courseColor(id) { var c = courseById(id); return tone(c ? c.color : '#8892b0'); }
function activeCourses() { return DB.courses.filter(function (c) { return c.status === 'active'; }); }

/* progress = pre-existing offset + everything logged since */
function progressOf(course) {
  var logged = 0, mins = 0, last = '';
  DB.sessions.forEach(function (s) {
    if (s.courseId !== course.id) return;
    logged += num(s.count, 0);
    mins += num(s.minutes, 0);
    if (s.date > last) last = s.date;
  });
  var done = course.doneOffset + logged;
  var total = course.totalSessions;
  return {
    logged: logged, minutes: mins, done: done, total: total, last: last,
    remaining: total ? Math.max(0, total - done) : 0,
    pct: total ? clamp(Math.round(done / total * 100), 0, 100) : 0
  };
}

/* days until deadline; null when there is none */
function daysLeft(course) {
  if (!course.deadline) return null;
  return daysBetween(today(), course.deadline);
}

/* sessions/day needed to hit the deadline */
function paceNeeded(course) {
  var p = progressOf(course), dl = daysLeft(course);
  if (!course.totalSessions || dl === null || p.remaining <= 0) return null;
  if (dl <= 0) return Infinity;
  return p.remaining / dl;
}

/* ============================== analytics =============================== */

function sessionsInRange(fromIso, toIso) {
  return DB.sessions.filter(function (s) { return s.date >= fromIso && s.date <= toIso; });
}
function sumCount(list) { return list.reduce(function (a, s) { return a + num(s.count, 0); }, 0); }
function sumMins(list) { return list.reduce(function (a, s) { return a + num(s.minutes, 0); }, 0); }

function byDayMap() {
  var m = {};
  DB.sessions.forEach(function (s) {
    if (!m[s.date]) m[s.date] = { count: 0, minutes: 0, n: 0 };
    m[s.date].count += num(s.count, 0);
    m[s.date].minutes += num(s.minutes, 0);
    m[s.date].n++;
  });
  return m;
}

function streaks() {
  var m = byDayMap(), days = Object.keys(m).sort();
  if (!days.length) return { current: 0, longest: 0, activeDays: 0, first: '', last: '' };
  var longest = 1, run = 1;
  for (var i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  // current streak counts back from today; a gap of one day (today not yet
  // logged) still keeps yesterday's streak alive
  var cur = 0, cursor = today();
  if (!m[cursor]) cursor = shiftDays(cursor, -1);
  while (m[cursor]) { cur++; cursor = shiftDays(cursor, -1); }
  return { current: cur, longest: longest, activeDays: days.length, first: days[0], last: days[days.length - 1] };
}

function monthlySummary() {
  var m = {};
  DB.sessions.forEach(function (s) {
    var k = monthKey(s.date);
    if (!m[k]) m[k] = { key: k, count: 0, minutes: 0, days: {}, courses: {} };
    var b = m[k];
    b.count += num(s.count, 0);
    b.minutes += num(s.minutes, 0);
    b.days[s.date] = 1;
    b.courses[s.courseId] = (b.courses[s.courseId] || 0) + num(s.minutes, 0);
  });
  return Object.keys(m).sort().reverse().map(function (k) {
    var b = m[k], top = '', best = -1;
    Object.keys(b.courses).forEach(function (cid) { if (b.courses[cid] > best) { best = b.courses[cid]; top = cid; } });
    b.activeDays = Object.keys(b.days).length;
    b.topCourse = top;
    return b;
  });
}

/* topic → sessions & co-occurrence, the raw material for the brain map */
function topicStats() {
  var nodes = {}, links = {};
  DB.sessions.forEach(function (s) {
    var ts = (s.topics || []).slice();
    ts.forEach(function (t) {
      var key = s.courseId + '::' + t;
      if (!nodes[key]) nodes[key] = { key: key, topic: t, courseId: s.courseId, count: 0, minutes: 0, last: '' };
      nodes[key].count += num(s.count, 1);
      nodes[key].minutes += num(s.minutes, 0);
      if (s.date > nodes[key].last) nodes[key].last = s.date;
    });
    for (var i = 0; i < ts.length; i++) {
      for (var j = i + 1; j < ts.length; j++) {
        var a = s.courseId + '::' + ts[i], b = s.courseId + '::' + ts[j];
        var lk = a < b ? a + '|' + b : b + '|' + a;
        links[lk] = (links[lk] || 0) + 1;
      }
    }
  });
  return { nodes: nodes, links: links };
}

/* ============================== chrome ================================== */

function toast(msg, ms, actionLabel, actionFn) {
  var wrap = $('#toasts');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + msg + '</span>';
  if (actionLabel) {
    var b = document.createElement('button');
    b.className = 'btn sm primary';
    b.textContent = actionLabel;
    b.onclick = function () { actionFn(); t.remove(); };
    t.appendChild(b);
  }
  wrap.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 2600);
}

/* modal: html string in, optional onMount(box); Esc / scrim closes */
function modal(html, onMount, wide) {
  var root = $('#modal-root'), box = $('#modal-box');
  box.className = 'modal' + (wide ? ' wide' : '');
  box.innerHTML = html;
  root.classList.add('on');
  if (onMount) onMount(box);
  var first = box.querySelector('input,select,textarea,button');
  if (first && first.focus) setTimeout(function () { first.focus(); }, 30);
}
function modalClose() {
  $('#modal-root').classList.remove('on');
  $('#modal-box').innerHTML = '';
}
function confirmBox(title, body, okLabel, onOk) {
  modal(
    '<h2>' + esc(title) + '</h2><p class="sub">' + body + '</p>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
    '<button class="btn danger" id="cb-ok">' + esc(okLabel) + '</button></div>',
    function (box) { box.querySelector('#cb-ok').onclick = function () { modalClose(); onOk(); }; }
  );
}

/* delegated actions: any element with data-act="name" calls ACTIONS.name(el) */
var ACTIONS = {};

/* ------- inputs -------- */

/* a big +/- number field. `name` keys the -/+ buttons and the preset chips;
   the optional `role` lets a form read the field back by DOM scope instead of
   by a global id (see 10-log.js) */
function stepper(name, value, step, min, max, role) {
  return '<div class="stepper">' +
    '<button type="button" data-act="step" data-for="' + name + '" data-by="-' + (step || 1) + '">\u2212</button>' +
    '<input type="number" data-num="' + name + '"' + (role ? ' data-role="' + role + '"' : '') +
    ' value="' + value + '" step="' + (step || 1) + '"' +
    (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + '>' +
    '<button type="button" data-act="step" data-for="' + name + '" data-by="' + (step || 1) + '">+</button>' +
    '</div>';
}
ACTIONS.step = function (el) {
  var f = el.getAttribute('data-for'), by = num(el.getAttribute('data-by'), 1);
  var inp = document.querySelector('[data-num="' + f + '"]');
  if (!inp) return;
  var min = inp.min === '' ? -Infinity : num(inp.min, -Infinity);
  var max = inp.max === '' ? Infinity : num(inp.max, Infinity);
  inp.value = clamp(num(inp.value, 0) + by, min, max);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
};
function readNum(name, d) {
  var inp = document.querySelector('[data-num="' + name + '"]');
  return inp ? num(inp.value, d || 0) : (d || 0);
}
function courseOptions(selected, includeAll) {
  var out = includeAll ? '<option value="">All courses</option>' : '';
  DB.courses.forEach(function (c) {
    if (c.status === 'dropped' && c.id !== selected) return;
    out += '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' +
      esc(c.name) + (c.status === 'completed' ? ' (completed)' : '') + '</option>';
  });
  return out;
}
