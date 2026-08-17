/* =============================================================================
   30-classroom — courses: add/edit/remove, topics, links, deadline decisions.

   Deadlines are always optional. When one arrives (or the session target is
   met) the app asks the one question that matters: done, extend, or drop?
   ========================================================================== */

function renderClassroom(v) {
  var groups = [
    ['Active', DB.courses.filter(function (c) { return c.status === 'active'; })],
    ['Completed', DB.courses.filter(function (c) { return c.status === 'completed'; })],
    ['Dropped', DB.courses.filter(function (c) { return c.status === 'dropped'; })]
  ];

  var html = '<div class="row"><div><h1>Classroom</h1>' +
    '<p class="sub">Every course you are taking, with its class link, topics and deadline.</p></div>' +
    '<span class="spacer"></span>' +
    '<button class="btn primary" data-act="course-add">Add course</button>' +
    '<button class="btn" data-act="csv-import-open">Import CSV</button></div>';

  if (!DB.courses.length) {
    html += '<div class="empty">No courses yet.<br><br>' +
      '<button class="btn primary" data-act="course-add">Add your first course</button> ' +
      '<button class="btn" data-act="seed-starter">Use the starter list</button></div>';
  }

  groups.forEach(function (g) {
    if (!g[1].length) return;
    html += '<div class="sechead"><h2>' + g[0] + '</h2><span class="pill">' + g[1].length + '</span></div>';
    html += '<div class="grid g2">';
    g[1].forEach(function (c) { html += courseCardHTML(c); });
    html += '</div>';
  });

  v.innerHTML = html;
}

