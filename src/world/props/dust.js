import * as THREE from "three";

// ============================================================
//  Floating Dust Particles — additive points scattered in the air
// ============================================================

export function createDust(count = 800) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = Math.random() * 60 + 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.18,
    color: 0xffe1b0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Points(geo, mat);

  function animate(_t, dt) {
    group.rotation.y += dt * 0.02;
  }

  return { group, animate };
}
