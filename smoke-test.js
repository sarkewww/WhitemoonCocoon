// 冒烟测试：验证引擎核心逻辑（无 DOM 环境下）
const fs = require('fs');
const path = require('path');

// 简易 localStorage 模拟
const store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k,v) => { store[k]=String(v); },
  removeItem: k => { delete store[k]; },
};

// 载入 engine.js（它定义全局 Engine）
const code = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
// eval 时 const/let 不会泄漏，改用间接 eval 赋值
const getEngine = new Function(code + '\n return Engine;');
const Engine = getEngine();

// 测试
const results = [];
const asyncTests = [];
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      asyncTests.push(r.then(() => { results.push(['PASS', name]); })
        .catch(e => { results.push(['FAIL', name, e.message]); }));
    } else {
      results.push(['PASS', name]);
    }
  }
  catch(e) { results.push(['FAIL', name, e.message]); }
}

t('newGame 初始化', () => {
  const s = Engine.newGame();
  if (s.scene !== 'prologue_0') throw new Error('scene wrong: '+s.scene);
  if (s.maxHp !== 112) throw new Error('maxHp wrong: '+s.maxHp);
  if (s.name !== '绫音') throw new Error('name wrong');
});

t('存档/读档 往返', () => {
  const s = Engine.newGame();
  s.flags.test = true; s.vars.a = 42;
  Engine.setState(s);
  Engine.saveSlot();
  const s2 = Engine.newGame();
  Engine.setState(s2);
  const ok = Engine.loadSlot();
  if (!ok) throw new Error('load failed');
  if (!Engine.flag('test')) throw new Error('flag lost');
  if (Engine.getVar('a') !== 42) throw new Error('var lost');
});

t('setStat 边界限制', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.setStat('hp', 9999);
  if (s.hp !== s.maxHp) throw new Error('hp should clamp to max');
  Engine.setStat('hp', -5);
  if (s.hp !== 0) throw new Error('hp should clamp to 0');
  Engine.setStat('ero', 150);
  if (s.ero !== 100) throw new Error('ero clamp');
});

t('技能学习去重', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.learnSkill('strike');
  if (s.skills.length !== 1) throw new Error('dup skill added');
});

t('formatTime', () => {
  if (Engine.formatTime(3661) !== '61:01') throw new Error('fmt wrong: '+Engine.formatTime(3661));
});

// 载入 story 链（story.js 壳 + enemies + story-data 批量注册）
const storyCode = fs.readFileSync(path.join(__dirname, 'story.js'), 'utf8');
global.Engine = Engine;
global.window = global;
const getStory = new Function(storyCode + '\n return Story;');
const Story = getStory();
global.Story = Story;

// 载入 enemies.js（供 battle 数据）
const enemiesCode = fs.readFileSync(path.join(__dirname, 'enemies.js'), 'utf8');
new Function(enemiesCode)(global);

// 载入 story-data.js（触发 Story.loadData 注册全部场景）
global.App = {};
const dataCode = fs.readFileSync(path.join(__dirname, 'story-data.js'), 'utf8');
new Function(dataCode)();

t('Story.get 存在', () => {
  if (typeof Story.get !== 'function') throw new Error('Story.get missing');
});

t('所有场景 next 引用有效', () => {
  const seen = new Set(['prologue_1']);
  const stack = ['prologue_1'];
  let checked = 0;
  while (stack.length) {
    const id = stack.pop();
    if (id.startsWith('@')) continue; // @map 等原语不是场景 id
    const sc = Story.get(id);
    if (!sc) throw new Error('missing scene: '+id);
    if (sc.next && !seen.has(sc.next)) { seen.add(sc.next); stack.push(sc.next); }
    if (sc.choices) {
      for (const c of sc.choices) {
        if (c.next && !seen.has(c.next)) { seen.add(c.next); stack.push(c.next); }
      }
    }
    if (sc.battle) {
      if (sc.battle.next && !seen.has(sc.battle.next)) { seen.add(sc.battle.next); stack.push(sc.battle.next); }
      if (sc.battle.loseScene && !seen.has(sc.battle.loseScene)) { seen.add(sc.battle.loseScene); stack.push(sc.battle.loseScene); }
    }
    checked++;
    if (checked > 200) break;
  }
  // 检查几个已知场景可达
  for (const must of ['chapter1_1','chapter1_battle1','chapter2_1','chapter3_1','ending_eternity','ending_freedom','ending_reverie','end_roll']) {
    if (!Story.get(must)) throw new Error('expected scene missing: '+must);
  }
});

