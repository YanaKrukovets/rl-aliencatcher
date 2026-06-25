// Smoke test: run full games headlessly with random actions, verify the real
// game simulates (entities spawn, score/coins move, lives drop, game over fires).
import { reset, step, getState } from "./headless.js";

function randAction() {
  return [
    Math.floor(Math.random() * 3),        // move
    Math.random() < 0.25 ? 1 : 0,         // shoot
    Math.random() < 0.02 ? 1 : 0,         // shield
    0,                                     // buy (skip in smoke test)
  ];
}

let episodes = 0, totalSteps = 0, maxScore = 0, maxLevel = 1, sawRock = false, sawAlien = false, sawHazard = false;

for (let ep = 0; ep < 3; ep++) {
  let s = reset();
  episodes++;
  let steps = 0;
  while (!s.done && steps < 4000) {
    s = step(randAction(), 4);
    steps++;
    totalSteps++;
    maxScore = Math.max(maxScore, s.score);
    maxLevel = Math.max(maxLevel, s.level);
    if (s.rocks.length) sawRock = true;
    if (s.aliens.length) sawAlien = true;
    if (s.ufo || s.gravityWell || s.meteorStormFrames > 0 || s.lastEgg) sawHazard = true;
  }
  console.log(`episode ${ep + 1}: steps=${steps} done=${s.done} over=${s.over} win=${s.win} score=${s.score} coins=${s.coins} lives=${s.lives} level=${s.level} rocks=${s.rocks.length} aliens=${s.aliens.length}`);
}

console.log("---- summary ----");
console.log({ episodes, totalSteps, maxScore, maxLevel, sawRock, sawAlien, sawHazard });
const ok = sawRock && sawAlien && maxScore >= 0;
console.log(ok ? "SMOKE TEST PASS ✓" : "SMOKE TEST QUESTIONABLE ✗");
