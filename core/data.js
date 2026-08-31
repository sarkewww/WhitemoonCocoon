const Data = (() => {
  // ===== 物品类型枚举 =====
  const ITEM_KINDS = { heal:'heal', sp:'sp', ero:'ero', combo:'combo', buff:'buff', key:'key', material:'material' };

  // ===== 物品数据库 =====
  const ITEMS = {
    potion:   { name:'魂愈药水', desc:'恢复 35% HP', kind:ITEM_KINDS.heal, heal:0.35, price:80 },
    mega_potion: { name:'月光圣水', desc:'恢复 70% HP', kind:ITEM_KINDS.heal, heal:0.70, price:250 },
    ether:    { name:'灵力凝露', desc:'恢复 40% SP', kind:ITEM_KINDS.sp, sp:0.40, price:100 },
    mega_ether: { name:'白月凝露', desc:'恢复 80% SP', kind:ITEM_KINDS.sp, sp:0.80, price:220 },
    sedative: { name:'镇魂药剂', desc:'侵蚀 -12', kind:ITEM_KINDS.ero, ero:-12, price:150 },
    tear:     { name:'银泪结晶', desc:'恢复 30% HP + 侵蚀 -8', kind:ITEM_KINDS.combo, heal:0.30, ero:-8, price:200 },
    shard:    { name:'苍月碎片', desc:'下回合攻击 +50%', kind:ITEM_KINDS.buff, buff:'atk', price:180 },
    memory_amulet: { name:'记忆防护符', desc:'侵蚀 -15', kind:ITEM_KINDS.ero, ero:-15, price:250 },
    dream_bandage: { name:'织梦绷带', desc:'恢复 30% SP', kind:ITEM_KINDS.sp, sp:0.30, price:120 },
  };

  // ===== 材料数据库 =====
  const MATERIALS = {
    tentacle_frag: { name:'触手残片', desc:'魔物的残骸，隐隐蠕动', price:10 },
    dark_crystal:  { name:'暗蚀结晶', desc:'浓缩的侵蚀之力，用于强化武器', price:50 },
    essence:       { name:'魂之精华', desc:'契约者力量的沉淀', price:30 },
    moon_petal:    { name:'月见花瓣', desc:'在月光下绽放的花瓣，安宁的气息', price:15 },
    memory_shard:  { name:'记忆碎片', desc:'封存着某人记忆的碎片，在月光下微微发光', price:40 },
    dream_silk:    { name:'织梦丝', desc:'夜之魔物吐出的丝线，缠绕着残留的梦境', price:35 },
  };

  // ===== 装备数据库 =====
  // kind: armor(防具) / accessory(饰品)；bonus 字段供 recalcStats 纳入
  const EQUIPMENT = {
    // 防具
    robe_white:   { name:'白夜羽织', desc:'抵御侵蚀的轻甲，防御 +3', kind:'armor', defBonus:3, price:200 },
    moon_armor:   { name:'银月甲胄', desc:'月华淬炼的重甲，防御 +5 生命 +15', kind:'armor', defBonus:5, maxHpBonus:15, price:380 },
    silk_robe:    { name:'织梦丝袍', desc:'以织梦丝编成的袍子，防御 +4 敏捷 +2', kind:'armor', defBonus:4, spdBonus:2, price:280 },
    // 饰品
    moon_ring:    { name:'月轮戒指', desc:'流转月光的戒指，攻击 +3', kind:'accessory', atkBonus:3, price:180 },
    bell_charm:   { name:'铃音护符', desc:'清越铃音，敏捷 +3', kind:'accessory', spdBonus:3, price:150 },
    memory_brooch:{ name:'记忆胸针', desc:'封存记忆的胸针，攻击 +2 生命 +10', kind:'accessory', atkBonus:2, maxHpBonus:10, price:220 },
  };

  // ===== 配方数据库 =====
  const RECIPES = {
    r_potion:  { name:'调和魂愈药水', cost:{ tentacle_frag:2, moon_petal:1 }, out:{ id:'potion', count:1 } },
    r_ether:   { name:'凝练灵力凝露', cost:{ essence:1, moon_petal:2 }, out:{ id:'ether', count:1 } },
    r_sedative:{ name:'炼制镇魂药剂', cost:{ dark_crystal:1, moon_petal:3 }, out:{ id:'sedative', count:1 } },
    r_tear:    { name:'凝成银泪结晶', cost:{ essence:2, moon_petal:2 }, out:{ id:'tear', count:1 } },
    r_mega:    { name:'升华月光圣水', cost:{ potion:2, essence:1, moon_petal:2 }, out:{ id:'mega_potion', count:1 } },
    r_memory_amulet: { name:'结缘记忆防护符', cost:{ memory_shard:2, moon_petal:2 }, out:{ id:'memory_amulet', count:1 } },
    r_dream_bandage: { name:'织造织梦绷带', cost:{ dream_silk:2, essence:1 }, out:{ id:'dream_bandage', count:1 } },
  };

  // ===== 敌人数据库（从 enemies.js 读取，保持引用一致） =====
  function getEnemy(id) {
    return (typeof window !== 'undefined' && window.ENEMIES) ? window.ENEMIES[id] : null;
  }
  function getAllEnemies() {
    return (typeof window !== 'undefined' && window.ENEMIES) ? window.ENEMIES : {};
  }

  // ===== 区域数据库（从 World 读取） =====
  function getDistrict(chapter, id) {
    if (typeof World === 'undefined') return null;
    const districts = World.getDistricts ? World.getDistricts(chapter) : [];
    return districts.find(d => d.id === id) || null;
  }

  // ===== 技能数据库 =====
  const SKILLS = {
    strike:   { name:'苍月斩', cost:0, desc:'基础攻击', kind:'physical', mult:1.0 },
    pure:     { name:'净化之矢', cost:20, desc:'灵力射击', kind:'magic', mult:1.7 },
    guard:    { name:'防御', cost:0, desc:'格挡', kind:'guard' },
    erosion:  { name:'蚀心之触', cost:25, desc:'无视防御，高伤害', kind:'erosion', mult:2.4, ignoreDef:true, eroCost:8 },
    heal:     { name:'魂愈', cost:15, desc:'回复 HP', kind:'heal', heal:0.28 },
    ultimate: { name:'白月破晓', cost:0, desc:'必杀技', kind:'ultimate', mult:3.8, ignoreDef:true },
  };

  // ===== 查询方法 =====
  function getItem(id) { return ITEMS[id] || null; }
  function getMaterial(id) { return MATERIALS[id] || null; }
  function getEquipment(id) { return EQUIPMENT[id] || null; }
  function getRecipe(id) { return RECIPES[id] || null; }
  function getSkill(id) { return SKILLS[id] || null; }
  function getAllItems() { return ITEMS; }
  function getAllMaterials() { return MATERIALS; }
  function getAllEquipment() { return EQUIPMENT; }
  function getAllRecipes() { return RECIPES; }
  function getAllSkills() { return SKILLS; }
  // 统一买入价（物品/材料/装备），卖出价 = 买入价 × 0.5
  function getPrice(id) {
    const src = getItem(id) || getMaterial(id) || getEquipment(id);
    return src ? (src.price || 0) : 0;
  }
  function getSellPrice(id) {
    const p = getPrice(id);
    return p > 0 ? Math.max(1, Math.floor(p * 0.5)) : 0;
  }
  function getAllShop() {
    const out = {};
    for (const k in ITEMS) out[k] = { id:k, kind:'item', name:ITEMS[k].name, price:getPrice(k), sellPrice:getSellPrice(k) };
    for (const k in MATERIALS) out[k] = { id:k, kind:'material', name:MATERIALS[k].name, price:getPrice(k), sellPrice:getSellPrice(k) };
    for (const k in EQUIPMENT) out[k] = { id:k, kind:'equipment', name:EQUIPMENT[k].name, price:getPrice(k), sellPrice:getSellPrice(k) };
    return out;
  }
  // 配方价格关联（只读辅助，不改 craftRecipe 逻辑）
  function getRecipeValue(id) {
    const r = RECIPES[id];
    if (!r) return null;
    let costValue = 0;
    for (const [m, n] of Object.entries(r.cost || {})) costValue += getPrice(m) * n;
    const outValue = getPrice(r.out.id) * (r.out.count || 1);
    return { outValue, costValue, profit: outValue - costValue };
  }

  return {
    ITEM_KINDS, ITEMS, MATERIALS, EQUIPMENT, RECIPES, SKILLS,
    getItem, getMaterial, getEquipment, getRecipe, getSkill, getEnemy, getAllEnemies,
    getAllItems, getAllMaterials, getAllEquipment, getAllRecipes, getAllSkills, getDistrict,
    getPrice, getSellPrice, getAllShop, getRecipeValue,
  };
})();
if (typeof window !== 'undefined') window.Data = Data;
if (typeof module !== 'undefined' && module.exports) module.exports = Data;