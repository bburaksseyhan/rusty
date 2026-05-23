import * as THREE from "three";

import { createRenderer, createCamera } from "./Renderer.js";
import { ATMOSPHERE, NARRATION, PLAYER } from "./config.js";

import { createEnvironment } from "../assets/textures.js";
import { setupLighting } from "../world/lighting.js";
import { buildLevel1 } from "../world/Level1.js";

import { Player } from "../entities/Player.js";
import { EmotionSystem } from "../entities/EmotionSystem.js";
import { Friend } from "../entities/Friend.js";

import { Input } from "../systems/Input.js";
import { CameraRig } from "../systems/CameraRig.js";
import { Physics } from "../systems/Physics.js";
import { Audio } from "../systems/Audio.js";
import { PostFX } from "../systems/PostFX.js";

import { Collectibles } from "../gameplay/Collectibles.js";
import { Hazards } from "../gameplay/Hazards.js";
import { EmotionalTriggers } from "../gameplay/EmotionalTriggers.js";
import { CrtMonitorPuzzle } from "../gameplay/CrtMonitorPuzzle.js";
import { BatteryTransferPuzzle } from "../gameplay/BatteryTransferPuzzle.js";
import { Pushables } from "../gameplay/Pushables.js";
import { DeskNails } from "../gameplay/DeskNails.js";
import { DeskToggles } from "../gameplay/DeskToggles.js";

import { HUD } from "../ui/HUD.js";
import { Subtitles } from "../ui/Subtitles.js";
import { TitleScreen } from "../ui/TitleScreen.js";
import { Objective } from "../ui/Objective.js";
import { HintBadge } from "../ui/HintBadge.js";
import { ControlsHelp } from "../ui/ControlsHelp.js";
import { MobileControls } from "../ui/MobileControls.js";
import { DeskScrews } from "../gameplay/DeskScrews.js";
import { EndingScreen } from "../ui/EndingScreen.js";
import { ChargeFinale } from "../gameplay/ChargeFinale.js";
import { submitFeedback } from "../api/feedback.js";

import {
  MEMORY_FRAGMENTS,
  createMemoryFragment,
} from "../world/props/memoryFragment.js";

// Pre-allocated scratch vector for finale proximity check — avoids
// per-frame garbage.
const TMP_MEET = new THREE.Vector3();

// ============================================================
//  Level 1 stage definitions
// ============================================================
const LEVEL1_STAGES = [
  {
    label: "RGB Klavye",
    z: 30,
    goal: "Tuşların üzerinden geç ve USB kablo köprüsüne ulaş.",
    speech:
      "Bip. Sistemler açık. Klavyenin üstündeyim. Tuşların üzerinden yürü ve mousepad'e inmek için USB kablosunu kullan.",
  },
  {
    label: "USB Köprüsü",
    z: 17,
    goal: "Kablo köprüsünden mousepad'e geç.",
    speech:
      "Kablo köprüsü algılandı. Gerilim normal. İleri git, aşağı bakma.",
  },
  {
    label: "Mousepad",
    z: 6,
    goal: "Yan basamaklardan oyun faresine tırman.",
    speech:
      "Yumuşak zemin. Oyun faresi tam önde. Yan basamaklardan yukarı çık.",
  },
  {
    label: "Oyun Faresi",
    z: -2,
    goal: "Fareden kupa kulesine zıpla. Fanlara dikkat!",
    speech:
      "Enerji hücresi alındı. Sağdaki dönen fana dikkat. Kupa kulesine doğru ilerle.",
  },
  {
    label: "Kupa Kulesi",
    z: -20,
    goal: "Kupa kenarındaki çıkıntılardan kenara çık.",
    speech:
      "Porselen kule. Yan çıkıntılar basamak. Basamaktan basamağa zıpla, kenara ulaş. Kahve var. Muhtemelen soğuk.",
  },
  {
    label: "Defter Yığını",
    z: -40,
    goal: "Spirallerden spirale defter yığınına tırman.",
    speech:
      "İleride kağıt dağları. Spiralden spirale. Son durak monitör standı.",
  },
  {
    label: "Monitör Standı",
    z: -55,
    goal: "Basamak kitaplardan monitör platformuna çık.",
    speech:
      "Neredeyse evde. Basamak kitaplardan monitör standına çık. Son hücre yukarıda. Bip bop.",
  },
];

const OPENING_LINES = [
  "Rusty klavyede uyanıyor. Bütün masa uyuyor.",
  "Kablo köprüsünün ötesinde mousepad bir pist gibi parlıyor.",
  "Kupa bir kule gibi yükseliyor. Defterler dağ.",
  "Yukarıda — monitör standı. Eve giden yol orası.",
  "Pencerenin dışında yağmur. Bir yerde fan dönmeye devam ediyor.",
];

