import * as THREE from 'three';

export class MapBuilder {
  build(mapDef) {
    const group = new THREE.Group();
    const animatedProps = [];

    // Smooth 3D path spline
    const rawPoints = mapDef.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(rawPoints, false, 'catmullrom', 0.22);
    const totalLength = curve.getLength();
    const sampledPoints = curve.getSpacedPoints(260);

    const isLava = mapDef.theme === 'volcano';
    const isGlacier = mapDef.theme === 'glacier';

    // 1. Stylized Water / Magma / Arctic Ocean with Real-Time 3D Vertex Ripples
    const waterGeo = new THREE.PlaneGeometry(150, 150, 26, 26);
    waterGeo.rotateX(-Math.PI / 2);
    const waterBaseY = new Float32Array(waterGeo.attributes.position.count);
    for (let i = 0; i < waterBaseY.length; i++) {
      waterBaseY[i] = waterGeo.attributes.position.getY(i);
    }
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: mapDef.waterColor,
      emissive: isLava ? 0xd93800 : (isGlacier ? 0x0369a1 : 0x0284c7),
      emissiveIntensity: isLava ? 0.68 : 0.14,
      roughness: isLava ? 0.36 : 0.11,
      metalness: isLava ? 0.12 : 0.24,
      clearcoat: isLava ? 0.15 : 0.92,
      flatShading: true
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.64;
    group.add(water);
    animatedProps.push({ type: 'waterWave', geo: waterGeo, baseY: waterBaseY, amp: isLava ? 0.08 : 0.11 });

    // 2. Beveled Multi-Tier Rounded 3D Diorama Island (Expanded 36.8 x 21.6 for spacious tower placement!)
    const topShape = this._createRoundedRectShape(36.8, 21.6, 2.8);
    const grassGeo = new THREE.ExtrudeGeometry(topShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.35,
      bevelThickness: 0.22
    });
    grassGeo.rotateX(Math.PI / 2);
    const grassMat = new THREE.MeshStandardMaterial({
      color: mapDef.groundColor,
      roughness: 0.84,
      metalness: 0.02
    });
    const islandTop = new THREE.Mesh(grassGeo, grassMat);
    islandTop.position.y = -0.22;
    islandTop.receiveShadow = true;
    group.add(islandTop);

