import * as THREE from "three";
import { createPowerOutlet } from "./powerOutlet.js";

/**
 * Defter yığınının solunda — kablolu masaüstü şarj ünitesi (dikey, okunaklı).
 */
export function createChargeStation() {
  const group = new THREE.Group();
  group.name = "ChargeStation";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2e3840,
    roughness: 0.72,
    metalness: 0.18,
    emissive: 0x0a1218,
    emissiveIntensity: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x3a6b55,
    roughness: 0.55,
    emissive: 0x1a4030,
    emissiveIntensity: 0.35,
  });

  // Ayak — defter üstüne oturur
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.18, 1.8),
    bodyMat,
  );
  foot.position.y = 0.09;
  foot.receiveShadow = true;
  group.add(foot);

  // Gövde
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.6, 1.5),
    bodyMat,
  );
  body.position.y = 1.45;
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.22, 1.52),
    accentMat,
  );
  accent.position.y = 2.05;
  group.add(accent);

  // Ön panel — prize bakan yüz (+Z yerel, robotlara dönük)
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.8, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x3d4a52,
      roughness: 0.65,
      metalness: 0.1,
    }),
  );
  panel.position.set(0, 1.35, 0.78);
  group.add(panel);

  const outlet = createPowerOutlet();
  outlet.group.scale.setScalar(0.52);
  outlet.group.position.set(0, 1.15, 0.95);
  outlet.group.rotation.y = Math.PI;
  group.add(outlet.group);

  // Sol tarafa giden kalın güç kablosu
  const wallCable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 4.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.8 }),
  );
  wallCable.rotation.z = Math.PI / 2;
  wallCable.position.set(-2.8, 0.55, -0.15);
  group.add(wallCable);

  const cablePlug = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 0.7),
    new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );
  cablePlug.position.set(-4.6, 0.5, -0.15);
  group.add(cablePlug);

  // İki kısa şarj kablosu (robotlara — başta sönük)
  const shortCableMats = [];
  for (let side = 0; side < 2; side++) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6),
      new THREE.MeshStandardMaterial({
        color: 0x252a2e,
        emissive: 0x224433,
        emissiveIntensity: 0.15,
        roughness: 0.5,
      }),
    );
    cable.rotation.x = Math.PI / 2;
    cable.position.set(side === 0 ? 0.55 : -0.55, 1.0, 1.05);
    cable.visible = false;
    group.add(cable);
    shortCableMats.push(cable);
  }

  const statusLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x44ff99,
      emissive: 0x22cc77,
      emissiveIntensity: 0,
    }),
  );
  statusLed.position.set(0, 2.35, 0.55);
  group.add(statusLed);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0xc8d4dc,
      roughness: 0.9,
      emissive: 0x223344,
      emissiveIntensity: 0.15,
    }),
  );
  label.position.set(0, 2.0, 0.86);
  group.add(label);

  let chargeGlow = 0;

  function setChargeGlow(v) {
    chargeGlow = THREE.MathUtils.clamp(v, 0, 1);
    outlet.setChargeGlow(v);
    statusLed.material.emissiveIntensity = chargeGlow * 1.6;
    accentMat.emissiveIntensity = 0.35 + chargeGlow * 0.5;
    for (const c of shortCableMats) {
      c.visible = chargeGlow > 0.08;
      c.material.emissiveIntensity = 0.15 + chargeGlow * 0.9;
    }
  }

  function setPlugVisible(v) {
    outlet.setPlugVisible(v);
  }

  function animate(t) {
    outlet.animate(t);
    if (chargeGlow > 0.01) {
      const p = 0.7 + Math.sin(t * 4) * 0.3;
      statusLed.material.emissiveIntensity = chargeGlow * 1.6 * p;
    }
  }

  function plugWorldPosition(target = new THREE.Vector3()) {
    outlet.group.updateWorldMatrix(true, false);
    return outlet.group.localToWorld(target.set(0, 0.5, 0.35));
  }

  return {
    group,
    outlet,
    setChargeGlow,
    setPlugVisible,
    animate,
    plugWorldPosition,
  };
}