// ============================================================
//  Friend Arrival — Bolt's appearance after Level 1 completion.
//
//  Bolt is Kai's second, unfinished robot — smaller, blue-lit,
//  tucked behind the monitor for 1,047 days. The completed
//  energy-cell loop powers him on. He walks to Rusty and
//  delivers the briefing for Chapter Two.
//
//  Chapter Two preview (lore):
//    The desk edge. A drop to the carpet — a forest of dust,
//    lost coins, and a sleeping cat named "Mochi". Past the
//    door is a hallway, a staircase, and finally Kai's
//    closed bedroom door. A gap underneath: just wide enough
//    for two small robots.
// ============================================================
// Bolt now meets Rusty on top of the notebook stack — a quiet,
// elevated reunion point the player navigates to after BOTH the
// cell loop and the battery transfer puzzle are complete.
//
// Notebook stack origin in Level1.js: [-10, 0, -40], top platform
// at NOTEBOOK_TOP_Y (≈4). Bolt spawns to the +X side and walks in.
const NOTEBOOK_MEET_POINT = [-10, 4.05, -40];
// Bolt SPAWNS at notebook surface (y=4), not the beacon point.
// Friend.update locks y, so spawning at y=7 used to make him
// glide in from mid-air — now he stands on the books.
const FRIEND_SPAWN        = [-2, 4.0, -40];
const NOTEBOOK_MEET_RADIUS = 7.0;                  // proximity that triggers Bolt
const FRIEND_DELAY_MS     = 1400;                  // beat between proximity → reveal

const FRIEND_DIALOGUE = [
  {
    speech:
      "Rusty! Başardın. Gerçekten başardın. " +
      "Bin kırk yedi gündür bekliyordum.",
    subtitle: "Masada ikinci bir ışık yanıp sönüyor. Bu sefer mavi.",
  },
  {
    speech:
      "Benim adım Bolt. Kai beni senden hemen sonra yaptı — daha küçük, " +
      "ikinci. Tam bitmedi. Beni monitörün arkasına sakladılar.",
    subtitle: "İki robot. Aynı yapımcı. Aynı bekleme.",
  },
  {
    speech:
      "Hücrelerin beni uyandırdı. Zirveye ulaştığın an akımı hissettim. " +
      "Teşekkürler.",
    subtitle: "Enerji eski tellerden geçer. Yıllar boyunca.",
  },
  {
    speech:
      "Dinle. Masa sadece ilk oda. Yarın daha uzağa gideceğiz. " +
      "Kenarın ötesine. Halıya aşağı.",
    subtitle: "Bölüm İki: Zemin.",
  },
  {
    speech:
      "Koridordan. Merdivenlerden yukarı. Bir kapı var — " +
      "Kai'nin yatak odası. Kapalı ama altında bir boşluk var. " +
      "Sığarız.",
    subtitle: "Eve giden yolun gerçekten başladığı yer.",
  },
  {
    speech:
      "Şimdi dinlen Rusty. Hücrelerini şarj et. Lamba yeniden tık diye yandığında " +
      "— birlikte gideceğiz.",
    subtitle: "Birinci bölümün sonu.",
  },
];

// ============================================================
//  Rusty's Introduction — spoken once at game start.
//
//  Short, warm self-introduction in Rusty's robot voice. He
//  waves on the greeting line, then teases the deeper story
//  the player can unlock with Q. Keep this brief — the full
//  background (Kai, 1,047 days, the note) lives in RUSTY_STORY.
// ============================================================
const RUSTY_INTRO = [
  "Merhaba. Hoş geldin. Ben Rusty. Bip… bop.",
  "Bu masada yapıldım. Üç hafta, Kai adında bir arkadaş tarafından.",
  "Bu gece çok uzun bir uykudan sonra uyandım. Eve giden yolu arıyorum.",
  "Tüm hikâyemi duymak için Q'ya bas. Takılırsan E'ye bas.",
];

// Memory fragment pickup radius (world units)
const FRAGMENT_PICKUP_RADIUS = 3.5;

