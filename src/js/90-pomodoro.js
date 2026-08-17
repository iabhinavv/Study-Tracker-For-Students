/* =============================================================================
   90-pomodoro — the timer widget. Lives in the top bar on every page, opens
   into a panel. Survives page switches and reloads (it stores an end time, not
   a countdown), and can log the finished block straight into a course.
   ========================================================================== */

var POMO_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

function pomoCfg() { return DB.pomoCfg; }
function pomoLen(phase) {
  var c = pomoCfg();
  return (phase === 'focus' ? c.focus : phase === 'short' ? c.short : c.long) * 60;
}

function pomoState() {
  if (!DB.pomo) DB.pomo = { phase: 'focus', running: false, endsAt: 0, left: pomoLen('focus'), cycles: 0, courseId: null };
  return DB.pomo;
}
function pomoLeft() {
  var p = pomoState();
  return p.running ? Math.max(0, (p.endsAt - Date.now()) / 1000) : p.left;
}

function pomoBeep(times) {
  if (!pomoCfg().sound) return;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    for (var i = 0; i < (times || 2); i++) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      var t0 = ctx.currentTime + i * 0.32;
      o.type = 'sine';
      o.frequency.setValueAtTime(i % 2 ? 660 : 880, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.3);
    }
    setTimeout(function () { ctx.close(); }, 1500);
  } catch (e) { /* audio is a nice-to-have */ }
}

function pomoNotify(title, body) {
  try {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body: body });
    }
  } catch (e) { /* ignore */ }
}

function pomoStart() {
  var p = pomoState();
  if (p.running) return;
  if (p.left <= 0) p.left = pomoLen(p.phase);
  p.endsAt = Date.now() + p.left * 1000;
  p.running = true;
  dbSave(true);
  if (window.Notification && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) { /* ignore */ }
  }
  pomoPaint();
}
function pomoPause() {
  var p = pomoState();
  if (!p.running) return;
  p.left = pomoLeft();
  p.running = false;
  dbSave(true);
  pomoPaint();
}
function pomoReset() {
  var p = pomoState();
  p.running = false;
  p.left = pomoLen(p.phase);
  dbSave(true);
  pomoPaint();
}
function pomoSetPhase(phase, autoStart) {
  var p = pomoState();
  p.phase = phase;
  p.left = pomoLen(phase);
  p.running = false;
  if (autoStart) pomoStart(); else { dbSave(true); pomoPaint(); }
}

/* a focus block ran out */
function pomoFinish(awayMinutes) {
  var p = pomoState(), c = pomoCfg();
  if (p.phase === 'focus') {
    p.cycles = (p.cycles || 0) + 1;
    var mins = c.focus;
    var course = p.courseId ? courseById(p.courseId) : null;
    if (c.autoLog && course) {
      DB.sessions.push({
        id: uid(), courseId: course.id, date: today(),
        count: c.countAsSession ? 1 : 0, minutes: mins,
        topics: [], note: 'Pomodoro', createdAt: new Date().toISOString()
      });
      DB.lastCourseId = course.id;
      toast('Focus block done — ' + fmtMins(mins) + ' logged to ' + esc(course.name));
    } else {
      toast('Focus block done — ' + fmtMins(mins), 8000, course ? 'Log it' : null, course ? function () {
        DB.sessions.push({
          id: uid(), courseId: course.id, date: today(), count: c.countAsSession ? 1 : 0,
          minutes: mins, topics: [], note: 'Pomodoro', createdAt: new Date().toISOString()
        });
        dbSave(true); route();
      } : null);
    }
    pomoBeep(3);
    pomoNotify('Focus block done', (course ? course.name + ' · ' : '') + 'take a break');
    var nextPhase = (p.cycles % (c.cycle || 4) === 0) ? 'long' : 'short';
    pomoSetPhase(nextPhase, false);
  } else {
    pomoBeep(2);
    pomoNotify('Break over', 'Back to it');
    toast('Break over — next focus block ready');
    pomoSetPhase('focus', false);
  }
  if (awayMinutes) toast('The timer finished while this tab was away.', 4000);
  dbSave(true);
  route();
}

var POMO_RING = 168;

/* structure is built once; pomoPaint() then only rewrites the numbers, so the
   settings inputs never lose focus to the 4×/second tick */
function pomoMountMini() {
  var mini = $('#pomo-mini');
  if (!mini) return;
  mini.innerHTML =
    '<span class="lbl" id="pm-lbl">Focus</span>' +
    '<span class="t">--:--</span>' +
    '<button class="btn sm icon" data-act="pomo-toggle" id="pm-toggle" title="Start or pause (P)">Start</button>' +
    '<button class="btn sm icon" data-act="pomo-panel" title="Timer panel">Timer</button>';
}

