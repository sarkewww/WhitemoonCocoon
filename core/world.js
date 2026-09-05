/* =========================================================
 * 白月茧响 - 世界层（World）
 * 地点定义 + 节点图 + 移动 + 事件触发。
 * 每个章节一张地图（节点图），玩家在地点之间移动，
 * 移动到某地点可触发事件（复用 story/*.story 场景）。
 *
 * 设计要点：
 * - 纯数据/逻辑层，不触碰 DOM。
 * - 事件通过 trigger(id) 返回场景 id 列表，由 Game/App 执行。
 * ========================================================= */
'use strict';

const World = (() => {

  // ---- 地图定义：章节 -> 节点列表 ----
  // 每节点：id, name, desc, x, y(渲染用,可选), conns(相邻节点), events, type
  const MAPS = {};

  // 区域元数据：由 world-data.js 通过 setDistrictMeta 注入（运行时从 window.WorldData 读取）
  let DISTRICT_META = {};

  function setDistrictMeta(meta) { DISTRICT_META = meta || {}; }

  function defineMap(chapter, locations) {
    MAPS[chapter] = locations;
    // 归一化 conns
    for (const loc of locations) {
      if (!loc.events) loc.events = [];
      if (!loc.conns) loc.conns = [];
    }
    return MAPS[chapter];
  }

  function getMap(chapter) { return MAPS[chapter] || []; }
  function getLocation(chapter, id) {
    const map = MAPS[chapter];
    if (!map) return null;
    return map.find(l => l.id === id) || null;
  }

  // 可到达的节点：
  // - 同区域相邻地点（区域内步行可达）
  // - 车站（若当前不在车站，区域间必须经车站中转）
  // - 若当前已在车站，则返回所有区域的入口节点
  function getReachable(chapter, fromId) {
    const loc = getLocation(chapter, fromId);
    if (!loc) return [];
    const seen = {};
    const out = [];
    const push = (l) => {
      if (l && !seen[l.id]) { seen[l.id] = true; out.push(l); }
    };
    const station = getStation(chapter);
    // 已在车站：返回所有区域入口节点（即各区域中直连车站的地点）
    if (loc.id === 'station') {
      for (const l of getMap(chapter)) {
        if (l.district && l.district !== 'station_area' && (l.conns || []).indexOf('station') !== -1) {
          push(l);
        }
      }
      return out;
    }
    // 同区域相邻地点
    for (const cid of (loc.conns || [])) {
      const c = getLocation(chapter, cid);
      if (c && c.district === loc.district) push(c);
    }
    // 车站（若不在车站）
    if (station && station.id !== loc.id) push(station);
    return out;
  }

  // 统一条件求值：函数直接调；结构化对象（Events.checkCondition 格式）走解释器。
  // 兼容两种写法，Events 未加载时对象条件按可触发处理。
  function evalCond(cond, S) {
    if (!cond) return true;
    if (typeof cond === 'function') return !!cond(S);
    if (typeof Events !== 'undefined' && Events.checkCondition) return !!Events.checkCondition(cond, S);
    return true;
  }

  // ---- 事件触发 ----
  // 事件格式: { id, scene, enemy, when, once, cond, weight, rewards, commands }
  //   scene: 触发时执行的场景 id（或场景数组随机抽一个）
  //   enemy: 战斗事件敌人 id（胜利后可接 next / lose）
  //   when:  'day' | 'night' | 'any'   （可选的时段限制）
  //   once:  true 则该事件只触发一次
  //   cond:  (S) => bool 或 Events.checkCondition 结构化对象（返回 true 才可触发）
  //   weight: 权重（多事件时随机抽取，默认 1）
  //   rewards: 胜利奖励，如 { materials: { tentacle_frag: 1 } }（game.js 在 onWin 后入背包）
  //   commands: 可选的 Events 命令序列（如 [{type:'switch',flag,value}]），存在时由 game.js 交给 Events.process 执行
  // 返回: 抽中的事件对象（含 scene/enemy/commands），若无则 null
  function rollEvent(chapter, locId, phase, S) {
    const loc = getLocation(chapter, locId);
    if (!loc || !loc.events.length) return null;
    const done = S.doneScenes || {};
    const pool = loc.events.filter(ev => {
      if (ev.when && ev.when !== 'any' && ev.when !== phase) return false;
      // once 过滤键与 game.js onceKey 一致：scene > enemy > id（死任务 Boss 事件无 scene）
      if (ev.once && done[ev.scene || ev.enemy || ev.id]) return false;
      if (ev.cond && !evalCond(ev.cond, S)) return false;
      return true;
    });
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    // 按权重随机
    const total = pool.reduce((a, e) => a + (e.weight || 1), 0);
    let r = Math.random() * total;
    for (const ev of pool) {
      r -= (ev.weight || 1);
      if (r <= 0) return ev;
    }
    return pool[pool.length - 1];
  }

  // 某地点是否存在"可选"事件（用于地图标记）
  function hasPendingEvent(chapter, locId, phase, S) {
    return !!rollEvent(chapter, locId, phase, S);
  }

  // =========================================================
  // 白月三章地图数据 + 区域元数据已移至 core/world-data.js。
  // 逻辑层启动时读取 window.WorldData（若存在）自动注册地图与区域；
  // 无数据时地图为空（不崩，getMap 返回 []）。
  // 对外 API（defineMap/getMap/getReachable/rollEvent/getDistricts 等）保持不变。
  // =========================================================

  // ---- 区域 ----
  // 返回该章的区域列表（结构化对象，按首次出现顺序）
  function getDistricts(chapter) {
    const list = [];
    for (const l of getMap(chapter)) {
      if (!l.district) continue;
      const meta = DISTRICT_META[l.district] || { name: l.district, desc: '', entry: null };
      const d = {
        id: l.district,
        name: meta.name,
        desc: meta.desc,
        entry: meta.entry || (getLocationsInDistrict(chapter, l.district)[0] || { id: null }).id,
      };
      if (!list.some(x => x.id === l.district)) list.push(d);
    }
    return list;
  }

  // 返回该区域内所有地点
  function getLocationsInDistrict(chapter, district) {
    return getMap(chapter).filter(l => l.district === district);
  }

  // 返回车站枢纽地点
  function getStation(chapter) {
    return getLocation(chapter, 'station');
  }

  // ---- 自动加载数据（若 window.WorldData 已就绪）----
  // 数据文件 core/world-data.js 需先于本文件加载。
  function loadWorldData() {
    if (typeof window === 'undefined' || !window.WorldData) return;
    const d = window.WorldData;
    const maps = d.maps || {};
    for (const ch of Object.keys(maps)) {
      defineMap(Number(ch), maps[ch]);
    }
    setDistrictMeta(d.districtMeta || {});
  }
  loadWorldData();

  return {
    defineMap, getMap, getLocation, getReachable,
    getDistricts, getLocationsInDistrict, getStation,
    rollEvent, hasPendingEvent, setDistrictMeta,
  };
})();

if (typeof window !== 'undefined') window.World = World;
if (typeof module !== 'undefined' && module.exports) module.exports = World;
