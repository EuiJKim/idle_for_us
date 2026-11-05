// v374 월드보스 함께 — 같은 마왕 판에 든 무인끼리 서로 보인다(Realtime Database wbr/{마왕}_{seq}/{uid} · v375 날짜 대신 마왕).
//
// 문파와 상관없이 무림 누구나. 문파 함께 사냥(wcoop.js)의 자리 올리기·받기·그리기를 그대로 쓰고,
//   두목 체력은 RTDB가 아니라 Firestore wraid/{날짜} 문서(무림 전체 공동 체력)가 맡는다 — 여기서는 자리만.
// 자리: 0.4초마다(움직였을 때만) · 접속이 끊기면 서버가 지운다(onDisconnect).
import { Coop } from './wcoop.js';

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
  gotBoss() {}
  bossTick() {}
  async commit() { this.pend = 0; }
}
