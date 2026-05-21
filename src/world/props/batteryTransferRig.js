import * as THREE from "three";

// ============================================================
//  Battery Transfer Rig — ortamda iki makine + tek pil hücresi.
//
//  Sahne, oyuncunun fiziksel olarak çözeceği bir "tek pil"
//  bulmacasıdır:
//
//    1. Yere düşmüş pil hücresini al
//    2. Küçük CRT'nin yan yuvasına tak — ekran açılır
//    3. Pili çıkar, kilitli çekmecenin yuvasına tak
//    4. Kilit mekanizması açılır, gizli ödül + yeni yol görünür
//
//  HUD / yüzen arayüz yok. Tüm geri bildirim ortamın kendisinden
//  (LED renk değişimi, ekran ışığı, çekmece kayması) gelir.
// ============================================================

const CANVAS = { w: 512, h: 384 };

export const BT_RADIUS = {
  pickupBattery: 3.0,
  crtSocket:     3.8,
  lockSocket:    3.8,
};

// Local positions of the two batteries — each is dedicated to one
// socket. Battery A sits near the CRT (left machine), battery B
// near the lock (right machine). Keeps the puzzle's intent obvious
// at a glance: "two cells, two slots".
const BATTERY_A_LOCAL = [-3.5, 0.7, 4.4];
const BATTERY_B_LOCAL = [ 3.5, 0.7, 4.4];

