// v476 서열 점검 — GitHub Actions(.github/workflows/rank-check.yml)에서 서비스 계정으로 돈다(여섯 시간마다 · 손으로도).
// 기기가 올린 서열 값을 서버 쪽 사실과 견준다(기준은 tools/rankrules.mjs):
//   · 계정 만든 때(Authentication) — 그 나이에 닿을 수 없는 레벨
//   · 같은 레벨 기준 무인(tools/mobsim.mjs make) — 그 몇 배를 넘는 전투력
//   · 서버 세이브(saves/{uid}) — 게임 엔진으로 다시 센 레벨·전투력과 크게 다른 서열 값
//   · 주간 두목(wboss/{주}/p) — 이번 주에 잡을 수 없는 수
// 걸리면 flags/{uid}에 까닭을 적고 config/hidden에 올려 서열에서만 숨긴다(게임은 그대로).
//   운영자가 「무인 정리 → 되살리기」로 풀면 flags/{uid}.ok = true — 다시 숨기지 않는다.
// 저장소가 공개라 로그는 누구나 본다 — 로그에는 건수만 찍는다(별호·계정 번호·까닭은 찍지 않는다).
//   APPLY: note(기본 · flags에 까닭만 적는다 — 운영자가 「무인 정리」에서 보고 고른다) · yes(적고 숨긴다) · no(건수만 센다).
import { pathToFileURL } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const REPO = process.env.REPO || process.cwd();
const R = (p) => pathToFileURL(`${REPO}/${p}`).href;
const { WorldGame, migrateWorld } = await import(R('js/world/wgame.js'));
const { make } = await import(R('tools/mobsim.mjs'));
const TD = await import(R('js/world/wtoday.js'));
const W = await import(R('js/world/wdata.js'));
const K = await import(R('tools/rankrules.mjs'));

const TOP = Math.max(10, Math.min(300, Number(process.env.TOP) || 100));
const MODE = ['no', 'note', 'yes'].includes(process.env.APPLY) ? process.env.APPLY : 'note';

initializeApp({ credential: applicationDefault(), projectId: 'idle-69772' });
const db = getFirestore();
const auth = getAuth();
const now = Date.now();
const ms = (t) => (t?.toMillis ? t.toMillis() : Number(t) || null);

const refCache = new Map();
const refPower = (lv) => {
  const L = Math.max(1, Math.min(W.LEVEL_MAX, Math.floor(lv) || 1));   // 만렙 위로는 기준 무인을 못 만든다(끝없이 돈다)
  if (!refCache.has(L)) { try { refCache.set(L, make(L).stats().power); } catch { refCache.set(L, null); } }
  return refCache.get(L);
};
const ageH = async (uid) => {
  try { const u = await auth.getUser(uid); return (now - Date.parse(u.metadata.creationTime)) / 3600e3; } catch { return null; }
};
const fromSave = async (uid) => {
  try {
    const s = await db.doc(`saves/${uid}`).get();
    if (!s.exists) return null;
    const d = s.data();
    const g = new WorldGame(migrateWorld(JSON.parse(d.data), now), now);
    return { lv: g.s.level, power: g.stats().power, at: Number(d.at) || 0 };
  } catch { return null; }
};

const [hiddenSnap, flagSnap] = await Promise.all([db.doc('config/hidden').get(), db.collection('flags').get()]);
const hidden = new Set(hiddenSnap.exists ? hiddenSnap.data().uids || [] : []);
const flags = new Map(flagSnap.docs.map((d) => [d.id, d.data()]));
const skip = (uid) => hidden.has(uid) || flags.get(uid)?.ok === true;

const found = new Map();   // uid → { why[], lv, power }
const note = (uid, why, extra = {}) => { if (!why.length) return; const o = found.get(uid) || { why: [], ...extra }; o.why.push(...why); found.set(uid, o); };

// 1) 전투력 서열 위쪽
const top = await db.collection('players').orderBy('power', 'desc').limit(TOP).get();
let seen = 0;
for (const d of top.docs) {
  if (skip(d.id)) continue;
  seen++;
  const p = d.data();
  const why = K.judgePlayer({ p, ageH: await ageH(d.id), ref: refPower(p.level), save: await fromSave(d.id), profAt: ms(p.updatedAt), lvMax: W.LEVEL_MAX });
  note(d.id, why, { lv: p.level ?? null, power: p.power ?? null });
}

// 2) 이번 주 주간 두목
const wk = TD.weekKey(now);
const weekSec = (now - Date.parse(`${wk}T00:00:00+09:00`)) / 1000;
const col = db.collection('wboss').doc(wk).collection('p');
const wbDocs = new Map();
for (const q of [col.orderBy('kills', 'desc').limit(30), col.orderBy('hwamugi', 'asc').limit(15), col.orderBy('magwi', 'asc').limit(15)]) {
  try { for (const d of (await q.get()).docs) wbDocs.set(d.id, d.data()); } catch { /* 색인 없음 */ }
}
for (const [uid, r] of wbDocs) { if (skip(uid)) continue; seen++; note(uid, K.judgeWeekBoss({ r, weekSec }), { lv: r.lv ?? null }); }

console.log(`점검 ${seen}건 · 걸림 ${found.size}명 · 이미 숨김/되살림 ${hidden.size + [...flags.values()].filter((f) => f.ok).length}명${{ no: ' (건수만 · 적지 않음)', note: ' (까닭만 적음 · 숨기지 않음)', yes: '' }[MODE]}`);
if (MODE === 'no' || !found.size) process.exit(0);

const batch = db.batch();
for (const [uid, o] of found) {
  batch.set(db.doc(`flags/${uid}`), { why: o.why.slice(0, 10), lv: o.lv ?? null, power: o.power ?? null, wk, auto: true, ok: false, hid: MODE === 'yes', at: FieldValue.serverTimestamp() }, { merge: true });
}
if (MODE === 'yes') batch.set(db.doc('config/hidden'), { uids: FieldValue.arrayUnion(...found.keys()) }, { merge: true });
await batch.commit();
console.log(`${MODE === 'yes' ? '숨김' : '까닭'} ${found.size}명 적음`);
