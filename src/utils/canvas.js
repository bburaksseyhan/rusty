import * as THREE from "three";

// ============================================================
//  Canvas helpers
//  Tiny utility surface shared by every procedural texture so
//  we don't repeat the same boilerplate in each factory.
// ============================================================

export function makeCanvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

export function makeCanvasOf(width, height) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function toColorTexture(canvas, repeat = 1, anisotropy = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function toDataTexture(canvas, repeat = 1, anisotropy = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}