    // Middle Shoreline / Beach Ledge
    const shoreShape = this._createRoundedRectShape(38.6, 23.4, 3.3);
    const shoreGeo = new THREE.ExtrudeGeometry(shoreShape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.3,
      bevelThickness: 0.18
    });
    shoreGeo.rotateX(Math.PI / 2);
    const shoreColor = isLava ? 0x292024 : (isGlacier ? 0xbae6fd : 0xe9cb88);
    const shoreMat = new THREE.MeshStandardMaterial({ color: shoreColor, roughness: 0.9 });
    const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
    shoreMesh.position.y = -0.56;
    shoreMesh.receiveShadow = true;
    group.add(shoreMesh);

    // Foam / Glow Ring right at water level
    const foamShape = this._createRoundedRectShape(39.8, 24.6, 3.7);
    const foamHole = this._createRoundedRectShape(38.6, 23.4, 3.3);
    foamShape.holes.push(foamHole);
    const foamGeo = new THREE.ShapeGeometry(foamShape, 24);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: isLava ? 0xff922b : 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.position.y = -0.59;
    group.add(foamMesh);
    animatedProps.push({ type: 'foam', mesh: foamMesh, mat: foamMat });

    // Subtle decorative grass patches on terrain for visual texture
    const patchMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x4a3b42 : (isGlacier ? 0xcfe8f7 : 0x4ca636),
      roughness: 0.9
    });
    const patchPositions = [
      [-6.8, -0.5, 2.2], [0.1, -0.2, 2.3], [7.0, 0.2, 2.2],
      [-13.2, 0.8, 1.9], [13.6, 1.2, 2.0], [0.2, 7.6, 1.6]
    ];
    patchPositions.forEach(([px, pz, r]) => {
      if (this._minDistToSamples(px, pz, sampledPoints) > 2.0) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(r, 18), patchMat);
        p.rotation.x = -Math.PI / 2;
        p.position.set(px, 0.012, pz);
        p.receiveShadow = true;
        group.add(p);
      }
    });

    // 3. Multi-layer Road Ribbon (Stone Curb + Cobble Road + Center Trail)
    const roadWidth = 1.56;
    const curbRibbon = this._createRibbonGeometry(curve, 240, roadWidth + 0.42, 0.022);
    const curbMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x9a3412 : (isGlacier ? 0x64748b : 0x9c9284),
      roughness: 0.8
    });
    const curbMesh = new THREE.Mesh(curbRibbon, curbMat);
    curbMesh.receiveShadow = true;
    group.add(curbMesh);

    const roadRibbon = this._createRibbonGeometry(curve, 240, roadWidth, 0.042);
    const roadMat = new THREE.MeshStandardMaterial({
      color: mapDef.roadColor,
      roughness: 0.88
    });
    const roadMesh = new THREE.Mesh(roadRibbon, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    const innerTrail = this._createRibbonGeometry(curve, 240, roadWidth * 0.46, 0.05);
    const innerMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x7c2d12 : (isGlacier ? 0xcbd5e1 : 0xdfc8a2),
      roughness: 0.9
    });
    const innerMesh = new THREE.Mesh(innerTrail, innerMat);
    innerMesh.receiveShadow = true;
    group.add(innerMesh);

    // Animated Flowing Direction Chevrons
    const chevronGeo = new THREE.ConeGeometry(0.21, 0.36, 3);
    chevronGeo.rotateX(Math.PI / 2);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: isLava ? 0xfdba74 : (isGlacier ? 0x38bdf8 : 0xffffff),
      transparent: true,
      opacity: 0.48
    });
    const chevronMeshes = [];
    const chevronCount = 18;
    for (let i = 0; i < chevronCount; i++) {
      const u = (i + 0.5) / chevronCount;
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const chev = new THREE.Mesh(chevronGeo, chevronMat);
      chev.position.set(pt.x, 0.068, pt.z);
      chev.scale.set(1, 0.14, 1);
      chev.lookAt(pt.x + tan.x, 0.068, pt.z + tan.z);
      group.add(chev);
      chevronMeshes.push({ mesh: chev, baseU: u });
    }
    animatedProps.push({ type: 'roadChevrons', items: chevronMeshes, curve });

    // 4. Spawn Portal Gate & Exit Sanctuary Shield
    const startPt = curve.getPointAt(0);
    const startTan = curve.getTangentAt(0);
    const spawnGate = this._createGate(0xef4444, 0xfca5a5, false);
    spawnGate.position.copy(startPt);
    spawnGate.lookAt(startPt.clone().add(startTan));
    group.add(spawnGate);

    const endPt = curve.getPointAt(1);
    const endTan = curve.getTangentAt(1);
    const exitGate = this._createGate(0x3b82f6, 0x93c5fd, true);
    exitGate.position.copy(endPt);
    exitGate.lookAt(endPt.clone().sub(endTan));
    group.add(exitGate);

    // (Drifting clouds removed per player feedback for crystal-clear unobstructed battlefield visibility)

    // 6. Signature Animated 3D Landmarks placed strictly on unobstructed outer scenic corners
    const obstacles = [];
    const landmarkSpot = this._pickLandmarkSpot(mapDef.theme, sampledPoints);
    if (landmarkSpot) {
      const lm = this._createLandmark(mapDef.theme, animatedProps);
      lm.position.set(landmarkSpot.x, 0, landmarkSpot.z);
      group.add(lm);
      obstacles.push({ x: landmarkSpot.x, z: landmarkSpot.z, radius: 1.45 });
    }

    // 6b. Scenic Roadside Stone Bridge Parapets & Lantern Posts along path straights
    this._buildRoadsideBridges(group, curve, mapDef.theme, animatedProps);

    // 6c. Tactical High-Ground Bastion Pads (+15% Range & +15% Damage elevated turret mounts!)
    const highGroundPads = this._buildHighGroundPads(group, mapDef.theme, sampledPoints, obstacles, animatedProps);

    // 7. Wildflower Tufts / Lava Rocks / Ice Crystals & Fences (non-blocking tiny ground details)
    this._scatterGroundDetails(group, mapDef.theme, sampledPoints, animatedProps);

    // 8. Varied Scenic Perimeter Props (strictly along outer island rim so inner bends stay 100% open!)
    const propCandidates = [
      [-15.6, -8.8], [-11.8, -9.1], [-5.2, -9.2], [1.2, -9.2], [7.8, -9.1], [14.8, -8.8],
      [-15.6, 8.8], [-11.5, 9.1], [-5.5, 9.2], [1.2, 9.2], [7.8, 9.1], [14.8, 8.8],
      [-16.2, 1.0], [16.2, 2.2]
    ];

    propCandidates.forEach(([px, pz], idx) => {
      const distToRoad = this._minDistToSamples(px, pz, sampledPoints);
      if (distToRoad < 2.2) return;
      if (landmarkSpot && Math.hypot(px - landmarkSpot.x, pz - landmarkSpot.z) < 2.8) return;
      if (highGroundPads.some((p) => Math.hypot(px - p.x, pz - p.z) < 2.4)) return;
      const prop = this._createThemeProp(mapDef.theme, idx);
      prop.position.set(px, 0, pz);
      group.add(prop);
      obstacles.push({ x: px, z: pz, radius: 0.92 });
    });

    // 9. Dynamic 3-Phase Map Evolution Props (Awaken at Wave 10 & Wave 20!)
    const evolutionData = this._buildEvolutionProps(
      group,
      mapDef.theme,
      sampledPoints,
      { curbMat, innerMat, chevronMat, waterMat },
      animatedProps
    );

    return {
      group,
      curve,
      totalLength,
      sampledPoints,
      roadWidth,
      obstacles,
      highGroundPads,
      islandBounds: { minX: -16.6, maxX: 16.6, minZ: -9.1, maxZ: 9.1 },
      water,
      curbMat,
      evolutionData,
      animatedProps
    };
  }

  _buildEvolutionProps(group, theme, sampledPoints, mats, animatedProps) {
    const isLava = theme === 'volcano';
    const isGlacier = theme === 'glacier';
    const evoColor = isLava ? 0xf97316 : (isGlacier ? 0x38bdf8 : 0xf59e0b);
    const evoLight = isLava ? 0xffedd5 : (isGlacier ? 0xe0f2fe : 0xfef3c7);

    // 4 Corner Arcane Pylons (dormant in Phase 0, levitating & glowing in Phase 1 & 2)
    const pylonGemMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: evoColor,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.5
    });
    const pylonBaseMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x1c1917 : 0x475569,
      roughness: 0.7
    });
    const pylons = [];
    for (const [cx, cz] of [[-16.0, -7.8], [16.0, -7.8], [-16.0, 7.8], [16.0, 7.8]]) {
      const pGrp = new THREE.Group();
      pGrp.position.set(cx, 0, cz);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 0.72, 6), pylonBaseMat);
      ped.position.y = 0.36;
      pGrp.add(ped);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), pylonGemMat);
      gem.position.y = 1.05;
      gem.scale.set(0.8, 1.4, 0.8);
      pGrp.add(gem);
      group.add(pGrp);
      pylons.push(gem);
    }

    // Theme-specific Phase 1/2 Awakening Group
    const themeEvoGrp = new THREE.Group();
    themeEvoGrp.visible = false;

    if (isLava) {
      // Glowing molten lava fissures cracking across the obsidian island floor!
      const crackMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xea580c,
        emissiveIntensity: 1.55,
        roughness: 0.2
      });
      const crackSpots = [
        [-11.2, -3.5, 0.4], [-3.8, 4.2, -0.5], [3.2, -4.6, 0.7],
        [9.8, 4.4, -0.3], [-9.2, 6.2, 0.2], [11.5, -5.8, -0.6]
      ];
      for (const [fx, fz, rot] of crackSpots) {
        if (this._minDistToSamples(fx, fz, sampledPoints) < 1.8) continue;
        const fGrp = new THREE.Group();
        fGrp.position.set(fx, 0.018, fz);
        fGrp.rotation.y = rot;
        const seg1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), crackMat);
        seg1.rotation.x = -Math.PI / 2;
        const seg2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.11), crackMat);
        seg2.rotation.x = -Math.PI / 2;
        seg2.rotation.z = 0.55;
        seg2.position.set(0.55, 0.002, 0.28);
        fGrp.add(seg1, seg2);
        themeEvoGrp.add(fGrp);
      }
    } else if (isGlacier) {
      // Shimmering 3D Aurora Borealis Sky Ribbons far along the northern horizon!
      const auroraColors = [0x34d399, 0x38bdf8, 0xa855f7];
      const ribbons = [];
      auroraColors.forEach((col, idx) => {
        const aGeo = new THREE.PlaneGeometry(34, 2.4, 28, 1);
        const aMat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const ribbon = new THREE.Mesh(aGeo, aMat);
        ribbon.position.set((idx - 1) * 3.5, 4.6 + idx * 0.9, -15.2 - idx * 0.8);
        ribbon.rotation.x = 0.25;
        themeEvoGrp.add(ribbon);
        ribbons.push({ geo: aGeo, phase: idx * 1.7 });
      });
      animatedProps.push({ type: 'aurora', ribbons, group: themeEvoGrp });
    } else {
      // Meadow Golden Twilight Lantern Posts & Magical Rune Rings around perimeter!
      const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const glowMat = new THREE.MeshStandardMaterial({
        color: evoLight,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.5
      });
      for (const [lx, lz] of [[-13.5, -8.4], [-3.2, -8.6], [4.5, -8.6], [12.8, -8.4], [-13.5, 8.4], [4.2, 8.5]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.05, 6), postMat);
        post.position.set(lx, 0.52, lz);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), glowMat);
        orb.position.set(lx, 1.12, lz);
        themeEvoGrp.add(post, orb);
      }
    }

    group.add(themeEvoGrp);
    animatedProps.push({ type: 'evoPylons', pylons });

    return {
      phase: 0,
      evoColor,
      evoLight,
      pylonGemMat,
      pylons,
      themeEvoGrp,
      ...mats
    };
  }

  _pickLandmarkSpot(theme, sampledPoints) {
    const candidates = theme === 'meadow'
      ? [[14.5, 6.8], [-14.5, -7.2], [14.6, -7.2]]
      : theme === 'volcano'
      ? [[-14.6, -7.2], [14.6, 6.8]]
      : [[14.6, -7.0], [-14.6, -7.0]];
    for (const [x, z] of candidates) {
      if (this._minDistToSamples(x, z, sampledPoints) >= 2.6) {
        return { x, z };
      }
    }
    return null;
  }

  _buildRoadsideBridges(group, curve, theme, animatedProps) {
    const isLava = theme === 'volcano';
    const isGlacier = theme === 'glacier';
    const stoneMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x292524 : (isGlacier ? 0x94a3b8 : 0x9ca3af),
      roughness: 0.72,
      metalness: 0.18
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x7c2d12 : (isGlacier ? 0x475569 : 0x92400e),
      roughness: 0.8
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0xffedd5 : (isGlacier ? 0xe0f2fe : 0xfef3c7),
      emissive: isLava ? 0xf97316 : (isGlacier ? 0x38bdf8 : 0xf59e0b),
      emissiveIntensity: 1.15
    });

    const bridgeSpots = [0.28, 0.72];
    const up = new THREE.Vector3(0, 1, 0);
    for (const u of bridgeSpots) {
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u).normalize();
      const side = new THREE.Vector3().crossVectors(up, tan).normalize();

      const bridgeGrp = new THREE.Group();
      bridgeGrp.position.set(pt.x, 0, pt.z);
      bridgeGrp.rotation.y = Math.atan2(tan.x, tan.z);

      // Plank deck slats across road
      for (let s = -2; s <= 2; s++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.04, 0.28), woodMat);
        plank.position.set(0, 0.055, s * 0.36);
        plank.receiveShadow = true;
        bridgeGrp.add(plank);
      }
      // Twin low stone parapets on left/right sides of road (never blocks view of bloons)
      for (const sx of [-1.14, 1.14]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 1.85), stoneMat);
        wall.position.set(sx, 0.21, 0);
        wall.castShadow = true;
        bridgeGrp.add(wall);

        for (const sz of [-0.82, 0.82]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.68, 8), stoneMat);
          post.position.set(sx, 0.34, sz);
          bridgeGrp.add(post);
        }
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), lanternMat);
        lamp.position.set(sx, 0.76, 0);
        bridgeGrp.add(lamp);
      }
      group.add(bridgeGrp);
      void side;
    }
    animatedProps.push({ type: 'bridgeLanterns', mat: lanternMat });
  }

  _buildHighGroundPads(group, theme, sampledPoints, obstacles, animatedProps) {
    const isLava = theme === 'volcano';
    const isGlacier = theme === 'glacier';
    const candidates =
      theme === 'meadow'
        ? [[-6.7, -2.4], [0.2, 2.2], [7.0, -2.2], [13.2, 1.6], [-12.8, 1.2]]
        : theme === 'volcano'
        ? [[-6.8, -2.2], [-0.8, -2.6], [6.2, 3.2], [13.0, 1.2], [-13.2, 1.5]]
        : [[-7.0, -2.2], [0.4, 1.8], [7.8, -2.2], [13.8, -1.2], [-13.0, -1.0]];

    const pads = [];
    const baseGeo = new THREE.CylinderGeometry(1.06, 1.26, 0.32, 8);
    const rimGeo = new THREE.TorusGeometry(1.04, 0.06, 8, 24);
    rimGeo.rotateX(Math.PI / 2);
    const runeGeo = new THREE.RingGeometry(0.55, 0.76, 6);
    runeGeo.rotateX(-Math.PI / 2);

    const baseMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0x292524 : (isGlacier ? 0xcbd5e1 : 0x94a3b8),
      roughness: 0.62,
      metalness: 0.25
    });
    const runeMat = new THREE.MeshStandardMaterial({
      color: isLava ? 0xfdba74 : (isGlacier ? 0x7dd3fc : 0xfef08a),
      emissive: isLava ? 0xf97316 : (isGlacier ? 0x0ea5e9 : 0xeab308),
      emissiveIntensity: 1.15,
      roughness: 0.25
    });

    for (const [px, pz] of candidates) {
      if (pads.length >= 4) break;
      if (this._minDistToSamples(px, pz, sampledPoints) < 1.85) continue;
      if (obstacles.some((o) => Math.hypot(o.x - px, o.z - pz) < 2.5)) continue;

      const padGrp = new THREE.Group();
      padGrp.position.set(px, 0, pz);

      const pedestal = new THREE.Mesh(baseGeo, baseMat);
      pedestal.position.y = 0.16;
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      padGrp.add(pedestal);

      const rim = new THREE.Mesh(rimGeo, runeMat);
      rim.position.y = 0.32;
      padGrp.add(rim);

      const rune = new THREE.Mesh(runeGeo, runeMat);
      rune.position.y = 0.33;
      padGrp.add(rune);

      group.add(padGrp);
      pads.push({ x: px, z: pz, y: 0.32, mesh: padGrp, rune });
    }
    animatedProps.push({ type: 'highGroundRunes', pads, mat: runeMat });
    return pads;
  }

  _createLandmark(theme, animatedProps) {
    const g = new THREE.Group();
    if (theme === 'meadow') {
      // Classic Red-and-Cream 3D Dutch Windmill with Cottage Door, Warm Windows & Spinning Sails!
      const stoneFoundation = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.18, 0.35, 10),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.78 })
      );
      stoneFoundation.position.y = 0.18;
      g.add(stoneFoundation);

      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 1.04, 2.4, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 })
      );
      tower.position.y = 1.35;
      tower.castShadow = true;
      g.add(tower);

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.62, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      door.position.set(0, 0.56, 0.96);
      g.add(door);

      const winMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.2
      });
      for (const wx of [-0.52, 0.52]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.12), winMat);
        win.position.set(wx, 1.5, 0.66);
        win.rotation.y = wx > 0 ? 0.55 : -0.55;
        g.add(win);
      }

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.92, 0.98, 10),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 })
      );
      roof.position.y = 2.98;
      roof.castShadow = true;
      g.add(roof);

      const hub = new THREE.Group();
      hub.position.set(0, 2.28, 0.78);
      const nose = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      nose.rotation.x = Math.PI / 2;
      hub.add(nose);

      const sailMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.6, side: THREE.DoubleSide });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        const spar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.85, 0.08), woodMat);
        spar.position.y = 0.95;
        arm.add(spar);
        const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.45, 0.03), sailMat);
        canvas.position.set(0.22, 1.08, 0.03);
        arm.add(canvas);
        hub.add(arm);
      }
      g.add(hub);
      animatedProps.push({ type: 'spinZ', mesh: hub, speed: -1.15 });
      return g;
    }

    if (theme === 'volcano') {
      // Obsidian Magma Shrine with 4 Rune Obelisks & Levitating Fire Crystal
      const obsMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.75 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.32, 0.9, 6), obsMat);
      base.position.y = 0.45;
      base.castShadow = true;
      g.add(base);

      const lavaRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.08, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xea580c, emissiveIntensity: 1.4 })
      );
      lavaRing.rotation.x = Math.PI / 2;
      lavaRing.position.y = 0.88;
      g.add(lavaRing);

      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.55, 5), obsMat);
        obelisk.position.set(Math.cos(a) * 1.38, 0.78, Math.sin(a) * 1.38);
        obelisk.rotation.z = -Math.cos(a) * 0.14;
        obelisk.rotation.x = Math.sin(a) * 0.14;
        g.add(obelisk);
      }

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.68, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffedd5,
          emissive: 0xf97316,
          emissiveIntensity: 1.45,
          roughness: 0.2
        })
      );
      crystal.position.y = 1.98;
      crystal.scale.set(0.85, 1.45, 0.85);
      g.add(crystal);
      animatedProps.push({ type: 'spinY', mesh: crystal, speed: 1.45 });
      return g;
    }

    // Glacier Coastal Lighthouse with Balcony Railing, Keeper Cottage & Rotating Beacon
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.88, 2.75, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 })
    );
    body.position.y = 1.38;
    body.castShadow = true;
    g.add(body);

    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.74, 0.72, 14),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55 })
    );
    redBand.position.y = 1.38;
    g.add(redBand);

    const balcony = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.62, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    balcony.position.y = 2.74;
    g.add(balcony);

    const cottage = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.75, 0.82),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 })
    );
    cottage.position.set(-0.88, 0.38, 0.25);
    g.add(cottage);

    const cottageRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.76, 0.48, 4),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    );
    cottageRoof.rotation.y = Math.PI / 4;
    cottageRoof.position.set(-0.88, 0.98, 0.25);
    g.add(cottageRoof);

    const lantern = new THREE.Group();
    lantern.position.y = 3.02;
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.48, 10),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.25 })
    );
    lantern.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 2.8, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    beam.rotation.z = -Math.PI / 2;
    beam.position.x = 1.5;
    lantern.add(beam);
    g.add(lantern);
    animatedProps.push({ type: 'spinY', mesh: lantern, speed: 1.2 });
    return g;
  }

  _scatterGroundDetails(group, theme, sampledPoints, animatedProps) {
    if (theme === 'meadow') {
      const flowerColors = [0xf43f5e, 0xfacc15, 0xa855f7, 0xf8fafc];
      const spots = [
        [-11.2, -3.2], [-3.8, -6.2], [2.4, -6.4], [9.5, -6.4],
        [-2.8, 6.6], [4.5, 6.6], [11.2, 3.0], [-9.5, 2.4]
      ];
      const flowerGeo = new THREE.SphereGeometry(0.11, 6, 6);
      spots.forEach(([fx, fz], idx) => {
        if (this._minDistToSamples(fx, fz, sampledPoints) < 1.65) return;
        const mat = new THREE.MeshStandardMaterial({ color: flowerColors[idx % flowerColors.length], roughness: 0.82 });
        for (let k = 0; k < 4; k++) {
          const fl = new THREE.Mesh(flowerGeo, mat);
          fl.position.set(fx + (k - 1.5) * 0.22, 0.08, fz + ((k % 2) - 0.5) * 0.24);
          group.add(fl);
        }
      });

      // Cute wooden fence segments along top outer edge
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
      for (const fx of [-8.4, -7.2, 7.6, 8.8]) {
        const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), fenceMat);
        post1.position.set(fx, 0.27, -8.95);
        const post2 = post1.clone();
        post2.position.set(fx + 0.95, 0.27, -8.95);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.09, 0.06), fenceMat);
        rail.position.set(fx + 0.47, 0.38, -8.95);
        group.add(post1, post2, rail);
      }

      // Bobbing 3D Coastal Sailboat in outer bottom-right harbor water (zero obstruction!)
      const boat = new THREE.Group();
      boat.position.set(10.8, -0.45, 11.4);
      const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.32, 1.65, 8),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })
      );
      hull.rotation.z = Math.PI / 2;
      hull.scale.set(0.55, 1, 0.82);
      boat.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7 })
      );
      mast.position.y = 0.85;
      boat.add(mast);
      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1.35, 3),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
      );
      sail.position.set(0.12, 0.95, 0);
      sail.scale.set(1, 1, 0.18);
      boat.add(sail);
      group.add(boat);
      if (animatedProps) animatedProps.push({ type: 'bobBoat', mesh: boat, baseY: -0.45 });
    } else if (theme === 'volcano') {
      // Glowing basalt sea spires in outer magma ocean
      const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
      for (const [bx, bz, s] of [[-12.5, 11.4, 1.1], [9.8, 11.6, 1.35], [13.5, -11.4, 1.0]]) {
        const rock = new THREE.Mesh(new THREE.ConeGeometry(0.95 * s, 1.9 * s, 6), basaltMat);
        rock.position.set(bx, -0.2, bz);
        group.add(rock);
      }
    } else if (theme === 'glacier') {
      // Floating sea-ice crystal floes in outer arctic ocean
      const iceMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.25, metalness: 0.15 });
      for (const [ix, iz, s] of [[-11.8, 11.4, 1.2], [10.4, 11.5, 1.3], [-12.5, -11.4, 1.05]]) {
        const floe = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.3 * s, 0.35, 6), iceMat);
        floe.position.set(ix, -0.52, iz);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 1.45 * s, 5), iceMat);
        spire.position.set(ix + 0.2, 0.1, iz);
        group.add(floe, spire);
      }
    }
  }

  _createRoundedRectShape(w, h, r) {
    const x = -w / 2;
    const y = -h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  _createCloud(mat) {
    const g = new THREE.Group();
    const puffs = [
      [0, 0, 0, 1.1],
      [-0.95, -0.15, 0.1, 0.82],
      [0.95, -0.1, -0.1, 0.88],
      [0.3, 0.35, 0.2, 0.75]
    ];
    puffs.forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
      m.position.set(x, y, z);
      g.add(m);
    });
    return g;
  }

  _createRibbonGeometry(curve, segments, width, yOffset) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const halfW = width * 0.5;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u).normalize();
      const side = new THREE.Vector3().crossVectors(up, tan).normalize();

      const left = pt.clone().addScaledVector(side, halfW);
      const right = pt.clone().addScaledVector(side, -halfW);

      positions.push(left.x, yOffset, left.z);
      positions.push(right.x, yOffset, right.z);
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, u * 20, 1, u * 20);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  _createGate(color, glowColor, isExit = false) {
    const g = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
    for (const x of [-1.05, 1.05]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.2, 10), pillarMat);
      p.position.set(x, 1.1, 0);
      p.castShadow = true;
      g.add(p);
    }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 0.4), pillarMat);
    arch.position.set(0, 2.25, 0);
    g.add(arch);

    const portal = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.88, 20),
      new THREE.MeshBasicMaterial({ color: glowColor, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    portal.position.set(0, 1.18, 0);
    g.add(portal);

    if (isExit) {
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
      );
      crown.position.set(0, 2.75, 0);
      g.add(crown);
    }
    return g;
  }

  _createThemeProp(theme, seed) {
    const g = new THREE.Group();
    if (theme === 'volcano') {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.75 + (seed % 3) * 0.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.85 })
      );
      rock.position.y = 0.45;
      rock.castShadow = true;
      g.add(rock);

      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.95, 5),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.8 })
      );
      crystal.position.set(0.2, 0.75, 0.1);
      crystal.rotation.z = 0.25;
      g.add(crystal);
      return g;
    }

    // Mix deciduous puff oak trees and layered pine trees!
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.25, 0.95, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    trunk.position.y = 0.47;
    trunk.castShadow = true;
    g.add(trunk);

    if (seed % 3 === 0 && theme === 'meadow') {
      // Fluffy round oak tree + small rock
      const oakMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.78 });
      const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 1), oakMat);
      crown1.position.set(0, 1.38, 0);
      crown1.castShadow = true;
      g.add(crown1);
      const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.56, 1), oakMat);
      crown2.position.set(0.42, 1.18, 0.25);
      crown2.castShadow = true;
      g.add(crown2);
    } else {
      const leafColor = theme === 'glacier' ? 0x38bdf8 : (seed % 2 === 0 ? 0x22c55e : 0x16a34a);
      const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.75 });
      for (let l = 0; l < 3; l++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85 - l * 0.18, 0.95, 7), leafMat);
        cone.position.y = 1.05 + l * 0.55;
        cone.castShadow = true;
        g.add(cone);
      }
    }
    return g;
  }

  _minDistToSamples(x, z, samples) {
    let minD = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const dx = samples[i].x - x;
      const dz = samples[i].z - z;
      const d = Math.hypot(dx, dz);
      if (d < minD) minD = d;
    }
    return minD;
  }
}
