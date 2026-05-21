import * as THREE from "three";

// ============================================================
//  Sticky Note — small colored square with handwritten text
// ============================================================

export function createStickyNote({ color = 0xfff58a, text = "NOTE" } = {}) {
  const group = new THREE.Group();
  group.name = "StickyNote";

  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");

  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, 256, 30);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(80, 4, 96, 22);

  ctx.fillStyle = "rgba(40, 30, 18, 0.9)";
  ctx.font = "italic bold 38px 'Marker Felt', 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  text.split("\n").forEach((l, i) => ctx.fillText(l, 128, 120 + i * 44));

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
  );
  note.castShadow = true;
  group.add(note);

  return { group };
}
