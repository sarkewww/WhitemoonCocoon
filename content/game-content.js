/* 白月茧响 - 内容配置层（content/game-content.js）
 *
 * 从 main.js / ui/*.js 中抽离的白月专属内容常量，集中为一个可替换的数据源。
 * 本文件【只做数据集中】，不改动任何引擎/UI 文件；后续接线时由引擎层读取本数据源。
 * 所有数据值均与源文件逐字一致（来源行号见各段注释）。
 *
 * 双导出：window.GameContent（浏览器） + module.exports（Node 测试）
 */
(function (root, factory) {
  const G = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = G; }
  if (root) { root.GameContent = G; }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis), function () {

  const GameContent = {

    // ===================== 游戏元信息 =====================
    // 源：main.js showAbout / bootSequence / index.html <title> / manifest.webmanifest
    gameTitle: '白月茧响',                                  // main.js:334（showAbout 首行）
    gameTitleEn: 'White Moon · Cocoon',                     // main.js:247（bootLogo）
    appTitle: '白月茧响 | White Moon Cocoon',               // index.html:12 / manifest name
    genre: '黑暗魔法少女 · 文字冒险RPG',                    // main.js:335
    protagonist: '白月凌（白月绫音）',                           // main.js:337（已本地化）
    worldSetting: '杭州 · 现代都市 · 超自然 · 校园',          // main.js:338（已本地化）
    // 版本号：main.js / ui/*.js 未定义显式版本常量（manifest 亦无 version 字段），暂以 null 占位
    gameVersion: null,

    // ===================== 角色名 =====================
    // 源：main.js:484 CHAR_NAMES / ui/menu.js:34 CHAR_NAMES（两处逐字一致）
    charNames: { yuki: '雪', suzu: '铃', hagoromo: '羽衣' },

    // ===================== 技能显示名（6 个） =====================
    // 源：core/data.js:68-75 SKILLS / ui/battle.js:162-168 getActionList / main.js:727-733
    skillNames: {
      strike:   '苍月斩',     // core/data.js:69 / ui/battle.js:162 / main.js:727
      pure:     '净化之矢',   // core/data.js:70 / ui/battle.js:163 / main.js:728
      guard:    '防御',       // core/data.js:71 / ui/battle.js:164
      erosion:  '蚀心之触',   // core/data.js:72 / ui/battle.js:165 / main.js:730
      heal:     '魂愈',       // core/data.js:73 / ui/battle.js:166 / main.js:731
      ultimate: '白月破晓',   // core/data.js:74 / ui/battle.js:168 / main.js:733
    },

    // ===================== 7 结局 =====================
    // 源：ui/dialogue.js:53-61 showEnding（art/title/sub 逐字一致；stats 为空对象省略）
    endings: {
      '永劫': { id: '永劫', art: [{ c: 'var(--accent-hi)', s: '  ═══ 苍月永劫 ═══' }], title: '苍月永劫', sub: '她成为了茧的一部分。力量永恒，自我消散。' },
      '解放': { id: '解放', art: [{ c: 'var(--green)', s: '═ 茧の解放 ╌' }], title: '茧の解放', sub: '契约被斩断，自由回归。但代价是被遗忘。' },
      '残响': { id: '残响', art: [{ c: 'var(--red-hi)', s: '╳ 残响 ╳' }], title: '残响', sub: '以生命为代价，净化了城市。白花在废墟中绽放。' },
      '白月': { id: '白月', art: [{ c: 'var(--accent-hi)', s: '  ☽ 白月 ☾' }], title: '白月', sub: '她接纳了新的自我，与茧共生。月光下，崭新的微笑。' },
      '羽衣': { id: '羽衣', art: [{ c: 'var(--cyan-hi)', s: '  ╰☆ 羽衣 ☆╯' }], title: '羽衣', sub: '他回到了原来的身体，但另一个她永远留在了茧中。有人转身离去，没有回头。' },
      '雪': { id: '雪', art: [{ c: 'var(--red-hi)', s: '  ❄ 雪 ❄' }], title: '雪', sub: '她永远做了绫音，被雪的爱囚禁在完美的牢笼中。镜中的微笑，不知为谁而笑。' },
      'TRUE': { id: 'TRUE', art: [{ c: 'var(--gold)', s: '  ☀ 白月新生 ☀' }], title: '白月 · 新生', sub: '凌与绫音和解，三人找到新的平衡。樱花树下，阳光正好。' },
    },

    // ===================== 关于文本 =====================
    // 源：main.js:334-348 showAbout（15 行，逐字一致；ui/menu.js:213-227 同值）
    aboutText: [
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
    ],

    // ===================== 标题画面文本 =====================
    // 源：main.js bootSequence(228-259) + showTitle(290-295) / ui/menu.js 同值
    titleText: {
      logo: [
        '╔══════════════════════════════════════════════╗',
        '║                                              ║',
        '║     ██╗  ██╗██╗   ██╗███████╗               ║',
        '║     ██║  ██║╚██╗ ██╔╝██╔════╝               ║',
        '║     ███████║ ╚████╔╝ █████╗                 ║',
        '║     ██╔══██║  ╚██╔╝  ██╔══╝                 ║',
        '║     ██║  ██║   ██║   ███████╗               ║',
        '║     ╚═╝  ╚═╝   ╚═╝   ╚══════╝               ║',
        '║                                              ║',
        '║           ███╗   ███╗ ██████╗                 ║',
        '║           ████╗ ████║██╔════╝                 ║',
        '║           ██╔████╔██║██║  ███╗                ║',
        '║           ██║╚██╔╝██║██║   ██║                ║',
        '║           ██║ ╚═╝ ██║╚██████╔╝                ║',
        '║           ╚═╝     ╚═╝ ╚═════╝                 ║',
        '║                                              ║',
        '║             白  月  茧  响                    ║',
        '║              ──── ◆ ────                      ║',
        '║        White Moon · Cocoon                    ║',
        '║                                              ║',
        '╚══════════════════════════════════════════════╝',
      ],
      byline: '> 杭州 · 星历 2026',                    // main.js:253 / ui/menu.js:135（已本地化）
      prompt: '按 Enter 或 点击 开始',                // main.js:259 / ui/menu.js:141
      menu: [
        { key: '1', label: '新的游戏' },              // main.js:291
        { key: '2', label: '继续游戏' },              // main.js:292（源含动态 " (有存档)" 后缀）
        { key: '3', label: '难度：' },                // main.js:293（源含动态难度名后缀）
        { key: '4', label: '关于' },                  // main.js:294
      ],
    },

    // ===================== 地图标题 =====================
    // 源：main.js:982 / ui/map.js:89 「第' + ch + '章 · 杭州」（城市名恒定，章节号动态）
    mapTitles: {
      city: '杭州',
      format: '第{ch}章 · 杭州',
    },

    // ===================== 其他内容常量 =====================
    difficultyNames: { easy: '新手', normal: '普通', hard: '困难' },   // main.js:279 / ui/menu.js（DIFF_NAMES）
    chapterNames: ['序章', '第一章', '第二章', '第三章', '终章'],      // main.js:432 renderStatus ch
  };

  return GameContent;
});
