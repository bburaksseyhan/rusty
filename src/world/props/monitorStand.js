import * as THREE from "three";

// ============================================================
//  Monitor Stand — final destination platform with 3 step books
//  acting as a climbable staircase from the notebook side.
// ============================================================

export function createMonitorStand() {
  const group = new THREE.Group();
  group.name = "MonitorStand";

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x222428,
    roughness: 0.4,
    metalness: 0.85,
  });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 11, 1.2, 32),
    standMat
  );
  base.position.set(0, 0.6, 0);
  base.castShadow = base.receiveShadow = true;
  base.userData.collide = true;
  base.userData.colliderType = "platform";
  group.add(base);

  const top = new THREE.Mesh(new THREE.BoxGeometry(12, 1.0, 12), standMat);
  top.position.set(0, 12.0, 0);
  top.castShadow = top.receiveShadow = true;
  top.userData.collide = true;
  top.userData.colliderType = "platform";
  group.add(top);

  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.8, 12, 18),
    standMat
  );
  col.position.set(0, 6.4, 0);
  col.castShadow = true;
  group.add(col);

  addStepBooks(group);

  const goalLight = new THREE.PointLight(0x88e0ff, 1.4, 16, 2);
  goalLight.position.set(0, 14, 0);
  group.add(goalLight);

  return { group };
}

function addStepBooks(group) {
  // ----------------------------------------------------------
  //  Stair-of-books from the notebook stack up to the monitor
  //  stand's top platform.
  //
  //  Stand is at world (0, 0, -55) → all positions here are
  //  LOCAL to that origin. Notebook stack tops out at world y=4
  //  with its north edge at world z=-53.25 (local z=1.75), so
  //  Step 0 *overlaps* the notebook footprint to act as a
  //  seamless walk-on bridge — no awkward edge jump required.
  //
  //  Climb plan (every gap is either auto-step-uppable (≤ 1.5u)
  //  or a gentle 2.0u hop — half of max jump 4.26u from
  //  jumpSpeed=18, gravity=38). All steps are 7-8u wide/deep so
  //  the player has comfortable room to land:
  //
  //    Notebook top (y=4) → Step 0 (top y=4,    walk-on bridge)
  //    Step 0  → Step 1   (top y=6.0,  2.0u hop)
  //    Step 1  → Step 2   (top y=8.0,  2.0u hop)
  //    Step 2  → Step 3   (top y=10.0, 2.0u hop)
  //    Step 3  → Step 4   (top y=11.5, 1.5u auto step-up)
  //    Step 4  → Stand top(y=12.5,     1.0u auto step-up)
  //
  //  Each book overlaps its neighbour's XZ footprint (≥2u of
  //  overlap on each axis), so misaligned jumps still land on
  //  the next tread instead of plummeting into the desk.
  // ----------------------------------------------------------
  const books = [
    // x, y(centre), z, w, h, d, color
    // Step 0 — bridge book. Wide + deep; overlaps the notebook
    // top by ~5u in -Z, so the player can walk straight across.
    { x: -6, y: 2.0,  z: 5,    w: 8, h: 4.0,  d: 8, c: 0x4a2218 },
    // Step 1 — top y=6.0. 2.0u hop from Step 0.
    { x: -4, y: 3.0,  z: 1.5,  w: 7, h: 6.0,  d: 7, c: 0x10243a },
    // Step 2 — top y=8.0. 2.0u hop from Step 1.
    { x: -2, y: 4.0,  z: -1.5, w: 7, h: 8.0,  d: 7, c: 0x2a2a2a },
    // Step 3 — top y=10.0. 2.0u hop from Step 2.
    { x:  0, y: 5.0,  z: -3.5, w: 6, h: 10.0, d: 6, c: 0x1c3050 },
    // Step 4 — top y=11.5. 1.5u auto step-up from Step 3.
    // Sits flush against the stand top; final 1.0u to platform
    // is also auto step-up, so the climb terminates with a walk.
    { x:  0, y: 5.5, z: -4.2, w: 6, h: 11.0, d: 6, c: 0x3a1010 },
  ];
  books.forEach((b) => {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.7 })
    );
    step.position.set(b.x, b.y, b.z);
    step.castShadow = step.receiveShadow = true;
    step.userData.collide = true;
    step.userData.colliderType = "platform";
    group.add(step);

    // Paper-edge band sells each block as a thick volume (dictionary
    // / atlas) rather than a featureless pillar.
    const paperEdge = new THREE.Mesh(
      new THREE.BoxGeometry(b.w - 0.4, b.h * 0.55, b.d - 0.4),
      new THREE.MeshStandardMaterial({ color: 0xe8dba5, roughness: 0.95 })
    );
    paperEdge.position.copy(step.position);
    group.add(paperEdge);
  });
}
