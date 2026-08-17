/* =============================================================================
   60-notebooks — links to wherever your notes actually live: Apple Notes,
   OneNote, Evernote, Notion, Obsidian, Logseq, a local folder…

   The app never touches note contents. It stores a link and opens it. Deep
   links (obsidian://, evernote:///, onenote:, notion://) open the desktop app;
   https links open the web version.
   ========================================================================== */

var NBF = { courseId: '', app: '' };

function renderNotebooks(v) {
  var list = DB.notebooks.filter(function (n) {
    if (NBF.courseId && n.courseId !== NBF.courseId) return false;
    if (NBF.app && n.app !== NBF.app) return false;
    return true;
  });

  var h = '<div class="row"><div><h1>Notebooks</h1>' +
    '<p class="sub">One click to the notes for a course — in whichever app you write them.</p></div>' +
    '<span class="spacer"></span><button class="btn primary" data-act="nb-add">Link a notebook</button></div>';

  h += '<div class="card" style="margin-bottom:14px"><div class="row">' +
    '<select id="nb-course" class="filter">' + courseOptions(NBF.courseId, true) + '</select>' +
    '<select id="nb-app" class="filter"><option value="">All apps</option>' +
      Object.keys(NOTE_APPS).map(function (k) {
        return '<option value="' + k + '"' + (NBF.app === k ? ' selected' : '') + '>' + NOTE_APPS[k].label + '</option>';
      }).join('') + '</select>' +
    '<span class="spacer"></span><span class="pill"><b>' + list.length + '</b> notebook' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div></div>';

  if (!DB.notebooks.length) {
    h += '<div class="empty">No notebooks linked yet.<br><br>' +
      '<button class="btn primary" data-act="nb-add">Link your first notebook</button>' +
      '<div class="hint" style="margin-top:14px">Obsidian: right-click a note, Copy Obsidian URL. Notion: page menu, Copy link. ' +
      'Apple Notes: Share, Copy Link. OneNote: right-click the page, Copy Link to Page.</div></div>';
  } else if (!list.length) {
    h += '<div class="empty">Nothing matches that filter.</div>';
  } else {
    h += '<div class="grid g3">';
    list.forEach(function (n) {
      var a = NOTE_APPS[n.app] || NOTE_APPS.other;
      h += '<div class="card course-card">' +
        '<div class="ttl">' + esc(n.title) + '</div>' +
        '<div class="row tight"><span class="tag">' + a.label + '</span>' +
          (n.courseId ? '<span class="tag"><span style="width:6px;height:6px;border-radius:1px;background:' + courseColor(n.courseId) + '"></span>' + esc(courseName(n.courseId)) + '</span>' : '') +
        '</div>' +
        (n.notes ? '<div class="mini">' + esc(n.notes) + '</div>' : '') +
        '<div class="linkline">' +
          (n.url ? '<a href="' + esc(asHref(n.url)) + '" target="_blank" rel="noopener">Open notebook</a>' : '') +
          (n.url ? '<a href="#" data-act="copy" data-v="' + esc(n.url) + '">Copy link</a>' : '') +
          '<a href="#" data-act="nb-edit" data-id="' + n.id + '">Edit</a>' +
          '<a href="#" data-act="nb-del" data-id="' + n.id + '">Remove</a>' +
        '</div>' +
      '</div>';
    });
    h += '</div>';
  }

  /* per-course roll-up, useful once there are many */
  var byCourse = {};
  DB.notebooks.forEach(function (n) { byCourse[n.courseId || ''] = (byCourse[n.courseId || ''] || 0) + 1; });
  if (DB.notebooks.length > 3) {
    h += '<div class="sechead"><h2>By course</h2></div><div class="card"><div class="chips">' +
      Object.keys(byCourse).map(function (cid) {
        return '<a class="chip" href="#/notebooks?course=' + cid + '">' + esc(cid ? courseName(cid) : 'Unassigned') + ' · ' + byCourse[cid] + '</a>';
      }).join('') + '</div></div>';
  }

  v.innerHTML = h;
  $('#nb-course').onchange = function () { NBF.courseId = this.value; route(); };
  $('#nb-app').onchange = function () { NBF.app = this.value; route(); };
}

function nbById(id) { return DB.notebooks.filter(function (n) { return n.id === id; })[0]; }

function nbFormModal(n) {
  var isNew = !n;
  n = n || { id: uid(), title: '', url: '', app: 'obsidian', courseId: NBF.courseId || '', notes: '' };
  modal(
    '<h2>' + (isNew ? 'Link a notebook' : 'Edit notebook') + '</h2>' +
    '<p class="sub">Your notes stay in your own app. This just remembers how to get there.</p>' +
    '<div class="field"><label class="f">Name *</label><input type="text" id="n-title" value="' + esc(n.title) + '" placeholder="e.g. Stats — lecture notes"></div>' +
    '<div class="field"><label class="f">App</label><select id="n-app">' + Object.keys(NOTE_APPS).map(function (k) {
      return '<option value="' + k + '"' + (n.app === k ? ' selected' : '') + '>' + NOTE_APPS[k].label + '</option>';
    }).join('') + '</select><div class="hint" id="n-hint"></div></div>' +
    '<div class="field"><label class="f">Link or path</label><input type="text" id="n-url" value="' + esc(n.url) + '" placeholder="obsidian://open?vault=Study&file=Stats"></div>' +
    '<div class="field"><label class="f">Course</label><select id="n-course"><option value="">— none —</option>' + courseOptions(n.courseId) + '</select></div>' +
    '<div class="field"><label class="f">Notes</label><input type="text" id="n-notes" value="' + esc(n.notes || '') + '" placeholder="what lives in here"></div>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn primary" id="n-ok">' + (isNew ? 'Link it' : 'Save') + '</button></div>',
    function (box) {
      var app = box.querySelector('#n-app'), hint = box.querySelector('#n-hint');
      function drawHint() { hint.textContent = (NOTE_APPS[app.value] || NOTE_APPS.other).hint; }
      app.onchange = drawHint; drawHint();
      box.querySelector('#n-ok').onclick = function () {
        var title = box.querySelector('#n-title').value.trim();
        if (!title) { toast('Give it a name'); return; }
        n.title = title;
        n.app = app.value;
        n.url = box.querySelector('#n-url').value.trim();
        n.courseId = box.querySelector('#n-course').value;
        n.notes = box.querySelector('#n-notes').value.trim();
        if (isNew) { n.addedAt = new Date().toISOString(); DB.notebooks.push(n); }
        dbSave(true); modalClose(); toast(isNew ? 'Notebook linked' : 'Saved'); route();
      };
    }
  );
}

ACTIONS['nb-add'] = function () { nbFormModal(null); };
ACTIONS['nb-edit'] = function (el) { nbFormModal(nbById(el.getAttribute('data-id'))); };
ACTIONS['nb-del'] = function (el) {
  var n = nbById(el.getAttribute('data-id'));
  confirmBox('Unlink notebook?', esc(n.title) + ' will be removed from this list. Your notes are not touched.', 'Unlink', function () {
    DB.notebooks = DB.notebooks.filter(function (x) { return x.id !== n.id; });
    dbSave(true); toast('Unlinked'); route();
  });
};
