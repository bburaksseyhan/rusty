import * as THREE from "three";

/**
 * Gizemli CRT istasyonu — çevresel bulmaca prop'u (kütüphanede tutulabilir bileşenler).
 *
 * Dış dünya `CrtMonitorPuzzle` ile koordine olur:
 * - Ekran canvas'ı faz (boot) için yeniden çizilir
 * - Bağlantı kutusu ve güç adaptörü E ile kullanıcıya bağlanmak üzere konumları verir
 */

const CANVAS_W = 640;
const CANVAS_H = 480;

/** World-space etkileşim yarıçapları (Rusty masa ölçeğinde). */
export const CRT_RADIUS = {
  pickupBattery:   3.8,
  insertSlot:      6.0,
  junction:        5.5,
  powerStrip:      5.0,
};

export function createCrtSecretMonitor() {
  const group = new THREE.Group();
  group.name = "CrtSecretStation";

  // --- Canvas ana ekran ---
  const canvas = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  drawScreenPoweredOff(ctx);
  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter;

  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.85, metalness: 0.15 })
  );
  stand.position.set(0, 0.9, 1);
  stand.castShadow = true;
  stand.receiveShadow = true;
  stand.userData.collide = true;
  stand.userData.colliderType = "platform";
  group.add(stand);

  const bodyGeo = new THREE.BoxGeometry(16, 12, 10);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2824,
    roughness: 0.72,
    metalness: 0.25,
    emissive: 0x000000,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 7.4, -1);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.88,
    metalness: 0.05,
  });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(14.2, 9.8, 0.6), bezelMat);
  bezel.position.set(0, 7.35, 3.95);
  group.add(bezel);

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    color: 0xffffff,
    emissive: new THREE.Color(0x001008),
    emissiveIntensity: 0.06,
    roughness: 0.35,
    metalness: 0.02,
    transparent: false,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 7.9), screenMat);
  screen.position.set(0, 7.35, 4.12);
  group.add(screen);

  const crtGlow = new THREE.PointLight(0x4af0c8, 0, 42, 1.85);
  crtGlow.position.copy(screen.position);
  crtGlow.position.z += 6;
  group.add(crtGlow);

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2.8, 4),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.65 })
  );
  neck.position.set(2, 1.95, -0.8);
  group.add(neck);

  buildCableTangle(group);

  const junctionMat = new THREE.MeshStandardMaterial({ color: 0x353430, roughness: 0.55, metalness: 0.4 });
  const junctionBox = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.4), junctionMat);
  junctionBox.position.set(9.5, 1.05, -2);
  junctionBox.rotation.y = 0.25;
  junctionBox.castShadow = true;
  group.add(junctionBox);

  const brickMat = new THREE.MeshStandardMaterial({ color: 0x303238, roughness: 0.6, metalness: 0.5 });
  const brick = new THREE.Mesh(new THREE.BoxGeometry(6, 1.9, 3.8), brickMat);
  brick.position.set(11.2, 0.95, -6.5);
  brick.rotation.y = -0.2;
  brick.castShadow = true;
  group.add(brick);

  const amber = new THREE.MeshStandardMaterial({
    color: 0xc9942a,
    emissive: 0x884400,
    emissiveIntensity: 0.95,
    roughness: 0.35,
    metalness: 0.55,
  });
  const battCap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.45, 12), amber);
  const battBody = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.85, 16), amber);
  battBody.position.y = 1.1;
  const looseBattery = new THREE.Group();
  looseBattery.name = "CrtLooseBattery";
  looseBattery.add(battCap);
  looseBattery.add(battBody);
  battCap.position.y = 2.08;
  const battLight = new THREE.PointLight(0xff9944, 1.25, 9, 1.9);
  battLight.position.set(0, 1.05, 0);
  looseBattery.add(battLight);
  looseBattery.position.set(-11, 1.08, -4.8);
  looseBattery.rotation.z = Math.PI / 9;
  group.add(looseBattery);

  buildDustMotes(group, screen.position);

  // Yerel çıpa noktaları (sırt yuvasına yakın, kablo deliği, elektrik sırasında kontrol için)
  const slotAnchor    = new THREE.Vector3(-3.8, 4.9, -2);
  const junctionAnch  = junctionBox.position.clone();
  junctionAnch.y += 0.35;
  const stripAnch = brick.position.clone();
  stripAnch.y += 0.92;

  const api = {
    group,
    screenMat,
    screenTex,
    ctx,
    crtGlow,
    looseBatteryGroup: looseBattery,

    redrawScreen(displayPhase, glitchT = 0) {
      redrawCrtFace(ctx, displayPhase, glitchT);
      screenTex.needsUpdate = true;
    },

    anchors: {
      slot: slotAnchor,
      junction: junctionAnch,
      powerBrick: stripAnch,
      looseBattery: () => looseBattery.getWorldPosition(new THREE.Vector3()),
      screenFace: () => screen.getWorldPosition(new THREE.Vector3()),
    },

    /** Ekranı gören kamera yakın-planı için. */
    screenMesh: screen,
    setBootGlow(intensityMul) {
      const base = THREE.MathUtils.clamp(intensityMul, 0, 1);
      screenMat.emissive.setRGB(base * 0.15 + 0.01, base * 0.45 + base * base * 0.25, base * 0.35);
      screenMat.emissiveIntensity = 0.12 + base * 4.8;
      crtGlow.intensity      = base * 3.8;
      crtGlow.distance       = 38 + base * 32;
      crtGlow.decay          = base > 0.3 ? 1.45 : crtGlow.decay;
    },

    animate(t /*, dt */) {
      if (typeof api._dustPulse === "function") api._dustPulse();
      if (looseBattery.visible) pulseBattery(looseBattery, battLight, t);
    },

    dispose() {
      screenTex.dispose();
      screenMat.dispose();
    },
  };


  api._dustPulse = addDustMotesPulse(group);

  return api;
}

