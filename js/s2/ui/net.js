// v525 새 시즌 계정 · 서버 저장 — 옛 게임과 같은 Firebase 계정(익명 → Google 잇기)을 쓰고, 새 시즌 진행은 saves/{uid}/s2/main 한 곳에.
//   옛 게임의 진행(saves/{uid})과 따로라 섞이지 않는다. 오프라인 · 막힘이면 조용히 기기에만 둔다.
import { firebaseConfig, FIREBASE_SDK_VERSION } from '../../firebase-config.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

export class S2Net {
  constructor(onChange = () => {}) { this.onChange = onChange; this.status = 'idle'; this.uid = null; this.lastPush = 0; this.cloudAt = 0; }
  get online() { return this.status === 'online'; }
  async init() {
    if (this.status !== 'idle') return;
    this.status = 'connecting';
    try {
      const [appM, authM, fs] = await Promise.all([import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)]);
      const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(firebaseConfig);
      this.A = authM; this.fs = fs; this.auth = authM.getAuth(app); this.db = fs.getFirestore(app);
      const emu = new URLSearchParams(location.search).get('emu');
      if (emu) { const h = emu === '1' ? '127.0.0.1' : emu; authM.connectAuthEmulator(this.auth, `http://${h}:9099`, { disableWarnings: true }); fs.connectFirestoreEmulator(this.db, h, 8080); }
      if (this.auth.authStateReady) await this.auth.authStateReady();
      const u = this.auth.currentUser || (await authM.signInAnonymously(this.auth)).user;
      this.uid = u.uid; this.status = 'online';
    } catch (err) { console.warn('[s2net] offline:', err?.message || err); this.status = 'offline'; }
    this.onChange('status');
  }
  ref() { return this.fs.doc(this.db, 'saves', this.uid, 's2', 'main'); }
  isGoogle() { return !!this.auth?.currentUser?.providerData?.some((p) => p.providerId === 'google.com'); }
  email() { const u = this.auth?.currentUser; return u?.providerData?.find((p) => p.providerId === 'google.com')?.email || u?.email || ''; }
  async fetch() {
    if (!this.online) return null;
    const s = await this.fs.getDoc(this.ref());
    const d = s.exists() ? s.data() : null; if (d) this.cloudAt = d.at || 0;
    return d;
  }
  async push(json, lv, job) {
    if (!this.online) return false;
    const at = Date.now();
    await this.fs.setDoc(this.ref(), { data: json, at, lv: Math.max(0, Math.floor(Number(lv) || 0)), job: String(job || '').slice(0, 16) });
    this.lastPush = at; this.cloudAt = at; this.onChange('push');
    return at;
  }
  // v547 서열 — 프로필(s2_players/{uid}) · 월드보스 주간 점수(s2_wboss/{주}/p/{uid}) · 위 몇 명 · 내 등수
  async pushProfile(p) {
    if (!this.online) return false;
    const key = JSON.stringify(p); if (key === this.lastProfile) return false;
    await this.fs.setDoc(this.fs.doc(this.db, 's2_players', this.uid), { ...p, updatedAt: this.fs.serverTimestamp() });
    this.lastProfile = key; return true;
  }
  async pushWboss(wk, name, score) {
    if (!this.online || !(score > 0)) return false;
    const fs = this.fs, ref = fs.doc(this.db, 's2_wboss', wk, 'p', this.uid), sc = Math.min(5000000, Math.round(score));
    await fs.runTransaction(this.db, async (tx) => {
      const s = await tx.get(ref), d = s.exists() ? s.data() : null;
      tx.set(ref, d ? { name, score: d.score + sc, tries: d.tries + 1, best: Math.max(d.best, sc), at: fs.serverTimestamp() } : { name, score: sc, tries: 1, best: sc, at: fs.serverTimestamp() });
    });
    return true;
  }
  async top(kind, wk, n = 50) {
    if (!this.online) return null;
    const fs = this.fs, col = kind === 'wb' ? fs.collection(this.db, 's2_wboss', wk, 'p') : fs.collection(this.db, 's2_players');
    const field = kind === 'wb' ? 'score' : kind;
    const snap = await fs.getDocs(fs.query(col, fs.orderBy(field, 'desc'), fs.limit(n)));
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data(), v: d.data()[field] }));
    let me = rows.findIndex((r) => r.uid === this.uid) + 1, mine = null;
    if (!me) {
      const ms = await fs.getDoc(fs.doc(col, this.uid));
      if (ms.exists()) { mine = ms.data()[field]; const c = await fs.getCountFromServer(fs.query(col, fs.where(field, '>', mine))); me = c.data().count + 1; }
    }
    return { rows, me, mine };
  }
  // v549 문파 — guilds/{코드}(코드를 알아야 읽힘) · guildlist/{코드}(찾기 목록) · 출석(checkins.{uid} = 한국 날짜, 옛 게임과 같은 칸)
  static kstDay(t = Date.now()) { return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  async guildGet(gid) {
    if (!this.online || !gid) return null;
    const s = await this.fs.getDoc(this.fs.doc(this.db, 'guilds', gid));
    return s.exists() ? { id: gid, ...s.data() } : null;
  }
  async guildCreate(name, nick) {
    const fs = this.fs, CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let k = 0; k < 5; k++) {
      const code = Array.from({ length: 6 }, () => CH[Math.floor(Math.random() * CH.length)]).join(''), ref = fs.doc(this.db, 'guilds', code);
      const ok = await fs.runTransaction(this.db, async (tx) => {
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, { name: String(name).slice(0, 16), code, owner: this.uid, memberIds: [this.uid], members: { [this.uid]: nick }, exp: 0, checkins: {}, createdAt: fs.serverTimestamp() });
        return true;
      });
      if (ok) { await this.guildPublish(await this.guildGet(code)); return code; }
    }
    throw new Error('문파 코드를 만들지 못했어요');
  }
  async guildJoin(raw, nick) {
    const fs = this.fs, code = String(raw || '').trim().toUpperCase(), ref = fs.doc(this.db, 'guilds', code);
    await fs.runTransaction(this.db, async (tx) => {
      const s = await tx.get(ref); if (!s.exists()) throw new Error('그런 문파 코드가 없어요');
      const g = s.data(); if (g.memberIds.includes(this.uid)) return;
      if (g.memberIds.length >= 10) throw new Error('문파가 가득 찼어요(10명)');
      tx.update(ref, { memberIds: [...g.memberIds, this.uid], members: { ...g.members, [this.uid]: nick } });
    });
    await this.guildPublish(await this.guildGet(code));
    return code;
  }
  async guildLeave(gid) {
    const fs = this.fs;
    await fs.updateDoc(fs.doc(this.db, 'guilds', gid), { memberIds: fs.arrayRemove(this.uid), [`members.${this.uid}`]: fs.deleteField() });
    const g = await this.guildGet(gid).catch(() => null); if (g && g.memberIds.length) await this.guildPublish(g).catch(() => {});
  }
  async guildCheckin(g) {
    const fs = this.fs, dk = S2Net.kstDay();
    if (g.checkins?.[this.uid] === dk) return false;   // 오늘 이미(옛 게임에서 했어도)
    await fs.updateDoc(fs.doc(this.db, 'guilds', g.id), { exp: fs.increment(20), [`checkins.${this.uid}`]: dk });
    await this.guildPublish({ ...g, exp: (g.exp || 0) + 20 }).catch(() => {});   // v561 찾기 목록 · 문파 서열에도
    return true;
  }
  async guildRename(g, nick) {   // 문파 명단의 내 이름표
    if (g.members?.[this.uid] === nick) return;
    await this.fs.updateDoc(this.fs.doc(this.db, 'guilds', g.id), { [`members.${this.uid}`]: nick });
  }
  async guildPublish(g) {
    if (!g) return;
    await this.fs.setDoc(this.fs.doc(this.db, 'guildlist', g.id), { name: g.name, n: g.memberIds.length, exp: g.exp || 0, at: this.fs.serverTimestamp() }, { merge: true });
  }
  // v561 문파 서열 — 찾기 목록(guildlist)을 경험치 순으로 · 내 문파 등수
  async guildTop(myGid, n = 50) {
    const fs = this.fs, col = fs.collection(this.db, 'guildlist');
    const snap = await fs.getDocs(fs.query(col, fs.orderBy('exp', 'desc'), fs.limit(n)));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => (x.n || 0) > 0);
    let me = myGid ? rows.findIndex((x) => x.id === myGid) + 1 : 0, mine = null;
    if (myGid && !me) { const d = await fs.getDoc(fs.doc(col, myGid)); if (d.exists()) { mine = d.data().exp || 0; me = (await fs.getCountFromServer(fs.query(col, fs.where('exp', '>', mine)))).data().count + 1; } }
    return { rows, me, mine };
  }
  async guildList() {
    const fs = this.fs, snap = await fs.getDocs(fs.query(fs.collection(this.db, 'guildlist'), fs.orderBy('at', 'desc'), fs.limit(60)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.open !== false && (x.n || 0) > 0 && (x.n || 0) < 10);
  }
  // v551 문파 대화 — guilds/{코드}/messages(옛 게임과 같은 대화방) · 최근 30개를 실시간으로
  static cleanText(t) { return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200); }
  async guildSay(gid, nick, text, type = 'chat') {
    const t = S2Net.cleanText(text); if (!t || !this.online) return false;
    await this.fs.addDoc(this.fs.collection(this.db, 'guilds', gid, 'messages'), { uid: this.uid, name: String(nick || '무인').slice(0, 12), text: t, type, createdAt: this.fs.serverTimestamp() });
    return true;
  }
  guildChatQ(gid) { const fs = this.fs; return fs.query(fs.collection(this.db, 'guilds', gid, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(30)); }
  async guildChatGet(gid) { const s = await this.fs.getDocs(this.guildChatQ(gid)); return s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(); }
  guildChatWatch(gid, cb) {
    return this.fs.onSnapshot(this.guildChatQ(gid), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()), (e) => console.warn('[s2net] chat', e?.code || e));
  }
  // v552 문파 수련 — guilds/{코드}/s2/train { data: JSON{ week, pts{uid}, names{uid} }, at } · 내 점수만 고친다
  async gtrainGet(gid, wk) {
    const s = await this.fs.getDoc(this.fs.doc(this.db, 'guilds', gid, 's2', 'train'));
    let T = null; try { T = s.exists() ? JSON.parse(s.data().data) : null; } catch { T = null; }
    return T && T.week === wk ? T : { week: wk, pts: {}, names: {} };
  }
  async gtrainSet(gid, wk, nick, pts) {
    const fs = this.fs, ref = fs.doc(this.db, 'guilds', gid, 's2', 'train');
    return fs.runTransaction(this.db, async (tx) => {
      const s = await tx.get(ref); let T = null; try { T = s.exists() ? JSON.parse(s.data().data) : null; } catch { T = null; }
      if (!T || T.week !== wk) T = { week: wk, pts: {}, names: {} };
      if ((T.pts[this.uid] || 0) >= pts && T.names[this.uid] === nick) return T;   // 바뀐 것 없음
      T.pts[this.uid] = Math.max(T.pts[this.uid] || 0, Math.max(0, Math.min(56, pts | 0))); T.names[this.uid] = String(nick || '무인').slice(0, 12);
      tx.set(ref, { data: JSON.stringify(T), at: fs.serverTimestamp() });
      return T;
    });
  }
  // v550 문파 토벌 — guilds/{코드}/s2/raid { data: JSON{ week, lv, dmg{uid}, names{uid} }, at } · 주가 바뀌면 새로(그 주 첫 사람의 레벨로)
  async graidGet(gid, wk) {
    const s = await this.fs.getDoc(this.fs.doc(this.db, 'guilds', gid, 's2', 'raid'));
    let R = null; try { R = s.exists() ? JSON.parse(s.data().data) : null; } catch { R = null; }
    return R && R.week === wk ? R : { week: wk, lv: 0, dmg: {}, names: {} };
  }
  async graidHit(gid, wk, nick, dmg, lv) {
    const fs = this.fs, ref = fs.doc(this.db, 'guilds', gid, 's2', 'raid');
    return fs.runTransaction(this.db, async (tx) => {
      const s = await tx.get(ref); let R = null; try { R = s.exists() ? JSON.parse(s.data().data) : null; } catch { R = null; }
      if (!R || R.week !== wk) R = { week: wk, lv: Math.max(10, Math.floor(lv / 10) * 10), dmg: {}, names: {} };
      R.dmg[this.uid] = (R.dmg[this.uid] || 0) + Math.max(0, Math.round(dmg)); R.names[this.uid] = String(nick || '무인').slice(0, 12);
      tx.set(ref, { data: JSON.stringify(R), at: fs.serverTimestamp() });
      return R;
    });
  }
  async guildProfiles(ids) {
    const fs = this.fs;
    return Promise.all(ids.map((id) => fs.getDoc(fs.doc(this.db, 's2_players', id)).then((s) => (s.exists() ? { uid: id, ...s.data() } : { uid: id })).catch(() => ({ uid: id }))));
  }
  // v548 대결 — 내 방어 덱(s2_pvp/{uid}) · 점수가 가까운 무인 찾기 · 공격 기록(상대 우편함) · 내 우편함 받기
  async pushDeck(name, deck, score, lv) {
    if (!this.online) return false;
    const key = `${name}|${deck}|${score}|${lv}`; if (key === this.lastDeck) return false;
    await this.fs.setDoc(this.fs.doc(this.db, 's2_pvp', this.uid), { name, deck, score: Math.max(0, Math.min(99999, score | 0)), lv: Math.max(1, Math.min(150, lv | 0)), at: this.fs.serverTimestamp() });
    this.lastDeck = key; return true;
  }
  async pvpFind(score, M = { range: 120, widen: 80, maxTries: 4 }) {
    if (!this.online) return [];
    const fs = this.fs, col = fs.collection(this.db, 's2_pvp');
    for (let k = 0; k < M.maxTries; k++) {
      const r = M.range + M.widen * k;
      const snap = await fs.getDocs(fs.query(col, fs.where('score', '>=', score - r), fs.where('score', '<=', score + r), fs.limit(20)));
      const list = [];
      for (const d of snap.docs) { if (d.id === this.uid) continue; try { const x = d.data(); list.push({ uid: d.id, name: x.name, score: x.score, f: JSON.parse(x.deck) }); } catch { /* 망가진 덱 */ } }
      if (list.length) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list.slice(0, 3); }
    }
    return [];
  }
  async playerCard(uid) {   // v567 무인 정보 — 서열 프로필 + 방어 덱(외형)
    const fs = this.fs, [p, d] = await Promise.all([fs.getDoc(fs.doc(this.db, 's2_players', uid)), fs.getDoc(fs.doc(this.db, 's2_pvp', uid))]);
    if (!p.exists()) return null;
    let lk = null; try { lk = d.exists() ? JSON.parse(d.data().deck).lk || null : null; } catch { lk = null; }
    return { uid, ...p.data(), lk, pvp: d.exists() ? d.data().score : null };
  }
  async pvpDeckOf(uid) {   // v563 복수 — 그 무인의 방어 덱
    const d = await this.fs.getDoc(this.fs.doc(this.db, 's2_pvp', uid)); if (!d.exists()) return null;
    const x = d.data(); try { return { uid, name: x.name, score: x.score, f: JSON.parse(x.deck) }; } catch { return null; }
  }
  async pvpLog(oppUid, rec) {
    if (!this.online || !oppUid || oppUid === this.uid) return false;
    await this.fs.addDoc(this.fs.collection(this.db, 's2_pvp', oppUid, 'log'), { by: this.uid, name: String(rec.name || '무인').slice(0, 12), win: !!rec.win, d: rec.d | 0, seed: rec.seed | 0, at: this.fs.serverTimestamp() });
    return true;
  }
  async pvpInbox() {
    if (!this.online) return [];
    const fs = this.fs, snap = await fs.getDocs(fs.collection(this.db, 's2_pvp', this.uid, 'log'));
    const list = snap.docs.map((d) => d.data());
    await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
    return list;
  }
  // Google 잇기 — uid가 그대로라 지금 진행이 그 계정에 붙는다. 그 Google이 이미 다른 진행에 이어져 있으면 conflict
  async linkGoogle(testCred) {
    const A = this.A;
    if (!A || !this.auth?.currentUser) throw new Error('인터넷에 연결되면 다시 눌러 주세요');
    try {
      if (testCred) await A.linkWithCredential(this.auth.currentUser, A.GoogleAuthProvider.credential(testCred));
      else { const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await A.linkWithPopup(this.auth.currentUser, p); }
      this.onChange('account'); return { linked: true };
    } catch (err) {
      if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/email-already-in-use') {
        // 오류에 인증 정보가 안 실려 오기도 한다(에뮬레이터 · 일부 브라우저) — 그땐 바꿀 때 Google 창을 한 번 더 연다
        const cred = A.GoogleAuthProvider.credentialFromError(err) || (testCred ? A.GoogleAuthProvider.credential(testCred) : null);
        return { conflict: true, cred, email: err.customData?.email || '' };
      }
      throw err;
    }
  }
  // 이미 이어진 Google 계정으로 들어가 그 계정의 새 시즌 진행을 받아 온다
  async switchTo(cred) {
    const A = this.A;
    let r;
    if (cred) r = await A.signInWithCredential(this.auth, cred);
    else { const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); r = await A.signInWithPopup(this.auth, p); }
    this.uid = r.user.uid; this.onChange('account');
    return this.fetch();
  }
}
