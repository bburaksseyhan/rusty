import * as THREE from "three";

// ============================================================
//  MaterialLibrary — central registry of PBR materials shared
//  across props. Reusing one MeshStandardMaterial across many
//  meshes lets Three.js batch render state changes and keeps
//  the scene cheap on the GPU.
//
//  Recipes are lazily created on first access and cached forever
//  (we only have one level — disposal isn't needed yet).
// ============================================================

class MaterialLibrary {
  constructor() {
    this._cache = new Map();
  }

  _memo(key, factory) {
    if (!this._cache.has(key)) this._cache.set(key, factory());
    return this._cache.get(key);
  }

  // ---- metals ---------------------------------------------------
  metalBright() {
    return this._memo(
      "metal:bright",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xc8ccd2,
          roughness: 0.4,
          metalness: 0.95,
        })
    );
  }
  metalChrome() {
    return this._memo(
      "metal:chrome",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xe1e6ed,
          roughness: 0.2,
          metalness: 1.0,
        })
    );
  }
  metalDark() {
    return this._memo(
      "metal:dark",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x404448,
          roughness: 0.4,
          metalness: 0.7,
        })
    );
  }
  metalAluminum() {
    return this._memo(
      "metal:aluminum",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x1a1c22,
          roughness: 0.35,
          metalness: 0.85,
        })
    );
  }

  // ---- plastics & casings --------------------------------------
  plasticBlack() {
    return this._memo(
      "plastic:black",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x101216,
          roughness: 0.35,
          metalness: 0.4,
        })
    );
  }
  plasticBezel() {
    return this._memo(
      "plastic:bezel",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x0a0c10,
          roughness: 0.7,
        })
    );
  }
  plasticKeycap() {
    return this._memo(
      "plastic:keycap",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x202126,
          roughness: 0.55,
          metalness: 0.3,
        })
    );
  }

  // ---- fabrics & soft ------------------------------------------
  mousepadFabric() {
    return this._memo(
      "fabric:mousepad",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x0a0c12,
          roughness: 0.95,
          metalness: 0.02,
        })
    );
  }

  // ---- emissive RGB strip --------------------------------------
  /**
   * Returns a *new* emissive material every call because we
   * animate the color per-instance.
   */
  rgbStrip(initialColor = 0x6633ff, intensity = 2.4) {
    return new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: initialColor,
      emissiveIntensity: intensity,
      roughness: 0.2,
    });
  }

  /** Glowing capsule/LED core. */
  glow(color, intensity = 2.0) {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.3,
    });
  }

  // ---- generic factories (cached by argument) ------------------
  flat(color, { roughness = 0.6, metalness = 0.0 } = {}) {
    const key = `flat:${color}:${roughness}:${metalness}`;
    return this._memo(
      key,
      () =>
        new THREE.MeshStandardMaterial({
          color,
          roughness,
          metalness,
        })
    );
  }

  // ---- semi-transparent --------------------------------------
  glass() {
    return this._memo(
      "glass:halo",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x66dfff,
          emissive: 0x2090c0,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.18,
          roughness: 0.1,
          metalness: 0.3,
        })
    );
  }
}

export const Materials = new MaterialLibrary();
