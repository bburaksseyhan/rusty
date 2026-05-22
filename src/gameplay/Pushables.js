import * as THREE from "three";

/**
 * Küçük masa objeleri — oyuncu itince kayar (kalem vb.).
 */
export class Pushables {
  constructor() {
    this.items = [];
  }

  register(group, { radius = 1.2, pushStrength = 5 } = {}) {
    this.items.push({
      group,
      radius,
      pushStrength,
      velocity: new THREE.Vector3(),
    });
  }

  update(dt, playerPos, playerRadius) {
    for (const item of this.items) {
      const pos = item.group.position;
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      const minDist = item.radius + playerRadius + 0.15;

      if (dist < minDist && dist > 0.01) {
        const push = (minDist - dist) * item.pushStrength;
        item.velocity.x += (dx / dist) * push * dt * 8;
        item.velocity.z += (dz / dist) * push * dt * 8;
      }

      item.velocity.multiplyScalar(0.88);
      pos.x += item.velocity.x * dt;
      pos.z += item.velocity.z * dt;
      item.velocity.multiplyScalar(0.7);
    }
  }
}
