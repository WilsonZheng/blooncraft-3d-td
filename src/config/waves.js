// 30 Hand-crafted Campaign Waves + Procedural Endless Waves (31+)
// Group schema: { type, count, spacing, delay, camo, regrow, fortified }

export const CAMPAIGN_WAVES = [
  // Wave 1
  {
    wave: 1,
    bonus: 95,
    hint: '欢迎来到 3D 气球防线！在弯道内侧部署飞镖射手或八方钉塔吧。',
    groups: [
      { type: 'red', count: 16, spacing: 0.72, delay: 0 }
    ]
  },
  // Wave 2
  {
    wave: 2,
    bonus: 100,
    hint: '密集红气球群来袭，穿透属性高的塔效率极佳！',
    groups: [
      { type: 'red', count: 28, spacing: 0.52, delay: 0 }
    ]
  },
  // Wave 3
  {
    wave: 3,
    bonus: 105,
    hint: '蓝气球内含一层红气球，移动速度更快！',
    groups: [
      { type: 'red', count: 12, spacing: 0.55, delay: 0 },
      { type: 'blue', count: 8, spacing: 0.70, delay: 2.5 },
      { type: 'red', count: 10, spacing: 0.48, delay: 6.0 }
    ]
  },
  // Wave 4
  {
    wave: 4,
    bonus: 110,
    hint: '蓝红混合冲锋，注意补足火力覆盖！',
    groups: [
      { type: 'blue', count: 18, spacing: 0.55, delay: 0 },
      { type: 'red', count: 18, spacing: 0.35, delay: 3.0 }
    ]
  },
  // Wave 5
  {
    wave: 5,
    bonus: 118,
    hint: '绿气球登场（3层生命），适合升级防御塔提升伤害！',
    groups: [
      { type: 'blue', count: 14, spacing: 0.5, delay: 0 },
      { type: 'green', count: 10, spacing: 0.68, delay: 2.8 }
    ]
  },
  // Wave 6
  {
    wave: 6,
    bonus: 125,
    hint: '绿蓝交替攻势！可考虑建造黄金信标工坊提前积累经济。',
    groups: [
      { type: 'green', count: 14, spacing: 0.58, delay: 0 },
      { type: 'blue', count: 20, spacing: 0.42, delay: 3.5 }
    ]
  },
  // Wave 7
  {
    wave: 7,
    bonus: 132,
    hint: '⚡ 高速黄气球出现！极寒冰晶塔可有效减速快攻。',
    groups: [
      { type: 'green', count: 15, spacing: 0.5, delay: 0 },
      { type: 'yellow', count: 8, spacing: 0.65, delay: 4.0 }
    ]
  },
  // Wave 8
  {
    wave: 8,
    bonus: 140,
    hint: '👁️ 警告：首批【迷彩气球】潜入！需【暗影忍者】、升级夜视狙击或反隐雷达！',
    groups: [
      { type: 'green', count: 12, spacing: 0.55, delay: 0 },
      { type: 'green', count: 8, spacing: 0.85, delay: 2.5, camo: true },
      { type: 'yellow', count: 10, spacing: 0.58, delay: 6.0 }
    ]
  },
  // Wave 9
  {
    wave: 9,
    bonus: 148,
    hint: '💚 再生气球登场！若未及时彻底击破，它们会自动恢复外层！',
    groups: [
      { type: 'green', count: 20, spacing: 0.42, delay: 0, regrow: true },
      { type: 'pink', count: 6, spacing: 0.65, delay: 4.5 }
    ]
  },
  // Wave 10
  {
    wave: 10,
    bonus: 165,
    hint: '🛡️ 警告：【铁皮气球】免疫普通飞镖！请使用重炮、狙击、雷电或烈焰火环破甲！',
    groups: [
      { type: 'yellow', count: 16, spacing: 0.48, delay: 0 },
      { type: 'lead', count: 5, spacing: 1.35, delay: 2.5 },
      { type: 'pink', count: 10, spacing: 0.52, delay: 6.5 }
    ]
  },
  // Wave 11
  {
    wave: 11,
    bonus: 165,
    hint: '🔮 紫电护盾球登场！免疫闪电与火焰，请用飞镖、忍者、重炮或狙击物理击破！',
    groups: [
      { type: 'pink', count: 14, spacing: 0.44, delay: 0 },
      { type: 'purple', count: 8, spacing: 0.62, delay: 2.2 },
      { type: 'yellow', count: 14, spacing: 0.4, delay: 4.5, camo: true }
    ]
  },
  // Wave 12
  {
    wave: 12,
    bonus: 175,
    hint: '🦓 斑马双生球来袭：同时免疫爆炸与冰冻，多系防线协同破敌！',
    groups: [
      { type: 'black', count: 8, spacing: 0.65, delay: 0 },
      { type: 'white', count: 8, spacing: 0.65, delay: 1.8 },
      { type: 'zebra', count: 6, spacing: 0.85, delay: 3.8 },
      { type: 'lead', count: 5, spacing: 1.1, delay: 6.0 }
    ]
  },
  // Wave 13
  {
    wave: 13,
    bonus: 185,
    hint: '🌈 彩虹气球来袭，击破后会分裂出双倍斑马与黑白子气球！',
    groups: [
      { type: 'pink', count: 18, spacing: 0.38, delay: 0, regrow: true },
      { type: 'rainbow', count: 5, spacing: 1.0, delay: 3.8 }
    ]
  },
  // Wave 14
  {
    wave: 14,
    bonus: 195,
    hint: '紫电护盾与迷彩粉气球高速混编突袭！',
    groups: [
      { type: 'lead', count: 7, spacing: 0.9, delay: 0 },
      { type: 'purple', count: 10, spacing: 0.5, delay: 2.2, camo: true },
      { type: 'rainbow', count: 6, spacing: 0.85, delay: 5.5 }
    ]
  },
  // Wave 15
  {
    wave: 15,
    bonus: 220,
    hint: '🏺 精英预警：【陶瓷气球】拥有坚硬外壳，击碎后还会爆出双倍彩虹气球！',
    groups: [
      { type: 'ceramic', count: 5, spacing: 1.4, delay: 0 },
      { type: 'zebra', count: 10, spacing: 0.65, delay: 3.5 }
    ]
  },
  // Wave 16
  {
    wave: 16,
    bonus: 220,
    hint: '密集再生斑马与彩虹潮！连锁闪电与范围灼烧效果拔群！',
    groups: [
      { type: 'rainbow', count: 11, spacing: 0.6, delay: 0, regrow: true },
      { type: 'lead', count: 10, spacing: 0.7, delay: 4.0, regrow: true }
    ]
  },
  // Wave 17
  {
    wave: 17,
    bonus: 235,
    hint: '迷彩陶瓷潜入！可将狙击塔或重炮索敌模式切换为【最强 (Strong)】。',
    groups: [
      { type: 'ceramic', count: 6, spacing: 1.15, delay: 0 },
      { type: 'ceramic', count: 4, spacing: 1.35, delay: 3.5, camo: true },
      { type: 'purple', count: 16, spacing: 0.34, delay: 5.5 }
    ]
  },
  // Wave 18
  {
    wave: 18,
    bonus: 250,
    hint: '超密集气球海测试你的群体穿透极限！必要时释放 Q/W/E 主动技能！',
    groups: [
      { type: 'yellow', count: 40, spacing: 0.17, delay: 0 },
      { type: 'purple', count: 14, spacing: 0.35, delay: 2.2 },
      { type: 'ceramic', count: 7, spacing: 0.95, delay: 4.0 }
    ]
  },
  // Wave 19
  {
    wave: 19,
    bonus: 275,
    hint: '🚨 决战前夕：迷彩铁皮气球登场！升级反隐雷电、夜视狙击或情报局信标！',
    groups: [
      { type: 'lead', count: 8, spacing: 0.85, delay: 0, camo: true },
      { type: 'ceramic', count: 9, spacing: 0.85, delay: 3.5, regrow: true }
    ]
  },
  // Wave 20 - BOSS!
  {
    wave: 20,
    bonus: 420,
    isBoss: true,
    hint: '🛸 BOSS 降临：【MOAB 巨型蓝艇】登场！集火船体，小心它解体爆出的 4 颗陶瓷气球！',
    groups: [
      { type: 'moab', count: 1, spacing: 2.0, delay: 0.5 },
      { type: 'lead', count: 8, spacing: 0.75, delay: 4.5 }
    ]
  },
  // Wave 21
  {
    wave: 21,
    bonus: 290,
    hint: '飞艇击退后不可掉以轻心，强化陶瓷军团压境！',
    groups: [
      { type: 'ceramic', count: 12, spacing: 0.7, delay: 0, fortified: true },
      { type: 'zebra', count: 22, spacing: 0.35, delay: 3.5, camo: true }
    ]
  },
  // Wave 22
  {
    wave: 22,
    bonus: 310,
    hint: '双飞艇护航编队来袭！飞艇粉碎炮与重创狙击大显神威！',
    groups: [
      { type: 'moab', count: 2, spacing: 3.6, delay: 0 },
      { type: 'ceramic', count: 9, spacing: 0.65, delay: 2.5 }
    ]
  },
  // Wave 23
  {
    wave: 23,
    bonus: 330,
    hint: '极速紫电与迷彩再生冲锋！',
    groups: [
      { type: 'purple', count: 28, spacing: 0.2, delay: 0, camo: true },
      { type: 'lead', count: 14, spacing: 0.55, delay: 3.0, camo: true }
    ]
  },
  // Wave 24
  {
    wave: 24,
    bonus: 350,
    hint: '三艘 MOAB 飞艇连续压境！善用全军超频（E）瞬间拉满 DPS！',
    groups: [
      { type: 'moab', count: 3, spacing: 2.8, delay: 0 },
      { type: 'ceramic', count: 12, spacing: 0.52, delay: 3.0 }
    ]
  },
  // Wave 25
  {
    wave: 25,
    bonus: 390,
    hint: '钢铁洪流：重甲强化飞艇与铁皮陶瓷混编！',
    groups: [
      { type: 'moab', count: 2, spacing: 2.8, delay: 0, fortified: true },
      { type: 'lead', count: 16, spacing: 0.4, delay: 2.0, fortified: true },
      { type: 'ceramic', count: 14, spacing: 0.5, delay: 5.0, camo: true }
    ]
  },
  // Wave 26 - DDT Debut!
  {
    wave: 26,
    bonus: 430,
    isBoss: true,
    hint: '👻 幽灵警报：【DDT 隐形喷气艇】高速突袭！兼具迷彩与铁皮属性，务必开启反隐破甲！',
    groups: [
      { type: 'ddt', count: 1, spacing: 3.0, delay: 0.8 },
      { type: 'ceramic', count: 18, spacing: 0.3, delay: 3.2 },
      { type: 'purple', count: 18, spacing: 0.28, delay: 5.5 }
    ]
  },
  // Wave 27
  {
    wave: 27,
    bonus: 440,
    hint: '五艘 MOAB 空中舰队集群突击！',
    groups: [
      { type: 'moab', count: 5, spacing: 2.1, delay: 0 },
      { type: 'rainbow', count: 24, spacing: 0.25, delay: 2.5, regrow: true }
    ]
  },
  // Wave 28
  {
    wave: 28,
    bonus: 480,
    hint: '双幽灵 DDT 编队 + 重甲飞艇双重施压！',
    groups: [
      { type: 'ddt', count: 2, spacing: 3.2, delay: 0.5 },
      { type: 'moab', count: 3, spacing: 2.2, delay: 2.5, fortified: true },
      { type: 'ceramic', count: 16, spacing: 0.38, delay: 4.0, camo: true }
    ]
  },
  // Wave 29
  {
    wave: 29,
    bonus: 540,
    hint: '终局前奏：BFB 毁灭红艇先锋舰压境！把核心输出升至终极形态吧！',
    groups: [
      { type: 'bfb', count: 1, spacing: 3.0, delay: 0.5 },
      { type: 'moab', count: 4, spacing: 1.8, delay: 3.5 },
      { type: 'ddt', count: 1, spacing: 2.5, delay: 6.0 }
    ]
  },
  // Wave 30 - FINAL CAMPAIGN TITAN BOSS
  {
    wave: 30,
    bonus: 1100,
    isBoss: true,
    hint: '👑 终极泰坦降临：【ZOMG 翡翠泰坦母舰】携幽灵护卫决战！倾尽所有大招与神装火力！',
    groups: [
      { type: 'zomg', count: 1, spacing: 4.0, delay: 0.8 },
      { type: 'ddt', count: 2, spacing: 3.2, delay: 5.5 },
      { type: 'ceramic', count: 16, spacing: 0.4, delay: 3.5, camo: true }
    ]
  }
];

