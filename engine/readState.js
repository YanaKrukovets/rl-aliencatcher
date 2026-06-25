// Shared game-state reader. Builds the plain state object consumed by
// engine/obs.js, from the captured live game (cap = {ship, drawState, canvas})
// plus the HUD DOM. Works in BOTH the Node training shim and the real browser,
// since both expose document.getElementById(...).textContent / .innerHTML /
// .classList. One source of truth => training and playback observations match.

function num(doc, id) {
  const el = doc.getElementById(id);
  const n = Number(el && el.textContent);
  return Number.isFinite(n) ? n : 0;
}

function parseLives(doc) {
  const el = doc.getElementById("hud-hearts");
  const html = (el && el.innerHTML) || "";
  const extra = html.match(/hud-extra-lives">\+(\d+)/);
  if (extra) return 5 + Number(extra[1]);
  return (html.match(/#e53e3e/g) || []).length;
}

function isHidden(doc, id) {
  const el = doc.getElementById(id);
  return !!(el && el.classList && el.classList.contains("hidden"));
}

const ent = (cx, cy, extra) => ({ cx, cy, ...extra });

export function readState(doc, cap) {
  cap = cap || {};
  const ship = cap.ship || { x: 365, y: 500, width: 70, height: 50 };
  const ds = cap.drawState || {};
  const W = (cap.canvas && cap.canvas.width) || 800;
  const H = (cap.canvas && cap.canvas.height) || 600;
  const map = (arr, fn) => (arr || []).map(fn);

  const over = !isHidden(doc, "gameover-screen");
  const win = !isHidden(doc, "win-screen");

  return {
    w: W, h: H,
    ship: { cx: ship.x + ship.width / 2, y: ship.y, width: ship.width, height: ship.height },
    score: num(doc, "hud-score"),
    coins: num(doc, "hud-coins"),
    bullets: num(doc, "hud-bullets"),
    shields: num(doc, "hud-shields"),
    level: ds.level || num(doc, "hud-level"),
    lives: parseLives(doc),
    shieldActive: !!ds.shieldActive,
    scrambleFrames: ds.scrambleFrames || 0,
    meteorStormFrames: ds.meteorStormFrames || 0,
    rocks: map(ds.rocks, (r) => ent(r.x + r.width / 2, r.y + r.height / 2, { w: r.width, h: r.height, vy: r.speed, boss: !!r.isBoss, side: r.side === "right" ? 1 : -1 })),
    meteorRocks: map(ds.meteorRocks, (m) => ent(m.x, m.y, { r: m.r, vy: m.speed })),
    aliens: map(ds.aliens, (a) => ent(a.x + a.width / 2, a.y + a.height / 2, { vy: a.onRock ? a.rock.speed : a.fallSpeed, onRock: !!a.onRock, golden: !!a.isGolden, queen: !!a.isQueen })),
    heartAliens: map(ds.heartAliens, (a) => ent(a.x + a.width / 2, a.y + a.height / 2, {})),
    shieldAliens: map(ds.shieldAliens, (a) => ent(a.x + a.width / 2, a.y + a.height / 2, {})),
    bombAliens: map(ds.bombAliens, (a) => ent(a.x + a.width / 2, a.y + a.height / 2, {})),
    reverseAliens: map(ds.reverseAliens, (a) => ent(a.x + a.width / 2, a.y + a.height / 2, {})),
    ufo: ds.ufo ? { cx: ds.ufo.x + ds.ufo.w / 2, cy: ds.ufo.y + ds.ufo.h / 2, hp: ds.ufo.hp } : null,
    gravityWell: ds.gravityWell ? { cx: ds.gravityWell.x, cy: ds.gravityWell.y, radius: ds.gravityWell.radius } : null,
    lastEgg: ds.lastEgg ? { cx: ds.lastEgg.x + ds.lastEgg.width / 2, cy: ds.lastEgg.y + ds.lastEgg.height / 2 } : null,
    over, win, done: over || win,
  };
}
