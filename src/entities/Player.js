import * as THREE from "three";
import { Robot } from "./Robot.js";
import { PLAYER } from "../core/config.js";
import { lerpAngle } from "../utils/math.js";

// ============================================================
//  Player — owns Rusty's gameplay state.
//
//  Composes the visual Robot rig with kinematic state (velocity,
//  grounded), camera-relative input handling, jump/sprint logic,
//  footstep cadence, health and collected-cell count.
//
//  Physics resolution itself lives in the Physics system — the
//  player just hands it the desired velocity each frame.
// ============================================================

export class Player {
  constructor({ audio, physics, input }) {
    this.audio = audio;
    this.physics = physics;
    this.input = input;

    this.robot = new Robot();
    this.root = this.robot.root;

    this.velocity = new THREE.Vector3();
    this.grounded = true;
    this._wasGrounded = true;
    // Tracks how many half-cycles (foot strikes) the Robot has
    // animated so the Audio.footstep call fires exactly in time
    // with the rendered leg crossing. See Robot._legPhase.
    this._lastStepHalfCycle = 0;

    // ---- Forgiving platforming windows ----
    // Coyote time: counts up since the player was last grounded.
    //              While <= PLAYER.coyoteTime, a jump press still works.
    // Jump buffer: counts down from a recent jump press; if the player
    //              lands while it's > 0, the jump auto-fires.
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;

    this.health = PLAYER.startHealth;
    this.hitCooldown = 0;
    this.cells = 0;
    this.bodyWorldPos = new THREE.Vector3();
  }

  spawn(position, facing = Math.PI) {
    this.root.position.set(position[0], position[1], position[2]);
    this.root.rotation.y = facing;
  }

  /** Knock the player back, e.g. from a hazard. */
  applyKnockback(direction, horizForce, vertForce) {
    this.velocity.x += direction.x * horizForce;
    this.velocity.z += direction.z * horizForce;
    this.velocity.y = vertForce;
  }

  update(dt, cameraYaw, colliders) {
    this._updateMovement(dt, cameraYaw);
    this._updatePhysics(dt, colliders);
    this._updateAnimation(dt);
    this._updateFootsteps(dt);

    this.robot.body.getWorldPosition(this.bodyWorldPos);
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
  }

  // ------------------------------------------------------------
  _updateMovement(dt, cameraYaw) {
    const forward = TMP_FWD.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    // Right = up × (-forward). Mirrored vector caused the legacy "swapped A/D" bug.
    const right = TMP_RIGHT.set(-forward.z, 0, forward.x);

    const wish = TMP_WISH.set(0, 0, 0);
    if (this.input.isDown("KeyW") || this.input.isDown("ArrowUp")) wish.add(forward);
    if (this.input.isDown("KeyS") || this.input.isDown("ArrowDown")) wish.sub(forward);
    if (this.input.isDown("KeyA") || this.input.isDown("ArrowLeft")) wish.sub(right);
    if (this.input.isDown("KeyD") || this.input.isDown("ArrowRight")) wish.add(right);

    const sprinting = this.input.isSprinting();
    this._sprinting = sprinting;
    const moveSpeed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(moveSpeed);
      this.velocity.x = wish.x;
      this.velocity.z = wish.z;
      // Face direction of travel — slower rate (8 → from 12) so the
      // robot pivots smoothly on diagonal/strafe inputs instead of
      // snapping, which used to amplify the camera auto-align whip.
      const target = Math.atan2(wish.x, wish.z);
      this.root.rotation.y = lerpAngle(
        this.root.rotation.y,
        target,
        Math.min(1, dt * 8)
      );
    } else {
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    }

    // ---- Jump with coyote time + input buffering ----
    // 1. Tick both timers.
    if (this.grounded) {
      this._coyoteTimer = 0;
    } else {
      this._coyoteTimer += dt;
    }
    if (this._jumpBufferTimer > 0) {
      this._jumpBufferTimer -= dt;
    }
    // 2. New jump press → buffer it.
    if (this.input.consumeJump()) {
      this._jumpBufferTimer = PLAYER.jumpBuffer;
    }
    // 3. Fire jump if a buffered press is alive AND we're either
    //    grounded or still inside the coyote window.
    const canJump = this.grounded || this._coyoteTimer <= PLAYER.coyoteTime;
    if (this._jumpBufferTimer > 0 && canJump) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.grounded = false;
      this._coyoteTimer = PLAYER.coyoteTime + 1; // consume coyote window
      this._jumpBufferTimer = 0;
      this.audio?.jump();
    }

    this.velocity.y -= PLAYER.gravity * dt;
    if (this.velocity.y < -PLAYER.maxFallSpeed) this.velocity.y = -PLAYER.maxFallSpeed;
  }

  _updatePhysics(dt, colliders) {
    const result = this.physics.move(
      this.root.position,
      this.velocity,
      colliders,
      dt,
      PLAYER.radius,
      PLAYER.height,
      PLAYER.collisionHeight
    );
    this.grounded = result.grounded;

    if (!this._wasGrounded && this.grounded && result.impactSpeed > PLAYER.landingThresholdSpeed) {
      this.audio?.land();
    }
    this._wasGrounded = this.grounded;
  }

  _updateAnimation(dt) {
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = horizSpeed > 0.3 && this.grounded;
    this.robot.update(dt, {
      moving,
      speed:   horizSpeed,
      jumping: !this.grounded,
      emotion: this._emotion ?? null,
    });
  }

  /** Attach an EmotionSystem.derived reference for the robot to read. */
  setEmotionDerived(derived) {
    this._emotion = derived;
  }

  _updateFootsteps(/* dt */) {
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = horizSpeed > 0.3 && this.grounded;
    if (!moving || !this.audio) {
      // Keep the half-cycle counter aligned with the Robot's current
      // phase so the next step-on-resume fires after a fresh swing,
      // not retroactively.
      this._lastStepHalfCycle = Math.floor(this.robot._legPhase / Math.PI);
      return;
    }
    // Each foot strike = every π radians of leg phase.
    const halfCycle = Math.floor(this.robot._legPhase / Math.PI);
    if (halfCycle !== this._lastStepHalfCycle) {
      this._lastStepHalfCycle = halfCycle;
      this.audio.footstep(this._sprinting ? 1.0 : 0.8);
    }
  }
}

// Pre-allocated temp vectors — avoid per-frame garbage.
const TMP_FWD = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_WISH = new THREE.Vector3();
