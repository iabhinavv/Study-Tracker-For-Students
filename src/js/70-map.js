/* =============================================================================
   70-map — the brain map, drawn as a wheel around a centre pivot.

   Layout   : every subject and topic is a point on ONE outer circle. Each
              course owns a contiguous arc of that circle: its own point in the
              middle of the arc, its topics either side, with a dimension
              bracket and the course name drawn outside.
   Threads  : every point is tied back to the centre pivot with a curved
              thread (the swirl comes from swinging the control point), and
              topics studied in the SAME session are tied to each other with
              chords that bow through the middle.
   Growth   : a point grows with every session logged against it; untouched
              topics stay hollow.
   Reading  : zoomed out it is just dots. Zoom in and the subject names appear,
              zoom further and the topic names do. Hover anything to isolate
              its threads.

   Plain canvas 2D, no libraries.
   ========================================================================== */

var MAP = {
  nodes: [], links: [], byKey: {},
  view: { k: 1, tx: 0, ty: 0 },
  rot: -Math.PI / 2,          // where the first course starts
  spin: false, labels: true,
  pan: null, hover: null, raf: null, ink: null
};

var MAP_RING = 320;      /* smaller wheel on a phone, so the names still fit */
function mapSizeRing() { MAP_RING = isNarrow() ? 250 : 320; }

function mapBuild() {
  var ts = topicStats();
  var nodes = [], links = [], byKey = {};
  var courses = DB.courses.filter(function (c) { return c.status !== 'dropped'; });
  if (!courses.length) { MAP.nodes = []; MAP.links = []; MAP.byKey = {}; return; }

  /* angular budget: one slot per point, plus a gap between subjects */
  var slots = 0;
  courses.forEach(function (c) { slots += 1 + (c.categories || []).length; });
  var gap = 0.055;
  var per = (Math.PI * 2 - gap * courses.length) / slots;

  var a = 0;
  courses.forEach(function (c) {
    var cats = (c.categories || []).slice();
    var n = cats.length + 1;
    var start = a, end = a + per * n;
    var p = progressOf(c);

    /* the subject sits in the middle of its arc, topics either side */
    var order = [], mid = Math.floor(n / 2);
    for (var i = 0; i < n; i++) order.push(i === mid ? null : cats.shift());

    order.forEach(function (topic, i) {
      var ang = start + per * (i + 0.5);
      if (topic === null) {
        var cn = {
          key: 'c::' + c.id, kind: 'course', label: c.name, color: courseColor(c.id), courseId: c.id,
          count: p.done, minutes: p.minutes, ang: ang,
          r: 5.5 + 1.5 * Math.sqrt(p.done), arc: [start, end]
        };
        nodes.push(cn); byKey[cn.key] = cn;
      } else {
        var key = c.id + '::' + topic;
        var st = ts.nodes[key] || { count: 0, minutes: 0, last: '' };
        var tn = {
          key: 't::' + key, kind: 'topic', label: topic, topic: topic, color: courseColor(c.id), courseId: c.id,
          count: st.count, minutes: st.minutes, last: st.last, ang: ang,
          r: st.count ? 3.4 + 2.1 * Math.sqrt(st.count) : 2.6
        };
        nodes.push(tn); byKey[tn.key] = tn;
      }
    });
    a = end + gap;
  });

  /* topics studied together in one sitting */
  Object.keys(ts.links).forEach(function (lk) {
    var pr = lk.split('|');
    var x = 't::' + pr[0], y = 't::' + pr[1];
    if (byKey[x] && byKey[y]) links.push({ a: x, b: y, w: ts.links[lk], kind: 'together' });
  });
  /* the same topic name in two different subjects */
  var byName = {};
  nodes.forEach(function (nd) {
    if (nd.kind !== 'topic') return;
    (byName[nd.topic.toLowerCase()] = byName[nd.topic.toLowerCase()] || []).push(nd);
  });
  Object.keys(byName).forEach(function (k) {
    var g = byName[k];
    for (var i = 0; i < g.length; i++) {
      for (var j = i + 1; j < g.length; j++) links.push({ a: g[i].key, b: g[j].key, w: 1, kind: 'bridge' });
    }
  });

  /* neighbour sets, so hovering can isolate one point's world */
  var nb = {};
  links.forEach(function (l) {
    (nb[l.a] = nb[l.a] || {})[l.b] = 1;
    (nb[l.b] = nb[l.b] || {})[l.a] = 1;
  });
  nodes.forEach(function (nd) {
    nd.nb = nb[nd.key] || {};
    if (nd.kind === 'topic') nd.nb['c::' + nd.courseId] = 1;
  });
  nodes.forEach(function (nd) {
    if (nd.kind !== 'course') return;
    nodes.forEach(function (o) { if (o.kind === 'topic' && o.courseId === nd.courseId) nd.nb[o.key] = 1; });
  });

  MAP.nodes = nodes; MAP.links = links; MAP.byKey = byKey;
}

