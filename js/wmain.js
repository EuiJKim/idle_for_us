// 바람식 개편 — 시작점. 설계: docs/바람식_개편.md
//
// 옛 main.js(관문·수련·무공 여덟 …)를 대신한다. 들판 그림(BattleView)·초식 연출·창틀·서버는 그대로 쓴다.
import * as RM from './rendermode.js';   // 맨 먼저 — 캔버스를 만들기 전에 그리기 방식을 정한다 (v188)
import { WorldGame, newWorldSave } from './world/wgame.js';
import { encodeSave, decodeSave } from './savecode.js';   // v324 화면 크기 — 컴퓨터(넓은 화면)에서는 세로 높이에 맞춰 키우고(폰 크기 설계 그대로 확대), 설정의 '글자·화면 크기'를 곱한다
const UI_SCALE = { normal: 1, big: 1.12, huge: 1.25 };
const UI_SCALE_NAME = { normal: '보통', big: '크게', huge: '아주 크게' };
function uiScalePref() { try { return localStorage.getItem('ifu.uiScale') || 'normal'; } catch { return 'normal'; } }
function applyUiScale() {
  const root = document.documentElement;
  root.style.zoom = '';   // 먼저 되돌려야 창 크기를 제대로 잰다
  const w = window.innerWidth, hgt = window.innerHeight;
  // 폰 설계(390×844)를 창에 맞춰 키운다 — 창이 넓고 높을수록 크게(2.2배까지). 폰(600px 미만)은 그대로
  // v325 컴퓨터에서 여전히 작았다 — 높이 620을 기준으로(1440×900 → 1.45배 · 1920×1080 → 1.74배)
  const auto = w >= 600 ? Math.max(1, Math.min(2.4, Math.min(w / 560, hgt / 620))) : 1;
  const k = +(auto * (UI_SCALE[uiScalePref()] || 1)).toFixed(3);
  if (k !== 1) root.style.zoom = String(k);
  // v326 zoom을 걸면 vh·vw는 화면 크기에 zoom을 한 번 더 곱해 커진다(창이 화면 밖으로 넘쳤다) — css는 var(--vh)를 쓰고 여기서 바로잡는다
  if (k !== 1) { root.style.setProperty('--vh', `${(hgt / k / 100).toFixed(3)}px`); root.style.setProperty('--vw', `${(w / k / 100).toFixed(3)}px`); }
  else { root.style.removeProperty('--vh'); root.style.removeProperty('--vw'); }
  setTimeout(() => { view.resize?.(); measurePads?.(); hudGoldAt?.(); }, 30);
  return k;
}
window.addEventListener('resize', () => setTimeout(applyUiScale, 60));
window.__uiScale = applyUiScale;
// v321 얻은 것 모음 — 방치 중 두목·조각·자동 정리를 알림 하나하나 대신 '이름 ×수'로 쌓는다
// v324 사라지지 않고 계속 쌓인다(×168 → ×336 …) — 사냥터를 옮기거나 누르면 비운다(요청: 방치 동안 얼마나 모였는지)
const tallyBox = { items: new Map(), at: 0, el: null, map: null };
function tally(key, label, n = 1, col = '#e5e7eb') {
  if (!(n > 0)) return;
  const it = tallyBox.items.get(key) || { label, n: 0, col };
  it.n += n; it.label = label;
  tallyBox.items.set(key, it);
  tallyBox.at = performance.now();
  paintTally(key);
}
function paintTally(bump) {
  const el = tallyBox.el || (tallyBox.el = $('loot-tally'));
  if (!el) return;
  el.classList.remove('hidden', 'fade');
  el.replaceChildren(...[...tallyBox.items.entries()].slice(-7).map(([k, x]) => h('span', { class: `lt${k === bump ? ' bump' : ''}`, style: `--lc:${x.col}` }, x.label, h('b', {}, ` ×${fmt(x.n)}`))));
}
function tallyClear() { tallyBox.items.clear(); tallyBox.el?.classList.add('hidden'); }
function tallyTick() {
  // 다른 사냥터로 가거나 마을·던전이면 새로 센다
  const key = game.map?.town || game.inst ? null : game.s.map;
  if (key !== tallyBox.map) { tallyBox.map = key; if (tallyBox.items.size) tallyClear(); }
}
// v321 운영자 신고함
async function openReports() {
  const list = h('div', { class: 'report-list' }, h('p', { class: 'muted' }, '불러오는 중…'));
  openModal((s) => s.append(h('h2', {}, '신고함'), list, h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px', onclick: closeModal }, '닫기')));
  const paint = async () => {
    let rows = [];
    try { rows = await net.reports(); } catch (err) { list.replaceChildren(h('p', { class: 'muted' }, `불러오지 못했어요 — ${err?.code || err?.message || ''}`)); return; }
    // 같은 말을 여럿이 신고했으면 하나로(몇 명이 했는지)
    const by = new Map();
    for (const r of rows) { const k = r.mid || r.id; const o = by.get(k) || { ...r, ids: [], n: 0 }; o.ids.push(r.id); o.n++; by.set(k, o); }
    const items = [...by.values()];
    if (!items.length) { list.replaceChildren(h('p', { class: 'muted' }, '신고가 없어요 👍')); return; }
    const done = async (r, fn, msg) => { try { await fn(); for (const id of r.ids) await net.dropReport(id); toast(msg); } catch (err) { toast(err?.message || '하지 못했어요'); } paint(); };
    list.replaceChildren(...items.map((r) => h('div', { class: 'report-row' },
      h('div', {}, h('b', {}, r.name || '무명'), h('small', { class: 'muted' }, ` · 신고 ${r.n}명 · ${r.at?.toDate ? r.at.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}`)),
      h('p', { class: 'report-text' }, r.text || '(빈 말)'),
      h('div', { class: 'btn-row' },
        ...[['1시간', 3600e3], ['1일', 86400e3], ['영구', Infinity]].map(([t, ms]) => h('button', { class: 'btn', style: 'padding:4px 8px', onclick: () => done(r, () => net.mute(r.uid, r.name, ms, r.text), `${r.name} — ${t} 입막음`) }, t)),
        h('button', { class: 'btn danger', style: 'padding:4px 8px', onclick: () => done(r, () => (r.mid ? net.deleteWorld(r.mid) : Promise.resolve()), '말을 지웠어요') }, '말 지우기'),
        h('button', { class: 'btn', style: 'padding:4px 8px', onclick: () => done(r, () => Promise.resolve(), '넘겼어요') }, '넘기기')))));
  };
  paint();
}
// v320 저장 코드
import * as W from './world/wdata.js';
import { BUILD, RANKS, JOBS, jobOf } from './data.js';
import { BattleView, drawFighter } from './battle.js';
import { loadIcons, skinImg } from './icons.js';
import { WNet } from './wnet.js';
import { RULES_VER } from './net.js';
import { Coop } from './world/wcoop.js';
import { h, toast, openModal, closeModal, modalOpen } from './ui/common.js';
import { WTABS, WTAB_TITLE, itemTitle, skillText, rangeText, rewardText, dailyWaiting, skipFx, setSkipFx, openSkillPreview, attGrid } from './wui.js';
import * as D from './world/wdgn.js';
import * as IM from './world/wimprint.js';
import { QUEST_COUNT } from './world/wquest.js';
import { fmt, duration } from './fmt.js';
import { sfx, unlockAudio, setSound, soundOn } from './sfx.js';
import * as AM from './appmode.js';
import { bootStart, bootProgress, bootHide, waitFor, showLogin, loginPref, setLoginPref, standalone, inAppBrowser } from './boot.js';
import { artReady } from './art.js';
import * as CH from './chars.js';   // v328 캐릭터 칸(넷까지) · 체험 모드
loadIcons();
for (const b of document.querySelectorAll('#tabs button[data-tab]')) skinImg(b.querySelector('i'), `tab-${b.dataset.tab}`);

// 소리 — 이 기기에만 남긴다. 휴대폰은 화면을 한 번 눌러야 소리가 난다.
try { setSound(localStorage.getItem('ifu.sound') !== '0'); } catch { /* 사생활 모드 */ }
window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });

bootStart(BUILD);   // v266 로딩 화면을 넘겨받는다(모듈이 다 왔다)
bootProgress(0.35, '강호 지도를 펼치는 중…');
const OLD_SAVE_KEY = 'idleForUs.save.v1';
const $ = (id) => document.getElementById(id);

// v257 세이브 안전망 — 본 세이브가 깨졌으면(JSON 실패) 백업 둘에서 되살리고, 되살릴 게 없으면 깨진 원본을 따로 보관한다.
// 전엔 깨지면 새 캐릭터로 시작해 5초 뒤 깨진 원본까지 덮어써 영영 잃었다.
const BAK_KEYS = [`${W.SAVE_KEY}.bak1`, `${W.SAVE_KEY}.bak2`];
let saveNote = null;
function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(W.SAVE_KEY); } catch { return null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* 깨졌다 — 아래에서 백업을 본다 */ }
  for (const k of BAK_KEYS) {
    try { const b = localStorage.getItem(k); if (b) { const o = JSON.parse(b); saveNote = '세이브가 망가져 있어 백업에서 되살렸어요(조금 전 상태)'; return o; } } catch { /* 다음 백업 */ }
  }
  try { localStorage.setItem(`${W.SAVE_KEY}.broken`, raw); } catch { /* 자리가 없다 */ }
  saveNote = '세이브가 망가져 새로 시작했어요 — 망가진 세이브는 따로 보관해 두었어요';
  return null;
}
// v328 체험 모드 — 이번 탭만, 다 키운 무인으로 맛보기(저장·서버 없음)
const TRIAL_JOB = CH.trialJob();
const saved = TRIAL_JOB ? null : loadSave();
const bootSeen = Number(saved?.lastSeen) || 0;   // v265 이 기기에서 마지막으로 저장한 때(서버 진행과 견줄 때 보여 준다)
const game = new WorldGame(saved || newWorldSave());
if (TRIAL_JOB) setupTrial(game, TRIAL_JOB);
function setupTrial(g, job) {
  if (!W.CLASSES[job]) job = Object.keys(W.CLASSES)[0];
  const L = 80;
  g.s.nickname = '체험 무인';
  g.setJob(job);
  g.s.level = L;
  g.s.statPts = (L - 1) * W.STAT_PER_LEVEL;
  g.s.autoStat = true;
  g.autoStats();
  g.s.jobTier = 3;
  g.s.gold = 3e6;
  g.s.potions = 300;
  for (const k of Object.keys(g.s.skillLv)) g.s.skillLv[k] = 10;
  g.s.quest = QUEST_COUNT;   // 길잡이는 건너뛴다(창이 다 열린다)
  g.syncGrow();
  g.gainMount('warhorse');
  g.s.huntMap = g.fitMap();
  g._stats = null;
  g.heroHp = g.stats().hp;
}
// 옛 판에서 온 사람 — 칭호와 시작 은자 (한 번만)
if (!saved && !TRIAL_JOB) {
  let old = null;
  try { old = localStorage.getItem(OLD_SAVE_KEY); } catch { /* 사생활 모드 */ }
  if (old) {
    game.s.titles.push('개국공신');
    game.s.gold += 2000;
    try { const o = JSON.parse(old); if (o?.nickname) game.s.nickname = o.nickname; } catch { /* 망가진 옛 세이브 */ }
    game.s.legacyNote = true;
  }
}

const view = new BattleView($('cv'));
view.onGoldHit = () => goldPulse();
addEventListener('resize', () => setTimeout(hudGoldAt, 50));
setTimeout(hudGoldAt, 300);
setInterval(hudGoldAt, 3000);
if (RM.useCpu) view.setSoftware(true);
// 들판 가운데 지도가 놓일 자리 — 위는 전투력 알약, 아래는 창 버튼 줄과 무공 바를 뺀다
function measurePads() {
  const cv = $('cv').getBoundingClientRect();
  const t = document.querySelector('#tabs .tabcol')?.getBoundingClientRect();
  view.padTop = 30;
  view.padBottom = t && t.height ? Math.max(60, cv.bottom - t.top + 6) : 130;
}
measurePads();
window.addEventListener('resize', measurePads);
const FX_PREF = ['low', 'mid', 'high'];
const FX_NAME = { high: '높음', mid: '보통', low: '낮음' };
function loadFxPref() { try { return localStorage.getItem('ifu.fx') || 'high'; } catch { return 'high'; } }
view.fxPref = Math.max(0, FX_PREF.indexOf(loadFxPref()));
try { view.showRange = localStorage.getItem('ifu.range') === '1'; } catch { /* 사생활 모드 */ }
try { const sp = Number(localStorage.getItem('ifu.shake')); if ([0, 0.5, 1].includes(sp) && localStorage.getItem('ifu.shake') !== null) view.shakePref = sp; } catch { /* 사생활 모드 */ }

// 화면 거리 — 전체(지도 한 장) · 보통(가로 꽉) · 가까이. 눌러서 돌리고, 마우스 휠로도 당기고 민다.
const CAM_NAME = ['전체', '보통', '가까이'];
function loadCam() { try { const v = Number(localStorage.getItem('ifu.cam')); return Number.isInteger(v) && v >= 0 && v <= 2 && localStorage.getItem('ifu.cam') != null ? v : 1; } catch { return 1; } }
function setCam(v) {
  view.camLevel = Math.max(0, Math.min(2, v));
  $('btn-zoom').textContent = CAM_NAME[view.camLevel];
  try { localStorage.setItem('ifu.cam', String(view.camLevel)); } catch { /* 사생활 모드 */ }
}
setCam(loadCam());
$('btn-zoom').addEventListener('click', () => { setCam((view.camLevel + 1) % 3); game.mark('zoom'); });
$('cv').addEventListener('wheel', (e) => { e.preventDefault(); setCam(view.camLevel + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });

const app = { game, net: null, refresh: () => refreshUI(true), save: () => save(), closePanel: () => closePanel(), showTab: (t, sub) => showTab(t, sub) };
const net = new WNet(game, { onChange: (w) => netChanged(w) });
app.net = net;
// 십이지왕 함께 사냥 (v138) — 문파원끼리 같은 왕 구역에 서면 왕 체력을 나눈다
const coop = new Coop(game, net, {
  look: () => {
    const { look, opts } = view.heroLook(game, false);
    return { look, opts: { weapon: opts.weapon, blade: opts.blade, glow: opts.glow, bladeCol: opts.bladeCol, bladeFx: opts.bladeFx, hold: true } };
  },
  onEvent: (kind, e) => {
    if (kind === 'join') toast('🤝 함께 사냥 — 이 왕은 같은 구역의 문파원과 체력을 나눠요. 조금이라도 치면 처치 보상을 받아요');
    else if (kind === 'peerIn') toast(`🤝 ${e.name}님이 같은 왕 구역에 왔어요`);
    else if (kind === 'peerOut') toast(`${e.name}님이 왕 구역을 떠났어요`);
    else if (kind === 'kill') toast(`👑 ${e.name} 처치! ${e.n > 1 ? `${e.n}명이 함께 · 내 몫 ${Math.round(e.share * 100)}%` : '혼자서'}${e.me ? ' — 마무리 일격' : ` — ${e.killer}님 마무리`}`);
    else if (kind === 'missed') toast(`${e.killer}님 일행이 ${e.name}을(를) 쓰러뜨렸어요 — 이번 왕은 안 쳐서 보상이 없어요`);
  },
});
game.coop = coop;
app.coop = coop;
// 왕 구역 안에서 혼자 ↔ 함께 (v145)
$('btn-party').addEventListener('click', () => {
  if (!coop.can()) return toast('문파에 들어 있고 온라인일 때 함께 사냥할 수 있어요');
  game.s.kingParty = !game.s.kingParty;
  save();
  toast(game.s.kingParty ? '🤝 문파원과 함께로 바꿨어요 — 혼자 잡던 왕은 거두고 문파원 방의 왕을 따라요' : '⚔ 혼자로 바꿨어요 — 지금 왕은 남은 체력 그대로 혼자 잡아요');
});
net.coopForget = (gid) => coop.forget(gid);
window.__coop = coop;

let stopSaving = !!TRIAL_JOB;   // 체험 모드는 저장하지 않는다
let lastBak = 0;
let saveFailNoted = false;
function save() {
  if (stopSaving) return;
  if (!tabOwner()) return;   // v257 다른 창이 이어 하고 있으면 이 창은 저장하지 않는다
  game.s.lastSeen = Date.now();
  game.s.clockMax = Math.max(game.s.clockMax || 0, game.s.lastSeen);   // v254 시계 되돌리기 막기
  try {
    const json = JSON.stringify(game.toJSON());
    localStorage.setItem(W.SAVE_KEY, json);
    // v257 10분마다 백업을 한 칸씩 민다(bak1 → bak2)
    if (Date.now() - lastBak > 10 * 60 * 1000) {
      lastBak = Date.now();
      try { const b1 = localStorage.getItem(BAK_KEYS[0]); if (b1) localStorage.setItem(BAK_KEYS[1], b1); localStorage.setItem(BAK_KEYS[0], json); } catch { /* 백업 자리가 없으면 본 세이브만 */ }
    }
    saveFailNoted = false;
  } catch (err) {
    console.warn('save failed', err);
    // v257 저장이 안 되면 한 번 알린다(전엔 조용히 저장이 멈췄다)
    if (!saveFailNoted) { saveFailNoted = true; toast('⚠ 저장하지 못했어요 — 기기 저장 공간을 확인해 주세요'); }
  }
}
// v257 여러 창 — 같은 세이브를 두 창이 5초마다 덮어써 진행이 되돌아갔다. 마지막으로 연 창이 주인이 되고,
// 주인이 아닌 창은 저장을 멈추고 알린다(다시 불러오면 그 창이 주인).
const TAB_ID = Math.random().toString(36).slice(2);
const TAB_KEY = 'ifu.tabOwner';
let tabLost = false;
function claimTab() { try { localStorage.setItem(TAB_KEY, JSON.stringify({ id: TAB_ID, t: Date.now() })); } catch { /* 사생활 모드 */ } }
function tabOwner() {
  if (tabLost) return false;
  let o = null;
  try { o = JSON.parse(localStorage.getItem(TAB_KEY) || 'null'); } catch { /* 망가진 값 */ }
  if (o && o.id !== TAB_ID) { tabLost = true; showTabLost(); return false; }
  claimTab();
  return true;
}
function showTabLost() {
  stopSaving = true;
  openModal((s) => {
    s.append(h('h2', {}, '다른 창에서 이어 하고 있어요'),
      h('p', { class: 'muted' }, '같은 캐릭터를 두 창에서 하면 서로 덮어써 진행이 사라질 수 있어 이 창은 멈췄어요.'),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: () => { CH.setSkip(); location.reload(); } }, '이 창에서 이어 하기'));
  }, { dismissable: false });
}
claimTab();
window.addEventListener('storage', (e) => { if (e.key === TAB_KEY && e.newValue && !tabLost) { try { if (JSON.parse(e.newValue).id !== TAB_ID) { tabLost = true; showTabLost(); } } catch { /* */ } } });
if (saveNote) setTimeout(() => toast(saveNote), 1800);

