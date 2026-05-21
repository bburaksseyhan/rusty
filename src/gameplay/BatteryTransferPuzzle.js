import * as THREE from "three";
import { BT_RADIUS } from "../world/props/batteryTransferRig.js";

// ============================================================
//  Battery Transfer Puzzle — iki pil hücresi, iki makine.
//
//  Mekanik döngü:
//    1. Sol pili (A) topla            (E, A yakın)
//    2. CRT yan yuvasına tak           (E, CRT yuva yakın)
//    3. CRT açılır, ok + sembol        (yavaş yavaş)
//    4. Sağ pili (B) topla             (E, B yakın)
//    5. Kilit yuvasına tak             (E, lock yuva yakın)
//    6. Çekmece açılır + rampa iner    (LED'ler yeşile döner)
//       ödül + gizli yol görünür
//
//  Bütün geri bildirim ortamdan gelir (lambalar, LED'ler, ekran,
//  çekmece pozisyonu). Yüzen arayüz YOK. Kameranın puzzle sırasında
//  yaptığı sinematik blend yumuşaktır (max ~45% — eskiden 70% ile
//  ekrana çok yapışıyordu).
// ============================================================

const Phase = {
  AWAITING_CRT_BATTERY:  0,  // ikisi de yerinde, A'ya gidilmesi bekleniyor
  CARRYING_FOR_CRT:      1,  // A elde, CRT yuvasına yöneliniyor
  CRT_BOOTING:           2,  // A takılı, CRT açılıyor
  AWAITING_LOCK_BATTERY: 3,  // CRT açıldı, B bench'te bekliyor
  CARRYING_FOR_LOCK:     4,  // B elde, lock yuvasına yöneliniyor
  LOCK_UNLOCKING:        5,  // B takılı, drawer açılıyor
  COMPLETE:              6,
};

const CRT_BOOT_DURATION    = 8.0;
const LOCK_UNLOCK_DURATION = 4.2;
const E_DEBOUNCE_MS        = 280;

// Cinematic camera blend caps — kept low so the player keeps a
// usable third-person view during the puzzle moments. Previous
// values (0.70 / 0.60) crushed the camera right up to the screen.
const CRT_CAM_BLEND_MAX   = 0.42;
const DRAWER_CAM_BLEND_MAX = 0.38;

export class BatteryTransferPuzzle {
  constructor({ rig, player, subtitles, hintBadge, audio, emotion, cameraRig }) {
    this.rig       = rig;
    this.player    = player;
    this.subtitles = subtitles;
    this.hintBadge = hintBadge;
    this.audio     = audio;
    this.emotion   = emotion;
    this.cameraRig = cameraRig;

    this.phase   = Phase.AWAITING_CRT_BATTERY;
    this._bootT   = 0;
    this._unlockT = 0;
    this._redrawT = 0;
    this._lastEAt = 0;
    this._hintedIntro = false;
    this._lastClickInt = -1;
    this._onComplete = null;

    rig.setBatteryAVisible(true);
    rig.setBatteryBVisible(true);
    rig.setCarrying(false);
    rig.setCrtSocketArmed(false);
    rig.setLockSocketArmed(false);
    rig.setCrtSocketSeated?.(false);
    rig.setLockSocketSeated?.(false);
    rig.setLockLedsProgress(0);
    rig.setDrawerOpen(0);
    rig.revealReward(0);
    rig.setRampDeployed(0);
    rig.setCrtGlow(0);
  }

  /**
   * Register a callback that fires once when the lock unlock
   * sequence completes (drawer open, ramp deployed). Game.js uses
   * this to gate the post-level finale (notebook beacon → Bolt).
   * Bolt does NOT spawn from this callback directly — Game.js
   * waits for the player to walk to the notebook stack first.
   */
  onComplete(cb) {
    this._onComplete = cb;
    return this;
  }

