import { Game, newSave, migrate } from './game.js';
import {
  SKILLS, KILLS_PER_STAGE, DUNGEON_MOBS, RANKS, MISSIONS, PETS, zoneOf, expToNext,
} from './data.js';
import { BattleView } from './battle.js';
import { Net } from './net.js';
import {
  TABS, h, toast, openModal, closeModal, modalOpen, showProfile, openMissions, rewardText,
} from './ui/index.js';
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
const app = {
  game, net: null, refresh: () => refreshUI(true),
  startRaid, startTrial, startDungeon, sweepDungeon, startPvp,
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
function showTab(name) {
  if (!tabs[name]) tabs[name] = TABS[name](app);
  activeTab = name;
  $('panel').replaceChildren(tabs[name].root);
  $('panel').scrollTop = 0;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  tabs[name].shown?.();
  tabs[name].update();
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

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

// ---------- 스킬 바 ----------
let skillEls = [];
let slotSig = '';
const autoBtn = h('button', { class: 'auto-btn', onclick: () => { game.s.autoSkill = !game.s.autoSkill; refreshUI(true); } }, 'AUTO');
function buildSkillbar() {
  slotSig = game.s.skillSlots.join(',');
  skillEls = game.s.skillSlots.map((id) => {
    const sk = SKILLS.find((x) => x.id === id);
    const cd = h('div', { class: 'cd' });
    const lock = h('div', { class: 'lock' });
    const btn = h('button', { class: 'skill-btn', 'aria-label': sk?.name || '빈 칸', onclick: () => (sk ? game.useSkill(sk.id) : showTab('skill')) }, sk?.icon || '＋', cd, lock);
    return { sk, btn, cd, lock };
  });
  $('skillbar').replaceChildren(...skillEls.map((e) => e.btn), autoBtn);
}
buildSkillbar();

$('btn-boss').addEventListener('click', () => game.challengeBoss());
$('btn-settings').addEventListener('click', openSettings);
$('btn-missions').addEventListener('click', () => openMissions(app));

// ---------- 화면 갱신 ----------
const MODE_TITLE = { raid: '🐲 길드 레이드', trial: '⚔️ 승급 시련', pvp: '⚔️ 결투', dungeon: '🏯 던전' };
function refreshUI(full = false) {
  const s = game.s;
  const c = game.contest;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(s.gems);
  if (c) {
    $('stage-label').textContent = c.mode === 'dungeon' ? `${c.def.name} ${c.level}단계` : MODE_TITLE[c.mode];
    $('zone-label').textContent = c.mode === 'pvp' ? `vs ${c.opponent.nickname}` : c.mode === 'trial' ? `${RANKS[c.rank].name} 승급 도전` : '시간 안에 쓰러뜨리세요';
  } else {
    $('stage-label').textContent = `STAGE ${s.stage}${s.farming ? ' (반복)' : ''}`;
    $('zone-label').textContent = `${zoneOf(s.stage).name} · ${RANKS[s.rank].name} Lv.${s.level}`;
  }
  $('power-label').textContent = `전투력 ${fmt(game.power().power)}`;
  $('exp-bar').firstChild.style.width = `${Math.min(100, (s.exp / expToNext(s.level)) * 100)}%`;

  const prog = $('progress');
  const m = game.mon;
  if (c) {
    prog.classList.add('boss');
    $('progress-fill').style.width = `${(c.time / c.maxTime) * 100}%`;
    $('progress-text').textContent = c.mode === 'dungeon' ? `${Math.min(c.kills, DUNGEON_MOBS)}/${DUNGEON_MOBS} · ${Math.ceil(c.time)}초` : `${Math.ceil(c.time)}초`;
  } else if (m?.isBoss && m.alive) {
    prog.classList.add('boss');
    $('progress-fill').style.width = `${(game.bossTimer / game.bossTimeMax) * 100}%`;
    $('progress-text').textContent = `보스 ${Math.ceil(game.bossTimer)}초`;
  } else {
    prog.classList.remove('boss');
    const k = s.farming ? KILLS_PER_STAGE : Math.min(KILLS_PER_STAGE, s.kills);
    $('progress-fill').style.width = `${(k / KILLS_PER_STAGE) * 100}%`;
    $('progress-text').textContent = s.farming ? '골드 모으는 중' : `${k} / ${KILLS_PER_STAGE}`;
  }
  $('btn-boss').classList.toggle('hidden', !s.farming || !!c);
  $('contest-hud').classList.toggle('hidden', !c || c.mode !== 'raid');
  if (c?.mode === 'raid') {
    $('contest-title').textContent = `🐲 길드 레이드 ${Math.ceil(c.time)}초`;
    $('contest-sub').textContent = `내 피해 ${fmt(c.damage)}`;
  }

  if (game.s.skillSlots.join(',') !== slotSig) buildSkillbar();
  for (const { sk, btn, cd, lock } of skillEls) {
    if (!sk) { btn.classList.add('locked'); continue; }
    const unlocked = game.skillUnlocked(sk);
    btn.classList.toggle('locked', !unlocked || game.mode === 'pvp');
    lock.textContent = unlocked ? `Lv.${s.skills[sk.id]}` : `ST.${sk.unlock}`;
    const left = game.cd[sk.id];
    cd.style.height = unlocked ? `${(left / sk.cd) * 100}%` : '0';
    btn.classList.toggle('ready', unlocked && left <= 0);
  }
  autoBtn.classList.toggle('on', s.autoSkill);
  autoBtn.textContent = s.autoSkill ? 'AUTO\nON' : 'AUTO\nOFF';

  if (activeTab) tabs[activeTab].update();
  if (full) updateDots();
}

// ---------- 이벤트 처리 ----------
let pendingRaid = null;
function handleEvents() {
  for (const ev of game.events) {
    view.handle(ev, game);
    switch (ev.type) {
      case 'gems': toast(`💎 +${ev.amount}`); break;
      case 'stageClear': {
        if (ev.stage % 10 === 0) { toast(`🎉 ${zoneOf(ev.stage + 1).name}에 도착했어요!`); net.pushProfile(true); }
        const sk = SKILLS.find((x) => x.unlock === ev.stage + 1);
        if (sk) toast(`${sk.icon} 새 스킬 「${sk.name}」 해금!`);
        if ([10, 20, 30, 40].includes(ev.stage)) toast('🏯 새 던전이 열렸어요!');
        break;
      }
      case 'levelUp': updateDots(); break;
      case 'missionDone': toast(`📜 미션 완료: ${MISSIONS.find((x) => x.id === ev.id).name}`); updateDots(); break;
      case 'heroDied': if (ev.boss) toast('보스를 못 잡았어요. 강화하고 다시 도전!'); break;
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
      title = win ? '던전 클리어!' : '던전 실패';
      body = win ? `${r.level}단계 클리어! 다음 단계가 열렸어요.` : '시간 안에 못 잡았어요. 열쇠는 그대로예요. 강화하고 다시 도전!';
    } else if (r.mode === 'trial') {
      title = win ? `승급! ${RANKS[r.rank].name}` : '시련 실패';
      body = win ? '공격력·체력 ×1.5, 외형이 바뀌었어요!' : '시련의 기사가 너무 강해요. 조금 더 강해져서 다시 도전하세요.';
    } else if (r.mode === 'pvp') {
      title = win ? '승리!' : '패배…';
      body = `vs ${r.opponent.nickname} · 결투 점수 ${r.delta > 0 ? '+' : ''}${r.delta} (${game.s.pvp.score}점)`;
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

function startTrial() {
  if (!canStart()) return;
  if (!game.startTrial()) return toast('아직 승급 조건이 안 돼요');
  return undefined;
}

function startDungeon(id) {
  if (!canStart()) return;
  if (!game.startDungeon(id)) toast('던전에 들어갈 수 없어요 (열쇠·해금 확인)');
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
  if (p.uid === net.uid) return toast('자기 자신과는 결투할 수 없어요');
  if (game.s.daily.pvpTickets <= 0) return toast('오늘 결투를 다 했어요. 내일 다시!');
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
    if (r.total >= r.maxHp) return toast('오늘의 보스는 이미 처치됐어요');
    if (!game.startRaid(r.maxHp - r.total, r.maxHp)) return toast('오늘 도전 횟수를 다 썼어요');
    pendingRaid = r.id;
    toast('30초 동안 최대한 때려요!');
    save();
  } catch (err) {
    toast(err.message || '레이드를 시작하지 못했어요');
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
    toast(killed ? '🐲 보스 처치! 친구 → 길드에서 보상을 받으세요' : `레이드 피해 ${fmt(damage)} 기록!`);
  } catch (err) {
    toast(`피해 기록 실패: ${err.message}`);
  }
  refreshUI(true);
}

// ---------- 방치 보상 / 일일 보상 ----------
function checkReturn(now = Date.now()) {
  const daily = game.checkDaily(now);
  if (daily) toast(`📅 오늘의 출석 보상 💎${daily.gems}`);
  net.refreshDay?.();
  const reward = game.offlineReward(now);
  game.s.lastSeen = now;
  if (!reward || modalOpen()) return;
  openModal((s) => {
    s.append(
      h('h2', {}, '🌙 다녀오셨어요!'),
      h('p', { class: 'muted' }, `${duration(reward.sec)} 동안 캐릭터가 STAGE ${game.s.stage}에서 사냥했어요.`),
      h('div', { class: 'big-reward' }, `🪙 ${fmt(reward.gold)}`),
      h('p', { style: 'text-align:center;margin-top:-6px' }, `📘 경험치 ${fmt(reward.exp)}`),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '받기'),
    );
  }, { dismissable: false, onClose: () => { game.claimOffline(reward); save(); refreshUI(true); } });
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
      h('h2', {}, first ? '⚔️ 우리끼리 키우기' : '닉네임 변경'),
      first ? h('p', { class: 'muted' }, '친구들에게 보일 닉네임을 정해 주세요. 나중에 설정에서 바꿀 수 있어요.') : null,
      input, ok);
    setTimeout(() => input.focus(), 50);
  }, { dismissable: !first, onClose: first ? () => checkReturn() : null });
}

