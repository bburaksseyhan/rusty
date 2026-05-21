// ============================================================
//  HintBadge — persistent top-center objective reminder.
//
//  Differs from Subtitles: it doesn't type, doesn't autohide
//  unless explicitly told to, and is intended as a passive
//  "current goal" reminder visible at a glance.
// ============================================================

export class HintBadge {
  constructor() {
    this._el = document.getElementById("hint-badge");
    this._textEl = document.getElementById("hint-badge-text");
    this._timer = null;
  }

  show(text, autoHideMs = 12000) {
    this._textEl.textContent = text;
    this._el.classList.add("show");
    this._el.setAttribute("aria-hidden", "false");
    clearTimeout(this._timer);
    if (autoHideMs > 0) {
      this._timer = setTimeout(() => this.hide(), autoHideMs);
    }
  }

  hide() {
    this._el.classList.remove("show");
    this._el.setAttribute("aria-hidden", "true");
    clearTimeout(this._timer);
  }
}
