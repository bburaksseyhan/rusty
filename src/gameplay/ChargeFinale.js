import * as THREE from "three";
import { createPowerOutlet } from "../world/props/powerOutlet.js";
import { RENDER } from "../core/config.js";

// Sahne: robotlar solda, priz sağda — kamera doğudan (+X) geniş bakar
export const CHARGE_LAYOUT = {
  outlet: [-4.2, 7.12, -43.6],
  rusty: [-8.2, 7.0, -42.4],
  bolt: [-10.8, 7.0, -42.8],
  notebookMeet: [-10, 7.0, -40],
};

const OUTLET_POS = new THREE.Vector3(...CHARGE_LAYOUT.outlet);
const RUSTY_SLOT = new THREE.Vector3(...CHARGE_LAYOUT.rusty);
const BOLT_SLOT = new THREE.Vector3(...CHARGE_LAYOUT.bolt);
const SCENE_CENTER = new THREE.Vector3(-7.2, 7.4, -42.8);

// Geniş masaüstü kadrajı (~11–13 birim mesafe, bakış y=9 priz+robot göğsü)
const CAM_WIDE = new THREE.Vector3(3.2, 13.0, -41.8);
const LOOK_WIDE = new THREE.Vector3(-7.0, 9.0, -43.2);
const CAM_CHARGE = new THREE.Vector3(2.4, 12.2, -41.5);
const LOOK_CHARGE = new THREE.Vector3(-5.8, 9.1, -43.5);

const WALK_SPEED = 2.0;
const FINALE_FOV = 52;

/** Fazlar bu süre dolmadan ilerlemez (F9 ile anında yürüme bitmesin diye) */
const TIMING = {
  revealAnim: 2.4,
  revealMin: 5.5,
  walkMin: 6.0,
  chargeDuration: 12.0,
  afterChargeMin: 6.5,
};

const SUBTITLE_MS = {
  reveal: 9500,
  walk: 9000,
  plug: 10000,
  done: 8000,
};

const Phase = {
  REVEAL: 0,
  WALK: 1,
  CHARGE: 2,
  DONE: 3,
};

/**
 * Bölüm 1 sonu: priz belirir, Rusty ve Bolt şarj olur, ardından jenerik.
 */
export class ChargeFinale {
  constructor({ scene, player, friend, subtitles, audio, emotion, camera }) {
    this.scene = scene;
    this.player = player;
    this.friend = friend;
    this.subtitles = subtitles;
    this.audio = audio;
    this.emotion = emotion;
    this.camera = camera;

    this.active = false;
    this.phase = Phase.DONE;
    this._t = 0;
    this._phaseT = 0;
    this._onComplete = null;
    this._savedFov = RENDER.fov;

    this.outlet = createPowerOutlet();
    this.outlet.group.visible = false;
    this.scene.add(this.outlet.group);

    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._lastPulse = -1;

    this._chargeCables = [];
    this._buildChargeCables();
    this._lineShownAt = 0;
  }

  _say(text, durationMs) {
    this._lineShownAt = performance.now();
    this.subtitles?.show?.(text, durationMs);
  }

