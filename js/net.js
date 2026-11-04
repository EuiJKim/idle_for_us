// Firebase 연동: 익명 로그인, 프로필·서열, 문파·채팅, 문파 토벌.
// SDK를 동적으로 불러오므로 실패해도 혼자 하기는 그대로 동작한다.
import { firebaseConfig, FIREBASE_SDK_VERSION, ADMIN_UID } from './firebase-config.js';
// v309 이 앱이 바라는 규칙 판 — firestore.rules의 rulesv 숫자와 같아야 한다(규칙을 고치면 둘 다 올린다)
export const RULES_VER = '345';
export const WORLD_MAX = 100;   // v315 전체 채팅 한 마디 길이
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
    this.world = [];          // v302 전체 채팅
    this.worldSeen = 0;       // 마지막으로 본 메시지 수(안 읽음 표시)
    this.worldAt = 0;         // 마지막으로 보낸 때(2초에 한 번)
    this.worldUnsub = null;
    this.stash = [];
    this.raid = null;
    this.unsubs = [];
    this.lastProfile = 0;
    this.blocked = false;   // 서버가 거부해서 멈춘 상태 (끊긴 것과 다르다)
    this.shop = null;       // 상점에 띄울 계좌 정보 (config/shop)
    this.rulesOk = null;    // v309 게시된 규칙이 이 앱 판과 맞나(null 아직 모름 · true · false)
    this.hidden = [];       // v308 서열에서 숨긴 무인(config/hidden.uids) — 지운 서열 문서가 그 계정에서 다시 올라와도 안 보이게
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
      this.app = app;
      this.auth = authM.getAuth(app);
      this.db = fs.getFirestore(app);
      const emu = new URLSearchParams(location.search).get('emu');
      if (emu) {
        const host = emu === '1' ? '127.0.0.1' : emu;
        authM.connectAuthEmulator(this.auth, `http://${host}:9099`, { disableWarnings: true });
        fs.connectFirestoreEmulator(this.db, host, 8080);
      }
      this.authM = authM;
      // v265: 전엔 늘 signInAnonymously였다 — Google을 이은 뒤엔 그게 새 익명 계정을 만들어 연결이 풀린다.
      //   저장된 로그인부터 기다리고, 없을 때만 익명으로 들어간다.
      if (this.auth.authStateReady) await this.auth.authStateReady();
      const user = this.auth.currentUser || (await authM.signInAnonymously(this.auth)).user;
      this.uid = user.uid;
      this.status = 'online';
      this.changed('status');
      await this.pushProfile(true);
      await this.syncEntitlement();
      await this.loadShop();
      await this.loadHidden();
      await this.checkRules();
      if (this.game.s.guildId) this.watchGuild(this.game.s.guildId);
      this.watchWorld();
    } catch (err) {
      console.warn('[net] offline:', err?.message || err);
      this.status = 'offline';
      this.changed('status');
    }
  }

  ref(...path) { return this.fs.doc(this.db, ...path); }

  // ---------- Google 계정 · 서버 저장 (v265) ----------
  //
  // 익명 계정에 Google을 '잇는다'(link) — uid가 그대로라 문파·운영자·서열이 그대로 남는다.
  // 그 Google 계정이 이미 다른 uid(다른 기기)에 이어져 있으면 conflict로 알리고, 바꿀지는 화면이 묻는다.
  isGoogle() { return !!this.auth?.currentUser?.providerData?.some((p) => p.providerId === 'google.com'); }
  googleEmail() {
    const u = this.auth?.currentUser;
    return u?.providerData?.find((p) => p.providerId === 'google.com')?.email || u?.email || '';
  }
  // testCred: 에뮬레이터 시험용 id 토큰(JSON 글자) — 주면 팝업 없이 잇는다
  async linkGoogle(testCred) {
    const A = this.authM;
    // v267 Firestore가 막혀 '끊김'이어도 로그인은 된다(인증 서버만 쓴다) — 인증이 아예 없을 때만 막는다
    if (!A || !this.auth?.currentUser) throw Object.assign(new Error('offline'), { code: 'net/offline' });
    try {
      if (testCred) await A.linkWithCredential(this.auth.currentUser, A.GoogleAuthProvider.credential(testCred));
      else {
        const prov = new A.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: 'select_account' });
        await A.linkWithPopup(this.auth.currentUser, prov);
      }
      this.changed('account');
      return { linked: true };
    } catch (err) {
      if (err?.code === 'auth/credential-already-in-use') {
        // 오류에 인증 정보가 안 실려 오기도 한다(에뮬레이터·일부 브라우저) — 그땐 바꿀 때 Google 창을 한 번 더 연다
        const cred = A.GoogleAuthProvider.credentialFromError(err) || (testCred ? A.GoogleAuthProvider.credential(testCred) : null);
        return { conflict: true, cred, email: err.customData?.email || '' };
      }
      throw err;
    }
  }
  // 이미 다른 진행에 이어진 Google 계정으로 바꾼다. 버리는 익명 계정은 서열에서 내린다(world 0 — 서열은 world 1만 센다).
  async switchAccount(cred) {
    const A = this.authM;
    // 인증 정보가 없으면 Google 창을 다시 연다 — 누른 바로 그 순간에 열어야 팝업이 안 막혀서, 다른 일보다 먼저 연다
    let popup = null;
    if (!cred) {
      const prov = new A.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      popup = A.signInWithPopup(this.auth, prov);
    }
    const demote = this.fs.setDoc(this.ref('players', this.uid),
      { nickname: String(this.game.s.nickname || '이름없음').slice(0, 12), world: 0 }, { merge: true }).catch(() => {});
    let r;
    if (cred) { await demote; r = await A.signInWithCredential(this.auth, cred); } else { r = await popup; await demote; }
    this.uid = r.user.uid;
    this.changed('account');
    return this.fetchSave();
  }
  // 이 기기에서 로그아웃 — 다음 실행 때 새 익명 계정으로 시작한다(로그인 화면이 뜬다)
  async signOut() {
    if (this.authM && this.auth) await this.authM.signOut(this.auth);
    this.uid = null;
    this.status = 'offline';
  }
  async fetchSave() {
    try {
      const snap = await this.fs.getDoc(this.ref('saves', this.uid));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      if (err?.code === 'permission-denied') this.savesDenied = true;
      throw err;
    }
  }
  // v328 쉬는 캐릭터(칸 0~3) — saves/{uid}/chars/{칸}. 지금 하는 캐릭터는 saves/{uid} 그대로
  async fetchChars() {
    if (!this.online || this.blocked || !this.uid) return [];
    const snap = await this.fs.getDocs(this.fs.collection(this.db, 'saves', this.uid, 'chars'));
    return snap.docs.map((d) => ({ slot: Number(d.id), ...d.data() })).filter((c) => Number.isInteger(c.slot) && c.slot >= 0 && c.slot < 4 && typeof c.data === 'string');
  }
  async pushChar(slot, json) {
    if (!this.online || this.blocked || !this.uid || !(slot >= 0 && slot < 4)) return false;
    let o = {};
    try { o = JSON.parse(json); } catch { return false; }
    const at = Date.now();
    await this.fs.setDoc(this.ref('saves', this.uid, 'chars', String(slot)), {
      data: json, at, lv: Math.floor(Number(o.level) || 0), n: String(o.nickname || '').slice(0, 16), job: String(o.job || '').slice(0, 16),
    });
    return at;
  }
  async deleteChar(slot) {
    if (!this.online || this.blocked || !this.uid) return false;
    await this.fs.deleteDoc(this.ref('saves', this.uid, 'chars', String(slot)));
    return true;
  }
  // 인증은 됐다(로그인 가능) — Firestore가 막혀 '끊김'인 것과 가른다
  authed() { return !!(this.authM && this.auth?.currentUser); }
  async pushSave(json, dev, build, slot = 0) {
    if (!this.online || this.blocked || !this.uid) return false;
    const at = Date.now();
    try {
      await this.fs.setDoc(this.ref('saves', this.uid), {
        data: json, at, dev: String(dev || ''), lv: Math.floor(Number(this.game.s.level) || 0), build: String(build || ''), slot: Math.max(0, Math.min(3, slot | 0)),
      });
    } catch (err) {
      if (err?.code === 'permission-denied') this.savesDenied = true;
      throw err;
    }
    this.savesDenied = false;
    return at;
  }

  // Realtime Database (v138 함께 사냥) — 쓸 때 처음 한 번만 불러온다. 못 쓰면 null(혼자 사냥 그대로).
  async rtdb() {
    if (this._rt !== undefined) return this._rt;
    if (!this.online || !this.app) return null;
    try {
      const m = await import(`${CDN}/firebase-database.js`);
      const emu = new URLSearchParams(location.search).get('emu');
      const db = m.getDatabase(this.app);
      if (emu) m.connectDatabaseEmulator(db, emu === '1' ? '127.0.0.1' : emu, 9000);
      this._rt = { m, db };
    } catch (err) {
      console.warn('[net] rtdb', err?.message || err);
      this._rt = null;
    }
    return this._rt;
  }

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
      if (!this.denied(err, '광고 제거 확인(entitlements)')) console.warn('[net] entitlement', err);
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
      if (!this.denied(err, '상점 정보(config/shop)')) console.warn('[net] shop', err);
    }
  }

  // v309 게시된 규칙 판 확인 — rulesv/{RULES_VER} 읽기가 거부되면 옛 규칙이다.
  //   **denied()를 부르지 않는다** — 그건 서버를 끊는다. 여기서는 표시만 하고 다른 일은 그대로 한다.
  async checkRules() {
    if (!this.online || this.blocked) return this.rulesOk;
    try { await this.fs.getDoc(this.ref('rulesv', RULES_VER)); this.rulesOk = true; }
    catch (err) {
      const code = err?.code || '', msg = String(err?.message || err);
      this.rulesOk = code === 'permission-denied' || msg.includes('insufficient permissions') ? false : this.rulesOk;
    }
    this.changed('rules');
    return this.rulesOk;
  }

  // v308 숨긴 무인 목록 — 운영자가 '무인 정리'로 지우면 여기에 적힌다. 서열(ranking)에서 거르고, 그 계정은 자기 기록을 다시 올리지 않는다.
  async loadHidden() {
    if (!this.online || this.blocked) return;
    try {
      const snap = await this.fs.getDoc(this.ref('config', 'hidden'));
      this.hidden = snap.exists() && Array.isArray(snap.data().uids) ? snap.data().uids.filter((u) => typeof u === 'string') : [];
    } catch (err) { if (!this.denied(err, '숨김 목록(config/hidden)')) console.warn('[net] hidden', err); }
  }
  isHidden(uid) { return this.hidden.includes(uid); }
  async setHidden(uid, on) {
    if (!this.isAdmin() || !uid) return false;
    try {
      const { setDoc, arrayUnion, arrayRemove } = this.fs;
      await setDoc(this.ref('config', 'hidden'), { uids: on ? arrayUnion(uid) : arrayRemove(uid) }, { merge: true });
      this.hidden = on ? [...new Set([...this.hidden, uid])] : this.hidden.filter((u) => u !== uid);
      return true;
    } catch (err) { console.warn('[net] setHidden', err); return false; }
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

  // ---------- 운영자 · 무인 정리 (v282) ----------
  // 서열 문서(players)만 지운다. 로그인 계정(Authentication) 자체는 웹 앱에서 지울 수 없다 — 콘솔에서.
  // 지운 무인이 다시 들어오면 서열에 다시 올라온다(진행은 그 기기에 그대로 있다).
  async allPlayers(n = 300) {
    if (!this.isAdmin()) return [];
    try {
      const snap = await this.fs.getDocs(this.fs.query(this.fs.collection(this.db, 'players'), this.fs.limit(n)));
      const rows = [];
      snap.forEach((d) => rows.push({ uid: d.id, ...d.data(), hidden: this.isHidden(d.id) }));
      return rows;
    } catch (err) { console.warn('[net] allPlayers', err); return []; }
  }
  async deletePlayer(uid) {
    if (!this.isAdmin() || !uid || uid === this.uid) return false;
    try {
      await this.fs.deleteDoc(this.ref('players', uid));
      await this.setHidden(uid, true);   // v308 그 계정이 다시 들어와 올려도 서열에 안 보이게
      return true;
    } catch (err) { console.warn('[net] deletePlayer', err); return false; }
  }

  // ---------- 운영자 선물 (v175) ----------
  // 운영자가 gifts/{uid}/box/{id}에 은자를 넣어 두면, 그 무인이 들어올 때 받는다(받으면 문서를 지운다 —
  // 지우기에 성공한 것만 준다. 그래야 두 번 받지 않는다). 규칙: 넣기는 운영자만, 읽기·지우기는 본인·운영자.
  // 우편함 (v175) — 무인마다 gifts/{uid}/box. 운영자가 넣고, 무인이 우편함에서 '받기'를 누르면 받는다.
  // gift: { gold?, potions?, prot?, pet?: '종류:등급', mount?: '종류' } — 있는 것만 싣는다
  async sendGift(uid, gift, memo = '') {
    if (!this.isAdmin() || !uid) return false;
    const doc = { memo: String(memo).slice(0, 60), at: Date.now() };
    for (const k of ['gold', 'potions', 'prot']) if (Math.floor(gift?.[k] || 0) > 0) doc[k] = Math.floor(gift[k]);
    if (gift?.pet) doc.pet = String(gift.pet).slice(0, 20);
    if (gift?.mount) doc.mount = String(gift.mount).slice(0, 20);
    if (gift?.title) doc.title = String(gift.title).slice(0, 20);   // v305 칭호
    if (!doc.gold && !doc.potions && !doc.prot && !doc.pet && !doc.mount && !doc.title) return false;
    try {
      await this.fs.setDoc(this.ref('gifts', uid, 'box', `g${Date.now()}`), doc);
      return true;
    } catch (err) { console.warn('[net] sendGift', err); return false; }
  }
  // 우편함 보기 — [{ id, gold, potions, prot, memo, at }]
  async listGifts() {
    if (!this.uid || !this.online) return [];
    try {
      const snap = await this.fs.getDocs(this.fs.collection(this.db, 'gifts', this.uid, 'box'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at || 0) - (b.at || 0));
    } catch (err) { if (!this.denied(err, '우편함(gifts)')) console.warn('[net] listGifts', err); return []; }
  }
  // v323 우편함 지켜보기 — 1분마다 읽지 않고 서버가 밀어 준다. 처음 한 번은 '있는 것', 그 뒤 added는 '새로 온 것'
  watchGifts(onChange) {
    if (!this.online || !this.uid || this.giftUnsub) return false;
    const { onSnapshot, collection } = this.fs;
    let first = true;
    this.giftUnsub = onSnapshot(collection(this.db, 'gifts', this.uid, 'box'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at || 0) - (b.at || 0));
      const fresh = first || snap.metadata.hasPendingWrites ? 0 : snap.docChanges().filter((c) => c.type === 'added').length;
      first = false;
      onChange(list, fresh);
    }, (err) => { console.warn('[net] gifts watch', err?.message || err); this.giftUnsub = null; });
    return true;
  }
  unwatchGifts() { try { this.giftUnsub?.(); } catch { /* */ } this.giftUnsub = null; }
  // 받기 — 지우기에 성공한 것만 돌려준다(두 번 받지 않게)
  // v254: 읽기와 지우기를 한 거래로 — 전엔 '받기'와 '모두 받기'(또는 두 탭)가 동시에 읽고 둘 다 지워 같은 선물을 두 번 받았다
  async claimGift(id) {
    if (!this.uid) return null;
    const r = this.ref('gifts', this.uid, 'box', id);
    try {
      return await this.fs.runTransaction(this.db, async (tx) => {
        const snap = await tx.get(r);
        if (!snap.exists()) return null;
        tx.delete(r);
        return snap.data();
      });
    } catch (err) { console.warn('[net] claimGift', err); return null; }
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
  denied(err, where = '') {
    const code = err?.code || '';
    const msg = String(err?.message || err);
    if (code !== 'permission-denied' && !msg.includes('insufficient permissions')) return false;
    // v267 무엇이 막혔는지 남긴다 — 로그인 화면·설정에 그대로 보인다
    if (!this.deniedAt) this.deniedAt = where || '알 수 없는 곳';
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
    if (this.isHidden(this.uid)) return;   // v308 운영자가 숨긴 계정은 자기 기록을 올리지 않는다
    const now = Date.now();
    if (!force && now - this.lastProfile < PROFILE_INTERVAL) return;
    this.lastProfile = now;
    try {
      await this.fs.setDoc(this.ref('players', this.uid), this.profileData(), { merge: true });
    } catch (err) {
      if (!this.denied(err, '내 기록 쓰기(players)')) console.warn('[net] profile', err);
    }
  }

  async ranking() {
    const { collection, query, orderBy, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'players'), orderBy('power', 'desc'), limit(50)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => !this.isHidden(p.uid));   // v308 숨긴 무인은 뺀다
  }

  // ---------- v316 주간 두목 순위 — wboss/{주}/p/{uid} ----------
  // 1분에 한 번(새 최단 기록이면 바로). 규칙: 처치 수는 줄지 않고 최단 초는 늘지 않는다 → 다른 기기와 어긋나 거부되면 서버 값과 합쳐 한 번 다시
  async pushWeekBoss(force = false) {
    if (!this.online || this.blocked || !this.game.s.nickname || this.isHidden(this.uid)) return false;
    const g = this.game;
    const w = g.wbossState();
    if (!w.kills) return false;
    const now = Date.now();
    if (!force && !g._wbBest && now - (this.wbAt || 0) < 60000) return false;
    const sig = `${w.key}|${w.kills}|${w.best.hwamugi || ''}|${w.best.magwi || ''}|${g.s.title || ''}`;
    if (sig === this.wbSig) { g._wbBest = false; return false; }
    this.wbAt = now;
    const ref = this.ref('wboss', w.key, 'p', this.uid);
    const body = () => {
      const d = { name: String(g.s.nickname).slice(0, 12), kills: w.kills, lv: g.s.level, at: this.fs.serverTimestamp() };
      if (g.s.title) d.title = String(g.s.title).slice(0, 16);
      for (const k of ['hwamugi', 'magwi']) if (w.best[k] > 0) d[k] = w.best[k];
      return d;
    };
    try {
      await this.fs.setDoc(ref, body(), { merge: true });
    } catch (err) {
      // 다른 기기가 더 많이·더 빨리 올렸다 — 서버 값과 합쳐 다시(denied를 부르지 않는다: 서버를 끊는다)
      try {
        const cur = await this.fs.getDoc(ref);
        if (cur.exists()) {
          const c = cur.data();
          w.kills = Math.max(w.kills, Math.floor(c.kills || 0));
          for (const k of ['hwamugi', 'magwi']) if (c[k] > 0 && !(w.best[k] > 0 && w.best[k] <= c[k])) w.best[k] = c[k];
        }
        await this.fs.setDoc(ref, body(), { merge: true });
      } catch (err2) { console.warn('[net] week boss', err2?.message || err2); return false; }
    }
    this.wbSig = sig;
    g._wbBest = false;
    return true;
  }
  // v318 지난주 순위 — 세 순위표에서 내 자리(1~3만 · 없으면 null). 이미 받았으면 null(다시 읽지 않는다)
  async lastWeekRanks() {
    if (!this.online || this.blocked || this.isHidden(this.uid)) return null;
    const { weekKey } = await import('./world/wtoday.js');
    const key = weekKey(Date.now() - 7 * 86400e3);
    if (this.game.s.wbClaimed === key) return null;
    const b = await this.weekBossBoard(key);
    const at = (rows, f) => { const i = rows.filter((p) => f(p)).slice(0, 3).findIndex((p) => p.uid === this.uid); return i >= 0 ? i + 1 : null; };
    const ranks = { kills: at(b.kills, (p) => p.kills > 0), hwamugi: at(b.hwamugi, (p) => p.hwamugi > 0), magwi: at(b.magwi, (p) => p.magwi > 0) };
    return { key, ranks };
  }
  async weekBossBoard(key) {
    const { collection, query, orderBy, limit, getDocs } = this.fs;
    const col = collection(this.db, 'wboss', key, 'p');
    const rows = (snap) => snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => !this.isHidden(p.uid));
    const [kills, hwamugi, magwi] = await Promise.all([
      getDocs(query(col, orderBy('kills', 'desc'), limit(20))).then(rows),
      getDocs(query(col, orderBy('hwamugi', 'asc'), limit(10))).then(rows),
      getDocs(query(col, orderBy('magwi', 'asc'), limit(10))).then(rows),
    ]);
    return { kills, hwamugi, magwi };
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

  // v339 문파 찾기 — 공개 목록 guildlist/{코드}: 이름·인원·경험치·모집 중(open). 문파원이 문파가 바뀔 때 고쳐 둔다.
  //   문파 문서(guilds)는 코드를 알아야 읽히므로(list 막힘) 찾기는 이 목록으로. 모집을 닫으면(open false) 목록에 안 보인다(문주만).
  async publishGuild() {
    const g = this.guild;
    if (!g || !this.online || this.blocked) return;
    const sig = `${g.name}|${g.memberIds.length}|${Math.floor((g.exp || 0) / 50)}`;
    if (this._pubSig === sig) return;
    this._pubSig = sig;
    try {
      await this.fs.setDoc(this.ref('guildlist', g.id), { name: g.name, n: g.memberIds.length, exp: g.exp || 0, at: this.fs.serverTimestamp() }, { merge: true });
    } catch (err) { console.warn('[net] guildlist', err?.code || err); }
  }
  async setGuildOpen(open) {
    const g = this.guild;
    if (!g || g.owner !== this.uid) return false;
    await this.fs.setDoc(this.ref('guildlist', g.id), { name: g.name, n: g.memberIds.length, exp: g.exp || 0, open: !!open, at: this.fs.serverTimestamp() }, { merge: true });
    return true;
  }
  async guildOpen(gid) {
    try { const d = await this.fs.getDoc(this.ref('guildlist', gid)); return d.exists() ? d.data().open !== false : true; } catch { return true; }
  }
  // v345 문파 소개(40자)·가입 레벨 — 문주만
  async guildInfo(gid) {
    try { const d = await this.fs.getDoc(this.ref('guildlist', gid)); return d.exists() ? { intro: d.data().intro || '', minLv: d.data().minLv || 0, open: d.data().open !== false } : { intro: '', minLv: 0, open: true }; } catch { return { intro: '', minLv: 0, open: true }; }
  }
  async setGuildInfo(intro, minLv) {
    const g = this.guild;
    if (!g || g.owner !== this.uid) return false;
    await this.fs.setDoc(this.ref('guildlist', g.id), { name: g.name, n: g.memberIds.length, exp: g.exp || 0, intro: String(intro || '').slice(0, 40), minLv: Math.max(0, Math.min(200, Math.floor(Number(minLv) || 0))), at: this.fs.serverTimestamp() }, { merge: true });
    return true;
  }
  async listGuilds() {
    const { getDocs, query, collection, orderBy, limit } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'guildlist'), orderBy('at', 'desc'), limit(60)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.open !== false && (g.n || 0) < GUILD_MAX && (g.n || 0) > 0);
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
      this.publishGuild();
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

  // ---------- v302 전체 채팅 ----------
  watchWorld() {
    if (!this.online || this.worldUnsub) return;
    const { onSnapshot, collection, query, orderBy, limit } = this.fs;
    this.worldUnsub = onSnapshot(
      query(collection(this.db, 'chat'), orderBy('createdAt', 'desc'), limit(80)),
      (snap) => {
        this.world = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse();
        this.changed('wchat');
      },
      (err) => console.warn('[net] world chat', err),
    );
  }
  worldUnread() { return Math.max(0, this.world.filter((m) => m.uid !== this.uid).length - this.worldSeen); }
  worldMarkSeen() { this.worldSeen = this.world.filter((m) => m.uid !== this.uid).length; }
  // v315 한 말은 100자 · 2초에 하나(서버 규칙도 chatlimit/{uid}로 막는다) · 같은 말을 30초 안에 거듭 못 한다 · 낀 칭호를 같이 싣는다
  async sendWorld(text, type = 'chat', retry = true) {
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, type === 'chat' ? WORLD_MAX : 200);
    if (!clean || !this.online) return false;
    const now = Date.now();
    if (type === 'chat' && retry) {
      if (now - (this.worldChatAt || 0) < 2000) throw new Error('너무 빨라요 — 잠깐 뒤에 보내 주세요');
      if (this.worldLast && this.worldLast.text === clean && now - this.worldLast.at < 30000) throw new Error('같은 말을 거듭 보내지 않아요 — 조금 뒤에');
      this.worldChatAt = now;
    }
    // 서버 막이(2초)는 소식(system)과 내 말을 함께 센다 — 앞 것에서 2초가 안 지났으면 남은 만큼 기다렸다 보낸다(내 말이 소식에 막히지 않게)
    const gap = 2100 - (Date.now() - (this.worldAt || 0));
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    this.worldAt = Date.now();
    const name = String(this.game.s.nickname || '무명').slice(0, 12);
    const { writeBatch, doc, collection, serverTimestamp } = this.fs;
    // 옛 규칙이 게시돼 있으면(rulesOk false) 옛 모양으로 — 새 규칙이 올라가는 사이에도 말이 막히지 않게
    if (this.rulesOk === false) {
      await this.fs.addDoc(collection(this.db, 'chat'), { uid: this.uid, name, text: clean, type, createdAt: serverTimestamp() });
    } else {
      const msg = { uid: this.uid, name, text: clean, type, createdAt: serverTimestamp() };
      const t = this.game.s.title;
      if (t && typeof t === 'string' && t.length <= 16) msg.title = t;
      try {
        const b = writeBatch(this.db);
        b.set(doc(collection(this.db, 'chat')), msg);
        b.set(this.ref('chatlimit', this.uid), { at: serverTimestamp() });
        await b.commit();
      } catch (err) {
        // v321 입막음이면 다시 보내지 않는다
        if (await this.checkMute()) { const left = this.muteUntil - Date.now(); throw new Error(left > 1e11 ? '운영자가 입을 막았어요 — 전체 채팅을 쓸 수 없어요' : `운영자가 입을 막았어요 — ${Math.ceil(left / 60000)}분 뒤에 말할 수 있어요`); }
        // 2초 막이에 걸렸다(다른 기기와 겹침) — 한 번만 조금 뒤에 다시
        if (retry) { await new Promise((r) => setTimeout(r, 2300)); return this.sendWorld(text, type, false); }
        throw new Error(type === 'chat' ? '너무 빨라요 — 잠깐 뒤에 보내 주세요' : (err?.message || '보내지 못했어요'));
      }
    }
    if (type === 'chat') this.worldLast = { text: clean, at: Date.now() };
    return true;
  }
  async deleteWorld(id) { await this.fs.deleteDoc(this.ref('chat', id)); }
  // ---------- v321 신고 · 입막음 ----------
  async report(m) {
    if (!this.online || !m?.uid || m.uid === this.uid) return false;
    this.reported = this.reported || new Set();
    if (this.reported.has(m.id)) return 'dup';
    await this.fs.addDoc(this.fs.collection(this.db, 'reports'), {
      by: this.uid, uid: String(m.uid).slice(0, 128), name: String(m.name || '무명').slice(0, 12), text: String(m.text || '').slice(0, 200), mid: String(m.id || '').slice(0, 64), at: this.fs.serverTimestamp(),
    });
    this.reported.add(m.id);
    return true;
  }
  async reports() {
    if (!this.isAdmin()) return [];
    const { collection, query, orderBy, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'reports'), orderBy('at', 'desc'), limit(60)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async dropReport(id) { if (this.isAdmin()) await this.fs.deleteDoc(this.ref('reports', id)); }
  // ms: 막을 시간(밀리초) · Infinity면 영구
  async mute(uid, name, ms, reason = '') {
    if (!this.isAdmin() || !uid || uid === this.uid) return false;
    const until = this.fs.Timestamp.fromMillis(Number.isFinite(ms) ? Date.now() + ms : 253402300799000);
    await this.fs.setDoc(this.ref('mutes', uid), { until, by: this.uid, reason: String(reason).slice(0, 60), name: String(name || '').slice(0, 12) });
    return true;
  }
  async unmute(uid) { if (this.isAdmin()) await this.fs.deleteDoc(this.ref('mutes', uid)); }
  // 내가 막혔나 — 막힌 끝 시각(ms) · 안 막혔으면 0
  async checkMute() {
    if (!this.online) return this.muteUntil || 0;
    try {
      const d = await this.fs.getDoc(this.ref('mutes', this.uid));
      const u = d.exists() ? d.data().until?.toMillis?.() || 0 : 0;
      this.muteUntil = u > Date.now() ? u : 0;
    } catch { /* 못 읽으면 그대로 */ }
    return this.muteUntil || 0;
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
