/* Quick logging, browser-local drafts and session editing.
   The fixed action footer resolves its owning form inside the dialog. */

var LOGF = { courseId: null, date: null, topics: [], p: 'log', count: 1, minutes: 45, note: '', receiptId: null };
var LOG_DRAFT_KEY = STORE_KEY + '-log-draft';
function logReset(dateIso) {
  LOGF.courseId = DB.lastCourseId && courseById(DB.lastCourseId) && courseById(DB.lastCourseId).status === 'active'
    ? DB.lastCourseId : (activeCourses()[0] ? activeCourses()[0].id : null);
  LOGF.date = dateIso || today(); LOGF.topics = []; LOGF.count = 1;
  LOGF.minutes = DB.profile.sessionMinutes || 45; LOGF.note = ''; LOGF.receiptId = null;
}
function logRoot(el) {
  var owned = el && el.closest ? el.closest('[data-logform]') : null;
  return owned || $('#modal-box [data-logform]') || $('[data-logform]');
}
function logField(root, role) {
  if (!root) return null;
  return root.querySelector('[data-role="' + role + '"]') ||
    (role === 'echo' && root.closest('.modal') ? root.closest('.modal').querySelector('[data-role="echo"]') : null);
}
function logNum(root, role, dflt) {
  var input = logField(root, role);
  if (!input) return null;
  var value = parseFloat(input.value); return isFinite(value) ? value : dflt;
}
function logKeepDraft() {
  var root = $('#modal-box [data-logform]');
  if (!root) return;
  LOGF.courseId = logField(root, 'course').value; LOGF.date = logField(root, 'date').value;
  LOGF.count = logNum(root, 'count', 0); LOGF.minutes = logNum(root, 'mins', 0);
  LOGF.note = logField(root, 'note').value;
  try { localStorage.setItem(LOG_DRAFT_KEY, JSON.stringify(LOGF)); } catch (e) { /* drafts are optional */ }
}
function logRestoreDraft() {
  try {
    var draft = JSON.parse(localStorage.getItem(LOG_DRAFT_KEY));
    if (!draft || !courseById(draft.courseId) || courseById(draft.courseId).status === 'dropped') return false;
    Object.assign(LOGF, draft); LOGF.topics = Array.isArray(draft.topics) ? draft.topics : [];
    return true;
  } catch (e) { return false; }
}
function logForgetDraft() { try { localStorage.removeItem(LOG_DRAFT_KEY); } catch (e) { /* ignore */ } }

