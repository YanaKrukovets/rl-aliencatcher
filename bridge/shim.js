// Headless browser shim for running the UNCHANGED game (bridge/game/main.js) in
// Node. Provides window/document/navigator/Image/AudioContext plus a fully
// controllable clock that powers requestAnimationFrame AND setTimeout/setInterval,
// so frame-timed gameplay effects (invulnerability i-frames, half-damage reset,
// level banners) advance deterministically as we pump frames.

export const STEP = 1000 / 60;          // ms per fixed game step (matches main.js)
export const CANVAS_W = 800;
export const CANVAS_H = 600;

// ---- controllable clock + scheduler ----
let now = 0;
let timerSeq = 1;
const timers = new Map();   // id -> { cb, time, interval }
let rafSeq = 1;
let rafCbs = new Map();      // id -> cb

function setTimeoutShim(cb, ms = 0, ...args) {
  const id = timerSeq++;
  timers.set(id, { cb: () => cb(...args), time: now + Math.max(0, ms), interval: 0 });
  return id;
}
function setIntervalShim(cb, ms = 0, ...args) {
  const id = timerSeq++;
  const period = Math.max(1, ms);
  timers.set(id, { cb: () => cb(...args), time: now + period, interval: period });
  return id;
}
function clearTimer(id) { timers.delete(id); }

function rafShim(cb) { const id = rafSeq++; rafCbs.set(id, cb); return id; }
function cancelRaf(id) { rafCbs.delete(id); }

// Advance the clock by one frame: fire due timers, then run all pending rAF
// callbacks once with the new timestamp (each re-registers itself for next frame).
export function pumpFrame() {
  now += STEP;
  // Fire timers due at/after this point. Loop because intervals reschedule and
  // a fired callback may schedule new near-term timers.
  let guard = 0;
  while (guard++ < 10000) {
    let dueId = -1, dueTime = Infinity;
    for (const [id, t] of timers) {
      if (t.time <= now && t.time < dueTime) { dueTime = t.time; dueId = id; }
    }
    if (dueId === -1) break;
    const t = timers.get(dueId);
    if (t.interval > 0) t.time += t.interval; else timers.delete(dueId);
    try { t.cb(); } catch (e) { /* swallow — matches browser console.error */ }
  }
  const batch = [...rafCbs.values()];
  rafCbs = new Map();
  for (const cb of batch) { try { cb(now); } catch (e) { /* ignore draw/icon errors */ } }
}

export function clockNow() { return now; }

// ---- no-op 2D context (Proxy: any method is a no-op, gradients are inert) ----
function makeCtx() {
  const gradient = { addColorStop() {} };
  const target = {
    canvas: null,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    getImageData: () => ({ data: [] }),
    measureText: () => ({ width: 0 }),
    save() {}, restore() {},
  };
  return new Proxy(target, {
    get(o, k) {
      if (k in o) return o[k];
      // Unknown property read: return a no-op function (covers fillRect, arc, etc.)
      return () => {};
    },
    set() { return true; },   // swallow fillStyle/globalAlpha/etc assignments
  });
}

// ---- fake DOM element ----
class FakeClassList {
  constructor() { this._set = new Set(); }
  add(...c) { c.forEach((x) => this._set.add(x)); }
  remove(...c) { c.forEach((x) => this._set.delete(x)); }
  contains(c) { return this._set.has(c); }
  toggle(c, force) {
    const want = force === undefined ? !this._set.has(c) : force;
    if (want) this._set.add(c); else this._set.delete(c);
    return want;
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.textContent = "";
    this.innerHTML = "";
    this.title = "";
    this.width = CANVAS_W;
    this.height = CANVAS_H;
    this.offsetWidth = CANVAS_W;
    this.offsetHeight = CANVAS_H;
    this._handlers = {};
    this._ctx = null;
  }
  getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; }
  addEventListener(type, fn) { (this._handlers[type] ||= []).push(fn); }
  removeEventListener(type, fn) {
    if (this._handlers[type]) this._handlers[type] = this._handlers[type].filter((h) => h !== fn);
  }
  dispatchEvent(ev) { (this._handlers[ev.type] || []).forEach((h) => h(ev)); return true; }
  click() { this.dispatchEvent({ type: "click", preventDefault() {}, target: this }); }
  appendChild() {} removeChild() {} setAttribute() {} getAttribute() { return null; }
  querySelectorAll() { return []; }
  focus() {} blur() {}
}

// ---- document ----
const elements = new Map();
function getElementById(id) {
  if (!elements.has(id)) elements.set(id, new FakeElement(id));
  return elements.get(id);
}

const documentShim = {
  getElementById,
  querySelectorAll: () => [],
  createElement: () => new FakeElement(),
  addEventListener() {}, removeEventListener() {},
  body: new FakeElement("body"),
};

// ---- window ----
const winHandlers = {};
const windowShim = {
  addEventListener(type, fn) { (winHandlers[type] ||= []).push(fn); },
  removeEventListener(type, fn) {
    if (winHandlers[type]) winHandlers[type] = winHandlers[type].filter((h) => h !== fn);
  },
  dispatchEvent(ev) { (winHandlers[ev.type] || []).forEach((h) => h(ev)); return true; },
};

// Synthetic keyboard event into the game's window keydown/keyup listeners.
export function fireKey(type, key) {
  windowShim.dispatchEvent({ type, key, preventDefault() {}, target: windowShim });
}

class FakeImage { constructor() { this.onload = null; } set src(_v) { /* never loads */ } get src() { return ""; } }

class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createOscillator() { return new Proxy({}, { get: () => () => {} }); }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {} }, connect() {} }; }
}

// ---- install globals (call before importing the game) ----
function defineGlobal(name, value) {
  try { globalThis[name] = value; }
  catch { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
}

export function installShim() {
  const navShim = { maxTouchPoints: 0, userAgent: "node" };
  globalThis.window = windowShim;
  globalThis.document = documentShim;
  defineGlobal("navigator", navShim);
  globalThis.Image = FakeImage;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  windowShim.AudioContext = FakeAudioContext;
  windowShim.webkitAudioContext = FakeAudioContext;
  windowShim.navigator = navShim;

  defineGlobal("requestAnimationFrame", rafShim);
  defineGlobal("cancelAnimationFrame", cancelRaf);
  defineGlobal("setTimeout", setTimeoutShim);
  defineGlobal("setInterval", setIntervalShim);
  defineGlobal("clearTimeout", clearTimer);
  defineGlobal("clearInterval", clearTimer);
  if (!globalThis.performance) defineGlobal("performance", { now: () => now });
}

export { getElementById };
