const fs = require('fs');
const files = ['prologue', 'chapter1', 'chapter2', 'chapter3'];
const data = {};
for (const f of files) {
  const c = fs.readFileSync('story/' + f + '.story', 'utf8');
  const blocks = c.split(/^label /m);
  for (const b of blocks) {
    const name = b.split('\n')[0].trim();
    if (!name || name.startsWith('#')) continue;
    const body = b.split('\n').slice(1);
    const texts = body.filter(l => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith('transition') || t.startsWith('reentry') || t.startsWith('next:') || t.startsWith('choices:') || t.startsWith('battle:') || t.startsWith('enemy:') || t.startsWith('lose:') || t.startsWith('onEnter:') || t.startsWith('label') || t.startsWith('? ') || /^\d+\./.test(t)) return false;
      return true;
    });
    const chars = texts.join('').replace(/\[[^\]]*\]/g, '').replace(/\s/g, '').length;
    const hasChoices = /^choices:/m.test(body.join('\n'));
    const hasBattle = /^battle:/m.test(body.join('\n'));
    const hasCond = /^\?\s*if/m.test(body.join('\n'));
    data[name] = { chars, choices: hasChoices, battle: hasBattle, cond: hasCond };
  }
}
for (const f of files) {
  console.log('=== ' + f + ' ===');
  const c = fs.readFileSync('story/' + f + '.story', 'utf8');
  const blocks = c.split(/^label /m);
  for (const b of blocks) {
    const name = b.split('\n')[0].trim();
    if (!name || name.startsWith('#')) continue;
    const v = data[name];
    const tags = [];
    if (v.choices) tags.push('C');
    if (v.battle) tags.push('B');
    if (v.cond) tags.push('?');
    console.log('  ' + name + '  [' + v.chars + ']' + (tags.length ? ' <' + tags.join('') + '>' : ''));
  }
}
