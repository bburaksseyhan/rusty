// ============================================================
//  Subtitles — fading italic story whispers.
//
//  Two modes:
//    - show(text, ms)       → snap-in / fade-out story whisper
//    - speak(text, opts)    → typewriter, with per-char callback
//                             (used for the robot voice on E)
//
//  Owns its own DOM element and a single show-timer + typing
//  interval so back-to-back triggers cancel cleanly.
// ============================================================

const SILENT_CHARS = /[\s.,!?…—-]/;

export class Subtitles {
  constructor() {
    this._el = document.getElementById("subtitle");
    this._textEl = document.getElementById("subtitle-text");
    this._showTimer = null;
    this._typingInterval = null;
  }

  show(text, durationMs = 4000) {
    this._cancelTyping();
    this._textEl.textContent = text;
    this._el.classList.add("show");
    clearTimeout(this._showTimer);
    this._showTimer = setTimeout(
      () => this._el.classList.remove("show"),
      durationMs
    );
  }

  hide() {
    this._cancelTyping();
    this._el.classList.remove("show");
    this._el.classList.remove("typing");
    clearTimeout(this._showTimer);
  }

  /**
   * Type `text` character-by-character. `onChar` fires for each
   * visible (non-whitespace/punctuation) character — used by the
   * Game to play a robot blip per letter.
   *
   * Returns the total speech duration in ms so callers can chain
   * subtitle holds with the speech ending.
   */
  speak(text, { perCharMs = 45, holdMs = 3500, onChar } = {}) {
    this._cancelTyping();
    this._textEl.textContent = "";
    this._el.classList.add("show", "typing");
    clearTimeout(this._showTimer);

    let i = 0;
    this._typingInterval = setInterval(() => {
      if (i >= text.length) {
        this._cancelTyping();
        this._el.classList.remove("typing");
        this._showTimer = setTimeout(
          () => this._el.classList.remove("show"),
          holdMs
        );
        return;
      }
      const ch = text[i];
      this._textEl.textContent += ch;
      if (onChar && !SILENT_CHARS.test(ch)) onChar(ch);
      i++;
    }, perCharMs);

    return text.length * perCharMs + holdMs;
  }

  /** Schedule an opening sequence of whispered lines. */
  scheduleOpening(lines, intervalMs = 8000, eachDurationMs = 5500) {
    lines.forEach((line, i) => {
      setTimeout(() => this.show(line, eachDurationMs), 1600 + i * intervalMs);
    });
  }

  _cancelTyping() {
    if (this._typingInterval) {
      clearInterval(this._typingInterval);
      this._typingInterval = null;
    }
  }
}
