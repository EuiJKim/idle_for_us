// 새 시즌 미리보기 화면(S9) — s2.html(또는 index.html?s2=1)에서만 뜬다. 지금 게임과 세이브가 섞이지 않는다(ifu.s2.*).
// 화면은 엔진(js/s2/game.js)만 본다. 시계는 화면 쪽에서만 읽어 엔진에 넘긴다(엔진은 결정론).
import { Game, newGame, COLLECTS, dayKey, STAGE_KILLS } from '../game.js';
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
import { loadLooks, zoneFor, drawHero, drawMob, mobName, drawPaintedBack, drawPaintedLedge, preloadChapter, fxImg, oldImg, tintImg, ULT_ART, SEAL_ART, CUT_ART, BUFF_ART } from './look.js';
import { chapterOf, chapterName } from '../tables/chapters.js';
import { KIT, SLOT_N, kitCap, kitCost, kitCoef, skillById, treeOf, TREE_GATE, treeResetCost } from '../tables/kit.js';
import { STATS } from '../core/stats.js';
const statTxt = (o) => Object.entries(o).map(([k2, v]) => `${STATS[k2]?.name || k2} +${STATS[k2]?.kind === 'rate' ? `${(v / 10).toFixed(1)}%` : v}`).join(' · ');
import { goldPerMob } from '../tables/gearstat.js';

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
  ['hero', '무인', ['스탯', '무공', '마스터리', '전직', '무공 강화']],
  ['gear', '장비', ['장착', '뽑기', '강화·성혼', '가방']],
  ['grow', '성장', ['병기', '동료', '영물', '경지', '강호행']],
  ['content', '콘텐츠', ['수련동', '무한 탑', '원정', '스테이지']],
  ['rival', '경쟁', ['월드보스', '대결', '문파']],
  ['mission', '미션', ['길잡이', '일일', '주간', '설정']],
];
let open = null, tab = 0, treeSel = null;
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
    // v493 무공 세트 — 차수별 목록 · 레벨 · 칸 · 자동
    const Hs = g.hero, K = Hs.kitState(), cap = kitCap(g.S.hero.lv);
    const KIND = { active: '공격', passive: '상시', buff: '버프' }, SHAPE = { line: '앞 일직선', arc: '앞 부채꼴', circle: '주변', rain: '앞쪽 하늘에서' };
    add(Object.assign(document.createElement('p'), { className: 'note', textContent: `칸 ${K.slots.length}/${SLOT_N} — 자동 사냥이면 칸 순서대로 준비된 무공을 저절로 써요. 무공 레벨 상한 ${cap}(무인 레벨 5마다 1).` }));
    for (const sk of KIT[g.S.hero.job]) {
      const lv = K.lv[sk.id] || 0, slot = K.slots.indexOf(sk.id), on = !K.off.includes(sk.id);
      const desc = sk.kind === 'active' ? `${SHAPE[sk.shape]} · 최대 ${sk.maxT}마리 · ${sk.hits}연타 · 한 대 ${(kitCoef(sk, Math.max(1, lv)) / 10).toFixed(0)}% · 쿨 ${sk.cdMs / 1000}초`
        : sk.kind === 'buff' ? `${sk.durMs / 1000}초 동안 ${statTxt(sk.stats(Math.max(1, lv)))} · 쿨 ${sk.cdMs / 1000}초`
          : statTxt(sk.stats(Math.max(1, lv)));
      const btns = lv ? [['올리기', act(() => Hs.kitUp(sk.id, g.S.wallet) && (g.dirtyStats = true, g.emit('skill'), true)), !Hs.canKitUp(sk.id)]] : [];
      if (lv && sk.kind !== 'passive') {
        btns.push([slot >= 0 ? `${slot + 1}칸 ▶` : '칸에 넣기', act(() => { const i = slot >= 0 ? (slot + 1) % K.slots.length : Math.min(K.slots.length, SLOT_N - 1); const r = Hs.kitSlot(i, sk.id); g.dirtyStats = true; return r; })]);
        if (slot >= 0) btns.push([on ? '자동' : '수동', act(() => { Hs.kitAuto(sk.id, !on); g.dirtyStats = true; return true; })]);
      }
      add(rowEl(`<b style="color:${sk.col}">${sk.name}</b> <small>${sk.tier}차 · ${KIND[sk.kind]}${lv ? ` · Lv ${lv}` : ''}</small><br><span class="note">${desc}</span>`, lv ? (lv < cap ? `${unit(kitCost(lv, sk.tier)[0].n)} 은자` : '상한') : `${sk.tier}차 전직 때 열림`, btns));
    }
  } else if (key === 'hero:4') {
    // v494 무공 강화 트리 — 무공마다 3단(1단 → 5점 → 2단 → 12점 → 3단 · 배우는 시간)
    const Hs = g.hero, K = Hs.kitState(), pts = g.treePts();
    const owned = KIT[g.S.hero.job].filter((sk) => K.lv[sk.id] && sk.kind !== 'passive');
    if (!owned.some((sk) => sk.id === treeSel)) treeSel = owned[0]?.id;
    add(rowEl(`무공 점수 <b>${pts.left}</b> / ${pts.total}`, '레벨마다 1점 · 10칸마다 3점', [['초기화', () => pop('트리를 초기화할까요?', `<p>쓴 점수 ${pts.used}점을 돌려받아요.</p><p class="note">은자 ${unit(treeResetCost(pts.used)[0].n)}</p>`, [['아니요', null], ['예', act(() => g.treeReset())]]), !pts.used || !!K.learning]]));
    if (K.learning) { const sk = skillById(K.learning.id), nd = treeOf(sk).find((x) => x.n === K.learning.n); add(rowEl(`배우는 중: ${sk.name} · ${nd.name}`, left(K.learning.endMs), [['시간 티켓', act(() => g.timeTicket('tree', 15)), !(g.S.wallet['ticket:time'] > 0)]])); }
    const chips = document.createElement('div'); chips.className = 'tabs'; chips.style.border = '0'; chips.style.padding = '6px 0';
    for (const sk of owned) { const b = document.createElement('button'); b.textContent = `${sk.name} ${Hs.treeSpent(sk.id) ? `(${Hs.treeSpent(sk.id)})` : ''}`; b.className = sk.id === treeSel ? 'on' : ''; b.style.color = sk.col; b.onclick = () => { treeSel = sk.id; paintWin(); }; chips.append(b); }
    add(chips);
    const sk = skillById(treeSel);
    if (sk) {
      const spent = Hs.treeSpent(sk.id), nodes = K.tree?.[sk.id] || {};
      for (let tier = 0; tier < 3; tier++) {
        const list = treeOf(sk).filter((nd) => nd.tier === tier); if (!list.length) continue;
        const open = spent >= TREE_GATE[tier];
        add(Object.assign(document.createElement('p'), { className: 'note', textContent: `${tier + 1}단 ${open ? '' : `— 이 무공에 ${TREE_GATE[tier]}점 쓰면 열림(지금 ${spent}점)`}` }));
        for (const nd of list) {
          const lv = nodes[nd.n] || 0, eff = Object.entries(nd.eff).map(([k2, v]) => ({ pow: `위력 +${v / 10}%`, cdr: `쿨 −${v / 10}%`, rng: `범위 +${v / 10}%`, tgt: `대상 +${v}`, hit: `연타 +${v}`, cri: `이 무공 치명 +${v / 10}%`, dur: `지속 +${v / 10}%`, amp: `효과 +${v / 10}%` }[k2])).join(' · ');
          add(rowEl(`<b>${nd.name}</b> <small>${lv}/${nd.max}</small><br><span class="note">레벨마다 ${eff}${nd.waitMin ? ` · 배우는 데 ${nd.waitMin}분` : ''}</span>`, `${nd.pts}점`, [[lv >= nd.max ? '끝' : '올리기', act(() => { const r = g.treeUp(sk.id, nd.n); if (r === 'wait') toast(`${nd.name} 배우기 시작 — ${nd.waitMin}분`); return r; }), !Hs.canTreeUp(sk.id, nd.n, g.stage().top)]]));
        }
      }
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
    const T = g.stage();
    add(rowEl(`지금 ${Math.ceil(T.idx / 10)}장 ${((T.idx - 1) % 10) + 1}칸`, `가장 멀리 ${Math.ceil(T.top / 10)}장 ${((T.top - 1) % 10) + 1}칸`, [['◀ 앞 칸', act(() => { if (g.bossFight || T.idx <= 1) return false; T.idx--; T.kills = 0; return true; })], ['다음 칸 ▶', act(() => { if (g.bossFight || T.idx >= T.top) return false; T.idx++; T.kills = 0; return true; })]]));
    add(rowEl('두목 자동 도전', T.auto ? '켬 — 칸 몹을 다 잡으면 저절로' : '끔 — 도전 단추로', [['바꾸기', act(() => { T.auto = !T.auto; return true; })]]));
  } else if (key === 'rival:0') {
    const Wb = g.S.wb || { used: 0, best: 0, total: 0, day: '' };
    const used = Wb.day === String(dayKey(now())) ? Wb.used : 0;
    add(rowEl('월드보스 — 90초 동안 넣은 피해가 점수', `오늘 ${used}/3번`, [['도전', act(() => { const r = g.wbossFight(); if (r) pop('월드보스', `<p>피해 ${fmt(r.dmg)}</p><p>점수 <b>${fmt(r.score)}</b></p><p class="note">큰 피해일수록 점수가 덜 올라요(구간표).</p>`); return r; }), used >= 3]]));
    add(rowEl('이번 주 점수 합', fmt(Wb.total)), rowEl('이번 주 한 번 최고', fmt(Wb.best)));
    add(Object.assign(document.createElement('p'), { className: 'note', textContent: '미리보기: 서버 공동 체력·순위는 교체 때 붙어요. 점수 계산은 실제와 같아요.' }));
  } else if (key === 'rival:1') {
    const P = g.S.pvp || { score: 1000, used: 0, day: '', log: [] };
    const used = P.day === String(dayKey(now())) ? P.used : 0;
    add(rowEl(`대결 점수 ${P.score}`, `오늘 ${used}/5번`));
    g.pvpOpponents().forEach((o, i) => add(rowEl(`${o.name} · ${JOBS[o.f.job].name} Lv ${o.f.lv}`, `대결 전투력 ${fmt(o.pw)}`, [['도전', act(() => { const r = g.pvpFight(i); if (r) pop(r.win ? '승리' : '패배', `<p>점수 ${r.d >= 0 ? '+' : ''}${r.d} → ${r.score} (${r.tier})</p>`); return r; }), used >= 5]])));
    for (const l of (g.S.pvp?.log || [])) add(rowEl(`${l.win ? '승' : '패'} · ${l.name}`, `${l.d >= 0 ? '+' : ''}${l.d}`));
  } else if (key === 'rival:2') {
    add(rowEl('문파', '교체 때 서버와 함께 열려요'));
    for (const [n, d] of [['문파 토벌', '문파원 피해를 모아 주간 두목 단계를 깸'], ['문파 대항', '문파끼리 한 주 점수 겨루기'], ['문파 수련', '문파원 기여로 막대를 채우면 모두 보상'], ['연구 · 도움', '연구는 대기 시간, 문파원이 도와주면 줄어듦']]) add(rowEl(n, d));
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

// ── 화면 귀퉁이(HUD) ── 단추는 한 번 만들고 글자만 바꾼다(누르는 사이 다시 그려지면 눌림이 사라진다)
const unit = (n) => {   // 큰 수: 만 · 억 · 조 · 경 두 자리까지(예: 307억 7367만)
  n = Math.floor(n || 0);
  const U = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  for (let i = 0; i < U.length; i++) if (n >= U[i][0]) { const a = Math.floor(n / U[i][0]), r = U[i + 1] ? Math.floor((n % U[i][0]) / U[i + 1][0]) : 0; return `${a}${U[i][1]}${r ? ` ${r}${U[i + 1][1]}` : ''}`; }
  return String(n);
};
const logLines = [];
function addLog(t) { logLines.unshift(t); logLines.length = Math.min(logLines.length, 4); }
function paintHud() {
  const S = g.S, H = S.hero, F = g.ensureFight(), T = g.stage(), z = zoneFor(g.zoneLv());
  if (!$('gd')) {
    $('tl').innerHTML = '<div class="prof"><div class="face" id="face"></div><div class="pw" id="pw"></div></div><div class="curs" id="curs"></div><div class="guide" id="gd" role="button" tabindex="0"></div>';
    $('gd').onclick = onGuide;
    $('tc').innerHTML = '<div class="zname" id="zn"></div><div class="sbar" id="sb"><i></i></div><div class="sbar time" id="tb" style="display:none"><i></i></div><div class="srow"><span id="sl"></span><button id="chal">도전</button></div>';
    $('chal').onclick = () => { if (g.challenge()) toast('칸 두목 도전!'); else toast(`몹을 ${STAGE_KILLS}마리 잡으면 도전할 수 있어요`); };
    $('tr').innerHTML = '<div class="chat" id="chat"></div><div class="rw" id="rw"></div>';
    $('bc').innerHTML = '<div class="me"><div class="top"><span id="mlv"></span><span id="mnm"></span></div><div class="bar hp"><i id="hpi"></i><b>HP</b><span id="hpt"></span></div><div class="bar mp"><i id="mpi"></i><b>MP</b><span id="mpt"></span></div></div>';
    $('bl').innerHTML = '<div class="log" id="log"></div><div class="exp" id="exp"></div><div class="pad"><button id="pl" aria-label="왼쪽">◀</button><button id="pd" aria-label="내려가기">▼</button><button id="pr" aria-label="오른쪽">▶</button></div>';
    $('br').innerHTML = '<button class="auto" id="au"></button><div class="slots" id="slots"></div><button class="jump" id="jp" aria-label="점프">⤒</button>';
    padHold('pl', -1); padHold('pr', 1);
    $('pd').onpointerdown = (e) => { e.preventDefault(); g.down(); };
    $('jp').onpointerdown = (e) => { e.preventDefault(); g.jump(); };
    $('au').onclick = () => { g.setAuto(S.auto === false); toast(g.S.auto === false ? '수동 — ◀ ▶ 로 움직이고 점프 · 무공은 칸을 눌러요' : '자동 사냥'); save(); paintHud(); };
  }
  $('face').textContent = JOBS[H.job].name[0];
  $('pw').innerHTML = `⚔ ${unit(g.power())}<small>${JOBS[H.job].name}${H.adv ? ` ${H.adv}차` : ''}</small>`;
  $('curs').innerHTML = `<span><i>●</i> ${unit(S.wallet.gold)}</span><span><i>◆</i> ${S.wallet['ticket:gear'] || 0}</span><span><i>⌛</i> ${S.wallet['ticket:time'] || 0}</span>`;
  const cur = guideCurrent(S.q.guide), cs = cur && S.q.guide[cur.id], gd = $('gd');
  gd.style.display = cur ? '' : 'none';
  if (cur) { gd.className = `guide ${cs?.done ? 'done' : ''}`; gd.innerHTML = `<b>길잡이 ${cur.id.slice(1)}</b>${esc(guideLabel(cur))}: ${cs?.done ? '<b style="display:inline">받기</b>' : `${cs?.p || 0}/${cur.need}`}`; }
  // 위 가운데: 지역 · 칸
  const ch = Math.ceil(T.idx / 10), st = ((T.idx - 1) % 10) + 1, boss = !!g.bossFight;
  $('zn').textContent = boss ? `${ch}. ${chapterName(T.idx)} — 두목` : `${ch}. ${chapterName(T.idx)}`;
  const sb = $('sb'), tb = $('tb');
  if (boss) {
    const B = g.bossFight, bm = B.mobs.find((m) => m.kind === 'boss');
    sb.className = 'sbar boss'; sb.firstChild.style.width = `${bm ? Math.max(0, bm.hp / bm.st.hp) * 100 : 0}%`;
    tb.style.display = ''; tb.firstChild.style.width = `${Math.max(0, 1 - B.t / B.limitMs) * 100}%`;
    $('sl').textContent = `${bm ? mobName(bm, z) : ''} ${bm ? Math.ceil(bm.hp / bm.st.hp * 100) : 0}% · ${Math.max(0, Math.ceil((B.limitMs - B.t) / 1000))}초`;
    $('chal').style.display = 'none';
  } else {
    sb.className = 'sbar'; sb.firstChild.style.width = `${(T.kills / STAGE_KILLS) * 100}%`; tb.style.display = 'none';
    $('sl').textContent = `Stage ${st}/10`; $('chal').style.display = ''; $('chal').disabled = !g.canChallenge();
  }
  // 오른쪽 위: 알림 줄 · 두목전 보상
  $('chat').textContent = `[알림] ${logLines[0] || '새 시즌 미리보기 — 그림은 지금 게임 것을 빌려 써요'}`;
  const rw = $('rw'); rw.style.display = boss ? 'block' : 'none';
  if (boss) rw.innerHTML = `<b>클리어 보상</b><br>은자 ${unit(2 * 27 * goldPerMob(T.idx))} · 뽑기권 ${T.idx % 10 === 0 ? 10 : 1}`;
  // 아래 가운데: 나
  const Hh = F.hero;
  $('mlv').textContent = `Lv.${H.lv}`; $('mnm').textContent = JOBS[H.job].name;
  $('hpi').style.width = `${Math.max(0, Hh.hp / Hh.st.hp) * 100}%`; $('hpt').textContent = `${unit(Math.max(0, Hh.hp))}/${unit(Hh.st.hp)}`;
  const mpMax = 100 + H.lv * 20, mp = Math.round(mpMax * Math.min(1, Math.max(0, (Hh.nextSkill - F.t) <= 0 ? 1 : 1 - (Hh.nextSkill - F.t) / 6000)));
  $('mpi').style.width = `${(mp / mpMax) * 100}%`; $('mpt').textContent = `${mp}/${mpMax}`;
  // 왼쪽 아래: 얻은 것 · 경험치
  $('log').innerHTML = logLines.slice(0, 3).map((l) => `<div>${esc(l)}</div>`).join('');
  const xp = Math.min(100, (H.exp / expToNext(H.lv)) * 100);
  $('exp').textContent = `EXP ${xp.toFixed(3)}%`; $('xpbar').firstChild.style.width = `${xp}%`;
  // 오른쪽 아래: 자동 · 무공 칸
  $('au').className = `auto ${S.auto === false ? 'off' : ''}`; $('au').innerHTML = S.auto === false ? '수동' : '자동<br>사냥';
  const sl = $('slots'), kit = Hh.kit || [];
  if (sl.children.length !== SLOT_N) {
    sl.innerHTML = '';
    for (let i = 0; i < SLOT_N; i++) {
      const b = document.createElement('button'); b.className = 'slot'; b.dataset.i = i;
      b.onpointerdown = (e) => { e.preventDefault(); g.ensureFight().press({ slot: i }); };
      sl.append(b);
    }
  }
  for (const b of sl.children) {
    const i = +b.dataset.i, k = kit[i], sk = k && skillById(k.id);
    b.classList.toggle('on', !!sk);
    b.style.borderColor = sk ? sk.col : '';
    const name = sk ? sk.name.slice(0, 2) : '';
    if (b.dataset.n !== name) { b.dataset.n = name; b.innerHTML = `<span style="font-weight:800;color:${sk ? sk.col : '#888'}">${name}</span>${sk && k.auto ? '<i class="ad"></i>' : ''}`; }
    let cd = b.querySelector('.cd');
    const left = sk && Hh.cds ? Math.ceil((Hh.cds[i] - F.t) / 1000) : 0;
    if (left > 0) { if (!cd) { cd = document.createElement('div'); cd.className = 'cd'; b.append(cd); } cd.textContent = left; } else cd?.remove();
  }
}
function padHold(id, dir) {
  const b = $(id);
  const on = (e) => { e.preventDefault(); b.classList.add('on'); g.hold(dir); };
  const off = () => { if (!b.classList.contains('on')) return; b.classList.remove('on'); g.hold(0); };
  b.onpointerdown = on; b.onpointerup = off; b.onpointerleave = off; b.onpointercancel = off;
}
function onGuide() {
  const cur = guideCurrent(g.S.q.guide), cs = cur && g.S.q.guide[cur.id];
  if (!cur) return;
  if (cs?.done) { const r = g.claimGuide(); if (r) toast(`길잡이 ${r.id.slice(1)} 보상`); save(); paintHud(); }
  else if (cur.go) openWin(goWin(cur.go)[0], goWin(cur.go)[1]);
}
const goWin = (go) => ({ gear: ['gear', 0], gacha: ['gear', 1], skill: ['hero', 1], slot: ['gear', 2], job: ['hero', 3], pal: ['grow', 1], weapon: ['grow', 0], relic: ['grow', 2], daily: ['content', 0], realm: ['grow', 3], hunt: ['content', 3] }[go] || ['mission', 0]);

// ── 옆보기 사냥 화면 ──
const cv = $('cv'), cx = cv.getContext('2d');
const floats = [];
let lastHitAt = 0, heroRun = 0, lastHx = 0, skillFx = [], camSm = null, camSy = null, cutIn = null, shakeUntil = 0;
const mobPrev = new Map();
// 그린 무공 효과 — 모양마다 놓는 자리 · 크기 · 움직임
function drawFxImage(cx, im, f, a, ease, fade, x, y, Rpx, k, big) {
  const ar = im.height / im.width;
  cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = Math.max(0, fade);
  if (f.shape === 'line') {
    const w = Rpx * (0.35 + 0.75 * ease), h = Math.max(70 * k, w * ar * 0.55) * big;
    cx.translate(x, y - 34 * k); cx.scale(f.face, 1); cx.drawImage(im, -w * 0.08, -h / 2, w * 1.08, h);
  } else if (f.shape === 'arc') {
    const w = Rpx * 1.15 * (0.75 + 0.25 * ease) * big, h = w * ar;
    cx.translate(x, y - 34 * k); cx.scale(f.face, 1); cx.rotate(-0.35 + ease * 0.5); cx.drawImage(im, -w * 0.25, -h / 2, w, h);
  } else if (f.shape === 'circle') {
    const w = Rpx * 2.2 * (0.4 + 0.6 * ease) * big, h = w * ar;
    cx.translate(x, y); cx.drawImage(im, -w / 2, -h * 0.72, w, h);   // 바닥 고리가 발 높이에
  } else if (f.shape === 'rain') {
    const n = 5, colW = 150 * k * big;
    for (let j = 0; j < n; j++) {
      const ph = Math.min(1, Math.max(0, (a * 1.6 - j * 0.12))); if (ph <= 0) continue;
      const sx = x + f.face * ((j + 0.6) / n) * Rpx, hh = colW * 1.7;
      cx.globalAlpha = Math.max(0, fade) * (ph < 0.85 ? 1 : (1 - ph) / 0.15);
      cx.drawImage(im, sx - colW / 2, y - hh * (0.25 + 0.75 * ph) - 10 * k, colW, hh);
    }
  } else if (f.shape === 'buff') {
    const w = 230 * k * (0.8 + 0.3 * ease), h = w * ar;
    cx.globalAlpha = (1 - a) * 0.95; cx.drawImage(im, x - w / 2, y - h * 0.72, w, h);
  } else if (f.shape === 'hit') {
    const w = (f.crit ? 110 : 70) * k * (0.6 + 0.6 * ease);
    cx.translate(x, y); cx.rotate(f.rot || 0); cx.drawImage(im, -w / 2, -w / 2, w, w);
  }
  cx.restore();
}
function drawSkillFx(cx, f, a, [x, y], Rpx, k, col, tier) {
  const ease = 1 - Math.pow(1 - a, 3), fade = a < 0.7 ? 1 : (1 - a) / 0.3, big = 1 + tier * 0.12;
  const job = f.job || g.S.hero.job;
  // 발밑 진(2차 이상 무공 · 버프) — 납작하게 돌며 사라진다
  if ((tier >= 2 || f.shape === 'buff') && f.shape !== 'hit' && f.shape !== 'ring' && a < 0.85) {
    const seal = oldImg(SEAL_ART[job]);
    if (seal) { const w = (110 + tier * 14) * k * (0.7 + 0.3 * ease), hx = f.hx ?? x, hy = f.hy ?? y; cx.save(); cx.globalAlpha = (1 - a / 0.85) * 0.8; cx.translate(hx, hy); cx.scale(1, 0.32); cx.rotate(a * 2.4); cx.drawImage(seal, -w / 2, -w / 2, w, w); cx.restore(); }
  }
  // 5차 궁극기 — 지금 게임의 큰 이펙트를 앞쪽에 크게(검비 · 화염 기둥 · 장풍 · 얼음 · 벼락)
  if (tier === 5 && f.shape !== 'hit' && f.shape !== 'buff') {
    const u = oldImg(ULT_ART[job]);
    if (u) { const w = Rpx * 1.3 * (0.6 + 0.4 * ease); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = Math.max(0, fade) * 0.95; cx.drawImage(u, x + f.face * Rpx * 0.45 - w / 2, y - w * 0.82, w, w); cx.restore(); }
  }
  // 처치 고리(흰 고리를 직업 빛깔로)
  if (f.shape === 'ring') { const r = tintImg('art/fx/fx-ring.png', col); if (r) { const w = 90 * k * (0.4 + ease); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - a; cx.translate(x, y - 20 * k); cx.scale(1, 0.45); cx.drawImage(r, -w / 2, -w / 2, w, w); cx.restore(); } return; }
  // 권사 버프는 금종(金鐘)이 씌워진다
  if (f.shape === 'buff' && BUFF_ART[job]) { const b = oldImg(BUFF_ART[job]); if (b) { const w = 120 * k, h = w * b.height / b.width; cx.save(); cx.globalAlpha = (1 - a) * 0.75; cx.drawImage(b, x - w / 2, y - h * (0.9 + 0.1 * ease), w, h); cx.restore(); } }
  const im = fxImg(job, f.shape);
  if (im) { drawFxImage(cx, im, f, a, ease, fade, x, y, Rpx, k, big); return; }
  cx.save(); cx.globalCompositeOperation = 'lighter';
  if (f.shape === 'line') {
    const len = Rpx * ease, h = (18 + tier * 6) * k;
    cx.translate(x, y - 34 * k); cx.scale(f.face, 1);
    const g2 = cx.createLinearGradient(0, 0, len, 0); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.2, col); g2.addColorStop(1, 'rgba(255,255,255,.95)');
    cx.globalAlpha = 0.9 * fade; cx.fillStyle = g2; cx.beginPath(); cx.moveTo(0, -h / 2); cx.lineTo(len, -h * 0.15); cx.lineTo(len + h, 0); cx.lineTo(len, h * 0.15); cx.lineTo(0, h / 2); cx.fill();
    cx.globalAlpha = 0.5 * fade; cx.fillStyle = '#fff'; cx.fillRect(0, -2 * k, len, 4 * k);
  } else if (f.shape === 'arc') {
    cx.translate(x, y - 34 * k); cx.scale(f.face, 1);
    for (let j = 0; j < 2; j++) {
      const rr = (Rpx * 0.55 + j * 18 * k) * (0.6 + 0.4 * ease), rot = (j ? 0.5 : -0.4) + ease * 0.6;
      cx.save(); cx.rotate(rot); cx.globalAlpha = 0.85 * fade;
      const g2 = cx.createRadialGradient(0, 0, rr * 0.5, 0, 0, rr); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.8, col); g2.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = g2; cx.beginPath(); cx.arc(0, 0, rr, -1.3, 1.3); cx.arc(rr * 0.15, 0, rr * 0.72, 1.2, -1.2, true); cx.fill(); cx.restore();
    }
  } else if (f.shape === 'circle') {
    cx.translate(x, y - 20 * k);
    const rr = Rpx * (0.3 + 0.7 * ease);
    cx.globalAlpha = 0.8 * fade; cx.strokeStyle = col; cx.lineWidth = (10 - 7 * a) * k * big; cx.beginPath(); cx.ellipse(0, 0, rr, rr * 0.38, 0, 0, 7); cx.stroke();
    const g2 = cx.createRadialGradient(0, -10 * k, 0, 0, -10 * k, rr * 0.6); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(0.4, col); g2.addColorStop(1, 'rgba(0,0,0,0)');
    cx.globalAlpha = 0.6 * (1 - a); cx.fillStyle = g2; cx.beginPath(); cx.arc(0, -10 * k, rr * 0.6, 0, 7); cx.fill();
    for (let j = 0; j < 10; j++) { const an = j * 0.628 + a * 2; cx.globalAlpha = fade; cx.fillStyle = '#fff'; cx.fillRect(Math.cos(an) * rr, Math.sin(an) * rr * 0.38 - 4 * k, 4 * k, 4 * k); }
  } else if (f.shape === 'rain') {
    cx.translate(x, y);
    for (let j = 0; j < 14; j++) {
      const sx = f.face * ((j * 0.071 + 0.05) % 1) * Rpx, ph = ((a * 2.2 + j * 0.13) % 1), yy = -260 * k + ph * 260 * k;
      cx.globalAlpha = fade * 0.9; cx.strokeStyle = col; cx.lineWidth = 4 * k; cx.beginPath(); cx.moveTo(sx - 18 * k, yy - 46 * k); cx.lineTo(sx, yy); cx.stroke();
      if (ph > 0.85) { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(sx, -6 * k, 9 * k * (1 - (ph - 0.85) * 6), 0, 7); cx.fill(); }
    }
  } else if (f.shape === 'buff') {
    cx.translate(x, y - 40 * k);
    cx.globalAlpha = (1 - a) * 0.9; cx.strokeStyle = col; cx.lineWidth = 4 * k;
    for (let j = 0; j < 3; j++) { cx.beginPath(); cx.arc(0, 0, (20 + j * 16 + ease * 30) * k, 0, 7); cx.stroke(); }
    for (let j = 0; j < 12; j++) { cx.fillStyle = col; cx.fillRect(Math.cos(j) * 30 * k, 40 * k - ease * 90 * k - (j % 4) * 10 * k, 3 * k, 10 * k); }
  }
  cx.restore();
}
function draw() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const F = g.ensureFight(); if (!F) return;
  const W = r.width, Hh = r.height, t = now(), ts = t / 1000, map = F.def.map;
  const z = zoneFor(g.zoneLv());
  // 가까이 당겨 본다: 화면 너비에 약 15미터 — 무인을 가로 · 세로로 따라감(맵은 화면보다 넓고 높다)
  const s = Math.max(W / 15000, Hh / 9000), k = Math.min(1.25, Math.max(0.7, s / 0.05));
  const viewW = W / s, viewH = Hh / s;
  const al = Math.max(0, Math.min(1, acc / 50));
  const lx = (o) => (o.px === undefined ? o.x : o.px + (o.x - o.px) * al), ly = (o) => (o.py === undefined ? o.y : o.py + (o.y - o.py) * al);
  const wantX = Math.max(0, Math.min(map.w - viewW, lx(F.hero) - viewW / 2));
  const baseY = Hh * 0.74;   // 바닥(높이 0)이 그려질 화면 높이 — 아래 패널 위
  const wantY = Math.max(0, Math.min(Math.max(0, map.h - baseY / s), ly(F.hero) - viewH * 0.3));
  if (camSm === null || Math.abs(camSm - wantX) > viewW) camSm = wantX; else camSm += (wantX - camSm) * 0.16;   // 살짝 늦게 따라감
  if (camSy === null || Math.abs(camSy - wantY) > viewH) camSy = wantY; else camSy += (wantY - camSy) * 0.1;
  const camX = camSm, camY = camSy;
  const P = (x, y) => [(x - camX) * s, baseY - (y - camY) * s];
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (t < shakeUntil) { const q = (shakeUntil - t) / 450 * 6; cx.translate((Math.random() - 0.5) * q, (Math.random() - 0.5) * q); }
  const ch = chapterOf(g.zoneLv()); preloadChapter(ch);
  drawPaintedBack(cx, W, Hh, ch, camX * s, z, camY * s);
  // 바닥 아래는 어둡게 채우고, 발판은 장마다 그린 그림
  const [, gy] = P(0, 0);
  const gg = cx.createLinearGradient(0, gy, 0, Hh); gg.addColorStop(0, 'rgba(20,14,8,.15)'); gg.addColorStop(1, 'rgba(20,14,8,.85)');
  cx.fillStyle = gg; cx.fillRect(0, gy + 10, W, Hh - gy);
  map.plats.forEach((p, i) => { const [x0, y] = P(p.x0, p.y), [x1] = P(p.x1, p.y); if (x1 < -20 || x0 > W + 20) return; drawPaintedLedge(cx, Math.max(-40, x0), Math.min(W + 40, x1), y, ch, z, (i === 0 ? 46 : 34) * k, i === 0); });
  const H = F.hero, sc = 0.8 * k;
  heroRun = H.act === 'run' || (H.px !== undefined && H.px !== H.x && H.plat >= 0) ? 6 : Math.max(0, heroRun - 1);
  for (const m of F.mobs) {
    const [x, y] = P(lx(m), ly(m)); if (x < -80 || x > W + 80) continue;
    drawMob(cx, x, y, m, z, { t: ts + m.id, flip: m.dir < 0, moving: !!m.moving, scale: sc * (m.kind === 'boss' ? 1.3 : 1) });
    const top = (m.kind === 'boss' ? 160 : m.kind === 'elite' ? 116 : 92) * sc, bw = (m.kind === 'boss' ? 90 : 34) * k;
    if (m.hp < m.st.hp || m.kind !== 'mob') { cx.fillStyle = '#000a'; cx.fillRect(x - bw / 2, y - top, bw, 4); cx.fillStyle = m.kind === 'boss' ? '#f59e0b' : '#e0436a'; cx.fillRect(x - bw / 2, y - top, bw * Math.max(0, m.hp / m.st.hp), 4); }
    if (m.kind !== 'mob') { cx.font = 'bold 11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = m.kind === 'boss' ? '#fde68a' : '#e9d5ff'; cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.strokeText(mobName(m, z), x, y - top - 4); cx.fillText(mobName(m, z), x, y - top - 4); }
  }
  // 무공 연출 — 모양마다(일직선 검기 · 부채꼴 베기 · 주변 폭발 · 하늘에서 쏟아짐 · 버프 기운)
  const [hx, hy] = P(lx(H), ly(H));
  for (let i = skillFx.length - 1; i >= 0; i--) {
    const f = skillFx[i], sk = skillById(f.id), col = sk?.col || '#ffe9a8';
    const life = f.shape === 'rain' ? 800 : f.shape === 'circle' ? 560 : f.shape === 'buff' ? 900 : f.shape === 'hit' ? 240 : f.shape === 'ring' ? 380 : 440, a = (t - f.at) / life;
    if (a > 1) { skillFx.splice(i, 1); continue; }
    if (a < 0) continue;
    if (f.shape === 'hit' && !fxImg(g.S.hero.job, 'hit')) continue;
    drawSkillFx(cx, f, a, f.shape === 'buff' ? [hx, hy] : P(f.x, f.y), (f.R || 2000) * s, k, col, sk?.tier || 0);
  }
  // 버프 중이면 발밑 기운
  if (H.buffs?.length) { cx.save(); cx.globalAlpha = 0.35 + 0.15 * Math.sin(ts * 6); cx.strokeStyle = skillById(H.buffs[0].id)?.col || '#ffe9a8'; cx.lineWidth = 3 * k; cx.beginPath(); cx.ellipse(hx, hy, 34 * k, 10 * k, 0, 0, 7); cx.stroke(); cx.restore(); }
  drawHero(cx, hx, hy, g.S.hero.job, g.S.hero.lv, { t: ts, run: heroRun > 0, flip: H.face < 0, lunge: Math.max(0, 1 - (t - lastHitAt) / 160), scale: sc });
  cx.font = '11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.strokeStyle = '#000'; cx.lineWidth = 3;
  cx.strokeText(JOBS[g.S.hero.job].name, hx, hy + 14); cx.fillText(JOBS[g.S.hero.job].name, hx, hy + 14);
  // 큰 피해 숫자 — 위로 쌓이며 떠오름
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], a = (t - f.at) / 1000;
    if (a > 1) { floats.splice(i, 1); continue; }
    const [x, y] = P(f.x, f.y), yy = y - 95 * sc - f.row * 22 * k - a * 18;
    const fs = (f.crit ? 24 : 18) * k * (a < 0.08 ? 1.3 - a * 3.75 : 1);
    cx.globalAlpha = a > 0.75 ? (1 - a) * 4 : 1; cx.textAlign = 'center';
    cx.font = `900 ${fs}px system-ui`; cx.lineWidth = 5; cx.strokeStyle = f.crit ? '#5a0a2a' : '#3a2200';
    const txt = unit(f.d);
    cx.strokeText(txt, x, yy);
    const gr = cx.createLinearGradient(0, yy - fs, 0, yy); if (f.crit) { gr.addColorStop(0, '#ffd0e8'); gr.addColorStop(1, '#ff3d8b'); } else { gr.addColorStop(0, '#fff6c4'); gr.addColorStop(1, '#ffa31a'); }
    cx.fillStyle = gr; cx.fillText(txt, x, yy);
    cx.globalAlpha = 1;
  }
  // 궁극기 컷인 — 수묵 배경 띠가 비스듬히 지나가며 무공 이름(0.9초)
  if (cutIn) {
    const a = (t - cutIn.at) / 900;
    if (a > 1) cutIn = null;
    else {
      const sk = skillById(cutIn.id), job = cutIn.id.split('_')[0], bg = oldImg(CUT_ART[job]);
      const slide = a < 0.2 ? 1 - a / 0.2 : a > 0.8 ? -(a - 0.8) / 0.2 : 0, bh = Hh * 0.26, by = Hh * 0.3;
      cx.save(); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalAlpha = a > 0.8 ? (1 - a) / 0.2 : 1;
      cx.translate(slide * W, 0); cx.beginPath(); cx.moveTo(0, by + 18); cx.lineTo(W, by); cx.lineTo(W, by + bh - 18); cx.lineTo(0, by + bh); cx.closePath(); cx.clip();
      if (bg) cx.drawImage(bg, 0, by - bh * 0.6, W, W * bg.height / bg.width); else { cx.fillStyle = '#000c'; cx.fillRect(0, by, W, bh); }
      cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, by, W, bh);
      cx.font = `900 ${bh * 0.42}px "Nanum Brush Script", "Gowun Batang", serif`; cx.textAlign = 'center'; cx.lineWidth = 6; cx.strokeStyle = '#000';
      cx.strokeText(sk?.name || '', W * 0.5, by + bh * 0.66); cx.fillStyle = sk?.col || '#fff'; cx.fillText(sk?.name || '', W * 0.5, by + bh * 0.66);
      cx.restore();
    }
  }
  if (mobPrev.size > 300) mobPrev.clear();
}

