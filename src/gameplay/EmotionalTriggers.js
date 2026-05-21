import * as THREE from "three";

// ============================================================
//  EmotionalTriggers — zone-based environmental emotion system.
//
//  Defines spatial zones across the desk world. Each frame the
//  player's position is tested against each zone, and the
//  matching zone's emotion is applied to the EmotionSystem.
//
//  Design goals:
//    - Comfort near the warm desk lamp    → hope / calm
//    - Loneliness near the rainy window   → loneliness
//    - Fear near spinning fans            → fear
//    - Awe on top of tall objects         → curiosity
//    - Unease in dark / far mid-desk areas → mild fear
//
//  Zones fire at most once per COOLDOWN seconds to avoid spam.
// ============================================================

const TRIGGER_COOLDOWN = 8.0; // seconds between re-fires for the same zone
const CHECK_INTERVAL   = 0.25; // only re-evaluate zones every N seconds

const ZONES = [
  // --- Safety: warm desk lamp (target [60,0,30] area) ---
  {
    id: "lamp_warm",
    center: new THREE.Vector3(40, 0, 20),
    radius: 30,
    emotion: "light",
    magnitude: 0.7,
    audioEvent: "hopeSwell",
    enterSubtitle: "The warm light feels safe. Like a hand over a small flame.",
  },
  // --- Loneliness: near the rainy window ---
  {
    id: "window_rain",
    center: new THREE.Vector3(80, 0, -10),
    radius: 28,
    emotion: "idle",
    magnitude: 1.0,
    audioEvent: null,
    enterSubtitle: "Outside, rain taps the glass. The world beyond is vast and cold.",
  },
  // --- Fear: near the left fan hazard ---
  {
    id: "fan_left",
    center: new THREE.Vector3(-40, 0, -10),
    radius: 22,
    emotion: "hazard",
    magnitude: 0.9,
    audioEvent: "fearAmbience",
    enterSubtitle: "Something large is spinning nearby. The air tastes of electricity.",
  },
  // --- Fear: near the right fan hazard ---
  {
    id: "fan_right",
    center: new THREE.Vector3(34, 0, 6),
    radius: 22,
    emotion: "hazard",
    magnitude: 0.85,
    audioEvent: "fearAmbience",
    enterSubtitle: "The blades cut the dark air like a terrible clock.",
  },
  // --- Awe: high altitude (top of mug, mouse, notebooks, stand) ---
  {
    id: "high_ground",
    center: new THREE.Vector3(0, 0, 0), // height-based, see _checkZone
    radius: Infinity,
    minHeight: 6.0,
    emotion: "explore",
    magnitude: 0.8,
    audioEvent: "wonder",
    enterSubtitle: "From up here, the desk looks like a whole planet.",
  },
  // --- Dark mid-desk: the cable zone / open floor ---
  {
    id: "mid_dark",
    center: new THREE.Vector3(4, 0, 10),
    radius: 14,
    emotion: "dark",
    magnitude: 0.4,
    audioEvent: null,
    enterSubtitle: "The desk stretches endlessly in every direction. It is a lonely feeling.",
  },
  // --- Curiosity: RGB keyboard glow ---
  {
    id: "keyboard_glow",
    center: new THREE.Vector3(-2, 0, 30),
    radius: 18,
    emotion: "explore",
    magnitude: 0.6,
    audioEvent: null,
    enterSubtitle: null,
  },
  // --- Monitor glow: hope / wonder ---
  {
    id: "monitor_glow",
    center: new THREE.Vector3(0, 0, -68),
    radius: 22,
    emotion: "explore",
    magnitude: 0.9,
    audioEvent: "wonder",
    enterSubtitle: "The monitor flickers. Like a lighthouse seen from far away.",
  },
];

export class EmotionalTriggers {
  /**
   * @param {object} options
   * @param {function} options.onSubtitle  callback(text, durationMs)
   * @param {object}   options.audio       Audio instance
   */
  constructor({ onSubtitle, audio }) {
    this._onSubtitle = onSubtitle;
    this._audio      = audio;
    this._cooldowns  = {};  // zoneId → time remaining
    this._inZone     = {};  // zoneId → bool
    this._checkTimer = 0;

    // Reset cooldowns
    for (const z of ZONES) {
      this._cooldowns[z.id] = 0;
      this._inZone[z.id] = false;
    }
  }

  /**
   * Called every frame from Game._tick().
   * @param {THREE.Vector3} playerPos
   * @param {EmotionSystem} emotionSystem
   * @param {number} dt
   */
  update(playerPos, emotionSystem, dt) {
    // Tick cooldowns
    for (const id of Object.keys(this._cooldowns)) {
      if (this._cooldowns[id] > 0) this._cooldowns[id] -= dt;
    }

    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = CHECK_INTERVAL;

    for (const zone of ZONES) {
      const inside = this._isInsideZone(playerPos, zone);

      // Rising edge — just entered
      if (inside && !this._inZone[zone.id]) {
        this._inZone[zone.id] = true;
        this._fireZone(zone, emotionSystem);
      }

      // Falling edge — just left
      if (!inside && this._inZone[zone.id]) {
        this._inZone[zone.id] = false;
      }
    }
  }

  _isInsideZone(pos, zone) {
    if (zone.minHeight !== undefined) {
      return pos.y >= zone.minHeight;
    }
    return pos.distanceTo(zone.center) <= zone.radius;
  }

  _fireZone(zone, emotionSystem) {
    if (this._cooldowns[zone.id] > 0) return;
    this._cooldowns[zone.id] = TRIGGER_COOLDOWN;

    emotionSystem.trigger(zone.emotion, zone.magnitude);

    if (zone.audioEvent && this._audio) {
      const method = this._audio[zone.audioEvent];
      if (typeof method === "function") method.call(this._audio);
    }

    if (zone.enterSubtitle && this._onSubtitle) {
      this._onSubtitle(zone.enterSubtitle, 4000);
    }
  }
}