// ---------- Google 계정 · 서버 저장 (v265) ----------
// Google을 이은 계정만 서버(saves/{uid})에 세이브를 올린다 — 3분마다, 그리고 화면을 떠날 때.
// 올리기 전에 한 번 서버 것과 맞춰 본다: 이 기기가 마지막으로 맞춘 뒤에 '다른 기기'가 올렸으면 어느 쪽으로 할지 묻는다.
// (안 물으면 오래된 기기가 켜지자마자 다른 기기의 새 진행을 덮는다)
const DEV_ID = (() => {
  try {
    let d = localStorage.getItem('ifu.dev');
    if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('ifu.dev', d); }
    return d;
  } catch { return 'nodev'; }
})();
const CLOUD_EVERY = 3 * 60 * 1000;
let cloudOk = false;        // 서버 것과 맞춰 봤다 — 그 뒤로만 올린다
let booting = true;          // v266 로딩·로그인 화면이 떠 있는 동안 — 창(방치 보상·서버 진행 고르기)은 그 뒤에 띄운다
let cloudChecking = false;
let cloudBusy = false;
let cloudLast = 0;
const cloudAtKey = () => `ifu.cloudAt.${net.uid}`;
function cloudSyncedAt() { try { return Number(localStorage.getItem(cloudAtKey())) || 0; } catch { return 0; } }
function setCloudSyncedAt(t) { try { localStorage.setItem(cloudAtKey(), String(t)); } catch { /* 사생활 모드 */ } }
async function cloudPush(force) {
  if (!cloudOk || stopSaving || tabLost || cloudBusy || !net.isGoogle?.() || !net.ready?.()) return false;
  if (!force && Date.now() - cloudLast < CLOUD_EVERY) return false;
  cloudBusy = true;
  cloudLast = Date.now();
  try {
    const at = await net.pushSave(JSON.stringify(game.toJSON()), DEV_ID, BUILD, CH.readIndex().act);
    if (at) setCloudSyncedAt(at);
    return !!at;
  } catch (err) {
    console.warn('[cloud] push', err?.code || err);
    return false;
  } finally { cloudBusy = false; }
}
async function cloudCheck() {
  if (cloudOk || cloudChecking || !net.isGoogle?.() || !net.ready?.()) return;
  cloudChecking = true;
  try {
    const c = await net.fetchSave();
    // v328 서버의 '지금 캐릭터'가 이 기기에서 하는 캐릭터와 다른 칸이면 다툼이 아니다 — 그 칸으로 받아 두고(서버 칸에도 올려 둔 뒤) 이 캐릭터를 올린다
    const cs = Number.isInteger(c?.slot) ? c.slot : 0;
    if (c?.data && c.dev !== DEV_ID && cs !== CH.readIndex().act) {
      CH.storeSlot(cs, c.data);
      try { await net.pushChar(cs, c.data); } catch (err) { console.warn('[cloud] keep char', err?.code || err); }
      cloudOk = true;
      cloudPush(true);
      return;
    }
    if (c?.data && c.dev !== DEV_ID && (Number(c.at) || 0) > cloudSyncedAt()) { askCloud(c); return; }
    cloudOk = true;
    cloudPush(true);
  } catch (err) {
    console.warn('[cloud] check', err?.code || err);
  } finally { cloudChecking = false; }
}
const whenStr = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
function cloudLv(c) { try { return Number(JSON.parse(c.data).level) || c.lv || 0; } catch { return c.lv || 0; } }
// 서버 진행을 이 기기로 — 지금 진행은 .beforeCloud에 남기고 새로 연다
function loadCloud(c) {
  try { JSON.parse(c.data); } catch { toast('서버 세이브가 망가져 있어 불러오지 않았어요'); return false; }
  try {
    localStorage.setItem(`${W.SAVE_KEY}.beforeCloud`, JSON.stringify(game.toJSON()));
    if (Number.isInteger(c.slot)) CH.adoptSlot(c.slot, game.s.nickname ? JSON.stringify(game.toJSON()) : null);   // v328 다른 칸이면 지금 캐릭터는 제 칸에
    localStorage.setItem(W.SAVE_KEY, c.data);
    CH.setSkip();
    setCloudSyncedAt(Number(c.at) || Date.now());
  } catch { toast('⚠ 기기 저장 공간이 모자라 불러오지 못했어요'); return false; }
  stopSaving = true;
  location.reload();
  return true;
}
function askCloud(c) {
  // 다른 창(방치 보상·이름 짓기)이 떠 있으면 닫힌 뒤에 묻는다 — 덮으면 그 창이 날아간다
  if (modalOpen() || booting) { setTimeout(() => askCloud(c), 1000); return; }
  const newer = (Number(c.at) || 0) > (game.s.lastSeen || bootSeen);
  openModal((m) => {
    m.append(h('h2', {}, '다른 기기의 진행이 있어요'),
      h('p', { class: 'muted' }, `${net.googleEmail() || 'Google 계정'}에 다른 기기에서 올린 진행이 있어요. 어느 쪽으로 이어 할까요?`),
      h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, `서버 · Lv ${cloudLv(c)}`), h('div', { class: 'desc' }, `${whenStr(c.at)}에 저장${newer ? ' · 더 최근' : ''}`))),
      h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, `이 기기 · Lv ${game.s.level}`), h('div', { class: 'desc' }, `${whenStr(bootSeen)}에 저장${newer ? '' : ' · 더 최근'}`))),
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { class: `btn${newer ? ' primary' : ''}`, onclick: () => { closeModal(); loadCloud(c); } }, '서버 진행 불러오기'),
        h('button', { class: `btn${newer ? '' : ' primary'}`, onclick: () => {
          if (!confirm('서버에 있는 다른 기기의 진행을 이 기기 진행으로 덮어써요. 그 진행은 사라져요. 계속할까요?')) return;
          closeModal();
          cloudOk = true;
          cloudPush(true).then((ok) => toast(ok ? '이 기기 진행을 서버에 올렸어요' : '서버에 올리지 못했어요 — 잠시 뒤 다시 올려요'));
        } }, '이 기기 진행으로 계속')));
  }, { dismissable: false });
}
function googleErr(err) {
  const c = err?.code || '';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' || c === 'auth/user-cancelled') return '로그인을 그만뒀어요';
  if (c === 'auth/popup-blocked') return '팝업이 막혔어요 — 이 사이트의 팝업을 허용하고 다시 눌러 주세요';
  if (c === 'auth/operation-not-allowed') return 'Firebase에서 Google 로그인이 아직 꺼져 있어요(운영자 설정)';
  if (c === 'auth/unauthorized-domain') return '이 주소가 Firebase 승인 도메인에 없어요(운영자 설정)';
  if (c === 'net/offline') return '서버에 연결되지 않았어요 — 인터넷을 확인해 주세요';
  if (c === 'auth/network-request-failed') return 'Google 로그인 창과 연결하지 못했어요';
  if (c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported') return '이 화면에선 Google 창을 못 열어요';
  if (c === 'auth/internal-error') return 'Google 로그인 중에 오류가 났어요';
  return '로그인하지 못했어요';
}
// 왜 그런지·어떻게 하는지 — 로그인 화면에 함께 보인다
function googleHelp(err) {
  const c = err?.code || '';
  if (c === 'auth/network-request-failed' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported' || c === 'auth/internal-error') {
    if (inAppBrowser()) return '카카오톡 같은 앱 안 브라우저에선 Google 로그인이 안 돼요. 크롬·사파리로 열어 주세요.';
    if (standalone()) return '홈 화면에 설치한 앱에선 Google 창이 안 열릴 때가 있어요. 크롬·사파리에서 게임 주소를 열어 한 번 로그인해 주세요(안드로이드 크롬은 로그인이 앱에도 이어져요).';
    return '인터넷이 되는데도 그렇다면: 광고 차단·추적 방지(사파리 "크로스 사이트 추적 방지", 삼성 인터넷 "스마트 보호" 등)나 시크릿 창을 끄고 다시 해 보세요.';
  }
  if (c === 'auth/popup-blocked') return '주소창 옆 팝업 차단 표시를 눌러 허용하거나, 다시 한 번 눌러 보세요.';
  return '';
}
const errText = (err) => { const c = err?.code || err?.message || ''; return c ? `${googleErr(err)} (${c})` : googleErr(err); };
let linking = false;
async function linkGoogle(testCred) {
  if (linking) return;
  linking = true;
  let r;
  try { r = await net.linkGoogle(testCred); } catch (err) { console.warn('[google]', err); toast(errText(err)); return; } finally { linking = false; }
  if (r.linked) {
    setLoginPref('google');
    closeModal();
    cloudOk = true;
    const ok = await cloudPush(true);
    toast(ok ? `✔ Google 계정(${net.googleEmail()})에 이었어요 — 이제 진행이 서버에도 저장돼요` : '✔ Google 계정에 이었어요 — 서버 저장은 잠시 뒤 다시 해요');
    return;
  }
  if (r.conflict) askSwitch(r);
}
function askSwitch(r) {
  openModal((m) => {
    m.append(h('h2', {}, '이미 다른 진행에 이어진 계정이에요'),
      h('p', { class: 'muted' }, `${r.email || '이 Google 계정'}은(는) 다른 기기에서 하던 진행과 이어져 있어요. 그 진행으로 바꿀까요?`),
      h('p', { class: 'muted' }, `이 기기의 지금 진행(Lv ${game.s.level})은 이 기기 안에 백업으로만 남고, 서열에서도 내려가요.`),
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { class: 'btn primary', onclick: async (e) => {
          e.target.disabled = true;
          try {
            save();
            const c = await net.switchAccount(r.cred);
            closeModal();
            if (c?.data) { loadCloud(c); return; }
            // 그 계정엔 서버 세이브가 없다 — 이 기기 진행을 그 계정으로 올리고 새로 연다(문파·서열을 새 계정으로 다시 잇는다)
            cloudOk = true;
            await cloudPush(true);
            stopSaving = true;
            location.reload();
          } catch (err) { console.warn('[google] switch', err); e.target.disabled = false; toast(errText(err)); }
        } }, '그 진행으로 바꾸기'),
        h('button', { class: 'btn', onclick: closeModal }, '그만두기')));
  });
}
// ---------- 로그인 화면 (v266) ----------
// 로딩이 끝나면: 온라인 · Google 아님 · 손님을 고른 적 없음 → 로그인 화면. Google로 한 번 들어오면 Firebase가 기억해 다음부턴 안 뜬다.
let loginUI = null;
let loginDone = null;
// v267 Firestore가 막혀 '끊김'이어도 인증만 되면 로그인은 된다
function needLogin() { return !!net.authed?.() && !net.isGoogle?.() && loginPref() !== 'guest'; }
// 서버 규칙이 막은 곳 — 로그인 화면·설정에 알린다
const deniedNote = () => (net.blocked ? `⚠ 서버 규칙이 '${net.deniedAt || '요청'}'을(를) 막아 온라인 기능이 꺼졌어요. Firebase 콘솔 → Firestore → 규칙에 저장소의 firestore.rules 전체를 다시 붙여 넣고 게시해 주세요. (Google 로그인은 그대로 할 수 있어요)` : '');
function finishLogin(msg) {
  if (msg) setTimeout(() => toast(msg), 400);
  const d = loginDone; loginDone = null; d?.();
}
// 이 기기 진행이 거의 없다(새로 시작) — 이미 다른 진행에 이어진 Google이면 묻지 않고 그 진행으로 간다
const freshHere = () => !saved || !game.s.job;
async function switchAndLoad(r) {
  loginUI?.busy('서버의 진행을 불러오는 중…');
  save();
  const c = await net.switchAccount(r.cred);
  setLoginPref('google');
  if (c?.data) { loadCloud(c); return; }
  // 그 계정엔 서버 세이브가 없다 — 이 기기 진행을 그 계정으로 올리고 새로 연다
  cloudOk = true;
  await cloudPush(true);
  stopSaving = true;
  CH.setSkip(); location.reload();
}
async function loginGoogle(testCred) {
  if (linking) return;
  linking = true;
  loginUI?.busy('Google 창에서 계정을 골라 주세요…');
  let r;
  try { r = await net.linkGoogle(testCred); } catch (err) {
    console.warn('[login]', err);
    const c = err?.code || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' || c === 'auth/user-cancelled') loginUI?.reset();
    else loginUI?.error(googleErr(err), googleHelp(err), c || String(err?.message || ''));
    return;
  } finally { linking = false; }
  if (r.linked) {
    setLoginPref('google');
    cloudOk = true;
    cloudPush(true);
    finishLogin(`✔ ${net.googleEmail() || 'Google'}로 들어왔어요 — 다음부턴 바로 시작해요`);
    return;
  }
  if (!r.conflict) return;
  if (freshHere()) {
    try { await switchAndLoad(r); } catch (err) { console.warn('[login] switch', err); loginUI?.error(googleErr(err), googleHelp(err), err?.code || ''); }
    return;
  }
  // 이 기기에도 진행이 있다 — 어느 쪽으로 할지 고른다
  loginUI?.pick(
    h('div', { class: 'login-pick' }, h('b', {}, r.email || '이 Google 계정'), '은(는) 다른 기기에서 하던 진행과 이어져 있어요.', h('br'),
      `그 진행으로 바꾸면 이 기기의 지금 진행(Lv ${game.s.level})은 이 기기 안에 백업으로만 남아요.`),
    h('button', { class: 'login-google', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { await switchAndLoad(r); } catch (err) { console.warn('[login] switch', err); loginUI?.reset(); loginUI?.error(googleErr(err), googleHelp(err), err?.code || ''); }
    } }, 'Google 계정의 진행으로 바꾸기'),
    h('button', { class: 'login-guest', onclick: () => { setLoginPref('guest'); finishLogin('이 기기 진행으로 이어 해요 — 손님으로 들어왔어요'); } }, '이 기기 진행으로 계속(손님)'));
}
function loginScreen() {
  return new Promise((resolve) => {
    loginDone = resolve;
    loginUI = showLogin({
      online: !!net.authed?.(),
      warn: deniedNote() || null,
      onGoogle: () => loginGoogle(),
      onGuest: () => { setLoginPref('guest'); finishLogin(net.authed?.() ? '손님으로 들어왔어요 — 설정 → 앱·계정에서 언제든 Google을 이을 수 있어요' : ''); },
    });
  });
}
async function logout() {
  if (!confirm('이 기기에서 로그아웃할까요? 진행은 서버에 올려 두고, 다시 Google로 들어오면 이어 해요.')) return;
  save();
  const ok = await cloudPush(true);
  if (!ok) { toast('서버에 저장하지 못해 로그아웃을 멈췄어요 — 인터넷을 확인해 주세요'); return; }
  stopSaving = true;
  try {
    localStorage.setItem(`${W.SAVE_KEY}.loggedOut`, localStorage.getItem(W.SAVE_KEY) || '');
    for (const k of [W.SAVE_KEY, ...BAK_KEYS]) localStorage.removeItem(k);
    setLoginPref('');
  } catch { /* 사생활 모드 */ }
  try { await net.signOut(); } catch (err) { console.warn('[logout]', err); }
  location.reload();
}
// ---------- v328 캐릭터 고르기(넷까지) · 체험 모드 ----------
// 캐릭터 그림 — 세이브를 잠깐 게임으로 만들어 지금 모습(꾸미기·도포·무기)을 그린다
function charLook(json) {
  try { const g = json === game ? game : new WorldGame(JSON.parse(json)); return view.heroLook(g, false); } catch { return null; }
}
function charSelect(boot) {
  return new Promise((resolve) => {
    const idx = CH.syncActive(game.s);
    const cloud = {};   // 칸 → 서버 것(이 기기 것보다 새것일 때)
    let done = false, busy = false;
    const finish = () => { if (done) return; done = true; closeModal(); resolve(); };
    const curJSON = () => (game.s.nickname || game.s.job ? JSON.stringify(game.toJSON()) : null);
    const google = () => !!(net.isGoogle?.() && net.ready?.());
    const go = async (slot, json) => {
      if (busy) return;
      busy = true;
      save();
      const cur = curJSON();
      // Google이면 지금 캐릭터를 서버 칸에도 올려 둔다(다른 기기에서 고를 수 있게)
      if (cur && google()) { try { await net.pushChar(idx.act, cur); } catch (err) { console.warn('[chars] push', err?.code || err); } }
      if (!CH.switchTo(slot, cur, json)) { busy = false; toast('⚠ 기기 저장 공간이 모자라 바꾸지 못했어요'); return; }
      stopSaving = true;
      location.reload();
    };
    const grid = h('div', { class: 'char-grid' });
    const paint = () => {
      grid.innerHTML = '';
      for (let i = 0; i < CH.MAX_CHARS; i++) {
        const isAct = i === idx.act && !!(game.s.nickname || game.s.job);
        const cl = cloud[i];
        const e = isAct ? CH.summarize(game.s, i) : cl ? { slot: i, n: cl.n, lv: cl.lv, job: cl.job } : idx.list.find((x) => x.slot === i);
        if (!e) {
          grid.append(h('button', { class: 'char-card empty', onclick: () => {
            if (!curJSON()) { finish(); return; }   // 아직 아무도 없다 — 이 판으로 새로 만든다
            go(i, null);
          } }, h('div', { class: 'cc-plus' }, '＋'), h('b', {}, '새 무인 만들기'), h('small', {}, `${i + 1}번 칸`)));
          continue;
        }
        const cv = h('canvas', { width: 130, height: 132 });
        const json = isAct ? game : cl ? cl.data : CH.slotJSON(i);
        const L = json ? charLook(json) : null;
        if (L) {
          const c = cv.getContext('2d');
          c.setTransform(1.05, 0, 0, 1.05, 0, 0);
          try { drawFighter(c, 58, 120, L.look, { ...L.opts, t: 0.4 + i }); } catch { /* 그림이 덜 왔다 */ }
        }
        const job = e.job ? (W.CLASSES[e.job]?.name || jobOf(e.job)?.name || e.job) : '직업 고르기 전';
        const del = !isAct ? h('button', { class: 'cc-del', title: '지우기', onclick: async (ev) => {
          ev.stopPropagation();
          const nm = prompt(`'${e.n || '이름 없음'}'(Lv ${e.lv})을(를) 지우면 되돌릴 수 없어요.\n지우려면 이름을 그대로 적어 주세요.`);
          if (nm == null) return;
          if (nm.trim() !== (e.n || '')) { toast('이름이 달라 지우지 않았어요'); return; }
          CH.removeChar(i);
          idx.list = idx.list.filter((x) => x.slot !== i);
          delete cloud[i];
          if (google()) { try { await net.deleteChar(i); } catch (err) { console.warn('[chars] delete', err?.code || err); } }
          toast(`${e.n || '그 무인'}을(를) 지웠어요`);
          paint();
        } }, '✕') : '';
        grid.append(h('button', { class: `char-card${isAct ? ' act' : ''}`, onclick: () => {
          if (isAct) { finish(); return; }
          const data = cl ? cl.data : CH.slotJSON(i);
          if (!data) { toast('그 캐릭터의 세이브를 찾지 못했어요'); return; }
          go(i, data);
        } }, del, cv, h('b', {}, e.n || '이름 없음'), h('small', {}, `Lv ${e.lv} · ${job}`),
          h('span', { class: 'cc-go' }, isAct ? (boot ? '▶ 이어 하기' : '지금 하는 무인') : cl ? '☁ 접속(서버)' : '▶ 접속')));
      }
    };
    openModal((m) => {
      m.append(h('h2', {}, '무인 고르기'),
        h('p', { class: 'muted' }, `한 계정에 무인을 ${CH.MAX_CHARS}명까지 키울 수 있어요. 문파·서열·우편은 계정 하나로 묶여 지금 고른 무인으로 보여요.`),
        grid,
        h('button', { class: 'btn', id: 'trial-open', style: 'width:100%;margin-top:10px', onclick: () => { done = true; trialPick(() => charSelect(boot).then(resolve)); } }, '🎮 체험 모드 — 다 키운 무인(Lv 80·3차)으로 맛보기 · 저장 안 됨'),
        boot ? '' : h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: finish }, '닫기'));
      paint();
      if (google()) net.fetchChars().then((list) => {
        for (const c of list) {
          if (c.slot === idx.act) continue;
          const loc = idx.list.find((x) => x.slot === c.slot);
          if (!loc || (Number(c.at) || 0) > (Number(loc.at) || 0) + 1000) cloud[c.slot] = c;
        }
        if (!done) paint();
      }).catch((err) => console.warn('[chars] fetch', err?.code || err));
    }, { dismissable: !boot, onClose: () => { if (!done) { done = true; resolve(); } } });
  });
}
function trialPick(back) {
  let left = false;
  openModal((m) => {
    const grid = h('div', { class: 'class-grid' });
    for (const j of JOBS) {
      grid.append(h('button', { class: 'class-card', style: `border-color:${j.color}`, onclick: () => {
        save();
        stopSaving = true;
        CH.startTrial(j.id);
        location.reload();
      } }, h('div', { class: 'cc-txt' }, h('b', { style: `color:${j.color}` }, j.name), h('small', {}, `${j.weapon}${j.range ? ' · 멀리서' : ''}`), h('span', { class: 'desc' }, W.CLASSES[j.id].trait))));
    }
    m.append(h('h2', {}, '🎮 체험 모드'),
      h('p', { class: 'muted' }, 'Lv 80 · 3차 전직 · 흑풍마를 탄 무인으로 이번 창에서만 놀아 봐요. 아무것도 저장되지 않고, 끝내면 내 캐릭터로 돌아가요.'),
      grid,
      h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: () => { left = true; back?.(); } }, '← 돌아가기'));
  }, { dismissable: false, onClose: () => { if (!left) { left = true; back?.(); } } });
}
function trialStart() {
  document.body.classList.add('in-trial');
  const nb = $('net-badge'); if (nb) nb.textContent = '체험 모드';
  document.body.append(h('div', { id: 'trial-bar' }, h('span', {}, '🎮 체험 중 · 저장 안 됨'),
    h('button', { class: 'btn', onclick: () => { CH.endTrial(); location.reload(); } }, '끝내기')));
  setTimeout(() => toast('체험 모드예요 — 무공·창을 마음껏 눌러 보세요. 끝내면 내 캐릭터 고르기로 돌아가요'), 500);
}
window.__test_charSelect = () => charSelect(false);
function accountRows() {
  const rows = [];
  if (TRIAL_JOB) {
    rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '체험 모드'), h('div', { class: 'desc' }, '저장되지 않아요 — 끝내면 내 캐릭터 고르기로 돌아가요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: () => { CH.endTrial(); location.reload(); } }, '끝내기')));
    return rows;
  }
  rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '무인 바꾸기'),
    h('div', { class: 'desc' }, `한 계정에 ${CH.MAX_CHARS}명까지 · 지금 ${CH.readIndex().list.length}명`)),
    h('button', { class: 'btn primary', id: 'btn-chars', style: 'padding:6px 12px', onclick: () => { closeModal(); charSelect(false); } }, '고르기')));
  if (net.isGoogle?.()) {
    const t = cloudSyncedAt();
    rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, `Google 계정 · ${net.googleEmail()}`),
      h('div', { class: 'desc' }, net.savesDenied ? '⚠ 서버 저장이 규칙에 막혀 있어요 — Firestore 규칙에 saves 칸이 있는지 확인해 주세요' : `진행이 서버에도 저장돼요(3분마다·화면을 떠날 때) · 마지막 ${whenStr(t)}`)),
      h('button', { class: 'btn', style: 'padding:6px 12px', onclick: async (e) => {
        e.target.disabled = true;
        save();
        const ok = await cloudPush(true);
        e.target.disabled = false;
        toast(ok ? '서버에 저장했어요' : cloudOk ? '서버에 저장하지 못했어요 — 인터넷을 확인해 주세요' : '서버 진행과 맞춰 보는 중이에요 — 잠시 뒤 다시 눌러 주세요');
      } }, '지금 저장')));
    rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '로그아웃'),
      h('div', { class: 'desc' }, '진행을 서버에 올리고 이 기기에서 나가요 — 다시 Google로 들어오면 이어 해요')),
      h('button', { class: 'btn', style: 'padding:6px 12px', onclick: () => logout() }, '나가기')));
  } else {
    rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, 'Google 계정 연결'),
      h('div', { class: 'desc' }, net.authed?.() ? '이으면 진행이 서버에도 저장돼요 — 브라우저를 지우거나 기기를 바꿔도 같은 Google로 들어와 이어 해요' : '온라인일 때 이을 수 있어요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', disabled: net.authed?.() ? null : true, onclick: () => linkGoogle() }, '잇기')));
  }
  if (net.blocked) rows.unshift(h('p', { class: 'login-hint', style: 'margin:6px 0' }, deniedNote()));
  // v264: 내 계정 번호(uid) — Firebase 콘솔에서 내 것을 찾을 때
  rows.push(h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '내 계정 번호'),
    h('div', { class: 'desc', style: 'word-break:break-all;user-select:all' }, net.uid || '아직 연결 전이에요')),
    net.uid ? h('button', { class: 'btn', style: 'padding:6px 12px', onclick: async () => {
      try { await navigator.clipboard.writeText(net.uid); toast('계정 번호를 복사했어요'); } catch { toast('길게 눌러 직접 복사해 주세요'); }
    } }, '복사') : ''));
  return rows;
}

// ---------- 창(시트) ----------
const tabs = {};
let activeTab = null;
let sheetFull = false;
try { sheetFull = localStorage.getItem('ifu-sheet-full') === '1'; } catch { /* 사생활 모드 */ }
function paintSheet() {
  $('panel').classList.toggle('full', sheetFull);
  $('panel-dim').classList.toggle('full', sheetFull);
  view.sheetOpen = !!activeTab && !sheetFull;
}
$('panel-grip').addEventListener('click', () => {
  sheetFull = !sheetFull;
  try { localStorage.setItem('ifu-sheet-full', sheetFull ? '1' : '0'); } catch { /* 이번만 */ }
  paintSheet();
});
function closePanel() {
  activeTab = null;
  paintSheet();
  $('panel').classList.remove('open');
  $('panel-dim').classList.remove('open');
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.remove('active'));
}
function showTab(name, sub) {
  // 하위 탭까지 고르면(마을 → 가방의 대장장이) 열려 있어도 닫지 않고 그 칸으로
  if (activeTab === name && sub) { tabs[name].select?.(sub); return; }
  if (activeTab === name) return closePanel();
  if (!tabs[name]) tabs[name] = WTABS[name](app);
  activeTab = name;
  if (name === 'social') dot('social', false);   // v302 전체 채팅 읽음
  $('panel-body').replaceChildren(tabs[name].root);
  $('panel-body').scrollTop = 0;
  // v261: 열린 창에서 다른 창으로 바꾸면 내용이 살짝 밀려 들어온다
  { const pb = $('panel-body'); pb.classList.remove('tab-in'); void pb.offsetWidth; pb.classList.add('tab-in'); }
  $('panel-title').textContent = WTAB_TITLE[name] || '';
  $('panel').classList.add('open');
  $('panel-dim').classList.add('open');
  paintSheet();
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (sub) tabs[name].select?.(sub);
  tabs[name].shown?.(sub);
  tabs[name].update();
  panelRes();
}
// v263: 창은 레벨에 따라 열린다 — Lv1부터 일곱 개가 다 열려 있어 첫 10분이 어지러웠다(옛 세이브는 이미 높아 그대로)
const TAB_LV = { comp: 12, dgn: 18, social: 25 };
const TAB_NAME = { comp: '동료', dgn: '던전', social: '무림' };
const tabLocked = (k) => (game.s.level || 1) < (TAB_LV[k] || 0);
function paintTabLocks() {
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => {
    const lk = tabLocked(b.dataset.tab);
    b.classList.toggle('locked', lk);
    if (lk) b.dataset.lv = `Lv${TAB_LV[b.dataset.tab]}`; else delete b.dataset.lv;
  });
}
// v325 사냥 단추 — 처음 하면 들판을 눌러야 사냥터로 가는 줄 몰랐다. 마을·던전이면 하던 사냥터로, 사냥 중이면 알맞은 사냥터로
function goHuntNow() {
  const m = game.map;
  const last = game.s.huntMap && W.hasMap(game.s.huntMap) && !W.mapOf(game.s.huntMap).town ? game.s.huntMap : null;
  const to = m.town || game.inst ? (last || game.fitMap()) : game.fitMap();
  if (!m.town && !game.inst && to === m.id) { toast(`이미 알맞은 사냥터(${m.name})에서 사냥 중이에요 — 다른 곳은 지도에서`); return; }
  if (!game.enterMap(to)) { toast('지금은 갈 수 없어요'); return; }
  game.s.autoHunt = true;
  closePanel(); save(); refreshUI(true);
  toast(`⚔ ${W.mapOf(to).name}에서 사냥해요`);
}
document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.tab === 'hunt') { goHuntNow(); return; }
  if (tabLocked(b.dataset.tab)) { toast(`${TAB_NAME[b.dataset.tab]} 창은 레벨 ${TAB_LV[b.dataset.tab]}에 열려요`); return; }
  showTab(b.dataset.tab);
}));
$('panel-dim').addEventListener('click', closePanel);
$('panel-close').addEventListener('click', closePanel);
function panelRes() {
  const row = document.querySelector('#panel-head .res-row');
  row.replaceChildren(
    // v212: 물약 수는 위 상단바·아래 물약 단추에 이미 있다 — 창 머리에선 은자만
    h('div', { class: 'res' }, h('span', { class: 'cur silver' }, '은'), h('b', {}, fmt(game.s.gold))));
}

