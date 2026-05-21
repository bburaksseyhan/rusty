import * as THREE from "three";
import { createMugTexture } from "../../assets/textures.js";

// ============================================================
//  Coffee mug — climbable tower
//
//  Physics strategy:
//    The cylinder body is purely visual (no collide) so it doesn't
//    become a blocking AABB wall. Six visible ledge rings protrude
//    from the +Z face every ~2.5 units in height, giving the player
//    a clear ladder to jump up. A thin base disk prevents the mug
//    from feeling hollow at ground level.
//
//    Ledge heights: 1.5, 4.0, 7.0, 10.0, 13.0, 16.0
//    From ground (0) to rim (18): each jump gap ≤ 3.0 < player max (3.37).
// ============================================================

const LEDGE_Y = [1.5, 4.0, 7.0, 10.0, 13.0, 16.0];

export function createMug() {
  const group = new THREE.Group();
  group.name = "Mug";

  const tex = createMugTexture();
  const mugMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.32,
    metalness: 0.05,
  });
  const mugInner = new THREE.MeshStandardMaterial({
    color: 0x111418,
    roughness: 0.4,
  });

  // --- Main body — SOLID collider so you can't pass through ---
  // The body AABB sits at local z [-7, +7]. All climbing ledges are
  // at local z = +9, which is OUTSIDE this z range. So the body
  // acts as a wall for anyone trying to go THROUGH the mug, while
  // the ledges are fully accessible from the front (+z) side.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 6.5, 18, 36, 1, false),
    mugMat
  );
  body.position.y = 9;
  body.castShadow = body.receiveShadow = true;
  body.userData.collide = true;
  body.userData.colliderType = "platform";
  group.add(body);

  // --- Thin base disk: auto-step-up height (≤1.1) so player can approach ---
  const baseDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.0, 0.6, 32),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.3 })
  );
  baseDisk.position.y = 0.3;
  baseDisk.castShadow = baseDisk.receiveShadow = true;
  baseDisk.userData.collide = true;
  baseDisk.userData.colliderType = "platform";
  group.add(baseDisk);

  // --- Rim (visual torus) ---
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7, 0.4, 14, 36), mugMat);
  rim.position.y = 18;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  // --- Wide invisible top landing pad ---
  // The body AABB front face is at local z = +7 (world z = −13).
  // Climbing ledges are at local z = +9 (world z = −11).
  // This box extends to local z = +12 (world z = −8), so the player
  // standing on ledge 6 (world z = −11) can jump and land on this
  // pad at y = 18 without needing to reach z < −13 first.
  const topPad = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.4, 22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  topPad.position.set(0, 18.2, 2); // local z centre = 2, depth 22 → covers z [−9, +13]
  topPad.userData.collide = true;
  topPad.userData.colliderType = "platform";
  group.add(topPad);

  // --- Inner cup wall ---
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.0, 17.5, 36, 1, true),
    mugInner
  );
  inner.position.y = 9.3;
  inner.material.side = THREE.DoubleSide;
  group.add(inner);

  // --- Coffee surface (inner, visible) ---
  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(6.3, 6.3, 0.4, 36),
    new THREE.MeshStandardMaterial({
      color: 0x2a1206,
      roughness: 0.2,
      emissive: 0x1a0a04,
      emissiveIntensity: 0.2,
    })
  );
  coffee.position.y = 15;
  group.add(coffee);

  // --- Handle ---
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 1.0, 12, 24, Math.PI),
    mugMat
  );
  handle.position.set(-7.4, 9.5, 0);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.z = Math.PI / 2;
  handle.castShadow = true;
  group.add(handle);

  // --- Climbing ledges on the front face (+Z side) ---
  // Each is a visible, platform-collider box that protrudes from the
  // mug body. The player jumps from ledge to ledge to reach the rim.
  const ledgeMat = new THREE.MeshStandardMaterial({
    color: 0x9ab8cc,
    roughness: 0.45,
    metalness: 0.55,
  });

  LEDGE_Y.forEach((ly, i) => {
    // Alternate left/right so the player zig-zags slightly, making
    // the climb feel natural rather than jumping in place.
    const xOff = (i % 2 === 0) ? 1.5 : -1.5;
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.5, 2.0),
      ledgeMat
    );
    // Z=9 puts the ledge just outside the mug body radius (~7).
    ledge.position.set(xOff, ly + 0.25, 9.0);
    ledge.castShadow = ledge.receiveShadow = true;
    ledge.userData.collide = true;
    ledge.userData.colliderType = "platform";
    group.add(ledge);
  });

  // --- Steam light & particles ---
  const steamLight = new THREE.PointLight(0xffc070, 1.4, 28, 2);
  steamLight.position.y = 24;
  group.add(steamLight);

  const steam = createSteamParticles(20);
  steam.position.y = 18;
  group.add(steam);

  function animate(t, dt) {
    const pos = steam.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y += dt * (0.8 + i * 0.05);
      if (y > 10) y = 0;
      pos.setY(i, y);
      pos.setX(i, Math.sin(t * 0.6 + i) * 0.6 + (i - 10) * 0.05);
      pos.setZ(i, Math.cos(t * 0.4 + i) * 0.6);
    }
    pos.needsUpdate = true;
    steam.material.opacity = 0.18 + 0.05 * Math.sin(t * 1.5);
  }

  return { group, animate };
}

function createSteamParticles(count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 1.2;
    positions[i * 3 + 1] = Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6,
    color: 0xfff1d0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}
