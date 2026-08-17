/* =============================================================================
   10-log — the quick-log form (the thing you touch every day) and session edit.

   Design goal: log a session in ~3 keystrokes. The form remembers the last
   course, defaults minutes to your usual session length, and Enter saves.

   IMPORTANT — why this file looks paranoid about which form it is reading:
   the same form can be on screen twice (inline on the Dashboard, and inside a
   dialog opened from anywhere else), and a dialog can be dismissed without the
   page re-rendering. So the form is NEVER resolved from a module-level
   variable; it is resolved from the DOM, starting at the button that was
   clicked (`[data-logform]` ancestor) and reading fields by `data-role` inside
   that one element. If the form cannot be resolved, saving refuses rather than
   quietly writing default values.
   ========================================================================== */

var LOGF = { courseId: null, date: null, topics: [], p: 'log' };

function logReset(dateIso) {
  LOGF.courseId = DB.lastCourseId && courseById(DB.lastCourseId) && courseById(DB.lastCourseId).status === 'active'
    ? DB.lastCourseId
    : (activeCourses()[0] ? activeCourses()[0].id : null);
  LOGF.date = dateIso || today();
  LOGF.topics = [];
}

/* ---- resolving the live form ---- */

/* the form the user is actually in: the one containing the clicked control,
   else the one inside an open dialog, else the one on the page */
function logRoot(el) {
  if (el && el.closest) {
    var owned = el.closest('[data-logform]');
    if (owned) return owned;
  }
  if ($('#modal-root').classList.contains('on')) {
    var inModal = $('#modal-box [data-logform]');
    if (inModal) return inModal;
  }
  return $('[data-logform]');
}
function logField(root, role) { return root ? root.querySelector('[data-role="' + role + '"]') : null; }
function logNum(root, role, dflt) {
  var i = logField(root, role);
  if (!i) return null;                       // missing field: the caller decides
  var n = parseFloat(i.value);
  return isFinite(n) ? n : dflt;
}

function topicPickerHTML(courseId, chosen) {
  var c = courseById(courseId);
  if (!c) return '';
  var cats = c.categories || [];
  var html = '<label class="f">Topics covered <span class="plain">— these grow your brain map</span></label>';
  if (!cats.length) {
    html += '<div class="hint" style="margin:0 0 8px">No topics on this course yet. Add a few — they become the nodes of your map.</div>';
  }
  html += '<div class="chips" style="margin-bottom:8px">';
  cats.forEach(function (t) {
    var on = chosen.indexOf(t) >= 0;
    html += '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="log-topic" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
  });
  html += '<button type="button" class="chip" data-act="log-newtopic">+ add topic</button>';
  html += '</div>';
  return html;
}

/* opts.prefix only keeps the stepper/chip targets unique between two copies */
function logCardHTML(opts) {
  opts = opts || {};
  var p = opts.prefix || 'log';
  LOGF.p = p;
  var courses = DB.courses.filter(function (c) { return c.status !== 'dropped'; });
  if (!courses.length) {
    return '<div class="card"><h2>Log a session</h2><div class="empty">Add a course first — ' +
      '<a href="#/classroom">go to Classroom</a>.</div></div>';
  }
  var mins = DB.profile.sessionMinutes || 45;
  return '' +
  '<div class="card" id="' + p + '-card" data-logform="' + p + '">' +
    '<div class="row" style="margin-bottom:14px"><h2 style="margin:0">Log a session</h2>' +
      '<span class="spacer"></span>' +
      '<span class="mini">Enter saves</span></div>' +
    '<div class="grid" style="gap:12px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
      '<div class="field"><label class="f">Course</label>' +
        '<select data-role="course">' + courseOptions(LOGF.courseId) + '</select></div>' +
      '<div class="field"><label class="f">Date</label>' +
        '<input type="date" data-role="date" value="' + esc(LOGF.date || today()) + '" max="' + today() + '"></div>' +
    '</div>' +
    '<div class="grid" style="gap:12px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
      '<div class="field"><label class="f">Sessions / lectures done</label>' + stepper(p + '-count', 1, 1, 0, 99, 'count') +
        '<div class="chips" style="margin-top:8px">' +
          [1, 2, 3, 5].map(function (n) { return '<button type="button" class="chip" data-act="set-num" data-target="' + p + '-count" data-val="' + n + '">' + n + '</button>'; }).join('') +
        '</div></div>' +
      '<div class="field"><label class="f">Minutes studied</label>' + stepper(p + '-mins', mins, 5, 0, 1440, 'mins') +
        '<div class="chips" style="margin-top:8px">' +
          [15, 25, 45, 60, 90, 120].map(function (n) { return '<button type="button" class="chip" data-act="set-num" data-target="' + p + '-mins" data-val="' + n + '">' + n + '</button>'; }).join('') +
        '</div></div>' +
    '</div>' +
    '<div class="field" data-role="topics">' + topicPickerHTML(LOGF.courseId, LOGF.topics) + '</div>' +
    '<div class="field"><label class="f">Note (optional)</label>' +
      '<input type="text" data-role="note" placeholder="e.g. finished Ch.4 problems, revisit Bayes"></div>' +
    '<div class="row"><button class="btn primary" data-act="log-save">Save session</button>' +
      '<span class="mini" data-role="echo"></span></div>' +
  '</div>';
}