t('结局场景 choices 逻辑', () => {
  // 动态结局 getter 已从 chapter3_8 移到 chapter3_9（修复跳过 #1 叙事的 bug）
  const ch3 = Story.get('chapter3_9');
  const state = Engine.newGame();
  state.ero = 40;
  state.trust = { yuki: 70, suzu: 70, hagoromo: 70 };
  Engine.setState(state);
  const choices = ch3.choices;
  if (choices.length !== 7) throw new Error('隐藏结局未出现，len='+choices.length);
  state.ero = 80;
  const choices2 = ch3.choices;
  if (choices2.length !== 6) throw new Error('侵蚀高时应无隐藏结局，len='+choices2.length);
});

// 统计场景数量
t('场景数量统计', () => {
  // 通过可达遍历计数
  const seen = new Set();
  const stack = ['prologue_1'];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const sc = Story.get(id);
    if (!sc) continue;
    if (sc.next) stack.push(sc.next);
    if (sc.choices) for (const c of sc.choices) if (c.next) stack.push(c.next);
    if (sc.battle) { if (sc.battle.next) stack.push(sc.battle.next); if (sc.battle.loseScene) stack.push(sc.battle.loseScene); }
    if (seen.size > 200) break;
  }
  console.log('  可达场景数: ' + seen.size);
});

// ============================================================================
// 追加块：RPG 核心模块（core/world.js / core/daycycle.js / core/game.js）
// 加载链依赖本文件顶部的 global.localStorage / Engine / Story 已就绪。
// 只追加，不动既有测试。
// ============================================================================

// 载入 core 模块（IIFE，导出 window.X + module.exports）
// 先载 world-data.js（设置 window.WorldData，供 world.js 自动注册地图）
require(path.join(__dirname, 'core', 'world-data.js'));

const World = require(path.join(__dirname, 'core', 'world.js'));
global.World = World;
const DayCycle = require(path.join(__dirname, 'core', 'daycycle.js'));
global.DayCycle = DayCycle;
const Game = require(path.join(__dirname, 'core', 'game.js')); // 闭包引用全局 Engine/World/DayCycle
global.Game = Game;

// 注册空视图回调（Game 只做纯逻辑验证，不调用 view 业务）
Game.register({
  renderMap: () => {}, runStory: () => Promise.resolve(), runBattle: () => Promise.resolve(),
  showHud: () => {}, log: () => {},
});

// 确定性测试地图：每地点仅 1 个事件，候选池唯一
World.defineMap(100, [
  { id: 's_a', name: 'SA', conns: ['s_b'], events: [{ id: 'ev_any', scene: 'sc_any', when: 'any', once: true }] },
  { id: 's_b', name: 'SB', conns: ['s_a'], events: [] },
]);

t('core.World defineMap/getReachable', () => {
  if (World.getMap(100).length !== 2) throw new Error('地图长度错误');
  const ids = World.getReachable(100, 's_a').map(l => l.id);
  if (ids.join(',') !== 's_b') throw new Error('相邻错误: '+ids.join(','));
});

t('core.World rollEvent once 过滤', () => {
  const st = Engine.newGame();
  st.doneScenes = {}; st.day = 1; st.phase = 'day'; st.ap = 2;
  const ev = World.rollEvent(100, 's_a', 'day', st);
  if (!ev || ev.scene !== 'sc_any') throw new Error('应抽到 sc_any');
  st.doneScenes['sc_any'] = true;
  if (World.rollEvent(100, 's_a', 'day', st) !== null) throw new Error('once 已做不应再抽到');
});

t('core.DayCycle ensure 默认值', () => {
  const S = {};
  DayCycle.ensure(S);
  if (S.day !== 1 || S.phase !== 'day' || S.ap !== 2) throw new Error('默认字段错误');
});

t('core.DayCycle advance/spend', () => {
  const S = { day: 1, phase: 'day', ap: 2, dayCounters: {} };
  const r1 = DayCycle.advance(S);
  if (r1.to !== 'night' || S.ap !== 1) throw new Error('day->night 错误');
  if (!DayCycle.spend(S, 'fight')) throw new Error('夜晚应能花费');
  const r2 = DayCycle.advance(S);
  if (r2.to !== 'day' || S.day !== 2 || S.ap !== 2) throw new Error('night->day 错误');
});

