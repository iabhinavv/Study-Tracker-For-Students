/* =============================================================================
   20-dashboard — today at a glance: the readings, then the same readings drawn.
   Charts come from 05-charts.js; this file only decides what to plot.
   ========================================================================== */

function goalRingHTML(mins, goal, size) {
  size = size || 82;
  var r = size / 2 - 6, cx = size / 2, cy = size / 2;
  var frac = goal > 0 ? clamp(mins / goal, 0, 1) : 0;
  var circ = 2 * Math.PI * r;
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="font-family:inherit">' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--rule)" stroke-width="5" stroke-dasharray="2 3"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="5" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - frac)).toFixed(1) + '" ' +
      'transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
    '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" fill="var(--ink)" font-size="15" font-weight="600">' +
      Math.round(frac * 100) + '%</text>' +
    '</svg>';
}

function miniStripHTML(days) {
  days = days || 30;
  var m = byDayMap(), max = 0, out = '';
  var list = [];
  for (var i = days - 1; i >= 0; i--) {
    var d = shiftDays(today(), -i), v = m[d] ? m[d].minutes : 0;
    list.push([d, v]);
    if (v > max) max = v;
  }
  list.forEach(function (p) {
    var lvl = p[1] === 0 ? 0 : clamp(Math.ceil(p[1] / (max || 1) * 4), 1, 4);
    out += '<div class="c" data-l="' + lvl + '" title="' + fmtDate(p[0]) + ' — ' + fmtMins(p[1]) + '"></div>';
  });
  return '<div class="heat" style="flex-wrap:wrap;gap:3px">' + out + '</div>';
}

function deadlineAlerts() {
  var out = [];
  DB.courses.forEach(function (c) {
    if (c.status !== 'active' || !c.deadline) return;
    var dl = daysLeft(c);
    if (dl <= 7) out.push({ course: c, dl: dl });
  });
  return out.sort(function (a, b) { return a.dl - b.dl; });
}

