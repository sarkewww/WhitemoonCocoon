# rpg-html-engine

「白月茧响」（White Moon Cocoon）引擎层的可复用打包清单。把 HTML RPG 的通用逻辑从白月内容中剥离出来，整理成一个清晰的包结构，便于其他项目直接引用或换皮。

> 这是一个**清单包**：当前各模块仍以「全局 script」方式在浏览器运行（通过 `window.*` 暴露），不是 ES Module。`package.json` / `index.js` 只负责汇总路径、说明组成、提供 Node 侧引用入口，并不改变模块本身的加载方式。

## 目录结构

```
engine/
├── README.md          本文件：引擎组成与使用说明
├── package.json       清单包元信息（files / exports 映射）
├── index.js           Node 汇总入口（require 引擎各模块）
└── story-loader/      独立子包：.story DSL 编译器（可单独 npm 分发）
```

引擎层由四部分组成（均位于仓库内，本包为它们的索引）：

| 层 | 文件 | 浏览器全局 | 作用 |
|----|------|-----------|------|
| **状态核** | `engine.js` | `window.Engine` | 可配置核心：存档 / 道具 / 合成 / 装备 / 货币 / 属性 / 等级，以及主题量（trust 羁绊 / ero 侵蚀 / anchor 锚点，由 CONFIG 注入） |
| **core 逻辑层** | `core/world.js` | `window.World` | 世界层：地点定义 + 节点图 + 移动 + 事件触发（纯数据/逻辑，不碰 DOM） |
| | `core/daycycle.js` | `window.DayCycle` | 昼夜 / 行动点（AP）系统 |
| | `core/events.js` | `window.Events` | 事件系统：TRIGGERS / 条件判断 / 世界事件转指令 |
| | `core/data.js` | `window.Data` | 数据表：道具 / 材料 / 装备 / 配方 / 技能 / 敌人 |
| | `core/game.js` | `window.Game` | 游戏主逻辑：章节阶段 / 探索移动 / 主线推进 / 场景调度 |
| **battle 战斗** | `battle.js` | `window.Battle` | 战斗系统（含粒子 / 震屏 / 飘字 / 音效 / 连击打击感） |
| **ui 渲染层** | `ui/dialogue.js` | `window.DialogueUI` | 对话 / 选项 UI |
| | `ui/map.js` | `window.MapUI` | 地图节点 UI |
| | `ui/menu.js` | `window.MenuUI` | 菜单 / 状态 / 存档 UI |
| | `ui/battle.js` | `window.BattleUI` | 战斗界面 UI |
| **story-loader DSL** | `engine/story-loader/` | `window.StoryLoader` | Ren'Py 风格 `.story` 剧本编译器 → 场景对象字典 |

另有 `main.js` 为「白月」专属的应用装配层（把以上各模块粘起来），不属于通用引擎。

## 在新项目中使用

浏览器以 `<script>` 顺序加载（参考 `index.html` 的加载顺序）：

```html
<!-- 1. 状态核（可配置） -->
<script src="engine.js"></script>
<!-- 2. 内容层（换皮时替换，见下） -->
<script src="enemies.js"></script>
<script src="story.js"></script>
<script src="story-data.js"></script>
<script src="config/game-config.js"></script>
<script src="core/world-data.js"></script>
<!-- 3. core 逻辑层（依赖 world-data 的地图数据） -->
<script src="core/world.js"></script>
<script src="core/daycycle.js"></script>
<script src="core/game.js"></script>
<script src="core/data.js"></script>
<script src="core/events.js"></script>
<!-- 4. 战斗 + UI 渲染层 -->
<script src="battle.js"></script>
<script src="ui/dialogue.js"></script>
<!-- 5. 应用装配（自己写，替换 main.js） -->
<script src="main.js"></script>
```

加载顺序要点：**状态核 → 内容数据 → core 逻辑 → 战斗/UI → 你的装配代码**。core 层之间 `world.js` 依赖 `world-data.js` 的地图数据、`game.js` 依赖 `world`/`daycycle`，`battle.js` 读取 `window.Data` 的配方表，故顺序不可颠倒。

Node / 测试环境可直接 `require` 引擎层（`core/*`、`engine.js` 均做了 `typeof window !== 'undefined'` 守卫并 `module.exports` 导出，详见 `index.js` 的 `loadErrors`）。

## 换皮：替换内容层即可

引擎与内容解耦。做新项目时，保持引擎层（engine.js / core/ / battle.js / ui/ / story-loader/）不动，只替换以下「白月内容」：

| 内容层文件 | 作用 | 换皮方式 |
|-----------|------|---------|
| `story/*.story` | 剧本（DSL 文本，由 story-loader 编译） | 重写剧本文本 |
| `story-data.js` | story-loader 编译产物（场景对象） | 重新编译 `.story` 生成 |
| `enemies.js` | 敌人数据（`window.ENEMIES`） | 替换敌人表 |
| `core/world-data.js` | 地图节点数据（`window.WorldData`） | 替换地图 / 区域元数据 |
| `config/game-config.js` | 引擎配置（`window.GameConfig`，注入 trust/ero/anchor 主题量） | 改主题量与默认值 |
| `style.css` / 图标 / `manifest.webmanifest` | 皮肤与元信息 | 替换视觉 |
| `main.js` | 白月专属装配 | 用你自己的装配代码替换 |

主题量由 `Engine.configure()` + `GameConfig` 注入，默认 CONFIG 复刻白月行为；不带主题量的项目可直接用核心的存档 / 道具 / 战斗等通用能力。

## 校验

```sh
node --check engine/index.js
node -e "require('./engine/index.js')"
node engine/story-loader/test.js
```
