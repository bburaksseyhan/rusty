import * as THREE from "three";
import { createPaperTexture } from "../../assets/textures.js";

// ============================================================
//  Notebook Stack — three stacked books with spiral bindings.
//  The top book gets a printed page for storytelling.
// ============================================================

const STACK = [
  { w: 22, h: 1.4, d: 28, c: 0x6a1818 },
  { w: 24, h: 1.0, d: 26, c: 0x1c3d77 },
  { w: 21, h: 1.6, d: 27, c: 0x2c2c2c },
];

export function createNotebookStack() {
  const group = new THREE.Group();
  group.name = "Notebooks";

  const paper = createPaperTexture();
  const paperEdge = new THREE.MeshStandardMaterial({
    color: 0xeadda6,
    roughness: 0.95,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    map: paper,
    roughness: 0.92,
  });

  // Fixed offsets — no random so collider tops are predictable for physics.
  // Each book is slightly offset for a "messy stack" look without
  // making the platforms misaligned.
  const X_OFFSETS = [0.3, -0.2, 0.1];
  const Z_OFFSETS = [0.2, -0.15, 0.25];
  const ROT_OFFSETS = [0.04, -0.03, 0.05];

  let y = 0;
  STACK.forEach((b, i) => {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.5 })
    );
    cover.position.set(
      X_OFFSETS[i],
      y + b.h / 2,
      Z_OFFSETS[i]
    );
    cover.rotation.y = ROT_OFFSETS[i];
    cover.castShadow = cover.receiveShadow = true;
    cover.userData.collide = true;
    cover.userData.colliderType = "platform";
    group.add(cover);

    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(b.w - 0.6, b.h * 0.7, b.d - 0.6),
      paperEdge
    );
    pageBlock.position.copy(cover.position);
    group.add(pageBlock);

    if (i === STACK.length - 1) {
      const topPage = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w - 1.5, b.d - 1.5),
        paperMat
      );
      topPage.rotation.x = -Math.PI / 2;
      topPage.position.set(cover.position.x, y + b.h + 0.01, cover.position.z);
      group.add(topPage);
    }

    addSpiralRings(group, cover, b, y);
    y += b.h;
  });

  return { group };
}

function addSpiralRings(group, cover, b, y) {
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xbfc4cc,
    metalness: 0.9,
    roughness: 0.3,
  });
  for (let s = 0; s < 14; s++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.08, 8, 16),
      ringMat
    );
    ring.position.set(
      cover.position.x + b.w / 2 + 0.05,
      y + b.h / 2,
      cover.position.z - b.d / 2 + 1.2 + s * 1.8
    );
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }
}
