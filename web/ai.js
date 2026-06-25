// Browser AI driver: plays the REAL game (main.js) using the exported PPO policy.
// Reads live game state (same reader as training), builds the same observation,
// runs the policy forward pass, and injects actions through the game's own input
// (keys + synthetic keydown events) — exactly mirroring the training bridge.

import { readState } from "./engine/readState.js";
import { buildObservation, maskAction } from "./engine/obs.js";
import { createPolicy } from "./policy.js";

const FRAME_SKIP = 4;          // re-decide every 4 frames (matches training)
const MOVE_NAMES = ["◀ left", "■ stay", "right ▶"];

let policy = null;
let framesSinceDecision = 0;
let lastAction = [1, 0, 0, 0];
let started = false;
let restartTimer = 0;

function fireKey(type, key) {
  // The game listens on window for keydown/keyup.
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

function applyAction(action) {
  const cap = window.__cap;
  if (!cap || !cap.drawState) return;
  action = maskAction(action, readState(document, cap));   // shield only during meteor storm
  const k = cap.drawState.keys;
  const [move = 1, shoot = 0, shield = 0, buy = 0] = action;
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

function setBadge(state, action) {
  const badge = document.getElementById("ai-badge");
  if (!badge) return;
  badge.innerHTML =
    `<b>🤖 AI playing (PPO)</b>` +
    `<span>move: ${MOVE_NAMES[action[0]]}</span>` +
    `<span>${action[1] ? "🔫 shoot " : ""}${action[2] ? "🛡 shield " : ""}${action[3] ? "🪙 buy" : ""}</span>` +
    `<span>score ${state.score} · lvl ${state.level} · ❤ ${state.lives}</span>`;
}

function loop() {
  requestAnimationFrame(loop);
  if (!policy) return;

  // Auto-start, and auto-restart shortly after game over / win.
  const startScreen = document.getElementById("start-screen");
  if (!started) {
    if (startScreen && !startScreen.classList.contains("hidden")) {
      document.getElementById("start-btn").click();
      started = true;
    }
    return;
  }

  const cap = window.__cap;
  if (!cap || !cap.drawState) return;
  const state = readState(document, cap);

  if (state.done) {
    if (restartTimer++ > 90) {           // ~1.5s pause on the end screen
      restartTimer = 0;
      const btn = !state.win ? document.getElementById("restart-btn")
                             : document.getElementById("win-restart-btn");
      if (btn) btn.click();
    }
    return;
  }
  restartTimer = 0;

  if (framesSinceDecision % FRAME_SKIP === 0) {
    const obs = buildObservation(state);
    lastAction = policy.forward(obs);
    setBadge(state, lastAction);
  }
  framesSinceDecision++;
  applyAction(lastAction);   // hold movement keys every frame
}

async function boot() {
  const res = await fetch("policy.json");
  const json = await res.json();
  policy = createPolicy(json);
  requestAnimationFrame(loop);
}

boot();
