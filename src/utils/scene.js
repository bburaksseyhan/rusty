import * as THREE from "three";

// ============================================================
//  Scene-graph helpers
// ============================================================

/**
 * Walks a group and pushes a {box, top, type} collider for every
 * mesh that opts in via `userData.collide = true`. Boxes are
 * computed in world space so the prop can be freely placed/rotated
 * before being added to the world.
 */
export function collectColliders(group, sink, meshIndex = null) {
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (child.isMesh && child.userData.collide) {
      const box = new THREE.Box3().setFromObject(child);
      const entry = {
        mesh: child,
        box,
        top: box.max.y,
        type: child.userData.colliderType || "solid",
      };
      sink.push(entry);
      meshIndex?.set(child, entry);
    }
  });
}

/** Recursively enable shadows on all meshes of a group. */
export function enableShadows(group, { cast = true, receive = true } = {}) {
  group.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}
