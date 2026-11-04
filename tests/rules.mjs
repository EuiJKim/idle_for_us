// v268 규칙 공격 시험 — "규칙을 다 아는 사람"이 할 만한 짓이 막히는지 본다 (Firestore 에뮬레이터 필요)
//   NO_PROXY=127.0.0.1,localhost FIREBASE_PKG=/path/to/node_modules/firebase node tests/rules.mjs
// 규칙은 숨길 수 없다(공개 저장소 · 브라우저에서 다 보인다). 그래서 알아도 못 뚫게 짜고, 여기서 그걸 확인한다.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const PKG = process.env.FIREBASE_PKG;
if (!PKG) { console.log('FIREBASE_PKG가 없어 건너뜀'); process.exit(0); }
const req = createRequire(path.join(PKG, '..', 'x.js'));
const { initializeApp } = req('firebase/app');
const A = req('firebase/auth');
const F = req('firebase/firestore');
F.setLogLevel('silent');

const PROJECT = 'idle-69772';
let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗ !!'} ${m}`); if (!c) fails++; };
const denied = async (p) => { try { await p; return false; } catch (e) { return e?.code === 'permission-denied'; } };
const allowed = async (p) => { try { await p; return true; } catch (e) { console.log('    (거부됨)', e?.code, e?.message?.slice(0, 120)); return false; } };

let n = 0;
async function user() {
  const app = initializeApp({ apiKey: 'fake', projectId: PROJECT, authDomain: 'x' }, `u${n++}`);
  const auth = A.getAuth(app);
  A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = F.getFirestore(app);
  F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user: u } = await A.signInAnonymously(auth);
  return { uid: u.uid, db, ref: (...p) => F.doc(db, ...p) };
}
const profile = (extra = {}) => ({ world: 1, nickname: '무인', level: 10, job: 'sword', jobTier: 1, tierName: '검사', map: 11, mapName: '죽림 1',
  power: 1000, atk: 50, hp: 400, weaponGrade: -1, titles: [], raidDps: 100, guildName: null, updatedAt: F.serverTimestamp(), ...extra });

