# 白月茧响 · RPG 框架改造设计（Framework / Gameplay 分离）

> 目标：把当前"视觉小说引擎（Ren'Py 风格）"升级为"剧情驱动 HTML RPG 框架"。
> 原则：**现有 160 场景 / 13 万字剧本 100% 保留复用**，剧本退居为"地点事件"，RPG 循环为主驱动。
> 参考：《Persona 5》《Blue Reflection》日夜循环 + Confidant + 迷宫。

## 一、目标架构（五层）

```
┌ Layer 5 · Entry ──────────────────────────┐
│  index.html / main.js（瘦身：启动+装配）      │
├ Layer 4 · UI（视图）──────────────────────┤
│  dialogue-view · battle-view · map-view · hud │
├ Layer 3 · Story（内容，保留）──────────────┤
│  story.js · story-loader.js · story/*.story │
├ Layer 2 · Runtime（状态机，新）───────────┤
│  core/game.js  PHASES: EXPLORE/DIALOGUE/   │
│                 BATTLE/MENU/ENDING          │
├ Layer 1 · Core（系统，新+已有）───────────┤
│  engine.js(已有) state/数值/道具/合成/好感   │
│  battle.js(已有) 战斗逻辑 + 数据表           │
│  core/world.js(新) 地点/节点图/移动/事件     │
│  core/daycycle.js(新) 日期/日夜/行动点       │
└────────────────────────────────────────────┘
```

## 二、模块职责与依赖

| 模块 | 职责 | 依赖 | DOM? |
|------|------|------|------|
| `engine.js` | 玩家状态、数值、道具/材料/合成、信任/锚点/侵蚀、存档 | — | 否 |
| `battle.js` | 回合制战斗、技能/AI、掉落、配方表、打击感 FX | engine | 否(纯逻辑) |
| `core/world.js` | 各章地图(节点图)、地点、相邻关系、事件表、事件抽取 | engine | 否 |
| `core/daycycle.js` | 天数、白天/夜晚、行动点、章内天数计数器 | engine | 否 |
| `core/game.js` | 状态机、协调 world/story/daycycle、视图回调 | world/daycycle/story/engine | 否 |
| `story.js` / `story-loader.js` | 场景注册、DSL 编译 | engine | 否 |
| `main.js`（改造） | App：注册视图回调给 Game；渲染对话/战斗/地图/菜单 | 全部 | 是 |
| `story/*.story` | 内容：对话、选择、剧情战斗 | — | 否 |

**加载顺序**（index.html 调整）：
`engine.js → enemies.js → story.js → story-data.js → core/world.js → core/daycycle.js → core/game.js → battle.js → main.js`

## 三、核心数据流

### 探索循环（每章）
```
进入章节
  └─ Game.explore(chapter, startLoc)
       └─ World.getMap(chapter) 渲染地图
            └─ 玩家 moveTo(相邻地点)
                 ├─ 触发地点事件（World.rollEvent → scene/enemy）
                 │    ├─ 剧情事件 → Game.runDialogue(scene) → 对话结束回到地图
                 │    └─ 战斗事件 → Game 切 BATTLE → 胜利→next 场景/回地图
                 └─ 无事可做 → 消耗行动点 / 休息推进时段
```
### 日程循环
```
DayCycle.advance(): day(2AP) → night(1AP) → day+1(2AP)
主线：mainReady(chapter, requireDays) 判定 → 触发主线场景
```

## 四、地图/地点数据格式

```js
World.defineMap(2, [
  { id:'school',   name:'神领学院', desc:'白天有学生往来', x:100, y:80,
    conns:['apartment','station'],
    events:[
      { scene:'ch2_side1', when:'day', once:true, cond:(S)=>Engine.flag('xxx') },
      { enemy:'patrol_ghost', next:'ch2_side2', when:'night', once:false },
    ]},
  { id:'apartment', name:'公寓', x:40, y:200, conns:['school','old_building'],
    events:[{ scene:'ch2_side3', when:'night' }]},
]);
```

## 五、现有剧本如何复用（不改 .story）

1. **主线场景**：由 `daycycle.mainReady` 门槛触发，替代硬编码 next 链。
2. **支线场景**：注册为某地点 `events`（`scene` 字段指向现有场景 id）。
3. **战斗场景**：`events` 里 `enemy` 字段直接引现有敌人，胜利后 `next` 指向现有场景。
4. `story.js` / `story-data.js` / `build-story.js` **零改动**。

## 六、分阶段实施

| 阶段 | 内容 | 验收 |
|------|------|------|
| 0 | 架构地基：world/daycycle/game 三个 core 模块 + 设计文档 | `node --check` 通过 |
| 1 | map-view：地图渲染 + 移动交互 + 事件触发 | 手动可在地图走、触发事件 |
| 2 | 日夜循环 + 行动点 + 主线门槛触发 | 白天/夜晚切换、行动点消耗 |
| 3 | 打通战斗→掉落→合成→强化闭环 | 打怪得材料→合成→变强 |
| 4 | 160 场景映射到地点/日程 + 全测试 + push | 三套测试全绿、线上可玩 |

## 七、测试

- `smoke-test.js`（引擎）
- `battle-test.js`（战斗）
- `integration-test.js`（端到端 App 加载）
- 新增：`world-test.js`（地图移动 + 事件触发 + 日程推进）

## 八、内容边界（不变）

- R18G / 身体恐怖 / 病娇 / 心理支配：保留
- 露骨性行为：不写；性暗示临界切黑
