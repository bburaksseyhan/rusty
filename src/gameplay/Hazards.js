import * as THREE from "three";
import { HAZARD, PLAYER } from "../core/config.js";

// ============================================================
//  Hazards — proximity damage with knockback and per-hazard
//  cooldown. Emits an `onHit` event so HUD/audio can react.
// ============================================================

export class Hazards {
  constructor(hazards, player) {
    this.hazards = hazards;
    this.player = player;
    this._onHit = null;
    this._tmp = new THREE.Vector3();
  }

  onHit(cb) {
    this._onHit = cb;
    return this;
  }

  update(dt) {
    const playerPos = this.player.root.position;

    for (const h of this.hazards) {
      h.cooldown = Math.max(0, h.cooldown - dt);
      const d = h.position.distanceTo(playerPos);
      if (d < h.radius && h.cooldown <= 0 && this.player.hitCooldown <= 0) {
        this.player.health = Math.max(0, this.player.health - h.damage);
        this.player.hitCooldown = PLAYER.hitInvulnerability;
        h.cooldown = HAZARD.cooldownAfterHit;

        this._tmp.copy(playerPos).sub(h.position).setY(0).normalize();
        this.player.applyKnockback(
          this._tmp,
          HAZARD.knockbackHoriz,
          HAZARD.knockbackVert
        );

        this._onHit?.(h, this.player.health);
      }
    }
  }
}