function pomoMountPanel() {
  var panel = $('#pomo-panel'), p = pomoState(), c = pomoCfg();
  var r = POMO_RING / 2 - 12, cx = POMO_RING / 2, circ = 2 * Math.PI * r;
  panel.innerHTML =
    '<div class="row" style="margin-bottom:10px"><span class="head">Pomodoro</span><span class="spacer"></span>' +
      '<button class="btn sm ghost icon" data-act="pomo-panel">Close</button></div>' +
    '<div style="position:relative">' +
      '<svg width="' + POMO_RING + '" height="' + POMO_RING + '" viewBox="0 0 ' + POMO_RING + ' ' + POMO_RING + '" style="display:block;margin:0 auto">' +
        '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="7"/>' +
        '<circle id="pm-arc" cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="7" ' +
          'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" ' +
          'transform="rotate(-90 ' + cx + ' ' + cx + ')"/>' +
      '</svg>' +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center">' +
        '<div class="clock" id="pm-clock">--:--</div>' +
        '<div class="phase" id="pm-phase">Focus</div>' +
      '</div></div>' +
    '<div class="row" style="justify-content:center;margin:12px 0">' +
      '<button class="btn primary" data-act="pomo-toggle" id="pm-big">Start</button>' +
      '<button class="btn sm" data-act="pomo-reset">Reset</button>' +
      '<button class="btn sm" data-act="pomo-skip">Skip</button>' +
    '</div>' +
    '<div class="field" style="margin-bottom:8px"><label class="f">Working on</label>' +
      '<select id="pomo-course"><option value="">— nothing yet —</option>' + courseOptions(p.courseId) + '</select></div>' +
    '<div class="row tight mini" style="margin-bottom:10px">' +
      '<span class="pill"><b id="pm-cycles">' + (p.cycles || 0) + '</b> blocks done</span>' +
      '<span class="pill" id="pm-lens">' + c.focus + '/' + c.short + '/' + c.long + ' min</span>' +
    '</div>' +
    '<details><summary class="mini" style="cursor:pointer">Settings</summary>' +
      '<div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">' +
        '<div><label class="f">Focus</label><input type="number" id="pc-focus" value="' + c.focus + '" min="1" max="180"></div>' +
        '<div><label class="f">Short</label><input type="number" id="pc-short" value="' + c.short + '" min="1" max="60"></div>' +
        '<div><label class="f">Long</label><input type="number" id="pc-long" value="' + c.long + '" min="1" max="90"></div>' +
      '</div>' +
      '<div class="field" style="margin-top:8px"><label class="f">Long break every N blocks</label>' +
        '<input type="number" id="pc-cycle" value="' + c.cycle + '" min="2" max="12"></div>' +
      '<label class="chk"><input type="checkbox" id="pc-autolog"' + (c.autoLog ? ' checked' : '') + '> log finished blocks automatically</label>' +
      '<label class="chk"><input type="checkbox" id="pc-count"' + (c.countAsSession ? ' checked' : '') + '> count each block as 1 session</label>' +
      '<label class="chk"><input type="checkbox" id="pc-sound"' + (c.sound ? ' checked' : '') + '> chime when it ends</label>' +
      '<button class="btn sm primary" data-act="pomo-save" style="margin-top:10px">Save settings</button>' +
    '</details>';
  var sel = $('#pomo-course');
  sel.onchange = function () { pomoState().courseId = sel.value || null; dbSave(true); };
}

/* cheap per-tick update of just the changing numbers */
function pomoPaint() {
  var p = pomoState(), left = pomoLeft(), mini = $('#pomo-mini');
  if (!mini) return;
  if (!$('#pm-toggle')) pomoMountMini();
  mini.className = p.phase === 'focus' ? 'focus' : 'break';
  $('#pomo-mini .t').textContent = fmtClock(left);
  $('#pm-lbl').textContent = POMO_LABEL[p.phase];
  $('#pm-toggle').textContent = p.running ? 'Pause' : 'Start';

  var panel = $('#pomo-panel');
  if (!panel || panel.classList.contains('hidden') || !$('#pm-clock')) return;
  $('#pm-clock').textContent = fmtClock(left);
  $('#pm-phase').textContent = POMO_LABEL[p.phase];
  $('#pm-big').textContent = p.running ? 'Pause' : 'Start';
  $('#pm-cycles').textContent = p.cycles || 0;
  var arc = $('#pm-arc');
  if (arc) {
    var circ = 2 * Math.PI * (POMO_RING / 2 - 12);
    var frac = 1 - left / (pomoLen(p.phase) || 1);
    arc.setAttribute('stroke-dashoffset', (circ * (1 - clamp(frac, 0, 1))).toFixed(1));
  }
}

function pomoTick() {
  var p = pomoState();
  if (p.running && pomoLeft() <= 0) { p.running = false; p.left = 0; pomoFinish(false); return; }
  pomoPaint();
}

function pomoBoot() {
  var p = pomoState();
  if (p.running && p.endsAt && Date.now() > p.endsAt) {
    p.running = false; p.left = 0;
    pomoFinish(true);
  }
  setInterval(pomoTick, 250);
  pomoPaint();
}

ACTIONS['pomo-toggle'] = function () { var p = pomoState(); if (p.running) pomoPause(); else pomoStart(); };
ACTIONS['pomo-reset'] = function () { pomoReset(); };
ACTIONS['pomo-skip'] = function () {
  var p = pomoState();
  pomoSetPhase(p.phase === 'focus' ? ((p.cycles + 1) % (pomoCfg().cycle || 4) === 0 ? 'long' : 'short') : 'focus', false);
};
ACTIONS['pomo-panel'] = function () {
  var panel = $('#pomo-panel');
  var opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (opening) pomoMountPanel();
  pomoPaint();
};
ACTIONS['pomo-save'] = function () {
  var c = pomoCfg();
  c.focus = clamp(num($('#pc-focus').value, 25), 1, 180);
  c.short = clamp(num($('#pc-short').value, 5), 1, 60);
  c.long = clamp(num($('#pc-long').value, 15), 1, 90);
  c.cycle = clamp(num($('#pc-cycle').value, 4), 2, 12);
  c.autoLog = $('#pc-autolog').checked;
  c.countAsSession = $('#pc-count').checked;
  c.sound = $('#pc-sound').checked;
  var p = pomoState();
  if (!p.running) p.left = pomoLen(p.phase);
  dbSave(true);
  toast('Timer settings saved');
  pomoMountPanel();
  pomoPaint();
};
