// ============================================================
//  Small math helpers shared across systems.
// ============================================================

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest-arc lerp between two radian angles. */
export function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return a + diff * t;
}

/** Convert a MIDI note number to a frequency in Hz. */
export function midiToHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}