export function getWaveConfig(waveNum) {
  if (waveNum <= CAMPAIGN_WAVES.length) {
    return CAMPAIGN_WAVES[waveNum - 1];
  }
  // Procedural Endless Freeplay (Wave 31+)
  const extra = waveNum - 30;
  const hpScale = 1 + extra * 0.16;
  const speedScale = Math.min(1.85, 1 + extra * 0.025);
  const zomgCount = Math.max(1, Math.floor(0.6 + extra * 0.35));
  const ddtCount = Math.floor(2 + extra * 0.65);
  const bfbCount = Math.max(1, Math.floor(1 + extra * 0.4));

  return {
    wave: waveNum,
    bonus: 500 + extra * 40,
    isBoss: waveNum % 5 === 0,
    hpScale,
    speedScale,
    hint: `♾️ 无尽自由模式 第 ${waveNum} 波：泰坦与幽灵舰队血量 ${(hpScale * 100).toFixed(0)}%，挑战极限神话！`,
    groups: [
      { type: 'zomg', count: zomgCount, spacing: Math.max(2.2, 4.2 - extra * 0.08), delay: 0.5, fortified: extra >= 5 },
      { type: 'bfb', count: bfbCount, spacing: Math.max(1.5, 3.0 - extra * 0.06), delay: 2.2, fortified: waveNum % 2 === 0 },
      { type: 'ddt', count: ddtCount, spacing: Math.max(0.9, 2.0 - extra * 0.04), delay: 3.5 }
    ]
  };
}
