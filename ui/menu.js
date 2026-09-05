/* =========================================================
 * 白月茧响 - 菜单/启动 UI 模块（从 main.js 拆分的引擎版副本）
 * 依赖注入：init({ dom: {...}, hooks: {...} })
 *  - dom:   启动/标题/HUD/侧栏/面板相关 DOM 元素引用（缺省按 id 查询）
 *  - hooks: runScene / startBattle / renderMapView / DialogueUI
 *           （startNewGame/loadGame 触发主流程的出口全部 hook 化）
 * 全局引用 Game/Engine/Data/Story/Battle/DayCycle（index.html 按序加载）
 *
 * 说明：main.js 中的同名函数是当前线上版本，本文件为独立引擎副本，
 *      仅新增、不修改任何现有文件。
 * ========================================================= */
'use strict';

window.MenuUI = (() => {

  // 注入的 DOM 元素引用 / hook 函数
  let D = {};
  let H = {};

  // ===== DOM 引用（init 时注入或按 id 兜底查询） =====
  let bootEl, bootText, bootHint, bootLogo, gameEl, storyEl,
    endEl, endArt, endTitle, endSub, endStats,
    hudName, hudSub, hudChapter, hudTime,
    statusBox, savebar, panelEl, panelBody, mapEl;

  // 模块内部状态（原 main.js App 私有状态迁移）
  let _toastTimer = null;
  let _timer = 0;
  let _timerInterval = null;
  let selectedDiff = 'normal';

  // 存档面板模态框刷新/关闭回调（由 showSlotsPanel 登记，槽位操作后刷新）
  let _slotsRender = null;
  let _slotsClose = null;

  const DIFF_NAMES = { easy: '新手', normal: '普通', hard: '困难' };
  const RANK_NAMES = { 1: 'R1', 2: 'R2', 3: 'R3', 4: 'R4' };
  const CHAR_NAMES = { yuki: '雪', suzu: '铃', hagoromo: '羽衣' };

  // 移动端防连点：350ms 内同一操作只执行一次（按操作分键，不同操作互不屏蔽）
  const _actionLocks = {};
  function withLock(key, fn) {
    return function(...args) {
      const now = Date.now();
      if (now - (_actionLocks[key] || 0) < 350) return;
      _actionLocks[key] = now;
      return fn.apply(this, args);
    };
  }

  // ===== 基础工具 =====
  function $(id) {
    return (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  }

  // DialogueUI 解析：优先 hooks.DialogueUI，否则回退全局
  function DUI() {
    if (H.DialogueUI) return H.DialogueUI;
    return (typeof window !== 'undefined' && window.DialogueUI) ? window.DialogueUI : null;
  }
  function setChoiceLock(v) {
    const d = DUI();
    if (d) d.choiceLock = v;
  }

  // 主流程出口（全部 hook 化）：runScene / showDialog
  function runScene(id) {
    if (H.runScene) return H.runScene(id);
    const d = DUI();
    if (d && d.runScene) return d.runScene(id);
  }
  function showDialog(msg) {
    const d = DUI();
    if (d && d.showDialog) d.showDialog(msg);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // 当前时段行动点上限（DAY_AP=2 / NIGHT_AP=1，取 DayCycle 权威值）
  function maxAPOf() {
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    if (typeof DayCycle !== 'undefined' && DayCycle.maxAP) return DayCycle.maxAP(S);
    return (S && S.phase === 'night') ? 1 : 2;
  }

  // ===== 顶部 toast / AP 徽章（通用 UI 反馈） =====
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

  function flashAPBadge() {
    const badge = document.getElementById('mapApBadge');
    if (!badge) return;
    badge.classList.remove('ap-flash');
    void badge.offsetWidth;
    badge.classList.add('ap-flash');
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
      '║           ██║╚██╔╝██║██║   ██╗                ║',
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

    const by = '> 杭州 · 星历 2026';
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
    if (_timerInterval) clearInterval(_timerInterval);
    if (typeof Battle !== 'undefined' && Battle.stop) Battle.stop();
    bootSequence();
  }

  // ===== 标题菜单 =====
  async function showTitle() {
    bootText.textContent = '';
    bootHint.textContent = '';
    bootHint.style.animation = 'none';
    bootHint.style.color = 'var(--fg)';
    bootHint.style.fontSize = '14px';
    bootHint.style.letterSpacing = '0';

    const menu = [
      { key: '1', label: '新的游戏' },
      { key: '2', label: '继续游戏' + (hasAnySave() ? ' (有存档)' : ''), fn: () => loadGame() },
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

  // 返回标题：同时响应 keydown Enter 与 bootEl 点击（移动端适配），点击后回到标题。
  // 注意：click 监听必须延迟一个 tick 挂载——否则"打开本页的那一次点击"仍在冒泡，
  // 会在同一事件里触发返回，导致移动端点「关于」/「无存档」瞬间弹回标题（打开即关闭）。
  function bindReturnToTitle(onBack) {
    let disposed = false;
    const handler = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      disposed = true;
      document.removeEventListener('keydown', handler);
      bootEl.removeEventListener('click', handler);
      bootHint.innerHTML = '';
      onBack();
    };
    document.addEventListener('keydown', handler);
    setTimeout(() => { if (!disposed) bootEl.addEventListener('click', handler); }, 0);
  }

  async function showAbout() {
    bootHint.style.animation = 'none';
    bootHint.innerHTML = [
      '《白月茧响》',
      '黑暗魔法少女 · 文字冒险RPG',
      '',
      '主角：白月绫音（白月凌）',
      '世界观：杭州 · 现代都市 · 超自然 · 校园',
      '',
      '触手魔物从人类负面情感中诞生。',
      '与「茧」签订契约，成为魔法少女——',
      '但每一份力量都在侵蚀你的存在。',
      '当茧成熟时，你还会是你吗？',
      '',
      '警告：本游戏包含暴力、恐怖、身体改造、',
      '强制转变等成人内容。',
      '',
      '按 Enter 或 点击 返回',
    ].join('<br>');
    bindReturnToTitle(() => showTitle());
  }

  // ===== 新游戏 / 读档 =====
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
    setChoiceLock(false);
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
      setChoiceLock(false);
      if (!continueFromSavedScene(Engine.getState().scene)) {
        runScene(Engine.getState().scene);
      }
    } else {
      bootHint.innerHTML = '没有存档。<br>点击 或 按 Enter 返回';
      bindReturnToTitle(() => showTitle());
    }
  }

  function startTimer() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timer = Engine.getState().playTime || 0;
    _timerInterval = setInterval(() => {
      _timer++;
      Engine.getState().playTime = _timer;
      hudTime.textContent = Engine.formatTime(_timer);
      if (_timer % 30 === 0) Engine.autoSave();
    }, 1000);
  }

  // 停止计时器（结局/回标题等场景由外部调用，等价于旧 main.js 的 timerInterval 清理）
  function clearTimer() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = null;
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
    const rec = (typeof Data !== 'undefined' && Data.getRecipe) ? Data.getRecipe(k) : null;
    return rec || (((typeof Battle !== 'undefined') && Battle.RECIPES) || {})[k];
  }
  function dataMaterial(k) {
    const mat = (typeof Data !== 'undefined' && Data.getMaterial) ? Data.getMaterial(k) : null;
    return mat || (((typeof Battle !== 'undefined') && Battle.MATERIALS) || {})[k];
  }

  // 羁绊加成格式化（纯逻辑，供侧栏渲染与测试复用）
  function fmtConfidantBonus(b) {
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
  }

  // 羁绊栏 HTML（纯字符串，不含 DOM）
  function renderConfidantHtml(S, cb) {
    if (!cb) return '';
    return ['yuki', 'suzu', 'hagoromo'].map(c => {
      const v = (S.trust && S.trust[c]) || 0;
      const b = cb[c] || {};
      const rn = RANK_NAMES[b.rank] || 'R1';
      const tip = (b.rank || 1) < 4 ? ' · 下一级 R' + ((b.rank||1)+1) + ' 需信任 ' + [30,60,80][b.rank] : ' · 已达最高';
      return '<div class="row"><span class="k">' + CHAR_NAMES[c] + '</span><span class="v">' + v + ' (' + rn + ')</span></div>' +
        '<div class="row" style="font-size:10px;color:var(--fg-dim);">' + fmtConfidantBonus(b) + tip + '</div>';
    }).join('');
  }

  // 侧栏 HTML 构建（纯数据渲染，不含 DOM 注入/事件绑定）
  function buildStatusHtml() {
    const S = Engine.getState();
    const ch = ['序章','第一章','第二章','第三章','终章'][S.chapter]||'序章';
    const freePhase = freePhaseGate() === 'ok';
    const inv = S.inventory.map(i => {
      const d = ((typeof Battle !== 'undefined') && Battle.ITEMS || {})[i.id];
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
    const bondHtml = renderConfidantHtml(S, cb);

    return [
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
      S.skills.map(s => '<div class="row"><span class="k">·</span><span class="v gray">'+((typeof Battle !== 'undefined' && Battle.getActionKey) ? Battle.getActionKey(s) : s)+'</span></div>').join(''),
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
      '<div class="row"><button class="save-btn" data-sys="quest">任务</button></div>' +
      '<div class="row"><button class="save-btn" data-sys="daily">每日活动</button></div>' +
      '<div class="row"><button class="save-btn" data-sys="slots">存档</button></div>',
    ].join('');
  }

  function updateSidePanel(targetPanelEl) {
    const target = targetPanelEl || statusBox;
    if (!target) return;
    target.innerHTML = buildStatusHtml();
    bindSidePanelEvents(target);
  }

  function bindSidePanelEvents(target) {
    target.querySelectorAll('.craft-btn').forEach(b => {
      b.addEventListener('click', () => {
        const r = Engine.craftRecipe(b.dataset.recipe);
        if (r.ok) {
          showDialog('合成成功！获得 '+(r.item.name||'')+' ×'+r.item.count);
          updateSidePanel(target);
        } else {
          showDialog('合成失败：'+r.msg);
        }
      });
    });
    target.querySelectorAll('[data-stat]').forEach(b => {
      b.addEventListener('click', withLock(b.dataset.stat, () => {
        const stat = b.dataset.stat;
        if (stat === 'weapon') {
          const r = Engine.upgradeWeapon();
          if (r.ok) { showDialog('武器强化成功！当前 +'+r.level); updateSidePanel(target); }
          else { showDialog('强化失败：需要暗蚀结晶 ×'+r.need); }
        } else {
          if (Engine.addStat(stat, 1)) {
            showDialog(stat === 'str'?'力量 +1':stat==='vit'?'体力 +1':stat==='spi'?'灵力 +1':'敏捷 +1');
            updateSidePanel(target);
          } else {
            showDialog('属性点不足');
          }
        }
      }));
    });
    target.querySelectorAll('[data-sys]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.sys === 'quest') {
          togglePanel(false);
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.QuestUI && typeof window.QuestUI.showQuestPanel === 'function') {
              window.QuestUI.showQuestPanel();
            } else {
              showToast('任务面板尚未接入', 'warn');
            }
          }, 50);
        }
        else if (b.dataset.sys === 'daily') {
          togglePanel(false);
          setTimeout(() => showDailyPanel(), 50);
        }
        else if (b.dataset.sys === 'slots') {
          togglePanel(false);
          setTimeout(() => showSlotsPanel(), 50);
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

  // ===== 存档槽位（多槽 UI：auto + 槽1-4） =====
  function fmtSavedAt(t) {
    if (t === null || t === undefined || t === '') return '未知时间';
    let d;
    if (t instanceof Date) d = t;
    else if (typeof t === 'number') d = new Date(t);
    else if (/^\d{13,}$/.test(String(t))) d = new Date(Number(t));
    else d = new Date(String(t));
    if (isNaN(d.getTime())) return String(t);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function slotLabel(slot) {
    return (String(slot) === 'auto') ? '自动' : '槽' + slot;
  }

  const CHAPTER_NAMES = ['序章', '第一章', '第二章', '第三章', '终章'];
  function chapterName(c) {
    return CHAPTER_NAMES[c] || '第' + ((c || 0) + 1) + '章';
  }

  function fmtSlotMeta(meta) {
    if (!meta || typeof meta !== 'object') return '';
    const parts = [];
    if (meta.chapter != null) parts.push(chapterName(meta.chapter));
    if (meta.day != null) parts.push('第' + meta.day + '天');
    return parts.join('·');
  }

  function hasAnySave() {
    if (typeof Engine !== 'undefined' && Engine.hasAnySave) {
      try { return !!Engine.hasAnySave(); } catch (e) { return false; }
    }
    return (typeof Engine !== 'undefined' && Engine.hasAuto) ? !!Engine.hasAuto() : false;
  }

  function listSavesSafe() {
    if (typeof Engine !== 'undefined' && Engine.listSaves) {
      try { return Engine.listSaves() || []; } catch (e) { return []; }
    }
    if (typeof Engine !== 'undefined' && Engine.hasAuto && Engine.hasAuto()) {
      let meta = null;
      if (typeof Engine.getAutoMeta === 'function') { try { meta = Engine.getAutoMeta(); } catch (e) {} }
      return [{ slot: 'auto', meta: meta }];
    }
    return [];
  }

  function renderSlotList(saves) {
    const bySlot = {};
    for (const s of (saves || [])) {
      if (s && s.slot != null) bySlot[s.slot] = s;
    }
    const slots = ['auto', 1, 2, 3, 4];
    const rows = [];
    for (const slot of slots) {
      const rec = bySlot[slot];
      const label = slotLabel(slot);
      if (rec && rec.meta) {
        const metaTxt = fmtSlotMeta(rec.meta);
        const stamp = fmtSavedAt(rec.meta.savedAt);
        rows.push(
          '<div class="row"><span class="k">[' + label + ']</span><span class="v">' +
          (metaTxt ? esc(metaTxt) + ' · ' : '') + esc(stamp) + '</span></div>' +
          '<div class="row">' +
          '<button class="save-btn" data-slotop="load" data-slotn="' + esc(slot) + '">读取</button>' +
          '<button class="save-btn" data-slotop="del" data-slotn="' + esc(slot) + '">删除</button>' +
          '</div>'
        );
      } else {
        rows.push(
          '<div class="row"><span class="k">[' + label + ']</span><span class="v gray">空</span></div>' +
          '<div class="row"><button class="save-btn" data-slotop="save" data-slotn="' + esc(slot) + '">' +
          (String(slot) === 'auto' ? '自动存档' : '保存到此处') + '</button></div>'
        );
      }
    }
    return rows.join('');
  }

  function doSave(n) {
    const isAuto = String(n) === 'auto';
    let r = null;
    if (typeof Engine !== 'undefined') {
      if (isAuto) r = (typeof Engine.autoSave === 'function') ? Engine.autoSave() : null;
      else r = (typeof Engine.saveToSlot === 'function') ? Engine.saveToSlot(parseInt(n, 10)) : null;
    }
    let ok;
    if (r && typeof r === 'object') ok = !!r.ok;
    else ok = isAuto && typeof Engine !== 'undefined' && typeof Engine.autoSave === 'function';
    const savedAt = r ? ((r.meta && r.meta.savedAt) || r.savedAt || Date.now()) : Date.now();
    showToast(ok ? '已保存 ' + fmtSavedAt(savedAt) : '存档失败（存储空间不足或隐私模式）', ok ? 'info' : 'warn');
    renderSaveBar();
    if (_slotsRender) _slotsRender();
  }

  function doLoad(n) {
    let loaded = false;
    const isAuto = String(n) === 'auto';
    if (typeof Engine !== 'undefined') {
      if (isAuto) loaded = (typeof Engine.loadAuto === 'function') && !!Engine.loadAuto();
      else if (typeof Engine.loadFromSlot === 'function') {
        const r = Engine.loadFromSlot(parseInt(n, 10));
        if (r) { if (typeof Engine.setState === 'function') Engine.setState(r); loaded = true; }
      } else if (typeof Engine.loadSlot === 'function') {
        loaded = !!Engine.loadSlot();
      }
    }
    if (loaded) {
      const ns = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
      if (ns) { ns.retryCount = 0; ns.retryEnemyMult = 1; }
      showToast('已读取 [' + slotLabel(n) + ']', 'info');
      setChoiceLock(false);
      togglePanel(false);
      if (_slotsClose) _slotsClose();
      if (ns && !continueFromSavedScene(ns.scene)) runScene(ns.scene);
    } else {
      showToast('没有存档。', 'warn');
    }
    renderSaveBar();
    if (_slotsRender) _slotsRender();
  }

  function doDelete(n) {
    let ok = false;
    const isAuto = String(n) === 'auto';
    if (typeof Engine !== 'undefined') {
      if (isAuto && typeof Engine.clearAuto === 'function') { Engine.clearAuto(); ok = true; }
      else if (!isAuto && typeof Engine.deleteSlot === 'function') ok = !!Engine.deleteSlot(parseInt(n, 10));
      else if (typeof Engine.clearSlot === 'function') { Engine.clearSlot(); ok = true; }
    }
    showToast(ok ? '已删除 [' + slotLabel(n) + ']' : '删除失败', ok ? 'info' : 'warn');
    renderSaveBar();
    if (_slotsRender) _slotsRender();
  }

  function bindSlotsActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-slotop]').forEach(b => {
      b.addEventListener('click', () => {
        const op = b.dataset.slotop;
        const n = b.dataset.slotn;
        if (op === 'save') doSave(n);
        else if (op === 'load') doLoad(n);
        else if (op === 'del') doDelete(n);
      });
    });
  }

  function showSlotsPanel() {
    const m = openModal();
    const render = () => {
      m.box.innerHTML = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:6px;">存档</div>' +
        renderSlotList(listSavesSafe());
      m.box.appendChild(m.esc);
      bindSlotsActions(m.box);
    };
    _slotsRender = render;
    _slotsClose = m.close;
    render();
  }

  function renderSaveBar() {
    if (!savebar) return;
    savebar.innerHTML = '<div>存档</div>' + renderSlotList(listSavesSafe());
    bindSlotsActions(savebar);
  }

  function updateHUD() {
    const S = Engine.getState();
    if (S.chapter === 0) hudChapter.textContent = '序章';
    else if (S.chapter === 1) hudChapter.textContent = '第一章';
    else if (S.chapter === 2) hudChapter.textContent = '第二章';
    else if (S.chapter === 3) hudChapter.textContent = '第三章';
    else if (S.chapter === 4) hudChapter.textContent = '终章';
    renderStatus();
  }

  // ===== 每日活动面板 =====
  function dailyCount(S, id) {
    if (id && typeof DayCycle !== 'undefined' && DayCycle.eventCount) {
      try { return DayCycle.eventCount(S, id) || 0; } catch (e) { return 0; }
    }
    return 0;
  }

  function fmtDailyLoc(it) {
    const loc = it.loc || it.location || '';
    let s = '去 ' + (loc || '—');
    if (loc && it.phase) {
      const pt = (it.phase === 'night') ? '夜晚' : '白天';
      if (s.indexOf('·白天') < 0 && s.indexOf('·夜晚') < 0) s += ' · ' + pt;
    }
    return s;
  }

  // ---- 活动事件查找（用于每日活动面板触发）----
  // 在 World/WorldData 中按活动 id 查找对应的事件。
  // 返回 { locId, evIdx, ev } 或 null。
  function findEventByActivityId(id) {
    if (!id) return null;
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    const chapter = (S && typeof S.chapter === 'number') ? S.chapter : 0;
    if (typeof World === 'undefined' || typeof World.getMap !== 'function') return null;
    const map = World.getMap(chapter);
    if (!Array.isArray(map)) return null;
    for (const loc of map) {
      if (!Array.isArray(loc.events)) continue;
      const idx = loc.events.findIndex(e => e && e.id === id);
      if (idx >= 0) return { locId: loc.id, evIdx: idx, ev: loc.events[idx] };
    }
    return null;
  }

  // 外部触发每日活动（由 showDailyPanel 点击或 H.goToActivity hook 调用）
  function goToActivity(id) {
    if (!id) { showToast('活动不可用', 'warn'); return false; }
    const found = findEventByActivityId(id);
    if (!found) { showToast('该活动暂不可用', 'warn'); return false; }
    if (typeof Game !== 'undefined' && typeof Game.fireAt === 'function') {
      const ok = Game.fireAt(found.locId, found.evIdx);
      if (!ok) showToast('现在无法进行该活动', 'warn');
      return ok;
    }
    showToast('活动系统尚未接入', 'warn');
    return false;
  }

  function collectDailies(S, chapter) {
    const list = [];
    const push = (src) => {
      if (!Array.isArray(src)) return;
      for (const e of src) {
        if (!e || typeof e !== 'object') continue;
        // 查找活动对应的事件数据，用于获取 limit
        const eventData = findEventByActivityId(e.id || e.key);
        list.push({
          id: e.id || e.key || '',
          name: e.name || e.title || '',
          loc: e.loc || e.location || '',
          phase: e.phase || e.time || e.when || '',
          ap: (typeof e.ap === 'number' ? e.ap : (typeof e.cost === 'number' ? e.cost : 1)),
          reward: e.reward || e.rewards || e.desc || '',
          type: e.type || '',
          locId: e.locId || e.locid || '',
          limit: (typeof e.limit === 'number') ? e.limit
            : (eventData && typeof eventData.ev.limit === 'number') ? eventData.ev.limit
            : (typeof e.target === 'number' ? e.target : 1),
        });
      }
    };
    // 只从 Quests.getAll 取（已含 type:'daily' 与状态），避免与 QuestConfig.dailies 重复
    if (typeof window !== 'undefined' && window.Quests && typeof window.Quests.getAll === 'function') {
      try {
        const data = window.Quests.getAll(S, chapter);
        if (data && Array.isArray(data.dailies)) push(data.dailies);
      } catch (e) {}
    }
    return list;
  }

  function buildDailyHtml(S, chapter) {
    const items = collectDailies(S, chapter);
    const phase = (S && S.phase === 'night') ? '夜晚' : '白天';
    const day = (S && S.day) || 1;
    const ap = (S && typeof S.ap === 'number') ? S.ap : 0;
    let html = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:6px;">每日活动</div>';
    html += '<div style="font-size:12px;color:var(--gold);margin-bottom:10px;">行动点 ' + ap + '/' + maxAPOf() + ' · ' + phase + ' · 第' + day + '天</div>';
    if (!items.length) {
      html += '<div style="color:var(--fg-dim);padding:8px 0;">今天还没有可进行的活动。</div>';
    } else {
      for (const it of items) {
        const cnt = dailyCount(S, it.id);
        const limit = (typeof it.limit === 'number' && it.limit >= 0) ? it.limit : 1;
        const done = cnt >= limit;
        html += '<div class="row">' +
          '<button class="save-btn daily-go" data-daily="' + esc(it.id) + '" data-locid="' + esc(it.locId || '') + '"' +
          (done ? ' disabled' : '') + ' style="width:auto;padding:2px 8px;">' + esc(it.name) + '</button>' +
          '<span class="k">' + esc(fmtDailyLoc(it)) + '</span>' +
          '<span class="v">AP ' + it.ap + (done ? ' · 今日已完成' : (cnt > 0 ? ' · 今日已做 ' + cnt + ' 次' : '')) + '</span>' +
          (it.reward ? '<span class="v gray" style="font-size:10px;">' + esc(it.reward) + '</span>' : '') +
          '</div>';
      }
    }
    return html;
  }

  function showDailyPanel() {
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    const m = openModal();
    m.box.innerHTML = buildDailyHtml(S, S && S.chapter);
    m.box.appendChild(m.esc);
    m.box.querySelectorAll('.daily-go').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.daily;
        m.close();
        if (H.goToActivity) {
          try { H.goToActivity(id); } catch (e) { showToast('活动触发失败', 'warn'); }
          return;
        }
        goToActivity(id);
      });
    });
  }

  // ===== 通用模态框（商店/装备面板共用） =====
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
  // 阶段判定拆为纯逻辑 freePhaseGate()，供 guardFreePhase 与测试复用。
  function freePhaseGate() {
    if (typeof Game === 'undefined' || !Game.getPhase || !Game.PHASES) return 'ok'; // 无 Game（旧环境/测试）放行
    const p = Game.getPhase();
    if (p === Game.PHASES.EXPLORE || p === Game.PHASES.MENU) return 'ok';
    if (p === Game.PHASES.BATTLE) return '战斗';
    if (p === Game.PHASES.DIALOGUE) return '对话';
    return '当前状态';
  }
  function guardFreePhase(what) {
    const gate = freePhaseGate();
    if (gate === 'ok') return true;
    showToast(what + '无法在' + gate + '中打开', 'warn');
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

  // ===== 初始化：注入 DOM 与 hooks =====
  // cfg.dom 提供元素引用（缺省按 id 兜底查询）；cfg.hooks 提供跨模块回调
  function init(cfg) {
    D = (cfg && cfg.dom) || {};
    H = (cfg && cfg.hooks) || {};

    bootEl = D.bootEl || $('boot');
    bootLogo = D.bootLogo || $('bootLogo');
    bootText = D.bootText || $('bootText');
    bootHint = D.bootHint || $('bootHint');
    gameEl = D.gameEl || $('game');
    storyEl = D.storyEl || $('story');
    hudName = D.hudName || $('hudName');
    hudSub = D.hudSub || $('hudSub');
    hudChapter = D.hudChapter || $('hudChapter');
    hudTime = D.hudTime || $('hudTime');
    statusBox = D.statusBox || $('statusBox');
    savebar = D.savebar || $('savebar');
    endEl = D.endEl || $('end');
    endArt = D.endArt || $('endArt');
    endTitle = D.endTitle || $('endTitle');
    endSub = D.endSub || $('endSub');
    endStats = D.endStats || $('endStats');
    panelEl = D.panelEl || $('panel');
    panelBody = D.panelBody || $('panelBody');
    mapEl = D.mapEl || $('map');
  }

  return {
    init,
    // 主流程入口（引擎接线用）
    showBoot, showTitle, showAbout, bootSequence,
    startNewGame, loadGame, continueFromSavedScene, startExplore,
    startTimer, clearTimer, initHUD, renderStatus, updateHUD, updateSidePanel, togglePanel, renderSaveBar,
    openModal, showShopPanel, showEquipPanel, continueMainline,
    // 通用 UI 反馈
    showToast, flashAPBadge, guardFreePhase,
    // 纯逻辑 / 数据渲染辅助（引擎与测试复用）
    freePhaseGate, fmtConfidantBonus, renderConfidantHtml, buildStatusHtml, withLock,
    dataRecipe, dataMaterial, maxAPOf, esc,
    // 每日活动面板 + 存档槽位（新增）
    showDailyPanel, showSlotsPanel,
    fmtSavedAt, slotLabel, chapterName, fmtSlotMeta, hasAnySave, listSavesSafe, renderSlotList,
    dailyCount, fmtDailyLoc, collectDailies, buildDailyHtml,
    goToActivity, findEventByActivityId,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.MenuUI;