/**
 * Loose battery picked — animasyon güncellemesini nötrler.
 */
export function crtMarkBatteryCollected(api, collected) {
  if (!api.looseBatteryGroup) return;
  api.looseBatteryGroup.visible = !collected;
}

function pulseBattery(looseBattery, battLight, t) {
  if (!looseBattery.visible) return;
  const p = Math.sin(t * 2.1) * 0.5 + 0.5;
  battLight.intensity = 1.0 + p * 0.55;
}

function buildCableTangle(g) {
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f24,
    roughness: 0.55,
    metalness: 0.85,
  });
  for (let i = 0; i < 9; i++) {
    const r = THREE.MathUtils.randFloat(1.8, 3.8);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.14, 6, 32),
      wireMat
    );
    torus.position.set(-4 + i * 0.85, THREE.MathUtils.randFloat(1.8, 2.9), THREE.MathUtils.randFloat(-8, -2));
    torus.rotation.set(
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI)
    );
    torus.receiveShadow = true;
    g.add(torus);
  }
}

function buildDustMotes(group, scrPos /* reference */ ) {
  const n = 65;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3 + 0] = THREE.MathUtils.randFloatSpread(18);
    pos[i * 3 + 1] = THREE.MathUtils.randFloat(5, 13);
    pos[i * 3 + 2] = THREE.MathUtils.randFloat(0, 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xb8dfff,
      size: 0.22,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  pts.position.set(scrPos.x - 6, scrPos.y, scrPos.z - 12);
  group.add(pts);
  return pts;
}

