import * as THREE from "three";

const INTERACT_RADIUS = 14;

/**
 * Masa üstü aç/kapa — fan, monitör (E tuşu, yakındayken).
 */
export class DeskToggles {
  constructor({ subtitles, audio }) {
    this.subtitles = subtitles;
    this.audio = audio;
    this.fans = [];
    this.monitors = [];
  }

  addFan(prop) {
    if (prop?.toggle) this.fans.push(prop);
  }

  addMonitor(prop) {
    if (prop?.toggle) this.monitors.push(prop);
  }

  _distXZ(playerPos, prop) {
    const p = prop.group.position;
    return Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
  }

  tryInteract(playerPos) {
    for (const fan of this.fans) {
      if (this._distXZ(playerPos, fan) < INTERACT_RADIUS) {
        const on = fan.toggle();
        this.subtitles?.show(on ? "Fan çalışıyor." : "Fan durdu.", 2800);
        this.audio?.robotBlip?.(1.1);
        return true;
      }
    }

    for (const mon of this.monitors) {
      if (this._distXZ(playerPos, mon) < INTERACT_RADIUS + 20) {
        const on = mon.toggle();
        this.subtitles?.show(
          on ? "Monitör uyandı." : "Monitör uyku moduna geçti.",
          2800,
        );
        this.audio?.robotBlip?.(0.95);
        return true;
      }
    }

    return false;
  }
}
