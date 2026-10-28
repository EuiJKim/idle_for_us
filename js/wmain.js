// 바람식 개편 — 시작점. 설계: docs/바람식_개편.md
//
// 옛 main.js(관문·수련·무공 여덟 …)를 대신한다. 들판 그림(BattleView)·초식 연출·창틀·서버는 그대로 쓴다.
import { WorldGame, newWorldSave } from './world/wgame.js';
import * as W from './world/wdata.js';
import { BUILD, RANKS, JOBS } from './data.js';
import { BattleView, drawFighter } from './battle.js';
import { loadIcons } from './icons.js';
import { WNet } from './wnet.js';
import { h, toast, openModal, closeModal, modalOpen } from './ui/common.js';
import { WTABS, WTAB_TITLE, itemTitle, skillText } from './wui.js';
import { fmt, duration } from './fmt.js';
import { sfx, unlockAudio, setSound, soundOn } from './sfx.js';
loadIcons();

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

const app = { game, net: null, refresh: () => refreshUI(true), save: () => save(), closePanel: () => closePanel(), showTab: (t) => showTab(t) };
const net = new WNet(game, { onChange: (w) => netChanged(w) });
app.net = net;

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
function showTab(name) {
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
  tabs[name].shown?.();
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
function buildSkillbar() {
  const all = game.s.job ? W.skillsOf(game.s.job) : [];
  skillEls = all.map((sk) => {
    const cd = h('div', { class: 'cd' });
    const num = h('div', { class: 'cdn' });
    const lock = h('div', { class: 'lock' });
    const btn = h('button', { class: 'skill-btn', 'aria-label': sk.name, onclick: () => {
      if (sk.tier > game.s.jobTier) return showTab('town');
      if (!game.useSkill(sk.id)) toast(game.map.town ? '사냥터에서 쓸 수 있어요' : game.heroHp <= game.hpCostOf(sk) + 1 ? '체력이 모자라요' : '아직 숨이 안 돌아왔어요');
    } }, sk.icon, cd, num, lock);
    return { sk, btn, cd, num, lock, was: 0 };
  });
  potionEl = h('button', { class: 'skill-btn potion-btn', 'aria-label': '물약', onclick: () => {
    if (!game.drinkPotion()) toast(game.s.potions ? '체력이 가득해요' : '물약이 없어요 — 마을 상점에서 사요');
  } }, h('span', { class: 'pot-ico' }), h('div', { class: 'lock' }));
  autoEl = h('button', { class: 'skill-btn auto-toggle', onclick: () => {
    game.s.autoHunt = !game.s.autoHunt;
    toast(game.s.autoHunt ? '자동 사냥을 켰어요' : '자동 사냥을 껐어요 — 들판을 눌러 움직여요');
    save();
  } }, h('b', {}, '자동'), h('div', { class: 'lock' }));
  $('skillbar').replaceChildren(...skillEls.map((e) => e.btn), potionEl, autoEl);
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
  $('stage-label').textContent = m.name;
  const bossLeft = Math.max(0, Math.ceil(game.bossT));
  const boss = game.mons.find((x) => x.isBoss && x.alive);
  $('zone-label').textContent = m.town ? (s.autoHunt ? `쉬는 중 → ${W.mapOf(s.huntMap).name}` : '쉬는 중')
    : `몹 Lv.${m.lv[0]}~${m.lv[1]} · ${boss ? `두목 ${boss.name} 출현!` : `두목까지 ${Math.floor(bossLeft / 60)}:${String(bossLeft % 60).padStart(2, '0')}`}`;
  const hpR = Math.max(0, Math.min(1, game.heroHp / st.hp));
  $('progress-fill').style.width = `${hpR * 100}%`;
  $('progress').classList.toggle('low', hpR < 0.35);
  $('progress-text').textContent = `체력 ${fmt(Math.max(0, game.heroHp))} / ${fmt(st.hp)}`;
  $('power-label').textContent = `전투력 ${fmt(st.power)}`;
  // 무공 바
  const sig = `${s.job}|${s.jobTier}`;
  if (sig !== lastSig) { lastSig = sig; buildSkillbar(); }
  for (const e of skillEls) {
    const open = e.sk.tier <= s.jobTier;
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
  dot('char', s.statPts > 0 && !s.autoStat);
  const t = game.nextTier();
  dot('town', !!t && s.level >= t.level && s.gold >= t.cost);
  if (activeTab) { tabs[activeTab].update(); panelRes(); }
  if (full) drawPortrait();
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
      case 'attack': sfx('swish'); break;
      case 'dmg': sfx('hit', ev.crit > 0); break;
      case 'skill': sfx('skill'); break;
      case 'kill': sfx('kill'); break;
      case 'levelUp': sfx('level'); break;
      case 'craft': sfx('loot'); break;
      case 'potion': sfx('potion'); break;
      case 'heroHit': sfx('hurt'); break;
      case 'heroDied': sfx('down'); break;
      case 'bossAppear': sfx('boss'); break;
      default:
    }
    switch (ev.type) {
      case 'levelUp':
        if (ev.level % 5 === 0 || ev.level <= 5) toast(`레벨 ${ev.level}!`);
        if (W.TIERS.some((t) => t && t.level === ev.level)) toast(`레벨 ${ev.level} — 마을 사부에게 가면 전직할 수 있어요`);
        if (W.MAPS.some((m) => !m.town && m.lv[0] === ev.level)) toast(`새 사냥터가 열렸어요 — ${W.MAPS.find((m) => !m.town && m.lv[0] === ev.level).name}`);
        drawPortrait();
        break;
      case 'kill':
        if (ev.mat?.boss) toast(`두목을 잡았어요 — ${ev.mat.boss} · ${ev.mat.name} ${ev.mat.n}개`);
        break;
      case 'equip':
        drawPortrait();
        break;
      case 'craft':
        toast(`조합 성공! ${itemTitle(game, ev.item)}`);
        view.showBanner(itemTitle(game, ev.item), W.GRADES[ev.item.grade].color, 1.4, '조합');
        break;
      case 'bossAppear':
        toast(`두목 ${ev.name}(Lv.${ev.lv})이 나타났어요!`);
        view.showBanner(`두목 · ${ev.name}`, '#fca5a5', 1.6);
        break;
      case 'heroDied':
        toast(`쓰러졌어요… 경험치 ${fmt(ev.loss)}을 잃고 마을로 돌아가요`);
        break;
      case 'advance': {
        view.showBanner(`${ev.tier}차 전직 · ${game.tierName()}`, '#fde68a', 2.4, '전직');
        view.effects.push({ kind: 'pillar', life: 1.6, max: 1.6 });
        const sk = W.skillsOf(game.s.job).find((k) => k.tier === ev.tier);
        toast(`새 스킬 〈${sk.name}〉 — ${skillText(game, sk)}`);
        drawPortrait();
        save();
        break;
      }
      case 'mapEnter':
        view.showBanner(ev.name, '#fef3c7', 1.3);
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

// 사냥터 이름을 누르면 지도
$('stagebar').addEventListener('click', () => showTab('map'));

// ---------- 들판을 눌러 움직이기 ----------
$('cv').addEventListener('pointerdown', (e) => {
  if (modalOpen()) return;
  const r = $('cv').getBoundingClientRect();
  const px = e.clientX - r.left;
  const py = e.clientY - r.top;
  const z = view.zoom || 1;    // 카메라를 물렸으면 화면 1px가 들판 1/z
  const wx = game.heroX + (px / z - view.heroX);
  const wy = game.heroY + (py / z - view.groundY) / view.squash;
  if (game.map.town) {
    // 대장장이를 누르면 가방(조합), 다른 사람이면 마을 창
    let near = null;
    for (const m of game.mons) if (m.npc && (!near || Math.hypot(m.x - wx, m.y - 40 - wy) < Math.hypot(near.x - wx, near.y - 40 - wy))) near = m;
    showTab(near && Math.hypot(near.x - wx, near.y - 40 - wy) < 70 ? near.tab : 'town');
    return;
  }
  game.moveTo(wx, wy);
  view.effects.push({ kind: 'shock', life: 0.35, max: 0.35, wx, wy, r: 22, col: '253,224,71', rings: 1, w: 3 });
});

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
        h('span', { class: 'desc' }, W.CLASSES[j.id].trait))));
    }
    s.append(h('h2', {}, '캐릭터를 고르세요'),
      h('p', { class: 'muted' }, '레벨 15·40·75에 마을 사부에게 전직하면 스킬을 하나씩 배워요.'), grid);
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
    toggleRow('자동 스킬', game.s.autoSkill, '체력을 쓰는 스킬은 체력이 넉넉할 때만 써요', (v) => { game.s.autoSkill = v; save(); }),
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
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;
let loopErr = 0;
function frame(now) {
  try { step(now); } catch (e) { if (loopErr++ < 5) console.error('[프레임]', e); }
  requestAnimationFrame(frame);
}
function step(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 3) dt = 0;
  dt = Math.min(dt, 0.25);
  const steps = Math.min(3, Math.ceil(dt / 0.05));
  if (game.s.job && !modalOpen()) for (let i = 0; i < steps; i++) game.tick(dt / steps);
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
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swReloaded) return; swReloaded = true; location.reload(); });
}
checkBuild();
setInterval(checkBuild, 10 * 60 * 1000);

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
