// Firebase 연동: 익명 로그인, 프로필·서열, 문파·채팅, 문파 토벌.
// SDK를 동적으로 불러오므로 실패해도 혼자 하기는 그대로 동작한다.
import { firebaseConfig, FIREBASE_SDK_VERSION, ADMIN_UID } from './firebase-config.js';
import { big } from './big.js';
import { Big } from './big.js';

// 옛 game.js에서 빌려 쓰던 둘 — 바람식 개편으로 옛 엔진을 뺄 때 여기로 옮겼다.
export const dayKey = (t = Date.now()) => {
  const d = new Date(t + 9 * 3600 * 1000); // 한국 시간 기준 하루
  return d.toISOString().slice(0, 10);
};
export function safeBig(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Big) {
    return (Number.isFinite(v.m) && Number.isFinite(v.e) && Math.abs(v.e) < 1e300) ? v : null;
  }
  if (typeof v === 'string') return safeBig(Big.parse(v));
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return big(v);
}
import {
  EQUIP_TYPES, GUILD_MAX, GUILD_CHECKIN_EXP, GUILD_DONATE_GEMS, GUILD_DONATE_EXP, RAID_HP_SECONDS, raidReward,
} from './data.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const PROFILE_INTERVAL = 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// power는 순위 열쇠라 보통 숫자여야 한다. 1e300에서 자른다 — 그 위는
// 어차피 Firestore 색인이 못 가린다. 진짜 값은 powerBig 글자로 같이 올린다.
const capNum = (v) => {
  const L = big(v).log10();
  if (!Number.isFinite(L)) return 0;
  return L > 300 ? 1e300 : big(v).toNumber();
};
const logOf = (v) => {
  const L = big(v).log10();
  return Number.isFinite(L) ? L : 0;
};

export class Net {
  constructor(game, { onChange } = {}) {
    this.game = game;
    this.onChange = onChange || (() => {});
    this.status = 'connecting';
    this.uid = null;
    this.guild = null;
    this.messages = [];
    this.stash = [];
    this.raid = null;
    this.unsubs = [];
    this.lastProfile = 0;
    this.blocked = false;   // 서버가 거부해서 멈춘 상태 (끊긴 것과 다르다)
    this.shop = null;       // 상점에 띄울 계좌 정보 (config/shop)
  }

  get online() { return this.status === 'online'; }

  changed(what) { this.onChange(what); }

