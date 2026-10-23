import { Game, newSave, migrate, slimSave } from './game.js';
import {
  BUILD, JOBS, jobTestOf, EGO_PARTS, AD_OFFLINE_MULT,
  SKILLS, KILLS_PER_STAGE, DUNGEON_MOBS, RANKS, MISSIONS, PETS, zoneOf, expToNext,
  CODEX_KINDS, GRADES,
  isWallStage, nextUnlock, unlocksAt,
} from './data.js';
import { BattleView, drawFighter } from './battle.js';
import { loadIcons, iconSkin } from './icons.js';
import { showAd } from './ads.js';
loadIcons();
import { Net } from './net.js';
import {
  TABS, h, toast, openModal, closeModal, modalOpen, showProfile, openMissions, rewardText,
  RES_DEFS,
} from './ui/index.js';
import { big } from './big.js';
import { fmt, duration } from './fmt.js';

const SAVE_KEY = 'idleForUs.save.v1';
const APP_VERSION = '0.2.0';
const $ = (id) => document.getElementById(id);

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const game = new Game(loadSave() || newSave());
const view = new BattleView($('cv'));
// 연출 세기 — 이 기기에만 남긴다(세이브가 아니다). 폰이 버거우면 낮춘다.
// 'high' 흑백·화면 가르기까지 · 'mid' 화면 전체를 다시 칠하는 것만 뺀다 · 'low' 잔상·알갱이도 줄인다
const FX_PREF = ['low', 'mid', 'high'];
const FX_NAME = { high: '높음', mid: '보통', low: '낮음' };
function loadFxPref() { try { return localStorage.getItem('ifu.fx') || 'high'; } catch (e) { return 'high'; } }
view.fxPref = Math.max(0, FX_PREF.indexOf(loadFxPref()));
const app = {
  // save를 안 걸어 두면 화면 쪽에서 켠 설정이 다음 자동 저장 때까지 안 남는다.
  // 껐다 켜면 되돌아가 있는 것처럼 보인다.
  game, net: null, refresh: () => refreshUI(true), save: () => save(),
  startRaid, startTrial, startDungeon, sweepDungeon, startPvp, regress,
};
const net = new Net(game, { onChange: (what) => netChanged(what) });
app.net = net;

let stopSaving = false;
function save() {
  if (stopSaving) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.toJSON()));
  } catch (err) {
    console.warn('save failed', err);
  }
}

// ---------- 탭 ----------
const tabs = {};
let activeTab = null;
// 창이 전체를 덮으므로 제목이 필요하다 (전에는 버튼이 보여서 안 적어도 됐다)
const TAB_TITLE = { companion: '영수', dungeon: '비경', social: '무림', train: '수련', growth: '성장', equip: '병기', skill: '무공' };
function closePanel() {
  activeTab = null;
  $('panel').classList.remove('open');
  $('panel-dim').classList.remove('open');
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.remove('active'));
}
function showTab(name) {
  if (activeTab === name) return closePanel(); // 같은 탭을 다시 누르면 내려간다
  if (!tabs[name]) tabs[name] = TABS[name](app);
  activeTab = name;
  $('panel-body').replaceChildren(tabs[name].root);
  $('panel-body').scrollTop = 0;
  $('panel-title').textContent = TAB_TITLE[name] || '';
  $('panel').classList.add('open');
  $('panel-dim').classList.add('open');
  panelRes();                       // 창이 열리는 그 순간에 자원칸도 맞춘다
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  tabs[name].shown?.();
  tabs[name].update();
}
document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- 창 머리 자원칸 ----------
// 탭(또는 그 안의 하위 탭)이 res로 올려 준 목록을 띄운다. 없으면 은자·원보다.
const RES_FALLBACK = ['gold', 'gems'];
let resSig = '';
const resCells = {};
function panelRes() {
  const ids = (activeTab && tabs[activeTab]?.res?.()) || RES_FALLBACK;
  const sig = ids.join(',');
  const row = document.querySelector('#panel-head .res-row');
  if (sig !== resSig) {
    resSig = sig;
    for (const k of Object.keys(resCells)) delete resCells[k];
    row.replaceChildren(...ids.map((id) => {
      const d = RES_DEFS[id];
      if (!d) return null;
      const b = h('b');
      resCells[id] = b;
      return h('div', { class: 'res', title: d.name }, h('span', { class: `cur ${d.cur}` }, d.ch), b);
    }).filter(Boolean));
  }
  for (const [id, b] of Object.entries(resCells)) b.textContent = fmt(RES_DEFS[id].get(game));
}
document.addEventListener('subtab', () => panelRes());
$('panel-dim').addEventListener('click', closePanel);
$('panel-close').addEventListener('click', closePanel);

function netChanged(what) {
  const badge = $('net-badge');
  badge.className = `net ${net.status}`;
  badge.textContent = { online: '● 온라인', offline: '오프라인', connecting: '연결 중' }[net.status];
  for (const t of Object.values(tabs)) t.netChanged?.(what);
  updateDots();
}

function setDot(el, on) {
  let dot = el.querySelector('.dot');
  if (on && !dot) el.append(h('i', { class: 'dot' }));
  if (!on && dot) dot.remove();
}

function updateDots() {
  setDot(document.querySelector('#tabs button[data-tab="social"]'), net.canClaimRaid() || (!!net.guild && !net.checkedInToday()));
  setDot($('btn-missions'), game.claimableCount() > 0);
  setDot(document.querySelector('#tabs button[data-tab="growth"]'), game.s.sp > 0 || game.canTrial());
}

// ---------- 초상화 ----------
// 그림 파일 없이 전투 화면과 같은 붓으로 그린다. 경지가 바뀔 때만 다시 그린다.
let portraitAt = -1;
function drawPortrait() {
  const r = game.s.rank;
  if (r === portraitAt) return;
  portraitAt = r;
  const cv = $('portrait');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  // 수련 탭 미리보기와 같은 좌표계(160x160, 발끝 70,136)를 그대로 줄여 쓴다
  const k = cv.width / 160;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  try {
    drawFighter(ctx, 70, 136, RANKS[r].look, { t: 0, blade: '#e5e7eb', weapon: 'sword' });
  } catch (e) { /* 초상화가 없다고 게임이 멈추면 안 된다 */ }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- 무공 바 ----------
let skillEls = [];
let slotSig = '';
const autoBtn = $('btn-auto');
autoBtn.addEventListener('click', () => { game.s.autoSkill = !game.s.autoSkill; refreshUI(true); });
// 칸·캐릭터·차수가 바뀌면 다시 그린다 (전직하면 이름·그림이 바뀐다)
const barSig = () => `${game.activeSlots().join(',')}|${game.s.job}|${game.jobTier()}`;
function buildSkillbar() {
  // 전투 바도 열린 칸만 그린다
  slotSig = barSig();
  skillEls = game.activeSlots().map((id) => {
    const sk = id ? game.skillDef(id) : null;
    const cd = h('div', { class: 'cd' });
    const lock = h('div', { class: 'lock' });
    const btn = h('button', { class: 'skill-btn', 'aria-label': sk?.name || '빈 칸', onclick: () => (sk ? game.useSkill(sk.id) : showTab('skill')) }, sk?.icon || '＋', cd, lock);
    // 들판 바에도 그림을 깐다. 창 안에만 그림이면 두 곳이 서로 다른 게임 같다.
    if (sk?.art) iconSkin(btn, sk.art[0], sk.art[1]);
    return { sk, btn, cd, lock };
  });
  $('skillbar').replaceChildren(...skillEls.map((e) => e.btn));
}
buildSkillbar();

// ---------- 관문 이동 ----------
// 관문 이름을 누르면 넘어 본 관문 어디로든 간다. 벌이가 좋은 자리로
// 내려가 수련하거나, 두목을 다시 잡으러 되돌아갈 때 쓴다.
function openStageJump() {
  if (!game.canGoStage(game.s.stage)) return toast('싸우는 중에는 못 옮겨요');
  openModal((s) => {
    const max = Math.max(1, game.s.maxStage);
    const input = h('input', { class: 'field', type: 'number', min: '1', max: String(max), value: String(game.s.stage) });
    const label = h('p', { class: 'muted', style: 'text-align:center;margin:6px 0 0' });
    const paint = () => {
      const n = Math.max(1, Math.min(max, Math.floor(Number(input.value) || 1)));
      label.innerHTML = `제 <b>${n}</b> 관문 · ${zoneOf(n).name}`
        + (n < game.s.stage ? ' <span class="muted">(되돌아가요)</span>' : '');
    };
    input.addEventListener('input', paint);
    const go = (n) => {
      if (game.goStage(n)) { closeModal(); refreshUI(true); save(); }
      else toast('그 관문에는 못 가요');
    };
    const quick = h('div', { class: 'btn-row', style: 'margin-top:8px' },
      ...[-50, -10, +10, +50].map((d) => h('button', { class: 'buy', onclick: () => {
        input.value = String(Math.max(1, Math.min(max, (Number(input.value) || 1) + d)));
        paint();
      } }, d > 0 ? `+${d}` : `${d}`)));
    s.append(
      h('h2', {}, '관문 이동'),
      h('p', { class: 'muted', style: 'margin-top:0' }, `넘어 본 곳이면 어디든 갈 수 있어요. 최고 제 ${max} 관문.`),
      input, label, quick,
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: () => go(1) }, '처음으로'),
        h('button', { class: 'btn', onclick: () => go(max) }, '최고로')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: closeModal }, '그만'),
        h('button', { class: 'btn primary', onclick: () => go(Number(input.value)) }, '옮기기')));
    paint();
  });
  return undefined;
}
$('stagebar').addEventListener('click', openStageJump);

