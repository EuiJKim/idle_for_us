// 두목 함께 사냥 (v138 십이지왕 · v339 모든 두목 구역) — 문파원끼리, Realtime Database로.
//
// 같은 문파원이 같은 왕 구역에 서면 한 방이다(coop/{문파}/{구역}).
//   p/{uid}  누가 어디 서 있나 — 0.4초마다(움직였을 때만) 자리·바라보는 쪽·친 횟수, 들어올 때 한 번 생김새.
//            접속이 끊기면 서버가 지운다(onDisconnect).
//   b        그 방의 왕 하나 — {seq, hp, max, dead, killer}. 체력을 모두가 나눠 깎는다(거래).
//            쓰러지면 dead에 서버 시각을 적고, BOSS_RESPAWN초 뒤 누구든 먼저 온 사람이 다음 왕(seq+1)을 연다.
// 내 화면의 왕은 서버 왕의 그림자다: 친 만큼 모아(pend) 0.7초마다 올리고, 서버 체력으로 맞춘다.
// 내 화면에서 먼저 쓰러지지 않는다(체력 1에서 멈춤) — 쓰러뜨리는 건 서버가 정한다.
// 서버가 쓰러졌다고 하면 이번 왕(seq)을 조금이라도 친 사람은 저마다 처치 보상(경험치·은자·재료·장비)을 받고,
// 안 친 사람은 왕이 그냥 사라진다.
//
// 문파원인지는 서버 규칙(database.rules.json)이 gm/{문파}/{uid} 표로 본다. 표는 들어올 때 내가 적는다
// (Firestore 문파 문서는 RTDB 규칙이 못 읽는다). 문파 코드를 모르면 그 방을 못 찾는다.
// 서버가 없거나 막히면 혼자 사냥 그대로다(join 실패 → 이 구역은 혼자).
// 혼자/함께는 들어갈 때 고른다(s.kingParty, v145) — 고른 대로 쓰러졌다 돌아와도·방치 중에도 이어진다.
// 둘 다 자동 사냥이 그대로 돈다: 사냥은 늘 내 기기에서 돌고, 함께일 때는 왕 체력만 서버와 맞춘다.
import * as W from './wdata.js';
import * as D from './wdgn.js';
import { patternHpMult } from './wmaster.js';

const POS_SEC = 0.4;        // 자리 올리는 간격
const BEAT_SEC = 5;         // 가만히 있어도 이만큼마다 '살아 있음'
const COMMIT_SEC = 0.7;     // 친 피해 올리는 간격
const STALE_MS = 15000;     // 이보다 오래 소식 없는 문파원은 안 그린다
export const COOP_BONUS = 0.1;       // v343 함께 잡으면 문파원 한 명마다 +10%
export const COOP_BONUS_MAX = 5;     //       최대 다섯 명(+50%)
export const COOP_SHARE = 0.5;       //       못 친 문파원은 절반

export class Coop {
  // look(): 내 생김새 {look, opts} (battle.js heroLook) — 문파원 화면에 나를 그릴 때 쓴다
  constructor(game, net, { onEvent, look } = {}) {
    this.game = game;
    this.net = net;
    this.onEvent = onEvent || (() => {});
    this.lookFn = look || (() => null);
    this.key = null;
    this.on = false;
    this.joining = false;
    this.failed = null;
    this.others = [];
    this.b = null;
    this.pend = 0;
    this.urgent = false;
    this.mine = {};
    this.atkN = 0;
    this.skN = 0;       // v343 무공을 쓴 횟수 — 문파원 화면에 옅게 보여 준다
    this.skLast = '';
    this.offset = 0;
    this.posT = 0;
    this.beatT = 0;
    this.comT = 0;
    this.last = '';
    this.spawnedSeq = null;
    this.busy = false;
    this.creating = false;
    this.seen = new Set();
  }

  // 두목 시계를 멈춰 둘 때 — 방에 있거나 들어가는 중
  get hold() { return this.on || this.joining; }
  get count() { return this.others.length; }

