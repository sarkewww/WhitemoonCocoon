/* =========================================================
 * 白月茧响 - 剧情迁移工具
 * 从现有 story.js 提取所有场景，转成 .story DSL 格式。
 * 使用方法: node tools/migrate-story.js
 * 输出: story/*.story（按章节分文件）
 * ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const STORY_DIR = path.join(ROOT, 'story');
// 迁移源：优先取原完整版 story.js（含场景数据）。若当前 story.js 已是精简壳，
// 从 git 恢复（repo 已在 TEMP 克隆）或从 tools 同级的 story.legacy.js 读取。
const STORY_JS = (() => {
  const cur = path.join(ROOT, 'story.js');
  const curCode = fs.readFileSync(cur, 'utf8');
  if (curCode.includes('const scenes = new Proxy') || curCode.includes('loadData')) {
    // 已是精简壳 —— 尝试从 git 历史恢复原始
    const legacy = path.join(ROOT, 'story.legacy.js');
    const legacy2 = path.join(ROOT, 'tools', 'story.legacy.js');
    for (const p of [legacy, legacy2]) {
      if (fs.existsSync(p)) return p;
    }
    throw new Error('当前 story.js 已是精简壳，且未找到 story.legacy.js。请先从 git 恢复原版：git show HEAD:story.js > story.legacy.js');
  }
  return cur;
})();
const OUT = path.join(ROOT, 'story');

// 用 vm 运行 story.js，hook scenes 捕获所有场景（含动态覆写）
const captured = [];
const mockEngine = {
  flag: () => false,
  setFlag: () => {},
  getVar: () => 0,
  setVar: () => {},
  learnSkill: () => {},
  clamp: (v) => v,
  getState: () => ({ flags: {}, vars: {}, skills: [], ero: 0, maxHp: 100 }),
  setG: () => {},
  getG: () => null,
};
const src = fs.readFileSync(STORY_JS, 'utf8');
const wrapped = src.replace(
  'const scenes = {};',
  'const scenes = new Proxy({}, { set(t,p,v) { t[p]=v; captured.push({id:p,scene:v}); return true; } });'
);

const sandbox = {
  captured: captured,
  Engine: mockEngine,
  console: { log: () => {} },
  window: { ENEMIES: {} },
  App: {},
  setTimeout: setTimeout,
};
vm.runInNewContext(wrapped, sandbox, { timeout: 5000 });

// 章节分组
function chapterGroup(id) {
  if (id.startsWith('prologue') || id.startsWith('end_roll')) return 'prologue';
  if (id.startsWith('chapter1')) return 'chapter1';
  if (id.startsWith('chapter2')) return 'chapter2';
  if (id.startsWith('chapter3')) return 'chapter3';
  if (id.startsWith('ending_')) return 'endings';
  if (id === 'end_roll') return 'prologue';
  return 'other';
}

// 判断场景是否为"动态覆写"（含 accessor getter，运行时逻辑，不应进 .story）
function isDynamicOverride(scene) {
  if (!scene || typeof scene !== 'object') return false;
  // 检查是否有 getter 属性（choices getter 等）
  let hasAccessor = false;
  for (const k of Object.keys(scene)) {
    try {
      const d = Object.getOwnPropertyDescriptor(scene, k);
      if (d && d.get) { hasAccessor = true; break; }
    } catch (e) {}
  }
  return hasAccessor;
}

const groups = {};
const dynamicScenes = [];
for (const { id, scene } of captured) {
  if (isDynamicOverride(scene)) {
    dynamicScenes.push(id);
    continue;
  }
  const g = chapterGroup(id);
  if (!groups[g]) groups[g] = [];
  groups[g].push({ id, scene });
}
console.log('跳过动态覆写场景（运行时逻辑）:', dynamicScenes.join(', ') || '无');
// 保持原始顺序
for (const g of Object.keys(groups)) {
  groups[g].sort((a, b) => captured.indexOf(a) - captured.indexOf(b));
}

// 压缩函数为单行并剥离注释（避免 // 吞掉闭合括号）
function fnToCode(fn) {
  let s = fn.toString();
  s = s.replace(/\/\/[^\n\r]*/g, ' ');      // 行注释
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');  // 块注释
  s = s.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return s;
}

