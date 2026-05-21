// ============================================================
//  Central tuning constants.
//  Designers and AI both touch this file. Keep it boring — only
//  numbers and small enums, no logic.
// ============================================================

export const RENDER = {
  pixelRatioCap: 1.25,   // was 1.6 — major fragment shading saving on retina
  fov: 38,
  nearPlane: 0.1,
  farPlane: 240,         // was 600 — desk fits inside; bigger frustum was wasted
  shadowMapSize: 1024,   // was 2048 — 4× cheaper shadow pass, barely visible
};

export const ATMOSPHERE = {
  // Slightly warmer / brighter night sky — was 0x05080d (near-black).
  // Keeps the cinematic mood but stops the desk from sinking into
  // pure black at the edges.
  background: 0x121b2c,
  // Fog tint pushed toward indigo-teal and density nearly halved so
  // mid-range props (mug, notebooks, monitor stand) stay readable
  // instead of dissolving into navy haze.
  fogColor: 0x1c2a44,
  fogDensity: 0.008,
  // PBR reflection strength — bumped from 0.45 so PBR materials
  // pick up environment colour and look less muddy.
  envIntensity: 0.7,
};

export const LIGHTING = {
  hemisphereSky: 0x8fb6e5,        // brighter sky tone (was 0x6a9bd8)
  hemisphereGround: 0x3a2e22,     // warmer bounce off the desk
  hemisphereIntensity: 0.45,      // was 0.22 — main readability boost
  deskLamp: {
    color: 0xffc080,              // slightly warmer / less orange
    intensity: 95,                // was 80
    position: [60, 92, 30],
    target: [-6, 0, -6],
    angle: Math.PI * 0.3,
    penumbra: 0.5,
    decay: 1.4,
    distance: 220,
  },
  fill: {
    color: 0xa8d4ff,              // brighter cool fill
    intensity: 0.55,              // was 0.32
    position: [80, 50, -10],
  },
  bounce: {
    color: 0xffb070,
    intensity: 0.28,              // was 0.16
    position: [0, -1, 30],
  },
};

export const PLAYER = {
  spawn: [-2, 6.5, 33],
  facing: Math.PI,
  startHealth: 3,
  radius: 0.7,
  height: 2.5,
  walkSpeed: 9,
  sprintSpeed: 18,
  jumpSpeed: 18,           // bumped from 16 — max jump height ~4.26u (was 3.37)
  gravity: 38,
  maxFallSpeed: 80,
  hitInvulnerability: 1.4,
  footstepInterval: { walk: 0.34, sprint: 0.22 },
  landingThresholdSpeed: 6,
  // Forgiving platforming windows
  coyoteTime: 0.12,        // s after leaving ground that jump still works
  jumpBuffer: 0.16,        // s of pre-land jump-press that auto-fires on land
};

export const CAMERA = {
  // yaw matches PLAYER.facing (π) so the camera spawns BEHIND Rusty,
  // looking toward the desk corridor (monitor side).
  initial: { yaw: Math.PI, pitch: 0.42, distance: 14 },
  // Lower bound bumped from -0.18 → 0.08. The previous value let
  // the camera dip ~2.5u below the player at distance=14, slicing
  // through the desk plane (y=0). Now even at max zoom (28u) the
  // camera stays a comfortable handful of units above the player.
  pitchRange: [0.08, 1.30],
  distanceRange: [5, 28],
  // Higher sensitivity for both drag and pointer-lock modes
  mouseSensitivity: { yaw: 0.0035, pitch: 0.0028 },
  pointerLockMultiplier: 1.35,
  zoomStep: 0.015,
  followLerp: 9,
  lookLerp: 14,
  handheldJitter: { x: 0.0035, y: 0.0025 },
  /**
   * How aggressively the camera yaw lerps toward the player's facing.
   * Effective rate is multiplied by max(0, forwardIntent), so this is
   * the rate when the player is walking *straight forward* into the
   * camera-forward axis. Strafe/reverse multiply to 0, no rotation.
   * direction while moving. Higher = more locked-on (recentres faster).
   * Set to 0 to disable auto-align entirely.
   */
  autoAlignRate: 1.6,
};

export const POSTFX = {
  // Threshold pushed back up (0.42 → 0.55) — too many mid-tone pixels
  // were entering bloom and bumping up post-process bandwidth.
  // Intensity raised slightly so the strong emitters (lamp, LEDs,
  // cells, beacon) keep their punch despite the higher threshold.
  bloom: { intensity: 1.25, threshold: 0.55, smoothing: 0.25, radius: 0.78 },
  dof: { focusRange: 6.0, bokehScale: 4.0 },
  chromaticAberration: [0.0006, 0.0010],
  // Softer vignette — was offset 0.32 / darkness 0.78. Old values
  // crushed the screen corners into near-black.
  vignette: { offset: 0.48, darkness: 0.55 },
  // Less filmic grain so mid-tones don't drown.
  noiseOpacity: 0.10,
};

export const HAZARD = {
  knockbackHoriz: 14,
  knockbackVert: 9,
  cooldownAfterHit: 0.8,
};

export const COLLECTIBLE = {
  pickupRadius: 1.0, // added to cell's own radius
};

// ---- Emotional system tuning --------------------------------
export const EMOTION = {
  // Decay rates (higher = faster return to baseline)
  decay: { curiosity: 0.14, fear: 0.20, hope: 0.06, loneliness: 0.03 },
  // Baselines before confidence boost
  base:  { curiosity: 0.18, fear: 0.0,  hope: 0.28, loneliness: 0.12 },
  // Confidence adds this fraction to curiosity/hope baselines at full (1.0)
  confidenceBoost: { curiosity: 0.22, hope: 0.30 },
  // Seconds player must be idle before loneliness starts accumulating
  idleThreshold: 6.0,
  // Radius to pick up a memory fragment
  fragmentPickupRadius: 3.5,
};