// ---------- 무공 바 ----------
let skillEls = [];
let potionEl = null;
let autoEl = null;
// 배운 스킬만 단다. 전에는 못 배운 1·2·3차 칸이 회색 빈칸으로 늘 떠 있어서 뭔지 몰랐다.
// 전직할 수 있게 되면 그 자리에 'N차 전직' 단추가 반짝인다(누르면 마을 창의 사부).
let advEl = null;
function buildSkillbar() {
  const all = game.skills();
  advEl = null;
  if (game.canAdvance()) {
    advEl = h('button', { class: 'skill-btn adv-btn', onclick: () => showTab('town', 'master') },
      h('b', {}, `${game.s.jobTier + 1}차`), h('div', { class: 'lock' }, '전직하기'));
  }
  skillEls = all.map((sk) => {
    const cd = h('div', { class: 'cd' });
    const num = h('div', { class: 'cdn' });
    const lock = h('div', { class: 'lock' });
    // 길게 누르면(0.35초) 펼치지 않고 범위만 보여 준다 (v157) — 떼면 사라진다
    let holdT = 0, held = false;
    const endHold = () => { clearTimeout(holdT); holdT = 0; if (view.rangePreview?.id === sk.id) view.rangePreview = null; };
    const btn = skinImg(h('button', { class: 'skill-btn', 'aria-label': sk.name, onclick: () => {
      if (held) { held = false; return; }
      if (sk.tier > game.s.jobTier) return showTab('town', 'master');
      if (!game.useSkill(sk.id)) toast({ town: '사냥터에서 쓸 수 있어요', hp: '체력이 모자라요', cd: '아직 숨이 안 돌아왔어요', far: '닿는 적이 없어요 — 가까이 가요', none: '칠 적이 없어요' }[game.skillFail] || '지금은 펼칠 수 없어요');
    } }, h('span', { class: 'sk-name' }, sk.icon), cd, num, lock), `w-${game.s.job}-${sk.id}`);
    btn.addEventListener('pointerdown', () => {
      held = false;
      clearTimeout(holdT);
      holdT = setTimeout(() => {
        const rc = game.skillReach(sk);
        held = true;
        if (!rc) { toast(`${sk.name} — 범위가 없는 무공(나에게 거는 기술)이에요`); return; }
        view.rangePreview = { id: sk.id, ...rc };
        game.mark('range');
        toast(`${sk.name} — ${rangeText(game, sk)}`);
      }, 350);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, endHold);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    if (all.indexOf(sk) < 5) btn.dataset.hk = String(all.indexOf(sk) + 1);   // v326 단축키 글자
    return { sk, btn, cd, num, lock, was: 0 };
  });
  potionEl = h('button', { class: 'skill-btn potion-btn', 'aria-label': '물약', onclick: () => {
    if (!game.drinkPotion()) toast(game.s.potions ? '체력이 가득해요' : '물약이 없어요 — 마을 상점에서 사요');
  } }, skinImg(h('span', { class: 'pot-ico' }), 'potion'), h('div', { class: 'lock' }));
  autoEl = h('button', { class: 'skill-btn auto-toggle', onclick: () => {
    game.s.autoHunt = !game.s.autoHunt;
    toast(game.s.autoHunt ? '자동 사냥을 켰어요' : '자동 사냥을 껐어요 — 들판을 눌러 움직여요');
    save();
  } }, skinImg(h('b', {}, '자동'), 'auto'), h('div', { class: 'lock' }));
  potionEl.dataset.hk = 'Q'; autoEl.dataset.hk = 'A';
  $('skillbar').replaceChildren(...skillEls.map((e) => e.btn), ...(advEl ? [advEl] : []), potionEl, autoEl);
}

// ---------- 화면 갱신 ----------
let lastSig = '';
// 같은 글이면 건드리지 않는다 — 같은 글을 다시 넣어도 브라우저는 그 자리를 다시 칠한다 (v185)
function setText(el, v) { if (el.textContent !== v) el.textContent = v; }
// v261: 레벨이 오르면 경험치 막대가 거꾸로 미끄러지지 않게 — 끝까지 채우고 번쩍인 뒤 0에서 새 값으로
let expLv = null, expBusy = false;
function expBar(level, r) {
  const bar = $('exp-bar').firstChild;
  if (expLv == null) expLv = level;
  if (level > expLv && !expBusy) {
    expLv = level;
    expBusy = true;
    setBar(bar, 1);
    setTimeout(() => {
      bar.style.transition = 'none';
      setBar(bar, 0);
      const lvEl = $('hero-lv');
      if (lvEl) { lvEl.classList.remove('lvup'); void lvEl.offsetWidth; lvEl.classList.add('lvup'); }
      $('exp-bar').classList.remove('flash'); void bar.offsetWidth; $('exp-bar').classList.add('flash');
      requestAnimationFrame(() => { bar.style.transition = ''; expBusy = false; setBar(bar, game.s.exp / game.expNeed()); });
    }, 300);
    return;
  }
  if (level < expLv) expLv = level;
  if (!expBusy) setBar(bar, r);
}
// v260: HUD 은자는 늘 때 0.4초 남짓 세어 올라간다(줄 때는 바로) — 두목을 잡으면 240 → 1530으로 툭 바뀌었다
let goldShown = null;
function goldTween(v) {
  if (goldShown == null || v < goldShown || v - goldShown < 2) { goldShown = v; return v; }
  goldShown += Math.max(1, Math.ceil((v - goldShown) * 0.55));
  if (goldShown > v) goldShown = v;
  return goldShown;
}
// 은자 덩이가 닿는 자리 — 캔버스 기준 css px(위쪽 은자 칸). 창 크기가 바뀔 때·가끔 다시 잰다.
function hudGoldAt() {
  const el = document.querySelector('.res-silver .cur') || $('gold');
  const cv = $('cv');
  if (!el || !cv) return;
  const a = el.getBoundingClientRect(), b = cv.getBoundingClientRect();
  if (!a.width || !b.width) { view.hudGold = null; return; }
  view.hudGold = { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
}
let goldPulseT = 0;
function goldPulse() {
  const now = performance.now();
  if (now - goldPulseT < 120) return;
  goldPulseT = now;
  const el = document.querySelector('.res-silver');
  if (!el) return;
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}
function setBar(el, r) {
  const v = `scaleX(${Math.max(0, Math.min(1, r || 0)).toFixed(4)})`;
  if (el.style.transform !== v) el.style.transform = v;
}
// v320 저장 코드
async function showSaveCode() {
  save();
  let code = '';
  try { code = await encodeSave(game.toJSON()); } catch (err) { toast('코드를 만들지 못했어요'); console.warn(err); return; }
  const ta = h('textarea', { class: 'field code-box', readonly: true, rows: 5 });
  ta.value = code;
  openModal((s) => s.append(h('h2', {}, '저장 코드'),
    h('p', { class: 'muted' }, `Lv.${game.s.level} ${game.s.nickname || ''} · ${new Date().toLocaleString('ko-KR')} · ${fmt(code.length)}자 — 통째로 복사해 두세요.`),
    h('p', { class: 'muted', style: 'color:#fca5a5' }, '⚠ 이 코드가 있으면 누구든 이 캐릭터를 가져갈 수 있어요. 남에게 주지 마세요.'),
    ta,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: async () => { try { await navigator.clipboard.writeText(code); toast('저장 코드를 복사했어요'); } catch { ta.select(); toast('길게 눌러 전체 선택 → 복사해 주세요'); } } }, '복사'),
      h('button', { class: 'btn', onclick: closeModal }, '닫기'))));
}
function askSaveCode() {
  const ta = h('textarea', { class: 'field code-box', rows: 5, placeholder: 'IFU1.… 으로 시작하는 저장 코드를 통째로 붙여 넣어 주세요' });
  const msg = h('p', { class: 'muted' }, '');
  openModal((s) => s.append(h('h2', {}, '저장 코드로 되살리기'), h('p', { class: 'muted' }, '지금 진행은 이 기기에 따로 남겨 두고, 코드의 진행으로 바꿔요.'), ta, msg,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: closeModal }, '그만두기'),
      h('button', { class: 'btn primary', onclick: async () => {
        msg.style.color = ''; msg.textContent = '여는 중…';
        let obj;
        try { obj = await decodeSave(ta.value); new WorldGame(JSON.parse(JSON.stringify(obj))); } catch (err) { msg.style.color = '#fca5a5'; msg.textContent = err?.message || '열지 못했어요'; return; }
        const job = W.classOf(obj.job)?.name || obj.job;
        if (!confirm(`지금: Lv.${game.s.level} ${game.s.nickname || ''}\n코드: Lv.${obj.level} ${obj.nickname || ''} (${job})\n\n코드의 진행으로 바꿀까요? 지금 진행은 이 기기에 따로 남아요.`)) return;
        try {
          localStorage.setItem(`${W.SAVE_KEY}.beforeCode`, JSON.stringify(game.toJSON()));
          // 되살린 때부터 다시 센다 — 옛 코드로 방치 보상을 여러 번 받지 못하게
          obj.lastSeen = Date.now(); obj.clockMax = Date.now(); delete obj.pendingOffline;
          localStorage.setItem(W.SAVE_KEY, JSON.stringify(obj));
        } catch { msg.style.color = '#fca5a5'; msg.textContent = '기기 저장 공간이 모자라 바꾸지 못했어요'; return; }
        stopSaving = true;
        CH.setSkip(); location.reload();
      } }, '되살리기'))));
}
// v320 출석부 — 그날 처음 들어오면 한 번 띄운다(닫으면 받는다)
let attAsked = false;
function showAttend() {
  const day = game.attNext();
  openModal((s) => s.append(h('h2', {}, '📅 오늘의 출석'), h('p', { class: 'muted' }, `${day}일째 — 7일째가 커요 · 빠져도 끊기지 않아요`), attGrid(game),
    h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px', onclick: closeModal }, `${day}일째 받기`)),
  { dismissable: false, onClose: () => { game.attend(); save(); refreshUI(true); } });
}
// v318 지난주 두목 순위 보상 — 접속마다 한 번 본다. 3위 안이면 창, 아니면 조용히 '본 것'으로
let wbChecked = false;
async function checkWeekReward() {
  let r = null;
  try { r = await net.lastWeekRanks(); } catch (err) { console.warn('[week reward]', err?.message || err); wbChecked = false; return; }
  if (!r) return;
  const rw = game.weekRewardFor(r.ranks);
  if (!rw) { game.claimWeekReward(r.key, r.ranks); save(); return; }
  const lines = [['kills', '두목 처치'], ['hwamugi', '화무기 최단'], ['magwi', '마귀 최단']].filter(([k]) => r.ranks[k]).map(([k, n]) => h('div', { class: 'wr-line' }, `${['🥇', '🥈', '🥉'][r.ranks[k] - 1]} ${n} ${r.ranks[k]}위`));
  const show = () => openModal((s) => {
    s.append(h('h2', {}, '🏆 지난주 두목 순위'), h('p', { class: 'muted' }, `${r.key} 주 · 가장 좋은 자리 하나로 보상을 받아요`),
      ...lines,
      h('div', { class: 'stat-grid' },
        h('div', {}, '혼', h('b', {}, `${rw.soul}`)),
        h('div', {}, '포획·탈것 조각', h('b', {}, `${rw.shard}개씩`)),
        h('div', {}, '은자', h('b', {}, fmt(rw.gold))),
        rw.title ? h('div', {}, '칭호', h('b', { style: `color:${W.titleOf(rw.title).col}` }, `〈${W.titleOf(rw.title).name}〉 ${W.WB_TITLE_DAYS}일`)) : null),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '받기'));
  }, { dismissable: false, onClose: () => { const got = game.claimWeekReward(r.key, r.ranks); if (got?.title) net.announce(`🏆 ${game.s.nickname}님이 지난주 두목 순위 1위 — 〈${W.titleOf(got.title).name}〉!`); save(); refreshUI(true); } });
  if (modalOpen()) setTimeout(() => { if (!modalOpen()) show(); else wbChecked = false; }, 3000); else show();
}
// v316 초 → 1:23.4
function fmtSec(x) { const m = Math.floor(x / 60), r = x - m * 60; return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)}초`; }
// v314 분당 경험치 글 — 레벨의 몇 %를 1분에 버나(100%가 넘으면 분당 레벨로)
function fmtExpRate(x) {
  if (x >= 100) return `+${(x / 100).toFixed(1)}Lv/분`;
  if (x >= 10) return `+${x.toFixed(0)}%/분`;
  if (x >= 1) return `+${x.toFixed(1)}%/분`;
  return `+${x.toFixed(2)}%/분`;
}
// v314 두목까지 남은 초 — 두목 방 가운데 위에 고리로
function bossWaitHud() {
  const el = $('boss-wait');
  const w = game.bossWait();
  el.classList.toggle('hidden', !w);
  if (!w) return;
  const sec = Math.ceil(w.left);
  setText($('bw-sec'), String(sec));
  setText($('bw-txt'), `두목까지 ${sec}초`);
  const p = (w.total > 0 ? w.left / w.total : 0).toFixed(3);
  const ring = el.firstChild;
  if (ring.style.getPropertyValue('--p') !== p) ring.style.setProperty('--p', p);
  el.classList.toggle('soon', sec <= 3);
}
function refreshUI(full = false) {
  const s = game.s;
  // v254: 창이 닫히면 미뤄 둔 방치 보상을 띄운다
  if (s.pendingOffline && !modalOpen() && s.job) showPendingOffline();
  const st = game.stats();
  setText($('hero-name'), s.nickname || '무명');
  setText($('hero-rank'), game.tierName() || '-');
  setText($('hero-lv'), `Lv.${s.level}`);
  // v185: 너비 대신 transform으로 — 너비를 바꾸면 배치를 다시 하고 화면 전체를 다시 칠했다(막대가 움직이는 동안 매 프레임)
  expBar(s.level, s.exp / game.expNeed());
  setText($('exp-pct'), `${Math.min(99.9, (s.exp / game.expNeed()) * 100).toFixed(1)}%`);
  // v314 분당 경험치 · 낮은 사냥터 알림
  const epm = game.expPerMin();
  setText($('exp-rate'), epm == null ? '' : fmtExpRate(epm));
  const gap = game.huntGap();
  $('exp-rate').classList.toggle('slow', !!gap);
  const ew = $('exp-warn');
  ew.classList.toggle('hidden', !gap);
  if (gap) {
    const cut = Math.round((1 - gap.k) * 100);
    setText(ew, gap.to ? `⚠ 경험치 −${cut}% → ${W.mapOf(gap.to).name}로` : `⚠ 경험치 −${cut}% → 지도`);
    ew.title = '사냥터가 내 레벨보다 낮아 경험치가 깎여요 — 누르면 알맞은 곳으로';
    ew._to = gap.to;
  }
  bossWaitHud();
  document.body.classList.toggle('in-inst', !!game.inst);   // v325 던전 안에서는 길잡이·찍기 알약을 숨긴다(던전 머리와 겹쳤다)
  tallyTick();   // v321 얻은 것 모음
  setText($('gold'), fmt(goldTween(s.gold)));
  setText($('potions'), fmt(s.potions));   // v258 은자처럼 쉼표
  const m = game.map;
  instHud();
  // 사냥터 줄은 짧게 — '천산 설원 · 두목'은 체력 막대에 닿았다
  setText($('stage-label'), m.town || m.inst ? m.name : `${m.king ? m.king.title : m.zoneName} ${m.bossRoom ? '두목' : m.area}`);
  const bossLeft = Math.max(0, Math.ceil(game.bossT));
  const boss = game.mons.find((x) => x.isBoss && x.alive);
  setText($('zone-label'), m.inst ? (game.inst.kind === 'tower' ? `수문장 Lv.${m.lv[0]} · ${D.towerSec(game.inst.stage)}초 안에` : game.inst.kind === 'raid' ? `문파원과 함께 — ${D.RAID_SEC}초 동안 친 만큼` : `몹 Lv.${m.lv[0]} · ${D.DAILY_KILLS}마리 잡으면 깬다`) : m.town ? (s.autoHunt ? `쉬는 중 → ${W.mapOf(s.huntMap).name}` : '쉬는 중')
    : m.bossRoom ? (boss ? `두목 ${boss.name} Lv.${boss.lv}` : `두목 다시 나기까지 ${Math.floor(bossLeft / 60)}:${String(bossLeft % 60).padStart(2, '0')}`) + (coop.on ? ` · 🤝${coop.count + 1}명` : '')
      : `몹 Lv.${m.lv[0]}~${m.lv[1]} · 두목은 두목 구역에`);
  // 혼자/함께 단추 — 십이지왕 두목 구역에서만
  const pb = $('btn-party');
  const inKing = !m.inst && !m.town && m.bossRoom && m.king;
  pb.classList.toggle('hidden', !inKing);
  if (inKing) {
    const txt = game.s.kingParty ? (coop.on ? `🤝 함께 ${coop.count + 1}명` : '🤝 함께 · 잇는 중') : '⚔ 혼자 · 함께로';
    if (pb.textContent !== txt) pb.textContent = txt;
    pb.classList.toggle('on', !!game.s.kingParty);
  }
  const hpR = Math.max(0, Math.min(1, game.heroHp / st.hp));
  setBar($('progress-fill'), hpR);
  // 깎일 때만 늦게 따라오는 밝은 꼬리 — 차오를 때(회복)는 바로 맞춰 쉬지 않고 움직이지 않게 (v187)
  const tr = $('progress-trail');
  const up = hpR >= (tr._r ?? 0);
  tr.style.transition = up ? 'none' : '';
  tr._r = hpR;
  setBar(tr, hpR);          // 늦게 따라온다(css) — 깎인 만큼이 잠깐 밝게 남는다
  $('progress').classList.toggle('low', hpR < 0.35);
  setText($('progress-text'), `체력 ${fmt(Math.max(0, game.heroHp))} / ${fmt(st.hp)}`);
  setText($('power-label'), `전투력 ${fmt(st.power)}`);
  // 무공 바
  const sig = `${s.job}|${s.jobTier}|${game.canAdvance()}|${game.skills().length}`;
  if (sig !== lastSig) { lastSig = sig; buildSkillbar(); }
  for (const e of skillEls) {
    const open = game.knows(e.sk);
    e.btn.classList.toggle('locked', !open);
    e.lock.textContent = open ? (e.sk.hpCost ? `체력 ${Math.round(e.sk.hpCost * 100)}%` : '') :   // v212: 이름은 위에 이미 — 두 번 적지 않는다
      `${e.sk.tier}차 · Lv${W.TIERS[e.sk.tier].level}`;
    const left = game.cd[e.sk.id] || 0;
    e.cd.style.height = open ? `${Math.min(1, left / e.sk.cd) * 100}%` : '0';
    e.num.textContent = open && left > 0.95 ? String(Math.ceil(left)) : '';
    const ready = open && left <= 0;
    e.btn.classList.toggle('ready', ready);
    if (ready && e.was > 0) { e.btn.classList.remove('refresh'); void e.btn.offsetWidth; e.btn.classList.add('refresh'); }
    e.was = left;
  }
  if (potionEl) {
    potionEl.querySelector('.lock').textContent = `${s.potions}개`;
    potionEl.classList.toggle('locked', s.potions <= 0);
  }
  if (autoEl) {
    autoEl.classList.toggle('on', s.autoHunt);
    autoEl.querySelector('.lock').textContent = s.autoHunt ? '켬' : '끔';
  }
  // 창 버튼의 빨간 점: 스탯 점수가 남았을 때 · 전직할 수 있을 때
  // 스킬 점수로 올릴 수 있는 스킬이 있나
  const skillUp = game.skills().some((k) => game.canSkillUp(k.id));
  dot('char', (s.statPts > 0 && !s.autoStat) || skillUp);
  // 남은 레벨업 점수 — 들판 위 가운데 알약. 누르면 캐릭터 창(사냥하면서 찍는다)
  const adv = $('advice');
  const statPts = s.statPts > 0 && !s.autoStat;
  const showPts = (statPts || skillUp) && activeTab !== 'char';
  adv.classList.toggle('hidden', !showPts);
  if (showPts) adv.textContent = [statPts ? `스탯 ${s.statPts}` : '', skillUp ? `스킬 ${s.skillPts}` : ''].filter(Boolean).join(' · ') + ' · 찍기';
  // 길잡이 — 지금 할 일 하나. 다 끝내면 사라진다.
  const qb = $('quest');
  const cur = game.questNow();
  qb.classList.toggle('hidden', !cur);
  qb.classList.toggle('ready', !!cur?.done);
  if (cur) {
    qb.textContent = cur.done
      ? `길잡이 ✓ ${cur.q.title} — 받기`
      : `길잡이 ${game.s.quest + 1}/${QUEST_COUNT} · ${cur.q.title} (${fmt(cur.now)}/${fmt(cur.need)})`;
  }
  const t = game.nextTier();
  dot('town', (!!t && s.level >= t.level && s.gold >= t.cost) || (game.canChoosePath() && !s.path));   // v237: 길을 아직 안 골랐으면
  dot('comp', s.petBox.length > 0 && s.pets.length < game.petSlots());
  dot('dgn', dailyWaiting(game) || Object.values(game.s.zTickets || {}).some((n) => n > 0));
  if (activeTab) { tabs[activeTab].update(); panelRes(); }
  // v280 얼굴은 모습이 바뀌거나(경지·장비·꾸미기) 그림이 다 오면 다시 그린다 — 전엔 켤 때 한 번(그림이 오기 전 도형으로) 그리고 끝이었다
  const psig = `${s.rank}|${game.statSig()}|${JSON.stringify(s.custom || {})}|${s.outfit || ''}|${artReady()}`;
  if (full || psig !== portraitSig) { portraitSig = psig; drawPortrait(); }
}
let portraitSig = '';
// 던전 안 — 위 가운데 알림판: 무엇 · 남은 시간 · 처치(탑은 수문장 체력) · 나가기
const hud = $('contest-hud');
const leaveBtn = h('button', { class: 'inst-leave', onclick: () => {
  if (!game.inst) return;
  openModal((el) => el.append(h('h3', {}, '던전에서 나갈까요?'),
    h('p', { class: 'muted' }, game.inst.kind === 'daily' ? '깬 것으로 치지 않아요 — 잡은 만큼 보상의 절반만 받아요. 쓴 횟수는 돌아오지 않아요.' : game.inst.kind === 'raid' ? '지금까지 친 피해는 올라가요. 쓴 횟수는 돌아오지 않아요.' : '이번 층은 다시 도전할 수 있어요.'),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '계속하기'),
      h('button', { class: 'btn primary', onclick: () => { closeModal(); game.leaveInst(); handleEvents(); save(); refreshUI(true); } }, '나가기'))));
} }, '나가기');
hud.append(leaveBtn);
function instHud() {
  const I = game.inst;
  hud.classList.toggle('hidden', !I);
  hud.classList.toggle('tower', I?.kind === 'tower');
  hud.classList.toggle('raid', I?.kind === 'raid');
  if (!I) return;
  const left = Math.max(0, Math.ceil(I.t));
  $('contest-title').textContent = I.map.name;
  if (I.kind === 'tower') {
    const b = game.mons.find((x) => x.isBoss && x.alive);
    $('contest-sub').textContent = I.wait > 0 ? '수문장이 나선다…' : `수문장 ${b ? Math.ceil((b.hp / b.maxHp) * 100) : 0}% · 남은 ${left}초`;
  } else if (I.kind === 'raid') {
    const b = I.boss;
    $('contest-sub').textContent = I.wait > 0 ? '두목이 나선다…' : `피해 ${fmt(b ? Math.max(0, I.hpLeft - Math.max(0, b.hp)) : 0)} · 남은 체력 ${b ? ((Math.max(0, b.hp) / b.maxHp) * 100).toFixed(1) : 100}% · ${left}초`;
  } else $('contest-sub').textContent = `처치 ${I.kills} / ${I.target} · 남은 ${left}초`;
  hud.classList.toggle('hurry', left <= 10);
}
function showInstEnd(ev) {
  // 문파 토벌 — 친 만큼 서버에 올리고 알린다 (나가기로 끝내도 친 건 올린다)
  if (ev.kind === 'raid') {
    const send = ev.dealt > 0 ? net.commitWeekRaid(ev.key, ev.dealt) : Promise.resolve(false);
    send.then((killed) => {
      toast(`🐲 토벌 피해 ${fmt(ev.dealt)}${ev.reward ? ` · 참여 보상 ${rewardText(ev.reward)}` : ''}${killed ? ' — 마무리 일격! 두목 처치' : ''}`);
      app.refresh();
    }).catch((err) => toast(`토벌 기록 실패: ${err.message || err}`));
    return;
  }
  const d = ev.kind === 'daily' ? D.dailyOf(ev.id) : null;
  const name = d ? `${d.name} ${ev.stage}단계` : ev.stage > D.TOWER_MAX ? `주간 회랑 ${ev.stage - D.TOWER_MAX}층` : `무한의 탑 ${ev.stage}층`;
  // 탑을 이어 오르는 중이면 알림만 (창이 계속 뜨면 방치가 끊긴다)
  if (ev.kind === 'tower' && ev.ok) {
    toast(ev.stage > D.TOWER_MAX ? `🏯 ${name} 돌파!${ev.reward?.gold ? ` 은자 ${fmt(ev.reward.gold)}` : ''}`
      : `🏯 ${name} 돌파! 공격력·체력 +${(D.towerBonus(game.s.tower.floor) * 100).toFixed(1)}%${ev.reward?.mats ? ` · 보따리 ${rewardText(ev.reward)}` : ''}`);
    if (ev.chain) return;
  }
  if (ev.left) return;
  // v166: 이어서 다음 판으로 들어갔으면 창을 띄우지 않고 알림만 (방치가 끊기지 않게)
  if (ev.kind === 'daily' && ev.chain && ev.ok) {
    toast(`${name} 돌파!${ev.next ? ` → ${ev.next}단계 도전` : ' → 다음 던전'}${ev.reward ? ` · ${rewardText(ev.reward)}` : ''}`);
    return;
  }
  const why = ev.ok ? '' : ev.died ? '쓰러졌어요' : ev.timeout ? '시간이 다 됐어요' : '';
  openModal((el) => el.append(...[
    h('h3', {}, ev.ok ? `${name} 성공!` : `${name} — ${why}`),
    ev.kind === 'daily' ? h('p', { class: 'muted' }, `처치 ${ev.kills} / ${ev.target}${ev.ok ? ' — 다음부터 이 단계는 소탕할 수 있어요' : ' — 잡은 만큼 보상의 절반'}`) : null,
    ev.kind === 'daily' && ev.gotKey ? h('p', { class: 'dgn-key' }, `🔑 새 단계라 보상 몫을 안 썼어요 — ${Math.min(D.DAILY_STAGES, ev.stage + 1)}단계에 또 들어가 보세요`) : null,
    ev.kind === 'daily' && ev.extra ? h('p', { class: 'muted' }, `오늘 보상 몫을 다 써서 추가 도전 보상(${Math.round(D.DAILY_EXTRA * 100)}%)이에요 — 새 단계를 깨면 온전히 받아요`) : null,
    ev.kind === 'daily' && !ev.ok && !ev.extra ? h('p', { class: 'muted' }, `깨지 못하면 몫을 하나 써요 — 남은 ${game.dailyLeft(ev.id)}번은 소탕으로도 받아요`) : null,
    ev.kind === 'tower' && !ev.ok ? h('p', { class: 'muted' }, `오른 층 ${game.s.tower.floor} — 장비·스킬을 키워서 다시 도전하세요`) : null,
    ev.reward && rewardText(ev.reward) !== '없음' ? h('p', {}, `받은 것: ${rewardText(ev.reward)}`) : null,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '확인'))].filter(Boolean)));
}
function dot(tab, on) {
  const b = document.querySelector(`#tabs button[data-tab="${tab}"]`);
  if (!b) return;
  let d = b.querySelector('.dot');
  if (on && !d) b.append(h('i', { class: 'dot' }));
  if (!on && d) d.remove();
}
function drawPortrait() {
  const cv = $('portrait');
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  // v203: 둥근 패 안에는 얼굴·어깨만 크게
  // v280: 들판의 무인과 같은 모습(직업 무기·옷·장비 빛·꾸미기)으로 — 전엔 경지 기본 모습에 권갑을 모두에게 쥐여 줬다
  if (!game.s.job) return;
  const { look, opts } = view.heroLook(game, false);
  const L = { ...look, swords: 0, halo: false, aura: null, wings: false, edgeGlow: false, edgePulse: false };
  const k = cv.width / 104;
  c.setTransform(1.9 * k, 0, 0, 1.9 * k, 0, 0);
  drawFighter(c, 27, 100, L, { t: 0, weapon: opts.weapon, blade: opts.blade, hold: true, noWeapon: true, glow: false });
}
$('portrait').addEventListener('click', () => { if (game.s.job && !modalOpen()) openCustom(false); });   // v280 얼굴을 누르면 꾸미기
// ---------- 꾸미기 (v280) — 처음 캐릭터를 고른 뒤 · 왼쪽 위 얼굴을 눌러 ----------
function openCustom(first = false) {
  const cu = { head: null, hat: null, robe: null, band: null, face: null, boot: null, gender: null, fhead: null, hair: null, aura: null, ring: null, glow: null, ...(game.s.custom || {}) };
  cu.wpn = { ...(game.s.custom?.wpn || {}) };
  let flip = false, pose = 'stand', ctab = 'look';
  const jl = jobOf(game.s.job)?.look || 'sword';
  openModal((s) => {
    const cv = h('canvas', { width: 300, height: 300, class: 'cust-preview' });
    const rows = h('div', { class: 'cust-rows' });
    const pick = (label, items, key) => h('div', { class: 'cust-row' }, h('b', {}, label),
      h('div', { class: 'cust-chips' }, ...items.map(([v, name, col]) => h('button', {
        class: `cust-chip${cu[key] === v ? ' on' : ''}${col ? ' col' : ''}`, style: col ? `--cc:${col}` : '',
        onclick: () => { cu[key] = v; paintRows(); } }, col ? h('i') : null, name ? h('span', {}, name) : null))));
    // v306 차림 — 한 번에 어울리게. 고른 뒤 아래에서 하나씩 바꿀 수 있다
    const presetOn = (p) => cu.head === p.head && (cu.hat || null) === p.hat && (cu.face || null) === p.face && cu.robe === p.robe && cu.band === p.band && (cu.boot || null) === p.boot && (cu.gender || null) === (p.gender || null) && (cu.fhead || null) === (p.fhead || null);
    const presets = () => h('div', { class: 'cust-row' }, h('b', {}, '차림'),
      h('div', { class: 'cust-chips' }, ...W.CUSTOM_PRESETS.map((p) => h('button', { class: `cust-chip preset${presetOn(p) ? ' on' : ''}`, style: `--cc:${p.robe}`,
        onclick: () => { cu.head = p.head; cu.hat = p.hat; cu.face = p.face; cu.robe = p.robe; cu.band = p.band; cu.boot = p.boot; cu.gender = p.gender || null; cu.fhead = p.fhead || null; cu.hair = p.hair || null; paintRows(); } }, h('i'), h('span', {}, p.name)))));
    // v323 머리·쓰개·눈·도포·띠·신발 — 쓰개는 머리와 따로(삿갓은 어느 머리에나 얹는다)
    // v325 칸 셋 — 모습 · 무기 · 기믹
    const ctabs = () => h('div', { class: 'cust-tabs' }, ...[['look', '모습'], ['wpn', '무기'], ['fx', '기믹']].map(([k, n]) => h('button', { class: `item-tab${ctab === k ? ' on' : ''}`, onclick: () => { ctab = k; paintRows(); } }, n)));
    const wpnRow = () => h('div', { class: 'cust-row' }, h('b', {}, `${jobOf(game.s.job)?.name || ''}의 무기`),
      h('div', { class: 'cust-chips' }, ...[[null, '기본'], ...(W.WEAPON_SKINS[jl] || []).map((x) => [x.id, x.name])].map(([v, name]) => h('button', {
        class: `cust-chip${(cu.wpn[jl] || null) === v ? ' on' : ''}`, onclick: () => { if (v) cu.wpn[jl] = v; else delete cu.wpn[jl]; paintRows(); } }, h('span', {}, name)))));
    const paintRows = () => rows.replaceChildren(...(ctab === 'wpn' ? [ctabs(), wpnRow(), h('p', { class: 'muted', style: 'font-size:11.5px' }, '무기 모양은 직업마다 따로 기억해요 — 겉모습만 바뀌고 능력치는 그대로예요.')]
      : ctab === 'fx' ? [ctabs(),
        pick('기운', [[null, '없음'], ...W.CUSTOM_AURAS.map(([k, n]) => [k, n])], 'aura'),
        pick('발밑 문양', [[null, '없음'], ...W.CUSTOM_RINGS.map(([k, n]) => [k, n])], 'ring'),
        pick('칼빛', [[null, '장비 따라'], ...W.CUSTOM_GLOWS.map((c) => [c, null, c])], 'glow')]
      : [ctabs(),
        presets(),
        pick('성별', W.CUSTOM_GENDERS.map(([k, n]) => [k === 'm' ? null : k, n]), 'gender'),
        ...(cu.gender === 'f'
          ? [pick('머리', [[null, '기본(긴 생머리)'], ...W.CUSTOM_FHEADS.map(([k, n]) => [k, n])], 'fhead'), pick('머리 빛깔', W.CUSTOM_HAIRS.map(([k, , c]) => [k === 'black' ? null : k, null, c]), 'hair')]
          : [pick('머리', [[null, '기본'], ...W.CUSTOM_HEADS.map(([k, n]) => [k, n])], 'head')]),
        pick('쓰개', [[null, '없음'], ...W.CUSTOM_HATS.map(([k, n]) => [k, n])], 'hat'),
        pick('눈 · 얼굴', [[null, '기본'], ...W.CUSTOM_FACES.map(([k, n]) => [k, n])], 'face'),
        pick('도포', [[null, '기본'], ...W.CUSTOM_ROBES.map((c) => [c, null, c])], 'robe'),
        pick('띠 · 리본 · 소맷단', [[null, '기본(안대 색도)'], ...W.CUSTOM_BANDS.map((c) => [c, null, c])], 'band'),
        pick('신발', [[null, '기본'], ...W.CUSTOM_BOOTS.map((c) => [c, null, c])], 'boot')]));
    paintRows();
    const finish = () => {
      game.s.custom = { head: cu.head || null, hat: cu.hat || null, robe: cu.robe || null, band: cu.band || null, face: cu.face || null, boot: cu.boot || null,
        gender: cu.gender || null, fhead: cu.fhead || null, hair: cu.hair || null, wpn: { ...cu.wpn }, aura: cu.aura || null, ring: cu.ring || null, glow: cu.glow || null };
      save(); portraitSig = ''; refreshUI(true);
      closeModal();
      toast(first ? '강호에 나섰어요 — 지도에서 사냥터를 골라요 (왼쪽 위 얼굴을 누르면 다시 꾸밀 수 있어요)' : '모습을 바꿨어요');
    };
    // v323 돌려보기 · 자세
    const stageBtns = h('div', { class: 'cust-stage-btns' },
      h('button', { class: 'btn', onclick: () => { flip = !flip; } }, '↔ 돌려보기'),
      h('button', { class: 'btn', onclick: (e) => { pose = pose === 'stand' ? 'attack' : pose === 'attack' ? 'run' : 'stand'; e.target.textContent = pose === 'stand' ? '서기' : pose === 'attack' ? '공격' : '달리기'; } }, '서기'));
    s.append(...[
      h('h2', {}, first ? '모습을 꾸며요' : '꾸미기'),
      h('p', { class: 'muted' }, first ? '나중에 왼쪽 위 얼굴을 눌러 언제든 바꿀 수 있어요.' : '\'기본\'은 경지·장비에 따라 바뀌어요. 고른 것은 장비 겉모습보다 먼저예요.'),
      h('div', { class: 'cust-stage' }, cv, stageBtns),
      rows,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { cu.head = cu.hat = cu.robe = cu.band = cu.face = cu.boot = cu.gender = cu.fhead = cu.hair = cu.aura = cu.ring = cu.glow = null; cu.wpn = {}; paintRows(); } }, '기본으로'),
        !first ? h('button', { class: 'btn', onclick: closeModal }, '그만두기') : null,
        h('button', { class: 'btn primary cust-go', onclick: finish }, first ? '이대로 시작' : '이대로')),
    ].filter(Boolean));
    // 미리보기 — 고른 것을 잠깐 입혀 그린다(세이브에는 '이대로'를 눌러야 들어간다)
    const tick = () => {
      if (!cv.isConnected || !modalOpen()) return;
      const real = game.s.custom;
      game.s.custom = cu;
      const { look, opts } = view.heroLook(game, pose === 'run');
      game.s.custom = real;
      const c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(2.2, 0, 0, 2.2, 0, 0);
      const tt = performance.now() / 1000;
      const lunge = pose === 'attack' ? 0.35 + Math.abs(Math.sin(tt * 2.5)) * 0.5 : 0;
      drawFighter(c, 68, 128, { ...look, swords: 0, halo: false, wings: false }, { ...opts, t: tt, flip, turn: null, run: pose === 'run', lunge });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { dismissable: !first });
}

