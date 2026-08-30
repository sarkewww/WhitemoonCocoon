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
  function getLoc(id) { return World.getLocation(chapter, id); }

  // ---- 探索入口 ----
  // 进入某章节的地图探索。locId 缺省取地图首节点。
  function explore(c, locId) {
    chapter = c;
    const S = Engine.getState();
    S.chapter = c;
    DayCycle.ensure(S);
    const map = World.getMap(c);
    if (!map.length) { view.log && view.log('该章节暂无地图'); return; }
    currentLoc = locId || map[0].id;
    phase = PHASES.EXPLORE;
    renderMap();
  }

  // 移动到相邻地点
  function moveTo(locId) {
    const S = Engine.getState();
    if (currentLoc && !World.getReachable(chapter, currentLoc).some(l => l.id === locId)) {
      view.log && view.log('无法到达该地点。');
      return;
    }
    currentLoc = locId;
    renderMap();
    // 移动后尝试触发地点事件
    tryFireEvent();
  }

  // 触发当前地点的可触发事件（白天/夜晚按当前时段）
  function tryFireEvent() {
    const S = Engine.getState();
    const ev = World.rollEvent(chapter, currentLoc, S.phase || 'day', S);
    if (!ev) return false;
    // 战斗事件
    if (ev.enemy) {
      phase = PHASES.BATTLE;
      const done = (S.doneScenes || {});
      if (ev.once) done[ev.scene || ev.enemy] = true;
      view.runBattle && view.runBattle(ev.enemy, async () => {
        phase = PHASES.EXPLORE;
        if (ev.next) { dialogueStack.push(ev.next); runDialogue(ev.next); }
        else renderMap();
      }, async () => {
        phase = PHASES.EXPLORE;
        renderMap();
      });
      return true;
    }
    // 剧情事件
    if (ev.scene) {
      const done = (S.doneScenes || {});
      if (ev.once) done[ev.scene] = true;
      runDialogue(ev.scene);
      return true;
    }
    return false;
  }

  // 主动选择地点的某个事件（地图交互：玩家点地点内的"互动"）
  function fireAt(locId, evIdx = 0) {
    const loc = getLoc(locId);
    if (!loc) return;
    currentLoc = locId;
    const S = Engine.getState();
    const ev = loc.events[evIdx];
    if (!ev) return;
    if (ev.cond && !ev.cond(S)) { view.log && view.log('现在还不能这样做。'); return; }
    const done = (S.doneScenes || {});
    if (ev.once) done[ev.scene || ev.enemy] = true;
    if (ev.enemy) {
      phase = PHASES.BATTLE;
      view.runBattle && view.runBattle(ev.enemy, async () => {
        phase = PHASES.EXPLORE;
        if (ev.next) runDialogue(ev.next); else renderMap();
      }, async () => {
        phase = PHASES.EXPLORE;
        renderMap();
      });
    } else if (ev.scene) {
      runDialogue(ev.scene);
    }
  }

  // ---- 对话链 ----
  // 剧情场景执行完（或到达返回地图节点）后回到地图。
  function runDialogue(sceneId) {
    phase = PHASES.DIALOGUE;
    dialogueStack.push(sceneId);
    Promise.resolve(view.runStory && view.runStory(sceneId)).then(() => {
      if (phase === PHASES.DIALOGUE) {
        phase = PHASES.EXPLORE;
        dialogueStack = [];
        renderMap();
      }
    });
  }

  function goto(sceneId) {
    return Promise.resolve(view.runStory ? view.runStory(sceneId) : undefined);
  }

  // ---- 日程 ----
  function passTime() { // 白天->夜晚->次日
    const S = Engine.getState();
    const res = DayCycle.advance(S);
    Engine.setState(S);
    Engine.autoSave();
    view.log && view.log(`已到${res.to === 'day' ? '第 ' + res.day + ' 天 · 白天' : '夜晚'}。`);
    renderMap();
    // 进入夜晚/次日尝试触发主线或当前地点事件
    tryFireEvent();
    return res;
  }

  // ---- 渲染 ----
  function renderMap() {
    const S = Engine.getState();
    const map = World.getMap(chapter);
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
    explore, moveTo, tryFireEvent, fireAt, runDialogue, goto,
    passTime, renderMap, returnToMap, getCurrentLoc, getLoc,
  };
})();

if (typeof window !== 'undefined') window.Game = Game;
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
