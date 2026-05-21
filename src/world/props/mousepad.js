import * as THREE from "three";
import { Materials } from "../../assets/materials.js";

// ============================================================
//  Mouse Pad — flat traversal terrain with animated RGB edges
// ============================================================

const PAD_W = 28;
const PAD_D = 22;
const PAD_H = 0.45;

export function createMousepad() {
  const group = new THREE.Group();
  group.name = "Mousepad";

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(PAD_W, PAD_H, PAD_D),
    Materials.mousepadFabric()
  );
  pad.position.set(0, PAD_H / 2, 0);
  pad.castShadow = pad.receiveShadow = true;
  pad.userData.collide = true;
  pad.userData.colliderType = "platform";
  group.add(pad);

  group.add(buildLogo());

  const strips = buildStrips(group);
  function animate(t) {
    strips.forEach((s, i) => {
      const hue = (t * 0.08 + i * 0.25) % 1;
      s.material.emissive.setHSL(hue, 1, 0.55);
    });
  }

  return { group, animate, height: PAD_H };
}

function buildLogo() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 800; i++) {
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  ctx.fillStyle = "rgba(255, 180, 90, 0.45)";
  ctx.font = "900 200px 'SF Pro Display', Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("R", 128, 175);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-PAD_W / 2 + 5.5, PAD_H + 0.01, PAD_D / 2 - 5.5);
  return mesh;
}

function buildStrips(group) {
  const strips = [];
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(PAD_W + 0.6, 0.2, 0.5),
    Materials.rgbStrip()
  );
  top.position.set(0, PAD_H + 0.1, PAD_D / 2 + 0.2);
  group.add(top);
  strips.push(top);

  const bottom = new THREE.Mesh(top.geometry, Materials.rgbStrip());
  bottom.position.set(0, PAD_H + 0.1, -PAD_D / 2 - 0.2);
  group.add(bottom);
  strips.push(bottom);

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, PAD_D + 0.6),
    Materials.rgbStrip()
  );
  left.position.set(-PAD_W / 2 - 0.2, PAD_H + 0.1, 0);
  group.add(left);
  strips.push(left);

  const right = new THREE.Mesh(left.geometry, Materials.rgbStrip());
  right.position.set(PAD_W / 2 + 0.2, PAD_H + 0.1, 0);
  group.add(right);
  strips.push(right);

  return strips;
}
