import { Game, newSave, migrate } from './game.js';
import { SKILLS, KILLS_PER_STAGE, zoneOf, RAID_TIME } from './data.js';
import { BattleView } from './battle.js';
import { Net } from './net.js';
import { TABS, h, toast, openModal, closeModal, modalOpen, showProfile } from './ui.js';
import { fmt, duration } from './fmt.js';

const SAVE_KEY = 'idleForUs.save.v1';
const APP_VERSION = '0.1.0';
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
const app = { game, net: null, refresh: () => refreshUI(true), startRaid };
const net = new Net(game, { onChange: (what) => netChanged(what) });
app.net = net;

function save() {
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
  if (what === 'raid') updateRaidDot();
}

function updateRaidDot() {
  const btn = document.querySelector('#tabs button[data-tab="guild"]');
  const show = net.canClaimRaid() || (net.guild && !net.checkedInToday());
  let dot = btn.querySelector('.dot');
  if (show && !dot) btn.append(h('i', { class: 'dot' }));
  if (!show && dot) dot.remove();
}

// ---------- 스킬 바 ----------
const skillEls = SKILLS.map((sk) => {
  const cd = h('div', { class: 'cd' });
  const lock = h('div', { class: 'lock' });
  const btn = h('button', { class: 'skill-btn', 'aria-label': sk.name, onclick: () => game.useSkill(sk.id) }, sk.icon, cd, lock);
  $('skillbar').append(btn);
  return { sk, btn, cd, lock };
});
const autoBtn = h('button', { class: 'auto-btn', onclick: () => { game.s.autoSkill = !game.s.autoSkill; refreshUI(true); } }, 'AUTO');
$('skillbar').append(autoBtn);

$('btn-boss').addEventListener('click', () => game.challengeBoss());
$('btn-settings').addEventListener('click', openSettings);

// ---------- 화면 갱신 ----------
function refreshUI(full = false) {
  const s = game.s;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(s.gems);
  const raid = game.mode === 'raid';
  $('stage-label').textContent = raid ? '길드 레이드' : `STAGE ${s.stage}${s.farming ? ' (반복)' : ''}`;
  $('zone-label').textContent = raid ? '길드원과 함께 보스를 잡아요' : `${zoneOf(s.stage).name} · 최고 ${s.maxStage}`;
  $('power-label').textContent = `전투력 ${fmt(game.power().power)}`;

  const prog = $('progress');
  const m = game.mon;
  prog.classList.toggle('hidden', raid);
  if (m?.isBoss && m.alive && !raid) {
    prog.classList.add('boss');
    $('progress-fill').style.width = `${(game.bossTimer / 30) * 100}%`;
    $('progress-text').textContent = `보스 ${Math.ceil(game.bossTimer)}초`;
  } else {
    prog.classList.remove('boss');
    const k = s.farming ? KILLS_PER_STAGE : Math.min(KILLS_PER_STAGE, s.kills);
    $('progress-fill').style.width = `${(k / KILLS_PER_STAGE) * 100}%`;
    $('progress-text').textContent = s.farming ? '골드 모으는 중' : `${k} / ${KILLS_PER_STAGE}`;
  }
  $('btn-boss').classList.toggle('hidden', !s.farming || raid);
  $('raid-hud').classList.toggle('hidden', !raid);
  if (raid) {
    $('raid-time').textContent = Math.ceil(game.raid.time);
    $('raid-dmg').textContent = fmt(game.raid.damage);
  }

  for (const { sk, btn, cd, lock } of skillEls) {
    const unlocked = game.skillUnlocked(sk);
    btn.classList.toggle('locked', !unlocked);
    lock.textContent = unlocked ? '' : `ST.${sk.unlock}`;
    const left = game.cd[sk.id];
    cd.style.height = unlocked ? `${(left / sk.cd) * 100}%` : '0';
    btn.classList.toggle('ready', unlocked && left <= 0);
  }
  autoBtn.classList.toggle('on', s.autoSkill);
  autoBtn.textContent = s.autoSkill ? 'AUTO\nON' : 'AUTO\nOFF';

  if (activeTab) tabs[activeTab].update();
  if (full) updateRaidDot();
}

// ---------- 이벤트 처리 ----------
let pendingRaid = null;
function handleEvents() {
  for (const ev of game.events) {
    view.handle(ev, game);
    if (ev.type === 'gems') toast(`💎 +${ev.amount}`);
    if (ev.type === 'stageClear' && ev.stage % 10 === 0) {
      toast(`🎉 ${zoneOf(ev.stage + 1).name}에 도착했어요!`);
      net.pushProfile(true);
    }
    if (ev.type === 'stageClear') {
      const sk = SKILLS.find((x) => x.unlock === ev.stage + 1);
      if (sk) toast(`${sk.icon} 새 스킬 「${sk.name}」 해금!`);
    }
    if (ev.type === 'heroDied' && ev.boss) toast('보스를 못 잡았어요. 강화하고 다시 도전!');
    if (ev.type === 'raidEnd') finishRaid(ev.damage);
  }
  game.events.length = 0;
}

async function startRaid(btn) {
  if (game.mode === 'raid') return;
  if (btn) btn.disabled = true;
  try {
    const r = await net.ensureRaid();
    if (r.total >= r.maxHp) return toast('오늘의 보스는 이미 처치됐어요');
    if (!game.startRaid(r.maxHp - r.total, r.maxHp)) return toast('오늘 도전 횟수를 다 썼어요');
    pendingRaid = r.id;
    window.scrollTo(0, 0);
    toast(`${RAID_TIME}초 동안 최대한 때려요!`);
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
  try {
    const killed = await net.commitRaidDamage(damage, raidId);
    toast(killed ? `🐲 보스 처치! 길드 탭에서 보상을 받으세요` : `레이드 피해 ${fmt(damage)} 기록!`);
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
    const st = game.stats();
    s.append(
      h('h2', {}, '⚙️ 설정'),
      h('div', { class: 'stat-grid' },
        h('div', {}, '닉네임', h('b', {}, game.s.nickname)),
        h('div', {}, '서버', h('b', {}, net.online ? '온라인' : '오프라인')),
        h('div', {}, '공격력', h('b', {}, fmt(st.atk))),
        h('div', {}, '체력', h('b', {}, fmt(st.hp))),
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
        } }, '초기화')));
  });
}

// ---------- 루프 ----------
let stopSaving = false;
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
    if (!stopSaving) save();
    net.pushProfile();
    // 켜 둔 채로 자정을 넘긴 경우
    const daily = game.checkDaily();
    if (daily) toast(`📅 오늘의 출석 보상 💎${daily.gems}`);
    net.refreshDay();
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.mode === 'raid') game.endRaid(); // 레이드 중 앱을 내리면 지금까지 피해를 기록
    handleEvents();
    if (!stopSaving) save();
    net.pushProfile(true);
  } else {
    last = performance.now();
    checkReturn();
  }
});
window.addEventListener('pagehide', () => { if (!stopSaving) save(); });

// ---------- 시작 ----------
showTab('upgrade');
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
