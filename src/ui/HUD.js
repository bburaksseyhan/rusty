// ============================================================
//  HUD — DOM bindings for hearts + collectible counter.
// ============================================================

export class HUD {
  constructor() {
    this._heartsEl = document.getElementById("hearts");
    this._cellCurrentEl = document.getElementById("cell-current");
    this._cellTotalEl = document.getElementById("cell-total");
  }

  setHealth(value) {
    const hearts = this._heartsEl.querySelectorAll(".heart");
    hearts.forEach((h, i) => h.classList.toggle("empty", i >= value));
  }

  setCells(current, total) {
    this._cellCurrentEl.textContent = String(current);
    this._cellTotalEl.textContent = String(total);
  }
}