(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const boss = await user();      // 문주
  const friend = await user();    // 문파원
  const bad = await user();       // 나쁜 사람(규칙을 다 안다)

  console.log('# 프로필(서열)');
  ok(await allowed(F.setDoc(boss.ref('players', boss.uid), profile(), { merge: true })), '정상 프로필은 올라간다');
  ok(await denied(F.setDoc(bad.ref('players', bad.uid), profile({ hack: 'x'.repeat(5000) }))), '정해지지 않은 칸(큰 값) 거부');
  ok(await denied(F.setDoc(bad.ref('players', bad.uid), profile({ nickname: '가'.repeat(30) }))), '긴 이름 거부');
  ok(await denied(F.setDoc(bad.ref('players', bad.uid), profile({ level: 9999 }))), '말도 안 되는 레벨 거부');
  ok(await denied(F.setDoc(bad.ref('players', bad.uid), profile({ titles: Array(100).fill('왕') }))), '칭호 100개 거부');
  ok(await denied(F.setDoc(bad.ref('players', boss.uid), profile({ nickname: '바보' }), { merge: true })), '남의 프로필 고치기 거부');
  ok(await denied(F.deleteDoc(bad.ref('players', boss.uid))), '남의 프로필 지우기 거부');

  console.log('# 운영자 · 무인 정리 (v282)');
  {
    // 에뮬레이터는 서명 없는 사용자 지정 토큰을 받는다 — 운영자 uid로 들어간다
    const ADMIN = fs.readFileSync(new URL('../js/firebase-config.js', import.meta.url), 'utf8').match(/ADMIN_UID = '([^']+)'/)[1];
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const tok = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, iss: 'x@x', sub: 'x@x', uid: ADMIN })}.`;
    const app = initializeApp({ apiKey: 'fake', projectId: PROJECT, authDomain: 'x' }, 'admin');
    const auth = A.getAuth(app);
    A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const adb = F.getFirestore(app);
    F.connectFirestoreEmulator(adb, '127.0.0.1', 8080);
    const { user: au } = await A.signInWithCustomToken(auth, tok);
    ok(au.uid === ADMIN, '운영자로 들어감');
    const victim = await user();
    ok(await allowed(F.setDoc(victim.ref('players', victim.uid), profile(), { merge: true })), '(테스트 계정 서열 문서)');
    ok(await denied(F.deleteDoc(friend.ref('players', victim.uid))), '운영자 아니면 남의 서열 지우기 거부');
    ok(await allowed(F.deleteDoc(F.doc(adb, 'players', victim.uid))), '운영자는 서열 문서를 지운다');
    ok(!(await F.getDoc(victim.ref('players', victim.uid))).exists(), '지워졌다');

    console.log('# 규칙 판 (v309 · v315)');
    const RV = fs.readFileSync(new URL('../js/net.js', import.meta.url), 'utf8').match(/RULES_VER = '(\d+)'/)[1];
    ok(await allowed(F.getDoc(friend.ref('rulesv', RV))), `앱의 판(v${RV})이 게시된 규칙과 맞는다`);
    ok(await denied(F.getDoc(friend.ref('rulesv', String(+RV - 1)))), '옛 판 번호는 거부 — 앱이 옛 규칙을 알아챈다');

    console.log('# 숨김 목록 (v308)');
    ok(await allowed(F.setDoc(F.doc(adb, 'config', 'hidden'), { uids: F.arrayUnion(victim.uid) }, { merge: true })), '운영자가 숨김 목록에 올린다');
    ok(await allowed(F.getDoc(friend.ref('config', 'hidden'))), '누구나 숨김 목록을 읽는다(서열에서 거르려고)');
    ok(await denied(F.setDoc(friend.ref('config', 'hidden'), { uids: F.arrayRemove(victim.uid) }, { merge: true })), '운영자 아니면 숨김 목록을 못 고친다');
    ok(await allowed(F.setDoc(F.doc(adb, 'config', 'hidden'), { uids: F.arrayRemove(victim.uid) }, { merge: true })), '운영자가 되살린다');

    console.log('# 칭호 우편 (v305)');
    ok(await allowed(F.setDoc(F.doc(adb, 'gifts', friend.uid, 'box', 'gt1'), { title: 'okheir', memo: '이미옥의 후예', at: Date.now() })), '운영자가 칭호 우편');
    ok(await denied(F.setDoc(F.doc(adb, 'gifts', friend.uid, 'box', 'gt2'), { title: 'x'.repeat(21), at: Date.now() })), '긴 칭호 열쇠 거부');
    ok(await denied(F.setDoc(friend.ref('gifts', friend.uid, 'box', 'gt3'), { title: 'okheir', at: Date.now() })), '스스로 칭호 우편 넣기 거부');
    ok(await allowed(F.setDoc(friend.ref('players', friend.uid), profile({ title: 'okheir' }), { merge: true })), '서열에 낀 칭호 올리기');
    ok(await denied(F.setDoc(friend.ref('players', friend.uid), profile({ title: 'x'.repeat(21) }), { merge: true })), '긴 칭호 거부');

    console.log('# 전체 채팅 (v302 · v315 2초 막이 · 100자 · 칭호)');
    const wm = (u, o = {}) => ({ uid: u.uid, name: '무인', text: '안녕하세요', type: 'chat', createdAt: F.serverTimestamp(), ...o });
    // 앱처럼 — 말과 chatlimit/{uid}를 한 묶음으로
    const say = async (u, o = {}) => { const b = F.writeBatch(u.db); const r = F.doc(F.collection(u.db, 'chat')); b.set(r, wm(u, o)); b.set(u.ref('chatlimit', u.uid), { at: F.serverTimestamp() }); await b.commit(); return r; };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    ok(await allowed(say(friend)), '누구나(문파 없어도) 전체 채팅');
    ok(await denied(say(friend, { text: '또' })), '2초 안에 또 말하면 거부(서버가 막는다)');
    ok(await denied(F.addDoc(F.collection(bad.db, 'chat'), wm(bad))), '빠르기 막이 없이(옛 방식) 보내면 거부');
    ok(await allowed(say(bad, { type: 'system', text: '✦ 소식' })), '무림 소식(system)도');
    await wait(2200);
    ok(await denied(say(bad, { uid: friend.uid })), '남인 척 거부');
    ok(await denied(say(bad, { text: '가'.repeat(101) })), '101자 거부(한 마디 100자)');
    ok(await denied(say(bad, { text: '' })), '빈 말 거부');
    ok(await denied(say(bad, { name: '가'.repeat(13) })), '긴 이름 거부');
    ok(await denied(say(bad, { createdAt: new Date(0) })), '시각을 꾸미면 거부(서버 시각만)');
    ok(await denied(say(bad, { type: 'admin' })), '이상한 종류 거부');
    ok(await denied(say(bad, { extra: 1 })), '다른 칸 거부');
    ok(await denied(say(bad, { title: 'x'.repeat(17) })), '긴 칭호 거부');
    ok(await denied(F.setDoc(bad.ref('chatlimit', bad.uid), { at: new Date(0) })), '빠르기 막이 시각 꾸미기 거부');
    ok(await denied(F.setDoc(bad.ref('chatlimit', friend.uid), { at: F.serverTimestamp() })), '남의 빠르기 막이 거부');
    ok(await denied(F.deleteDoc(bad.ref('chatlimit', bad.uid))), '빠르기 막이 지우기 거부');
    ok(await allowed(say(bad, { text: '가'.repeat(100) })), '100자는 된다');
    const mine = await say(friend, { title: 'okheir' });
    ok(!!mine, '칭호를 실어 보낸다');
    ok(await denied(F.updateDoc(friend.ref('chat', mine.id), { text: '고침' })), '자기 말도 고치기 거부');
    ok(await denied(F.deleteDoc(friend.ref('chat', mine.id))), '자기 말도 지우기 거부(운영자만)');
    ok(await allowed(F.getDocs(F.collection(bad.db, 'chat'))), '누구나 읽는다');
    ok(await allowed(F.deleteDoc(F.doc(adb, 'chat', mine.id))), '운영자는 지운다');
  }

  console.log('# 운영자 전용');
  ok(await denied(F.setDoc(bad.ref('entitlements', bad.uid), { noAds: true })), '광고 제거 스스로 켜기 거부');
  ok(await denied(F.setDoc(bad.ref('gifts', bad.uid, 'box', 'g1'), { gold: 1000000 })), '스스로 우편(은자) 넣기 거부');
  ok(await denied(F.setDoc(bad.ref('config', 'shop'), { bank: '사기 계좌' })), '상점 계좌 정보 바꾸기 거부');

  console.log('# 서버 세이브');
  ok(await allowed(F.setDoc(boss.ref('saves', boss.uid), { data: '{}', at: Date.now(), dev: 'd', lv: 1, build: 'b' })), '내 세이브는 올린다');
  ok(await denied(F.getDoc(bad.ref('saves', boss.uid))), '남의 세이브 읽기 거부');
  ok(await denied(F.setDoc(bad.ref('saves', boss.uid), { data: '{}', at: 1, dev: 'd', lv: 1, build: 'b' })), '남의 세이브 덮기 거부');

  console.log('# 문파');
  const gid = 'TEST01';
  ok(await denied(F.setDoc(bad.ref('guilds', 'BAD001'), { name: '가짜', code: 'BAD001', owner: bad.uid, memberIds: [bad.uid], members: {}, exp: 999999, checkins: {} })), '경험치를 잔뜩 든 문파 만들기 거부');
  ok(await allowed(F.setDoc(boss.ref('guilds', gid), { name: '우리끼리', code: gid, owner: boss.uid, memberIds: [boss.uid], members: { [boss.uid]: '문주' }, exp: 0, checkins: {}, createdAt: F.serverTimestamp() })), '문파 만들기');
  ok(await denied(F.getDocs(F.collection(bad.db, 'guilds'))), '문파 목록 훑기 거부(코드를 알아야 들어온다)');
  ok(await allowed(F.updateDoc(friend.ref('guilds', gid), { memberIds: F.arrayUnion(friend.uid), [`members.${friend.uid}`]: '친구' })), '코드를 아는 친구는 들어온다');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { memberIds: [boss.uid, friend.uid, bad.uid, 'ghost'], [`members.${bad.uid}`]: '나' })), '들어오면서 남까지 끼워 넣기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { memberIds: [bad.uid, friend.uid, 'x'], [`members.${bad.uid}`]: '나' })), '들어오면서 문주 빼기 거부');
  ok(await allowed(F.updateDoc(bad.ref('guilds', gid), { memberIds: F.arrayUnion(bad.uid), [`members.${bad.uid}`]: '나' })), '(나쁜 사람도 코드를 알면 정상으로는 들어온다)');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { owner: bad.uid })), '문주 빼앗기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { name: '해킹됨' })), '문파 이름 바꾸기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { memberIds: F.arrayRemove(friend.uid) })), '남을 내보내기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { [`members.${friend.uid}`]: '바보' })), '남의 이름표 바꾸기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { [`checkins.${friend.uid}`]: '2099-01-01' })), '남의 출석 바꾸기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { exp: F.increment(100000) })), '문파 경험치 한꺼번에 올리기 거부');
  ok(await denied(F.updateDoc(bad.ref('guilds', gid), { exp: -5 })), '문파 경험치 깎기 거부');
  ok(await allowed(F.updateDoc(bad.ref('guilds', gid), { exp: F.increment(20), [`checkins.${bad.uid}`]: '2026-11-02' })), '(정상 출석은 된다)');
  ok(await allowed(F.updateDoc(bad.ref('guilds', gid), { memberIds: F.arrayRemove(bad.uid), [`members.${bad.uid}`]: F.deleteField() })), '(스스로 나가기는 된다)');
  ok(await denied(F.getDoc(bad.ref('guilds', gid, 'raids', 'wk-1'))), '나간 뒤엔 토벌 못 봄');

  console.log('# 채팅');
  ok(await allowed(F.addDoc(F.collection(friend.db, 'guilds', gid, 'messages'), { uid: friend.uid, name: '친구', text: '안녕', type: 'chat', createdAt: F.serverTimestamp() })), '문파원 채팅');
  ok(await denied(F.addDoc(F.collection(friend.db, 'guilds', gid, 'messages'), { uid: boss.uid, name: '문주', text: '내가 문주다', type: 'chat' })), '남인 척 채팅 거부');
  ok(await denied(F.addDoc(F.collection(friend.db, 'guilds', gid, 'messages'), { uid: friend.uid, name: '가'.repeat(40), text: 'x', type: 'chat' })), '긴 이름 채팅 거부');
  ok(await denied(F.addDoc(F.collection(bad.db, 'guilds', gid, 'messages'), { uid: bad.uid, name: '나', text: 'x', type: 'chat' })), '문파원 아니면 채팅 거부');

  console.log('# 토벌');
  const rk = 'wk-2026-11-02';
  ok(await denied(F.setDoc(friend.ref('guilds', gid, 'raids', rk), { kind: 'world', maxHp: 1000, total: 1000, damage: { [friend.uid]: 1000 }, names: {}, claimed: {}, killedAt: null })), '처음부터 쓰러진 토벌 만들기 거부');
  ok(await allowed(F.setDoc(boss.ref('guilds', gid, 'raids', rk), { kind: 'world', maxHp: 1000, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null, createdAt: F.serverTimestamp() })), '토벌 열기');
  ok(await denied(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { [`claimed.${friend.uid}`]: true })), '쓰러지기 전에 보상 받기 거부');
  ok(await denied(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { total: 500, [`damage.${friend.uid}`]: 10 })), '친 것보다 체력 더 깎기 거부');
  ok(await denied(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { total: 10, [`damage.${boss.uid}`]: 10 })), '남의 피해 고치기 거부');
  ok(await denied(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { maxHp: 1 })), '두목 체력 줄이기 거부');
  ok(await allowed(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { total: 300, [`damage.${friend.uid}`]: 300, [`names.${friend.uid}`]: '친구' })), '정상 일격');
  ok(await allowed(F.updateDoc(boss.ref('guilds', gid, 'raids', rk), { total: 1000, [`damage.${boss.uid}`]: 900, [`names.${boss.uid}`]: '문주', killedAt: F.serverTimestamp() })), '마무리 일격(넘친 피해는 체력까지만)');
  ok(await allowed(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { [`claimed.${friend.uid}`]: true })), '쓰러진 뒤 내 보상 표시');
  ok(await denied(F.updateDoc(friend.ref('guilds', gid, 'raids', rk), { [`claimed.${boss.uid}`]: true })), '남의 보상 표시 거부');

  console.log('# 창고');
  ok(await denied(F.addDoc(F.collection(friend.db, 'guilds', gid, 'stash'), { kind: 'equip', type: 'weapon', grade: 99, uid: friend.uid })), '없는 등급 장비 넣기 거부');
  ok(await denied(F.addDoc(F.collection(friend.db, 'guilds', gid, 'stash'), { kind: 'equip', type: 'weapon', grade: 1, uid: boss.uid })), '남 이름으로 넣기 거부');

  console.log(fails ? `!! ${fails}개 실패` : '규칙 공격 시험 전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
