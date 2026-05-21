import * as THREE from "three";
import { Materials } from "../../assets/materials.js";
import { createKeycapTexture } from "../../assets/textures.js";

// ============================================================
//  RGB Mechanical Keyboard
//
//  3 rows × 6 columns of keycaps with WASD glowing prominently
//  to teach the player which keys move them. Each cap is
//  collidable so the player can platform across the keys.
// ============================================================

const ROWS = ["1234QE", "WASDFR", "ZXC ↵⇧"];
const GLOW_KEYS = new Set(["W", "A", "S", "D"]);
const KEY_W = 6.2;
const KEY_H = 4.8;
const GAP = 0.9;
const COLS = 6;

const GLOW_HUES = { W: 0.92, A: 0.05, S: 0.55, D: 0.35 };

export function createKeyboard() {
  const group = new THREE.Group();
  group.name = "Keyboard";

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(50, 1.4, 20),
    new THREE.MeshStandardMaterial({
      color: 0x0e0f12,
      roughness: 0.55,
      metalness: 0.45,
    })
  );
  base.position.set(0, 0.7, 0);
  base.castShadow = base.receiveShadow = true;
  base.userData.collide = true;
  base.userData.colliderType = "platform";
  group.add(base);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(48.5, 0.4, 18.5),
    Materials.metalAluminum()
  );
  tray.position.set(0, 1.41, 0);
  group.add(tray);

  // RGB underglow strip — animated via `animate(t, dt)`
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xff0066,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(50.5, 0.25, 20.5), stripMat);
  strip.position.set(0, 0.18, 0);
  group.add(strip);

  const totalW = COLS * KEY_W + (COLS - 1) * GAP;
  const x0 = -totalW / 2 + KEY_W / 2;
  const z0 = -(ROWS.length * (KEY_H + GAP) - GAP) / 2 + KEY_H / 2;

  ROWS.forEach((row, ri) => {
    for (let ci = 0; ci < COLS; ci++) {
      const ch = row[ci];
      const x = x0 + ci * (KEY_W + GAP);
      const z = z0 + ri * (KEY_H + GAP);
      buildKey(group, ch, x, z, ri, ci);
    }
  });

  function animate(t) {
    stripMat.emissive.setHSL((t * 0.05) % 1, 1, 0.55);
  }
  return { group, animate };
}

function buildKey(group, ch, x, z, ri, ci) {
  const isGlow = GLOW_KEYS.has(ch);
  const topTex = createKeycapTexture(ch);

  const sideMat = new THREE.MeshStandardMaterial({
    color: isGlow ? 0x1a1a22 : 0x202126,
    roughness: 0.55,
    metalness: 0.3,
    emissive: isGlow ? 0x331a3a : 0x000000,
    emissiveIntensity: isGlow ? 0.6 : 0.0,
  });
  const topMat = new THREE.MeshStandardMaterial({
    map: topTex,
    roughness: 0.55,
    metalness: 0.25,
    emissive: isGlow ? 0xff66cc : 0x000000,
    emissiveIntensity: isGlow ? 0.45 : 0.0,
  });

  const cap = new THREE.Mesh(new THREE.BoxGeometry(KEY_W, 4.2, KEY_H), [
    sideMat, sideMat, topMat, sideMat, sideMat, sideMat,
  ]);
  cap.position.set(x, 1.4 + 2.1, z);
  cap.castShadow = cap.receiveShadow = true;
  cap.userData.collide = true;
  cap.userData.colliderType = "platform";
  group.add(cap);

  const hue = isGlow ? GLOW_HUES[ch] : ((ci + ri * 3) % 10) / 10;
  const ledColor = new THREE.Color().setHSL(hue, 1, isGlow ? 0.65 : 0.5);
  const led = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: ledColor,
      emissiveIntensity: isGlow ? 3.0 : 1.6,
      roughness: 0.4,
    })
  );
  led.rotation.x = -Math.PI / 2;
  led.position.set(x, 1.43, z + KEY_H / 2 - 0.6);
  group.add(led);

  if (isGlow) {
    const halo = new THREE.PointLight(ledColor, 1.0, 8, 2);
    halo.position.set(x, 6.3, z);
    group.add(halo);
  }
}
