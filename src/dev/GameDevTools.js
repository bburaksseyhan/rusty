import * as THREE from "three";
import { CHARGE_LAYOUT } from "../gameplay/ChargeFinale.js";

const SCENES = {
  charge: "skipToCharge",
  bolt: "skipToBolt",
  ending: "skipToEnding",
  survey: "skipToEnding",
};

/**
 * Geliştirme kısayolları — yalnızca `npm run dev` (PROD'de kapalı).
 *
 * URL:  ?scene=charge | ?scene=bolt | ?scene=ending
 * Tuş:  F9 şarj finali · F10 jenerik/anket · F8 Bolt diyalogu
 * Konsol: rusty.dev.skipToCharge() vb.
 */
export function attachDevTools(game) {
  if (import.meta.env.PROD) return null;

  const dev = {
    help() {
      console.info(
        [
          "Rusty dev — tam oyun oynamadan test:",
          "  rusty.dev.skipToCharge()  → priz + şarj sahnesi",
          "  rusty.dev.skipToBolt()    → Bolt diyalogu (+ sonra şarj)",
          "  rusty.dev.skipToEnding()  → Bölüm 1 jenerik + anket",
          "  rusty.dev.completeAll()   → hücre + pil bulmacası biter",
          "",
          "URL: ?scene=charge | ?scene=bolt | ?scene=ending",
          "Tuş: F9 şarj · F10 jenerik · F8 Bolt",
        ].join("\n"),
      );
    },

    completeAll() {
      game._devForcePlay();
      game._cellsDone = true;
      game._batteryDone = true;
      game._tryArmFinale?.();
      game.hud.setCells(
        game.world.collectibles.length,
        game.world.collectibles.length,
      );
      game.subtitles.show("Dev: tüm hedefler tamamlandı.", 2500);
    },

    skipToCharge() {
      game._devForcePlay();
      game._cellsDone = true;
      game._batteryDone = true;
      game._finaleArmed = false;
      game._friendSummoned = true;
      game._chargeStarted = false;
      game._endingShown = false;
      game._endingLocked = false;
      if (game._beacon) game._beacon.armed = false;
      if (game._chargeFinale) game._chargeFinale.active = false;

      game.subtitles.hide();
      game.hintBadge.hide();
      game.player.root.position.set(...CHARGE_LAYOUT.rusty);
      game.player.velocity.set(0, 0, 0);
      game.player.cells = game.world.collectibles.length;
      game.hud.setCells(game.player.cells, game.world.collectibles.length);

      game._friend.spawnAt(new THREE.Vector3(...CHARGE_LAYOUT.bolt));
      game._friend.state = "arrived";

      game._startChargeFinale();
      console.info("[rusty dev] Şarj finali başlatıldı.");
    },

    skipToBolt() {
      game._devForcePlay();
      game._cellsDone = true;
      game._batteryDone = true;
      game._finaleArmed = false;
      game._friendSummoned = false;
      game._chargeStarted = false;
      game._endingShown = false;
      if (game._beacon) game._beacon.armed = false;

      game.subtitles.hide();
      game.player.root.position.set(...CHARGE_LAYOUT.notebookMeet);
      game.player.velocity.set(0, 0, 0);
      game.player.cells = game.world.collectibles.length;
      game.hud.setCells(game.player.cells, game.world.collectibles.length);

      game._summonFriend();
      console.info("[rusty dev] Bolt sahnesi — diyalog bitince şarj gelir.");
    },

    skipToEnding() {
      game._devForcePlay();
      game._endingShown = false;
      game._endingLocked = false;
      game._chargeStarted = true;
      if (game._chargeFinale?.active) {
        game._chargeFinale._finish?.();
      }
      game.subtitles.hide();
      game._showEnding();
      console.info("[rusty dev] Jenerik + anket.");
    },
  };

  game.dev = dev;
  window.rusty = { game, dev };

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "F9") {
      e.preventDefault();
      dev.skipToCharge();
    } else if (e.code === "F10") {
      e.preventDefault();
      dev.skipToEnding();
    } else if (e.code === "F8") {
      e.preventDefault();
      dev.skipToBolt();
    }
  });

  const scene = new URLSearchParams(location.search).get("scene");
  const method = scene && SCENES[scene.toLowerCase()];
  if (method) {
    game.title.forceStart();
    setTimeout(() => {
      dev[method]?.();
      history.replaceState({}, "", location.pathname);
    }, 400);
  }

  _showDevBanner();
  dev.help();

  return dev;
}

function _showDevBanner() {
  if (document.getElementById("dev-banner")) return;
  const el = document.createElement("div");
  el.id = "dev-banner";
  el.setAttribute("aria-hidden", "true");
  el.textContent = "Dev: F9 şarj · F8 Bolt · F10 jenerik · ?scene=charge";
  Object.assign(el.style, {
    position: "fixed",
    left: "10px",
    bottom: "10px",
    zIndex: "9998",
    font: "11px/1.4 monospace",
    color: "rgba(200,230,255,0.85)",
    background: "rgba(8,14,22,0.75)",
    padding: "6px 10px",
    borderRadius: "6px",
    pointerEvents: "none",
    border: "1px solid rgba(100,180,255,0.25)",
  });
  document.body.appendChild(el);
}
