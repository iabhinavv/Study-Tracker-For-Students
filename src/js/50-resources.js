/* =============================================================================
   50-resources — books, PDFs, playlists, folders. Anywhere: web, OneDrive,
   Google Drive, or a path on this machine.
   ========================================================================== */

var RES = { q: '', courseId: '', type: '', status: '', filtersOpen: false };

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

  var active = [RES.courseId, RES.type, RES.status].filter(Boolean).length;
  h += '<div class="card filter-panel"><label class="f" for="res-q">Search resources</label>' +
    '<div class="row"><input type="search" id="res-q" placeholder="Search title, link or notes…" value="' + esc(RES.q) + '">' +
    '<span class="pill">' + list.length + ' of ' + DB.resources.length + '</span>' +
    (active || RES.q ? '<button class="btn ghost" data-act="res-reset">Clear filters</button>' : '') + '</div>' +
    '<details class="disclosure" id="res-filters"' + (RES.filtersOpen ? ' open' : '') + '><summary>Filters<span class="mini">' +
    (active ? active + ' active' : 'Course, type & status') + '</span></summary><div class="filter-fields">' +
    '<div class="field"><label class="f" for="res-course">Course</label><select id="res-course">' + courseOptions(RES.courseId, true) + '</select></div>' +
    '<div class="field"><label class="f" for="res-type">Type</label><select id="res-type"><option value="">All types</option>' +
    Object.keys(RES_TYPES).map(function (k) { return '<option value="' + k + '"' + (RES.type === k ? ' selected' : '') + '>' + RES_TYPES[k].label + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="f" for="res-status">Status</label><select id="res-status">' +
    [['','Any status'],['todo','To read'],['reading','In progress'],['done','Finished']].map(function (o) { return '<option value="' + o[0] + '"' + (RES.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div></details>' +
    (active ? '<p class="hint">' + [RES.courseId ? esc(courseName(RES.courseId)) : '', RES.type ? esc(RES_TYPES[RES.type].label) : '', RES.status ? (RES.status === 'todo' ? 'To read' : RES.status === 'reading' ? 'In progress' : 'Finished') : ''].filter(Boolean).join(' · ') + '</p>' : '') + '</div>';

  if (!DB.resources.length) {
    h += '<div class="empty">Nothing here yet.<br><br><button class="btn primary" data-act="res-add">Add the first resource</button></div>';
  } else if (!list.length) {
    h += '<div class="empty">No resources match. <button class="btn" data-act="res-reset">Clear search & filters</button></div>';
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
  qi.oninput = function () {
    var pos = this.selectionStart; RES.q = this.value; renderResources(v);
    var next = $('#res-q'); next.focus({preventScroll:true}); next.setSelectionRange(pos, pos);
  };
  $('#res-filters').ontoggle = function () { RES.filtersOpen = this.open; };
  $('#res-course').onchange = function () { RES.courseId = this.value; route(); };
  $('#res-type').onchange = function () { RES.type = this.value; route(); };
  $('#res-status').onchange = function () { RES.status = this.value; route(); };
}

ACTIONS['res-reset'] = function () { RES.q = ''; RES.courseId = ''; RES.type = ''; RES.status = ''; route(); };

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
