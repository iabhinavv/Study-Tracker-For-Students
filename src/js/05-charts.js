/* =============================================================================
   05-charts — small inline SVG charts, drawn like a drafting sheet: hatched
   fills, hairline axes with end ticks, and a light turbulence filter so the
   strokes read as hand-drawn. No chart library.

   Every chart mints its own ids (CH_ID) because several live on one page.
   ========================================================================== */

var CH_ID = 0;

/* the wobble + one hatch pattern per colour used */
function chartDefs(id, colors) {
  var d = '<defs>' +
    '<filter id="' + id + '-rough" x="-8%" y="-8%" width="116%" height="116%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="2" seed="' + (id.length * 7 % 90) + '" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>';
  (colors || []).forEach(function (c, i) {
    d += '<pattern id="' + id + '-h' + i + '" width="7" height="7" patternUnits="userSpaceOnUse" ' +
      'patternTransform="rotate(' + (25 + i * 27) + ')">' +
      '<rect width="7" height="7" fill="' + c + '" fill-opacity=".12"/>' +
      '<line x1="0" y1="0" x2="0" y2="7" stroke="' + c + '" stroke-width="1.7"/>' +
      '</pattern>';
  });
  return d + '</defs>';
}

/* ------------------------------- bars ---------------------------------- */
function barsSVG(items, opts) {
  opts = opts || {};
  var id = 'c' + (++CH_ID);
  var W = opts.w || 720, H = opts.h || 160, padL = 6, padR = 6, top = 20;
  var accent = 'var(--accent)';
  var max = 0;
  items.forEach(function (i) { if (i.v > max) max = i.v; });
  max = max || 1;
  var bw = (W - padL - padR) / Math.max(1, items.length);
  var body = '';

  /* dashed guide lines, like a scale on a drawing */
  var guides = '';
  [0.25, 0.5, 0.75, 1].forEach(function (f) {
    var y = top + (H - top) * (1 - f);
    guides += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
      '" stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 4"/>';
  });

  items.forEach(function (i, n) {
    var h = i.v / max * (H - top);
    var x = padL + n * bw, y = H - h;
    if (i.v > 0) {
      body += '<rect x="' + (x + bw * 0.17).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.66).toFixed(1) +
        '" height="' + Math.max(1.5, h).toFixed(1) + '" fill="url(#' + id + '-h0)" stroke="' + accent + '" stroke-width="1"/>';
    }
  });

  var labels = '';
  items.forEach(function (i, n) {
    var h = i.v / max * (H - top), x = padL + n * bw, y = H - h;
    if (i.v && items.length <= 16) {
      labels += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + Math.max(11, y - 5).toFixed(1) +
        '" text-anchor="middle" font-size="10" fill="var(--ink-2)">' + esc(opts.fmt ? opts.fmt(i.v) : i.v) + '</text>';
    }
    if (!opts.hideLabels && (items.length <= 16 || n % 2 === 0)) {
      labels += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H + 15) + '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' +
        esc(i.label) + '</text>';
    }
    labels += '<line x1="' + (x + bw / 2).toFixed(1) + '" y1="' + H + '" x2="' + (x + bw / 2).toFixed(1) + '" y2="' + (H + 4) +
      '" stroke="var(--rule-2)" stroke-width="1"/>';
  });

  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 24) + '">' +
    chartDefs(id, [accent]) + guides +
    '<g filter="url(#' + id + '-rough)">' + body +
      '<line x1="' + padL + '" y1="' + H + '" x2="' + (W - padR) + '" y2="' + H + '" stroke="var(--ink-3)" stroke-width="1.2"/>' +
    '</g>' + labels +
    '</svg>';
}

/* ------------------------------- donut ---------------------------------- */
/* items: [{label, v, color}] — slices hatched, total in the middle */
function donutSVG(items, opts) {
  opts = opts || {};
  var id = 'c' + (++CH_ID);
  var S = opts.size || 230, cx = S / 2, cy = S / 2;
  var R = S / 2 - 14, r = R * (opts.hole || 0.56);
  var total = items.reduce(function (a, i) { return a + i.v; }, 0);
  if (!total) return '<div class="empty">Nothing to plot yet.</div>';

  var colors = items.map(function (i) { return i.color || 'var(--accent)'; });
  var a0 = -Math.PI / 2, out = '';
  items.forEach(function (it, n) {
    var a1 = a0 + (it.v / total) * Math.PI * 2;
    var big = (a1 - a0) > Math.PI ? 1 : 0;
    var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    var xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    var xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
    out += '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) +
      ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
      ' L' + xi1.toFixed(1) + ' ' + yi1.toFixed(1) +
      ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + xi0.toFixed(1) + ' ' + yi0.toFixed(1) + ' Z" ' +
      'fill="url(#' + id + '-h' + n + ')" stroke="' + colors[n] + '" stroke-width="1.1"><title>' +
      esc(it.label + ' — ' + (opts.fmt ? opts.fmt(it.v) : it.v) + ' (' + Math.round(it.v / total * 100) + '%)') +
      '</title></path>';
    a0 = a1;
  });

  var mid = opts.centre || (opts.fmt ? opts.fmt(total) : String(total));
  return '<svg class="chart" viewBox="0 0 ' + S + ' ' + S + '" style="max-width:' + S + 'px;margin:0 auto">' +
    chartDefs(id, colors) +
    '<g filter="url(#' + id + '-rough)">' + out + '</g>' +
    '<text x="' + cx + '" y="' + (cy - 1) + '" text-anchor="middle" font-size="20" font-weight="600" fill="var(--ink)">' + esc(mid) + '</text>' +
    (opts.centreNote ? '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="10" letter-spacing="1.6" fill="var(--ink-3)">' +
      esc(String(opts.centreNote).toUpperCase()) + '</text>' : '') +
    '</svg>';
}

