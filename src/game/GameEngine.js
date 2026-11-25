import * as THREE from 'three';
import { BLOON_TYPES, TOWER_TYPES, ABILITIES, MAPS, WEATHER_TYPES } from '../config/constants.js';
import { AUGMENT_CARDS, RARITY_META, rollDraftOptions } from '../config/cards.js';
import { getWaveConfig } from '../config/waves.js';
import { BloonMeshFactory } from '../entities/BloonMeshFactory.js';
import { TowerMeshFactory } from '../entities/TowerMeshFactory.js';
import { MapBuilder } from '../world/MapBuilder.js';

let NEXT_ID = 1;

const DEFAULT_SETTINGS = {
  masterVol: 0.85,
  bgmVol: 0.42,
  sfxVol: 0.85,
  bgmEnabled: true,
  bloomEnabled: true,
  screenShake: true,
  floatingText: true,
  weatherParticles: true,
  autoPauseOnDraft: true,
  autoCollectCoins: false
};

export const META_TECH_DEFS = [
  { id: 'startCash', icon: '💰', name: '皇家军费储备', desc: '每级使所有地图开局初始金币 +$45', maxLv: 5 },
  { id: 'startLives', icon: '🛡️', name: '圣盾城墙加固', desc: '每级使所有地图初始生命护盾 +15', maxLv: 5 },
  { id: 'critDamage', icon: '💥', name: '弱点暴击精研', desc: '每级使全军暴击伤害倍率额外 +15%', maxLv: 5 },
  { id: 'abilityHaste', icon: '⚡', name: '星轨大招充能', desc: '每级使三大主动大招冷却时间缩短 6%', maxLv: 5 },
  { id: 'relicLuck', icon: '🎖️', name: '秘宝统帅学识', desc: '每级使波次结算赏金 +$20 且指挥官经验获取 +15%', maxLv: 5 }
];

const DEFAULT_META = {
  gems: 3,
  upgrades: {
    startCash: 0,
    startLives: 0,
    critDamage: 0,
    abilityHaste: 0,
    relicLuck: 0
  }
};

export class GameEngine {
  constructor({ scene, camera, effects, sound, onStateChange, onToast, onSettingsChange }) {
    this.scene = scene;
    this.camera = camera;
    this.effects = effects;
    this.sound = sound;
    this.onStateChange = onStateChange || (() => {});
    this.onToast = onToast || (() => {});
    this.onSettingsChange = onSettingsChange || (() => {});

    this.bloonFactory = new BloonMeshFactory();
    this.towerFactory = new TowerMeshFactory();
    this.mapBuilder = new MapBuilder();

    this.projGeo = new THREE.SphereGeometry(0.17, 8, 8);
    this.coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 14);
    this.coinGeo.rotateX(Math.PI / 2);

    this.mapData = null;
    this.currentMapId = 'meadow';
    this.currentWeather = 'clear';

    this.cash = 650;
    this.lives = 120;
    this.wave = 0;
    this.totalPops = 0;
    this.score = 0;

    this.waveActive = false;
    this.autoStart = false;
    this.gameSpeed = 1;
    this.gameOver = false;
    this.victory = false;
    this.freeplay = false;
    this.feverGauge = 0;
    this.feverTimer = 0;
    this.bountyArmed = false;
    this.bountyWaveActive = false;

    this.bloons = [];
    this.towers = [];
    this.projectiles = [];
    this.coins = [];
    this.supplyCrates = [];
    this.lavaZones = [];
    this.ballLightnings = [];
    this.roadSpikes = [];
    this.spawnQueues = [];
    this.waveElapsed = 0;

    this.overclockTimer = 0;
    this.abilityCooldowns = { meteor: 0, frostNova: 0, overclock: 0 };

    this.selectedTowerId = null;
    this.placingType = null;

    // Selection & placement 3D indicators
    this.rangeRing = this._createRangeRing(0x38bdf8);
    this.scene.add(this.rangeRing);

    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;
    this.ghostRangeRing = this._createRangeRing(0x22c55e);
    this.ghostGroup.add(this.ghostRangeRing);
    this.scene.add(this.ghostGroup);