t('core.Game explore/moveTo 纯逻辑', () => {
  const S = Engine.newGame();
  S.doneScenes = {}; S.day = 1; S.phase = 'day'; S.ap = 2; S.dayCounters = {};
  Engine.setState(S);
  Game.explore(100, 's_a');
  if (Game.getChapter() !== 100 || Game.getCurrentLoc() !== 's_a') throw new Error('explore 初始化错误');
  Game.moveTo('s_b');
  if (Game.getCurrentLoc() !== 's_b') throw new Error('moveTo 相邻移动失败');
});

// ============================================================================
// 追加块：Data + Events 模块加载测试
// 加载链：engine -> story -> enemies -> story-data
//         -> core/world -> core/daycycle -> core/game -> core/data -> core/events
// ============================================================================

// 加载 core/data.js（IIFE，导出 window.Data + module.exports，此处用 new Function 取闭包值）
const dataSrc = fs.readFileSync(path.join(__dirname, 'core', 'data.js'), 'utf8');
const Data = new Function(dataSrc + '\n return Data;')();
global.Data = Data;

// 加载 core/events.js
const eventsSrc = fs.readFileSync(path.join(__dirname, 'core', 'events.js'), 'utf8');
const Events = new Function(eventsSrc + '\n return Events;')();
global.Events = Events;

// mock window.ENEMIES（Data.getEnemy 引用该全局）
global.ENEMIES = require(path.join(__dirname, 'enemies.js')).ENEMIES;

t('core.Data getItem/getMaterial/getRecipe', () => {
  const pot = Data.getItem('potion');
  if (!pot || pot.name !== '魂愈药水') throw new Error('potion 查询失败');
  const mat = Data.getMaterial('dark_crystal');
  if (!mat || mat.name !== '暗蚀结晶') throw new Error('dark_crystal 查询失败');
  const rcp = Data.getRecipe('r_potion');
  if (!rcp || !rcp.cost || rcp.out.id !== 'potion') throw new Error('r_potion 查询失败');
  if (Data.getItem('nope') !== null) throw new Error('不存在物品应返回 null');
});

t('core.Data getSkill/getEnemy', () => {
  const sk = Data.getSkill('strike');
  if (!sk || sk.name !== '苍月斩' || sk.mult !== 1.0) throw new Error('strike 查询失败');
  const en = Data.getEnemy('spider1');
  if (!en || en.id !== 'spider1' || en.name !== '织网之魔') throw new Error('spider1 应引用 ENEMIES');
  if (en !== global.ENEMIES.spider1) throw new Error('应返回同一引用');
});

t('core.Data getDistrict 从 World 读取区域', () => {
  // World.getDistricts 已由 core/world.js 提供；无 district 地图时 getDistrict 返回 null
  const d = Data.getDistrict(100, 'some_district'); // smoke 章节100 地图无 district
  if (d !== null) throw new Error('无 district 应返回 null');
});

t('core.Events checkCondition 基础条件', () => {
  const S = { flags: { ok: true }, vars: { n: 3 }, trust: { a: 2 }, ero: 20, anchor: 55, inventory: [] };
  if (!Events.checkCondition({ flag: 'ok' }, S)) throw new Error('flag=true 应通过');
  if (!Events.checkCondition({ noFlag: 'x' }, S)) throw new Error('noFlag 应通过');
  if (!Events.checkCondition({ var: 'n', value: 3 }, S)) throw new Error('var 应通过');
  if (!Events.checkCondition({ trust: 'a', value: 2 }, S)) throw new Error('trust 应通过');
  if (!Events.checkCondition({ ero: 20 }, S)) throw new Error('ero 应通过');
  if (!Events.checkCondition({ anchor: 55 }, S)) throw new Error('anchor 应通过');
  if (!Events.checkCondition(null, S)) throw new Error('null 条件应通过');
});

t('core.Events worldEventToCommands 转换', () => {
  const cmds = Events.worldEventToCommands({ scene: 's1', enemy: 'spider1', next: 'n1', lose: 'l1' });
  if (cmds.length !== 2 || cmds[0].type !== Events.CMD.DIALOGUE || cmds[1].type !== Events.CMD.BATTLE) {
    throw new Error('转换命令错误');
  }
});

t('core.Events registerCommon + CALL 执行', () => {
  Events.registerCommon('smoke_common', [
    { type: Events.CMD.SWITCH, flag: 'smoke_ok', value: true },
    { type: Events.CMD.DIALOGUE, scene: 'smoke_dlg' },
  ]);
  let called = 0;
  const ctx = {
    getState: () => Engine.newGame(),
    runStory: async () => { called++; },
  };
  return Events.process([{ type: Events.CMD.CALL, event: 'smoke_common' }], ctx).then(() => {
    if (called !== 1) throw new Error('公共事件应被调用 1 次，实际 '+called);
  });
});

