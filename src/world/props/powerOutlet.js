import * as THREE from "three";

// ============================================================
//  Masa prizi — bölüm sonu şarj sahnesi (okunaklı, parlak).
// ============================================================

export function createPowerOutlet() {
  const group = new THREE.Group();
  group.name = "PowerOutlet";

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4dc,
    roughness: 0.55,
    metalness: 0.08,
  });
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 0.7, 2.6),
    housingMat,
  );
  housing.position.y = 0.35;
  housing.castShadow = housing.receiveShadow = true;
  group.add(housing);

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xf8f4ec,
    roughness: 0.4,
    metalness: 0.05,
  });
  const face = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.45, 0.14), faceMat);
  face.position.set(0, 0.95, 1.28);
  group.add(face);

  const socketMat = new THREE.MeshStandardMaterial({
    color: 0x0e1014,
    roughness: 0.3,
    metalness: 0.5,
  });
  for (const x of [-0.85, 0.85]) {
    const hole = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.95, 0.1),
      socketMat,
    );
    hole.position.set(x, 0.95, 1.34);
    group.add(hole);

    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.45, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xd4a82a,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x332200,
        emissiveIntensity: 0.3,
      }),
    );
    pin.position.set(x - 0.18, 0.82, 1.38);
    group.add(pin);
    const pin2 = pin.clone();
    pin2.position.x = x + 0.18;
    group.add(pin2);
  }

  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e0,
    emissive: 0xffcc55,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.9,
    roughness: 0.25,
  });
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.2, 0.06),
    glowMat,
  );
  glow.position.set(0, 0.95, 1.4);
  group.add(glow);

  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x44ff99,
      emissive: 0x22ff88,
      emissiveIntensity: 0,
    }),
  );
  led.position.set(1.35, 1.35, 1.32);
  group.add(led);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 3.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.7 }),
  );
  cable.rotation.z = Math.PI / 2;
  cable.position.set(-2.2, 0.42, -0.25);
  group.add(cable);

  const plugMat = new THREE.MeshStandardMaterial({
    color: 0x4a525c,
    roughness: 0.35,
    metalness: 0.55,
    emissive: 0x55ffaa,
    emissiveIntensity: 0,
  });
  const plug = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.95), plugMat);
  plug.position.set(0.15, 0.72, 1.55);
  plug.visible = false;
  group.add(plug);

  const plug2 = plug.clone();
  plug2.position.set(-0.55, 0.72, 1.55);
  plug2.visible = false;
  group.add(plug2);

  const chargeLight = new THREE.PointLight(0xffcc66, 0, 14, 1.8);
  chargeLight.position.set(0, 1.1, 1.6);
  group.add(chargeLight);

  let chargeGlow = 0;

  function setChargeGlow(v) {
    chargeGlow = THREE.MathUtils.clamp(v, 0, 1);
    glowMat.emissiveIntensity = chargeGlow * 1.4;
    plugMat.emissiveIntensity = chargeGlow * 1.1;
    glowMat.opacity = 0.35 + chargeGlow * 0.4;
    led.material.emissiveIntensity = chargeGlow * 1.0;
    chargeLight.intensity = chargeGlow * 1.8;
  }

  function setPlugVisible(v) {
    plug.visible = v;
    plug2.visible = v;
  }

  function animate(t) {
    if (chargeGlow > 0.01) {
      const pulse = 0.8 + Math.sin(t * 6) * 0.2;
      glowMat.emissiveIntensity = chargeGlow * 1.4 * pulse;
      chargeLight.intensity = chargeGlow * 1.8 * pulse;
      plugMat.emissiveIntensity = chargeGlow * 1.1 * pulse;
    }
  }

  return { group, setChargeGlow, setPlugVisible, animate };
}