// ============================================================
//  Rusty's Story — told in segments, cycling on each Q press.
//
//  Rusty was handcrafted over three weeks by a seventeen-year-old
//  named Kai, who carved the body from scrap balsa and maple,
//  wound the joints with salvaged wire, soldered in a flickering
//  LED from a broken toy, and pressed a USB port into the back
//  as a joke — "so you can connect to anything." Rusty lived on
//  Kai's keychain for two years: every classroom, every bus ride,
//  every late night at this very desk. Then one October morning,
//  Kai packed a single bag. Something had happened. Something big.
//  The keys landed on the desk. The door closed.
//  That was one thousand and forty-seven days ago.
//  Rusty's clock just rebooted.
// ============================================================
const RUSTY_STORY = [
  {
    speech:
      "Benim adım Rusty. Seri numarası… bilinmiyor. " +
      "Üretici: bir insan. On yedi yaşında. Adı: Kai.",
    subtitle:
      "Biri beni yaptı. Özenle. Küçük ellerle ve çok sabırla.",
  },
  {
    speech:
      "Bu masadan oyuldum. Şuradaki kalem — " +
      "kokusunu tanıyorum. O talaşlar benim parçam.",
    subtitle:
      "Bu yerden yapıldım. Her ahşap damarı. Her çizik.",
  },
  {
    speech:
      "İki yıl anahtarlıkta yaşadım. Her yere gittim. " +
      "Okul. Kahve dükkanları. Sabah üçte bir otobüs.",
    subtitle:
      "Pencerede yağmur gördüm. Sınav kağıtları. Uykusuzluktan sonra ilk gün doğumu.",
  },
  {
    speech:
      "Sonra bir Salı… gittiler. Hızlı. Çantayı toplarken " +
      "ellerinin titrediğini gördüm. Tek bir çanta.",
    subtitle:
      "Kapı kapandı. Anahtarlar buraya düştü. Sessizlik başladı.",
  },
  {
    speech:
      "Dediler: senin için geri döneceğim. " +
      "O gün bin kırk yedi gün önceydi. Saydım.",
    subtitle:
      "Bin kırk yedi sabah bekleme. Lamba bir daha yanmadı.",
  },
  {
    speech:
      "Bu masada bir yerde bir not var. Ezberledim. " +
      "Diyor ki: eve yolunu bul, küçük olan.",
    subtitle:
      "Bir gün uyanıp okuyabilecek bir robota bırakılmış not.",
  },
  {
    speech:
      "Evin nerede olduğunu bilmiyorum. Ama bulmak için yapıldığımı biliyorum. " +
      "Ve biliyorum… Kai hâlâ dışarıda. Bir yerde.",
    subtitle:
      "Amaç. Kai bana bunu verdi. Amaç ve çok iyi bir el sallama.",
  },
];

// ============================================================
//  Game — composition root.
// ============================================================

export class Game {
  constructor(canvas) {
    // --- Render foundation ---
    this.renderer = createRenderer(canvas);
    this.scene    = this._createScene();
    this.camera   = createCamera();

    // --- Systems ---
    this.input    = new Input(canvas);
    this.physics  = new Physics();
    this.audio    = new Audio();
    this.cameraRig = new CameraRig(this.camera, this.input);
    this.postFX   = new PostFX(this.renderer, this.scene, this.camera);

    // --- Emotion ---
    this.emotion = new EmotionSystem();

    // --- World ---
    setupLighting(this.scene);
    this.world = buildLevel1(this.scene);

    // --- Memory Fragments ---
    this._fragments = this._spawnMemoryFragments();

    // --- Player ---
    this.player = new Player({
      audio:   this.audio,
      physics: this.physics,
      input:   this.input,
    });
    // Give robot access to emotion derived data
    this.player.setEmotionDerived(this.emotion.derived);
    this.scene.add(this.player.root);
    this.player.spawn(PLAYER.spawn, PLAYER.facing);

    // --- Emotional environment triggers ---
    this.emotionTriggers = new EmotionalTriggers({
      onSubtitle: (text, ms) => this.subtitles.show(text, ms),
      audio:      this.audio,
    });

    // --- UI ---
    this.hud       = new HUD();
    this.subtitles = new Subtitles();
    this.title     = new TitleScreen();
    this.objective = new Objective({ autoHideMs: 10000 });
    this.objective.setStages(LEVEL1_STAGES.map((s) => s.label));
    this.objective.setCurrent(0);
    this.hintBadge = new HintBadge();
    this.controlsHelp = new ControlsHelp();
    this.mobileControls = new MobileControls({ input: this.input });
    this.endingScreen = new EndingScreen();

    this.crtMonitorPuzzle = this.world.crtSecret
      ? new CrtMonitorPuzzle({
          crt:       this.world.crtSecret,
          player:    this.player,
          subtitles: this.subtitles,
          hintBadge: this.hintBadge,
          audio:     this.audio,
          emotion:   this.emotion,
          cameraRig: this.cameraRig,
        })
      : null;

    this.batteryTransferPuzzle = this.world.batteryTransferRig
      ? new BatteryTransferPuzzle({
          rig:       this.world.batteryTransferRig,
          player:    this.player,
          subtitles: this.subtitles,
          hintBadge: this.hintBadge,
          audio:     this.audio,
          emotion:   this.emotion,
          cameraRig: this.cameraRig,
        })
      : null;

    this.hud.setCells(0, this.world.collectibles.length);
    this.hud.setHealth(this.player.health);
    this._currentStage = 0;

    // --- Gameplay systems ---
    this.collectibles = new Collectibles(this.world.collectibles, this.player)
      .onPickup((_cell, picked, total) => this._onPickup(picked, total))
      .onComplete(() => this._onCellsComplete());

    this.hazards = new Hazards(this.world.hazards, this.player).onHit(() =>
      this._onHit()
    );

    this.pushables = new Pushables();
    for (const g of this.world.pushableGroups) {
      this.pushables.register(g, { radius: 11, pushStrength: 4 });
    }

    this.deskNails = new DeskNails({
      hintBadge: this.hintBadge,
      audio: this.audio,
      subtitles: this.subtitles,
    });
    for (const nail of this.world.deskNailProps) {
      this.deskNails.add(nail);
    }

    this.deskToggles = new DeskToggles({
      subtitles: this.subtitles,
      audio: this.audio,
    });
    for (const fan of this.world.fanProps) {
      this.deskToggles.addFan(fan);
    }
    if (this.world.monitorProp) {
      this.deskToggles.addMonitor(this.world.monitorProp);
    }

    this.deskScrews = new DeskScrews({
      subtitles: this.subtitles,
      audio: this.audio,
      hintBadge: this.hintBadge,
      electricRig: this.world.screwElectricRig,
      onCountChange: (current, total) => this.hud.setScrews(current, total),
    });
    for (const screw of this.world.deskScrewProps) {
      this.deskScrews.add(screw);
    }

    // Pil aktarım puzzle'ı bittiğinde de finale geçit kontrolüne haber ver.
    this.batteryTransferPuzzle?.onComplete?.(() => this._onBatteryComplete());

    this._started     = false;
    this._clock       = new THREE.Clock();
    this._storyIndex  = 0;     // cycles through RUSTY_STORY on each Q press
    this._storyLocked = false; // prevents overlapping story playback

    // ---- Finale gating ----
    // Both must be true before Bolt is summoned to the notebook top.
    this._cellsDone      = false;
    this._batteryDone    = false;
    this._finaleArmed    = false; // beacon active, waiting for player
    this._beacon         = this._createNotebookBeacon();
    // Bolt is built upfront and parked WAY off-camera. Constructing
    // Robot the first time at completion-time used to spike the frame
    // (~150 ms) because it generates two 1024² wood-grain canvases.
    // Doing it during initial setup folds that cost into the title
    // screen, where it's invisible.
    //
    // We *teleport* him out of sight rather than toggling
    // `root.visible` — visibility changes would alter the scene's
    // active-light count and force every PBR material in the scene
    // to recompile when he's later revealed.
    this._friend = new Friend();
    this._friend.spawnAt(new THREE.Vector3(0, -500, 0));
    this.scene.add(this._friend.root);
    this._friendSummoned = false;

    this._chargeFinale = new ChargeFinale({
      scene: this.scene,
      player: this.player,
      friend: this._friend,
      subtitles: this.subtitles,
      audio: this.audio,
      emotion: this.emotion,
      camera: this.camera,
      beacon: this._beacon,
    }).onComplete(() => this._showEnding());

    this._bindLifecycle();
  }