// ============================================================================
// 追加块：养成/经济系统（Confidant 等级、货币、商店、装备栏）
// ============================================================================

t('trustRank 等级阈值', () => {
  if (Engine.trustRank(0) !== 1) throw new Error('trustRank(0) 应为 R1');
  if (Engine.trustRank(29) !== 1) throw new Error('trustRank(29) 应为 R1');
  if (Engine.trustRank(30) !== 2) throw new Error('trustRank(30) 应为 R2');
  if (Engine.trustRank(59) !== 2) throw new Error('trustRank(59) 应为 R2');
  if (Engine.trustRank(60) !== 3) throw new Error('trustRank(60) 应为 R3');
  if (Engine.trustRank(80) !== 4) throw new Error('trustRank(80) 应为 R4');
  if (Engine.trustRank(100) !== 4) throw new Error('trustRank(100) 应为 R4');
});

t('confidantBonus 随 trust 变化', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  let b = Engine.confidantBonus(s);
  if (b.ranks.suzu !== 1 || b.total.critChance !== 0) throw new Error('初始 suzu 应无加成');
  Engine.addTrust('suzu', 30);
  b = Engine.confidantBonus(s);
  if (b.ranks.suzu !== 2) throw new Error('suzu R2 期望');
  if (b.total.critChance !== 0.05) throw new Error('suzu R2 暴击应为 0.05');
  if (b.total.atk !== 2) throw new Error('suzu R2 atk 应为 2');
  Engine.addTrust('yuki', 30);
  b = Engine.confidantBonus(s);
  if (b.ranks.yuki !== 2) throw new Error('yuki R2 期望');
  if (b.total.dmgReduction !== 0.05) throw new Error('yuki R2 减伤应为 0.05');
  Engine.addTrust('hagoromo', 30);
  b = Engine.confidantBonus(s);
  if (b.ranks.hagoromo !== 2) throw new Error('hagoromo R2 期望');
  if (b.total.craftDiscount !== 0.10) throw new Error('hagoromo R2 配方折扣应为 0.10');
  // trust 值本身不被改动（addTrust 之后才 +30）
  Engine.setState(s);
  Engine.addTrust('suzu', 100);
  if (Engine.getTrust('suzu') !== 100) throw new Error('trust 应封顶 100');
});

t('recalcStats 纳入羁绊数值加成', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  const atk0 = s.atk;
  Engine.addTrust('suzu', 30);   // R2: atk+2
  Engine.recalcStats();
  if (s.atk !== atk0 + 2) throw new Error('suzu R2 后 atk 应 +2，实际 '+(s.atk-atk0));
  if (s.critChance !== 0.05) throw new Error('s.critChance 应为 0.05');
});

t('money 增减 / 不足被拒', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  if (s.money !== 500) throw new Error('初始 money 应为 500');
  Engine.addMoney(100);
  if (s.money !== 600) throw new Error('addMoney 后应为 600');
  if (!Engine.spendMoney(200)) throw new Error('spendMoney 200 应成功');
  if (s.money !== 400) throw new Error('spend 后应为 400');
  if (Engine.spendMoney(9999)) throw new Error('余额不足应被拒');
  if (s.money !== 400) throw new Error('被拒后金额不应变化');
});

t('buyItem 成功扣钱并入库', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  const price = Data.getItem('potion').price;
  const r = Engine.buyItem('potion', 2);
  if (!r.ok) throw new Error('buyItem 应成功: '+(r.msg||''));
  if (s.money !== 500 - price*2) throw new Error('money 应减少 '+price*2);
  if (!Engine.hasItem('potion', 2)) throw new Error('potion 应入库 2 个');
});

t('buyItem 余额不足被拒', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  s.money = 10;
  const r = Engine.buyItem('mega_potion', 1);  // 250 > 10
  if (r.ok) throw new Error('余额不足应被拒');
  if (s.money !== 10) throw new Error('被拒后 money 不应变');
  if (Engine.hasItem('mega_potion', 1)) throw new Error('被拒后不应入库');
});

t('buyItem 未知物品被拒', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  if (Engine.buyItem('nonexistent').ok) throw new Error('未知物品应被拒');
});

t('sellItem 半价回笼金币', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.addItem('potion', 1);
  const price = Data.getItem('potion').price;
  const sell = Math.max(1, Math.floor(price * 0.5));
  const r = Engine.sellItem('potion', 1);
  if (!r.ok) throw new Error('sellItem 应成功');
  if (s.money !== 500 + sell) throw new Error('卖出应 +'+sell+'，实际 money='+s.money);
  if (Engine.hasItem('potion', 1)) throw new Error('卖出后应无 potion');
});

