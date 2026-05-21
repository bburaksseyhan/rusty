import * as THREE from "three";
import { createWoodTextures } from "../assets/textures.js";

// ============================================================
//  Robot — Rusty's *visual* rig.
//
//  Responsibility: procedural geometry + animation.
//  Accepts an optional `emotion` object (from EmotionSystem.derived)
//  every frame and layers emotional poses on top of locomotion.
//
//  Eye Expression Channels:
//    - eye material emissive color  (driven by emotion.eyeColor)
//    - eye material emissiveIntensity (emotion.eyeIntensity + pulse)
//    - pupil mesh scale              (emotion.eyeScale)
//    - eye point light color/intensity
//
//  Emotional Pose Channels (additive on top of walk cycle):
//    - head Z-tilt (curiosity)
//    - body X-tremor (fear)
//    - arm pivot Z droop (loneliness)
//    - body Y float offset (hope)
// ============================================================

// ============================================================
//  Palette presets — define every per-robot color/material tint
//  so the same rig can render different characters (Rusty, Bolt…).
//
//  Add a new palette here and `new Robot({ palette: "name" })`
//  produces a visually distinct robot with no other changes.
// ============================================================
const PALETTES = {
  rusty: {
    name:        "Rusty",
    wood:        { hue: 30, sat: 60, light: 42 },
    woodDark:    { hue: 22, sat: 50, light: 28 },
    stripeDark:  0x2a4d6a,
    stripeLight: 0xd9c79a,
    eyeEmissive: [1.00, 0.68, 0.34],
    eyeColor:    0xfff5d0,
    antenna:     0x33ff88,
    antennaEmissive: [0.20, 1.00, 0.53],
    pointLight:  0x4cff88,
    eyePointLight: 0xffaa55,
    scale: 1.0,
  },
  bolt: {
    // Bolt — Kai's second robot, smaller, cooler palette, blue accents.
    // Built later, never finished, tucked behind the monitor until now.
    name:        "Bolt",
    wood:        { hue: 200, sat: 25, light: 50 },
    woodDark:    { hue: 210, sat: 30, light: 32 },
    stripeDark:  0x1f3a55,
    stripeLight: 0xb8d4e8,
    eyeEmissive: [0.45, 0.85, 1.00],
    eyeColor:    0xd6efff,
    antenna:     0x55ddff,
    antennaEmissive: [0.30, 0.85, 1.00],
    pointLight:  0x66ccff,
    eyePointLight: 0x88bbff,
    scale: 0.85, // visibly smaller — younger sibling
  },
};

/**
 * Angular rate of the leg cycle (rad/s) as a function of horizontal
 * speed. Exported so the Player class can compute identical step
 * timing for footstep audio. Foot strikes occur every π radians of
 * phase, i.e. step rate = legCycleRate(speed) / π.
 */
export function legCycleRate(speed) {
  return 6.5 + Math.min(speed, 22) * 0.42;
}

export class Robot {
  /**
   * @param {object} [opts]
   * @param {"rusty"|"bolt"} [opts.palette]  visual preset (default: "rusty")
   */
  constructor({ palette = "rusty" } = {}) {
    this._palette = PALETTES[palette] ?? PALETTES.rusty;

    this.root = new THREE.Group();
    this.root.name = this._palette.name;
    this.root.scale.setScalar(this._palette.scale);

    this._body = new THREE.Group();
    this._body.name = `${this._palette.name}Body`;
    this.root.add(this._body);

    this._materials = this._buildMaterials();
    this._head = this._buildHead();
    const { arms } = this._buildTorso();
    this._arms = arms;
    this._legs = this._buildLegs();

    this._body.position.y = 1.44;
    this._t = 0;

    // ---- Speed-driven leg phase ----
    // Replaces the previous constant `t * 8.0` cycle. The phase
    // integrates per frame at a rate that scales with horizontal
    // speed so legs cycle faster while sprinting. `Player` reads
    // this same value to time footstep audio against actual foot
    // strikes (every π radians), keeping animation + SFX in lock-step.
    this._legPhase = 0;

    // ---- Smooth emotion targets (to avoid snapping) ----
    this._eTiltZ   = 0;
    this._eTremor  = 0;
    this._eArmDrp  = 0;
    this._eHopeBob = 0;

    // ---- Wave animation state ----
    this._waving       = false;
    this._waveTimer    = 0;
    this._waveDuration = 2.8; // seconds
  }