// ---------- 사건 ----------
function handleEvents() {
  for (const ev of game.events) {
    view.handle(ev, game);
    // 소리 (타격감) — 광역기 수십 대는 sfx가 간격을 둬서 몇 번만 난다
    switch (ev.type) {
      case 'attack': sfx('swish'); coop.noteAttack(); break;
      case 'dmg': sfx('hit', ev.crit > 0); break;
      case 'skill': sfx('skill'); coop.noteAttack(); break;
      case 'kill': sfx('kill'); break;
      case 'levelUp': sfx('level'); break;
      case 'path': sfx('level'); break;   // v254 길을 고르면(받는 쪽이 없었다)
      case 'craft': case 'sweep': sfx('loot'); break;
      case 'potion': sfx('potion'); break;
      case 'heroHit': sfx('hurt'); break;
      case 'heal':
        if (ev.amount >= 1) view.float(`+${fmt(ev.amount)}`, view.heroX, view.groundY - 140, '#86efac', 18, 1);
        break;
      case 'heroDied': sfx('down'); break;
      case 'bossAppear': sfx(ev.king && ev.full ? 'king' : 'boss'); break;
      default:
    }
    switch (ev.type) {
      case 'levelUp': {
        // 알림은 한 줄로 모은다 — 레벨 15에 세 개가 한꺼번에 쌓여 들판을 가렸다
        if (!game.s.autoStat) view.float(`스탯 +${W.STAT_PER_LEVEL}`, view.heroX + 26, view.groundY - 175, '#fde68a', 16, 1.3);
        const parts = [];
        if (W.TIERS.some((t) => t && t.level === ev.level)) parts.push('전직할 수 있어요(무공 바의 전직 단추)');
        // 새 지역(1구역)이 열릴 때만 알린다 — 구역마다 알리면 두 레벨마다 뜬다
        const opened = W.MAPS.find((m) => m.area === 1 && m.lv[0] === ev.level);
        if (opened) parts.push(opened.king ? `십이지왕 ${opened.zoneName}의 영역이 열렸어요` : `새 사냥터 ${opened.zoneName}`);
        if (parts.length || ev.level % 5 === 0 || ev.level <= 5) toast([`레벨 ${ev.level}!`, ...parts].join(' · '));
        // v263 창이 열리는 레벨 — 띠와 단추 반짝임
        for (const [k, lv] of Object.entries(TAB_LV)) if (ev.level === lv) {
          view.showBanner(`${TAB_NAME[k]} 창이 열렸어요`, '#fde68a', 1.8, '열림');
          const b = document.querySelector(`#tabs button[data-tab="${k}"]`);
          if (b) { b.classList.remove('just-open'); void b.offsetWidth; b.classList.add('just-open'); }
        }
        paintTabLocks();
        drawPortrait();
        break;
      }
      case 'kill':
        // v321 두목을 잡을 때마다 알림이 뜨던 것을 한 줄 모음으로 — 두목 ×12 · 현철 ×480 · 증표 ×12
        if (ev.mat?.boss) { tally('boss', '⚔ 두목', 1, '#fca5a5'); tally('ore', ev.mat.name, ev.mat.n, ev.mat.color || '#e5e7eb'); tally('mark:' + ev.mat.boss, ev.mat.boss, ev.mat.markN || 1, '#fde68a'); saverLoot('boss', '⚔ 두목 처치', 1); saverLoot('ore:' + ev.mat.name, ev.mat.name, ev.mat.n); saverLoot('mark:' + ev.mat.boss, ev.mat.boss, ev.mat.markN || 1); }
        break;
      case 'equip':
        drawPortrait();
        break;
      case 'craft':
        if (ev.item.step % 2 === 1) net.announce(`⚒ ${game.s.nickname}님이 〈${itemTitle(game, ev.item)}〉을(를) 조합했어요`);
        toast(`조합 성공! ${itemTitle(game, ev.item)}`);
        view.showBanner(itemTitle(game, ev.item), W.GRADES[ev.item.grade].color, 1.4, '조합');
        break;
      case 'bossAppear':
        // 십이지왕은 전용 등장 연출, 다른 두목은 먹띠 한 줄
        if (ev.king) view.startKingIntro(ev.king, ev.at, ev.full);
        else view.startBossIntro(ev, ev.at, ev.full);
        break;
      case 'petLost': {
        const d = W.petOf(ev.pet.kind);
        toast(ev.swapped ? `우리가 가득 차 가장 약한 ${W.RARITY[ev.pet.rar].name} ${d.name}을(를) 놓아줬어요` : `우리가 가득 차 ${W.RARITY[ev.pet.rar].name} ${d.name}을(를) 놓쳤어요 — 동료 창에서 우리를 비워 주세요`);
        break;
      }
      case 'petDrop': {
        const d = W.petOf(ev.pet.kind);
        saverLoot(`pet:${ev.pet.rar}:${d.name}`, `🐾 ${W.RARITY[ev.pet.rar].name} ${d.name}`);
        const pq = W.PET_QUAL[ev.pet.q || 0];   // v316 품
        toast(`${pq.id ? `${pq.mark} ${pq.name} ` : ''}${W.RARITY[ev.pet.rar].name} 애완동물 ${d.name}(순위 ${d.tier})! ${ev.joined ? '데려갔어요' : '우리에서 기다려요(동료 창)'}`);
        view.showBanner(pq.id ? `${pq.name} ${d.name}` : d.name, pq.id ? pq.col : W.RARITY[ev.pet.rar].color, pq.id ? 2.4 : 1.6, '동료');
        if (pq.id) view.float(pq.id === 2 ? '天品!' : '極品!', view.heroX, view.groundY - 200, pq.col, pq.id === 2 ? 28 : 22, 2);
        if (pq.id === 2) net.announce(`✦ ${game.s.nickname}님이 천품(天品) ${d.name}을(를) 얻었어요!`);
        sfx('loot');
        break;
      }
      // v292 두목이 떨군 조각 · 별 · 도감 이정표
      case 'shards':
        if (ev.pet) tally('ps', '🐾 포획 조각', ev.pet, '#fcd34d');   // v321 들판 글자 대신 모음
        if (ev.mount) tally('ms', '🐎 탈것 조각', ev.mount, '#fcd34d');
        break;
      // v316 단 수련 · 품 물려받기
      case 'petDan': {
        const d = W.petOf(ev.pet.kind);
        if (!ev.ok) { toast(`${d.name} 수련 실패 — 혼은 썼지만 다음 확률이 올라요(${Math.round(W.petDanChance(ev.pet.dan || 0, ev.pet.danFail) * 100)}%)`); sfx('down'); break; }
        if (ev.great) { view.float('大成!', view.heroX, view.groundY - 200, '#fcd34d', 28, 2); sfx('level'); }
        toast(`${ev.great ? '大成! ' : ''}${d.name} ${ev.pet.dan}단 — 버프·공격 +${Math.round(ev.pet.dan * W.PET_DAN_K * 100)}%`);
        if (ev.pet.dan >= W.PET_DAN_MAX) net.announce(`🐾 ${game.s.nickname}님의 ${d.name}이(가) ${W.PET_DAN_MAX}단에 올랐어요!`);
        break;
      }
      // v316 주간 두목 — 화무기·마귀 이번 주 최단
      case 'wbossBest': {
        const nm = ev.id === 'magwi' ? '마귀' : '화무기';
        toast(`⏱ 이번 주 ${nm} 최단 ${fmtSec(ev.sec)}${ev.prev ? ` (전 ${fmtSec(ev.prev)})` : ''} — 무림 › 서열 › 이번 주 두목`);
        net.pushWeekBoss?.(true);
        break;
      }
      // v318 지난주 순위 보상 · 기한이 지난 칭호
      case 'weekReward': toast(`🏆 지난주 ${ev.best}위 보상 — 혼 ${ev.soul} · 조각 ${ev.shard} · 은자 ${fmt(ev.gold)}${ev.title ? ` · 〈${W.titleOf(ev.title).name}〉` : ''}`); sfx('level'); break;
      case 'titleExpire': toast(`〈${ev.name}〉 칭호의 기한이 끝났어요`); break;
      case 'attend': toast(`📅 출석 ${ev.day}일째 — ${ev.reward.gold ? `은자 ${fmt(ev.reward.gold)}` : ''}${ev.reward.gold && ev.reward.text !== '은자' ? ' · ' : ''}${ev.reward.text !== '은자' ? ev.reward.text : ''}`); sfx('loot'); break;
      case 'autoJunk': tally('junk', '🧹 자동 정리', 1, '#a8a29e'); break;   // v321
      case 'jobChange': toast(`${W.classOf(ev.job)?.name || ev.job}(으)로 바꿨어요${ev.back ? ` — 무공 점수 ${ev.back}점을 돌려받았어요` : ''}`); lastSig = ''; drawPortrait(); break;
      case 'petQualUp': toast(`${W.PET_QUAL[ev.pet.q].mark} ${W.petOf(ev.pet.kind).name} — 먹이의 품을 물려받아 ${W.PET_QUAL[ev.pet.q].name}이 됐어요`); break;
      case 'petStar':
        toast(`★ ${W.petOf(ev.pet.kind).name} 별 ${ev.pet.star} — 버프·공격 +${Math.round(ev.pet.star * W.PET_STAR_K * 100)}%`);
        break;
      case 'dexGoal':
        toast(`📖 도감 ${ev.goal.text} 달성 — ${[ev.goal.soul ? `혼 ${ev.goal.soul}` : '', ev.goal.petShard ? `포획 조각 ${ev.goal.petShard}` : '', ev.goal.mountShard ? `탈것 조각 ${ev.goal.mountShard}` : ''].filter(Boolean).join(' · ')}`);
        break;
      case 'petLevel':
        view.float(`${W.petOf(ev.pet.kind).name} Lv.${ev.pet.lv}`, view.heroX - 50, view.groundY - 120, '#86efac', 14, 1.1);
        break;
      case 'mountDrop': {
        const d = W.mountOf(ev.mount.kind);
        saverLoot(`mount:${d.name}`, `🐎 ${d.name}`);
        toast(d.zodiac ? `🎉 십이지 신수 ${d.name}! 이동 +${Math.round(d.speed * 100)}% · 공격·체력 +${Math.round(d.stat * 100)}%` : `탈것 ${d.name}(순위 ${d.tier})! 이동 속도 +${Math.round(d.speed * 100)}%`);
        view.showBanner(d.name, d.zodiac ? '#f472b6' : '#fde68a', d.zodiac ? 2.6 : 1.8, d.zodiac ? '십이지 신수' : '탈것');
        sfx('loot');
        break;
      }
      case 'passive': {
        const T = { combo: ['유혼!', '#fca5a5'], dodge: ['흘림', '#c4b5fd'], revive: ['천혼!', '#86efac'], harmony: ['삼공조화!', '#d8b4fe'] };
        const t = T[ev.id];
        if (t) view.float(t[0], view.heroX + 28, view.groundY - 170, t[1], ev.id === 'harmony' ? 20 : 16, 0.9);
        // 일화: 꽃잎 검기 · 공포: 머뭇거린 적 위에 표 (v118)
        if (ev.id === 'flower' && ev.at && view.fxLevel > 0) {
          view.effects.push({ kind: 'shock', life: 0.35, max: 0.35, wx: ev.at.x, wy: ev.at.y, r: 70, col: '249,168,212', rings: 2, w: 3 });
          view.effects.push({ kind: 'bloom', life: 0.5, max: 0.5, wx: ev.at.x, wy: ev.at.y, r: 26, oy: -55, col: '251,207,232' });
        }
        // 투신일격 — 권마 다섯 번째 평타
        if (ev.id === 'tusin' && ev.at && view.fxLevel > 0) {
          view.effects.push({ kind: 'shock', life: 0.45, max: 0.45, wx: ev.at.x, wy: ev.at.y, r: 120, col: '253,224,71', rings: 2, w: 6 });
          view.effects.push({ kind: 'flare', life: 0.25, max: 0.25, wx: ev.at.x, wy: ev.at.y, r: 60, col: '245,158,11' });
          view.shake = Math.max(view.shake, 0.18);
          view.float('투신!', view.sx(ev.at), view.sy(ev.at) - 120, '#fde68a', 16, 0.7);
        }
        if (ev.id === 'fear' && ev.at) view.float('움찔', view.sx(ev.at), view.sy(ev.at) - 96, '#d8b4fe', 13, 0.6);
        if (ev.id === 'harmony') view.effects.push({ kind: 'pillar', life: 1, max: 1 });
        // 무형검결: 보이지 않는 검이 한 번 더 (v130)
        if (ev.id === 'formless' && ev.at && view.fxLevel > 0) {
          view.effects.push({ kind: 'cutline', life: 0.3, max: 0.3, wx: ev.at.x, wy: ev.at.y, a: Math.random() * 3 });
          view.effects.push({ kind: 'flare', life: 0.22, max: 0.22, wx: ev.at.x, wy: ev.at.y, r: 50, col: '253,230,138' });
        }
        break;
      }
      // 스킬 변화 옵션 (v130) — 화염·빙결·뇌전·거대화·응축이 연출에도 보인다
      case 'stone':
        tally('stone:' + ev.key, W.matName(ev.key), ev.n, '#f0abfc');   // v321 모음
        break;
      case 'tfHit': {
        if (view.fxLevel <= 0 || !ev.at) break;
        const a = ev.at;
        if (ev.tf === 'fire') {
          view.effects.push({ kind: 'shock', life: 0.4, max: 0.4, wx: a.x, wy: a.y, r: 60, col: '251,146,60', rings: 2, w: 4 });
          view.effects.push({ kind: 'flare', life: 0.3, max: 0.3, wx: a.x, wy: a.y, r: 46, col: '249,115,22' });
          for (let i = 0; i < 6; i++) view.particles.push({ x: view.sx(a) + (Math.random() - 0.5) * 30, y: view.sy(a) - 30, vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 80, life: 0.6, size: 3 + Math.random() * 3, color: i % 2 ? 'rgb(251,146,60)' : 'rgb(253,224,71)' });
        } else if (ev.tf === 'ice') {
          view.effects.push({ kind: 'shock', life: 0.45, max: 0.45, wx: a.x, wy: a.y, r: 54, col: '186,230,253', rings: 3, w: 3 });
          view.effects.push({ kind: 'flare', life: 0.35, max: 0.35, wx: a.x, wy: a.y, r: 40, col: '224,242,254' });
          view.float('얼음', view.sx(a), view.sy(a) - 100, '#bae6fd', 13, 0.6);
        } else if (ev.tf === 'thunder' && ev.to) {
          view.effects.push({ kind: 'lance', life: 0.18, max: 0.18, wx: a.x, wy: a.y, a: Math.atan2((ev.to.y - a.y) * view.squash, ev.to.x - a.x), len: Math.hypot(ev.to.x - a.x, (ev.to.y - a.y) * view.squash), w: 4, col: '253,224,71', oy: -50 });
          view.effects.push({ kind: 'flare', life: 0.2, max: 0.2, wx: ev.to.x, wy: ev.to.y, r: 40, col: '254,240,138' });
        } else if (ev.tf === 'giant') {
          view.effects.push({ kind: 'shock', life: 0.6, max: 0.6, wx: a.x, wy: a.y, r: 260, col: '216,180,254', rings: 3, w: 6 });
        } else if (ev.tf === 'focus') {
          view.effects.push({ kind: 'flare', life: 0.35, max: 0.35, wx: a.x, wy: a.y, r: 70, col: '248,113,113' });
        }
        break;
      }
      case 'promote':
        sfx('loot');
        drawPortrait();
        break;
      case 'infuse': {
        if (ev.ok !== false) { sfx('loot'); drawPortrait(); }
        // v298 대성 — 무인 위로 크게 · 천품 — 무림 소식
        if (ev.gs) { sfx('level'); view.float(`大成 · ${IM.GS_KIND[ev.gs]} ×${1 + IM.gsOf(ev.item.imps?.[ev.slot]).filter((k) => k === ev.gs).length}`, view.heroX, view.groundY - 210, '#fcd34d', 24, 1.6); }
        const ne = ev.ok && !ev.dan && !ev.reimp && !ev.kept ? ev.item.imps?.[0] : null;   // v307 한 칸
        if (ne && (ne.q | 0) === 2) { sfx('level'); view.float('天品!', view.heroX, view.groundY - 210, '#fcd34d', 28, 2); net.announce(`✦ ${game.s.nickname}님의 〈${itemTitle(game, ev.item)}〉에 천품(天品) 각인이 새겨졌어요!`); }
        else if (ne && (ne.q | 0) === 1) view.float('極品', view.heroX, view.groundY - 190, '#c4b5fd', 20, 1.2);
        if (ev.type === 'infuse' && ev.ok && ev.item.rar >= 2 && !ev.reimp && !ev.fill && !ev.dan && !ev.rewrite) net.announce(`✦ ${game.s.nickname}님의 〈${itemTitle(game, ev.item)}〉에 ${W.RARITY[ev.item.rar].name} 등급이 새겨졌어요`);
        break;
      }
      case 'title': {   // v305 칭호를 받았다
        sfx('level');
        view.float(`〈${ev.name}〉`, view.heroX, view.groundY - 210, W.titleOf(ev.id)?.col || '#fde68a', 24, 2);
        toast(`🏷 칭호 〈${ev.name}〉을(를) 받았어요 — 캐릭터 창에서 끼고 벗어요`);
        if (ev.auto) net.announce(`🏷 ${game.s.nickname}님이 칭호 〈${ev.name}〉을(를) 얻었어요 — ${W.titleOf(ev.id)?.how || ''}`);   // v307
        drawPortrait();
        break;
      }
      case 'resonance': {
        // v297 공명 단계가 오르면 무인 위로 크게 · 내려가면 조용히 알린다
        const th = IM.THEMES[ev.theme];
        if (ev.up) {
          sfx('level');
          view.float(`${th.name} 공명 ${IM.RES_ROMAN[ev.tier]}`, view.heroX, view.groundY - 210, th.col, 24, 1.6);
          toast(`✦ ${th.name} 공명 ${IM.RES_ROMAN[ev.tier]} — ${th.name} 기운 +${Math.round(IM.RES_BONUS[ev.tier].fx * 100)}% · 공격력·체력 +${Math.round(IM.RES_BONUS[ev.tier].atkPct * 100)}%`);
        } else toast(ev.tier >= 0 ? `${th.name} 공명이 ${IM.RES_ROMAN[ev.tier]}(으)로 내려갔어요 (${ev.n}칸)` : `${th.name} 공명이 풀렸어요 (${ev.n}칸)`);
        break;
      }
      case 'echo':
        view.float('한 번 더!', view.heroX, view.groundY - 190, '#f9a8d4', 18, 1);
        break;
      case 'drop':
        tally('drop', `🗡 두목 장비`, 1, W.RARITY[ev.item.rar || 0].color);   // v324 모음에도
        toast(`두목이 장비를 떨궜어요! ${W.RARITY[ev.item.rar || 0].name} ${itemTitle(game, ev.item)}`);
        saverLoot(`drop:${ev.item.rar || 0}`, `🗡 ${W.RARITY[ev.item.rar || 0].name} 두목 장비`);
        sfx('loot');
        break;
      case 'heroDied':
        if (!ev.inst) toast(`쓰러졌어요… 경험치 ${fmt(ev.loss)}을 잃고 마을로 돌아가요${ev.retreat ? ` — 너무 센 곳이라 다음엔 ${ev.retreat}(으)로 나가요` : ''}`);
        break;
      // v263: 견문록 낙관
      case 'dexStamp': toast(`견문록 — ${ev.name} 낙관 · 공격력·체력 +${(W.DEX_STAMP_STAT * 100).toFixed(2)}%${ev.zoneDone ? ` · 지역 완성! 경험치 +0.5% · 공격력·체력 +${(W.DEX_ZONE_STAT * 100).toFixed(1)}%` : ''}`); break;
      case 'frag': if (ev.pts) toast(`📜 무공 비급 완성 — 무공 점수 +${ev.pts}`); else if (ev.at) tally('frag', `📜 비급 조각 ${ev.have}/${W.fragNeed(game.s.fragPts)} ·`, 1, '#c4b5fd');   // v321 조각마다 알림 → 모음 if (ev.at) saverLoot(`📜 비급 조각 ${ev.have}/${W.fragNeed(game.s.fragPts)}`); break;
      // v263: 깨달음 점수
      case 'temper': toast(`🔨 단련 ${ev.lv}단계${ev.n > 1 ? ` (+${ev.n})` : ''} — 공격력·체력 +${(ev.lv * W.TEMPER_STEP * 100).toFixed(1)}%`); break;
      case 'enlight': toast(`깨달음 +${ev.got} — 무공 창에서 올려요 (가진 것 ${ev.pts})`); break;
      // v262: 비무 별
      case 'duelStar':
        toast(`★ ${ev.title} ${ev.name} — ${[ev.fast ? '빠르게 이김' : '', ev.clean ? '초식에 안 맞고 이김' : ''].filter(Boolean).join(' · ')} · 영구 덤이 늘었어요`);
        sfx('loot');
        break;
      // v262: 오늘의 강호 과제를 받았다(누른 자리에서 알린다)
      case 'todayDone': sfx('loot'); break;
      // v262: 자동 강화·각인 — 몇 번 했는지 짧게(결과는 강화 연출 없이)
      case 'autoGear':
        if (ev.enh + ev.inf + (ev.dan || 0) >= 1) toast(`자동${ev.enh ? ` 강화 ${ev.enh}번` : ''}${ev.inf ? ` · 등급 각인 ${ev.inf}번` : ''}${ev.dan ? ` · 칸 단 올리기 ${ev.dan}번` : ''}${ev.gs ? ` · 大成 ${ev.gs}번!` : ''}`);
        break;
      // v260: 알맞은 사냥터 따라가기
      case 'followMap':
        toast(`레벨이 올라 ${ev.name}(으)로 옮겨요`);
        break;
      // 길잡이 한 단계 — 띠로 알린다(받았다는 글은 누른 자리에서 띄운다)
      case 'quest':
        view.showBanner(`길잡이 ✓ ${ev.title}`, '#bbf7d0', 1.8, '길잡이');
        sfx('loot');
        break;
      // 고수를 처음 쓰러뜨렸다 (v148)
      case 'masterDown':
        view.showBanner(`${ev.title} ${ev.name} 격파`, '#fde68a', 2.4, '고수');
        toast(`⚔ ${ev.title} ${ev.name}을(를) 처음 쓰러뜨렸어요 — 공격력·체력 +${Math.round(ev.bonus * 100)}% 영구 · ${rewardText(ev.reward)}`);
        break;
      // 길잡이 선물 (v146) — 해 봐야 하는 것을 그 단계가 뜰 때 준다
      case 'questGift':
        toast(`🎁 길잡이 선물: ${ev.what} — ${ev.title}`);
        break;
      case 'advance': {
        view.showBanner(`${ev.tier}차 전직 · ${game.tierName()}`, '#fde68a', 2.4, '전직');
        net.announce(`🎉 ${game.s.nickname}님이 ${ev.tier}차 전직 — ${game.tierName()}`);
        view.effects.push({ kind: 'pillar', life: 1.6, max: 1.6 });
        const sk = W.skillsOf(game.s.job).find((k) => k.tier === ev.tier);
        toast(`새 스킬 〈${sk.name}〉 — ${skillText(game, sk)}`);
        drawPortrait();
        save();
        break;
      }
      case 'mapEnter':
        view.showBanner(ev.name, ev.inst ? '#fde68a' : '#fef3c7', 1.3);
        break;
      case 'mastery':
        toast(`${ev.name} 숙련 ${ev.level}! 경험치·재료가 늘고 · 공격력·체력 +${(W.MAST_STAT * 100).toFixed(2)}%(영구)`);
        break;
      case 'treasure':
        view.showBanner('황금 원숭이 출현!', '#fde047', 1.6, '보물');
        sfx('boss');
        break;
      case 'treasureGone':
        toast('황금 원숭이가 달아났어요…');
        break;
      case 'treasureKill':
        toast(`🐒 황금 원숭이를 잡았다! 은자 ${fmt(ev.gold)}${Object.keys(ev.mats).length ? ` · ${rewardText({ mats: ev.mats })}` : ''}`);
        view.effects.push({ kind: 'shock', life: 0.6, max: 0.6, wx: ev.at.x, wy: ev.at.y, r: 140, col: '253,224,71', rings: 3, w: 5 });
        sfx('loot');
        break;
      case 'zodiacDraw':
        if (!ev.zodiac) toast(`${D.ZODIAC[ev.no - 1].animal} 뽑기 — 신수는 아니었어요${game.zodiacOwned(ev.no) ? '' : ` (${D.ZODIAC_TICKETS}번째에는 꼭 나와요)`}`);
        break;
      case 'instEnd':
        showInstEnd(ev);
        save();
        break;
      case 'hpCost':
        // 체력을 대가로 낸 스킬 — 무인 머리 위에 붉게
        view.float(`-${fmt(ev.amount)}`, view.heroX - 24, view.groundY - 150, '#f87171', 15, 0.9);
        break;
      case 'potion':
        view.float('+물약', view.heroX + 20, view.groundY - 150, '#86efac', 15, 0.9);
        break;
      case 'enhance':
        break;
      default:
    }
  }
  game.events.length = 0;
}

