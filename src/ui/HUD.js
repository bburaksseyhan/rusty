// ============================================================
//  HUD — DOM bindings for hearts + collectible counter.
// ============================================================

export class HUD {
  constructor() {
    this._heartsEl = document.getElementById("hearts");
    this._cellCurrentEl = document.getElementById("cell-current");
    this._cellTotalEl = document.getElementById("cell-total");
    this._screwCurrentEl = document.getElementById("screw-current");
    this._screwTotalEl = document.getElementById("screw-total");
  }

  setHealth(value) {
    const hearts = this._heartsEl.querySelectorAll(".heart");
    hearts.forEach((h, i) => h.classList.toggle("empty", i >= value));
  }

  setCells(current, total) {
    this._cellCurrentEl.textContent = String(current);
    this._cellTotalEl.textContent = String(total);
  }

  setScrews(current, total) {
    if (!this._screwCurrentEl) return;
    this._screwCurrentEl.textContent = String(current);
    this._screwTotalEl.textContent = String(total);
    const wrap = this._screwCurrentEl.closest(".screws");
    if (wrap) {
      wrap.classList.toggle("screws--pulse", current > 0);
      if (current > 0) {
        clearTimeout(this._screwPulseTimer);
        this._screwPulseTimer = setTimeout(
          () => wrap.classList.remove("screws--pulse"),
          600,
        );
      }
    }
  }
}
