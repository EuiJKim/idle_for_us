// 새 시즌 미리보기 화면(S9) — s2.html(또는 index.html?s2=1)에서만 뜬다. 지금 게임과 세이브가 섞이지 않는다(ifu.s2.*).
// 화면은 엔진(js/s2/game.js)만 본다. 시계는 화면 쪽에서만 읽어 엔진에 넘긴다(엔진은 결정론).
import { Game, newGame, COLLECTS, dayKey } from '../game.js';
import { SAVE_KEY } from '../core/save.js';
import { SLOTS, SLOT_NAME, GRADES, gachaExpNeed } from '../tables/gear.js';
import { JOBS } from '../tables/char.js';
import { SKILLS, MASTERY } from '../tables/skills.js';
import { JOB_LV } from '../tables/progress.js';
import { COLLECT } from '../tables/s5.js';
import { DAILY_DUNGEONS, DAILY_RUNS, EXPEDITION } from '../tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, guideCurrent } from '../tables/missions.js';
import { expToNext } from '../tables/exp.js';
import { staminaNow } from '../content/idle.js';
import { buildQueue } from '../content/offline.js';
import { kindGrade } from '../grow/collect.js';

const $ = (id) => document.getElementById(id);
const now = () => Date.now();
const fmt = (n) => { n = Math.floor(n || 0); if (n >= 1e12) return (n / 1e12).toFixed(1) + '조'; if (n >= 1e8) return (n / 1e8).toFixed(1) + '억'; if (n >= 1e4) return (n / 1e4).toFixed(1) + '만'; return String(n); };
const left = (endMs) => { const s = Math.max(0, Math.ceil((endMs - now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GUIDE_TEXT = { kill: '몹 잡기', level: '레벨 올리기', equip: '장비 끼기', gacha: '장비 뽑기', skill: '무공 올리기', enhance: '장비 강화', dungeon: '던전 깨기', pull: '뽑기', star: '성혼', offline: '방치 보상 받기', realm: '경지 올리기' };
const guideLabel = (q) => {
  if (q.ev === 'level') return `Lv ${q.cond.split('>=')[1].trim()} 달성`;
  if (q.ev === 'kill' && q.cond === 'elite') return '정예 잡기(뽑기 10번마다 나옴)';
  if (q.ev === 'kill' && q.cond === 'boss') return '사냥터 두목 잡기';
  if (q.ev === 'pull') return `${COLLECT[COLLECTS[+q.cond.split('==')[1] - 1]].name} 뽑기 ${q.need}번`;
  if (q.ev === 'dungeon' && q.cond === 'job == 1') return '1차 전직 던전 깨기';
  if (q.ev === 'dungeon') return '수련동 깨기';
  return `${GUIDE_TEXT[q.ev] || q.ev}${q.need > 1 ? ` ${q.need}번` : ''}`;
};

// ── 불러오기 / 새로 시작 ──
let g = null;
function load() {
  try { const t = localStorage.getItem(SAVE_KEY); if (t) g = Game.load(t, now()); } catch { g = null; }
}
let frozen = false;   // 시험용: 저장 멈춤
function save() { if (frozen) return; try { localStorage.setItem(SAVE_KEY, g.save()); } catch { /* 저장 공간 없음 */ } }
function start(job) { g = new Game(newGame(job, now(), (now() & 0x7fffffff) || 1), now()); g.emit('login'); save(); boot(); }

// ── 토스트 · 팝업(4틀: 확인 / 예·아니요 / 확인+확인 / 다시 보지 않기 — 여기선 앞의 둘) ──
function toast(t) { const d = document.createElement('div'); d.textContent = t; $('toast').append(d); setTimeout(() => d.remove(), 2700); }
function pop(title, html, acts = [['확인', null]]) {
  $('pc').innerHTML = `<h3>${esc(title)}</h3><div>${html}</div><div class="acts"></div>`;
  const a = $('pc').querySelector('.acts');
  for (const [label, fn] of acts) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = () => { $('pop').classList.remove('open'); fn?.(); paintHud(); paintWin(); }; a.append(b); }
  $('pop').classList.add('open');
}

// ── 창 ──
const MENUS = [
  ['hero', '무인', ['스탯', '무공', '마스터리', '전직']],
  ['gear', '장비', ['장착', '뽑기', '강화·성혼', '가방']],
  ['grow', '성장', ['병기', '동료', '영물', '경지', '강호행']],
  ['content', '콘텐츠', ['수련동', '무한 탑', '원정', '사냥터']],
  ['mission', '미션', ['길잡이', '일일', '주간', '설정']],
];
let open = null, tab = 0;
function openWin(id, t = 0) { open = id; tab = t; $('win').classList.add('open'); paintWin(); paintNav(); }
function closeWin() { open = null; $('win').classList.remove('open'); paintNav(); }
function paintNav() {
  $('nav').innerHTML = '';
  for (const [id, name] of MENUS) { const b = document.createElement('button'); b.textContent = name; b.className = open === id ? 'on' : ''; b.onclick = () => (open === id ? closeWin() : openWin(id)); $('nav').append(b); }
}
function act(fn) { return () => { const r = fn(); if (r === null || r === false) toast('할 수 없어요(재료·조건)'); save(); paintWin(); paintHud(); return r; }; }
function rowEl(k, v, btns = []) {
  const r = document.createElement('div'); r.className = 'row';
  r.innerHTML = `<div class="k">${k}</div><div class="v">${v ?? ''}</div>`;
  for (const [label, fn, dis] of btns) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.disabled = !!dis; b.onclick = fn; r.append(b); }
  return r;
}
function paintWin() {
  if (!open) return;
  const M = MENUS.find((m) => m[0] === open);
  $('wt').textContent = M[1];
  $('wtabs').innerHTML = '';
  M[2].forEach((n, i) => { const b = document.createElement('button'); b.textContent = n; b.className = i === tab ? 'on' : ''; b.onclick = () => { tab = i; paintWin(); }; $('wtabs').append(b); });
  const B = $('wb'); B.innerHTML = '';
  const W = g.S.wallet, add = (...e) => B.append(...e);
  const key = `${open}:${tab}`;
  const st = g.fighter().st;
  if (key === 'hero:0') {
    add(rowEl('전투력(사냥)', fmt(g.power())), rowEl('전투력(대결)', fmt(g.power('pvp'))));
    for (const [k, n] of [['atk', '공격'], ['hp', '체력'], ['def', '방어'], ['crit', '치명 확률(‰)'], ['critDmg', '치명 피해(‰)'], ['bossDmg', '보스 피해(‰)'], ['final1', '최종 피해①'], ['final2', '최종 피해②'], ['final3', '최종 피해③'], ['final4', '최종 피해④'], ['expP', '경험치(‰)']]) add(rowEl(n, fmt(st[k] || 0)));
  } else if (key === 'hero:1') {
    for (const [k, s] of Object.entries(SKILLS)) {
      const lv = g.S.hero.skills[k] || 0;
      add(rowEl(`${s.name} Lv ${lv}`, lv ? '' : `Lv ${s.unlockLv ?? 1}에 열림`, [['올리기', act(() => g.skillUp(k)), !g.hero.canSkillUp(k)]]));
    }
  } else if (key === 'hero:2') {
    const L = g.S.hero.mastery.learning;
    if (L) add(rowEl(`배우는 중: ${L.id}`, left(L.endMs), [['시간 티켓', act(() => g.timeTicket('mastery', 15)), !(W['ticket:time'] > 0)]]));
    for (const m of MASTERY) {
      const done = g.S.hero.mastery.done.includes(m.id);
      add(rowEl(`${m.id} · 최종 피해① +${m.final1}‰`, done ? '익힘' : `Lv ${m.lv} · ${m.waitMin}분`, done ? [] : [['배우기', act(() => g.learn(m.id)), !g.hero.canLearn(m.id)]]));
    }
  } else if (key === 'hero:3') {
    const n = g.S.hero.adv + 1;
    add(rowEl(`지금 ${g.S.hero.adv}차 · ${JOBS[g.S.hero.job].name}`, ''));
    if (n < JOB_LV.length) add(rowEl(`${n}차 전직 던전`, `Lv ${JOB_LV[n]} 필요`, [['도전', act(() => { const r = g.jobDungeon(); if (r) toast(r.cleared ? `${n}차 전직!` : '실패 — 더 강해져서'); return r; }), g.S.hero.lv < JOB_LV[n]]]));
  } else if (key === 'gear:0') {
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const s of SLOTS) { const it = g.S.gear.eq[s], sl = g.S.gear.slots[s]; grid.innerHTML += `<div class="cell ${it ? 'g' + it.g : ''}"><b>${it ? GRADES[it.g] + (it.up ? '上' : '') : '-'}</b>${SLOT_NAME[s]}<br>+${sl.enh} ★${sl.star}${sl.broken ? '(파괴)' : ''}</div>`; }
    add(grid);
  } else if (key === 'gear:1') {
    const GA = g.S.gacha;
    add(rowEl(`뽑기 레벨 ${GA.lv}`, GA.wait ? `오르는 중 ${left(GA.wait.endMs)}` : `경험치 ${GA.exp}/${gachaExpNeed(GA.lv)}`, GA.wait ? [['시간 티켓', act(() => g.timeTicket('gacha', 15)), !(W['ticket:time'] > 0)]] : []));
    add(rowEl(`뽑기권 ${W['ticket:gear'] || 0}장 · 정예 대기 ${GA.eliteQ}`, '10번마다 사냥터에 정예'));
    for (const n of [1, 10, 30]) add(rowEl(`${n}번 뽑기`, (W['ticket:gear'] || 0) >= n ? '뽑기권' : '은자', [['뽑기', act(() => { const r = g.pullGear(n); if (r) toast(`${r.items.map((i) => GRADES[i.g]).join(' ')}${r.got.some((x) => x.equipped) ? ' · 더 좋은 것 장착' : ''}`); return r; })]]));
  } else if (key === 'gear:2') {
    for (const s of SLOTS) {
      const sl = g.S.gear.slots[s];
      add(rowEl(`${SLOT_NAME[s]} +${sl.enh} ★${sl.star}`, sl.broken ? '파괴됨' : '', [['강화', act(() => { const r = g.enhance(s); if (r !== null) toast(r ? '강화 성공' : '강화 실패'); return r; })], ['성혼', act(() => { const r = g.star(s); if (r) toast({ ok: '성혼 성공', fail: '실패', down: '하락', break: '파괴!' }[r]); return r; }), !!sl.broken]]));
    }
  } else if (key === 'gear:3') {
    add(rowEl(`가방 ${g.S.gear.bag.length}개`, ''));
    add(rowEl('자동 분해', g.S.gear.autoDis < 0 ? '끔' : `${GRADES[g.S.gear.autoDis]} 이하`, [['바꾸기', act(() => { g.S.gear.autoDis = g.S.gear.autoDis >= 3 ? -1 : g.S.gear.autoDis + 1; return true; })]]));
  } else if (open === 'grow' && tab <= 2) {
    const sys = COLLECTS[tab], C = g.S.colls[sys], D = COLLECT[sys];
    add(rowEl(`${D.name} 뽑기권 ${W[`ticket:${sys}`] || 0}장`, `천장 ${C.pity}/200`, [['1번', act(() => g.pullCollect(sys, 1))], ['10번', act(() => { const r = g.pullCollect(sys, 10); if (r) toast(r.map((x) => GRADES[x.g]).join(' ')); return r; })]]));
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const [k, o] of Object.entries(C.own).sort((a, b) => kindGrade(sys, +b[0]) - kindGrade(sys, +a[0]))) { const gr = kindGrade(sys, +k); grid.innerHTML += `<div class="cell g${gr}"><b>${GRADES[gr]}</b>#${k}${C.eq.includes(+k) ? ' 장착' : ''}<br>각성 ${o.awk} · ×${o.n}</div>`; }
    add(grid);
  } else if (key === 'grow:3') {
    const R = g.S.realm;
    add(rowEl(`경지 ${R.lv}`, R.wait ? `오르는 중 ${left(R.wait.endMs)}` : '', R.wait ? [['시간 티켓', act(() => g.timeTicket('realm', 15)), !(W['ticket:time'] > 0)]] : [['올리기', act(() => g.realmUp())]]));
  } else if (key === 'grow:4') {
    const J = g.S.journey;
    add(rowEl(`강호행 ${J.step}단계 · 이긴 두목 ${J.cleared}`, J.wait ? `여는 중 ${left(J.wait.endMs)}` : ''));
    add(rowEl(`${J.cleared + 1}단계 두목`, '', [['도전', act(() => { const r = g.journeyFight(); toast(r.cleared ? '이겼다' : '졌다'); return r; })]]));
    add(rowEl('다음 단계 열기', '', [['열기', act(() => g.journeyOpen()), !!J.wait || J.cleared <= J.step]]));
  } else if (key === 'content:0') {
    add(rowEl(`입장권 ${staminaNow(g.S.stamina.daily, now())}`, '2시간마다 1'));
    for (const [k, D] of Object.entries(DAILY_DUNGEONS)) add(rowEl(`${D.name}`, `Lv ${D.unlockLv} · 오늘 ${g.S.dungeons.runs[k] || 0}/${DAILY_RUNS}`, [['입장', act(() => { const r = g.dailyDungeon(k); if (r) toast(r.cleared ? '클리어' : '실패'); return r; }), g.S.hero.lv < D.unlockLv]]));
  } else if (key === 'content:1') {
    add(rowEl(`무한 탑 ${g.S.tower.best}층`, '깬 층만큼 영구 보너스', [['다음 층', act(() => { const r = g.towerFight(); toast(r.cleared ? `${g.S.tower.best}층!` : '실패'); return r; })]]));
  } else if (key === 'content:2') {
    const E = g.S.exped;
    if (E.run) add(rowEl(`원정 ${E.run.hours}시간`, now() >= E.run.endMs ? '끝남' : left(E.run.endMs), [['받기', act(() => g.claimExped()), now() < E.run.endMs], ['시간 티켓', act(() => g.timeTicket('exped', 15)), !(W['ticket:time'] > 0)]]));
    else for (const h of EXPEDITION.hours) add(rowEl(`${h}시간 원정`, `원정권 ${W['ticket:exped'] || 0}`, [['출발', act(() => g.startExped(h))]]));
  } else if (key === 'content:3') {
    add(rowEl('사냥터', g.S.autoZone ? `자동(Lv ${g.zoneLv()})` : `Lv ${g.S.zone}`, [['−5', act(() => { g.S.autoZone = false; g.S.zone = Math.max(1, g.zoneLv() - 5); return true; })], ['+5', act(() => { g.S.autoZone = false; g.S.zone = Math.min(g.S.hero.lv + 10, g.zoneLv() + 5); return true; })], ['자동', act(() => { g.S.autoZone = true; return true; })]]));
  } else if (key === 'mission:0') {
    for (const q of GUIDE) { const s = g.S.q.guide[q.id]; add(rowEl(`${q.id} ${guideLabel(q)}`, s?.got ? '받음' : s?.done ? '끝' : s ? `${s.p}/${q.need}` : '')); }
  } else if (key === 'mission:1' || key === 'mission:2') {
    const book = tab === 1 ? 'daily' : 'weekly', list = tab === 1 ? DAILY_MISSIONS : WEEKLY_MISSIONS;
    for (const q of list) { const s = g.books[book].get(q.id); add(rowEl(`${guideLabel(q)}`, s.got ? '받음' : `${s.p}/${q.need}`, [['받기', act(() => g.claimMission(book, q.id)), !s.done || s.got]])); }
  } else if (key === 'mission:3') {
    add(rowEl(`시간 티켓 ${W['ticket:time'] || 0}장`, '1장 = 15분'));
    add(rowEl('새로 시작', '이 미리보기 세이브만 지움', [['처음부터', () => pop('새로 시작할까요?', '<p class="note">새 시즌 미리보기 세이브만 지워요. 지금 게임 세이브는 그대로예요.</p>', [['아니요', null], ['예', () => { localStorage.removeItem(SAVE_KEY); location.reload(); }]])]]));
    add(rowEl('지금 게임으로', '', [['돌아가기', () => { location.href = 'index.html'; }]]));
    add(Object.assign(document.createElement('p'), { className: 'note', textContent: '새 시즌 미리보기예요. 숫자·화면은 계속 바뀌고, 그림·소리는 아직 임시예요.' }));
  }
}

