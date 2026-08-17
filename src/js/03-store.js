/* =============================================================================
   03-store — the record lives in the repo, at data/study-data.js.

   Reading it needs no server: the file is a plain script that sets
   window.STUDY_DATA, and index.html loads it with a <script> tag, which works
   from file:// where fetch() of a sibling file does not. So `git clone`, open
   index.html, and last night's log is already there.

   Writing it needs the browser's permission, once. On Chrome/Edge/Arc the app
   asks you to point at data/study-data.js the first time ("Connect data file");
   after that every change is written straight into the repo, silently, no
   command and no server. The handle is remembered in IndexedDB, so it survives
   restarts — a click may be needed to re-grant write access after reopening.

   Where that API is missing (Safari, Firefox) the same button downloads the
   file and you drop it into data/ — one drag instead of a terminal.

   localStorage is still written on every change as the working copy, so nothing
   is ever lost between writes to the repo file.
   ========================================================================== */

var STORE = {
  name: 'data/study-data.js',
  can: !!(window.showSaveFilePicker),   // real in-place writing available?
  file: null,                           // FileSystemFileHandle once connected
  granted: false,                       // write permission live right now
  dirty: false,                         // changes not yet in the repo file
  savedAt: null,                        // when we last wrote it
  fromRepo: false,                      // did this session boot from the file?
  busy: false, again: false, error: null
};

var storeTimer = null;
var STASH_KEY = STORE_KEY + '-superseded';
var SEEN_KEY = STORE_KEY + '-file-seen';    // savedAt of the file version we last synced with

/* ---------- the committed file ---------- */

/* what the <script> tag left behind, if anything */
function storeRepoRecord() {
  var rec = window.STUDY_DATA;
  if (!rec || typeof rec !== 'object') return null;
  if (!(rec.courses || []).length && !(rec.sessions || []).length) return null;
  return rec;
}

function storeSummary(rec) {
  rec = rec || {};
  return {
    courses: (rec.courses || []).length,
    sessions: (rec.sessions || []).length,
    savedAt: rec.savedAt || '',
    empty: !(rec.courses || []).length && !(rec.sessions || []).length
  };
}

/* the file's own contents: data as a script, so it loads without a server */
function storeText() {
  return '/* Study Tracker — your data. Written by the app; commit it with the repo.\n' +
    '   Loaded by index.html through a <' + 'script> tag, which is why this is .js and not .json.\n' +
    '   Last write: ' + new Date().toISOString() + ' */\n' +
    'window.STUDY_DATA = ' + JSON.stringify(DB, null, 1) + ';\n';
}

/* ---------- remembering the file between visits ---------- */

function storeIDB(fn) {
  try {
    var req = indexedDB.open('study-tracker-file', 1);
    req.onupgradeneeded = function () { req.result.createObjectStore('h'); };
    req.onsuccess = function () { fn(req.result); };
    req.onerror = function () { fn(null); };
  } catch (e) { fn(null); }
}
function storeRemember(handle) {
  storeIDB(function (db) {
    if (!db) return;
    try { db.transaction('h', 'readwrite').objectStore('h').put(handle, 'file'); } catch (e) { /* ignore */ }
  });
}
function storeForget() {
  storeIDB(function (db) {
    if (!db) return;
    try { db.transaction('h', 'readwrite').objectStore('h').delete('file'); } catch (e) { /* ignore */ }
  });
}
function storeRecall(cb) {
  storeIDB(function (db) {
    if (!db) return cb(null);
    try {
      var r = db.transaction('h').objectStore('h').get('file');
      r.onsuccess = function () { cb(r.result || null); };
      r.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  });
}

/* ---------- permission ---------- */

/* ask = false only checks; asking needs a click, so it is never done silently */
function storePermission(ask, cb) {
  var h = STORE.file;
  if (!h) return cb(false);
  if (!h.queryPermission) { STORE.granted = true; return cb(true); }
  h.queryPermission({ mode: 'readwrite' }).then(function (p) {
    if (p === 'granted') { STORE.granted = true; return cb(true); }
    if (!ask) { STORE.granted = false; return cb(false); }
    h.requestPermission({ mode: 'readwrite' }).then(function (p2) {
      STORE.granted = p2 === 'granted';
      cb(STORE.granted);
    }, function () { cb(false); });
  }, function () { cb(false); });
}

/* ---------- writing ---------- */

/* called by dbSave on every change: debounced, and silent when allowed */
function storeQueue() {
  if (!STORE.file || !STORE.granted) { STORE.dirty = true; storeRefreshLine(); return; }
  clearTimeout(storeTimer);
  storeTimer = setTimeout(function () { storeWrite(); }, 500);
}

function storeWrite(cb) {
  if (!STORE.file) { STORE.dirty = true; storeRefreshLine(); if (cb) cb(false); return; }
  if (STORE.busy) { STORE.again = true; if (cb) cb(false); return; }
  STORE.busy = true;
  var text = storeText();
  storePermission(false, function (ok) {
    if (!ok) {
      STORE.busy = false;
      STORE.dirty = true;
      storeRefreshLine();
      if (cb) cb(false);
      return;
    }
    STORE.file.createWritable().then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    }).then(function () {
      STORE.busy = false;
      STORE.dirty = false;
      STORE.error = null;
      STORE.savedAt = new Date().toISOString();
      storeMarkSeen(DB.savedAt || '');          // this is now the version we have seen
      storeRefreshLine();
      if (STORE.again) { STORE.again = false; storeWrite(); }
      if (cb) cb(true);
    }).catch(function (e) {
      STORE.busy = false;
      STORE.dirty = true;
      STORE.error = String((e && e.message) || e);
      storeRefreshLine();
      if (cb) cb(false);
    });
  });
}

