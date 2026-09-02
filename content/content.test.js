/* 白月茧响 - content/game-content.js 单元测试（node）
 *
 * 断言 GameContent 各字段存在且与 main.js / ui/*.js 中 grep 到的值逐字一致，
 * 并验证 window.GameContent 与 module.exports 双导出为同一对象。
 */
'use strict';
const assert = require('assert');

// 模拟浏览器 window，供双导出验证
global.window = globalThis;

const GameContent = require('./game-content.js');

// ===== 双导出 =====
assert.ok(GameContent, 'module.exports 应导出对象');
assert.strictEqual(typeof GameContent, 'object');
assert.strictEqual(window.GameContent, GameContent, 'window.GameContent 与 module.exports 应为同一对象');
assert.strictEqual(global.GameContent, GameContent, '全局 GameContent 应与 module.exports 一致');

// ===== 游戏元信息 =====
assert.strictEqual(GameContent.gameTitle, '白月茧响');
assert.strictEqual(GameContent.gameTitleEn, 'White Moon · Cocoon');
assert.strictEqual(GameContent.appTitle, '白月茧响 | White Moon Cocoon');
assert.strictEqual(GameContent.genre, '黑暗魔法少女 · 文字冒险RPG');
assert.strictEqual(GameContent.protagonist, '白月凌（白月绫音）');
assert.strictEqual(GameContent.worldSetting, '杭州 · 现代都市 · 超自然 · 校园');

// ===== charNames（main.js:484）=====
assert.deepStrictEqual(GameContent.charNames, { yuki: '雪', suzu: '铃', hagoromo: '羽衣' });

// ===== skillNames（6 个，core/data.js SKILLS / ui/battle.js getActionList）=====
assert.strictEqual(Object.keys(GameContent.skillNames).length, 6, '应为 6 个技能');
assert.deepStrictEqual(GameContent.skillNames, {
  strike: '苍月斩',
  pure: '净化之矢',
  guard: '防御',
  erosion: '蚀心之触',
  heal: '魂愈',
  ultimate: '白月破晓',
});

// ===== endings（7 个，ui/dialogue.js:53-61）=====
const ends = GameContent.endings;
assert.strictEqual(Object.keys(ends).length, 7, '应为 7 个结局');
assert.deepStrictEqual(ends['永劫'], { id: '永劫', art: [{ c: 'var(--accent-hi)', s: '  ═══ 苍月永劫 ═══' }], title: '苍月永劫', sub: '她成为了茧的一部分。力量永恒，自我消散。' });
assert.deepStrictEqual(ends['解放'], { id: '解放', art: [{ c: 'var(--green)', s: '═ 茧の解放 ╌' }], title: '茧の解放', sub: '契约被斩断，自由回归。但代价是被遗忘。' });
assert.deepStrictEqual(ends['残响'], { id: '残响', art: [{ c: 'var(--red-hi)', s: '╳ 残响 ╳' }], title: '残响', sub: '以生命为代价，净化了城市。白花在废墟中绽放。' });
assert.deepStrictEqual(ends['白月'], { id: '白月', art: [{ c: 'var(--accent-hi)', s: '  ☽ 白月 ☾' }], title: '白月', sub: '她接纳了新的自我，与茧共生。月光下，崭新的微笑。' });
assert.deepStrictEqual(ends['羽衣'], { id: '羽衣', art: [{ c: 'var(--cyan-hi)', s: '  ╰☆ 羽衣 ☆╯' }], title: '羽衣', sub: '他回到了原来的身体，但另一个她永远留在了茧中。有人转身离去，没有回头。' });
assert.deepStrictEqual(ends['雪'], { id: '雪', art: [{ c: 'var(--red-hi)', s: '  ❄ 雪 ❄' }], title: '雪', sub: '她永远做了绫音，被雪的爱囚禁在完美的牢笼中。镜中的微笑，不知为谁而笑。' });
assert.deepStrictEqual(ends['TRUE'], { id: 'TRUE', art: [{ c: 'var(--gold)', s: '  ☀ 白月新生 ☀' }], title: '白月 · 新生', sub: '凌与绫音和解，三人找到新的平衡。樱花树下，阳光正好。' });
// 每个结局都应有 art 数组（含 c/s）与 id/title/sub
for (const k of Object.keys(ends)) {
  assert.ok(Array.isArray(ends[k].art), k + ' 的 art 应为数组');
  assert.strictEqual(ends[k].id, k, 'id 应与键一致');
  assert.ok(ends[k].art[0] && ends[k].art[0].s, k + ' 的 art[0].s 应存在');
  assert.ok(ends[k].title, k + ' 的 title 应存在');
  assert.ok(ends[k].sub, k + ' 的 sub 应存在');
}

// ===== aboutText（main.js:334-348，15 行）=====
assert.strictEqual(GameContent.aboutText.length, 15, 'aboutText 应为 15 行');
assert.deepStrictEqual(GameContent.aboutText, [
  '《白月茧响》',
  '黑暗魔法少女 · 文字冒险RPG',
  '',
  '主角：白月凌（白月绫音）',
  '世界观：杭州 · 现代都市 · 超自然 · 校园',
  '',
  '触手魔物从人类负面情感中诞生。',
  '与「茧」签订契约，成为魔法少女——',
  '但每一份力量都在侵蚀你的存在。',
  '当茧成熟时，你还会是你吗？',
  '',
  '警告：本游戏包含暴力、恐怖、身体改造、',
  '强制转变等成人内容。',
  '',
  '按 Enter 返回',
]);

// ===== titleText =====
assert.ok(Array.isArray(GameContent.titleText.logo) && GameContent.titleText.logo.length > 0, 'titleText.logo 应为非空数组');
assert.strictEqual(GameContent.titleText.logo[16], '║             白  月  茧  响                    ║', 'logo 第 17 行应为中文标题');
assert.strictEqual(GameContent.titleText.byline, '> 杭州 · 星历 2026');
assert.strictEqual(GameContent.titleText.prompt, '按 Enter 或 点击 开始');
assert.strictEqual(GameContent.titleText.menu.length, 4, '标题菜单应为 4 项');
assert.strictEqual(GameContent.titleText.menu[0].label, '新的游戏');
assert.strictEqual(GameContent.titleText.menu[3].label, '关于');

// ===== mapTitles =====
assert.strictEqual(GameContent.mapTitles.city, '杭州');
assert.strictEqual(GameContent.mapTitles.format, '第{ch}章 · 杭州');
assert.ok(GameContent.mapTitles.format.indexOf('杭州') !== -1, 'format 应包含城市名');

// ===== 其他内容常量 =====
assert.deepStrictEqual(GameContent.difficultyNames, { easy: '新手', normal: '普通', hard: '困难' });
assert.deepStrictEqual(GameContent.chapterNames, ['序章', '第一章', '第二章', '第三章', '终章']);

console.log('OK - content/game-content.js 全部断言通过（' + Object.keys(ends).length + ' 结局 / ' + Object.keys(GameContent.skillNames).length + ' 技能）');
