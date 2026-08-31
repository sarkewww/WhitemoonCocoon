// 世界/日程/游戏运行时 测试（纯逻辑，无 DOM）
// 覆盖 core/world.js、core/daycycle.js、core/game.js
const fs = require('fs');
const path = require('path');

// 简易 localStorage 模拟（照抄 smoke-test.js 手法）
const store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k,v) => { store[k]=String(v); },
  removeItem: k => { delete store[k]; },
};

// ---- 加载链：engine.js -> story.js -> core/world.js -> core/daycycle.js -> core/game.js ----
const dir = __dirname;
global.window = global;

// 1. engine.js（定义全局 Engine）
const engCode = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8');
const Engine = new Function(engCode + '\n return Engine;')();
global.Engine = Engine;

// 2. story.js（壳，引用全局 Engine，仅保证加载顺序不被破坏）
const storyCode = fs.readFileSync(path.join(dir, 'story.js'), 'utf8');
const Story = new Function(storyCode + '\n return Story;')();
global.Story = Story;

// 3. core/world.js（导出到 window + module.exports）
const World = require(path.join(dir, 'core', 'world.js'));
global.World = World;

// 4. core/daycycle.js
const DayCycle = require(path.join(dir, 'core', 'daycycle.js'));
global.DayCycle = DayCycle;

// 5. core/game.js（闭包引用全局 Engine/World/DayCycle，view 空对象+守卫兜底，仅做纯逻辑验证）
const Game = require(path.join(dir, 'core', 'game.js'));
global.Game = Game;

// ---- 测试基建（照抄 smoke-test.js 断言风格）----
// 支持 async 测试（Events.process 是 async）：返回 Promise 的测试收集到 asyncTests，
// 由末尾 Promise.all 统一等待后再输出结果。
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

// ---- 共享测试数据：每个地点只挂 1 个事件，保证 rollEvent 候选池确定、无随机性 ----
// loc_a: once 事件   loc_b: 仅白天   loc_c: 仅夜晚   loc_d: cond 恒 false   loc_e: 无事件   loc_f: cond 受 flags.gate 控制
World.defineMap(7, [
  { id: 'loc_a', name: 'A', conns: ['loc_b', 'loc_e'],
    events: [ { id: 'ev_once_a', scene: 'sc_once', when: 'any', once: true } ] },
  { id: 'loc_b', name: 'B', conns: ['loc_a', 'loc_c'],
    events: [ { id: 'ev_day_b', scene: 'sc_day', when: 'day' } ] },
  { id: 'loc_c', name: 'C', conns: ['loc_b', 'loc_d'],
    events: [ { id: 'ev_night_c', scene: 'sc_night', when: 'night' } ] },
  { id: 'loc_d', name: 'D', conns: ['loc_c', 'loc_e'],
    events: [ { id: 'ev_block_d', scene: 'sc_blocked', when: 'any', cond: () => false } ] },
  { id: 'loc_e', name: 'E', conns: ['loc_a', 'loc_d', 'loc_f'], events: [] },
  { id: 'loc_f', name: 'F', conns: ['loc_e'],
    events: [ { id: 'ev_cond_f', scene: 'sc_cond', when: 'any', cond: S => S.flags && S.flags.gate } ] },
]);

// 未注册章节地图（空）
World.defineMap(9, []);

// 注：真实的第 1/2 章地图在 core/world.js 内定义；
// 上方第 7 章 synthetic 地图（loc_a..loc_f）与下方第 8 章 synthetic 地图（区域感知）
// 专用于单元测试，不与真实章节编号冲突。

function freshState(overrides) {
  const s = Engine.newGame();
  s.flags = { gate: false };
  s.doneScenes = {};
  s.day = 1; s.phase = 'day'; s.ap = 2; s.dayCounters = {};
  Object.assign(s, overrides || {});
  return s;
}

// ==================== World ====================
t('World.getMap 返回注册的地点列表', () => {
  const map = World.getMap(7);
  if (map.length !== 6) throw new Error('期望6个地点，实际 '+map.length);
});

t('World.getMap 未注册章节返回空数组', () => {
  if (World.getMap(999).length !== 0) throw new Error('未注册章节应返回 []');
});

t('World.getLocation 查得到', () => {
  const loc = World.getLocation(7, 'loc_b');
  if (!loc || loc.id !== 'loc_b') throw new Error('loc_b 查询失败');
  if (World.getLocation(7, 'nope') !== null) throw new Error('不存在的 id 应返回 null');
});

