/* =========================================================
 * 白月茧响 - 任务配置
 * 主线/支线/每日活动/死任务定义，与 game-config.js 的 mainlineSteps
 * 及 world-data.js / story 的 flag 对应。
 *
 * 结构：
 *   quests    { chapter: [quest...] }
 *     type: mainline | side
 *   dailies   [daily...]     每日活动（由 DayCycle.eventCount 计次）
 *   deadlines [deadline...]  死任务（由 S.deadlines 记录激活日）
 *
 * 可在 core/quests.js 加载前注入 window.QuestConfig。
 * ========================================================= */
'use strict';

const QuestConfig = {

  // ---- 主线 + 支线任务 ----
  quests: {
    1: [
      // 主线
      {
        id: 'ml1', type: 'mainline', name: '主线·第一幕',
        desc: '在杭州探索，推进主线以解锁更多区域与剧情。',
        progress: { steps: ['chapter1_4', 'chapter1_8', 'chapter1_12'] },
      },
      // 支线
      {
        id: 'd1_snow', type: 'side', name: '天台的保温盒',
        desc: '天台上，雪递来一个保温盒。',
        loc: 'school', when: 'day',
        complete: { flag: 'd1_snow_done' },
      },
      {
        id: 'd1_suzu', type: 'side', name: '空蝉旧舍的巡逻',
        desc: '和铃一起的夜间巡逻，空蝉旧舍的影子里有怨念潜伏。',
        loc: 'old_building', when: 'night',
        complete: { flag: 'd1_suzu_done' },
      },
      {
        id: 'd1_hagoromo', type: 'side', name: '资料室的旧档案',
        desc: '资料室里，羽衣翻着旧档案，说出那句让你浑身发冷的话。',
        loc: 'school', when: 'day',
        complete: { flag: 'd1_hagoromo_done' },
      },
      {
        id: 'm1_girl', type: 'side', name: '地雷系少女消失事件',
        desc: '空蝉旧舍方向飘来被雨水泡过的、腐烂的茧的气味。',
        loc: 'old_building', when: 'night',
        complete: { flag: 'm1_girl_trigger' },
      },
    ],
    2: [
      {
        id: 'ml2', type: 'mainline', name: '主线·第二幕',
        desc: '蚀之茧的谜团逐渐浮现，深入探索杭州的黑暗面。',
        progress: { steps: ['chapter2_4', 'chapter2_8', 'ch2_gate_1'] },
      },
      {
        id: 'd2_snow', type: 'side', name: '雪的相册',
        desc: '按响雪家的门铃，相册里没有一张凌的照片。',
        loc: 'snow_apt', when: 'night',
        complete: { flag: 'd2_snow_done' },
      },
      {
        id: 'd2_suzu', type: 'side', name: '遗忘的名字',
        desc: '安全屋里，铃一遍一遍写着「雨宫雫」。',
        loc: 'abandoned_apt', when: 'night',
        complete: { flag: 'd2_suzu_done' },
      },
      {
        id: 'd2_hagoromo', type: 'side', name: '天城教授的研究',
        desc: '空蝉旧舍资料室里，羽衣翻着一份非公开档案。',
        loc: 'old_building', when: 'night',
        complete: { flag: 'd2_hagoromo_done' },
      },
    ],
    3: [
      {
        id: 'ml3', type: 'mainline', name: '主线·终幕',
        desc: '踏入潮下界，面对源茧的真相。',
        progress: { steps: ['chapter3_5', 'chapter3_7', 'chapter3_9'] },
      },
      {
        id: 'd3_dream', type: 'side', name: '潮下界边缘的休憩',
        desc: '羽衣难得在你身边坐下来。',
        loc: 'abyss_verge', when: 'night',
        complete: { flag: 'd3_dream_done' },
      },
      {
        id: 'ch3_side1', type: 'side', name: '羽衣的痕迹',
        desc: '潮下界边缘找到羽衣留下的痕迹。',
        loc: 'abyss_verge', when: 'day',
        complete: { flag: 'hagoromo_joined' },
      },
      {
        id: 'ch3_side2', type: 'side', name: '抓住她的手',
        desc: '在情感碎片森林里追上羽衣。',
        loc: 'cocoon_forest', when: 'day',
        complete: { flag: 'ch3_side2_done' },
      },
      {
        id: 'd3_suzu', type: 'side', name: '镜湖的记忆',
        desc: '循着低语来到镜湖，湖底封存着铃的记忆。',
        loc: 'memory_sea', when: 'night',
        complete: { flag: 'd3_suzu_done' },
      },
      {
        id: 'ch3_side3', type: 'side', name: '源茧的真相',
        desc: '天城教授沉默了很久，然后源茧开始告诉你一切。',
        loc: 'truth_archive', when: 'day',
        complete: { flag: 'ch3_side3_done' },
      },
    ],
  },

  // ---- 每日活动 ----
  // chapter 字段：该活动所属章节（1/2/3）。缺省 = 所有章节都显示（向后兼容）。
  // 面板按 S.chapter 过滤；对应 act_* 事件定义在 core/world-data.js 各章地图上。
  dailies: [
    {
      id: 'act_coop_yuki', name: '陪雪去天台',
      desc: '和雪一起去天台，享受片刻宁静。',
      loc: 'school', when: 'day', target: 1, chapter: 1,
    },
    {
      id: 'act_coop_suzu', name: '陪铃巡逻',
      desc: '和铃一起在旧城区巡逻，清理魔物。',
      loc: 'old_building', when: 'night', target: 1, chapter: 1,
    },
    {
      id: 'act_coop_hagoromo', name: '陪羽衣调查',
      desc: '和羽衣一起在资料室调查茧的线索。',
      loc: 'school', when: 'day', target: 1, chapter: 1,
    },
    {
      id: 'act_job_shop', name: '商店打工',
      desc: '在商业街的商店帮忙，赚取一些零用钱。',
      loc: 'shopping', when: 'day', target: 1, chapter: 1,
    },
    {
      id: 'act_relax_moon', name: '月下休憩',
      desc: '在月光下独处，整理思绪。',
      loc: 'school', when: 'night', target: 1, chapter: 1,
    },
    // ---- 第二章「蚀の茧」----
    {
      id: 'act_coop_yuki2', name: '陪雪整理相册',
      desc: '去初雪公寓帮雪打理房间，一起翻那本全是绫音的相册。',
      loc: 'snow_apt', when: 'day', target: 1, chapter: 2, reward: '信任+6',
    },
    {
      id: 'act_coop_suzu2', name: '陪铃写笔记',
      desc: '夜晚在荒闸里安全屋，陪铃把怕忘记的事写进笔记本。',
      loc: 'abandoned_apt', when: 'night', target: 1, chapter: 2, reward: '信任+6',
    },
    {
      id: 'act_job_station', name: '车站便利店打工',
      desc: '在车站前的便利店帮忙，赚取这个月的生活费。',
      loc: 'station', when: 'day', target: 1, chapter: 2, reward: '金钱+80',
    },
    // ---- 第三章「真相之茧」----
    {
      id: 'act_coop_hagoromo3', name: '与羽衣巡视边缘',
      desc: '和水无月羽衣并肩巡视潮下界·边缘，讲解侵蚀的纹路。',
      loc: 'abyss_verge', when: 'day', target: 1, chapter: 3, reward: '信任+8',
    },
    {
      id: 'act_coop_suzu3', name: '镜湖边的铃',
      desc: '夜晚和星野铃并肩坐在镜湖边，听她复述找回的名字。',
      loc: 'memory_sea', when: 'night', target: 1, chapter: 3, reward: '信任+8',
    },
    {
      id: 'act_job_archive', name: '整理记忆碎片',
      desc: '在回廊档案整理脱落的记忆碎片，情感晶体可换钱。',
      loc: 'truth_archive', when: 'day', target: 1, chapter: 3, reward: '金钱+120',
    },
  ],

  // ---- 死任务（倒计时）----
  // 按章节索引 { chapter: [deadline...] }，供 game.js registerChapterDeadlines 读取。
  // 每项 cfg 格式：{ id, chapter, dueDays, bossId, loc, failScene }
  deadlines: {
    1: [
      {
        id: 'dl1_nest', chapter: 1,
        name: '母巢孵化',
        desc: '废弃工地深处的母巢正在孵化，必须在它成熟前阻止。',
        bossId: 'mother1', loc: 'construction',
        dueDays: 7, failScene: 'fail_mother',
      },
    ],
    2: [
      {
        id: 'dl2_burst', chapter: 2,
        name: '铃的茧',
        desc: '铃的侵蚀已经深入骨髓，她的茧正在成形。',
        bossId: 'saya_burst', loc: 'abandoned_apt',
        dueDays: 10, failScene: 'fail_cocoon',
      },
    ],
    3: [
      {
        id: 'dl3_source', chapter: 3,
        name: '源茧孵化',
        desc: '源茧即将完成孵化，整个杭州将化为茧的巢穴。',
        bossId: 'source_cocoon', loc: 'abyss_core',
        dueDays: 12, failScene: 'fail_source',
      },
    ],
  },
};

if (typeof window !== 'undefined') window.QuestConfig = QuestConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = QuestConfig;