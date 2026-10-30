// 바람식 개편 — 시작점. 설계: docs/바람식_개편.md
//
// 옛 main.js(관문·수련·무공 여덟 …)를 대신한다. 들판 그림(BattleView)·초식 연출·창틀·서버는 그대로 쓴다.
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
$('btn-zoom').addEventListener('click', () => setCam((view.camLevel + 1) % 3));
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
      if (!game.useSkill(sk.id)) toast(game.map.town ? '사냥터에서 쓸 수 있어요' : game.heroHp <= game.hpCostOf(sk) + 1 ? '체력이 모자라요' : '아직 숨이 안 돌아왔어요');
    } }, h('span', { class: 'sk-name' }, sk.icon), cd, num, lock), `w-${game.s.job}-${sk.id}`);
    btn.addEventListener('pointerdown', () => {
      held = false;
      clearTimeout(holdT);
      holdT = setTimeout(() => {
        const rc = game.skillReach(sk);
        held = true;
        if (!rc) { toast(`${sk.name} — 범위가 없는 무공(나에게 거는 기술)이에요`); return; }
        view.rangePreview = { id: sk.id, ...rc };
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
function refreshUI(full = false) {
  const s = game.s;
  const st = game.stats();
  $('hero-name').textContent = s.nickname || '무명';
  $('hero-rank').textContent = game.tierName() || '-';
  $('hero-lv').textContent = `Lv.${s.level}`;
  $('exp-bar').firstChild.style.width = `${Math.min(100, (s.exp / game.expNeed()) * 100)}%`;
  $('gold').textContent = fmt(s.gold);
  $('potions').textContent = String(s.potions);
  const m = game.map;
  instHud();
  // 사냥터 줄은 짧게 — '천산 설원 · 두목'은 체력 막대에 닿았다
  $('stage-label').textContent = m.town || m.inst ? m.name : `${m.king ? m.king.title : m.zoneName} ${m.bossRoom ? '두목' : m.area}`;
  const bossLeft = Math.max(0, Math.ceil(game.bossT));
  const boss = game.mons.find((x) => x.isBoss && x.alive);
  $('zone-label').textContent = m.inst ? (game.inst.kind === 'tower' ? `수문장 Lv.${m.lv[0]} · ${D.towerSec(game.inst.stage)}초 안에` : game.inst.kind === 'raid' ? `문파원과 함께 — ${D.RAID_SEC}초 동안 친 만큼` : `몹 Lv.${m.lv[0]} · ${D.DAILY_KILLS}마리 잡으면 깬다`) : m.town ? (s.autoHunt ? `쉬는 중 → ${W.mapOf(s.huntMap).name}` : '쉬는 중')
    : m.bossRoom ? (boss ? `두목 ${boss.name} Lv.${boss.lv}` : `두목 다시 나기까지 ${Math.floor(bossLeft / 60)}:${String(bossLeft % 60).padStart(2, '0')}`) + (coop.on ? ` · 🤝${coop.count + 1}명` : '')
      : `몹 Lv.${m.lv[0]}~${m.lv[1]} · 두목은 두목 구역에`;
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
  $('progress-fill').style.width = `${hpR * 100}%`;
  $('progress').classList.toggle('low', hpR < 0.35);
  $('progress-text').textContent = `체력 ${fmt(Math.max(0, game.heroHp))} / ${fmt(st.hp)}`;
  $('power-label').textContent = `전투력 ${fmt(st.power)}`;
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
        if (ev.mat?.boss) toast(`두목을 잡았어요 — ${ev.mat.boss} · ${ev.mat.name} ${ev.mat.n}개`);
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
      case 'echo':
        view.float('한 번 더!', view.heroX, view.groundY - 190, '#f9a8d4', 18, 1);
        break;
      case 'drop':
        toast(`두목이 장비를 떨궜어요! ${W.RARITY[ev.item.rar || 0].name} ${itemTitle(game, ev.item)}`);
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
      if (!grid.isConnected) return;
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
        + (rw.marks ? ` · ${W.matName(W.bossKey(rw.map))} ${rw.marks}개` : '') + ' — 가방의 대장장이에서 장비를 조합해요'),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '받기'));
  }, { dismissable: false, onClose: () => { game.claimOffline(rw); save(); refreshUI(true); } });
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
    toggleRow('자동 물약', game.s.autoPotion, `체력이 ${Math.round(W.POTION_AT * 100)}% 아래면 알아서 먹어요`, (v) => { game.s.autoPotion = v; save(); }),
    toggleRow('자동 스킬', game.s.autoSkill, '체력을 쓰는 스킬은 체력이 넉넉할 때만 써요 · 걸으면서도 써요', (v) => { game.s.autoSkill = v; save(); }),
    toggleRow('스킬 범위 보기', view.showRange, '펼칠 때마다 맞는 곳을 금빛 고리로 — 스킬 단추를 길게 누르면 언제든 볼 수 있어요', (v) => {
      view.showRange = v;
      try { localStorage.setItem('ifu.range', v ? '1' : '0'); } catch { /* 이번만 */ }
    }),
    h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '연출'), h('div', { class: 'desc' }, '폰이 버거우면 낮춰요')), fxBtn),
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
let loopErr = 0;
function frame(now) {
  try { step(now); } catch (e) {
    if (loopErr++ < 5) console.error('[프레임]', e);
    // 그리다 멈추면 캔버스 상태(변환·투명도·합성)가 어긋난 채로 남아 다음 프레임부터 화면이 깨진다 — 되돌린다
    try { view.ctx.reset?.(); view.ctx.globalAlpha = 1; view.ctx.globalCompositeOperation = 'source-over'; view.ctx.shadowBlur = 0; view.applyZoom(); } catch { /* 무시 */ }
  }
  requestAnimationFrame(frame);
}
function step(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 3) dt = 0;
  dt = Math.min(dt, 0.25);
  const steps = Math.min(3, Math.ceil(dt / 0.05));
  if (game.s.job && !modalOpen()) for (let i = 0; i < steps; i++) game.tick(dt / steps);
  coop.tick(dt);
  view.game = game;
  handleEvents();
  view.draw(game, dt);
  uiTimer += dt;
  saveTimer += dt;
  if (uiTimer > 0.2) { uiTimer = 0; refreshUI(); }
  if (saveTimer > 5) { saveTimer = 0; save(); net.pushProfile(); }
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
