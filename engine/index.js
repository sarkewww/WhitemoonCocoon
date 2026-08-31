'use strict';

/* =========================================================
 * rpg-html-engine - Node 汇总入口（清单包）
 *
 * 说明：引擎层模块是「全局 script + IIFE」形态，浏览器中用 <script>
 * 按 index.html 顺序加载（暴露 window.*）。以下仅为 Node 侧引用清单，
 * 便于工具脚本 / 测试按名访问已双端导出（module.exports）的模块。
 *
 * 加载行为：
 *  - core/*（world/daycycle/events/data/game）、engine.js、
 *    ui/battle.js、enemies.js、config/game-config.js、story-loader
 *    均为 IIFE + 双端导出，require 可正常工作；
 *  - core/world-data.js、ui/dialogue.js、ui/map.js、ui/menu.js
 *    顶层直接引用 window（无 typeof 守卫），Node 下 require 会抛
 *    ReferenceError，故用 try/catch 捕获，仅保留路径说明；
 *  - 根 battle.js 只暴露 window.Battle、无 module.exports，
 *    require 不报错但导出为空，视为浏览器专用。
 * ========================================================= */

const load = (name, rel) => {
  try {
    return { ok: true, module: require(rel) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

const core = {
  world:      load('world',      '../core/world.js'),
  daycycle:   load('daycycle',   '../core/daycycle.js'),
  events:     load('events',     '../core/events.js'),
  data:       load('data',       '../core/data.js'),
  game:       load('game',       '../core/game.js'),
  'world-data': {
    ok: false,
    error: '浏览器专用：window.WorldData 由 core/world-data.js 以 <script> 加载（Node 无 window）',
  },
};

const ui = {
  dialogue: {
    ok: false,
    error: '浏览器专用：window.DialogueUI 由 ui/dialogue.js 以 <script> 加载（Node 无 window）',
  },
  map: {
    ok: false,
    error: '浏览器专用：window.MapUI 由 ui/map.js 以 <script> 加载（Node 无 window）',
  },
  menu: {
    ok: false,
    error: '浏览器专用：window.MenuUI 由 ui/menu.js 以 <script> 加载（Node 无 window）',
  },
  battle: load('battle-ui', '../ui/battle.js'),
};

const battle = {
  ok: false,
  error: '浏览器专用：window.Battle 由根 battle.js 以 <script> 加载（无 module.exports，Node require 得到空对象）',
};

module.exports = {
  engine: load('engine', '../engine.js'),          // 状态核（可配置：存档/道具/合成/装备/属性/等级）
  core,                                             // core 逻辑层
  ui,                                               // ui 渲染层
  battle,                                           // 战斗系统
  content: {                                        // 白月内容层（换皮时替换）
    enemies: load('enemies', '../enemies.js'),
    gameConfig: load('game-config', '../config/game-config.js'),
    storyData: {
      ok: false,
      error: '浏览器专用：story-data.js 由 tools/build-story.js 编译生成，以 <script> 加载',
    },
  },
  storyLoader: load('story-loader', './story-loader/index.js'), // .story DSL 编译器（独立子包）
};
