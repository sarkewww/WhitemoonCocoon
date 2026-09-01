/* =========================================================
 * 白月茧响 - 日程层（DayCycle）
 * 日夜循环 + 行动点 + 章内天数推进。
 * 白天=探索/互动/支线，夜晚=巡逻/战斗/主线。
 * 纯逻辑层，不触碰 DOM。
 * ========================================================= */
'use strict';

const DayCycle = (() => {

  // ---- 默认配置（未配置时与现状一致）----
  const DEFAULT_CONFIG = {
    dayAP: 2,          // 白天行动点数
    nightAP: 1,        // 夜晚行动点数
    dailyRestLimit: 2, // 每日最多休息次数（自然节奏：白天→夜晚 1 次 + 夜晚→次日 1 次）。防刷：限制免费推进时段刷 AP。
    // 行动点消耗约定（白月默认值；外部可用 configure({cost}) 覆盖）
    cost: {
      explore: 1,   // 探索/移动到地点
      chat: 1,      // 对话/支线
      fight: 1,     // 巡逻/战斗
      craft: 0,     // 合成
      rest: 0,      // 休息（推进到夜晚/次日）——不消耗 AP，但受每日次数限制（dailyRestLimit）
      travel: 1,    // 区域交通（车站传送）
    },
  };

  let config = {
    dayAP: DEFAULT_CONFIG.dayAP,
    nightAP: DEFAULT_CONFIG.nightAP,
    dailyRestLimit: DEFAULT_CONFIG.dailyRestLimit,
    cost: Object.assign({}, DEFAULT_CONFIG.cost),
  };

  // 外部配置覆盖入口：只传需要覆盖的键，未覆盖的保持现状。
  // configure({ cost:{...}, dayAP, nightAP, dailyRestLimit })；返回当前配置快照。
  function configure(opts = {}) {
    if (opts && typeof opts === 'object') {
      if (typeof opts.dayAP === 'number') config.dayAP = opts.dayAP;
      if (typeof opts.nightAP === 'number') config.nightAP = opts.nightAP;
      if (typeof opts.dailyRestLimit === 'number') config.dailyRestLimit = opts.dailyRestLimit;
      if (opts.cost && typeof opts.cost === 'object') Object.assign(config.cost, opts.cost);
    }
    return { dayAP: config.dayAP, nightAP: config.nightAP, dailyRestLimit: config.dailyRestLimit, cost: Object.assign({}, config.cost) };
  }

  // 从存档状态读取/初始化日程字段
  function ensure(S) {
    if (typeof S.day !== 'number' || S.day < 1) S.day = 1;
    if (!S.phase) S.phase = 'day';
    if (typeof S.ap !== 'number') S.ap = S.phase === 'day' ? config.dayAP : config.nightAP;
    if (!S.dayCounters) S.dayCounters = {};
    if (!S.eventCounts || typeof S.eventCounts !== 'object' || Array.isArray(S.eventCounts)) S.eventCounts = {};
    if (!S.restCounts || typeof S.restCounts !== 'object' || Array.isArray(S.restCounts)) S.restCounts = { day: S.day, count: 0 };
    if (!S.deadlines || typeof S.deadlines !== 'object' || Array.isArray(S.deadlines)) S.deadlines = {};
    return S;
  }

  function getDay(S) { ensure(S); return S.day; }
  function getPhase(S) { ensure(S); return S.phase; }
  function getAP(S) { ensure(S); return S.ap; }
  function maxAP(S) { ensure(S); return S.phase === 'day' ? config.dayAP : config.nightAP; }

  // 尝试消耗行动点；返回是否成功
  function spend(S, action) {
    ensure(S);
    const cost = config.cost[action] ?? 1;
    if (S.ap < cost) return false;
    S.ap -= cost;
    return true;
  }

  // 今日已休息次数（自然日键，跨日自动重置）
  function restCount(S) {
    ensure(S);
    const rec = S.restCounts;
    return rec && rec.day === S.day ? rec.count : 0;
  }

  // 今日剩余可休息次数；返回 { ok, count, limit, remaining }
  function restLeft(S) {
    const count = restCount(S);
    const limit = config.dailyRestLimit;
    return { ok: count < limit, count, limit, remaining: Math.max(0, limit - count) };
  }

  // 推进：白天 -> 夜晚 -> 次日白天
  // 受每日休息次数限制（DAILY_REST_LIMIT）：超限时返回 { ok:false, reason:'daily_rest_limit', ... } 且不改状态。
  // 返回阶段变化描述；成功时附带 { ok:true, count, remaining }
  function advance(S) {
    ensure(S);
    const left = restLeft(S);
    if (!left.ok) {
      return { ok: false, reason: 'daily_rest_limit', from: S.phase, to: S.phase, day: S.day, count: left.count, limit: left.limit, remaining: 0 };
    }
    S.restCounts = { day: S.day, count: left.count + 1 };
    if (S.phase === 'day') {
      S.phase = 'night';
      S.ap = config.nightAP;
      return { ok: true, from: 'day', to: 'night', day: S.day, count: left.count + 1, remaining: left.remaining - 1 };
    }
    // night -> next day
    S.phase = 'day';
    S.day += 1;
    S.ap = config.dayAP;
    if (S.chapter) S.dayCounters[S.chapter] = (S.dayCounters[S.chapter] || 0) + 1;
    return { ok: true, from: 'night', to: 'day', day: S.day, count: left.count + 1, remaining: left.remaining - 1 };
  }

  // 休息（cost.rest = 0，不耗行动点）：推进时段，用于"无事可做"时。
  // 与 advance 区别：rest 语义上表示"就地休息等待"，结果相同（推进到夜晚/次日并刷新行动点）。
  // 两者共用每日休息次数限制（dailyRestLimit），超限返回 { ok:false, reason:'daily_rest_limit' }。
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

  // ---- 每日事件限量（once:false 重复战斗/事件防刷）----
  // 记录键为"日历日"（S.day），跨日自动重置。
  // S.eventCounts[id] = { day, count }：该事件在今天已触发的次数。
  // 由 Game 层在触发 once:false 事件前调用 canTriggerEvent 判断、触发成功后 recordEvent 记账。

  // 今日已触发次数
  function eventCount(S, id) {
    ensure(S);
    const rec = S.eventCounts[id];
    return rec && rec.day === S.day ? rec.count : 0;
  }

  // 今日是否还可触发（未超过 limit）；返回 { ok, count, limit, remaining }
  function canTriggerEvent(S, id, limit) {
    const count = eventCount(S, id);
    return { ok: count < limit, count, limit, remaining: Math.max(0, limit - count) };
  }

  // 记录一次触发（跨日自动新建当日记录）；返回累计次数
  function recordEvent(S, id) {
    ensure(S);
    const rec = S.eventCounts[id];
    if (!rec || rec.day !== S.day) S.eventCounts[id] = { day: S.day, count: 1 };
    else rec.count += 1;
    return S.eventCounts[id].count;
  }

  // ---- 死任务倒计时（deadline）----
  // 死任务 = 必须在 XX 天内击败某 Boss 的支线任务；超时即失败（回存档点快照重来）。
  // S.deadlines[id] = { chapter, startDay, dueDays, bossId, loc, done, failScene, checkpoint }
  //   startDay   死任务开始时章内已过天数（dayCounters[chapter]）
  //   dueDays    限时天数（超期判定：dayCounters[chapter] >= startDay + dueDays）
  //   checkpoint 死任务开始时的全状态快照（JSON 深拷贝），失败时回滚到这里
  //   done       完成标记（true 后不再检查）

  // 注册一个死任务。checkpoint 为注册瞬间 S 的深拷贝（含 deadline 本身之前的完整状态）。
  function registerDeadline(S, cfg) {
    ensure(S);
    if (!cfg || !cfg.id) return null;
    const chapter = cfg.chapter;
    const startDay = (S.dayCounters && typeof S.dayCounters[chapter] === 'number') ? S.dayCounters[chapter] : 1;
    S.deadlines[cfg.id] = {
      chapter: chapter,
      startDay: startDay,
      dueDays: cfg.dueDays,
      bossId: cfg.bossId,
      loc: cfg.loc,
      done: false,
      failScene: cfg.failScene,
      checkpoint: JSON.parse(JSON.stringify(S)),
    };
    return S.deadlines[cfg.id];
  }

  // 检查所有死任务。返回 { expired:[ids], active:[ids] }。
  // expired：未 done 且已超期；active：未 done 且未超期。已 done 的既不 expired 也不 active。
  function checkDeadlines(S) {
    ensure(S);
    const expired = [];
    const active = [];
    for (const id of Object.keys(S.deadlines)) {
      const dl = S.deadlines[id];
      if (!dl || dl.done) continue;
      const days = S.dayCounters && typeof S.dayCounters[dl.chapter] === 'number' ? S.dayCounters[dl.chapter] : 0;
      if (days >= (dl.startDay ?? 1) + (dl.dueDays ?? 0)) expired.push(id);
      else active.push(id);
    }
    return { expired: expired, active: active };
  }

  return {
    get DAY_AP() { return config.dayAP; },
    get NIGHT_AP() { return config.nightAP; },
    get DAILY_REST_LIMIT() { return config.dailyRestLimit; },
    get COST() { return config.cost; },
    configure,
    ensure, getDay, getPhase, getAP, maxAP,
    spend, advance, rest, restCount, restLeft, chapterDays, mainReady,
    eventCount, canTriggerEvent, recordEvent,
    registerDeadline, checkDeadlines,
  };
})();

if (typeof window !== 'undefined') window.DayCycle = DayCycle;
if (typeof module !== 'undefined' && module.exports) module.exports = DayCycle;
