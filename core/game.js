/* =========================================================
 * 白月茧响 - 游戏运行时（Game）
 * 顶层状态机：EXPLORE / DIALOGUE / BATTLE / MENU / ENDING。
 *
 * 职责：
 * - 协调 World（位置/事件）与 Story（场景）与 DayCycle（日程）。
 * - 拥有"当前章节地图 / 当前地点 / 当前阶段"。
 * - 通过注册的视图回调驱动 UI，自身不触碰 DOM。
 *
 * 与 App（main.js）的关系：
 *   App 注册 renderMap / runStory / runBattle / showHud 等回调；
 *   Game 调用这些回调完成切换。现有 story 剧本不改。
 * ========================================================= */
'use strict';

const Game = (() => {

  // ---- 阶段 ----
  const PHASES = { EXPLORE:'EXPLORE', DIALOGUE:'DIALOGUE', BATTLE:'BATTLE', MENU:'MENU', ENDING:'ENDING' };

  // ---- 视图回调（由 App 注册）----
  let view = {
    renderMap: null,     // (map, curLoc, dayInfo) => void
    runStory: null,      // (sceneId) => Promise<void>
    runBattle: null,     // (enemyId, onWin, onLose) => Promise<void>
    showHud: null,       // () => void
    log: null,           // (msg) => void
  };

  let phase = PHASES.EXPLORE;
  let chapter = 0;
  let currentLoc = null;
  let dialogueStack = [];   // 对话链（用于返回地图）

  function register(v) { Object.assign(view, v); }

  // ---- 章节/地图 ----
  function setChapter(c) { chapter = c; }
  function getChapter() { return chapter; }
  function getPhase() { return phase; }
  function setPhase(p) { phase = p; }
  function getCurrentLoc() { return currentLoc; }
  function getLoc(id) { return typeof World !== 'undefined' && World.getLocation(chapter, id); }

  // 从 Engine 状态同步内部 chapter（解决 story 改 S.chapter 后 Game.chapter 不同步的问题）
  function syncFromState() {
    const S = typeof Engine !== 'undefined' && Engine.getState();
    if (S && typeof S.chapter === 'number') chapter = S.chapter;
  }

  // ---- 探索入口 ----
  // 进入某章节的地图探索。locId 缺省取地图首节点。
  function explore(c, locId) {
    chapter = c;
    const S = Engine.getState();
    S.chapter = c;
    if (typeof DayCycle !== 'undefined') DayCycle.ensure(S);
    const map = (typeof World !== 'undefined' && World.getMap(c)) || [];
    if (!map.length) { view.log && view.log('该章节暂无地图'); return; }
    currentLoc = locId || map[0].id;
    phase = PHASES.EXPLORE;
    renderMap();
  }

  // 移动到相邻地点（区域感知版）
  // 车站（station）为唯一区域枢纽：当前地点与目标不在同一区域时，
  // 必须先到车站，再由车站选择目的地区域。
  function moveTo(locId) {
    const S = Engine.getState();
    if (currentLoc && typeof World !== 'undefined') {
      const reachable = World.getReachable(chapter, currentLoc);
      const ok = reachable.some(l => l.id === locId);
      if (!ok && locId !== 'station') {
        view.log && view.log('需要先去车站');
        return;
      }
    }
    currentLoc = locId;
    renderMap();
    // 移动后尝试触发地点事件
    tryFireEvent();
  }

  // 从车站前往其他区域（Persona 式区域交通）
  // 前提：当前必须在车站；消耗 1 行动点后传送到目标区域入口节点。
  function travelToDistrict(districtId) {
    if (currentLoc !== 'station') {
      view.log && view.log('需要先到达车站才能前往其他区域');
      return;
    }
    const locs = typeof World !== 'undefined' && World.getLocationsInDistrict(chapter, districtId);
    if (!locs || !locs.length) {
      view.log && view.log('该区域还没有可到达的地点');
      return;
    }
    const S = typeof Engine !== 'undefined' && Engine.getState();
    if (typeof DayCycle !== 'undefined') {
      if (!DayCycle.spend(S, 'travel')) {
        view.log && view.log('行动点不足');
        return;
      }
    }
    const entry = locs[0];
    currentLoc = typeof entry === 'string' ? entry : entry.id;
    renderMap();
    // 抵达后尝试触发入口节点事件
    tryFireEvent();
  }

  // 当前地点所属区域
  function getCurrentDistrict() {
    if (typeof World === 'undefined' || !currentLoc) return undefined;
    const loc = World.getLocation(chapter, currentLoc);
    return loc ? loc.district : undefined;
  }

  // ---- Events 事件解释器桥接 ----
  // 若 core/events.js 已加载（window.Events）且事件定义了 commands 命令序列，
  // 则交给 Events.process 解释执行；否则回落到 scene/enemy 两分支。
  function evalCond(cond, S) {
    if (!cond) return true;
    if (typeof cond === 'function') return !!cond(S);
    if (typeof Events !== 'undefined' && Events.checkCondition) return !!Events.checkCondition(cond, S);
    return true;
  }
  function grantRewards(ev) {
    const rw = (ev && ev.rewards) || {};
    const mats = rw.materials || {};
    for (const [m, n] of Object.entries(mats)) {
      if (typeof Engine !== 'undefined' && Engine.addMaterial) Engine.addMaterial(m, n);
    }
  }
  function buildEventCtx() {
    return {
      getState: () => Engine.getState(),
      setState: (s) => { if (typeof Engine !== 'undefined' && Engine.setState) Engine.setState(s); },
      log: (msg) => view.log && view.log(msg),
      runStory: (sceneId) => view.runStory ? view.runStory(sceneId) : Promise.resolve(),
      runBattle: (enemyId, onWin, onLose) => view.runBattle ? view.runBattle(enemyId, onWin, onLose) : Promise.resolve(),
      wait: (ms) => new Promise(r => setTimeout(r, ms || 500)),
      moveTo: (target) => { if (target) moveTo(target); },
      getLoc: (id) => getLoc(id),
      travelToDistrict: (districtId) => travelToDistrict(districtId),
    };
  }
  function runCommands(ev) {
    phase = PHASES.DIALOGUE;
    return Promise.resolve(Events.process(ev.commands, buildEventCtx(ev))).then(() => {
      phase = PHASES.EXPLORE;
      renderMap();
    });
  }

  // 触发当前地点的可触发事件（白天/夜晚按当前时段）
  function tryFireEvent() {
    syncFromState();
    const S = Engine.getState();
    const ev = typeof World !== 'undefined' && World.rollEvent(chapter, currentLoc, S.phase || 'day', S);
    if (!ev) return false;
    const done = S.doneScenes || {};
    // Events 命令事件（core/events.js 解释器执行 commands 序列）
    if (ev.commands && Array.isArray(ev.commands) && typeof Events !== 'undefined' && Events.process) {
      if (ev.once) done[ev.scene || ev.enemy || ev.id] = true;
      runCommands(ev);
      return true;
    }
    // 纯剧情事件立即标记 once；战斗事件延迟到胜利后再标记
    if (ev.once && !ev.enemy) done[ev.scene] = true;
    if (ev.enemy) {
      phase = PHASES.BATTLE;
      view.runBattle && view.runBattle(ev.enemy, async () => {
        phase = PHASES.EXPLORE;
        grantRewards(ev);
        if (ev.once) (S.doneScenes || {})[ev.scene || ev.enemy] = true;
        if (ev.next) { dialogueStack.push(ev.next); runDialogue(ev.next); }
        else renderMap();
      }, async () => {
        phase = PHASES.EXPLORE;
        if (S.hp <= 0) {
          S.hp = Math.round(S.maxHp * 0.4);
          S.sp = Math.round(S.maxSp * 0.3);
          S.deaths = (S.deaths || 0) + 1;
          view.log && view.log('你在战斗中倒下，退回了安全处（HP 已部分恢复）。');
        }
        renderMap();
      });
      return true;
    }
    if (ev.scene) {
      runDialogue(ev.scene);
      return true;
    }
    return false;
  }

  // 主动选择地点的某个事件（地图交互：玩家点地点内的"互动"）
  // evIdx 语义：若为有效数字且该索引存在则使用该事件；否则用 rollEvent 逻辑自动筛选可触发事件。
  function fireAt(locId, evIdx) {
    const loc = getLoc(locId);
    if (!loc) return;
    currentLoc = locId;
    syncFromState();
    const S = Engine.getState();
    const phaseName = S.phase || 'day';
    let ev = null;
    // 指定索引且存在 → 使用该事件（仍需过滤 when/cond/once）
    if (typeof evIdx === 'number' && Array.isArray(loc.events) && loc.events[evIdx]) {
      ev = loc.events[evIdx];
      if (ev.when && ev.when !== 'any' && ev.when !== phaseName) return;
      if (ev.cond && !evalCond(ev.cond, S)) { view.log && view.log('现在还不能这样做。'); return; }
      const done = S.doneScenes || {};
      if (ev.once && (ev.scene || ev.enemy) && done[ev.scene || ev.enemy]) return;
    } else {
      // 未指定或索引无效 → 自动筛选
      ev = typeof World !== 'undefined' && World.rollEvent(chapter, locId, phaseName, S);
      if (!ev) return;
    }
    const done = S.doneScenes || {};
    // Events 命令事件（core/events.js 解释器执行 commands 序列）
    if (ev.commands && Array.isArray(ev.commands) && typeof Events !== 'undefined' && Events.process) {
      runCommands(ev);
      return;
    }
    // 纯剧情事件立即标记 once；战斗事件延迟到胜利后再标记
    if (ev.once && !ev.enemy) done[ev.scene] = true;
    if (ev.enemy) {
      phase = PHASES.BATTLE;
      view.runBattle && view.runBattle(ev.enemy, async () => {
        phase = PHASES.EXPLORE;
        grantRewards(ev);
        if (ev.once) (S.doneScenes || {})[ev.scene || ev.enemy] = true;
        if (ev.next) runDialogue(ev.next); else renderMap();
      }, async () => {
        phase = PHASES.EXPLORE;
        if (S.hp <= 0) {
          S.hp = Math.round(S.maxHp * 0.4);
          S.sp = Math.round(S.maxSp * 0.3);
          S.deaths = (S.deaths || 0) + 1;
          view.log && view.log('你在战斗中倒下，退回了安全处（HP 已部分恢复）。');
        }
        renderMap();
      });
    } else if (ev.scene) {
      runDialogue(ev.scene);
    }
  }

  // ---- 对话链 ----
  // 剧情场景执行完（或到达返回地图节点）后回到地图。
  // 接受可选 onDone 回调：若传入，则由外部控制何时 endDialogue（解决长场景链 .then 过早触发的问题）；
  // 若不传，保持旧行为兜底。
  function runDialogue(sceneId, onDone) {
    phase = PHASES.DIALOGUE;
    dialogueStack.push(sceneId);
    if (typeof onDone === 'function') {
      Promise.resolve(view.runStory && view.runStory(sceneId)).then(() => { onDone(); });
    } else {
      Promise.resolve(view.runStory && view.runStory(sceneId)).then(() => {
        if (phase === PHASES.DIALOGUE) endDialogue();
      });
    }
  }

  // 结束对话，返回地图
  function endDialogue() {
    phase = PHASES.EXPLORE;
    dialogueStack = [];
    renderMap();
  }

  function goto(sceneId) {
    return Promise.resolve(view.runStory ? view.runStory(sceneId) : undefined);
  }

  // ---- 日程 ----
  function passTime() {
    syncFromState();
    const S = Engine.getState();
    const res = typeof DayCycle !== 'undefined' && DayCycle.advance(S);
    Engine.setState(S);
    Engine.autoSave();
    // 状态恢复：夜晚恢复 25%，次日白天恢复 60%
    if (res) {
      if (res.to === 'night') {
        S.hp = Math.min(S.hp + Math.round(S.maxHp * 0.25), S.maxHp);
        S.sp = Math.min(S.sp + Math.round(S.maxSp * 0.25), S.maxSp);
      } else if (res.to === 'day') {
        S.hp = Math.min(S.hp + Math.round(S.maxHp * 0.6), S.maxHp);
        S.sp = Math.min(S.sp + Math.round(S.maxSp * 0.6), S.maxSp);
      }
    }
    view.log && view.log(`已到${res && res.to === 'day' ? '第 ' + res.day + ' 天 · 白天' : '夜晚'}。`);
    // 主线可推进提示
    if (S.chapter && S.dayCounters && S.dayCounters[S.chapter] >= 1) {
      view.log && view.log('主线似乎已经可以推进了。');
    }
    renderMap();
    tryFireEvent();
    return res;
  }

  // ---- 渲染 ----
  function renderMap() {
    syncFromState();
    const S = Engine.getState();
    const map = (typeof World !== 'undefined' && World.getMap(chapter)) || [];
    const dayInfo = { day: S.day, phase: S.phase, ap: S.ap };
    view.showHud && view.showHud();
    view.renderMap && view.renderMap(map, currentLoc, dayInfo);
  }

  function returnToMap() {
    phase = PHASES.EXPLORE;
    dialogueStack = [];
    renderMap();
  }

  return {
    PHASES,
    register, setChapter, getChapter, getPhase, setPhase,
    explore, moveTo, travelToDistrict, getCurrentDistrict,
    tryFireEvent, fireAt, runDialogue, endDialogue, goto,
    passTime, renderMap, returnToMap, getCurrentLoc, getLoc, syncFromState,
  };
})();

if (typeof window !== 'undefined') window.Game = Game;
if (typeof module !== 'undefined' && module.exports) module.exports = Game;