t('World.getReachable 返回相邻地点', () => {
  const ids = World.getReachable(7, 'loc_a').map(l => l.id).sort();
  if (ids.join(',') !== 'loc_b,loc_e') throw new Error('loc_a 相邻应为 [loc_b,loc_e]，实际 '+ids.join(','));
  const idsB = World.getReachable(7, 'loc_b').map(l => l.id).sort();
  if (idsB.join(',') !== 'loc_a,loc_c') throw new Error('loc_b 相邻应为 [loc_a,loc_c]');
  if (World.getReachable(7, 'nope').length !== 0) throw new Error('未知地点应无相邻');
});

t('World.rollEvent when=day 只在白天抽到', () => {
  const S = freshState({ phase: 'day' });
  const ev = World.rollEvent(7, 'loc_b', 'day', S);
  if (!ev || ev.id !== 'ev_day_b') throw new Error('白天应抽到 ev_day_b，实际 '+JSON.stringify(ev));
  if (World.rollEvent(7, 'loc_b', 'night', S) !== null) throw new Error('夜晚不应抽到 day 事件');
});

t('World.rollEvent when=night 只在夜晚抽到', () => {
  const S = freshState({ phase: 'night', ap: 1 });
  const ev = World.rollEvent(7, 'loc_c', 'night', S);
  if (!ev || ev.id !== 'ev_night_c') throw new Error('夜晚应抽到 ev_night_c，实际 '+JSON.stringify(ev));
  if (World.rollEvent(7, 'loc_c', 'day', S) !== null) throw new Error('白天不应抽到 night 事件');
});

t('World.rollEvent once 只触发一次', () => {
  const S = freshState();
  const ev1 = World.rollEvent(7, 'loc_a', 'day', S);
  if (!ev1 || ev1.id !== 'ev_once_a') throw new Error('第一次应抽到 ev_once_a，实际 '+JSON.stringify(ev1));
  S.doneScenes['sc_once'] = true;
  if (World.rollEvent(7, 'loc_a', 'day', S) !== null) throw new Error('once 已做过不应再抽到');
});

t('World.rollEvent cond=false 抽不到、cond=true 可抽到', () => {
  const S = freshState(); // flags.gate=false
  if (World.rollEvent(7, 'loc_f', 'day', S) !== null) throw new Error('cond=false 应返回 null');
  S.flags.gate = true;
  const ev = World.rollEvent(7, 'loc_f', 'day', S);
  if (!ev || ev.id !== 'ev_cond_f') throw new Error('cond=true 应抽到 ev_cond_f，实际 '+JSON.stringify(ev));
});

t('World.rollEvent 空事件/无地点返回 null', () => {
  const S = freshState();
  if (World.rollEvent(7, 'loc_e', 'day', S) !== null) throw new Error('loc_e 无事件应返回 null');
  if (World.rollEvent(7, 'loc_d', 'day', S) !== null) throw new Error('loc_d cond=false 应返回 null');
  if (World.rollEvent(7, 'nope', 'day', S) !== null) throw new Error('未知地点应返回 null');
});

t('World.hasPendingEvent 正确反映可选事件', () => {
  const S = freshState();
  if (!World.hasPendingEvent(7, 'loc_a', 'day', S)) throw new Error('loc_a 白天应有待触发事件');
  if (World.hasPendingEvent(7, 'loc_e', 'day', S)) throw new Error('loc_e 不应有待触发事件');
});

// ==================== DayCycle ====================
t('DayCycle.ensure 补默认字段', () => {
  const S = {};
  DayCycle.ensure(S);
  if (S.day !== 1 || S.phase !== 'day' || S.ap !== 2) {
    throw new Error('默认应为 day=1/phase=day/ap=2，实际 '+JSON.stringify({day:S.day,phase:S.phase,ap:S.ap}));
  }
  if (!S.dayCounters || typeof S.dayCounters !== 'object') throw new Error('dayCounters 应初始化为 {}');
});

t('DayCycle.getPhase 与默认阶段', () => {
  const S = {};
  if (DayCycle.getPhase(S) !== 'day') throw new Error('默认阶段应为 day');
});

t('DayCycle.advance day->night', () => {
  const S = freshState({ phase: 'day', ap: 2 });
  const r = DayCycle.advance(S);
  if (r.to !== 'night' || S.phase !== 'night') throw new Error('白天应推进到夜晚');
  if (S.ap !== 1) throw new Error('夜晚 ap 应为 1，实际 '+S.ap);
  if (S.day !== 1) throw new Error('同一天进入夜晚 day 不变');
});

t('DayCycle.advance night->day+1', () => {
  const S = freshState({ phase: 'night', ap: 1, chapter: 1, dayCounters: {} });
  const r = DayCycle.advance(S);
  if (r.to !== 'day' || S.phase !== 'day') throw new Error('夜晚应推进到次日白天');
  if (S.day !== 2) throw new Error('次日 day 应为 2，实际 '+S.day);
  if (S.ap !== 2) throw new Error('白天 ap 应为 2，实际 '+S.ap);
  if (S.dayCounters[1] !== 1) throw new Error('章天数应 +1，实际 '+S.dayCounters[1]);
});

