// Stdio JSON bridge: wraps the headless game as an RL environment for Python.
// Protocol (newline-delimited JSON on stdin/stdout):
//   <- on startup: {"type":"handshake","obs_size":N,"action_dims":[...]}
//   -> {"cmd":"reset"}                      <- {"obs":[...],"info":{...}}
//   -> {"cmd":"step","action":[m,sh,sd,by]} <- {"obs":[...],"reward":r,"done":b,"info":{...}}
import readline from "node:readline";
import { reset, step, getState } from "./headless.js";
import { buildObservation, computeReward, OBS_SIZE, ACTION_DIMS } from "../engine/obs.js";

const FRAME_SKIP = 4;
let prev = null;
let epReturn = 0, epLen = 0;

function out(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

function infoFrom(s) {
  return { score: s.score, coins: s.coins, lives: s.lives, level: s.level, over: s.over, win: s.win };
}

// handshake
out({ type: "handshake", obs_size: OBS_SIZE, action_dims: ACTION_DIMS });

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if (msg.cmd === "reset") {
    const s = reset();
    prev = s;
    epReturn = 0; epLen = 0;
    out({ obs: buildObservation(s), info: infoFrom(s) });
    return;
  }

  if (msg.cmd === "step") {
    const s = step(msg.action, FRAME_SKIP);
    const reward = computeReward(prev, s);
    prev = s;
    epReturn += reward; epLen += 1;
    const done = s.done;
    const info = infoFrom(s);
    if (done) { info.episode = { r: epReturn, l: epLen }; }
    out({ obs: buildObservation(s), reward, done, info });
    return;
  }

  if (msg.cmd === "ping") { out({ pong: true }); return; }
});