  /** Returns true → Game.js should NOT show its default hint. */
  tryInteract() {
    const now = performance.now();
    if (now - this._lastEAt < E_DEBOUNCE_MS) return false;
    const pPos = this.player.root.position;
    const rig  = this.rig;

    // 1. Sol pili (A) yerden al — CRT slot'una gidecek
    if (this.phase === Phase.AWAITING_CRT_BATTERY) {
      const d = pPos.distanceTo(rig.anchors.batteryA());
      if (d < BT_RADIUS.pickupBattery + 1.8) {
        rig.setBatteryAVisible(false);
        rig.setCarrying(true);
        rig.setCrtSocketArmed(true);
        this.phase = Phase.CARRYING_FOR_CRT;
        this.audio?.crtCableSnap?.();
        this.subtitles?.show?.(
          "Cell A — warm copper, smells of old solder. The CRT is its home.",
          4400,
        );
        this.hintBadge?.show?.(
          "Slot cell A into the small CRT (left machine) — press E",
          12000,
        );
        this.emotion?.trigger?.("explore", 0.45);
        this._lastEAt = now;
        return true;
      }
      return this._tryIntro(pPos);
    }

    // 2. CRT yuvasına tak
    if (this.phase === Phase.CARRYING_FOR_CRT) {
      const d = pPos.distanceTo(rig.anchors.crtSocket());
      if (d < BT_RADIUS.crtSocket + 2) {
        rig.setCarrying(false);
        // Belirgin "klik" geri bildirimi: lamba katı yeşile döner ve
        // yuvada gerçek bir pil mesh'i belirir.
        rig.setCrtSocketSeated?.(true);
        this.phase  = Phase.CRT_BOOTING;
        this._bootT = 0;
        this.audio?.crtCableSnap?.();
        this.audio?.crtStaticClick?.();
        this.audio?.crtBootStart?.();
        this.subtitles?.show?.(
          "Click. Cell A seats. The CRT exhales blue dust and stretches awake.",
          4600,
        );
        this.emotion?.trigger?.("hope", 0.6);
        this._lastEAt = now;
        return true;
      }
      this.hintBadge?.show?.(
        "Cell A in hand. Press E next to the CRT's side socket (yellow lamp)",
        7000,
      );
      this._lastEAt = now;
      return true;
    }

    // 3. CRT bittikten sonra sağ pili (B) yerden al
    if (this.phase === Phase.AWAITING_LOCK_BATTERY) {
      const d = pPos.distanceTo(rig.anchors.batteryB());
      if (d < BT_RADIUS.pickupBattery + 1.8) {
        rig.setBatteryBVisible(false);
        rig.setCarrying(true);
        rig.setLockSocketArmed(true);
        this.phase = Phase.CARRYING_FOR_LOCK;
        this.audio?.crtCableSnap?.();
        this.subtitles?.show?.(
          "Cell B — heavier, colder. Made for the drawer's old relays.",
          4400,
        );
        this.hintBadge?.show?.(
          "Slot cell B into the drawer's side socket (right machine) — press E",
          12000,
        );
        this.emotion?.trigger?.("explore", 0.35);
        this._lastEAt = now;
        return true;
      }
      this.hintBadge?.show?.(
        "Pick up cell B (right of the bench) — press E next to it",
        7000,
      );
      this._lastEAt = now;
      return true;
    }

    // 4. Kilit yuvasına tak
    if (this.phase === Phase.CARRYING_FOR_LOCK) {
      const d = pPos.distanceTo(rig.anchors.lockSocket());
      if (d < BT_RADIUS.lockSocket + 2) {
        rig.setCarrying(false);
        rig.setLockSocketSeated?.(true);
        this.phase     = Phase.LOCK_UNLOCKING;
        this._unlockT  = 0;
        this._lastClickInt = -1;
        this.audio?.crtCableSnap?.();
        this.audio?.crtStaticClick?.();
        this.subtitles?.show?.(
          "Click. Relays cough awake. The drawer breathes. Old wood remembers a key.",
          4600,
        );
        this.emotion?.trigger?.("memory", 0.55);
        this._lastEAt = now;
        return true;
      }
      this.hintBadge?.show?.(
        "Cell B in hand. Press E next to the drawer's side socket (right machine)",
        7000,
      );
      this._lastEAt = now;
      return true;
    }

    return this._tryIntro(pPos);
  }

