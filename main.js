/* =========================================================
 * 白月茧响 - 主控制器
 * ========================================================= */
'use strict';

const App = (() => {

  let bootEl, bootText, bootHint, bootLogo, gameEl, storyEl, storyText, choicesEl,
    battleEl, battleLogEl, battleMenu, enemyZone, playerZone, hudName, hudSub, hudChapter, hudTime,
    statusBox, savebar, cmd, dialogEl, dialogBox, endEl, endArt, endTitle, endSub, endStats,
    storyScroll, battleBars, arena,
    panelEl, panelBody, menuBtn, panelClose;

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

    const handler = () => {
      bootHint.textContent = '';
      document.removeEventListener('keydown', handler);
      bootEl.removeEventListener('click', handler);
      showTitle();
    };
    document.addEventListener('keydown', (e) => { if (e.key==='Enter') handler(); });
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
      if (n >= 1 && n <= 4) { cleanup(); doChoice(n - 1); }
    };
    const onClick = (e) => {
      const btn = e.target.closest ? e.target.closest('.title-btn') : null;
      if (btn) { cleanup(); doChoice(parseInt(btn.dataset.i)); }
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
  function startNewGame(diff) {
    Engine.clearSlot();
    Engine.clearAuto();
    Engine.setState(Engine.newGame(diff));
    bootEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    endEl.classList.add('hidden');
    startTimer();
    initHUD();
    runScene('prologue_1');
  }

  function loadGame() {
    if (Engine.loadAuto()) {
      bootEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      endEl.classList.add('hidden');
      startTimer();
      initHUD();
      runScene(Engine.getState().scene);
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

  function updateSidePanel(panelEl) {
    const S = Engine.getState();
    const ch = ['序章','第一章','第二章','第三章','终章'][S.chapter]||'序章';
    const inv = S.inventory.map(i => {
      const d = (Battle.ITEMS||{})[i.id];
      return d ? `<div class="row"><span class="k">·</span><span class="v gray">${d.name} ×${i.count}</span></div>` : '';
    }).join('');
    const mats = Object.entries(S.materials).map(([k,v]) => {
      const d = (Battle.MATERIALS||{})[k];
      return d ? `<div class="row"><span class="k">·</span><span class="v gray">${d.name} ×${v}</span></div>` : '';
    }).join('');
    const craftBtns = Object.entries(S.recipes).map(([k]) => {
      const r = (Battle.RECIPES||{})[k];
      if (!r) return '';
      const costStr = Object.entries(r.cost).map(([m,n]) => {
        const md = (Battle.MATERIALS||{})[m];
        return (md?md.name:m)+' ×'+n;
      }).join(' ');
      return `<div class="row"><button class="save-btn craft-btn" data-recipe="${k}">${r.name}</button></div><div class="row" style="font-size:10px;color:var(--fg-dim);">${costStr}</div>`;
    }).join('');
    const html = [
      '<div class="row"><span class="k">姓名</span><span class="v">'+S.name+'</span></div>',
      '<div class="row"><span class="k">Lv.</span><span class="v">'+S.level+'</span><span class="k">章</span><span class="v">'+ch+'</span></div>',
      '<div class="sec">── 状态 ──</div>',
      '<div class="row"><span class="k">HP</span><span class="v">'+S.hp+'/'+S.maxHp+'</span></div>',
      '<div class="row"><span class="k">SP</span><span class="v">'+S.sp+'/'+S.maxSp+'</span></div>',
      '<div class="row"><span class="k">侵蚀</span><span class="v'+(S.ero>=60?' flag':'')+'">'+S.ero+'%</span></div>',
      '<div class="row"><span class="k">击杀</span><span class="v">'+S.kills+'</span></div>',
      '<div class="row"><span class="k">武器</span><span class="v">+'+S.weaponLevel+'</span><span class="k">属性点</span><span class="v'+(S.ap>0?' flag':'')+'">'+S.ap+'</span></div>',
      '<div class="sec">── 技能 ──</div>',
      S.skills.map(s => '<div class="row"><span class="k">·</span><span class="v gray">'+Battle.getActionKey(s)+'</span></div>').join(''),
      '<div class="sec">── 道具 ──</div>',
      inv || '<div class="row"><span class="k">·</span><span class="v gray">空</span></div>',
      '<div class="sec">── 材料 ──</div>',
      mats || '<div class="row"><span class="k">·</span><span class="v gray">空</span></div>',
      craftBtns ? '<div class="sec">── 合成 ──</div>' + craftBtns : '',
      S.ap > 0 ? '<div class="sec">── 加点 ──</div>' +
        '<div class="row"><button class="save-btn" data-stat="str">力量 +1 (当前 '+(S.stats.str||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="vit">体力 +1 (当前 '+(S.stats.vit||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="spi">灵力 +1 (当前 '+(S.stats.spi||0)+')</button></div>' +
        '<div class="row"><button class="save-btn" data-stat="agi">敏捷 +1 (当前 '+(S.stats.agi||0)+')</button></div>' : '',
      '<div class="sec">── 强化 ──</div>' +
      '<div class="row"><button class="save-btn" data-stat="weapon">强化武器 (当前 +'+(S.weaponLevel||1)+')</button></div>' +
      '<div class="row" style="font-size:10px;color:var(--fg-dim);">需暗蚀结晶 ×'+(S.weaponLevel||1)*2+'</div>' +
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
          if (Engine.hasAuto()) { Engine.loadAuto(); showDialog('读档完成。'); togglePanel(false); runScene(Engine.getState().scene); }
          else { showDialog('没有存档。'); }
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
      Engine.autoSave();
      showDialog('存档已保存。');
    });
    document.getElementById('btnLoad').addEventListener('click', () => {
      if (Engine.hasAuto()) {
        Engine.loadAuto();
        showDialog('读档完成。');
        runScene(Engine.getState().scene);
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
    const S = Engine.getState();
    const scene = Story.get(id);
    if (!scene) { console.error('场景不存在:', id); return; }

    currentSceneId = id;
    S.scene = id;
    storyEl.classList.remove('hidden');
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
        const processed = line.replace(/\{name\}/g, S.name).replace(/\{trueName\}/g, S.trueName);
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
      storyScroll.scrollTop = storyScroll.scrollHeight;
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
        enemy: scene.battle.enemy,
        onWin: async (enemy) => {
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
      for (const ch of scene.choices) {
        if (ch.condition && !ch.condition(S)) continue;
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = ch.text;
        btn.addEventListener('click', () => {
          if (choiceLock) return;
          choiceLock = false;
          choicesEl.innerHTML = '';
          if (ch.effect) ch.effect(S);
          if (ch.flag) S.flags[ch.flag] = true;
          if (ch.chapter !== undefined) S.chapter = ch.chapter;
          updateHUD();
          Engine.autoSave();
          if (ch.next) runScene(ch.next);
        });
        choicesEl.appendChild(btn);
      }
      // 键盘快捷键
      const handler = (e) => {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          const btns = choicesEl.querySelectorAll('.choice-btn');
          if (btns[n-1]) { btns[n-1].click(); document.removeEventListener('keydown', handler); }
        }
      };
      document.addEventListener('keydown', handler);
      setTimeout(() => document.removeEventListener('keydown', handler), 5000);
    } else if (scene.next) {
      await wait(400);
      choiceLock = false;
      Engine.autoSave();
      runScene(scene.next);
    } else {
      choiceLock = false;
    }
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
      .replace(/\[sb\]/g, '<span class="speaker speaker-b">')
      .replace(/\[sc\]/g, '<span class="speaker speaker-c">')
      .replace(/\[sd\]/g, '<span class="speaker speaker-d">')
      .replace(/\[se\]/g, '<span class="speaker speaker-e">')
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
    playerZone.innerHTML = '<div class="player-sprite">' + psp.join('\n') + '</div><div class="player-name-b">' + Engine.getState().name + '</div>';
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

  function promptAction(enemy) {
    return new Promise((resolve) => {
      const S = Engine.getState();
      const actions = [
        { id: 'strike', label: '苍月斩', desc: '普通攻击 · SP+8', cost: 0, disable: false },
        { id: 'pure', label: '净化之矢', desc: '强力攻击 · 消耗SP20', cost: 20, disable: S.sp < 20 },
        { id: 'guard', label: '防御', desc: '减少伤害', cost: 0, disable: false },
        { id: 'erosion', label: '蚀心之触', desc: '超强力攻击 · 侵蚀+12', cost: 0, disable: S.ero >= 100 },
        { id: 'heal', label: '魂愈', desc: '恢复28%HP · 消耗SP15', cost: 15, disable: S.sp < 15 },
        { id: 'item', label: '道具', desc: '使用随身道具', cost: 0, disable: S.inventory.length === 0 },
        { id: 'ultimate', label: '白月破晓', desc: '必杀技 · 需充能', cost: 0, disable: true },
      ];
      // 检查充能
      const ultReady = comboCount >= 8;
      for (const a of actions) {
        if (a.id === 'ultimate') a.disable = !ultReady;
      }

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
    await wait(1000);
    showDialog('绫音倒地了…… 但契约的力量将她拉回现世。');
    await wait(1800);
    hideDialog();
    S.hp = Math.round(S.maxHp * 0.4);
    S.sp = Math.round(S.maxSp * 0.3);
    S.ero = Engine.clamp(S.ero + 5, 0, 100);
    runScene(currentSceneId);
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
    else if (v === 'load') { Engine.loadAuto(); showDialog('读档完成。'); runScene(Engine.getState().scene); }
    else if (v === 'status') { renderStatus(); showDialog('状态已更新。'); }
    else if (v === 'help') { showDialog('指令: save(存档) load(读档) status(状态) help(帮助)'); }
    else if (v === 'clear') { storyText.innerHTML = ''; }
    else { showDialog('未知指令: ' + v + ' (输入 help 查看帮助)'); }
  }

  function wait(ms) { return new Promise(r=>setTimeout(r,ms)); }

  // ===== 打字机效果（视觉小说式逐字显示） =====
  let typeSpeed = 600; // 每字 ms，0=立即显示（测试用）
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

      const onPointer = (e) => {
        if (!typing || battleEl && !battleEl.classList.contains('hidden')) return;
        if (e.target && !(storyScroll.contains(e.target))) return;
        e.preventDefault();
        finish();
      };
      const onKey = (e) => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };

      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('keydown', onKey);
      const timer = setInterval(() => {
        idx = nextChar(idx);
        el.innerHTML = parseMarkup(raw.slice(0, idx));
        storyScroll.scrollTop = storyScroll.scrollHeight;
        if (idx >= raw.length) finish();
      }, interval);
      skipResolvers.add(finish);

      function cleanup() {
        clearInterval(timer);
        skipResolvers.delete(finish);
        document.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('keydown', onKey);
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
      const onPointer = (e) => {
        // 战斗中不打断；只在剧情文字显示阶段生效
        if (!typing || battleEl && !battleEl.classList.contains('hidden')) return;
        // 只响应故事区域内的点击，避免与菜单/面板按钮冲突
        if (e.target && !(storyScroll.contains(e.target))) return;
        e.preventDefault();
        finish();
      };
      const onKey = (e) => {
        if (!typing) return;
        if (battleEl && !battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      const timer = setTimeout(finish, ms);
      skipResolvers.add(finish);
      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('keydown', onKey);
      function cleanup() {
        clearTimeout(timer);
        skipResolvers.delete(finish);
        document.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('keydown', onKey);
      }
    });
  }

  return { init, runScene, startBattle, showBattle, battleLog, promptAction, promptItem, setTurnActive,
    enemyEl, playerEl, shakeEnemy, shakePlayer, shakeHard, flashCrit, transformFlash, pulseEro,
    setCombo, setEnemySprite, updateEnemyBar, renderBattleBars, updateBattleState, dieAndRetry,
    showDialog, hideDialog, showEnding, wait, updateHUD, renderStatus, updateSidePanel, setTypeSpeed };
})();

if (typeof window !== 'undefined') window.App = App;

// ---- 启动 ----
document.addEventListener('DOMContentLoaded', () => App.init());