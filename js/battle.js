// 전투 화면 캔버스 렌더러 (수묵화 무협풍). 게임 이벤트를 받아 연출만 담당한다.
import { zoneOf, RANKS, GRADES, PETS, SKILLS } from './data.js';
import { fmt } from './fmt.js';

export const BRUSH = '"Yuji Syuku", "Nanum Brush Script", "Gowun Batang", serif';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const SHADOW_LOOK = { robe: '#0b0b0d', trim: '#3f0d12', sash: '#1f0a0c', band: '#7f1d1d', aura: '#4c0519', eyes: '#ef4444', hair: '#000' };
const SPECIAL_INK = {
  raid: { ink: ['#d9a48f', '#7f1d1d', '#3b0a0a', '#230606'], sun: '#450a0a', prop: 'rock' },
  trial: { ink: ['#2b2233', '#120e17', '#0a080d', '#060408'], sun: '#a855f7', moon: true, prop: 'none', night: true },
  pvp: { ink: ['#ece2cb', '#d3bf98', '#7b6a55', '#6b5844'], sun: '#c0392b', prop: 'arena' },
  gold: { ink: ['#3a2f22', '#1d1711', '#0f0b08', '#2a2016'], sun: '#fbbf24', moon: true, prop: 'lantern', night: true },
  stone: { ink: ['#5a5f66', '#2c3036', '#16181c', '#24272c'], sun: '#94a3b8', moon: true, prop: 'mine', night: true },
  pet: { ink: ['#dfe8d2', '#a9bf95', '#4a6040', '#3c5032'], sun: '#b91c1c', prop: 'bamboo' },
  relic: { ink: ['#4a4f5c', '#252832', '#121419', '#1b1e25'], sun: '#cbd5e1', moon: true, prop: 'grave', night: true },
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
    this.monLunge = 0;
    this.monShake = 0;
    this.monFlash = 0;
    this.hitstop = 0;   // 타격 순간 연출을 잠깐 느리게
    this.monKnock = 0;  // 맞고 밀려나는 거리
    this.heroFlash = 0;
    this.monDeath = 0;
    this.shake = 0;
    this.banner = null;
    this.hanja = null;
    this.flash = 0;
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
        if (Math.random() < 0.5) this.projectiles.push({ kind: 'qi', x: this.heroX + 30, y: this.groundY - 60, life: 0.22, max: 0.22 });
        break;
      case 'petAttack':
        this.projectiles.push({ kind: 'orb', x: this.heroX - 50, y: this.groundY - 30, life: 0.3, max: 0.3 });
        break;
      case 'dmg': {
        this.monShake = 1;
        this.monFlash = 1;
        const skill = ev.kind !== 'hit' && ev.kind !== 'pet';
        const color = ev.kind === 'pet' ? '#f9a8d4' : skill ? '#fde68a' : ev.crit ? '#ef4444' : '#ffffff';
        const size = ev.kind === 'pet' ? 14 : skill ? 28 : ev.crit ? 26 : 17;
        this.float(fmt(ev.amount) + (ev.crit ? '!' : ''), this.monX + (Math.random() - 0.5) * 60, this.groundY - 120, color, size, 1, ev.crit || skill);
        this.effects.push({ kind: 'cut', life: 0.18, max: 0.18, a: Math.random() * 0.8 - 0.4, crit: ev.crit });
        // 때린 순간 화면을 아주 잠깐 늦추고 상대를 밀어낸다 — 타격감
        this.hitstop = Math.max(this.hitstop, ev.crit || skill ? 0.075 : 0.032);
        this.monKnock = Math.max(this.monKnock, ev.crit || skill ? 16 : 7);
        if (ev.crit) {
          this.ink(this.monX - 10, this.groundY - 60, 10, '#7f1d1d', 160);
          this.shake = Math.max(this.shake, 0.32);
          this.flash = Math.max(this.flash, 0.22);
        }
        break;
      }
      case 'kill':
        this.monDeath = 1;
        this.ink(this.monX, this.groundY - 50, ev.isBoss ? 34 : 16, ev.isBoss ? '#450a0a' : '#111');
        if (ev.gold) {
          this.float('+' + fmt(ev.gold) + ' 銀', this.monX, this.groundY - 165, '#e5e7eb', 15);
          for (let i = 0; i < (ev.isBoss ? 10 : 3); i++) this.ingot(this.monX, this.groundY - 40);
        }
        break;
      case 'heroHit':
        this.heroFlash = 1;
        this.monLunge = 1;
        this.float('-' + fmt(ev.amount) + (ev.crit ? '!' : ''), this.heroX, this.groundY - 125, '#fca5a5', ev.crit ? 18 : 14);
        break;
      case 'heroDied':
        this.float(ev.boss ? '두목에게 패배…' : '쓰러졌다!', this.w / 2, this.h * 0.42, '#fca5a5', 24, 1.6, true);
        break;
      case 'stageClear':
        this.showBanner(`${ev.stage} 관문 돌파`, '#fef3c7', 1.5, '破');
        break;
      case 'levelUp':
        this.effects.push({ kind: 'pillar', life: 1, max: 1 });
        this.float(`레벨 ${ev.level}`, this.heroX, this.groundY - 155, '#fde68a', 24, 1.4, true);
        break;
      case 'rankUp':
        this.showBanner(`경지 돌파 · ${RANKS[ev.rank].name}`, '#fde68a', 2.4, '境');
        this.effects.push({ kind: 'pillar', life: 1.6, max: 1.6 });
        this.flash = 0.8;
        break;
      case 'regress':
        this.effects.push({ kind: 'regress', life: 2.2, max: 2.2 });
        this.hanja = { text: '回歸', life: 2.2, max: 2.2, color: '#f5f5f4' };
        break;
      case 'skill':
        this.skillEffect(ev.id);
        break;
      case 'spawn':
        this.monDeath = 0;
        if (ev.isBoss && game.mode === 'stage') this.showBanner(`두목 · ${game.mon?.def?.name || ''}`, '#fca5a5', 1.4);
        break;
      case 'contestStart':
        this.monDeath = 0;
        this.showBanner({ dungeon: '수련터 입장', trial: '심마(마음속의 적)', pvp: '겨루기 시작', raid: '문파 토벌 · 혈마' }[ev.mode] || '', '#fde68a', 1.4);
        break;
      default:
    }
  }

  skillEffect(id) {
    const sk = SKILLS.find((x) => x.id === id);
    const add = (kind, life, extra = {}) => this.effects.push({ kind, life, max: life, ...extra });
    if (sk) this.hanja = { text: sk.hz, life: 1, max: 1, color: id === 'rage' ? '#fca5a5' : id === 'frost' ? '#bae6fd' : '#fef3c7' };
    if (id === 'slash') for (let i = 0; i < 3; i++) this.projectiles.push({ kind: 'wave', x: this.heroX + 20, y: this.groundY - 50 - i * 18, life: 0.35 + i * 0.07, max: 0.35 + i * 0.07 });
    if (id === 'thunder') { add('thunder', 0.45); this.shake = 0.4; this.flash = 0.5; }
    if (id === 'frost') add('frost', 0.7);
    if (id === 'meteor') add('swords', 1.1, { seeds: Array.from({ length: 22 }, () => [Math.random(), Math.random()]) });
    if (id === 'heal') add('qi', 1, { color: '134,239,172' });
    if (id === 'midas') for (let i = 0; i < 16; i++) this.ingot(this.heroX + (Math.random() - 0.5) * 60, this.groundY - 140, true);
    if (id === 'gale') add('gale', 0.8);
  }

  showBanner(text, color, life = 1.4, seal = null) { this.banner = { text, color, life, max: life, seal }; }

  float(text, x, y, color, size = 18, life = 1, brush = false) {
    this.floats.push({ text, x, y, color, size, life, max: life, brush });
    if (this.floats.length > 40) this.floats.shift();
  }

  ink(x, y, n, color, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.8, color, size: 3 + Math.random() * 6, drop: true });
    }
  }

  ingot(x, y, rain = false) {
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * (rain ? 120 : 220), vy: rain ? Math.random() * 60 : -200 - Math.random() * 160,
      life: 1, color: '#e5e7eb', size: 8, ingot: true,
    });
  }

  draw(game, dt) {
    // 히트스톱: 맞은 직후 아주 짧게 연출만 느려진다(게임 진행은 그대로)
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      dt *= 0.18;
    }
    this.t += dt;
    const { ctx } = this;
    const decay = (v, k) => Math.max(0, v - dt * k);
    this.monKnock = decay(this.monKnock, 55);
    this.heroLunge = decay(this.heroLunge, 6);
    this.monLunge = decay(this.monLunge, 5);
    this.monShake = decay(this.monShake, 7);
    this.monFlash = decay(this.monFlash, 12);
    this.heroFlash = decay(this.heroFlash, 6);
    this.shake = decay(this.shake, 1);
    this.flash = decay(this.flash, 2);
    const moving = !game.mon?.alive && game.mode === 'stage';
    this.scroll += dt * (moving ? 220 : 12);

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 12 * this.shake);
    const scene = this.scene(game);
    this.drawBackground(scene);
    this.drawQueue(game);
    this.drawMonster(game, dt);
    this.drawHeroUnit(game, moving);
    this.drawProjectiles(dt);
    this.drawEffects(dt, game);
    this.drawParticles(dt);
    this.drawWeather(scene, dt);
    this.drawFloats(dt);
    this.drawHanja(dt);
    this.drawBanner(dt);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,251,235,${this.flash * 0.5})`;
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    }
    ctx.restore();
  }

  scene(game) {
    const key = game.mode === 'dungeon' ? game.contest.id : game.mode;
    return SPECIAL_INK[key] || zoneOf(game.s.stage);
  }

  // ---------- 수묵 배경 ----------
  drawBackground(z) {
    const { ctx, w, h } = this;
    const [skyTop, skyLow, mount, ground] = z.ink;
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // 해 / 달
    const sx = w * 0.78;
    const sy = h * 0.2;
    if (z.moon) {
      const mg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 60);
      mg.addColorStop(0, hexA(z.sun, 0.35));
      mg.addColorStop(1, hexA(z.sun, 0));
      ctx.fillStyle = mg;
      circle(ctx, sx, sy, 60);
      ctx.fillStyle = hexA(z.sun, 0.9);
      circle(ctx, sx, sy, 20);
    } else {
      ctx.fillStyle = hexA(z.sun, 0.85);
      circle(ctx, sx, sy, 22);
    }

    // 먹산 세 겹 (먼 산일수록 옅고 천천히)
    const layers = [
      { par: 0.08, base: this.groundY - 30, amp: h * 0.42, a: 0.18, seed: 1 },
      { par: 0.2, base: this.groundY - 10, amp: h * 0.3, a: 0.32, seed: 4 },
      { par: 0.4, base: this.groundY + 4, amp: h * 0.18, a: 0.5, seed: 9 },
    ];
    for (const L of layers) this.inkRidge(mount, L);

    // 안개 띠
    ctx.fillStyle = z.night ? 'rgba(200,210,230,0.06)' : 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 3; i++) {
      const y = this.groundY - 40 - i * 34;
      const x = ((this.t * (8 + i * 4) + i * 300) % (w + 400)) - 200;
      ctx.beginPath();
      ctx.ellipse(x, y, 180, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 소품
    if (z.prop && z.prop !== 'none') {
      const step = 190;
      const off = (this.scroll * 0.7) % step;
      const base = Math.floor((this.scroll * 0.7) / step);
      for (let i = -1; i < w / step + 2; i++) this.prop(z.prop, i * step - off + 60, this.groundY, (i + base) % 3, z);
    }

    // 땅: 붓으로 그은 듯한 윗선
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(-20, h + 20);
    ctx.lineTo(-20, this.groundY);
    for (let x = -20; x <= w + 20; x += 12) {
      const k = x + this.scroll;
      ctx.lineTo(x, this.groundY + Math.sin(k * 0.05) * 1.5 + Math.sin(k * 0.013) * 2.5);
    }
    ctx.lineTo(w + 20, h + 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 12) {
      const k = x + this.scroll;
      const y = this.groundY + Math.sin(k * 0.05) * 1.5 + Math.sin(k * 0.013) * 2.5;
      if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 붓 자국
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const step = 70;
    const off = this.scroll % step;
    for (let x = -off; x < w + step; x += step) {
      const k = Math.floor((x + this.scroll) / step);
      ctx.beginPath();
      ctx.ellipse(x + (k % 3) * 9, this.groundY + 14 + (k % 2) * 10, 16 + (k % 4) * 4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  inkRidge(color, L) {
    const { ctx, w } = this;
    const off = this.scroll * L.par;
    const top = L.base - L.amp;
    const g = ctx.createLinearGradient(0, top, 0, L.base);
    g.addColorStop(0, hexA(color, L.a));
    g.addColorStop(0.7, hexA(color, L.a * 0.55));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-20, L.base);
    for (let x = -20; x <= w + 20; x += 6) {
      const k = (x + off) * 0.004 + L.seed;
      const hgt = 0.55 * Math.pow(Math.abs(Math.sin(k * 2.1)), 1.6) + 0.3 * Math.abs(Math.sin(k * 5.3 + 1)) + 0.15 * Math.sin(k * 13 + 2);
      ctx.lineTo(x, L.base - L.amp * Math.max(0.05, hgt));
    }
    ctx.lineTo(w + 20, L.base);
    ctx.fill();
  }

  prop(kind, x, y, v, z) {
    const { ctx } = this;
    const ink = z.night ? 'rgba(5,5,8,0.85)' : 'rgba(20,18,15,0.82)';
    ctx.save();
    ctx.translate(x, y);
    const s = 0.85 + v * 0.12;
    ctx.scale(s, s);
    switch (kind) {
      case 'village': {
        // 기와지붕 집 + 홍등
        ctx.fillStyle = 'rgba(120,98,70,0.85)'; ctx.fillRect(-32, -38, 64, 38);
        ctx.fillStyle = 'rgba(40,30,20,0.85)'; ctx.fillRect(-7, -26, 14, 26);
        ctx.fillStyle = 'rgba(240,226,196,0.7)'; ctx.fillRect(-26, -30, 12, 10); ctx.fillRect(14, -30, 12, 10);
        // 처마가 들린 기와지붕
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.moveTo(-54, -36); ctx.quadraticCurveTo(-44, -40, -38, -52); ctx.lineTo(38, -52); ctx.quadraticCurveTo(44, -40, 54, -36);
        ctx.lineTo(56, -42); ctx.quadraticCurveTo(46, -42, 40, -58); ctx.lineTo(-40, -58); ctx.quadraticCurveTo(-46, -42, -56, -42);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-30, -64, 60, 6);
        ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.ellipse(40, -30, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(253,224,71,0.35)'; circle(ctx, 40, -30, 12);
        break;
      }
      case 'bamboo':
        for (let i = 0; i < 4; i++) {
          const bx = i * 14 - 20;
          const hh = 120 + ((i * 37 + v * 13) % 40);
          ctx.strokeStyle = i % 2 ? 'rgba(30,58,30,0.75)' : 'rgba(22,40,22,0.85)';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(bx, 0); ctx.quadraticCurveTo(bx + 6, -hh / 2, bx + Math.sin(this.t + i) * 4 + 10, -hh); ctx.stroke();
          ctx.fillStyle = 'rgba(20,35,20,0.8)';
          for (let k = 1; k < 5; k++) ctx.fillRect(bx - 3, -k * hh / 5, 7, 2);
          for (let k = 0; k < 3; k++) leaf(ctx, bx + 8, -hh * (0.5 + k * 0.15), 0.3 + k * 0.4 + Math.sin(this.t * 2 + i) * 0.1);
        }
        break;
      case 'dune':
        ctx.fillStyle = 'rgba(122,79,34,0.45)';
        ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-20, -40, 60, 0); ctx.fill();
        if (v === 1) { // 고목
          ctx.strokeStyle = ink; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -50); ctx.lineTo(-14, -70); ctx.moveTo(2, -40); ctx.lineTo(18, -62); ctx.stroke();
        }
        break;
      case 'snowpine':
      case 'pine':
      default: {
        // 소나무: 굽은 줄기 + 납작한 잎 덩어리
        ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-14, -40, 6, -70); ctx.quadraticCurveTo(20, -90, 4, -110); ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(4, -70); ctx.lineTo(34, -78); ctx.moveTo(0, -92); ctx.lineTo(-26, -98); ctx.stroke();
        ctx.fillStyle = ink;
        for (const [px, py, r] of [[36, -82, 22], [-28, -102, 20], [8, -116, 18]]) { ctx.beginPath(); ctx.ellipse(px, py, r, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        if (kind === 'snowpine') {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (const [px, py, r] of [[36, -87, 18], [-28, -107, 16], [8, -121, 14]]) { ctx.beginPath(); ctx.ellipse(px, py, r, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        break;
      }
      case 'rock':
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-24, -46); ctx.lineTo(-6, -30); ctx.lineTo(8, -70); ctx.lineTo(30, -20); ctx.lineTo(44, 0); ctx.fill();
        ctx.fillStyle = 'rgba(220,38,38,0.35)'; ctx.fillRect(-20, -6, 40, 3);
        break;
      case 'grave':
        ctx.fillStyle = 'rgba(60,64,72,0.9)'; roundRect(ctx, -12, -34, 24, 34, 10); ctx.fill();
        ctx.fillStyle = '#facc15'; ctx.fillRect(-4, -28, 8, 18);
        ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(2, -20); ctx.lineTo(-2, -15); ctx.stroke();
        if (v === 2) { ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(44, -60); ctx.lineTo(30, -84); ctx.moveTo(44, -50); ctx.lineTo(60, -70); ctx.stroke(); }
        break;
      case 'pavilion':
        ctx.fillStyle = ink;
        ctx.fillRect(-26, -46, 4, 46); ctx.fillRect(22, -46, 4, 46);
        ctx.beginPath(); ctx.moveTo(-44, -46); ctx.quadraticCurveTo(0, -56, 44, -46); ctx.quadraticCurveTo(48, -52, 42, -52); ctx.lineTo(0, -80); ctx.lineTo(-42, -52); ctx.quadraticCurveTo(-48, -52, -44, -46); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-50, -10, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'banner':
        ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -110); ctx.stroke();
        ctx.fillStyle = 'rgba(10,10,10,0.92)';
        ctx.beginPath(); ctx.moveTo(0, -108); ctx.lineTo(34 + Math.sin(this.t * 3) * 4, -100); ctx.lineTo(30 + Math.sin(this.t * 3 + 1) * 4, -56); ctx.lineTo(0, -62); ctx.fill();
        ctx.fillStyle = '#dc2626'; ctx.font = `22px ${BRUSH}`; ctx.textAlign = 'center'; ctx.fillText('魔', 16, -74);
        break;
      case 'lantern':
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, -88); ctx.stroke();
        ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.ellipse(0, -76, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(253,224,71,${0.25 + Math.sin(this.t * 3 + v) * 0.08})`; circle(ctx, 0, -76, 26);
        ctx.fillStyle = '#fde68a'; ctx.font = `13px ${BRUSH}`; ctx.textAlign = 'center'; ctx.fillText('錢', 0, -72);
        break;
      case 'mine':
        ctx.strokeStyle = 'rgba(120,90,60,0.9)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -60); ctx.lineTo(26, -60); ctx.lineTo(26, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(148,163,184,0.5)'; for (let i = 0; i < 3; i++) circle(ctx, -10 + i * 12, -10 - (i % 2) * 8, 5);
        break;
      case 'arena':
        ctx.fillStyle = 'rgba(120,100,80,0.6)'; ctx.fillRect(-90, -10, 180, 10);
        ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, -10); ctx.lineTo(-80, -90); ctx.stroke();
        ctx.fillStyle = '#b91c1c'; ctx.fillRect(-80, -88, 22, 40);
        ctx.fillStyle = '#fde68a'; ctx.font = `16px ${BRUSH}`; ctx.textAlign = 'center'; ctx.fillText('武', -69, -62);
        break;
    }
    ctx.restore();
  }

  drawWeather(z, dt) {
    const { ctx, w, h } = this;
    if (z.snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 40; i++) {
        const x = ((i * 97 + this.t * (20 + (i % 5) * 6)) % (w + 40)) - 20;
        const y = ((i * 53 + this.t * (30 + (i % 7) * 8)) % (h + 20)) - 10;
        circle(ctx, x, y, 1.2 + (i % 3) * 0.6);
      }
    }
    if (z.prop === 'bamboo') {
      ctx.fillStyle = 'rgba(40,70,40,0.6)';
      for (let i = 0; i < 8; i++) {
        const x = ((i * 131 - this.t * (30 + i * 4)) % (w + 60) + w + 60) % (w + 60) - 30;
        const y = ((i * 71 + this.t * (24 + i * 3)) % (h + 20)) - 10;
        leaf(ctx, x, y, this.t * 2 + i);
      }
    }
    if (z.prop === 'rock' || z.prop === 'banner') {
      for (let i = 0; i < 14; i++) {
        const x = (i * 83 + Math.sin(this.t + i) * 20) % w;
        const y = h - ((i * 47 + this.t * (20 + i * 3)) % h);
        ctx.fillStyle = `rgba(248,113,113,${0.3 + (i % 3) * 0.15})`;
        circle(ctx, x, y, 1.5);
      }
    }
    void dt;
  }

  // ---------- 영웅 ----------
  drawHeroUnit(game, moving) {
    const st = game.stats();
    const look = { ...RANKS[game.s.rank].look };
    const wg = game.bestGrade('weapon');
    const raging = game.buffs.rage > 0;
    const gale = game.buffs.gale > 0;
    const x = this.heroX + this.heroLunge * 24;
    const opts = {
      t: this.t, lunge: this.heroLunge, flash: this.heroFlash, run: moving, weapon: 'sword',
      blade: wg >= 0 ? GRADES[wg].color : '#e5e7eb', glow: wg >= 3, rage: raging,
    };
    if (gale) { // 잔상
      for (let i = 3; i >= 1; i--) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.12 * (4 - i);
        drawFighter(this.ctx, x - i * 16, this.groundY, look, { ...opts, flash: 0 });
        this.ctx.restore();
      }
    }
    drawFighter(this.ctx, x, this.groundY, look, opts);
    if (game.s.pet) {
      const pet = PETS.find((p) => p.id === game.s.pet);
      const px = this.heroX - 58;
      const py = this.groundY + 2 - Math.abs(Math.sin(this.t * (moving ? 12 : 4))) * 6;
      emoji(this.ctx, pet.emoji, px, py, 34, false);
    }
    hpBar(this.ctx, this.heroX - 32, this.groundY - 128, 64, 6, Math.max(0, game.heroHp / st.hp), '#16a34a');
    nameTag(this.ctx, `${RANKS[game.s.rank].name} ${game.s.nickname || ''}`, this.heroX, this.groundY - 136);
  }

  // ---------- 적 ----------
  drawQueue(game) {
    if (!game.queue.length || (game.mode !== 'stage' && game.mode !== 'dungeon')) return;
    const { ctx } = this;
    game.queue.slice(0, 2).forEach((def, i) => {
      const x = this.monX + 72 + i * 56;
      ctx.save();
      ctx.globalAlpha = 0.55;
      if (def.emoji) emoji(ctx, def.emoji, x, this.groundY, 40, true);
      else {
        ctx.translate(x, this.groundY);
        ctx.scale(-0.75, 0.75);
        drawFighter(ctx, 0, 0, def.look, { t: this.t + i * 2, run: true, weapon: def.look.weapon });
      }
      ctx.restore();
    });
  }

  drawMonster(game, dt) {
    const { ctx } = this;
    const m = game.mon;
    if (!m) return;
    if (!m.alive) {
      this.monDeath = Math.max(0, this.monDeath - dt * 2.5);
      if (this.monDeath <= 0) return;
    }
    const alpha = m.alive ? 1 : this.monDeath;
    const x = this.monX + (Math.random() - 0.5) * this.monShake * 6 - this.monLunge * 18 + this.monKnock;
    const y = this.groundY;
    let def = m.def || {};
    let look = def.look;
    let scale = look?.scale || 1;
    let weapon = look?.weapon;
    if (m.isHero) {
      look = RANKS[m.rank || 0].look;
      weapon = 'sword';
      scale = 1;
    } else if (m.trial) {
      look = { ...SHADOW_LOOK, swords: RANKS[game.s.rank].look.swords };
      weapon = 'sword';
      scale = 1.3;
    }
    const boss = m.isBoss && !m.isRaid && !m.trial;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (look) {
      ctx.translate(x, y + (m.alive ? 0 : (1 - alpha) * 10));
      ctx.scale(-scale, scale);
      if (look.ghost) ctx.globalAlpha = alpha * (0.55 + Math.sin(this.t * 3) * 0.1);
      drawFighter(ctx, 0, 0, look, {
        t: this.t + 1, flash: this.monFlash, lunge: this.monLunge, weapon,
        blade: m.isHero && m.weaponGrade >= 0 ? GRADES[m.weaponGrade].color : m.trial ? '#ef4444' : undefined,
        glow: m.trial || (m.isHero && m.weaponGrade >= 3),
      });
    } else if (def.emoji) {
      const size = (m.isBoss ? 100 : 62);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.42, 8, 0, 0, Math.PI * 2); ctx.fill();
      emoji(ctx, def.emoji, x, y + Math.sin(this.t * 3) * 3, size, true);
    }
    ctx.restore();

    const top = y - 118 * scale;
    if (m.petEmoji) emoji(ctx, m.petEmoji, x + 58, y + 2 - Math.abs(Math.sin(this.t * 4 + 2)) * 6, 34, true);
    if (m.stun > 0 && m.alive) iceBlock(ctx, x, y, 34 * scale, 115 * scale);
    if (m.alive && !m.isRaid) {
      const bw = boss || m.trial || m.isHero ? 110 : 66;
      hpBar(ctx, x - bw / 2, top - 6, bw, 6, m.hp / m.maxHp, boss || m.trial ? '#b91c1c' : '#ea580c');
      const name = m.isHero ? `${RANKS[m.rank || 0].name} ${m.name}` : m.trial ? '심마(心魔)' : def.name || '';
      nameTag(ctx, name, x, top - 12, boss || m.trial);
    }
  }

  // ---------- 효과 ----------
  drawProjectiles(dt) {
    const { ctx } = this;
    for (const p of this.projectiles) {
      p.life -= dt;
      const k = 1 - Math.max(0, p.life / p.max);
      const tx = this.monX - 10;
      const x = p.x + (tx - p.x) * k;
      if (p.kind === 'orb') {
        const y = p.y + (this.groundY - 60 - p.y) * k - Math.sin(k * Math.PI) * 40;
        ctx.fillStyle = 'rgba(249,168,212,0.9)'; circle(ctx, x, y, 6);
        ctx.fillStyle = 'rgba(249,168,212,0.35)'; circle(ctx, x - 9, y + 2, 5);
      } else {
        // 검기: 초승달 모양
        const y = p.y;
        const big = p.kind === 'wave';
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = big ? `rgba(224,242,254,${0.9 - k * 0.4})` : `rgba(255,255,255,${0.75 - k * 0.5})`;
        ctx.lineWidth = big ? 6 : 3;
        ctx.beginPath();
        ctx.arc(-14, 0, big ? 30 : 18, -0.9, 0.9);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  drawEffects(dt, game) {
    const { ctx } = this;
    for (const e of this.effects) {
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      if (e.kind === 'cut') {
        // 베기 자국: 먹선
        ctx.save();
        ctx.translate(this.monX - 6, this.groundY - 62);
        ctx.rotate(e.a);
        ctx.strokeStyle = e.crit ? `rgba(185,28,28,${k})` : `rgba(255,255,255,${k * 0.9})`;
        ctx.lineWidth = (e.crit ? 7 : 4) * k + 1;
        ctx.beginPath(); ctx.moveTo(-34, -24); ctx.quadraticCurveTo(0, 6, 34, 22); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'thunder') {
        ctx.strokeStyle = `rgba(254,240,138,${k})`;
        ctx.lineWidth = 5;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        let x = this.monX + (Math.random() - 0.5) * 20;
        ctx.moveTo(x, 0);
        for (let y = 0; y < this.groundY - 40; y += 26) { x += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (e.kind === 'frost') {
        const p = 1 - k;
        const x = this.heroX + (this.monX - this.heroX) * Math.min(1, p * 2);
        ctx.fillStyle = `rgba(186,230,253,${0.55 * k})`;
        ctx.beginPath(); ctx.ellipse(x, this.groundY - 60, 22 + p * 10, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(224,242,254,${0.3 * k})`;
        ctx.fillRect(0, 0, this.w, this.h);
      } else if (e.kind === 'swords') {
        // 만검귀종: 하늘에서 검이 쏟아진다
        const p = 1 - k;
        for (const [a, b] of e.seeds) {
          const start = b * 0.5;
          const q = Math.max(0, Math.min(1, (p - start) / 0.35));
          if (q <= 0) continue;
          const sx = this.monX + (a - 0.5) * 120;
          const sy = -40 + (this.groundY - 40) * q;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(Math.PI);
          drawJian(ctx, 0, 0, '#e0f2fe', true, 0.9);
          ctx.restore();
        }
        if (p > 0.55 && !e.boomed) { e.boomed = true; this.shake = 0.6; this.ink(this.monX, this.groundY - 30, 30, '#0c4a6e', 260); }
      } else if (e.kind === 'qi') {
        for (let i = 0; i < 10; i++) {
          const a = this.t * 5 + i * 0.63;
          const r = 30 + (1 - k) * 20;
          ctx.fillStyle = `rgba(${e.color},${k * 0.8})`;
          circle(ctx, this.heroX + Math.cos(a) * r, this.groundY - 60 + Math.sin(a) * r * 0.6 - (1 - k) * 30, 3);
        }
      } else if (e.kind === 'gale') {
        ctx.strokeStyle = `rgba(255,255,255,${k * 0.7})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const yy = this.groundY - 15 - i * 18;
          const xx = this.heroX - 60 - ((this.t * 400 + i * 40) % 90);
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 40, yy); ctx.stroke();
        }
      } else if (e.kind === 'pillar') {
        const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
        g.addColorStop(0, 'rgba(253,224,71,0)');
        g.addColorStop(1, `rgba(253,224,71,${k * 0.6})`);
        ctx.fillStyle = g;
        ctx.fillRect(this.heroX - 30, 0, 60, this.groundY);
      } else if (e.kind === 'regress') {
        // 먹물이 화면을 덮었다가 걷힌다
        const p = 1 - k;
        const cover = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        ctx.fillStyle = `rgba(8,6,4,${Math.min(0.95, cover)})`;
        ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    void game;
  }

  drawParticles(dt) {
    const { ctx } = this;
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ingot && p.y > this.groundY) { p.y = this.groundY; p.vy *= -0.35; p.vx *= 0.6; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.4));
      if (p.ingot) {
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - 4); ctx.quadraticCurveTo(p.x, p.y + 6, p.x + 7, p.y - 4); ctx.lineTo(p.x + 4, p.y - 1); ctx.lineTo(p.x - 4, p.y - 1); ctx.fill();
        ctx.fillStyle = '#f9fafb'; circle(ctx, p.x, p.y - 3, 2.5);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.7, p.size * (p.drop ? 1 : 0.7), Math.atan2(p.vy, p.vx), 0, Math.PI * 2); ctx.fill();
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 240) this.particles.splice(0, this.particles.length - 240);
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
      ctx.font = f.brush ? `${f.size * pop * 1.2}px ${BRUSH}` : `900 ${f.size * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    ctx.globalAlpha = 1;
  }

  // 무공 이름 한자를 화면 가운데에 크게
  drawHanja(dt) {
    const hj = this.hanja;
    if (!hj) return;
    hj.life -= dt;
    if (hj.life <= 0) { this.hanja = null; return; }
    const { ctx, w } = this;
    const k = hj.life / hj.max;
    const size = Math.min(78, (w * 0.86) / Math.max(2, hj.text.length));
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2.5) * 0.92;
    ctx.font = `${size * (1 + (1 - k) * 0.12)}px ${BRUSH}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(hj.text, w / 2, this.h * 0.42);
    ctx.fillStyle = hj.color;
    ctx.fillText(hj.text, w / 2, this.h * 0.42);
    ctx.restore();
  }

  drawBanner(dt) {
    const b = this.banner;
    if (!b) return;
    b.life -= dt;
    if (b.life <= 0) { this.banner = null; return; }
    const { ctx, w } = this;
    const k = b.life / b.max;
    const inK = Math.min(1, (1 - k) * 6);
    const y = this.h * 0.24;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3);
    // 붓으로 그은 먹띠
    ctx.fillStyle = 'rgba(10,8,6,0.78)';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y - 18);
    ctx.quadraticCurveTo(w * 0.5, y - 26, w * (0.08 + 0.84 * inK), y - 16);
    ctx.lineTo(w * (0.08 + 0.84 * inK) - 6, y + 16);
    ctx.quadraticCurveTo(w * 0.5, y + 24, w * 0.08 + 8, y + 14);
    ctx.fill();
    ctx.font = `30px ${BRUSH}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, w / 2, y + 1);
    if (b.seal) { // 붉은 낙관
      const sx = w * 0.84;
      ctx.save();
      ctx.translate(sx, y - 2);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#b91c1c';
      roundRect(ctx, -17, -17, 34, 34, 4);
      ctx.fill();
      ctx.fillStyle = '#fef2f2';
      ctx.font = `26px ${BRUSH}`;
      ctx.fillText(b.seal, 0, 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- 무인 그리기 ----------
// 발끝 가운데가 (x, y), 오른쪽을 본다. look: 무복 색·머리·무기, o: 애니메이션 옵션
export function drawFighter(ctx, x, y, look = {}, o = {}) {
  const t = o.t || 0;
  const robe = look.robe || '#6b5640';
  const trim = look.trim || shade(robe, -0.35);
  const sash = look.sash || shade(robe, -0.5);
  const skin = look.skin || '#f1d3b3';
  const pants = shade(robe, -0.55);
  const weapon = o.weapon || look.weapon || 'sword';
  const jiang = look.jiangshi;
  const hop = jiang ? Math.abs(Math.sin(t * 5)) * -10 : 0;
  const bob = o.run ? Math.abs(Math.sin(t * 14)) * -3 : Math.sin(t * 4) * 1.5;
  const lunge = o.lunge || 0;

  ctx.save();
  ctx.translate(x, y);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 2, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob + hop);

  // 기운
  if (look.aura || o.rage) {
    const c = o.rage ? '#ef4444' : look.aura;
    const g = ctx.createRadialGradient(0, -55, 8, 0, -55, 62);
    g.addColorStop(0, hexA(c, 0.42 + Math.sin(t * 6) * 0.08));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    circle(ctx, 0, -55, 62);
    // 피어오르는 기
    for (let i = 0; i < 5; i++) {
      const ph = (t * 1.6 + i * 0.2) % 1;
      ctx.fillStyle = hexA(c, 0.5 * (1 - ph));
      circle(ctx, Math.sin(i * 2.3 + t) * 18, -10 - ph * 90, 3 - ph * 2);
    }
  }
  if (look.halo) {
    ctx.strokeStyle = hexA('#fde68a', 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-6, -88, 20, 0, Math.PI * 2); ctx.stroke();
  }
  // 떠도는 비검
  const n = look.swords || 0;
  const drawOrbit = (front) => {
    for (let i = 0; i < n; i++) {
      const a = t * 1.4 + (i * Math.PI * 2) / n;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      ctx.save();
      ctx.translate(Math.cos(a) * 38, -60 + Math.sin(a) * 10);
      ctx.rotate(Math.PI / 2 + Math.sin(t * 2 + i) * 0.1);
      drawJian(ctx, 0, 0, look.aura || '#e0f2fe', true, 0.7);
      ctx.restore();
    }
  };
  drawOrbit(false);

  // 머리끈 끝자락 (뒤로 날림)
  if (look.band || !look.head || look.head === 'band' || look.head === 'topknot') {
    ctx.strokeStyle = look.band || '#7f1d1d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-8, -90);
      const wv = Math.sin(t * 6 + i) * 4;
      ctx.quadraticCurveTo(-22, -88 + wv + i * 4, -34 - (o.run ? 6 : 0), -82 + wv * 1.5 + i * 6);
      ctx.stroke();
    }
  }

  // 다리
  const swing = o.run ? Math.sin(t * 14) * 8 : 0;
  ctx.strokeStyle = pants;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  if (!look.ghost) {
    ctx.beginPath(); ctx.moveTo(-4, -36); ctx.lineTo(-13 - swing, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -36); ctx.lineTo(13 + swing, -3); ctx.stroke();
    ctx.strokeStyle = '#e7e0d0'; // 각반
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-11 - swing * 0.8, -12); ctx.lineTo(-13 - swing, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11 + swing * 0.8, -12); ctx.lineTo(13 + swing, -4); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-12 - swing, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15 + swing, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 뒷팔 (넓은 소매)
  ctx.fillStyle = shade(robe, -0.2);
  ctx.beginPath();
  ctx.moveTo(-8, -70);
  if (jiang) { ctx.lineTo(26, -66); ctx.lineTo(28, -56); ctx.lineTo(-6, -58); } else { ctx.lineTo(-20, -48); ctx.lineTo(-12, -44); ctx.lineTo(-2, -62); }
  ctx.fill();

  // 도포 아랫자락
  const flap = Math.sin(t * 5) * 2 + (o.run ? 4 : 0);
  const robeNow = o.flash > 0 ? mix(robe, '#ffffff', 0.45 * o.flash) : robe;
  ctx.fillStyle = robeNow;
  ctx.beginPath();
  ctx.moveTo(-12, -46);
  ctx.lineTo(12, -46);
  ctx.lineTo(19, look.ghost ? -6 : -14);
  ctx.quadraticCurveTo(0, look.ghost ? 0 : -10, -20 - flap, look.ghost ? -2 : -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(19, -14); ctx.quadraticCurveTo(0, -10, -20 - flap, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, -46); ctx.lineTo(5, -12); ctx.stroke();

  // 상체
  ctx.fillStyle = robeNow;
  roundRect(ctx, -12, -74, 24, 30, 7);
  ctx.fill();
  // 교령(엇갈린 깃)
  ctx.strokeStyle = trim;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-7, -73); ctx.lineTo(5, -56); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -73); ctx.lineTo(0, -64); ctx.stroke();
  // 허리띠
  ctx.fillStyle = sash;
  ctx.fillRect(-13, -50, 26, 6);
  ctx.strokeStyle = sash;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-9, -46); ctx.quadraticCurveTo(-14 - flap, -36, -12 - flap, -26); ctx.stroke();

  // 머리
  ctx.fillStyle = skin;
  ctx.fillRect(-3, -80, 7, 6);
  circle(ctx, 1, -88, 11);
  drawHead(ctx, look, t);
  // 얼굴
  if (look.head !== 'mask' && !jiang) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, -93); ctx.lineTo(10, -91); ctx.stroke(); // 눈썹
    ctx.fillStyle = look.eyes || '#111';
    ctx.fillRect(6, -89, 4, 2);
  } else if (look.head === 'mask') {
    ctx.fillStyle = look.eyes || '#f8fafc';
    ctx.fillRect(6, -90, 4, 2);
  }
  if (look.beard) {
    ctx.fillStyle = look.hair === '#e5e7eb' || look.hair === '#f1f5f9' ? '#e5e7eb' : '#1c1917';
    ctx.beginPath(); ctx.moveTo(2, -82); ctx.lineTo(12, -82); ctx.lineTo(6, -68); ctx.fill();
  }

  // 앞팔 + 무기
  ctx.save();
  ctx.translate(7, -70);
  let ang;
  if (jiang) ang = -1.5;
  else if (weapon === 'spear') ang = -1.45 + lunge * 0.15;
  else ang = -0.2 - (lunge > 0 ? 1 - lunge : 0) * 0.9 + lunge * 1.1 - 0.4;
  ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = shade(robeNow, -0.05);
  ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(7, -2); ctx.lineTo(9, 18); ctx.lineTo(-7, 18); ctx.fill(); // 소매
  ctx.fillStyle = skin;
  circle(ctx, 1, 22, 4.5);
  ctx.translate(1, 22);
  drawWeapon(ctx, weapon, o, t, lunge);
  ctx.restore();

  drawOrbit(true);
  ctx.restore();
}

function drawHead(ctx, look, t) {
  const hair = look.hair || '#111111';
  const head = look.head || 'topknot';
  switch (head) {
    case 'hat': // 삿갓
      ctx.fillStyle = '#c8a96b';
      ctx.beginPath(); ctx.moveTo(-24, -92); ctx.lineTo(1, -110); ctx.lineTo(26, -92); ctx.quadraticCurveTo(1, -88, -24, -92); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(1, -109); ctx.lineTo(1 + i * 10, -92); ctx.stroke(); }
      break;
    case 'hood':
      ctx.fillStyle = shade(look.robe || '#555', -0.25);
      ctx.beginPath(); ctx.arc(0, -89, 13, Math.PI * 0.55, Math.PI * 2.15); ctx.lineTo(-6, -76); ctx.fill();
      break;
    case 'mask':
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.moveTo(-10, -87); ctx.lineTo(12, -87); ctx.lineTo(12, -80); ctx.quadraticCurveTo(1, -74, -10, -82); ctx.fill();
      break;
    case 'bald':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 3; i++) circle(ctx, -3 + i * 4, -96, 1);
      break;
    case 'jiangshi':
      ctx.fillStyle = '#111';
      ctx.fillRect(-11, -101, 24, 7);
      ctx.beginPath(); ctx.arc(1, -101, 8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b91c1c'; circle(ctx, 1, -110, 2.5);
      ctx.fillStyle = '#facc15'; // 부적
      ctx.fillRect(3, -94, 9, 18);
      ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(5, -91); ctx.lineTo(10, -87); ctx.lineTo(5, -83); ctx.lineTo(10, -79); ctx.stroke();
      break;
    case 'band':
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
      ctx.fillStyle = look.band || '#7f1d1d';
      ctx.fillRect(-10, -94, 22, 4);
      break;
    case 'topknot':
    default:
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI * 0.85, Math.PI * 2.05); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-2, -103, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.band || '#7f1d1d';
      ctx.fillRect(-6, -100, 8, 2.5);
      // 뒷머리
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.moveTo(-9, -92); ctx.quadraticCurveTo(-16 - Math.sin(t * 5) * 2, -82, -12, -74); ctx.lineTo(-7, -84); ctx.fill();
      break;
  }
}

function drawWeapon(ctx, weapon, o, t, lunge) {
  const blade = o.blade || '#e5e7eb';
  switch (weapon) {
    case 'saber': // 도
      ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -2, 4, 12);
      ctx.fillStyle = '#a16207'; ctx.fillRect(-6, -4, 12, 3);
      ctx.fillStyle = blade;
      ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-5, -38); ctx.quadraticCurveTo(4, -50, 7, -42); ctx.lineTo(4, -4); ctx.fill();
      break;
    case 'spear':
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, -64); ctx.stroke();
      ctx.fillStyle = blade; ctx.beginPath(); ctx.moveTo(-4, -64); ctx.lineTo(0, -82); ctx.lineTo(4, -64); ctx.fill();
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-4, -62); ctx.quadraticCurveTo(-10 - Math.sin(t * 8) * 3, -56, -6, -50); ctx.lineTo(4, -60); ctx.fill();
      break;
    case 'axe':
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -38); ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.quadraticCurveTo(18, -44, 16, -24); ctx.lineTo(0, -28); ctx.fill();
      break;
    case 'fan':
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 22, -Math.PI * 0.85, -Math.PI * 0.15); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.85 + i * (Math.PI * 0.7 / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.stroke(); }
      ctx.fillStyle = '#111'; ctx.font = `10px ${BRUSH}`; ctx.textAlign = 'center'; ctx.fillText('風', 0, -10);
      break;
    case 'claw':
      ctx.strokeStyle = blade === '#e5e7eb' ? '#d1d5db' : blade; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.lineTo(i * 5, -12); ctx.stroke(); }
      break;
    case 'dagger':
      ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -2, 4, 8);
      ctx.fillStyle = blade; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(0, -20); ctx.lineTo(3, -2); ctx.fill();
      break;
    case 'fist':
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; circle(ctx, 0, 0, 6);
      if (lunge > 0.3) { ctx.strokeStyle = `rgba(255,255,255,${lunge * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -8, 10, -2.5, -0.6); ctx.stroke(); }
      break;
    case 'sword':
    default:
      ctx.save();
      ctx.rotate(Math.PI);
      drawJian(ctx, 0, -2, blade, o.glow, 1, t, o.rage);
      ctx.restore();
      break;
  }
}