/* colours borrowed from the stylesheet, so the map follows the theme */
function mapInk() {
  var theme = document.documentElement.getAttribute('data-theme') || 'light';
  if (MAP.ink && MAP.ink.theme === theme) return MAP.ink;
  var css = getComputedStyle(document.documentElement);
  var get = function (k, fb) { return (css.getPropertyValue(k) || '').trim() || fb; };
  MAP.ink = {
    theme: theme,
    paper: get('--surface', '#fff'),
    ink: get('--ink', '#14171A'),
    dim: get('--ink-2', '#454A47'),
    faint: get('--ink-3', '#767C77'),
    rule: get('--rule-2', '#A8ADA4'),
    serif: '"Iowan Old Style", Palatino, Georgia, serif'
  };
  return MAP.ink;
}

function mapS(x, y) { return [x * MAP.view.k + MAP.view.tx, y * MAP.view.k + MAP.view.ty]; }

function mapPositions() {
  MAP.nodes.forEach(function (n) {
    var a = n.ang + MAP.rot;
    n.wx = Math.cos(a) * MAP_RING;
    n.wy = Math.sin(a) * MAP_RING;
    var s = mapS(n.wx, n.wy);
    n.sx = s[0]; n.sy = s[1]; n.sa = a;
  });
}

/* a thread from a ring point to the pivot, bowed to give the wheel its spin */
function mapCentrePath(ctx, n, cx, cy) {
  var c = mapS(Math.cos(n.sa + 0.34) * MAP_RING * 0.48, Math.sin(n.sa + 0.34) * MAP_RING * 0.48);
  ctx.beginPath();
  ctx.moveTo(n.sx, n.sy);
  ctx.quadraticCurveTo(c[0], c[1], cx, cy);
}

