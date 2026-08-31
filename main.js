/* =========================================================
 * 白月茧响 - 主控制器
 * ========================================================= */
'use strict';

const App = (() => {

  let bootEl, bootText, bootHint, bootLogo, gameEl, storyEl, storyText, choicesEl,
    battleEl, battleLogEl, battleMenu, enemyZone, playerZone, hudName, hudSub, hudChapter, hudTime,
    statusBox, savebar, cmd, dialogEl, dialogBox, endEl, endArt, endTitle, endSub, endStats,
    storyScroll, battleBars, arena,
    panelEl, panelBody, menuBtn, panelClose,
    mapEl, mapHead, mapCanvas, mapNodes, mapSvg, mapFoot, mapActions;

  let sceneQueue = [];
  let turnCallback = null;
  let battleCtx = null;
  let timer = 0;
  let timerInterval = null;
  let typing = false;
  let choiceLock = false;
  let currentSceneId = '';
  let comboCount = 0;
  let textSkip = false;
  let endTimer = null;
  let _mapDrag = null;
  let _toastTimer = null;

  // 自然融入：章节开头场景 → 对应章节地图（RPG 自由行动层）
  const CHAPTER_MAP_ENTRY = { 'chapter1_1': 1, 'chapter2_1': 2, 'chapter3_1': 3 };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  // 当前时段行动点上限（DAY_AP=2 / NIGHT_AP=1，取 DayCycle 权威值）
  function maxAPOf() {
    const S = Engine.getState();
    if (typeof DayCycle !== 'undefined' && DayCycle.maxAP) return DayCycle.maxAP(S);
    return (S && S.phase === 'night') ? 1 : 2;
  }

  // 顶部 toast 提示：不阻塞操作的短暂反馈（AP 不足 / 每日限量 / 主线未解锁等）
  function showToast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast hidden';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.classList.remove('hidden');
    el.classList.remove('toast-show');
    void el.offsetWidth;
    el.classList.add('toast-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove('toast-show');
      setTimeout(() => el.classList.add('hidden'), 350);
    }, 2400);
  }

  // 地图行动点徽章闪烁（AP 不足/耗尽时的视觉警示）
  function flashAPBadge() {
    const badge = document.getElementById('mapApBadge');
    if (!badge) return;
    badge.classList.remove('ap-flash');
    void badge.offsetWidth;
    badge.classList.add('ap-flash');
  }

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

    initMapDrag();

    if (typeof Game !== 'undefined' && Game.register) {
      Game.register({
        renderMap: (map, curLoc, dayInfo) => renderMapView(map, curLoc, dayInfo),
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

    // 初始启动
    bootSequence();
  }

  // ===== 启动画面 =====
  async function bootSequence() {
    bootEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    endEl.classList.add('hidden');

    const logo = [
      '╔══════════════════════════════════════════════╗',
      '║                                              ║',
      '║     ██╗  ██╗██╗   ██╗███████╗               ║',
      '║     ██║  ██║╚██╗ ██╔╝██╔════╝               ║',
      '║     ███████║ ╚████╔╝ █████╗                 ║',
      '║     ██╔══██║  ╚██╔╝  ██╔══╝                 ║',
      '║     ██║  ██║   ██║   ███████╗               ║',
      '║     ╚═╝  ╚═╝   ╚═╝   ╚══════╝               ║',
      '║                                              ║',
      '║           ███╗   ███╗ ██████╗                 ║',
      '║           ████╗ ████║██╔════╝                 ║',
      '║           ██╔████╔██║██║  ███╗                ║',
      '║           ██║╚██╔╝██║██║   ██║                ║',
      '║           ██║ ╚═╝ ██║╚██████╔╝                ║',
      '║           ╚═╝     ╚═╝ ╚═════╝                 ║',
      '║                                              ║',
      '║             白  月  茧  响                    ║',
      '║              ──── ◆ ────                      ║',
      '║        White Moon · Cocoon                    ║',
      '║                                              ║',
      '╚══════════════════════════════════════════════╝',
    ];
    bootLogo.textContent = logo.join('\n');

    const by = '> 夜见市 · 星历 2026';
    for (let i=0; i<=by.length; i++) {
      bootText.textContent = by.substring(0, i);
      await wait(50);
    }
    await wait(600);
    bootHint.textContent = '按 Enter 或 点击 开始';

    const handler = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      bootHint.textContent = '';
      document.removeEventListener('keydown', handler);
      bootEl.removeEventListener('click', handler);
      showTitle();
    };
    document.addEventListener('keydown', handler);
    bootEl.addEventListener('click', handler);
  }

  function showBoot() {
    if (timerInterval) clearInterval(timerInterval);
    Battle.stop();
    bootSequence();
  }

  // ===== 标题菜单 =====
  const DIFF_NAMES = { easy: '新手', normal: '普通', hard: '困难' };
  let selectedDiff = 'normal';

  async function showTitle() {
    bootText.textContent = '';
    bootHint.textContent = '';
    bootHint.style.animation = 'none';
    bootHint.style.color = 'var(--fg)';
    bootHint.style.fontSize = '14px';
    bootHint.style.letterSpacing = '0';

    const menu = [
      { key: '1', label: '新的游戏' },
      { key: '2', label: '继续游戏' + (Engine.hasAuto() ? ' (有存档)' : ''), fn: () => loadGame() },
      { key: '3', label: '难度：' + (DIFF_NAMES[selectedDiff] || '普通'), diff: true },
      { key: '4', label: '关于', fn: () => showAbout() },
    ];
    const render = () => {
      bootHint.innerHTML = '<div class="title-menu">' + menu.map((m, i) =>
        '<button class="title-btn' + (m.diff ? ' title-btn-diff' : '') + '" data-i="' + i + '">' + m.key + '. ' + m.label + '</button>'
      ).join('') + '</div>';
    };
    render();

    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      bootHint.removeEventListener('click', onClick);
    };
    const doChoice = (i) => {
      if (i === 0) { cleanup(); startNewGame(selectedDiff); }
      else if (i === 1) { cleanup(); loadGame(); }
      else if (i === 2) {
        // 循环难度
        const order = ['easy', 'normal', 'hard'];
        selectedDiff = order[(order.indexOf(selectedDiff) + 1) % order.length];
        menu[2].label = '难度：' + (DIFF_NAMES[selectedDiff] || '普通');
        render();
      }
      else if (i === 3) { cleanup(); showAbout(); }
    };
    const onKey = (e) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= 4) { doChoice(n - 1); }
    };
    const onClick = (e) => {
      const btn = e.target.closest ? e.target.closest('.title-btn') : null;
      if (btn) { doChoice(parseInt(btn.dataset.i)); }
    };
    document.addEventListener('keydown', onKey);
    bootHint.addEventListener('click', onClick);
  }

  async function showAbout() {
    bootHint.style.animation = 'none';
    bootHint.innerHTML = [
      '《白月茧响》',
      '黑暗魔法少女 · 文字冒险RPG',
      '',
      '主角：白月绫音（白月凌）',
      '世界观：夜见市 · 现代都市 · 超能力 · 校园',
      '',
      '触手魔物从人类负面情感中诞生。',
      '与「茧」签订契约，成为魔法少女——',
      '但每一份力量都在侵蚀你的存在。',
      '当茧成熟时，你还会是你吗？',
      '',
      '警告：本游戏包含暴力、恐怖、身体改造、',
      '强制转变等成人内容。',
      '',
      '按 Enter 返回',
    ].join('<br>');
    const handler = (e) => {
      if (e.key === 'Enter') { document.removeEventListener('keydown', handler); showTitle(); }
    };
    document.addEventListener('keydown', handler);
  }

  // ===== 新游戏 / 读档 =====
  // 从存档场景恢复：若 scene 为 '@map:<章节>'（位于地图层），恢复地图而非重放剧本。
  function continueFromSavedScene(sceneId) {
    if (typeof sceneId === 'string' && sceneId.indexOf('@map:') === 0) {
      const chapter = parseInt(sceneId.slice(5), 10);
      if (!isNaN(chapter) && typeof Game !== 'undefined' && Game.explore) {
        Game.explore(chapter);
        return true;
      }
    }
    return false;
  }

  function startNewGame(diff) {
    choiceLock = false;
    Engine.clearSlot();
    Engine.clearAuto();
    Engine.setState(Engine.newGame(diff));
    Engine.getState().retryCount = 0;
    Engine.getState().retryEnemyMult = 1;
    bootEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    endEl.classList.add('hidden');
    startTimer();
    initHUD();
    runScene('prologue_0');
  }

  function loadGame() {
    if (Engine.loadAuto()) {
      const LS = Engine.getState();
      if (typeof LS.retryCount !== 'number' || isNaN(LS.retryCount)) LS.retryCount = 0;
      LS.retryEnemyMult = 1;
      LS.retryCount = 0;
      bootEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      endEl.classList.add('hidden');
      startTimer();
      initHUD();
      choiceLock = false;
      if (!continueFromSavedScene(Engine.getState().scene)) {
        runScene(Engine.getState().scene);
      }
    } else {
      bootHint.innerHTML = '没有存档。<br>按 Enter 返回。';
      const handler = (e) => {
        if (e.key==='Enter') { document.removeEventListener('keydown', handler); showTitle(); }
      };
      document.addEventListener('keydown', handler);
    }
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timer = Engine.getState().playTime || 0;
    timerInterval = setInterval(() => {
      timer++;
      Engine.getState().playTime = timer;
      hudTime.textContent = Engine.formatTime(timer);
      if (timer % 30 === 0) Engine.autoSave();
    }, 1000);
  }

  // ===== HUD =====
  function initHUD() {
    const S = Engine.getState();
    hudName.textContent = S.name;
    hudSub.textContent = '';
    hudChapter.textContent = '序章';
    hudTime.textContent = '00:00';
    renderStatus();
    renderSaveBar();
  }

  function renderStatus() {
    const S = Engine.getState();
    const ch = ['序章','第一章','第二章','第三章','终章'][S.chapter]||'序章';
    updateSidePanel();
  }

  // 配方/材料查询：优先 core/data.js（Data 为唯一数据源），缺失时回退 battle.js 旧表
  function dataRecipe(k) {
    return (typeof window !== 'undefined' && window.Data && window.Data.getRecipe) ?
      (window.Data.getRecipe(k) || ((Battle.RECIPES||{})[k])) : ((Battle.RECIPES||{})[k]);
  }
  function dataMaterial(k) {
    return (typeof window !== 'undefined' && window.Data && window.Data.getMaterial) ?
      (window.Data.getMaterial(k) || ((Battle.MATERIALS||{})[k])) : ((Battle.MATERIALS||{})[k]);
  }
  function updateSidePanel(panelEl) {
    const S = Engine.getState();
    const ch = ['序章','第一章','第二章','第三章','终章'][S.chapter]||'序章';
    const freePhase = (typeof Game === 'undefined' || !Game.getPhase || !Game.PHASES) ? true :
      (Game.getPhase() === Game.PHASES.EXPLORE || Game.getPhase() === Game.PHASES.MENU);
    const inv = S.inventory.map(i => {
      const d = (Battle.ITEMS||{})[i.id];
      return d ? `<div class="row"><span class="k">·</span><span class="v gray">${d.name} ×${i.count}</span></div>` : '';
    }).join('');
    const mats = Object.entries(S.materials).map(([k,v]) => {
      const d = dataMaterial(k);
      return d ? `<div class="row"><span class="k">·</span><span class="v gray">${d.name} ×${v}</span></div>` : '';
    }).join('');
    const craftBtns = Object.entries(S.recipes).map(([k]) => {
      const r = dataRecipe(k);
      if (!r) return '';
      const costStr = Object.entries(r.cost).map(([m,n]) => {
        const md = dataMaterial(m);
        return (md?md.name:m)+' ×'+n;
      }).join(' ');
      return `<div class="row"><button class="save-btn craft-btn" data-recipe="${k}">${r.name}</button></div><div class="row" style="font-size:10px;color:var(--fg-dim);">${costStr}</div>`;
    }).join('');

    // 羁绊等级 + 被动加成说明（R1-R4）
    const cb = (typeof Engine !== 'undefined' && Engine.confidantBonus) ? Engine.confidantBonus(S) : null;
    const RANK_NAMES = { 1:'R1', 2:'R2', 3:'R3', 4:'R4' };
    const fmtBonus = (b) => {
      if (!b) return '无加成';
      const parts = [];
      if (b.def) parts.push('防御+' + b.def);
      if (b.atk) parts.push('攻击+' + b.atk);
      if (b.maxHp) parts.push('生命+' + b.maxHp);
      if (b.spd) parts.push('敏捷+' + b.spd);
      if (b.dmgReduction) parts.push('减伤' + Math.round(b.dmgReduction * 100) + '%');
      if (b.critChance) parts.push('暴击' + Math.round(b.critChance * 100) + '%');
      if (b.craftDiscount) parts.push('合成-' + Math.round(b.craftDiscount * 100) + '%');
      if (b.shopDiscount) parts.push('商店-' + Math.round(b.shopDiscount * 100) + '%');
      return parts.join(' ');
    };
    const CHAR_NAMES = { yuki: '雪', suzu: '铃', hagoromo: '羽衣' };
    const bondHtml = cb ? ['yuki', 'suzu', 'hagoromo'].map(c => {
      const v = (S.trust && S.trust[c]) || 0;
      const b = cb[c] || {};
      const rn = RANK_NAMES[b.rank] || 'R1';
      const tip = (b.rank || 1) < 4 ? ' · 下一级 R' + ((b.rank||1)+1) + ' 需信任 ' + [30,60,80][b.rank] : ' · 已达最高';
      return '<div class="row"><span class="k">' + CHAR_NAMES[c] + '</span><span class="v">' + v + ' (' + rn + ')</span></div>' +
        '<div class="row" style="font-size:10px;color:var(--fg-dim);">' + fmtBonus(b) + tip + '</div>';
    }).join('') : '';

    const html = [
      '<div class="row"><span class="k">姓名</span><span class="v">'+esc(S.name)+'</span></div>',
      '<div class="row"><span class="k">Lv.</span><span class="v">'+S.level+'</span><span class="k">章</span><span class="v">'+ch+'</span></div>',
      '<div class="row"><span class="k">金币</span><span class="v">¥'+(S.money||0)+'</span></div>',
      '<div class="sec">── 状态 ──</div>',
      '<div class="row"><span class="k">HP</span><span class="v">'+S.hp+'/'+S.maxHp+'</span></div>',
      '<div class="row"><span class="k">SP</span><span class="v">'+S.sp+'/'+S.maxSp+'</span></div>',
      '<div class="row"><span class="k">侵蚀</span><span class="v'+(S.ero>=60?' flag':'')+'">'+S.ero+'%</span></div>',
      '<div class="row"><span class="k">击杀</span><span class="v">'+S.kills+'</span></div>',
      '<div class="row"><span class="k">武器</span><span class="v">+'+S.weaponLevel+'</span><span class="k">属性点</span><span class="v'+(S.statPts>0?' flag':'')+'">'+S.statPts+'</span></div>',
      '<div class="sec">── 技能 ──</div>',
      S.skills.map(s => '<div class="row"><span class="k">·</span><span class="v gray">'+Battle.getActionKey(s)+'</span></div>').join(''),
      '<div class="sec">── 羁绊 ──</div>' +
      bondHtml +
      '<div class="row"><span class="k">锚点</span><span class="v">'+(S.anchor??50)+'</span>' +
      (!mapEl || mapEl.classList.contains('hidden') ? '' : '<span class="k">日程</span><span class="v">第'+(S.day||1)+'天 · '+((S.phase==='night')?'夜晚':'白天')+' · AP '+(S.ap||0)+'/'+maxAPOf()+'</span>') +
      '</div>',
      '<div class="sec">── 道具 ──</div>',
      inv || '<div class="row"><span class="k">·</span><span class="v gray">空</span></div>',
      '<div class="sec">── 材料 ──</div>',
      mats || '<div class="row"><span class="k">·</span><span class="v gray">空</span></div>',
      craftBtns ? '<div class="sec">── 合成 ──</div>' + craftBtns : '',
      S.statPts > 0 ? '<div class="sec">── 加点 ──</div>' +
        '<div class="row"><button class="save-btn" data-stat="str">力量 +1 (当前 '+(S.stats.str||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="vit">体力 +1 (当前 '+(S.stats.vit||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="spi">灵力 +1 (当前 '+(S.stats.spi||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="agi">敏捷 +1 (当前 '+(S.stats.agi||0)+')</button></div>' : '',
      '<div class="sec">── 强化 ──</div>' +
      '<div class="row"><button class="save-btn" data-stat="weapon">强化武器 (当前 +'+(S.weaponLevel||1)+')</button></div>' +
      '<div class="row" style="font-size:10px;color:var(--fg-dim);">需暗蚀结晶 ×'+(S.weaponLevel||1)*2+'</div>' +
      (freePhase ? '<div class="sec">── 商店 ──</div>' +
      '<div class="row"><button class="save-btn" data-sys="shop">商店（买入/卖出）</button></div>' +
      '<div class="row"><button class="save-btn" data-sys="equip">装备（防具/饰品）</button></div>' : '') +
      '<div class="sec">── 系统 ──</div>' +
      '<div class="row"><button class="save-btn" data-sys="save">保存</button></div>' +
      '<div class="row"><button class="save-btn" data-sys="load">读取</button></div>',
    ].join('');
    if (panelEl) panelEl.innerHTML = html;
    else statusBox.innerHTML = html;
    // 绑定事件
    const container = panelEl || statusBox;
    container.querySelectorAll('.craft-btn').forEach(b => {
      b.addEventListener('click', () => {
        const r = Engine.craftRecipe(b.dataset.recipe);
        if (r.ok) {
          showDialog('合成成功！获得 '+(r.item.name||'')+' ×'+r.item.count);
          updateSidePanel(panelEl);
        } else {
          showDialog('合成失败：'+r.msg);
        }
      });
    });
    container.querySelectorAll('[data-stat]').forEach(b => {
      b.addEventListener('click', () => {
        const stat = b.dataset.stat;
        if (stat === 'weapon') {
          const r = Engine.upgradeWeapon();
          if (r.ok) { showDialog('武器强化成功！当前 +'+r.level); updateSidePanel(panelEl); }
          else { showDialog('强化失败：需要暗蚀结晶 ×'+r.need); }
        } else {
          if (Engine.addStat(stat, 1)) {
            showDialog(stat === 'str'?'力量 +1':stat==='vit'?'体力 +1':stat==='spi'?'灵力 +1':'敏捷 +1');
            updateSidePanel(panelEl);
          } else {
            showDialog('属性点不足');
          }
        }
      });
    });
    container.querySelectorAll('[data-sys]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.sys === 'save') { Engine.autoSave(); showDialog('存档已保存。'); }
        else if (b.dataset.sys === 'load') {
          if (Engine.hasAuto()) { Engine.loadAuto(); showDialog('读档完成。'); togglePanel(false); choiceLock = false; if (!continueFromSavedScene(Engine.getState().scene)) { runScene(Engine.getState().scene); } }
          else { showDialog('没有存档。'); }
        }
        else if (b.dataset.sys === 'shop') {
          togglePanel(false);
          if (guardFreePhase('商店')) setTimeout(() => showShopPanel(), 50);
        }
        else if (b.dataset.sys === 'equip') {
          togglePanel(false);
          if (guardFreePhase('装备')) setTimeout(() => showEquipPanel(), 50);
        }
      });
    });
  }

  function togglePanel(show) {
    if (!panelEl) return;
    if (show) {
      panelEl.classList.remove('hidden');
      updateSidePanel(panelBody);
    } else {
      panelEl.classList.add('hidden');
    }
  }

  function renderSaveBar() {
    savebar.innerHTML = '<div>存档</div><div class="row"><button class="save-btn" id="btnSave">保存</button><button class="save-btn" id="btnLoad">读取</button></div>';
    document.getElementById('btnSave').addEventListener('click', () => {
      const ok = Engine.autoSave();
      showDialog(ok ? '存档已保存。' : '存档失败（存储空间不足或隐私模式）。');
    });
    document.getElementById('btnLoad').addEventListener('click', () => {
      if (Engine.hasAuto()) {
        Engine.loadAuto();
        showDialog('读档完成。');
        choiceLock = false;
        if (!continueFromSavedScene(Engine.getState().scene)) {
          runScene(Engine.getState().scene);
        }
      } else {
        showDialog('没有存档。');
      }
    });
  }

  function updateHUD() {
    const S = Engine.getState();
    hudName.textContent = S.name;
    if (S.chapter === 0) hudChapter.textContent = '序章';
    else if (S.chapter === 1) hudChapter.textContent = '第一章';
    else if (S.chapter === 2) hudChapter.textContent = '第二章';
    else if (S.chapter === 3) hudChapter.textContent = '第三章';
    else if (S.chapter === 4) hudChapter.textContent = '终章';
    renderStatus();
  }

  // ===== 场景执行 =====
  async function runScene(id) {
    if (choiceLock) return;
    if (typeof id === 'string' && id.indexOf('@map:') === 0) return;
    const S = Engine.getState();
    const scene = Story.get(id);
    if (!scene) { console.error('场景不存在:', id); return; }

    currentSceneId = id;
    S.scene = id;
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    storyEl.classList.remove('hidden');
    if (mapEl) mapEl.classList.add('hidden');
    battleEl.classList.add('hidden');
    storyScroll.scrollTop = storyScroll.scrollHeight;
    choiceLock = true;

    // 前置条件
    if (scene.condition && !scene.condition(S)) {
      choiceLock = false;
      return;
    }

    // 前置效果（死亡场景用 reentry 标记可重复执行）
    if (scene.onEnter && (scene.reentry || !S.doneScenes[id])) {
      scene.onEnter(S);
      S.doneScenes[id] = true;
    }
    updateHUD();

    // 渲染文本
    const text = scene.text;
    storyText.innerHTML = '';
    let lines = Array.isArray(text) ? text : [text];

    // 处理条件文本
    let finalLines = [];
    for (const line of lines) {
      if (typeof line === 'string') {
        const processed = line.replace(/\{name\}/g, esc(S.name)).replace(/\{trueName\}/g, esc(S.trueName));
        finalLines.push(processed);
      } else if (line.cond && line.cond(S)) {
        finalLines.push(line.text);
      } else if (line.else !== undefined && !line.cond) {
        finalLines.push(line.else);
      }
    }

    lines = finalLines;

    // 打字机效果（视觉小说式逐字显示，字数×0.6秒，点击/按键可跳过）
    typing = true;
    textSkip = false;
    for (let i=0; i<lines.length; i++) {
      if (i > 0) {
        const br = document.createElement('div');
        br.className = 'beat';
        storyText.appendChild(br);
      }
      const el = document.createElement('div');
      el.className = 'line';
      storyText.appendChild(el);
      followBottom();
      await typeLine(el, lines[i]);
      if (textSkip) { textSkip = false; }
    }
    typing = false;

    // 转场效果
    if (scene.transition) {
      await wait(300);
      storyText.innerHTML += '<div class="sep">─  ─  ─  ─  ─  ─  ─</div>';
      storyScroll.scrollTop = storyScroll.scrollHeight;
      await wait(400);
    }

    // 触发战斗
    if (scene.battle) {
      choiceLock = false;
      await wait(500);
      await startBattle({
        enemy: withRetryEnemy(scene.battle.enemy),
        onWin: async (enemy) => {
          const WS = Engine.getState();
          WS.retryCount = 0;
          if (WS.retryEnemyMult != null) WS.retryEnemyMult = 1;
          if (scene.battle.next) await runScene(scene.battle.next);
        },
        onLose: async (enemy) => {
          if (scene.battle.loseScene) { await runScene(scene.battle.loseScene); }
          else { await dieAndRetry(); }
        },
      });
      return;
    }

    // 选项
    choicesEl.innerHTML = '';
    choiceLock = false;
    if (scene.choices && scene.choices.length > 0) {
      // 选项出现时，给文本底部让出空间（上移一点，避免被选项遮住）
      storyScroll.classList.add('has-choices');
      // 键盘快捷键（点击任意选项后移除，避免残留到下一场景）
      const sceneId = currentSceneId;
      const handler = (e) => {
        if (currentSceneId !== sceneId) { document.removeEventListener('keydown', handler); return; }
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          const btns = choicesEl.querySelectorAll('.choice-btn');
          if (btns[n-1]) { document.removeEventListener('keydown', handler); btns[n-1].click(); }
        }
      };
      document.addEventListener('keydown', handler);
      for (const ch of scene.choices) {
        if (ch.condition && !ch.condition(S)) continue;
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = ch.text;
        btn.addEventListener('click', () => {
          if (choiceLock) return;
          choiceLock = false;
          document.removeEventListener('keydown', handler);
          choicesEl.innerHTML = '';
          storyScroll.classList.remove('has-choices');
          if (ch.effect) ch.effect(S);
          if (ch.flag) S.flags[ch.flag] = true;
          if (ch.chapter !== undefined) {
            S.chapter = ch.chapter;
            if (typeof Game !== 'undefined' && Game.setChapter) Game.setChapter(ch.chapter);
          }
          updateHUD();
          Engine.autoSave();
          // 主线断点：本场景为主线推进边界时，做出选择后停止连播并返回地图
          if (typeof Game !== 'undefined' && Game.isMainlineBoundary && Game.isMainlineBoundary(currentSceneId)) {
            if (typeof Game.clearMainlineBoundary === 'function') Game.clearMainlineBoundary();
            Game.returnToMap && Game.returnToMap();
            return;
          }
          if (ch.next) runScene(ch.next);
        });
        choicesEl.appendChild(btn);
      }
      setTimeout(() => document.removeEventListener('keydown', handler), 5000);
    } else if (scene.next) {
      // 点击 / 回车后才进入下一场景（不自动刷掉文字）
      await waitForClick();
      choiceLock = false;
      Engine.autoSave();
      // 自然融入：章节开头自动进入对应章节地图（RPG 自由行动层）
      const mapChapter = CHAPTER_MAP_ENTRY[scene.next];
      if (mapChapter && typeof Game !== 'undefined' && Game.explore &&
          typeof World !== 'undefined' && World.getMap && World.getMap(mapChapter).length) {
        const S2 = Engine.getState();
        S2.scene = '@map:' + mapChapter;
        if (typeof Game !== 'undefined' && Game.setChapter) Game.setChapter(mapChapter);
        Game.explore(mapChapter);
        Engine.autoSave();
      } else {
        // 主线断点：本场景为主线推进边界且含 next 时，停止连播并返回地图
        if (typeof Game !== 'undefined' && Game.isMainlineBoundary && Game.isMainlineBoundary(currentSceneId)) {
          if (typeof Game.clearMainlineBoundary === 'function') Game.clearMainlineBoundary();
          Game.returnToMap && Game.returnToMap();
          return;
        }
        const nextScene = (typeof Story !== 'undefined' && Story.get) ? Story.get(scene.next) : null;
        const isTail = nextScene && !nextScene.next &&
          !(nextScene.choices && nextScene.choices.length) && !nextScene.battle;
        runScene(scene.next).then(() => {
          if (isTail && typeof Game !== 'undefined' && Game.getPhase && Game.PHASES &&
              Game.getPhase() === Game.PHASES.DIALOGUE) {
            Game.returnToMap();
          }
        });
      }
    } else {
      choiceLock = false;
    }
  }

  // ===== 等待一次点击 / 回车（用于场景推进，不自动切换） =====
  function waitForClick() {
    return new Promise((resolve) => {
      let done = false;
      let timeout = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timeout) clearTimeout(timeout);
        detach();
        document.removeEventListener('keydown', onKey);
        resolve();
      };
      const detach = registerTap(() => finish(), { within: storyScroll });
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
      };
      document.addEventListener('keydown', onKey);
      // 兜底：60 秒无操作也推进，避免永远卡住
      timeout = setTimeout(finish, 60000);
    });
  }

  function parseMarkup(str) {
    return str
      .replace(/\[n\]/g, '<span class="narr">')
      .replace(/\[\/n\]/g, '</span>')
      .replace(/\[e\]/g, '<span class="em">')
      .replace(/\[\/e\]/g, '</span>')
      .replace(/\[b\]/g, '<span class="blue">')
      .replace(/\[\/b\]/g, '</span>')
      .replace(/\[g\]/g, '<span class="gold">')
      .replace(/\[\/g\]/g, '</span>')
      .replace(/\[p\]/g, '<span class="purple">')
      .replace(/\[\/p\]/g, '</span>')
      .replace(/\[s\]/g, '<span class="sys">')
      .replace(/\[\/s\]/g, '</span>')
      .replace(/\[d\]/g, '<span class="dim">')
      .replace(/\[\/d\]/g, '</span>')
      .replace(/\[speaker\]/g, '<span class="speaker">')
      .replace(/\[\/speaker\]/g, '</span>')
      .replace(/\[sa\]/g, '<span class="speaker speaker-a">')
      .replace(/\[\/sa\]/g, '</span>')
      .replace(/\[sb\]/g, '<span class="speaker speaker-b">')
      .replace(/\[\/sb\]/g, '</span>')
      .replace(/\[sc\]/g, '<span class="speaker speaker-c">')
      .replace(/\[\/sc\]/g, '</span>')
      .replace(/\[sd\]/g, '<span class="speaker speaker-d">')
      .replace(/\[\/sd\]/g, '</span>')
      .replace(/\[se\]/g, '<span class="speaker speaker-e">')
      .replace(/\[\/se\]/g, '</span>')
      .replace(/\[cg\]/g, '<div class="cg">')
      .replace(/\[\/cg\]/g, '</div>')
      .replace(/\[r18g\]/g, '<div class="r18g">')
      .replace(/\[\/r18g\]/g, '</div>')
      .replace(/\[title\]/g, '<div class="titleline">')
      .replace(/\[\/title\]/g, '</div>')
      .replace(/\[sub\]/g, '<div class="subtitle">')
      .replace(/\[\/sub\]/g, '</div>')
      .replace(/\[sep\]/g, '<div class="sep">')
      .replace(/\[\/sep\]/g, '</div>');
  }

  // ===== 战斗集成 =====
  function showBattle() {
    storyEl.classList.add('hidden');
    battleEl.classList.remove('hidden');
    choicesEl.innerHTML = '';
    storyText.innerHTML = '';
    renderBattleBars();
  }

  function renderBattleBars() {
    const S = Engine.getState();
    battleBars.innerHTML = `
      <div class="player-bar">
        <div class="bar-row bar-hp"><span class="lbl">HP</span><div class="bar"><div class="fill" style="width:${S.hp/S.maxHp*100}%"></div></div><span class="bar-num">${S.hp}/${S.maxHp}</span></div>
        <div class="bar-row bar-sp"><span class="lbl">SP</span><div class="bar"><div class="fill" style="width:${S.sp/S.maxSp*100}%"></div></div><span class="bar-num">${S.sp}/${S.maxSp}</span></div>
        <div class="bar-row bar-ero"><span class="lbl">蚀</span><div class="bar"><div class="fill" style="width:${S.ero}%"></div></div><span class="bar-num">${S.ero}%</span></div>
      </div>
      <div class="player-bar" style="max-width:110px;font-size:11px;color:var(--fg-dim);padding-top:4px;">
        Lv.${S.level} | 击杀 ${S.kills}
      </div>
      <div class="player-bar" style="max-width:200px;">
        <div class="bar-row bar-xp"><span class="lbl">经验</span><div class="bar"><div class="fill" style="width:${Math.min(100,S.xp/(S.level*40)*100)}%"></div></div><span class="bar-num">${S.xp}/${S.level*40}</span></div>
      </div>`;
    // combo 显示器只创建一次
    let comboEl = document.getElementById('comboDisplay');
    if (!comboEl) {
      comboEl = document.createElement('div');
      comboEl.id = 'comboDisplay';
      comboEl.className = 'combo-display';
      document.getElementById('arena').appendChild(comboEl);
    } else {
      comboEl.textContent = '';
    }
  }

  function setCombo(n) {
    comboCount = n;
    const el = document.getElementById('comboDisplay');
    if (el) {
      el.textContent = n > 0 ? `COMBO ×${n}` : '';
      if (n >= 3) el.style.color = 'var(--gold)';
      if (n >= 5) el.style.color = 'var(--red-hi)';
    }
  }

  function setEnemySprite(enemy) {
    const sp = enemy.sprite || [
      '  ╭───────╮  ',
      '  │  〰〰〰  │  ',
      ' ╱│  ◉  ◉  │╲ ',
      '╱ │ ▼═══▼  │ ╲',
      '  ╰───┬───╯  ',
      '  ╱╱╱  ╲╲╲   ',
      ' 〰〰〰〰〰〰〰  ',
    ];
    // 玩家精灵
    const psp = [
      '  ╭───╮  ',
      '  │ ◕◕ │  ',
      ' ╱│  │  │╲ ',
      '│ │  │  │ │',
      '  ╰─┴─╯  ',
      '  ╱    ╲  ',
    ];
    enemyZone.innerHTML = '<div class="enemy-name">' + enemy.title + '</div><div class="enemy-sprite">' + sp.join('\n') + '</div><div class="enemy-hpbar"><div class="fill" id="enemyHpFill" style="width:100%"></div></div><div class="hp-label"><span class="hp-num" id="enemyHpLabel">' + enemy.hp + '</span> / ' + enemy.maxHp + '</div>';
    playerZone.innerHTML = '<div class="player-sprite">' + psp.join('\n') + '</div><div class="player-name-b">' + esc(Engine.getState().name) + '</div>';
  }

  function updateEnemyBar(enemy) {
    const fill = document.getElementById('enemyHpFill');
    const lbl = document.getElementById('enemyHpLabel');
    if (fill) fill.style.width = (enemy.hp/enemy.maxHp*100) + '%';
    if (lbl) lbl.textContent = enemy.hp;
  }

  function updateBattleState() {
    const S = Engine.getState();
    const hpFill = battleBars.querySelector('.bar-hp .fill');
    const spFill = battleBars.querySelector('.bar-sp .fill');
    const eroFill = battleBars.querySelector('.bar-ero .fill');
    const hpNum = battleBars.querySelector('.bar-hp .bar-num');
    const spNum = battleBars.querySelector('.bar-sp .bar-num');
    const eroNum = battleBars.querySelector('.bar-ero .bar-num');
    if (hpFill) hpFill.style.width = (S.hp/S.maxHp*100)+'%';
    if (spFill) spFill.style.width = (S.sp/S.maxSp*100)+'%';
    if (eroFill) eroFill.style.width = S.ero+'%';
    if (hpNum) hpNum.textContent = S.hp+'/'+S.maxHp;
    if (spNum) spNum.textContent = S.sp+'/'+S.maxSp;
    if (eroNum) eroNum.textContent = S.ero+'%';
  }

  function battleLog(msg, cls='info') {
    const el = document.createElement('div');
    el.className = 'blog-line ' + cls;
    el.innerHTML = msg;
    battleLogEl.appendChild(el);
    battleLogEl.scrollTop = battleLogEl.scrollHeight;
  }

  function getActionList() {
    const S = Engine.getState();
    const ultReady = comboCount >= 8;
    const learned = (id) => Engine.hasSkill(id);
    const actions = [];
    if (learned('strike')) actions.push({ id: 'strike', label: '苍月斩', desc: '普通攻击 · SP+5', cost: 0, disable: false });
    if (learned('pure')) actions.push({ id: 'pure', label: '净化之矢', desc: '强力攻击 · 消耗SP20', cost: 20, disable: S.sp < 20 });
    actions.push({ id: 'guard', label: '防御', desc: '减少伤害', cost: 0, disable: false });
    if (learned('erosion')) actions.push({ id: 'erosion', label: '蚀心之触', desc: '超强力攻击 · 侵蚀+8', cost: 25, disable: S.sp < 25 || S.ero >= 100 });
    actions.push({ id: 'heal', label: '魂愈', desc: '恢复28%HP · 消耗SP15', cost: 15, disable: S.sp < 15 });
    actions.push({ id: 'item', label: '道具', desc: '使用随身道具', cost: 0, disable: S.inventory.length === 0 });
    actions.push({ id: 'ultimate', label: '白月破晓', desc: '必杀技 · 需充能', cost: 0, disable: !ultReady });
    return actions;
  }

  function promptAction(enemy) {
    return new Promise((resolve) => {
      const actions = getActionList();
      battleMenu.innerHTML = '';
      for (const a of actions) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = '<strong>' + a.label + '</strong> <span class="at">' + a.desc + '</span>';
        btn.disabled = a.disable;
        if (a.disable) btn.style.borderLeftColor = 'var(--blood)';
        btn.addEventListener('click', () => {
          battleMenu.innerHTML = '';
          resolve(a.id);
        });
        battleMenu.appendChild(btn);
      }
    });
  }

  function promptItem() {
    return new Promise((resolve) => {
      const S = Engine.getState();
      battleMenu.innerHTML = '';
      if (S.inventory.length === 0) {
        battleMenu.innerHTML = '<div style="color:var(--fg-dim);padding:10px;">没有道具。</div>';
        setTimeout(() => resolve(null), 800);
        return;
      }
      for (const it of S.inventory) {
        const def = Battle.ITEMS[it.id];
        if (!def) continue;
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = `<strong>${def.name}</strong> <span class="at">${def.desc} (×${it.count})</span>`;
        btn.addEventListener('click', () => {
          battleMenu.innerHTML = '';
          resolve(it.id);
        });
        battleMenu.appendChild(btn);
      }
      const cancel = document.createElement('button');
      cancel.className = 'action-btn';
      cancel.style.borderLeftColor = 'var(--blood)';
      cancel.innerHTML = '<strong>取消</strong>';
      cancel.addEventListener('click', () => {
        battleMenu.innerHTML = '';
        resolve(null);
      });
      battleMenu.appendChild(cancel);
    });
  }

  function setTurnActive(cb) {
    turnCallback = cb;
  }

  function enemyEl() { return enemyZone; }
  function playerEl() { return playerZone; }

  function shakeEnemy(hard) {
    enemyZone.classList.remove('anim-enemydamage','anim-shake-hard','anim-hitflash');
    void enemyZone.offsetWidth;
    enemyZone.classList.add(hard ? 'anim-shake-hard' : 'anim-enemydamage');
  }
  function shakePlayer() {
    playerZone.classList.remove('anim-playerdamage','anim-hitflash');
    void playerZone.offsetWidth;
    playerZone.classList.add('anim-playerdamage');
  }
  function shakeHard() {
    const stage = document.getElementById('battleStage');
    stage.classList.remove('anim-shake-hard');
    void stage.offsetWidth;
    stage.classList.add('anim-shake-hard');
  }
  function flashCrit() {
    const stage = document.getElementById('battleStage');
    stage.classList.remove('crit-flash');
    void stage.offsetWidth;
    stage.classList.add('crit-flash');
  }
  function transformFlash() {
    const stage = document.getElementById('battleStage');
    stage.style.filter = 'brightness(3)';
    setTimeout(() => stage.style.filter = '', 300);
  }
  function pulseEro() {
    const stage = document.getElementById('battleStage');
    stage.style.boxShadow = 'inset 0 0 40px rgba(160,48,80,.25)';
    setTimeout(() => stage.style.boxShadow = '', 600);
  }

  // ===== 战斗开始 =====
  async function startBattle(cfg) {
    Battle.Sfx.ensure();
    battleCtx = await Battle.start(cfg);
  }

  // ===== 死亡处理 =====
  async function dieAndRetry() {
    const S = Engine.getState();
    if (typeof S.retryCount !== 'number' || isNaN(S.retryCount)) S.retryCount = 0;
    S.retryCount++;
    Engine.autoSave();
    await wait(1000);
    if (S.retryCount >= 3) {
      showDialog('连续战败…… 契约的庇护开始动摇。');
      await wait(1500);
      hideDialog();
      showDeathMenu();
      return;
    }
    showDialog('绫音倒地了…… 但契约的力量将她拉回现世。');
    await wait(1800);
    hideDialog();
    S.hp = Math.round(S.maxHp * 0.4);
    S.sp = Math.round(S.maxSp * 0.3);
    S.ero = Engine.clamp(S.ero + 5, 0, 100);
    runScene(currentSceneId);
  }

  // 连续 3 次战败后的死亡菜单：提供不依赖战斗力的出口（降难度/读档/放弃）
  function showDeathMenu() {
    const S = Engine.getState();
    const scene = Story.get(currentSceneId);
    const battle = scene && scene.battle;
    const curDiff = S.difficulty || 'normal';
    const diffName = { easy: '新手', normal: '普通', hard: '困难' };
    const nextDiff = curDiff === 'hard' ? 'normal' : (curDiff === 'normal' ? 'easy' : null);
    const hasLose = !!(battle && battle.loseScene);
    const canMap = typeof Game !== 'undefined' && typeof Game.returnToMap === 'function';

    // 1) 降低难度重试（hard→normal→easy；已是最低难度则削弱敌人 HP-20%）
    const optDiff = {
      text: '降低难度重试（' + (nextDiff ? diffName[curDiff] + '→' + diffName[nextDiff] : '已是新手，削弱敌人 HP-20%') + '）',
      fn: () => {
        if (nextDiff) {
          S.difficulty = nextDiff;
          if (typeof Engine.recalcStats === 'function') Engine.recalcStats();
        } else {
          S.retryEnemyMult = Math.max(0.3, (S.retryEnemyMult == null ? 1 : S.retryEnemyMult) * 0.8);
        }
        S.hp = S.maxHp; S.sp = S.maxSp;
        S.retryCount = 0;
        Engine.autoSave();
        runScene(currentSceneId);
      },
    };
    // 2) 读档
    const optLoad = {
      text: '读取存档',
      fn: () => {
        S.retryCount = 0;
        Engine.autoSave();
        loadGame();
      },
    };
    // 3) 放弃本场战斗：优先走 loseScene，否则返回地图 / 跳主线 / 回标题
    const optGive = {
      text: hasLose ? '放弃战斗，接受败北结局' : (canMap ? '放弃战斗，返回地图' : '放弃战斗，跳过本战'),
      fn: () => {
        S.retryCount = 0;
        if (hasLose) { runScene(battle.loseScene); return; }
        if (canMap) { Game.returnToMap(); return; }
        if (battle && battle.next) { runScene(battle.next); return; }
        showTitle();
      },
    };

    if (Battle && typeof Battle.stop === 'function') Battle.stop();
    battleEl.classList.add('hidden');
    storyEl.classList.remove('hidden');
    choiceLock = false;
    storyText.innerHTML = '<div class="line" style="color:var(--red-hi);">绫音倒下了。连败的阴影笼罩着她。</div>' +
      '<div class="line" style="color:var(--fg-dim);">眼前的敌人远超她当前的力量——</div>';
    storyScroll.scrollTop = storyScroll.scrollHeight;

    choicesEl.innerHTML = '';
    storyScroll.classList.add('has-choices');
    const sceneId = currentSceneId;
    const handler = (e) => {
      if (currentSceneId !== sceneId) { document.removeEventListener('keydown', handler); return; }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 3) {
        const btns = choicesEl.querySelectorAll('.choice-btn');
        if (btns[n-1]) { document.removeEventListener('keydown', handler); btns[n-1].click(); }
      }
    };
    document.addEventListener('keydown', handler);
    const opts = [optDiff, optLoad, optGive];
    opts.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = o.text;
      btn.addEventListener('click', () => {
        document.removeEventListener('keydown', handler);
        choicesEl.innerHTML = '';
        storyScroll.classList.remove('has-choices');
        if (choiceLock) return;
        choiceLock = false;
        o.fn();
      });
      choicesEl.appendChild(btn);
    });
    setTimeout(() => document.removeEventListener('keydown', handler), 20000);
  }

  // 死亡菜单削弱敌人的乘数：应用到 runScene 的战斗敌人上（不修改场景数据）
  function withRetryEnemy(enemy) {
    const S = Engine.getState();
    const m = S.retryEnemyMult;
    if (!m || m >= 1 || !enemy || typeof enemy.hp !== 'number') return enemy;
    return Object.assign({}, enemy, { hp: Math.max(1, Math.round(enemy.hp * m)) });
  }

  // ===== 对话框 =====
  function showDialog(msg) {
    dialogEl.classList.remove('hidden');
    dialogBox.textContent = msg;
    dialogEl.addEventListener('click', hideDialog, { once: true });
  }
  function hideDialog() {
    dialogEl.classList.add('hidden');
  }

  // ===== 结局画面 =====
  function scheduleEnding(ending) {
    if (endTimer) clearTimeout(endTimer);
    endTimer = setTimeout(() => { endTimer = null; showEnding(ending); }, 3000);
  }
  function showEnding(ending) {
    if (timerInterval) clearInterval(timerInterval);
    Battle.stop();
    gameEl.classList.add('hidden');

    const endings = {
      '永劫': { art: [{c:'var(--accent-hi)', s:'  ═══ 苍月永劫 ═══'}], title:'苍月永劫', sub:'她成为了茧的一部分。力量永恒，自我消散。', stats:{} },
      '解放': { art: [{c:'var(--green)', s:'═ 茧の解放 ╌'}], title:'茧の解放', sub:'契约被斩断，自由回归。但代价是被遗忘。', stats:{} },
      '残响': { art: [{c:'var(--red-hi)', s:'╳ 残响 ╳'}], title:'残响', sub:'以生命为代价，净化了城市。白花在废墟中绽放。', stats:{} },
      '白月': { art: [{c:'var(--accent-hi)', s:'  ☽ 白月 ☾'}], title:'白月', sub:'她接纳了新的自我，与茧共生。月光下，崭新的微笑。', stats:{} },
      '羽衣': { art: [{c:'var(--cyan-hi)', s:'  ╰☆ 羽衣 ☆╯'}], title:'羽衣', sub:'他回到了原来的身体，但另一个她永远留在了茧中。有人转身离去，没有回头。', stats:{} },
      '雪': { art: [{c:'var(--red-hi)', s:'  ❄ 雪 ❄'}], title:'雪', sub:'她永远做了绫音，被雪的爱囚禁在完美的牢笼中。镜中的微笑，不知为谁而笑。', stats:{} },
      'TRUE': { art: [{c:'var(--gold)', s:'  ☀ 白月新生 ☀'}], title:'白月 · 新生', sub:'凌与绫音和解，三人找到新的平衡。樱花树下，阳光正好。', stats:{} },
    };
    const e = endings[ending] || { art:[], title:'???', sub:'', stats:{} };

    const S = Engine.getState();
    endArt.textContent = e.art.map(a=>a.s).join('\n');
    endTitle.textContent = e.title;
    endSub.textContent = e.sub;
    endStats.innerHTML = [
      '<div class="row"><span class="k">游戏时间</span><span class="v">'+Engine.formatTime(S.playTime)+'</span></div>',
      '<div class="row"><span class="k">等级</span><span class="v">Lv.'+S.level+'</span></div>',
      '<div class="row"><span class="k">击杀</span><span class="v">'+S.kills+'</span></div>',
      '<div class="row"><span class="k">总伤害</span><span class="v">'+S.damageDealt+'</span></div>',
      '<div class="row"><span class="k">死亡次数</span><span class="v">'+S.deaths+'</span></div>',
      '<div class="row"><span class="k">最终侵蚀</span><span class="v">'+S.ero+'%</span></div>',
    ].join('');
    endEl.classList.remove('hidden');
  }

  // ===== 指令处理 =====
  function handleCmd(v) {
    if (v === 'save') { Engine.autoSave(); showDialog('存档已保存。'); }
    else if (v === 'load') { if (Engine.hasAuto()) { Engine.loadAuto(); choiceLock = false; if (!continueFromSavedScene(Engine.getState().scene)) { runScene(Engine.getState().scene); } showDialog('读档完成。'); } else { showDialog('没有存档。'); } }
    else if (v === 'status') { renderStatus(); showDialog('状态已更新。'); }
    else if (v === 'help') { showDialog('指令: save(存档) load(读档) status(状态) help(帮助)'); }
    else if (v === 'clear') { storyText.innerHTML = ''; }
    else { showDialog('未知指令: ' + v + ' (输入 help 查看帮助)'); }
  }

  function wait(ms) { return new Promise(r=>setTimeout(r,ms)); }

  // ===== 打字机效果（视觉小说式逐字显示） =====
  let typeSpeed = 50; // 每字 ms，0=立即显示（测试用）
  function setTypeSpeed(ms) { typeSpeed = ms; }

  function typeLine(el, raw) {
    return new Promise((resolve) => {
      // 纯文本字数（去掉标签）
      const clean = raw.replace(/\[[^\]]*\]/g, '').replace(/\{name\}|\{trueName\}/g, '');
      const n = clean.length;
      if (n <= 0 || typeSpeed <= 0) { el.innerHTML = parseMarkup(raw); resolve(); return; }

      const total = Math.max(n * typeSpeed, 400);
      const interval = total / n;
      let done = false;
      let idx = 0; // raw 中的位置

      // 找下一个可显示字符
      function nextChar(from) {
        let i = from;
        while (i < raw.length) {
          if (raw[i] === '[') {
            const end = raw.indexOf(']', i);
            i = end === -1 ? raw.length : end + 1;
            continue;
          }
          // 跳过 {name} 等占位符
          if (raw[i] === '{') {
            const end = raw.indexOf('}', i);
            if (end > i) { i = end + 1; continue; }
          }
          return i + 1;
        }
        return raw.length;
      }

      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        el.innerHTML = parseMarkup(raw);
        resolve();
      };

      const onKey = (e) => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      const detach = registerTap(() => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        finish();
      }, { within: storyScroll });

      document.addEventListener('keydown', onKey);
      const timer = setInterval(() => {
        idx = nextChar(idx);
        el.innerHTML = parseMarkup(raw.slice(0, idx));
        followBottom();
        if (idx >= raw.length) finish();
      }, interval);
      skipResolvers.add(finish);

      function cleanup() {
        clearInterval(timer);
        skipResolvers.delete(finish);
        document.removeEventListener('keydown', onKey);
        detach();
      }
    });
  }
  let skipResolvers = new Set();
  function waitInterruptible(ms) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      };
      const onKey = (e) => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      const detach = registerTap(() => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        finish();
      }, { within: storyScroll });
      const timer = setTimeout(finish, ms);
      skipResolvers.add(finish);
      document.addEventListener('keydown', onKey);
      function cleanup() {
        clearTimeout(timer);
        skipResolvers.delete(finish);
        document.removeEventListener('keydown', onKey);
        detach();
      }
    });
  }

  // ===== RPG 地图渲染 =====
  function descSummary(desc) {
    const s = String(desc || '').replace(/\[[^\]]*\]/g, '').trim();
    return s.length > 20 ? s.slice(0, 20) + '…' : s;
  }

  function renderMapView(map, curLoc, dayInfo) {
    if (!mapEl) return;
    if (battleEl) battleEl.classList.add('hidden');
    if (storyEl) storyEl.classList.add('hidden');
    mapEl.classList.remove('hidden');

    const S = Engine.getState();
    const ch = S.chapter;
    const phaseName = (dayInfo && dayInfo.phase === 'night') ? '夜晚' : '白天';
    const day = dayInfo ? dayInfo.day : 1;
    const ap = dayInfo ? dayInfo.ap : 0;

    if (mapHead) {
      const apWarn = ap <= 0 ? ' ap-warn' : '';
      mapHead.innerHTML = '<span class="map-title">第' + ch + '章 · 夜见市</span><span class="map-info">第' + day + '天 · ' + phaseName + '</span>' +
        '<span id="mapApBadge" class="map-ap' + apWarn + '">AP ' + ap + '/' + maxAPOf() + '</span>';
    }

    const svg = document.getElementById('mapSvg') || mapSvg;
    const nodesEl = document.getElementById('mapNodes') || mapNodes;
    if (svg) svg.innerHTML = '';
    if (nodesEl) nodesEl.innerHTML = '';
    if (!nodesEl) return;

    const locById = {};
    map.forEach(l => locById[l.id] = l);

    if (svg) {
      const edges = [];
      const drawn = new Set();
      map.forEach(l => {
        (l.conns || []).forEach(cid => {
          const t = locById[cid];
          if (!t || !l.x || !t.x) return;
          const key = [l.id, cid].sort().join(':');
          if (drawn.has(key)) return;
          drawn.add(key);
          edges.push('<line class="map-edge" x1="' + l.x + '" y1="' + l.y + '" x2="' + t.x + '" y2="' + t.y + '"/>');
        });
      });
      svg.innerHTML = edges.join('');
    }

    const reachIds = new Set();
    if (typeof World !== 'undefined' && World.getReachable) {
      World.getReachable(ch, curLoc).forEach(l => reachIds.add(l.id));
    }

    // 计算节点包围盒（含节点自身约 120px 宽），把地图偏移到容器 (0,0)，
    // 配合 overflow 滚动让地图可平移且内容不偏左上角。
    const NODE_PAD = 120;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    map.forEach(l => {
      if (l.x == null || l.y == null) return;
      if (l.x < minX) minX = l.x;
      if (l.y < minY) minY = l.y;
      if (l.x > maxX) maxX = l.x;
      if (l.y > maxY) maxY = l.y;
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
    const bboxW = (maxX - minX) + NODE_PAD;
    const bboxH = (maxY - minY) + NODE_PAD;
    const bboxTx = 'translate(' + (-minX) + 'px, ' + (-minY) + 'px)';
    if (nodesEl) {
      nodesEl.style.width = bboxW + 'px';
      nodesEl.style.height = bboxH + 'px';
      nodesEl.style.transform = bboxTx;
    }
    if (svg) {
      svg.style.width = bboxW + 'px';
      svg.style.height = bboxH + 'px';
      svg.style.transform = bboxTx;
    }

    map.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'map-node';
      btn.dataset.loc = l.id;
      btn.style.left = l.x + 'px';
      btn.style.top = l.y + 'px';
      btn.innerHTML = esc(l.name) + (l.desc ? '<span class="node-tag">' + esc(descSummary(l.desc)) + '</span>' : '');

      if (l.id === curLoc) btn.classList.add('cur');
      else if (!reachIds.has(l.id)) {
        btn.classList.add('locked');
        btn.disabled = true;
      }

      if (typeof World !== 'undefined' && World.hasPendingEvent && btn.disabled !== true) {
        const ph = (dayInfo && dayInfo.phase) || S.phase || 'day';
        if (World.hasPendingEvent(ch, l.id, ph, S)) btn.classList.add('evt');
      }

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (l.id === curLoc) {
          onCurrentLocClick(l);
        } else if (typeof Game !== 'undefined' && Game.moveTo) {
          const ok = Game.moveTo(l.id);
          // AP 不足时给出反馈
          if (ok === false) {
            const S2 = Engine.getState();
            if (S2 && typeof S2.ap === 'number' && S2.ap <= 0) {
              showToast('行动点已耗尽，休息或等次日再行动', 'warn');
              flashAPBadge();
            }
          }
        }
      });
      nodesEl.appendChild(btn);
    });

    // 地图显示后自动滚动视口到"当前地点"附近居中
    if (mapCanvas && curLoc && locById[curLoc] && locById[curLoc].x != null) {
      const c = locById[curLoc];
      const px = c.x - minX;
      const py = c.y - minY;
      const doScroll = () => {
        if (!mapCanvas) return;
        const cw = mapCanvas.clientWidth || 0;
        const ch = mapCanvas.clientHeight || 0;
        mapCanvas.scrollLeft = px - cw / 2;
        mapCanvas.scrollTop = py - ch / 2;
      };
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(doScroll);
      } else {
        doScroll();
      }
    }

    renderMapFoot(day, phaseName, ap);
  }

  function onCurrentLocClick(loc) {
    if (typeof World === 'undefined' || typeof Game === 'undefined') return;
    const S = Engine.getState();
    const ev = World.rollEvent(S.chapter, loc.id, S.phase || 'day', S);
    if (ev) {
      // 每日限量检查：先于 AP 消耗给出提示
      if (!ev.once && typeof DayCycle !== 'undefined' && DayCycle.canTriggerEvent) {
        const limit = typeof Game !== 'undefined' && Game.DAILY_EVENT_LIMIT ? Game.DAILY_EVENT_LIMIT : 2;
        const st = DayCycle.canTriggerEvent(S, ev.id || ev.scene || ev.enemy, limit);
        if (!st.ok) {
          showToast('今天的行动已耗尽（' + st.count + '/' + st.limit + '）', 'warn');
          return;
        }
      }
      const ok = Game.fireAt(loc.id);
      if (ok === false) {
        const S2 = Engine.getState();
        if (S2 && typeof S2.ap === 'number' && S2.ap <= 0) {
          showToast('行动点已耗尽，休息或等次日再行动', 'warn');
          flashAPBadge();
        } else {
          showToast('现在无法触发事件', 'warn');
        }
      }
    } else {
      showDialog('这里没有事可做');
    }
  }

  function renderMapFoot(day, phaseName, ap) {
    if (!mapFoot) return;
    mapFoot.innerHTML = '';
    const info = document.createElement('div');
    info.id = 'mapInfo';
    info.className = 'map-desc';
    const S = typeof Engine !== 'undefined' && Engine.getState();
    const ch = S && S.chapter;
    // 主线门槛：未解锁时显示还需天数（渐进门槛：每推进一段需多待一天）
    let gateText = '';
    let gateLocked = false;
    let gateNeed = 0;
    if (typeof Game !== 'undefined' && Game.getMainlineGate && S && ch) {
      const st = Game.getMainlineGate(ch);
      if (st && !st.unlocked) {
        gateLocked = true;
        gateNeed = st.need;
        gateText = ' · 主线锁定：还需 ' + st.need + ' 天可推进';
      } else {
        gateText = ' · 主线已可推进';
      }
    } else if (typeof Game !== 'undefined' && Game.isMainlineUnlocked && S && ch) {
      const st = Game.isMainlineUnlocked(ch, 1);
      if (st && !st.unlocked) {
        gateLocked = true;
        gateNeed = st.need;
        gateText = ' · 主线锁定：还需 ' + st.need + ' 天可推进';
      } else {
        gateText = ' · 主线已可推进';
      }
    } else {
      const goalReady = typeof DayCycle !== 'undefined' && DayCycle.mainReady && S && ch &&
        DayCycle.mainReady(S, ch, 1);
      gateText = goalReady ? ' · 主线已可推进' : ' · 休息/探索推进日程以解锁主线';
    }
    info.textContent = '行动点 ' + ap + '/' + maxAPOf() + ' · ' + phaseName + ' · 第' + day + '天' + gateText;
    if (gateLocked) info.classList.add('map-gate-locked');
    const actions = document.createElement('div');
    actions.id = 'mapActions';
    actions.className = 'map-actions';
    const restBtn = document.createElement('button');
    restBtn.className = 'map-btn';
    restBtn.textContent = '休息';
    restBtn.addEventListener('click', () => {
      if (typeof Game !== 'undefined' && Game.passTime) Game.passTime();
    });
    const mainBtn = document.createElement('button');
    mainBtn.className = 'map-btn mainline-btn' + (gateLocked ? ' mainline-locked' : '');
    mainBtn.textContent = gateLocked ? '继续主线（还需' + gateNeed + '天）' : '继续主线';
    mainBtn.addEventListener('click', () => continueMainline());
    const shopBtn = document.createElement('button');
    shopBtn.className = 'map-btn';
    shopBtn.textContent = '商店';
    shopBtn.addEventListener('click', () => { if (guardFreePhase('商店')) showShopPanel(); });
    const equipBtn = document.createElement('button');
    equipBtn.className = 'map-btn';
    equipBtn.textContent = '装备';
    equipBtn.addEventListener('click', () => { if (guardFreePhase('装备')) showEquipPanel(); });
    actions.appendChild(restBtn);
    actions.appendChild(mainBtn);
    actions.appendChild(shopBtn);
    actions.appendChild(equipBtn);
    // 车站：区域间唯一交通枢纽 —— 提供"旅行"按钮
    const inStation = typeof Game !== 'undefined' && Game.getCurrentLoc && Game.getCurrentLoc() === 'station';
    if (inStation) {
      const travelBtn = document.createElement('button');
      travelBtn.className = 'map-btn travel-btn';
      travelBtn.textContent = '旅行';
      travelBtn.addEventListener('click', () => showTravelPanel());
      actions.appendChild(travelBtn);
    }
    mapFoot.appendChild(info);
    mapFoot.appendChild(actions);
  }

  // ===== 地图拖拽平移 =====
  // 鼠标按住拖动 mapCanvas 平移视口；位移 >10px 视为拖拽，
  // 拖拽结束后抑制紧随的 click，避免误触发节点按钮。
  // 触屏由 overflow 原生滚动处理，不拦截、不 preventDefault。
  function initMapDrag() {
    if (!mapCanvas) return;
    mapCanvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      _mapDrag = {
        id: e.pointerId,
        x: e.clientX, y: e.clientY,
        sl: mapCanvas.scrollLeft, st: mapCanvas.scrollTop,
        moved: false
      };
      try { mapCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      mapCanvas.classList.add('dragging');
    });
    mapCanvas.addEventListener('pointermove', (e) => {
      if (!_mapDrag || e.pointerId !== _mapDrag.id) return;
      const dx = e.clientX - _mapDrag.x;
      const dy = e.clientY - _mapDrag.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) _mapDrag.moved = true;
      if (_mapDrag.moved) {
        mapCanvas.scrollLeft = _mapDrag.sl - dx;
        mapCanvas.scrollTop = _mapDrag.st - dy;
      }
    });
    const endDrag = (e) => {
      if (!_mapDrag || e.pointerId !== _mapDrag.id) return;
      const wasDrag = _mapDrag.moved;
      _mapDrag = null;
      mapCanvas.classList.remove('dragging');
      if (wasDrag) suppressMapClickOnce();
    };
    mapCanvas.addEventListener('pointerup', endDrag);
    mapCanvas.addEventListener('pointercancel', endDrag);
  }

  // 拖拽后抑制随后的 click（捕获阶段拦截，阻止其冒泡到节点按钮）
  function suppressMapClickOnce() {
    if (!mapCanvas) return;
    const handler = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      mapCanvas.removeEventListener('click', handler, true);
    };
    mapCanvas.addEventListener('click', handler, true);
    setTimeout(() => { if (mapCanvas) mapCanvas.removeEventListener('click', handler, true); }, 150);
  }

  // ===== 车站旅行面板 =====
  // 车站是区域间唯一交通枢纽：列出当前章所有可到达区域，选择后消耗行动点传送。
  function showTravelPanel() {
    if (typeof Game === 'undefined' || !Game.getCurrentLoc || !mapFoot || !mapFoot.parentNode) return;
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    const chapter = (typeof Game !== 'undefined' && Game.getChapter) ? Game.getChapter() : null;
    const curLoc = Game.getCurrentLoc();

    // 区域列表（World.getDistricts 由后续 A3 任务提供，未就绪则兜底取全地图）
    let districts = [];
    if (typeof World !== 'undefined' && World.getDistricts) {
      districts = World.getDistricts(chapter) || [];
    } else if (typeof World !== 'undefined' && World.getMap) {
      districts = World.getMap(chapter) || [];
    }

    // 旅行行动点消耗（COST.travel 由 A3 在 daycycle.js 中定义，缺省 1）
    let apCost = 1;
    if (typeof DayCycle !== 'undefined' && DayCycle.COST && typeof DayCycle.COST.travel === 'number') {
      apCost = DayCycle.COST.travel;
    }
    const apOK = !S || typeof S.ap !== 'number' || S.ap >= apCost;

    // 自定义模态框（沿用 .dialog 遮罩，按钮列表用内联样式，避免改 style.css）
    const overlay = document.createElement('div');
    overlay.id = 'travelPanel';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:60;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--panel);border:1px solid var(--accent);padding:18px 22px;max-width:420px;width:min(88vw,420px);max-height:72vh;overflow-y:auto;color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.6;box-shadow:0 0 30px rgba(143,143,255,.25);';
    let html = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:10px;">选择目的地</div>';
    html += '<div style="color:var(--fg-dim);font-size:11px;margin-bottom:12px;">当前：车站前 · 旅行消耗行动点 ' + apCost + (apOK ? '' : '（不足）') + '</div>';
    if (!apOK) {
      html += '<div style="color:var(--red-hi);font-size:12px;margin-bottom:10px;">行动点不足</div>';
    }
    if (!districts.length) {
      html += '<div style="color:var(--fg-dim);padding:8px 0;">没有可到达的区域。</div>';
    }
    for (const d of districts) {
      const here = d && d.id === curLoc;
      const disabled = here || !apOK;
      html += '<button class="map-btn travel-district" data-did="' + esc(d.id) + '"' +
        (disabled ? ' disabled' : '') +
        ' style="display:block;width:100%;text-align:left;margin:6px 0;' +
        (here ? 'opacity:.4;cursor:default;' : '') +
        '">' +
        '<span style="font-size:13px;">' + esc(d.name) + (here ? '（当前）' : '') + '</span>' +
        (d.desc ? '<span class="node-tag" style="display:block;font-size:10px;color:var(--fg-dim);">' + esc(descSummary(d.desc)) + '</span>' : '') +
        '</button>';
    }
    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 关闭
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const escBtn = document.createElement('button');
    escBtn.className = 'map-btn';
    escBtn.textContent = '返回';
    escBtn.style.cssText = 'display:block;width:100%;margin-top:10px;';
    escBtn.addEventListener('click', close);
    box.appendChild(escBtn);

    // 区域按钮：选择 → 关闭面板 → 传送
    box.querySelectorAll('.travel-district').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        close();
        const did = btn.dataset.did;
        if (typeof Game !== 'undefined' && Game.travelToDistrict) {
          Game.travelToDistrict(did);
        } else if (typeof Game !== 'undefined' && Game.moveTo) {
          // 兜底：A3 的 travelToDistrict 未就绪时直接移动
          if (typeof DayCycle !== 'undefined' && DayCycle.spend && S) DayCycle.spend(S, 'travel');
          Game.moveTo(did);
        }
      });
    });
  }

  // ===== 通用模态框（商店/装备/羁绊等面板共用）=====
  // 复用 showTravelPanel 的 overlay 风格；返回 { overlay, box, setContent, close }
  function openModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:61;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--panel);border:1px solid var(--accent);padding:16px 20px;max-width:460px;width:min(90vw,460px);max-height:78vh;overflow-y:auto;color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.6;box-shadow:0 0 30px rgba(143,143,255,.25);';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const esc = document.createElement('button');
    esc.className = 'map-btn';
    esc.textContent = '返回';
    esc.style.cssText = 'display:block;width:100%;margin-top:12px;';
    esc.addEventListener('click', close);
    return { overlay, box, esc, close };
  }

  // 自由行动守卫：商店/装备面板仅允许在自由行动（EXPLORE/MENU）阶段打开。
  // 战斗/对话中打开会破坏流程并允许战斗中刷资源。返回 true 表示放行。
  function guardFreePhase(what) {
    if (typeof Game === 'undefined' || !Game.getPhase || !Game.PHASES) return true; // 无 Game（旧环境/测试）放行
    const p = Game.getPhase();
    if (p === Game.PHASES.EXPLORE || p === Game.PHASES.MENU) return true;
    const state = p === Game.PHASES.BATTLE ? '战斗' : (p === Game.PHASES.DIALOGUE ? '对话' : '当前状态');
    showToast(what + '无法在' + state + '中打开', 'warn');
    return false;
  }

  // 商店面板：买入（含羽衣折扣）+ 卖出（半价），显示金币
  function showShopPanel() {
    if (typeof Data === 'undefined' || !Data.getAllShop) return;
    if (!guardFreePhase('商店')) return;
    const S = Engine.getState();
    const m = openModal();
    const disc = S.shopDiscount || 0;
    const render = () => {
      const st = Engine.getState();
      const money = st.money || 0;
      const shop = Data.getAllShop();
      const buyHtml = Object.keys(shop).map(id => {
        const e = shop[id];
        const def = (e.kind === 'material') ? Data.getMaterial(id) :
          (e.kind === 'equipment' ? Data.getEquipment(id) : Data.getItem(id));
        const eff = def && def.desc ? def.desc : '';
        const price = Math.round(e.price * (1 - disc));
        const owned = st.inventory.find(i => i.id === id);
        return '<div class="shop-row"><div class="shop-info">' +
          '<span class="shop-name">' + esc(e.name) + '</span>' +
          '<span class="shop-eff">' + esc(eff) + '</span></div>' +
          '<span class="shop-price">¥' + price + (disc > 0 ? ' <span class="shop-disc">-'+Math.round(disc*100)+'%</span>' : '') + '</span>' +
          '<button class="save-btn shop-buy" data-id="' + esc(id) + '">买入</button>' +
          (owned ? '<span class="shop-owned">×' + owned.count + '</span>' : '') +
          '</div>';
      }).join('');
      // 卖出列表：背包道具/装备 + 材料
      const sellRows = [];
      for (const it of st.inventory) {
        const def = Data.getItem(it.id) || Data.getEquipment(it.id);
        if (!def) continue;
        const sp = Data.getSellPrice(it.id);
        if (sp <= 0) continue;
        sellRows.push('<div class="shop-row"><span class="shop-name">' + esc(def.name) + ' ×' + it.count + '</span>' +
          '<span class="shop-price">¥' + sp + '/个</span>' +
          '<button class="save-btn shop-sell" data-id="' + esc(it.id) + '">卖出</button></div>');
      }
      for (const [mid, cnt] of Object.entries(st.materials || {})) {
        const def = Data.getMaterial(mid);
        if (!def) continue;
        const sp = Data.getSellPrice(mid);
        if (sp <= 0) continue;
        sellRows.push('<div class="shop-row"><span class="shop-name">' + esc(def.name) + ' ×' + cnt + '</span>' +
          '<span class="shop-price">¥' + sp + '/个</span>' +
          '<button class="save-btn shop-sell" data-id="' + esc(mid) + '">卖出</button></div>');
      }
      m.box.innerHTML = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:6px;">商店</div>' +
        '<div style="font-size:12px;color:var(--gold);margin-bottom:10px;">金币：¥' + money +
        (disc > 0 ? ' <span style="color:var(--fg-dim);font-size:11px;">（羽衣折扣 ' + Math.round(disc * 100) + '%）</span>' : '') + '</div>' +
        '<div style="font-size:12px;color:var(--fg-dim);margin:8px 0 4px;">── 购买 ──</div>' +
        buyHtml +
        (sellRows.length ? '<div style="font-size:12px;color:var(--fg-dim);margin:10px 0 4px;">── 出售（半价）──</div>' + sellRows.join('') : '') +
        '<div style="color:var(--fg-dim);font-size:10px;margin-top:6px;">卖出价为买入价的 50%。</div>';
      m.box.appendChild(m.esc);
      bind(m.box);
    };
    const bind = (root) => {
      root.querySelectorAll('.shop-buy').forEach(b => {
        b.addEventListener('click', () => {
          const r = Engine.buyItem(b.dataset.id, 1);
          if (r.ok) showToast('购入成功：' + (Data.getItem(b.dataset.id)||Data.getEquipment(b.dataset.id)||Data.getMaterial(b.dataset.id)||{}).name);
          else showToast('购买失败：' + (r.msg || '金币不足'), 'warn');
          render();
        });
      });
      root.querySelectorAll('.shop-sell').forEach(b => {
        b.addEventListener('click', () => {
          const r = Engine.sellItem(b.dataset.id, 1);
          if (r.ok) showToast('售出成功 +¥' + r.gained);
          else showToast('出售失败：' + (r.msg || ''), 'warn');
          render();
        });
      });
    };
    render();
  }

  // 装备面板：防具/饰品各一槽，显示属性加成
  function showEquipPanel() {
    if (typeof Data === 'undefined' || !Data.EQUIPMENT) return;
    if (!guardFreePhase('装备')) return;
    const m = openModal();
    const render = () => {
      const st = Engine.getState();
      const eq = Engine.getEquipped();
      const S = Engine.getState();
      const disc = S.shopDiscount || 0;
      const bonusOf = (id) => {
        const g = Data.getEquipment(id);
        if (!g) return '';
        const parts = [];
        if (g.defBonus) parts.push('防御+' + g.defBonus);
        if (g.atkBonus) parts.push('攻击+' + g.atkBonus);
        if (g.spdBonus) parts.push('敏捷+' + g.spdBonus);
        if (g.maxHpBonus) parts.push('生命+' + g.maxHpBonus);
        return parts.join(' ');
      };
      const slotHtml = (slotName, id) => {
        const g = id ? Data.getEquipment(id) : null;
        return '<div class="row"><span class="k">' + slotName + '</span>' +
          '<span class="v' + (g ? '' : ' gray') + '">' + (g ? esc(g.name) : '空') + '</span>' +
          (g ? '<button class="save-btn shop-unequip" data-slot="' + slotName + '" style="width:auto;padding:2px 8px;">卸下</button>' : '') +
          '</div>' +
          (g ? '<div class="row" style="font-size:10px;color:var(--fg-dim);">' + esc(g.desc) + '</div>' : '');
      };
      // 当前属性总览（recalcStats 已纳入装备+羁绊）
      const statsLine = '当前：HP ' + st.hp + '/' + st.maxHp + ' · ATK ' + st.atk + ' · DEF ' + st.def + ' · SPD ' + st.spd;
      const listHtml = Object.keys(Data.EQUIPMENT).map(id => {
        const g = Data.EQUIPMENT[id];
        const owned = st.inventory.find(i => i.id === id);
        const equipped = eq.armor === id || eq.accessory === id;
        const price = Math.round(g.price * (1 - disc));
        return '<div class="shop-row">' +
          '<div class="shop-info"><span class="shop-name">' + esc(g.name) + '</span>' +
          '<span class="shop-eff">' + esc(g.desc) + '</span></div>' +
          '<span class="shop-price">' + (owned ? (equipped ? '已装备' : '持有×' + owned.count) : '¥' + price) + '</span>' +
          (owned && !equipped ? '<button class="save-btn shop-equip" data-id="' + esc(id) + '" data-kind="' + g.kind + '">装备</button>' : '') +
          '</div>';
      }).join('');
      m.box.innerHTML = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:6px;">装备</div>' +
        '<div style="font-size:12px;color:var(--fg-dim);margin-bottom:8px;">' + esc(statsLine) + '</div>' +
        slotHtml('防具', eq.armor) + slotHtml('饰品', eq.accessory) +
        '<div style="font-size:12px;color:var(--fg-dim);margin:10px 0 4px;">── 可装备 ──</div>' +
        listHtml;
      m.box.appendChild(m.esc);
      bind(m.box);
    };
    const bind = (root) => {
      root.querySelectorAll('.shop-equip').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          const r = b.dataset.kind === 'armor' ? Engine.equipArmor(id) : Engine.equipAccessory(id);
          if (r.ok) { showToast('已装备'); render(); }
          else showToast('装备失败：' + (r.msg || ''), 'warn');
        });
      });
      root.querySelectorAll('.shop-unequip').forEach(b => {
        b.addEventListener('click', () => {
          Engine.unequip(b.dataset.slot === '防具' ? 'armor' : 'accessory');
          showToast('已卸下');
          render();
        });
      });
    };
    render();
  }

  function continueMainline() {
    if (typeof Game === 'undefined' || !Game.getChapter) { showDialog('主线功能待接入'); return; }
    const ch = Game.getChapter();
    // 门槛前置检查：未解锁时提示"还需X天"并返回，不触发剧情
    if (typeof Game.getMainlineGate === 'function') {
      const gate = Game.getMainlineGate(ch);
      if (gate && !gate.unlocked) {
        showDialog('主线尚未解锁：还需 ' + gate.need + ' 天可推进。');
        return;
      }
    } else if (typeof Game.isMainlineUnlocked === 'function') {
      const gate = Game.isMainlineUnlocked(ch, 1);
      if (gate && !gate.unlocked) {
        showDialog('主线尚未解锁：还需 ' + gate.need + ' 天可推进。');
        return;
      }
    }
    // 通过 Game.advanceMainline 走天数门槛推进
    if (typeof Game.advanceMainline === 'function') {
      if (typeof Game.setPhase !== 'undefined' && Game.PHASES) {
        Game.setPhase(Game.PHASES.DIALOGUE);
      }
      const req = (typeof Game.getMainlineGate === 'function')
        ? (Game.getMainlineGate(ch) || {}).requireDays : 1;
      const st = Game.advanceMainline(ch, req);
      // 未解锁时 Game.advanceMainline 已通过 view.log 提示，这里无需重复 toast
      return;
    }
    // 旧路径兜底
    const MAINLINE_START = { 1: 'chapter1_1', 2: 'chapter2_1', 3: 'chapter3_1' };
    const start = MAINLINE_START[ch];
    if (!start) { showDialog('主线功能待接入'); return; }
    if (typeof Game !== 'undefined' && Game.setPhase && Game.PHASES) {
      Game.setPhase(Game.PHASES.DIALOGUE);
    }
    runScene(start);
  }

  function startExplore() {
    Engine.clearSlot();
    Engine.clearAuto();
    Engine.setState(Engine.newGame('normal'));
    bootEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    endEl.classList.add('hidden');
    startTimer();
    initHUD();
    if (typeof Game !== 'undefined' && Game.explore) {
      Game.explore(1);
    } else {
      showDialog('探索模式需要 RPG 核心模块（core/game.js）支持。');
    }
  }

  return { init, runScene, startBattle, showBattle, battleLog, promptAction, promptItem, setTurnActive, getActionList,
    enemyEl, playerEl, shakeEnemy, shakePlayer, shakeHard, flashCrit, transformFlash, pulseEro,
    setCombo, setEnemySprite, updateEnemyBar, renderBattleBars, updateBattleState, dieAndRetry,
    showDialog, hideDialog, showEnding, scheduleEnding, wait, updateHUD, renderStatus, updateSidePanel, setTypeSpeed };
})();

if (typeof window !== 'undefined') window.App = App;

// ---- 启动 ----
document.addEventListener('DOMContentLoaded', () => App.init());