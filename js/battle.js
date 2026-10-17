// 전투 화면 캔버스 렌더러. 게임 이벤트를 받아 연출만 담당한다.
import { zoneOf } from './data.js';
import { fmt } from './fmt.js';

const SKILL_COLORS = { slash: '#a5f3fc', thunder: '#fde047' };

export class BattleView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.floats = [];
    this.particles = [];
    this.effects = [];
    this.t = 0;
    this.heroLunge = 0;
    this.monShake = 0;
    this.monFlash = 0;
    this.heroFlash = 0;
    this.monDeath = 0;
    this.shake = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get groundY() { return this.h * 0.78; }
  get heroX() { return this.w * 0.28; }
  get monX() { return this.w * 0.7; }

  handle(ev, game) {
    switch (ev.type) {
      case 'attack':
        this.heroLunge = 1;
        break;
      case 'dmg': {
        this.monShake = 1;
        this.monFlash = 1;
        const color = ev.kind === 'hit' ? (ev.crit ? '#f97316' : '#ffffff') : SKILL_COLORS[ev.kind] || '#fff';
        const size = ev.kind !== 'hit' ? 26 : ev.crit ? 24 : 18;
        this.float(fmt(ev.amount) + (ev.crit ? '!' : ''), this.monX + (Math.random() - 0.5) * 50, this.groundY - 110, color, size);
        if (ev.kind === 'slash') this.effects.push({ kind: 'slash', life: 0.35, max: 0.35 });
        if (ev.kind === 'thunder') { this.effects.push({ kind: 'thunder', life: 0.4, max: 0.4 }); this.shake = 0.35; }
        break;
      }
      case 'kill':
        this.monDeath = 1;
        this.burst(this.monX, this.groundY - 50, ev.isBoss ? 28 : 12, ev.isBoss ? '#fbbf24' : '#fde68a');
        this.float('+' + fmt(ev.gold) + ' G', this.monX, this.groundY - 150, '#fde047', 16);
        break;
      case 'heroHit':
        this.heroFlash = 1;
        this.float('-' + fmt(ev.amount), this.heroX, this.groundY - 110, '#f87171', 15);
        break;
      case 'heroDied':
        this.float(ev.boss ? '보스 실패…' : '쓰러졌다!', this.w / 2, this.h * 0.4, '#fca5a5', 22, 1.6);
        break;
      case 'stageClear':
        this.float(`STAGE ${ev.stage} 클리어!`, this.w / 2, this.h * 0.32, '#fde047', 24, 1.6);
        break;
      case 'skill':
        if (ev.id === 'rage') this.float('광폭화!', this.heroX, this.groundY - 140, '#fb7185', 20);
        if (ev.id === 'heal') { this.float('치유!', this.heroX, this.groundY - 140, '#4ade80', 20); this.burst(this.heroX, this.groundY - 50, 10, '#86efac'); }
        break;
      case 'spawn':
        this.monDeath = 0;
        if (ev.isBoss) this.float('⚠ BOSS ⚠', this.w / 2, this.h * 0.3, '#f87171', 26, 1.4);
        break;
      default:
    }
  }

  float(text, x, y, color, size = 18, life = 1) {
    this.floats.push({ text, x, y, color, size, life, max: life });
    if (this.floats.length > 40) this.floats.shift();
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.7, color });
    }
  }

  draw(game, dt) {
    this.t += dt;
    const { ctx, w, h } = this;
    const decay = (v, k) => Math.max(0, v - dt * k);
    this.heroLunge = decay(this.heroLunge, 6);
    this.monShake = decay(this.monShake, 7);
    this.monFlash = decay(this.monFlash, 14);
    this.heroFlash = decay(this.heroFlash, 6);
    this.shake = decay(this.shake, 1);

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 10 * this.shake);

    // 배경
    const raid = game.mode === 'raid';
    const zone = zoneOf(game.s.stage);
    const sky = raid ? ['#450a0a', '#7c2d12'] : zone.sky;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    // 먼 산 (천천히 흐름)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const off = (this.t * 12) % 160;
    ctx.beginPath();
    ctx.moveTo(-20, this.groundY);
    for (let x = -160 - off; x < w + 160; x += 160) {
      ctx.lineTo(x + 80, this.groundY - 60 - ((x / 160) % 2 ? 20 : 0));
      ctx.lineTo(x + 160, this.groundY);
    }
    ctx.fill();
    ctx.fillStyle = raid ? '#1c0a00' : zone.ground;
    ctx.fillRect(-20, this.groundY, w + 40, h - this.groundY + 20);

    this.drawHero(game);
    this.drawMonster(game, dt);
    this.drawEffects(dt);

    // 파티클
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;

    // 떠오르는 숫자
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 40 * dt;
      ctx.globalAlpha = Math.min(1, Math.max(0, f.life / f.max) * 1.6);
      ctx.font = `900 ${f.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawHero(game) {
    const { ctx } = this;
    const st = game.stats();
    const x = this.heroX + this.heroLunge * 26;
    const y = this.groundY;
    const bob = Math.sin(this.t * 5) * 2;
    const rage = game.buffs.rage > 0;

    ctx.save();
    ctx.translate(x, y + bob);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 2 - bob, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (rage) {
      ctx.fillStyle = `rgba(251,113,133,${0.25 + Math.sin(this.t * 12) * 0.1})`;
      ctx.beginPath(); ctx.arc(0, -40, 46, 0, Math.PI * 2); ctx.fill();
    }
    // 다리
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, -22, 9, 22);
    ctx.fillRect(3, -22, 9, 22);
    // 몸통 (망토 + 갑옷)
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath(); ctx.moveTo(-16, -56); ctx.lineTo(-24, -14); ctx.lineTo(-4, -18); ctx.fill();
    ctx.fillStyle = this.heroFlash > 0 ? '#fecaca' : '#3b82f6';
    roundRect(ctx, -15, -58, 30, 38, 8); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-15, -30, 30, 5);
    // 머리
    ctx.fillStyle = '#fde3c4';
    ctx.beginPath(); ctx.arc(0, -72, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(0, -75, 15, Math.PI, 0); ctx.fill();
    ctx.fillRect(-15, -76, 30, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(4, -72, 3, 4);
    // 검
    const swing = this.heroLunge;
    ctx.save();
    ctx.translate(14, -44);
    ctx.rotate(-1.1 + swing * 2.2);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-3, -2, 6, 12);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-9, -5, 18, 4);
    ctx.fillStyle = rage ? '#fda4af' : '#e2e8f0';
    ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(0, -52); ctx.lineTo(4, -5); ctx.fill();
    ctx.restore();
    ctx.restore();

    hpBar(ctx, this.heroX - 32, this.groundY - 104, 64, 7, game.heroHp / st.hp, '#22c55e');
  }

  drawMonster(game, dt) {
    const { ctx } = this;
    const m = game.mon;
    if (!m) return;
    const scale = m.isRaid ? 2.4 : m.isBoss ? 1.7 : 1;
    const size = 64 * scale;
    const shake = this.monShake * 6;
    const x = this.monX + (Math.random() - 0.5) * shake;
    const y = this.groundY;
    if (!m.alive) {
      this.monDeath = Math.max(0, this.monDeath - dt * 3);
      if (this.monDeath <= 0) return;
    }
    const alpha = m.alive ? 1 : this.monDeath;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.42, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; // 컬러 이모지도 fillStyle의 투명도를 따라가므로 불투명하게
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const bob = Math.sin(this.t * 3 + 1) * 3;
    ctx.save();
    ctx.translate(x, y + bob + (m.alive ? 0 : (1 - alpha) * 20));
    ctx.scale(-1, 1); // 영웅 쪽을 보게
    ctx.fillText(m.emoji, 0, 0);
    if (this.monFlash > 0) {
      ctx.globalAlpha = this.monFlash * 0.35 * alpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillText(m.emoji, 0, 0);
    }
    ctx.restore();
    if (m.isBoss && !m.isRaid) {
      ctx.font = `${22 * scale}px sans-serif`;
      ctx.fillText('👑', x, y - size * 0.95 + bob);
    }
    ctx.restore();
    if (m.alive && !m.isRaid) {
      const bw = m.isBoss ? 120 : 70;
      hpBar(ctx, x - bw / 2, y - size - 14, bw, 7, m.hp / m.maxHp, m.isBoss ? '#ef4444' : '#f97316');
    }
  }

  drawEffects(dt) {
    const { ctx } = this;
    for (const e of this.effects) {
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      if (e.kind === 'slash') {
        ctx.strokeStyle = `rgba(165,243,252,${k})`;
        ctx.lineWidth = 10 * k + 2;
        ctx.beginPath();
        ctx.arc(this.monX, this.groundY - 50, 60 + (1 - k) * 30, -2.5 + (1 - k) * 4, -0.5 + (1 - k) * 4);
        ctx.stroke();
      } else if (e.kind === 'thunder') {
        ctx.strokeStyle = `rgba(253,224,71,${k})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        let x = this.monX + (Math.random() - 0.5) * 20;
        ctx.moveTo(x, 0);
        for (let y = 0; y < this.groundY - 40; y += 28) {
          x += (Math.random() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(254,249,195,${k * 0.35})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hpBar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}
