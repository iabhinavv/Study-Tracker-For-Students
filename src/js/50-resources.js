/* =============================================================================
   50-resources — books, PDFs, playlists, folders. Anywhere: web, OneDrive,
   Google Drive, or a path on this machine.
   ========================================================================== */

var RES = { q: '', courseId: '', type: '', status: '' };

/* a local path (or file://) needs different handling from a normal URL */
function isLocalPath(u) {
  return /^file:\/\//i.test(u) || /^[a-zA-Z]:\\/.test(u) || /^[~/]/.test(u);
}
function asHref(u) {
  if (!u) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return u;          // already has a scheme
  if (/^[~/]/.test(u)) return 'file://' + u.replace(/^~/, '');
  if (/^[a-zA-Z]:\\/.test(u)) return 'file:///' + u.replace(/\\/g, '/');
  return 'https://' + u;
}
function hostOf(u) {
  try { return new URL(asHref(u)).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}
function guessType(u) {
  var s = String(u).toLowerCase();
  if (/\.pdf($|\?)/.test(s)) return 'pdf';
  if (/\.epub|\.mobi|\.azw/.test(s)) return 'book';
  if (/youtube|youtu\.be|vimeo/.test(s)) return 'video';
  if (/\.xlsx?|\.csv|sheets\.google/.test(s)) return 'sheet';
  if (/sharepoint|onedrive|drive\.google|dropbox|1drv\.ms/.test(s)) return 'folder';
  if (isLocalPath(u)) return 'folder';
  return 'site';
}

function renderResources(v) {
  var q = RES.q.toLowerCase();
  var list = DB.resources.filter(function (r) {
    if (RES.courseId && r.courseId !== RES.courseId) return false;
    if (RES.type && r.type !== RES.type) return false;
    if (RES.status && r.status !== RES.status) return false;
    if (q && (r.title + ' ' + (r.url || '') + ' ' + (r.notes || '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  var h = '<div class="row"><div><h1>Resources</h1>' +
    '<p class="sub">Books, PDFs, playlists and folders — on the web, in OneDrive/Drive, or on this machine.</p></div>' +
    '<span class="spacer"></span><button class="btn primary" data-act="res-add">Add resource</button></div>';

  h += '<div class="card" style="margin-bottom:14px"><div class="row">' +
    '<input type="text" id="res-q" class="filter" placeholder="Search title, link, notes…" value="' + esc(RES.q) + '">' +
    '<select id="res-course" class="filter">' + courseOptions(RES.courseId, true) + '</select>' +
    '<select id="res-type" class="filter"><option value="">All types</option>' +
      Object.keys(RES_TYPES).map(function (k) {
        return '<option value="' + k + '"' + (RES.type === k ? ' selected' : '') + '>' + RES_TYPES[k].label + '</option>';
      }).join('') + '</select>' +
    '<select id="res-status" class="filter">' +
      ['', 'todo', 'reading', 'done'].map(function (s) {
        return '<option value="' + s + '"' + (RES.status === s ? ' selected' : '') + '>' +
          (s === '' ? 'Any status' : s === 'todo' ? 'To read' : s === 'reading' ? 'In progress' : 'Finished') + '</option>';
      }).join('') + '</select>' +
    '<span class="spacer"></span><span class="pill"><b>' + list.length + '</b> of ' + DB.resources.length + '</span>' +
    '</div></div>';

  if (!DB.resources.length) {
    h += '<div class="empty">Nothing here yet.<br><br><button class="btn primary" data-act="res-add">Add the first resource</button></div>';
  } else if (!list.length) {
    h += '<div class="empty">Nothing matches that filter.</div>';
  } else {
    h += '<div class="grid g2">';
    list.forEach(function (r) {
      var t = RES_TYPES[r.type] || RES_TYPES.other;
      var local = isLocalPath(r.url || '');
      h += '<div class="card course-card">' +
        '<div class="ttl">' + esc(r.title) + '</div>' +
        '<div class="row tight">' +
          '<span class="tag">' + t.label + '</span>' +
          (r.courseId ? '<span class="tag"><span style="width:6px;height:6px;border-radius:1px;background:' + courseColor(r.courseId) + '"></span>' + esc(courseName(r.courseId)) + '</span>' : '') +
          '<span class="tag">' + (r.status === 'done' ? 'finished' : r.status === 'reading' ? 'in progress' : 'to read') + '</span>' +
        '</div>' +
        '<div class="mini">' +
          (local ? 'On this machine' : (hostOf(r.url) ? esc(hostOf(r.url)) : 'No link')) +
          (r.notes ? ' · ' + esc(r.notes) : '') + '</div>' +
        '<div class="linkline">' +
          (r.url ? '<a href="' + esc(asHref(r.url)) + '" target="_blank" rel="noopener">Open</a>' : '') +
          (r.url && local ? '<a href="#" data-act="copy" data-v="' + esc(r.url) + '">Copy path</a>' : '') +
          '<a href="#" data-act="res-cycle" data-id="' + r.id + '">Mark ' +
            (r.status === 'todo' ? 'in progress' : r.status === 'reading' ? 'finished' : 'to read') + '</a>' +
          '<a href="#" data-act="res-edit" data-id="' + r.id + '">Edit</a>' +
          '<a href="#" data-act="res-del" data-id="' + r.id + '">Remove</a>' +
        '</div>' +
        (local ? '<div class="hint">Local links open when you launch index.html straight from the folder, not through a server.</div>' : '') +
      '</div>';
    });
    h += '</div>';
  }

  v.innerHTML = h;
  var qi = $('#res-q');
  qi.oninput = function () { RES.q = qi.value; };
  qi.onchange = function () { route(); };
  qi.onkeydown = function (e) { if (e.key === 'Enter') route(); };
  $('#res-course').onchange = function () { RES.courseId = this.value; route(); };
  $('#res-type').onchange = function () { RES.type = this.value; route(); };
  $('#res-status').onchange = function () { RES.status = this.value; route(); };
}

function resById(id) { return DB.resources.filter(function (r) { return r.id === id; })[0]; }

function resFormModal(r) {
  var isNew = !r;
  r = r || { id: uid(), title: '', url: '', type: 'book', courseId: RES.courseId || '', status: 'todo', notes: '' };
  modal(
    '<h2>' + (isNew ? 'Add resource' : 'Edit resource') + '</h2>' +
    '<div class="field"><label class="f">Title *</label><input type="text" id="r-title" value="' + esc(r.title) + '" placeholder="e.g. Introduction to Statistical Learning"></div>' +
    '<div class="field"><label class="f">Link or path</label><input type="text" id="r-url" value="' + esc(r.url) + '" placeholder="https://… or /Users/you/Books/ISL.pdf"></div>' +
    '<div class="hint" style="margin:-6px 0 12px">Works with web links, OneDrive/Google Drive/Dropbox share links, and local paths.</div>' +
    '<div class="grid g3" style="gap:12px">' +
      '<div class="field"><label class="f">Type</label><select id="r-type">' + Object.keys(RES_TYPES).map(function (k) {
        return '<option value="' + k + '"' + (r.type === k ? ' selected' : '') + '>' + RES_TYPES[k].label + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label class="f">Course</label><select id="r-course"><option value="">— none —</option>' + courseOptions(r.courseId) + '</select></div>' +
      '<div class="field"><label class="f">Status</label><select id="r-status">' +
        ['todo', 'reading', 'done'].map(function (s) {
          return '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' +
            (s === 'todo' ? 'To read' : s === 'reading' ? 'In progress' : 'Finished') + '</option>';
        }).join('') + '</select></div>' +
    '</div>' +
    '<div class="field"><label class="f">Notes</label><textarea id="r-notes" placeholder="chapters to read, why it matters…">' + esc(r.notes || '') + '</textarea></div>' +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Cancel</button>' +
      '<button class="btn primary" id="r-ok">' + (isNew ? 'Add' : 'Save') + '</button></div>',
    function (box) {
      var url = box.querySelector('#r-url');
      url.onchange = function () {
        if (url.value) box.querySelector('#r-type').value = guessType(url.value);
      };
      box.querySelector('#r-ok').onclick = function () {
        var title = box.querySelector('#r-title').value.trim();
        if (!title) { toast('Give it a title'); return; }
        r.title = title;
        r.url = url.value.trim();
        r.type = box.querySelector('#r-type').value;
        r.courseId = box.querySelector('#r-course').value;
        r.status = box.querySelector('#r-status').value;
        r.notes = box.querySelector('#r-notes').value.trim();
        if (isNew) { r.addedAt = new Date().toISOString(); DB.resources.push(r); }
        dbSave(true); modalClose(); toast(isNew ? 'Resource added' : 'Saved'); route();
      };
    }
  );
}

ACTIONS['res-add'] = function () { resFormModal(null); };
ACTIONS['res-edit'] = function (el) { resFormModal(resById(el.getAttribute('data-id'))); };
ACTIONS['res-del'] = function (el) {
  var r = resById(el.getAttribute('data-id'));
  confirmBox('Remove resource?', esc(r.title) + ' will be removed from the list. The file itself is untouched.', 'Remove', function () {
    DB.resources = DB.resources.filter(function (x) { return x.id !== r.id; });
    dbSave(true); toast('Removed'); route();
  });
};
ACTIONS['res-cycle'] = function (el) {
  var r = resById(el.getAttribute('data-id'));
  r.status = r.status === 'todo' ? 'reading' : r.status === 'reading' ? 'done' : 'todo';
  dbSave(true); route();
};
ACTIONS['copy'] = function (el) {
  var v = el.getAttribute('data-v');
  if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { toast('Copied'); }, function () { toast(v); });
  else toast(v, 6000);
};
