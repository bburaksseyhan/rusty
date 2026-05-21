import * as THREE from "three";

// ============================================================
//  PC Fan — set dressing + rotating hazard zone
// ============================================================

export function createFan({ radius = 7, slowness = 1.0, color = 0x14171a } = {}) {
  const group = new THREE.Group();
  group.name = "Fan";

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 2.4, radius * 2.4, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.5 })
  );
  housing.position.y = radius * 1.4;
  housing.userData.collide = true;
  housing.userData.colliderType = "wall";
  housing.castShadow = housing.receiveShadow = true;
  group.add(housing);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.4, 12, 32),
    new THREE.MeshStandardMaterial({
      color: 0x404448,
      metalness: 0.7,
      roughness: 0.4,
    })
  );
  ring.position.set(0, radius * 1.4, 2.1);
  group.add(ring);

  addGrill(group, radius);
  const bladePivot = addBlades(group, radius);
  const rgb = addRgbRing(group, radius);

  function animate(t, dt) {
    bladePivot.rotation.z += dt * 3.5 * slowness;
    rgb.material.emissive.setHSL((t * 0.06) % 1, 1, 0.55);
  }

  const hazard = {
    type: "fan",
    position: new THREE.Vector3(),
    radius,
    damage: 1,
    cooldown: 0,
    updatePosition() {
      bladePivot.getWorldPosition(this.position);
    },
  };

  return { group, animate, hazard };
}

function addGrill(group, radius) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x303438,
    metalness: 0.6,
    roughness: 0.5,
  });
  for (let i = 0; i < 8; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, 0.2, 0.2), mat);
    bar.position.set(0, radius * 1.4 - radius + i * (radius / 4), 2.4);
    group.add(bar);
  }
}

function addBlades(group, radius) {
  const pivot = new THREE.Group();
  pivot.position.set(0, radius * 1.4, 2.0);
  group.add(pivot);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.2, 18),
    new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.4,
      metalness: 0.6,
    })
  );
  hub.rotation.x = Math.PI / 2;
  pivot.add(hub);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x86919e,
    roughness: 0.5,
    metalness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 0.85, 1.6),
      bladeMat
    );
    blade.rotation.y = (i / 5) * Math.PI * 2;
    blade.rotation.x = 0.6;
    blade.position.set(
      Math.cos((i / 5) * Math.PI * 2) * (radius * 0.4),
      Math.sin((i / 5) * Math.PI * 2) * (radius * 0.4),
      0.4
    );
    pivot.add(blade);
  }
  return pivot;
}

function addRgbRing(group, radius) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.4, 0.18, 10, 60),
    new THREE.MeshStandardMaterial({
      color: 0x000,
      emissive: 0xff44aa,
      emissiveIntensity: 2.4,
      roughness: 0.3,
    })
  );
  ring.position.set(0, radius * 1.4, 2.6);
  group.add(ring);
  return ring;
}