// ── 네 귀퉁이(HUD) ──
function paintHud() {
  const S = g.S, H = S.hero, F = g.fight;
  $('tl').innerHTML = `<div class="lv">Lv ${H.lv} · ${JOBS[H.job].name} ${H.adv ? H.adv + '차' : ''}</div><div class="bar"><i style="width:${Math.min(100, (H.exp / expToNext(H.lv)) * 100)}%"></i></div><div class="bar hp"><i style="width:${F ? Math.max(0, (F.hero.hp / F.hero.st.hp) * 100) : 100}%"></i></div><div class="pw">전투력 ${fmt(g.power())} · 사냥터 Lv ${g.zoneLv()}</div>`;
  $('tr').innerHTML = `<span class="cur">은자 ${fmt(S.wallet.gold)}</span><br><span class="cur">뽑기권 ${S.wallet['ticket:gear'] || 0}</span><br><span class="cur">시간 티켓 ${S.wallet['ticket:time'] || 0}</span>`;
  const cur = guideCurrent(S.q.guide), cs = cur && S.q.guide[cur.id];
  $('bl').innerHTML = cur ? `<div class="guide ${cs?.done ? 'done' : ''}" id="gd" role="button" tabindex="0"><b>길잡이 ${cur.id.slice(1)}</b> ${esc(guideLabel(cur))} ${cs?.done ? '— <b>받기</b>' : `(${cs?.p || 0}/${cur.need})`}</div>` : '';
  const gd = $('gd');
  if (gd) gd.onclick = () => { if (cs?.done) { const r = g.claimGuide(); if (r) toast(`길잡이 ${r.id.slice(1)} 보상`); save(); paintHud(); } else if (cur.go) openWin(goWin(cur.go)[0], goWin(cur.go)[1]); };
  const sud = S.sudden.cur;
  $('br').innerHTML = `${sud ? `<div class="cur">돌발 미션 ${sud.p}/${sud.need} · ${left(sud.endMs)}</div><br>` : ''}<button class="round" id="sk">무공<small>${F && F.hero.nextSkill > F.t ? Math.ceil((F.hero.nextSkill - F.t) / 1000) + '초' : '자동'}</small></button>`;
}
const goWin = (go) => ({ gear: ['gear', 0], gacha: ['gear', 1], skill: ['hero', 1], slot: ['gear', 2], job: ['hero', 3], pal: ['grow', 1], weapon: ['grow', 0], relic: ['grow', 2], daily: ['content', 0], realm: ['grow', 3], hunt: ['content', 3] }[go] || ['mission', 0]);

