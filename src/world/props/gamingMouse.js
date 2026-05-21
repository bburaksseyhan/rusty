import * as THREE from "three";
import { Materials } from "../../assets/materials.js";

// ============================================================
//  Gaming Mouse — climbable hump with LED stripe + scroll wheel
//
//  Physics strategy:
//    The dome shape is visually a half-sphere but AABB collision
//    with a single large box blocks the approach from the side.
//    Instead we use a *staircase* of thin, narrow boxes that hug
//    the dome profile, giving the player a physical ramp to walk
//    up without being pushed away.
//
//    A visible thumb-button "step" on the approach (+Z) side
//    acts as the first visible ledge to jump onto.
// ============================================================

export function createGamingMouse() {
  const group = new THREE.Group();
  group.name = "GamingMouse";

  // --- Visual body (dome) ---
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(4, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    Materials.plasticBlack()
  );
  body.scale.set(1, 1.0, 1.5);
  body.position.y = 0.1;
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // --- Staircase colliders that hug the dome profile ---
  // Each step is a thin box. Heights and depths are tuned so
  // the player can walk up the front slope naturally.
  // The dome has radius 4, scaled z×1.5, so depth ≈ 12.
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  const steps = [
    // { depth along z (local), height (top face y), width }
    { dz:  4.5, y: 0.9, w: 7, h: 1.8 }, // front step — lowest, approach side
    { dz:  2.5, y: 1.8, w: 7, h: 1.8 },
    { dz:  0.5, y: 2.8, w: 7, h: 2.0 },
    { dz: -1.5, y: 3.5, w: 6, h: 2.0 }, // near the top
    { dz: -3.5, y: 3.8, w: 5, h: 1.5 }, // rear slope
  ];
  steps.forEach(({ dz, y, w, h }) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.0), invisible);
    s.position.set(0, y - h / 2, dz);
    s.userData.collide = true;
    s.userData.colliderType = "platform";
    group.add(s);
  });

  // --- Flat top deck — the actual landing pad ---
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x111418,
    roughness: 0.4,
    metalness: 0.4,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 5.5), deckMat);
  deck.position.set(0, 3.9, -0.4);
  deck.castShadow = deck.receiveShadow = true;
  deck.userData.collide = true;
  deck.userData.colliderType = "platform";
  group.add(deck);

  // --- Visible thumb button on the approach side (front-right) ---
  // Acts as the first "step" the player sees — jump onto this first.
  const thumbMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f26,
    roughness: 0.5,
    metalness: 0.4,
    emissive: 0x441a3a,
    emissiveIntensity: 0.7,
  });
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 1.4), thumbMat);
  thumb.position.set(0, 0.9, 5.0); // at front of mouse, very low
  thumb.castShadow = thumb.receiveShadow = true;
  // (the invisible step above already covers this area physically)
  group.add(thumb);

  // --- Separator ridge between click buttons ---
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.45, 5),
    new THREE.MeshStandardMaterial({ color: 0x080809, roughness: 0.6 })
  );
  ridge.position.set(0, 3.95, 0.6);
  group.add(ridge);

  // --- Scroll wheel ---
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.4, 18),
    new THREE.MeshStandardMaterial({
      color: 0x222226,
      emissive: 0x60c0ff,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.5,
    })
  );
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, 4.0, 1.6);
  group.add(wheel);

  // --- RGB underglow stripe ---
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.15, 8, 60, Math.PI),
    Materials.rgbStrip(0x6630ff, 2.0)
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.45;
  stripe.scale.z = 1.5;
  group.add(stripe);

  const logoLight = new THREE.PointLight(0x66c0ff, 0.8, 6, 2);
  logoLight.position.set(0, 4.4, -2);
  group.add(logoLight);

  function animate(t) {
    stripe.material.emissive.setHSL((t * 0.07) % 1, 1, 0.55);
  }

  return { group, animate, height: 3.9 };
}