/* ---------- connecting, at the user's click ---------- */

ACTIONS['store-connect'] = function () {
  if (!STORE.can) { ACTIONS['store-download'](); return; }
  window.showSaveFilePicker({
    suggestedName: 'study-data.js',
    types: [{ description: 'Study Tracker data', accept: { 'text/javascript': ['.js'] } }]
  }).then(function (h) {
    STORE.file = h;
    storeRemember(h);
    return new Promise(function (res) { storePermission(true, res); });
  }).then(function (ok) {
    if (!ok) { toast('Write permission was not granted'); return; }
    storeWrite(function (done) {
      toast(done ? 'Connected — every change now writes ' + esc(STORE.name) : 'Could not write the file');
      route();
    });
  }).catch(function (e) {
    if (e && e.name === 'AbortError') return;             // the user cancelled
    toast('Could not open the file picker — use Download instead', 5000);
  });
};

/* re-grant after a restart: one click, no picker */
ACTIONS['store-reconnect'] = function () {
  if (!STORE.file) { ACTIONS['store-connect'](); return; }
  storePermission(true, function (ok) {
    if (!ok) { toast('Write permission was not granted'); return; }
    storeWrite(function (done) {
      toast(done ? 'Writing to ' + esc(STORE.name) + ' again' : 'Could not write the file');
      route();
    });
  });
};

ACTIONS['store-save-now'] = function () {
  if (STORE.file) {
    storePermission(true, function (ok) {
      if (!ok) { toast('Write permission was not granted'); return; }
      storeWrite(function (done) { toast(done ? 'Saved to ' + esc(STORE.name) : 'Write failed'); route(); });
    });
    return;
  }
  ACTIONS['store-download']();
};

ACTIONS['store-download'] = function () {
  downloadFile('study-data.js', storeText(), 'text/javascript');
  storeMarkSeen(DB.savedAt || '');            // the copy you are about to drop in
  STORE.dirty = false;
  storeRefreshLine();
  toast('Downloaded study-data.js — drop it into the data folder of the repo', 7000);
  route();
};

ACTIONS['store-disconnect'] = function () {
  STORE.file = null;
  STORE.granted = false;
  storeForget();
  toast('Disconnected — changes stay in this browser until you save the file');
  route();
};

/* ---------- boot ---------- */

/* which version of the file this browser has already taken in */
function storeSeen() {
  try { return localStorage.getItem(SEEN_KEY) || ''; } catch (e) { return ''; }
}
function storeMarkSeen(stamp) {
  try { localStorage.setItem(SEEN_KEY, stamp || ''); } catch (e) { /* ignore */ }
}

/* Pick between the committed file and this browser's working copy.

   Timestamps alone cannot tell "the file changed elsewhere" from "this browser
   moved on", and a file written by a machine with a skewed clock would keep
   winning. So the deciding question is whether the file is a version this
   browser has NOT seen before (someone committed, you pulled) — only then does
   it win. Otherwise the local copy, which may hold unsaved work, is kept. */
function storeChoose(repoRec, localRec) {
  var r = storeSummary(repoRec), l = storeSummary(localRec);
  if (!repoRec && !localRec) return { rec: null, source: 'none' };
  if (!repoRec) return { rec: localRec, source: 'browser' };
  if (!localRec || l.empty) return { rec: repoRec, source: 'repo' };

  var fileIsNew = (r.savedAt || '') !== storeSeen();
  if (fileIsNew) return { rec: repoRec, source: 'repo' };
  return { rec: localRec, source: 'browser' };
}

/* after the UI is up: quietly reattach the file we were writing last time */
function storeReattach() {
  if (!STORE.can) return;
  storeRecall(function (h) {
    if (!h) return;
    STORE.file = h;
    storePermission(false, function (ok) {
      storeRefreshLine();
      if (ok && STORE.dirty) storeWrite();
    });
  });
}

