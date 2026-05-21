import * as THREE from "three";
import { collectColliders } from "../utils/scene.js";

// ============================================================
//  World — owns the scene graph for a level.
//
//  Levels register props via `addProp(prop)`. The world walks
//  the prop's group to harvest colliders, registers any optional
//  animate callbacks, and tracks hazards/collectibles centrally.
//  This keeps level composition declarative.
// ============================================================

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "World";
    scene.add(this.root);

    this.colliders = [];
    this.collectibles = [];
    this.hazards = [];
    this._tickers = [];

    // Bottomless floor so the player can never fall through.
    this.colliders.push({
      box: new THREE.Box3(
        new THREE.Vector3(-1000, -2, -1000),
        new THREE.Vector3(1000, 0, 1000)
      ),
      top: 0,
      type: "ground",
    });
  }

  /**
   * Adds a `Prop` to the world.
   *
   * A Prop conforms to: `{ group: Group, animate?: fn, hazard?: spec }`.
   * Optional placement helper: `addProp(prop, { position, rotationY })`.
   */
  addProp(prop, { position, rotationY } = {}) {
    if (position) prop.group.position.set(position[0], position[1], position[2]);
    if (rotationY !== undefined) prop.group.rotation.y = rotationY;

    this.root.add(prop.group);
    collectColliders(prop.group, this.colliders);

    if (prop.animate) this._tickers.push(prop.animate);
    if (prop.hazard) this.hazards.push(prop.hazard);

    return prop;
  }

  /** Register a collectible energy cell at a world position. */
  addCollectible(cell, position) {
    cell.group.position.set(position[0], position[1], position[2]);
    this.root.add(cell.group);
    this.collectibles.push(cell);
    return cell;
  }

  /** Per-frame tick. Drives prop animations + collectible bob/spin. */
  update(t, dt) {
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.group.position.y +=
        Math.sin(t * c.spinSpeed + c.bobOffset) * dt * 0.6;
      c.group.rotation.y += dt * 1.2;
    }
    for (const a of this._tickers) a(t, dt);
    for (const h of this.hazards) h.updatePosition?.();
  }
}