function wireLog() {
  var root = $('[data-logform="' + LOGF.p + '"]');
  if (!root) return;
  var sel = logField(root, 'course');
  sel.onchange = function () {
    LOGF.courseId = sel.value;
    LOGF.topics = [];
    logField(root, 'topics').innerHTML = topicPickerHTML(LOGF.courseId, LOGF.topics);
    updateLogEcho(root);
  };
  var d = logField(root, 'date');
  if (d) d.onchange = function () { LOGF.date = d.value; updateLogEcho(root); };
  ['count', 'mins'].forEach(function (role) {
    var i = logField(root, role);
    if (i) i.addEventListener('input', function () { updateLogEcho(root); });
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      ACTIONS['log-save'](e.target);          // pass the field, so the form resolves from it
    }
  });
  updateLogEcho(root);
}

function updateLogEcho(root) {
  root = root || logRoot(null);
  var e = logField(root, 'echo');
  if (!e) return;
  var sel = logField(root, 'course');
  var c = courseById(sel ? sel.value : LOGF.courseId);
  if (!c) { e.textContent = ''; return; }
  var pr = progressOf(c);
  var add = logNum(root, 'count', 0) || 0, mins = logNum(root, 'mins', 0) || 0;
  e.innerHTML = c.totalSessions
    ? 'After saving: <b>' + (pr.done + add) + ' / ' + c.totalSessions + '</b> sessions, <b>' + fmtMins(pr.minutes + mins) + '</b> tracked'
    : 'After saving: <b>' + fmtMins(pr.minutes + mins) + '</b> tracked on ' + esc(c.name);
}

ACTIONS['set-num'] = function (el) {
  var t = el.getAttribute('data-target');
  var inp = document.querySelector('[data-num="' + t + '"]');
  if (inp) { inp.value = el.getAttribute('data-val'); inp.dispatchEvent(new Event('input', { bubbles: true })); }
};

ACTIONS['log-topic'] = function (el) {
  var t = el.getAttribute('data-topic');
  var i = LOGF.topics.indexOf(t);
  if (i >= 0) LOGF.topics.splice(i, 1); else LOGF.topics.push(t);
  el.classList.toggle('on');
};

/* adding a topic happens inline — a dialog here would wipe a half-filled form
   when the log form is itself inside the dialog */
ACTIONS['log-newtopic'] = function (el) {
  var root = logRoot(el);
  var sel = logField(root, 'course');
  var c = courseById(sel ? sel.value : LOGF.courseId);
  if (!c) { toast('Pick a course first'); return; }
  var row = el.parentNode;
  var box = document.createElement('span');
  box.className = 'row tight';
  box.innerHTML = '<input type="text" data-role="newtopic" placeholder="Topic name, Enter to add" style="max-width:210px">';
  row.replaceChild(box, el);
  var inp = box.querySelector('input');
  inp.focus();
  var commit = function (keep) {
    String(inp.value).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (t) {
      if (c.categories.indexOf(t) < 0) c.categories.push(t);
      if (LOGF.topics.indexOf(t) < 0) LOGF.topics.push(t);
    });
    dbSave(true);
    logField(root, 'topics').innerHTML = topicPickerHTML(c.id, LOGF.topics);
    if (keep) {
      var again = logField(root, 'topics').querySelector('[data-act="log-newtopic"]');
      if (again) ACTIONS['log-newtopic'](again);
    }
  };
  inp.onkeydown = function (e) {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(true); }
    else if (e.key === 'Escape') { e.stopPropagation(); logField(root, 'topics').innerHTML = topicPickerHTML(c.id, LOGF.topics); }
  };
  inp.onblur = function () { commit(false); };
};

ACTIONS['log-save'] = function (el) {
  var root = logRoot(el);
  if (!root) { toast('Could not find the log form — reopen it and try again', 4000); return; }

  var sel = logField(root, 'course');
  var c = courseById(sel ? sel.value : null);
  if (!c) { toast('Pick a course first'); return; }

  /* a missing field is a bug, not a reason to invent a number */
  var count = logNum(root, 'count', 1);
  var mins = logNum(root, 'mins', DB.profile.sessionMinutes);
  if (count === null || mins === null) { toast('Could not read the form — reopen it and try again', 4000); return; }
  if (count <= 0 && mins <= 0) { toast('Nothing to log — add sessions or minutes'); return; }

  var dateEl = logField(root, 'date'), noteEl = logField(root, 'note');
  var date = (dateEl && dateEl.value) || today();
  var note = (noteEl && noteEl.value.trim()) || '';

  DB.sessions.push({
    id: uid(), courseId: c.id, date: date, count: count, minutes: mins,
    topics: LOGF.topics.slice(), note: note, createdAt: new Date().toISOString()
  });
  DB.lastCourseId = c.id;
  dbSave(true);

  var pr = progressOf(c);
  toast('Logged: ' + esc(c.name) + ' · ' + count + ' session' + (count === 1 ? '' : 's') + ' · ' + fmtMins(mins) +
        ' · ' + fmtMins(pr.minutes) + ' total' + (c.totalSessions ? ', ' + pr.remaining + ' left' : ''));
  if (c.totalSessions && pr.remaining === 0 && c.status === 'active') {
    setTimeout(function () { askCourseFinished(c.id); }, 400);
  }
  LOGF.topics = [];
  if ($('#modal-root').classList.contains('on')) modalClose();
  route();
};