// 序列化场景到 DSL
function serializeScene(id, scene) {
  const lines = [];
  lines.push(`label ${id}`);

  // transition / reentry
  if (scene.transition) lines.push('  transition');
  if (scene.reentry) lines.push('  reentry');

  // onEnter
  if (scene.onEnter) {
    const fnStr = fnToCode(scene.onEnter);
    lines.push('  onEnter: ' + fnStr);
  }

  // text
  if (scene.text && scene.text.length > 0) {
    lines.push('  text:');
    for (const t of scene.text) {
      if (typeof t === 'string') {
        if (t === '') lines.push("    ''");
        else lines.push('    ' + t);
      } else if (t && typeof t === 'object') {
        // 条件文本 {cond, text, else}
        const condFn = t.cond ? fnToCode(t.cond) : '';
        const textStr = t.text || '';
        const elseStr = t.else !== undefined ? t.else : '';
        lines.push(`    ? if ${condFn}`);
        lines.push('      ' + textStr);
        if (elseStr) {
          lines.push('    ? else:');
          lines.push('      ' + elseStr);
        }
      }
    }
  }

  // choices
  if (scene.choices && scene.choices.length > 0) {
    lines.push('  choices:');
    for (let i = 0; i < scene.choices.length; i++) {
      const ch = scene.choices[i];
      let line = `    ${i + 1}. ${ch.text} -> ${ch.next}`;
      const opts = [];
      if (ch.flag) opts.push(`flag=${ch.flag}`);
      if (ch.chapter !== undefined) opts.push(`chapter=${ch.chapter}`);
      if (ch.effect) opts.push(`effect: ${fnToCode(ch.effect)}`);
      if (ch.condition) opts.push(`cond: ${fnToCode(ch.condition)}`);
      if (opts.length) line += ' [' + opts.join('] [') + ']';
      lines.push(line);
    }
  }

  // next
  if (scene.next && !scene.choices) {
    lines.push('  next: ' + scene.next);
  }

  // battle
  if (scene.battle) {
    lines.push('  battle:');
    const b = scene.battle;
    // 尝试匹配敌人 id
    let enemyId = 'unknown';
    if (b.enemy) {
      if (typeof b.enemy === 'object') {
        enemyId = b.enemy.id || 'inline';
      } else {
        enemyId = b.enemy;
      }
    }
    lines.push('    enemy: ' + enemyId);
    if (b.next) lines.push('    next: ' + b.next);
    if (b.loseScene) lines.push('    lose: ' + b.loseScene);
  }

  lines.push('');
  return lines.join('\n');
}

// 写入文件
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const chapterNames = {
  prologue: '序章',
  chapter1: '第一章',
  chapter2: '第二章',
  chapter3: '第三章',
  endings: '终章',
};

let totalScenes = 0;
for (const [g, scenes] of Object.entries(groups)) {
  const name = chapterNames[g] || g;
  const header = `# 白月茧响 · ${name} 剧本\n# 由 tools/migrate-story.js 自动生成\n# 修改后请重新构建：node tools/build-story.js\n\n`;
  const body = scenes.map(s => serializeScene(s.id, s.scene)).join('\n');
  const filePath = path.join(OUT, `${g}.story`);
  fs.writeFileSync(filePath, header + body, 'utf8');
  totalScenes += scenes.length;
  console.log(`  ${filePath}: ${scenes.length} 场景`);
}

console.log(`✔ 迁移完成: ${totalScenes} 场景 → ${Object.keys(groups).length} 个 .story 文件`);