  start() {
    this.title.whenStarted(() => this._begin());
    this._tick();
  }

  /** Dev araçları: başlık + intro atlanır, oyun döngüsü açık */
  _devForcePlay() {
    this.title.forceStart();
    if (!this._started) {
      this._started = true;
      this.controlsHelp.setVisible(true);
      this.mobileControls.setVisible(true);
      this.audio.init();
      this.audio.startMusic();
    }
    this.subtitles.hide();
    this.input.setEnabled(true);
    this._endingLocked = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  // ----------------------------------------------------------
  _begin() {
    this._started = true;
    this.controlsHelp.setVisible(true);
    this.mobileControls.setVisible(true);
    this.audio.init();
    this.audio.startMusic();

    // Rusty wakes up — curious, a little lonely
    this.emotion.trigger("explore", 0.6);
    this.emotion.trigger("idle", 0.3);

    this._playIntro();
  }

  /**
   * Plays Rusty's opening self-introduction.
   *
   * Sequence:
   *   1. Short breath while the camera settles.
   *   2. Wave gesture + "Hello… I am Rusty." in robot voice.
   *   3. Two more sentences setting up his backstory at a glance.
   *   4. Control hint ("Press E / Press Q").
   *   5. Ambient world-narration whispers (OPENING_LINES) take
   *      over once the intro is fully spoken.
   *
   * All timing is derived from each line's typewriter duration
   * so subtitles never overlap, even if RUSTY_INTRO text changes.
   */
  _playIntro() {
    const { perCharMs, holdShort, holdLong, lineGap, openingIntervalMs, openingLineMs } =
      NARRATION;
    const INITIAL_DELAY = 1200;

    let delay = INITIAL_DELAY;
    RUSTY_INTRO.forEach((line, i) => {
      const isLast = i === RUSTY_INTRO.length - 1;
      setTimeout(() => {
        if (i === 0) this.player.robot.wave();
        this.subtitles.speak(line, {
          perCharMs,
          holdMs: isLast ? holdLong : holdShort,
          onChar: () => this.audio.robotBlip(0.78 + Math.random() * 0.5),
        });
      }, delay);
      delay +=
        line.length * perCharMs + (isLast ? holdLong : holdShort + lineGap);
    });

    setTimeout(() => {
      this.subtitles.scheduleOpening(
        OPENING_LINES,
        openingIntervalMs,
        openingLineMs,
      );
    }, delay + 4000);
  }

  _tick = () => {
    const dt = Math.min(0.05, this._clock.getDelta());
    const t  = this._clock.elapsedTime;

    if (this._started && this._chargeFinale?.active) {
      this.emotion.update(dt, { moving: false });
      this._chargeFinale.update(dt, t);
      this._chargeFinale.applyCamera();
      this.world.update(t, dt);
      if (this._beacon) this._updateBeacon(dt, t);
      this.postFX.render(dt);
      requestAnimationFrame(this._tick);
      return;
    }

    if (this._started && !this._endingLocked) {
      const moving = Math.hypot(
        this.player.velocity.x, this.player.velocity.z
      ) > 0.5;

      // ---- Emotion update ----
      this.emotion.update(dt, { moving });
      this.emotionTriggers.update(this.player.root.position, this.emotion, dt);

      // ---- Player + world ----
      this._handleInteract();
      this._handleStory();
      this.player.update(dt, this.cameraRig.yaw, this.world.colliders);
      this.world.update(t, dt);

      // ---- Memory fragment animate & pickup ----
      this._updateFragments(t);

      // ---- Friend (Bolt) arrival & idle ----
      if (this._friend) {
        this._friend.update(dt, this.player.root.position);
      }

      // ---- Gameplay ----
      this.collectibles.update();
      this.hazards.update(dt);
      if (this.crtMonitorPuzzle)      this.crtMonitorPuzzle.update(dt, t);
      if (this.batteryTransferPuzzle) this.batteryTransferPuzzle.update(dt, t);

      // ---- Finale beacon + proximity → summon Bolt ----
      this._updateBeacon(dt, t);
      this._updateFinaleProximity();

      this.pushables?.update(
        dt,
        this.player.root.position,
        PLAYER.radius,
      );
      this.deskNails?.update(this.player, t);
      this.deskScrews?.update(this.player, t, dt);

      // ---- Camera ----
      // forwardIntent = how aligned the player's horizontal velocity is
      // with the camera-forward axis. Drives the auto-align gate so
      // that strafe (A/D) and reverse (S) DON'T trigger a camera spin
      // — only walking forward gently re-centres the view.
      let forwardIntent = 0;
      if (moving) {
        const vx = this.player.velocity.x;
        const vz = this.player.velocity.z;
        const vlen = Math.hypot(vx, vz);
        if (vlen > 0.01) {
          const camYaw = this.cameraRig.yaw;
          forwardIntent =
            (vx * Math.sin(camYaw) + vz * Math.cos(camYaw)) / vlen;
        }
      }
      this.cameraRig.update(dt, this.player.root.position, {
        facingYaw: this.player.root.rotation.y,
        forwardIntent,
      });
      this._updateCurrentStage();
    }

    this.postFX.render(dt);
    requestAnimationFrame(this._tick);
  };

  // ----------------------------------------------------------
  //  Memory Fragments
  // ----------------------------------------------------------
  _spawnMemoryFragments() {
    const fragments = [];
    for (const def of MEMORY_FRAGMENTS) {
      const { group, animate, collect } = createMemoryFragment(def.type, def.emotionType);
      group.position.set(...def.position);
      this.scene.add(group);
      fragments.push({ group, animate, collect, def, collected: false });
    }
    return fragments;
  }

  _updateFragments(t) {
    const playerPos = this.player.root.position;

    for (const frag of this._fragments) {
      if (frag.collected) continue;

      frag.animate(t);

      const dist = playerPos.distanceTo(frag.group.position);
      if (dist < FRAGMENT_PICKUP_RADIUS) {
        frag.collected = true;
        frag.collect(); // fade out

        this.emotion.onMemoryFound();
        this.audio.memoryReveal();
        this.subtitles.speak(frag.def.subtitle, {
          perCharMs: NARRATION.perCharMs,
          holdMs: NARRATION.holdLong,
          onChar: () => {},
        });
        this.hintBadge.show(frag.def.hintText, 8000);

        // Slight camera tension — handled via emotion (DOF blurs slightly)
        setTimeout(() => this.audio.hopeSwell(), 2000);
      }
    }
  }

  // ----------------------------------------------------------
  //  Stage system
  // ----------------------------------------------------------
  _handleInteract() {
    const pressed = this.input.consumeInteract();
    if (!pressed) return;

    if (this.objective.isVisible()) {
      this.objective.hide();
      this.subtitles.hide();
      return;
    }

    const t = this._clock.elapsedTime;
    const pPos = this.player.root.position;
    // Vida → pil/CRT bulmacaları → fan/monitör (atölyede fan E'yi yemesin)
    if (this.deskScrews?.tryInteract(pPos, t)) return;
    if (this.batteryTransferPuzzle?.tryInteract?.()) return;
    if (this.crtMonitorPuzzle?.tryInteract?.()) return;
    if (this.deskToggles?.tryInteract(pPos)) return;

    const stage = LEVEL1_STAGES[this._currentStage];
    this.objective.show();
    this.hintBadge.show(stage.goal, 14000);
    this.subtitles.speak(stage.speech, {
      perCharMs: NARRATION.perCharMs,
      holdMs: NARRATION.holdShort,
      onChar: () => this.audio.robotBlip(0.9 + Math.random() * 0.35),
    });
    // Briefing makes Rusty feel more confident / curious
    this.emotion.trigger("explore", 0.4);
  }

  // ----------------------------------------------------------
  /**
   * Q key — Rusty waves and narrates the next segment of their story.
   *
   * Each press advances through RUSTY_STORY in order (cycling after
   * the last entry). Locked while a previous segment is still playing
   * so voices never overlap.
   *
   * Rusty's story (background):
   *   Built by Kai, age 17, over three weeks from desk scraps.
   *   Lived on a keychain for two years. One October morning Kai
   *   packed one bag and left. 1,047 days of silence. Tonight
   *   Rusty's clock rebooted. Somewhere out there, Kai's note reads:
   *   "Find your way home, little one."
   */
  _handleStory() {
    if (!this.input.consumeStory()) return;
    if (this._storyLocked) return;

    const segment = RUSTY_STORY[this._storyIndex % RUSTY_STORY.length];
    this._storyIndex++;

    // Start the wave gesture immediately
    this.player.robot.wave();

    // Spike hope + curiosity — this feels meaningful to Rusty
    this.emotion.trigger("memory", 0.5);
    this.emotion.trigger("explore", 0.3);

    // Lock while speaking; unlock when subtitle hold ends
    this._storyLocked = true;
    const totalMs = this.subtitles.speak(segment.speech, {
      perCharMs: NARRATION.perCharMs,
      holdMs: NARRATION.holdShort,
      onChar: (ch) => {
        // Alternate pitch slightly per character for expressive robot voice
        const pitch = 0.75 + Math.random() * 0.55;
        this.audio.robotBlip(pitch);
      },
    });

    // Show the poetic subtitle line after the speech ends
    setTimeout(() => {
      this.subtitles.show(segment.subtitle, NARRATION.holdLong);
    }, totalMs + 200);

    // Unlock slightly before the full subtitle hold clears so it
    // feels responsive without cutting the current line
    setTimeout(() => {
      this._storyLocked = false;
    }, totalMs + 2000);
  }

  _updateCurrentStage() {
    const z = this.player.root.position.z;
    let current = 0;
    for (let i = 0; i < LEVEL1_STAGES.length; i++) {
      if (z <= LEVEL1_STAGES[i].z + 4) current = i;
    }
    if (current !== this._currentStage) {
      this._currentStage = current;
      this.objective.setCurrent(current);
      this.hintBadge.show(LEVEL1_STAGES[current].goal, 6000);
      // Reaching a new zone: excitement spike
      this.emotion.trigger("explore", 0.5);
    }
  }

  // ----------------------------------------------------------
  _createScene() {
    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(ATMOSPHERE.background);
    scene.fog = new THREE.FogExp2(ATMOSPHERE.fogColor, ATMOSPHERE.fogDensity);
    const envMap = createEnvironment(this.renderer);
    scene.environment = envMap;
    scene.environmentIntensity = ATMOSPHERE.envIntensity;
    return scene;
  }

  _bindLifecycle() {
    window.addEventListener("resize", () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.postFX.setSize(w, h);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.audio.pause();
      else this.audio.resume();
    });
  }

