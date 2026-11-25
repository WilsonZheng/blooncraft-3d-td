import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TOWER_TYPES } from '../config/constants.js';

export class TowerMeshFactory {
  constructor() {
    this.geoCache = new Map();
    this.matCache = new Map();

    this.pedestalGeo = this._geo('pedestal', () => new THREE.CylinderGeometry(0.78, 0.96, 0.42, 16));
    this.pedestalTrimGeo = this._geo('pedestalTrim', () => {
      const g = new THREE.TorusGeometry(0.79, 0.045, 8, 24);
      g.rotateX(Math.PI / 2);
      return g;
    });
    this.ringGeo = this._geo('tierRing', () => {
      const g = new THREE.TorusGeometry(0.84, 0.058, 8, 24);
      g.rotateX(Math.PI / 2);
      return g;
    });
    this.buffHaloGeo = this._geo('buffHalo', () => {
      const g = new THREE.RingGeometry(0.96, 1.08, 28);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    this.muzzleGeo = this._geo('muzzle', () => new THREE.SphereGeometry(0.18, 8, 8));
    this.crownGeo = this._geo('crown', () => new THREE.TorusKnotGeometry(0.22, 0.055, 32, 8, 2, 3));
  }

  _geo(key, fn) {
    if (!this.geoCache.has(key)) this.geoCache.set(key, fn());
    return this.geoCache.get(key);
  }

  _mat(key, fn) {
    if (!this.matCache.has(key)) this.matCache.set(key, fn());
    return this.matCache.get(key);
  }

  createTowerMesh(typeId, tier = 0, buffed = false, { isApex = false, stars = 0 } = {}) {
    const def = TOWER_TYPES[typeId];
    const root = new THREE.Group();

    const stoneMat = this._mat(`stone_${tier >= 3 ? 1 : 0}`, () =>
      new THREE.MeshStandardMaterial({
        color: tier >= 3 ? 0x334155 : 0xcbd5e1,
        roughness: 0.52,
        metalness: tier >= 3 ? 0.52 : 0.16
      })
    );
    const mainMat = this._mat(`main_${typeId}`, () =>
      new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.26,
        metalness: 0.42
      })
    );
    const accentMat = this._mat(`accent_${typeId}_${tier}`, () =>
      new THREE.MeshStandardMaterial({
        color: tier >= 4 ? 0xfacc15 : def.accent,
        emissive: tier >= 3 ? def.color : 0x000000,
        emissiveIntensity: tier >= 4 ? 0.72 : 0.28,
        roughness: 0.22,
        metalness: 0.55
      })
    );
    const darkMetal = this._mat('darkMetal', () =>
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.3,
        metalness: 0.84
      })
    );
    const eyeGlowMat = this._mat('eyeGlow', () =>
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.55
      })
    );
    const muzzleMat = this._mat('muzzleFlash', () =>
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );

    // Base pedestal + beveled metallic top rim
    const base = new THREE.Mesh(this.pedestalGeo, stoneMat);
    base.position.y = 0.21;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const baseTrim = new THREE.Mesh(this.pedestalTrimGeo, darkMetal);
    baseTrim.position.y = 0.41;
    root.add(baseTrim);

    // Golden Beacon Buff Ground Halo (visible when buffed by Beacon!)
    const buffHalo = new THREE.Mesh(
      this.buffHaloGeo,
      this._mat('buffHaloMat', () =>
        new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide
        })
      )
    );
    buffHalo.position.y = 0.04;
    buffHalo.visible = Boolean(buffed);
    root.add(buffHalo);
    root.userData.buffHalo = buffHalo;

    // 3D Golden Chrono-Halo above tower during Overclock Ultimate (E)!
    const overclockHalo = new THREE.Mesh(
      this._geo('overclockHalo', () => {
        const g = new THREE.TorusGeometry(0.62, 0.048, 8, 24);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      this._mat('overclockHaloMat', () =>
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 1.95,
          roughness: 0.15
        })
      )
    );
    overclockHalo.position.y = 2.05;
    overclockHalo.visible = false;
    root.add(overclockHalo);
    root.userData.overclockHalo = overclockHalo;

    // Tier indicator rings around pedestal
    for (let i = 0; i < tier; i++) {
      const tierRing = new THREE.Mesh(
        this.ringGeo,
        this._mat(`ring_${typeId}_${i}`, () =>
          new THREE.MeshStandardMaterial({
            color: i === 3 ? 0xfacc15 : def.accent,
            emissive: i === 3 ? 0xeab308 : def.color,
            emissiveIntensity: i === 3 ? 0.9 : 0.4,
            metalness: 0.72,
            roughness: 0.2
          })
        )
      );
      tierRing.position.y = 0.12 + i * 0.11;
      tierRing.scale.setScalar(1.0 - i * 0.04);
      root.add(tierRing);
    }

    // Articulated Turret Head
    const head = new THREE.Group();
    head.position.y = 0.42;
    root.add(head);

    let muzzleFlash = null;

    switch (typeId) {
      case 'dart': {
        const body = new THREE.Mesh(
          this._geo('dart_body', () => new THREE.CylinderGeometry(0.45, 0.52, 0.62, 14)),
          mainMat
        );
        body.position.y = 0.31;
        body.castShadow = true;
        head.add(body);

        const dome = new THREE.Mesh(
          this._geo('dart_dome', () => new THREE.SphereGeometry(0.43, 16, 12)),
          accentMat
        );
        dome.position.y = 0.62;
        head.add(dome);

        // Rounded cyber visor + dual glowing eyes!
        const visor = new THREE.Mesh(
          this._geo('dart_visor_r', () => new RoundedBoxGeometry(0.56, 0.18, 0.24, 3, 0.04)),
          darkMetal
        );
        visor.position.set(0, 0.66, 0.32);
        head.add(visor);

        const eyeGeo = this._geo('cyber_eye', () => new THREE.SphereGeometry(0.055, 8, 8));
        for (const ex of [-0.13, 0.13]) {
          const eye = new THREE.Mesh(eyeGeo, eyeGlowMat);
          eye.position.set(ex, 0.66, 0.43);
          head.add(eye);
        }

        const barrelGeo = this._geo('dart_barrel', () => new THREE.CylinderGeometry(0.08, 0.1, 0.82, 10));
        const barrelCount = tier >= 2 ? 3 : 1;
        for (let b = 0; b < barrelCount; b++) {
          const ang = barrelCount === 1 ? 0 : (b - 1) * 0.24;
          const barrel = new THREE.Mesh(barrelGeo, darkMetal);
          barrel.rotation.x = Math.PI / 2;
          barrel.rotation.z = -ang;
          barrel.position.set(Math.sin(ang) * 0.26, 0.5, 0.46);
          head.add(barrel);
        }
        if (tier >= 2) {
          const quiver = new THREE.Mesh(
            this._geo('dart_quiver', () => new THREE.CylinderGeometry(0.14, 0.11, 0.46, 8)),
            accentMat
          );
          quiver.position.set(-0.34, 0.52, -0.26);
          quiver.rotation.z = 0.28;
          head.add(quiver);
        }
        if (tier >= 3) {
          const bowLimb = new THREE.Mesh(
            this._geo('dart_bow_r', () => new RoundedBoxGeometry(1.26, 0.11, 0.16, 2, 0.03)),
            accentMat
          );
          bowLimb.position.set(0, 0.5, 0.56);
          head.add(bowLimb);
        }
        muzzleFlash = new THREE.Mesh(this.muzzleGeo, muzzleMat);
        muzzleFlash.position.set(0, 0.5, 0.92);
        muzzleFlash.visible = false;
        head.add(muzzleFlash);
        break;
      }

      case 'tack': {
        const core = new THREE.Mesh(
          this._geo('tack_core', () => new THREE.CylinderGeometry(0.54, 0.58, 0.74, 14)),
          tier >= 3 ? accentMat : mainMat
        );
        core.position.y = 0.37;
        core.castShadow = true;
        head.add(core);

        const spinRig = new THREE.Group();
        spinRig.position.y = 0.42;
        const nozzleGeo = this._geo('tack_nozzle', () => new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8));
        const count = tier >= 2 ? 12 : 8;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const nozzle = new THREE.Mesh(nozzleGeo, darkMetal);
          nozzle.rotation.z = Math.PI / 2;
          nozzle.rotation.y = -a;
          nozzle.position.set(Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58);
          spinRig.add(nozzle);
        }
        const sawDisc = new THREE.Mesh(
          this._geo('tack_saw_disc', () => new THREE.CylinderGeometry(0.76, 0.76, 0.04, 12)),
          accentMat
        );
        sawDisc.position.y = -0.14;
        spinRig.add(sawDisc);

        const capGear = new THREE.Mesh(
          this._geo('tack_gear', () => new THREE.CylinderGeometry(0.36, 0.36, 0.12, 8)),
          darkMetal
        );
        capGear.position.y = 0.36;
        spinRig.add(capGear);

        if (tier >= 3) {
          const flameCore = new THREE.Mesh(
            this._geo('tack_flame', () => new THREE.OctahedronGeometry(0.38, 1)),
            this._mat('flameCoreMat', () =>
              new THREE.MeshStandardMaterial({
                color: 0xffedd5,
                emissive: 0xf97316,
                emissiveIntensity: 1.55
              })
            )
          );
          flameCore.position.y = 0.56;
          spinRig.add(flameCore);
        }
        head.add(spinRig);
        root.userData.spinPart = spinRig;
        break;
      }

      case 'cannon': {
        const carriage = new THREE.Mesh(
          this._geo('cannon_carriage_r', () => new RoundedBoxGeometry(0.88, 0.38, 0.88, 3, 0.06)),
          mainMat
        );
        carriage.position.y = 0.19;
        head.add(carriage);

        // Heavy side wheels with hubcaps + stacked shell ammo rack!
        const wheelGeo = this._geo('cannon_wheel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.13, 14));
        for (const wx of [-0.47, 0.47]) {
          const w = new THREE.Mesh(wheelGeo, darkMetal);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.23, 0);
          head.add(w);
        }
        const shellGeo = this._geo('cannon_ammo_shell', () => new THREE.SphereGeometry(0.12, 8, 8));
        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const sh = new THREE.Mesh(shellGeo, accentMat);
          sh.position.set(-0.22 + sIdx * 0.22, 0.44, -0.32);
          head.add(sh);
        }

        const isBig = tier >= 3;
        const barrel = new THREE.Mesh(
          this._geo(`cannon_barrel_${isBig ? 1 : 0}`, () =>
            new THREE.CylinderGeometry(isBig ? 0.37 : 0.28, isBig ? 0.33 : 0.25, 1.18, 16)
          ),
          darkMetal
        );
        barrel.rotation.x = Math.PI / 2 - 0.22;
        barrel.position.set(0, 0.52, 0.35);
        barrel.castShadow = true;
        head.add(barrel);

        const muzzleRing = new THREE.Mesh(
          this._geo(`cannon_ring_${isBig ? 1 : 0}`, () =>
            new THREE.TorusGeometry(isBig ? 0.38 : 0.29, 0.058, 8, 18)
          ),
          accentMat
        );
        muzzleRing.position.set(0, 0.65, 0.88);
        head.add(muzzleRing);

        muzzleFlash = new THREE.Mesh(this.muzzleGeo, muzzleMat);
        muzzleFlash.scale.setScalar(1.75);
        muzzleFlash.position.set(0, 0.66, 1.0);
        muzzleFlash.visible = false;
        head.add(muzzleFlash);
        break;
      }

      case 'frost': {
        const spire = new THREE.Mesh(
          this._geo('frost_spire', () => new THREE.ConeGeometry(0.48, 1.32, 6)),
          this._mat('frostSpireMat', () =>
            new THREE.MeshPhysicalMaterial({
              color: 0x67e8f9,
              emissive: 0x0891b2,
              emissiveIntensity: 0.62,
              roughness: 0.08,
              clearcoat: 1.0
            })
          )
        );
        spire.position.y = 0.66;
        spire.castShadow = true;
        head.add(spire);

        // Hexagonal frost snowflake base ring
        const frostRing = new THREE.Mesh(
          this._geo('frost_hex_ring', () => {
            const g = new THREE.TorusGeometry(0.66, 0.045, 6, 6);
            g.rotateX(Math.PI / 2);
            return g;
          }),
          accentMat
        );
        frostRing.position.y = 0.14;
        head.add(frostRing);

        const orbitGroup = new THREE.Group();
        orbitGroup.position.y = 0.78;
        const shardGeo = this._geo('frost_shard', () => new THREE.OctahedronGeometry(0.17, 0));
        const shardCount = 4 + tier;
        for (let i = 0; i < shardCount; i++) {
          const a = (i / shardCount) * Math.PI * 2;
          const shard = new THREE.Mesh(shardGeo, accentMat);
          shard.position.set(Math.cos(a) * 0.68, (i % 2) * 0.16, Math.sin(a) * 0.68);
          orbitGroup.add(shard);
        }
        head.add(orbitGroup);
        root.userData.spinPart = orbitGroup;
        break;
      }

      case 'ninja': {
        const torso = new THREE.Mesh(
          this._geo('ninja_torso', () => new THREE.CylinderGeometry(0.38, 0.46, 0.65, 12)),
          darkMetal
        );
        torso.position.y = 0.32;
        torso.castShadow = true;
        head.add(torso);

        // Crossed twin shadow katanas on back!
        const bladeGeo = this._geo('ninja_katana', () => new THREE.BoxGeometry(0.06, 0.96, 0.03));
        for (const dir of [-1, 1]) {
          const katana = new THREE.Mesh(bladeGeo, accentMat);
          katana.position.set(dir * 0.08, 0.56, -0.34);
          katana.rotation.z = dir * 0.58;
          head.add(katana);
        }

        const hood = new THREE.Mesh(
          this._geo('ninja_hood', () => new THREE.SphereGeometry(0.4, 14, 12)),
          mainMat
        );
        hood.position.y = 0.78;
        head.add(hood);

        const band = new THREE.Mesh(
          this._geo('ninja_band', () => new THREE.CylinderGeometry(0.41, 0.41, 0.12, 14)),
          accentMat
        );
        band.position.y = 0.8;
        head.add(band);

        // Glowing ninja eyes + fluttering twin headband tails!
        const eyeGeo = this._geo('cyber_eye', () => new THREE.SphereGeometry(0.055, 8, 8));
        for (const ex of [-0.12, 0.12]) {
          const eye = new THREE.Mesh(eyeGeo, eyeGlowMat);
          eye.position.set(ex, 0.77, 0.37);
          head.add(eye);
        }
        const scarfGrp = new THREE.Group();
        scarfGrp.position.set(0, 0.8, -0.38);
        const tailGeo = this._geo('ninja_tail', () => new THREE.BoxGeometry(0.11, 0.05, 0.48));
        for (const sx of [-0.1, 0.1]) {
          const tail = new THREE.Mesh(tailGeo, accentMat);
          tail.position.set(sx, -0.04, -0.22);
          tail.rotation.y = sx * 0.8;
          scarfGrp.add(tail);
        }
        head.add(scarfGrp);
        root.userData.scarfGrp = scarfGrp;

        const shuriken = new THREE.Mesh(
          this._geo('ninja_star', () => new THREE.OctahedronGeometry(0.28, 0)),
          accentMat
        );
        shuriken.scale.set(1, 0.18, 1);
        shuriken.position.set(0.42, 0.5, 0.36);
        head.add(shuriken);
        root.userData.spinPart = shuriken;
        break;
      }

      case 'sniper': {
        const towerPillar = new THREE.Mesh(
          this._geo('sniper_pillar', () => new THREE.CylinderGeometry(0.36, 0.54, 0.88, 10)),
          stoneMat
        );
        towerPillar.position.y = 0.44;
        root.add(towerPillar);
        head.position.y = 0.9;

        const turret = new THREE.Mesh(
          this._geo('sniper_turret_r', () => new RoundedBoxGeometry(0.58, 0.46, 0.68, 3, 0.06)),
          mainMat
        );
        turret.position.y = 0.23;
        turret.castShadow = true;
        head.add(turret);

        const rifle = new THREE.Mesh(
          this._geo('sniper_rifle', () => new THREE.CylinderGeometry(0.068, 0.092, 1.56, 12)),
          darkMetal
        );
        rifle.rotation.x = Math.PI / 2;
        rifle.position.set(0, 0.26, 0.82);
        head.add(rifle);

        const scope = new THREE.Mesh(
          this._geo('sniper_scope', () => new THREE.CylinderGeometry(0.062, 0.062, 0.48, 10)),
          accentMat
        );
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.42, 0.44);
        head.add(scope);

        const laserMat = this._mat('sniperLaserMat', () =>
          new THREE.MeshStandardMaterial({ color: 0xfecaca, emissive: 0xef4444, emissiveIntensity: 1.6 })
        );
        const laserPod = new THREE.Mesh(
          this._geo('sniper_laser', () => new THREE.SphereGeometry(0.055, 8, 8)),
          laserMat
        );
        laserPod.position.set(0, 0.42, 0.69);
        head.add(laserPod);

        // Visible crimson infrared laser sight ray!
        const sightRay = new THREE.Mesh(
          this._geo('sniper_sight_ray', () => new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6)),
          this._mat('sniperSightRayMat', () =>
            new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.48 })
          )
        );
        sightRay.rotation.x = Math.PI / 2;
        sightRay.position.set(0, 0.42, 1.82);
        head.add(sightRay);

        muzzleFlash = new THREE.Mesh(this.muzzleGeo, muzzleMat);
        muzzleFlash.position.set(0, 0.26, 1.62);
        muzzleFlash.visible = false;
        head.add(muzzleFlash);
        break;
      }

      case 'tesla': {
        const coil = new THREE.Mesh(
          this._geo('tesla_coil', () => new THREE.CylinderGeometry(0.28, 0.46, 1.06, 14)),
          darkMetal
        );
        coil.position.y = 0.53;
        coil.castShadow = true;
        head.add(coil);

        // Side twin Jacob's-ladder lightning electrodes
        const rodGeo = this._geo('tesla_side_rod', () => new THREE.CylinderGeometry(0.04, 0.05, 0.85, 8));
        for (const rx of [-0.46, 0.46]) {
          const rod = new THREE.Mesh(rodGeo, accentMat);
          rod.position.set(rx, 0.55, 0);
          rod.rotation.z = -rx * 0.35;
          head.add(rod);
        }

        for (let r = 0; r < 3; r++) {
          const copper = new THREE.Mesh(
            this._geo(`tesla_ring_${r}`, () => new THREE.TorusGeometry(0.42 - r * 0.05, 0.05, 8, 20)),
            mainMat
          );
          copper.rotation.x = Math.PI / 2;
          copper.position.y = 0.32 + r * 0.28;
          head.add(copper);
        }

        const orb = new THREE.Mesh(
          this._geo('tesla_orb', () => new THREE.SphereGeometry(0.34, 16, 16)),
          this._mat('teslaOrbMat', () =>
            new THREE.MeshStandardMaterial({
              color: 0xfef9c3,
              emissive: 0xfacc15,
              emissiveIntensity: 1.55
            })
          )
        );
        orb.position.y = 1.26;
        orb.scale.setScalar(1 + tier * 0.09);
        head.add(orb);
        root.userData.pulsePart = orb;

        // Gyroscopic Plasma Cage Rings orbiting the lightning core!
        const cageGrp = new THREE.Group();
        cageGrp.position.y = 1.26;
        const cageRingGeo = this._geo('tesla_cage', () => new THREE.TorusGeometry(0.52, 0.032, 8, 24));
        const c1 = new THREE.Mesh(cageRingGeo, accentMat);
        c1.rotation.x = Math.PI * 0.28;
        const c2 = new THREE.Mesh(cageRingGeo, accentMat);
        c2.rotation.y = Math.PI * 0.5;
        c2.rotation.x = -Math.PI * 0.28;
        cageGrp.add(c1, c2);
        head.add(cageGrp);
        root.userData.spinPart = cageGrp;
        break;
      }

      case 'beacon': {
        const pillar = new THREE.Mesh(
          this._geo('beacon_pillar', () => new THREE.CylinderGeometry(0.45, 0.58, 0.9, 8)),
          mainMat
        );
        pillar.position.y = 0.45;
        pillar.castShadow = true;
        head.add(pillar);

        // Four corner golden obelisk lanterns
        const miniPostGeo = this._geo('beacon_post', () => new THREE.CylinderGeometry(0.06, 0.07, 0.56, 6));
        for (const [px, pz] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
          const post = new THREE.Mesh(miniPostGeo, accentMat);
          post.position.set(px, 0.28, pz);
          head.add(post);
        }

        const roof = new THREE.Mesh(
          this._geo('beacon_roof', () => new THREE.ConeGeometry(0.74, 0.48, 8)),
          accentMat
        );
        roof.position.y = 1.12;
        head.add(roof);

        const radarGroup = new THREE.Group();
        radarGroup.position.y = 1.48;
        const gem = new THREE.Mesh(
          this._geo('beacon_gem', () => new THREE.OctahedronGeometry(0.28, 0)),
          this._mat('beaconGemMat', () =>
            new THREE.MeshStandardMaterial({
              color: 0xfef08a,
              emissive: 0xf59e0b,
              emissiveIntensity: 1.2,
              metalness: 0.6,
              roughness: 0.15
            })
          )
        );
        radarGroup.add(gem);
        if (tier >= 2) {
          const dish = new THREE.Mesh(
            this._geo('beacon_dish', () => new THREE.TorusGeometry(0.46, 0.042, 8, 20)),
            stoneMat
          );
          radarGroup.add(dish);
        }
        head.add(radarGroup);
        root.userData.spinPart = radarGroup;
        break;
      }
    }

    // Tier 4 Masterwork Floating Golden Halo Crown!
    if (tier >= 4) {
      const crown = new THREE.Mesh(
        this.crownGeo,
        this._mat('tier4CrownMat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.4,
            metalness: 0.85,
            roughness: 0.15
          })
        )
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 1.65;
      head.add(crown);
    }

    // Apex Fusion Dual Orbital Plasma Rings + Ascension Scale!
    if (isApex || stars > 0) {
      const apexGrp = new THREE.Group();
      apexGrp.position.y = 0.85;
      if (isApex) {
        const apexRingGeo = this._geo('apexOrbitRing', () => new THREE.TorusGeometry(0.95, 0.045, 8, 32));
        const apexMat = this._mat('apexOrbitMat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xe0f2fe,
            emissive: 0x38bdf8,
            emissiveIntensity: 1.6,
            roughness: 0.15
          })
        );
        const r1 = new THREE.Mesh(apexRingGeo, apexMat);
        r1.rotation.x = Math.PI * 0.36;
        const r2 = new THREE.Mesh(apexRingGeo, apexMat);
        r2.rotation.x = -Math.PI * 0.36;
        r2.rotation.y = Math.PI * 0.5;
        apexGrp.add(r1, r2);
      }
      if (stars > 0) {
        const starOrbGeo = this._geo('ascendStarOrb', () => new THREE.OctahedronGeometry(0.14, 0));
        const starOrbMat = this._mat('ascendStarMat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xa855f7,
            emissiveIntensity: 1.5
          })
        );
        const count = Math.min(6, stars);
        for (let s = 0; s < count; s++) {
          const a = (s / count) * Math.PI * 2;
          const orb = new THREE.Mesh(starOrbGeo, starOrbMat);
          orb.position.set(Math.cos(a) * 0.82, 0.72, Math.sin(a) * 0.82);
          apexGrp.add(orb);
        }
      }
      root.add(apexGrp);
      root.userData.apexOrbit = apexGrp;
      const scaleBoost = (isApex ? 1.14 : 1.0) * (1 + Math.min(5, stars) * 0.035);
      root.scale.setScalar(scaleBoost);
    }

    root.userData.head = head;
    root.userData.muzzleFlash = muzzleFlash;
    return root;
  }
}