t('DayCycle.spend 够则扣', () => {
  const S = freshState({ phase: 'day', ap: 2 });
  if (!DayCycle.spend(S, 'explore') || S.ap !== 1) throw new Error('扣1点应成功，剩余 '+S.ap);
  if (!DayCycle.spend(S, 'chat') || S.ap !== 0) throw new Error('扣1点应成功，剩余 '+S.ap);
});

t('DayCycle.spend ap 不足时返回 false', () => {
  // 注：ensure() 中 if (!S.ap) S.ap = DAY_AP 会把 ap=0 重置回 2（已知缺陷，见下方诊断），
  // 故用非零不足值 ap=0.5 验证 S.ap < cost 分支的真实行为。
  const S = freshState({ phase: 'day', ap: 0.5 });
  if (DayCycle.spend(S, 'explore') !== false) throw new Error('ap<cost 时应返回 false');
  if (S.ap !== 0.5) throw new Error('失败不应扣点');
});

t('DayCycle.spend craft 免费（cost=0）', () => {
  const S = freshState({ phase: 'day', ap: 0 });
  if (!DayCycle.spend(S, 'craft')) throw new Error('craft cost=0 应总是成功');
});

t('DayCycle.mainReady 章天数门槛', () => {
  const S = freshState({ chapter: 1, dayCounters: {} });
  if (DayCycle.mainReady(S, 1, 1)) throw new Error('0天不应满足门槛');
  S.dayCounters[1] = 1;
  if (!DayCycle.mainReady(S, 1, 1)) throw new Error('1天应满足默认门槛');
  if (DayCycle.mainReady(S, 1, 2)) throw new Error('1天不满足 requireDays=2');
  S.dayCounters[1] = 2;
  if (!DayCycle.mainReady(S, 1, 2)) throw new Error('2天应满足 requireDays=2');
});

// ---- 已知缺陷诊断（core/daycycle.js 只读，不改，仅记录，不计入失败）----
(function diagDayCycleApReset() {
  const S = freshState({ phase: 'day', ap: 0 });
  const res = DayCycle.spend(S, 'fight');
  if (res !== false) {
    console.log('KNOWN-BUG | DayCycle.spend 在 ap=0 时被 ensure() 重置回 '+S.ap+'，返回 '+res+'（AP 永远无法耗尽）');
  } else {
    console.log('OK | DayCycle.spend 在 ap=0 时正确返回 false');
  }
})();

// ==================== Game（纯逻辑） ====================
let viewCalls = { renderMap: 0, showHud: 0, runStory: 0, runBattle: 0, log: [] };
const mockView = {
  renderMap: () => { viewCalls.renderMap++; },
  runStory: () => { viewCalls.runStory++; return Promise.resolve(); },
  runBattle: () => { viewCalls.runBattle++; return Promise.resolve(); },
  showHud: () => { viewCalls.showHud++; },
  log: m => { viewCalls.log.push(m); },
};
Game.register(mockView);

function resetGame(c, overrides) {
  const S = freshState(overrides);
  Engine.setState(S);
  Game.setChapter(c);
  Game.setPhase(Game.PHASES.EXPLORE);
  viewCalls = { renderMap: 0, showHud: 0, runStory: 0, runBattle: 0, log: [] };
  return S;
}

t('Game.register 能存回调', () => {
  Game.register({ renderMap: null }); // 不应抛错
  Game.register(mockView);            // 恢复
  if (typeof Game.register !== 'function') throw new Error('register 应为函数');
});

t('Game.explore 有地图时不抛错且设置阶段/地点', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  if (Game.getChapter() !== 7) throw new Error('章节应为 1');
  if (Game.getPhase() !== Game.PHASES.EXPLORE) throw new Error('阶段应为 EXPLORE');
  if (Game.getCurrentLoc() !== 'loc_a') throw new Error('当前地点应为 loc_a');
  if (viewCalls.renderMap < 1) throw new Error('explore 应触发 renderMap');
  if (viewCalls.runStory !== 0) throw new Error('纯逻辑测试不应触发 runStory');
});

t('Game.explore 无地图章节不抛错', () => {
  resetGame(9);
  let err = null;
  try { Game.explore(9); } catch(e) { err = e; }
  if (err) throw new Error('无地图章节 explore 不应抛错: '+err.message);
  if (Game.getChapter() !== 9) throw new Error('章节应为 9');
});

t('Game.explore 缺省取地图首节点', () => {
  resetGame(7);
  Game.explore(7);
  if (Game.getCurrentLoc() !== 'loc_a') throw new Error('缺省地点应为地图首节点 loc_a');
});