$('btn-boss').addEventListener('click', () => game.challengeBoss());
$('btn-settings').addEventListener('click', openSettings);
$('btn-missions').addEventListener('click', () => openMissions(app));

// ---------- 화면 갱신 ----------
const MODE_TITLE = { raid: '혈마 토벌', trial: '심마 대결', pvp: '겨루기', dungeon: '수련터', ego: '심검 승급', shadow: '그림자 무림', tower: '혈마의 탑', rift: '마기 균열', hunt: '비급 탐색' };
function refreshUI(full = false) {
  const s = game.s;
  // 창이 화면을 다 덮으므로, 겨루기가 시작되면 닫아야 싸우는 게 보인다.
  // (예전엔 창이 72vh라 들판이 일부 보였다)
  if (activeTab && game.mode !== 'stage') closePanel();
  const c = game.contest;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(s.gems);
  // 창이 상단바를 덮으므로 창 머리에도 같이 적는다.
  // 어떤 자원을 적을지는 **지금 보고 있는 화면**이 정한다 — 무공은 비급,
  // 병기는 한철처럼 쓰는 것이 다르다.
  panelRes();
  if (c) {
    $('stage-label').textContent = c.mode === 'dungeon' ? `${c.def.name} ${c.level}단계` : MODE_TITLE[c.mode];
    $('zone-label').textContent = c.mode === 'pvp' ? `vs ${c.opponent.nickname}` : c.mode === 'trial' ? `${RANKS[c.rank].name} 경지 도전` : '시간 안에 쓰러뜨리세요';
  } else {
    const wall = isWallStage(s.stage);
    $('stage-label').textContent = `제 ${s.stage} 관문${s.farming ? ' (수련 중)' : ''}`;
    // 벽 표시는 짧게 앞에 붙인다. 제목에 붙이면 길어서 잘린다.
    // 경지·레벨은 위쪽 내 정보 블록이 맡는다. 여기는 자리 이름만.
    $('zone-label').textContent = `${wall ? '관문지기 · ' : ''}${zoneOf(s.stage).name}${s.regress.count ? ` · ${s.regress.count + 1}회차` : ''}`;
    $('stage-label').classList.toggle('wall', wall);
  }
  // 성장 축이 83개다. 지금 뭘 하면 가장 이득인지 한 줄로 짚어준다.
  const adv = c ? null : game.nextAdvice();
  const advEl = $('advice');
  if (adv) {
    advEl.textContent = adv.text;
    advEl.classList.remove('hidden');
    advEl.onclick = () => {
      if (!adv.tab) return;
      showTab(adv.tab);
      if (adv.sub) {
        setTimeout(() => {
          const b2 = [...document.querySelectorAll('#panel .seg button, #panel .subtabs button')]
            .find((x) => x.dataset.key === adv.sub);
          if (b2) b2.click();
        }, 30);
      }
    };
  } else advEl.classList.add('hidden');

  // 이 관문을 깨면 뭐가 열리는지 알려준다. 벽이 그냥 어려워지기만 하면 벽일 이유가 없다.
  const nx = c ? null : nextUnlock(s.bestStage);
  const gate = $('gate-hint');
  if (nx) {
    const left = nx.stage - s.stage;
    gate.textContent = left <= 0 ? `이 관문을 넘으면 ${nx.items.join(' · ')} 열림`
      : `${nx.stage}관문까지 ${left} — ${nx.items.join(' · ')}`;
    gate.classList.toggle('near', left <= 0);
    gate.classList.remove('hidden');
  } else {
    gate.classList.add('hidden');
  }
  $('hero-name').textContent = s.nickname || '무명';
  $('hero-rank').textContent = game.rankLabel();   // '현경 23단'
  $('hero-lv').textContent = `Lv.${s.level}`;
  drawPortrait();
  $('power-label').textContent = `전투력 ${fmt(game.power().power)}`;
  // 경험치는 Big이다. `a / b`는 NaN이 되고 너비가 "NaN%"가 되어 막대가 안 보인다.
  $('exp-bar').firstChild.style.width = `${Math.min(100, big(s.exp).div(expToNext(s.level)).toNumber() * 100)}%`;

  const prog = $('progress');
  const m = game.mon;
  if (c) {
    prog.classList.add('boss');
    $('progress-fill').style.width = `${(c.time / c.maxTime) * 100}%`;
    $('progress-text').textContent = c.mode === 'dungeon' ? `${Math.min(c.kills, DUNGEON_MOBS)}/${DUNGEON_MOBS} · ${Math.ceil(c.time)}초` : `${Math.ceil(c.time)}초`;
  } else if (m?.isBoss && m.alive) {
    prog.classList.add('boss');
    $('progress-fill').style.width = `${(game.bossTimer / game.bossTimeMax) * 100}%`;
    $('progress-text').textContent = `두목 ${Math.ceil(game.bossTimer)}초`;
  } else {
    prog.classList.remove('boss');
    if (s.farming) {
      $('progress-fill').style.width = '100%';
      $('progress-text').textContent = '은자 모으는 중';
    } else {
      // 물결 단위로 보여준다. 한 관문이 여러 물결로 나뉜다.
      const total = game.waveTotal();
      const need = game.waveNeed();
      const done = Math.min(need, game.waveDone());
      $('progress-fill').style.width = `${(done / need) * 100}%`;
      $('progress-text').textContent = total > 1
        ? `${s.wave + 1}번째 물결 · ${done} / ${need}`
        : `${done} / ${need}`;
    }
  }
  $('btn-boss').classList.toggle('hidden', !s.farming || !!c);
  // 알아서 다시 도전하기까지 남은 시간을 단추에 적는다
  if (s.farming && !c) {
    const left = game.autoBossLeft();
    $('btn-boss').textContent = left == null ? '두목 도전' : `두목 도전 (${Math.ceil(left)}초 뒤 자동)`;
  }
  $('contest-hud').classList.toggle('hidden', !c || c.mode !== 'raid');
  if (c?.mode === 'raid') {
    $('contest-title').textContent = `문파 토벌 · 혈마 ${Math.ceil(c.time)}초`;
    $('contest-sub').textContent = `내 피해 ${fmt(c.damage)}`;
  }

  if (barSig() !== slotSig) buildSkillbar();
  for (const { sk, btn, cd, lock } of skillEls) {
    if (!sk) { btn.classList.add('locked'); continue; }
    const unlocked = game.skillUnlocked(sk);
    btn.classList.toggle('locked', !unlocked || game.mode === 'pvp');
    lock.textContent = unlocked ? `Lv.${s.skills[sk.id]}` : `${sk.unlock}관`;
    const left = game.cd[sk.id];
    cd.style.height = unlocked ? `${(left / sk.cd) * 100}%` : '0';
    btn.classList.toggle('ready', unlocked && left <= 0);
  }
  autoBtn.classList.toggle('on', s.autoSkill);
  autoBtn.querySelector('span').textContent = s.autoSkill ? '자동 켬' : '자동 끔';

  if (activeTab) tabs[activeTab].update();
  if (full) updateDots();
}

