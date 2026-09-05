/* =========================================================
 * 白月茧响 - 对话渲染模块（从 main.js 拆分）
 * 依赖注入：init({ dom: {...}, hooks: {...} })
 *  - dom:  main.js 初始化后的 DOM 元素引用
 *  - hooks: main.js 内部函数 / 配置（startBattle/followBottom/...）
 * 全局引用 Engine/Story/Game/World/Battle（index.html 按序加载）
 * ========================================================= */
'use strict';

window.DialogueUI = (() => {

  // 对话引擎内部状态（原 main.js App 私有状态迁移至此）
  let choiceLock = false;
  let currentSceneId = '';
  let typing = false;
  let textSkip = false;
  let pendingEnding = null;
  let typeSpeed = 50; // 每字 ms，0=立即显示（测试用）
  let skipResolvers = new Set();

  // 注入的 DOM 元素（init 时从 main.js 传入）
  let D = {};
  // 注入的 hook 函数（main.js 内部函数 / 配置）
  let H = {};

  function init(cfg) {
    D = (cfg && cfg.dom) || {};
    H = (cfg && cfg.hooks) || {};
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ===== 对话框 =====
  function showDialog(msg) {
    D.dialogEl.classList.remove('hidden');
    D.dialogBox.textContent = msg;
    D.dialogEl.addEventListener('click', hideDialog, { once: true });
  }
  function hideDialog() {
    D.dialogEl.classList.add('hidden');
  }

  // ===== 结局画面 =====
  function scheduleEnding(ending) {
    // 不再自动定时跳转：仅记录待展示的结局，
    // 由 runScene 在 end_roll 文本播完后等待用户点击/按键再触发 showEnding
    pendingEnding = ending;
  }
  function showEnding(ending) {
    if (H.clearTimerInterval) H.clearTimerInterval();
    Battle.stop();
    D.gameEl.classList.add('hidden');

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
    D.endArt.textContent = e.art.map(a=>a.s).join('\n');
    D.endTitle.textContent = e.title;
    D.endSub.textContent = e.sub;
    D.endStats.innerHTML = [
      '<div class="row"><span class="k">游戏时间</span><span class="v">'+Engine.formatTime(S.playTime)+'</span></div>',
      '<div class="row"><span class="k">等级</span><span class="v">Lv.'+S.level+'</span></div>',
      '<div class="row"><span class="k">击杀</span><span class="v">'+S.kills+'</span></div>',
      '<div class="row"><span class="k">总伤害</span><span class="v">'+S.damageDealt+'</span></div>',
      '<div class="row"><span class="k">死亡次数</span><span class="v">'+S.deaths+'</span></div>',
      '<div class="row"><span class="k">最终侵蚀</span><span class="v">'+S.ero+'%</span></div>',
    ].join('');
    D.endEl.classList.remove('hidden');
  }

  // ===== 打字机效果（视觉小说式逐字显示） =====
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
        if (D.battleEl && !D.battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      const detach = H.registerTap(() => {
        if (!typing) return;
        if (D.battleEl && !D.battleEl.classList.contains('hidden')) return;
        finish();
      }, { within: D.storyScroll });

      document.addEventListener('keydown', onKey);
      const timer = setInterval(() => {
        idx = nextChar(idx);
        el.innerHTML = parseMarkup(raw.slice(0, idx));
        H.followBottom();
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
        if (D.battleEl && !D.battleEl.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      const detach = H.registerTap(() => {
        if (!typing) return;
        if (D.battleEl && !D.battleEl.classList.contains('hidden')) return;
        finish();
      }, { within: D.storyScroll });
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
      const detach = H.registerTap(() => finish(), { within: D.storyScroll });
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
      };
      document.addEventListener('keydown', onKey);
      // 兜底：60 秒无操作也推进，避免永远卡住
      timeout = setTimeout(finish, 60000);
    });
  }

  // ===== 返回地图（@map 原语）=====
  // 选项目标 next === '@map'（或场景 next: @map）：结束对话，回到当前章节地图。
  // 与 CHAPTER_MAP_ENTRY 自动入图一致，把 S.scene 记为 '@map:<chapter>'，
  // 读档时由 MenuUI.continueFromSavedScene 直接恢复地图视图。
  function exitToMap() {
    const S = Engine.getState();
    if (typeof S.chapter === 'number' && S.chapter > 0) S.scene = '@map:' + S.chapter;
    choiceLock = false;
    if (D.choicesEl) D.choicesEl.innerHTML = '';
    if (D.storyScroll) D.storyScroll.classList.remove('has-choices');
    Engine.autoSave();
    if (typeof Game !== 'undefined' && Game.returnToMap) {
      Game.returnToMap();
    } else {
      // 兜底：Game 未就绪时手动切回地图视图
      D.storyEl.classList.add('hidden');
      if (D.mapEl) D.mapEl.classList.remove('hidden');
    }
  }

  // ===== 场景执行 =====
  async function runScene(id) {
    if (choiceLock) return;
    if (typeof id === 'string' && id.indexOf('@map:') === 0) return;
    if (id === '@map') { exitToMap(); return; }
    const S = Engine.getState();
    const scene = Story.get(id);
    if (!scene) { console.error('场景不存在:', id); return; }

    currentSceneId = id;
    S.scene = id;
    pendingEnding = null;
    D.storyEl.classList.remove('hidden');
    if (D.mapEl) D.mapEl.classList.add('hidden');
    D.battleEl.classList.add('hidden');
    D.storyScroll.scrollTop = D.storyScroll.scrollHeight;
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
    H.updateHUD();

    // 渲染文本
    const text = scene.text;
    D.storyText.innerHTML = '';
    let lines = Array.isArray(text) ? text : [text];

    // 处理条件文本
    let finalLines = [];
    for (const line of lines) {
      if (typeof line === 'string') {
        const processed = line.replace(/\{name\}/g, H.esc(S.name)).replace(/\{trueName\}/g, H.esc(S.trueName));
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
        D.storyText.appendChild(br);
      }
      const el = document.createElement('div');
      el.className = 'line';
      D.storyText.appendChild(el);
      H.followBottom();
      await typeLine(el, lines[i]);
      if (textSkip) { textSkip = false; }
    }
    typing = false;

    // 转场效果
    if (scene.transition) {
      await wait(300);
      D.storyText.innerHTML += '<div class="sep">─  ─  ─  ─  ─  ─  ─</div>';
      D.storyScroll.scrollTop = D.storyScroll.scrollHeight;
      await wait(400);
    }

    // 触发战斗
    if (scene.battle) {
      choiceLock = false;
      await wait(500);
      await H.startBattle({
        enemy: H.withRetryEnemy(scene.battle.enemy),
        onWin: async (enemy) => {
          const WS = Engine.getState();
          WS.retryCount = 0;
          if (WS.retryEnemyMult != null) WS.retryEnemyMult = 1;
          if (scene.battle.next) await runScene(scene.battle.next);
        },
        onLose: async (enemy) => {
          if (scene.battle.loseScene) { await runScene(scene.battle.loseScene); }
          else { await H.dieAndRetry(); }
        },
      });
      return;
    }

    // 选项
    D.choicesEl.innerHTML = '';
    choiceLock = false;
    if (scene.choices && scene.choices.length > 0) {
      // 选项出现时，给文本底部让出空间（上移一点，避免被选项遮住）
      D.storyScroll.classList.add('has-choices');
      // 键盘快捷键（点击任意选项后移除，避免残留到下一场景）
      const sceneId = currentSceneId;
      const handler = (e) => {
        if (currentSceneId !== sceneId) { document.removeEventListener('keydown', handler); return; }
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          const btns = D.choicesEl.querySelectorAll('.choice-btn');
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
          D.choicesEl.innerHTML = '';
          D.storyScroll.classList.remove('has-choices');
          if (ch.effect) ch.effect(S);
          if (ch.flag) S.flags[ch.flag] = true;
          if (ch.chapter !== undefined) {
            S.chapter = ch.chapter;
            if (typeof Game !== 'undefined' && Game.setChapter) Game.setChapter(ch.chapter);
          }
          H.updateHUD();
          Engine.autoSave();
          // 主线断点：本场景为主线推进边界时，做出选择后停止连播并返回地图
          if (typeof Game !== 'undefined' && Game.isMainlineBoundary && Game.isMainlineBoundary(currentSceneId)) {
            if (typeof Game.clearMainlineBoundary === 'function') Game.clearMainlineBoundary();
            Game.returnToMap && Game.returnToMap();
            return;
          }
          // @map 原语：选项目标恰为 '@map' 时结束对话、返回当前章节地图（鼠标与键盘共用此路径）
          if (ch.next === '@map') { exitToMap(); return; }
          if (ch.next) runScene(ch.next);
        });
        D.choicesEl.appendChild(btn);
      }
      setTimeout(() => document.removeEventListener('keydown', handler), 5000);
    } else if (scene.next) {
      // 点击 / 回车后才进入下一场景（不自动刷掉文字）
      await waitForClick();
      choiceLock = false;
      Engine.autoSave();
      // 自然融入：章节开头自动进入对应章节地图（RPG 自由行动层）
      const mapChapter = H.CHAPTER_MAP_ENTRY[scene.next];
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
      // 结局 credit（end_roll）：文本播完后停在画面上，
      // 显示「点击继续」提示，等待用户点击/按键才进入结局演出
      if (pendingEnding) {
        const end = pendingEnding;
        pendingEnding = null;
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = '— 点击任意处继续 —';
        hint.style.cssText = 'text-align:center;color:var(--fg-dim);animation:blink 1s steps(2) infinite;margin-top:1.5em;';
        D.storyText.appendChild(hint);
        D.storyScroll.scrollTop = D.storyScroll.scrollHeight;
        await waitForClick();
        showEnding(end);
      }
    }
  }

  return {
    init, runScene, parseMarkup, wait, waitForClick, typeLine, waitInterruptible,
    showDialog, hideDialog, scheduleEnding, showEnding, setTypeSpeed, exitToMap,
    get choiceLock() { return choiceLock; },
    set choiceLock(v) { choiceLock = v; },
    get currentSceneId() { return currentSceneId; },
    set currentSceneId(v) { currentSceneId = v; },
    get typing() { return typing; },
    set typing(v) { typing = v; },
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.DialogueUI;