export function createBatteryTransferRig() {
  const group = new THREE.Group();
  group.name = "BatteryTransferRig";

  // ---- Çalışma tezgâhı (zemin platformu) ----
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.92,
    metalness: 0.08,
  });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 12), benchMat);
  bench.position.set(0, 0.3, 0);
  bench.castShadow = bench.receiveShadow = true;
  bench.userData.collide = true;
  bench.userData.colliderType = "platform";
  group.add(bench);

  // Tezgâh kenarı LED şerit (sahneyi sinematik aydınlatma)
  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0x223344,
    emissive: 0x224466,
    emissiveIntensity: 0.7,
  });
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(21, 0.08, 0.18), ledStripMat);
  ledStrip.position.set(0, 0.62, 5.95);
  group.add(ledStrip);

  // ---- Küçük CRT (sol) ----
  const crtBodyMat = new THREE.MeshStandardMaterial({
    color: 0x35332e,
    roughness: 0.78,
    metalness: 0.22,
  });
  const crtBody = new THREE.Mesh(new THREE.BoxGeometry(7.5, 6.6, 6.5), crtBodyMat);
  crtBody.position.set(-6.5, 3.9, 0);
  crtBody.castShadow = crtBody.receiveShadow = true;
  crtBody.userData.collide = true;
  crtBody.userData.colliderType = "wall";
  group.add(crtBody);

  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.88 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.0, 0.3), bezelMat);
  bezel.position.set(-6.5, 3.9, 3.32);
  group.add(bezel);

  // Ekran (canvas dokusu)
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS.w;
  canvas.height = CANVAS.h;
  const ctx = canvas.getContext("2d");
  drawCrtFace(ctx, 0, 0);
  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter;

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    color: 0xffffff,
    emissive: new THREE.Color(0x000810),
    emissiveIntensity: 0.06,
    roughness: 0.32,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.2), screenMat);
  screen.position.set(-6.5, 3.9, 3.5);
  group.add(screen);

  const crtGlow = new THREE.PointLight(0x4af0c8, 0, 22, 1.7);
  crtGlow.position.set(-6.5, 3.9, 6);
  group.add(crtGlow);

  // CRT yan yuvası (E yapılacak yer)
  const crtSocketBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.6 })
  );
  crtSocketBase.position.set(-2.5, 4.4, 1.1);
  group.add(crtSocketBase);

  const crtSocketLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    new THREE.MeshStandardMaterial({
      color: 0x551b1b,
      emissive: 0xff2222,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    })
  );
  crtSocketLamp.position.set(-2.5, 5.05, 1.1);
  group.add(crtSocketLamp);

  // Görünür "takılı pil" — yuvaya oturduğunda E geri bildirimi olarak
  // belirir. Glow için ayrı PointLight kullanmıyoruz; pil mesh'inin
  // emissive materyali + bloom yeterli parlama veriyor ve sahnenin
  // toplam ışık sayısı düşük kalıyor (perf kritik).
  const crtSocketBattery = makeBatteryMesh();
  crtSocketBattery.position.set(-2.5, 5.1, 1.1);
  crtSocketBattery.scale.setScalar(0.78);
  crtSocketBattery.visible = false;
  group.add(crtSocketBattery);

  // ---- Kilitli çekmece (sağ) ----
  const lockBodyMat = new THREE.MeshStandardMaterial({
    color: 0x4a3826,
    roughness: 0.86,
    metalness: 0.12,
  });
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(7, 5.8, 6.5), lockBodyMat);
  lockBody.position.set(7, 3.5, 0);
  lockBody.castShadow = lockBody.receiveShadow = true;
  lockBody.userData.collide = true;
  lockBody.userData.colliderType = "wall";
  group.add(lockBody);

  // İç boşluk (sürgülü ön panel için "duvar")
  const drawerMat = new THREE.MeshStandardMaterial({
    color: 0x3a2c1c,
    roughness: 0.88,
    metalness: 0.06,
  });
  const drawerFront = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.6, 0.4), drawerMat);
  // Çekmecenin "kapağı" — kayarak öne çıkacak (ana mesh)
  const drawer = new THREE.Group();
  drawer.name = "TransferLockDrawer";
  drawer.position.set(7, 2.6, 3.05);
  drawer.add(drawerFront);
  group.add(drawer);

  // Çekmece tutamaç
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.3, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xb88a5a, metalness: 0.65, roughness: 0.4 })
  );
  handle.position.set(0, 0.1, 0.32);
  drawer.add(handle);

  // 4 adet kilit LED'i (kırmızıdan yeşile geçer)
  const lockLeds = [];
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x661a1a,
        emissive: 0xff2222,
        emissiveIntensity: 0.85,
        roughness: 0.42,
      })
    );
    led.position.set(-1.2 + i * 0.8, 1.3, 0.4);
    drawer.add(led);
    lockLeds.push(led);
  }

  // Kilit yan yuvası
  const lockSocketBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.6 })
  );
  lockSocketBase.position.set(2.6, 3.6, 1.1);
  group.add(lockSocketBase);

  const lockSocketLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    new THREE.MeshStandardMaterial({
      color: 0x331818,
      emissive: 0xaa2222,
      emissiveIntensity: 0.6,
      roughness: 0.42,
    })
  );
  lockSocketLamp.position.set(2.6, 4.25, 1.1);
  group.add(lockSocketLamp);

  const lockSocketBattery = makeBatteryMesh();
  lockSocketBattery.position.set(2.6, 4.3, 1.1);
  lockSocketBattery.scale.setScalar(0.78);
  lockSocketBattery.visible = false;
  group.add(lockSocketBattery);

  // ---- Çekmece içi ödül + gizli yol lambası ----
  const rewardMat = new THREE.MeshStandardMaterial({
    color: 0xffe6a8,
    emissive: 0xffb44a,
    emissiveIntensity: 1.6,
    roughness: 0.32,
    metalness: 0.18,
  });
  const reward = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), rewardMat);
  reward.position.set(7, 3.4, 1.4);
  reward.visible = false;
  group.add(reward);

  const rewardLight = new THREE.PointLight(0xffc8a0, 0, 9, 1.8);
  rewardLight.position.copy(reward.position);
  group.add(rewardLight);

  // Gizli yol: çekmecenin önüne uzanan, başlangıçta katlı duran tahta rampa.
  // Rampa, kilit açıldığında 0 → 1 oranında yatay konumuna iner.
  const rampGroup = new THREE.Group();
  rampGroup.position.set(7, 0.62, 6.4);
  rampGroup.rotation.x = -Math.PI / 2; // dik dururken görünmüyor
  group.add(rampGroup);

  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x9c6c3a,
    roughness: 0.78,
    metalness: 0.05,
  });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 7.5), rampMat);
  ramp.position.z = 3.75;
  ramp.castShadow = ramp.receiveShadow = true;
  ramp.userData.collide = true;
  ramp.userData.colliderType = "platform";
  rampGroup.add(ramp);

  // ---- İki pil hücresi (her socket için bir tane) ----
  // Battery A → CRT slot, B → Lock slot. Single shared PointLight
  // at the bench centre illuminates both — saves a Three.js light
  // slot (each extra PointLight increases per-pixel PBR shader cost
  // on every material). Per-pil görünür hareketi animate() içinde
  // hala bağımsız.
  const batteryA = makeBatteryMesh();
  batteryA.position.set(...BATTERY_A_LOCAL);
  batteryA.rotation.z = Math.PI / 6;
  group.add(batteryA);

  const batteryB = makeBatteryMesh();
  batteryB.position.set(...BATTERY_B_LOCAL);
  batteryB.rotation.z = -Math.PI / 6;
  group.add(batteryB);

  // Tek paylaşımlı "sıcak nabız" ışığı — tezgâh merkezinde, iki
  // pili de kapsayacak menzilde.
  const batteryGlow = new THREE.PointLight(0xff9944, 1.25, 10, 1.6);
  batteryGlow.position.set(0, BATTERY_A_LOCAL[1] + 0.6, BATTERY_A_LOCAL[2]);
  group.add(batteryGlow);

  // ---- Taşınan pil görseli (oyuncunun üstünde süzülen kopya) ----
  // group'a eklemiyoruz; Game.js sahneye doğrudan ekleyecek.
  const carryBattery = makeBatteryMesh();
  carryBattery.visible = false;
  const carryBattLight = new THREE.PointLight(0xff9944, 0.0, 5, 1.8);
  carryBattery.add(carryBattLight);

  // ---- Toz partikülleri ----
  buildDustMotes(group);

  // ---- Anahtar konumları (yerel koord. → dünya) ----
  const slotCrtLocal  = new THREE.Vector3(-2.5, 5.05, 1.1);
  const slotLockLocal = new THREE.Vector3(2.6, 4.25, 1.1);
  const screenLocal   = new THREE.Vector3(-6.5, 3.9, 3.5);

  // Yuva lamba durumları: 'off' | 'armed' (pulsing yellow) | 'seated' (solid green)
  const lampState = { crt: "off", lock: "off" };

  const api = {
    group,
    canvas, ctx, screenTex, screenMat,
    crtGlow,
    crtSocketLamp, lockSocketLamp,
    crtSocketBattery, lockSocketBattery,
    lockLeds,
    drawer,
    reward, rewardLight,
    batteryA, batteryB, batteryGlow,
    carryBattery, carryBattLight,
    ramp: rampGroup,

    anchors: {
      batteryA:   () => batteryA.getWorldPosition(new THREE.Vector3()),
      batteryB:   () => batteryB.getWorldPosition(new THREE.Vector3()),
      crtSocket:  () => group.localToWorld(slotCrtLocal.clone()),
      lockSocket: () => group.localToWorld(slotLockLocal.clone()),
      screenFace: () => group.localToWorld(screenLocal.clone()),
    },

    /**
     * Pil mesh görünürlüklerini ayrı ayrı kontrol ediyoruz. Ortak
     * `batteryGlow` ışığı ise ikisi de gizlenince soluyor.
     */
    setBatteryAVisible(v) {
      batteryA.visible = v;
      batteryGlow.intensity = (batteryA.visible || batteryB.visible) ? 1.25 : 0;
    },
    setBatteryBVisible(v) {
      batteryB.visible = v;
      batteryGlow.intensity = (batteryA.visible || batteryB.visible) ? 1.25 : 0;
    },

    setCarrying(v) {
      carryBattery.visible = v;
      carryBattLight.intensity = v ? 1.4 : 0;
    },

    redrawCrt(phase, t) {
      drawCrtFace(ctx, phase, t);
      screenTex.needsUpdate = true;
    },

    setCrtGlow(intensity) {
      const c = THREE.MathUtils.clamp(intensity, 0, 1);
      screenMat.emissive.setRGB(c * 0.05, c * 0.45 + 0.04, c * 0.35);
      screenMat.emissiveIntensity = 0.08 + c * 4.2;
      crtGlow.intensity = c * 3.4;
    },

    setCrtSocketArmed(on) {
      lampState.crt = on ? "armed" : "off";
      crtSocketBattery.visible = false;
    },

    /** Pil yuvaya oturduğunda — lamba katı yeşile döner, pil mesh'i belirir. */
    setCrtSocketSeated(on) {
      lampState.crt = on ? "seated" : "off";
      crtSocketBattery.visible = on;
      if (on) {
        crtSocketLamp.material.emissive.setHex(0x55ff66);
        crtSocketLamp.material.emissiveIntensity = 1.6;
      }
    },

    setLockSocketArmed(on) {
      lampState.lock = on ? "armed" : "off";
      lockSocketBattery.visible = false;
    },

    setLockSocketSeated(on) {
      lampState.lock = on ? "seated" : "off";
      lockSocketBattery.visible = on;
      if (on) {
        lockSocketLamp.material.emissive.setHex(0x55ff66);
        lockSocketLamp.material.emissiveIntensity = 1.6;
      }
    },

    setLockLedsProgress(p) {
      const lim = lockLeds.length;
      lockLeds.forEach((led, i) => {
        const lit = p > (i + 0.5) / lim;
        led.material.emissive.setHex(lit ? 0x44ff66 : 0xff2222);
        led.material.emissiveIntensity = lit ? 1.25 : 0.7;
      });
    },

    setDrawerOpen(p) {
      // Çekmeceyi öne doğru kaydır
      drawer.position.z = 3.05 + p * 3.2;
    },

    revealReward(p) {
      reward.visible = p > 0.02;
      reward.position.y = 3.4 + p * 0.5;
      rewardLight.intensity = p * 2.4;
    },

    setRampDeployed(p) {
      // Rampa dikten yatak konumuna iner
      const targetX = -Math.PI / 2 + p * (Math.PI / 2);
      rampGroup.rotation.x = targetX;
    },

    animate(t) {
      if (batteryA.visible) batteryA.rotation.y = t * 0.7;
      if (batteryB.visible) batteryB.rotation.y = t * 0.7 + Math.PI;
      if (batteryA.visible || batteryB.visible) {
        batteryGlow.intensity = 1.05 + Math.sin(t * 2.4) * 0.2;
      }
      if (carryBattery.visible) {
        carryBattery.rotation.y = t * 1.3;
        carryBattLight.intensity = 1.2 + Math.sin(t * 5.0) * 0.3;
      }
      if (reward.visible) {
        reward.rotation.y = t * 0.5;
        reward.position.y = 3.85 + Math.sin(t * 1.7) * 0.12;
      }
      // LED şerit hafif nefes
      ledStripMat.emissiveIntensity = 0.55 + Math.sin(t * 1.4) * 0.15;

      // ---- Yuva lambaları: durum bazlı yanıp sönme/parlama ----
      // off    → dim red
      // armed  → fast pulsing AMBER/YELLOW (oyuncuya "buraya tak" diyor)
      // seated → solid bright GREEN (kabul edildi)
      _updateSocketLamp(crtSocketLamp,  lampState.crt,  t);
      _updateSocketLamp(lockSocketLamp, lampState.lock, t);

      // Yuvaya takılı pil görsellerini döndür (emissive + bloom
      // yeterli, ek PointLight'a gerek yok)
      if (crtSocketBattery.visible) crtSocketBattery.rotation.y = t * 1.1;
      if (lockSocketBattery.visible) lockSocketBattery.rotation.y = t * 1.1;
    },
  };

  return api;
}

