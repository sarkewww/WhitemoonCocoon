/* =========================================================
 * 白月茧响 - 战斗 UI 模块（从 main.js 拆分 / 引擎版副本）
 * 依赖注入：init({ dom: {...}, hooks: {...} })
 *  - dom:   main.js 初始化后的战斗相关 DOM 元素引用
 *  - hooks: main.js 内部函数 / 回调（startBattle/dieAndRetry 流程编排用）
 * 全局引用 Engine/Battle/Story/Game/DialogueUI（index.html 按序加载）
 *
 * 注意：本文件是引擎化拆分的"引擎版副本"，暂未接线。
 * 主游戏仍使用 main.js 内原有函数，本文件不参与运行（互不冲突）。
 * 接线时由 main.js 调用 BattleUI.init({ dom, hooks }) 并将
 * BattleUI.* 替换原 App.* 战斗函数即可。
 * ========================================================= */
'use strict';

const BattleUI = (() => {

  // 注入的 DOM 元素（init 时从 main.js 传入）
  let D = {};
  // 注入的 hook 函数（main.js 内部函数 / 回调）
  let H = {};

  // 内部状态（原 main.js App 私有状态迁移至此）
  let comboCount = 0;
  let turnCallback = null;
  let battleCtx = null;

  function init(cfg) {
    D = (cfg && cfg.dom) || {};
    H = (cfg && cfg.hooks) || {};
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  // DOM 安全查询：无 DOM 环境（如 node 冒烟测试）返回 null
  function $id(id) {
    return (typeof document !== 'undefined') ? document.getElementById(id) : null;
  }

  // 访问 DialogueUI（全局；缺失时返回 null，保证 node 环境不抛错）
  function dlg() {
    return (typeof DialogueUI !== 'undefined' && DialogueUI) ||
           (typeof window !== 'undefined' && window.DialogueUI) || null;
  }

  // ===== 战斗界面切换 =====
  function showBattle() {
    if (D.storyEl) D.storyEl.classList.add('hidden');
    if (D.battleEl) D.battleEl.classList.remove('hidden');
    if (D.choicesEl) D.choicesEl.innerHTML = '';
    if (D.storyText) D.storyText.innerHTML = '';
    renderBattleBars();
  }

  function renderBattleBars() {
    const S = Engine.getState();
    if (D.battleBars) {
      D.battleBars.innerHTML = `
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
    }
    // combo 显示器只创建一次
    let comboEl = $id('comboDisplay');
    if (!comboEl && D.arena && typeof document !== 'undefined') {
      comboEl = document.createElement('div');
      comboEl.id = 'comboDisplay';
      comboEl.className = 'combo-display';
      D.arena.appendChild(comboEl);
    } else if (comboEl) {
      comboEl.textContent = '';
    }
  }

  function setCombo(n) {
    comboCount = n;
    const el = $id('comboDisplay');
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
    if (D.enemyZone) {
      D.enemyZone.innerHTML = '<div class="enemy-name">' + enemy.title + '</div><div class="enemy-sprite">' + sp.join('\n') + '</div><div class="enemy-hpbar"><div class="fill" id="enemyHpFill" style="width:100%"></div></div><div class="hp-label"><span class="hp-num" id="enemyHpLabel">' + enemy.hp + '</span> / ' + enemy.maxHp + '</div>';
    }
    if (D.playerZone) {
      D.playerZone.innerHTML = '<div class="player-sprite">' + psp.join('\n') + '</div><div class="player-name-b">' + esc(Engine.getState().name) + '</div>';
    }
  }

  function updateEnemyBar(enemy) {
    const fill = $id('enemyHpFill');
    const lbl = $id('enemyHpLabel');
    if (fill) fill.style.width = (enemy.hp/enemy.maxHp*100) + '%';
    if (lbl) lbl.textContent = enemy.hp;
  }

  function updateBattleState() {
    const S = Engine.getState();
    const bars = D.battleBars;
    if (!bars) return;
    const hpFill = bars.querySelector('.bar-hp .fill');
    const spFill = bars.querySelector('.bar-sp .fill');
    const eroFill = bars.querySelector('.bar-ero .fill');
    const hpNum = bars.querySelector('.bar-hp .bar-num');
    const spNum = bars.querySelector('.bar-sp .bar-num');
    const eroNum = bars.querySelector('.bar-ero .bar-num');
    if (hpFill) hpFill.style.width = (S.hp/S.maxHp*100)+'%';
    if (spFill) spFill.style.width = (S.sp/S.maxSp*100)+'%';
    if (eroFill) eroFill.style.width = S.ero+'%';
    if (hpNum) hpNum.textContent = S.hp+'/'+S.maxHp;
    if (spNum) spNum.textContent = S.sp+'/'+S.maxSp;
    if (eroNum) eroNum.textContent = S.ero+'%';
  }

  function battleLog(msg, cls='info') {
    if (!D.battleLogEl) return;
    const el = document.createElement('div');
    el.className = 'blog-line ' + cls;
    el.innerHTML = msg;
    D.battleLogEl.appendChild(el);
    D.battleLogEl.scrollTop = D.battleLogEl.scrollHeight;
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
      if (!D.battleMenu) { resolve(null); return; }
      D.battleMenu.innerHTML = '';
      for (const a of actions) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = '<strong>' + a.label + '</strong> <span class="at">' + a.desc + '</span>';
        btn.disabled = a.disable;
        if (a.disable) btn.style.borderLeftColor = 'var(--blood)';
        btn.addEventListener('click', () => {
          D.battleMenu.innerHTML = '';
          resolve(a.id);
        });
        D.battleMenu.appendChild(btn);
      }
    });
  }

  function promptItem() {
    return new Promise((resolve) => {
      const S = Engine.getState();
      if (!D.battleMenu) { resolve(null); return; }
      D.battleMenu.innerHTML = '';
      if (S.inventory.length === 0) {
        D.battleMenu.innerHTML = '<div style="color:var(--fg-dim);padding:10px;">没有道具。</div>';
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
          D.battleMenu.innerHTML = '';
          resolve(it.id);
        });
        D.battleMenu.appendChild(btn);
      }
      const cancel = document.createElement('button');
      cancel.className = 'action-btn';
      cancel.style.borderLeftColor = 'var(--blood)';
      cancel.innerHTML = '<strong>取消</strong>';
      cancel.addEventListener('click', () => {
        D.battleMenu.innerHTML = '';
        resolve(null);
      });
      D.battleMenu.appendChild(cancel);
    });
  }

  function setTurnActive(cb) {
    turnCallback = cb;
  }

  function enemyEl() { return D.enemyZone; }
  function playerEl() { return D.playerZone; }

  // ===== 打击感（震屏/暴击/侵蚀闪光）=====
  function shakeEnemy(hard) {
    if (!D.enemyZone) return;
    D.enemyZone.classList.remove('anim-enemydamage','anim-shake-hard','anim-hitflash');
    void D.enemyZone.offsetWidth;
    D.enemyZone.classList.add(hard ? 'anim-shake-hard' : 'anim-enemydamage');
  }
  function shakePlayer() {
    if (!D.playerZone) return;
    D.playerZone.classList.remove('anim-playerdamage','anim-hitflash');
    void D.playerZone.offsetWidth;
    D.playerZone.classList.add('anim-playerdamage');
  }
  function battleStageEl() {
    return $id('battleStage') || D.battleStage || null;
  }
  function shakeHard() {
    const stage = battleStageEl();
    if (!stage) return;
    stage.classList.remove('anim-shake-hard');
    void stage.offsetWidth;
    stage.classList.add('anim-shake-hard');
  }
  function flashCrit() {
    const stage = battleStageEl();
    if (!stage) return;
    stage.classList.remove('crit-flash');
    void stage.offsetWidth;
    stage.classList.add('crit-flash');
  }
  function transformFlash() {
    const stage = battleStageEl();
    if (!stage) return;
    stage.style.filter = 'brightness(3)';
    setTimeout(() => stage.style.filter = '', 300);
  }
  function pulseEro() {
    const stage = battleStageEl();
    if (!stage) return;
    stage.style.boxShadow = 'inset 0 0 40px rgba(160,48,80,.25)';
    setTimeout(() => stage.style.boxShadow = '', 600);
  }

  // ===== 战斗开始（流程编排：遇敌→显示→玩家回合→Battle.start）=====
  async function startBattle(cfg) {
    Battle.Sfx.ensure();
    battleCtx = await Battle.start(cfg);
    return battleCtx;
  }

  // ===== 死亡处理 =====
  async function dieAndRetry() {
    const S = Engine.getState();
    if (typeof S.retryCount !== 'number' || isNaN(S.retryCount)) S.retryCount = 0;
    S.retryCount++;
    Engine.autoSave();
    await wait(1000);
    if (S.retryCount >= 3) {
      if (H.showDialog) H.showDialog('连续战败…… 契约的庇护开始动摇。');
      await wait(1500);
      if (H.hideDialog) H.hideDialog();
      showDeathMenu();
      return;
    }
    if (H.showDialog) H.showDialog('绫音倒地了…… 但契约的力量将她拉回现世。');
    await wait(1800);
    if (H.hideDialog) H.hideDialog();
    S.hp = Math.round(S.maxHp * 0.4);
    S.sp = Math.round(S.maxSp * 0.3);
    S.ero = Engine.clamp(S.ero + 5, 0, 100);
    const cur = dlg();
    if (H.runScene) H.runScene(cur ? cur.currentSceneId : '');
  }

  // 连续 3 次战败后的死亡菜单：提供不依赖战斗力的出口（降难度/读档/放弃）
  function showDeathMenu() {
    const S = Engine.getState();
    const cur = dlg();
    const scene = (typeof Story !== 'undefined' && Story.get && cur) ? Story.get(cur.currentSceneId) : null;
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
        if (H.runScene && cur) H.runScene(cur.currentSceneId);
      },
    };
    // 2) 读档
    const optLoad = {
      text: '读取存档',
      fn: () => {
        S.retryCount = 0;
        Engine.autoSave();
        if (H.loadGame) H.loadGame();
      },
    };
    // 3) 放弃本场战斗：优先走 loseScene，否则返回地图 / 跳主线 / 回标题
    const optGive = {
      text: hasLose ? '放弃战斗，接受败北结局' : (canMap ? '放弃战斗，返回地图' : '放弃战斗，跳过本战'),
      fn: () => {
        S.retryCount = 0;
        if (hasLose) { if (H.runScene) H.runScene(battle.loseScene); return; }
        if (canMap) { Game.returnToMap(); return; }
        if (battle && battle.next) { if (H.runScene) H.runScene(battle.next); return; }
        if (H.showTitle) H.showTitle();
      },
    };

    if (Battle && typeof Battle.stop === 'function') Battle.stop();
    if (D.battleEl) D.battleEl.classList.add('hidden');
    if (D.storyEl) D.storyEl.classList.remove('hidden');
    if (cur) cur.choiceLock = false;
    if (D.storyText) {
      D.storyText.innerHTML = '<div class="line" style="color:var(--red-hi);">绫音倒下了。连败的阴影笼罩着她。</div>' +
        '<div class="line" style="color:var(--fg-dim);">眼前的敌人远超她当前的力量——</div>';
    }
    if (D.storyScroll) D.storyScroll.scrollTop = D.storyScroll.scrollHeight;

    if (D.choicesEl) D.choicesEl.innerHTML = '';
    if (D.storyScroll) D.storyScroll.classList.add('has-choices');
    const sceneId = cur ? cur.currentSceneId : null;
    const handler = (e) => {
      if (!cur || cur.currentSceneId !== sceneId) { document.removeEventListener('keydown', handler); return; }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 3) {
        const btns = D.choicesEl.querySelectorAll('.choice-btn');
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
        if (D.choicesEl) D.choicesEl.innerHTML = '';
        if (D.storyScroll) D.storyScroll.classList.remove('has-choices');
        if (cur && cur.choiceLock) return;
        if (cur) cur.choiceLock = false;
        o.fn();
      });
      if (D.choicesEl) D.choicesEl.appendChild(btn);
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

  // ===== HUD 透传（战斗 HUD 刷新委托给注入回调）=====
  function updateHUD() {
    if (H.updateHUD) return H.updateHUD();
  }

  return {
    init,
    wait, esc,
    showBattle, renderBattleBars, setCombo, setEnemySprite,
    updateEnemyBar, updateBattleState, battleLog,
    getActionList, promptAction, promptItem, setTurnActive,
    enemyEl, playerEl,
    shakeEnemy, shakePlayer, shakeHard, flashCrit, transformFlash, pulseEro,
    startBattle, dieAndRetry, showDeathMenu, withRetryEnemy,
    updateHUD,
    get battleCtx() { return battleCtx; },
    get comboCount() { return comboCount; },
    get turnCallback() { return turnCallback; },
  };
})();

if (typeof window !== 'undefined') window.BattleUI = BattleUI;
if (typeof module !== 'undefined' && module.exports) module.exports = BattleUI;
