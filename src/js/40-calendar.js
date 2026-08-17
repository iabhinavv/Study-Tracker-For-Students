/* =============================================================================
   40-calendar — month grid, day detail, year heatmap, month-by-month summary.
   This is the "did I actually show up?" page, over days, months and years.
   ========================================================================== */

var CAL = { month: today().slice(0, 7), sel: today(), year: today().slice(0, 4), courseId: '' };

function calFiltered() {
  return CAL.courseId ? DB.sessions.filter(function (s) { return s.courseId === CAL.courseId; }) : DB.sessions;
}

function calDayMap(list) {
  var m = {};
  list.forEach(function (s) {
    if (!m[s.date]) m[s.date] = { count: 0, minutes: 0, courses: {} };
    m[s.date].count += num(s.count, 0);
    m[s.date].minutes += num(s.minutes, 0);
    m[s.date].courses[s.courseId] = true;
  });
  return m;
}

function monthGridHTML(mk, dayMap) {
  var y = +mk.slice(0, 4), mo = +mk.slice(5, 7) - 1;
  var first = new Date(y, mo, 1), dim = new Date(y, mo + 1, 0).getDate();
  var startPad = first.getDay();                     // week starts Sunday
  var max = 0;
  Object.keys(dayMap).forEach(function (d) { if (d.slice(0, 7) === mk && dayMap[d].minutes > max) max = dayMap[d].minutes; });

  var h = '<div class="cal">' + DOW.map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
  for (var i = 0; i < startPad; i++) h += '<div class="day pad"></div>';
  for (var d = 1; d <= dim; d++) {
    var ds = y + '-' + pad2(mo + 1) + '-' + pad2(d);
    var e = dayMap[ds];
    var lvl = !e ? 0 : clamp(Math.ceil(e.minutes / (max || 1) * 4), 1, 4);
    var dots = e ? Object.keys(e.courses).map(function (cid) {
      return '<span style="display:inline-block;width:6px;height:6px;border-radius:1px;background:' + courseColor(cid) + '"></span>';
    }).join('') : '';
    h += '<div class="day' + (ds === today() ? ' today' : '') + (ds === CAL.sel ? ' sel' : '') +
      (lvl >= 3 ? ' deep' : '') + '" ' +
      'data-act="cal-day" data-d="' + ds + '" ' +
      'style="background:' + (lvl ? 'color-mix(in srgb, var(--accent) ' + (lvl * 15) + '%, var(--surface))' : 'var(--surface)') + '">' +
      '<div class="d">' + d + '</div>' +
      (e ? '<div class="m">' + fmtMinsTight(e.minutes) + '</div><div class="row tight" style="gap:3px">' + dots + '</div>' : '') +
      '</div>';
  }
  h += '</div>';
  return h;
}

