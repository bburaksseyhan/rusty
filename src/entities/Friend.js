import * as THREE from "three";
import { Robot } from "./Robot.js";

// ============================================================
//  Friend — Bolt, Rusty's smaller companion robot.
//
//  Built by Kai right after Rusty, but never finished — tucked
//  behind the monitor for 1,047 days. Powers on when Rusty
//  completes the desk journey and arrives to deliver the
//  next-chapter briefing.
//
//  Responsibilities:
//    - Wraps a Robot instance with a "bolt" palette.
//    - Owns an arrival animation (spawn position → near Rusty).
//    - Exposes a tiny state machine: hidden → arriving → arrived.
//    - Auto-faces the player while talking.
//
//  No physics; Bolt floats in via lerp and ignores world geometry.
//  Visuals only.
// ============================================================

const ARRIVAL_SPEED = 4.5;   // world units per second
const STOP_DISTANCE = 3.2;   // how close Bolt parks next to Rusty
const FACE_LERP     = 6.0;   // yaw smoothing toward player

export class Friend {
  constructor() {
    this.robot = new Robot({ palette: "bolt" });
    this.root  = this.robot.root;

    // NOTE: root.visible deliberately stays TRUE throughout the
    // lifetime of the Friend. Toggling visibility on/off would
    // change the scene's active-light count (Bolt has an eyeLight
    // + antenna PointLight), forcing every PBR material in the
    // scene to recompile its shader — a ~150 ms freeze at the very
    // moment the level finishes. Game.js parks Bolt at y=-500 until
    // it's time to summon him, then teleports him into place; no
    // visibility flag is ever flipped.
    this.state = "hidden"; // hidden → arriving → arrived

    this._targetPos = new THREE.Vector3();
    this._moveDir   = new THREE.Vector3();
    this._tmp       = new THREE.Vector3();
  }

  /**
   * Place Bolt at a spawn point (off-camera or near the player).
   * No visibility change — he's always visible, just relocated.
   */
  spawnAt(pos) {
    this.root.position.set(pos.x, pos.y, pos.z);
  }

  /**
   * Start walking Bolt toward `targetPos`. He stops automatically
   * at STOP_DISTANCE and switches to the "arrived" state (idle +
   * waves on arrival). No visibility flip — see constructor note.
   */
  arriveTo(targetPos, onArrived) {
    this.state = "arriving";
    this._targetPos.copy(targetPos);
    this._onArrived = onArrived;
    // Initial wave to draw attention as he walks in
    this.robot.wave();
  }

  /**
   * Per-frame update. `playerPos` is used both as the arrival
   * target and to keep Bolt facing Rusty after he stops.
   */
  update(dt, playerPos) {
    if (this.state === "hidden") return;

    const pos = this.root.position;

    if (this.state === "arriving") {
      // Re-aim at the latest player position each frame so Bolt
      // doesn't end up walking past Rusty if the player moved.
      this._targetPos.copy(playerPos);
      this._moveDir.subVectors(this._targetPos, pos);
      this._moveDir.y = 0;
      const dist = this._moveDir.length();

      if (dist <= STOP_DISTANCE) {
        this.state = "arrived";
        this.robot.wave(); // second wave: "I'm here!"
        if (this._onArrived) this._onArrived();
      } else {
        this._moveDir.normalize().multiplyScalar(ARRIVAL_SPEED * dt);
        pos.add(this._moveDir);
      }
    }

    // Face the player smoothly (both arriving and arrived)
    this._tmp.subVectors(playerPos, pos);
    const targetYaw = Math.atan2(this._tmp.x, this._tmp.z);
    const cur = this.root.rotation.y;
    let diff = targetYaw - cur;
    // wrap to shortest angle
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.root.rotation.y = cur + diff * Math.min(1, dt * FACE_LERP);

    // Drive the locomotion/animation rig
    const speed = this.state === "arriving" ? ARRIVAL_SPEED : 0;
    this.robot.update(dt, {
      moving:  this.state === "arriving",
      speed,
      jumping: false,
      emotion: null,
    });
  }

  /** Trigger a wave (e.g., when finishing a dialogue line). */
  wave() {
    this.robot.wave();
  }
}
