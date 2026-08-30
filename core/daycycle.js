/* =========================================================
 * 白月茧响 - 日程层（DayCycle）
 * 日夜循环 + 行动点 + 章内天数推进。
 * 白天=探索/互动/支线，夜晚=巡逻/战斗/主线。
 * 纯逻辑层，不触碰 DOM。
 * ========================================================= */
'use strict';

const DayCycle = (() => {

  // 每天行动点上限（可在各章调整）
  const DAY_AP = 2;        // 白天行动点数
  const NIGHT_AP = 1;      // 夜晚行动点数

  // 行动点消耗约定
  const COST = {
    explore: 1,   // 探索/移动到地点
    chat: 1,      // 对话/支线
    fight: 1,     // 巡逻/战斗
    craft: 0,     // 合成
    rest: 0,      // 休息（推进到夜晚/次日）
  };

  // 从存档状态读取/初始化日程字段
  function ensure(S) {
    if (typeof S.day !== 'number' || S.day < 1) S.day = 1;
    if (!S.phase) S.phase = 'day';
    if (typeof S.ap !== 'number') S.ap = S.phase === 'day' ? DAY_AP : NIGHT_AP;
    if (!S.dayCounters) S.dayCounters = {};
    return S;
  }

  function getDay(S) { ensure(S); return S.day; }
  function getPhase(S) { ensure(S); return S.phase; }
  function getAP(S) { ensure(S); return S.ap; }
  function maxAP(S) { ensure(S); return S.phase === 'day' ? DAY_AP : NIGHT_AP; }

  // 尝试消耗行动点；返回是否成功
  function spend(S, action) {
    ensure(S);
    const cost = COST[action] ?? 1;
    if (S.ap < cost) return false;
    S.ap -= cost;
    return true;
  }

  // 推进：白天 -> 夜晚 -> 次日白天
  // 返回阶段变化描述
  function advance(S) {
    ensure(S);
    if (S.phase === 'day') {
      S.phase = 'night';
      S.ap = NIGHT_AP;
      return { from: 'day', to: 'night', day: S.day };
    }
    // night -> next day
    S.phase = 'day';
    S.day += 1;
    S.ap = DAY_AP;
    if (S.chapter) S.dayCounters[S.chapter] = (S.dayCounters[S.chapter] || 0) + 1;
    return { from: 'night', to: 'day', day: S.day };
  }

  // 休息（无条件推进时段，用于"无事可做"时）
  function rest(S) { return advance(S); }

  // 当前章已过天数（用于主线触发门槛）
  function chapterDays(S, chapter) {
    ensure(S);
    return S.dayCounters[chapter] || 0;
  }

  // 是否允许触发主线（主线在指定天数后触发）
  function mainReady(S, chapter, requireDays = 1) {
    return chapterDays(S, chapter) >= requireDays;
  }

  return {
    DAY_AP, NIGHT_AP, COST,
    ensure, getDay, getPhase, getAP, maxAP,
    spend, advance, rest, chapterDays, mainReady,
  };
})();

if (typeof window !== 'undefined') window.DayCycle = DayCycle;
if (typeof module !== 'undefined' && module.exports) module.exports = DayCycle;
