// 바람식 개편 — 시작점. 설계: docs/바람식_개편.md
//
// 옛 main.js(관문·수련·무공 여덟 …)를 대신한다. 들판 그림(BattleView)·초식 연출·창틀·서버는 그대로 쓴다.
import * as RM from './rendermode.js';   // 맨 먼저 — 캔버스를 만들기 전에 그리기 방식을 정한다 (v188)
import { WorldGame, newWorldSave } from './world/wgame.js';
import * as W from './world/wdata.js';
import { BUILD, RANKS, JOBS } from './data.js';
import { BattleView, drawFighter } from './battle.js';
import { loadIcons, skinImg } from './icons.js';
import { WNet } from './wnet.js';
import { Coop } from './world/wcoop.js';
import { h, toast, openModal, closeModal, modalOpen } from './ui/common.js';
import { WTABS, WTAB_TITLE, itemTitle, skillText, rangeText, rewardText, dailyWaiting } from './wui.js';
import * as D from './world/wdgn.js';
import { QUEST_COUNT } from './world/wquest.js';
import { fmt, duration } from './fmt.js';
import { sfx, unlockAudio, setSound, soundOn } from './sfx.js';
import * as AM from './appmode.js';
loadIcons();
for (const b of document.querySelectorAll('#tabs button[data-tab]')) skinImg(b.querySelector('i'), `tab-${b.dataset.tab}`);

// 소리 — 이 기기에만 남긴다. 휴대폰은 화면을 한 번 눌러야 소리가 난다.
try { setSound(localStorage.getItem('ifu.sound') !== '0'); } catch { /* 사생활 모드 */ }
window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });

const OLD_SAVE_KEY = 'idleForUs.save.v1';
const $ = (id) => document.getElementById(id);

