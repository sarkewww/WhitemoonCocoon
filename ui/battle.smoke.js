/* =========================================================
 * 白月茧响 - ui/battle.js 冒烟测试
 * 纯逻辑测试：不依赖 DOM。
 *  - getActionList 在假 Engine 下正确返回动作列表 / 技能过滤
 *  - BattleUI 导出存在（window.BattleUI 与 module.exports）
 *  - init 不抛错
 * 运行：node ui/battle.smoke.js
 * ========================================================= */
'use strict';

const assert = require('assert');
const path = require('path');

// ---- 模拟浏览器全局 window（让模块挂到 window.BattleUI）----
global.window = global;

// ---- 假 Engine（getActionList 依赖 getState / hasSkill / clamp）----
const fakeState = {
  sp: 100, maxSp: 100, ero: 30, level: 5, kills: 3,
  xp: 10, hp: 80, maxHp: 100,
  inventory: [{ id: 'hp_potion', count: 2 }],
  skills: ['strike', 'pure'],
};
global.Engine = {
  getState: () => fakeState,
  hasSkill: (id) => fakeState.skills.includes(id),
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
};

// ---- 加载被测模块 ----
const BattleUI = require(path.join(__dirname, 'battle.js'));

let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };

console.log('[1] 导出检查');
assert.ok(BattleUI, 'require 应返回模块对象');
ok('require 返回模块对象');
assert.strictEqual(typeof BattleUI.init, 'function', 'init 应存在');
ok('BattleUI.init 存在');
assert.strictEqual(typeof BattleUI.getActionList, 'function', 'getActionList 应存在');
ok('BattleUI.getActionList 存在');
assert.strictEqual(window.BattleUI, BattleUI, 'window.BattleUI 应指向同一对象');
ok('window.BattleUI === module.exports');

console.log('[2] init 不抛错（空配置）');
assert.doesNotThrow(() => BattleUI.init());
ok('init() 无参数不抛错');
assert.doesNotThrow(() => BattleUI.init({ dom: {}, hooks: {} }));
ok('init({dom:{},hooks:{}}) 不抛错');
assert.doesNotThrow(() => BattleUI.init({
  dom: { battleEl: null, arena: null },
  hooks: { runScene: () => {}, updateHUD: () => {} },
}));
ok('init 完整配置不抛错');

console.log('[3] getActionList 技能过滤');
let list = BattleUI.getActionList();
const ids = list.map(a => a.id);
assert.deepStrictEqual(ids, ['strike', 'pure', 'guard', 'heal', 'item', 'ultimate'],
  '拥有 strike/pure 时应返回对应动作序列');
ok('动作序列正确: ' + ids.join(','));

const strike = list.find(a => a.id === 'strike');
assert.strictEqual(strike.label, '苍月斩');
assert.strictEqual(strike.disable, false);
ok('strike 可释放');

const pure = list.find(a => a.id === 'pure');
assert.strictEqual(pure.disable, false, 'SP 充足时 pure 可用');
ok('pure 在 SP 充足时可用');

const ult = list.find(a => a.id === 'ultimate');
assert.strictEqual(ult.disable, true, 'combo<8 时 ultimate 禁用');
ok('ultimate 在 combo<8 时禁用');

console.log('[4] getActionList 技能不足时过滤');
fakeState.skills = ['strike'];
list = BattleUI.getActionList();
assert.deepStrictEqual(list.map(a => a.id), ['strike', 'guard', 'heal', 'item', 'ultimate'],
  '未学 pure 时不应出现 pure');
ok('未学 pure 时被过滤: ' + list.map(a => a.id).join(','));

console.log('[5] getActionList 资源门槛');
fakeState.sp = 5; fakeState.ero = 100;
fakeState.skills = ['strike', 'pure', 'erosion'];
list = BattleUI.getActionList();
const pure2 = list.find(a => a.id === 'pure');
const erosion = list.find(a => a.id === 'erosion');
const heal = list.find(a => a.id === 'heal');
assert.strictEqual(pure2.disable, true, 'SP 不足时 pure 禁用');
assert.strictEqual(erosion.disable, true, '侵蚀满时 erosion 禁用');
assert.strictEqual(heal.disable, true, 'SP 不足时 heal 禁用');
ok('SP/侵蚀门槛正确（pure/erosion/heal 均禁用）');

console.log('[6] 无 DOM 环境调用安全函数');
assert.strictEqual(BattleUI.enemyEl(), undefined, '无 DOM 时 enemyEl 返回 undefined');
assert.strictEqual(BattleUI.playerEl(), undefined, '无 DOM 时 playerEl 返回 undefined');
assert.doesNotThrow(() => BattleUI.setCombo(8));
assert.doesNotThrow(() => BattleUI.setTurnActive(() => {}));
assert.doesNotThrow(() => BattleUI.withRetryEnemy({ hp: 50, maxHp: 100 }));
assert.doesNotThrow(() => BattleUI.shakeEnemy());
assert.doesNotThrow(() => BattleUI.flashCrit());
ok('DOM 相关函数在无 DOM 下不抛错');

console.log('\n全部通过：' + passed + ' 项断言');
