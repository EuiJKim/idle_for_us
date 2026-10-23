// 브라우저 종단 테스트 (Playwright + Firebase 에뮬레이터)
//   1) 정적 서버:      npx http-server -p 8123 -s -c-1 .
//   2) 에뮬레이터:      firebase emulators:start --only auth,firestore --project idle-69772
//   3) 실행:           FIREBASE_PKG=/path/to/node_modules/firebase node tests/e2e.cjs
// FIREBASE_PKG가 없으면 Firebase 로딩을 막고 혼자 하기만 확인한다.
//   이 컨테이너에서는: PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=/opt/pw-browsers/chromium node tests/e2e.cjs
//
// 은자·한철·비급·먹이·신물 조각·경험치는 Big이다(보통 숫자가 아니다). 페이지 안에서
// 값을 넣을 때는 B(…)로 감싸고, 꺼낼 때는 String으로 꺼내 Number로 읽는다.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const PKG = process.env.FIREBASE_PKG;
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('  ✓', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

// 페이지 안에서 쓰는 도우미. Big 생성자는 세이브의 은자에서 빌려 온다(전역에 안 내놓는다).
const PRELUDE = () => {
  window.B = (v) => window.__game.s.gold.constructor.of(v);
  window.N = (v) => Number(String(v));
};

async function newPlayer(browser, name, job = 'sword') {
  // 서비스 워커는 막는다 — 처음 들어오면 워커가 자리를 잡으며 페이지를 한 번 새로 고쳐서,
  // 그 사이에 돌던 단계가 '실행 문맥이 사라졌다'로 가끔 떨어졌다
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // 에뮬레이터 연결이 잠깐 끊기면 SDK가 오류로 찍는다 — 앱 오류가 아니다
  const NOISE = /Failed to load resource|ERR_FAILED|Could not reach Cloud Firestore backend/;
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  // 글꼴은 밖에서 받아 온다 — 막힌 곳에서는 load가 끝나지 않아 기다림이 멈춘다
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    if (!PKG) return route.abort();
    const file = path.join(PKG, path.basename(new URL(route.request().url()).pathname));
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + (PKG ? '?emu=1' : ''), { waitUntil: 'domcontentloaded' });
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  // 처음 시작하면 캐릭터를 고른다 (닫을 수 없는 창)
  await page.waitForSelector('.class-card');
  await page.click(`.class-card:has-text("${{ sword: '검사', fist: '권마', fan: '환마', poison: '독마', ring: '극악소마' }[job]}")`);
  await page.evaluate(PRELUDE);
  return { ctx, page, errors, name };
}

// 창 버튼은 들판 위에 떠 있고, 창이 올라오면 그 아래로 숨는다. 닫고 나서 누른다.
async function tab(page, name) {
  if (await page.isVisible('#panel-close')) { await page.click('#panel-close'); await sleep(250); }
  await page.click(`#tabs button[data-tab="${name}"]`);
  await sleep(250);
}
const sub = (page, label) => page.click(`#panel .subtabs button:has-text("${label}")`);
const G = (page, fn, arg) => page.evaluate(fn, arg);
// 진행 중인 전투(비경·심마·시험·비무)를 빨리 끝낸다
async function finishContest(page, { win = true } = {}) {
  for (let i = 0; i < 80; i++) {
    const done = await G(page, (w) => {
      const g = window.__game;
      if (g.mode === 'stage') return true;
      if (w) { if (g.mon?.alive) g.dealDamage(g.mon.hp.mul(2).add(1), 'hit'); } else g.contest.time = 0.01;
      return false;
    }, win);
    if (done) return;
    await sleep(150);
  }
  throw new Error('contest did not finish');
}
const closeResult = async (page) => { await page.waitForSelector('.result-title'); await page.click('#modal >> text=확인'); };

