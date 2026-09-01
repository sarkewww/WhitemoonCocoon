/* =========================================================
 * 白月茧响 - ui/menu.js 最小冒烟测试
 * 覆盖：纯逻辑部分（freePhaseGate/guardFreePhase 阶段判定、
 *       fmtConfidantBonus 格式化、renderConfidantHtml、
 *       buildStatusHtml 数据渲染辅助）+ init 不抛错
 * 运行：node ui/menu.smoke.js
 * ========================================================= */
'use strict';
const path = require('path');
const assert = require('assert');

// ---- Node 环境垫片：让 window.X 赋值生效 + 最小 document mock ----
global.window = global;
global.document = {
  getElementById: () => null,
  createElement: () => ({ className:'', classList:{ add(){}, remove(){} }, textContent:'', style:{}, offsetWidth:0 }),
  body: { appendChild(){}, removeChild(){} },
  addEventListener(){}, removeEventListener(){},
};
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

const MenuUI = require(path.join(__dirname, 'menu.js'));
const seen = [];
function ok(name, cond) { seen.push((cond?'PASS':'FAIL')+' '+name); assert.ok(cond, name); }
function eq(name, a, b) { seen.push((a===b?'PASS':'FAIL')+' '+name+' => '+JSON.stringify(a)); assert.strictEqual(a, b, name); }

// ---- 0) window.MenuUI 存在 ----
ok('window.MenuUI defined', typeof global.MenuUI === 'object' && typeof MenuUI === 'object');

// ---- 1) init 不抛错（空 dom/hooks + 假 document） ----
MenuUI.init({
  dom: {},
  hooks: { runScene(){}, startBattle(){}, renderMapView(){}, DialogueUI:null },
});
ok('init does not throw', true);

// ---- 2) freePhaseGate / guardFreePhase 阶段判定 ----
const PHASES = { EXPLORE:'EXPLORE', MENU:'MENU', BATTLE:'BATTLE', DIALOGUE:'DIALOGUE', ENDING:'ENDING' };
global.Game = { getPhase:()=> 'EXPLORE', PHASES };
eq('EXPLORE => ok', MenuUI.freePhaseGate(), 'ok');
eq('guardFreePhase(EXPLORE)=true', MenuUI.guardFreePhase('商店'), true);
global.Game.getPhase = () => 'MENU';
eq('MENU => ok', MenuUI.freePhaseGate(), 'ok');
global.Game.getPhase = () => 'BATTLE';
eq('BATTLE => 战斗', MenuUI.freePhaseGate(), '战斗');
eq('guardFreePhase(BATTLE)=false', MenuUI.guardFreePhase('商店'), false);
global.Game.getPhase = () => 'DIALOGUE';
eq('DIALOGUE => 对话', MenuUI.freePhaseGate(), '对话');
eq('guardFreePhase(DIALOGUE)=false', MenuUI.guardFreePhase('装备'), false);
global.Game.getPhase = () => 'ENDING';
eq('ENDING => 当前状态', MenuUI.freePhaseGate(), '当前状态');
delete global.Game;
eq('no Game => ok', MenuUI.freePhaseGate(), 'ok');
eq('guardFreePhase(no Game)=true', MenuUI.guardFreePhase('商店'), true);

// ---- 3) fmtConfidantBonus 格式化 ----
eq('null bonus', MenuUI.fmtConfidantBonus(null), '无加成');
eq('def+atk', MenuUI.fmtConfidantBonus({def:3, atk:2}), '防御+3 攻击+2');
eq('percent fields', MenuUI.fmtConfidantBonus({dmgReduction:0.25, shopDiscount:0.1}), '减伤25% 商店-10%');
eq('multi fields', MenuUI.fmtConfidantBonus({maxHp:20, spd:1, critChance:0.05, craftDiscount:0.15}), '生命+20 敏捷+1 暴击5% 合成-15%');

