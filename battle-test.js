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

  results.forEach(r=>console.log(r.join(' | ')));
  const failed = results.filter(r=>r[0]==='FAIL');
  console.log(failed.length===0 ? '\nALL BATTLE TESTS PASSED' : '\n'+failed.length+' FAILED');
  process.exit(failed.length===0?0:1);
}
run();
