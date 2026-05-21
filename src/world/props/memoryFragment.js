import * as THREE from "three";

// ============================================================
//  Memory Fragments — emotional collectible story objects.
//
//  Each fragment is a glowing, hovering shard of Rusty's past.
//  When the player steps close, it triggers:
//    1. An emotional spike in EmotionSystem
//    2. A subtitle whisper from the past
//    3. A procedural reveal sound
//    4. The fragment fades out
//
//  Types: 'note' | 'photo' | 'sketch'
//  Emotional types: 'loneliness' | 'memory' | 'hope'
//
//  Level placement is declared here as MEMORY_FRAGMENTS
//  and consumed by Level1.js and Game.js.
// ============================================================

export const MEMORY_FRAGMENTS = [
  {
    id: "note_keyboard",
    position: [6, 2.0, 25],         // near the keyboard — first thing player finds
    type: "note",
    emotionType: "loneliness",
    subtitle: "A folded note. \"I had to leave in a hurry. Sorry, little one. Find your way home.\"",
    hintText: "A memory of the one who built you…",
  },
  {
    id: "photo_mug",
    position: [-12, 0.5, -18],       // near the coffee mug base
    type: "photo",
    emotionType: "memory",
    subtitle: "A photograph. A child's hands. Building something small. Something wooden. Something like you.",
    hintText: "Someone remembers you…",
  },
  {
    id: "sketch_notebooks",
    position: [-8, 5.5, -38],        // on top of the notebook stack
    type: "sketch",
    emotionType: "hope",
    subtitle: "An unfinished blueprint. Your face, drawn in pencil. You were never meant to be abandoned.",
    hintText: "A blueprint of who you are…",
  },
];

/**
 * Create a single memory fragment prop mesh group.
 *
 * @param {'note'|'photo'|'sketch'} type
 * @param {'loneliness'|'memory'|'hope'} emotionType
 * @returns {{ group, animate, userData }}
 */
export function createMemoryFragment(type, emotionType) {
  const group = new THREE.Group();
  group.name = `Memory_${type}`;

  // ---- Glow color per emotion type ----
  const glowColors = {
    loneliness: 0x8877ff,
    memory:     0xffaa44,
    hope:       0x44ffbb,
  };
  const glowColor = glowColors[emotionType] ?? 0xffffff;

  // ---- Visual shard geometry ----
  const shardMat = new THREE.MeshStandardMaterial({
    color: _typeColor(type),
    roughness: _typeRoughness(type),
    metalness: 0.05,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.88,
  });

  const shard = new THREE.Mesh(_typeGeometry(type), shardMat);
  shard.castShadow = true;
  group.add(shard);

  // ---- Glow ring halo ----
  const haloMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 28), haloMat);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  // ---- Point light ----
  const light = new THREE.PointLight(glowColor, 1.6, 12, 2);
  group.add(light);

  // ---- Particle dust cluster ----
  const particles = _buildParticles(glowColor, 18);
  group.add(particles);

  // ---- userData for Game.js detection ----
  group.userData.isMemoryFragment = true;
  group.userData.emotionType      = emotionType;

  // ---- Animate ----
  let alive = true;

  function animate(t) {
    if (!alive) return;
    const hover = Math.sin(t * 1.4) * 0.08;
    group.position.y += (hover - group.userData._hoverLast ?? 0);
    group.userData._hoverLast = hover;

    shard.rotation.y = t * 0.4;
    halo.rotation.z  = t * 0.25;
    haloMat.emissiveIntensity = 1.2 + Math.sin(t * 2.8) * 0.5;
    shardMat.emissiveIntensity = 0.5 + Math.sin(t * 1.9 + 1) * 0.3;

    // Particle drift
    const pos = particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y += 0.012;
      if (y > 1.2) y = -0.4;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + i) * 0.003);
    }
    pos.needsUpdate = true;
  }

  /**
   * Called by Game.js when the player collects this fragment.
   *
   * We *only* mutate material opacity + light intensity — never the
   * group's visibility or scene membership. That keeps the scene's
   * active-light count stable and avoids the PBR shader recompile
   * that previously caused a brief stutter on pickup.
   */
  function collect() {
    alive = false;
    const start = performance.now();
    const fade = () => {
      const p = Math.min(1, (performance.now() - start) / 1200);
      shardMat.opacity = 0.88 * (1 - p);
      haloMat.opacity  = 0.25 * (1 - p);
      light.intensity  = 1.6  * (1 - p);
      if (p < 1) {
        requestAnimationFrame(fade);
      } else {
        // Definitively hide the still-allocated meshes without
        // removing them — keeps light count untouched.
        shard.visible = false;
        halo.visible  = false;
        particles.visible = false;
      }
    };
    fade();
  }

  return { group, animate, collect };
}

// ---- Helpers -------------------------------------------------

function _typeGeometry(type) {
  switch (type) {
    case "photo":
      return new THREE.BoxGeometry(0.8, 0.55, 0.04);
    case "sketch":
      return new THREE.BoxGeometry(0.65, 0.9, 0.04);
    default: // note — folded diamond shape approximated by octahedron
      return new THREE.OctahedronGeometry(0.4, 0);
  }
}

function _typeColor(type) {
  switch (type) {
    case "photo":   return 0xf5e9d0;  // sepia
    case "sketch":  return 0xeaeae0;  // paper white
    default:        return 0xfff5cc;  // parchment
  }
}

function _typeRoughness(type) {
  switch (type) {
    case "photo":   return 0.30;
    case "sketch":  return 0.80;
    default:        return 0.65;
  }
}

function _buildParticles(color, count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.4;
    positions[i * 3 + 0] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.09,
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}
