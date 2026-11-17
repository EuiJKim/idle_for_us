// 새 시즌 화면 — v524부터 첫 화면(index.html). 옛 게임은 classic.html(세이브는 따로 · ifu.s2.*가 새 시즌).
// 화면은 엔진(js/s2/game.js)만 본다. 시계는 화면 쪽에서만 읽어 엔진에 넘긴다(엔진은 결정론).
import { Game, newGame, COLLECTS, dayKey, STAGE_KILLS } from '../game.js';
import { SAVE_KEY } from '../core/save.js';
import { S2Net } from './net.js';
import { encodeSave, decodeAny } from '../../savecode.js';
import { SLOTS, SLOT_NAME, GRADES, gachaExpNeed } from '../tables/gear.js';
import { itemStats, gearScore, unequip, equip, equipBest, junkOf, dismantleMany, dismantleItem, newSlot } from '../gear/gear.js';
import { dismantle as dismantleYield, enhCost, enhOk, starCost } from '../tables/gearstat.js';
import { starOdds, STAR_MAX, PITY_POINTS, BREAK_FROM, PROTECT_FROM, PROTECT_TO, PROTECT_BREAK_COST_X } from '../tables/star.js';
import { ENH_MAX } from '../tables/gear.js';
import { drawCreature } from '../../creatures.js';
import { JOBS } from '../tables/char.js';
import { SKILLS, MASTERY } from '../tables/skills.js';
import { JOB_LV } from '../tables/progress.js';
import { COLLECT } from '../tables/s5.js';
import { DAILY_DUNGEONS, DAILY_RUNS, EXPEDITION } from '../tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, guideCurrent, achievements, ACHIEVE } from '../tables/missions.js';
const ACH = achievements(), achById = new Map(ACH.map((a) => [a.id, a]));
import { expToNext } from '../tables/exp.js';
import { staminaNow } from '../content/idle.js';
import { buildQueue } from '../content/offline.js';
import { kindGrade } from '../grow/collect.js';
import { loadLooks, zoneFor, drawHero, drawMob, mobName, mobHeight, preloadMobs, drawPaintedBack, drawPaintedLedge, drawEarth, chbImg, preloadChapter, fxImg, oldImg, tintImg, ULT_ART, SEAL_ART, CUT_ART, BUFF_ART, BOSS_ART, wearCount } from './look.js';
import { BOSS_PATS } from '../tables/kit.js';
import { CHBOSS, CB_PATS, CB, WBF, CB_RAID } from '../tables/chboss.js';
import { DASH } from '../battle/side.js';   // v546 회피
import { ATTEND, ATTEND_DAYS, ATTEND_NAME } from '../tables/attend.js';
import { TITLES, TITLE_EACH, titleByName } from '../tables/titles.js';
import { play, unlock, setOpt, bgm } from './sound.js';
import { PoseAnim, POSES, IDLE, mixPose } from '../../pose.js';
// 설정(v504) — 이 기기에만(ifu.s2.opt). 소리 · 배경 가락 · 흔들림 · 피해 숫자 · 진동 · 그래픽 · 피해 측정기
const OPT_KEY = 'ifu.s2.opt';
const opt = Object.assign({ sfx: true, bgm: true, shake: true, nums: 'all', vib: true, gfx: 'high', dps: false, autoNext: true }, (() => { try { return JSON.parse(localStorage.getItem(OPT_KEY) || '{}'); } catch { return {}; } })());
const saveOpt = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch { /* 저장 못 함 */ } setOpt({ sfx: opt.sfx, bgm: opt.bgm }); };
setOpt({ sfx: opt.sfx, bgm: opt.bgm });
const buzz = (ms) => { if (opt.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* 진동 없음 */ } };
const dmgLog = [];   // 피해 측정기: [시각, 피해] 최근 10초
const killLog = [];
const killRate = () => { const t0 = now() - 60000; while (killLog.length && killLog[0] < t0) killLog.shift(); return killLog.length; };
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
const GUIDE_TEXT = { kill: '몹 잡기', level: '레벨 올리기', equip: '장비 끼기', gacha: '장비 뽑기', skill: '무공 올리기', enhance: '장비 강화', dungeon: '던전 깨기', pull: '뽑기', star: '성혼', offline: '방치 보상 받기', realm: '경지 올리기', login: '접속하기', wboss: '월드보스 도전', pvp: '대결 하기' };   // v522 일일 · 주간 임무에 영문 id가 보이던 것
const MASTERY_NAME = ['기본기', '호흡법', '보법', '연환', '내공 순환', '신법', '절초', '심법 대성', '신행', '화경', '검기 성강', '등봉조극'];
const guideLabel = (q) => {
  if (q.ev === 'level') return `Lv ${q.cond.split('>=')[1].trim()} 달성`;
  if (q.ev === 'kill' && q.cond === 'elite') return '정예 잡기(뽑기 10번마다 나옴)';
  if (q.ev === 'kill' && q.cond === 'boss') return '사냥터 두목 잡기';
  if (q.ev === 'pull') return `${COLLECT[COLLECTS[+q.cond.split('==')[1] - 1]].name} 뽑기 ${q.need}번`;
  if (q.ev === 'dungeon' && q.cond === 'job == 1') return '1차 전직 던전 깨기';
  if (q.ev === 'dungeon') return q.need > 1 ? `수련동 깨기 ${q.need}번` : '수련동 깨기';
  if (q.ev === 'login') return q.need > 1 ? `${q.need}일 접속` : '오늘 접속';
  if (q.ev === 'kill' && !q.cond) return `몹 ${q.need}마리 잡기`;
  if (q.ev === 'gacha') return `장비 뽑기 ${q.need}번`;
  return `${GUIDE_TEXT[q.ev] || q.ev}${q.need > 1 ? ` ${q.need}번` : ''}`;
};

// ── 불러오기 / 새로 시작 ──
let g = null;
function load() {
  try { const t = localStorage.getItem(SAVE_KEY); if (t) g = Game.load(t, now()); } catch { g = null; }
}
let frozen = false;   // 시험용: 저장 멈춤
function save() { if (frozen) return; try { localStorage.setItem(SAVE_KEY, g.save()); localStorage.setItem(SAVE_KEY + '.at', String(Date.now())); } catch { /* 저장 공간 없음 */ } }
// v525 계정 · 서버 저장 — 3분마다 · 화면을 떠날 때 올린다(기기를 잃거나 지워도 Google로 되살린다)
const net = new S2Net((w) => { if (w === 'status' && net.online) cloudCheck(); if (open === 'opt') paintWin(); });
let cloudBusy = null;   // 올리는 중인 약속 — 꼭 올려야 할 때(force)는 그것을 기다렸다 다시 올린다
async function cloudPush(force) {
  if (!g || frozen || !net.online) return false;
  if (cloudBusy) { if (!force) return false; await cloudBusy.catch(() => {}); if (cloudBusy) await cloudBusy.catch(() => {}); }
  if (!force && Date.now() - net.lastPush < 170000) return false;
  const p = net.push(g.save(), g.S.hero.lv, g.S.hero.job);
  cloudBusy = p;
  try { await p; return true; } catch (err) { console.warn('[s2net] push', err?.code || err); return false; } finally { if (cloudBusy === p) cloudBusy = null; }
}
// 처음 연결될 때 — 서버 진행이 이 기기보다 새로우면 고르게 한다(기기가 비었으면 그냥 받는다)
async function cloudCheck() {
  try {
    const d = await net.fetch(), localAt = Number(localStorage.getItem(SAVE_KEY + '.at') || 0);
    if (!d) { cloudPush(true); return; }
    if (!g) { applyCloud(d); return; }
    if (d.at > localAt + 60000) pop('서버에 더 새 진행이 있어요', `<p class="note">서버: Lv.${d.lv} · ${new Date(d.at).toLocaleString()}<br>이 기기: Lv.${g.S.hero.lv} · ${localAt ? new Date(localAt).toLocaleString() : '모름'}</p>`, [['이 기기 것 쓰기', () => cloudPush(true)], ['서버 것 받기', () => applyCloud(d)]]);
    else cloudPush(true);
  } catch (err) { console.warn('[s2net] check', err?.code || err); }
}
function applyCloud(d) {
  try { Game.load(d.data, now()); } catch { toast('서버 진행을 열 수 없어요'); return; }
  localStorage.setItem(SAVE_KEY, d.data); localStorage.setItem(SAVE_KEY + '.at', String(d.at)); frozen = true; location.reload();
}
// 저장 코드 — 글자 한 줄로 옮기기(계정 없이도)
async function exportCode() {
  save();
  const code = await encodeSave({ s2: 1, data: g.save() });
  try { await navigator.clipboard.writeText(code); toast('저장 코드를 복사했어요 — 메모장 · 카톡 나에게에 붙여 두세요'); }
  catch { pop('저장 코드', `<textarea class="gift-memo" style="height:120px" readonly>${esc(code)}</textarea><p class="note">길게 눌러 전부 복사해 두세요.</p>`); }
}
function importCode() {
  pop('저장 코드 불러오기', '<textarea id="codein" class="gift-memo" style="height:120px" placeholder="IFU1. 로 시작하는 글 전부"></textarea><p class="note">지금 이 기기의 새 시즌 진행이 코드의 진행으로 바뀌어요.</p>', [['닫기', null], ['불러오기', async () => {
    const v = document.getElementById('codein')?.value || '';
    try { const o = await decodeAny(v); if (!o || o.s2 !== 1 || typeof o.data !== 'string') throw new Error('새 시즌 저장 코드가 아니에요'); Game.load(o.data, now()); localStorage.setItem(SAVE_KEY, o.data); localStorage.setItem(SAVE_KEY + '.at', String(Date.now())); frozen = true; location.reload(); }
    catch (err) { toast(err?.message || '코드를 열 수 없어요'); }
  }]]);
  setTimeout(() => document.getElementById('codein')?.focus(), 50);
}
async function linkGoogle() {
  try {
    const r = await net.linkGoogle();
    if (r.linked) { toast(`Google 연결 · ${net.email()}`); cloudPush(true); }
    else if (r.conflict) pop('이미 쓰던 Google 계정이에요', `<p class="note">${esc(r.email)} 계정에 다른 진행이 이어져 있어요. 그 계정으로 바꾸면 그쪽 새 시즌 진행을 받아 와요(이 기기 진행은 저장 코드로 남겨 두세요).</p>`, [['그대로', null], ['그 계정으로', async () => { try { const d = await net.switchTo(r.cred); if (d) applyCloud(d); else { toast('그 계정에는 새 시즌 진행이 없어요 — 지금 진행을 올려요'); cloudPush(true); } } catch (err) { toast(err?.message || '바꾸지 못했어요'); } }]]);
  } catch (err) { toast(err?.code === 'auth/popup-blocked' ? '팝업이 막혔어요 — 다시 눌러 주세요' : err?.code === 'auth/popup-closed-by-user' ? '취소했어요' : (err?.message || '연결하지 못했어요')); }
}
function start(job) { g = new Game(newGame(job, now(), (now() & 0x7fffffff) || 1), now()); g.emit('login'); save(); boot(); }

// ── 토스트 · 팝업 — 지금 게임과 같은 틀(#toast .toast · #modal .sheet h2 · .btn-row) ──
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('toast').append(d); setTimeout(() => d.remove(), 2700); }
function closeModal() { $('modal').classList.add('hidden'); }
function pop(title, html, acts = [['확인', null]]) {
  const sh = $('modal').querySelector('.sheet');
  sh.classList.toggle('wide', false); sh.classList.remove('enhs'); sh.innerHTML = `<h2>${esc(title)}</h2><div>${html}</div><div class="btn-row" style="margin-top:12px${acts.length > 3 ? ';display:grid;grid-template-columns:repeat(3,1fr)' : ''}"></div>`;
  const a = sh.querySelector('.btn-row');
  acts.forEach(([label, fn], i) => { const b = document.createElement('button'); b.className = `btn${i === acts.length - 1 ? ' primary' : ''}`; b.textContent = label; b.onclick = () => { closeModal(); fn?.(); paintHud(); paintWin(); }; a.append(b); });
  $('modal').classList.remove('hidden');
}