t('buyItem 有 shopDiscount 时按折扣价扣款', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  s.shopDiscount = 0.10;   // 对应羽衣 R3 商店折扣
  const price = Data.getItem('potion').price;
  const expected = Math.round(price * (1 - 0.10));
  const r = Engine.buyItem('potion', 1);
  if (!r.ok) throw new Error('buyItem 应成功: '+(r.msg||''));
  if (r.cost !== expected) throw new Error('折扣扣款应为 '+expected+'，实际 '+r.cost);
  if (s.money !== 500 - expected) throw new Error('money 应减少 '+expected+'，实际 money='+s.money);
  if (!Engine.hasItem('potion', 1)) throw new Error('potion 应入库 1 个');
});

t('buyItem 无折扣时按原价扣款（回归）', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  const price = Data.getItem('potion').price;
  const r = Engine.buyItem('potion', 1);
  if (!r.ok) throw new Error('buyItem 应成功');
  if (r.cost !== price) throw new Error('无折扣扣款应为原价 '+price+'，实际 '+r.cost);
  if (s.money !== 500 - price) throw new Error('money 应减少原价');
});

t('sellItem 不受 shopDiscount 影响（卖出价不变）', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  s.shopDiscount = 0.15;   // 最大商店折扣也不影响卖出
  Engine.addItem('potion', 1);
  const price = Data.getItem('potion').price;
  const sell = Math.max(1, Math.floor(price * 0.5));
  const r = Engine.sellItem('potion', 1);
  if (!r.ok) throw new Error('sellItem 应成功');
  if (r.gained !== sell) throw new Error('卖出应 +'+sell+'（不打折），实际 '+r.gained);
  if (s.money !== 500 + sell) throw new Error('money 应为 500+'+sell+'，实际 '+s.money);
});

t('craftRecipe 有 craftDiscount 时材料消耗打折', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.setG({ RECIPES: { r_potion: { name:'调和魂愈药水', cost:{ tentacle_frag:2, moon_petal:1 }, out:{ id:'potion', count:1 } } } });
  s.craftDiscount = 0.50;   // 大折扣便于验证取整：2→1，1→1（至少 1）
  Engine.addMaterial('tentacle_frag', 2);
  Engine.addMaterial('moon_petal', 1);
  const r = Engine.craftRecipe('r_potion');
  if (!r.ok) throw new Error('craftRecipe 应成功: '+(r.msg||''));
  if ((s.materials['tentacle_frag']||0) !== 2 - 1) throw new Error('tentacle_frag 应消耗 1（原2*0.5），剩余 '+(s.materials['tentacle_frag']||0));
  if ((s.materials['moon_petal']||0) !== 0) throw new Error('moon_petal 应消耗 1（至少 1），剩余 '+(s.materials['moon_petal']||0));
  if (!Engine.hasItem('potion', 1)) throw new Error('potion 应产出 1 个');
});

t('craftRecipe 无折扣时按原价扣材料（回归）', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.setG({ RECIPES: { r_potion: { name:'调和魂愈药水', cost:{ tentacle_frag:2, moon_petal:1 }, out:{ id:'potion', count:1 } } } });
  Engine.addMaterial('tentacle_frag', 2);
  Engine.addMaterial('moon_petal', 1);
  const r = Engine.craftRecipe('r_potion');
  if (!r.ok) throw new Error('craftRecipe 应成功');
  if ((s.materials['tentacle_frag']||0) !== 0) throw new Error('无折扣应消耗 2 个 tentacle_frag');
  if ((s.materials['moon_petal']||0) !== 0) throw new Error('无折扣应消耗 1 个 moon_petal');
});

t('craftRecipe 材料不足（折扣后）被拒', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.setG({ RECIPES: { r_potion: { name:'调和魂愈药水', cost:{ tentacle_frag:2, moon_petal:1 }, out:{ id:'potion', count:1 } } } });
  s.craftDiscount = 0.50;   // 折扣后仍需 tentacle_frag 1 + moon_petal 1
  Engine.addMaterial('tentacle_frag', 0);
  Engine.addMaterial('moon_petal', 1);   // 缺 tentacle_frag
  const r = Engine.craftRecipe('r_potion');
  if (r.ok) throw new Error('材料不足应被拒');
  if ((s.materials['tentacle_frag']||0) !== 0) throw new Error('被拒后材料不应被扣');
});

