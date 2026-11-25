import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TOWER_TYPES, ABILITIES, MAPS } from './config/constants.js';
import { RARITY_META } from './config/cards.js';
import { SoundManager } from './audio/SoundManager.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { GameEngine, META_TECH_DEFS } from './game/GameEngine.js';

const container = document.getElementById('canvas-container');
const fxOverlay = document.getElementById('fx-overlay');

// 1. Initialize Three.js WebGL Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.info.autoReset = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
scene.environmentIntensity = 0.22;
roomEnv.dispose();
pmremGenerator.dispose();

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.5, 180);
camera.position.set(0, 23.2, 21.2);

// Post-processing selective HDR Bloom pipeline (threshold > 1.0 ensures only HDR emissive VFX glow!)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.44, // vivid glow on HDR plasma/fire/meteors
  0.42, // radius
  1.08  // strict HDR threshold: diffuse grass/roads never bloom
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0.6);
controls.minDistance = 11;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI * 0.44;
controls.minPolarAngle = 0.22;
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};

// Three-point stylized PBR lighting setup
const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.78);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.36);
dirLight.position.set(15, 28, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -22;
dirLight.shadow.camera.right = 22;
dirLight.shadow.camera.top = 16;
dirLight.shadow.camera.bottom = -16;
dirLight.shadow.camera.near = 2;
dirLight.shadow.camera.far = 62;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.48);
rimLight.position.set(-16, 12, -14);
scene.add(rimLight);

// Invisible ground plane for exact mouse raycasting
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const hitPoint = new THREE.Vector3();

// 2. Sound, Effects & Core Engine
const sound = new SoundManager();
const effects = new EffectsManager(scene, camera, fxOverlay);

function showToast(msg, type = 'info', silent = false) {
  if (silent) return;
  const wrap = document.getElementById('toast-container');
  // Deduplicate identical consecutive toast messages
  if (wrap.lastElementChild && wrap.lastElementChild.textContent === msg) {
    return;
  }
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  while (wrap.children.length > 2) {
    wrap.firstChild.remove();
  }
  setTimeout(() => el.remove(), 2600);
}

// UI Elements
const elCash = document.getElementById('hud-cash');
const elLives = document.getElementById('hud-lives');
const elWave = document.getElementById('hud-wave');
const elPops = document.getElementById('hud-pops');
const elMapName = document.getElementById('hud-map-name');
const elHint = document.getElementById('wave-hint-text');
const btnStartWave = document.getElementById('btn-start-wave');
const btnSpeed = document.getElementById('btn-speed');
const btnAuto = document.getElementById('btn-auto');
const btnMute = document.getElementById('btn-mute');
const btnCam = document.getElementById('btn-cam');
const inspectorPanel = document.getElementById('inspector-panel');
const modalBackdrop = document.getElementById('modal-backdrop');
let mapModalOpen = false;

const abilityListEl = document.getElementById('ability-list');
const towerCardsEl = document.getElementById('tower-cards');

let latestState = null;
let engine = null;

// Build Tower Shop Cards
Object.values(TOWER_TYPES).forEach((t) => {
  const btn = document.createElement('button');
  btn.className = 'tower-card';
  btn.dataset.type = t.id;
  btn.innerHTML = `
    <span class="tower-hotkey">${t.hotkey}</span>
    <span class="tower-icon">${t.icon}</span>
    <span class="tower-name">${t.name}</span>
    <span class="tower-role">${t.subtitle}</span>
    <span class="tower-cost">$${t.cost}</span>
  `;
  btn.addEventListener('click', () => {
    sound.init();
    if (!engine) return;
    if (engine.placingType === t.id) {
      engine.setPlacingTower(null);
    } else {
      engine.setPlacingTower(t.id);
    }
  });
  towerCardsEl.appendChild(btn);
});

// Build Active Ability Buttons
Object.values(ABILITIES).forEach((ab) => {
  const btn = document.createElement('button');
  btn.className = 'ability-btn';
  btn.dataset.ability = ab.id;
  btn.title = `${ab.name} (${ab.hotkey}): ${ab.desc}`;
  btn.innerHTML = `
    <span class="ability-icon">${ab.icon}</span>
    <span class="ability-label" id="ab-cd-${ab.id}">${ab.hotkey} 就绪</span>
  `;
  btn.addEventListener('click', () => {
    sound.init();
    if (engine) engine.useAbility(ab.id);
  });
  abilityListEl.appendChild(btn);
});

const draftBackdrop = document.getElementById('draft-backdrop');
const draftCardsWrap = document.getElementById('draft-cards-wrap');
const btnOpenDraft = document.getElementById('btn-open-draft');
let draftModalOpen = false;
let draftDeferredWave = -1;
let headlessSimRunning = false;
let lastDraftRenderSig = '';
let lastDraftPickAt = 0;

engine = new GameEngine({
  scene,
  camera,
  effects,
  sound,
  onStateChange: (snap) => {
    latestState = snap;
    renderUI(snap);
  },
  onToast: showToast,
  onSettingsChange: (s) => {
    bloomPass.enabled = Boolean(s.bloomEnabled);
    renderer.setPixelRatio(s.bloomEnabled ? Math.min(window.devicePixelRatio, 2) : 1);
  }
});

function triggerDraftCardPick(idx) {
  const now = performance.now();
  if (now - lastDraftPickAt < 160) return;
  lastDraftPickAt = now;
  sound.init();
  const picked = engine.pickDraftCard(idx);
  if (picked && engine.pendingDrafts <= 0) {
    draftModalOpen = false;
    lastDraftRenderSig = '';
    draftBackdrop.classList.add('hidden');
  }
}

