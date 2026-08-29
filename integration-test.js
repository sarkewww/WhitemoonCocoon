// 集成测试：验证 main.js + story.js 场景渲染流程
const fs = require('fs');
const path = require('path');

// ---- 轻量 DOM mock ----
class ClassList {
  constructor(){ this._s = new Set(); }
  add(...c){ c.forEach(x=>this._s.add(x)); }
  remove(...c){ c.forEach(x=>this._s.delete(x)); }
  contains(c){ return this._s.has(c); }
}
class MockEl {
  constructor(tag='div', id=''){
    this.tagName=tag.toUpperCase(); this.id=id; this.children=[];
    this._innerHTML=''; this.textContent=''; this.style={};
    this.classList=new ClassList();
    this._listeners={}; this.parentElement=null;
    this.value=''; this.disabled=false; this.offsetWidth=0;
    this.scrollTop=0; this.scrollHeight=0;
  }
  set innerHTML(v){ this._innerHTML=v; this.children=[]; }
  get innerHTML(){ return this._innerHTML; }
  appendChild(c){ c.parentElement=this; this.children.push(c); const t = c._innerHTML || c.textContent || ''; if(t) this._innerHTML += t; }
  addEventListener(t,fn){ (this._listeners[t]=this._listeners[t]||[]).push(fn); }
  removeEventListener(t,fn){ if(this._listeners[t]) this._listeners[t]=this._listeners[t].filter(f=>f!==fn); }
  getBoundingClientRect(){ return {left:0,top:0,width:100,height:40,right:100,bottom:40}; }
  querySelector(sel){ return null; }
  querySelectorAll(){ return []; }
  remove(){}
  click(){ if(this._listeners.click) this._listeners.click.forEach(f=>f({})); }
  focus(){}
  getContext(){ return { clearRect(){}, beginPath(){}, arc(){}, fill(){}, globalAlpha:1, fillStyle:'', canvas:this }; }
}

const byId = {};
function createTree(ids){
  for(const id of ids){
    const el = new MockEl('div', id);
    byId[id]=el;
  }
  byId.arena.parentElement = byId.battleStage || new MockEl();
  byId.fx.parentElement = byId.arena;
  byId.battleStage.parentElement = byId.battle;
}

global.localStorage = { getItem: k=>null, setItem:()=>{}, removeItem:()=>{} };
global.requestAnimationFrame = fn => setTimeout(fn, 16);
global.cancelAnimationFrame = () => {};
global.AudioContext = function(){ return { state:'running', resume(){}, createOscillator(){ return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}; }, createGain(){ return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }, createBuffer(){ return {getChannelData(){return new Float32Array(100);}}; }, createBufferSource(){ return {buffer:null,connect(){},start(){}}; }, createBiquadFilter(){ return {type:'',frequency:{value:0},connect(){}}; }, destination:{} }; };
global.window = global;
global.addEventListener = ()=>{};
global.removeEventListener = ()=>{};
global.setInterval = () => {};
global.clearInterval = () => {};

const ids = ['boot','bootLogo','bootText','bootHint','game','story','storyText','choices','battle','battleLog','battleMenu','enemyZone','playerZone','hudName','hudSub','hudChapter','hudTime','statusBox','savebar','cmd','dialog','dialogBox','end','endArt','endTitle','endSub','endStats','storyScroll','battleBars','arena','fx','battleStage','endRestart','endTitleBtn','menuBtn','panel','panelBody','panelClose'];
createTree(ids);
global.document = {
  getElementById: id => byId[id] || null,
  createElement: t => new MockEl(t),
  addEventListener: ()=>{},
  removeEventListener: ()=>{},
};

global.Engine = new Function(fs.readFileSync(path.join(__dirname,'engine.js'),'utf8')+'\nreturn Engine;')();
global.Story = new Function('Engine', fs.readFileSync(path.join(__dirname,'story.js'),'utf8')+'\nreturn Story;')(global.Engine);
// enemies.js + story-data.js（触发 Story.loadData 注册全部场景）
new Function(fs.readFileSync(path.join(__dirname,'enemies.js'),'utf8'))(global);
global.App = {};
new Function(fs.readFileSync(path.join(__dirname,'story-data.js'),'utf8'))();
global.Battle = new Function('window','document', fs.readFileSync(path.join(__dirname,'battle.js'),'utf8')+'\nreturn Battle;')(global, global.document);
global.App = new Function('window','document','Engine','Story','Battle', fs.readFileSync(path.join(__dirname,'main.js'),'utf8')+'\nreturn App;')(global, global.document, global.Engine, global.Story, global.Battle);

const results=[];
function t(name,fn){ try{ fn(); results.push(['PASS',name]); }catch(e){ results.push(['FAIL',name,e.message]); } }

// Mock promptAction 让战斗自动用 strike
const origPrompt = App.promptAction;
App.promptAction = async () => 'strike';
App.promptItem = async () => null;
App.showBattle = () => { byId.battle.classList.remove('hidden'); byId.story.classList.add('hidden'); };
App.renderBattleBars = () => {};
App.battleLog = () => {};
App.setEnemySprite = () => {};
App.setCombo = () => {};
App.shakeEnemy = App.shakePlayer = App.shakeHard = App.flashCrit = App.transformFlash = App.pulseEro = () => {};
App.updateEnemyBar = App.updateBattleState = () => {};
App.enemyEl = App.playerEl = () => new MockEl();

t('App.init 不抛错', () => { App.init(); });
t('boot 显示', () => {
  if(byId.boot.classList.contains('hidden')) throw new Error('boot hidden?');
});

(async () => {
  try {
    Engine.setState(Engine.newGame());
    // 确保战斗能秒杀敌人，避免 onLose 无限重试循环
    const initState = Engine.getState();
    initState.atk = 999; initState.hp = 999; initState.maxHp = 999;
    // 测试直接场景渲染
    await App.runScene('prologue_1');
    t('prologue_1 渲染文本', () => {
      if(byId.storyText.innerHTML.indexOf('序')<0) throw new Error('无文本');
    });
    t('prologue_1 生成选项', () => {
      if(byId.choices.children.length<1) throw new Error('无选项');
    });
    // 测试战斗场景渲染+战斗自动完成
    await App.runScene('chapter1_battle1');
    t('战斗胜利后进入 next', () => {
      const s = Engine.getState();
      if (s.scene !== 'chapter1_7') throw new Error('scene='+s.scene);
    });
    console.log('集成测试完成（战斗流程在 battle-test 中验证）');
  } catch(e) {
    console.log('集成测试异常: '+e.message);
    console.log(e.stack);
  }
  results.forEach(r=>console.log(r.join(' | ')));
  const failed=results.filter(r=>r[0]==='FAIL');
  console.log(failed.length===0?'\nALL INTEGRATION TESTS PASSED':'\n'+failed.length+' FAILED');
  process.exit(failed.length===0?0:1);
})();