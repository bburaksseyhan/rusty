import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ChromaticAberrationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  KernelSize,
} from "postprocessing";

import { POSTFX } from "../core/config.js";

// ============================================================
//  PostFX — bloom + renk düzeltme.
//
//  DepthOfFieldEffect kaldırıldı: Chrome/Safari'de her kare
//  glBlitFramebuffer "same depth attachment" hatası (×256) ve donma.
// ============================================================

export class PostFX {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.UnsignedByteType,
      multisampling: 0,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: POSTFX.bloom.threshold,
      luminanceSmoothing: POSTFX.bloom.smoothing,
      intensity: POSTFX.bloom.intensity,
      radius: POSTFX.bloom.radius,
      levels: 4,
      kernelSize: KernelSize.MEDIUM,
    });

    const ca = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(
        POSTFX.chromaticAberration[0],
        POSTFX.chromaticAberration[1],
      ),
    });

    const vignette = new VignetteEffect({
      eskil: false,
      offset: POSTFX.vignette.offset,
      darkness: POSTFX.vignette.darkness,
    });

    const noise = new NoiseEffect({
      premultiply: true,
      blendFunction: BlendFunction.SOFT_LIGHT,
    });
    noise.blendMode.opacity.value = POSTFX.noiseOpacity;

    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });

    this.composer.addPass(new EffectPass(camera, this.bloom));
    this.composer.addPass(new EffectPass(camera, ca));
    this.composer.addPass(new EffectPass(camera, vignette, noise, tone));
  }

  focusOn() {
    /* DOF kaldırıldı — no-op */
  }

  render(dt) {
    this.composer.render(dt);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }
}
