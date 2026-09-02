/* =========================================================
 * 白月茧响 - core/quests.js 最小冒烟测试
 * 覆盖：getQuestState（mainline/side/daily 三态）、
 *       getDeadlineStates（倒计时/超期/未登记）、
 *       getAll 返回结构。
 * 纯逻辑测试：注入 window.QuestConfig/GameConfig/Events/DayCycle，
 * 不触碰 DOM。
 * 运行：node core/quests.smoke.js
 * ========================================================= */
'use strict';
const path = require('path');
const assert = require('assert');

// ---- Node 环境垫片：window.X 赋值生效 + 最小 document mock ----
global.window = global;
global.document = {
  getElementById: () => null,
  createElement: () => ({ className:'', classList:{ add(){}, remove(){} }, textContent:'', style:{} }),
  body: { appendChild(){}, removeChild(){} },
  addEventListener(){}, removeEventListener(){},
};

// ---- 注入任务配置（结构与 config/quest-config.js 一致） ----
global.QuestConfig = {
  quests: {
    1: [
      { id:'ml1', type:'mainline', name:'主线·第一幕', progress:{ steps:['chapter1_4','chapter1_8','chapter1_12'] } },
      { id:'d1_snow', type:'side', name:'天台的保温盒', loc:'school', when:'day', complete:{ flag:'d1_snow_done' } },
      { id:'d1_suzu', type:'side', name:'空蝉旧舍的巡逻', loc:'old_building', when:'night', complete:{ flag:'d1_suzu_done' } },
    ],
  },
  dailies: [
    { id:'act_coop_yuki', name:'陪雪去天台', loc:'school', when:'day', target:1 },
    { id:'act_relax_moon', name:'月下休憩', loc:'school', when:'night', target:1 },
  ],
  deadlines: {
    1: [
      { id:'dl1_nest', chapter:1, name:'母巢孵化', desc:'母巢正在孵化。', bossId:'mother1', loc:'construction', dueDays:7, failScene:'fail_mother' },
    ],
  },
};
global.GameConfig = { mainlineSteps: { 1: ['chapter1_4','chapter1_8','chapter1_12'] } };

// ---- Events.checkCondition（支线 unlock 判定）----
let unlockOk = false;
global.Events = { checkCondition: () => unlockOk };

// ---- DayCycle.eventCount（每日活动计次）----
let dailyCount = 0;
global.DayCycle = { eventCount: () => dailyCount };

const Quests = require(path.join(__dirname, 'quests.js'));
const seen = [];
function ok(name, cond) { seen.push((cond?'PASS':'FAIL')+' '+name); assert.ok(cond, name); }
function eq(name, a, b) { seen.push((a===b?'PASS':'FAIL')+' '+name+' => '+JSON.stringify(a)); assert.strictEqual(a, b, name); }

// 基准存档（chapter=1，主线已推进到 chapter1_4，已做 2 天）
const S = {
  chapter: 1,
  mainline: { 1: 'chapter1_4' },
  dayCounters: { 1: 2 },
  flags: { d1_snow_done: true },   // d1_snow 已完成
  eventCounts: { act_coop_yuki: { day: 1, count: 1 } },
  deadlines: { dl1_nest: { chapter: 1, startDay: 3, dueDays: 7, bossId: 'mother1', loc: 'construction', done: false } },
  day: 1,
};

// ---- 0) 模块存在 ----
ok('window.Quests defined', typeof global.Quests === 'object' && typeof Quests === 'object');

// ---- 1) getQuestState · mainline ----
const ml1 = global.QuestConfig.quests[1][0];
// S.mainline={1:'chapter1_4'} → steps idx=0 → requireDays=2, current=2 → done-ish need=0
let st = Quests.getQuestState(S, ml1, 1);
eq('mainline mid status active', st.status, 'active');
eq('mainline mid need (2-2)', st.need, 0);
eq('mainline mid requireDays', st.requireDays, 2);
eq('mainline mid completedIdx', st.completedIdx, 0);
// 未开始：mainline={} → idx=-1 → requireDays=1, current=2 → need=0
const S0 = Object.assign({}, S, { mainline: { 1: '' } });
st = Quests.getQuestState(S0, ml1, 1);
eq('mainline notStarted status', st.status, 'active');
eq('mainline notStarted requireDays', st.requireDays, 1);
eq('mainline notStarted completedIdx', st.completedIdx, -1);
// 推进到最后断点 → done
const SDone = Object.assign({}, S, { mainline: { 1: 'chapter1_12' } });
st = Quests.getQuestState(SDone, ml1, 1);
eq('mainline atLastStep status done', st.status, 'done');
// 缺省 chapter 从 S.chapter 取
st = Quests.getQuestState(S, ml1);
eq('mainline default chapter from S', st.completedIdx, 0);