function mapDraw() {
  var cv = $('#map');
  if (!cv) return;
  var dpr = window.devicePixelRatio || 1;
  var W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  var ink = mapInk(), k = MAP.view.k;
  mapPositions();
  var ctr = mapS(0, 0), cx = ctr[0], cy = ctr[1];
  var hov = MAP.hover;
  var lit = function (n) { return !hov || hov.key === n.key || hov.nb[n.key]; };

  /* the ring, as a construction line */
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RING * k, 0, 6.2832);
  ctx.strokeStyle = ink.rule;
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  /* a dimension bracket per subject, outside the ring */
  MAP.nodes.forEach(function (n) {
    if (n.kind !== 'course' || !n.arc) return;
    var on = lit(n);
    ctx.strokeStyle = n.color;
    ctx.globalAlpha = on ? 0.75 : 0.1;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, (MAP_RING + 20) * k, n.arc[0] + MAP.rot, n.arc[1] + MAP.rot);
    ctx.stroke();
    [n.arc[0], n.arc[1]].forEach(function (a) {
      var A = a + MAP.rot;
      var p0 = mapS(Math.cos(A) * (MAP_RING + 13), Math.sin(A) * (MAP_RING + 13));
      var p1 = mapS(Math.cos(A) * (MAP_RING + 27), Math.sin(A) * (MAP_RING + 27));
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  });

  /* threads to the pivot */
  MAP.nodes.forEach(function (n) {
    var on = lit(n);
    mapCentrePath(ctx, n, cx, cy);
    ctx.strokeStyle = n.kind === 'course' ? n.color : (n.count ? n.color : ink.rule);
    ctx.globalAlpha = on ? (n.kind === 'course' ? 0.7 : n.count ? 0.45 : 0.2) : 0.055;
    ctx.lineWidth = (n.kind === 'course' ? 1.3 : 0.8) * clamp(k, 0.6, 1.6);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  /* chords between related topics, bowed through the middle */
  MAP.links.forEach(function (l) {
    var a = MAP.byKey[l.a], b = MAP.byKey[l.b];
    if (!a || !b) return;
    var on = !hov || hov.key === a.key || hov.key === b.key;
    var c = mapS((a.wx + b.wx) / 2 * 0.32, (a.wy + b.wy) / 2 * 0.32);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.quadraticCurveTo(c[0], c[1], b.sx, b.sy);
    if (l.kind === 'bridge') {
      ctx.strokeStyle = ink.faint;
      ctx.globalAlpha = on ? (hov ? 0.7 : 0.28) : 0.05;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
    } else {
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = on ? (hov ? 0.95 : 0.5) : 0.05;
      ctx.lineWidth = Math.min(3, 0.7 + l.w * 0.32) * clamp(k, 0.6, 1.5);
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.globalAlpha = 1;

  /* the pivot */
  var pr = 4 + 2 * Math.min(1.6, k);
  ctx.beginPath();
  ctx.arc(cx, cy, pr, 0, 6.2832);
  ctx.fillStyle = ink.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, pr + 5, 0, 6.2832);
  ctx.strokeStyle = ink.faint;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* the points */
  MAP.nodes.forEach(function (n) {
    var on = lit(n);
    var R = Math.max(1.8, n.r * clamp(Math.sqrt(k), 0.55, 1.8));
    ctx.globalAlpha = on ? 1 : 0.16;
    ctx.beginPath();
    ctx.arc(n.sx, n.sy, R, 0, 6.2832);
    if (n.count) {
      ctx.fillStyle = n.color;
      ctx.fill();
    } else {
      ctx.fillStyle = ink.paper;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = n.color;
      ctx.stroke();
    }
    if (n.kind === 'course') {                       // subjects get a drawn collar
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, R + 3.5, 0, 6.2832);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (hov && hov.key === n.key) {
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, R + 7, 0, 6.2832);
      ctx.strokeStyle = ink.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  /* labels: dots when zoomed out, names as you come closer */
  if (MAP.labels) {
    var showCourse = k >= 0.42, showTopic = k >= 0.9;
    MAP.nodes.forEach(function (n) {
      var isHov = hov && hov.key === n.key;
      if (!(isHov || (n.kind === 'course' ? showCourse : showTopic)) || !lit(n)) return;
      var a = n.sa, flip = Math.cos(a) < 0;
      var out = n.kind === 'course' ? MAP_RING + 34 : MAP_RING + 11;
      var p = mapS(Math.cos(a) * out, Math.sin(a) * out);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(flip ? a + Math.PI : a);
      ctx.textAlign = flip ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.font = (n.kind === 'course' ? (isNarrow() ? '600 11.5px ' : '600 13px ') : '400 11.5px ') + ink.serif;
      var label = n.kind === 'course' ? n.label : n.label + (n.count ? ' · ' + n.count : '');
      if (isNarrow() && label.length > 11) label = label.slice(0, 10) + '…';
      ctx.strokeStyle = ink.paper;
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = n.kind === 'course' ? ink.ink : ink.dim;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
  }

  /* pivot caption */
  ctx.font = '600 9.5px ' + ink.serif;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  var cap = DB.profile.name ? DB.profile.name.toUpperCase() : 'ALL SUBJECTS';
  ctx.strokeStyle = ink.paper;
  ctx.lineWidth = 3;
  ctx.strokeText(cap, cx, cy + pr + 9);
  ctx.fillStyle = ink.faint;
  ctx.fillText(cap, cx, cy + pr + 9);
}

function mapTick() {
  if (!$('#map')) { MAP.raf = null; return; }
  if (MAP.spin) MAP.rot += 0.0012;
  mapDraw();
  MAP.raf = requestAnimationFrame(mapTick);
}

function mapFit() {
  var cv = $('#map');
  if (!cv) return;
  var W = cv.clientWidth, H = cv.clientHeight;
  /* reserve room in SCREEN pixels for the labels that sit outside the ring,
     so a long subject name never runs off the sheet */
  var m = isNarrow() ? 72 : 100;
  MAP.view.k = clamp(Math.min((W - m * 2) / (MAP_RING * 2), (H - m * 1.5) / (MAP_RING * 2)), 0.28, 3);
  MAP.view.tx = W / 2;
  MAP.view.ty = H / 2;
}

function mapNodeAt(mx, my) {
  var best = null, bestD = 1e9;
  MAP.nodes.forEach(function (n) {
    var R = Math.max(9, n.r * Math.sqrt(MAP.view.k) + 7);
    var d = (n.sx - mx) * (n.sx - mx) + (n.sy - my) * (n.sy - my);
    if (d < R * R && d < bestD) { best = n; bestD = d; }
  });
  return best;
}

function mapZoomAt(mx, my, f) {
  var k2 = clamp(MAP.view.k * f, 0.16, 4);
  f = k2 / MAP.view.k;
  MAP.view.tx = mx - (mx - MAP.view.tx) * f;
  MAP.view.ty = my - (my - MAP.view.ty) * f;
  MAP.view.k = k2;
}

function renderMap(v) {
  var ts = topicStats();
  var totalTopics = 0, litTopics = 0;
  DB.courses.forEach(function (c) {
    if (c.status === 'dropped') return;
    (c.categories || []).forEach(function (t) {
      totalTopics++;
      if (ts.nodes[c.id + '::' + t]) litTopics++;
    });
  });

  var h = '<h1>Brain Map</h1>' +
    '<p class="sub">Every subject and topic is a point on the wheel, tied back to one pivot. ' +
    'Points grow as you log sessions; topics studied together get threaded to each other.</p>' +
    '<div class="row tight" style="margin-bottom:14px">' +
      '<span class="pill"><b>' + litTopics + '</b> of ' + totalTopics + ' topics started</span>' +
      '<span class="pill"><b>' + Object.keys(ts.links).length + '</b> threads</span>' +
      '<span class="pill"><b>' + DB.courses.filter(function (c) { return c.status !== 'dropped'; }).length + '</b> subjects</span>' +
    '</div>';

  if (!totalTopics) {
    h += '<div class="empty">Your map needs topics.<br><br>Add a few to any course in ' +
      '<a href="#/classroom">Classroom</a> (e.g. Regression, ANOVA, p-values), then tick them off while logging a session.</div>';
    v.innerHTML = h;
    return;
  }

  h += '<div id="map-wrap">' +
    '<canvas id="map"></canvas>' +
    '<div id="map-ctl">' +
      '<button class="btn sm" data-act="map-zoom" data-d="1.35">Zoom in</button>' +
      '<button class="btn sm" data-act="map-zoom" data-d="0.74">Zoom out</button>' +
      '<button class="btn sm" data-act="map-fit">Fit</button>' +
      '<button class="btn sm" data-act="map-spin">' + (MAP.spin ? 'Stop' : 'Spin') + '</button>' +
      '<button class="btn sm" data-act="map-labels">Labels</button>' +
    '</div>' +
    '<div id="map-tip" class="hidden"></div>' +
    '</div>' +
    '<div class="chips" style="margin:12px 0">' + DB.courses.filter(function (c) { return c.status !== 'dropped'; }).map(function (c) {
      return '<span class="pill"><span style="display:inline-block;width:8px;height:8px;background:' + courseColor(c.id) + '"></span>' + esc(c.name) + '</span>';
    }).join('') + '</div>' +
    '<div class="hint">Hover a point to isolate its threads · drag to pan · scroll or the buttons to zoom · tap or click a point for detail. ' +
    'Zoomed out the wheel is just dots; zoom in for subject names, further in for topics. ' +
    'Hollow points are topics you have not started; dashed threads join the same topic name in two subjects.</div>';

  v.innerHTML = h;

  mapSizeRing();
  mapBuild();
  var cv = $('#map');
  mapFit();
  if (MAP.raf) cancelAnimationFrame(MAP.raf);
  mapTick();

  var tip = $('#map-tip');
  function local(e) {
    var r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function hoverAt(mx, my) {
    var n = mapNodeAt(mx, my);
    MAP.hover = n;
    if (!n) { tip.classList.add('hidden'); return; }
    tip.classList.remove('hidden');
    tip.style.left = Math.min(Math.max(6, mx + 14), Math.max(6, cv.clientWidth - 250)) + 'px';
    tip.style.top = Math.max(6, my - 12) + 'px';
    tip.innerHTML = '<b>' + esc(n.label) + '</b><br><span class="mini">' +
      (n.kind === 'course'
        ? 'subject · ' + n.count + ' sessions · ' + fmtMins(n.minutes) + ' · ' +
          (((courseById(n.courseId) || {}).categories) || []).length + ' topics'
        : esc(courseName(n.courseId)) + ' · ' +
          (n.count ? n.count + ' sessions · ' + fmtMins(n.minutes) + (n.last ? ' · last ' + fmtShort(n.last) : '')
                   : 'not started')) + '</span>';
  }

  cv.onpointermove = function (e) {
    var l = local(e);
    if (MAP.pan) {
      MAP.view.tx = MAP.pan.tx + (l[0] - MAP.pan.mx);
      MAP.view.ty = MAP.pan.ty + (l[1] - MAP.pan.my);
      return;
    }
    hoverAt(l[0], l[1]);
  };
  cv.onpointerdown = function (e) {
    var l = local(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    MAP.pan = { mx: l[0], my: l[1], tx: MAP.view.tx, ty: MAP.view.ty };
    cv.classList.add('drag');
    if (e.pointerType !== 'mouse') hoverAt(l[0], l[1]);
  };
  cv.onpointerup = function (e) {
    var l = local(e);
    var moved = MAP.pan && (Math.abs(l[0] - MAP.pan.mx) > 4 || Math.abs(l[1] - MAP.pan.my) > 4);
    MAP.pan = null;
    cv.classList.remove('drag');
    if (moved) return;
    var n = mapNodeAt(l[0], l[1]);
    if (n) mapNodeModal(n);
  };
  cv.onpointerleave = function () {
    MAP.hover = null; MAP.pan = null;
    tip.classList.add('hidden');
    cv.classList.remove('drag');
  };
  cv.onwheel = function (e) {
    e.preventDefault();
    var l = local(e);
    mapZoomAt(l[0], l[1], Math.exp(-e.deltaY * 0.0016));
  };
}

function mapNodeModal(n) {
  if (n.kind === 'course') {
    var c = courseById(n.courseId);
    if (!c) return;
    var p = progressOf(c);
    modal('<h2>' + esc(c.name) + '</h2>' +
      '<div class="row tight" style="margin:12px 0">' +
        '<span class="pill"><b>' + p.done + '</b>' + (c.totalSessions ? ' / ' + c.totalSessions : '') + ' sessions</span>' +
        '<span class="pill"><b>' + fmtMins(p.minutes) + '</b> tracked</span>' +
        '<span class="pill"><b>' + (c.categories || []).length + '</b> topics</span></div>' +
      '<div class="chips">' + (c.categories || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="modal-foot"><button class="btn" data-act="modal-close">Close</button>' +
      '<a class="btn primary" href="#/classroom" data-act="modal-close">Open in Classroom</a></div>', null);
    return;
  }
  var sess = DB.sessions.filter(function (s) { return s.courseId === n.courseId && (s.topics || []).indexOf(n.topic) >= 0; })
                        .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var related = {};
  sess.forEach(function (s) { (s.topics || []).forEach(function (t) { if (t !== n.topic) related[t] = (related[t] || 0) + 1; }); });
  modal('<h2>' + esc(n.label) + '</h2>' +
    '<p class="sub">' + esc(courseName(n.courseId)) + '</p>' +
    '<div class="row tight" style="margin-bottom:14px">' +
      '<span class="pill"><b>' + n.count + '</b> sessions</span>' +
      '<span class="pill"><b>' + fmtMins(n.minutes) + '</b></span>' +
      (n.last ? '<span class="pill">last ' + fmtShort(n.last) + '</span>' : '<span class="pill">not started</span>') + '</div>' +
    (Object.keys(related).length ? '<h3>Studied alongside</h3><div class="chips" style="margin-bottom:16px">' +
      Object.keys(related).sort(function (a, b) { return related[b] - related[a]; }).map(function (t) {
        return '<span class="tag">' + esc(t) + ' · ' + related[t] + '</span>';
      }).join('') + '</div>' : '') +
    '<h3>Recent sessions</h3>' + sessionRowsHTML(sess.slice(0, 6)) +
    '<div class="modal-foot"><button class="btn" data-act="modal-close">Close</button>' +
    '<button class="btn primary" data-act="map-log" data-c="' + n.courseId + '" data-t="' + esc(n.topic) + '">Log a session on this topic</button></div>');
}

ACTIONS['map-log'] = function (el) {
  logReset(today());
  LOGF.courseId = el.getAttribute('data-c');
  LOGF.topics = [el.getAttribute('data-t')];
  DB.lastCourseId = LOGF.courseId;
  modal(logCardHTML({ prefix: 'mlog' }).replace('class="card"', 'class=""'), function () { wireLog(); });
};
ACTIONS['map-fit'] = function () { mapFit(); };
ACTIONS['map-labels'] = function () { MAP.labels = !MAP.labels; };
ACTIONS['map-spin'] = function (el) { MAP.spin = !MAP.spin; el.textContent = MAP.spin ? 'Stop' : 'Spin'; };
ACTIONS['map-zoom'] = function (el) {
  var cv = $('#map');
  if (!cv) return;
  mapZoomAt(cv.clientWidth / 2, cv.clientHeight / 2, num(el.getAttribute('data-d'), 1.3));
};