// ============================================================
//  Helpers
// ============================================================
/**
 * Drives the socket lamp's color + intensity from a state string.
 *  off    : dim red — yuva boş ve aranmıyor
 *  armed  : hızlı yanıp sönen sarı/amber — "buraya tak" sinyali
 *  seated : katı parlak yeşil — pil oturmuş ve kabul edilmiş
 */
function _updateSocketLamp(lamp, state, t) {
  if (state === "armed") {
    const pulse = 0.5 + Math.sin(t * 6.5) * 0.5; // 0..1, ~1 Hz
    lamp.material.emissive.setHex(0xffaa22);
    lamp.material.emissiveIntensity = 0.8 + pulse * 1.8;
  } else if (state === "seated") {
    lamp.material.emissive.setHex(0x55ff66);
    lamp.material.emissiveIntensity = 1.6 + Math.sin(t * 1.6) * 0.18;
  } else {
    lamp.material.emissive.setHex(0xff2222);
    lamp.material.emissiveIntensity = 0.45;
  }
}

function makeBatteryMesh() {
  const g = new THREE.Group();
  const amber = new THREE.MeshStandardMaterial({
    color: 0xd4942a,
    emissive: 0x884400,
    emissiveIntensity: 1.0,
    roughness: 0.35,
    metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 16), amber);
  body.position.y = 0.8;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 14), amber);
  cap.position.y = 1.74;
  g.add(cap);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.57, 0.57, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
  );
  band.position.y = 0.6;
  g.add(band);
  return g;
}

