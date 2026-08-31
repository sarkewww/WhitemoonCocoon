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

  // 每日可重复触发事件上限（once:false 的重复战斗/事件防刷）
  const DAILY_EVENT_LIMIT = 2;
  // 各章节主线起点场景
  const MAINLINE_START = { 1: 'chapter1_1', 2: 'chapter2_1', 3: 'chapter3_1' };
  // 主线推进断点序列（每段推进一步，到达断点后回地图）。
  // 末段无强制断点，自然推进到章末地图入口（CHAPTER_MAP_ENTRY 拦截 chapterX_1）。
  const MAINLINE_STEPS = {
    1: ['chapter1_4', 'chapter1_8', 'chapter1_12'],
    2: ['chapter2_4', 'chapter2_8', 'ch2_gate_1'],
    3: ['chapter3_5', 'chapter3_7', 'chapter3_9'],
  };
  // 主线推进边界标志（runScene 遇边界场景后停止自动连播，返回地图）
  let mainlineBoundary = null;

  function register(v) { Object.assign(view, v); }

  // ---- 章节/地图 ----
  function setChapter(c) { chapter = c; }
  function getChapter() { return chapter; }
  function getPhase() { return phase; }
  function setPhase(p) { phase = p; }
  function getCurrentLoc() { return currentLoc; }
  function getLoc(id) { return typeof World !== 'undefined' && World.getLocation(chapter, id); }

  // ---- AP 消耗与重复事件限量（统一 helper）----
  // 按事件类型扣 AP：战斗 fight，对话/支线/命令序列 chat。失败返回 false。
  function chargeForEvent(S, ev) {
    if (typeof DayCycle === 'undefined' || !DayCycle.spend) return true;
    const action = ev && ev.enemy ? 'fight' : 'chat';
    if (!DayCycle.spend(S, action)) {
      view.log && view.log('行动点不足，无法触发。');
      return false;
    }
    return true;
  }

  // once:false 的重复事件每日限量（once:true 一次性事件不限制）。
  function eventLimitOK(S, ev) {
    if (!ev || ev.once) return { ok: true };
    const id = ev.id || ev.scene || ev.enemy;
    if (!id) return { ok: true };
    const st = (typeof DayCycle !== 'undefined' && DayCycle.canTriggerEvent)
      ? DayCycle.canTriggerEvent(S, id, DAILY_EVENT_LIMIT)
      : { ok: true, count: 0, limit: DAILY_EVENT_LIMIT, remaining: DAILY_EVENT_LIMIT };
    if (!st.ok) view.log && view.log('这里的状况今天已经熟悉了（今日已遭遇 ' + st.count + '/' + st.limit + ' 次）。');
    return st;
  }

  // once:false 事件触发成功后记账（按事件 id，跨日自动重置）。
  function recordEventCount(S, ev) {
    if (!ev || ev.once) return;
    const id = ev.id || ev.scene || ev.enemy;
    if (id && typeof DayCycle !== 'undefined' && DayCycle.recordEvent) DayCycle.recordEvent(S, id);
  }

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
        return false;
      }
    }
    // 移动消耗行动点（COST.explore=1），不足则保持原地
    if (typeof DayCycle !== 'undefined' && DayCycle.spend) {
      if (!DayCycle.spend(S, 'explore')) {
        view.log && view.log('行动点不足，无法移动。');
        return false;
      }
    }
    currentLoc = locId;
    renderMap();
    // 移动后尝试触发地点事件（移动与事件合一扣 1 AP，事件不再额外扣）
    tryFireEvent({ bundled: true });
    return true;
  }

  // 从车站前往其他区域（Persona 式区域交通）
  // 前提：当前必须在车站；消耗 1 行动点后传送到目标区域入口节点。
  function travelToDistrict(districtId) {
    if (currentLoc !== 'station') {
      view.log && view.log('需要先到达车站才能前往其他区域');
      return false;
    }
    const locs = typeof World !== 'undefined' && World.getLocationsInDistrict(chapter, districtId);
    if (!locs || !locs.length) {
      view.log && view.log('该区域还没有可到达的地点');
      return false;
    }
    const S = typeof Engine !== 'undefined' && Engine.getState();
    if (typeof DayCycle !== 'undefined') {
      if (!DayCycle.spend(S, 'travel')) {
        view.log && view.log('行动点不足');
        return false;
      }
    }
    const entry = locs[0];
    currentLoc = typeof entry === 'string' ? entry : entry.id;
    renderMap();
    // 抵达后尝试触发入口节点事件（交通与事件合一扣 1 AP，事件不再额外扣）
    tryFireEvent({ bundled: true });
    return true;
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
  // opts.bundled=true：由 moveTo/travelToDistrict 触发的"抵达事件"，
  // 移动/交通已扣 1 AP（explore/travel），该事件不再额外扣（移动与事件合一扣 1 AP）。
  function tryFireEvent(opts) {
    syncFromState();
    const S = Engine.getState();
    const ev = typeof World !== 'undefined' && World.rollEvent(chapter, currentLoc, S.phase || 'day', S);
    if (!ev) return false;
    // 每日限量：once:false 的重复事件超限则不触发
    if (!eventLimitOK(S, ev).ok) return false;
    // 触发事件消耗行动点（战斗 fight / 对话支线 chat）；bundled 抵达事件不再额外扣
    if (!(opts && opts.bundled) && !chargeForEvent(S, ev)) return false;
    // once:false 事件每日限量记账（对话/命令/战斗通用）
    recordEventCount(S, ev);
    // 支线事件 flag：触发即置位，与主线菜单共享同一防重开关
    if (ev.flag) S.flags[ev.flag] = true;
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
    if (!loc) return false;
    currentLoc = locId;
    syncFromState();
    const S = Engine.getState();
    const phaseName = S.phase || 'day';
    let ev = null;
    // 指定索引且存在 → 使用该事件（仍需过滤 when/cond/once）
    if (typeof evIdx === 'number' && Array.isArray(loc.events) && loc.events[evIdx]) {
      ev = loc.events[evIdx];
      if (ev.when && ev.when !== 'any' && ev.when !== phaseName) return false;
      if (ev.cond && !evalCond(ev.cond, S)) { view.log && view.log('现在还不能这样做。'); return false; }
      const done = S.doneScenes || {};
      if (ev.once && (ev.scene || ev.enemy) && done[ev.scene || ev.enemy]) return false;
    } else {
      // 未指定或索引无效 → 自动筛选
      ev = typeof World !== 'undefined' && World.rollEvent(chapter, locId, phaseName, S);
      if (!ev) return false;
    }
    // 每日限量：once:false 的重复事件超限则不触发
    if (!eventLimitOK(S, ev).ok) return false;
    // 触发事件消耗行动点（战斗 fight / 对话支线 chat）
    if (!chargeForEvent(S, ev)) return false;
    // once:false 事件每日限量记账（对话/命令/战斗通用）
    recordEventCount(S, ev);
    // 支线事件 flag：触发即置位，与主线菜单共享同一防重开关
    if (ev.flag) S.flags[ev.flag] = true;
    const done = S.doneScenes || {};
    // Events 命令事件（core/events.js 解释器执行 commands 序列）
    if (ev.commands && Array.isArray(ev.commands) && typeof Events !== 'undefined' && Events.process) {
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
      return true;
    } else if (ev.scene) {
      runDialogue(ev.scene);
      return true;
    }
    return false;
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

  // 主线进门状态初始化（兜底旧存档/engine.js migrateState 未覆盖的字段）
  function ensureMainline(S) {
    if (!S.mainline || typeof S.mainline !== 'object' || Array.isArray(S.mainline)) S.mainline = {};
    return S.mainline;
  }

  // 主线推进边界管理
  function setMainlineBoundary(sceneId) { mainlineBoundary = sceneId || null; }
  function isMainlineBoundary(sceneId) { return !!mainlineBoundary && sceneId === mainlineBoundary; }
  function clearMainlineBoundary() { mainlineBoundary = null; }

  // 获取当前主线进度（场景 id）
  function getMainlineProgress(chapter) {
    const S = Engine.getState();
    ensureMainline(S);
    return S.mainline[chapter] || null;
  }

  // 沿主线场景链获取下一场景（用于断点后恢复起点）
  function nextMainlineScene(sceneId) {
    if (typeof Story === 'undefined' || !Story.get) return null;
    const sc = Story.get(sceneId);
    if (!sc) return null;
    if (sc.next) return sc.next;
    if (sc.choices && sc.choices.length) {
      const choices = typeof sc.choices === 'function' ? sc.choices() : sc.choices;
      if (choices[0] && choices[0].next) return choices[0].next;
    }
    if (sc.battle && sc.battle.next) return sc.battle.next;
    return null;
  }

  // 推进到下一步所需章内天数 = 下一步索引 + 1（每步需多待一天，门槛逐步生效）
  function mainlineStepRequireDays(chapter) {
    const S = Engine.getState();
    const prog = S.mainline || {};
    const steps = MAINLINE_STEPS[chapter] || [];
    const cur = prog[chapter];
    let idx = steps.indexOf(cur);
    if (idx < 0) idx = -1;
    return idx + 2; // 第一步(nextIdx=0)需 1 天
  }

  // ---- 日程 ----
  // 主线是否解锁：基于章内已过天数（dayCounters[chapter] >= requireDays）。
  // 返回 { unlocked, chapter, requireDays, currentDays, need }；need 为还需经过的天数。
  function isMainlineUnlocked(chapter, requireDays) {
    syncFromState();
    const S = Engine.getState();
    const ch = typeof chapter === 'number' ? chapter : S.chapter;
    const req = (typeof requireDays === 'number' && requireDays >= 0) ? requireDays : 1;
    const current = (typeof DayCycle !== 'undefined' && DayCycle.chapterDays)
      ? DayCycle.chapterDays(S, ch)
      : ((S.dayCounters && S.dayCounters[ch]) || 0);
    const unlocked = current >= req;
    return { unlocked, chapter: ch, requireDays: req, currentDays: current, need: Math.max(0, req - current) };
  }

  // 主线门槛（含渐进天数）：供 UI/continueMainline 在调用 advanceMainline 前判断
  function getMainlineGate(chapter) {
    const ch = typeof chapter === 'number' ? chapter : (Engine.getState().chapter || 0);
    const S = Engine.getState();
    ensureMainline(S);
    const req = mainlineStepRequireDays(ch);
    return isMainlineUnlocked(ch, req);
  }

  // 主线推进入口：每次推进一段（从上次进度到下一断点），到达断点后回地图。
  // 未到天数门槛时返回未解锁状态，不硬崩溃。
  function advanceMainline(chapter, requireDays) {
    const st = isMainlineUnlocked(chapter, requireDays);
    if (!st.unlocked) {
      view.log && view.log('主线尚未解锁：本日行程还需 ' + st.need + ' 天才可推进。');
      return st;
    }
    const ch = st.chapter;
    const S = Engine.getState();
    ensureMainline(S);
    const steps = MAINLINE_STEPS[ch] || [];
    const start = MAINLINE_START[ch];
    if (!steps.length) {
      // 无断点定义的章节：保持旧行为从起点播放
      if (!start) { view.log && view.log('该章节还没有主线剧情。'); return Object.assign({}, st, { scene: null }); }
      S.mainline[ch] = S.mainline[ch] || start;
      runDialogue(start);
      return Object.assign({}, st, { scene: start });
    }
    const cur = S.mainline[ch];
    let completedIdx = cur ? steps.indexOf(cur) : -1; // 上次完成的断点索引，-1 = 未开始
    const nextIdx = completedIdx + 1;                 // 本段推进到的断点索引
    if (nextIdx >= steps.length) {
      view.log && view.log('本章主线已全部推进完毕。');
      return Object.assign({}, st, { scene: null, completed: true, progress: cur || steps[steps.length - 1] });
    }
    const target = steps[nextIdx];                     // 本段的目标断点场景
    const isLastSegment = (nextIdx === steps.length - 1);
    // 本段起点：首次从章起点；否则从上一断点的下一场景继续
    const startScene = completedIdx >= 0
      ? (nextMainlineScene(steps[completedIdx]) || steps[completedIdx])
      : MAINLINE_START[ch];
    if (!startScene) {
      view.log && view.log('该章节还没有主线剧情。');
      return Object.assign({}, st, { scene: null });
    }
    // 记录进度到目标断点；末段记录断言即可（之后自然走到章末地图入口）
    S.mainline[ch] = target;
    setMainlineBoundary(isLastSegment ? null : target);
    runDialogue(startScene);
    return Object.assign({}, st, { scene: startScene, progress: target, completed: false });
  }

  function passTime() {
    syncFromState();
    const S = Engine.getState();
    const res = typeof DayCycle !== 'undefined' && DayCycle.advance(S);
    // 每日休息次数用尽：不推进、不回血，返回受限信息供 UI 提示
    if (res && res.ok === false) {
      Engine.setState(S);
      Engine.autoSave();
      view.log && view.log(`今日已休息 ${res.limit} 次，无法继续推进时段（明天再来）。`);
      return res;
    }
    Engine.setState(S);
    Engine.autoSave();
    // 状态恢复（削减）：夜晚恢复 10%，次日白天恢复 20%
    if (res) {
      if (res.to === 'night') {
        S.hp = Math.min(S.hp + Math.round(S.maxHp * 0.1), S.maxHp);
        S.sp = Math.min(S.sp + Math.round(S.maxSp * 0.1), S.maxSp);
      } else if (res.to === 'day') {
        S.hp = Math.min(S.hp + Math.round(S.maxHp * 0.2), S.maxHp);
        S.sp = Math.min(S.sp + Math.round(S.maxSp * 0.2), S.maxSp);
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
    isMainlineUnlocked, advanceMainline,
    ensureMainline, getMainlineProgress, nextMainlineScene,
    setMainlineBoundary, isMainlineBoundary, clearMainlineBoundary,
    mainlineStepRequireDays, getMainlineGate,
  };
})();

if (typeof window !== 'undefined') window.Game = Game;
if (typeof module !== 'undefined' && module.exports) module.exports = Game;