// AlifallX — standalone entry point.
// Vanilla-JS port of pages/game.js: the React HUD/overlay state is replaced
// by direct DOM updates; the game loop itself is unchanged.

import { getLevelColor } from "./constants.js";
import { createSounds, createBackgroundMusic } from "./sounds.js";
import { createEntityClasses } from "./entities.js";
import { createDrawFunctions } from "./draw.js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

// ---- DOM ----
const el = (id) => document.getElementById(id);
const dom = {
  canvas: el("game-canvas"),
  starfield: el("starfield-canvas"),
  score: el("hud-score"),
  level: el("hud-level"),
  coins: el("hud-coins"),
  bullets: el("hud-bullets"),
  bulletsGroup: el("hud-bullets-group"),
  shields: el("hud-shields"),
  shieldsGroup: el("hud-shields-group"),
  lives: el("hud-lives"),
  hearts: el("hud-hearts"),
  buyLife: el("buy-life-btn"),
  buyBullets: el("buy-bullets-btn"),
  buyShield: el("buy-shield-btn"),
  pauseBtn: el("pause-btn"),
  muteBtn: el("mute-btn"),
  touchControls: el("touch-controls"),
  startScreen: el("start-screen"),
  startBtn: el("start-btn"),
  levelupOverlay: el("levelup-overlay"),
  levelupInner: el("levelup-inner"),
  levelupSub: el("levelup-sub"),
  levelupNum: el("levelup-num"),
  countdownOverlay: el("countdown-overlay"),
  countdownNum: el("countdown-num"),
  gameoverScreen: el("gameover-screen"),
  gameoverKicker: el("gameover-kicker"),
  gameoverTitle: el("gameover-title"),
  gameoverEggNote: el("gameover-egg-note"),
  gameoverScore: el("gameover-score"),
  gameoverCoins: el("gameover-coins"),
  gameoverLevel: el("gameover-level"),
  restartBtn: el("restart-btn"),
  winScreen: el("win-screen"),
  winScore: el("win-score"),
  winCoins: el("win-coins"),
  winLevel: el("win-level"),
  winRestartBtn: el("win-restart-btn"),
};

// ---- SHARED REFS (mirror the React useRefs) ----
const buyBulletsRef = { current: false };
const buyLivesRef = { current: false };
const buyShieldsRef = { current: false };
const soundEnabledRef = { current: true };
const pausedRef = { current: false };
const audioCtxRef = { current: null };
const bgGainRef = { current: null };
const touchControlsRef = { current: {} };
let touchFireInterval = null;

// ---- HUD STATE (mirror of React state, for screens and mobile buys) ----
const hud = {
  score: 0, coins: 0, bullets: 50, shields: 2, lives: 3, level: 1,
  halfDamage: false, eggWasShot: false,
  gameActive: false, isGameOver: false,
};

function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // force reflow so the animation restarts
  node.classList.add(className);
}

function heartSvg(filled, half, idx) {
  const path = "M12 21.6C11.6 21.5 2 15.7 2 8.5 2 4.2 4.2 2 7 2c1.6 0 3 .8 4 2A5 5 0 0 1 17 2c2.8 0 5 2.2 5 6.5 0 7.2-9.6 13-10 13.1z";
  const clipId = `hud-half-${idx}`;
  return `<svg width="18" height="17" viewBox="0 0 24 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${half ? `<defs><clipPath id="${clipId}"><rect x="0" y="0" width="12" height="22"/></clipPath></defs>` : ""}
    <path d="${path}" fill="rgba(255,255,255,0.12)"/>
    ${(filled || half) ? `<path d="${path}" fill="#e53e3e"${half ? ` clip-path="url(#${clipId})"` : ""}/>` : ""}
  </svg>`;
}

function renderHearts() {
  const { lives, halfDamage } = hud;
  const slots = Math.min(Math.max(lives, 3), 5);
  let html = "";
  for (let i = 0; i < slots; i++) {
    const filled = i < (halfDamage ? lives - 1 : lives);
    const half = halfDamage && i === lives - 1;
    html += heartSvg(filled, half, i);
  }
  if (lives > 5) html += `<span class="hud-extra-lives">+${lives - 5}</span>`;
  dom.hearts.innerHTML = html;
  dom.lives.classList.toggle("hud-lives--danger", lives <= 1);
}

function updateBuyButtons() {
  dom.buyLife.disabled = hud.coins < 200;
  dom.buyBullets.disabled = hud.coins < 100;
  dom.buyShield.disabled = hud.coins < 70;
}

// ---- UI SETTERS (same names as the React state setters so the loop code ports verbatim) ----
function setScore(v) { hud.score = v; dom.score.textContent = v; }
function setLevel(v) { hud.level = v; dom.level.textContent = v; }
function setCoins(v) { hud.coins = v; dom.coins.textContent = v; updateBuyButtons(); }
function setBullets(v) {
  hud.bullets = v;
  dom.bullets.textContent = v;
  dom.bullets.style.color = v === 0 ? "#ff4444" : v < 5 ? "#ffcc66" : "#fff";
  dom.bulletsGroup.classList.toggle("hud-ammo-group--warn", v < 5);
}
function setShields(v) {
  hud.shields = v;
  dom.shields.textContent = v;
  dom.shields.style.color = v === 0 ? "#ff4444" : "#fff";
  dom.shieldsGroup.classList.toggle("hud-ammo-group--warn", v === 0);
}
function setLives(v) { hud.lives = v; renderHearts(); }
function setHalfDamage(v) { hud.halfDamage = v; renderHearts(); }
function setLifeGained(v) { if (v) restartAnimation(dom.lives, "hud-lives--gain"); }
function setEggWasShot(v) { hud.eggWasShot = v; }
function setIsPaused(v) {
  dom.pauseBtn.textContent = v ? "▶️" : "⏸️";
  dom.pauseBtn.title = v ? "Resume (P)" : "Pause (P)";
}

function setLevelUpBanner(lvl) {
  if (lvl === null) { dom.levelupOverlay.classList.add("hidden"); return; }
  const color = getLevelColor(lvl);
  dom.levelupSub.style.color = color;
  dom.levelupSub.style.textShadow = `0 0 24px ${color}`;
  dom.levelupNum.textContent = lvl;
  dom.levelupNum.style.textShadow = `0 0 40px ${color}, 0 0 90px ${color}88`;
  dom.levelupOverlay.classList.remove("hidden");
  restartAnimation(dom.levelupInner, "levelup-inner");
  restartAnimation(dom.levelupSub, "levelup-sub");
}

function setCountdown(n) {
  if (n === null) {
    dom.countdownOverlay.classList.add("hidden");
    updateTouchControlsVisibility(true);
    return;
  }
  dom.countdownOverlay.classList.remove("hidden");
  dom.countdownNum.textContent = n === 0 ? "GO!" : n;
  dom.countdownNum.classList.toggle("countdown-num--go", n === 0);
  restartAnimation(dom.countdownNum, "countdown-num");
}

function setIsGameOver(v) {
  if (!v) return;
  hud.isGameOver = true;
  hud.gameActive = false;
  dom.gameoverKicker.textContent = hud.eggWasShot ? "You shot the egg" : "Mission failed";
  dom.gameoverTitle.textContent = hud.eggWasShot ? "Cracked!" : "Game Over";
  dom.gameoverTitle.classList.toggle("game-screen__title--egg-shot", hud.eggWasShot);
  dom.gameoverEggNote.classList.toggle("hidden", !hud.eggWasShot);
  dom.gameoverScore.textContent = hud.score;
  dom.gameoverCoins.textContent = hud.coins;
  dom.gameoverLevel.textContent = hud.level;
  dom.gameoverScreen.classList.remove("hidden");
  updateTouchControlsVisibility(false);
}

function setIsMissionComplete(v) {
  if (!v) return;
  hud.gameActive = false;
  dom.winScore.textContent = hud.score;
  dom.winCoins.textContent = hud.coins;
  dom.winLevel.textContent = hud.level;
  dom.winScreen.classList.remove("hidden");
  updateTouchControlsVisibility(false);
}

