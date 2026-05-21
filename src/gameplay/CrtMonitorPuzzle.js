import * as THREE from "three";
import {
  anchorWorldPosition,
  CRT_RADIUS,
  crtMarkBatteryCollected,
  looseBatteryWorldPos,
} from "../world/props/crtSecretMonitor.js";

/**
 * “Gizemli monitör” çevresel bulmaca — yüzen arayüz yok;
 * E tuşu + ortamda gezinme ile çözülür.
 *
 * Akış: hücreyi bul → CRT yuvasına tak → kablo kutusunu oturt →
 * güç adaptörünü aç → yavaş CRT açılışı + ekranda ipuçları.
 */

const Phase = {
  OFF:             0,
  HAVE_CELL:       1,
  SLOT_SEATED:     2,
  CABLES_SEATED:   3,
  BOOTING:         4,
  REVEALED:        5,
};

const BOOT_DURATION = 14.0;

export class CrtMonitorPuzzle {
  constructor({
    crt,
    player,
    subtitles,
    hintBadge,
    audio,
    emotion,
    cameraRig,
  }) {
    this.crt     = crt;
    this.player  = player;
    this.subtitles = subtitles;
    this.hintBadge = hintBadge;
    this.audio   = audio;
    this.emotion = emotion;
    this.cameraRig = cameraRig;

    this.phase = Phase.OFF;
    this._bootT = 0;
    this._redrawT = 0;
    this._staticPulseT = 0;
    this._hintedIntro = false;
    this._bootEnded = false;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  /**
   * E tuşu — true dönerse normal hedef brifingi bastırıldı.
   */
  tryInteract() {
    const pPos = this.player.root.position;

    // Pil bölgesinde E — yanlışlıkla hedef panelini tetiklemesin diye em.
    if (this.phase === Phase.OFF && this.crt.looseBatteryGroup.visible) {
      const dBat = pPos.distanceTo(looseBatteryWorldPos(this.crt));
      if (dBat < CRT_RADIUS.pickupBattery + 2.5) return true;
    }

    if (this.phase === Phase.HAVE_CELL) {
      const slot = anchorWorldPosition(this.crt, "slot");
      if (this._within(pPos, slot, CRT_RADIUS.insertSlot)) {
        this.phase = Phase.SLOT_SEATED;
        this.audio?.crtCableSnap();
        this.subtitles.show("The analogue cell settles into cold brass jaws behind the CRT's ribs.", 3600);
        this.hintBadge?.show(
          "Cables are loose beside the CRT. Seat the splitter box [E]",
          10000,
        );
        this.emotion?.trigger?.("memory", 0.65);
        return true;
      }
    }

    if (this.phase === Phase.SLOT_SEATED) {
      const junc = anchorWorldPosition(this.crt, "junction");
      if (this._within(pPos, junc, CRT_RADIUS.junction)) {
        this.phase = Phase.CABLES_SEATED;
        this.audio?.crtCableSnap();
        this.subtitles.show(
          "You thread cold copper fingers back into corroded jacks. LEDs breathe once.",
          4200,
        );
        this.hintBadge?.show("Flip the chunky desk adapter — restore mains [E]", 10000);
        return true;
      }
    }

    if (this.phase === Phase.CABLES_SEATED) {
      const strip = anchorWorldPosition(this.crt, "powerBrick");
      if (this._within(pPos, strip, CRT_RADIUS.powerStrip)) {
        this.phase = Phase.BOOTING;
        this._bootT = 0;
        this.audio?.crtBootStart?.();
        this.subtitles.show("Current crawls toward glass. Dust trembles.", 5200);
        this.emotion?.trigger?.("hope", 0.7);
        this.emotion?.trigger?.("explore", 0.25);
        return true;
      }
    }

    if (this.phase === Phase.OFF && !this._hintedIntro) {
      const crtRoot = this.crt.group.position;
      if (crtRoot.distanceTo(pPos) < 38) {
        this._hintedIntro = true;
        this.subtitles.show(
          "Someone left a CRT sleeping in cables. Something hums faintly under the grime.",
          5300,
        );
      }
    }

    return false;
  }

  update(dt, elapsedT) {
    const pPos = this.player.root.position;

    // —— Pil toplama (otomatik) ——
    if (this.phase === Phase.OFF && this.crt.looseBatteryGroup.visible) {
      const d = pPos.distanceTo(looseBatteryWorldPos(this.crt));
      if (d < CRT_RADIUS.pickupBattery) {
        this.phase = Phase.HAVE_CELL;
        crtMarkBatteryCollected(this.crt, true);
        this.audio?.wonder?.();
        this.subtitles.show(
          "A spare analogue cell rattles loose from the weave. It belongs in the CRT's ribs.",
          4800,
        );
        this.hintBadge?.show(
          "Press E at the CRT's sealed battery cradle (rear underside)",
          12000,
        );
        this.emotion?.trigger?.("explore", 0.45);
      }
    }

    if (this.phase === Phase.BOOTING) {
      this._bootT += dt;
      const progress = THREE.MathUtils.clamp(this._bootT / BOOT_DURATION, 0, 1);
      const displayPhase =
        THREE.MathUtils.smoothstep(0, 1, THREE.MathUtils.clamp(progress * 1.06 - 0.02, 0, 1));
      const glitchShake = elapsedT * 55 + progress * Math.PI * 24;

      this._redrawT += dt;
      if (this._redrawT > 0.08 || progress >= 0.995) {
        this._redrawT = 0;
        this.crt.redrawScreen(displayPhase, glitchShake);
      }

      this.crt.setBootGlow(
        THREE.MathUtils.smoothstep(0.12, 0.94, progress) +
          Math.sin(progress * Math.PI * 11) * 0.035,
      );

      this._applyCinematicCamera(progress);

      this._staticPulseT += dt;
      if (this._staticPulseT > 0.26 + Math.random() * 0.15) {
        this._staticPulseT = 0;
        if (progress < 0.72) this.audio?.crtStaticClick?.();
      }

      if (this._bootT >= BOOT_DURATION && !this._bootEnded) this._finishBoot();
    }

    if (this.phase !== Phase.BOOTING) this.cameraRig?.setPovAssist?.(0);
  }

  _finishBoot() {
    if (this.phase !== Phase.BOOTING || this._bootEnded) return;
    this._bootEnded = true;
    this.phase = Phase.REVEALED;
    this.crt.redrawScreen(1.0, 0);
    this.crt.setBootGlow(1.0);
    this.cameraRig?.setPovAssist?.(0);
    this.audio?.crtBootFinish?.();
    this.audio?.memoryReveal?.();
    setTimeout(() => this.audio?.hopeSwell?.(), 1600);

    const lines = [
      "On the CRT: scribbles of Kai's first Rusty drafts — arrows crawling across the wooden desk continents.",
      "The note fades but the route stays etched in glowing phosphor.",
    ];
    this.subtitles.scheduleOpening?.(lines, 9000);

    this.hintBadge?.show?.(
      "Secret route inscribed: keyboard → cables → mug → notebooks → monitor stand (-Z corridor)",
      16000,
    );
    this.emotion?.gainConfidence?.(0.08);
    this.emotion?.trigger?.("memory", 0.9);
  }

  _within(ref, target, radius) {
    const dx = ref.x - target.x;
    const dz = ref.z - target.z;
    const dy = Math.abs(ref.y - target.y);
    return Math.sqrt(dx * dx + dz * dz) < radius && dy < 9;
  }

  _applyCinematicCamera(progress) {
    const peak = THREE.MathUtils.smoothstep(0.12, 0.92, progress);

    const screenWp = this.crt.anchors.screenFace();
    const m = this.crt.group.matrixWorld;
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    m.decompose(pos, quat, scl);

    const off = this._tmp.set(-16 * (0.75 + peak * 0.35), 8 + peak * 5, -19 - peak * 6);
    off.applyQuaternion(quat);
    const camGoal = this._tmp2.copy(screenWp).add(off);

    // Cinematic blend caps softened — was max 0.82 (camera glued to
    // the screen, lost all third-person sense). Now max 0.48 so the
    // player still sees Rusty as the subject during the boot.
    const blend = Math.sin(progress * Math.PI) * 0.38 * peak + progress * 0.10;
    this.cameraRig?.setPovAssist?.(THREE.MathUtils.clamp(blend, 0, 0.48), camGoal, screenWp);
  }
}