function renderDashboard(v) {
  var t = today();
  var todayList = DB.sessions.filter(function (s) { return s.date === t; });
  var weekList = sessionsInRange(shiftDays(t, -6), t);
  var monthList = sessionsInRange(shiftDays(t, -29), t);
  var st = streaks();
  var goal = DB.profile.dailyGoalMin || 0;
  var totalMins = sumMins(DB.sessions);
  var alerts = deadlineAlerts();
  var hour = new Date().getHours();
  var greet = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  var html = '';
  html += '<h1>' + greet + (DB.profile.name ? ', ' + esc(DB.profile.name) : '') + '</h1>';
  html += '<p class="sub">' + fmtDate(t) + ' · ' + activeCourses().length + ' active course' +
          (activeCourses().length === 1 ? '' : 's') + '</p>';

  /* deadline nudges */
  if (alerts.length) {
    html += '<div class="card" style="border-left:3px solid var(--warn);margin-bottom:16px">';
    html += '<h3 style="color:var(--warn)">Deadlines</h3>';
    alerts.forEach(function (a) {
      var over = a.dl < 0;
      html += '<div class="row" style="padding:7px 0;border-bottom:1px dashed var(--rule)">' +
        '<b>' + esc(a.course.name) + '</b>' +
        '<span class="pill ' + (over ? 'bad' : 'warn') + '">' +
          (over ? Math.abs(a.dl) + ' day' + (Math.abs(a.dl) === 1 ? '' : 's') + ' overdue' :
           a.dl === 0 ? 'due today' : a.dl + ' day' + (a.dl === 1 ? '' : 's') + ' left') + '</span>' +
        '<span class="mini">' + progressOf(a.course).remaining + ' sessions remaining</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn sm" data-act="course-deadline-decide" data-id="' + a.course.id + '">Decide</button>' +
      '</div>';
    });
    html += '</div>';
  }

  /* the readings */
  html += '<div class="grid g4">';
  html += '<div class="card row span2" style="gap:14px">' + goalRingHTML(sumMins(todayList), goal) +
    '<div class="kpi"><span class="k">Today</span><span class="v">' + fmtMins(sumMins(todayList)) + '</span>' +
    '<span class="n">' + sumCount(todayList) + ' sessions' + (goal ? ' · goal ' + fmtMins(goal) : '') + '</span></div></div>';
  html += '<div class="card kpi"><span class="k">Last 7 days</span><span class="v">' + fmtMins(sumMins(weekList)) + '</span>' +
    '<span class="n">' + sumCount(weekList) + ' sessions · ' + Math.round(sumMins(weekList) / 7) + 'm/day</span></div>';
  html += '<div class="card kpi"><span class="k">Streak</span><span class="v">' + st.current +
    ' <span style="font-size:15px;font-weight:400;color:var(--ink-3)">' + (st.current === 1 ? 'day' : 'days') + '</span></span>' +
    '<span class="n">longest ' + st.longest + ' · ' + st.activeDays + ' days logged</span></div>';
  html += '<div class="card kpi"><span class="k">All time</span><span class="v">' + fmtMins(totalMins) + '</span>' +
    '<span class="n">' + sumCount(DB.sessions) + ' sessions logged</span></div>';
  html += '</div>';

  /* the same readings, drawn */
  if (DB.sessions.length) {
    var dayMap = byDayMap();
    var narrow = isNarrow();
    var d14 = [];
    for (var i = (narrow ? 6 : 13); i >= 0; i--) {
      var ds = shiftDays(t, -i);
      d14.push({ label: fmtShort(ds), v: dayMap[ds] ? dayMap[ds].minutes : 0 });
    }
    var courseSlices = timeByCourse(monthList.length ? monthList : DB.sessions, 6);
    var wk = [];
    for (var w = 7; w >= 0; w--) {
      var end = shiftDays(t, -w * 7), start = shiftDays(end, -6);
      wk.push({ label: fmtShort(start), v: sumMins(sessionsInRange(start, end)) });
    }

    html += '<div class="sechead"><h2>' + (narrow ? 'The last week' : 'The last two weeks') + '</h2>' +
      '<span class="mini">minutes per day</span></div>';
    html += '<div class="card">' + barsSVG(d14, { fmt: fmtMins, h: narrow ? 120 : 150, w: narrow ? 360 : 720 }) + '</div>';

    html += '<div class="sechead"><h2>Balance and trend</h2>' +
      '<span class="mini">share by course · minutes per week</span>' +
      '<span class="spacer"></span><a class="mini" href="#/stats">Full statistics</a></div>';
    html += '<div class="split charts">';
    html += '<div class="card"><h3>Time by course</h3>' +
      donutSVG(courseSlices, { fmt: fmtMins, centreNote: monthList.length ? 'last 30 days' : 'all time', size: narrow ? 190 : 205 }) +
      legendHTML(courseSlices, { fmt: fmtMins }) + '</div>';
    html += '<div class="card"><h3>Weekly trend</h3>' + lineSVG(wk, { fmt: fmtMins, h: narrow ? 130 : 165, w: narrow ? 360 : 720 }) +
      '<div class="hint">Each point is one week of tracked minutes.</div></div>';
    html += '</div>';
  }

  /* log + today */
  html += '<div class="sechead"><h2>Log today</h2><span class="spacer"></span>' +
    '<a class="mini" href="#/calendar">Open calendar</a></div>';
  html += '<div class="split log">';
  html += logCardHTML();
  html += '<div class="card"><h3>Today</h3>' +
    sessionRowsHTML(todayList.slice().reverse(), { showDate: false }) +
    '<h3 style="margin-top:18px">Last 30 days</h3>' + miniStripHTML(30) + '</div>';
  html += '</div>';

  /* course progress */
  var act = activeCourses().slice().sort(function (a, b) {
    var da = a.deadline ? daysLeft(a) : 9999, db2 = b.deadline ? daysLeft(b) : 9999;
    return da - db2;
  });
  html += '<div class="sechead"><h2>Course progress</h2><span class="spacer"></span>' +
          '<a class="mini" href="#/classroom">Manage courses</a></div>';
  if (!act.length) {
    html += '<div class="empty">No active courses. <a href="#/classroom">Add one</a></div>';
  } else {
    html += '<div class="grid g2">';
    act.forEach(function (c) {
      var p = progressOf(c), dl = daysLeft(c), pace = paceNeeded(c);
      html += '<div class="card course-card">' +
        '<div class="cardhead"><span class="dot" style="background:' + courseColor(c.id) + '"></span>' +
          '<span class="ttl">' + esc(c.name) + '</span>' +
          '<span class="mini">' + (c.totalSessions ? p.done + '/' + c.totalSessions : p.done + ' done') + '</span></div>' +
        '<div class="bar"><i style="width:' + p.pct + '%"></i></div>' +
        '<div class="row tight mini">' +
          '<span>' + fmtMins(p.minutes) + ' logged</span>' +
          (c.totalSessions ? '<span>· ' + p.remaining + ' left</span>' : '') +
          (dl !== null ? '<span class="pill ' + (dl < 0 ? 'bad' : dl <= 7 ? 'warn' : '') + '">Due ' + fmtShortY(c.deadline) +
            ' (' + (dl < 0 ? Math.abs(dl) + 'd over' : dl + 'd') + ')</span>' : '') +
          (pace && pace !== Infinity ? '<span class="pill">' + pace.toFixed(1) + ' sess/day needed</span>' : '') +
        '</div>' +
        (c.link ? '<div class="linkline"><a href="' + esc(c.link) + '" target="_blank" rel="noopener">Open course</a></div>' : '') +
      '</div>';
    });
    html += '</div>';
  }

  v.innerHTML = html;
  wireLog();
}
