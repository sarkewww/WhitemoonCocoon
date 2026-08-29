const fs = require('fs');
const c = fs.readFileSync('story.legacy.js', 'utf8');
const lines = c.split('\n');

// 提取关键角色和场景表
const scenes = {};
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  const m = t.match(/^reg\('([^']+)'/);
  if (m) {
    cur = { id: m[1], lines: [], start: i };
    scenes[cur.id] = cur;
    continue;
  }
  if (cur) cur.lines.push(t);
}
// 提取关键角色介绍
const roles = '星野铃 雾岛雪 天城 晓 茧 #1'.split(' ');
for (const [id, sc] of Object.entries(scenes)) {
  for (const t of sc.lines) {
    for (const r of roles) {
      if (t.includes(r)) {
        console.log('[' + r + '] in ' + id + ' @' + (sc.start + 1) + ': ' + t.substring(0, 110));
        break;
      }
    }
  }
}