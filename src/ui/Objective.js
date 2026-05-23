// ============================================================
//  Objective panel — toggleable route guide.
//
//  Shows a numbered, vertical chain of level stages. The current
//  stage is highlighted; completed stages render as "done". An
//  auto-hide timer dismisses the panel after a few seconds so it
//  never gets in the way of the cinematic.
// ============================================================

export class Objective {
  constructor({ autoHideMs = 10000 } = {}) {
    this._panel = document.getElementById("objective");
    this._list = document.getElementById("objective-stages");
    this._autoHideMs = autoHideMs;
    this._visible = false;
    this._timer = null;
    this._stages = [];
  }

  /** Replace the stage list. `stages` is an array of strings. */
  setStages(stages) {
    this._stages = stages;
    this._list.innerHTML = "";
    stages.forEach((label) => {
      const li = document.createElement("li");
      li.textContent = label;
      this._list.appendChild(li);
    });
  }

  /** Highlight the player's current stage by index. */
  setCurrent(index) {
    const items = this._list.querySelectorAll("li");
    items.forEach((li, i) => {
      li.classList.toggle("current", i === index);
      li.classList.toggle("done", i < index);
    });
  }

  isVisible() {
    return this._visible;
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    this._panel.classList.add("show");
    this._panel.classList.remove("closing");
    this._panel.setAttribute("aria-hidden", "false");
    this._visible = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.hide(), this._autoHideMs);
  }

  hide() {
    this._panel.classList.add("closing");
    this._panel.classList.remove("show");
    this._panel.setAttribute("aria-hidden", "true");
    this._visible = false;
    clearTimeout(this._timer);
    this._timer = null;
  }
}