// ---- 4) renderConfidantHtml ----
const cb = { yuki:{rank:1}, suzu:{rank:2, def:3}, hagoromo:{rank:1} };
const trust = { yuki:10, suzu:20, hagoromo:5 };
const bondHtml = MenuUI.renderConfidantHtml({ trust }, cb);
ok('confidant contains 雪', bondHtml.indexOf('雪') >= 0);
ok('confidant contains R2 + 防御+3', bondHtml.indexOf('R2') >= 0 && bondHtml.indexOf('防御+3') >= 0);
ok('confidant contains tip', bondHtml.indexOf('下一级') >= 0);
eq('confidant empty when no cb', MenuUI.renderConfidantHtml({ trust }, null), '');

// ---- 5) buildStatusHtml 数据渲染辅助（mock 全局 Engine/Data/Battle/DayCycle/Game） ----
const state = { name:'绫音', chapter:1, level:5, money:100, hp:50, maxHp:100, sp:10, maxSp:20,
  ero:20, kills:3, weaponLevel:2, statPts:1, skills:['strike','heal'],
  inventory:[{id:'potion',count:2}], materials:{shard:3}, recipes:{potion:true},
  trust, anchor:50, day:1, phase:'day', ap:2, stats:{str:1,vit:1,spi:1,agi:1} };
global.Engine = { getState:()=>state, confidantBonus:()=>cb, formatTime:(t)=>'00:00' };
global.Data = { getRecipe:(k)=>({name:'魂愈药水', cost:{shard:1}}), getMaterial:(k)=>({name:'苍月碎片'}) };
global.Battle = { ITEMS:{potion:{name:'魂愈药水'}}, RECIPES:{}, MATERIALS:{}, getActionKey:(s)=>s };
global.DayCycle = { maxAP:()=>2 };
global.Game = { getPhase:()=> 'EXPLORE', PHASES };

const sh = MenuUI.buildStatusHtml();
for (const k of ['姓名','绫音','金币','¥100','HP','羁绊','防御+3','魂愈药水','苍月碎片',
                 '力量 +1','强化武器','商店','任务','每日活动','存档']) {
  eq('status html contains '+k, sh.indexOf(k) >= 0, true);
}

// ---- 6) fmtSavedAt 格式化（精确到秒） ----
eq('fmtSavedAt null', MenuUI.fmtSavedAt(null), '未知时间');
eq('fmtSavedAt undefined', MenuUI.fmtSavedAt(undefined), '未知时间');
eq('fmtSavedAt empty string', MenuUI.fmtSavedAt(''), '未知时间');
// 2026-09-01 08:30:45 local time (month 8 = September)
const d = new Date(2026, 8, 1, 8, 30, 45, 0);
const expected = '2026-09-01 08:30:45';
eq('fmtSavedAt Date', MenuUI.fmtSavedAt(d), expected);
eq('fmtSavedAt ms number', MenuUI.fmtSavedAt(d.getTime()), expected);
eq('fmtSavedAt ISO string', MenuUI.fmtSavedAt(d.toISOString()), expected);

// ---- 7) slotLabel / fmtSlotMeta / chapterName ----
eq('slotLabel auto', MenuUI.slotLabel('auto'), '自动');
eq('slotLabel 1', MenuUI.slotLabel(1), '槽1');
eq('slotLabel 4', MenuUI.slotLabel(4), '槽4');
eq('chapterName 0', MenuUI.chapterName(0), '序章');
eq('chapterName 1', MenuUI.chapterName(1), '第一章');
eq('chapterName 4', MenuUI.chapterName(4), '终章');
eq('chapterName 5', MenuUI.chapterName(5), '第6章');
eq('fmtSlotMeta null', MenuUI.fmtSlotMeta(null), '');
eq('fmtSlotMeta full', MenuUI.fmtSlotMeta({chapter:1,day:3}), '第一章·第3天');
eq('fmtSlotMeta no day', MenuUI.fmtSlotMeta({chapter:0}), '序章');

