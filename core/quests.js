/* =========================================================
 * 白月茧响 - 任务逻辑层（Quests）
 * 纯逻辑：任务状态计算 / 死任务倒计时。
 * 不触碰 DOM，不改任何存档字段。
 *
 * 状态来源（只读）：
 *   S.mainline[ch]     主线进度（与 Game.mainline 相同字段）
 *   S.flags[flag]      支线完成 flag（world-data/story 置位）
 *   S.eventCounts[id]  每日活动当日次数（DayCycle.recordEvent 记账）
 *   S.deadlines[id]    死任务激活日 { day }（由 game.js 创建，这里防御性读取）
 *   S.dayCounters[ch]  章内天数
 * ========================================================= */
'use strict';

const Quests = (() => {

  // 读取任务配置：注入配置 > window.QuestConfig > 空配置兜底。
  function getConfig() {
    const src = (typeof window !== 'undefined' && window.QuestConfig) || {};
    return {
      quests: (src && src.quests) || {},
      dailies: (src && src.dailies) || [],
      deadlines: (src && src.deadlines) || [],
    };
  }

  // 主线步骤（与 config/game-config.js mainlineSteps 同源）
  function getMainlineSteps() {
    const src = (typeof window !== 'undefined' && window.GameConfig) || {};
    return (src && src.mainlineSteps) || {};
  }

  // 该章任务定义列表
  function getQuestList(chapter) {
    return (getConfig().quests[chapter] || []).slice();
  }

  // 某个任务在当前存档下的状态
  // 返回 { status:'locked'|'active'|'done', need, targetLoc, targetWhen, ... }
  // chapter 可选：主线状态计算所需的章节（缺省取 S.chapter）
  function getQuestState(S, q, chapter) {
    if (!S || !q) return { status: 'active', need: 0, targetLoc: q && q.loc, targetWhen: q && q.when };

    // ---- 主线：对照 steps 计算进度 ----
    // 复刻 core/game.js mainlineStepRequireDays 语义：
    //   未开始 idx=-1 → requireDays=1（nextIdx=0 需 1 天）
    //   已推进到 idx 断点 → requireDays=idx+2
    if (q.type === 'mainline') {
      const steps = (q.progress && q.progress.steps) || [];
      const ch = (typeof chapter === 'number') ? chapter : chapterOf(S);
      const prog = (S.mainline && S.mainline[ch]) || null;
      const idx = steps.indexOf(prog);
      // 已推进到最后一步断点 → 完成
      if (steps.length && idx >= steps.length - 1) {
        return { status: 'done', need: 0, targetLoc: q.loc, targetWhen: q.when };
      }
      // 未完成：还需经过的天数（need 语义 = Game.getMainlineGate().need）
      const current = (S.dayCounters && S.dayCounters[ch]) || 0;
      const requireDays = idx + 2; // idx=-1 → 1
      const need = Math.max(0, requireDays - current);
      return {
        status: 'active',
        need,
        requireDays,
        currentDays: current,
        completedIdx: idx,
        targetLoc: q.loc,
        targetWhen: q.when,
      };
    }

    // ---- 支线：complete.flag 是否已置 ----
    if (q.type === 'side') {
      const flag = q.complete && q.complete.flag;
      if (flag && S.flags && S.flags[flag]) {
        return { status: 'done', need: 0, targetLoc: q.loc, targetWhen: q.when };
      }
      // 未完成：若定义了 unlock 条件（Events.checkCondition 结构化条件）则判定 locked
      let locked = false;
      let need = 0;
      if (q.unlock) {
        const ok = (typeof Events !== 'undefined' && Events.checkCondition)
          ? Events.checkCondition(q.unlock, S)
          : true;
        locked = !ok;
        need = 1;
      }
      return {
        status: locked ? 'locked' : 'active',
        need,
        targetLoc: q.loc,
        targetWhen: q.when,
      };
    }

    // ---- 每日活动：用 DayCycle.eventCount 对照 target ----
    if (q.type === 'daily') {
      const target = q.target || 1;
      const count = (typeof DayCycle !== 'undefined' && DayCycle.eventCount)
        ? DayCycle.eventCount(S, q.id)
        : ((S.eventCounts && S.eventCounts[q.id] && S.eventCounts[q.id].day === S.day) ? S.eventCounts[q.id].count : 0);
      return {
        status: count >= target ? 'done' : 'active',
        need: Math.max(0, target - count),
        count,
        target,
        targetLoc: q.loc,
        targetWhen: q.when,
      };
    }

    return { status: 'active', need: 0, targetLoc: q.loc, targetWhen: q.when };
  }

  // 当前章节（从存档 state 取）
  function chapterOf(S) {
    return (S && typeof S.chapter === 'number') ? S.chapter : 0;
  }

  // ---- 死任务 ----
  // 每项 { id, name, desc, boss, loc, dueDay: startDay+dueDays, remain, done }
  // S.deadlines 由 game.js/DayCycle.registerDeadline 创建，结构：
  //   S.deadlines[id] = { chapter, startDay, dueDays, bossId, loc, done, failScene, checkpoint }
  // 此处防御性读取：无 S.deadlines 或该任务未登记 → 返回 []。
  function getDeadlineStates(S) {
    if (!S || !S.deadlines || typeof S.deadlines !== 'object') return [];
    const cfg = getConfig();
    const out = [];
    // 按章节展开 config.deadlines（chapter-keyed object）为平铺列表
    const all = [];
    for (const ch of Object.keys(cfg.deadlines)) {
      if (Array.isArray(cfg.deadlines[ch])) all.push.apply(all, cfg.deadlines[ch]);
    }
    for (const dl of all) {
      const rec = S.deadlines[dl.id];
      if (!rec || typeof rec.startDay !== 'number') continue;   // 未登记
      const startDay = rec.startDay;
      const dueDay = (rec.dueDays != null ? rec.dueDays : dl.dueDays) + startDay;
      const currentDay = (S.dayCounters && S.dayCounters[dl.chapter]) || 0;
      const remain = Math.max(0, dueDay - currentDay);
      out.push({
        id: dl.id,
        name: dl.name,
        desc: dl.desc,
        boss: dl.bossId,
        loc: dl.loc,
        chapter: dl.chapter,
        startDay,
        dueDay,
        remain,
        done: rec.done === true || remain <= 0,
      });
    }
    return out;
  }

  // ---- 汇总（供 UI 一次取） ----
  function getAll(S, chapter) {
    const ch = (typeof chapter === 'number') ? chapter : chapterOf(S);
    const list = getQuestList(ch);

    const mainline = [];
    const sides = [];
    for (const q of list) {
      const st = getQuestState(S, q, ch);
      q.type === 'mainline'
        ? mainline.push(Object.assign({}, q, st))
        : sides.push(Object.assign({}, q, st));
    }

    const dailies = getConfig().dailies.map(d => {
      const dq = Object.assign({ type: 'daily' }, d);
      return Object.assign({}, dq, getQuestState(S, dq, ch));
    });
    const deadlines = getDeadlineStates(S);

    return { mainline, sides, dailies, deadlines };
  }

  return {
    getConfig,
    getMainlineSteps,
    getQuestList,
    getQuestState,
    getDeadlineStates,
    getAll,
  };
})();

if (typeof window !== 'undefined') window.Quests = Quests;
if (typeof module !== 'undefined' && module.exports) module.exports = Quests;