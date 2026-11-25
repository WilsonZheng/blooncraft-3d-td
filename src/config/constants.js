// Core definitions for Bloons, Towers, Upgrades, Abilities, and Maps (Initial v0)

export const BLOON_TYPES = {
  red: {
    id: 'red',
    name: '红气球',
    color: 0xff3b3b,
    speed: 3.2,
    hp: 1,
    rbe: 1,
    reward: 1,
    scale: 0.52,
    children: []
  },
  blue: {
    id: 'blue',
    name: '蓝气球',
    color: 0x2b8cff,
    speed: 4.2,
    hp: 1,
    rbe: 2,
    reward: 1,
    scale: 0.56,
    children: ['red']
  },
  green: {
    id: 'green',
    name: '绿气球',
    color: 0x2ecc71,
    speed: 5.2,
    hp: 1,
    rbe: 3,
    reward: 1,
    scale: 0.60,
    children: ['blue']
  },
  yellow: {
    id: 'yellow',
    name: '黄气球',
    color: 0xffd32a,
    speed: 7.2,
    hp: 1,
    rbe: 4,
    reward: 1,
    scale: 0.63,
    children: ['green']
  },
  pink: {
    id: 'pink',
    name: '粉气球',
    color: 0xff6bb5,
    speed: 8.6,
    hp: 1,
    rbe: 5,
    reward: 1,
    scale: 0.65,
    children: ['yellow']
  },
  black: {
    id: 'black',
    name: '黑气球',
    color: 0x262930,
    speed: 4.8,
    hp: 1,
    rbe: 11,
    reward: 2,
    scale: 0.58,
    explosionImmune: true,
    children: ['pink', 'pink']
  },
  white: {
    id: 'white',
    name: '白气球',
    color: 0xf5f7fa,
    speed: 5.4,
    hp: 1,
    rbe: 11,
    reward: 2,
    scale: 0.58,
    freezeImmune: true,
    children: ['pink', 'pink']
  },
  purple: {
    id: 'purple',
    name: '紫电护盾球',
    color: 0x9333ea,
    purpleShield: true,
    energyImmune: true,
    speed: 8.4,
    hp: 2,
    rbe: 12,
    reward: 3,
    scale: 0.64,
    children: ['pink', 'pink']
  },
  lead: {
    id: 'lead',
    name: '铁皮气球',
    color: 0x718093,
    speed: 3.0,
    hp: 2,
    rbe: 23,
    reward: 3,
    scale: 0.66,
    sharpImmune: true,
    metallic: true,
    children: ['black', 'black']
  },
  zebra: {
    id: 'zebra',
    name: '斑马双生球',
    color: 0xe2e8f0,
    zebra: true,
    explosionImmune: true,
    freezeImmune: true,
    speed: 5.6,
    hp: 1,
    rbe: 23,
    reward: 3,
    scale: 0.65,
    children: ['black', 'white']
  },
  rainbow: {
    id: 'rainbow',
    name: '彩虹气球',
    color: 0xa55eea,
    rainbow: true,
    speed: 5.8,
    hp: 2,
    rbe: 47,
    reward: 4,
    scale: 0.70,
    children: ['zebra', 'zebra']
  },
  ceramic: {
    id: 'ceramic',
    name: '陶瓷气球',
    color: 0xd97b29,
    ceramic: true,
    speed: 6.2,
    hp: 12,
    rbe: 104,
    reward: 8,
    scale: 0.76,
    children: ['rainbow', 'rainbow']
  },
  moab: {
    id: 'moab',
    name: 'MOAB 巨型飞艇',
    color: 0x1e90ff,
    isMoab: true,
    speed: 2.15,
    hp: 300,
    rbe: 616,
    reward: 75,
    scale: 1.55,
    children: ['ceramic', 'ceramic', 'ceramic', 'ceramic']
  },
  ddt: {
    id: 'ddt',
    name: 'DDT 幽灵隐形艇',
    color: 0x1e293b,
    isMoab: true,
    innateCamo: true,
    sharpImmune: true,
    explosionImmune: true,
    metallic: true,
    speed: 3.65,
    hp: 375,
    rbe: 816,
    reward: 110,
    scale: 1.48,
    children: ['ceramic', 'ceramic', 'ceramic', 'ceramic']
  },
  bfb: {
    id: 'bfb',
    name: 'BFB 毁灭红艇',
    color: 0xd63031,
    isMoab: true,
    speed: 1.52,
    hp: 1320,
    rbe: 3164,
    reward: 200,
    scale: 2.02,
    children: ['moab', 'moab', 'moab', 'moab']
  },
  zomg: {
    id: 'zomg',
    name: 'ZOMG 翡翠泰坦舰',
    color: 0x10b981,
    isMoab: true,
    speed: 1.02,
    hp: 2650,
    rbe: 14856,
    reward: 420,
    scale: 2.38,
    children: ['bfb', 'bfb']
  },
  golden: {
    id: 'golden',
    name: '黄金宝藏艇',
    color: 0xfacc15,
    isMoab: true,
    isGolden: true,
    speed: 3.1,
    hp: 140,
    rbe: 0,
    reward: 130,
    scale: 1.26,
    children: []
  }
};

