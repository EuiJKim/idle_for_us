// v436 둘(셋)이 함께 — 에뮬레이터 온라인 시험 (칠대성 쓰러뜨리기 · 늦은 한 몫 · 받기 · 서버 규칙 · 🐞 신고)
//   1) 정적 서버:   npx http-server -p 8123 -s -c-1 .
//   2) 에뮬레이터:  firebase emulators:start --only auth,firestore,database --project idle-69772
//   3) 실행: FIREBASE_PKG=/path/to/node_modules/firebase(js/firebase-config.js 와 같은 판) node tests/online2.cjs
//   에뮬레이터의 Firestore 는 시작할 때 비운다(같은 마왕 번호가 지난 판에 남아 있지 않게).
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const PKG = process.env.FIREBASE_PKG;
const FS_EMU = process.env.FS_EMU || 'http://127.0.0.1:8080';
const PROJECT = 'idle-69772';
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
if (!PKG) { console.log('FIREBASE_PKG 가 없어 건너뜀 (에뮬레이터 시험)'); process.exit(0); }

let fails = 0;
const assert = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = (page, fn, arg) => page.evaluate(fn, arg);
// 운영자 눈(규칙을 건너뛴다) — 에뮬레이터 REST 에 Bearer owner
const emu = async (p, opt = {}) => {
  const r = await fetch(`${FS_EMU}${p}`, { ...opt, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};
const docsOf = async (col) => (await emu(`/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=200`)).documents || [];
const sv = (f) => f?.stringValue ?? f?.integerValue ?? f?.doubleValue ?? f?.booleanValue ?? null;

async function newPlayer(browser, name, cls = '검사') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  const NOISE = /Failed to load resource|ERR_FAILED|Could not reach Cloud Firestore backend|permission-denied|Missing or insufficient permissions/;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    const file = path.join(PKG, path.basename(new URL(route.request().url()).pathname));
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + '?emu=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal input, #login-guest, .char-card', { timeout: 20000 });
  if (await page.isVisible('#login-guest')) await page.click('#login-guest');
  await page.waitForSelector('#modal input, .char-card', { timeout: 10000 });
  if (await page.isVisible('.char-card.empty')) await page.click('.char-card.empty >> nth=0');
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  await page.waitForSelector('.class-card');
  await page.click(`.class-card:has-text("${cls}")`);
  await page.waitForSelector('#modal .cust-go', { timeout: 5000 });
  await page.click('#modal .cust-go');
  await page.evaluate(() => window.__game.attend());
  // 온라인이 될 때까지
  for (let i = 0; i < 60; i++) { if (await G(page, () => !!window.__net?.ready?.() && !!window.__net.uid)) break; await sleep(250); }
  const uid = await G(page, () => window.__net.uid);
  return { ctx, page, errors, name, uid };
}
// 페이지 안에서 Firestore 를 바로 건드려 규칙이 막는지 본다 — 'denied' / 'ok' / 그 밖의 오류 글
const tryWrite = (page, fn, v = {}) => G(page, async ([src, v]) => {
  const net = window.__net;
  try { await (0, eval)(`(${src})`)(net, v); return 'ok'; } catch (err) { return err?.code === 'permission-denied' ? 'denied' : String(err?.code || err?.message || err); }
}, [fn.toString(), v]);

