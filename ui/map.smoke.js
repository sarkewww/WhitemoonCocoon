/* =========================================================
 * 白月茧响 - ui/map.js 冒烟测试（node）
 * 运行：node ui/map.smoke.js
 * 覆盖：
 *  1. window.MapUI 存在
 *  2. 纯函数：descSummary / computeBBox / buildEdges（含真实章节地图数据）
 *  3. init 传假 dom 桩不抛错
 *  4. renderMapView / onCurrentLocClick / renderMapFoot 用假 dom + 桩全局跑通
 * ========================================================= */
'use strict';

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); process.exit(1); }
  passed++;
  console.log('  ✓ ' + msg);
}

// ---- 假 DOM 元素桩 ----
function mkEl() {
  const el = {
    _cls: new Set(),
    style: {},
    dataset: {},
    textContent: '',
    children: [],
    parentNode: null,
    disabled: false,
    clientWidth: 300,
    clientHeight: 300,
    scrollLeft: 0,
    scrollTop: 0,
    offsetWidth: 0,
    classList: {
      add: (...cs) => cs.forEach(c => el._cls.add(c)),
      remove: (...cs) => cs.forEach(c => el._cls.delete(c)),
      contains: (c) => el._cls.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !el._cls.has(c) : !!force;
        if (on) el._cls.add(c); else el._cls.delete(c);
        return on;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
    querySelectorAll() { return []; },
    setPointerCapture() {},
    releasePointerCapture() {},
    contains(t) { return t === el; },
  };
  // 模拟真实 DOM：设置 innerHTML 会清空已渲染子节点
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set: (v) => { _html = String(v); el.children.length = 0; },
  });
  return el;
}

global.window = global;
global.document = {
  createElement: () => mkEl(),
  getElementById: () => null,
  body: mkEl(),
  addEventListener() {},
  removeEventListener() {},
};
global.requestAnimationFrame = (fn) => fn();

const MapUI = require('./map.js');

console.log('== 1. MapUI 导出 ==');
assert(typeof MapUI === 'object', 'window.MapUI 存在');
for (const k of ['init', 'renderMapView', 'onCurrentLocClick', 'renderMapFoot',
  'initMapDrag', 'suppressMapClickOnce', 'showTravelPanel',
  'descSummary', 'computeBBox', 'buildEdges']) {
  assert(typeof MapUI[k] === 'function', '导出方法 ' + k);
}

console.log('== 2. 纯函数 ==');
assert(MapUI.descSummary('  简洁描述  ') === '简洁描述', 'descSummary 去空格');
assert(MapUI.descSummary('[n]主线剧情[\\n]标记[/n]') === '主线剧情标记', 'descSummary 去标签');
assert(MapUI.descSummary('这是一段超过二十个字符的非常非常长的描述文字') === '这是一段超过二十个字符的非常非常长的描述…', 'descSummary 截断');
assert(MapUI.descSummary(null) === '', 'descSummary 容错 null');

const testMap = [
  { id: 'a', name: 'A点', x: 0, y: 0, conns: ['b'] },
  { id: 'b', name: 'B点', x: 100, y: 50, conns: ['a', 'c'] },
  { id: 'c', name: 'C点', x: 50, y: 100, conns: ['b'] },
];
const bb = MapUI.computeBBox(testMap, 120);
assert(bb.minX === 0 && bb.minY === 0 && bb.maxX === 100 && bb.maxY === 100, 'computeBBox 极值');
assert(bb.w === 220 && bb.h === 220, 'computeBBox 尺寸（含 padding 120）');
assert(bb.tx === 'translate(0px, 0px)', 'computeBBox 偏移');
const bbEmpty = MapUI.computeBBox([], 120);
assert(bbEmpty.w === 120 && bbEmpty.h === 120 && bbEmpty.tx === 'translate(0px, 0px)', 'computeBBox 空图容错');

