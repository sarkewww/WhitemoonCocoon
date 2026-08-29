/* =========================================================
 * 白月茧响 - 敌人数据表
 * 所有战斗敌人的定义集中在这里，供 .story 剧本通过
 * battle: enemy: <id> 引用。
 * ========================================================= */
'use strict';

const ENEMIES = {

  spider1: {
    id: 'spider1', name: '织网之魔', title: '夜行魔物 · 触手蛛',
    hp: 80, atk: 14, def: 4, spd: 8, xp: 25, eroGain: 2,
    sprite: [
      '    ╱◣    ◢╲    ',
      '  ╱  ◉╲╱◉  ╲  ',
      ' ╱   ══╬══   ╲ ',
      ' ╲   ╱ ╲ ╲   ╱ ',
      '  ╲╱  〰  ╲╱  ',
      '  ╱╲  ╱╲  ╱╲  ',
      ' 〰 〰〰 〰〰 〰 ',
    ],
    skills: [{ type: 'claw', w: 3 }, { type: 'tentacle', w: 2 }, { type: 'bind', w: 1.5 }],
  },

  mother1: {
    id: 'mother1', name: '母巢 · 触手之茧', title: '精英魔物 · 侵蚀核心',
    hp: 160, atk: 18, def: 6, spd: 6, xp: 50, eroGain: 4, isBoss: true,
    sprite: [
      '    ╭━◈━╮    ',
      '  ╭━┃  〰 ┃━╮  ',
      ' ┃  ┃ ◉◉ ┃  ┃  ',
      ' ┃  ┃  ▼  ┃  ┃  ',
      ' ┃  ╰━━━╯  ┃  ',
      ' ┃ 〰┃   ┃〰 ┃  ',
      ' ╰━━┷━━━┷━━╯  ',
      '  〰〰  〰〰〰  ',
    ],
    skills: [{ type: 'claw', w: 2 }, { type: 'tentacle', w: 3 }, { type: 'lifesteal', w: 2 }, { type: 'erosionBurst', w: 1.5 }],
  },

  saya_burst: {
    id: 'saya_burst', name: '暴走 · 铃的茧', title: '侵蚀暴走体',
    hp: 200, atk: 22, def: 5, spd: 10, xp: 60, eroGain: 5, isBoss: true,
    sprite: [
      '   ╭━━━━━╮   ',
      '  ┃ ◉  ◉ ┃  ',
      '  ┃  ▼  ┃  ',
      '  ┃ 〰〰〰┃  ',
      '  ╰┳━━━┳╯  ',
      '  ╱┃   ┃╲  ',
      ' 〰┃   ┃〰  ',
      ' ┃┃   ┃┃  ',
      ' 〰┃   ┃〰  ',
    ],
    skills: [{ type: 'tentacle', w: 3 }, { type: 'claw', w: 2 }, { type: 'lifesteal', w: 2 }, { type: 'erosionBurst', w: 2 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.3) return 'erosionBurst';
      return null;
    },
  },

  patrol_ghost: {
    id: 'patrol_ghost', name: '怨念之影', title: '夜行魔物 · 漂泊的怨念',
    hp: 65, atk: 13, def: 3, spd: 9, xp: 20, eroGain: 2,
    sprite: [
      '    ╭───╮    ',
      '   ╱ ◉ ◉ ╲   ',
      '  │   ▼   │  ',
      '  ╰───╥──╯  ',
      '  〰  ╱╲  〰  ',
      '  〰〰〰〰〰  ',
      ' 〰  〰〰  〰  ',
    ],
    skills: [{ type: 'erosionBurst', w: 3 }, { type: 'tentacle', w: 2 }],
  },

  patrol_eye: {
    id: 'patrol_eye', name: '观测之眼', title: '夜行魔物 · 浮游的凝视者',
    hp: 45, atk: 11, def: 2, spd: 12, xp: 22, eroGain: 1,
    drops: { memory_shard: 1 },
    sprite: [
      '   ╭──◉──╮   ',
      '  ╱  ◉◉  ╲  ',
      '  │   ▼   │  ',
      '  ╰───╥──╯  ',
      '  〰  ╱╲  〰  ',
      '  〰〰  〰〰  ',
    ],
    skills: [{ type: 'claw', w: 2.5 }, { type: 'tentacle', w: 1.5 }],
  },

  patrol_vine: {
    id: 'patrol_vine', name: '贪食之藤', title: '夜行魔物 · 饥饿的藤蔓',
    hp: 85, atk: 11, def: 7, spd: 4, xp: 23, eroGain: 2,
    drops: { dream_silk: 1 },
    sprite: [
      '  ╭──〰──╮  ',
      '  │ ◉  ◉ │  ',
      '  ╰──▼──╯  ',
      '  ╱╱〰〰╲╲  ',
      '  〰    〰  ',
      '  〰〰  〰〰  ',
    ],
    skills: [{ type: 'bind', w: 3 }, { type: 'tentacle', w: 2 }, { type: 'claw', w: 1.5 }],
  },

  night_crawler: {
    id: 'night_crawler', name: '夜行之影', title: '夜行魔物 · 暗触',
    hp: 120, atk: 16, def: 5, spd: 9, xp: 35, eroGain: 3,
    sprite: [
      '   ╭─────╮   ',
      '  │  ◉ ◉  │  ',
      '  │   ▼   │  ',
      '  ╰──┬──╯  ',
      '   〰 │ 〰   ',
      '  〰〰〰〰〰  ',
      ' 〰  〰〰  〰  ',
    ],
    skills: [{ type: 'tentacle', w: 2 }, { type: 'claw', w: 2 }, { type: 'erosionBurst', w: 3 }],
  },

  guard1: {
    id: 'guard1', name: '茧卫 · 侵蚀傀儡', title: '前代契约者',
    hp: 180, atk: 20, def: 7, spd: 9, xp: 55, eroGain: 3,
    drops: { dream_silk: 1 },
    sprite: [
      '  ╭─◈─╮  ',
      '  │ ◉◉ │  ',
      '  │  ▼  │  ',
      '  ╰─┸─╯  ',
      '   〰 〰   ',
      '  〰〰〰  ',
      '   〰 〰   ',
    ],
    skills: [{ type: 'tentacle', w: 2 }, { type: 'claw', w: 2 }, { type: 'erosionBurst', w: 3 }],
  },

  source_defense: {
    id: 'source_defense', name: '源茧的触手', title: '源茧 · 防御机制',
    hp: 250, atk: 24, def: 8, spd: 11, xp: 100, eroGain: 6, isBoss: true,
    drops: { dark_crystal: 1, memory_shard: 1 },
    sprite: [
      '   ╭━━━━━╮   ',
      '  ┃ ◉  ◉ ┃  ',
      '  ┃  ▼  ┃  ',
      '  ┃ 〰〰〰┃  ',
      '  ╰┳━━━┳╯  ',
      '   〰 〰 〰   ',
      '  〰  〰  〰  ',
      ' 〰┃   ┃〰  ',
    ],
    skills: [{ type: 'tentacle', w: 3 }, { type: 'claw', w: 2 }, { type: 'erosionBurst', w: 2 }],
  },

  source_cocoon: {
    id: 'source_cocoon', name: '源茧', title: '一切侵蚀的源头',
    hp: 250, atk: 24, def: 8, spd: 11, xp: 100, eroGain: 6, isBoss: true,
    sprite: [
      '    ╭━━━╮    ',
      '   ╱ ◉ ◉ ╲   ',
      '  ╱   ▼   ╲  ',
      ' ╱ 〰〰〰〰〰 ╲ ',
      ' ╰━━━━━━━━━╯ ',
      '  〰 〰 〰 〰  ',
      '〰 〰 〰 〰 〰  ',
    ],
    skills: [{ type: 'tentacle', w: 3 }, { type: 'claw', w: 2 }, { type: 'lifesteal', w: 2.5 }, { type: 'erosionBurst', w: 2 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.4) return 'erosionBurst';
      return null;
    },
  },

  red_suzu_berserk: {
    id: 'red_suzu_berserk', name: '铃 · 侵蚀暴走', title: '红线 · 被茧夺走的先辈',
    hp: 260, atk: 25, def: 6, spd: 13, xp: 90, eroGain: 6, isBoss: true,
    sprite: [
      '   ╭━━━━━╮   ',
      '  ┃ ◉  ◉ ┃  ',
      '  ┃  ▼  ┃  ',
      '  ┃〰〰〰┃  ',
      '  ╰┳━━━┳╯  ',
      '  ╱┃   ┃╲  ',
      ' 〰┃   ┃〰  ',
      ' ┃┃   ┃┃  ',
      ' 〰┃   ┃〰  ',
    ],
    skills: [{ type: 'tentacle', w: 3 }, { type: 'lifesteal', w: 2.5 }, { type: 'erosionBurst', w: 2.5 }, { type: 'claw', w: 1.5 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.35) return 'erosionBurst';
      return null;
    },
  },

  white_hagoromo_guard: {
    id: 'white_hagoromo_guard', name: '羽衣 · 前代卫兵', title: '白线 · 不愿承认命运的卫兵',
    hp: 240, atk: 24, def: 9, spd: 14, xp: 90, eroGain: 6, isBoss: true,
    sprite: [
      '  ╭─◈─╮  ',
      '  │ ◉◉ │  ',
      '  │  ▼  │  ',
      '  ╰─┸─╯  ',
      '  〰 〰 〰  ',
      ' 〰〰〰〰〰  ',
      '   〰 〰   ',
    ],
    skills: [{ type: 'erosionBurst', w: 3 }, { type: 'tentacle', w: 2 }, { type: 'claw', w: 2 }, { type: 'bind', w: 1.5 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.3) return 'erosionBurst';
      return null;
    },
  },

  blue_yuki_yandere: {
    id: 'blue_yuki_yandere', name: '执念之雪', title: '青线 · 具现化的占有',
    hp: 220, atk: 23, def: 5, spd: 16, xp: 90, eroGain: 6, isBoss: true,
    sprite: [
      '   ╭──◉──╮   ',
      '  ╱  ◉◉  ╲  ',
      '  │   ▼   │  ',
      '  ╰───╥──╯  ',
      '  〰  ╱╲  〰  ',
      ' 〰〰  〰 〰〰 ',
      '〰   〰〰   〰 ',
    ],
    skills: [{ type: 'bind', w: 1.5 }, { type: 'tentacle', w: 2 }, { type: 'erosionBurst', w: 2 }, { type: 'claw', w: 2 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.35) return 'erosionBurst';
      return null;
    },
  },

  lone_source_director: {
    id: 'lone_source_director', name: '执镜之守', title: '孤狼线 · 源茧的守门者',
    hp: 280, atk: 27, def: 8, spd: 12, xp: 100, eroGain: 7, isBoss: true,
    sprite: [
      '    ╭───╮    ',
      '   ╱ ◉ ◉ ╲   ',
      '  ╱   ▼   ╲  ',
      '  │   ◆   │  ',
      '  ╰─┳─┳─╯  ',
      '   〰 〰 〰   ',
      '  〰 〰 〰  〰 ',
      '〰  〰  〰  〰 ',
    ],
    skills: [{ type: 'erosionBurst', w: 3 }, { type: 'tentacle', w: 2 }, { type: 'lifesteal', w: 2 }, { type: 'claw', w: 2 }],
    scripted: (e, pl) => {
      if (e.hp < e.maxHp * 0.4) return 'erosionBurst';
      return null;
    },
  },

};

if (typeof module !== 'undefined' && module.exports) module.exports = { ENEMIES };
if (typeof window !== 'undefined') window.ENEMIES = ENEMIES;