// ---------- 이벤트 처리 ----------
let pendingRaid = null;
let lastUpStage = 0;   // 수련 단계 알림용 — 처음 그릴 때 채운다
function handleEvents() {
  for (const ev of game.events) {
    view.handle(ev, game);
    switch (ev.type) {
      case 'gems': toast(`원보 +${ev.amount}`); break;
      case 'stageClear': {
        if (ev.stage % 10 === 0) { toast(`🎉 ${zoneOf(ev.stage + 1).name}에 도착했어요!`); net.pushProfile(true); }
        const sk0 = SKILLS.find((x) => x.unlock === ev.stage + 1);
        const sk = sk0 && game.skillDef(sk0.id);
        if (sk) toast(`${sk.icon} 새 무공 「${sk.name}」(${sk0.role}) 해금!`);
        // 수련 단계가 새로 열렸다. 건너뛰기로 한 번에 여러 관문을 넘을 수 있어서
        // '50의 배수인가'로 보면 놓친다 — 열린 단계 수를 들고 있다가 견준다.
        if (game.upStage() > lastUpStage) toast(`🔓 수련 ${game.upStage()}단계가 열렸어요 — 수련을 더 올릴 수 있어요`);
        lastUpStage = game.upStage();
        if (game.s.job && [150, 280, 420].includes(ev.stage + 1)) toast(`📜 ${game.jobTier() + 1}차 전직 시험이 열렸어요 — 성장 › 전직`);
        if ([10, 20, 30, 40].includes(ev.stage)) toast('🏯 새 수련터이 열렸어요!');
        break;
      }
      case 'levelUp': updateDots(); break;
      case 'regress': toast(`회귀 · 전생의 기억 +${ev.gain}`); lastUpStage = game.upStage(); break;
      case 'missionDone': toast(`📜 의뢰 완료: ${MISSIONS.find((x) => x.id === ev.id).name}`); updateDots(); break;
      case 'heroDied': if (ev.boss) toast('두목을 못 잡았어요. 수련하고 다시 도전!'); break;
      // 아래 넷은 게임이 쏘기만 하고 아무도 안 받고 있었다.
      // 뭔가 얻었는데 화면에 아무 일도 안 일어나면 플레이어는 얻은 줄 모른다.
      case 'accBox': toast(`🎁 장신구 상자 ${ev.boxes}개를 열었어요`); updateDots(); break;
      case 'accPick': toast('🎁 선택 상자를 얻었어요 — 자리를 골라 열어요'); updateDots(); break;
      case 'lore': {
        const kd = CODEX_KINDS.find((x) => x.id === ev.kind);
        toast(`📖 인물도감: ${GRADES[ev.grade].name} ${kd ? kd.name : ''} 기록`);
        break;
      }
      // 소환 레벨은 자주 오른다. 토스트를 띄우면 시끄러우니 점으로만 알린다.
      case 'gachaLv': updateDots(); break;
      // 관문지기 시간이 다 되면 heroDied로 넘어가 '쓰러졌다'가 뜬다.
      // 실제로는 못 이긴 것이라 말이 틀렸다. 먼저 바로잡는다.
      // 소단계가 오르면 알려 준다. **자주 오르는 맛**이 이 시스템의 전부인데
      // 조용히 오르면 올라간 줄 모른다 — 만들어 놓고 안 쓴 사건이었다.
      case 'rankSubUp': toast(`${game.rankLabel()} — 기운이 한 겹 두터워졌어요`); break;
      case 'traitUp': toast(`${game.job()?.name || ''} 특성 ${ev.lv}단 — 쓰는 무공 전부가 세졌어요`); break;
      case 'goStage': toast(`제 ${ev.stage} 관문으로 옮겼어요`); break;
      // 전생의 기억으로 이미 깬 곳을 성큼 건너뛴다. 조용히 넘기면
      // 관문 숫자가 튀는 걸로만 보여서 버그처럼 읽힌다.
      case 'stageSkip': view.showBanner(`전생의 기억 — 제 ${ev.to} 관문까지 성큼`, '#c4b5fd', 1.1); break;
      // 자동 뽑기는 두 초마다 돈다. 매번 알리면 화면이 그 소리로 덮인다 —
      // 쓸 만한 게 나왔을 때만 한 줄 띄운다.
      case 'autoGacha':
        if (ev.best >= 3) {
          view.showBanner(`${GRADES[ev.best].name} 병기! (자동 ${ev.count}회)`,
            GRADES[ev.best].color, 0.9);
        }
        break;
      case 'bossTimeout': toast('⏳ 관문지기를 시간 안에 못 잡았어요'); break;
      // 연속 도전이 끊기면 알려야 한다. 모르면 계속 도는 줄 안다.
      case 'loopAgain': if (!ev.on) toast('연속 도전을 멈췄어요'); break;
      case 'raidEnd': finishRaid(ev.damage); break;
      case 'contestEnd': if (ev.mode !== 'raid') showResult(ev); break;
      default:
    }
  }
  game.events.length = 0;
}