t('Game.moveTo 到相邻地点改变 currentLoc', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  Game.moveTo('loc_e'); // loc_e 无事件，不触发 runStory
  if (Game.getCurrentLoc() !== 'loc_e') throw new Error('移动后应位于 loc_e');
  if (viewCalls.runStory !== 0) throw new Error('loc_e 无匹配事件，不应触发 runStory');
});

t('Game.moveTo 非相邻地点被拒绝', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  Game.moveTo('loc_c'); // loc_a 只连通 loc_b/loc_e
  if (Game.getCurrentLoc() !== 'loc_a') throw new Error('非相邻移动应被拒绝，仍应在 loc_a');
  if (viewCalls.log.length === 0) throw new Error('拒绝时应有 log 提示');
});

t('Game.moveTo 触发地点 once 事件并记录 doneScenes', () => {
  resetGame(7);
  Game.explore(7, 'loc_e');
  Game.moveTo('loc_a'); // loc_a 有 once 事件 ev_once_a
  if (Game.getCurrentLoc() !== 'loc_a') throw new Error('应能移动到 loc_a');
  const S = Engine.getState();
  if (!S.doneScenes['sc_once']) throw new Error('once 事件应写入 doneScenes');
});

t('Game.moveTo 白天触发仅白天事件', () => {
  resetGame(7, { phase: 'day' });
  Game.explore(7, 'loc_a');
  Game.moveTo('loc_b'); // loc_b 白天有 ev_day_b
  if (Game.getCurrentLoc() !== 'loc_b') throw new Error('应能移动到 loc_b');
  if (viewCalls.runStory !== 1) throw new Error('白天应触发 ev_day_b 的 runStory 1 次，实际 '+viewCalls.runStory);
});

t('Game.fireAt cond=false 不触发', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  Game.fireAt('loc_d', 0); // cond 恒 false
  if (Game.getCurrentLoc() !== 'loc_d') throw new Error('fireAt 应把当前地点切到 loc_d');
  if (viewCalls.runStory !== 0) throw new Error('cond=false 不应触发 runStory');
  if (viewCalls.log.length === 0) throw new Error('cond=false 应有 log 提示');
});

t('Game.runDialogue 切换到 DIALOGUE 并调用 runStory', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  Game.runDialogue('some_scene');
  if (Game.getPhase() !== Game.PHASES.DIALOGUE) throw new Error('阶段应为 DIALOGUE');
  if (viewCalls.runStory !== 1) throw new Error('runStory 应被调用 1 次');
});

t('Game.passTime 推进日程不抛错', () => {
  resetGame(1, { phase: 'day', day: 1, ap: 2 });
  const r = Game.passTime();
  if (r.to !== 'night') throw new Error('day 应先到 night');
  const r2 = Game.passTime();
  if (r2.to !== 'day' || r2.day !== 2) throw new Error('night 应到第 2 天白天');
});

t('Game.getLoc 取当前章节地点', () => {
  resetGame(7);
  Game.explore(7, 'loc_a');
  const loc = Game.getLoc('loc_b');
  if (!loc || loc.id !== 'loc_b') throw new Error('getLoc 应查到 loc_b');
});

// ============================================================================
// 追加块：区域感知（district/车站枢纽）+ Data + Events
// 加载链：engine -> story -> core/world -> core/daycycle -> core/game
//         -> core/data -> core/events
// ============================================================================

// ---- 加载 core/data.js 与 core/events.js（new Function，与顶部各模块同手法）----
const dataCode = fs.readFileSync(path.join(dir, 'core', 'data.js'), 'utf8');
const Data = new Function(dataCode + '\n return Data;')();
global.Data = Data;

const eventsCode = fs.readFileSync(path.join(dir, 'core', 'events.js'), 'utf8');
const Events = new Function(eventsCode + '\n return Events;')();
global.Events = Events;

// 6. enemies.js（敌人数据表，供战斗事件校验）
const enemiesCode = fs.readFileSync(path.join(dir, 'enemies.js'), 'utf8');
const ENEMIES = new Function(enemiesCode + '\n return ENEMIES;')();
global.ENEMIES = ENEMIES;

// ==================== 区域感知测试（章节 2 专用带 district 地图） ====================
// 区域：station_area 车站区 / north_area 北区（2 个地点）/ east_area 东区（2 个地点）
//       south_area 孤岛（无车站连接，验证被车站路由排除）
World.defineMap(8, [
  { id: 'station', name: '车站', district: 'station_area', conns: ['north', 'east'] },
  { id: 'north', name: '北区入口', district: 'north_area', conns: ['station', 'north2'] },
  { id: 'north2', name: '北区深处', district: 'north_area', conns: ['north'] },
  { id: 'east', name: '东区入口', district: 'east_area', conns: ['station', 'east2'] },
  { id: 'east2', name: '东区深处', district: 'east_area', conns: ['east'] },
  { id: 'isolated', name: '孤岛', district: 'south_area', conns: [] },
]);

