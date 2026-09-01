/* =========================================================
 * 白月茧响 - core/quests.js + ui/quest.js 冒烟测试（node）
 * 运行：node quests.smoke.js
 * 覆盖：
 *  1. QuestConfig / Quests / QuestUI 导出
 *  2. getQuestList 按章节取任务
 *  3. getQuestState：主线进度 / 支线 flag / 每日 eventCount
 *  4. getDeadlineStates：remain 计算 + 防御（无 S.deadlines 返回 []）
 *  5. getAll 汇总四类
 *  6. QuestUI.renderQuestHtml / 子渲染器 输出关键片段
 * ========================================================= */
'use strict';

const path = require('path');
let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); process.exit(1); }
  passed++;
  console.log('  ✓ ' + msg);
}

// ---- Node 垫片 ----
global.window = global;
global.document = {
  createElement: () => ({
    className: '', classList: { add() {}, remove() {} }, textContent: '', style: {},
    offsetWidth: 0, appendChild() {}, querySelectorAll: () => [], addEventListener() {},
  }),
  body: { appendChild() {}, removeChild() {} },
  addEventListener() {}, removeEventListener() {},
};

// 加载模块
const QuestConfig = require(path.join(__dirname, 'config', 'quest-config.js'));
const Quests = require(path.join(__dirname, 'core', 'quests.js'));
const QuestUI = require(path.join(__dirname, 'ui', 'quest.js'));

console.log('== 1. 导出 ==');
assert(typeof QuestConfig === 'object', 'window.QuestConfig 存在');
assert(typeof QuestConfig.quests === 'object' && QuestConfig.quests[1], 'quests[1] 存在');
assert(Array.isArray(QuestConfig.dailies) && QuestConfig.dailies.length >= 5, 'dailies 有 5+ 项');
assert(typeof QuestConfig.deadlines === 'object' && !Array.isArray(QuestConfig.deadlines) && Object.keys(QuestConfig.deadlines).length >= 3, 'deadlines 有 3+ 章');
assert(typeof Quests.getAll === 'function', 'Quests.getAll');
assert(typeof Quests.getQuestState === 'function', 'Quests.getQuestState');
assert(typeof Quests.getDeadlineStates === 'function', 'Quests.getDeadlineStates');
assert(typeof QuestUI.renderQuestHtml === 'function', 'QuestUI.renderQuestHtml');
assert(typeof QuestUI.showQuestPanel === 'function', 'QuestUI.showQuestPanel');

console.log('== 2. 每日活动 / 死任务配置结构 ==');
// dailies 各项需有 id/loc/when/target
for (const d of QuestConfig.dailies) {
  assert(d.id && d.loc && d.when && d.target >= 1,
    'daily ' + d.id + ' 结构完整（id/loc/when/target）');
}
// deadlines 各项需有 chapter/name/bossId/loc/dueDays
for (const ch of Object.keys(QuestConfig.deadlines)) {
  for (const dl of QuestConfig.deadlines[ch]) {
    assert(dl.chapter >= 1 && dl.name && dl.bossId && dl.loc && dl.dueDays >= 1,
      'deadline ' + dl.id + ' 结构完整（chapter/name/bossId/loc/dueDays）');
  }
}

console.log('== 3. getQuestList ==');
assert(Quests.getQuestList(1).length >= 5, '第1章任务数 >= 5（主线+支线）');
assert(Quests.getQuestList(2).length >= 4, '第2章任务数 >= 4');
assert(Quests.getQuestList(3).length >= 6, '第3章任务数 >= 6');
assert(Quests.getQuestList(99).length === 0, '未知章节返回空数组');

