import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROUND = process.env.ROUND || '0';
const OUT_DIR = process.env.OUT_DIR || path.resolve('test-results');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function runHarness() {
  const viteServer = await createServer({
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await viteServer.listen();
  const port = viteServer.httpServer.address().port;
  const URL = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1440,900'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[Browser Console Error]', msg.text());
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      console.error('[Browser Page Error]', err.message);
      pageErrors.push(err.message);
    });

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__GAME__ && window.__GAME__.engine), { timeout: 8000 });
    await page.waitForTimeout(300);

  // 1. Capture initial clean map screenshot
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_init.png`) });

  // 2. Run Automated AI Bot Playthroughs + Stress Benchmarks inside browser
  const report = await page.evaluate(async () => {
    const G = window.__GAME__;
    const eng = G.engine;

    // Helper: find valid build spots near the road bends (with High-Ground Pad bonus!)
    function findValidSpots(typeId, count = 16, preferHighGround = false) {
      const spots = [];
      const candidates = [];
      // Include exact High-Ground Pad centers first so AI can claim front/mid pads!
      if (preferHighGround && eng.mapData.highGroundPads) {
        const totalPts = eng.mapData.sampledPoints.length;
        for (const pad of eng.mapData.highGroundPads) {
          let coverage = 12;
          for (let pIdx = 0; pIdx < totalPts; pIdx++) {
            const pt = eng.mapData.sampledPoints[pIdx];
            if (Math.hypot(pt.x - pad.x, pt.z - pad.z) <= 6.2) {
              coverage += pIdx < totalPts * 0.72 ? 1.85 : 0.25;
            }
          }
          candidates.push({ x: pad.x, z: pad.z, coverage });
        }
      }
      const checkR = typeId === 'tack' ? 3.35 : typeId === 'frost' ? 4.15 : 5.2;
      for (let x = -15; x <= 15; x += 1.25) {
        for (let z = -8.2; z <= 8.2; z += 1.25) {
          let coverage = 0;
          let minDist = 99;
          const totalPts = eng.mapData.sampledPoints.length;
          for (let pIdx = 0; pIdx < totalPts; pIdx++) {
            const pt = eng.mapData.sampledPoints[pIdx];
            const d = Math.hypot(pt.x - x, pt.z - z);
            if (d < minDist) minDist = d;
            if (d <= checkR) {
              // Favor front bends (first 45% of path) so all 7 combat towers actively engage!
              coverage += pIdx < totalPts * 0.45 ? 2.1 : 0.65;
            }
          }
          if (coverage > 0) {
            candidates.push({ x, z, coverage: coverage - minDist * 1.5 });
          }
        }
      }
      candidates.sort((a, b) => b.coverage - a.coverage);

      for (const c of candidates) {
        if (spots.length >= count) break;
        if (eng.canPlaceTower(typeId, c.x, c.z)) {
          if (!spots.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 1.75)) {
            spots.push(c);
          }
        }
      }
      return spots;
    }

    function playCampaign(strategyName, mapId = 'meadow', maxWaves = 30) {
      eng.loadMap(mapId);
      const memStart = {
        geometries: G.renderer.info.memory.geometries,
        textures: G.renderer.info.memory.textures
      };

      const waveLogs = [];
      const planOrder =
        strategyName === 'synergy'
          ? ['cannon', 'frost', 'tack', 'ninja', 'dart', 'tesla', 'sniper', 'beacon']
          : strategyName === 'casual'
          ? ['dart', 'tack', 'cannon', 'ninja', 'sniper', 'frost']
          : ['dart', 'dart', 'dart', 'dart', 'dart', 'dart'];

      let buildIdx = 0;
      let fusedOnce = false;
      let feverActiveSeen = false;

      for (let w = 1; w <= maxWaves; w++) {
        if (eng.gameOver) break;

        // Synergy AI actively picks Roguelike Augment Cards!
        if (strategyName === 'synergy') {
          while (eng.pendingDrafts > 0) {
            eng.pickDraftCard(0);
          }
          // Sign Elite Bounty Contract on Wave 6 to verify live combat bounty modifiers & rewards!
          if (w === 6 && !eng.bountyArmed) {
            eng.toggleBountyContract();
          }
        }

        // Pre-wave AI purchasing, upgrading & Apex Fusion decisions
        let safety = 0;
        while (safety++ < 15) {
          if (eng.towers.length < planOrder.length) {
            const nextType = planOrder[buildIdx % planOrder.length];
            const useHighGround =
              strategyName === 'synergy' && ['dart', 'sniper'].includes(nextType);
            const spots = findValidSpots(nextType, 3, useHighGround);
            if (spots.length > 0 && eng.placeTower(nextType, spots[0].x, spots[0].z)) {
              buildIdx++;
              continue;
            }
          }

          // Test Dual-Tower Apex Fusion once when Synergy AI reaches Tier 4 + surplus cash!
          if (strategyName === 'synergy' && !fusedOnce && w >= 24 && eng.cash >= 1200) {
            const maxDart = eng.towers.find((t) => t.type === 'dart' && t.tier >= 4 && !t.isApex);
            if (maxDart) {
              const extraSpot = findValidSpots('dart', 2, false);
              if (extraSpot[0] && eng.placeTower('dart', extraSpot[0].x, extraSpot[0].z)) {
                eng.selectTower(maxDart.id);
                if (eng.fuseSelectedTower()) {
                  fusedOnce = true;
                  continue;
                }
              }
            }
          }

          // Priority 2: upgrade existing towers (lowest tier/stars first)
          const sortedTowers = [...eng.towers].sort((a, b) => (a.tier + (a.stars || 0)) - (b.tier + (b.stars || 0)));
          let upgraded = false;
          for (const t of sortedTowers) {
            if (strategyName === 'dart_spam_no_upg') break;
            if (strategyName === 'casual' && t.tier >= 4) continue; // casual doesn't star-ascend
            eng.selectTower(t.id);
            if (eng.upgradeSelectedTower()) {
              upgraded = true;
              break;
            }
          }
          if (!upgraded) break;
        }

        eng.startNextWave();
        let simGuard = 0;
        let peakBloons = 0;
        let peakDrawCalls = 0;

        while (eng.waveActive && !eng.gameOver && simGuard++ < 360) {
          if (strategyName === 'synergy') {
            if (eng.bloons.length > 22) eng.useAbility('meteor');
            if (eng.bloons.some((b) => b.type === 'moab' || b.type === 'bfb' || b.type === 'ddt' || b.type === 'zomg')) {
              eng.useAbility('overclock');
              eng.useAbility('frostNova');
            }
          }
          G.fastForwardSeconds(0.5, simGuard === 4);
          if (eng.feverTimer > 0) feverActiveSeen = true;
          peakBloons = Math.max(peakBloons, eng.bloons.length);
          if (simGuard === 4) {
            peakDrawCalls = Math.max(peakDrawCalls, G.renderer.info.render.calls);
          }
        }

        waveLogs.push({
          wave: w,
          lives: eng.lives,
          cash: eng.cash,
          towers: eng.towers.length,
          peakBloons,
          peakDrawCalls
        });
      }

      const memEnd = {
        geometries: G.renderer.info.memory.geometries,
        textures: G.renderer.info.memory.textures
      };

      // Tower pop share distribution
      const popByType = {};
      for (const t of eng.towers) {
        popByType[t.type] = (popByType[t.type] || 0) + t.pops;
      }

      return {
        strategyName,
        mapId,
        reachedWave: eng.wave,
        victory: eng.victory,
        gameOver: eng.gameOver,
        finalLives: eng.lives,
        finalCash: eng.cash,
        totalPops: eng.totalPops,
        score: eng.score,
        feverActiveSeen,
        memStart,
        memEnd,
        popByType,
        maxDrawCalls: Math.max(0, ...waveLogs.map((l) => l.peakDrawCalls)),
        maxPeakBloons: Math.max(0, ...waveLogs.map((l) => l.peakBloons)),
        milestoneWaves: waveLogs.filter((l) => [1, 5, 8, 10, 15, 20, 25, 30].includes(l.wave))
      };
    }

    const savedToast = eng.onToast;
    eng.onToast = () => {};
    const dartSpam = playCampaign('dart_spam_no_upg', 'meadow', 15);
    const casualRun = playCampaign('casual', 'meadow', 30);
    const volcanoRun = playCampaign('synergy', 'volcano', 30);
    const glacierRun = playCampaign('synergy', 'glacier', 30);
    const synergyRun = playCampaign('synergy', 'meadow', 30);
    eng.onToast = savedToast;

    // Set up an epic v2.0 Wave 30 ZOMG + DDT + Ultimate + Apex Fusion Boss scene!
    document.getElementById('toast-container').innerHTML = '';
    eng.loadMap('meadow');
    eng.cash = 18500;
    const showcaseTypes = ['dart', 'tack', 'cannon', 'frost', 'ninja', 'sniper', 'tesla', 'beacon'];
    for (const tType of showcaseTypes) {
      const useHG = ['dart', 'sniper'].includes(tType);
      const sp = findValidSpots(tType, 1, useHG);
      if (sp[0]) {
        const tw = eng.placeTower(tType, sp[0].x, sp[0].z);
        if (tw) {
          eng.selectTower(tw.id);
          while (tw.tier < 4 && eng.cash >= 600) {
            if (!eng.upgradeSelectedTower()) break;
          }
        }
      }
    }
    // Create an Apex Fused 🧬神装 Dart Tower + ★1 Ascension!
    const extraSp = findValidSpots('dart', 1, false);
    if (extraSp[0] && eng.towers[0]) {
      eng.placeTower('dart', extraSp[0].x, extraSp[0].z);
      eng.selectTower(eng.towers[0].id);
      eng.fuseSelectedTower();
      eng.upgradeSelectedTower(); // ★1 Star Ascension!
    }
    // Draft 3 Roguelike Augment Relics so Relic Bar is populated!
    eng.queueCardDraft();
    eng.pickDraftCard(0);
    eng.queueCardDraft();
    eng.pickDraftCard(1);
    eng.queueCardDraft();
    eng.pickDraftCard(0);

    document.getElementById('toast-container').innerHTML = '';
    eng.wave = 29;
    eng.startNextWave(); // Wave 30 ZOMG + DDT + Phase III Map Evolution!
    eng.setWeather('rain', false);
    eng.spawnBloon('golden', 0.26);
    eng.spawnBloon('ddt', 0.36);
    eng.spawnBloon('purple', 0.45);
    eng.spawnBloon('zebra', 0.51);
    G.fastForwardSeconds(2.2, false);
    if (!eng.bloons.some((b) => b.type === 'zomg')) eng.spawnBloon('zomg', 0.22);
    if (!eng.bloons.some((b) => b.type === 'ddt')) eng.spawnBloon('ddt', 0.36);
    while (eng.pendingDrafts > 0) eng.pickDraftCard(0);
    G.closeDraftModal();
    eng.effects.clearAll();
    document.getElementById('toast-container').innerHTML = '';

    // Trigger Overclock Golden Chrono-Halos + Meteor Cataclysm mid-flight!
    eng.abilityCooldowns = { meteor: 0, frostNova: 0, overclock: 0 };
    eng.useAbility('overclock');
    eng.useAbility('meteor');
    document.getElementById('toast-container').innerHTML = '';
    if (eng.towers[0]) eng.selectTower(eng.towers[0].id);

    // Measure live frame step performance under full v2.0 Boss + Ultimate load!
    const t0 = performance.now();
    for (let f = 0; f < 24; f++) {
      eng.update(0.016);
      while (eng.pendingDrafts > 0) eng.pickDraftCard(0);
      G.closeDraftModal();
      G.renderer.info.reset();
      if (G.composer) G.composer.render();
      else G.renderer.render(G.scene, G.camera);
    }
    const avgFrameMs = (performance.now() - t0) / 24;

    return {
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      combatDrawCalls: G.renderer.info.render.calls,
      combatTriangles: G.renderer.info.render.triangles,
      combatGeometries: G.renderer.info.memory.geometries,
      runs: {
        dartSpam,
        casualRun,
        synergyRun,
        volcanoRun,
        glacierRun
      }
    };
  });

  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_combat.png`) });

  // Capture Holographic 3-Card Roguelike Draft Modal screenshot & test REAL mouse click under notifyState spam!
  const beforeCardCount = await page.evaluate(() => {
    const G = window.__GAME__;
    document.getElementById('ult-banner')?.classList.add('hidden');
    document.getElementById('toast-container').innerHTML = '';
    G.engine.selectTower(null);
    G.engine.queueCardDraft('🌊 里程碑突破');
    G.openDraftModal();
    // Simulate rapid background notifyState ticks while user is hovering/clicking!
    G._spamInterval = setInterval(() => G.engine.notifyState(), 18);
    return G.engine.activeCards.reduce((s, c) => s + c.count, 0);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_draft.png`) });
  await page.click('.draft-card:nth-child(2)');
  const draftClickSuccess = await page.evaluate((prevCount) => {
    const G = window.__GAME__;
    clearInterval(G._spamInterval);
    const nowCount = G.engine.activeCards.reduce((s, c) => s + c.count, 0);
    const modalHidden = document.getElementById('draft-backdrop').classList.contains('hidden');
    return nowCount === prevCount + 1 && modalHidden;
  }, beforeCardCount);
  if (!draftClickSuccess) {
    throw new Error('Card Draft real mouse click failed under notifyState spam!');
  }

  if (Number(ROUND) >= 18) {
    // Capture Awakened Phase III Volcano & Glacier 3D showcase screenshots too!
    for (const mId of ['volcano', 'glacier']) {
      await page.evaluate((mapId) => {
        const G = window.__GAME__;
        G.engine.loadMap(mapId);
        G.engine.setMapEvolution(2, false);
        G.engine.setWeather(mapId === 'volcano' ? 'ember' : 'snow', false);
        document.getElementById('toast-container').innerHTML = '';
        G.fastForwardSeconds(0.15, true);
      }, mId);
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_${mId}.png`) });
    }
    await page.evaluate(() => {
      window.__GAME__.engine.loadMap('meadow');
    });
  }

  // Test Save/Load UI modal + Slot Save + Wipe + Base64 Save Code Import roundtrip!
  const saveRoundtripOk = await page.evaluate(() => {
    const G = window.__GAME__;
    const eng = G.engine;
    eng.loadMap('volcano');
    eng.cash = 4321;
    eng.wave = 16;
    eng.commanderLevel = 5;
    eng.setMapEvolution(1, false);
    eng.placeTower('ninja', 0, 3.6) || eng.placeTower('ninja', -4, 3.6);
    const towerCountBefore = eng.towers.length;
    eng.saveToSlot('1', true);
    const exportedCode = eng.exportSaveString();

    // Wipe board back to Meadow Wave 0
    eng.loadMap('meadow');
    if (eng.wave !== 0 || eng.currentMapId !== 'meadow') return false;

    // Restore from Slot #1
    if (!eng.loadFromSlot('1')) return false;
    if (eng.currentMapId !== 'volcano' || eng.wave !== 16 || eng.towers.length !== towerCountBefore) return false;

    // Wipe again and restore via Base64 Save String!
    eng.loadMap('glacier');
    if (!eng.importSaveString(exportedCode)) return false;
    const ok = eng.currentMapId === 'volcano' && eng.wave === 16 && eng.commanderLevel === 5 && eng.towers.length === towerCountBefore;
    eng.loadMap('meadow');
    return ok;
  });
  if (!saveRoundtripOk) {
    throw new Error('Save/Load slot & Base64 code roundtrip assertion failed!');
  }
  if (!report.runs.synergyRun.feverActiveSeen) {
    throw new Error('Fever Overdrive never triggered during 30-wave Synergy campaign!');
  }
  await page.click('#btn-save');
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_save.png`) });
  await page.click('#btn-close-save');

  // Test Settings Center Modal + real toggle persistence!
  await page.click('#btn-settings');
  await page.waitForTimeout(80);
  await page.click('[data-setting-key="autoCollectCoins"]');
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_settings.png`) });
  const settingsToggledOk = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('blooncraft_settings_v3') || '{}');
    return s.autoCollectCoins === true && window.__GAME__.engine.settings.autoCollectCoins === true;
  });
  if (!settingsToggledOk) {
    throw new Error('Settings toggle persistence check failed!');
  }
  await page.click('#btn-reset-settings');
  await page.click('#btn-close-settings');

  // Test Star Gem Permanent Tech Tree Modal + Upgrade + Elite Bounty Contract!
  await page.evaluate(() => {
    window.__GAME__.engine.addStarGems(4);
  });
  await page.click('#btn-tech');
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT_DIR, `round_${ROUND}_tech.png`) });
  await page.click('[data-buy-tech="startCash"]');
  await page.click('#btn-close-tech');

  await page.click('#btn-bounty');
  const gameplayBreakthroughOk = await page.evaluate(() => {
    const eng = window.__GAME__.engine;
    const bountyArmed = eng.bountyArmed === true;
    const techUpgraded = (eng.meta?.upgrades?.startCash || 0) >= 1;
    // Reset clean meta so future campaign benchmarks run from fair baseline
    localStorage.removeItem('blooncraft_meta_v3');
    eng.meta = eng._loadMeta();
    eng.metaMods = eng._computeMetaMods();
    eng.bountyArmed = false;
    eng.notifyState();
    return bountyArmed && techUpgraded;
  });
  if (!gameplayBreakthroughOk) {
    throw new Error('Star Gem Tech Tree or Elite Bounty Contract assertion failed!');
  }

  // Test UI click interactions (Guide modal & Speed toggle)
  await page.click('#btn-guide');
  await page.click('#btn-close-guide');
  await page.click('#btn-speed');
  const speedText = await page.textContent('#btn-speed');

  const finalSummary = {
    round: ROUND,
    consoleErrors,
    pageErrors,
    speedToggleText: speedText,
    ...report
  };

    fs.writeFileSync(
      path.join(OUT_DIR, `round_${ROUND}_report.json`),
      JSON.stringify(finalSummary, null, 2)
    );
    console.log(JSON.stringify({
      round: ROUND,
      consoleErrors: consoleErrors.length,
      pageErrors: pageErrors.length,
      avgFrameMs: report.avgFrameMs,
      combatDrawCalls: report.combatDrawCalls,
      combatGeometries: report.combatGeometries,
      dartSpamWave: report.runs.dartSpam.reachedWave,
      casualLives: report.runs.casualRun.finalLives,
      casualCash: report.runs.casualRun.finalCash,
      synergyVictory: report.runs.synergyRun.victory,
      volcanoVictory: report.runs.volcanoRun.victory,
      glacierVictory: report.runs.glacierRun.victory,
      feverActiveSeen: report.runs.synergyRun.feverActiveSeen,
      popByType: report.runs.synergyRun.popByType
    }, null, 2));
  } finally {
    await browser.close();
    await viteServer.close();
  }
}

runHarness().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