  // Public helpers --------------------------------------------
  get body()  { return this._body; }
  get head()  { return this._head.group; }

  /**
   * Trigger a friendly wave gesture.
   * The right arm sweeps up and oscillates for ~2.8 seconds, then
   * returns to idle/walk. Safe to call while walking — the wave
   * is layered on top of locomotion and terminates gracefully.
   */
  wave() {
    this._waving    = true;
    this._waveTimer = 0;
  }

  /**
   * @param {object} state
   * @param {boolean} state.moving
   * @param {number}  state.speed
   * @param {boolean} state.jumping
   * @param {object}  [state.emotion]  EmotionSystem.derived (optional)
   */
  update(dt, { moving, speed, jumping, emotion }) {
    this._t += dt;
    const t = this._t;

    // ---- 1. Locomotion base layer ----
    const idleBob = Math.sin(t * 2.1) * 0.025;
    this._body.position.y = 1.44 + idleBob;

    const swingAmt = Math.min(1.0, speed / 4) * (moving ? 1 : 0);
    // Advance leg phase only when actually moving — freezes mid-stride
    // when player stops, instead of strolling in place.
    if (moving) {
      this._legPhase += legCycleRate(speed) * dt;
    }
    const phase = this._legPhase;
    this._arms[0].rotation.x =  Math.sin(phase) * 0.7 * swingAmt;
    this._arms[1].rotation.x = -Math.sin(phase) * 0.7 * swingAmt;
    this._legs[0].rotation.x = -Math.sin(phase) * 0.5 * swingAmt;
    this._legs[1].rotation.x =  Math.sin(phase) * 0.5 * swingAmt;

    // Base head sway from walk
    const baseHeadZ = Math.sin(phase * 0.5) * 0.04 * swingAmt;

    // ---- 2. Emotional animation layer (additive) ----
    if (emotion) {
      this._updateEmotionalLayer(dt, t, emotion, baseHeadZ, swingAmt);
    } else {
      this._head.group.rotation.z = baseHeadZ;
      this._applyDefaultEyePulse(t);
    }

    // ---- 3. Wave gesture (overrides right arm after all other layers) ----
    if (this._waving) {
      this._updateWave(dt, t);
    }
  }

  // ---- Private: emotional layer --------------------------------