// ---- 2) getQuestState · side ----
const d1_snow = global.QuestConfig.quests[1][1]; // flag 已置 → done
st = Quests.getQuestState(S, d1_snow, 1);
eq('side flag set => done', st.status, 'done');
const d1_suzu = global.QuestConfig.quests[1][2]; // flag 未置、无 unlock → active
st = Quests.getQuestState(S, d1_suzu, 1);
eq('side no flag no unlock => active', st.status, 'active');
// 带 unlock 且条件不满足 → locked
const sideLocked = { id:'x', type:'side', name:'解锁支线', complete:{ flag:'x_done' }, unlock:{ cond:'x' } };
unlockOk = false;
st = Quests.getQuestState(S, sideLocked, 1);
eq('side unlock fail => locked', st.status, 'locked');
eq('side locked need', st.need, 1);
// 带 unlock 且条件满足 → active
unlockOk = true;
st = Quests.getQuestState(S, sideLocked, 1);
eq('side unlock pass => active', st.status, 'active');

// ---- 3) getQuestState · daily ----
// dailies from config have no type field; must add it for direct getQuestState calls
const dDaily = Object.assign({ type:'daily' }, global.QuestConfig.dailies[0]); // act_coop_yuki target=1
dailyCount = 0;
st = Quests.getQuestState(S, dDaily, 1);
eq('daily count<target => active', st.status, 'active');
eq('daily need (1-0)', st.need, 1);
eq('daily count', st.count, 0);
dailyCount = 1;
st = Quests.getQuestState(S, dDaily, 1);
eq('daily count>=target => done', st.status, 'done');
eq('daily need 0', st.need, 0);
// 兜底路径（无 DayCycle.eventCount 时读 S.eventCounts）
delete global.DayCycle.eventCount;
st = Quests.getQuestState(S, dDaily, 1); // S.eventCounts 含当日 → count=1 → done
eq('daily fallback S.eventCounts done', st.status, 'done');
st = Quests.getQuestState(Object.assign({}, S, { eventCounts: {} }), dDaily, 1);
eq('daily fallback no record => active', st.status, 'active');
global.DayCycle.eventCount = () => dailyCount;

// ---- 4) getDeadlineStates ----
let dls = Quests.getDeadlineStates(S);
eq('deadlines length 1', dls.length, 1);
const dl = dls[0];
eq('deadline id', dl.id, 'dl1_nest');
eq('deadline name', dl.name, '母巢孵化');
eq('deadline boss', dl.boss, 'mother1');
eq('deadline startDay', dl.startDay, 3);
eq('deadline dueDay (3+7)', dl.dueDay, 10);
// currentDay = dayCounters[1] = 2 → remain=8, done=false
eq('deadline remain (10-2)', dl.remain, 8);
eq('deadline not done', dl.done, false);
// 超期：dayCounters 超过 dueDay → remain=0, done=true
const SOver = Object.assign({}, S, { dayCounters: { 1: 12 } });
dl.done = null;
const dlsOver = Quests.getDeadlineStates(SOver);
eq('deadline overdue remain 0', dlsOver[0].remain, 0);
eq('deadline overdue done', dlsOver[0].done, true);
// 未登记（S.deadlines 无该任务）→ 跳过
const SNoRec = Object.assign({}, S, { deadlines: {} });
eq('deadline unregistered length 0', Quests.getDeadlineStates(SNoRec).length, 0);
// 无 S.deadlines → []
eq('deadline no S.deadlines => []', Quests.getDeadlineStates({ chapter:1 }).length, 0);

// ---- 5) getAll 结构 ----
dailyCount = 0;
const all = Quests.getAll(S, 1);
ok('getAll has mainline array', Array.isArray(all.mainline));
ok('getAll has sides array', Array.isArray(all.sides));
ok('getAll has dailies array', Array.isArray(all.dailies));
ok('getAll has deadlines array', Array.isArray(all.deadlines));
eq('getAll mainline length', all.mainline.length, 1);
eq('getAll mainline[0].id', all.mainline[0].id, 'ml1');
eq('getAll mainline[0].status', all.mainline[0].status, 'active');
eq('getAll sides length', all.sides.length, 2);
eq('getAll sides[0].status done (flag)', all.sides[0].status, 'done');
eq('getAll sides[1].status active', all.sides[1].status, 'active');
eq('getAll dailies length', all.dailies.length, 2);
eq('getAll dailies[0].type daily', all.dailies[0].type, 'daily');
eq('getAll dailies[0].status active', all.dailies[0].status, 'active');
eq('getAll deadlines length', all.deadlines.length, 1);
eq('getAll deadlines[0].id', all.deadlines[0].id, 'dl1_nest');

// ---- 汇总 ----
console.log(seen.join('\n'));
const failed = seen.filter(s => s.indexOf('FAIL') === 0).length;
console.log('\n' + (failed ? ('FAILED ' + failed) : ('ALL PASS (' + seen.length + ' checks)')));
process.exit(failed ? 1 : 0);
