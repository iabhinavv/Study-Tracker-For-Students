/* =============================================================================
   95-data — settings, first-run setup, CSV import, JSON backup/restore.

   There is no server and no account, so a backup is a file you keep. Export
   whenever you have done real work; the file restores everything exactly.
   ========================================================================== */

function downloadFile(name, text, mime) {
  var blob = new Blob([text], { type: mime || 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

/* --- CSV: a small but correct parser (quotes, embedded commas/newlines) --- */
function parseCSV(text) {
  var rows = [], row = [], cur = '', q = false, i, ch;
  text = String(text).replace(/\r\n?/g, '\n');
  for (i = 0; i < text.length; i++) {
    ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
}

function csvEscape(v) {
  v = String(v == null ? '' : v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/* find the header row, then map the columns we care about */
function coursesFromCSV(text) {
  var rows = parseCSV(text);
  var hdr = -1, map = {};
  for (var r = 0; r < rows.length && hdr < 0; r++) {
    var low = rows[r].map(function (c) { return String(c).trim().toLowerCase(); });
    if (low.indexOf('subject') >= 0 || low.indexOf('course') >= 0 || low.indexOf('name') >= 0) {
      hdr = r;
      low.forEach(function (c, i) {
        if (/^(subject|course|name|course name)$/.test(c)) map.name = i;
        else if (/link|url|playlist|class/.test(c) && map.link == null) map.link = i;
        else if (/resource|material|folder|drive/.test(c) && map.res == null) map.res = i;
        else if (/total/.test(c)) map.total = i;
        else if (/remain|left/.test(c)) map.remaining = i;
        else if (/deadline|due/.test(c)) map.deadline = i;
        else if (/categor|topic/.test(c)) map.topics = i;
      });
    }
  }
  if (hdr < 0) return null;
  var out = [];
  for (var k = hdr + 1; k < rows.length; k++) {
    var row = rows[k];
    var name = String(row[map.name] || '').trim();
    if (!name) continue;
    var total = num(row[map.total], 0);
    var remaining = map.remaining != null && String(row[map.remaining]).trim() !== '' ? num(row[map.remaining], total) : total;
    out.push({
      name: name,
      link: String(row[map.link] || '').trim(),
      res: String(row[map.res] || '').trim(),
      total: total,
      done: Math.max(0, total - remaining),
      deadline: map.deadline != null ? String(row[map.deadline] || '').trim() : '',
      topics: map.topics != null ? String(row[map.topics] || '').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean) : []
    });
  }
  return out;
}

function importCourseRows(rows, opts) {
  opts = opts || {};
  var added = 0, updated = 0, res = 0;
  rows.forEach(function (r) {
    var existing = DB.courses.filter(function (c) { return c.name.toLowerCase() === r.name.toLowerCase(); })[0];
    var c = existing;
    if (!c) {
      c = newCourse({
        name: r.name, link: r.link, totalSessions: r.total, doneOffset: r.done,
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(r.deadline) ? r.deadline : '',
        categories: r.topics
      });
      c.color = PALETTE[DB.courses.length % PALETTE.length];
      DB.courses.push(c);
      added++;
    } else if (opts.update) {
      if (r.link) c.link = r.link;
      if (r.total) c.totalSessions = r.total;
      if (r.done) c.doneOffset = r.done;
      if (r.topics.length) r.topics.forEach(function (t) { if (c.categories.indexOf(t) < 0) c.categories.push(t); });
      updated++;
    }
    if (r.res) {
      var dupe = DB.resources.filter(function (x) { return x.url === r.res && x.courseId === c.id; })[0];
      if (!dupe) {
        DB.resources.push({
          id: uid(), title: r.name + ' — course materials', url: r.res,
          type: guessType(r.res), courseId: c.id, status: 'todo', notes: 'From CSV import',
          addedAt: new Date().toISOString()
        });
        res++;
      }
    }
  });
  dbSave(true);
  toast('Imported ' + added + ' course' + (added === 1 ? '' : 's') +
        (updated ? ', updated ' + updated : '') + (res ? ', + ' + res + ' resources' : ''), 4000);
  return { added: added, updated: updated, res: res };
}

function seedStarter() {
  importCourseRows(STARTER_COURSES.map(function (r) {
    return { name: r[0], link: r[1], res: r[2], total: r[3], done: Math.max(0, r[3] - r[4]), deadline: '', topics: [] };
  }), { update: false });
  route();
}

ACTIONS['csv-import-open'] = function () {
  modal(
    '<h2>Import courses from CSV</h2>' +
    '<p class="sub">Any CSV with a <b>Subject</b> (or Course/Name) column works. Optional columns: ' +
    'Course Link, Resources, Total Sessions, Remaining, Deadline, Topics. Header row can sit anywhere near the top.</p>' +
    '<div class="field"><label class="f">Pick a CSV file</label><input type="file" id="csv-file" accept=".csv,text/csv"></div>' +
    '<div class="field"><label class="f">…or paste the rows here</label>' +
      '<textarea id="csv-text" style="min-height:120px" placeholder="Subject,Course Link,Total Sessions,Remaining&#10;Statistics,https://…,70,70"></textarea></div>' +
    '<label class="mini"><input type="checkbox" id="csv-update" checked> update courses that already exist (same name)</label>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn" data-act="seed-starter">Use starter list</button>' +
      '<button class="btn primary" id="csv-ok">Import</button></div>',
    function (box) {
      var text = '';
      box.querySelector('#csv-file').onchange = function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { text = fr.result; box.querySelector('#csv-text').value = String(text).slice(0, 4000); };
        fr.readAsText(f);
      };
      box.querySelector('#csv-ok').onclick = function () {
        var raw = box.querySelector('#csv-text').value.trim() || text;
        if (!raw) { toast('Pick a file or paste some rows'); return; }
        var rows = coursesFromCSV(raw);
        if (!rows || !rows.length) { toast('Could not find a Subject/Course column'); return; }
        importCourseRows(rows, { update: box.querySelector('#csv-update').checked });
        modalClose();
        location.hash = '#/classroom';
        route();
      };
    }
  );
};

/* ------------------------------- first run ------------------------------- */

function onboarding() {
  modal(
    '<h2>Welcome</h2>' +
    '<p class="sub">Two questions, then you are in. Your log is kept in <code>data/study-data.js</code> ' +
    'inside this folder — no account, no server, nothing uploaded. The Data page shows how to let the app ' +
    'write that file itself.</p>' +
    '<div class="grid g2" style="gap:12px">' +
      '<div class="field"><label class="f">Your name (optional)</label><input type="text" id="ob-name" placeholder="for the greeting"></div>' +
      '<div class="field"><label class="f">A session is usually…</label>' + stepper('ob-len', 45, 5, 5, 240) + '<div class="hint">minutes — just the default in the log form</div></div>' +
    '</div>' +
    '<div class="field"><label class="f">Daily goal</label>' + stepper('ob-goal', 120, 15, 0, 900) + '<div class="hint">minutes per day; 0 = no goal ring</div></div>' +
    '<h3 style="margin-top:18px">Start with</h3>' +
    '<div class="grid g3">' +
      '<button class="btn pick" id="ob-starter">' +
        '<b>The starter list</b><span class="mini">' + STARTER_COURSES.length + ' courses from the CSV in this folder</span></button>' +
      '<button class="btn pick" id="ob-csv">' +
        '<b>My own CSV</b><span class="mini">import your curriculum</span></button>' +
      '<button class="btn pick" id="ob-blank">' +
        '<b>Empty</b><span class="mini">add courses as you go</span></button>' +
    '</div>',
    function (box) {
      function commit() {
        DB.profile.name = box.querySelector('#ob-name').value.trim();
        DB.profile.sessionMinutes = readNum('ob-len', 45);
        DB.profile.dailyGoalMin = readNum('ob-goal', 120);
        DB.onboarded = true;
        dbSave(true);
      }
      box.querySelector('#ob-starter').onclick = function () { commit(); modalClose(); seedStarter(); location.hash = '#/classroom'; };
      box.querySelector('#ob-csv').onclick = function () { commit(); ACTIONS['csv-import-open'](); };
      box.querySelector('#ob-blank').onclick = function () { commit(); modalClose(); location.hash = '#/classroom'; route(); };
    }
  );
}

/* ------------------------------ data page -------------------------------- */

function renderData(v) {
  var raw = JSON.stringify(DB);
  var kb = (raw.length / 1024).toFixed(1);
  var st = streaks();

  var h = '<h1>Data &amp; Backup</h1><p class="sub">Where the record is kept, and how to get a copy of it out.</p>';

  h += '<div class="card" style="margin-bottom:16px"><h3>Where your data lives</h3>' +
    '<div class="mini" id="store-line">' + storeLine() + '</div>' +
    '<div class="row" style="margin-top:12px">' + storeButtonsHTML() + '</div>' +
    '<div class="hint">Commit <code>' + esc(STORE.name) + '</code> and your log travels with the repo — ' +
    'clone it anywhere, open <code>index.html</code>, and it is all there.</div>' +
    '</div>';

  var stash = storeStashed();
  if (stash) {
    var sm = storeSummary(stash);
    h += '<div class="card" style="border-left:3px solid var(--warn);margin-bottom:16px">' +
      '<h3 style="color:var(--warn)">A superseded copy is being held</h3>' +
      '<div class="mini">The data file was newer at startup, so it was loaded — and the copy this browser ' +
      'was holding (<b>' + sm.sessions + '</b> sessions, <b>' + sm.courses + '</b> courses' +
      (sm.savedAt ? ', saved ' + esc(String(sm.savedAt).replace('T', ' ').slice(0, 16)) : '') +
      ') was kept rather than thrown away.</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button class="btn" data-act="store-stash-restore">Use that copy instead</button>' +
        '<button class="btn ghost" data-act="store-stash-drop">Discard it</button></div>' +
      '</div>';
  }

  h += '<div class="grid g2">';
  h += '<div class="card"><h2>Backup</h2>' +
    '<div class="row tight mini" style="margin-bottom:12px">' +
      '<span class="pill"><b>' + DB.courses.length + '</b> courses</span>' +
      '<span class="pill"><b>' + DB.sessions.length + '</b> sessions</span>' +
      '<span class="pill"><b>' + DB.resources.length + '</b> resources</span>' +
      '<span class="pill"><b>' + DB.notebooks.length + '</b> notebooks</span>' +
      '<span class="pill"><b>' + kb + ' KB</b> stored</span></div>' +
    '<div class="row">' +
      '<button class="btn primary" data-act="exp-json">Export backup (.json)</button>' +
      '<button class="btn" data-act="exp-csv">Sessions (.csv)</button>' +
      '<button class="btn" data-act="exp-courses">Courses (.csv)</button>' +
    '</div>' +
    '<div class="hint">' + (DB.lastExport ? 'Last export: ' + fmtDate(DB.lastExport) : 'You have not exported yet.') + '</div>' +
    '<h3 style="margin-top:18px">Restore</h3>' +
    '<div class="row"><input type="file" id="imp-file" accept=".json,application/json">' +
      '<label class="mini"><input type="checkbox" id="imp-merge"> merge instead of replace</label></div>' +
    '<div class="hint">Replace overwrites whatever is stored now (the folder file, or this browser). Merge adds courses and sessions that are not already there.</div>' +
    '</div>';

  h += '<div class="card"><h2>Preferences</h2>' +
    '<div class="field"><label class="f">Name</label><input type="text" id="pf-name" value="' + esc(DB.profile.name) + '"></div>' +
    '<div class="grid g2" style="gap:12px">' +
      '<div class="field"><label class="f">Default session length (min)</label>' + stepper('pf-len', DB.profile.sessionMinutes, 5, 5, 240) + '</div>' +
      '<div class="field"><label class="f">Daily goal (min)</label>' + stepper('pf-goal', DB.profile.dailyGoalMin, 15, 0, 900) + '</div>' +
    '</div>' +
    '<button class="btn primary" data-act="pf-save">Save preferences</button>' +
    '<h3 style="margin-top:20px">Import</h3>' +
    '<button class="btn" data-act="csv-import-open">Import courses from CSV</button> ' +
    '<button class="btn" data-act="seed-starter">Add the starter list</button>' +
    '<h3 style="margin-top:20px">Danger zone</h3>' +
    '<div class="row"><button class="btn danger" data-act="wipe">Erase everything</button>' +
      '<button class="btn danger" data-act="wipe-sessions">Erase logged sessions only</button></div>' +
    '<div class="hint">There is no undo. Export first.</div>' +
    '</div>';
  h += '</div>';

  h += '<div class="sechead"><h2>What is stored</h2></div>' +
    '<div class="card mini">' +
      '<p>One record — courses, logged sessions (' +
      (st.first ? fmtShort(st.first) + ' to ' + fmtShort(st.last) : 'none yet') +
      '), resources, notebook links, timer settings and preferences.</p>' +
      '<p>It lives in <code>' + esc(STORE.name) + '</code> inside this folder, as a small script that sets ' +
      '<code>window.STUDY_DATA</code>. That is why the app can read it with no server: <code>index.html</code> ' +
      'loads it with a script tag, which works even when you open the page straight from disk. Commit it and ' +
      'the data is part of the repo like any other file — clone, pull, push, diff.</p>' +
      '<p>While you work, every change is also kept in this browser under the key <code>' + STORE_KEY + '</code>, ' +
      'so nothing is lost between writes to the file. Whichever copy is newer wins at startup, so a ' +
      '<code>git pull</code> from another machine is picked up automatically.</p>' +
      '<p>No cookies, no analytics, and no request ever leaves this machine — the page works with Wi-Fi off.</p>' +
    '</div>';

  v.innerHTML = h;

  var imp = $('#imp-file');
  imp.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var merge = $('#imp-merge').checked;
    var fr = new FileReader();
    fr.onload = function () {
      var got;
      try { got = JSON.parse(fr.result); } catch (err) { toast('That is not a valid backup file'); return; }
      if (!got || !Array.isArray(got.courses)) { toast('That file has no courses in it'); return; }
      if (merge) {
        var have = {};
        DB.courses.forEach(function (c) { have[c.name.toLowerCase()] = c.id; });
        (got.courses || []).forEach(function (c) {
          if (have[c.name.toLowerCase()]) return;
          var copy = Object.assign({}, c);
          have[c.name.toLowerCase()] = copy.id;
          DB.courses.push(copy);
        });
        var seen = {};
        DB.sessions.forEach(function (s) { seen[s.id] = 1; });
        (got.sessions || []).forEach(function (s) { if (!seen[s.id]) DB.sessions.push(s); });
        (got.resources || []).forEach(function (r) {
          if (!DB.resources.some(function (x) { return x.title === r.title && x.url === r.url; })) DB.resources.push(r);
        });
        (got.notebooks || []).forEach(function (n) {
          if (!DB.notebooks.some(function (x) { return x.title === n.title && x.url === n.url; })) DB.notebooks.push(n);
        });
        dbSave(true);
        toast('Merged backup in');
      } else {
        DB = Object.assign(blankDB(), got);
        DB.onboarded = true;
        dbSave(true);
        toast('Backup restored');
      }
      route();
    };
    fr.readAsText(f);
  };
}

ACTIONS['exp-json'] = function () {
  DB.lastExport = today();
  dbSave(true);
  downloadFile('study-tracker-backup-' + today() + '.json', JSON.stringify(DB, null, 2));
  toast('Backup downloaded');
  route();
};
ACTIONS['exp-csv'] = function () {
  var head = ['date', 'course', 'sessions', 'minutes', 'topics', 'note'];
  var lines = [head.join(',')];
  DB.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (s) {
    lines.push([s.date, courseName(s.courseId), num(s.count, 0), num(s.minutes, 0),
                (s.topics || []).join('; '), s.note || ''].map(csvEscape).join(','));
  });
  downloadFile('study-sessions-' + today() + '.csv', lines.join('\n'), 'text/csv');
};
ACTIONS['exp-courses'] = function () {
  var lines = ['Subject,Course Link,Resources,Total Sessions,Remaining,Deadline,Topics,Status'];
  DB.courses.forEach(function (c) {
    var p = progressOf(c);
    var res = DB.resources.filter(function (r) { return r.courseId === c.id; })[0];
    lines.push([c.name, c.link, res ? res.url : '', c.totalSessions, p.remaining, c.deadline,
                (c.categories || []).join('; '), c.status].map(csvEscape).join(','));
  });
  downloadFile('study-courses-' + today() + '.csv', lines.join('\n'), 'text/csv');
};
ACTIONS['pf-save'] = function () {
  DB.profile.name = $('#pf-name').value.trim();
  DB.profile.sessionMinutes = readNum('pf-len', 45);
  DB.profile.dailyGoalMin = readNum('pf-goal', 120);
  dbSave(true);
  toast('Preferences saved');
  route();
};
ACTIONS['wipe'] = function () {
  confirmBox('Erase everything?', 'All courses, sessions, resources and notebook links in this browser will be gone. ' +
    'Export a backup first if you are not sure.', 'Erase everything', function () {
    localStorage.removeItem(STORE_KEY);
    DB = blankDB();
    dbSave(true);
    location.hash = '#/dashboard';
    route();
    onboarding();
  });
};
ACTIONS['wipe-sessions'] = function () {
  confirmBox('Erase logged sessions?', 'Courses, resources and notebooks stay. All ' + DB.sessions.length +
    ' logged sessions go.', 'Erase sessions', function () {
    DB.sessions = [];
    dbSave(true); toast('Sessions erased'); route();
  });
};
