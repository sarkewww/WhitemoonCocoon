const Events = (() => {

  // ===== 事件触发器类型 =====
  const TRIGGERS = {
    ACTION:  'action',  // 按确定键触发（走过去互动）
    TOUCH:   'touch',   // 接触触发（走到旁边自动触发）
    AUTO:    'auto',    // 自动执行（进入地图/时段变化时）
    PARALLEL:'parallel',// 并行执行（每帧检查条件）
  };

  // ===== 事件命令类型 =====
  const CMD = {
    DIALOGUE:'dialogue', // 对话（引用 story 场景）
    BATTLE:  'battle',   // 战斗
    SWITCH:  'switch',   // 开关操作
    VARIABLE:'variable', // 变量操作
    COND:    'cond',     // 条件分支
    MOVE:    'move',     // 移动玩家
    EFFECT:  'effect',   // 执行效果函数
    WAIT:    'wait',     // 等待
    CALL:    'call',     // 调用公共事件
  };

  // ===== 公共事件注册表 =====
  let commonEvents = {};

  // 注册公共事件（可复用的事件序列）
  function registerCommon(id, commands) {
    commonEvents[id] = commands;
  }

  // ===== 事件处理器 =====
  // 处理一个事件命令序列（顺序执行，支持异步）
  async function process(commands, ctx) {
    const S = ctx.getState();
    for (const cmd of commands) {
      switch (cmd.type) {
        case CMD.DIALOGUE:
          if (ctx.runStory) await ctx.runStory(cmd.scene);
          break;
        case CMD.BATTLE:
          if (ctx.runBattle) await ctx.runBattle(cmd.enemy,
            async () => { if (cmd.next && ctx.runStory) await ctx.runStory(cmd.next); },
            async () => { if (cmd.lose && ctx.runStory) await ctx.runStory(cmd.lose); }
          );
          break;
        case CMD.SWITCH:
          if (cmd.flag) S.flags[cmd.flag] = cmd.value !== false;
          break;
        case CMD.VARIABLE:
          if (cmd.var) {
            const v = cmd.value !== undefined ? cmd.value : (S.vars[cmd.var]||0) + (cmd.add||0);
            S.vars[cmd.var] = v;
          }
          break;
        case CMD.EFFECT:
          if (cmd.fn) cmd.fn(S);
          break;
        case CMD.WAIT:
          if (ctx.wait) await ctx.wait(cmd.ms || 500);
          break;
        case CMD.COND:
          if (cmd.cond && cmd.cond(S)) {
            if (cmd.then) await process(cmd.then, ctx);
          } else {
            if (cmd.else) await process(cmd.else, ctx);
          }
          break;
        case CMD.MOVE:
          if (ctx.moveTo && ctx.getLoc) {
            const target = cmd.locId || cmd.district;
            if (cmd.district && ctx.travelToDistrict) await ctx.travelToDistrict(cmd.district);
            else if (ctx.moveTo) await ctx.moveTo(target);
          }
          break;
        case CMD.CALL:
          if (cmd.event && commonEvents[cmd.event]) {
            await process(commonEvents[cmd.event], ctx);
          }
          break;
      }
    }
  }

  // ===== 条件字段名配置（默认白月世界观：affinity→trust, meter1→ero, meter2→anchor）=====
  let config = {
    affinityField: 'trust',   // 亲和度/好感度表字段名（S[affinityField] 为 {key:value}）
    meter1Field: 'ero',       // 第一仪表/侵蚀度字段名（数值，默认 0）
    meter2Field: 'anchor',    // 第二仪表/锚点字段名（数值，默认 50）
  };

  // 外部配置覆盖：Events.configure({ affinityField, meter1Field, meter2Field })
  // 调用后 checkCondition 读取新字段名。返回当前配置快照。
  function configure(opts = {}) {
    if (opts && typeof opts === 'object') {
      if (typeof opts.affinityField === 'string' && opts.affinityField) config.affinityField = opts.affinityField;
      if (typeof opts.meter1Field === 'string' && opts.meter1Field) config.meter1Field = opts.meter1Field;
      if (typeof opts.meter2Field === 'string' && opts.meter2Field) config.meter2Field = opts.meter2Field;
    }
    return Object.assign({}, config);
  }

  // ===== 条件检查 =====
  function checkCondition(cond, S) {
    if (!cond) return true;
    // 支持多种条件类型
    if (cond.flag !== undefined) return !!S.flags[cond.flag];
    if (cond.noFlag !== undefined) return !S.flags[cond.noFlag];
    if (cond.var !== undefined) return (S.vars[cond.var]||0) >= (cond.value || 1);
    // 亲和度（好感度）：cond.affinity（通用名）/ cond.trust（旧名兼容）
    const affinityKey = cond.affinity !== undefined ? cond.affinity : cond.trust;
    if (affinityKey !== undefined) {
      const table = S[config.affinityField];
      const v = table ? table[affinityKey] || 0 : 0;
      return v >= (cond.value || 1);
    }
    // 第一仪表（侵蚀）：cond.meter1（通用名）/ cond.ero（旧名兼容）
    const meter1 = cond.meter1 !== undefined ? cond.meter1 : cond.ero;
    if (meter1 !== undefined) return (S[config.meter1Field] || 0) >= meter1;
    // 第二仪表（锚点）：cond.meter2（通用名）/ cond.anchor（旧名兼容）
    const meter2 = cond.meter2 !== undefined ? cond.meter2 : cond.anchor;
    if (meter2 !== undefined) return (S[config.meter2Field] || 50) >= meter2;
    if (cond.item !== undefined) {
      const inv = S.inventory || [];
      return inv.some(i => i.id === cond.item);
    }
    if (cond.custom) return cond.custom(S);
    return true;
  }

  // ===== 从 World 事件表生成命令序列 =====
  // 将 World 的 events 定义转为 Events 命令序列
  function worldEventToCommands(ev) {
    const cmds = [];
    if (ev.scene) cmds.push({ type: CMD.DIALOGUE, scene: ev.scene });
    if (ev.enemy) cmds.push({ type: CMD.BATTLE, enemy: ev.enemy, next: ev.next, lose: ev.lose });
    return cmds;
  }

  return {
    TRIGGERS, CMD,
    registerCommon, configure, process, checkCondition, worldEventToCommands,
  };
})();
if (typeof window !== 'undefined') window.Events = Events;
if (typeof module !== 'undefined' && module.exports) module.exports = Events;
