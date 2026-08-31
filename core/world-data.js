/* =========================================================
 * 白月茧响 - 第1~3章地图数据 + 区域元数据
 * 由 world.js 逻辑层（defineMap + getDistricts）自动加载。
 * 数据格式：window.WorldData = { maps, districtMeta }
 * ========================================================= */
'use strict';

window.WorldData = {
  maps: {

    // =========================================================
    // 第一章「夜见市」地图（区域制）
    // 区域：station_area 车站区 / school_area 学园区 / residential_area 住宅区 /
    //       shopping_area 商业区 / old_town 旧城区
    // 车站 station 为唯一枢纽，conns 连接各区域入口节点；区域间必须经车站中转。
    // 事件引用自 story/chapter1.story 与 story/ch1-m1.story 的真实场景 id。
    // 战斗事件 once:false 可重复练级；剧情事件 once:true。
    // =========================================================
    1: [
      {
        id: 'station', name: '车站前', type: 'plaza', district: 'station_area',
        desc: '夜见车站前的广场。白天人潮往来，入夜后空无一人，路灯把影子拉得很长，墙上偶尔能看到巨大的爪痕。',
        x: 300, y: 80,
        conns: ['school', 'apt', 'shopping', 'old_building'],
        events: [
          {
            id: 'ev_station_side4', scene: 'ch1_side4', when: 'day', once: true,
            desc: '绕远路回家经过车站——街对面二楼的窗后，有人正注视着你。',
          },
          {
            id: 'ev_station_nightpatrol', scene: 'chapter1_6', enemy: 'patrol_eye',
            next: 'd1_night_menu', when: 'night', once: false, weight: 3,
            desc: '深夜的街道上，浮游的观测之眼在路灯之间徘徊。',
          },
        ],
      },
      {
        id: 'school', name: '神领学院', type: 'school', district: 'school_area',
        desc: '神领学院。校门后是走廊、教室与天台——也是羽衣、雪与铃各自藏着的秘密发生的地方。入夜后，这里的阴影比白天更深。',
        x: 150, y: 120,
        conns: ['station'],
        events: [
          {
            id: 'ev_academy_roof', scene: 'ch1_side1', when: 'day', once: true,
            desc: '天台上，水无月羽衣第一次拦住你：「你身上有茧的气息。」',
          },
          {
            id: 'ev_academy_library', scene: 'ch1_side2', when: 'day', once: true,
            desc: '资料室里，羽衣翻着旧档案，说出那句让你浑身发冷的话：「茧本来选中的契约者，是我。」',
          },
          {
            id: 'ev_academy_snow_roof', scene: 'd1_snow_roof', when: 'day', once: true,
            cond: (S) => !Engine.flag('d1_snow_done'),
            desc: '天台上，雪递来一个保温盒，笑着说「我就知道你会来」。',
          },
          {
            id: 'ev_academy_hagoromo_library', scene: 'd1_hagoromo_library', when: 'day', once: true,
            cond: (S) => !Engine.flag('d1_hagoromo_done'),
            desc: '资料室里，羽衣合上旧档案，目光平静却决绝——「走进茧的深处，把那个位置拿回来。」',
          },
        ],
      },
      {
        id: 'apt', name: '公寓', type: 'home', district: 'residential_area',
        desc: '凌的房间，现在是绫音的房间。窗帘缝里漏进的光，落在摊开的掌心上。墙上海报还属于凌，镜子里的人却不再是他。',
        x: 90, y: 300,
        conns: ['station'],
        events: [
          {
            id: 'ev_apt_diary', scene: 'chapter1_9', when: 'night', once: true, weight: 2,
            desc: '深夜回到公寓，翻开那本空白的笔记本——笔迹已经不属于凌了。',
          },
          {
            id: 'ev_apt_basement', scene: 'chapter1_11', when: 'day', once: true,
            desc: '公寓地下室里独自练刀。刃光越熟练，手腕上的蚀纹就越深。',
          },
        ],
      },
      {
        id: 'shopping', name: '商业街', type: 'street', district: 'shopping_area',
        desc: '夜晚的商业街。霓虹灯一盏盏熄灭后，只剩熄灯招牌与紧闭的卷帘门。排水沟里偶尔渗出湿漉漉的、腥甜的黏液。',
        x: 470, y: 160,
        conns: ['station'],
        events: [
          {
            id: 'ev_market_shopping', scene: 'chapter1_3c', when: 'day', once: true,
            desc: '被女生们拉去逛街。试衣镜里那个「可爱又危险」的地雷系少女，正一点一点代替凌。',
          },
          {
            id: 'ev_market_spider', scene: 'chapter1_battle1', enemy: 'spider1',
            next: 'd1_night_menu', when: 'night', once: false, weight: 3,
            rewards: { materials: { tentacle_frag: 1 } },
            desc: '商业街深处传来湿漉漉的蠕动声——织网之魔正在黑暗中结网。',
          },
        ],
      },
      {
        id: 'old_building', name: '旧校舍', type: 'ruin', district: 'old_town',
        desc: '神领学院的旧校舍，异界入口所在。腐朽的楼梯、黑洞洞的窗，月光像泼翻的牛奶铺在顶楼天台。被茧选中的人，都在这里留下过痕迹。',
        x: 380, y: 320,
        conns: ['station', 'construction'],
        events: [
          {
            id: 'ev_old_m1', scene: 'm1_girl_missing', when: 'night', once: true,
            cond: (S) => !Engine.flag('m1_girl_trigger'),
            desc: '那个座位已经空了六天。暮色里，旧校舍的方向飘来被雨水泡过的、腐烂的茧的气味。',
          },
          {
            id: 'ev_old_ghost', scene: 'd1_suzu_patrol', enemy: 'patrol_ghost',
            next: 'd1_suzu_patrol_after', when: 'night', once: false, weight: 3,
            rewards: { materials: { dream_silk: 1 } },
            desc: '和铃一起的夜间巡逻——旧校舍的影子里，怨念之影缓缓浮出。',
          },
        ],
      },
      {
        id: 'construction', name: '废弃工地', type: 'ruin', district: 'old_town',
        desc: '旧城区的废弃工地。断壁残垣的影子像巨兽的骨架，月光照不进的地方，传来又轻又慢的呼吸声——像蛰伏的野兽。',
        x: 500, y: 320,
        conns: ['old_building'],
        events: [
          {
            id: 'ev_ruins_nightcrawler', scene: 'ch1_side3_battle', enemy: 'night_crawler',
            next: 'chapter1_7', when: 'night', once: false, weight: 3,
            rewards: { materials: { dark_crystal: 1 } },
            desc: '废墟深处，夜行之影从阴影中蜕出，朝你张开那张裂到耳根的笑脸。',
          },
        ],
      },
    ],

    // =========================================================
    // 第二章「蚀の茧」地图（区域制，车站 hub）
    // 区域：station_area 车站区 / school_area 学园区 / residential_area 住宅区 /
    //       church_area 教会区 / old_town 旧城区
    // 事件引用自 story/chapter2.story 的真实场景 id（d2_snow_obsess / d2_suzu_worsen /
    // d2_prof_research / d2_night_menu）。
    // 战斗事件 enemy 引用 enemies.js 中真实存在的敌人 id；夜间战斗胜利后进入夜间菜单。
    // =========================================================
    2: [
      {
        id: 'station', name: '车站前', type: 'plaza', district: 'station_area',
        desc: '夜见车站前的广场。一个月过去，车站比往常更冷清。末班车驶离后，站台上的阴影里偶尔掠过细长的、不属于人类的影子。',
        x: 300, y: 80,
        conns: ['school', 'snow_apt', 'church', 'old_building', 'abandoned_apt'],
        events: [
          {
            id: 'ev2_station_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 3,
            desc: '白天的车站也不安全——浮游的观测之眼贴着人群的视线边缘，在你等红灯的间隙盯住了你。',
          },
          {
            id: 'ev2_station_night', enemy: 'night_crawler',
            next: 'd2_night_menu', when: 'night', once: false, weight: 3,
            desc: '深夜独自巡逻经过车站，夜行之影从售票机的黑暗里蜕出。',
          },
        ],
      },
      {
        id: 'school', name: '神领学院', type: 'school', district: 'school_area',
        desc: '神领学院。第二学期的课业依旧平静，只有绫音知道，侵蚀纹路已经悄悄爬上了她的肩膀。走廊里偶尔传来窃窃私语——「绫音同学最近，是不是越来越像女孩子了？」',
        x: 150, y: 120,
        conns: ['station'],
        events: [
          {
            id: 'ev2_school_day', enemy: 'patrol_ghost', when: 'day', once: false, weight: 3,
            desc: '午休时分，旧教学楼那边的走廊传来若有若无的啜泣——怨念之影在白天也敢出现了。',
          },
          {
            id: 'ev2_school_night', enemy: 'patrol_vine', when: 'night', once: false, weight: 2,
            desc: '放学后的校园空无一人，贪食之藤从体育器材室的缝隙里挤出来，藤蔓上还挂着昨天的血迹。',
          },
        ],
      },
      {
        id: 'snow_apt', name: '雪的家', type: 'home', district: 'residential_area',
        desc: '雾岛雪的家。窗台上多了一盆新养的月季，书桌上摆着几本相册——翻开全是绫音的照片，没有一张凌的。',
        x: 90, y: 300,
        conns: ['station'],
        events: [
          {
            id: 'ev2_snow_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 2,
            desc: '雪家附近的街角，一只有些熟悉的、过于专注的目光一闪而过——是观测之眼，还是雪的镜头？',
          },
          {
            id: 'ev2_snow_obsess', scene: 'd2_snow_obsess', when: 'night', once: true,
            cond: (S) => !Engine.flag('d2_snow_done'),
            desc: '按响雪家的门铃。相册里的照片一张一张滑过去——「你只要一直做绫音就好。」',
          },
        ],
      },
      {
        id: 'old_building', name: '旧校舍', type: 'ruin', district: 'school_area',
        desc: '神领学院的旧校舍，资料室就在这里。走廊的灯坏了，只剩应急灯发出昏黄的光。脚步声在空荡的回廊里反复弹跳，像是什么东西在跟着你。',
        x: 150, y: 220,
        conns: ['station', 'abandoned_apt'],
        events: [
          {
            id: 'ev2_prof_research', scene: 'd2_prof_research', when: 'night', once: true,
            cond: (S) => !Engine.flag('d2_hagoromo_done'),
            desc: '旧校舍资料室里亮着灯——羽衣正翻着一份印着「天城一马」署名的非公开档案。',
          },
          {
            id: 'ev2_old_day', enemy: 'patrol_ghost', when: 'day', once: false, weight: 2,
            desc: '白天经过旧校舍中庭的老银杏下，落叶堆里浮出一道扭曲的怨念之影。',
          },
          {
            id: 'ev2_old_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '旧校舍的夜晚比任何时候都深——夜行之影沿着腐朽的楼梯往下爬，一阶一阶，数着你的心跳。',
          },
        ],
      },
      {
        id: 'church', name: '废弃教堂', type: 'ruin', district: 'church_area',
        desc: '城市角落的废弃教堂。彩色玻璃大多碎裂，只剩几片残存的圣像。夕阳透过碎片，在地面上投下斑驳的光影——铃说过，她在这里渡给过你力量。',
        x: 470, y: 160,
        conns: ['station'],
        events: [
          {
            id: 'ev2_church_day', enemy: 'patrol_vine', when: 'day', once: false, weight: 2,
            desc: '白天的教堂里，圣坛下的阴影缓慢蠕动——贪食之藤缠绕着断裂的烛台，静静等你靠近。',
          },
          {
            id: 'ev2_church_guard', enemy: 'guard1',
            next: 'd2_night_menu', when: 'night', once: false, weight: 2,
            rewards: { materials: { dream_silk: 1 } },
            desc: '夜晚，你在教堂前的广场遭遇了拦路的茧卫·侵蚀傀儡——它曾是前代契约者。',
          },
        ],
      },
      {
        id: 'abandoned_apt', name: '废弃公寓', type: 'home', district: 'old_town',
        desc: '旧城区一栋废弃的公寓，铃临时搭起来的「安全屋」。月光从破碎的窗户洒进来，角落里摊着一本写满「雨宫雫」的笔记本，字迹一行比一行潦草。',
        x: 380, y: 320,
        conns: ['station', 'old_building'],
        events: [
          {
            id: 'ev2_suzu_worsen', scene: 'd2_suzu_worsen', when: 'night', once: true,
            cond: (S) => !Engine.flag('d2_suzu_done'),
            desc: '安全屋里，铃坐在月光下，一遍一遍写着「雨宫雫」——「我连自己叫什么都快记不得了。」',
          },
          {
            id: 'ev2_apt_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 2,
            desc: '白天的废弃公寓也不安宁——楼道尽头的阴影里，浮游的观测之眼一明一灭。',
          },
          {
            id: 'ev2_apt_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '夜里的安全屋并不安全——夜行之影顺着外墙的水管爬了上来，贴着窗户往里看。',
          },
        ],
      },
    ],

    // =========================================================
    // 第三章「真相之茧」地图（区域制，车站 hub + 异界环形）
    // 区域：station_area 异界站台（废弃地下铁站台）/ abyss_area 异界深渊
    // 事件引用自 story/chapter3.story 的真实场景 id（d3_dream_realm / d3_suzu_memory /
    // ch3_side1 / ch3_side2 / ch3_side3）。
    // 第三章身处异界，无夜间菜单：战斗胜利后直接返回地图。
    // =========================================================
    3: [
      {
        id: 'station', name: '异界站台', type: 'ruin', district: 'station_area',
        desc: '废弃的地下铁站台。应急灯早已熄灭多年，锈蚀的铁门后渗出暗紫色的微光。这里是现实与异界的交界——你即将踏入的，是所有人不敢正视的里世界。',
        x: 300, y: 80,
        conns: ['abyss_verge', 'cocoon_forest', 'memory_sea', 'abyss_core', 'truth_archive'],
        events: [
          {
            id: 'ev3_station_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 3,
            desc: '站台边缘的阴影里，浮游的观测之眼睁开——异界的边缘也有哨兵。',
          },
          {
            id: 'ev3_station_night', enemy: 'patrol_ghost', when: 'night', once: false, weight: 3,
            desc: '暗紫色的雾从铁门缝里渗出来，怨念之影在雾中缓缓成形，朝你张开嘴。',
          },
        ],
      },
      {
        id: 'abyss_verge', name: '异界边缘', type: 'ruin', district: 'abyss_area',
        desc: '异界的边缘。悬浮的茧在远处静静发光，像一串倒悬的灯笼。脚下的半透明膜踩上去泛起涟漪，荡开的波纹里隐约映出无数张沉睡的脸。',
        x: 150, y: 120,
        conns: ['station', 'cocoon_forest'],
        events: [
          {
            id: 'ev3_dream_realm', scene: 'd3_dream_realm', when: 'night', once: true,
            flag: 'd3_dream_done',
            cond: (S) => !Engine.flag('d3_dream_done'),
            desc: '异界边缘，羽衣难得在你身边坐下来。「……我一直在想，如果那天被选中的是我，我会不会也像你一样拼命。」',
          },
          {
            id: 'ev3_find_hagoromo', scene: 'ch3_side1', when: 'day', once: true,
            flag: 'hagoromo_joined',
            cond: (S) => !Engine.flag('hagoromo_joined') && !Engine.flag('ch3_side2_done'),
            desc: '异界边缘找到羽衣留下的痕迹——被斩断的触手残骸上，还泛着银白色的魔力残光。',
          },
          {
            id: 'ev3_verge_night', enemy: 'patrol_eye', when: 'night', once: false, weight: 2,
            desc: '异界边缘也不平静——一只有些陌生的观测之眼从倒悬的茧群里飘出来，盯着你。',
          },
        ],
      },
      {
        id: 'cocoon_forest', name: '情感碎片森林', type: 'ruin', district: 'abyss_area',
        desc: '由情感碎片凝结而成的森林。橙色的思念、灰色的绝望、红色的愤怒像雪花一样旋转，彼此碰撞，无声地碎裂，又无声地重组。',
        x: 90, y: 220,
        conns: ['abyss_verge', 'memory_sea'],
        events: [
          {
            id: 'ev3_hagoromo_side2', scene: 'ch3_side2', when: 'day', once: true,
            flag: 'ch3_side2_done',
            cond: (S) => (S.trust || {}).hagoromo >= 15 && !Engine.flag('ch3_side2_done'),
            desc: '你在情感碎片森林里追上羽衣——这一次，你抓住了她的手，很用力，很坚定。',
          },
          {
            id: 'ev3_forest_night', enemy: 'patrol_vine', when: 'night', once: false, weight: 3,
            desc: '森林的「树干」开始蠕动——那些缠绕的情感碎片，是贪食之藤伪装的。',
          },
        ],
      },
      {
        id: 'memory_sea', name: '不动之海', type: 'ruin', district: 'abyss_area',
        desc: '异界深处一片不会流动的海。那声音像雨声，又像叹息，从虚空的某个方向传来——铃的记忆，就沉在这片海的海底。',
        x: 90, y: 320,
        conns: ['cocoon_forest', 'abyss_core'],
        events: [
          {
            id: 'ev3_suzu_memory', scene: 'd3_suzu_memory', when: 'night', once: true,
            flag: 'd3_suzu_done',
            cond: (S) => !Engine.flag('d3_suzu_done'),
            desc: '循着雨声般的低语来到不动之海——海底封存着铃的记忆。要不要……把它还给她？',
          },
          {
            id: 'ev3_sea_day', enemy: 'patrol_ghost', when: 'day', once: false, weight: 2,
            desc: '不动之海的表面平静如镜，可海面下浮起的怨念之影，正隔着「镜面」静静看着你。',
          },
          {
            id: 'ev3_sea_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '入夜后，不动之海真的「动」了——夜行之影从海的褶皱里爬上岸，拖着一身湿漉漉的影子。',
          },
        ],
      },
      {
        id: 'abyss_core', name: '源茧之巢', type: 'boss', district: 'abyss_area',
        desc: '异界的核心。一个直径超过百米的巨大茧悬浮在虚空中，表面布满缓慢旋转的符文。它比任何建筑物都要庞大——像一颗沉睡的心脏，也像一座倒悬的坟场。',
        x: 200, y: 320,
        conns: ['memory_sea', 'truth_archive'],
        events: [
          {
            id: 'ev3_core_guard', enemy: 'guard1', when: 'night', once: false, weight: 3,
            rewards: { materials: { dark_crystal: 1 } },
            desc: '源茧之前，一个被完全侵蚀的前代契约者缓缓转过身——它曾是魔法少女，现在只是一道守卫。',
          },
          {
            id: 'ev3_core_day', enemy: 'patrol_vine', when: 'day', once: false, weight: 2,
            desc: '源茧的根系缠满了脚下的虚空，贪食之藤顺着那些粗壮的「血管」蜿蜒而下，朝你探来。',
          },
        ],
      },
      {
        id: 'truth_archive', name: '记忆回廊', type: 'ruin', district: 'abyss_area',
        desc: '一条被记忆碎片铺满的回廊。墙壁上嵌着一格格发光的「茧」——每一格里，都是某个契约者被抹去的人生。回廊尽头，天城教授曾在这里说出真相。',
        x: 320, y: 220,
        conns: ['abyss_core', 'station'],
        events: [
          {
            id: 'ev3_prof_truth', scene: 'ch3_side3', when: 'day', once: true,
            flag: 'ch3_side3_done',
            cond: (S) => !Engine.flag('ch3_side3_done'),
            desc: '记忆回廊深处，天城教授沉默了很久。「我已经把真相讲给你听了。剩下的——它想自己告诉你。」',
          },
          {
            id: 'ev3_archive_night', enemy: 'source_defense', when: 'night', once: false, weight: 2,
            rewards: { materials: { memory_shard: 1 } },
            desc: '回廊尽头的茧壁突然蠕动起来——源茧的防御机制被惊动了，触手从记忆的缝隙里探出。',
          },
        ],
      },
    ],
  },

  // ---- 区域元数据 ----
  districtMeta: {
    station_area:    { name: '车站区',      desc: '夜见车站前的广场，区域间往来的枢纽。', entry: 'station' },
    school_area:     { name: '学园区',      desc: '神领学院所在的街区，白天的日常与夜晚的秘密交织。', entry: 'school' },
    residential_area:{ name: '住宅区',      desc: '安静的住宅街，公寓就在这里。', entry: 'apt' },
    shopping_area:   { name: '商业区',      desc: '霓虹商业街，入夜后是魔物的猎场。', entry: 'shopping' },
    old_town:        { name: '旧城区',      desc: '旧校舍与废弃工地所在的衰败城区，异界入口所在。', entry: 'old_building' },
    church_area:     { name: '教会区',      desc: '城市角落的废弃教堂一带，侵蚀与救赎在此交汇。', entry: 'church' },
    abyss_area:      { name: '异界深渊',    desc: '城市地下两百米处的里世界，情感碎片与源茧的巢穴。', entry: 'abyss_verge' },
  },
};