function drawCrtFace(ctx, phase, t) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.fillStyle = "#020308";
  ctx.fillRect(0, 0, w, h);

  // --- Statik / parazit ---
  const sa = THREE.MathUtils.clamp(1 - phase * 1.05, 0, 1) * 0.8;
  if (sa > 0.04) {
    const blocks = Math.floor(sa * 480);
    for (let i = 0; i < blocks; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const c = Math.random() * 255 * sa;
      ctx.fillStyle = `rgb(${c | 0},${(c * 1.05) | 0},${(c * 0.92) | 0})`;
      ctx.globalAlpha = 0.15 + Math.random() * 0.55;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // --- Tarama çizgileri ---
  for (let y = 0; y < h; y += 2) {
    const a = 0.05 + Math.sin(t * 0.5 + y * 0.02) * 0.02;
    ctx.fillStyle = `rgba(10,42,62,${a})`;
    ctx.fillRect(0, y, w, 1);
  }

  // --- Ok ve etiket (orta seviye boot'tan sonra) ---
  if (phase > 0.32) {
    const a = THREE.MathUtils.clamp((phase - 0.32) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(140,240,210,0.95)";
    ctx.lineWidth = 4;
    const cx = w * 0.55;
    const cy = h * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy);
    ctx.lineTo(cx + 70, cy);
    ctx.moveTo(cx + 70, cy);
    ctx.lineTo(cx + 50, cy - 22);
    ctx.moveTo(cx + 70, cy);
    ctx.lineTo(cx + 50, cy + 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(220,250,235,0.92)";
    ctx.font = "22px monospace";
    ctx.fillText("CARRY POWER  →", w * 0.18, h * 0.3);
    ctx.font = "14px monospace";
    ctx.fillText("REUSE CELL · DRAWER 04", w * 0.22, h * 0.78);
    ctx.restore();
  }

  // --- Sembol üçlüsü + tarih ---
  if (phase > 0.6) {
    const a = THREE.MathUtils.clamp((phase - 0.6) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,220,170,0.85)";
    ctx.font = "26px monospace";
    ctx.fillText("▲ ● ✕   ·   04-22-1047", w * 0.12, h * 0.92);
    ctx.restore();
  }

  // --- Vinyet ---
  const rg = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.56);
  rg.addColorStop(0.0, "rgba(0,0,0,0)");
  rg.addColorStop(0.7, "rgba(0,4,14,0.25)");
  rg.addColorStop(1.0, "rgba(0,0,0,0.78)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function buildDustMotes(group) {
  const n = 40;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3 + 0] = THREE.MathUtils.randFloatSpread(18);
    pos[i * 3 + 1] = THREE.MathUtils.randFloat(2, 8);
    pos[i * 3 + 2] = THREE.MathUtils.randFloat(-4, 5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xc4dfff,
      size: 0.18,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(pts);
}