// 남은 스탯 점수 알약을 누르면 캐릭터 창
// v314 낮은 사냥터 알림 — 누르면 알맞은 사냥터로(갈 곳이 없으면 지도)
$('exp-warn').addEventListener('click', () => {
  const to = $('exp-warn')._to;
  if (to && game.enterMap(to)) { toast(`${W.mapOf(to).name}으로 왔어요 — 경험치가 제대로 들어와요`); save(); refreshUI(true); return; }
  showTab('map');
});
$('advice').addEventListener('click', () => showTab('char', game.s.statPts > 0 && !game.s.autoStat ? 'stat' : 'skill'));
// 길잡이 — 끝냈으면 받고, 아니면 할 자리를 열어 준다
$('quest').addEventListener('click', () => {
  const cur = game.questNow();
  if (!cur) return;
  if (!cur.done) {
    // 던전은 지도 창 안의 칸이다
    if (cur.q.tab) { const [t, sub] = cur.q.tab.split('/'); showTab(t, sub); }
    toast(cur.q.why);
    return;
  }
  const got = game.claimQuest();
  save();
  refreshUI(true);
  toast(`길잡이 — ${cur.q.title} ✓ ${rewardText(got)}`);
});

// 사냥터 이름을 누르면 지도
$('stagebar').addEventListener('click', () => showTab('map'));

// ---------- 들판을 눌러 움직이기 ----------
// 톡 누르면 그 칸으로 · 누른 채 끌면 그 자리에 조이스틱이 나와 끄는 쪽으로 계속 걷는다(v125).
// 손을 떼면 0.8초 뒤 자동 사냥으로 돌아간다. 마을에서는 사람을 누르면 그 창.
const joyEl = h('div', { id: 'joy', class: 'hidden' }, h('div', { class: 'joy-knob' }));
$('battle').append(joyEl);
let press = null;   // { id, x, y, t, drag }
function fieldPoint(e) {
  const r = $('cv').getBoundingClientRect();
  const z = view.zoom || 1;    // 카메라를 물렸으면 화면 1px가 들판 1/z
  const px = e.clientX - r.left, py = e.clientY - r.top;
  return { px, py, wx: game.heroX + (px / z - view.heroX), wy: game.heroY + (py / z - view.groundY) / view.squash };
}
function tapAt(e) {
  const { wx, wy } = fieldPoint(e);
  if (game.map.town) {
    // 대장장이를 누르면 가방(조합), 다른 사람이면 마을 창
    let near = null;
    for (const m of game.mons) if (m.npc && (!near || Math.hypot(m.x - wx, m.y - 40 - wy) < Math.hypot(near.x - wx, near.y - 40 - wy))) near = m;
    const [t, sub] = (near && Math.hypot(near.x - wx, near.y - 40 - wy) < 70 && near.tab ? near.tab : 'town').split('/');
    showTab(t, sub);
    return;
  }
  game.moveTo(wx, wy);
  view.effects.push({ kind: 'shock', life: 0.35, max: 0.35, wx, wy, r: 22, col: '253,224,71', rings: 1, w: 3 });
}
$('cv').addEventListener('pointerdown', (e) => {
  if (modalOpen() || !e.isPrimary) return;
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
  try { $('cv').setPointerCapture(e.pointerId); } catch { /* 무시 */ }
});
$('cv').addEventListener('pointermove', (e) => {
  if (!press || e.pointerId !== press.id || game.map.town) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  const d = Math.hypot(dx, dy);
  if (!press.drag && d < 14) return;
  if (!press.drag) {
    press.drag = true;
    const br = $('battle').getBoundingClientRect();
    joyEl.style.left = `${press.x - br.left}px`;
    joyEl.style.top = `${press.y - br.top}px`;
    joyEl.classList.remove('hidden');
  }
  const R = 42;
  const k = Math.min(1, R / Math.max(1, d));
  joyEl.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  game.joy = d > 14 ? { dx, dy } : null;
});
function endPress(e) {
  if (!press || e.pointerId !== press.id) return;
  if (!press.drag && e.type === 'pointerup') tapAt(e);
  game.joy = null;
  joyEl.classList.add('hidden');
  press = null;
}
$('cv').addEventListener('pointerup', endPress);
$('cv').addEventListener('pointercancel', endPress);

// ---------- 처음 시작 ----------
function askNickname(first = false) {
  openModal((s) => {
    const input = h('input', { class: 'field', maxlength: 10, placeholder: '2~10글자', value: game.s.nickname || '' });
    const ok = h('button', { class: 'btn primary', style: 'width:100%;margin-top:10px' }, first ? '시작하기' : '바꾸기');
    const submit = () => {
      const name = input.value.trim();
      if (name.length < 2) return toast('2글자 이상이에요');
      game.s.nickname = name;
      save();
      closeModal();
      net.pushProfile(true);
      // v259: 문파 문원 명단의 이름도 바꾼다(전엔 옛 이름이 남았다)
      if (net.guild?.id && net.online) net.fs.updateDoc(net.ref('guilds', net.guild.id), { [`members.${net.uid}`]: name }).catch(() => {});
      refreshUI(true);
      return undefined;
    };
    ok.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    s.append(h('h2', {}, first ? '방치형키우기' : '이름 바꾸기'),
      ...(first ? [h('p', { class: 'muted' }, game.s.legacyNote
        ? '무림이 새로 열렸어요! 마을에서 시작해 사냥터를 돌며 강해지는 판이에요. 옛 판에서 오신 분께는 칭호 〈개국공신〉과 은자 2,000을 드려요.'
        : '강호에서 불릴 이름을 정해 주세요.')] : []),
      input, ok);
    setTimeout(() => input.focus(), 50);
  }, { dismissable: !first, onClose: first ? () => (game.s.job ? checkReturn() : askClass()) : null });
}

