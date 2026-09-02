/* =========================================================
 * 白月茧响 - 核心引擎（可配置核心层）
 * 通用层：存档 / 道具 / 合成 / 装备 / 货币 / 属性 / 等级
 * 主题层：trust(羁绊) / ero(侵蚀) / anchor(锚点) 由 CONFIG 注入
 * 默认 CONFIG 完全复刻白月默认行为；Engine.configure() 可覆盖。
 * 对外 API 保持兼容（main.js / battle.js / core/* 依赖的方法名与签名不变）。
 * ========================================================= */
'use strict';

const Engine = (() => {

  const SAVE_KEY = 'wmc_save_v1';
  const AUTO_KEY = 'wmc_auto_v1';
  const SLOT_PREFIX = 'wmc_slot_';
  const INDEX_KEY = 'wmc_saves_v1';
  const SAVE_VERSION = 2;
  const SLOT_COUNT = 4;

  // ---- 可配置默认值（白月默认基线）----
  const DEFAULT_CONFIG = {
    // 默认玩家字段（白月专属默认值，可由配置覆盖）
    initialState: {
      scene: 'prologue_0',
      sceneIdx: 0,
      chapter: 0,
      hp: 100, maxHp: 100,
      sp: 50, maxSp: 50,
      atk: 12, def: 6, spd: 10,
      xp: 0, level: 1,
      name: '绫音',
      trueName: '凌',
      weapon: 1,
      skills: ['strike'],
      money: 500,
      weaponLevel: 1,
      statPts: 0,
      stats: { str:1, vit:1, spi:1, agi:1 },
      armorId: null,
      accessoryId: null,
    },
    // 羁绊系统（affinity）：角色列表 + 是否启用 + 上限 + 初始值 + 等级阈值 + 被动加成表
    affinities: {
      enabled: true,
      list: ['yuki', 'suzu', 'hagoromo'],
      max: 100,
      initial: { yuki: 0, suzu: 0, hagoromo: 0 },
      thresholds: [
        { rank: 1, min: 0 },
        { rank: 2, min: 30 },
        { rank: 3, min: 60 },
        { rank: 4, min: 80 },
      ],
      bonuses: {
        yuki: {           // 雪：守护 / 减伤
          1: {},
          2: { def: 2, dmgReduction: 0.05 },
          3: { def: 4, dmgReduction: 0.08, maxHp: 10 },
          4: { def: 6, dmgReduction: 0.12, maxHp: 20 },
        },
        suzu: {           // 铃：锋锐 / 暴击
          1: {},
          2: { atk: 2, critChance: 0.05 },
          3: { atk: 4, critChance: 0.08 },
          4: { atk: 6, critChance: 0.12 },
        },
        hagoromo: {       // 羽衣：巧匠 / 折扣
          1: {},
          2: { craftDiscount: 0.10, shopDiscount: 0.05 },
          3: { craftDiscount: 0.20, shopDiscount: 0.10 },
          4: { craftDiscount: 0.30, shopDiscount: 0.15 },
        },
      },
    },
    // 计量条系统（meter）：是否启用 + 显示名 + 上限 + 初始值
    meters: {
      ero:    { enabled: true, name: '侵蚀', max: 100, initial: 0 },
      anchor: { enabled: true, name: '锚点', max: 100, initial: 50 },
    },
  };

  let cfg = deepClone(DEFAULT_CONFIG);

  // ---- 配置工具 ----
  function deepClone(v) {
    if (Array.isArray(v)) return v.map(deepClone);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = deepClone(v[k]);
      return o;
    }
    return v;
  }
  function deepMerge(target, src) {
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
          target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
        deepMerge(target[k], sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }
  // 由外部覆盖配置（合并式覆盖）。返回当前配置。
  function configure(overrides) {
    if (overrides && typeof overrides === 'object') deepMerge(cfg, overrides);
    return cfg;
  }
  function getConfig() { return cfg; }
  function resetConfig() { cfg = deepClone(DEFAULT_CONFIG); return cfg; }

  // ---- 主题（affinity / meter）辅助 ----
  function affinityList() { return (cfg.affinities && cfg.affinities.list) || []; }
  function affinityInitial() {
    const init = {};
    const ini = (cfg.affinities && cfg.affinities.initial) || {};
    for (const c of affinityList()) init[c] = ini[c] || 0;
    return init;
  }
  function meterCfg(name) { return (cfg.meters && cfg.meters[name]) || null; }
  function meterEnabled(name) { const m = meterCfg(name); return !!(m && m.enabled); }
  function meterMax(name) { const m = meterCfg(name); return m ? m.max : 100; }
  function meterInitial(name) { const m = meterCfg(name); return m ? m.initial : 0; }

  let state = null;
  let G = null; // 全局数据（来自 story.js / battle.js）

  // ---- 状态初始化 ----
  // 难度：easy / normal / hard
  function newGame(difficulty = 'normal') {
    const ini = cfg.initialState || {};
    const s = {
      scene: ini.scene || 'prologue_0',
      sceneIdx: 0,          // 场景内推进位置
      chapter: 0,
      difficulty: difficulty,
      flags: {},
      vars: {},
      hp: ini.hp ?? 100, maxHp: ini.maxHp ?? 100,
      sp: ini.sp ?? 50, maxSp: ini.maxSp ?? 50,
      atk: ini.atk ?? 12, def: ini.def ?? 6, spd: ini.spd ?? 10,
      xp: ini.xp ?? 0,
      level: ini.level ?? 1,
      name: ini.name ?? '绫音',
      trueName: ini.trueName ?? '凌',
      weapon: ini.weapon ?? 1,
      combos: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      playTime: 0,
      deaths: 0,
      decisions: {},
      trust: affinityInitial(),  // 好感度：由配置的角色列表生成 0-100
      endings: [],
      skills: (Array.isArray(ini.skills) ? ini.skills.slice() : ['strike']),
      unlocked: {},
      inventory: [],       // 可用道具 [{id,count}]
      materials: {},       // 合成材料 {matId:count}
      recipes: {},         // 已解锁合成配方 {recipeId:true}
      weaponLevel: ini.weaponLevel ?? 1,      // 武器强化等级
      money: ini.money ?? 500,          // 货币（金币）
      armorId: ini.armorId ?? null,       // 防具槽（装备 id）
      accessoryId: ini.accessoryId ?? null,   // 饰品槽（装备 id）
      statPts: ini.statPts ?? 0,          // 属性点（未分配）
      stats: Object.assign({ str:1, vit:1, spi:1, agi:1 }, ini.stats || {}),  // 力量/体力/灵力/敏捷
      doneScenes: {},      // 已执行过 onEnter 的场景
      log: [],
    };
    // 计量条（ero/anchor）：启用才写入字段
    if (meterEnabled('ero')) s.ero = meterInitial('ero');
    if (meterEnabled('anchor')) s.anchor = meterInitial('anchor');
    // 初始属性计算（此时 state 未挂载，直接算一次；难度倍率在 recalcStats 统一处理）
    const baseStats = {
      maxHp: 100 + (s.stats.vit)*12,
      maxSp: 50 + (s.stats.spi)*8,
      atk: 12 + (s.stats.str)*4,
      def: 6 + (s.stats.vit)*2,
      spd: 10 + (s.stats.agi)*2,
    };
    if (difficulty === 'easy') {
      baseStats.maxHp = Math.round(baseStats.maxHp * 1.3);
      baseStats.atk = Math.round(baseStats.atk * 1.2);
    } else if (difficulty === 'hard') {
      baseStats.maxHp = Math.round(baseStats.maxHp * 0.75);
      baseStats.atk = Math.round(baseStats.atk * 0.85);
      baseStats.def = Math.round(baseStats.def * 0.85);
    }
    s.maxHp = baseStats.maxHp; s.hp = baseStats.maxHp;
    s.maxSp = baseStats.maxSp; s.sp = baseStats.maxSp;
    s.atk = baseStats.atk; s.def = baseStats.def; s.spd = baseStats.spd;
    applyBonuses(s);       // 装备/羁绊被动加成（初始为 0）
    return s;
  }

  function serialize(s) {
    return JSON.stringify(s);
  }

  function deserialize(str) {
    return JSON.parse(str);
  }

  function saveSlot() {
    const r = saveToSlot(1);
    return !!(r && r.ok);
  }

  // 迁移：为旧存档补齐新字段默认值
  function migrateState(s) {
    const base = newGame();
    const out = Object.assign({}, base, s);
    // 旧存档迁移：旧版本把"未分配属性点"存在 S.ap（且无 S.statPts）。
    // 现在属性点=S.statPts，行动点=S.ap（daycycle 管理），互相解耦。
    const legacySave = s && typeof s.statPts === 'undefined';
    if (legacySave) {
      if (typeof s.ap === 'number') out.statPts = s.ap;   // 旧属性点搬移到 statPts
      out.ap = 2;                                         // 行动点初始化为白天行动点
    } else if (typeof out.ap !== 'number' || isNaN(out.ap)) {
      out.ap = 2;                                         // 缺失/非法则给白天行动点
    }
    if (typeof out.statPts !== 'number' || isNaN(out.statPts)) out.statPts = 0;
    // 日程状态字段补齐（行动点/天数/时段/章节计数器）
    if (typeof out.day !== 'number' || out.day < 1) out.day = 1;
    if (!out.phase) out.phase = 'day';
    if (!out.dayCounters || typeof out.dayCounters !== 'object' || Array.isArray(out.dayCounters)) out.dayCounters = {};
    if (!out.stats) out.stats = { str:1, vit:1, spi:1, agi:1 };
    else { out.stats.str = out.stats.str||1; out.stats.vit = out.stats.vit||1; out.stats.spi = out.stats.spi||1; out.stats.agi = out.stats.agi||1; }
    if (!Array.isArray(out.inventory)) out.inventory = [];
    if (!out.materials || typeof out.materials !== 'object') out.materials = {};
    if (!out.recipes || typeof out.recipes !== 'object') out.recipes = {};
    if (typeof out.weaponLevel !== 'number' || isNaN(out.weaponLevel) || out.weaponLevel < 1) out.weaponLevel = 1;
    if (typeof out.money !== 'number' || isNaN(out.money) || out.money < 0) out.money = 500;
    if (typeof out.armorId !== 'string' && out.armorId !== null) out.armorId = null;
    if (typeof out.accessoryId !== 'string' && out.accessoryId !== null) out.accessoryId = null;
    if (!out.doneScenes || typeof out.doneScenes !== 'object' || Array.isArray(out.doneScenes)) out.doneScenes = {};
    // 羁绊：按配置的角色列表补齐默认值
    if (!out.trust || typeof out.trust !== 'object') out.trust = affinityInitial();
    else { for (const c of affinityList()) out.trust[c] = out.trust[c] || 0; }
    // 计量条：按配置补齐默认值与上限
    if (typeof out.anchor !== 'number' || isNaN(out.anchor)) out.anchor = meterInitial('anchor');
    else out.anchor = Math.max(0, Math.min(meterMax('anchor'), out.anchor));
    if (typeof out.ero !== 'number' || isNaN(out.ero)) out.ero = meterInitial('ero');
    else out.ero = Math.max(0, Math.min(meterMax('ero'), out.ero));
    if (typeof out.level !== 'number' || isNaN(out.level) || out.level < 1) out.level = 1;
    ['hp','maxHp','sp','maxSp','atk','def','spd','xp','kills','damageDealt','damageTaken','playTime','deaths'].forEach(k => {
      if (typeof out[k] !== 'number' || isNaN(out[k])) out[k] = base[k] || 0;
    });
    if (!Array.isArray(out.skills) || out.skills.length === 0) out.skills = ['strike'];
    if (!Array.isArray(out.endings)) out.endings = [];
    recalcStats(out);
    return out;
  }

  function loadSlot() {
    const r = loadFromSlot(1);
    if (r) setState(r);
    return !!r;
  }

  function clearSlot() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
    deleteSlot(1);
  }
  function clearAuto() {
    try {
      localStorage.removeItem(AUTO_KEY);
      const idx = readIndex();
      if (idx && idx.slots) delete idx.slots['auto'];
      writeIndex(idx);
    } catch(e) {}
  }

  function autoSave() {
    ensureMigrated();
    try {
      if (!state) return { ok:false, error:'无游戏状态' };
      const meta = buildMeta();
      const data = { __meta: meta, state };
      localStorage.setItem(AUTO_KEY, JSON.stringify(data));
      const idx = readIndex();
      idx.slots['auto'] = meta;
      writeIndex(idx);
      return { ok:true, savedAt: meta.savedAt };
    } catch(e) { return { ok:false, error: (e && e.message) ? e.message : String(e) }; }
  }

  function hasAuto() {
    try { return !!localStorage.getItem(AUTO_KEY); } catch(e){ return false; }
  }

  function loadAuto() {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const st = (parsed && parsed.__meta && parsed.state) ? parsed.state : parsed;
      state = migrateState(st);
      return true;
    } catch(e){ return false; }
  }

  // ---- 多槽位存档 / 索引 / 迁移 ----

  function slotKey(n) { return SLOT_PREFIX + n; }

  function readIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return { slots: {} };
      const idx = JSON.parse(raw);
      if (!idx || typeof idx !== 'object' || !idx.slots || typeof idx.slots !== 'object') return { slots: {} };
      return idx;
    } catch (e) { return { slots: {} }; }
  }

  function writeIndex(idx) {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); return true; }
    catch (e) { return false; }
  }

  function buildMeta(s) {
    s = s || getState();
    return {
      v: SAVE_VERSION,
      savedAt: Date.now(),
      scene: (s && s.scene) || '',
      chapter: (s && s.chapter) || 0,
      day: (s && s.day) || 1,
      difficulty: (s && s.difficulty) || 'normal',
      playTime: (s && s.playTime) || 0,
    };
  }

  // 旧档迁移（幂等）：wmc_save_v1 → slot_1；wmc_auto_v1 无 __meta 包装 → 包一层
  function ensureMigrated() {
    try {
      const oldRaw = localStorage.getItem(SAVE_KEY);
      if (oldRaw) {
        let parsed = null;
        try { parsed = JSON.parse(oldRaw); } catch (e) { parsed = null; }
        if (parsed) {
          const meta = {
            v: SAVE_VERSION, savedAt: null,
            scene: parsed.scene || '', chapter: parsed.chapter || 0,
            day: parsed.day || 1, difficulty: parsed.difficulty || 'normal',
            playTime: parsed.playTime || 0,
          };
          localStorage.setItem(slotKey(1), JSON.stringify({ __meta: meta, state: parsed }));
          const idx = readIndex();
          idx.slots['1'] = meta;
          writeIndex(idx);
        }
        localStorage.removeItem(SAVE_KEY);
      }
      const autoRaw = localStorage.getItem(AUTO_KEY);
      if (autoRaw) {
        let parsed = null;
        try { parsed = JSON.parse(autoRaw); } catch (e) { parsed = null; }
        if (parsed && !(parsed.__meta && parsed.state)) {
          const meta = {
            v: SAVE_VERSION, savedAt: null,
            scene: parsed.scene || '', chapter: parsed.chapter || 0,
            day: parsed.day || 1, difficulty: parsed.difficulty || 'normal',
            playTime: parsed.playTime || 0,
          };
          localStorage.setItem(AUTO_KEY, JSON.stringify({ __meta: meta, state: parsed }));
          const idx = readIndex();
          idx.slots['auto'] = meta;
          writeIndex(idx);
        }
      }
    } catch (e) {}
  }

  function saveToSlot(n) {
    ensureMigrated();
    try {
      if (!state) return { ok:false, error:'无游戏状态' };
      const meta = buildMeta();
      localStorage.setItem(slotKey(n), JSON.stringify({ __meta: meta, state }));
      const idx = readIndex();
      idx.slots[String(n)] = meta;
      writeIndex(idx);
      return { ok:true, meta };
    } catch (e) { return { ok:false, error: (e && e.message) ? e.message : String(e) }; }
  }

  function loadFromSlot(n) {
    try {
      const raw = localStorage.getItem(slotKey(n));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const st = (parsed && parsed.__meta && parsed.state) ? parsed.state : parsed;
      return migrateState(st);
    } catch (e) { return null; }
  }

  function deleteSlot(n) {
    try {
      localStorage.removeItem(slotKey(n));
      const idx = readIndex();
      delete idx.slots[String(n)];
      writeIndex(idx);
      return true;
    } catch (e) { return false; }
  }

  function listSaves() {
    ensureMigrated();
    const idx = readIndex();
    const slots = (idx && idx.slots) || {};
    const out = [{ slot:'auto', meta: slots['auto'] || null }];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      out.push({ slot:String(i), meta: slots[String(i)] || null });
    }
    return out;
  }

  function getAutoMeta() {
    ensureMigrated();
    try {
      const idx = readIndex();
      return (idx.slots && idx.slots['auto']) || null;
    } catch (e) { return null; }
  }

  function getSlotMeta(n) {
    ensureMigrated();
    try {
      const idx = readIndex();
      return (idx.slots && idx.slots[String(n)]) || null;
    } catch (e) { return null; }
  }

  function hasAnySave() {
    ensureMigrated();
    try {
      const idx = readIndex();
      const slots = (idx && idx.slots) || {};
      for (const k of Object.keys(slots)) if (slots[k]) return true;
      if (localStorage.getItem(AUTO_KEY)) return true;
      for (let i = 1; i <= SLOT_COUNT; i++) if (localStorage.getItem(slotKey(i))) return true;
      return false;
    } catch (e) { return false; }
  }

  // 旧 API 别名（任务要求保留 saveGame/loadGame 兼容）
  function saveGame() { return saveToSlot(1); }
  function loadGame() { const r = loadFromSlot(1); if (r) setState(r); return r; }

  // 时间戳格式化：'YYYY-MM-DD HH:mm:ss'（zh 格式，补零）
  function fmtSavedAt(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms <= 0) return '';
    const d = new Date(ms);
    const p = n => String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }

  // ---- 标记 ----
  function flag(name) { return !!state.flags[name]; }
  function setFlag(name, v=true) { state.flags[name]=!!v; }
  function getVar(name) { return state.vars[name] ?? 0; }
  function setVar(name, v) { state.vars[name]=v; }
  function addVar(name, d) { state.vars[name] = (state.vars[name]??0) + d; }

  function setStat(k, v) {
    if (k==='hp') state.hp = clamp(v, 0, state.maxHp);
    else if (k==='sp') state.sp = clamp(v, 0, state.maxSp);
    else if (meterEnabled(k)) state[k] = clamp(v, 0, meterMax(k));
    else state[k] = v;
  }

  function healFull() {
    state.hp = state.maxHp; state.sp = state.maxSp;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function learnSkill(id) {
    if (!state.skills.includes(id)) state.skills.push(id);
  }
  function hasSkill(id) { return state.skills.includes(id); }

  // ---- 战斗结算时受到攻击 ----
  function getState() { return state; }
  function setState(s) { state = s; }
  function setG(g) { G = g; }
  function getG() { return G; }

  // ---- 道具 / 材料 / 合成 ----
  function addItem(id, count=1) {
    const st = getState();
    const it = st.inventory.find(i => i.id === id);
    if (it) it.count += count;
    else st.inventory.push({ id, count });
  }
  function hasItem(id, count=1) {
    const st = getState();
    const it = st.inventory.find(i => i.id === id);
    return !!(it && it.count >= count);
  }
  function removeItem(id, count=1) {
    const st = getState();
    const it = st.inventory.find(i => i.id === id);
    if (!it) return false;
    if (it.count < count) return false;
    it.count -= count;
    if (it.count <= 0) st.inventory = st.inventory.filter(i => i.id !== id);
    return true;
  }
  function addMaterial(id, count=1) {
    const st = getState();
    st.materials[id] = (st.materials[id]||0) + count;
  }
  function hasMaterial(id, count=1) {
    const st = getState();
    return (st.materials[id]||0) >= count;
  }
  function removeMaterial(id, count=1) {
    const st = getState();
    if ((st.materials[id]||0) < count) return false;
    st.materials[id] -= count;
    if (st.materials[id] <= 0) delete st.materials[id];
    return true;
  }
  function unlockRecipe(id) {
    const st = getState();
    st.recipes[id] = true;
  }
  function hasRecipe(id) { return !!getState().recipes[id]; }
  function craftRecipe(id) {
    // 配方定义在 battle.js 的 ITEMS/材料表里，这里只做通用扣料
    const st = getState();
    const G = getG();
    if (!G || !G.RECIPES || !G.RECIPES[id]) return { ok:false, msg:'未知配方' };
    const rp = G.RECIPES[id];
    const disc = st.craftDiscount || 0;
    const needOf = (n) => Math.max(1, Math.floor(n * (1 - disc)));   // 羽衣折扣：材料向下取整且至少 1
    // 检查材料（按折扣后需求量）
    for (const [m, n] of Object.entries(rp.cost)) {
      const need = needOf(n);
      if ((st.materials[m]||0) < need) return { ok:false, msg:'材料不足', need };
    }
    for (const [m, n] of Object.entries(rp.cost)) removeMaterial(m, needOf(n));
    addItem(rp.out.id, rp.out.count);
    return { ok:true, item:rp.out };
  }
  function addStatPts(n) { getState().statPts += n; }
  function addTrust(char, n) {
    const st = getState();
    if (!st.trust) st.trust = affinityInitial();
    const max = (cfg.affinities && cfg.affinities.max) || 100;
    if (char in st.trust) st.trust[char] = clamp(st.trust[char] + n, 0, max);
    recalcStats(st);
  }
  function getTrust(char) {
    const st = getState();
    if (!st.trust) st.trust = affinityInitial();
    return st.trust[char] ?? 0;
  }
  function getTrustAll() { return Object.freeze({...getState().trust}); }

  // ---- 羁绊等级（Confidant）----
  // 等级阈值来自配置 affinities.thresholds（默认：R1 0 / R2 30 / R3 60 / R4 80）
  function trustRank(trustValue) {
    const max = (cfg.affinities && cfg.affinities.max) || 100;
    const v = clamp(trustValue || 0, 0, max);
    let r = 1;
    const thr = (cfg.affinities && cfg.affinities.thresholds) || [];
    for (const t of thr) if (v >= t.min) r = t.rank;
    return r;
  }
  function getTrustRank(char) { return trustRank(getTrust(char)); }
  function confidantBonus(S) {
    S = S || getState();
    const per = {}; const ranks = {};
    const total = { atk:0, def:0, maxHp:0, spd:0, critChance:0, dmgReduction:0, craftDiscount:0, shopDiscount:0 };
    const bonuses = (cfg.affinities && cfg.affinities.bonuses) || {};
    for (const c of affinityList()) {
      const v = (S.trust && S.trust[c]) || 0;
      const r = trustRank(v);
      ranks[c] = r;
      per[c] = Object.assign({ rank: r }, (bonuses[c] || {})[r] || {});
      for (const k of Object.keys(per[c])) {
        if (k !== 'rank' && typeof per[c][k] === 'number') total[k] += per[c][k];
      }
    }
    return Object.assign({ ranks, total }, per);
  }
  function getConfidantBonus() { return confidantBonus(getState()); }
  function addAnchor(n) {
    getState().anchor = clamp((getState().anchor || meterInitial('anchor')) + n, 0, meterMax('anchor'));
  }
  function getAnchor() { return getState().anchor ?? meterInitial('anchor'); }
  function addStat(k, n) {
    const st = getState();
    if (st.statPts < n) return false;
    st.statPts -= n;
    st.stats[k] = (st.stats[k]||0) + n;
    recalcStats();
    return true;
  }

  // ---- 装备 / 货币 / 商店 ----
  function equipBonusOf(id) {
    if (!id) return null;
    const D = (typeof Data !== 'undefined' && Data) ? Data : null;
    if (!D || !D.getEquipment) return null;
    return D.getEquipment(id);
  }
  function equipBonuses(st) {
    const b = { atk:0, def:0, spd:0, maxHp:0 };
    for (const id of [st.armorId, st.accessoryId]) {
      const g = equipBonusOf(id);
      if (!g) continue;
      b.atk += g.atkBonus||0;
      b.def += g.defBonus||0;
      b.spd += g.spdBonus||0;
      b.maxHp += g.maxHpBonus||0;
    }
    return b;
  }
  function computeBonuses(st) {
    const eq = equipBonuses(st);
    const cb = confidantBonus(st).total;
    return {
      atk: (eq.atk||0) + (cb.atk||0),
      def: (eq.def||0) + (cb.def||0),
      spd: (eq.spd||0) + (cb.spd||0),
      maxHp: (eq.maxHp||0) + (cb.maxHp||0),
      dmgReduction: cb.dmgReduction||0,
      critChance: cb.critChance||0,
      craftDiscount: cb.craftDiscount||0,
      shopDiscount: cb.shopDiscount||0,
    };
  }
  function applyBonuses(st) {
    st = st || getState();
    const b = computeBonuses(st);
    st.atk = (st.atk||0) + b.atk;
    st.def = (st.def||0) + b.def;
    st.spd = (st.spd||0) + b.spd;
    st.maxHp = (st.maxHp||0) + b.maxHp;
    st.dmgReduction = b.dmgReduction;
    st.critChance = b.critChance;
    st.craftDiscount = b.craftDiscount;
    st.shopDiscount = b.shopDiscount;
    return b;
  }
  function getMoney() { return getState().money || 0; }
  function addMoney(n) {
    const st = getState();
    st.money = Math.max(0, (st.money||0) + n);
    return st.money;
  }
  function spendMoney(n) {
    const st = getState();
    if ((st.money||0) < n) return false;
    st.money -= n;
    return true;
  }
  // 物品类型：material → 材料；其余（item/equipment）→ 背包
  function itemKindOf(id) {
    const D = (typeof Data !== 'undefined' && Data) ? Data : null;
    if (!D) return null;
    if (D.getMaterial && D.getMaterial(id)) return 'material';
    if (D.getItem && D.getItem(id)) return 'item';
    if (D.getEquipment && D.getEquipment(id)) return 'equipment';
    return null;
  }
  function priceOf(id) {
    const D = (typeof Data !== 'undefined' && Data) ? Data : null;
    if (!D) return 0;
    const it = D.getItem && D.getItem(id);
    if (it && it.price != null) return it.price;
    const m = D.getMaterial && D.getMaterial(id);
    if (m && m.price != null) return m.price;
    const e = D.getEquipment && D.getEquipment(id);
    if (e && e.price != null) return e.price;
    return 0;
  }
  const SELL_RATIO = 0.5;
  function sellPriceOf(id) {
    const p = priceOf(id);
    return p > 0 ? Math.max(1, Math.floor(p * SELL_RATIO)) : 0;
  }
  function buyItem(id, qty=1) {
    qty = Math.max(1, Math.floor(qty));
    const kind = itemKindOf(id);
    const price = priceOf(id);
    if (!kind || price <= 0) return { ok:false, msg:'未知物品' };
    const st = getState();
    const unit = Math.round(price * (1 - (st.shopDiscount || 0)));   // 羽衣折扣：与商店面板显示一致
    const cost = unit * qty;
    if ((st.money||0) < cost) return { ok:false, msg:'金币不足', need: cost, money: st.money };
    st.money -= cost;
    if (kind === 'material') addMaterial(id, qty);
    else addItem(id, qty);
    return { ok:true, cost, qty, item:id, kind };
  }
  function sellItem(id, qty=1) {
    qty = Math.max(1, Math.floor(qty));
    const kind = itemKindOf(id);
    const price = sellPriceOf(id);
    if (!kind || price <= 0) return { ok:false, msg:'无法出售' };
    const st = getState();
    if (kind === 'material') {
      if (!hasMaterial(id, qty)) return { ok:false, msg:'材料不足' };
      removeMaterial(id, qty);
    } else {
      if (!hasItem(id, qty)) return { ok:false, msg:'物品不足' };
      removeItem(id, qty);
    }
    st.money = (st.money||0) + price * qty;
    return { ok:true, gained: price*qty, qty, item:id, kind };
  }
  function equipArmor(id) {
    const g = equipBonusOf(id);
    if (!g) return { ok:false, msg:'未知装备' };
    if (g.kind !== 'armor') return { ok:false, msg:'不是防具' };
    if (!hasItem(id, 1)) return { ok:false, msg:'背包中没有该装备' };
    getState().armorId = id;
    recalcStats();
    return { ok:true, slot:'armor', id };
  }
  function equipAccessory(id) {
    const g = equipBonusOf(id);
    if (!g) return { ok:false, msg:'未知装备' };
    if (g.kind !== 'accessory') return { ok:false, msg:'不是饰品' };
    if (!hasItem(id, 1)) return { ok:false, msg:'背包中没有该装备' };
    getState().accessoryId = id;
    recalcStats();
    return { ok:true, slot:'accessory', id };
  }
  function unequip(slot) {
    const st = getState();
    if (slot === 'armor') st.armorId = null;
    else if (slot === 'accessory') st.accessoryId = null;
    else return { ok:false, msg:'未知槽位' };
    recalcStats();
    return { ok:true, slot };
  }
  function getEquipped() {
    const st = getState();
    return { armor: st.armorId || null, accessory: st.accessoryId || null };
  }
  function recalcStats(st) {
    st = st || getState();
    const s = st.stats;
    const base = {
      maxHp: 100 + (s.vit||0)*12 + (st.level-1)*8,
      maxSp: 50 + (s.spi||0)*8 + (st.level-1)*4,
      atk: 12 + (s.str||0)*4 + (st.weaponLevel-1)*3 + (st.level-1)*2,
      def: 6 + (s.vit||0)*2 + (st.level-1),
      spd: 10 + (s.agi||0)*2 + (st.level-1),
    };
    // 难度倍率统一在这里应用，避免 recalcStats 抹掉难度效果
    const d = st.difficulty || 'normal';
    if (d === 'easy') {
      base.maxHp = Math.round(base.maxHp * 1.3);
      base.atk = Math.round(base.atk * 1.2);
    } else if (d === 'hard') {
      base.maxHp = Math.round(base.maxHp * 0.85);
      base.atk = Math.round(base.atk * 0.9);
      base.def = Math.round(base.def * 0.9);
    }
    st.maxHp = base.maxHp;
    st.maxSp = base.maxSp;
    st.atk = base.atk;
    st.def = base.def;
    st.spd = base.spd;
    applyBonuses(st);   // 装备 + 羁绊被动（数值加在难度倍率之后）
    if (st.hp > st.maxHp) st.hp = st.maxHp;
    if (st.sp > st.maxSp) st.sp = st.maxSp;
  }
  function upgradeWeapon() {
    const st = getState();
    const cost = st.weaponLevel*2;  // 需要的材料数量：暗蚀结晶
    if ((st.materials['dark_crystal']||0) < cost) return { ok:false, need: cost, msg:'暗蚀结晶不足' };
    removeMaterial('dark_crystal', cost);
    st.weaponLevel++;
    recalcStats();
    return { ok:true, level: st.weaponLevel };
  }
  function getStats() {
    const st = getState();
    const cb = confidantBonus(st);
    return {
      hp: st.hp, maxHp: st.maxHp, sp: st.sp, maxSp: st.maxSp,
      atk: st.atk, def: st.def, spd: st.spd,
      level: st.level, statPts: st.statPts, stats: st.stats, weaponLevel: st.weaponLevel,
      ero: st.ero,
      money: st.money || 0,
      armorId: st.armorId || null, accessoryId: st.accessoryId || null,
      trustRanks: cb.ranks,
      confidantBonus: cb,
      dmgReduction: st.dmgReduction || 0,
      critChance: st.critChance || 0,
      craftDiscount: st.craftDiscount || 0,
      shopDiscount: st.shopDiscount || 0,
    };
  }

  function formatTime(sec) {
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  function getDifficultyMult() {
    const d = getState().difficulty || 'normal';
    if (d === 'easy') return { enemyHp: 0.75, enemyAtk: 0.75, eroMult: 0.6 };
    if (d === 'hard') return { enemyHp: 1.2, enemyAtk: 1.15, eroMult: 1.2 };
    return { enemyHp: 1, enemyAtk: 1, eroMult: 1 };
  }

  return {
    SAVE_KEY, newGame, serialize, deserialize,
    saveSlot, loadSlot, clearSlot, clearAuto, autoSave, hasAuto, loadAuto, migrateState,
    saveToSlot, loadFromSlot, deleteSlot, listSaves, getAutoMeta, getSlotMeta, hasAnySave,
    saveGame, loadGame, fmtSavedAt,
    flag, setFlag, getVar, setVar, addVar,
    setStat, healFull, clamp, learnSkill, hasSkill,
    getState, setState, setG, getG, formatTime, getDifficultyMult,
    addItem, hasItem, removeItem,
    addMaterial, hasMaterial, removeMaterial,
    unlockRecipe, hasRecipe, craftRecipe,
    addStatPts, addStat, recalcStats, upgradeWeapon, getStats,
    addTrust, getTrust, getTrustAll, trustRank, getTrustRank, confidantBonus, getConfidantBonus,
    addAnchor, getAnchor,
    getMoney, addMoney, spendMoney, buyItem, sellItem,
    equipArmor, equipAccessory, unequip, getEquipped,
    configure, getConfig, resetConfig,
  };
})();

if (typeof window !== 'undefined') window.Engine = Engine;
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
