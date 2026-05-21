import * as THREE from "three";
import { World } from "./World.js";
import { createWoodTextures } from "../assets/textures.js";

import { createKeyboard } from "./props/keyboard.js";
import { createMousepad } from "./props/mousepad.js";
import { createGamingMouse } from "./props/gamingMouse.js";
import { createMug } from "./props/mug.js";
import { createNotebookStack } from "./props/notebookStack.js";
import { createMonitor } from "./props/monitor.js";
import { createMonitorStand } from "./props/monitorStand.js";
import { createWindow } from "./props/window.js";
import { createFan } from "./props/fan.js";
import { createUsbCable, createUsbCableSnake } from "./props/usbCable.js";
import { createEnergyCell } from "./props/energyCell.js";
import { createStickyNote } from "./props/stickyNote.js";
import { createDust } from "./props/dust.js";
import { createCrtSecretMonitor } from "./props/crtSecretMonitor.js";
import { createBatteryTransferRig } from "./props/batteryTransferRig.js";
import { createPencil, createBattery, createScrew } from "./props/decor.js";

// ============================================================
//  LEVEL 1 — "The First Night on the Desk"
//
//  Traversal path (player follows -Z forward):
//    Keyboard → USB Bridge → Mousepad → Gaming Mouse →
//    Coffee Mug → Notebooks → Monitor Stand (final platform)
// ============================================================

export function buildLevel1(scene) {
  const world = new World(scene);

  addDeskSurface(world.root);
  addBackdrop(world);
  addCrtMystery(world);
  addBatteryTransfer(world);
  addTraversalPath(world);
  addHazards(world);
  addSetDressing(world);
  addCollectibles(world);
  world.addProp(createDust());

  return world;
}

// ---- Floor --------------------------------------------------
function addDeskSurface(root) {
  const wood = createWoodTextures({
    hue: 28,
    sat: 38,
    light: 22,
    ringSpacing: 44,
  });
  wood.map.repeat.set(12, 12);
  wood.roughnessMap.repeat.set(12, 12);

  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500, 1, 1),
    new THREE.MeshStandardMaterial({
      map: wood.map,
      roughnessMap: wood.roughnessMap,
      roughness: 0.95,
      metalness: 0.05,
      color: 0xcfa078,
    })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  root.add(desk);
}

// ---- Backdrop: window + monitor + sticky notes --------------
function addBackdrop(world) {
  const win = world.addProp(createWindow(), {
    position: [80, 0, -10],
    rotationY: -Math.PI / 2,
  });
  // window is decorative, no collider — but addProp tolerates that.

  world.addProp(createMonitor(), { position: [0, 0, -78] });
  world.addProp(createMonitorStand(), { position: [0, 0, -55] });

  const stickies = [
    { p: [-12, 7.2, -73], r: 0.2, c: 0xfff58a, text: "DON'T\nFORGET" },
    { p: [12, 9.0, -73], r: -0.3, c: 0xff9bb6, text: "feed\n  Rusty" },
    { p: [-4, 4.8, -73], r: 0.1, c: 0x9be0ff, text: "v0.12" },
  ];
  stickies.forEach((s) => {
    const note = world.addProp(createStickyNote({ color: s.c, text: s.text }), {
      position: s.p,
      rotationY: Math.PI,
    });
    note.group.rotation.z = s.r;
  });
}

// ---- CRT gizemi — masa kenarında gizlenmiş bağlantı düğümü -----
function addCrtMystery(world) {
  const crtSecret = createCrtSecretMonitor();
  world.addProp(crtSecret, {
    position: [22.5, 0.08, -69.8],
    rotationY: Math.PI * 1.62,
  });
  world.crtSecret = crtSecret;
}

// ---- Battery Transfer Rig — fare pad'inin solunda gizli atölye --
function addBatteryTransfer(world) {
  const rig = createBatteryTransferRig();
  world.addProp(rig, {
    position: [-32, 0, -2],
    rotationY: Math.PI * 0.85,
  });
  // Taşınan pilin görseli sahnede serbestçe konumlanır; rig grubu
  // değil, world.root altında yaşar.
  world.root.add(rig.carryBattery);
  world.batteryTransferRig = rig;
}

// ---- Main traversal chain -----------------------------------
function addTraversalPath(world) {
  // 1. Spawn: keyboard
  world.addProp(createKeyboard(), {
    position: [-2, 0, 30],
    rotationY: 0.04,
  });

  // 2. USB cable bridge
  world.addProp(
    createUsbCable(
      new THREE.Vector3(8, 6.5, 22),
      new THREE.Vector3(8, 1.4, 12),
      { thickness: 0.55, sag: 1.6 }
    )
  );
  world.addProp(createUsbCableSnake());

  // 3. Mousepad + 4. Gaming mouse
  const pad = world.addProp(createMousepad(), { position: [8, 0, 0] });
  world.addProp(createGamingMouse(), {
    position: [2, pad.height, -2],
    rotationY: 0.35,
  });

  // 5. Coffee mug
  world.addProp(createMug(), { position: [-14, 0, -20] });

  // 6. Notebooks
  world.addProp(createNotebookStack(), {
    position: [-10, 0, -40],
    rotationY: 0.12,
  });
}

// ---- Hazards ------------------------------------------------
function addHazards(world) {
  world.addProp(createFan({ radius: 7, slowness: 1.0 }), {
    position: [34, 0, 6],
    rotationY: -Math.PI / 2,
  });
  world.addProp(
    createFan({ radius: 6, slowness: 0.4, color: 0x1a1c20 }),
    { position: [-40, 0, -10], rotationY: Math.PI / 2 }
  );
}

// ---- Set dressing -------------------------------------------
function addSetDressing(world) {
  world.addProp(createPencil(0xe8c060), { position: [20, 0.6, 4], rotationY: 0.9 });
  world.addProp(createPencil(0x2a3f7d), {
    position: [-22, 0.6, -28],
    rotationY: -0.5,
  });

  // Green battery — moved out of the Battery Transfer Rig's
  // footprint (which spans roughly x[-44..-19], z[-12..+8] in
  // world space after its 153° rotation) into clear desk space.
  // Steps now face +Z, the direction the player approaches from.
  const bat1 = world.addProp(createBattery(0x1a8a3a), {
    position: [-22, 0, -16],
    rotationY: 0,
  });
  bat1.group; // (reserved spot for animation later)

  const bat2 = world.addProp(createBattery(0x4a5a6a), {
    position: [22, 1.6, -38],
  });
  bat2.group.rotation.x = Math.PI / 2;

  for (let i = 0; i < 32; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 70;
    world.addProp(createScrew(), {
      position: [Math.cos(angle) * r, 0.12, Math.sin(angle) * r],
      rotationY: Math.random() * Math.PI,
    });
  }
}

// ---- Collectibles -------------------------------------------
function addCollectibles(world) {
  const SPOTS = [
    [-2, 7.6, 30],   // on the keyboard (right at spawn)
    [8, 7.0, 17],    // top of the USB cable bridge
    [8, 1.6, 6],     // on the mousepad
    [2, 5.3, -2],    // top of the gaming mouse
    [-14, 20.0, -20],// floating just above the mug rim — reachable from top (y=18.2+3.37=21.5)
    [-10, 7.0, -40], // top of notebook stack
    [0, 13.0, -55],  // monitor stand platform (final)
    [-22, 8.6, -16], // bonus: top of the green battery
  ];
  SPOTS.forEach((p) => world.addCollectible(createEnergyCell(), p));
}