/* the matching legend, as drawn swatches */
function legendHTML(items, opts) {
  opts = opts || {};
  var total = items.reduce(function (a, i) { return a + i.v; }, 0) || 1;
  return '<div class="legend">' + items.map(function (i) {
    return '<div class="lrow">' +
      '<span class="sw" style="background:' + (i.color || 'var(--accent)') + '"></span>' +
      '<span class="lname">' + esc(i.label) + '</span>' +
      '<span class="lval">' + esc(opts.fmt ? opts.fmt(i.v) : i.v) + '</span>' +
      '<span class="lpct">' + Math.round(i.v / total * 100) + '%</span>' +
      '</div>';
  }).join('') + '</div>';
}

/* ------------------------------- line ---------------------------------- */
/* points: [{label, v}] — a hand-drawn trend line with a hatched underside */
function lineSVG(points, opts) {
  opts = opts || {};
  var id = 'c' + (++CH_ID);
  var W = opts.w || 720, H = opts.h || 150, pad = 8, top = 14;
  var max = 0;
  points.forEach(function (p) { if (p.v > max) max = p.v; });
  max = max || 1;
  var step = (W - pad * 2) / Math.max(1, points.length - 1);
  var xy = points.map(function (p, i) {
    return [pad + i * step, top + (H - top) * (1 - p.v / max)];
  });
  var d = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var area = d + ' L' + xy[xy.length - 1][0].toFixed(1) + ' ' + H + ' L' + xy[0][0].toFixed(1) + ' ' + H + ' Z';

  var ticks = '';
  points.forEach(function (p, i) {
    if (!p.label) return;
    if (points.length > 12 && i % Math.ceil(points.length / 8) !== 0) return;
    ticks += '<line x1="' + xy[i][0].toFixed(1) + '" y1="' + H + '" x2="' + xy[i][0].toFixed(1) + '" y2="' + (H + 4) +
      '" stroke="var(--rule-2)" stroke-width="1"/>' +
      '<text x="' + xy[i][0].toFixed(1) + '" y="' + (H + 15) + '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' +
      esc(p.label) + '</text>';
  });

  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 22) + '">' +
    chartDefs(id, ['var(--accent)']) +
    '<line x1="' + pad + '" y1="' + top + '" x2="' + (W - pad) + '" y2="' + top + '" stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 4"/>' +
    '<g filter="url(#' + id + '-rough)">' +
      '<path d="' + area + '" fill="url(#' + id + '-h0)" stroke="none"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.6"/>' +
      '<line x1="' + pad + '" y1="' + H + '" x2="' + (W - pad) + '" y2="' + H + '" stroke="var(--ink-3)" stroke-width="1.2"/>' +
    '</g>' + ticks +
    '<text x="' + (W - pad) + '" y="' + (top - 4) + '" text-anchor="end" font-size="10" fill="var(--ink-3)">' +
      esc(opts.fmt ? opts.fmt(max) : max) + '</text>' +
    '</svg>';
}

/* ---------------------------- data shapers ------------------------------ */

/* minutes per course over a set of sessions, biggest first, tail folded in */
function timeByCourse(list, maxSlices) {
  var m = {};
  list.forEach(function (s) { m[s.courseId] = (m[s.courseId] || 0) + num(s.minutes, 0); });
  var items = Object.keys(m).map(function (cid) {
    return { label: courseName(cid), v: m[cid], color: courseColor(cid) };
  }).sort(function (a, b) { return b.v - a.v; });
  if (maxSlices && items.length > maxSlices) {
    var rest = items.slice(maxSlices - 1).reduce(function (a, i) { return a + i.v; }, 0);
    items = items.slice(0, maxSlices - 1);
    items.push({ label: 'Everything else', v: rest, color: 'var(--ink-3)' });
  }
  return items;
}

/* minutes per topic, across courses */
function timeByTopic(list, maxSlices) {
  var m = {}, col = {};
  list.forEach(function (s) {
    (s.topics || []).forEach(function (t) {
      m[t] = (m[t] || 0) + num(s.minutes, 0) / (s.topics.length || 1);
      col[t] = courseColor(s.courseId);
    });
  });
  var items = Object.keys(m).map(function (t) {
    return { label: t, v: Math.round(m[t]), color: col[t] };
  }).sort(function (a, b) { return b.v - a.v; });
  return maxSlices ? items.slice(0, maxSlices) : items;
}
