import * as THREE from "three";

// ============================================================
//  Window with rain — nighttime backdrop with animated rain
//  streaks, distant city silhouette, and a cool moon-light wash.
// ============================================================

const W = 110;
const H = 90;
const RAIN_COUNT = 600;
const FRAME_BORDER = 2.0;

export function createWindow() {
  const group = new THREE.Group();
  group.name = "Window";

  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: createNightSkyTexture(), fog: false })
  );
  pane.position.y = H / 2 + 6;
  group.add(pane);

  addFrame(group);
  const rain = addRain(group);

  const moon = new THREE.RectAreaLight(0x6aa8ff, 2.2, W, H);
  moon.position.set(0, H / 2 + 6, 0.3);
  moon.lookAt(0, H / 2, -10);
  group.add(moon);

  function animate(t, dt) {
    const pos = rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      let y = pos.getY(i);
      let y2 = pos.getY(i + 1);
      y -= dt * 40;
      y2 -= dt * 40;
      if (y2 < 6) {
        y = Math.random() * H + 6 + H;
        y2 = y - 1.6;
      }
      pos.setY(i, y);
      pos.setY(i + 1, y2);
    }
    pos.needsUpdate = true;
  }

  return { group, animate };
}

function createNightSkyTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");

  const sg = ctx.createLinearGradient(0, 0, 0, 512);
  sg.addColorStop(0, "#1a2b4c");
  sg.addColorStop(0.55, "#0e1a30");
  sg.addColorStop(1, "#06091a");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(220, 240, 255, ${0.3 + Math.random() * 0.6})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 240, 1, 1);
  }

  // City silhouette
  ctx.fillStyle = "#02050a";
  for (let x = 0; x < 512; x += 8) {
    const h = 60 + Math.random() * 120;
    ctx.fillRect(x, 512 - h, 8, h);
  }

  // Window lights
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle =
      Math.random() < 0.85
        ? `rgba(255, 210, 130, ${0.4 + Math.random() * 0.4})`
        : `rgba(150, 200, 255, ${0.4 + Math.random() * 0.4})`;
    const x = Math.floor(Math.random() * 64) * 8;
    const y = 380 + Math.random() * 120;
    ctx.fillRect(x + 2, y, 3, 3);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addFrame(group) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1c1e22,
    roughness: 0.4,
    metalness: 0.4,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 4, FRAME_BORDER, 2), mat);
  top.position.set(0, H + 6 + FRAME_BORDER / 2, 0.5);
  group.add(top);

  const bot = top.clone();
  bot.position.set(0, 6 - FRAME_BORDER / 2, 0.5);
  group.add(bot);

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(FRAME_BORDER, H + 4, 2),
    mat
  );
  left.position.set(-W / 2 - FRAME_BORDER / 2, H / 2 + 6, 0.5);
  group.add(left);

  const right = left.clone();
  right.position.x = W / 2 + FRAME_BORDER / 2;
  group.add(right);

  const midH = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, 2), mat);
  midH.position.set(0, H / 2 + 6, 0.5);
  group.add(midH);

  const midV = new THREE.Mesh(new THREE.BoxGeometry(0.8, H, 2), mat);
  midV.position.set(0, H / 2 + 6, 0.5);
  group.add(midV);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(W + 8, 1.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.6 })
  );
  sill.position.set(0, 6, 1.6);
  group.add(sill);
}

function addRain(group) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * W;
    const y = Math.random() * H + 6;
    const z = 0.5 + Math.random() * 1.5;
    pos[i * 6 + 0] = x;
    pos[i * 6 + 1] = y;
    pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x + 0.3;
    pos[i * 6 + 4] = y - 1.6;
    pos[i * 6 + 5] = z;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x88c8ff,
    transparent: true,
    opacity: 0.45,
    fog: false,
  });
  const rain = new THREE.LineSegments(geo, mat);
  group.add(rain);
  return rain;
}
