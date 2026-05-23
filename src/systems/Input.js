// ============================================================
//  Input — tiny, polled-once-per-frame keyboard/mouse abstraction.
//
//  Game loop reads via:
//    input.isDown("KeyW")
//    input.isSprinting()
//    input.consumeJump()        // edge-trigger (one-shot)
//
//  Mouse modes (auto-selected):
//    1. Pointer Lock  — primary. Click the canvas once and the
//                       cursor disappears; mouse movement steers
//                       the camera continuously. ESC releases.
//    2. Drag fallback — if pointer lock is unavailable (or the
//                       user has released it), holding LMB and
//                       dragging still steers the camera.
//
//  Both modes write into `mouseDelta`, which CameraRig consumes
//  and resets each frame.
// ============================================================

export class Input {
  constructor(dom) {
    this.dom = dom;
    this._keys = new Set();
    this._jumpQueued     = false;
    this._interactQueued = false;
    this._storyQueued    = false; // Q — Rusty tells their story + waves
    this.mouseDelta = { x: 0, y: 0 };
    this.wheelDelta = 0;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._virtualMove = { x: 0, z: 0 };
    this._virtualSprint = false;

    this._pointerLocked = false;
    this._enabled = true;

    this._bind();
  }

  /** Pause all gameplay input (ending overlay, menus, etc.). */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this._resetState();
  }

  isEnabled() {
    return this._enabled;
  }

  _resetState() {
    this._keys.clear();
    this._jumpQueued = false;
    this._interactQueued = false;
    this._storyQueued = false;
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.wheelDelta = 0;
    this._dragging = false;
    this._virtualMove.x = 0;
    this._virtualMove.z = 0;
    this._virtualSprint = false;
  }

  /** Sanal joystick: x = sağ (+), z = ileri (+). */
  setVirtualMove(x, z) {
    this._virtualMove.x = x;
    this._virtualMove.z = z;
  }

  setVirtualSprint(active) {
    this._virtualSprint = !!active;
  }

  /** Mobil bakış alanı — CameraRig mouseDelta ile birleşir. */
  addLookDelta(dx, dy) {
    this.mouseDelta.x += dx;
    this.mouseDelta.y += dy;
  }

  addWheelDelta(delta) {
    this.wheelDelta += delta;
  }

  /**
   * Klavye + sanal stick birleşimi (kamera-yatay düzlemde x/z).
   * Uzunluk >1 ise normalize edilir.
   */
  getMovementStick() {
    let x = 0;
    let z = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) z += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) z -= 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;

    const vx = this._virtualMove.x;
    const vz = this._virtualMove.z;
    if (vx !== 0 || vz !== 0) {
      x = vx;
      z = vz;
    }

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  /** True if the browser has acquired pointer lock on our canvas. */
  isPointerLocked() {
    return this._pointerLocked;
  }

  isDown(code) {
    return this._keys.has(code);
  }
  isSprinting() {
    return (
      this._virtualSprint ||
      this._keys.has("ShiftLeft") ||
      this._keys.has("ShiftRight")
    );
  }

  queueJump() {
    this._jumpQueued = true;
  }
  queueInteract() {
    this._interactQueued = true;
  }
  queueStory() {
    this._storyQueued = true;
  }

  /** One-shot jump trigger that resets after read. */
  consumeJump() {
    if (this._jumpQueued) {
      this._jumpQueued = false;
      return true;
    }
    return false;
  }

  /** Edge-trigger for the E interaction key. */
  consumeInteract() {
    if (this._interactQueued) {
      this._interactQueued = false;
      return true;
    }
    return false;
  }

  /** Edge-trigger for the Q story key. */
  consumeStory() {
    if (this._storyQueued) {
      this._storyQueued = false;
      return true;
    }
    return false;
  }

  /** Returns and resets mouse delta accumulated since last call. */
  consumeMouseDelta() {
    const out = { x: this.mouseDelta.x, y: this.mouseDelta.y };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return out;
  }

  consumeWheelDelta() {
    const out = this.wheelDelta;
    this.wheelDelta = 0;
    return out;
  }

  // ----------------------------------------------------------
  _bind() {
    window.addEventListener("keydown", (e) => {
      if (!this._enabled) return;
      // Browsers fire keydown repeatedly while the key is held;
      // ignore repeats so edge-triggers stay edge-triggers.
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        this._jumpQueued = true;
      }
      if (e.code === "KeyE") {
        this._interactQueued = true;
      }
      if (e.code === "KeyQ") {
        this._storyQueued = true;
      }
      this._keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (!this._enabled) return;
      this._keys.delete(e.code);
    });

    // ---- Pointer lock (primary) + drag fallback ----
    //
    // Clicking the canvas requests pointer lock; once granted the
    // cursor is hidden and `movementX/Y` accumulates each frame.
    // If the user is mid-drag (or pointer lock fails / is exited)
    // we gracefully fall back to LMB-drag steering.
    document.addEventListener("pointerlockchange", () => {
      this._pointerLocked = document.pointerLockElement === this.dom;
    });

    this.dom.addEventListener("mousedown", (e) => {
      if (!this._enabled) return;
      if (!this._pointerLocked) {
        // Request pointer lock on user gesture. Rejects with
        // WrongDocumentError in embedded / iframe previews (Cursor,
        // CodePen, etc.) — we catch and rely on LMB-drag fallback.
        const req = this.dom.requestPointerLock?.bind(this.dom);
        if (req) {
          try {
            const p = req();
            if (p && typeof p.catch === "function") {
              p.catch(() => {});
            }
          } catch {
            /* sync throw — ignore */
          }
        }
        // Drag fallback always starts; works when lock is denied.
        this._dragging = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
      }
    });
    window.addEventListener("mouseup", () => (this._dragging = false));

    window.addEventListener("mousemove", (e) => {
      if (!this._enabled) return;
      if (this._pointerLocked) {
        // movementX/Y is the delta from the last event, regardless
        // of the cursor position (cursor is hidden).
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
        return;
      }
      if (!this._dragging) return;
      this.mouseDelta.x += e.clientX - this._lastX;
      this.mouseDelta.y += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });

    this.dom.addEventListener(
      "wheel",
      (e) => {
        if (!this._enabled) return;
        this.wheelDelta += e.deltaY;
        e.preventDefault();
      },
      { passive: false }
    );

  }
}
