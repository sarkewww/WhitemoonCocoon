/* =========================================================
 * 白月茧响 - 主控制器（UI 模块接线层）
 * 全部交互 UI 交由 ui/* 模块（dialogue / map / battle / menu），
 * 本文件仅保留：DOM 收集、各 UI 模块 init 注入、跨模块 hooks 提供、
 * 指令处理 handleCmd、轻触/滚动等通用工具，以及对外 App 公共 API。
 * ========================================================= */
'use strict';

const App = (() => {

  let bootEl, bootText, bootHint, bootLogo, gameEl, storyEl, storyText, choicesEl,
    battleEl, battleLogEl, battleMenu, enemyZone, playerZone, hudName, hudSub, hudChapter, hudTime,
    statusBox, savebar, cmd, dialogEl, dialogBox, endEl, endArt, endTitle, endSub, endStats,
    storyScroll, battleBars, arena,
    panelEl, panelBody, menuBtn, panelClose,
    mapEl, mapHead, mapCanvas, mapNodes, mapSvg, mapFoot, mapActions;

  // 自然融入：章节开头场景 → 对应章节地图（RPG 自由行动层）
  const CHAPTER_MAP_ENTRY = { 'chapter1_1': 1, 'chapter2_1': 2, 'chapter3_1': 3 };

  // ===== 对话引擎 stub（转发到 ui/dialogue.js） =====
  function runScene(id) { return DialogueUI.runScene(id); }
  function showDialog(msg) { DialogueUI.showDialog(msg); }
  function hideDialog() { DialogueUI.hideDialog(); }
  function showEnding(ending) { DialogueUI.showEnding(ending); }
  function scheduleEnding(ending) { DialogueUI.scheduleEnding(ending); }
  function wait(ms) { return DialogueUI.wait(ms); }
  function setTypeSpeed(ms) { DialogueUI.setTypeSpeed(ms); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  // ===== 菜单/启动/侧栏/通用 UI（转发到 ui/menu.js） =====
  function maxAPOf() { return MenuUI.maxAPOf(); }
  function showToast(msg, type) { return MenuUI.showToast(msg, type); }
  function flashAPBadge() { return MenuUI.flashAPBadge(); }
  function bootSequence() { return MenuUI.bootSequence(); }
  function showBoot() { return MenuUI.showBoot(); }
  function showTitle() { return MenuUI.showTitle(); }
  function showAbout() { return MenuUI.showAbout(); }
  function continueFromSavedScene(sceneId) { return MenuUI.continueFromSavedScene(sceneId); }
  function startNewGame(diff) { return MenuUI.startNewGame(diff); }
  function loadGame() { return MenuUI.loadGame(); }
  function startTimer() { return MenuUI.startTimer(); }
  function initHUD() { return MenuUI.initHUD(); }
  function renderStatus() { return MenuUI.renderStatus(); }
  function updateSidePanel(el) { return MenuUI.updateSidePanel(el); }
  function togglePanel(show) { return MenuUI.togglePanel(show); }
  function renderSaveBar() { return MenuUI.renderSaveBar(); }
  function updateHUD() { return MenuUI.updateHUD(); }
  function openModal() { return MenuUI.openModal(); }
  function guardFreePhase(what) { return MenuUI.guardFreePhase(what); }
  function showShopPanel() { return MenuUI.showShopPanel(); }
  function showEquipPanel() { return MenuUI.showEquipPanel(); }
  function continueMainline() { return MenuUI.continueMainline(); }
  function startExplore() { return MenuUI.startExplore(); }

  // ===== 地图 UI（转发到 ui/map.js） =====
  function descSummary(desc) { return MapUI.descSummary(desc); }
  function renderMapView(map, curLoc, dayInfo) { return MapUI.renderMapView(map, curLoc, dayInfo); }
  function onCurrentLocClick(loc) { return MapUI.onCurrentLocClick(loc); }
  function renderMapFoot(day, phaseName, ap) { return MapUI.renderMapFoot(day, phaseName, ap); }
  function initMapDrag() { return MapUI.initMapDrag(); }
  function suppressMapClickOnce() { return MapUI.suppressMapClickOnce(); }
  function showTravelPanel() { return MapUI.showTravelPanel(); }

  // ===== 战斗 UI（转发到 ui/battle.js） =====
  function showBattle() { return BattleUI.showBattle(); }
  function renderBattleBars() { return BattleUI.renderBattleBars(); }
  function setCombo(n) { return BattleUI.setCombo(n); }
  function setEnemySprite(enemy) { return BattleUI.setEnemySprite(enemy); }
  function updateEnemyBar(enemy) { return BattleUI.updateEnemyBar(enemy); }
  function updateBattleState() { return BattleUI.updateBattleState(); }
  function battleLog(msg, cls) { return BattleUI.battleLog(msg, cls); }
  function getActionList() { return BattleUI.getActionList(); }
  function promptAction(enemy) { return BattleUI.promptAction(enemy); }
  function promptItem() { return BattleUI.promptItem(); }
  function setTurnActive(cb) { return BattleUI.setTurnActive(cb); }
  function enemyEl() { return BattleUI.enemyEl(); }
  function playerEl() { return BattleUI.playerEl(); }
  function shakeEnemy(hard) { return BattleUI.shakeEnemy(hard); }
  function shakePlayer() { return BattleUI.shakePlayer(); }
  function shakeHard() { return BattleUI.shakeHard(); }
  function flashCrit() { return BattleUI.flashCrit(); }
  function transformFlash() { return BattleUI.transformFlash(); }
  function pulseEro() { return BattleUI.pulseEro(); }
  function startBattle(cfg) { return BattleUI.startBattle(cfg); }
  function dieAndRetry() { return BattleUI.dieAndRetry(); }
  function showDeathMenu() { return BattleUI.showDeathMenu(); }
  function withRetryEnemy(enemy) { return BattleUI.withRetryEnemy(enemy); }

  // ===== 轻触检测：区分"点击"与"滑动" =====
  // 手机滑动（起点也是 pointerdown）不再被误判为跳过；
  // 且不调用 preventDefault，让原生滚动正常工作。
  let _tap = { active:false, pid:-1, x:0, y:0, t:0 };
  function registerTap(cb, opts={}) {
    const { within=null, threshold=12, maxMs=650 } = opts;
    const onDown = (e) => {
      if (within && e.target && !within.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('button, input, a, textarea, select, .choice-btn, .map-node, .map-btn, .save-btn, .hud-btn, .panel-close, .title-btn, .end-btn')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      _tap = { active:true, pid:e.pointerId, x:e.clientX, y:e.clientY, t:Date.now() };
    };
    const onUp = (e) => {
      if (!_tap.active || e.pointerId !== _tap.pid) return;
      _tap.active = false;
      const dist = Math.abs(e.clientX - _tap.x) + Math.abs(e.clientY - _tap.y);
      if (dist < threshold && Date.now() - _tap.t < maxMs) cb(e);
    };
    const onCancel = () => { _tap.active = false; };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
  }

  // 跟随滚动：仅在用户靠近底部时自动滚到底，避免打字时上滑被拽回
  function followBottom() {
    const sc = storyScroll;
    if (!sc) return;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 48) {
      sc.scrollTop = sc.scrollHeight;
    }
  }

  function init() {
    bootEl = document.getElementById('boot');
    bootLogo = document.getElementById('bootLogo');
    bootText = document.getElementById('bootText');
    bootHint = document.getElementById('bootHint');
    gameEl = document.getElementById('game');
    storyEl = document.getElementById('story');
    storyText = document.getElementById('storyText');
    choicesEl = document.getElementById('choices');
    battleEl = document.getElementById('battle');
    battleLogEl = document.getElementById('battleLog');
    battleMenu = document.getElementById('battleMenu');
    enemyZone = document.getElementById('enemyZone');
    playerZone = document.getElementById('playerZone');
    hudName = document.getElementById('hudName');
    hudSub = document.getElementById('hudSub');
    hudChapter = document.getElementById('hudChapter');
    hudTime = document.getElementById('hudTime');
    statusBox = document.getElementById('statusBox');
    savebar = document.getElementById('savebar');
    cmd = document.getElementById('cmd');
    dialogEl = document.getElementById('dialog');
    dialogBox = document.getElementById('dialogBox');
    endEl = document.getElementById('end');
    endArt = document.getElementById('endArt');
    endTitle = document.getElementById('endTitle');
    endSub = document.getElementById('endSub');
    endStats = document.getElementById('endStats');
    storyScroll = document.getElementById('storyScroll');
    battleBars = document.getElementById('battleBars');
    arena = document.getElementById('arena');
    panelEl = document.getElementById('panel');
    panelBody = document.getElementById('panelBody');
    menuBtn = document.getElementById('menuBtn');
    panelClose = document.getElementById('panelClose');
    mapEl = document.getElementById('map');
    mapHead = document.getElementById('mapHead');
    mapCanvas = document.getElementById('mapCanvas');
    mapNodes = document.getElementById('mapNodes');
    mapSvg = document.getElementById('mapSvg');
    mapFoot = document.getElementById('mapFoot');
    mapActions = document.getElementById('mapActions') || null;

    // ===== 任务栏（quest）接线（防御：ui/quest.js 可能尚未就绪，跳过不崩） =====
    const QUI = (typeof window !== 'undefined' && window.QuestUI) || null;
    const showQuestPanel = (QUI && typeof QUI.showQuestPanel === 'function')
      ? () => QUI.showQuestPanel()
      : null;
    if (QUI && typeof QUI.init === 'function') {
      QUI.init({
        dom: { panelEl, panelBody, mapEl, storyEl, hudChapter, hudTime, statusBox },
        hooks: {
          updateHUD,
          renderStatus,
          showToast,
          showDialog,
          esc,
          getDeadlines: (S) => (typeof Game !== 'undefined' && typeof Game.getDeadlines === 'function') ? Game.getDeadlines(S) : null,
        },
      });
    }

    // 存档槽位 hooks（防御：多槽接口可能尚未就绪，缺失则不注入）
    const saveHooks = {};
    if (typeof Engine !== 'undefined') {
      if (typeof Engine.listSaves === 'function') saveHooks.listSaves = () => Engine.listSaves();
      if (typeof Engine.saveToSlot === 'function') saveHooks.saveToSlot = (n) => Engine.saveToSlot(n);
      if (typeof Engine.loadFromSlot === 'function') saveHooks.loadFromSlot = (n) => Engine.loadFromSlot(n);
      if (typeof Engine.deleteSlot === 'function') saveHooks.deleteSlot = (n) => Engine.deleteSlot(n);
      if (typeof Engine.hasAnySave === 'function') saveHooks.hasAnySave = () => Engine.hasAnySave();
      if (typeof Engine.fmtSavedAt === 'function') saveHooks.fmtSavedAt = (ms) => Engine.fmtSavedAt(ms);
    }

    // 注入对话渲染模块（DOM + hooks）
    DialogueUI.init({
      dom: {
        storyEl, storyText, choicesEl, storyScroll, battleEl, mapEl,
        dialogEl, dialogBox, gameEl, endEl, endArt, endTitle, endSub, endStats,
      },
      hooks: {
        startBattle,
        followBottom,
        updateHUD,
        withRetryEnemy,
        dieAndRetry,
        esc,
        registerTap,
        CHAPTER_MAP_ENTRY,
        clearTimerInterval: () => MenuUI.clearTimer(),
      },
    });

    // 注入地图渲染模块（DOM + hooks）
    MapUI.init({
      dom: { mapEl, mapHead, mapCanvas, mapNodes, mapSvg, mapFoot, battleEl, storyEl },
      hooks: {
        maxAPOf,
        showToast,
        flashAPBadge,
        esc,
        continueMainline,
        guardFreePhase,
        showShopPanel,
        showEquipPanel,
        showDialog,
        showQuestPanel,
      },
    });

    // 注入战斗 UI 模块（DOM + hooks）
    BattleUI.init({
      dom: {
        battleEl, storyEl, choicesEl, storyText, battleBars, arena,
        battleLogEl, battleMenu, enemyZone, playerZone, storyScroll,
      },
      hooks: {
        showDialog,
        hideDialog,
        runScene,
        loadGame,
        showTitle,
        updateHUD,
      },
    });

    // 注入菜单/启动 UI 模块（DOM + hooks）
    MenuUI.init({
      dom: {
        bootEl, bootLogo, bootText, bootHint, gameEl, storyEl,
        hudName, hudSub, hudChapter, hudTime,
        statusBox, savebar, endEl, endArt, endTitle, endSub, endStats,
        panelEl, panelBody, mapEl,
      },
      hooks: {
        runScene,
        DialogueUI,
        startBattle,
        renderMapView,
        startNewGame,
        loadGame,
        showTitle,
        showQuestPanel,
        showDailyPanel: () => (typeof MenuUI !== 'undefined' && typeof MenuUI.showDailyPanel === 'function')
          ? MenuUI.showDailyPanel()
          : null,
        goToActivity: (id) => (typeof MenuUI !== 'undefined' && typeof MenuUI.goToActivity === 'function')
          ? MenuUI.goToActivity(id)
          : null,
        getDeadlines: (S) => (typeof Game !== 'undefined' && typeof Game.getDeadlines === 'function') ? Game.getDeadlines(S) : null,
        ...saveHooks,
      },
    });

    initMapDrag();

    if (typeof Game !== 'undefined' && Game.register) {
      Game.register({
        renderMap: (map, curLoc, dayInfo) => {
          // 防御：进入章节时注册该章死任务（core/game.js explore 亦会调用；此处兜底其他入口）
          if (typeof Game.registerChapterDeadlines === 'function' && typeof Game.getChapter === 'function') {
            Game.registerChapterDeadlines(Game.getChapter());
          }
          renderMapView(map, curLoc, dayInfo);
        },
        runStory: (sceneId) => runScene(sceneId),
        runBattle: (enemyId, onWin, onLose) => startBattle({ enemy: enemyId, onWin, onLose }),
        showHud: () => updateHUD(),
        log: (msg) => showDialog(msg),
      });
    }

    Battle.FX.init();
    Engine.setG(Battle);

    // 手机菜单面板
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(true);
    });
    panelClose.addEventListener('click', () => togglePanel(false));
    document.addEventListener('pointerdown', (e) => {
      if (panelEl && !panelEl.classList.contains('hidden')) {
        if (!panelEl.contains(e.target)) togglePanel(false);
      }
    });

    // 输入栏
    cmd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = cmd.value.trim().toLowerCase();
        cmd.value = '';
        handleCmd(v);
      }
    });

    // 存档按钮
    document.getElementById('endRestart').addEventListener('click', () => startNewGame());
    document.getElementById('endTitleBtn').addEventListener('click', () => showBoot());

    // 杭州化文案：文档标题读取 GameContent（不存在则保持 HTML 静态标题）
    const GC = (typeof window !== 'undefined' && window.GameContent) || null;
    if (GC && GC.appTitle && document && document.title) document.title = GC.appTitle;

    // 初始启动
    bootSequence();
  }

  // ===== 指令处理 =====
  function handleCmd(v) {
    if (v === 'save') { Engine.autoSave(); showDialog('存档已保存。'); }
    else if (v === 'load') { if (Engine.hasAuto()) { Engine.loadAuto(); DialogueUI.choiceLock = false; if (!continueFromSavedScene(Engine.getState().scene)) { runScene(Engine.getState().scene); } showDialog('读档完成。'); } else { showDialog('没有存档。'); } }
    else if (v === 'status') { renderStatus(); showDialog('状态已更新。'); }
    else if (v === 'help') { showDialog('指令: save(存档) load(读档) status(状态) help(帮助)'); }
    else if (v === 'clear') { storyText.innerHTML = ''; }
    else { showDialog('未知指令: ' + v + ' (输入 help 查看帮助)'); }
  }

  return { init, runScene, startBattle, showBattle, battleLog, promptAction, promptItem, setTurnActive, getActionList,
    enemyEl, playerEl, shakeEnemy, shakePlayer, shakeHard, flashCrit, transformFlash, pulseEro,
    setCombo, setEnemySprite, updateEnemyBar, renderBattleBars, updateBattleState, dieAndRetry,
    showDialog, hideDialog, showEnding, scheduleEnding, wait, updateHUD, renderStatus, updateSidePanel, setTypeSpeed };
})();

if (typeof window !== 'undefined') window.App = App;

// ---- 启动 ----
document.addEventListener('DOMContentLoaded', () => App.init());
