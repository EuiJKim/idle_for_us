// v473 버그 신고 읽기 — GitHub Actions(.github/workflows/read-bugs.yml)에서 서비스 계정으로 돈다.
// 저장소가 공개라 실행 기록(로그)을 누구나 본다 — 그래서 로그에는 **건수만** 평문으로 찍고,
// 신고 내용(글·오류·알림·기기·세이브·화면 사진)은 모두 PUBKEY(받는 쪽이 만든 RSA 공개 키)로 암호화해서만 찍는다.
// PUBKEY가 없으면 아무 내용도 찍지 않는다. 계정 번호(by)는 암호문에도 넣지 않는다.
import crypto from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const N = Math.max(1, Math.min(10, Number(process.env.N) || 3));
const HOURS = Math.max(1, Math.min(24 * 14, Number(process.env.HOURS) || 48));
const PUB = process.env.PUBKEY ? Buffer.from(process.env.PUBKEY, 'base64').toString('utf-8') : '';
const ONLY = process.env.KIND || '';   // 'user' · 'auto' · '' (둘 다)
if (!PUB) { console.log('pubkey가 없어 아무것도 찍지 않아요'); process.exit(0); }

initializeApp({ credential: applicationDefault(), projectId: 'idle-69772' });
const db = getFirestore();
const since = new Date(Date.now() - HOURS * 3600e3);
const snap = await db.collection('bugs').where('at', '>=', since).orderBy('at', 'desc').limit(N * 4).get();
const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !ONLY || r.kind === ONLY).slice(0, N);
console.log(`신고 ${rows.length}건`);

const seal = (obj) => {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), 'utf-8')), c.final()]);
  const ek = crypto.publicEncrypt({ key: PUB, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  return { head: `${ek.toString('base64')}.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}`, data: data.toString('base64') };
};
rows.forEach((r, i) => {
  const tag = `B${i}`;
  const { by, ...rest } = r;   // 계정 번호는 빼고
  void by;
  const s = seal({ ...rest, at: r.at?.toDate ? r.at.toDate().toISOString() : String(r.at) });
  console.log(`SEALHEAD ${tag} ${s.head}`);
  for (let k = 0, j = 0; k < s.data.length; k += 3000, j++) console.log(`SEAL ${tag} ${j} ${s.data.slice(k, k + 3000)}`);
  console.log(`SEALEND ${tag}`);
});
