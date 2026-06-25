// All entity classes — closed over ctx, canvas, ship, and dep functions from the factory call.
// deps: { getLevel, getRockSpeed, getAlienSpeed, rockImages: { left, right, leftLoaded, rightLoaded } }
export function createEntityClasses(ctx, canvas, ship, deps) {
  const { getLevel, getRockSpeed, getAlienSpeed, rockImages, isTouchDevice } = deps;

  class Rock {
    constructor() {
      const level = getLevel();
      this.isBoss = level >= 10 && Math.random() < 0.3;
      const rockScale = isTouchDevice ? 0.6 : 1;
      this.width = (this.isBoss ? 260 + Math.random() * 60 : 80 + Math.random() * 160) * rockScale;
      this.height = (this.isBoss ? 160 + Math.random() * 40 : 60 + Math.random() * 40) * rockScale;
      this.hp = this.isBoss ? 5 : 1;
      this.maxHp = this.hp;
      this.side = Math.random() > 0.5 ? "left" : "right";
      this.x = this.side === "left" ? 0 : canvas.width - this.width;
      this.y = -this.height;
      const speedVariance = level >= 5 ? Math.random() * 0.6 : 0;
      this.speed = (this.isBoss ? 0.6 : getRockSpeed()) + speedVariance;
      const alienChance = level === 1 ? 0.9 : level === 2 ? 0.75 : 0.78;
      this.hasAlien = this.isBoss ? true : Math.random() < alienChance;
      const multiChance = level === 2 ? 0.25 : level === 3 ? 0.4 : level >= 4 ? 0.55 : 0;
      this.alienCount = this.isBoss ? 5 + Math.floor(Math.random() * 2) : (this.hasAlien && Math.random() < multiChance ? (Math.random() < 0.4 ? 3 : 2) : 1);
      this.scale = 0;
      this.hitFlash = 0;
    }

    update() {
      this.y += this.speed;
      if (this.scale < 1) this.scale = Math.min(1, this.scale + 0.08);
      if (this.hitFlash > 0) this.hitFlash--;
    }

    draw() {
      const img = this.side === "left" ? rockImages.left : rockImages.right;
      const loaded = this.side === "left" ? rockImages.leftLoaded : rockImages.rightLoaded;
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(this.scale, this.scale);

      if (this.isBoss) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
        const glowR = ctx.createRadialGradient(0, 0, this.width * 0.2, 0, 0, this.width * 0.8);
        glowR.addColorStop(0, `rgba(255,80,0,${0.25 + pulse * 0.2})`);
        glowR.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = glowR;
        ctx.fillRect(-this.width * 0.8, -this.height * 0.8, this.width * 1.6, this.height * 1.6);
      }

      if (this.hitFlash > 0) {
        ctx.globalAlpha = 0.5 + 0.5 * (this.hitFlash / 8);
        ctx.filter = "brightness(4) saturate(0)";
      }

      if (loaded) {
        ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
      } else {
        ctx.fillStyle = this.isBoss ? "#8a2a1a" : "#5a4a3a";
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      }

      ctx.filter = "none";
      ctx.globalAlpha = 1;

      if (this.isBoss && this.hp < this.maxHp) {
        const bw = this.width * 0.8;
        const bx = -bw / 2;
        const by = this.height / 2 + 8;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
        const frac = this.hp / this.maxHp;
        const barColor = frac > 0.6 ? "#44ff44" : frac > 0.3 ? "#ffcc00" : "#ff3333";
        ctx.fillStyle = barColor;
        ctx.fillRect(bx, by, bw * frac, 8);
      }

      ctx.restore();
    }

    isOffScreen() { return this.y > canvas.height; }

    checkCollision(s) {
      if (s.x + s.width < this.x || s.x > this.x + this.width ||
          s.y + s.height < this.y || s.y > this.y + this.height) return false;
      const cx = s.x + s.width / 2;
      const t = Math.max(0, Math.min(1, (cx - this.x) / this.width));
      const solidFraction = this.side === "left" ? (1 - t) : t;
      const rockBottom = this.y + this.height * solidFraction;
      return s.y < rockBottom && s.y + s.height > this.y;
    }
  }

  class Alien {
    constructor(rock, index = 0) {
      const level = getLevel();
      this.rock = rock;
      this.width = 30;
      this.height = 35;
      const spacing = 36;
      const baseX = rock.side === "right" ? rock.x + rock.width - 40 : rock.x + 10;
      this.x = baseX + index * spacing * (rock.side === "right" ? -1 : 1);
      this.y = rock.y - this.height;
      this.onRock = true;
      this.direction = rock.side === "right" ? -1 : 1;
      this.walkSpeed = getAlienSpeed();
      this.fallSpeed = 0;
      this.gravity = Math.min(this.rock.speed * 0.07, 0.14);
      this.scale = 1;
      this.legAnim = 0;
      this.armAnim = 0;
      this.antennaSwing = 0;
      this.blinkTimer = 0;
      this.eyeScale = 1;
      this.rotation = 0;
      this.rotationSpeed = 0;
      this.caught = false;
      this.catchScale = 1;
      this.expression = null;
      this.expressionTimer = 0;
      this.isGolden = level >= 10 && Math.random() < 0.125;
      if (this.isGolden) { this.width = 45; this.height = 52; this.scale = 1.5; }
      this.color = this.isGolden ? "#FFD700" : ["#7CFC00", "#00FF7F", "#32CD32", "#ADFF2F"][Math.floor(Math.random() * 4)];
      this.sparkleTimer = 0;
      this.isQueen = level >= 35 && !this.isGolden && Math.random() < 0.12;
      if (this.isQueen) {
        this.width = 60; this.height = 70; this.scale = 2;
        this.gravity = this.rock.speed * 0.015;
        this.walkSpeed = getAlienSpeed() * 0.2;
        this.color = "#FF69B4";
      }
    }

    update() {
      if (this.caught) {
        this.catchScale = Math.min(2, this.catchScale + 0.06);
        return;
      }

      if (this.onRock) {
        this.y = this.rock.y - this.height;
        if (this.rock.y < 0) return;
        this.x += this.direction * this.walkSpeed;
        this.legAnim += 0.3;
        this.armAnim += 0.25;
        this.antennaSwing += 0.2;

        if (this.x < this.rock.x || this.x + this.width > this.rock.x + this.rock.width) {
          this.onRock = false;
          this.fallSpeed = Math.min(this.rock.speed * 0.5, 1.0);
          this.rotationSpeed = this.direction * 0.1;
        }
      } else {
        this.fallSpeed += this.gravity;
        this.y += this.fallSpeed;
        this.rotation += this.rotationSpeed;
        this.armAnim += 0.4;
        this.antennaSwing += 0.3;
      }

      this.blinkTimer++;
      if (this.blinkTimer < 60) {
        this.eyeScale = 1;
      } else if (this.blinkTimer < 65) {
        this.eyeScale = Math.max(0.1, 1 - (this.blinkTimer - 60) / 5);
      } else if (this.blinkTimer < 70) {
        this.eyeScale = (this.blinkTimer - 65) / 5;
      } else {
        this.eyeScale = 1;
        this.blinkTimer = 0;
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.rotation);
      const s = this.caught ? this.catchScale : this.scale;
      ctx.scale(s, s);
      ctx.translate(-this.width / 2, -this.height / 2);

      const cx = this.width / 2;

      ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 4, 8);
      ctx.quadraticCurveTo(cx - 8 + Math.sin(this.antennaSwing) * 3, 2, cx - 8 + Math.sin(this.antennaSwing) * 5, 0);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, 8);
      ctx.quadraticCurveTo(cx + 8 + Math.sin(this.antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0);
      ctx.stroke();
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(this.antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.ellipse(cx - 2, 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#FFF";
      ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx - 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.beginPath(); ctx.arc(cx - 3, 12, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, 12, 1, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, 15, 4, 0.2, Math.PI - 0.2); ctx.stroke();

      const bodyColor = this.color === "#7CFC00" ? "#6BEB00" : this.color === "#00FF7F" ? "#00EE6F" : this.color === "#32CD32" ? "#2BBD2B" : this.color === "#FFD700" ? "#E5C100" : this.color === "#FF69B4" ? "#CC3377" : "#9CEE2E";
      ctx.fillStyle = bodyColor;
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();

      const ao = Math.sin(this.armAnim) * 3;
      ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(cx - 11, 24 + ao, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 11, 24 - ao, 2, 0, Math.PI * 2); ctx.fill();

      const lo = Math.sin(this.legAnim) * 2;
      ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(cx - 4, 34 + lo, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 34 - lo, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();

      if (this.expression && this.expressionTimer > 0) {
        this.expressionTimer--;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.expressionTimer / 12);
        ctx.font = "15px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.expression, cx, -6);
        ctx.restore();
      }

      if (this.isQueen) {
        const qPulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
        const qr = ctx.createRadialGradient(cx, 17, 0, cx, 17, 18);
        qr.addColorStop(0, `rgba(255,105,180,${0.25 + qPulse * 0.15})`);
        qr.addColorStop(1, "rgba(255,105,180,0)");
        ctx.fillStyle = qr;
        ctx.beginPath(); ctx.arc(cx, 17, 18, 0, Math.PI * 2); ctx.fill();
        ctx.font = "9px Arial";
        ctx.textAlign = "center";
        ctx.fillText("👑", cx, -1);
      }

      if (this.isGolden) {
        this.sparkleTimer = (this.sparkleTimer || 0) + 0.12;
        for (let si = 0; si < 5; si++) {
          const angle = this.sparkleTimer + (si / 5) * Math.PI * 2;
          const sr = 22;
          const sx = cx + Math.cos(angle) * sr;
          const sy = 17 + Math.sin(angle) * sr;
          const ss = 1.5 + Math.sin(angle * 2 + this.sparkleTimer) * 0.8;
          ctx.fillStyle = `rgba(255,255,100,${0.6 + 0.4 * Math.sin(angle + this.sparkleTimer)})`;
          ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
        }
      }

      ctx.restore();
    }

    isOffScreen() { return this.y > canvas.height; }
    isDoneBeingCaught() { return this.caught && this.catchScale >= 2; }

    checkCatch(s) {
      return this.x < s.x + s.width &&
             this.x + this.width > s.x &&
             this.y + this.height > s.y &&
             this.y < s.y + s.height;
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = (Math.random() - 0.5) * 4;
      this.life = 30;
      this.color = color;
      this.size = 3;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; this.size *= 0.95; }
    draw() {
      ctx.globalAlpha = this.life / 30;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  class FireworkParticle {
    constructor(x, y, color, vx, vy, twinkle) {
      this.x = x; this.y = y;
      this.color = color;
      this.vx = vx; this.vy = vy;
      this.life = 60 + Math.random() * 55;
      this.maxLife = this.life;
      this.size = 1.8 + Math.random() * 3.5;
      this.gravity = 0.055 + Math.random() * 0.035;
      this.drag = 0.965;
      this.twinkle = twinkle;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= this.drag;
      this.vy *= this.drag;
      this.life--;
    }
    draw() {
      const a = Math.pow(this.life / this.maxLife, 1.4);
      ctx.globalAlpha = a;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 7;
      ctx.fillStyle = (this.twinkle && Math.floor(this.life * 0.5) % 3 === 0) ? "#FFFFFF" : this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  class MeteorRock {
    constructor() {
      this.r = 5 + Math.random() * 10;
      this.x = this.r + Math.random() * (canvas.width - this.r * 2);
      this.y = -this.r * 2;
      this.speed = getRockSpeed() * (1.5 + Math.random() * 0.8);
      this.vx = (Math.random() - 0.5) * 0.7;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.035;
      this.jagged = Array.from({ length: 12 }, () => 0.72 + Math.random() * 0.52);
      this.shade = ["#7a4f1e", "#6b3d12", "#8a6030", "#5a3010"][Math.floor(Math.random() * 4)];
    }
    update() {
      this.y += this.speed;
      this.x += this.vx;
      this.rotation += this.rotSpeed;
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const tailLen = this.r * 3.5 + this.speed * 12;
      const t = Date.now() * 0.004;
      const wispOuter = ctx.createLinearGradient(0, -this.r * 0.6, 0, -this.r - tailLen * 1.1);
      wispOuter.addColorStop(0, "rgba(255,60,0,0.45)");
      wispOuter.addColorStop(0.3, "rgba(255,120,0,0.2)");
      wispOuter.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = wispOuter;
      ctx.beginPath();
      ctx.moveTo(-this.r * 0.7, -this.r * 0.6);
      ctx.quadraticCurveTo(this.r * 0.4 * Math.sin(t), -this.r - tailLen * 0.5, 0, -this.r - tailLen * 1.1);
      ctx.quadraticCurveTo(-this.r * 0.4 * Math.sin(t + 1), -this.r - tailLen * 0.5, this.r * 0.7, -this.r * 0.6);
      ctx.closePath();
      ctx.fill();
      const wispMid = ctx.createLinearGradient(0, -this.r * 0.5, 0, -this.r - tailLen * 0.8);
      wispMid.addColorStop(0, "rgba(255,140,0,0.7)");
      wispMid.addColorStop(0.4, "rgba(255,80,0,0.35)");
      wispMid.addColorStop(1, "rgba(255,50,0,0)");
      ctx.fillStyle = wispMid;
      ctx.beginPath();
      ctx.moveTo(-this.r * 0.45, -this.r * 0.5);
      ctx.quadraticCurveTo(-this.r * 0.3 * Math.sin(t * 1.3), -this.r - tailLen * 0.5, 0, -this.r - tailLen * 0.8);
      ctx.quadraticCurveTo(this.r * 0.3 * Math.sin(t * 1.3 + 2), -this.r - tailLen * 0.5, this.r * 0.45, -this.r * 0.5);
      ctx.closePath();
      ctx.fill();
      const wispCore = ctx.createLinearGradient(0, -this.r * 0.3, 0, -this.r - tailLen * 0.55);
      wispCore.addColorStop(0, "rgba(255,240,180,0.95)");
      wispCore.addColorStop(0.25, "rgba(255,200,80,0.6)");
      wispCore.addColorStop(0.7, "rgba(255,120,0,0.2)");
      wispCore.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = wispCore;
      ctx.beginPath();
      ctx.moveTo(-this.r * 0.22, -this.r * 0.3);
      ctx.quadraticCurveTo(this.r * 0.18 * Math.sin(t * 1.7), -this.r - tailLen * 0.3, 0, -this.r - tailLen * 0.55);
      ctx.quadraticCurveTo(-this.r * 0.18 * Math.sin(t * 1.7 + 1.5), -this.r - tailLen * 0.3, this.r * 0.22, -this.r * 0.3);
      ctx.closePath();
      ctx.fill();
      const glow = ctx.createRadialGradient(0, 0, this.r * 0.2, 0, 0, this.r * 1.5);
      glow.addColorStop(0, "rgba(255,90,0,0.28)");
      glow.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.shade;
      ctx.beginPath();
      const n = this.jagged.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.r * this.jagged[i];
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.ellipse(-this.r * 0.2, -this.r * 0.25, this.r * 0.28, this.r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    isOffScreen() { return this.y - this.r > canvas.height; }
    checkCollision(s) {
      const cx = Math.max(s.x, Math.min(this.x, s.x + s.width));
      const cy = Math.max(s.y, Math.min(this.y, s.y + s.height));
      const dx = this.x - cx, dy = this.y - cy;
      return dx * dx + dy * dy < this.r * this.r * 0.65;
    }
    checkBulletHit(b) {
      const bcx = b.x + b.width / 2, bcy = b.y + b.height / 2;
      const dx = this.x - bcx, dy = this.y - bcy;
      return dx * dx + dy * dy < this.r * this.r * 1.4;
    }
  }

  class ReverseAlien {
    constructor() {
      this.width = 30; this.height = 35;
      this.x = 40 + Math.random() * (canvas.width - 80);
      this.y = canvas.height + 10;
      this.speed = 1.4 + Math.random() * 1.2;
      this.color = "#FF4488";
      this.antennaSwing = 0; this.armAnim = 0; this.legAnim = 0;
      this.eyeScale = 1; this.blinkTimer = 0;
    }
    update() {
      this.y -= this.speed;
      this.antennaSwing += 0.2; this.armAnim += 0.25; this.legAnim += 0.3;
      this.blinkTimer++;
      if (this.blinkTimer < 60) this.eyeScale = 1;
      else if (this.blinkTimer < 65) this.eyeScale = Math.max(0.1, 1 - (this.blinkTimer - 60) / 5);
      else if (this.blinkTimer < 70) this.eyeScale = (this.blinkTimer - 65) / 5;
      else { this.eyeScale = 1; this.blinkTimer = 0; }
    }
    draw() {
      const c = this.color;
      const cx_s = this.x + this.width / 2;
      const cy_s = this.y + this.height / 2;
      ctx.save();
      ctx.translate(cx_s, cy_s);
      ctx.rotate(Math.PI);
      ctx.translate(-this.width / 2, -this.height / 2);
      const cx = this.width / 2;
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 4, 8); ctx.quadraticCurveTo(cx - 8 + Math.sin(this.antennaSwing) * 3, 2, cx - 8 + Math.sin(this.antennaSwing) * 5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, 8); ctx.quadraticCurveTo(cx + 8 + Math.sin(this.antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0); ctx.stroke();
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(this.antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx - 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#CC3377";
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();
      const ao = Math.sin(this.armAnim) * 3;
      ctx.strokeStyle = c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
      const lo = Math.sin(this.legAnim) * 2;
      ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FF4488";
      ctx.shadowColor = "#FF4488"; ctx.shadowBlur = 8;
      ctx.fillText("🎯 SHOOT!", cx_s, this.y - 6);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    isOffScreen() { return this.y + this.height < 0; }
    checkBulletHit(b) {
      return b.x < this.x + this.width && b.x + b.width > this.x &&
             b.y < this.y + this.height && b.y + b.height > this.y;
    }
  }

  class UFO {
    constructor() {
      this.fromLeft = Math.random() > 0.5;
      this.w = 110; this.h = 45;
      this.x = this.fromLeft ? -this.w : canvas.width;
      this.y = 85 + Math.random() * 80;
      this.speed = 1.3 + Math.random() * 0.8;
      this.beamPulse = 0; this.lightPhase = 0;
      this.hp = 15; this.maxHp = 15;
      this.hitFlash = 0;
    }
    update() {
      this.x += this.fromLeft ? this.speed : -this.speed;
      this.beamPulse += 0.08; this.lightPhase += 0.15;
      if (this.hitFlash > 0) this.hitFlash--;
    }
    checkBulletHit(b) {
      return b.x < this.x + this.w && b.x + b.width > this.x &&
             b.y < this.y + this.h && b.y + b.height > this.y;
    }
    draw() {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      const beamBottom = canvas.height - cy;
      const beamAlpha = 0.10 + 0.07 * Math.sin(this.beamPulse * 3);
      const beamGrad = ctx.createLinearGradient(0, this.h / 4, 0, beamBottom);
      beamGrad.addColorStop(0, `rgba(100,255,180,${beamAlpha * 4})`);
      beamGrad.addColorStop(1, "rgba(100,255,180,0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-10, this.h / 4);
      ctx.lineTo(-35, beamBottom);
      ctx.lineTo(35, beamBottom);
      ctx.lineTo(10, this.h / 4);
      ctx.closePath(); ctx.fill();
      const bodyGrad = ctx.createLinearGradient(0, -this.h / 4, 0, this.h / 4);
      if (this.hitFlash > 0) {
        bodyGrad.addColorStop(0, "#FFFFFF");
        bodyGrad.addColorStop(1, "#FF6666");
      } else {
        bodyGrad.addColorStop(0, "#AAEEFF");
        bodyGrad.addColorStop(1, "#4499CC");
      }
      ctx.fillStyle = bodyGrad;
      ctx.beginPath(); ctx.ellipse(0, 4, this.w / 2, this.h / 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#CCF0FF"; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(0, -2, this.w / 5, this.h / 2 * 0.85, 0, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 1;
      const rimColors = ["#FF4444", "#44FF44", "#4444FF", "#FFFF44", "#FF44FF"];
      for (let li = 0; li < 5; li++) {
        const a = (li / 5) * Math.PI * 2 + this.lightPhase;
        const lx = Math.cos(a) * (this.w / 2 - 8);
        const ly = 4 + Math.sin(a) * (this.h / 3 - 5);
        if (Math.sin(a) >= -0.3) {
          ctx.fillStyle = rimColors[li];
          ctx.shadowColor = rimColors[li]; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      if (this.hp < this.maxHp) {
        const barW = this.w * 0.8;
        const barH = 5;
        const barX = -barW / 2;
        const barY = -this.h / 2 - 12;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);
        const hpRatio = this.hp / this.maxHp;
        const hpColor = hpRatio > 0.5 ? "#44FF88" : hpRatio > 0.25 ? "#FFCC00" : "#FF4444";
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${this.hp}/${this.maxHp}`, 0, barY - 2);
      }
      ctx.restore();
    }
    isOffScreen() { return this.fromLeft ? this.x > canvas.width + this.w : this.x + this.w < 0; }
    getBeamBounds() { const cx = this.x + this.w / 2; return { xMin: cx - 32, xMax: cx + 32 }; }
  }

  class GravityWell {
    constructor() {
      this.radius = 230;
      this.strength = 0.7;
      this.x = 90 + Math.random() * (canvas.width - 180);
      this.y = 80 + Math.random() * (canvas.height - 260);
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.25 + 0.15;
      this.life = 300;
      this.maxLife = 300;
      this.angle = 0;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life--;
      this.angle += 0.025;
      if (this.x < 60 || this.x > canvas.width - 60) this.vx *= -1;
      if (this.y < 60 || this.y > canvas.height - 100) this.vy *= -1;
    }
    applyTo(cx, cy) {
      const dx = this.x - cx;
      const dy = this.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.radius && dist > 1) {
        const pull = this.strength * (this.radius / Math.max(dist, 40));
        return { ax: (dx / dist) * pull, ay: (dy / dist) * pull };
      }
      return { ax: 0, ay: 0 };
    }
    isDone() { return this.life <= 0; }
    draw() {
      const fadeIn  = Math.min(1, (this.maxLife - this.life) / 40);
      const fadeOut = Math.min(1, this.life / 40);
      const alpha   = Math.min(fadeIn, fadeOut);
      ctx.save();
      ctx.globalAlpha = alpha;
      const aura = ctx.createRadialGradient(this.x, this.y, 16, this.x, this.y, this.radius);
      aura.addColorStop(0,   "rgba(90,0,160,0.55)");
      aura.addColorStop(0.4, "rgba(50,0,100,0.25)");
      aura.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = aura;
      ctx.fill();
      const diskColors = ["rgba(220,100,255,0.75)", "rgba(160,60,230,0.55)", "rgba(100,30,180,0.4)"];
      const diskRadii  = [38, 26, 17];
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + i * (Math.PI * 2 / 3));
        ctx.scale(1, 0.32);
        ctx.beginPath();
        ctx.arc(0, 0, diskRadii[i], 0, Math.PI * 2);
        ctx.strokeStyle = diskColors[i];
        ctx.lineWidth = 3 - i * 0.6;
        ctx.shadowColor = "#BB44FF";
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      }
      const core = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 20);
      core.addColorStop(0,   "rgba(0,0,0,1)");
      core.addColorStop(0.7, "rgba(8,0,18,0.98)");
      core.addColorStop(1,   "rgba(50,0,90,0.5)");
      ctx.beginPath();
      ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.shadowColor = "#CC44FF";
      ctx.shadowBlur = 22;
      ctx.fill();
      ctx.strokeStyle = "rgba(210,110,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const lifeRatio = this.life / this.maxLife;
      if (lifeRatio < 0.4) {
        const r = Math.floor((1 - lifeRatio / 0.4) * 255);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 24, -Math.PI / 2, -Math.PI / 2 + lifeRatio / 0.4 * Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${255 - r},0,0.85)`;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class LastEgg {
    constructor() {
      this.width = 76; this.height = 104;
      this.x = canvas.width / 2 - this.width / 2 + (Math.random() - 0.5) * 80;
      this.y = -this.height;
      this.vy = 0.42;
      this.wobble = 0;
      this.glowPhase = 0;
      this.arrowBounce = 0;
      this.sparkles = Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * Math.PI * 2, dist: 70 + Math.random() * 20, phase: Math.random() * Math.PI * 2
      }));
      this.caught = false;
      this.catchScale = 1;
      this.cracked = false;
      this.crackedFrames = 0;
      this.crackedRotation = 0;
      this.crackedAlpha = 1;
    }
    update() {
      if (this.cracked) {
        this.crackedFrames++;
        this.vy += 0.12;
        this.y += this.vy;
        this.crackedRotation += 0.07;
        this.crackedAlpha = Math.max(0, 1 - this.crackedFrames / 55);
        this.glowPhase += 0.05;
        return;
      }
      if (this.caught) { this.catchScale = Math.min(3, this.catchScale + 0.07); return; }
      this.y += this.vy;
      this.wobble += 0.025;
      this.x += Math.sin(this.wobble) * 0.55;
      this.glowPhase += 0.05;
      this.arrowBounce += 0.12;
    }
    draw() {
      if (this.cracked) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2 + 4;
        ctx.save();
        ctx.globalAlpha = this.crackedAlpha;
        ctx.translate(cx, cy);
        ctx.rotate(this.crackedRotation);
        ctx.translate(-cx, -cy);
        ctx.shadowColor = "#FF2200";
        ctx.shadowBlur = 32 + Math.sin(this.glowPhase * 3) * 12;
        const eggGrad = ctx.createRadialGradient(cx - 14, cy - 20, 6, cx, cy, this.height / 2);
        eggGrad.addColorStop(0, "#FFE082");
        eggGrad.addColorStop(0.35, "#FF8800");
        eggGrad.addColorStop(0.7, "#CC2200");
        eggGrad.addColorStop(1, "#660000");
        ctx.beginPath();
        ctx.ellipse(cx, cy, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = eggGrad;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#1a0000";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx - 4, cy - 30); ctx.lineTo(cx + 10, cy - 8); ctx.lineTo(cx - 8, cy + 10); ctx.lineTo(cx + 4, cy + 30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 18, cy - 18); ctx.lineTo(cx + 4, cy + 2); ctx.lineTo(cx + 20, cy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 22, cy - 10); ctx.lineTo(cx - 6, cy + 6); ctx.lineTo(cx - 18, cy + 26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 10, cy - 28); ctx.lineTo(cx + 2, cy - 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 8, cy + 10); ctx.lineTo(cx - 4, cy + 28); ctx.stroke();
        const flashA = 0.25 + 0.2 * Math.sin(this.glowPhase * 6);
        ctx.beginPath();
        ctx.ellipse(cx, cy, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,0,0,${flashA})`;
        ctx.fill();
        ctx.restore();
        return;
      }

      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2 + 4;
      const glow = 0.5 + 0.5 * Math.sin(this.glowPhase);
      const progress = Math.max(0, Math.min(1, this.y / (canvas.height - 120)));
      const alpha = this.caught ? Math.max(0, 1 - (this.catchScale - 1) / 2) : 1;
      ctx.save();
      if (this.caught) {
        ctx.translate(cx, cy);
        ctx.scale(this.catchScale, this.catchScale);
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = alpha;
      }
      const haloR = 110 + glow * 24;
      const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, haloR);
      halo.addColorStop(0,   `rgba(255,240,60,${0.45 + glow * 0.25})`);
      halo.addColorStop(0.4, `rgba(80,255,160,${0.22 + glow * 0.14})`);
      halo.addColorStop(0.75,`rgba(255,180,0,${0.08 + glow * 0.06})`);
      halo.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.ellipse(cx, cy, haloR, haloR, 0, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      this.sparkles.forEach(sp => {
        const a = sp.angle + this.glowPhase * 0.6;
        const sx = cx + Math.cos(a) * sp.dist;
        const sy = cy + Math.sin(a) * sp.dist * 0.5;
        const sb = 0.5 + 0.5 * Math.sin(this.glowPhase * 2 + sp.phase);
        ctx.save();
        ctx.globalAlpha = alpha * (0.5 + 0.5 * sb);
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 8;
        ctx.fillStyle = sb > 0.5 ? "#FFFDE7" : "#FFD700";
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + sb * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      const eggGrad = ctx.createRadialGradient(cx - 14, cy - 20, 6, cx, cy, this.height / 2);
      eggGrad.addColorStop(0,    "#FFFDE7");
      eggGrad.addColorStop(0.3,  "#FFE082");
      eggGrad.addColorStop(0.68, "#F9A825");
      eggGrad.addColorStop(1,    "#E65100");
      ctx.shadowColor = `rgba(255,210,60,${0.7 + glow * 0.3})`;
      ctx.shadowBlur = 38 + glow * 22;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = eggGrad;
      ctx.fill();
      if (progress > 0.25) {
        const ca = Math.min(0.9, (progress - 0.25) / 0.45);
        ctx.globalAlpha = alpha * ca;
        ctx.strokeStyle = "#7B3F00";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(cx - 6, cy - 20); ctx.lineTo(cx + 6, cy - 2); ctx.lineTo(cx - 4, cy + 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 14, cy - 8); ctx.lineTo(cx + 8, cy + 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 16, cy + 4); ctx.lineTo(cx - 8, cy + 20); ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.ellipse(cx - 18, cy - 22, 13, 19, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx + 12, cy - 8, 6, 9, 0.3, 0, Math.PI * 2);
      ctx.fill();
      const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
      inner.addColorStop(0, `rgba(255,255,200,${0.35 + glow * 0.3})`);
      inner.addColorStop(1, "rgba(255,190,40,0)");
      ctx.beginPath();
      ctx.ellipse(cx, cy, 32, 40, 0, 0, Math.PI * 2);
      ctx.fillStyle = inner;
      ctx.fill();
      if (!this.caught) {
        const labelY = this.y - 18;
        const pulse = 0.75 + 0.25 * Math.sin(this.glowPhase * 2);
        ctx.save();
        ctx.globalAlpha = alpha * pulse;
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 18;
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFF176";
        ctx.fillText("⬇ CATCH IT! ⬇", cx, labelY);
        ctx.restore();
        const arrowY = this.y - 50 + Math.sin(this.arrowBounce) * 8;
        ctx.save();
        ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(this.arrowBounce));
        ctx.shadowColor = "#FF4444";
        ctx.shadowBlur = 14;
        ctx.font = "bold 22px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FF6666";
        ctx.fillText("▼", cx, arrowY);
        ctx.restore();
      }
      ctx.restore();
    }
    checkCatch(s) {
      if (this.caught || this.cracked) return false;
      const shipCx = s.x + s.width / 2;
      const eggCx  = this.x + this.width / 2;
      const eggBottom = this.y + this.height;
      return Math.abs(shipCx - eggCx) < 44 &&
             eggBottom > s.y && this.y < s.y + s.height;
    }
    isDoneBeingCaught() { return this.caught && this.catchScale >= 3; }
    isOffScreen() { return this.y > canvas.height + 10; }
  }

  class HeartAlien {
    constructor(rock, index = 0) {
      this.rock = rock;
      this.width = 30; this.height = 35;
      const spacing = 36;
      const baseX = rock.side === "right" ? rock.x + rock.width - 40 : rock.x + 10;
      this.x = baseX + index * spacing * (rock.side === "right" ? -1 : 1);
      this.y = rock.y - this.height;
      this.onRock = true;
      this.direction = rock.side === "right" ? -1 : 1;
      this.walkSpeed = getAlienSpeed();
      this.fallSpeed = 0;
      this.gravity = Math.min(this.rock.speed * 0.07, 0.14);
      this.color = "#FF4466";
      this.antennaSwing = 0; this.legAnim = 0; this.armAnim = 0;
      this.blinkTimer = 0; this.eyeScale = 1;
      this.caught = false; this.catchScale = 1;
      this.rotation = 0; this.rotationSpeed = 0;
      this.glowPhase = Math.random() * Math.PI * 2;
    }
    update() {
      if (this.caught) { this.catchScale = Math.min(3, this.catchScale + 0.06); return; }
      if (this.onRock) {
        this.y = this.rock.y - this.height;
        if (this.rock.y < 0) return;
        this.x += this.direction * this.walkSpeed;
        this.legAnim += 0.3; this.armAnim += 0.25; this.antennaSwing += 0.2;
        if (this.x < this.rock.x || this.x + this.width > this.rock.x + this.rock.width) {
          this.onRock = false;
          this.fallSpeed = Math.min(this.rock.speed * 0.5, 1.0);
          this.rotationSpeed = this.direction * 0.1;
        }
      } else {
        this.fallSpeed += this.gravity;
        this.y += this.fallSpeed;
        this.rotation += this.rotationSpeed;
        this.armAnim += 0.4; this.antennaSwing += 0.3;
      }
      this.glowPhase += 0.05;
      this.blinkTimer++;
      if (this.blinkTimer < 60) this.eyeScale = 1;
      else if (this.blinkTimer < 65) this.eyeScale = Math.max(0.1, 1 - (this.blinkTimer - 60) / 5);
      else if (this.blinkTimer < 70) this.eyeScale = (this.blinkTimer - 65) / 5;
      else { this.eyeScale = 1; this.blinkTimer = 0; }
    }
    draw() {
      const c = this.color;
      const pulse = Math.sin(this.glowPhase);
      const cx_s = this.x + this.width / 2;
      const cy_s = this.y + this.height / 2;
      const glowGrad = ctx.createRadialGradient(cx_s, cy_s, 6, cx_s, cy_s, 46);
      glowGrad.addColorStop(0, `rgba(255,60,100,${0.28 + pulse * 0.1})`);
      glowGrad.addColorStop(1, "rgba(255,60,100,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(cx_s, cy_s, 46, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(cx_s, cy_s);
      ctx.rotate(this.rotation);
      const s = this.caught ? this.catchScale : 1;
      ctx.scale(s, s);
      ctx.translate(-this.width / 2, -this.height / 2);
      const cx = this.width / 2;
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 4, 8);
      ctx.quadraticCurveTo(cx - 8 + Math.sin(this.antennaSwing) * 3, 2, cx - 8 + Math.sin(this.antennaSwing) * 5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, 8);
      ctx.quadraticCurveTo(cx + 8 + Math.sin(this.antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0); ctx.stroke();
      ctx.fillStyle = "#FF88AA";
      ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(this.antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx - 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#CC2244";
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();
      const ao = Math.sin(this.armAnim) * 3;
      ctx.strokeStyle = c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
      const lo = Math.sin(this.legAnim) * 2;
      ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = `bold ${18 + pulse * 2}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#FF4466"; ctx.shadowBlur = 14;
      ctx.fillText("❤️", cx_s, this.y - 6);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    checkCatch(s) {
      return s.x < this.x + this.width && s.x + s.width > this.x &&
             s.y < this.y + this.height && s.y + s.height > this.y;
    }
    isDoneBeingCaught() { return this.caught && this.catchScale >= 3; }
    isOffScreen() { return this.y > canvas.height + 20; }
  }

  class ShieldAlien {
    constructor(rock, index = 0) {
      this.rock = rock;
      this.width = 30; this.height = 35;
      const spacing = 36;
      const baseX = rock.side === "right" ? rock.x + rock.width - 40 : rock.x + 10;
      this.x = baseX + index * spacing * (rock.side === "right" ? -1 : 1);
      this.y = rock.y - this.height;
      this.onRock = true;
      this.direction = rock.side === "right" ? -1 : 1;
      this.walkSpeed = getAlienSpeed();
      this.fallSpeed = 0;
      this.gravity = Math.min(this.rock.speed * 0.07, 0.14);
      this.color = "#44CCFF";
      this.antennaSwing = 0; this.legAnim = 0; this.armAnim = 0;
      this.blinkTimer = 0; this.eyeScale = 1;
      this.caught = false; this.catchScale = 1;
      this.rotation = 0; this.rotationSpeed = 0;
      this.glowPhase = Math.random() * Math.PI * 2;
    }
    update() {
      if (this.caught) { this.catchScale = Math.min(3, this.catchScale + 0.06); return; }
      if (this.onRock) {
        this.y = this.rock.y - this.height;
        if (this.rock.y < 0) return;
        this.x += this.direction * this.walkSpeed;
        this.legAnim += 0.3; this.armAnim += 0.25; this.antennaSwing += 0.2;
        if (this.x < this.rock.x || this.x + this.width > this.rock.x + this.rock.width) {
          this.onRock = false;
          this.fallSpeed = Math.min(this.rock.speed * 0.5, 1.0);
          this.rotationSpeed = this.direction * 0.1;
        }
      } else {
        this.fallSpeed += this.gravity;
        this.y += this.fallSpeed;
        this.rotation += this.rotationSpeed;
        this.armAnim += 0.4; this.antennaSwing += 0.3;
      }
      this.glowPhase += 0.05;
      this.blinkTimer++;
      if (this.blinkTimer < 60) this.eyeScale = 1;
      else if (this.blinkTimer < 65) this.eyeScale = Math.max(0.1, 1 - (this.blinkTimer - 60) / 5);
      else if (this.blinkTimer < 70) this.eyeScale = (this.blinkTimer - 65) / 5;
      else { this.eyeScale = 1; this.blinkTimer = 0; }
    }
    draw() {
      const c = this.color;
      const pulse = Math.sin(this.glowPhase);
      const cx_s = this.x + this.width / 2;
      const cy_s = this.y + this.height / 2;
      const glowGrad = ctx.createRadialGradient(cx_s, cy_s, 6, cx_s, cy_s, 46);
      glowGrad.addColorStop(0, `rgba(68,200,255,${0.28 + pulse * 0.1})`);
      glowGrad.addColorStop(1, "rgba(68,200,255,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(cx_s, cy_s, 46, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(cx_s, cy_s);
      ctx.rotate(this.rotation);
      const s = this.caught ? this.catchScale : 1;
      ctx.scale(s, s);
      ctx.translate(-this.width / 2, -this.height / 2);
      const cx = this.width / 2;
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 4, 8);
      ctx.quadraticCurveTo(cx - 8 + Math.sin(this.antennaSwing) * 3, 2, cx - 8 + Math.sin(this.antennaSwing) * 5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, 8);
      ctx.quadraticCurveTo(cx + 8 + Math.sin(this.antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0); ctx.stroke();
      ctx.fillStyle = "#88DDFF";
      ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(this.antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx - 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, 13, 2 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1A99CC";
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();
      const ao = Math.sin(this.armAnim) * 3;
      ctx.strokeStyle = c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
      const lo = Math.sin(this.legAnim) * 2;
      ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = `bold ${18 + pulse * 2}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#44CCFF"; ctx.shadowBlur = 14;
      ctx.fillText("🛡️", cx_s, this.y - 6);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    checkCatch(s) {
      return s.x < this.x + this.width && s.x + s.width > this.x &&
             s.y < this.y + this.height && s.y + s.height > this.y;
    }
    isDoneBeingCaught() { return this.caught && this.catchScale >= 3; }
    isOffScreen() { return this.y > canvas.height + 20; }
  }

  class BombAlien {
    constructor(rock, index = 0) {
      this.rock = rock;
      this.width = 45; this.height = 52;
      const spacing = 36;
      const baseX = rock.side === "right" ? rock.x + rock.width - 40 : rock.x + 10;
      this.x = baseX + index * spacing * (rock.side === "right" ? -1 : 1);
      this.y = rock.y - this.height;
      this.onRock = true;
      this.direction = rock.side === "right" ? -1 : 1;
      this.walkSpeed = getAlienSpeed();
      this.fallSpeed = 0;
      this.gravity = Math.min(this.rock.speed * 0.035, 0.07);
      this.color = "#FF6600";
      this.antennaSwing = 0; this.legAnim = 0; this.armAnim = 0;
      this.blinkTimer = 0; this.eyeScale = 1;
      this.hit = false;
      this.rotation = 0; this.rotationSpeed = 0;
      this.glowPhase = Math.random() * Math.PI * 2;
    }
    update() {
      if (this.hit) return;
      if (this.onRock) {
        this.y = this.rock.y - this.height;
        if (this.rock.y < 0) return;
        this.x += this.direction * this.walkSpeed;
        this.legAnim += 0.3; this.armAnim += 0.25; this.antennaSwing += 0.2;
        if (this.x < this.rock.x || this.x + this.width > this.rock.x + this.rock.width) {
          this.onRock = false;
          this.fallSpeed = Math.min(this.rock.speed * 0.25, 0.5);
          this.rotationSpeed = this.direction * 0.1;
        }
      } else {
        this.fallSpeed += this.gravity;
        this.y += this.fallSpeed;
        this.rotation += this.rotationSpeed;
        this.armAnim += 0.4; this.antennaSwing += 0.3;
      }
      this.glowPhase += 0.05;
      this.blinkTimer++;
      if (this.blinkTimer < 60) this.eyeScale = 1;
      else if (this.blinkTimer < 65) this.eyeScale = Math.max(0.1, 1 - (this.blinkTimer - 60) / 5);
      else if (this.blinkTimer < 70) this.eyeScale = (this.blinkTimer - 65) / 5;
      else { this.eyeScale = 1; this.blinkTimer = 0; }
    }
    draw() {
      if (this.hit) return;
      const c = this.color;
      const pulse = Math.sin(this.glowPhase);
      const cx_s = this.x + this.width / 2;
      const cy_s = this.y + this.height / 2;
      const glowGrad = ctx.createRadialGradient(cx_s, cy_s, 9, cx_s, cy_s, 69);
      glowGrad.addColorStop(0, `rgba(255,100,0,${0.3 + pulse * 0.12})`);
      glowGrad.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(cx_s, cy_s, 69, 0, Math.PI * 2); ctx.fill();
      const s = 1.5;
      ctx.save();
      ctx.translate(cx_s, cy_s);
      ctx.scale(s, s);
      ctx.rotate(this.rotation);
      ctx.translate(-this.width / (2 * s), -this.height / (2 * s));
      const cx = this.width / (2 * s);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - 4, 8);
      ctx.quadraticCurveTo(cx - 8 + Math.sin(this.antennaSwing) * 3, 2, cx - 8 + Math.sin(this.antennaSwing) * 5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, 8);
      ctx.quadraticCurveTo(cx + 8 + Math.sin(this.antennaSwing + 1) * 3, 2, cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0); ctx.stroke();
      ctx.fillStyle = "#FF9944";
      ctx.beginPath(); ctx.arc(cx - 8 + Math.sin(this.antennaSwing) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8 + Math.sin(this.antennaSwing + 1) * 5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#222";
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, 12, 10, 11, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#FF4400";
      ctx.beginPath(); ctx.ellipse(cx - 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 4, 12, 3.5, 4 * this.eyeScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FF9900";
      ctx.beginPath(); ctx.arc(cx - 4, 13, 1.5 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, 13, 1.5 * this.eyeScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cx - 7, 20, 14, 10, 3); ctx.stroke();
      const ao = Math.sin(this.armAnim) * 3;
      ctx.strokeStyle = c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 7, 22); ctx.lineTo(cx - 11, 24 + ao); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 7, 22); ctx.lineTo(cx + 11, 24 - ao); ctx.stroke();
      const lo = Math.sin(this.legAnim) * 2;
      ctx.beginPath(); ctx.moveTo(cx - 3, 30); ctx.lineTo(cx - 4, 34 + lo); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, 30); ctx.lineTo(cx + 4, 34 - lo); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = `bold ${Math.round((18 + pulse * 2) * 1.5)}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#FF6600"; ctx.shadowBlur = 14;
      ctx.fillText("💣", cx_s, this.y - 9);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    checkHit() {
      return ship.x < this.x + this.width && ship.x + ship.width > this.x &&
             ship.y < this.y + this.height && ship.y + ship.height > this.y;
    }
    isOffScreen() { return this.y > canvas.height + 20; }
  }

  return { Rock, Alien, Particle, FireworkParticle, MeteorRock, ReverseAlien, UFO, GravityWell, LastEgg, HeartAlien, ShieldAlien, BombAlien };
}
