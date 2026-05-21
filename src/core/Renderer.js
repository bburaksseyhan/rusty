import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RENDER } from "./config.js";

// ============================================================
//  Renderer factory — encapsulates the WebGLRenderer setup so
//  the rest of the engine doesn't need to know about pixel ratios,
//  shadow types, or tone-mapping defaults.
// ============================================================

RectAreaLightUniformsLib.init();

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping happens in the PostFX chain.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  // PCFShadowMap is markedly cheaper than soft variant and the slight
  // edge crispness is invisible under bloom + DOF.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export function createCamera() {
  return new THREE.PerspectiveCamera(
    RENDER.fov,
    window.innerWidth / window.innerHeight,
    RENDER.nearPlane,
    RENDER.farPlane
  );
}