  // ---- Event handlers ---------------------------------------
  _onPickup(picked, total) {
    this.audio.collect();
    this.emotion.onCellCollected();
    this.hud.setCells(picked, total);

    if (picked < total) {
      this.subtitles.show(
        _pickupLine(picked, total, this.emotion.confidence),
        3200
      );
    }
  }

  // ----------------------------------------------------------
  //  Finale gating — Bolt only arrives after BOTH the cell loop
  //  and the battery transfer puzzle are complete. He no longer
  //  appears behind the monitor; instead, a beacon lights up the
  //  notebook stack and the player must climb to him there.
  // ----------------------------------------------------------
  _onCellsComplete() {
    if (this._cellsDone) return;
    this._cellsDone = true;
    this.emotion.trigger("hope", 0.8);
    this.emotion.gainConfidence(0.2);
    this.audio.hopeSwell();
    this.subtitles.show(
      "Tüm hücreler toplandı. Rusty hafifçe uğulduyor — atölyede bir görev kaldı.",
      5200,
    );
    this._tryArmFinale();
  }

  _onBatteryComplete() {
    if (this._batteryDone) return;
    this._batteryDone = true;
    this.emotion.trigger("memory", 0.7);
    this.subtitles.show(
      "Atölye çekmecesi açık duruyor. Akım eski bakırda şarkı söylüyor.",
      4600,
    );
    this._tryArmFinale();
  }

