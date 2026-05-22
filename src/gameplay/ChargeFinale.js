import * as THREE from "three";
import { createChargeStation } from "../world/props/chargeStation.js";
import { createChargeIndicator } from "../world/props/chargeIndicator.js";
import {
  NOTEBOOK_PLACE,
  NOTEBOOK_TOP_Y,
  notebookLocalToWorld,
} from "../world/Level1.js";
import { NARRATION, RENDER } from "../core/config.js";

/** Defter yerel: sol kenar = negatif lx */
const DOCK_LOCAL = Object.freeze({ lx: -8.2, lz: 0.2 });
/** Şarjda yan yana — aynı hizada, ünitenin önünde */
const RUSTY_LOCAL = Object.freeze({ lx: -5.4, lz: 0.55 });
const BOLT_LOCAL = Object.freeze({ lx: -5.4, lz: -0.55 });

function worldOnNotebook(lx, lz) {
  const [x, , z] = notebookLocalToWorld(lx, NOTEBOOK_TOP_Y, lz);
  return new THREE.Vector3(x, NOTEBOOK_TOP_Y + 0.02, z);
}

const STATION_WORLD = worldOnNotebook(DOCK_LOCAL.lx, DOCK_LOCAL.lz);
const RUSTY_SLOT = worldOnNotebook(RUSTY_LOCAL.lx, RUSTY_LOCAL.lz);
const BOLT_SLOT = worldOnNotebook(BOLT_LOCAL.lx, BOLT_LOCAL.lz);
const SCENE_CENTER = new THREE.Vector3().addVectors(RUSTY_SLOT, STATION_WORLD).multiplyScalar(0.5);
SCENE_CENTER.y = NOTEBOOK_TOP_Y + 1.2;

const CAM_WIDE = new THREE.Vector3(2.5, 10.5, -36.5);
const LOOK_WIDE = SCENE_CENTER.clone();
/** Şarj kadrajı — robot yüzleri kameraya dönük okunur */
const CAM_CHARGE = new THREE.Vector3(-4.2, 8.6, -34.2);
const LOOK_CHARGE = new THREE.Vector3().addVectors(RUSTY_SLOT, BOLT_SLOT).multiplyScalar(0.5);
LOOK_CHARGE.y += 1.55;

const FINALE_FOV = 52;

const TIMING = {
  reveal: 4.5,
  walk: 5.5,
  charge: 12.0,
  cableDelay: 1.2,
  done: 7.0,
};

const Phase = {
  REVEAL: 0,
  WALK: 1,
  CHARGE: 2,
  DONE: 3,
};

export const CHARGE_LAYOUT = {
  station: STATION_WORLD.toArray(),
  rusty: RUSTY_SLOT.toArray(),
  bolt: BOLT_SLOT.toArray(),
  notebookMeet: notebookLocalToWorld(0, NOTEBOOK_TOP_Y, 0),
};

/**
 * Bölüm 1 sonu: solda şarj ünitesi belirir → robotlar yürür → şarj.
 */
export class ChargeFinale {
  constructor({ scene, player, friend, subtitles, audio, emotion, camera, beacon }) {
    this.scene = scene;
    this.player = player;
    this.friend = friend;
    this.subtitles = subtitles;
    this.audio = audio;
    this.emotion = emotion;
    this.camera = camera;
    this.beacon = beacon;

    this.active = false;
    this.phase = Phase.DONE;
    this._t = 0;
    this._phaseT = 0;
    this._onComplete = null;
    this._savedFov = RENDER.fov;
    this._floorY = NOTEBOOK_TOP_Y + 0.02;

    this.station = createChargeStation();
    this.station.group.visible = false;
    this.scene.add(this.station.group);

    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._walkFromRusty = new THREE.Vector3();
    this._walkFromBolt = new THREE.Vector3();
    this._lineShownAt = 0;
    this._lastSubtitleMs = 0;
    this._lastPulse = -1;

    this._chargeCables = [];
    this._buildChargeCables();

    this._indicators = [createChargeIndicator(), createChargeIndicator()];
    for (const ind of this._indicators) {
      ind.group.visible = false;
      this.scene.add(ind.group);
    }
    this._indicatorOffset = new THREE.Vector3(0, 2.65, 0);
    this._tmpWorld = new THREE.Vector3();
  }