// ── 창 — 지금 게임과 같은 일곱 창(들판 양옆 단추 · 창 머리 줄) + 설정(⚙). 칸은 붉은 알약(.subtabs .seg.wide) ──
const TABS = [
  ['char', '캐릭터', [['스탯', 'hero:0'], ['무공', 'hero:1'], ['무공 강화', 'hero:4'], ['마스터리', 'hero:2'], ['전직', 'hero:3'], ['칭호', 'title:0']]],
  ['bag', '장비', [['장착', 'gear:0'], ['뽑기', 'gear:1'], ['강화·성혼', 'gear:2'], ['가방', 'gear:3']]],
  ['comp', '동료', [['병기', 'grow:0'], ['동료', 'grow:1'], ['영물', 'grow:2']]],
  ['dgn', '던전', [['수련동', 'content:0'], ['토벌', 'raid:0'], ['무한 탑', 'content:1'], ['원정', 'content:2']]],
  ['map', '지도', [['스테이지', 'content:3']]],
  ['town', '임무', [['오늘', 'today:0'], ['출석', 'attend:0'], ['길잡이', 'mission:0'], ['일일', 'mission:1'], ['주간', 'mission:2'], ['업적', 'ach:0'], ['경지', 'grow:3'], ['강호행', 'grow:4']]],
  ['social', '무림', [['월드보스', 'rival:0'], ['대결', 'rival:1'], ['문파', 'rival:2']]],
  ['opt', '설정', [['설정', 'mission:3']]],
];
const MAIN_TABS = TABS.filter((t) => t[0] !== 'opt');
// v511 창 아이콘 — 들판 HUD와 같은 선 그림(s2.html의 .ic)
const ICON = {
  char: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bag: '<path d="M8 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5-3c-.6 1.8-2.1 3-4 3S8.6 4.8 8 3z"/>',
  comp: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.6 14.2c3 .2 5.4 2.3 5.4 5.8"/>',
  dgn: '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  town: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  social: '<path d="M5 21V3"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  opt: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const ico = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
const keyOf = () => TABS.find((t) => t[0] === open)?.[2][tab]?.[1];
// 내용 열쇠(예: 'hero:1')로 그 창 · 그 칸 열기
function openKey(key) { for (const [id, , subs] of TABS) { const i = subs.findIndex((x) => x[1] === key); if (i >= 0) { openWin(id, i); return; } } }
let open = null, tab = 0, treeSel = null, eqSel = null;
let bagF = 'all', bagSort = 'g', bagJunkG = 3, bagMore = false;   // v521 가방 보기
// 장비 아이콘: 지금 게임 그림(무기 · 방어구 · 장신구 × 등급 6)
// v515 장비 그림 — 부위 열 × 등급 일곱(무기는 지금 무인 직업 다섯), 빈 칸은 그 부위 범급을 흐리게
const eqIcon = (sl, it) => `art/s2/eq/${sl === 'weapon' ? `w-${g?.S?.hero?.job || 'sword'}` : sl}-${it ? Math.min(6, it.g) : 0}.webp`;
function eqCell(sl) {
  const it = g.S.gear.eq[sl], S2 = g.S.gear.slots[sl], b = document.createElement('button');
  b.className = `eqcell ${it ? 'g' + it.g : 'empty'} ${eqSel === sl ? 'sel' : ''}`;
  if (it) b.style.setProperty('--gc', GX_COL[it.g]);
  b.innerHTML = `<img src="${eqIcon(sl, it)}" alt="${SLOT_NAME[sl]}" style="${it ? '' : 'opacity:.25'}"><span class="en">${S2.enh ? '+' + S2.enh : ''}</span><span class="sr">${S2.star ? '★' + S2.star : ''}</span><span class="nm">${SLOT_NAME[sl]}</span>`;
  b.onclick = () => { play('click'); if (it) enhPop(sl); else { eqSel = eqSel === sl ? null : sl; paintWin(); } };   // v528 낀 장비를 누르면 바로 강화 창
  return b;
}
// ── 장비 뽑기 연출(v497) ── 카드가 차례로 뒤집힌다. 보(4)↑는 뒤집기 전에 두근(떨림 · 빛) · 신(5)↑는 화면이 번쩍 · 건너뛰기
const GX_COL = ['#9ca3af', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
function showGacha(r) {
  const prev = document.querySelector('.gx'); if (prev) prev.parentNode.removeChild(prev);
  const ov = document.createElement('div'); ov.className = 'gx';
  const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  const best = Math.max(...r.items.map((i) => i.g));
  ov.innerHTML = `<div class="gxt">장비 뽑기 ${r.items.length}번</div><div class="gxg ${r.items.length > 10 ? 'many' : ''}"></div><div class="gxb"><button class="btn skip">건너뛰기</button></div>`;
  const grid = ov.querySelector('.gxg'), eqd = new Set(r.got.filter((x) => x.equipped).map((x) => x.it?.uid));
  const cards = r.items.map((it) => {
    const c = document.createElement('div'); c.className = `gc g${it.g}`; c.style.setProperty('--gc', GX_COL[it.g] || '#fff');
    c.innerHTML = `<div class="back"></div><div class="face"><img src="${eqIcon(it.slot, it)}" alt="${SLOT_NAME[it.slot]}"><b class="g${it.g}t">${GRADES[it.g]}</b><small>${SLOT_NAME[it.slot]}</small>${eqd.has(it.uid) ? '<i>장착</i>' : ''}</div>`;
    grid.append(c); return c;
  });
  document.body.append(ov);
  let i = 0, timer = null, done = false;
  const step = r.items.length > 10 ? 70 : 150;
  const flash = (gr) => { ov.classList.remove('flash'); void ov.offsetWidth; ov.style.setProperty('--gc', GX_COL[gr]); ov.classList.add('flash'); };
  const finish = () => {
    if (done) return; done = true; clearTimeout(timer);
    cards.forEach((c) => { c.classList.remove('tense'); c.classList.add('open'); });
    if (best >= 5) flash(best);
    ov.querySelector('.skip').textContent = '닫기';
    ov.querySelector('.gxt').textContent = r.got.some((x) => x.equipped) ? '더 좋은 것은 바로 장착했어요' : `가장 좋은 것: ${GRADES[best]}`;
  };
  const next = () => {
    if (done) return;
    if (i >= cards.length) { finish(); return; }
    const c = cards[i], it = r.items[i];
    if (it.g >= 4 && !c.classList.contains('tense')) { c.classList.add('tense'); play('tense'); timer = setTimeout(next, it.g >= 5 ? 900 : 550); return; }   // 두근
    c.classList.remove('tense'); c.classList.add('open'); if (it.g >= 5) flash(it.g); play(it.g >= 4 ? 'rare' : 'flip', it.g);
    i++; timer = setTimeout(next, step);
  };
  timer = setTimeout(next, 250);
  ov.querySelector('.skip').onclick = (e) => { e.stopPropagation(); if (done) close(); else finish(); };
  ov.onclick = () => { if (done) close(); };
}
function openWin(id, t = 0) { open = id; tab = t; document.body.classList.add('winopen'); $('panel').classList.add('open'); $('panel-dim').classList.add('open'); paintWin(); paintNav(); }
function closeWin() { open = null; document.body.classList.remove('winopen'); $('panel').classList.remove('open'); $('panel-dim').classList.remove('open'); paintNav(); }
function paintNav() {
  if (!$('ptabs').children.length) for (const [id, name] of MAIN_TABS) { const b = document.createElement('button'); b.dataset.tab = id; b.innerHTML = `${ico(id)}<span>${name}</span>`; b.onclick = () => { play('click'); openWin(id); }; $('ptabs').append(b); }
  for (const b of document.querySelectorAll('.nb[data-tab], #ptabs button[data-tab]')) b.classList.toggle('active', b.dataset.tab === open);
  navDots();
}
// 빨간 점 — 지금 누를 게 있는 창(캐릭터: 전직 · 무공 점수 · 올릴 수 있는 무공 / 가방: 뽑기권 10장↑ / 마을: 길잡이 받기)
const dotSeen = (() => { try { return JSON.parse(localStorage.getItem('ifu.s2.dots') || '{}'); } catch { return {}; } })();
let dotSaved = '';
function navDots() {
  const S = g.S, h = g.hero, W = S.wallet;
  let kitUp = 0;
  try { const K = h.kitState(); for (const id of Object.keys(K.lv)) { const sk = skillById(id); if (sk && h.canKitUp(id) && (W.gold || 0) >= kitCost(K.lv[id], sk.tier)[0].n) kitUp++; } } catch { /* 없음 */ }
  const cur = guideCurrent(S.q.guide), canAdv = !!h.canAdvance?.(), tree = g.treePts?.().left || 0, tix = W['ticket:gear'] || 0;
  // v520 빨간 점은 「새로 생긴 할 일」만 — 늘 켜져 있던 것(올릴 무공이 거의 늘 있다)을, 그 창을 한 번 열면 다음 새 일까지 끈다
  const sig = { char: canAdv || tree > 0 || kitUp ? `${canAdv ? 1 : 0}|${tree}|${kitUp}|${S.hero.adv || 0}` : '', bag: tix >= 10 ? `${Math.floor(tix / 10)}` : '', town: (g.todayChest().can ? 'today' : '') || (cur && S.q.guide[cur.id]?.done ? cur.id : '') || (g.books.ach.claimable().length ? `ach${g.books.ach.claimable().length}` : '') };
  if (open && sig[open] !== undefined) dotSeen[open] = sig[open];
  const on = { char: !!sig.char && sig.char !== dotSeen.char, bag: !!sig.bag && sig.bag !== dotSeen.bag, town: !!sig.town };
  for (const b of document.querySelectorAll('.nb[data-tab], #ptabs button[data-tab]')) b.classList.toggle('dot-on', !!on[b.dataset.tab]);
  const ds = JSON.stringify(dotSeen); if (ds !== dotSaved) { dotSaved = ds; try { localStorage.setItem('ifu.s2.dots', ds); } catch { /* 저장 못 해도 */ } }
}
function act(fn) { return () => { play('click'); const r = fn(); if (r === null || r === false) toast('할 수 없어요(재료·조건)'); save(); paintWin(); paintHud(); return r; }; }
// 한 줄 — 지금 게임의 .row(.info .name · .desc · 단추). 첫 단추는 붉은 주 단추
function rowEl(k, v, btns = []) {
  const r = document.createElement('div'); r.className = btns.length >= 3 || (btns.length === 2 && btns.reduce((n, x) => n + String(x[0]).length, 0) > 8) ? 'row wide' : 'row';   // v522 글이 긴 단추 둘도 아래 줄로(지도 「◀ 앞 칸 · 다음 칸 ▶」)   // 단추가 셋 이상이면 글을 한 줄 다 쓰고 단추는 아래 줄
  r.innerHTML = `<div class="info"><div class="name">${k}</div>${v !== undefined && v !== '' && v !== null ? `<div class="desc">${v}</div>` : ''}</div>`;
  btns.forEach(([label, fn, dis], i) => { const b = document.createElement('button'); b.className = `btn${i === 0 ? ' primary' : ''}`; b.textContent = label; b.disabled = !!dis; b.onclick = fn; r.append(b); });
  return r;
}
function paintWin() {
  if (!open) return;
  const M = TABS.find((m) => m[0] === open);
  $('panel-title').innerHTML = `${ico(M[0])}<span>${M[1]}</span>`;
  $('panel-head').querySelector('.res-row').innerHTML = `<span class="cur-pill"><i class="coin s"></i><b>${unit(g.S.wallet.gold)}</b></span><span class="cur-pill"><i class="coin t"></i><b>${g.S.wallet['ticket:gear'] || 0}</b></span>`;
  const PB = $('panel-body'), keepScroll = PB.dataset.key === `${open}:${tab}` ? PB.scrollTop : 0; PB.innerHTML = ''; PB.dataset.key = `${open}:${tab}`;
  if (M[2].length > 1) {
    const st = document.createElement('div'); st.className = 'subtabs'; const seg = document.createElement('div'); seg.className = 'seg wide';
    M[2].forEach(([n], i) => { const b = document.createElement('button'); b.dataset.key = String(i); b.textContent = n; b.className = i === tab ? 'on' : ''; b.onclick = () => { play('click'); tab = i; paintWin(); paintNav(); }; seg.append(b); });
    st.append(seg); PB.append(st);
  }
  const B = document.createElement('div'); B.id = 'wb'; PB.append(B);
  requestAnimationFrame(() => { PB.scrollTop = keepScroll; });
  const W = g.S.wallet, add = (...e) => B.append(...e);
  const key = keyOf();
  const st = g.fighter().st;
  // v508 창 안쪽도 지금 게임 부품으로 — 묶음은 제목 있는 카드(.card h3), 스탯은 두 칸 격자(.stat-grid), 줄은 붓글씨 한 글자(.ico), 장비는 그림 칸(.inv-grid), 수집은 타일(.gear-grid)
  const card = (title, sub = '') => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<h3>${title}${sub ? ` <small>${sub}</small>` : ''}</h3>`; B.append(c); return (...e) => c.append(...e); };
  const R = (k, v, btns = [], ico = '') => { const r = rowEl(k, v, btns); if (ico) { const i = document.createElement('div'); i.className = 'ico'; i.textContent = ico; r.prepend(i); } return r; };
  const note = (t) => Object.assign(document.createElement('p'), { className: 'note', textContent: t });
  const statGrid = (pairs) => { const d = document.createElement('div'); d.className = 'stat-grid'; d.innerHTML = pairs.map(([n, v]) => `<div>${n}<b>${v}</b></div>`).join(''); return d; };
  const GCOL = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
  const pm = (v) => `${(v / 10).toFixed(1)}%`;
  if (key === 'hero:0') {
    const c1 = card('전투력', JOBS[g.S.hero.job].name + (g.S.hero.adv ? ` ${g.S.hero.adv}차` : ''));
    c1(statGrid([['사냥', unit(g.power())], ['대결', unit(g.power('pvp'))]]));
    const c2 = card('능력치');
    c2(statGrid([['공격', unit(st.atk || 0)], ['체력', unit(st.hp || 0)], ['방어', unit(st.def || 0)], ['치명 확률', pm(st.crit || 0)], ['치명 피해', pm(st.critDmg || 0)], ['보스 피해', pm(st.bossDmg || 0)], ['경험치', `+${pm(st.expP || 0)}`], ['무공 피해', `+${pm(st.skillP || 0)}`]]));
    const c3 = card('최종 피해', '곱으로 붙는 넷');
    c3(statGrid([['최종 피해①', pm(st.final1 || 0)], ['최종 피해②', pm(st.final2 || 0)], ['최종 피해③', pm(st.final3 || 0)], ['최종 피해④', pm(st.final4 || 0)]]));
  } else if (key === 'hero:1') {
    // 무공 — 차수별 카드. 공격 · 버프는 칸에 넣고 자동/수동, 상시는 레벨만
    const Hs = g.hero, K = Hs.kitState(), cap = kitCap(g.S.hero.lv);
    const KIND = { active: '공격', passive: '상시', buff: '버프' }, SHAPE = { line: '앞 일직선', arc: '앞 부채꼴', circle: '주변', rain: '앞쪽 하늘에서' };
    B.append(note(`칸 ${K.slots.length}/${SLOT_N} — 자동 사냥이면 칸 순서대로 준비된 무공을 저절로 써요. 무공 레벨 상한 ${cap}(무인 레벨 5마다 1).`));
    for (let tier = 0; tier <= 5; tier++) {
      const list = KIT[g.S.hero.job].filter((sk) => sk.tier === tier); if (!list.length) continue;
      const c = card(`${tier}차 무공`, tier > g.S.hero.adv ? `${tier}차 전직 때 열림` : '');
      for (const sk of list) {
        const lv = K.lv[sk.id] || 0, slot = K.slots.indexOf(sk.id), on = !K.off.includes(sk.id);
        const desc = sk.kind === 'active' ? `${SHAPE[sk.shape]} · 최대 ${sk.maxT}마리 · ${sk.hits}연타 · 한 대 ${(kitCoef(sk, Math.max(1, lv)) / 10).toFixed(0)}% · 쿨 ${sk.cdMs / 1000}초`
          : sk.kind === 'buff' ? `${sk.durMs / 1000}초 동안 ${statTxt(sk.stats(Math.max(1, lv)))} · 쿨 ${sk.cdMs / 1000}초` : statTxt(sk.stats(Math.max(1, lv)));
        const btns = lv ? [[lv < cap ? `올리기 ${unit(kitCost(lv, sk.tier)[0].n)}` : '상한', act(() => Hs.kitUp(sk.id, g.S.wallet) && (g.dirtyStats = true, g.emit('skill'), true)), !Hs.canKitUp(sk.id)]] : [];
        if (lv && sk.kind !== 'passive') {
          btns.push([slot >= 0 ? `${slot + 1}칸 ▶` : '칸에', act(() => { const i = slot >= 0 ? (slot + 1) % K.slots.length : Math.min(K.slots.length, SLOT_N - 1); const r = Hs.kitSlot(i, sk.id); g.dirtyStats = true; return r; })]);
          if (slot >= 0) btns.push([on ? '자동' : '수동', act(() => { Hs.kitAuto(sk.id, !on); g.dirtyStats = true; return true; })]);
        }
        const r = R(`<span style="color:${sk.col}">${sk.name}</span> <small>${KIND[sk.kind]}${lv ? ` · Lv ${lv}` : ''}</small>`, desc, btns, sk.name[0]);
        if (!lv) r.style.opacity = '.5';
        c(r);
      }
    }
  } else if (key === 'hero:4') {
    // 무공 강화 트리 — 무공마다 3단(1단 → 5점 → 2단 → 12점 → 3단). 기다림 없음
    const Hs = g.hero, K = Hs.kitState(), pts = g.treePts();
    const owned = KIT[g.S.hero.job].filter((sk) => K.lv[sk.id] && sk.kind !== 'passive');
    if (!owned.some((sk) => sk.id === treeSel)) treeSel = owned[0]?.id;
    const c0 = card(`무공 점수 ${pts.left} / ${pts.total}`, '레벨마다 1점 · 10칸마다 3점');
    c0(R('트리 초기화', `쓴 점수 ${pts.used}점을 돌려받아요 · 은자 ${unit(treeResetCost(pts.used)[0].n)}`, [['초기화', () => pop('트리를 초기화할까요?', `<p>쓴 점수 ${pts.used}점을 돌려받아요.</p><p class="note">은자 ${unit(treeResetCost(pts.used)[0].n)}</p>`, [['아니요', null], ['예', act(() => g.treeReset())]]), !pts.used]], '環'));
    const chips = document.createElement('div'); chips.className = 'chip-row';
    for (const sk of owned) { const b = document.createElement('button'); b.className = `chip${sk.id === treeSel ? ' on' : ''}`; b.innerHTML = `<span style="color:${sk.col}">${sk.name}</span>${Hs.treeSpent(sk.id) ? ` · ${Hs.treeSpent(sk.id)}점` : ''}`; b.onclick = () => { play('click'); treeSel = sk.id; paintWin(); }; chips.append(b); }
    B.append(chips);
    const sk = skillById(treeSel);
    if (sk) {
      const spent = Hs.treeSpent(sk.id), nodes = K.tree?.[sk.id] || {};
      for (let tier = 0; tier < 3; tier++) {
        const list = treeOf(sk).filter((nd) => nd.tier === tier); if (!list.length) continue;
        const opened = spent >= TREE_GATE[tier];
        const c = card(`${tier + 1}단`, opened ? '열림' : `이 무공에 ${TREE_GATE[tier]}점 쓰면 열림(지금 ${spent}점)`);
        for (const nd of list) {
          const lv = nodes[nd.n] || 0, eff = Object.entries(nd.eff).map(([k2, v]) => ({ pow: `위력 +${v / 10}%`, cdr: `쿨 −${v / 10}%`, rng: `범위 +${v / 10}%`, tgt: `대상 +${v}`, hit: `연타 +${v}`, cri: `이 무공 치명 +${v / 10}%`, dur: `지속 +${v / 10}%`, amp: `효과 +${v / 10}%` }[k2])).join(' · ');
          const r = R(`${nd.name} <small>${lv}/${nd.max} · ${nd.pts}점</small>`, `레벨마다 ${eff}`, [[lv >= nd.max ? '끝' : '올리기', act(() => g.treeUp(sk.id, nd.n)), !Hs.canTreeUp(sk.id, nd.n, g.stage().top)]], nd.name[0]);
          if (!opened) r.style.opacity = '.5';
          c(r);
        }
      }
    } else B.append(note('무공을 하나 이상 배우면 강화할 수 있어요.'));
  } else if (key === 'hero:2') {
    const c = card('마스터리', '최종 피해① · 값을 내면 바로 익힘');
    for (const m of MASTERY) {
      const done = g.S.hero.mastery.done.includes(m.id), can = g.hero.canLearn(m.id);
      const mn = (id) => MASTERY_NAME[+id.slice(1) - 1] || id;   // v522 m1 같은 id 대신 이름
      const r = R(`${m.depth}단 · ${mn(m.id)} <small>Lv ${m.lv}${m.need ? ` · ${mn(m.need)} 먼저` : ''}</small>`, `최종 피해① +${m.final1 / 10}%`, done ? [] : [['배우기', act(() => g.learn(m.id)), !can]], done ? '得' : '學');
      if (!done && !can) r.style.opacity = '.55';
      c(r);
    }
  } else if (key === 'hero:3') {
    const n = g.S.hero.adv + 1;
    const c = card(`${JOBS[g.S.hero.job].name} ${g.S.hero.adv}차`, '전직마다 무공이 열리고 체력이 오른다');
    for (let i = 1; i < JOB_LV.length; i++) {
      const done = g.S.hero.adv >= i;
      c(R(`${i}차 전직`, done ? '마침' : `Lv ${JOB_LV[i]} · 전직 던전을 깨면`, i === n ? [['도전', () => { play('click'); if (!g.enterDungeon('job')) toast(g.canDungeon('job') || '들어갈 수 없어요'); }, g.S.hero.lv < JOB_LV[i]]] : [], done ? '轉' : String(i)));
    }
  } else if (key === 'gear:0') {
    // 장착 — 가운데 무인 · 양옆 다섯 칸씩 · 칸을 누르면 아래에 자세히
    const G = g.S.gear, L = g.S.hero.lv, wrap = document.createElement('div'); wrap.className = 'eqwrap';
    const col = (list) => { const c = document.createElement('div'); c.className = 'eqcol'; for (const sl of list) c.append(eqCell(sl)); return c; };
    const mid = document.createElement('div'); mid.className = 'eqmid';
    const cvs = document.createElement('canvas'); cvs.width = 240; cvs.height = 300; mid.append(cvs);
    const pw = document.createElement('div'); pw.className = 'eqpw'; pw.innerHTML = `전투력 ${unit(g.power())}<small>${JOBS[g.S.hero.job].name} · Lv.${L}</small>`; mid.append(pw);
    wrap.append(col(SLOTS.slice(0, 5)), mid, col(SLOTS.slice(5)));
    const c0 = card('끼고 있는 것', `전투력 ${unit(g.power())}`); c0(wrap);
    const nb = SLOTS.filter((s) => G.bag.some((x) => x.slot === s && (!G.eq[s] || gearScore(x, L) > gearScore(G.eq[s], L)))).length;
    c0(R('최고 장비 모두 끼기', nb ? `${nb}칸을 더 좋은 것으로` : '모두 가장 좋은 것을 끼고 있어요', [['모두 끼기', act(() => { const p0 = g.power(), n = equipBest(G, L); g.dirtyStats = true; g.emit('equip'); if (n) setTimeout(() => toast(`${n}칸 바꿈 · 전투력 ${unit(p0)} → ${unit(g.power())}`), 0); return n > 0; }), !nb]], '裝'));
    requestAnimationFrame(() => { const x = cvs.getContext('2d'); x.clearRect(0, 0, 240, 300); x.save(); x.translate(0, 10); const gr = x.createRadialGradient(120, 190, 10, 120, 190, 130); gr.addColorStop(0, '#e8c26a44'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 240, 300); drawHero(x, 120, 270, g.S.hero.job, g.S.hero.lv, { t: now() / 1000, scale: 2.2, eq: g.S.gear.eq }); x.restore(); });
    const sl = eqSel && SLOTS.includes(eqSel) ? eqSel : null;
    if (sl) {
      const it = G.eq[sl], S2 = G.slots[sl], stt = it ? itemStats(it, S2, L) : {};
      const c1 = card(it ? `<span class="g${it.g}t">${GRADES[it.g]}품${it.up ? '上' : ''} ${SLOT_NAME[sl]}</span>` : `${SLOT_NAME[sl]} — 비어 있음`, `칸 강화 +${S2.enh} · 성혼 ★${S2.star}${S2.broken ? ' (파괴)' : ''}`);
      if (it) { const box = document.createElement('div'); box.className = 'eqst'; box.innerHTML = statTxt(stt).split(' · ').map((x) => `<span>${x}</span>`).join(''); c1(box); }
      c1(R('칸 강화', `+${S2.enh}`, [['강화', act(() => { const r = g.enhance(sl); if (r !== null) toast(r ? '강화 성공' : '강화 실패'); return r; })]], '强'));
      c1(R('칸 성혼', `★${S2.star}`, [['성혼', act(() => { const r = g.star(sl); if (r) toast({ ok: '성혼 성공', fail: '실패', down: '하락', break: '파괴!' }[r]); return r; }), !!S2.broken]], '魂'));
      if (it) c1(R('장착 해제', '가방으로', [['해제', act(() => { const r = unequip(G, sl); g.dirtyStats = true; return r; })]], '解'));
      const cand = G.bag.filter((x) => x.slot === sl).sort((a2, b2) => gearScore(b2, L) - gearScore(a2, L)).slice(0, 8);
      if (cand.length) { const c2 = card('가방에서 고르기', `${SLOT_NAME[sl]} ${G.bag.filter((x) => x.slot === sl).length}개`); c2(invGrid(cand, it, L)); }
    } else B.append(note('칸을 누르면 옵션 · 강화 · 성혼 · 가방의 다른 장비를 볼 수 있어요.'));
  } else if (key === 'gear:1') {
    const GA = g.S.gacha;
    const c0 = card(`장비 뽑기 Lv ${GA.lv}`, `경험치 ${GA.exp}/${gachaExpNeed(GA.lv)} · 차면 바로 오름`);
    const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = `<div style="width:${Math.min(100, (GA.exp / gachaExpNeed(GA.lv)) * 100)}%"></div><span>${GA.exp} / ${gachaExpNeed(GA.lv)}</span>`; c0(bar);
    c0(statGrid([['뽑기권', `${W['ticket:gear'] || 0}장`], ['정예 대기', `${GA.eliteQ}마리`]]));
    const c1 = card('뽑기', '10번마다 사냥터에 정예');
    for (const n of [1, 10, 30]) c1(R(`${n}번 뽑기`, (W['ticket:gear'] || 0) >= n ? `뽑기권 ${n}장` : '은자', [['뽑기', act(() => { const r = g.pullGear(n); if (r) showGacha(r); return r; })]], '抽'));
  } else if (key === 'gear:2') {
    // v528 가진 재료를 맨 위에 · 칸마다 다음 강화로 무엇이 얼마나 오르는지 · 누르면 강화 창
    const L = g.S.hero.lv, G = g.S.gear;
    const c0 = card('가진 재료', '강화 = 은자 + 강화석 · 성혼 = 은자');
    c0(statGrid([['은자', unit(W.gold || 0)], ['강화석', unit(W['item:stone'] || 0)], ['복구 주문서', `${W['item:restore'] || 0}장`]]));
    c0(note('강화석은 장비 분해(가방 · 일괄 분해)와 수련동 「단련동」에서 얻어요.'));
    // v543 모두 강화 — 낮은 칸부터 고르게 · 재료가 되는 만큼 · 결과 창(칸마다 전 → 후 · 성공/실패 · 쓴 재료 · 전투력)
    const lo = SLOTS.reduce((a, b) => (G.slots[b].enh < G.slots[a].enh ? b : a)), loCost = enhCost(G.slots[lo].enh, L);
    c0(R('모두 강화', have(loCost) ? `가장 낮은 칸부터 고르게 · 재료가 되는 만큼<br>다음: ${SLOT_NAME[lo]} +${G.slots[lo].enh} — ${costTxt(loCost)}` : `재료가 모자라요 — ${SLOT_NAME[lo]} +${G.slots[lo].enh}에 ${costTxt(loCost)}`,
      [['모두 강화', act(() => { const r = g.enhanceAll(); if (r) enhAllPop(r); return r; }), !have(loCost)]], '鍊'));
    const c = card('칸 강화 · 성혼', '칸에 붙는다 — 장비를 바꿔도 남음 · 누르면 강화 창');
    for (const sl of SLOTS) {
      const S2 = G.slots[sl], it = G.eq[sl];
      const gain = it && S2.enh < ENH_MAX ? diffTxt(itemStats(it, S2, L), itemStats(it, { ...S2, enh: S2.enh + 1 }, L)) : '';
      const cost = S2.enh < ENH_MAX ? enhCost(S2.enh, L) : [], can = cost.length && have(cost);
      const r = rowEl(`${SLOT_NAME[sl]} <small>+${S2.enh} · ★${S2.star}${S2.broken ? ' 파괴' : ''}</small>`,
        S2.enh >= ENH_MAX ? '강화 끝(+20)' : `${gain ? `<span class="up">+${S2.enh + 1}: ${gain}</span><br>` : ''}${costTxt(cost)}`,
        [['열기', () => { play('click'); enhPop(sl); }]]);
      if (can) r.classList.add('can');
      const ic = document.createElement('img'); ic.className = 'ico'; ic.src = eqIcon(sl, it); ic.alt = ''; ic.style.cssText = 'width:40px;height:40px;object-fit:contain;background:none'; r.prepend(ic);
      r.style.cursor = 'pointer'; r.onclick = (e) => { if (e.target.closest('button')) return; play('click'); enhPop(sl); };
      c(r);
    }
  } else if (key === 'gear:3') {
    const G = g.S.gear, L = g.S.hero.lv;
    const c0 = card(`가방 ${G.bag.length}개`, '누르면 비교 · 장착 · 잠금 · 분해 · ▲ 지금보다 좋음');
    c0(R('자동 분해', G.autoDis < 0 ? '끔' : `${GRADES[G.autoDis]}품 이하는 주우면 바로 분해`, [['바꾸기', act(() => { G.autoDis = G.autoDis >= 3 ? -1 : G.autoDis + 1; return true; })]], '分'));
    // v521 부위 고르기 · 정렬 · 일괄 분해
    const chips = document.createElement('div'); chips.className = 'chip-row bagf';
    for (const [k, nm] of [['all', '전부'], ...SLOTS.map((s) => [s, SLOT_NAME[s]])]) { const n = k === 'all' ? G.bag.length : G.bag.filter((x) => x.slot === k).length; if (k !== 'all' && !n) continue; const b = document.createElement('button'); b.className = `chip${bagF === k ? ' on' : ''}`; b.textContent = `${nm} ${n}`; b.onclick = () => { play('click'); bagF = k; paintWin(); }; chips.append(b); }
    const so = document.createElement('button'); so.className = 'chip sortb'; so.textContent = bagSort === 'g' ? '등급순' : bagSort === 'p' ? '좋은순' : '부위순'; so.onclick = () => { play('click'); bagSort = { g: 'p', p: 's', s: 'g' }[bagSort]; paintWin(); }; chips.append(so);
    c0(chips);
    const junk = junkOf(G, L, bagJunkG);
    const yld = {}; for (const it of junk) for (const c of dismantleYield(it.g)) yld[c.k] = (yld[c.k] || 0) + c.n;
    c0(R('일괄 분해', junk.length ? `낀 것보다 나쁜 ${junk.length}개(${GRADES[bagJunkG]}품 이하 · 잠금 빼고) → 강화석 ${yld['item:stone'] || 0}` : `낀 것보다 나쁜 장비가 없어요(${GRADES[bagJunkG]}품 이하)`,
      [['분해', act(() => { const r = dismantleMany(G, junk.map((x) => x.uid), W); if (r.n) setTimeout(() => toast(`${r.n}개 분해 · 강화석 +${r.out['item:stone'] || 0}`), 0); return r.n > 0; }), !junk.length], [`${GRADES[bagJunkG]}품↓`, () => { play('click'); bagJunkG = (bagJunkG + 1) % 7; paintWin(); }]], '分'));
    const list = G.bag.filter((x) => bagF === 'all' || x.slot === bagF).sort(bagSort === 'p' ? (a2, b2) => gearScore(b2, L) - gearScore(a2, L) : bagSort === 's' ? (a2, b2) => SLOTS.indexOf(a2.slot) - SLOTS.indexOf(b2.slot) || b2.g - a2.g : (a2, b2) => b2.g - a2.g || gearScore(b2, L) - gearScore(a2, L));
    if (list.length) { c0(invGrid(list.slice(0, bagMore ? 400 : 60), null, L)); if (list.length > 60 && !bagMore) c0(R(`${list.length - 60}개 더 있어요`, '', [['전부 보기', () => { play('click'); bagMore = true; paintWin(); }]], '…')); }
    else c0(note('가방이 비었어요. 뽑기에서 더 좋은 것은 바로 껴요.'));
  } else if (key === 'grow:0' || key === 'grow:1' || key === 'grow:2') {
    const sys = COLLECTS[+key.slice(5)], C = g.S.colls[sys], D = COLLECT[sys];
    const c0 = card(`${D.name} 뽑기`, `천장 ${C.pity}/200`);
    c0(R(`뽑기권 ${W[`ticket:${sys}`] || 0}장`, '많이 가지면 모은 효과 · 낀 것은 장착 효과', [['1번', act(() => g.pullCollect(sys, 1))], ['10번', act(() => { const r = g.pullCollect(sys, 10); if (r) toast(r.map((x) => GRADES[x.g]).join(' ')); return r; })]], '抽'));
    const c1 = card(`가진 ${D.name} ${Object.keys(C.own).length}`, `장착 ${C.eq.filter((x) => x !== null && x !== undefined).length}/${C.eq.length}`);
    const grid = document.createElement('div'); grid.className = 'gear-grid';
    for (const [k, o] of Object.entries(C.own).sort((a, b) => kindGrade(sys, +b[0]) - kindGrade(sys, +a[0]))) {
      const gr = kindGrade(sys, +k), t2 = document.createElement('div'); t2.className = 'gear-tile'; t2.style.setProperty('--gc', GCOL[gr]);
      t2.innerHTML = `<small>${GRADES[gr]}품${C.eq.includes(+k) ? ' · 장착' : ''}</small><b>${D.name} ${k}</b><span>Lv ${o.lv || 1} · 각성 ${o.awk} · ×${o.n}</span>`; grid.append(t2);
    }
    if (grid.children.length) c1(grid); else c1(note('아직 없어요 — 뽑기로 모아요.'));
  } else if (key === 'grow:3') {
    const R2 = g.S.realm;
    const c = card(`경지 ${R2.lv}`, '계정 공용 · 공격 · 체력');
    c(R('경지 올리기', '값을 내면 바로 오름', [['올리기', act(() => g.realmUp())]], '境'));
  } else if (key === 'grow:4') {
    const J = g.S.journey;
    const c = card(`강호행 ${J.step}단계`, `이긴 두목 ${J.cleared}`);
    c(R(`${J.cleared + 1}단계 두목`, '이기면 다음 단계를 열 수 있음', [['도전', act(() => { const r = g.journeyFight(); toast(r.cleared ? '이겼다' : '졌다'); return r; })]], '鬪'));
    c(R('다음 단계 열기', '최종 피해③ · 축복 · 옵션 2줄 — 바로 열림', [['열기', act(() => g.journeyOpen()), J.cleared <= J.step]], '開'));
  } else if (key === 'raid:0') {
    // v541 장 두목 토벌 — 깬 장 두목을 지금 칸 강함으로 다시(하루 2번 함께) · 빨리 깨면 별 · 별마다 처음 한 번 보상
    const left = g.raidLeft(), done = Object.keys(g.S.chb || {}).map(Number).filter((c) => CHBOSS[c]).sort((a, b) => b - a), Rd = g.S.raid || { star: {}, best: {} };
    const c0 = card('장 두목 토벌', `오늘 ${left} / ${CB_RAID.perDay}번 남음 · 자정에 다시`);
    c0(R('별 받기', `★1 깸 · ★2 ${CB_RAID.starMs[0] / 1000}초 안 · ★3 ${CB_RAID.starMs[1] / 1000}초 안 · 안 쓰러짐<br>별 보상(두목마다 처음 한 번): ★1 뽑기권 5 · ★2 강화석 30 · ★3 뽑기권 10<br>깰 때마다: 뽑기권 ${CB_RAID.tix} · 강화석 ${CB_RAID.stones} · 처치 은자 · 경험치`, [], '討'));
    if (!done.length) c0(R('아직 깬 장 두목이 없어요', '10칸마다 나오는 장 두목을 깨면 여기서 다시 칠 수 있어요', [], '·'));
    for (const ch of done) {
      const D = CHBOSS[ch], st = Rd.star?.[ch] || 0, best = Rd.best?.[ch];
      const r = R(`<img class="rdimg" src="art/s2/chb/chb${ch}.webp" alt="${esc(D.name)}">${ch}장 · ${esc(D.name)} <span class="rdstar">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span>`,
        `Lv ${g.raidLv(ch)} · ${best ? `최고 ${(best / 1000).toFixed(1)}초` : '아직 기록 없음'}${st < 3 ? ` · 다음 별 보상 ${esc(Object.entries(CB_RAID.starRew[st]).map(([k, n]) => `${k === 'item:stone' ? '강화석' : '뽑기권'} ${n}`).join(''))}` : ' · 별 다 받음'}`,
        [['토벌', act(() => { const ok2 = g.raid(ch); if (ok2) closeWin(); return ok2; }), !g.canRaid(ch)]], '');
      r.classList.add('rdrow'); c0(r);
    }
  } else if (key === 'content:0') {
    // v531 실제 던전 — 「입장」은 직접 싸움(사냥터 대신 던전) · 한 번 깬 던전은 「소탕」(바로 결과)
    const c = card('수련동', `입장권 ${staminaNow(g.S.stamina.daily, now())} · 2시간마다 1`);
    const RW = { gold: '은자', gear: '뽑기권', stone: '강화석', growth: '경험치' };
    for (const [k, D] of Object.entries(DAILY_DUNGEONS)) {
      const why = g.canDungeon('daily', k), swept = !!g.S.dungeons.best?.[k];
      c(R(D.name, `${DG_GOAL[D.clear]} · ${Math.round(D.timeMs / 1000)}초 · 보상 ${RW[k] || ''} · 오늘 ${g.S.dungeons.runs[k] || 0}/${DAILY_RUNS}${why && g.S.hero.lv < D.unlockLv ? ` · ${why}` : ''}`,
        [['입장', () => { play('click'); if (!g.enterDungeon('daily', k)) toast(g.canDungeon('daily', k) || '들어갈 수 없어요'); }, !!why], ...(swept ? [['소탕', act(() => { const r2 = g.dailyDungeon(k); if (r2) toast(r2.cleared ? `소탕 — ${D.name} 클리어` : '소탕 실패'); return r2; }), !!why]] : [])], '洞'));
    }
  } else if (key === 'content:1') {
    const c = card(`무한의 탑 ${g.S.tower.best}층`, '깬 층만큼 영구 보너스');
    c(R(`${g.S.tower.best + 1}층`, '적 넷을 60초 안에 모두 · 이기면 한 층 위로', [['도전', () => { play('click'); if (!g.enterDungeon('tower')) toast(g.canDungeon('tower') || '들어갈 수 없어요'); }, !!g.canDungeon('tower')]], '塔'));
  } else if (key === 'content:2') {
    const E = g.S.exped, c = card('원정', `원정권 ${W['ticket:exped'] || 0}장`);
    if (E.run) c(R(`원정 ${E.run.hours}시간`, now() >= E.run.endMs ? '끝남 — 받기' : `남은 ${left(E.run.endMs)}`, [['받기', act(() => g.claimExped()), now() < E.run.endMs], ['시간 티켓', act(() => g.timeTicket('exped', 15)), !(W['ticket:time'] > 0)]], '征'));
    else for (const h of EXPEDITION.hours) c(R(`${h}시간 원정`, '보내 두면 시간만큼 보상', [['출발', act(() => g.startExped(h))]], '征'));
  } else if (key === 'content:3') {
    const T = g.stage(), c = card(`${Math.ceil(T.idx / 10)}. ${chapterName(T.idx)} · Stage ${((T.idx - 1) % 10) + 1}/10`, `가장 멀리 ${Math.ceil(T.top / 10)}장 ${((T.top - 1) % 10) + 1}칸`);
    c(R('칸 옮기기', '깬 칸 안에서 오갈 수 있음', [['◀ 앞 칸', act(() => { if (g.bossFight || T.idx <= 1) return false; T.idx--; T.kills = 0; return true; })], ['다음 칸 ▶', act(() => { if (g.bossFight || T.idx >= T.top) return false; T.idx++; T.kills = 0; return true; })]], '地'));
    c(R('두목 자동 도전', T.auto ? '켬 — 칸 몹을 다 잡으면 저절로' : '끔 — 들판의 「두목 도전」으로', [['바꾸기', act(() => { T.auto = !T.auto; return true; })]], '自'));
    const c2 = card('장 목록', '15장 · 장마다 10칸');
    for (let ch = 1; ch <= 15; ch++) { const first = (ch - 1) * 10 + 1, opened = T.top >= first; const r = R(`${ch}. ${chapterName(first)}`, opened ? (Math.ceil(T.top / 10) > ch ? '다 깸' : `${((T.top - 1) % 10) + 1}/10칸`) : '잠김', opened ? [['가기', act(() => { if (g.bossFight) return false; T.idx = Math.min(T.top, ch * 10); T.kills = 0; return true; })]] : [], String(ch)); if (!opened) r.style.opacity = '.45'; c2(r); }
  } else if (key === 'rival:0') {
    const Wb = g.S.wb || { used: 0, best: 0, total: 0, day: '' };
    const used = Wb.day === String(dayKey(now())) ? Wb.used : 0;
    const c = card('월드보스', '90초 동안 넣은 피해가 점수');
    // v535 실제 싸움 — 90초 · 방어 자세(20초 · 피해 ×0.6) ↔ 약점 노출(10초 · ×1.8) · 무력화하면 피해 ×2
    c(R(`${WBF.name} <small>${WBF.title}</small>`, `오늘 ${used}/3번 · 90초 동안 넣은 피해가 점수 · 약점이 드러난 10초에 무공을 몰아 쓰세요`, [['도전', () => { play('click'); if (!g.enterDungeon('wboss')) toast(g.canDungeon('wboss') || '들어갈 수 없어요'); }, used >= 3 || !!g.canDungeon('wboss')]], '魔'));
    c(statGrid([['이번 주 점수 합', fmt(Wb.total)], ['한 번 최고', fmt(Wb.best)]]));
    B.append(note('미리보기: 서버 공동 체력 · 순위는 교체 때 붙어요. 점수 계산은 실제와 같아요.'));
  } else if (key === 'rival:1') {
    const P = g.S.pvp || { score: 1000, used: 0, day: '', log: [] };
    const used = P.day === String(dayKey(now())) ? P.used : 0;
    const c0 = card(`대결 점수 ${P.score}`, `오늘 ${used}/5번`);
    g.pvpOpponents().forEach((o, i) => c0(R(`${o.name} <small>${JOBS[o.f.job].name} Lv ${o.f.lv}</small>`, `대결 전투력 ${fmt(o.pw)}`, [['도전', act(() => { const r = g.pvpFight(i); if (r) { closeWin(); duelShow(r); } return r; }), used >= 5]], JOBS[o.f.job].name[0])));
    const log = g.S.pvp?.log || [];
    if (log.length) { const c1 = card('지난 대결'); for (const l of log) c1(R(`${l.win ? '승' : '패'} · ${l.name}`, `${l.d >= 0 ? '+' : ''}${l.d}`, [], l.win ? '勝' : '敗')); }
  } else if (key === 'rival:2') {
    const c = card('문파', '교체 때 서버와 함께 열려요');
    for (const [n, d, ic] of [['문파 토벌', '문파원 피해를 모아 주간 두목 단계를 깸', '伐'], ['문파 대항', '문파끼리 한 주 점수 겨루기', '爭'], ['문파 수련', '문파원 기여로 막대를 채우면 모두 보상', '修'], ['연구 · 도움', '문파원 기여로 연구를 올림', '硏']]) c(R(n, d, [], ic));
  } else if (key === 'title:0') {
    // v537 칭호 — 얻은 것 · 못 얻은 것(얻는 법) · 수집 효과 · 하나 달기
    const own = new Set(g.S.titles || []), n = TITLES.filter((t) => own.has(t.name)).length;
    const c0 = card('칭호 수집 효과', `${n} / ${TITLES.length}개`);
    c0(statGrid(Object.entries(TITLE_EACH).map(([k, v]) => [STATS[k]?.name || k, `+${(v * n / 10).toFixed(0)}% (하나마다 +${v / 10}%)`])));
    c0(R('다는 칭호', g.S.titleOn ? `「${esc(g.S.titleOn)}」 — 사냥터에서 이름 위에` : '없음', g.S.titleOn ? [['떼기', act(() => g.setTitle(null))]] : [], '稱'));
    const c1 = card('칭호', '장 두목 첫 처치 · 출석 28일');
    for (const t of TITLES) {
      const has = own.has(t.name), on = g.S.titleOn === t.name;
      const r = R(`<span style="color:${has ? t.col : 'inherit'}">${esc(t.name)}</span>`, has ? (on ? '달고 있음' : '얻음') : `잠김 — ${t.how}`, has ? [[on ? '달고 있음' : '달기', act(() => g.setTitle(t.name)), on]] : [], has ? '稱' : '鎖');
      if (!has) r.style.opacity = '.5'; c1(r);
    }
  } else if (key === 'today:0') {
    // v544 오늘 할 일 — 하루마다 도는 것을 한곳에서: 진행 막대 · 끝남 ✓ · 「가기」로 그 창
    const T = g.today(), open2 = T.filter((x) => x.open), left = open2.filter((x) => !x.done).length;
    const c0 = card('오늘 할 일', left ? `${left}개 남음 · 자정에 새로` : '오늘 할 일을 다 했어요!');
    // v545 하루 상자 — 다 하면 받기(뽑기권 · 은자)
    const TC = g.todayChest(), box = document.createElement('div'); box.className = `td-chest ${TC.can ? 'can' : TC.got ? 'got' : ''}`;
    box.innerHTML = `<i>${TC.got ? '📭' : '🎁'}</i><div><b>하루 상자</b><small>${TC.got ? '오늘은 받았어요 · 자정에 새로' : TC.can ? '다 했어요 — 눌러서 열기!' : `${TC.left}개 더 하면 열려요`}</small><span>장비 뽑기권 3 · 은자(사냥 30분 몫)</span></div>`;
    if (TC.can) box.onclick = () => { const r = g.claimToday(); if (!r) return; save(); play('rare', 5); buzz(60); box.classList.add('open'); setTimeout(() => { pop('하루 상자', `<div class="td-got"><span><i class="coin t"></i>장비 뽑기권 <b>${r.tix}</b></span><span><i class="coin s"></i>은자 <b>${unit(r.gold)}</b></span></div><p class="note">내일 또 — 자정에 새로</p>`); paintWin(); paintHud(); }, 650); };
    c0(box);
    const ic = { attend: '印', daily: '日', dungeon: '洞', raid: '討', wboss: '龍', pvp: '鬪', exped: '征', ach: '功' };
    for (const x of T) {
      const prog = x.of ? `<div class="achbar"><i style="width:${(x.n / x.of) * 100}%"></i><span>${x.n} / ${x.of}</span></div>` : x.n ? `받을 것 ${x.n}개` : '받을 것 없음';
      const r = R(x.name, x.open ? prog : `<span class="dn">${esc(x.why)} 열려요</span>`, x.open && !x.done ? [['가기', () => { play('click'); openKey(x.go); }]] : [], x.done ? '✓' : ic[x.id] || '·');
      r.classList.add('td-row'); if (x.done) r.classList.add('td-done'); if (!x.open) r.style.opacity = '.5';
      c0(r);
    }
  } else if (key === 'ach:0') {
    // v538 업적 — 종류마다 지금 단계(진행 막대 · 보상) · 끝난 단계 수 · 모두 받기
    const B = g.books.ach, can = B.claimable();
    const c0 = card('업적', `${ACH.filter((a) => B.get(a.id).got).length} / ${ACH.length} 받음`);
    c0(R('받을 업적', can.length ? `${can.length}개 — 뽑기권 · 강화석 · 사냥 보상` : '아직 없어요', [['모두 받기', act(() => { let n = 0; for (const id of B.claimable()) if (g.claimMission('ach', id)) n++; if (n) { play('coin'); setTimeout(() => toast(`업적 ${n}개 받음`), 0); } return n > 0; }), !can.length]], '功'));
    const c1 = card('목록', '단계를 깨면 다음 단계가 열려요');
    for (const ev of Object.keys(ACHIEVE)) {
      const list = ACH.filter((a) => a.ev === ev), cur = list.find((a) => !B.get(a.id).got) || list.at(-1), st = B.get(cur.id), all = list.every((a) => B.get(a.id).got);
      const pr = ev === 'level' ? Math.min(1, g.S.hero.lv / +cur.cond.split('>=')[1]) : Math.min(1, (st.p || 0) / cur.need);
      const progTxt = ev === 'level' ? `Lv ${g.S.hero.lv} / ${cur.cond.split('>=')[1].trim()}` : `${unit(st.p || 0)} / ${unit(cur.need)}`;
      const r = R(`${esc(cur.name)} <small>${list.filter((a) => B.get(a.id).got).length}/${list.length}단계</small>`,
        all ? '모두 끝냄' : `<div class="achbar"><i style="width:${pr * 100}%"></i><span>${progTxt}</span></div>보상 장비 뽑기권 ${cur.items['ticket:gear']} · 강화석 ${cur.items['item:stone']} · 사냥 ${cur.huntMin}분`,
        all ? [] : [['받기', act(() => g.claimMission('ach', cur.id)), !(st.done && !st.got)]], st.done && !st.got ? '★' : '功');
      if (st.done && !st.got) r.classList.add('can'); if (all) r.style.opacity = '.6';
      c1(r);
    }
  } else if (key === 'attend:0') {
    const A = g.attendState(), can = g.canAttend();
    const c = card('출석', `${A.n % ATTEND_DAYS || (A.n ? ATTEND_DAYS : 0)}/${ATTEND_DAYS}일${A.cycle ? ` · ${A.cycle}바퀴 끝` : ''}`);
    c(R(can ? `오늘 출석 — ${g.attendNext()}일째` : '오늘은 출석했어요', can ? attendLabel(ATTEND[g.attendNext()]) : '내일 다시(한국 시각 자정)', [['출석', () => { play('click'); attendPop(); }, !can]], '出'));
    const box = document.createElement('div'); box.innerHTML = attendGrid(); c(box.firstChild);
  } else if (key === 'mission:0') {
    const cur = guideCurrent(g.S.q.guide), c = card('길잡이', cur ? `지금 ${cur.id.slice(1)}번` : '다 끝냄');
    for (const q of GUIDE) {
      const s = g.S.q.guide[q.id], now2 = cur && q.id === cur.id;
      const r = R(`${q.id.slice(1)}. ${guideLabel(q)}`, s?.got ? '받음' : s?.done ? '끝 — 받기' : s ? `${s.p}/${q.need}` : '', now2 && s?.done ? [['받기', () => onGuide()]] : [], s?.got ? '✓' : now2 ? '▶' : '·');
      r.classList.add('quest-row'); if (now2) r.classList.add('now'); c(r);
    }
  } else if (key === 'mission:1' || key === 'mission:2') {
    const book = key === 'mission:1' ? 'daily' : 'weekly', list = key === 'mission:1' ? DAILY_MISSIONS : WEEKLY_MISSIONS;
    const c = card(key === 'mission:1' ? '일일 임무' : '주간 임무', key === 'mission:1' ? '매일 자정에 새로' : '월요일에 새로');
    for (const q of list) { const s = g.books[book].get(q.id); c(R(guideLabel(q), s.got ? '받음' : `${s.p}/${q.need}`, [['받기', act(() => g.claimMission(book, q.id)), !s.done || s.got]], s.got ? '✓' : s.done ? '!' : '·')); }
  } else if (key === 'mission:3') {
    const tg = (label, k, desc, ic) => R(label, desc, [[opt[k] ? '켜짐' : '꺼짐', () => { opt[k] = !opt[k]; saveOpt(); play('click'); if (k === 'bgm') bgm(chapterOf(g.zoneLv())); paintWin(); paintHud(); }]], ic);
    const c0 = card('소리 · 진동');
    c0(tg('효과음', 'sfx', '타격 · 무공 · 처치 · 뽑기 소리', '音'), tg('배경 가락', 'bgm', '장마다 다른 오음계 가락', '樂'), tg('진동', 'vib', '두목 패턴에 맞을 때 · 쓰러질 때(휴대폰)', '震'));
    const c1 = card('화면');
    c1(tg('화면 흔들림', 'shake', '큰 무공 · 두목 패턴 · 당겨짐', '搖'), tg('피해 측정기', 'dps', '들판 왼쪽 위에 초당 피해 · 분당 처치', '測'), tg('두목전 결과 자동 진행', 'autoNext', '결과 창이 3초 뒤 저절로 닫히고 다음으로', '進'));
    if (document.documentElement.requestFullscreen) c1(R('전체 화면', document.fullscreenElement ? '켜짐' : '주소창 없이 화면을 다 쓴다(안드로이드 · 컴퓨터)', [[document.fullscreenElement ? '끄기' : '켜기', () => { play('click'); goFull(!document.fullscreenElement); setTimeout(paintWin, 300); }]], '全'));
    c1(R('피해 숫자', { all: '전부', crit: '치명만', off: '끄기' }[opt.nums], [['바꾸기', () => { opt.nums = { all: 'crit', crit: 'off', off: 'all' }[opt.nums]; saveOpt(); paintWin(); }]], '數'));
    c1(R('그래픽', opt.gfx === 'low' ? '낮음(배터리 아낌 · 흙먼지 · 은자 연출 끔)' : '높음', [['바꾸기', () => { opt.gfx = opt.gfx === 'low' ? 'high' : 'low'; saveOpt(); paintWin(); }]], '畵'));
    const c4 = card('전투');   // v540
    c4(R('두목 패턴 자동 피하기', g.S.dodge !== false ? '켜짐 — 자동 전투 때 붉은 범위 밖으로 비켜요' : '꺼짐 — 붉은 범위는 회피 단추(점프 위 · Shift)로 직접 · 터지기 직전에 피하면 완벽 회피(피해 ×1.3) · 장 두목을 처음 깨면 강화석 +50', [[g.S.dodge !== false ? '켜짐' : '꺼짐', () => { g.setDodge(g.S.dodge === false); play('click'); save(); paintWin(); }]], '避'));
    const c3 = card('계정 · 저장', net.online ? (net.isGoogle() ? `Google · ${esc(net.email())}` : '이 기기만(Google 미연결)') : net.status === 'connecting' ? '연결 중…' : '오프라인 — 이 기기에만 저장');
    c3(R('Google 연결', net.isGoogle() ? '연결됨 — 다른 기기에서도 Google로 들어오면 이어서 해요' : '연결해 두면 기기를 바꾸거나 지워도 되살려요', [[net.isGoogle() ? '다른 계정' : '연결', () => { play('click'); if (net.isGoogle()) net.switchTo(null).then((d) => (d ? applyCloud(d) : toast('그 계정에는 새 시즌 진행이 없어요'))).catch((e) => toast(e?.message || '바꾸지 못했어요')); else linkGoogle(); }, !net.online]], 'G'));
    c3(R('서버에 저장', net.cloudAt ? `마지막 ${new Date(net.cloudAt).toLocaleString()} · 3분마다 저절로` : '3분마다 저절로 올려요', [['지금 저장', act(() => { cloudPush(true).then((ok) => toast(ok ? '서버에 저장했어요' : '저장하지 못했어요(오프라인?)')); return true; }), !net.online]], '雲'));
    c3(R('저장 코드', '계정 없이 글자 한 줄로 옮기기', [['복사', () => { play('click'); exportCode(); }], ['붙여넣기', () => { play('click'); importCode(); }]], '碼'));
    const c2 = card('계정');
    c2(R(`시간 티켓 ${W['ticket:time'] || 0}장`, '1장 = 15분 · 원정 · 방치에 씀', [], '時'));
    c2(R('새로 시작', '새 시즌 진행을 지우고 처음부터', [['처음부터', () => pop('새로 시작할까요?', '<p class="note">새 시즌 진행을 지워요(서버 저장도 새 진행으로 덮여요). 옛 게임 진행은 그대로예요. 남겨 두려면 먼저 「저장 코드 → 복사」.</p>', [['아니요', null], ['예', () => { localStorage.removeItem(SAVE_KEY); location.reload(); }]])]], '新'));
    c2(R('옛 게임(무림방치)', '예전 진행은 그대로 — 따로 열 수 있어요', [['열기', () => { save(); location.href = 'classic.html'; }]], '舊'));
    B.append(note('새 시즌은 계속 고쳐 가요 — 숫자 · 화면이 바뀔 수 있어요.'));
  }
}
// 가방 그림 칸 — 누르면 그 칸에 낌(지금 게임의 .inv-grid · .inv-tile)
// v521 장비 비교 창 — 이 장비 능력치와 지금 낀 것과의 차이(+초록 · −빨강) · 장착 · 잠금 · 분해
// ── v528 강화 창 ── 낀 장비 하나: 오르는 스탯(지금 → 성공하면) · 필요한 것 / 가진 것 · 강화 · 성혼 — 눌러도 창이 닫히지 않는다
const COST_NAME = { gold: '은자', 'item:stone': '강화석', 'item:restore': '복구 주문서' };
const have = (cost) => cost.every((c2) => (g.S.wallet[c2.k] || 0) >= c2.n);
const costTxt = (cost) => cost.map((c2) => { const h = g.S.wallet[c2.k] || 0; return `<span class="${h >= c2.n ? '' : 'dn'}">${COST_NAME[c2.k] || c2.k} ${unit(c2.n)}</span>`; }).join(' · ');
const fmtStat = (k, v) => (STATS[k]?.kind === 'rate' ? `${(v / 10).toFixed(1)}%` : unit(v));
function diffTxt(a, b) { return Object.keys(b).filter((k) => (b[k] || 0) !== (a[k] || 0)).map((k) => `${STATS[k]?.name || k} +${fmtStat(k, (b[k] || 0) - (a[k] || 0))}`).join(' · '); }
function statRows(a, b) {
  return Object.keys({ ...a, ...b }).map((k) => { const d = (b[k] || 0) - (a[k] || 0); return `<div class="cmp-r"><span>${STATS[k]?.name || k}</span><b>${fmtStat(k, a[k] || 0)}</b><em class="${d > 0 ? 'up' : ''}">${d > 0 ? `→ ${fmtStat(k, b[k])}` : '–'}</em></div>`; }).join('');
}
function needRows(cost) {
  return `<div class="need">${cost.map((c2) => { const h = g.S.wallet[c2.k] || 0; return `<div class="need-r ${h >= c2.n ? 'ok' : 'no'}"><span>${COST_NAME[c2.k] || c2.k}</span><b>${unit(c2.n)}</b><small>가진 것 ${unit(h)}</small></div>`; }).join('')}</div>`;
}
let enhProt = false;
// v531 대장간 연출 — 결과는 먼저 정해 두고(엔진), 화면은 망치질 · 숨 고르기 · 터짐으로 보여 준다. 누르면 건너뜀.
//   kind 'enh' | 'star' · rs: 결과 목록(여러 번이면 차례로) · after: 끝나고
function forgeFx(kind, sl, rs, before, after, done) {
  const sh = $('modal').querySelector('.sheet'), G = g.S.gear, it = G.eq[sl];
  const ov = document.createElement('div'); ov.className = `forge ${kind}`;
  const many = rs.length > 1;
  ov.innerHTML = `<div class="fg-stage"><div class="fg-ring"></div><div class="fg-glow"></div><img class="fg-item" src="${eqIcon(sl, it)}" alt=""><svg class="fg-ham" viewBox="0 0 64 64"><path d="M6 20l14-14 10 10-14 14z" fill="#cbd5e1" stroke="#1f2937" stroke-width="2"/><path d="M22 26l30 30" stroke="#8b5a2b" stroke-width="7" stroke-linecap="round"/></svg><div class="fg-sparks"></div></div>
    <div class="fg-txt"><small>${kind === 'enh' ? `+${before.enh} → +${before.enh + 1}` : `★${before.star} → ★${before.star + 1}`}</small><b>${kind === 'enh' ? '강화 중…' : '성혼 중…'}</b><em></em></div>
    <div class="fg-tally">${many ? rs.map(() => '<i></i>').join('') : ''}</div><div class="fg-skip">누르면 건너뛰기</div>`;
  sh.append(ov);
  const st = ov.querySelector('.fg-stage'), txt = ov.querySelector('.fg-txt b'), sub = ov.querySelector('.fg-txt small'), em = ov.querySelector('.fg-txt em'), sparks = ov.querySelector('.fg-sparks');
  const timers = []; let skipped = false;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const spark = (n, col) => { for (let i = 0; i < n; i++) { const p = document.createElement('i'); const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90; p.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--c:${col};--t:${0.4 + Math.random() * 0.5}s`; sparks.append(p); setTimeout(() => p.remove(), 1000); } };
  const finish = () => { for (const t of timers) clearTimeout(t); ov.remove(); done(); };
  ov.onclick = () => { if (skipped) return finish(); skipped = true; for (const t of timers) clearTimeout(t); show(rs.length - 1, true); later(900, finish); };
  const per = many ? 520 : 1250;
  let lvl = kind === 'enh' ? before.enh : before.star;
  const show = (i, last) => {
    const r = rs[i], ok = kind === 'enh' ? r === true : r === 'ok';
    if (kind === 'enh') { if (ok) lvl++; } else if (r === 'ok') lvl++; else if (r === 'down') lvl--; else if (r === 'break') lvl = 0;
    ov.classList.remove('ok', 'no', 'down', 'brk', 'big'); void ov.offsetWidth;
    const big = ok && (kind === 'enh' ? lvl >= 10 && lvl % 5 === 0 : lvl >= 15);
    ov.classList.add(ok ? 'ok' : r === 'break' ? 'brk' : r === 'down' ? 'down' : 'no'); if (big) ov.classList.add('big');
    txt.textContent = ok ? (big ? '대성공!' : '성공!') : r === 'break' ? '파괴!' : r === 'down' ? '하락…' : '실패';
    sub.textContent = kind === 'enh' ? `+${lvl}` : r === 'break' ? '★ 파괴됨' : `★${lvl}`;
    if (ok) { spark(big ? 46 : 26, big ? '#fde68a' : '#facc15'); play(big ? 'rare' : 'clear', 5); } else if (r === 'break') { spark(30, '#f87171'); play('burst'); } else play('fail');
    const tl = ov.querySelectorAll('.fg-tally i'); if (tl[i]) tl[i].className = ok ? 'o' : 'x';
    if (last || i === rs.length - 1) { const okN = rs.filter((x) => x === true || x === 'ok').length; em.innerHTML = many ? `${rs.length}번 중 <b>${okN}</b>번 성공` : ok ? after() : ''; }
  };
  const strike = (i) => { st.classList.remove('hit'); void st.offsetWidth; st.classList.add('hit'); spark(6, '#fbbf24'); play('hit'); };
  rs.forEach((_, i) => {
    const t0 = i * per;
    if (!many) { later(t0 + 120, () => strike(i)); later(t0 + 420, () => strike(i)); later(t0 + 720, () => { strike(i); play('tense'); ov.classList.add('hold'); }); later(t0 + 1050, () => { ov.classList.remove('hold'); show(i); }); }
    else { later(t0 + 120, () => strike(i)); later(t0 + 360, () => show(i)); }
  });
  later(rs.length * per + (many ? 900 : 1400), () => { if (!skipped) { ov.classList.add('done'); later(1300, finish); } });   // 결과를 잠깐 보여 주고 강화 창으로
}
// v543 모두 강화 결과 — 칸마다 +전 → +후가 하나씩 오르고 · 전투력 · 쓴 재료
function enhAllPop(r) {
  const rows = r.per.map((x, i) => `<div class="ea-r" style="--d:${0.1 + i * 0.08}s"><img src="${eqIcon(x.slot, g.S.gear.eq[x.slot])}" alt=""><span>${SLOT_NAME[x.slot]}</span><b>+${x.from}</b><i>→</i><b class="up">+${x.to}</b></div>`).join('');
  pop('모두 강화', `<div class="ea-sum"><span>성공 <b>${r.ok}</b></span><span>실패 <b>${r.fail}</b></span><span>은자 <b>${unit(r.gold)}</b></span><span>강화석 <b>${unit(r.stones)}</b></span></div>
    <div class="ea-list">${rows || '<p class="note">오른 칸이 없어요(모두 실패)</p>'}</div>
    <div class="ea-pw">전투력 ${unit(r.pw0)} → <b>${unit(r.pw1)}</b>${r.pw1 > r.pw0 ? ` <em>▲ ${unit(r.pw1 - r.pw0)}</em>` : ''}</div>`);
  play(r.per.length ? 'rare' : 'fail', 3); if (r.per.length) buzz(40);
  addLog(`모두 강화 — 성공 ${r.ok} · 실패 ${r.fail} · 강화석 ${unit(r.stones)}`);
}
function enhPop(sl) {
  const G = g.S.gear, L = g.S.hero.lv, it = G.eq[sl], S2 = G.slots[sl], sh = $('modal').querySelector('.sheet');
  if (!it) { closeModal(); eqSel = sl; openWin('bag', 0); return; }
  sh.classList.add('wide', 'enhs');
  const now0 = itemStats(it, S2, L);
  // 강화
  const eMax = S2.enh >= ENH_MAX, eCost = eMax ? [] : enhCost(S2.enh, L), eOk = eMax ? 0 : enhOk(S2.enh);
  const eAfter = eMax ? now0 : itemStats(it, { ...S2, enh: S2.enh + 1 }, L);
  // 성혼
  const sMax = S2.star >= STAR_MAX || S2.broken, prot = enhProt && S2.star >= PROTECT_FROM && S2.star <= PROTECT_TO;
  const sBase = sMax ? [] : starCost(S2.star, L), sCost = prot ? sBase.map((c2) => ({ k: c2.k, n: c2.n * (1 + PROTECT_BREAK_COST_X) })) : sBase;
  const od = sMax ? null : starOdds(S2.star), sAfter = sMax ? now0 : itemStats(it, { ...S2, star: S2.star + 1 }, L);
  const pct = (pm) => `${(pm / 10).toFixed(pm % 10 ? 1 : 0)}%`;
  sh.innerHTML = `<h2>장비 강화</h2>
    <div class="cmp-h"><img src="${eqIcon(sl, it)}" alt="${SLOT_NAME[sl]}"><div><b class="g${it.g}t">${GRADES[it.g]}품${it.up ? '上' : ''} ${SLOT_NAME[sl]}</b><small>칸 강화 <i class="hl">+${S2.enh}</i>/${ENH_MAX} · 성혼 <i class="hl">★${S2.star}</i>${S2.broken ? ' (파괴 — 복구 필요)' : ''} · 전투력 ${unit(g.power())}</small></div></div>
    <div class="enh2">
      <section><h3>강화 <span>${eMax ? '끝' : `+${S2.enh} → +${S2.enh + 1} · 성공 ${pct(eOk)}`}</span></h3>
        <div class="cmp">${statRows(now0, eAfter)}</div>
        ${eMax ? '<p class="note">강화를 끝까지 했어요.</p>' : `<div class="need-h">필요한 것 / 가진 것</div>${needRows(eCost)}<p class="note">실패해도 단계는 그대로 · 재료만 들어요.</p>`}
        <div class="btn-row"><button class="btn primary" id="ep-e1" ${eMax || !have(eCost) ? 'disabled' : ''}>강화</button><button class="btn" id="ep-e5" ${eMax || !have(eCost) ? 'disabled' : ''}>5번 강화</button></div>
      </section>
      <section><h3>성혼 <span>${sMax ? (S2.broken ? '파괴됨' : '끝') : `★${S2.star} → ★${S2.star + 1} · 성공 ${pct(od.ok)}${od.down ? ` · 하락 ${pct(od.down)}` : ''}${od.brk ? ` · 파괴 ${pct(od.brk)}` : ''}`}</span></h3>
        <div class="cmp">${statRows(now0, sAfter)}</div>
        ${sMax ? '' : `<div class="need-h">필요한 것 / 가진 것</div>${needRows(sCost)}<p class="note">실패가 쌓이면 다음 한 번은 성공(${S2.pity || 0}/${PITY_POINTS}).${S2.star >= PROTECT_FROM && S2.star <= PROTECT_TO ? ` <label class="prot"><input type="checkbox" id="ep-prot" ${enhProt ? 'checked' : ''}> 파괴 방지(은자 ×${1 + PROTECT_BREAK_COST_X})</label>` : S2.star < BREAK_FROM ? ' 15성부터 파괴될 수 있어요.' : ''}</p>`}
        <div class="btn-row"><button class="btn primary" id="ep-s1" ${sMax || !have(sCost) ? 'disabled' : ''}>성혼</button></div>
      </section>
    </div>
    <div class="btn-row" style="margin-top:10px"><button class="btn" id="ep-swap">장비 바꾸기</button><button class="btn" id="ep-off">해제</button><button class="btn primary" id="ep-close">닫기</button></div>`;
  const again = () => { save(); paintHud(); if (open) paintWin(); enhPop(sl); };
  const doEnh = (n) => {
    const before = { ...G.slots[sl] }, p0 = itemStats(it, G.slots[sl], L), rs = [];
    for (let i = 0; i < n; i++) { const r = g.enhance(sl); if (r === null) break; rs.push(r); if (G.slots[sl].enh >= ENH_MAX) break; }
    if (!rs.length) { toast('재료가 모자라요'); return; }
    save(); paintHud();
    forgeFx('enh', sl, rs, before, () => diffTxt(p0, itemStats(it, G.slots[sl], L)) || '', again);
  };
  $('ep-e1').onclick = () => doEnh(1);
  $('ep-e5').onclick = () => doEnh(5);
  $('ep-s1').onclick = () => {
    const before = { ...G.slots[sl] }, p0 = itemStats(it, G.slots[sl], L), r = g.star(sl, { noBreak: prot });
    if (!r) { toast('재료가 모자라요'); return; }
    save(); paintHud();
    forgeFx('star', sl, [r], before, () => diffTxt(p0, itemStats(it, G.slots[sl], L)) || '', again);
    if (r === 'break') setTimeout(() => toast('파괴! 복구 주문서로 되살릴 수 있어요'), 1300);
  };
  const pr = $('ep-prot'); if (pr) pr.onchange = (e) => { enhProt = e.target.checked; enhPop(sl); };
  $('ep-swap').onclick = () => { play('click'); closeModal(); sh.classList.remove('wide', 'enhs'); eqSel = sl; openWin('bag', 0); };
  $('ep-off').onclick = () => { play('click'); unequip(G, sl); g.dirtyStats = true; g.emit('equip'); closeModal(); sh.classList.remove('wide', 'enhs'); save(); paintHud(); if (open) paintWin(); };
  $('ep-close').onclick = () => { play('click'); closeModal(); sh.classList.remove('wide', 'enhs'); if (open) paintWin(); };
  $('modal').classList.remove('hidden');
}
function itemPop(c, L) {
  const G = g.S.gear, cur = G.eq[c.slot], a = itemStats(c, newSlot(), L), b = cur ? itemStats(cur, newSlot(), L) : {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const fmt = (k, v) => (STATS[k]?.kind === 'rate' ? `${(v / 10).toFixed(1)}%` : unit(v));
  const rows = keys.map((k) => { const d = (a[k] || 0) - (b[k] || 0); return `<div class="cmp-r"><span>${STATS[k]?.name || k}</span><b>${fmt(k, a[k] || 0)}</b><em class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d ? (d > 0 ? '▲ ' : '▼ ') + fmt(k, Math.abs(d)) : '–'}</em></div>`; }).join('');
  const sc = gearScore(c, L), sc0 = cur ? gearScore(cur, L) : 0;
  const head = `<div class="cmp-h"><img src="${eqIcon(c.slot, c)}" alt=""><div><b class="g${c.g}t">${GRADES[c.g]}품${c.up ? '上' : ''} ${SLOT_NAME[c.slot]}</b><small>${cur ? `지금: ${GRADES[cur.g]}품${cur.up ? '上' : ''}` : '지금 비어 있음'} · ${sc >= sc0 ? '<span class="up">더 좋음</span>' : '<span class="dn">지금 것이 더 좋음</span>'}</small></div></div>`;
  const yl = dismantleYield(c.g)[0];
  pop('장비 비교', head + `<div class="cmp">${rows}</div>`, [
    [c.lock ? '잠금 풀기' : '잠그기', () => { c.lock = !c.lock; save(); }],
    ...(c.lock ? [] : [[`분해(강화석 ${yl.n})`, () => { if (dismantleItem(G, c.uid, g.S.wallet)) { toast(`분해 · 강화석 +${yl.n}`); save(); } }]]),
    ['장착', () => { if (equip(G, c.uid)) { g.dirtyStats = true; g.emit('equip'); toast(`${SLOT_NAME[c.slot]} 낌`); save(); } }],
  ]);
}
function invGrid(items, cur, L) {
  const G = g.S.gear, GC2 = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
  const grid = document.createElement('div'); grid.className = 'inv-grid';
  for (const c of items) {
    const now2 = cur !== undefined && cur !== null ? cur : G.eq[c.slot], better = !now2 || gearScore(c, L) > gearScore(now2, L);
    const b = document.createElement('button'); b.className = `inv-tile${better ? ' up' : ''}`; b.style.setProperty('--gc', GC2[c.g] || '#fff');
    b.innerHTML = `<img src="${eqIcon(c.slot, c)}" alt="${SLOT_NAME[c.slot]}" style="width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))"><b>${GRADES[c.g]}품${c.up ? '上' : ''}</b><small>${SLOT_NAME[c.slot]}${better ? ' ▲' : ''}</small>`;
    if (c.lock) b.classList.add('locked');
    b.onclick = () => { play('click'); itemPop(c, L); };   // v521 바로 끼지 않고 비교 창부터
    grid.append(b);
  }
  return grid;
}

// ── 화면 귀퉁이(HUD) ── 단추는 한 번 만들고 글자만 바꾼다(누르는 사이 다시 그려지면 눌림이 사라진다)
const unit = (n) => {   // 큰 수: 만 · 억 · 조 · 경 두 자리까지(예: 307억 7367만)
  n = Math.floor(n || 0);
  const U = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  for (let i = 0; i < U.length; i++) if (n >= U[i][0]) { const a = Math.floor(n / U[i][0]), r = U[i + 1] ? Math.floor((n % U[i][0]) / U[i + 1][0]) : 0; return `${a}${U[i][1]}${r ? ` ${r}${U[i + 1][1]}` : ''}`; }
  return String(n);
};
const logLines = [];
function addLog(t) { if (logLines[0] === t) return; logLines.unshift(t); logLines.length = Math.min(logLines.length, 4); }   // v520 같은 줄이 잇따라 쌓이지 않게
let portraitKey = '';
function paintPortrait(H) {
  const E = g.S.gear.eq, key = `${H.job}:${H.lv}:${Object.values(E).map((it) => (it ? it.g : '-')).join('')}:${wearCount()}`; if (key === portraitKey) return; portraitKey = key;   // v516 장비가 바뀌면 얼굴도 새로
  const c = $('face'), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  x.save(); x.beginPath(); x.arc(52, 52, 50, 0, 7); x.clip();
  const gr = x.createRadialGradient(52, 40, 6, 52, 52, 60); gr.addColorStop(0, '#3a2e22'); gr.addColorStop(1, '#120f0b'); x.fillStyle = gr; x.fillRect(0, 0, 104, 104);
  drawHero(x, 52, 196, H.job, H.lv, { t: 0, scale: 1.75, eq: g.S.gear.eq });   // 얼굴 · 어깨만 보이게 크게
  x.restore();
}
// v519 레벨업 — 무인 위에 「LEVEL UP」 · 왼쪽 아래 Lv 상자가 번쩍
let lastLv = 0;
function levelUpFx(lv) {
  play('clear');
  const me = $('me'); me.classList.remove('lvup'); void me.offsetWidth; me.classList.add('lvup');
  for (const o of document.querySelectorAll('.lvfx')) o.remove();   // 잇따라 오르면 마지막 것만
  const d = document.createElement('div'); d.className = 'lvfx'; d.innerHTML = `<b>LEVEL UP</b><span>Lv.${lv}</span>`; $('battle').append(d); setTimeout(() => d.remove(), 1700);
}
function paintHud() {
  const S = g.S, H = S.hero, F = g.ensureFight(), T = g.stage(), z = zoneFor(g.zoneLv());
  if (!$('qc').onclick) {
    $('qc').onclick = onGuide;
    $('dg-leave').onclick = () => { play('click'); if (g.dg && confirm('던전에서 나갈까요? 입장권은 돌려받지 못해요.')) g.leaveDungeon(); };
    $('btn-boss').onclick = () => { play('click'); if (g.challenge()) toast('칸 두목 도전!'); else toast(`몹을 ${STAGE_KILLS}마리 잡으면 도전할 수 있어요`); };
    $('b-opt').onclick = () => { play('click'); openWin('opt', 0); };
    $('btn-sound').onclick = () => { opt.sfx = !(opt.sfx || opt.bgm); opt.bgm = opt.sfx; saveOpt(); bgm(chapterOf(g.zoneLv())); toast(opt.sfx ? '소리 켬' : '소리 끔'); paintHud(); };
    for (const b of document.querySelectorAll('.nb[data-tab]')) b.onclick = () => { play('click'); if (open === b.dataset.tab) closeWin(); else openWin(b.dataset.tab); };
    for (const b of document.querySelectorAll('.nb[data-key]')) b.onclick = () => { play('click'); openKey(b.dataset.key); };
    $('panel-close').onclick = closeWin; $('panel-dim').onclick = closeWin; $('panel-grip').onclick = closeWin;
    padHold('pl', -1); padHold('pr', 1);
    $('pd').onpointerdown = (e) => { e.preventDefault(); g.down(); };
    $('jp').onpointerdown = (e) => { e.preventDefault(); g.jump(); };
    $('ds').onpointerdown = (e) => { e.preventDefault(); g.dash(); };   // v546 회피
    $('au').onclick = () => { play('click'); g.setAuto(S.auto === false); toast(g.S.auto === false ? '수동 — ◀ ▶ 로 움직이고 점프 · 무공은 칸을 눌러요' : '자동 사냥'); save(); paintHud(); };
  }
  // 위 상태 줄: 얼굴 · 이름 · 전직 · Lv · 경험치 · 은자 · 뽑기권
  paintPortrait(H);
  const xp = Math.min(100, (H.exp / expToNext(H.lv)) * 100), jn = JOBS[H.job].name, rk = H.adv ? `${H.adv}차 전직` : '입문';
  $('me-job').textContent = jn; $('me-rank').textContent = rk; $('me-nm').textContent = `${jn} · ${rk}`;
  $('me-lv').textContent = `Lv.${H.lv}`;
  if (lastLv && H.lv > lastLv) levelUpFx(H.lv); lastLv = H.lv;
  $('xp-txt').textContent = `EXP ${xp.toFixed(2)}%`; $('xp-fill').style.width = `${xp}%`;
  $('g-gold').textContent = unit(S.wallet.gold); $('g-tix').textContent = S.wallet['ticket:gear'] || 0;
  $('btn-sound').classList.toggle('off', !(opt.sfx || opt.bgm));
  // 위 가운데: 장 이름 · 칸 진행(처치 n/20 → 두목 도전) · 두목전이면 두목 체력
  const ch = Math.ceil(T.idx / 10), st = ((T.idx - 1) % 10) + 1, boss = !!g.bossFight, Hh = F.hero;
  $('chap').textContent = `${ch}. ${chapterName(T.idx)}`;
  const bm0 = boss ? g.bossFight.mobs.find((m) => m.kind === 'boss') : null, spR = boss ? (bm0 ? Math.max(0, bm0.hp / bm0.st.hp) : 0) : Math.min(1, T.kills / STAGE_KILLS);
  $('sp').classList.toggle('boss', boss); $('sp-fill').style.width = `${spR * 100}%`;
  const waiting = !boss && T.auto && T.failIdx === T.idx && g.canChallenge() && !g.autoReady();   // v526 진 칸: 더 강해질 때까지 반복 사냥
  const dgs = g.dgStatus();   // v531 실제 던전 안
  if (dgs) { $('sp').classList.add('boss'); $('sp-fill').style.width = `${dgs.p * 100}%`; }
  $('sp-txt').textContent = dgs ? `던전 · ${dgs.title}` : boss ? `Stage ${st}/10 · 두목 ${Math.ceil(spR * 100)}%` : waiting ? `Stage ${st}/10 · 반복 사냥` : `Stage ${st}/10 · ${Math.min(T.kills, STAGE_KILLS)}/${STAGE_KILLS}`;
  // 왼쪽 아래: 무인 체력
  const hpR = Math.max(0, Hh.hp / Hh.st.hp);
  $('hp-fill').style.width = `${hpR * 100}%`; $('hp-trail').style.width = `${hpR * 100}%`; $('hp-fill').parentNode.classList.toggle('low', hpR < 0.3);
  $('hp-txt').textContent = `HP ${unit(Math.max(0, Hh.hp))} / ${unit(Hh.st.hp)}`;
  // 들판: 전투력 · 길잡이 · 칸 진행(두목전이면 두목 체력 · 남은 시간) · 두목 도전
  { const pw = g.power(); $('pw').textContent = unit(pw); pwWatch(pw); }   // v534 전투력이 바뀌면 튀어 오름
  const cur = guideCurrent(S.q.guide), cs = cur && S.q.guide[cur.id], qb = $('qc');
  qb.classList.toggle('hidden', !cur);
  if (cur) { qb.classList.toggle('ready', !!cs?.done); const qk = `${cur.id}:${cs?.p || 0}:${cs?.done ? 1 : 0}`; if (qb.dataset.k !== qk) { qb.dataset.k = qk; qb.innerHTML = `<div class="qh"><em>${cs?.done ? '완료' : '진행'}</em>길잡이 ${cur.id.slice(1)}</div><div class="qb">${esc(guideLabel(cur))}<small>${cs?.done ? '받기 ▶' : `${cs?.p || 0}/${cur.need}`}</small></div>`; } }   // 왼쪽 길잡이 카드: 상태 · 할 일 · 진행
  const ready = !boss && !dgs && g.canChallenge();
  $('btn-boss').classList.toggle('hidden', !ready); $('btn-boss').classList.toggle('ready', ready);
  const ch2 = $('contest-hud');
  document.body.classList.toggle('indg', !!dgs);
  ch2.classList.toggle('hidden', !boss && !dgs); if (!boss) ch2.classList.remove('chb'); document.body.classList.toggle('bossing', boss || !!dgs); ch2.classList.toggle('dg', !!dgs); $('dg-leave').classList.toggle('hidden', !dgs);   // 두목전엔 길잡이 카드를 숨겨 두목 막대에 눈이 가게   // 두목전일 때만(평소 진행은 위 가운데 막대)
  if (dgs) {
    $('contest-title').textContent = dgs.title;
    $('contest-fill').style.width = `${dgs.p * 100}%`; $('contest-pct').textContent = `${Math.floor(dgs.p * 100)}%`;
    $('contest-sub').textContent = `${dgs.label} · 남은 ${Math.ceil(dgs.leftMs / 1000)}초`;
  } else if (boss) {
    const B = g.bossFight, bm = B.mobs.find((m) => m.kind === 'boss');
    const bp = bm ? Math.max(0, bm.hp / bm.st.hp) : 0;
    $('contest-title').textContent = `${bm ? mobName(bm, z, chapterOf(T.idx)) : '두목'}`;
    $('contest-fill').style.width = `${bp * 100}%`; $('contest-pct').textContent = `${Math.ceil(bp * 100)}%`;   // v519 두목 체력 막대
    const cb = bm?.cb; ch2.classList.toggle('chb', !!cb);
    if (cb) {   // v532 장 두목: 막대 세 줄(줄마다 빛깔) · ×남은 줄 · 무력화 게이지 · 국면
      const bars = CB.bars, left = bp * bars, cur = Math.max(1, Math.ceil(left - 1e-9)), part = left - (cur - 1);
      $('contest-fill').style.width = `${Math.max(0, Math.min(1, part)) * 100}%`; ch2.dataset.bar = String(cur);
      $('contest-pct').textContent = `×${cur} · ${Math.ceil(bp * 100)}%`;
      $('contest-title').textContent = `${CHBOSS[cb.ch].name} — ${CHBOSS[cb.ch].title}`;
      const stun = bm.stunUntil > B.t;
      $('cb-gg').style.width = `${stun ? 100 : cb.gg / 10}%`; $('cb-gg').parentNode.classList.toggle('stun', stun);
      $('cb-ph').textContent = stun ? '기절!' : ['', '분노', '필살'][cb.phase];
    }
    $('contest-sub').textContent = bm?.cb ? `남은 ${Math.max(0, Math.ceil((B.limitMs - B.t) / 1000))}초 · ${(g.S.chb?.[bm.cb.ch] ? (g.S.chbDay?.[bm.cb.ch] === dayKey(now()) ? '오늘 보상은 받았어요' : '다시 깨면 강화석 · 뽑기권(하루 한 번)') : '첫 처치 — 확정 장비 · 칭호')}` : `남은 ${Math.max(0, Math.ceil((B.limitMs - B.t) / 1000))}초 · 클리어 보상 은자 ${unit(2 * 27 * goldPerMob(T.idx))} · 뽑기권 ${T.idx % 10 === 0 ? 10 : 1}`;
  } else {
    $('contest-title').textContent = `Stage ${st}/10`;
    $('contest-sub').textContent = ready ? '두목 준비 — 「두목 도전」' : `처치 ${T.kills} / ${STAGE_KILLS}`;
  }
  // 피해 측정기(설정에서 켬): 최근 10초 초당 피해 · 분당 처치
  const dm = $('dpsm'); dm.style.display = opt.dps ? 'block' : 'none';
  if (opt.dps) { const nowT = now(); while (dmgLog.length && dmgLog[0][0] < nowT - 10000) dmgLog.shift(); const sum = dmgLog.reduce((a, d) => a + d[1], 0); dm.innerHTML = `<b>초당 피해</b>${unit(sum / 10)}<br><b>분당 처치</b>${killRate()}`; }
  $('loglines').innerHTML = logLines.slice(0, 3).map((l) => `<div>${esc(l)}</div>`).join('');
  navDots();
  // 무공 줄: 자동 · 여섯 칸 · 점프 (수동이면 ◀▼▶)
  const au = $('au'); au.classList.toggle('on', S.auto !== false); au.textContent = S.auto === false ? '수동' : '자동';
  $('pad').classList.toggle('hidden', S.auto !== false);
  const sl = $('slots'), kit = Hh.kit || [];
  if (sl.children.length !== SLOT_N) {
    sl.innerHTML = '';
    for (let i = 0; i < SLOT_N; i++) {
      const b = document.createElement('button'); b.className = 'sk'; b.dataset.i = i;
      b.onpointerdown = (e) => { e.preventDefault(); if (!(g.ensureFight().hero.kit || [])[i]) { openKey(b.classList.contains('locked') ? 'hero:3' : 'hero:1'); return; } g.ensureFight().press({ slot: i }); };   // 빈 칸은 무공 창으로 · 잠긴 칸은 전직 창으로
      sl.append(b);
    }
  }
  // v519 아직 안 열린 칸 — 다음 전직에 열리는 무공의 차수(자물쇠 + n차)
  const lockedT = (KIT[H.job] || []).filter((x) => x.kind !== 'passive' && x.tier > (H.adv || 0)).map((x) => x.tier).sort((a, b) => a - b);
  let emptyN = 0;
  for (const b of sl.children) {
    const i = +b.dataset.i, k = kit[i], sk = k && skillById(k.id);
    const lt = sk ? null : lockedT[emptyN++] ?? null;
    b.classList.toggle('locked', lt != null);
    b.classList.toggle('ready', !!sk && !(Hh.cds && Hh.cds[i] > F.t));
    b.style.borderColor = sk ? sk.col : '';
    const name = sk ? sk.name.slice(0, 2) : lt != null ? `L${lt}` : '+';
    b.classList.toggle('empty', !sk); b.title = sk ? sk.name : lt != null ? `${lt}차 전직(Lv ${JOB_LV[lt]})에 열려요` : '무공 끼우기';
    if (b.dataset.n !== name) { b.dataset.n = name; b.innerHTML = lt != null ? `<svg class="ic lk" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="lt">${lt}차</span>` : `<span class="nm" style="color:${sk ? sk.col : ''}">${name}</span><span class="t">${sk ? 'ⅠⅡⅢⅣⅤⅥ'[sk.tier] || '' : ''}</span>${sk && k.auto ? '<i class="ad"></i>' : ''}`; }
    // 쿨: 이름은 그대로 두고 위에 시계 방향으로 걷히는 그늘 + 남은 초
    let cd = b.querySelector('.cdw');
    const remain = sk && Hh.cds ? Hh.cds[i] - F.t : 0, left = Math.ceil(remain / 1000);
    if (left > 0) { if (!cd) { cd = document.createElement('div'); cd.className = 'cdw'; b.append(cd); } cd.style.setProperty('--p', `${Math.min(100, (remain / (k.cdMs || 1)) * 100)}%`); cd.textContent = left; } else cd?.remove();
  }
}
function padHold(id, dir) {
  const b = $(id);
  const on = (e) => { e.preventDefault(); b.classList.add('on'); g.hold(dir); };
  const off = () => { if (!b.classList.contains('on')) return; b.classList.remove('on'); g.hold(0); };
  b.onpointerdown = on; b.onpointerup = off; b.onpointerleave = off; b.onpointercancel = off;
}
// v520 보상 연출 — 받은 곳에서 은자 알이 튀어 올라 왼쪽 위 은자 칸으로 빨려 든다
function coinFly(from, to, n) {
  if (!from || !to || opt.gfx === 'low') return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), host = $('battle'), H = host.getBoundingClientRect();
  const rot = document.body.classList.contains('rot');
  const loc = (r) => rot ? [r.top + r.height / 2 - H.top, H.right - (r.left + r.width / 2)] : [r.left + r.width / 2 - H.left, r.top + r.height / 2 - H.top];   // 돌린 화면이면 기기 좌표를 게임 좌표로
  const [ax, ay] = loc(a), [bx, by] = loc(b);
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'coin s coinfly'; c.style.cssText = `left:${ax}px;top:${ay}px`; host.append(c);
    const sx = (Math.random() - 0.5) * 90, sy = -30 - Math.random() * 50, d = 650 + i * 45;
    c.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(1.1)`, opacity: 1, offset: 0.3 }, { transform: `translate(calc(-50% + ${bx - ax}px), calc(-50% + ${by - ay}px)) scale(.5)`, opacity: 0.9 }], { duration: d, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => c.remove();
  }
  setTimeout(() => { to.parentNode?.classList.remove('bump'); void to.offsetWidth; to.parentNode?.classList.add('bump'); }, 640);
}
function onGuide() {
  const cur = guideCurrent(g.S.q.guide), cs = cur && g.S.q.guide[cur.id];
  if (!cur) return;
  if (cs?.done) { const g0 = g.S.wallet.gold, r = g.claimGuide(); if (r) { const dg = g.S.wallet.gold - g0; toast(`길잡이 ${r.id.slice(1)} 보상${dg > 0 ? ` · 은자 +${unit(dg)}` : ''}${r.items ? ' · 물건' : ''}`); play('loot'); coinFly($('qc'), $('g-gold'), 8); } save(); paintHud(); }
  else if (cur.go) openKey(goKey(cur.go));
}
const goKey = (go) => ({ gear: 'gear:0', gacha: 'gear:1', skill: 'hero:1', slot: 'gear:2', job: 'hero:3', pal: 'grow:1', weapon: 'grow:0', relic: 'grow:2', daily: 'content:0', realm: 'grow:3', hunt: 'content:3' }[go] || 'mission:0');

// ── 옆보기 사냥 화면 ──
const cv = $('cv'), cx = cv.getContext('2d');
const floats = [];
const mobHit = new Map();   // 몹 id → 맞은 때(번쩍 · 밀림)
let freezeUntil = 0;       // 큰 무공 적중 멈칫
let slowUntil = 0;         // v532 느린 화면
let dashAt = -1e9, dashTrail = [], perfAt = -1e9;   // v546 회피 잔상 · 완벽 회피
const pals = [];           // 화면 위 동료(무인 뒤를 따라감)
const JOB_COL = { sword: '#ffe9a8', spear: '#ffb27a', fist: '#ffd56a', bow: '#b6f0ff', mage: '#d4b8ff' };
const PAL_COL = ['#7dd3fc', '#86efac', '#fde68a', '#f9a8d4', '#c4b5fd'];
const PAL_KINDS = ['fox', 'crane', 'monkey', 'tiger', 'turtle', 'deer', 'haetae', 'qilin', 'phoenix', 'dragon'];
let lastCastAt = 0;
const palAtk = [];          // 동료 i → { at, mid } 마지막 공격
const tells = new Map();    // 두목 id → 예고 { pat, x, y, w, at, dur }
const dust = [];   // 발밑 흙먼지
const heroAnim = new PoseAnim();
let lastAtkPose = 0, lastFreeze = 0, stanceMix = 0;
// v507 싸우는 중 겨눔 자세(평타 사이에 차렷으로 서 있지 않게) — 직업마다 무기를 겨눈 채 낮게
const STANCE = {
  sword: { lean: 0.1, crouch: 0.24, lift: 0, dx: 0, hand: [1.15, 19], blade: -0.3, stretch: 0, alpha: 1, wscale: 1.15 },
  spear: { lean: 0.08, crouch: 0.22, lift: 0, dx: 0, hand: [0.45, 24], blade: -0.12, stretch: 0, alpha: 1, wscale: 1.1 },
  fist: { lean: 0.14, crouch: 0.32, lift: 0, dx: 0, hand: [-0.25, 20], blade: -0.6, stretch: 0, alpha: 1, wscale: 1.1 },
  bow: { lean: 0.04, crouch: 0.12, lift: 0, dx: 0, hand: [-0.08, 26], blade: 0, stretch: 0, alpha: 1, wscale: 1 },
  mage: { lean: 0.02, crouch: 0.1, lift: 0, dx: 0, hand: [-0.55, 22], blade: -1.0, stretch: 0, alpha: 1, wscale: 1 },
};
// 무인 공격 자세(지금 게임 자세 도감) — 평타는 짧게, 무공은 크게. 권사 평타는 정권 · 훅 · 올려치기를 번갈아
function heroAttackPose(job, big) {
  const K = {
    sword: big ? [[0, '검거양'], [0.12, '내려베기', 'snap']] : [[0, '발도준비'], [0.07, '일섬', 'snap']],
    spear: big ? [[0, '찌르기준비'], [0.12, '찌르기', 'snap']] : [[0, '찌르기준비'], [0.06, '찌르기', 'snap']],
    fist: big ? [[0, '마보'], [0.12, '쌍장', 'snap']] : [[0.05, ['정권', '훅', '올려치기'][fistN++ % 3], 'snap']],
    bow: [[0, '투척준비'], [big ? 0.14 : 0.08, '투척', 'snap']],
    mage: big ? [[0, '펼치기'], [0.14, '장타', 'snap']] : [[0, '펼치기'], [0.08, '휘두르기', 'snap']],
  }[job] || [[0, '발도준비'], [0.07, '일섬', 'snap']];
  heroAnim.play(K, big ? 0.28 : 0.18);
}
let lookDir = 1, lastPoseT = 0, fistN = 0;
let lastFight = null, lastDraw = 0, lookAhead = 0, zoomAt = -1e9, levelAt = -1e9, heroAirAt = 0, heroLandAt = -1e9, heroFace = 1, heroTurnFrom = 1, heroTurnAt = -1e9;
const coins = [];
// 피해 숫자 빛깔(위→아래) — 크기마다 한 번만 만든다(매 프레임 새로 만들지 않게)
const NUM_COL = [['#fff6c4', '#ffa31a'], ['#ffd0e8', '#ff3d8b'], ['#e0fbff', '#38bdf8']], numGr = new Map(), recentRows = new Map();
function numGrad(kind, fs) { const key = kind * 1000 + fs; let gr = numGr.get(key); if (!gr) { gr = cx.createLinearGradient(0, -fs, 0, 0); gr.addColorStop(0, NUM_COL[kind][0]); gr.addColorStop(1, NUM_COL[kind][1]); numGr.set(key, gr); } return gr; }
// 무공을 쓰면 그 칸이 번쩍
function flashSlot(id) { const kit = g.ensureFight().hero.kit || []; const i = kit.findIndex((k) => k.id === id); const b = $('slots')?.children[i]; if (b) { b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); } }   // 처치하면 은자가 튀어 무인에게 빨려 든다
const corpses = [], firstSeen = new Map(), lastNext = new Map(), atkAt = new Map(), hpLag = new Map();   // 몹 몸짓 기억
const shots = [];  // 날아가는 화살 · 기탄
let lastSwing = 0;
const hexAlpha = (c, a) => { const n = parseInt((c || '#ffffff').slice(1, 7), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
let footY = 0, stageFadeAt = -1e9, stageBanner = '';
let lastDust = 0, wasAir = false, hurtFlash = -1e9, lastHitAt = 0, heroRun = 0, lastHx = 0, skillFx = [], camSm = null, camSy = null, cutIn = null, shakeUntil = 0;
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
    cx.translate(x, y); cx.drawImage(im, -w / 2, -h * 0.78, w, h);   // 바닥 고리가 발 높이에(살짝 묻힘)
  } else if (f.shape === 'rain') {
    const n = 5, colW = 150 * k * big;
    for (let j = 0; j < n; j++) {
      const ph = Math.min(1, Math.max(0, (a * 1.6 - j * 0.12))); if (ph <= 0) continue;
      const sx = x + f.face * ((j + 0.6) / n) * Rpx, hh = colW * 1.7;
      cx.globalAlpha = Math.max(0, fade) * (ph < 0.85 ? 1 : (1 - ph) / 0.15);
      cx.drawImage(im, sx - colW / 2, y - hh * (0.25 + 0.75 * ph) + 6 * k, colW, hh);   // 끝은 땅에 꽂힌다
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
  if (f.shape === 'ring') { const r = tintImg('art/fx/fx-ring.png', col); if (r) { const w = 90 * k * (0.4 + ease); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - a; cx.translate(x, y - 2 * k); cx.scale(1, 0.4); cx.drawImage(r, -w / 2, -w / 2, w, w); cx.restore(); } return; }
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
  const r = { width: cv.clientWidth, height: cv.clientHeight }, dpr = opt.gfx === 'low' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  if (opt.gfx === 'low') { dust.length = 0; coins.length = 0; }
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const F = g.ensureFight(); if (!F) return;
  const W = r.width, Hh = r.height, t = now(), ts = t / 1000, map = F.def.map;
  const fdt = Math.min(100, Math.max(1, t - (lastDraw || t - 16))); lastDraw = t;
  const z = zoneFor(g.zoneLv());
  // 가까이 당겨 본다: 화면 너비에 약 15미터 — 무인을 가로 · 세로로 따라감(맵은 화면보다 넓고 높다)
  // 세로 화면이면 아래 조작 받침(168px)을 빼고, 가로로 너무 당겨지지 않게 넓게 본다
  const port = Hh > W * 1.1, dock = port ? 150 : 0;   // 아래 창 단추 줄 · 무공 줄
  const s = port ? Math.max(W / 8500, (Hh - dock) / 13000) : Math.max(W / 15000, Hh / 9000), k = Math.min(1.25, Math.max(0.7, s / 0.05));
  const viewW = W / s, viewH = Hh / s;
  const al = Math.max(0, Math.min(1, acc / 50));
  const lx = (o) => (o.px === undefined ? o.x : o.px + (o.x - o.px) * al), ly = (o) => (o.py === undefined ? o.y : o.py + (o.y - o.py) * al);
  // 보는 쪽을 조금 더 넓게(앞을 내다봄) — 돌아서면 천천히 넘어간다
  // v506 앞을 내다보는 몫은 「걸어가는 쪽」으로만, 천천히(1초) — 제자리에서 몹 따라 돌아설 때마다 화면이 출렁이지 않게
  const hvx = F.hero.px === undefined ? 0 : F.hero.x - F.hero.px;
  if (Math.abs(hvx) > 20) lookDir = Math.sign(hvx);
  lookAhead += (lookDir * viewW * 0.1 - lookAhead) * (1 - Math.exp(-fdt / 1000));
  const wantX = Math.max(0, Math.min(map.w - viewW, lx(F.hero) - viewW / 2 + lookAhead));
  const baseY = port ? Hh - dock - 36 : Hh * 0.8;   // 가로: 아래 20%는 무공 덩어리 · 조작 자리   // 바닥(높이 0)이 그려질 화면 높이 — 아래 패널 위
  // v512 위아래는 「서 있는 발판」만 따라간다 — 뛰는 동안엔 그대로, 내려선 뒤 천천히(0.35초). 무인이 화면 위 15% 밖으로 나가면 그때만 바로 따라감
  if (F.hero.plat >= 0) footY = map.plats[F.hero.plat]?.y ?? F.hero.y;
  const hyS = baseY - (ly(F.hero) - (camSy ?? 0)) * s, outTop = hyS < Hh * 0.15;
  const wantY = Math.max(0, Math.min(Math.max(0, map.h - baseY / s), (outTop ? ly(F.hero) : footY) - viewH * 0.3));
  // 살짝 늦게 따라감 — 프레임 수와 상관없이 같은 빠르기(60·120Hz 모두)
  if (camSm === null || Math.abs(camSm - wantX) > viewW) camSm = wantX; else camSm += (wantX - camSm) * (1 - Math.exp(-fdt / 95));
  // 무인은 늘 화면 가로 20~80% 안(달리면 끝으로 밀려나던 것)
  { const hxw = lx(F.hero), lo = hxw - viewW * 0.8, hi = hxw - viewW * 0.2; camSm = Math.max(Math.max(0, lo), Math.min(Math.min(map.w - viewW, hi), camSm)); }
  if (camSy === null || Math.abs(camSy - wantY) > viewH) camSy = wantY; else camSy += (wantY - camSy) * (1 - Math.exp(-fdt / (outTop ? 140 : 350)));
  const camX = camSm, camY = camSy;
  const P = (x, y) => [(x - camX) * s, baseY - (y - camY) * s];
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 흔들림: 마구잡이가 아니라 잦아드는 물결(눈이 덜 피곤하다)
  if (opt.shake && t < shakeUntil) { const q = ((shakeUntil - t) / 450) * 6; cx.translate(Math.sin(t * 0.09) * q, Math.cos(t * 0.113) * q * 0.7); }
  // 큰 무공(4 · 5차)이 터지면 무인 쪽으로 살짝 당겨졌다 돌아온다
  const zp = Math.max(0, 1 - (t - zoomAt) / 420);
  if (opt.shake && zp > 0) { const [zx, zy] = P(lx(F.hero), ly(F.hero) + 900), zz = 1 + 0.06 * Math.sin(zp * Math.PI / 2); cx.translate(zx, zy); cx.scale(zz, zz); cx.translate(-zx, -zy); }
  const ch = chapterOf(g.zoneLv()); preloadChapter(ch); preloadMobs(ch);
  drawPaintedBack(cx, W, Hh, ch, camX * s, z, camY * s);
  // 바닥 아래는 어둡게 채우고, 발판은 장마다 그린 그림
  const [, gy] = P(0, 0);
  drawEarth(cx, W, gy, Hh, ch, 62 * k);
  map.plats.forEach((p, i) => { const [x0, y] = P(p.x0, p.y), [x1] = P(p.x1, p.y); if (x1 < -20 || x0 > W + 20) return; drawPaintedLedge(cx, Math.max(-40, x0), Math.min(W + 40, x1), y, ch, z, (i === 0 ? 62 : 46) * k, i === 0); });
  // 두목 예고 — 땅에 붉은 범위가 차오르고(다 차면 터짐) 패턴 그림이 희미하게 · 이름
  for (const [id, q] of tells) {
    if (!F.mobs.some((m) => m.id === id) || t - q.at > q.dur + 200) { tells.delete(id); continue; }
    const A = BOSS_ART[q.pat] || BOSS_ART[CB_PATS[q.pat]?.art] || BOSS_ART.orb, pr = Math.min(1, (t - q.at) / q.dur);
    if (q.pat === 'summon') continue;
    if (q.safe) {   // v532 필살: 화면 전체가 붉게 차오르고 안전 지대만 빛난다
      const [s0] = P(q.safe[0], 0), [s1] = P(q.safe[1], 0);
      cx.save(); cx.globalAlpha = 0.18 + 0.22 * pr + 0.08 * Math.sin(ts * 20); cx.fillStyle = '#b91c1c'; cx.fillRect(0, 0, s0, Hh); cx.fillRect(s1, 0, W - s1, Hh);
      cx.globalAlpha = 0.35 + 0.2 * Math.sin(ts * 9); const sg = cx.createLinearGradient(0, Hh * 0.2, 0, Hh); sg.addColorStop(0, 'rgba(253,224,71,0)'); sg.addColorStop(1, 'rgba(253,224,71,.75)'); cx.fillStyle = sg; cx.fillRect(s0, 0, s1 - s0, Hh);
      cx.globalAlpha = 1; cx.strokeStyle = '#fde68a'; cx.lineWidth = 3; cx.setLineDash([10, 6]); cx.strokeRect(s0, 4, s1 - s0, Hh - 8); cx.setLineDash([]);
      cx.font = `900 ${22 * k}px system-ui`; cx.textAlign = 'center'; cx.lineWidth = 5; cx.strokeStyle = '#3b0000'; cx.fillStyle = '#fff';
      const lbl = `필살! ${Math.max(0, Math.ceil((q.dur - (t - q.at)) / 1000))}`; cx.strokeText(lbl, W / 2, Hh * 0.5); cx.fillText(lbl, W / 2, Hh * 0.5);
      cx.font = `800 ${14 * k}px system-ui`; cx.fillStyle = '#fde68a'; cx.strokeText('안전', (s0 + s1) / 2, Hh * 0.6); cx.fillText('안전', (s0 + s1) / 2, Hh * 0.6);
      cx.restore(); continue;
    }
    const [x0, y0] = P(q.x - q.w / 2, q.y), [x1] = P(q.x + q.w / 2, q.y), hh = 150 * k;
    cx.save();
    cx.globalAlpha = 0.32 + 0.14 * Math.sin(ts * 18); cx.fillStyle = '#ef4444'; cx.fillRect(x0, y0 - hh, x1 - x0, hh);
    cx.globalAlpha = 0.5; cx.fillStyle = A.col; const cw = (x1 - x0) * pr; cx.fillRect((x0 + x1) / 2 - cw / 2, y0 - 8 * k, cw, 8 * k);
    cx.globalAlpha = 0.9; cx.strokeStyle = '#fca5a5'; cx.lineWidth = 2; cx.setLineDash([8, 6]); cx.strokeRect(x0, y0 - hh, x1 - x0, hh); cx.setLineDash([]);
    const im = oldImg(A.tell); if (im) { const w = Math.min(x1 - x0, 220 * k); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.35 + 0.4 * pr; cx.translate((x0 + x1) / 2, y0); cx.scale(1, 0.4); cx.rotate(pr * 3); cx.drawImage(im, -w / 2, -w / 2, w, w); }
    cx.restore();
    const nm = BOSS_PATS.find((b) => b.id === q.pat)?.name || CB_PATS[q.pat]?.name || '';
    cx.font = `900 ${16 * k}px system-ui`; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#3b0000'; cx.fillStyle = '#fecaca';
    cx.strokeText(`${nm}!`, (x0 + x1) / 2, y0 - hh - 6); cx.fillText(`${nm}!`, (x0 + x1) / 2, y0 - hh - 6);
  }
  const H = F.hero, sc = 0.8 * k;
  { const ds = $('ds'); if (ds) { const on = !!(g.bossFight || g.dg); if (ds.classList.contains('hidden') === on) ds.classList.toggle('hidden', !on); if (on) ds.style.setProperty('--cd', Math.max(0, ((H.dashReady || 0) - F.t) / DASH.cdMs).toFixed(3)); }
    const pb = $('pbuf'), left2 = (H.perfUntil || 0) - F.t; if (pb) { const v = left2 > 0 && (g.bossFight || g.dg); pb.classList.toggle('hidden', !v); if (v) pb.textContent = `피해 ×${DASH.buffX} · ${(left2 / 1000).toFixed(1)}초`; } }   // v546 회피 단추 — 두목 · 던전 싸움에서만 · 쿨타임 그늘
  heroRun = H.act === 'run' || (H.px !== undefined && H.px !== H.x && H.plat >= 0) ? 6 : Math.max(0, heroRun - 1);
  if (F !== lastFight) { if (lastFight) { stageFadeAt = t; const T2 = g.stage(); stageBanner = g.bossFight ? '두목전' : `Stage ${((T2.idx - 1) % 10) + 1}/10`; } lastFight = F; firstSeen.clear(); lastNext.clear(); atkAt.clear(); hpLag.clear(); corpses.length = 0; mobHit.clear(); }   // 싸움이 바뀌면(두목전 · 칸 이동) 몹 번호가 새로 시작
  // 쓰러지는 몹(처치된 뒤 0.5초) — 뒤로 넘어가며 흐려지고 가라앉는다
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i], a = (t - c.at) / 520; if (a > 1) { corpses.splice(i, 1); continue; }
    const [x, y] = P(c.x, c.y); if (x < -120 || x > W + 120) continue;
    cx.save(); cx.globalAlpha = 1 - a * a; cx.translate(x, y + a * 6 * k); cx.rotate(-c.dir * Math.min(1, a * 1.8) * 1.2); cx.translate(-x, -y);
    drawMob(cx, x, y, c.m, z, { t: ts + c.m.id, flip: c.dir < 0, ch, hurt: 1, scale: sc * (c.m.kind === 'boss' ? 1.3 : 1) });
    cx.restore();
  }
  for (const m of F.mobs) {
    const [x, y] = P(lx(m), ly(m)); if (x < -120 || x > W + 120) continue;   // 화면 밖은 안 그린다
    // 나타남: 0.3초 동안 흐릿하게 내려앉음(먼지)
    let seen = firstSeen.get(m.id); if (seen === undefined) { seen = m.bornAt > 0 ? t : t - 1000; firstSeen.set(m.id, seen); if (m.bornAt > 0) dust.push({ x: m.x, y: m.y, at: t, land: 1 }); }
    const sa = Math.min(1, (t - seen) / 300);
    // 공격 몸짓: 엔진이 다음 공격 시각을 미루는 순간 = 방금 쳤다
    const pn = lastNext.get(m.id); if (pn !== undefined && m.nextAtk > pn) atkAt.set(m.id, t); lastNext.set(m.id, m.nextAtk);
    const aa = (t - (atkAt.get(m.id) ?? -1e9)) / 380, atk = aa >= 0 && aa < 1 ? aa : 0;
    // 맞음: 번쩍(0.07초) · 뒤로 젖혀짐 · 반대쪽으로 밀림
    const ha = t - (mobHit.get(m.id) || -1e9), hurt = ha >= 0 && ha < 200 ? 1 - ha / 200 : 0, kx = ha >= 0 && ha < 140 ? Math.sign(m.x - H.x || 1) * (m.kind === 'boss' ? 2 : m.kind === 'elite' ? 4 : 7) * k * (1 - ha / 140) : 0;   // 두목 · 정예는 덜 밀린다
    const mw = m.moving && m.plat >= 0 && !(m.vy);
    cx.save();
    if (sa < 1) { cx.globalAlpha = sa; cx.translate(0, -(1 - sa) * 14 * k); }
    if (mw) { cx.translate(x + kx, y); cx.rotate(Math.sin((ts + m.id) * 11) * 0.05); cx.translate(-(x + kx), -y); }   // 걸음마다 발을 축으로 몸이 좌우로 실린다
    const flash = ha >= 0 && ha < 70;
    if (flash) cx.filter = 'brightness(2.2) saturate(0.4)';
    drawMob(cx, x + kx, y, m, z, { t: ts + m.id, flip: m.dir < 0, moving: !!m.moving, ch, atk, hurt, scale: sc * (m.kind === 'boss' ? 1.3 : 1) });
    if (flash) cx.filter = 'none';
    cx.restore();
    if (mw && m.kind !== 'mob' && t - (m.dustAt || 0) > 260) { m.dustAt = t; dust.push({ x: lx(m) - (m.dir || 1) * 250, y: ly(m), at: t }); }
    const top = (mobHeight(m, ch) + 10) * sc * (m.kind === 'boss' ? 1.3 : 1), bw = (m.kind === 'boss' ? 90 : 34) * k;
    if (m.hp < m.st.hp || m.kind !== 'mob') {
      // 체력 줄: 잃은 몫은 흰 줄로 남았다가 천천히 따라 줄어든다
      const r = Math.max(0, m.hp / m.st.hp), lag = Math.max(r, (hpLag.get(m.id) ?? 1) - 0.012); hpLag.set(m.id, lag);
      cx.fillStyle = '#000a'; cx.fillRect(x - bw / 2, y - top, bw, 4); cx.fillStyle = '#fff8'; cx.fillRect(x - bw / 2, y - top, bw * lag, 4);
      cx.fillStyle = m.kind === 'boss' ? '#f59e0b' : '#e0436a'; cx.fillRect(x - bw / 2, y - top, bw * r, 4);
    }
    if (m.kind !== 'mob') { const nm = mobName(m, z, ch); cx.font = 'bold 11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = m.kind === 'boss' ? '#fde68a' : '#e9d5ff'; cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.strokeText(nm, x, y - top - 4); cx.fillText(nm, x, y - top - 4); }
  }
  // 무공 연출 — 모양마다(일직선 검기 · 부채꼴 베기 · 주변 폭발 · 하늘에서 쏟아짐 · 버프 기운)
  const [hx, hy] = P(lx(H), ly(H));
  window.__cam = [camX, camY, hx, hy, t, s, H.plat, H.face || 1];   // 시험용(모션 측정)
  for (let i = skillFx.length - 1; i >= 0; i--) {
    const f = skillFx[i], sk = skillById(f.id), col = sk?.col || '#ffe9a8';
    const life = f.shape === 'rain' ? 800 : f.shape === 'circle' ? 560 : f.shape === 'buff' ? 900 : f.shape === 'hit' ? 240 : f.shape === 'ring' ? 380 : f.shape === 'boss' ? 700 : f.shape === 'swing' ? 220 : 440, a = (t - f.at) / life;
    if (a > 1) { skillFx.splice(i, 1); continue; }
    if (a < 0) continue;
    if (f.shape === 'swing') {
      const [sx, sy] = P(f.x, f.y), [tx, ty] = P(f.tx, f.ty), jc = JOB_COL[f.job] || '#fff', ease = 1 - Math.pow(1 - a, 3);
      cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - a;
      if (f.job === 'sword') {   // 앞으로 크게 긋는 호
        const im = tintImg('art/fx/fx-slash.png', jc), w = 120 * k;
        cx.translate(sx + f.face * 34 * k, sy - 40 * k); cx.scale(f.face, 1); cx.rotate(-0.9 + ease * 1.3);
        if (im) cx.drawImage(im, -w * 0.2, -w / 2, w, w); else { cx.strokeStyle = jc; cx.lineWidth = 5 * k; cx.beginPath(); cx.arc(0, 0, 40 * k, -1, 1); cx.stroke(); }
      } else if (f.job === 'spear') {   // 창끝에서 표적까지 곧게 뻗는 찌르기
        const len = Math.max(60 * k, Math.abs(tx - sx)) * (0.4 + 0.6 * ease), y0 = sy - 42 * k;
        const gr = cx.createLinearGradient(sx, 0, sx + f.face * len, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, hexAlpha(jc, 0.8)); gr.addColorStop(1, '#fff');
        cx.fillStyle = gr; cx.beginPath(); cx.moveTo(sx, y0 - 4.5 * k); cx.lineTo(sx + f.face * len, y0); cx.lineTo(sx, y0 + 4.5 * k); cx.fill();
        cx.beginPath(); cx.moveTo(sx + f.face * len * 0.45, y0 - 11 * k); cx.lineTo(sx + f.face * (len + 16 * k), y0); cx.lineTo(sx + f.face * len * 0.45, y0 + 11 * k); cx.globalAlpha = (1 - a) * 0.6; cx.fill();
        const ring = tintImg('art/fx/fx-ring.png', jc); if (ring) { const rw = 46 * k * (0.5 + ease); cx.globalAlpha = 1 - a; cx.drawImage(ring, tx - rw / 2, y0 - rw / 2, rw, rw); }   // 창끝이 닿는 자리
      } else {   // 권: 맞는 자리에 동그랗게 터지는 충격
        const im = tintImg('art/fx/fx-burst.png', jc), w = 110 * k * (0.5 + ease);
        if (im) cx.drawImage(im, tx - w / 2, ty - 50 * k - w / 2, w, w); else { cx.fillStyle = jc; cx.beginPath(); cx.arc(tx, ty - 50 * k, w / 3, 0, 7); cx.fill(); }
      }
      cx.restore(); continue;
    }
    if (f.shape === 'boss') {   // 두목 패턴 터짐 — 지금 게임의 큰 그림(태극 · 꽃잎 폭풍 · 핏빛 · 흑구)을 범위 위에
      const A = BOSS_ART[f.pat] || BOSS_ART.orb, im = oldImg(A.burst), [bx, by] = P(f.x, f.y), w = Math.max(160 * k, f.w * s) * (0.7 + 0.4 * (1 - Math.pow(1 - a, 3)));
      cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = a < 0.6 ? 1 : (1 - a) / 0.4;
      if (im) cx.drawImage(im, bx - w / 2, by - w * 0.75, w, w); else { cx.fillStyle = A.col; cx.beginPath(); cx.arc(bx, by - w * 0.3, w / 2, 0, 7); cx.fill(); }
      cx.restore(); continue;
    }
    if (f.shape === 'hit' && !fxImg(g.S.hero.job, 'hit')) continue;
    // 무인이 쓴 베기 · 부채꼴 · 주변 폭발 · 버프는 무인을 따라간다(쓴 자리에 남아 허공에 떠 보이지 않게). 하늘에서 쏟아지는 것과 맞은 불꽃은 땅 · 몹 자리에
    const follow = f.hero && (f.shape === 'line' || f.shape === 'arc' || f.shape === 'circle' || f.shape === 'buff');
    drawSkillFx(cx, follow ? { ...f, hx: undefined, hy: undefined } : f, a, follow ? [hx, hy] : P(f.x, f.y), (f.R || 2000) * s, k, col, sk?.tier || 0);
  }
  // 버프 중이면 발밑 기운
  if (H.buffs?.length) { cx.save(); cx.globalAlpha = 0.35 + 0.15 * Math.sin(ts * 6); cx.strokeStyle = skillById(H.buffs[0].id)?.col || '#ffe9a8'; cx.lineWidth = 3 * k; cx.beginPath(); cx.ellipse(hx, hy, 34 * k, 10 * k, 0, 0, 7); cx.stroke(); cx.restore(); }
  // 동료: 장착한 동료가 무인 뒤를 늦게 따라온다(뛰고 · 무인이 무공을 쓰면 함께 번쩍)
  const eqPal = (g.S.colls?.pal?.eq || []).filter((x) => x !== null && x !== undefined).slice(0, 4);
  pals.length = eqPal.length;
  eqPal.forEach((kd, i) => {
    const wantX = lx(H) - H.face * (900 + i * 700), wantY = ly(H);
    const p = (pals[i] ??= { x: wantX, y: wantY, kind: PAL_KINDS[kd % PAL_KINDS.length] }); p.kind = PAL_KINDS[kd % PAL_KINDS.length];
    const dx = wantX - p.x; p.mv = Math.abs(dx) > 60; p.v = (p.v || 0) + ((Math.abs(dx) > 120 ? Math.sign(dx) * 4800 : dx * 8) - (p.v || 0)) * Math.min(1, fdt / 160); p.x += p.v * fdt / 1000; p.y += (wantY - p.y) * Math.min(1, fdt / 90);   // 고무줄처럼 늘었다 붙지 않고 달리듯(최고 속도 · 서서히 섬) p.face = Math.abs(dx) > 60 ? Math.sign(dx) : H.face;
    // 동료 공격: 표적 쪽으로 튀어 나갔다 돌아옴(0.35초) + 표적에 빛 고리
    const pa = palAtk[i], pt = pa && t - pa.at < 350 ? F.mobs.find((m) => m.id === pa.mid) : null;
    let ox = 0;
    if (pt) { const q = (t - pa.at) / 350, lg = Math.sin(q * Math.PI); ox = (lx(pt) - p.x) * 0.55 * lg; p.face = Math.sign(lx(pt) - p.x) || p.face;
      const ring = tintImg('art/fx/fx-burst.png', PAL_COL[i % PAL_COL.length]); const [tx, ty] = P(lx(pt), ly(pt) + 700);
      if (ring) { const w = 90 * k * (0.6 + q); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - q; cx.drawImage(ring, tx - w / 2, ty - w / 2, w, w); cx.restore(); } }
    const [px, py] = P(p.x + ox, p.y);
    const hop = p.mv ? -Math.abs(Math.sin(ts * 9 + i)) * 5 * k : Math.sin(ts * 2 + i) * 1.2 * k;   // 따라 뛸 때 통통 · 서 있으면 숨
    cx.save(); cx.globalAlpha = 0.95; drawCreature(cx, p.kind, px, py + hop, { t: ts + i, moving: p.mv, flip: p.face < 0, scale: 0.55 * k }); cx.restore();
    if (t - lastCastAt < 300) { cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.5 * (1 - (t - lastCastAt) / 300); cx.fillStyle = '#ffe9a8'; cx.beginPath(); cx.arc(px, py - 20 * k, 26 * k, 0, 7); cx.fill(); cx.restore(); }
  });
  const hw = heroRun > 0 && H.plat >= 0;
  if (hw && t - lastDust > 230) { lastDust = t; dust.push({ x: lx(H) - H.face * 250, y: ly(H), at: t }); }
  if (H.plat >= 0 && wasAir) dust.push({ x: lx(H), y: ly(H), at: t, land: 1 });   // 내려앉으면 흙먼지
  wasAir = H.plat < 0;
  // 흙먼지 — 발 뒤에서 피어 퍼지며 사라진다
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i], a = (t - d.at) / (d.land ? 420 : 360); if (a > 1) { dust.splice(i, 1); continue; }
    const [dx, dy] = P(d.x, d.y), r = (d.land ? 16 : 7) * k * (0.5 + a);
    cx.save(); cx.globalAlpha = 0.35 * (1 - a); cx.fillStyle = '#d8cbb0';
    cx.beginPath(); cx.ellipse(dx, dy - r * 0.4 - a * 6 * k, r * (d.land ? 2.2 : 1.3), r * 0.6, 0, 0, 7); cx.fill(); cx.restore();
  }
  // 뛰어오름은 길게 늘였다가, 내려앉으면 납작하게 눌렸다 편다 · 돌아설 때는 몸이 얇아졌다 펴진다
  if (H.plat < 0 && !heroAirAt) heroAirAt = t; if (H.plat >= 0 && heroAirAt) { heroAirAt = 0; heroLandAt = t; }
  const land = Math.max(0, 1 - (t - heroLandAt) / 170), air = H.plat < 0 ? Math.min(1, Math.abs(H.vy || 0) / 11000) : 0;
  const sqx = 1 + land * 0.12 - air * 0.06, sqy = 1 - land * 0.12 + air * 0.08;
  if ((H.face || 1) !== heroFace) { heroTurnFrom = heroFace; heroFace = H.face || 1; heroTurnAt = t; }
  const tp = Math.min(1, (t - heroTurnAt) / 90), tv = heroTurnFrom + (heroFace - heroTurnFrom) * (tp * tp * (3 - 2 * tp)), turn = Math.sign(tv || heroFace) * Math.max(0.55, Math.abs(tv));   // v506 돌아설 때 종잇장처럼 얇아지지 않게(최소 55%)
  cx.save(); cx.translate(hx, hy);
  if (hw) cx.rotate(Math.sin(ts * 14) * 0.06);
  cx.scale(sqx, sqy); cx.translate(-hx, -hy);
  heroAnim.tick(Math.max(0, (t - (lastPoseT || t)) / 1000)); lastPoseT = t;
  // 겨눔: 표적이 사거리 안이면 0.25초에 걸쳐 자세를 낮춘다 · 숨 쉬듯 살짝 오르내림
  const tgM = F.mobs.find((m) => m.id === H.target), inFight = !!tgM && Math.abs(tgM.y - H.y) <= 500 && Math.abs(tgM.x - H.x) <= (JOBS[g.S.hero.job].range || 1400) * 1.1 && H.plat >= 0 && !hw;
  stanceMix = Math.max(0, Math.min(1, stanceMix + (inFight ? 1 : -1) * fdt / 250));
  let pose = heroAnim.sample();
  if (!pose && stanceMix > 0 && H.plat >= 0 && !hw) { const st = STANCE[g.S.hero.job] || STANCE.sword; pose = mixPose(IDLE, { ...st, crouch: st.crouch + Math.sin(ts * 3) * 0.025 }, stanceMix * stanceMix * (3 - 2 * stanceMix)); }
  if (!pose && H.plat < 0) pose = (H.vy || 0) > 0 ? { ...POSES.기모으기, crouch: 0, lift: 2, hand: [-1.1, 22], blade: -1.2, lean: -0.08, wscale: 1 } : { ...POSES.착지, crouch: 0.15, lift: 0, wscale: 1 };   // 오를 때 · 떨어질 때 자세가 다르다
  else if (!pose && hw) { const ph = Math.sin(ts * 14); pose = { lean: 0.16, crouch: 0.1 + Math.abs(ph) * 0.12, lift: 0, dx: ph * 2, hand: [2.5 - ph * 0.4, 22], blade: -0.6, stretch: 0, alpha: 1, wscale: 1 }; }   // 달리기: 걸음마다 다리 벌어짐 · 팔 흔들기
  if (t - pillarAt < 1500) {   // v534 좋은 장비를 주웠을 때 무인 자리에 빛기둥
    const a2 = (t - pillarAt) / 1500, al = a2 < 0.15 ? a2 / 0.15 : 1 - (a2 - 0.15) / 0.85, bw = 46 * k * (1 + a2 * 0.4);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.75 * al;
    const gr = cx.createLinearGradient(hx - bw, 0, hx + bw, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, pillarCol); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(hx - bw, 0, bw * 2, hy + 6 * k);
    cx.globalAlpha = 0.5 * al; cx.fillStyle = '#fff'; cx.fillRect(hx - bw * 0.12, 0, bw * 0.24, hy);
    cx.restore();
  }
  // v546 회피 잔상 — 대시하는 0.3초 동안 지나온 자리에 옅은 그림자
  if (t - dashAt < 300) dashTrail.push({ x: hx, y: hy, at: t });
  dashTrail = dashTrail.filter((d) => t - d.at < 240);
  for (const d of dashTrail) { cx.save(); cx.globalAlpha = 0.35 * (1 - (t - d.at) / 240); cx.filter = 'brightness(1.8) saturate(0.3)'; drawHero(cx, d.x, d.y, g.S.hero.job, g.S.hero.lv, { t: ts, run: true, turn, pose, scale: sc, eq: g.S.gear.eq }); cx.restore(); }
  drawHero(cx, hx, hy, g.S.hero.job, g.S.hero.lv, { t: ts, run: heroRun > 0, turn, pose, lunge: pose ? 0 : Math.max(0, 1 - (t - lastHitAt) / 160), scale: sc, eq: g.S.gear.eq });
  cx.restore();
  // 레벨 업: 무인 위로 빛기둥과 고리(0.9초)
  const lu = (t - levelAt) / 900;
  if (lu >= 0 && lu < 1) {
    cx.save(); cx.globalCompositeOperation = 'lighter';
    const pg = cx.createLinearGradient(0, hy - 260 * k, 0, hy); pg.addColorStop(0, 'rgba(255,233,168,0)'); pg.addColorStop(1, `rgba(255,233,168,${0.55 * (1 - lu)})`);
    cx.fillStyle = pg; const pw = 46 * k * (1 - lu * 0.4); cx.fillRect(hx - pw / 2, hy - 260 * k, pw, 260 * k);
    cx.strokeStyle = `rgba(255,214,120,${1 - lu})`; cx.lineWidth = 3 * k; cx.beginPath(); cx.ellipse(hx, hy, 30 * k + lu * 70 * k, 9 * k + lu * 20 * k, 0, 0, 7); cx.stroke();
    cx.restore();
  }
  cx.font = '11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.strokeStyle = '#000'; cx.lineWidth = 3;
  cx.strokeText(JOBS[g.S.hero.job].name, hx, hy + 14); cx.fillText(JOBS[g.S.hero.job].name, hx, hy + 14);
  if (g.S.titleOn) {   // v537 단 칭호 — 머리 위에 빛깔 글
    const T = titleByName(g.S.titleOn), tx = `「${g.S.titleOn}」`;
    cx.font = `800 ${10.5}px system-ui`; const tw = cx.measureText(tx).width + 10;
    const ty = hy - 86 * sc;   // 머리 위(아래 메뉴에 가리지 않게)
    cx.save(); cx.globalAlpha = 0.85; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(hx - tw / 2, ty - 11, tw, 14); cx.restore();
    cx.fillStyle = T?.col || '#fde68a'; cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.strokeText(tx, hx, ty); cx.fillText(tx, hx, ty);
  }
  // 화살 · 기탄 — 무인 손에서 표적까지(살짝 포물선) · 빛 꼬리
  for (let i = shots.length - 1; i >= 0; i--) {
    const q = shots[i], a = (t - q.at) / q.dur;
    if (a > 1) { shots.splice(i, 1); continue; }
    if (a < 0) continue;
    const arc = q.kind === 'arrow' ? 260 : 0, px = (u) => q.x0 + (q.x1 - q.x0) * u, py = (u) => q.y0 + (q.y1 - q.y0) * u + arc * 4 * u * (1 - u);
    const [x, y] = P(px(a), py(a)), [bx, by] = P(px(Math.max(0, a - 0.18)), py(Math.max(0, a - 0.18))), ang = Math.atan2(y - by, x - bx);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    const tr = cx.createLinearGradient(bx, by, x, y); tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, q.kind === 'arrow' ? hexAlpha(q.col, 0.7) : 'rgba(110,231,183,0.8)');
    cx.strokeStyle = tr; cx.lineWidth = (q.kind === 'arrow' ? 3 : 7) * k; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(x, y); cx.stroke();
    cx.restore();
    cx.save(); cx.translate(x, y); cx.rotate(ang);
    if (q.kind === 'arrow') {
      const L = 42 * k;
      cx.strokeStyle = '#8b6a3a'; cx.lineWidth = 2.6 * k; cx.beginPath(); cx.moveTo(-L, 0); cx.lineTo(0, 0); cx.stroke();          // 살대
      cx.fillStyle = '#f3f4f6'; cx.beginPath(); cx.moveTo(7 * k, 0); cx.lineTo(-4 * k, -4.5 * k); cx.lineTo(-4 * k, 4.5 * k); cx.fill();   // 촉
      cx.fillStyle = q.crit ? '#ff6b9a' : '#f5f0e1'; cx.beginPath(); cx.moveTo(-L, 0); cx.lineTo(-L - 6 * k, -4 * k); cx.lineTo(-L + 5 * k, 0); cx.lineTo(-L - 6 * k, 4 * k); cx.fill();   // 깃
    } else {
      const r = 9 * k, og = cx.createRadialGradient(0, 0, 1, 0, 0, r * 2);
      og.addColorStop(0, '#ecfdf5'); og.addColorStop(0.35, 'rgba(52,211,153,0.9)'); og.addColorStop(1, 'rgba(52,211,153,0)');
      cx.globalCompositeOperation = 'lighter'; cx.fillStyle = og; cx.beginPath(); cx.arc(0, 0, r * 2, 0, 7); cx.fill();
    }
    cx.restore();
  }
  // 은자: 튀어 올랐다 떨어진 뒤(0.35초) 무인에게 빨려 든다(0.3초)
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i], a = (t - c.at) / 1000; if (a > 0.7) { coins.splice(i, 1); if (c.j === 0) play('coin'); continue; }
    let wx, wy;
    if (a < 0.35) { wx = c.x + c.vx * a; wy = Math.max(c.y - 600, c.y + c.vy * a - 22000 * a * a); }
    else { const q = (a - 0.35) / 0.35, e = q * q, bx = c.x + c.vx * 0.35, by = Math.max(c.y - 600, c.y + c.vy * 0.35 - 22000 * 0.1225); wx = bx + (lx(H) - bx) * e; wy = by + (ly(H) + 900 - by) * e; }
    const [cxp, cyp] = P(wx, wy), r = 4.2 * k, spin = Math.abs(Math.cos(t * 0.02 + c.j));
    cx.fillStyle = '#b8860b'; cx.beginPath(); cx.ellipse(cxp, cyp, r * Math.max(0.25, spin) + 1, r + 1, 0, 0, 7); cx.fill();
    cx.fillStyle = '#ffd75e'; cx.beginPath(); cx.ellipse(cxp, cyp, r * Math.max(0.2, spin), r, 0, 0, 7); cx.fill();
  }
  // 큰 피해 숫자 — 위로 쌓이며 떠오름
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], a = (t - f.at) / 1000;
    if (a > 1) { floats.splice(i, 1); continue; }
    if (a < 0) continue;   // 화살 · 기탄이 아직 날아가는 중
    if (opt.nums === 'off' || (opt.nums === 'crit' && !f.crit)) continue;
    // 튀어나오듯 커졌다 줄고(과하게 한 번 넘침) · 옆으로 살짝 흘러가며 · 치명은 처음에 떨린다
    const [x0r, y] = P(f.x, f.y), x0 = x0r + (f.row % 2 ? 14 : -14) * k * Math.min(1, f.row), yy = y - 95 * sc - f.row * 26 * k - a * 22 * k;   // 줄마다 좌우로 엇갈려 덜 가린다
    const pop = a < 0.12 ? 0.6 + (a / 0.12) * 0.75 : a < 0.22 ? 1.35 - ((a - 0.12) / 0.1) * 0.35 : 1;
    const x = x0 + (f.drift || 0) * a * 18 * k + (f.crit && a < 0.18 ? Math.sin(a * 220) * 2.5 * k : 0);
    const fs = Math.round((f.pal ? 14 : f.crit ? 24 : 18) * k * pop);
    cx.globalAlpha = a > 0.75 ? (1 - a) * 4 : 1; cx.textAlign = 'center';
    cx.font = `900 ${fs}px system-ui`; cx.lineWidth = 5; cx.strokeStyle = f.pal ? '#06323f' : f.crit ? '#5a0a2a' : '#3a2200';
    const txt = f.txt ??= unit(f.d) + (f.hits > 1 ? ` ×${f.hits}` : '');
    cx.save(); cx.translate(x, yy); cx.strokeText(txt, 0, 0);
    cx.fillStyle = numGrad(f.pal ? 2 : f.crit ? 1 : 0, fs); cx.fillText(txt, 0, 0); cx.restore();
    cx.globalAlpha = 1;
  }
  // 두목 패턴에 맞음 — 화면 가장자리 붉게(0.4초)
  if (t - hurtFlash < 400) { const v = cx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.3, W / 2, Hh / 2, Math.max(W, Hh) * 0.7); v.addColorStop(0, 'rgba(220,20,20,0)'); v.addColorStop(1, `rgba(220,20,20,${0.45 * (1 - (t - hurtFlash) / 400)})`); cx.fillStyle = v; cx.fillRect(0, 0, W, Hh); }
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
  // v512 칸이 바뀌면(20마리 · 두목전 · 장 이동) 화면이 툭 끊기지 않게 — 0.35초 검게 걷히며 가운데에 「Stage n/10」
  { const fa = (t - stageFadeAt) / 1200;
    if (fa >= 0 && fa < 1) {
      cx.save(); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dk = Math.max(0, 1 - (t - stageFadeAt) / 350); if (dk > 0) { cx.fillStyle = `rgba(0,0,0,${0.85 * dk})`; cx.fillRect(0, 0, W, Hh); }
      const ba = fa < 0.15 ? fa / 0.15 : fa > 0.75 ? (1 - fa) / 0.25 : 1, by = Hh * 0.36 - (1 - Math.min(1, fa / 0.15)) * 10;
      cx.globalAlpha = ba; cx.textAlign = 'center';
      const gr = cx.createLinearGradient(W * 0.2, 0, W * 0.8, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.fillRect(W * 0.2, by - 34, W * 0.6, 52);
      cx.font = '800 15px system-ui, sans-serif'; cx.fillStyle = '#e8c26a'; cx.fillText(document.getElementById('chap')?.textContent || '', W / 2, by - 12);
      cx.font = '900 26px system-ui, sans-serif'; cx.lineWidth = 4; cx.strokeStyle = '#000'; cx.strokeText(stageBanner, W / 2, by + 14); cx.fillStyle = '#fff'; cx.fillText(stageBanner, W / 2, by + 14);
      cx.restore();
    }
  }
  if (mobPrev.size > 300) mobPrev.clear();
  if (mobHit.size > 300) mobHit.clear();
}

// ── 돌리기 ──
let last = 0, lastMin = 0, lastSave = 0, lastHud = 0, acc = 0, resTimer = 0;
function frame() {
  const t = now();
  if (t < freezeUntil) { last = t; } else acc = Math.min(1000, acc + (t - last) * (t < slowUntil ? 0.22 : 1)); last = t;   // v532 장 두목 마지막 일격은 느린 화면   // 멈칫 동안은 엔진 시간을 쌓지 않는다
  const dt = acc - (acc % 50); acc -= dt;   // 엔진은 50ms 틱 — 남는 몫은 다음 프레임으로
  g.tick(t);
  if (dt > 0) {
    const F0 = g.ensureFight();
    const mobs = new Map(F0.mobs.map((m) => [m.id, m]));
    g.hunt(dt);
    const rows = new Map();
    let castShape = null, castCol = null;
    for (const e of g.lastEvents || []) {
      if (e[0] === 'hit') {
        const m = mobs.get(e[2]); if (!m) continue; lastHitAt = t;
        if (dmgLog.length < 600) dmgLog.push([t, e[3]]);
        // 궁사는 화살(평타 · 일직선 · 부채꼴 무공), 술사 평타는 옥빛 기탄 — 날아가 닿을 때 맞는다(번쩍 · 숫자도 그때)
        const job = g.S.hero.job, H0 = F0.hero;
        const shot = e[5] !== 2 && ((job === 'bow' && (e[5] === 0 || castShape === 'line' || castShape === 'arc')) || (job === 'mage' && e[5] === 0));
        let fly = 0;
        if (shot && shots.length < 40) {
          const x0 = H0.x + (H0.face || 1) * 350, y0 = H0.y + 950, x1 = m.x, y1 = m.y + 750;
          fly = Math.min(260, Math.max(80, Math.hypot(x1 - x0, y1 - y0) / (job === 'bow' ? 30 : 20)));
          const lag = (e[6] || 0) * 70 + (e[5] ? (shots.length % 3) * 30 : 0);
          shots.push({ x0, y0, x1, y1, at: t + lag, dur: fly, kind: job === 'bow' ? 'arrow' : 'orb', crit: e[4], col: castCol || '#ffe9a8' });
          play(job === 'bow' ? 'arrow' : 'orb');
          fly += lag;
        } else fly = (e[6] || 0) * 70 + (e[5] === 1 ? 90 : 0);   // 무공 타격은 이펙트가 터지는 때에 맞춰
        mobHit.set(m.id, t + fly);
        if (e[5] === 0 && t - lastAtkPose > 260) { lastAtkPose = t; heroAttackPose(job, false); }
        if (e[5] !== 2) { if (e[5] === 0 && !shot) play('swish'); setTimeout(() => play('hit', e[4]), fly); }
        // 근접 평타 — 검은 베기 호, 창은 찌르기 줄기, 권사는 맞는 자리에 충격(무기마다 다르게). 한 번 휘두를 때 한 번만
        if (e[5] === 0 && !shot && t - lastSwing > 120 && skillFx.length < 90) { lastSwing = t; skillFx.push({ at: t, shape: 'swing', job, x: H0.x, y: H0.y, tx: m.x, ty: m.y, face: Math.sign(m.x - H0.x) || H0.face || 1 }); }
        if ((e[5] || shot) && skillFx.length < 80) skillFx.push({ at: t + fly, shape: 'hit', x: m.x, y: m.y + 650, crit: e[4], rot: (m.x >= H0.x ? 0 : Math.PI) + (((m.id * 13 + (e[6] || 0) * 7) % 10) - 5) * 0.09 });
        const n = rows.get(m.id) || 0; rows.set(m.id, n + 1);
        // v520 같은 몹에 0.35초 안에 이어진 보통(치명 아님) 타격은 숫자 하나로 합쳐 올라간다(×n) — 여러 대가 한 자리에 겹쳐 읽히지 않던 것
        const mf = !e[4] && e[5] !== 2 ? floats.find((f) => f.mid === m.id && !f.crit && !f.pal && Math.abs(t + fly - f.at) < 350) : null;
        if (mf) { mf.d += e[3]; mf.hits = (mf.hits || 1) + 1; mf.txt = null; mf.at = Math.max(mf.at, t + fly - 60); continue; }
        if (floats.length < 60) floats.push({ x: m.x, y: m.y, d: e[3], crit: e[4], pal: e[5] === 2, at: t + fly, row: (n + (recentRows.get(m.id)?.t > t - 500 ? recentRows.get(m.id).n : 0)) % 6, mid: m.id, drift: ((m.id + n) % 3) - 1 }); const rr = recentRows.get(m.id); recentRows.set(m.id, { t, n: (rr && rr.t > t - 500 ? rr.n : 0) + 1 });
      }
      else if (e[0] === 'cast') { castShape = e[6]; castCol = skillById(e[2])?.col; skillFx.push({ at: t + 90, id: e[2], face: e[3], x: e[4], y: e[5], shape: e[6], R: e[7], hero: 1 }); }   // v507 휘두르는 순간(자세가 끝까지 가는 때)에 맞춰 터진다
      else if (e[0] === 'buff') { skillFx.push({ at: t, id: e[2], shape: 'buff', hero: 1 }); play('loot'); }
      else if (e[0] === 'pal') palAtk[e[2]] = { at: t, mid: e[3] };
      else if (e[0] === 'tell') { tells.set(e[2], { pat: e[3], x: e[4], y: e[5], w: e[6], at: t, dur: e[7], safe: e[8] != null ? [e[8], e[9]] : null }); play('tell'); }
      else if (e[0] === 'phase') { shakeUntil = t + 500; play('tense'); chbBanner(e[3] === 2 ? '필살 국면' : '분노', e[3] === 2 ? '붉은 땅 밖 — 빛나는 자리로 피하라!' : '두목이 빨라졌다', e[3] === 2 ? 'ult' : 'rage'); buzz(80); }
      else if (e[0] === 'stun') { play('rare', 4); chbBanner('무력화!', `${Math.round(e[3] / 1000)}초 기절 · 받는 피해 ×${CB.stunDmgX}`, 'stun'); }
      else if (e[0] === 'summon') addLog('두목이 졸개를 불렀다');
      else if (e[0] === 'wbw') { if (e[2]) { chbBanner('약점 노출!', `10초 · 받는 피해 ×${WBF.weakX} — 무공을 몰아 쓰세요`, 'stun'); play('rare', 4); shakeUntil = t + 300; } else chbBanner('방어 자세', `받는 피해 ×${WBF.guardX}`, 'rage'); }
      else if (e[0] === 'hurt') play('hurt');
      else if (e[0] === 'dash') { dashAt = t; play('swish'); }
      else if (e[0] === 'perfect') { perfAt = t; slowUntil = t + 650; shakeUntil = t + 160; play('rare', 5); buzz([30, 40, 30]); chbBanner('완벽 회피!', `${DASH.buffMs / 1000}초 동안 주는 피해 ×${DASH.buffX}`, 'stun'); addLog('완벽 회피!'); }
      else if (e[0] === 'die') { play('down'); buzz(200); }
      else if (e[0] === 'burst') { tells.delete(e[2]); skillFx.push({ at: t, shape: 'boss', pat: e[3], x: e[4], y: e[5], w: e[6] }); shakeUntil = t + (e[7] ? 420 : 220); if (e[7]) { hurtFlash = t; buzz(60); } play('burst'); }
      else if (e[0] === 'kill') { if (e[3] === 'boss' && g.lastFight?.def?.chb) { slowUntil = t + 900; shakeUntil = t + 700; chbBanner('BOSS DEFEATED', '', 'win'); } play('kill'); if (killLog.length < 500) killLog.push(t); const m = mobs.get(e[2]); if (m && coins.length < 40) for (let j = 0; j < (m.kind === 'mob' ? 2 : 6); j++) coins.push({ x: m.x, y: m.y + 600, vx: ((j % 3) - 1) * 900 + ((m.id * 7 + j * 13) % 9 - 4) * 120, vy: 5200 + (j % 2) * 1500, at: t, j }); if (m && corpses.length < 30) corpses.push({ m: { id: m.id, kind: m.kind }, x: m.x, y: m.y, dir: m.dir || 1, at: t + 40 }); firstSeen.delete(e[2]); lastNext.delete(e[2]); atkAt.delete(e[2]); hpLag.delete(e[2]); if (m && skillFx.length < 90) skillFx.push({ at: t, shape: 'ring', x: m.x, y: m.y }); }
      if (e[0] === 'cast') { heroAttackPose(g.S.hero.job, true); lastAtkPose = t; play('skill'); lastCastAt = t; const tr = skillById(e[2])?.tier || 0; if (tr >= 3 && t - lastFreeze > 700) { freezeUntil = t + 45; lastFreeze = t; } if (tr >= 4) zoomAt = t; flashSlot(e[2]); }   // 큰 무공은 맞는 순간 0.06초 멈칫
      if (e[0] === 'cast' && skillById(e[2])?.tier === 5) { cutIn = { at: t, id: e[2] }; shakeUntil = t + 450; }
    }
  }
  if (t - lastMin >= 60000) { lastMin = t; g.minute(); }
  for (const f of g.feed.splice(0)) {
    if (f.k === 'level') { play('level'); levelAt = now(); addLog(`레벨 업 — Lv ${f.lv}`); }   // v520 알림 대신 무인 위 LEVEL UP(v519)
    else if (f.k === 'guide') addLog('길잡이 완료 — 왼쪽 위에서 받기');
    else if (f.k === 'advance') toast(`${f.n}차 전직!`);
    else if (f.k === 'boss') addLog('사냥터 두목 처치!');
    else if (f.k === 'retreat') { addLog(`몹이 세서 ${Math.ceil(f.idx / 10)}장 ${((f.idx - 1) % 10) + 1}칸으로 물러났어요 — 더 강해지면 다시 나아가요`); toast('앞 칸으로 물러났어요 — 강해지면 다시 나아가요'); }
    else if (f.k === 'sudden') toast(`돌발 미션: 10분 안에 ${f.need}마리`);
    else if (f.k === 'realm') addLog(`경지 ${f.lv}`);
    else if (f.k === 'gacha-lv') addLog(`뽑기 레벨 ${f.lv}`);
    else if (f.k === 'tree') { const sk = skillById(f.id); toast(`${sk?.name} 강화 완료`); }
    else if (f.k === 'challenge') { play('boss'); addLog(f.raid ? `토벌 — ${CHBOSS[f.chb].name} · Lv ${f.idx}` : `${Math.ceil(f.idx / 10)}장 ${((f.idx - 1) % 10) + 1}칸 ${f.chb ? '장 두목' : '두목'} 도전`); if (f.chb) chbIntro(f.chb); }
    else if (f.k === 'raid-end') showRaidResult(f);
    else if (f.k === 'stage-clear' || f.k === 'stage-fail') showResult(f);
    else if (f.k === 'dungeon-start') { closeWin(); play('tense'); if (f.type === 'wboss') wbIntro(); else dgBanner(f.title, g.dgStatus()); addLog(`${f.title} 입장`); }
    else if (f.k === 'dungeon-end') showDgResult(f);
    else if (f.k === 'loot') lootFx(f);
    else if (f.k === 'ach') achFx(achById.get(f.id));
  }
  if (!document.hidden) draw();   // 안 보이는 동안은 그리지 않는다(엔진은 돈다)
  if (dust.length > 60) dust.splice(0, dust.length - 60);
  if (t - lastHud > 200) { lastHud = t; paintHud(); }
  if (t - lastSave > 10000) { lastSave = t; save(); cloudPush(false); }
  if (resTimer && t > resTimer) closeResult();
  requestAnimationFrame(frame);
}
// v513 두목전 결과 — 이기면 「STAGE CLEAR」 + 실제 보상 · 걸린 시간 · 다음 칸, 3초 막대가 차면 저절로 다음으로(설정에서 끔)
//   지면 까닭(시간 초과 · 두목 남은 체력 · 쓰러짐) + 강해지기 · 다시 도전 · 사냥 계속(3초)
const RES_MS = 3000;
function showResult(f) {
  const ch = Math.ceil(f.idx / 10), st = ((f.idx - 1) % 10) + 1, win = f.k === 'stage-clear', auto = opt.autoNext;
  play(win ? 'clear' : 'fail'); bgm(chapterOf(g.zoneLv()));
  const sec = (f.ms / 1000).toFixed(1), nch = Math.ceil(f.next / 10), nst = ((f.next - 1) % 10) + 1, newCh = win && nch !== ch;
  const tile = (cls, n, label, i) => `<div class="rt" style="--d:${0.35 + i * 0.12}s"><i class="coin ${cls}"></i><b data-n="${n}">0</b><small>${label}</small></div>`;
  const R = $('res');
  R.className = `open ${win ? 'win' : 'lose'}`;
  R.innerHTML = win
    ? `<div class="rp"><div class="rays"></div>
        <div class="rsub">${ch}장 ${esc(chapterName(f.idx))} · Stage ${st}/10</div>
        <div class="rtitle">${f.chb ? 'BOSS DEFEATED' : 'STAGE CLEAR'}</div>
        <div class="rmeta"><span>걸린 시간 <b>${sec}초</b></span>${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
        ${f.chb?.first ? `<div class="rnew cbfirst"><img src="art/s2/chb/chb${f.chb.ch}.webp" alt=""><div><small>첫 처치 · 칭호</small><b>「${esc(f.chb.name)} 격파」</b><span class="g${f.chb.gear?.g}t">확정 장비 — ${GRADES[f.chb.gear?.g] || ''}품${f.chb.gear?.up ? '上' : ''} ${SLOT_NAME[f.chb.gear?.slot] || ''}</span></div></div>` : ''}
        <div class="rtiles">${tile('s', f.gold, '은자', 0)}${tile('t', f.tix + (f.chb?.tix2 || 0), '뽑기권', 1)}${f.chb?.stones || f.chb?.manual ? tile('st', (f.chb.stones || 0) + (f.chb.manual || 0), '강화석', 2) : ''}</div>${f.chb?.manual ? `<div class="rnew">자동 피하기 없이 첫 처치 — 강화석 +${f.chb.manual}</div>` : ''}
        <div class="rnext">${newCh ? `<em>새 장</em> ${nch}장 ${esc(chapterName(f.next))}` : `다음 · Stage ${nst}/10`}</div>
        <div class="racts"><button class="btn primary rgo" id="rout"><span>다음 스테이지 ▶</span><i class="rbar"></i></button></div>
        <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`
    : `<div class="rp">
        <div class="rsub">${ch}장 ${esc(chapterName(f.idx))} · Stage ${st}/10</div>
        <div class="rtitle">도전 실패</div>
        <div class="rmeta"><span>시간 초과 <b>${Math.round((f.limitMs || 0) / 1000)}초</b></span><span>두목 남은 체력 <b>${f.bossLeft}%</b></span>${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
        <div class="rtip">전투력을 올려 보세요 — 장비 뽑기 · 무공 강화 · 동료${g.stage().auto ? '<br>자동 도전은 더 강해지면(레벨업 · 전투력 +5%) 다시 해요 — 그동안은 이 칸에서 사냥' : ''}</div>
        <div class="racts"><button class="btn" id="rgrow">강해지기</button><button class="btn" id="ragain">다시 도전</button><button class="btn primary rgo" id="rout"><span>사냥 계속</span><i class="rbar"></i></button></div>
        <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`;
  // 보상 숫자가 0에서 차오른다
  const t0 = now();
  for (const b of R.querySelectorAll('.rt b')) { const n = +b.dataset.n, d = parseFloat(b.parentNode.style.getPropertyValue('--d')) * 1000; const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - d) / 500)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick(); }
  const arm = (on) => { resTimer = on ? now() + RES_MS : 0; R.classList.toggle('timed', on); const bar = R.querySelector('.rbar'); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; } };
  arm(auto);
  $('rautochk').onchange = (e) => { opt.autoNext = e.target.checked; saveOpt(); arm(opt.autoNext); };
  $('rout').onclick = () => { play('click'); closeResult(); };
  if (!win) {
    $('ragain').onclick = () => { play('click'); closeResult(); g.stage().kills = STAGE_KILLS; g.challenge(); };
    $('rgrow').onclick = () => { play('click'); closeResult(); openWin('char', 0); };
  }
  addLog(win ? `${ch}장 ${st}칸 클리어 · ${sec}초` : `${ch}장 ${st}칸 두목에게 졌어요(${f.bossLeft}% 남음)`);
}
// v534 전투력 오름 — 0.5초 안에 바뀐 만큼 모아 「전투력 ▲ +N」 · 위 전투력 숫자가 번쩍(내려가면 붉게)
let pwLast = 0, pwAcc = 0, pwAt = 0, pwStart = 0;
function pwWatch(pw) {
  const t = now();
  if (!pwLast) { pwLast = pw; return; }
  if (pw !== pwLast) { if (!pwAcc) pwStart = pwLast; pwAcc += pw - pwLast; pwAt = t; pwLast = pw; }
  if (pwAcc && t - pwAt > 450 && pwStart && Math.abs(pwAcc) / pwStart < 0.01) pwAcc = 0;   // 1% 안 되는 오르내림(레벨업 등)은 조용히
  if (pwAcc && t - pwAt > 450) {
    const up = pwAcc > 0, d = document.createElement('div'); d.className = `pwpop ${up ? 'up' : 'dn'}`;
    const pct = pwStart ? Math.abs(pwAcc) / pwStart : 0;
    d.innerHTML = `<small>전투력</small><b>${up ? '▲' : '▼'} ${unit(Math.abs(pwAcc))}</b>${pct >= 0.002 ? `<em>${up ? '+' : '-'}${(pct * 100).toFixed(pct >= 0.1 ? 0 : 1)}%</em>` : ''}`;
    for (const o of document.querySelectorAll('.pwpop')) o.remove();
    document.body.append(d); setTimeout(() => d.remove(), 1800);
    const el = $('pw'); el.classList.remove('pwup', 'pwdn'); void el.offsetWidth; el.classList.add(up ? 'pwup' : 'pwdn');
    if (up && pct >= 0.03) play('coin');
    pwAcc = 0;
  }
}
// v539 대결 화면 — 대결은 능력치로 공정하게 정해지고(엔진) 화면은 그 기록을 그대로 다시 보여 준다.
//   내 무인(왼쪽) · 상대(오른쪽)가 마주 서서 기록대로 친다 · 위에 두 체력 막대 · 피해 숫자 · 3·2·1 대결! → WIN / LOSE · 누르면 건너뛰기
function duelShow(r) {
  for (const o of document.querySelectorAll('.duel')) o.remove();
  const ov = document.createElement('div'); ov.className = 'duel';
  ov.innerHTML = `<canvas></canvas><div class="dl-top"><div class="dl-side me"><b>${esc(JOBS[g.S.hero.job].name)} · 나</b><div class="dl-bar"><i></i></div><small></small></div><div class="dl-vs">VS</div><div class="dl-side op"><b>${esc(r.opp.name)} · ${esc(JOBS[r.opp.job]?.name || '')} Lv ${r.opp.lv}</b><div class="dl-bar"><i></i></div><small></small></div></div><div class="dl-mid"></div><div class="dl-skip">누르면 건너뛰기</div>`;
  $('battle').append(ov);
  const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), mid = ov.querySelector('.dl-mid');
  const bars = ov.querySelectorAll('.dl-bar i'), txt = ov.querySelectorAll('.dl-side small');
  const speed = Math.max(1, r.ms / 9000), lead = 1800, t0 = now();
  const hp = [r.myHp, r.opp.hp], left = [r.myHp, r.opp.hp], floats = [], atk = [0, 0];
  const opEq = Object.fromEntries(['weapon', 'hat', 'top', 'bottom', 'glove', 'shoes', 'cape', 'belt', 'neck', 'ring'].map((sl) => [sl, { slot: sl, g: Math.min(6, Math.floor(r.opp.lv / 25)), up: 0, subs: [] }]));
  let i = 0, done = false, endAt = 0;
  const say = (h, cls) => { mid.className = `dl-mid ${cls || ''}`; mid.innerHTML = h; };
  say('<b>3</b>'); play('tense');
  setTimeout(() => !done && say('<b>2</b>'), 600); setTimeout(() => !done && say('<b>1</b>'), 1200); setTimeout(() => { if (!done) { say('<b>대결!</b>', 'go'); play('boss'); } }, 1700); setTimeout(() => { if (!done) say(''); }, 2300);
  const finish = () => {
    if (done) return; done = true;
    while (i < r.log.length) { const e = r.log[i++]; left[e[1]] -= e[2]; }
    endAt = now(); say(`<b>${r.win ? 'WIN' : 'LOSE'}</b><span>점수 ${r.d >= 0 ? '+' : ''}${r.d} → ${r.score} · ${esc(r.tier)}</span><em>누르면 닫기</em>`, r.win ? 'win' : 'lose');
    play(r.win ? 'clear' : 'fail'); if (r.win) buzz(80);
    addLog(`대결 ${r.win ? '승리' : '패배'} — ${r.opp.name} · 점수 ${r.d >= 0 ? '+' : ''}${r.d}`);
  };
  ov.onclick = () => { if (!done) finish(); else { ov.remove(); paintHud(); } };
  const tick = () => {
    if (!ov.isConnected) return;
    const W = ov.clientWidth, H = ov.clientHeight; if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; }
    cx.setTransform(2, 0, 0, 2, 0, 0); cx.clearRect(0, 0, W, H);
    const tt = (now() - t0 - lead) * speed;
    while (!done && i < r.log.length && r.log[i][0] <= tt) {
      const e = r.log[i++], who = e[1];   // who = 맞는 쪽(0 나 · 1 상대)
      left[who] -= e[2]; atk[1 - who] = now();
      floats.push({ who, d: e[2], crit: e[3], big: e[4], at: now() });
      play(e[4] ? 'skill' : 'hit'); if (e[3] || e[4]) shakeUntil = now() + 120;
    }
    if (!done && tt > r.ms + 300) finish();
    // 바닥 · 두 무인
    const gy = H * 0.78, k = Math.min(1.5, H / 330);
    const grd = cx.createLinearGradient(0, gy - 40, 0, H); grd.addColorStop(0, 'rgba(30,20,10,0)'); grd.addColorStop(1, 'rgba(30,20,10,.85)'); cx.fillStyle = grd; cx.fillRect(0, gy - 40, W, H);
    const pos = [W * 0.36, W * 0.64];
    for (const side of [0, 1]) {
      const a = Math.max(0, 1 - (now() - atk[side]) / 260), lunge = a > 0 ? Math.sin((1 - a) * Math.PI) : 0;
      const x = pos[side] + (side ? -1 : 1) * lunge * 26 * k, dead = done && ((side === 0 && !r.win) || (side === 1 && r.win));
      cx.save(); if (dead) { cx.globalAlpha = 0.45; }
      drawHero(cx, x, gy, side ? r.opp.job : g.S.hero.job, side ? r.opp.lv : g.S.hero.lv, { t: now() / 1000, scale: 1.25 * k, eq: side ? opEq : g.S.gear.eq, flip: side === 1, lunge: lunge * 0.8 });
      cx.restore();
    }
    // 피해 숫자
    for (let j = floats.length - 1; j >= 0; j--) {
      const f = floats[j], a = (now() - f.at) / 900; if (a > 1) { floats.splice(j, 1); continue; }
      const x = pos[f.who] + (f.who ? 1 : -1) * 6, y = gy - 120 * k - a * 40 * k;
      cx.save(); cx.globalAlpha = 1 - a * a; cx.font = `900 ${(f.big ? 22 : 16) * k * (f.crit ? 1.2 : 1)}px system-ui`; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#000';
      cx.fillStyle = f.who ? (f.crit ? '#fde047' : '#fff') : '#fca5a5'; const s2 = unit(f.d); cx.strokeText(s2, x, y); cx.fillText(s2, x, y); cx.restore();
    }
    for (const side of [0, 1]) { const rr = Math.max(0, left[side] / hp[side]); bars[side].style.width = `${rr * 100}%`; txt[side].textContent = `${unit(Math.max(0, left[side]))} / ${unit(hp[side])}`; }
    if (!done || now() - endAt < 60000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// v538 업적 달성 — 위 가운데 금빛 띠(트로피 · 이름) · 소리
function achFx(a) {
  if (!a) return;
  for (const o of document.querySelectorAll('.achpop')) o.remove();
  const d = document.createElement('div'); d.className = 'achpop';
  d.innerHTML = `<i>🏆</i><div><small>업적 달성!</small><b>${esc(a.name)}</b><span>임무 → 업적에서 받기</span></div>`;
  document.body.append(d); setTimeout(() => d.remove(), 2600); play('rare', 4);
  addLog(`업적 달성 — ${a.name}`);
}
// v534 좋은 장비 줍기 — 오른쪽에 카드가 미끄러져 들어오고, 보품(4) 이상은 무인 자리에 빛기둥 · 소리
const LOOT_COL = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
function lootFx(f) {
  const box = $('lootbox');
  const d = document.createElement('div'); d.className = `loot g${f.g}`; d.style.setProperty('--c', LOOT_COL[f.g] || '#fff');
  d.innerHTML = `<img src="${eqIcon(f.slot, { g: f.g, up: f.up, slot: f.slot })}" alt=""><div><b>${GRADES[f.g]}품${f.up ? '上' : ''} ${SLOT_NAME[f.slot]}</b><small>${f.equipped ? '획득 · 바로 낌!' : '획득 · 가방으로'}</small></div>`;
  box.prepend(d); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3100);
  if (f.g >= 4) { pillarAt = now(); pillarCol = LOOT_COL[f.g]; play('rare', f.g); buzz(60); }
  addLog(`${GRADES[f.g]}품${f.up ? '上' : ''} ${SLOT_NAME[f.slot]} 획득${f.equipped ? ' — 바로 낌' : ''}`);
}
let pillarAt = 0, pillarCol = '#e8c26a';
// v532 장 두목 등장 컷 — 그림이 밀려 들어오고 이름 · 칭호(1.8초)
function chbIntro(ch) {
  const D = CHBOSS[ch]; if (!D) return;
  for (const o of document.querySelectorAll('.chbin')) o.remove();
  const d = document.createElement('div'); d.className = 'chbin'; d.style.setProperty('--c', D.col);
  const im = chbImg(ch);
  d.innerHTML = `<div class="cb-bg"></div>${im ? `<img src="${im.src}" alt="${esc(D.name)}">` : ''}<div class="cb-t"><small>${ch}장 · 장 두목</small><b>${esc(D.name)}</b><span>${esc(D.title)}</span></div>`;
  $('battle').append(d); freezeUntil = now() + 1500; setTimeout(() => d.remove(), 2000); play('rare', 5); buzz(120);
}
function wbIntro() {
  for (const o of document.querySelectorAll('.chbin')) o.remove();
  const d = document.createElement('div'); d.className = 'chbin wb'; d.style.setProperty('--c', WBF.col);
  d.innerHTML = `<div class="cb-bg"></div><img src="art/s2/chb/wb1.webp" alt="${esc(WBF.name)}"><div class="cb-t"><small>WORLD BOSS</small><b>${esc(WBF.name)}</b><span>${esc(WBF.title)} · 90초</span></div>`;
  $('battle').append(d); freezeUntil = now() + 1500; setTimeout(() => d.remove(), 2000); play('rare', 6); buzz(160);
}
function chbBanner(big, small, kind) {
  for (const o of document.querySelectorAll('.cbban')) o.remove();
  const d = document.createElement('div'); d.className = `cbban ${kind}`; d.innerHTML = `<b>${esc(big)}</b>${small ? `<span>${esc(small)}</span>` : ''}`;
  $('battle').append(d); setTimeout(() => d.remove(), kind === 'win' ? 1600 : 1300);
}
function dgBanner(title, st) {
  for (const o of document.querySelectorAll('.dgban')) o.remove();
  const d = document.createElement('div'); d.className = 'dgban';
  d.innerHTML = `<small>DUNGEON</small><b>${esc(title)}</b><span>${st ? `${DG_GOAL[st.clear]} · ${Math.round(st.leftMs / 1000)}초` : ''}</span>`;
  $('battle').append(d); setTimeout(() => d.remove(), 2200);
}
// v531 던전 결과 — 단계 결과 창과 같은 틀(#res)
const DG_GOAL = { kills: '몰려오는 적을 정해진 수만큼', boss: '두목 처치', wipe: '모든 적 처치', survive: '쓰러지지 않고 버티기' };
function showWbResult(f) {
  const R = $('res'), auto = opt.autoNext; play('clear');
  const tile = (cls, n, label, i) => `<div class="rt" style="--d:${0.35 + i * 0.12}s"><i class="coin ${cls}"></i><b data-n="${n}">0</b><small>${label}</small></div>`;
  R.className = 'open win';
  R.innerHTML = `<div class="rp"><div class="rays"></div>
      <div class="rsub">월드보스 · ${esc(WBF.name)}</div>
      <div class="rtitle">${f.gaveUp ? '물러났어요' : 'WORLD BOSS'}</div>
      <div class="rmeta"><span>싸운 시간 <b>${(f.ms / 1000).toFixed(0)}초</b></span>${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}<span>한 번 최고 <b>${unit(f.best)}</b></span><span>이번 주 합 <b>${unit(f.total)}</b></span></div>
      <div class="rtiles">${tile('x', f.dmg, '넣은 피해', 0)}${tile('s', f.score, '보스 점수', 1)}</div>
      ${f.score >= f.best && f.score > 0 ? '<div class="rnew">오늘의 최고 기록!</div>' : ''}
      <div class="racts"><button class="btn primary rgo" id="rout"><span>사냥터로</span><i class="rbar"></i></button></div>
      <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`;
  const t0 = now();
  for (const b of R.querySelectorAll('.rt b')) { const n = +b.dataset.n, d = parseFloat(b.parentNode.style.getPropertyValue('--d')) * 1000; const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - d) / 900)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick(); }
  resTimer = auto ? now() + RES_MS + 1500 : 0; R.classList.toggle('timed', auto);
  $('rautochk').onchange = (e) => { opt.autoNext = e.target.checked; saveOpt(); resTimer = opt.autoNext ? now() + RES_MS : 0; };
  $('rout').onclick = () => { play('click'); closeResult(); };
  addLog(`월드보스 — 피해 ${unit(f.dmg)} · 점수 ${unit(f.score)}`);
}
function showDgResult(f) {
  const win = f.cleared, auto = opt.autoNext, R = $('res');
  play(win ? 'clear' : 'fail');
  const tile = (cls, n, label, i) => `<div class="rt" style="--d:${0.35 + i * 0.12}s"><i class="coin ${cls}"></i><b data-n="${n}">0</b><small>${label}</small></div>`;
  const tiles = [f.gold && tile('s', f.gold, '은자', 0), f.exp && tile('x', f.exp, '경험치', 1), f.tix && tile('t', f.tix, '뽑기권', 2), f.stones && tile('st', f.stones, '강화석', 3)].filter(Boolean).join('');
  if (f.type === 'wboss') return showWbResult(f);
  const extra = f.type === 'tower' && win ? `<div class="rnew">무한의 탑 ${f.floor}층 돌파 — 영구 보너스</div>` : f.type === 'job' && win ? `<div class="rnew">${f.n}차 전직!</div>` : '';
  R.className = `open ${win ? 'win' : 'lose'}`;
  R.innerHTML = `<div class="rp">${win ? '<div class="rays"></div>' : ''}
      <div class="rsub">${esc(f.title)}</div>
      <div class="rtitle">${win ? 'DUNGEON CLEAR' : f.gaveUp ? '나왔어요' : '던전 실패'}</div>
      <div class="rmeta"><span>걸린 시간 <b>${(f.ms / 1000).toFixed(1)}초</b></span><span>처치 <b>${f.kills}</b></span>${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
      ${win ? `${extra}<div class="rtiles">${tiles}</div>` : `<div class="rtip">${f.gaveUp ? '입장권은 이미 썼어요.' : '전투력을 올리고 다시 — 장비 강화 · 무공 · 동료'}</div>`}
      <div class="racts">${win ? '' : '<button class="btn" id="rgrow">강해지기</button>'}<button class="btn primary rgo" id="rout"><span>사냥터로</span><i class="rbar"></i></button></div>
      <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`;
  const t0 = now();
  for (const b of R.querySelectorAll('.rt b')) { const n = +b.dataset.n, d = parseFloat(b.parentNode.style.getPropertyValue('--d')) * 1000; const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - d) / 500)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick(); }
  const arm = (on) => { resTimer = on ? now() + RES_MS : 0; R.classList.toggle('timed', on); };
  arm(auto);
  $('rautochk').onchange = (e) => { opt.autoNext = e.target.checked; saveOpt(); arm(opt.autoNext); };
  $('rout').onclick = () => { play('click'); closeResult(); };
  if (!win) $('rgrow').onclick = () => { play('click'); closeResult(); openWin('char', 0); };
  addLog(`${f.title} ${win ? '클리어' : '실패'} · ${(f.ms / 1000).toFixed(0)}초`);
}
// v541 토벌 결과 — 별이 하나씩 박힌다(새로 딴 별은 번쩍) · 최고 기록 · 보상
function showRaidResult(f) {
  const win = f.win, auto = opt.autoNext, R = $('res');
  play(win ? 'clear' : 'fail');
  const NM = { 'ticket:gear': ['t', '뽑기권'], 'item:stone': ['st', '강화석'] };
  const tiles = Object.entries(f.rew).map(([k, n], i) => `<div class="rt" style="--d:${1.2 + i * 0.12}s"><i class="coin ${NM[k]?.[0] || 's'}"></i><b data-n="${n}">0</b><small>${NM[k]?.[1] || k}</small></div>`).join('');
  const stars = [0, 1, 2].map((i) => `<i class="${i < f.stars ? 'on' : ''} ${i >= f.stars - f.newStars && i < f.stars ? 'new' : ''}" style="--d:${0.3 + i * 0.25}s">★</i>`).join('');
  R.className = `open ${win ? 'win' : 'lose'}`;
  R.innerHTML = `<div class="rp">${win ? '<div class="rays"></div>' : ''}
      <div class="rsub">장 두목 토벌 · ${f.ch}장 ${esc(f.name)} · Lv ${f.lv}</div>
      <div class="rtitle">${win ? 'BOSS DEFEATED' : '토벌 실패'}</div>
      ${win ? `<div class="rdstars">${stars}</div>` : ''}
      <div class="rmeta"><span>걸린 시간 <b>${(f.ms / 1000).toFixed(1)}초</b></span>${win ? `<span>최고 <b>${(f.best / 1000).toFixed(1)}초</b>${f.best === f.ms ? ' <em class="rdnew">새 기록</em>' : ''}</span>` : `<span>두목 남은 체력 <b>${f.bossLeft}%</b></span>`}${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
      ${win ? `${f.newStars ? `<div class="rnew">새 별 ${f.newStars}개 — 별 보상</div>` : ''}<div class="rtiles">${tiles}</div>` : '<div class="rtip">토벌은 지금 칸 강함으로 나와요 — 전투력을 올리고 다시</div>'}
      <div class="racts"><button class="btn" id="rmore">토벌 목록 (${f.left}번 남음)</button><button class="btn primary rgo" id="rout"><span>사냥터로</span><i class="rbar"></i></button></div>
      <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`;
  const t0 = now();
  for (const b of R.querySelectorAll('.rt b')) { const n = +b.dataset.n, d = parseFloat(b.parentNode.style.getPropertyValue('--d')) * 1000; const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - d) / 500)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick(); }
  if (win) for (let i = 0; i < f.stars; i++) setTimeout(() => { if (R.classList.contains('open')) { play(i >= f.stars - f.newStars ? 'rare' : 'coin', 4); if (i >= f.stars - f.newStars) buzz(40); } }, 300 + i * 250 + 200);
  const arm = (on) => { resTimer = on ? now() + RES_MS + 1000 : 0; R.classList.toggle('timed', on); };
  arm(auto);
  $('rautochk').onchange = (e) => { opt.autoNext = e.target.checked; saveOpt(); arm(opt.autoNext); };
  $('rout').onclick = () => { play('click'); closeResult(); };
  $('rmore').onclick = () => { play('click'); closeResult(); openWin('dgn', 1); };
  addLog(`토벌 ${win ? `★${f.stars}` : '실패'} — ${f.name} · ${(f.ms / 1000).toFixed(0)}초`);
}
function closeResult() { resTimer = 0; $('res').className = ''; }
// 돌아왔을 때 대기열 — 방치 보상부터 하나씩
// v523 무인 고르기 — 직업마다 카드(무기 든 전신 · 이름 · 싸움 방식 · 거리 · 주 능력치). 누르면 시작
const JOB_INFO = {
  sword: ['곧은 검으로 앞의 적을 벤다', '근접 · 고르게 센 기본형'],
  spear: ['긴 창으로 멀찍이 찌르고 쓸어낸다', '근접 · 사거리 길고 여럿을 친다'],
  fist: ['맨주먹 연타로 몰아친다', '근접 · 가장 빠른 연타'],
  bow: ['멀리서 화살을 쏜다', '원거리 · 안전하게 먼저 친다'],
  mage: ['지팡이로 기운을 날린다', '원거리 · 넓은 무공'],
};
const STAT_KO = { str: '힘', agi: '민첩', ene: '기운' };
function pickJob() {
  const cards = Object.entries(JOBS).map(([k, j]) => `<button class="btn jobcard" data-job="${k}"><canvas width="160" height="200"></canvas><b>${j.name}</b><small>${JOB_INFO[k]?.[0] || ''}</small><em>${JOB_INFO[k]?.[1] || ''} · 주 능력치 ${STAT_KO[j.main] || j.main}</em></button>`).join('');
  pop('무인 고르기', `<p class="note">직업은 나중에 「설정 → 새로 시작」으로 바꿀 수 있어요. 다른 기기에서 하던 진행이 있으면 <a href="#" id="pj-g" class="pj-g">Google로 이어하기</a></p><div class="jobgrid">${cards}</div>`, []);
  const sh = $('modal').querySelector('.sheet'); sh.classList.add('wide');
  for (const b of sh.querySelectorAll('.jobcard')) b.onclick = () => { play('click'); closeModal(); sh.classList.remove('wide', 'enhs'); start(b.dataset.job); };
  const pg = sh.querySelector('#pj-g');
  if (pg) pg.onclick = async (e) => { e.preventDefault(); play('click'); try { await net.init(); if (!net.online) { toast('인터넷에 연결되면 다시 눌러 주세요'); return; } const d = await net.switchTo(null); if (d) applyCloud(d); else toast('그 계정에는 새 시즌 진행이 없어요 — 무인을 골라 시작하세요(그 계정에 저장돼요)'); } catch (err) { toast(err?.code === 'auth/popup-closed-by-user' ? '취소했어요' : (err?.message || '이어하지 못했어요')); } };
  const t0 = now();
  const paint = () => {
    if (!sh.querySelector('.jobcard')) return;
    for (const b of sh.querySelectorAll('.jobcard')) { const c = b.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, 160, 200); drawHero(x, 80, 186, b.dataset.job, 1, { t: (now() - t0) / 1000, scale: 1.55 }); }
    if (now() - t0 < 60000) requestAnimationFrame(paint);   // 그림이 늦게 오면 받는 대로 · 숨 쉬는 움직임
  };
  paint();
}
// v536 출석 — 28칸 달력. 오늘 칸이 두근거리고 「출석」을 누르면 붉은 도장이 쾅 · 보상이 날아오른다
const attendLabel = (R) => {
  if (R.gear) return `${GRADES[R.gear.g]}품${R.gear.up ? '上' : ''} 장비`;
  if (R.goldMin) return `은자 ${unit(R.goldMin * 27 * goldPerMob(g.S.hero.lv))}`;
  const k = Object.keys(R).find((x) => x.includes(':'));
  return k ? `${(ATTEND_NAME[k] || k).replace(' 뽑기권', '권')} ${R[k]}` : '';
};
const attendIcon = (R) => R.gear ? `<img src="${eqIcon(['weapon', 'top', 'neck'][R.gear.g % 3], { g: R.gear.g })}" alt="">` : R.goldMin ? '<i class="coin s"></i>' : R['item:stone'] ? '<i class="coin st"></i>' : R['ticket:time'] ? '<i class="ai">⏳</i>' : R['item:restore'] ? '<i class="ai">卷</i>' : '<i class="coin t"></i>';
function attendGrid(stampDay) {
  const A = g.attendState(), done = A.n % ATTEND_DAYS, today = g.canAttend() ? done + 1 : 0;
  let h = '<div class="attg">';
  for (let d = 1; d <= ATTEND_DAYS; d++) {
    const R = ATTEND[d], got = d <= done && d !== stampDay, isT = d === today;
    h += `<div class="att${R.big ? ' big' : ''}${got ? ' got' : ''}${isT ? ' today' : ''}" data-d="${d}"><small>${d}일</small>${attendIcon(R)}<b>${attendLabel(R)}</b>${got ? '<span class="seal">出</span>' : ''}</div>`;
  }
  return h + '</div>';
}
function attendPop() {
  if (!g || !g.canAttend()) return;
  const A = g.attendState(), day = g.attendNext(), sh = $('modal').querySelector('.sheet');
  pop('출석', `<p class="note">하루 한 번 · ${A.cycle ? `${A.cycle + 1}바퀴째 · ` : ''}오늘은 <b>${day}일째</b> — 7 · 14 · 21 · 28일은 큰 보상</p>${attendGrid()}`, [['나중에', null], ['출석', () => doAttend()]]);
  sh.classList.add('wide', 'attw');
}
function doAttend() {
  const r = g.attend(); if (!r) return;
  save(); paintHud();
  const sh = $('modal').querySelector('.sheet');
  sh.innerHTML = `<h2>출석 ${r.day}일째</h2>${attendGrid(r.day)}<div class="btn-row" style="margin-top:10px"><button class="btn primary" id="att-ok">받기 완료</button></div>`;
  sh.classList.add('wide', 'attw'); $('modal').classList.remove('hidden');
  const cell = sh.querySelector(`.att[data-d="${r.day}"]`);
  setTimeout(() => { cell.classList.add('got', 'stamp'); cell.insertAdjacentHTML('beforeend', '<span class="seal">出</span>'); play('burst'); buzz(80); shakeUntil = now() + 250; }, 250);
  setTimeout(() => { play(ATTEND[r.day].big ? 'rare' : 'coin', 5); const parts = [r.gold ? `은자 ${unit(r.gold)}` : '', ...Object.entries(r.items).map(([k, n]) => `${ATTEND_NAME[k] || k} ${n}`), r.gear ? `${GRADES[r.gear.g]}품${r.gear.up ? '上' : ''} ${SLOT_NAME[r.gear.slot]}` : '', r.title ? `칭호 「${r.title}」` : ''].filter(Boolean); toast(`출석 보상 — ${parts.join(' · ')}`); }, 700);
  $('att-ok').onclick = () => { play('click'); closeModal(); sh.classList.remove('wide', 'attw'); if (open) paintWin(); };
}
function returnQueue() {
  const p = g.returnCheck(now());
  const q = buildQueue([...(p ? [{ kind: 'offline', p }] : [])]);
  if (!q.length && g.canAttend()) setTimeout(() => attendPop(), 600);   // v536 방치 보상이 없으면 바로 출석
  for (const it of q) if (it.kind === 'offline') {
    const p2 = it.p;
    const mins = Math.floor(p2.ms / 60000), hh = Math.floor(mins / 60), mm = mins % 60;
    pop('방치 보상', `<div class="offl"><div class="offl-t"><b>${hh ? `${hh}시간 ` : ''}${mm}분</b><span>동안 무인이 홀로 사냥했어요${p2.capped ? ' · 최대 12시간까지 쌓여요' : ''}</span></div><div class="offl-bar"><i style="width:${Math.min(100, (p2.ms / (12 * 3600000)) * 100)}%"></i></div><div class="rtiles offl-r"><div class="rt"><i class="xpico">EXP</i><b>${unit(p2.exp)}</b><small>경험치</small></div><div class="rt"><i class="coin s"></i><b>${unit(p2.gold)}</b><small>은자</small></div></div><p class="note">광고를 보면 두 배(하루 정해진 횟수)</p></div>`, [['받기', () => { g.claimOffline(false); save(); if (g.canAttend()) setTimeout(() => attendPop(), 350); }], ['광고 보고 ×2', () => { const r = g.claimOffline(true); toast(r?.x === 2 ? '×2 받음' : '오늘 광고 ×2는 다 썼어요'); save(); if (g.canAttend()) setTimeout(() => attendPop(), 350); }]]);
  }
}
function boot() {
  closeModal();
  setTimeout(() => net.init(), 1500);   // v525 계정 연결은 화면이 뜬 뒤
  paintNav(); paintHud();
  returnQueue();
  last = now(); lastMin = now();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!g) return; if (document.hidden) { save(); cloudPush(true); } else { returnQueue(); last = now(); } });
window.addEventListener('pagehide', () => g && save());
// 컴퓨터: ← → 움직이기 · Space/↑ 점프 · ↓ 내려가기 · Shift/E 회피 · Q 무공 · Del 자동
const keyDir = { ArrowLeft: -1, ArrowRight: 1 };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('modal').classList.contains('hidden')) closeModal(); else closeWin(); return; }
  if (!g || open) return;
  if (keyDir[e.key] && !e.repeat) g.hold(keyDir[e.key]);
  else if ((e.key === ' ' || e.key === 'ArrowUp') && !e.repeat) { e.preventDefault(); g.jump(); }
  else if (e.key === 'ArrowDown' && !e.repeat) g.down();
  else if ((e.key === 'Shift' || e.key === 'e' || e.key === 'E') && !e.repeat) g.dash();   // v546 회피
  else if (e.key === 'q' || e.key === 'Q') g.ensureFight().press('skill');
  else if (e.key === 'Delete') { g.setAuto(g.S.auto === false); paintHud(); }
});
document.addEventListener('pointerdown', () => { unlock(); bgm(chapterOf(g?.zoneLv?.() || 1)); }, { once: false, passive: true });
document.addEventListener('keyup', (e) => { if (g && keyDir[e.key]) g.hold(0); });

// v514 가로 전용 — 늘 가로 배치(body.land). 손전화를 세로로 들면 body를 90° 돌려 가로로 보이게(세로 배치는 없앴다)
function fitLand() {
  const W = innerWidth, H = innerHeight, rot = H > W && matchMedia('(pointer: coarse)').matches, B = document.body;
  B.classList.add('land');
  B.classList.toggle('rot', rot); document.documentElement.classList.toggle('rot', rot);
  B.style.width = rot ? `${H}px` : ''; B.style.height = rot ? `${W}px` : '';
  // 돌린 뒤의 실제 가로 · 세로로 크기 반(media query는 기기 기준이라 돌린 화면에서 뒤바뀐다)
  const ew = rot ? H : W, eh = rot ? W : H, D = document.documentElement.classList;
  D.toggle('w800', ew <= 800); D.toggle('w720', ew <= 720); D.toggle('w640up', ew >= 640); D.toggle('h500', eh <= 500); D.toggle('h420', eh <= 420);
}
addEventListener('resize', fitLand); addEventListener('orientationchange', () => setTimeout(fitLand, 120));
fitLand();
// v519 전체 화면 — 손전화는 첫 터치에 저절로(주소창이 사라져 가로 화면이 더 넓다) · 가로 잠금은 전체 화면이어야 되는 브라우저가 많다
function goFull(on) {
  try {
    if (!on) { document.exitFullscreen?.(); return; }
    const p = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    (p || Promise.resolve()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch { /* 안 되는 브라우저 */ }
}
document.addEventListener('pointerdown', () => { if (matchMedia('(pointer: coarse)').matches && !matchMedia('(display-mode: standalone)').matches) goFull(true); }, { once: true });
// v524 첫 화면이 되었으니 서비스워커(새 판 받기 · 오프라인)
try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* 없음 */ }
loadLooks();
load();
if (g) boot();
else pickJob();
// 시험용 손잡이
window.__s2 = { get g() { return g; }, save, dayKey, attendPop, freeze: () => { frozen = true; }, net, cloudPush,
  // v525 팝업 대신 에뮬레이터용 가짜 Google 토큰으로 잇기 · 겹치면 그 계정으로
  linkTest: async (tok) => { const r = await net.linkGoogle(tok); if (r.conflict) { const d = await net.switchTo(r.cred); if (d) applyCloud(d); return 'switched'; } await cloudPush(true); return 'linked'; } };
