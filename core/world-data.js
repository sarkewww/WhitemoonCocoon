/* =========================================================
 * 白月茧响 - 第1~3章地图数据 + 区域元数据
 * 由 world.js 逻辑层（defineMap + getDistricts）自动加载。
 * 数据格式：window.WorldData = { maps, districtMeta }
 * ========================================================= */
'use strict';

window.WorldData = {
  maps: {

    // =========================================================
    // 第一章「杭州·夜见」地图（区域制）
    // 区域：station_area 车站区 / school_area 学园区 / residential_area 住宅区 /
    //       shopping_area 灯河街 / old_town 旧城区
    // 车站 station 为唯一枢纽，conns 连接各区域入口节点；区域间必须经车站中转。
    // 事件引用自 story/chapter1.story 与 story/ch1-m1.story 的真实场景 id。
    // 战斗事件 once:false 可重复练级；剧情事件 once:true。
    // 每日活动（act_*）once:false + limit 字段：由每日活动面板消费，每日限量。
    // 死任务（dl*）once:true：出现时机由死任务引擎（quest-config + game.js）控制。
    // =========================================================
    1: [
      {
        id: 'station', name: '车站前', type: 'plaza', district: 'station_area',
        desc: '杭州车站前的广场。白天人潮往来，入夜后空无一人，路灯把影子拉得很长，墙上偶尔能看到巨大的爪痕。',
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
        id: 'school', name: '钱潮中学', type: 'school', district: 'school_area',
        desc: '钱潮中学。校门后是走廊、教室与天台——也是羽衣、雪与铃各自藏着的秘密发生的地方。入夜后，这里的阴影比白天更深。',
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
          {
            id: 'act_coop_yuki', scene: 'd1_snow_roof', when: 'day', once: false, limit: 1,
            cond: (S) => Engine.flag('d1_snow_done'),
            desc: '【每日活动】白天陪雾岛雪去天台。她递来保温盒，笑着说「我就知道你会来」——陪她的时间，让羁绊悄然加深。（信任+）',
          },
          {
            id: 'act_coop_hagoromo', scene: 'd1_hagoromo_library', when: 'day', once: false, limit: 1,
            cond: (S) => Engine.flag('d1_hagoromo_done'),
            desc: '【每日活动】白天去故纸斋找水无月羽衣。她合上旧档案，陪你梳理茧的线索——并肩的时光让信赖更牢固。（信任+）',
          },
          {
            id: 'act_relax_moon', when: 'night', once: false, limit: 1,
            commands: [
              { type: 'effect', fn: (S) => { S.ero = Math.max(0, (S.ero||0) - 3); S.anchor = Math.min(100, (S.anchor||50) + 2); } },
            ],
            desc: '【每日活动】夜晚独自登上钱潮中学的天台看月亮。夜风把躁动吹散了一些，侵蚀减轻，心里多了一点安定。（侵蚀-3 / 锚点+2）',
          },
        ],
      },
      {
        id: 'apt', name: '栖霞公寓', type: 'home', district: 'residential_area',
        desc: '凌的房间，现在是绫音的房间。窗帘缝里漏进的光，落在摊开的掌心上。墙上海报还属于凌，镜子里的人却不再是他。',
        x: 90, y: 300,
        conns: ['station'],
        events: [
          {
            id: 'ev_apt_diary', scene: 'chapter1_9', when: 'night', once: true, weight: 2,
            desc: '深夜回到栖霞公寓，翻开那本空白的笔记本——笔迹已经不属于凌了。',
          },
          {
            id: 'ev_apt_basement', scene: 'chapter1_11', when: 'day', once: true,
            desc: '栖霞公寓地下室里独自练刀。刃光越熟练，手腕上的蚀纹就越深。',
          },
        ],
      },
      {
        id: 'shopping', name: '灯河街', type: 'street', district: 'shopping_area',
        desc: '夜晚的灯河街。霓虹灯一盏盏熄灭后，只剩熄灯招牌与紧闭的卷帘门。排水沟里偶尔渗出湿漉漉的、腥甜的黏液。',
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
            desc: '灯河街深处传来湿漉漉的蠕动声——织网之魔正在黑暗中结网。',
          },
          {
            id: 'act_job_shop', when: 'day', once: false, limit: 1,
            commands: [
              { type: 'effect', fn: (S) => { if (typeof Engine !== 'undefined' && Engine.addMoney) Engine.addMoney(50); } },
            ],
            rewards: { money: 50 },
            desc: '【每日活动】白天在灯河街的商店打工。整理货架、招呼客人，傍晚店长塞给你几张钞票——辛苦没有白费。（金钱+50）',
          },
        ],
      },
      {
        id: 'old_building', name: '空蝉旧舍', type: 'ruin', district: 'old_town',
        desc: '钱潮中学的空蝉旧舍，潮下界入口所在。腐朽的楼梯、黑洞洞的窗，月光像泼翻的牛奶铺在顶楼天台。被茧选中的人，都在这里留下过痕迹。',
        x: 380, y: 320,
        conns: ['station', 'construction'],
        events: [
          {
            id: 'ev_old_m1', scene: 'm1_girl_missing', when: 'night', once: true,
            cond: (S) => !Engine.flag('m1_girl_trigger'),
            desc: '那个座位已经空了六天。暮色里，空蝉旧舍的方向飘来被雨水泡过的、腐烂的茧的气味。',
          },
          {
            id: 'ev_old_ghost', scene: 'd1_suzu_patrol', enemy: 'patrol_ghost',
            next: 'd1_suzu_patrol_after', when: 'night', once: false, weight: 3,
            rewards: { materials: { dream_silk: 1 } },
            desc: '和铃一起的夜间巡逻——空蝉旧舍的影子里，怨念之影缓缓浮出。',
          },
          {
            id: 'act_coop_suzu', scene: 'd1_suzu_patrol', when: 'night', once: false, limit: 1,
            cond: (S) => Engine.flag('d1_suzu_done'),
            desc: '【每日活动】夜晚和星野铃一起在空蝉旧舍附近巡逻。她转着银色的短杖，走在前面——和她的默契，比任何武器都可靠。（信任+）',
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
          {
            id: 'dl1_nest', enemy: 'mother1', once: true,
            cond: (S) => !!(S.flags && S.flags['dl1_nest_active']),
            desc: '【死任务】废弃工地的地底，传来沉闷的搏动——母巢正在孵化。必须在它破土之前，把它彻底斩断。',
          },
        ],
      },
    ],

    // =========================================================
    // 第二章「蚀の茧」地图（区域制，车站 hub）
    // 区域：station_area 车站区 / school_area 学园区 / residential_area 住宅区 /
    //       church_area 空钟堂区域 / old_town 旧城区
    // 事件引用自 story/chapter2.story 的真实场景 id（d2_snow_obsess / d2_suzu_worsen /
    // d2_prof_research / d2_night_menu）。
    // 战斗事件 enemy 引用 enemies.js 中真实存在的敌人 id；夜间战斗胜利后进入夜间菜单。
    // =========================================================
    2: [
      {
        id: 'station', name: '车站前', type: 'plaza', district: 'station_area',
        desc: '杭州车站前的广场。一个月过去，车站比往常更冷清。末班车驶离后，站台上的阴影里偶尔掠过细长的、不属于人类的影子。',
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
        id: 'school', name: '钱潮中学', type: 'school', district: 'school_area',
        desc: '钱潮中学。第二学期的课业依旧平静，只有绫音知道，侵蚀纹路已经悄悄爬上了她的肩膀。走廊里偶尔传来窃窃私语——「绫音同学最近，是不是越来越像女孩子了？」',
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
        id: 'snow_apt', name: '初雪公寓', type: 'home', district: 'residential_area',
        desc: '雾岛雪的家。窗台上多了一盆新养的月季，书桌上摆着几本相册——翻开全是绫音的照片，没有一张凌的。',
        x: 90, y: 300,
        conns: ['station'],
        events: [
          {
            id: 'ev2_snow_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 2,
            desc: '初雪公寓附近的街角，一只有些熟悉的、过于专注的目光一闪而过——是观测之眼，还是雪的镜头？',
          },
          {
            id: 'ev2_snow_obsess', scene: 'd2_snow_obsess', when: 'night', once: true,
            cond: (S) => !Engine.flag('d2_snow_done'),
            desc: '按响雪家的门铃。相册里的照片一张一张滑过去——「你只要一直做绫音就好。」',
          },
        ],
      },
      {
        id: 'old_building', name: '空蝉旧舍', type: 'ruin', district: 'school_area',
        desc: '钱潮中学的空蝉旧舍，资料室就在这里。走廊的灯坏了，只剩应急灯发出昏黄的光。脚步声在空荡的回廊里反复弹跳，像是什么东西在跟着你。',
        x: 150, y: 220,
        conns: ['station', 'abandoned_apt'],
        events: [
          {
            id: 'ev2_prof_research', scene: 'd2_prof_research', when: 'night', once: true,
            cond: (S) => !Engine.flag('d2_hagoromo_done'),
            desc: '空蝉旧舍资料室里亮着灯——羽衣正翻着一份印着「天城一马」署名的非公开档案。',
          },
          {
            id: 'ev2_old_day', enemy: 'patrol_ghost', when: 'day', once: false, weight: 2,
            desc: '白天经过空蝉旧舍中庭的老银杏下，落叶堆里浮出一道扭曲的怨念之影。',
          },
          {
            id: 'ev2_old_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '空蝉旧舍的夜晚比任何时候都深——夜行之影沿着腐朽的楼梯往下爬，一阶一阶，数着你的心跳。',
          },
        ],
      },
      {
        id: 'church', name: '空钟堂', type: 'ruin', district: 'church_area',
        desc: '城市角落的空钟堂。彩色玻璃大多碎裂，只剩几片残存的圣像。夕阳透过碎片，在地面上投下斑驳的光影——铃说过，她在这里渡给过你力量。',
        x: 470, y: 160,
        conns: ['station'],
        events: [
          {
            id: 'ev2_church_day', enemy: 'patrol_vine', when: 'day', once: false, weight: 2,
            desc: '白天的空钟堂里，圣坛下的阴影缓慢蠕动——贪食之藤缠绕着断裂的烛台，静静等你靠近。',
          },
          {
            id: 'ev2_church_guard', enemy: 'guard1',
            next: 'd2_night_menu', when: 'night', once: false, weight: 2,
            rewards: { materials: { dream_silk: 1 } },
            desc: '夜晚，你在空钟堂前的广场遭遇了拦路的茧卫·侵蚀傀儡——它曾是前代契约者。',
          },
        ],
      },
      {
        id: 'abandoned_apt', name: '荒闸里', type: 'home', district: 'old_town',
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
            desc: '白天的荒闸里也不安宁——楼道尽头的阴影里，浮游的观测之眼一明一灭。',
          },
          {
            id: 'ev2_apt_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '夜里的安全屋并不安全——夜行之影顺着外墙的水管爬了上来，贴着窗户往里看。',
          },
          {
            id: 'dl2_burst', enemy: 'saya_burst', once: true,
            cond: (S) => !!(S.flags && S.flags['dl2_burst_active']),
            desc: '【死任务】荒闸里深处，铃的茧在低沉的搏动中一寸寸胀大——它的暴走，已经近在眼前。',
          },
        ],
      },
    ],

    // =========================================================
    // 第三章「真相之茧」地图（区域制，潮下界站台 hub + 潮下界环形）
    // 区域：station_area 潮下界站台（废弃地下铁站台）/ abyss_area 潮下界
    // 事件引用自 story/chapter3.story 的真实场景 id（d3_dream_realm / d3_suzu_memory /
    // ch3_side1 / ch3_side2 / ch3_side3）。
    // 第三章身处潮下界，无夜间菜单：战斗胜利后直接返回地图。
    // =========================================================
    3: [
      {
        id: 'station', name: '潮下界站台', type: 'ruin', district: 'station_area',
        desc: '废弃的地下铁站台。应急灯早已熄灭多年，锈蚀的铁门后渗出暗紫色的微光。这里是现实与潮下界的交界——你即将踏入的，是所有人不敢正视的里世界。',
        x: 300, y: 80,
        conns: ['abyss_verge', 'cocoon_forest', 'memory_sea', 'abyss_core', 'truth_archive'],
        events: [
          {
            id: 'ev3_station_day', enemy: 'patrol_eye', when: 'day', once: false, weight: 3,
            desc: '站台边缘的阴影里，浮游的观测之眼睁开——潮下界的边缘也有哨兵。',
          },
          {
            id: 'ev3_station_night', enemy: 'patrol_ghost', when: 'night', once: false, weight: 3,
            desc: '暗紫色的雾从铁门缝里渗出来，怨念之影在雾中缓缓成形，朝你张开嘴。',
          },
        ],
      },
      {
        id: 'abyss_verge', name: '潮下界·边缘', type: 'ruin', district: 'abyss_area',
        desc: '潮下界的边缘。悬浮的茧在远处静静发光，像一串倒悬的灯笼。脚下的半透明膜踩上去泛起涟漪，荡开的波纹里隐约映出无数张沉睡的脸。',
        x: 150, y: 120,
        conns: ['station', 'cocoon_forest'],
        events: [
          {
            id: 'ev3_dream_realm', scene: 'd3_dream_realm', when: 'night', once: true,
            flag: 'd3_dream_done',
            cond: (S) => !Engine.flag('d3_dream_done'),
            desc: '潮下界·边缘，羽衣难得在你身边坐下来。「……我一直在想，如果那天被选中的是我，我会不会也像你一样拼命。」',
          },
          {
            id: 'ev3_find_hagoromo', scene: 'ch3_side1', when: 'day', once: true,
            flag: 'hagoromo_joined',
            cond: (S) => !Engine.flag('hagoromo_joined') && !Engine.flag('ch3_side2_done'),
            desc: '潮下界·边缘找到羽衣留下的痕迹——被斩断的触手残骸上，还泛着银白色的魔力残光。',
          },
          {
            id: 'ev3_verge_night', enemy: 'patrol_eye', when: 'night', once: false, weight: 2,
            desc: '潮下界·边缘也不平静——一只有些陌生的观测之眼从倒悬的茧群里飘出来，盯着你。',
          },
        ],
      },
      {
        id: 'cocoon_forest', name: '蚕房', type: 'ruin', district: 'abyss_area',
        desc: '由情感碎片凝结而成的森林。橙色的思念、灰色的绝望、红色的愤怒像雪花一样旋转，彼此碰撞，无声地碎裂，又无声地重组。',
        x: 90, y: 220,
        conns: ['abyss_verge', 'memory_sea'],
        events: [
          {
            id: 'ev3_hagoromo_side2', scene: 'ch3_side2', when: 'day', once: true,
            flag: 'ch3_side2_done',
            cond: (S) => (S.trust || {}).hagoromo >= 15 && !Engine.flag('ch3_side2_done'),
            desc: '你在蚕房里追上羽衣——这一次，你抓住了她的手，很用力，很坚定。',
          },
          {
            id: 'ev3_forest_night', enemy: 'patrol_vine', when: 'night', once: false, weight: 3,
            desc: '蚕房的「树干」开始蠕动——那些缠绕的情感碎片，是贪食之藤伪装的。',
          },
        ],
      },
      {
        id: 'memory_sea', name: '镜湖', type: 'ruin', district: 'abyss_area',
        desc: '潮下界深处一片不会流动的镜湖。那声音像雨声，又像叹息，从虚空的某个方向传来——铃的记忆，就沉在这片湖的湖底。',
        x: 90, y: 320,
        conns: ['cocoon_forest', 'abyss_core'],
        events: [
          {
            id: 'ev3_suzu_memory', scene: 'd3_suzu_memory', when: 'night', once: true,
            flag: 'd3_suzu_done',
            cond: (S) => !Engine.flag('d3_suzu_done'),
            desc: '循着雨声般的低语来到镜湖——湖底封存着铃的记忆。要不要……把它还给她？',
          },
          {
            id: 'ev3_sea_day', enemy: 'patrol_ghost', when: 'day', once: false, weight: 2,
            desc: '镜湖的表面平静如镜，可湖面下浮起的怨念之影，正隔着「镜面」静静看着你。',
          },
          {
            id: 'ev3_sea_night', enemy: 'night_crawler', when: 'night', once: false, weight: 3,
            desc: '入夜后，镜湖真的「动」了——夜行之影从湖的褶皱里爬上岸，拖着一身湿漉漉的影子。',
          },
        ],
      },
      {
        id: 'abyss_core', name: '源茧之巢', type: 'boss', district: 'abyss_area',
        desc: '潮下界的核心。一个直径超过百米的巨大茧悬浮在虚空中，表面布满缓慢旋转的符文。它比任何建筑物都要庞大——像一颗沉睡的心脏，也像一座倒悬的坟场。',
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
          {
            id: 'dl3_source', enemy: 'source_cocoon', once: true,
            cond: (S) => !!(S.flags && S.flags['dl3_source_active']),
            desc: '【死任务】源茧的搏动频率骤然加快——整个虚空都在震颤。它正在觉醒，如果此刻不阻止，一切都将终结。',
          },
        ],
      },
      {
        id: 'truth_archive', name: '回廊档案', type: 'ruin', district: 'abyss_area',
        desc: '一条被记忆碎片铺满的回廊。墙壁上嵌着一格格发光的「茧」——每一格里，都是某个契约者被抹去的人生。回廊尽头，天城教授曾在这里说出真相。',
        x: 320, y: 220,
        conns: ['abyss_core', 'station'],
        events: [
          {
            id: 'ev3_prof_truth', scene: 'ch3_side3', when: 'day', once: true,
            flag: 'ch3_side3_done',
            cond: (S) => !Engine.flag('ch3_side3_done'),
            desc: '回廊档案深处，天城教授沉默了很久。「我已经把真相讲给你听了。剩下的——它想自己告诉你。」',
          },
          {
            id: 'ev3_archive_night', enemy: 'source_defense', when: 'night', once: false, weight: 2,
            rewards: { materials: { memory_shard: 1 } },
            desc: '回廊档案尽头的茧壁突然蠕动起来——源茧的防御机制被惊动了，触手从记忆的缝隙里探出。',
          },
        ],
      },
    ],
  },

  // ---- 区域元数据 ----
  districtMeta: {
    station_area:    { name: '车站区',      desc: '车站前的广场，区域间往来的枢纽。', entry: 'station' },
    school_area:     { name: '学园区',      desc: '钱潮中学所在的街区，白天的日常与夜晚的秘密交织。', entry: 'school' },
    residential_area:{ name: '住宅区',      desc: '安静的住宅街，栖霞公寓与初雪公寓就在这里。', entry: 'apt' },
    shopping_area:   { name: '灯河街',      desc: '霓虹闪烁的灯河街，入夜后是魔物的猎场。', entry: 'shopping' },
    old_town:        { name: '旧城区',      desc: '空蝉旧舍与废弃工地所在的衰败城区，潮下界入口所在。', entry: 'old_building' },
    church_area:     { name: '空钟堂区域',  desc: '城市角落的空钟堂一带，侵蚀与救赎在此交汇。', entry: 'church' },
    abyss_area:      { name: '潮下界',      desc: '城市地下两百米处的里世界，情感碎片与源茧的巢穴。', entry: 'abyss_verge' },
  },
};