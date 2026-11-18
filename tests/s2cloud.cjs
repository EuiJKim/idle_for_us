// v525 새 시즌 서버 저장 — 두 기기 시험 (에뮬레이터 필요, tests/cloud.cjs와 같은 준비)
//   기기 A: 무인 고르기 → 익명 연결 → 레벨 올림 → Google 잇기(가짜 토큰) → 서버에 올림
//   기기 B: 새 기기(빈 저장) → 무인 고르기 → 같은 Google 잇기 → 겹침 → 그 계정으로 → A의 진행을 받아 다시 열림
//   + 저장 코드: A에서 복사한 코드를 C(빈 기기)에 붙여 넣으면 같은 진행
const path = require('path'); const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PKG = process.env.FIREBASE_PKG; const BASE = (process.env.BASE || 'http://localhost:8123/') + 'index.html?emu=1';
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now();
const TOKEN = JSON.stringify({ sub: 'g-s2-' + RUN, email: `s2t${RUN}@example.com`, email_verified: true });
// v536 처음 들어오면 출석 창이 뜬다 — 「나중에」로 닫는다
async function skipAttend(pg) { try { await pg.waitForSelector('#modal:not(.hidden) .attg', { timeout: 3000 }); await pg.click('#modal .btn:has-text("나중에")'); } catch { /* 안 뜸 */ } }
async function device(b) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PKG, path.basename(new URL(r.request().url()).pathname))) }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal .jobcard');
  await page.click('#modal .jobcard >> nth=0');
  await skipAttend(page);
  await page.waitForFunction(() => window.__s2?.net?.online, null, { timeout: 20000 });
  return { ctx, page, errs };
}
(async () => {
  if (!PKG) throw new Error('FIREBASE_PKG 필요');
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const A = await device(b);
  assert(await A.page.evaluate(() => !!window.__s2.net.uid), 'A: 익명 계정으로 연결');
  await A.page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 37; g.S.wallet.gold = 123456; });
  assert(await A.page.evaluate((t) => window.__s2.linkTest(t), TOKEN) === 'linked', 'A: Google 잇기 → 서버에 올림');
  const at = await A.page.evaluate(() => window.__s2.net.cloudAt);
  assert(at > 0, 'A: 서버 저장 시각');
  // v547 서열 — 프로필 · 월드보스 주간 점수가 서버에 올라가고 위 몇 명에 보인다 · 화면
  await A.page.evaluate(() => { window.__s2.g.setNick('시험무인'); window.__s2.net.lastProfile = null; window.__s2.rankPush(); window.__s2.wbPush(12345); });
  await sleep(1500);
  const rk = await A.page.evaluate(async () => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); const p = await n.top('power', wk, 50), w = await n.top('wb', wk, 50); return { p: p.rows.find((r) => r.uid === n.uid), w: w.rows.find((r) => r.uid === n.uid), me: p.me }; });
  assert(rk.p && rk.p.nickname === '시험무인' && rk.p.lv === 37 && rk.me >= 1, 'A: 서열 프로필이 올라가 위 목록에 보임');
  assert(rk.w && rk.w.score === 12345 && rk.w.tries === 1, 'A: 월드보스 주간 점수 올라감');
  const wt = await A.page.evaluate(async () => window.__s2.net.wbTotal(window.__s2.wkStr(Date.now())));
  assert(wt.sum >= 12345 && wt.n >= 1, `v576 이번 주 모든 무인 점수 합(${wt.sum} · ${wt.n}명)`);
  await A.page.click('[data-tab="social"] >> nth=0'); await A.page.click('#panel-body .subtabs button:has-text("서열")'); await sleep(1500);
  assert(await A.page.isVisible('#wb .rk-r.me') && /내 등수|시험무인/.test(await A.page.textContent('#wb')), 'A: 무림 → 서열 화면(내 줄)');
  await A.page.click('#wb .rk-r.me'); await sleep(1500);   // v567 줄을 누르면 무인 정보
  assert(/무인 정보/.test(await A.page.textContent('#modal')) && /전투력/.test(await A.page.textContent('#modal')) && await A.page.isVisible('#modal .pc canvas'), 'A: 서열 줄 → 무인 정보(모습 · 전투력)');
  // v569 내 줄이라 즐겨찾기 · 친선 단추는 없다
  assert(!(await A.page.isVisible('#modal .btn:has-text("친선 대결")')), 'A: 내 정보에는 친선 대결 없음');
  await A.page.click('#modal .btn:has-text("확인")'); await sleep(200);
  await A.page.click('#panel-close');
  await A.page.click('#b-opt');
  assert(/Google · s2t\d+@example\.com/.test(await A.page.textContent('#wb')), 'A: 설정 「계정 · 저장」에 Google 표시');
  await A.page.click('#panel-close');
  // 저장 코드 복사
  await A.page.evaluate(() => navigator.clipboard.writeText(''));
  await A.page.click('#b-opt'); await A.page.click('#wb .row:has-text("저장 코드") .btn:has-text("복사")'); await sleep(400);
  const code = await A.page.evaluate(() => navigator.clipboard.readText());
  assert(/^IFU1\./.test(code), 'A: 저장 코드 복사');

  const B = await device(b);
  const uidB = await B.page.evaluate(() => window.__s2.net.uid);
  assert(uidB && uidB !== (await A.page.evaluate(() => window.__s2.net.uid)), 'B: 새 기기는 다른 익명 계정');
  const nav = B.page.waitForNavigation({ timeout: 20000 });
  assert(await B.page.evaluate((t) => window.__s2.linkTest(t), TOKEN) === 'switched', 'B: 같은 Google → 그 계정으로 바꿈');
  await nav; await B.page.waitForFunction(() => window.__s2?.g, null, { timeout: 20000 });
  assert(await B.page.evaluate(() => window.__s2.g.S.hero.lv) === 37 && await B.page.evaluate(() => window.__s2.g.S.wallet.gold) >= 123456, 'B: A의 진행(Lv.37 · 은자)을 받아 다시 열림');

  // C: 저장 코드로
  const ctxC = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  await ctxC.route(/gstatic\.com/, (r) => r.abort());
  const C = await ctxC.newPage(); const errC = []; C.on('pageerror', (e) => errC.push(e.message));
  await C.goto(BASE.replace('?emu=1', ''), { waitUntil: 'domcontentloaded' }); await C.waitForSelector('#modal .jobcard'); await C.click('#modal .jobcard >> nth=1'); await skipAttend(C);
  await C.click('#b-opt'); await C.click('#wb .row:has-text("저장 코드") .btn:has-text("붙여넣기")');
  await C.fill('#codein', code);
  const navC = C.waitForNavigation({ timeout: 10000 });
  await C.click('#modal .btn:has-text("불러오기")'); await navC; await C.waitForFunction(() => window.__s2?.g); await skipAttend(C);
  assert(await C.evaluate(() => window.__s2.g.S.hero.lv) === 37, 'C: 저장 코드 붙여넣기 → 같은 진행');
  // 망가진 코드는 그대로
  await C.click('#b-opt'); await C.click('#wb .row:has-text("저장 코드") .btn:has-text("붙여넣기")');
  await C.fill('#codein', 'IFU1.garbage'); await C.click('#modal .btn:has-text("불러오기")'); await sleep(300);
  assert(await C.evaluate(() => window.__s2.g.S.hero.lv) === 37, 'C: 망가진 코드는 받지 않음');

  // v548 진짜 대결 — A가 방어 덱을 올리고, 새 기기 D가 점수가 가까운 무인으로 A를 찾아 겨룬다 → A 우편함 → A 점수에
  const PS = 20000 + (RUN % 50000);   // 이 시험만의 점수대(에뮬레이터에 지난 시험 덱이 쌓여 있다)
  await A.page.evaluate((ps) => { const g = window.__s2.g; (g.S.pvp ??= { score: 1000, day: '', used: 0, log: [] }).score = ps; window.__s2.net.lastDeck = null; window.__s2.rankPush(); }, PS);
  await sleep(1200);
  const D = await device(b);
  const uidA = await A.page.evaluate(() => window.__s2.net.uid);
  const fr = await D.page.evaluate(async ([ua, ps]) => { (window.__s2.g.S.pvp ??= { score: 1000, day: '', used: 0, log: [] }).score = ps; window.__s2.resetNetTimers(); window.__s2.pvpFetch(); for (let i = 0; i < 40 && !(window.__s2.g.pvpReal || []).length; i++) await new Promise((r) => setTimeout(r, 200)); const os = window.__s2.g.pvpOpponents(); return { found: os.some((o) => o.uid === ua), i: os.findIndex((o) => o.uid === ua) }; }, [uidA, PS]);
  assert(fr.found, 'D: 점수가 가까운 진짜 무인(A)을 찾음');
  await D.page.evaluate(async () => { const g = window.__s2.g; for (let i = 0; i < 60; i++) g.addExp(1e9); g.dirtyStats = true; window.__s2.net.lastDeck = null; window.__s2.rankPush(); await new Promise((r) => setTimeout(r, 800)); });   // v563 D를 세게(이겨야 A가 복수할 기록이 생긴다) · 덱 올림
  const fight = await D.page.evaluate(async (i) => { const r = window.__s2.g.pvpFight(i); await window.__s2.net.pvpLog(r.oppUid, { name: 'D무인', win: r.win, d: r.defD, seed: 1 }); return { win: r.win, defD: r.defD }; }, fr.i);
  const sA0 = await A.page.evaluate(() => window.__s2.g.S.pvp?.score ?? 1000);
  await A.page.evaluate(() => { window.__s2.resetNetTimers(); window.__s2.pvpInbox(); });
  await sleep(1500);
  const sA1 = await A.page.evaluate(() => ({ s: window.__s2.g.S.pvp?.score, l: window.__s2.g.S.pvp?.log?.[0] }));
  assert(sA1.s === Math.max(0, sA0 + fight.defD) && sA1.l?.def === 1 && sA1.l?.name === 'D무인', `A: 받은 공격이 점수에(${sA0} → ${sA1.s}) · 지난 대결에 방어`);
  // v563 복수 — A의 방어 기록(D가 이겼다면)에서 D 덱을 받아 겨룸
  if (fight.win) {
    const rv = await A.page.evaluate(async () => { const g = window.__s2.g, li = g.S.pvp.log.findIndex((l) => l.def && !l.win && l.by); const L = g.S.pvp.log[li]; const opp = await window.__s2.net.pvpDeckOf(L.by); const r = g.pvpRevenge(li, opp); return { ok: !!r, rev: L.rev }; });
    assert(rv.ok && rv.rev, 'A: 진 방어 → D 덱을 받아 복수');
  } else assert(false, 'D가 져서 복수 시험을 못 함(D를 더 세게)');
  const left = await A.page.evaluate(async () => (await window.__s2.net.pvpInbox()).length);
  assert(left === 0, 'A: 우편함은 받으면 비움');
  // v549 문파 — A가 만들고 D가 코드로 들어와 출석 · 명단에 둘 · 찾기 목록에 보임 · D 나가기
  const gcode = await A.page.evaluate(async () => { const c = await window.__s2.net.guildCreate('시험문파', '시험무인'); window.__s2.g.setGuild(c); return c; });
  assert(/^[A-Z2-9]{6}$/.test(gcode), `A: 문파 만들기 → 코드 ${gcode}`);
  // v554 무림 빨간 점 — 문파에 들었는데 오늘 문파 출석 전
  await A.page.evaluate(() => window.__s2.guildLoad(true)); await sleep(1500);
  assert(await A.page.evaluate(() => document.querySelector('.nb[data-tab="social"]').classList.contains('dot-on')), 'A: 문파 출석 전 → 무림에 빨간 점');
  const listed = await D.page.evaluate(async (c) => (await window.__s2.net.guildList()).some((x) => x.id === c), gcode);
  // v573 문주 설정 — 소개 · 가입 레벨(문주만) · 모집 닫으면 찾기 목록에서 빠짐
  const inf = await A.page.evaluate(async (c) => { const n = window.__s2.net, G = await n.guildGet(c); await n.guildInfoSet(G, { intro: '함께 강해져요', minLv: 5 }); const i1 = await n.guildInfoGet(c); await n.guildInfoSet(G, { open: false }); const hidden = !(await n.guildList()).some((x) => x.id === c); await n.guildInfoSet(G, { open: true }); return { intro: i1.intro, minLv: i1.minLv, hidden }; }, gcode);
  assert(inf.intro === '함께 강해져요' && inf.minLv === 5 && inf.hidden, '문주 설정: 소개 · 가입 레벨 · 모집 닫으면 목록에서 빠짐');
  const notOwner = await D.page.evaluate(async (c) => { const n = window.__s2.net, G = await n.guildGet(c); try { await n.guildInfoSet(G, { intro: '몰래' }); return false; } catch (e) { return e?.code === 'permission-denied'; } }, gcode);
  assert(notOwner, '문주가 아니면 소개를 못 바꿈(규칙)');
  assert(listed, 'D: 문파 찾기 목록에 보임');
  const gd = await D.page.evaluate(async (c) => { const n = window.__s2.net; await n.guildJoin(c, 'D무인'); window.__s2.g.setGuild(c); const G = await n.guildGet(c); const ok = await n.guildCheckin(G); const r = window.__s2.g.guildCheckin(); const G2 = await n.guildGet(c); return { n: G2.memberIds.length, exp: G2.exp, chk: G2.checkins[n.uid], ok, r: !!r }; }, gcode);
  assert(gd.n === 2 && gd.exp === 20 && gd.chk && gd.ok && gd.r, 'D: 코드로 들어가 출석 → 문파 경험치 +20 · 보상');
  await D.page.click('[data-tab="social"] >> nth=0'); await D.page.click('#panel-body .subtabs button:has-text("문파")'); await sleep(2000);
  { const tx = await D.page.textContent('#panel-body'); assert(/시험문파/.test(tx) && (await D.page.$$('#wb .row:has-text("전투력")')).length === 2, 'D: 무림 → 문파 화면(이름 · 문파원 둘) ' + tx.slice(0, 120)); }
  await D.page.click('#wb .row.pc-open >> nth=0'); await sleep(1500);   // v568 문파원을 누르면 무인 정보
  assert(/무인 정보/.test(await D.page.textContent('#modal')) && await D.page.isVisible('#modal .pc canvas'), 'D: 문파원 줄 → 무인 정보');
  if (await D.page.isVisible('#modal .btn:has-text("친선 대결")')) {   // v569 남의 정보면 친선 대결 → 대결 화면(점수 그대로)
    const sc0 = await D.page.evaluate(() => window.__s2.g.S.pvp?.score);
    await D.page.click('#modal .btn:has-text("친선 대결")'); await sleep(1500);
    assert(await D.page.isVisible('.duel') && await D.page.evaluate(() => window.__s2.g.S.pvp?.score) === sc0, 'D: 친선 대결 → 대결 화면 · 점수 그대로');
    await D.page.click('.duel'); await sleep(200); await D.page.click('.duel').catch(() => {}); await sleep(200);
    await D.page.evaluate(() => document.querySelectorAll('.duel').forEach((o) => o.remove()));
    await D.page.click('[data-tab="social"] >> nth=0'); await D.page.click('#panel-body .subtabs button:has-text("문파")'); await sleep(800);
  } else { await D.page.click('#modal .btn:has-text("확인")'); await sleep(200); }
  await D.page.click('#panel-close');
  // v550 문파 토벌 — 둘이 피해를 보태면 합 · 이름이 문파 문서에
  const gr = await D.page.evaluate(async (c) => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); await n.graidHit(c, wk, 'D무인', 1000, 37); return n.graidGet(c, wk); }, gcode);
  const gr2 = await A.page.evaluate(async (c) => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); await n.graidHit(c, wk, '시험무인', 500, 40); return n.graidGet(c, wk); }, gcode);
  assert(Object.values(gr2.dmg).reduce((a, b) => a + b, 0) === 1500 && gr2.names && Object.keys(gr2.dmg).length === 2 && gr2.lv === 30 && gr.lv === 30, '문파 토벌: 둘의 피해가 모임(그 주 토벌 레벨은 첫 사람)');
  // v561 문파 서열 — 출석으로 경험치가 오른 문파가 경험치 순 목록에 · 내 문파 등수
  const gt = await D.page.evaluate(async (c) => { const r = await window.__s2.net.guildTop(c); return { has: r.rows.some((x) => x.id === c && x.exp >= 20), me: r.me }; }, gcode);
  assert(gt.has && gt.me >= 1, `문파 서열: 출석한 문파가 경험치 순 목록에(${gt.me}위)`);
  // v552 문파 수련 — 둘의 점수가 모이고 내 점수는 내려가지 않음
  const tr = await A.page.evaluate(async (c) => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); await n.gtrainSet(c, wk, '시험무인', 5); await n.gtrainSet(c, wk, '시험무인', 3); return n.gtrainGet(c, wk); }, gcode);
  const tr2 = await D.page.evaluate(async (c) => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); await n.gtrainSet(c, wk, 'D무인', 4); return n.gtrainGet(c, wk); }, gcode);
  assert(Object.values(tr2.pts).reduce((a, b) => a + b, 0) === 9 && Object.values(tr.pts).includes(5), '문파 수련: 둘의 점수가 모임 · 내 점수는 줄지 않음');
  // v551 문파 대화 — D가 화면에서 보내면 A가 받는다 · 문파원 아니면 못 씀(규칙)
  await D.page.click('[data-tab="social"] >> nth=0'); await D.page.click('#panel-body .subtabs button:has-text("문파")'); await sleep(1500);
  await D.page.fill('#gchat-in', '안녕하세요 <b>반가워요</b>'); await D.page.press('#gchat-in', 'Enter'); await sleep(1200);
  const msgs = await A.page.evaluate(async (c) => (await window.__s2.net.guildChatGet(c)).map((m) => `${m.type}:${m.name}:${m.text}`), gcode);
  assert(msgs.some((m) => /^chat:[^:]+:안녕하세요 <b>반가워요<\/b>$/.test(m)), 'D: 문파 대화 보내기 → A가 받음 ' + msgs.slice(-3).join(' / '));
  // v574 A: 안 읽은 문파 대화 → 무림 빨간 점 · 문파 창을 열면 꺼짐
  await A.page.evaluate(() => { window.__s2.g.S.gChk = window.__s2.dayKey(Date.now()); window.__s2.guildLoad(true); }); await sleep(2000);
  const dot1 = await A.page.evaluate(() => document.querySelector('.nb[data-tab="social"]').classList.contains('dot-on'));
  await A.page.evaluate(() => { if (document.getElementById('res').classList.contains('open')) document.getElementById('rout')?.click(); if (document.getElementById('panel').classList.contains('open')) document.getElementById('panel-close').click(); }); await sleep(300);   // 결과 창 · 열린 창 닫고
  await A.page.click('[data-tab="social"] >> nth=0'); await A.page.click('#panel-body .subtabs button:has-text("문파")'); await sleep(1500); await A.page.click('#panel-close'); await sleep(400);
  const dot2 = await A.page.evaluate(() => document.querySelector('.nb[data-tab="social"]').classList.contains('dot-on'));
  assert(dot1 && !dot2, `A: 안 읽은 문파 대화 → 빨간 점 · 열면 꺼짐 (${dot1} → ${dot2})`);
  assert(await D.page.evaluate(() => /안녕하세요/.test(document.getElementById('gchat')?.textContent || '') && !document.querySelector('#gchat b b')), 'D: 대화 목록에 실시간 · 글은 글자 그대로(꺾쇠 안 먹힘)');
  await D.page.click('#panel-close');
  const E = await device(b);
  const denied = await E.page.evaluate(async (c) => { try { await window.__s2.net.guildSay(c, 'E', '몰래'); return false; } catch (e) { return e?.code === 'permission-denied'; } }, gcode);
  assert(denied, 'E(문파원 아님): 문파 대화 못 씀');
  const after = await D.page.evaluate(async (c) => { await window.__s2.net.guildLeave(c); return (await window.__s2.net.guildGet(c)).memberIds.length; }, gcode);
  assert(after === 1, 'D: 문파 나가기');
  // v596 문파 초대 주소 — ?g=코드로 들어오면 가입을 묻고, 들어가기를 누르면 들어간다
  await D.page.evaluate((c) => { const g = window.__s2.g; g.setGuild(null); if (g.bossFight) g.endChallenge(false); window.__s2.inviteTest(c); }, gcode);
  await D.page.waitForSelector('#modal:not(.hidden) .btn:has-text("들어가기")', { timeout: 20000 }).catch(() => {});
  assert(/문파 초대/.test(await D.page.textContent('#modal')), 'D: 초대 주소 → 문파 초대 창');
  await sleep(400); await D.page.click('#modal .btn:has-text("들어가기")'); await sleep(2500);
  const inv = await D.page.evaluate(async (c) => ({ id: window.__s2.g.S.guildId, n: (await window.__s2.net.guildGet(c)).memberIds.length }), gcode);
  assert(inv.id === gcode && inv.n === 2, `D: 초대로 문파 가입 ${JSON.stringify(inv)}`);
  await D.page.evaluate(async (c) => { await window.__s2.shareGame(c); }, gcode);
  assert(await D.page.evaluate((c) => window.__s2.shareLast().endsWith('?g=' + c), gcode), 'D: 문파원 부르기 → 초대 주소');
  await D.page.evaluate(async (c) => { await window.__s2.net.guildLeave(c); window.__s2.g.setGuild(null); }, gcode);
  const errs = [...A.errs, ...B.errs, ...errC, ...D.errs, ...E.errs];
  assert(errs.length === 0, '페이지 오류 없음 ' + errs.join(' | '));
  await b.close();
  console.log('✓ 새 시즌 서버 저장');
})().catch((e) => { console.error(e); process.exit(1); });
