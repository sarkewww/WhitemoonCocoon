/* =========================================================
 * 白月茧响 - 战斗系统（含打击感：粒子/震屏/飘字/音效/连击）
 * ========================================================= */
'use strict';

const Battle = (() => {

  let ctx = null;
  let animId = 0;

  // ===== 道具 / 材料 / 配方 数据表 =====
  const ITEMS = {
    potion:   { name:'魂愈药水', desc:'恢复 35% HP', kind:'heal', heal:0.35 },
    mega_potion: { name:'月光圣水', desc:'恢复 70% HP', kind:'heal', heal:0.70 },
    ether:    { name:'灵力凝露', desc:'恢复 40% SP', kind:'sp', sp:0.40 },
    mega_ether: { name:'白月凝露', desc:'恢复 80% SP', kind:'sp', sp:0.80 },
    sedative: { name:'镇魂药剂', desc:'侵蚀 -12', kind:'ero', ero:-12 },
    tear:     { name:'银泪结晶', desc:'恢复 30% HP + 侵蚀 -8', kind:'combo', heal:0.30, ero:-8 },
    shard:    { name:'苍月碎片', desc:'下回合攻击 +50%', kind:'buff', buff:'atk' },
    memory_amulet: { name:'记忆防护符', desc:'侵蚀 -15', kind:'ero', ero:-15 },
    dream_bandage: { name:'织梦绷带', desc:'恢复 30% SP', kind:'sp', sp:0.30 },
  };
  const MATERIALS = {
    tentacle_frag: { name:'触手残片', desc:'魔物的残骸，隐隐蠕动' },
    dark_crystal:  { name:'暗蚀结晶', desc:'浓缩的侵蚀之力，用于强化武器' },
    essence:       { name:'魂之精华', desc:'契约者力量的沉淀' },
    moon_petal:    { name:'月见花瓣', desc:'在月光下绽放的花瓣，安宁的气息' },
    memory_shard:  { name:'记忆碎片', desc:'封存着某人记忆的碎片，在月光下微微发光' },
    dream_silk:    { name:'织梦丝', desc:'夜之魔物吐出的丝线，缠绕着残留的梦境' },
  };
  const RECIPES = {
    r_potion:  { name:'调和魂愈药水', cost:{ tentacle_frag:2, moon_petal:1 }, out:{ id:'potion', count:1 } },
    r_ether:   { name:'凝练灵力凝露', cost:{ essence:1, moon_petal:2 }, out:{ id:'ether', count:1 } },
    r_sedative:{ name:'炼制镇魂药剂', cost:{ dark_crystal:1, moon_petal:3 }, out:{ id:'sedative', count:1 } },
    r_tear:    { name:'凝成银泪结晶', cost:{ essence:2, moon_petal:2 }, out:{ id:'tear', count:1 } },
    r_mega:    { name:'升华月光圣水', cost:{ potion:2, essence:1, moon_petal:2 }, out:{ id:'mega_potion', count:1 } },
    r_memory_amulet: { name:'结缘记忆防护符', cost:{ memory_shard:2, moon_petal:2 }, out:{ id:'memory_amulet', count:1 } },
    r_dream_bandage: { name:'织造织梦绷带', cost:{ dream_silk:2, essence:1 }, out:{ id:'dream_bandage', count:1 } },
  };

  // ---- 粒子系统 ----
  const FX = {
    canvas: null, c2d: null, particles: [], raf: 0, running: false,
    init() {
      this.canvas = document.getElementById('fx');
      this.c2d = this.canvas.getContext('2d');
      const resize = () => {
        const r = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = r.width; this.canvas.height = r.height;
      };
      resize();
      window.addEventListener('resize', resize);
    },
    spawn(x, y, opts={}) {
      const { color='#ff5f6f', count=16, speed=160, size=3, life=0.6, gravity=300 } = opts;
      for (let i=0;i<count;i++) {
        const a = Math.random()*Math.PI*2;
        const sp = speed*(0.4+Math.random()*0.6);
        this.particles.push({
          x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - speed*0.3,
          life, t: 0, size: size*(0.6+Math.random()*0.8),
          color, gravity,
        });
      }
      if (!this.running) { this.running = true; this.loop(); }
    },
    burstCenter(el, opts) {
      const r = el.getBoundingClientRect();
      const arena = this.canvas.parentElement.getBoundingClientRect();
      this.spawn(r.left+r.width/2-arena.left, r.top+r.height/2-arena.top, opts);
    },
    loop() {
      const c = this.c2d, w = this.canvas.width, h = this.canvas.height;
      c.clearRect(0,0,w,h);
      const dt = 1/60;
      this.particles = this.particles.filter(p => {
        p.t += dt;
        if (p.t >= p.life) return false;
        p.vy += p.gravity*dt;
        p.x += p.vx*dt; p.y += p.vy*dt;
        const alpha = 1 - p.t/p.life;
        c.globalAlpha = alpha;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size*alpha+0.5, 0, Math.PI*2);
        c.fill();
        return true;
      });
      c.globalAlpha = 1;
      if (this.particles.length > 0) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        this.running = false;
        c.clearRect(0,0,w,h);
      }
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.particles=[]; this.running=false; }
  };

  // ---- 音频（WebAudio 合成打击音效）----
  const Sfx = (() => {
    let ac = null;
    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ac = new AC();
      }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(freq, dur, type='square', vol=0.18, slide=0) {
      const a = ensure(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq+slide), a.currentTime+dur);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+dur);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime+dur);
    }
    function noise(dur=0.12, vol=0.25, lp=1200) {
      const a = ensure(); if (!a) return;
      const buf = a.createBuffer(1, a.sampleRate*dur, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1);
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+dur);
      const f = a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp;
      src.connect(f); f.connect(g); g.connect(a.destination); src.start();
    }
    return {
      mute: false,
      ensure,
      playerHit() { tone(200, 0.09, 'triangle', 0.22, -120); noise(0.07,0.12,2500); },
      enemyHit() { tone(120, 0.12, 'square', 0.25, -60); noise(0.1,0.22,800); },
      crit() { tone(90,0.16,'sawtooth',0.3,-40); noise(0.16,0.3,600); tone(700,0.1,'square',0.15); },
      guard() { noise(0.12,0.18,500); tone(180,0.1,'triangle',0.15); },
      skill() { tone(320,0.16,'sawtooth',0.2,200); noise(0.2,0.15,1500); },
      ultimate() { tone(140,0.3,'sawtooth',0.3,-80); noise(0.3,0.25,900); tone(500,0.2,'square',0.15,300); },
      heal() { tone(520,0.14,'sine',0.16); setTimeout(()=>tone(660,0.16,'sine',0.16),90); },
      ero() { tone(60,0.6,'sine',0.25,20); noise(0.5,0.12,300); },
      death() { tone(80,0.9,'sawtooth',0.3,-60); noise(0.8,0.2,300); },
      click() { tone(440,0.04,'square',0.08); },
      win() { tone(523,0.12,'triangle',0.2); setTimeout(()=>tone(659,0.12,'triangle',0.2),120); setTimeout(()=>tone(784,0.25,'triangle',0.22),240); },
      transform() { tone(220,0.3,'sine',0.2,300); setTimeout(()=>tone(440,0.35,'sine',0.2,400),150); setTimeout(()=>noise(0.4,0.2,2000),300); },
    };
  })();

  // ---- 飘字 ----
  function spawnDmg(el, num, cls='dmg') {
    const arena = document.getElementById('arena');
    const r = el.getBoundingClientRect(), ar = arena.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'dmg-num ' + cls;
    d.textContent = num;
    d.style.left = (r.left-ar.left + r.width/2 - 20 + (Math.random()*30-15)) + 'px';
    d.style.top = (r.top-ar.top + 10) + 'px';
    arena.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  // ---- 创建敌人 ----
  function makeEnemy(spec) {
    const dm = Engine.getDifficultyMult ? Engine.getDifficultyMult() : { enemyHp:1, enemyAtk:1, eroMult:1 };
    const hp = Math.round(spec.hp * dm.enemyHp);
    return {
      id: spec.id, name: spec.name, title: spec.title || '触手魔物',
      hp: hp, maxHp: hp,
      atk: Math.round(spec.atk * dm.enemyAtk), def: spec.def, spd: spec.spd,
      xp: spec.xp,
      sprite: spec.sprite || [
        '  ╭───────╮  ',
        '  │  〰〰〰  │  ',
        ' ╱│  ◉  ◉  │╲ ',
        '╱ │ ▼═══▼  │ ╲',
        '  ╰───┬───╯  ',
        '  ╱╱╱  ╲╲╲   ',
        ' 〰〰〰〰〰〰〰  ',
      ],
      skills: spec.skills || [],
      scripted: spec.scripted || null,   // 每回合特殊逻辑
      counter: spec.counter || null,     // 被攻击时触发
      isBoss: !!spec.isBoss,
      weak: spec.weak || null,           // 'pure' 弱点
      eroGain: spec.eroGain || 0,        // 击败后侵蚀增加
    };
  }

  function getActionKey(act) {
    switch(act) {
      case 'strike': return '苍月斩';
      case 'pure': return '净化之矢';
      case 'guard': return '防御';
      case 'erosion': return '蚀心之触';
      case 'heal': return '魂愈';
      case 'ultimate': return '白月破晓';
      default: return act;
    }
  }

  // ---- 伤害计算 ----
  function computeDamage(actor, target, { mult=1, isSkill=false, ignoreDef=false, isCrit=null }={}) {
    let base = actor.atk * mult;
    let crit = isCrit;
    if (crit === null) crit = Math.random() < (isSkill ? 0.12 : 0.08);
    if (!ignoreDef) base = Math.max(1, base - target.def*0.55);
    base *= (0.9 + Math.random()*0.25);
    base += actor.level*0.8;
    if (crit) base *= 1.9;
    return { dmg: Math.max(1, Math.round(base)), crit };
  }

  // ---- 敌人AI ----
  function enemyAction(enemy, pl) {
    if (enemy.scripted) {
      const r = enemy.scripted(enemy, pl);
      if (r) return r;
    }
    const pool = [];
    if (enemy.skills.length === 0) {
      pool.push({ type:'claw', w: 3 });
    } else {
      for (const s of enemy.skills) {
        if (s.type==='claw') pool.push({ type:'claw', w:s.w||3 });
        if (s.type==='tentacle') pool.push({ type:'tentacle', w:s.w||2 });
        if (s.type==='bind') pool.push({ type:'bind', w:s.w||1 });
        if (s.type==='lifesteal') pool.push({ type:'lifesteal', w:s.w||2 });
        if (s.type==='erosionBurst') pool.push({ type:'erosionBurst', w:s.w||1.5 });
      }
    }
    let total = 0; for (const p of pool) total += p.w;
    let r = Math.random()*total;
    for (const p of pool) { r -= p.w; if (r<=0) return p.type; }
    return 'claw';
  }

  // ---- 战斗主循环 ----
  async function start(cfg) {
    // cfg: { enemy, onWin, onLose, context }
    const S = Engine.getState();
    const UI = App;

    animId++;
    const myId = animId;
    let guarding = false;
    let combo = 0;
    let ultimateReady = false;
    let bindTurns = 0;
    let ended = false;
    let buff = false;

    const enemy = makeEnemy(cfg.enemy);

    UI.showBattle();
    UI.renderBattleBars();
    UI.setCombo(0);

    // 渲染 sprite
    UI.setEnemySprite(enemy);

    // 敌人行动描述
    const tacts = {
      claw: ['挥出触手撕裂空气', '触手如鞭抽打而来', '利爪划破夜幕'],
      tentacle: ['无数触手如蛇般缠绕袭来', '触手群将她包围'],
      bind: ['黏稠触须攀上她的四肢', '触手缠紧，试图束缚她的行动'],
      lifesteal: ['触手缠上她的颈项，吮吸她的魂力', '贪婪的触手攫取她的生命'],
      erosionBurst: ['魔物发出尖啸，侵蚀的气息弥漫开来', '暗紫色气息从魔物身上炸裂'],
    };

    const ULT_THRESHOLD = 8;

    async function playerPhase() {
      const action = await UI.promptAction(enemy);
      if (ended || myId !== animId) return;
      guarding = false;

      const pl = {
        atk: S.atk, def: S.def, level: S.level, sp: S.sp, maxSp: S.maxSp, maxHp: S.maxHp,
      };

      if (action === 'guard') {
        guarding = true;
        Sfx.guard();
        UI.battleLog('绫音收紧精神，摆出防御姿态。', 'info');
        await wait(400);
        combo = 0;
        UI.setCombo(0);
      }
      else if (action === 'strike') {
        Sfx.playerHit();
        const r = computeDamage(pl, enemy, { mult: (buff?1.5:1.0) });
        buff = false;
        enemy.hp = Math.max(0, enemy.hp - r.dmg);
        S.damageDealt += r.dmg;
        combo++;
        UI.setCombo(combo);
        S.sp = Engine.clamp(S.sp + 8, 0, S.maxSp);
        UI.shakeEnemy();
        FX.burstCenter(UI.enemyEl(), { color:'#7fd8ff', count:14, speed:200 });
        UI.battleLog(`绫音挥出苍月斩—— 「${r.crit?'会心一击！':'命中'}」 ${r.dmg} 点伤害。`, r.crit?'crit':'player-hit');
        if (r.crit) { Sfx.crit(); UI.flashCrit(); }
        spawnDmg(UI.enemyEl(), r.dmg, r.crit?'crit':'blue');
        UI.updateEnemyBar(enemy);
        if (enemy.counter) { await enemy.counter(enemy, pl, ctx); }
      }
      else if (action === 'pure') {
        if (S.sp < 20) { UI.battleLog('灵力不足，无法释放净化之矢。','info'); Sfx.click(); return playerPhase(); }
        S.sp -= 20;
        Sfx.skill();
        const r = computeDamage(pl, enemy, { mult: 1.7, isSkill:true });
        enemy.hp = Math.max(0, enemy.hp - r.dmg);
        S.damageDealt += r.dmg;
        combo++;
        UI.setCombo(combo);
        S.sp = Engine.clamp(S.sp + 4, 0, S.maxSp);
        UI.shakeEnemy(true);
        FX.burstCenter(UI.enemyEl(), { color:'#c78fff', count:26, speed:260 });
        UI.battleLog(`净化之矢贯穿魔物—— 「${r.crit?'会心！':'命中'}」 ${r.dmg} 点伤害。`, r.crit?'crit':'player-hit');
        if (r.crit) { Sfx.crit(); UI.flashCrit(); }
        spawnDmg(UI.enemyEl(), r.dmg, r.crit?'crit':'purple');
        UI.updateEnemyBar(enemy);
        if (enemy.counter) { await enemy.counter(enemy, pl, ctx); }
      }
      else if (action === 'erosion') {
        if (S.ero >= 100) { UI.battleLog('侵蚀已达临界，无法再调用禁忌之力。','info'); return playerPhase(); }
        Sfx.ero();
        const r = computeDamage(pl, enemy, { mult: 2.6, isSkill:true, ignoreDef:true });
        enemy.hp = Math.max(0, enemy.hp - r.dmg);
        S.damageDealt += r.dmg;
        S.ero = Engine.clamp(S.ero + 8, 0, 100);
        combo += 2;
        UI.setCombo(combo);
        UI.shakeEnemy(true);
        UI.shakeHard();
        FX.burstCenter(UI.enemyEl(), { color:'#ff5f6f', count:34, speed:320, size:4 });
        UI.battleLog(`蚀心之触从她体内涌出—— 魔物被撕裂！ ${r.dmg} 点伤害！ 侵蚀 +8。`, 'big');
        if (r.crit) { Sfx.crit(); UI.flashCrit(); }
        spawnDmg(UI.enemyEl(), r.dmg, 'crit');
        UI.updateEnemyBar(enemy);
        UI.renderBattleBars();
        if (enemy.counter) { await enemy.counter(enemy, pl, ctx); }
      }
      else if (action === 'heal') {
        if (S.sp < 15) { UI.battleLog('灵力不足，无法施展魂愈。','info'); Sfx.click(); return playerPhase(); }
        S.sp -= 15;
        Sfx.heal();
        const heal = Math.round(S.maxHp * 0.28);
        S.hp = Math.min(S.maxHp, S.hp + heal);
        UI.battleLog(`魂愈之光流转全身—— HP 恢复 ${heal}。`, 'heal');
        spawnDmg(UI.playerEl(), '+'+heal, 'heal');
        UI.renderBattleBars();
      }
      else if (action === 'ultimate') {
        if (!ultimateReady) { UI.battleLog('白月之力尚未充能完成。','info'); return playerPhase(); }
        ultimateReady = false;
        Sfx.ultimate();
        UI.transformFlash();
        const r = computeDamage(pl, enemy, { mult: 3.8, isSkill:true, ignoreDef:true, isCrit:true });
        enemy.hp = Math.max(0, enemy.hp - r.dmg);
        S.damageDealt += r.dmg;
        combo += 3;
        UI.setCombo(combo);
        UI.shakeEnemy(true);
        UI.shakeHard();
        FX.burstCenter(UI.enemyEl(), { color:'#ffffff', count:44, speed:360, size:4 });
        FX.burstCenter(UI.enemyEl(), { color:'#8f8fff', count:40, speed:300 });
        UI.battleLog(`「白月破晓——」 月华化为利刃贯穿苍穹！ ${r.dmg} 点毁灭性伤害！`, 'big');
        UI.flashCrit();
        spawnDmg(UI.enemyEl(), r.dmg, 'crit');
        UI.updateEnemyBar(enemy);
      }
      else if (action === 'item') {
        // 使用道具（由 UI 弹出道具菜单选择）
        const itemId = await UI.promptItem();
        if (ended || myId !== animId) return;
        if (!itemId) { UI.battleLog('取消使用。','info'); return playerPhase(); }
        const it = ITEMS[itemId];
        if (!it || !Engine.removeItem(itemId, 1)) { UI.battleLog('没有该道具。','info'); return playerPhase(); }
        if (it.kind === 'heal') {
          const h = Math.round(S.maxHp * it.heal);
          S.hp = Math.min(S.maxHp, S.hp + h);
          Sfx.heal();
          UI.battleLog(`使用了「${it.name}」—— HP 恢复 ${h}。`, 'heal');
          spawnDmg(UI.playerEl(), '+'+h, 'heal');
        } else if (it.kind === 'sp') {
          const sp = Math.round(S.maxSp * it.sp);
          S.sp = Math.min(S.maxSp, S.sp + sp);
          Sfx.heal();
          UI.battleLog(`使用了「${it.name}」—— SP 恢复 ${sp}。`, 'heal');
          spawnDmg(UI.playerEl(), '+'+sp, 'blue');
        } else if (it.kind === 'ero') {
          S.ero = Engine.clamp(S.ero + (it.ero||0), 0, 100);
          Sfx.guard();
          UI.battleLog(`使用了「${it.name}」—— 侵蚀 ${it.ero<0?'-':''}${Math.abs(it.ero||0)}。`, 'sys');
        } else if (it.kind === 'combo') {
          const h = Math.round(S.maxHp * (it.heal||0));
          S.hp = Math.min(S.maxHp, S.hp + h);
          S.ero = Engine.clamp(S.ero + (it.ero||0), 0, 100);
          Sfx.heal();
          UI.battleLog(`使用了「${it.name}」—— HP 恢复 ${h}，侵蚀 ${it.ero<0?'-':''}${Math.abs(it.ero||0)}。`, 'heal');
          spawnDmg(UI.playerEl(), '+'+h, 'heal');
        } else if (it.kind === 'buff') {
          buff = true;
          Sfx.skill();
          UI.battleLog(`使用了「${it.name}」—— 下回合攻击提升！`, 'sys');
        }
        UI.renderBattleBars();
      }

      UI.renderBattleBars();
      UI.updateBattleState();
    }

    async function enemyPhase() {
      const pl = { hp:S.hp, maxHp:S.maxHp, sp:S.sp, maxSp:S.maxSp, atk:S.atk, def:S.def, level:S.level };
      const act = enemyAction(enemy, pl);
      const desc = tacts[act] || '魔物发动攻击';
      UI.battleLog(enemy.name + ' ' + desc, 'info');
      await wait(420);

      let dmg = 0;
      switch(act) {
        case 'claw': {
          dmg = Math.max(1, Math.round(enemy.atk*(0.85+Math.random()*0.4) - (guarding?pl.def*1.6:pl.def*0.6)));
          break;
        }
        case 'tentacle': {
          dmg = Math.max(1, Math.round(enemy.atk*1.15*(0.85+Math.random()*0.3) - (guarding?pl.def*1.8:pl.def*0.7)));
          break;
        }
        case 'bind': {
          dmg = Math.max(1, Math.round(enemy.atk*0.6 - pl.def*0.3));
          bindTurns = (guarding || bindTurns > 0) ? 0 : 1;   // 上限1回合，防连续软锁
          if (bindTurns) UI.battleLog('触手缠住了她的四肢！ 下回合无法行动！', 'erosion');
          break;
        }
        case 'lifesteal': {
          dmg = Math.max(1, Math.round(enemy.atk*0.9 - pl.def*0.5));
          const leech = Math.round(dmg*0.5);
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + leech);
          UI.battleLog(enemy.name+' 汲取了 '+leech+' 点生命。', 'erosion');
          UI.updateEnemyBar(enemy);
          break;
        }
        case 'erosionBurst': {
          dmg = Math.max(1, Math.round(enemy.atk*0.7 - pl.def*0.2));
          S.ero = Engine.clamp(S.ero + 3, 0, 100);
          UI.battleLog('侵蚀的气息渗入身体—— 侵蚀 +3！', 'erosion');
          break;
        }
      }

      if (dmg > 0) {
        S.hp = Math.max(0, S.hp - dmg);
        S.damageTaken += dmg;
        UI.shakePlayer();
        FX.burstCenter(UI.playerEl(), { color:'#ff5f6f', count:18, speed:220 });
        UI.battleLog(`绫音受到了 ${dmg} 点伤害。`, 'hit');
        spawnDmg(UI.playerEl(), '-'+dmg, 'dmg');
        Sfx.enemyHit();
      } else {
        UI.battleLog('绫音格挡住了攻击！', 'sys');
      }

      UI.renderBattleBars();

      // 侵蚀渲染（伤害时）
      if (S.ero >= 60) UI.pulseEro();

      if (S.hp <= 0) {
        await onLose(enemy);
      }
    }

    async function onWin(enemy) {
      if (ended) return;
      ended = true;
      Sfx.win();
      UI.battleLog('—— 魔物在月光下消散了。', 'sys');
      await wait(700);
      const xp = enemy.xp;
      S.xp += xp;
      S.kills++;
      S.ero = Engine.clamp(S.ero + (enemy.eroGain||0) * (Engine.getDifficultyMult ? Engine.getDifficultyMult().eroMult : 1), 0, 100);
      // 掉落材料
      const drops = enemy.drops || (enemy.isBoss
        ? { dark_crystal: 1, essence: 1, tentacle_frag: 1 }
        : { tentacle_frag: 1, moon_petal: 0.5 });
      const dropped = [];
      for (const [m, n] of Object.entries(drops)) {
        const num = Math.floor(n + Math.random());
        if (num > 0) {
          Engine.addMaterial(m, num);
          dropped.push((MATERIALS[m]?.name || m) + ' ×' + num);
        }
      }
      if (dropped.length) UI.battleLog('获得材料：' + dropped.join('、'), 'info');
      let leveled = false;
      while (S.xp >= S.level*40) {
        S.xp -= S.level*40;
        S.level++;
        Engine.addAP(2);           // 升级送属性点
        S.maxHp += 8; S.maxSp += 4; S.atk += 2; S.def += 1; S.spd += 1;
        S.hp = S.maxHp; S.sp = S.maxSp;
        leveled = true;
      }
      if (leveled) UI.battleLog(`升级了！ Lv.${S.level}（属性点 +2）`, 'big');
      UI.battleLog(`获得 ${xp} 经验。`, 'info');
      UI.renderBattleBars();
      await wait(500);
      if (cfg.onWin) await cfg.onWin(enemy);
    }

    async function onLose(enemy) {
      if (ended) return;
      ended = true;
      Sfx.death();
      S.deaths++;
      UI.battleLog('—— 意识坠入深渊……', 'hit');
      await wait(900);
      if (cfg.onLose) await cfg.onLose(enemy);
      else App.dieAndRetry();
    }

    // 供 scripted AI / 特殊技能使用
    ctx = { enemy, getState: ()=>S, getCombo: ()=>combo, setCombo: v=>{combo=v; UI.setCombo(v);}, wait, end:()=>{ended=true;} };

    // ===== 主战斗循环 =====
    UI.battleLog(enemy.title + ' 「' + enemy.name + '」出现了！', 'big');
    await wait(500);

    // 先手判定：若敌 spd > 玩家 spd，敌人先手一击
    const firstStrike = (enemy.spd > S.spd);
    if (firstStrike) {
      await enemyPhase();
      if (ended || myId !== animId) return ctx;
      if (S.hp <= 0) { await onLose(enemy); return ctx; }
      if (enemy.hp <= 0) { await onWin(enemy); return ctx; }
    }

    while (!ended && myId === animId) {
      if (enemy.hp <= 0) { await onWin(enemy); break; }
      if (S.hp <= 0) { await onLose(enemy); break; }

      // 充能积累检查
      if (combo >= ULT_THRESHOLD && !ultimateReady) {
        ultimateReady = true;
        UI.battleLog('白月之力已充盈！ 可释放「白月破晓」！', 'sys');
      }

      // bind 缠缚
      if (bindTurns > 0) {
        bindTurns--;
        UI.battleLog('触手仍缠缚着她，无法行动……', 'hit');
        await wait(500);
        bindTurns = 0;
      } else {
        await playerPhase();
        if (ended || myId !== animId) break;
        if (enemy.hp <= 0) { await onWin(enemy); break; }
        if (S.hp <= 0) { await onLose(enemy); break; }
      }

      // 敌人回合
      await enemyPhase();
      if (ended || myId !== animId) break;
      if (S.hp <= 0) { await onLose(enemy); break; }
    }

    return ctx;
  }

  function wait(ms) { return new Promise(r=>setTimeout(r,ms)); }

  function stop() {
    animId++;
    FX.stop();
  }

  return { start, stop, FX, Sfx, spawnDmg, wait, makeEnemy, computeDamage, getActionKey,
    ITEMS, MATERIALS, RECIPES };
})();

if (typeof window !== 'undefined') window.Battle = Battle;