  wantKey() {
    const g = this.game, n = this.net;
    if (!g.s.kingParty || !this.can() || g.inst || g.map.town || !g.map.bossRoom) return null;   // v339 모든 두목 구역
    return `${n.guild.id}/${g.map.id}`;
  }

  serverNow() { return Date.now() + this.offset; }

  // 함께 들어갈 수 있나 — 문파에 들어 있고 서버에 닿아 있을 때
  can() { const n = this.net; return !!(n.ready?.() && n.guild && n.uid); }

  // 들어가기 전에 그 왕 구역에 문파원이 몇 있나 (모르면 null)
  async peek(mapId) {
    if (!this.can()) return null;
    const rt = await this.net.rtdb();
    if (!rt) return null;
    const { m, db } = rt;
    const gid = this.net.guild.id, uid = this.net.uid;
    try {
      await m.set(m.ref(db, `gm/${gid}/${uid}`), true);
      const snap = await m.get(m.ref(db, `coop/${gid}/${mapId}/p`));
      const now = this.serverNow();
      return Object.entries(snap.val() || {}).filter(([k, p]) => k !== uid && p && !(typeof p.t === 'number' && now - p.t > STALE_MS)).length;
    } catch {
      return null;
    }
  }

  // ---------- 들어가기·나가기 ----------
  async join(key) {
    this.joining = true;
    const rt = await this.net.rtdb();
    if (!rt || this.wantKey() !== key) { this.joining = false; if (!rt) this.failed = key; return; }
    const { m, db } = rt;
    const [gid, map] = key.split('/');
    const uid = this.net.uid;
    try {
      await m.set(m.ref(db, `gm/${gid}/${uid}`), true);
      this.rt = rt;
      this.base = `coop/${gid}/${map}`;
      const me = m.ref(db, `${this.base}/p/${uid}`);
      await m.onDisconnect(me).remove();
      await m.set(me, this.presence(true));
      if (this.wantKey() !== key) { m.remove(me).catch(() => {}); this.joining = false; return; }
      this.key = key;
      this.subs = [
        m.onValue(m.ref(db, '.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; }),
        m.onValue(m.ref(db, `${this.base}/p`), (s) => this.gotPeers(s.val() || {})),
        m.onValue(m.ref(db, `${this.base}/b`), (s) => this.gotBoss(s.val())),
      ];
    } catch (err) {
      console.warn('[coop] join', err?.message || err);
      this.failed = key;
      this.joining = false;
      return;
    }
    this.on = true;
    this.joining = false;
    this.spawnedSeq = null;
    // 혼자 잡던 왕이 있었으면 거둔다 — 이제 서버의 왕을 따른다
    const g = this.game;
    for (const mob of g.mons) if (mob.isBoss && mob.alive && mob.coopSeq == null) { mob.alive = false; if (g.mon === mob) g.mon = null; }
    this.onEvent('join', {});
  }

  leave() {
    if (!this.key) return;
    const { m, db } = this.rt;
    for (const u of this.subs || []) u();
    this.subs = [];
    const me = m.ref(db, `${this.base}/p/${this.net.uid}`);
    m.remove(me).catch(() => {});
    m.onDisconnect(me).cancel().catch(() => {});
    if (this.pend > 0) this.commit();
    for (const mob of this.game.mons) if (mob.coopSeq != null) mob.coopSeq = null;
    this.key = null;
    this.on = false;
    this.others = [];
    this.b = null;
    this.seen.clear();
  }

  // 문파를 나가면 표에서도 지운다
  async forget(gid) {
    const rt = await this.net.rtdb();
    if (rt && gid && this.net.uid) rt.m.remove(rt.m.ref(rt.db, `gm/${gid}/${this.net.uid}`)).catch(() => {});
  }

  // ---------- 내 자리 ----------
  presence(full) {
    const g = this.game;
    const hpMax = g.stats().hp || 1;
    const o = {
      x: Math.round(g.heroX), y: Math.round(g.heroY), f: g.heroFacing < 0 ? -1 : 1, a: this.atkN,
      ...(this.skLast ? { sk: this.skLast } : {}),
      hp: Math.round(Math.max(0, Math.min(1, g.heroHp / hpMax)) * 100) / 100,
      t: this.rt?.m.serverTimestamp() ?? Date.now(),
    };
    if (full) {
      const L = this.lookFn();
      o.n = g.s.nickname || '무명';
      o.j = g.s.job || null;
      o.lv = g.s.level;
      o.mt = g.mountNow?.()?.id || null;
      o.lk = L ? JSON.stringify(L) : null;
    }
    return o;
  }
  noteAttack() { this.atkN = (this.atkN + 1) % 1000; }
  // v343 무공 — '번호|이름|직업|차수|반지름|x|y' 한 줄. 받는 쪽은 그 자리에 직업 인장·고리·이름만 옅게 그린다(연출표 전부를 다시 돌리지 않는다)
  noteSkill(ev) {
    if (!this.on || ev.echo || ev.motion === 'buff' && !ev.name) return;
    this.skN = (this.skN + 1) % 1000;
    const at = ev.at || { x: this.game.heroX, y: this.game.heroY };
    this.skLast = [this.skN, String(ev.name || '').slice(0, 12), ev.job || '', ev.tier || 1, Math.round(ev.radius || 0), Math.round(at.x), Math.round(at.y)].join('|');
    this.posT = 0;   // 다음 틱에 바로 올린다
  }

  // ---------- 매 틱 ----------
  tick(dt) {
    const want = this.wantKey();
    if (want !== this.key && !this.joining) {
      if (this.key) this.leave();
      if (want && this.failed !== want) this.join(want);
    }
    if (!want) this.failed = null;
    // 문파원 모습은 받은 자리로 미끄러지게
    for (const o of this.others) {
      const k = Math.min(1, dt * 8);
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
      o.moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 3;
      if (o.lunge > 0) o.lunge = Math.max(0, o.lunge - dt * 4);
    }
    if (!this.on) return;
    const { m, db } = this.rt;
    this.posT -= dt; this.beatT -= dt; this.comT -= dt;
    if (this.posT <= 0) {
      this.posT = POS_SEC;
      const p = this.presence(false);
      const sig = `${p.x},${p.y},${p.f},${p.a},${p.hp},${p.sk || ''}`;
      if (sig !== this.last || this.beatT <= 0) {
        this.last = sig;
        this.beatT = BEAT_SEC;
        m.update(m.ref(db, `${this.base}/p/${this.net.uid}`), p).catch(() => {});
      }
    }
    if (this.pend > 0 && (this.comT <= 0 || this.urgent)) { this.comT = COMMIT_SEC; this.commit(); }
  }

  // ---------- 문파원 ----------
  gotPeers(all) {
    const now = this.serverNow();
    const prev = new Map(this.others.map((o) => [o.uid, o]));
    const next = [];
    for (const [uid, p] of Object.entries(all)) {
      if (uid === this.net.uid || !p || typeof p.x !== 'number') continue;
      if (typeof p.t === 'number' && now - p.t > STALE_MS) continue;
      const o = prev.get(uid) || { uid, x: p.x, y: p.y, lunge: 0, a: p.a, sk: p.sk ?? null };   // 들어올 때 남아 있던 무공은 다시 안 보인다
      o.tx = p.x; o.ty = p.y; o.f = p.f; o.hp = p.hp;
      if (p.n) o.n = p.n;
      if (p.lv) o.lv = p.lv;
      if (p.j !== undefined) o.j = p.j;
      if (p.mt !== undefined) o.mt = p.mt;
      if (p.lk && p.lk !== o.lkRaw) { o.lkRaw = p.lk; try { o.lk = JSON.parse(p.lk); } catch { o.lk = null; } }
      if (p.a !== o.a) { o.a = p.a; o.lunge = 1; }
      // v343 문파원이 무공을 썼다
      if (typeof p.sk === 'string' && p.sk !== o.sk) {
        o.sk = p.sk;
        const [, name, job, tier, r, x, y] = p.sk.split('|');
        if (name) this.onEvent('allySkill', { name, job, tier: +tier || 1, radius: +r || 0, at: { x: +x, y: +y }, from: { x: o.tx, y: o.ty }, who: o.n || '문파원' });
      }
      next.push(o);
      if (!this.seen.has(uid)) { this.seen.add(uid); this.onEvent('peerIn', { name: o.n || '문파원' }); }
    }
    for (const uid of [...this.seen]) {
      if (!next.some((o) => o.uid === uid)) { this.seen.delete(uid); this.onEvent('peerOut', { name: prev.get(uid)?.n || '문파원' }); }
    }
    this.others = next;
  }

  // ---------- 왕 ----------
  localBoss() { return this.game.mons.find((x) => x.alive && x.coopSeq != null) || null; }

  gotBoss(b) {
    this.b = b;
    this.bAt = Date.now();   // v415 서버 소식을 마지막으로 받은 때
    if (!b) return;
    const mob = this.localBoss();
    if (!mob) return;
    if (mob.coopSeq !== b.seq) { mob.alive = false; if (this.game.mon === mob) this.game.mon = null; return; }
    if (b.hp > 0) {
      const before = mob.hp;
      mob.hp = Math.max(1, Math.min(mob.hp, b.hp - this.pend));
      // 문파원이 깎은 만큼은 흐린 숫자로
      if (before - mob.hp >= mob.maxHp * 0.002) this.game.emit('dmg', { amount: before - mob.hp, kind: 'ally', crit: 0, at: mob, add: true });
    } else this.bossDown(mob, b);
  }

  bossDown(mob, b) {
    const g = this.game;
    const mine = this.mine[b.seq] || 0;
    delete this.mine[b.seq];
    this.pend = 0;
    mob.coopSeq = null;
    const n = this.others.length + 1;
    // v343 함께 잡은 보상 — 한 대라도 쳤으면 처치 보상 전부에 문파원 한 명마다 +10%(최대 +50%) ·
    //   같은 방에 있었는데 못 쳤으면(멀리 있었거나 막 들어왔거나) 경험치·은자·현철 절반(장비·탈것·조각은 없음)
    const bonus = 1 + COOP_BONUS * Math.min(COOP_BONUS_MAX, n - 1);
    const ev = { mine, share: mine / (b.max || 1), killer: b.kn || '문파원', me: b.killer === this.net.uid, name: mob.name, n, bonus };
    if (mine > 0) { g.coopK = bonus; try { g.killMob(mob); } finally { g.coopK = null; } if (this.others.length) g.mark('coop'); }
    else if (n > 1) g.coopShare(mob, COOP_SHARE);
    else { mob.alive = false; mob.hp = 0; if (g.mon === mob) g.mon = null; }
    g.bossT = W.BOSS_RESPAWN;
    this.onEvent(mine > 0 ? 'kill' : n > 1 ? 'shared' : 'missed', ev);
  }

  // 내가 친 만큼 모은다 (wgame.hurt가 부른다)
  dealt(mob, amt) {
    if (!(amt > 0)) return;
    this.pend += amt;
    this.mine[mob.coopSeq] = (this.mine[mob.coopSeq] || 0) + amt;
    if (mob.hp - amt <= 1) this.urgent = true;
  }
  // v415 서버에 아직 남은 체력(보내는 중인 몫은 빼고) — 내 화면 체력이 1에 멈춰도 친 만큼은 서버로 보낸다
  serverLeft(mob) { return Math.max(0, (this.b?.seq === mob.coopSeq && this.b.hp > 0 ? this.b.hp : mob.hp) - this.pend); }
  // v415 서버 소식이 15초 넘게 끊겼다 — 함께 잡기를 놓고 내 화면에서 마저 잡는다(체력 0인데 안 죽던 것)
  //   v420 전송이 여섯 번 넘게 물러나거나(거부·다른 번호) 전송은 되는데 서버 체력이 15초 넘게 안 줄어도 같다
  stale() { return (!!this.bAt && Date.now() - this.bAt > 15000) || (this.miss || 0) >= 6 || (!!this.okAt && !!this.bAt && this.okAt - this.bAt > 15000); }
  // v420 내 화면에서 혼자 잡기로 넘어간 왕 — 같은 번호를 다시 세우지 않는다(보상을 두 번 받지 않게)
  gaveUp(seq) { this.deadLocal = seq; this.pend = 0; this.onEvent('coopSolo', { seq }); }

  async commit() {
    if (this.busy || !this.rt || !this.base) return;
    const mob = this.localBoss();
    const seq = mob?.coopSeq;
    const amt = this.pend;
    if (seq == null || !(amt > 0)) { this.pend = 0; return; }
    this.busy = true;
    this.pend = 0;
    this.urgent = false;
    const { m, db } = this.rt;
    const uid = this.net.uid, nick = this.game.s.nickname || '무명';
    try {
      const res = await m.runTransaction(m.ref(db, `${this.base}/b`), (b) => {
        if (!b || b.seq !== seq || !(b.hp > 0)) return undefined;
        b.hp = Math.max(0, b.hp - amt);
        if (b.hp <= 0) { b.dead = m.serverTimestamp(); b.killer = uid; b.kn = nick; }
        return b;
      }, { applyLocally: false });
      // v420 조용히 물러난 거래(committed=false: 서버의 왕이 다른 번호거나 이미 쓰러짐·아직 못 읽음)도 몫을 버리지 않는다
      if (res && res.committed === false) { this.pend += amt; this.miss = (this.miss || 0) + 1; }
      else { this.okAt = Date.now(); this.miss = 0; }
    } catch (err) {
      console.warn('[coop] commit', err?.message || err);
      this.pend += amt;   // v415 못 보낸 몫은 버리지 않고 다음에 다시
      this.miss = (this.miss || 0) + 1;
    }
    this.busy = false;
  }

  // 왕이 없을 때 (wgame.tick이 부른다): 서버에 살아 있는 왕이 있으면 내 화면에 세우고,
  // 쓰러진 지 BOSS_RESPAWN초가 지났으면(또는 처음이면) 다음 왕을 연다.
  bossTick() {
    if (!this.on) return;
    const g = this.game, b = this.b;
    if (b && b.hp > 0) {
      if (this.spawnedSeq === b.seq && this.localBoss()) return;
      if (this.deadLocal === b.seq) { g.bossT = W.BOSS_RESPAWN; return; }   // v420 혼자 잡기로 끝낸 왕은 다시 안 세운다
      const mob = g.spawnMob(true);
      if (!mob) return;
      mob.coopSeq = b.seq;
      mob.maxHp = b.max;
      mob.hp = Math.max(1, b.hp);
      this.spawnedSeq = b.seq;
      return;
    }
    const wait = b?.dead ? W.BOSS_RESPAWN * 1000 - (this.serverNow() - b.dead) : 0;
    g.bossT = Math.max(0, wait / 1000);
    if (wait <= 0 && !this.creating) this.open();
  }

  kingMaxHp() {
    const lv = this.game.map.lv[1] + 2;
    return D.fieldMobHp(lv) * W.BOSS.hp * patternHpMult(this.game.map) * (this.game.map.lord ? W.LORD_HP : 1);     // spawnMob과 같은 셈 (v149 사냥터 몹 공식 · v170 초식 두목 ×4 · v339 맹주)
  }

  async open() {
    this.creating = true;
    const { m, db } = this.rt;
    const max = this.kingMaxHp();
    const respawn = W.BOSS_RESPAWN * 1000;
    try {
      await m.runTransaction(m.ref(db, `${this.base}/b`), (cur) => {
        if (cur && cur.hp > 0) return undefined;
        if (cur && cur.dead && this.serverNow() - cur.dead < respawn - 2000) return undefined;
        return { seq: (cur?.seq || 0) + 1, hp: max, max, dead: 0 };
      });
    } catch (err) {
      console.warn('[coop] open', err?.message || err);
    }
    this.creating = false;
  }
}