function askClass() {
  openModal((s) => {
    const grid = h('div', { class: 'class-grid' });
    const anims = [];
    for (const j of JOBS) {
      const cv = h('canvas', { width: 140, height: 150 });
      anims.push({ cv, j });
      grid.append(h('button', { class: 'class-card', style: `border-color:${j.color}`, onclick: () => {
        if (!game.setJob(j.id)) return;
        game.s.potions += 20;
        save(); closeModal(); refreshUI(true);
        net.pushProfile(true);
        openCustom(true);   // v280 고른 뒤 꾸미기
      } }, cv, h('div', { class: 'cc-txt' },
        h('b', { style: `color:${j.color}` }, j.name),
        h('small', {}, `${j.weapon}${j.range ? ' · 멀리서' : ''}`),
        W.LORE[j.id] ? h('span', { class: 'lore-line' }, `${W.LORE[j.id].house} · ${W.LORE[j.id].title}의 길`) : null,
        h('span', { class: 'desc' }, W.CLASSES[j.id].trait))));
    }
    s.append(h('h2', {}, '캐릭터를 고르세요'),
      h('p', { class: 'muted' }, `레벨 ${W.TIERS.slice(1, 5).map((t) => t.level).join('·')}에 전직하면 스킬을 하나씩 배워요.`), grid,
      // v291 직업마다 무엇을 언제 배우는지
      h('button', { class: 'btn', id: 'class-skill-preview', style: 'width:100%;margin-top:10px', onclick: () => openSkillPreview(game, JOBS, null, () => askClass()) }, '📜 직업별 무공 미리 보기'));
    const look = RANKS[0].look;
    const tick = () => {
      // 고른 뒤에도 창이 숨기만 하고 남아 있어서 이 그림이 끝없이 돌았다 (v181)
      if (!grid.isConnected || !modalOpen()) return;
      const t = performance.now() / 1000;
      for (const { cv, j } of anims) {
        const c = cv.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, cv.width, cv.height);
        c.setTransform(1.15, 0, 0, 1.15, 0, 0);
        drawFighter(c, 58, 120, { ...look, aura: j.color }, { t, weapon: j.look, blade: '#e5e7eb' });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { dismissable: false, onClose: () => checkReturn() });
}

// v118: 무공·특성 개편 — 찍었던 능력치를 돌려받았으면 한 번 알린다
if (game.s.respecNote) {
  const n = game.s.respecNote;
  delete game.s.respecNote;
  setTimeout(() => toast(`무공과 직업 특성이 바뀌어 찍었던 능력치 ${n}점을 돌려드렸어요 — 캐릭터 창에서 다시 찍어요`), 1500);
}

// v130: 장비 개편 — 십이지왕 사다리 장비를 바꿨으면 한 번 알린다
if (game.s.gearNote) {
  const n = game.s.gearNote;
  delete game.s.gearNote;
  setTimeout(() => toast(`장비 제작이 바뀌었어요: 레벨 99까지는 사다리(고유 옵션), 99부터는 세트·왕의 장신구. 옛 십이지왕 장비 ${n}개를 바꾸고 재료를 돌려드렸어요 — 가방 → 대장장이`), 2500);
}

// ---------- 방치 보상 ----------
function checkReturn(now = Date.now()) {
  // v205: 무공 값이 싸져서 돌려준 점수가 있으면 한 번 알린다
  if (game.s.skillGift > 0) { toast(`무공 점수가 이제 레벨 ${W.SKILL_PT_FROM}부터 쌓여요 — 지나온 레벨 몫 ${game.s.skillGift}점을 드렸어요`); game.s.skillGift = 0; save(); }
  if (game.s.skillRefund > 0) { toast(`무공 값이 싸졌어요 — 더 쓴 점수 ${game.s.skillRefund}점을 돌려드렸어요 (만렙 ${W.SKILL_LV_MAX})`); game.s.skillRefund = 0; save(); }
  // v254: 받을 보상은 먼저 세이브에 적어 둔다(pendingOffline). 전엔 창이 열려 있으면 lastSeen만 갱신하고 버려서,
  //   설정 창을 연 채 돌아오거나 '받기' 전에 앱이 꺼지면 방치 보상이 영영 사라졌다.
  const fresh = game.offlineReward(now);
  game.s.lastSeen = now;
  game.s.clockMax = Math.max(game.s.clockMax || 0, now);
  if (fresh) {
    if (game.s.pendingOffline) { game.claimOffline(game.s.pendingOffline); toast('지난번 방치 보상을 받았어요'); }
    game.s.pendingOffline = fresh;
    save();
  }
  showPendingOffline();
}
function showPendingOffline() {
  const rw = game.s.pendingOffline;
  if (!rw || modalOpen() || booting) return;
  // v317 한눈에 — 오른 레벨 · 잡은 두목 · 조각. 레벨이 오르고 스탯을 손으로 찍는다면 '받고 스탯 찍기'
  const pj = game.projectLevel(rw.exp);
  const lvUp = pj.gained > 0;
  const statAfter = game.s.statPts + pj.gained * W.STAT_PER_LEVEL;
  const sum = [
    lvUp ? h('span', { class: 'ofs lv' }, `Lv.${game.s.level} → `, h('b', {}, `Lv.${pj.lv}`), h('small', {}, ` (+${pj.gained})`)) : h('span', { class: 'ofs lv' }, `Lv.${game.s.level} · 경험치 +${(Math.min(1, rw.exp / game.expNeed()) * 100).toFixed(1)}%`),
    rw.marks > 0 ? h('span', { class: 'ofs boss' }, `두목 ${fmt(rw.marks)}마리`) : null,
    rw.petShard > 0 || rw.mountShard > 0 ? h('span', { class: 'ofs shard' }, `조각 🐾${fmt(rw.petShard || 0)} 🐎${fmt(rw.mountShard || 0)}`) : null,
  ].filter(Boolean);
  const takeAnd = (then) => () => { closeModal(); then?.(); };
  openModal((s) => {
    s.append(h('h2', {}, '🌙 다녀오셨어요!'),
      h('div', { class: 'off-sum' }, ...sum),
      h('p', { class: 'muted' }, `${duration(rw.t)} 동안 ${W.mapOf(rw.map).name}에서 사냥했어요.`
        + (rw.stoppedByPotion ? ` 물약이 떨어져서 거기서 멈췄어요 (${duration(rw.sec)} 중).` : '')
        // v260: 오래 비우면 효율이 준다 — 얼마나 줄었는지, 상한까지 몇 시간인지
        + (rw.eff != null && rw.eff < 0.995 ? ` 오래 비워서 효율 ${Math.round(rw.eff * 100)}% (앞 2시간 100% · 6시간까지 70% · 10시간까지 40%).` : '')
        + (rw.sec >= game.offlineCapSec() - 1 ? ` 방치는 ${Math.round(game.offlineCapSec() / 3600)}시간까지만 쳐요(마을 상인 → 무관 증축으로 늘려요).` : '')
        + (rw.elix ? ` 영약 ${Math.round(rw.elix / 60)}분어치가 함께 들었어요.` : '')),
      h('div', { class: 'stat-grid' },
        h('div', {}, '처치', h('b', { 'data-count': rw.kills, 'data-suffix': '마리' }, `${fmt(rw.kills)}마리`)),
        h('div', {}, '경험치', h('b', { 'data-count': rw.exp }, fmt(rw.exp))),
        h('div', {}, '은자', h('b', { 'data-count': rw.gold }, fmt(rw.gold))),
        h('div', {}, '먹은 물약', h('b', {}, `${rw.potions}개`)),
        rw.frag > 0 ? h('div', {}, '비급 조각', h('b', {}, `${rw.frag}개`)) : null,
        rw.petShard > 0 ? h('div', {}, '포획 조각', h('b', {}, `${rw.petShard}개`)) : null,   // v292
        rw.mountShard > 0 ? h('div', {}, '탈것 조각', h('b', {}, `${rw.mountShard}개`)) : null),
      h('p', { class: 'muted' }, !rw.mats ? '' : `모은 재료: ${W.ORE_NAME} ${fmt(W.oreOf(W.mapOf(rw.map).mz, rw.mats + (rw.marks || 0) * W.BOSS_MATS).n)}개`
        + (rw.marks ? ` · ${W.matName(W.bossKey(rw.map))} ${rw.marks}개` : '') + ' — 장비 강화에 써요 (증표는 등급 각인)'),
      h('div', { class: 'btn-row off-btns' },
        lvUp && !game.s.autoStat && statAfter > 0 ? h('button', { class: 'btn', onclick: takeAnd(() => showTab('char', 'stat')) }, `받고 스탯 찍기 (${statAfter}점)`) : null,
        h('button', { class: 'btn primary', style: 'flex:1', onclick: takeAnd() }, lvUp ? `모두 받기 · Lv.${pj.lv}` : '모두 받기')));
  }, { dismissable: false, onClose: () => { if (game.s.pendingOffline === rw) { game.claimOffline(rw); delete game.s.pendingOffline; } save(); refreshUI(true); } });
}

// ---------- 앱처럼 (v159): 설치 · 전체 화면 · 절전 ----------
const saverName = (m) => (m ? `${m}분 뒤` : '끔');
// 절전 화면 (v179) — 시계 · 체력/경험치 막대 · 벌이 · '이번 절전 동안' 모은 것 · 좋은 것 · 경고
let saverRun = null;
// v329 절전 화면 '얻은 것' — 두목을 잡을 때마다 '현철 288'이 줄줄이 새로 쌓이던 것을 이름별로 모아 '현철 ×744'처럼 더한다.
//   가장 최근에 더해진 것이 맨 위로 · 다섯 줄까지
const saverLoot = (key, label, n = 1) => {
  if (!saver.on || !saverRun) return;
  const m = saverRun.lootMap || (saverRun.lootMap = new Map());
  const e = m.get(key) || { label, n: 0 };
  e.n += n; e.label = label;
  m.delete(key); m.set(key, e);
  saverRun.loot = [...m.values()].reverse().slice(0, 5).map((x) => `${x.label} ×${fmt(x.n)}`);
};
const saver = new AM.Saver($('app'), () => {
  const s = game.s;
  const r = game.rates();
  const st = game.stats();
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const hpR = game.heroHp / st.hp, exR = s.exp / game.expNeed();
  const run = saverRun || { t0: Date.now(), gold: s.gold, kills: s.kills, deaths: s.deaths, level: s.level, exp: exR, loot: [] };
  const secs = Math.floor((Date.now() - run.t0) / 1000);
  const dLv = s.level - run.level;
  const warns = [];
  if (s.potions < 10) warns.push(s.potions ? `물약이 ${s.potions}개 남았어요` : '물약이 다 떨어졌어요');
  if (s.deaths > run.deaths) warns.push(`${s.deaths - run.deaths}번 쓰러졌어요 — 사냥터가 버거울 수 있어요`);
  if (mail.length) warns.push(`📮 우편 ${mail.length}통이 와 있어요`);
  return {
    clock: `${p2(d.getHours())}:${p2(d.getMinutes())}`,
    date: `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`,
    who: `Lv.${s.level} ${s.nickname || ''}`,
    where: game.inst ? '던전' : W.mapOf(s.huntMap)?.name || '',
    bars: [['체력', hpR, `${Math.round(hpR * 100)}%`, hpR < 0.35 ? '#7f1d1d' : '#14532d'],
      ['경험치', exR, `${(exR * 100).toFixed(1)}%`, '#4c1d95']],
    rates: r ? [['시간당', `경험치 +${((v) => (v < 10 ? v.toFixed(1) : v.toFixed(0)))(r.exp * 3600 / game.expNeed() * 100)}% · 은자 +${fmt(r.gold * 3600)}`], ['처치', `분당 ${(r.kills * 60).toFixed(0)}마리`], ['물약', `${s.potions}개`]] : [['물약', `${s.potions}개`]],
    session: [['시간', secs >= 3600 ? `${Math.floor(secs / 3600)}시간 ${Math.floor(secs / 60) % 60}분` : `${Math.floor(secs / 60)}분 ${secs % 60}초`],
      ['은자', `+${fmt(Math.max(0, s.gold - run.gold))}`],
      ['성장', dLv > 0 ? `레벨 +${dLv}` : `경험치 +${Math.max(0, (exR - run.exp) * 100).toFixed(1)}%`],
      ['처치', `${fmt(Math.max(0, s.kills - run.kills))}마리`]],
    loot: run.loot,
    warns,
  };
});
window.__test_saver = (on) => { if (on) saver.enter(); else if (on === false) saver.exit(); return saverRun?.loot || []; };
saver.onEnter = () => { game.mark('saver'); const s = game.s; saverRun = { t0: Date.now(), gold: s.gold, kills: s.kills, deaths: s.deaths, level: s.level, exp: s.exp / game.expNeed(), loot: [] }; };
$('btn-saver').addEventListener('click', () => saver.enter());
const fsBtn = $('btn-fs');
if (!AM.isStandalone() && AM.canFullscreen()) fsBtn.classList.remove('hidden');
fsBtn.addEventListener('click', () => { AM.toggleFullscreen(); game.mark('app'); });
if (AM.isStandalone()) setTimeout(() => { if (!game.s.did?.app) game.mark('app'); }, 3000);
// 설정 창의 '앱으로' 줄 — 설치할 수 있으면 설치, 아이폰은 홈 화면에 추가 안내, 이미 앱이면 안내만
function appRow() {
  const inApp = AM.inAppName();
  if (inApp && !AM.isStandalone()) {
    return h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '앱으로 쓰기'),
      h('div', { class: 'desc' }, `${inApp} 안에서는 설치가 안 돼요. 크롬·사파리·삼성 인터넷으로 열면 설치할 수 있어요${AM.isIOS() ? ' — 오른쪽 아래 ··· → "Safari로 열기"' : ''}`)),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: () => { if (!AM.openExternal()) toast('··· 메뉴에서 "다른 브라우저로 열기"를 눌러 주세요'); } }, '브라우저로'));
  }
  const desc = AM.isStandalone() ? '앱으로 열려 있어요 — 주소창 없이 전체 화면'
    : AM.canInstall() ? '홈 화면에 아이콘이 생기고, 누르면 주소창 없이 전체 화면으로 열려요'
      : AM.isIOS() ? '사파리 아래 공유 단추(□↑) → "홈 화면에 추가" → 홈 화면 아이콘으로 열면 전체 화면이에요'
        : '브라우저 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"';
  const btn = AM.canInstall() ? h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: async () => { if (await AM.install()) toast('설치했어요 — 홈 화면 아이콘으로 열어 보세요'); } }, '설치')
    : !AM.isStandalone() && AM.canFullscreen() ? h('button', { class: 'btn', style: 'padding:6px 12px', onclick: () => AM.toggleFullscreen() }, '전체 화면') : h('span');
  return h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '앱으로 쓰기'), h('div', { class: 'desc' }, desc)), btn);
}
// 처음 몇 번은 들판 위에 설치 안내 한 줄 (브라우저로 열었을 때만)
function maybeInstallHint() {
  if (AM.isStandalone() || !game.s.job || navigator.webdriver) return;
  // 앱 안 브라우저면 닫았어도 늘 알린다 — 여기서는 설치가 안 되고 저장도 그 앱 안에만 남는다
  const inApp = AM.inAppName();
  if (inApp) {
    const bar = h('div', { class: 'install-bar' },
      h('span', {}, `${inApp} 안에서는 앱 설치가 안 돼요 — 브라우저로 열어 설치하세요`),
      h('button', { class: 'btn primary', onclick: () => { if (!AM.openExternal()) toast(AM.isIOS() ? '오른쪽 아래 ··· → "Safari로 열기"' : '··· 메뉴 → "다른 브라우저로 열기"'); } }, '브라우저로'),
      h('button', { class: 'btn', onclick: () => bar.remove() }, '닫기'));
    $('app').append(bar);
    return;
  }
  if (AM.hintClosed()) return;
  const bar = h('div', { class: 'install-bar' },
    h('span', {}, AM.isIOS() ? '공유(□↑) → "홈 화면에 추가"하면 앱처럼 전체 화면' : '앱으로 설치하면 주소창 없이 전체 화면'),
    AM.canInstall() ? h('button', { class: 'btn primary', onclick: async () => { await AM.install(); bar.remove(); AM.closeHint(); } }, '설치') : null,
    h('button', { class: 'btn', onclick: () => { bar.remove(); AM.closeHint(); } }, '닫기'));
  $('app').append(bar);
}
setTimeout(maybeInstallHint, 8000);

// ---------- 운영자 선물 창 (v175) ----------
async function openGiftAdmin() {
  let pick = null;
  const list = h('div', { class: 'gift-list' }, h('p', { class: 'muted' }, '불러오는 중…'));
  const amt = h('input', { type: 'number', value: '4000000', min: '0', step: '1000', class: 'gift-amt' });
  const pots = h('input', { type: 'number', value: '0', min: '0', step: '10', class: 'gift-amt' });
  const prot = h('input', { type: 'number', value: '0', min: '0', step: '1', class: 'gift-amt' });
  const sel = (opts) => h('select', { class: 'gift-amt' }, ...opts.map(([v, t]) => h('option', { value: v }, t)));
  const petK = sel([['', '없음'], ...W.PETS.map((p) => [p.id, `${p.emoji} ${p.name} — ${p.text}`])]);
  const petR = sel(W.RARITY.map((r, i) => [String(i), r.name]));
  const mountK = sel([['', '없음'], ...W.MOUNTS.map((m) => [m.id, `${m.emoji} ${m.name}`])]);
  const titleK = sel([['', '없음'], ...Object.values(W.TITLES).filter((t) => t.id !== 'founder' && !t.how).map((t) => [t.id, `〈${t.name}〉 ${t.desc}`])]);   // v305 · v307 저절로 얻는 칭호는 뺀다
  const memo = h('input', { type: 'text', placeholder: '한마디 (없어도 돼요)', maxlength: '60', class: 'gift-memo' });
  const field = (name, el) => h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, name)), el);
  openModal((s) => s.append(h('h2', {}, '우편 보내기'), list,
    field('은자', amt), field('물약', pots), field('강화 보호부', prot), field('애완동물', petK), field('애완동물 등급', petR), field('탈것', mountK), field('칭호', titleK), memo,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: async () => {
        const gift = { gold: Number(amt.value) || 0, potions: Number(pots.value) || 0, prot: Number(prot.value) || 0,
          pet: petK.value ? `${petK.value}:${petR.value}` : '', mount: mountK.value, title: titleK.value };
        if (!pick) return toast('받을 무인을 고르세요');
        if (!(gift.gold > 0 || gift.potions > 0 || gift.prot > 0 || gift.pet || gift.mount || gift.title)) return toast('보낼 것을 적으세요');
        const ok = await net.sendGift(pick.uid, gift, memo.value);
        toast(ok ? `${pick.nickname || '무인'}의 우편함에 넣었어요 — ${giftText(gift)}` : '보내지 못했어요 (규칙 게시를 확인하세요)');
        if (ok) closeModal();
      } }, '보내기'),
      h('button', { class: 'btn', onclick: closeModal }, '닫기'))));
  const rows = await net.topPlayers(80);
  list.replaceChildren(...(rows.length ? rows.map((p) => {
    const b = h('button', { class: 'chip gift-who', onclick: () => { pick = p; for (const x of list.children) x.classList.toggle('on', x === b); } },
      h('b', {}, p.nickname || '이름없음'), h('small', {}, ` Lv.${p.level || 1}${p.uid === net.uid ? ' · 나' : ''}`));
    return b;
  }) : [h('p', { class: 'muted' }, '무인 목록을 못 불러왔어요')]));
}

// ---------- 운영자 · 무인 정리 (v282) ----------
// 테스트로 만든 계정·버려진 계정이 서열에 남는다. 골라서 서열 문서를 지운다(로그인 계정은 콘솔에서).
// 미리 골라 두는 것: 나 아님 · Lv10 이하 · 3일 넘게 안 들어옴 · 문파 없음
function staleGuess(p, now = Date.now(), me = '') {
  const at = p.updatedAt?.toMillis?.() ?? (typeof p.updatedAt === 'number' ? p.updatedAt : 0);
  const days = at ? (now - at) / 86400000 : Infinity;
  return { days, pick: p.uid !== me && (p.level || 0) <= 10 && days >= 3 && !p.guildId };
}
async function openPlayerAdmin() {
  const list = h('div', { class: 'pa-list' }, h('p', { class: 'muted' }, '불러오는 중…'));
  const go = h('button', { class: 'btn danger', disabled: true }, '지우기');
  const picked = new Set();
  const sync = () => { go.disabled = !picked.size; go.textContent = picked.size ? `고른 ${picked.size}명 서열에서 지우기` : '지울 무인을 고르세요'; };
  openModal((s) => s.append(h('h2', {}, '무인 정리'),
    h('p', { class: 'muted', style: 'margin:-4px 0 10px;font-size:12.5px' },
      '서열 기록을 지우고 숨김 목록에 올려요 — 그 계정이 다시 들어와도 서열에 안 보여요(되살리기로 풀어요). ', h('b', {}, '미리 고른 것'), ': Lv10 이하 · 3일 넘게 안 들어옴 · 문파 없음'),
    list,
    h('div', { class: 'btn-row' }, go, h('button', { class: 'btn', onclick: closeModal }, '닫기'))));
  async function load() {
    picked.clear(); sync();
    const now = Date.now();
    await net.loadHidden();
    const rows = (await net.allPlayers(400)).map((p) => ({ ...p, ...staleGuess(p, now, net.uid) })).map((p) => (p.hidden ? { ...p, pick: false } : p));
    rows.sort((a, b) => (a.hidden - b.hidden) || (b.pick - a.pick) || (b.days - a.days));
    if (!rows.length && !net.hidden.length) { list.replaceChildren(h('p', { class: 'muted' }, '무인 목록을 못 불러왔어요 (규칙 게시를 확인하세요)')); return; }
    // v308 서열 문서가 없어도 숨김 목록에만 있는 계정(지운 뒤 아직 안 들어온 것)
    for (const u of net.hidden) if (!rows.some((p) => p.uid === u)) rows.push({ uid: u, hidden: true, days: Infinity, pick: false, gone: true });
    list.replaceChildren(h('p', { class: 'pa-sum' }, `서열에 ${rows.filter((r) => !r.hidden).length}명 · 미리 고른 ${rows.filter((r) => r.pick).length}명 · 숨김 ${rows.filter((r) => r.hidden).length}명`), ...rows.map((p) => {
      const me = p.uid === net.uid;
      const cb = h('input', { type: 'checkbox', disabled: me || p.hidden ? true : null });
      cb.checked = p.pick;
      if (p.pick) picked.add(p.uid);
      cb.onchange = () => { if (cb.checked) picked.add(p.uid); else picked.delete(p.uid); sync(); };
      const ago = !Number.isFinite(p.days) ? '접속 기록 없음' : p.days < 1 ? '오늘' : `${Math.floor(p.days)}일 전`;
      return h('label', { class: `pa-row${p.pick ? ' pick' : ''}${p.hidden ? ' hidden' : ''}` }, cb,
        h('span', { class: 'pa-name' }, h('b', {}, p.nickname || (p.gone ? '(서열 기록 없음)' : '이름없음'), me ? h('em', {}, ' · 나') : '', p.hidden ? h('em', {}, ' · 숨김') : ''),
          h('small', {}, p.gone ? '지운 뒤 아직 안 들어옴' : `Lv.${p.level || 1}${p.tierName ? ` · ${p.tierName}` : ''}${p.guildName ? ` · 문파 ${p.guildName}` : ''} · ${ago}`)),
        p.hidden ? h('button', { class: 'btn', style: 'padding:3px 8px;font-size:11.5px', onclick: async (e) => { e.preventDefault(); if (await net.setHidden(p.uid, false)) { toast('되살렸어요 — 다음에 들어오면 서열에 올라와요'); net.changed('rank'); load(); } else toast('되살리지 못했어요'); } }, '되살리기') : h('code', { class: 'pa-uid' }, p.uid.slice(0, 6)));
    }));
    sync();
  }
  go.onclick = async () => {
    const ids = [...picked];
    if (!ids.length || !confirm(`${ids.length}명을 서열에서 지울까요? 되돌릴 수 없어요.`)) return;
    go.disabled = true; go.textContent = '지우는 중…';
    let n = 0;
    for (const id of ids) if (await net.deletePlayer(id)) n++;
    toast(n === ids.length ? `${n}명을 서열에서 지우고 숨겼어요` : `${n}/${ids.length}명 지웠어요 — 나머지는 규칙 게시를 확인하세요`);
    net.changed('rank');   // v308 서열 창이 바로 다시 읽는다
    load();
  };
  load();
}