// ── 사냥 화면(임시 그림: 도형) ──
const cv = $('cv'), cx = cv.getContext('2d');
const floats = [];
function draw() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const F = g.fight; if (!F) return;
  const W = cv.width, Hh = cv.height, sx = W / F.def.w, sy = Hh / F.def.h, s = Math.min(sx, sy);
  const ox = (W - F.def.w * s) / 2, oy = (Hh - F.def.h * s) / 2;
  const P = (x, y) => [ox + x * s, oy + y * s];
  cx.fillStyle = '#26301f'; cx.fillRect(0, 0, W, Hh);
  cx.fillStyle = '#2d3a24'; for (let i = 0; i < 40; i++) { const [x, y] = P((i * 7919) % F.def.w, (i * 104729) % F.def.h); cx.fillRect(x, y, 6 * dpr, 3 * dpr); }
  for (const m of F.mobs) {
    const [x, y] = P(m.x, m.y), rad = (m.kind === 'boss' ? 26 : m.kind === 'elite' ? 17 : 11) * dpr;
    cx.fillStyle = m.kind === 'boss' ? '#8b2a2a' : m.kind === 'elite' ? '#6a3a8b' : '#6b5a3a';
    cx.beginPath(); cx.arc(x, y, rad, 0, 7); cx.fill();
    cx.fillStyle = '#000a'; cx.fillRect(x - rad, y - rad - 7 * dpr, rad * 2, 4 * dpr);
    cx.fillStyle = '#e06a5a'; cx.fillRect(x - rad, y - rad - 7 * dpr, rad * 2 * Math.max(0, m.hp / m.st.hp), 4 * dpr);
  }
  const [hx, hy] = P(F.hero.x, F.hero.y);
  cx.fillStyle = '#e8c26a'; cx.beginPath(); cx.arc(hx, hy, 13 * dpr, 0, 7); cx.fill();
  cx.strokeStyle = '#fff6'; cx.lineWidth = 2 * dpr; cx.stroke();
  const t = now();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], a = (t - f.at) / 900;
    if (a > 1) { floats.splice(i, 1); continue; }
    const [x, y] = P(f.x, f.y);
    cx.globalAlpha = 1 - a; cx.fillStyle = f.crit ? '#ffb347' : '#fff'; cx.font = `${(f.crit ? 16 : 12) * dpr}px system-ui`; cx.textAlign = 'center';
    cx.fillText(fmt(f.d), x, y - 20 * dpr - a * 24 * dpr); cx.globalAlpha = 1;
  }
}

