// ============================================================
//  ControlsHelp — kalıcı tuş kılavuzu (oyun sırasında görünür).
// ============================================================

const ROWS = [
  { keys: "W A S D", action: "Yürü" },
  { keys: "Shift", action: "Koş" },
  { keys: "Space", action: "Zıpla" },
  { keys: "Fare", action: "Kamerayı çevir" },
  { keys: "Tekerlek", action: "Yakınlaştır / uzaklaştır" },
  { keys: "E", action: "Vida · atölye pili · fan aç/kapa · hedef" },
  { keys: "Q", action: "Rusty hikâyesi" },
  { keys: "Esc", action: "İmleci serbest bırak" },
  { keys: "Çivi", action: "Üstüne zıpla → çakılır" },
  { keys: "Altın vida", action: "Üstüne zıpla → devreye bağlanır" },
];

export class ControlsHelp {
  constructor() {
    this._root = document.getElementById("controls-help");
    if (!this._root) return;

    const list = document.createElement("ul");
    list.className = "controls-help-list";

    for (const row of ROWS) {
      const li = document.createElement("li");
      const kbd = document.createElement("kbd");
      kbd.textContent = row.keys;
      const span = document.createElement("span");
      span.textContent = row.action;
      li.append(kbd, span);
      list.appendChild(li);
    }

    this._root.appendChild(list);
    this.setVisible(false);
  }

  setVisible(visible) {
    if (this._root) {
      this._root.classList.toggle("visible", visible);
      this._root.setAttribute("aria-hidden", visible ? "false" : "true");
    }
  }
}