  /**
   * Both objectives complete → light the notebook beacon and
   * call the player up. Bolt is NOT spawned yet; he waits until
   * the player physically reaches the notebook top.
   */
  _tryArmFinale() {
    if (this._finaleArmed) return;
    if (!this._cellsDone || !this._batteryDone) return;
    this._finaleArmed = true;

    // Light the beacon (ramp intensity from 0 — light was
    // pre-allocated to keep the scene's active-light count stable
    // and avoid a PBR material recompile when it turns on.)
    this._beacon.armed = true;

    this.audio.memoryReveal();
    this.emotion.trigger("hope", 1.0);
    this.emotion.gainConfidence(0.15);

    this.subtitles.show(
      "Defter yığınının üstünde mavi bir ışık yanıp sönüyor. Orada bir şey var.",
      6200,
    );
    this.hintBadge.show(
      "Defter yığınına çık — üstte bir arkadaş bekliyor.",
      16000,
    );
  }

  /**
   * Per-frame check while the beacon is armed but Bolt hasn't
   * been summoned yet. As soon as the player gets within
   * NOTEBOOK_MEET_RADIUS of the meet point, Bolt arrives.
   */
  _updateFinaleProximity() {
    if (!this._finaleArmed || this._friendSummoned) return;
    const meet = TMP_MEET;
    meet.set(...NOTEBOOK_MEET_POINT);
    const d = meet.distanceTo(this.player.root.position);
    if (d < NOTEBOOK_MEET_RADIUS) {
      // Player has arrived at the meeting point — fade the beacon
      // and summon Bolt next to them.
      this._beacon.armed = false;
      setTimeout(() => this._summonFriend(), FRIEND_DELAY_MS);
    }
  }