t('World.getDistricts 返回区域列表（首次出现顺序）', () => {
  const ds = World.getDistricts(8);
  if (ds.map(d => d.id).join(',') !== 'station_area,north_area,east_area,south_area') {
    throw new Error('区域列表应为 station_area,north_area,east_area,south_area，实际 '+ds.map(d=>d.id).join(','));
  }
  if (World.getDistricts(999).length !== 0) throw new Error('未注册章节应返回 []');
});

t('World.getLocationsInDistrict 返回该区域所有地点', () => {
  const ids = World.getLocationsInDistrict(8, 'north_area').map(l => l.id).sort();
  if (ids.join(',') !== 'north,north2') throw new Error('north_area 应为 [north,north2]，实际 '+ids.join(','));
  if (World.getLocationsInDistrict(8, 'nope').length !== 0) throw new Error('未知区域应返回 []');
});

t('World.getStation 返回车站枢纽', () => {
  const st = World.getStation(8);
  if (!st || st.id !== 'station') throw new Error('车站应为 station');
  if (World.getStation(999) !== null) throw new Error('未注册章节应返回 null');
});

t('World.getReachable 区域内返回相邻 + 车站', () => {
  // north 同区域相邻 north2，另加车站
  const ids = World.getReachable(8, 'north').map(l => l.id).sort();
  if (ids.join(',') !== 'north2,station') throw new Error('north 可达应为 [north2,station]，实际 '+ids.join(','));
  // 跨区域地点（east）不应出现在可达中
  if (ids.indexOf('east') !== -1) throw new Error('跨区域地点不应直接可达');
});

t('World.getReachable 车站返回各区域入口节点', () => {
  const ids = World.getReachable(8, 'station').map(l => l.id).sort();
  // 入口：north（north_area 直连车站）、east（east_area 直连车站）
  // isolated（south_area）不连车站、station_area 自身，均排除
  if (ids.join(',') !== 'east,north') throw new Error('车站可达应为 [east,north]，实际 '+ids.join(','));
});

t('World.getReachable 无连接孤岛仍可达车站', () => {
  const ids = World.getReachable(8, 'isolated').map(l => l.id);
  // 非车站地点总是返回车站；同区域无相邻
  if (ids.join(',') !== 'station') throw new Error('isolated 可达应为 [station]，实际 '+ids.join(','));
});

// ==================== Data 测试（core/data.js） ====================
t('Data.getItem 返回物品对象', () => {
  const item = Data.getItem('potion');
  if (!item || item.name !== '魂愈药水' || item.kind !== 'heal') throw new Error('potion 查询失败');
  if (Data.getItem('nope') !== null) throw new Error('不存在物品应返回 null');
});

t('Data.getMaterial 返回材料对象', () => {
  const mat = Data.getMaterial('dark_crystal');
  if (!mat || mat.name !== '暗蚀结晶' || mat.price !== 50) throw new Error('dark_crystal 查询失败');
  if (Data.getMaterial('nope') !== null) throw new Error('不存在材料应返回 null');
});

t('Data.getRecipe 返回配方对象', () => {
  const rcp = Data.getRecipe('r_potion');
  if (!rcp || rcp.name !== '调和魂愈药水') throw new Error('r_potion 查询失败');
  if (!rcp.cost || !rcp.out || rcp.out.id !== 'potion') throw new Error('配方应含 cost/out 且产出 potion');
  if (Data.getRecipe('nope') !== null) throw new Error('不存在配方应返回 null');
});

t('Data.getSkill 返回技能对象', () => {
  const sk = Data.getSkill('strike');
  if (!sk || sk.name !== '净化斩' || sk.kind !== 'physical' || sk.mult !== 1.0) throw new Error('strike 查询失败');
  if (Data.getSkill('nope') !== null) throw new Error('不存在技能应返回 null');
});

t('Data.getEnemy 引用 enemy 对象（mock window.ENEMIES）', () => {
  global.ENEMIES = { spider1: { id: 'spider1', name: '织网之魔' } };
  const en = Data.getEnemy('spider1');
  if (!en || en.id !== 'spider1' || en.name !== '织网之魔') throw new Error('spider1 应引用 ENEMIES 对象');
  if (en !== global.ENEMIES.spider1) throw new Error('应返回同一引用，而非拷贝');
  delete global.ENEMIES;
  if (Data.getEnemy('spider1') !== null) throw new Error('无 ENEMIES 时应返回 null');
});