export const TOWER_TYPES = {
  dart: {
    id: 'dart',
    hotkey: '1',
    name: '飞镖射手',
    subtitle: '连珠暴击·弹射神弩',
    signatureName: '🎯 连珠弹射',
    signatureDesc: '每第 5 次射击必暴击，且所有暴击飞镖自动弹射追击附近另一名敌人！',
    icon: '🎯',
    color: 0x3b82f6,
    accent: 0x93c5fd,
    cost: 180,
    range: 5.8,
    fireRate: 1.6,
    damage: 1,
    pierce: 2,
    projectileSpeed: 29,
    damageType: 'sharp',
    canSeeCamo: false,
    footprint: 1.05,
    upgrades: [
      { name: '穿甲利镖', cost: 130, desc: '穿透 +2，射程 +15%', pierceAdd: 2, rangeMul: 1.15 },
      { name: '三连齐射', cost: 280, desc: '每次同时发射 3 枚扇形飞镖', multishot: 3, spread: 0.2 },
      { name: '神臂十字弩', cost: 640, desc: '伤害 +3，射程大增，识破迷彩且 30% 暴击双倍', damageAdd: 3, rangeMul: 1.22, grantCamo: true, critChance: 0.3 },
      { name: '重装巨弩大师', cost: 1680, desc: '攻速大幅飙升，伤害 +5，击穿铁皮并对飞艇增伤！', fireRateMul: 1.85, damageAdd: 5, pierceAdd: 5, moabBonus: 1.6, damageType: 'normal' }
    ]
  },
  tack: {
    id: 'tack',
    hotkey: '2',
    name: '八方钉塔',
    subtitle: '锯齿流血·熔火日冕',
    signatureName: '⚙️ 锯齿割裂 & 炎爆',
    signatureDesc: '飞刃附加流血持续掉血；每第 4 次攻击迸发大范围【熔火日冕】新星！',
    icon: '⚙️',
    color: 0xf43f5e,
    accent: 0xfda4af,
    cost: 240,
    range: 4.1,
    fireRate: 1.15,
    damage: 1,
    pierce: 1,
    projectileSpeed: 24,
    damageType: 'sharp',
    radialCount: 8,
    canSeeCamo: false,
    footprint: 1.05,
    upgrades: [
      { name: '高速齿轮', cost: 160, desc: '攻击速度提升 40%', fireRateMul: 1.4 },
      { name: '密集刀刃', cost: 340, desc: '升级为 12 方向旋转飞刃，穿透 +2', radialCount: 12, pierceAdd: 2 },
      { name: '烈焰火环', cost: 820, desc: '释放高温火焰冲击波，融化铁皮！', isFireRing: true, damageAdd: 2, pierceAdd: 18, damageType: 'fire', rangeMul: 1.18 },
      { name: '炼狱熔炉核心', cost: 2200, desc: '超高频烈焰新星 + 附带灼烧持续伤害', fireRateMul: 1.75, damageAdd: 4, burnDps: 6 }
    ]
  },
  cannon: {
    id: 'cannon',
    hotkey: '3',
    name: '重炮轰炸塔',
    subtitle: '冲击震退·碎甲凝固弹',
    signatureName: '💣 震退碎甲炮',
    signatureDesc: '爆炸将普通气球沿路线震退并附加碎甲易伤；每第 4 发发射巨型凝固汽油弹！',
    icon: '💣',
    color: 0x475569,
    accent: 0xf97316,
    cost: 360,
    range: 7.4,
    fireRate: 1.02,
    damage: 2,
    pierce: 18,
    splashRadius: 2.55,
    projectileSpeed: 28,
    damageType: 'explosion',
    canSeeCamo: false,
    footprint: 1.18,
    upgrades: [
      { name: '重装火药', cost: 220, desc: '爆炸范围 +30%，伤害 +1', splashMul: 1.3, damageAdd: 1 },
      { name: '集束子母弹', cost: 480, desc: '主弹爆炸分裂出 6 枚次级炸弹', clusterCount: 6 },
      { name: '飞艇粉碎者', cost: 980, desc: '对 MOAB 飞艇与陶瓷造成 4 倍伤害', moabBonus: 4.0, ceramicBonus: 2.5, fireRateMul: 1.25 },
      { name: '末日震荡巨炮', cost: 2500, desc: '超大范围重炮并短暂震晕所有目标', damageAdd: 6, stunDuration: 0.85, damageType: 'normal' }
    ]
  },
  frost: {
    id: 'frost',
    hotkey: '4',
    name: '极寒冰晶塔',
    subtitle: '碎冰斩杀·极寒冰枪',
    signatureName: '❄️ 碎冰斩杀 & 冰枪',
    signatureDesc: '对已冰封气球触发高额【碎冰爆破】，每第 3 次脉冲额外射出贯穿飞艇的极寒冰枪！',
    icon: '❄️',
    color: 0x06b6d4,
    accent: 0xa5f3fc,
    cost: 280,
    range: 5.2,
    fireRate: 1.12,
    damage: 1,
    pierce: 25,
    damageType: 'cold',
    isNova: true,
    freezeDuration: 1.15,
    slowFactor: 0.5,
    slowDuration: 2.6,
    canSeeCamo: false,
    footprint: 1.05,
    upgrades: [
      { name: '深寒霜冻', cost: 190, desc: '冰封时间延长，减速效果持续更久', freezeDuration: 1.6, slowDuration: 3.8, rangeMul: 1.15 },
      { name: '寒霜破隐', cost: 360, desc: '极寒脉冲剥离迷彩属性并冻结铁皮', stripCamo: true, grantCamo: true, damageType: 'normal' },
      { name: '脆弱冰晶', cost: 790, desc: '被冰冻或减速的气球受到的所有伤害 +2', brittleBonus: 2, damageAdd: 2 },
      { name: '绝对零度风暴', cost: 2100, desc: '超大范围极寒领域，连巨型飞艇也能减速！', rangeMul: 1.35, slowMoab: true, damageAdd: 5, fireRateMul: 1.4 }
    ]
  },
  ninja: {
    id: 'ninja',
    hotkey: '5',
    name: '暗影忍者',
    subtitle: '四重死印·瞬影斩杀',
    signatureName: '🥷 暗影死印·瞬斩',
    signatureDesc: '攻击叠加暗影死印，满 4 层引爆【瞬影斩】造成巨额真实伤害（按最大生命比例重创飞艇）！',
    icon: '🥷',
    color: 0x8b5cf6,
    accent: 0xd8b4fe,
    cost: 340,
    range: 6.8,
    fireRate: 2.3,
    damage: 1,
    pierce: 3,
    projectileSpeed: 33,
    damageType: 'sharp',
    canSeeCamo: true,
    camoBonus: 1,
    footprint: 1.0,
    upgrades: [
      { name: '追踪手里剑', cost: 230, desc: '手里剑自动拐弯追踪气球，穿透 +2', homing: true, pierceAdd: 2 },
      { name: '影分身双镖', cost: 400, desc: '每次投掷 2 枚手里剑，伤害 +1，攻速 +30%', multishot: 2, spread: 0.14, damageAdd: 1, fireRateMul: 1.3 },
      { name: '爆破闪光苦无', cost: 840, desc: '附带破甲爆破，炸毁铁皮、剥离再生且对飞艇 2.4 倍伤害', damageType: 'normal', stripRegrow: true, damageAdd: 2, moabBonus: 2.4 },
      { name: '五影宗师', cost: 2050, desc: '同时高速发射 5 枚强力追踪手里剑，主宰全场！', multishot: 5, spread: 0.32, fireRateMul: 1.6, damageAdd: 4 }
    ]
  },
  sniper: {
    id: 'sniper',
    hotkey: '6',
    name: '苍穹狙击塔',
    subtitle: '全图爆头赏金·穿甲震波',
    signatureName: '🔭 赏金猎头·穿甲波',
    signatureDesc: '全图无限射程，击杀目标额外掉落猎头赏金，子弹贯穿后震伤后方气球群！',
    icon: '🔭',
    color: 0x10b981,
    accent: 0x6ee7b7,
    cost: 380,
    range: 99, // Full map
    displayRange: 3.2,
    fireRate: 0.72,
    damage: 4,
    pierce: 1,
    hitscan: true,
    damageType: 'normal', // Pops lead from base!
    canSeeCamo: false,
    footprint: 1.05,
    upgrades: [
      { name: '夜视热成像', cost: 220, desc: '识破全图迷彩气球，对迷彩额外 +2 伤害', grantCamo: true, camoBonus: 2 },
      { name: '大口径穿甲弹', cost: 520, desc: '单发伤害提升至 12，一枪击碎陶瓷外壳', damageAdd: 8 },
      { name: '半自动连狙', cost: 1100, desc: '攻击速度暴增 160%', fireRateMul: 2.6 },
      { name: '重创飞艇猎手', cost: 2700, desc: '单发高爆重伤飞艇并使其瘫痪受创增伤', damageAdd: 22, moabBonus: 2.5, stunDuration: 0.6, brittleBonus: 2 }
    ]
  },
  tesla: {
    id: 'tesla',
    hotkey: '7',
    name: '雷霆电弧塔',
    subtitle: '连锁雷暴·漫游球形闪电',
    signatureName: '⚡ 逆流球形闪电',
    signatureDesc: '每第 3 次雷击在航道生成逆向漫游的【3D 等离子电球】，持续电击沿途敌群！',
    icon: '⚡',
    color: 0xeab308,
    accent: 0xfef08a,
    cost: 460,
    range: 6.2,
    fireRate: 1.4,
    damage: 2,
    chainCount: 5,
    chainRange: 3.8,
    isLightning: true,
    damageType: 'energy', // Pops lead, black, white!
    canSeeCamo: false,
    footprint: 1.12,
    upgrades: [
      { name: '高压电涌', cost: 280, desc: '连锁跳跃目标 +3，射程 +15%', chainAdd: 3, rangeMul: 1.15 },
      { name: '等离子电离', cost: 560, desc: '电弧灼烧阻止气球再生，伤害 +2', stripRegrow: true, damageAdd: 2 },
      { name: '风暴球形闪电', cost: 1150, desc: '攻速提升 50%，识破迷彩，对飞艇高额电击', fireRateMul: 1.5, grantCamo: true, moabBonus: 2.2 },
      { name: '宙斯雷神矩阵', cost: 2900, desc: '全屏级毁灭雷暴，跳跃 14 个目标！', chainAdd: 6, damageAdd: 7, fireRateMul: 1.45 }
    ]
  },
  beacon: {
    id: 'beacon',
    hotkey: '8',
    name: '黄金信标工坊',
    subtitle: '战鼓号令·产金反隐中枢',
    signatureName: '🏛️ 皇家战鼓脉冲',
    signatureDesc: '周期性释放黄金战鼓波，赋予范围内友军 +18% 暴击率并号令最高阶主力塔立即齐射！',
    icon: '🏛️',
    color: 0xf59e0b,
    accent: 0xfde68a,
    cost: 480,
    range: 6.2,
    isSupport: true,
    incomePerWave: 95,
    coinDropInterval: 6.5,
    coinDropValue: 22,
    buffFireRate: 1.15,
    buffRange: 1.12,
    grantCamoAura: false,
    footprint: 1.25,
    upgrades: [
      { name: '丰收金库', cost: 320, desc: '每波额外赏金 +65，金币掉落速度加快', incomeAdd: 65, coinValueAdd: 12 },
      { name: '全频反隐雷达', cost: 460, desc: '光环内所有防御塔获得【迷彩侦测】能力！', grantCamoAura: true, rangeMul: 1.18 },
      { name: '战鼓狂热激励', cost: 980, desc: '光环内防御塔攻速额外提升至 +32%', buffFireRate: 1.32, buffRange: 1.2 },
      { name: '帝国中央情报局', cost: 2400, desc: '光环内所有塔无视任何气球免疫属性，每波产出巨额资金！', grantMIB: true, incomeAdd: 180, buffFireRate: 1.48 }
    ]
  }
};