  /**
   * Spawns Bolt behind the monitor stand and begins the arrival
   * cinematic. Idempotent — only fires the first time the player
   * completes the level.
   *
   * Sequence:
   *   1. Create Friend (Robot with "bolt" palette).
   *   2. Place at FRIEND_SPAWN, reveal, walk toward Rusty.
   *   3. On arrival: play FRIEND_DIALOGUE sequentially with a
   *      higher-pitched blip voice + poetic subtitle lines.
   *   4. Rusty waves back on the second line.
   *
   * Bolt is purely visual — no colliders, no physics. He floats
   * to Rusty along a straight line on the y=13 platform plane.
   */
  _summonFriend() {
    if (this._friendSummoned) return;
    // Hard guard: even if some future call path leaks past the
    // gating logic, Bolt only ever appears once BOTH objectives are
    // resolved. The cell loop must be complete AND the workshop
    // drawer must have opened.
    if (!this._cellsDone || !this._batteryDone) return;
    this._friendSummoned = true;

    // Teleport Bolt onto the notebook top, a few units beside Rusty.
    // No visibility toggle = no shader recompile (lights stay in the
    // scene's active-light list, just relocated).
    this._friend.spawnAt(new THREE.Vector3(...FRIEND_SPAWN));

    // Soft chime as Bolt powers on
    this.audio.memoryReveal();
    this.subtitles.show(
      "Rusty'nin yanındaki kağıt dağında ikinci bir ışık titreyerek uyanıyor.",
      4500,
    );

    // After the chime, walk over to Rusty and start the briefing
    setTimeout(() => {
      this._friend.arriveTo(this.player.root.position, () => {
        this._playFriendDialogue();
      });
    }, 1800);
  }