function renderDraftModal(snap, forceRebuild = false) {
  if (!draftBackdrop || !draftCardsWrap) return;
  if (!snap.pendingDrafts || snap.currentDraftChoices.length === 0) {
    draftModalOpen = false;
    lastDraftRenderSig = '';
    draftBackdrop.classList.add('hidden');
    return;
  }

  const rerollBtn = document.getElementById('btn-reroll-draft');
  if (rerollBtn) {
    rerollBtn.disabled = snap.cash < 80;
  }

  // CRITICAL FIX: Never wipe & recreate .draft-card DOM nodes unless choices actually changed!
  const sig = `${snap.pendingDrafts}:${snap.currentDraftChoices.map((c) => c.id).join(',')}`;
  if (!forceRebuild && sig === lastDraftRenderSig && draftCardsWrap.children.length === snap.currentDraftChoices.length) {
    return;
  }
  lastDraftRenderSig = sig;

  draftCardsWrap.innerHTML = '';
  snap.currentDraftChoices.forEach((card, idx) => {
    const rMeta = RARITY_META[card.rarity] || RARITY_META.rare;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `draft-card ${card.rarity}`;
    el.dataset.cardIdx = String(idx);
    el.innerHTML = `
      <span class="draft-rarity">${rMeta.label}</span>
      <div class="draft-icon">${card.icon}</div>
      <div class="draft-name">${card.name}</div>
      <span class="draft-tag">${card.tag}</span>
      <p class="draft-desc">${card.desc}</p>
      <div class="draft-pick-hint">⚡ 点击立即激活 [${idx + 1}]</div>
    `;
    el.addEventListener('pointerup', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.stopPropagation();
      triggerDraftCardPick(idx);
    });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      triggerDraftCardPick(idx);
    });
    draftCardsWrap.appendChild(el);
  });
}

function openDraftModal() {
  if (!latestState || latestState.pendingDrafts <= 0) return;
  draftModalOpen = true;
  renderDraftModal(latestState, true);
  draftBackdrop.classList.remove('hidden');
}

