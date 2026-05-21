import * as THREE from "three";
import { LIGHTING, RENDER } from "../core/config.js";

// ============================================================
//  Scene lighting — nighttime office mood.
//  Warm desk lamp (key) + cool moon/window fill + low ambient.
// ============================================================

export function setupLighting(scene) {
  const ambient = new THREE.HemisphereLight(
    LIGHTING.hemisphereSky,
    LIGHTING.hemisphereGround,
    LIGHTING.hemisphereIntensity
  );
  scene.add(ambient);

  const lampCfg = LIGHTING.deskLamp;
  const deskLamp = new THREE.SpotLight(
    lampCfg.color,
    lampCfg.intensity,
    lampCfg.distance,
    lampCfg.angle,
    lampCfg.penumbra,
    lampCfg.decay
  );
  deskLamp.position.set(...lampCfg.position);
  deskLamp.target.position.set(...lampCfg.target);
  deskLamp.castShadow = true;
  deskLamp.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  deskLamp.shadow.camera.near = 5;
  deskLamp.shadow.camera.far = lampCfg.distance;
  deskLamp.shadow.bias = -0.0005;
  deskLamp.shadow.radius = 6;
  scene.add(deskLamp);
  scene.add(deskLamp.target);

  const fill = new THREE.DirectionalLight(
    LIGHTING.fill.color,
    LIGHTING.fill.intensity
  );
  fill.position.set(...LIGHTING.fill.position);
  scene.add(fill);

  const bounce = new THREE.DirectionalLight(
    LIGHTING.bounce.color,
    LIGHTING.bounce.intensity
  );
  bounce.position.set(...LIGHTING.bounce.position);
  scene.add(bounce);

  // Visible bulb + shade mesh — sells the bloom and gives a
  // tangible silhouette to the corner of the desk.
  addLampFixture(scene, lampCfg.position);
}

function addLampFixture(scene, position) {
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c0,
      emissive: 0xffc070,
      emissiveIntensity: 6.0,
    })
  );
  bulb.position.set(...position);
  scene.add(bulb);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(7, 9, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2a2017,
      roughness: 0.6,
      metalness: 0.4,
      side: THREE.DoubleSide,
      emissive: 0x6b3a1a,
      emissiveIntensity: 0.4,
    })
  );
  shade.position.set(position[0], position[1] + 4, position[2]);
  shade.rotation.z = -0.4;
  shade.rotation.x = 0.3;
  scene.add(shade);
}