t('equipArmor 后 recalcStats 含防御加成', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.addItem('robe_white', 1);
  const def0 = s.def;
  const r = Engine.equipArmor('robe_white');
  if (!r.ok) throw new Error('equipArmor 应成功: '+(r.msg||''));
  if (s.armorId !== 'robe_white') throw new Error('armorId 未写入');
  Engine.recalcStats();
  if (s.def !== def0 + 3) throw new Error('def 应 +3，实际 '+(s.def-def0));
});

t('equipAccessory 后 recalcStats 含攻击加成', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.addItem('moon_ring', 1);
  const atk0 = s.atk;
  const r = Engine.equipAccessory('moon_ring');
  if (!r.ok) throw new Error('equipAccessory 应成功: '+(r.msg||''));
  if (s.accessoryId !== 'moon_ring') throw new Error('accessoryId 未写入');
  Engine.recalcStats();
  if (s.atk !== atk0 + 3) throw new Error('atk 应 +3，实际 '+(s.atk-atk0));
});

t('unequip 还原加成', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  Engine.addItem('robe_white', 1);
  const def0 = s.def;
  Engine.equipArmor('robe_white');
  if (s.def === def0) throw new Error('装备后 def 应变化');
  const u = Engine.unequip('armor');
  if (!u.ok) throw new Error('unequip 应成功');
  if (s.armorId !== null) throw new Error('unequip 后 armorId 应为 null');
  Engine.recalcStats();
  if (s.def !== def0) throw new Error('unequip 后 def 应还原');
});

t('装备需先拥有 / 类型校验', () => {
  const s = Engine.newGame();
  Engine.setState(s);
  if (Engine.equipArmor('robe_white').ok) throw new Error('未拥有装备不应可穿');
  Engine.addItem('moon_ring', 1);
  if (Engine.equipArmor('moon_ring').ok) throw new Error('饰品不应可穿入防具槽');
  if (Engine.equipAccessory('nonexistent').ok) throw new Error('未知装备应被拒');
});

t('Data 价格/装备查询', () => {
  if (Data.getItem('potion').price <= 0) throw new Error('potion 应有价格');
  if (Data.getEquipment('robe_white').defBonus !== 3) throw new Error('robe_white defBonus 应为 3');
  if (Data.getAllEquipment().robe_white.kind !== 'armor') throw new Error('robe_white 应为 armor');
  if (Data.getSellPrice('potion') !== Math.max(1, Math.floor(Data.getPrice('potion')*0.5))) throw new Error('sellPrice 应为买入价一半');
});

// ============================================================================
// 追加块：Engine.configure 可配置核心层（affinity/meter 抽象）
// - 默认配置回归：trust.yuki/suzu/hagoromo、ero、anchor 行为与旧版一致
// - 自定义配置：Engine.configure({...}) 换成别的角色/计量条后行为正常
// ============================================================================

t('默认配置回归：trust.yuki/ero/anchor 与旧版一致', () => {
  Engine.resetConfig();
  const s = Engine.newGame();
  if (s.trust.yuki !== 0 || s.trust.suzu !== 0 || s.trust.hagoromo !== 0) {
    throw new Error('默认 trust 初始化错误: '+JSON.stringify(s.trust));
  }
  if (s.ero !== 0) throw new Error('默认 ero 应为 0，实际 '+s.ero);
  if (s.anchor !== 50) throw new Error('默认 anchor 应为 50，实际 '+s.anchor);
  if (s.name !== '绫音' || s.trueName !== '凌') throw new Error('默认姓名错误');
  Engine.setState(s);
  Engine.addTrust('yuki', 30);
  if (Engine.getTrust('yuki') !== 30) throw new Error('addTrust yuki 应 +30');
  Engine.addTrust('suzu', 100);
  if (Engine.getTrust('suzu') !== 100) throw new Error('trust 应封顶 100');
  Engine.setStat('ero', 150);
  if (s.ero !== 100) throw new Error('ero 应封顶 100');
  Engine.addAnchor(200);
  if (s.anchor !== 100) throw new Error('anchor 应封顶 100');
  const cb = Engine.confidantBonus(s);
  if (cb.yuki === undefined || cb.suzu === undefined || cb.hagoromo === undefined) {
    throw new Error('默认配置应暴露 yuki/suzu/hagoromo 加成');
  }
  if (cb.ranks.suzu !== 4) throw new Error('suzu 100 应为 R4');
  if (cb.total.atk !== 6) throw new Error('suzu R4 总 atk 应为 6');
  if (cb.total.craftDiscount !== 0) throw new Error('hagoromo 0 不应有折扣');
});