function updateTouchControlsVisibility(show) {
  const visible = show && isTouchDevice && hud.gameActive;
  dom.touchControls.classList.toggle("hidden", !visible);
}

function triggerCoinShake() {
  restartAnimation(dom.coins, "coin-shake");
}

function handleMobileBuy(ref, cost) {
  if (!isTouchDevice || !hud.gameActive) return;
  if (hud.coins >= cost) ref.current = true;
  else triggerCoinShake();
}

// ---- ANIMATED ALIEN ICON (port of components/AlienIcon.js) ----
function startAlienIcon(canvas, color = "#7CFC00") {
  const ctx = canvas.getContext("2d");
  const W = 30, H = 36;
  const bodyColor = "#6BEB00";
  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    const legAnim = frame * 0.3;
    const armAnim = frame * 0.25;
    const antennaSwing = frame * 0.2;
    const blinkPhase = frame % 70;
    let eyeScale = 1;
    if (blinkPhase >= 60 && blinkPhase < 65) eyeScale = Math.max(0.1, 1 - (blinkPhase - 60) / 5);
    else if (blinkPhase >= 65 && blinkPhase < 70) eyeScale = (blinkPhase - 65) / 5;

    const cx = W / 2;

    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - 4, 8);
    ctx.quadraticCurveTo(cx - 8 + Math.sin(antennaSwing) * 3, 2, cx - 8 + Math.sin(antennaSwing) * 5, 0);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 4, 8);
    ctx.quadraticCurveTo(cx + 8 + Math.sin(antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(antennaSwing + 1) * 5, 0);
    ctx.stroke();
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.ellipse(cx - 2, 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * eyeScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * eyeScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(cx - 4, 13, 2 * eyeScale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, 13, 2 * eyeScale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.arc(cx - 3, 12, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, 12, 1, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, 15, 4, 0.2, Math.PI - 0.2); ctx.stroke();

    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();

    const ao = Math.sin(armAnim) * 3;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx - 11, 24 + ao, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 11, 24 - ao, 2, 0, Math.PI * 2); ctx.fill();

    const lo = Math.sin(legAnim) * 2;
    ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx - 4, 34 + lo, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 4, 34 - lo, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
}

// ---- BACKGROUND STARFIELD (port of GameStarfield) ----
const STAR_COLORS = ["#FFFFFF", "#C8E6FF", "#FFE8A0", "#E8C8FF", "#A0FFE8", "#FFB0B0"];

function startStarfield(canvas) {
  const ctx = canvas.getContext("2d");
  let w = canvas.width = canvas.offsetWidth;
  let h = canvas.height = canvas.offsetHeight;

  const stars = [];
  const shootingStars = [];
  let shootingStarTimer = 0;

  for (let i = 0; i < 160; i++) {
    const layer = i < 80 ? 0 : i < 130 ? 1 : 2;
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: layer === 0 ? Math.random() * 1 + 0.3 : layer === 1 ? Math.random() * 1.5 + 0.8 : Math.random() * 2.5 + 1.5,
      speed: layer === 0 ? Math.random() * 0.15 + 0.05 : layer === 1 ? Math.random() * 0.3 + 0.15 : Math.random() * 0.6 + 0.3,
      brightness: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      bright: layer === 2 && Math.random() > 0.5,
    });
  }

  window.addEventListener("resize", () => {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  });

  function tick() {
    ctx.clearRect(0, 0, w, h);

    stars.forEach((star) => {
      star.y += star.speed;
      if (star.y > h) { star.y = 0; star.x = Math.random() * w; }
      star.brightness += star.twinkleSpeed;
      const b = (Math.sin(star.brightness) + 1) / 2;
      const alpha = 0.3 + b * 0.7;
      ctx.globalAlpha = alpha;
      if (star.bright) {
        const sg = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3);
        sg.addColorStop(0, star.color); sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = star.color; ctx.lineWidth = 0.5 * alpha;
        const arm = star.size * 5;
        ctx.beginPath(); ctx.moveTo(star.x - arm, star.y); ctx.lineTo(star.x + arm, star.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(star.x, star.y - arm); ctx.lineTo(star.x, star.y + arm); ctx.stroke();
      } else {
        const sg = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 2.5);
        sg.addColorStop(0, star.color); sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    shootingStarTimer++;
    if (shootingStarTimer > 180 + Math.random() * 300) {
      shootingStarTimer = 0;
      shootingStars.push({
        x: Math.random() * w, y: Math.random() * h * 0.5,
        vx: 4 + Math.random() * 4, vy: 2 + Math.random() * 2,
        len: 60 + Math.random() * 80, life: 1,
      });
    }
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += s.vx; s.y += s.vy; s.life -= 0.018;
      if (s.life <= 0) { shootingStars.splice(i, 1); continue; }
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10);
      grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.len * (s.vx / 6), s.y - s.len * (s.vy / 6)); ctx.stroke();
    }

    requestAnimationFrame(tick);
  }
  tick();
}

// ---- SCREEN BACKDROP DOTS (positions are runtime-computed, hence inline) ----
function fillBackdrops() {
  document.querySelectorAll("[data-backdrop]").forEach((backdrop) => {
    const count = Number(backdrop.dataset.backdrop);
    const gold = count === 50; // win screen mixes in gold dots
    let html = "";
    for (let i = 0; i < count; i++) {
      const left = Math.sin(i * (gold ? 2.3 : 2.5)) * 50 + 50;
      const top = Math.cos(i * (gold ? 1.9 : 1.7)) * 50 + 50;
      const size = i % (gold ? 4 : 5) === 0 ? 3 : 2;
      const opacity = gold ? 0.25 + (i % 5) * 0.12 : 0.3 + (i % 4) * 0.15;
      const bg = gold && i % 5 === 0 ? "#FFD700" : "#fff";
      html += `<div class="backdrop-dot" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;background:${bg};opacity:${opacity}"></div>`;
    }
    backdrop.innerHTML = html;
  });
}

