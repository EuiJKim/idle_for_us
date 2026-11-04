// v344 문파원은 지금 어디에 — Realtime Database where/{문파}/{uid} = { m: 구역 번호(던전 안이면 -1), n: 이름, t: 서버 시각 }.
//   구역을 옮길 때와 1분마다 올리고, 앱을 끄면(접속이 끊기면) 서버가 지운다(onDisconnect).
//   문파원만 읽는다(gm/{문파}/{uid} 표 — 함께 사냥과 같은 표). 지도 칸·문파원 목록이 이걸 읽어 '누가 어디에'를 띄운다.
import * as W from './wdata.js';

const BEAT_SEC = 60;
const STALE_MS = 3 * 60 * 1000;   // 3분 넘게 소식이 없으면 안 보인다(끊김을 서버가 아직 못 알아챈 때)

export class Where {
  constructor(game, net, onChange) {
    this.game = game;
    this.net = net;
    this.onChange = onChange || (() => {});
    this.gid = null;
    this.all = {};
    this.lastM = null;
    this.beat = 0;
    this.busy = false;
    this.offset = 0;
  }
  // 지금 있는 곳 — 던전·탑 안이면 -1
  here() { const g = this.game; return g.inst ? -1 : (g.map?.id ?? g.s.map ?? 0); }

  async start(gid) {
    if (this.busy) return;
    this.busy = true;
    try {
      const rt = await this.net.rtdb();
      if (!rt || this.net.guild?.id !== gid) return;
      const { m, db } = rt;
      const uid = this.net.uid;
      await m.set(m.ref(db, `gm/${gid}/${uid}`), true);
      this.rt = rt;
      this.gid = gid;
      this.me = m.ref(db, `where/${gid}/${uid}`);
      await m.onDisconnect(this.me).remove();
      this.subs = [
        m.onValue(m.ref(db, '.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; }),
        m.onValue(m.ref(db, `where/${gid}`), (s) => { this.all = s.val() || {}; this.onChange(); }),
      ];
      this.lastM = null;
      this.push();
    } catch (err) {
      console.warn('[where] start', err?.message || err);
      this.gid = null;
    } finally { this.busy = false; }
  }
  stop() {
    if (!this.gid) return;
    for (const u of this.subs || []) u();
    this.subs = [];
    const { m } = this.rt;
    m.remove(this.me).catch(() => {});
    m.onDisconnect(this.me).cancel().catch(() => {});
    this.gid = null;
    this.all = {};
    this.onChange();
  }
  push() {
    if (!this.gid) return;
    const { m } = this.rt;
    this.lastM = this.here();
    this.beat = BEAT_SEC;
    m.set(this.me, { m: this.lastM, n: String(this.game.s.nickname || '무명').slice(0, 24), t: m.serverTimestamp() }).catch(() => {});
  }
  tick(dt) {
    const want = this.net.ready?.() && this.net.guild?.id ? this.net.guild.id : null;
    if (want !== this.gid && !this.busy) { if (this.gid) this.stop(); if (want) this.start(want); return; }
    if (!this.gid) return;
    this.beat -= dt;
    if (this.here() !== this.lastM || this.beat <= 0) this.push();
  }
  // 나를 뺀 지금 접속한 문파원 [{uid, n, m}]
  list() {
    const now = Date.now() + this.offset;
    const uid = this.net.uid;
    return Object.entries(this.all).filter(([k, v]) => k !== uid && v && typeof v.m === 'number' && !(typeof v.t === 'number' && now - v.t > STALE_MS))
      .map(([k, v]) => ({ uid: k, n: v.n || '문파원', m: v.m }));
  }
  at(mapId) { return this.list().filter((o) => o.m === mapId); }
  inZone(zoneId) { return this.list().filter((o) => o.m > 0 && W.hasMap(o.m) && W.mapOf(o.m).zone === zoneId); }
  of(uid) { const v = this.all[uid]; if (!v) return null; const now = Date.now() + this.offset; return typeof v.t === 'number' && now - v.t > STALE_MS ? null : v; }
  placeName(m) { return m === -1 ? '던전 안' : m === 0 || (W.hasMap(m) && W.mapOf(m).town) ? '마을' : W.hasMap(m) ? W.mapOf(m).name : '?'; }
}