  _updateEmotionalLayer(dt, t, em, baseHeadZ, swingAmt) {
    const { eyeColor, eyeIntensity, eyeScale,
            bodyTremble, headTilt, armDroop, hopeBob, mood } = em;

    // -- Eye material color & intensity --
    const eyeMat = this._materials.eye;
    eyeMat.emissive.copy(eyeColor);
    eyeMat.emissiveIntensity = eyeIntensity;

    // -- Eye point light --
    this._head.eyeLight.color.copy(eyeColor);
    this._head.eyeLight.intensity = eyeIntensity * 0.35 + 0.1;

    // -- Antenna LED reflects mood too --
    this._head.led.material.emissive.copy(eyeColor);
    const ledPulse = 1.2 + Math.sin(t * 3.4) * 0.7;
    this._head.led.material.emissiveIntensity = ledPulse;
    this._head.light.color.copy(eyeColor);
    this._head.light.intensity = 0.9 + ledPulse * 0.4;

    // -- Pupil scale (curiosity = wide, fear = narrow) --
    const targetPupilScale = eyeScale;
    this._head.pupils.forEach((p) => {
      p.scale.x += (targetPupilScale - p.scale.x) * Math.min(1, dt * 4);
      p.scale.y  = p.scale.x;
    });

    // -- Head tilt: curiosity tilts head, loneliness bows it --
    const targetTiltZ = baseHeadZ + headTilt * Math.sin(t * 0.7);
    this._eTiltZ += (targetTiltZ - this._eTiltZ) * Math.min(1, dt * 4);
    this._head.group.rotation.z = this._eTiltZ;

    // -- Head nod (loneliness lowers the head forward) --
    const lonelyNod = em.armDroop * 0.18;
    this._head.group.rotation.x = -lonelyNod;

    // -- Body tremor (fear) --
    const tremorTarget = bodyTremble > 0.001
      ? Math.sin(t * 22) * bodyTremble
      : 0;
    this._eTremor += (tremorTarget - this._eTremor) * Math.min(1, dt * 12);
    this._body.position.x = this._eTremor;

    // -- Hope bob (additive upward float) --
    const hopeBobVal = hopeBob * Math.sin(t * 2.8);
    this._eHopeBob += (hopeBobVal - this._eHopeBob) * Math.min(1, dt * 3);
    this._body.position.y += this._eHopeBob;

    // -- Arm droop (loneliness) --
    const droopTarget = -armDroop;
    this._eArmDrp += (droopTarget - this._eArmDrp) * Math.min(1, dt * 2.5);
    this._arms[0].rotation.z =  this._eArmDrp * 0.5 + (mood === "fearful" ? 0.25 : 0);
    this._arms[1].rotation.z = -this._eArmDrp * 0.5 - (mood === "fearful" ? 0.25 : 0);

    // -- Mood-specific micro-gestures --
    switch (mood) {
      case "curious":
        // Occasional "look around" — head yaws side to side slowly
        this._head.group.rotation.y = Math.sin(t * 0.55) * 0.22;
        break;
      case "fearful":
        // Crouch: lower body slightly, legs bend
        this._body.position.y -= 0.08;
        this._legs[0].rotation.x += -0.12;
        this._legs[1].rotation.x += -0.12;
        break;
      case "hopeful":
        // Chest out: tiny backward lean
        this._body.rotation.x = -0.04;
        break;
      case "lonely":
        // Slumped: forward lean
        this._body.rotation.x = 0.06;
        break;
      default:
        this._head.group.rotation.y = 0;
        this._body.rotation.x       = 0;
        break;
    }
  }

  /**
   * Wave gesture — called every frame while _waving is true.
   * Completely overrides right arm rotations.
   *
   * Timeline (0 → 1 over _waveDuration seconds):
   *   0.0 – 0.15  arm sweeps up (sinusoidal ease-in)
   *   0.15 – 0.80 arm at top, oscillates left/right (wave pattern)
   *   0.80 – 1.00 arm settles back down (ease-out)
   *
   * Head and body tilt toward the wave slightly for character.
   */
  _updateWave(dt, t) {
    this._waveTimer += dt;
    const progress = Math.min(1, this._waveTimer / this._waveDuration);

    if (progress >= 1) {
      this._waving = false;
      // Reset right arm so locomotion takes over cleanly
      this._arms[1].rotation.x = 0;
      this._arms[1].rotation.z = 0;
      this._head.group.rotation.y = 0;
      this._body.rotation.z = 0;
      return;
    }

    // Envelope: goes up quickly, holds, comes down slowly
    const upEnv  = Math.sin(progress * Math.PI);        // 0→1→0 bell
    const holdEnv = Math.max(0, Math.sin(progress * Math.PI * 1.1 - 0.1)); // smoothed

    // Wave oscillation: faster in the middle of the hold phase
    const waveOsc = Math.sin(t * 14.0) * holdEnv * 0.55;

    // Right arm: lift up (negative X = arm forward/up in Three.js)
    this._arms[1].rotation.x = -1.55 * upEnv;           // ~90° up at peak
    this._arms[1].rotation.z =  waveOsc;                 // side-to-side wave

    // Head follows the wave direction (friendly nod)
    this._head.group.rotation.y = waveOsc * 0.18;
    this._head.group.rotation.z += Math.sin(t * 5) * 0.008 * upEnv; // tiny excitement shake

    // Gentle body lean into the wave
    this._body.rotation.z = -waveOsc * 0.06;
  }