// ---------- 설정 ----------
function toggleRow(label, on, desc, onChange) {
  const btn = h('button', { class: `btn ${on ? 'good' : ''}`, style: 'padding:6px 12px;min-width:62px' }, on ? '켜짐' : '꺼짐');
  btn.addEventListener('click', () => {
    const next = btn.textContent === '꺼짐';
    btn.textContent = next ? '켜짐' : '꺼짐';
    btn.classList.toggle('good', next);
    onChange(next);
  });
  return h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, label), h('div', { class: 'desc' }, desc)), btn);
}
// v212: 설정이 한 줄로 길어서 찾기 어려웠다 — 게임 · 화면·성능 · 계정으로 묶고, 자주 안 여는 것은 접어 둔다
function setSec(title, open, ...rows) {
  const d = h('details', { class: 'set-sec' }, h('summary', {}, title), ...rows.filter(Boolean));
  d.open = open;
  return d;
}
$('btn-settings').addEventListener('click', () => openModal((s) => {
  const saverBtn = h('button', { class: 'btn', style: 'padding:6px 12px' }, saverName(AM.saverMins()));
  saverBtn.onclick = () => {
    const i = (AM.SAVER_MINS.indexOf(AM.saverMins()) + 1) % AM.SAVER_MINS.length;
    AM.setSaverMins(AM.SAVER_MINS[i]);
    saverBtn.textContent = saverName(AM.SAVER_MINS[i]);
  };
  const fxBtn = h('button', { class: 'btn', style: 'padding:6px 12px' }, FX_NAME[FX_PREF[view.fxPref]]);
  fxBtn.onclick = () => {
    view.fxPref = (view.fxPref + 2) % 3;
    const v = FX_PREF[view.fxPref];
    try { localStorage.setItem('ifu.fx', v); } catch { /* 이번만 */ }
    fxBtn.textContent = FX_NAME[v];
  };
  s.append(h('h2', {}, '설정'),
    setSec('게임', true,
    toggleRow('소리', soundOn(), '때리는 소리·레벨업·좋은 장비 — 이 기기에만 남아요', (v) => {
      setSound(v);
      try { localStorage.setItem('ifu.sound', v ? '1' : '0'); } catch { /* 이번만 */ }
    }),
    net.isAdmin?.() ? h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '운영자 · 우편 보내기'), h('div', { class: 'desc' }, '무인을 골라 은자·물약·보호부·애완동물·탈것을 그 무인의 우편함에 넣어요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: () => { closeModal(); openGiftAdmin(); } }, '보내기')) : '',
    // v309 규칙 판 — 게시를 잊으면 우편·채팅·칭호가 조용히 막힌다
    net.isAdmin?.() ? (() => {
      const st = h('div', { class: 'desc' }, '');
      const paint = () => { st.textContent = net.rulesOk === true ? `✔ 게시된 규칙이 이 판(v${RULES_VER})과 맞아요` : net.rulesOk === false ? `⚠ 게시된 규칙이 옛 판이에요(v${RULES_VER} 필요) — 자동 게시를 켰다면 몇 분 뒤 맞춰져요. 안 켰다면 firestore.rules를 콘솔에 붙여 넣고 게시` : '아직 확인 못 했어요 (온라인이 되면 확인해요)'; st.style.color = net.rulesOk === false ? '#fca5a5' : ''; };
      paint();
      return h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '운영자 · 서버 규칙'), st),
        h('button', { class: 'btn', style: 'padding:6px 12px', onclick: async () => { await net.checkRules(); paint(); toast(net.rulesOk ? '규칙이 맞아요' : net.rulesOk === false ? '옛 규칙이에요 — 다시 게시하세요' : '확인하지 못했어요'); } }, '확인'));
    })() : '',
    // v321 신고함 — 신고된 말을 보고 입막음·말 지우기·넘기기
    net.isAdmin?.() ? h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '운영자 · 신고함'), h('div', { class: 'desc' }, '전체 채팅에서 신고된 말 — 입막음(1시간·1일·영구) · 말 지우기 · 넘기기')),
      h('button', { class: 'btn', style: 'padding:6px 12px', onclick: () => { closeModal(); openReports(); } }, '열기')) : '',
    net.isAdmin?.() ? h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '운영자 · 무인 정리'), h('div', { class: 'desc' }, '테스트·버려진 계정을 골라 서열에서 지워요')),
      h('button', { class: 'btn', style: 'padding:6px 12px', onclick: () => { closeModal(); openPlayerAdmin(); } }, '정리')) : '',
    // v324 글자·화면 크기 — 폰에서도 키울 수 있고, 컴퓨터에서는 자동 확대에 곱한다
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '글자·화면 크기'), h('div', { class: 'desc' }, '컴퓨터처럼 넓은 화면에서는 저절로 키워요 — 여기서 더 키울 수 있어요')),
      (() => { const b = h('button', { class: 'btn', style: 'padding:6px 12px' }, UI_SCALE_NAME[uiScalePref()]); b.onclick = () => { const ks = Object.keys(UI_SCALE); const nx = ks[(ks.indexOf(uiScalePref()) + 1) % ks.length]; try { localStorage.setItem('ifu.uiScale', nx); } catch { /* 이번만 */ } b.textContent = UI_SCALE_NAME[nx]; applyUiScale(); }; return b; })()),
    toggleRow('강화·각인 연출 건너뛰기', skipFx(), '켜면 두드리는 연출 없이 바로 결과 — 끄면 연출을 눌러서 건너뛸 수 있어요', (v) => setSkipFx(v)),
    toggleRow('자동 물약', game.s.autoPotion, `한 병에 최대 체력의 ${Math.round(W.POTION_HEAL * 100)}%를 채워요`, (v) => { game.s.autoPotion = v; save(); }),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '자동 물약 체력'), h('div', { class: 'desc' }, '체력이 이만큼 아래로 내려가면 먹어요 — 높을수록 안전하지만 물약이 많이 들어요')),
      h('button', { class: 'btn', style: 'padding:6px 12px;min-width:62px', onclick: (e) => {
        const i = (W.POTION_ATS.indexOf(game.potionAt()) + 1) % W.POTION_ATS.length;
        game.s.potionAt = W.POTION_ATS[i];
        game.mark('potionAt');
        e.target.textContent = `${Math.round(game.s.potionAt * 100)}%`;
        save();
      } }, `${Math.round(game.potionAt() * 100)}%`)),
    toggleRow('자동 스킬', game.s.autoSkill, '체력을 쓰는 스킬은 체력이 넉넉할 때만 써요 · 걸으면서도 써요', (v) => { game.s.autoSkill = v; save(); }),
    toggleRow('스킬 범위 보기', view.showRange, '펼칠 때마다 맞는 곳을 금빛 고리로 — 스킬 단추를 길게 누르면 언제든 볼 수 있어요', (v) => {
      view.showRange = v;
      try { localStorage.setItem('ifu.range', v ? '1' : '0'); } catch { /* 이번만 */ }
    }),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '절전 화면'), h('div', { class: 'desc' }, '손대지 않으면 검은 화면에 숫자만 — 화면은 켜 둔 채 사냥은 계속돼요. 들판의 🌙로 바로 들어가요')), saverBtn)),
    setSec('화면·성능', false,
    (() => {
      const qb = h('button', { class: 'btn', style: 'padding:6px 12px;min-width:84px' });
      const fb = h('button', { class: 'btn', style: 'padding:6px 12px;min-width:84px' });
      const paint = () => {
        qb.textContent = perf.q === 'auto' ? `자동 ${AUTO_STEPS[perf.step]}배` : QUALITY_NAME[perf.q];
        fb.textContent = perf.fps === 'auto' ? `자동 ${perf.cap30 ? 30 : 60}` : FPS_NAME[perf.fps];
      };
      qb.onclick = () => {
        perf.q = QUALITY[(QUALITY.indexOf(perf.q) + 1) % QUALITY.length];
        try { localStorage.setItem('ifu.quality', perf.q); } catch { /* 이번만 */ }
        perf.locked = false; applyQuality(); paint();
      };
      fb.onclick = () => {
        perf.fps = FPS_PREF[(FPS_PREF.indexOf(perf.fps) + 1) % FPS_PREF.length];
        try { localStorage.setItem('ifu.fps', perf.fps); } catch { /* 이번만 */ }
        perf.autoCap30 = false; applyQuality(); paint();
      };
      paint();
      const rb = h('button', { class: 'btn', style: 'padding:6px 12px;min-width:84px' },
        RM.renderPref() === 'auto' ? `자동 ${RM.useCpu ? 'CPU' : 'GPU'}` : RM.renderPref().toUpperCase());
      rb.onclick = () => {
        const next = RM.RENDER_MODES[(RM.RENDER_MODES.indexOf(RM.renderPref()) + 1) % RM.RENDER_MODES.length];
        try { localStorage.setItem('ifu.render', next); localStorage.removeItem('ifu.renderAuto'); } catch { /* 이번만 */ }
        save();
        CH.setSkip(); location.reload();
      };
      return h('div', {},
        h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '그리기 방식'), h('div', { class: 'desc' }, '어떤 폰은 GPU가 이 게임 그림에 느려요 — CPU로 그리면 빨라질 수 있어요. 누르면 다시 읽어요')), rb),
        h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '화질'), h('div', { class: 'desc' }, '버벅이면 낮춰요 — 자동은 폰이 버거워하면 알아서 낮춰요')), qb),
        h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '초당 그림'), h('div', { class: 'desc' }, '30이면 배터리·열이 절반 — 자동은 버거울 때만 30')), fb));
    })(),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '성능 진단'), h('div', { class: 'desc' }, '10초 동안 어디가 무거운지 재서 표로 보여 줘요 — 버벅이는 곳에서 눌러 주세요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: startDiag }, '재기')),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '원인 찾기'), h('div', { class: 'desc' }, `하나씩 끄고 켜 보며 무엇이 무거운지 찾아요 (${HUNT_STEPS.length * HUNT_SEC}초) — 버벅이는 곳에서 눌러 주세요`)),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: startHunt }, '찾기')),
    toggleRow('성능 보기', !!perfBox, '들판 왼쪽 위에 초당 그림 수·한 장 그리는 시간·해상도 — 버벅일 때 이 숫자를 알려 주세요', (v) => setPerfBox(v)),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '연출'), h('div', { class: 'desc' }, '폰이 버거우면 낮춰요')), fxBtn),
    // v233: 화면 흔들림 — 어지러우면 줄이거나 끈다
    (() => {
      const NAME = { 1: '보통', 0.5: '약하게', 0: '끔' };
      const b = h('button', { class: 'btn', style: 'padding:6px 12px;min-width:62px' }, NAME[view.shakePref ?? 1] || '보통');
      b.onclick = () => {
        const order = [1, 0.5, 0];
        view.shakePref = order[(order.indexOf(view.shakePref ?? 1) + 1) % order.length];
        try { localStorage.setItem('ifu.shake', String(view.shakePref)); } catch { /* 이번만 */ }
        b.textContent = NAME[view.shakePref];
      };
      return h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '화면 흔들림'), h('div', { class: 'desc' }, '때리고 맞을 때 화면이 울리는 세기 — 어지러우면 줄여요')), b);
    })()),
    setSec('앱·계정', false,
    appRow(),
    // v281 친구에게 — 설치 안내 페이지(QR·안드로이드/아이폰 방법·카카오톡이면 바깥 브라우저로)
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '친구 부르기'),
      h('div', { class: 'desc' }, '설치 안내 페이지를 보내요 — 카카오톡으로 열어도 크롬·사파리로 넘어가고, 폰마다 설치 방법이 나와요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: async () => {
        const url = new URL('install.html', location.href).href;
        try {
          if (navigator.share) await navigator.share({ title: '방치형키우기', text: '같이 하자! 무협방치 RPG', url });
          else { await navigator.clipboard.writeText(url); toast('설치 안내 링크를 복사했어요'); }
        } catch { /* 취소 */ }
      } }, '보내기')),
    // v320 저장 코드 — 진행 전부를 글자 한 줄로 복사 · 붙여 넣어 되살리기
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '저장 코드'),
      h('div', { class: 'desc' }, '진행 전부를 글자 한 줄로 — 메모장·카톡 나에게에 붙여 두면 다른 기기나 지운 뒤에도 되살려요')),
      h('div', { class: 'btn-row', style: 'gap:6px' },
        h('button', { class: 'btn primary', style: 'padding:6px 10px', onclick: () => { closeModal(); showSaveCode(); } }, '복사'),
        h('button', { class: 'btn', style: 'padding:6px 10px', onclick: () => { closeModal(); askSaveCode(); } }, '불러오기'))),
    ...accountRows(),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn', onclick: () => { closeModal(); askNickname(false); } }, '이름 바꾸기'),
      h('button', { class: 'btn', onclick: () => hardReload() }, '새로 받기')),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn danger', onclick: () => {
        if (!confirm('정말 처음부터 다시 할까요? 레벨·장비·은자가 모두 사라져요.')) return;
        stopSaving = true;
        try { localStorage.removeItem(W.SAVE_KEY); } catch { /* 없음 */ }
        location.reload();
      } }, '처음부터'))),
    h('div', { class: 'btn-row', style: 'margin-top:8px' }, h('button', { class: 'btn', onclick: closeModal }, '닫기')),
    h('p', { class: 'muted', style: 'text-align:center;margin-top:10px' }, `판 ${BUILD}`));
}));