t('Engine.configure 自定义角色/计量条后行为正常', () => {
  Engine.configure({
    initialState: { name: 'Hero', trueName: 'H' },
    affinities: {
      list: ['alice', 'bob'],
      max: 100,
      initial: { alice: 0, bob: 0 },
      thresholds: [
        { rank: 1, min: 0 },
        { rank: 2, min: 30 },
        { rank: 3, min: 60 },
        { rank: 4, min: 80 },
      ],
      bonuses: {
        alice: { 1: {}, 2: { atk: 5 }, 3: { atk: 10 }, 4: { atk: 15 } },
        bob:   { 1: {}, 2: { def: 4 }, 3: { def: 8 }, 4: { def: 12 } },
      },
    },
    meters: {
      ero:    { enabled: true, name: '侵蚀', max: 200, initial: 10 },
      anchor: { enabled: true, name: '锚点', max: 200, initial: 60 },
    },
  });
  const s = Engine.newGame();
  if (s.name !== 'Hero' || s.trueName !== 'H') throw new Error('自定义姓名未生效');
  if (JSON.stringify(Object.keys(s.trust).sort()) !== '["alice","bob"]') {
    throw new Error('自定义角色列表未生效: '+JSON.stringify(s.trust));
  }
  if (s.ero !== 10) throw new Error('自定义 ero 初始应为 10');
  if (s.anchor !== 60) throw new Error('自定义 anchor 初始应为 60');
  const atkBefore = s.atk;   // 羁绊加成前的 atk
  Engine.setState(s);
  Engine.addTrust('alice', 30);
  if (Engine.getTrust('alice') !== 30) throw new Error('alice trust 应 30');
  if (Engine.getTrust('yuki') !== 0) throw new Error('未知角色 yuki 应返回 0');
  Engine.setStat('ero', 500);
  if (s.ero !== 200) throw new Error('自定义 ero 上限应为 200');
  Engine.addAnchor(500);
  if (s.anchor !== 200) throw new Error('自定义 anchor 上限应为 200');
  const cb = Engine.confidantBonus(s);
  if (cb.ranks.alice !== 2) throw new Error('alice 30 应为 R2');
  if (cb.alice.atk !== 5) throw new Error('alice R2 atk 应为 5');
  if (cb.bob.atk !== undefined) throw new Error('bob 无 atk 加成');
  if (cb.total.atk !== 5) throw new Error('自定义 total.atk 应为 5');
  // 羁绊加成应并入 recalcStats（addTrust 已触发 recalcStats，比较加成前后）
  Engine.recalcStats();
  if (s.atk !== atkBefore + 5) throw new Error('自定义羁绊 atk 加成未并入，实际 '+(s.atk-atkBefore));
  // 重置回默认，避免影响后续
  Engine.resetConfig();
});

// ===== 多槽位存档系统（独立于上方 store，先清空模拟存储）=====
for (const k of Object.keys(store)) delete store[k];

t('saveToSlot/loadFromSlot 往返 + __meta 不污染 state', () => {
  const s = Engine.newGame();
  s.flags.multiSlot = true; s.vars.c = 7;
  Engine.setState(s);
  const r = Engine.saveToSlot(1);
  if (!r.ok) throw new Error('saveToSlot 应成功: '+JSON.stringify(r));
  if (!r.meta || r.meta.v !== 2) throw new Error('meta 缺 v2');
  if (typeof r.meta.savedAt !== 'number' || r.meta.savedAt <= 0) throw new Error('meta.savedAt 缺失');
  const s2 = Engine.newGame();
  Engine.setState(s2);
  const loaded = Engine.loadFromSlot(1);
  if (!loaded) throw new Error('loadFromSlot 应返回 state');
  if (!loaded.flags.multiSlot || loaded.vars.c !== 7) throw new Error('往返数据丢失');
  if ('__meta' in loaded) throw new Error('__meta 污染了 state');
});

t('多槽位相互独立', () => {
  const a = Engine.newGame(); a.vars.slot = 1; Engine.setState(a); Engine.saveToSlot(1);
  const b = Engine.newGame(); b.vars.slot = 2; Engine.setState(b); Engine.saveToSlot(2);
  Engine.setState(Engine.newGame());
  const la = Engine.loadFromSlot(1);
  const lb = Engine.loadFromSlot(2);
  if (la.vars.slot !== 1) throw new Error('slot1 被污染');
  if (lb.vars.slot !== 2) throw new Error('slot2 被污染');
});