  update(dt, elapsedT) {
    const rig = this.rig;
    rig.animate(elapsedT);

    // Taşıma görseli — Rusty'nin başının üstüne yapışsın
    if (rig.carryBattery.visible) {
      const p = this.player.root.position;
      rig.carryBattery.position.set(
        p.x,
        p.y + 4.1 + Math.sin(elapsedT * 3.0) * 0.18,
        p.z,
      );
    }

    if (this.phase === Phase.CRT_BOOTING) {
      this._bootT += dt;
      const progress = THREE.MathUtils.clamp(this._bootT / CRT_BOOT_DURATION, 0, 1);
      const displayPhase = THREE.MathUtils.smoothstep(0, 1, progress);

      this._redrawT += dt;
      if (this._redrawT > 0.09 || progress >= 0.998) {
        this._redrawT = 0;
        rig.redrawCrt(displayPhase, elapsedT * 8 + progress * Math.PI * 4);
      }
      rig.setCrtGlow(displayPhase);

      this._cameraToScreen(progress);

      // Statik tıkları
      const tickInt = Math.floor(this._bootT * 5);
      if (tickInt !== this._lastClickInt && progress < 0.85) {
        this._lastClickInt = tickInt;
        this.audio?.crtStaticClick?.();
      }

      if (progress >= 1.0) {
        // CRT açıldı → kameraya bırak, ikinci pili istemek için
        // hint göster. Pil B hala bench'te durmaya devam ediyor.
        this.phase = Phase.AWAITING_LOCK_BATTERY;
        this.cameraRig?.setPovAssist?.(0);
        this.audio?.crtBootFinish?.();
        this.subtitles?.show?.(
          "The CRT spits a single arrow. Right of you, the drawer LEDs flicker once.",
          5600,
        );
        this.hintBadge?.show?.(
          "Pick up cell B from the bench, then slot it into the drawer — press E",
          14000,
        );
        this.emotion?.trigger?.("hope", 0.45);
      }
    } else if (this.phase === Phase.LOCK_UNLOCKING) {
      this._unlockT += dt;
      const p = THREE.MathUtils.clamp(this._unlockT / LOCK_UNLOCK_DURATION, 0, 1);
      rig.setLockLedsProgress(p);
      rig.setDrawerOpen(p);
      rig.revealReward(THREE.MathUtils.smoothstep(0.55, 1.0, p));
      rig.setRampDeployed(THREE.MathUtils.smoothstep(0.45, 1.0, p));
      this._cameraToDrawer(p);

      // Relay tıkları
      const tickInt = Math.floor(this._unlockT * 4);
      if (tickInt !== this._lastClickInt) {
        this._lastClickInt = tickInt;
        this.audio?.crtStaticClick?.();
      }

      if (p >= 1.0) this._finishLock();
    } else {
      this.cameraRig?.setPovAssist?.(0);
    }
  }

  // -----------------------------------------------------------
  _finishLock() {
    if (this.phase !== Phase.LOCK_UNLOCKING) return;
    this.phase = Phase.COMPLETE;
    this.cameraRig?.setPovAssist?.(0);
    this.audio?.hopeSwell?.();
    this.audio?.memoryReveal?.();
    this.subtitles?.show?.(
      "Drawer 04 opens. Inside: a single warm core — Kai's spare heart. A wooden ramp sighs into place.",
      6800,
    );
    this.hintBadge?.show?.(
      "Hidden path deployed — the desk has one more secret to give.",
      14000,
    );
    this.emotion?.gainConfidence?.(0.1);
    this.emotion?.trigger?.("memory", 0.95);
    this._onComplete?.();
  }

  _tryIntro(pPos) {
    if (this._hintedIntro) return false;
    const rigPos = this.rig.group.position;
    if (pPos.distanceTo(rigPos) > 24) return false;
    this._hintedIntro = true;
    this.subtitles?.show?.(
      "A workshop ledge: two cold machines, two warm cells. One for each socket.",
      5600,
    );
    return false; // intro fısıltısı E'yi tüketmez
  }

  /**
   * CRT açılış sinematiği — kamerayı ekrana doğru YUMUŞAK blend eder.
   * Eski max blend 0.7 idi, ekrana çok yapışıyordu; artık 0.42.
   */
  _cameraToScreen(progress) {
    const screen = this.rig.anchors.screenFace();
    const cam = screen.clone();
    // POV kamerasını da geriye çekiyoruz (önceden -7/+2.5/+4),
    // şimdi (-9/+3/+6) — daha geniş bir omuz açısı.
    cam.x -= 9;
    cam.y += 3.0;
    cam.z += 6;
    const blend = THREE.MathUtils.clamp(
      progress * 1.1 - 0.05,
      0,
      CRT_CAM_BLEND_MAX,
    );
    this.cameraRig?.setPovAssist?.(blend, cam, screen);
  }

  /**
   * Çekmece açılış sinematiği — yine geniş omuz açısı, daha az
   * yapışma. Eski max blend 0.6 idi → şimdi 0.38.
   */
  _cameraToDrawer(progress) {
    const lock = this.rig.anchors.lockSocket();
    const cam = lock.clone();
    cam.x += 6;
    cam.y += 3.0;
    cam.z += 9;
    const blend = Math.sin(progress * Math.PI) * DRAWER_CAM_BLEND_MAX;
    this.cameraRig?.setPovAssist?.(blend, cam, lock);
  }
}
