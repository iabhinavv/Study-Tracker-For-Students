/* =============================================================================
   80-stats — study statistics: totals, streaks, distributions, pace and
   projections. Charts come from 05-charts.js.
   ========================================================================== */

/* sessions/day over the last N days, used for projections */
function recentPace(courseId, days) {
  days = days || 14;
  var from = shiftDays(today(), -(days - 1));
  var list = DB.sessions.filter(function (s) {
    return s.date >= from && s.date <= today() && (!courseId || s.courseId === courseId);
  });
  return sumCount(list) / days;
}

function projectFinish(c) {
  var p = progressOf(c);
  if (!c.totalSessions || p.remaining <= 0) return null;
  var pace = recentPace(c.id, 21);
  if (pace <= 0) return { eta: null, pace: 0 };
  return { eta: shiftDays(today(), Math.ceil(p.remaining / pace)), pace: pace };
}

function renderStats(v) {
  var narrow = isNarrow();
  var CW = narrow ? 360 : 720;
  var st = streaks();
  var dayMap = byDayMap();
  var days = Object.keys(dayMap).sort();
  var totalMins = sumMins(DB.sessions), totalCount = sumCount(DB.sessions);
  var best = { d: '', m: 0 };
  days.forEach(function (d) { if (dayMap[d].minutes > best.m) best = { d: d, m: dayMap[d].minutes }; });

  var h = '<h1>Statistics</h1><p class="sub">Everything below is computed from your own logged sessions.</p>';

  h += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
    '<div class="card kpi"><span class="k">Total time</span><span class="v">' + fmtMins(totalMins) + '</span>' +
      '<span class="n">' + totalCount + ' sessions</span></div>' +
    '<div class="card kpi"><span class="k">Days logged</span><span class="v">' + st.activeDays + '</span>' +
      '<span class="n">' + (st.first ? 'since ' + fmtShort(st.first) : '—') + '</span></div>' +
    '<div class="card kpi"><span class="k">Avg per day</span><span class="v">' + fmtMins(totalMins / (st.activeDays || 1)) + '</span>' +
      '<span class="n">' + (totalCount / (st.activeDays || 1)).toFixed(1) + ' sessions</span></div>' +
    '<div class="card kpi"><span class="k">Streak</span><span class="v">' + st.current + ' / ' + st.longest + '</span>' +
      '<span class="n">current / longest</span></div>' +
    '<div class="card kpi"><span class="k">Best day</span><span class="v">' + fmtMins(best.m) + '</span>' +
      '<span class="n">' + (best.d ? fmtDate(best.d) : '—') + '</span></div>' +
    '<div class="card kpi"><span class="k">Last 30 days</span><span class="v">' + fmtMins(sumMins(sessionsInRange(shiftDays(today(), -29), today()))) + '</span>' +
      '<span class="n">' + sumCount(sessionsInRange(shiftDays(today(), -29), today())) + ' sessions</span></div>' +
    '</div>';

  if (!DB.sessions.length) {
    h += '<div class="empty" style="margin-top:16px">No sessions logged yet — the charts appear as soon as you log one.</div>';
    v.innerHTML = h;
    return;
  }

  /* last 14 days */
  var d14 = [];
  for (var i = (narrow ? 6 : 13); i >= 0; i--) {
    var ds = shiftDays(today(), -i);
    d14.push({ label: fmtShort(ds), v: dayMap[ds] ? dayMap[ds].minutes : 0 });
  }
  h += '<div class="sechead"><h2>' + (narrow ? 'Last 7 days' : 'Last 14 days') + '</h2>' +
    '<span class="mini">minutes per day</span></div>' +
    '<div class="card">' + barsSVG(d14, { fmt: fmtMins, w: CW, h: narrow ? 120 : 160 }) + '</div>';

  /* last 12 weeks */
  var wk = [];
  for (var w = (narrow ? 7 : 11); w >= 0; w--) {
    var end = shiftDays(today(), -w * 7), start = shiftDays(end, -6);
    wk.push({ label: fmtShort(start), v: sumMins(sessionsInRange(start, end)) });
  }
  h += '<div class="sechead"><h2>' + (narrow ? 'Last 8 weeks' : 'Last 12 weeks') + '</h2>' +
    '<span class="mini">minutes per week</span></div>' +
    '<div class="card">' + barsSVG(wk, { fmt: fmtMins, w: CW, h: narrow ? 120 : 160 }) + '</div>';

  /* months */
  var months = monthlySummary().slice().reverse();
  h += '<div class="sechead"><h2>Month by month</h2><span class="mini">total time</span></div>' +
    '<div class="card">' + barsSVG(months.slice(narrow ? -8 : -14).map(function (m) { return { label: fmtMonth(m.key).slice(0, 3) + ' ' + m.key.slice(2, 4), v: m.minutes }; }), { fmt: fmtMins, w: CW, h: narrow ? 120 : 160 }) + '</div>';

  /* weekday shape */
  var wd = [0, 0, 0, 0, 0, 0, 0], wdn = [0, 0, 0, 0, 0, 0, 0];
  days.forEach(function (d) { var k = fromISO(d).getDay(); wd[k] += dayMap[d].minutes; wdn[k]++; });
  h += '<div class="sechead"><h2>Which days you actually study</h2><span class="mini">average minutes on days you logged</span></div>' +
    '<div class="card">' + barsSVG(DOW.map(function (n, i2) { return { label: n, v: wdn[i2] ? Math.round(wd[i2] / wdn[i2]) : 0 }; }), { fmt: fmtMins, h: narrow ? 110 : 130, w: CW }) + '</div>';

  /* where the time actually went */
  var byCourse = timeByCourse(DB.sessions, 8);
  var byTopic = timeByTopic(DB.sessions, 8);
  h += '<div class="sechead"><h2>Where the time went</h2><span class="mini">share of tracked minutes</span></div>' +
    '<div class="grid g2">' +
      '<div class="card"><h3>By course</h3>' +
        donutSVG(byCourse, { fmt: fmtMins, centreNote: 'tracked', size: narrow ? 190 : 230 }) + legendHTML(byCourse, { fmt: fmtMins }) + '</div>' +
      '<div class="card"><h3>By topic</h3>' +
        (byTopic.length ? donutSVG(byTopic, { fmt: fmtMins, centreNote: 'top topics', size: narrow ? 190 : 230 }) + legendHTML(byTopic, { fmt: fmtMins })
                        : '<div class="empty">Tick topics while logging and this fills in.</div>') + '</div>' +
    '</div>';

  /* per course */
  h += '<div class="sechead"><h2>By course</h2></div><div class="card scroll-x"><table><thead><tr>' +
    '<th>Course</th><th class="num">Done</th><th class="num">Progress</th><th class="num">Time</th>' +
    '<th class="num">Avg/session</th><th class="num">Pace (3wk)</th><th>Deadline</th><th>Projected finish</th></tr></thead><tbody>';
  DB.courses.forEach(function (c) {
    var p = progressOf(c), pr = projectFinish(c), need = paceNeeded(c);
    var etaTxt = '—', cls = '';
    if (pr && pr.eta) {
      etaTxt = fmtShortY(pr.eta);
      if (c.deadline) {
        var slack = daysBetween(pr.eta, c.deadline);
        cls = slack >= 0 ? 'ok' : 'bad';
        etaTxt += ' <span class="pill ' + cls + '">' + (slack >= 0 ? slack + 'd early' : Math.abs(slack) + 'd late') + '</span>';
      }
    } else if (pr) {
      etaTxt = '<span class="mini">no recent activity</span>';
    } else if (c.totalSessions && p.remaining === 0) {
      etaTxt = '<span class="pill ok">target met</span>';
    }
    h += '<tr>' +
      '<td><span class="row tight"><span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:' + courseColor(c.id) + '"></span>' +
        esc(c.name) + (c.status !== 'active' ? ' <span class="tag">' + c.status + '</span>' : '') + '</span></td>' +
      '<td class="num">' + p.done + (c.totalSessions ? ' / ' + c.totalSessions : '') + '</td>' +
      '<td class="num" style="min-width:110px"><div class="bar"><i style="width:' + p.pct + '%"></i></div><span class="mini">' + p.pct + '%</span></td>' +
      '<td class="num">' + fmtMins(p.minutes) + '</td>' +
      '<td class="num">' + (p.logged ? fmtMins(p.minutes / p.logged) : '—') + '</td>' +
      '<td class="num">' + (pr ? pr.pace.toFixed(2) : '—') + '</td>' +
      '<td>' + (c.deadline ? fmtShortY(c.deadline) + (need && need !== Infinity ? ' <span class="mini">(' + need.toFixed(1) + '/day needed)</span>' : '') : '<span class="mini">none</span>') + '</td>' +
      '<td>' + etaTxt + '</td>' +
    '</tr>';
  });
  h += '</tbody></table></div>';

  /* topics */
  var ts = topicStats();
  var tk = Object.keys(ts.nodes).sort(function (a, b) { return ts.nodes[b].minutes - ts.nodes[a].minutes; }).slice(0, 15);
  if (tk.length) {
    h += '<div class="sechead"><h2>Most studied topics</h2><a class="mini" href="#/map">See the map</a></div>' +
      '<div class="card scroll-x"><table><thead><tr><th>Topic</th><th>Course</th><th class="num">Sessions</th><th class="num">Time</th><th>Last</th></tr></thead><tbody>' +
      tk.map(function (k) {
        var n = ts.nodes[k];
        return '<tr><td><b>' + esc(n.topic) + '</b></td><td><span class="row tight">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:' + courseColor(n.courseId) + '"></span>' +
          esc(courseName(n.courseId)) + '</span></td>' +
          '<td class="num">' + n.count + '</td><td class="num">' + fmtMins(n.minutes) + '</td><td>' + (n.last ? fmtShort(n.last) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  v.innerHTML = h;
}