function topicPickerHTML(courseId, chosen) {
  var c = courseById(courseId); if (!c) return '';
  return '<label class="f" for="' + LOGF.p + '-topic-search">Find a topic</label>' +
    '<input type="search" id="' + LOGF.p + '-topic-search" data-role="topic-search" placeholder="Search topics…">' +
    '<div class="chips topic-options">' + (c.categories || []).map(function (t) {
      var on = chosen.indexOf(t) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" aria-pressed="' + on +
        '" data-act="log-topic" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('') + '<button type="button" class="chip" data-act="log-newtopic">Add topic</button></div>';
}
function logCardHTML(opts) {
  opts = opts || {}; var p = opts.prefix || 'log'; LOGF.p = p;
  if (!DB.courses.some(function (c) { return c.status !== 'dropped'; })) {
    return '<h2>Log a session</h2><div class="empty">Add a course first. <a href="#/classroom" data-act="modal-close">Open Courses</a></div>';
  }
  var course = courseById(LOGF.courseId), date = LOGF.date || today();
  return '<div data-logform="' + p + '" class="log-form">' +
    '<h2>Log a session</h2>' +
    '<div class="field"><label class="f" for="' + p + '-course">Course</label>' +
      '<select id="' + p + '-course" data-role="course">' + courseOptions(LOGF.courseId) + '</select></div>' +
    '<details class="disclosure log-date"' + (date !== today() ? ' open' : '') + '><summary>' +
      '<span data-role="date-label">' + (date === today() ? 'Today' : fmtDate(date)) + '</span><span class="mini">Change date</span></summary>' +
      '<div class="field"><label class="f" for="' + p + '-date">Study date</label>' +
      '<input type="date" id="' + p + '-date" data-role="date" value="' + esc(date) + '" max="' + today() + '"></div></details>' +
    '<div class="grid log-numbers">' +
      '<div class="field"><label class="f">Study time · minutes</label>' + stepper(p + '-mins', LOGF.minutes, 5, 0, 1440, 'mins') +
        '<div class="chips presets">' + [25, 45, 60].map(function (n) { return '<button type="button" class="chip" data-act="set-num" data-target="' + p + '-mins" data-val="' + n + '">' + n + ' min</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label class="f" data-role="unit-label">' + esc(courseUnit(course)) + ' completed</label>' + stepper(p + '-count', LOGF.count, 1, 0, 9999, 'count') +
        '<div class="chips presets">' + [0, 1, 2].map(function (n) { return '<button type="button" class="chip" data-act="set-num" data-target="' + p + '-count" data-val="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
    '</div><details class="disclosure" data-role="topic-details"><summary><span>Topics</span><span class="mini" data-role="topic-summary">' +
      (LOGF.topics.length ? LOGF.topics.length + ' selected' : 'Optional · grow your map') + '</span></summary>' +
      '<div data-role="topics">' + topicPickerHTML(LOGF.courseId, LOGF.topics) + '</div></details>' +
    '<details class="disclosure"' + (LOGF.note ? ' open' : '') + '><summary>Add a note <span class="mini">Optional</span></summary>' +
      '<div class="field"><label class="f" for="' + p + '-note">Note</label><textarea id="' + p + '-note" data-role="note" placeholder="What did you work on?">' + esc(LOGF.note) + '</textarea></div></details>' +
    '<div class="modal-foot log-footer"><span class="mini" data-role="echo"></span><button class="btn primary" data-act="log-save">Save session</button></div></div>';
}
function wireLog() {
  var root = $('#modal-box [data-logform]') || $('[data-logform]'); if (!root) return;
  var sel = logField(root, 'course');
  sel.onchange = function () {
    LOGF.courseId = sel.value; LOGF.topics = [];
    logField(root, 'topics').innerHTML = topicPickerHTML(LOGF.courseId, []);
    logField(root, 'unit-label').textContent = courseUnit(courseById(sel.value)) + ' completed';
    labelFields(root); updateLogEcho(root); logKeepDraft();
  };
  root.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-role') === 'topic-search') {
      var q = e.target.value.toLowerCase();
      $$('[data-act="log-topic"]', root).forEach(function (b) { b.hidden = b.textContent.toLowerCase().indexOf(q) < 0; });
      return;
    }
    updateLogEcho(root); logKeepDraft();
  });
  logField(root, 'date').onchange = function () { LOGF.date = this.value; updateLogEcho(root); logKeepDraft(); };
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && /^(number|text)$/.test(e.target.type) && e.target.getAttribute('data-role') !== 'newtopic') {
      e.preventDefault(); ACTIONS['log-save'](e.target);
    }
  });
  labelFields(root); updateLogEcho(root);
}
function updateLogEcho(root) {
  root = root || logRoot(null); var echo = logField(root, 'echo'); if (!echo) return;
  var c = courseById(logField(root, 'course').value); if (!c) return;
  var count = logNum(root, 'count', 0), mins = logNum(root, 'mins', 0), progress = progressOf(c);
  echo.textContent = fmtMins(mins) + ' · ' + count + ' ' + courseUnits(c, count) +
    (c.totalSessions ? ' · ' + (progress.done + count) + '/' + c.totalSessions + ' complete' : '');
  var summary = logField(root, 'topic-summary'); if (summary) summary.textContent = LOGF.topics.length ? LOGF.topics.length + ' selected' : 'Optional · grow your map';
  var d = logField(root, 'date'); var dl = logField(root, 'date-label');
  if (dl && d.value) dl.textContent = d.value === today() ? 'Today' : fmtDate(d.value);
}
ACTIONS['set-num'] = function (el) {
  var root = logRoot(el) || document;
  var inp = root.querySelector('[data-num="' + el.getAttribute('data-target') + '"]');
  if (inp) { inp.value = el.getAttribute('data-val'); inp.dispatchEvent(new Event('input', { bubbles: true })); }
};
ACTIONS['log-topic'] = function (el) {
  var t = el.getAttribute('data-topic'), i = LOGF.topics.indexOf(t);
  if (i >= 0) LOGF.topics.splice(i, 1); else LOGF.topics.push(t);
  el.classList.toggle('on', i < 0); el.setAttribute('aria-pressed', String(i < 0));
  updateLogEcho(logRoot(el)); logKeepDraft();
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
    updateLogEcho(root); logKeepDraft();
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
  var count = logNum(root, 'count', 0);
  var mins = logNum(root, 'mins', 0);
  if (count === null || mins === null) { toast('Could not read the form — reopen it and try again', 4000); return; }
  if (count < 0 || count > 9999 || count % 1 || mins < 0 || mins > 1440) { toast('Use a whole number of completed units and 0–1440 minutes.'); return; }
  if (count <= 0 && mins <= 0) { toast('Add study time or completed units.'); return; }

  var dateEl = logField(root, 'date'), noteEl = logField(root, 'note');
  var date = (dateEl && dateEl.value) || today();
  var note = (noteEl && noteEl.value.trim()) || '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) { toast('Choose today or an earlier study date.'); return; }
  var receiptId = LOGF.receiptId;
  var receipt = receiptId && DB.pomo && (DB.pomo.receipts || []).find(function (r) { return r.id === receiptId; });
  var saved = {
    id: uid(), courseId: c.id, date: date, count: count, minutes: mins,
    topics: LOGF.topics.slice(), note: note, source: receiptId ? 'focus' : 'manual', focusBlocks: receiptId ? 1 : 0, createdAt: new Date().toISOString()
  };
  DB.sessions.push(saved);
  if (receiptId && typeof pomoDismissReceipt === 'function') pomoDismissReceipt(receiptId);
  DB.lastCourseId = c.id;
  dbSave(true);

  var pr = progressOf(c);
  toast('Saved: ' + esc(c.name) + ' · ' + count + ' ' + esc(courseUnits(c, count)) + ' · ' + fmtMins(mins), 6000, 'Undo', function () {
    DB.sessions = DB.sessions.filter(function (s) { return s.id !== saved.id; });
    if (receipt && DB.pomo) DB.pomo.receipts.push(receipt);
    dbSave(true); route(); toast('Session undone');
  });
  if (c.totalSessions && pr.remaining === 0 && c.status === 'active') {
    setTimeout(function () { askCourseFinished(c.id); }, 400);
  }
  LOGF.topics = []; logForgetDraft();
  if ($('#modal-root').classList.contains('on')) modalClose(true);
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
      '<div class="field"><label class="f">Completed units</label>' + stepper('e-count', num(s.count, 0), 1, 0, 9999) + '</div>' +
      '<div class="field"><label class="f">Minutes</label>' + stepper('e-mins', num(s.minutes, 0), 5, 0, 1440) + '</div>' +
    '</div>' +
    '<div class="field"><label class="f">Topics</label><div class="chips" id="e-topics">' +
      cats.map(function (t) {
        return '<button class="chip' + ((s.topics || []).indexOf(t) >= 0 ? ' on' : '') + '" aria-pressed="' + ((s.topics || []).indexOf(t) >= 0) + '" data-act="e-topic" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
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
        b.classList.toggle('on'); b.setAttribute('aria-pressed', String(i < 0));
      };
      box.querySelector('#e-course').onchange = function () {
        var next = courseById(this.value), topics = next && next.categories || [];
        picked = picked.filter(function (t) { return topics.indexOf(t) >= 0; });
        box.querySelector('#e-topics').innerHTML = topics.map(function (t) {
          var selected = picked.indexOf(t) >= 0;
          return '<button class="chip' + (selected ? ' on' : '') + '" aria-pressed="' + selected + '" data-act="e-topic" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('');
      };
      box.querySelector('#e-ok').onclick = function () {
        var count = num(box.querySelector('[data-num="e-count"]').value, 0), mins = num(box.querySelector('[data-num="e-mins"]').value, 0);
        if (count < 0 || count > 9999 || count % 1 || mins < 0 || mins > 1440) { toast('Enter valid completed units and minutes.'); return; }
        s.courseId = box.querySelector('#e-course').value;
        s.date = box.querySelector('#e-date').value || s.date;
        s.count = num(box.querySelector('[data-num="e-count"]').value, 1);
        s.minutes = num(box.querySelector('[data-num="e-mins"]').value, 0);
        s.note = box.querySelector('#e-note').value.trim();
        s.topics = picked;
        if (typeof pomoClearSessionReceipt === 'function') pomoClearSessionReceipt(s.id);
        dbSave(true);
        modalClose();
        toast('Session updated — ' + fmtMins(s.minutes) + ' on ' + esc(courseName(s.courseId)));
        route();
      };
    }
  );
};

ACTIONS['sess-del'] = function (el) {
  var id = el.getAttribute('data-id'), saved = sessionById(id); if (!saved) return;
  DB.sessions = DB.sessions.filter(function (s) { return s.id !== id; });
  if (typeof pomoClearSessionReceipt === 'function') pomoClearSessionReceipt(id);
  dbSave(true); modalClose(); route();
  toast('Session deleted', 8000, 'Undo', function () { DB.sessions.push(saved); dbSave(true); route(); });
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
        '<div class="mini">' + num(s.count, 0) + ' ' + esc(courseUnits(c, num(s.count, 0))) + (s.source === 'focus' ? ' · focus block' : '') + ' · ' + fmtMins(s.minutes) +
          ((s.topics && s.topics.length) ? ' · ' + s.topics.map(esc).join(', ') : '') +
          (s.note ? ' · ' + esc(s.note) : '') + '</div>' +
      '</div>' +
      '<button class="btn sm ghost" data-act="sess-edit" data-id="' + s.id + '">Edit</button>' +
    '</div>';
  }).join('');
}