let rulesWarned = false;
// v323 우편이 오면 바로 — 서버가 밀어 주면 단추·알림·소리
function watchMail() {
  if (!net.watchGifts || !net.ready?.() || !game.s.job) return;
  net.watchGifts((list, fresh) => {
    mail = list;
    showMailBtn();
    if (fresh > 0) { toast(`📮 우편이 ${fresh > 1 ? `${fresh}통 ` : ''}왔어요 — 오른쪽 📮를 눌러 받아요`); sfx('loot'); const b = $('btn-mail'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  });
}
function netChanged(what) {
  if (what === 'status') { if (net.ready?.()) watchMail(); else net.unwatchGifts?.(); }
  // v309 규칙이 옛 판이면 운영자에게 한 번 알린다(다른 무인에게는 보이지 않는다)
  if (what === 'rules' && net.rulesOk === false && net.isAdmin?.() && !rulesWarned) {
    rulesWarned = true;
    setTimeout(() => toast('⚠ 운영자: 게시된 Firestore 규칙이 옛 판이에요 — firestore.rules를 다시 게시하세요 (설정 → 운영자)'), 2500);
  }
  if (what === 'status') {
    const b = $('net-badge');
    b.className = `net ${net.status}`;
    b.textContent = { online: '온라인', offline: '오프라인', connecting: '연결 중' }[net.status] || net.status;
    if (net.online) cloudCheck();
  }
  // 문파가 바뀌면 버프(공격력)가 바뀐다 · 열려 있는 창(문파·채팅)에 알린다
  if (what === 'guild') { refreshUI(true); }
  // v302 전체 채팅 — 무림 창이 닫혀 있으면 점
  if (what === 'wchat') dot('social', activeTab !== 'social' && net.worldUnread?.() > 0);
  for (const t of Object.values(tabs)) t.netChanged?.(what);
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;
let giftTimer = 52;
// 우편함 (v175) — 무인마다 하나. 운영자가 넣은 것은 '받기'를 누를 때까지 그대로 남는다
let mail = [];
function petName(code) {
  const [k, r] = String(code).split(':');
  return `${W.petOf(k).emoji} ${W.petOf(k).name}(${W.RARITY[Number(r) || 0]?.name || '레어'})`;
}
function giftText(g) {
  return [g.gold > 0 ? `은자 ${fmt(g.gold)}` : '', g.potions > 0 ? `물약 ${fmt(g.potions)}` : '', g.prot > 0 ? `보호부 ${fmt(g.prot)}` : '',
    ...[].concat(g.title || []).map((t) => (W.titleOf(t) ? `칭호 〈${W.titleOf(t).name}〉` : '')),
    ...[].concat(g.pet || []).map((p) => `애완동물 ${petName(p)}`),
    ...[].concat(g.mount || []).map((m) => W.mountOf(m) ? `탈것 ${W.mountOf(m).emoji} ${W.mountOf(m).name}` : '')]
    .filter(Boolean).join(' · ');
}
function showMailBtn() {
  $('btn-mail').classList.toggle('hidden', !mail.length);
  $('mail-n').textContent = mail.length > 1 ? String(mail.length) : '';
}
async function checkGifts() {
  mail = await net.listGifts();
  showMailBtn();
  return mail.length;
}
let claimingMail = false;
async function claimMail(ids) {
  // v254: 받는 중엔 다시 안 받는다('받기'와 '모두 받기'를 겹쳐 누르면 같은 선물을 두 번 받았다)
  if (claimingMail) return;
  claimingMail = true;
  try { await claimMailNow(ids); } finally { claimingMail = false; }
}
async function claimMailNow(ids) {
  const got = { gold: 0, potions: 0, prot: 0, pet: [], mount: [], title: [] };
  const left = [];
  for (const id of ids) {
    // 애완동물은 키우는 칸·우리에 자리가 있어야 받는다 — 없으면 우편을 남겨 둔다
    const m = mail.find((x) => x.id === id);
    if (m?.pet && !game.mailPetOk()) { left.push(id); continue; }
    const g = await net.claimGift(id);
    if (!g) continue;
    for (const k of ['gold', 'potions', 'prot']) got[k] += Math.max(0, Math.floor(g[k] || 0));
    // v254: 우편은 이미 지웠으니 잃지 않게 — 우리가 차도 우리에 넣는다(force). 여러 마리·여러 탈것도
    for (const code of [].concat(g.pet || [])) if (game.takeMailPet(code, true)) got.pet.push(code);
    for (const kind of [].concat(g.mount || [])) if (game.takeMailMount(kind)) got.mount.push(kind);
    for (const t of [].concat(g.title || [])) if (game.grantTitle(t)) got.title.push(t);   // v305 (이미 있으면 그냥 지나간다)
  }
  mail = mail.filter((m) => !ids.includes(m.id) || left.includes(m.id));
  showMailBtn();
  if (left.length) toast('애완동물 우리가 가득 찼어요 — 한 마리를 놓아주고 받으세요');
  if (!(got.gold || got.potions || got.prot || got.pet.length || got.mount.length || got.title.length)) { if (!left.length) toast('받을 것이 없어요'); return; }
  game.s.gold += got.gold;
  game.s.potions += got.potions;
  game.s.prot = (game.s.prot || 0) + got.prot;
  save();
  refreshUI(true);
  sfx('loot');
  toast(`📮 받았어요 — ${giftText(got)}`);
}
// 우편 한 통의 내용 — 받을 것마다 그림 딱지 하나 (v179)
function mailChips(g) {
  const chip = (icon, name, n, col) => h('div', { class: 'mail-chip', style: col ? `border-color:${col}` : '' }, h('span', { class: 'mail-ico' }, icon), h('b', {}, name), n ? h('small', {}, n) : '');
  const out = [];
  if (g.gold > 0) out.push(chip('💰', '은자', fmt(g.gold)));
  if (g.potions > 0) out.push(chip('🧪', '물약', `${fmt(g.potions)}개`));
  if (g.prot > 0) out.push(chip('📜', '보호부', `${fmt(g.prot)}장`));
  for (const p of [].concat(g.pet || [])) {
    const [k, r] = String(p).split(':'); const d = W.petOf(k); const rr = W.RARITY[Number(r) || 0] || W.RARITY[0];
    out.push(chip(d.emoji, d.name, rr.name, rr.color));
  }
  for (const m of [].concat(g.mount || [])) { const d = W.mountOf(m); if (d) out.push(chip(d.emoji, d.name, `이동 +${Math.round(d.speed * 100)}%`)); }
  for (const t of [].concat(g.title || [])) { const d = W.titleOf(t); if (d) out.push(chip('🏷', `〈${d.name}〉`, d.desc, d.col)); }   // v305
  return out;
}
const mailWhen = (at) => {
  if (!at) return '';
  const m = Math.floor((Date.now() - at) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
};
function openMailbox() {
  const draw = (s) => {
    s.replaceChildren(
      h('h2', { class: 'mail-head' }, '📮 우편함', h('small', {}, mail.length ? `${mail.length}통` : '')),
      mail.length ? h('p', { class: 'muted', style: 'margin:0 0 8px' }, '받기를 눌러야 들어와요 · 받은 우편은 사라져요')
        : h('div', { class: 'mail-empty' }, h('div', { class: 'mail-empty-ico' }, '📭'), h('p', {}, '받을 우편이 없어요'), h('small', {}, '운영자가 보낸 선물이 여기로 와요')),
      h('div', { class: 'mail-list' }, ...mail.map((m) => h('div', { class: 'mail-card' },
        h('div', { class: 'mail-from' }, h('b', {}, '🎁 운영자'), h('small', {}, mailWhen(m.at))),
        m.memo ? h('div', { class: 'mail-memo' }, `“${m.memo}”`) : '',
        h('div', { class: 'mail-chips' }, ...mailChips(m)),
        h('button', { class: 'btn primary mail-take', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = '받는 중…';
          await claimMail([m.id]); draw(s);
        } }, '받기')))),
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        mail.length > 1 ? h('button', { class: 'btn primary', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = '받는 중…';
          await claimMail(mail.map((m) => m.id)); draw(s);
        } }, `모두 받기 (${mail.length})`) : '',
        h('button', { class: 'btn', onclick: closeModal }, '닫기')));
  };
  openModal(draw);
}
$('btn-mail').addEventListener('click', openMailbox);
// ---------- 화질·프레임 자동 맞춤 (v181) ----------
// 그림이 버거우면(프레임 간격이 길면) 해상도를 한 단계씩 내리고, 맨 아래에서도 버거우면 초당 30번으로.
// 넉넉하면 한참 뒤 한 단계 올려 본다(올렸다 다시 버거우면 거기서 멈춘다).
const QUALITY = ['auto', 'high', 'mid', 'low'];
const QUALITY_NAME = { auto: '자동', high: '선명', mid: '보통', low: '가볍게' };
const Q_CAP = { high: 2, mid: 1.5, low: 1 };
const AUTO_STEPS = [2, 1.75, 1.5, 1.25, 1];
const FPS_PREF = ['auto', '60', '30'];
const FPS_NAME = { auto: '자동', 60: '60', 30: '30' };
const loadPref = (k, list, d) => { try { const v = localStorage.getItem(k); return list.includes(v) ? v : d; } catch { return d; } };
const perf = { q: loadPref('ifu.quality', QUALITY, 'auto'), fps: loadPref('ifu.fps', FPS_PREF, 'auto'),
  step: 0, cap30: false, autoCap30: false, raised: false, ema: 16.7, slow: 0, fast: 0, t: 0, lastDrop: -1e9, locked: false, odd: false };
function applyQuality() {
  view.setDprCap(perf.q === 'auto' ? AUTO_STEPS[perf.step] : Q_CAP[perf.q]);
  // 버거운 폰일수록 동시에 그리는 파편·연출 상한도 낮춘다 (v182)
  view.budget = perf.q === 'low' || (perf.q === 'auto' && perf.step >= 3) ? 0.5 : perf.q === 'mid' || (perf.q === 'auto' && perf.step >= 2) ? 0.75 : 1;
  perf.cap30 = perf.fps === '30' || (perf.fps === 'auto' && perf.autoCap30);
}
applyQuality();
window.__perf = perf;
window.__diag = () => startDiag();
window.__hunt = () => startHunt();
// 1초마다: 지난 1초의 평균 프레임 간격을 보고 고친다 (30으로 묶였을 때는 두 번에 한 번 그리므로 반으로 본다)
function perfTick(ms) {
  if (ms > 250) return;                      // 다른 앱에 다녀옴·멈춤 — 세지 않는다
  perf.ema = perf.ema * 0.9 + ms * 0.1;
  perf.t += ms;
  if (perf.t < 1000) return;
  perf.t = 0;
  const now = performance.now();
  const slow = perf.ema > 22, fast = perf.ema < 17.8;
  perf.slow = slow ? perf.slow + 1 : 0;
  perf.fast = fast ? perf.fast + 1 : 0;
  // 그리기 방식 자동 (v188): GPU로 해상도를 꽤 낮췄는데도 버거우면 CPU로 한 번 바꿔 본다(다시 읽기).
  // CPU로 와서 20초 지나면 판정 — GPU 때보다 낫지 않으면 되돌린다. 한 번 정하면 다시 묻지 않는다.
  perf.age = (perf.age || 0) + 1;
  if (RM.renderPref() === 'auto' && !navigator.webdriver) {   // 자동 시험(프로그램이 모는 브라우저)에서는 다시 읽지 않는다
    const st = RM.renderAuto();
    if (!st && perf.slow >= 3 && perf.ema > 26 && (perf.q !== 'auto' || perf.step >= 2)) {
      try { localStorage.setItem('ifu.renderGpuMs', String(perf.ema)); localStorage.setItem('ifu.renderAuto', 'cpu'); } catch { /* 못 하면 그만 */ }
      save();
      CH.setSkip(); location.reload();
      return;
    }
    if (st === 'cpu' && RM.useCpu && perf.age === 20) {
      let gpu = 0; try { gpu = Number(localStorage.getItem('ifu.renderGpuMs')) || 0; localStorage.removeItem('ifu.renderGpuMs'); } catch { /* 없음 */ }
      if (gpu && perf.ema > gpu * 0.85) {
        try { localStorage.setItem('ifu.renderAuto', 'gpu'); } catch { /* 없음 */ }
        save();
        CH.setSkip(); location.reload();
        return;
      }
      if (gpu) toast(`그리기를 CPU로 바꿨어요 — ${(1000 / gpu).toFixed(0)} → ${(1000 / perf.ema).toFixed(0)}fps`);
    }
  }
  if (perf.slow >= 3) {
    perf.slow = 0;
    if (perf.q === 'auto' && perf.step < AUTO_STEPS.length - 1) {
      if (now - perf.lastDrop < 60000 && perf.raised) perf.locked = true;   // 올렸다가 다시 버거웠다 — 더는 안 올린다
      perf.step++; perf.lastDrop = now; applyQuality();
    } else if (perf.fps === 'auto' && !perf.autoCap30) { perf.autoCap30 = true; applyQuality(); }
  } else if (perf.fast >= 20 && !perf.locked && !perf.cap30) {
    perf.fast = 0;
    if (perf.q === 'auto' && perf.step > 0 && now - perf.lastDrop > 30000) { perf.step--; perf.raised = true; applyQuality(); }
  }
}
let lastRaf = 0;
// 성능 보기 (v182) — 설정에서 켜면 들판 왼쪽 위에 초당 그림 수·한 장 그리는 데 든 시간·해상도·그리는 개수
let perfBox = null;
const perfAcc = { n: 0, frame: 0, draw: 0, t0: 0, last: 0 };
function setPerfBox(on) {
  try { localStorage.setItem('ifu.perf', on ? '1' : '0'); } catch { /* 이번만 */ }
  if (on && !perfBox) { perfBox = h('div', { class: 'perf-box' }); $('battle').append(perfBox); }
  if (!on && perfBox) { perfBox.remove(); perfBox = null; }
}
function perfNote(now, t1, t2) {
  perfAcc.n++; perfAcc.draw += t2 - t1;
  if (perfAcc.last) perfAcc.frame += now - perfAcc.last;
  perfAcc.last = now;
  if (now - perfAcc.t0 < 1000) return;
  const fps = perfAcc.frame ? (perfAcc.n - 1) / (perfAcc.frame / 1000) : 0;
  const c = view.cv;
  perfBox.textContent = `${fps.toFixed(0)}fps · 그림 ${(perfAcc.draw / perfAcc.n).toFixed(1)}ms · ${c.width}×${c.height} (${view.dpr.toFixed(2)}배)${perf.cap30 ? ' · 30제한' : ''}\n몹 ${game.mons?.length || 0} · 연출 ${view.effects.length} · 파편 ${view.particles.length} · 숫자 ${view.floats.length}`;
  perfAcc.n = 0; perfAcc.frame = 0; perfAcc.draw = 0; perfAcc.t0 = now; perfAcc.last = now;
}
try { if (localStorage.getItem('ifu.perf') === '1') setTimeout(() => setPerfBox(true), 0); } catch { /* 없음 */ }
let loopErr = 0;
function frame(now) {
  now = now ?? performance.now();
  if (!saver.on && !hunt && lastRaf) perfTick(now - lastRaf);
  if (diag && lastRaf) diag.raf.push(now - lastRaf);
  lastRaf = saver.on ? 0 : now;
  // 초당 30번 — 두 번에 한 번만 셈하고 그린다 (창을 띄워 둔 동안에도 30)
  perf.odd = !perf.odd;
  if (hunt) huntFrame(now);
  if (!saver.on && !hunt && (perf.cap30 || modalOpen()) && perf.odd) { requestAnimationFrame(frame); return; }
  try { step(now ?? performance.now()); } catch (e) {
    if (loopErr++ < 5) console.error('[프레임]', e);
    // 그리다 멈추면 캔버스 상태(변환·투명도·합성)가 어긋난 채로 남아 다음 프레임부터 화면이 깨진다 — 되돌린다
    try { view.ctx.reset?.(); view.ctx.globalAlpha = 1; view.ctx.globalCompositeOperation = 'source-over'; view.ctx.shadowBlur = 0; view.applyZoom(); } catch { /* 무시 */ }
  }
  // 절전 중에는 1초에 다섯 번만 (그리지 않는다)
  if (saver.on) setTimeout(() => frame(performance.now()), 200);
  else requestAnimationFrame(frame);
}
// ---------- 원인 찾기 (v187) ----------
// 한 가지씩 끄고 4초씩 재서 어느 것을 껐을 때 가장 빨라지는지 본다. 그동안은 30제한 없이(있는 그대로) 잰다.
// 결과표의 '빨라짐'이 큰 줄이 범인이다.
const HUNT_STEPS = [
  { id: 'base', name: '그대로' },
  { id: 'noui', name: '글자판·단추 숨김', cls: 'hunt-noui' },
  { id: 'noanim', name: '움직이는 꾸밈(애니) 끔', cls: 'hunt-noanim' },
  { id: 'nodraw', name: '들판 그리기 멈춤', noDraw: true },
  { id: 'nocv', name: '들판 캔버스 숨김', cls: 'hunt-nocv', noDraw: true },
  { id: 'lowres', name: '들판 해상도 0.5배', res: 0.5 },
  { id: 'all', name: '전부 끔(바탕만)', cls: 'hunt-noui hunt-noanim hunt-nocv', noDraw: true },
  { id: 'base2', name: '그대로(다시)' },
];
const HUNT_SEC = 4;
let hunt = null;
function startHunt() {
  if (hunt || diag) return;
  closeModal();
  hunt = { i: -1, t0: 0, res: [], cap: view.dprCap };
  toast(`원인 찾기 ${HUNT_STEPS.length * HUNT_SEC}초 — 화면이 잠깐씩 바뀌어요. 손대지 말고 두세요`);
  huntNext(performance.now());
}
function huntApply(st) {
  document.body.classList.remove('hunt-noui', 'hunt-noanim', 'hunt-nocv');
  if (st?.cls) document.body.classList.add(...st.cls.split(' '));
  hunt.noDraw = !!st?.noDraw;
  // 해상도를 바꿨던 시험 다음에는 제 해상도로 되돌린다
  if (hunt.resChanged && !st?.res) { hunt.resChanged = false; view._decor = null; view._vig = null; view.resize(); }
}
// setDprCap은 1 아래로 내리지 않는다(화소 예산 식의 max 1) — 0.5배 시험만 직접 맞춘다
function huntRes(st) {
  if (!st?.res) return;
  const r = view.cv.getBoundingClientRect();
  view.cv.width = Math.max(1, Math.round(r.width * st.res));
  view.cv.height = Math.max(1, Math.round(r.height * st.res));
  if (view.soft) { view.soft.width = view.cv.width; view.soft.height = view.cv.height; }
  view.dpr = st.res; view._decor = null; view._vig = null; view.applyZoom();
  hunt.resChanged = true;
}
function huntNext(now) {
  hunt.i++;
  if (hunt.i >= HUNT_STEPS.length) { huntEnd(); return; }
  hunt.t0 = now; hunt.last = 0; hunt.gaps = []; hunt.draws = 0;
  const st = HUNT_STEPS[hunt.i];
  huntApply(st);
  huntRes(st);
}
function huntFrame(now) {
  const h0 = hunt;
  if (now - h0.t0 > 600) { if (h0.last) h0.gaps.push(now - h0.last); }   // 바꾼 뒤 0.6초는 안정될 때까지 뺀다
  h0.last = now;
  if (now - h0.t0 > HUNT_SEC * 1000) {
    const g = h0.gaps.slice().sort((a, b) => a - b);
    const avg = g.reduce((a, b) => a + b, 0) / Math.max(1, g.length);
    h0.res.push({ ...HUNT_STEPS[h0.i], avg, p95: g[Math.floor(g.length * 0.95)] || 0, slow: g.filter((x) => x > 50).length, n: g.length });
    huntNext(now);
  }
}
function huntEnd() {
  const res = hunt.res;
  huntApply(null);
  hunt = null;
  const base = (res.find((r) => r.id === 'base').avg + res.find((r) => r.id === 'base2').avg) / 2;
  const tests = res.filter((r) => !r.id.startsWith('base') && r.id !== 'all');
  const best = tests.slice().sort((a, b) => a.avg - b.avg)[0];
  const fps = (ms) => (1000 / Math.max(1, ms)).toFixed(0);
  const row = (r) => {
    const gain = base - r.avg;
    const hot = !r.id.startsWith('base') && r.id !== 'all' && gain > base * 0.25;
    return h('div', { class: `row diag-row${hot ? ' hot' : ''}` }, h('div', { class: 'info' }, h('div', { class: 'name' }, r.name)),
      h('b', {}, `${fps(r.avg)}fps · ${r.avg.toFixed(1)}ms${r.id.startsWith('base') ? '' : ` · ${gain >= 0 ? '빨라짐' : '느려짐'} ${Math.abs(gain).toFixed(1)}ms`} · 끊김 ${r.slow}`));
  };
  const allR = res.find((r) => r.id === 'all');
  const verdict = base < 18.5 ? '버벅임 없음 — 60fps로 잘 돌아요'
    : allR && allR.avg > 24
    ? '전부 꺼도 느립니다 — 게임 밖(브라우저·다른 앱·절전 설정)이 화면을 잡고 있습니다'
    : best && base - best.avg > base * 0.25 ? `범인 후보: ${best.name}` : '뚜렷한 범인 없음 — 고르게 무겁습니다';
  openModal((s) => s.append(h('h2', {}, '원인 찾기 결과'),
    h('p', { class: 'muted', style: 'margin:0 0 8px' }, '이 화면을 찍어서 보내 주세요 · 빨간 줄이 범인 후보'),
    ...res.map(row),
    h('div', { class: 'row diag-row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '기기')),
      h('b', {}, `${screen.width}×${screen.height} · dpr ${window.devicePixelRatio} · 캔버스 ${view.cv.width}×${view.cv.height}`)),
    h('div', { class: 'row diag-row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '설정')),
      h('b', {}, `그리기 ${RM.useCpu ? 'CPU' : 'GPU'}(${RM.renderPref()}) · 화질 ${QUALITY_NAME[perf.q]}${perf.q === 'auto' ? ` ${AUTO_STEPS[perf.step]}배` : ''} · 초당 ${FPS_NAME[perf.fps]}`)),
    h('p', { class: 'diag-verdict' }, verdict),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '닫기'))));
}

// ---------- 성능 진단 (v184) ----------
// 실제 폰에서 10초 동안 프레임마다 어디에 시간이 드는지 잰다 — 게임 계산 · 사건 · 그리기(부분별) · 화면 글자판 갱신,
// 그리고 프레임 간격에서 그것들을 뺀 나머지(브라우저가 화면에 올리는 시간·GPU). 끝나면 표로 보여 준다(찍어서 보내면 된다).
let diag = null;
const DIAG_PARTS = ['drawBackground', 'drawLowObstacles', 'drawFields', 'drawTells', 'drawRanges', 'drawUnits', 'drawProjectiles',
  'drawEffects', 'drawParticles', 'drawWeather', 'drawFloats', 'drawHanja', 'drawBanner', 'drawKingIntro'];
const DIAG_NAME = { drawBackground: '바닥', drawLowObstacles: '물·용암', drawFields: '장판', drawTells: '경고', drawRanges: '범위',
  drawUnits: '사람·몹', drawProjectiles: '투사체', drawEffects: '연출', drawParticles: '파편', drawWeather: '날씨',
  drawFloats: '숫자', drawHanja: '한자', drawBanner: '띠', drawKingIntro: '등장' };
function startDiag() {
  if (diag) return;
  closeModal();
  const d = diag = { t0: performance.now(), last: 0, n: 0, gaps: [], raf: [], tick: 0, ev: 0, draw: 0, ui: 0, parts: {}, orig: {}, slow: 0 };
  for (const k of DIAG_PARTS) {
    if (typeof view[k] !== 'function') continue;
    const o = d.orig[k] = view[k];
    view[k] = function (...a) { const t = performance.now(); const r = o.apply(this, a); d.parts[k] = (d.parts[k] || 0) + performance.now() - t; return r; };
  }
  toast('성능 진단 10초 — 평소처럼 두세요');
}
function endDiag() {
  const d = diag;
  diag = null;
  for (const [k, o] of Object.entries(d.orig)) view[k] = o;
  const n = Math.max(1, d.n);
  const gaps = d.gaps.slice().sort((a, b) => a - b);
  const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] || 0;
  const avgGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  const js = (d.tick + d.ev + d.draw + d.ui) / n;
  // 30제한이면 두 번에 한 번 일부러 쉰다 — 그 쉬는 한 칸(화면 한 번 갱신 간격)은 빼고 본다
  const rafAvg = d.raf.length ? d.raf.reduce((a, b) => a + b, 0) / d.raf.length : 0;
  const idle = avgGap > rafAvg * 1.5 ? avgGap - rafAvg * Math.max(1, Math.round(avgGap / Math.max(1, rafAvg)) - 1) : 0;
  const outside = Math.max(0, avgGap - js - idle);
  const c = view.cv;
  const ms = (v) => `${v.toFixed(2)}ms`;
  const row = (k, v, hot) => h('div', { class: `row diag-row${hot ? ' hot' : ''}` }, h('div', { class: 'info' }, h('div', { class: 'name' }, k)), h('b', {}, v));
  const parts = Object.entries(d.parts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const verdict = outside > js * 1.5
    ? '게임 계산보다 **화면에 올리는 일(GPU·브라우저)**이 무겁습니다'
    : '**게임 계산·그리기(JS)**가 무겁습니다';
  openModal((s) => s.append(h('h2', {}, '성능 진단 결과'),
    h('p', { class: 'muted', style: 'margin:0 0 8px' }, '이 화면을 찍어서 보내 주세요'),
    row('초당 그림', `${(1000 / avgGap).toFixed(0)}fps (느린 5% ${(1000 / q(0.95)).toFixed(0)}fps)`),
    row('간격', `보통 ${ms(q(0.5))} · 느린 5% ${ms(q(0.95))} · 최대 ${ms(gaps[gaps.length - 1] || 0)}`),
    row('끊김(50ms 넘음)', `${d.slow}번 / ${d.n}프레임`, d.slow > 3),
    row('게임 계산', ms(d.tick / n)),
    row('사건 처리', ms(d.ev / n)),
    row('그리기(JS)', ms(d.draw / n), d.draw / n > 8),
    ...parts.map(([k, v]) => row(` └ ${DIAG_NAME[k] || k}`, ms(v / n))),
    row('글자판 갱신', ms(d.ui / n)),
    row('JS 밖(GPU·브라우저)', ms(outside), outside > 10),
    row('화면 갱신 간격', `${ms(rafAvg)}${idle ? ` · 30제한으로 쉰 ${ms(idle)} 뺌` : ''}`),
    row('캔버스', `${c.width}×${c.height} · ${view.dpr.toFixed(2)}배 · 화질 ${perf.q}${perf.cap30 ? ' · 30제한' : ''} · ${RM.useCpu ? 'CPU' : 'GPU'}`),
    row('몹 · 연출 · 파편', `${game.mons?.length || 0} · ${view.effects.length} · ${view.particles.length}`),
    row('기기', `${screen.width}×${screen.height} · dpr ${window.devicePixelRatio} · 코어 ${navigator.hardwareConcurrency || '?'} · 메모리 ${navigator.deviceMemory || '?'}GB`),
    h('p', { class: 'muted', style: 'font-size:11px;word-break:break-all' }, navigator.userAgent),
    h('p', { class: 'diag-verdict' }, verdict.replace(/\*\*/g, '')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '닫기'))));
}
function step(now) {
  if (diag) {
    if (diag.last) { const g = now - diag.last; diag.gaps.push(g); if (g > 50) diag.slow++; }
    diag.last = now;
    diag.n++;
    if (now - diag.t0 > 10000) { endDiag(); }
  }
  const dg = diag;
  const tA = dg ? performance.now() : 0;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 3) dt = 0;
  dt = Math.min(dt, 0.25);
  const steps = Math.min(3, Math.ceil(dt / 0.05));
  if (game.s.job && !modalOpen()) for (let i = 0; i < steps; i++) game.tick(dt / steps);
  coop.tick(dt);
  view.game = game;
  const tB = dg ? performance.now() : 0;
  handleEvents();
  saver.tick(dt, !!game.s.job && !modalOpen() && !game.map.town);
  const t1 = performance.now();
  if (dg) { dg.tick += tB - tA; dg.ev += t1 - tB; }
  if (!saver.on && !hunt?.noDraw) view.draw(game, dt);
  if (dg) dg.draw += performance.now() - t1;
  if (perfBox) perfNote(now, t1, performance.now());
  uiTimer += dt;
  saveTimer += dt;
  if (uiTimer > 0.2 && !saver.on) {
    uiTimer = 0;
    const tU = dg ? performance.now() : 0;
    refreshUI();
    if (dg) dg.ui += performance.now() - tU;
  }
  if (saveTimer > 5) { saveTimer = 0; save(); net.pushProfile(); cloudPush(); net.pushWeekBoss?.(); }   // v316 주간 두목(1분에 한 번)
  if (!wbChecked && net.online && game.s.nickname && !modalOpen() && !booting && !game.s.pendingOffline) { wbChecked = true; checkWeekReward(); }   // v318 지난주 순위 보상
  if (!attAsked && game.s.job && game.s.nickname && game.s.kills >= 30 && !modalOpen() && !booting && !game.s.pendingOffline && game.canAttend()) { attAsked = true; showAttend(); }   // v320 출석부(하루 한 번)
  // 운영자 선물 (v175) — 처음엔 8초 뒤, 그다음 1분마다 본다
  giftTimer += dt;
  if (giftTimer > 60 && net.ready?.() && game.s.job) { giftTimer = 0; if (!net.giftUnsub) checkGifts(); else watchMail(); }   // v323 지켜보는 중이면 읽지 않는다
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); net.pushProfile(true); cloudPush(true); } else { last = performance.now(); checkReturn(); }
});
window.addEventListener('pagehide', () => save());

// ---------- 새 판 알림 ----------
let updateBar = null;
function showUpdate(ver) {
  if (updateBar) return;
  updateBar = h('div', { class: 'update-bar' },
    h('span', {}, `새 판이 나왔어요 (${ver || '최신'})`),
    h('button', { class: 'btn primary', onclick: () => hardReload() }, '지금 받기'),
    h('button', { class: 'btn', onclick: () => { updateBar.remove(); updateBar = null; $('app').classList.remove('has-update'); } }, '나중에'));
  $('app').append(updateBar);
  $('app').classList.add('has-update');
}
async function hardReload() {
  // v254: 오프라인에서 누르면 캐시를 다 지운 뒤 새로 받을 수 없어 빈 화면이 됐다 — 먼저 새 파일이 받아지는지 본다
  try {
    const r = await fetch(`index.html?probe=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    toast('인터넷이 연결되면 다시 눌러 주세요 — 지금 지우면 앱이 안 열려요');
    return;
  }
  save();
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches?.keys?.() || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (err) { console.warn('hardReload', err); }
  const u = new URL(location.href);
  u.searchParams.set('v', Date.now().toString(36));
  location.replace(u.toString());
}
async function checkBuild() {
  try {
    const r = await fetch(`sw.js?ts=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const m = (await r.text()).match(/const CACHE = '([^']+)'/);
    if (m && m[1] !== BUILD) showUpdate(m[1]);
  } catch { /* 오프라인 */ }
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.update();
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(null);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(null); });
    });
  }).catch((err) => console.warn('sw', err));
  // 새 판이 자리를 잡으면 — 켜자마자(5초 안·창 없음)면 저장하고 바로 새로 고치고, 놀던 중이면 묻는다.
  // (v125: 전엔 언제든 바로 새로 고쳐서, 하던 중에 화면이 툭 끊기고 방치 보상 창이 떠 있으면 보상이 날아갔다)
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return;
    swReloaded = true;
    // v330 켜는 중(로딩·로그인·무인 고르기 창)이면 바로 새 판으로 — v328부터 켜자마자 무인 고르기 창이 떠서 '창 없음' 조건에 걸려 새 판이 안 받아졌다(옛 그림으로 놀게 됐다)
    if ((performance.now() < 5000 && !modalOpen()) || (booting && !TRIAL_JOB)) { save(); stopSaving = true; location.reload(); } else showUpdate(null);
  });
}
checkBuild();
setInterval(checkBuild, 10 * 60 * 1000);
setInterval(() => net.refreshDay?.(), 60 * 1000);   // 주가 바뀌면 새 토벌 문서를 본다

// ---------- 시작 ----------
if (document.fonts?.load) document.fonts.load('20px "Yuji Syuku"', '두목전직레벨객잔마을죽림').catch(() => {});
netChanged('status');
refreshUI(true);
paintTabLocks();   // v263
requestAnimationFrame((t) => { last = t; frame(t); });
// v266 방치 보상은 지금 셈해 둔다(로딩·로그인이 길어도 5초 저장이 돌아온 때를 덮지 않게) — 창은 로딩이 끝난 뒤
if (game.s.nickname && game.s.job && !TRIAL_JOB) checkReturn();
if (!TRIAL_JOB) net.init();
startBoot();
async function startBoot() {
  const t0 = performance.now();
  try {
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    bootProgress(0.55, '무인을 그리는 중…');
    await waitFor(() => artReady(), 2500);
    bootProgress(0.75, '강호와 잇는 중…');
    if (!TRIAL_JOB) await waitFor(() => net.status !== 'connecting', 7000);
    bootProgress(1, net.online ? (net.isGoogle?.() ? `${net.googleEmail() || 'Google'} 계정으로 들어가는 중…` : '준비됐어요') : '오프라인으로 시작해요');
    await new Promise((r) => setTimeout(r, Math.max(200, 650 - (performance.now() - t0))));
    if (!TRIAL_JOB && needLogin()) await loginScreen();
  } catch (err) { console.warn('[boot]', err); }
  loginUI = null;
  bootHide();
  if (TRIAL_JOB) { booting = false; trialStart(); return; }
  // v328 캐릭터 고르기 — 로그인 뒤 늘(방금 바꾸거나 새로 만들어 다시 연 때만 건너뛴다)
  CH.syncActive(game.s);
  if (!CH.takeSkip()) await charSelect(true);
  booting = false;
  if (!game.s.nickname) askNickname(true);
  else if (!game.s.job) askClass();
  else showPendingOffline();
}
window.__game = game;
window.__net = net;   // v302 시험용
window.__test_linkGoogle = (cred) => linkGoogle(cred);
window.__test_loginGoogle = (cred) => loginGoogle(cred);   // 시험: 로그인 화면의 Google 단추(팝업 대신 토큰)   // 시험: 에뮬레이터 id 토큰으로 팝업 없이 잇는다
window.__test_cloud = () => ({ ok: cloudOk, at: cloudSyncedAt(), dev: DEV_ID, google: net.isGoogle(), uid: net.uid });
window.__test_cloudPush = () => cloudPush(true);
window.__test_checkGifts = () => checkGifts();     // 시험: 1분을 기다리지 않고 우편함을 본다
window.__test_weekReward = () => { game.s.wbClaimed = null; wbChecked = true; return checkWeekReward(); };   // v318 시험: 지난주 순위 보상을 바로 본다
applyUiScale();   // v324 컴퓨터에서는 화면에 맞춰 키운다(상수들이 다 정의된 뒤에)
// v326 컴퓨터 단축키 — 1~5 무공 · Q 물약 · A 자동 사냥 · H 사냥터 · M 지도 · B 가방 · C 캐릭터 · Esc 창 닫기
const HOTKEY_TAB = { m: 'map', b: 'bag', c: 'char', t: 'town', d: 'dgn', g: 'social', p: 'comp' };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    const m = document.getElementById('modal');
    if (modalOpen()) { if (m?.dataset.dismiss === '1') closeModal(); return; }
    if (activeTab) { closePanel(); return; }
    return;
  }
  if (modalOpen()) return;
  if (/^[1-5]$/.test(k)) { skillEls[+k - 1]?.btn?.click(); e.preventDefault(); return; }
  if (k === 'q') { potionEl?.click(); return; }
  if (k === 'a') { autoEl?.click(); return; }
  if (k === 'h') { goHuntNow(); return; }
  const tab = HOTKEY_TAB[k];
  if (tab) { if (activeTab === tab) closePanel(); else if (!tabLocked(tab)) showTab(tab); }
});
// 컴퓨터(마우스)면 단추에 단축키 글자를 단다
const finePointer = matchMedia?.('(pointer: fine)').matches;
if (finePointer) document.body.classList.add('has-keys');
for (const [k, t] of [['H', 'hunt'], ...Object.entries(HOTKEY_TAB).map(([key, tab]) => [key.toUpperCase(), tab])]) { const b = document.querySelector(`#tabs button[data-tab="${t}"]`); if (b) b.dataset.hk = k; }
$('loot-tally').addEventListener('click', tallyClear);   // v324 누르면 모음을 비운다
window.__test_claimAll = () => claimMail(mail.map((m) => m.id));
window.__view = view;
window.__save = save;
window.__app = app;

// 두 손가락으로 벌리면 가까이, 오므리면 멀리
{
  let d0 = 0;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  $('cv').addEventListener('touchstart', (e) => { if (e.touches.length === 2) d0 = dist(e.touches); }, { passive: true });
  $('cv').addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !d0) return;
    const r = dist(e.touches) / d0;
    if (r > 1.3 || r < 0.77) { setCam(view.camLevel + (r > 1 ? 1 : -1)); d0 = dist(e.touches); }
  }, { passive: true });
  $('cv').addEventListener('touchend', (e) => { if (e.touches.length < 2) d0 = 0; }, { passive: true });
}
