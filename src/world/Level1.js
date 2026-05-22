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
import { createUsbCable } from "./props/usbCable.js";
import { createEnergyCell } from "./props/energyCell.js";
import { createStickyNote } from "./props/stickyNote.js";
import { createDust } from "./props/dust.js";
import { createCrtSecretMonitor } from "./props/crtSecretMonitor.js";
import { createBatteryTransferRig } from "./props/batteryTransferRig.js";
import { createPencil, createBattery, createScrew, createDeskNail } from "./props/decor.js";
import { createScrewElectricRig } from "./props/screwElectricRig.js";

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

  world.monitorProp = world.addProp(createMonitor(), { position: [0, 0, -78] });
  world.addProp(createMonitorStand(), { position: [0, 0, -55] });

  const stickies = [
    { p: [-12, 7.2, -73], r: 0.2, c: 0xfff58a, text: "UNUT\nMA" },
    { p: [12, 9.0, -73], r: -0.3, c: 0xff9bb6, text: "Rusty'yi\nbesle" },
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

/** Not defteri yerleşimi — vidalar bu grubun yerel koordinatına göre konur */
export const NOTEBOOK_PLACE = Object.freeze({
  position: [-10, 0, -40],
  rotationY: 0.12,
});

/** Üst kitap yüzeyi (ayak seviyesi) — collectible / şarj hizası */
export const NOTEBOOK_TOP_Y = 4.02;

export function notebookLocalToWorld(lx, ly, lz) {
  const [px, py, pz] = NOTEBOOK_PLACE.position;
  const r = NOTEBOOK_PLACE.rotationY;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [px + lx * c + lz * s, py + ly, pz - lx * s + lz * c];
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
  // 3. Mousepad + 4. Gaming mouse
  const pad = world.addProp(createMousepad(), { position: [8, 0, 0] });
  world.addProp(createGamingMouse(), {
    position: [2, pad.height, -2],
    rotationY: 0.35,
  });

  // 5. Coffee mug
  world.addProp(createMug(), { position: [-14, 0, -20] });

  // 6. Notebooks + sağ kenar vida devresi
  world.addProp(createNotebookStack(), {
    position: [...NOTEBOOK_PLACE.position],
    rotationY: NOTEBOOK_PLACE.rotationY,
  });
  addNotebookScrewCircuit(world);
}

// ---- Hazards ------------------------------------------------
function addHazards(world) {
  world.fanProps.push(
    world.addProp(createFan({ radius: 7, slowness: 1.0 }), {
      position: [34, 0, 6],
      rotationY: -Math.PI / 2,
    }),
  );
  world.fanProps.push(
    world.addProp(
      createFan({ radius: 6, slowness: 0.4, color: 0x1a1c20 }),
      { position: [-40, 0, -10], rotationY: Math.PI / 2 },
    ),
  );
}

// ---- Set dressing -------------------------------------------
function addSetDressing(world) {
  const pen1 = world.addProp(createPencil(0xe8c060), {
    position: [20, 0, 4],
    rotationY: 0.9,
  });
  const pen2 = world.addProp(createPencil(0x2a3f7d), {
    position: [-22, 0, -28],
    rotationY: -0.5,
  });
  world.pushableGroups.push(pen1.group, pen2.group);

  const bat1 = world.addProp(createBattery(0x1a8a3a), {
    position: [-22, 0, -16],
    rotationY: 0,
  });
  bat1.group;

  const bat2 = world.addProp(createBattery(0x4a5a6a), {
    position: [32, 0, -58],
    rotationY: Math.PI / 2,
  });
  bat2.group.rotation.x = Math.PI / 2;

  const NAIL_SPOTS = [
    [12, 0, 12],
    [16, 0, 8],
    [6, 0, 18],
    [-8, 0, 14],
    [-14, 0, 6],
    [4, 0, -8],
    [18, 0, -6],
    [-18, 0, -22],
    [10, 0, -32],
    [-6, 0, -36],
  ];
  for (const [x, y, z] of NAIL_SPOTS) {
    const nail = createDeskNail();
    world.addProp(nail, {
      position: [x, y, z],
      rotationY: Math.random() * Math.PI,
    });
    world.deskNailProps.push(nail);
  }

}

// ---- Not defteri sağı — vida devresi (defter yerel X/Z) -------
function addNotebookScrewCircuit(world) {
  // lx=15.5 → spiral halkaların (x≈12) dışında; lz defter derinliği içinde
  const screwDefs = [
    { lz: -5, variant: "tighten" },
    { lz: -1, variant: "stomp" },
    { lz: 2, variant: "tighten" },
    { lz: 5, variant: "stomp" },
  ];
  const screws = [];

  for (const def of screwDefs) {
    const [x, y, z] = notebookLocalToWorld(15.5, 0, def.lz);
    const screw = createScrew({ variant: def.variant });
    world.addProp(screw, {
      position: [x, y, z],
      rotationY: NOTEBOOK_PLACE.rotationY + Math.PI / 2,
    });
    world.deskScrewProps.push(screw);
    screws.push(screw);
  }

  const [ax, ay, az] = notebookLocalToWorld(9.5, 3.15, 0);
  const notebookAnchor = new THREE.Vector3(ax, ay, az);

  world.screwElectricRig = createScrewElectricRig(screws, {
    notebookAnchor,
  });
  world.root.add(world.screwElectricRig.group);
}

// ---- Collectibles -------------------------------------------
function addCollectibles(world) {
  const SPOTS = [
    [-2, 7.6, 30],   // on the keyboard (right at spawn)
    [8, 7.0, 17],    // top of the USB cable bridge
    [8, 1.6, 6],     // on the mousepad
    [2, 5.3, -2],    // top of the gaming mouse
    [-14, 20.0, -20],// floating just above the mug rim — reachable from top (y=18.2+3.37=21.5)
    [-10, NOTEBOOK_TOP_Y + 0.5, -40], // top of notebook stack
    [0, 13.0, -55],  // monitor stand platform (final)
    [-22, 8.6, -16], // bonus: top of the green battery
  ];
  SPOTS.forEach((p) => world.addCollectible(createEnergyCell(), p));
}
