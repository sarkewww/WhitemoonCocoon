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

  results.forEach(r=>console.log(r.join(' | ')));
  const failed = results.filter(r=>r[0]==='FAIL');
  console.log(failed.length===0 ? '\nALL BATTLE TESTS PASSED' : '\n'+failed.length+' FAILED');
  process.exit(failed.length===0?0:1);
}
run();
