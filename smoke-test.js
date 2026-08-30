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
function t(name, fn) {
  try { fn(); results.push(['PASS', name]); }
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
  const ch3 = Story.get('chapter3_8');
  // chapter3_8 被覆盖为 getter
  const state = Engine.newGame();
  state.ero = 40;
  Engine.setState(state);
  const choices = ch3.choices;
  if (choices.length !== 4) throw new Error('隐藏结局未出现，len='+choices.length);
  state.ero = 80;
  const choices2 = ch3.choices;
  if (choices2.length !== 3) throw new Error('侵蚀高时应无隐藏结局，len='+choices2.length);
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

// ---- 汇总输出（移至文件末尾，确保所有测试已注册）----
results.forEach(r => console.log(r.join(' | ')));
const failed = results.filter(r => r[0] === 'FAIL');
console.log(failed.length === 0 ? '\nALL TESTS PASSED' : '\n'+failed.length+' FAILED');
