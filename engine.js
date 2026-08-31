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
      money: 500,          // 货币（金币）
      armorId: null,       // 防具槽（装备 id）
      accessoryId: null,   // 饰品槽（装备 id）
      statPts: 0,          // 属性点（未分配）
      stats: { str:1, vit:1, spi:1, agi:1 },  // 力量/体力/灵力/敏捷
      doneScenes: {},      // 已执行过 onEnter 的场景
      log: [],
    };
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
    try {
      localStorage.setItem(SAVE_KEY, serialize(state));
      return true;
    } catch (e) { return false; }
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
    if (!out.trust || typeof out.trust !== 'object') out.trust = { yuki: 0, suzu: 0, hagoromo: 0 };
    else { out.trust.yuki = out.trust.yuki||0; out.trust.suzu = out.trust.suzu||0; out.trust.hagoromo = out.trust.hagoromo||0; }
    if (typeof out.anchor !== 'number' || isNaN(out.anchor)) out.anchor = 50;
    else out.anchor = Math.max(0, Math.min(100, out.anchor));
    if (typeof out.ero !== 'number' || isNaN(out.ero)) out.ero = 0;
    else out.ero = Math.max(0, Math.min(100, out.ero));
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
  function addStatPts(n) { getState().statPts += n; }
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

  // ---- 羁绊等级（Confidant）----
  // 等级阈值：R1 0 / R2 30 / R3 60 / R4 80
  const TRUST_RANK_THRESHOLDS = [
    { rank: 1, min: 0 },
    { rank: 2, min: 30 },
    { rank: 3, min: 60 },
    { rank: 4, min: 80 },
  ];
  // 各角色各等级解锁的被动加成（数值加成经 recalcStats 合入 S.atk/def/maxHp，比率类暴露为 S.critChance 等）
  const CONFIDANT_BONUS_TABLE = {
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
  };
  const CONFIDANT_CHARS = ['yuki', 'suzu', 'hagoromo'];

  function trustRank(trustValue) {
    const v = clamp(trustValue || 0, 0, 100);
    let r = 1;
    for (const t of TRUST_RANK_THRESHOLDS) if (v >= t.min) r = t.rank;
    return r;
  }
  function getTrustRank(char) { return trustRank(getTrust(char)); }
  function confidantBonus(S) {
    S = S || getState();
    const per = {}; const ranks = {};
    const total = { atk:0, def:0, maxHp:0, spd:0, critChance:0, dmgReduction:0, craftDiscount:0, shopDiscount:0 };
    for (const c of CONFIDANT_CHARS) {
      const v = (S.trust && S.trust[c]) || 0;
      const r = trustRank(v);
      ranks[c] = r;
      per[c] = Object.assign({ rank: r }, CONFIDANT_BONUS_TABLE[c][r]);
      for (const k of Object.keys(per[c])) {
        if (k !== 'rank' && typeof per[c][k] === 'number') total[k] += per[c][k];
      }
    }
    return { ranks, yuki: per.yuki, suzu: per.suzu, hagoromo: per.hagoromo, total };
  }
  function getConfidantBonus() { return confidantBonus(getState()); }
  function addAnchor(n) { getState().anchor = clamp((getState().anchor||50) + n, 0, 100); }
  function getAnchor() { return getState().anchor ?? 50; }
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
    const cost = price * qty;
    const st = getState();
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
  };
})();

if (typeof window !== 'undefined') window.Engine = Engine;
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