export const ABILITIES = {
  meteor: {
    id: 'meteor',
    hotkey: 'Q',
    name: '天基陨石雨',
    icon: '☄️',
    cooldown: 32,
    desc: '召唤多颗炽热陨石轰炸全图进度最靠前的密集气球群'
  },
  frostNova: {
    id: 'frostNova',
    hotkey: 'W',
    name: '全图极寒冰封',
    icon: '🧊',
    cooldown: 28,
    desc: '冻结全图普通气球 4 秒，并令飞艇大幅减速 50%'
  },
  overclock: {
    id: 'overclock',
    hotkey: 'E',
    name: '全军超频狂暴',
    icon: '🔥',
    cooldown: 35,
    desc: '全图所有防御塔攻击速度提升 75%，持续 7 秒'
  }
};

export const MAPS = {
  meadow: {
    id: 'meadow',
    name: '翠绿风车牧场',
    difficulty: '新手推荐',
    theme: 'meadow',
    skyColor: 0x7dd3fc,
    groundColor: 0x56b841,
    roadColor: 0xd4b98c,
    waterColor: 0x0ea5e9,
    startCash: 650,
    startLives: 120,
    waypoints: [
      [-16.4, 0, -5.2],
      [-10.2, 0, -5.2],
      [-9.8, 0, 5.2],
      [-3.5, 0, 5.2],
      [-3.2, 0, -5.6],
      [3.4, 0, -5.6],
      [3.8, 0, 5.4],
      [10.2, 0, 5.4],
      [10.6, 0, -3.4],
      [16.4, 0, -3.4]
    ]
  },
  volcano: {
    id: 'volcano',
    name: '熔岩黑曜峡谷',
    difficulty: '进阶挑战',
    theme: 'volcano',
    skyColor: 0x2b1825,
    groundColor: 0x3b3238,
    roadColor: 0x63555d,
    waterColor: 0xff521b,
    startCash: 680,
    startLives: 100,
    waypoints: [
      [-16.4, 0, 5.8],
      [-10.6, 0, 5.8],
      [-10.2, 0, -6.0],
      [2.2, 0, -6.0],
      [2.5, 0, 0.8],
      [-4.2, 0, 0.8],
      [-4.2, 0, 6.4],
      [9.8, 0, 6.4],
      [10.2, 0, -4.4],
      [16.4, 0, -4.4]
    ]
  },
  glacier: {
    id: 'glacier',
    name: '极光冰雪海湾',
    difficulty: '高手试炼',
    theme: 'glacier',
    skyColor: 0x93c5fd,
    groundColor: 0xdbeafe,
    roadColor: 0x8395a7,
    waterColor: 0x0284c7,
    startCash: 700,
    startLives: 100,
    waypoints: [
      [-16.4, 0, 4.4],
      [-10.8, 0, -5.8],
      [-3.6, 0, -5.8],
      [-3.2, 0, 5.6],
      [4.0, 0, 5.6],
      [4.4, 0, -5.8],
      [11.0, 0, -5.8],
      [11.4, 0, 4.2],
      [16.4, 0, 4.2]
    ]
  }
};

export const WEATHER_TYPES = {
  clear: {
    id: 'clear',
    name: '晴朗微风',
    icon: '☀️',
    color: 0xfef08a,
    buffText: '全塔射程 +6%',
    vy: 0.45,
    vx: 0.55,
    size: 0.16,
    opacity: 0.55
  },
  rain: {
    id: 'rain',
    name: '雷暴骤雨',
    icon: '🌧️',
    color: 0x7dd3fc,
    buffText: '电系/冰系攻速 +15%',
    vy: -13.5,
    vx: -2.2,
    size: 0.18,
    opacity: 0.62
  },
  snow: {
    id: 'snow',
    name: '极寒飘雪',
    icon: '❄️',
    color: 0xf8fafc,
    buffText: '气球移速 -8%',
    vy: -2.4,
    vx: 0.85,
    size: 0.21,
    opacity: 0.72
  },
  ember: {
    id: 'ember',
    name: '炽热星烬',
    icon: '🔥',
    color: 0xfb923c,
    buffText: '爆破/火系伤害 +15%',
    vy: 2.1,
    vx: 0.65,
    size: 0.19,
    opacity: 0.7
  }
};