// ---- 8) renderSlotList 纯 HTML 渲染 ----
const saves = [
  { slot:'auto', meta:{ chapter:1, day:3, savedAt: d.getTime() } },
  { slot:1, meta:{ chapter:2, day:5, savedAt: new Date(2026,9,10,14,0,0).getTime() } },
  // slot 2,3,4 are empty
];
const slotHtml = MenuUI.renderSlotList(saves);
ok('slotHtml contains [自动]', slotHtml.indexOf('[自动]') >= 0);
ok('slotHtml contains [槽1]', slotHtml.indexOf('[槽1]') >= 0);
ok('slotHtml contains [槽2]', slotHtml.indexOf('[槽2]') >= 0);
ok('slotHtml contains 第一章·第3天', slotHtml.indexOf('第一章·第3天') >= 0);
ok('slotHtml contains 第二章·第5天', slotHtml.indexOf('第二章·第5天') >= 0);
ok('slotHtml contains 2026-09-01 08:30:45', slotHtml.indexOf('2026-09-01 08:30:45') >= 0);
ok('slotHtml contains 读取', slotHtml.indexOf('读取') >= 0);
ok('slotHtml contains 删除', slotHtml.indexOf('删除') >= 0);
ok('slotHtml contains 保存到此处', slotHtml.indexOf('保存到此处') >= 0);
ok('slotHtml contains data-slotop', slotHtml.indexOf('data-slotop') >= 0);
// auto slot has data → shows 读取, not 自动存档
ok('slotHtml auto has data => 读取', slotHtml.indexOf('读取') >= 0);
// Empty saves list → all slots show 空 + 保存到此处/自动存档
const emptySlotHtml = MenuUI.renderSlotList([]);
ok('emptySlotHtml contains 自动存档', emptySlotHtml.indexOf('自动存档') >= 0);
ok('emptySlotHtml contains 保存到此处', emptySlotHtml.indexOf('保存到此处') >= 0);
ok('emptySlotHtml contains 空', emptySlotHtml.indexOf('空') >= 0);

// ---- 9) collectDailies / buildDailyHtml ----
global.DayCycle.eventCount = () => 2;
// Mock Quests
global.Quests = {
  getAll: (S, ch) => ({
    dailies: [
      { id:'coop_yuki', name:'陪苏雪', loc:'钱潮中学', phase:'day', ap:1, reward:'羁绊+5', locId:'school' },
      { id:'rest', name:'休息', loc:'家', ap:0, reward:'恢复HP', type:'rest' },
    ]
  })
};
const items = MenuUI.collectDailies(state, 1);
eq('collectDailies count', items.length, 2);
eq('collectDailies[0].name', items[0].name, '陪苏雪');
eq('collectDailies[0].ap', items[0].ap, 1);
eq('collectDailies[0].locId', items[0].locId, 'school');
const dh = MenuUI.buildDailyHtml(state, 1);
ok('dailyHtml contains 陪苏雪', dh.indexOf('陪苏雪') >= 0);
ok('dailyHtml contains 行动点', dh.indexOf('行动点') >= 0);
ok('dailyHtml contains 今日已做 2 次', dh.indexOf('今日已做 2 次') >= 0);
ok('dailyHtml contains 去 钱潮中学', dh.indexOf('去 钱潮中学') >= 0);
ok('dailyHtml contains data-daily', dh.indexOf('data-daily') >= 0);
// Cleanup mocks
delete global.Quests;
delete global.DayCycle.eventCount;

// ---- 10) hasAnySave ----
// With no Engine mock, hasAnySave should fall back to false
eq('hasAnySave no Engine = false', MenuUI.hasAnySave(), false);
// Mock Engine.hasAnySave
global.Engine.hasAnySave = () => true;
eq('hasAnySave true', MenuUI.hasAnySave(), true);
global.Engine.hasAnySave = () => false;
eq('hasAnySave false', MenuUI.hasAnySave(), false);
delete global.Engine.hasAnySave;
// Fallback to Engine.hasAuto
global.Engine.hasAuto = () => true;
eq('hasAnySave fallback hasAuto', MenuUI.hasAnySave(), true);
global.Engine.hasAuto = () => false;
eq('hasAnySave fallback noAuto', MenuUI.hasAnySave(), false);
delete global.Engine.hasAuto;

// ---- 汇总 ----
console.log(seen.join('\n'));
const failed = seen.filter(s => s.indexOf('FAIL') === 0).length;
console.log('\n' + (failed ? ('FAILED ' + failed) : ('ALL PASS (' + seen.length + ' checks)')));
process.exit(failed ? 1 : 0);