(async () => {
  if (PKG) { // 에뮬레이터 데이터 초기화
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/idle-69772/databases/(default)/documents', { method: 'DELETE' });
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/idle-69772/accounts', { method: 'DELETE' });
  }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const a = await newPlayer(browser, '철수');
  const p = a.page;

  console.log('# 캐릭터');
  const job = await G(p, () => ({ job: window.__game.s.job, tier: window.__game.jobTier(), name: window.__game.skillDef('slash').name }));
  assert(job.job === 'sword' && job.tier === 0, `검사로 시작 (기초 무공 ${job.name})`);

  console.log('# 전투');
  await sleep(5000);
  const s1 = await G(p, () => ({ gold: N(window.__game.s.gold), kills: window.__game.s.stats.kills, exp: N(window.__game.s.exp), level: window.__game.s.level }));
  assert(s1.kills > 0 && s1.gold > 0 && (s1.exp > 0 || s1.level > 1), `자동 사냥: 처치 ${s1.kills}, 은자 ${Math.floor(s1.gold)}`);
  await shot(p, '01-battle.png');

  console.log('# 수련');
  await G(p, () => { const g = window.__game; g.s.gold = B(1e9); g.s.maxStage = g.s.bestStage = 120; });
  await tab(p, 'train');
  await sub(p, '공격');
  const atk0 = await G(p, () => window.__game.s.upgrades.atk || 0);
  await p.click('#panel .seg button:has-text("x10")');
  await p.locator('#panel .row:has-text("외공") .buy').click();
  const atk1 = await G(p, () => window.__game.s.upgrades.atk || 0);
  assert(atk1 === atk0 + 10, `외공 x10 수련 (${atk0} → ${atk1})`);
  // 단계 상한: 지금 단계를 다 채우면 더 못 산다
  const cap = await G(p, () => {
    const g = window.__game;
    g.s.upgrades.atk = g.upCapOf('atk');
    g.s.gold = B(1e30);
    return { cap: g.upCapOf('atk'), maxed: g.upgradeMaxed('atk'), buy: g.buyUpgrade ? g.buyUpgrade('atk', 1) : null, after: g.s.upgrades.atk };
  });
  assert(cap.maxed && cap.after === cap.cap, `수련 단계 상한 ${cap.cap}에서 멈춤`);
  await shot(p, '02-train.png');

  console.log('# 레벨·경지');
  await G(p, () => { const g = window.__game; g.s.sp = 12; g.s.level = 15; });
  await tab(p, 'growth');
  await sub(p, '레벨');
  const spKey = await G(p, () => Object.keys(window.__game.s.spAlloc)[0]);
  const sp0 = await G(p, (k) => window.__game.s.spAlloc[k] || 0, spKey);
  await p.click('#panel .seg-btn:has-text("+10")');
  await p.locator('#panel .row button:has-text("+10")').first().click();
  assert(await G(p, (k) => window.__game.s.spAlloc[k], spKey) === sp0 + 10, '스탯 포인트 +10');
  await shot(p, '03-level.png');
  // 경지 안의 마흔 단을 다 채워야 심마가 나온다 (단은 레벨만 차면 오른다)
  await G(p, () => { const g = window.__game; g.s.rankSub = 39; g.s.level = Math.max(g.s.level, 20); });
  await sub(p, '경지');
  await p.click('#panel button:has-text("경지 돌파")');
  assert(await G(p, () => window.__game.mode) === 'trial', '경지 돌파(심마) 시작');
  await sleep(1200);
  await shot(p, '04-trial.png');
  await finishContest(p);
  await p.waitForSelector('.result-title:has-text("경지 돌파")');
  assert(await G(p, () => window.__game.s.rank) === 1, '경지 돌파 → 이류');
  await p.click('#modal >> text=확인');

  console.log('# 전직');
  // 1차 전직은 150관문을 넘으면 열린다
  await G(p, () => { const g = window.__game; g.s.maxStage = g.s.bestStage = 150; });
  await tab(p, 'growth');
  await sub(p, '전직');
  await p.click('#panel button:has-text("1차 전직 시험")');
  await p.click('#modal button:has-text("시험 보기")');
  assert(await G(p, () => window.__game.mode) === 'jobtest', '1차 전직 시험 시작');
  await sleep(800);
  await shot(p, '05-jobtest.png');
  // 시험마다 겨루는 방식이 다르다 — 이긴 것으로 끝낸다
  await G(p, () => window.__game.endContest('clear'));
  await sleep(400);
  await p.locator('#modal button').last().click();
  const t1 = await G(p, () => ({ tier: window.__game.jobTier(), name: window.__game.skillDef('slash').name, tn: window.__game.tierName() }));
  assert(t1.tier === 1 && t1.name !== job.name, `1차 전직 → ${t1.tn}, 기초 무공이 ${job.name} → ${t1.name}(으)로 각성`);

  console.log('# 병기');
  await G(p, () => { window.__game.s.gems = 20000; });
  await tab(p, 'equip');
  await sub(p, '병기');
  await p.click('#panel button:has-text("10회")');
  await p.waitForSelector('.gacha-item');
  assert((await p.$$('.gacha-item')).length === 10, '병기 10회 뽑기');
  await p.click('#modal >> text=닫기');
  await shot(p, '06-equip.png');

  console.log('# 무공');
  await G(p, () => { window.__game.s.books = B(1000); });
  await tab(p, 'skill');
  await sub(p, '무공');
  const lv0 = await G(p, () => window.__game.s.skills.slash || 1);
  await p.locator(`#panel .row:has-text("${t1.name}") .buy`).first().click();
  assert(await G(p, () => window.__game.s.skills.slash) === lv0 + 1, `비급으로 ${t1.name} Lv.${lv0 + 1}`);
  await sub(p, '패시브');
  await p.locator('#panel .row .buy').first().click();
  assert(await G(p, () => Object.values(window.__game.s.passives || {}).some((v) => v > 0)), '패시브 1단');
  await shot(p, '07-skill.png');

  console.log('# 치명 단계');
  // 치명 확률을 250%로 올리면 평타는 늘 슈퍼 치명 이상, 무공도 슈퍼 치명 이상으로 들어간다
  const tiers = await G(p, async () => {
    const g = window.__game;
    const seen = { hit: 0, skill: 0 };
    const emit = g.emit;
    g.emit = function (type, ev = {}) {
      if (type === 'dmg') {
        const t = typeof ev.crit === 'number' ? ev.crit : 0;
        if (ev.kind === 'hit') seen.hit = Math.max(seen.hit, t);
        else if (ev.kind !== 'pet') seen.skill = Math.max(seen.skill, t);
      }
      return emit.call(this, type, ev);
    };
    const was = g.stats.bind(g);
    g.stats = (o) => ({ ...was(o), crit: 2.5 });
    for (const k of Object.keys(g.cd)) g.cd[k] = 0;
    await new Promise((r) => setTimeout(r, 3000));
    g.stats = was;
    g.emit = emit;
    return seen;
  });
  assert(tiers.hit >= 2 && tiers.skill >= 2, `치명 250% → 평타 ${tiers.hit}단, 무공 ${tiers.skill}단`);

  console.log('# 영수·신물');
  await tab(p, 'companion');
  await sub(p, '영수');
  await p.click('#panel button:has-text("알 10개")');
  await p.waitForSelector('.gacha-item');
  await p.click('#modal >> text=확인');
  // 알에서 나온 영수는 데려가기를 눌러야 따라온다
  const owned = p.locator('#panel .row:not(:has-text("미보유"))').filter({ has: p.locator('button:has-text("데려가기")') }).first();
  await owned.locator('button:has-text("데려가기")').click();
  const pets = await G(p, () => ({ n: Object.keys(window.__game.s.pets).length, pet: window.__game.s.petTeam[0] }));
  assert(pets.n >= 1 && pets.pet, `영수 부화 ${pets.n}종, 데려간 영수 ${pets.pet}`);
  await G(p, () => { window.__game.s.food = B(1e6); });
  const sumLv = () => G(p, () => Object.values(window.__game.s.pets).reduce((x, y) => x + y, 0));
  const lvSum0 = await sumLv();
  await p.locator('#panel .row:not(:has-text("미보유")) button:has-text("먹이")').first().click();
  assert(await sumLv() > lvSum0, '영수 먹이 주기');
  await G(p, () => { window.__game.s.relicShards = B(100); });
  await sub(p, '신물');
  await p.click('#panel button:has-text("발굴 10회")');
  assert(await G(p, () => Object.values(window.__game.s.relics).reduce((x, y) => x + y, 0)) === 10, '신물 발굴 10회');
  await shot(p, '08-relic.png');

  console.log('# 비경');
  await tab(p, 'dungeon');
  await sub(p, '수련터');
  await p.locator('#panel .dungeon-card button:visible:has-text("도전")').first().click();
  assert(await G(p, () => window.__game.mode) === 'dungeon', '비경 입장');
  await sleep(1200);
  await shot(p, '09-dungeon.png');
  await finishContest(p);
  await p.waitForSelector('.result-title');
  const dgId = await G(p, () => Object.keys(window.__game.s.dungeons).find((k) => window.__game.s.dungeons[k] > 0));
  assert(!!dgId, `비경 1단계 돌파 (${dgId})`);
  await p.click('#modal >> text=확인');
  // 겨루는 동안 창은 내려간다 — 다시 연다
  await tab(p, 'dungeon');
  await sub(p, '수련터');
  const keys0 = await G(p, (id) => window.__game.s.daily.keys[id], dgId);
  await p.locator('#panel .dungeon-card button:visible:has-text("소탕")').first().click();
  assert(await G(p, (id) => window.__game.s.daily.keys[id], dgId) === keys0 - 1, '소탕으로 열쇠 사용');

  console.log('# 의뢰');
  await p.click('#panel-close');
  await p.click('#btn-missions');
  await p.waitForSelector('#modal h2:has-text("의뢰")');
  const gemsBefore = await G(p, () => window.__game.s.gems);
  await p.locator('#modal button:has-text("받기")').first().click();
  assert(await G(p, () => window.__game.s.gems) > gemsBefore, '의뢰 보상');
  await shot(p, '10-missions.png');
  await p.click('#modal >> text=닫기');

  console.log('# 회귀');
  await G(p, () => { const g = window.__game; g.s.maxStage = g.s.stage = g.s.bestStage = 150; });
  await tab(p, 'growth');
  await sub(p, '회귀');
  await p.click('#panel button:has-text("회귀한다 (+")');
  await p.waitForSelector('#modal .regress-hz');
  await shot(p, '11-regress-modal.png');
  await p.click('#modal button:has-text("회귀한다")');
  const rg = await G(p, () => ({ ...window.__game.s.regress, stage: window.__game.s.stage, gold: N(window.__game.s.gold), best: window.__game.s.bestStage, rank: window.__game.s.rank, job: window.__game.s.job, tier: window.__game.jobTier() }));
  assert(rg.count === 1 && rg.points > 0 && rg.stage === 1 && rg.best >= 150 && rg.rank === 1 && rg.job === 'sword' && rg.tier === 1,
    `회귀: 1관문으로, 기억 +${rg.points}, 경지·역대 관문·캐릭터·전직 유지`);
  await sleep(1200);

  console.log('# 방치 보상·저장');
  // 받은 은자는 자동 수련에 바로 부어지므로(설정) 잔고로는 못 잰다 — 받은 몫을 직접 본다
  await G(p, () => {
    const g = window.__game;
    const was = g.claimOffline.bind(g);
    g.claimOffline = (r, m) => { window.__claimed = { gold: N(r.gold), exp: N(r.exp), m }; return was(r, m); };
    g.s.lastSeen = Date.now() - 2 * 3600 * 1000;
  });
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForSelector('text=다녀오셨어요');
  await p.click('#modal button:has-text("받기"):not(.good)');
  const cl = await G(p, () => window.__claimed);
  assert(cl && cl.gold > 0 && cl.exp > 0, `방치 보상 (은자 ${Math.floor(cl?.gold)}, 경험치 ${Math.floor(cl?.exp)})`);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const re = await G(p, () => ({ rank: window.__game.s.rank, pet: window.__game.s.petTeam[0], job: window.__game.s.job, tier: window.__game.jobTier(), dg: window.__game.s.dungeons }));
  assert(re.rank === 1 && re.pet === pets.pet && re.job === 'sword' && re.tier === 1 && re.dg[dgId] >= 1,
    '새로고침 후 경지·영수·캐릭터·전직·비경 유지');
  assert(!(await p.isVisible('.class-card')), '새로고침 후 캐릭터를 다시 묻지 않음');
  await p.evaluate(PRELUDE);

  if (!PKG) {
    assert((await p.textContent('#net-badge')).includes('오프라인'), 'Firebase 없이 오프라인 모드');
    console.log('errors:', a.errors);
    assert(a.errors.length === 0, '콘솔 오류 없음');
    await browser.close();
    console.log('ALL OK');
    return;
  }

  console.log('# 온라인: 문파');
  await p.waitForSelector('#net-badge.online', { timeout: 15000 });
  await tab(p, 'social');
  await sub(p, '문파');
  await p.fill('input[placeholder^="문파 이름"]', '우리끼리');
  await p.click('button:has-text("문파 만들기")');
  await p.waitForSelector('text=🏰 우리끼리');
  const code = (await p.textContent('.card b[style*="letter-spacing"]')).trim();
  assert(/^[A-Z0-9]{6}$/.test(code), `문파 생성, 코드 ${code}`);

  const b = await newPlayer(browser, '영희', 'poison');
  const q = b.page;
  await q.waitForSelector('#net-badge.online', { timeout: 15000 });
  await tab(q, 'social');
  await sub(q, '문파');
  await q.fill('input[placeholder^="친구에게"]', code.toLowerCase());
  await q.click('button:has-text("가입하기")');
  await q.waitForSelector('text=🏰 우리끼리');
  await p.waitForSelector('.chip:has-text("영희")', { timeout: 10000 });
  assert(true, '영희 가입');

  await p.fill('input[placeholder="메시지 보내기"]', '안녕 영희!');
  await p.press('input[placeholder="메시지 보내기"]', 'Enter');
  await q.waitForSelector('.msg:has-text("안녕 영희!")', { timeout: 10000 });
  assert(true, '채팅');

  console.log('# 토벌');
  await p.click('text=⚔️ 공격하기');
  await p.waitForFunction(() => window.__game.mode === 'raid');
  await sleep(2000);
  await shot(p, '12-raid.png');
  assert(await G(p, () => window.__game.mode) === 'raid', '토벌 두목이 2초 만에 쓰러지지 않음 (무공까지 센 체력)');
  await G(p, () => { window.__game.contest.time = 0.01; });
  await p.waitForFunction(() => window.__game.mode === 'stage');
  await q.waitForSelector('.contrib:has-text("철수")', { timeout: 10000 });
  await q.click('text=⚔️ 공격하기');
  await q.waitForFunction(() => window.__game.mode === 'raid');
  // 토벌 피해는 Big으로 쌓인다 (예전엔 `+=`라 글자가 이어 붙었다)
  await G(q, () => { const g = window.__game; g.contest.damage = g.mon.hp.mul(2); g.contest.time = 0.01; });
  // 철수의 창은 토벌하러 갈 때 내려갔다 — 문파 창을 다시 연다
  await tab(p, 'social');
  await sub(p, '문파');
  await p.waitForSelector('button:has-text("보상 받기")', { timeout: 10000 });
  const shards0 = await G(p, () => N(window.__game.s.relicShards));
  await p.click('button:has-text("보상 받기")');
  await p.waitForSelector('text=보상을 받았어요', { timeout: 10000 });
  assert(await G(p, () => N(window.__game.s.relicShards)) > shards0, '토벌 성공 보상 (신물 조각 포함)');

  console.log('# 비무');
  await tab(q, 'social');
  await sub(q, '비무대');
  await q.waitForSelector('.rank-row:has-text("철수") button:has-text("비무")', { timeout: 10000 });
  await shot(q, '13-pvp-list.png');
  await q.click('.rank-row:has-text("철수") button:has-text("비무")');
  await q.waitForFunction(() => window.__game.mode === 'pvp');
  assert(await G(q, () => window.__game.mon.job) === 'sword', '비무 상대가 제 캐릭터(검)를 든다');
  await sleep(2000);
  await shot(q, '14-pvp.png');
  await finishContest(q, { win: false });
  await q.waitForSelector('.result-title');
  const pvp = await G(q, () => ({ ...window.__game.s.pvp, t: window.__game.s.daily.pvpTickets }));
  assert(pvp.wins + pvp.losses === 1 && pvp.score !== 1000, `비무 결과 반영 (${pvp.wins}승 ${pvp.losses}패, ${pvp.score}점)`);
  await q.click('#modal >> text=확인');

  console.log('# 서열·프로필');
  await tab(q, 'social');
  await sub(q, '서열');
  await q.waitForSelector('.rank-row:has-text("철수")', { timeout: 10000 });
  assert((await q.$$('.rank-row')).length === 2, '서열 2명');
  assert((await q.textContent('.rank-row:has-text("철수")')).includes(t1.tn), `서열에 캐릭터 표시 (${t1.tn})`);
  await q.click('.rank-row:has-text("철수")');
  await q.waitForSelector('#modal h2:has-text("철수")');
  await shot(q, '15-profile.png');
  const prof = await q.textContent('#modal');
  assert(prof.includes('이류') && prof.includes(t1.tn) && prof.includes(t1.name), '프로필에 경지·캐릭터·각성한 무공 이름 표시');

  const errs = [...a.errors, ...b.errors];
  console.log('errors:', errs);
  assert(errs.length === 0, '콘솔 오류 없음');
  await browser.close();
  console.log('ALL OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