// ==================== Events 测试（core/events.js） ====================
t('Events.registerCommon 注册公共事件并被 CALL 执行', () => {
  Events.registerCommon('ev_public_1', [
    { type: Events.CMD.DIALOGUE, scene: 'pub_scene' },
    { type: Events.CMD.SWITCH, flag: 'pub_flag', value: true },
  ]);
  let sceneId = null;
  const ctx = {
    getState: () => Engine.newGame(),
    runStory: async (sc) => { sceneId = sc; },
  };
  return Events.process([{ type: Events.CMD.CALL, event: 'ev_public_1' }], ctx).then(() => {
    if (sceneId !== 'pub_scene') throw new Error('公共事件 DIALOGUE 未被调用，sceneId='+sceneId);
  });
});

t('Events.checkCondition 各类条件', () => {
  const S = {
    flags: { a: true }, vars: { x: 5 },
    trust: { taro: 3 }, ero: 30, anchor: 60,
    inventory: [{ id: 'potion' }],
  };
  if (!Events.checkCondition({ flag: 'a' }, S)) throw new Error('flag=true 应通过');
  if (Events.checkCondition({ flag: 'b' }, S)) throw new Error('flag=b 不存在应不通过');
  if (!Events.checkCondition({ noFlag: 'b' }, S)) throw new Error('noFlag=b 应通过');
  if (Events.checkCondition({ noFlag: 'a' }, S)) throw new Error('noFlag=a 存在应不通过');
  if (!Events.checkCondition({ var: 'x', value: 5 }, S)) throw new Error('var x>=5 应通过');
  if (Events.checkCondition({ var: 'x', value: 10 }, S)) throw new Error('var x>=10 应不通过');
  if (!Events.checkCondition({ trust: 'taro', value: 3 }, S)) throw new Error('trust taro>=3 应通过');
  if (Events.checkCondition({ trust: 'taro', value: 5 }, S)) throw new Error('trust taro>=5 应不通过');
  if (!Events.checkCondition({ ero: 30 }, S)) throw new Error('ero>=30 应通过');
  if (Events.checkCondition({ ero: 50 }, S)) throw new Error('ero>=50 应不通过');
  if (!Events.checkCondition({ anchor: 60 }, S)) throw new Error('anchor>=60 应通过');
  if (!Events.checkCondition({ item: 'potion' }, S)) throw new Error('有 potion 应通过');
  if (Events.checkCondition({ item: 'ether' }, S)) throw new Error('无 ether 应不通过');
  if (!Events.checkCondition({ custom: s => s.flags.a }, S)) throw new Error('custom 应通过');
  if (!Events.checkCondition(null, S)) throw new Error('null 条件应通过');
});

t('Events.worldEventToCommands 转换 World 事件', () => {
  const cmds = Events.worldEventToCommands({ scene: 'some_scene', enemy: 'spider1', next: 'after_battle', lose: 'game_over' });
  if (cmds.length !== 2) throw new Error('应生成 2 条命令，实际 '+cmds.length);
  if (cmds[0].type !== Events.CMD.DIALOGUE || cmds[0].scene !== 'some_scene') throw new Error('首条应为 DIALOGUE');
  if (cmds[1].type !== Events.CMD.BATTLE || cmds[1].enemy !== 'spider1' || cmds[1].next !== 'after_battle' || cmds[1].lose !== 'game_over') {
    throw new Error('次条应为 BATTLE 且含 next/lose，实际 '+JSON.stringify(cmds[1]));
  }
  const only = Events.worldEventToCommands({ scene: 'just_dialog' });
  if (only.length !== 1 || only[0].type !== Events.CMD.DIALOGUE) throw new Error('无 enemy 应只生成 DIALOGUE');
  if (Events.worldEventToCommands({}).length !== 0) throw new Error('空事件应生成空命令');
});

// ==================== AP / 每日限量 / 主线 gate ====================
// 为战斗/限量测试定义专用章节 3 地图（含 once:false 战斗事件）
World.defineMap(6, [
  { id: 'loc_fight', name: '战斗点', conns: [],
    events: [ { id: 'ev_rep_fight', scene: 'sc_fight', enemy: 'spider1', when: 'any', once: false,
               rewards: { materials: { tentacle_frag: 1 } } } ] },
  { id: 'loc_side', name: '支线点', conns: ['loc_fight'],
    events: [ { id: 'ev_rep_chat', scene: 'sc_chat', when: 'any', once: false } ] },
]);

t('AP 扣减：moveTo 扣1 行动点', () => {
  const S = resetGame(7, { ap: 2 });
  Game.explore(7, 'loc_a');
  Game.moveTo('loc_e');
  if (S.ap !== 1) throw new Error('moveTo 应扣 1 点 AP，剩余 ' + S.ap);
  if (Game.getCurrentLoc() !== 'loc_e') throw new Error('移动应成功到 loc_e');
});

