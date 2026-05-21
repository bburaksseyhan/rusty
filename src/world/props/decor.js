import * as THREE from "three";
import { Materials } from "../../assets/materials.js";

// ============================================================
//  Small set-dressing props: pencil, battery, screw
//  Each returns a uniform `{ group }` so they integrate cleanly
//  with the World.addProp pipeline.
// ============================================================

// ----- Pencil ------------------------------------------------
export function createPencil(color = 0xe8c060) {
  const group = new THREE.Group();
  group.name = "Pencil";

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 22, 6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 })
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = body.receiveShadow = true;
  body.userData.collide = true;
  body.userData.colliderType = "platform";
  group.add(body);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(1.0, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xd6b27a, roughness: 0.8 })
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 12.2;
  group.add(tip);

  const point = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.8, 12),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.6,
      metalness: 0.7,
    })
  );
  point.rotation.z = -Math.PI / 2;
  point.position.x = 13.6;
  group.add(point);

  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 1.4, 16),
    Materials.metalBright()
  );
  ferrule.rotation.z = Math.PI / 2;
  ferrule.position.x = -10;
  group.add(ferrule);

  const eraser = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: 0xd97070, roughness: 0.85 })
  );
  eraser.rotation.z = Math.PI / 2;
  eraser.position.x = -11.6;
  group.add(eraser);

  return { group };
}

// ----- Battery -----------------------------------------------
export function createBattery(color = 0x1a8a3a) {
  const group = new THREE.Group();
  group.name = "Battery";

  const wrap = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.3,
  });
  const metal = Materials.metalBright();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 7.2, 28),
    wrap
  );
  body.position.y = 3.6;
  body.castShadow = body.receiveShadow = true;
  // Body is SOLID — players cannot pass through its silhouette.
  // The climb path is a 4-step exterior staircase on +Z plus a
  // wider top cap that overhangs the body edge, letting the
  // player step onto the top without climbing over the rim.
  body.userData.collide = true;
  body.userData.colliderType = "platform";
  group.add(body);

  // Thin base so the battery has a solid footprint.
  const baseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(2.7, 2.7, 0.5, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  );
  baseRing.position.y = 0.25;
  baseRing.userData.collide = true;
  baseRing.userData.colliderType = "platform";
  group.add(baseRing);

  // 4-step staircase on +Z side. Each tread sits OUTSIDE the body
  // radius (2.6), with gaps ≤ 1.8 — comfortably under jump height
  // (~4.26) and well within auto-step (1.5) for the first/last.
  //   Heights:   0 → 1.0 → 2.8 → 4.6 → 6.4 → cap 7.6
  //   Z-offset:  4.0 → 3.7 → 3.4 → 3.3 (recedes toward body)
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xf0e0a0,
    roughness: 0.5,
    metalness: 0.2,
  });
  const stepLayout = [
    { ly: 0.8, z: 4.0 }, // step 0 — auto step-up from desk
    { ly: 2.6, z: 3.7 }, // step 1
    { ly: 4.4, z: 3.4 }, // step 2
    { ly: 6.2, z: 3.3 }, // step 3 — final rung, cap is 1.4 up
  ];
  stepLayout.forEach(({ ly, z }) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.4), stepMat);
    step.position.set(0, ly + 0.2, z);
    step.castShadow = step.receiveShadow = true;
    step.userData.collide = true;
    step.userData.colliderType = "platform";
    group.add(step);
  });

  // Wider top cap (radius 3.0) — overhangs the body cylinder
  // (radius 2.6) by 0.4 units. That overhang sits directly above
  // step 3 (z=3.3, tread extends to z=4.0), so the player can
  // step UP onto the cap edge without ever needing to mantle
  // over the body's rim.
  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.0, 0.4, 28),
    new THREE.MeshStandardMaterial({ color: 0xc8c8a0, roughness: 0.3, metalness: 0.5 })
  );
  topCap.position.y = 7.4;
  topCap.castShadow = topCap.receiveShadow = true;
  topCap.userData.collide = true;
  topCap.userData.colliderType = "platform";
  group.add(topCap);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(2.62, 2.62, 0.4, 28),
    metal
  );
  top.position.y = 7.62; // sits just above the cap platform
  group.add(top);

  const nub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.6, 18),
    metal
  );
  nub.position.y = 7.9;
  group.add(nub);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.62, 2.62, 0.4, 28),
    metal
  );
  base.position.y = 0.2;
  group.add(base);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.63, 2.63, 1.8, 28, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xf0e0a0,
      side: THREE.DoubleSide,
      roughness: 0.6,
    })
  );
  band.position.y = 4.8;
  group.add(band);

  return { group };
}

// ----- Screw -------------------------------------------------
export function createScrew() {
  const group = new THREE.Group();
  group.name = "Screw";
  const mat = Materials.metalBright();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.05, 1.0, 10),
    mat
  );
  shaft.position.y = 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.15, 14),
    mat
  );
  head.position.y = 1.0;
  group.add(head);

  return { group };
}
