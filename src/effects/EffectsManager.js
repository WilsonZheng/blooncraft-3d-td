import * as THREE from 'three';

export class EffectsManager {
  constructor(scene, camera, overlayEl) {
    this.scene = scene;
    this.camera = camera;
    this.overlayEl = overlayEl;

    this.particles = [];
    this.rings = [];
    this.beams = [];
    this.fireballs = [];
    this.scorchDecals = [];
    this.meteors = [];
    this.tempProps = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.enableShake = true;
    this.enableFloatingText = true;

    // Shared singleton geometries (zero runtime geometry allocations for pooled VFX!)
    this.shardGeo = new THREE.SphereGeometry(0.12, 6, 6);
    this.iceShardGeo = new THREE.OctahedronGeometry(0.19, 0);
    this.starGeo = new THREE.OctahedronGeometry(0.42, 0);
    this.starGeo.scale(1.4, 0.25, 1.4);

    this.ringGeo = new THREE.RingGeometry(0.62, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.scorchGeo = new THREE.CircleGeometry(1.0, 24);
    this.scorchGeo.rotateX(-Math.PI / 2);

    this.fireballGeo = new THREE.SphereGeometry(0.62, 14, 12);
    this.domeGeo = new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    this.meteorRockGeo = new THREE.DodecahedronGeometry(0.78, 1);
    this.iceSpireGeo = new THREE.ConeGeometry(0.42, 2.35, 6);
    this.pillarGeo = new THREE.CylinderGeometry(1.35, 1.85, 18, 18, 1, true);

    this.particleMatCache = new Map();
    this.meteorMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf97316,
      emissiveIntensity: 2.4,
      roughness: 0.35
    });
    this.iceShardMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
      roughness: 0.12,
      metalness: 0.2
    });
    this.iceSpireMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 1.15,
      roughness: 0.1,
      transmission: 0.35,
      transparent: true,
      opacity: 0.9
    });
  }

  triggerShake(amount = 0.25) {
    if (!this.enableShake) {
      this.shakeIntensity = 0;
      return;
    }
    this.shakeIntensity = Math.min(0.65, Math.max(this.shakeIntensity, amount));
  }

  triggerScreenFlash(rgbaColor = 'rgba(249, 115, 22, 0.38)', durationMs = 420) {
    const el = document.getElementById('screen-flash');
    if (!el) return;
    el.style.background = `radial-gradient(circle at center, transparent 36%, ${rgbaColor} 100%)`;
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${durationMs}ms ease-out`;
      el.style.opacity = '0';
    });
  }

  triggerUltBanner(icon, title, subtitle, borderColor = '#facc15') {
    const banner = document.getElementById('ult-banner');
    if (!banner) return;
    const iconEl = document.getElementById('ult-banner-icon');
    const titleEl = document.getElementById('ult-banner-title');
    const subEl = document.getElementById('ult-banner-sub');
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.style.color = borderColor;
    }
    if (subEl) subEl.textContent = subtitle;
    banner.style.borderColor = borderColor;
    banner.style.boxShadow = `0 0 36px ${borderColor}88`;
    banner.classList.remove('hidden');
    clearTimeout(this._ultBannerTimer);
    this._ultBannerTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 1650);
  }

  _getParticleMat(color) {
    if (!this.particleMatCache.has(color)) {
      this.particleMatCache.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.15,
          roughness: 0.3
        })
      );
    }
    return this.particleMatCache.get(color);
  }

  spawnPopBurst(pos, color, count = 6, scale = 1) {
    if (this.particles.length > 260) count = Math.min(count, 2);
    const mat = this._getParticleMat(color);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.shardGeo, mat);
      m.position.set(pos.x, pos.y + 0.65, pos.z);
      m.scale.setScalar(scale * (0.75 + Math.random() * 0.65));
      const ang = Math.random() * Math.PI * 2;
      const spd = (2.5 + Math.random() * 4.4) * scale;
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 2.3 + Math.random() * 3.8,
        vz: Math.sin(ang) * spd,
        spin: 0,
        life: 0.3 + Math.random() * 0.15,
        maxLife: 0.45
      });
    }
  }

  spawnIceShatter(pos, scale = 1) {
    if (this.particles.length > 260) return;
    this.spawnShockwave(pos, 1.35 * scale, 0x7dd3fc, 0.22);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(this.iceShardGeo, this.iceShardMat);
      m.position.set(pos.x, pos.y + 0.7, pos.z);
      m.scale.setScalar(scale * (0.8 + Math.random() * 0.5));
      const ang = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
      const spd = (3.0 + Math.random() * 3.5) * scale;
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 2.6 + Math.random() * 3.2,
        vz: Math.sin(ang) * spd,
        spin: 12,
        life: 0.34,
        maxLife: 0.34
      });
    }
  }

  spawnCritBurst(pos) {
    if (this.tempProps.length < 30) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const star = new THREE.Mesh(this.starGeo, mat);
      star.position.set(pos.x, pos.y + 0.95, pos.z);
      this.scene.add(star);
      this.tempProps.push({ mesh: star, mat, spinY: 14, grow: 2.6, life: 0.24, maxLife: 0.24 });
    }
    this.spawnPopBurst(pos, 0xfacc15, 5, 1.1);
  }

  spawnExplosion(pos, radius = 2.0, color = 0xf97316, shake = 0.08) {
    if (shake > 0) this.triggerShake(shake);

    // 1. Expanding HDR 3D Fireball Core Sphere (Pooled!)
    if (!this.fireballPool) this.fireballPool = [];
    if (this.fireballs.length < 28) {
      let item = this.fireballPool.pop();
      if (!item) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.66,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        item = { mesh: new THREE.Mesh(this.fireballGeo, mat), mat };
      }
      item.mat.color.setHex(0xfef08a);
      item.mat.opacity = 0.66;
      item.mesh.position.set(pos.x, Math.max(0.55, pos.y), pos.z);
      item.mesh.scale.setScalar(0.35);
      this.scene.add(item.mesh);
      this.fireballs.push({
        mesh: item.mesh,
        mat: item.mat,
        targetScale: radius * 1.18,
        tintHex: color,
        life: 0.28,
        maxLife: 0.28
      });
    }

    // 2. Dual Concentric Shockwaves
    this.spawnShockwave(pos, radius * 1.08, color, 0.3);
    this.spawnShockwave(pos, radius * 0.68, 0xfef08a, 0.2);

    // 3. High-velocity Glowing Spark Shrapnel
    this.spawnPopBurst(pos, 0xf97316, 8, Math.min(1.4, 0.7 + radius * 0.25));
    this.spawnPopBurst(pos, 0xfef08a, 4, 0.95);

    // 4. Temporary Scorched Ground Halo (Pooled!)
    if (!this.scorchPool) this.scorchPool = [];
    if (this.scorchDecals.length < 22) {
      let sItem = this.scorchPool.pop();
      if (!sItem) {
        const sMat = new THREE.MeshBasicMaterial({
          color: 0x1c1917,
          transparent: true,
          opacity: 0.42,
          depthWrite: false
        });
        sItem = { mesh: new THREE.Mesh(this.scorchGeo, sMat), mat: sMat };
      }
      sItem.mat.opacity = 0.42;
      sItem.mesh.position.set(pos.x, 0.055, pos.z);
      sItem.mesh.scale.setScalar(radius * 0.72);
      this.scene.add(sItem.mesh);
      this.scorchDecals.push({ mesh: sItem.mesh, mat: sItem.mat, life: 0.95, maxLife: 0.95 });
    }
  }

  spawnLightningBolt(points) {
    // Primary intense white-cyan core arc + wider golden-blue corona arc + node sparks!
    this.spawnBeam(points, 0xe0f2fe, 0.16, true);
    this.spawnBeam(points, 0x38bdf8, 0.22, true);
    for (let i = 1; i < points.length; i++) {
      if (i <= 4) {
        this.spawnPopBurst(points[i], 0xfef08a, 3, 0.75);
      }
      // Secondary fork branch on first 2 targets
      if (i <= 2 && Math.random() < 0.75) {
        const forkEnd = points[i].clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.2, (Math.random() - 0.5) * 1.8)
        );
        this.spawnBeam([points[i], forkEnd], 0xfacc15, 0.14, true);
      }
    }
  }

  spawnShockwave(pos, radius, color = 0xf97316, duration = 0.28) {
    if (!this.ringPool) this.ringPool = [];
    if (this.rings.length > 48) return;
    let rItem = this.ringPool.pop();
    if (!rItem) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      rItem = { mesh: new THREE.Mesh(this.ringGeo, mat), mat };
    }
    rItem.mat.color.setHex(color);
    rItem.mat.opacity = 0.55;
    rItem.mesh.position.set(pos.x, 0.14, pos.z);
    rItem.mesh.scale.setScalar(0.2);
    this.scene.add(rItem.mesh);
    this.rings.push({
      mesh: rItem.mesh,
      mat: rItem.mat,
      maxRadius: radius,
      life: duration,
      maxLife: duration
    });
  }

  spawnBeam(points, color = 0xfef08a, duration = 0.14, jagged = false) {
    if (this.beams.length > 44) return;
    let finalPts = points;
    if (jagged && points.length >= 2) {
      finalPts = [points[0]];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        for (let s = 1; s <= 3; s++) {
          const t = s / 4;
          const mid = new THREE.Vector3().lerpVectors(a, b, t);
          mid.x += (Math.random() - 0.5) * 0.48;
          mid.y += (Math.random() - 0.5) * 0.36;
          mid.z += (Math.random() - 0.5) * 0.48;
          finalPts.push(mid);
        }
        finalPts.push(b);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(finalPts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.beams.push({ line, geo, mat, life: duration, maxLife: duration });
  }

  // Ultimate VFX Helpers (used by Q / W / E Active Ultimates!)
  spawnMeteorStrike(targetPos, delay = 0, onImpact = null) {
    const startPos = targetPos.clone().add(new THREE.Vector3(-5.5, 17.5, -4.5));
    const mesh = new THREE.Mesh(this.meteorRockGeo, this.meteorMat);
    mesh.position.copy(startPos);
    mesh.scale.setScalar(1.35);
    mesh.visible = delay <= 0;
    this.scene.add(mesh);
    this.meteors.push({
      mesh,
      startPos,
      targetPos: targetPos.clone().setY(0.35),
      delay,
      elapsed: 0,
      duration: 0.34,
      trailTimer: 0,
      onImpact
    });
  }

  spawnFrostCataclysm(roadPoints = []) {
    // Giant translucent expanding Aurora Frost Dome
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const dome = new THREE.Mesh(this.domeGeo, domeMat);
    dome.position.set(0, 0.05, 0);
    dome.scale.setScalar(1.5);
    this.scene.add(dome);
    this.tempProps.push({ mesh: dome, mat: domeMat, spinY: 1.5, grow: 26, life: 0.62, maxLife: 0.62 });

    // Erupting 3D Crystal Iceberg Spires along the track!
    for (const pt of roadPoints) {
      const spire = new THREE.Mesh(this.iceSpireGeo, this.iceSpireMat);
      spire.position.set(pt.x + (Math.random() - 0.5) * 0.6, 1.05, pt.z + (Math.random() - 0.5) * 0.6);
      spire.rotation.y = Math.random() * Math.PI;
      spire.rotation.z = (Math.random() - 0.5) * 0.25;
      this.scene.add(spire);
      this.tempProps.push({ mesh: spire, mat: null, spinY: 0, grow: 0, shrinkEnd: true, life: 3.4, maxLife: 3.4 });
    }
  }

  spawnOrbitalPillar(centerPos = new THREE.Vector3(0, 0, 0), color = 0xfacc15) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const pillar = new THREE.Mesh(this.pillarGeo, mat);
    pillar.position.set(centerPos.x, 9, centerPos.z);
    pillar.scale.set(0.55, 1, 0.55);
    this.scene.add(pillar);
    this.tempProps.push({ mesh: pillar, mat, spinY: 4.5, grow: 0.35, life: 0.38, maxLife: 0.38 });
  }

  spawnFloatingText(worldPos, text, color = '#fde047') {
    if (!this.enableFloatingText || !this.overlayEl || this.floatingTexts.length > 28) return;
    let stackCount = 0;
    for (const existing of this.floatingTexts) {
      if (existing.worldPos.distanceTo(worldPos) < 1.2) stackCount++;
    }
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;
    this.overlayEl.appendChild(el);

    this.floatingTexts.push({
      el,
      worldPos: worldPos.clone(),
      offsetY: 1.35 + stackCount * 0.55,
      life: 0.85,
      maxLife: 0.85
    });
  }

  update(dt, width, height) {
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.85);
    }

    // Update plunging 3D meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      if (m.delay > 0) {
        m.delay -= dt;
        if (m.delay <= 0) m.mesh.visible = true;
        continue;
      }
      m.elapsed += dt;
      const u = Math.min(1, m.elapsed / m.duration);
      m.mesh.position.lerpVectors(m.startPos, m.targetPos, u);
      m.mesh.rotation.x += dt * 9;
      m.mesh.rotation.z += dt * 7;
      m.trailTimer -= dt;
      if (m.trailTimer <= 0) {
        m.trailTimer = 0.035;
        this.spawnPopBurst(m.mesh.position, 0xf97316, 2, 1.1);
      }
      if (u >= 1) {
        this.scene.remove(m.mesh);
        const cb = m.onImpact;
        const impactPos = m.targetPos.clone();
        this.meteors.splice(i, 1);
        this.spawnExplosion(impactPos, 3.8, 0xef4444, 0.36);
        this.spawnShockwave(impactPos, 4.8, 0xfacc15, 0.48);
        if (cb) cb(impactPos);
      }
    }

    // Update 3D particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.spin) {
        p.mesh.rotation.x += dt * p.spin;
        p.mesh.rotation.y += dt * p.spin;
      }
      p.mesh.scale.multiplyScalar(0.94);
    }

    // Update 3D Fireball Cores
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.life -= dt;
      if (fb.life <= 0) {
        this.scene.remove(fb.mesh);
        this.fireballPool.push({ mesh: fb.mesh, mat: fb.mat });
        this.fireballs.splice(i, 1);
        continue;
      }
      const u = 1 - fb.life / fb.maxLife;
      const s = 0.35 + Math.sin(u * Math.PI * 0.65) * fb.targetScale;
      fb.mesh.scale.setScalar(s);
      if (u > 0.32) fb.mat.color.setHex(fb.tintHex);
      fb.mat.opacity = (1 - u) * 0.92;
    }

    // Update Scorch Decals
    for (let i = this.scorchDecals.length - 1; i >= 0; i--) {
      const sc = this.scorchDecals[i];
      sc.life -= dt;
      if (sc.life <= 0) {
        this.scene.remove(sc.mesh);
        this.scorchPool.push({ mesh: sc.mesh, mat: sc.mat });
        this.scorchDecals.splice(i, 1);
        continue;
      }
      sc.mat.opacity = (sc.life / sc.maxLife) * 0.4;
    }

    // Update Temp 3D Props (Crit Stars, Frost Dome, Ice Spires, Orbital Pillars)
    for (let i = this.tempProps.length - 1; i >= 0; i--) {
      const tp = this.tempProps[i];
      tp.life -= dt;
      if (tp.life <= 0) {
        this.scene.remove(tp.mesh);
        if (tp.mat) tp.mat.dispose();
        this.tempProps.splice(i, 1);
        continue;
      }
      const u = 1 - tp.life / tp.maxLife;
      if (tp.spinY) tp.mesh.rotation.y += dt * tp.spinY;
      if (tp.grow) {
        tp.mesh.scale.addScalar(dt * tp.grow);
      }
      if (tp.shrinkEnd && u > 0.75) {
        const k = Math.max(0.01, (1 - u) / 0.25);
        tp.mesh.scale.set(k, k, k);
      }
      if (tp.mat) {
        tp.mat.opacity = (1 - u) * 0.85;
      }
    }

    // Update shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        this.ringPool.push({ mesh: r.mesh, mat: r.mat });
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const s = 0.25 + t * r.maxRadius;
      r.mesh.scale.setScalar(s);
      r.mat.opacity = (1 - t) * 0.9;
    }

    // Update beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.line);
        b.geo.dispose();
        b.mat.dispose();
        this.beams.splice(i, 1);
        continue;
      }
      b.mat.opacity = b.life / b.maxLife;
    }

    // Update floating screen-space texts
    const proj = new THREE.Vector3();
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        ft.el.remove();
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.offsetY += dt * 1.4;
      proj.copy(ft.worldPos);
      proj.y += ft.offsetY;
      proj.project(this.camera);

      const x = (proj.x * 0.5 + 0.5) * width;
      const y = (-proj.y * 0.5 + 0.5) * height;
      ft.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      ft.el.style.opacity = Math.min(1, (ft.life / ft.maxLife) * 1.5).toFixed(2);
    }
  }

  clearAll() {
    if (!this.ringPool) this.ringPool = [];
    if (!this.fireballPool) this.fireballPool = [];
    if (!this.scorchPool) this.scorchPool = [];
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.rings.forEach((r) => { this.scene.remove(r.mesh); this.ringPool.push({ mesh: r.mesh, mat: r.mat }); });
    this.beams.forEach((b) => { this.scene.remove(b.line); b.geo.dispose(); b.mat.dispose(); });
    this.fireballs.forEach((fb) => { this.scene.remove(fb.mesh); this.fireballPool.push({ mesh: fb.mesh, mat: fb.mat }); });
    this.scorchDecals.forEach((sc) => { this.scene.remove(sc.mesh); this.scorchPool.push({ mesh: sc.mesh, mat: sc.mat }); });
    this.meteors.forEach((m) => this.scene.remove(m.mesh));
    this.tempProps.forEach((tp) => { this.scene.remove(tp.mesh); if (tp.mat) tp.mat.dispose(); });
    this.floatingTexts.forEach((ft) => ft.el.remove());
    this.particles = [];
    this.rings = [];
    this.beams = [];
    this.fireballs = [];
    this.scorchDecals = [];
    this.meteors = [];
    this.tempProps = [];
    this.floatingTexts = [];
  }
}
