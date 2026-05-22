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
    this.fanProps = [];
    this.monitorProp = null;
    this.deskNailProps = [];
    this.deskScrewProps = [];
    this.screwElectricRig = null;
    this.pushableGroups = [];
    /** @type {Map<THREE.Mesh, { box, top, type, mesh }>} */
    this._colliderByMesh = new Map();

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
    collectColliders(prop.group, this.colliders, this._colliderByMesh);

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

  /**
   * Sadece hareket eden (itilebilir) objelerin collider'ları — her karede
   * tüm klavye/mug mesh'lerinde setFromObject donmaya yol açıyordu.
   */
  syncColliders() {
    if (this.pushableGroups.length === 0) return;
    for (const g of this.pushableGroups) {
      g.updateMatrixWorld(true);
      g.traverse((child) => {
        if (!child.isMesh) return;
        const c = this._colliderByMesh.get(child);
        if (!c) return;
        c.box.setFromObject(child);
        c.top = c.box.max.y;
      });
    }
  }

  update(t, dt) {
    this.syncColliders();
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
