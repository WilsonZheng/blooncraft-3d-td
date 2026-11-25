export const RARITY_META = {
  rare: { label: '精良 · RARE', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.42)', weight: 58 },
  epic: { label: '史诗 · EPIC', color: '#c084fc', glow: 'rgba(192, 132, 252, 0.48)', weight: 30 },
  legendary: { label: '传说 · LEGENDARY', color: '#facc15', glow: 'rgba(250, 204, 21, 0.55)', weight: 12 }
};

export const AUGMENT_CARDS = [
  {
    id: 'tungsten_tips',
    name: '钨芯致命弹头',
    icon: '🎯',
    rarity: 'rare',
    tag: '暴击流',
    desc: '全图防御塔获得 +18% 暴击率，暴击造成 2.2 倍伤害并迸发金色星芒！',
    stackable: true
  },
  {
    id: 'aerodynamic_fletch',
    name: '疾风破甲羽',
    icon: '🏹',
    rarity: 'rare',
    tag: '物理强化',
    desc: '【飞镖射手】与【暗影忍者】穿透上限 +2，攻击速度 +18%。',
    stackable: true
  },
  {
    id: 'bounty_protocol',
    name: '赏金猎人契约',
    icon: '💰',
    rarity: 'rare',
    tag: '经济发育',
    desc: '立即获得 $180 军费，且此后每波通关额外发放 +$65 赏金。',
    stackable: true
  },
  {
    id: 'reinforced_barricade',
    name: '圣盾紧急加固',
    icon: '🛡️',
    rarity: 'rare',
    tag: '防线生存',
    desc: '立即恢复并增加 +35 点生命值，并在终点额外部署 8 簇防漏路钉！',
    stackable: true
  },
  {
    id: 'highland_mastery',
    name: '高台战术专精',
    icon: '🏔️',
    rarity: 'rare',
    tag: '地形增益',
    desc: '岩石战术高台的射程与伤害加成从 +15% 大幅提升至 +32%！',
    stackable: false
  },
  {
    id: 'rapid_capacitor',
    name: '速射电容矩阵',
    icon: '🔋',
    rarity: 'rare',
    tag: '全局攻速',
    desc: '全图所有防御塔攻击速度永久提升 +14%。',
    stackable: true
  },
  {
    id: 'chain_detonation',
    name: '爆破连锁核心',
    icon: '💥',
    rarity: 'epic',
    tag: '清群爽感',
    desc: '任意气球被击破时有 24% 概率触发范围殉爆，对周围敌人造成 4 点爆炸伤害！',
    stackable: true
  },
  {
    id: 'permafrost_shatter',
    name: '极寒碎冰印记',
    icon: '❄️',
    rarity: 'epic',
    tag: '冰控易伤',
    desc: '【冰霜新星塔】射程 +22%，冻结或减速敌人时额外附加 +2 点脆弱易伤！',
    stackable: false
  },
  {
    id: 'thunder_conduit',
    name: '九霄雷暴导管',
    icon: '⚡',
    rarity: 'epic',
    tag: '连锁雷电',
    desc: '【磁暴电塔】闪电跳跃目标 +4，电弧伤害永久提升 +35%！',
    stackable: true
  },
  {
    id: 'titan_slayer',
    name: '泰坦巨兽克星',
    icon: '🦖',
    rarity: 'epic',
    tag: '飞艇特攻',
    desc: '所有防御塔对 MOAB / BFB / DDT / ZOMG 巨型飞艇伤害额外 +35%！',
    stackable: true
  },
  {
    id: 'chrono_matrix',
    name: '时空冷却矩阵',
    icon: '⏳',
    rarity: 'epic',
    tag: '大招流',
    desc: '三大主动支援大招冷却时间永久缩短 28%，并立即重置当前冷却！',
    stackable: false
  },
  {
    id: 'midas_syndicate',
    name: '点金财团特许',
    icon: '🏛️',
    rarity: 'epic',
    tag: '科技折扣',
    desc: '所有【黄金信标】每波额外产出 +$90，且升级/合体费用永久降低 12%！',
    stackable: false
  },
  {
    id: 'shadow_clone_scroll',
    name: '影分身多重秘卷',
    icon: '🥷',
    rarity: 'legendary',
    tag: '传说弹幕',
    desc: '【飞镖射手】、【暗影忍者】与【重型火炮】每次开火额外多发射 +1 枚弹体！',
    stackable: true
  },
  {
    id: 'apocalypse_meteor',
    name: '末日天星圣物',
    icon: '☄️',
    rarity: 'legendary',
    tag: '毁天灭地',
    desc: '【Q 天基陨石雨】陨石数量 +3、轰炸伤害提升 85%，并延长熔岩灼烧！',
    stackable: false
  },
  {
    id: 'gene_overdrive',
    name: '神装基因超载',
    icon: '🧬',
    rarity: 'legendary',
    tag: '终极觉醒',
    desc: '全图所有塔伤害 +22%；已【吞并合体】的神装塔攻速再额外暴涨 +30%！',
    stackable: false
  },
  {
    id: 'royal_airdrop',
    name: '皇家战略空投',
    icon: '👑',
    rarity: 'legendary',
    tag: '传说补给',
    desc: '立即空投 +$520 巨额战略资金，且全图所有防御塔射程永久 +12%！',
    stackable: true
  }
];

export function rollDraftOptions(ownedCardIds = [], wave = 1) {
  const ownedSet = new Set(ownedCardIds);
  const pool = AUGMENT_CARDS.filter((c) => c.stackable || !ownedSet.has(c.id));
  const chosen = [];
  const candidates = [...pool];

  while (chosen.length < 3 && candidates.length > 0) {
    // Boost epic/legendary odds slightly in later waves!
    const weights = candidates.map((c) => {
      let w = RARITY_META[c.rarity]?.weight || 30;
      if (wave >= 12 && c.rarity === 'epic') w += 12;
      if (wave >= 15 && c.rarity === 'legendary') w += 10;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pickIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pickIdx = i;
        break;
      }
    }
    chosen.push(candidates.splice(pickIdx, 1)[0]);
  }
  return chosen;
}
