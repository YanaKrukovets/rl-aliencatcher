// Tiny MLP forward pass for the exported PPO policy. No ML library.
// Mirrors SB3: policy MLP (tanh) -> action head (linear) -> per-MultiDiscrete-chunk
// argmax (deterministic action). Shared by the browser game; also runnable in Node.

function linear(x, layer) {
  const { W, b, act } = layer;            // W: [out][in], b: [out]
  const out = new Array(W.length);
  for (let o = 0; o < W.length; o++) {
    const row = W[o];
    let s = b[o];
    for (let i = 0; i < row.length; i++) s += row[i] * x[i];
    out[o] = act === "tanh" ? Math.tanh(s) : act === "relu" ? Math.max(0, s) : s;
  }
  return out;
}

export function createPolicy(json) {
  const { mlp, action_head, action_dims, obs_size } = json;

  function forward(obs) {
    let x = obs;
    for (const layer of mlp) x = linear(x, layer);
    const logits = linear(x, { ...action_head, act: "linear" });
    // split logits into chunks per action dimension, argmax each
    const action = [];
    let off = 0;
    for (const dim of action_dims) {
      let best = 0, bestv = -Infinity;
      for (let i = 0; i < dim; i++) {
        const v = logits[off + i];
        if (v > bestv) { bestv = v; best = i; }
      }
      action.push(best);
      off += dim;
    }
    return action;
  }

  return { forward, action_dims, obs_size };
}
