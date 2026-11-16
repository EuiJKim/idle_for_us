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