// ── 돌리기 ──
let last = 0, lastMin = 0, lastSave = 0, lastHud = 0, acc = 0, resTimer = 0;
function frame() {
  const t = now();
  acc = Math.min(1000, acc + (t - last)); last = t;
  const dt = acc - (acc % 50); acc -= dt;   // 엔진은 50ms 틱 — 남는 몫은 다음 프레임으로
  g.tick(t);
  if (dt > 0) {
    const F0 = g.ensureFight();
    const mobs = new Map(F0.mobs.map((m) => [m.id, m]));
    g.hunt(dt);
    const rows = new Map();
    for (const e of g.lastEvents || []) {
      if (e[0] === 'hit') { const m = mobs.get(e[2]); if (!m) continue; lastHitAt = t; if (e[5] && skillFx.length < 80) skillFx.push({ at: t + (e[6] || 0) * 70, shape: 'hit', x: m.x, y: m.y + 900, crit: e[4], rot: (m.id * 1.7 + (e[6] || 0)) % 6.28 }); const n = rows.get(m.id) || 0; rows.set(m.id, n + 1); if (floats.length < 60) floats.push({ x: m.x, y: m.y, d: e[3], crit: e[4], at: t, row: (n + floats.filter((f) => f.mid === m.id && t - f.at < 500).length) % 6, mid: m.id }); }
      else if (e[0] === 'cast') skillFx.push({ at: t, id: e[2], face: e[3], x: e[4], y: e[5], shape: e[6], R: e[7] });
      else if (e[0] === 'buff') skillFx.push({ at: t, id: e[2], shape: 'buff' });
      else if (e[0] === 'kill') { const m = mobs.get(e[2]); if (m && skillFx.length < 90) skillFx.push({ at: t, shape: 'ring', x: m.x, y: m.y }); }
      if (e[0] === 'cast' && skillById(e[2])?.tier === 5) { cutIn = { at: t, id: e[2] }; shakeUntil = t + 450; }
    }
  }
  if (t - lastMin >= 60000) { lastMin = t; g.minute(); }
  for (const f of g.feed.splice(0)) {
    if (f.k === 'level') { toast(`레벨 업! Lv ${f.lv}`); addLog(`레벨 업 — Lv ${f.lv}`); }
    else if (f.k === 'guide') addLog('길잡이 완료 — 왼쪽 위에서 받기');
    else if (f.k === 'advance') toast(`${f.n}차 전직!`);
    else if (f.k === 'boss') addLog('사냥터 두목 처치!');
    else if (f.k === 'sudden') toast(`돌발 미션: 10분 안에 ${f.need}마리`);
    else if (f.k === 'realm') addLog(`경지 ${f.lv}`);
    else if (f.k === 'gacha-lv') addLog(`뽑기 레벨 ${f.lv}`);
    else if (f.k === 'tree') { const sk = skillById(f.id); toast(`${sk?.name} 강화 완료`); }
    else if (f.k === 'challenge') addLog(`${Math.ceil(f.idx / 10)}장 ${((f.idx - 1) % 10) + 1}칸 두목 도전`);
    else if (f.k === 'stage-clear' || f.k === 'stage-fail') showResult(f);
  }
  draw();
  if (t - lastHud > 200) { lastHud = t; paintHud(); }
  if (t - lastSave > 10000) { lastSave = t; save(); }
  if (resTimer && t > resTimer) closeResult();
  requestAnimationFrame(frame);
}
// 두목전 결과 — 3초 뒤 저절로 닫힘 · 나가기 / 다시하기(진 때)
function showResult(f) {
  const ch = Math.ceil(f.idx / 10), st = ((f.idx - 1) % 10) + 1, win = f.k === 'stage-clear';
  $('res').innerHTML = `<div class="st">CHAPTER ${ch} <em>STAGE ${st}</em></div><div class="big ${win ? 'win' : ''}">${win ? 'CLEAR' : 'FAILED'}</div>${win ? `<div>보상: 은자 · 뽑기권</div>` : '<div class="note">이 칸 몹을 다시 잡으면 또 도전해요</div>'}<div class="acts"><button class="out" id="rout">나가기</button>${win ? '' : '<button class="again" id="ragain">다시하기</button>'}</div><div class="note" id="rcd">3초 뒤 자동 닫힘</div>`;
  $('res').classList.add('open'); resTimer = now() + 3000;
  $('rout').onclick = closeResult;
  if (!win) $('ragain').onclick = () => { closeResult(); g.stage().kills = STAGE_KILLS; g.challenge(); };
  addLog(win ? `${ch}장 ${st}칸 클리어` : `${ch}장 ${st}칸 두목에게 졌어요`);
}
function closeResult() { resTimer = 0; $('res').classList.remove('open'); }
// 돌아왔을 때 대기열 — 방치 보상부터 하나씩
function returnQueue() {
  const p = g.returnCheck(now());
  const q = buildQueue([...(p ? [{ kind: 'offline', p }] : [])]);
  for (const it of q) if (it.kind === 'offline') {
    const p2 = it.p;
    pop('방치 보상', `<p>${Math.floor(p2.ms / 60000)}분 동안 사냥했어요${p2.capped ? '(최대 12시간)' : ''}.</p><p>경험치 ${unit(p2.exp)} · 은자 ${unit(p2.gold)}</p>`, [['받기', () => { g.claimOffline(false); save(); }], ['광고 보고 ×2', () => { const r = g.claimOffline(true); toast(r?.x === 2 ? '×2 받음' : '오늘 광고 ×2는 다 썼어요'); save(); }]]);
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
// 컴퓨터: ← → 움직이기 · Space/↑ 점프 · ↓ 내려가기 · Q 무공 · Del 자동
const keyDir = { ArrowLeft: -1, ArrowRight: 1 };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('pop').classList.contains('open')) $('pop').classList.remove('open'); else closeWin(); return; }
  if (!g || open) return;
  if (keyDir[e.key] && !e.repeat) g.hold(keyDir[e.key]);
  else if ((e.key === ' ' || e.key === 'ArrowUp') && !e.repeat) { e.preventDefault(); g.jump(); }
  else if (e.key === 'ArrowDown' && !e.repeat) g.down();
  else if (e.key === 'q' || e.key === 'Q') g.ensureFight().press('skill');
  else if (e.key === 'Delete') { g.setAuto(g.S.auto === false); paintHud(); }
});
document.addEventListener('keyup', (e) => { if (g && keyDir[e.key]) g.hold(0); });

loadLooks();
load();
if (g) boot();
else pop('새 시즌 — 무인 고르기', '<p class="note">미리보기예요. 지금 게임 세이브와 섞이지 않아요.</p>', Object.entries(JOBS).map(([k, j]) => [j.name, () => start(k)]));
// 시험용 손잡이
window.__s2 = { get g() { return g; }, save, dayKey, freeze: () => { frozen = true; } };