function yearHeatHTML(year, dayMap) {
  var start = new Date(+year, 0, 1), end = new Date(+year, 11, 31);
  // back up to the Sunday on/just before Jan 1
  var cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay());
  var max = 0;
  Object.keys(dayMap).forEach(function (d) { if (d.slice(0, 4) === year && dayMap[d].minutes > max) max = dayMap[d].minutes; });

  var h = '<div class="heat">';
  while (cur <= end) {
    h += '<div class="wk">';
    for (var i = 0; i < 7; i++) {
      var ds = iso(cur), inYear = ds.slice(0, 4) === year;
      var e = inYear ? dayMap[ds] : null;
      var lvl = !e ? 0 : clamp(Math.ceil(e.minutes / (max || 1) * 4), 1, 4);
      h += '<div class="c" data-l="' + lvl + '"' + (inYear ? ' title="' + fmtDate(ds) + ' — ' + (e ? fmtMins(e.minutes) + ', ' + e.count + ' sessions' : 'nothing') + '"' : ' style="opacity:.25"') + '></div>';
      cur.setDate(cur.getDate() + 1);
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderCalendar(v) {
  var list = calFiltered();
  var dayMap = calDayMap(list);
  var mk = CAL.month;
  var monthList = list.filter(function (s) { return monthKey(s.date) === mk; });
  var selList = list.filter(function (s) { return s.date === CAL.sel; });
  var years = {};
  DB.sessions.forEach(function (s) { years[s.date.slice(0, 4)] = 1; });
  years[today().slice(0, 4)] = 1;

  var h = '<div class="row"><div><h1>Log &amp; Calendar</h1>' +
    '<p class="sub">Click any day to see or add sessions. Colour = minutes studied.</p></div>' +
    '<span class="spacer"></span>' +
    '<select id="cal-course" class="filter">' + courseOptions(CAL.courseId, true) + '</select></div>';

  /* month nav + grid + day detail */
  h += '<div class="split cal">';
  h += '<div class="card">' +
    '<div class="row" style="margin-bottom:10px">' +
      '<button class="btn sm" data-act="cal-prev">‹</button>' +
      '<h2 style="margin:0;min-width:150px;text-align:center">' + fmtMonth(mk) + '</h2>' +
      '<button class="btn sm" data-act="cal-next">›</button>' +
      '<button class="btn sm ghost" data-act="cal-today">Today</button>' +
      '<span class="spacer"></span>' +
      '<span class="pill"><b>' + fmtMins(sumMins(monthList)) + '</b> this month</span>' +
      '<span class="pill"><b>' + sumCount(monthList) + '</b> sessions</span>' +
    '</div>' + monthGridHTML(mk, dayMap) + '</div>';

  h += '<div class="card">' +
    '<div class="row" style="margin-bottom:8px"><h2 style="margin:0">' + fmtDate(CAL.sel) + '</h2></div>' +
    '<div class="row tight mini" style="margin-bottom:10px">' +
      '<span class="pill"><b>' + fmtMins(sumMins(selList)) + '</b></span>' +
      '<span class="pill"><b>' + sumCount(selList) + '</b> sessions</span></div>' +
    sessionRowsHTML(selList, { showDate: false }) +
    '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="cal-add" data-d="' + CAL.sel + '">Log on this day</button></div>' +
    '</div>';
  h += '</div>';

  /* year heatmap */
  h += '<div class="sechead"><h2>Year view</h2>' +
    '<select id="cal-year" class="filter narrow">' + Object.keys(years).sort().reverse().map(function (y) {
      return '<option' + (y === CAL.year ? ' selected' : '') + '>' + y + '</option>';
    }).join('') + '</select></div>';
  var yList = list.filter(function (s) { return s.date.slice(0, 4) === CAL.year; });
  h += '<div class="card"><div class="row tight mini" style="margin-bottom:10px">' +
    '<span class="pill"><b>' + fmtMins(sumMins(yList)) + '</b> in ' + CAL.year + '</span>' +
    '<span class="pill"><b>' + sumCount(yList) + '</b> sessions</span>' +
    '<span class="pill"><b>' + Object.keys(calDayMap(yList)).length + '</b> active days</span>' +
    '</div>' + yearHeatHTML(CAL.year, dayMap) + '</div>';

  /* month-by-month summary */
  h += '<div class="sechead"><h2>Every month you have studied</h2></div>';
  var months = monthlySummary();
  if (!months.length) {
    h += '<div class="empty">Log your first session and this table starts filling up.</div>';
  } else {
    h += '<div class="card scroll-x"><table><thead><tr>' +
      '<th>Month</th><th class="num">Sessions</th><th class="num">Time</th><th class="num">Active days</th>' +
      '<th class="num">Avg / active day</th><th>Most studied</th></tr></thead><tbody>';
    months.forEach(function (m) {
      h += '<tr><td><a href="#" data-act="cal-goto" data-m="' + m.key + '">' + fmtMonth(m.key) + '</a></td>' +
        '<td class="num">' + m.count + '</td>' +
        '<td class="num">' + fmtMins(m.minutes) + '</td>' +
        '<td class="num">' + m.activeDays + '</td>' +
        '<td class="num">' + fmtMins(m.minutes / (m.activeDays || 1)) + '</td>' +
        '<td><span class="row tight"><span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:' +
          courseColor(m.topCourse) + '"></span>' + esc(courseName(m.topCourse)) + '</span></td></tr>';
    });
    h += '</tbody></table></div>';
  }

  v.innerHTML = h;
  var cs = $('#cal-course');
  if (cs) cs.onchange = function () { CAL.courseId = cs.value; route(); };
  var ys = $('#cal-year');
  if (ys) ys.onchange = function () { CAL.year = ys.value; route(); };
}

function monthShift(mk, n) {
  var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1 + n;
  var d = new Date(y, m, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

ACTIONS['cal-prev'] = function () { CAL.month = monthShift(CAL.month, -1); route(); };
ACTIONS['cal-next'] = function () { CAL.month = monthShift(CAL.month, 1); route(); };
ACTIONS['cal-today'] = function () { CAL.month = today().slice(0, 7); CAL.sel = today(); route(); };
ACTIONS['cal-day'] = function (el) { CAL.sel = el.getAttribute('data-d'); route(); };
ACTIONS['cal-goto'] = function (el) { CAL.month = el.getAttribute('data-m'); CAL.sel = el.getAttribute('data-m') + '-01'; route(); };
ACTIONS['cal-add'] = function (el) {
  logReset(el.getAttribute('data-d'));
  modal(logCardHTML({ prefix: 'clog' }).replace('class="card"', 'class=""'), function () { wireLog(); });
};
