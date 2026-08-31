# story-loader

Ren'Py 风格 `.story` DSL 编译器，纯逻辑、零依赖，可同时在 **Node.js** 与**浏览器**（`window.StoryLoader`）运行。

对标 Ink / Ren'Py 的轻量叙事 DSL，将剧本文本编译为「场景对象字典」`{id: scene}`。

## 安装 / 引入

```js
// Node.js
const StoryLoader = require('story-loader');
// 或直接用相对路径
const StoryLoader = require('./index.js');
```

浏览器以 `<script>` 引入后通过 `window.StoryLoader.parse(text, enemies)` 调用。

## 用法

```js
const scenes = StoryLoader.parse(`
label start
text: 她抬起头，月光落在脸上。

choices:
1. 询问她的名字 -> scene_name
2. 沉默 -> scene_silence [flag=silent]

label scene_name
next: start
`, enemiesMap);

// scenes 形如：
// { start: { id:'start', text:[...], choices:[...] }, ... }
```

- `text`：.story 原文
- `enemies`（可选）：敌人字典，`battle: enemy:` 引用的 id 会解析为对应对象

## DSL 语法

```
# 注释

label 场景id            开始一个新场景
transition             标记转场动画
reentry                标记可重复执行的 onEnter
onEnter: (s) => { }    前置效果（JS 代码，可多行至括号闭合）
text:                  开始文本块（后续行都是剧本文本，'' 为空行）
choices: (或 menu:)    开始选项块
  1. 文本 -> 下一个场景          选项（数字序号可选）
  1. 文本 -> 下一场景 [flag=x]
  1. 文本 -> 下一场景 [chapter=2]
  1. 文本 -> 下一场景 [effect: (s) => {...}]
  1. 文本 -> 下一场景 [cond: 表达式]
? if (S) => {...}      条件文本块（缩进行为真文本），支持 ? else:
battle:                开始战斗配置
  enemy: spider1       敌人 id（引用 enemies 参数）
  next: 场景            胜利后场景
  lose: 场景            失败后场景（可选）
next: 场景id            无选项时自动跳转
```

文本内容可直接使用游戏已有的 markup（如 `[n]旁白[/n]`）。

## 输出场景结构

```js
{
  id: 'label名',
  text: ['行1', '行2', ...],          // 或条件文本对象 {cond, text, else}
  choices: [{ text, next, flag?, chapter?, effect?, condition? }],
  next: '场景id',                      // 可选
  transition: true,                    // 可选
  reentry: true,                       // 可选
  battle: { enemy, next, loseScene? }, // 可选
  onEnter: fn                          // 可选
}
```

## 测试

```sh
node test.js
```

## 与上游同步

本包是 `story-loader.js` 的独立分发。上游文件变更后，用如下方式同步：

```sh
cp ../story-loader.js index.js
```
