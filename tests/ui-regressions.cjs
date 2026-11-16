// Run with Node.js. The app itself still has no runtime dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const storage = new Map();
let elements = {};
const context = vm.createContext({
  console, Date, Math, URL, setTimeout() {}, clearTimeout() {},
  requestAnimationFrame() {}, cancelAnimationFrame() {},
  localStorage: {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document: {
    hidden:false, addEventListener() {},
    documentElement:{style:{setProperty(){}},getAttribute:()=> 'light'},
    querySelector: s=>elements[s]||null, querySelectorAll:()=>[]
  },
  window:{innerHeight:800,addEventListener(){},matchMedia:()=>({matches:false})}
});
function run(code) {return vm.runInContext(code,context);}
for (const file of fs.readdirSync(path.join(root,'src/js')).sort()) {
  const code=fs.readFileSync(path.join(root,'src/js',file),'utf8');
  new vm.Script(code,{filename:file});
  if (['00-core.js','05-charts.js','10-log.js','20-dashboard.js','30-classroom.js','40-calendar.js','50-resources.js','70-map.js','90-pomodoro.js'].includes(file)) run(code);
}
run("dbSave=function(){};route=function(){};toast=function(msg,ms,label,fn){LAST_TOAST={msg:msg,undo:fn};};");
run("DB=blankDB(); DB.onboarded=true; var course=newCourse({name:'Math',totalSessions:90,doneOffset:10,categories:['Algebra','Probability']});DB.courses=[course];");
assert.equal(run('DB.pomoCfg.countAsSession'),false);
assert.equal(run('course.unit'),'lectures');
assert.equal(run('courseUnits(course,1)'),'lecture');
assert.equal(run('progressOf(course).done'),10);

// Existing configuration may have counted blocks. New completions never advance syllabus progress.
run("DB.pomoCfg.countAsSession=true;DB.pomoCfg.sound=false;var timer=pomoState();timer.courseId=course.id;pomoFinish(false);");
assert.equal(run('DB.sessions.length'),1);
assert.equal(run('DB.sessions[0].count'),0);
assert.equal(run('DB.sessions[0].source'),'focus');
assert.equal(run('DB.sessions[0].minutes'),25);
assert.equal(run('progressOf(course).done'),10);
assert.equal(run('timer.receipts.length'),1);
assert.equal(run('timer.phase'),'short');
run("var firstReceipt=timer.receipts[0].id;DB.pomoCfg.autoLog=false;timer.phase='focus';pomoFinish(false);");
assert.equal(run('DB.sessions.length'),1);
assert.equal(run('timer.receipts.length'),2);
assert.equal(run('timer.receipts[1].sessionId'),null);
run('pomoDismissReceipt(firstReceipt)');
assert.equal(run('timer.receipts.length'),1);

// A save button in the fixed footer must resolve the form inside the dialog.
const fields = {
  course:{value:run('course.id')},date:{value:run('today()')},count:{value:'0'},mins:{value:'45'},note:{value:'Practice'}
};
const form={querySelector:selector=>fields[selector.match(/data-role="([^"]+)/)?.[1]]||null};
elements['#modal-box [data-logform]']=form;
elements['#modal-root']={classList:{contains:()=>false}};
run("LOGF.topics=['Algebra'];ACTIONS['log-save']({closest:function(){return null;}})");
assert.equal(run('DB.sessions.length'),2);
assert.equal(run('DB.sessions[1].count'),0);
assert.equal(run('DB.sessions[1].minutes'),45);
assert.equal(run('DB.sessions[1].topics[0]'),'Algebra');
run('LAST_TOAST.undo()');
assert.equal(run('DB.sessions.length'),1);
fields.count.value='-1';run("ACTIONS['log-save']({closest:function(){return null;}})");
assert.equal(run('DB.sessions.length'),1);
fields.count.value='1';fields.date.value='2999-01-01';run("ACTIONS['log-save']({closest:function(){return null;}})");
assert.equal(run('DB.sessions.length'),1);

storage.set(run('LOG_DRAFT_KEY'),JSON.stringify({courseId:run('course.id'),minutes:60,count:0,topics:['Probability'],note:'Draft'}));
assert.equal(run('logRestoreDraft()'),true);
assert.equal(run('LOGF.minutes'),60);
assert.equal(run('LOGF.count'),0);
storage.set(run('LOG_DRAFT_KEY'),JSON.stringify({courseId:'deleted'}));
assert.equal(run('logRestoreDraft()'),false);

// Undoing a manually recorded focus block restores its completion receipt too.
fields.count.value='0';fields.mins.value='25';fields.date.value=run('today()');
run("LOGF.receiptId=timer.receipts[0].id;ACTIONS['log-save']({closest:function(){return null;}})");
assert.equal(run('timer.receipts.length'),0);
assert.equal(run('DB.sessions[1].source'),'focus');
assert.equal(run('DB.sessions[1].count'),0);
assert.equal(run('progressOf(course).done'),10);
run('LAST_TOAST.undo()');
assert.equal(run('DB.sessions.length'),1);
assert.equal(run('timer.receipts.length'),1);

const calendar=run("monthGridHTML('2026-11',{})");
assert.equal((calendar.match(/data-act="cal-day"/g)||[]).length,30);
assert.equal((calendar.match(/class="dow"/g)||[]).length,7);
assert.equal((calendar.match(/<button/g)||[]).length,(calendar.match(/<\/button>/g)||[]).length);
assert.ok(calendar.includes('aria-label="Sun 1 Nov 2026'));

elements={};
run("MAP.courseId=course.id;mapBuild();");
assert.equal(run('MAP.nodes.length'),3);
assert.equal(run('MAP.nodes.every(function(n){return n.courseId===course.id;})'),true);
run("DB.sessions[0].topics=['Probability'];mapBuild();");
assert.equal(run("MAP.nodes.find(function(n){return n.topic==='Probability';}).count"),1);
assert.equal(run("topicStats().nodes[course.id+'::Probability'].count"),0);
run("var page={innerHTML:''};renderDashboard(page);");
assert.ok(run('page.innerHTML').indexOf('Continue studying') < run('page.innerHTML').indexOf('Today’s activity'));
assert.equal((run('page.innerHTML').match(/class="chart"/g)||[]).length,1);
assert.ok(!run('page.innerHTML').includes('data-logform'));
console.log('Passed: timer accounting, completion receipts, footer saves, Undo, validation, drafts, calendar controls, map filtering, Home hierarchy, and syntax for all scripts.');
