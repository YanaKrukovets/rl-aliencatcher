// Headless driver for the UNCHANGED game (bridge/game/main.js).
// Boots the game under the browser shim, then exposes reset()/step()/getState()
// for the RL bridge. All gameplay rules/hazards are exactly the real game's.

import { installShim, pumpFrame, fireKey, getElementById, CANVAS_W, CANVAS_H } from "./shim.js";
import { readState } from "../engine/readState.js";
import { maskAction } from "../engine/obs.js";

installShim();
// Import AFTER shim install so the game's top-level (DOM wiring, boot) sees globals.
await import("./game/main.js");

const COUNTDOWN_PUMPS = 182;   // readyFrames(180) + slack before gameplay begins

let started = false;

function keys() { return globalThis.__cap?.drawState?.keys || {}; }

// ---- action: [move(0=L,1=stay,2=R), shoot(0/1), shield(0/1), buy(0..3)] ----
function applyAction(action) {
  action = maskAction(action || [1, 0, 0, 0], readState(globalThis.document, globalThis.__cap));
  const [move = 1, shoot = 0, shield = 0, buy = 0] = action;
  const k = keys();
  k["ArrowLeft"] = move === 0;
  k["ArrowRight"] = move === 2;
  k["a"] = false; k["d"] = false;
  if (shoot) tap(" ");
  if (shield) tap("s");
  if (buy === 1) tap("1");
  else if (buy === 2) tap("2");
  else if (buy === 3) tap("3");
}

function tap(key) { fireKey("keydown", key); fireKey("keyup", key); }

export function getState() {
  return readState(globalThis.document, globalThis.__cap);
}

export function reset() {
  if (!started) { getElementById("start-btn").click(); started = true; }
  else { getElementById("restart-btn").click(); }
  // clear held movement
  const k = keys();
  if (k) { k["ArrowLeft"] = false; k["ArrowRight"] = false; }
  for (let i = 0; i < COUNTDOWN_PUMPS; i++) pumpFrame();
  return getState();
}

// Advance one agent step = apply action, then pump `frameSkip` game frames.
export function step(action, frameSkip = 4) {
  applyAction(action);
  for (let i = 0; i < frameSkip; i++) {
    pumpFrame();
    if (getState().done) break;
  }
  return getState();
}
