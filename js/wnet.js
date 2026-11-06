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
import * as D from './world/wdgn.js';

// v254 서버 답을 기다리되 끝없이는 아니게 — 끊겨 있으면 바로, 8초 넘게 답이 없으면 실패로 본다
const ack = (p, ms = 8000) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new Error('인터넷이 끊겨 있어요 — 연결되면 다시 해 주세요'));
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('연결이 불안정해요 — 잠시 뒤 다시 해 주세요')), ms))]);
};

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
      title: s.title || null,   // v305 끼고 있는 칭호 — 서열에 보인다
      raidDps: Math.round(g.raidDpsEst()),
      // v268 문파 코드는 올리지 않는다 — 코드가 곧 들어가는 열쇠인데 서열은 누구나 읽는다(예전 값은 지운다)
      guildId: this.fs.deleteField(), guildName: this.guild?.name || null,
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
  // v254: 서버가 받았다고 답한 뒤에 은자를 뺀다(8초 넘게 답이 없으면 실패) — 전엔 먼저 빼고 기다려서,
  //   오프라인이면 쓰기가 메모리에만 남은 채 은자가 빠진 세이브가 저장되고 앱을 끄면 은자만 사라졌다(단추도 영영 잠김)
  async donate() {
    const s = this.game.s;
    const cost = this.donateCost();
    if (!this.guild || this.donatesLeft() <= 0 || s.gold < cost) return false;
    await ack(this.fs.updateDoc(this.ref('guilds', this.guild.id), { exp: this.fs.increment(W.GUILD_DONATE_EXP) }));
    s.gold = Math.max(0, s.gold - cost);
    if (s.donateDay !== dayKey()) { s.donateDay = dayKey(); s.donateN = 0; }
    s.donateN = (s.donateN || 0) + 1;
    this.game.mark('donate');
    return true;
  }

  // ---------- 문파 창고: 재료 나눔 ----------
  bank() { return this.guild?.bank || {}; }
  async putMats(key, n) {
    const s = this.game.s;
    n = Math.min(n, s.mats[key] || 0);
    if (!this.guild || !this.online || n <= 0) return 0;
    // v254: 서버가 받은 뒤에 뺀다(기부와 같은 까닭)
    await ack(this.fs.updateDoc(this.ref('guilds', this.guild.id), { [`bank.${key}`]: this.fs.increment(n) }));
    s.mats[key] = Math.max(0, (s.mats[key] || 0) - n);
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

  // ---------- 문파 토벌 (v128): 한 주에 두목 하나 ----------
  // 옛 판의 하루 토벌(raids/YYYY-MM-DD)과 같은 모음에 주 이름(wk-YYYY-MM-DD)으로 둔다 — 규칙을 안 바꿔도 된다.
  watchRaid(gid) {
    const key = D.weekKey();
    this.raidDay = key;
    const unsub = this.fs.onSnapshot(this.ref('guilds', gid, 'raids', key), (snap) => {
      this.raid = snap.exists() ? { id: key, ...snap.data() } : null;
      this.changed('raid');
    }, (err) => console.warn('[net] raid', err));
    this.unsubs.push(unsub);
  }
  refreshDay() {
    if (this.guild && this.raidDay !== D.weekKey()) this.watchGuild(this.guild.id);
  }
  // 이번 주 토벌을 연다(없으면 만든다) — 체력은 문파원들의 초당 피해 합으로
  async ensureWeekRaid() {
    if (!this.guild) throw new Error('문파에 먼저 들어가 주세요.');
    const key = D.weekKey();
    const ref = this.ref('guilds', this.guild.id, 'raids', key);
    const got = await this.fs.getDoc(ref);
    if (got.exists() && got.data().kind === 'world') return { id: key, ...got.data() };
    const rows = await Promise.all(this.guild.memberIds.map((id) => (id === this.uid ? null : this.player(id).catch(() => null))));
    const sum = rows.reduce((a, p) => a + (Number(p?.raidDps) || 0), 0) + this.game.raidDpsEst();
    const maxHp = D.raidMaxHp(sum);
    await this.fs.runTransaction(this.db, async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists() && cur.data().kind === 'world') return;
      tx.set(ref, { kind: 'world', maxHp, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null, createdAt: this.fs.serverTimestamp() });
    });
    const snap = await this.fs.getDoc(ref);
    return { id: key, ...snap.data() };
  }
  raidHpLeft() { const r = this.raid; return r && r.kind === 'world' ? Math.max(0, (r.maxHp || 0) - (r.total || 0)) : 0; }
  // 친 만큼 올린다. 이번 일격으로 쓰러졌으면 true
  async commitWeekRaid(key, amount) {
    if (!this.guild || !(amount > 0)) return false;
    const ref = this.ref('guilds', this.guild.id, 'raids', key);
    const killed = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const r = snap.data();
      if ((r.total || 0) >= r.maxHp) return false;
      const sum = Math.min(r.maxHp, (r.total || 0) + amount);
      const up = { total: sum, [`damage.${this.uid}`]: (r.damage?.[this.uid] || 0) + amount, [`names.${this.uid}`]: this.game.s.nickname || '무명' };
      if (sum >= r.maxHp) up.killedAt = this.fs.serverTimestamp();
      tx.update(ref, up);
      return sum >= r.maxHp;
    });
    if (killed) this.sendChat(`🐲 ${this.game.s.nickname}님의 마무리 일격! 이번 주 토벌 두목 ${D.raidBossOf(key).title} 처치 — 보상을 받아 가세요.`, 'system').catch(() => {});
    return killed;
  }
  canClaimWeek() {
    const r = this.raid;
    return !!(r && r.kind === 'world' && r.total >= r.maxHp && (r.damage?.[this.uid] || 0) > 0 && !r.claimed?.[this.uid]);
  }
  async claimWeek() {
    if (!this.canClaimWeek()) return null;
    const ref = this.ref('guilds', this.guild.id, 'raids', this.raid.id);
    const ok = await this.fs.runTransaction(this.db, async (tx) => {
      const r = (await tx.get(ref)).data();
      if (!r || r.total < r.maxHp || !(r.damage?.[this.uid] > 0) || r.claimed?.[this.uid]) return false;
      tx.update(ref, { [`claimed.${this.uid}`]: true });
      return true;
    });
    if (!ok) return null;
    const g = this.game;
    return g.grant(D.raidKillReward(g.s.level, W.mapOf(g.s.huntMap).mz || 1));
  }

  // ---------- v373 월드보스 · v375 칠대성(상시 최종 두목)과 옥황상제 ----------
  // wbp/{마왕} = {seq}: 지금 몇 번째 마왕인가 · wraid/{마왕}_{seq}: 그 마왕의 체력·피해·받음.
  // 쓰러지면 누구든 다음 마왕(seq+1)을 바로 세운다(규칙이 '앞 마왕이 쓰러졌을 때만'을 본다). 지난 마왕을 못 받았으면 wdone에 남긴다.
  watchWorld() {
    super.watchWorld();
    this.watchWraid();
  }
  watchWraid() {
    if (!this.online || this.wbpUnsub) return;
    this.wbp = {};
    this.wgen = {};
    this.wdone = this.wdone || {};
    this.wgenUnsub = {};
    const { onSnapshot, collection } = this.fs;
    this.wbpUnsub = onSnapshot(collection(this.db, 'wbp'), (snap) => {
      for (const d of snap.docs) {
        const boss = d.id, seq = d.data().seq;
        if (!D.WRAID_BOSS[boss] || !(seq >= 1)) continue;
        const was = this.wbp[boss];
        if (was === seq) continue;
        this.wbp[boss] = seq;
        this.watchGen(boss, seq);
        // 지난 마왕을 친 채로 못 받았으면 남겨 둔다(처음 볼 때도 한 번)
        this.checkGen(boss, seq - 1);
      }
      this.changed('wraid');
    }, (err) => console.warn('[net] wbp', err));
  }
  watchGen(boss, seq) {
    this.wgenUnsub[boss]?.();
    const id = D.wraidDocId(boss, seq);
    this.wgenUnsub[boss] = this.fs.onSnapshot(this.ref('wraid', id), (snap) => {
      const prev = this.wgen[boss];
      this.wgen[boss] = snap.exists() ? { id, boss, ...snap.data() } : null;
      // 내 판의 마왕이 쓰러진 것도 받을 것에 남긴다
      if (prev && prev.total < prev.maxHp && this.wgen[boss] && this.wgen[boss].total >= this.wgen[boss].maxHp) this.noteDone(this.wgen[boss]);
      this.changed('wraid');
    }, (err) => console.warn('[net] wraid', err));
  }
  async checkGen(boss, seq) {
    if (!(seq >= 1)) return;
    try {
      const snap = await this.fs.getDoc(this.ref('wraid', D.wraidDocId(boss, seq)));
      if (snap.exists()) this.noteDone({ id: snap.id, boss, ...snap.data() });
    } catch { /* 없으면 그만 */ }
  }
  noteDone(r) {
    if (this.canClaimWraid(r)) { this.wdone[r.id] = r; this.changed('wraid'); }
  }
  wraidOf(boss) { return this.wgen?.[boss] || null; }
  // 받을 수 있는 쓰러진 마왕들(지금 것 · 지난 것)
  wraidClaims() {
    const out = new Map();
    for (const r of Object.values(this.wdone || {})) if (this.canClaimWraid(r)) out.set(r.id, r);
    for (const r of Object.values(this.wgen || {})) if (r && this.canClaimWraid(r)) out.set(r.id, r);
    return [...out.values()];
  }
  // 마왕을 세운다(없으면 첫째, 쓰러져 있으면 다음) — 체력은 화무기 기본 체력 × 4(옥황상제 × 3 더)
  async ensureWraid(boss) {
    if (!this.ready()) throw new Error('온라인일 때 들어갈 수 있어요.');
    if (!D.WRAID_BOSS[boss]) throw new Error('없는 마왕이에요.');
    const pref = this.ref('wbp', boss);
    const p = await ack(this.fs.getDoc(pref));
    const seq = p.exists() ? p.data().seq : 0;
    if (seq) {
      const cur = await ack(this.fs.getDoc(this.ref('wraid', D.wraidDocId(boss, seq))));
      if (cur.exists() && cur.data().total < cur.data().maxHp) return { id: cur.id, boss, ...cur.data() };
    }
    const next = seq + 1;
    const maxHp = D.wraidMaxHp(this.game.hwamugiHp(), boss);
    const b = this.fs.writeBatch(this.db);
    if (seq) b.update(pref, { seq: next }); else b.set(pref, { seq: 1 });
    b.set(this.ref('wraid', D.wraidDocId(boss, next)), { boss, seq: next, maxHp, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null, killer: null, createdAt: this.fs.serverTimestamp() });
    try { await ack(b.commit()); } catch (err) { if (err?.code !== 'permission-denied') throw err; }   // 다른 사람이 먼저 세웠으면 그것을
    const p2 = await ack(this.fs.getDoc(pref));
    const s2 = p2.exists() ? p2.data().seq : next;
    const snap = await ack(this.fs.getDoc(this.ref('wraid', D.wraidDocId(boss, s2))));
    return snap.exists() ? { id: snap.id, boss, ...snap.data() } : null;
  }
  wraidHpLeft(r) { return r ? Math.max(0, (r.maxHp || 0) - (r.total || 0)) : 0; }
  // 피해 순위 [[uid, 피해], …]
  wraidRank(r) { return Object.entries(r?.damage || {}).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]); }
  wraidMyRank(r) { const i = this.wraidRank(r).findIndex(([u]) => u === this.uid); return i >= 0 ? i + 1 : 0; }
  // 친 만큼 올린다. 이번 일격으로 쓰러졌으면 true
  // v418 finish: 내 화면에서 마왕이 쓰러졌다 — 반올림으로 서버에 1이 남지 않게 남은 체력까지 채워 마무리한다
  async commitWraid(id, amount, finish = false) {
    if (!this.ready() || !(amount > 0 || finish)) return false;
    const ref = this.ref('wraid', id);
    const killed = await ack(this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const r = snap.data();
      if ((r.total || 0) >= r.maxHp) {
        // v417 같이 치던 중 다른 무인이 마무리했다 — 내 몫이 아직 0이면 늦은 한 몫(체력의 5%까지)을 올려 보상을 받게(규칙 wLate)
        if (!(r.damage?.[this.uid] > 0) && r.killedAt) {
          tx.update(ref, { [`damage.${this.uid}`]: Math.max(1, Math.min(Math.round(amount), Math.floor(r.maxHp * 0.05))), [`names.${this.uid}`]: this.game.s.nickname || '무명' });
          this.lateDone = id;
        }
        return false;
      }
      let add = Math.max(0, Math.round(amount));
      const rest = r.maxHp - (r.total || 0);
      if (finish && add < rest && rest <= Math.max(10, r.maxHp * 0.001)) add = rest;   // v418 남은 게 아주 조금(반올림 찌꺼기)이면 채운다
      if (!(add > 0)) return false;
      const sum = Math.min(r.maxHp, (r.total || 0) + add);
      const up = { total: sum, [`damage.${this.uid}`]: (r.damage?.[this.uid] || 0) + add, [`names.${this.uid}`]: this.game.s.nickname || '무명' };
      if (sum >= r.maxHp) { up.killedAt = this.fs.serverTimestamp(); up.killer = this.uid; }
      tx.update(ref, up);
      return sum >= r.maxHp;
    }), 12000);
    if (killed) {
      const b = D.wraidBossOfId(id);
      this.sendWorld(b.secret ? `🖐 ${this.game.s.nickname}님의 마무리 일격 — 석가여래가 쓰러졌다… 고 모두가 믿은 순간, 다섯 손가락이 하늘을 덮었다. 처음부터 손바닥 안이었다.`
        : b.final ? `☁ ${this.game.s.nickname}님의 마무리 일격! 천외천 천궁의 옥황상제가 쓰러졌다 — 함께 친 무인 모두 보상을 받아 가세요.`
        : `🌋 ${this.game.s.nickname}님의 마무리 일격! ${b.name}(${b.hanja}) 쓰러짐 — 함께 친 무인 모두 대성신장을 받아 가세요.`, 'system').catch(() => {});
    }
    return killed;
  }
  canClaimWraid(r) {
    return !!(r && r.total >= r.maxHp && (r.damage?.[this.uid] || 0) > 0 && !r.claimed?.[this.uid]);
  }
  async claimWraid(r) {
    if (!this.canClaimWraid(r)) return null;
    const ref = this.ref('wraid', r.id);
    const ok = await ack(this.fs.runTransaction(this.db, async (tx) => {
      const d = (await tx.get(ref)).data();
      if (!d || d.total < d.maxHp || !(d.damage?.[this.uid] > 0) || d.claimed?.[this.uid]) return false;
      tx.update(ref, { [`claimed.${this.uid}`]: true });
      return true;
    }));
    if (!ok) { delete this.wdone[r.id]; return null; }
    const rank = this.wraidMyRank(r);
    const boss = D.wraidBossOfId(r.id);
    const out = this.game.wraidClaim(rank, boss.id);
    delete this.wdone[r.id];
    this.changed('wraid');
    return { rank, reward: out, boss };
  }

  // 문파 출석 — 길잡이가 본다 (v146)
  async checkin() {
    const ok = await super.checkin();
    if (ok) this.game.mark('checkin');
    return ok;
  }

  // 문파를 나가면 함께 사냥 표(RTDB gm/{문파})에서도 지운다 (v138)
  async leaveGuild() {
    const gid = this.game.s.guildId;
    await super.leaveGuild();
    this.coopForget?.(gid);
  }

  // 문파 채팅에 알림 한 줄 (전직·상급 조합 같은 자랑거리)
  announce(text) {
    if (this.guild && this.online) this.sendChat(text, 'system').catch(() => {});
    if (this.online) this.sendWorld(text, 'system').catch(() => {});   // v302 전체 채팅에도
  }
}