// 직검(劍): 손잡이가 (x, y), 칼날이 +y 방향 (호출 측에서 회전)
function drawJian(ctx, x, y, blade, glow, s = 1, t = 0, rage = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -12, 4, 12); // 손잡이
  ctx.fillStyle = '#d4a64a'; ctx.fillRect(-6, -1, 12, 3); // 코등이
  // 검수(술)
  ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-4 + Math.sin(t * 8) * 3, -18, -2, -24); ctx.stroke();
  if (glow) { ctx.shadowColor = blade; ctx.shadowBlur = 14; }
  ctx.fillStyle = rage ? '#fca5a5' : blade;
  ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(-2, 46); ctx.lineTo(0, 52); ctx.lineTo(2, 46); ctx.lineTo(2.5, 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-0.5, 4, 1, 40);
  ctx.restore();
}

function leaf(ctx, x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.2, 0, 0, Math.PI * 2); ctx.fill();
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

function nameTag(ctx, text, x, y, big = false) {
  ctx.save();
  ctx.font = big ? `19px ${BRUSH}` : `800 11px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = big ? '#fde68a' : '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function iceBlock(ctx, x, y, hw, hh) {
  ctx.fillStyle = 'rgba(186,230,253,0.35)';
  ctx.strokeStyle = 'rgba(224,242,254,0.9)';
  ctx.lineWidth = 2;
  roundRect(ctx, x - hw, y - hh, hw * 2, hh, 8);
  ctx.fill();
  ctx.stroke();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); }

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
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

function mix(a, b, k) {
  const p = parseInt(a.slice(1), 16);
  const q = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((p >> sh) & 255) * (1 - k) + ((q >> sh) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