    // Onboarding 3D bend guide pads + Beacon synergy link lines
    this.guidePadsGroup = new THREE.Group();
    this.scene.add(this.guidePadsGroup);
    this.synergyLinesGroup = new THREE.Group();
    this.scene.add(this.synergyLinesGroup);
    this.synergyLineMat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 });

    // Pooled 1-Draw-Call 3D Atmospheric Weather Particle Field (non-obstructing!)
    this._initWeatherSystem();

    this.meta = this._loadMeta();
    this.metaMods = this._computeMetaMods();
    this.settings = this._loadSettings();
    this._applySettings();

    this.loadMap('meadow');
  }

  _loadMeta() {
    try {
      const raw = localStorage.getItem('blooncraft_meta_v3');
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_META));
      const parsed = JSON.parse(raw);
      return {
        gems: Math.max(0, Number(parsed.gems ?? 3)),
        upgrades: { ...DEFAULT_META.upgrades, ...(parsed.upgrades || {}) }
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_META));
    }
  }

  _saveMeta() {
    try {
      localStorage.setItem('blooncraft_meta_v3', JSON.stringify(this.meta));
    } catch {
      // Ignore storage errors
    }
  }

  _computeMetaMods() {
    const u = this.meta?.upgrades || DEFAULT_META.upgrades;
    return {
      startCashAdd: (u.startCash || 0) * 45,
      startLivesAdd: (u.startLives || 0) * 15,
      critDmgMul: 2.0 + (u.critDamage || 0) * 0.15,
      abilityCdMul: Math.pow(0.94, u.abilityHaste || 0),
      waveBonusAdd: (u.relicLuck || 0) * 20,
      xpMul: 1.0 + (u.relicLuck || 0) * 0.15
    };
  }

  getMetaUpgradeCost(techId) {
    const lv = this.meta?.upgrades?.[techId] || 0;
    return 2 + lv * 2;
  }

  addStarGems(amount, reason = '') {
    if (amount <= 0) return;
    this.meta.gems = (this.meta.gems || 0) + amount;
    this._saveMeta();
    if (reason) {
      this.onToast(`💎 获得 +${amount} 星辉晶石（${reason}）！可在【科技】永久强化全军！`, 'info');
    }
    this.notifyState();
  }

  buyMetaUpgrade(techId) {
    const def = META_TECH_DEFS.find((d) => d.id === techId);
    if (!def) return false;
    const lv = this.meta.upgrades[techId] || 0;
    if (lv >= def.maxLv) return false;
    const cost = this.getMetaUpgradeCost(techId);
    if ((this.meta.gems || 0) < cost) {
      this.onToast(`💎 星辉晶石不足（需 ${cost} 颗），通关波次或开启悬赏挑战可赢取晶石！`, 'warn');
      return false;
    }
    this.meta.gems -= cost;
    this.meta.upgrades[techId] = lv + 1;
    this._saveMeta();
    this.metaMods = this._computeMetaMods();

    // Immediately grant bonus if currently in current match!
    if (techId === 'startCash') this.cash += 45;
    if (techId === 'startLives') this.lives += 15;
    this._recomputeSupportAuras();
    this.sound?.playCardDraft?.('epic');
    this.onToast(`💎 永久科技升级：【${def.name}】升至 Lv.${lv + 1}！`, 'info');
    this.notifyState();
    return true;
  }

  toggleBountyContract() {
    if (this.waveActive || this.gameOver) {
      this.onToast('⚠️ 请在每波发兵前切换【恶魔悬赏契约】！', 'warn');
      return false;
    }
    this.bountyArmed = !this.bountyArmed;
    this.sound?.playPlace?.(this.bountyArmed);
    if (this.bountyArmed) {
      this.onToast('⚔️ 已签署下波【恶魔悬赏契约】：敌军强化，通关享 +65% 赏金 + 双倍经验 + 2💎晶石！', 'boss');
    } else {
      this.onToast('已取消下波悬赏挑战契约。', 'info');
    }
    this.notifyState();
    return this.bountyArmed;
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem('blooncraft_settings_v3');
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  _applySettings() {
    const s = this.settings || DEFAULT_SETTINGS;
    if (this.sound?.setSettings) {
      this.sound.setSettings({
        masterVol: s.masterVol,
        bgmVol: s.bgmVol,
        sfxVol: s.sfxVol,
        bgmEnabled: s.bgmEnabled
      });
    }
    if (this.effects) {
      this.effects.enableShake = Boolean(s.screenShake);
      this.effects.enableFloatingText = Boolean(s.floatingText);
    }
    if (this.weatherPoints) {
      this.weatherPoints.visible = Boolean(s.weatherParticles);
    }
    this.onSettingsChange(s);
  }

  updateSettings(patch = {}) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem('blooncraft_settings_v3', JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
    this._applySettings();
    this.notifyState();
    return this.settings;
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      localStorage.setItem('blooncraft_settings_v3', JSON.stringify(this.settings));
    } catch {
      // Ignore
    }
    this._applySettings();
    this.notifyState();
    return this.settings;
  }

  _initWeatherSystem() {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 11 + 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.weatherPoints.frustumCulled = false;
    this.scene.add(this.weatherPoints);
  }

  setWeather(weatherId, announce = false) {
    const w = WEATHER_TYPES[weatherId] || WEATHER_TYPES.clear;
    this.currentWeather = w.id;
    if (this.weatherMat) {
      this.weatherMat.color.setHex(w.color);
      this.weatherMat.size = w.size;
      this.weatherMat.opacity = w.opacity;
    }
    this._recomputeSupportAuras();
    if (announce) {
      this.onToast(`${w.icon} 天气变化：【${w.name}】(${w.buffText})`, 'info');
    }
    this.notifyState();
  }

  _createRangeRing(color) {
    const geo = new THREE.RingGeometry(0.97, 1.0, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const fillGeo = new THREE.CircleGeometry(1.0, 48);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.11,
      depthWrite: false
    });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(geo, mat);
    const fill = new THREE.Mesh(fillGeo, fillMat);
    g.add(fill);
    g.add(ring);
    g.position.y = 0.08;
    g.visible = false;
    g.userData = { mat, fillMat };
    return g;
  }

  loadMap(mapId) {
    this.clearEntities();
    if (this.mapData?.group) {
      this.scene.remove(this.mapData.group);
      const geos = new Set();
      const mats = new Set();
      this.mapData.group.traverse((obj) => {
        if (obj.geometry) geos.add(obj.geometry);
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => mats.add(m));
          else mats.add(obj.material);
        }
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    }

    const mapDef = MAPS[mapId] || MAPS.meadow;
    this.currentMapId = mapDef.id;
    this.scene.background = new THREE.Color(mapDef.skyColor);
    this.scene.fog = new THREE.FogExp2(mapDef.skyColor, 0.011);

    this.mapData = this.mapBuilder.build(mapDef);
    this.scene.add(this.mapData.group);

    this.metaMods = this._computeMetaMods();
    this.cash = mapDef.startCash + (this.metaMods.startCashAdd || 0);
    this.lives = mapDef.startLives + (this.metaMods.startLivesAdd || 0);
    this.wave = 0;
    this.totalPops = 0;
    this.score = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMilestones = new Set();
    this.waveActive = false;
    this.gameOver = false;
    this.victory = false;
    this.freeplay = false;
    this.overclockTimer = 0;
    this.feverGauge = 0;
    this.feverTimer = 0;
    this.bountyArmed = false;
    this.bountyWaveActive = false;
    this.evolutionPhase = 0;
    this.abilityCooldowns = { meteor: 0, frostNova: 0, overclock: 0 };
    this.commanderLevel = 1;
    this.commanderXp = 0;
    this.commanderNextXp = 120;
    this.activeCards = [];
    this.pendingDrafts = 0;
    this.currentDraftChoices = [];
    this.cardMods = this._computeCardMods();
    this.selectedTowerId = null;
    this.setPlacingTower(null);

    // Spawn starter exit road spikes (like BTD6 Mana Shield / Pre-Game Prep!)
    this._spawnExitSpikes(5);
    this._buildGuidePads();
    const initWeather = mapDef.theme === 'volcano' ? 'ember' : (mapDef.theme === 'glacier' ? 'snow' : 'clear');
    this.setWeather(initWeather, false);
    this.notifyState();
  }

  _computeCardMods() {
    const mods = {
      critChance: 0,
      dartNinjaPierce: 0,
      dartNinjaRate: 0,
      waveBonusAdd: 0,
      highGroundBonus: 0.15,
      globalRateMul: 1.0,
      globalDmgMul: 1.0,
      globalRangeMul: 1.0,
      explodeOnPopChance: 0,
      frostRangeMul: 1.0,
      frostBrittleAdd: 0,
      teslaChainAdd: 0,
      teslaDmgMul: 1.0,
      moabDmgAdd: 0,
      abilityCdMul: 1.0,
      beaconIncomeAdd: 0,
      costDiscount: 1.0,
      extraProj: 0,
      apocalypseMeteor: false,
      apexRateBonus: 0
    };
    for (const c of this.activeCards || []) {
      const n = c.count || 1;
      switch (c.id) {
        case 'tungsten_tips':
          mods.critChance += 0.18 * n;
          break;
        case 'aerodynamic_fletch':
          mods.dartNinjaPierce += 2 * n;
          mods.dartNinjaRate += 0.18 * n;
          break;
        case 'bounty_protocol':
          mods.waveBonusAdd += 65 * n;
          break;
        case 'highland_mastery':
          mods.highGroundBonus = 0.32;
          break;
        case 'rapid_capacitor':
          mods.globalRateMul *= Math.pow(1.14, n);
          break;
        case 'chain_detonation':
          mods.explodeOnPopChance = Math.min(0.65, mods.explodeOnPopChance + 0.24 * n);
          break;
        case 'permafrost_shatter':
          mods.frostRangeMul = 1.22;
          mods.frostBrittleAdd = 2;
          break;
        case 'thunder_conduit':
          mods.teslaChainAdd += 4 * n;
          mods.teslaDmgMul *= Math.pow(1.35, n);
          break;
        case 'titan_slayer':
          mods.moabDmgAdd += 0.35 * n;
          break;
        case 'chrono_matrix':
          mods.abilityCdMul = 0.72;
          break;
        case 'midas_syndicate':
          mods.beaconIncomeAdd += 90;
          mods.costDiscount = 0.88;
          break;
        case 'shadow_clone_scroll':
          mods.extraProj += 1 * n;
          break;
        case 'apocalypse_meteor':
          mods.apocalypseMeteor = true;
          break;
        case 'gene_overdrive':
          mods.globalDmgMul *= 1.22;
          mods.apexRateBonus = 0.3;
          break;
        case 'royal_airdrop':
          mods.globalRangeMul *= Math.pow(1.12, n);
          break;
      }
    }
    return mods;
  }

  _gainCommanderXp(amount) {
    this.commanderXp += Math.round(amount * (this.metaMods?.xpMul || 1.0));
    let leveled = false;
    while (this.commanderXp >= this.commanderNextXp) {
      this.commanderXp -= this.commanderNextXp;
      this.commanderLevel += 1;
      this.commanderNextXp = Math.round(120 * Math.pow(1.38, this.commanderLevel - 1));
      this.cash += 45;
      leveled = true;
      if (this.commanderLevel % 3 === 0) {
        this.queueCardDraft(`🎖️ 指挥官晋升 Lv.${this.commanderLevel}`);
      } else {
        this.onToast(`🎖️ 指挥官升至 Lv.${this.commanderLevel}！(奖励 +$45)`, 'info');
      }
    }
    if (leveled) this.notifyState();
  }

  queueCardDraft(reason = '🎴 战术秘宝抽卡') {
    this.pendingDrafts += 1;
    if (this.currentDraftChoices.length === 0) {
      const owned = this.activeCards.map((c) => c.id);
      this.currentDraftChoices = rollDraftOptions(owned, Math.max(1, this.wave));
    }
    this.onToast(`${reason}：获得 1 次【战术秘宝三选一】机会！`, 'info');
    this.notifyState();
  }

  pickDraftCard(index) {
    if (this.pendingDrafts <= 0 || !this.currentDraftChoices[index]) return false;
    const card = this.currentDraftChoices[index];
    const existing = this.activeCards.find((c) => c.id === card.id);
    if (existing) {
      existing.count += 1;
    } else {
      this.activeCards.push({ ...card, count: 1 });
    }

    // Immediate one-shot card effects
    if (card.id === 'bounty_protocol') {
      this.cash += 180;
    } else if (card.id === 'reinforced_barricade') {
      this.lives += 35;
      this._spawnExitSpikes(8);
    } else if (card.id === 'chrono_matrix') {
      this.abilityCooldowns = { meteor: 0, frostNova: 0, overclock: 0 };
    } else if (card.id === 'royal_airdrop') {
      this.cash += 520;
    }

    this.cardMods = this._computeCardMods();
    this._recomputeSupportAuras();

    this.pendingDrafts = Math.max(0, this.pendingDrafts - 1);
    if (this.pendingDrafts > 0) {
      const owned = this.activeCards.map((c) => c.id);
      this.currentDraftChoices = rollDraftOptions(owned, Math.max(1, this.wave));
    } else {
      this.currentDraftChoices = [];
    }

    this.sound.playCardDraft(card.rarity);
    this.effects.spawnShockwave(new THREE.Vector3(0, 0.2, 0), 10, 0xfacc15, 0.45);
    this.onToast(`🎴 已激活战术秘宝：【${card.icon} ${card.name}】！`, 'info');
    this.notifyState();
    return true;
  }

  rerollDraftCards() {
    if (this.pendingDrafts <= 0) return false;
    const cost = 80;
    if (this.cash < cost) {
      this.onToast('金币不足 ($80)，无法刷新秘宝卡池！', 'warn');
      return false;
    }
    this.cash -= cost;
    const owned = this.activeCards.map((c) => c.id);
    this.currentDraftChoices = rollDraftOptions(owned, Math.max(1, this.wave));
    this.sound.playCoin();
    this.notifyState();
    return true;
  }

  _buildGuidePads() {
    while (this.guidePadsGroup.children.length > 0) {
      this.guidePadsGroup.remove(this.guidePadsGroup.children[0]);
    }
    const candidates = [];
    const hgPads = this.mapData?.highGroundPads || [];
    for (let x = -14.5; x <= 14.5; x += 1.35) {
      for (let z = -7.8; z <= 7.8; z += 1.35) {
        if (!this.canPlaceTower('dart', x, z)) continue;
        if (hgPads.some((p) => Math.hypot(p.x - x, p.z - z) < 2.25)) continue;
        let cov = 0;
        for (const pt of this.mapData.sampledPoints) {
          if (Math.hypot(pt.x - x, pt.z - z) <= 5.2) cov++;
        }
        candidates.push({ x, z, cov });
      }
    }
    candidates.sort((a, b) => b.cov - a.cov);
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= 4) break;
      if (!chosen.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 4.6)) {
        chosen.push(c);
      }
    }
    if (!this._guideRingGeo) {
      this._guideRingGeo = new THREE.RingGeometry(0.68, 0.92, 28);
      this._guideRingGeo.rotateX(-Math.PI / 2);
      this._guideInnerGeo = new THREE.CircleGeometry(0.45, 20);
      this._guideInnerGeo.rotateX(-Math.PI / 2);
      this._guideMat = new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide
      });
    }
    this._guideMat.color.setHex(this.currentMapId === 'glacier' ? 0x0284c7 : 0x22c55e);
    chosen.forEach((spot) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this._guideRingGeo, this._guideMat));
      g.add(new THREE.Mesh(this._guideInnerGeo, this._guideMat));
      g.position.set(spot.x, 0.06, spot.z);
      this.guidePadsGroup.add(g);
    });
    this.guidePadsGroup.visible = true;
  }

  getRecords() {
    try {
      return JSON.parse(localStorage.getItem('blooncraft_records_v1') || '{}');
    } catch {
      return {};
    }
  }

  _saveRecord() {
    try {
      const all = this.getRecords();
      const prev = all[this.currentMapId] || { bestWave: 0, bestScore: 0, victory: false };
      const updated = {
        bestWave: Math.max(prev.bestWave, this.wave),
        bestScore: Math.max(prev.bestScore, this.score),
        victory: Boolean(prev.victory || this.victory || this.freeplay)
      };
      all[this.currentMapId] = updated;
      localStorage.setItem('blooncraft_records_v1', JSON.stringify(all));
    } catch {
      // Ignore storage quota errors in restricted contexts
    }
  }

  _getSlotStorageKey(slotKey = 'auto') {
    return slotKey === 'auto' ? 'blooncraft_autosave_v3' : `blooncraft_save_slot_${slotKey}_v3`;
  }

  serializeSaveData() {
    const safeWave = this.waveActive ? Math.max(0, this.wave - 1) : this.wave;
    return {
      version: 3,
      savedAt: Date.now(),
      mapId: this.currentMapId,
      wave: safeWave,
      cash: Math.round(this.cash),
      lives: this.lives,
      score: this.score,
      totalPops: this.totalPops,
      freeplay: Boolean(this.freeplay),
      gameSpeed: this.gameSpeed || 1,
      autoStart: Boolean(this.autoStart),
      commanderLevel: this.commanderLevel || 1,
      commanderXp: this.commanderXp || 0,
      commanderNextXp: this.commanderNextXp || 120,
      evolutionPhase: this.evolutionPhase || 0,
      currentWeather: this.currentWeather || 'clear',
      activeCards: JSON.parse(JSON.stringify(this.activeCards || [])),
      pendingDrafts: this.pendingDrafts || 0,
      currentDraftChoices: JSON.parse(JSON.stringify(this.currentDraftChoices || [])),
      abilityCooldowns: { ...this.abilityCooldowns },
      feverGauge: Math.round(this.feverGauge || 0),
      bountyArmed: Boolean(this.bountyArmed),
      towers: this.towers.map((t) => ({
        type: t.type,
        x: Number(t.x.toFixed(3)),
        z: Number(t.z.toFixed(3)),
        baseY: t.baseY || 0,
        onHighGround: Boolean(t.onHighGround),
        tier: t.tier || 0,
        stars: t.stars || 0,
        isApex: Boolean(t.isApex),
        totalSpent: t.totalSpent || TOWER_TYPES[t.type]?.cost || 100,
        pops: t.pops || 0,
        targetMode: t.targetMode || 'first'
      }))
    };
  }

  loadSaveData(data, announce = true) {
    if (!data || typeof data !== 'object' || !MAPS[data.mapId] || !Array.isArray(data.towers)) {
      if (announce) this.onToast('❌ 存档数据格式无效或已损坏！', 'warn');
      return false;
    }

    this.loadMap(data.mapId);
    this.cash = Math.max(0, Number(data.cash ?? 650));
    this.lives = Math.max(1, Number(data.lives ?? 100));
    this.wave = Math.max(0, Number(data.wave ?? 0));
    this.score = Math.max(0, Number(data.score ?? 0));
    this.totalPops = Math.max(0, Number(data.totalPops ?? 0));
    this.freeplay = Boolean(data.freeplay);
    this.gameSpeed = [1, 2, 4].includes(data.gameSpeed) ? data.gameSpeed : 1;
    this.autoStart = Boolean(data.autoStart);
    this.commanderLevel = Math.max(1, Number(data.commanderLevel ?? 1));
    this.commanderXp = Math.max(0, Number(data.commanderXp ?? 0));
    this.commanderNextXp = Math.max(100, Number(data.commanderNextXp ?? 120));
    this.activeCards = Array.isArray(data.activeCards) ? data.activeCards : [];
    this.pendingDrafts = Math.max(0, Number(data.pendingDrafts ?? 0));
    this.currentDraftChoices = Array.isArray(data.currentDraftChoices) ? data.currentDraftChoices : [];
    if (this.pendingDrafts > 0 && this.currentDraftChoices.length === 0) {
      const owned = this.activeCards.map((c) => c.id);
      this.currentDraftChoices = rollDraftOptions(owned, Math.max(1, this.wave));
    }
    this.abilityCooldowns = {
      meteor: Math.max(0, Number(data.abilityCooldowns?.meteor ?? 0)),
      frostNova: Math.max(0, Number(data.abilityCooldowns?.frostNova ?? 0)),
      overclock: Math.max(0, Number(data.abilityCooldowns?.overclock ?? 0))
    };
    this.feverGauge = Math.min(100, Math.max(0, Number(data.feverGauge ?? 0)));
    this.feverTimer = 0;
    this.bountyArmed = Boolean(data.bountyArmed);

    this.cardMods = this._computeCardMods();
    this.setMapEvolution(Number(data.evolutionPhase || 0), false);
    this.setWeather(data.currentWeather || 'clear', false);

    for (const td of data.towers) {
      const def = TOWER_TYPES[td.type];
      if (!def) continue;
      const tier = Math.min(def.upgrades.length, Math.max(0, Number(td.tier ?? 0)));
      const stars = Math.min(5, Math.max(0, Number(td.stars ?? 0)));
      const isApex = Boolean(td.isApex);
      const mesh = this.towerFactory.createTowerMesh(td.type, tier, false, { isApex, stars });
      mesh.position.set(td.x, td.baseY || 0, td.z);
      this.scene.add(mesh);

      this.towers.push({
        id: NEXT_ID++,
        type: td.type,
        tier,
        stars,
        isApex,
        x: td.x,
        z: td.z,
        baseY: td.baseY || 0,
        onHighGround: Boolean(td.onHighGround),
        footprint: def.footprint,
        totalSpent: Number(td.totalSpent ?? def.cost),
        pops: Number(td.pops ?? 0),
        targetMode: td.targetMode || (td.type === 'sniper' || td.type === 'cannon' ? 'strong' : 'first'),
        cooldown: 0,
        coinTimer: def.coinDropInterval || 6,
        mesh,
        recoil: 0,
        stats: this._computeTowerStats(td.type, tier)
      });
    }

    if (this.towers.length > 0) {
      this.guidePadsGroup.visible = false;
    }
    this._recomputeSupportAuras();
    this.selectedTowerId = null;
    this.notifyState();
    if (announce) {
      const mapName = MAPS[this.currentMapId]?.name || this.currentMapId;
      this.onToast(`📂 已读取存档：【${mapName}】第 ${this.wave} 波（${this.towers.length} 座防御塔）！`, 'info');
    }
    return true;
  }

  saveToSlot(slotKey = 'auto', silent = false) {
    try {
      const payload = this.serializeSaveData();
      localStorage.setItem(this._getSlotStorageKey(slotKey), JSON.stringify(payload));
      if (!silent) {
        const label = slotKey === 'auto' ? '自动存档' : `存档槽 #${slotKey}`;
        this.onToast(`💾 已保存至【${label}】（第 ${payload.wave} 波 · $${payload.cash}）！`, 'info');
      }
      return true;
    } catch {
      if (!silent) this.onToast('⚠️ 浏览器存储空间受限，保存失败！', 'warn');
      return false;
    }
  }

  loadFromSlot(slotKey = 'auto') {
    try {
      const raw = localStorage.getItem(this._getSlotStorageKey(slotKey));
      if (!raw) {
        this.onToast('⚠️ 该槽位暂无存档记录！', 'warn');
        return false;
      }
      return this.loadSaveData(JSON.parse(raw), true);
    } catch {
      this.onToast('❌ 读取存档失败，数据已损坏！', 'warn');
      return false;
    }
  }

  deleteSaveSlot(slotKey) {
    try {
      localStorage.removeItem(this._getSlotStorageKey(slotKey));
      this.onToast('🗑️ 已清除该存档槽位。', 'info');
      return true;
    } catch {
      return false;
    }
  }

  getSaveSlotsSummary() {
    const keys = ['auto', '1', '2', '3'];
    const out = {};
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(this._getSlotStorageKey(k));
        if (!raw) {
          out[k] = null;
          continue;
        }
        const d = JSON.parse(raw);
        out[k] = {
          slotKey: k,
          savedAt: d.savedAt || 0,
          mapId: d.mapId,
          mapName: MAPS[d.mapId]?.name || d.mapId,
          wave: d.wave ?? 0,
          cash: d.cash ?? 0,
          lives: d.lives ?? 0,
          towerCount: Array.isArray(d.towers) ? d.towers.length : 0,
          commanderLevel: d.commanderLevel || 1
        };
      } catch {
        out[k] = null;
      }
    }
    return out;
  }

  exportSaveString() {
    const json = JSON.stringify(this.serializeSaveData());
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'BLOON3D:' + btoa(bin);
  }

  importSaveString(str) {
    if (!str || typeof str !== 'string') return false;
    try {
      const trimmed = str.trim();
      let jsonStr = trimmed;
      if (trimmed.startsWith('BLOON3D:')) {
        const bin = atob(trimmed.slice(8).trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        jsonStr = new TextDecoder().decode(bytes);
      }
      const data = JSON.parse(jsonStr);
      return this.loadSaveData(data, true);
    } catch {
      this.onToast('❌ 存档代码解析失败，请确认粘贴了完整的 BLOON3D: 代码！', 'warn');
      return false;
    }
  }

  _refreshSynergyLines(sourceX, sourceZ, sourceType, rangeOverride = null) {
    while (this.synergyLinesGroup.children.length > 0) {
      const old = this.synergyLinesGroup.children[0];
      if (old.geometry) old.geometry.dispose();
      this.synergyLinesGroup.remove(old);
    }
    if (sourceX === null || !sourceType) return;
    const isSup = TOWER_TYPES[sourceType]?.isSupport;
    const supRange = rangeOverride || TOWER_TYPES[sourceType]?.range || 6.2;

    for (const other of this.towers) {
      if (Math.hypot(other.x - sourceX, other.z - sourceZ) < 0.05) continue;
      if (isSup && !other.stats.isSupport) {
        if (Math.hypot(other.x - sourceX, other.z - sourceZ) <= supRange) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sourceX, 0.9, sourceZ),
            new THREE.Vector3(other.x, 0.9, other.z)
          ]);
          this.synergyLinesGroup.add(new THREE.Line(geo, this.synergyLineMat));
        }
      } else if (!isSup && other.stats.isSupport) {
        if (Math.hypot(other.x - sourceX, other.z - sourceZ) <= other.stats.range) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(other.x, 1.1, other.z),
            new THREE.Vector3(sourceX, 0.9, sourceZ)
          ]);
          this.synergyLinesGroup.add(new THREE.Line(geo, this.synergyLineMat));
        }
      }
    }
  }

  _spawnExitSpikes(stacks = 5) {
    if (!this._spikeGeo) {
      this._spikeGeo = new THREE.ConeGeometry(0.11, 0.34, 5);
      this._spikeMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.8, roughness: 0.25 });
    }
    for (let i = 0; i < stacks; i++) {
      const progress = 0.965 - i * 0.012;
      const pt = this.mapData.curve.getPointAt(progress);
      const spikeGroup = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const cone = new THREE.Mesh(this._spikeGeo, this._spikeMat);
        const a = (k / 5) * Math.PI * 2;
        cone.position.set(Math.cos(a) * 0.22, 0.17, Math.sin(a) * 0.22);
        spikeGroup.add(cone);
      }
      spikeGroup.position.set(pt.x, 0.04, pt.z);
      this.scene.add(spikeGroup);
      this.roadSpikes.push({ mesh: spikeGroup, pos: pt, charges: 10 });
    }
  }

  clearEntities() {
    this.bloons.forEach((b) => this.scene.remove(b.mesh));
    this.towers.forEach((t) => this.scene.remove(t.mesh));
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.coins.forEach((c) => this.scene.remove(c.mesh));
    this.supplyCrates.forEach((cr) => this.scene.remove(cr.mesh));
    this.lavaZones.forEach((lz) => {
      this.scene.remove(lz.mesh);
      if (lz.mat) lz.mat.dispose();
    });
    (this.ballLightnings || []).forEach((bl) => this.scene.remove(bl.mesh));
    this.roadSpikes.forEach((s) => this.scene.remove(s.mesh));
    this.bloons = [];
    this.towers = [];
    this.projectiles = [];
    this.coins = [];
    this.supplyCrates = [];
    this.lavaZones = [];
    this.ballLightnings = [];
    this.roadSpikes = [];
    this.spawnQueues = [];
    this.effects.clearAll();
    this.rangeRing.visible = false;
  }

  setPlacingTower(typeId) {
    while (this.ghostGroup.children.length > 1) {
      this.ghostGroup.remove(this.ghostGroup.children[1]);
    }
    this.placingType = typeId;
    if (!typeId) {
      this.ghostGroup.visible = false;
      this._refreshSynergyLines(null, null, null);
      this.notifyState();
      return;
    }
    this.selectedTowerId = null;
    this.rangeRing.visible = false;

    const def = TOWER_TYPES[typeId];
    const preview = this.towerFactory.createTowerMesh(typeId, 0);
    this.ghostGroup.add(preview);
    const r = def.displayRange || def.range;
    this.ghostRangeRing.scale.setScalar(r);
    this.ghostGroup.visible = true;
    this.notifyState();
  }

  _findHighGroundPad(x, z, snapDist = 0.95) {
    if (!this.mapData?.highGroundPads) return null;
    for (const p of this.mapData.highGroundPads) {
      if (Math.hypot(p.x - x, p.z - z) <= snapDist) return p;
    }
    return null;
  }

  updateGhostPosition(worldX, worldZ) {
    if (!this.placingType) return false;
    const pad = this._findHighGroundPad(worldX, worldZ);
    const gx = pad ? pad.x : worldX;
    const gz = pad ? pad.z : worldZ;
    const gy = pad ? pad.y : 0;
    this.ghostGroup.position.set(gx, gy, gz);
    const valid = this.canPlaceTower(this.placingType, gx, gz);
    const col = valid ? (pad ? 0xfacc15 : 0x22c55e) : 0xef4444;
    this.ghostRangeRing.userData.mat.color.setHex(col);
    this.ghostRangeRing.userData.fillMat.color.setHex(col);
    if (valid) {
      this._refreshSynergyLines(gx, gz, this.placingType);
    } else {
      this._refreshSynergyLines(null, null, null);
    }
    return valid;
  }

  canPlaceTower(typeId, x, z) {
    const def = TOWER_TYPES[typeId];
    if (!def || !this.mapData) return false;
    const b = this.mapData.islandBounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;

    const pad = this._findHighGroundPad(x, z, 0.25);
    if (!pad) {
      // Check distance to road (compact clearance so bends fit multiple towers neatly!)
      const roadClearance = this.mapData.roadWidth * 0.5 + def.footprint * 0.64;
      for (let i = 0; i < this.mapData.sampledPoints.length; i++) {
        const pt = this.mapData.sampledPoints[i];
        if (Math.hypot(pt.x - x, pt.z - z) < roadClearance) return false;
      }

      // Check distance to obstacles
      for (const obs of this.mapData.obstacles) {
        if (Math.hypot(obs.x - x, obs.z - z) < obs.radius + def.footprint * 0.58) return false;
      }
    }

    // Check distance to existing towers
    for (const t of this.towers) {
      const minSep = (t.footprint + def.footprint) * 0.72;
      if (Math.hypot(t.x - x, t.z - z) < minSep) return false;
    }
    return true;
  }

  placeTower(typeId, rawX, rawZ) {
    const def = TOWER_TYPES[typeId];
    if (!def || this.gameOver) return null;
    if (this.cash < def.cost) {
      this.onToast('金币不足，无法建造该防御塔！', 'warn');
      return null;
    }
    const pad = this._findHighGroundPad(rawX, rawZ);
    const x = pad ? pad.x : rawX;
    const z = pad ? pad.z : rawZ;
    const baseY = pad ? pad.y : 0;

    if (!this.canPlaceTower(typeId, x, z)) {
      this.onToast('此处靠近道路或已有建筑，请选择空旷草地！', 'warn');
      return null;
    }

    this.cash -= def.cost;
    const mesh = this.towerFactory.createTowerMesh(typeId, 0);
    mesh.position.set(x, baseY, z);
    this.scene.add(mesh);

    const tower = {
      id: NEXT_ID++,
      type: typeId,
      tier: 0,
      x,
      z,
      baseY,
      onHighGround: Boolean(pad),
      footprint: def.footprint,
      totalSpent: def.cost,
      pops: 0,
      targetMode: typeId === 'sniper' || typeId === 'cannon' ? 'strong' : 'first',
      cooldown: 0,
      coinTimer: def.coinDropInterval || 6,
      mesh,
      recoil: 0,
      stats: this._computeTowerStats(typeId, 0)
    };
    this.towers.push(tower);
    this.guidePadsGroup.visible = false;
    this._recomputeSupportAuras();

    this.sound.playPlace(false);
    this.effects.spawnShockwave(new THREE.Vector3(x, baseY, z), 1.4, pad ? 0xfacc15 : def.color, 0.25);
    if (pad) {
      this.effects.spawnFloatingText(new THREE.Vector3(x, baseY + 0.9, z), '🏔️ 战术高台 +15%射程/伤害!', '#fde047');
    }
    this.setPlacingTower(null);
    this.selectTower(tower.id);
    return tower;
  }

  _computeTowerStats(typeId, tier) {
    const def = TOWER_TYPES[typeId];
    const s = {
      range: def.range,
      displayRange: def.displayRange || def.range,
      fireRate: def.fireRate || 0,
      damage: def.damage || 0,
      pierce: def.pierce || 1,
      projectileSpeed: def.projectileSpeed || 26,
      splashRadius: def.splashRadius || 0,
      damageType: def.damageType || 'sharp',
      canSeeCamo: Boolean(def.canSeeCamo),
      multishot: 1,
      spread: 0.16,
      radialCount: def.radialCount || 0,
      isFireRing: false,
      burnDps: 0,
      clusterCount: 0,
      moabBonus: 1.0,
      ceramicBonus: 1.0,
      camoBonus: 0,
      critChance: 0,
      stunDuration: 0,
      isNova: Boolean(def.isNova),
      freezeDuration: def.freezeDuration || 0,
      slowFactor: def.slowFactor || 1,
      slowDuration: def.slowDuration || 0,
      stripCamo: false,
      stripRegrow: false,
      brittleBonus: 0,
      slowMoab: false,
      homing: false,
      hitscan: Boolean(def.hitscan),
      isLightning: Boolean(def.isLightning),
      chainCount: def.chainCount || 0,
      chainRange: def.chainRange || 3.8,
      isSupport: Boolean(def.isSupport),
      incomePerWave: def.incomePerWave || 0,
      coinDropInterval: def.coinDropInterval || 6.5,
      coinDropValue: def.coinDropValue || 20,
      buffFireRate: def.buffFireRate || 1,
      buffRange: def.buffRange || 1,
      grantCamoAura: Boolean(def.grantCamoAura),
      grantMIB: false
    };

    for (let i = 0; i < tier; i++) {
      const u = def.upgrades[i];
      if (!u) continue;
      if (u.pierceAdd) s.pierce += u.pierceAdd;
      if (u.rangeMul) { s.range *= u.rangeMul; s.displayRange *= u.rangeMul; }
      if (u.fireRateMul) s.fireRate *= u.fireRateMul;
      if (u.damageAdd) s.damage += u.damageAdd;
      if (u.splashMul) s.splashRadius *= u.splashMul;
      if (u.multishot) s.multishot = u.multishot;
      if (u.spread) s.spread = u.spread;
      if (u.radialCount) s.radialCount = u.radialCount;
      if (u.isFireRing) s.isFireRing = true;
      if (u.burnDps) s.burnDps = u.burnDps;
      if (u.clusterCount) s.clusterCount = u.clusterCount;
      if (u.moabBonus) s.moabBonus = Math.max(s.moabBonus, u.moabBonus);
      if (u.ceramicBonus) s.ceramicBonus = Math.max(s.ceramicBonus, u.ceramicBonus);
      if (u.camoBonus) s.camoBonus += u.camoBonus;
      if (u.critChance) s.critChance = u.critChance;
      if (u.stunDuration) s.stunDuration = Math.max(s.stunDuration, u.stunDuration);
      if (u.freezeDuration) s.freezeDuration = u.freezeDuration;
      if (u.slowDuration) s.slowDuration = u.slowDuration;
      if (u.stripCamo) s.stripCamo = true;
      if (u.stripRegrow) s.stripRegrow = true;
      if (u.brittleBonus) s.brittleBonus = Math.max(s.brittleBonus, u.brittleBonus);
      if (u.slowMoab) s.slowMoab = true;
      if (u.homing) s.homing = true;
      if (u.grantCamo) s.canSeeCamo = true;
      if (u.damageType) s.damageType = u.damageType;
      if (u.chainAdd) s.chainCount += u.chainAdd;
      if (u.incomeAdd) s.incomePerWave += u.incomeAdd;
      if (u.coinValueAdd) s.coinDropValue += u.coinValueAdd;
      if (u.buffFireRate) s.buffFireRate = u.buffFireRate;
      if (u.buffRange) s.buffRange = u.buffRange;
      if (u.grantCamoAura) s.grantCamoAura = true;
      if (u.grantMIB) s.grantMIB = true;
    }
    return s;
  }

  _recomputeSupportAuras() {
    const cm = this.cardMods || this._computeCardMods();
    const hgMul = 1 + (cm.highGroundBonus || 0.15);

    // Reset to base tier stats first, then apply High-Ground, Apex Fusion, Star Ascension & Card Relics
    for (const t of this.towers) {
      t.stats = this._computeTowerStats(t.type, t.tier);
      if (t.onHighGround) {
        if (t.stats.range < 50) {
          t.stats.range *= hgMul;
          t.stats.displayRange *= hgMul;
        }
        if (t.stats.damage > 0) {
          t.stats.damage = Math.max(t.stats.damage + 1, Math.round(t.stats.damage * hgMul));
        }
      }
      if (t.isApex) {
        if (t.stats.isSupport) {
          t.stats.incomePerWave = Math.round(t.stats.incomePerWave * 1.85);
          t.stats.buffFireRate += 0.18;
          t.stats.range *= 1.2;
          t.stats.displayRange *= 1.2;
        } else {
          t.stats.damage = Math.max(t.stats.damage + 2, Math.round(t.stats.damage * 1.75));
          t.stats.fireRate *= 1.35 + (cm.apexRateBonus || 0);
          t.stats.pierce += 3;
          if (t.stats.isLightning) t.stats.chainCount += 4;
          if (t.stats.range < 50) {
            t.stats.range *= 1.15;
            t.stats.displayRange *= 1.15;
          }
        }
      }
      if (t.stars > 0) {
        const starCount = t.stars;
        if (t.stats.isSupport) {
          t.stats.incomePerWave += starCount * 75;
          t.stats.buffFireRate += starCount * 0.06;
        } else {
          t.stats.damage = Math.round(t.stats.damage * (1 + starCount * 0.25)) + starCount;
          t.stats.fireRate *= 1 + starCount * 0.12;
          t.stats.pierce += starCount;
          if (t.stats.isLightning) t.stats.chainCount += starCount * 2;
        }
      }

      // Apply Roguelike Tactical Augment Card Modifiers
      if (t.stats.isSupport) {
        t.stats.incomePerWave += cm.beaconIncomeAdd || 0;
      } else {
        t.stats.critChance = Math.min(0.85, (t.stats.critChance || 0) + (cm.critChance || 0));
        t.stats.fireRate *= cm.globalRateMul || 1.0;
        t.stats.damage = Math.max(1, Math.round(t.stats.damage * (cm.globalDmgMul || 1.0)));
        if (t.stats.range < 50) {
          t.stats.range *= cm.globalRangeMul || 1.0;
          t.stats.displayRange *= cm.globalRangeMul || 1.0;
        }
        if (cm.moabDmgAdd > 0) {
          t.stats.moabBonus = (t.stats.moabBonus || 1.0) + cm.moabDmgAdd;
        }
        if (t.type === 'dart' || t.type === 'ninja') {
          t.stats.pierce += cm.dartNinjaPierce || 0;
          t.stats.fireRate *= 1 + (cm.dartNinjaRate || 0);
        }
        if (t.type === 'frost') {
          t.stats.range *= cm.frostRangeMul || 1.0;
          t.stats.displayRange *= cm.frostRangeMul || 1.0;
          t.stats.brittleBonus += cm.frostBrittleAdd || 0;
        }
        if (t.type === 'tesla') {
          t.stats.chainCount += cm.teslaChainAdd || 0;
          t.stats.damage = Math.max(1, Math.round(t.stats.damage * (cm.teslaDmgMul || 1.0)));
        }
        if (cm.extraProj > 0 && (t.type === 'dart' || t.type === 'ninja' || t.type === 'cannon')) {
          t.stats.multishot = (t.stats.multishot || 1) + cm.extraProj;
          t.stats.spread = Math.max(t.stats.spread || 0.14, 0.14);
        }
      }

      t.buffedByBeacon = false;
    }

    const beacons = this.towers.filter((t) => TOWER_TYPES[t.type].isSupport);
    for (const t of this.towers) {
      if (TOWER_TYPES[t.type].isSupport) continue;
      let bestFireMul = 1;
      let bestRangeMul = 1;
      let camo = false;
      let mib = false;
      for (const b of beacons) {
        if (Math.hypot(t.x - b.x, t.z - b.z) <= b.stats.range) {
          bestFireMul = Math.max(bestFireMul, b.stats.buffFireRate);
          bestRangeMul = Math.max(bestRangeMul, b.stats.buffRange);
          if (b.stats.grantCamoAura) camo = true;
          if (b.stats.grantMIB) mib = true;
        }
      }
      if (bestFireMul > 1 || camo || mib) {
        t.buffedByBeacon = true;
        t.stats.fireRate *= bestFireMul;
        t.stats.critChance = Math.min(0.92, (t.stats.critChance || 0) + 0.18);
        if (t.stats.range < 50) {
          t.stats.range *= bestRangeMul;
          t.stats.displayRange *= bestRangeMul;
        }
        if (camo) t.stats.canSeeCamo = true;
        if (mib) t.stats.damageType = 'normal';
      }
      if (t.mesh?.userData?.buffHalo) {
        t.mesh.userData.buffHalo.visible = t.buffedByBeacon;
      }

      // Apply Dynamic Weather Tactical Buffs
      if (this.currentWeather === 'clear' && t.stats.range < 50) {
        t.stats.range *= 1.06;
        t.stats.displayRange *= 1.06;
      } else if (this.currentWeather === 'rain' && (t.type === 'tesla' || t.type === 'frost')) {
        t.stats.fireRate *= 1.15;
      } else if (this.currentWeather === 'ember' && (t.stats.damageType === 'explosion' || t.stats.damageType === 'fire' || t.stats.isFireRing)) {
        t.stats.damage = Math.max(1, Math.round(t.stats.damage * 1.15));
      }
    }
    this._syncSelectionRing();
  }

  selectTower(towerId) {
    this.selectedTowerId = towerId;
    this._syncSelectionRing();
    this.notifyState();
  }

  _syncSelectionRing() {
    const t = this.getSelectedTower();
    if (!t) {
      this.rangeRing.visible = false;
      if (!this.placingType) this._refreshSynergyLines(null, null, null);
      return;
    }
    this.rangeRing.position.set(t.x, 0.08 + (t.baseY || 0), t.z);
    this.rangeRing.scale.setScalar(t.stats.displayRange);
    const ringCol = t.isApex ? 0xa855f7 : 0x38bdf8;
    this.rangeRing.userData.mat.color.setHex(ringCol);
    this.rangeRing.userData.fillMat.color.setHex(ringCol);
    this.rangeRing.visible = true;
    this._refreshSynergyLines(t.x, t.z, t.type, t.stats.range);
  }

  getSelectedTower() {
    return this.towers.find((t) => t.id === this.selectedTowerId) || null;
  }

  getAscendCost(t) {
    const disc = this.cardMods?.costDiscount || 1.0;
    return Math.round((1800 + (t.stars || 0) * 950) * disc);
  }

  _rebuildTowerMesh(t) {
    const prevRot = t.mesh.userData.head ? t.mesh.userData.head.rotation.y : 0;
    this.scene.remove(t.mesh);
    t.mesh = this.towerFactory.createTowerMesh(t.type, t.tier, t.buffedByBeacon, {
      isApex: Boolean(t.isApex),
      stars: t.stars || 0
    });
    t.mesh.position.set(t.x, t.baseY || 0, t.z);
    if (t.mesh.userData.head) t.mesh.userData.head.rotation.y = prevRot;
    this.scene.add(t.mesh);
  }

  upgradeSelectedTower() {
    const t = this.getSelectedTower();
    if (!t) return false;
    const def = TOWER_TYPES[t.type];

    // Star Ascension when already at Tier 4 MAX!
    if (t.tier >= def.upgrades.length) {
      if ((t.stars || 0) >= 5) return false;
      const ascendCost = this.getAscendCost(t);
      if (this.cash < ascendCost) {
        this.onToast('金币不足，无法巅峰升星！', 'warn');
        return false;
      }
      this.cash -= ascendCost;
      t.totalSpent += ascendCost;
      t.stars = (t.stars || 0) + 1;
      this._rebuildTowerMesh(t);
      this._recomputeSupportAuras();
      this.sound.playPlace(true);
      this.effects.spawnShockwave(new THREE.Vector3(t.x, t.baseY || 0, t.z), 2.4, 0xa855f7, 0.38);
      this.effects.spawnFloatingText(new THREE.Vector3(t.x, 1.0 + (t.baseY || 0), t.z), `🌟 巅峰 ★${t.stars}!`, '#e879f9');
      this.notifyState();
      return true;
    }

    const upg = def.upgrades[t.tier];
    const disc = this.cardMods?.costDiscount || 1.0;
    const finalCost = Math.round(upg.cost * disc);
    if (this.cash < finalCost) {
      this.onToast('金币不足，无法升级！', 'warn');
      return false;
    }

    this.cash -= finalCost;
    t.totalSpent += finalCost;
    t.tier += 1;

    this._rebuildTowerMesh(t);
    this._recomputeSupportAuras();
    this.sound.playPlace(true);
    this.effects.spawnShockwave(new THREE.Vector3(t.x, t.baseY || 0, t.z), 1.8, 0xfacc15, 0.32);
    this.effects.spawnFloatingText(new THREE.Vector3(t.x, 0.8 + (t.baseY || 0), t.z), `⬆ ${upg.name}`, '#facc15');
    this.notifyState();
    return true;
  }

  findFusionPartner(t) {
    if (!t || t.isApex || t.tier < 2) return null;
    let best = null;
    let bestDist = Infinity;
    for (const other of this.towers) {
      if (other.id === t.id || other.type !== t.type || other.isApex) continue;
      const d = Math.hypot(other.x - t.x, other.z - t.z);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  fuseSelectedTower() {
    const t = this.getSelectedTower();
    const partner = this.findFusionPartner(t);
    if (!t || !partner) return false;
    const fuseCost = Math.round(850 * (this.cardMods?.costDiscount || 1.0));
    if (this.cash < fuseCost) {
      this.onToast('金币不足，无法执行双塔合体！', 'warn');
      return false;
    }

    this.cash -= fuseCost;
    t.totalSpent += fuseCost + Math.round(partner.totalSpent * 0.65);
    t.pops += partner.pops;
    t.tier = Math.max(t.tier, partner.tier);
    t.isApex = true;

    // Visual fusion beam from absorbed partner to host tower, freeing partner's map space!
    this.effects.spawnBeam(
      [
        new THREE.Vector3(partner.x, 1.1 + (partner.baseY || 0), partner.z),
        new THREE.Vector3(t.x, 1.2 + (t.baseY || 0), t.z)
      ],
      0x38bdf8,
      0.45,
      true
    );
    this.effects.spawnPopBurst(new THREE.Vector3(partner.x, 0.8, partner.z), 0x38bdf8, 14, 1.2);
    this.scene.remove(partner.mesh);
    this.towers = this.towers.filter((item) => item.id !== partner.id);

    this._rebuildTowerMesh(t);
    this._recomputeSupportAuras();
    this.sound.playPlace(true);
    this.effects.spawnShockwave(new THREE.Vector3(t.x, t.baseY || 0, t.z), 2.8, 0x38bdf8, 0.42);
    this.effects.spawnFloatingText(new THREE.Vector3(t.x, 1.2 + (t.baseY || 0), t.z), '🧬 觉醒合体! 空位已释放', '#38bdf8');
    this.onToast(`🧬 双塔合体成功！【${TOWER_TYPES[t.type].name}】晋升神装形态并腾出建造空位！`, 'info');
    this.notifyState();
    return true;
  }

  cycleTargetMode() {
    const t = this.getSelectedTower();
    if (!t || t.stats.isSupport) return;
    const modes = ['first', 'strong', 'last', 'close'];
    const idx = modes.indexOf(t.targetMode);
    t.targetMode = modes[(idx + 1) % modes.length];
    this.notifyState();
  }

  setTargetMode(mode) {
    const t = this.getSelectedTower();
    if (!t || t.stats.isSupport) return;
    t.targetMode = mode;
    this.notifyState();
  }

  sellSelectedTower() {
    const idx = this.towers.findIndex((t) => t.id === this.selectedTowerId);
    if (idx === -1) return false;
    const t = this.towers[idx];
    const refund = Math.round(t.totalSpent * 0.75);
    this.cash += refund;
    this.scene.remove(t.mesh);
    this.towers.splice(idx, 1);
    this.selectedTowerId = null;
    this._recomputeSupportAuras();
    this.sound.playCoin();
    this.effects.spawnFloatingText(new THREE.Vector3(t.x, 0.6, t.z), `+$${refund}`, '#4ade80');
    this.notifyState();
    return true;
  }

  startNextWave() {
    if (this.waveActive || this.gameOver) return false;
    if (this.victory && !this.freeplay) return false;

    this.wave += 1;
    const cfg = getWaveConfig(this.wave);
    this.waveActive = true;
    this.waveElapsed = 0;
    this.comboMilestones = new Set();

    const isBounty = Boolean(this.bountyArmed);
    this.bountyWaveActive = isBounty;
    this.bountyArmed = false;

    this.spawnQueues = cfg.groups.map((g) => ({
      ...g,
      spawned: 0,
      nextTime: g.delay || 0,
      hpScale: (cfg.hpScale || 1) * (isBounty ? 1.32 : 1.0),
      speedScale: (cfg.speedScale || 1) * (isBounty ? 1.16 : 1.0)
    }));

    // Random Event 1: Golden Treasure Zeppelin on Waves 7, 15, 23 (or 22% surprise roll after Wave 6)
    if ([7, 15, 23].includes(this.wave) || (this.wave > 6 && !cfg.isBoss && Math.random() < 0.18)) {
      this.spawnQueues.push({
        type: 'golden',
        count: 1,
        spacing: 1,
        delay: 2.2,
        spawned: 0,
        nextTime: 2.2,
        hpScale: 1 + this.wave * 0.08,
        speedScale: 1
      });
      this.onToast('🪙 奇遇事件：【黄金宝藏艇】即将掠过航线，集火击落赢秘宝抽卡！', 'info');
    }

    // Random Event 2: 3D Parachute Mystery Supply Crate on Waves 5, 12, 18, 26 (or guaranteed on Bounty!)
    if (isBounty || [5, 12, 18, 26].includes(this.wave) || (this.wave >= 4 && Math.random() < 0.22)) {
      this._pendingCrateDrop = isBounty ? 1.9 : 2.6;
    } else {
      this._pendingCrateDrop = 0;
    }

    this.sound.playWaveStart(cfg.isBoss || isBounty);
    if (isBounty) {
      this.effects.triggerScreenFlash('rgba(239, 68, 68, 0.3)', 420);
      this.onToast(`⚔️ 第 ${this.wave} 波【恶魔悬赏挑战】开启！敌军强化，通关享 +65% 赏金 + 2💎星辉晶石！`, 'boss');
    } else if (cfg.isBoss) {
      this.onToast(`🚨 第 ${this.wave} 波 BOSS 战：${cfg.hint}`, 'boss');
    }

    // Dynamic 3-Phase Map Evolution at Wave 10 & Wave 20!
    const targetPhase = this.wave >= 20 ? 2 : (this.wave >= 10 ? 1 : 0);
    if (targetPhase > (this.evolutionPhase || 0)) {
      this.setMapEvolution(targetPhase, true);
    }

    // Dynamic Weather Shift every 5 waves!
    if (this.wave > 1 && this.wave % 5 === 1) {
      const cycles =
        this.currentMapId === 'volcano'
          ? ['ember', 'rain', 'ember', 'clear']
          : this.currentMapId === 'glacier'
          ? ['snow', 'rain', 'snow', 'clear']
          : ['clear', 'rain', 'clear', 'ember', 'snow'];
      const nextW = cycles[Math.floor(this.wave / 5) % cycles.length];
      if (nextW !== this.currentWeather) {
        this.setWeather(nextW, true);
      }
    }

    this.notifyState();
    return true;
  }

  setMapEvolution(phase, announce = false) {
    this.evolutionPhase = phase;
    const evo = this.mapData?.evolutionData;
    if (!evo) return;
    evo.phase = phase;

    if (phase === 0) {
      evo.themeEvoGrp.visible = false;
      evo.pylonGemMat.color.setHex(0x64748b);
      evo.pylonGemMat.emissiveIntensity = 0;
      evo.curbMat.emissive.setHex(0x000000);
      evo.curbMat.emissiveIntensity = 0;
      evo.innerMat.emissive.setHex(0x000000);
      evo.innerMat.emissiveIntensity = 0;
      evo.chevronMat.opacity = 0.48;
    } else if (phase === 1) {
      evo.themeEvoGrp.visible = true;
      evo.pylonGemMat.color.setHex(evo.evoLight);
      evo.pylonGemMat.emissiveIntensity = 1.25;
      evo.curbMat.emissive.setHex(evo.evoColor);
      evo.curbMat.emissiveIntensity = 0.35;
      evo.innerMat.emissive.setHex(0x000000);
      evo.innerMat.emissiveIntensity = 0;
      evo.chevronMat.opacity = 0.68;
      if (announce) {
        this.effects.spawnShockwave(new THREE.Vector3(0, 0.1, 0), 14, evo.evoColor, 0.5);
        this.onToast('✨ 地图二阶段异变：【秘能苏醒】能量符文已点亮！', 'info');
      }
    } else if (phase >= 2) {
      evo.themeEvoGrp.visible = true;
      evo.pylonGemMat.color.setHex(evo.evoLight);
      evo.pylonGemMat.emissiveIntensity = 1.75;
      evo.curbMat.emissive.setHex(evo.evoColor);
      evo.curbMat.emissiveIntensity = 0.58;
      evo.innerMat.emissive.setHex(evo.evoColor);
      evo.innerMat.emissiveIntensity = 0.38;
      evo.chevronMat.opacity = 0.86;
      if (announce) {
        this.effects.spawnShockwave(new THREE.Vector3(0, 0.1, 0), 18, evo.evoColor, 0.65);
        this.onToast('🌋 地图终局异变：【神域觉醒】全图秘能沸腾！', 'boss');
      }
    }
    this.notifyState();
  }

  spawnBloon(typeId, progress = 0, opts = {}) {
    const def = BLOON_TYPES[typeId];
    if (!def) return null;
    const camo = Boolean(def.innateCamo || (opts.camo && !def.isMoab));
    const regrow = Boolean(opts.regrow && !def.isMoab);
    const fortified = Boolean(opts.fortified);
    const rootType = opts.rootType || typeId;

    const hpMul = (opts.hpScale || 1) * (fortified ? 2.0 : 1.0);
    const maxHp = Math.max(1, Math.round(def.hp * hpMul));

    const mesh = this.bloonFactory.createBloonMesh(typeId, { camo, regrow, fortified });
    const pt = this.mapData.curve.getPointAt(Math.min(1, Math.max(0, progress)));
    mesh.position.copy(pt);
    this.scene.add(mesh);

    const bloon = {
      id: NEXT_ID++,
      type: typeId,
      rootType,
      hp: maxHp,
      maxHp,
      speed: def.speed * (opts.speedScale || 1),
      progress,
      camo,
      regrow,
      regrowTimer: 2.6,
      fortified,
      freezeTimer: 0,
      slowTimer: 0,
      slowFactor: 1,
      stunTimer: 0,
      burnTimer: 0,
      burnDps: 0,
      brittleBonus: 0,
      brittleTimer: 0,
      wobblePhase: Math.random() * Math.PI * 2,
      mesh
    };
    this.bloons.push(bloon);
    return bloon;
  }

  useAbility(abilityId) {
    if (this.gameOver || (this.abilityCooldowns[abilityId] || 0) > 0) return false;
    const ab = ABILITIES[abilityId];
    if (!ab) return false;

    const cdMul = (this.cardMods?.abilityCdMul || 1.0) * (this.metaMods?.abilityCdMul || 1.0);
    this.abilityCooldowns[abilityId] = Math.round(ab.cooldown * cdMul);

    if (abilityId === 'meteor') {
      // Strike up to 5 (or 8 with Apocalypse Relic!) leading bloon clusters across the map
      const maxTargets = this.cardMods?.apocalypseMeteor ? 8 : 5;
      const meteorDmg = this.cardMods?.apocalypseMeteor ? 70 : 40;
      const sorted = [...this.bloons].sort((a, b) => b.progress - a.progress);
      const targets = [];
      for (const b of sorted) {
        if (targets.length >= maxTargets) break;
        if (!targets.some((t) => t.distanceTo(b.mesh.position) < 2.5)) {
          targets.push(b.mesh.position.clone());
        }
      }
      if (targets.length === 0) {
        for (const u of [0.28, 0.5, 0.72]) {
          targets.push(this.mapData.curve.getPointAt(u));
        }
      }
      this.sound.playUltimate('meteor');
      this.sound.playExplosion(1.55);
      this.effects.triggerScreenFlash('rgba(249, 115, 22, 0.44)', 550);
      this.effects.triggerUltBanner('☄️', '天基陨石浩劫', 'ORBITAL METEOR CATACLYSM', '#fb923c');

      targets.forEach((pos, idx) => {
        this._dealAreaDamage(pos, 3.8, meteorDmg, 'normal', 99);
        this._spawnLavaCrater(pos);
        this.effects.spawnMeteorStrike(pos, idx * 0.055, (impactPos) => {
          this._dealAreaDamage(impactPos, 3.4, Math.round(meteorDmg * 0.25), 'normal', 99);
        });
      });
      this.onToast('☄️ 【天基陨石浩劫】陨星坠落并留下炙热熔岩池！', 'info');
    } else if (abilityId === 'frostNova') {
      this.sound.playUltimate('frostNova');
      this.effects.triggerShake(0.24);
      this.effects.triggerScreenFlash('rgba(56, 189, 248, 0.46)', 620);
      this.effects.triggerUltBanner('🧊', '绝对零度冰封', 'ABSOLUTE ZERO FROST DOME', '#38bdf8');
      this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 19, 0x38bdf8, 0.6);
      this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 13, 0xe0f2fe, 0.45);

      const spirePts = [];
      for (let k = 1; k <= 9; k++) {
        spirePts.push(this.mapData.curve.getPointAt(k / 10));
      }
      this.effects.spawnFrostCataclysm(spirePts);

      for (const b of [...this.bloons]) {
        if (BLOON_TYPES[b.type].isMoab) {
          b.slowTimer = 5.5;
          b.slowFactor = 0.48;
        } else {
          b.freezeTimer = 4.4;
          b.slowTimer = 7.0;
          b.slowFactor = 0.48;
          this.damageBloon(b, 5, 'normal', null);
        }
      }
      this.onToast('🧊 【绝对零度冰封】全图极寒冰穹与冰川尖碑已爆发！', 'info');
    } else if (abilityId === 'overclock') {
      this.overclockTimer = 7.5;
      this.sound.playUltimate('overclock');
      this.effects.triggerShake(0.18);
      this.effects.triggerScreenFlash('rgba(250, 204, 21, 0.42)', 540);
      this.effects.triggerUltBanner('⚡', '全军神威超频', 'SUPREME OVERCLOCK DRIVE', '#facc15');
      this.effects.spawnOrbitalPillar(new THREE.Vector3(0, 0, 0), 0xfacc15);
      this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 16, 0xfef08a, 0.48);

      const hub = new THREE.Vector3(0, 6.2, 0);
      for (const t of this.towers) {
        const tPos = new THREE.Vector3(t.x, 1.4, t.z);
        this.effects.spawnBeam([hub, tPos], 0xfacc15, 0.35, true);
        this.effects.spawnShockwave(new THREE.Vector3(t.x, 0, t.z), 1.8, 0xfacc15, 0.4);
      }
      this.onToast('⚡ 【全军神威超频】全塔神圣金环加身，攻速暴涨 +75%！', 'info');
    }

    this.notifyState();
    return true;
  }

  _spawnLavaCrater(pos) {
    if (this.lavaZones.length >= 10) return;
    if (!this._lavaCraterGeo) {
      this._lavaCraterGeo = new THREE.CircleGeometry(2.15, 24);
      this._lavaCraterGeo.rotateX(-Math.PI / 2);
      this._lavaRimGeo = new THREE.RingGeometry(1.75, 2.35, 24);
      this._lavaRimGeo.rotateX(-Math.PI / 2);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(this._lavaCraterGeo, mat));
    grp.add(new THREE.Mesh(this._lavaRimGeo, mat));
    grp.position.set(pos.x, 0.072, pos.z);
    this.scene.add(grp);
    this.lavaZones.push({ mesh: grp, mat, x: pos.x, z: pos.z, tick: 0.25, life: 4.2, maxLife: 4.2 });
  }

  _updateLavaZones(dt) {
    const now = performance.now() * 0.001;
    for (let i = this.lavaZones.length - 1; i >= 0; i--) {
      const lz = this.lavaZones[i];
      lz.life -= dt;
      if (lz.life <= 0) {
        this.scene.remove(lz.mesh);
        lz.mat.dispose();
        this.lavaZones.splice(i, 1);
        continue;
      }
      const pulse = 0.94 + Math.sin(now * 8 + i) * 0.08;
      lz.mesh.scale.setScalar(pulse);
      lz.mat.opacity = Math.min(0.75, (lz.life / lz.maxLife) * 0.95);
      lz.tick -= dt;
      if (lz.tick <= 0) {
        lz.tick = 0.35;
        if (Math.random() < 0.5) {
          this.effects.spawnPopBurst(new THREE.Vector3(lz.x, 0.15, lz.z), 0xfacc15, 2, 0.7);
        }
        for (const b of [...this.bloons]) {
          const d = Math.hypot(b.mesh.position.x - lz.x, b.mesh.position.z - lz.z);
          if (d <= 2.4) {
            b.burnTimer = Math.max(b.burnTimer, 2.0);
            b.burnDps = Math.max(b.burnDps, 6);
            this.damageBloon(b, 3, 'normal', null);
          }
        }
      }
    }
  }

  update(rawDt) {
    if (this.gameOver) return;
    const clamped = Math.min(0.05, rawDt);

    // Animate scenic 3D map props (water waves, shoreline foam, windmills, lighthouses)
    if (this.mapData?.animatedProps) {
      this._waveSkip = !this._waveSkip;
      const now = performance.now() * 0.001;
      for (const p of this.mapData.animatedProps) {
        if (p.type === 'waterWave') {
          if (this._waveSkip) continue;
          const posAttr = p.geo.attributes.position;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const wave = Math.sin(x * 0.28 + now * 1.9) * Math.cos(z * 0.26 + now * 1.5) * p.amp;
            posAttr.setY(i, p.baseY[i] + wave);
          }
          posAttr.needsUpdate = true;
        } else if (p.type === 'foam') {
          const pulse = 1 + Math.sin(now * 2.2) * 0.012;
          p.mesh.scale.set(pulse, pulse, 1);
          p.mat.opacity = 0.42 + Math.sin(now * 2.2) * 0.16;
        } else if (p.type === 'roadChevrons') {
          const flow = (now * 0.032) % 1;
          for (const item of p.items) {
            const u = (item.baseU + flow) % 1;
            const pt = p.curve.getPointAt(u);
            const tan = p.curve.getTangentAt(u);
            item.mesh.position.set(pt.x, 0.068, pt.z);
            item.mesh.lookAt(pt.x + tan.x, 0.068, pt.z + tan.z);
          }
        } else if (p.type === 'spinZ') {
          p.mesh.rotation.z += clamped * p.speed;
        } else if (p.type === 'spinY') {
          p.mesh.rotation.y += clamped * p.speed;
        } else if (p.type === 'bobBoat') {
          p.mesh.position.y = p.baseY + Math.sin(now * 2.1) * 0.1;
          p.mesh.rotation.z = Math.sin(now * 1.7) * 0.08;
        } else if (p.type === 'highGroundRunes') {
          for (const pad of p.pads) {
            pad.rune.rotation.z += clamped * 0.65;
          }
        } else if (p.type === 'evoPylons' && this.evolutionPhase > 0) {
          const speed = this.evolutionPhase >= 2 ? 2.8 : 1.5;
          p.pylons.forEach((gem, idx) => {
            gem.rotation.y += clamped * speed;
            gem.position.y = 1.12 + Math.sin(now * 2.6 + idx) * 0.14;
          });
        } else if (p.type === 'aurora' && p.group.visible) {
          for (const r of p.ribbons) {
            const pos = r.geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              pos.setZ(i, Math.sin(x * 0.22 + now * 1.4 + r.phase) * 0.85);
            }
            pos.needsUpdate = true;
          }
        }
      }
    }

    // Animate 1-Draw-Call 3D Weather Particles
    if (this.weatherGeo) {
      const wCfg = WEATHER_TYPES[this.currentWeather] || WEATHER_TYPES.clear;
      const wPos = this.weatherGeo.attributes.position;
      const nowT = performance.now() * 0.001;
      for (let i = 0; i < wPos.count; i++) {
        let x = wPos.getX(i) + (wCfg.vx + Math.sin(nowT + i) * 0.35) * clamped;
        let y = wPos.getY(i) + wCfg.vy * clamped;
        let z = wPos.getZ(i) + Math.cos(nowT * 0.8 + i) * 0.22 * clamped;
        if (y < 0.2) {
          y = 11.2;
          x = (Math.random() - 0.5) * 40;
        } else if (y > 11.5) {
          y = 0.25;
          x = (Math.random() - 0.5) * 40;
        }
        if (x > 21) x = -21;
        if (x < -21) x = 21;
        wPos.setXYZ(i, x, y, z);
      }
      wPos.needsUpdate = true;
    }

    if (this.pausedByModal) return;

    // Clamp rawDt and step simulation smoothly even at 4x speed
    const totalSimDt = clamped * this.gameSpeed;
    const steps = Math.max(1, Math.ceil(totalSimDt / 0.02));
    const dt = totalSimDt / steps;

    for (let s = 0; s < steps; s++) {
      this._stepSimulation(dt);
    }
  }

  _stepSimulation(dt) {
    // Cooldowns
    for (const k of Object.keys(this.abilityCooldowns)) {
      if (this.abilityCooldowns[k] > 0) {
        this.abilityCooldowns[k] = Math.max(0, this.abilityCooldowns[k] - dt);
      }
    }
    if (this.overclockTimer > 0) {
      this.overclockTimer = Math.max(0, this.overclockTimer - dt);
    }
    if (this.feverTimer > 0) {
      this.feverTimer = Math.max(0, this.feverTimer - dt);
      if (this.feverTimer === 0) {
        this.notifyState();
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    // Spawn queue processing
    if (this.waveActive) {
      this.waveElapsed += dt;
      let allSpawned = true;
      for (const q of this.spawnQueues) {
        if (q.spawned < q.count) {
          allSpawned = false;
          while (q.spawned < q.count && this.waveElapsed >= q.nextTime) {
            this.spawnBloon(q.type, 0, {
              camo: q.camo,
              regrow: q.regrow,
              fortified: q.fortified,
              hpScale: q.hpScale,
              speedScale: q.speedScale
            });
            q.spawned += 1;
            q.nextTime += q.spacing;
          }
          if (q.spawned < q.count) allSpawned = false;
        }
      }

      if (this._pendingCrateDrop > 0) {
        this._pendingCrateDrop -= dt;
        if (this._pendingCrateDrop <= 0) {
          this._spawnSupplyCrate();
        }
      }

      if (allSpawned && this.bloons.length === 0) {
        this._completeWave();
      }
    }

    this._updateBloons(dt);
    this._updateTowers(dt);
    this._updateProjectiles(dt);
    this._updateBallLightnings(dt);
    this._updateCoins(dt);
    this._updateSupplyCrates(dt);
    this._updateLavaZones(dt);

    if (this.waveActive) {
      this._bossHudTimer = (this._bossHudTimer || 0) - dt;
      if (this._bossHudTimer <= 0) {
        this._bossHudTimer = 0.2;
        if (this.bloons.some((b) => BLOON_TYPES[b.type].isMoab)) {
          this.notifyState();
        } else if (this._hadActiveBoss) {
          this._hadActiveBoss = false;
          this.notifyState();
        }
      }
    }
  }

  _completeWave() {
    this.waveActive = false;
    const wasBounty = Boolean(this.bountyWaveActive);
    this.bountyWaveActive = false;
    while (this.coins.length > 0) {
      this.collectCoin(this.coins.length - 1);
    }
    while (this.supplyCrates.length > 0) {
      this.collectSupplyCrate(this.supplyCrates.length - 1);
    }
    const cfg = getWaveConfig(this.wave);
    let bonus = cfg.bonus + (this.cardMods?.waveBonusAdd || 0) + (this.metaMods?.waveBonusAdd || 0);
    if (wasBounty) {
      bonus = Math.round(bonus * 1.65);
    }

    // Add support beacon end-of-wave income
    for (const t of this.towers) {
      if (t.stats.isSupport && t.stats.incomePerWave > 0) {
        bonus += t.stats.incomePerWave;
        this.effects.spawnFloatingText(
          new THREE.Vector3(t.x, 1.1, t.z),
          `+$${t.stats.incomePerWave}`,
          '#fde047'
        );
      }
    }

    this.cash += bonus;
    this.score += bonus * (wasBounty ? 3 : 2);
    this.sound.playCoin();
    this._gainCommanderXp((30 + this.wave * 6) * (wasBounty ? 2 : 1));

    if (wasBounty) {
      this.addStarGems(2, `第 ${this.wave} 波悬赏契约达成`);
    } else if (this.wave % 5 === 0) {
      this.addStarGems(this.wave === 30 ? 4 : 1, `第 ${this.wave} 波突破奖励`);
    }

    // Milestone Waves grant a Roguelike Tactical Augment Card Draft!
    if ([3, 8, 14, 20, 25].includes(this.wave)) {
      this.queueCardDraft(`🌊 第 ${this.wave} 波里程碑突破`);
    }

    if (this.wave === 30 && !this.freeplay) {
      this.victory = true;
      this._saveRecord();
      this.saveToSlot('auto', true);
      this.notifyState();
      return;
    }

    this._saveRecord();
    if (!this.gameOver && this.lives > 0) {
      this.saveToSlot('auto', true);
    }
    this.notifyState();
    if (this.autoStart && !this.gameOver) {
      this.startNextWave();
    }
  }

  enterFreeplay() {
    this.victory = false;
    this.freeplay = true;
    this.notifyState();
  }

  _updateBloons(dt) {
    const totalLen = this.mapData.totalLength;
    for (let i = this.bloons.length - 1; i >= 0; i--) {
      const b = this.bloons[i];
      if (b.hp <= 0) continue;

      // Burn DOT
      if (b.burnTimer > 0) {
        b.burnTimer -= dt;
        b.burnAcc = (b.burnAcc || 0) + b.burnDps * dt;
        if (b.burnAcc >= 1) {
          const dmg = Math.floor(b.burnAcc);
          b.burnAcc -= dmg;
          this.damageBloon(b, dmg, 'fire', null);
          if (!this.bloons.includes(b)) continue;
        }
      }

      // Sawtooth Bleed DOT (Tack signature)
      if (b.bleedTimer > 0) {
        b.bleedTimer -= dt;
        b.bleedAcc = (b.bleedAcc || 0) + (b.bleedDps || 2.5) * dt;
        if (b.bleedAcc >= 1) {
          const bDmg = Math.floor(b.bleedAcc);
          b.bleedAcc -= bDmg;
          this.damageBloon(b, bDmg, 'normal', b.bleedSource || null);
          if (!this.bloons.includes(b)) continue;
        }
      }

      // Regrow logic
      if (b.regrow && b.type !== b.rootType) {
        b.regrowTimer -= dt;
        if (b.regrowTimer <= 0) {
          b.regrowTimer = 2.6;
          const nextType = this._getParentLayer(b.type, b.rootType);
          if (nextType) {
            this._morphBloonType(b, nextType);
          }
        }
      }

      if (b.brittleTimer > 0) {
        b.brittleTimer -= dt;
        if (b.brittleTimer <= 0) b.brittleBonus = 0;
      }

      // Movement speed calculation
      let moveMul = 1.0;
      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        moveMul = 0;
      } else if (b.freezeTimer > 0) {
        b.freezeTimer -= dt;
        moveMul = 0;
      } else if (b.slowTimer > 0) {
        b.slowTimer -= dt;
        moveMul = b.slowFactor;
      }

      if (this.currentWeather === 'snow' && moveMul > 0) {
        moveMul *= 0.92;
      }

      if (b.mesh.userData.iceShell) {
        b.mesh.userData.iceShell.visible = b.freezeTimer > 0;
      }

      b.progress += ((b.speed * moveMul) / totalLen) * dt;

      // Check exit road spikes before leaking!
      if (b.progress >= 0.91 && this.roadSpikes.length > 0 && !BLOON_TYPES[b.type].isMoab) {
        for (let sIdx = this.roadSpikes.length - 1; sIdx >= 0; sIdx--) {
          const sp = this.roadSpikes[sIdx];
          const bPt = this.mapData.curve.getPointAt(Math.min(1, b.progress));
          if (bPt.distanceTo(sp.pos) < 0.75) {
            sp.charges -= 1;
            if (sp.charges <= 0) {
              this.scene.remove(sp.mesh);
              this.roadSpikes.splice(sIdx, 1);
            } else {
              sp.mesh.scale.setScalar(0.5 + 0.5 * (sp.charges / 10));
            }
            this.damageBloon(b, 2, 'normal', null);
            break;
          }
        }
        if (!this.bloons.includes(b)) continue;
      }

      // Leak at exit
      if (b.progress >= 1.0) {
        const rbe = BLOON_TYPES[b.type].rbe;
        if (rbe > 0) {
          this.lives = Math.max(0, this.lives - rbe);
          this.effects.spawnFloatingText(b.mesh.position, `-${rbe} ❤️`, '#f87171');
        } else {
          this.effects.spawnFloatingText(b.mesh.position, '🪙 宝藏艇溜走!', '#fde047');
        }
        if (b.mesh.userData?.disposableMats) {
          b.mesh.userData.disposableMats.forEach((m) => m.dispose());
        }
        this.scene.remove(b.mesh);
        this.bloons.splice(i, 1);
        if (this.lives <= 0) {
          this.gameOver = true;
          this.waveActive = false;
          this._saveRecord();
        }
        this.notifyState();
        continue;
      }

      // Position & 3D orientation / lively squash-and-stretch & banking animation
      const clampedT = Math.min(1, Math.max(0, b.progress));
      const pt = this.mapData.curve.getPointAt(clampedT);
      b.mesh.position.copy(pt);

      const tan = this.mapData.curve.getTangentAt(clampedT);
      const aheadTan = this.mapData.curve.getTangentAt(Math.min(1, clampedT + 0.022));
      const turnCross = tan.x * aheadTan.z - tan.z * aheadTan.x;
      b.hitBounce = Math.max(0, (b.hitBounce || 0) - dt * 6.5);
      const baseScale = b.mesh.userData.baseScale || BLOON_TYPES[b.type].scale;

      if (BLOON_TYPES[b.type].isMoab) {
        b.wobblePhase += dt * (b.type === 'ddt' ? 9.5 : 4.2);
        b.mesh.position.y += Math.sin(b.wobblePhase) * (b.type === 'ddt' ? 0.14 : 0.09);
        b.mesh.rotation.y = Math.atan2(-tan.z, tan.x);
        b.mesh.rotation.x = THREE.MathUtils.clamp(turnCross * 1.45, -0.32, 0.32);
        b.mesh.rotation.z = Math.sin(b.wobblePhase * 0.8) * 0.04;

        if (b.hitBounce > 0) {
          const jiggle = Math.sin(b.hitBounce * Math.PI * 3) * b.hitBounce * 0.09;
          b.mesh.scale.set(
            baseScale * (1 - jiggle),
            baseScale * (1 + jiggle * 1.25),
            baseScale * (1 + jiggle)
          );
        } else {
          b.mesh.scale.setScalar(baseScale);
        }

        if (b.mesh.userData.propeller) {
          b.mesh.userData.propeller.rotation.x += dt * (b.type === 'ddt' ? 28 : 18);
        }
        if (b.mesh.userData.extraRotors) {
          for (const rot of b.mesh.userData.extraRotors) {
            rot.rotation.y += dt * 22;
          }
        }
        if (b.mesh.userData.thrusters) {
          const pulse = 0.88 + Math.sin(b.wobblePhase * 3.8) * 0.24;
          for (const th of b.mesh.userData.thrusters) {
            th.scale.set(pulse * 1.25, pulse, pulse);
          }
        }
        // Emit smoke plumes when Boss airship is below 55% HP!
        if (b.hp < b.maxHp * 0.55) {
          b.smokeTimer = (b.smokeTimer || 0) - dt;
          if (b.smokeTimer <= 0) {
            b.smokeTimer = 0.22;
            this.effects.spawnPopBurst(
              b.mesh.position.clone().setY(1.6),
              b.hp < b.maxHp * 0.25 ? 0xf97316 : 0x475569,
              2,
              0.9
            );
          }
        }
        if (b.mesh.userData.hpBar) {
          b.mesh.userData.hpBar.lookAt(this.camera.position);
          const ratio = Math.max(0.02, b.hp / b.maxHp);
          b.mesh.userData.hpFill.scale.x = ratio;
          b.mesh.userData.hpFill.material.color.setHex(
            ratio > 0.5 ? 0x22c55e : (ratio > 0.25 ? 0xfacc15 : 0xef4444)
          );
        }
      } else {
        b.wobblePhase += dt * (6.2 + b.speed * 0.85) * moveMul;
        const hop = Math.abs(Math.sin(b.wobblePhase));
        b.mesh.position.y += hop * 0.16;
        // Squash at bottom of hop, stretch at apex + hit-recoil jelly pop!
        const stretch = (hop - 0.45) * 0.14 + Math.sin(b.hitBounce * Math.PI * 2.5) * b.hitBounce * 0.22;
        b.mesh.scale.set(
          baseScale * (1 - stretch * 0.55),
          baseScale * (1 + stretch),
          baseScale * (1 - stretch * 0.55)
        );
        b.mesh.rotation.z = THREE.MathUtils.clamp(-turnCross * 1.35 + Math.sin(b.wobblePhase * 0.5) * 0.08, -0.35, 0.35);
        b.mesh.rotation.x = moveMul > 0 ? 0.07 : 0;

        if (b.mesh.userData.stringMesh) {
          b.mesh.userData.stringMesh.rotation.z = Math.sin(b.wobblePhase * 1.4 - 0.8) * 0.28;
        }
        if (b.mesh.userData.shieldRing) {
          b.mesh.userData.shieldRing.rotation.z += dt * 5.2;
          b.mesh.userData.shieldRing.rotation.y += dt * 3.1;
        }
        if (b.mesh.userData.regrowRing) {
          const rPulse = 0.86 + Math.sin(b.wobblePhase * 1.6) * 0.08;
          b.mesh.userData.regrowRing.scale.setScalar(rPulse);
        }
      }
    }
  }

  _getParentLayer(currentType, rootType) {
    const order = ['red', 'blue', 'green', 'yellow', 'pink', 'purple', 'black', 'zebra', 'rainbow', 'ceramic'];
    const curIdx = order.indexOf(currentType);
    const rootIdx = order.indexOf(rootType);
    if (curIdx !== -1 && rootIdx > curIdx) {
      return order[curIdx + 1];
    }
    return null;
  }

  _morphBloonType(b, newType) {
    const def = BLOON_TYPES[newType];
    if (!def) return;
    b.type = newType;
    b.hp = def.hp;
    b.maxHp = def.hp;
    b.speed = def.speed;
    if (b.mesh.userData.body) {
      b.mesh.userData.body.material = this.bloonFactory.getMaterial(newType, b.camo);
    }
    b.mesh.userData.baseScale = def.scale;
    b.mesh.scale.setScalar(def.scale);
  }

  damageBloon(b, rawDamage, damageType = 'sharp', sourceTower = null) {
    const idx = this.bloons.indexOf(b);
    if (idx === -1) return false;
    const def = BLOON_TYPES[b.type];

    // Check Bloons TD immunities!
    if (damageType === 'sharp' && (def.sharpImmune || b.freezeTimer > 0)) {
      this.sound.playClang();
      return false;
    }
    if (damageType === 'explosion' && def.explosionImmune) {
      return false;
    }
    if (damageType === 'cold' && def.freezeImmune) {
      return false;
    }
    if ((damageType === 'energy' || damageType === 'fire') && def.energyImmune) {
      return false;
    }

    let dmg = rawDamage + (b.brittleBonus || 0);
    if (sourceTower) {
      if (def.isMoab && sourceTower.stats.moabBonus > 1) {
        dmg = Math.round(dmg * sourceTower.stats.moabBonus);
      } else if (def.ceramic && sourceTower.stats.ceramicBonus > 1) {
        dmg = Math.round(dmg * sourceTower.stats.ceramicBonus);
      }
      if (b.camo && sourceTower.stats.camoBonus > 0) {
        dmg += sourceTower.stats.camoBonus;
      }
      if (sourceTower.stats.stripCamo && b.camo) {
        b.camo = false;
        if (b.mesh.userData.body) {
          b.mesh.userData.body.material = this.bloonFactory.getMaterial(b.type, false);
        }
      }
      if (sourceTower.stats.stripRegrow && b.regrow) {
        b.regrow = false;
        if (b.mesh.userData.regrowRing) b.mesh.userData.regrowRing.visible = false;
      }
    }

    const actualDealt = Math.min(b.hp, Math.max(0, dmg));
    if (sourceTower && actualDealt > 0) {
      sourceTower.pops += actualDealt;
    }

    b.hp -= dmg;
    if (b.hp > 0) {
      b.hitBounce = 1.0;
      if (def.isGolden && Math.random() < 0.28) {
        this._spawnCoin(b.mesh.position.x, b.mesh.position.z, 10);
      }
      if (def.ceramic && !b.cracked && b.hp <= b.maxHp * 0.55 && b.mesh.userData.body) {
        b.cracked = true;
        b.mesh.userData.body.material = this.bloonFactory.getMaterial(b.type, b.camo, true);
      }
      return true;
    }

    // Popped this layer! Carry leftover damage across single-child non-MOAB layers!
    const overkill = -b.hp;
    const popPos = b.mesh.position.clone();
    this.sound.playPop(def.ceramic || def.isMoab);
    if (b.freezeTimer > 0) {
      this.effects.spawnIceShatter(popPos, def.ceramic ? 1.25 : 0.95);
    }
    this.effects.spawnPopBurst(popPos, def.color, def.isMoab ? 24 : 6, def.isMoab ? 1.7 : 0.92);
    if (def.isMoab) {
      this.sound.playExplosion(1.3);
      this.effects.spawnExplosion(popPos, 3.8, def.color, 0.35);
      this.effects.spawnShockwave(popPos, 4.6, 0xfacc15, 0.48);
      this.effects.spawnFloatingText(popPos, `💥 击毁 ${def.name}!`, '#fde047');
      this._gainCommanderXp(def.isGolden ? 60 : 45);
      if (def.isGolden || b.type === 'zomg' || b.type === 'bfb') {
        this.addStarGems(1, `击毁 ${def.name}`);
      }
      if (def.isGolden) {
        for (let k = 0; k < 5; k++) {
          this._spawnCoin(popPos.x, popPos.z, 18);
        }
        this.queueCardDraft('🪙 击落黄金宝藏艇');
      }
      if (b.mesh.userData?.disposableMats) {
        b.mesh.userData.disposableMats.forEach((m) => m.dispose());
      }
    }

    // Fever Overdrive Gauge Charge & Trigger!
    if (this.feverTimer <= 0) {
      const feverAdd = def.isMoab ? 26 : (def.ceramic ? 4.5 : 0.72);
      this.feverGauge = Math.min(100, (this.feverGauge || 0) + feverAdd);
      if (this.feverGauge >= 100) {
        this.feverGauge = 0;
        this.feverTimer = 8.0;
        this.sound?.playFeverStart?.();
        this.effects.triggerScreenFlash('rgba(245, 158, 11, 0.34)', 480);
        this.effects.spawnShockwave(new THREE.Vector3(0, 0.15, 0), 15, 0xf59e0b, 0.45);
        this.onToast('🔥 【狂暴超载时刻】爆发 8 秒！全军攻速 +40% · 暴击 +20% · 赏金 +25%！', 'info');
        this.notifyState();
      }
    }

    // Combo streak update
    this.comboCount += 1;
    this.comboTimer = 1.65;
    for (const [threshold, reward] of [[60, 12], [180, 22], [400, 35]]) {
      if (this.comboCount >= threshold && !this.comboMilestones.has(threshold)) {
        this.comboMilestones.add(threshold);
        this.cash += reward;
        this.score += reward * 15;
        this.effects.spawnFloatingText(popPos, `🔥${threshold}连击 +$${reward}`, '#fb923c');
      }
    }

    // Authentic BTD6 progressive pop-cash scaling (+25% bonus during Fever Overdrive!)
    const cashScale =
      (this.wave <= 10 ? 1.0 :
      this.wave <= 18 ? 0.65 :
      this.wave <= 25 ? 0.38 : 0.22) * (this.feverTimer > 0 ? 1.25 : 1.0);
    this._cashAcc = (this._cashAcc || 0) + def.reward * cashScale;
    if (this._cashAcc >= 1) {
      const whole = Math.floor(this._cashAcc);
      this._cashAcc -= whole;
      this.cash += whole;
    }
    this.totalPops += 1;
    this.score += def.reward * 10;

    this.scene.remove(b.mesh);
    this.bloons.splice(idx, 1);

    // Chain Detonation Roguelike Card trigger (non-recursive guard via _inChainDet)
    if (!this._inChainDet && (this.cardMods?.explodeOnPopChance || 0) > 0 && Math.random() < this.cardMods.explodeOnPopChance) {
      this._inChainDet = true;
      this.effects.spawnShockwave(popPos, 2.1, 0xf97316, 0.24);
      this._dealAreaDamage(popPos, 2.1, 4, 'explosion', 6, null);
      this._inChainDet = false;
    }

    // Spawn children bloons slightly spaced along the path
    const children = def.children || [];
    children.forEach((childType, cIdx) => {
      const offset = children.length > 1 ? (cIdx - (children.length - 1) * 0.5) * 0.009 : 0;
      const child = this.spawnBloon(childType, Math.max(0, b.progress + offset), {
        camo: Boolean(b.camo || def.innateCamo),
        regrow: Boolean(b.regrow || (b.type === 'ddt' && childType === 'ceramic')),
        fortified: def.isMoab ? false : b.fortified,
        rootType: b.regrow ? b.rootType : childType
      });
      if (child && overkill > 0 && children.length === 1 && !BLOON_TYPES[childType].isMoab) {
        this.damageBloon(child, overkill, damageType, sourceTower);
      }
    });

    return true;
  }

  _updateTowers(dt) {
    const overclockMul = (this.overclockTimer > 0 ? 1.75 : 1.0) * (this.feverTimer > 0 ? 1.4 : 1.0);

    const nowSec = performance.now() * 0.001;
    for (const t of this.towers) {
      // Idle visual spin/pulse/scarf animations
      if (t.mesh.userData.spinPart) {
        t.mesh.userData.spinPart.rotation.y += dt * (t.type === 'tack' ? 3.8 : 2.6);
      }
      if (t.mesh.userData.scarfGrp) {
        t.mesh.userData.scarfGrp.rotation.y = Math.sin(nowSec * 6.5 + t.id) * 0.24;
        t.mesh.userData.scarfGrp.rotation.x = Math.cos(nowSec * 5.2 + t.id) * 0.12;
      }
      if (t.mesh.userData.apexOrbit) {
        t.mesh.userData.apexOrbit.rotation.y += dt * 1.9;
        t.mesh.userData.apexOrbit.rotation.z += dt * 0.8;
      }
      if (t.mesh.userData.overclockHalo) {
        const ocActive = this.overclockTimer > 0;
        t.mesh.userData.overclockHalo.visible = ocActive;
        if (ocActive) {
          t.mesh.userData.overclockHalo.rotation.z += dt * 6.5;
          t.mesh.userData.overclockHalo.position.y = 2.05 + Math.sin(nowSec * 9.0 + t.id) * 0.08;
        }
      }
      if (t.mesh.userData.pulsePart) {
        const s = 1 + Math.sin(nowSec * 8.0) * 0.1;
        t.mesh.userData.pulsePart.scale.setScalar(s);
      }
      if (t.recoil > 0 && t.mesh.userData.head) {
        t.recoil = Math.max(0, t.recoil - dt * 5.5);
        t.mesh.userData.head.position.z = -t.recoil * 0.14;
        if (t.mesh.userData.muzzleFlash) {
          t.mesh.userData.muzzleFlash.visible = t.recoil > 0.68;
        }
      }

      // Support Beacon coin generation + Signature Royal Inspire Pulse during active waves
      if (t.stats.isSupport) {
        if (this.waveActive) {
          t.coinTimer -= dt;
          if (t.coinTimer <= 0) {
            t.coinTimer = t.stats.coinDropInterval;
            this._spawnCoin(t.x, t.z, t.stats.coinDropValue);
          }
          t.inspireTimer = (t.inspireTimer || 5.2) - dt;
          if (t.inspireTimer <= 0) {
            t.inspireTimer = 5.5;
            this.effects.spawnShockwave(new THREE.Vector3(t.x, 0.1 + (t.baseY || 0), t.z), t.stats.range * 0.85, 0xfacc15, 0.36);
            // Command strongest ally in range to fire immediately!
            let ally = null;
            for (const other of this.towers) {
              if (other.stats.isSupport) continue;
              if (Math.hypot(other.x - t.x, other.z - t.z) <= t.stats.range) {
                if (!ally || other.totalSpent > ally.totalSpent) ally = other;
              }
            }
            if (ally) {
              ally.cooldown = 0;
              this.effects.spawnBeam(
                [new THREE.Vector3(t.x, 1.35, t.z), new THREE.Vector3(ally.x, 1.15 + (ally.baseY || 0), ally.z)],
                0xfde047,
                0.24
              );
            }
          }
        }
        continue;
      }

      if (t.cooldown > 0) {
        t.cooldown -= dt * overclockMul;
      }

      const target = this._acquireTarget(t);
      if (!target) {
        // Gentle tactical radar sweep when idle
        if (t.mesh.userData.head && !t.stats.radialCount && !t.stats.isNova && t.recoil <= 0) {
          t.mesh.userData.head.rotation.y += Math.sin(nowSec * 1.35 + t.id * 1.7) * dt * 0.45;
        }
        continue;
      }
      if (t.cooldown > 0) continue;

      // Rotate turret head toward target
      if (t.mesh.userData.head && !t.stats.radialCount && !t.stats.isNova) {
        const dx = target.mesh.position.x - t.x;
        const dz = target.mesh.position.z - t.z;
        t.mesh.userData.head.rotation.y = Math.atan2(dx, dz);
      }

      t.cooldown = 1 / Math.max(0.1, t.stats.fireRate);
      t.recoil = 1.0;
      this._fireTower(t, target);
    }
  }

  _acquireTarget(t) {
    const range = t.stats.range;
    let best = null;
    let bestScore = -Infinity;

    for (const b of this.bloons) {
      if (b.camo && !t.stats.canSeeCamo) continue;
      const d = Math.hypot(b.mesh.position.x - t.x, b.mesh.position.z - t.z);
      if (d > range) continue;

      let score = 0;
      if (t.targetMode === 'first') score = b.progress;
      else if (t.targetMode === 'last') score = -b.progress;
      else if (t.targetMode === 'close') score = -d;
      else if (t.targetMode === 'strong') score = BLOON_TYPES[b.type].rbe * 10 + b.progress;

      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  _fireTower(t, target) {
    const s = t.stats;
    t.shotCount = (t.shotCount || 0) + 1;
    const origin = new THREE.Vector3(t.x, 1.05 + (t.baseY || 0), t.z);
    this.sound.playTowerShot(t.type, t.tier);

    // 1. Frost Nova Tower — Signature: Shatter Execute on Frozen + Every 3rd Pulse Glacial Lance!
    if (s.isNova) {
      this.effects.spawnShockwave(origin, s.range, 0x67e8f9, 0.3);
      let hits = 0;
      for (const b of [...this.bloons]) {
        if (hits >= s.pierce) break;
        if (b.camo && !s.canSeeCamo) continue;
        const d = Math.hypot(b.mesh.position.x - t.x, b.mesh.position.z - t.z);
        if (d <= s.range) {
          const def = BLOON_TYPES[b.type];
          const wasFrozen = b.freezeTimer > 0.08;
          if (!def.freezeImmune) {
            if (!def.isMoab) {
              b.freezeTimer = Math.max(b.freezeTimer, s.freezeDuration);
              b.slowTimer = Math.max(b.slowTimer, s.slowDuration);
              b.slowFactor = s.slowFactor;
            } else if (s.slowMoab) {
              b.slowTimer = Math.max(b.slowTimer, s.slowDuration);
              b.slowFactor = 0.65;
            }
            if (s.brittleBonus > 0) {
              b.brittleBonus = Math.max(b.brittleBonus, s.brittleBonus);
              b.brittleTimer = 3.5;
            }
          }
          const bonusShatter = wasFrozen && !def.isMoab ? 3 : 0;
          if (bonusShatter > 0) {
            this.effects.spawnIceShatter(b.mesh.position, 0.85);
          }
          this.damageBloon(b, s.damage + bonusShatter, bonusShatter > 0 ? 'normal' : s.damageType, t);
          hits++;
        }
      }
      // Every 3rd pulse: fire piercing Glacial Lance at primary target!
      if (t.shotCount % 3 === 0 && this.bloons.includes(target)) {
        const endPos = target.mesh.position.clone().setY(1.0);
        this.effects.spawnBeam([origin.clone().setY(1.4), endPos], 0xbae6fd, 0.22);
        this.effects.spawnIceShatter(endPos, 1.05);
        this.damageBloon(target, Math.max(4, s.damage * 3), 'normal', t);
      }
      return;
    }

    // 2. Tack Shooter — Signature: Sawtooth Bleed + Every 4th Shot Solar Magma Nova!
    if (s.radialCount > 0) {
      const isSolarBurst = t.shotCount % 4 === 0;
      if (s.isFireRing || isSolarBurst) {
        const burstRange = isSolarBurst ? s.range * 1.25 : s.range;
        this.effects.spawnShockwave(origin, burstRange, isSolarBurst ? 0xfacc15 : 0xf97316, 0.28);
        let hits = 0;
        for (const b of [...this.bloons]) {
          if (hits >= s.pierce + (isSolarBurst ? 10 : 0)) break;
          if (b.camo && !s.canSeeCamo) continue;
          const d = Math.hypot(b.mesh.position.x - t.x, b.mesh.position.z - t.z);
          if (d <= burstRange) {
            b.burnDps = Math.max(b.burnDps || 0, s.burnDps || 4);
            b.burnTimer = Math.max(b.burnTimer || 0, 2.8);
            this.damageBloon(b, s.damage + (isSolarBurst ? 2 : 0), 'fire', t);
            hits++;
          }
        }
      }
      if (!s.isFireRing) {
        for (let i = 0; i < s.radialCount; i++) {
          const ang = (i / s.radialCount) * Math.PI * 2;
          this._spawnProjectile(t, origin, Math.cos(ang), Math.sin(ang));
        }
      }
      return;
    }

    // 3. Hitscan Sniper — Signature: Headshot Bounty + Supersonic Shrapnel Cone!
    if (s.hitscan) {
      const endPos = target.mesh.position.clone().setY(1.0);
      const isMoabOrCeram = Boolean(BLOON_TYPES[target.type].isMoab || BLOON_TYPES[target.type].ceramic);
      this.effects.spawnBeam([origin.clone().setY(1.35 + (t.baseY || 0)), endPos], 0x6ee7b7, 0.18);
      this.effects.spawnShockwave(endPos, 1.25, 0x34d399, 0.2);
      if (s.stunDuration > 0) target.stunTimer = Math.max(target.stunTimer, s.stunDuration);
      if (s.brittleBonus > 0) {
        target.brittleBonus = Math.max(target.brittleBonus, s.brittleBonus);
        target.brittleTimer = 4.0;
      }
      this.damageBloon(target, s.damage, s.damageType, t);
      // Headshot kill bounty!
      if (!this.bloons.includes(target)) {
        const bounty = isMoabOrCeram ? 5 : 2;
        this.cash += bounty;
        if (isMoabOrCeram) {
          this.effects.spawnFloatingText(endPos, `🎯猎头 +$${bounty}`, '#6ee7b7');
        }
      }
      // Supersonic shock cone splashes up to 3 nearby bloons!
      const coneDmg = Math.max(1, Math.round(s.damage * 0.45));
      let splashHits = 0;
      for (const other of [...this.bloons]) {
        if (other === target || splashHits >= 3) continue;
        if (other.camo && !s.canSeeCamo) continue;
        if (other.mesh.position.distanceTo(endPos) <= 1.75) {
          this.damageBloon(other, coneDmg, 'normal', t);
          splashHits++;
        }
      }
      return;
    }

    // 4. Chain Lightning Tesla — Signature: Every 3rd Bolt Spawns Roaming 3D Ball Lightning!
    if (s.isLightning) {
      const visited = new Set();
      let curr = target;
      let prevPoint = origin.clone().setY(1.6 + (t.baseY || 0));
      const beamPts = [prevPoint];

      for (let c = 0; c < s.chainCount && curr; c++) {
        visited.add(curr.id);
        const curPos = curr.mesh.position.clone().setY(1.05);
        beamPts.push(curPos);
        this.damageBloon(curr, s.damage, s.damageType, t);

        let nextB = null;
        let nextDist = s.chainRange;
        for (const cand of this.bloons) {
          if (visited.has(cand.id)) continue;
          if (cand.camo && !s.canSeeCamo) continue;
          const d = cand.mesh.position.distanceTo(curPos);
          if (d < nextDist) {
            nextDist = d;
            nextB = cand;
          }
        }
        curr = nextB;
      }
      this.effects.spawnLightningBolt(beamPts);
      if (t.shotCount % 3 === 0) {
        this._spawnBallLightning(t, target.progress);
      }
      return;
    }

    // 5. Standard / Multishot / Homing / Cannon Projectile
    const baseAngle = Math.atan2(target.mesh.position.z - t.z, target.mesh.position.x - t.x);
    const targetDist = Math.hypot(target.mesh.position.x - origin.x, target.mesh.position.z - origin.z);
    const count = s.multishot || 1;
    const forceCrit = t.type === 'dart' && t.shotCount % 5 === 0;
    const isMegaShell = t.type === 'cannon' && t.shotCount % 4 === 0;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) * 0.5) * s.spread;
      const ang = baseAngle + offset;
      this._spawnProjectile(t, origin, Math.cos(ang), Math.sin(ang), { forceCrit, isMegaShell, targetDist });
    }
  }

  _spawnBallLightning(tower, startProgress) {
    if (this.ballLightnings.length >= 6 || !this.mapData?.curve) return;
    if (!this._ballLightGeo) {
      this._ballLightGeo = new THREE.SphereGeometry(0.38, 12, 12);
      this._ballLightMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.1,
        roughness: 0.1
      });
    }
    const mesh = new THREE.Mesh(this._ballLightGeo, this._ballLightMat);
    const pt = this.mapData.curve.getPointAt(Math.min(1, Math.max(0, startProgress)));
    mesh.position.set(pt.x, 1.05, pt.z);
    this.scene.add(mesh);
    this.ballLightnings.push({
      mesh,
      tower,
      progress: startProgress,
      tick: 0.12,
      life: 2.4
    });
  }

  _updateBallLightnings(dt) {
    if (!this.ballLightnings?.length || !this.mapData?.curve) return;
    const now = performance.now() * 0.001;
    for (let i = this.ballLightnings.length - 1; i >= 0; i--) {
      const bl = this.ballLightnings[i];
      bl.life -= dt;
      bl.progress -= 0.075 * dt;
      if (bl.life <= 0 || bl.progress <= 0) {
        this.scene.remove(bl.mesh);
        this.ballLightnings.splice(i, 1);
        continue;
      }
      const pt = this.mapData.curve.getPointAt(Math.min(1, Math.max(0, bl.progress)));
      bl.mesh.position.set(pt.x, 1.0 + Math.sin(now * 12 + i) * 0.15, pt.z);
      bl.mesh.scale.setScalar(0.9 + Math.sin(now * 16 + i) * 0.18);
      bl.tick -= dt;
      if (bl.tick <= 0) {
        bl.tick = 0.34;
        let zaps = 0;
        const dmg = Math.max(1, Math.round((bl.tower.stats?.damage || 2) * 0.75));
        for (const b of [...this.bloons]) {
          if (zaps >= 4) break;
          if (b.camo && !bl.tower.stats?.canSeeCamo) continue;
          if (b.mesh.position.distanceTo(bl.mesh.position) <= 2.7) {
            this.effects.spawnBeam([bl.mesh.position.clone(), b.mesh.position.clone().setY(1.0)], 0x7dd3fc, 0.12, true);
            this.damageBloon(b, dmg, 'energy', bl.tower);
            zaps++;
          }
        }
      }
    }
  }

  _getProjectileGeo(typeId) {
    if (!this._projGeoMap) {
      const dartBolt = new THREE.ConeGeometry(0.11, 0.54, 6);
      dartBolt.rotateZ(-Math.PI / 2); // point along +X
      const shuriken = new THREE.OctahedronGeometry(0.26, 0);
      shuriken.scale(1, 0.22, 1);
      const bomb = new THREE.SphereGeometry(0.28, 10, 10);
      this._projGeoMap = {
        dart: dartBolt,
        tack: dartBolt,
        ninja: shuriken,
        cannon: bomb
      };
    }
    return this._projGeoMap[typeId] || this.projGeo;
  }

  _spawnProjectile(t, origin, dirX, dirZ, { forceCrit = false, isMegaShell = false, targetDist = 0 } = {}) {
    const def = TOWER_TYPES[t.type];
    const effCrit = Math.min(0.95, (t.stats.critChance || 0) + (this.feverTimer > 0 ? 0.2 : 0));
    const isCrit = forceCrit || (effCrit > 0 && Math.random() < effCrit);
    const col = isMegaShell ? 0xf97316 : (isCrit ? 0xfacc15 : (t.type === 'cannon' ? 0x1e293b : def.accent));
    if (!this._projMatCache) this._projMatCache = new Map();
    if (!this._projMatCache.has(col)) {
      this._projMatCache.set(col, new THREE.MeshBasicMaterial({ color: col }));
    }
    const mat = this._projMatCache.get(col);
    const mesh = new THREE.Mesh(this._getProjectileGeo(t.type), mat);
    mesh.position.copy(origin);
    if (isMegaShell) mesh.scale.setScalar(1.38);
    mesh.rotation.y = -Math.atan2(dirZ, dirX);
    this.scene.add(mesh);

    const maxLife =
      t.stats.splashRadius > 0 && targetDist > 0
        ? Math.max(0.1, (targetDist * 1.04) / t.stats.projectileSpeed)
        : (Math.min(18, t.stats.range) * 1.35) / t.stats.projectileSpeed;
    this.projectiles.push({
      mesh,
      tower: t,
      vx: dirX * t.stats.projectileSpeed,
      vz: dirZ * t.stats.projectileSpeed,
      damage: isCrit ? Math.round(t.stats.damage * (this.metaMods?.critDmgMul || 2.0)) : t.stats.damage,
      isCrit,
      isMegaShell,
      pierceLeft: t.stats.pierce,
      hitIds: new Set(),
      life: maxLife,
      maxLife
    });
  }

  _detonateSplashProjectile(p) {
    const impactPos = p.mesh.position.clone().setY(0.15);
    const splashR = p.tower.stats.splashRadius * (p.isMegaShell ? 1.38 : 1.0);
    this.sound.playExplosion(p.isMegaShell ? 1.25 : 0.95);
    this.effects.spawnExplosion(impactPos, splashR, p.isMegaShell ? 0xef4444 : 0xf97316, p.isMegaShell ? 0.14 : 0.08);
    this._dealAreaDamage(
      impactPos,
      splashR,
      p.isMegaShell ? Math.round(p.damage * 1.5) : p.damage,
      p.tower.stats.damageType,
      p.tower.stats.pierce,
      p.tower,
      p.isMegaShell
    );
    if (p.tower.stats.clusterCount > 0) {
      for (let c = 0; c < p.tower.stats.clusterCount; c++) {
        const a = (c / p.tower.stats.clusterCount) * Math.PI * 2;
        const cPos = impactPos.clone().add(new THREE.Vector3(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25));
        this.effects.spawnExplosion(cPos, 1.25, 0xfacc15, 0);
        this._dealAreaDamage(cPos, 1.35, Math.max(1, Math.round(p.damage * 0.6)), 'explosion', 8, p.tower);
      }
    }
    p.pierceLeft = 0;
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0 || p.pierceLeft <= 0) {
        if (p.life <= 0 && p.pierceLeft > 0 && p.tower.stats.splashRadius > 0) {
          this._detonateSplashProjectile(p);
        }
        this._removeProjectile(i);
        continue;
      }

      // Homing steering
      if (p.tower.stats.homing && this.bloons.length > 0) {
        let nearest = null;
        let minD = 5.5;
        for (const b of this.bloons) {
          if (p.hitIds.has(b.id)) continue;
          if (b.camo && !p.tower.stats.canSeeCamo) continue;
          const d = Math.hypot(b.mesh.position.x - p.mesh.position.x, b.mesh.position.z - p.mesh.position.z);
          if (d < minD) {
            minD = d;
            nearest = b;
          }
        }
        if (nearest) {
          const desired = Math.atan2(
            nearest.mesh.position.z - p.mesh.position.z,
            nearest.mesh.position.x - p.mesh.position.x
          );
          const spd = p.tower.stats.projectileSpeed;
          p.vx = THREE.MathUtils.lerp(p.vx, Math.cos(desired) * spd, dt * 11);
          p.vz = THREE.MathUtils.lerp(p.vz, Math.sin(desired) * spd, dt * 11);
        }
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.tower.type === 'ninja') {
        p.mesh.rotation.y += dt * 22;
      } else if (p.tower.type === 'cannon') {
        const u = 1 - p.life / p.maxLife;
        p.mesh.position.y = 1.05 + Math.sin(u * Math.PI) * 1.35;
      } else {
        p.mesh.rotation.y = -Math.atan2(p.vz, p.vx);
      }

      // Collision check against bloons
      for (let bIdx = this.bloons.length - 1; bIdx >= 0; bIdx--) {
        const b = this.bloons[bIdx];
        if (!b || p.hitIds.has(b.id)) continue;
        if (b.camo && !p.tower.stats.canSeeCamo) continue;

        const hitRadius = BLOON_TYPES[b.type].isMoab ? 1.35 : 0.78;
        const d = Math.hypot(b.mesh.position.x - p.mesh.position.x, b.mesh.position.z - p.mesh.position.z);
        if (d <= hitRadius) {
          p.hitIds.add(b.id);

          if (p.tower.stats.splashRadius > 0) {
            this._detonateSplashProjectile(p);
          } else {
            const hitPos = b.mesh.position.clone();
            // Tack Signature: Sawtooth Bleed
            if (p.tower.type === 'tack' && !BLOON_TYPES[b.type].sharpImmune) {
              b.bleedTimer = 2.4;
              b.bleedDps = 2.5 + p.tower.tier;
              b.bleedSource = p.tower;
            }
            // Ninja Signature: 4-Stack Shadow Assassination!
            if (p.tower.type === 'ninja') {
              b.shadowMarks = (b.shadowMarks || 0) + 1;
              if (b.shadowMarks >= 4) {
                b.shadowMarks = 0;
                const execDmg = Math.min(95, 10 + p.tower.tier * 4 + Math.round(b.maxHp * 0.045));
                this.effects.spawnShockwave(hitPos, 1.65, 0xa855f7, 0.25);
                this.effects.spawnBeam(
                  [hitPos.clone().add(new THREE.Vector3(-0.9, 0.9, -0.9)), hitPos.clone().add(new THREE.Vector3(0.9, 0.9, 0.9))],
                  0xe879f9,
                  0.18
                );
                this.effects.spawnBeam(
                  [hitPos.clone().add(new THREE.Vector3(-0.9, 0.9, 0.9)), hitPos.clone().add(new THREE.Vector3(0.9, 0.9, -0.9))],
                  0xe879f9,
                  0.18
                );
                this.effects.spawnFloatingText(hitPos, `⚡瞬影斩 -${execDmg}!`, '#e879f9');
                this.damageBloon(b, execDmg, 'normal', p.tower);
              }
            }
            if (p.isCrit && this.bloons.includes(b)) {
              this.effects.spawnCritBurst(hitPos);
              this.effects.spawnFloatingText(hitPos, '💥暴击!', '#facc15');
              // Dart Signature: Crit Ricochet!
              if (p.tower.type === 'dart') {
                let ricoTarget = null;
                let ricoDist = 3.8;
                for (const cand of this.bloons) {
                  if (cand === b || p.hitIds.has(cand.id)) continue;
                  if (cand.camo && !p.tower.stats.canSeeCamo) continue;
                  const rd = cand.mesh.position.distanceTo(hitPos);
                  if (rd < ricoDist) {
                    ricoDist = rd;
                    ricoTarget = cand;
                  }
                }
                if (ricoTarget) {
                  this.effects.spawnBeam([hitPos.clone().setY(0.9), ricoTarget.mesh.position.clone().setY(0.9)], 0xfde047, 0.14);
                  this.damageBloon(ricoTarget, p.damage, p.tower.stats.damageType, p.tower);
                }
              }
            }
            if (this.bloons.includes(b)) {
              this.damageBloon(b, p.damage, p.tower.stats.damageType, p.tower);
            }
            p.pierceLeft -= 1;
          }

          if (p.pierceLeft <= 0) break;
        }
      }

      if (p.pierceLeft <= 0) {
        this._removeProjectile(i);
      }
    }
  }

  _dealAreaDamage(center, radius, damage, damageType, maxTargets = 20, sourceTower = null, applyNapalm = false) {
    let hits = 0;
    for (const b of [...this.bloons]) {
      if (hits >= maxTargets) break;
      if (sourceTower && b.camo && !sourceTower.stats.canSeeCamo) continue;
      const d = Math.hypot(b.mesh.position.x - center.x, b.mesh.position.z - center.z);
      if (d <= radius + (BLOON_TYPES[b.type].isMoab ? 0.9 : 0.3)) {
        if (sourceTower?.stats.stunDuration > 0) {
          b.stunTimer = Math.max(b.stunTimer, sourceTower.stats.stunDuration);
        }
        // Cannon Signature: Concussive Knockback & Armor Shred!
        if (sourceTower?.type === 'cannon') {
          if (!BLOON_TYPES[b.type].isMoab) {
            b.progress = Math.max(0, b.progress - 0.014);
          }
          b.brittleBonus = Math.max(b.brittleBonus || 0, 1);
          b.brittleTimer = Math.max(b.brittleTimer || 0, 3.2);
          if (applyNapalm) {
            b.burnTimer = Math.max(b.burnTimer || 0, 2.2);
            b.burnDps = Math.max(b.burnDps || 0, 4);
          }
        }
        this.damageBloon(b, damage, damageType, sourceTower);
        hits++;
      }
    }
  }

  _removeProjectile(idx) {
    const p = this.projectiles[idx];
    this.scene.remove(p.mesh);
    this.projectiles.splice(idx, 1);
  }

  _spawnCoin(x, z, value) {
    if (this.coins.length > 18) return;
    if (!this._coinMat) {
      this._coinMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        metalness: 0.88,
        roughness: 0.16
      });
    }
    const mesh = new THREE.Mesh(this.coinGeo, this._coinMat);
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.6 + Math.random() * 1.4;
    mesh.position.set(x, 1.55, z);
    this.scene.add(mesh);
    this.coins.push({
      mesh,
      value,
      vx: Math.cos(ang) * spd,
      vy: 4.2,
      vz: Math.sin(ang) * spd,
      grounded: false,
      magnetX: null,
      magnetZ: null,
      life: 9.5
    });
  }

  _updateCoins(dt) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.life -= dt;
      c.mesh.rotation.z += dt * 4.2;

      if (this.settings?.autoCollectCoins && c.magnetX === null && c.life < 8.85) {
        c.magnetX = 0;
        c.magnetZ = 0;
      }

      if (c.magnetX !== null) {
        c.mesh.position.x = THREE.MathUtils.lerp(c.mesh.position.x, c.magnetX, dt * 14);
        c.mesh.position.z = THREE.MathUtils.lerp(c.mesh.position.z, c.magnetZ, dt * 14);
        if (Math.hypot(c.mesh.position.x - c.magnetX, c.mesh.position.z - c.magnetZ) < 0.7) {
          this.collectCoin(i);
          continue;
        }
      } else if (!c.grounded) {
        c.vy -= 13.5 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        if (c.mesh.position.y <= 0.55) {
          c.mesh.position.y = 0.55;
          if (Math.abs(c.vy) > 1.2) {
            c.vy = -c.vy * 0.42;
            c.vx *= 0.5;
            c.vz *= 0.5;
          } else {
            c.grounded = true;
          }
        }
      } else {
        c.mesh.position.y = 0.55 + Math.sin(c.life * 4) * 0.08;
      }

      if (c.life <= 0) {
        this.collectCoin(i);
      }
    }
  }

  collectCoinsNear(worldX, worldZ, radius = 3.8) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const d = Math.hypot(c.mesh.position.x - worldX, c.mesh.position.z - worldZ);
      if (d <= 1.5) {
        this.collectCoin(i);
      } else if (d <= radius) {
        c.magnetX = worldX;
        c.magnetZ = worldZ;
      }
    }
    for (let i = this.supplyCrates.length - 1; i >= 0; i--) {
      const cr = this.supplyCrates[i];
      const d = Math.hypot(cr.mesh.position.x - worldX, cr.mesh.position.z - worldZ);
      if (d <= 2.3 && cr.mesh.position.y < 3.5) {
        this.collectSupplyCrate(i);
      }
    }
  }

  collectCoin(idx) {
    const c = this.coins[idx];
    if (!c) return;
    this.cash += c.value;
    this.sound.playCoin();
    this.effects.spawnPopBurst(c.mesh.position, 0xfacc15, 4, 0.65);
    this.effects.spawnFloatingText(c.mesh.position, `+$${c.value}`, '#fde047');
    this.scene.remove(c.mesh);
    this.coins.splice(idx, 1);
    this.notifyState();
  }

  _spawnSupplyCrate() {
    if (this.supplyCrates.length >= 2) return;
    if (!this._crateBoxGeo) {
      this._crateBoxGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
      this._crateBandGeo = new THREE.BoxGeometry(0.92, 0.22, 0.92);
      this._crateChuteGeo = new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
      this._crateBoxMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.52, metalness: 0.25 });
      this._crateGoldMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.15,
        metalness: 0.85,
        roughness: 0.2
      });
      this._crateChuteMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.4
      });
    }
    const g = new THREE.Group();
    const box = new THREE.Mesh(this._crateBoxGeo, this._crateBoxMat);
    box.castShadow = true;
    g.add(box);
    const b1 = new THREE.Mesh(this._crateBandGeo, this._crateGoldMat);
    const b2 = new THREE.Mesh(this._crateBandGeo, this._crateGoldMat);
    b2.rotation.z = Math.PI / 2;
    g.add(b1, b2);

    const chute = new THREE.Mesh(this._crateChuteGeo, this._crateChuteMat);
    chute.position.y = 1.35;
    g.add(chute);
    g.userData.chute = chute;

    const x = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 11;
    g.position.set(x, 10.5, z);
    this.scene.add(g);
    this.supplyCrates.push({ mesh: g, landed: false, life: 16 });
    this.onToast('🎁 空投奇遇补给箱已降落！滑过即可开启随机秘宝奖励！', 'info');
  }

  _updateSupplyCrates(dt) {
    const now = performance.now() * 0.001;
    for (let i = this.supplyCrates.length - 1; i >= 0; i--) {
      const cr = this.supplyCrates[i];
      cr.life -= dt;
      if (!cr.landed) {
        cr.mesh.position.y -= dt * 3.1;
        cr.mesh.rotation.z = Math.sin(now * 3.4 + i) * 0.14;
        cr.mesh.rotation.y += dt * 1.1;
        if (cr.mesh.position.y <= 0.55) {
          cr.mesh.position.y = 0.55;
          cr.mesh.rotation.z = 0;
          cr.landed = true;
          if (cr.mesh.userData.chute) cr.mesh.userData.chute.visible = false;
          this.effects.spawnShockwave(cr.mesh.position, 1.8, 0xfacc15, 0.3);
        }
      } else {
        cr.mesh.rotation.y += dt * 1.8;
        cr.mesh.position.y = 0.55 + Math.sin(now * 4.2 + i) * 0.1;
        if (this.settings?.autoCollectCoins && cr.life < 14.8) {
          this.collectSupplyCrate(i);
          continue;
        }
      }
      if (cr.life <= 0) {
        this.collectSupplyCrate(i);
      }
    }
  }

  collectSupplyCrate(idx) {
    const cr = this.supplyCrates[idx];
    if (!cr) return;
    const pos = cr.mesh.position.clone();
    this.sound.playPlace(true);
    this.effects.spawnShockwave(pos, 2.4, 0x38bdf8, 0.35);
    this.effects.spawnPopBurst(pos, 0xfde047, 10, 1.1);

    const roll = Math.random();
    if (roll < 0.45) {
      const gold = 95 + this.wave * 4;
      this.cash += gold;
      this.effects.spawnFloatingText(pos, `🎁 空投军饷 +$${gold}!`, '#fde047');
    } else if (roll < 0.78) {
      this.abilityCooldowns = { meteor: 0, frostNova: 0, overclock: 0 };
      this.cash += 45;
      this.effects.spawnFloatingText(pos, '🎁 全大招冷却清零 +$45!', '#38bdf8');
    } else {
      this._gainCommanderXp(95);
      this.effects.spawnFloatingText(pos, '🎁 指挥官经验 +95 XP!', '#c084fc');
    }

    this.scene.remove(cr.mesh);
    this.supplyCrates.splice(idx, 1);
    this.notifyState();
  }

  getSnapshot() {
    const sel = this.getSelectedTower();
    const targetWaveNum = Math.max(1, this.waveActive ? this.wave : this.wave + 1);
    const waveCfg = getWaveConfig(targetWaveNum);

    // Summarize bloon groups for visual forecast radar
    const chipMap = new Map();
    let hasCamoThreat = false;
    let hasLeadThreat = false;
    for (const g of waveCfg.groups) {
      if (g.camo) hasCamoThreat = true;
      if (g.type === 'lead') hasLeadThreat = true;
      const key = `${g.type}_${g.camo ? 'c' : ''}_${g.regrow ? 'r' : ''}_${g.fortified ? 'f' : ''}`;
      const prev = chipMap.get(key) || { type: g.type, count: 0, camo: g.camo, regrow: g.regrow, fortified: g.fortified };
      prev.count += g.count;
      chipMap.set(key, prev);
    }
    const waveForecast = Array.from(chipMap.values()).map((c) => {
      const bDef = BLOON_TYPES[c.type];
      const prefix = `${c.camo ? '👁️迷彩' : ''}${c.regrow ? '💚再生' : ''}${c.fortified ? '🛡️强化' : ''}`;
      return {
        label: `${prefix}${bDef.name} ×${c.count}`,
        color: '#' + bDef.color.toString(16).padStart(6, '0'),
        isBoss: Boolean(bDef.isMoab)
      };
    });

    const hasCamoDefense = this.towers.some((t) => !t.stats.isSupport && t.stats.canSeeCamo);
    const hasLeadDefense = this.towers.some((t) => !t.stats.isSupport && t.stats.damageType !== 'sharp');

    const wDef = WEATHER_TYPES[this.currentWeather] || WEATHER_TYPES.clear;
    const disc = this.cardMods?.costDiscount || 1.0;

    let topBoss = null;
    for (const b of this.bloons) {
      if (!BLOON_TYPES[b.type].isMoab) continue;
      if (!topBoss || b.maxHp > topBoss.maxHp || (b.maxHp === topBoss.maxHp && b.progress > topBoss.progress)) {
        topBoss = b;
      }
    }
    this._hadActiveBoss = Boolean(topBoss);

    return {
      mapId: this.currentMapId,
      settings: { ...(this.settings || DEFAULT_SETTINGS) },
      starGems: this.meta?.gems || 0,
      metaUpgrades: { ...(this.meta?.upgrades || DEFAULT_META.upgrades) },
      feverGauge: Math.round(this.feverGauge || 0),
      feverActive: (this.feverTimer || 0) > 0,
      feverRemaining: Number((this.feverTimer || 0).toFixed(1)),
      bountyArmed: Boolean(this.bountyArmed),
      bountyWaveActive: Boolean(this.bountyWaveActive),
      evolutionPhase: this.evolutionPhase || 0,
      weather: { id: wDef.id, name: wDef.name, icon: wDef.icon, buffText: wDef.buffText },
      commanderLevel: this.commanderLevel || 1,
      commanderXp: this.commanderXp || 0,
      commanderNextXp: this.commanderNextXp || 120,
      pendingDrafts: this.pendingDrafts || 0,
      currentDraftChoices: this.currentDraftChoices || [],
      activeCards: this.activeCards || [],
      activeBoss: topBoss
        ? {
            name: BLOON_TYPES[topBoss.type].name,
            hp: Math.max(0, Math.ceil(topBoss.hp)),
            maxHp: topBoss.maxHp,
            type: topBoss.type
          }
        : null,
      cash: this.cash,
      lives: this.lives,
      wave: this.wave,
      targetWaveNum,
      waveActive: this.waveActive,
      autoStart: this.autoStart,
      gameSpeed: this.gameSpeed,
      totalPops: this.totalPops,
      comboCount: this.comboCount,
      score: this.score,
      gameOver: this.gameOver,
      victory: this.victory,
      freeplay: this.freeplay,
      bloonCount: this.bloons.length,
      towerCount: this.towers.length,
      placingType: this.placingType,
      abilityCooldowns: { ...this.abilityCooldowns },
      overclockActive: this.overclockTimer > 0,
      nextWaveHint: waveCfg.hint,
      waveForecast,
      missingCamo: hasCamoThreat && !hasCamoDefense,
      missingLead: hasLeadThreat && !hasLeadDefense,
      selectedTower: sel
        ? {
            id: sel.id,
            type: sel.type,
            tier: sel.tier,
            stars: sel.stars || 0,
            isApex: Boolean(sel.isApex),
            nextUpgCost: TOWER_TYPES[sel.type].upgrades[sel.tier]
              ? Math.round(TOWER_TYPES[sel.type].upgrades[sel.tier].cost * disc)
              : 0,
            ascendCost: this.getAscendCost(sel),
            canFuse: Boolean(this.findFusionPartner(sel)),
            fuseCost: Math.round(850 * disc),
            pops: sel.pops,
            targetMode: sel.targetMode,
            buffedByBeacon: sel.buffedByBeacon,
            onHighGround: Boolean(sel.onHighGround),
            sellValue: Math.round(sel.totalSpent * 0.75),
            stats: sel.stats
          }
        : null
    };
  }

  notifyState() {
    const snap = this.getSnapshot();
    if (this.sound?.setMusicContext) {
      this.sound.setMusicContext({
        mapId: snap.mapId,
        waveActive: snap.waveActive,
        isBoss: Boolean(snap.activeBoss),
        fever: Boolean(snap.feverActive)
      });
    }
    this.onStateChange(snap);
  }
}
