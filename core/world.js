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
      if (ev.once && done[ev.scene]) return false;
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
  // 第一章「夜见市」地图（区域制）
  // 区域：station_area 车站区 / school_area 学园区 / residential_area 住宅区 /
  //       shopping_area 商业区 / old_town 旧城区
  // 车站 station 为唯一枢纽，conns 连接各区域入口节点；区域间必须经车站中转。
  // 事件引用自 story/chapter1.story 与 story/ch1-m1.story 的真实场景 id。
  // 战斗事件 once:false 可重复练级；剧情事件 once:true。
  // =========================================================
  defineMap(1, [
    {
      id: 'station', name: '车站前', type: 'plaza', district: 'station_area',
      desc: '夜见车站前的广场。白天人潮往来，入夜后空无一人，路灯把影子拉得很长，墙上偶尔能看到巨大的爪痕。',
      x: 300, y: 80,
      conns: ['school', 'apt', 'shopping', 'old_building'],
      events: [
        {
          id: 'ev_station_side4', scene: 'ch1_side4', when: 'day', once: true,
          desc: '绕远路回家经过车站——街对面二楼的窗后，有人正注视着你。',
        },
        {
          id: 'ev_station_nightpatrol', scene: 'chapter1_6', enemy: 'patrol_eye',
          next: 'd1_night_menu', when: 'night', once: false, weight: 3,
          desc: '深夜的街道上，浮游的观测之眼在路灯之间徘徊。',
        },
      ],
    },
    {
      id: 'school', name: '神领学院', type: 'school', district: 'school_area',
      desc: '神领学院。校门后是走廊、教室与天台——也是羽衣、雪与铃各自藏着的秘密发生的地方。入夜后，这里的阴影比白天更深。',
      x: 150, y: 120,
      conns: ['station'],
      events: [
        {
          id: 'ev_academy_roof', scene: 'ch1_side1', when: 'day', once: true,
          desc: '天台上，水无月羽衣第一次拦住你：「你身上有茧的气息。」',
        },
        {
          id: 'ev_academy_library', scene: 'ch1_side2', when: 'day', once: true,
          desc: '资料室里，羽衣翻着旧档案，说出那句让你浑身发冷的话：「茧本来选中的契约者，是我。」',
        },
      ],
    },
    {
      id: 'apt', name: '公寓', type: 'home', district: 'residential_area',
      desc: '凌的房间，现在是绫音的房间。窗帘缝里漏进的光，落在摊开的掌心上。墙上海报还属于凌，镜子里的人却不再是他。',
      x: 90, y: 300,
      conns: ['station'],
      events: [
        {
          id: 'ev_apt_diary', scene: 'chapter1_9', when: 'night', once: true, weight: 2,
          desc: '深夜回到公寓，翻开那本空白的笔记本——笔迹已经不属于凌了。',
        },
        {
          id: 'ev_apt_basement', scene: 'chapter1_11', when: 'day', once: true,
          desc: '公寓地下室里独自练刀。刃光越熟练，手腕上的蚀纹就越深。',
        },
      ],
    },
    {
      id: 'shopping', name: '商业街', type: 'street', district: 'shopping_area',
      desc: '夜晚的商业街。霓虹灯一盏盏熄灭后，只剩熄灯招牌与紧闭的卷帘门。排水沟里偶尔渗出湿漉漉的、腥甜的黏液。',
      x: 470, y: 160,
      conns: ['station'],
      events: [
        {
          id: 'ev_market_shopping', scene: 'chapter1_3c', when: 'day', once: true,
          desc: '被女生们拉去逛街。试衣镜里那个「可爱又危险」的地雷系少女，正一点一点代替凌。',
        },
        {
          id: 'ev_market_spider', scene: 'chapter1_battle1', enemy: 'spider1',
          next: 'd1_night_menu', when: 'night', once: false, weight: 3,
          rewards: { materials: { tentacle_frag: 1 } },
          desc: '商业街深处传来湿漉漉的蠕动声——织网之魔正在黑暗中结网。',
        },
      ],
    },
    {
      id: 'old_building', name: '旧校舍', type: 'ruin', district: 'old_town',
      desc: '神领学院的旧校舍，异界入口所在。腐朽的楼梯、黑洞洞的窗，月光像泼翻的牛奶铺在顶楼天台。被茧选中的人，都在这里留下过痕迹。',
      x: 380, y: 320,
      conns: ['station', 'construction'],
      events: [
        {
          id: 'ev_old_m1', scene: 'm1_girl_missing', when: 'night', once: true,
          cond: (S) => !Engine.flag('m1_girl_trigger'),
          desc: '那个座位已经空了六天。暮色里，旧校舍的方向飘来被雨水泡过的、腐烂的茧的气味。',
        },
        {
          id: 'ev_old_ghost', scene: 'd1_suzu_patrol', enemy: 'patrol_ghost',
          next: 'd1_suzu_patrol_after', when: 'night', once: false, weight: 3,
          rewards: { materials: { dream_silk: 1 } },
          desc: '和铃一起的夜间巡逻——旧校舍的影子里，怨念之影缓缓浮出。',
        },
      ],
    },
    {
      id: 'construction', name: '废弃工地', type: 'ruin', district: 'old_town',
      desc: '旧城区的废弃工地。断壁残垣的影子像巨兽的骨架，月光照不进的地方，传来又轻又慢的呼吸声——像蛰伏的野兽。',
      x: 500, y: 320,
      conns: ['old_building'],
      events: [
        {
          id: 'ev_ruins_nightcrawler', scene: 'ch1_side3_battle', enemy: 'night_crawler',
          next: 'chapter1_7', when: 'night', once: false, weight: 3,
          rewards: { materials: { dark_crystal: 1 } },
          desc: '废墟深处，夜行之影从阴影中蜕出，朝你张开那张裂到耳根的笑脸。',
        },
      ],
    },
  ]);

  // ---- 区域 ----
  // 区域元数据：id / name / desc / entry（区域入口节点 id）
  const DISTRICT_META = {
    station_area:    { name: '车站区',      desc: '夜见车站前的广场，区域间往来的枢纽。', entry: 'station' },
    school_area:     { name: '学园区',      desc: '神领学院所在的街区，白天的日常与夜晚的秘密交织。', entry: 'school' },
    residential_area:{ name: '住宅区',      desc: '安静的住宅街，公寓就在这里。', entry: 'apt' },
    shopping_area:   { name: '商业区',      desc: '霓虹商业街，入夜后是魔物的猎场。', entry: 'shopping' },
    old_town:        { name: '旧城区',      desc: '旧校舍与废弃工地所在的衰败城区，异界入口所在。', entry: 'old_building' },
  };

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

  return {
    defineMap, getMap, getLocation, getReachable,
    getDistricts, getLocationsInDistrict, getStation,
    rollEvent, hasPendingEvent,
  };
})();

if (typeof window !== 'undefined') window.World = World;
if (typeof module !== 'undefined' && module.exports) module.exports = World;
