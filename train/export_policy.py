"""Export a trained SB3 PPO policy to web/policy.json so the browser can run the
exact same policy with a tiny hand-written MLP forward pass (no ML lib).

Also writes a handful of (obs -> action) samples used by bridge/test_policy.js to
verify the JS forward pass matches SB3 bit-for-bit.

  python export_policy.py
  python export_policy.py --model models/ppo_ckpt_500000_steps.zip
"""
import argparse
import json
import os
import shutil
import numpy as np
import torch
import torch.nn as nn
from stable_baselines3 import PPO

from alien_catcher_env import AlienCatcherEnv

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS_DIR = os.path.join(ROOT, "models")
WEB_DIR = os.path.join(ROOT, "web")


def act_name(module):
    if isinstance(module, nn.Tanh):
        return "tanh"
    if isinstance(module, nn.ReLU):
        return "relu"
    return None


def extract_sequential(seq):
    """Turn an nn.Sequential of Linear/activation into a list of layer dicts."""
    layers = []
    pending = None
    for m in seq:
        if isinstance(m, nn.Linear):
            pending = {
                "W": m.weight.detach().cpu().numpy().tolist(),  # [out, in]
                "b": m.bias.detach().cpu().numpy().tolist(),
                "act": "linear",
            }
            layers.append(pending)
        else:
            a = act_name(m)
            if a and pending is not None:
                pending["act"] = a
    return layers


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", type=str, default=os.path.join(MODELS_DIR, "ppo_alien_catcher.zip"))
    p.add_argument("--out", type=str, default=os.path.join(WEB_DIR, "policy.json"))
    p.add_argument("--samples", type=int, default=64)
    args = p.parse_args()

    model = PPO.load(args.model, device="cpu")
    policy = model.policy

    # Shared/policy MLP feature extractor (net_arch pi branch) + action head.
    mlp_layers = extract_sequential(policy.mlp_extractor.policy_net)
    action_net = policy.action_net  # Linear(latent -> sum(action_dims))
    action_head = {
        "W": action_net.weight.detach().cpu().numpy().tolist(),
        "b": action_net.bias.detach().cpu().numpy().tolist(),
    }

    action_dims = list(model.action_space.nvec.tolist())
    obs_size = int(model.observation_space.shape[0])

    # Collect real observations and SB3's deterministic actions for a parity test.
    env = AlienCatcherEnv()
    obs, _ = env.reset()
    samples = []
    for _ in range(args.samples):
        action, _ = model.predict(obs, deterministic=True)
        samples.append({"obs": np.asarray(obs, dtype=np.float64).tolist(),
                        "action": [int(a) for a in np.asarray(action).ravel().tolist()]})
        obs, _, term, trunc, _ = env.step(action)
        if term or trunc:
            obs, _ = env.reset()
    env.close()

    out = {
        "obs_size": obs_size,
        "action_dims": action_dims,
        "mlp": mlp_layers,
        "action_head": action_head,
        "samples": samples,
    }
    os.makedirs(WEB_DIR, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f)

    # Keep the browser build self-contained and in sync: vendor the shared engine
    # modules (single source of truth in engine/) into web/engine/.
    engine_src = os.path.join(ROOT, "engine")
    engine_dst = os.path.join(WEB_DIR, "engine")
    os.makedirs(engine_dst, exist_ok=True)
    for fn in ("obs.js", "readState.js"):
        shutil.copyfile(os.path.join(engine_src, fn), os.path.join(engine_dst, fn))

    print(f"wrote {args.out}")
    print("  synced web/engine/{obs.js, readState.js}")
    print(f"  obs_size={obs_size} action_dims={action_dims} "
          f"mlp_layers={[ (len(l['W'][0]), len(l['W']), l['act']) for l in mlp_layers ]} "
          f"action_head=({len(action_head['W'][0])}->{len(action_head['W'])}) samples={len(samples)}")


if __name__ == "__main__":
    main()