function showResult(r) {
  save();
  refreshUI(true);
  if (r.mode === 'pvp') { net.pushProfile(true).then(() => netChanged('pvp')); }
  if (r.mode === 'trial' && r.win) net.pushProfile(true);
  openModal((s) => {
    const win = r.win;
    let title = '';
    let body = '';
    if (r.mode === 'dungeon') {
      title = win ? '수련터 돌파!' : '수련터 실패';
      body = win ? `${r.level}단계 클리어! 다음 단계가 열렸어요.` : '시간 안에 못 잡았어요. 열쇠는 그대로예요. 수련하고 다시 도전!';
    } else if (r.mode === 'trial') {
      title = win ? `경지 돌파 · ${RANKS[r.rank].name}` : '심마에게 패했다';
      body = win ? '마음속 마귀를 베었다. 공격력·체력 ×1.5, 기운이 달라졌어요!' : '심마가 아직 강해요. 더 수련하고 다시 도전하세요.';
    } else if (r.mode === 'tower') {
      // 여기 없는 모드는 **제목도 내용도 없는 빈 창**이 떴다. 탑·균열·탐색·
      // 그림자·심검 다섯이 전부 그랬다 — 깼는데 아무 말도 안 해 줬다.
      title = win ? `혈마의 탑 ${r.floor}층 돌파` : '탑에서 밀려났다';
      body = win ? '오른 층은 영구히 남아요. 다음 층이 열렸어요.'
        : '아직 못 올라가요. 수련하고 다시 올라가세요.';
    } else if (r.mode === 'rift' || r.mode === 'hunt') {
      const nm = r.mode === 'rift' ? '균열' : '토벌';
      title = win ? `${nm} 성공` : `${nm} 실패`;
      body = win ? '탐색패를 쓴 보람이 있었어요.' : '시간 안에 못 잡았어요.';
    } else if (r.mode === 'shadow') {
      title = win ? '그림자를 베었다' : '그림자에게 졌다';
      body = win ? `연승 ${r.wins} · ${r.tier != null ? `${r.tier}단계` : ''}`
        : '내 그림자가 아직 세요. 더 수련하고 다시 겨루세요.';
    } else if (r.mode === 'ego') {
      const ep = EGO_PARTS.find((x) => x.id === r.egoId);
      title = win ? `${ep ? ep.name : '심검'} ${r.step}단계` : '승급 실패';
      body = win ? '한 단계 올랐어요. 경험치는 0부터 다시 쌓여요.'
        : '아직 일러요. 장비를 더 먹이고 다시 도전하세요.';
    } else if (r.mode === 'jobtest') {
      // 시험 결과를 아무 데서도 안 받고 있었다 — 치르고 나면 아무 일도 안 일어났다.
      const j = JOBS.find((x) => x.id === r.job);
      const d = jobTestOf(r.job);
      title = win ? `${r.tier}차 전직 — ${j?.tiers?.[r.tier] || ''}` : `${r.tier}차 전직 시험 〈${d?.name || ''}〉 실패`;
      body = win
        ? '무공 여덟이 각성했어요. 무공 창에서 새 이름을 확인해 보세요.'
        : `${r.miss || '조건을 못 채웠어요'} — 잃는 건 없어요. 몇 번이든 다시 볼 수 있어요.`;
      if (win) {
        view.showBanner(`${r.tier}차 전직 · ${j?.tiers?.[r.tier] || ''}`, j?.color || '#fde68a', 2.6, '각성');
        view.effects.push({ kind: 'pillar', life: 1.6, max: 1.6 });
        buildSkillbar();
      }
    } else if (r.mode === 'pvp') {
      title = win ? '승리!' : '패배…';
      body = `vs ${r.opponent.nickname} · 비무 점수 ${r.delta > 0 ? '+' : ''}${r.delta} (${game.s.pvp.score}점)`;
    }
    s.append(h('div', { class: `result-title ${win ? 'win' : 'lose'}` }, title), h('p', { style: 'text-align:center' }, body));
    if (r.reward && rewardText(r.reward)) s.append(h('div', { class: 'big-reward', style: 'font-size:20px' }, rewardText(r.reward)));
    s.append(h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '확인'));
  });
}

function canStart() {
  if (game.mode !== 'stage') { toast('지금 진행 중인 전투가 끝나면 시작할 수 있어요'); return false; }
  return true;
}

function regress() {
  if (!canStart()) return;
  const gain = game.regress();
  if (!gain) return;
  save();
  net.pushProfile(true);
  refreshUI(true);
}

function startTrial() {
  if (!canStart()) return;
  if (!game.startTrial()) return toast('아직 경지 조건이 안 돼요');
  return undefined;
}

function startDungeon(id) {
  if (!canStart()) return;
  if (!game.startDungeon(id)) toast('수련터에 들어갈 수 없어요 (열쇠·해금 확인)');
  refreshUI(true);
}

function sweepDungeon(id) {
  if (!canStart()) return;
  const r = game.sweepDungeon(id);
  if (r) toast(`⚡ 소탕 완료! ${rewardText(r)}`);
  save();
  refreshUI(true);
}

function startPvp(p) {
  if (!canStart()) return;
  if (p.uid === net.uid) return toast('자기 자신과는 비무할 수 없어요');
  if (game.s.daily.pvpTickets <= 0) return toast('오늘 비무를 다 했어요. 내일 다시!');
  const pet = PETS.find((x) => x.id === p.pet);
  game.startPvp({ ...p, petEmoji: p.petEmoji || pet?.emoji || null });
  refreshUI(true);
  return undefined;
}

async function startRaid(btn) {
  if (!canStart()) return;
  if (btn) btn.disabled = true;
  try {
    const r = await net.ensureRaid();
    // 두목 체력·넣은 피해는 서버에서 글자("1.2e500")로 온다 — Big으로 푼다.
    const maxHp = big(r.maxHp ?? 0);
    const total = big(r.total ?? 0);
    if (total.gte(maxHp)) return toast('오늘의 두목은 이미 처치됐어요');
    if (!game.startRaid(maxHp.sub(total), maxHp)) return toast('오늘 도전 횟수를 다 썼어요');
    pendingRaid = r.id;
    toast('30초 동안 최대한 때려요!');
    save();
  } catch (err) {
    toast(err.message || '토벌을 시작하지 못했어요');
  } finally {
    if (btn) btn.disabled = false;
    refreshUI(true);
  }
}

async function finishRaid(damage) {
  const raidId = pendingRaid;
  pendingRaid = null;
  save();
  if (!raidId) return;
  try {
    const killed = await net.commitRaidDamage(damage, raidId);
    toast(killed ? '혈마 토벌 성공! 무림 → 문파에서 보상을 받으세요' : `토벌 피해 ${fmt(damage)} 기록!`);
  } catch (err) {
    toast(`피해 기록 실패: ${err.message}`);
  }
  refreshUI(true);
}

// ---------- 방치 보상 / 일일 보상 ----------
function checkReturn(now = Date.now(), allowClimb = false) {
  const daily = game.checkDaily(now);
  if (daily) toast(`📅 오늘의 출석 보상 원보 ${daily.gems}`);
  net.refreshDay?.();
  const reward = game.offlineReward(now, allowClimb);
  game.s.lastSeen = now;
  if (!reward || modalOpen()) return;
  // 두 배로 받을지는 **닫기 전에** 정한다. 받은 뒤에 물으면 이미 늦다.
  let mult = 1;
  openModal((s) => {
    const gold = h('div', { class: 'big-reward' }, `은자 ${fmt(reward.gold)}`);
    const exp = h('p', { style: 'text-align:center;margin-top:-6px' }, `📘 경험치 ${fmt(reward.exp)}`);
    const paint = () => {
      gold.textContent = `은자 ${fmt(reward.gold * mult)}`;
      exp.textContent = `📘 경험치 ${fmt(reward.exp * mult)}`;
    };
    const dbl = h('button', { class: 'btn good', style: 'width:100%;margin-bottom:6px' },
      game.s.noAds ? `✨ ${AD_OFFLINE_MULT}배로 받기 (광고 없이)` : `📺 광고 보고 ${AD_OFFLINE_MULT}배 받기`);
    dbl.onclick = async () => {
      dbl.disabled = true;
      const ok = await showAd(game.s.noAds);
      if (!ok) { dbl.disabled = false; return toast('끝까지 봐야 두 배로 받아요'); }
      mult = AD_OFFLINE_MULT;
      paint();
      dbl.textContent = `✅ ${AD_OFFLINE_MULT}배로 받아요`;
    };
    s.append(
      h('h2', {}, '🌙 다녀오셨어요!'),
      // 관문을 밀었으면 그걸 먼저 말한다. 은자보다 그게 큰 소식이다.
      reward.stages > 0
        ? h('p', { style: 'text-align:center;font-size:15px;font-weight:800;margin:0 0 6px' },
          `제 ${reward.from} 관문 → `,
          h('b', { style: 'color:var(--accent-2)' }, `제 ${reward.to} 관문`),
          h('span', { class: 'muted' }, ` (${reward.stages}관문)`))
        : h('p', { class: 'muted' },
          reward.farming
            ? `${duration(reward.sec)} 동안 제 ${game.s.stage} 관문에서 수련했어요. (수련 중이라 관문은 안 밀었어요)`
            : `${duration(reward.sec)} 동안 제 ${game.s.stage} 관문에서 홀로 수련했어요.`),
      gold, exp,
      // 무엇이 얼마나 자랐는지 적는다. 숫자만 주고 끝내면 뭘 받았는지 모른다.
      ...(reward.stages > 0 && game.s.autoTrain !== false
        ? [h('p', { class: 'muted', style: 'text-align:center;margin:2px 0 8px' },
          '번 것은 수련 · 무공 · 영수 · 제련에 알아서 부었어요')]
        : []),
      dbl,
      h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '받기'),
    );
  }, { dismissable: false, onClose: () => {
    game.claimOffline(reward, mult);
    save(); refreshUI(true);
  } });
}