  _say(text) {
    this._lineShownAt = performance.now();
    const perChar = NARRATION.perCharMs;
    const hold = Math.max(NARRATION.holdShort, text.length * 32);
    this._lastSubtitleMs = text.length * perChar + hold;
    this.subtitles?.speak?.(text, {
      perCharMs: perChar,
      holdMs: hold,
      onChar: () => this.audio?.robotBlip?.(0.85 + Math.random() * 0.2),
    });
  }

  _subtitleReady(extraMs = 0) {
    return (
      performance.now() - this._lineShownAt
      >= (this._lastSubtitleMs ?? 0) + extraMs
    );
  }

  getFollowTarget() {
    return SCENE_CENTER;
  }

  onComplete(cb) {
    this._onComplete = cb;
    return this;
  }

  _buildChargeCables() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a3438,
      emissive: 0x44cc88,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    });
    for (let i = 0; i < 2; i++) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1, 5),
        mat.clone(),
      );
      cable.visible = false;
      this.scene.add(cable);
      this._chargeCables.push(cable);
    }
  }

  _updateChargeCables() {
    const plugWorld = this.station.plugWorldPosition();
    const up = new THREE.Vector3(0, 1, 0);
    const roots = [this.player.root, this.friend?.root].filter(Boolean);

    roots.forEach((root, i) => {
      const cable = this._chargeCables[i];
      if (!cable) return;
      const from = new THREE.Vector3(
        root.position.x + 0.12,
        root.position.y + 1.35,
        root.position.z + 0.2,
      );
      const dir = plugWorld.clone().sub(from);
      const len = dir.length();
      if (len < 0.15 || len > 8) {
        cable.visible = false;
        return;
      }
      dir.normalize();
      cable.visible = true;
      cable.position.copy(from).addScaledVector(dir, len * 0.5);
      cable.scale.set(1, len, 1);
      cable.quaternion.setFromUnitVectors(up, dir);
      cable.material.emissiveIntensity =
        0.35 + Math.sin(this._t * 4 + i) * 0.2;
    });
  }

  _hideChargeCables() {
    for (const c of this._chargeCables) c.visible = false;
  }

  _setFinaleFov(on) {
    if (!this.camera) return;
    if (on) {
      this._savedFov = this.camera.fov;
      this.camera.fov = FINALE_FOV;
    } else {
      this.camera.fov = this._savedFov;
    }
    this.camera.updateProjectionMatrix();
  }

  applyCamera() {
    if (!this.camera) return;
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  start() {
    if (this.active) {
      this._finish(true);
    }
    this.active = true;
    this.phase = Phase.REVEAL;
    this._t = 0;
    this._phaseT = 0;

    if (this.friend) this.friend.state = "arrived";

    this._walkFromRusty.copy(this.player.root.position);
    this._walkFromBolt.copy(
      this.friend ? this.friend.root.position : BOLT_SLOT,
    );
    this._walkFromRusty.y = this._floorY;
    this._walkFromBolt.y = this._floorY;

    this.station.group.position.copy(STATION_WORLD);
    this.station.group.rotation.y = NOTEBOOK_PLACE.rotationY + Math.PI * 0.5;
    this.station.group.scale.setScalar(0.01);
    this.station.group.visible = true;
    this.station.setChargeGlow(0);
    this.station.setPlugVisible(false);
    this._hideChargeCables();
    this._setIndicatorsVisible(false);

    this._camPos.copy(CAM_WIDE);
    this._camLook.copy(LOOK_WIDE);
    this._setFinaleFov(true);
    this.applyCamera();

    this._say(
      "Defterlerin solunda kablolu bir şarj ünitesi beliriyor. Eve dönmeden önce şarj şart.",
    );
    this.audio?.hopeSwell?.();
    this.emotion?.trigger?.("hope", 0.7);
  }

  update(dt, elapsedT) {
    if (!this.active) return;

    this._t += dt;
    this._phaseT += dt;
    this.station.animate(elapsedT);

    if (this.phase === Phase.REVEAL) {
      const p = Math.min(1, this._phaseT / 1.6);
      this.station.group.scale.setScalar(
        THREE.MathUtils.smoothstep(p, 0, 1),
      );
      this._camPos.copy(CAM_WIDE);
      this._camLook.copy(LOOK_WIDE);

      if (this._phaseT >= TIMING.reveal && this._subtitleReady(500)) {
        this.phase = Phase.WALK;
        this._phaseT = 0;
        this._walkFromRusty.copy(this.player.root.position);
        this._walkFromBolt.copy(
          this.friend ? this.friend.root.position : BOLT_SLOT,
        );
        this._walkFromRusty.y = this._floorY;
        this._walkFromBolt.y = this._floorY;
        this._say(
          "Rusty ve Bolt üniteye doğru yürüyor. Küçük adımlar, büyük bir gece.",
        );
      }
      return;
    }

    if (this.phase === Phase.WALK) {
      const t = Math.min(1, this._phaseT / TIMING.walk);
      const ease = THREE.MathUtils.smoothstep(t, 0, 1);

      this._lerpPos(this.player.root, this._walkFromRusty, RUSTY_SLOT, ease);
      if (this.friend) {
        this._lerpPos(this.friend.root, this._walkFromBolt, BOLT_SLOT, ease);
      }

      const moving = t < 0.98;
      this.player.robot.update(dt, {
        moving,
        speed: moving ? 1.4 : 0,
        jumping: false,
        emotion: null,
      });
      if (this.friend) {
        this.friend.robot.update(dt, {
          moving,
          speed: moving ? 1.4 : 0,
          jumping: false,
          emotion: null,
        });
      }
      this._faceToward(this.player.root, STATION_WORLD, dt);
      if (this.friend) this._faceToward(this.friend.root, STATION_WORLD, dt);

      const camT = THREE.MathUtils.smoothstep(Math.min(1, t * 1.2), 0, 1);
      this._camPos.lerpVectors(CAM_WIDE, CAM_CHARGE, camT * 0.35);
      this._camLook.lerpVectors(LOOK_WIDE, LOOK_CHARGE, camT * 0.4);

      if (t > 0.72) this._fadeBeacon(dt * 1.8);

      if (t >= 1 && this._phaseT >= TIMING.walk && this._subtitleReady(600)) {
        this.player.root.position.copy(RUSTY_SLOT);
        if (this.friend) this.friend.root.position.copy(BOLT_SLOT);
        this.phase = Phase.CHARGE;
        this._phaseT = 0;
        this.station.setPlugVisible(true);
        this._setIndicatorsVisible(true);
        this._fadeBeacon(0);
        this._snapFaceCamera();
        this._say(
          "Fişler prize oturuyor. Gözler yavaşça parlıyor. Masa nefes alıyor.",
        );
        this.audio?.crtCableSnap?.();
      }
      return;
    }

    if (this.phase === Phase.CHARGE) {
      const p = Math.min(1, this._phaseT / TIMING.charge);
      this.station.setChargeGlow(p);
      this._fadeBeacon(dt);

      if (this._phaseT >= TIMING.cableDelay) {
        this._updateChargeCables();
      }

      const camBlend = THREE.MathUtils.smoothstep(
        Math.min(1, this._phaseT / 2.8),
        0,
        1,
      );
      this._camPos.lerpVectors(CAM_WIDE, CAM_CHARGE, 0.35 + camBlend * 0.35);
      this._camLook.lerpVectors(LOOK_WIDE, LOOK_CHARGE, 0.45 + camBlend * 0.35);

      this.emotion?.update?.(dt, { moving: false });
      const emo = this.emotion?.derived ?? null;
      this.player.robot.update(dt, {
        moving: false,
        speed: 0,
        jumping: false,
        emotion: emo,
      });
      if (this.friend) {
        this.friend.robot.update(dt, {
          moving: false,
          speed: 0,
          jumping: false,
          emotion: emo,
        });
      }
      const faceSpeed = 5.5 + camBlend * 4;
      this._faceToward(this.player.root, this._camPos, dt * faceSpeed);
      if (this.friend) this._faceToward(this.friend.root, this._camPos, dt * faceSpeed);

      this._updateIndicators(p, elapsedT);

      if (p > 0.25 && Math.floor(this._phaseT * 2) !== this._lastPulse) {
        this._lastPulse = Math.floor(this._phaseT * 2);
        this.audio?.robotBlip?.(1.0 + p * 0.25);
      }

      if (p >= 1 && this._subtitleReady(1000)) {
        this.phase = Phase.DONE;
        this._phaseT = 0;
        this._hideChargeCables();
        this._setIndicatorsVisible(false);
        this._say(
          "Şarj tamam. Bölüm bir kapanıyor — ama yol henüz bitmedi.",
        );
        this.emotion?.trigger?.("memory", 0.6);
      }
      return;
    }

    if (this.phase === Phase.DONE) {
      if (this._phaseT >= TIMING.done && this._subtitleReady(400)) {
        this._finish();
      }
    }
  }

  _finish(silent = false) {
    if (!this.active) return;
    this.active = false;
    this.station.group.visible = false;
    this._hideChargeCables();
    this._setIndicatorsVisible(false);
    this._fadeBeacon(0);
    this._setFinaleFov(false);
    if (!silent) this._onComplete?.();
  }

  _lerpPos(root, from, to, t) {
    root.position.lerpVectors(from, to, t);
    root.position.y = this._floorY;
  }

  _faceToward(root, target, dt) {
    const tmp = new THREE.Vector3().subVectors(target, root.position);
    tmp.y = 0;
    if (tmp.lengthSq() < 0.01) return;
    const yaw = Math.atan2(tmp.x, tmp.z);
    let diff = yaw - root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    root.rotation.y += diff * Math.min(1, dt);
  }

  _snapFaceCamera() {
    const roots = [this.player?.root, this.friend?.root].filter(Boolean);
    for (const root of roots) {
      const tmp = new THREE.Vector3().subVectors(this._camPos, root.position);
      tmp.y = 0;
      if (tmp.lengthSq() > 0.01) {
        root.rotation.y = Math.atan2(tmp.x, tmp.z);
      }
    }
  }

  _fadeBeacon(dt = 0) {
    const b = this.beacon;
    if (!b) return;
    b.armed = false;
    if (dt <= 0) {
      b._glow = 0;
      if (b.orb?.visible) b.orb.visible = false;
      if (b.halo?.visible) b.halo.visible = false;
      return;
    }
    b._glow = Math.max(0, (b._glow ?? 0) - dt * 3.2);
    if (b._glow < 0.02) {
      if (b.orb?.visible) b.orb.visible = false;
      if (b.halo?.visible) b.halo.visible = false;
    }
  }

  _setIndicatorsVisible(on) {
    for (const ind of this._indicators) {
      ind.group.visible = on;
      if (!on) ind.setGlow(0);
    }
  }

  _updateIndicators(chargeP, elapsedT) {
    const roots = [this.player?.root, this.friend?.root].filter(Boolean);
    const fadeIn = THREE.MathUtils.smoothstep(
      Math.min(1, this._phaseT / 1.2),
      0,
      1,
    );
    const glow = chargeP * fadeIn;

    roots.forEach((root, i) => {
      const ind = this._indicators[i];
      if (!ind) return;
      this._tmpWorld.copy(root.position).add(this._indicatorOffset);
      ind.group.position.copy(this._tmpWorld);
      ind.setGlow(glow);
      ind.animate(elapsedT);
      ind.faceCamera(this.camera);
    });
  }
}
