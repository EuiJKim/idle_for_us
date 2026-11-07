// v374 월드보스 함께 — 같은 마왕 판에 든 무인끼리 서로 보인다(Realtime Database wbr/{마왕}_{seq}/{uid} · v375 날짜 대신 마왕).
//
// 문파와 상관없이 무림 누구나. 문파 함께 사냥(wcoop.js)의 자리 올리기·받기·그리기를 그대로 쓰고,
//   두목 체력은 RTDB가 아니라 Firestore wraid/{날짜} 문서(무림 전체 공동 체력)가 맡는다 — 여기서는 자리만.
// 자리: 0.4초마다(움직였을 때만) · 접속이 끊기면 서버가 지운다(onDisconnect).
import { Coop } from './wcoop.js';
// v432 문파 표지 — 문파 id는 곧 가입 코드라 누구나 읽는 대기실(wbl)에 그대로 올리면 남이 그 문파에 들어올 수 있었다.
//   되돌릴 수 없는 짧은 표지(FNV 두 갈래)만 올리고 같은 표지끼리 비교한다
export function guildTag(id) {
  if (!id) return '';
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  const s = `ifu:${id}`;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x5bd1e995) >>> 0; b ^= b >>> 13; }
  return `h${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export class WbCoop extends Coop {
  can() { const n = this.net; return !!(n.ready?.() && n.uid); }
  wantKey() {
    const g = this.game;
    if (g.inst?.kind !== 'wraid' || g.inst.done || !this.can()) return null;
    return `wb/${g.inst.key}`;
  }
  async join(key) {
    this.joining = true;
    const rt = await this.net.rtdb();
    if (!rt || this.wantKey() !== key) { this.joining = false; if (!rt) this.failed = key; return; }
    const { m, db } = rt;
    const day = key.slice(3);
    const uid = this.net.uid;
    try {
      this.rt = rt;
      this.base = `wbr/${day}`;
      const me = m.ref(db, `${this.base}/${uid}`);
      await m.onDisconnect(me).remove();
      await m.set(me, this.presence(true));
      // v386 대기실 — 어느 마왕에 누가 있나(가볍게 이름·문파만). 빠른 합류·문파원 알림에 쓴다
      const lb = m.ref(db, `wbl/${day.split('_')[0]}/${uid}`);
      await m.onDisconnect(lb).remove();
      await m.set(lb, { n: (this.game.s.nickname || '무명').slice(0, 24), g: guildTag(this.net.guild?.id), t: m.serverTimestamp() });
      this.lobbyRef = lb;
      if (this.wantKey() !== key) { m.remove(me).catch(() => {}); this.joining = false; return; }
      this.key = key;
      this.subs = [
        m.onValue(m.ref(db, '.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; }),
        m.onValue(m.ref(db, this.base), (s) => this.gotPeers(s.val() || {})),
      ];
    } catch (err) {
      console.warn('[wbcoop] join', err?.message || err);
      this.failed = key;
      this.joining = false;
      return;
    }
    this.on = true;
    this.joining = false;
    this.onEvent('join', {});
  }
  leave() {
    if (!this.key) return;
    const { m, db } = this.rt;
    for (const u of this.subs || []) u();
    this.subs = [];
    const me = m.ref(db, `${this.base}/${this.net.uid}`);
    m.remove(me).catch(() => {});
    if (this.lobbyRef) { m.remove(this.lobbyRef).catch(() => {}); m.onDisconnect(this.lobbyRef).cancel().catch(() => {}); this.lobbyRef = null; }
    m.onDisconnect(me).cancel().catch(() => {});
    this.key = null;
    this.on = false;
    this.others = [];
    this.seen.clear();
  }
  // 자리 올리기 길(부모는 base/p/uid)
  tick(dt) {
    const want = this.wantKey();
    if (want !== this.key && !this.joining) {
      if (this.key) this.leave();
      if (want && this.failed !== want) this.join(want);
    }
    if (!want) this.failed = null;
    if (!this.lobbyOn && this.game.s.job && (this._lbT = (this._lbT || 0) - dt) <= 0) { this._lbT = 10; if (this.can()) this.watchLobby(); }   // v386 대기실
    for (const o of this.others) {
      const k = Math.min(1, dt * 8);
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
      o.moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 3;
      if (o.lunge > 0) o.lunge = Math.max(0, o.lunge - dt * 4);
    }
    if (!this.on || !this.rt) return;
    const { m, db } = this.rt;
    this.posT -= dt; this.beatT -= dt;
    if (this.posT <= 0) {
      this.posT = 0.3;
      const p = this.presence(false);
      const sig = `${p.x},${p.y},${p.f},${p.a},${p.hp},${p.sk || ''}`;
      if (sig !== this.last || this.beatT <= 0) { this.last = sig; this.beatT = 5; m.update(m.ref(db, `${this.base}/${this.net.uid}`), p).catch(() => {}); }
    }
  }
  // v386 대기실 보기 — 온라인이면 한 번 붙어서 계속 받는다. { 마왕: { uid: {n, g, t} } }
  async watchLobby() {
    if (this.lobbyOn || !this.can()) return;
    this.lobbyOn = true;
    const rt = await this.net.rtdb();
    if (!rt) { this.lobbyOn = false; return; }
    const { m, db } = rt;
    this.lobby = {};
    const first = { v: true };
    this.lobbyOff = m.onValue(m.ref(db, 'wbl'), (snap) => {
      const v = snap.val() || {};
      const gid = guildTag(this.net.guild?.id);
      if (gid && !first.v) for (const [boss, us] of Object.entries(v)) for (const [u, o] of Object.entries(us || {})) {
        if (u !== this.net.uid && o?.g === gid && !this.lobby[boss]?.[u]) this.onEvent('guildWb', { name: o.n || '문파원', boss });
      }
      first.v = false;
      this.lobby = v;
      this.onEvent('lobby', {});
    }, () => { this.lobbyOn = false; });
  }
  // 마왕마다 지금 있는 사람 수(오래된 것은 빼고 · 나 빼고)
  lobbyCount(boss, now = Date.now()) {
    const us = this.lobby?.[boss] || {};
    return Object.entries(us).filter(([u, o]) => u !== this.net.uid && (!o?.t || now - o.t < 6 * 60e3)).length;
  }
  lobbyGuild(boss) { const gid = guildTag(this.net.guild?.id); return gid ? Object.entries(this.lobby?.[boss] || {}).filter(([u, o]) => u !== this.net.uid && o?.g === gid).map(([, o]) => o.n) : []; }
  gotBoss() {}
  bossTick() {}
  async commit() { this.pend = 0; }
}
