/* =========================================================
 * 白月茧响 - 核心引擎
 * ========================================================= */
'use strict';

const Engine = (() => {

  const SAVE_KEY = 'wmc_save_v1';
  const AUTO_KEY = 'wmc_auto_v1';

  let state = null;
  let G = null; // 全局数据（来自 story.js / battle.js）

  // ---- 状态初始化 ----
  // 难度：easy / normal / hard
  function newGame(difficulty = 'normal') {
    const s = {
      scene: 'prologue_0',
      sceneIdx: 0,          // 场景内推进位置
      chapter: 0,
      difficulty: difficulty,
      flags: {},
      vars: {},
      hp: 100, maxHp: 100,
      sp: 50, maxSp: 50,
      ero: 0,               // 侵蚀度 0-100（茧的成长）
      atk: 12, def: 6, spd: 10,
      xp: 0,
      level: 1,
      name: '绫音',
      trueName: '凌',
      weapon: 1,
      combos: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      playTime: 0,
      deaths: 0,
      decisions: {},
      trust: { yuki: 0, suzu: 0, hagoromo: 0 },  // 好感度：雪/铃/羽衣 0-100
      anchor: 50,  // 自我锚点 0-100：凌的意志残留。结局 gate 条件之一
      endings: [],
      skills: ['strike'],
      unlocked: {},
      inventory: [],       // 可用道具 [{id,count}]
      materials: {},       // 合成材料 {matId:count}
      recipes: {},         // 已解锁合成配方 {recipeId:true}
      weaponLevel: 1,      // 武器强化等级
      ap: 0,               // 属性点（未分配）
      stats: { str:1, vit:1, spi:1, agi:1 },  // 力量/体力/灵力/敏捷
      doneScenes: {},      // 已执行过 onEnter 的场景
      log: [],
    };
    // 初始属性计算（此时 state 未挂载，直接算一次）
    s.maxHp = 100 + (s.stats.vit)*12;
    s.maxSp = 50 + (s.stats.spi)*8;
    s.atk = 12 + (s.stats.str)*4;
    s.def = 6 + (s.stats.vit)*2;
    s.spd = 10 + (s.stats.agi)*2;
    // 难度加成
    if (difficulty === 'easy') {
      s.maxHp = Math.round(s.maxHp * 1.3); s.hp = s.maxHp;
      s.atk = Math.round(s.atk * 1.2);
    } else if (difficulty === 'hard') {
      s.maxHp = Math.round(s.maxHp * 0.75);
      s.hp = s.maxHp;
      s.atk = Math.round(s.atk * 0.85);
      s.def = Math.round(s.def * 0.85);
    }
    return s;
  }

  function serialize(s) {
    return JSON.stringify(s);
  }

  function deserialize(str) {
    return JSON.parse(str);
  }

  function saveSlot() {
    try {
      localStorage.setItem(SAVE_KEY, serialize(state));
      return true;
    } catch (e) { return false; }
  }

  // 迁移：为旧存档补齐新字段默认值
  function migrateState(s) {
    const base = newGame();
    const out = Object.assign({}, base, s);
    if (!out.stats) out.stats = { str:1, vit:1, spi:1, agi:1 };
    else { out.stats.str = out.stats.str||1; out.stats.vit = out.stats.vit||1; out.stats.spi = out.stats.spi||1; out.stats.agi = out.stats.agi||1; }
    if (!Array.isArray(out.inventory)) out.inventory = [];
    if (!out.materials || typeof out.materials !== 'object') out.materials = {};
    if (!out.recipes || typeof out.recipes !== 'object') out.recipes = {};
    if (typeof out.weaponLevel !== 'number' || out.weaponLevel < 1) out.weaponLevel = 1;
    if (typeof out.ap !== 'number') out.ap = 0;
    if (!out.doneScenes || typeof out.doneScenes !== 'object') out.doneScenes = {};
    if (!out.trust || typeof out.trust !== 'object') out.trust = { yuki: 0, suzu: 0, hagoromo: 0 };
    else { out.trust.yuki = out.trust.yuki||0; out.trust.suzu = out.trust.suzu||0; out.trust.hagoromo = out.trust.hagoromo||0; }
    if (typeof out.anchor !== 'number') out.anchor = 50;
    if (typeof out.ero !== 'number') out.ero = 0;
    if (typeof out.level !== 'number' || out.level < 1) out.level = 1;
    if (!Array.isArray(out.skills) || out.skills.length === 0) out.skills = ['strike'];
    if (!Array.isArray(out.endings)) out.endings = [];
    recalcStats(out);
    return out;
  }

  function loadSlot() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      state = migrateState(deserialize(raw));
      return true;
    } catch (e) { return false; }
  }

  function clearSlot() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
  function clearAuto() {
    try { localStorage.removeItem(AUTO_KEY); } catch(e) {}
  }

  function autoSave() {
    try { localStorage.setItem(AUTO_KEY, serialize(state)); } catch(e) {}
  }

  function hasAuto() {
    try { return !!localStorage.getItem(AUTO_KEY); } catch(e){ return false; }
  }

  function loadAuto() {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (!raw) return false;
      state = migrateState(deserialize(raw));
      return true;
    } catch(e){ return false; }
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
    else if (k==='ero') state.ero = clamp(v, 0, 100);
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
    // 检查材料
    for (const [m, n] of Object.entries(rp.cost)) {
      if ((st.materials[m]||0) < n) return { ok:false, msg:'材料不足' };
    }
    for (const [m, n] of Object.entries(rp.cost)) removeMaterial(m, n);
    addItem(rp.out.id, rp.out.count);
    return { ok:true, item:rp.out };
  }
  function addAP(n) { getState().ap += n; }
  function addTrust(char, n) {
    const st = getState();
    if (!st.trust) st.trust = { yuki: 0, suzu: 0, hagoromo: 0 };
    if (char in st.trust) st.trust[char] = clamp(st.trust[char] + n, 0, 100);
  }
  function getTrust(char) {
    const st = getState();
    if (!st.trust) st.trust = { yuki: 0, suzu: 0, hagoromo: 0 };
    return st.trust[char] ?? 0;
  }
  function getTrustAll() { return Object.freeze({...getState().trust}); }
  function addAnchor(n) { getState().anchor = clamp((getState().anchor||50) + n, 0, 100); }
  function getAnchor() { return getState().anchor ?? 50; }
  function addStat(k, n) {
    const st = getState();
    if (st.ap < n) return false;
    st.ap -= n;
    st.stats[k] = (st.stats[k]||0) + n;
    recalcStats();
    return true;
  }
  function recalcStats(st) {
    st = st || getState();
    const s = st.stats;
    st.maxHp = 100 + (s.vit||0)*12 + (st.level-1)*8;
    st.maxSp = 50 + (s.spi||0)*8 + (st.level-1)*4;
    st.atk = 12 + (s.str||0)*4 + (st.weaponLevel-1)*3 + (st.level-1)*2;
    st.def = 6 + (s.vit||0)*2 + (st.level-1);
    st.spd = 10 + (s.agi||0)*2 + (st.level-1);
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
    return {
      hp: st.hp, maxHp: st.maxHp, sp: st.sp, maxSp: st.maxSp,
      atk: st.atk, def: st.def, spd: st.spd,
      level: st.level, ap: st.ap, stats: st.stats, weaponLevel: st.weaponLevel,
      ero: st.ero,
    };
  }

  function formatTime(sec) {
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  function getDifficultyMult() {
    const d = getState().difficulty || 'normal';
    if (d === 'easy') return { enemyHp: 0.75, enemyAtk: 0.75, eroMult: 0.6 };
    if (d === 'hard') return { enemyHp: 1.35, enemyAtk: 1.25, eroMult: 1.4 };
    return { enemyHp: 1, enemyAtk: 1, eroMult: 1 };
  }

  return {
    SAVE_KEY, newGame, serialize, deserialize,
    saveSlot, loadSlot, clearSlot, clearAuto, autoSave, hasAuto, loadAuto, migrateState,
    flag, setFlag, getVar, setVar, addVar,
    setStat, healFull, clamp, learnSkill, hasSkill,
    getState, setState, setG, getG, formatTime, getDifficultyMult,
    addItem, hasItem, removeItem,
    addMaterial, hasMaterial, removeMaterial,
    unlockRecipe, hasRecipe, craftRecipe,
    addAP, addStat, recalcStats, upgradeWeapon, getStats,
    addTrust, getTrust, getTrustAll,
    addAnchor, getAnchor,
  };
})();

if (typeof window !== 'undefined') window.Engine = Engine;
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