function renderUI(snap) {
  elCash.textContent = snap.cash;
  elLives.textContent = snap.lives;
  elWave.textContent = snap.wave;
  elPops.textContent = snap.totalPops;

  // Commander Level & XP bar
  const elCmdLv = document.getElementById('hud-cmd-lv');
  const elCmdXp = document.getElementById('hud-cmd-xp');
  if (elCmdLv && elCmdXp) {
    elCmdLv.textContent = snap.commanderLevel || 1;
    const pct = Math.min(100, Math.round(((snap.commanderXp || 0) / Math.max(1, snap.commanderNextXp || 120)) * 100));
    elCmdXp.style.width = `${pct}%`;
  }

  // Fever Overdrive Gauge & Star Gems Counter
  const elFeverChip = document.getElementById('hud-fever-chip');
  const elFeverLabel = document.getElementById('hud-fever-label');
  const elFeverFill = document.getElementById('hud-fever-fill');
  if (elFeverChip && elFeverLabel && elFeverFill) {
    if (snap.feverActive) {
      elFeverChip.classList.add('active');
      elFeverLabel.textContent = `🔥 狂暴 ${Math.ceil(snap.feverRemaining || 1)}s`;
      elFeverFill.style.width = `${Math.min(100, Math.round(((snap.feverRemaining || 0) / 8) * 100))}%`;
    } else {
      elFeverChip.classList.remove('active');
      elFeverLabel.textContent = '🔥 超载';
      elFeverFill.style.width = `${snap.feverGauge || 0}%`;
    }
  }
  const elGems = document.getElementById('hud-gems');
  if (elGems) {
    elGems.textContent = snap.starGems ?? 0;
  }

  // Pre-Wave Elite Bounty Toggle Button
  const btnBounty = document.getElementById('btn-bounty');
  if (btnBounty) {
    btnBounty.disabled = Boolean(snap.waveActive);
    btnBounty.classList.toggle('armed', Boolean(snap.bountyArmed));
    btnBounty.classList.toggle('active-wave', Boolean(snap.bountyWaveActive));
    if (snap.bountyWaveActive) {
      btnBounty.textContent = '🔥 恶魔悬赏激战中 (+65%)';
    } else if (snap.bountyArmed) {
      btnBounty.textContent = '⚔️ 悬赏已签 (+65%赏金/2💎)';
    } else {
      btnBounty.textContent = '⚔️ 悬赏加倍';
    }
  }

  // Weather HUD Chip
  if (snap.weather) {
    const wChip = document.getElementById('hud-weather-chip');
    const wIcon = document.getElementById('hud-weather-icon');
    const wName = document.getElementById('hud-weather-name');
    if (wChip && wIcon && wName) {
      wIcon.textContent = snap.weather.icon;
      wName.textContent = snap.weather.name;
      wChip.title = `${snap.weather.icon} ${snap.weather.name}：${snap.weather.buffText}`;
    }
  }

  // Draft Alert Button & Auto-Popup
  if (btnOpenDraft) {
    if (snap.pendingDrafts > 0) {
      btnOpenDraft.classList.remove('hidden');
      document.getElementById('hud-draft-count').textContent = snap.pendingDrafts;
      if (!headlessSimRunning && !draftModalOpen && draftDeferredWave !== snap.wave && !snap.gameOver && !snap.victory) {
        openDraftModal();
      } else if (draftModalOpen) {
        renderDraftModal(snap, false);
      }
    } else {
      btnOpenDraft.classList.add('hidden');
      draftModalOpen = false;
      lastDraftRenderSig = '';
      if (draftBackdrop) draftBackdrop.classList.add('hidden');
    }
  }

  // Active Roguelike Relics Bar
  const relicBar = document.getElementById('relic-bar');
  if (relicBar && snap.activeCards) {
    relicBar.innerHTML = snap.activeCards
      .map(
        (c) =>
          `<div class="relic-pill ${c.rarity}" title="${c.name}：${c.desc}"><span>${c.icon}</span><span>${c.name}${c.count > 1 ? ` ×${c.count}` : ''}</span></div>`
      )
      .join('');
  }

  // Top Boss Health Bar
  const bossHud = document.getElementById('boss-hud-bar');
  if (bossHud) {
    if (snap.activeBoss) {
      bossHud.classList.remove('hidden');
      const bIcon = snap.activeBoss.type === 'golden' ? '🪙' : (snap.activeBoss.type === 'zomg' ? '🐉' : '👑');
      document.getElementById('boss-hud-name').textContent = `${bIcon} ${snap.activeBoss.name}`;
      document.getElementById('boss-hud-hp').textContent = `${snap.activeBoss.hp} / ${snap.activeBoss.maxHp}`;
      const pct = Math.max(2, Math.min(100, (snap.activeBoss.hp / Math.max(1, snap.activeBoss.maxHp)) * 100));
      document.getElementById('boss-hp-fill').style.width = `${pct.toFixed(1)}%`;
    } else {
      bossHud.classList.add('hidden');
    }
  }

  const comboChip = document.getElementById('hud-combo-chip');
  const comboVal = document.getElementById('hud-combo');
  if (comboChip && comboVal) {
    if (snap.comboCount >= 10) {
      comboVal.textContent = snap.comboCount;
      comboChip.classList.remove('hidden');
    } else {
      comboChip.classList.add('hidden');
    }
  }
  elMapName.textContent = MAPS[snap.mapId]?.name || snap.mapId;
  elHint.textContent = snap.nextWaveHint;

  // Dynamic per-map lighting atmosphere
  if (renderUI._lastMap !== snap.mapId) {
    renderUI._lastMap = snap.mapId;
    if (snap.mapId === 'volcano') {
      hemiLight.color.setHex(0xfed7aa);
      hemiLight.groundColor.setHex(0x451a03);
      rimLight.color.setHex(0xf97316);
      rimLight.intensity = 0.72;
    } else if (snap.mapId === 'glacier') {
      hemiLight.color.setHex(0xe0f2fe);
      hemiLight.groundColor.setHex(0x334155);
      rimLight.color.setHex(0x38bdf8);
      rimLight.intensity = 0.65;
    } else {
      hemiLight.color.setHex(0xf0f9ff);
      hemiLight.groundColor.setHex(0x334155);
      rimLight.color.setHex(0x7dd3fc);
      rimLight.intensity = 0.48;
    }
  }

  // Wave Forecast Chips & Smart Counter Warnings
  const forecastEl = document.getElementById('wave-forecast-chips');
  if (forecastEl && snap.waveForecast) {
    forecastEl.innerHTML = `<span style="font-size:11px;color:#94a3b8;font-weight:700;">W${snap.targetWaveNum}:</span>` +
      snap.waveForecast
        .map((c) => `<span class="forecast-chip"><i class="forecast-dot" style="background:${c.color}"></i>${c.label}</span>`)
        .join('');
  }
  const warnEl = document.getElementById('wave-warning-badge');
  if (warnEl) {
    if (snap.missingCamo) {
      warnEl.textContent = '⚠️ 缺反隐! 推荐忍者/狙击';
      warnEl.classList.remove('hidden');
    } else if (snap.missingLead) {
      warnEl.textContent = '⚠️ 缺破甲! 推荐重炮/雷电';
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }
  }

  // Wave button
  if (snap.waveActive) {
    btnStartWave.disabled = true;
    btnStartWave.innerHTML = `⚔️ 第 ${snap.wave} 波交战中`;
  } else {
    btnStartWave.disabled = false;
    btnStartWave.innerHTML = `▶ 第 ${snap.wave + 1} 波 <kbd>Space</kbd>`;
  }

  btnSpeed.textContent = `⏩ ${snap.gameSpeed}x`;
  btnSpeed.classList.toggle('active', snap.gameSpeed > 1);

  btnAuto.textContent = `🔄 ${snap.autoStart ? '自动:开' : '自动'}`;
  btnAuto.classList.toggle('active', snap.autoStart);

  // Shop affordability, selection & smart counter recommendation highlight
  document.querySelectorAll('.tower-card').forEach((card) => {
    const tDef = TOWER_TYPES[card.dataset.type];
    const recommend =
      (snap.missingCamo && (tDef.id === 'ninja' || tDef.id === 'sniper')) ||
      (snap.missingLead && (tDef.id === 'cannon' || tDef.id === 'tesla' || tDef.id === 'sniper'));
    card.classList.toggle('selected', snap.placingType === tDef.id);
    card.classList.toggle('unaffordable', snap.cash < tDef.cost);
    card.classList.toggle('recommend-counter', Boolean(recommend && snap.cash >= tDef.cost));
  });

  // Ability buttons
  Object.values(ABILITIES).forEach((ab) => {
    const cd = snap.abilityCooldowns[ab.id] || 0;
    const btn = abilityListEl.querySelector(`[data-ability="${ab.id}"]`);
    const label = document.getElementById(`ab-cd-${ab.id}`);
    if (btn && label) {
      btn.disabled = cd > 0;
      label.textContent = cd > 0 ? `${Math.ceil(cd)}s` : `${ab.hotkey} 就绪`;
    }
  });

  // Selected Tower Inspector
  if (!snap.selectedTower) {
    inspectorPanel.classList.add('hidden');
  } else {
    inspectorPanel.classList.remove('hidden');
    const st = snap.selectedTower;
    const def = TOWER_TYPES[st.type];
    const starText = st.stars > 0 ? ` ★${st.stars}` : '';
    const apexPrefix = st.isApex ? '🧬神装·' : '';
    document.getElementById('insp-name').textContent = `${def.icon} ${apexPrefix}${def.name}${starText}`;
    document.getElementById('insp-pops').textContent = st.pops;
    document.getElementById('insp-buff-badge').classList.toggle('hidden', !st.buffedByBeacon);

    const liveStatsEl = document.getElementById('insp-live-stats');
    if (liveStatsEl) {
      if (st.stats.isSupport) {
        liveStatsEl.innerHTML = `
          <span class="insp-stat-pill">💰 波次赏金 +$${st.stats.incomePerWave}</span>
          <span class="insp-stat-pill">⚡ 攻速光环 +${Math.round((st.stats.buffFireRate - 1) * 100)}%</span>
          ${st.isApex ? '<span class="insp-stat-pill tag">🧬 觉醒合体</span>' : ''}
          ${st.stats.grantCamoAura ? '<span class="insp-stat-pill tag">👁️ 全员反隐</span>' : ''}
          ${st.stats.grantMIB ? '<span class="insp-stat-pill tag">🛡️ 无视免疫</span>' : ''}
        `;
      } else {
        liveStatsEl.innerHTML = `
          <span class="insp-stat-pill">⚔️ 伤害 ${st.stats.damage}</span>
          <span class="insp-stat-pill">⚡ 攻速 ${st.stats.fireRate.toFixed(1)}/s</span>
          <span class="insp-stat-pill">🎯 ${st.stats.isLightning ? `连锁 ${st.stats.chainCount}` : `穿透 ${st.stats.pierce}`}</span>
          ${st.isApex ? '<span class="insp-stat-pill tag">🧬 觉醒+75%</span>' : ''}
          ${st.onHighGround ? '<span class="insp-stat-pill tag">🏔️ 高台增益</span>' : ''}
          ${st.stats.canSeeCamo ? '<span class="insp-stat-pill tag">👁️ 反隐</span>' : ''}
          ${st.stats.damageType !== 'sharp' ? '<span class="insp-stat-pill tag">🛡️ 破铁</span>' : ''}
        `;
      }
    }

    const sigBox = document.getElementById('insp-signature-box');
    if (sigBox && def.signatureName) {
      sigBox.innerHTML = `<strong>${def.signatureName}</strong><span>${def.signatureDesc}</span>`;
    }

    const targetGroup = document.getElementById('insp-target-group');
    targetGroup.classList.toggle('hidden', Boolean(def.isSupport));
    document.querySelectorAll('.target-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.mode === st.targetMode);
    });

    const dotsWrap = document.getElementById('insp-tier-dots');
    dotsWrap.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.className = `tier-dot ${i < st.tier ? 'filled' : ''}`;
      dotsWrap.appendChild(dot);
    }

    const nextUpg = def.upgrades[st.tier];
    const btnUpg = document.getElementById('btn-upgrade');
    if (nextUpg) {
      const upgCost = st.nextUpgCost || nextUpg.cost;
      document.getElementById('insp-upg-name').textContent = `Lv.${st.tier + 1} ${nextUpg.name}`;
      document.getElementById('insp-upg-desc').textContent = nextUpg.desc;
      btnUpg.classList.remove('ascend', 'hidden');
      btnUpg.disabled = snap.cash < upgCost;
      btnUpg.innerHTML = `⬆ 升级 ($${upgCost}) <kbd>U</kbd>`;
    } else if (st.stars < 5) {
      document.getElementById('insp-upg-name').textContent = `🌟 巅峰突破 (★${st.stars} → ★${st.stars + 1})`;
      document.getElementById('insp-upg-desc').textContent = '不占额外空位，伤害 +25%、攻速 +12%、穿透/连锁提升！';
      btnUpg.classList.add('ascend');
      btnUpg.classList.remove('hidden');
      btnUpg.disabled = snap.cash < st.ascendCost;
      btnUpg.innerHTML = `🌟 巅峰升星 ($${st.ascendCost}) <kbd>U</kbd>`;
    } else {
      document.getElementById('insp-upg-name').textContent = '🌌 已达五耀神话之巅 (★5 MAX)';
      document.getElementById('insp-upg-desc').textContent = def.upgrades[3].desc;
      btnUpg.classList.add('hidden');
    }

    const btnFuse = document.getElementById('btn-fuse');
    if (btnFuse) {
      if (st.canFuse) {
        btnFuse.classList.remove('hidden');
        btnFuse.disabled = snap.cash < st.fuseCost;
        btnFuse.innerHTML = `🧬 吞并同系合体·腾出空位 ($${st.fuseCost}) <kbd>F</kbd>`;
      } else {
        btnFuse.classList.add('hidden');
      }
    }

    document.getElementById('insp-sell-val').textContent = st.sellValue;
  }

  // Clear stale toasts from previous match when starting fresh at Wave 0
  if (snap.wave === 0 && !snap.waveActive) {
    document.getElementById('toast-container').innerHTML = '';
  }

  // Victory / Game Over Modal
  if (snap.gameOver) {
    mapModalOpen = false;
    const rec = engine.getRecords()[snap.mapId];
    openEndModal(
      '💀 防线失守！',
      `坚持到了第 ${snap.wave} 波 · 累计击破 ${snap.totalPops} · 历史最高第 ${rec?.bestWave || snap.wave} 波`,
      false
    );
  } else if (snap.victory && !snap.freeplay) {
    mapModalOpen = false;
    openEndModal(
      '🏆 完美通关 30 波！荣获传奇金牌！',
      `成功击溃 ZOMG 翡翠泰坦舰与幽灵隐形艇！总分 ${snap.score} · 击破 ${snap.totalPops}`,
      true
    );
  } else if (!mapModalOpen) {
    modalBackdrop.classList.add('hidden');
  }
}