/* --------------------------- session editing ---------------------------- */

function sessionById(id) {
  for (var i = 0; i < DB.sessions.length; i++) if (DB.sessions[i].id === id) return DB.sessions[i];
  return null;
}

ACTIONS['sess-edit'] = function (el) {
  var s = sessionById(el.getAttribute('data-id'));
  if (!s) return;
  var c = courseById(s.courseId);
  var cats = (c && c.categories) || [];
  modal(
    '<h2>Edit session</h2>' +
    '<div class="grid g2" style="gap:12px">' +
      '<div class="field"><label class="f">Course</label><select id="e-course">' + courseOptions(s.courseId) + '</select></div>' +
      '<div class="field"><label class="f">Date</label><input type="date" id="e-date" value="' + esc(s.date) + '"></div>' +
      '<div class="field"><label class="f">Sessions</label>' + stepper('e-count', num(s.count, 1), 1, 0, 99) + '</div>' +
      '<div class="field"><label class="f">Minutes</label>' + stepper('e-mins', num(s.minutes, 0), 5, 0, 1440) + '</div>' +
    '</div>' +
    '<div class="field"><label class="f">Topics</label><div class="chips" id="e-topics">' +
      cats.map(function (t) {
        return '<button class="chip' + ((s.topics || []).indexOf(t) >= 0 ? ' on' : '') + '" data-act="e-topic" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div></div>' +
    '<div class="field"><label class="f">Note</label><input type="text" id="e-note" value="' + esc(s.note || '') + '"></div>' +
    '<div class="modal-foot">' +
      '<button class="btn danger" data-act="sess-del" data-id="' + s.id + '">Delete</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn primary" id="e-ok">Save</button>' +
    '</div>',
    function (box) {
      var picked = (s.topics || []).slice();
      ACTIONS['e-topic'] = function (b) {
        var t = b.getAttribute('data-topic'), i = picked.indexOf(t);
        if (i >= 0) picked.splice(i, 1); else picked.push(t);
        b.classList.toggle('on');
      };
      box.querySelector('#e-ok').onclick = function () {
        s.courseId = box.querySelector('#e-course').value;
        s.date = box.querySelector('#e-date').value || s.date;
        s.count = num(box.querySelector('[data-num="e-count"]').value, 1);
        s.minutes = num(box.querySelector('[data-num="e-mins"]').value, 0);
        s.note = box.querySelector('#e-note').value.trim();
        s.topics = picked;
        dbSave(true);
        modalClose();
        toast('Session updated — ' + fmtMins(s.minutes) + ' on ' + esc(courseName(s.courseId)));
        route();
      };
    }
  );
};

ACTIONS['sess-del'] = function (el) {
  var id = el.getAttribute('data-id');
  DB.sessions = DB.sessions.filter(function (s) { return s.id !== id; });
  dbSave(true);
  modalClose();
  toast('Session deleted');
  route();
};

function sessionRowsHTML(list, opts) {
  opts = opts || {};
  if (!list.length) return '<div class="empty">Nothing logged yet.</div>';
  return list.map(function (s) {
    var c = courseById(s.courseId);
    return '<div class="sess-row">' +
      '<span class="dot" style="background:' + (c ? courseColor(c.id) : '#888') + '"></span>' +
      '<div style="min-width:0;flex:1 1 auto">' +
        '<div style="font-weight:600">' + esc(c ? c.name : 'Deleted course') +
          (opts.showDate === false ? '' : ' <span class="mini">· ' + fmtShort(s.date) + '</span>') + '</div>' +
        '<div class="mini">' + num(s.count, 0) + ' session' + (num(s.count, 0) === 1 ? '' : 's') + ' · ' + fmtMins(s.minutes) +
          ((s.topics && s.topics.length) ? ' · ' + s.topics.map(esc).join(', ') : '') +
          (s.note ? ' · ' + esc(s.note) : '') + '</div>' +
      '</div>' +
      '<button class="btn sm ghost" data-act="sess-edit" data-id="' + s.id + '">Edit</button>' +
    '</div>';
  }).join('');
}
