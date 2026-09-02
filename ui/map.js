/* =========================================================
 * 白月茧响 - 地图渲染模块（从 main.js 拆分 / 引擎版副本）
 * 依赖注入：init({ dom: {...}, hooks: {...} })
 *  - dom:   main.js 初始化后的地图 DOM 元素引用
 *  - hooks: main.js 内部函数（maxAPOf/showToast/flashAPBadge/esc/
 *           continueMainline/guardFreePhase/showShopPanel/
 *           showEquipPanel/showDialog/startExplore/registerTap/followBottom）
 * 全局引用 Engine/World/Game/DayCycle（index.html 按序加载）
 *
 * 说明：本文件是"引擎版"副本，main.js 仍使用自身实现；
 *       稍后统一接线时 main.js 才切换到本模块。
 * ========================================================= */
'use strict';

window.MapUI = (() => {

  // 地图拖拽状态（原 main.js App 私有变量 _mapDrag 迁移至此）
  let _mapDrag = null;

  // 注入的 DOM 元素（init 时从 main.js 传入）
  let D = {};
  // 注入的 hook 函数（main.js 内部函数 / 配置）
  let H = {};

  function init(cfg) {
    D = (cfg && cfg.dom) || {};
    H = (cfg && cfg.hooks) || {};
  }

  // ===== 纯函数（无 DOM 依赖，供测试） =====

  function descSummary(desc) {
    const s = String(desc || '').replace(/\[[^\]]*\]/g, '').trim();
    return s.length > 20 ? s.slice(0, 20) + '…' : s;
  }

  // 计算节点包围盒（含 NODE_PAD 宽），返回偏移量与画布尺寸。
  function computeBBox(map, nodePad) {
    const NODE_PAD = (typeof nodePad === 'number') ? nodePad : 120;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    map.forEach(l => {
      if (l.x == null || l.y == null) return;
      if (l.x < minX) minX = l.x;
      if (l.y < minY) minY = l.y;
      if (l.x > maxX) maxX = l.x;
      if (l.y > maxY) maxY = l.y;
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
    return {
      minX, minY, maxX, maxY,
      w: (maxX - minX) + NODE_PAD,
      h: (maxY - minY) + NODE_PAD,
      tx: 'translate(' + (-minX) + 'px, ' + (-minY) + 'px)',
    };
  }

  // 生成去重后的连线 SVG 片段数组。
  function buildEdges(map, locById) {
    const edges = [];
    const drawn = new Set();
    map.forEach(l => {
      (l.conns || []).forEach(cid => {
        const t = locById[cid];
        if (!t || !l.x || !t.x) return;
        const key = [l.id, cid].sort().join(':');
        if (drawn.has(key)) return;
        drawn.add(key);
        edges.push('<line class="map-edge" x1="' + l.x + '" y1="' + l.y + '" x2="' + t.x + '" y2="' + t.y + '"/>');
      });
    });
    return edges;
  }

  // ===== RPG 地图渲染 =====
  function renderMapView(map, curLoc, dayInfo) {
    if (!D.mapEl) return;
    if (D.battleEl) D.battleEl.classList.add('hidden');
    if (D.storyEl) D.storyEl.classList.add('hidden');
    D.mapEl.classList.remove('hidden');

    const S = Engine.getState();
    const ch = S.chapter;
    const phaseName = (dayInfo && dayInfo.phase === 'night') ? '夜晚' : '白天';
    const day = dayInfo ? dayInfo.day : 1;
    const ap = dayInfo ? dayInfo.ap : 0;

    if (D.mapEl) {
      const isNight = (dayInfo && dayInfo.phase === 'night') || S.phase === 'night';
      D.mapEl.classList.toggle('map-night', isNight);
    }

    if (D.mapHead) {
      const apWarn = ap <= 0 ? ' ap-warn' : '';
      // 倒计时徽章（死任务）
      let dlBadge = '';
      if (typeof Quests !== 'undefined' && Quests.getDeadlineStates) {
        const dls = Quests.getDeadlineStates(S);
        const pending = dls.filter(d => !d.done);
        if (pending.length) {
          const minRemain = Math.min.apply(null, pending.map(d => d.remain));
          const urgent = minRemain <= 2 ? ' map-deadline-urgent' : '';
          dlBadge = '<span id="mapDeadlineBadge" class="map-deadline' + urgent + '">⚠ ' + minRemain + '天</span>';
        }
      }
      // 城市名由 GameContent.mapTitles 提供（防御：未加载则回退 '杭州'）
      const mt = (typeof window !== 'undefined' && window.GameContent && window.GameContent.mapTitles) || null;
      const city = (mt && mt.city) || '杭州';
      const mapTitleStr = (mt && mt.format) ? mt.format.split('{ch}').join(ch) : ('第' + ch + '章 · ' + city);
      D.mapHead.innerHTML = '<span class="map-title">' + mapTitleStr + '</span><span class="map-info">第' + day + '天 · ' + phaseName + '</span>' +
        '<span id="mapApBadge" class="map-ap' + apWarn + '">AP ' + ap + '/' + H.maxAPOf() + '</span>' +
        dlBadge;
    }

    const svg = D.mapSvg || (typeof document !== 'undefined' && document.getElementById('mapSvg'));
    const nodesEl = D.mapNodes || (typeof document !== 'undefined' && document.getElementById('mapNodes'));
    if (svg) svg.innerHTML = '';
    if (nodesEl) nodesEl.innerHTML = '';
    if (!nodesEl) return;

    const locById = {};
    map.forEach(l => locById[l.id] = l);

    if (svg) {
      svg.innerHTML = buildEdges(map, locById).join('');
    }

    const reachIds = new Set();
    if (typeof World !== 'undefined' && World.getReachable) {
      World.getReachable(ch, curLoc).forEach(l => reachIds.add(l.id));
    }

    // 计算节点包围盒（含节点自身约 120px 宽），把地图偏移到容器 (0,0)，
    // 配合 overflow 滚动让地图可平移且内容不偏左上角。
    const bbox = computeBBox(map, 120);
    const bboxW = bbox.w, bboxH = bbox.h, bboxTx = bbox.tx;
    if (nodesEl) {
      nodesEl.style.width = bboxW + 'px';
      nodesEl.style.height = bboxH + 'px';
      nodesEl.style.transform = bboxTx;
    }
    if (svg) {
      svg.style.width = bboxW + 'px';
      svg.style.height = bboxH + 'px';
      svg.style.transform = bboxTx;
    }

    map.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'map-node';
      btn.dataset.loc = l.id;
      btn.style.left = l.x + 'px';
      btn.style.top = l.y + 'px';
      btn.innerHTML = H.esc(l.name) + (l.desc ? '<span class="node-tag">' + H.esc(descSummary(l.desc)) + '</span>' : '');

      if (l.id === curLoc) btn.classList.add('cur');
      else if (!reachIds.has(l.id)) {
        btn.classList.add('locked');
        btn.disabled = true;
      }

      if (typeof World !== 'undefined' && World.hasPendingEvent && btn.disabled !== true) {
        const ph = (dayInfo && dayInfo.phase) || S.phase || 'day';
        if (World.hasPendingEvent(ch, l.id, ph, S)) btn.classList.add('evt');
      }

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (l.id === curLoc) {
          onCurrentLocClick(l);
        } else if (typeof Game !== 'undefined' && Game.moveTo) {
          const ok = Game.moveTo(l.id);
          // AP 不足时给出反馈
          if (ok === false) {
            const S2 = Engine.getState();
            if (S2 && typeof S2.ap === 'number' && S2.ap <= 0) {
              H.showToast('行动点已耗尽，休息或等次日再行动', 'warn');
              H.flashAPBadge();
            }
          }
        }
      });
      nodesEl.appendChild(btn);
    });

    // 地图显示后自动滚动视口到"当前地点"附近居中
    if (D.mapCanvas && curLoc && locById[curLoc] && locById[curLoc].x != null) {
      const c = locById[curLoc];
      const px = c.x - bbox.minX;
      const py = c.y - bbox.minY;
      const doScroll = () => {
        if (!D.mapCanvas) return;
        const cw = D.mapCanvas.clientWidth || 0;
        const chh = D.mapCanvas.clientHeight || 0;
        D.mapCanvas.scrollLeft = px - cw / 2;
        D.mapCanvas.scrollTop = py - chh / 2;
      };
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(doScroll);
      } else {
        doScroll();
      }
    }

    renderMapFoot(day, phaseName, ap);
  }

  function onCurrentLocClick(loc) {
    if (typeof World === 'undefined' || typeof Game === 'undefined') return;
    const S = Engine.getState();
    const ev = World.rollEvent(S.chapter, loc.id, S.phase || 'day', S);
    if (ev) {
      // 每日限量检查：先于 AP 消耗给出提示
      if (!ev.once && typeof DayCycle !== 'undefined' && DayCycle.canTriggerEvent) {
        const limit = typeof Game !== 'undefined' && Game.DAILY_EVENT_LIMIT ? Game.DAILY_EVENT_LIMIT : 2;
        const st = DayCycle.canTriggerEvent(S, ev.id || ev.scene || ev.enemy, limit);
        if (!st.ok) {
          H.showToast('今天的行动已耗尽（' + st.count + '/' + st.limit + '）', 'warn');
          return;
        }
      }
      const ok = Game.fireAt(loc.id);
      if (ok === false) {
        const S2 = Engine.getState();
        if (S2 && typeof S2.ap === 'number' && S2.ap <= 0) {
          H.showToast('行动点已耗尽，休息或等次日再行动', 'warn');
          H.flashAPBadge();
        } else {
          H.showToast('现在无法触发事件', 'warn');
        }
      }
    } else {
      H.showDialog('这里没有事可做');
    }
  }

  function renderMapFoot(day, phaseName, ap) {
    if (!D.mapFoot) return;
    D.mapFoot.innerHTML = '';
    const info = document.createElement('div');
    info.id = 'mapInfo';
    info.className = 'map-desc';
    const S = typeof Engine !== 'undefined' && Engine.getState();
    const ch = S && S.chapter;
    // 主线门槛：未解锁时显示还需天数（渐进门槛：每推进一段需多待一天）
    let gateText = '';
    let gateLocked = false;
    let gateNeed = 0;
    if (typeof Game !== 'undefined' && Game.getMainlineGate && S && ch) {
      const st = Game.getMainlineGate(ch);
      if (st && !st.unlocked) {
        gateLocked = true;
        gateNeed = st.need;
        gateText = ' · 主线锁定：还需 ' + st.need + ' 天可推进';
      } else {
        gateText = ' · 主线已可推进';
      }
    } else if (typeof Game !== 'undefined' && Game.isMainlineUnlocked && S && ch) {
      const st = Game.isMainlineUnlocked(ch, 1);
      if (st && !st.unlocked) {
        gateLocked = true;
        gateNeed = st.need;
        gateText = ' · 主线锁定：还需 ' + st.need + ' 天可推进';
      } else {
        gateText = ' · 主线已可推进';
      }
    } else {
      const goalReady = typeof DayCycle !== 'undefined' && DayCycle.mainReady && S && ch &&
        DayCycle.mainReady(S, ch, 1);
      gateText = goalReady ? ' · 主线已可推进' : ' · 休息/探索推进日程以解锁主线';
    }
    info.textContent = '行动点 ' + ap + '/' + H.maxAPOf() + ' · ' + phaseName + ' · 第' + day + '天' + gateText;
    if (gateLocked) info.classList.add('map-gate-locked');
    const actions = document.createElement('div');
    actions.id = 'mapActions';
    actions.className = 'map-actions';
    const restBtn = document.createElement('button');
    restBtn.className = 'map-btn';
    restBtn.textContent = '休息';
    restBtn.addEventListener('click', () => {
      if (typeof Game !== 'undefined' && Game.passTime) Game.passTime();
    });
    const mainBtn = document.createElement('button');
    mainBtn.className = 'map-btn mainline-btn' + (gateLocked ? ' mainline-locked' : '');
    mainBtn.textContent = gateLocked ? '继续主线（还需' + gateNeed + '天）' : '继续主线';
    mainBtn.addEventListener('click', () => H.continueMainline());
    const shopBtn = document.createElement('button');
    shopBtn.className = 'map-btn';
    shopBtn.textContent = '商店';
    shopBtn.addEventListener('click', () => { if (H.guardFreePhase('商店')) H.showShopPanel(); });
    const equipBtn = document.createElement('button');
    equipBtn.className = 'map-btn';
    equipBtn.textContent = '装备';
    equipBtn.addEventListener('click', () => { if (H.guardFreePhase('装备')) H.showEquipPanel(); });
    // 任务面板按钮（hooks.showQuestPanel 由接线层注入；缺省走全局 QuestUI）
    const questBtn = document.createElement('button');
    questBtn.className = 'map-btn quest-btn';
    questBtn.textContent = '任务';
    questBtn.addEventListener('click', () => {
      const open = H.showQuestPanel || (typeof window !== 'undefined' && window.QuestUI && window.QuestUI.showQuestPanel);
      if (open) open();
    });
    actions.appendChild(questBtn);  // 任务置首（更显眼）
    actions.appendChild(restBtn);
    actions.appendChild(mainBtn);
    actions.appendChild(shopBtn);
    actions.appendChild(equipBtn);
    // 车站：区域间唯一交通枢纽 —— 提供"旅行"按钮
    const inStation = typeof Game !== 'undefined' && Game.getCurrentLoc && Game.getCurrentLoc() === 'station';
    if (inStation) {
      const travelBtn = document.createElement('button');
      travelBtn.className = 'map-btn travel-btn';
      travelBtn.textContent = '旅行';
      travelBtn.addEventListener('click', () => showTravelPanel());
      actions.appendChild(travelBtn);
    }
    D.mapFoot.appendChild(info);
    D.mapFoot.appendChild(actions);
  }

  // ===== 地图拖拽平移 =====
  // 鼠标按住拖动 mapCanvas 平移视口；位移 >10px 视为拖拽，
  // 拖拽结束后抑制紧随的 click，避免误触发节点按钮。
  // 触屏由 overflow 原生滚动处理，不拦截、不 preventDefault。
  function initMapDrag() {
    if (!D.mapCanvas) return;
    D.mapCanvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      _mapDrag = {
        id: e.pointerId,
        x: e.clientX, y: e.clientY,
        sl: D.mapCanvas.scrollLeft, st: D.mapCanvas.scrollTop,
        moved: false
      };
      try { D.mapCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      D.mapCanvas.classList.add('dragging');
    });
    D.mapCanvas.addEventListener('pointermove', (e) => {
      if (!_mapDrag || e.pointerId !== _mapDrag.id) return;
      const dx = e.clientX - _mapDrag.x;
      const dy = e.clientY - _mapDrag.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) _mapDrag.moved = true;
      if (_mapDrag.moved) {
        D.mapCanvas.scrollLeft = _mapDrag.sl - dx;
        D.mapCanvas.scrollTop = _mapDrag.st - dy;
      }
    });
    const endDrag = (e) => {
      if (!_mapDrag || e.pointerId !== _mapDrag.id) return;
      const wasDrag = _mapDrag.moved;
      _mapDrag = null;
      D.mapCanvas.classList.remove('dragging');
      if (wasDrag) suppressMapClickOnce();
    };
    D.mapCanvas.addEventListener('pointerup', endDrag);
    D.mapCanvas.addEventListener('pointercancel', endDrag);
  }

  // 拖拽后抑制随后的 click（捕获阶段拦截，阻止其冒泡到节点按钮）
  function suppressMapClickOnce() {
    if (!D.mapCanvas) return;
    const handler = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      D.mapCanvas.removeEventListener('click', handler, true);
    };
    D.mapCanvas.addEventListener('click', handler, true);
    setTimeout(() => { if (D.mapCanvas) D.mapCanvas.removeEventListener('click', handler, true); }, 150);
  }

  // ===== 车站旅行面板 =====
  // 车站是区域间唯一交通枢纽：列出当前章所有可到达区域，选择后消耗行动点传送。
  function showTravelPanel() {
    if (typeof Game === 'undefined' || !Game.getCurrentLoc || !D.mapFoot || !D.mapFoot.parentNode) return;
    const S = (typeof Engine !== 'undefined' && Engine.getState) ? Engine.getState() : null;
    const chapter = (typeof Game !== 'undefined' && Game.getChapter) ? Game.getChapter() : null;
    const curLoc = Game.getCurrentLoc();

    // 区域列表（World.getDistricts 由后续 A3 任务提供，未就绪则兜底取全地图）
    let districts = [];
    if (typeof World !== 'undefined' && World.getDistricts) {
      districts = World.getDistricts(chapter) || [];
    } else if (typeof World !== 'undefined' && World.getMap) {
      districts = World.getMap(chapter) || [];
    }

    // 旅行行动点消耗（COST.travel 由 A3 在 daycycle.js 中定义，缺省 1）
    let apCost = 1;
    if (typeof DayCycle !== 'undefined' && DayCycle.COST && typeof DayCycle.COST.travel === 'number') {
      apCost = DayCycle.COST.travel;
    }
    const apOK = !S || typeof S.ap !== 'number' || S.ap >= apCost;

    // 自定义模态框（沿用 .dialog 遮罩，按钮列表用内联样式，避免改 style.css）
    const overlay = document.createElement('div');
    overlay.id = 'travelPanel';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:60;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--panel);border:1px solid var(--accent);padding:18px 22px;max-width:420px;width:min(88vw,420px);max-height:72vh;overflow-y:auto;color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.6;box-shadow:0 0 30px rgba(143,143,255,.25);';
    let html = '<div style="font-size:15px;color:var(--accent-hi);margin-bottom:10px;">选择目的地</div>';
    html += '<div style="color:var(--fg-dim);font-size:11px;margin-bottom:12px;">当前：车站前 · 旅行消耗行动点 ' + apCost + (apOK ? '' : '（不足）') + '</div>';
    if (!apOK) {
      html += '<div style="color:var(--red-hi);font-size:12px;margin-bottom:10px;">行动点不足</div>';
    }
    if (!districts.length) {
      html += '<div style="color:var(--fg-dim);padding:8px 0;">没有可到达的区域。</div>';
    }
    for (const d of districts) {
      const here = d && d.id === curLoc;
      const disabled = here || !apOK;
      html += '<button class="map-btn travel-district" data-did="' + H.esc(d.id) + '"' +
        (disabled ? ' disabled' : '') +
        ' style="display:block;width:100%;text-align:left;margin:6px 0;' +
        (here ? 'opacity:.4;cursor:default;' : '') +
        '">' +
        '<span style="font-size:13px;">' + H.esc(d.name) + (here ? '（当前）' : '') + '</span>' +
        (d.desc ? '<span class="node-tag" style="display:block;font-size:10px;color:var(--fg-dim);">' + H.esc(descSummary(d.desc)) + '</span>' : '') +
        '</button>';
    }
    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 关闭
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const escBtn = document.createElement('button');
    escBtn.className = 'map-btn';
    escBtn.textContent = '返回';
    escBtn.style.cssText = 'display:block;width:100%;margin-top:10px;';
    escBtn.addEventListener('click', close);
    box.appendChild(escBtn);

    // 区域按钮：选择 → 关闭面板 → 传送
    box.querySelectorAll('.travel-district').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        close();
        const did = btn.dataset.did;
        if (typeof Game !== 'undefined' && Game.travelToDistrict) {
          Game.travelToDistrict(did);
        } else if (typeof Game !== 'undefined' && Game.moveTo) {
          // 兜底：A3 的 travelToDistrict 未就绪时直接移动
          if (typeof DayCycle !== 'undefined' && DayCycle.spend && S) DayCycle.spend(S, 'travel');
          Game.moveTo(did);
        }
      });
    });
  }

  return {
    init,
    renderMapView,
    onCurrentLocClick,
    renderMapFoot,
    initMapDrag,
    suppressMapClickOnce,
    showTravelPanel,
    // 纯函数（无 DOM 依赖，供冒烟测试）
    descSummary,
    computeBBox,
    buildEdges,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.MapUI;