  _applyDefaultEyePulse(t) {
    const pulse = 1.2 + Math.sin(t * 3.4) * 0.7;
    this._head.led.material.emissiveIntensity = pulse;
    this._head.light.intensity = 0.9 + pulse * 0.4;
  }

  // ---- builders ---------------------------------------------
  _buildMaterials() {
    const P = this._palette;
    const wood     = createWoodTextures(P.wood);
    const woodDark = createWoodTextures(P.woodDark);
    const M = (opts) => new THREE.MeshStandardMaterial(opts);

    return {
      body: M({
        map: wood.map,
        roughnessMap: wood.roughnessMap,
        roughness: 0.85,
        metalness: 0.05,
        color: 0xffffff,
      }),
      face: M({
        map: woodDark.map,
        roughnessMap: woodDark.roughnessMap,
        roughness: 0.95,
        metalness: 0.05,
      }),
      stripeDark:  M({ color: P.stripeDark,  roughness: 0.65, metalness: 0.1  }),
      stripeLight: M({ color: P.stripeLight, roughness: 0.70, metalness: 0.05 }),
      metal:       M({ color: 0xbfc4cc, roughness: 0.35, metalness: 0.92 }),
      metalDark:   M({ color: 0x6a6f78, roughness: 0.50, metalness: 0.90 }),
      ring:        M({ color: 0xe1e6ed, roughness: 0.20, metalness: 1.00 }),
      lens:        M({ color: 0x0b0c10, roughness: 0.15, metalness: 0.90 }),
      // *** eye is a SINGLE shared instance — mutated each frame ***
      eye: M({
        color: P.eyeColor,
        emissive: new THREE.Color(...P.eyeEmissive),
        emissiveIntensity: 2.2,
        roughness: 0.3,
        metalness: 0.1,
      }),
      antenna: M({
        color: P.antenna,
        emissive: new THREE.Color(...P.antennaEmissive),
        emissiveIntensity: 1.6,
        roughness: 0.4,
        metalness: 0.3,
      }),
      usb:   M({ color: 0xe8c873, roughness: 0.3, metalness: 0.95 }),
      mouth: M({ color: 0x0c0c0c, roughness: 0.6 }),
    };
  }

