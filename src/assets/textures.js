import * as THREE from "three";
import {
  makeCanvas,
  toColorTexture,
  toDataTexture,
} from "../utils/canvas.js";

// ============================================================
//  Procedural texture factories.
//
//  Everything is rendered into a 2D canvas at runtime so the
//  project ships with zero binary assets and loads instantly.
//  Each factory returns either a THREE.Texture or a `{ map, ...maps }`
//  object so callers can mix them into MeshStandardMaterial.
// ============================================================

// ------- Wood (warm desk surface, robot body) ---------------
export function createWoodTextures(opts = {}) {
  const {
    hue = 28,
    sat = 55,
    light = 36,
    ringSpacing = 22,
    knotCount = 5,
  } = opts;
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6000; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const w = 80 + Math.random() * 240;
    const h = 0.6 + Math.random() * 1.4;
    const l = light + (Math.random() - 0.5) * 18;
    ctx.fillStyle = `hsla(${hue + (Math.random() - 0.5) * 8}, ${sat}%, ${l}%, 0.45)`;
    ctx.fillRect(x, y, w, h);
  }

  ctx.globalCompositeOperation = "source-over";
  for (let r = 0; r < size * 1.6; r += ringSpacing + Math.random() * 6) {
    ctx.beginPath();
    const cx = -size * 0.3 + Math.sin(r * 0.05) * 40;
    const cy = size * 0.55 + Math.cos(r * 0.04) * 60;
    ctx.ellipse(cx, cy, r, r * 1.6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${
      light - 14 + Math.random() * 6
    }%, 0.25)`;
    ctx.lineWidth = 1 + Math.random() * 1.2;
    ctx.stroke();
  }

  for (let i = 0; i < knotCount; i++) {
    const kx = Math.random() * size;
    const ky = Math.random() * size;
    const kr = 14 + Math.random() * 26;
    const g = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
    g.addColorStop(0, `hsl(${hue - 6}, ${sat}%, ${light - 22}%)`);
    g.addColorStop(0.7, `hsla(${hue}, ${sat}%, ${light - 8}%, 0.5)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fill();
  }

  const id = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    id.data[i] = Math.max(0, Math.min(255, id.data[i] + n));
    id.data[i + 1] = Math.max(0, Math.min(255, id.data[i + 1] + n * 0.9));
    id.data[i + 2] = Math.max(0, Math.min(255, id.data[i + 2] + n * 0.7));
  }
  ctx.putImageData(id, 0, 0);

  const r = makeCanvas(size);
  const rctx = r.getContext("2d");
  rctx.drawImage(c, 0, 0);
  rctx.globalCompositeOperation = "saturation";
  rctx.fillStyle = "#888";
  rctx.fillRect(0, 0, size, size);
  rctx.globalCompositeOperation = "source-over";
  rctx.fillStyle = "rgba(255,255,255,0.15)";
  rctx.fillRect(0, 0, size, size);

  return {
    map: toColorTexture(c, 1),
    roughnessMap: toDataTexture(r, 1),
  };
}

// ------- Paper (notebook pages) -----------------------------
export function createPaperTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#f7ecd0");
  g.addColorStop(1, "#e8d6a8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(${120 + Math.random() * 40}, ${
      90 + Math.random() * 30
    }, ${60 + Math.random() * 20}, ${0.04 + Math.random() * 0.08})`;
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      6 + Math.random() * 30,
      0.6
    );
  }

  ctx.strokeStyle = "rgba(80, 110, 180, 0.32)";
  ctx.lineWidth = 1;
  for (let y = 40; y < size; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 60, 80, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(56, 0);
  ctx.lineTo(56, size);
  ctx.stroke();

  ctx.strokeStyle = "rgba(40, 40, 60, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(120, 110);
  ctx.bezierCurveTo(160, 70, 220, 80, 250, 130);
  ctx.bezierCurveTo(280, 180, 220, 220, 180, 200);
  ctx.stroke();
  ctx.fillStyle = "rgba(40, 40, 60, 0.8)";
  ctx.font = "italic 22px serif";
  ctx.fillText("don't forget…", 110, 270);

  return toColorTexture(c, 1);
}

// ------- Brushed dark panel ---------------------------------
export function createDarkPanelTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#181a20";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 0.12;
    ctx.fillStyle = `rgba(255,255,255,${v})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  return toColorTexture(c, 4);
}

// ------- Keycap glyph (per character) -----------------------
export function createKeycapTexture(glyph) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#1c1d22";
  ctx.fillRect(0, 0, size, size);

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "rgba(255,255,255,0.18)");
  g.addColorStop(0.4, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  ctx.fillStyle = "#dde2ea";
  ctx.font = "bold 110px 'SF Pro Display', Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(120, 220, 255, 0.45)";
  ctx.shadowBlur = 18;
  ctx.fillText(glyph, size / 2, size / 2 + 6);

  return toColorTexture(c, 1);
}

// ------- Coffee mug glaze -----------------------------------
export function createMugTexture(colorA = "#3a7cb8", colorB = "#1f4b73") {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 130px 'SF Pro Display', Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("#1", size / 2, size / 2 - 8);
  ctx.font = "900 96px 'SF Pro Display', Inter, sans-serif";
  ctx.fillText("BOSS", size / 2, size / 2 + 110);
  ctx.restore();

  return toColorTexture(c, 1);
}

// ------- Studio PMREM environment for PBR reflections --------
export function createEnvironment(renderer) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");

  const g1 = ctx.createRadialGradient(
    size * 0.8,
    size * 0.25,
    10,
    size * 0.8,
    size * 0.25,
    size
  );
  g1.addColorStop(0, "#ffd5a0");
  g1.addColorStop(0.4, "#a85a18");
  g1.addColorStop(1, "#080808");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, size, size);

  const g2 = ctx.createRadialGradient(
    size * 0.15,
    size * 0.85,
    10,
    size * 0.15,
    size * 0.85,
    size * 0.9
  );
  g2.addColorStop(0, "rgba(120, 210, 255, 0.8)");
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return envMap;
}