// 켜고 끄는 줄. 설정에서 쓴다.
function toggleRow(label, on, desc, onChange) {
  const btn = h('button', { class: `btn ${on ? 'good' : ''}`, style: 'padding:6px 12px;min-width:62px' },
    on ? '켜짐' : '꺼짐');
  btn.addEventListener('click', () => {
    const next = btn.textContent === '꺼짐';
    btn.textContent = next ? '켜짐' : '꺼짐';
    btn.classList.toggle('good', next);
    onChange(next);
  });
  return h('div', { class: 'row' },
    h('div', { class: 'info' }, h('div', { class: 'name' }, label), h('div', { class: 'desc' }, desc)), btn);
}

// ---------- 닉네임 / 설정 ----------
function askNickname(first = false) {
  openModal((s) => {
    const input = h('input', { class: 'field', maxlength: 10, placeholder: '2~10글자', value: game.s.nickname || '' });
    const ok = h('button', { class: 'btn primary', style: 'width:100%;margin-top:10px' }, first ? '시작하기' : '변경');
    const submit = () => {
      const name = input.value.trim();
      if (name.length < 2) return toast('닉네임은 2글자 이상이에요');
      game.s.nickname = name;
      save();
      closeModal();
      net.pushProfile(true);
      if (net.guild) {
        net.fs.updateDoc(net.ref('guilds', net.guild.id), { [`members.${net.uid}`]: name }).catch(() => {});
      }
      refreshUI(true);
      return undefined;
    };
    ok.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    s.append(
      h('h2', {}, first ? '우리끼리 회귀무림' : '닉네임 변경'),
      // append(null)은 "null" 글자가 된다. 닉네임을 바꿀 때마다 한 줄 찍혔다.
      ...(first ? [h('p', { class: 'muted' }, '강호에서 불릴 이름(별호)을 정해 주세요. 나중에 설정에서 바꿀 수 있어요.')] : []),
      input, ok);
    setTimeout(() => input.focus(), 50);
  }, { dismissable: !first, onClose: first ? () => (game.needsClass() ? askClass(() => checkReturn()) : checkReturn()) : null });
}

// ---------- 캐릭터 고르기 ----------
// 처음 시작할 때(그리고 없어진 계열을 하던 옛 세이브가 처음 들어올 때) 넷 중 하나를 고른다.
// 닫을 수 없다 — 캐릭터가 없으면 무공 이름도 그림도 정해지지 않는다.
function askClass(after) {
  const legacy = !!game.s.legacyJob || game.s.bestStage > 1;
  openModal((s) => {
    const grid = h('div', { class: 'class-grid' });
    const anims = [];
    for (const j of JOBS) {
      const cv = h('canvas', { width: 140, height: 150 });
      anims.push({ cv, j });
      grid.append(h('button', { class: 'class-card', style: `border-color:${j.color}`, onclick: () => {
        if (!game.setJob(j.id)) return;
        save();
        closeModal();
        buildSkillbar();
        refreshUI(true);
        toast(`${game.tierName()}(으)로 강호에 나섰어요`);
        net.pushProfile(true);
      } },
      cv,
      h('b', { style: `color:${j.color}` }, j.name),
      h('small', {}, `${j.weapon} · ${j.tag}`),
      h('span', { class: 'desc' }, j.desc)));
    }
    s.append(
      h('h2', {}, '캐릭터를 고르세요'),
      h('p', { class: 'muted' }, legacy
        ? '캐릭터가 넷으로 바뀌었어요. 하나를 골라 주세요 — 이번 한 번은 공짜예요. 레벨·관문·장비·무공 레벨은 그대로고, 넘은 관문만큼 전직도 해 둔 채로 시작해요.'
        : '고른 캐릭터의 무공 여덟으로 시작해요. 관문을 넘고 전직 시험에 붙을 때마다 무공이 각성해요. 나중에 원보를 내면 바꿀 수 있어요.'),
      grid);
    // 고르는 동안 넷이 숨을 쉬게 한다 (각자 제 무기를 든다)
    const look = RANKS[game.s.rank].look;
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
  }, { dismissable: false, onClose: () => after?.() });
}

// ---------- 운영자 화면 ----------
//
// 입금이 들어올 때마다 Firebase 콘솔을 여는 건 번거롭다. 폰에서 켤 수 있게 한다.
// **여기 보이는 것만으로는 아무것도 못 한다** — 쓰기는 서버 규칙이 다시 본다.
function openAdmin() {
  openModal((s) => {
    const list = h('div');
    const manual = h('input', { class: 'field', placeholder: '신청 번호 붙여넣기' });
    const bank = h('input', { class: 'field', placeholder: '계좌 (은행 번호 예금주)', value: net.shop?.bank || '' });
    const price = h('input', { class: 'field', placeholder: '값 (예: 5,000원)', value: net.shop?.price || '' });
    const note = h('input', { class: 'field', placeholder: '안내 한 줄 (없어도 됨)', value: net.shop?.note || '' });

    const paint = async () => {
      list.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
      const rows = await net.topPlayers(30);
      const on = await net.whoHasNoAds(rows.map((r) => r.uid));
      list.replaceChildren();
      if (!rows.length) return list.append(h('p', { class: 'muted' }, '아무도 없어요'));
      for (const r of rows) {
        const isOn = on[r.uid] === true;
        const btn = h('button', { class: `btn ${isOn ? '' : 'primary'}`, style: 'padding:6px 10px;min-width:62px' },
          isOn ? '끄기' : '켜기');
        btn.onclick = async () => {
          btn.disabled = true;
          const ok = await net.setNoAds(r.uid, !isOn);
          toast(ok ? `${r.nickname} — ${isOn ? '껐어요' : '켰어요'}` : '서버가 거부했어요');
          paint();
        };
        list.append(h('div', { class: 'row' },
          h('div', { class: 'info' },
            h('div', { class: 'name' }, r.nickname || '이름없음',
              isOn ? h('small', { style: 'color:var(--accent-2)' }, ' · 광고 없음') : null),
            h('div', { class: 'desc' }, `Lv.${r.level} · ${r.bestStage}관문`),
            h('div', { class: 'uidbox' }, r.uid)),
          btn));
      }
    };

    s.append(
      h('h2', {}, '🛡️ 운영자'),
      h('p', { class: 'muted', style: 'margin-top:0' },
        '입금이 확인되면 켜 주세요. 끄면 기록이 지워져요.'),

      h('div', { class: 'section-title' }, '신청 번호로 직접'),
      manual,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: async () => {
          const u = manual.value.trim();
          if (u.length < 20) return toast('신청 번호를 통째로 붙여넣어 주세요');
          toast(await net.setNoAds(u, true) ? '켰어요' : '서버가 거부했어요');
          manual.value = '';
          paint();
        } }, '켜기'),
        h('button', { class: 'btn', onclick: async () => {
          const u = manual.value.trim();
          if (u.length < 20) return toast('신청 번호를 통째로 붙여넣어 주세요');
          toast(await net.setNoAds(u, false) ? '껐어요' : '서버가 거부했어요');
          manual.value = '';
          paint();
        } }, '끄기')),

      h('div', { class: 'section-title', style: 'margin-top:14px' }, '계좌 정보'),
      h('p', { class: 'muted' }, '고치면 바로 모두의 화면에 반영돼요.'),
      bank, price, note,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: async () => {
          const ok = await net.saveShop({ bank: bank.value.trim(), price: price.value.trim(), note: note.value.trim() });
          toast(ok ? '저장했어요' : '서버가 거부했어요');
        } }, '계좌 정보 저장')),

      h('div', { class: 'section-title', style: 'margin-top:14px' }, '서열 상위에서 고르기'),
      list,
      h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '닫기'));
    paint();
  });
}