/* a cheap identity for a record: which sessions and courses it actually holds.
   Counting alone is not enough — two copies can hold three different sessions. */
function storeSig(rec) {
  rec = rec || {};
  var ses = (rec.sessions || []).map(function (s) { return s.id; }).sort().join('|');
  var crs = (rec.courses || []).map(function (c) { return c.id; }).sort().join('|');
  return ses + '#' + crs;
}

/* When the file wins at startup, the browser copy it replaced is stashed rather
   than dropped: neither a skewed clock nor a stale commit may eat work. */
function storeStash(rec) {
  try { localStorage.setItem(STASH_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
}
function storeStashed() {
  try {
    var raw = localStorage.getItem(STASH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
ACTIONS['store-stash-restore'] = function () {
  var rec = storeStashed();
  if (!rec) { toast('Nothing stashed'); return; }
  var sm = storeSummary(rec);
  confirmBox('Go back to the superseded copy?',
    'It has <b>' + sm.sessions + ' sessions</b> across ' + sm.courses + ' courses' +
    (sm.savedAt ? ', last saved ' + esc(String(sm.savedAt).replace('T', ' ').slice(0, 16)) : '') +
    '. This replaces what is loaded now; the data file is only overwritten when you save.',
    'Use that copy', function () {
      DB = Object.assign(blankDB(), rec);
      DB.profile = Object.assign(blankDB().profile, rec.profile || {});
      DB.pomoCfg = Object.assign(blankDB().pomoCfg, rec.pomoCfg || {});
      ['courses', 'sessions', 'resources', 'notebooks'].forEach(function (k) {
        if (!Array.isArray(DB[k])) DB[k] = [];
      });
      try { localStorage.removeItem(STASH_KEY); } catch (e) { /* ignore */ }
      STORE.dirty = true;
      dbSave(true);
      toast('Restored — save it to the data file when you are happy with it', 6000);
      route();
    });
};
ACTIONS['store-stash-drop'] = function () {
  try { localStorage.removeItem(STASH_KEY); } catch (e) { /* ignore */ }
  toast('Discarded');
  route();
};

/* ---------- status ---------- */

function storeLine() {
  var where = 'The record for this repo is <b>' + esc(STORE.name) + '</b>, loaded when you open the app.';
  if (!STORE.can) {
    return where + ' This browser cannot write files in place, so changes are kept here and you ' +
      'update the file with <b>Download data file</b>, then drop it into <code>data/</code>. ' +
      'Chrome, Edge or Arc can write it directly.' +
      (STORE.dirty ? ' <span style="color:var(--sale)">There are changes not yet in the file.</span>' : '');
  }
  if (STORE.file && STORE.granted) {
    return where + ' Connected: every change is written straight into it' +
      (STORE.savedAt ? ', last write ' + esc(STORE.savedAt.replace('T', ' ').slice(0, 19)) : '') + '.' +
      (STORE.error ? ' <span style="color:var(--sale)">Last attempt failed: ' + esc(STORE.error) + '</span>' : '');
  }
  if (STORE.file) {
    return where + ' <b>Write access needs one click</b> after reopening the browser — until then changes ' +
      'stay in this browser.' + (STORE.dirty ? ' <span style="color:var(--sale)">Unsaved changes are waiting.</span>' : '');
  }
  return where + ' Not connected yet: <b>Connect data file</b> and point at ' + esc(STORE.name) +
    ' once, and from then on the app writes it itself.' +
    (STORE.dirty ? ' <span style="color:var(--sale)">Changes so far are only in this browser.</span>' : '');
}

function storeRefreshLine() {
  var el = $('#store-line');
  if (el) el.innerHTML = storeLine();
  var foot = $('#store-foot');
  if (foot) {
    foot.innerHTML = (STORE.file && STORE.granted)
      ? 'Writing to <b>' + esc(STORE.name) + '</b>. <a href="#/data">Data</a>.'
      : (STORE.dirty ? '<b>Unsaved</b> to the repo file. <a href="#/data">Save it</a>.'
                     : 'Working copy in this browser. <a href="#/data">Data</a>.');
  }
}

/* the buttons for the Data page, in the order that makes sense right now */
function storeButtonsHTML() {
  var b = [];
  if (STORE.can && !STORE.file) b.push('<button class="btn primary" data-act="store-connect">Connect data file</button>');
  if (STORE.can && STORE.file && !STORE.granted) b.push('<button class="btn primary" data-act="store-reconnect">Allow writing again</button>');
  if (STORE.file && STORE.granted) b.push('<button class="btn" data-act="store-save-now">Save now</button>');
  b.push('<button class="btn' + (!STORE.can && STORE.dirty ? ' primary' : '') + '" data-act="store-download">Download data file</button>');
  if (STORE.file) b.push('<button class="btn ghost" data-act="store-disconnect">Disconnect</button>');
  return b.join('');
}
