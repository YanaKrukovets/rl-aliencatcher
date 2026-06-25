"""Evaluate a trained PPO agent on the real game (deterministic rollouts).

  python evaluate.py                       # uses models/ppo_alien_catcher.zip
  python evaluate.py --model models/ppo_ckpt_100000_steps.zip --episodes 20
"""
import argparse
import os
import numpy as np
from stable_baselines3 import PPO

from alien_catcher_env import AlienCatcherEnv

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(os.path.dirname(HERE), "models")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", type=str, default=os.path.join(MODELS_DIR, "ppo_alien_catcher.zip"))
    p.add_argument("--episodes", type=int, default=10)
    p.add_argument("--stochastic", action="store_true")
    args = p.parse_args()

    model = PPO.load(args.model)
    env = AlienCatcherEnv()

    scores, levels, lives_left, returns, lengths, wins = [], [], [], [], [], 0
    for ep in range(args.episodes):
        obs, info = env.reset()
        done = False
        ret = 0.0
        steps = 0
        last = info
        while not done:
            action, _ = model.predict(obs, deterministic=not args.stochastic)
            obs, r, term, trunc, info = env.step(action)
            ret += r
            steps += 1
            last = info
            done = term or trunc
        scores.append(last.get("score", 0))
        levels.append(last.get("level", 1))
        lives_left.append(last.get("lives", 0))
        returns.append(ret)
        lengths.append(steps)
        wins += 1 if last.get("win") else 0
        print(f"ep {ep+1:2d}: score={last.get('score',0):3d} level={last.get('level',1):2d} "
              f"lives_left={last.get('lives',0)} steps={steps:4d} return={ret:7.1f} "
              f"{'WIN' if last.get('win') else ''}")

    env.close()
    print("---- summary over", args.episodes, "episodes ----")
    print(f"mean score : {np.mean(scores):.2f}  (max {np.max(scores)})")
    print(f"mean level : {np.mean(levels):.2f}  (max {np.max(levels)})")
    print(f"mean return: {np.mean(returns):.2f}")
    print(f"mean length: {np.mean(lengths):.0f} steps")
    print(f"wins       : {wins}/{args.episodes}")


if __name__ == "__main__":
    main()