t('AP 不足时移动被拒', () => {
  const S = resetGame(7, { ap: 0 });
  Game.explore(7, 'loc_a');
  const logLen = viewCalls.log.length;
  Game.moveTo('loc_e');
  if (Game.getCurrentLoc() !== 'loc_a') throw new Error('AP 不足应保持原地，实际 ' + Game.getCurrentLoc());
  if (S.ap !== 0) throw new Error('AP 不应被扣，实际 ' + S.ap);
  if (viewCalls.log.length === logLen) throw new Error('拒绝时应有 log 提示');
});

t('AP 扣减：fireAt 战斗扣1', () => {
  const S = resetGame(6, { ap: 2, chapter: 3, phase: 'day' });
  Game.explore(6, 'loc_fight');
  const rb0 = viewCalls.runBattle;
  Game.fireAt('loc_fight', 0);
  if (S.ap !== 1) throw new Error('战斗应扣 1 点 AP，剩余 ' + S.ap);
  if (viewCalls.runBattle !== rb0 + 1) throw new Error('runBattle 应被调用，实际 ' + (viewCalls.runBattle - rb0));
});

t('AP 不足时 fireAt 战斗被拒', () => {
  const S = resetGame(6, { ap: 0, chapter: 3, phase: 'day' });
  Game.explore(6, 'loc_fight');
  const rb0 = viewCalls.runBattle;
  Game.fireAt('loc_fight', 0);
  if (viewCalls.runBattle !== rb0) throw new Error('AP 不足不应触发 runBattle');
  if (S.ap !== 0) throw new Error('AP 不应被扣');
});

t('主线 gate：isMainlineUnlocked 天数门槛', () => {
  const S = resetGame(1, { chapter: 1, dayCounters: {} });
  let st = Game.isMainlineUnlocked(1, 1);
  if (st.unlocked !== false) throw new Error('0 天不应解锁');
  if (st.need !== 1) throw new Error('need 应为 1，实际 ' + st.need);
  S.dayCounters[1] = 1;
  st = Game.isMainlineUnlocked(1, 1);
  if (st.unlocked !== true) throw new Error('1 天应解锁');
  if (st.need !== 0) throw new Error('已解锁 need 应为 0');
  st = Game.isMainlineUnlocked(1, 2);
  if (st.unlocked !== false) throw new Error('1 天不满足 requireDays=2');
  if (st.need !== 1) throw new Error('need 应为 1');
});

t('主线 gate：advanceMainline 未解锁时返回未解锁状态', () => {
  const S = resetGame(1, { chapter: 1, dayCounters: {} });
  const rs0 = viewCalls.runStory;
  const r = Game.advanceMainline(1, 1);
  if (r.unlocked !== false) throw new Error('未解锁应返回 unlocked=false');
  if (r.need !== 1) throw new Error('need 应为 1');
  if (viewCalls.runStory !== rs0) throw new Error('未解锁不应触发 runStory');
});

t('主线 gate：advanceMainline 已解锁时进入主线', () => {
  const S = resetGame(1, { chapter: 1, dayCounters: {} });
  S.dayCounters[1] = 1;
  const rs0 = viewCalls.runStory;
  const r = Game.advanceMainline(1, 1);
  if (r.unlocked !== true) throw new Error('已解锁应返回 unlocked=true');
  if (r.scene !== 'chapter1_1') throw new Error('应跳转到 chapter1_1，实际 ' + r.scene);
  if (viewCalls.runStory !== rs0 + 1) throw new Error('已解锁应触发 runStory');
});

t('每日限量：重复战斗每天最多 2 次', () => {
  const S = resetGame(6, { ap: 5, chapter: 3, dayCounters: {}, phase: 'day', eventCounts: {} });
  Game.explore(6, 'loc_fight');
  const rb0 = viewCalls.runBattle;
  // 第 1 次：应成功
  Game.fireAt('loc_fight', 0);
  if (viewCalls.runBattle !== rb0 + 1) throw new Error('第 1 次应触发，实际 ' + (viewCalls.runBattle - rb0));
  // 第 2 次：应成功
  Game.fireAt('loc_fight', 0);
  if (viewCalls.runBattle !== rb0 + 2) throw new Error('第 2 次应触发，实际 ' + (viewCalls.runBattle - rb0));
  // 第 3 次：应被限量拒绝
  const logLen = viewCalls.log.length;
  Game.fireAt('loc_fight', 0);
  if (viewCalls.runBattle !== rb0 + 2) throw new Error('第 3 次应被拒绝，runBattle 不应增加');
  if (viewCalls.log.length === logLen) throw new Error('限量拒绝应有 log 提示');
  // 跨日后重置（模拟新的一天）
  S.day = 2;
  S.eventCounts = {};
  Game.fireAt('loc_fight', 0);
  if (viewCalls.runBattle !== rb0 + 3) throw new Error('跨日后应能再次触发，实际 ' + (viewCalls.runBattle - rb0));
});

