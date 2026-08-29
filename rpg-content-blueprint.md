# 白月茧响 · 单元回日常内容蓝图（供并行 task 使用）

> 依据调研：魔圆（日常铺垫→事件→情感冲击）、魔法少女育成计划（伙伴单元回+收集糖果）、
> Blue Reflection（日常→异界打怪→解决烦恼→关系升温）、P5（日夜循环+Confidant+章回体）。

## 共同规则（所有 task 必须遵守）

1. **DSL 语法**（story-loader.js 支持）：
   ```
   label 场景id
     transition              # 转场（可选）
     onEnter: (s) => { ... } # 进入效果，可设 flag/加 trust/加 anchor
     text:
       [n]旁白[/n]
       [sa]雾岛雪[/sa]「对白」     # sa=雪, sb=铃, sc=天城, sd=?, se=羽衣
       ''
     choices:
       1. 选项文本 -> 目标场景 [effect: (s) => {...}] [cond: ...] [flag=xxx]
     battle:
       enemy: 敌人id
       next: 胜利后场景
       lose: 失败后场景
     next: 场景id                # 无选项时自动跳转
   ```
2. **场景 id 命名**：`d1_`（第一章支线）、`d2_`、`d3_`、`dp_`（序章）。语义化，如 `d1_snow_roof`、`d1_suzu_patrol`。**不要与已有 id 重复**。
3. **信任度/锚点 API**（story.js 已暴露）：
   - `s.trust.yuki / suzu / hagoromo`（0-100，直接加减，clamp 由引擎做）
   - `s.anchor`（0-100，凌的意志残留）
   - `s.ero`（侵蚀度）
   - `s.decisions.xxx` 记录选择
   - `s.flags.xxx` 记录 flag
   - 也可用 `onEnter: (s) => { Engine.addTrust('yuki', 5); }`（Engine 已注入）
4. **每个支线单元结构**（500-1200 字）：
   日常铺垫（角色的状态/烦恼）→ 选择（玩家回应，影响 trust/anchor）→ 小事件/战斗 → 回报（trust/材料/经验）+ 埋一个伏笔。
5. **自由行动菜单模式**：章节内插入"今晚做什么"菜单场景，选项指向支线，支线 `next:` 回菜单，玩家选"休息"进主线。
6. **内容边界**：暴力/身体恐怖/强制转变可写；性暗示到临界点切黑；无露骨性行为；心理层面"被改写/自我消融"可写。
7. **不破坏主线**：新增场景插在主线 next 链中间，或从既有 choices 分叉。构建前先 `git stash` 前先确认能 `node tools/build-story.js`。
8. **每章插入点**（看对应 .story 文件确认）：

| 章节 | 插入点 | 新增支线 |
|------|--------|---------|
| prologue | prologue_3 之后（契约前夜） | dp_1 白天日常（雪/凌的日常、伏笔：旧校舍的异样） |
| chapter1 | ch1_7→ch1_8 之间、ch1_9a→ch1_10 之间 | d1_snow_roof（雪天台）、d1_suzu_patrol（铃巡逻打怪）、d1_hagoromo_library（羽衣资料室） |
| chapter2 | ch2_3c→ch2_side1、ch2_5→ch2_6 | d2_snow_obsess（雪病娇日常）、d2_suzu_worsen（铃侵蚀恶化）、d2_prof_research（天城监视） |
| chapter3 | ch3_2→ch3_3、ch3_5→ch3_6 | d3_dream_realm（异界日常探索）、d3_suzu_memory（雨宫雫记忆碎片） |

## 各 task 负责文件（互不冲突）

| Task | 文件 | 内容 |
|------|------|------|
| T1 | story/prologue.story | 序章白天日常支线 + 契约前夜伏笔 |
| T2 | story/chapter1.story | 第一章 3 条线支线（雪/铃/羽衣）+ 夜间菜单 |
| T3 | story/chapter2.story | 第二章 3 条线支线 + 夜间菜单 |
| T4 | story/chapter3.story | 第三章支线 + 结局前置回显 |
| T5 | story/endings.story + story.js | 结局扩充 + 三线 gate 检查 |
| T6 | enemies.js + battle.js | 新敌人（patrol_ghost/patrol_eye/patrol_vine）+ 新材料/配方 |
| T7 | 全库审查 | 构建 + 全部测试 + 引用完整性 |

## 伏笔库（每条支线至少要埋/收一个）

- 雨宫雫（铃的真名）：ch1_8b 埋 → d2_suzu_worsen 深化 → d3_suzu_memory 回收 → True End
- 羽衣被顶替的宿命：ch1_side1 埋 → d1_hagoromo_library 深化 → chapter3 羽衣牺牲 → ending_feather
- 天城教授知道源茧：chapter2_7 登场 → d2_prof_research 伏笔 → chapter3 反转
- 雪的病娇（删照片）：ch2_3c 埋 → d2_snow_obsess 深化 → ending_snow
- 茧不是恶意的存在（像河流）：ch1_side2 埋 → d3_dream_realm 深化 → 白月结局

## 期望效果

每条支线 500-1200 字 × 每章 3-4 条 × 4 章 ≈ 新增 8000-15000 字 + 4-6 场战斗。总流程从 ~90 分钟提升到 2.5-3 小时。