function openSettings() {
  openModal((s) => {
    const st = game.stats({ buffs: false });
    s.append(
      h('h2', {}, '⚙️ 설정'),
      h('div', { class: 'stat-grid' },
        h('div', {}, '닉네임', h('b', {}, game.s.nickname)),
        // 기기가 옛 판을 들고 있으면 여기 숫자가 뒤처진다. 추측 대신 눈으로 본다.
        h('div', {}, '판', h('b', {}, BUILD)),
        h('div', {}, '서버', h('b', {}, net.online ? '온라인' : '오프라인')),
        h('div', {}, '공격력', h('b', {}, fmt(st.atk))),
        h('div', {}, '체력', h('b', {}, fmt(st.hp))),
        h('div', {}, '초당 피해', h('b', {}, fmt(st.dps))),
        h('div', {}, '공격 속도', h('b', {}, `${st.speed.toFixed(2)}회/초`)),
        h('div', {}, '처치 수', h('b', {}, fmt(game.s.stats.kills))),
        h('div', {}, '뽑기 횟수', h('b', {}, fmt(game.s.stats.gachas)))),
      // 방치 설정 두 가지. 둘 다 켜 두는 게 기본이다.
      h('div', { class: 'section-title', style: 'margin:12px 2px 6px' }, '방치'),
      toggleRow('화면 안 꺼지게', game.s.keepAwake !== false,
        '켜 두면 자는 동안에도 계속 싸워요. 배터리를 더 써요.',
        (on) => { game.s.keepAwake = on; keepAwake(on); save(); }),
      toggleRow('방치하는 동안 수련하기', game.s.autoTrain !== false,
        '번 은자를 가장 싼 수련에 알아서 부어요. 꺼 두면 은자만 쌓여요.',
        (on) => { game.s.autoTrain = on; save(); }),
      toggleRow('관문지기에게 지면 다시 도전', game.s.autoBoss !== false,
        '지면 45초 동안 수련하다가 알아서 다시 붙어요. 꺼 두면 「두목 도전」을 눌러야 해요.',
        (on) => { game.s.autoBoss = on; save(); }),
      toggleRow('관문지기 바로 가기', game.s.bossRush !== false,
        '관문지기를 잡으면 다음 관문도 바로 관문지기부터예요. 꺼 두면 졸개부터 돌아요.',
        (on) => { game.s.bossRush = on; save(); }),
      h('p', { class: 'muted', style: 'margin:4px 2px 0;font-size:11px' },
        '관문을 밀지 않고 제자리에서 벌고 싶으면 들판의 「수련」을 켜세요.'),
      // 기기가 옛 판에 붙들렸을 때의 마지막 수단. 워커·캐시를 통째로 버린다.
      // 세이브는 localStorage라 안 지워진다.
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => {
          toast('새로 받는 중이에요…');
          hardReload();
        } }, '🔄 새로 받기')),
      h('p', { class: 'muted', style: 'margin:4px 2px 0;font-size:11px' },
        '화면이 옛것 같으면 눌러 보세요. 기록은 안 지워져요.'),
      // **append는 null을 "null" 글자로 찍는다.** h()는 걸러 주지만 append는
      // 아니다 — 운영자가 아닌 사람 화면에 null이 한 줄 보이고 있었다.
      ...(net.isAdmin() ? [h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: openAdmin }, '🛡️ 운영자'))] : []),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => {
          // 자동 → 높음 → 가벼움 순으로 돌린다
          perf.mode = perf.mode === 'auto' ? 'high' : perf.mode === 'high' ? 'light' : 'auto';
          try { localStorage.setItem('ifu.q', perf.mode); } catch (e) { /* 비공개 모드 */ }
          applyQuality();
          toast(`화질: ${perf.mode === 'auto' ? '자동' : perf.mode === 'high' ? '높음' : '가벼움'}`);
        } }, '화질 바꾸기'),
        h('button', { class: 'btn', onclick: () => {
          // 높음 → 보통 → 낮음 순으로 돌린다
          const next = FX_PREF[(view.fxPref + 2) % 3];
          view.fxPref = FX_PREF.indexOf(next);
          try { localStorage.setItem('ifu.fx', next); } catch (e) { /* 비공개 모드 */ }
          toast(`무공 연출: ${FX_NAME[next]}${next === 'high' ? '' : ' (가볍게)'}`);
        } }, '연출 간소화'),
        h('button', { class: 'btn', onclick: () => {
          // 끊김은 쓰는 기기에서만 보인다. 숫자를 눈으로 보고 말할 수 있게 한다.
          perf.on = !perf.on;
          let el = document.getElementById('perf');
          if (perf.on && !el) {
            el = h('div', { id: 'perf' }, '재는 중…');
            document.body.appendChild(el);
          } else if (!perf.on && el) el.remove();
          toast(perf.on ? '프레임 표시를 켰어요' : '프레임 표시를 껐어요');
        } }, '프레임 보기'),
        h('button', { class: 'btn', onclick: () => askNickname(false) }, '닉네임 변경'),
        h('button', { class: 'btn', onclick: () => net.online && showProfile(app, { uid: net.uid, ...net.profileData(), updatedAt: null }) }, '내 프로필')),
      h('div', { class: 'section-title', style: 'margin-top:14px' }, '저장 데이터 옮기기'),
      h('p', { class: 'muted' }, '폰을 바꾸거나 앱을 지우기 전에 백업해 두세요. 파일이 가장 안전해요.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: exportFile }, '백업 파일 받기'),
        h('button', { class: 'btn', onclick: importFile }, '백업 파일 넣기')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: exportSave }, '백업 코드 복사'),
        h('button', { class: 'btn', onclick: importSave }, '백업 코드 넣기')),
      h('div', { class: 'section-title', style: 'margin-top:14px' }, '홈 화면에 추가'),
      h('p', { class: 'muted' }, '아이폰: 사파리에서 공유 버튼 → "홈 화면에 추가". 안드로이드: 크롬 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치".'),
      h('div', { class: 'btn-row', style: 'margin-top:14px' },
        h('button', { class: 'btn danger', onclick: resetSave }, '처음부터'),
        h('button', { class: 'btn primary', onclick: closeModal }, '닫기')),
      h('p', { class: 'muted', style: 'text-align:center;margin-top:12px' }, `v${APP_VERSION}`));
  });
}

// ---------- 백업 ----------
// 전에는 세이브 JSON을 그대로 base64로 감쌌다. 그래서 4,500자가 나왔다 —
// 카톡으로 주고받기엔 너무 길다. 셋을 겹쳐 1,400자대로 줄인다.
//   1) 기본값과 같은 항목은 뺀다 (migrate가 다시 채운다)
//   2) gzip으로 압축한다 (브라우저 내장 CompressionStream)
//   3) 옵션 칸의 roll 소수점을 세 자리로 끊는다 (game.js)
// 앞에 '~'를 붙여 새 코드임을 표시한다. base64에는 '~'가 없으니
// 옛 코드와 헷갈릴 일이 없다.
const NEW_MARK = '~';