t('deleteSlot 清槽并更新索引', () => {
  const s = Engine.newGame(); Engine.setState(s);
  Engine.saveToSlot(3);
  if (!Engine.getSlotMeta(3)) throw new Error('save 后应有 meta');
  if (!Engine.deleteSlot(3)) throw new Error('deleteSlot 应返回 true');
  if (Engine.getSlotMeta(3)) throw new Error('delete 后 meta 应清空');
  if (Engine.loadFromSlot(3)) throw new Error('delete 后不应读到档');
});

t('listSaves 含 meta 与 empty 槽', () => {
  const s = Engine.newGame(); s.chapter = 2; Engine.setState(s); Engine.saveToSlot(2);
  const list = Engine.listSaves();
  if (!Array.isArray(list) || list.length !== 5) throw new Error('listSaves 长度应为 5 (auto+4)');
  const m = list.find(x => x.slot === '2');
  if (!m || !m.meta) throw new Error('slot2 应有 meta');
  if (m.meta.chapter !== 2) throw new Error('meta.chapter 不对');
  const e = list.find(x => x.slot === '4');
  if (!e || e.meta !== null) throw new Error('slot4 应标 empty');
});

t('autoSave 返回 {ok,savedAt} 并更新 auto 索引', () => {
  const s = Engine.newGame(); Engine.setState(s);
  const r = Engine.autoSave();
  if (!r || r.ok !== true) throw new Error('autoSave 应返回 ok:true');
  if (typeof r.savedAt !== 'number' || r.savedAt <= 0) throw new Error('autoSave 应含 savedAt');
  const meta = Engine.getAutoMeta();
  if (!meta || meta.savedAt !== r.savedAt) throw new Error('auto 索引 meta 未更新');
  if (!Engine.hasAuto()) throw new Error('hasAuto 应为 true');
  if (!Engine.loadAuto()) throw new Error('loadAuto 应成功');
});

t('旧 wmc_save_v1 迁移到 slot_1', () => {
  for (const k of Object.keys(store)) delete store[k];
  const old = Engine.newGame(); old.flags.legacy = true;
  localStorage.setItem('wmc_save_v1', JSON.stringify(old));
  const list = Engine.listSaves();
  if (localStorage.getItem('wmc_save_v1') !== null) throw new Error('旧 key 应被删除');
  const m = list.find(x => x.slot === '1');
  if (!m || !m.meta) throw new Error('旧档应迁到 slot_1');
  const loaded = Engine.loadFromSlot(1);
  if (!loaded || loaded.flags.legacy !== true) throw new Error('迁移后数据应可读');
});

t('旧 wmc_auto_v1 无包装自动包一层', () => {
  for (const k of Object.keys(store)) delete store[k];
  const old = Engine.newGame(); old.vars.oldAuto = 1;
  localStorage.setItem('wmc_auto_v1', JSON.stringify(old));
  Engine.getAutoMeta();
  const raw = JSON.parse(localStorage.getItem('wmc_auto_v1'));
  if (!raw.__meta || !raw.state) throw new Error('auto 旧档应被包装');
  Engine.setState(Engine.newGame());
  if (!Engine.loadAuto() || Engine.getVar('oldAuto') !== 1) throw new Error('auto 迁移后读取失败');
});

t('hasAnySave 检测任意槽', () => {
  for (const k of Object.keys(store)) delete store[k];
  if (Engine.hasAnySave()) throw new Error('空存储 hasAnySave 应为 false');
  const s = Engine.newGame(); Engine.setState(s); Engine.saveToSlot(1);
  if (!Engine.hasAnySave()) throw new Error('slot1 有档 hasAnySave 应为 true');
  Engine.deleteSlot(1);
  if (Engine.hasAnySave()) throw new Error('全删后 hasAnySave 应为 false');
});

t('fmtSavedAt 格式补零', () => {
  const d = new Date(2026, 0, 5, 9, 3, 7);
  const out = Engine.fmtSavedAt(d.getTime());
  if (out !== '2026-01-05 09:03:07') throw new Error('fmtSavedAt 格式错误: '+out);
  if (Engine.fmtSavedAt(0) !== '') throw new Error('0 应返回空串');
});

// ---- 汇总输出（等待 async 测试完成，确保 ALL TESTS PASSED 输出）----
Promise.all(asyncTests).then(() => {
  results.forEach(r => console.log(r.join(' | ')));
  const failed = results.filter(r => r[0] === 'FAIL');
  console.log(failed.length === 0 ? '\nALL TESTS PASSED' : '\n'+failed.length+' FAILED');
  process.exit(failed.length === 0 ? 0 : 1);
});
