"""Gymnasium environment that wraps the real AlifallX game running headless in a
Node.js subprocess (bridge/env_server.js). The agent is the spaceship; the game
runs with ALL its normal rules and hazards. One Node process per env instance.
"""
import json
import subprocess
import os
import atexit
import numpy as np
import gymnasium as gym
from gymnasium import spaces

BRIDGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bridge")
ENV_SERVER = os.path.join(BRIDGE_DIR, "env_server.js")


class AlienCatcherEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, node_bin="node", max_steps=3000):
        super().__init__()
        self.max_steps = max_steps
        self._steps = 0
        self.proc = subprocess.Popen(
            [node_bin, ENV_SERVER],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            cwd=BRIDGE_DIR,
            text=True,
            bufsize=1,
        )
        atexit.register(self.close)

        handshake = self._read()
        if handshake.get("type") != "handshake":
            raise RuntimeError(f"unexpected handshake: {handshake}")
        self.obs_size = handshake["obs_size"]
        self.action_dims = handshake["action_dims"]

        self.observation_space = spaces.Box(
            low=-10.0, high=10.0, shape=(self.obs_size,), dtype=np.float32
        )
        self.action_space = spaces.MultiDiscrete(self.action_dims)

    def _read(self):
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("Node bridge closed unexpectedly")
        return json.loads(line)

    def _write(self, obj):
        self.proc.stdin.write(json.dumps(obj) + "\n")
        self.proc.stdin.flush()

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._steps = 0
        self._write({"cmd": "reset"})
        msg = self._read()
        obs = np.asarray(msg["obs"], dtype=np.float32)
        return obs, msg.get("info", {})

    def step(self, action):
        action = [int(a) for a in np.asarray(action).ravel().tolist()]
        self._write({"cmd": "step", "action": action})
        msg = self._read()
        self._steps += 1
        obs = np.asarray(msg["obs"], dtype=np.float32)
        reward = float(msg["reward"])
        terminated = bool(msg["done"])
        truncated = self._steps >= self.max_steps
        return obs, reward, terminated, truncated, msg.get("info", {})

    def close(self):
        if getattr(self, "proc", None) and self.proc.poll() is None:
            try:
                self.proc.stdin.close()
            except Exception:
                pass
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except Exception:
                self.proc.kill()


if __name__ == "__main__":
    # Quick standalone smoke test of the Python <-> Node bridge.
    env = AlienCatcherEnv()
    obs, info = env.reset()
    print("obs_size:", env.obs_size, "action_dims:", env.action_dims, "obs.shape:", obs.shape)
    total = 0.0
    for i in range(2000):
        a = env.action_space.sample()
        obs, r, term, trunc, info = env.step(a)
        total += r
        if term or trunc:
            print(f"episode end at step {i}: return={total:.2f} info={info}")
            obs, info = env.reset()
            total = 0.0
    env.close()
    print("python bridge smoke test done ✓")