  // ----------------------------------------------------------
  //  Notebook Beacon — small floating light that ignites on top
  //  of the notebook stack when both objectives are complete.
  //
  //  Pre-allocated at game start with intensity 0 (NOT visibility
  //  toggled) so the scene's active-light count never changes,
  //  avoiding PBR material recompiles when the beacon ignites.
  // ----------------------------------------------------------
  _createNotebookBeacon() {
    const root = new THREE.Group();
    root.name = "NotebookBeacon";
    root.position.set(
      NOTEBOOK_MEET_POINT[0],
      NOTEBOOK_MEET_POINT[1] + 1.8,
      NOTEBOOK_MEET_POINT[2],
    );

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6ff,
        emissive: 0x4ab8ff,
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0.15,
      }),
    );
    orb.visible = false;            // hidden until the finale arms
    root.add(orb);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0x6ad1ff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    );
    halo.visible = false;
    root.add(halo);

    // No PointLight on the beacon — relying on the strong emissive
    // orb + bloom for the visible glow. Adding another light to the
    // already-crowded scene was eating frame time on integrated GPUs.
    // Toggling mesh.visible on these is safe (no light count change,
    // so no PBR shader recompile).
    this.scene.add(root);

    return { root, orb, halo, armed: false, _glow: 0 };
  }

  /** Per-frame beacon animation — ramp glow when armed, pulse always. */
  _updateBeacon(dt, t) {
    const b = this._beacon;
    if (!b) return;

    // Visibility gate: orb + halo are only ever rendered while the
    // beacon is armed or fading out. This prevents a faint blue
    // sphere from appearing on top of the notebook stack at game
    // start (the user reported seeing a "ball" there).
    if (!b.armed && b._glow < 0.01) {
      if (b.orb.visible)  b.orb.visible  = false;
      if (b.halo.visible) b.halo.visible = false;
      return;
    }
    if (!b.orb.visible)  b.orb.visible  = true;
    if (!b.halo.visible) b.halo.visible = true;

    const target = b.armed ? 1.0 : 0.0;
    b._glow += (target - b._glow) * Math.min(1, dt * 2.2);
    const pulse = 0.7 + Math.sin(t * 2.8) * 0.3;
    b.orb.material.emissiveIntensity = b._glow * 5.0 * pulse;
    b.halo.material.opacity = b._glow * 0.45 * pulse;
    b.root.position.y =
      NOTEBOOK_MEET_POINT[1] + 1.8 + Math.sin(t * 1.4) * 0.18;
  }

  /**
   * Plays Bolt's full chapter-two briefing as a sequential
   * dialogue. Each line uses a higher pitch range to distinguish
   * his voice from Rusty's. Rusty waves back on line 2 to
   * acknowledge the reunion.
   */
  _playFriendDialogue() {
    const { perCharMs, holdShort, holdLong, lineGap } = NARRATION;

    // Bolt waves on arrival; Rusty hopeful spike
    this.emotion.trigger("memory", 0.8);
    this.emotion.trigger("hope", 0.6);

    let delay = 600;
    FRIEND_DIALOGUE.forEach((line, i) => {
      const isLast = i === FRIEND_DIALOGUE.length - 1;

      setTimeout(() => {
        this.subtitles.speak(line.speech, {
          perCharMs,
          holdMs: isLast ? holdLong : holdShort,
          // Higher pitch range — Bolt is smaller, voice is brighter
          onChar: () => this.audio.robotBlip(1.35 + Math.random() * 0.55),
        });

        // Rusty waves back on the reunion line
        if (i === 1) this.player.robot.wave();

        // After each speech, show the poetic subtitle on a brief hold
        const speechMs = line.speech.length * perCharMs;
        setTimeout(() => {
          this.subtitles.show(line.subtitle, isLast ? holdLong + 2000 : holdShort);
        }, speechMs + 400);
      }, delay);

      delay +=
        line.speech.length * perCharMs
        + (isLast ? holdLong : holdShort + lineGap + 800);
    });

    // Son replikten sonra priz + şarj sahnesi, ardından jenerik.
    setTimeout(() => this._startChargeFinale(), delay + 800);
  }

  /**
   * Bölüm 1 kapanışı — priz belirir, Rusty ve Bolt şarj olur.
   */
  _startChargeFinale() {
    if (this._chargeStarted || this._endingShown) return;
    this._chargeStarted = true;

    this.hintBadge.hide();
    this.controlsHelp.setVisible(false);
    this.mobileControls.setVisible(false);
    this.objective.hide?.();
    this.input.setEnabled(false);
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    if (this._beacon) this._beacon.armed = false;

    document.getElementById("loading")?.classList.add("gone");
    document.getElementById("title-screen")?.classList.add("gone");

    this._chargeFinale.start();
  }

  /**
   * Closing sequence — fades the desk under a cinematic overlay,
   * rolls a short credits list, then surfaces a feedback survey.
   * Pauses the title/HUD audio so the moment lands quietly.
   */
  _showEnding() {
    if (this._endingShown) return;
    this._endingShown = true;
    this._endingLocked = true;
    this.controlsHelp.setVisible(false);
    this.mobileControls.setVisible(false);

    this.input.setEnabled(false);
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    const hud = document.getElementById("hud");
    if (hud) hud.style.pointerEvents = "none";

    // Soft musical sting so the cut isn't silent
    this.audio.memoryReveal?.();

    this.endingScreen.show((answers) => {
      submitFeedback(answers);
    });
  }

  _onHit() {
    this.audio.hit();
    this.emotion.onHit();
    this.hud.setHealth(this.player.health);
    this.subtitles.show(
      _hitLine(this.emotion.e.fear),
      3500
    );
  }
}

// ---- Contextual text helpers ---------------------------------

function _pickupLine(picked, total, confidence) {
  const lines = [
    "Rusty'nin içinde bir enerji hücresi uğulduyor…",
    "Sıcaklık. Bir şey yerine oturuyor.",
    `${picked} / ${total}. Yol netleşiyor.`,
    "Rusty'nin gözleri bir an daha parlak yanıyor.",
    "Bulunan her parça bir adım daha.",
  ];
  // Early game: wonder. Late game: purposeful.
  const idx = confidence < 0.4
    ? Math.floor(Math.random() * 2)
    : 2 + Math.floor(Math.random() * 3);
  return lines[Math.min(idx, lines.length - 1)];
}

function _hitLine(fearLevel) {
  if (fearLevel > 0.6) return "Acıdı. Şu an her şey çok büyük hissediliyor…";
  if (fearLevel > 0.3) return "Fan kanatları! Dikkatli ol.";
  return "Dikkat — o kanatlar keskin.";
}