function getMedalBadge(rec) {
  if (!rec || !rec.bestWave) return '⚪ 未挑战';
  if (rec.bestWave >= 40) return `💎 传奇无尽 (最高 ${rec.bestWave} 波)`;
  if (rec.victory || rec.bestWave >= 30) return `🥇 完美金牌 (最高 ${rec.bestWave} 波)`;
  if (rec.bestWave >= 20) return `🥈 飞艇银牌 (最高 ${rec.bestWave} 波)`;
  if (rec.bestWave >= 10) return `🥉 破甲铜牌 (最高 ${rec.bestWave} 波)`;
  return `🎈 最佳: 第 ${rec.bestWave} 波`;
}

function formatSaveTime(ts) {
  if (!ts) return '暂无记录';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Modal Logic
function openMapModal() {
  mapModalOpen = true;
  document.getElementById('modal-title').textContent = '🎈 选择 3D 战场地图';
  document.getElementById('modal-subtitle').textContent = '左键部署/选择防御塔 · 右键旋转视角 · 滚轮缩放';
  const mapCards = document.getElementById('map-cards');
  mapCards.className = 'map-cards';
  mapCards.innerHTML = '';
  const records = engine.getRecords();
  Object.values(MAPS).forEach((m) => {
    const rec = records[m.id];
    const card = document.createElement('div');
    card.className = 'map-card';
    card.innerHTML = `
      <h4>${m.name}</h4>
      <span>${m.difficulty}</span>
      <p style="margin:6px 0 4px;font-size:12px;">初始 $${m.startCash} · ❤️ ${m.startLives}</p>
      <div style="font-size:11px;color:#fde047;font-weight:700;">${getMedalBadge(rec)}</div>
    `;
    card.addEventListener('click', () => {
      sound.init();
      mapModalOpen = false;
      engine.loadMap(m.id);
      modalBackdrop.classList.add('hidden');
    });
    mapCards.appendChild(card);
  });
  const autoSlot = engine.getSaveSlotsSummary().auto;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    ${autoSlot && autoSlot.wave > 0 ? `<button class="primary-wave-btn" id="btn-resume-autosave">📂 继续自动存档 (${autoSlot.mapName} · 第 ${autoSlot.wave} 波)</button>` : ''}
    <button class="ctrl-btn" id="btn-cancel-modal">返回当前战局</button>
  `;
  const resumeBtn = document.getElementById('btn-resume-autosave');
  if (resumeBtn) {
    resumeBtn.onclick = () => {
      sound.init();
      mapModalOpen = false;
      engine.loadFromSlot('auto');
      modalBackdrop.classList.add('hidden');
    };
  }
  document.getElementById('btn-cancel-modal').onclick = () => {
    mapModalOpen = false;
    modalBackdrop.classList.add('hidden');
  };
  modalBackdrop.classList.remove('hidden');
}

function openSaveModal() {
  mapModalOpen = true;
  document.getElementById('modal-title').textContent = '💾 战局存档与跨设备读档中心';
  document.getElementById('modal-subtitle').textContent = '每波通关自动备份 · 支持 3 组手动存档槽与 Base64 存档代码分享导入';
  const mapCards = document.getElementById('map-cards');
  mapCards.className = '';

  const renderSlots = () => {
    const summary = engine.getSaveSlotsSummary();
    const slotDefs = [
      { key: 'auto', title: '🔄 自动存档槽 (每波结束自动写入)', isAuto: true },
      { key: '1', title: '📌 手动存档槽 #1', isAuto: false },
      { key: '2', title: '📌 手动存档槽 #2', isAuto: false },
      { key: '3', title: '📌 手动存档槽 #3', isAuto: false }
    ];
    mapCards.innerHTML = `
      <div class="save-slots-grid">
        ${slotDefs
          .map((sd) => {
            const info = summary[sd.key];
            return `
              <div class="save-slot-card ${sd.isAuto ? 'auto-slot' : ''}">
                <div class="save-slot-head">
                  <span>${sd.title}</span>
                  <span class="save-slot-time">${info ? formatSaveTime(info.savedAt) : '空槽位'}</span>
                </div>
                <div class="save-slot-meta">
                  ${
                    info
                      ? `🗺️ <b>${info.mapName}</b> · 第 <b>${info.wave}</b> 波<br/>🪙 $${info.cash} · ❤️ ${info.lives} · 🗼 ${info.towerCount} 座塔 · 🎖️ Lv.${info.commanderLevel}`
                      : '暂无存档数据，点击下方【保存当前战局】即可写入。'
                  }
                </div>
                <div class="save-slot-btns">
                  ${!sd.isAuto ? `<button class="ctrl-btn" data-save-slot="${sd.key}">💾 保存</button>` : ''}
                  <button class="primary-wave-btn" data-load-slot="${sd.key}" ${!info ? 'disabled' : ''}>📂 读取</button>
                  ${info ? `<button class="ctrl-btn" data-del-slot="${sd.key}" title="删除该存档" style="flex:0 0 38px;">🗑️</button>` : ''}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="save-code-box">
        <div style="font-size:12px;font-weight:800;color:#bae6fd;">🔗 跨设备存档代码导出 / 导入</div>
        <div class="save-code-row">
          <input id="save-code-input" class="save-code-input" type="text" placeholder="点击右侧【生成复制代码】，或在此粘贴 BLOON3D:... 代码后点导入" />
          <button id="btn-export-code" class="ctrl-btn">📋 生成并复制</button>
          <button id="btn-import-code" class="primary-wave-btn" style="padding:6px 12px;font-size:12px;">📥 导入代码</button>
        </div>
      </div>
    `;

    mapCards.querySelectorAll('[data-save-slot]').forEach((btn) => {
      btn.onclick = () => {
        sound.init();
        engine.saveToSlot(btn.dataset.saveSlot, false);
        renderSlots();
      };
    });
    mapCards.querySelectorAll('[data-load-slot]').forEach((btn) => {
      btn.onclick = () => {
        sound.init();
        if (engine.loadFromSlot(btn.dataset.loadSlot)) {
          mapModalOpen = false;
          mapCards.className = 'map-cards';
          modalBackdrop.classList.add('hidden');
        }
      };
    });
    mapCards.querySelectorAll('[data-del-slot]').forEach((btn) => {
      btn.onclick = () => {
        engine.deleteSaveSlot(btn.dataset.delSlot);
        renderSlots();
      };
    });

    const inputEl = document.getElementById('save-code-input');
    document.getElementById('btn-export-code').onclick = async () => {
      const code = engine.exportSaveString();
      inputEl.value = code;
      inputEl.select();
      try {
        await navigator.clipboard.writeText(code);
        showToast('📋 存档代码已生成并复制到剪贴板！', 'info');
      } catch {
        showToast('📋 存档代码已生成在输入框中，请按 Cmd/Ctrl+C 复制！', 'info');
      }
    };
    document.getElementById('btn-import-code').onclick = () => {
      if (engine.importSaveString(inputEl.value)) {
        mapModalOpen = false;
        mapCards.className = 'map-cards';
        modalBackdrop.classList.add('hidden');
      }
    };
  };

  renderSlots();
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `<button class="ctrl-btn" id="btn-close-save">返回战场</button>`;
  document.getElementById('btn-close-save').onclick = () => {
    mapModalOpen = false;
    mapCards.className = 'map-cards';
    modalBackdrop.classList.add('hidden');
  };
  modalBackdrop.classList.remove('hidden');
}

function openGuideModal() {
  mapModalOpen = true;
  document.getElementById('modal-title').textContent = '📖 3.0 终极战术图鉴与新机制';
  document.getElementById('modal-subtitle').textContent = '八塔专属特技 · 狂暴超载 · 恶魔悬赏挑战 · 星辉永久科技 · 跨设备存档！';
  const mapCards = document.getElementById('map-cards');
  mapCards.className = 'guide-grid';
  mapCards.innerHTML = `
    <div class="guide-item"><strong>👁️ 迷彩 / 🛡️ 铁皮 / 🟣 紫电 / 🦓 斑马</strong>迷彩需【忍者/狙击/雷达】；铁皮免疫利器；紫电护盾免疫雷火能量（需物理飞镖/重炮）；斑马同时免疫爆炸与冰冻！</div>
    <div class="guide-item"><strong>🎯 八大防御塔鲜明绝技</strong>飞镖暴击弹射、图钉撕裂流血+日冕新星、重炮震退碎甲、冰塔碎冰斩杀、忍者四印瞬影斩、狙击猎头赏金、电塔漫游球状闪电、信标号令脉冲！</div>
    <div class="guide-item"><strong>🏔️ 战略高台 & 🧬 双塔吞并合体</strong>部署在发光符文石台上立享 <b>射程/伤害 +15%</b>；满级塔按 <code>F</code> 吞并同系塔进化【🧬神装】并<b>腾出宝贵空位</b>，还可无限升星 ★1~★5！</div>
    <div class="guide-item"><strong>🎴 秘宝抽卡 & 🔥 狂暴超载时刻</strong>击破气球积攒超载槽，满值自动开启 8 秒全军暴走！开波前还可勾选【⚔️ 悬赏加倍挑战】赢双倍经验、赏金与星辉晶石！</div>
    <div class="guide-item"><strong>💎 星辉科技馆 & 💾 完整存档系统</strong>通关波次与斩杀飞艇可获得永久【星辉晶石】升级局外科技树；每波自动存档，支持 3 槽手动存取与代码导入导出！</div>
    <div class="guide-item"><strong>⌨️ 全键盘流快捷键</strong><code>1-8</code> 选塔 · <code>Space</code> 发兵 · <code>U</code> 升级/升星 · <code>F</code> 双塔合体 · <code>C</code> 抽卡 · <code>Q/W/E</code> 毁天灭地大招</div>
  `;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `<button class="primary-wave-btn" id="btn-close-guide">明白了，返回战场</button>`;
  document.getElementById('btn-close-guide').onclick = () => {
    mapModalOpen = false;
    mapCards.className = 'map-cards';
    modalBackdrop.classList.add('hidden');
  };
  modalBackdrop.classList.remove('hidden');
}

function openSettingsModal() {
  mapModalOpen = true;
  document.getElementById('modal-title').textContent = '⚙️ 音画与辅助设置中心';
  document.getElementById('modal-subtitle').textContent = '所有偏好自动实时保存至本地 · 支持动态配乐混音、HDR 辉光与自动磁吸拾取';
  const mapCards = document.getElementById('map-cards');
  mapCards.className = '';

  const renderSettings = () => {
    const s = engine.settings;
    const toggleDefs = [
      { key: 'bgmEnabled', label: '🎵 动态交响电子配乐 (BGM)' },
      { key: 'bloomEnabled', label: '✨ HDR 辉光高画质渲染 (Bloom)' },
      { key: 'screenShake', label: '📳 爆炸与大招镜头震屏' },
      { key: 'floatingText', label: '💬 暴击与赏金飘字提示' },
      { key: 'weatherParticles', label: '🌦️ 3D 天气环境粒子场' },
      { key: 'autoPauseOnDraft', label: '⏸️ 秘宝抽卡时自动时停战场' },
      { key: 'autoCollectCoins', label: '🧲 自动磁吸拾取金币与空投箱' }
    ];

    mapCards.innerHTML = `
      <div class="settings-panel">
        <div class="settings-sliders">
          <div class="slider-row">
            <label>🔊 主音量 (Master)</label>
            <input id="sl-master" type="range" min="0" max="100" value="${Math.round(s.masterVol * 100)}" />
            <span id="val-master" class="slider-val">${Math.round(s.masterVol * 100)}%</span>
          </div>
          <div class="slider-row">
            <label>🎵 背景配乐 (BGM)</label>
            <input id="sl-bgm" type="range" min="0" max="100" value="${Math.round(s.bgmVol * 100)}" />
            <span id="val-bgm" class="slider-val">${Math.round(s.bgmVol * 100)}%</span>
          </div>
          <div class="slider-row">
            <label>💥 战斗音效 (SFX)</label>
            <input id="sl-sfx" type="range" min="0" max="100" value="${Math.round(s.sfxVol * 100)}" />
            <span id="val-sfx" class="slider-val">${Math.round(s.sfxVol * 100)}%</span>
          </div>
        </div>
        <div class="settings-toggles">
          ${toggleDefs
            .map(
              (td) => `
                <button type="button" class="setting-toggle-btn ${s[td.key] ? 'on' : ''}" data-setting-key="${td.key}">
                  <span>${td.label}</span>
                  <span class="toggle-pill">${s[td.key] ? '开启' : '关闭'}</span>
                </button>
              `
            )
            .join('')}
        </div>
      </div>
    `;

    const bindSlider = (id, valId, prop) => {
      const el = document.getElementById(id);
      const vEl = document.getElementById(valId);
      el.oninput = () => {
        const v = Number(el.value) / 100;
        vEl.textContent = `${el.value}%`;
        sound.init();
        engine.updateSettings({ [prop]: v });
      };
    };
    bindSlider('sl-master', 'val-master', 'masterVol');
    bindSlider('sl-bgm', 'val-bgm', 'bgmVol');
    bindSlider('sl-sfx', 'val-sfx', 'sfxVol');

    mapCards.querySelectorAll('[data-setting-key]').forEach((btn) => {
      btn.onclick = () => {
        sound.init();
        const k = btn.dataset.settingKey;
        engine.updateSettings({ [k]: !engine.settings[k] });
        sound.playPlace(false);
        renderSettings();
      };
    });
  };

  renderSettings();
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="ctrl-btn" id="btn-reset-settings">🔄 恢复默认设置</button>
    <button class="primary-wave-btn" id="btn-close-settings">保存并返回战场</button>
  `;
  document.getElementById('btn-reset-settings').onclick = () => {
    engine.resetSettings();
    renderSettings();
    showToast('⚙️ 已恢复默认音画与辅助设置！', 'info');
  };
  document.getElementById('btn-close-settings').onclick = () => {
    mapModalOpen = false;
    mapCards.className = 'map-cards';
    modalBackdrop.classList.add('hidden');
  };
  modalBackdrop.classList.remove('hidden');
}

function openEndModal(title, subtitle, isVictory) {
  document.getElementById('map-cards').className = 'map-cards';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-subtitle').textContent = subtitle;
  document.getElementById('map-cards').innerHTML = '';
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = '';

  if (isVictory) {
    const freeBtn = document.createElement('button');
    freeBtn.className = 'primary-wave-btn';
    freeBtn.textContent = '♾️ 进入无尽自由模式 (31波+)';
    freeBtn.onclick = () => {
      engine.enterFreeplay();
      modalBackdrop.classList.add('hidden');
    };
    actions.appendChild(freeBtn);
  }

  const retryBtn = document.createElement('button');
  retryBtn.className = 'ctrl-btn';
  retryBtn.textContent = '🔄 重新挑战本地图';
  retryBtn.onclick = () => {
    engine.loadMap(engine.currentMapId);
    modalBackdrop.classList.add('hidden');
  };
  actions.appendChild(retryBtn);
  modalBackdrop.classList.remove('hidden');
}

// Event Listeners
btnStartWave.addEventListener('click', () => {
  sound.init();
  engine.startNextWave();
});

btnSpeed.addEventListener('click', () => {
  const speeds = [1, 2, 4];
  const next = speeds[(speeds.indexOf(engine.gameSpeed) + 1) % speeds.length];
  engine.gameSpeed = next;
  engine.notifyState();
});

btnAuto.addEventListener('click', () => {
  engine.autoStart = !engine.autoStart;
  engine.notifyState();
});

btnMute.addEventListener('click', () => {
  const muted = sound.toggleMute();
  btnMute.textContent = muted ? '🔇' : '🔊';
});

const CAM_PRESETS = [
  { label: '🎥 立体', pos: new THREE.Vector3(0, 23.2, 21.2), target: new THREE.Vector3(0, 0, 0.6) },
  { label: '🎥 俯视', pos: new THREE.Vector3(0, 32.5, 2.2), target: new THREE.Vector3(0, 0, 0.4) },
  { label: '🎥 电影', pos: new THREE.Vector3(-9.5, 14.2, 20.2), target: new THREE.Vector3(1.2, 0.5, 0.4) }
];
let camPresetIdx = 0;
let camLerpTargetPos = null;
let camLerpTargetLook = null;

btnCam.addEventListener('click', () => {
  camPresetIdx = (camPresetIdx + 1) % CAM_PRESETS.length;
  const p = CAM_PRESETS[camPresetIdx];
  btnCam.textContent = p.label;
  camLerpTargetPos = p.pos.clone();
  camLerpTargetLook = p.target.clone();
});
renderer.domElement.addEventListener('pointerdown', () => {
  camLerpTargetPos = null;
  camLerpTargetLook = null;
});
renderer.domElement.addEventListener('wheel', () => {
  camLerpTargetPos = null;
  camLerpTargetLook = null;
}, { passive: true });

function openTechModal() {
  mapModalOpen = true;
  document.getElementById('modal-title').textContent = '💎 星辉永久科技馆';
  const mapCards = document.getElementById('map-cards');
  mapCards.className = '';

  const renderTech = () => {
    const gems = engine.meta?.gems || 0;
    document.getElementById('modal-subtitle').innerHTML =
      `当前持有：<strong style="color:#e879f9;font-size:15px;">💎 ${gems} 颗星辉晶石</strong> · 每 5 波通关、斩杀巨型飞艇或完成【⚔️ 悬赏挑战】均可永久获取！`;

    mapCards.innerHTML = `
      <div class="tech-grid">
        ${META_TECH_DEFS.map((td) => {
          const lv = engine.meta?.upgrades?.[td.id] || 0;
          const isMax = lv >= td.maxLv;
          const cost = engine.getMetaUpgradeCost(td.id);
          return `
            <div class="tech-card">
              <div class="tech-card-top">
                <span>${td.icon} ${td.name}</span>
                <span class="tech-lv-badge">Lv.${lv} / ${td.maxLv}</span>
              </div>
              <div class="tech-desc">${td.desc}</div>
              <button
                type="button"
                class="primary-wave-btn"
                style="margin-top:4px;padding:7px 10px;font-size:12.5px;"
                data-buy-tech="${td.id}"
                ${isMax || gems < cost ? 'disabled' : ''}
              >
                ${isMax ? '🌌 已满级 MAX' : `💎 升级强化 (消耗 ${cost} 晶石)`}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    mapCards.querySelectorAll('[data-buy-tech]').forEach((btn) => {
      btn.onclick = () => {
        sound.init();
        if (engine.buyMetaUpgrade(btn.dataset.buyTech)) {
          renderTech();
        }
      };
    });
  };

  renderTech();
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `<button class="ctrl-btn" id="btn-close-tech">返回战场</button>`;
  document.getElementById('btn-close-tech').onclick = () => {
    mapModalOpen = false;
    mapCards.className = 'map-cards';
    modalBackdrop.classList.add('hidden');
  };
  modalBackdrop.classList.remove('hidden');
}

document.getElementById('btn-map-menu').addEventListener('click', openMapModal);
document.getElementById('btn-tech')?.addEventListener('click', openTechModal);
document.getElementById('btn-bounty')?.addEventListener('click', () => {
  sound.init();
  engine.toggleBountyContract();
});
document.getElementById('btn-save')?.addEventListener('click', openSaveModal);
document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
document.getElementById('btn-guide').addEventListener('click', openGuideModal);
document.getElementById('btn-close-insp').addEventListener('click', () => engine.selectTower(null));
document.getElementById('btn-upgrade').addEventListener('click', () => engine.upgradeSelectedTower());
document.getElementById('btn-fuse').addEventListener('click', () => engine.fuseSelectedTower());
document.getElementById('btn-sell').addEventListener('click', () => engine.sellSelectedTower());

if (btnOpenDraft) {
  btnOpenDraft.addEventListener('click', () => {
    sound.init();
    openDraftModal();
  });
}
const btnRerollDraft = document.getElementById('btn-reroll-draft');
if (btnRerollDraft) {
  btnRerollDraft.addEventListener('click', () => {
    sound.init();
    engine.rerollDraftCards();
  });
}
const btnDeferDraft = document.getElementById('btn-defer-draft');
if (btnDeferDraft) {
  btnDeferDraft.addEventListener('click', () => {
    draftModalOpen = false;
    draftDeferredWave = latestState?.wave ?? -1;
    draftBackdrop.classList.add('hidden');
  });
}

document.querySelectorAll('.target-pill').forEach((pill) => {
  pill.addEventListener('click', () => engine.setTargetMode(pill.dataset.mode));
});

// Pointer raycasting on 3D canvas
function updateRayPoint(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.ray.intersectPlane(groundPlane, hitPoint);
}

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!updateRayPoint(e.clientX, e.clientY)) return;
  engine.collectCoinsNear(hitPoint.x, hitPoint.z, 2.5);
  if (engine.placingType) {
    engine.updateGhostPosition(hitPoint.x, hitPoint.z);
  }
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  sound.init();
  if (!updateRayPoint(e.clientX, e.clientY)) return;

  engine.collectCoinsNear(hitPoint.x, hitPoint.z, 2.5);

  if (engine.placingType) {
    engine.placeTower(engine.placingType, hitPoint.x, hitPoint.z);
    return;
  }

  // Check if clicking near an existing tower
  let clickedTower = null;
  let minD = 1.25;
  for (const t of engine.towers) {
    const d = Math.hypot(t.x - hitPoint.x, t.z - hitPoint.z);
    if (d < minD) {
      minD = d;
      clickedTower = t;
    }
  }
  engine.selectTower(clickedTower ? clickedTower.id : null);
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (engine.placingType) {
    engine.setPlacingTower(null);
  }
});

const heldArrows = new Set();
window.addEventListener('keyup', (e) => {
  if (e.key.startsWith('Arrow')) heldArrows.delete(e.key);
});

// Keyboard Hotkeys
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  // Quick 1/2/3 card pick when Holographic Draft Modal is open!
  if (draftModalOpen && (e.key === '1' || e.key === '2' || e.key === '3')) {
    const idx = Number(e.key) - 1;
    engine.pickDraftCard(idx);
    if (engine.pendingDrafts <= 0) {
      draftModalOpen = false;
      draftBackdrop.classList.add('hidden');
    }
    return;
  }

  if (e.key.startsWith('Arrow')) {
    heldArrows.add(e.key);
    camLerpTargetPos = null;
    camLerpTargetLook = null;
    return;
  }
  const key = e.key.toLowerCase();

  // 1-8 Tower hotkeys
  const towerByKey = Object.values(TOWER_TYPES).find((t) => t.hotkey === e.key);
  if (towerByKey) {
    engine.setPlacingTower(engine.placingType === towerByKey.id ? null : towerByKey.id);
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (!engine.waveActive) engine.startNextWave();
    else {
      const speeds = [1, 2, 4];
      engine.gameSpeed = speeds[(speeds.indexOf(engine.gameSpeed) + 1) % speeds.length];
      engine.notifyState();
    }
  } else if (key === 'c') {
    if (draftModalOpen) {
      draftModalOpen = false;
      draftDeferredWave = latestState?.wave ?? -1;
      draftBackdrop.classList.add('hidden');
    } else {
      openDraftModal();
    }
  } else if (key === 'u') {
    engine.upgradeSelectedTower();
  } else if (key === 'f') {
    engine.fuseSelectedTower();
  } else if (key === 's' || e.key === 'Backspace') {
    engine.sellSelectedTower();
  } else if (key === 'r') {
    const p = CAM_PRESETS[0];
    camPresetIdx = 0;
    btnCam.textContent = p.label;
    camLerpTargetPos = p.pos.clone();
    camLerpTargetLook = p.target.clone();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    engine.cycleTargetMode();
  } else if (e.key === 'Escape') {
    if (draftModalOpen) {
      draftModalOpen = false;
      draftDeferredWave = latestState?.wave ?? -1;
      draftBackdrop.classList.add('hidden');
    } else {
      engine.setPlacingTower(null);
      engine.selectTower(null);
    }
  } else if (key === 'q') {
    engine.useAbility('meteor');
  } else if (key === 'w') {
    engine.useAbility('frostNova');
  } else if (key === 'e') {
    engine.useAbility('overclock');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Main Animation Loop + FPS Tracking
let lastTime = performance.now();
let fpsFrames = 0;
let fpsLastCheck = lastTime;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  const clampedDt = Math.min(0.05, dt);

  fpsFrames++;
  if (now - fpsLastCheck >= 500) {
    currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
    fpsFrames = 0;
    fpsLastCheck = now;
  }

  // Smooth camera preset interpolation
  if (camLerpTargetPos && camLerpTargetLook) {
    camera.position.lerp(camLerpTargetPos, clampedDt * 6.5);
    controls.target.lerp(camLerpTargetLook, clampedDt * 6.5);
    if (camera.position.distanceTo(camLerpTargetPos) < 0.08) {
      camLerpTargetPos = null;
      camLerpTargetLook = null;
    }
  }

  // Arrow-key panning with island boundary clamping
  if (heldArrows.size > 0) {
    const panSpeed = 14 * clampedDt;
    let dx = 0, dz = 0;
    if (heldArrows.has('ArrowLeft')) dx -= panSpeed;
    if (heldArrows.has('ArrowRight')) dx += panSpeed;
    if (heldArrows.has('ArrowUp')) dz -= panSpeed;
    if (heldArrows.has('ArrowDown')) dz += panSpeed;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x + dx, -10, 10);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z + dz, -6, 6);
    camera.position.x += dx;
    camera.position.z += dz;
  }

  controls.update();
  engine.pausedByModal = Boolean(draftModalOpen && (engine.settings?.autoPauseOnDraft !== false));
  engine.update(dt);
  effects.update(clampedDt, window.innerWidth, window.innerHeight);

  const shake = effects.shakeIntensity;
  let sx = 0, sy = 0;
  if (shake > 0.001) {
    sx = (Math.random() - 0.5) * shake;
    sy = (Math.random() - 0.5) * shake;
    camera.position.x += sx;
    camera.position.y += sy;
  }
  renderer.info.reset();
  composer.render();
  if (shake > 0.001) {
    camera.position.x -= sx;
    camera.position.y -= sy;
  }
}

engine.notifyState();
requestAnimationFrame(animate);

// Expose testing & telemetry API for automated 40-round self-optimization harness
window.__GAME__ = {
  engine,
  renderer,
  composer,
  scene,
  camera,
  openDraftModal,
  closeDraftModal: () => {
    draftModalOpen = false;
    draftBackdrop.classList.add('hidden');
  },
  getMetrics: () => ({
    fps: currentFps,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    snapshot: engine.getSnapshot()
  }),
  fastForwardSeconds: (seconds, doRender = false) => {
    headlessSimRunning = true;
    const step = 0.025;
    const steps = Math.ceil(seconds / step);
    for (let i = 0; i < steps; i++) {
      if (engine.gameOver) break;
      engine._stepSimulation(step);
    }
    effects.update(0.05, window.innerWidth, window.innerHeight);
    engine.notifyState();
    headlessSimRunning = false;
    if (doRender) {
      renderer.info.reset();
      composer.render();
    }
    return engine.getSnapshot();
  }
};
