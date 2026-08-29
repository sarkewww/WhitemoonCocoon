const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('story').filter(f => f.endsWith('.story')).sort();
const out = [];

for (const f of files) {
  out.push('===== ' + f + ' =====');
  const lines = fs.readFileSync(path.join('story', f), 'utf8').split('\n');
  let cur = null;
  let mode = null;
  const graph = [];
  for (const l of lines) {
    const t = l.trim();
    const m = t.match(/^label (\S+)/);
    if (m) {
      if (cur) graph.push(cur);
      cur = { id: m[1], next: null, choices: [], battle: null, flags: [] };
      mode = 'text';
      continue;
    }
    if (!cur) continue;
    if (t === 'choices:') { mode = 'choices'; continue; }
    if (t === 'battle:') { mode = 'battle'; continue; }
    if (t === 'text:') { mode = 'text'; continue; }
    if (mode === 'text') {
      let nm = t.match(/^next: (\S+)/); if (nm) { cur.next = nm[1]; continue; }
    }
    if (mode === 'choices') {
      let cm = t.match(/^\d+\. .*?-> (\S+)/); if (cm) cur.choices.push(cm[1]);
      let fm = t.match(/flag=(\S+)/); if (fm) cur.flags.push(fm[1]);
    }
    if (mode === 'battle') {
      let em = t.match(/^enemy: (\S+)/); if (em) { if (!cur.battle) cur.battle = {}; cur.battle.enemy = em[1]; }
      let bn = t.match(/^next: (\S+)/); if (bn) { if (!cur.battle) cur.battle = {}; cur.battle.next = bn[1]; }
      let bl = t.match(/^lose: (\S+)/); if (bl) { if (!cur.battle) cur.battle = {}; cur.battle.lose = bl[1]; }
    }
  }
  if (cur) graph.push(cur);

  for (const s of graph) {
    let line = '  ' + s.id;
    if (s.battle) {
      line += ' [战斗:' + (s.battle.enemy || '?');
      if (s.battle.next) line += ' 胜→' + s.battle.next;
      if (s.battle.lose) line += ' 败→' + s.battle.lose;
      line += ']';
    }
    if (s.next) line += ' → ' + s.next;
    if (s.choices.length) line += ' [选:' + s.choices.join(' | ') + ']';
    if (s.flags.length) line += ' {flag:' + s.flags.join(',') + '}';
    out.push(line);
  }
}
fs.writeFileSync('scene-graph.txt', out.join('\n'), 'utf8');
console.log('已生成 scene-graph.txt，' + out.length + ' 行');
