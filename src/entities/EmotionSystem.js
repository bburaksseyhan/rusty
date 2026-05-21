import * as THREE from "three";

// ============================================================
//  EmotionSystem — Rusty's inner life.
//
//  Four orthogonal emotion dimensions (each 0–1), each with its
//  own decay rate and baseline. Emotions influence:
//    - Eye color, size, and intensity
//    - Body trembling (fear), arm droop (loneliness),
//      upward float (hope), head tilt (curiosity)
//    - Audio and camera hints (read by Game.js)
//    - Confidence: a persistent stat that grows as the
//      player collects cells and finds memories, subtly
//      increasing baselines over time.
//
//  Design principles:
//    - No direct Three.js mutations here — pure data layer.
//    - Robot.js reads this.derived every frame and applies it.
//    - Game.js calls trigger() on gameplay events.
// ============================================================

// Canonical eye color targets per mood (RGB 0-1).
const EYE_COLORS = {
  neutral:  { r: 1.00, g: 0.68, b: 0.34 }, // warm amber
  curious:  { r: 0.92, g: 0.96, b: 1.00 }, // cool bright white
  fearful:  { r: 0.22, g: 0.50, b: 1.00 }, // cold blue
  hopeful:  { r: 1.00, g: 0.82, b: 0.22 }, // golden yellow
  lonely:   { r: 0.55, g: 0.40, b: 0.90 }, // muted violet
  danger:   { r: 1.00, g: 0.12, b: 0.08 }, // warning red
};

export class EmotionSystem {
  constructor() {
    // ---- Core emotion weights (0–1) ----
    this.e = {
      curiosity:  0.3,
      fear:       0.0,
      hope:       0.4,
      loneliness: 0.15,
    };

    // Accumulated confidence (0–1). Grows with progress and is
    // never reset — embodies Rusty's emotional growth arc.
    this.confidence = 0.0;

    // ---- Derived values read by Robot.js each frame ----
    this.derived = {
      eyeColor:      new THREE.Color(1.00, 0.68, 0.34),
      eyeIntensity:  2.2,
      eyeScale:      1.0,   // pupil radius multiplier (0.6 – 1.5)
      bodyTremble:   0.0,   // amplitude of rapid micro-shakes
      headTilt:      0.0,   // target head Z-rotation (radians)
      armDroop:      0.0,   // arm pivot Z-rotation offset (radians)
      hopeBob:       0.0,   // additive Y on body
      mood:          "neutral",
    };

    // ---- Internal animation state ----
    this._eyeColorTarget  = new THREE.Color(1.00, 0.68, 0.34);
    this._eyeIntTarget    = 2.2;
    this._flickerTimer    = 0;
    this._flickerState    = 1.0;
    this._idleTimer       = 0; // time since last movement, triggers loneliness
    this._dangerTimer     = 0; // how long a hazard has been nearby
  }

  // ----------------------------------------------------------
  //  Public API
  // ----------------------------------------------------------

  /** Current dominant mood string (used by Robot.js switch). */
  get mood() {
    return this.derived.mood;
  }

  /**
   * Spike an emotion from a gameplay event.
   * @param {'collect'|'hit'|'memory'|'dark'|'light'|'hazard'|'jump'|'idle'|'explore'} type
   * @param {number} magnitude  0.0 – 1.0
   */
  trigger(type, magnitude = 1.0) {
    const m = magnitude;
    const { e } = this;
    switch (type) {
      case "collect":
        e.hope       = clamp01(e.hope       + 0.45 * m);
        e.curiosity  = clamp01(e.curiosity  + 0.20 * m);
        e.fear       = clamp01(e.fear       - 0.15 * m);
        this.confidence = clamp01(this.confidence + 0.07);
        break;

      case "hit":
        e.fear       = clamp01(e.fear       + 0.70 * m);
        e.hope       = clamp01(e.hope       - 0.25 * m);
        this._dangerTimer = 2.0;
        break;

      case "memory":
        e.loneliness = clamp01(e.loneliness + 0.60 * m);
        e.hope       = clamp01(e.hope       + 0.35 * m);
        e.curiosity  = clamp01(e.curiosity  + 0.20 * m);
        this.confidence = clamp01(this.confidence + 0.15);
        break;

      case "dark":
        e.fear       = clamp01(e.fear       + 0.30 * m);
        e.loneliness = clamp01(e.loneliness + 0.10 * m);
        break;

      case "light":
        e.fear       = clamp01(e.fear       - 0.25 * m);
        e.hope       = clamp01(e.hope       + 0.18 * m);
        break;

      case "hazard":
        e.fear       = clamp01(e.fear       + 0.50 * m);
        this._dangerTimer = Math.max(this._dangerTimer, 1.5 * m);
        break;

      case "jump":
        e.curiosity  = clamp01(e.curiosity  + 0.08 * m);
        break;

      case "idle":
        e.loneliness = clamp01(e.loneliness + 0.06 * m);
        break;

      case "explore":
        e.curiosity  = clamp01(e.curiosity  + 0.18 * m);
        e.loneliness = clamp01(e.loneliness - 0.05 * m);
        break;
    }
  }

