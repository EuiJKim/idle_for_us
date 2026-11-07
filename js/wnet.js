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
    const maxHp = D.wraidMaxHp(this.game.hwamugiHp(), boss);
    if (seq) {
      const cref = this.ref('wraid', D.wraidDocId(boss, seq));
      const cur = await ack(this.fs.getDoc(cref));
      if (cur.exists() && cur.data().total < cur.data().maxHp) return { id: cur.id, boss, ...cur.data() };
      // v432 번호는 있는데 문서가 없으면(지워졌으면) 그 번호 문서를 그대로 세운다 — 전엔 번호를 올리려다 규칙에 막혀 그 마왕은 영영 「깨우지 못했어요」
      if (!cur.exists()) {
        try { await ack(this.fs.setDoc(cref, { boss, seq, maxHp, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null, killer: null, createdAt: this.fs.serverTimestamp() })); } catch (err) { if (err?.code !== 'permission-denied') throw err; }
        const again = await ack(this.fs.getDoc(cref));
        if (again.exists() && again.data().total < again.data().maxHp) return { id: again.id, boss, ...again.data() };
      }
    }
    const next = seq + 1;
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
    // v432 끊겨 있으면 바로 실패(올리지 않은 몫으로 남긴다). 느리면 실패로 보지 않는다 — 타임아웃은 거래를 멈추지 못해
    //   12초 뒤 「실패」로 보고 같은 몫을 다시 보내면 서버에서 둘 다 들어가 피해가 두 번 셌다(순위 왜곡 · 거짓 「기록 실패」)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('인터넷이 끊겨 있어요 — 연결되면 다시 해 주세요');
    const txp = this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const r = snap.data();
      if ((r.total || 0) >= r.maxHp) {
        // v417 같이 치던 중 다른 무인이 마무리했다 — 내 몫이 아직 0이면 늦은 한 몫(체력의 5%까지)을 올려 보상을 받게(규칙 wLate)
        if (!(r.damage?.[this.uid] > 0) && r.killedAt) {
          if (amount >= 1 && r.seen?.[this.uid]) tx.update(ref, { [`damage.${this.uid}`]: Math.max(1, Math.min(Math.round(amount), Math.floor(r.maxHp * 0.05))), [`names.${this.uid}`]: this.game.s.nickname || '무명' });   // v421 들어왔다는 표시(seen)가 있고 진짜 친 몫이 있을 때만
        }
        return false;
      }
      let add = Math.max(0, Math.round(amount));
      const rest = r.maxHp - (r.total || 0);
      if (finish && add < rest && rest <= Math.max(50, r.maxHp * 0.0001)) add = rest;   // v418 남은 게 아주 조금(반올림 찌꺼기)이면 채운다 · v421 0.1% → 0.01%(채운 몫이 순위를 바꾸지 않게 — 4초마다 내림한 찌꺼기는 수십이다)
      if (!(add > 0)) return false;
      const sum = Math.min(r.maxHp, (r.total || 0) + add);
      const up = { total: sum, [`damage.${this.uid}`]: (r.damage?.[this.uid] || 0) + add, [`names.${this.uid}`]: this.game.s.nickname || '무명' };
      if (sum >= r.maxHp) { up.killedAt = this.fs.serverTimestamp(); up.killer = this.uid; }
      tx.update(ref, up);
      return sum >= r.maxHp;
    });
    const SLOW = {};
    const got = await Promise.race([txp, new Promise((res) => setTimeout(() => res(SLOW), 12000))]);
    if (got === SLOW) {   // 느린 거래는 보낸 것으로 친다 — 끝나면 마무리였는지만 알린다
      txp.then((k) => { if (k) this.game.emit?.('wraidSlowKill', { id }); }).catch(() => {});
      return false;
    }
    const killed = got;
    // v432 지금 보고 있는 마왕이 아닌 문서(이미 다음 번호로 넘어간 판)에 올렸으면 한 번 다시 읽어 받을 것에 남긴다 —
    //   리스너가 이미 떨어져 있어 늦은 한 몫을 올려도 다시 켜기 전까지 「받기」가 안 보였다
    { const b = D.wraidBossOfId(id)?.id; if (b && this.wgen?.[b]?.id !== id) this.checkGen(b, Number(String(id).split('_').pop())); }
    if (killed) {
      const b = D.wraidBossOfId(id);
      this.sendWorld(b.secret ? `🖐 ${this.game.s.nickname}님의 마무리 일격 — 석가여래가 쓰러졌다… 고 모두가 믿은 순간, 다섯 손가락이 하늘을 덮었다. 처음부터 손바닥 안이었다.`
        : b.final ? `☁ ${this.game.s.nickname}님의 마무리 일격! 천외천 천궁의 옥황상제가 쓰러졌다 — 함께 친 무인 모두 보상을 받아 가세요.`
        : `🌋 ${this.game.s.nickname}님의 마무리 일격! ${b.name}(${b.hanja}) 쓰러짐 — 함께 친 무인 모두 대성신장을 받아 가세요.`, 'system').catch(() => {});
    }
    return killed;
  }
  // v421 들어왔다는 표시 — 늦은 한 몫(commitWraid의 wLate)은 이 표시가 있는 사람만 받는다(규칙 wSeen)
  async seenWraid(id) {
    if (!this.ready() || !id) return false;
    const r = this.wgen?.[D.wraidBossOfId(id)?.id];
    if (r && r.id === id && r.seen?.[this.uid]) return true;
    await ack(this.fs.updateDoc(this.ref('wraid', id), { [`seen.${this.uid}`]: this.fs.serverTimestamp() }), 8000);
    return true;
  }
  // v432 받음 표시는 했는데 못 준 보상(빚) — 켤 때·저절로 받기 때 다시 준다
  settleWraidOwed() {
    const w = this.game.s.wraid, got = [];
    for (const [id, o] of Object.entries(w.owe || {})) {
      try { const out = this.game.wraidClaim(o.rank, o.boss); delete w.owe[id]; got.push({ rank: o.rank, reward: out, boss: D.WRAID_BOSS[o.boss] }); } catch (err) { console.warn('[wraid] owe', err); }
    }
    return got;
  }
  canClaimWraid(r) {
    return !!(r && r.total >= r.maxHp && (r.damage?.[this.uid] || 0) > 0 && !r.claimed?.[this.uid]);
  }
  // v420 이 캐릭터가 친 판만(계정 단위 보상이라 다른 캐릭터로 바꾸면 그 캐릭터가 받아 갔다) · force: 사람이 눌러 받는다
  async claimWraid(r, force = false) {
    if (!this.canClaimWraid(r) || (!force && !this.game.wraidPart?.(r.id))) return null;
    const ref = this.ref('wraid', r.id);
    // v432 순위는 거래가 읽은 문서로 센다 — 전엔 쓰러진 순간의 사본(리스너)으로 세어, 그 뒤 들어온 늦은 한 몫·내 마지막 몫이 빠졌다
    const rank = await ack(this.fs.runTransaction(this.db, async (tx) => {
      const d = (await tx.get(ref)).data();
      if (!d || d.total < d.maxHp || !(d.damage?.[this.uid] > 0) || d.claimed?.[this.uid]) return 0;
      tx.update(ref, { [`claimed.${this.uid}`]: true });
      return this.wraidMyRank(d) || 1;
    }));
    if (!rank) { delete this.wdone[r.id]; return null; }
    const boss = D.wraidBossOfId(r.id);
    // v432 서버에 「받음」을 적은 뒤 주다가 오류가 나면 보상이 영영 사라졌다 — 빚으로 적어 두고 다음에 다시 준다
    const w = this.game.s.wraid;
    w.owe = { ...(w.owe || {}), [r.id]: { rank, boss: boss.id } };
    let out = null;
    try { out = this.game.wraidClaim(rank, boss.id); delete w.owe[r.id]; } catch (err) { console.warn('[wraid] grant', err); this.changed('wraid'); throw new Error('보상을 주다 멈췄어요 — 다음에 들어오면 다시 받아요'); }
    if (w.part?.[r.id]) delete w.part[r.id];
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
