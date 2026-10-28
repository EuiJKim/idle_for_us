// 바람식 개편 — 서버. 로그인·프로필·서열·문파(만들기·가입·채팅·출석)는 옛 Net을 그대로 쓰고,
// 프로필 모양 · 서열 · 문파 기부(은자) · 문파 창고(재료 나눔)만 새로.
//
// 옛 판 프로필도 같은 players 모음에 남아 있다(전투력 10^100 같은 것). 거기에 섞이면 새 판 사람은
// 서열에 안 보인다 — **world: 1** 표시가 있는 것만 모아 레벨 순으로 늘어놓는다.
// 색인을 새로 만들지 않으려고 서버 정렬 없이 넉넉히 읽어서 여기서 거른다(친구끼리라 몇십 명이다).
//
// 문파 창고는 문파 문서의 bank 칸(재료 열쇠: 개수)이다. 옛 창고(stash 모음)는 규칙이 장비·장신구만
// 받아서 재료를 못 넣는다 — 문파원은 문파 문서를 자유롭게 고칠 수 있으니 거기에 둔다(규칙을 안 바꿔도 된다).
import { Net, dayKey } from './net.js';
import * as W from './world/wdata.js';

export class WNet extends Net {
  profileData() {
    const g = this.game;
    const s = g.s;
    const st = g.stats();
    return {
      world: 1,
      nickname: s.nickname || '이름없음',
      level: s.level,
      job: s.job || null,
      jobTier: s.jobTier,
      tierName: g.tierName(),
      map: s.huntMap,
      mapName: W.mapOf(s.huntMap).name,
      power: st.power,
      atk: Math.round(st.atk), hp: Math.round(st.hp),
      weaponGrade: g.bestGrade('weapon'),
      titles: s.titles || [],
      guildId: s.guildId || null, guildName: this.guild?.name || null,
      updatedAt: this.fs.serverTimestamp(),
    };
  }

  async ranking() {
    const { collection, query, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'players'), limit(300)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => p.world === 1);
  }

  ready() { return this.online && !this.blocked; }

  // 문파원 프로필 (레벨·전직·사냥터)
  async members() {
    if (!this.guild) return [];
    const rows = await Promise.all(this.guild.memberIds.map((id) => this.player(id).catch(() => null)));
    return rows.filter(Boolean);
  }

  // ---------- 기부: 은자 → 문파 경험치 (하루 세 번) ----------
  donatesLeft() {
    const s = this.game.s;
    return s.donateDay === dayKey() ? Math.max(0, W.GUILD_DONATE_PER_DAY - (s.donateN || 0)) : W.GUILD_DONATE_PER_DAY;
  }
  donateCost() { return W.guildDonateCost(this.game.s.level); }
  async donate() {
    const s = this.game.s;
    const cost = this.donateCost();
    if (!this.guild || this.donatesLeft() <= 0 || s.gold < cost) return false;
    s.gold -= cost;
    try {
      await this.fs.updateDoc(this.ref('guilds', this.guild.id), { exp: this.fs.increment(W.GUILD_DONATE_EXP) });
    } catch (err) {
      s.gold += cost;
      throw err;
    }
    if (s.donateDay !== dayKey()) { s.donateDay = dayKey(); s.donateN = 0; }
    s.donateN = (s.donateN || 0) + 1;
    return true;
  }

  // ---------- 문파 창고: 재료 나눔 ----------
  bank() { return this.guild?.bank || {}; }
  async putMats(key, n) {
    const s = this.game.s;
    n = Math.min(n, s.mats[key] || 0);
    if (!this.guild || !this.online || n <= 0) return 0;
    s.mats[key] -= n;
    try {
      await this.fs.updateDoc(this.ref('guilds', this.guild.id), { [`bank.${key}`]: this.fs.increment(n) });
    } catch (err) {
      s.mats[key] += n;   // 실패하면 되돌린다
      throw err;
    }
    return n;
  }
  // 꺼낸다 — 둘이 동시에 눌러도 있는 만큼만 나뉘게 거래로
  async takeMats(key, n) {
    if (!this.guild || !this.online || n <= 0) return 0;
    const ref = this.ref('guilds', this.guild.id);
    const got = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const have = snap.data()?.bank?.[key] || 0;
      const take = Math.min(have, n);
      if (take > 0) tx.update(ref, { [`bank.${key}`]: have - take });
      return take;
    });
    if (got > 0) this.game.addMats(key, got);
    return got;
  }

  // 문파 채팅에 알림 한 줄 (전직·상급 조합 같은 자랑거리)
  announce(text) {
    if (this.guild && this.online) this.sendChat(text, 'system').catch(() => {});
  }
}
