# RL Alien Catcher — the spaceship is a PPO agent

The spaceship from **AlifallX** (the `aliencatcher` game) driven by a Reinforcement
Learning agent instead of a human. It plays the **real game, with every rule and
hazard** — catching aliens, dodging rocks, surviving meteor storms / UFOs / gravity
wells / scramble, using shoot, shield, and coin buys — learned end-to-end with
**PPO** (Proximal Policy Optimization).

## How it works

The key idea: **the unchanged game is the RL environment.** Rather than
re-implement the game in Python (and risk it diverging), the actual
`game-export/js/main.js` runs **headless in Node.js** during training, and the
**same code** renders in the browser at play time. Training and playback are
guaranteed identical.

```
                 ┌────────────────────────── training ──────────────────────────┐
  train/train.py ──PPO──▶ alien_catcher_env.py ──stdio JSON──▶ bridge/env_server.js
  (stable-baselines3)      (Gymnasium env)                      │
                                                                ▼
                                                    bridge/headless.js
                                                    + bridge/shim.js  (fake DOM,
                                                      controllable clock)
                                                                │ runs UNCHANGED
                                                                ▼
                                                    bridge/game/main.js  ⇐ real game

  export_policy.py ──▶ web/policy.json  (MLP weights, no ML lib needed in browser)

                 ┌────────────────────────── playback ──────────────────────────┐
  web/index.html ─▶ web/main.js (real game, real render)
                    web/ai.js ─▶ policy.js forward pass ─▶ injects actions
```

Observations (`engine/obs.js`) and the state reader (`engine/readState.js`) are
**shared** by the trainer and the browser, so the policy sees the same 100-dim
input in both. `export_policy.py` vendors them into `web/engine/` automatically.

### Agent definition
- **Observation** (100 floats, normalized): ship + lives/coins/bullets/shields/
  level + shield/scramble/storm flags, nearest 6 rocks, 6 aliens, 4 meteors,
  3 bonus aliens, the UFO, the gravity well, and the Last Egg.
- **Action** `MultiDiscrete([3,2,2,4])`: move (left/stay/right) × shoot × shield ×
  buy (none / bullets / shield / life) — the full human control set.
- **Reward**: +score (catches), +0.02·coins, −5 per life lost, +0.01 survival,
  small alignment shaping, −10 on game over, +50 on the Last Egg win.

## Setup

Requires **Node.js** and **Python 3**.

```bash
cd train
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

## Train

```bash
cd train && source venv/bin/activate
python train.py                     # full run (~1–2M steps, 8 envs)
python train.py --timesteps 50000   # quick smoke run
python train.py --n-envs 4          # fewer parallel Node envs
# TensorBoard: tensorboard --logdir ../models/tb
```
Checkpoints + final model land in `models/`.

## Evaluate

```bash
python evaluate.py                  # deterministic rollouts, prints score/level/lives
python evaluate.py --episodes 20 --model ../models/ppo_ckpt_500000_steps.zip
```

## Export the policy for the browser

```bash
python export_policy.py             # writes web/policy.json (+ syncs web/engine/)
```

## Play it in the browser (watch the AI)

```bash
cd web && python3 -m http.server 8080
# open http://localhost:8080
```
The AI auto-starts, plays continuously (auto-restarts on game over), and a badge
shows its live actions.

## Layout

```
engine/      shared logic — entities.js, constants.js (real game), obs.js, readState.js
bridge/      headless training harness
  game/      UNCHANGED main.js + real entities/constants + stub draw/sounds (state capture)
  shim.js    headless browser globals + controllable clock (powers rAF AND timers)
  headless.js  reset()/step()/getState() over the real game
  env_server.js  stdio JSON RL bridge
train/       Gymnasium env + PPO train / evaluate / export scripts
web/         standalone browser playback (the real game, AI-driven) + policy.json
models/      trained checkpoints (gitignored)
```

## Tests

```bash
node bridge/test_random.js     # full games run headlessly with random actions
node bridge/test_policy.js     # browser policy.js matches SB3 exactly (parity)
node web/test_browser.mjs      # headless Chromium: AI auto-plays, no console errors
python train/alien_catcher_env.py   # Python <-> Node bridge smoke test
```

## Notes
- Full action set + every hazard is a large space; training is long and the agent
  keeps improving with more steps. Reward weights live in `engine/obs.js`.
- The game's logic in `bridge/game/main.js` is byte-identical to
  `aliencatcher/game-export/js/main.js` — re-copy if the source game changes.