// ── 돌리기 ──
let last = 0, lastMin = 0, lastSave = 0, lastHud = 0, acc = 0;
function frame() {
  const t = now();
  acc = Math.min(1000, acc + (t - last)); last = t;
  const dt = acc - (acc % 50); acc -= dt;   // 엔진은 50ms 틱 — 남는 몫은 다음 프레임으로
  g.tick(t);
  if (dt > 0) {
    const mobs = new Map(g.ensureFight().mobs.map((m) => [m.id, m]));
    g.hunt(dt);
    for (const e of g.lastEvents || []) if (e[0] === 'hit') { const m = mobs.get(e[2]) || g.fight.mobs.find((x) => x.id === e[2]); if (m && floats.length < 40) floats.push({ x: m.x, y: m.y, d: e[3], crit: e[4], at: t }); }
  }
  if (t - lastMin >= 60000) { lastMin = t; g.minute(); }
  for (const f of g.feed.splice(0)) {
    if (f.k === 'level') toast(`레벨 업! Lv ${f.lv}`);
    else if (f.k === 'guide') toast('길잡이 완료 — 왼쪽 아래에서 받기');
    else if (f.k === 'advance') toast(`${f.n}차 전직!`);
    else if (f.k === 'boss') toast('사냥터 두목 처치!');
    else if (f.k === 'sudden') toast(`돌발 미션: 10분 안에 ${f.need}마리`);
    else if (f.k === 'realm') toast(`경지 ${f.lv}`);
    else if (f.k === 'gacha-lv') toast(`뽑기 레벨 ${f.lv}`);
  }
  draw();
  if (t - lastHud > 250) { lastHud = t; paintHud(); }
  if (t - lastSave > 10000) { lastSave = t; save(); }
  requestAnimationFrame(frame);
}
// 돌아왔을 때 대기열 — 방치 보상부터 하나씩
function returnQueue() {
  const p = g.returnCheck(now());
  const q = buildQueue([...(p ? [{ kind: 'offline', p }] : [])]);
  for (const it of q) if (it.kind === 'offline') {
    const p2 = it.p;
    pop('방치 보상', `<p>${Math.floor(p2.ms / 60000)}분 동안 사냥했어요${p2.capped ? '(최대 12시간)' : ''}.</p><p>경험치 ${fmt(p2.exp)} · 은자 ${fmt(p2.gold)}</p>`, [['받기', () => { g.claimOffline(false); save(); }], ['광고 보고 ×2', () => { const r = g.claimOffline(true); toast(r?.x === 2 ? '×2 받음' : '오늘 광고 ×2는 다 썼어요'); save(); }]]);
  }
}
function boot() {
  $('pop').classList.remove('open');
  paintNav(); paintHud();
  returnQueue();
  last = now(); lastMin = now();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!g) return; if (document.hidden) save(); else { returnQueue(); last = now(); } });
window.addEventListener('pagehide', () => g && save());
$('wx').onclick = closeWin;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('pop').classList.contains('open')) $('pop').classList.remove('open'); else closeWin(); } });
$('stage').addEventListener('click', (e) => { if (e.target.id === 'sk' || e.target.closest?.('#sk')) g.fight?.press('skill'); });

load();
if (g) boot();
else pop('새 시즌 — 무인 고르기', '<p class="note">미리보기예요. 지금 게임 세이브와 섞이지 않아요.</p>', Object.entries(JOBS).map(([k, j]) => [j.name, () => start(k)]));
// 시험용 손잡이
window.__s2 = { get g() { return g; }, save, dayKey, freeze: () => { frozen = true; } };