const locById = { a: testMap[0], b: testMap[1], c: testMap[2] };
// 注：buildEdges 与 main.js 一致，跳过 x 为假值（如 0）的节点连线，故用 x>0 的地图测去重
const edgeMap = [
  { id: 'a', x: 1, y: 0, conns: ['b'] },
  { id: 'b', x: 2, y: 1, conns: ['a', 'c'] },
  { id: 'c', x: 3, y: 2, conns: ['b'] },
];
const eLocById = { a: edgeMap[0], b: edgeMap[1], c: edgeMap[2] };
const edges = MapUI.buildEdges(edgeMap, eLocById);
assert(edges.length === 2, 'buildEdges 去重（a-b 与 b-c 各一条）');
assert(edges[0].indexOf('<line class="map-edge"') === 0, 'buildEdges 输出 SVG line');

// ---- 真实章节地图数据遍历（需先加载 world-data.js 再加载 world.js） ----
require('../core/world-data.js');
const World = require('../core/world.js');
for (let ch = 1; ch <= 3; ch++) {
  const realMap = World.getMap(ch);
  assert(Array.isArray(realMap) && realMap.length >= 4, '第' + ch + '章真实地图 ' + realMap.length + ' 个地点');
  const rbb = MapUI.computeBBox(realMap, 120);
  assert(rbb.w >= 0 && rbb.h >= 0 && isFinite(rbb.w), '第' + ch + '章 computeBBox 有效');
  const redges = MapUI.buildEdges(realMap, Object.fromEntries(realMap.map(l => [l.id, l])));
  assert(redges.length > 0, '第' + ch + '章 buildEdges 有连线（' + redges.length + ' 条）');
}

console.log('== 3. init 假 dom 桩 ==');
const toasts = [];
const dialogs = [];
const dom = {
  mapEl: mkEl(), mapHead: mkEl(), mapCanvas: mkEl(), mapNodes: mkEl(),
  mapSvg: mkEl(), mapFoot: mkEl(), battleEl: mkEl(), storyEl: mkEl(),
};
const hooks = {
  maxAPOf: () => 2,
  showToast: (m, t) => toasts.push([m, t]),
  flashAPBadge: () => {},
  esc: (s) => String(s),
  continueMainline: () => {},
  guardFreePhase: () => true,
  showShopPanel: () => {},
  showEquipPanel: () => {},
  showDialog: (m) => dialogs.push(m),
};
MapUI.init({ dom, hooks }); // 不抛错
assert(true, 'init 传假 dom 桩不抛错');

console.log('== 4. renderMapView / onCurrentLocClick / renderMapFoot ==');
global.Engine = { getState: () => ({ chapter: 1, phase: 'day', ap: 2 }) };
global.World = Object.assign({}, World, { getReachable: () => [], hasPendingEvent: () => false, rollEvent: () => null });
global.Game = { moveTo: () => true, getCurrentLoc: () => 'station', getChapter: () => 1, getMainlineGate: () => ({ unlocked: true }) };
global.DayCycle = { maxAP: () => 2, mainReady: () => true };

MapUI.renderMapView(testMap, 'a', { day: 1, phase: 'day', ap: 2 });
assert(dom.mapNodes.children.length === 3, 'renderMapView 生成 3 个节点按钮');
assert(dom.mapNodes.children[1].classList.contains('locked') && dom.mapNodes.children[1].disabled, 'renderMapView 非当前节点加锁');
assert(dom.mapSvg.innerHTML.indexOf('map-edge') !== -1, 'renderMapView 渲染连线');
assert(dom.mapHead.innerHTML.indexOf('AP 2/2') !== -1, 'renderMapView 渲染 AP 徽章');
assert(dom.mapCanvas.scrollLeft === -150, 'renderMapView 自动滚动居中');
assert(dom.mapFoot.children.length === 2, 'renderMapFoot 渲染 info + actions');

MapUI.onCurrentLocClick({ id: 'a' });
assert(dialogs.length === 1 && dialogs[0] === '这里没有事可做', 'onCurrentLocClick 无事件时提示');

MapUI.renderMapFoot(1, '白天', 2);
assert(dom.mapFoot.children.length === 2, 'renderMapFoot 独立调用');

MapUI.initMapDrag();
assert(true, 'initMapDrag 挂载不抛错');

console.log('\n全部通过：' + passed + ' 项断言');