// ---- GAME (port of the pages/game.js useEffect body, multiplayer removed) ----
function runGame() {
  const canvas = dom.canvas;
  const ctx = canvas.getContext("2d");

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const shipBottomMargin = isTouchDevice ? 160 : 100;

  const handleResize = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ship.y = canvas.height - shipBottomMargin;
    distantPlanets[1].x = canvas.width - 110;
    distantPlanets[2].x = canvas.width / 2 + 60;
    distantPlanets[2].y = canvas.height - 130;
  };
  window.addEventListener("resize", handleResize);

  // ---- GAME STATE ----
  let scoreVal = 0;
  let coinsVal = 0;
  let bulletsVal = 50;
  let meteorShieldsVal = 2;
  let bulletsList = [];
  let shootCooldown = 0;
  let livesVal = 3;
  let levelVal = 1;
  let gameRunning = true;
  let invulnerable = false;
  let flashIntervalId = null;
  let keys = {};
  let rocks = [];
  let aliens = [];
  let particles = [];
  let stars = [];
  let nebulaClouds = [];
  let rockTimer = 9999;
  let animFrameId = null;
  let levelUpTimerId = null;
  let readyFrames = 180;
  let lastCountdownShown = 3;
  setCountdown(3);

  const BULLET_BUY_COUNT = 30;
  const BULLET_BUY_COST = 100;
  let pauseFrames = 0;
  let buyFlashFrames = 0;
  let buyFlashText = "";
  let screenShakeFrames = 0;
  let screenShakeMag = 0;
  let floatingTexts = [];
  let engineTrails = [];
  let comboVal = 0;
  let comboDisplayTimer = 0;
  let spotlightAlien = null;
  let meteorStormFrames = 0;
  let meteorStormTimer = 0;
  let meteorStormSpawnTimer = 0;
  let meteorRocks = [];
  let meteorStormSafePos = 0; // cycles 0=left, 1=middle, 2=right
  let meteorHalfDamage = false;
  let halfDamageTimeoutId = null;
  let shieldActive = false;
  let shieldFrames = 0;
  let shieldAngle = 0;
  let reverseAliens = [];
  let reverseAlienTimer = 0;
  let heartAliens = [];
  let shieldAliens = [];
  let bombAliens = [];
  let ufo = null;
  let ufoTimer = 0;
  let santaFrames = 0;
  let santaX = 0;
  let santaY = 0;
  let ufoExplosionRing = null;
  let coinRainFrames = 0;
  let coinRainSpawnTimer = 0;
  let coinRainCoinsTimer = 0;
  let coinParticles = [];
  let gravityWell = null;
  let gravityWellTimer = 0;
  let lastEgg = null;
  let lastEggSpawned = false;
  let scrambleFrames = 0;
  let scrambleWarnFrames = 0;
  let scrambleTimer = 0;
  let damagedFrames = 0;
  let fireworksFrames = 0;
  let fireworkShells = [];
  let fireworkParticles = [];
  let winMusicActive = false;
  let winPending = false;

  // ---- SOUNDS ----
  // AudioContext was created and resumed synchronously in the button's onClick handler
  // (the only way to unlock audio on iOS without requiring a second tap).
  const audioCtx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
  audioCtxRef.current = audioCtx;

  const {
    playShoot, playCatch, playHit, playExplosion,
    playMeteorExplosion, playMeteorImpact, playMeteorStormWarning,
    playLevelUp, playRockHit, playGameOver, playWin, playHoHoHo,
  } = createSounds(audioCtx, soundEnabledRef);

  // ---- BACKGROUND MUSIC ----
  const bgMusic = createBackgroundMusic(
    audioCtx, soundEnabledRef,
    () => levelVal,
    () => winMusicActive,
  );
  bgGainRef.current = bgMusic.bgGain;
  audioCtx.resume().then(() => bgMusic.start());

  // ---- SPEED / INTERVAL HELPERS ----
  const getRockInterval = () => Math.max(55, 200 - (levelVal - 1) * 20);
  const getAlienSpeed = () => 1 + (Math.min(levelVal, 12) - 1) * 0.2;
  const getRockSpeed  = () => 1 + (levelVal - 1) * 0.2;

  // ---- BACKGROUND ELEMENTS ----
  const distantPlanets = [
    { x: 90, y: 90, radius: 34, color: "#c97bde", glowColor: "rgba(180,80,220,0.35)", rings: true },
    { x: canvas.width - 110, y: 130, radius: 22, color: "#5fc8c8", glowColor: "rgba(50,180,180,0.3)", rings: false },
    { x: canvas.width / 2 + 60, y: canvas.height - 130, radius: 18, color: "#f0a050", glowColor: "rgba(240,140,40,0.3)", rings: false },
  ];

  // ---- SHIP ----
  const shipW = isTouchDevice ? 62 : 70;
  const shipH = isTouchDevice ? 45 : 50;
  const ship = {
    x: canvas.width / 2 - shipW / 2,
    y: canvas.height - shipBottomMargin,
    width: shipW,
    height: shipH,
    speed: 6,
    flash: false,
    engineGlow: 0,
    tilt: 0,
    scale: 1,
    trailParticles: [],
  };

  // Kept invisible — draw.js reads it from drawState (multiplayer is not in this build)
  const remoteShip = {
    x: -200,
    y: canvas.height - shipBottomMargin,
    width: shipW,
    height: shipH,
    speed: 6,
    flash: false,
    engineGlow: 0,
    tilt: 0,
    scale: 1,
    trailParticles: [],
    visible: false,
  };

  const shipImg = new Image();
  let shipImgLoaded = false;
  shipImg.onload = () => { shipImgLoaded = true; };
  shipImg.src = "images/spaceship.png";

  const rockImgLeft = new Image();
  let rockImgLeftLoaded = false;
  rockImgLeft.onload = () => { rockImgLeftLoaded = true; };
  rockImgLeft.src = "images/rock-left.png";

  const rockImgRight = new Image();
  let rockImgRightLoaded = false;
  rockImgRight.onload = () => { rockImgRightLoaded = true; };
  rockImgRight.src = "images/rock-right.png";

  // ---- INIT STARS / NEBULAE ----
  for (let i = 0; i < 160; i++) {
    const layer = i < 80 ? 0 : i < 130 ? 1 : 2;
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: layer === 0 ? Math.random() * 1 + 0.3 : layer === 1 ? Math.random() * 1.5 + 0.8 : Math.random() * 2.5 + 1.5,
      speed: layer === 0 ? Math.random() * 0.15 + 0.05 : layer === 1 ? Math.random() * 0.3 + 0.15 : Math.random() * 0.6 + 0.3,
      brightness: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      bright: layer === 2 && Math.random() > 0.5,
    });
  }
  const nebulaColors = [
    "rgba(140,40,230,0.18)", "rgba(80,0,160,0.15)", "rgba(0,120,180,0.14)",
    "rgba(180,0,120,0.15)", "rgba(0,160,140,0.13)", "rgba(100,0,200,0.16)",
  ];
  for (let i = 0; i < 8; i++) {
    nebulaClouds.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 200 + 120,
      color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
      speed: Math.random() * 0.08 + 0.02,
    });
  }

  // ---- ENTITY CLASSES ----
  const rockImages = {
    left: rockImgLeft, right: rockImgRight,
    get leftLoaded()  { return rockImgLeftLoaded; },
    get rightLoaded() { return rockImgRightLoaded; },
  };
  const {
    Rock, Alien, Particle, FireworkParticle,
    MeteorRock, ReverseAlien, UFO, GravityWell, LastEgg, HeartAlien, ShieldAlien, BombAlien,
  } = createEntityClasses(ctx, canvas, ship, {
    getLevel: () => levelVal,
    getRockSpeed,
    getAlienSpeed,
    rockImages,
    isTouchDevice,
  });

  // ---- FIREWORK HELPERS ----
  const FW_PALETTES = [
    ["#FFD700","#FFF9A0"], ["#FF4466","#FF99BB"], ["#44AAFF","#AADDFF"],
    ["#44FF88","#AAFFCC"], ["#CC44FF","#DDAAFF"], ["#FF8800","#FFCCAA"], ["#FFFFFF","#CCE8FF"],
  ];
  const FW_TYPES = ["ring","chrysanthemum","star","willow","glitter"];

  function spawnFireworkShell() {
    const [c1, c2] = FW_PALETTES[Math.floor(Math.random() * FW_PALETTES.length)];
    return {
      x: 70 + Math.random() * (canvas.width - 140),
      y: canvas.height - 10,
      vy: -(12 + Math.random() * 6),
      vx: (Math.random() - 0.5) * 1.8,
      targetY: 50 + Math.random() * (canvas.height * 0.48),
      color: c1, color2: c2,
      trail: [],
      type: FW_TYPES[Math.floor(Math.random() * FW_TYPES.length)],
      exploded: false,
    };
  }

  function explodeShell(shell) {
    const count = { willow: 90, glitter: 100, ring: 72, star: 72, chrysanthemum: 80 }[shell.type] || 72;
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      let spd, vx, vy;
      if (shell.type === "ring") {
        spd = 4.8 + (Math.random() - 0.5) * 0.7;
        vx = Math.cos(angle) * spd; vy = Math.sin(angle) * spd;
      } else if (shell.type === "star") {
        const pt = Math.floor(k / (count / 6)) % 2 === 0;
        spd = pt ? 5.5 + Math.random() * 2 : 2 + Math.random() * 1.5;
        vx = Math.cos(angle) * spd; vy = Math.sin(angle) * spd;
      } else if (shell.type === "willow") {
        spd = 2 + Math.random() * 5.5;
        vx = Math.cos(angle) * spd * 0.7; vy = Math.sin(angle) * spd - 2.5;
      } else if (shell.type === "glitter") {
        spd = Math.random() * 7;
        vx = Math.cos(Math.random() * Math.PI * 2) * spd; vy = -Math.random() * 5;
      } else {
        spd = 1.5 + Math.random() * 5.5;
        vx = Math.cos(angle) * spd; vy = Math.sin(angle) * spd;
      }
      const c = Math.random() > 0.35 ? shell.color : shell.color2;
      fireworkParticles.push(new FireworkParticle(shell.x, shell.y, c, vx, vy, Math.random() > 0.55));
    }
  }

  // ---- DRAW STATE PROXY ----
  // Getters let draw.js always read the current let-var values, even after reassignment
  const drawState = {
    keys,
    distantPlanets,
    shipImg,
    get level()              { return levelVal; },
    get invulnerable()       { return invulnerable; },
    get comboVal()           { return comboVal; },
    get comboDisplayTimer()  { return comboDisplayTimer; },
    set comboDisplayTimer(v) { comboDisplayTimer = v; },
    get screenShakeFrames()  { return screenShakeFrames; },
    set screenShakeFrames(v) { screenShakeFrames = v; },
    get screenShakeMag()     { return screenShakeMag; },
    get scrambleFrames()     { return scrambleFrames; },
    get scrambleWarnFrames() { return scrambleWarnFrames; },
    get damagedFrames()      { return damagedFrames; },
    get meteorStormFrames()  { return meteorStormFrames; },
    get meteorStormSafePos() { return meteorStormSafePos; },
    get shieldActive()       { return shieldActive; },
    get shieldFrames()       { return shieldFrames; },
    get shieldAngle()        { return shieldAngle; },
    set shieldAngle(v)       { shieldAngle = v; },
    get fireworksFrames()    { return fireworksFrames; },
    get coinRainFrames()     { return coinRainFrames; },
    get shipImgLoaded()      { return shipImgLoaded; },
    get ufo()                { return ufo; },
    get ufoExplosionRing()   { return ufoExplosionRing; },
    get santaFrames()        { return santaFrames; },
    get santaX()             { return santaX; },
    get santaY()             { return santaY; },
    get gravityWell()        { return gravityWell; },
    get lastEgg()            { return lastEgg; },
    get spotlightAlien()     { return spotlightAlien; },
    get stars()              { return stars; },
    get nebulaClouds()       { return nebulaClouds; },
    get rocks()              { return rocks; },
    get meteorRocks()        { return meteorRocks; },
    get reverseAliens()      { return reverseAliens; },
    get heartAliens()        { return heartAliens; },
    get shieldAliens()       { return shieldAliens; },
    get bombAliens()         { return bombAliens; },
    get floatingTexts()      { return floatingTexts; },
    get particles()          { return particles; },
    get engineTrails()       { return engineTrails; },
    get coinParticles()      { return coinParticles; },
    get fireworkShells()     { return fireworkShells; },
    get fireworkParticles()  { return fireworkParticles; },
    get aliens()             { return aliens; },
    get bulletsList()        { return bulletsList; },
    get remoteShip()         { return remoteShip; },
  };

  const { drawFrame } = createDrawFunctions(ctx, canvas, ship, drawState);

  // ---- GAME LOGIC ----

  function loseLife() {
    if (invulnerable || winPending) return;
    livesVal--;
    invulnerable = true;
    damagedFrames = 270;
    meteorHalfDamage = false;
    playHit();
    setLives(livesVal);
    setHalfDamage(false);

    for (let i = 0; i < 30; i++) {
      particles.push(new Particle(ship.x+ship.width/2, ship.y+ship.height/2, ["#FF6B6B","#FF8C42","#FFD93D"][Math.floor(Math.random()*3)]));
    }

    if (flashIntervalId) clearInterval(flashIntervalId);
    let flashCount = 0;
    flashIntervalId = setInterval(() => {
      ship.flash = !ship.flash;
      if (++flashCount >= 10) {
        clearInterval(flashIntervalId);
        flashIntervalId = null;
        ship.flash = false;
        invulnerable = false;
      }
    }, 100);

    if (livesVal <= 0) endGame();
  }

  function endGame() {
    gameRunning = false;
    if (flashIntervalId) { clearInterval(flashIntervalId); flashIntervalId = null; }
    ship.flash = false;
    playGameOver();
    setIsGameOver(true);
  }

  function updateGame() {
    if (!gameRunning) return;

    if (screenShakeFrames > 0) screenShakeFrames--;
    if (pauseFrames > 0) { pauseFrames--; return; }

    if (gravityWell) {
      const { ax } = gravityWell.applyTo(ship.x + ship.width / 2, ship.y + ship.height / 2);
      ship.x = Math.max(0, Math.min(canvas.width - ship.width, ship.x + ax * 0.018));
    }

    const scrambled = scrambleFrames > 0;
    const damaged = damagedFrames > 0;
    if (damaged) {
      damagedFrames--;
      const drift = (Math.random() - 0.5) * 1.4;
      ship.x = Math.max(0, Math.min(canvas.width - ship.width, ship.x + drift));
    }
    const inputBlocked = damaged && Math.random() < 0.3;
    const movingLeft  = !inputBlocked && (scrambled ? (keys["ArrowRight"] || keys["d"]) : (keys["ArrowLeft"]  || keys["a"]));
    const movingRight = !inputBlocked && (scrambled ? (keys["ArrowLeft"]  || keys["a"]) : (keys["ArrowRight"] || keys["d"]));
    const speedMult = damaged ? 0.45 : 1;
    if (movingLeft) {
      ship.x = Math.max(0, ship.x - ship.speed * speedMult);
      ship.tilt = Math.max(-0.2, ship.tilt - 0.03);
    } else if (movingRight) {
      ship.x = Math.min(canvas.width - ship.width, ship.x + ship.speed * speedMult);
      ship.tilt = Math.min(0.2, ship.tilt + 0.03);
    } else {
      ship.tilt *= 0.85;
    }

    // Engine trail particles
    if (movingLeft || movingRight) {
      const trailColors = ["#64C8FF", "#CC88FF", "#FF6060", "#60FFC0", "#FFB84D"];
      for (let i = 0; i < 2; i++) {
        engineTrails.push({
          x: ship.x + ship.width / 2 + (Math.random() - 0.5) * 24,
          y: ship.y + ship.height - 4,
          vx: (Math.random() - 0.5) * 1.2,
          vy: Math.random() * 2 + 0.8,
          life: 18 + Math.random() * 10,
          maxLife: 28,
          color: trailColors[Math.floor(Math.random() * trailColors.length)],
          size: Math.random() * 3 + 1,
        });
      }
    }
    engineTrails = engineTrails.filter((t) => { t.x += t.vx; t.y += t.vy; t.life--; return t.life > 0; });

    if (shootCooldown > 0) shootCooldown--;

    for (let i = bulletsList.length - 1; i >= 0; i--) {
      const b = bulletsList[i];
      b.y -= b.speed;
      if (b.y + b.height < 0) { bulletsList.splice(i, 1); continue; }
      let hit = false;
      for (let j = rocks.length - 1; j >= 0; j--) {
        const rock = rocks[j];
        if (b.x < rock.x + rock.width && b.x + b.width > rock.x &&
            b.y < rock.y + rock.height && b.y + b.height > rock.y) {
          rock.hp--;
          rock.hitFlash = 8;
          if (rock.isBoss) {
            screenShakeFrames = 12;
            screenShakeMag = rock.hp > 0 ? 5 : 10;
          }
          if (rock.hp <= 0) {
            playExplosion();
            const pCount = rock.isBoss ? 55 : 22;
            for (let k = 0; k < pCount; k++) {
              particles.push(new Particle(
                rock.x + rock.width / 2, rock.y + rock.height / 2,
                rock.isBoss
                  ? ["#ff4400", "#ff8800", "#ffcc00", "#ff2200", "#ffffff"][Math.floor(Math.random() * 5)]
                  : ["#ff8844", "#ffbb44", "#ff6622", "#ffdd88"][Math.floor(Math.random() * 4)]
              ));
            }
            aliens.forEach((a) => {
              if (a.rock === rock && a.onRock) {
                a.onRock = false;
                a.fallSpeed = 1;
                a.rotationSpeed = a.direction * 0.1;
              }
            });
            heartAliens.forEach((ha) => {
              if (ha.rock === rock && ha.onRock) {
                ha.onRock = false;
                ha.fallSpeed = 1;
                ha.rotationSpeed = ha.direction * 0.1;
              }
            });
            shieldAliens.forEach((sa) => {
              if (sa.rock === rock && sa.onRock) {
                sa.onRock = false;
                sa.fallSpeed = 1;
                sa.rotationSpeed = sa.direction * 0.1;
              }
            });
            bombAliens.forEach((ba) => {
              if (ba.rock === rock && ba.onRock) {
                ba.onRock = false;
                ba.fallSpeed = 1;
                ba.rotationSpeed = ba.direction * 0.1;
              }
            });
            rocks.splice(j, 1);
          } else {
            playRockHit();
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let ri = reverseAliens.length - 1; ri >= 0; ri--) {
          const ra = reverseAliens[ri];
          if (ra.checkBulletHit(b)) {
            coinsVal += 25;
            setCoins(coinsVal);
            for (let k = 0; k < 22; k++) {
              particles.push(new Particle(ra.x + ra.width / 2, ra.y + ra.height / 2,
                ["#FF4488", "#FF88CC", "#ffffff"][Math.floor(Math.random() * 3)]));
            }
            floatingTexts.push({ x: ra.x + ra.width / 2, y: ra.y, text: "+25 🎯", alpha: 1, vy: 1.8, color: "#FF88CC" });
            reverseAliens.splice(ri, 1);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (let mi = meteorRocks.length - 1; mi >= 0; mi--) {
          if (meteorRocks[mi].checkBulletHit(b)) {
            const mr = meteorRocks[mi];
            for (let k = 0; k < 16; k++) {
              particles.push(new Particle(mr.x, mr.y, ["#ff8800", "#ffcc00", "#ff4400"][Math.floor(Math.random() * 3)]));
            }
            coinsVal += 5;
            setCoins(coinsVal);
            floatingTexts.push({ x: mr.x, y: mr.y, text: "+5", alpha: 1, vy: 1.2, color: "#ffcc00" });
            playMeteorExplosion();
            meteorRocks.splice(mi, 1);
            hit = true;
            break;
          }
        }
      }
      if (!hit && ufo) {
        if (ufo.checkBulletHit(b)) {
          ufo.hp--;
          ufo.hitFlash = 10;
          playRockHit();
          hit = true;
          if (ufo.hp <= 0) {
            playExplosion();
            screenShakeFrames = 25; screenShakeMag = 12;
            const ufoCx = ufo.x + ufo.w / 2;
            const ufoCy = ufo.y + ufo.h / 2;
            const expColors = ["#FF4400", "#FF8800", "#FFCC00", "#FF2200", "#FFFFFF", "#44CCFF", "#FF44FF"];
            for (let k = 0; k < 80; k++) {
              const p = new Particle(ufoCx, ufoCy, expColors[Math.floor(Math.random() * expColors.length)]);
              p.vx = (Math.random() - 0.5) * 14;
              p.vy = (Math.random() - 0.5) * 14;
              p.life = 45 + Math.floor(Math.random() * 35);
              p.size = 3 + Math.random() * 5;
              particles.push(p);
            }
            coinsVal += 400;
            setCoins(coinsVal);
            floatingTexts.push({ x: ufoCx, y: ufoCy - 20, text: "🛸 UFO DOWN! +400 🪙", alpha: 1, vy: 1.8, color: "#44CCFF" });
            santaFrames = 300;
            santaX = ufoCx;
            santaY = ufoCy;
            ufoExplosionRing = { x: ufoCx, y: ufoCy, radius: 10, maxRadius: 220, alpha: 1 };
            playHoHoHo();
            ufo = null;
          }
        }
      }
      if (!hit && lastEgg && !lastEgg.caught && !lastEgg.cracked) {
        const ex = lastEgg.x, ey = lastEgg.y, ew = lastEgg.width, eh = lastEgg.height;
        if (b.x < ex + ew && b.x + b.width > ex && b.y < ey + eh && b.y + b.height > ey) {
          lastEgg.cracked = true;
          playExplosion();
          screenShakeFrames = 20; screenShakeMag = 9;
          for (let k = 0; k < 40; k++) {
            const p = new Particle(ex + ew / 2, ey + eh / 2,
              ["#F9A825","#FFE082","#E65100","#FFFDE7","#FF4400","#fff"][Math.floor(Math.random() * 6)]);
            p.vx = (Math.random() - 0.5) * 11;
            p.vy = (Math.random() - 0.5) * 11;
            p.life = 40 + Math.floor(Math.random() * 30);
            p.size = 2 + Math.random() * 4;
            particles.push(p);
          }
          floatingTexts.push({ x: ex + ew / 2, y: ey - 10, text: "💥 YOU SHOT THE EGG!", alpha: 1, vy: 1.1, color: "#FF4444", fontSize: 18 });
          setTimeout(() => { setEggWasShot(true); if (gameRunning) endGame(); }, 1500);
          hit = true;
        }
      }
      if (hit) bulletsList.splice(i, 1);
    }

    const newLevel = (() => {
      if (scoreVal < 3) return 1;
      let lvl = 2, used = 3;
      while (true) {
        const cost = lvl < 10 ? 5 : lvl < 15 ? 7 : lvl < 20 ? 10 : 15;
        if (scoreVal < used + cost) return lvl;
        used += cost;
        lvl++;
      }
    })();
    if (newLevel !== levelVal) {
      levelVal = newLevel;
      setLevel(levelVal);
      playLevelUp();
      setLevelUpBanner(levelVal);
      if (levelUpTimerId) clearTimeout(levelUpTimerId);
      levelUpTimerId = setTimeout(() => setLevelUpBanner(null), 1800);
    }

    if (shieldFrames > 0) { shieldFrames--; if (shieldFrames === 0) shieldActive = false; }

    const stormInterval = Math.max(600, 1800 - Math.floor(Math.max(0, levelVal - 15) / 2) * 180);
    if (levelVal >= 1 && meteorStormFrames <= 0) {
      meteorStormTimer++;
      if (meteorStormTimer >= stormInterval) {
        meteorStormTimer = 0;
        if (Math.random() < 0.65) {
          meteorStormSafePos = (meteorStormSafePos + 1) % 3;
          meteorStormFrames = 600;
          screenShakeFrames = 30;
          screenShakeMag = 8;
          playMeteorStormWarning();
        }
      }
    }

    if (meteorStormFrames > 0) {
      meteorStormFrames--;
      meteorStormSpawnTimer++;
      if (meteorStormSpawnTimer >= 28) {
        meteorStormSpawnTimer = 0;
        const count = 2 + Math.floor(Math.random() * 2);
        const slots = count + 2;
        const laneW = canvas.width / slots;
        const skipSlot = meteorStormSafePos === 0 ? 0
          : meteorStormSafePos === 2 ? slots - 1
          : Math.floor(slots / 2);
        const available = [];
        for (let mi = 0; mi < slots; mi++) { if (mi !== skipSlot) available.push(mi); }
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        for (let i = 0; i < count; i++) {
          const mr = new MeteorRock();
          mr.x = laneW * (available[i] + 0.5) + (Math.random() - 0.5) * laneW * 0.3;
          meteorRocks.push(mr);
        }
      }
    } else {
      rockTimer++;
      if (rockTimer >= getRockInterval()) {
        rockTimer = 0;
        const rock = new Rock();
        rocks.push(rock);
        if (rock.hasAlien) {
          for (let i = 0; i < rock.alienCount; i++) aliens.push(new Alien(rock, i));
          if (spotlightAlien === null) spotlightAlien = aliens[aliens.length - 1];
        }
        if (!rock.hasAlien) {
          const bonusRoll = Math.random();
          if (levelVal >= 4 && bonusRoll < 0.07) heartAliens.push(new HeartAlien(rock, 0));
          else if (levelVal >= 3 && bonusRoll < 0.22) shieldAliens.push(new ShieldAlien(rock, 0));
          else if (levelVal >= 7 && bonusRoll < 0.32) bombAliens.push(new BombAlien(rock, 0));
        }
      }
    }

    rocks = rocks.filter((rock) => {
      if (gravityWell) {
        const { ax, ay } = gravityWell.applyTo(rock.x + rock.width / 2, rock.y + rock.height / 2);
        rock.x += ax * 0.06;
        rock.y += ay * 0.06;
      }
      rock.update();
      if (!invulnerable && rock.checkCollision(ship)) { loseLife(); return false; }
      return !rock.isOffScreen();
    });

    meteorRocks = meteorRocks.filter((mr) => {
      mr.update();
      if (mr.checkCollision(ship)) {
        if (shieldActive) {
          for (let k = 0; k < 18; k++) {
            const p = new Particle(mr.x + mr.width / 2, mr.y + mr.height / 2, ["#44CCFF", "#88EEFF", "#ffffff"][k % 3]);
            p.vx = (Math.random() - 0.5) * 8; p.vy = (Math.random() - 0.5) * 8; p.life = 30; p.size = 3 + Math.random() * 3;
            particles.push(p);
          }
          return false;
        }
        if (!invulnerable) {
          if (meteorHalfDamage) {
            meteorHalfDamage = false;
            setHalfDamage(false);
            playMeteorImpact();
            loseLife();
          } else {
            meteorHalfDamage = true;
            setHalfDamage(true);
            playMeteorImpact();
            invulnerable = true;
            floatingTexts.push({ x: ship.x + ship.width / 2, y: ship.y - 10, text: "½ hit!", alpha: 1, vy: 1.2, color: "#ff8800" });
            if (halfDamageTimeoutId) clearTimeout(halfDamageTimeoutId);
            halfDamageTimeoutId = setTimeout(() => { invulnerable = false; halfDamageTimeoutId = null; }, 800);
          }
        }
      }
      return !mr.isOffScreen();
    });

    for (let i = aliens.length - 1; i >= 0; i--) {
      const alien = aliens[i];
      alien.update();

      if (alien.isDoneBeingCaught()) { aliens.splice(i, 1); continue; }

      if (!alien.caught && !alien.onRock && alien.checkCatch(ship)) {
        alien.caught = true;
        playCatch(alien.isGolden, alien.isQueen);
        if (spotlightAlien === alien) spotlightAlien = null;
        scoreVal += 1;
        comboVal++;
        const multiplier = comboVal >= 3 ? 2 : 1;
        const coinReward = (alien.isQueen ? 150 : alien.isGolden ? 50 : 10) * multiplier;
        coinsVal += coinReward;
        setScore(scoreVal);
        setCoins(coinsVal);
        if (comboVal >= 3) comboDisplayTimer = 90;
        if (alien.isQueen) {
          coinRainFrames = 300;
          coinRainSpawnTimer = 0;
          coinRainCoinsTimer = 0;
          screenShakeFrames = 20; screenShakeMag = 6;
        }
        alien.expression = alien.isQueen ? "👑" : alien.isGolden ? "✨" : "⭐";
        alien.expressionTimer = 40;
        floatingTexts.push({
          x: alien.x + alien.width / 2,
          y: alien.y - 5,
          text: multiplier > 1 ? `+${coinReward} ×${multiplier}` : `+${coinReward}`,
          alpha: 1, vy: 1.8,
          color: alien.isGolden ? "#FFD700" : "#64C8FF",
        });
        const pCount = alien.isGolden ? 30 : 15;
        for (let j = 0; j < pCount; j++) {
          particles.push(new Particle(alien.x+10, alien.y+12, alien.isGolden ? ["#FFD700", "#FFF176", "#FFEE58", "#ffffff"][Math.floor(Math.random()*4)] : alien.color));
        }
      } else if (!alien.caught && alien.isOffScreen()) {
        if (!alien.onRock) comboVal = 0;
        if (spotlightAlien === alien) spotlightAlien = null;
        aliens.splice(i, 1);
      }
    }

    floatingTexts = floatingTexts.filter((ft) => { ft.y -= ft.vy; ft.vy *= 0.94; ft.alpha -= 0.022; return ft.alpha > 0; });
    particles = particles.filter((p) => { p.update(); return p.life > 0; });

    reverseAlienTimer++;
    if (levelVal >= 17 && reverseAlienTimer >= 320) {
      reverseAlienTimer = 0;
      reverseAliens.push(new ReverseAlien());
    }
    reverseAliens = reverseAliens.filter((ra) => { ra.update(); return !ra.isOffScreen(); });

    heartAliens = heartAliens.filter((ha) => {
      ha.update();
      if (ha.isDoneBeingCaught()) return false;
      if (!ha.caught && ha.checkCatch(ship)) {
        ha.caught = true;
        playCatch(false, false);
        livesVal += 1;
        setLives(livesVal);
        setLifeGained(true);
        floatingTexts.push({ x: ha.x + ha.width / 2, y: ha.y - 10, text: "❤️ +1 life!", alpha: 1, vy: 1.8, color: "#FF4466" });
        for (let j = 0; j < 20; j++) {
          particles.push(new Particle(ha.x + ha.width / 2, ha.y + ha.height / 2, ["#FF4466", "#FF88AA", "#ffffff"][j % 3]));
        }
      }
      return !ha.isDoneBeingCaught() && !ha.isOffScreen();
    });

    shieldAliens = shieldAliens.filter((sa) => {
      sa.update();
      if (sa.isDoneBeingCaught()) return false;
      if (!sa.caught && sa.checkCatch(ship)) {
        sa.caught = true;
        playCatch(false, false);
        meteorShieldsVal += 1;
        setShields(meteorShieldsVal);
        floatingTexts.push({ x: sa.x + sa.width / 2, y: sa.y - 10, text: "🛡️ +1 shield!", alpha: 1, vy: 1.8, color: "#44CCFF" });
        for (let j = 0; j < 20; j++) {
          particles.push(new Particle(sa.x + sa.width / 2, sa.y + sa.height / 2, ["#44CCFF", "#88EEFF", "#ffffff"][j % 3]));
        }
      }
      return !sa.isDoneBeingCaught() && !sa.isOffScreen();
    });

    bombAliens = bombAliens.filter((ba) => {
      ba.update();
      if (!ba.hit && ba.checkHit()) {
        ba.hit = true;
        loseLife();
        playExplosion();
        floatingTexts.push({ x: ba.x + ba.width / 2, y: ba.y - 10, text: "💣 -1 life!", alpha: 1, vy: 1.8, color: "#FF6600" });
        screenShakeFrames = 22; screenShakeMag = 11;
        const expCx = ba.x + ba.width / 2;
        const expCy = ba.y + ba.height / 2;
        const hotColors = ["#FF6600", "#FF9900", "#FFCC00", "#FF3300", "#FF0000", "#ffffff", "#FFEE88"];
        const smokeColors = ["#442200", "#331100", "#666666"];
        for (let j = 0; j < 60; j++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 3 + Math.random() * 14;
          const color = j < 50
            ? hotColors[Math.floor(Math.random() * hotColors.length)]
            : smokeColors[Math.floor(Math.random() * smokeColors.length)];
          fireworkParticles.push(new FireworkParticle(expCx, expCy, color, Math.cos(angle) * spd, Math.sin(angle) * spd, j < 25));
        }
        for (let j = 0; j < 20; j++) {
          particles.push(new Particle(expCx, expCy, ["#FF6600", "#FF9944", "#333333"][j % 3]));
        }
      }
      return !ba.hit && !ba.isOffScreen();
    });

    ufoTimer++;
    if (levelVal >= 20 && !ufo && ufoTimer >= 440) {
      ufoTimer = 0;
      ufo = new UFO();
    }
    if (ufo) {
      ufo.update();
      const beam = ufo.getBeamBounds();
      for (let i = aliens.length - 1; i >= 0; i--) {
        const alien = aliens[i];
        if (!alien.caught && !alien.onRock) {
          const ax = alien.x + alien.width / 2;
          if (ax >= beam.xMin && ax <= beam.xMax) {
            floatingTexts.push({ x: ax, y: alien.y, text: "😱 ABDUCTED!", alpha: 1, vy: 1.4, color: "#88FFCC" });
            if (spotlightAlien === alien) spotlightAlien = null;
            comboVal = 0;
            aliens.splice(i, 1);
          }
        }
      }
      if (ufo.isOffScreen()) ufo = null;
    }

    if (ufoExplosionRing) {
      ufoExplosionRing.radius += 14;
      ufoExplosionRing.alpha = Math.max(0, 1 - ufoExplosionRing.radius / ufoExplosionRing.maxRadius);
      if (ufoExplosionRing.alpha <= 0) ufoExplosionRing = null;
    }
    if (santaFrames > 0) santaFrames--;

    gravityWellTimer++;
    if (levelVal >= 35 && !gravityWell && gravityWellTimer >= 900) {
      gravityWellTimer = 0;
      gravityWell = new GravityWell();
      floatingTexts.push({ x: canvas.width / 2, y: canvas.height / 2 - 40, text: "⚫ GRAVITY WELL!", alpha: 1, vy: 1.2, color: "#CC44FF" });
    }
    if (gravityWell) {
      gravityWell.update();
      if (gravityWell.isDone()) gravityWell = null;
    }

    if (levelVal >= 37 && scrambleFrames <= 0 && scrambleWarnFrames <= 0) {
      scrambleTimer++;
      if (scrambleTimer >= 1200) {
        scrambleTimer = 0;
        scrambleWarnFrames = 180;
      }
    }
    if (scrambleWarnFrames > 0) {
      scrambleWarnFrames--;
      if (scrambleWarnFrames === 0) scrambleFrames = 300;
    }
    if (scrambleFrames > 0) scrambleFrames--;

    if (levelVal >= 50 && !lastEgg && !lastEggSpawned) {
      lastEggSpawned = true;
      lastEgg = new LastEgg();
      floatingTexts.push({ x: canvas.width / 2, y: canvas.height / 2 - 80, text: "🥚 THE LAST EGG!", alpha: 1, vy: 0.9, color: "#FFD700", fontSize: 28 });
      floatingTexts.push({ x: canvas.width / 2, y: canvas.height / 2 - 40, text: "CATCH IT TO COMPLETE THE MISSION!", alpha: 1, vy: 0.9, color: "#FFF176", fontSize: 16 });
    }
    if (lastEgg) {
      lastEgg.update();
      if (lastEgg.checkCatch(ship)) {
        lastEgg.caught = true;
        winPending = true;
        const ecx = lastEgg.x + lastEgg.width / 2;
        const ecy = lastEgg.y + lastEgg.height / 2;
        playExplosion();
        playWin();
        winMusicActive = true;
        fireworksFrames = 108;
        screenShakeFrames = 30; screenShakeMag = 14;
        const expColors = ["#FFD700","#FFF9A0","#FF8C00","#FFFFFF","#90EE90","#00FF88","#AAFFCC"];
        for (let k = 0; k < 90; k++) {
          const angle = (k / 90) * Math.PI * 2;
          const spd = 3 + Math.random() * 9;
          fireworkParticles.push(new FireworkParticle(ecx, ecy, expColors[Math.floor(Math.random() * expColors.length)], Math.cos(angle) * spd, Math.sin(angle) * spd, true));
        }
        for (let i = 0; i < 3; i++) fireworkShells.push(spawnFireworkShell());
        coinsVal += 500;
        setCoins(coinsVal);
        setTimeout(() => { gameRunning = false; setIsMissionComplete(true); }, 1800);
      }
      if (lastEgg.isDoneBeingCaught()) lastEgg = null;
      if (lastEgg && lastEgg.isOffScreen()) { lastEgg = null; lastEggSpawned = false; }
    }

    if (fireworksFrames > 0) {
      fireworksFrames--;
      if (fireworksFrames % 16 === 0) fireworkShells.push(spawnFireworkShell());
    }
    fireworkShells = fireworkShells.filter(s => !s.exploded);
    fireworkShells.forEach(shell => {
      shell.trail.push({ x: shell.x, y: shell.y });
      if (shell.trail.length > 12) shell.trail.shift();
      shell.x += shell.vx;
      shell.y += shell.vy;
      shell.vy += 0.22;
      if (shell.y <= shell.targetY || shell.vy >= -0.5) {
        explodeShell(shell);
        shell.exploded = true;
      }
    });
    fireworkParticles = fireworkParticles.filter(p => p.life > 0);
    fireworkParticles.forEach(p => p.update());

    if (coinRainFrames > 0) {
      coinRainFrames--;
      coinRainSpawnTimer++;
      if (coinRainSpawnTimer >= 5) {
        coinRainSpawnTimer = 0;
        coinParticles.push({ x: Math.random() * canvas.width, y: -8, vx: (Math.random() - 0.5) * 2.5, vy: 1.5 + Math.random() * 2.5, alpha: 1, size: 8 + Math.random() * 6, spin: Math.random() * Math.PI * 2, spinSpeed: 0.06 + Math.random() * 0.09 });
      }
      coinRainCoinsTimer++;
      if (coinRainCoinsTimer >= 8) { coinRainCoinsTimer = 0; coinsVal++; setCoins(coinsVal); }
    }
    coinParticles = coinParticles.filter((c) => { c.x += c.vx; c.y += c.vy; c.alpha -= 0.007; c.spin += c.spinSpeed; return c.alpha > 0 && c.y < canvas.height + 10; });
  }

  // Fixed-timestep game loop: physics runs at steady 60 steps/sec regardless of display fps
  const STEP = 1000 / 60;
  let lastTimestamp = 0;
  let accumulator = 0;

  function gameLoop(timestamp) {
    if (!gameRunning) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsed = Math.min(timestamp - lastTimestamp, 100); // cap to avoid spiral after tab switch
    lastTimestamp = timestamp;
    accumulator += elapsed;

    // Process buys — once per rAF, event-driven
    if (buyBulletsRef.current) {
      buyBulletsRef.current = false;
      if (coinsVal >= BULLET_BUY_COST) {
        coinsVal -= BULLET_BUY_COST;
        bulletsVal += BULLET_BUY_COUNT;
        setCoins(coinsVal);
        setBullets(bulletsVal);
        if (!pausedRef.current) pauseFrames = 90;
        buyFlashFrames = 90;
        buyFlashText = "+ 30 bullets!";
      }
    }
    if (buyLivesRef.current) {
      buyLivesRef.current = false;
      if (coinsVal >= 200) {
        coinsVal -= 200;
        livesVal += 1;
        setCoins(coinsVal);
        setLives(livesVal);
        setLifeGained(true);
        if (!pausedRef.current) pauseFrames = 90;
        buyFlashFrames = 90;
        buyFlashText = "❤️ +1 life!";
      }
    }
    if (buyShieldsRef.current) {
      buyShieldsRef.current = false;
      if (coinsVal >= 70) {
        coinsVal -= 70;
        meteorShieldsVal += 1;
        setCoins(coinsVal);
        setShields(meteorShieldsVal);
        if (!pausedRef.current) pauseFrames = 90;
        buyFlashFrames = 90;
        buyFlashText = "🛡️ +1 shield!";
      }
    }

    if (pausedRef.current) {
      drawFrame();
      ctx.save();
      ctx.fillStyle = "rgba(5,7,26,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(100,200,255,0.8)";
      ctx.shadowBlur = 24;
      ctx.fillText("⏸ PAUSED", canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = "14px Arial";
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText("Press P or Escape to resume", canvas.width / 2, canvas.height / 2 + 22);
      if (buyFlashFrames > 0) {
        buyFlashFrames--;
        const alpha = buyFlashFrames < 30 ? buyFlashFrames / 30 : 1;
        ctx.globalAlpha = alpha;
        ctx.font = "bold 22px Arial";
        ctx.shadowColor = "rgba(100,200,255,0.9)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#64C8FF";
        ctx.fillText(buyFlashText, canvas.width / 2, canvas.height / 2 + 58);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    // Fixed-step physics: catch up if frames were slow, no-op if display is faster than 60fps
    while (accumulator >= STEP) {
      if (readyFrames > 0) {
        readyFrames--;
        const n = Math.ceil(readyFrames / 60);
        if (n !== lastCountdownShown) { lastCountdownShown = n; setCountdown(n); }
      } else {
        if (lastCountdownShown !== -1) {
          lastCountdownShown = -1;
          setCountdown(0);
          setTimeout(() => setCountdown(null), 700);
        }
        updateGame();
      }
      accumulator -= STEP;
    }

    drawFrame();

    if (buyFlashFrames > 0) {
      buyFlashFrames--;
      const alpha = buyFlashFrames < 30 ? buyFlashFrames / 30 : 1;
      const cy = canvas.height / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(100,200,255,0.9)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#64C8FF";
      ctx.fillText(buyFlashText, canvas.width / 2, cy - 16);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ---- CONTROLS ----
  const onKeyDown = (e) => {
    keys[e.key] = true;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "S", "1", "2", "3"].includes(e.key) && gameRunning) {
      e.preventDefault();
    }
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && gameRunning && readyFrames <= 0) {
      pausedRef.current = !pausedRef.current;
      setIsPaused(pausedRef.current);
    }
    if ((e.key === "s" || e.key === "S") && gameRunning && readyFrames <= 0 && !shieldActive && meteorShieldsVal > 0) {
      meteorShieldsVal--;
      setShields(meteorShieldsVal);
      shieldActive = true;
      shieldFrames = 300;
      floatingTexts.push({ x: ship.x + ship.width / 2, y: ship.y - 30, text: "🛡️ Shield!", alpha: 1, vy: 1.5, color: "#44CCFF" });
    }
    if (e.key === "1" && gameRunning && readyFrames <= 0) { buyBulletsRef.current = true; }
    if (e.key === "2" && gameRunning && readyFrames <= 0) { buyShieldsRef.current = true; }
    if (e.key === "3" && gameRunning && readyFrames <= 0) { buyLivesRef.current = true; }
    if (e.key === " " && bulletsVal > 0 && shootCooldown <= 0 && gameRunning && readyFrames <= 0) {
      bulletsList.push({ x: ship.x + ship.width / 2 - 2, y: ship.y - 10, width: 4, height: 16, speed: 13 });
      playShoot();
      bulletsVal--;
      setBullets(bulletsVal);
      shootCooldown = 12;
    }
  };
  const onKeyUp = (e) => { keys[e.key] = false; };

  const fireBullet = () => {
    if (bulletsVal > 0 && shootCooldown <= 0 && gameRunning && readyFrames <= 0) {
      bulletsList.push({ x: ship.x + ship.width / 2 - 2, y: ship.y - 10, width: 4, height: 16, speed: 13 });
      playShoot();
      bulletsVal--;
      setBullets(bulletsVal);
      shootCooldown = 12;
    }
  };
  const activateShield = () => {
    if (gameRunning && readyFrames <= 0 && !shieldActive && meteorShieldsVal > 0) {
      meteorShieldsVal--;
      setShields(meteorShieldsVal);
      shieldActive = true;
      shieldFrames = 300;
      floatingTexts.push({ x: ship.x + ship.width / 2, y: ship.y - 30, text: "🛡️ Shield!", alpha: 1, vy: 1.5, color: "#44CCFF" });
    }
  };
  touchControlsRef.current = {
    moveLeft:  (on) => { keys["ArrowLeft"] = on; if (on) keys["ArrowRight"] = false; },
    moveRight: (on) => { keys["ArrowRight"] = on; if (on) keys["ArrowLeft"] = false; },
    fire: fireBullet,
    shield: activateShield,
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const onWheel = (e) => e.preventDefault();
  window.addEventListener("wheel", onWheel, { passive: false });
  const onContextMenu = (e) => e.preventDefault();
  window.addEventListener("contextmenu", onContextMenu);

  animFrameId = requestAnimationFrame(gameLoop);

  return function cleanup() {
    gameRunning = false;
    cancelAnimationFrame(animFrameId);
    if (flashIntervalId) clearInterval(flashIntervalId);
    if (levelUpTimerId) clearTimeout(levelUpTimerId);
    if (halfDamageTimeoutId) clearTimeout(halfDamageTimeoutId);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("contextmenu", onContextMenu);
    bgMusic.stop();
    audioCtx.close();
  };
}

// ---- LIFECYCLE ----
let cleanupGame = null;

function resetHud() {
  hud.eggWasShot = false;
  hud.isGameOver = false;
  setScore(0);
  setCoins(0);
  setBullets(50);
  setShields(2);
  setLives(3);
  setHalfDamage(false);
  setLevel(1);
  pausedRef.current = false;
  setIsPaused(false);
  setLevelUpBanner(null);
}

function startGame() {
  // AudioContext must be created+resumed synchronously inside the tap handler
  // — the only way to unlock audio on iOS without requiring a second tap.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    audioCtxRef.current = ctx;
  } catch (e) { /* audio unsupported — game still runs */ }

  dom.startScreen.classList.add("hidden");
  dom.gameoverScreen.classList.add("hidden");
  dom.winScreen.classList.add("hidden");
  hud.gameActive = true;
  resetHud();

  if (cleanupGame) cleanupGame();
  cleanupGame = runGame();
}

function handleRestart() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    audioCtxRef.current = ctx;
  } catch (e) { /* audio unsupported — game still runs */ }

  dom.gameoverScreen.classList.add("hidden");
  dom.winScreen.classList.add("hidden");
  hud.gameActive = true;
  resetHud();

  if (cleanupGame) cleanupGame();
  cleanupGame = runGame();
}

// ---- UI WIRING ----
dom.startBtn.addEventListener("click", startGame);
dom.restartBtn.addEventListener("click", handleRestart);
dom.winRestartBtn.addEventListener("click", handleRestart);

dom.buyBullets.addEventListener("click", () => { buyBulletsRef.current = true; });
dom.buyShield.addEventListener("click", () => { buyShieldsRef.current = true; });
dom.buyLife.addEventListener("click", () => { buyLivesRef.current = true; });

// On phones the buy buttons are hidden — tapping the HUD group buys instead
dom.lives.addEventListener("click", () => handleMobileBuy(buyLivesRef, 200));
dom.bulletsGroup.addEventListener("click", () => handleMobileBuy(buyBulletsRef, 100));
dom.shieldsGroup.addEventListener("click", () => handleMobileBuy(buyShieldsRef, 70));

dom.pauseBtn.addEventListener("click", () => {
  if (!hud.gameActive) return;
  pausedRef.current = !pausedRef.current;
  setIsPaused(pausedRef.current);
});

let soundEnabled = true;
dom.muteBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundEnabledRef.current = soundEnabled;
  dom.muteBtn.textContent = soundEnabled ? "🔊" : "🔇";
  dom.muteBtn.title = soundEnabled ? "Mute sounds" : "Unmute sounds";
  dom.muteBtn.classList.toggle("hud-ctrl-btn--muted", !soundEnabled);
  if (bgGainRef.current && audioCtxRef.current) {
    bgGainRef.current.gain.setTargetAtTime(soundEnabled ? 0.4 : 0, audioCtxRef.current.currentTime, 0.1);
  }
});

