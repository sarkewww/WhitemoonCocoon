/* =========================================================
 * 白月茧响 - 剧情注册层
 * 场景数据不再写在此文件。
 * 所有剧情在 story/*.story 剧本中，用 tools/build-story.js
 * 编译为 story-data.js，这里负责接收并注册。
 * 运行时动态逻辑（如隐藏结局的条件选项）也在这里维护。
 * ========================================================= */
'use strict';

const Story = (() => {

  const $ = Engine.getState;
  const f = (name) => Engine.flag(name);
  const sf = (name, v) => Engine.setFlag(name, v);
  const sv = (name, v) => Engine.setVar(name, v);
  const gv = (name) => Engine.getVar(name);
  const lv = (name) => Engine.learnSkill(name);
  const tr = (char) => Engine.getTrust(char);
  const at = (char, n) => Engine.addTrust(char, n);
  const an = (n) => Engine.addAnchor(n);
  const ga = () => Engine.getAnchor();

  // ===== 场景库 =====
  const scenes = {};

  function reg(id, scene) { scenes[id] = scene; }
  function get(id) { return scenes[id]; }

  // ===== 从 story-data.js 批量注册 =====
  function loadData(data) {
    if (!data) return 0;
    for (const [id, scene] of Object.entries(data)) {
      reg(id, scene);
    }
    applyDynamicLogic();
    return Object.keys(data).length;
  }

  // ===== 运行时动态逻辑（原 story.js 中的 scenes['x'] 覆写）=====
  function applyDynamicLogic() {
    // chapter2_end：进入异界之门序列（ch2_gate_*，分线在 ch2_gate_4 按信任度选择）
    const orig2_end = scenes['chapter2_end'];
    if (orig2_end) {
      scenes['chapter2_end'] = {
        ...orig2_end,
        onEnter: (s) => { if (orig2_end.onEnter) orig2_end.onEnter(s); },
        get choices() {
          return [{ text: '前往异界——源茧的所在地', next: 'ch2_gate_1', chapter: 3 }];
        },
      };
    }

    // chapter3_8：根据侵蚀度动态注入隐藏结局选项（白月结局）
    const orig3_8 = scenes['chapter3_8'];
    if (orig3_8) {
      scenes['chapter3_8'] = {
        ...orig3_8,
        onEnter: (s) => { if (orig3_8.onEnter) orig3_8.onEnter(s); },
        get choices() {
          const st = Engine.getState();
          const choices = [
            { text: '【苍月永劫】「我接受。成为新的核心。」', next: 'ending_eternity', flag: 'ending_eternity', effect: (s) => { s.endings.push('永劫'); } },
            { text: '【茧の解放】「摧毁源茧——让所有人自由。」', next: 'ending_freedom', flag: 'ending_freedom', effect: (s) => { s.endings.push('解放'); } },
            { text: '【残响】「拒绝一切。我选择离开。」', next: 'ending_reverie', flag: 'ending_reverie', effect: (s) => { s.endings.push('残响'); } },
          ];
          // 隐藏结局：侵蚀度≤50 时出现「白月」
          if (st.ero <= 50) {
            choices.push({
              text: '【白月】「[g]接纳一切——与茧共生。[/g]」',
              next: 'ending_white_moon',
              flag: 'ending_white_moon',
              effect: (s) => { s.endings.push('白月'); },
            });
          }
          // 白线：羽衣信任度 ≥ 60 且自我锚点 ≥ 40（想变回凌的意志；anchor 缺省 50 由 engine 保证，这里用 ?? 避免 anchor=0 误判）
          if ((st.trust?.hagoromo || 0) >= 60 && (st.anchor ?? 50) >= 40) {
            choices.push({
              text: '【羽衣】「变回凌——去见她。」',
              next: 'ending_feather',
              flag: 'ending_feather',
              effect: (s) => { s.endings.push('羽衣'); },
            });
          }
          // 青线：雪信任度 ≥ 60（接受绫音的身份留在她身边）
          if ((st.trust?.yuki || 0) >= 60) {
            choices.push({
              text: '【雪】「永远做绫音——留在她身边。」',
              next: 'ending_snow',
              flag: 'ending_snow',
              effect: (s) => { s.endings.push('雪'); },
            });
          }
          // True End：三线信任度全部达标
          if ((st.trust?.hagoromo || 0) >= 60 && (st.trust?.yuki || 0) >= 60 && (st.trust?.suzu || 0) >= 60) {
            choices.push({
              text: '【True End】「[g]我全都选——那条新路。[/g]」',
              next: 'ending_true',
              flag: 'ending_true',
              effect: (s) => { s.endings.push('TRUE'); },
            });
          }
          return choices;
        },
      };
    }
  }

  // ===== 遍历（供测试/统计） =====
  function all() { return Object.values(scenes); }

  // 暴露 helper，供 story-data.js 反序列化的函数体使用
  return { get, reg, loadData, all, lv, f, sf, sv, gv, $, tr, at, an, ga };
})();

if (typeof window !== 'undefined') window.Story = Story;