  _buildHead() {
    const M = this._materials;
    const head = new THREE.Group();
    head.position.y = 1.05;
    this._body.add(head);

    const block = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.85), M.body);
    block.castShadow = block.receiveShadow = true;
    head.add(block);

    const face = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.55, 0.04), M.face);
    face.position.set(0, 0.02, 0.43);
    face.receiveShadow = true;
    head.add(face);

    // ---- Eyes — store pupil refs for emotion-driven scale ----
    const pupils = [];
    for (const x of [-0.2, 0.2]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.025, 14, 28),
        M.ring
      );
      ring.position.set(x, 0.06, 0.46);
      ring.castShadow = true;
      head.add(ring);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), M.lens);
      lens.position.set(x, 0.06, 0.45);
      head.add(lens);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), M.eye);
      pupil.position.set(x, 0.06, 0.461);
      head.add(pupil);
      pupils.push(pupil);
    }

    // Eye point light — sits at face centre, tinted by emotion
    const eyeLight = new THREE.PointLight(this._palette.eyePointLight, 0.9, 2.5, 2);
    eyeLight.position.set(0, 0.06, 0.6);
    head.add(eyeLight);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.02), M.mouth);
    mouth.position.set(0, -0.15, 0.45);
    head.add(mouth);

    // Corner screws
    for (const [x, z] of [
      [-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35],
    ]) {
      const screwHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14),
        M.metal
      );
      screwHead.position.set(x, 0.495, z);
      screwHead.castShadow = true;
      head.add(screwHead);

      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.005, 0.02),
        M.metalDark
      );
      slot.position.set(x, 0.516, z);
      slot.rotation.y = Math.random() * Math.PI;
      head.add(slot);
    }

    // Chin camera
    const chinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.015, 10, 20),
      M.ring
    );
    chinRing.position.set(0.32, -0.32, 0.43);
    head.add(chinRing);

    const chinLens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), M.lens);
    chinLens.position.set(0.32, -0.32, 0.435);
    head.add(chinLens);

    // Antenna with LED
    const antennaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12),
      M.metalDark
    );
    antennaBase.position.set(0.2, 0.51, 0);
    head.add(antennaBase);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8),
      M.metal
    );
    antenna.position.set(0.2, 0.78, 0);
    head.add(antenna);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      M.antenna
    );
    led.position.set(0.2, 1.05, 0);
    head.add(led);

    const light = new THREE.PointLight(this._palette.pointLight, 1.4, 4, 2);
    light.position.copy(led.position);
    head.add(light);

    // Keyring
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10),
      M.metal
    );
    stem.position.set(-0.2, 0.6, 0);
    head.add(stem);

    const keyring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 12, 28),
      M.metal
    );
    keyring.position.set(-0.2, 0.85, 0);
    keyring.rotation.x = Math.PI / 2;
    keyring.castShadow = true;
    head.add(keyring);

    return { group: head, pupils, led, light, eyeLight };
  }

  _buildTorso() {
    const M = this._materials;
    const torso = new THREE.Group();
    torso.position.y = 0.15;
    this._body.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.65), M.body);
    chest.castShadow = chest.receiveShadow = true;
    torso.add(chest);

    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.085, 0.66),
        i % 2 === 0 ? M.stripeDark : M.stripeLight
      );
      stripe.position.y = -0.2 + i * 0.1;
      stripe.castShadow = stripe.receiveShadow = true;
      torso.add(stripe);
    }

    const usb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), M.usb);
    usb.position.set(0, 0.05, -0.43);
    usb.castShadow = true;
    torso.add(usb);

    const usbShell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.1), M.metal);
    usbShell.position.set(0, 0.05, -0.7);
    torso.add(usbShell);

    for (const x of [-0.45, 0.45]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.18, 14),
        M.metal
      );
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(x, 0.25, 0);
      bolt.castShadow = true;
      torso.add(bolt);
    }

    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.55, 0.32, 0);
      torso.add(pivot);

      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12),
        M.metalDark
      );
      upper.position.y = -0.22;
      upper.castShadow = true;
      pivot.add(upper);

      const elbow = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 14, 14),
        M.metal
      );
      elbow.position.y = -0.45;
      pivot.add(elbow);

      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.4, 12),
        M.metalDark
      );
      lower.position.y = -0.65;
      pivot.add(lower);

      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.12),
        M.metal
      );
      hand.position.y = -0.86;
      hand.castShadow = true;
      pivot.add(hand);

      for (const fx of [-0.05, 0.05]) {
        const finger = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.16, 0.04),
          M.metalDark
        );
        finger.position.set(fx, -0.98, 0.05);
        pivot.add(finger);
      }
      arms.push(pivot);
    }

    return { torso, arms };
  }

  _buildLegs() {
    const M = this._materials;
    const legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.25, -0.32, 0);
      this._body.add(pivot);

      const hip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), M.metal);
      pivot.add(hip);

      const legGrp = new THREE.Group();
      legGrp.position.y = -0.55;
      pivot.add(legGrp);

      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 1.05, 18),
        M.metal
      );
      leg.castShadow = true;
      legGrp.add(leg);

      for (let i = 0; i < 9; i++) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.135, 0.012, 8, 22),
          M.metalDark
        );
        rib.rotation.x = Math.PI / 2;
        rib.position.y = -0.45 + i * 0.11;
        legGrp.add(rib);
      }

      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.2, 0.08, 18),
        M.metalDark
      );
      foot.position.y = -1.12;
      foot.castShadow = true;
      pivot.add(foot);

      legs.push(pivot);
    }
    return legs;
  }
}