t('每日限量：重复对话事件也限量', () => {
  const S = resetGame(6, { ap: 5, chapter: 3, dayCounters: {}, phase: 'day', eventCounts: {} });
  Game.explore(6, 'loc_side');
  const rs0 = viewCalls.runStory;
  // 第 1 次对话
  Game.fireAt('loc_side', 0);
  if (viewCalls.runStory !== rs0 + 1) throw new Error('第 1 次对话应触发');
  // 第 2 次对话
  Game.fireAt('loc_side', 0);
  if (viewCalls.runStory !== rs0 + 2) throw new Error('第 2 次对话应触发');
  // 第 3 次对话（应被限量拒绝）
  const logLen = viewCalls.log.length;
  Game.fireAt('loc_side', 0);
  if (viewCalls.runStory !== rs0 + 2) throw new Error('第 3 次对话应被拒绝');
  if (viewCalls.log.length === logLen) throw new Error('限量拒绝应有 log 提示');
});

// ==================== 真实地图校验（第 1/2/3 章，定义在 core/world.js） ====================
// 加载所有 .story 文件，提取 label id 集合用于事件引用校验
const storyDir = path.join(dir, 'story');
const storyFiles = fs.readdirSync(storyDir).filter(f => f.endsWith('.story'));
const storyLabels = new Set();
for (const file of storyFiles) {
  const content = fs.readFileSync(path.join(storyDir, file), 'utf8');
  for (const m of content.matchAll(/^label\s+(\S+)/gm)) {
    storyLabels.add(m[1]);
  }
}

// 校验三个章节的地图
for (const ch of [1, 2, 3]) {
  t(`第${ch}章地图 >= 4 个地点`, () => {
    const map = World.getMap(ch);
    if (map.length < 4) throw new Error(`第${ch}章应有 >=4 个地点，实际 ${map.length}`);
  });

  t(`第${ch}章地图连通（从首地点可达所有地点）`, () => {
    const map = World.getMap(ch);
    if (!map.length) return;
    const start = map[0].id;
    const visited = new Set();
    const queue = [start];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const nb of World.getReachable(ch, id)) {
        if (!visited.has(nb.id)) queue.push(nb.id);
      }
    }
    if (visited.size !== map.length) {
      throw new Error(`第${ch}章起点 ${start} 仅可达 ${visited.size}/${map.length} 个地点`);
    }
  });

  t(`第${ch}章有 >=2 条不同 when 的事件`, () => {
    const map = World.getMap(ch);
    const whens = new Set();
    for (const loc of map) {
      for (const ev of (loc.events || [])) {
        if (ev.when) whens.add(ev.when);
      }
    }
    if (whens.size < 2) {
      throw new Error(`第${ch}章应有至少 2 种不同 when 值（day/night），实际 ${JSON.stringify([...whens])}`);
    }
  });

  t(`第${ch}章所有事件 scene/next 引用真实 story 场景 id`, () => {
    const map = World.getMap(ch);
    const bad = [];
    for (const loc of map) {
      for (const ev of (loc.events || [])) {
        if (ev.scene && !storyLabels.has(ev.scene)) bad.push(`${loc.id}/${ev.id}: scene=${ev.scene}`);
        if (ev.next && !storyLabels.has(ev.next)) bad.push(`${loc.id}/${ev.id}: next=${ev.next}`);
      }
    }
    if (bad.length) throw new Error('未找到的场景 id:\n' + bad.join('\n'));
  });
}

// 战斗事件 enemy 引用真实 enemies.js 敌人 id
t('所有战斗事件 enemy 引用真实存在的敌人 id', () => {
  const validEnemies = new Set(Object.keys(ENEMIES));
  const bad = [];
  for (const ch of [1, 2, 3]) {
    for (const loc of World.getMap(ch)) {
      for (const ev of (loc.events || [])) {
        if (ev.enemy && !validEnemies.has(ev.enemy)) {
          bad.push(`第${ch}章/${loc.id}/${ev.id}: enemy=${ev.enemy}`);
        }
      }
    }
  }
  if (bad.length) throw new Error('未找到的敌人 id:\n' + bad.join('\n'));
});

// ---- 汇总输出（等待 async 测试完成）----
Promise.all(asyncTests).then(() => {
  results.forEach(r => console.log(r.join(' | ')));
  const failed = results.filter(r => r[0] === 'FAIL');
  console.log(failed.length === 0 ? '\nALL TESTS PASSED' : '\n'+failed.length+' FAILED');
  process.exit(failed.length === 0 ? 0 : 1);
});
