"""Train a PPO agent to play the real AlifallX game (catch aliens, dodge rocks,
survive every hazard) via the headless Node bridge.

  python train.py                      # full run (~2M steps)
  python train.py --timesteps 20000    # quick smoke test
  python train.py --n-envs 4
"""
import argparse
import os
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv, VecMonitor
from stable_baselines3.common.callbacks import CheckpointCallback

from alien_catcher_env import AlienCatcherEnv

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(os.path.dirname(HERE), "models")
TB_DIR = os.path.join(MODELS_DIR, "tb")


def make_env():
    return AlienCatcherEnv()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--timesteps", type=int, default=2_000_000)
    p.add_argument("--n-envs", type=int, default=8)
    p.add_argument("--out", type=str, default=os.path.join(MODELS_DIR, "ppo_alien_catcher"))
    p.add_argument("--resume", type=str, default="")
    p.add_argument("--subproc", action="store_true", default=True)
    p.add_argument("--no-subproc", dest="subproc", action="store_false")
    args = p.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)

    vec_cls = SubprocVecEnv if (args.subproc and args.n_envs > 1) else DummyVecEnv
    env = vec_cls([make_env for _ in range(args.n_envs)])
    env = VecMonitor(env)

    if args.resume and os.path.exists(args.resume):
        print(f"resuming from {args.resume}")
        model = PPO.load(args.resume, env=env, tensorboard_log=TB_DIR)
    else:
        model = PPO(
            "MlpPolicy",
            env,
            verbose=1,
            n_steps=2048,
            batch_size=512,
            gamma=0.995,
            gae_lambda=0.95,
            ent_coef=0.01,
            learning_rate=3e-4,
            clip_range=0.2,
            policy_kwargs=dict(net_arch=[256, 256]),
            tensorboard_log=TB_DIR,
        )

    ckpt = CheckpointCallback(
        save_freq=max(20000 // args.n_envs, 1),
        save_path=MODELS_DIR,
        name_prefix="ppo_ckpt",
    )

    try:
        model.learn(total_timesteps=args.timesteps, callback=ckpt, progress_bar=True)
    finally:
        model.save(args.out)
        env.close()
        print(f"saved model -> {args.out}.zip")


if __name__ == "__main__":
    main()
