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
                 '力量 +1','强化武器','商店','保存','读取']) {
  eq('status html contains '+k, sh.indexOf(k) >= 0, true);
}

// ---- 汇总 ----
console.log(seen.join('\n'));
const failed = seen.filter(s => s.indexOf('FAIL') === 0).length;
console.log('\n' + (failed ? ('FAILED ' + failed) : ('ALL PASS (' + seen.length + ' checks)')));
process.exit(failed ? 1 : 0);