function loadSave() {
  try {
    const raw = localStorage.getItem(W.SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
const saved = loadSave();
const game = new WorldGame(saved || newWorldSave());
// 옛 판에서 온 사람 — 칭호와 시작 은자 (한 번만)
if (!saved) {
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

let stopSaving = false;
function save() {
  if (stopSaving) return;
  game.s.lastSeen = Date.now();
  try { localStorage.setItem(W.SAVE_KEY, JSON.stringify(game.toJSON())); } catch (err) { console.warn('save failed', err); }
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
  $('panel-body').replaceChildren(tabs[name].root);
  $('panel-body').scrollTop = 0;
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
document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('panel-dim').addEventListener('click', closePanel);
$('panel-close').addEventListener('click', closePanel);
function panelRes() {
  const row = document.querySelector('#panel-head .res-row');
  row.replaceChildren(
    h('div', { class: 'res' }, h('span', { class: 'cur silver' }, '은'), h('b', {}, fmt(game.s.gold))),
    h('div', { class: 'res' }, h('span', { class: 'cur potion' }, '약'), h('b', {}, String(game.s.potions))));
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
  $('skillbar').replaceChildren(...skillEls.map((e) => e.btn), ...(advEl ? [advEl] : []), potionEl, autoEl);
}

// ---------- 화면 갱신 ----------
let lastSig = '';
// 같은 글이면 건드리지 않는다 — 같은 글을 다시 넣어도 브라우저는 그 자리를 다시 칠한다 (v185)
function setText(el, v) { if (el.textContent !== v) el.textContent = v; }
function setBar(el, r) {
  const v = `scaleX(${Math.max(0, Math.min(1, r || 0)).toFixed(4)})`;
  if (el.style.transform !== v) el.style.transform = v;
}
function refreshUI(full = false) {
  const s = game.s;
  const st = game.stats();
  setText($('hero-name'), s.nickname || '무명');
  setText($('hero-rank'), game.tierName() || '-');
  setText($('hero-lv'), `Lv.${s.level}`);
  // v185: 너비 대신 transform으로 — 너비를 바꾸면 배치를 다시 하고 화면 전체를 다시 칠했다(막대가 움직이는 동안 매 프레임)
  setBar($('exp-bar').firstChild, s.exp / game.expNeed());
  setText($('gold'), fmt(s.gold));
  setText($('potions'), String(s.potions));
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
    e.lock.textContent = open ? (e.sk.hpCost ? `체력 ${Math.round(e.sk.hpCost * 100)}%` : e.sk.name) : `${e.sk.tier}차 · Lv${W.TIERS[e.sk.tier].level}`;
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
  dot('town', !!t && s.level >= t.level && s.gold >= t.cost);
  dot('comp', s.petBox.length > 0 && s.pets.length < game.petSlots());
  dot('dgn', dailyWaiting(game) || Object.values(game.s.zTickets || {}).some((n) => n > 0));
  if (activeTab) { tabs[activeTab].update(); panelRes(); }
  if (full) drawPortrait();
}
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
  const name = d ? `${d.name} ${ev.stage}단계` : `무한의 탑 ${ev.stage}층`;
  // 탑을 이어 오르는 중이면 알림만 (창이 계속 뜨면 방치가 끊긴다)
  if (ev.kind === 'tower' && ev.ok) {
    toast(`🏯 ${name} 돌파! 공격력·체력 +${(D.towerBonus(game.s.tower.floor) * 100).toFixed(1)}%${ev.reward?.mats ? ` · 보따리 ${rewardText(ev.reward)}` : ''}`);
    if (ev.chain) return;
  }
  if (ev.left) return;
  // v166: 이어서 다음 판으로 들어갔으면 창을 띄우지 않고 알림만 (방치가 끊기지 않게)
  if (ev.kind === 'daily' && ev.chain && ev.ok) {
    toast(`${name} 돌파!${ev.gotKey ? ' 🔑' : ''} ${ev.next ? `→ ${ev.next}단계 도전` : '→ 다음 던전'}${ev.reward ? ` · ${rewardText(ev.reward)}` : ''}`);
    return;
  }
  const why = ev.ok ? '' : ev.died ? '쓰러졌어요' : ev.timeout ? '시간이 다 됐어요' : '';
  openModal((el) => el.append(...[
    h('h3', {}, ev.ok ? `${name} 성공!` : `${name} — ${why}`),
    ev.kind === 'daily' ? h('p', { class: 'muted' }, `처치 ${ev.kills} / ${ev.target}${ev.ok ? ' — 다음부터 이 단계는 소탕할 수 있어요' : ' — 잡은 만큼 보상의 절반'}`) : null,
    ev.kind === 'daily' && ev.gotKey ? h('p', { class: 'dgn-key' }, `🔑 열쇠를 얻었어요 — 오늘 횟수가 하나 돌아왔어요. ${Math.min(D.DAILY_STAGES, ev.stage + 1)}단계에 또 들어가 보세요`) : null,
    ev.kind === 'daily' && !ev.ok ? h('p', { class: 'muted' }, `깨지 못하면 열쇠가 없어요 — 남은 ${game.dailyLeft(ev.id)}번은 소탕으로 받으세요`) : null,
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
  c.setTransform(1.1, 0, 0, 1.1, 0, 0);
  drawFighter(c, 47, 112, { ...RANKS[W.lookTierOf(game.s.level)].look }, { t: 0, weapon: W.classOf(game.s.job)?.look || 'sword', blade: '#e5e7eb' });
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
        drawPortrait();
        break;
      }
      case 'kill':
        if (ev.mat?.boss) { toast(`두목을 잡았어요 — ${ev.mat.boss} · ${ev.mat.name} ${ev.mat.n}개`); saverLoot(`⚔ ${ev.mat.boss} — ${ev.mat.name} ${ev.mat.n}`); }
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
      case 'petDrop': {
        const d = W.petOf(ev.pet.kind);
        saverLoot(`🐾 ${W.RARITY[ev.pet.rar].name} ${d.name}`);
        toast(`${W.RARITY[ev.pet.rar].name} 애완동물 ${d.name}(순위 ${d.tier})! ${ev.joined ? '데려갔어요' : '우리에서 기다려요(동료 창)'}`);
        view.showBanner(d.name, W.RARITY[ev.pet.rar].color, 1.6, '동료');
        sfx('loot');
        break;
      }
      case 'petLevel':
        view.float(`${W.petOf(ev.pet.kind).name} Lv.${ev.pet.lv}`, view.heroX - 50, view.groundY - 120, '#86efac', 14, 1.1);
        break;
      case 'mountDrop': {
        const d = W.mountOf(ev.mount.kind);
        saverLoot(`🐎 ${d.name}`);
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
        if (ev.at) view.float(`+${ev.n} ${W.matName(ev.key)}`, view.sx(ev.at), view.sy(ev.at) - 150, '#f0abfc', 14, 1.2);
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
      case 'infuse': case 'line':
        if (ev.ok !== false) { sfx('loot'); drawPortrait(); }
        if (ev.type === 'infuse' && ev.ok && ev.item.rar >= 2) net.announce(`✦ ${game.s.nickname}님의 〈${itemTitle(game, ev.item)}〉에 ${W.RARITY[ev.item.rar].name} 등급이 새겨졌어요`);
        break;
      case 'echo':
        view.float('한 번 더!', view.heroX, view.groundY - 190, '#f9a8d4', 18, 1);
        break;
      case 'drop':
        toast(`두목이 장비를 떨궜어요! ${W.RARITY[ev.item.rar || 0].name} ${itemTitle(game, ev.item)}`);
        saverLoot(`🗡 ${W.RARITY[ev.item.rar || 0].name} ${itemTitle(game, ev.item)}`);
        sfx('loot');
        break;
      case 'heroDied':
        if (!ev.inst) toast(`쓰러졌어요… 경험치 ${fmt(ev.loss)}을 잃고 마을로 돌아가요${ev.retreat ? ` — 너무 센 곳이라 다음엔 ${ev.retreat}(으)로 나가요` : ''}`);
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
        toast(`${ev.name} 숙련 ${ev.level}! 경험치·재료가 늘고 이 땅의 기운을 더 잘 견뎌요`);
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
      refreshUI(true);
      return undefined;
    };
    ok.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    s.append(h('h2', {}, first ? '우리끼리 무림' : '이름 바꾸기'),
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
        toast(`${j.name}(으)로 강호에 나섰어요 — 지도에서 사냥터를 골라요`);
        net.pushProfile(true);
      } }, cv, h('div', { class: 'cc-txt' },
        h('b', { style: `color:${j.color}` }, j.name),
        h('small', {}, `${j.weapon}${j.range ? ' · 멀리서' : ''}`),
        W.LORE[j.id] ? h('span', { class: 'lore-line' }, `${W.LORE[j.id].house} · ${W.LORE[j.id].title}의 길`) : null,
        h('span', { class: 'desc' }, W.CLASSES[j.id].trait))));
    }
    s.append(h('h2', {}, '캐릭터를 고르세요'),
      h('p', { class: 'muted' }, '레벨 15·40·75에 전직하면 스킬을 하나씩 배워요.'), grid);
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
  const rw = game.offlineReward(now);
  game.s.lastSeen = now;
  if (!rw || modalOpen()) return;
  openModal((s) => {
    s.append(h('h2', {}, '🌙 다녀오셨어요!'),
      h('p', { class: 'muted' }, `${duration(rw.t)} 동안 ${W.mapOf(rw.map).name}에서 사냥했어요.`
        + (rw.stoppedByPotion ? ` 물약이 떨어져서 거기서 멈췄어요 (${duration(rw.sec)} 중).` : '')),
      h('div', { class: 'stat-grid' },
        h('div', {}, '처치', h('b', {}, `${fmt(rw.kills)}마리`)),
        h('div', {}, '경험치', h('b', {}, fmt(rw.exp))),
        h('div', {}, '은자', h('b', {}, fmt(rw.gold))),
        h('div', {}, '먹은 물약', h('b', {}, `${rw.potions}개`))),
      h('p', { class: 'muted' }, !rw.mats ? '' : `모은 재료: ${W.MATS[rw.map]} ${fmt(rw.mats + (rw.marks || 0) * W.BOSS_MATS)}개`
        + (rw.marks ? ` · ${W.matName(W.bossKey(rw.map))} ${rw.marks}개` : '') + ' — 장비 강화에 써요 (증표는 등급 각인)'),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '받기'));
  }, { dismissable: false, onClose: () => { game.claimOffline(rw); save(); refreshUI(true); } });
}

// ---------- 앱처럼 (v159): 설치 · 전체 화면 · 절전 ----------
const saverName = (m) => (m ? `${m}분 뒤` : '끔');
// 절전 화면 (v179) — 시계 · 체력/경험치 막대 · 벌이 · '이번 절전 동안' 모은 것 · 좋은 것 · 경고
let saverRun = null;
const saverLoot = (t) => { if (saver.on && saverRun) { saverRun.loot.unshift(t); saverRun.loot.length = Math.min(saverRun.loot.length, 5); } };
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
  const memo = h('input', { type: 'text', placeholder: '한마디 (없어도 돼요)', maxlength: '60', class: 'gift-memo' });
  const field = (name, el) => h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, name)), el);
  openModal((s) => s.append(h('h2', {}, '우편 보내기'), list,
    field('은자', amt), field('물약', pots), field('강화 보호부', prot), field('애완동물', petK), field('애완동물 등급', petR), field('탈것', mountK), memo,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: async () => {
        const gift = { gold: Number(amt.value) || 0, potions: Number(pots.value) || 0, prot: Number(prot.value) || 0,
          pet: petK.value ? `${petK.value}:${petR.value}` : '', mount: mountK.value };
        if (!pick) return toast('받을 무인을 고르세요');
        if (!(gift.gold > 0 || gift.potions > 0 || gift.prot > 0 || gift.pet || gift.mount)) return toast('보낼 것을 적으세요');
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
    toggleRow('소리', soundOn(), '때리는 소리·레벨업·좋은 장비 — 이 기기에만 남아요', (v) => {
      setSound(v);
      try { localStorage.setItem('ifu.sound', v ? '1' : '0'); } catch { /* 이번만 */ }
    }),
    net.isAdmin?.() ? h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '운영자 · 우편 보내기'), h('div', { class: 'desc' }, '무인을 골라 은자·물약·보호부·애완동물·탈것을 그 무인의 우편함에 넣어요')),
      h('button', { class: 'btn primary', style: 'padding:6px 12px', onclick: () => { closeModal(); openGiftAdmin(); } }, '보내기')) : '',
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
        location.reload();
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
    toggleRow('스킬 범위 보기', view.showRange, '펼칠 때마다 맞는 곳을 금빛 고리로 — 스킬 단추를 길게 누르면 언제든 볼 수 있어요', (v) => {
      view.showRange = v;
      try { localStorage.setItem('ifu.range', v ? '1' : '0'); } catch { /* 이번만 */ }
    }),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '연출'), h('div', { class: 'desc' }, '폰이 버거우면 낮춰요')), fxBtn),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '절전 화면'), h('div', { class: 'desc' }, '손대지 않으면 검은 화면에 숫자만 — 화면은 켜 둔 채 사냥은 계속돼요. 들판의 🌙로 바로 들어가요')), saverBtn),
    appRow(),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn', onclick: () => { closeModal(); askNickname(false); } }, '이름 바꾸기'),
      h('button', { class: 'btn', onclick: () => hardReload() }, '새로 받기')),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn danger', onclick: () => {
        if (!confirm('정말 처음부터 다시 할까요? 레벨·장비·은자가 모두 사라져요.')) return;
        stopSaving = true;
        try { localStorage.removeItem(W.SAVE_KEY); } catch { /* 없음 */ }
        location.reload();
      } }, '처음부터'),
      h('button', { class: 'btn', onclick: closeModal }, '닫기')),
    h('p', { class: 'muted', style: 'text-align:center;margin-top:10px' }, `판 ${BUILD}`));
}));

