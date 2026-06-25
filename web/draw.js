import { LEVEL_PALETTES } from "./constants.js";

// state — a proxy object with JS getters (and setters where needed):
//   Direct refs:   keys, distantPlanets, shipImg
//   Getters (read):  level, invulnerable, comboVal, comboDisplayTimer,
//                    screenShakeFrames, screenShakeMag, scrambleFrames, scrambleWarnFrames,
//                    damagedFrames, meteorStormFrames, fireworksFrames, coinRainFrames,
//                    shipImgLoaded, ufo, gravityWell, lastEgg, spotlightAlien
//   Getters (read+write):  comboDisplayTimer, screenShakeFrames
//   Array getters (reassignable via filter in updateGame):
//     stars, nebulaClouds, rocks, meteorRocks, reverseAliens, floatingTexts,
//     particles, engineTrails, coinParticles, fireworkShells, fireworkParticles
//   Array getters (mutated in-place, no reassignment):
//     aliens, bulletsList
//   Object getter: remoteShip (second player ship, visible only in multiplayer)
export function createDrawFunctions(ctx, canvas, ship, state) {
  // Expose live game state to the AI driver (ai.js). Rendering is unchanged.
  if (typeof globalThis !== "undefined") globalThis.__cap = { ctx, canvas, ship, drawState: state };
  // shooting stars are purely visual — managed internally
  let shootingStars = [];
  let shootingStarTimer = 0;

  function drawBackground() {
    const pal = LEVEL_PALETTES[(state.level - 1) % LEVEL_PALETTES.length];
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0,   pal.bg[0]);
    grad.addColorStop(0.3, pal.bg[1]);
    grad.addColorStop(0.6, pal.bg[2]);
    grad.addColorStop(1,   pal.bg[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawStars() {
    state.nebulaClouds.forEach((cloud) => {
      cloud.y += cloud.speed;
      if (cloud.y > canvas.height + cloud.radius) { cloud.y = -cloud.radius; cloud.x = Math.random() * canvas.width; }
      const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
      const c = cloud.color;
      g.addColorStop(0,   c.replace(/[\d.]+\)$/, "0.22)"));
      g.addColorStop(0.4, c);
      g.addColorStop(0.8, c.replace(/[\d.]+\)$/, "0.06)"));
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.fill();
    });

    shootingStarTimer++;
    if (shootingStarTimer > 180 + Math.random() * 300) {
      shootingStarTimer = 0;
      shootingStars.push({
        x: Math.random() * canvas.width * 0.8,
        y: Math.random() * canvas.height * 0.4,
        len: 80 + Math.random() * 80,
        speed: 8 + Math.random() * 6,
        life: 1,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      });
    }
    shootingStars = shootingStars.filter((s) => {
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.life -= 0.03;
      if (s.life <= 0) return false;
      const tx = s.x - Math.cos(s.angle) * s.len;
      const ty = s.y - Math.sin(s.angle) * s.len;
      const sg = ctx.createLinearGradient(tx, ty, s.x, s.y);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(1, `rgba(255,255,255,${s.life * 0.9})`);
      ctx.strokeStyle = sg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
      return true;
    });

    state.distantPlanets.forEach((planet) => {
      const halo = ctx.createRadialGradient(planet.x, planet.y, planet.radius * 0.8, planet.x, planet.y, planet.radius * 2.5);
      halo.addColorStop(0, planet.glowColor);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius * 2.5, 0, Math.PI * 2); ctx.fill();
      const pg = ctx.createRadialGradient(planet.x - planet.radius*0.35, planet.y - planet.radius*0.35, planet.radius*0.05, planet.x, planet.y, planet.radius);
      pg.addColorStop(0, "rgba(255,255,255,0.5)");
      pg.addColorStop(0.2, planet.color);
      pg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2); ctx.fill();
      if (planet.rings) {
        ctx.strokeStyle = "rgba(220,200,255,0.35)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(planet.x, planet.y, planet.radius*2, planet.radius*0.35, 0.3, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgba(220,200,255,0.15)"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.ellipse(planet.x, planet.y, planet.radius*2.3, planet.radius*0.42, 0.3, 0, Math.PI*2); ctx.stroke();
      }
    });

    state.stars.forEach((star) => {
      star.y += star.speed;
      if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; }
      star.brightness += star.twinkleSpeed;
      const b = (Math.sin(star.brightness) + 1) / 2;
      const alpha = b * 0.85 + 0.15;
      ctx.globalAlpha = alpha;
      if (star.bright) {
        const sg = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3);
        sg.addColorStop(0, star.color); sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = star.color; ctx.lineWidth = 0.5 * alpha;
        const arm = star.size * 5;
        ctx.beginPath(); ctx.moveTo(star.x - arm, star.y); ctx.lineTo(star.x + arm, star.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(star.x, star.y - arm); ctx.lineTo(star.x, star.y + arm); ctx.stroke();
      } else {
        const sg = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 2.5);
        sg.addColorStop(0, star.color); sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawShip() {
    ship.engineGlow += 0.15;
    const keys = state.keys;
    const isMoving = keys["ArrowLeft"] || keys["a"] || keys["ArrowRight"] || keys["d"];
    const isMovingLeft = keys["ArrowLeft"] || keys["a"];
    const isMovingRight = keys["ArrowRight"] || keys["d"];
    const thrustMult = isMoving ? 1.6 : 1.0;
    const bobY = Math.sin(ship.engineGlow * 0.55) * 2.5;
    const flicker = 0.88 + Math.sin(ship.engineGlow * 3.5) * 0.08 + Math.sin(ship.engineGlow * 7.3) * 0.04;
    const flameLen = (20 + Math.sin(ship.engineGlow * 4.2) * 5) * thrustMult;

    if (Math.random() > 0.6) {
      const spread = isMoving ? 16 : 10;
      const maxL = 30 + Math.floor(Math.random() * 20);
      ship.trailParticles.push({
        x: ship.x + ship.width / 2 + (Math.random() - 0.5) * spread,
        y: ship.y + ship.height + bobY,
        life: maxL, maxLife: maxL,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.5 + Math.random() * 2,
        size: 1.5 + Math.random() * 2.5,
      });
    }

    ship.trailParticles = ship.trailParticles.filter((p) => {
      p.y += p.vy; p.x += p.vx; p.life--;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t * 0.8;
      const r = Math.floor(180 * t * t);
      const g2 = Math.floor(200 * t);
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
      pg.addColorStop(0, `rgba(${r}, ${g2}, 255, 1)`);
      pg.addColorStop(1, "rgba(0, 60, 255, 0)");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return p.life > 0;
    });

    ctx.save();
    ctx.translate(ship.x + ship.width / 2, ship.y + ship.height / 2 + bobY);
    ctx.rotate(ship.tilt);
    ctx.scale(ship.scale, ship.scale);
    const ey = ship.height / 2;

    const og = ctx.createRadialGradient(0, ey + flameLen * 0.4, 0, 0, ey + flameLen * 0.6, flameLen * 1.3);
    og.addColorStop(0, `rgba(60, 140, 255, ${0.4 * flicker})`);
    og.addColorStop(0.6, `rgba(0, 60, 200, ${0.15 * flicker})`);
    og.addColorStop(1, "rgba(0, 0, 80, 0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.ellipse(0, ey + flameLen * 0.5, flameLen * 0.9, flameLen * 1.3, 0, 0, Math.PI * 2); ctx.fill();

    const fOuter = ctx.createLinearGradient(0, ey, 0, ey + flameLen * 1.4);
    fOuter.addColorStop(0, "rgba(120, 200, 255, 0.6)");
    fOuter.addColorStop(0.5, "rgba(60, 120, 255, 0.35)");
    fOuter.addColorStop(1, "rgba(0, 30, 180, 0)");
    ctx.fillStyle = fOuter;
    ctx.beginPath();
    ctx.moveTo(-13, ey); ctx.quadraticCurveTo(-15, ey + flameLen * 0.7, 0, ey + flameLen * 1.4);
    ctx.quadraticCurveTo(15, ey + flameLen * 0.7, 13, ey);
    ctx.closePath(); ctx.fill();

    const fInner = ctx.createLinearGradient(0, ey, 0, ey + flameLen);
    fInner.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    fInner.addColorStop(0.1, "rgba(210, 240, 255, 0.9)");
    fInner.addColorStop(0.35, `rgba(100, 200, 255, ${0.85 * flicker})`);
    fInner.addColorStop(0.7, `rgba(50, 100, 255, ${0.6 * flicker})`);
    fInner.addColorStop(1, "rgba(0, 40, 200, 0)");
    ctx.fillStyle = fInner;
    ctx.beginPath();
    ctx.moveTo(-7, ey); ctx.quadraticCurveTo(-8, ey + flameLen * 0.55, 0, ey + flameLen);
    ctx.quadraticCurveTo(8, ey + flameLen * 0.55, 7, ey);
    ctx.closePath(); ctx.fill();

    const hc = ctx.createRadialGradient(0, ey + 4, 0, 0, ey + 4, 9);
    hc.addColorStop(0, `rgba(255, 255, 255, ${flicker})`);
    hc.addColorStop(0.4, `rgba(180, 230, 255, ${0.8 * flicker})`);
    hc.addColorStop(1, "rgba(100, 200, 255, 0)");
    ctx.fillStyle = hc;
    ctx.beginPath(); ctx.arc(0, ey + 4, 9, 0, Math.PI * 2); ctx.fill();

    if (ship.flash) ctx.globalAlpha = 0.4;
    if (state.shipImgLoaded) {
      ctx.drawImage(state.shipImg, -ship.width / 2, -ship.height / 2, ship.width, ship.height);
    } else {
      ctx.save();
      ctx.translate(-ship.width / 2, -ship.height / 2);
      const g = ctx.createLinearGradient(ship.width / 2, 0, ship.width / 2, ship.height);
      g.addColorStop(0, "#5DADE2"); g.addColorStop(1, "#2874A6");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ship.width / 2, 0);
      ctx.lineTo(ship.width - 5, ship.height - 10);
      ctx.quadraticCurveTo(ship.width / 2, ship.height - 5, 5, ship.height - 10);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (isMovingLeft) {
      const stg = ctx.createRadialGradient(ship.width / 2 - 4, ship.height / 4, 0, ship.width / 2 - 4, ship.height / 4, 13);
      stg.addColorStop(0, "rgba(100, 220, 255, 0.5)");
      stg.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = stg;
      ctx.beginPath(); ctx.arc(ship.width / 2 - 4, ship.height / 4, 13, 0, Math.PI * 2); ctx.fill();
    }
    if (isMovingRight) {
      const stg = ctx.createRadialGradient(-ship.width / 2 + 4, ship.height / 4, 0, -ship.width / 2 + 4, ship.height / 4, 13);
      stg.addColorStop(0, "rgba(100, 220, 255, 0.5)");
      stg.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = stg;
      ctx.beginPath(); ctx.arc(-ship.width / 2 + 4, ship.height / 4, 13, 0, Math.PI * 2); ctx.fill();
    }

    if (state.shieldActive) {
      const t = state.shieldFrames / 300;
      const pulse = Math.sin(Date.now() * 0.008) * 3;
      const slowPulse = Math.sin(Date.now() * 0.004);
      const r = 52 + pulse;
      state.shieldAngle = (state.shieldAngle + 0.03) % (Math.PI * 2);
      const alpha = Math.min(1, t * 3);

      // outer soft glow halos
      ctx.shadowBlur = 0;
      for (const [hr, ha] of [[r + 28, 0.08], [r + 16, 0.13], [r + 8, 0.18]]) {
        const hg = ctx.createRadialGradient(0, 0, r, 0, 0, hr);
        hg.addColorStop(0, `rgba(68,200,255,${ha * alpha})`);
        hg.addColorStop(1, `rgba(68,200,255,0)`);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
      }

      // dome fill
      const domeGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      domeGrad.addColorStop(0, `rgba(68,200,255,0)`);
      domeGrad.addColorStop(0.6, `rgba(68,200,255,${(0.08 + slowPulse * 0.04) * alpha})`);
      domeGrad.addColorStop(1, `rgba(120,230,255,${(0.35 + slowPulse * 0.1) * alpha})`);
      ctx.fillStyle = domeGrad;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

      // main ring with canvas shadow glow
      ctx.save();
      ctx.shadowColor = "rgba(68,200,255,0.9)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(120,230,255,${alpha})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 8;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * alpha})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // outer halo ring
      ctx.strokeStyle = `rgba(68,200,255,${0.3 * alpha})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke();

      // rotating tick marks with glow
      ctx.save();
      ctx.shadowColor = "rgba(180,240,255,0.8)";
      ctx.shadowBlur = 10;
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const a = state.shieldAngle + (i / segments) * Math.PI * 2;
        const x1 = Math.cos(a) * (r - 10); const y1 = Math.sin(a) * (r - 10);
        const x2 = Math.cos(a) * (r + 2); const y2 = Math.sin(a) * (r + 2);
        ctx.strokeStyle = `rgba(200,245,255,${0.9 * alpha})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
    }

    if (state.invulnerable && !state.shieldActive) {
      const pulse = Math.sin(Date.now() * 0.015) * 4;
      ctx.strokeStyle = "rgba(100,200,255,0.6)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 38 + pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(100,200,255,0.25)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 46 + pulse, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  }

  function drawBullets() {
    state.bulletsList.forEach((b) => {
      const glow = ctx.createRadialGradient(b.x + b.width / 2, b.y + b.height / 2, 0, b.x + b.width / 2, b.y + b.height / 2, 12);
      glow.addColorStop(0, "rgba(100,220,255,0.45)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2, b.y + b.height / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      const grad = ctx.createLinearGradient(b.x + b.width / 2, b.y + b.height, b.x + b.width / 2, b.y);
      grad.addColorStop(0, "rgba(100,220,255,0)");
      grad.addColorStop(0.4, "rgba(150,230,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,1)");
      ctx.fillStyle = grad;
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });
  }

  function drawEngineTrails() {
    state.engineTrails.forEach((t) => {
      ctx.globalAlpha = (t.life / t.maxLife) * 0.65;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts() {
    state.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.fontSize || 15}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.fontSize ? 18 : 10;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }

  function drawComboDisplay() {
    if (state.comboDisplayTimer <= 0) return;
    state.comboDisplayTimer--;
    const alpha = state.comboDisplayTimer < 25 ? state.comboDisplayTimer / 25 : 1;
    const scale = state.comboDisplayTimer > 75 ? 1 + (state.comboDisplayTimer - 75) / 15 * 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(canvas.width / 2, canvas.height / 2 - 60);
    ctx.scale(scale, scale);
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`× ${state.comboVal} COMBO!`, 0, 0);
    ctx.restore();
  }

  function drawMeteorStormBanner() {
    if (state.meteorStormFrames <= 0) return;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.012);
    const fadeIn = Math.min(1, (600 - state.meteorStormFrames) / 30);
    const fadeOut = state.meteorStormFrames < 60 ? state.meteorStormFrames / 60 : 1;
    const baseAlpha = Math.min(fadeIn, fadeOut);
    const alpha = baseAlpha * pulse;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "#FF4400";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#FF6622";
    ctx.fillText("☄️  METEOR STORM!", canvas.width / 2, 52);
    ctx.font = "13px Arial";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffaa88";
    const secs = Math.ceil(state.meteorStormFrames / 60);
    ctx.fillText(`${secs}s remaining — SURVIVE!`, canvas.width / 2, 72);
    ctx.restore();
  }

  function drawScrambleBanner() {
    if (state.scrambleWarnFrames <= 0 && state.scrambleFrames <= 0) return;
    ctx.save();
    ctx.textAlign = "center";
    if (state.scrambleWarnFrames > 0) {
      const blink = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.globalAlpha = blink ? 1 : 0.35;
      ctx.font = "bold 24px Arial";
      ctx.shadowColor = "#FF2222";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "#FF4444";
      ctx.fillText("⚡ CONTROLS JAMMED!", canvas.width / 2, 52);
      ctx.font = "13px Arial";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffaaaa";
      const secs = Math.ceil(state.scrambleWarnFrames / 60);
      ctx.fillText(`Activating in ${secs}s — brace yourself!`, canvas.width / 2, 72);
    } else {
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.018);
      ctx.globalAlpha = pulse;
      ctx.font = "bold 24px Arial";
      ctx.shadowColor = "#FFAA00";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "#FFD700";
      ctx.fillText("⚡ CONTROLS JAMMED!", canvas.width / 2, 52);
      ctx.font = "13px Arial";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffe8a0";
      const secs = Math.ceil(state.scrambleFrames / 60);
      ctx.fillText(`${secs}s — left is right, right is left!`, canvas.width / 2, 72);
    }
    ctx.restore();
  }

  function drawDamagedBanner() {
    if (state.damagedFrames <= 0) return;
    const secs = Math.ceil(state.damagedFrames / 60);
    const blink = Math.floor(Date.now() / 150) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = 0.07 + 0.05 * Math.sin(Date.now() * 0.04);
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * canvas.width;
      const sy = Math.random() * canvas.height;
      const sw = 2 + Math.random() * 80;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,80,80,0.6)" : "rgba(255,255,255,0.3)";
      ctx.fillRect(sx, sy, sw, 1 + Math.random() * 2);
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = "center";
    ctx.globalAlpha = blink ? 1 : 0.55;
    ctx.font = "bold 18px Arial";
    ctx.shadowColor = "#FF3300";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#FF6633";
    ctx.fillText("⚠ SYSTEMS DAMAGED!", canvas.width / 2, 98);
    ctx.font = "12px Arial";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffb09a";
    ctx.fillText(`Controls impaired — ${secs}s`, canvas.width / 2, 114);
    ctx.restore();
  }

  function drawReverseAliens() {
    state.reverseAliens.forEach((ra) => ra.draw());
  }

  function drawBonusAliens() {
    state.heartAliens.forEach((ha) => ha.draw());
    state.shieldAliens.forEach((sa) => sa.draw());
    state.bombAliens.forEach((ba) => ba.draw());
  }

  function drawUFO() {
    const ufo = state.ufo;
    if (ufo) ufo.draw();
  }

  function drawUFOExplosionRing() {
    const ring = state.ufoExplosionRing;
    if (!ring) return;
    ctx.save();
    ctx.globalAlpha = ring.alpha * 0.85;
    ctx.strokeStyle = "#FFFFFF";
    ctx.shadowColor = "#FF8800";
    ctx.shadowBlur = 28;
    ctx.lineWidth = 6 * ring.alpha + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = "#FF4400";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#FFCC44";
    ctx.lineWidth = 2;
    ctx.globalAlpha = ring.alpha * 0.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSanta() {
    if (state.santaFrames <= 0) return;
    const TOTAL = 300;
    const frames = state.santaFrames;
    let alpha;
    if (frames > TOTAL - 25) {
      alpha = (TOTAL - frames) / 25;
    } else if (frames < 55) {
      alpha = frames / 55;
    } else {
      alpha = 1;
    }
    const bob = Math.sin(Date.now() * 0.006) * 8;
    const sx = state.santaX;
    const sy = Math.max(150, Math.min(canvas.height - 140, state.santaY + 20)) + bob;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "76px Arial";
    ctx.fillText("🎅", sx, sy);
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.012);
    ctx.font = `bold ${Math.round(28 * pulse)}px Arial`;
    ctx.shadowColor = "#FF2200";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#FF3333";
    ctx.fillText("HO-HO-HO!", sx, sy + 58);
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${Math.round(14 * pulse)}px Arial`;
    ctx.fillText("★ ★ ★", sx, sy + 82);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawCoinRain() {
    if (state.coinParticles.length === 0 && state.coinRainFrames <= 0) return;
    state.coinParticles.forEach((c) => {
      const spinX = Math.abs(Math.cos(c.spin));
      const rx = Math.max(0.5, c.size * spinX);
      const ry = c.size;
      const edgeH = Math.max(2, c.size * 0.28);
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 12;
      if (spinX > 0.08) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + edgeH, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#9A6700";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(c.x - rx * 0.3, c.y - ry * 0.3, ry * 0.08, c.x, c.y, Math.max(rx, ry));
      grad.addColorStop(0, "#FFF9A0");
      grad.addColorStop(0.45, "#FFD700");
      grad.addColorStop(1, "#B8860B");
      ctx.fillStyle = grad;
      ctx.fill();
      if (spinX > 0.35) {
        ctx.save();
        ctx.globalAlpha = c.alpha * Math.min(1, (spinX - 0.35) / 0.4);
        ctx.fillStyle = "#7A4F00";
        ctx.font = `bold ${Math.floor(c.size * 1.15)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", c.x, c.y + 1);
        ctx.restore();
      }
      if (spinX > 0.15) {
        ctx.globalAlpha = c.alpha * 0.55 * spinX;
        ctx.beginPath();
        ctx.ellipse(c.x - rx * 0.28, c.y - ry * 0.28, rx * 0.38, ry * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fill();
      }
      ctx.restore();
    });
    if (state.coinRainFrames > 0) {
      const alpha = state.coinRainFrames < 60 ? state.coinRainFrames / 60 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 20;
      ctx.fillStyle = "#FFD700";
      ctx.fillText("👑 COIN RAIN! 👑", canvas.width / 2, 95);
      ctx.restore();
    }
  }

  function drawLastEgg() {
    const egg = state.lastEgg;
    if (egg) egg.draw();
  }

  function drawGravityWell() {
    const gw = state.gravityWell;
    if (gw) gw.draw();
  }

  function drawSpotlight() {
    const sa = state.spotlightAlien;
    if (!sa || sa.onRock) return;
    const cx = sa.x + sa.width / 2;
    const cy = sa.y + sa.height / 2;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
    ctx.save();
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 28 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    const arrowTip = sa.y - 20 - pulse * 6;
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(cx, arrowTip + 12);
    ctx.lineTo(cx - 7, arrowTip);
    ctx.lineTo(cx + 7, arrowTip);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFireworks() {
    const shells = state.fireworkShells;
    shells.forEach(shell => {
      shell.trail.forEach((t, i) => {
        ctx.globalAlpha = (i / shell.trail.length) * 0.55;
        ctx.shadowColor = shell.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = shell.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowColor = shell.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(shell.x, shell.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    state.fireworkParticles.forEach(p => p.draw());
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawRemoteShip() {
    const rs = state.remoteShip;
    if (!rs || !rs.visible) return;

    rs.engineGlow = (rs.engineGlow || 0) + 0.15;
    const bobY = Math.sin(rs.engineGlow * 0.55) * 2.5;
    const flicker = 0.88 + Math.sin(rs.engineGlow * 3.5) * 0.08;
    const flameLen = 18;

    // Engine trail particles (purple tint to distinguish P2)
    if (Math.random() > 0.6) {
      rs.trailParticles.push({
        x: rs.x + rs.width / 2 + (Math.random() - 0.5) * 10,
        y: rs.y + rs.height + bobY,
        life: 25, maxLife: 25,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.5 + Math.random() * 2,
        size: 1.5 + Math.random() * 2,
      });
    }
    rs.trailParticles = rs.trailParticles.filter((p) => {
      p.y += p.vy; p.x += p.vx; p.life--;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t * 0.7;
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
      pg.addColorStop(0, `rgba(200, 100, 255, 1)`);
      pg.addColorStop(1, "rgba(80, 0, 200, 0)");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return p.life > 0;
    });

    ctx.save();
    ctx.translate(rs.x + rs.width / 2, rs.y + rs.height / 2 + bobY);
    ctx.rotate(rs.tilt);
    ctx.scale(rs.scale, rs.scale);
    const ey = rs.height / 2;

    // Engine flame (purple)
    const fInner = ctx.createLinearGradient(0, ey, 0, ey + flameLen);
    fInner.addColorStop(0, `rgba(255, 255, 255, ${0.9 * flicker})`);
    fInner.addColorStop(0.35, `rgba(200, 100, 255, ${0.8 * flicker})`);
    fInner.addColorStop(1, "rgba(80, 0, 200, 0)");
    ctx.fillStyle = fInner;
    ctx.beginPath();
    ctx.moveTo(-7, ey); ctx.quadraticCurveTo(-8, ey + flameLen * 0.55, 0, ey + flameLen);
    ctx.quadraticCurveTo(8, ey + flameLen * 0.55, 7, ey);
    ctx.closePath(); ctx.fill();

    // Ship hull — tinted purple
    if (rs.flash) ctx.globalAlpha = 0.4;
    if (state.shipImgLoaded) {
      ctx.filter = "hue-rotate(180deg) saturate(1.5)";
      ctx.drawImage(state.shipImg, -rs.width / 2, -rs.height / 2, rs.width, rs.height);
      ctx.filter = "none";
    } else {
      ctx.save();
      ctx.translate(-rs.width / 2, -rs.height / 2);
      const g = ctx.createLinearGradient(rs.width / 2, 0, rs.width / 2, rs.height);
      g.addColorStop(0, "#b44de2"); g.addColorStop(1, "#6a1fa6");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rs.width / 2, 0);
      ctx.lineTo(rs.width - 5, rs.height - 10);
      ctx.quadraticCurveTo(rs.width / 2, rs.height - 5, 5, rs.height - 10);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawFrame() {
    drawBackground();
    drawStars();
    const shaking = state.screenShakeFrames > 0;
    if (shaking) {
      const dx = (Math.random() - 0.5) * state.screenShakeMag * 2;
      const dy = (Math.random() - 0.5) * state.screenShakeMag * 2;
      ctx.save();
      ctx.translate(dx, dy);
    }
    state.rocks.forEach((r) => r.draw());
    state.meteorRocks.forEach((mr) => mr.draw());
    drawLastEgg();
    drawGravityWell();
    drawSpotlight();
    state.aliens.forEach((a) => a.draw());
    drawReverseAliens();
    drawBonusAliens();
    state.particles.forEach((p) => p.draw());
    drawCoinRain();
    drawEngineTrails();
    drawUFO();
    drawUFOExplosionRing();
    drawBullets();
    drawRemoteShip();
    drawShip();
    drawSanta();
    drawFloatingTexts();
    drawComboDisplay();
    drawMeteorStormBanner();
    drawScrambleBanner();
    drawDamagedBanner();
    if (shaking) ctx.restore();
    drawFireworks();
  }

  return { drawFrame };
}
