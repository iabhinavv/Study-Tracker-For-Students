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

function courseActionsHTML(c) {
  return '<div class="continue-actions"><button class="btn primary" data-act="course-focus" data-id="' + c.id + '">Start focus</button>' +
    (c.link ? '<a class="btn" href="' + esc(c.link) + '" target="_blank" rel="noopener">Open course</a>' : '') +
    '<button class="btn ghost" data-act="quick-log" data-course="' + c.id + '">Log</button></div>';
}
function renderDashboard(v) {
  var t = today(), todayList = sessionsInRange(t, t), weekList = sessionsInRange(shiftDays(t, -6), t);
  var goal = DB.profile.dailyGoalMin || 0, minutes = sumMins(todayList), st = streaks();
  var hour = new Date().getHours();
  var greet = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  var h = '<h1>' + greet + (DB.profile.name ? ', ' + esc(DB.profile.name) : '') + '</h1>' +
    '<p class="sub">' + fmtDate(t) + ' · Make room for a little progress.</p>';
  h += '<div class="home-overview"><div class="card home-goal">' + (goal ? goalRingHTML(minutes, goal, 90) : '') +
    '<div class="kpi"><span class="k">Study time today</span><span class="v">' + fmtMins(minutes) + '</span>' +
    '<span class="n">' + (goal ? fmtMins(Math.max(0, goal - minutes)) + ' to your ' + fmtMins(goal) + ' goal' : 'Every bit counts') +
    '</span><span class="mini">' + todayList.length + ' study entries · ' + todayList.filter(function (s) { return s.source === 'focus'; }).length + ' focus blocks</span></div></div>' +
    '<div class="home-readings"><div class="card kpi"><span class="k">This week</span><span class="v">' + fmtMins(sumMins(weekList)) +
    '</span><span class="n">Last 7 days</span></div><div class="card kpi"><span class="k">Study streak</span><span class="v">' + st.current +
    ' <span class="mini">days</span></span><span class="n">Best ' + st.longest + ' days</span></div></div></div>';
  if (typeof pomoReceiptsHTML === 'function') h += pomoReceiptsHTML();
  var courses = activeCourses().slice().sort(function (a, b) {
    if (a.id === DB.lastCourseId) return -1; if (b.id === DB.lastCourseId) return 1;
    var da = a.deadline ? daysLeft(a) : Infinity, db = b.deadline ? daysLeft(b) : Infinity;
    return da - db || progressOf(b).last.localeCompare(progressOf(a).last);
  });
  h += '<div class="sechead"><h2>Continue studying</h2><span class="spacer"></span><a href="#/classroom">All courses</a></div>';
  if (!courses.length) h += '<div class="empty">Your next chapter starts here. <a class="btn primary" href="#/classroom">Add a course</a></div>';
  else {
    h += '<div class="grid g3">' + courses.slice(0, 3).map(function (c) {
      var p = progressOf(c);
      return '<div class="card course-card continue-card"><div class="cardhead"><span class="dot" style="background:' + courseColor(c.id) + '"></span><h3 class="ttl" style="text-transform:none;letter-spacing:0;color:var(--ink);margin:0">' + esc(c.name) + '</h3></div>' +
        '<div class="mini">' + p.done + (c.totalSessions ? ' / ' + c.totalSessions : '') + ' ' + esc(courseUnit(c)) + ' completed</div>' +
        (c.totalSessions ? '<div class="bar" role="progressbar" aria-label="' + esc(c.name) + ' progress" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p.pct + '%"></i></div>' : '') +
        '<div class="mini">' + (c.deadline ? 'Due ' + fmtShortY(c.deadline) : p.last ? 'Last studied ' + fmtShort(p.last) : 'Ready when you are') + '</div>' + courseActionsHTML(c) + '</div>';
    }).join('') + '</div>';
  }
  var alerts = deadlineAlerts();
  if (alerts.length) {
    h += '<div class="sechead"><h2>Upcoming deadlines</h2></div><div class="card">' + alerts.map(function (a) {
      return '<div class="row receipt"><b>' + esc(a.course.name) + '</b><span class="pill ' + (a.dl < 0 ? 'bad' : 'warn') + '">' +
        (a.dl < 0 ? Math.abs(a.dl) + ' days overdue' : a.dl === 0 ? 'Due today' : a.dl + ' days left') +
        '</span><span class="spacer"></span><button class="btn sm" data-act="course-deadline-decide" data-id="' + a.course.id + '">Review</button></div>';
    }).join('') + '</div>';
  }
  h += '<div class="sechead"><h2>Today’s activity</h2><span class="spacer"></span><button class="btn sm" data-act="quick-log">Log a session</button></div>' +
    '<div class="card activity-list">' + (todayList.length ? sessionRowsHTML(todayList.slice().reverse(), { showDate: false }) :
      '<div class="empty">A fresh page. Start a focus block or record what you have studied.</div>') + '</div>';
  h += '<div class="sechead"><h2>Your week</h2><span class="spacer"></span><a href="#/stats">Full statistics</a></div>';
  if (DB.sessions.length) {
    var dm = byDayMap(), data = [];
    for (var i = 6; i >= 0; i--) { var d = shiftDays(t, -i); data.push({label: fmtShort(d), v: dm[d] ? dm[d].minutes : 0}); }
    h += '<div class="card">' + barsSVG(data, {fmt: fmtMins, w: isNarrow() ? 360 : 720, h: isNarrow() ? 120 : 150}) + '</div>';
  } else h += '<div class="card mini">Your weekly study chart will appear after your first entry.</div>';
  v.innerHTML = h;
}