function courseCardHTML(c) {
  var p = progressOf(c), dl = daysLeft(c);
  var res = DB.resources.filter(function (r) { return r.courseId === c.id; }).length;
  var nb = DB.notebooks.filter(function (n) { return n.courseId === c.id; }).length;
  var h = '<div class="card course-card ' + (c.status === 'completed' ? 'done' : c.status === 'dropped' ? 'dropped' : '') + '">';
  h += '<div class="cardhead"><span class="dot" style="background:' + courseColor(c.id) + '"></span>' +
    '<span class="ttl" title="' + esc(c.name) + '">' + esc(c.name) + '</span>' +
    (c.status === 'completed' ? '<span class="tag" style="background:var(--ok-soft);color:var(--ok)">completed</span>' : '') +
    (c.status === 'dropped' ? '<span class="tag">dropped</span>' : '') + '</div>';

  h += '<div class="bar"><i style="width:' + p.pct + '%"></i></div>';
  h += '<div class="row tight mini">' +
    '<span><b>' + p.done + '</b>' + (c.totalSessions ? ' / ' + c.totalSessions : '') + ' sessions</span>' +
    (c.totalSessions ? '<span>· ' + p.remaining + ' remaining</span>' : '') +
    '<span>· ' + fmtMins(p.minutes) + ' tracked</span>' +
    (p.last ? '<span>· last ' + fmtShort(p.last) + '</span>' : '') +
    '</div>';

  h += '<div class="row tight">';
  h += dl !== null
    ? '<span class="pill ' + (dl < 0 ? 'bad' : dl <= 7 ? 'warn' : '') + '">Due ' + fmtDate(c.deadline) + ' · ' +
      (dl < 0 ? Math.abs(dl) + 'd over' : dl + 'd left') + '</span>' +
      '<button class="btn sm ghost" data-act="course-deadline-decide" data-id="' + c.id + '">Change</button>'
    : '<button class="btn sm ghost" data-act="course-deadline-set" data-id="' + c.id + '">Set a deadline</button>';
  h += '</div>';

  if (c.categories && c.categories.length) {
    h += '<div class="chips">' + c.categories.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
  } else {
    h += '<button class="btn sm ghost" data-act="course-topics" data-id="' + c.id + '">Add topics — they feed the brain map</button>';
  }

  var links = [];
  if (c.link) links.push('<a href="' + esc(c.link) + '" target="_blank" rel="noopener">Class / playlist</a>');
  (c.extraLinks || []).forEach(function (l) {
    links.push('<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label || 'Link') + '</a>');
  });
  links.push('<a href="#/resources?course=' + c.id + '">Resources (' + res + ')</a>');
  links.push('<a href="#/notebooks?course=' + c.id + '">Notebooks (' + nb + ')</a>');
  links.push('<a href="#" data-act="course-edit" data-id="' + c.id + '">Edit</a>');
  links.push('<a href="#" data-act="course-del" data-id="' + c.id + '">Remove</a>');
  h += '<div class="linkline">' + links.join('') + '</div>';

  if (c.notes) h += '<div class="mini">' + esc(c.notes) + '</div>';
  if (c.extensions && c.extensions.length) {
    h += '<div class="mini">Extended ' + c.extensions.length + '× (was ' + fmtShortY(c.extensions[0].from) + ')</div>';
  }

  h += '<div class="row tight">';
  if (c.status === 'active') {
    h += '<button class="btn sm" data-act="course-complete" data-id="' + c.id + '">Mark completed</button>' +
         '<button class="btn sm ghost" data-act="course-drop" data-id="' + c.id + '">Drop</button>';
  } else {
    h += '<button class="btn sm" data-act="course-reopen" data-id="' + c.id + '">Reopen</button>';
  }
  h += '</div></div>';
  return h;
}

/* ------------------------------- add / edit ------------------------------ */

function courseFormModal(course) {
  var isNew = !course;
  var c = course || newCourse({});
  var picked = (c.categories || []).slice();
  var hints = topicHints(c.name).filter(function (t) { return picked.indexOf(t) < 0; });

  modal(
    '<h2>' + (isNew ? 'Add a course' : 'Edit course') + '</h2>' +
    '<div class="field"><label class="f">Course name *</label>' +
      '<input type="text" id="c-name" value="' + esc(c.name === 'Untitled course' ? '' : c.name) + '" placeholder="e.g. Statistics"></div>' +
    '<div class="field"><label class="f">Class / playlist link</label>' +
      '<input type="url" id="c-link" value="' + esc(c.link) + '" placeholder="https://youtube.com/playlist?list=… or your LMS URL"></div>' +
    '<div class="grid g2" style="gap:12px">' +
      '<div class="field"><label class="f">Total sessions / lectures in the course</label>' + stepper('c-total', c.totalSessions, 1, 0, 9999) +
        '<div class="hint">0 = untracked, just log time.</div></div>' +
      '<div class="field"><label class="f">Already finished before today</label>' + stepper('c-off', c.doneOffset, 1, 0, 9999) +
        '<div class="hint">Head start, so progress starts where you actually are.</div></div>' +
    '</div>' +
    '<div class="field"><label class="f">Deadline (optional)</label>' +
      '<div class="row tight"><input type="date" id="c-dl" value="' + esc(c.deadline) + '" style="max-width:200px">' +
      '<button class="btn sm" data-act="c-dl-quick" data-d="30">+30d</button>' +
      '<button class="btn sm" data-act="c-dl-quick" data-d="60">+60d</button>' +
      '<button class="btn sm" data-act="c-dl-quick" data-d="90">+90d</button>' +
      '<button class="btn sm" data-act="c-dl-quick" data-d="">none</button></div>' +
      '<div class="hint">When the date arrives the app asks: completed, extend, or drop?</div></div>' +
    '<div class="field"><label class="f">Topics / categories</label>' +
      '<div class="chips" id="c-cats"></div>' +
      '<div class="row tight" style="margin-top:8px"><input type="text" id="c-newcat" placeholder="Add topic and press Enter" style="max-width:260px">' +
      '<span class="mini">used by the brain map</span></div>' +
      '<div class="chips" id="c-hints" style="margin-top:8px">' + hints.map(function (t) {
        return '<button class="chip" data-act="c-hint" data-t="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div></div>' +
    '<div class="field"><label class="f">Notes</label><input type="text" id="c-notes" value="' + esc(c.notes || '') + '" placeholder="exam date, syllabus notes…"></div>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn primary" id="c-ok">' + (isNew ? 'Add course' : 'Save') + '</button></div>',
    function (box) {
      function drawCats() {
        box.querySelector('#c-cats').innerHTML = picked.length
          ? picked.map(function (t) { return '<button class="chip on" data-act="c-uncat" data-t="' + esc(t) + '">' + esc(t) + '<span class="x">×</span></button>'; }).join('')
          : '<span class="mini">none yet</span>';
      }
      ACTIONS['c-uncat'] = function (b) { picked = picked.filter(function (t) { return t !== b.getAttribute('data-t'); }); drawCats(); };
      ACTIONS['c-hint'] = function (b) { var t = b.getAttribute('data-t'); if (picked.indexOf(t) < 0) picked.push(t); b.remove(); drawCats(); };
      ACTIONS['c-dl-quick'] = function (b) {
        var d = b.getAttribute('data-d');
        box.querySelector('#c-dl').value = d ? shiftDays(today(), +d) : '';
      };
      drawCats();
      var nc = box.querySelector('#c-newcat');
      nc.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        String(nc.value).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (t) {
          if (picked.indexOf(t) < 0) picked.push(t);
        });
        nc.value = '';
        drawCats();
      };
      box.querySelector('#c-ok').onclick = function () {
        var name = box.querySelector('#c-name').value.trim();
        if (!name) { toast('Give the course a name'); return; }
        c.name = name;
        c.link = box.querySelector('#c-link').value.trim();
        c.totalSessions = readNum('c-total', 0);
        c.doneOffset = readNum('c-off', 0);
        c.deadline = box.querySelector('#c-dl').value || '';
        c.notes = box.querySelector('#c-notes').value.trim();
        c.categories = picked;
        if (isNew) DB.courses.push(c);
        dbSave(true);
        modalClose();
        toast(isNew ? esc(name) + ' added' : 'Course saved');
        route();
      };
    }
  );
}

ACTIONS['course-add'] = function () { courseFormModal(null); };
ACTIONS['course-edit'] = function (el) { courseFormModal(courseById(el.getAttribute('data-id'))); };

ACTIONS['course-topics'] = function (el) { courseFormModal(courseById(el.getAttribute('data-id'))); };

ACTIONS['course-del'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  if (!c) return;
  var n = DB.sessions.filter(function (s) { return s.courseId === c.id; }).length;
  confirmBox('Remove ' + c.name + '?',
    n ? 'This also deletes <b>' + n + ' logged session' + (n === 1 ? '' : 's') + '</b>. ' +
        'If you only want it out of the way, drop the course instead — the history stays.'
      : 'Nothing has been logged against it.',
    'Remove course', function () {
      DB.courses = DB.courses.filter(function (x) { return x.id !== c.id; });
      DB.sessions = DB.sessions.filter(function (s) { return s.courseId !== c.id; });
      DB.resources.forEach(function (r) { if (r.courseId === c.id) r.courseId = ''; });
      DB.notebooks.forEach(function (nb) { if (nb.courseId === c.id) nb.courseId = ''; });
      dbSave(true); toast('Removed'); route();
    });
};

ACTIONS['course-complete'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  c.status = 'completed';
  c.completedAt = today();
  dbSave(true); toast(esc(c.name) + ' marked completed'); route();
};
ACTIONS['course-drop'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  c.status = 'dropped';
  dbSave(true); toast(esc(c.name) + ' dropped — history kept'); route();
};
ACTIONS['course-reopen'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  c.status = 'active';
  delete c.completedAt;
  dbSave(true); toast(esc(c.name) + ' is active again'); route();
};

/* ---------------------------- deadline dialogs --------------------------- */

ACTIONS['course-deadline-set'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  var p = progressOf(c);
  modal(
    '<h2>Set a deadline for ' + esc(c.name) + '</h2>' +
    '<p class="sub">Optional — but with one, the app can tell you the pace you need.' +
      (c.totalSessions ? ' ' + p.remaining + ' sessions remain.' : '') + '</p>' +
    '<div class="field"><label class="f">Finish by</label><input type="date" id="d-date" value="' + shiftDays(today(), 30) + '" min="' + today() + '"></div>' +
    '<div class="chips">' + [14, 30, 60, 90, 180].map(function (n) {
      return '<button class="chip" data-act="d-quick" data-d="' + n + '">' + n + ' days</button>';
    }).join('') + '</div>' +
    '<div class="hint" id="d-pace" style="margin-top:10px"></div>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Skip for now</button>' +
      '<button class="btn primary" id="d-ok">Set deadline</button></div>',
    function (box) {
      var inp = box.querySelector('#d-date');
      function pace() {
        var d = daysBetween(today(), inp.value);
        box.querySelector('#d-pace').innerHTML = (c.totalSessions && d > 0)
          ? 'That is <b>' + (p.remaining / d).toFixed(1) + '</b> sessions/day for ' + d + ' days.'
          : '';
      }
      ACTIONS['d-quick'] = function (b) { inp.value = shiftDays(today(), +b.getAttribute('data-d')); pace(); };
      inp.oninput = pace; pace();
      box.querySelector('#d-ok').onclick = function () {
        c.deadline = inp.value; dbSave(true); modalClose(); toast('Deadline set'); route();
      };
    }
  );
};

/* the "your deadline is here" decision: complete / extend / drop */
ACTIONS['course-deadline-decide'] = function (el) { deadlineDecide(el.getAttribute('data-id')); };

function deadlineDecide(id) {
  var c = courseById(id);
  if (!c) return;
  var p = progressOf(c), dl = daysLeft(c);
  modal(
    '<h2>' + esc(c.name) + '</h2>' +
    '<p class="sub">Deadline ' + fmtDate(c.deadline) + ' — ' +
      (dl < 0 ? '<b>' + Math.abs(dl) + ' day(s) overdue</b>' : dl === 0 ? '<b>today</b>' : dl + ' days left') + '. ' +
      (c.totalSessions ? p.done + ' of ' + c.totalSessions + ' sessions done, ' + p.remaining + ' to go.' : '') + '</p>' +
    '<div class="grid g3">' +
      '<button class="btn pick" data-act="dd-complete" data-id="' + c.id + '">' +
        '<b>Completed</b><span class="mini">Done with it. Keeps all history.</span></button>' +
      '<button class="btn pick" data-act="dd-extend" data-id="' + c.id + '">' +
        '<b>Extend</b><span class="mini">Pick a new date. Extensions are recorded.</span></button>' +
      '<button class="btn pick" data-act="dd-drop" data-id="' + c.id + '">' +
        '<b>Drop</b><span class="mini">Off the active list, history kept.</span></button>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn ghost" data-act="modal-close">Ask me later</button></div>'
  );
}

ACTIONS['dd-complete'] = function (el) { modalClose(); ACTIONS['course-complete'](el); };
ACTIONS['dd-drop'] = function (el) { modalClose(); ACTIONS['course-drop'](el); };
ACTIONS['dd-extend'] = function (el) {
  var c = courseById(el.getAttribute('data-id'));
  var p = progressOf(c);
  modal(
    '<h2>Extend ' + esc(c.name) + '</h2>' +
    '<p class="sub">Old deadline ' + fmtDate(c.deadline) + '.</p>' +
    '<div class="field"><label class="f">New deadline</label><input type="date" id="x-date" value="' + shiftDays(today(), 30) + '" min="' + today() + '"></div>' +
    '<div class="chips">' + [7, 14, 30, 60, 90].map(function (n) {
      return '<button class="chip" data-act="x-quick" data-d="' + n + '">+' + n + 'd</button>';
    }).join('') + '</div>' +
    '<div class="hint" id="x-pace" style="margin-top:10px"></div>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn primary" id="x-ok">Extend</button></div>',
    function (box) {
      var inp = box.querySelector('#x-date');
      function pace() {
        var d = daysBetween(today(), inp.value);
        box.querySelector('#x-pace').innerHTML = (c.totalSessions && d > 0)
          ? 'New pace: <b>' + (p.remaining / d).toFixed(1) + '</b> sessions/day.' : '';
      }
      ACTIONS['x-quick'] = function (b) { inp.value = shiftDays(today(), +b.getAttribute('data-d')); pace(); };
      inp.oninput = pace; pace();
      box.querySelector('#x-ok').onclick = function () {
        c.extensions = c.extensions || [];
        c.extensions.push({ from: c.deadline, to: inp.value, on: today() });
        c.deadline = inp.value;
        dbSave(true); modalClose(); toast('Deadline extended to ' + fmtShort(inp.value)); route();
      };
    }
  );
};

/* target reached → ask what now (called from the log form) */
function askCourseFinished(id) {
  var c = courseById(id);
  if (!c) return;
  modal(
    '<h2>' + esc(c.name) + ' — target reached</h2>' +
    '<p class="sub">All ' + c.totalSessions + ' sessions are logged. What next?</p>' +
    '<div class="grid g3">' +
      '<button class="btn pick" data-act="dd-complete" data-id="' + c.id + '">' +
        '<b>Mark completed</b><span class="mini">Move it to the completed list.</span></button>' +
      '<button class="btn pick" data-act="fin-more" data-id="' + c.id + '">' +
        '<b>Add more sessions</b><span class="mini">The course got longer than planned.</span></button>' +
      '<button class="btn pick" data-act="modal-close">' +
        '<b>Keep going</b><span class="mini">Leave it active, decide later.</span></button>' +
    '</div>'
  );
}
ACTIONS['fin-more'] = function (el) { modalClose(); courseFormModal(courseById(el.getAttribute('data-id'))); };
ACTIONS['seed-starter'] = function () { seedStarter(); };