console.log('== 4. getQuestState：主线进度 ==');
// 未开始
{
  const S = { chapter: 1, mainline: {}, dayCounters: { 1: 0 }, flags: {}, eventCounts: {} };
  const q = Quests.getQuestList(1).find(x => x.type === 'mainline');
  const st = Quests.getQuestState(S, q, 1);
  assert(st.status === 'active', '主线未开始 => active');
  assert(st.need === 1, '主线未开始 need=1（需 1 天）');
}
// 已推进到第一步断点 chapter1_4
{
  const S = { chapter: 1, mainline: { 1: 'chapter1_4' }, dayCounters: { 1: 1 }, flags: {}, eventCounts: {} };
  const q = Quests.getQuestList(1).find(x => x.type === 'mainline');
  const st = Quests.getQuestState(S, q, 1);
  assert(st.status === 'active', '主线推进到 chapter1_4 => active');
  assert(st.need === 1, 'chapter1_4 后 need=1（requireDays=2，当前1天）');
}
// 推进到最后一步断点 => done
{
  const S = { chapter: 1, mainline: { 1: 'chapter1_12' }, dayCounters: { 1: 3 }, flags: {}, eventCounts: {} };
  const q = Quests.getQuestList(1).find(x => x.type === 'mainline');
  const st = Quests.getQuestState(S, q, 1);
  assert(st.status === 'done', '主线推进到 chapter1_12 => done');
}

console.log('== 5. getQuestState：支线 flag ==');
{
  const S = { chapter: 1, flags: {}, eventCounts: {} };
  const q = Quests.getQuestList(1).find(x => x.id === 'd1_snow');
  assert(Quests.getQuestState(S, q, 1).status === 'active', 'd1_snow 未完成 => active');
  S.flags['d1_snow_done'] = true;
  assert(Quests.getQuestState(S, q, 1).status === 'done', 'd1_snow flag 置位 => done');
}

console.log('== 6. getQuestState：每日活动 eventCount ==');
// 用假 DayCycle 桩验证防御 + 计数
const realDayCycle = global.DayCycle;
global.DayCycle = {
  eventCount: (S, id) => {
    const rec = S.eventCounts && S.eventCounts[id];
    return rec && rec.day === S.day ? rec.count : 0;
  },
};
{
  const d = QuestConfig.dailies.find(x => x.id === 'act_coop_yuki');
  const S = { chapter: 1, day: 3, flags: {}, eventCounts: { act_coop_yuki: { day: 3, count: 1 } } };
  const dq = Object.assign({ type: 'daily' }, d);
  const st = Quests.getQuestState(S, dq, 1);
  assert(st.status === 'done' && st.count === 1 && st.target === 1, 'act_coop_yuki 当日1次 => done 1/1');
  S.eventCounts = {}; // 无记录
  const st2 = Quests.getQuestState(S, Object.assign({ type: 'daily' }, d), 1);
  assert(st2.status === 'active' && st2.count === 0, 'act_coop_yuki 无记录 => active 0/1');
}
// 无 DayCycle 时防御（返回 0）
{
  global.DayCycle = undefined;
  const d = QuestConfig.dailies.find(x => x.id === 'act_job_shop');
  const S = { chapter: 1, day: 3, flags: {}, eventCounts: {} };
  const st = Quests.getQuestState(S, Object.assign({ type: 'daily' }, d), 1);
  assert(st.count === 0 && st.status === 'active', '无 DayCycle 时 eventCount 防御返回 0');
}
global.DayCycle = realDayCycle;

console.log('== 7. getDeadlineStates：remain 计算 + 防御 ==');
{
  // 无 S.deadlines 防御
  assert(Quests.getDeadlineStates({ chapter: 1 }).length === 0, '无 S.deadlines 返回 []');
  assert(Quests.getDeadlineStates(null).length === 0, 'S 为 null 返回 []');
  // 第一章 dl1_nest：startDay=2, dueDays=7 => dueDay=9, 当前 dayCounters=5 => remain=4
  const S = {
    chapter: 1,
    deadlines: { dl1_nest: { chapter: 1, startDay: 2, dueDays: 7, done: false } },
    dayCounters: { 1: 5 },
    flags: {}, eventCounts: {},
  };
  const list = Quests.getDeadlineStates(S);
  assert(list.length === 1, '有 1 个激活死任务');
  assert(list[0].id === 'dl1_nest' && list[0].dueDay === 9 && list[0].remain === 4, 'dl1_nest dueDay=9 remain=4');
  assert(list[0].done === false, 'dl1_nest remain>0 => 未完成');
  // 超期 => done + remain=0
  S.dayCounters[1] = 20;
  const list2 = Quests.getDeadlineStates(S);
  assert(list2[0].remain === 0 && list2[0].done === true, '超期 remain=0 done=true');
  // 其他死任务未在 S.deadlines 中登记（未激活）=> 不列出
  S.dayCounters[1] = 5;
  delete S.deadlines.dl1_nest;   // 从激活表移除
  S.deadlines.dl2_cocoon = { chapter: 2, startDay: 0, dueDays: 10, done: false };
  const list3 = Quests.getDeadlineStates(S);
  assert(list3.length === 1 && list3[0].id === 'dl2_cocoon', '仅在激活表中登记的死任务被列出（dl2_cocoon）');
  delete S.deadlines.dl2_cocoon;
  const list4 = Quests.getDeadlineStates(S);
  assert(list4.length === 0, '无任何登记 => 空列表');
}

