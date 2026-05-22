import * as THREE from "three";

function createBoltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 192);

  const drawBolt = (alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff6a8";
    ctx.shadowColor = "#44ffcc";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(72, 18);
    ctx.lineTo(38, 88);
    ctx.lineTo(58, 88);
    ctx.lineTo(48, 174);
    ctx.lineTo(92, 72);
    ctx.lineTo(68, 72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawBolt(0.35);
  drawBolt(1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Robot başının üstünde — şarj olduğunu gösteren ⚡ (kameraya dönük sprite).
 */
export function createChargeIndicator() {
  const group = new THREE.Group();
  group.name = "ChargeIndicator";

  const tex = createBoltTexture();
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.35, 2.05, 1);
  sprite.position.y = 0.35;
  group.add(sprite);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x55ffcc,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 24),
    ringMat,
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  let glow = 0;

  function setGlow(v) {
    glow = THREE.MathUtils.clamp(v, 0, 1);
    spriteMat.opacity = glow * 0.95;
    ringMat.opacity = glow * 0.55;
    spriteMat.color.setRGB(
      1,
      0.92 + glow * 0.08,
      0.55 + glow * 0.35,
    );
  }

  function animate(t) {
    if (glow < 0.02) return;
    const pulse = 0.82 + Math.sin(t * 5.5) * 0.18;
    sprite.scale.set(1.35 * pulse, 2.05 * pulse, 1);
    sprite.position.y = 0.35 + Math.sin(t * 4) * 0.08;
    ring.scale.setScalar(0.9 + Math.sin(t * 3.2) * 0.12);
  }

  function faceCamera(camera) {
    if (!camera) return;
    group.lookAt(camera.position);
  }

  return { group, setGlow, animate, faceCamera };
}