  /** Called by Player.js each frame. */
  update(dt, { moving = false } = {}) {
    // ---- Decay towards confidence-adjusted baselines ----
    const conf = this.confidence;
    const baseline = {
      curiosity:  0.18 + conf * 0.22, // more confident → more curious
      fear:       0.0,
      hope:       0.28 + conf * 0.30, // more progress → more hopeful
      loneliness: 0.12,
    };
    const decay = {
      curiosity:  0.14,
      fear:       0.20, // fear fades quickly
      hope:       0.06, // hope lingers
      loneliness: 0.03, // loneliness is sticky
    };
    for (const k of Object.keys(this.e)) {
      const diff = this.e[k] - baseline[k];
      this.e[k] = baseline[k] + diff * Math.max(0, 1 - decay[k] * dt);
      this.e[k] = clamp01(this.e[k]);
    }

    // Idle loneliness — being still accumulates it
    this._idleTimer = moving ? 0 : this._idleTimer + dt;
    if (this._idleTimer > 6.0) {
      this.e.loneliness = clamp01(this.e.loneliness + 0.008 * dt);
    }

    // Danger timer fade
    if (this._dangerTimer > 0) this._dangerTimer -= dt;

    // ---- Dominant mood ----
    const { curiosity, fear, hope, loneliness } = this.e;
    const maxVal = Math.max(curiosity, fear, hope, loneliness);
    let mood = "neutral";
    if (maxVal > 0.22) {
      if (this._dangerTimer > 0)    mood = "danger";
      else if (maxVal === fear)     mood = "fearful";
      else if (maxVal === curiosity) mood = "curious";
      else if (maxVal === hope)     mood = "hopeful";
      else if (maxVal === loneliness) mood = "lonely";
    }
    this.derived.mood = mood;

    // ---- Eye color target ----
    const ec = EYE_COLORS[mood] ?? EYE_COLORS.neutral;
    this._eyeColorTarget.setRGB(ec.r, ec.g, ec.b);
    this.derived.eyeColor.lerp(this._eyeColorTarget, Math.min(1, dt * 3.0));

    // ---- Eye intensity ----
    this._eyeIntTarget = 0.8
      + hope       * 2.2
      + curiosity  * 1.6
      - fear       * 0.6
      - loneliness * 0.5;
    this._eyeIntTarget = Math.max(0.25, this._eyeIntTarget);

    // Fear flicker
    if (fear > 0.25) {
      this._flickerTimer += dt;
      if (this._flickerTimer > 0.06 + Math.random() * 0.10) {
        this._flickerTimer = 0;
        this._flickerState = 0.4 + Math.random() * 0.6;
      }
      this._eyeIntTarget *= this._flickerState;
    } else {
      this._flickerState += (1 - this._flickerState) * Math.min(1, dt * 5);
    }
    this.derived.eyeIntensity += (this._eyeIntTarget - this.derived.eyeIntensity) * Math.min(1, dt * 4);

    // ---- Eye pupil scale ----
    const targetScale = 1.0
      + curiosity  * 0.55  // wide eyes: curiosity
      - fear       * 0.40  // narrow: fear
      + hope       * 0.15; // slightly open: hope
    this.derived.eyeScale += (clamp(targetScale, 0.5, 1.6) - this.derived.eyeScale) * Math.min(1, dt * 3.5);

    // ---- Body animation values ----
    this.derived.bodyTremble = fear * 0.014;
    this.derived.headTilt    = curiosity * 0.30 - loneliness * 0.08;
    this.derived.armDroop    = loneliness * 0.38;
    this.derived.hopeBob     = hope * 0.018;
  }

  /**
   * Add to long-term confidence (0–1), e.g. after beating a level.
   * @param {number} amount  typically 0.05 – 0.35
   */
  gainConfidence(amount) {
    this.confidence = clamp01(this.confidence + amount);
  }

  // Convenience wrappers called by Game.js
  onCellCollected() { this.trigger("collect"); }
  onHit()           { this.trigger("hit"); }
  onMemoryFound()   { this.trigger("memory"); }
}

// ---- Utilities -----------------------------------------------
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
