import * as THREE from "three";

const HAMMER_RADIUS = 0.95;
const NAIL_COUNT_BADGE = "Çivi ustası — masadaki tüm çiviler çakıldı!";

const _nailWorld = new THREE.Vector3();
const _standBox = new THREE.Box3();

/**
 * Masa çivileri — başındaki platforma çıkınca (zıpla veya basamak) çakılır.
 */
export class DeskNails {
  constructor({ hintBadge, audio, subtitles }) {
    this.hintBadge = hintBadge;
    this.audio = audio;
    this.subtitles = subtitles;
    this.nails = [];
    this._badgeShown = false;
    this._wasGrounded = true;
  }

  add(nail) {
    nail._wasOnHead = false;
    this.nails.push(nail);
  }

  _standTop(nail) {
    nail.standPad.updateWorldMatrix(true, false);
    _standBox.setFromObject(nail.standPad);
    return _standBox.max.y;
  }

  _standCenterXZ(nail) {
    return {
      x: (_standBox.min.x + _standBox.max.x) * 0.5,
      z: (_standBox.min.z + _standBox.max.z) * 0.5,
    };
  }

  update(player, t) {
    const pos = player.root.position;
    const feetY = pos.y;
    const justLanded = player.grounded && !this._wasGrounded;
    this._wasGrounded = player.grounded;

    for (const nail of this.nails) {
      const topY = this._standTop(nail);
      const { x: cx, z: cz } = this._standCenterXZ(nail);
      const dist = Math.hypot(pos.x - cx, pos.z - cz);
      const onHead =
        player.grounded
        && dist < HAMMER_RADIUS
        && feetY >= topY - 0.35
        && feetY <= topY + 0.45;

      if (!nail.hammered) {
        const steppedUp = onHead && !nail._wasOnHead;
        if (onHead && player.grounded && (justLanded || steppedUp)) {
          nail.hammered = true;
          nail.hammerAt = t;
          this.audio?.memoryReveal?.();
        }
      }

      nail._wasOnHead = onHead;

      if (nail.hammered && nail.hammerAt != null) {
        const p = Math.min(1, (t - nail.hammerAt) * 4);
        const sink = p * 0.55;
        nail.head.position.y = nail.headY - sink;
        nail.standPad.position.y = nail.standPadY - sink;
        nail.head.rotation.x = p * 0.35;
      }
    }

    const done = this.nails.length > 0 && this.nails.every((n) => n.hammered);
    if (done && !this._badgeShown) {
      this._badgeShown = true;
      this.hintBadge?.show(NAIL_COUNT_BADGE, 10000);
      this.subtitles?.show("Her çivi yerinde. Kai'nin masası biraz daha sağlam.", 5000);
    }
  }
}