function netChanged(what) {
  if (what === 'status') {
    const b = $('net-badge');
    b.className = `net ${net.status}`;
    b.textContent = { online: '온라인', offline: '오프라인', connecting: '연결 중' }[net.status] || net.status;
  }
  // 문파가 바뀌면 버프(공격력)가 바뀐다 · 열려 있는 창(문파·채팅)에 알린다
  if (what === 'guild') { refreshUI(true); }
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
async function claimMail(ids) {
  const got = { gold: 0, potions: 0, prot: 0, pet: [], mount: [] };
  const left = [];
  for (const id of ids) {
    // 애완동물은 키우는 칸·우리에 자리가 있어야 받는다 — 없으면 우편을 남겨 둔다
    const m = mail.find((x) => x.id === id);
    if (m?.pet && !game.mailPetOk()) { left.push(id); continue; }
    const g = await net.claimGift(id);
    if (!g) continue;
    for (const k of ['gold', 'potions', 'prot']) got[k] += Math.max(0, Math.floor(g[k] || 0));
    if (g.pet && game.takeMailPet(g.pet)) got.pet.push(g.pet);
    if (g.mount && game.takeMailMount(g.mount)) got.mount.push(g.mount);
  }
  mail = mail.filter((m) => !ids.includes(m.id) || left.includes(m.id));
  showMailBtn();
  if (left.length) toast('애완동물 우리가 가득 찼어요 — 한 마리를 놓아주고 받으세요');
  if (!(got.gold || got.potions || got.prot || got.pet.length || got.mount.length)) { if (!left.length) toast('받을 것이 없어요'); return; }
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
      location.reload();
      return;
    }
    if (st === 'cpu' && RM.useCpu && perf.age === 20) {
      let gpu = 0; try { gpu = Number(localStorage.getItem('ifu.renderGpuMs')) || 0; localStorage.removeItem('ifu.renderGpuMs'); } catch { /* 없음 */ }
      if (gpu && perf.ema > gpu * 0.85) {
        try { localStorage.setItem('ifu.renderAuto', 'gpu'); } catch { /* 없음 */ }
        save();
        location.reload();
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
  if (saveTimer > 5) { saveTimer = 0; save(); net.pushProfile(); }
  // 운영자 선물 (v175) — 처음엔 8초 뒤, 그다음 1분마다 본다
  giftTimer += dt;
  if (giftTimer > 60 && net.ready?.() && game.s.job) { giftTimer = 0; checkGifts(); }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); net.pushProfile(true); } else { last = performance.now(); checkReturn(); }
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
    if (performance.now() < 5000 && !modalOpen()) { save(); stopSaving = true; location.reload(); } else showUpdate(null);
  });
}
checkBuild();
setInterval(checkBuild, 10 * 60 * 1000);
setInterval(() => net.refreshDay?.(), 60 * 1000);   // 주가 바뀌면 새 토벌 문서를 본다

// ---------- 시작 ----------
if (document.fonts?.load) document.fonts.load('20px "Yuji Syuku"', '두목전직레벨객잔마을죽림').catch(() => {});
netChanged('status');
refreshUI(true);
requestAnimationFrame((t) => { last = t; frame(t); });
if (!game.s.nickname) askNickname(true);
else if (!game.s.job) askClass();
else checkReturn();
net.init();
window.__game = game;
window.__test_checkGifts = () => checkGifts();     // 시험: 1분을 기다리지 않고 우편함을 본다
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
