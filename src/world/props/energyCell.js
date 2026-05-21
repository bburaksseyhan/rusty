import * as THREE from "three";
import { Materials } from "../../assets/materials.js";

// ============================================================
//  Energy Cell — pickup collectible with halo glow + light
// ============================================================

export function createEnergyCell() {
  const group = new THREE.Group();
  group.name = "EnergyCell";

  const core = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.7, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0xddf6ff,
      emissive: 0x5ed2ff,
      emissiveIntensity: 2.4,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  group.add(core);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 18), Materials.glass());
  group.add(shell);

  const light = new THREE.PointLight(0x6ad1ff, 1.6, 6, 2);
  group.add(light);

  return {
    group,
    light,
    core,
    shell,
    collected: false,
    radius: 1.3,
    spinSpeed: 1.2 + Math.random() * 0.4,
    bobOffset: Math.random() * Math.PI * 2,
  };
}
