import * as THREE from "three";
import { CAMERA } from "../core/config.js";
import { clamp } from "../utils/math.js";

// ============================================================
//  CameraRig — third-person cinematic follow camera.
//
//  Holds yaw/pitch/distance state, accepts mouse drag / wheel
//  from the Input system, and smoothly trails a follow-target
//  each frame. A subtle handheld jitter sells the cinematic feel.
//
//  Auto-align: when the player is moving, the camera yaw smoothly
//  recentres BEHIND the player so the world ahead is always on
//  screen. Mouse input still works while moving, but the rig
//  pulls itself back to the player's facing direction. While the
//  player is idle, the camera is fully free.
// ============================================================

function shortestAngleDelta(target, current) {
  let d = (target - current) % (Math.PI * 2);
  if (d >  Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class CameraRig {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.yaw = CAMERA.initial.yaw;
    this.pitch = CAMERA.initial.pitch;
    this.distance = CAMERA.initial.distance;

    this._followTarget = new THREE.Vector3();
    this._cameraTarget = new THREE.Vector3();
    this._cameraCurrent = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._lookCurrent = new THREE.Vector3();

    this._t = 0;

    /** Kısa sinematik ekrana kayma (CRT açılışı vb.) */
    this._povBlend = 0;
    this._povCam = new THREE.Vector3();
    this._povLook = new THREE.Vector3();
    this._blendLook = new THREE.Vector3();
  }

  /** 0 ≤ blend ≤ ~1 — ekranın önünden ikinci görüş ile karıştırılır */
  setPovAssist(blend, worldCamPos = null, lookAtWorld = null) {
    this._povBlend = Math.max(0, blend ?? 0);
    if (worldCamPos) this._povCam.copy(worldCamPos);
    if (lookAtWorld) this._povLook.copy(lookAtWorld);
  }

  /** What the camera follows — typically the player root position. */
  setFollowTarget(vec3) {
    this._followTarget.copy(vec3);
  }

  /**
   * Update the camera each frame.
   *
   * @param {number} dt              Delta time (seconds).
   * @param {THREE.Vector3} targetPosition  Where the camera follows.
   * @param {object} [opts]
   * @param {number}  [opts.facingYaw]   Player's facing yaw — direction
   *                                     the camera will gradually settle
   *                                     behind, gated by `forwardIntent`.
   * @param {number}  [opts.forwardIntent] Player's movement alignment
   *                                     with the camera-forward axis, in
   *                                     [-1, 1]. Auto-align only fires
   *                                     when this is positive — i.e. the
   *                                     player is actually moving INTO the
   *                                     scene. Strafe (≈0) and reverse
   *                                     (<0) leave the camera untouched,
   *                                     which avoids the whip-around that
   *                                     happens when the player rotates
   *                                     90° on an A/D keypress.
   */
  update(dt, targetPosition, opts = {}) {
    this._t += dt;
    this._consumeInput();
    this._followTarget.copy(targetPosition);

    // ---- Auto-align behind the player while moving INTO the scene ----
    // Scale the lerp rate by max(0, forwardIntent): full speed when the
    // player walks forward, zero on strafe/reverse. This keeps mouse
    // control authoritative during sideways/back movement.
    const fIntent = Math.max(0, opts.forwardIntent ?? 0);
    if (fIntent > 0.05 && opts.facingYaw !== undefined && this._povBlend < 0.02) {
      const delta = shortestAngleDelta(opts.facingYaw, this.yaw);
      this.yaw += delta * Math.min(1, dt * CAMERA.autoAlignRate * fIntent);
    }

    const camHeight = Math.sin(this.pitch) * this.distance;
    const camDist = Math.cos(this.pitch) * this.distance;

    this._cameraTarget.set(
      this._followTarget.x - Math.sin(this.yaw) * camDist,
      this._followTarget.y + 2.4 + camHeight,
      this._followTarget.z - Math.cos(this.yaw) * camDist
    );

    // Floor guard — never let the camera dip below the desk plane.
    // The world's ground is y=0; we keep a small margin so the
    // viewport never clips through wood grain or props lying flat.
    const MIN_CAM_Y = 1.2;
    if (this._cameraTarget.y < MIN_CAM_Y) this._cameraTarget.y = MIN_CAM_Y;

    this._cameraCurrent.lerp(this._cameraTarget, Math.min(1, dt * CAMERA.followLerp));

    // Handheld jitter for cinematic feel
    this._cameraCurrent.x += Math.sin(this._t * 0.9) * CAMERA.handheldJitter.x;
    this._cameraCurrent.y += Math.cos(this._t * 0.7) * CAMERA.handheldJitter.y;

    this.camera.position.copy(this._cameraCurrent);

    this._lookTarget.set(
      this._followTarget.x,
      this._followTarget.y + 1.6,
      this._followTarget.z
    );
    this._lookCurrent.lerp(this._lookTarget, Math.min(1, dt * CAMERA.lookLerp));

    let lookPoint = this._lookCurrent;

    const bRaw = THREE.MathUtils.clamp(this._povBlend, 0, 1);
    if (bRaw > 0.002) {
      const tSmooth = bRaw * bRaw * (3 - 2 * bRaw);
      // Yüksek blend (şarj finali vb.) — kuşbakışı takip kamerasını tamamen bırak
      const tPos = bRaw > 0.9 ? 1 : tSmooth * 0.96;
      const tLook = bRaw > 0.9 ? 1 : Math.min(1, tSmooth * 1.06);
      this.camera.position.lerp(this._povCam, tPos);
      this._blendLook.lerpVectors(this._lookCurrent, this._povLook, tLook);
      lookPoint = this._blendLook;
    }

    this.camera.lookAt(lookPoint);
  }

  _consumeInput() {
    const m = this.input.consumeMouseDelta();
    // Pointer-lock movement events fire much more frequently than
    // drag events, so we apply a higher sensitivity multiplier to
    // keep both modes feeling roughly equivalent in turn rate.
    const mult = this.input.isPointerLocked?.()
      ? CAMERA.pointerLockMultiplier
      : 1.0;
    this.yaw   -= m.x * CAMERA.mouseSensitivity.yaw   * mult;
    this.pitch = clamp(
      this.pitch - m.y * CAMERA.mouseSensitivity.pitch * mult,
      CAMERA.pitchRange[0],
      CAMERA.pitchRange[1]
    );
    const wheel = this.input.consumeWheelDelta();
    if (wheel) {
      this.distance = clamp(
        this.distance + wheel * CAMERA.zoomStep,
        CAMERA.distanceRange[0],
        CAMERA.distanceRange[1]
      );
    }
  }
}
