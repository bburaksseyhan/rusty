import * as THREE from "three";

const INTERACT_RADIUS = 8;
const NEAR_HINT_RADIUS = 11;
const STOMP_RADIUS = 1.0;

const _worldPos = new THREE.Vector3();
const _standBox = new THREE.Box3();

/**
 * Not defteri vidaları — tighten: E ile sık | stomp: çivi gibi zıpla.
 */
export class DeskScrews {
  constructor({ subtitles, audio, hintBadge, electricRig, onCountChange }) {
    this.subtitles = subtitles;
    this.audio = audio;
    this.hintBadge = hintBadge;
    this.electricRig = electricRig ?? null;
    this.onCountChange = onCountChange ?? (() => {});
    this.screws = [];
    this._hintCooldown = 0;
    this._wasGrounded = true;
  }

  add(screw) {
    this.screws.push(screw);
    this._emitCount();
  }

  get total() {
    return this.screws.length;
  }

  get tightenedCount() {
    return this.screws.filter((s) => s.tightened).length;
  }

  _emitCount() {
    this.onCountChange(this.tightenedCount, this.total);
  }

  _distXZ(playerPos, screw) {
    screw.group.getWorldPosition(_worldPos);
    return Math.hypot(playerPos.x - _worldPos.x, playerPos.z - _worldPos.z);
  }

  _nearestOpen(playerPos, variant = null) {
    let best = null;
    let bestD = Infinity;
    for (const screw of this.screws) {
      if (screw.tightened) continue;
      if (variant && screw.variant !== variant) continue;
      const d = this._distXZ(playerPos, screw);
      if (d < bestD) {
        bestD = d;
        best = screw;
      }
    }
    return { screw: best, dist: bestD };
  }

  _standTop(screw) {
    screw.standPad.updateWorldMatrix(true, false);
    _standBox.setFromObject(screw.standPad);
    return _standBox.max.y;
  }

  _standCenterXZ(screw) {
    return {
      x: (_standBox.min.x + _standBox.max.x) * 0.5,
      z: (_standBox.min.z + _standBox.max.z) * 0.5,
    };
  }

  _finishCircuit() {
    const total = this.total;
    this.subtitles?.show(
      "Dört vida da yerinde. Kablo not defterine kıvılcım gönderiyor.",
      4500,
    );
    this.hintBadge?.show("Devre tamam — not defteri yanı parlıyor", 8000);
  }

  _seal(screw, t, message) {
    if (screw.tightened) return;
    screw.tightened = true;
    screw.tightenAt = t;

    this.audio?.crtCableSnap?.();
    this.electricRig?.onScrewTightened();
    this.subtitles?.show(message, 2400);
    this._emitCount();

    if (this.tightenedCount >= this.total) {
      this._finishCircuit();
    }
  }

  _updateStomp(player, playerPos, t, justLanded) {
    for (const screw of this.screws) {
      if (screw.variant !== "stomp" || screw.tightened || !screw.standPad) continue;

      const topY = this._standTop(screw);
      const { x: cx, z: cz } = this._standCenterXZ(screw);
      const dist = Math.hypot(playerPos.x - cx, playerPos.z - cz);
      const feetY = playerPos.y;
      const onHead =
        dist < STOMP_RADIUS
        && feetY >= topY - 0.35
        && feetY <= topY + 0.45;

      const steppedUp = onHead && !screw._wasOnHead;
      if (onHead && player.grounded && (justLanded || steppedUp)) {
        this._seal(screw, t, "Vida çakıldı — devreye bağlandı.");
        this.audio?.memoryReveal?.();
      }
      screw._wasOnHead = onHead;
    }
  }

  _animateTightened(t) {
    for (const s of this.screws) {
      if (!s.tightened || s.tightenAt == null) continue;
      const p = Math.min(1, (t - s.tightenAt) * 5);
      if (p >= 1) continue;

      const sink = s.variant === "stomp" ? p * 0.55 : p * 0.18;
      s.head.position.y = s.headY - sink;
      if (s.standPad) s.standPad.position.y = s.standPadY - sink;
      if (s.variant === "stomp") {
        s.head.rotation.x = p * 0.35;
      } else {
        s.head.rotation.y = p * 0.55;
      }
      if (s.head.material?.emissive) {
        s.head.material.emissive.setHex(s.variant === "stomp" ? 0xffaa44 : 0x66ccff);
        s.head.material.emissiveIntensity = 0.2 + p * 0.7;
      }
    }
  }

  update(player, t, dt) {
    const playerPos = player.root.position;
    const justLanded = player.grounded && !this._wasGrounded;
    this._wasGrounded = player.grounded;

    const near = this._nearestOpen(playerPos);
    if (near.screw && near.dist < NEAR_HINT_RADIUS) {
      this._hintCooldown -= dt;
      if (this._hintCooldown <= 0) {
        this._hintCooldown = 2.8;
        const msg =
          near.screw.variant === "stomp"
            ? "Altın vida — başına zıpla (çivi gibi)"
            : "Gümüş vida — yakında E ile sık";
        this.hintBadge?.show(msg, 3200);
      }
    } else {
      this._hintCooldown = 0;
    }

    this._updateStomp(player, playerPos, t, justLanded);
    this._animateTightened(t);
  }

  tryInteract(playerPos, t) {
    const { screw, dist } = this._nearestOpen(playerPos, "tighten");
    if (!screw || dist > INTERACT_RADIUS) return false;

    const n = this.tightenedCount + 1;
    const total = this.total;
    this._seal(screw, t, `Vida sıkıldı. Devre ${n}/${total}.`);
    return true;
  }
}
