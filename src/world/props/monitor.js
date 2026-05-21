import * as THREE from "three";
import { createDarkPanelTexture } from "../../assets/textures.js";
import { Materials } from "../../assets/materials.js";

// ============================================================
//  Monitor — sleeping desktop screen with subliminal flicker
// ============================================================

export function createMonitor() {
  const group = new THREE.Group();
  group.name = "Monitor";

  const panelTex = createDarkPanelTexture();
  const bodyMat = new THREE.MeshStandardMaterial({
    map: panelTex,
    color: 0x1a1d22,
    roughness: 0.6,
    metalness: 0.4,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(180, 95, 6), bodyMat);
  body.position.set(0, 50, 0);
  body.castShadow = true;
  body.userData.collide = true;
  body.userData.colliderType = "wall";
  group.add(body);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(166, 82, 0.6),
    Materials.plasticBezel()
  );
  bezel.position.set(0, 50, 3.2);
  group.add(bezel);

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a1830,
    emissive: 0x4ea7ff,
    emissiveIntensity: 1.2,
    roughness: 0.25,
    metalness: 0.05,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(158, 76), screenMat);
  screen.position.set(0, 50, 3.6);
  group.add(screen);

  const ui = createDesktopUITexture();
  const uiPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(156, 74),
    new THREE.MeshBasicMaterial({ map: ui, transparent: true, opacity: 0.9 })
  );
  uiPlane.position.set(0, 50, 3.7);
  group.add(uiPlane);

  const glow = new THREE.RectAreaLight(0x66c8ff, 5.0, 160, 78);
  glow.position.set(0, 50, 5.2);
  glow.lookAt(0, 30, 30);
  group.add(glow);

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(20, 25, 6),
    new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.5 })
  );
  neck.position.set(0, 12, 0);
  group.add(neck);

  function animate(t) {
    const flick = 0.92 + Math.sin(t * 22.7) * 0.04 + Math.sin(t * 9.3) * 0.05;
    screenMat.emissiveIntensity = 1.05 * flick;
    glow.intensity = 4.6 * flick;
  }

  return { group, animate };
}

function createDesktopUITexture() {
  const ui = document.createElement("canvas");
  ui.width = 1024;
  ui.height = 512;
  const uctx = ui.getContext("2d");
  const grad = uctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#1b2c52");
  grad.addColorStop(1, "#0a1428");
  uctx.fillStyle = grad;
  uctx.fillRect(0, 0, 1024, 512);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 80 + col * 100;
      const y = 70 + row * 80;
      uctx.fillStyle = `hsla(${(row * 8 + col) * 18}, 80%, 65%, 0.85)`;
      uctx.fillRect(x, y, 38, 38);
      uctx.fillStyle = "rgba(255,255,255,0.5)";
      uctx.fillRect(x + 4, y + 4, 30, 4);
    }
  }
  uctx.fillStyle = "rgba(8,12,22,0.75)";
  uctx.fillRect(0, 472, 1024, 40);
  uctx.fillStyle = "rgba(255,255,255,0.75)";
  uctx.font = "bold 22px monospace";
  uctx.fillText("RUSTY-OS  ·  03:42  ·  ☾ sleep mode", 24, 498);

  const tex = new THREE.CanvasTexture(ui);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
