// 战斗系统逻辑测试（模拟 DOM/UI）
const fs = require('fs');
const path = require('path');

// ---- Mock DOM ----
const store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k,v) => { store[k]=String(v); },
  removeItem: k => { delete store[k]; },
};

class MockEl {
  constructor() { this._innerHTML=''; this._children=[]; this.style={}; this.classList={_s:new Set(), add:c=>this.classList._s.add(c), remove:c=>this.classList._s.delete(c)}; }
  set innerHTML(v){ this._innerHTML=v; this._children=[]; }
  get innerHTML(){ return this._innerHTML; }
  appendChild(c){ this._children.push(c); }
  getBoundingClientRect(){ return {left:0,top:0,width:100,height:40}; }
  addEventListener(){}
  remove(){}
  querySelector(){ return null; }
  querySelectorAll(){ return []; }
  scrollTop=0; scrollHeight=0; textContent='';
}
const elCache = {};
function mk(id){ if(!elCache[id]) elCache[id]=new MockEl(); return elCache[id]; }

// ---- 载入 engine ----
const engineCode = fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');
global.Engine = new Function(engineCode+'\nreturn Engine;')();

// ---- Mock App（战斗 UI 层）----
global.App = {
  showBattle(){},
  renderBattleBars(){},
  battleLog(){},
  setEnemySprite(){},
  setCombo(){},
  shakeEnemy(){}, shakePlayer(){}, shakeHard(){}, flashCrit(){}, transformFlash(){}, pulseEro(){},
  updateEnemyBar(){}, updateBattleState(){},
  enemyEl: () => new MockEl(),
  playerEl: () => new MockEl(),
  promptAction: async () => 'strike',   // 自动选攻击
  dieAndRetry(){},
};

// ---- 载入 battle ----
const battleCode = fs.readFileSync(path.join(__dirname,'battle.js'),'utf8');
global.Battle = new Function('window','document', battleCode+'\nreturn Battle;')(global, { getElementById: mk });

const results = [];
function t(name, fn){ try{ fn(); results.push(['PASS',name]); }catch(e){ results.push(['FAIL',name,e.message]); } }