console.log('== 8. getAll 汇总 ==');
{
  const S = {
    chapter: 1,
    mainline: {},
    dayCounters: { 1: 0 },
    flags: { d1_snow_done: true },
    eventCounts: { act_coop_yuki: { day: 1, count: 1 } },
    day: 1,
    deadlines: { dl1_nest: { chapter: 1, startDay: 1, dueDays: 7, done: false } },
  };
  const all = Quests.getAll(S, 1);
  assert(Array.isArray(all.mainline) && all.mainline.length >= 1, 'getAll.mainline 非空');
  assert(all.mainline[0].status === 'active', 'mainline 状态 active');
  assert(Array.isArray(all.sides) && all.sides.length >= 4, 'getAll.sides 非空');
  const snow = all.sides.find(x => x.id === 'd1_snow');
  assert(snow && snow.status === 'done', 'd1_snow done 进入 sides');
  assert(Array.isArray(all.dailies) && all.dailies.length >= 5, 'getAll.dailies 非空');
  const yuki = all.dailies.find(x => x.id === 'act_coop_yuki');
  assert(yuki && yuki.status === 'done' && yuki.count === 1, 'daily act_coop_yuki done 1/1');
  assert(Array.isArray(all.deadlines) && all.deadlines.length === 1, 'getAll.deadlines 含激活项');
  assert(all.deadlines[0].remain === 8, 'dl1_nest remain=8（start1+7-0=8）');
}

console.log('== 9. QuestUI.renderQuestHtml / 子渲染器 ==');
{
  const S = {
    chapter: 1,
    mainline: {},
    dayCounters: { 1: 0 },
    flags: {},
    eventCounts: { act_coop_yuki: { day: 1, count: 1 } },
    day: 1,
    deadlines: { dl1_nest: { chapter: 1, startDay: 1, dueDays: 7, done: false } },
  };
  // mock World 供 locName
  global.World = { getLocation: (ch, id) => ({ id, name: '钱潮中学' }) };
  const html = QuestUI.renderQuestHtml(S, 1);
  assert(html.indexOf('── 主线 ──') !== -1, '含主线区标题');
  assert(html.indexOf('── 支线 ──') !== -1, '含支线区标题');
  assert(html.indexOf('── 每日活动 ──') !== -1, '含每日活动区标题');
  assert(html.indexOf('── 死任务 ──') !== -1, '含死任务区标题');
  assert(html.indexOf('天台的保温盒') !== -1, '支线名渲染');
  assert(html.indexOf('钱潮中学') !== -1, '地点名渲染（去 钱潮中学）');
  assert(html.indexOf('去 钱潮中学 · 白天') !== -1, '支线标位置格式');
  assert(html.indexOf('⚠ 距母巢孵化还有') !== -1 || html.indexOf('距母巢孵化还有') !== -1, '死任务倒计时文案');
  assert(html.indexOf('qd-urgent') === -1, 'remain>2 不闪红');
  // ≤2 天闪红
  S.deadlines.dl1_nest = { chapter: 1, startDay: 1, dueDays: 7, done: false };
  S.dayCounters[1] = 6; // remain = (1+7)-6 = 2
  const htmlUrgent = QuestUI.renderQuestHtml(S, 1);
  assert(htmlUrgent.indexOf('qd-urgent') !== -1, 'remain=2 触发闪红 qd-urgent');
  // 子渲染器独立调用
  const sec = QuestUI.renderDeadlinesHtml(Quests.getDeadlineStates(S));
  assert(sec.indexOf('qd-urgent') !== -1, 'renderDeadlinesHtml 独立调用闪红');
  assert(QuestUI.whenName('night') === '夜晚', 'whenName night');
}

console.log('\n全部通过：' + passed + ' 项断言');