// Prevent buttons from stealing keyboard focus (Space would re-click them)
[dom.pauseBtn, dom.muteBtn, dom.buyBullets, dom.buyShield, dom.buyLife].forEach((btn) => {
  btn.addEventListener("keydown", (e) => e.preventDefault());
});

// ---- TOUCH CONTROLS ----
function bindHoldButton(btn, onDown, onUp) {
  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); onDown(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
    btn.addEventListener(evt, (e) => { e.preventDefault(); if (onUp) onUp(); });
  });
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

bindHoldButton(el("touch-left"),
  () => touchControlsRef.current.moveLeft?.(true),
  () => touchControlsRef.current.moveLeft?.(false));
bindHoldButton(el("touch-right"),
  () => touchControlsRef.current.moveRight?.(true),
  () => touchControlsRef.current.moveRight?.(false));
bindHoldButton(el("touch-shield"),
  () => touchControlsRef.current.shield?.());
bindHoldButton(el("touch-fire"),
  () => {
    clearInterval(touchFireInterval);
    touchFireInterval = setInterval(() => touchControlsRef.current.fire?.(), 180);
    touchControlsRef.current.fire?.();
  },
  () => clearInterval(touchFireInterval));

// ---- BOOT ----
fillBackdrops();
startStarfield(dom.starfield);
startAlienIcon(el("hud-alien-icon"));
startAlienIcon(el("gameover-alien-icon"));
renderHearts();
updateBuyButtons();