function addDustMotesPulse(group) {
  let pts = null;
  group.traverse((ch) => {
    if (ch.isPoints) pts = ch;
  });
  if (!pts) return () => {};
  const geo = pts.geometry.attributes.position.array;
  return () => {
    const t = performance.now() * 0.0009;
    for (let i = 0; i < geo.length; i += 3) {
      geo[i + 1] += Math.sin(t + i) * 0.002;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  };
}

export function looseBatteryWorldPos(api) {
  const v = new THREE.Vector3();
  return api.looseBatteryGroup.getWorldPosition(v);
}

export function anchorWorldPosition(api, name) {
  if (typeof api.anchors[name] === "function") return api.anchors[name]();
  const ls = api.anchors[name].clone().applyMatrix4(api.group.matrixWorld);
  return ls;
}

/** displayPhase ∈ [0,1] çizilmiş final reveal oranı için. */
export function redrawCrtFace(ctx, displayPhase /* 0–1 */, glitchTime) {
  const w = CANVAS_W;
  const h = CANVAS_H;
  ctx.save();
  ctx.fillStyle = "#020405";
  ctx.fillRect(0, 0, w, h);

  const glitch = glitchTime * Math.PI;

  const staticAmt = THREE.MathUtils.lerp(0.98, 0.05, THREE.MathUtils.clamp((displayPhase - 0.1) / 0.35, 0, 1));
  if (staticAmt > 0.02 && displayPhase < 0.94) drawStatic(ctx, w, h, staticAmt, glitch);
  scanlines(ctx, w, h, glitch);

  if (displayPhase > 0.12) scribbleRustySketch(ctx, w, h, glitch, THREE.MathUtils.clamp(displayPhase / 0.92, 0, 1));
  if (displayPhase > 0.35) drawKaiGlyph(ctx, w, h);
  if (displayPhase > 0.52) arrowsAndDeskMap(ctx, w, h, glitch);
  if (displayPhase > 0.7) handwrittenNote(ctx, w, h);

  vignetteCRT(ctx, w, h);

  ctx.restore();
}

export function drawScreenPoweredOff(ctx) {
  redrawCrtFace(ctx, 0.0, 0);
}

function drawStatic(ctx, w, h, amount, glitch) {
  const a = THREE.MathUtils.clamp(amount, 0, 1);
  if (a < 0.02) return;
  ctx.save();
  const blocks = Math.min(920, Math.floor(a * 700));
  for (let i = 0; i < blocks; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = Math.random() * 4 + (a > 0.65 ? 2 : 0);
    const base = Math.random() * 255 * a;
    ctx.fillStyle = `rgb(${base},${base * (1 + Math.sin(glitch + i) * 0.08)},${base * 0.92})`;
    ctx.globalAlpha = 0.12 + Math.random() * 0.5 * a;
    ctx.fillRect(x, y, s, s + Math.random());
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function scribbleRustySketch(ctx, w, h, g, sketchAlpha) {
  ctx.save();
  ctx.globalAlpha = sketchAlpha * 0.94;
  ctx.strokeStyle = `rgba(${120 + Math.sin(g) * 30},220,245,${0.35 + sketchAlpha * 0.45})`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.rect(w * 0.14, h * 0.16, w * 0.28, h * 0.46);
  ctx.stroke();
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.18 + k * w * 0.04 + Math.sin(k + g) * 10, h * 0.5);
    ctx.lineTo(w * 0.2 + k * w * 0.028, h * 0.75 + Math.cos(k + g * 3) * 9);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(210,235,185,0.55)";
  ctx.beginPath();
  ctx.arc(w * 0.32, h * 0.28, h * 0.07, Math.PI * 0.08, Math.PI * 2.1 + g * 0.12);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeRect(w * 0.17, h * 0.18, w * 0.22, h * 0.14);
  ctx.fillStyle = "rgba(230,248,210,0.14)";
  ctx.font = `${14 + sketchAlpha * 6}px monospace`;
  ctx.fillText("RUST–Y  v?", w * 0.16, h * 0.27);
  ctx.restore();
}

function drawKaiGlyph(ctx, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(250,248,232,0.55)";
  ctx.lineWidth = 2.3;
  ctx.font = "bold 72px monospace";
  ctx.strokeText("KAI", w * 0.58, h * 0.35);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "rgba(145,238,228,0.22)";
  ctx.fillText("KAI", w * 0.58 + 6, h * 0.35 + 6);
  ctx.restore();
}

function arrowsAndDeskMap(ctx, w, h, glitch) {
  ctx.save();
  ctx.strokeStyle = "rgba(120,236,216,0.65)";
  ctx.lineWidth = 2.8;
  const ax = w * 0.48;
  const ay = h * 0.58;

  arrow(ctx, ax, ay, ax + w * 0.18, ay - h * 0.12);
  ctx.font = `${15 + Math.round(Math.abs(Math.sin(glitch)))}px monospace`;
  ctx.fillStyle = "rgba(240,246,238,0.65)";
  ctx.fillText("KLAVYE ⇢ USB ⇢ PAD ⇢ FARE", w * 0.06, ay - h * 0.14);
  arrow(ctx, w * 0.22, h * 0.42, w * 0.65, h * 0.86);
  ctx.fillText("⇣ KUPA  ⇣ DEFTER  ⇣ SON DURAK  (-Z koridor)", w * 0.1, h * 0.9);
  dashGrid(ctx, w, h);

  ctx.fillStyle = "rgba(245,238,218,0.38)";
  ctx.font = "12px monospace";
  ctx.fillText("↓ zımbaların altında gizli kablo kanalı", w * 0.5, h * 0.2);
  ctx.restore();
}

function handwrittenNote(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(251,239,218,0.78)";
  ctx.font = 'italic 19px Georgia, serif';
  const lines = [
    "Rusty uyanırsa —",
    "en parlak kabloyu takip et.",
    "Bolt'u bitiremedim.",
    "Üzgünüm. — Kai",
  ];
  let y = h * 0.34;
  for (const ln of lines) {
    ctx.fillText(ln, w * 0.52 + Math.sin(y * 0.02) * 3, y);
    y += 26;
  }
  ctx.restore();
}

function dashGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(50,210,176,0.15)";
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.15);
    ctx.lineTo(x, h * 0.98);
    ctx.stroke();
  }
  for (let y = h * 0.24; y < h * 0.98; y += 48) {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y);
    ctx.lineTo(w * 0.92, y);
    ctx.stroke();
  }
  ctx.restore();
}

function scanlines(ctx, w, h, glitch) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let y = 0; y < h; y += 2) {
    const a = (y % 4 === 0 ? 0.08 : 0.04) + Math.sin(glitch + y * 0.02) * 0.025;
    ctx.fillStyle = `rgba(10,42,62,${a})`;
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

function vignetteCRT(ctx, w, h) {
  const rg = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.18, w * 0.5, h * 0.5, w * 0.58);
  rg.addColorStop(0.0, "rgba(255,255,255,0)");
  rg.addColorStop(0.65, "rgba(0,4,14,0.25)");
  rg.addColorStop(1.0, "rgba(0,0,0,0.86)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function arrow(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const head = 12;
  ctx.lineTo(x1 - head * Math.cos(ang - 0.5), y1 - head * Math.sin(ang - 0.5));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(ang + 0.5), y1 - head * Math.sin(ang + 0.5));
  ctx.stroke();
}