const b64 = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function squeeze(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  const cs = new CompressionStream('gzip');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}
async function unsqueeze(bytes) {
  const ds = new DecompressionStream('gzip');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

async function makeCode() {
  const json = JSON.stringify(slimSave(game.toJSON()));
  const bytes = new TextEncoder().encode(json);
  const gz = await squeeze(bytes);
  // 압축을 못 쓰는 브라우저면 걷어내기만 한 것으로 간다 (그래도 17%는 줄어든다)
  return NEW_MARK + b64(gz || bytes) + (gz ? '' : '.raw');
}

async function readCode(str) {
  const s = str.trim();
  if (!s.startsWith(NEW_MARK)) return JSON.parse(decodeURIComponent(escape(atob(s))));  // 옛 코드
  const raw = s.endsWith('.raw');
  const body = s.slice(1, raw ? -4 : undefined);
  const bytes = unb64(body);
  const out = raw ? bytes : await unsqueeze(bytes);
  return JSON.parse(new TextDecoder().decode(out));
}

async function exportSave() {
  const code = await makeCode();
  try {
    await navigator.clipboard.writeText(code);
    toast(`백업 코드를 복사했어요 (${code.length}자)`);
  } catch {
    openModal((s) => s.append(h('h2', {}, '백업 코드'), h('textarea', { class: 'field', readonly: true }, code),
      h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px', onclick: closeModal }, '닫기')));
  }
}

// 파일로 받으면 길이는 아예 신경 쓸 일이 없다. 사람이 열어볼 수도 있게
// 압축 없이 보기 좋은 JSON으로 저장한다.
function exportFile() {
  const json = JSON.stringify(game.toJSON(), null, 1);
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const name = `회귀무림_백업_${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}.json`;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('백업 파일을 받았어요');
}

function applySave(data) {
  const out = migrate(data);
  out.lastSeen = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(out));
  stopSaving = true;
  location.reload();
}

function importFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json,.txt';
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      // 파일에 코드를 넣어 둔 경우도 받아 준다
      applySave(text.trim().startsWith('{') ? JSON.parse(text) : await readCode(text));
    } catch {
      toast('파일을 읽지 못했어요');
    }
  });
  inp.click();
}

function importSave() {
  openModal((s) => {
    const ta = h('textarea', { class: 'field', placeholder: '백업 코드를 붙여넣으세요' });
    s.append(h('h2', {}, '백업 코드 넣기'), h('p', { class: 'muted' }, '지금 진행 상황은 덮어씌워져요.'), ta,
      h('div', { class: 'btn-row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: closeModal }, '취소'),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            applySave(await readCode(ta.value));
          } catch {
            toast('코드가 올바르지 않아요');
          }
        } }, '불러오기')));
  });
}

function resetSave() {
  openModal((s) => {
    const input = h('input', { class: 'field', placeholder: '"초기화"라고 입력' });
    s.append(h('h2', {}, '정말 처음부터 할까요?'), h('p', { class: 'muted' }, '모든 진행 상황이 지워져요. 문파에서도 나가게 돼요.'), input,
      h('div', { class: 'btn-row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: closeModal }, '취소'),
        h('button', { class: 'btn danger', onclick: async () => {
          if (input.value.trim() !== '초기화') return toast('"초기화"라고 입력해 주세요');
          await net.leaveGuild().catch(() => {});
          stopSaving = true;
          localStorage.removeItem(SAVE_KEY);
          location.reload();
          return undefined;
        } }, '초기화')));
  });
}

// ---------- 루프 ----------
// 끊김은 평균으로는 안 잡힌다. "가끔 한 프레임이 길다"가 끊김이다.
// 그래서 **최악값과 어느 단계가 길었는지**를 같이 들고 있는다.
// 끄면 거의 공짜다(덧셈 몇 번). 설정에서 켜면 화면 위에 뜬다.
export const perf = {
  on: false, fps: 0, worst: 0, tick: 0, draw: 0, ui: 0,
  _n: 0, _t0: 0, _gap: [],
  // 화질: 'auto'(기본) · 'high' · 'light'. 설정에서 바꾸면 자동이 꺼진다.
  mode: (() => { try { return localStorage.getItem('ifu.q') || 'auto'; } catch (e) { return 'auto'; } })(),
  light: false, _slow: 0, _fast: 0, _g2: [],
};

// **느리면 알아서 가벼워진다.**
//
// 끊김은 쓰는 기기에서만 보인다. 숫자를 받아서 고치는 길만 두면 말 안 하는
// 사람은 영영 버벅이는 화면을 본다. 그래서 게임이 스스로 내려가게 둔다.
// 재는 건 덧셈 몇 번이라 공짜다 — 끄지 않는다.
const SLOW_MS = 26;    // 이보다 느린 프레임이 이어지면 내려간다 (38fps 아래)
const FAST_MS = 18;    // 이보다 빠르면 올라간다 (55fps 위)
function autoQuality(gap) {
  // 숨은 탭은 브라우저가 1fps로 늦춘다. 그걸 느린 기기로 오해하면
  // 창을 내렸다 올릴 때마다 혼자 가벼워진다.
  if (document.hidden || gap > 200) { perf._g2.length = 0; return; }
  perf._g2.push(gap);
  if (perf._g2.length < 60) return;
  const g = perf._g2.sort((a, b) => a - b);
  const mid = g[g.length >> 1];
  perf._g2 = [];
  if (perf.mode !== 'auto') return;
  if (mid > SLOW_MS) { perf._fast = 0; perf._slow++; } else if (mid < FAST_MS) { perf._slow = 0; perf._fast++; } else { perf._slow = perf._fast = 0; }
  // 한 번 느렸다고 바로 내리지 않는다 — 창을 열거나 할 때 한두 번은 튄다.
  if (!perf.light && perf._slow >= 3) { perf.light = true; perf._slow = 0; applyQuality(); }
  // 올릴 때는 더 신중하게. 오르내리기를 반복하면 그게 더 거슬린다.
  else if (perf.light && perf._fast >= 10) { perf.light = false; perf._fast = 0; applyQuality(); }
}
function applyQuality() {
  const want = perf.mode === 'light' ? true : perf.mode === 'high' ? false : perf.light;
  if (view.setLight(want)) {
    toast(want ? '화면이 느려서 가볍게 바꿨어요 (설정에서 되돌릴 수 있어요)' : '화면이 빨라져서 원래대로 돌렸어요');
  }
}
function perfFrame(now, parts) {
  if (!perf.on) return;
  if (!perf._t0) perf._t0 = now;
  perf._n++;
  perf.tick = Math.max(perf.tick, parts.tick);
  perf.draw = Math.max(perf.draw, parts.draw);
  perf.ui = Math.max(perf.ui, parts.ui);
  perf._gap.push(parts.gap);
  if (now - perf._t0 >= 1000) {
    const g2 = perf._gap.sort((a, b) => a - b);
    perf.fps = Math.round(perf._n / ((now - perf._t0) / 1000));
    perf.worst = Math.round(g2[g2.length - 1]);
    perf.p99 = Math.round(g2[Math.floor(g2.length * 0.95)] || 0);
    perf._n = 0; perf._t0 = now; perf._gap = [];
    const el = document.getElementById('perf');
    if (el) el.textContent = `${perf.fps}fps 최악 ${perf.worst}ms (p95 ${perf.p99})`
      + ` · 셈 ${perf.tick.toFixed(1)} 그림 ${perf.draw.toFixed(1)} 창 ${perf.ui.toFixed(1)}ms`
      + ` · ${view.light ? '가벼움' : '높음'}${perf.mode === 'auto' ? '(자동)' : ''}`;
    perf.tick = perf.draw = perf.ui = 0;
  }
}

let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;
let loopErr = 0;
function frame(now) {
  // 한 프레임에서 예외가 나면 그 뒤의 requestAnimationFrame까지 못 가서
  // 루프가 **영구히** 멈춰 있었다. 화면이 까맣게 굳고 복구가 안 된다.
  // 다음 프레임은 반드시 예약한다.
  try {
    step(now);
  } catch (e) {
    if (loopErr++ < 5) console.error('[프레임]', e);
  }
  requestAnimationFrame(frame);
}

function step(now) {
  let dt = (now - last) / 1000;
  const gap = now - last;
  const P = perf.on ? { tick: 0, draw: 0, ui: 0, gap } : null;
  const mark = P ? () => performance.now() : null;
  last = now;
  if (dt > 3) dt = 0; // 백그라운드에서 돌아온 경우는 방치 보상으로 처리
  dt = Math.min(dt, 0.25);
  // **느려지면 더 느려지던 자리다.** dt가 길수록 tick을 더 많이 돌리는데,
  // 그래서 다음 프레임이 더 늦고, 그래서 또 더 돌린다. 한 번 걸리면 그대로
  // 주저앉는다. 쪼개는 건 물리가 튀지 않을 만큼만 하고 거기서 끊는다.
  const steps = Math.min(3, Math.ceil(dt / 0.05));
  const m0 = P ? mark() : 0;
  for (let i = 0; i < steps; i++) game.tick(dt / steps);
  if (P) P.tick = mark() - m0;
  // handleEvents가 draw보다 먼저 돌기 때문에, 첫 프레임에 view.game이 비어 있다.
  // 시작하자마자 쌓인 사건 하나가 좌표를 물으면 거기서 터졌다.
  view.game = game;
  handleEvents();
  const m1 = P ? mark() : 0;
  view.draw(game, dt);
  if (P) P.draw = mark() - m1;
  uiTimer += dt;
  saveTimer += dt;
  if (uiTimer > 0.2) {
    uiTimer = 0;
    const m2 = P ? mark() : 0;
    refreshUI();
    if (P) P.ui = mark() - m2;
  }
  if (saveTimer > 5) {
    saveTimer = 0;
    save();
    net.pushProfile();
    // 켜 둔 채로 자정을 넘긴 경우
    const daily = game.checkDaily();
    if (daily) toast(`📅 오늘의 출석 보상 원보 ${daily.gems}`);
    net.refreshDay();
    updateDots();
  }
  if (P) perfFrame(now, P);
  autoQuality(gap);
}

// ---------- 화면 안 꺼지게 ----------
//
// 방치형인데 **화면이 꺼지면 아무 일도 안 일어난다.** 켜 놓고 기다린다는
// 말이 성립하려면 화면이 안 꺼져야 한다. 브라우저가 주는 길이 이것뿐이다.
// (안 되는 기기도 있다 — 그래서 돌아올 때 따라잡기가 따로 있다)
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (!on) { await wakeLock?.release?.(); wakeLock = null; return; }
    if (wakeLock || !navigator.wakeLock?.request) return;
    wakeLock = await navigator.wakeLock.request('screen');
    // 화면이 한 번 꺼졌다 켜지면 풀린다. 다시 잡는다.
    wakeLock.addEventListener?.('release', () => { wakeLock = null; });
  } catch (err) {
    wakeLock = null;   // 기기가 안 해 주면 그냥 넘어간다
  }
}
const wantAwake = () => game.s.keepAwake !== false;
if (wantAwake()) keepAwake(true);

