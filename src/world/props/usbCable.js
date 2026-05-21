import * as THREE from "three";

// ============================================================
//  USB Cables — bridge and decorative snake
//
//  Physics strategy:
//    A TubeGeometry's single AABB covers the whole curved shape,
//    making the surface unpredictable for AABB physics. Instead
//    we sample N points along the CatmullRom curve and place a
//    thin flat invisible box at each point, oriented to the local
//    tangent. This turns the cable into a series of flat walkable
//    planks that feel like a real rope bridge.
// ============================================================

const BRIDGE_SEGMENTS = 14; // number of walkable planks along the cable
const PLANK_WIDTH = 1.4;    // slightly wider than the tube so nothing falls through

/** Bridge between two world-space points. Sags in the middle, walkable. */
export function createUsbCable(a, b, { thickness = 0.45, sag = 1.6 } = {}) {
  const group = new THREE.Group();
  group.name = "UsbCable";

  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);

  // --- Visual tube ---
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, thickness, 14, false),
    new THREE.MeshStandardMaterial({
      color: 0x141418,
      roughness: 0.65,
      metalness: 0.3,
    })
  );
  tube.castShadow = tube.receiveShadow = true;
  group.add(tube);

  // --- Invisible walkable planks sampled along the curve ---
  const invisible = new THREE.MeshBasicMaterial({ visible: false });

  for (let i = 0; i < BRIDGE_SEGMENTS; i++) {
    const t0 = i / BRIDGE_SEGMENTS;
    const t1 = (i + 1) / BRIDGE_SEGMENTS;
    const posA = curve.getPoint(t0);
    const posB = curve.getPoint(t1);

    // Midpoint of this segment
    const centre = posA.clone().add(posB).multiplyScalar(0.5);
    // Length of segment
    const segLen = posA.distanceTo(posB);
    // Tangent direction for alignment
    const dir = posB.clone().sub(posA).normalize();
    const angle = Math.atan2(dir.x, dir.z);

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(PLANK_WIDTH, thickness * 2, segLen + 0.1),
      invisible
    );
    plank.position.copy(centre);
    plank.rotation.y = angle;
    plank.userData.collide = true;
    plank.userData.colliderType = "platform";
    group.add(plank);
  }

  // --- USB plug ends (decorative) ---
  const plugA = createUsbPlug();
  plugA.position.copy(a);
  plugA.lookAt(mid);
  group.add(plugA);

  const plugB = createUsbPlug();
  plugB.position.copy(b);
  plugB.lookAt(mid);
  group.add(plugB);

  return { group };
}

function createUsbPlug() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.9, 1.6),
    new THREE.MeshStandardMaterial({
      color: 0x9aa0a8,
      metalness: 0.9,
      roughness: 0.3,
    })
  );
  shell.position.z = 0.8;
  shell.castShadow = true;
  g.add(shell);

  const tongue = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.18, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 })
  );
  tongue.position.z = 1.7;
  g.add(tongue);
  return g;
}

/** Long decorative cable winding across the floor — not walkable. */
export function createUsbCableSnake() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const angle = t * Math.PI * 1.8;
    pts.push(
      new THREE.Vector3(
        -70 + Math.cos(angle) * 28 + t * 60,
        0.5 + Math.sin(t * 6) * 0.2,
        65 - t * 100 + Math.sin(angle) * 8
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 200, 0.7, 14, false),
    new THREE.MeshStandardMaterial({
      color: 0x1a1c20,
      roughness: 0.55,
      metalness: 0.3,
    })
  );
  tube.castShadow = tube.receiveShadow = true;
  return { group: tube };
}
