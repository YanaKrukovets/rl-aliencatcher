// HEADLESS STUB for draw.js — used only by the Node training bridge.
// The browser build uses the real web/draw.js. This stub captures the live game
// state object (ship + drawState) so the RL bridge can read observations, and
// makes drawFrame a no-op (no canvas in Node).
export function createDrawFunctions(ctx, canvas, ship, drawState) {
  globalThis.__cap = { ctx, canvas, ship, drawState };
  return { drawFrame() {} };
}
