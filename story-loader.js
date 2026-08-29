/* =========================================================
 * 白月茧响 - Story 加载器
 * 将 renpy 风格的 .story 剧本编译为场景对象并注册进 Story。
 * DSL 语法：
 *
 *   # 注释
 *   label 场景id          开始一个新场景
 *   transition           标记转场动画
 *   reentry              标记可重复执行的 onEnter
 *   onEnter: (s) => { }  前置效果（JS 代码）
 *   text:                开始文本块（后续行都是剧本文本，'' 为空行）
 *   [n]旁白[/n] 等标记    直接按现有 markup 写
 *   choices:             开始选项块
 *   1. 文本 -> 下一个场景  选项（数字序号可选）
 *   1. 文本 -> 下一场景 [flag=x]
 *   1. 文本 -> 下一场景 [chapter=2]
 *   1. 文本 -> 下一场景 [effect: (s) => {...}]
 *   1. 文本 -> 下一场景 [cond: 表达式]
 *   battle:              开始战斗配置
 *     enemy: spider1     敌人 id（引用 enemies.js）
 *     next: 场景         胜利后场景
 *     lose: 场景         失败后场景（可选）
 *   next: 场景id          无选项时自动跳转
 * ========================================================= */

const StoryLoader = (() => {

  // ---- 简易 tokenizer / 解析器 ----
  // 解析 .story 文本，返回场景对象字典 {id: scene}
  function parse(text, enemies) {
    const lines = text.split(/\r?\n/);
    const scenes = {};
    let cur = null;
    let mode = 'idle'; // idle | text | choices | battle
    let choiceIndex = 0;

    // 检查大括号和圆括号是否平衡
    function isBalanced(s) {
      let d = 0, p = 0;
      for (const ch of s) {
        if (ch === '{') d++;
        if (ch === '}') d--;
        if (ch === '(') p++;
        if (ch === ')') p--;
      }
      return d === 0 && p === 0;
    }

    const flush = () => {
      if (cur) {
        if (cur.text && cur.text.length === 1 && cur.text[0] === '') cur.text = [];
        // 归一化
        if (cur.text) {
          // 去掉末尾多余空行
          while (cur.text.length && cur.text[cur.text.length - 1] === '') cur.text.pop();
        }
        scenes[cur.id] = cur;
        cur = null;
      }
      mode = 'idle';
      choiceIndex = 0;
    };

    const parseChoiceLine = (line) => {
      // 形式: [序号.] 文本 -> 场景 [选项]
      const m = line.match(/^(?:\d+\.\s*)?(.+?)\s*->\s*(\S+)(?:\s*(\[.*\]))?$/);
      if (!m) return null;
      const ch = { text: m[1].trim(), next: m[2] };
      const opts = m[3];
      if (opts) {
        // 解析 [key=val] 或 [flag] 或 [key: 表达式]
        const optRe = /\[([^\]]+)\]/g;
        let mm;
        while ((mm = optRe.exec(opts)) !== null) {
          const body = mm[1].trim();
          const kv = body.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/);
          if (kv) {
            const k = kv[1];
            let v = kv[2].trim();
            if (k === 'flag') ch.flag = v.replace(/^['"]|['"]$/g, '');
            else if (k === 'chapter') ch.chapter = parseInt(v, 10);
            else if (k === 'effect') ch.effect = new Function('s', 'return (' + v + ')(s);');
            else if (k === 'cond') ch.condition = new Function('S', 'return !!(' + v + ');');
          } else {
            // 裸 flag
            if (body.startsWith('flag=')) ch.flag = body.slice(5).replace(/^['"]|['"]$/g, '');
          }
        }
      }
      return ch;
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 空行处理
      if (line === '') {
        if (mode === 'text') cur.text.push('');
        continue;
      }
      // DSL 中的 '' 表示空行
      if (line === "''" || line === '\'\'') {
        if (mode === 'text') cur.text.push('');
        continue;
      }
      // 注释
      if (line.startsWith('#') || line.startsWith('//')) continue;

      // label
      let m = line.match(/^label\s+(\S+)\s*$/);
      if (m) {
        flush();
        cur = { id: m[1], text: [], choices: [] };
        mode = 'text';
        continue;
      }

      if (!cur) continue;

      // 模式切换指令
      if (line === 'text:') { mode = 'text'; continue; }
      if (line === 'choices:' || line === 'menu:') { mode = 'choices'; choiceIndex = 0; continue; }
      if (line === 'battle:') { mode = 'battle'; continue; }

      switch (mode) {
        case 'text': {
          // 支持 :label 内联标记？
          if (line === 'transition') { cur.transition = true; continue; }
          if (line === 'reentry') { cur.reentry = true; continue; }
          let om = line.match(/^onEnter:\s*(.+)$/);
          if (om) {
            // 单行形式：onEnter: (s) => { ... }
            let code = om[1].trim();
            if (!isBalanced(code)) {
              // 多行函数：持续读取直到括号闭合
              for (i = i + 1; i < lines.length; i++) {
                const cont = lines[i].trim();
                code += ' ' + cont;
                if (isBalanced(code)) break;
              }
            }
            cur.onEnter = new Function('s', 'return (' + code + ')(s);');
            continue;
          }
          // 条件文本块：? if <函数>  /  ? else:
          let condM = line.match(/^\?\s*if\s*(.+)$/);
          if (condM) {
            let condCode = condM[1].trim();
            if (!isBalanced(condCode)) {
              for (i = i + 1; i < lines.length; i++) {
                const cont = lines[i].trim();
                condCode += ' ' + cont;
                if (isBalanced(condCode)) break;
              }
            }
            // 读取条件为真时的文本（缩进行）
            const trueText = [];
            for (i = i + 1; i < lines.length; i++) {
              const tline = lines[i];
              const tt = tline.trim();
              if (tt === '' || tt === "''") { i--; break; }
              if (tt === '? else:') break;
              if (/^\?\s*if/.test(tt)) { i--; break; }
              if (tline.startsWith('    ') || tline.startsWith('\t')) {
                trueText.push(tt.replace(/^'|'$/g, ''));
              } else {
                i--; break;
              }
            }
            // 读取 else 文本
            const elseText = [];
            if (i < lines.length && lines[i].trim() === '? else:') {
              for (i = i + 1; i < lines.length; i++) {
                const tline = lines[i];
                const tt = tline.trim();
                if (tt === '' || tt === "''") { i--; break; }
                if (/^\?\s*if/.test(tt)) { i--; break; }
                if (tline.startsWith('    ') || tline.startsWith('\t')) {
                  elseText.push(tt.replace(/^'|'$/g, ''));
                } else {
                  i--; break;
                }
              }
            }
            cur.text.push({
              cond: new Function('S', 'return !!(' + condCode + ')(S);'),
              text: trueText.join('\n'),
              else: elseText.length ? elseText.join('\n') : undefined,
            });
            continue;
          }
          let nm = line.match(/^next:\s*(\S+)\s*$/);
          if (nm) { cur.next = nm[1]; continue; }
          let cm = line.match(/^choices:\s*$/);
          if (cm) { mode = 'choices'; choiceIndex = 0; continue; }
          // 普通文本行
          cur.text.push(line);
          continue;
        }
        case 'choices': {
          let cm2 = line.match(/^text:\s*$/);
          if (cm2) { mode = 'text'; continue; }
          // 忽略过渡性行
          if (/^battle:/.test(line)) { mode = 'battle'; continue; }
          if (/^next:/.test(line)) { const nn = line.match(/^next:\s*(\S+)/); if (nn) cur.next = nn[1]; continue; }
          const ch = parseChoiceLine(line);
          if (ch) { cur.choices.push(ch); choiceIndex++; continue; }
          // 未知行在 choices 里视为错误注释
          continue;
        }
        case 'battle': {
          let em = line.match(/^enemy:\s*(\S+)\s*$/);
          if (em) {
            if (!cur.battle) cur.battle = {};
            cur.battle.enemy = (enemies && enemies[em[1]]) || em[1];
            continue;
          }
          let nm2 = line.match(/^next:\s*(\S+)\s*$/);
          if (nm2) { if (!cur.battle) cur.battle = {}; cur.battle.next = nm2[1]; continue; }
          let lm = line.match(/^lose:\s*(\S+)\s*$/);
          if (lm) { if (!cur.battle) cur.battle = {}; cur.battle.loseScene = lm[1]; continue; }
          if (/^battle:/.test(line)) continue;
          continue;
        }
      }
    }
    flush();
    return scenes;
  }

  return { parse };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StoryLoader;
if (typeof window !== 'undefined') window.StoryLoader = StoryLoader;
