// HEADLESS STUB for sounds.js — used only by the Node training bridge.
// No audio in Node: every sound function is a no-op. The browser build uses the
// real web/sounds.js.
export function createSounds() {
  // Any destructured play* function resolves to a no-op.
  return new Proxy({}, { get: () => () => {} });
}

export function createBackgroundMusic() {
  return {
    bgGain: { gain: { setTargetAtTime() {} } },
    start() {},
    stop() {},
  };
}