async function run(){
  // 初始化状态
  const s = Engine.newGame();
  Engine.setState(s);

  // 测试1: 简单战斗 - 敌人很弱，应该胜利
  await t('基础战斗胜利', async () => {
    const s2 = Engine.newGame();
    Engine.setState(s2);
    let won = false;
    await Battle.start({
      enemy: { id:'t', name:'测试魔物', hp:50, atk:5, def:0, spd:5, xp:10, sprite:['x'] },
      onWin: async () => { won = true; },
      onLose: async () => {},
    });
    if (!won) throw new Error('未胜利');
  });

  // 测试2: 敌人强到能杀死玩家（但玩家选 strike，敌人造成伤害）
  await t('战斗循环不无限循环', async () => {
    const s3 = Engine.newGame();
    s3.hp = 10; // 残血
    Engine.setState(s3);
    let ended = false;
    await Battle.start({
      enemy: { id:'t2', name:'强敌', hp:500, atk:30, def:0, spd:5, xp:10, sprite:['x'] },
      onWin: async () => { ended='win'; },
      onLose: async () => { ended='lose'; },
    });
    if (!ended) throw new Error('战斗未结束');
  });

  // 测试3: computeDamage 计算
  t('computeDamage 计算', () => {
    const { computeDamage } = Battle;
    const r = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isCrit:false});
    if (r.dmg < 1) throw new Error('伤害过小');
  });

  // 测试4: makeEnemy 默认
  t('makeEnemy 构造', () => {
    const e = Battle.makeEnemy({id:'x', name:'魔', hp:100, atk:5, def:2, spd:3, xp:5});
    if (e.hp !== 100) throw new Error('hp');
    if (e.sprite === undefined) throw new Error('无sprite默认');
  });

  // 测试5: getActionKey
  t('getActionKey', () => {
    if (Battle.getActionKey('strike') !== '苍月斩') throw new Error('key');
  });

  // 测试6: 弱点/相克伤害加成
  t('弱点伤害加成生效', () => {
    const { computeDamage } = Battle;
    const origRandom = Math.random;
    Math.random = () => 0.5;   // 固定随机，便于比较
    try {
      const weak = computeDamage({atk:12, level:1}, {def:4, weak:'pure'}, {mult:1, isCrit:false, skillType:'pure'});
      const normal = computeDamage({atk:12, level:1}, {def:4, weak:'pure'}, {mult:1, isCrit:false, skillType:'strike'});
      const noWeak = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isCrit:false, skillType:'pure'});
      if (!weak.weakHit) throw new Error('命中弱点时应返回 weakHit=true');
      if (normal.weakHit) throw new Error('非克制技能不应 weakHit');
      if (noWeak.weakHit) throw new Error('无 weak 字段的敌人不应 weakHit');
      if (weak.dmg <= normal.dmg) throw new Error('弱点加成未生效: '+weak.dmg+' vs '+normal.dmg);
    } finally {
      Math.random = origRandom;
    }
  });

  // 测试7: makeEnemy(undefined/null/缺字段) 不抛异常，回退默认敌人
  t('makeEnemy 防御 undefined/null', () => {
    const e1 = Battle.makeEnemy(undefined);
    const e2 = Battle.makeEnemy(null);
    const e3 = Battle.makeEnemy({ id:'x', name:'缺hp' });
    for (const e of [e1, e2, e3]) {
      if (!e || typeof e.hp !== 'number' || e.hp <= 0) throw new Error('应返回默认弱怪');
      if (!e.name) throw new Error('默认敌人应有名字');
      if (e.weak !== null && e.weak !== undefined) throw new Error('默认敌人不应有 weak');
    }
  });

  // 测试8: erosion SP 不足被拒
  await t('erosion SP不足被拒', async () => {
    const s = Engine.newGame();
    s.sp = 10; s.ero = 20;
    Engine.setState(s);
    const logs = [];
    const origLog = App.battleLog;
    const origPrompt = App.promptAction;
    let ask = 0;
    App.battleLog = (m) => { logs.push(m); };
    App.promptAction = async () => { ask++; return ask === 1 ? 'erosion' : 'strike'; };
    let won = false;
    try {
      await Battle.start({
        enemy: { id:'e', name:'测试魔物', hp:30, atk:0, def:0, spd:0, xp:1, sprite:['x'] },
        onWin: async () => { won = true; },
        onLose: async () => {},
      });
      if (!won) throw new Error('未胜利');
      // 30HP 需 3 次普攻（每次 ≥12 伤害）：sp 10 + 3*5 = 25；若 erosion 被误放行则 10-25+15=0
      if (s.sp !== 25) throw new Error('erosion 应被拒绝，SP 结果错误: '+s.sp);
      if (!logs.some(m => m.includes('灵力不足'))) throw new Error('未提示灵力不足');
    } finally {
      App.battleLog = origLog;
      App.promptAction = origPrompt;
    }
  });

  // 测试9: 战斗胜利后 money 增加，金额符合公式
  await t('战斗胜利后 money 增加且符合公式', async () => {
    const s = Engine.newGame();
    Engine.setState(s);
    const before = Engine.getMoney();
    await Battle.start({
      enemy: { id:'m9', name:'测试魔物', hp:30, atk:0, def:0, spd:0, xp:20, sprite:['x'] },
      onWin: async () => {},
      onLose: async () => {},
    });
    const after = Engine.getMoney();
    const expected = 10 + Math.floor(20 * 0.8);
    if (after - before !== expected) throw new Error(`money 增量应为 ${expected}，实际 ${after-before}`);
  });

  // 测试10: 不同 xp 敌人掉落不同金额
  await t('不同 xp 敌人掉落不同金额', async () => {
    const s = Engine.newGame();
    Engine.setState(s);
    const run = async (xp) => {
      const before = Engine.getMoney();
      await Battle.start({
        enemy: { id:'m', name:'怪', hp:30, atk:0, def:0, spd:0, xp, sprite:['x'] },
        onWin: async () => {},
        onLose: async () => {},
      });
      return Engine.getMoney() - before;
    };
    const low = await run(20);
    const high = await run(100);
    if (low === high) throw new Error('不同 xp 敌人应掉不同金额');
    if (low !== 10 + Math.floor(20*0.8)) throw new Error(`low 金额 ${low} 不符 ${10+Math.floor(20*0.8)}`);
    if (high !== 10 + Math.floor(100*0.8)) throw new Error(`high 金额 ${high} 不符 ${10+Math.floor(100*0.8)}`);
  });

  // 测试9: 高 critChance 提升暴击率
  t('高 critChance 提升暴击率', () => {
    const s = Engine.getState();
    s.critChance = 0.9;
    const { computeDamage } = Battle;
    const origRandom = Math.random;
    try {
      Math.random = () => 0.5;   // 0.5 < 0.9 → 必暴击
      let crits = 0, total = 200;
      for (let i=0;i<total;i++) {
        const r = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isSkill:false});
        if (r.crit) crits++;
      }
      if (crits !== total) throw new Error('critChance=0.9 时应全部暴击，实际 '+crits+'/'+total);
    } finally {
      Math.random = origRandom;
      s.critChance = 0;
    }
  });

  // 测试10: 默认 critChance=0 保留基础暴击（不破坏旧伤害）
  t('默认 critChance=0 保留基础暴击', () => {
    const s = Engine.getState();
    s.critChance = 0;
    const { computeDamage } = Battle;
    const origRandom = Math.random;
    try {
      Math.random = () => 0.07;   // < 0.08 非技能基础暴击
      const r1 = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isSkill:false});
      if (!r1.crit) throw new Error('critChance=0 时应保留非技能 8% 基础暴击');

      Math.random = () => 0.09;   // > 0.08 且 < 0.12
      const r2 = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isSkill:false});
      if (r2.crit) throw new Error('非技能 0.09 不应暴击（基础 8%）');

      Math.random = () => 0.10;   // < 0.12 技能基础暴击
      const r3 = computeDamage({atk:12, level:1}, {def:4}, {mult:1, isSkill:true});
      if (!r3.crit) throw new Error('技能 0.10 应暴击（基础 12%）');
    } finally {
      Math.random = origRandom;
      s.critChance = 0;
    }
  });

  // 测试11: dmgReduction 减伤生效（unit test on enemyHit）
  t('dmgReduction 减伤生效', () => {
    const { enemyHit } = Battle;
    const noRed = enemyHit(50, 1, 5, false, 0.42, 0);
    const red = enemyHit(50, 1, 5, false, 0.42, 0.5);
    if (!(red < noRed)) throw new Error('dmgReduction 应降低伤害: '+red+' vs '+noRed);
    // 50% 减伤 → 约等于半伤（允许 1 点舍入误差）
    const half = Math.round(noRed * 0.5);
    if (Math.abs(red - half) > 1) throw new Error('50% 减伤离半伤偏差过大: '+red+' vs '+half);
  });

  // 测试12: 默认 dmgReduction=0 不改变伤害
  t('默认 dmgReduction=0 不改变伤害', () => {
    const { enemyHit } = Battle;
    const explicit = enemyHit(50, 1, 5, false, 0.42, 0);
    const omitted = enemyHit(50, 1, 5, false, 0.42);
    if (explicit !== omitted) throw new Error('dmgReduction 默认 0 应不改变伤害: '+explicit+' vs '+omitted);
  });

  // 测试13: guard 时 dmgReduction 叠加
  t('guard + dmgReduction 叠加', () => {
    const { enemyHit } = Battle;
    const guardNoRed = enemyHit(50, 1, 5, true, 0.42, 0);
    const guardRed = enemyHit(50, 1, 5, true, 0.42, 0.5);
    if (!(guardRed < guardNoRed)) throw new Error('guard+dmgReduction 应叠加减伤: '+guardRed+' vs '+guardNoRed);
    // guard 本身已减伤（vs 非 guard）
    const noGuardNoRed = enemyHit(50, 1, 5, false, 0.42, 0);
    if (!(guardNoRed < noGuardNoRed)) throw new Error('guard 自身应减伤: '+guardNoRed+' vs '+noGuardNoRed);
  });

  // 测试14: 集成——敌人回合伤害应用 dmgReduction
  await t('敌人回合伤害应用 dmgReduction', async () => {
    const origRandom = Math.random;
    const origPrompt = App.promptAction;
    const origLog = App.battleLog;
    App.battleLog = () => {};  // 静音日志

    // 简化：直接比较 enemyPhase 内 enemyHit 是否传入了 dmgReduction
    // 通过两场战斗（dmgReduction=0 vs 0.9）对比 damageTaken
    const scripted = () => 'claw';
    const enemyCfg = { id:'it', name:'测试', hp:120, atk:100, def:0, spd:1, xp:1, sprite:['x'], scripted };

    let s1 = Engine.newGame();
    s1.dmgReduction = 0.0;
    Engine.setState(s1);
    s1.hp = 100000; s1.maxHp = 100000;
    Math.random = () => 0.5;
    await Battle.start({ enemy: enemyCfg, onWin: async ()=>{}, onLose: async ()=>{} });
    const dmg0 = s1.damageTaken;

    let s2 = Engine.newGame();
    s2.dmgReduction = 0.9;
    Engine.setState(s2);
    s2.hp = 100000; s2.maxHp = 100000;
    Math.random = () => 0.5;
    await Battle.start({ enemy: enemyCfg, onWin: async ()=>{}, onLose: async ()=>{} });
    const dmg9 = s2.damageTaken;

    try {
      if (dmg0 <= 0) throw new Error('dmgReduction=0 时应受到伤害，实际 '+dmg0);
      if (dmg9 >= dmg0) throw new Error('dmgReduction=0.9 时应大幅减伤: '+dmg9+' vs '+dmg0);
      if (dmg9 > dmg0 * 0.3) throw new Error('dmgReduction=0.9 减伤效果不足（>30% 原伤害）: '+dmg9+' vs '+dmg0);
    } finally {
      Math.random = origRandom;
      App.promptAction = origPrompt;
      App.battleLog = origLog;
    }
  });
  const failed = results.filter(r=>r[0]==='FAIL');
  console.log(failed.length===0 ? '\nALL BATTLE TESTS PASSED' : '\n'+failed.length+' FAILED');
  process.exit(failed.length===0?0:1);
}
run();
