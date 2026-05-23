// ============================================================
//  MobileControls — dokunmatik joystick, bakış alanı, aksiyon
//  butonları ve pinch-zoom (yalnızca coarse pointer cihazlarda).
// ============================================================

const JOY_RADIUS = 52;
const JOY_DEAD = 0.14;
const LOOK_SENS = 1.05;
const PINCH_ZOOM = 0.35;

export function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("mobile")) return true;
  return (
    window.matchMedia?.("(pointer: coarse)").matches === true ||
    window.matchMedia?.("(hover: none)").matches === true
  );
}

export class MobileControls {
  constructor({ input, audio }) {
    this.input = input;
    this._audio = audio;
    this._audioUnlocked = false;
    this._root = document.getElementById("mobile-controls");
    this._enabled = isCoarsePointer();

    if (!this._enabled || !this._root) {
      this._root?.remove();
      this._root = null;
      return;
    }

    this._visible = false;
    this._joyPointer = null;
    this._lookPointer = null;
    this._pinchDist = 0;

    this._joystick = this._root.querySelector(".mobile-joystick");
    this._joyBase = this._root.querySelector(".mobile-joy-base");
    this._joyKnob = this._root.querySelector(".mobile-joy-knob");
    this._lookZone = this._root.querySelector(".mobile-look");
    this._bindJoystick();
    this._bindLook();
    this._bindButtons();
    this._bindAudioUnlock();
    this.setVisible(false);
  }

  /** İlk dokunuşta sesi aç (Safari bazen yalnızca play butonunu yetmez sayar). */
  _bindAudioUnlock() {
    const tryUnlock = () => {
      if (this._audioUnlocked || !this._visible) return;
      this._audioUnlocked = true;
      this._audio?.initFromGesture?.();
      void this._audio?.unlock?.().then((ok) => {
        if (ok && !this._audio.musicPlaying) this._audio.startMusic();
      });
    };
    this._root.addEventListener("pointerdown", tryUnlock, { passive: true });
  }

  isActive() {
    return !!this._root;
  }

  setVisible(visible) {
    if (!this._root) return;
    this._visible = visible;
    this._root.classList.toggle("visible", visible);
    this._root.setAttribute("aria-hidden", visible ? "false" : "true");
    document.body.classList.toggle("mobile-controls-on", visible);
    if (!visible) this._releaseAll();
  }

  _releaseAll() {
    this._joyPointer = null;
    this._lookPointer = null;
    this._pinchDist = 0;
    this._resetKnob();
    this.input.setVirtualMove(0, 0);
    this.input.setVirtualSprint(false);
  }

  _bindJoystick() {
    const onMove = (e) => {
      if (this._joyPointer !== e.pointerId || !this._visible) return;
      const rect = this._joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_RADIUS) {
        dx = (dx / dist) * JOY_RADIUS;
        dy = (dy / dist) * JOY_RADIUS;
      }
      this._joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      let nx = dx / JOY_RADIUS;
      let ny = dy / JOY_RADIUS;
      if (Math.hypot(nx, ny) < JOY_DEAD) {
        nx = 0;
        ny = 0;
      }
      // ekran Y aşağı → oyun z geri
      this.input.setVirtualMove(nx, -ny);
    };

    const onEnd = (e) => {
      if (this._joyPointer !== e.pointerId) return;
      this._joyPointer = null;
      this._resetKnob();
      this.input.setVirtualMove(0, 0);
    };

    this._joystick.addEventListener("pointerdown", (e) => {
      if (!this._visible) return;
      e.preventDefault();
      this._joyPointer = e.pointerId;
      this._joystick.setPointerCapture(e.pointerId);
      onMove(e);
    });
    this._joystick.addEventListener("pointermove", onMove);
    this._joystick.addEventListener("pointerup", onEnd);
    this._joystick.addEventListener("pointercancel", onEnd);
  }

  _resetKnob() {
    if (this._joyKnob) this._joyKnob.style.transform = "translate(0, 0)";
  }

  _bindLook() {
    let lastX = 0;
    let lastY = 0;

    const onLookMove = (e) => {
      if (!this._visible) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return;

      if (e.pointerType === "touch" && e.isPrimary === false) return;

      if (this._lookPointer === e.pointerId) {
        this.input.addLookDelta(
          (e.clientX - lastX) * LOOK_SENS,
          (e.clientY - lastY) * LOOK_SENS
        );
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    this._lookZone.addEventListener("pointerdown", (e) => {
      if (!this._visible || e.pointerType === "mouse") return;
      if (this._lookPointer != null) return;
      e.preventDefault();
      this._lookPointer = e.pointerId;
      this._lookZone.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    this._lookZone.addEventListener("pointermove", onLookMove);

    const endLook = (e) => {
      if (this._lookPointer !== e.pointerId) return;
      this._lookPointer = null;
    };
    this._lookZone.addEventListener("pointerup", endLook);
    this._lookZone.addEventListener("pointercancel", endLook);

    this._lookZone.addEventListener(
      "touchmove",
      (e) => {
        if (!this._visible || e.touches.length < 2) return;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(
          t1.clientX - t0.clientX,
          t1.clientY - t0.clientY
        );
        if (this._pinchDist > 0) {
          this.input.addWheelDelta((this._pinchDist - dist) * PINCH_ZOOM);
        }
        this._pinchDist = dist;
        e.preventDefault();
      },
      { passive: false }
    );
    this._lookZone.addEventListener("touchend", () => {
      this._pinchDist = 0;
    });
  }

  _bindButtons() {
    const tap = (sel, fn) => {
      const el = this._root.querySelector(sel);
      if (!el) return;
      const fire = (e) => {
        if (!this._visible) return;
        e.preventDefault();
        fn();
      };
      el.addEventListener("pointerdown", fire);
    };

    tap(".mobile-btn-jump", () => this.input.queueJump());
    tap(".mobile-btn-interact", () => this.input.queueInteract());
    tap(".mobile-btn-story", () => this.input.queueStory());

    const sprint = this._root.querySelector(".mobile-btn-sprint");
    if (sprint) {
      const on = (e) => {
        if (!this._visible) return;
        e.preventDefault();
        this.input.setVirtualSprint(true);
      };
      const off = () => this.input.setVirtualSprint(false);
      sprint.addEventListener("pointerdown", on);
      sprint.addEventListener("pointerup", off);
      sprint.addEventListener("pointercancel", off);
      sprint.addEventListener("pointerleave", off);
    }
  }
}
