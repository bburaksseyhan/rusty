import * as THREE from "three";

const WIRE_Y = 0.35;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function wireBetween(group, from, to, radius, mat) {
  _a.copy(from);
  _b.copy(to);
  const dir = new THREE.Vector3().subVectors(_b, _a);
  const len = dir.length();
  if (len < 0.01) return null;

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 5),
    mat,
  );
  mesh.position.copy(_a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  group.add(mesh);
  return mesh;
}

/**
 * Not defteri vida devresi — tek paylaşımlı materyal, kare başına animasyon yok (donma önler).
 */
export function createScrewElectricRig(screws, { notebookAnchor }) {
  const group = new THREE.Group();
  group.name = "ScrewElectricRig";

  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x223344,
    emissive: new THREE.Color(0x4488aa),
    emissiveIntensity: 0.03,
    metalness: 0.7,
    roughness: 0.4,
  });

  const hubGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 6, 6),
    new THREE.MeshStandardMaterial({
      color: 0x224466,
      emissive: new THREE.Color(0x66aacc),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.7,
    }),
  );
  hubGlow.position.copy(notebookAnchor);
  group.add(hubGlow);

  const segments = [];

  for (let i = 0; i < screws.length; i++) {
    const p = screws[i].group.position;
    const pt = new THREE.Vector3(p.x, WIRE_Y, p.z);

    if (i < screws.length - 1) {
      const p2 = screws[i + 1].group.position;
      const pt2 = new THREE.Vector3(p2.x, WIRE_Y, p2.z);
      wireBetween(group, pt, pt2, 0.05, wireMat);
      segments.push({ screwIndex: i + 1 });
    }
  }

  if (screws.length > 0) {
    const last = screws[screws.length - 1].group.position;
    const from = new THREE.Vector3(last.x, WIRE_Y, last.z);
    wireBetween(group, from, notebookAnchor, 0.055, wireMat);
    segments.push({ screwIndex: screws.length });
  }

  return {
    group,

    onScrewTightened() {
      const n = screws.filter((s) => s.tightened).length;
      const total = screws.length;
      const level = n / Math.max(1, total);

      wireMat.emissiveIntensity = 0.05 + level * 0.55;
      hubGlow.material.emissiveIntensity = level * 1.6;
    },

    /** Statik parlaklık — sinüs/flicker yok (GPU + bloom dostu) */
    update() {},
  };
}
