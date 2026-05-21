import { inject } from "@vercel/analytics";
import { Game } from "./core/Game.js";

if (import.meta.env.PROD) {
  inject();
}

// ============================================================
//  Entry point — instantiate the Game and start the loop.
//  All wiring lives inside `Game`; this file stays boring on
//  purpose so the bootstrap path is obvious.
// ============================================================

const canvas = document.getElementById("scene");
const game = new Game(canvas);
game.start();

// Expose for quick debugging from the devtools console.
if (typeof window !== "undefined") window.__rusty = game;