  async init() {
    try {
      const [appM, authM, fs] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
      ]);
      this.fs = fs;
      const app = appM.initializeApp(firebaseConfig);
      this.auth = authM.getAuth(app);
      this.db = fs.getFirestore(app);
      const emu = new URLSearchParams(location.search).get('emu');
      if (emu) {
        const host = emu === '1' ? '127.0.0.1' : emu;
        authM.connectAuthEmulator(this.auth, `http://${host}:9099`, { disableWarnings: true });
        fs.connectFirestoreEmulator(this.db, host, 8080);
      }
      const cred = await authM.signInAnonymously(this.auth);
      this.uid = cred.user.uid;
      this.status = 'online';
      this.changed('status');
      await this.pushProfile(true);
      await this.syncEntitlement();
      await this.loadShop();
      if (this.game.s.guildId) this.watchGuild(this.game.s.guildId);
    } catch (err) {
      console.warn('[net] offline:', err?.message || err);
      this.status = 'offline';
      this.changed('status');
    }
  }

  ref(...path) { return this.fs.doc(this.db, ...path); }

  // ---------- 광고 제거 ----------
  //
  // 참말은 서버에 있다(entitlements/{uid}). 세이브의 noAds는 사본일 뿐이다 —
  // 오프라인에서도 쓸 수 있게 두는 것이고, 접속하면 서버 값으로 맞춘다.
  //
  // **켜 주기만 하고 뺏지는 않는다.** 서버에 없다고 꺼 버리면, 입금했는데
  // 운영자가 아직 안 켠 사람이 쓰던 걸 잃는다. 그건 돈 받고 하는 짓이 아니다.
  async syncEntitlement() {
    if (!this.online || this.blocked || !this.uid) return;
    try {
      const snap = await this.fs.getDoc(this.ref('entitlements', this.uid));
      if (snap.exists() && snap.data().noAds && !this.game.s.noAds) {
        this.game.s.noAds = true;
        this.changed('noAds');
      }
    } catch (err) {
      if (!this.denied(err)) console.warn('[net] entitlement', err);
    }
  }

  // 계좌 정보는 **저장소에 안 둔다.** 공개 저장소라서다.
  // 운영자가 콘솔에서 config/shop을 고치면 배포 없이 바뀐다.
  async loadShop() {
    if (!this.online || this.blocked) return;
    try {
      const snap = await this.fs.getDoc(this.ref('config', 'shop'));
      if (snap.exists()) { this.shop = snap.data(); this.changed('shop'); }
    } catch (err) {
      if (!this.denied(err)) console.warn('[net] shop', err);
    }
  }

  // ---------- 운영자 ----------
  //
  // 여기서 참이라고 **허락되는 건 아니다.** 서버 규칙이 같은 값을 다시 본다.
  // 이건 '버튼을 보여 줄까'만 정한다 — 누가 코드를 고쳐 true로 만들어도
  // 쓰기는 서버에서 거부된다.
  isAdmin() { return !!this.uid && this.uid === ADMIN_UID; }

  // 광고 제거를 켜고 끈다. 끌 때는 문서를 지운다 — 꺼진 흔적을 남길 이유가 없다.
  async setNoAds(uid, on) {
    if (!this.isAdmin() || !uid) return false;
    try {
      if (on) await this.fs.setDoc(this.ref('entitlements', uid), { noAds: true, at: Date.now() });
      else await this.fs.deleteDoc(this.ref('entitlements', uid));
      return true;
    } catch (err) { console.warn('[net] setNoAds', err); return false; }
  }

  // 누가 켜져 있는지 한 번에 본다 (운영자만 남의 것을 읽을 수 있다)
  async whoHasNoAds(uids) {
    if (!this.isAdmin()) return {};
    const out = {};
    await Promise.all(uids.map(async (u) => {
      try {
        const s = await this.fs.getDoc(this.ref('entitlements', u));
        out[u] = s.exists() && !!s.data().noAds;
      } catch { out[u] = null; }
    }));
    return out;
  }

  // 서열 상위를 불러온다 — 운영자 화면에서 별호로 고르게 하려고
  async topPlayers(n = 30) {
    try {
      const snap = await this.fs.getDocs(this.fs.query(
        this.fs.collection(this.db, 'players'), this.fs.orderBy('power', 'desc'), this.fs.limit(n)));
      const rows = [];
      snap.forEach((d) => rows.push({ uid: d.id, ...d.data() }));
      return rows;
    } catch (err) { console.warn('[net] topPlayers', err); return []; }
  }

  // 계좌 정보를 폰에서 고친다
  async saveShop(data) {
    if (!this.isAdmin()) return false;
    try {
      await this.fs.setDoc(this.ref('config', 'shop'), data, { merge: true });
      this.shop = { ...(this.shop || {}), ...data };
      this.changed('shop');
      return true;
    } catch (err) { console.warn('[net] saveShop', err); return false; }
  }

  // ---------- 서버 점검 ----------
  //
  // "무림이 안 돼요"는 원인이 다섯 가지쯤 된다 — 인터넷, SDK 못 받음,
  // 익명 로그인 꺼짐, 규칙 미게시, 규칙은 올렸는데 조건이 안 맞음.
  // 화면에는 전부 똑같이 '오프라인'으로 보인다. 그래서 **한 줄씩 짚어 준다.**
  //
  // 남의 문서는 안 건드린다. 내 프로필에 쓰고, 내 프로필을 읽고,
  // 서열 한 줄을 읽어 보는 것까지다.
  async diagnose() {
    const out = [];
    const step = async (name, fn) => {
      try { const extra = await fn(); out.push({ name, ok: true, extra: extra || '' }); return true; } catch (e) {
        out.push({ name, ok: false, extra: e?.code || String(e?.message || e).slice(0, 80) });
        return false;
      }
    };
    if (!this.fs || !this.db) {
      out.push({ name: 'Firebase 불러오기', ok: false, extra: '아직 연결 전이에요 — 잠시 뒤 다시 눌러 주세요' });
      return out;
    }
    out.push({ name: 'Firebase 불러오기', ok: true, extra: '' });
    const signed = await step('익명 로그인', async () => {
      if (!this.uid) throw new Error('로그인 안 됨');
      return `uid ${this.uid.slice(0, 6)}…`;
    });
    if (!signed) return out;
    const wrote = await step('내 기록 쓰기', async () => {
      await this.fs.setDoc(this.ref('players', this.uid), this.profileData(), { merge: true });
      return '';
    });
    await step('내 기록 읽기', async () => {
      const s = await this.fs.getDoc(this.ref('players', this.uid));
      return s.exists() ? '' : '아직 비어 있음';
    });
    await step('서열 읽기', async () => {
      const q = this.fs.query(this.fs.collection(this.db, 'players'),
        this.fs.orderBy('power', 'desc'), this.fs.limit(1));
      const s = await this.fs.getDocs(q);
      return `${s.size}명 보임`;
    });
    // 전부 막혔으면 원인은 거의 하나다
    if (!wrote && out.some((x) => !x.ok && x.extra === 'permission-denied')) {
      out.push({ name: '진단', ok: false,
        extra: '규칙이 안 올라갔어요 — firestore.rules를 Firebase 콘솔에 게시하세요' });
    } else if (wrote) {
      // 다시 살려 둔다. 점검에 성공했는데 화면이 계속 끊긴 상태면 이상하다.
      this.blocked = false;
      if (this.status !== 'online') { this.status = 'online'; this.changed('status'); }
    }
    return out;
  }


  // ---------- 프로필 / 서열 ----------
  profileData() {
    const g = this.game;
    const p = g.power();
    const best = Object.fromEntries(Object.keys(EQUIP_TYPES).map((t) => [t, g.bestGrade(t)]));
    // 데려간 영수의 맨 앞 (예전엔 s.pet 한 마리였다 — 지금은 늘 비어 있다)
    const pet = g.petTeam()[0];
    return {
      nickname: g.s.nickname || '이름없음',
      // Firestore에는 class를 못 넣는다. 그리고 power는 orderBy의 열쇠라
      // 보통 숫자여야 한다 — 1e300에서 자른다(순위용). 진짜 값은 글자로 따로.
      power: capNum(p.power), powerLog: logOf(p.power), powerBig: String(p.power),
      dps: String(p.dps), atk: String(p.atk), hp: String(p.hp),
      // 토벌 두목 체력을 정하는 값. dps는 평타·영수만 세서 무공(3~8배)이 빠져 있었다 —
      // 두목이 '문파 전원 60초'가 아니라 혼자 몇 초 만에 쓰러졌다.
      raidDps: String(this.raidDpsOf(g)),
      crit: p.crit, critDmg: String(p.critDmg), speed: p.speed, petHit: String(p.petHit),
      maxStage: g.s.maxStage, bestStage: g.s.bestStage, stage: g.s.stage, level: g.s.level, rank: g.s.rank,
      job: g.s.job || null, jobTier: g.jobTier(),
      regress: g.s.regress.count,
      pet: pet?.id || null, petLv: pet ? g.s.pets[pet.id] : 0, petEmoji: pet?.emoji || null,
      weaponGrade: best.weapon, enhance: { ...g.s.enhance },
      pvp: { ...g.s.pvp },
      best, skills: { ...g.s.skills }, skillSlots: [...g.s.skillSlots], upgrades: { ...g.s.upgrades },
      guildId: g.s.guildId || null, guildName: this.guild?.name || null,
      updatedAt: this.fs.serverTimestamp(),
    };
  }

  // 권한이 막힌 경우를 가려낸다.
  //
  // Firestore 규칙이 막혀 있으면(테스트 모드 만료, 규칙 미게시 등) 모든 요청이
  // 'permission-denied'로 떨어진다. 그런데 로그인 자체는 성공하므로
  // 화면에는 계속 '온라인'이라고 떴고, 5초마다 다시 던져서 콘솔이 같은
  // 경고로 도배됐다. 될 리 없는 요청을 반복하는 것이다.
  //
  // 한 번 막히면 끊긴 것으로 보고 멈춘다. 그래야 화면도 솔직해진다.
  denied(err) {
    const code = err?.code || '';
    const msg = String(err?.message || err);
    if (code !== 'permission-denied' && !msg.includes('insufficient permissions')) return false;
    if (this.status !== 'offline') {
      console.warn('[net] 서버 권한이 막혀 있어 끊습니다 (Firestore 규칙을 확인하세요)');
      this.status = 'offline';
      this.blocked = true;
      this.changed('status');
    }
    return true;
  }

  async pushProfile(force = false) {
    if (!this.online || this.blocked || !this.game.s.nickname) return;
    const now = Date.now();
    if (!force && now - this.lastProfile < PROFILE_INTERVAL) return;
    this.lastProfile = now;
    try {
      await this.fs.setDoc(this.ref('players', this.uid), this.profileData(), { merge: true });
    } catch (err) {
      if (!this.denied(err)) console.warn('[net] profile', err);
    }
  }

  async ranking() {
    const { collection, query, orderBy, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'players'), orderBy('power', 'desc'), limit(50)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  async player(uid) {
    const snap = await this.fs.getDoc(this.ref('players', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  }

  // ---------- 문파 ----------
  async createGuild(name) {
    const { runTransaction, serverTimestamp } = this.fs;
    const nick = this.game.s.nickname;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      const ref = this.ref('guilds', code);
      const ok = await runTransaction(this.db, async (tx) => {
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, {
          name, code, owner: this.uid,
          memberIds: [this.uid], members: { [this.uid]: nick },
          exp: 0, checkins: {}, createdAt: serverTimestamp(),
        });
        return true;
      });
      if (ok) return this.enterGuild(code);
    }
    throw new Error('문파 코드를 만들지 못했어요. 다시 시도해 주세요.');
  }

  async joinGuild(rawCode) {
    const code = rawCode.trim().toUpperCase();
    const { runTransaction } = this.fs;
    const ref = this.ref('guilds', code);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('그런 문파 코드가 없어요.');
      const g = snap.data();
      if (g.memberIds.includes(this.uid)) return;
      if (g.memberIds.length >= GUILD_MAX) throw new Error(`문파가 가득 찼어요 (최대 ${GUILD_MAX}명).`);
      tx.update(ref, {
        memberIds: [...g.memberIds, this.uid],
        members: { ...g.members, [this.uid]: this.game.s.nickname },
      });
    });
    return this.enterGuild(code);
  }

  async enterGuild(code) {
    this.game.s.guildId = code;
    this.watchGuild(code);
    await this.pushProfile(true);
    this.changed('guild');
  }

  async leaveGuild() {
    const gid = this.game.s.guildId;
    if (!gid) return;
    const { updateDoc, arrayRemove, deleteField } = this.fs;
    try {
      await updateDoc(this.ref('guilds', gid), {
        memberIds: arrayRemove(this.uid),
        [`members.${this.uid}`]: deleteField(),
      });
    } finally {
      this.stopWatching();
      this.game.s.guildId = null;
      this.game.guildExp = 0;
      this.guild = null;
      this.messages = [];
      this.raid = null;
      await this.pushProfile(true);
      this.changed('guild');
    }
  }

  stopWatching() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  watchGuild(gid) {
    if (!this.online) return;
    this.stopWatching();
    const { onSnapshot, collection, query, orderBy, limit } = this.fs;
    this.unsubs.push(onSnapshot(this.ref('guilds', gid), (snap) => {
      if (!snap.exists() || !snap.data().memberIds.includes(this.uid)) {
        // 문파가 사라졌거나 내보내졌을 때
        this.stopWatching();
        this.game.s.guildId = null;
        this.game.guildExp = 0;
        this.guild = null;
        this.changed('guild');
        return;
      }
      const prevName = this.guild?.name;
      const firstTime = !this.guild;
      this.guild = { id: gid, ...snap.data() };
      if (firstTime) this.watchStash(gid);
      this.game.guildExp = this.guild.exp || 0;
      if (prevName !== this.guild.name) this.pushProfile(true);
      this.changed('guild');
    }, (err) => console.warn('[net] guild', err)));

    this.unsubs.push(onSnapshot(
      query(collection(this.db, 'guilds', gid, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        this.messages = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse();
        this.changed('chat');
      },
      (err) => console.warn('[net] chat', err),
    ));

    this.watchRaid(gid);
  }

  watchRaid(gid) {
    const day = dayKey();
    this.raidDay = day;
    const unsub = this.fs.onSnapshot(this.ref('guilds', gid, 'raids', day), (snap) => {
      this.raid = snap.exists() ? { id: day, ...snap.data() } : null;
      this.changed('raid');
    }, (err) => console.warn('[net] raid', err));
    this.unsubs.push(unsub);
  }

  // 날짜가 바뀌면 새 토벌 문서를 본다
  refreshDay() {
    if (this.guild && this.raidDay !== dayKey()) this.watchGuild(this.guild.id);
  }

  // ---------- 문파 창고 ----------
  // 근거: 공략에서 피규어를 '거래소'에서 사는 장면이 핵심이었다.
  //   "전설·신화·갓등급 피규어는 거래소를 통해 가격정렬을 오름차순으로 바꾸고
  //    가장 저렴한 가격으로 꼭 하나씩은 구매해서 장착하시는 게 무조건 좋습니다."
  // 우리는 둘이 하는 게임이라 사고파는 시장이 설 수 없다. 대신 문파에
  // 창고를 두고 남는 것을 서로 넘긴다 — 둘이 한다는 성격이 처음으로 기능이 된다.
  watchStash(gid) {
    const { onSnapshot, collection, query, orderBy, limit } = this.fs;
    this.unsubs.push(onSnapshot(
      query(collection(this.db, 'guilds', gid, 'stash'), orderBy('at', 'desc'), limit(40)),
      (snap) => {
        this.stash = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.changed('stash');
      },
      (err) => console.warn('[net] stash', err),
    ));
  }

  // 장비 한 개를 창고에 넣는다
  async putEquip(type, grade) {
    if (!this.guild || !this.online) return false;
    const bag = this.game.s.equips?.[type];
    if (!bag || bag[grade] <= 0) return false;
    bag[grade]--;
    try {
      await this.fs.addDoc(this.fs.collection(this.db, 'guilds', this.guild.id, 'stash'), {
        kind: 'equip', type, grade, uid: this.uid,
        name: this.game.s.nickname || '무명', at: Date.now(),
      });
      return true;
    } catch (e) {
      bag[grade]++;   // 실패하면 되돌린다
      console.warn('[net] putEquip', e);
      return false;
    }
  }

  // 장신구 하나를 창고에 넣는다
  async putAcc(slot, grade) {
    if (!this.guild || !this.online) return false;
    const bag = this.game.s.accBag?.[slot];
    if (!bag || bag[grade] <= 0) return false;
    bag[grade]--;
    try {
      await this.fs.addDoc(this.fs.collection(this.db, 'guilds', this.guild.id, 'stash'), {
        kind: 'acc', slot, grade, uid: this.uid,
        name: this.game.s.nickname || '무명', at: Date.now(),
      });
      return true;
    } catch (e) {
      bag[grade]++;
      console.warn('[net] putAcc', e);
      return false;
    }
  }

  // 창고에서 하나 꺼낸다. 먼저 지우고 받는다 — 둘이 동시에 눌러도 하나만 가져간다.
  async takeStash(item) {
    if (!this.guild || !this.online || !item) return false;
    try {
      await this.fs.deleteDoc(this.ref('guilds', this.guild.id, 'stash', item.id));
    } catch (e) {
      console.warn('[net] takeStash', e);
      return false;
    }
    if (item.kind === 'equip' && this.game.s.equips?.[item.type]) {
      this.game.s.equips[item.type][item.grade]++;
      this.game.noteCodex(item.type, item.grade);
    } else if (item.kind === 'acc' && this.game.s.accBag?.[item.slot]) {
      this.game.s.accBag[item.slot][item.grade]++;
      this.game.autoEquipAcc();
    }
    return true;
  }

  async sendChat(text, type = 'chat') {
    const clean = text.trim().slice(0, 200);
    if (!clean || !this.guild) return;
    await this.fs.addDoc(this.fs.collection(this.db, 'guilds', this.guild.id, 'messages'), {
      uid: this.uid, name: this.game.s.nickname, text: clean, type, createdAt: this.fs.serverTimestamp(),
    });
  }

  checkedInToday() {
    return this.guild?.checkins?.[this.uid] === dayKey();
  }

  async checkin() {
    if (!this.guild || this.checkedInToday()) return false;
    await this.fs.updateDoc(this.ref('guilds', this.guild.id), {
      exp: this.fs.increment(GUILD_CHECKIN_EXP),
      [`checkins.${this.uid}`]: dayKey(),
    });
    return true;
  }

  async donate() {
    if (!this.guild || this.game.s.gems < GUILD_DONATE_GEMS) return false;
    this.game.s.gems -= GUILD_DONATE_GEMS;
    try {
      await this.fs.updateDoc(this.ref('guilds', this.guild.id), { exp: this.fs.increment(GUILD_DONATE_EXP) });
    } catch (err) {
      this.game.s.gems += GUILD_DONATE_GEMS;
      throw err;
    }
    return true;
  }

  // ---------- 토벌 ----------
  // 두목을 때리는 실제 세기 — 평타·영수에 무공까지
  raidDpsOf(g) { return big(g.power().dps).add(g.skillDps()); }

  async ensureRaid() {
    if (!this.guild) throw new Error('문파에 먼저 들어가 주세요.');
    const day = dayKey();
    const ref = this.ref('guilds', this.guild.id, 'raids', day);
    const existing = await this.fs.getDoc(ref);
    if (existing.exists()) return { id: day, ...existing.data() };

    // 문파원들의 DPS 합으로 오늘 두목 체력을 정한다
    const profiles = await Promise.all(this.guild.memberIds.map((id) => this.player(id).catch(() => null)));
    const mine = this.raidDpsOf(this.game);
    const sum = profiles.reduce(
      (acc, pr) => acc.add(pr?.uid === this.uid ? mine : (safeBig(pr?.raidDps) || safeBig(pr?.dps) || big(0))),
      big(0),
    );
    // 두목 체력도 글자로 올린다. 보통 숫자로 두면 문파가 세질수록 터진다.
    const hpBig = (sum.isPos() ? sum : mine).mul(RAID_HP_SECONDS).max(1000);
    const maxHp = String(hpBig);
    await this.fs.runTransaction(this.db, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      tx.set(ref, {
        maxHp, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null,
        createdAt: this.fs.serverTimestamp(),
      });
    });
    const snap = await this.fs.getDoc(ref);
    return { id: day, ...snap.data() };
  }

  async commitRaidDamage(amount, raidId) {
    // 넣은 피해도 Big이다. 서버에는 글자로 넣고, 읽을 때 다시 Big으로 푼다.
    // 보통 숫자로 더하면 문파가 세졌을 때 total이 Infinity가 되고,
    // 그러면 `total >= maxHp`가 늘 참이라 두목이 영원히 죽은 채로 남는다.
    const amt = safeBig(amount);
    if (!this.guild || !amt || !amt.isPos()) return null;
    const ref = this.ref('guilds', this.guild.id, 'raids', raidId);
    const killed = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const r = snap.data();
      const maxHp = safeBig(r.maxHp) || big(0);
      const was = safeBig(r.total) || big(0);
      if (was.gte(maxHp)) return false;
      const sum = was.add(amt).min(maxHp);
      const total = String(sum);
      const update = {
        total,
        [`damage.${this.uid}`]: String((safeBig(r.damage?.[this.uid]) || big(0)).add(amt)),
        [`names.${this.uid}`]: this.game.s.nickname,
      };
      // 글자끼리 >=를 하면 사전 순으로 견준다 — '9e5' >= '1e6'이 참이 된다. Big으로 견준다.
      const nowKilled = sum.gte(maxHp);
      if (nowKilled) update.killedAt = this.fs.serverTimestamp();
      tx.update(ref, update);
      return nowKilled;
    });
    if (killed) {
      await this.sendChat(`🐲 ${this.game.s.nickname}님이 마무리 일격! 오늘의 토벌 두목 처치! 보상을 받아 가세요.`, 'system')
        .catch(() => {});
    }
    return killed;
  }

  canClaimRaid() {
    const r = this.raid;
    return !!(r && r.total >= r.maxHp && (r.damage?.[this.uid] || 0) > 0 && !r.claimed?.[this.uid]);
  }

  async claimRaid() {
    if (!this.guild || !this.raid) return null;
    const ref = this.ref('guilds', this.guild.id, 'raids', this.raid.id);
    const ok = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const r = snap.data();
      if (!r || r.total < r.maxHp || !(r.damage?.[this.uid] > 0) || r.claimed?.[this.uid]) return false;
      tx.update(ref, { [`claimed.${this.uid}`]: true });
      return true;
    });
    if (!ok) return null;
    return this.game.grant(raidReward(this.game.s.maxStage));
  }
}
