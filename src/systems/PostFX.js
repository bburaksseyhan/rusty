import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  DepthOfFieldEffect,
  VignetteEffect,
  NoiseEffect,
  ChromaticAberrationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  BlendFunction,
  KernelSize,
  SMAAPreset,
} from "postprocessing";

import { POSTFX } from "../core/config.js";

// ============================================================
//  PostFX — cinematic post-processing chain.
//
//  The library enforces ONE convolution effect per EffectPass,
//  so DOF / Bloom / ChromaticAberration each live in their own
//  pass. Non-convolutions are merged where possible.
// ============================================================

export class PostFX {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });

    this.bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: POSTFX.bloom.threshold,
      luminanceSmoothing: POSTFX.bloom.smoothing,
      intensity: POSTFX.bloom.intensity,
      radius: POSTFX.bloom.radius,
      // Levels 8 → 5, kernel LARGE → MEDIUM — bloom was the single
      // most expensive post-process pass; this cuts it ~50% with
      // barely perceptible quality loss because the desk scene
      // mostly has small/medium bloom sources (lamps, LEDs, cells).
      levels: 5,
      kernelSize: KernelSize.MEDIUM,
    });

    this.dof = new DepthOfFieldEffect(camera, {
      focusDistance: 14.0,
      focusRange: POSTFX.dof.focusRange,
      bokehScale: POSTFX.dof.bokehScale,
      height: 720,
    });

    const ca = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(
        POSTFX.chromaticAberration[0],
        POSTFX.chromaticAberration[1]
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

    // Khronos PBR Neutral tone mapping — preserves saturation and
    // mid-tones much better than ACES Filmic, which was crushing the
    // shadows and pushing the night scene to near-black. The cinematic
    // mood comes from the lighting + bloom + vignette stack; the tone
    // map's job is now just to keep highlights from clipping.
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });

    this.composer.addPass(new EffectPass(camera, smaa));
    this.composer.addPass(new EffectPass(camera, this.dof));
    this.composer.addPass(new EffectPass(camera, this.bloom));
    this.composer.addPass(new EffectPass(camera, ca));
    this.composer.addPass(new EffectPass(camera, vignette, noise, tone));
  }

  /** Drive DOF focus from current camera distance to the player. */
  focusOn(worldPos, cameraPos) {
    this.dof.focusDistance = cameraPos.distanceTo(worldPos);
  }

  render(dt) {
    this.composer.render(dt);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }
}