function openSettings() {
  openModal((s) => {
    const st = game.stats({ buffs: false });
    s.append(
      h('h2', {}, '⚙️ 설정'),
      h('div', { class: 'stat-grid' },
        h('div', {}, '닉네임', h('b', {}, game.s.nickname)),
        h('div', {}, '서버', h('b', {}, net.online ? '온라인' : '오프라인')),
        h('div', {}, '공격력', h('b', {}, fmt(st.atk))),
        h('div', {}, '체력', h('b', {}, fmt(st.hp))),
        h('div', {}, '초당 피해', h('b', {}, fmt(st.dps))),
        h('div', {}, '공격 속도', h('b', {}, `${st.speed.toFixed(2)}회/초`)),
        h('div', {}, '처치 수', h('b', {}, fmt(game.s.stats.kills))),
        h('div', {}, '뽑기 횟수', h('b', {}, fmt(game.s.stats.gachas)))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => askNickname(false) }, '닉네임 변경'),
        h('button', { class: 'btn', onclick: () => net.online && showProfile(app, { uid: net.uid, ...net.profileData(), updatedAt: null }) }, '내 프로필')),
      h('div', { class: 'section-title', style: 'margin-top:14px' }, '저장 데이터 옮기기'),
      h('p', { class: 'muted' }, '폰을 바꾸거나 앱을 지우기 전에 백업 코드를 복사해 두세요.'),
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

const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decode = (str) => JSON.parse(decodeURIComponent(escape(atob(str.trim()))));

async function exportSave() {
  const code = encode(game.toJSON());
  try {
    await navigator.clipboard.writeText(code);
    toast('백업 코드를 복사했어요');
  } catch {
    openModal((s) => s.append(h('h2', {}, '백업 코드'), h('textarea', { class: 'field', readonly: true }, code),
      h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px', onclick: closeModal }, '닫기')));
  }
}

function importSave() {
  openModal((s) => {
    const ta = h('textarea', { class: 'field', placeholder: '백업 코드를 붙여넣으세요' });
    s.append(h('h2', {}, '백업 코드 넣기'), h('p', { class: 'muted' }, '지금 진행 상황은 덮어씌워져요.'), ta,
      h('div', { class: 'btn-row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: closeModal }, '취소'),
        h('button', { class: 'btn primary', onclick: () => {
          try {
            const data = migrate(decode(ta.value));
            data.lastSeen = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            stopSaving = true;
            location.reload();
          } catch {
            toast('코드가 올바르지 않아요');
          }
        } }, '불러오기')));
  });
}

function resetSave() {
  openModal((s) => {
    const input = h('input', { class: 'field', placeholder: '"초기화"라고 입력' });
    s.append(h('h2', {}, '정말 처음부터 할까요?'), h('p', { class: 'muted' }, '모든 진행 상황이 지워져요. 길드에서도 나가게 돼요.'), input,
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
let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 3) dt = 0; // 백그라운드에서 돌아온 경우는 방치 보상으로 처리
  dt = Math.min(dt, 0.25);
  const steps = Math.ceil(dt / 0.05);
  for (let i = 0; i < steps; i++) game.tick(dt / steps);
  handleEvents();
  view.draw(game, dt);
  uiTimer += dt;
  saveTimer += dt;
  if (uiTimer > 0.2) { uiTimer = 0; refreshUI(); }
  if (saveTimer > 5) {
    saveTimer = 0;
    save();
    net.pushProfile();
    // 켜 둔 채로 자정을 넘긴 경우
    const daily = game.checkDaily();
    if (daily) toast(`📅 오늘의 출석 보상 💎${daily.gems}`);
    net.refreshDay();
    updateDots();
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.mode === 'raid') game.endRaid(); // 레이드 중 앱을 내리면 지금까지 피해를 기록
    handleEvents();
    save();
    net.pushProfile(true);
  } else {
    last = performance.now();
    checkReturn();
  }
});
window.addEventListener('pagehide', () => save());

// ---------- 시작 ----------
showTab('growth');
netChanged('status');
refreshUI(true);
requestAnimationFrame((t) => { last = t; frame(t); });
if (!game.s.nickname) askNickname(true);
else checkReturn();
net.init();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('sw', err));
}

window.__game = game; // 디버그용
