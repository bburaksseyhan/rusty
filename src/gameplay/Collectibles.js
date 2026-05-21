import { COLLECTIBLE } from "../core/config.js";

// ============================================================
//  Collectibles — detects pickup overlaps and fires callbacks.
//
//  The system is purely event-emitting; HUD updates / subtitles
//  / audio are wired by the Game class. This keeps the gameplay
//  logic decoupled from presentation.
// ============================================================

export class Collectibles {
  constructor(cells, player) {
    this.cells = cells;
    this.player = player;
    this._onPickup = null;
    this._onComplete = null;
  }

  /** Register a callback fired for each cell picked up. */
  onPickup(cb) {
    this._onPickup = cb;
    return this;
  }

  /** Register a callback fired when ALL cells are picked up. */
  onComplete(cb) {
    this._onComplete = cb;
    return this;
  }

  get total() {
    return this.cells.length;
  }

  update() {
    const playerPos = this.player.root.position;
    for (const c of this.cells) {
      if (c.collected) continue;
      const dx = c.group.position.x - playerPos.x;
      const dy = c.group.position.y - playerPos.y;
      const dz = c.group.position.z - playerPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < c.radius + COLLECTIBLE.pickupRadius) {
        c.collected = true;
        // Hide the visible meshes *individually* and dim (not hide) the
        // light. Toggling a Light's parent.visible changes the scene's
        // active-light COUNT, which forces Three.js to re-compile every
        // PBR material in the scene — this caused the noticeable freeze
        // on pickup. Dimming intensity to 0 keeps the light list stable.
        if (c.core)  c.core.visible  = false;
        if (c.shell) c.shell.visible = false;
        if (c.light) c.light.intensity = 0;
        this.player.cells++;
        this._onPickup?.(c, this.player.cells, this.total);
        if (this.player.cells === this.total) {
          this._onComplete?.();
        }
      }
    }
  }
}