(async () => {
  // 지난 판을 비운다
  await emu(`/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  try {
    console.log('— 셋이 들어온다');
    const A = await newPlayer(browser, '갑돌');
    const B = await newPlayer(browser, '을순', '독마');
    const C = await newPlayer(browser, '병철');
    assert(A.uid && B.uid && C.uid && new Set([A.uid, B.uid, C.uid]).size === 3, `서로 다른 손님 셋 (${[A.uid, B.uid, C.uid].map((u) => String(u).slice(0, 5)).join(' · ')})`);

    const [boss0, boss1] = await G(A.page, async () => { const D = await import('./js/world/wdgn.js'); return [D.WRAID_BOSSES[0].id, D.WRAID_BOSSES[1].id]; });

    console.log('— 규칙: 너무 약한 마왕은 세울 수 없다');
    const weak = await tryWrite(A.page, async (net, v) => {
      const b = net.fs.writeBatch(net.db);
      b.set(net.ref('wbp', v.b), { seq: 1 });
      b.set(net.ref('wraid', v.b + '_1'), { boss: v.b, seq: 1, maxHp: 1000, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null, killer: null, createdAt: net.fs.serverTimestamp() });
      await b.commit();
    }, { b: boss1 });
    assert(weak === 'denied', `체력 1000 마왕 세우기는 막힘 (${weak})`);

    console.log('— 갑돌이 마왕을 깨우고 을순도 같은 판에 들어온다');
    const rA = await G(A.page, (b) => window.__net.ensureWraid(b), boss0);
    const rB = await G(B.page, (b) => window.__net.ensureWraid(b), boss0);
    assert(rA?.id && rA.id === rB?.id, `같은 마왕 문서 (${rA?.id})`);
    assert(rA.maxHp >= 3e12, `마왕 체력이 규칙 바닥 위 (${rA.maxHp.toExponential(2)})`);
    const id = rA.id, maxHp = rA.maxHp;

    // 을순은 들어왔다는 표시만 하고 아직 치지 않았다 · 병철은 표시도 없다
    assert(await G(B.page, (x) => window.__net.seenWraid(x), id), '을순: 들어왔다는 표시(seen)');

    console.log('— 규칙: 남의 몫을 올리거나, 한 번에 체력보다 많이 올릴 수 없다');
    const other = await tryWrite(C.page, async (net, v) => { await net.fs.updateDoc(net.ref('wraid', v.id), { total: 10, ['damage.' + v.a]: 10, ['names.' + v.a]: '가짜' }); }, { id, a: A.uid });
    assert(other === 'denied', `병철이 갑돌 몫 올리기는 막힘 (${other})`);
    const lie = await tryWrite(C.page, async (net, v) => { await net.fs.updateDoc(net.ref('wraid', v.id), { total: 500, ['damage.' + net.uid]: 100, ['names.' + net.uid]: '병철' }); }, { id });
    assert(lie === 'denied', `합계를 내 몫보다 더 올리기는 막힘 (${lie})`);

    console.log('— 갑돌이 치다가 마무리한다');
    const k1 = await G(A.page, ([x]) => window.__net.commitWraid(x, 123456), [id]);
    assert(k1 === false, '첫 몫은 쓰러뜨리지 못함');
    const k2 = await G(A.page, ([x, m]) => window.__net.commitWraid(x, m, true), [id, maxHp]);
    assert(k2 === true, '마무리 일격 → 쓰러짐');
    const after = await G(A.page, async (x) => { const s = await window.__net.fs.getDoc(window.__net.ref('wraid', x)); return s.data(); }, id);
    assert(after.total === after.maxHp && after.killer === A.uid && after.killedAt, '합계 = 체력 · 마무리한 사람 · 쓰러진 시각');

    console.log('— 늦은 한 몫: 표시가 있는 을순만');
    const kb = await G(B.page, ([x]) => window.__net.commitWraid(x, 777), [id]);
    assert(kb === false, '쓰러진 뒤라 마무리는 아님');
    const kc = await G(C.page, ([x]) => window.__net.commitWraid(x, 777), [id]);
    assert(kc === false, '병철도 마무리 아님');
    const late = await G(A.page, async (x) => { const s = await window.__net.fs.getDoc(window.__net.ref('wraid', x)); return s.data().damage; }, id);
    assert(late[B.uid] === 777, `을순의 늦은 한 몫이 들어감 (${late[B.uid]})`);
    assert(!(late[C.uid] > 0), '표시 없는 병철 몫은 안 들어감');
    const sneak = await tryWrite(C.page, async (net, v) => { await net.fs.updateDoc(net.ref('wraid', v.id), { ['damage.' + net.uid]: 100, ['names.' + net.uid]: '병철' }); }, { id });
    assert(sneak === 'denied', `규칙: 표시 없이 늦은 한 몫 쓰기는 막힘 (${sneak})`);
    const greedy = await tryWrite(B.page, async (net, v) => { await net.fs.updateDoc(net.ref('wraid', v.id), { ['damage.' + net.uid]: 1e15 }); }, { id });
    assert(greedy === 'denied', `규칙: 이미 받은 늦은 몫을 크게 고치기는 막힘 (${greedy})`);

    console.log('— 받기: 순위대로 한 번씩');
    const getR = (p, x) => G(p, async (i) => { const s = await window.__net.fs.getDoc(window.__net.ref('wraid', i)); return { id: s.id, ...s.data() }; }, x);
    const cA = await G(A.page, async (i) => { const n = window.__net; const s = await n.fs.getDoc(n.ref('wraid', i)); const o = await n.claimWraid({ id: s.id, ...s.data() }, true); return o && { rank: o.rank }; }, id);
    assert(cA?.rank === 1, `갑돌 1위로 받음 (${cA?.rank})`);
    // v437 캐릭터를 바꿨으면(이 캐릭터가 친 판이 아니면) 저절로 받지 않는다 — 계정 보상을 엉뚱한 캐릭터가 가져가지 않게
    const autoOther = await G(B.page, async (i) => { const n = window.__net; delete window.__game.s.wraid.part?.[i]; const s = await n.fs.getDoc(n.ref('wraid', i)); const o = await n.claimWraid({ id: s.id, ...s.data() }); const s2 = await n.fs.getDoc(n.ref('wraid', i)); return { o, claimed: !!s2.data().claimed?.[n.uid] }; }, id);
    assert(autoOther.o === null && !autoOther.claimed, '친 판이 아닌 캐릭터는 저절로 받지 않음(서버 받음 표시도 그대로)');
    const cB = await G(B.page, async (i) => { const n = window.__net, g = window.__game; g.s.wraid.part = { ...(g.s.wraid.part || {}), [i]: Date.now() }; const s = await n.fs.getDoc(n.ref('wraid', i)); const o = await n.claimWraid({ id: s.id, ...s.data() }); return o && { rank: o.rank }; }, id);
    assert(cB?.rank === 2, `친 캐릭터로는 저절로 받음 — 을순 2위 (${cB?.rank})`);
    const again = await G(B.page, async (i) => { const n = window.__net; const s = await n.fs.getDoc(n.ref('wraid', i)); return n.claimWraid({ id: s.id, ...s.data() }, true); }, id);
    assert(again === null, '두 번 받기는 안 됨');
    const cC = await G(C.page, async (i) => { const n = window.__net; const s = await n.fs.getDoc(n.ref('wraid', i)); return n.claimWraid({ id: s.id, ...s.data() }, true); }, id);
    assert(cC === null, '치지 않은 병철은 받을 것 없음');
    const unclaim = await tryWrite(B.page, async (net, v) => { await net.fs.updateDoc(net.ref('wraid', v.id), { ['claimed.' + net.uid]: false }); }, { id });
    assert(unclaim === 'denied', `규칙: 받음 표시 지우기는 막힘 (${unclaim})`);
    const r2 = await getR(A.page, id);
    assert(r2.claimed?.[A.uid] && r2.claimed?.[B.uid] && !r2.claimed?.[C.uid], '받음 표시 = 갑돌 · 을순');

    console.log('— 다음 판: 쓰러진 뒤 다시 깨우면 번호가 오른다');
    const rN = await G(C.page, (b) => window.__net.ensureWraid(b), boss0);
    assert(rN?.id && rN.id !== id && rN.seq === after.seq + 1 && rN.total === 0, `새 마왕 ${rN?.id}`);

    console.log('— 🐞 버그 신고 (사람이 누름)');
    await G(A.page, () => { try { localStorage.setItem('ifu.settab', 'app'); } catch { /* */ } });
    if (await A.page.isVisible('#panel-close')) await A.page.click('#panel-close');
    await A.page.click('#btn-settings');
    await A.page.waitForSelector('#bug-open', { timeout: 5000 });
    await A.page.click('#bug-open');
    await A.page.waitForSelector('#bug-text');
    await A.page.click('#bug-send');   // 너무 짧다 → 보내지 않는다
    await sleep(300);
    assert(await A.page.isVisible('#bug-text'), '빈 신고는 보내지 않고 창이 남음');
    await A.page.fill('#bug-text', '칠대성 받기 뒤 가방이 이상해요 (시험)');
    await A.page.click('#bug-send');
    await A.page.waitForSelector('#bug-text', { state: 'hidden', timeout: 10000 });
    let bugs = [];
    for (let i = 0; i < 20 && !bugs.length; i++) { bugs = await docsOf('bugs'); if (!bugs.length) await sleep(250); }
    const user = bugs.find((d) => sv(d.fields.kind) === 'user');
    assert(user && sv(user.fields.by) === A.uid, '신고 문서가 서버에 (보낸 사람 = 갑돌)');
    const saveTxt = sv(user?.fields.save) || '';
    let saveOk = false; try { const j = JSON.parse(saveTxt); saveOk = !!(j && (j.nickname === '갑돌' || JSON.stringify(j).includes('갑돌'))); } catch { /* */ }
    assert(saveOk, `세이브 전체가 같이 감 (${(saveTxt.length / 1024).toFixed(1)}KB)`);
    assert(String(sv(user?.fields.build) || '').startsWith('ifu-v'), `판 번호 (${sv(user?.fields.build)})`);
    assert((sv(user?.fields.notes) || '').startsWith('['), '지난 알림 목록이 같이 감');
    const shotLen = (sv(user?.fields.shot) || '').length;
    assert(shotLen === 0 || (sv(user.fields.shot).startsWith('data:image/jpeg') && shotLen < 250000), `화면 사진 크기 ${(shotLen / 1024).toFixed(0)}KB`);

    console.log('— 🐞 오류 저절로 보내기');
    await G(B.page, () => { window.__bugNote('TypeError: 시험 오류 하나', 'at test (online2.cjs:1)'); window.__bugNote('TypeError: 시험 오류 하나', 'again'); window.__bugNote('Failed to fetch'); });
    let autos = [];
    for (let i = 0; i < 20; i++) { autos = (await docsOf('bugs')).filter((d) => sv(d.fields.kind) === 'auto'); if (autos.length) break; await sleep(250); }
    await sleep(600); autos = (await docsOf('bugs')).filter((d) => sv(d.fields.kind) === 'auto');
    assert(autos.length === 1 && sv(autos[0].fields.by) === B.uid && sv(autos[0].fields.text).includes('시험 오류'), `같은 오류는 한 번 · 소음은 거름 (${autos.length}개)`);
    await G(B.page, () => { for (let i = 0; i < 6; i++) window.__bugNote(`RangeError: 시험 ${i}`); });
    await sleep(1500);
    autos = (await docsOf('bugs')).filter((d) => sv(d.fields.kind) === 'auto' && sv(d.fields.by) === B.uid);
    assert(autos.length === 3, `한 판에 저절로 보내기는 3개까지 (${autos.length})`);

    console.log('— 규칙: 신고함은 운영자만 · 남의 이름으로 · 큰 세이브');
    const peek = await tryWrite(C.page, async (net) => { await net.fs.getDocs(net.fs.collection(net.db, 'bugs')); });
    assert(peek === 'denied', `무인은 신고함을 못 읽음 (${peek})`);
    const fake = await tryWrite(C.page, async (net) => { await net.fs.addDoc(net.fs.collection(net.db, 'bugs'), { by: 'someone', kind: 'user', text: 'x', build: '', ua: '', lv: 1, map: 1, save: '', notes: '', errs: '', shot: '', at: net.fs.serverTimestamp() }); });
    assert(fake === 'denied', `남의 이름으로 신고는 막힘 (${fake})`);
    const huge = await tryWrite(C.page, async (net) => { await net.fs.addDoc(net.fs.collection(net.db, 'bugs'), { by: net.uid, kind: 'user', text: 'x', build: '', ua: '', lv: 1, map: 1, save: 'x'.repeat(700000), notes: '', errs: '', shot: '', at: net.fs.serverTimestamp() }); });
    assert(huge === 'denied', `너무 큰 세이브는 막힘 (${huge})`);
    const odd = await tryWrite(C.page, async (net) => { await net.fs.addDoc(net.fs.collection(net.db, 'bugs'), { by: net.uid, kind: 'spam', text: 'x', build: '', ua: '', lv: 1, map: 1, save: '', notes: '', errs: '', shot: '', at: net.fs.serverTimestamp() }); });
    assert(odd === 'denied', `모르는 종류는 막힘 (${odd})`);

    for (const P of [A, B, C]) assert(!P.errors.length, `${P.name} 화면 오류 없음${P.errors.length ? ' — ' + P.errors.slice(0, 3).join(' | ') : ''}`);
    await A.page.screenshot({ path: path.join(OUT, 'online2-a.png') });
  } catch (err) {
    fails++;
    console.log('  ✗ 멈춤:', err?.stack || err);
  } finally {
    await browser.close();
  }
  console.log(fails ? `\n✗ 둘이 함께 시험 ${fails}개 실패` : '\n✓ 둘이 함께 시험 전부 통과');
  process.exit(fails ? 1 : 0);
})();