// 켜 둔 채 화면만 꺼진 것인지, 앱을 아예 껐던 것인지 가른다.
// 켜 둔 채였으면 싸우고 있던 셈이라 관문을 민다.
let hiddenAt = 0;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    if (game.mode === 'raid') game.endRaid(); // 토벌 중 앱을 내리면 지금까지 피해를 기록
    handleEvents();
    save();
    net.pushProfile(true);
  } else {
    last = performance.now();
    // 켜 둔 채 가려져 있었다 = 절전/뒤로 돌림. 관문을 민다.
    checkReturn(Date.now(), hiddenAt > 0);
    hiddenAt = 0;
    if (wantAwake()) keepAwake(true);
  }
});
window.addEventListener('pagehide', () => save());

// ---------- 시작 ----------
// 캔버스에서 쓰는 붓글씨 글자를 미리 받아 둔다 (웹폰트는 쓰이는 글자만 내려받음)
if (document.fonts?.load) {
  const glyphs = '회귀돌파경지은자원보';
  document.fonts.load(`20px "Yuji Syuku"`, glyphs).catch(() => {});
  document.fonts.load(`20px "Nanum Brush Script"`, '관문돌파두목경지수련터입장비무시작문파토벌혈마심마와의대결레벨').catch(() => {});
}
// 시작할 때는 들판이 먼저 보인다. 창은 탭을 눌러야 올라온다.
// showTab('growth');
netChanged('status');
if (perf.mode !== 'auto') applyQuality();   // 저장해 둔 화질을 되살린다
refreshUI(true);
lastUpStage = game.upStage();
requestAnimationFrame((t) => { last = t; frame(t); });
if (!game.s.nickname) askNickname(true);
else if (game.needsClass()) askClass(() => checkReturn());
else checkReturn();
net.init();

// ---------- 새 판 알림 ----------
//
// 배포는 멀쩡한데 기기에만 안 들어가는 일이 실제로 났다. 조용히 새로고침만
// 거는 방식은 그게 안 됐을 때 **쓰는 사람이 할 수 있는 게 없다.**
// 그래서 세 겹으로 둔다:
//   1) 서버의 sw.js에 적힌 판과 지금 돌고 있는 판을 **직접 견준다** —
//      워커가 꼬여 있어도 이건 그냥 fetch라서 늘 맞는 답을 준다
//   2) 다르면 화면 위에 띄운다. 누르면 받는다.
//   3) 설정에 '새로 받기'를 둔다 — 워커·캐시를 통째로 지우고 다시 받는다
let updateBar = null;
function showUpdate(ver) {
  if (updateBar) return;
  updateBar = h('div', { class: 'update-bar' },
    h('span', {}, `새 판이 나왔어요 (${ver || '최신'})`),
    h('button', { class: 'btn primary', onclick: () => hardReload() }, '지금 받기'),
    h('button', { class: 'btn', onclick: () => {
      updateBar.remove();
      updateBar = null;
      document.getElementById('app').classList.remove('has-update');
    } }, '나중에'));
  const app = document.getElementById('app');
  app.append(updateBar);
  // 띠가 상단바를 덮으면 은자·원보가 안 보인다. 그만큼 아래로 민다.
  app.classList.add('has-update');
}

// 워커와 캐시를 통째로 버리고 다시 받는다. 꼬였을 때의 마지막 수단이다.
async function hardReload() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches?.keys?.() || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (err) {
    console.warn('hardReload', err);
  }
  // 주소에 표시를 남겨 브라우저 HTTP 캐시까지 건너뛴다
  const u = new URL(location.href);
  u.searchParams.set('v', Date.now().toString(36));
  location.replace(u.toString());
}

// 서버의 sw.js에 적힌 판을 읽어 지금 판과 견준다
async function checkBuild() {
  try {
    const r = await fetch(`sw.js?ts=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const m = (await r.text()).match(/const CACHE = '([^']+)'/);
    if (m && m[1] !== BUILD) showUpdate(m[1]);
  } catch { /* 오프라인이면 그냥 넘어간다 */ }
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js')
    .then((reg) => {
      reg.update();
      // 기다리는 워커가 이미 있으면 바로 알린다
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(null);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          // 이미 돌고 있는 워커가 있는데 새것이 설치됐다 = 새 판이다
          if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(null);
        });
      });
      // 열어 둔 채로 며칠 지나는 사람이 있다. 돌아올 때마다 다시 본다.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { reg.update(); checkBuild(); }
      });
      setInterval(() => reg.update(), 10 * 60 * 1000);
    })
    .catch((err) => console.warn('sw', err));
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return;
    swReloaded = true;
    location.reload();
  });
}
// 워커가 없거나 꼬여 있어도 이건 돈다
checkBuild();
setInterval(checkBuild, 10 * 60 * 1000);

window.__game = game; // 디버그용
window.__view = view; // 디버그용 — 화면이 안 그려질 때 직접 한 장 그려본다
