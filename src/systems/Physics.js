import * as THREE from "three";

// ============================================================
//  Physics — kinematic AABB collision against a static
//  collider list. Returns whether the body landed this frame
//  plus the impact speed (used by Audio for landing thuds).
//
//  The body is modeled as an axis-aligned box: footprint
//  (radius × radius) centered on `position`, height `height`,
//  with the origin AT the feet.
//
//  Key tunables:
//    STAND_EPSILON  — how far below a platform top the player's
//                     feet may be while still being treated as
//                     "landing on top" rather than "hitting the
//                     side wall". Higher = easier to climb over
//                     ledge edges when jumping.
//    STEP_UP_MAX    — max height difference for automatic step-up
//                     (player walks into a small ledge, gets lifted).
//    SUPPORT_REACH  — how far below a platform top the player may
//                     be in Y and still receive ground support.
//                     Higher = feet don't need to be exactly level
//                     with the top face.
// ============================================================

const STAND_EPSILON = 0.65;  // was 0.55 — more forgiving ledge landing
const STEP_UP_MAX   = 1.5;   // was 1.15 — auto-step over taller lips/curbs
const SUPPORT_REACH = 0.85;  // was 0.75 — keeps player glued to platform tops

export class Physics {
  constructor() {
    this._box = new THREE.Box3();
  }

  /**
   * Mutates `position` and `velocity` in place.
   * Returns `{ grounded, impactSpeed }`.
   */
  move(position, velocity, colliders, dt, radius, height) {
    // Horizontal axes first (separated for clean corner sliding)
    this._moveAxis(position, "x", velocity.x * dt, colliders, radius, height);
    this._moveAxis(position, "z", velocity.z * dt, colliders, radius, height);

    // Vertical
    position.y += velocity.y * dt;
    const supportY    = this._supportHeight(position, colliders, radius);
    const impactSpeed = -velocity.y;
    let grounded = false;
    if (position.y <= supportY + 0.001) {
      position.y = supportY;
      if (velocity.y < 0) {
        velocity.y = 0;
        grounded   = true;
      }
    }
    return { grounded, impactSpeed };
  }

  // ----------------------------------------------------------
  _makePlayerBox(pos, radius, height) {
    this._box.min.set(pos.x - radius, pos.y,          pos.z - radius);
    this._box.max.set(pos.x + radius, pos.y + height, pos.z + radius);
    return this._box;
  }

  _moveAxis(position, axis, delta, colliders, radius, height) {
    if (delta === 0) return;
    position[axis] += delta;
    const box = this._makePlayerBox(position, radius, height);

    for (const c of colliders) {
      if (c.type === "ground") continue;
      if (!box.intersectsBox(c.box)) continue;

      // ① Standing-on-top guard — player's feet are at or near the
      //    platform top, so this is a landing, not a side collision.
      if (position.y >= c.box.max.y - STAND_EPSILON) continue;

      // ② Auto step-up — platform top is just slightly above the
      //    player's feet. Snap up so they walk over small lips and
      //    ledge edges without a full jump.
      const stepUp = c.box.max.y - position.y;
      if (stepUp > 0 && stepUp <= STEP_UP_MAX) {
        position.y = c.box.max.y;
        return; // re-run next frame with corrected y
      }

      // ③ Side wall — push the player back out.
      if (delta > 0) position[axis] = c.box.min[axis] - radius - 0.001;
      else           position[axis] = c.box.max[axis] + radius + 0.001;
      return;
    }
  }

  _supportHeight(pos, colliders, radius) {
    let best = 0;
    for (const c of colliders) {
      if (c.type === "ground") continue;
      // Quick XZ footprint reject
      if (
        pos.x + radius < c.box.min.x ||
        pos.x - radius > c.box.max.x ||
        pos.z + radius < c.box.min.z ||
        pos.z - radius > c.box.max.z
      ) continue;
      // Player's feet must be within SUPPORT_REACH below the platform top
      if (pos.y >= c.box.max.y - SUPPORT_REACH && c.box.max.y > best) {
        best = c.box.max.y;
      }
    }
    return best;
  }
}
