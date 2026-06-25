// Shared observation + reward builder. Imported by BOTH the Node training bridge
// and the browser playback (web/), so the policy sees identical inputs in training
// and at play time. Input is the plain state object from headless.getState().

export const ACTION_DIMS = [3, 2, 2, 4]; // move(L/stay/R), shoot, shield, buy(none/bullets/shield/life)

// Hard action rule applied identically in training and playback so behavior is
// consistent: the shield only deflects meteor-storm rocks, so it may ONLY be
// activated while a meteor storm is active. Returns a (possibly) modified action.
export function maskAction(action, state) {
  const a = action.slice();
  const stormActive = (state.meteorStormFrames || 0) > 0;
  if (!stormActive) a[2] = 0; // suppress shield outside a meteor storm
  return a;
}

const K_ROCK = 6, K_ALIEN = 6, K_METEOR = 4, K_BONUS = 3;
export const OBS_SIZE = 9 + K_ROCK * 5 + K_ALIEN * 5 + K_METEOR * 3 + K_BONUS * 3 + 3 + 4 + 3; // = 100

// Sort by vertical position (lowest on screen = most imminent) and take nearest K.
function nearest(list, k, shipY) {
  return [...list]
    .sort((a, b) => (b.cy) - (a.cy))
    .slice(0, k);
}

export function buildObservation(s) {
  const W = s.w || 800, H = s.h || 600;
  const shipCx = s.ship.cx, shipY = s.ship.y;
  const o = [];

  // ---- ship / meta (9) ----
  o.push(
    (shipCx / W) * 2 - 1,
    s.lives / 5,
    Math.min(s.coins, 500) / 500,
    Math.min(s.bullets, 100) / 100,
    s.shields / 5,
    Math.min(s.level, 20) / 20,
    s.shieldActive ? 1 : 0,
    s.scrambleFrames > 0 ? 1 : 0,
    s.meteorStormFrames > 0 ? 1 : 0,
  );

  // ---- rocks (K_ROCK * 5) ----
  const rocks = nearest(s.rocks, K_ROCK, shipY);
  for (let i = 0; i < K_ROCK; i++) {
    const r = rocks[i];
    if (r) o.push((r.cx - shipCx) / W, (r.cy - shipY) / H, r.vy / 10, r.w / 300, r.boss ? 1 : 0);
    else o.push(0, 0, 0, 0, 0);
  }

  // ---- aliens (K_ALIEN * 5) ----
  const aliens = nearest(s.aliens, K_ALIEN, shipY);
  for (let i = 0; i < K_ALIEN; i++) {
    const a = aliens[i];
    if (a) o.push((a.cx - shipCx) / W, (a.cy - shipY) / H, a.vy / 10, a.onRock ? 1 : 0, (a.golden || a.queen) ? 1 : 0);
    else o.push(0, 0, 0, 0, 0);
  }

  // ---- meteor rocks (K_METEOR * 3) ----
  const meteors = nearest(s.meteorRocks, K_METEOR, shipY);
  for (let i = 0; i < K_METEOR; i++) {
    const m = meteors[i];
    if (m) o.push((m.cx - shipCx) / W, (m.cy - shipY) / H, m.vy / 12);
    else o.push(0, 0, 0);
  }

  // ---- bonus aliens: heart / shield / bomb (K_BONUS * 3) ----
  const bonus = [
    ...s.heartAliens.map((a) => ({ ...a, kind: 1 })),
    ...s.shieldAliens.map((a) => ({ ...a, kind: 2 })),
    ...s.bombAliens.map((a) => ({ ...a, kind: 3 })),
  ];
  const bonusN = nearest(bonus, K_BONUS, shipY);
  for (let i = 0; i < K_BONUS; i++) {
    const b = bonusN[i];
    if (b) o.push((b.cx - shipCx) / W, (b.cy - shipY) / H, b.kind / 3);
    else o.push(0, 0, 0);
  }

  // ---- UFO (3) ----
  if (s.ufo) o.push(1, (s.ufo.cx - shipCx) / W, (s.ufo.cy - shipY) / H);
  else o.push(0, 0, 0);

  // ---- gravity well (4) ----
  if (s.gravityWell) o.push(1, (s.gravityWell.cx - shipCx) / W, (s.gravityWell.cy - shipY) / H, s.gravityWell.radius / 300);
  else o.push(0, 0, 0, 0);

  // ---- last egg (3) ----
  if (s.lastEgg) o.push(1, (s.lastEgg.cx - shipCx) / W, (s.lastEgg.cy - shipY) / H);
  else o.push(0, 0, 0);

  return o;
}

// Reward from the transition prev -> s. Mirrors the real game's incentives:
// catch aliens (+score), earn coins (+), avoid losing lives (--), survive (+),
// win/lose terminals.
export function computeReward(prev, s) {
  if (!prev) return 0;
  let r = 0;
  r += (s.score - prev.score) * 1.0;        // each catch raises score
  r += (s.coins - prev.coins) * 0.02;       // coin pickups / shooting payouts
  const dLives = s.lives - prev.lives;
  if (dLives < 0) r += dLives * 5.0;        // -5 per life lost (rock/hazard hit)
  else if (dLives > 0) r += dLives * 1.0;   // small + for gaining a life
  r += 0.01;                                // survival bonus per step

  // light shaping: align under the nearest catchable alien
  const aliens = s.aliens.filter((a) => a.cy > 40);
  if (aliens.length) {
    const t = aliens.reduce((a, b) => (b.cy > a.cy ? b : a));
    r -= Math.abs(t.cx - s.ship.cx) / (s.w || 800) * 0.05;
  }

  if (s.over) r -= 10.0;
  if (s.win) r += 50.0;
  return r;
}
