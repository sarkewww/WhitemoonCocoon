/* =========================================================
 * 白月茧响 - 敌人数据表
 * 所有战斗敌人的定义集中在这里，供 .story 剧本通过
 * battle: enemy: <id> 引用。
 * ========================================================= */
'use strict';

const ENEMIES = {

  spider1: {
    id: 'spider1', name: '织网之魔', title: '夜行魔物 · 触手蛛',
    hp: 80, atk: 14, def: 4, spd: 8, xp: 25, eroGain: 4,
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
    hp: 160, atk: 18, def: 6, spd: 6, xp: 50, eroGain: 8, isBoss: true,
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
    hp: 200, atk: 22, def: 5, spd: 10, xp: 60, eroGain: 10, isBoss: true,
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

  night_crawler: {
    id: 'night_crawler', name: '夜行之影', title: '夜行魔物 · 暗触',
    hp: 120, atk: 16, def: 5, spd: 9, xp: 35, eroGain: 6,
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

  source_cocoon: {
    id: 'source_cocoon', name: '源茧', title: '一切侵蚀的源头',
    hp: 250, atk: 24, def: 8, spd: 11, xp: 100, eroGain: 12, isBoss: true,
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

};

if (typeof module !== 'undefined' && module.exports) module.exports = { ENEMIES };
if (typeof window !== 'undefined') window.ENEMIES = ENEMIES;
