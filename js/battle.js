// 전투 화면 캔버스 렌더러. 게임 이벤트를 받아 연출만 담당한다.
import { zoneOf, RANKS, GRADES, PETS } from './data.js';
import { fmt } from './fmt.js';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const SKILL_COLORS = { slash: '#a5f3fc', thunder: '#fde047', frost: '#bae6fd', meteor: '#fb923c', pet: '#fbcfe8' };
const SHADOW_LOOK = { body: '#1f2937', cape: '#450a0a', helm: '#4b5563', trim: '#7f1d1d', plume: '#991b1b', aura: '#7f1d1d' };
const SKY = {
  raid: ['#450a0a', '#7c2d12'], trial: ['#1e1b4b', '#4c1d95'], pvp: ['#1e293b', '#475569'],
  gold: ['#713f12', '#ca8a04'], stone: ['#164e63', '#0e7490'], pet: ['#14532d', '#4d7c0f'], relic: ['#44403c', '#a8a29e'],
};

export class BattleView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.floats = [];
    this.particles = [];
    this.effects = [];
    this.projectiles = [];
    this.t = 0;
    this.scroll = 0;
    this.heroLunge = 0;
    this.monShake = 0;
    this.monFlash = 0;
    this.heroFlash = 0;
    this.monDeath = 0;
    this.shake = 0;
    this.banner = null;
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

  get groundY() { return this.h * 0.8; }
  get heroX() { return this.w * 0.27; }
  get monX() { return this.w * 0.7; }

  handle(ev, game) {
    switch (ev.type) {
      case 'attack':
        this.heroLunge = 1;
        break;
      case 'petAttack':
        this.projectiles.push({ x: this.heroX - 50, y: this.groundY - 30, life: 0.3, max: 0.3 });
        break;
      case 'dmg': {
        this.monShake = 1;
        this.monFlash = 1;
        const color = ev.kind === 'hit' ? (ev.crit ? '#fb923c' : '#ffffff') : SKILL_COLORS[ev.kind] || '#fff';
        const size = ev.kind === 'pet' ? 15 : ev.kind !== 'hit' ? 26 : ev.crit ? 24 : 18;
        this.float(fmt(ev.amount) + (ev.crit ? '!' : ''), this.monX + (Math.random() - 0.5) * 60, this.groundY - 120, color, size);
        if (ev.crit) this.burst(this.monX - 20, this.groundY - 60, 6, '#fdba74', 120);
        break;
      }
      case 'kill':
        this.monDeath = 1;
        this.burst(this.monX, this.groundY - 50, ev.isBoss ? 30 : 14, ev.isBoss ? '#fbbf24' : '#fde68a');
        if (ev.gold) {
          this.float('+' + fmt(ev.gold) + ' G', this.monX, this.groundY - 160, '#fde047', 16);
          for (let i = 0; i < (ev.isBoss ? 10 : 3); i++) this.coins(this.monX, this.groundY - 40);
        }
        break;
      case 'heroHit':
        this.heroFlash = 1;
        this.float('-' + fmt(ev.amount) + (ev.crit ? '!' : ''), this.heroX, this.groundY - 120, '#f87171', ev.crit ? 18 : 14);
        break;
      case 'heroDied':
        this.float(ev.boss ? '보스 실패…' : '쓰러졌다!', this.w / 2, this.h * 0.42, '#fca5a5', 22, 1.6);
        break;
      case 'stageClear':
        this.showBanner(`STAGE ${ev.stage} CLEAR`, '#fde047');
        break;
      case 'levelUp':
        this.effects.push({ kind: 'levelup', life: 1, max: 1 });
        this.float(`LEVEL UP! Lv.${ev.level}`, this.heroX, this.groundY - 150, '#fde047', 20, 1.4);
        break;
      case 'rankUp':
        this.showBanner(`승급! ${RANKS[ev.rank].name}`, '#f0abfc', 2.2);
        this.effects.push({ kind: 'levelup', life: 1.5, max: 1.5 });
        break;
      case 'skill':
        this.skillEffect(ev.id);
        break;
      case 'spawn':
        this.monDeath = 0;
        if (ev.isBoss && game.mode === 'stage') this.showBanner('⚠ BOSS ⚠', '#f87171', 1.2);
        break;
      case 'contestStart':
        this.monDeath = 0;
        this.showBanner({ dungeon: '던전 입장!', trial: '승급 시련', pvp: 'FIGHT!', raid: '길드 레이드' }[ev.mode] || '', '#fde68a', 1.2);
        break;
      default:
    }
  }

  skillEffect(id) {
    const add = (kind, life) => this.effects.push({ kind, life, max: life });
    if (id === 'slash') add('slash', 0.35);
    if (id === 'thunder') { add('thunder', 0.4); this.shake = 0.35; }
    if (id === 'frost') add('frost', 0.6);
    if (id === 'meteor') { add('meteor', 0.9); }
    if (id === 'rage') this.float('광폭화!', this.heroX, this.groundY - 150, '#fb7185', 20);
    if (id === 'gale') this.float('질풍!', this.heroX, this.groundY - 150, '#a7f3d0', 20);
    if (id === 'midas') { this.float('황금손!', this.heroX, this.groundY - 150, '#fde047', 20); for (let i = 0; i < 14; i++) this.coins(this.heroX, this.groundY - 120); }
    if (id === 'heal') { this.float('치유!', this.heroX, this.groundY - 150, '#4ade80', 20); this.burst(this.heroX, this.groundY - 60, 14, '#86efac'); }
  }

  showBanner(text, color, life = 1.4) { this.banner = { text, color, life, max: life }; }

  float(text, x, y, color, size = 18, life = 1) {
    this.floats.push({ text, x, y, color, size, life, max: life });
    if (this.floats.length > 40) this.floats.shift();
  }

  burst(x, y, n, color, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.7, color, size: 6 });
    }
  }

  coins(x, y) {
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * 220, vy: -200 - Math.random() * 160, life: 0.9, color: '#facc15', size: 8, coin: true,
    });
  }

  draw(game, dt) {
    this.t += dt;
    const { ctx } = this;
    const decay = (v, k) => Math.max(0, v - dt * k);
    this.heroLunge = decay(this.heroLunge, 6);
    this.monShake = decay(this.monShake, 7);
    this.monFlash = decay(this.monFlash, 14);
    this.heroFlash = decay(this.heroFlash, 6);
    this.shake = decay(this.shake, 1);
    const moving = !game.mon?.alive && game.mode === 'stage';
    this.scroll += dt * (moving ? 240 : 14);

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 12 * this.shake);
    this.drawBackground(game);
    this.drawQueue(game);
    this.drawMonster(game, dt);
    this.drawHeroUnit(game, moving);
    this.drawProjectiles(dt);
    this.drawEffects(dt);
    this.drawParticles(dt);
    this.drawFloats(dt);
    this.drawBanner(dt);
    ctx.restore();
  }

  // ---------- 배경 ----------
  drawBackground(game) {
    const { ctx, w, h } = this;
    const zone = zoneOf(game.s.stage);
    const key = game.mode === 'dungeon' ? game.contest.id : game.mode;
    const sky = SKY[key] || zone.sky;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // 먼 산
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    this.ridge(this.scroll * 0.15, 200, 70, this.groundY - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    this.ridge(this.scroll * 0.35, 130, 45, this.groundY);

    // 땅
    const ground = SKY[key] ? shade(sky[1], -0.45) : zone.ground;
    ctx.fillStyle = ground;
    ctx.fillRect(-20, this.groundY, w + 40, h - this.groundY + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-20, this.groundY, w + 40, 4);
    // 땅 무늬 (이동감)
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const step = 46;
    const off = this.scroll % step;
    for (let x = -off; x < w + step; x += step) ctx.fillRect(x, this.groundY + 12 + ((x / step) % 2 ? 8 : 0), 18, 3);

    // 소품
    if (game.mode === 'stage') {
      const pstep = 170;
      const poff = (this.scroll * 0.7) % pstep;
      for (let i = -1; i < w / pstep + 2; i++) {
        const x = i * pstep - poff + 40;
        this.prop(zone.prop, x, this.groundY, (i + Math.floor(this.scroll * 0.7 / pstep)) % 3);
      }
    }
  }

  ridge(off, period, amp, baseY) {
    const { ctx, w } = this;
    ctx.beginPath();
    ctx.moveTo(-20, baseY);
    const o = off % period;
    for (let x = -period - o; x < w + period; x += period) {
      ctx.lineTo(x + period / 2, baseY - amp);
      ctx.lineTo(x + period, baseY);
    }
    ctx.lineTo(w + 20, baseY);
    ctx.fill();
  }

  prop(kind, x, y, variant) {
    const { ctx } = this;
    const s = 0.8 + variant * 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.85;
    switch (kind) {
      case 'tree':
        ctx.fillStyle = '#78350f'; ctx.fillRect(-4, -30, 8, 30);
        ctx.fillStyle = '#16a34a'; circle(ctx, 0, -40, 20); circle(ctx, -12, -32, 13); circle(ctx, 12, -32, 13);
        break;
      case 'pine':
        ctx.fillStyle = '#422006'; ctx.fillRect(-3, -14, 6, 14);
        ctx.fillStyle = '#052e16';
        tri(ctx, 0, -70, 22, 34); tri(ctx, 0, -50, 26, 36); tri(ctx, 0, -30, 30, 24);
        break;
      case 'cactus':
        ctx.fillStyle = '#15803d';
        roundRect(ctx, -6, -46, 12, 46, 6); ctx.fill();
        roundRect(ctx, -20, -34, 8, 18, 4); ctx.fill(); ctx.fillRect(-16, -20, 12, 6);
        roundRect(ctx, 12, -40, 8, 20, 4); ctx.fill(); ctx.fillRect(4, -24, 12, 6);
        break;
      case 'crystal':
        ctx.fillStyle = '#bae6fd';
        tri(ctx, 0, -50, 10, 50); ctx.fillStyle = '#7dd3fc'; tri(ctx, 12, -32, 7, 32); tri(ctx, -11, -28, 6, 28);
        break;
      case 'rock':
        ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.ellipse(0, -10, 24, 14, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#f97316'; ctx.fillRect(-10, -4, 20, 3);
        break;
      case 'grave':
        ctx.fillStyle = '#6b7280'; roundRect(ctx, -10, -30, 20, 30, 9); ctx.fill();
        ctx.fillStyle = '#374151'; ctx.fillRect(-1.5, -24, 3, 12); ctx.fillRect(-5, -20, 10, 3);
        break;
      case 'cloud':
        ctx.fillStyle = '#ffffff'; circle(ctx, 0, -70, 14); circle(ctx, 14, -66, 11); circle(ctx, -14, -66, 11);
        break;
      case 'spike':
        ctx.fillStyle = '#7f1d1d'; tri(ctx, -8, -40, 7, 40); tri(ctx, 8, -28, 6, 28);
        break;
      default:
    }
    ctx.restore();
  }

  // ---------- 영웅 ----------
  drawHeroUnit(game, moving) {
    const st = game.stats();
    const look = RANKS[game.s.rank].look;
    const wg = game.bestGrade('weapon');
    const raging = game.buffs.rage > 0;
    const gale = game.buffs.gale > 0;
    const x = this.heroX + this.heroLunge * 26;
    drawHero(this.ctx, x, this.groundY, look, {
      t: this.t, lunge: this.heroLunge, flash: this.heroFlash, run: moving,
      blade: wg >= 0 ? GRADES[wg].color : '#e2e8f0', glow: wg >= 3, rage: raging,
    });
    if (gale) {
      const { ctx } = this;
      ctx.strokeStyle = 'rgba(167,243,208,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = this.groundY - 20 - i * 22;
        const xx = x - 50 - ((this.t * 300 + i * 40) % 80);
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 30, yy); ctx.stroke();
      }
    }
    // 펫
    if (game.s.pet) {
      const pet = PETS.find((p) => p.id === game.s.pet);
      const px = this.heroX - 56;
      const py = this.groundY + 2 - Math.abs(Math.sin(this.t * (moving ? 12 : 4))) * 6;
      emoji(this.ctx, pet.emoji, px, py, 34, false);
    }
    const ratio = Math.max(0, game.heroHp / st.hp);
    hpBar(this.ctx, this.heroX - 32, this.groundY - 118, 64, 7, ratio, '#22c55e');
    nameTag(this.ctx, `Lv.${game.s.level} ${game.s.nickname || ''}`, this.heroX, this.groundY - 126);
  }

  // ---------- 몬스터 ----------
  drawQueue(game) {
    if (!game.queue.length || (game.mode !== 'stage' && game.mode !== 'dungeon')) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.75;
    game.queue.slice(0, 2).forEach((e, i) => {
      const x = this.monX + 70 + i * 54 + Math.sin(this.t * 6 + i) * 2;
      emoji(ctx, e, x, this.groundY + Math.abs(Math.sin(this.t * 8 + i)) * -4, 38, true);
    });
    ctx.restore();
  }

  drawMonster(game, dt) {
    const { ctx } = this;
    const m = game.mon;
    if (!m) return;
    if (!m.alive) {
      this.monDeath = Math.max(0, this.monDeath - dt * 3);
      if (this.monDeath <= 0) return;
    }
    const alpha = m.alive ? 1 : this.monDeath;
    const x = this.monX + (Math.random() - 0.5) * this.monShake * 6;
    const y = this.groundY;

    if (m.isHero || m.trial) {
      // 결투 상대 / 시련의 기사: 영웅 모양으로 마주 보게
      ctx.save();
      ctx.globalAlpha = alpha;
      const look = m.trial ? SHADOW_LOOK : RANKS[m.rank || 0].look;
      const scale = m.trial ? 1.35 : 1;
      ctx.translate(x, y);
      ctx.scale(-scale, scale);
      drawHero(ctx, 0, 0, look, {
        t: this.t + 1, flash: this.monFlash, lunge: 0,
        blade: m.weaponGrade >= 0 ? GRADES[m.weaponGrade].color : m.trial ? '#ef4444' : '#e2e8f0', glow: m.trial || m.weaponGrade >= 3,
      });
      ctx.restore();
      if (m.petEmoji) emoji(ctx, m.petEmoji, x + 56, y + 2 - Math.abs(Math.sin(this.t * 4 + 2)) * 6, 34, true);
      if (m.alive) {
        hpBar(ctx, x - 40, y - 118 * scale, 80, 8, m.hp / m.maxHp, '#ef4444');
        nameTag(ctx, m.trial ? '시련의 기사' : m.name, x, y - 126 * scale);
      }
      if (m.stun > 0) this.iceBlock(x, y, 46 * scale, 120 * scale);
      return;
    }

    const scale = m.isRaid ? 2.4 : m.isBoss ? 1.7 : 1;
    const size = 64 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.42, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
    const bob = Math.sin(this.t * 3 + 1) * 3;
    if (m.isBoss && !m.isRaid) {
      ctx.fillStyle = `rgba(239,68,68,${0.18 + Math.sin(this.t * 5) * 0.08})`;
      circle(ctx, x, y - size * 0.5, size * 0.62);
    }
    emoji(ctx, m.emoji, x, y + bob + (m.alive ? 0 : (1 - alpha) * 20), size, true);
    if (this.monFlash > 0) {
      ctx.globalAlpha = this.monFlash * 0.35 * alpha;
      ctx.globalCompositeOperation = 'lighter';
      emoji(ctx, m.emoji, x, y + bob, size, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = alpha;
    if (m.isBoss && !m.isRaid) emoji(ctx, '👑', x, y - size * 0.92 + bob, 22 * scale, false);
    ctx.restore();
    if (m.stun > 0 && m.alive) this.iceBlock(x, y, size * 0.5, size);
    if (m.alive && !m.isRaid) {
      const bw = m.isBoss ? 120 : 70;
      hpBar(ctx, x - bw / 2, y - size - 14, bw, 7, m.hp / m.maxHp, m.isBoss ? '#ef4444' : '#f97316');
    }
  }

  iceBlock(x, y, hw, hh) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(186,230,253,0.35)';
    ctx.strokeStyle = 'rgba(224,242,254,0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, x - hw, y - hh, hw * 2, hh, 8);
    ctx.fill();
    ctx.stroke();
  }

  // ---------- 효과 ----------
  drawProjectiles(dt) {
    const { ctx } = this;
    for (const p of this.projectiles) {
      p.life -= dt;
      const k = 1 - Math.max(0, p.life / p.max);
      const x = p.x + (this.monX - p.x) * k;
      const y = p.y + (this.groundY - 60 - p.y) * k - Math.sin(k * Math.PI) * 40;
      ctx.fillStyle = '#f9a8d4';
      circle(ctx, x, y, 6);
      ctx.fillStyle = 'rgba(249,168,212,0.4)';
      circle(ctx, x - 8, y + 2, 4);
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  drawEffects(dt) {
    const { ctx } = this;
    for (const e of this.effects) {
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      if (e.kind === 'slash') {
        ctx.strokeStyle = `rgba(165,243,252,${k})`;
        ctx.lineWidth = 12 * k + 2;
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
      } else if (e.kind === 'frost') {
        ctx.fillStyle = `rgba(186,230,253,${k * 0.3})`;
        ctx.fillRect(0, 0, this.w, this.h);
        for (let i = 0; i < 8; i++) emoji(ctx, '❄️', this.monX + Math.cos(i + this.t) * 60, this.groundY - 60 + Math.sin(i * 2) * 50, 16, false);
      } else if (e.kind === 'meteor') {
        const p = 1 - k;
        if (p < 0.5) {
          const q = p / 0.5;
          const mx = this.monX + 160 * (1 - q);
          const my = -40 + (this.groundY - 40) * q;
          ctx.fillStyle = 'rgba(251,146,60,0.5)';
          circle(ctx, mx + 14, my - 14, 22);
          emoji(ctx, '☄️', mx, my + 20, 54, false);
        } else {
          const q = (p - 0.5) / 0.5;
          ctx.fillStyle = `rgba(253,186,116,${(1 - q) * 0.7})`;
          circle(ctx, this.monX, this.groundY - 30, 40 + q * 90);
          if (!e.boomed) { e.boomed = true; this.shake = 0.6; this.burst(this.monX, this.groundY - 30, 30, '#f97316', 260); }
        }
      } else if (e.kind === 'levelup') {
        const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
        g.addColorStop(0, 'rgba(253,224,71,0)');
        g.addColorStop(1, `rgba(253,224,71,${k * 0.6})`);
        ctx.fillStyle = g;
        ctx.fillRect(this.heroX - 34, 0, 68, this.groundY);
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
  }

  drawParticles(dt) {
    const { ctx } = this;
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.coin && p.y > this.groundY) { p.y = this.groundY; p.vy *= -0.4; p.vx *= 0.6; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.4));
      ctx.fillStyle = p.color;
      if (p.coin) {
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * Math.abs(Math.cos(this.t * 10 + p.vx)), 5, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    ctx.globalAlpha = 1;
  }

  drawFloats(dt) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 40 * dt;
      const k = Math.max(0, f.life / f.max);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      const pop = 1 + Math.max(0, (k - 0.85) * 3);
      ctx.font = `900 ${f.size * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    ctx.globalAlpha = 1;
  }

  drawBanner(dt) {
    const b = this.banner;
    if (!b) return;
    b.life -= dt;
    if (b.life <= 0) { this.banner = null; return; }
    const { ctx, w } = this;
    const k = b.life / b.max;
    const inK = Math.min(1, (1 - k) * 6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3);
    const y = this.h * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, y - 26, w * inK, 40);
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(b.text, w / 2, y + 2);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, w / 2, y + 2);
    ctx.restore();
  }
}

// ---------- 그리기 도우미 ----------
export function drawHero(ctx, x, y, look, o = {}) {
  const t = o.t || 0;
  const bob = o.run ? Math.abs(Math.sin(t * 14)) * -4 : Math.sin(t * 5) * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob);
  if (look.aura || o.rage) {
    const c = o.rage ? '251,113,133' : hexRgb(look.aura);
    const g = ctx.createRadialGradient(0, -48, 10, 0, -48, 56);
    g.addColorStop(0, `rgba(${c},${0.35 + Math.sin(t * 6) * 0.1})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    circle(ctx, 0, -48, 56);
  }
  if (look.wings) {
    ctx.fillStyle = look.wings;
    ctx.globalAlpha = 0.9;
    const flap = Math.sin(t * 6) * 0.15;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(-6, -52);
      ctx.rotate(dir * (0.35 + flap) - 0.2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-40, -36, -50, -6);
      ctx.quadraticCurveTo(-34, -10, -30, 8);
      ctx.quadraticCurveTo(-18, 0, 0, 6);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 다리 (달리기)
  const legA = o.run ? Math.sin(t * 14) * 7 : 0;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-12 + legA, -22, 9, 22);
  ctx.fillRect(3 - legA, -22, 9, 22);
  // 망토
  ctx.fillStyle = look.cape;
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(-26 - (o.run ? 6 : Math.sin(t * 3) * 2), -12);
  ctx.lineTo(-2, -18);
  ctx.fill();
  // 몸통
  ctx.fillStyle = o.flash > 0 ? '#fecaca' : look.body;
  roundRect(ctx, -15, -58, 30, 38, 8); ctx.fill();
  ctx.fillStyle = look.trim;
  ctx.fillRect(-15, -30, 30, 5);
  ctx.fillRect(-3, -56, 6, 26);
  // 어깨
  ctx.fillStyle = look.helm;
  circle(ctx, -14, -54, 7);
  circle(ctx, 14, -54, 7);
  // 머리 + 투구
  ctx.fillStyle = '#fde3c4';
  circle(ctx, 0, -72, 14);
  ctx.fillStyle = look.helm;
  ctx.beginPath(); ctx.arc(0, -75, 15, Math.PI, 0); ctx.fill();
  ctx.fillRect(-15, -76, 30, 4);
  if (look.plume) {
    ctx.fillStyle = look.plume;
    ctx.beginPath();
    ctx.moveTo(-2, -89);
    ctx.quadraticCurveTo(-22, -100 + Math.sin(t * 8) * 2, -24, -80);
    ctx.quadraticCurveTo(-12, -90, 2, -86);
    ctx.fill();
  }
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(4, -72, 3, 4);
  // 검
  ctx.save();
  ctx.translate(14, -44);
  ctx.rotate(-1.1 + (o.lunge || 0) * 2.2);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-3, -2, 6, 12);
  ctx.fillStyle = look.trim;
  ctx.fillRect(-9, -5, 18, 4);
  if (o.glow) {
    ctx.shadowColor = o.blade;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = o.rage ? '#fda4af' : o.blade || '#e2e8f0';
  ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(0, -54); ctx.lineTo(4, -5); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-0.5, -48, 1.5, 40);
  ctx.restore();
  ctx.restore();
}

function emoji(ctx, ch, x, y, size, flip) {
  ctx.save();
  ctx.fillStyle = '#000'; // 컬러 이모지도 fillStyle의 투명도를 따라가므로 불투명하게
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

function nameTag(ctx, text, x, y) {
  ctx.save();
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function tri(ctx, x, top, halfW, height) {
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + halfW, top + height); ctx.lineTo(x - halfW, top + height); ctx.fill();
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

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

