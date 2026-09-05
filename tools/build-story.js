/* =========================================================
 * 白月茧响 - 剧情构建工具
 * 读取 story/*.story 剧本 + enemies.js 敌人数据，
 * 编译生成 story-data.js（浏览器以 <script> 加载，兼容 file://）。
 *
 * 用法: node tools/build-story.js
 * 生成: story-data.js
 * ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const StoryLoader = require('../story-loader.js');

const ROOT = path.join(__dirname, '..');
const STORY_DIR = path.join(ROOT, 'story');
const ENEMIES_FILE = path.join(ROOT, 'enemies.js');
const OUT_FILE = path.join(ROOT, 'story-data.js');

// 读取 enemies.js（模块导出 ENEMIES）
let enemies = {};
if (fs.existsSync(ENEMIES_FILE)) {
  const mod = new Function('module', 'exports', fs.readFileSync(ENEMIES_FILE, 'utf8'));
  const m = { exports: {} };
  mod(m, m.exports);
  enemies = m.exports.ENEMIES || {};
}

// 读取所有 .story 文件
const files = fs.readdirSync(STORY_DIR).filter(f => f.endsWith('.story')).sort();
const scenes = {};
let warnings = [];
let totalLabels = 0;

for (const f of files) {
  const raw = fs.readFileSync(path.join(STORY_DIR, f), 'utf8');
  const parsed = StoryLoader.parse(raw, enemies);
  for (const [id, scene] of Object.entries(parsed)) {
    if (scenes[id]) warnings.push(`重复场景 id: ${id}（${f} 覆盖）`);
    scenes[id] = scene;
    totalLabels++;
    // 记录来源文件
    scene._src = f;
  }
}

// 校验引用完整性
const allIds = new Set(Object.keys(scenes));
for (const [id, scene] of Object.entries(scenes)) {
  if (scene.next && !allIds.has(scene.next) && !scene.next.startsWith('ending_')) {
    // 允许结尾特殊跳转
  }
  if (scene.choices) {
    for (const ch of scene.choices) {
      if (ch.next && !allIds.has(ch.next) && !ch.next.startsWith('@') && !/^ending_|end_roll|chapter\d_death/.test(ch.next)) {
        warnings.push(`${id} -> 未知选项目标: ${ch.next}`);
      }
    }
  }
  if (scene.battle) {
    if (scene.battle.next && !allIds.has(scene.battle.next) && !scene.battle.next.startsWith('@')) warnings.push(`${id} 战斗胜利-> 未知: ${scene.battle.next}`);
    if (scene.battle.loseScene && !allIds.has(scene.battle.loseScene) && !scene.battle.loseScene.startsWith('@')) warnings.push(`${id} 战斗失败-> 未知: ${scene.battle.loseScene}`);
  }
}

// 生成 JS
const lines = [];
lines.push('/* 由 tools/build-story.js 自动生成。请勿手改！改 story/*.story 后重新构建。 */');
lines.push("'use strict';");
lines.push('');
lines.push('(function(){');
lines.push('  const scenes = {};');
for (const [id, scene] of Object.entries(scenes)) {
  const { _src, ...data } = scene;
  // 序列化：函数用代码字符串存，运行时用 Function 构造
  const clean = JSON.stringify(data, (k, v) => {
    if (typeof v === 'function') return { __fn: v.toString() };
    return v;
  });
  lines.push(`  scenes[${JSON.stringify(id)}] = ${clean};`);
}
lines.push('  // 反序列化函数字段（注入依赖，保证闭包外可访问 Engine/App/Story helpers）');
lines.push('  for (const id in scenes) {');
lines.push('    const s = scenes[id];');
lines.push('    const H = (window.Story && typeof window.Story.lv === "function") ? window.Story : null;');
lines.push('    const __mk = (code) => new Function("Engine","lv","f","sf","sv","gv","$","tr","at","an","ga", "return (" + code + ")")(');
    lines.push('      window.Engine,');
    lines.push('      H ? H.lv : function(){}, H ? H.f : function(){}, H ? H.sf : function(){},');
    lines.push('      H ? H.sv : function(){}, H ? H.gv : function(){}, H ? H.$ : function(){},');
    lines.push('      H ? H.tr : function(){}, H ? H.at : function(){}, H ? H.an : function(){}, H ? H.ga : function(){}');
    lines.push('    );');
lines.push('    if (s.onEnter) s.onEnter = __mk(s.onEnter.__fn);');
lines.push('    if (s.text) for (const t of s.text) {');
lines.push('      if (t && typeof t === "object" && t.cond) t.cond = __mk(t.cond.__fn);');
lines.push('    }');
lines.push('    if (s.choices) for (const c of s.choices) {');
lines.push('      if (c.effect) c.effect = __mk(c.effect.__fn);');
lines.push('      if (c.condition) c.condition = __mk(c.condition.__fn);');
lines.push('    }');
lines.push('    if (s.battle && s.battle.enemy) {');
lines.push('      if (s.battle.enemy.scripted) s.battle.enemy.scripted = __mk(s.battle.enemy.scripted.__fn);');
lines.push('      if (s.battle.enemy.counter) s.battle.enemy.counter = __mk(s.battle.enemy.counter.__fn);');
lines.push('    }');
lines.push('  }');
lines.push('  window.__STORY_DATA__ = scenes;');
lines.push('  if (window.Story && typeof window.Story.loadData === "function") window.Story.loadData(scenes);');
lines.push('})();');

fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(`✔ 构建完成: ${OUT_FILE}`);
console.log(`  场景数: ${totalLabels}`);
console.log(`  剧本文件: ${files.join(', ')}`);
console.log(`  敌人定义: ${Object.keys(enemies).length} 个`);
if (warnings.length) {
  console.log('  ⚠ 警告:');
  for (const w of warnings) console.log('    - ' + w);
} else {
  console.log('  引用校验: 通过');
}
