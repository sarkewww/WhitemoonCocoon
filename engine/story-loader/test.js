'use strict';
const assert = require('assert');
const StoryLoader = require('./index.js');

// 1. 最小 label + text + next
const min = StoryLoader.parse(`
label start
text:
月光洒落。

next: end
`, {});
assert.ok(min.start, 'label start 应被解析');
assert.deepStrictEqual(min.start.text, ['月光洒落。'], 'text 块应归一化');
assert.strictEqual(min.start.next, 'end', 'next 应被解析');
assert.ok(min.start.choices, '应有空 choices 数组');

// 2. choices + flag + chapter + effect + cond
const choices = StoryLoader.parse(`
label menu
choices:
1. 说真话 -> scene_a [flag=honest]
2. 说谎 -> scene_b [chapter=3]
3. 逃走 -> scene_c [effect: (s) => { s.fled = true; }]
4. 攻击 -> scene_d [cond: S.lv > 5]
`, {});
const cs = choices.menu.choices;
assert.strictEqual(cs.length, 4, '应有 4 个选项');
assert.strictEqual(cs[0].flag, 'honest');
assert.strictEqual(cs[1].chapter, 3);
assert.strictEqual(typeof cs[2].effect, 'function');
assert.strictEqual(typeof cs[3].condition, 'function');

// 3. battle + enemy 引用
const battle = StoryLoader.parse(`
label fight
battle:
  enemy: spider1
  next: win
  lose: dead
`, { spider1: { name: '蜘蛛' } });
assert.strictEqual(battle.fight.battle.enemy.name, '蜘蛛', 'enemy 应解析为敌人对象');
assert.strictEqual(battle.fight.battle.next, 'win');
assert.strictEqual(battle.fight.battle.loseScene, 'dead');

// 4. onEnter / transition / reentry
const fx = StoryLoader.parse(`
label intro
transition
reentry
onEnter: (s) => { s.hp = 100; }
text: 你好。
`, {});
assert.strictEqual(fx.intro.transition, true);
assert.strictEqual(fx.intro.reentry, true);
assert.strictEqual(typeof fx.intro.onEnter, 'function');
const state = {};
fx.intro.onEnter(state);
assert.strictEqual(state.hp, 100, 'onEnter 应可执行');

// 5. 条件文本块 ? if / ? else:
const cond = StoryLoader.parse(`
label check
? if (S) => S.flag === 'a'
    A线台词
? else:
    B线台词
next: end
`, {});
const ct = cond.check.text.find(t => t && typeof t === 'object');
assert.ok(ct, '条件文本对象应存在');
assert.strictEqual(typeof ct.cond, 'function');
assert.ok(ct.cond({ flag: 'a' }), '条件为真时执行');
assert.strictEqual(ct.text, 'A线台词');
assert.strictEqual(ct.else, 'B线台词');

// 6. window 暴露（在 Node 中不可用，直接跳过；此处仅确认模块导出对象形状）
assert.deepStrictEqual(Object.keys(StoryLoader), ['parse']);

console.log('✔ 全部 6 组断言通过');
console.log('✔ 导出形态: module.exports =', Object.keys(StoryLoader).join(', '));
