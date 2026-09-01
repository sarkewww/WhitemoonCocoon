/* =========================================================
 * 白月茧响 - 任务面板 UI（QuestUI）
 * 依赖注入：init({ dom, hooks })
 *  - dom:   可选（暂不需要）
 *  - hooks: esc/showToast/guardFreePhase（缺省用内置兜底）
 * 全局引用 Engine/Quests/QuestConfig/Game/DayCycle（index.html 按序加载）
 *
 * 职责：渲染任务列表（主线/支线/每日/死任务）到一个模态框。
 * ========================================================= */
'use strict';

window.QuestUI = (() => {

  let D = {};
  let H = {};

  function init(cfg) {
    D = (cfg && cfg.dom) || {};
    H = (cfg && cfg.hooks) || {};
  }

  function esc(s) {
    if (H.esc) return H.esc(s);
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  // 地点名 → 中文（缺省回退原 id）
  function locName(locId) {
    if (!locId) return '';
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    const ch = (S && S.chapter) || 0;
    if (typeof World !== 'undefined' && World.getLocation) {
      const l = World.getLocation(ch, locId);
      if (l && l.name) return l.name;
    }
    return locId;
  }

  // 时段 → 中文
  function whenName(w) {
    return w === 'night' ? '夜晚' : (w === 'day' ? '白天' : '');
  }

  // 状态 → 中文 + class
  const STATUS_TXT = {
    locked: '未解锁',
    active: '进行中',
    done: '已完成',
  };

  // 主线区 HTML：显示"第X幕·进行中/已完成" + 进度
  function renderMainlineHtml(mainline, chapter, S) {
    const actName = { 1: '第一幕', 2: '第二幕', 3: '终幕' }[chapter] || ('第' + chapter + '幕');
    if (!mainline.length) {
      return '<div class="quest-sec-title">── 主线 ──</div>' +
        '<div class="quest-row quest-dim">该章节暂无主线。</div>';
    }
    const q = mainline[0];
    const done = q.status === 'done';
    const steps = (q.progress && q.progress.steps) || [];
    // 当前已推进到的断点索引（-1=未开始）
    let idx = -1;
    if (S && S.mainline) {
      const prog = S.mainline[chapter] || null;
      idx = steps.indexOf(prog);
    }
    const shown = idx < 0 ? 0 : idx + 1;
    const total = steps.length;
    const line = done
      ? '第' + actName + ' · 已完成'
      : '第' + actName + ' · 进行中';
    const needTxt = (!done && q.need > 0) ? ' · 还需 ' + q.need + ' 天可推进' : '';
    const progBar = total ? ' ' + shown + '/' + total + ' 段' : '';
    return '<div class="quest-sec-title">── 主线 ──</div>' +
      '<div class="quest-row quest-mainline">' +
      '<span class="quest-name">' + esc(q.name) + '</span>' +
      '<span class="quest-status qs-' + q.status + '">' + STATUS_TXT[q.status] + '</span>' +
      '</div>' +
      '<div class="quest-row quest-sub">' + esc(q.desc) + '</div>' +
      '<div class="quest-row quest-dim">' + line + progBar + needTxt + '</div>';
  }

  // 支线区 HTML
  function renderSidesHtml(sides) {
    let html = '<div class="quest-sec-title">── 支线 ──</div>';
    if (!sides.length) html += '<div class="quest-row quest-dim">暂无支线任务。</div>';
    for (const q of sides) {
      const loc = locName(q.targetLoc);
      const when = whenName(q.targetWhen);
      const where = (loc && when) ? '去 ' + loc + ' · ' + when
        : (loc ? '去 ' + loc : (when ? when + '时段' : ''));
      html += '<div class="quest-row quest-side qs-' + q.status + '">' +
        '<span class="quest-name">' + esc(q.name) + '</span>' +
        '<span class="quest-status qs-' + q.status + '">' + STATUS_TXT[q.status] + '</span>' +
        '</div>' +
        (where ? '<div class="quest-row quest-sub">' + esc(where) + '</div>' : '') +
        (q.desc ? '<div class="quest-row quest-sub">' + esc(q.desc) + '</div>' : '');
    }
    return html;
  }

  // 每日活动区 HTML：今日可做 + 次数
  function renderDailiesHtml(dailies, S) {
    let html = '<div class="quest-sec-title">── 每日活动 ──</div>';
    if (!dailies.length) html += '<div class="quest-row quest-dim">今日暂无活动。</div>';
    for (const d of dailies) {
      const count = (typeof d.count === 'number') ? d.count : 0;
      const target = d.target || 1;
      const loc = locName(d.loc);
      const when = whenName(d.when);
      const where = (loc && when) ? '去 ' + loc + ' · ' + when : (loc ? '去 ' + loc : '');
      html += '<div class="quest-row quest-daily qs-' + d.status + '">' +
        '<span class="quest-name">' + esc(d.name) + '</span>' +
        '<span class="quest-count">' + count + '/' + target + '</span>' +
        (where ? '<span class="quest-sub">' + esc(where) + '</span>' : '') +
        '</div>';
    }
    return html;
  }

  // 死任务区 HTML：红色倒计时
  function renderDeadlinesHtml(deadlines) {
    let html = '<div class="quest-sec-title">── 死任务 ──</div>';
    if (!deadlines.length) html += '<div class="quest-row quest-dim">当前没有迫在眉睫的威胁。</div>';
    for (const dl of deadlines) {
      // ≤2 天闪红
      const urgent = dl.remain <= 2 && !dl.done;
      const cls = 'quest-deadline' + (urgent ? ' qd-urgent' : '') + (dl.done ? ' qd-done' : '');
      const remainTxt = dl.done
        ? '已失败'
        : '⚠ 距' + esc(dl.name) + '还有 ' + dl.remain + ' 天';
      html += '<div class="quest-row ' + cls + '">' +
        '<span class="quest-name">' + esc(dl.name) + '</span>' +
        '<span class="quest-status">' + esc(remainTxt) + '</span>' +
        '</div>' +
        (dl.desc ? '<div class="quest-row quest-sub">' + esc(dl.desc) + '</div>' : '');
    }
    return html;
  }

  // 生成整个任务面板 HTML
  function renderQuestHtml(S, chapter) {
    const ch = (typeof chapter === 'number') ? chapter : ((S && S.chapter) || 1);
    const data = (typeof Quests !== 'undefined' && Quests.getAll) ? Quests.getAll(S, ch) : { mainline: [], sides: [], dailies: [], deadlines: [] };
    const header = '<div class="quest-header">第' + ch + '章 · 任务</div>';
    return header +
      renderMainlineHtml(data.mainline, ch, S) +
      renderSidesHtml(data.sides) +
      renderDailiesHtml(data.dailies, S) +
      renderDeadlinesHtml(data.deadlines);
  }

  // ---- 模态框 ----
  // 复用 MenuUI.openModal（menu.js 暴露），未就绪时自建简单模态。
  function openModal() {
    if (typeof MenuUI !== 'undefined' && MenuUI.openModal) {
      return MenuUI.openModal();
    }
    // 兜底：自建模态
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:61;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--panel);border:1px solid var(--accent);padding:16px 20px;max-width:460px;width:min(90vw,460px);max-height:78vh;overflow-y:auto;color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.6;box-shadow:0 0 30px rgba(143,143,255,.25);';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const escBtn = document.createElement('button');
    escBtn.className = 'map-btn';
    escBtn.textContent = '返回';
    escBtn.style.cssText = 'display:block;width:100%;margin-top:12px;';
    escBtn.addEventListener('click', close);
    return { overlay, box, esc: escBtn, close };
  }

  // 打开任务面板
  function showQuestPanel() {
    if (typeof Quests === 'undefined') {
      if (H.showDialog) H.showDialog('任务系统未加载');
      return;
    }
    const m = openModal();
    const render = () => {
      const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
      const ch = (typeof Game !== 'undefined' && Game.getChapter) ? Game.getChapter() : ((S && S.chapter) || 1);
      m.box.innerHTML = renderQuestHtml(S, ch);
      m.box.appendChild(m.esc);
    };
    render();
  }

  return {
    init,
    renderQuestHtml,
    showQuestPanel,
    // 导出子渲染器供测试
    renderMainlineHtml,
    renderSidesHtml,
    renderDailiesHtml,
    renderDeadlinesHtml,
    locName,
    whenName,
    esc,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.QuestUI;