  /** Son altyazının süresi + ekstra bekleme doldu mu */
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
      emissive: 0x55ee99,
      emissiveIntensity: 0.5,
      roughness: 0.45,
    });
    for (let i = 0; i < 2; i++) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 1, 6),
        mat.clone(),
      );
      cable.visible = false;
      this.scene.add(cable);
      this._chargeCables.push(cable);
    }
  }

  _updateChargeCables() {
    const plugWorld = new THREE.Vector3(-3.8, 7.55, -42.95);
    const up = new THREE.Vector3(0, 1, 0);
    const roots = [this.player.root, this.friend?.root].filter(Boolean);

    roots.forEach((root, i) => {
      const cable = this._chargeCables[i];
      if (!cable) return;
      cable.visible = true;
      const from = new THREE.Vector3(
        root.position.x + 0.35,
        root.position.y + 2.0,
        root.position.z,
      );
      const dir = plugWorld.clone().sub(from);
      const len = dir.length();
      if (len < 0.01) return;
      dir.normalize();
      cable.position.copy(from).addScaledVector(dir, len * 0.5);
      cable.scale.set(1, len, 1);
      cable.quaternion.setFromUnitVectors(up, dir);
      cable.material.emissiveIntensity =
        0.5 + Math.sin(this._t * 5 + i) * 0.4;
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

  /** Takip kamerasını tamamen bypass — doğrudan sinematik kadraj */
  applyCamera() {
    if (!this.camera) return;
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  start() {
    if (this.active) {
      this.active = false;
      this.phase = Phase.DONE;
      this._hideChargeCables();
      this._setFinaleFov(false);
    }
    this.active = true;
    this.phase = Phase.REVEAL;
    this._t = 0;
    this._phaseT = 0;

    if (this.friend) this.friend.state = "arrived";

    this.outlet.group.position.copy(OUTLET_POS);
    this.outlet.group.rotation.y = Math.PI * 0.48;
    this.outlet.group.scale.setScalar(0.01);
    this.outlet.group.visible = true;
    this.outlet.setChargeGlow(0);
    this.outlet.setPlugVisible(false);
    this._hideChargeCables();

    this._camPos.copy(CAM_WIDE);
    this._camLook.copy(LOOK_WIDE);
    this._setFinaleFov(true);
    this.applyCamera();

    this._lastSubtitleMs = SUBTITLE_MS.reveal;
    this._say(
      "Defterlerin kenarında bir priz yanıp sönüyor. Eve dönmeden önce şarj şart.",
      SUBTITLE_MS.reveal,
    );
    this.audio?.hopeSwell?.();
    this.emotion?.trigger?.("hope", 0.7);
  }

  update(dt, elapsedT) {
    if (!this.active) return;

    this._t += dt;
    this._phaseT += dt;
    this.outlet.animate(elapsedT);

    if (this.phase === Phase.REVEAL) {
      const p = Math.min(1, this._phaseT / TIMING.revealAnim);
      this.outlet.group.scale.setScalar(
        THREE.MathUtils.smoothstep(0, 1, p) * 1.4,
      );
      this._camPos.copy(CAM_WIDE);
      this._camLook.copy(LOOK_WIDE);

      if (
        p >= 1
        && this._phaseT >= TIMING.revealMin
        && this._subtitleReady(400)
      ) {
        this.phase = Phase.WALK;
        this._phaseT = 0;
        this._lastSubtitleMs = SUBTITLE_MS.walk;
        this._say(
          "Rusty ve Bolt prize doğru yürüyor. Küçük adımlar, büyük bir gece.",
          SUBTITLE_MS.walk,
        );
      }
      return;
    }

    if (this.phase === Phase.WALK) {
      this._lerpActor(this.player.root, RUSTY_SLOT, dt, WALK_SPEED);
      if (this.friend) {
        this._lerpActor(this.friend.root, BOLT_SLOT, dt, WALK_SPEED * 0.95);
        this.friend.robot.update(dt, {
          moving: true,
          speed: WALK_SPEED,
          jumping: false,
          emotion: null,
        });
      }
      this.player.robot.update(dt, {
        moving: true,
        speed: WALK_SPEED,
        jumping: false,
        emotion: null,
      });
      this._faceToward(this.player.root, OUTLET_POS, dt);
      if (this.friend) this._faceToward(this.friend.root, OUTLET_POS, dt);

      this._camPos.copy(CAM_WIDE);
      this._camLook.copy(LOOK_WIDE);

      const rustyDone =
        this.player.root.position.distanceTo(RUSTY_SLOT) < 0.35;
      const boltDone =
        !this.friend || this.friend.root.position.distanceTo(BOLT_SLOT) < 0.35;

      if (
        rustyDone
        && boltDone
        && this._phaseT >= TIMING.walkMin
        && this._subtitleReady(500)
      ) {
        this.player.root.position.copy(RUSTY_SLOT);
        if (this.friend) this.friend.root.position.copy(BOLT_SLOT);
        this.phase = Phase.CHARGE;
        this._phaseT = 0;
        this.outlet.setPlugVisible(true);
        this._updateChargeCables();
        this._lastSubtitleMs = SUBTITLE_MS.plug;
        this._say(
          "İki küçük fiş prize oturuyor. Gözler yavaşça parlıyor. Masa nefes alıyor.",
          SUBTITLE_MS.plug,
        );
        this.audio?.crtCableSnap?.();
      }
      return;
    }

    if (this.phase === Phase.CHARGE) {
      const p = Math.min(1, this._phaseT / TIMING.chargeDuration);
      this.outlet.setChargeGlow(p);
      this._updateChargeCables();

      // Hafif yakınlaşma ama asla bacak kadrajına düşme
      const t = THREE.MathUtils.smoothstep(0, 1, Math.min(1, this._phaseT / 3.0));
      this._camPos.lerpVectors(CAM_WIDE, CAM_CHARGE, t * 0.35);
      this._camLook.lerpVectors(LOOK_WIDE, LOOK_CHARGE, t * 0.4);

      this.emotion?.trigger?.("hope", 0.85);
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
      this._faceToward(this.player.root, OUTLET_POS, dt * 0.5);
      if (this.friend) this._faceToward(this.friend.root, OUTLET_POS, dt * 0.5);

      if (p > 0.2 && Math.floor(this._phaseT * 2) !== this._lastPulse) {
        this._lastPulse = Math.floor(this._phaseT * 2);
        this.audio?.robotBlip?.(1.0 + p * 0.3);
      }

      if (p >= 1 && this._subtitleReady(800)) {
        this.phase = Phase.DONE;
        this._phaseT = 0;
        this._hideChargeCables();
        this._lastSubtitleMs = SUBTITLE_MS.done;
        this._say(
          "Şarj tamam. Bölüm bir kapanıyor — ama yol henüz bitmedi.",
          SUBTITLE_MS.done,
        );
        this.emotion?.trigger?.("memory", 0.6);
      }
      return;
    }

    if (this.phase === Phase.DONE) {
      if (this._phaseT >= TIMING.afterChargeMin && this._subtitleReady(0)) {
        this._finish();
      }
    }
  }

  _finish() {
    if (!this.active) return;
    this.active = false;
    this._hideChargeCables();
    this._setFinaleFov(false);
    this._onComplete?.();
  }

  _lerpActor(root, target, dt, speed) {
    const tmp = new THREE.Vector3().subVectors(target, root.position);
    const dist = tmp.length();
    if (dist < 0.05) {
      root.position.copy(target);
      return;
    }
    tmp.normalize().multiplyScalar(Math.min(dist, speed * dt));
    root.position.add(tmp);
    root.position.y = THREE.MathUtils.lerp(root.position.y, target.y, dt * 4);
  }

  _faceToward(root, target, dt) {
    const tmp = new THREE.Vector3().subVectors(target, root.position);
    const yaw = Math.atan2(tmp.x, tmp.z);
    let diff = yaw - root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    root.rotation.y += diff * Math.min(1, dt * 5);
  }
}
