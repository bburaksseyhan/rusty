// ============================================================
//  TitleScreen — title overlay + fake loading bar.
//
//  Exposes a promise-like `whenStarted(cb)` so Game can wait for
//  the user's "Begin" gesture before initializing audio.
// ============================================================

export class TitleScreen {
  constructor() {
    this._titleEl = document.getElementById("title-screen");
    this._appEl = document.getElementById("app");
    this._playBtn = document.getElementById("play-btn");
    this._loadingEl = document.getElementById("loading");
    this._loadingFillEl = document.getElementById("loading-fill");

    this._startCb = null;
    this._started = false;

    this._bind();
    this._runFakeLoad();
  }

  whenStarted(cb) {
    this._startCb = cb;
  }

  /** Dev / ?scene= — başlığı atla, oyuna gir */
  forceStart() {
    this._begin();
  }

  _bind() {
    this._playBtn.addEventListener("click", () => this._begin());
    window.addEventListener("keydown", (e) => {
      if (this._started) return;
      if (e.code === "Space" || e.code === "Enter") this._begin();
    });
  }

  _begin() {
    if (this._started) return;
    this._started = true;
    this._titleEl.classList.add("gone");
    this._appEl.classList.add("cinematic");
    // Ses motoru bu jest zincirinde açılmalı (mobil Safari).
    this._startCb?.();
  }

  _runFakeLoad() {
    let prog = 0;
    const handle = setInterval(() => {
      prog = Math.min(100, prog + 8 + Math.random() * 14);
      this._loadingFillEl.style.width = prog + "%";
      if (prog >= 100) {
        clearInterval(handle);
        setTimeout(() => this._loadingEl.classList.add("gone"), 280);
      }
    }, 110);
  }
}
