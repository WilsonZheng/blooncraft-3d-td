import * as THREE from 'three';
import { BLOON_TYPES } from '../config/constants.js';

export class BloonMeshFactory {
  constructor() {
    this.balloonGeo = this._createBalloonGeometry();
    this.knotGeo = new THREE.ConeGeometry(0.18, 0.22, 10);
    this.stringGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.58, 6);
    this.bandGeo = new THREE.TorusGeometry(0.84, 0.085, 8, 20);
    this.bandGeo.rotateX(Math.PI / 2);

    this.stringMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.72 });
    this.regrowMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.65,
      roughness: 0.3
    });
    this.fortMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25
    });
    this.iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.52,
      roughness: 0.08
    });

    this.moabHullGeo = new THREE.CapsuleGeometry(0.76, 1.6, 12, 22);
    this.moabHullGeo.rotateZ(Math.PI / 2);
    this.podGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.95, 10);
    this.podGeo.rotateZ(Math.PI / 2);
    this.thrusterGlowGeo = new THREE.RingGeometry(0.08, 0.2, 14);
    this.thrusterGlowGeo.rotateY(-Math.PI / 2);
    this.finGeo = new THREE.BoxGeometry(0.48, 0.58, 0.08);
    this.propGeo = new THREE.BoxGeometry(0.08, 0.92, 0.14);
    this.gondolaGeo = new THREE.BoxGeometry(0.95, 0.32, 0.44);
    this.hpBgGeo = new THREE.PlaneGeometry(2.15, 0.25);
    this.hpFillGeo = new THREE.PlaneGeometry(2.02, 0.16);
    this.hpFillGeo.translate(1.01, 0, 0);

    this.camoTexture = this._createCamoTexture();
    this.rainbowTexture = this._createRainbowTexture();
    this.zebraTexture = this._createZebraTexture();
    this.leadTexture = this._createLeadTexture();
    this.ceramicCrackedTexture = this._createCeramicCrackTexture();

    this.shieldRingGeo = new THREE.TorusGeometry(1.02, 0.055, 8, 24);
    this.earCrestGeo = new THREE.ConeGeometry(0.18, 0.36, 6);
    this.ddtWingGeo = new THREE.BoxGeometry(0.95, 0.06, 2.25);
    this.zomgJawGeo = new THREE.ConeGeometry(0.24, 0.62, 5);
    this.zomgJawGeo.rotateZ(-Math.PI / 2);
    this.purpleShieldMat = new THREE.MeshStandardMaterial({
      color: 0xe879f9,
      emissive: 0xa855f7,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.78
    });
    this.materialCache = new Map();
  }

  _createBalloonGeometry() {
    const points = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const angle = t * Math.PI;
      const pinch = t < 0.35 ? 0.7 + 0.3 * (t / 0.35) : 1.0;
      const r = Math.sin(angle) * 0.87 * pinch;
      const y = -Math.cos(angle) * 1.05;
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const geo = new THREE.LatheGeometry(points, 22);
    geo.computeVertexNormals();
    return geo;
  }

  _createZebraTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0f172a';
    for (let i = -64; i < 192; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 11, 0);
      ctx.lineTo(i + 45, 128);
      ctx.lineTo(i + 34, 128);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createCamoTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    const colors = ['rgba(18,48,26,0.62)', 'rgba(46,85,42,0.52)', 'rgba(15,25,20,0.58)'];
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse((i * 37) % 128, (i * 53) % 128, 25 + (i % 3) * 10, 12 + (i % 4) * 6, i * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _createRainbowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const stripes = ['#ff3b3b', '#ff9f1a', '#ffd32a', '#2ecc71', '#2b8cff', '#8b5cf6'];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, (i * 128) / stripes.length, 64, 128 / stripes.length + 1);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createLeadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 40, 120, 48);
    ctx.fillStyle = '#1e293b';
    for (let x = 12; x < 128; x += 24) {
      ctx.beginPath();
      ctx.arc(x, 48, 3.5, 0, Math.PI * 2);
      ctx.arc(x, 80, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createCeramicCrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d97b29';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#291507';
    ctx.lineWidth = 3.5;
    const paths = [
      [[20, 25], [45, 50], [38, 82], [65, 108]],
      [[95, 22], [75, 55], [98, 78], [82, 112]],
      [[45, 50], [75, 55]]
    ];
    paths.forEach((pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  getMaterial(typeId, camo = false, cracked = false) {
    const key = `${typeId}_${camo ? 1 : 0}_${cracked ? 1 : 0}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const def = BLOON_TYPES[typeId];

    let map = null;
    if (def.rainbow) map = this.rainbowTexture;
    else if (def.zebra) map = this.zebraTexture;
    else if (cracked && def.ceramic) map = this.ceramicCrackedTexture;
    else if (def.metallic && !camo) map = this.leadTexture;
    else if (camo) map = this.camoTexture;

    const useWhiteBase = def.rainbow || def.zebra || (def.metallic && !camo) || (cracked && def.ceramic);
    const mat = new THREE.MeshPhysicalMaterial({
      color: useWhiteBase ? 0xffffff : def.color,
      map,
      emissive: def.purpleShield ? 0x6b21a8 : 0x000000,
      emissiveIntensity: def.purpleShield ? 0.35 : 0,
      roughness: def.ceramic ? 0.48 : (def.metallic ? 0.24 : 0.14),
      metalness: def.metallic ? 0.85 : 0.04,
      clearcoat: def.ceramic ? 0.25 : 0.92,
      clearcoatRoughness: 0.1,
      transparent: camo,
      opacity: camo ? 0.85 : 1.0
    });
    this.materialCache.set(key, mat);
    return mat;
  }

  createBloonMesh(typeId, { camo = false, regrow = false, fortified = false } = {}) {
    const def = BLOON_TYPES[typeId];
    if (def.isMoab) {
      return this._createMoabMesh(typeId, def, { fortified });
    }

    const group = new THREE.Group();
    const bodyMat = this.getMaterial(typeId, camo, false);
    const body = new THREE.Mesh(this.balloonGeo, bodyMat);
    body.castShadow = true;
    body.position.y = 1.28;
    group.add(body);

    const knot = new THREE.Mesh(this.knotGeo, bodyMat);
    knot.position.y = 0.18;
    group.add(knot);

    const str = new THREE.Mesh(this.stringGeo, this.stringMat);
    str.position.y = -0.15;
    group.add(str);
    group.userData.stringMesh = str;

    // Purple Plasma Energy Shield Ring (spinning 3D forcefield!)
    if (def.purpleShield) {
      const shield = new THREE.Mesh(this.shieldRingGeo, this.purpleShieldMat);
      shield.position.y = 1.3;
      shield.rotation.x = Math.PI * 0.32;
      group.add(shield);
      group.userData.shieldRing = shield;
    }

    // Zebra Dual Horn Crests
    if (def.zebra) {
      for (const sx of [-0.34, 0.34]) {
        const ear = new THREE.Mesh(this.earCrestGeo, bodyMat);
        ear.position.set(sx, 2.28, 0);
        ear.rotation.z = sx > 0 ? -0.35 : 0.35;
        group.add(ear);
      }
    }

    if (regrow) {
      const ring = new THREE.Mesh(this.bandGeo, this.regrowMat);
      ring.position.y = 1.48;
      ring.scale.setScalar(0.88);
      group.add(ring);
      group.userData.regrowRing = ring;
    }

    if (fortified) {
      const band = new THREE.Mesh(this.bandGeo, this.fortMat);
      band.position.y = 1.18;
      group.add(band);
    }

    const iceShell = new THREE.Mesh(this.balloonGeo, this.iceMat);
    iceShell.position.y = 1.28;
    iceShell.scale.setScalar(1.12);
    iceShell.visible = false;
    group.add(iceShell);

    group.scale.setScalar(def.scale);
    group.userData.baseScale = def.scale;
    group.userData.body = body;
    group.userData.iceShell = iceShell;
    return group;
  }

  _createMoabMesh(typeId, def, { fortified = false }) {
    const group = new THREE.Group();
    const isBfb = typeId === 'bfb';
    const isDdt = typeId === 'ddt';
    const isZomg = typeId === 'zomg';
    const isGolden = typeId === 'golden';

    const hullMat = this._getCachedMoabMat(`hull_${typeId}`, {
      color: isGolden ? 0xfde047 : (isZomg ? 0x1e293b : def.color),
      emissive: isGolden ? 0xd97706 : 0x000000,
      emissiveIntensity: isGolden ? 0.55 : 0,
      roughness: isGolden ? 0.14 : (isDdt ? 0.18 : 0.3),
      metalness: isGolden ? 0.92 : (isDdt ? 0.88 : 0.38),
      transparent: isDdt,
      opacity: isDdt ? 0.9 : 1.0
    });
    const stripeMat = this._getCachedMoabMat(`stripe_${typeId}`, {
      color: isGolden ? 0x38bdf8 : (isZomg ? 0x34d399 : (isDdt ? 0x38bdf8 : (isBfb ? 0xfef08a : 0xf8fafc))),
      emissive: isGolden ? 0x0ea5e9 : (isZomg ? 0x10b981 : (isDdt ? 0x0ea5e9 : 0x000000)),
      emissiveIntensity: isGolden || isZomg || isDdt ? 1.3 : 0,
      roughness: 0.32,
      metalness: 0.45
    });
    const darkMat = this._getCachedMoabMat(`dark_${fortified ? 1 : 0}`, {
      color: fortified ? 0xb45309 : 0x0f172a,
      metalness: 0.82,
      roughness: 0.26
    });
    const thrusterMat = this._getCachedMoabMat(`thruster_${typeId}`, {
      color: isGolden ? 0xfef9c3 : (isZomg ? 0xd1fae5 : (isBfb ? 0xffedd5 : 0xe0f2fe)),
      emissive: isGolden ? 0xfacc15 : (isZomg ? 0x10b981 : (isBfb ? 0xf97316 : 0x38bdf8)),
      emissiveIntensity: 1.75
    });

    const hull = new THREE.Mesh(this.moabHullGeo, hullMat);
    hull.position.y = 1.75;
    if (isDdt) hull.scale.set(1.15, 0.78, 0.82); // Sleek supersonic stealth fuselage!
    if (isZomg) hull.scale.set(1.08, 1.12, 1.12); // Heavy armored dreadnought!
    hull.castShadow = true;
    group.add(hull);

    // Nose & belly hazard / neon reactor bands
    const bandOffsets = isZomg ? [-0.72, 0, 0.72] : [-0.58, 0.58];
    for (const xOff of bandOffsets) {
      const band = new THREE.Mesh(this.bandGeo, stripeMat);
      band.rotation.z = Math.PI / 2;
      band.scale.setScalar(isDdt ? 0.78 : (isZomg ? 1.06 : 0.92));
      band.position.set(xOff, 1.75, 0);
      group.add(band);
    }

    // DDT Swept Stealth Delta Wings + Neon Visor
    if (isDdt) {
      const wing = new THREE.Mesh(this.ddtWingGeo, darkMat);
      wing.position.set(-0.15, 1.72, 0);
      group.add(wing);
      const visor = new THREE.Mesh(this.gondolaGeo, stripeMat);
      visor.scale.set(0.65, 0.55, 0.95);
      visor.position.set(0.95, 1.92, 0);
      group.add(visor);
    }

    // ZOMG Menacing Nose Tusks & Quad-Rotor Nacelles
    const extraRotors = [];
    if (isZomg) {
      for (const zSide of [-0.42, 0.42]) {
        const tusk = new THREE.Mesh(this.zomgJawGeo, stripeMat);
        tusk.position.set(1.58, 1.48, zSide);
        group.add(tusk);
      }
      for (const [rx, rz] of [[0.45, -1.05], [0.45, 1.05], [-0.55, -1.05], [-0.55, 1.05]]) {
        const rotor = new THREE.Mesh(this.propGeo, stripeMat);
        rotor.rotation.z = Math.PI / 2;
        rotor.position.set(rx, 2.15, rz);
        group.add(rotor);
        extraRotors.push(rotor);
      }
    }

    // Twin side-pod jet turbines with HDR glowing exhaust!
    const thrusters = [];
    for (const zSide of [-0.82, 0.82]) {
      const pod = new THREE.Mesh(this.podGeo, darkMat);
      pod.position.set(-0.25, 1.55, zSide);
      group.add(pod);
      const glow = new THREE.Mesh(this.thrusterGlowGeo, thrusterMat);
      glow.position.set(-0.74, 1.55, zSide);
      group.add(glow);
      thrusters.push(glow);
    }

    // Tail fins (4x)
    [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach((ang) => {
      const fin = new THREE.Mesh(this.finGeo, darkMat);
      fin.position.set(-1.18, 1.75 + Math.sin(ang) * 0.64, Math.cos(ang) * 0.64);
      fin.rotation.x = ang;
      group.add(fin);
    });

    const prop = new THREE.Mesh(this.propGeo, stripeMat);
    prop.position.set(-1.62, 1.75, 0);
    group.add(prop);

    const gondola = new THREE.Mesh(this.gondolaGeo, darkMat);
    gondola.position.set(0, 0.9, 0);
    group.add(gondola);

    const hpBg = new THREE.Mesh(
      this.hpBgGeo,
      this._getCachedMoabMat('hp_bg', { color: 0x0f172a, basic: true })
    );
    hpBg.position.set(0, 3.15, 0);
    const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
    const hpFill = new THREE.Mesh(this.hpFillGeo, hpFillMat);
    hpFill.position.set(-1.01, 0, 0.02);
    hpBg.add(hpFill);
    group.add(hpBg);

    const baseScale = def.scale * 0.74;
    group.scale.setScalar(baseScale);
    group.userData.baseScale = baseScale;
    group.userData.body = hull;
    group.userData.propeller = prop;
    group.userData.extraRotors = extraRotors;
    group.userData.thrusters = thrusters;
    group.userData.hpBar = hpBg;
    group.userData.hpFill = hpFill;
    group.userData.disposableMats = [hpFillMat];
    return group;
  }

  _getCachedMoabMat(key, opts) {
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const mat = opts.basic
      ? new THREE.MeshBasicMaterial({ color: opts.color, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial(opts);
    this.materialCache.set(key, mat);
    return mat;
  }
}
