/* =========================================================
 * 白月茧响 - 主线场景配置
 * core/game.js 不再硬编码场景 ID，统一从这里读取 window.GameConfig。
 *
 * 结构：
 *   mainlineStart  { chapter: 起点场景ID }
 *   mainlineSteps  { chapter: [断点场景ID...] }  // 每段推进一步，到达断点后回地图
 *
 * 可在 core/game.js 加载前注入 window.GameConfig（或通过
 * Game.setMainlineConfig(cfg) 运行时注入/替换）。
 * ========================================================= */
'use strict';

const GameConfig = {
  mainlineStart: {
    1: 'chapter1_1',
    2: 'chapter2_1',
    3: 'chapter3_1',
  },
  mainlineSteps: {
    1: ['chapter1_4', 'chapter1_8', 'chapter1_12'],
    2: ['chapter2_4', 'chapter2_8', 'ch2_gate_1'],
    3: ['chapter3_5', 'chapter3_7', 'chapter3_9'],
  },
};

if (typeof window !== 'undefined') window.GameConfig = GameConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
