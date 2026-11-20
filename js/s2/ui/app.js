// 새 시즌 화면 — v524부터 첫 화면(index.html). 옛 게임은 classic.html(세이브는 따로 · ifu.s2.*가 새 시즌).
// 화면은 엔진(js/s2/game.js)만 본다. 시계는 화면 쪽에서만 읽어 엔진에 넘긴다(엔진은 결정론).
import { Game, newGame, COLLECTS, dayKey, weekKey, STAGE_KILLS, GRAID, graidHp0, GTRAIN, WEEK_REW, WB_COMMUNITY, PARTY, partyLv } from '../game.js';
import { raidPhase } from '../online/guild.js';
import { scoreDelta as pvpDelta } from '../online/pvp.js';   // 대결 카드 — 이기면/지면 점수 미리 보기
import { PVP_TIERS } from '../tables/online.js';
import { SAVE_KEY } from '../core/save.js';
import { S2Net } from './net.js';
import { encodeSave, decodeAny } from '../../savecode.js';
import { SLOTS, SLOT_NAME, GRADES, gachaExpNeed, gachaWeights, PITY_N, pityGrade } from '../tables/gear.js';
import { itemStats, gearScore, unequip, equip, equipBest, junkOf, dismantleMany, dismantleItem, newSlot, restoreSlot } from '../gear/gear.js';
import { dismantle as dismantleYield, enhCost, enhOk, starCost, SHARD_PER_TICKET, gachaCost } from '../tables/gearstat.js';
import { starOdds, STAR_MAX, PITY_POINTS, BREAK_FROM, PROTECT_FROM, PROTECT_TO, PROTECT_BREAK_COST_X } from '../tables/star.js';
import { ENH_MAX } from '../tables/gear.js';
import { drawCreature, CREATURES } from '../../creatures.js';
import { drawFighter, femaleHeadKey } from '../../battle.js';
import { hasBodyArt, artReady as artReadyNow } from '../../art.js';
import { RELIC_FIELD, RELIC_EXTRA, PAL_FIELD } from '../tables/relicfield.js';   // v6xx 사냥터 따르는 무리
import { JOBS } from '../tables/char.js';
import { SP_KEYS, SP_EACH, SP_CAP } from '../hero/hero.js';
import { SKILLS, MASTERY, JOB_ADV, masteryCost } from '../tables/skills.js';
import { JOB_LV, LEVEL_MAX } from '../tables/progress.js';
import { COLLECT, AWAKE_NEED, AWAKE_MAX, AWAKE_STEP_P, TOTAL_AWAKE_P, TOTAL_AWAKE_CAP, COLLECT_LV_MAX, COLLECT_LV_P, collectLvCost, REALM_MAX, REALM_ATK_P, REALM_HP_P, realmCost, heartLines, JOURNEY_MAX, JOURNEY_STEP_P, journeyCost } from '../tables/s5.js';
import { DAILY_DUNGEONS, DAILY_RUNS, EXPEDITION, TOWER_MAX, TOWER_BONUS, STAMINA } from '../tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, guideCurrent, achievements, ACHIEVE } from '../tables/missions.js';
const ACH = achievements(), achById = new Map(ACH.map((a) => [a.id, a]));
import { expToNext, mobExp, KILLS_PER_MIN } from '../tables/exp.js';
import { staminaNow, nextRegenMs } from '../content/idle.js';
import { buildQueue } from '../content/offline.js';
import { kindGrade, totalAwake } from '../grow/collect.js';
import { PULL_P, PULL_PITY, PULL_TEN_FLOOR } from '../tables/option.js';
import { loadLooks, zoneFor, drawHero, drawMob, mobName, mobHeight, preloadMobs, drawPaintedBack, drawPaintedLedge, drawEarth, chbImg, preloadChapter, fxImg, oldImg, tintImg, ULT_ART, SEAL_ART, CUT_ART, BUFF_ART, BOSS_ART, wearCount, filtered } from './look.js';
import { BOSS_PATS } from '../tables/kit.js';
import { ADV_MAX, advOf, advPal, ADV_S, ADV_N } from './advfx.js';
// v629 컴퓨터 화면 고정 — pc.html 틀 안이면 틀 바깥이 이 화면을 통째로 키운다(__pcScale). 캔버스는 그만큼 더 촘촘히 그려 흐려지지 않게
const pcFramed = (() => { try { return window.top !== window; } catch { return true; } })();
const pxr = () => (window.devicePixelRatio || 1) * (pcFramed ? window.__pcScale || 1 : 1);
const fsEl = () => { try { return (pcFramed ? window.top.document : document).fullscreenElement; } catch { return document.fullscreenElement; } };   // v628 전직 단계 이펙트 표(평타 · 무공 · 오라가 같이 쓴다)
import { CHBOSS, CB_PATS, CB, WBF, CB_RAID, DEX_REW } from '../tables/chboss.js';
import { DASH } from '../battle/side.js';   // v546 회피
import { uiIcon } from '../tables/uiicons.js';   // v610 창 줄 그림 아이콘
import { NEWS, NEWS_V, newsSince } from '../tables/news.js';   // v560 업데이트 소식
import { ATTEND, ATTEND_DAYS, ATTEND_NAME } from '../tables/attend.js';
import { PASS, PASS_PTS } from '../tables/pass.js';
import { SHOP_FREE } from '../tables/shop.js';   // 받을 보상 칸 — 상점 덤(값 없음)   // 강호 패스
import { WBOSS } from '../tables/online.js';   // 월드보스 하루 횟수 · 싸움 시간
import { TITLES, TITLE_EACH, titleByName } from '../tables/titles.js';
import { play, unlock, setOpt, bgm } from './sound.js';
import { PoseAnim, POSES, IDLE, mixPose } from '../../pose.js';
import { collName, collGly } from '../tables/collnames.js';
// 설정(v504) — 이 기기에만(ifu.s2.opt). 소리 · 배경 가락 · 흔들림 · 피해 숫자 · 진동 · 그래픽 · 피해 측정기
const OPT_KEY = 'ifu.s2.opt';
const opt = Object.assign({ sfx: true, bgm: true, shake: true, nums: 'all', vib: true, vibK: 1, gfx: 'high', dps: false, autoNext: true, saver: true, wake: true, autoGrow: false, agGold: true }, (() => { try { return JSON.parse(localStorage.getItem(OPT_KEY) || '{}'); } catch { return {}; } })());
const saveOpt = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch { /* 저장 못 함 */ } setOpt({ sfx: opt.sfx, bgm: opt.bgm }); if (typeof wakeSync === 'function') wakeSync(); };
setOpt({ sfx: opt.sfx, bgm: opt.bgm });
// 진동 세기(약하게 · 보통 · 세게) — 울리는 길이만 늘이고 줄인다(무늬 사이 쉬는 틈은 그대로)
const VIB_K = [0.6, 1, 1.5], VIB_K_NAME = ['약하게', '보통', '세게'];
const buzz = (ms) => { if (!opt.vib || !navigator.vibrate) return; const k = VIB_K[opt.vibK] ?? 1, sc = (v) => Math.max(1, Math.round(v * k)); try { navigator.vibrate(Array.isArray(ms) ? ms.map((v, i) => (i % 2 ? v : sc(v))) : sc(ms)); } catch { /* 진동 없음 */ } };
// 진동 무늬 — 소리가 없는 지금 손에 닿는 단 하나의 층. 사냥터에선 1초에 4번을 넘지 않고(crit · elite), 무공 · 두목 것(VIB_HI)은 그 제한을 건너뛰되 서로 0.08초 안에는 겹치지 않는다
const VIB = { crit: 8, sk3: 12, sk4: [10, 30, 14], sk5: [14, 30, 14, 30, 24], elite: 18, bossMs: [20, 40, 20], bossKill: [30, 50, 30, 50, 60], bossHurt: 60, die: 200 };
const VIB_HI = new Set(['sk3', 'sk4', 'sk5', 'bossMs', 'bossKill', 'bossHurt', 'die']);
let vibAt = -1e9, vibHiAt = -1e9, vibBusy = 0;
function vib(key) {
  const p = VIB[key]; if (p == null) return; const n = now(), hi = VIB_HI.has(key);
  if (hi ? n - vibHiAt < 80 : (n - vibAt < 250 || n < vibBusy)) return;   // 보통 것은 큰 무늬가 울리는 동안 끼어들지 않는다(무늬를 끊어 먹지 않게)
  vibAt = n; if (hi) { vibHiAt = n; vibBusy = n + (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p) * 1.5; }
  buzz(p);
}
const dmgLog = [];   // 피해 측정기: [시각, 피해] 최근 10초
const killLog = [];
const killRate = () => { const t0 = now() - 60000; while (killLog.length && killLog[0] < t0) killLog.shift(); return killLog.length; };
import { chapterOf, chapterName, CHAPTERS } from '../tables/chapters.js';
import { BUILD } from '../../data.js';   // 설정 맨 아래 판 번호
import { BOSS_LORE } from '../tables/bosslore.js';   // v613 두목 도감 한 줄
import { KIT, SLOT_N, kitCap, kitCost, kitCoef, skillById, treeOf, TREE_GATE, treeResetCost } from '../tables/kit.js';
import { STATS } from '../core/stats.js';
const statTxt = (o) => Object.entries(o).map(([k2, v]) => `${STATS[k2]?.name || k2} +${STATS[k2]?.kind === 'rate' ? `${(v / 10).toFixed(1)}%` : v}`).join(' · ');
import { goldPerMob } from '../tables/gearstat.js';

const $ = (id) => document.getElementById(id);
const now = () => Date.now();
const fmt = (n) => { n = Math.floor(n || 0); if (n >= 1e12) return (n / 1e12).toFixed(1) + '조'; if (n >= 1e8) return (n / 1e8).toFixed(1) + '억'; if (n >= 1e4) return (n / 1e4).toFixed(1) + '만'; return String(n); };
const hms = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };   // 남은 시간 1:23:45
const left = (endMs) => { const s = Math.max(0, Math.ceil((endMs - now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GUIDE_TEXT = { kill: '몹 잡기', level: '레벨 올리기', equip: '장비 끼기', gacha: '장비 뽑기', skill: '무공 올리기', enhance: '장비 강화', dungeon: '던전 깨기', pull: '뽑기', star: '성혼', offline: '방치 보상 받기', realm: '경지 올리기', login: '접속하기', wboss: '월드보스 도전', pvp: '대결 하기', stat: '스탯 점수 찍기', fate: '기연 하나 고르기', shop: '상점에서 덤 받기', shard: '분해 조각을 뽑기권으로', party: '동행 토벌 1단계 깨기', pass: '강호 패스 보상 받기' };   // v522 일일 · 주간 임무에 영문 id가 보이던 것
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
  if (q.ev === 'coll') return `병기 · 동료 · 영물 ${q.cond.split('>=')[1].trim()}가지 모으기`;
  return `${GUIDE_TEXT[q.ev] || q.ev}${q.need > 1 ? ` ${q.need}번` : ''}`;
};
// 임무 창(길잡이 · 일일 · 주간 · 업적 · 오늘) 보상 칩 — 그림 + 수. hunt = 사냥 n분 몫(은자 · 경험치)
const MS_PIC = { 'ticket:gear': 'pull', 'ticket:weapon': 'pullw', 'ticket:pal': 'pullp', 'ticket:relic': 'pullr', 'item:stone': 'stone', 'ticket:time': 'time', 'ticket:exped': 'exped', hunt: 'silver', gold: 'silver' };
const MS_GLY = { 'item:restore': '卷', 'item:heart': '心' };
const msName = (k) => ({ hunt: '사냥', gold: '은자', 'ticket:exped': '원정권', 'item:heart': '심법 구슬' }[k] || ATTEND_NAME[k] || k);
const msGold = (min) => Math.round(min * KILLS_PER_MIN * goldPerMob(g?.S.hero.lv || 1));   // 은자만 주는 n분 몫(길잡이 · 하루 상자) → 지금 레벨 은자
const msRew = (d, huntKey = 'hunt') => { const o = {}; if (d.huntMin) o[huntKey] = d.huntMin; for (const [k, n] of Object.entries(d.items || {})) o[k] = n; return o; };
const msChips = (rw) => `<span class="ms-rw">${Object.entries(rw).map(([k, n]) => `<span class="ms-chip" data-k="${esc(k)}" title="${esc(k === 'hunt' ? `사냥 ${n}분 몫(은자 · 경험치)` : msName(k))}">${MS_PIC[k] ? `<img alt="${esc(msName(k))}" loading="lazy" src="art/s2/ui/${MS_PIC[k]}.webp">` : `<i>${MS_GLY[k] || '·'}</i>`}<b>${k === 'hunt' ? `${n}분` : k === 'gold' ? unit(msGold(n)) : `×${unit(n)}`}</b></span>`).join('')}</span>`;
const msBar = (r, txt) => `<div class="achbar ms-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, r)) * 100)}%"></i><span>${txt}</span></div>`;
// 받기 전후 지갑을 견줘 받은 것을 종류마다 한 줄로(모두 받기 알림)
const msGot = (w0, w1) => Object.keys(w1).filter((k) => (k === 'gold' || MS_PIC[k] || MS_GLY[k]) && (w1[k] || 0) > (w0[k] || 0)).sort((a, b) => (a === 'gold' ? -1 : b === 'gold' ? 1 : 0))
  .map((k) => `${msName(k)} +${unit(Math.round((w1[k] || 0) - (w0[k] || 0)))}`).join(' · ');

// ── 불러오기 / 새로 시작 ──
let g = null;
// bootAt — 이 기기 저장의 마지막 시각을 열면서 읽어 둔 것. 첫 화면이 바로 저장하며 시각을 지금으로 덮으므로, 서버 것과 견줄 때는 이 값을 쓴다(새로 시작한 무인이면 null — 견주지 않고 올린다)
let bootAt = null, atHold = false;   // atHold — 서버 것과 견주기 전(또는 묻는 동안)에는 기기 저장 시각을 그대로 둔다(안 고르고 닫아도 다음에 다시 묻게)
function load() {
  try { const t = localStorage.getItem(SAVE_KEY); if (t) { g = Game.load(t, now()); bootAt = Number(localStorage.getItem(SAVE_KEY + '.at') || 0); atHold = true; } } catch { g = null; bootAt = null; atHold = false; }
}
let frozen = false;   // 시험용: 저장 멈춤
let cloudHold = false;   // 서버 것이 더 새로워 「어느 것을 쓸까요」를 묻는 동안 — 고르기 전에는 서버에 올리지 않는다
function save() { if (frozen) return; try { localStorage.setItem(SAVE_KEY, g.save()); if (!atHold) localStorage.setItem(SAVE_KEY + '.at', String(Date.now())); } catch { /* 저장 공간 없음 */ } }
// v525 계정 · 서버 저장 — 3분마다 · 화면을 떠날 때 올린다(기기를 잃거나 지워도 Google로 되살린다)
const net = new S2Net((w) => { if (w === 'status' && net.online) cloudCheck(); if (open === 'opt' || (w === 'status' && open === 'social' && keyOf() === 'chat:0')) paintWin(); });
let cloudBusy = null;   // 올리는 중인 약속 — 꼭 올려야 할 때(force)는 그것을 기다렸다 다시 올린다
async function cloudPush(force) {
  if (!g || frozen || !net.online || cloudHold) return false;
  if (cloudBusy) { if (!force) return false; await cloudBusy.catch(() => {}); if (cloudBusy) await cloudBusy.catch(() => {}); }
  if (!force && Date.now() - net.lastPush < 170000) return false;
  const p = net.push(g.save(), g.S.hero.lv, g.S.hero.job);
  cloudBusy = p;
  try { await p; rankPush(); pvpInbox(); return true; } catch (err) { console.warn('[s2net] push', err?.code || err); return false; } finally { if (cloudBusy === p) cloudBusy = null; }
}
// v547 서열 — 저장할 때 프로필도(바뀐 때만) · 월드보스는 칠 때마다 주간 점수
const wkStr = (ms) => new Date(weekKey(ms) * 86400000).toISOString().slice(0, 10);   // 그 주 월요일(한국 날) — 10자
function ensureNick() { if (!g.S.nick) g.setNick(`${JOBS[g.S.hero.job]?.name || '무인'}${(net.uid || '0000').slice(-4)}`); }
let socialPre = false;
function rankPush() {
  if (!socialPre && net.online && g) { socialPre = true; guildLoad(true); net.wbTotal(wkStr(Date.now())).then((r) => { wbComState = { ...r, at: Date.now() }; navDots(); }).catch(() => {}); if (guildState.wbLast === undefined) { guildState.wbLast = null; net.top('wb', wkStr(Date.now() - 7 * 86400000), 1).then((r) => { guildState.wbLast = r || { me: 0 }; navDots(); }).catch(() => { guildState.wbLast = { me: 0 }; }); } }
  if (!net.online || !g) return; ensureNick();
  net.pushProfile(g.rankProfile()).catch((e) => console.warn('[s2net] rank', e?.code || e));
  net.pushDeck(g.S.nick, g.pvpDeck(), g.S.pvp?.score ?? 1000, g.S.hero.lv).catch((e) => console.warn('[s2net] deck', e?.code || e));   // v548 방어 덱
}
// v548 대결 — 우편함(받은 공격)을 점수에 · 진짜 상대 찾기(1분마다 새로)
let pvpAt = 0, inboxAt = 0;
function pvpInbox() {
  if (!net.online || !g || Date.now() - inboxAt < 30000) return; inboxAt = Date.now();
  net.pvpInbox().then((list) => { if (!list.length) return; const d = g.pvpDefend(list); save(); toast(`방어 기록 ${list.length}건 · 대결 점수 ${d >= 0 ? '+' : ''}${d}`); addLog(`대결 방어 ${list.length}건 (${d >= 0 ? '+' : ''}${d})`); if (open === 'social') paintWin(); }).catch((e) => console.warn('[s2net] inbox', e?.code || e));
}
function pvpFetch() {
  if (!net.online || !g || Date.now() - pvpAt < 60000) return; pvpAt = Date.now();
  net.pvpFind(g.S.pvp?.score ?? 1000).then((list) => { g.setPvpReal(list); if (open === 'social' || keyOf() === 'party:0') paintWin(); }).catch((e) => console.warn('[s2net] pvp', e?.code || e));
}
function wbPush(score) { if (!net.online || !g || !(score > 0)) return; ensureNick(); net.pushWboss(wkStr(Date.now()), g.S.nick, score).catch((e) => console.warn('[s2net] wboss', e?.code || e)); }
let rankMode = 'power', rankCache = {}, wbComState = null;   // v576
// v549 문파 — 내 문파(서버) · 찾기 목록 · 문파원 프로필. 30초마다 새로 · 바꾸면 바로
const S2NetDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const guildState = { wbLast: undefined, g: null, list: null, prof: null, at: 0, busy: false, msgs: [], chatGid: null, unsub: null, seen: 0 };
// v551 문파 대화 — 문파에 있는 동안 실시간 구독 · 창을 다시 그리지 않고 목록만 고친다(쓰던 글이 지워지지 않게)
function chatWatch(gid) {
  if (guildState.chatGid === gid) return;
  if (guildState.unsub) { guildState.unsub(); guildState.unsub = null; }
  guildState.chatGid = gid; guildState.msgs = []; guildState.draft = '';
  if (!gid || !net.online) return;
  guildState.unsub = net.guildChatWatch(gid, (list) => { guildState.msgs = list; chatPaint(); navDots(); });
}
function chatHtml() {
  const L = guildState.msgs;
  if (!L.length) return '<p class="note">아직 대화가 없어요 — 첫 인사를 남겨 보세요</p>';
  return L.map((m) => { const t = m.createdAt?.toDate ? m.createdAt.toDate() : null, hm = t ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
    return m.type === 'system' ? `<div class="gc-sys">${esc(m.text)}</div>` : `<div class="gc-m ${m.uid === net.uid ? 'me' : ''}"><b>${esc(m.name || '무인')}</b><span>${esc(m.text)}</span><small>${hm}</small></div>`; }).join('');
}
const chatReadKey = () => `ifu.s2.chatRead.${g?.S?.guildId || ''}`;
const chatRead = () => { try { return +localStorage.getItem(chatReadKey()) || 0; } catch { return 0; } };
const chatLast = () => { const m = [...guildState.msgs].reverse().find((x) => x.uid !== net.uid); return m?.createdAt?.toMillis?.() || 0; };
function chatMarkRead() { const t = chatLast(); if (t > chatRead()) { try { localStorage.setItem(chatReadKey(), String(t)); } catch { /* 저장 못 함 */ } navDots(); } }   // v574
function chatPaint() { const el = document.querySelector('#gchat'); if (!el) return; if (el.isConnected) setTimeout(chatMarkRead, 0); const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40; el.innerHTML = chatHtml(); if (atEnd || !el.dataset.init) { el.scrollTop = el.scrollHeight; el.dataset.init = 1; } guildState.seen = guildState.msgs.length ? (guildState.msgs.at(-1).createdAt?.toMillis?.() || 0) : 0; }
function chatSend() {
  const inp = document.querySelector('#gchat-in'); if (!inp || !g.S.guildId) return;
  const t = inp.value.trim(); if (!t) return; inp.value = ''; guildState.draft = ''; ensureNick();
  net.guildSay(g.S.guildId, g.S.nick, t).catch((e) => toast(e?.code === 'permission-denied' ? '보낼 수 없어요(문파원만)' : '보내지 못했어요'));
}
// 전체 대화 — 무림 → 대화 칸이 열린 동안만 실시간 구독(닫기 · 다른 칸 · 절전이면 끊는다) · Lv 10부터 쓴다 · 5초에 하나
const WCHAT = { minLv: 10, gap: 5000, max: 80 };
const worldState = { msgs: [], unsub: null, lastAt: 0, lastText: '', draft: '' };
function worldWatch() { if (worldState.unsub || !net.online) return; worldState.unsub = net.worldChatWatch((list) => { worldState.msgs = list; worldPaint(); }); }
function worldStop() { if (worldState.unsub) { worldState.unsub(); worldState.unsub = null; } }
function worldHtml() {
  const L = worldState.msgs;
  if (!L.length) return `<p class="note">${net.online ? '아직 대화가 없어요 — 첫 인사를 남겨 보세요' : '오프라인이에요 — 연결되면 대화가 보여요.'}</p>`;
  return L.map((m) => { const t = m.at?.toDate ? m.at.toDate() : null, hm = t ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '', jn = JOBS[m.job]?.name || '';
    return `<div class="gc-m wc-m ${m.uid === net.uid ? 'me' : ''}"><b data-uid="${esc(m.uid || '')}"><i>[Lv ${Math.floor(Number(m.lv) || 0)}${jn ? ` ${esc(jn)}` : ''}]</i> ${esc(m.nick || '무인')}${m.guild ? ` <em>${esc(m.guild)}</em>` : ''} :</b><span>${esc(m.text)}</span><small>${hm}</small></div>`; }).join('');
}
function worldPaint() { const el = document.querySelector('#wchat'); if (!el) return; const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40; el.innerHTML = worldHtml(); if (atEnd || !el.dataset.init) { el.scrollTop = el.scrollHeight; el.dataset.init = 1; } }
// 보내기 — 돌려주는 값: true(보냄) · 'off' · 'lv' · 'empty' · 'long' · 'fast' · 'same'(시험에서도 본다)
function worldSend(text) {
  const inp = document.querySelector('#wchat-in'), t = S2Net.worldText(text ?? inp?.value ?? '');
  if (!t) return 'empty';
  if (!net.online) { toast('오프라인이라 보낼 수 없어요'); return 'off'; }
  if (g.S.hero.lv < WCHAT.minLv) { toast(`전체 대화는 Lv ${WCHAT.minLv}부터 쓸 수 있어요`); return 'lv'; }
  if (t.length > WCHAT.max) { toast(`${WCHAT.max}자까지 쓸 수 있어요`); return 'long'; }
  const left = WCHAT.gap - (Date.now() - worldState.lastAt);
  if (left > 0) { toast(`${Math.ceil(left / 1000)}초 뒤에 다시 보낼 수 있어요`); return 'fast'; }
  if (t === worldState.lastText) { toast('같은 말은 이어서 보낼 수 없어요'); return 'same'; }
  const prevAt = worldState.lastAt, prevText = worldState.lastText;
  worldState.lastAt = Date.now(); worldState.lastText = t; worldState.draft = ''; if (inp) inp.value = ''; ensureNick();
  net.worldSay(g.S.nick, t, { lv: g.S.hero.lv, job: g.S.hero.job, guild: g.S.guildId ? guildState.g?.name : '' })
    .catch((e) => { worldState.lastAt = prevAt; worldState.lastText = prevText; if (!worldState.draft) { worldState.draft = t; const i2 = document.querySelector('#wchat-in'); if (i2 && !i2.value) i2.value = t; } toast(e?.code === 'permission-denied' ? '보낼 수 없어요(잠시 뒤 다시)' : '보내지 못했어요'); });
  return true;
}
function guildLoad(force) {
  if (!net.online || !g || guildState.busy || (!force && Date.now() - guildState.at < 30000 && guildState.for === (g.S.guildId || null))) return;
  guildState.busy = true; guildState.at = Date.now(); guildState.for = g.S.guildId || null;   // v554 문파가 바뀌면 바로 다시
  (async () => {
    const G = g.S.guildId ? await net.guildGet(g.S.guildId).catch(() => null) : null;
    if (G && G.memberIds.includes(net.uid)) {
      guildState.g = G; guildState.list = null;
      guildState.raid = await net.graidGet(G.id, wkStr(Date.now())).catch(() => null);   // v550
      guildState.info = await net.guildInfoGet(G.id).catch(() => ({}));   // v573
      chatWatch(G.id);   // v551
      ensureNick(); guildState.train = await net.gtrainSet(G.id, wkStr(Date.now()), g.S.nick, g.gtrainPts()).catch(() => null);   // v552 내 수련 점수 올리고 받기
      if (G.members?.[net.uid] !== g.S.nick && g.S.nick) net.guildRename(G, g.S.nick).catch(() => {});
      net.guildProfiles(G.memberIds).then((ps) => { guildState.prof = Object.fromEntries(ps.map((x) => [x.uid, x])); if (open === 'social' || keyOf() === 'party:0') paintWin(); });   // 동행 칸이 열려 있으면 문파원이 바로 보이게
    } else {
      if (g.S.guildId) { g.setGuild(null); save(); }   // 내보내졌거나 사라진 문파
      chatWatch(null);
      guildState.g = null; guildState.list = await net.guildList().catch(() => []);
    }
  })().finally(() => { guildState.busy = false; if (open === 'social' || keyOf() === 'party:0') paintWin(); });
}
function guildDo(fn, msg) {
  guildState.busy = true; paintWin();
  const was = g.S.guildId;
  fn().then((code) => { g.setGuild(code || null); save(); rankPush(); toast(msg); if (code && code !== was) net.guildSay(code, g.S.nick, `${g.S.nick} 님이 문파에 들어왔어요`, 'system').catch(() => {}); }).catch((e) => toast(e?.message || '할 수 없어요')).finally(() => { guildState.busy = false; guildState.at = 0; guildLoad(true); });
}
async function rankLoad(mode) {
  const k = `${mode}:${wkStr(Date.now())}`, c = rankCache[k];
  if (c && Date.now() - c.at < 30000) return c.r;
  const r = await net.top(mode, wkStr(Date.now()), 50); rankCache[k] = { at: Date.now(), r }; return r;
}
// 처음 연결될 때 — 서버 진행이 이 기기보다 새로우면 고르게 한다(기기가 비었으면 그냥 받는다)
async function cloudCheck() {
  try {
    const d = await net.fetch(), localAt = bootAt ?? Number(localStorage.getItem(SAVE_KEY + '.at') || 0);
    bootAt = null;   // 한 번 견준 뒤로는 지금 시각으로
    if (!d) { atHold = false; cloudPush(true); return; }
    if (!g) { applyCloud(d); return; }
    if (d.at > localAt + 60000) { cloudHold = true; pop('서버에 더 새 진행이 있어요', `<p class="note">서버: Lv.${d.lv} · ${new Date(d.at).toLocaleString()}<br>이 기기: Lv.${g.S.hero.lv} · ${localAt ? new Date(localAt).toLocaleString() : '모름'}</p>`, [['이 기기 것 쓰기', () => { cloudHold = false; atHold = false; save(); cloudPush(true); }], ['서버 것 받기', () => applyCloud(d)]]); }
    else { atHold = false; cloudPush(true); }
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
function start(job) { g = new Game(newGame(job, now(), (now() & 0x7fffffff) || 1), now()); g.S.newsV = NEWS_V; g.emit('login'); save(); firstRun = true; boot(); }   // v614 firstRun — 이 판은 출석 창을 띄우지 않고 길 안내만   // v560 새로 시작하면 볼 소식 없음

// ── 토스트 · 팝업 — 지금 게임과 같은 틀(#toast .toast · #modal .sheet h2 · .btn-row) ──
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('toast').append(d); setTimeout(() => d.remove(), 2700); }
// v595 친구에게 알리기 — 손전화면 공유 창(카톡 · 문자 …), 없으면 주소 복사, 그것도 안 되면 주소를 보여 줌
const shareUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
let shareLast = '';
async function shareGame(code = '') {
  const url = shareUrl() + (code ? `?g=${code}` : ''), title = document.title; shareLast = url;
  if (navigator.share && !navigator.webdriver) { try { await navigator.share({ title, text: code ? `${title} — 우리 문파로 와요(코드 ${code})` : `${title} — 같이 해요`, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast(code ? '초대 주소를 복사했어요 — 친구에게 붙여 보내세요' : '게임 주소를 복사했어요 — 친구에게 붙여 보내세요'); }
  catch (e) { pop('친구에게 알리기', `<p class="note">아래 주소를 길게 눌러 복사하세요</p><p style="word-break:break-all;user-select:all">${esc(url)}</p>`); }
}
// v596 문파 초대 주소(…/?g=코드) — 그 주소로 들어오면(문파가 없고 서버에 이어졌을 때) 「들어갈까요?」를 한 번 묻는다
let inviteCode = (() => { try { const c = (new URLSearchParams(location.search).get('g') || '').toUpperCase(); return /^[A-Z2-9]{6}$/.test(c) ? c : ''; } catch (e) { return ''; } })();
function inviteCheck() {
  if (!inviteCode) return;
  const t0 = Date.now(), iv = setInterval(() => {
    if (!inviteCode || Date.now() - t0 > 180000) { clearInterval(iv); return; }
    if (!g || !net.online || !$('modal').classList.contains('hidden') || document.querySelector('.gx, .duel') || $('res').classList.contains('open') || g.bossFight || g.dg) return;
    clearInterval(iv); const c = inviteCode; inviteCode = '';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* 주소는 그대로 */ }
    if (g.S.guildId) { if (g.S.guildId !== c) toast('이미 문파에 들어 있어요 — 초대는 넘겼어요'); return; }
    pop('문파 초대', `<p class="note">친구가 문파로 불렀어요 — 코드 <b>${esc(c)}</b></p>`, [['나중에', null], ['들어가기', () => { ensureNick(); guildDo(() => net.guildJoin(c, g.S.nick), '문파에 들어갔어요'); }]]);
  }, 1000);
}
function closeModal() { $('modal').classList.add('hidden'); $('modal').classList.remove('first'); $('modal').querySelector('.sheet').classList.remove('rets', 'retsm'); modalOne = null; }
// v594 알림 창 바깥(어두운 곳)을 누르면 닫힌다 — 단추가 「확인」 하나뿐이면 그 단추를 누른 것과 같게, 여럿이면 그냥 닫기(고르지 않음).
//   창이 뜨자마자(0.3초) 누른 것은 잘못 누름으로 보고 넘긴다
let modalOne = null, modalAt = 0;
if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (!$('modal').classList.contains('hidden')) modalAt = Date.now(); }).observe($('modal'), { attributes: true, attributeFilter: ['class'] });
$('modal').addEventListener('click', (e) => {
  if (e.target !== $('modal') || Date.now() - modalAt < 300) return;
  const f = modalOne; if (f) f(); else { closeModal(); paintHud(); }
});
function pop(title, html, acts = [['확인', null]]) {
  const sh = $('modal').querySelector('.sheet');
  sh.classList.toggle('wide', false); sh.classList.remove('enhs', 'attw', 'rets', 'retsm', 'jobpick', 'cl-w', 'cl-sm'); sh.innerHTML = `<h2>${esc(title)}</h2><div>${html}</div><div class="btn-row" style="margin-top:12px${acts.length > 3 ? ';display:grid;grid-template-columns:repeat(3,1fr)' : ''}"></div>`;
  const a = sh.querySelector('.btn-row');
  acts.forEach(([label, fn], i) => { const b = document.createElement('button'); b.className = `btn${i === acts.length - 1 ? ' primary' : ''}`; b.textContent = label; b.onclick = () => { closeModal(); fn?.(); paintHud(); paintWin(); }; a.append(b); });
  modalOne = acts.length === 1 ? () => a.firstChild.click() : null;
  $('modal').classList.remove('hidden');
}

// v613 두목 도감 — 별(그림) · 날짜 · 자세히 창(장 배경 위 큰 그림 · 수치 · 패턴 · 별 · 토벌 바로 가기)
const DEX_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3 6.1 20.5l1.3-6.5L2.5 9.4l6.6-.8z"/></svg>';
const dexStars = (n) => `<span class="dex-st" aria-label="토벌 별 ${n} / 3">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">${DEX_STAR}</i>`).join('')}</span>`;
const dexDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
function dexPop(x) {
  const ch = x.ch, B0 = CHBOSS[ch];
  const pats = [...x.pats, 'ult'].map((p2) => CB_PATS[p2]).filter(Boolean).map((P) => `<span class="pill">${esc(P.name)}${P.x ? ` ×${P.x}` : ''}</span>`).join('');
  const stats = [['레벨', `Lv ${g.raidLv(ch)}`], ['체력', `×${CB.hpX} · 막대 ${CB.bars}줄`], ['제한', `${CB.limitMs / 1000}초`], ['처치', x.beat ? `${g.S.chb?.[ch] || 0}번` : '아직']];
  const html = `<div class="dex-d"><div class="dex-stage" style="background-image:url(art/s2/bg/c${ch}.webp);--bc:${B0.col}"><img src="art/s2/chb/chb${ch}.webp" alt="${esc(x.name)}"></div>
    <div class="dex-info"><small>${ch}장 ${esc(CHAPTERS[ch - 1])} · ${ch * 10}칸</small><b class="dex-tt">${esc(x.title)}</b><p class="dex-lore">${esc(BOSS_LORE[ch] || '')}</p>
    <div class="dex-sg">${stats.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('')}</div>
    <div class="dex-pats">${pats}</div>
    <div class="dex-rec">${dexStars(x.star)}<span>${x.best ? `최고 ${(x.best / 1000).toFixed(1)}초` : '토벌 기록 없음'}${x.at ? ` · 첫 처치 ${dexDate(x.at)}` : ''}${x.manual ? ' · 손으로 피함' : ''}</span></div></div></div>`;
  pop(`${ch}장 · ${x.name}`, html, x.beat ? [['토벌', () => openWin('dgn', 1)], ['닫기', null]] : [['닫기', null]]);
  $('modal').querySelector('.sheet').classList.add('wide', 'dexw');
}

// v620 모음 칸 자세히 — 큰 그림 · 등급 · Lv · 각성 점 · 겹친 수 · 보유/장착 효과(지금 → 다음 레벨 · 다음 각성) · 레벨 업
//   각성과 끼기는 뽑기가 알아서 한다(손으로 하는 것 없음) — 여기서는 보여 주기만
const CL_STAT = { mainDmg: '주 피해', final4: '최종 피해④', final2: '최종 피해②', hpP: '체력' };
const CL_GCOL = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a'];
function collPop(sys, k) {
  const C = g.S.colls[sys], D = COLLECT[sys], o = C.own[k], gr = kindGrade(sys, k), nm = collName(sys, k), W = g.S.wallet;
  const src = `art/s2/coll/${sys}-${k}.webp`, gc = CL_GCOL[gr] || '#aaa';
  if (!o) {
    pop(nm, `<div class="cl-d cl-no" style="--gc:${gc}"><div class="cl-art"><img src="${src}" alt="${esc(nm)} 그림자"></div>
      <div class="cl-info"><small>${D.name} · <b class="g${gr}t">${GRADES[gr]}품</b></small><b class="cl-get">뽑기로 얻어요</b>
      <p class="note">가지기만 해도 ${CL_STAT[D.ownStat]} +${clPm(D.own[gr] * clMul(C))} · 끼면 ${CL_STAT[D.layer]} +${clPm(D.equip[gr] * clMul(C))}</p></div></div>`, [['닫기', null]]);
    $('modal').querySelector('.sheet').classList.add('cl-sm');
    return;
  }
  const mul = clMul(C), slot = C.eq.indexOf(k), sub = slot > 0 && D.subShare ? D.subShare : 1;
  const ownV = (awk) => D.own[gr] * (1 + (awk * AWAKE_STEP_P) / 1000) * mul;
  const eqV = (awk, lv) => D.equip[gr] * (1 + (awk * AWAKE_STEP_P) / 1000) * (1 + (lv * COLLECT_LV_P) / 1000) * mul * sub;
  const lvMax = o.lv >= COLLECT_LV_MAX, awMax = o.awk >= AWAKE_MAX, need = awMax ? 0 : AWAKE_NEED[o.awk], have = Math.max(0, o.n - 1);
  const dots = Array.from({ length: AWAKE_MAX }, (_, i) => `<i class="${i < o.awk ? 'on' : ''}"></i>`).join('');
  const rows = [
    [`보유 · ${CL_STAT[D.ownStat]}`, ownV(o.awk), null, awMax ? null : ownV(o.awk + 1)],
    [`장착 · ${CL_STAT[D.layer]}${sub < 1 ? ` (부 칸 ×${Math.round(sub * 100)}%)` : ''}`, eqV(o.awk, o.lv), lvMax ? null : eqV(o.awk, o.lv + 1), awMax ? null : eqV(o.awk + 1, o.lv)],
  ];
  const html = `<div class="cl-d" style="--gc:${gc}"><div class="cl-art"><img src="${src}" alt="${esc(nm)}">${slot >= 0 ? `<u>장착 ${slot + 1}번 칸</u>` : ''}</div>
    <div class="cl-info"><small>${D.name} · <b class="g${gr}t">${GRADES[gr]}품</b></small>
      <div class="cl-lv"><span>Lv <b>${o.lv}</b>/${COLLECT_LV_MAX}</span><span class="cl-awk" aria-label="각성 ${o.awk} / ${AWAKE_MAX}">각성 ${dots} <b>${o.awk}/${AWAKE_MAX}</b></span></div>
      <div class="cl-cp">${awMax ? '각성 끝 · 겹친 것 ' + have + '개' : `겹친 것 <b>${have}</b> / 다음 각성 ${need}개`}<div class="cl-bar"><i style="width:${awMax ? 100 : Math.min(100, Math.round((have / need) * 100))}%"></i></div></div>
      <div class="cl-ef"><div class="cl-h"><span>효과</span><span>지금</span><span>Lv+1</span><span>각성+1</span></div>${rows.map(([l, a, b, c]) => `<div><span>${l}</span><b>${clPm(a)}</b><span>${b == null ? '—' : clPm(b)}</span><span>${c == null ? '—' : clPm(c)}</span></div>`).join('')}</div>
      <p class="note">${slot >= 0 ? '낀 것' : `안 낌 · 장착 칸 ${C.eq.length}개는 좋은 것부터 저절로 껴요`} · 겹치면 저절로 각성</p></div></div>`;
  pop(nm, html, [['닫기', null]]);   // 레벨 올리기 재료(정수)를 얻을 곳이 아직 없어 단추는 뺐다 — 보기만
  const sh = $('modal').querySelector('.sheet'); sh.classList.add('cl-w');
}
const clMul = (C) => 1 + Math.min(TOTAL_AWAKE_CAP, totalAwake(C) * TOTAL_AWAKE_P) / 1000;
const clPm = (v) => `${(v / 10).toFixed(1)}%`;

// 기연 — 카드 셋 중 하나. 닫아도 같은 카드가 남는다(다시 굴리지 않음)
const FATE_VIEW = { gold: ['銀', '은자'], exp: ['經', '경험치'], 'ticket:gear': ['裝', '장비 뽑기권'], 'item:stone': ['石', '강화석'], 'ticket:weapon': ['兵', '병기 뽑기권'], 'ticket:pal': ['友', '동료 뽑기권'], 'ticket:relic': ['靈', '영물 뽑기권'], 'ticket:time': ['時', '시간 티켓'] };
const fateAmt = (c) => (c.k === 'gold' || c.k === 'exp' ? `+${unit(c.n)}` : `× ${c.n}`);
// 카드 앞면 그림(art/s2/ui) · 테두리 등급(흔함 금빛 · 뽑기권 · 강화석 파랑 · 드문 것(무게 4) 보라)
const FATE_PIC = { gold: 'silver', exp: 'mastery', 'ticket:gear': 'pull', 'item:stone': 'stone', 'ticket:weapon': 'pullw', 'ticket:pal': 'pullp', 'ticket:relic': 'pullr', 'ticket:time': 'time' };
const fateTier = (k) => (k === 'gold' || k === 'exp' ? 'c' : k === 'ticket:gear' || k === 'item:stone' ? 'b' : 'p');
function fatePop() {
  const cards = g.fateOpen(); if (!cards) return;
  save();
  const sh = $('modal').querySelector('.sheet'), left = g.fateState().ready - 1, low = opt.gfx === 'low';
  sh.classList.remove('wide', 'enhs');
  sh.innerHTML = `<h2>기연</h2><p class="note">셋 중 하나를 골라요.</p><div class="fate-row${low ? ' fate-up fate-low' : ' fate-deal'}">${cards.map((c, i) => { const v = FATE_VIEW[c.k] || ['緣', c.k], pic = FATE_PIC[c.k]; return `<button class="fate-card fate-t${fateTier(c.k)}" data-i="${i}" style="--fd:${i * 120}ms" aria-label="${esc(`${v[1]} ${fateAmt(c)}`)}"><span class="fate-in"><span class="fate-back" aria-hidden="true"><em>緣</em></span><span class="fate-face"><i class="fate-ic">${pic ? `<img src="art/s2/ui/${pic}.webp" alt="" decoding="async" onerror="this.remove()">` : ''}<u>${v[0]}</u></i><span>${v[1]}</span><b>${fateAmt(c)}</b></span></span></button>`; }).join('')}</div>${left > 0 ? `<div class="fate-left">남은 기연 ${left}번</div>` : ''}`;
  const row = sh.querySelector('.fate-row');
  let busy = false, tUp = 0;
  const faceUp = () => { clearTimeout(tUp); row.classList.remove('fate-deal'); row.classList.add('fate-up'); };   // 돌리는 중에 누르면 바로 앞면으로
  if (!low) tUp = setTimeout(() => { row.classList.add('fate-flip'); tUp = setTimeout(faceUp, 2 * 120 + 360); }, 2 * 120 + 300);   // 깔기(120ms씩) → 뒤집기(0.35초씩)
  row.addEventListener('pointerdown', (e) => { if (!row.classList.contains('fate-up')) { faceUp(); if (e.target.closest('.fate-card')) row.dataset.skip = '1'; } }, true);
  for (const b of sh.querySelectorAll('.fate-card')) b.onclick = () => {
    if (busy) return;
    if (row.dataset.skip) { delete row.dataset.skip; return; }   // 앞면으로 넘기려고 누른 것 — 고르지는 않는다
    if (!row.classList.contains('fate-up')) { faceUp(); return; }
    const c = g.fatePick(Number(b.dataset.i)); if (!c) { closeModal(); paintHud(); return; }   // 창이 열린 사이 자동 성장이 먼저 골랐으면 — 눌러도 아무 일 없는 창으로 남지 않게 닫는다
    busy = true; buzz(30); save();
    const done = () => {
      toast(`기연 — ${(FATE_VIEW[c.k] || ['', c.k])[1]} ${fateAmt(c)}`);
      if (row.isConnected) closeModal(); paintHud(); if (open) paintWin();
      if (g.fateState().ready > 0) fatePop();
    };
    if (low) { done(); return; }
    row.classList.add('fate-picked'); b.classList.add('fate-sel');
    const fx = document.createElement('span'); fx.className = 'fate-fx';
    for (let k = 0; k < 12; k++) { const sp = document.createElement('i'), a = (k / 12) * Math.PI * 2 + Math.random() * 0.4, d = 70 + Math.random() * 40; sp.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`; fx.append(sp); }
    b.append(fx);
    setTimeout(done, 480);
  };
  modalOne = null;
  $('modal').classList.remove('hidden');
}

// ── 창 — 지금 게임과 같은 일곱 창(들판 양옆 단추 · 창 머리 줄) + 설정(⚙). 칸은 붉은 알약(.subtabs .seg.wide) ──
const TABS = [
  ['char', '캐릭터', [['스탯', 'hero:0'], ['무공', 'hero:1'], ['무공 강화', 'hero:4'], ['마스터리', 'hero:2'], ['전직', 'hero:3'], ['칭호', 'title:0'], ['기록', 'rec:0']]],
  ['bag', '장비', [['장착', 'gear:0'], ['뽑기', 'gear:1'], ['강화·성혼', 'gear:2'], ['가방', 'gear:3'], ['외형', 'look:0']]],
  ['comp', '동료', [['병기', 'grow:0'], ['동료', 'grow:1'], ['영물', 'grow:2']]],
  ['dgn', '던전', [['수련동', 'content:0'], ['토벌', 'raid:0'], ['무한 탑', 'content:1'], ['원정', 'content:2'], ['동행', 'party:0']]],
  ['map', '지도', [['스테이지', 'content:3'], ['두목 도감', 'dex:0']]],
  ['town', '임무', [['오늘', 'today:0'], ['출석', 'attend:0'], ['길잡이', 'mission:0'], ['일일', 'mission:1'], ['주간', 'mission:2'], ['업적', 'ach:0'], ['경지', 'grow:3'], ['강호행', 'grow:4'], ['상점', 'shop:0'], ['패스', 'pass:0'], ['현상수배', 'bounty:0']]],
  ['social', '무림', [['서열', 'rank:0'], ['월드보스', 'rival:0'], ['대결', 'rival:1'], ['문파', 'rival:2'], ['대화', 'chat:0']]],
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
let dgIv = 0;   // v6xx 수련동 · 원정 — 창이 열려 있는 동안만 1초마다 남은 시간을 고친다(닫으면 멈춤)
const dgStop = () => { clearInterval(dgIv); dgIv = 0; };
let open = null, tab = 0, treeSel = null, eqSel = null, lkPrev = {};   // lkPrev: 외형 창에서 눌러 입혀 보는 중인 것(부위 → 등급) · 「이 외형으로」 전에는 보이기만
let bagF = 'all', bagSort = 'g', bagJunkG = 3, bagMore = false, bagAsk = false;   // v521 가방 보기 · 일괄 분해 한 번 더 묻기
// 가방 「NEW」 — 가방을 지난번 열었을 때 없던 것(화면만 · 이 기기에만 기억)
const BAG_SEEN = 'ifu-s2-bagSeen';
let bagNew = new Set(), bagIn = false;
function bagMark(G) {
  let seen = null; try { const s = localStorage.getItem(BAG_SEEN); if (s) seen = new Set(JSON.parse(s)); } catch (e) { seen = null; }
  if (!bagIn) { bagNew = new Set(); bagIn = true; }
  if (seen) for (const it of G.bag) if (!seen.has(it.uid)) bagNew.add(it.uid);
  try { localStorage.setItem(BAG_SEEN, JSON.stringify([...G.bag, ...Object.values(G.eq).filter(Boolean)].map((x) => x.uid))); } catch (e) { /* 저장 못 해도 화면은 그대로 */ }
}
// 장비 아이콘: 지금 게임 그림(무기 · 방어구 · 장신구 × 등급 6)
// v515 장비 그림 — 부위 열 × 등급 일곱(무기는 지금 무인 직업 다섯), 빈 칸은 그 부위 범급을 흐리게
const eqIcon = (sl, it) => `art/s2/eq/${sl === 'weapon' ? `w-${g?.S?.hero?.job || 'sword'}` : sl}-${it ? Math.min(6, it.g) : 0}.webp`;
// 가방에서 이 칸에 낀 것보다 좋은 것(가장 좋은 하나) — 「최고 장비 모두 끼기」와 같은 잣대
function bestFor(sl) {
  const G = g.S.gear, L = g.S.hero.lv, cur = G.eq[sl], s0 = cur ? gearScore(cur, L) : -Infinity;
  let best = null, bs = s0;
  for (const x of G.bag) if (x.slot === sl) { const s = gearScore(x, L); if (s > bs) { bs = s; best = x; } }
  return best;
}
// 이 칸에 it를 끼면 전투력(화면에서만 잠깐 바꿔 셈 · 바로 되돌림)
function powerWith(sl, it) { const G = g.S.gear, prev = G.eq[sl]; G.eq[sl] = it; try { return g.power(); } finally { G.eq[sl] = prev; } }
let eqCand = null;   // 장착 창 「가방에서 고르기」에서 고른 후보(uid)
function eqCell(sl) {
  const it = g.S.gear.eq[sl], S2 = g.S.gear.slots[sl], b = document.createElement('button'), best = bestFor(sl);
  b.className = `eqcell gr-cell ${it ? 'g' + it.g : 'empty'} ${eqSel === sl ? 'sel' : ''}${best ? ' gr-has-up' : ''}`;
  if (it) b.style.setProperty('--gc', GX_COL[it.g]);
  b.innerHTML = `<img src="${eqIcon(sl, it)}" alt="${SLOT_NAME[sl]}" style="${it ? '' : 'opacity:.25'}"><span class="en">${S2.enh ? '+' + S2.enh : ''}</span><span class="sr">${S2.star ? '★' + S2.star : ''}</span>${best ? '<i class="gr-up" title="가방에 더 좋은 것">▲</i>' : ''}<span class="nm">${SLOT_NAME[sl]}</span>`;
  if (best) b.setAttribute('aria-label', `${SLOT_NAME[sl]} — 가방에 더 좋은 것`);
  // v528 낀 장비를 누르면 바로 강화 창 · ▲(가방에 더 좋은 것)이면 아래에 바로 비교
  b.onclick = () => {
    play('click');
    if (best) { eqSel = sl; eqCand = best.uid; paintWin(); requestAnimationFrame(() => document.querySelector('.gr-cmp')?.scrollIntoView({ block: 'nearest' })); }
    else if (it) enhPop(sl); else { eqSel = eqSel === sl ? null : sl; eqCand = null; paintWin(); }
  };
  return b;
}
// ── 장비 뽑기 연출(v497) ── 카드가 차례로 뒤집힌다. 보(4)↑는 뒤집기 전에 두근(떨림 · 빛) · 신(5)↑는 화면이 번쩍 · 건너뛰기
const GX_COL = ['#9ca3af', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
const optGfx = () => opt.gfx;   // showGacha 안에서는 opt가 인자라 설정은 이걸로
// 장비 뽑기 n번 — 연출 창의 「한 번 더」도 같은 길로(뽑기권 n장 또는 은자)
function gearPull(n) {
  const r2 = g.pullGear(n);
  if (r2) showGacha(r2, { again: act(() => gearPull(n)), can: () => { const W = g.S.wallet; return (W['ticket:gear'] || 0) >= n || gachaCost(g.S.hero.lv, g.S.gacha.lv).every((x) => (W[x.k] || 0) >= Math.floor(x.n * n)); } });
  return r2;
}
function showGacha(r, opt = {}) {   // v558 opt: { title, face(it) } — 병기 · 동료 · 영물 뽑기도 같은 카드 뒤집기
  const prev = document.querySelector('.gx'); if (prev) prev.parentNode.removeChild(prev);
  const ov = document.createElement('div'); ov.className = 'gx';
  const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  const best = Math.max(...r.items.map((i) => i.g));
  ov.innerHTML = `<div class="gxt">${opt.title || '장비 뽑기'} ${r.items.length}번</div><div class="gxs"></div><div class="gxg ${r.items.length > 10 ? 'many' : ''}"></div><div class="gxb"><button class="btn skip">건너뛰기</button>${opt.again ? '<button class="btn primary again hidden">한 번 더</button>' : ''}</div>`;
  const grid = ov.querySelector('.gxg'), eqd = new Set(r.got.filter((x) => x.equipped).map((x) => x.it?.uid));
  const cards = r.items.map((it) => {
    const c = document.createElement('div'); c.className = `gc g${it.g}`; c.style.setProperty('--gc', GX_COL[it.g] || '#fff');
    c.innerHTML = `<div class="back"></div><div class="face">${opt.face ? opt.face(it) : `<img src="${eqIcon(it.slot, it)}" alt="${SLOT_NAME[it.slot]}"><b class="g${it.g}t">${GRADES[it.g]}</b><small>${SLOT_NAME[it.slot]}</small>${eqd.has(it.uid) ? '<i>장착</i>' : ''}`}</div>`;
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
    // v624 다 뒤집으면 — 등급별 장수 칩 · 새로 n · 진(3)↑ 가장 좋은 것에 「최고」 띠와 도는 빛살(그래픽 낮음이면 빛살 없음)
    const cnt = []; r.items.forEach((it) => { cnt[it.g] = (cnt[it.g] || 0) + 1; });
    const nNew = opt.fresh ? new Set(r.items.filter(opt.fresh).map((it) => it.k)).size : 0, nEq = r.got.filter((x) => x.equipped).length;
    ov.querySelector('.gxs').innerHTML = cnt.map((n, gr) => (n ? `<span class="gxs-c" data-g="${gr}" data-n="${n}" style="--gc:${GX_COL[gr]}">${GRADES[gr]} <b>${n}</b></span>` : '')).join('')
      + (opt.fresh ? `<span class="gxs-n">새로 <b>${nNew}</b></span>` : nEq ? `<span class="gxs-n">장착 <b>${nEq}</b></span>` : '');
    if (best >= 3) cards.forEach((c, k) => { if (r.items[k].g === best) { c.classList.add('top'); if (optGfx() !== 'low') c.classList.add('rays'); c.insertAdjacentHTML('beforeend', '<em class="gx-rib">최고</em>'); } });
    const ag = ov.querySelector('.again'); if (ag) { ag.classList.remove('hidden'); ag.disabled = !!opt.can && !opt.can(); }
    ov.querySelector('.skip').textContent = '닫기';
    ov.querySelector('.gxt').textContent = opt.done ? opt.done(best) : r.got.some((x) => x.equipped) ? '더 좋은 것은 바로 장착했어요' : `가장 좋은 것: ${GRADES[best]}`;
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
  const ag = ov.querySelector('.again'); if (ag) ag.onclick = (e) => { e.stopPropagation(); if (done && !ag.disabled) opt.again(); };   // 같은 뽑기를 한 번 더(새 창으로 바뀐다)
  ov.onclick = () => { if (done) close(); else finish(); };   // 뒤집는 중에 아무 데나 누르면 한꺼번에
}
function openWin(id, t = 0) { open = id; tab = t; document.body.classList.add('winopen'); $('panel').classList.add('open'); $('panel-dim').classList.add('open'); paintWin(); paintNav(); }
// 상점 머리의 자정(한국 시각)까지 남은 시간 — 창이 상점일 때만 1초마다 고치고, 날이 바뀌면 창을 새로 그린다
let shopClock = 0;
function shopLeftTxt() { const t = now(), ms = Math.max(0, (dayKey(t) + 1) * 864e5 - 324e5 - t), s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} 남음`; }
function shopClockOff() { if (shopClock) { clearInterval(shopClock); shopClock = 0; } }
function shopClockOn() {
  shopClockOff(); const d0 = dayKey(now());
  shopClock = setInterval(() => { const el = document.querySelector('#sh-clock'); if (!open || keyOf() !== 'shop:0' || !el) { shopClockOff(); return; } if (dayKey(now()) !== d0) { paintWin(); return; } el.textContent = shopLeftTxt(); }, 1000);
}
function closeWin() { shopClockOff(); open = null; lkPrev = {}; bagIn = false; bagAsk = false; worldStop(); dgStop(); ptStop(); document.body.classList.remove('winopen'); $('panel').classList.remove('open'); $('panel-dim').classList.remove('open'); paintNav(); }
function paintNav() {
  if (!$('ptabs').children.length) for (const [id, name] of MAIN_TABS) { const b = document.createElement('button'); b.dataset.tab = id; b.innerHTML = `${ico(id)}<span>${name}</span>`; b.onclick = () => { play('click'); openWin(id); }; $('ptabs').append(b); }
  for (const b of document.querySelectorAll('.nb[data-tab], #ptabs button[data-tab]')) b.classList.toggle('active', b.dataset.tab === open);
  navDots();
}
// 빨간 점 — 지금 누를 게 있는 창(캐릭터: 전직 · 무공 점수 · 올릴 수 있는 무공 / 가방: 뽑기권 10장↑ / 마을: 길잡이 받기)
const dotSeen = (() => { try { return JSON.parse(localStorage.getItem('ifu.s2.dots') || '{}'); } catch { return {}; } })();
let dotSaved = '';
// v554 무림에 받을 것이 있으면 이름표(빨간 점) — 서버에서 불러 둔 것만 본다(없으면 조용히)
function socialTodo() {
  if (!g) return '';
  const out = [];
  if (g.pvpWeekReward()) out.push('pvp');
  const lastWk = wkStr(Date.now() - 7 * 86400000), wr = guildState.wbLast;
  if (wr?.me && !g.S.wbGot?.[lastWk]) out.push('wb');
  if (wbComState && WB_COMMUNITY.filter((x) => (wbComState.sum || 0) >= x.at).length > g.wbCommunityGot()) out.push('wbcom');   // v577 공동 토벌 단계 보상
  const G = guildState.g;
  if (g.S.guildId && G) {
    if (g.S.gChk !== dayKey(now())) out.push('gchk');
    if (chatLast() > chatRead()) out.push('chat');   // v574 안 읽은 문파 대화
    const RD = guildState.raid; if (RD) { const tot = Object.values(RD.dmg || {}).reduce((a, b) => a + b, 0), lvR = RD.lv || Math.max(10, Math.floor(g.S.hero.lv / 10) * 10); if (raidPhase(tot, graidHp0(lvR)).phase > g.graidState().claimed) out.push('raid'); }
    const TR = guildState.train; if (TR && !g.gtrainState().got && Object.values(TR.pts || {}).reduce((a, b) => a + b, 0) >= GTRAIN.perMember * G.memberIds.length) out.push('train');
  }
  return out.join(',');
}
function navDots() {
  const S = g.S, h = g.hero, W = S.wallet;
  let kitUp = 0;
  try { const K = h.kitState(); for (const id of Object.keys(K.lv)) { const sk = skillById(id); if (sk && h.canKitUp(id) && (W.gold || 0) >= kitCost(K.lv[id], sk.tier)[0].n) kitUp++; } } catch { /* 없음 */ }
  const cur = guideCurrent(S.q.guide), canAdv = !!h.canAdvance?.(), tree = g.treePts?.().left || 0, tix = W['ticket:gear'] || 0;
  // v520 빨간 점은 「새로 생긴 할 일」만 — 늘 켜져 있던 것(올릴 무공이 거의 늘 있다)을, 그 창을 한 번 열면 다음 새 일까지 끈다
  const sig = { char: canAdv || tree > 0 || kitUp ? `${canAdv ? 1 : 0}|${tree}|${kitUp}|${S.hero.adv || 0}` : '', bag: tix >= 10 ? `${Math.floor(tix / 10)}` : '', town: (g.canAttend() ? 'attend' : '') || (g.todayChest().can ? 'today' : '') || (g.shopFreeCan() ? 'shop' : '') || (g.passCan() ? 'pass' : '') || (g.bountyCan() ? `bty${g.bountyCan()}` : '') || (cur && S.q.guide[cur.id]?.done ? cur.id : '') || (g.books.ach.claimable().length ? `ach${g.books.ach.claimable().length}` : '') };
  if (open && sig[open] !== undefined) dotSeen[open] = sig[open];
  sig.social = socialTodo();   // v554 무림: 받을 것(주간 보상 · 문파 출석 · 토벌 단계 · 수련)
  const on = { char: !!sig.char && sig.char !== dotSeen.char, bag: !!sig.bag && sig.bag !== dotSeen.bag, town: !!sig.town, social: !!sig.social, dgn: g.towerMsCan() > 0 };   // v616 탑 이정표 상자
  for (const b of document.querySelectorAll('.nb[data-tab], #ptabs button[data-tab]')) b.classList.toggle('dot-on', !!on[b.dataset.tab]);
  const ds = JSON.stringify(dotSeen); if (ds !== dotSaved) { dotSaved = ds; try { localStorage.setItem('ifu.s2.dots', ds); } catch { /* 저장 못 해도 */ } }
}
// 무공 아이콘(art/s2/skill/<id>.webp) — 그림이 안 뜨면 빛깔 동그라미에 첫 글자
const skIco = (sk) => `<span class="sk-ic" style="--c:${sk.col}"><b>${esc(sk.name[0])}</b><img src="art/s2/skill/${sk.id}.webp" alt="" decoding="async" onerror="this.remove()"></span>`;
let mpScroll = { ch: 0, x: 0 };   // v6xx 지도 장 카드 띠 — 다시 그려도 넘긴 자리 그대로 · 장이 바뀌면 지금 장으로
let rlBurst = 0;   // 경지를 막 올린 때 — 다음 그리기에서 금빛 물결 한 번
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
  const wFocus = document.activeElement?.id === 'wchat-in', gFocus = document.activeElement?.id === 'gchat-in';
  const chatAt = (id) => { const el = document.querySelector(id); return el && el.dataset.init && el.scrollHeight - el.scrollTop - el.clientHeight >= 40 ? el.scrollTop : null; };   // 대화를 올려 읽던 자리(맨 아래였으면 null) — 창을 다시 그려도 그대로
  const wAt = chatAt('#wchat'), gAt = chatAt('#gchat');
  const passX = $('panel-body').dataset.key === `${open}:${tab}` ? document.querySelector('#pass-track')?.scrollLeft ?? null : null;   // 패스 줄을 옆으로 넘겨 보던 자리
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
  if (key !== 'chat:0') worldStop();
  if (key !== 'look:0') lkPrev = {};
  if (key !== 'gear:3') { bagIn = false; bagAsk = false; }
  if (key !== 'gear:0') eqCand = null;
  const st = g.fighter().st;
  // v508 창 안쪽도 지금 게임 부품으로 — 묶음은 제목 있는 카드(.card h3), 스탯은 두 칸 격자(.stat-grid), 줄은 붓글씨 한 글자(.ico), 장비는 그림 칸(.inv-grid), 수집은 타일(.gear-grid)
  const card = (title, sub = '') => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<h3>${title}${sub ? ` <small>${sub}</small>` : ''}</h3>`; B.append(c); return (...e) => c.append(...e); };
  // v610 넷째 값(글자)에 그림이 있으면 그림으로(tables/uiicons.js) — 그림이 안 뜨면 글자로 돌아간다
  const R = (k, v, btns = [], ico = '') => { const r = rowEl(k, v, btns); if (ico) { const i = document.createElement('div'), [pic, gly] = uiIcon(ico); i.className = 'ico';
    if (pic) { const im = new Image(); im.alt = ''; im.loading = 'lazy'; im.decoding = 'sync'; im.onerror = () => { i.classList.remove('pic'); i.textContent = gly; }; im.src = `art/s2/ui/${pic}.webp`; i.classList.add('pic'); i.append(im); } else i.textContent = gly;
    r.prepend(i); } return r; };
  const note = (t) => Object.assign(document.createElement('p'), { className: 'note', textContent: t });
  // 임무 창 「모두 받기」 줄 — 받을 것 합친 보상 칩 · 받은 뒤 알림(종류마다 합)
  const msAll = (book, ids, label, what) => {
    const sum = {}; for (const id of ids) for (const [k, n] of Object.entries(msRew(g.books[book].defs.get(id) || {}))) sum[k] = (sum[k] || 0) + n;
    const r = R(label, ids.length ? `${ids.length}개${msChips(sum)}` : '아직 없어요', [['모두 받기', act(() => { const w0 = { ...g.S.wallet }; let n = 0; for (const id of g.books[book].claimable()) if (g.claimMission(book, id)) n++;
      if (n) { play('coin'); const t = msGot(w0, g.S.wallet); setTimeout(() => toast(`${what} ${n}개 받음${t ? ` — ${t}` : ''}`), 0); } return n > 0; }), !ids.length]], 'i:chest:賞');
    r.classList.add('ms-all'); if (ids.length) r.classList.add('ms-can'); return r;
  };
  const statGrid = (pairs) => { const d = document.createElement('div'); d.className = 'stat-grid'; d.innerHTML = pairs.map(([n, v]) => `<div>${n}<b>${v}</b></div>`).join(''); return d; };
  const GCOL = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
  const pm = (v) => `${(v / 10).toFixed(1)}%`;
  if (key === 'hero:0') {
    // v6xx 스탯(st-) — 전투력 띠(작은 모습 · 큰 수 · 사냥/대결) · 능력치 네 칸(그림) · 최종 피해 네 칸(어디서 오는지) · 아래 스탯 배분은 그대로
    const H0 = g.S.hero, c1 = card('전투력', JOBS[H0.job].name + (H0.adv ? ` ${H0.adv}차` : ''));
    const hb = document.createElement('div'); hb.className = 'st-hero';
    hb.innerHTML = `<canvas class="st-cv" width="132" height="156"></canvas><div class="st-pw"><b>${unit(g.power())}</b><small>${esc(JOBS[H0.job].name)} · Lv ${H0.lv}${H0.adv ? ` · ${H0.adv}차 전직` : ''}</small></div><div class="st-split"><div><span>사냥</span><b>${unit(g.power())}</b></div><div><span>대결</span><b>${unit(g.power('pvp'))}</b></div></div>`;
    c1(hb); hb.parentNode.classList.add('st-card', 'st-top');
    { const cv = hb.querySelector('canvas'); let last = -1e9; const paint = (ts) => {
        if (!cv.isConnected || !open) return;   // 창을 닫거나 다른 칸으로 가면 멈춤
        const low = opt.gfx === 'low';
        if (ts - last > (low ? 500 : 66)) { last = ts; const x = cv.getContext('2d'); x.clearRect(0, 0, 132, 156); const gr = x.createRadialGradient(66, 104, 6, 66, 104, 72); gr.addColorStop(0, '#e8c26a44'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 132, 156); drawHero(x, 66, 150, H0.job, H0.lv, { t: low ? 0 : now() / 1000, scale: 1.1, eq: g.lookEq() }); cv.dataset.n = String((+cv.dataset.n || 0) + 1); }
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
    const stIc = (n) => `<span class="ico pic st-ic"><img src="art/s2/ui/${n}.webp" alt="" decoding="async" onerror="this.parentNode.classList.remove('pic');this.remove()"></span>`;
    const c2 = card('능력치');
    const t2 = document.createElement('div'); t2.className = 'st-tiles';
    t2.innerHTML = [['atk', '공격', unit(st.atk || 0)], ['hp', '체력', unit(st.hp || 0)], ['def', '방어', unit(st.def || 0)], ['crit', '치명 확률', pm(st.crit || 0)]].map(([ic, n, v]) => `<div class="st-t" data-k="${ic}">${stIc(ic)}<span class="st-l">${n}</span><b>${v}</b></div>`).join('');
    const mo = document.createElement('div'); mo.className = 'st-more';
    mo.innerHTML = [['치명 피해', pm(st.critDmg || 0)], ['보스 피해', pm(st.bossDmg || 0)], ['경험치', `+${pm(st.expP || 0)}`], ['무공 피해', `+${pm(st.skillP || 0)}`]].map(([n, v]) => `<span>${n} <b>${v}</b></span>`).join('');
    c2(t2, mo); t2.parentNode.classList.add('st-card');
    // 최종 피해 — 넷이 곱으로(battle/damage.js ⑩) · 어디서 오는지는 표 그대로(core/stats.js LAYER_OWNER · 5차 상시 무공 · tables/s5.js)
    const c3 = card('최종 피해', '곱으로 붙는 넷');
    const FD = [['final1', '마스터리 · 5차 상시 무공'], ['final2', `낀 영물 ${COLLECT.relic.slots}칸`], ['final3', `강호행 단계마다 +${pm(JOURNEY_STEP_P)} · 옵션 줄`], ['final4', `낀 동료 ${COLLECT.pal.slots}칸 · 둘째 칸부터 ${Math.round(COLLECT.pal.subShare * 100)}%`]];
    const t3 = document.createElement('div'); t3.className = 'st-tiles st-fin';
    t3.innerHTML = FD.map(([k, why], i) => `<div class="st-t st-f${st[k] ? '' : ' zero'}" data-k="${k}"><span class="st-l">최종 피해${'①②③④'[i]}</span><b>${pm(st[k] || 0)}</b><small class="st-w">${why}</small></div>`).join('');
    c3(t3); t3.parentNode.classList.add('st-card');
    // 스탯 배분 — 레벨마다 1점 · 네 스탯에 손으로(값은 작다 · 되돌리기는 공짜)
    { const P = g.hero.spState(), free = g.statPts(), used = g.hero.spUsed(), cs = card('스탯 배분', `남은 점수 ${free} · 레벨마다 1점`);
      const NM = { atk: ['공격', '攻'], hp: ['체력', '體'], def: ['방어', 'i:def:防'], crit: ['치명 확률', '銳'] };
      for (const k of SP_KEYS) { const full = P[k] >= SP_CAP, no = !free || full;
        cs(R(NM[k][0], `${P[k]}/${SP_CAP}점 · +${(P[k] * SP_EACH[k] / 10).toFixed(2)}%${k === 'crit' ? 'p' : ''}${full ? ' · 상한' : ''}`, [['+1', act(() => g.statUp(k, 1)), no], ['+10', act(() => g.statUp(k, 10)), no]], NM[k][1])); }
      cs(R('고르게 찍기', free ? `남은 ${free}점을 넷에 고르게(공격부터)` : '남은 점수가 없어요', [['고르게 찍기', act(() => { const n = g.statAuto(); if (n) toast(`${n}점 찍음`); return n; }), !free]], '均'));
      cs(R('되돌리기', used ? `찍은 ${used}점을 모두 돌려받아요 · 공짜` : '찍은 점수가 없어요', [['되돌리기', act(() => { const n = g.statReset(); if (n) toast(`${n}점 돌려받음`); return n; }), !used]], '還')); }
  } else if (key === 'hero:1') {
    // 무공 — 위에 낀 칸 여섯(그림 · 이름 · Lv · 쿨 · 잠긴 칸은 열리는 조건) · 묶음 가/나 · 모두 올리기 · 차수별 무공 카드
    const Hs = g.hero, K = Hs.kitState(), cap = kitCap(g.S.hero.lv), H = g.S.hero, BK = Hs.battleKit();
    const KIND = { active: '공격', passive: '상시', buff: '버프' }, SHAPE = { line: '앞 일직선', arc: '앞 부채꼴', circle: '주변', rain: '앞쪽 하늘에서' };
    const top = document.createElement('div'); top.className = 'sk-top'; add(top);
    const PR = g.S.kitPre || [null, null];
    top.innerHTML = `<div class="sk-hd"><div class="sk-ht"><b>장착 무공 <em>${K.slots.length}/${SLOT_N}</em></b><small>자동 사냥이면 칸 순서대로 써요 · 무공 레벨 상한 ${cap}(무인 레벨 5마다 1)</small></div></div>`;
    // v579 칸 묶음 — 사냥용 · 두목용처럼 둘을 적어 두고 한 번에(가/나 마디 단추)
    const pre = document.createElement('div'); pre.className = 'sk-pre'; top.querySelector('.sk-hd').append(pre);
    ['가', '나'].forEach((nm, i) => {
      const sg = document.createElement('div'); sg.className = 'sk-seg'; sg.title = PR[i] ? PR[i].slots.map((id) => skillById(id)?.name || id).join(' · ') || '(빈 칸)' : '비어 있음';
      sg.innerHTML = `<span>묶음 ${nm}</span>`;
      for (const [lb, fn, dis] of [['불러오기', () => g.kitPresetLoad(i), !PR[i]], ['적기', () => g.kitPresetSave(i), false]]) { const bt = document.createElement('button'); bt.textContent = lb; bt.disabled = dis; bt.onclick = act(fn); sg.append(bt); }
      pre.append(sg);
    });
    // 낀 칸 — 빈 칸은 다음 전직에 열리는 차수(필드 무공 줄과 같은 셈)
    const lockedT = (KIT[H.job] || []).filter((x) => x.kind !== 'passive' && x.tier > (H.adv || 0)).map((x) => x.tier).sort((x, y) => x - y);
    const slots = document.createElement('div'); slots.className = 'sk-slots'; top.append(slots);
    for (let i = 0, emptyN = 0; i < SLOT_N; i++) {
      const id = K.slots[i], sk = id && skillById(id), t = document.createElement('button'); t.className = 'sk-slot';
      if (sk) {
        const lv = K.lv[id] || 1, bk = BK[i] || {}; t.dataset.id = id; t.style.setProperty('--c', sk.col);
        t.innerHTML = `<i class="sk-n">${i + 1}</i>${skIco(sk)}<b>${esc(sk.name)}</b><span class="sk-lv">Lv ${lv}</span><small>쿨 ${((bk.cdMs || sk.cdMs) / 1000).toFixed(1).replace(/\.0$/, '')}초 · ${K.off.includes(id) ? '수동' : '자동'}</small>`;
        t.title = `${sk.name} — 눌러서 무공 강화`; t.onclick = () => { play('click'); treeSel = id; openKey('hero:4'); };
      } else {
        const lt = lockedT[emptyN++]; t.classList.add(lt != null ? 'lock' : 'empty');
        t.innerHTML = lt != null ? `<i class="sk-n">${i + 1}</i><span class="sk-ic sk-lk"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span><b>${lt}차 전직</b><small>${H.lv < JOB_LV[lt] ? `Lv ${JOB_LV[lt]} 되면` : '전직 던전을 깨면'}</small>`
          : `<i class="sk-n">${i + 1}</i><span class="sk-ic sk-plus">+</span><b>빈 칸</b><small>아래 무공 「칸에」</small>`;
        if (lt != null) t.onclick = () => { play('click'); if (H.lv < JOB_LV[lt]) toast(`${lt}차 전직(Lv ${JOB_LV[lt]})을 하면 열려요 · 지금 Lv ${H.lv}`); else openKey('hero:3'); };
        else t.disabled = true;
      }
      slots.append(t);
    }
    // v559 모두 올리기 — 가장 낮은 무공부터 고르게 · 은자가 되는 만큼
    { const any = Object.keys(K.lv).some((id) => K.lv[id] > 0 && Hs.canKitUp(id));
      const r = R('모두 올리기', `${any ? '배운 무공을 가장 낮은 것부터 고르게 — 은자가 되는 만큼 · 상한까지' : '올릴 수 있는 무공이 없어요(은자 · 상한)'} · 은자 ${unit(g.S.wallet.gold || 0)}`, [['모두 올리기', act(() => { const r2 = g.kitUpAll(); if (r2) kitAllPop(r2); return r2; }), !any]], 'i:skill:功');
      r.classList.add('sk-all'); add(r); }
    const tiers = document.createElement('div'); tiers.className = 'sk-tiers'; add(tiers);   // 차수 묶음을 옆으로 이어 놓는다(한 차수에 무공이 한둘이라 줄마다 빈자리가 컸다)
    for (let tier = 0; tier <= 5; tier++) {
      const list = KIT[H.job].filter((sk) => sk.tier === tier); if (!list.length) continue;
      const shut = tier > H.adv, c = document.createElement('div'); c.className = `sk-tier${shut ? ' shut' : ''}`;
      c.innerHTML = `<h4>${tier}차 무공${shut ? ` <small>${tier}차 전직 때 열림</small>` : ''}</h4>`;
      const grid = document.createElement('div'); grid.className = 'sk-grid'; c.style.setProperty('--n', list.length); c.append(grid); tiers.append(c);
      for (const sk of list) {
        const lv = K.lv[sk.id] || 0, slot = K.slots.indexOf(sk.id), on = !K.off.includes(sk.id), L1 = Math.max(1, lv);
        const eff = sk.kind === 'active' ? `${SHAPE[sk.shape]} · ${sk.maxT}마리 · ${sk.hits}연타 · 한 대 ${(kitCoef(sk, L1) / 10).toFixed(0)}%`
          : sk.kind === 'buff' ? `${sk.durMs / 1000}초 동안 ${statTxt(sk.stats(L1))}` : statTxt(sk.stats(L1));
        const d = document.createElement('div'); d.className = `sk-card${lv ? '' : ' no'}${slot >= 0 ? ' eq' : ''}`; d.dataset.id = sk.id; d.style.setProperty('--c', sk.col);
        d.innerHTML = `<div class="sk-ch">${skIco(sk)}<div><b>${esc(sk.name)}</b><span><i class="sk-k ${sk.kind}">${KIND[sk.kind]}</i>${lv ? `<em class="sk-lv">Lv ${lv}</em>` : ''}${sk.cdMs ? `<small>쿨 ${sk.cdMs / 1000}초</small>` : ''}${slot >= 0 ? `<u>${slot + 1}칸</u>` : ''}</span></div></div><p>${eff}</p>`;
        const bt = document.createElement('div'); bt.className = 'sk-bt'; d.append(bt);
        const mk = (lb, fn, dis, cls) => { const x = document.createElement('button'); x.className = `btn${cls ? ` ${cls}` : ''}`; x.textContent = lb; x.disabled = !!dis; x.onclick = fn; bt.append(x); return x; };
        if (lv) {
          mk(lv < cap ? `올리기 ${unit(kitCost(lv, sk.tier)[0].n)}` : '상한', act(() => Hs.kitUp(sk.id, g.S.wallet) && (g.dirtyStats = true, g.emit('skill'), true)), !Hs.canKitUp(sk.id), 'primary sk-up');
          if (sk.kind !== 'passive') {
            mk(slot >= 0 ? `${slot + 1}칸 ▶` : '칸에', act(() => { const i = slot >= 0 ? (slot + 1) % K.slots.length : Math.min(K.slots.length, SLOT_N - 1); const r = Hs.kitSlot(i, sk.id); g.dirtyStats = true; return r; }));
            if (slot >= 0) mk(on ? '자동' : '수동', act(() => { Hs.kitAuto(sk.id, !on); g.dirtyStats = true; return true; }));
          }
        } else { const q = document.createElement('small'); q.className = 'sk-q'; q.textContent = `${tier}차 전직 때 배워요`; bt.append(q); }
        grid.append(d);
      }
    }
  } else if (key === 'hero:4') {
    // 무공 강화 트리 — 무공마다 3단(1단 → 5점 → 2단 → 12점 → 3단). 기다림 없음 · 단마다 세로 칸, 칸 사이 가는 줄
    const Hs = g.hero, K = Hs.kitState(), pts = g.treePts();
    const owned = KIT[g.S.hero.job].filter((sk) => K.lv[sk.id] && sk.kind !== 'passive');
    if (!owned.some((sk) => sk.id === treeSel)) treeSel = owned[0]?.id;
    const hd = document.createElement('div'); hd.className = 'sk-th'; add(hd);
    hd.innerHTML = `<div class="sk-pts"><b>${pts.left}</b><span>/ ${pts.total}점<small>남은 무공 점수 · 레벨마다 1점 · 10칸마다 3점</small></span></div>`;
    { const cost = unit(treeResetCost(pts.used)[0].n), rw = document.createElement('div'); rw.className = 'sk-rw'; rw.innerHTML = `<small>쓴 ${pts.used}점 돌려받기 · 은자 ${cost}</small>`;
      const rb = document.createElement('button'); rb.className = 'btn sk-reset'; rb.textContent = '트리 초기화'; rb.disabled = !pts.used;
      rb.onclick = () => pop('트리를 초기화할까요?', `<p>쓴 점수 ${pts.used}점을 돌려받아요.</p><p class="note">은자 ${cost}</p>`, [['아니요', null], ['예', act(() => g.treeReset())]]);
      rw.append(rb); hd.append(rw); }
    const chips = document.createElement('div'); chips.className = 'sk-pick'; add(chips);
    for (const sk of owned) { const b = document.createElement('button'); b.className = `chip${sk.id === treeSel ? ' on' : ''}`; b.dataset.id = sk.id; b.style.setProperty('--c', sk.col); b.innerHTML = `${skIco(sk)}<span>${esc(sk.name)}</span>${Hs.treeSpent(sk.id) ? `<em>${Hs.treeSpent(sk.id)}점</em>` : ''}`; b.onclick = () => { play('click'); treeSel = sk.id; paintWin(); }; chips.append(b); }
    const sk = skillById(treeSel);
    if (sk) {
      const spent = Hs.treeSpent(sk.id), nodes = K.tree?.[sk.id] || {};
      const NIC = { pow: 'atk', cdr: 'time', rng: 'dodge', tgt: 'duel', hit: 'enhance', cri: 'crit', dur: 'moon', amp: 'starsoul', all: 'realm' };
      const EF = (k2, v) => ({ pow: `위력 +${v / 10}%`, cdr: `쿨 −${v / 10}%`, rng: `범위 +${v / 10}%`, tgt: `대상 +${v}`, hit: `연타 +${v}`, cri: `이 무공 치명 +${v / 10}%`, dur: `지속 +${v / 10}%`, amp: `효과 +${v / 10}%` }[k2]);
      const tree = document.createElement('div'); tree.className = 'sk-tree'; tree.style.setProperty('--c', sk.col); tree.dataset.id = sk.id; add(tree);
      for (let tier = 0; tier < 3; tier++) {
        const list = treeOf(sk).filter((nd) => nd.tier === tier); if (!list.length) continue;
        const opened = spent >= TREE_GATE[tier], col = document.createElement('div'); col.className = `sk-col${opened ? ' on' : ''}`;
        col.innerHTML = `<h4>${tier + 1}단 <small>${opened ? '열림' : `${TREE_GATE[tier]}점 쓰면 열림 · 지금 ${spent}점`}</small></h4>`;
        const ns = document.createElement('div'); ns.className = 'sk-nodes'; col.append(ns);
        for (const nd of list) {
          const lv = nodes[nd.n] || 0, eff = Object.entries(nd.eff).map(([k2, v]) => EF(k2, v)).join(' · ');
          const n = document.createElement('div'); n.className = `sk-node${lv ? ' got' : ''}${lv >= nd.max ? ' max' : ''}`; n.dataset.n = nd.n;
          n.innerHTML = `<div class="sk-nh"><span class="sk-nic"><b>${nd.name[0]}</b><img src="art/s2/ui/${NIC[nd.n]}.webp" alt="" decoding="async" onerror="this.remove()"></span><div><b>${nd.name}</b><span class="sk-pp">${lv}/${nd.max}</span></div></div><p>레벨마다 ${eff}</p><i class="sk-bar"><i style="width:${Math.round(lv / nd.max * 100)}%"></i></i>`;
          const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = lv >= nd.max ? '끝' : `올리기 · ${nd.pts}점`; b.disabled = !Hs.canTreeUp(sk.id, nd.n, g.stage().top); b.onclick = act(() => g.treeUp(sk.id, nd.n)); n.append(b);
          ns.append(n);
        }
        tree.append(col);
      }
    } else B.append(note('무공을 하나 이상 배우면 강화할 수 있어요.'));
  } else if (key === 'hero:2') {
    // v6xx 마스터리(ma-) — 단마다 한 칸(1단 → 2단 → …) · 「먼저」인 앞 단 노드와 선으로 · 익힘 ✓ / 배울 수 있음(금빛 · 「배우기」) / 잠김(Lv n부터 · 앞 노드 먼저)
    const c = card('마스터리', '최종 피해① · 값을 내면 바로 익힘'), H0 = g.S.hero, got = new Set(H0.mastery.done);
    const mn = (id) => MASTERY_NAME[+id.slice(1) - 1] || id;   // v522 m1 같은 id 대신 이름
    const byId = new Map(MASTERY.map((m) => [m.id, m])), D = Math.max(...MASTERY.map((m) => m.depth)), lane = {}, taken = {};
    for (const m of [...MASTERY].sort((a, b) => a.depth - b.depth)) { let l = m.need && lane[m.need] != null ? lane[m.need] : 0; const T = (taken[m.depth] ??= new Set()); while (T.has(l)) l++; T.add(l); lane[m.id] = l; }   // 줄: 먼저 배울 노드와 같은 줄
    const path = document.createElement('div'); path.className = 'ma-path'; path.style.setProperty('--cols', D);
    path.innerHTML = Array.from({ length: D }, (_, i) => `<div class="ma-dh" style="grid-column:${i + 1}">${i + 1}단${i < D - 1 ? ' <i>→</i>' : ''}</div>`).join('');
    for (const m of MASTERY) {
      const ok = got.has(m.id), can = g.hero.canLearn(m.id), pre = m.need && byId.get(m.need), link = !!pre && pre.depth === m.depth - 1 && lane[pre.id] === lane[m.id], cost = masteryCost(m)[0]?.n || 0;
      const n = document.createElement('div'); n.className = `ma-node ${ok ? 'ma-done' : can ? 'ma-can' : 'ma-lock'}${link ? ` ma-link${got.has(m.need) ? ' ma-on' : ''}` : ''}`; n.dataset.id = m.id;
      n.style.gridColumn = String(m.depth); n.style.gridRow = String(lane[m.id] + 2);
      const why = ok ? '<em class="ma-ok">✓ 익힘</em>' : can ? `<em class="ma-cost${(g.S.wallet.gold || 0) < cost ? ' short' : ''}">은자 ${unit(cost)}</em>` : H0.lv < m.lv ? `<em class="ma-why">${lvHint(m.lv)}</em>` : pre && !got.has(pre.id) ? `<em class="ma-why">${mn(pre.id)} 먼저</em>` : '<em class="ma-why">잠김</em>';
      n.innerHTML = `<div class="ma-h"><span class="ico pic ma-ic"><img src="art/s2/ui/mastery.webp" alt="" decoding="async" onerror="this.parentNode.classList.remove('pic');this.remove()"></span><div><b>${mn(m.id)}</b><small>Lv ${m.lv}${pre && !link ? ` · ${mn(pre.id)} 먼저` : ''}</small></div></div><p>최종 피해① +${m.final1 / 10}%</p>${why}`;
      if (!ok && can) { const bt = document.createElement('button'); bt.className = 'btn primary ma-btn'; bt.textContent = '배우기'; bt.onclick = act(() => g.learn(m.id)); n.append(bt); }
      path.append(n);
    }
    c(path);
    { const n = MASTERY.filter((m) => got.has(m.id)), f1 = n.reduce((a, m) => a + m.final1, 0); c(note(`익힌 노드 ${n.length} / ${MASTERY.length} · 최종 피해① +${f1 / 10}% · 선은 「먼저 배울 노드」`)); }
  } else if (key === 'hero:3') {
    // 전직 사다리(jb-) — 왼쪽 큰 무인(지금 모습) · 오른쪽 다섯 차수 카드(이름 · 레벨 문 · 여는 무공 · 공격/체력 보너스) · 마친 차수는 금빛 도장
    const H = g.S.hero, n = H.adv + 1, low = opt.gfx === 'low';
    const wrap = document.createElement('div'); wrap.className = `jb${low ? ' jb-low' : ''}`; add(wrap);
    const side = document.createElement('div'); side.className = 'jb-side';
    const cvs = document.createElement('canvas'); cvs.className = 'jb-cv'; cvs.width = 220; cvs.height = 280;
    const sumP = JOB_ADV.slice(1, H.adv + 1).reduce((a, x) => a + x.atkP, 0);
    side.innerHTML = `<div class="jb-me"><small>${JOBS[H.job].name} · Lv ${H.lv}</small><b>${H.adv ? `${H.adv}차 ${esc(jbTitle(H.job, H.adv))}` : '아직 전직 전'}</b><span>${sumP ? `전직 보너스 공격 · 체력 +${sumP / 10}%` : '1차 전직부터 무공과 보너스가 붙어요'}</span></div>`;
    side.prepend(cvs); wrap.append(side);
    const lad = document.createElement('div'); lad.className = 'jb-lad'; wrap.append(lad);
    for (let i = 1; i < JOB_LV.length; i++) {
      const done = H.adv >= i, next = i === n, sks = (KIT[H.job] || []).filter((x) => x.tier === i);
      const el = document.createElement('div'); el.className = `jb-t${done ? ' jb-done' : ''}${i === H.adv ? ' jb-cur' : ''}${next ? ' jb-next' : ''}`; el.dataset.n = String(i);
      el.innerHTML = `<span class="jb-no"><b>${i}</b>차</span><div class="jb-tx"><h4><span class="jb-nm">${i}차 전직</span> <em>${esc(jbTitle(H.job, i))}</em> <small>Lv ${JOB_LV[i]}</small></h4><p>${sks.length ? `무공 ${sks.map((x) => esc(x.name)).join(' · ')}` : '무공 없음'} · 공격 · 체력 +${JOB_ADV[i].atkP / 10}%</p></div>`;
      const end = document.createElement('div'); end.className = 'jb-end'; el.append(end);
      if (done) end.innerHTML = '<span class="jb-seal">轉</span>';
      else if (next && H.lv < JOB_LV[i]) end.innerHTML = `<small class="jb-hint">${lvHint(JOB_LV[i])}</small>`;
      else if (next) { const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = '도전'; b.onclick = () => { play('click'); if (!g.enterDungeon('job')) toast(g.canDungeon('job') || '들어갈 수 없어요'); }; end.append(b); }
      else end.innerHTML = `<small class="jb-hint">${i - 1}차 다음</small>`;
      lad.append(el);
    }
    // 무인 — 창이 열려 있는 동안만 그린다(닫거나 다른 칸이면 멈춤) · 낮은 그래픽은 숨쉬기 없이 그림이 받아질 때까지 몇 번만
    { let last = 0, k = 0; const paint = (ts) => {
        if (!cvs.isConnected || !open) return;
        if (ts - last > (low ? 400 : 50)) { last = ts; k++; const t = low ? 0 : now() / 1000, x = cvs.getContext('2d'); x.clearRect(0, 0, 220, 280);
          const gr = x.createRadialGradient(110, 190, 8, 110, 190, 120 + (low ? 0 : Math.sin(t * 1.5) * 8)); gr.addColorStop(0, H.adv ? '#e8c26a55' : '#ffffff22'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 220, 280);
          drawHero(x, 110, 262, H.job, H.lv, { t, scale: 2.1, eq: g.lookEq() }); }
        if (low && k >= 8) return;
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
  } else if (key === 'gear:0') {
    // 장착 — 가운데 무인 · 양옆 다섯 칸씩 · 칸을 누르면 아래에 자세히
    // gr- 칸: 등급 빛 테두리 · +강화(오른쪽 위) · ★성혼(왼쪽 아래) · ▲ 가방에 더 좋은 것 / 가운데: 큰 전투력 · 공격 · 체력 · 방어 · 평균 등급 빛
    const G = g.S.gear, L = g.S.hero.lv, wrap = document.createElement('div'); wrap.className = 'eqwrap';
    const col = (list) => { const c = document.createElement('div'); c.className = 'eqcol'; for (const sl of list) c.append(eqCell(sl)); return c; };
    const mid = document.createElement('div'); mid.className = 'eqmid';
    const cvs = document.createElement('canvas'); cvs.width = 240; cvs.height = 300; mid.append(cvs);
    const worn = SLOTS.map((s) => G.eq[s]).filter(Boolean), avgG = worn.length ? Math.round(worn.reduce((a, x) => a + x.g, 0) / worn.length) : 0;
    const pw = document.createElement('div'); pw.className = 'eqpw gr-pw'; pw.style.setProperty('--gc', GX_COL[avgG]);
    pw.innerHTML = `<span class="gr-pwl">전투력</span><b class="gr-pwn">${unit(g.power())}</b><span class="gr-brk"><i>공격 ${unit(st.atk || 0)}</i><i>체력 ${unit(st.hp || 0)}</i><i>방어 ${unit(st.def || 0)}</i></span><small>${JOBS[g.S.hero.job].name} · Lv.${L} · 평균 <em class="g${avgG}t">${GRADES[avgG]}품</em></small>`;
    mid.append(pw);
    wrap.append(col(SLOTS.slice(0, 5)), mid, col(SLOTS.slice(5)));
    const c0 = card('끼고 있는 것', `전투력 ${unit(g.power())}`); c0(wrap);
    const nb = SLOTS.filter((s) => bestFor(s)).length;
    c0(R('최고 장비 모두 끼기', nb ? `${nb}칸을 더 좋은 것으로 · ▲ 칸을 누르면 비교` : '모두 가장 좋은 것을 끼고 있어요', [['모두 끼기', act(() => { const p0 = g.power(), n = equipBest(G, L); g.dirtyStats = true; g.emit('equip'); eqCand = null; if (n) setTimeout(() => toast(`${n}칸 바꿈 · 전투력 ${unit(p0)} → ${unit(g.power())}`), 0); return n > 0; }), !nb]], '裝'));
    // v585 장비 창 무인 — 한 번만 그리면 머리 · 옷 그림이 아직 안 받아졌을 때 대신 그린 얼굴이 남았다(얼굴이 깨져 보임) → 창이 열려 있는 동안 계속 그린다(초당 20번) · 외형대로
    // 뒤 빛: 낀 장비 평균 등급 빛깔 · 천천히 숨 쉬듯(높은 등급일수록 조금 진하게)
    { let last = 0; const aura = GX_COL[avgG], aA = Math.round(34 + avgG * 12).toString(16).padStart(2, '0'); const paint = (ts) => {
        if (!cvs.isConnected || !open) return;   // 창을 닫거나 다른 칸으로 가면 멈춤
        if (ts - last > 50) { last = ts; const t = now() / 1000, x = cvs.getContext('2d'); x.clearRect(0, 0, 240, 300); x.save(); x.translate(0, 10); const rr = 128 + Math.sin(t * 1.6) * 8, gr = x.createRadialGradient(120, 190, 10, 120, 190, rr); gr.addColorStop(0, aura + aA); gr.addColorStop(0.55, aura + '22'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 240, 300); drawHero(x, 120, 270, g.S.hero.job, g.S.hero.lv, { t, scale: 2.2, eq: g.lookEq() }); x.restore(); }
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
    const sl = eqSel && SLOTS.includes(eqSel) ? eqSel : null;
    if (sl) {
      const it = G.eq[sl], S2 = G.slots[sl], stt = it ? itemStats(it, S2, L) : {};
      const c1 = card(it ? `<span class="g${it.g}t">${GRADES[it.g]}품${it.up ? '上' : ''} ${SLOT_NAME[sl]}</span>` : `${SLOT_NAME[sl]} — 비어 있음`, `칸 강화 +${S2.enh} · 성혼 ★${S2.star}${S2.broken ? ' (파괴)' : ''}`);
      if (it) { const box = document.createElement('div'); box.className = 'eqst'; box.innerHTML = statTxt(stt).split(' · ').map((x) => `<span>${x}</span>`).join(''); c1(box); }
      c1(R('칸 강화', `+${S2.enh}`, [['강화', act(() => { const r = g.enhance(sl); if (r !== null) toast(r ? '강화 성공' : '강화 실패'); return r; })]], '强'));
      c1(R('칸 성혼', `★${S2.star}`, [['성혼', act(() => { const r = g.star(sl); if (r) toast({ ok: '성혼 성공', fail: '실패', down: '하락', break: '파괴!' }[r]); return r; }), !!S2.broken]], '魂'));
      if (it) c1(R('장착 해제', '가방으로', [['해제', act(() => { const r = unequip(G, sl); g.dirtyStats = true; eqCand = null; return r; })]], '解'));
      const all = G.bag.filter((x) => x.slot === sl).sort((a2, b2) => gearScore(b2, L) - gearScore(a2, L)), cand = all.slice(0, 8);
      const pick = eqCand !== null ? all.find((x) => x.uid === eqCand) || null : null;
      if (pick && !cand.includes(pick)) cand.unshift(pick);
      if (cand.length) {
        const c2 = card('가방에서 고르기', `${SLOT_NAME[sl]} ${all.length}개 · 누르면 비교`);
        if (pick) c2(gearCmp(sl, it, pick, L));
        c2(invGrid(cand, it, L, { sel: pick?.uid, pick: (c) => { eqCand = eqCand === c.uid ? null : c.uid; paintWin(); if (eqCand !== null) requestAnimationFrame(() => document.querySelector('.gr-cmp')?.scrollIntoView({ block: 'nearest' })); } }));
      }
    } else B.append(note('칸을 누르면 옵션 · 강화 · 성혼 · 가방의 다른 장비를 볼 수 있어요. ▲ 칸은 가방에 더 좋은 것이 있어요.'));
  } else if (key === 'gear:1') {
    const GA = g.S.gacha;
    // 장비 뽑기 화면 — 위: 지금 뽑기 레벨에서 나오는 가장 높은 등급 장비 그림 · 이름 · 경험치 / 아래: 가진 것 · 등급 확률 · 천장 · 뽑기 셋
    const need = gachaExpNeed(GA.lv), wt = gachaWeights(GA.lv), pg = pityGrade(GA.lv), pt = GA.pity || 0, tix = W['ticket:gear'] || 0;
    const top = wt.reduce((m, x, i) => (x ? i : m), 0), sub = top > 0 && wt[top - 1] ? top - 1 : top;
    const c = document.createElement('div'); c.className = 'card gch'; c.style.setProperty('--gc', GX_COL[top]); B.append(c);
    const show = [['hat', sub], ['top', top], ['weapon', top], ['ring', top], ['cape', sub]];
    const hero = document.createElement('div'); hero.className = 'gch-hero';
    hero.innerHTML = `<div class="gch-show">${show.map(([sl, gr], i) => `<img class="${i === 2 ? 'mid' : i === 1 || i === 3 ? 'in' : ''}" src="${eqIcon(sl, { g: gr })}" alt="${GRADES[gr]}품 ${SLOT_NAME[sl]}" style="--gc:${GX_COL[gr]}">`).join('')}</div>`
      + `<h3>장비 뽑기 Lv ${GA.lv} <small>경험치 ${GA.exp}/${need} · 차면 바로 오름</small></h3>`
      + `<div class="bar"><div style="width:${Math.min(100, (GA.exp / need) * 100)}%"></div><span>${GA.exp} / ${need}</span></div>`;
    const body = document.createElement('div'); body.className = 'gch-body';
    body.innerHTML = `<div class="gch-stats"><span>뽑기권 <b>${tix}장</b></span><span>정예 대기 <b>${GA.eliteQ}마리</b></span></div>`
      + `<div class="gch-odds"><em>확률</em>${wt.map((x, i) => (x ? `<span class="g${i}t" style="--gc:${GX_COL[i]}"><b>${GRADES[i]}</b>${(x / 10).toFixed(1)}%</span>` : '')).join('')}<small>각 등급 안에서 上 25%</small></div>`
      + `<div class="gch-pity"><div class="gch-pl"><span>천장</span><b>${pt} / ${PITY_N}</b><small class="g${pg}t">${GRADES[pg]}품 이상 확정</small></div><div class="achbar"><i style="width:${Math.min(100, (pt / PITY_N) * 100)}%"></i></div></div>`;
    const tiles = document.createElement('div'); tiles.className = 'gch-tiles';
    const one = gachaCost(g.S.hero.lv, GA.lv);
    for (const n of [1, 10, 30]) {   // 뽑기권이 n장 있으면 뽑기권, 모자라면 은자(누르면 하는 일은 그대로)
      const r = rowEl(`${n}번 뽑기`, tix >= n ? `뽑기권 ${n}장` : costTxt(one.map((x) => ({ k: x.k, n: Math.floor(x.n * n) }))), [['뽑기', act(() => gearPull(n))]]);
      r.classList.add('gch-tile'); if (n === 10) r.classList.add('main');
      const btn = r.querySelector('.btn'); if (n !== 10) btn.classList.remove('primary');
      r.onclick = (e) => { if (!e.target.closest('.btn')) btn.click(); };   // 칸 어디를 눌러도 뽑기
      tiles.append(r);
    }
    body.append(tiles, note('10번마다 사냥터에 정예가 한 마리 나와요.'));
    c.append(hero, body);
  } else if (key === 'gear:2') {
    // v528 가진 재료를 맨 위에 · 칸마다 다음 강화로 무엇이 얼마나 오르는지 · 누르면 강화 창
    const L = g.S.hero.lv, G = g.S.gear;
    // v626 en- 재료 칩 셋(그림) · 「모두 강화」 줄 · 칸 카드 격자(장비 그림 · +강화 · ★ · 다음 강화 확률 · 비용 · 파괴 표시)
    const c0 = card('가진 재료', '강화 = 은자 + 강화석 · 성혼 = 은자');
    const mats = document.createElement('div'); mats.className = 'en-mats';
    mats.innerHTML = [['silver', '은자', unit(W.gold || 0)], ['stone', '강화석', unit(W['item:stone'] || 0)], ['reset', '복구 주문서', `${W['item:restore'] || 0}장`]]
      .map(([ic, nm, v]) => `<div class="en-mat"><img src="art/s2/ui/${ic}.webp" alt=""><span>${nm}</span><b>${v}</b></div>`).join('');
    c0(mats);
    c0(note('강화석은 장비 분해(가방 · 일괄 분해)와 수련동 「단련동」에서 얻어요.'));
    // v543 모두 강화 — 낮은 칸부터 고르게 · 재료가 되는 만큼 · 결과 창(칸마다 전 → 후 · 성공/실패 · 쓴 재료 · 전투력)
    const lo = SLOTS.reduce((a, b) => (G.slots[b].enh < G.slots[a].enh ? b : a)), loCost = enhCost(G.slots[lo].enh, L);
    const ra = R('모두 강화', have(loCost) ? `가장 낮은 칸부터 고르게 · 재료가 되는 만큼<br>다음: ${SLOT_NAME[lo]} +${G.slots[lo].enh} — ${costTxt(loCost)}` : `재료가 모자라요 — ${SLOT_NAME[lo]} +${G.slots[lo].enh}에 ${costTxt(loCost)}`,
      [['모두 강화', act(() => { const r = g.enhanceAll(); if (r) enhAllPop(r); return r; }), !have(loCost)]], '鍊');
    ra.classList.add('en-all'); c0(ra);
    const c = card('칸 강화 · 성혼', '칸에 붙는다 — 장비를 바꿔도 남음 · 누르면 강화 창');
    const grid = document.createElement('div'); grid.className = 'en-grid'; c(grid);
    for (const sl of SLOTS) {
      const S2 = G.slots[sl], it = G.eq[sl], eMax = S2.enh >= ENH_MAX;
      const cost = eMax ? [] : enhCost(S2.enh, L), can = cost.length && have(cost);
      const d = document.createElement('div'); d.className = `en-card${it ? ` g${it.g}` : ' empty'}${can ? ' can' : ''}${S2.broken ? ' en-brk' : ''}`; d.dataset.slot = sl;
      if (it) d.style.setProperty('--gc', GX_COL[it.g]);
      d.innerHTML = `<div class="en-ic"><img src="${eqIcon(sl, it)}" alt="${SLOT_NAME[sl]}">${S2.broken ? '<i class="en-bk">파괴</i>' : ''}</div>
        <span class="en-nm">${SLOT_NAME[sl]}${it ? ` <small class="g${it.g}t">${GRADES[it.g]}품${it.up ? '上' : ''}</small>` : ' <small>비어 있음</small>'}</span><b class="en-lv">+${S2.enh}</b>
        <div class="en-st">${S2.broken ? `<span class="en-bkt">★${S2.broken} 파괴</span>` : starPips(S2.star)}</div>
        <div class="en-nx">${S2.broken ? '<span class="en-bkt">복구 주문서로 되살릴 수 있어요</span>' : ''}${eMax ? '<span>강화 끝(+20)</span>' : `<span>+${S2.enh + 1} · 성공 <b>${pctTxt(enhOk(S2.enh))}</b></span><span>${costTxt(cost)}</span>`}</div>`;
      const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = '열기'; b.onclick = () => { play('click'); enhPop(sl); }; d.append(b);
      d.onclick = (e) => { if (e.target.closest('button')) return; play('click'); enhPop(sl); };
      grid.append(d);
    }
  } else if (key === 'gear:3') {
    const G = g.S.gear, L = g.S.hero.lv;
    bagMark(G);
    const c0 = card(`가방 ${G.bag.length}개`, `누르면 비교 · 장착 · 잠금 · 분해 · ▲ 지금보다 좋음${bagNew.size ? ` · <span class="gr-newtx">NEW ${bagNew.size}</span>` : ''}`);
    const rows = document.createElement('div'); rows.className = 'gr-rows'; c0(rows);   // 넓으면 두 줄 나란히
    rows.append(R('자동 분해', G.autoDis < 0 ? '끔' : `${GRADES[G.autoDis]}품 이하는 주우면 바로 분해`, [['바꾸기', act(() => { G.autoDis = G.autoDis >= 3 ? -1 : G.autoDis + 1; return true; })]], '分'));
    { const sh = W['item:shard'] || 0;
      rows.append(R(`뽑기 조각 ${sh}개`, `${SHARD_PER_TICKET}개마다 장비 뽑기권 1장 · 분해하면 모여요`, [['바꾸기', act(() => { const r = g.shardExchange(); if (r) setTimeout(() => toast(`장비 뽑기권 +${r.tickets} · 조각 ${r.left}개 남음`), 0); return !!r; }), sh < SHARD_PER_TICKET]], '片')); }
    // v521 부위 고르기 · 정렬(gr- 칩 셋: 등급순 · 부위순 · 새로 얻은 순) · 일괄 분해(아래 붙은 띠)
    const chips = document.createElement('div'); chips.className = 'chip-row bagf';
    for (const [k, nm] of [['all', '전부'], ...SLOTS.map((s) => [s, SLOT_NAME[s]])]) { const n = k === 'all' ? G.bag.length : G.bag.filter((x) => x.slot === k).length; if (k !== 'all' && !n) continue; const b = document.createElement('button'); b.className = `chip${bagF === k ? ' on' : ''}`; b.textContent = `${nm} ${n}`; b.onclick = () => { play('click'); bagF = k; paintWin(); }; chips.append(b); }
    if (!['g', 's', 'n'].includes(bagSort)) bagSort = 'g';
    const sorts = document.createElement('span'); sorts.className = 'gr-sort'; sorts.innerHTML = '<span class="gr-sortl">정렬</span>';   // 같은 줄 오른쪽(넘치면 다음 줄)
    for (const [k, nm] of [['g', '등급순'], ['s', '부위순'], ['n', '새로 얻은 순']]) { const b = document.createElement('button'); b.className = `chip gr-so${bagSort === k ? ' on' : ''}`; b.textContent = nm; b.onclick = () => { play('click'); bagSort = k; paintWin(); }; sorts.append(b); }
    chips.append(sorts); c0(chips);
    const list = G.bag.filter((x) => bagF === 'all' || x.slot === bagF).sort(bagSort === 'n' ? (a2, b2) => (bagNew.has(b2.uid) - bagNew.has(a2.uid)) || b2.uid - a2.uid : bagSort === 's' ? (a2, b2) => SLOTS.indexOf(a2.slot) - SLOTS.indexOf(b2.slot) || b2.g - a2.g : (a2, b2) => b2.g - a2.g || gearScore(b2, L) - gearScore(a2, L));
    if (list.length) { c0(invGrid(list.slice(0, bagMore ? 400 : 60), null, L, { nw: bagNew })); if (list.length > 60 && !bagMore) c0(R(`${list.length - 60}개 더 있어요`, '', [['전부 보기', () => { play('click'); bagMore = true; paintWin(); }]], '…')); }
    else c0(note('가방이 비었어요. 뽑기에서 더 좋은 것은 바로 껴요.'));
    // 일괄 분해 띠 — 창 아래에 붙어 있다: 몇 개 · 강화석 · 조각을 먼저 보여 주고, 「분해」 → 한 번 더 묻고 → 분해
    const junk = junkOf(G, L, bagJunkG);
    const yld = {}; for (const it of junk) for (const c of dismantleYield(it.g)) yld[c.k] = (yld[c.k] || 0) + c.n;
    const sum = `${junk.length}개 · 강화석 +${unit(yld['item:stone'] || 0)} · 조각 +${unit(yld['item:shard'] || 0)}`;
    if (!junk.length) bagAsk = false;
    const bar = document.createElement('div'); bar.className = `gr-dis${bagAsk ? ' ask' : ''}`;
    bar.innerHTML = `<div class="gr-dis-t"><b>${bagAsk ? '정말 분해할까요?' : '일괄 분해'}</b><small>${junk.length ? `${bagAsk ? '' : `낀 것보다 나쁜 ${GRADES[bagJunkG]}품 이하(잠금 빼고) · `}${sum}` : `낀 것보다 나쁜 장비가 없어요(${GRADES[bagJunkG]}품 이하)`}</small></div>`
      + (bagAsk ? '<button class="btn gr-dis-no">취소</button><button class="btn primary gr-dis-ok">분해</button>'
        : `<button class="btn gr-dis-g" aria-label="분해할 등급 바꾸기">${GRADES[bagJunkG]}품↓</button><button class="btn primary gr-dis-go" ${junk.length ? '' : 'disabled'}>분해</button>`);
    const on = (s, f) => { const e = bar.querySelector(s); if (e) e.onclick = f; };
    on('.gr-dis-g', () => { play('click'); bagJunkG = (bagJunkG + 1) % 7; paintWin(); });
    on('.gr-dis-go', () => { play('click'); bagAsk = true; paintWin(); });
    on('.gr-dis-no', () => { play('click'); bagAsk = false; paintWin(); });
    on('.gr-dis-ok', act(() => { bagAsk = false; const r = dismantleMany(G, junk.map((x) => x.uid), W); if (r.n) setTimeout(() => toast(`${r.n}개 분해 · 강화석 +${r.out['item:stone'] || 0} · 뽑기 조각 +${r.out['item:shard'] || 0}`), 0); return r.n > 0; }));
    add(bar);
  } else if (key === 'grow:0' || key === 'grow:1' || key === 'grow:2') {
    const sys = COLLECTS[+key.slice(5)], C = g.S.colls[sys], D = COLLECT[sys];
    // v558 병기 · 동료 · 영물 뽑기도 카드 뒤집기(높은 등급은 두근 · 번쩍) — 처음 얻은 것은 「새로」
    const pullFx = (n) => { const before = new Set(Object.keys(C.own)); const r = g.pullCollect(sys, n); if (r) showGacha({ items: r, got: [] }, { title: `${D.name} 뽑기`, again: act(() => pullFx(n)), can: () => (g.S.wallet[`ticket:${sys}`] || 0) >= n, fresh: (it) => !before.has(String(it.k)), done: (b) => `가장 좋은 것: ${GRADES[b]} · 새로 ${new Set(r.filter((x) => !before.has(String(x.k))).map((x) => x.k)).size}종`, face: (it) => `<img class="gx-coll" src="art/s2/coll/${sys}-${it.k}.webp" alt=""><b class="g${it.g}t">${GRADES[it.g]}</b><small>${esc(collName(sys, it.k))}</small>${before.has(String(it.k)) ? '' : '<i>새로</i>'}` }); return r; };
    // v6xx 뽑기 깃발(cg-) — 맨 위 등급 그림 셋(0~2번) · 뽑기권 · 모음 효과 합 · 천장 막대 · 등급 확률 · 1번 / 10번 칸(칸 어디를 눌러도 뽑기)
    const tix = W[`ticket:${sys}`] || 0, TOP = PULL_P.length - 1, show = [1, 0, 2].map((k) => [k, kindGrade(sys, k)]);
    const ownSum = Object.entries(C.own).reduce((a, [k, o]) => a + D.own[kindGrade(sys, +k)] * (1 + (o.awk * AWAKE_STEP_P) / 1000), 0) * clMul(C);   // 자세히 창 「보유」 값의 합
    const c0 = document.createElement('div'); c0.className = 'card cg'; c0.style.setProperty('--gc', GCOL[kindGrade(sys, 0)]); B.append(c0);
    c0.innerHTML = `<div class="cg-hero"><div class="cg-show">${show.map(([k, gr]) => `<img class="${k ? 's' : 'm'}" src="art/s2/coll/${sys}-${k}.webp" alt="${GRADES[gr]}품 ${esc(collName(sys, k))}" decoding="async" style="--gc:${GCOL[gr]}">`).join('')}</div>`
      + `<div class="cg-head"><h3>${D.name} 뽑기</h3><span class="cg-tix">뽑기권 <b>${tix}장</b></span></div></div>`
      + `<p class="cg-sum">모음 효과 합 <b>${CL_STAT[D.ownStat]} +${clPm(ownSum)}</b></p>`
      + `<div class="cg-pity"><div class="cg-pl"><span>천장</span><b>${C.pity} / ${PULL_PITY}</b><small class="g${TOP}t">${GRADES[TOP]}품 확정</small></div><div class="achbar"><i style="width:${Math.min(100, (C.pity / PULL_PITY) * 100)}%"></i></div></div>`
      + `<div class="cg-odds"><em>확률</em>${PULL_P.map((x, i) => `<span class="g${i}t" style="--gc:${GCOL[i]}"><b>${GRADES[i]}</b>${+(x / 10).toFixed(1)}%</span>`).join('')}</div>`;
    const tiles = document.createElement('div'); tiles.className = 'cg-tiles';
    for (const n of [1, 10]) {   // 누르면 하는 일 · 단추 글은 그대로(1번 · 10번) — 뽑기권이 모자라면 장 수만 붉게
      const r = rowEl(`뽑기권 ${n}장`, n >= 10 ? `${GRADES[PULL_TEN_FLOOR]}품 이상 하나` : '', [[`${n}번`, act(() => pullFx(n))]]);
      r.classList.add('cg-tile'); if (n === 10) r.classList.add('main'); if (tix < n) r.classList.add('short');
      const btn = r.querySelector('.btn'); if (n !== 10) btn.classList.remove('primary');
      r.onclick = (e) => { if (!e.target.closest('.btn')) btn.click(); };
      tiles.append(r);
    }
    c0.append(tiles);
    // v603 모음 격자 — 가진 것은 등급 빛깔로, 아직 없는 것도 흐리게 다 보인다(무엇을 모으는지 · 얼마나 모았는지)
    const nOwn = Object.keys(C.own).length;
    const c1 = card(`${D.name} 모음 ${nOwn}/${D.kinds}`, `장착 ${C.eq.filter((x) => x !== null && x !== undefined).length}/${C.eq.length}`);
    const bar = document.createElement('div'); bar.className = 'coll-bar'; bar.innerHTML = `<i style="width:${Math.round((nOwn / D.kinds) * 100)}%"></i>`; c1(bar);
    const grid = document.createElement('div'); grid.className = 'coll-grid';
    for (let k = 0; k < D.kinds; k++) {
      const o = C.own[k], gr = kindGrade(sys, k), t2 = document.createElement('div'); t2.className = `coll-tile${o ? '' : ' no'}${C.eq.includes(k) ? ' on' : ''}`; t2.style.setProperty('--gc', GCOL[gr]);
      t2.innerHTML = `<img src="art/s2/coll/${sys}-${k}.webp" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('em'),{textContent:'${o ? collGly(sys, k) : '?'}'}))"><b>${esc(collName(sys, k))}</b><small>${GRADES[gr]}품${o ? ` · Lv ${o.lv || 1}${o.awk ? ` · 각성 ${o.awk}` : ''}` : ''}</small>${C.eq.includes(k) ? '<u>장착</u>' : ''}`;
      t2.tabIndex = 0; t2.setAttribute('role', 'button'); t2.onclick = () => { play('click'); collPop(sys, k); }; t2.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t2.click(); } };   // v620 누르면 자세히
      grid.append(t2);
    }
    c1(grid);
    if (!nOwn) c1(note('아직 모은 것이 없어요 — 왼쪽 뽑기로 모아요. 가지기만 해도 효과가 붙고, 좋은 것은 저절로 낍니다.'));
  } else if (key === 'grow:3') {
    // 경지 — 둥근 돌파 눈금(모은 은자 / 다음 값) · 가운데 큰 경지 · 한 단계마다 오르는 값 · 10레벨마다 표(심법 줄 1~3) · 올리면 금빛 물결
    const R2 = g.S.realm, lv = R2.lv, mx = lv >= REALM_MAX, cost = mx ? 0 : realmCost(lv, goldPerMob(g.S.hero.lv))[0].n, gold = W.gold || 0, fill = mx ? 1 : Math.min(1, gold / Math.max(1, cost)), low = opt.gfx === 'low', pc = (v) => `${(v / 10).toFixed(1).replace(/\.0$/, '')}%`;
    const c = card(`경지 ${lv}`, '계정 공용 · 공격 · 체력');
    const gz = document.createElement('div'); gz.className = `rl-realm${low ? ' rl-low' : ''}${fill >= 1 && !mx ? ' rl-ready' : ''}`;
    const burst = !low && performance.now() - rlBurst < 900; rlBurst = 0;
    gz.innerHTML = `<div class="rl-gauge${burst ? ' rl-burst' : ''}" style="--p:${(fill * 100).toFixed(1)}%" role="img" aria-label="경지 ${lv} · 다음까지 은자 ${Math.round(fill * 100)}%"><div class="rl-core"><small>경지</small><b class="rl-lv">${lv}</b><em>${mx ? '끝' : `/ ${REALM_MAX}`}</em></div>${burst ? '<i class="rl-ripple"></i><i class="rl-ripple rl-r2"></i>' : ''}</div>`
      + `<div class="rl-side"><div class="rl-cost">${mx ? '<span>끝까지 올랐어요</span>' : `<small>다음 경지 값</small><span><i class="coin s"></i><b>${unit(cost)}</b></span><small class="rl-have">가진 은자 ${unit(gold)} · ${Math.round(fill * 100)}%</small>`}</div>`
      + `<div class="rl-gain"><span>한 단계마다</span><b>공격 +${pc(REALM_ATK_P)}</b><b>체력 +${pc(REALM_HP_P)}</b></div><div class="rl-tot">지금 공격 +${pc(lv * REALM_ATK_P)} · 체력 +${pc(lv * REALM_HP_P)}</div></div>`;
    c(gz);
    const ms = document.createElement('div'); ms.className = 'rl-ms';
    for (let m = 10; m <= REALM_MAX; m += 10) { const hl = m <= 30, t = document.createElement('span'); t.className = `rl-mk${lv >= m ? ' on' : ''}${hl ? ' rl-heart' : ''}`; t.innerHTML = `<b>${m}</b>${hl ? `<small>심법 ${m / 10}</small>` : ''}`; t.title = hl ? `경지 ${m} — 심법 줄 ${m / 10}칸 열림` : `경지 ${m}`; ms.append(t); }
    c(ms);
    c(R('경지 올리기', mx ? '끝까지 올랐어요' : `값을 내면 바로 오름 · 심법 줄 ${heartLines(lv)}/3 열림`, [['올리기', act(() => { const ok = g.realmUp(); if (ok) rlBurst = performance.now(); return ok; }), mx]], '境'));
  } else if (key === 'grow:4') {
    // 강호행 — 굽은 길 위 단계 칸(연 칸 · 이긴 칸 · 지금 두목 빛남 · 잠김) · 다음 두목(Lv = 엔진 셈) · 열기 값과 얻는 것
    const J = g.S.journey, low = opt.gfx === 'low', bossLv = Math.max(1, Math.round(40 + J.cleared * 1.8)), endJ = J.step >= JOURNEY_MAX, oc = endJ ? 0 : journeyCost(J.step)[0].n;
    const c = card(`강호행 ${J.step}단계`, `이긴 두목 ${J.cleared}`);
    const N = 7, from = Math.max(0, Math.min(JOURNEY_MAX - N, J.cleared - 2)), pts = [];
    const path = document.createElement('div'); path.className = `rl-path${low ? ' rl-low' : ''}`;
    let nodes = '';
    for (let i = 0; i < N; i++) {
      const n = from + i + 1, x = 7 + i * (86 / (N - 1)), y = 50 + (i % 2 ? -22 : 22); pts.push(`${x},${y}`);
      const stt = n <= J.step ? 'done' : n <= J.cleared ? 'won' : n === J.cleared + 1 ? 'cur' : 'lock';
      nodes += `<span class="rl-node rl-${stt}" data-n="${n}" style="left:${x}%;top:${y}%"><b>${n}</b></span>`;
    }
    path.innerHTML = `<svg class="rl-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.join(' ')}"/></svg>${nodes}`;
    c(path);
    const bs = document.createElement('div'); bs.className = 'rl-boss';
    bs.innerHTML = `<img src="art/s2/chb/chb${(J.cleared % 15) + 1}.webp" alt="${J.cleared + 1}단계 두목" loading="lazy" decoding="async" onerror="this.remove()"><div class="rl-binfo"><small>다음 두목</small><b>${J.cleared + 1}단계 두목</b><span class="rl-blv">Lv ${bossLv}</span><small>내 Lv ${g.S.hero.lv} · 60초 안에</small></div>`
      + `<div class="rl-open"><small>단계 열기</small>${endJ ? '<span>끝까지 열었어요</span>' : `<span><i class="coin s"></i><b>${unit(oc)}</b></span><em>최종 피해③ +${(JOURNEY_STEP_P / 10).toFixed(1)}% · 축복 · 옵션 2줄</em>`}</div>`;
    c(bs);
    c(R(`${J.cleared + 1}단계 두목`, '이기면 다음 단계를 열 수 있음', [['도전', act(() => { const r = g.journeyFight(); toast(r.cleared ? '이겼다' : '졌다'); return r; })]], '鬪'));
    c(R('다음 단계 열기', '최종 피해③ · 축복 · 옵션 2줄 — 바로 열림', [['열기', act(() => g.journeyOpen()), J.cleared <= J.step]], '開'));
  } else if (key === 'raid:0') {
    // v541 장 두목 토벌 — 깬 장 두목을 지금 칸 강함으로 다시(하루 2번 함께) · 빨리 깨면 별 · 별마다 처음 한 번 보상
    const left = g.raidLeft(), done = Object.keys(g.S.chb || {}).map(Number).filter((c) => CHBOSS[c]).sort((a, b) => b - a), Rd = g.S.raid || { star: {}, best: {} };
    const c0 = card('장 두목 토벌', `오늘 ${left} / ${CB_RAID.perDay}번 남음 · 자정에 다시`);
    // v6xx 토벌 화면(rd-) — 위: 오늘 남은 횟수 점 · 별 규칙 칩 셋 / 아래: 깬 두목 카드 격자(그림 · 별 · 최고 기록 · Lv · 토벌 · 연습) · 별 셋은 금테
    const rwTx = (o) => Object.entries(o).map(([k, n]) => `${k === 'item:stone' ? '강화석' : '뽑기권'} ${n}`).join(' · ');
    const hd = document.createElement('div'); hd.className = 'rd-hd';
    hd.innerHTML = `<div class="rd-left"><span class="rd-pips" aria-label="오늘 ${left}번 남음">${Array.from({ length: CB_RAID.perDay }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span><small>오늘 남은 토벌</small></div>`
      + `<div class="rd-rules" aria-label="별 받기">${[['깸', 1], [`${CB_RAID.starMs[0] / 1000}초 안`, 2], [`${CB_RAID.starMs[1] / 1000}초 안 · 안 쓰러짐`, 3]].map(([t, n]) => `<div class="rd-chip"><b>${'★'.repeat(n)}</b><span>${t}</span><em>${rwTx(CB_RAID.starRew[n - 1])}</em></div>`).join('')}</div>`
      + `<p class="rd-note">별 받기: 두목마다 별 보상은 처음 한 번 · 깰 때마다 뽑기권 ${CB_RAID.tix} · 강화석 ${CB_RAID.stones} · 처치 은자 · 경험치</p>`;
    c0(hd);
    if (!done.length) {
      const em = document.createElement('div'); em.className = 'rd-empty';
      em.innerHTML = '<img src="art/s2/chb/chb1.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"><div><b>아직 깬 장 두목이 없어요</b><span>10칸마다 나오는 장 두목을 깨면 여기서 다시 칠 수 있어요</span></div>';
      c0(em);
    }
    const grid = document.createElement('div'); grid.className = 'rd-grid';
    for (const ch of done) {
      const D = CHBOSS[ch], st = Rd.star?.[ch] || 0, best = Rd.best?.[ch];
      const el = document.createElement('div'); el.className = `rdrow rd-card${st >= 3 ? ' rd-gold' : ''}`; el.style.setProperty('--bc', D.col);
      el.innerHTML = `<div class="rd-art"><img class="rdimg" src="art/s2/chb/chb${ch}.webp" alt="${esc(D.name)}" loading="lazy" decoding="async"><span class="rd-ch">${ch}장</span><span class="rd-lv">Lv ${g.raidLv(ch)}</span></div>`
        + `<div class="rd-info"><b>${esc(D.name)}</b><span class="rd-st" aria-label="별 ${st}개">${[0, 1, 2].map((i) => `<i class="${i < st ? 'on' : ''}">★</i>`).join('')}</span>`
        + `<small>${best ? `최고 ${(best / 1000).toFixed(1)}초` : '아직 기록 없음'}</small><small class="rd-next">${st < 3 ? `다음 별 ${esc(rwTx(CB_RAID.starRew[st]))}` : '별 다 받음'}</small></div>`;
      const bs = document.createElement('div'); bs.className = 'rd-btns';
      for (const [t, fn, off, cls] of [['토벌', () => g.raid(ch), !g.canRaid(ch), 'btn primary'], ['연습', () => g.practice(ch), !!(g.bossFight || g.dg), 'btn']]) {   // v583 연습(횟수 · 보상 없음)
        const bt = document.createElement('button'); bt.className = cls; bt.textContent = t; bt.disabled = off;
        bt.onclick = act(() => { const ok2 = fn(); if (ok2) closeWin(); return ok2; }); bs.append(bt);
      }
      el.append(bs); grid.append(el);
    }
    if (done.length) c0(grid);
  } else if (key === 'party:0') {
    // 동행 토벌 — 다른 무인의 덱(문파원 · 대결에서 만난 무인 · 즐겨찾기 · 연습 동행) 둘까지 골라 두목 하나
    const ps = g.partyState(); partyTier = Math.max(1, Math.min(ps.tier, partyTier || ps.tier));
    partySel = partySel.filter((u) => partyDecks[u]);
    const RW = partyTier > ps.best ? PARTY.rew.first : PARTY.rew.again;
    const c0 = card('동행 토벌', `오늘 ${ps.left} / ${PARTY.runsPerDay}번 남음 · 자정에 다시`);
    // v6xx 그림 카드 — 위: 그 단계 두목(두목 Lv에 맞는 장 두목 그림) · 단계 큰 숫자 · 오늘 횟수 점 둘 · 최고 단계 / 가운데: 나 + 동료 자리 둘 / 아래: 큰 「출발」
    const bLv = partyLv(partyTier), bCh = Math.max(1, Math.min(CHBOSS.length - 1, Math.ceil(bLv / 10))), BD = CHBOSS[bCh];
    const hd = document.createElement('div'); hd.className = 'pt-hd';
    hd.innerHTML = `<div class="pt-boss" style="--bc:${BD.col}"><img src="art/s2/chb/chb${bCh}.webp" alt="${esc(BD.name)}" loading="lazy" decoding="async"><span>두목 Lv ${bLv}</span></div>`
      + `<div class="pt-info"><div class="pt-tier"><b>${partyTier}</b><em>단계</em>${partyTier > ps.best ? '' : '<span class="pill">깬 단계</span>'}</div>`
      + `<div class="pt-runs"><span class="pt-pips" aria-label="오늘 ${ps.left}번 남음">${Array.from({ length: PARTY.runsPerDay }, (_, i) => `<i class="${i < ps.left ? 'on' : ''}"></i>`).join('')}</span><span>최고 <b>${ps.best}</b>단계 · ${PARTY.timeMs / 1000}초</span></div>`
      + `<div class="pt-rew"><small>${partyTier > ps.best ? '처음 깨면' : '다시 깨면'}</small><span>뽑기권 <b>${RW.tix}</b></span><span>강화석 <b>${RW.stones}</b></span>${RW.pal ? `<span>동료 뽑기권 <b>${RW.pal}</b></span>` : ''}</div></div>`;
    const nav = document.createElement('div'); nav.className = 'pt-nav';
    for (const [t, d, off] of [['◀', -1, partyTier <= 1], ['▶', 1, partyTier >= ps.tier]]) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = t; b.disabled = off; b.onclick = () => { play('click'); partyTier += d; paintWin(); }; nav.append(b); }
    hd.append(nav); c0(hd);
    const slots = document.createElement('div'); slots.className = 'pt-slots';
    const team = [{ me: true, name: '나', job: g.S.hero.job, lv: g.S.hero.lv, eq: g.lookEq() }, ...Array.from({ length: PARTY.allies }, (_, i) => { const u = partySel[i], d = u && partyDecks[u]; return d ? { uid: u, name: d.name, job: d.f.job, lv: d.f.lv, eq: lookOf(d.lk || d.f.lk, d.f.lv) } : null; })];
    for (const w of team) {
      const sl = document.createElement(w && !w.me ? 'button' : 'div');
      if (!w) { sl.className = 'pt-slot pt-empty'; sl.innerHTML = '<i>+</i><span>동료 자리</span>'; slots.append(sl); continue; }
      sl.className = `pt-slot${w.me ? ' pt-me' : ''}`; sl.innerHTML = `<canvas width="84" height="96" aria-hidden="true"></canvas><b>${esc(w.name)}</b><small>${esc(JOBS[w.job]?.name || '')} Lv ${w.lv}</small>`;
      if (!w.me) { sl.type = 'button'; sl.title = '빼기'; sl.onclick = () => pick(w.uid); }
      sl.querySelector('canvas')._d = w; slots.append(sl);
    }
    c0(slots);
    const go = document.createElement('button'); go.className = 'btn primary pt-go'; go.textContent = '출발'; go.disabled = ps.left <= 0 || !!(g.dg || g.bossFight);
    go.onclick = () => { play('click'); const r = g.partyFight(partyTier, partySel.map((u) => partyDecks[u])); if (!r) { toast(g.partyState().left ? '지금은 갈 수 없어요' : '오늘은 다 했어요'); return; } save(); partyTier = 0; partyShow(r); paintWin(); paintHud(); };
    c0(go);
    ptRun(slots);
    c0(note('동행은 내가 넣은 피해만큼까지만 거들어요 · 싸우면 이기든 지든 한 번이에요'));
    const c1 = card('함께 갈 무인', `${partySel.length} / ${PARTY.allies}명 골랐어요`); B.lastChild.classList.add('pt-list');
    if (net.online) { pvpFetch(); if (g.S.guildId) guildLoad(); }
    const seen = new Set([net.uid]), list = [];
    const push = (uid, name, tag, deck, info) => { if (!uid || seen.has(uid)) return; seen.add(uid); if (deck) partyDecks[uid] = deck; list.push({ uid, name, tag, info }); };
    if (g.S.guildId && guildState.g) for (const id of guildState.g.memberIds || []) { const p2 = guildState.prof?.[id]; if (p2?.lv && JOBS[p2.job]) push(id, p2.nickname || guildState.g.members?.[id] || '무인', '문파', null, { job: p2.job, lv: p2.lv, pw: p2.power }); }
    for (const o of g.pvpReal || []) push(o.uid, o.name, '무인', o);
    for (const f of g.S.favs || []) push(f.uid, f.name, '벗', null);
    for (const o of g.partyBots()) push(o.uid, o.name, '연습', o);
    for (const u of partySel) if (!seen.has(u)) push(u, partyDecks[u].name, '무인', partyDecks[u]);
    const pick = (uid) => {
      play('click');
      const i = partySel.indexOf(uid); if (i >= 0) { partySel.splice(i, 1); paintWin(); return; }
      if (partySel.length >= PARTY.allies) { toast(`${PARTY.allies}명까지 고를 수 있어요`); return; }
      if (partyDecks[uid]) { partySel.push(uid); paintWin(); return; }
      if (partyBusy.has(uid)) return;
      partyBusy.add(uid); paintWin();   // 불러오는 동안 그 줄 단추를 잠근다(두 번 눌러 두 번 부르지 않게)
      net.pvpDeckOf(uid).then((opp) => { const d = opp && g.deckClean(opp); if (!d) { toast('함께 갈 수 없어요(덱 없음)'); return; } partyDecks[uid] = d; if (partySel.length < PARTY.allies && !partySel.includes(uid)) partySel.push(uid); }).catch(() => toast('불러오지 못했어요')).finally(() => { partyBusy.delete(uid); if (keyOf() === 'party:0') paintWin(); });
    };
    for (const x of list) {
      const d = partyDecks[x.uid], job = d?.f.job || x.info?.job, lv = d?.f.lv || x.info?.lv, on = partySel.includes(x.uid);
      const r = R(`${esc(x.name)}${job ? ` <small>${JOBS[job].name} Lv ${lv}</small>` : ''} <span class="pill${x.tag === '연습' ? '' : ' pv-real'}">${x.tag}</span>`,
        partyBusy.has(x.uid) ? '덱을 불러오는 중…' : d ? `전투력 ${unit(partyPw(d))}` : x.info?.pw ? `전투력 ${unit(x.info.pw)}` : '고르면 덱을 불러와요',
        [[on ? '빼기' : '고르기', () => pick(x.uid), partyBusy.has(x.uid) || (!on && (partySel.length >= PARTY.allies || (!d && !net.online)))]], job ? JOBS[job].name[0] : '友');
      r.classList.add('pt-cand'); if (on) r.classList.add('pty-on'); c1(r);
    }
    if (!list.some((x) => x.tag !== '연습')) c1(note(net.online ? '문파원 · 대결에서 만난 무인 · 즐겨찾기 무인이 여기에 나와요' : '오프라인 — 연습 동행과 함께 가요'));
  } else if (key === 'content:0') {
    // v531 실제 던전 — 「입장」은 직접 싸움(사냥터 대신 던전) · 한 번 깬 던전은 「소탕」(바로 결과)
    // v6xx 그림 카드 — 던전마다 장 배경 한 조각 · 보상 칩 · 오늘 횟수 점 · 깬 표시 · 잠김 덮개 / 위: 입장권 큰 숫자 · 다음 한 장까지(1초마다) · 모두 소탕
    const ST = g.S.stamina.daily, tix = staminaNow(ST, now()), L = g.S.hero.lv;
    const wrap = document.createElement('div'); wrap.className = `dg${opt.gfx === 'low' ? ' dg-low' : ''}`; add(wrap);
    const regen = () => { const ms = nextRegenMs(ST, now()); return ms ? `다음 1장 <b>${hms(ms)}</b>` : '가득 찼어요'; };
    const top = document.createElement('div'); top.className = 'dg-top'; wrap.append(top);
    top.innerHTML = `<div class="dg-tix"><img src="art/s2/ui/gate.webp" alt="" loading="lazy"><div><small>입장권</small><b>${tix}<em>/${STAMINA.daily.max}</em></b></div><div class="dg-rg"><span class="dg-regen">${regen()}</span><span>2시간마다 1</span></div></div>`;
    // v581 모두 소탕
    { const canAny = Object.keys(DAILY_DUNGEONS).some((k) => g.S.dungeons.best?.[k] && !g.canDungeon('daily', k));
      const sw = R('모두 소탕', canAny ? '깬 수련동을 입장권이 되는 만큼 차례로 바로 끝내요' : '소탕할 수 있는 던전이 없어요(입장권 · 오늘 횟수 · 처음 깨기)', [['모두 소탕', act(() => { const r = g.sweepAll(); if (r) pop('모두 소탕', `<div class="ea-sum"><span>소탕 <b>${r.n}</b>번</span>${r.fail ? `<span>실패 <b>${r.fail}</b></span>` : ''}</div><div class="td-got">${r.gold ? `<span><i class="coin s"></i>은자 <b>${unit(r.gold)}</b></span>` : ''}${r.exp ? `<span>경험치 <b>${unit(r.exp)}</b></span>` : ''}${r.tix ? `<span><i class="coin t"></i>뽑기권 <b>${r.tix}</b></span>` : ''}${r.stones ? `<span>강화석 <b>${r.stones}</b></span>` : ''}</div>`); return r; }), !canAny]], 'i:sweep:掃');
      sw.classList.add('dg-sweep'); if (canAny) sw.classList.add('dg-can'); top.append(sw); }
    const BG = { gold: ['c2', '70% 42%'], gear: ['c5', '60% 32%'], stone: ['c14', '42% 48%'], growth: ['c1', '84% 46%'] }, IC = { gold: 'silver', gear: 'equip', stone: 'enhance', growth: 'training' };
    const GOAL = { kills: (D) => `${D.need}마리 처치`, boss: () => '두목 처치', wipe: () => '모두 처치', survive: () => '버티기' };
    const rw = (D) => (D.reward.goldMin ? `은자 ${unit(Math.round(D.reward.goldMin * KILLS_PER_MIN * goldPerMob(L)))}` : D.reward.gearTickets ? `뽑기권 ${D.reward.gearTickets}` : D.reward.stones ? `강화석 ${D.reward.stones}` : `경험치 ${unit(Math.round(D.reward.expMin * KILLS_PER_MIN * mobExp(L, 'mob', L)))}`);
    const grid = document.createElement('div'); grid.className = 'dg-grid'; wrap.append(grid);
    for (const [k, D] of Object.entries(DAILY_DUNGEONS)) {
      const why = g.canDungeon('daily', k), swept = !!g.S.dungeons.best?.[k], runs = g.S.dungeons.runs[k] || 0, lock = L < D.unlockLv, [bg, pos] = BG[k] || ['c1', '50% 50%'], ic = IC[k] || 'training';
      const el = document.createElement('div'); el.className = `row dg-card${lock ? ' dg-lock' : ''}${swept ? ' dg-best' : ''}`; el.dataset.k = k;
      el.innerHTML = `<div class="dg-pic"><img class="dg-bg" src="art/s2/bg/${bg}.webp" alt="${D.name} 풍경" loading="lazy" decoding="async" style="object-position:${pos}"><img class="dg-ic" src="art/s2/ui/${ic}.webp" alt="" loading="lazy">${swept ? '<i class="dg-clear">깸</i>' : ''}</div>`
        + `<div class="info"><div class="name">${D.name}</div><div class="desc">${GOAL[D.clear](D)} · ${Math.round(D.timeMs / 1000)}초</div>`
        + `<div class="dg-chips"><span><img src="art/s2/ui/${ic}.webp" alt="">${rw(D)}</span></div>`
        + `<div class="dg-runs" title="오늘 ${runs}/${DAILY_RUNS}">${Array.from({ length: DAILY_RUNS }, (_, i) => `<i${i < runs ? ' class="on"' : ''}></i>`).join('')}<small>오늘 ${runs}/${DAILY_RUNS}</small></div>`
        + `${why && !lock ? `<div class="dg-why">${why}</div>` : ''}</div><div class="dg-acts"></div>`
        + `${lock ? `<div class="dg-lockov"><img src="art/s2/ui/lock.webp" alt=""><b>Lv ${D.unlockLv}부터</b><span class="dg-sep"> · </span><small>지금 Lv ${L}</small></div>` : ''}`;
      const acts = el.querySelector('.dg-acts');
      const btn = (label, fn, dis, pri) => { const b = document.createElement('button'); b.className = `btn${pri ? ' primary' : ''}`; b.textContent = label; b.disabled = !!dis; b.onclick = fn; acts.append(b); };
      btn('입장', () => { play('click'); if (!g.enterDungeon('daily', k)) toast(g.canDungeon('daily', k) || '들어갈 수 없어요'); }, !!why, true);
      if (swept) btn('소탕', act(() => { const r2 = g.dailyDungeon(k); if (r2) toast(r2.cleared ? `소탕 — ${D.name} 클리어` : '소탕 실패'); return r2; }), !!why);
      grid.append(el);
    }
    dgStop(); dgIv = setInterval(() => { if (!open || !wrap.isConnected) { dgStop(); return; } if (staminaNow(ST, now()) !== tix) { paintWin(); return; } const e = wrap.querySelector('.dg-regen'); if (e) e.innerHTML = regen(); }, 1000);
  } else if (key === 'content:1') {
    // v616 무한 탑 — 왼쪽은 탑(깬 층은 불 켜짐 · 지금 층은 금빛 · 위로 다음 다섯 층 · 10층마다 상자) · 오른쪽은 지금 층 · 영구 보너스 · 도전 · 연속 오르기 · 이정표 상자
    const T = g.towerSt(), best = T.best, top = Math.min(TOWER_MAX, best + 5), MSs = g.towerMsState(), msOf = (f) => MSs.find((m) => m.floor === f);
    const bon = (n) => `+${(Math.min(TOWER_MAX, n) * TOWER_BONUS.atkL1 / 10).toFixed(1)}%`, nextMs = MSs.find((m) => m.floor > best);
    const fls = [];
    for (let f = top; f >= Math.max(0, best - 2); f--) {
      const st = f === best ? 'tw-cur' : f < best ? 'tw-done' : f === best + 1 ? 'tw-next' : 'tw-up', m = msOf(f);
      fls.push(`<div class="tw-fl ${st}${m ? ` tw-msf tw-${m.state}` : ''}" data-f="${f}" style="--w:${Math.max(62, 100 - (f - Math.max(0, best - 2)) * 5)}%"><i class="tw-roof"></i><div class="tw-body"><b>${f ? `${f}층` : '입구'}</b>${f > best ? '<small>적 4 · 60초</small>' : f === best && f ? '<small>지금</small>' : ''}${m ? `<img src="art/s2/ui/chest.webp" alt="${f}층 상자" loading="lazy">` : ''}</div></div>`);
    }
    const tw = document.createElement('div'); tw.className = 'tw'; add(tw);
    tw.innerHTML = `<div class="tw-tower" aria-label="무한의 탑 ${best}층">${top < TOWER_MAX ? '<div class="tw-mist"></div>' : ''}${fls.join('')}<div class="tw-base"></div></div>
      <div class="tw-side"><div class="tw-now"><small>무한의 탑</small><b>${best}<em>층</em></b><span>깬 층만큼 영구 보너스</span></div>
      <div class="tw-bon"><div><span>지금</span><b>공격%① ${bon(best)} · 체력% ${bon(best)}</b></div>${nextMs ? `<div><span>${nextMs.floor}층</span><b>${bon(nextMs.floor)} · 상자</b></div>` : ''}</div></div>`;
    const side = tw.querySelector('.tw-side');
    side.append(R('연속 오르기', '질 때까지(최대 30층) 다음 층을 바로 끝내요', [['오르기', act(() => { const r = g.towerClimb(30); if (r) { play(r.up ? 'clear' : 'fail'); const ms = MSs.filter((m) => m.state === 'lock' && m.floor <= r.to).map((m) => m.floor); pop('무한의 탑', `<div class="ea-sum"><span>도전 <b>${r.tries}</b>번</span><span>${r.from}층 → <b>${r.to}층</b></span></div>${r.up ? `<div class="tw-pop"><b>${r.to}층 돌파!</b>${ms.map((f) => `<b>${f}층 상자!</b>`).join('')}</div>` : ''}<p class="note">${r.up ? `${r.up}층 올랐어요 — 영구 보너스${ms.length ? ' · 상자는 아래 이정표에서' : ''}` : '한 층도 못 올랐어요 — 전투력을 올리고 다시'}${r.stopped ? '' : ' · 30층 오름(다시 누르면 계속)'}</p>`); } return r; }), !!g.canDungeon('tower')]], '塔'));
    if (best < TOWER_MAX) side.append(R(`${best + 1}층`, '적 넷을 60초 안에 모두 · 이기면 한 층 위로', [['도전', () => { play('click'); if (!g.enterDungeon('tower')) toast(g.canDungeon('tower') || '들어갈 수 없어요'); }, !!g.canDungeon('tower')]], '塔'));
    // 이정표 상자 — 받을 것 · 다음 둘 · 받은 것은 한 줄로
    const can = MSs.filter((m) => m.state === 'can'), got = MSs.filter((m) => m.state === 'got').length, next = MSs.filter((m) => m.state === 'lock').slice(0, 2);
    const NM = { 'ticket:gear': '뽑기권', 'item:stone': '강화석', 'ticket:weapon': '병기 뽑기권', 'ticket:pal': '동료 뽑기권', 'ticket:relic': '영물 뽑기권' };
    const rew = (R2) => Object.entries(R2).map(([k, n]) => `${NM[k] || k} ${n}`).join(' · ');
    const claim = (f) => act(() => { const r = g.towerMsClaim(f); if (r) { play('coin'); toast(`${f}층 상자 — ${rew(r.give)}`); } return r; });
    const cm = card('이정표 상자', `10층마다 처음 한 번${got ? ` · 받은 상자 ${got}개` : ''}`);
    if (can.length > 1) cm(R('모두 받기', `받을 상자 ${can.length}개`, [['모두 받기', act(() => { const rs = g.towerMsClaimAll(); if (rs.length) { play('coin'); toast(`상자 ${rs.length}개 받음`); } return rs.length || null; })]], 'i:chest:賞'));
    for (const m of [...can, ...next]) { const r = R(`${m.floor}층 상자`, rew(m.reward), [[m.state === 'can' ? '받기' : `${m.floor}층부터`, claim(m.floor), m.state !== 'can']], 'i:chest:賞'); r.classList.add('tw-ms', `tw-${m.state}`); r.dataset.f = m.floor; cm(r); }
    if (!can.length && !next.length) cm(note('상자를 모두 받았어요'));
  } else if (key === 'content:2') {
    // v6xx 원정 — 떠난 원정: 그림 길(무인 그림자가 걷는다) · 남은 시간(1초마다) · 막대 · 받기 / 아니면 4 · 8 · 12시간 고르기(받을 몫 미리) · 옆에 시간 티켓
    const E = g.S.exped, L = g.S.hero.lv, nT = W['ticket:time'] || 0, low = opt.gfx === 'low';
    const gain = (h) => { const min = Math.round(h * 60 * EXPEDITION.rate), kills = min * KILLS_PER_MIN; return { min, gold: Math.round(kills * goldPerMob(L)), exp: Math.round(Math.round(kills * mobExp(L)) * (1000 + (st.expP || 0)) / 1000) }; };   // claimExpedition → giveHuntMin 과 같은 셈
    const wrap = document.createElement('div'); wrap.className = `dg dg-exw${low ? ' dg-low' : ''}`; add(wrap);
    const mk = (title, sub, cls) => { const c = document.createElement('div'); c.className = `card ${cls}`; c.innerHTML = `<h3>${title}${sub ? ` <small>${sub}</small>` : ''}</h3>`; wrap.append(c); return c; };
    const ce = mk('원정', `원정권 ${W['ticket:exped'] || 0}장`, 'dg-excard');
    dgStop();
    if (E.run) {
      const run = E.run, dur = run.hours * 3600e3, G = gain(run.hours), done = now() >= run.endMs;
      const sc = document.createElement('div'); sc.className = `dg-scene${done ? ' dg-done' : ''}`; ce.append(sc);
      sc.innerHTML = `<img class="dg-bg" src="art/s2/bg/c13.webp" alt="원정 길" loading="lazy" decoding="async"><div class="dg-path"><i class="dg-road"></i><i class="dg-trail"></i><span class="dg-walker"><canvas width="72" height="90" aria-hidden="true"></canvas></span><img class="dg-goal" src="art/s2/ui/chest.webp" alt="" loading="lazy"></div>`
        + `<div class="dg-cdw"><small>${run.hours}시간 원정</small><b class="dg-cd">${done ? '도착!' : hms(run.endMs - now())}</b></div><div class="dg-bar"><i></i></div>`;
      const r = R(`원정 ${run.hours}시간`, `<span class="nw">${done ? '끝남 — 받기' : `남은 <span class="dg-left">${left(run.endMs)}</span>`}</span> · <span class="nw">은자 ${unit(G.gold)}</span> · <span class="nw">경험치 ${unit(G.exp)}</span>`, [['받기', act(() => g.claimExped()), !done], ['시간 티켓', act(() => g.timeTicket('exped', 15)), !(nT > 0)]], 'i:exped:征');
      ce.append(r);
      const setP = () => sc.style.setProperty('--p', `${Math.max(0, Math.min(100, (1 - (run.endMs - now()) / dur) * 100)).toFixed(2)}%`);
      const cv = sc.querySelector('canvas'), job = g.S.hero.job, eq = g.lookEq();
      const draw = (t) => { const x = cv.getContext('2d'); x.clearRect(0, 0, 72, 90); drawHero(x, 36, 86, job, L, { t, run: t > 0, scale: 0.6, eq }); cv.dataset.n = String((+cv.dataset.n || 0) + 1); };
      setP(); draw(low || done ? 0 : now() / 1000);
      if (!low && !done) { let last = -1e9; const loop = (ts) => { if (!cv.isConnected || !open) return; if (ts - last > 80) { last = ts; draw(now() / 1000); } requestAnimationFrame(loop); }; requestAnimationFrame(loop); }   // 걷는 몸짓(초당 12번) · 창을 닫으면 멈춤
      dgIv = setInterval(() => {
        if (!open || !sc.isConnected) { dgStop(); return; }
        if (!done && now() >= run.endMs) { paintWin(); return; }
        if (low || done) draw(0);   // 그림이 늦게 받아져도 채워지게
        if (done) return;
        sc.querySelector('.dg-cd').textContent = hms(run.endMs - now()); const lf = r.querySelector('.dg-left'); if (lf) lf.textContent = left(run.endMs); setP();
      }, 1000);
    } else {
      const tiles = document.createElement('div'); tiles.className = 'dg-tiles'; ce.append(tiles);
      for (const h of EXPEDITION.hours) {
        const G = gain(h), t = document.createElement('div'); t.className = 'row dg-tile'; t.dataset.h = h;
        t.innerHTML = `<div class="dg-h"><b>${h}</b><em>시간</em></div><div class="info"><div class="name">${h}시간 원정</div><div class="desc">사냥 ${G.min}분 몫</div><div class="dg-chips"><span><i class="coin s"></i>${unit(G.gold)}</span><span><img src="art/s2/ui/training.webp" alt="">경험치 ${unit(G.exp)}</span></div></div>`;
        const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = '출발'; b.onclick = act(() => g.startExped(h)); t.append(b);
        tiles.append(t);
      }
      ce.append(note('원정권 1장으로 떠나요 · 날마다 1장'));
    }
    // v580 시간 티켓 바로 쓰기
    const ct = mk('시간 티켓', '1장 = 사냥 15분 몫', 'dg-ttcard');
    { const tt = document.createElement('div'); tt.className = 'dg-tt'; tt.innerHTML = `<img src="art/s2/ui/time.webp" alt="" loading="lazy"><b>${nT}</b><small>장</small>`; ct.append(tt);
      const use = (n) => act(() => { const r = g.timeHunt(n); if (r) { play('coin'); toast(`시간 티켓 ${r.n}장 — 사냥 ${r.min}분 몫 · 은자 +${unit(r.gold)}${r.lv ? ` · Lv +${r.lv}` : ''}`); } return r; });
      ct.append(R('바로 사냥 보상', '경험치 · 은자를 바로(원정 시간 줄이기에도 써요)', [['1장', use(1), nT < 1], ['모두', use(nT), nT < 1]])); }
  } else if (key === 'content:3') {
    // v6xx 지도 — 위: 지금 장의 칸 길(10칸 · 10칸째 두목 · 지금 칸 빛남 · 깬 칸 밝음) · 아래: 장 카드 15장(옆으로 넘김 · 지금 장으로 저절로)
    const T = g.stage(), cur = Math.ceil(T.idx / 10), topCh = Math.ceil(T.top / 10), st = ((T.idx - 1) % 10) + 1;
    const c = card(`${cur}. ${chapterName(T.idx)} · Stage ${st}/10`, `가장 멀리 ${topCh}장 ${((T.top - 1) % 10) + 1}칸`);
    const trk = document.createElement('div'); trk.className = 'mp-track';
    const mvBtn = (label, fn, dis) => { const b = document.createElement('button'); b.className = 'btn mp-mv'; b.textContent = label; b.disabled = !!dis; b.onclick = fn; return b; };
    const nodes = document.createElement('div'); nodes.className = 'mp-nodes'; nodes.style.setProperty('--bc', CHBOSS[cur]?.col || '#f87171');
    for (let n = 1; n <= 10; n++) { const i = (cur - 1) * 10 + n, d = document.createElement('span');
      d.className = `mp-n${n === 10 ? ' boss' : ''}${i < T.top ? ' clr' : ''}${i === T.idx ? ' now' : ''}${i > T.top ? ' lock' : ''}`;
      d.innerHTML = n === 10 ? `<img src="art/s2/chb/chb${cur}.webp" alt="${esc(CHBOSS[cur]?.name || '두목')}" loading="lazy" decoding="async">` : `<b>${n}</b>`; nodes.append(d); }
    trk.append(mvBtn('◀ 앞 칸', act(() => { if (g.bossFight || T.idx <= 1) return false; T.idx--; T.kills = 0; return true; }), T.idx <= 1), nodes,
      mvBtn('다음 칸 ▶', act(() => { if (g.bossFight || T.idx >= T.top) return false; T.idx++; T.kills = 0; return true; }), T.idx >= T.top));
    c(trk);
    c(R('두목 자동 도전', T.auto ? '켬 — 칸 몹을 다 잡으면 저절로' : '끔 — 들판의 「두목 도전」으로', [['바꾸기', act(() => { T.auto = !T.auto; return true; })]], '自'));
    const c2 = card('장 목록', '15장 · 장마다 10칸 · 연 장을 누르면 가기');
    const strip = document.createElement('div'); strip.className = 'mp-strip';
    for (let ch = 1; ch <= 15; ch++) {
      const first = (ch - 1) * 10 + 1, opened = T.top >= first, done = topCh > ch;
      const prog = done ? 10 : opened ? (T.top - 1) % 10 : 0;   // 깬 칸 수(맨 끝 칸은 아직 안 깸)
      const el = document.createElement('button'); el.type = 'button'; el.className = `mp-ch${ch === cur ? ' cur' : ''}${opened ? '' : ' lock'}${done ? ' done' : ''}`; el.dataset.ch = ch;
      el.disabled = !opened; el.setAttribute('aria-label', `${ch}장 ${chapterName(first)}${opened ? '' : ' · 잠김'}`);
      el.innerHTML = `<img class="mp-bg" src="art/s2/bg/c${ch}.webp" alt="" loading="lazy" decoding="async"><img class="mp-boss" src="art/s2/chb/chb${ch}.webp" alt="${opened ? esc(CHBOSS[ch]?.name || '') : ''}" loading="lazy" decoding="async">`
        + `<span class="mp-t"><i>${ch}장</i><b>${esc(chapterName(first))}</b></span>`
        + (opened ? `<span class="mp-p"><small>${done ? '다 깸' : `10칸 중 ${prog}`}</small><span class="mp-bar"><i style="width:${prog * 10}%"></i></span></span><span class="mp-go">${ch === cur ? '지금' : '가기'}</span>` : `<span class="mp-lk" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>잠김</span>`);
      if (opened) el.onclick = act(() => { if (g.bossFight) return false; T.idx = Math.min(T.top, ch * 10); T.kills = 0; return true; });
      strip.append(el);
    }
    strip.addEventListener('scroll', () => { mpScroll.x = strip.scrollLeft; }, { passive: true });
    c2(strip);
    requestAnimationFrame(() => { if (!strip.isConnected) return;
      if (mpScroll.ch !== cur) { mpScroll.ch = cur; const e = strip.querySelector('.mp-ch.cur'); if (e) strip.scrollLeft = Math.max(0, e.offsetLeft - (strip.clientWidth - e.offsetWidth) / 2); mpScroll.x = strip.scrollLeft; }
      else strip.scrollLeft = mpScroll.x; });
  } else if (key === 'rec:0') {
    // v572 무인 기록 — 이제까지 한 것(업적 마지막 단계의 진행 수 = 처음부터 센 수) · 최고 기록 · 지금 상태
    const S = g.S, B = g.books.ach, cnt = (ev) => { const st = ACHIEVE[ev]?.steps; if (!st) return 0; const s2 = B.get(`a_${ev}_${st.length - 1}`); return s2.done ? st.at(-1) : s2.p || 0; };
    const plus = (ev) => { const st = ACHIEVE[ev]?.steps; return st && B.get(`a_${ev}_${st.length - 1}`).done ? '+' : ''; };
    const T = g.stage(), P = S.pvp || {}, wins = (P.log || []).filter((l) => !l.def && l.win).length;
    // v6xx 기록(rc-) — 묶음 카드(진행 · 전투 · 뽑기 · 강화 · 모음) · 칸마다 그림 · 큰 숫자 · 세이브를 시작한 날
    const n2 = (ev) => `${unit(cnt(ev))}${plus(ev)}`;
    const GRP = [
      ['무인 기록', [['job', '무인', `Lv ${S.hero.lv}`, `${esc(JOBS[S.hero.job].name)} · ${S.hero.adv ? `${S.hero.adv}차 전직` : '입문'}`], ['atk', '전투력', unit(g.power())], ['map', '가장 멀리', `${Math.ceil(T.top / 10)}장 ${((T.top - 1) % 10) + 1}칸`], ['dex', '장 두목 처치', `${Object.keys(S.chb || {}).length}`, '/ 15']]],
      ['전투', [['sweep', '잡은 몹', unit(S.kills || 0)], ['meter', '최고 연속 처치', `${S.comboBest || 0}`], ['gate', '던전 클리어', n2('dungeon'), '번'], ['raid', '장 두목 토벌', n2('raid'), '번'], ['stamp', '토벌 ★3', `${g.dex().three}`, '/ 15'], ['wboss', '월드보스', n2('wboss'), '번'], ['duel', '대결 점수', `${P.score ?? 1000}`, `최근 열 판 중 이긴 공격 ${wins}번`], ['guild', '문파 토벌', n2('graid'), '번']]],
      ['뽑기 · 강화', [['pull', '장비 뽑기', unit(S.gacha?.pulls || 0), '번'], ['enhance', '강화', n2('enhance'), '번'], ['starsoul', '성혼', n2('star'), '번']]],
      ['모음', [['title', '칭호', `${(S.titles || []).length}`, '개'], ['medal', '업적', `${ACH.filter((a) => B.get(a.id).got).length}`, `/ ${ACH.length}`], ['mission', '오늘 할 일 다 함', n2('today'), '번']]],
    ];
    const since = S.created > 1e12 ? `${dexDate(S.created)} 시작 · ${Math.max(1, Math.floor((now() - S.created) / 86400000) + 1)}일째` : '';
    for (const [i, [title, list]] of GRP.entries()) {
      const c0 = card(title, i ? `${list.length}칸` : '처음부터 이제까지'), grid = document.createElement('div'); grid.className = 'rc-grid';
      if (!i && since) { const d = document.createElement('div'); d.className = 'rc-since'; d.textContent = since; c0(d); }
      grid.innerHTML = list.map(([ic, k, v, sub = '']) => `<div class="rc-t" data-k="${ic}"><span class="ico pic rc-ic"><img src="art/s2/ui/${ic}.webp" alt="" decoding="async" onerror="this.parentNode.classList.remove('pic');this.remove()"></span><span class="rc-lb">${k}</span><b>${v}${sub && sub.length <= 4 ? ` <small>${sub}</small>` : ''}</b>${sub.length > 4 ? `<small class="rc-s">${sub}</small>` : ''}</div>`).join('');
      c0(grid); grid.parentNode.classList.add('rc-card');
      if (i === GRP.length - 1) c0(note('큰 숫자는 업적 마지막 단계까지 세어 「+」면 그 넘어'));
    }
  } else if (key === 'look:0') {
    // v565 외형 — 부위마다 보일 등급(얻어 본 등급까지) · 「장비대로」면 낀 것 그대로. 사냥터 · 얼굴 · 대결에서 보이는 모습만(능력치 그대로)
    // 왼쪽: 크게 움직이는 무인(누른 칸을 바로 입혀 봄) · 「이 외형으로」로 정함 / 오른쪽: 부위마다 얻어 본 등급 칸 · 아직 못 얻은 등급은 흐린 칸(무엇이 있는지 보이게)
    const sn = g.lookSeen(), L = g.S.look || {};
    for (const sl of Object.keys(lkPrev)) if (!(lkPrev[sl] <= (sn[sl] ?? -1)) || lkPrev[sl] === L[sl]) delete lkPrev[sl];
    const c0 = card('외형', '사냥터 · 얼굴 · 대결에서 보이는 모습만 바뀌어요(능력치는 낀 장비대로)');
    const wrap = document.createElement('div'); wrap.className = 'lk-wrap';
    const list = document.createElement('div'); list.className = 'lk-list';
    if (Object.keys(L).length) list.append(R('모두 장비대로', '고른 외형을 모두 풀어요', [['되돌리기', act(() => { for (const sl of Object.keys(L)) g.setLook(sl, null); lkPrev = {}; portraitKey = ''; return true; })]], '原'));
    const stage = document.createElement('div'); stage.className = 'lk-stage';
    const cvs = document.createElement('canvas'); cvs.width = 240; cvs.height = 300; cvs.className = 'lk-cv'; cvs.setAttribute('aria-label', '외형 미리 보기');
    const cap = document.createElement('p'); cap.className = 'lk-cap';
    const acts = document.createElement('div'); acts.className = 'lk-acts';
    const go = document.createElement('button'); go.className = 'btn primary lk-go'; go.textContent = '이 외형으로';
    const undo = document.createElement('button'); undo.className = 'btn lk-undo'; undo.textContent = '그만 보기';
    acts.append(go, undo); stage.append(cvs, cap, acts);
    const pvEq = () => { const E = { ...g.lookEq() }; for (const [sl, gr] of Object.entries(lkPrev)) E[sl] = { ...(E[sl] || { slot: sl, up: 0, subs: [] }), g: gr }; return E; };
    const rows = {};
    const sync = () => {
      const pv = Object.entries(lkPrev);
      cap.innerHTML = pv.length ? `미리 보는 중 · ${pv.map(([sl, gr]) => `<span class="g${gr}t">${SLOT_NAME[sl]} ${GRADES[gr]}</span>`).join(' · ')}` : '칸을 누르면 바로 입혀 봐요';
      go.disabled = undo.disabled = !pv.length;
      for (const sl of SLOTS) { const r = rows[sl], show = sl in lkPrev ? lkPrev[sl] : L[sl];
        r.img.src = eqIcon(sl, show != null ? { g: show } : g.S.gear.eq[sl]);
        for (const t of r.tiles) { const gr = +t.dataset.gr; t.classList.toggle('on', L[sl] === gr); t.classList.toggle('pv', sl in lkPrev && lkPrev[sl] === gr); }
        r.base.classList.toggle('on', show == null); }
    };
    go.onclick = act(() => { let n = 0; for (const [sl, gr] of Object.entries(lkPrev)) if (g.setLook(sl, gr)) n++; lkPrev = {}; portraitKey = ''; if (n) setTimeout(() => toast(`외형을 바꿨어요 · ${n}곳`), 0); return n > 0; });
    undo.onclick = () => { play('click'); lkPrev = {}; sync(); };
    for (const sl of SLOTS) {
      const max = sn[sl] ?? -1, cur = L[sl], row = document.createElement('div'); row.className = 'lk-row'; row.dataset.sl = sl;
      row.innerHTML = `<img src="${eqIcon(sl, cur != null ? { g: cur } : g.S.gear.eq[sl])}" alt=""><b>${SLOT_NAME[sl]}</b>`;
      const seg = document.createElement('div'); seg.className = 'seg lk-seg';
      const base = document.createElement('button'); base.textContent = '장비대로'; base.className = cur == null ? 'on' : '';
      base.onclick = () => { play('click'); delete lkPrev[sl]; g.setLook(sl, null); portraitKey = ''; save(); paintWin(); }; seg.append(base);
      if (max < 0) { const sp = document.createElement('small'); sp.textContent = '아직 얻은 것이 없어요'; seg.append(sp); }
      const tl = document.createElement('div'); tl.className = 'lk-tiles'; const tiles = [];
      for (let gr = 0; gr < GRADES.length; gr++) {
        const has = gr <= max, t = document.createElement(has ? 'button' : 'span');
        t.className = `lk-t${has ? '' : ' no'}`; t.dataset.gr = String(gr); t.style.setProperty('--gc', GX_COL[gr]);
        t.innerHTML = `<img src="${eqIcon(sl, { g: gr })}" alt="${GRADES[gr]}품 ${SLOT_NAME[sl]}${has ? '' : '(아직 못 얻음)'}" loading="lazy" decoding="async"><small>${GRADES[gr]}</small>`;
        if (has) { t.onclick = () => { play('click'); if (lkPrev[sl] === gr || L[sl] === gr) delete lkPrev[sl]; else lkPrev[sl] = gr; sync(); }; tiles.push(t); }
        else t.title = `${GRADES[gr]}품 ${SLOT_NAME[sl]} — 얻으면 고를 수 있어요`;
        tl.append(t);
      }
      rows[sl] = { img: row.querySelector('img'), tiles, base };
      row.append(seg, tl); list.append(row);
    }
    wrap.append(stage, list); c0(wrap); sync();
    // 장비 창과 같은 그리기 — 창이 열려 있는 동안 계속(초당 20번) · 그래픽 낮음이면 멈춘 모습(0.5초마다 · 고르면 바로)
    { let last = -1e9; const paint = (ts) => {
        if (!cvs.isConnected || !open) return;   // 창을 닫거나 다른 칸으로 가면 멈춤
        const low = opt.gfx === 'low', E = pvEq(), sig = SLOTS.map((sl) => (E[sl] ? E[sl].g : '-')).join('');
        if (ts - last > (low ? 500 : 50) || sig !== cvs.dataset.eq) { last = ts; const x = cvs.getContext('2d'); x.clearRect(0, 0, 240, 300); x.save(); x.translate(0, 10); const gr = x.createRadialGradient(120, 190, 10, 120, 190, 130); gr.addColorStop(0, '#e8c26a44'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 240, 300); drawHero(x, 120, 270, g.S.hero.job, g.S.hero.lv, { t: low ? 0 : now() / 1000, scale: 2.2, eq: E }); x.restore(); cvs.dataset.eq = sig; cvs.dataset.n = String((+cvs.dataset.n || 0) + 1); }
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
  } else if (key === 'dex:0') {
    // v555 두목 도감 — 장 두목 15명: 그림 · 칭호 · 패턴 · 깸 · 토벌 별 · 최고 기록 · 손으로 깸 / ★3 수 보상
    const D = g.dex();
    const c0 = card('두목 도감', `토벌 ★3 ${D.three} / 15 · 깬 두목 ${D.list.filter((x) => x.beat).length} / 15`);
    c0(R('도감 보상', D.next ? `★3 두목 ${D.next.n}명 — 장비 뽑기권 ${D.next.tix}${D.next.title ? ` · 칭호 「${D.next.title}」` : ''} (지금 ${D.three})` : '모두 받았어요', [['받기', act(() => { const r = g.claimDex(); if (r) { play('rare', 5); toast(`두목 도감 — 뽑기권 ${r.tix}${r.title ? ` · 칭호 「${r.title}」` : ''}`); } return r; }), !D.can]], '鑑'));
    // v613 도감 카드 — 못 만난 두목은 그림자(진짜 그림을 검게) · 만난 두목은 그림 · 이름 · 장 · 별 · 첫 처치 · 한 줄 이야기 · 패턴. 누르면 자세히
    const grid = document.createElement('div'); grid.className = 'dex-grid';
    grid.innerHTML = D.list.map((x) => {
      const ch = x.ch, art = `<div class="dex-art"><img src="art/s2/chb/chb${ch}.webp" alt="${x.seen || x.beat ? esc(x.name) : `${ch}장 두목 그림자`}" loading="lazy" decoding="async"></div>`;
      if (!(x.seen || x.beat)) return `<button class="dex-c unk" data-ch="${ch}">${art}<div class="dex-t"><b>${ch}장 · ???</b><small>${esc(CHAPTERS[ch - 1])} · ${ch * 10}칸에서 만나요</small></div></button>`;
      return `<button class="dex-c ${x.beat ? 'beat' : 'seen'}" data-ch="${ch}" style="--bc:${CHBOSS[ch].col}">${art}<div class="dex-t"><b>${esc(x.name)}</b><small>${ch}장 ${esc(CHAPTERS[ch - 1])} · ${esc(x.title)}</small>${dexStars(x.star)}<p class="dex-lore">${esc(BOSS_LORE[ch] || '')}</p><em>${x.pats.map((p2) => CB_PATS[p2]?.name).join(' · ')} · 필살</em><small>${x.beat ? `${x.at ? `첫 처치 ${dexDate(x.at)}` : '깸'}${x.best ? ` · 최고 ${(x.best / 1000).toFixed(1)}초` : ''}` : '아직 못 깸'}</small></div></button>`;
    }).join('');
    for (const b of grid.querySelectorAll('.dex-c')) b.onclick = () => { const x = D.list[Number(b.dataset.ch) - 1]; play('click'); if (x.seen || x.beat) dexPop(x); else toast(`${x.ch * 10}칸(${CHAPTERS[x.ch - 1]})에서 만나요`); };
    c0(grid);
  } else if (key === 'rank:0') {
    // v547 서열 — 전투력 · 레벨 · 이번 주 월드보스 위 50명 · 내 등수(서버 · 30초마다 새로)
    // v553 주간 보상 — 지난주 월드보스 순위(서버) · 지난주 대결 최고 등급
    // v6xx 모습(rk-) — 주간 보상은 그림 + 뽑기권 칩 · 1~3위는 단상(작은 무인) · 4위부터 짧은 줄 · 내 줄이 목록 밖이면 아래에 붙어 있다 · 오프라인이면 빈 단상
    { const pr = g.pvpWeekReward(), lastWk = wkStr(Date.now() - 7 * 86400000), wbGot = g.S.wbGot?.[lastWk];
      const cw = card('주간 보상', '월요일마다');
      const chip = (n, got) => `<span class="rk-chip ${got ? 'got' : n ? '' : 'none'}"><img src="art/s2/ui/pullw.webp" alt="장비 뽑기권" loading="lazy" decoding="async"><b>${got ? '받음' : n ? `× ${n}` : '—'}</b></span>`;
      const wk = (r, n, got) => { r.classList.add('rk-wk'); if (n || got) r.classList.add(got ? 'got' : 'can'); r.querySelector('.btn').insertAdjacentHTML('beforebegin', chip(n, got)); cw(r); };
      wk(R('지난주 대결', pr ? `최고 ${pr.best}점 · ${esc(pr.tier)}` : '받을 것 없음(기록이 없거나 받음)', [['받기', act(() => { const r = g.claimPvpWeek(); if (r) { play('rare', 4); toast(`지난주 대결 ${r.tier} — 뽑기권 ${r.tix}`); } return r; }), !pr]], 'i:duel:鬪'), pr?.tix || 0, false);
      const wr = guildState.wbLast;
      wk(R('지난주 월드보스', wbGot ? `${wbGot}위` : !net.online ? '오프라인' : wr === undefined ? '순위 불러오는 중…' : wr?.me ? `${wr.me}위` : '지난주에 치지 않았어요',
        [['받기', act(() => { const r = g.claimWbWeek(lastWk, wr?.me); if (r) { play('rare', 4); toast(`지난주 월드보스 ${r.rank}위 — 뽑기권 ${r.tix}`); } return r; }), !!wbGot || !wr?.me]], 'i:wboss:龍'), !wbGot && wr?.me ? g.wbRankReward(wr.me) : 0, !!wbGot);
      if (net.online && wr === undefined && !wbGot) { guildState.wbLast = null; net.top('wb', lastWk, 1).then((r) => { guildState.wbLast = r || { me: 0 }; if (open === 'social') paintWin(); }).catch(() => { guildState.wbLast = { me: 0 }; }); }
    }
    const MODES = [['power', '전투력'], ['lv', '레벨'], ['wb', '이번 주 월드보스'], ['guild', '문파']];   // v561 문파 서열
    const c0 = card('서열', net.online ? `이름 「${esc(g.S.nick || '(아직 없음)')}」 · 설정에서 바꿔요` : '오프라인');
    const seg = document.createElement('div'); seg.className = 'seg rk-seg'; seg.setAttribute('role', 'tablist');
    for (const [m, nm] of MODES) { const b = document.createElement('button'); b.textContent = nm; b.className = m === rankMode ? 'on' : ''; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(m === rankMode)); b.onclick = () => { play('click'); rankMode = m; paintWin(); }; seg.append(b); }
    c0(seg);
    // 단상 — 가운데 1위 · 왼쪽 2위 · 오른쪽 3위(놓는 차례는 CSS order) · 무인은 작은 그림(아래 그리기 고리) · 문파는 깃발 그림 · 비면 그림자
    const SIL = ['sword', 'spear', 'bow'];
    const fig = (i, x) => (x?.guild ? '<img class="rk-gd" src="art/s2/ui/guild.webp" alt="" loading="lazy" decoding="async">'
      : `<canvas width="168" height="150" data-i="${i}" data-job="${esc(x?.job && JOBS[x.job] ? x.job : SIL[i])}" data-lv="${x?.lv || 60 - i * 10}"${x?.lk ? ` data-lk="${esc(JSON.stringify(x.lk))}"` : ''}${!x || !x.job || !JOBS[x.job] ? ` data-sil="${x ? 'row' : '1'}"` : ''} aria-hidden="true"></canvas>`);
    const pod = (top) => `<div class="rk-pod">${[0, 1, 2].map((i) => { const x = top[i];
      if (!x) return `<div class="rk-p top${i + 1} empty"><div class="rk-fig">${fig(i, null)}</div><div class="rk-ped"><i class="rk-md">${i + 1}</i><span class="rk-nm">—</span></div></div>`;
      return `<div class="rk-r rk-p top${i + 1}${x.me ? ' me' : ''}"${x.uid ? ` data-uid="${esc(x.uid)}"` : ''}><div class="rk-fig">${fig(i, x)}</div><div class="rk-ped"><i class="rk-md">${i + 1}</i><span class="rk-nm">${esc(x.name)}</span>${x.sub ? `<small>${x.sub}</small>` : ''}<em>${x.val}</em></div></div>`; }).join('')}</div>`;
    const jobIc = (x) => (x.guild ? '<img class="rk-job" src="art/s2/ui/guild.webp" alt="문파" loading="lazy" decoding="async">' : x.job && JOBS[x.job] ? `<img class="rk-job" src="art/s2/eq/w-${esc(x.job)}-2.webp" alt="${esc(JOBS[x.job].name)}" loading="lazy" decoding="async">` : '<i class="rk-job"></i>');
    const line = (x, n, pin) => `<div class="rk-r rk-l${x.me ? ' me' : ''}${pin ? ' rk-pin' : ''}"${x.uid ? ` data-uid="${esc(x.uid)}"` : ''}><b>${n}</b>${jobIc(x)}<span>${esc(x.name)}${x.me ? ' <i class="rk-you">나</i>' : ''}${x.sub ? ` <small>${x.sub}</small>` : ''}</span><em>${x.val}</em></div>`;
    const board = (list, foot, pin) => pod(list.slice(0, 3)) + `<div class="rk-rows">${list.slice(3).map((x, i) => line(x, i + 4)).join('')}</div>` + (foot ? `<div class="rk-me">${foot}</div>` : '') + (pin ? line(pin.x, pin.n, true) : '');
    const box = document.createElement('div'); box.className = 'rk-list'; c0(box);
    box.innerHTML = `${pod([])}<p class="note rk-wait">불러오는 중…</p>`;
    if (net.online) {
      rankPush();
      const mode = rankMode, fmtV = (v) => (mode === 'lv' ? `Lv ${v}` : unit(v || 0));
      if (mode === 'guild') {   // v561 문파 서열 — 문파 경험치(출석 · 기부) 순
        net.guildTop(g.S.guildId).then((r) => {
          if (!box.isConnected || rankMode !== 'guild') return;
          if (!r.rows.length) { box.innerHTML = `${pod([])}<p class="note rk-wait">아직 문파가 없어요</p>`; return; }
          const list = r.rows.map((x) => ({ guild: true, me: x.id === g.S.guildId, name: x.name || '문파', sub: `${x.n}/10명 · Lv ${1 + Math.floor((x.exp || 0) / 500)}`, val: unit(x.exp || 0) }));
          const pin = g.S.guildId && r.me > r.rows.length ? { n: r.me, x: { guild: true, me: true, name: '내 문파', sub: '', val: unit(r.mine || 0) } } : null;
          box.innerHTML = board(list, g.S.guildId ? (r.me ? (pin ? '' : `내 문파 <b>${r.me}위</b>`) : '내 문파는 아직 목록에 없어요') : '문파에 들면 함께 올라가요', pin);
        }).catch((e) => { if (box.isConnected) box.innerHTML = `${pod([])}<p class="note rk-wait">불러오지 못했어요(${esc(e?.code || '연결')})</p>`; });
      } else rankLoad(mode).then((r) => {
        if (!box.isConnected || mode !== rankMode) return;
        if (!r || !r.rows.length) { box.innerHTML = `${pod([])}<p class="note rk-wait">아직 아무도 없어요 — 처음이 되어 보세요</p>`; return; }
        const list = r.rows.map((x) => ({ uid: x.uid, me: x.uid === net.uid, name: x.nickname || x.name || '무인', job: x.job, lv: x.lv, lk: x.lk, sub: x.job ? `${esc(JOBS[x.job]?.name || '')}${mode !== 'lv' && x.lv ? ` · Lv ${x.lv}` : ''}` : '', val: fmtV(x.v) }));
        const out = r.me > r.rows.length, pin = out ? { n: r.me, x: { uid: net.uid, me: true, name: g.S.nick || '나', job: mode === 'wb' ? null : g.S.hero.job, sub: mode === 'wb' ? '' : `${esc(JOBS[g.S.hero.job]?.name || '')}${mode !== 'lv' ? ` · Lv ${g.S.hero.lv}` : ''}`, val: r.mine != null ? fmtV(r.mine) : '-' } } : null;
        box.innerHTML = board(list, r.me ? `<small>줄을 누르면 무인 정보</small>${out ? '' : ` 내 등수 <b>${r.me}위</b>${r.mine != null ? ` · ${fmtV(r.mine)}` : ''}`}` : mode === 'wb' ? '이번 주 월드보스를 치면 올라가요' : '곧 올라가요(저장할 때)', pin);
      }).catch((e) => { if (box.isConnected) box.innerHTML = `${pod([])}<p class="note rk-wait">불러오지 못했어요(${esc(e?.code || '연결')})</p>`; });
      box.onclick = (e) => { const row = e.target.closest('.rk-r[data-uid]'); if (row) { play('click'); playerCard(row.dataset.uid); } };   // v567
    } else { box.classList.add('rk-off'); box.innerHTML = `${pod([])}<p class="rk-offt"><b>오프라인이에요</b><span>인터넷에 연결되면 보여요</span></p>`; }
    // 작은 무인 그리기 — 초당 15번(그림자만이면 초당 1번 — 그림이 늦게 받아져도 채워지게) · 그래픽 낮음이면 멈춘 모습 · 창을 닫거나 다른 칸으로 가면 멈춤
    { let last = -1e9; const paint = (ts) => {
        if (!box.isConnected || !open) return;
        const cvs = box.querySelectorAll('.rk-pod canvas'), low = opt.gfx === 'low', still = low || [...cvs].every((c) => c.dataset.sil);
        if (ts - last > (still ? 1000 : 66)) { last = ts; const T = low ? 0 : now() / 1000; for (const cv of cvs) rkDraw(cv, T); }
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
  } else if (key === 'rival:0') {
    // v6xx 월드보스 — 레이드 무대: 큰 그림 · 불티 · 남은 도전 · 이번 주 합 · 한 번 최고 · 공동 토벌 길 · 주간 보상 표
    const Wb = g.S.wb || { used: 0, best: 0, total: 0, day: '' };
    const used = Wb.day === String(dayKey(now())) ? Wb.used : 0, wkOn = Wb.week == null || Wb.week === g.S.qWeek, left = Math.max(0, WBOSS.tries - used);
    const wkTot = wkOn ? Wb.total || 0 : 0, wkBest = wkOn ? Wb.best || 0 : 0;
    const hero = document.createElement('div'); hero.className = `wb-hero${opt.gfx === 'low' ? ' low' : ''}`;
    hero.innerHTML = `<div class="wb-sky"></div><div class="wb-emb">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${8 + (i * 53) % 80}%;--t:${3 + (i % 5) * 0.7}s;--dl:${-(i * 0.9).toFixed(1)}s;--s:${2 + (i % 3)}px"></i>`).join('')}</div>
      <img class="wb-art" src="art/s2/chb/wb1.webp" alt="${esc(WBF.name)}" decoding="async">
      <div class="wb-info"><small class="wb-tag">WORLD BOSS · ${WBOSS.fightMs / 1000}초</small><h3 class="wb-nm">${esc(WBF.name)}<em>${esc(WBF.title)}</em></h3>
        <div class="wb-tries" data-left="${left}">${Array.from({ length: WBOSS.tries }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}<span>오늘 남은 도전 <b>${left}</b>/${WBOSS.tries}</span></div>
        <div class="wb-nums"><div><small>이번 주 점수 합</small><b>${fmt(wkTot)}</b></div><div><small>한 번 최고</small><b>${fmt(wkBest)}</b></div></div></div>`;
    const go = rowEl('', `오늘 ${used}/${WBOSS.tries}번 · 약점이 드러난 10초에 무공을 몰아 쓰세요`, [['도전', () => { play('click'); if (!g.enterDungeon('wboss')) toast(g.canDungeon('wboss') || '들어갈 수 없어요'); }, used >= WBOSS.tries || !!g.canDungeon('wboss')]]);
    go.classList.add('wb-go'); hero.querySelector('.wb-info').append(go); B.append(hero);
    // v576 무림 공동 토벌 — 이번 주 모든 무인의 점수 합 · 단계 보상(길 위의 표지 · 받을 수 있으면 빛남)
    { const cc = card('무림 공동 토벌', '단계마다 각자 한 번');
      const T = wbComState, got = g.wbCommunityGot(), tot = T?.sum || 0, top = WB_COMMUNITY.at(-1).at, reach = WB_COMMUNITY.filter((x) => tot >= x.at).length;
      const pos = (v) => Math.min(100, Math.sqrt(v / top) * 100);   // 단계가 5만 · 25만 · 100만이라 제곱근 눈금(앞 단계가 한쪽에 몰리지 않게)
      const tr = document.createElement('div'); tr.className = 'wb-track';
      tr.innerHTML = `<div class="wb-rail"><i style="width:${pos(tot)}%"></i></div>${WB_COMMUNITY.map((x, i) => `<div class="wb-stg ${i < got ? 'got' : i < reach ? 'can' : ''}${i === WB_COMMUNITY.length - 1 ? ' end' : ''}" style="left:${pos(x.at)}%"><b>${i + 1}</b><span>${unit(x.at)}</span><em>뽑기권 ${x.tix}${i < got ? ' ✓' : ''}</em></div>`).join('')}`;
      const ts = document.createElement('div'); ts.className = 'wb-tsum'; ts.innerHTML = `이번 주 모든 무인의 점수 합 · ${T ? `<b>${unit(tot)}</b> · ${T.n}명` : net.online ? '불러오는 중…' : '오프라인'}`;
      cc(ts, tr);
      cc(R('단계 보상', reach > got ? `${reach - got}단계 받을 수 있어요` : reach >= WB_COMMUNITY.length ? '다 받았어요' : `다음 ${unit(WB_COMMUNITY[reach].at)} → 뽑기권 ${WB_COMMUNITY[reach].tix}`, [['받기', act(() => { const r = g.wbCommunityClaim(tot); if (r) { play('rare', 4); toast(`공동 토벌 ${r.n}단계 — 뽑기권 ${r.tix}`); } return r; }), reach <= got]], '衆'));
      if (net.online && (!T || Date.now() - T.at > 30000)) net.wbTotal(wkStr(Date.now())).then((r) => { wbComState = { ...r, at: Date.now() }; if (open === 'social') paintWin(); }).catch(() => { wbComState = { sum: 0, n: 0, at: Date.now() }; });
    }
    // 주간 순위 보상 — 지금 내 자리(알면) · 모르면 친 주엔 적어도 맨 아래 칸
    { const cw = card('주간 순위 보상', '월요일에 지난주 순위로 · 서열 칸에서 받기');
      const rk = rankCache[`wb:${wkStr(Date.now())}`]?.r?.me || 0, ti = rk ? WEEK_REW.wb.findIndex(([n]) => rk <= n) : wkTot > 0 ? WEEK_REW.wb.length - 1 : -1;
      const tb = document.createElement('div'); tb.className = 'wb-tiers';
      tb.innerHTML = `<div class="wb-th"><span>순위</span><b>뽑기권</b></div>` + WEEK_REW.wb.map(([n, tix], i) => { const lo = i ? WEEK_REW.wb[i - 1][0] + 1 : 1; return `<div class="${i === ti ? 'on' : ''}"><span>${n === Infinity ? `${lo}위~` : lo === n ? `${n}위` : `${lo}–${n}위`}${i === ti ? `<em>${rk ? `지금 ${rk}위` : '적어도'}</em>` : ''}</span><b>${tix}</b></div>`; }).join('');
      cw(tb);
      if (net.online && !rankCache[`wb:${wkStr(Date.now())}`]) rankLoad('wb').then((r) => { if (r?.me && open === 'social' && keyOf() === 'rival:0') paintWin(); }).catch(() => {});
    }
    B.append(note('주간 점수는 칠 때마다 서버 서열(무림 → 서열 → 이번 주 월드보스)에 올라가요.'));
  } else if (key === 'rival:1') {
    const P = g.S.pvp || { score: 1000, used: 0, day: '', log: [] };
    const used = P.day === String(dayKey(now())) ? P.used : 0, TI = duelTier(P.score);
    // 위 — 내 점수 · 등급 · 다음 등급까지 막대 · 오늘 남은 횟수
    const c0 = card(`<span>대결 점수 ${P.score} <span class="pill duel-tier">${esc(TI.name)}</span></span>`, `오늘 ${used}/5번 · 남은 ${Math.max(0, 5 - used)}번`);
    { const hd = document.createElement('div'); hd.className = 'duel-head';
      hd.innerHTML = `<div class="duel-tp"><i style="width:${Math.round(TI.p * 100)}%"></i></div><span>${TI.next ? `${esc(TI.next)}까지 ${TI.need}점` : '가장 높은 등급'}</span><span class="duel-tries">${[0, 1, 2, 3, 4].map((k) => `<i class="${k < 5 - used ? 'on' : ''}"></i>`).join('')}</span>`;
      c0(hd); }
    pvpFetch(); pvpInbox();
    if ((g.S.favs || []).length) { const cf = card('즐겨찾기 무인', '정보 · 친선 대결(점수와 상관없이)'); for (const f of g.S.favs) cf(R(esc(f.name), '', [['친선', () => { play('click'); friendly(f.uid); }, !net.online], ['정보', () => { play('click'); playerCard(f.uid); }, !net.online]], '友')); }   // v569
    // 상대 카드 — 작은 모습(그 무인의 외형 · 연습 상대는 레벨대로) · 직업 · 레벨 · 전투력 · 쉬움/비슷/어려움 · 이기면/지면 점수
    const myPw = g.power('pvp'), list = document.createElement('div'); list.className = 'duel-list';
    g.pvpOpponents().forEach((o, i) => {
      const [hard, hc] = duelHard(myPw, o.pw), sw = pvpDelta(true, myPw, o.pw).atk, sl = pvpDelta(false, myPw, o.pw).atk;
      const el = document.createElement('div'); el.className = `duel-opp ${hc}`;
      el.innerHTML = `<canvas class="duel-cv" width="180" height="200"></canvas><div class="duel-oi"><b>${esc(o.name)}</b><small>${esc(JOBS[o.f.job].name)} · Lv ${o.f.lv}</small>
        <div class="duel-tags">${o.real ? '<span class="pill pv-real">무인</span>' : '<span class="pill">연습</span>'}<span class="duel-chip ${hc}">${hard}</span></div>
        <div class="duel-pw">⚔ ${unit(o.pw)}${o.real ? ` <em>${o.score}점</em>` : ''}</div><div class="duel-sd"><span class="w">승 +${sw}</span><span class="l">패 ${sl}</span></div></div>`;
      const cv = el.querySelector('canvas'); cv._d = { job: o.f.job, lv: o.f.lv, eq: lookEqOf(o.lk, o.f.lv), ph: i * 0.7 };
      const bt = document.createElement('div'); bt.className = 'duel-bt';
      [['도전', act(() => duelGo(i)), used >= 5], ...(o.real ? [['정보', () => { play('click'); playerCard(o.uid); }]] : [])].forEach(([lb, fn, dis], k) => { const b = document.createElement('button'); b.className = `btn${k ? '' : ' primary'}`; b.textContent = lb; b.disabled = !!dis; b.onclick = fn; bt.append(b); });   // v568 진짜 상대 정보
      el.append(bt); list.append(el);
    });
    c0(list); duelCvRun();
    if (!g.pvpOpponents().some((o) => o.real)) c0(note(net.online ? '점수가 가까운 무인을 찾는 중 — 없으면 연습 상대와 겨뤄요' : '오프라인 — 연습 상대와 겨뤄요'));
    const log = g.S.pvp?.log || [];
    if (log.length) {
      const c1 = card('지난 대결', '방어 = 남이 내 덱에 도전한 것 · 진 방어는 「복수」');
      log.forEach((l, li) => {
        const canRev = l.def && !l.win && l.by && !l.rev && net.online;
        c1(R(`${l.def ? '방어 ' : ''}${l.win ? '승' : '패'} · ${esc(l.name)}${l.rev === 1 ? ' <span class="pill pv-real">복수함</span>' : l.rev === 2 ? ' <span class="pill">복수 실패</span>' : ''}`, `${l.d >= 0 ? '+' : ''}${l.d}`,
          canRev ? [['복수', () => { play('click'); if (used >= 5) { toast('오늘 대결을 다 했어요'); return; } net.pvpDeckOf(l.by).then((opp) => { const r = opp && g.pvpRevenge(li, opp); if (!r) { toast('복수할 수 없어요(상대 덱 없음)'); return; } net.pvpLog(r.oppUid, { name: g.S.nick, win: r.win, d: r.defD, seed: r.d }).catch(() => {}); save(); rankPush(); pvpAt = 0; closeWin(); duelShow(r); }).catch(() => toast('불러오지 못했어요')); }, used >= 5]] : [], l.def ? '防' : l.win ? '勝' : '敗'));
      });
    }
  } else if (key === 'rival:2') {
    // v549 문파 — 옛 게임과 같은 문파(계정에 하나 · 최대 10명). 만들기 · 코드로 들어가기 · 찾기 · 출석(뽑기권 2 · 은자) · 문파원(서열 프로필)
    // 문파 화면 다시 — 칸 격자(gd-): 없을 때는 문파가 주는 것 · 큰 타일 셋 / 있을 때는 머리(Lv · 경험치) · 토벌 · 수련 · 문파원 카드 · 대화 · 관리
    if (net.online) guildLoad();
    const G = net.online ? guildState.g : null;
    B.classList.add('gd-wb');
    const pic = (n) => `<img src="art/s2/ui/${n}.webp" alt="" loading="lazy" decoding="async">`;
    const box = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
    const GPER = 500;   // 문파 Lv 하나에 드는 경험치(Game.guildLvOf와 같은 값)
    if (!G) {
      const st = !net.online ? ['off', '오프라인 — 인터넷에 연결되면 열려요'] : guildState.busy ? ['wait', '불러오는 중…'] : ['none', '아직 문파가 없어요 — 계정에 하나(옛 게임 문파도 같아요)'];
      add(box('gd-hero', `<div class="gd-hero-ic">${pic('guild')}</div><div class="gd-hero-t"><h3>문파 <small>최대 10명 · 계정에 하나</small></h3><p>같이 출석하고 · 같이 두목을 깎고 · 같이 수련해요</p><span class="gd-st gd-st-${st[0]}">${st[1]}</span>${net.online ? '' : '<p class="note">문파는 서버에 있어요.</p>'}</div>`));
      const bLv = [2, 3, 4, 5, 6, 7, 8, 9].filter((l) => Game.guildBonus(l) > Game.guildBonus(l - 1)), tix0 = 2 + Game.guildBonus(1), tix1 = 2 + Game.guildBonus(99);
      const perks = [
        ['stamp', '출석', `하루 한 번 · 뽑기권 ${tix0}~${tix1} · 은자 · 문파 경험치 +20`],
        ['raid', '토벌', `주 ${GRAID.weekTries}번 · ${GRAID.fightMs / 1000}초 · 단계마다 뽑기권 ${GRAID.rew.tix} · 은자`],
        ['training', '수련', `오늘 할 일 하나 = 1점 · 한 명당 ${GTRAIN.perMember}점 차면 뽑기권 ${GTRAIN.rew.tix} · 은자`],
        ['letter', '대화', '문파원끼리 실시간 · 토벌 소식도'],
        ['medal', '문파 Lv', `경험치 ${GPER}마다 Lv +1 · 출석 뽑기권 +1(Lv ${bLv.join(' · ')})`],
      ];
      add(box('gd-perks', perks.map(([n, t, d]) => `<div class="gd-perk"><i>${pic(n)}</i><b>${t}</b><small>${d}</small></div>`).join('')));
      const shut = !net.online || guildState.busy;
      const tile = (n, name, desc, label, fn) => { const t = box(`gd-tile${shut ? ' off' : ''}`, `<i>${pic(n)}</i><div><b>${name}</b><small>${desc}</small></div>`); const bt = document.createElement('button'); bt.className = 'btn primary'; bt.textContent = label; bt.disabled = shut; bt.onclick = (e) => { e.stopPropagation(); fn(); }; t.append(bt); t.onclick = () => { if (!bt.disabled) fn(); }; return t; };
      const acts = box('gd-acts');
      acts.append(tile('guild', '문파 만들기', '이름 1~16자 · 문주가 돼요', '만들기', () => { play('click'); const n = (prompt('문파 이름(1~16자)') || '').trim(); if (!n) return; ensureNick(); guildDo(() => net.guildCreate(n.slice(0, 16), g.S.nick), '문파를 만들었어요'); }),
        tile('key', '코드로 들어가기', '문파원에게 받은 여섯 자 코드', '들어가기', () => { play('click'); const c = (prompt('문파 코드(6자)') || '').trim(); if (!c) return; ensureNick(); guildDo(() => net.guildJoin(c, g.S.nick), '문파에 들어갔어요'); }),
        tile('map', '문파 찾기', '모집 중 · 자리 남은 문파', '찾기', () => { play('click'); document.querySelector('#gd-find')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
      add(acts);
      if (net.online) {
        const c1 = card('문파 찾기', '모집 중 · 자리 남은 문파'); B.lastElementChild.id = 'gd-find'; B.lastElementChild.classList.add('gd-find');
        if (!guildState.list) c1(note('불러오는 중…'));
        else if (!guildState.list.length) c1(note('지금 모집 중인 문파가 없어요 — 만들어 보세요'));
        else for (const x of guildState.list.slice(0, 20)) c1(R(`${esc(x.name)} <small>${x.n}/10명</small>`, `${esc(x.intro || '')}${x.minLv ? ` · Lv ${x.minLv}부터` : ''} · 경험치 ${unit(x.exp || 0)}`, [['들어가기', () => { play('click'); ensureNick(); guildDo(() => net.guildJoin(x.id, g.S.nick), '문파에 들어갔어요'); }, g.S.hero.lv < (x.minLv || 0)]], '派'));
      }
    } else {
    const dk = S2NetDay(), mine = G.checkins?.[net.uid] === dk, glv = Game.guildLvOf(G.exp), gb = Game.guildBonus(glv), I = guildState.info || {};
    const xpIn = Math.max(0, (G.exp || 0) - (glv - 1) * GPER), isOwner = G.owner === net.uid;
    // 머리 — 이름 · 문파 Lv · 경험치 막대 · 사람 수 · 내 자리 · 출석
    const head = box('card gd-head', `<div class="gd-head-top"><i class="gd-head-ic">${pic('guild')}</i><div class="gd-head-t"><div class="gd-head-n"><b>${esc(G.name)}</b><span class="gd-lv">문파 Lv ${glv}</span><span class="pill ${isOwner ? 'pv-real' : ''}">${isOwner ? '문주' : '문파원'}</span></div><div class="achbar gd-xp"><i style="width:${Math.min(100, (xpIn / GPER) * 100)}%"></i><span>Lv ${glv + 1}까지 ${unit(xpIn)} / ${GPER}</span></div><small>코드 ${G.id} · ${G.memberIds.length}/10명 · 경험치 ${unit(G.exp || 0)}${gb ? ` · 출석 뽑기권 +${gb}` : ''}${I.intro ? ` · 「${esc(I.intro)}」` : ''}</small></div></div>`);
    add(head);
    const chk = R('문파 출석', g.S.gChk === dayKey(now()) ? '오늘은 했어요 · 자정에 새로' : `하루 한 번 — 장비 뽑기권 ${2 + gb}${gb ? `(문파 Lv ${glv} +${gb})` : ''} · 은자 · 문파 경험치 +20${mine ? '(문파 쪽은 오늘 이미)' : ''}`,
      [['출석', () => { play('click'); const r = g.guildCheckin(glv); if (!r) return; save(); play('coin'); toast(`문파 출석 — 뽑기권 ${r.tix} · 은자 ${unit(r.gold)}`); net.guildCheckin(G).then(() => { guildState.at = 0; guildLoad(); }).catch(() => {}); paintWin(); paintHud(); }, g.S.gChk === dayKey(now())]], '印');
    chk.classList.add('gd-chk'); if (g.S.gChk === dayKey(now())) chk.classList.add('done'); head.append(chk);
    // v550 문파 토벌 — 이번 주 두목 · 남은 체력 막대 · 내 몫 · 도전 · 단계 보상 · 문파원 피해
    { const ch = g.graidBoss(), D = CHBOSS[ch], RD = guildState.raid || { dmg: {}, names: {}, lv: 0 }, tot = Object.values(RD.dmg || {}).reduce((a, b) => a + b, 0);
      const lvR = RD.lv || Math.max(10, Math.floor(g.S.hero.lv / 10) * 10), ph = raidPhase(tot, graidHp0(lvR)), GS2 = g.graidState(), why = g.canDungeon('graid');
      const rk = Object.entries(RD.dmg || {}).sort((a, b) => b[1] - a[1]), myD = RD.dmg?.[net.uid] || 0, myR = rk.findIndex(([id]) => id === net.uid) + 1, left = Math.max(0, ph.hp - ph.done);
      const cR = card(`문파 토벌 <small>${ch}장 · ${esc(D.name)}</small>`, `${ph.phase}단계 깸 · 토벌 Lv ${lvR}`); B.lastElementChild.classList.add('gd-raid');
      const top = document.createElement('div'); top.className = 'gr-top gd-boss'; top.innerHTML = `<img src="art/s2/chb/chb${ch}.webp" alt="${esc(D.name)}"><div><div class="gd-ph"><b>${ph.phase + 1}단계</b><small>단계마다 체력 ×1.4 · 월요일에 새 두목</small></div><div class="achbar gd-hp"><i style="width:${Math.min(100, (left / ph.hp) * 100)}%"></i><span>${unit(left)} / ${unit(ph.hp)}</span></div><div class="gd-my">내 몫 <b>${unit(myD)}</b>${myD ? ` · ${myR}위 · ${Math.round((myD / Math.max(1, tot)) * 100)}%` : ' · 아직 안 쳤어요'}</div></div>`; cR(top);
      cR(R('도전', `${GRAID.fightMs / 1000}초 · 이번 주 ${GS2.used}/${GRAID.weekTries}번`, [['도전', () => { play('click'); if (!g.enterDungeon('graid')) toast(g.canDungeon('graid') || '들어갈 수 없어요'); }, !!why]], '討'));
      const can = ph.phase - GS2.claimed;
      cR(R('단계 보상', can > 0 ? `${can}단계 받을 수 있어요` : `받은 단계 ${GS2.claimed} · 단계마다 뽑기권 ${GRAID.rew.tix}`, [['받기', act(() => { const r = g.graidClaim(tot, lvR); if (r) { play('coin'); toast(`문파 토벌 ${r.n}단계 — 뽑기권 ${r.tix} · 은자 ${unit(r.gold)}`); } return r; }), can <= 0]], '賞'));
      if (rk.length) { const bx = document.createElement('div'); bx.className = 'rk-list gd-rk'; bx.innerHTML = rk.map(([id, v], i) => `<div class="rk-r ${id === net.uid ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}" data-uid="${esc(id)}"><b>${i + 1}</b><span>${esc(RD.names?.[id] || '무인')}</span><em>${unit(v)}</em></div>`).join(''); bx.onclick = (e) => { const row = e.target.closest('.rk-r[data-uid]'); if (row) { play('click'); playerCard(row.dataset.uid); } }; cR(bx); }   // v568
    }
    // v552 문파 수련 — 오늘 할 일을 끝낼수록 막대가 찬다 · 다 차면 모두 보상
    { const TR = guildState.train || { pts: {}, names: {} }, tot = Object.values(TR.pts || {}).reduce((a, b) => a + b, 0), goal = GTRAIN.perMember * G.memberIds.length, GT = g.gtrainState(), mineP = g.gtrainPts();
      const cT = card('문파 수련', `내 몫 ${mineP}점 · 월요일에 새로`); B.lastElementChild.classList.add('gd-train');
      const bar = document.createElement('div'); bar.className = 'achbar gd-trbar'; bar.innerHTML = `<i style="width:${Math.min(100, (tot / goal) * 100)}%"></i><span>이번 주 ${unit(tot)} / ${goal}</span>`; cT(bar);
      cT(R('수련 보상', GT.got ? '이번 주는 받았어요' : tot >= goal ? '다 찼어요 — 받기!' : `할 일 하나 = 1점 · 다 차면 뽑기권 ${GTRAIN.rew.tix} · 은자`,
        [['받기', act(() => { const r = g.gtrainClaim(tot, G.memberIds.length); if (r) { play('rare', 4); toast(`문파 수련 — 뽑기권 ${r.tix} · 은자 ${unit(r.gold)}`); } return r; }), GT.got || tot < goal]], '修'));
      const rk = Object.entries(TR.pts || {}).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...rk.map((x) => x[1]));
      if (rk.length) cT(box('gd-trl', rk.map(([id, v]) => `<div class="${id === net.uid ? 'me' : ''}"><span>${esc(TR.names?.[id] || '무인')}</span><i><u style="width:${(v / mx) * 100}%"></u></i><em>${v}</em></div>`).join('')));
    }
    // 문파원 — 카드(직업 · Lv · 전투력 · 오늘 출석) · 누르면 무인 정보(v568)
    const JC = { sword: '#e8c26a', spear: '#e06a5a', fist: '#7cc47a', bow: '#6aa8e0', mage: '#b27ae0' };
    const c1 = card('문파원', `오늘 출석 ${G.memberIds.filter((id) => G.checkins?.[id] === dk).length}/${G.memberIds.length}`); B.lastElementChild.classList.add('gd-mems');
    for (const id of G.memberIds) {
      const p2 = guildState.prof?.[id] || {}, nm = p2.nickname || G.members?.[id] || '무인', jn = JOBS[p2.job]?.name || '', on = G.checkins?.[id] === dk;
      const r = document.createElement('div'); r.className = `row pc-open gd-mem${on ? ' on' : ''}`;
      r.innerHTML = `<i class="gd-av" style="--jc:${JC[p2.job] || '#a8a29e'}">${esc(jn ? jn[0] : nm[0] || '?')}</i><div class="info"><div class="name">${esc(nm)}${id === G.owner ? ' <span class="pill pv-real">문주</span>' : ''}${id === net.uid ? ' <small>(나)</small>' : ''}</div><div class="desc">${p2.lv ? `${esc(jn)} Lv ${p2.lv} · 전투력 ${unit(p2.power || 0)}` : '새 시즌 기록 없음(옛 게임만)'}</div></div><span class="gd-stamp" title="오늘 출석">${on ? '출석' : '—'}</span>`;
      if (id === net.uid) r.classList.add('gd-me'); r.onclick = (e) => { if (e.target.closest('button')) return; play('click'); playerCard(id); }; c1(r);
    }
    const cc = card('문파 대화', '옛 게임 문파와 같은 방 · 최근 30개'); B.lastElementChild.classList.add('gd-chat');
    { const bx = document.createElement('div'); bx.id = 'gchat'; bx.className = 'gchat'; bx.innerHTML = chatHtml(); cc(bx);
      const fm = document.createElement('div'); fm.className = 'gchat-f'; fm.innerHTML = '<input id="gchat-in" maxlength="200" placeholder="문파원에게 한마디(200자)" autocomplete="off"><button class="btn primary" id="gchat-go">보내기</button>'; cc(fm);
      const gin = fm.querySelector('#gchat-in'); gin.value = guildState.draft || ''; gin.oninput = () => { guildState.draft = gin.value; };   // 문파 자료가 와서 창을 다시 그려도 쓰던 글 그대로
      fm.querySelector('#gchat-go').onclick = () => { play('click'); chatSend(); };
      gin.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); chatSend(); } };
      if (gFocus) gin.focus({ preventScroll: true });
      requestAnimationFrame(() => { bx.scrollTop = gAt ?? bx.scrollHeight; bx.dataset.init = 1; chatMarkRead(); }); }
    // 관리 — 부르기 · 코드 · (문주) 소개 · 가입 레벨 · 모집(v573) · 나가기
    const cM = card('문파 관리', isOwner ? '문주만 바꿀 수 있어요' : `코드 ${G.id}`); B.lastElementChild.classList.add('gd-admin');
    cM(R('문파원 부르기', '초대 주소를 보내요 — 그 주소로 들어오면 바로 문파 가입을 물어요', [['공유', () => { play('click'); shareGame(G.id); }]], '招'));   // v596
    cM(R('코드 알려 주기', `문파원을 부를 때 — ${G.id}`, [['복사', () => { play('click'); navigator.clipboard?.writeText(G.id).then(() => toast('코드를 복사했어요'), () => toast(G.id)); }]], '碼'));
    if (isOwner) {
      const set = (o, msg) => { net.guildInfoSet(G, o).then(() => { toast(msg); guildState.at = 0; guildLoad(true); }).catch((e) => toast(e?.code === 'permission-denied' ? '문주만 바꿀 수 있어요' : '바꾸지 못했어요')); };
      cM(R('문파 소개', I.intro ? esc(I.intro) : '찾기 목록에 보일 한 줄(40자)', [['바꾸기', () => { play('click'); const t = prompt('문파 소개(40자)', I.intro || ''); if (t != null) set({ intro: t.trim().slice(0, 40) }, '소개를 바꿨어요'); }]], '介'));
      cM(R('가입 레벨', I.minLv ? `Lv ${I.minLv}부터 들어올 수 있어요` : '누구나', [['바꾸기', () => { play('click'); const t = prompt('가입 레벨(0이면 누구나)', String(I.minLv || 0)); if (t != null) set({ minLv: +t || 0 }, '가입 레벨을 바꿨어요'); }]], '級'));
      cM(R('모집', I.open === false ? '닫힘 — 찾기 목록에 안 보여요(코드로는 들어와요)' : '열림 — 찾기 목록에 보여요', [[I.open === false ? '열기' : '닫기', () => { play('click'); set({ open: I.open === false }, I.open === false ? '모집을 열었어요' : '모집을 닫았어요'); }]], '募'));
    }
    { const lv = R('문파 나가기', '나가면 다시 코드로 들어와야 해요', [['나가기', () => { play('click'); if (!confirm(`「${G.name}」에서 나갈까요?`)) return; guildDo(() => net.guildLeave(G.id).then(() => null), '문파에서 나왔어요'); }]], '出'); lv.classList.add('gd-leave'); cM(lv); }
    }
  } else if (key === 'chat:0') {
    // 전체 대화 — 읽기는 누구나 · 쓰기는 Lv 10부터 · 이름을 누르면 무인 정보
    const cw = card('전체 대화', `모든 무인과 한마디 · 최근 40개 · Lv ${WCHAT.minLv}부터 쓸 수 있어요`);
    const box = document.createElement('div'); box.id = 'wchat'; box.className = 'gchat wchat'; box.innerHTML = worldHtml(); cw(box);
    box.onclick = (e) => { const n = e.target.closest('b[data-uid]'); if (n?.dataset.uid && net.online) { play('click'); playerCard(n.dataset.uid); } };
    const can = net.online && g.S.hero.lv >= WCHAT.minLv;
    const fm = document.createElement('div'); fm.className = 'gchat-f'; fm.innerHTML = `<input id="wchat-in" maxlength="${WCHAT.max}" placeholder="${!net.online ? '오프라인' : can ? `모두에게 한마디(${WCHAT.max}자)` : `Lv ${WCHAT.minLv}부터 쓸 수 있어요`}" autocomplete="off"><button class="btn primary" id="wchat-go">보내기</button>`; cw(fm);
    const inp = fm.querySelector('#wchat-in'), go = fm.querySelector('#wchat-go');
    inp.value = worldState.draft; inp.disabled = go.disabled = !can;
    inp.oninput = () => { worldState.draft = inp.value; };
    go.onclick = () => { play('click'); worldSend(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); worldSend(); } };
    if (wFocus && can) inp.focus();
    worldWatch();
    requestAnimationFrame(() => { box.scrollTop = wAt ?? box.scrollHeight; box.dataset.init = 1; });
  } else if (key === 'title:0') {
    // v537 칭호 — 얻은 것 · 못 얻은 것(얻는 법) · 수집 효과 · 하나 달기
    // 칭호마다 카드 — 빛깔 · 작은 무인에 사냥터와 같은 오라(titleAura)를 둘러 미리 보기 · 얻는 법 · 얻음/잠김 · 「달기」
    const own = new Set(g.S.titles || []), n = TITLES.filter((t) => own.has(t.name)).length;
    const c0 = card('칭호 수집 효과', `${n} / ${TITLES.length}개`);
    c0(statGrid(Object.entries(TITLE_EACH).map(([k, v]) => [STATS[k]?.name || k, `+${(v * n / 10).toFixed(0)}% (하나마다 +${v / 10}%)`])));
    c0(R('다는 칭호', g.S.titleOn ? `「${esc(g.S.titleOn)}」 — 사냥터에서 이름 위에` : '없음', g.S.titleOn ? [['떼기', act(() => g.setTitle(null))]] : [], '稱'));
    const c1 = card('칭호', '장 두목 첫 처치 · 출석 28일');
    const grid = document.createElement('div'); grid.className = 'ttl-grid'; const minis = [];
    for (const t of TITLES) {
      const has = own.has(t.name), on = g.S.titleOn === t.name;
      const el = document.createElement('div'); el.className = `ttl-c${has ? '' : ' no'}${on ? ' on' : ''}`; el.style.setProperty('--tc', t.col); el.dataset.name = t.name;
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; cv.className = 'ttl-cv'; cv.setAttribute('aria-label', `${t.name} 오라 미리 보기`);
      const tx = document.createElement('div'); tx.className = 'ttl-t';
      tx.innerHTML = `<b><i class="ttl-sw"></i><span>${esc(t.name)}</span></b><small>${has ? esc(t.how) : `잠김 — ${esc(t.how)}`}</small><span class="pill ttl-st">${on ? '달고 있음' : has ? '얻음' : '잠김'}</span>`;
      el.append(cv, tx);
      if (has) { const bt = document.createElement('button'); bt.className = 'btn primary ttl-go'; bt.textContent = on ? '달고 있음' : '달기'; bt.disabled = on; bt.onclick = act(() => g.setTitle(t.name)); el.append(bt); }
      grid.append(el); minis.push({ cv, col: t.col, has });
    }
    c1(grid);
    // 작은 무인 + 오라 — 보이는 카드만 초당 15번 · 그래픽 낮음이면 멈춘 모습(1초마다 다시 — 그림이 늦게 받아져도 채워지게) · 창을 닫으면 멈춤
    { const E = g.lookEq(), job = g.S.hero.job, lv = g.S.hero.lv; let last = -1e9;
      const paint = (ts) => {
        if (!grid.isConnected || !open) return;   // 창을 닫거나 다른 칸으로 가면 멈춤
        const low = opt.gfx === 'low';
        if (ts - last > (low ? 1000 : 66)) { last = ts; const T = low ? 0.4 : now() / 1000, vb = PB.getBoundingClientRect();
          for (const m of minis) { const r = m.cv.getBoundingClientRect(); if (r.bottom < vb.top || r.top > vb.bottom) continue;
            const x = m.cv.getContext('2d'); x.clearRect(0, 0, 120, 150);
            titleAura(x, 60, 140, 1.05, T, m.col);
            drawHero(x, 60, 140, job, lv, { t: low ? 0 : T, scale: 0.95, eq: E });
            m.cv.dataset.n = String((+m.cv.dataset.n || 0) + 1); } }
        requestAnimationFrame(paint);
      }; requestAnimationFrame(paint); }
  } else if (key === 'today:0') {
    // v544 오늘 할 일 — 하루마다 도는 것을 한곳에서: 진행 막대 · 끝남 ✓ · 「가기」로 그 창
    const T = g.today(), open2 = T.filter((x) => x.open), left = open2.filter((x) => !x.done).length;
    const c0 = card('오늘 할 일', left ? `${left}개 남음 · 자정에 새로` : '오늘 할 일을 다 했어요!');
    // v545 하루 상자 — 다 하면 받기(뽑기권 · 은자)
    const TC = g.todayChest(), box = document.createElement('div'), nOpen = open2.length, nDone = nOpen - left;
    box.className = `td-chest ms-tchest ${TC.can ? 'can' : TC.got ? 'got' : 'shut'}`; box.dataset.st = TC.got ? 'opened' : TC.can ? 'ready' : 'closed';   // 상자 그림: 닫힘 · 빛남(열 수 있음) · 열림
    box.innerHTML = `<i class="ms-chest"><img alt="하루 상자" src="art/s2/ui/chest.webp">${TC.got ? '<em>✓</em>' : ''}</i><div class="ms-tc"><b>하루 상자</b><small>${TC.got ? '오늘은 받았어요 · 자정에 새로' : TC.can ? '다 했어요 — 눌러서 열기!' : `${TC.left}개 더 하면 열려요`}</small>${msBar(nOpen ? nDone / nOpen : 1, `${nDone} / ${nOpen}`)}${msChips({ 'ticket:gear': 3, gold: 30 })}</div>`;
    if (TC.can) box.onclick = () => { const r = g.claimToday(); if (!r) return; save(); play('rare', 5); buzz(60); box.classList.add('open'); box.dataset.st = 'opened'; setTimeout(() => { pop('하루 상자', `<div class="td-got"><span><i class="coin t"></i>장비 뽑기권 <b>${r.tix}</b></span><span><i class="coin s"></i>은자 <b>${unit(r.gold)}</b></span></div><p class="note">내일 또 — 자정에 새로</p>`); paintWin(); paintHud(); }, 650); };
    c0(box);
    const ic = { attend: '印', daily: '日', dungeon: '洞', raid: '討', wboss: '龍', pvp: '鬪', exped: '征', ach: '功' };
    for (const x of T) {
      const prog = x.of ? `<div class="achbar"><i style="width:${(x.n / x.of) * 100}%"></i><span>${x.n} / ${x.of}</span></div>` : x.n ? `받을 것 ${x.n}개` : '받을 것 없음';
      const r = R(x.name, x.open ? prog : `<span class="dn">${esc(x.why)} 열려요</span>`, x.open && !x.done ? [['가기', () => { play('click'); openKey(x.go); }]] : [], x.done ? '✓' : ic[x.id] || '·');
      r.classList.add('td-row', 'ms-row', x.done ? 'ms-done' : 'ms-on'); if (x.done) r.classList.add('td-done'); if (!x.open) r.style.opacity = '.5';
      c0(r);
    }
  } else if (key === 'ach:0') {
    // v538 업적 — 종류마다 지금 단계(진행 막대 · 보상) · 끝난 단계 수 · 모두 받기
    const B = g.books.ach, can = B.claimable();
    const c0 = card('업적', `${ACH.filter((a) => B.get(a.id).got).length} / ${ACH.length} 받음`);
    c0(msAll('ach', can, '받을 업적', '업적'));
    // 종류마다 묶음(작은 제목) · 지금 단계 진행 막대 + 단계 점(●●○○)
    const CATS = [['사냥 · 두목', ['kill', 'combo', 'chboss', 'raid', 'wboss']], ['성장', ['level', 'stat', 'fate', 'enhance', 'star']], ['뽑기 · 모음', ['gacha', 'pull', 'coll', 'shard', 'shop']], ['하루 · 함께', ['dungeon', 'today', 'party', 'pass', 'guild', 'graid', 'revenge', 'friendly']]];
    const seen = new Set(CATS.flatMap((x) => x[1])), rest = Object.keys(ACHIEVE).filter((e) => !seen.has(e)); if (rest.length) CATS.push(['그 밖', rest]);
    for (const [cn, evs0] of CATS) {
      const evs = evs0.filter((e) => ACHIEVE[e]), all0 = ACH.filter((a) => evs.includes(a.ev)); if (!evs.length) continue;
      const nCan = all0.filter((a) => B.get(a.id).done && !B.get(a.id).got).length;
      const c1 = card(cn, `${all0.filter((a) => B.get(a.id).got).length} / ${all0.length}단계${nCan ? ` · 받을 ${nCan}` : ''}`);
      for (const ev of evs) {
        const list = ACH.filter((a) => a.ev === ev), cur = list.find((a) => !B.get(a.id).got) || list.at(-1), st = B.get(cur.id), all = list.every((a) => B.get(a.id).got), nGot = list.filter((a) => B.get(a.id).got).length;
        const pr = ev === 'level' ? Math.min(1, g.S.hero.lv / +cur.cond.split('>=')[1]) : cur.best ? (st.done ? 1 : Math.min(1, g.achBest(ev) / +cur.cond.split('>=')[1])) : Math.min(1, (st.p || 0) / cur.need);
        const progTxt = ev === 'level' ? `Lv ${g.S.hero.lv} / ${cur.cond.split('>=')[1].trim()}` : cur.best ? (st.done ? '달성' : `${ev === 'combo' ? '최고 ' : ''}${unit(g.achBest(ev))} / ${cur.cond.split('>=')[1].trim()}`) : `${unit(st.p || 0)} / ${unit(cur.need)}`;   // v571 최고형
        const dots = `<span class="ms-dots" role="img" aria-label="${nGot}/${list.length}단계">${list.map((a) => `<i class="${B.get(a.id).got ? 'on' : B.get(a.id).done ? 'can' : ''}"></i>`).join('')}</span>`;
        const can1 = st.done && !st.got;
        const r = R(`${esc(cur.name)} <small>${nGot}/${list.length}단계</small>`,
          all ? `<div class="ms-prog"><span class="ms-ok">✓ 모두 끝냄</span>${dots}</div>` : `<div class="ms-prog">${msBar(pr, progTxt)}${dots}</div>${msChips(msRew(cur))}`,
          all ? [] : [['받기', act(() => g.claimMission('ach', cur.id)), !can1]], all ? '✓' : can1 ? 'i:medal:★' : 'i:medal:功');
        r.classList.add('ms-row', all ? 'ms-done' : can1 ? 'ms-can' : 'ms-on'); if (can1) r.classList.add('can');
        c1(r);
      }
    }
  } else if (key === 'shop:0') {
    // 상점 — 날마다 은자로 사는 물건(하루 살 수 있는 수 · 자정에 새로) · 맨 위는 값 없는 덤(띠 카드) · 아래는 물건 카드 진열대
    // 카드마다 .row 그대로(.name · .desc · .btn) — 큰 그림 · 양 · 값(은자 동전 · 모자라면 붉게) · 남은 수 점 · 다 사면 「품절」 도장
    const L = g.shopState(), gold = W.gold || 0;
    const c = card('오늘의 상점 · 자정에 새로', `<span class="sh-gold"><img alt="" src="art/s2/ui/silver.webp">${unit(gold)}</span><span class="sh-clock" id="sh-clock">${shopLeftTxt()}</span>`);
    const ic = { free: 'i:chest:덤', gear: 'i:pull:裝', weapon: 'i:pullw:兵', pal: 'i:pullp:友', relic: 'i:pullr:靈', stone: 'i:stone:石', time: 'i:time:時', exped: 'i:exped:征' };
    const gv = (give) => Object.entries(give).map(([k, n]) => `${ATTEND_NAME[k] || (k === 'ticket:exped' ? '원정권' : k)} ${n}`).join(' · ');
    const buy = (x, n) => act(() => { const r = g.shopBuy(x.id, n); if (r) { setTimeout(() => toast(`${gv(r.give)} 받음${r.gold ? ` · 은자 −${unit(r.gold)}` : ''}`), 0); } return r; });
    const grid = document.createElement('div'); grid.className = 'sh-grid';
    for (const x of L) {
      if (x.id === 'free') { const r = R(x.name, x.left ? `${gv(x.give)} · 하루 한 번 그냥 드려요` : '오늘은 받았어요 · 내일 또', [['받기', buy(x, 1), !x.left]], ic.free); r.classList.add('sh-free'); if (x.left) r.classList.add('can'); c(r); continue; }
      const most = x.cost > 0 ? Math.min(x.left, Math.floor(gold / x.cost)) : x.left, short = x.left > 0 && gold < x.cost;
      const btns = [['사기', buy(x, 1), !x.can]]; if (x.limit > 1) btns.push(['모두', buy(x, Math.max(1, most)), most < 2]);
      const pips = `<i class="sh-pips" aria-hidden="true">${Array.from({ length: x.limit }, (_, i) => `<b class="${i < x.left ? 'on' : ''}"></b>`).join('')}</i>`;
      const desc = x.left
        ? `<span class="sh-amt" title="${gv(x.give)}">×${unit(Object.values(x.give)[0])}</span><span class="sh-x"> · </span><span class="sh-price${short ? ' sh-short' : ''}"><img alt="" src="art/s2/ui/silver.webp">은자 ${unit(x.cost)}</span><span class="sh-x"> · </span><span class="sh-left">${pips}<em>남은 ${x.left}/${x.limit}</em></span>`
        : `<span class="sh-amt" title="${gv(x.give)}">×${unit(Object.values(x.give)[0])}</span><span class="sh-done">오늘은 다 샀어요</span><span class="sh-x"> · </span><span class="sh-left">${pips}<em>남은 0/${x.limit}</em></span>`;
      const r = R(x.name, desc, btns, ic[x.id] || '·'); r.classList.add('sh-card'); r.dataset.id = x.id;
      if (!x.left) { r.classList.add('sh-out'); const st = document.createElement('span'); st.className = 'sh-stamp'; st.textContent = '품절'; r.append(st); }
      else if (short) r.classList.add('sh-poor');
      grid.append(r);
    }
    c(grid);
    c(note('값은 무인 레벨을 따라 올라요. 다 사도 사냥 두 시간 몫쯤이에요.'));
    shopClockOn();
  } else if (key === 'bounty:0') {
    // 현상수배 — 날마다 사냥 목표 셋(진행 막대 · 보상 · 받기) · 셋 다 끝내면 상자 · 자정에 새로
    const BS = g.bountyState(), gv = (give) => Object.entries(give).map(([k, n]) => `${ATTEND_NAME[k] || k} ${n}`).join(' · ');
    const c = card('현상수배', BS.left ? `${BS.left}개 남음 · 자정에 새로` : '오늘 셋 다 끝냈어요!');
    const PIC = { 'ticket:gear': 'pull', 'item:stone': 'stone' };
    for (const x of BS.list) {
      const title = x.kind === 'stage' ? `${x.ch}장 ${x.k}칸부터 — ${esc(x.mob)} 무리` : x.kind === 'kill' ? '아무 칸 — 몹 사냥' : '두목 사냥';
      const how = x.kind === 'stage' ? `${x.ch}장 ${x.k}칸이나 그 다음 칸에서 몹 ${x.need}마리` : x.kind === 'kill' ? `어디서든 몹 ${x.need}마리` : `칸 두목 깨기 · 사냥터 두목 처치 ${x.need}번`;
      const art = x.art ? `art/s2/mob/${x.art.split(':')[1]}.webp` : 'art/s2/ui/atk.webp';
      const el = document.createElement('div'); el.className = `bty-card${x.can ? ' can' : ''}${x.got ? ' got' : ''}`; el.dataset.i = String(x.i);
      el.innerHTML = `<div class="bty-pic${x.art ? '' : ' ui'}"><img alt="${esc(x.mob || '몹')}" loading="lazy" src="${art}"><i>懸賞</i></div><div class="bty-mid"><b>${title}</b><small>${how}</small><div class="bty-bar"><i style="width:${Math.round((x.n / x.need) * 100)}%"></i><span>${x.n} / ${x.need}</span></div><em><img alt="" src="art/s2/ui/silver.webp">은자 ${unit(x.gold)} · <img alt="" src="art/s2/ui/${PIC[x.rew.k] || 'chest'}.webp">${gv({ [x.rew.k]: x.rew.n })}</em></div>`;
      const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = x.got ? '받음' : '받기'; b.disabled = !x.can;
      b.onclick = act(() => { const r = g.bountyClaim(x.i); if (r) { play('coin'); setTimeout(() => toast(`현상금 — 은자 ${unit(r.gold)}${Object.keys(r.give).length ? ` · ${gv(r.give)}` : ''}`), 0); } return r; });
      el.append(b); c(el);
    }
    const CH = BS.chest, box = document.createElement('div'); box.className = `bty-chest td-chest ${CH.can ? 'can' : CH.got ? 'got' : ''}`;
    box.innerHTML = `<img alt="" src="art/s2/ui/chest.webp"><div><b>현상수배 상자</b><small>${CH.got ? '오늘은 받았어요 · 자정에 새로' : CH.can ? '셋 다 끝냈어요 — 눌러서 열기!' : `${BS.left}개 더 끝내면 열려요`}</small><span>${gv(CH.give)}</span></div>`;
    if (CH.can) box.onclick = act(() => { const r = g.bountyChest(); if (r) { play('rare', 5); buzz(60); setTimeout(() => toast(`현상수배 상자 — ${gv(r.give)}`), 0); } return r; });
    c(box);
    c(note('사냥하면 저절로 차요. 목표는 자정(한국 시각)에 새로 나와요 — 안 받은 현상금은 사라져요.'));
  } else if (key === 'pass:0') {
    // 강호 패스 — 4주 시즌 · 놀면 점수 · 100점마다 한 단(값 없이 누구나) · 단 칸을 눌러 받는다
    const P = g.passState(), nCan = P.rewards.filter((x) => x.state === 'can').length, dd = Math.floor(P.endsInMs / 86400000), hh = Math.floor((P.endsInMs % 86400000) / 3600000);
    const PIC = { 'ticket:gear': 'pull', 'ticket:weapon': 'pullw', 'ticket:pal': 'pullp', 'ticket:relic': 'pullr', 'item:stone': 'stone', 'ticket:time': 'time', 'ticket:exped': 'exped', goldMin: 'silver' };
    const rwName = (rw) => Object.entries(rw).map(([k, n]) => (k === 'goldMin' ? `은자 사냥 ${n}분 몫` : `${ATTEND_NAME[k] || (k === 'ticket:exped' ? '원정권' : k)} ${n}`)).join(' · ');
    const gotName = (r) => [Object.keys(r.give).length ? rwName(r.give) : '', r.gold ? `은자 ${unit(r.gold)}` : ''].filter(Boolean).join(' · ');
    const c = card(`강호 패스 ${P.no}시즌`, `${dd ? `${dd}일 ` : ''}${hh}시간 남음`);
    const head = document.createElement('div'); head.className = 'pass-head';
    head.innerHTML = `<div class="pass-tier">${P.tier}<small>/${PASS.tiers}단</small></div><div class="pass-prog"><div class="pass-bar"><i style="width:${P.into}%"></i></div><div class="pass-sub"><span>${P.tier >= PASS.tiers ? '끝까지 올랐어요' : `다음 단까지 ${P.into}/${P.need}`}</span><span>오늘 ${P.dayPts}/${P.dayCap}</span></div></div>`;
    const all = document.createElement('button'); all.className = 'btn primary'; all.textContent = nCan > 1 ? `모두 받기 ${nCan}` : '모두 받기'; all.disabled = !nCan;
    all.onclick = act(() => { const L = g.passClaimAll(); if (L.length) setTimeout(() => toast(L.length === 1 ? `${L[0].tier}단 — ${gotName(L[0])} 받음` : `패스 ${L.length}단 보상 받음`), 0); return L.length > 0; });
    head.append(all); c(head);
    const tr = document.createElement('div'); tr.className = 'pass-track'; tr.id = 'pass-track';
    for (const x of P.rewards) {
      const ks = Object.keys(x.reward), big = ks.length > 1, k0 = ks[0], b = document.createElement('button');
      b.className = `pass-tile ${x.state}${big ? ' big' : ''}${x.tier === P.tier + 1 ? ' next' : ''}`; b.dataset.tier = String(x.tier);
      b.setAttribute('aria-label', `${x.tier}단 ${rwName(x.reward)}${x.state === 'got' ? ' 받음' : x.state === 'can' ? ' 받기' : ' 잠김'}`);
      b.innerHTML = `<i class="pass-n">${x.tier}단</i><img alt="" loading="lazy" src="art/s2/ui/${big ? 'chest' : PIC[k0] || 'chest'}.webp"><b>${big ? '큰 상자' : k0 === 'goldMin' ? `${x.reward[k0]}분` : `×${x.reward[k0]}`}</b>`;
      b.onclick = x.state === 'can' ? act(() => { const r = g.passClaim(x.tier); if (r) setTimeout(() => toast(`${r.tier}단 — ${gotName(r)} 받음`), 0); return r; })
        : () => { play('click'); toast(x.state === 'got' ? `${x.tier}단 — 받았어요` : `${x.tier}단 — ${rwName(x.reward)} · ${x.tier * P.need}점부터`); };
      tr.append(b);
    }
    c(tr);
    requestAnimationFrame(() => { if (passX !== null) { tr.scrollLeft = passX; return; } const t = tr.querySelector('.pass-tile.can') || tr.querySelector('.pass-tile.next') || tr.lastElementChild; if (t) tr.scrollLeft = t.offsetLeft - tr.offsetLeft - (tr.clientWidth - t.offsetWidth) / 2; });
    c(note('시즌이 끝나면 처음부터 다시 — 안 받은 보상은 사라져요.'));
    const c2 = card('점수 모으기', `하루 ${P.dayCap}점까지 · ${P.need}점마다 한 단`);
    const pl = document.createElement('div'); pl.className = 'pass-pts';
    pl.innerHTML = [['일일 임무 받기', PASS_PTS.daily], ['주간 임무 받기', PASS_PTS.weekly], ['출석', PASS_PTS.attend], ['수련동 깨기', PASS_PTS.dungeon], ['스테이지 두목', PASS_PTS.stage], ['월드보스', PASS_PTS.wboss], ['대결', PASS_PTS.duel], ['동행 토벌', PASS_PTS.party]].map(([n, v]) => `<div>${n}<b>+${v}</b></div>`).join('');
    c2(pl);
  } else if (key === 'attend:0') {
    const A = g.attendState(), can = g.canAttend();
    const c = card('출석', `${A.n % ATTEND_DAYS || (A.n ? ATTEND_DAYS : 0)}/${ATTEND_DAYS}일${A.cycle ? ` · ${A.cycle}바퀴 끝` : ''}`);
    c(R(can ? `오늘 출석 — ${g.attendNext()}일째` : '오늘은 출석했어요', can ? attendLabel(ATTEND[g.attendNext()]) : '내일 다시(한국 시각 자정)', [['출석', () => { play('click'); attendPop(); }, !can]], 'i:stamp:出'));
    const box = document.createElement('div'); box.innerHTML = attendGrid(); c(box.firstChild);
  } else if (key === 'mission:0') {
    const cur = guideCurrent(g.S.q.guide), c = card('길잡이', cur ? `지금 ${cur.id.slice(1)}번` : '다 끝냄');
    for (const q of GUIDE) {
      const s = g.S.q.guide[q.id], now2 = cur && q.id === cur.id, can1 = !!(now2 && s?.done && !s?.got), lvT = q.ev === 'level' ? +q.cond.split('>=')[1] : 0;
      const prog = s?.got ? '<span class="ms-ok">✓ 받음</span>' : now2 ? msBar(can1 ? 1 : lvT ? g.S.hero.lv / lvT : (s?.p || 0) / q.need, can1 ? '끝 — 받기' : lvT ? `Lv ${g.S.hero.lv} / ${lvT}` : `${s?.p || 0} / ${q.need}`) : '';
      const r = R(`${q.id.slice(1)}. ${guideLabel(q)}`, `${prog}${s?.got ? '' : msChips(msRew(q, 'gold'))}`, can1 ? [['받기', () => onGuide()]] : [], s?.got ? '✓' : now2 ? 'i:mission:▶' : '·');
      r.classList.add('quest-row', 'ms-row', s?.got ? 'ms-done' : can1 ? 'ms-can' : now2 ? 'ms-on' : 'ms-lock'); if (now2) r.classList.add('now'); c(r);
    }
  } else if (key === 'mission:1' || key === 'mission:2') {
    const book = key === 'mission:1' ? 'daily' : 'weekly', list = key === 'mission:1' ? DAILY_MISSIONS : WEEKLY_MISSIONS;
    const c = card(key === 'mission:1' ? '일일 임무' : '주간 임무', key === 'mission:1' ? '매일 자정에 새로' : '월요일에 새로');
    const canIds = g.books[book].claimable(); if (canIds.length >= 2) c(msAll(book, canIds, '받을 임무', key === 'mission:1' ? '일일 임무' : '주간 임무'));
    for (const q of list) {
      const s = g.books[book].get(q.id), can1 = s.done && !s.got, p = Math.min(s.p || 0, q.need);
      const r = R(guideLabel(q), `${s.got ? '<span class="ms-ok">✓ 받음</span>' : msBar(p / q.need, `${unit(p)} / ${unit(q.need)}`)}${msChips(msRew(q))}`, [['받기', act(() => g.claimMission(book, q.id)), !s.done || s.got]], s.got ? '✓' : `i:mission:${s.done ? '!' : '·'}`);
      r.classList.add('ms-row', s.got ? 'ms-done' : can1 ? 'ms-can' : 'ms-on'); if (can1) r.classList.add('can'); c(r);
    }
  } else if (key === 'mission:3') {
    // 설정 정리(op-) — 묶음 다섯(방치 · 절전 → 화면 → 진동 → 계정 · 저장 → 알림 · 소식) · 켜고 끄는 줄은 알약 스위치(켜짐 = 금빛, 글 「켜짐/꺼짐」은 그대로) · 맨 아래 판 번호
    const sec = (title, sub, id) => { const c = card(title, sub); const el = B.lastElementChild; el.classList.add('op-sec'); el.dataset.op = id; return c; };
    const sw = (r, on) => { const b = r.querySelector('.btn'); b.classList.add('op-sw'); b.classList.toggle('on', on); b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on)); const t = b.textContent; b.innerHTML = `<i class="op-kn" aria-hidden="true"></i><span class="op-st">${t}</span>`; r.classList.add('op-tg'); return r; };
    const tg = (label, k, desc, ic) => sw(R(label, desc, [[opt[k] ? '켜짐' : '꺼짐', () => { opt[k] = !opt[k]; saveOpt(); play('click'); if (k === 'bgm') bgm(chapterOf(g.zoneLv())); paintWin(); paintHud(); }]], ic), !!opt[k]);
    const cI = sec('방치 · 절전', '', 'idle');
    cI(tg('자동 성장(방치)', 'autoGrow', '1분마다 출석 · 수련동 소탕 · 원정 · 하루 상자 · 문파 출석 · 보상 받기 · 뽑기권 쓰기(장비 · 병기 · 동료 · 영물) · 최고 장비 · 무공 · 강화 · 마스터리 · 경지(은자로 뽑지는 않아요)', '育'));
    if (opt.autoGrow) cI(tg('자동 성장 — 은자 쓰기', 'agGold', '끄면 은자가 드는 무공 올리기 · 강화 · 마스터리 · 경지는 건너뛰어요(보상 · 뽑기권 · 하루 일만)', '銀'));
    cI(tg('절전', 'saver', '2분 동안 손대지 않으면 화면을 어둡게 · 덜 그림(사냥은 그대로)', '眠'), tg('화면 켜 두기(방치)', 'wake', wakeOK() ? '손전화가 저절로 화면을 끄지 않게 — 켜 두면 계속 사냥(절전과 같이 쓰면 배터리 덜 씀)' : '이 브라우저는 지원하지 않아요 — 꺼져도 돌아오면 방치 보상', '燈'));   // v578 · v586
    const dOn = g.S.dodge !== false;   // v540
    cI(sw(R('두목 패턴 자동 피하기', dOn ? '자동 전투 때 붉은 범위 밖으로 비켜요' : '붉은 범위는 회피 단추(점프 위 · Shift)로 직접 · 터지기 직전에 피하면 완벽 회피(피해 ×1.3) · 장 두목을 처음 깨면 강화석 +50', [[dOn ? '켜짐' : '꺼짐', () => { g.setDodge(g.S.dodge === false); play('click'); save(); paintWin(); }]], '避'), dOn));
    const c1 = sec('화면', '', 'screen');
    c1(R('그래픽', opt.gfx === 'low' ? '낮음(배터리 아낌 · 흙먼지 · 은자 연출 끔)' : '높음', [['바꾸기', () => { opt.gfx = opt.gfx === 'low' ? 'high' : 'low'; saveOpt(); paintWin(); }]], '畵'));
    c1(R('피해 숫자', { all: '전부', crit: '치명만', off: '끄기' }[opt.nums], [['바꾸기', () => { opt.nums = { all: 'crit', crit: 'off', off: 'all' }[opt.nums]; saveOpt(); paintWin(); }]], '數'));
    c1(tg('화면 흔들림', 'shake', '큰 무공 · 두목 패턴 · 당겨짐', '搖'), tg('피해 측정기', 'dps', '들판 왼쪽 위에 초당 피해 · 분당 처치', '測'), tg('두목전 결과 자동 진행', 'autoNext', '결과 창이 3초 뒤 저절로 닫히고 다음으로', '進'));
    if (document.documentElement.requestFullscreen) c1(R('전체 화면', fsEl() ? '켜짐' : '주소창 없이 화면을 다 쓴다(안드로이드 · 컴퓨터)', [[fsEl() ? '끄기' : '켜기', () => { play('click'); goFull(!fsEl()); setTimeout(paintWin, 300); }]], '全'));
    // v629 컴퓨터 화면 고정 — 가로 틀(높이 720)을 창 크기에 맞춰 키움 / 끄면 창 전체를 그대로(예전처럼)
    if (pcFramed || (matchMedia('(pointer: fine)').matches && matchMedia('(hover: hover)').matches)) c1(R('컴퓨터 화면 고정', pcFramed ? '켜짐 — 가로 화면을 창 크기에 맞춰 키워요' : '꺼짐 — 창 전체를 그대로 써요', [[pcFramed ? '끄기' : '켜기', () => { play('click'); save(); try { localStorage.setItem('ifu-s2-pcfix', pcFramed ? '0' : '1'); } catch { /* 저장 못 하면 이번만 */ } (pcFramed ? window.top : window).location.replace(`${pcFramed ? 'index.html' : 'pc.html'}${location.search}`); }]], '屏'));
    const c0 = sec('진동', '', 'vib');
    c0(tg('진동', 'vib', '치명타 · 큰 무공 · 두목 고비 · 맞을 때 · 쓰러질 때(휴대폰)', '震'));
    if (navigator.vibrate) c0(R('진동 세기', `${VIB_K_NAME[opt.vibK] ?? '보통'} — 울리는 길이 ×${VIB_K[opt.vibK] ?? 1}`, [['바꾸기', () => { opt.vibK = ((opt.vibK ?? 1) + 1) % 3; saveOpt(); play('click'); buzz(VIB.sk4); paintWin(); }]], 'i:vib:强'));
    const c3 = sec('계정 · 저장', net.online ? (net.isGoogle() ? `Google · ${esc(net.email())}` : '이 기기만(Google 미연결)') : net.status === 'connecting' ? '연결 중…' : '오프라인 — 이 기기에만 저장', 'acct');
    c3(R('Google 연결', net.isGoogle() ? '연결됨 — 다른 기기에서도 Google로 들어오면 이어서 해요' : '연결해 두면 기기를 바꾸거나 지워도 되살려요', [[net.isGoogle() ? '다른 계정' : '연결', () => { play('click'); if (net.isGoogle()) net.switchTo(null).then((d) => (d ? applyCloud(d) : toast('그 계정에는 새 시즌 진행이 없어요'))).catch((e) => toast(e?.message || '바꾸지 못했어요')); else linkGoogle(); }, !net.online]], 'G'));
    c3(R('저장 코드', '계정 없이 글자 한 줄로 옮기기', [['복사', () => { play('click'); exportCode(); }], ['붙여넣기', () => { play('click'); importCode(); }]], '碼'));
    c3(R('서버에 저장', net.cloudAt ? `마지막 ${new Date(net.cloudAt).toLocaleString()} · 3분마다 저절로` : '3분마다 저절로 올려요', [['지금 저장', act(() => { cloudPush(true).then((ok) => toast(ok ? '서버에 저장했어요' : '저장하지 못했어요(오프라인?)')); return true; }), !net.online]], '雲'));
    c3(R('서열 이름', g.S.nick ? esc(g.S.nick) : '아직 없음 — 서버에 올릴 때 정해져요', [['바꾸기', () => { play('click'); const n = prompt('서열에 보일 이름(1~12자)', g.S.nick || ''); if (n == null) return; if (g.setNick(n)) { save(); rankPush(); toast('이름을 바꿨어요'); } else toast('1~12자로 적어 주세요'); paintWin(); }]], '名'));   // v547
    c3(R(`시간 티켓 ${W['ticket:time'] || 0}장`, '1장 = 15분 · 원정 · 방치에 씀', [], '時'));
    const rs = R('새로 시작', '새 시즌 진행을 지우고 처음부터', [['처음부터', () => pop('새로 시작할까요?', '<p class="note">새 시즌 진행을 지워요(서버 저장도 새 진행으로 덮여요). 옛 게임 진행은 그대로예요. 남겨 두려면 먼저 「저장 코드 → 복사」.</p>', [['아니요', null], ['예', () => { localStorage.removeItem(SAVE_KEY); location.reload(); }]])]], 'i:reset:新');
    rs.classList.add('op-danger'); c3(rs);
    c3(R('옛 게임(무림방치)', '예전 진행은 그대로 — 따로 열 수 있어요', [['열기', () => { save(); (pcFramed ? window.top : window).location.href = 'classic.html'; }]], '舊'));
    const c4 = sec('알림 · 소식', '', 'news');
    c4(R('업데이트 소식', `새로 생긴 것 — 지금 판 v${NEWS_V}`, [['보기', () => { play('click'); newsPop(NEWS, true); }]], 'i:mission:新'));   // v560
    c4(R('친구에게 알리기', '게임 주소를 보내요 — 공유 창이 없으면 주소를 복사', [['공유', () => { play('click'); shareGame(); }]], 'i:letter:友'));   // v595
    const ft = document.createElement('div'); ft.className = 'op-foot';
    ft.innerHTML = `<b class="op-name">${esc(document.title || '방치형키우기')}</b><span class="op-ver">${esc(BUILD)}</span><small>새 시즌은 계속 고쳐 가요 — 숫자 · 화면이 바뀔 수 있어요.</small>`;
    B.append(ft);
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
const COST_ICO = { gold: 'silver', 'item:stone': 'stone', 'item:restore': 'reset' };   // v626 재료 그림(art/s2/ui)
function needRows(cost) {
  return `<div class="need">${cost.map((c2) => { const h = g.S.wallet[c2.k] || 0; return `<div class="need-r ${h >= c2.n ? 'ok' : 'no'}"><span>${COST_ICO[c2.k] ? `<img src="art/s2/ui/${COST_ICO[c2.k]}.webp" alt="">` : ''}${COST_NAME[c2.k] || c2.k}</span><b>${unit(c2.n)}</b><small>가진 것 ${unit(h)}</small></div>`; }).join('')}</div>`;
}
const pctTxt = (pm) => `${(pm / 10).toFixed(pm % 10 ? 1 : 0)}%`;
// v626 ★ — 열까지는 작은 별(한 줄 다섯) · 넘으면 숫자
const starPips = (n) => (n > 10 ? `<span class="en-sn">★${n}</span>` : n > 0 ? `<span class="en-pips" aria-label="★${n}">${[Math.min(5, n), Math.max(0, n - 5)].filter(Boolean).map((k) => `<i>${'★'.repeat(k)}</i>`).join('')}</span>` : '<span class="en-s0">★0</span>');
const enRing = (pm, cls = '') => `<div class="en-ring ${cls}" style="--p:${(pm / 10).toFixed(1)}"><b>${pctTxt(pm)}</b><small>성공</small></div>`;
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
// 동행 토벌 — 고른 단계 · 고른 동행(uid) · 받아 둔 덱(uid → 덱)
let partyTier = 0, partySel = [], ptRaf = 0;
const ptStop = () => { cancelAnimationFrame(ptRaf); ptRaf = 0; };
// 동행 자리의 작은 무인들 — 창이 열려 있는 동안만 그린다(닫거나 다른 칸으로 가면 멈춤) · 낮은 그래픽이면 한 번만
function ptRun(box) {
  ptStop();
  const cvs = [...box.querySelectorAll('canvas')], low = opt.gfx === 'low';
  const draw = (ts) => { for (const [i, cv] of cvs.entries()) { const d = cv._d; if (!d || !JOBS[d.job]) continue; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); drawHero(x, cv.width / 2, cv.height - 4, d.job, d.lv || 1, { t: low ? 0 : ts / 1000 + i * 0.4, scale: 0.95, eq: d.eq }); cv.dataset.n = String((+cv.dataset.n || 0) + 1); } };
  draw(0); if (low) return;
  let last = -1e9; const loop = (ts) => { if (!open || !box.isConnected) { ptRaf = 0; return; } if (ts - last > 60) { last = ts; draw(ts); } ptRaf = requestAnimationFrame(loop); }; ptRaf = requestAnimationFrame(loop);
}
const partyDecks = {}, partyPwMemo = new Map(), partyBusy = new Set();
const partyPw = (d) => { if (d.pw) return d.pw; if (!partyPwMemo.has(d)) partyPwMemo.set(d, g.deckPower(d)); return partyPwMemo.get(d); };
// 결과 — 세 무인이 나란히(대결 화면처럼 그 무인의 외형으로) · 피해 몫 막대 · 보상
function partyShow(r) {
  const who = [{ name: '나', job: g.S.hero.job, lv: g.S.hero.lv, eq: g.lookEq() }, ...r.allies.map((a) => ({ ...a, eq: Object.fromEntries(SLOTS.map((sl) => [sl, { slot: sl, g: a.lk && a.lk[sl] != null ? a.lk[sl] : Math.min(6, Math.floor(a.lv / 25)), up: 0, subs: [] }])) }))];
  const bars = who.map((w, i) => `<div class="pty-b"><span>${esc(w.name)} <small>${esc(JOBS[w.job]?.name || '')} Lv ${w.lv}</small></span><div class="pty-bar"><i class="pty-c${i}" style="width:${Math.max(1, r.share[i])}%"></i></div><b>${r.share[i].toFixed(1)}%</b></div>`).join('');
  const RW = r.rewards, left = Math.max(0, 100 - Math.round((r.dmg.reduce((a, b) => a + b, 0) * 100) / r.hp0));
  const html = `<div class="pty-res"><canvas class="pty-cv" width="${who.length * 150}" height="190" style="aspect-ratio:${who.length * 150}/190"></canvas><div class="pty-side">
    <div class="pty-t ${r.cleared ? 'win' : 'lose'}">${r.cleared ? '토벌 성공' : '토벌 실패'} <small>${r.cleared ? `${(r.timeMs / 1000).toFixed(1)}초` : `두목 체력 ${left}% 남음`}</small></div>${bars}
    ${RW ? `<div class="td-got pty-got">${RW.first ? '<span class="pill pv-real">처음</span>' : ''}<span>뽑기권 <b>${RW.tix}</b></span><span>강화석 <b>${RW.stones}</b></span>${RW.pal ? `<span>동료 뽑기권 <b>${RW.pal}</b></span>` : ''}</div>` : `<p class="note">${r.allies.length < PARTY.allies ? '동행을 더 데려가거나 ' : ''}전투력을 올려 다시 가요 · 오늘 ${r.left}번 남음</p>`}</div></div>`;
  pop(`동행 토벌 · ${r.tier}단계`, html);
  const sh = $('modal').querySelector('.sheet'); sh.classList.add('wide');
  const cv = sh.querySelector('.pty-cv'); if (!cv) return;
  const x = cv.getContext('2d'), t0 = now();
  const tick = () => {
    if (!cv.isConnected) return;
    x.clearRect(0, 0, cv.width, cv.height);
    who.forEach((w, i) => { if (!JOBS[w.job]) return; x.save(); if (!r.cleared) x.globalAlpha = 0.55; drawHero(x, 75 + i * 150, 178, w.job, w.lv || 1, { t: (now() - t0) / 1000 + i * 0.4, scale: 1.7, eq: w.eq }); x.restore(); });
    requestAnimationFrame(tick);
  };
  tick();
  addLog(`동행 토벌 ${r.tier}단계 ${r.cleared ? '성공' : '실패'}`);
}
// v567 무인 정보 — 서열에서 줄을 누르면: 그 무인의 모습(고른 외형) · 직업 · 레벨 · 전투력 · 대결 점수 · 이번 주 월드보스 · 문파
// 남의 외형 — 부위마다 보이는 등급(lk)이 있으면 그대로, 없으면 레벨로 어림
const lookOf = (lk, lv) => Object.fromEntries(SLOTS.map((sl) => [sl, { slot: sl, g: lk?.[sl] ?? Math.min(6, Math.floor((lv || 1) / 25)), up: 0, subs: [] }]));
// 서열 단상의 작은 무인 하나 — data-job · data-lv · data-lk · data-sil(그림자: 흰 빛 한 겹)
let rkScratch = null;
function rkDraw(cv, T) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, d = cv.dataset, i = +d.i || 0, job = JOBS[d.job] ? d.job : 'sword', lv = +d.lv || 1;
  let lk = null; try { lk = d.lk ? JSON.parse(d.lk) : null; } catch { lk = null; }
  x.clearRect(0, 0, W, H);
  const gr = x.createRadialGradient(W / 2, H - 8, 4, W / 2, H - 8, W * 0.46); gr.addColorStop(0, d.sil ? 'rgba(255,255,255,.08)' : ['#fde04766', '#e5e7eb55', '#f0abfc55'][i]); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  const o = { t: d.sil ? 0 : T + i * 0.45, scale: 1.55, eq: lookOf(lk, lv) };
  if (d.sil) { const s = (rkScratch ||= document.createElement('canvas')); s.width = W; s.height = H; const sx = s.getContext('2d'); drawHero(sx, W / 2, H - 6, job, lv, o); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = d.sil === 'row' ? ['rgba(253,224,71,.4)', 'rgba(229,231,235,.34)', 'rgba(240,171,252,.34)'][i] : 'rgba(255,255,255,.2)'; sx.fillRect(0, 0, W, H); x.drawImage(s, 0, 0); }
  else drawHero(x, W / 2, H - 6, job, lv, o);
  // 가장자리를 흐리게 — 경지 기운(옅은 빛 판)이 작은 칸에서 네모로 잘려 보이지 않게
  x.save(); x.globalCompositeOperation = 'destination-in';
  const fx = x.createLinearGradient(0, 0, W, 0); fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(0.24, '#000'); fx.addColorStop(0.76, '#000'); fx.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = fx; x.fillRect(0, 0, W, H);
  const fy = x.createLinearGradient(0, 0, 0, H); fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(0.1, '#000'); x.fillStyle = fy; x.fillRect(0, 0, W, H); x.restore();
  d.n =String((+d.n || 0) + 1);
}
function playerCard(uid) {
  pop('무인 정보', '<p class="note">불러오는 중…</p>');
  net.playerCard(uid).then((p) => {
    const M = $('modal'); if (!M || M.classList.contains('hidden')) return;
    const body = M.querySelector('.mbody, .body, #modal-body') || M.querySelector('div:last-child');
    if (!p) { toast('기록이 없어요'); closeModal(); return; }
    const eq = lookOf(p.lk, p.lv);
    const html = `<div class="pc"><canvas width="240" height="260"></canvas><div class="pc-i"><b>${esc(p.nickname || '무인')}${uid === net.uid ? ' <small>(나)</small>' : ''}</b><span>${esc(JOBS[p.job]?.name || '')} · Lv ${p.lv}</span>
      <div class="pc-g"><span>전투력</span><em>${unit(p.power || 0)}</em><span>대결</span><em>${p.pvpScore ?? p.pvp ?? '-'}${p.pvpScore != null ? ` · ${esc(tierName(p.pvpScore))}` : ''}</em><span>월드보스(주)</span><em>${unit(p.wbScore || 0)}</em><span>문파</span><em>${p.guildId ? esc(p.guildId) : '없음'}</em></div></div></div>`;
    closeModal();
    const acts = uid === net.uid ? [['확인', null]] : [[g.isFav(uid) ? '즐겨찾기 빼기' : '즐겨찾기', () => { const r2 = g.toggleFav(uid, p.nickname); save(); toast(r2 === null ? '즐겨찾기는 20명까지' : r2 ? '즐겨찾기에 넣었어요' : '즐겨찾기에서 뺐어요'); }], ['친선 대결', () => friendly(uid)], ['확인', null]];   // v569
    pop('무인 정보', html, acts);
    const cv = $('modal').querySelector('.pc canvas'); if (cv && JOBS[p.job]) { const x = cv.getContext('2d'); let t0 = now(); const tick = () => { if (!cv.isConnected) return; x.clearRect(0, 0, 240, 260); drawHero(x, 120, 245, p.job, p.lv || 1, { t: (now() - t0) / 1000, scale: 2.5, eq }); requestAnimationFrame(tick); }; tick(); }
  }).catch(() => { toast('불러오지 못했어요'); closeModal(); });
}
const tierName = (sc) => { const T = [[2150, '현경'], [1850, '화경'], [1600, '초절정'], [1400, '절정'], [1250, '고수'], [1100, '중수'], [0, '하수']]; return (T.find(([m]) => sc >= m) || T.at(-1))[1]; };
// v569 친선 대결 — 그 무인의 방어 덱과(점수 · 횟수 그대로 · 기록 남지 않음)
function friendly(uid) {
  net.pvpDeckOf(uid).then((opp) => { const r = opp && g.pvpFriendly(opp); if (!r) { toast('겨룰 수 없어요(방어 덱 없음)'); return; } closeModal(); closeWin(); duelShow(r); }).catch(() => toast('불러오지 못했어요'));
}
// v559 무공 모두 올리기 결과 — 무공마다 Lv 전 → 후 · 쓴 은자 · 전투력
function kitAllPop(r) {
  const rows = r.per.map((x, i) => { const sk = skillById(x.id); return `<div class="ea-r" style="--d:${0.1 + i * 0.06}s"><span style="color:${sk?.col || '#fff'}">${esc(sk?.name || x.id)}</span><b>Lv ${x.from}</b><i>→</i><b class="up">Lv ${x.to}</b></div>`; }).join('');
  pop('무공 모두 올리기', `<div class="ea-sum"><span>올림 <b>${r.n}</b>번</span><span>은자 <b>${unit(r.gold)}</b></span></div><div class="ea-list">${rows}</div><div class="ea-pw">전투력 ${unit(r.pw0)} → <b>${unit(r.pw1)}</b>${r.pw1 > r.pw0 ? ` <em>▲ ${unit(r.pw1 - r.pw0)}</em>` : ''}</div>`);
  play('rare', 3); addLog(`무공 모두 올리기 — ${r.n}번 · 은자 ${unit(r.gold)}`);
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
function enhPop(sl, fx) {
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
  const pct = pctTxt;
  // v627 파괴된 칸 복구(복구 주문서 1장 · 엔진 restoreSlot 그대로) — 되살아나는 ★는 사본으로 미리 계산
  const RS_COST = [{ k: 'item:restore', n: 1 }], rsTo = S2.broken ? (() => { const t = { slots: { [sl]: { ...S2 } } }; restoreSlot(t, sl, { 'item:restore': 1 }); return t.slots[sl].star; })() : 0;
  // v626 en- 큰 그림(등급 테) · 지금 → 다음(+강화 · ★) · 칸마다 성공 고리 · 재료 칩(그림)
  sh.innerHTML = `<h2>장비 강화</h2>
    <div class="en-hero"><div class="en-big g${it.g}" style="--gc:${GX_COL[it.g]}"><img src="${eqIcon(sl, it)}" alt="${SLOT_NAME[sl]}">${S2.broken ? '<i class="en-bk">파괴</i>' : ''}</div>
      <div class="en-hi"><div class="en-hn"><b class="g${it.g}t">${GRADES[it.g]}품${it.up ? '上' : ''} ${SLOT_NAME[sl]}</b><small>${S2.broken ? '파괴 — 복구 필요 · ' : ''}전투력 ${unit(g.power())}</small></div>
        <div class="en-nums"><span><small>강화</small><b class="en-cur">+${S2.enh}</b>${eMax ? '<em>끝</em>' : `<i>→</i><b class="up">+${S2.enh + 1}</b>`}</span><span><small>성혼</small><b class="en-scur${S2.broken ? ' dn' : ''}">★${S2.broken ? `${S2.broken} 파괴` : S2.star}</b>${sMax ? '' : `<i>→</i><b class="up">★${S2.star + 1}</b>`}</span></div></div></div>
    <div class="enh2">
      <section><div class="en-sh"><h3>강화 <span>${eMax ? '끝' : `+${S2.enh} → +${S2.enh + 1} · 성공 ${pct(eOk)}`}</span></h3>${eMax ? '' : enRing(eOk)}</div>
        <div class="cmp">${statRows(now0, eAfter)}</div>
        ${eMax ? '<p class="note">강화를 끝까지 했어요.</p>' : `<div class="need-h">필요한 것 / 가진 것</div>${needRows(eCost)}<p class="note">실패해도 단계는 그대로 · 재료만 들어요.</p>`}
        <div class="btn-row"><button class="btn primary" id="ep-e1" ${eMax || !have(eCost) ? 'disabled' : ''}>강화</button><button class="btn" id="ep-e5" ${eMax || !have(eCost) ? 'disabled' : ''}>5번 강화</button></div>
      </section>
      <section><div class="en-sh"><h3>성혼 <span>${sMax ? (S2.broken ? '파괴됨' : '끝') : `★${S2.star} → ★${S2.star + 1} · 성공 ${pct(od.ok)}${od.down ? ` · 하락 ${pct(od.down)}` : ''}${od.brk ? ` · 파괴 ${pct(od.brk)}` : ''}`}</span></h3>${sMax ? '' : enRing(od.ok, 'st')}</div>
        <div class="cmp">${statRows(now0, sAfter)}</div>
        ${sMax ? '' : `<div class="need-h">필요한 것 / 가진 것</div>${needRows(sCost)}<p class="note">실패가 쌓이면 다음 한 번은 성공(${S2.pity || 0}/${PITY_POINTS}).${S2.star >= PROTECT_FROM && S2.star <= PROTECT_TO ? ` <label class="prot"><input type="checkbox" id="ep-prot" ${enhProt ? 'checked' : ''}> 파괴 방지(은자 ×${1 + PROTECT_BREAK_COST_X})</label>` : S2.star < BREAK_FROM ? ' 15성부터 파괴될 수 있어요.' : ''}</p>`}
        ${S2.broken ? `<div class="need-h">복구 — 필요한 것 / 가진 것</div>${needRows(RS_COST)}<p class="note">되살리면 ★${rsTo}부터 다시 성혼할 수 있어요.</p>` : ''}
        <div class="btn-row">${S2.broken ? `<button class="btn primary" id="ep-rs" ${have(RS_COST) ? '' : 'disabled'}>복구</button>` : ''}<button class="btn${S2.broken ? '' : ' primary'}" id="ep-s1" ${sMax || !have(sCost) ? 'disabled' : ''}>성혼</button></div>
      </section>
    </div>
    <div class="btn-row" style="margin-top:10px"><button class="btn" id="ep-swap">장비 바꾸기</button><button class="btn" id="ep-off">해제</button><button class="btn primary" id="ep-close">닫기</button></div>`;
  const again = (r) => { save(); paintHud(); if (open) paintWin(); enhPop(sl, r); };
  const doEnh = (n) => {
    const before = { ...G.slots[sl] }, p0 = itemStats(it, G.slots[sl], L), rs = [];
    for (let i = 0; i < n; i++) { const r = g.enhance(sl); if (r === null) break; rs.push(r); if (G.slots[sl].enh >= ENH_MAX) break; }
    if (!rs.length) { toast('재료가 모자라요'); return; }
    save(); paintHud();
    forgeFx('enh', sl, rs, before, () => diffTxt(p0, itemStats(it, G.slots[sl], L)) || '', () => again(G.slots[sl].enh > before.enh ? 'ok' : 'no'));
  };
  $('ep-e1').onclick = () => doEnh(1);
  $('ep-e5').onclick = () => doEnh(5);
  $('ep-s1').onclick = () => {
    const before = { ...G.slots[sl] }, p0 = itemStats(it, G.slots[sl], L), r = g.star(sl, { noBreak: prot });
    if (!r) { toast('재료가 모자라요'); return; }
    save(); paintHud();
    forgeFx('star', sl, [r], before, () => diffTxt(p0, itemStats(it, G.slots[sl], L)) || '', () => again(r === 'ok' ? 'ok' : 'no'));
    if (r === 'break') setTimeout(() => toast('파괴! 복구 주문서로 되살릴 수 있어요'), 1300);
  };
  const pr = $('ep-prot'); if (pr) pr.onchange = (e) => { enhProt = e.target.checked; enhPop(sl); };
  const rb = sh.querySelector('#ep-rs'); if (rb) rb.onclick = () => { if (!restoreSlot(G, sl, g.S.wallet)) { toast('복구 주문서가 없어요'); return; } g.dirtyStats = true; play('clear'); toast(`복구 · ★${G.slots[sl].star}`); again('ok'); };
  // 끝난 뒤 큰 그림: 성공이면 금빛 번쩍 · 실패면 짧게 흔들림(그래픽 낮음이면 없음 · 흔들림은 설정 따름)
  if (fx && opt.gfx !== 'low' && (fx === 'ok' || opt.shake)) { const bg = sh.querySelector('.en-big'); if (bg) { bg.classList.add(fx === 'ok' ? 'en-fl' : 'en-sk'); setTimeout(() => bg.classList.remove('en-fl', 'en-sk'), 700); } }
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
    ...(c.lock ? [] : [[`분해(강화석 ${yl.n})`, () => { if (dismantleItem(G, c.uid, g.S.wallet)) { toast(`분해 · 강화석 +${yl.n} · 뽑기 조각 +${1 + c.g}`); save(); } }]]),
    ['장착', () => { if (equip(G, c.uid)) { g.dirtyStats = true; g.emit('equip'); toast(`${SLOT_NAME[c.slot]} 낌`); save(); } }],
  ]);
}
// o: { pick(c) — 누르면 비교 창 대신 이것 · sel — 고른 uid · nw — 「NEW」 uid 묶음 }
function invGrid(items, cur, L, o = {}) {
  const G = g.S.gear, GC2 = ['#a8a29e', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#ffffff'];
  const grid = document.createElement('div'); grid.className = 'inv-grid';
  for (const c of items) {
    const now2 = cur !== undefined && cur !== null ? cur : G.eq[c.slot], better = !now2 || gearScore(c, L) > gearScore(now2, L), nw = !!o.nw?.has(c.uid);
    const b = document.createElement('button'); b.dataset.uid = String(c.uid); b.className = `inv-tile gr-tile g${c.g}${better ? ' up' : ''}${o.sel === c.uid ? ' gr-pick' : ''}`; b.style.setProperty('--gc', GC2[c.g] || '#fff');
    b.innerHTML = `<img src="${eqIcon(c.slot, c)}" alt="${SLOT_NAME[c.slot]}" loading="lazy" style="width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))"><b>${GRADES[c.g]}품${c.up ? '上' : ''}</b><small>${SLOT_NAME[c.slot]}${better ? ' <em class="gr-tup">▲</em>' : ''}</small>${nw ? '<i class="gr-new" aria-label="새로 얻음">NEW</i>' : ''}`;
    if (c.lock) b.classList.add('locked');
    b.onclick = () => {
      play('click');
      if (nw) { o.nw.delete(c.uid); b.querySelector('.gr-new')?.remove(); }
      if (o.pick) o.pick(c); else itemPop(c, L);   // v521 바로 끼지 않고 비교 창부터
    };
    grid.append(b);
  }
  return grid;
}
// 장착 창 비교 — 지금 | 바꾸면 · 스탯마다 차이(초록 ▲ · 빨강 ▼) · 전투력 변화 · 「끼기」(칸 강화 · 성혼은 칸에 붙어 그대로)
function gearCmp(sl, cur, c, L) {
  const G = g.S.gear, S2 = G.slots[sl], a = cur ? itemStats(cur, S2, L) : {}, b = itemStats(c, S2, L);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const p0 = g.power(), p1 = powerWith(sl, c), dp = Math.round(p1) - Math.round(p0);
  const side = (it, lab) => `<div class="gr-cmp-it${it ? '' : ' none'}" style="--gc:${it ? GX_COL[it.g] : '#555'}"><img src="${eqIcon(sl, it)}" alt=""><div><small>${lab}</small><b class="${it ? `g${it.g}t` : ''}">${it ? `${GRADES[it.g]}품${it.up ? '上' : ''}` : '비어 있음'}</b></div></div>`;
  const rows = keys.map((k) => { const x = a[k] || 0, y = b[k] || 0, d = y - x; return `<div class="gr-cmp-r"><span>${STATS[k]?.name || k}</span><b>${x ? fmtStat(k, x) : '–'}</b><b>${y ? fmtStat(k, y) : '–'}</b><em class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d ? `${d > 0 ? '▲ +' : '▼ −'}${fmtStat(k, Math.abs(d))}` : '='}</em></div>`; }).join('');
  const d = document.createElement('div'); d.className = 'gr-cmp';
  d.innerHTML = `<div class="gr-cmp-h">${side(cur, '지금')}<span class="gr-cmp-ar">→</span>${side(c, '바꾸면')}</div>`
    + `<div class="gr-cmp-rows"><div class="gr-cmp-r hd"><span></span><b>지금</b><b>바꾸면</b><em>차이</em></div>${rows}</div>`
    + `<div class="gr-cmp-f"><div class="gr-cmp-pw ${dp > 0 ? 'up' : dp < 0 ? 'dn' : ''}"><small>전투력 ${unit(p0)} → ${unit(p1)}</small><b>${dp > 0 ? '▲ +' : dp < 0 ? '▼ −' : ''}${dp ? unit(Math.abs(dp)) : '그대로'}</b></div><button class="btn gr-cmp-more">자세히</button><button class="btn primary gr-cmp-eq">끼기</button></div>`;
  d.querySelector('.gr-cmp-more').onclick = () => { play('click'); itemPop(c, L); };
  d.querySelector('.gr-cmp-eq').onclick = act(() => { const r = equip(G, c.uid); if (r) { g.dirtyStats = true; g.emit('equip'); eqCand = null; setTimeout(() => toast(`${SLOT_NAME[sl]} 낌 · 전투력 ${unit(p0)} → ${unit(g.power())}`), 0); } return r; });
  return d;
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
// v562 칭호 오라 — 발밑 빛 · 기둥 · 오르는 불티 열(사냥터 · 칭호 창 미리 보기가 함께 쓴다) · k = 크기 배율 · ts = 초
// v618 칭호 오라 — 들판과 칭호 창 미리 보기가 함께 쓴다 · 그라디언트는 캔버스 · 빛깔 · 크기마다 한 번만 만들어 무인 자리로 옮겨 그린다(v617)
const auraCache = new WeakMap();
function titleAura(cx, hx, hy, k, ts, col) {
  let A = auraCache.get(cx); if (!A) { A = {}; auraCache.set(cx, A); }
  const ak = `${col}|${k}`;
  if (A.k !== ak) { A.k = ak; A.r = cx.createRadialGradient(0, 0, 2, 0, 0, 60 * k); A.r.addColorStop(0, col); A.r.addColorStop(1, 'rgba(0,0,0,0)'); A.l = cx.createLinearGradient(0, -120 * k, 0, 0); A.l.addColorStop(0, 'rgba(0,0,0,0)'); A.l.addColorStop(1, col); }
  cx.save(); cx.globalCompositeOperation = 'lighter';
  const pulse = 0.75 + 0.25 * Math.sin(ts * 2.4);
  cx.translate(hx, hy);
  cx.globalAlpha = 0.6 * pulse; cx.fillStyle = A.r; cx.beginPath(); cx.ellipse(0, 0, 60 * k, 16 * k, 0, 0, 7); cx.fill();
  cx.globalAlpha = 0.16 * pulse; cx.fillStyle = A.l; cx.fillRect(-26 * k, -120 * k, 52 * k, 120 * k);
  cx.translate(-hx, -hy);
  cx.fillStyle = col;
  for (let i = 0; i < 10; i++) {
    const ph = (ts * 0.55 + i / 10) % 1, px = hx + Math.sin(i * 2.1 + ts * 1.7) * 26 * k * (1 - ph * 0.4), py = hy - ph * 125 * k;
    cx.globalAlpha = (1 - ph) * 0.95 * pulse; cx.beginPath(); cx.arc(px, py, (3.6 - ph * 1.8) * k, 0, 7); cx.fill();
  }
  cx.restore();
}
let portraitKey = '';
function paintPortrait(H) {
  const E = g.lookEq(), key = `${H.job}:${H.lv}:${Object.values(E).map((it) => (it ? it.g : '-')).join('')}:${wearCount()}`; if (key === portraitKey) return; portraitKey = key;   // v516 장비가 바뀌면 얼굴도 새로
  const c = $('face'), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  x.save(); x.beginPath(); x.arc(52, 52, 50, 0, 7); x.clip();
  const gr = x.createRadialGradient(52, 40, 6, 52, 52, 60); gr.addColorStop(0, '#3a2e22'); gr.addColorStop(1, '#120f0b'); x.fillStyle = gr; x.fillRect(0, 0, 104, 104);
  drawHero(x, 52, 196, H.job, H.lv, { t: 0, scale: 1.75, eq: g.lookEq() });   // 얼굴 · 어깨만 보이게 크게
  x.restore();
}
// v519 레벨업 — 무인 위에 「LEVEL UP」 · 왼쪽 아래 Lv 상자가 번쩍
let lastLv = 0;
let lvFxAt = -1e9, lvFxLv = 0, lvFxTm = 0, heroAt = null;   // v624 잇따라 오르면 0.6초에 한 번만(마지막 레벨로)
function levelUpFx(lv) {
  const t0 = performance.now();
  if (t0 - lvFxAt < 600) { lvFxLv = Math.max(lvFxLv, lv); if (!lvFxTm) lvFxTm = setTimeout(() => { lvFxTm = 0; levelUpFx(lvFxLv); }, 600 - (t0 - lvFxAt)); return; }
  lvFxAt = t0; lvFxLv = lv;
  play('clear');
  document.documentElement.classList.toggle('hb-low', opt.gfx === 'low');
  const me = $('me'), ml = $('me-lv');
  for (const [el, c] of [[me, 'hb-flash'], [ml, 'hb-pop']]) { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); }
  for (const o of document.querySelectorAll('.hb-fl')) o.remove();
  if (heroAt) { const f = document.createElement('div'); f.className = 'hb-fl'; f.textContent = `Lv ${lv}!`; f.style.left = `${Math.round(heroAt[0])}px`; f.style.top = `${Math.round(Math.max(40, heroAt[1]))}px`; $('battle').append(f); setTimeout(() => f.remove(), 1200); }
  for (const o of document.querySelectorAll('.lvfx')) o.remove();   // 잇따라 오르면 마지막 것만
  const d = document.createElement('div'); d.className = 'lvfx'; d.innerHTML = '<b>LEVEL UP</b>'; $('battle').append(d); setTimeout(() => d.remove(), 1700);   // v624 레벨 숫자는 무인 머리 위 「Lv n!」(.hb-fl)로
}
// ── 곧 열림 — 레벨로 열리는 것의 차례표(숫자는 표에서 그대로: 수련동 DAILY_DUNGEONS.unlockLv · 전직 JOB_LV · 마스터리 MASTERY 첫 노드) ──
//   들판 「다음: ○○ · Lv n」 칩(#nx) · 그 레벨에 닿으면 한 번 「○○ 열림!」. 어디까지 알렸는지는 이 기기에만 적는다(세이브에 넣지 않음)
const UNLOCKS = [
  ...Object.values(DAILY_DUNGEONS).map((D) => ({ lv: D.unlockLv, name: `수련동 ${D.name}`, short: '수련동', key: 'content:0' })),
  ...JOB_LV.slice(1).map((lv, i) => ({ lv, name: `${i + 1}차 전직`, short: `${i + 1}차 전직`, key: 'hero:3' })),
  { lv: Math.min(...MASTERY.map((m) => m.lv)), name: '마스터리', short: '마스터리', key: 'hero:2' },
].map((u, i) => [u, i]).sort((a, b) => a[0].lv - b[0].lv || a[1] - b[1]).map((x) => x[0]);
const UNL_KEY = 'ifu.s2.unl';
const lvHint = (need) => `Lv ${need}부터 · 지금 Lv ${g.S.hero.lv}`;
let unlSeen = null;
function paintUnlock() {
  const L = g.S.hero.lv, nx = $('nx'), n = UNLOCKS.filter((u) => u.lv <= L).length;
  if (unlSeen == null) { try { const t = localStorage.getItem(UNL_KEY); unlSeen = t == null ? n : +t || 0; } catch { unlSeen = n; } }
  if (n !== unlSeen) {
    if (n > unlSeen) toast(`${UNLOCKS.slice(unlSeen, n).slice(-3).map((u) => u.name).join(' · ')} 열림!`);   // 새로 시작해 레벨이 내려갔으면 조용히 맞춘다
    unlSeen = n; try { localStorage.setItem(UNL_KEY, String(n)); } catch { /* 저장 못 해도 */ }
  }
  const next = UNLOCKS[n];
  nx.classList.toggle('hidden', !next);
  if (!next) { $('dpsm').style.top = ''; return; }
  const k = `${n}:${L}:${$('qc').dataset.k || ''}:${$('qc').classList.contains('hidden') ? 0 : 1}`;
  if (nx.dataset.k === k) return;   // v614 바뀐 것이 없으면 자리를 재지 않는다(재면 화면 배치를 억지로 다시 계산 — 0.2초마다)
  if (!$('qc').classList.contains('hidden') && !$('qc').offsetHeight) return;   // 길잡이 카드가 가려진 동안(두목전)엔 자리를 잴 수 없다 — 다시 보일 때 맞춘다
  const same = UNLOCKS.filter((u) => u.lv === next.lv), prev = n ? UNLOCKS[n - 1].lv : 1;
  nx.dataset.k = k; nx.dataset.go = next.key;
  nx.innerHTML = `<span class="nxt"><em>다음</em>${esc(next.short)}${same.length > 1 ? ` 외 ${same.length - 1}` : ''} · Lv ${next.lv} <small>(지금 Lv ${L})</small></span><i class="nxb"><i style="width:${Math.max(0, Math.min(1, (L - prev) / Math.max(1, next.lv - prev))) * 100}%"></i></i>`;
  nx.title = `${same.map((u) => u.name).join(' · ')} — Lv ${next.lv}에 열려요`;
  const qc = $('qc'), qh = qc.classList.contains('hidden'); nx.style.top = qh ? '' : `${qc.offsetTop + qc.offsetHeight + 5}px`;   // 길잡이 카드 바로 아래(카드가 두 줄 · 세 줄이어도)
  $('dpsm').style.top = qh ? '' : `${qc.offsetTop + qc.offsetHeight + 5 + nx.offsetHeight + 7}px`;   // 피해 측정기도 따라 내린다(길잡이 카드가 두 줄이면 칩과 겹쳤다)
}
// 받을 보상 칸 — 여러 창에 흩어진 「받기」를 들판에서 한눈에(두목전 · 던전엔 숨김). 은자는 쓰지 않고 뽑지도 않는다
function rcList() {
  return [
    ['일일 임무', g.books.daily.claimable().length, 'mission:1'],
    ['주간 임무', g.books.weekly.claimable().length, 'mission:2'],
    ['업적', g.books.ach.claimable().length, 'ach:0'],
    ['현상수배', g.bountyCan(), 'bounty:0'],
    ['강호 패스', g.passCan(), 'pass:0'],
    ['무한 탑 이정표', g.towerMsCan(), 'content:1'],
    ['상점 덤', g.shopFreeCan() ? 1 : 0, 'shop:0'],
    ['하루 상자', g.todayChest().can ? 1 : 0, 'today:0'],
  ].filter((x) => x[1] > 0);
}
let rcAt = 0;
function paintRc(force) {
  const el = $('rc'), t = Date.now();
  if (!force && t - rcAt < 1000) return; rcAt = t;   // 1초에 한 번만 센다
  const n = g.bossFight || g.dg ? 0 : rcList().reduce((a, x) => a + x[1], 0);
  el.classList.toggle('hidden', n <= 0);
  if (el.dataset.n !== String(n)) { el.dataset.n = String(n); $('rc-n').textContent = n > 99 ? '99+' : String(n); }
}
function rcClaimAll() {
  const w0 = { ...g.S.wallet }; let n = 0;
  for (let pass = 0; pass < 2; pass++) {   // 받은 것이 다른 임무를 채울 수 있어 한 번 더
    for (const b of ['daily', 'weekly', 'ach']) for (const id of g.books[b].claimable()) if (g.claimMission(b, id)) n++;
    n += g.passClaimAll().length;
    const bl = g.bountyState().list.length; for (let i = 0; i < bl; i++) if (g.bountyClaim(i)) n++;
    if (g.bountyChest()) n++;
    n += g.towerMsClaimAll().length;
    if (g.shopFreeCan() && g.shopBuy(SHOP_FREE)) n++;   // 덤만 — 은자로는 사지 않는다
    if (g.todayChest().can && g.claimToday()) n++;
  }
  if (n) { play('coin'); const t = msGot(w0, g.S.wallet); toast(`보상 ${n}개 받음${t ? ` — ${t}` : ''}`); } else toast('받을 보상이 없어요');
  save(); paintHud(); paintRc(true); paintWin(); return n;
}
function rcPop() {
  const L = rcList();
  if (!L.length) { paintRc(true); toast('받을 보상이 없어요'); return; }
  pop('받을 보상', `<div class="rc-l">${L.map(([k, n, key]) => `<div class="rc-r"><span>${esc(k)}</span><b>${n}</b><button class="btn" data-go="${key}">가기</button></div>`).join('')}</div>`, [['닫기', null], ['모두 받기', rcClaimAll]]);
  for (const b of $('modal').querySelectorAll('.rc-r .btn')) b.onclick = () => { closeModal(); openKey(b.dataset.go); };
}
function paintHud() {
  const S = g.S, H = S.hero, F = g.ensureFight(), T = g.stage(), z = zoneFor(g.zoneLv());
  if (!$('qc').onclick) {
    $('qc').onclick = onGuide;
    $('fc').onclick = () => { if (g.fateState().ready > 0) fatePop(); else { const f = g.fateState(); toast(`기연 — 몹을 ${f.need - f.g}마리 더 잡으면 찾아와요`); } };
    $('nx').onclick = () => { if ($('nx').dataset.go) openKey($('nx').dataset.go); };
    $('rc').onclick = () => { play('click'); rcPop(); };
    $('dg-leave').onclick = () => { play('click'); if (g.dg && confirm('던전에서 나갈까요? 입장권은 돌려받지 못해요.')) g.leaveDungeon(); };
    $('btn-boss').onclick = () => { play('click'); if (g.challenge()) toast('칸 두목 도전!'); else toast(`몹을 ${STAGE_KILLS}마리 잡으면 도전할 수 있어요`); };
    $('b-opt').onclick = () => { play('click'); openWin('opt', 0); };
    $('b-saver').onclick = (e) => { e.stopPropagation(); play('click'); setTimeout(() => saverStart(), 120); };   // v587 절전 단추(누른 손이 바로 깨우지 않게 조금 뒤)
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
  { const up = lastLv && H.lv > lastLv; lastLv = H.lv; if (up) { levelUpFx(H.lv); if (open && keyOf() === 'hero:0') paintWin(); } }   // 스탯 칸을 연 채 레벨이 오르면 남은 점수 · 단추를 바로 맞춘다
  $('xp-txt').textContent = `EXP ${xp.toFixed(2)}%`; $('xp-fill').style.width = `${xp}%`;
  $('hb-xp-txt').textContent = `${xp.toFixed(2)}%`; $('hb-xp-fill').style.width = `${xp}%`;   // v624 Lv · HP 상자 안 EXP 줄
  $('g-gold').textContent = unit(S.wallet.gold); $('g-tix').textContent = S.wallet['ticket:gear'] || 0;
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
  $('hp-fill').style.width = `${hpR * 100}%`; $('hp-fill').parentNode.classList.toggle('low', hpR > 0 && hpR < 0.3);   // 흰 줄(#hp-trail)은 heroBarFx가 그린다
  document.documentElement.classList.toggle('hb-low', opt.gfx === 'low');
  $('hp-txt').textContent = `HP ${unit(Math.max(0, Hh.hp))} / ${unit(Hh.st.hp)}`;
  // 들판: 전투력 · 길잡이 · 칸 진행(두목전이면 두목 체력 · 남은 시간) · 두목 도전
  { const pw = g.power(); $('pw').textContent = unit(pw); pwWatch(pw); }   // v534 전투력이 바뀌면 튀어 오름
  const cur = guideCurrent(S.q.guide), cs = cur && S.q.guide[cur.id], qb = $('qc');
  // v584 길잡이를 다 끝내면 같은 칸에 「오늘 할 일」 다음 것(또는 하루 상자) — 누르면 그 창
  const td = cur ? null : todayNext();
  qb.classList.toggle('hidden', !cur && !td);
  if (!cur && td) { qb.classList.toggle('ready', !!td.ready); const qk = `td:${td.key}`; if (qb.dataset.k !== qk) { qb.dataset.k = qk; qb.innerHTML = `<div class="qh"><em>${td.ready ? '받기' : '오늘'}</em>오늘 할 일</div><div class="qb">${esc(td.label)}<small>${esc(td.sub)}</small></div>`; } }
  if (cur) { qb.classList.toggle('ready', !!cs?.done); const qk = `${cur.id}:${cs?.p || 0}:${cs?.done ? 1 : 0}`; if (qb.dataset.k !== qk) { qb.dataset.k = qk; qb.innerHTML = `<div class="qh"><em>${cs?.done ? '완료' : '진행'}</em>길잡이 ${cur.id.slice(1)}</div><div class="qb">${esc(guideLabel(cur))}<small>${cs?.done ? '받기 ▶' : `${cs?.p || 0}/${cur.need}`}</small></div>`; } }   // 왼쪽 길잡이 카드: 상태 · 할 일 · 진행
  { const f = g.fateState(), fb = $('fc'), fk = f.ready > 0 ? `r${f.ready}` : `${Math.floor((f.g / f.need) * 100)}`;   // 기연 칸
    fb.classList.remove('hidden'); fb.classList.toggle('ready', f.ready > 0); fb.classList.toggle('fate-solo', !cur && !td);
    if (fb.dataset.k !== fk) { fb.dataset.k = fk; $('fc-n').textContent = f.ready > 0 ? (f.ready > 1 ? `고르기 ${f.ready}` : '고르기') : `${fk}%`; $('fc-fill').style.width = `${f.ready > 0 ? 100 : fk}%`; } }
  paintRc();
  paintUnlock();
  const ready = !boss && !dgs && g.canChallenge();
  $('btn-boss').classList.toggle('hidden', !ready); $('btn-boss').classList.toggle('ready', ready);
  const ch2 = $('contest-hud');
  document.body.classList.toggle('indg', !!dgs);
  ch2.classList.toggle('hidden', !boss && !dgs); if (!boss) ch2.classList.remove('chb'); document.body.classList.toggle('bossing', boss || !!dgs); ch2.classList.toggle('dg', !!dgs); $('dg-leave').classList.toggle('hidden', !dgs);   // 두목전엔 길잡이 카드를 숨겨 두목 막대에 눈이 가게   // 두목전일 때만(평소 진행은 위 가운데 막대)
  wbHud(dgs?.type === 'wboss');
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
      b.onpointerdown = (e) => { e.preventDefault(); if (!(g.ensureFight().hero.kit || [])[i]) { const lt = +b.dataset.lt; if (!b.classList.contains('locked')) openKey('hero:1'); else if (g.S.hero.lv < JOB_LV[lt]) toast(`${lt}차 전직(Lv ${JOB_LV[lt]})을 하면 열려요 · 지금 Lv ${g.S.hero.lv}`); else { toast(`${lt}차 전직 던전을 깨면 열려요`); openKey('hero:3'); } return; } g.ensureFight().press({ slot: i }); };   // 빈 칸은 무공 창으로 · 잠긴 칸은 언제 열리는지 알림(레벨이 됐으면 전직 창으로)
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
    const ltTxt = lt == null ? '' : H.lv < JOB_LV[lt] ? `Lv ${JOB_LV[lt]}` : "전직";   // 언제 열리는지: 레벨이 모자라면 그 레벨 · 됐으면 전직
    if (lt != null) b.dataset.lt = lt; else delete b.dataset.lt;
    const name = sk ? sk.name.slice(0, 2) : lt != null ? `L${lt}:${ltTxt}` : '+';
    b.classList.toggle('empty', !sk); b.title = sk ? sk.name : lt != null ? `${lt}차 전직(Lv ${JOB_LV[lt]})에 열려요` : '무공 끼우기';
    if (b.dataset.n !== name) { b.dataset.n = name; b.innerHTML = lt != null ? `<svg class="ic lk" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="lt">${ltTxt}</span>` : `<span class="nm" style="color:${sk ? sk.col : ''}">${name}</span><span class="t">${sk ? 'ⅠⅡⅢⅣⅤⅥ'[sk.tier] || '' : ''}</span>${sk && k.auto ? '<i class="ad"></i>' : ''}`; }
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
// v584 오늘 할 일 다음 것 — 열렸고 덜 한 것 중 첫째 · 다 했으면 하루 상자 · 그것도 받았으면 없음
function todayNext() {
  if (!g) return null;
  const TC = g.todayChest();
  if (TC.can) return { key: 'chest', label: '하루 상자 열기', sub: '다 했어요 — 받기 ▶', go: 'today:0', ready: true };
  const x = g.today().find((t) => t.open && !t.done);
  return x ? { key: `${x.id}:${x.n}`, label: x.name, sub: x.of ? `${x.n}/${x.of} ▶` : `받을 것 ${x.n} ▶`, go: x.go } : null;
}
function onGuide() {
  const cur = guideCurrent(g.S.q.guide), cs = cur && g.S.q.guide[cur.id];
  if (!cur) { const td = todayNext(); if (td) { play('click'); openKey(td.go); } return; }
  if (cs?.done) { const g0 = g.S.wallet.gold, r = g.claimGuide(); if (r) { const dg = g.S.wallet.gold - g0; toast(`길잡이 ${r.id.slice(1)} 보상${dg > 0 ? ` · 은자 +${unit(dg)}` : ''}${r.items ? ' · 물건' : ''}`); play('loot'); coinFly($('qc'), $('g-gold'), 8); } save(); paintHud(); }
  else if (cur.go === 'fate' && g.fateState().ready > 0) { play('click'); fatePop(); }   // 기연 — 카드가 있으면 바로 고르기(없으면 사냥 칸으로)
  else if (cur.go) openKey(goKey(cur.go));
}
const goKey = (go) => ({ gear: 'gear:0', gacha: 'gear:1', skill: 'hero:1', slot: 'gear:2', job: 'hero:3', pal: 'grow:1', weapon: 'grow:0', relic: 'grow:2', daily: 'content:0', realm: 'grow:3', hunt: 'content:3', stat: 'hero:0', fate: 'content:3', shop: 'shop:0', shard: 'gear:3', party: 'party:0', pass: 'pass:0', coll: 'grow:0' }[go] || 'mission:0');

// ── 옆보기 사냥 화면 ──
const cv = $('cv'), cx = cv.getContext('2d');
const floats = [];
const mobHit = new Map();   // 몹 id → 맞은 때(번쩍 · 밀림)
// v600 타격감 1 — 치명타 임팩트: 맞는 자리에 충격 고리 + 튀는 불티, 몹이 더 크게 밀리고 눌림, 짧은 흔들림 · 진동. 두목전 · 던전에선 0.03초 멈칫(사냥터는 사냥 속도가 줄지 않게 멈칫 없음)
const mobCrit = new Map();   // 몹 id → 치명타 맞은 때
const impacts = [];          // { x, y, at, crit, dir }
let lastCritStop = 0;
// 두목 타격 — 체력 줄 떨림 · 테두리 번쩍 · 고비(75/50/25%) · 무력화/약점 터짐 · 마지막 일격. 전부 그리기만(엔진은 그대로)
const bossFeel = { F: null, r: 1, trail: 1, hold: 0, dom: false, shakeAt: -1e9, amp: 0, flashAt: -1e9, msAt: -1e9, popAt: -1e9, stFlashAt: -1e9, burstAt: -1e9, whiteAt: -1e9, kill: null, lastR: null, lastF: null };
const BOSS_MS = [0.75, 0.5, 0.25];
// 두목 체력 막대(위 가운데 · DOM) — 깎인 몫은 흰 줄로 0.25초 머물다 금빛으로 줄어들고, 맞을 때마다 0.12초 떨린다
// v624 무인 체력 막대 — 깎인 몫은 흰 줄로 0.4초 머물다 줄어든다(두목 막대와 같은 느낌), 차오르면 바로 맞춘다
const heroFeel = { r: 1, trail: 1, hold: 0, F: null };
function heroBarFx(t, fdt, F) {
  const hf = heroFeel, H = F && F.hero; if (!H) return;
  const r = Math.max(0, Math.min(1, H.hp / H.st.hp));
  if (hf.F !== F || r >= hf.trail) { hf.F = F; hf.trail = r; }
  else if (r < hf.r - 1e-9 && hf.trail - hf.r < 0.004) hf.hold = t + 400;
  if (t >= hf.hold && hf.trail > r) hf.trail = Math.max(r, hf.trail - Math.max(0.004, (hf.trail - r) * 0.008 * fdt));
  hf.r = r; $('hp-trail').style.width = `${hf.trail * 100}%`;
}
function bossBarFx(t, fdt) {
  const bf = bossFeel, B = g.bossFight, bm = B && B.mobs.find((m) => m.kind === 'boss'), bar = $('contest-bar'), tr = $('contest-trail'), pop = $('contest-pop');
  if (!bm || opt.gfx === 'low') { if (bf.dom) { bf.dom = false; bf.F = null; bar.style.transform = ''; bar.className = ''; tr.style.width = '0'; pop.classList.remove('on'); } return; }
  const r = Math.max(0, bm.hp / bm.st.hp);
  if (bf.F !== B) { bf.F = B; bf.r = r; bf.trail = r; bf.hold = 0; }
  if (!bf.dom) { bf.dom = true; bar.classList.add('bf'); }
  if (r < bf.r - 1e-9 && t >= bf.hold && bf.trail - bf.r < 0.004) bf.hold = t + 250;   // 새 덩어리가 깎이면 잠깐 머문다(이미 줄어드는 중이면 그대로 이어서)
  bf.r = r; if (bf.trail < r) bf.trail = r;
  if (t >= bf.hold && bf.trail > r) bf.trail = Math.max(r, bf.trail - Math.max(0.0002, (bf.trail - r) * 0.008) * fdt);
  const cb = bm.cb, bars = cb ? CB.bars : 1, cur = Math.max(1, Math.ceil(r * bars - 1e-9)), part = (v) => Math.max(0, Math.min(1, v * bars - (cur - 1)));
  $('contest-fill').style.width = `${part(r) * 100}%`; tr.style.width = `${part(bf.trail) * 100}%`;
  bar.classList.toggle('go', t >= bf.hold); bar.classList.toggle('nt', !cb);
  const sa = t - bf.shakeAt, q = sa >= 0 && sa < 120 && opt.shake ? bf.amp * (1 - sa / 120) : 0;
  bar.style.transform = q ? `translate(${(Math.sin(sa * 0.16) * q).toFixed(1)}px,${(Math.cos(sa * 0.21) * q * 0.5).toFixed(1)}px)` : '';
  const fa = t - bf.flashAt; bar.classList.toggle('hitf', fa >= 0 && fa < 150);
  const pa = t - bf.popAt, on = pa >= 0 && pa < 420; if (pop.classList.contains('on') !== on) { pop.classList.toggle('on', on); if (on) pop.style.left = `${part(r) * 100}%`; }
}
// 화면 전체 번쩍 · 가장자리 번쩍 · 마지막 일격 파편(화면 자리 — 싸움이 끝나 맵이 바뀌어도 그 자리에 남는다)
function drawBossFeel(cx, W, Hh, k, t) {
  const bf = bossFeel; if (opt.gfx === 'low') { bf.kill = null; return; }
  const ma = (t - bf.msAt) / 260;
  if (ma >= 0 && ma < 1) { const v = cx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.3, W / 2, Hh / 2, Math.max(W, Hh) * 0.58); v.addColorStop(0, 'rgba(255,236,170,0)'); v.addColorStop(1, `rgba(255,236,170,${0.9 * (1 - ma) * (1 - ma)})`); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = v; cx.fillRect(0, 0, W, Hh); cx.restore(); }
  const sa = (t - bf.stFlashAt) / 120;
  if (sa >= 0 && sa < 1) { cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = `rgba(255,240,196,${0.8 * (1 - sa)})`; cx.fillRect(0, 0, W, Hh); cx.restore(); }
  const K = bf.kill;
  if (K) {
    const a = (t - K.at) / 900;
    if (a >= 1) bf.kill = null;
    else if (a >= 0) {
      const e = 1 - Math.pow(1 - a, 3);
      cx.save(); cx.translate(K.x, K.y); cx.globalCompositeOperation = 'lighter';
      // 충격 고리 — 바닥에 납작하게 두 겹 + 몸통 높이에서 둥글게 한 겹
      for (let j = 0; j < 3; j++) { const aj = Math.min(1, a * (1.5 - j * 0.25)); if (aj >= 1) continue; const ej = 1 - (1 - aj) * (1 - aj); cx.globalAlpha = (1 - aj) * (j ? 0.6 : 0.95); cx.strokeStyle = j === 1 ? '#ffd56a' : '#fff6dc'; cx.lineWidth = (1 - aj) * (j ? 5 : 9) * k + 0.5; cx.beginPath(); if (j === 2) cx.arc(0, -34 * k, (24 + ej * 150) * k, 0, 7); else cx.ellipse(0, 0, (30 + ej * (j ? 230 : 170)) * k, (10 + ej * (j ? 62 : 46)) * k, 0, 0, 7); cx.stroke(); }
      if (a < 0.22) { const c = 1 - a / 0.22, gr = cx.createRadialGradient(0, -34 * k, 0, 0, -34 * k, 120 * k); gr.addColorStop(0, `rgba(255,255,255,${c})`); gr.addColorStop(1, 'rgba(255,230,160,0)'); cx.globalAlpha = 1; cx.fillStyle = gr; cx.fillRect(-130 * k, -164 * k, 260 * k, 260 * k); }
      // 빛줄기
      if (a < 0.6) { cx.lineCap = 'round'; cx.strokeStyle = '#fff3c4'; cx.lineWidth = 2.5 * k; cx.globalAlpha = (1 - a / 0.6) * 0.8;
        for (let j = 0; j < 14; j++) { const ang = (j / 14) * Math.PI * 2 + (K.seed % 7) * 0.3, r1 = (20 + e * (120 + (j * 37 % 60))) * k, r0 = r1 - (1 - a) * 46 * k; cx.beginPath(); cx.moveTo(Math.cos(ang) * r0, -34 * k + Math.sin(ang) * r0 * 0.7); cx.lineTo(Math.cos(ang) * r1, -34 * k + Math.sin(ang) * r1 * 0.7); cx.stroke(); } }
      // 파편 — 사방으로 튀어 올랐다 떨어진다(어두운 조각 · 금빛 조각)
      cx.globalCompositeOperation = 'source-over';
      for (let j = 0; j < 26; j++) {
        const s1 = ((K.seed + j * 61) % 97) / 97, s2 = ((K.seed * 3 + j * 29) % 89) / 89, ang = -Math.PI * (0.08 + 0.84 * s1), sp = (150 + s2 * 230) * k, tt = a * 0.9;
        const px = Math.cos(ang) * sp * tt * 1.5, py = -30 * k + Math.sin(ang) * sp * tt * 1.9 + 560 * k * tt * tt, sz = (6 + ((j * 13) % 8)) * k * (1 - a * 0.4), sh = sz * (0.6 + s2 * 0.6);
        cx.save(); cx.globalAlpha = a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3; cx.translate(px, Math.min(py, 6 * k)); cx.rotate(a * (6 + j % 5) * (j % 2 ? 1 : -1)); cx.fillStyle = j % 3 === 0 ? '#ffd56a' : j % 3 === 1 ? '#3a2c26' : '#6b5546'; cx.fillRect(-sz / 2, -sh / 2, sz, sh); if (j % 3) { cx.strokeStyle = '#0008'; cx.lineWidth = 1; cx.strokeRect(-sz / 2, -sh / 2, sz, sh); } cx.restore();
      }
      cx.restore();
    }
  }
  const wa = (t - bf.whiteAt) / 80;
  if (wa >= 0 && wa < 1) { cx.fillStyle = `rgba(255,255,255,${wa < 0.4 ? 1 : 1 - (wa - 0.4) / 0.6})`; cx.fillRect(0, 0, W, Hh); }
}
function drawImpacts(cx, P, k, t, list = impacts) {   // list — 대결 화면은 제 것으로
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i], a = (t - it.at) / (it.crit ? 260 : 170); if (a < 0) continue; if (a >= 1) { list.splice(i, 1); continue; }
    const [x, y] = P(it.x, it.y), e = 1 - (1 - a) * (1 - a);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.translate(x, y);
    if (it.crit) {
      // 충격 고리(납작한 타원 두 겹) + 가운데 번쩍
      cx.globalAlpha = (1 - a) * 0.9; cx.strokeStyle = '#fff3c4'; cx.lineWidth = (1 - a) * 5 * k + 0.5;
      cx.beginPath(); cx.ellipse(0, 0, (10 + e * 34) * k, (7 + e * 22) * k, 0, 0, 7); cx.stroke();
      cx.globalAlpha = (1 - a) * 0.5; cx.lineWidth = (1 - a) * 2.5 * k + 0.5; cx.beginPath(); cx.ellipse(0, 0, (6 + e * 50) * k, (4 + e * 30) * k, 0, 0, 7); cx.stroke();
      if (a < 0.35) { cx.globalAlpha = (1 - a / 0.35) * 0.85; cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(0, 0, (16 - a * 20) * k, 0, 7); cx.fill(); }
    }
    // 불티 — 맞은 쪽으로 쏠려 튄다(치명 9 · 보통 4)
    const n = it.crit ? 9 : 4; cx.strokeStyle = it.crit ? '#ffe28a' : '#fff6d8'; cx.lineCap = 'round';
    for (let j = 0; j < n; j++) {
      const sd = (it.seed + j * 37) % 100 / 100, ang = (it.dir > 0 ? 0 : Math.PI) + (sd - 0.5) * (it.crit ? 2.6 : 1.8) - 0.25, sp = (it.crit ? 46 : 26) * (0.55 + ((it.seed * 7 + j * 53) % 100) / 220) * k;
      const r0 = e * sp, r1 = Math.max(0, r0 - (1 - a) * (it.crit ? 12 : 7) * k), gy = a * a * 10 * k;
      cx.globalAlpha = (1 - a) * (it.crit ? 0.95 : 0.7); cx.lineWidth = (it.crit ? 2.4 : 1.6) * k * (1 - a * 0.6);
      cx.beginPath(); cx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1 + gy); cx.lineTo(Math.cos(ang) * r0, Math.sin(ang) * r0 + gy); cx.stroke();
    }
    cx.restore();
  }
}
let freezeUntil = 0;       // 큰 무공 적중 멈칫
// 타격감 2 — 막타 · 무공 임팩트(그리기만 · 엔진 시간은 건드리지 않는다 · 그래픽 낮음이면 모두 끔)
const debris = [];           // 막타 파편 { x, y, vx, vy, at, sz, rot, vr, col, b(튄 횟수), gy(땅 높이) } — 최대 60
const shocks = [];           // 땅 충격 고리 { x, y, at, R(px), dur, col } — 최대 12
const mobSk = new Map();     // 몹 id → [무공에 맞은 때, 차수](더 멀리 밀림)
const DEBRIS_COL = { mob: ['#2b2520', '#efe6d0', '#8a7f70'], elite: ['#2b2520', '#e9d5ff', '#c4a1ff'], boss: ['#2b2520', '#fde68a', '#f59e0b'] };
let punch = { at: -1e9, amp: 0, dur: 160 };   // 무공 당김(차수 1~5 → 2~6%) — 예전 4 · 5차 당김(zoomAt)을 이것 하나로
let vigAt = -1e9, vigLv = 0, vigGr = null, vigKey = '';   // 연속 처치 가장자리 금빛
let hurtGr = null, hurtKey = '';   // v614 칭호 오라 · 맞음 가장자리 그라디언트(한 번 만들어 다시 씀)
let ghostAt = -1e9, lastCastTier = 0;   // 3차 이상 무공 잔상
const punchNow = (t) => { const p = (t - punch.at) / punch.dur; return p < 0 || p >= 1 ? 0 : punch.amp * (p < 0.2 ? p / 0.2 : (1 - (p - 0.2) / 0.8) ** 2); };
function spawnDebris(m, dir, t) {
  const n = m.kind === 'boss' ? 16 : m.kind === 'elite' ? 12 : 7, cols = DEBRIS_COL[m.kind] || DEBRIS_COL.mob, big = m.kind === 'mob' ? 1 : 1.35;
  for (let j = 0; j < n && debris.length < 60; j++) {
    const tq = Math.floor(t % 1000), r1 = ((m.id * 37 + j * 61 + tq) % 97) / 97, r2 = ((m.id * 13 + j * 29 + tq * 3) % 89) / 89;
    debris.push({ x: m.x + (r2 - 0.5) * 300, y: m.y + 350 + r1 * 700, gy: m.y, vx: dir * (1200 + r1 * 2800) * big + (r2 - 0.5) * 1400, vy: (3400 + r2 * 4600) * big, at: t, sz: (2.8 + r1 * 3.2) * big, rot: r1 * 6.3, vr: (r2 - 0.5) * 26, col: cols[j % cols.length], b: 0 });
  }
}
function drawDebris(cx, P, k, t, dt) {
  const h = dt / 1000;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i], a = (t - d.at) / 680; if (a >= 1) { debris.splice(i, 1); continue; } if (a < 0) continue;
    if (d.b < 2) {
      d.x += d.vx * h; d.y += d.vy * h; d.vy -= 30000 * h; d.rot += d.vr * h;
      if (d.y <= d.gy && d.vy < 0) { d.y = d.gy; d.b++; if (d.b === 1) { d.vy = -d.vy * 0.42; d.vx *= 0.55; d.vr *= 0.5; } else { d.vy = 0; d.vx = 0; } }   // 땅에 한 번 튀고 눕는다
    }
    const [x, y] = P(d.x, d.y), r = d.sz * k;
    cx.globalAlpha = a < 0.55 ? 1 : 1 - (a - 0.55) / 0.45; cx.fillStyle = d.col;
    const c = Math.cos(d.rot) * r, s2 = Math.sin(d.rot) * r;
    cx.beginPath(); cx.moveTo(x + c, y - 1.5 * k + s2); cx.lineTo(x - s2 * 0.6, y - 1.5 * k + c * 0.6); cx.lineTo(x - c * 0.8, y - 1.5 * k - s2 * 0.8); cx.fill();
  }
  cx.globalAlpha = 1;
}
function drawShocks(cx, P, k, t) {
  for (let i = shocks.length - 1; i >= 0; i--) {
    const q = shocks[i], a = (t - q.at) / q.dur; if (a >= 1) { shocks.splice(i, 1); continue; } if (a < 0) continue;
    const [x, y] = P(q.x, q.y), e = 1 - (1 - a) ** 3, R = q.R * k * (0.25 + 0.75 * e);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = q.col;
    cx.globalAlpha = (1 - a) * 0.8; cx.lineWidth = (1 - a) * 4 * k + 0.6; cx.beginPath(); cx.ellipse(x, y, R, R * 0.24, 0, 0, 7); cx.stroke();
    cx.globalAlpha = (1 - a) * 0.35; cx.lineWidth = (1 - a) * 9 * k + 0.6; cx.beginPath(); cx.ellipse(x, y, R * 0.7, R * 0.17, 0, 0, 7); cx.stroke();
    cx.restore();
  }
}
let slowUntil = 0;         // v532 느린 화면
// v578 절전
const SAVER_MS = 120000, SAVER_TICK = 250;
const agSum = { claim: 0, pull: 0, kit: 0, enh: 0, daily: 0 };   // v588 자동 성장 합(절전 화면에)
let lastInput = Date.now(), saverOn = false, saverFrame = 0, saverFrom = null, saverForce = false, saverAuto = false;   // saverAuto: 시험에서 진짜 손전화처럼 저절로 켜지기를 살림   // 자동 시험(webdriver)에서는 저절로 켜지지 않게(시험이 부를 때만)
const wake = () => { lastInput = Date.now(); if (saverOn) saverOff(); };   // v587 고침: 프레임 시각(now = Date.now)과 같은 시계로 — 전엔 performance.now라 깨우자마자 「2분 지남」으로 다시 절전
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, wake, { capture: true, passive: true });
function saverTick(t) {
  if (!g) return;
  if (!saverOn && opt.saver && (!navigator.webdriver || saverForce || saverAuto) && t - lastInput > SAVER_MS && !open && $('modal').classList.contains('hidden') && !g.bossFight && !g.dg) saverStart(t);
  if (saverOn && t - (saverTick.mv || 0) >= 20000) { saverTick.mv = t; const d = document.querySelector('#saver > div'); if (d) d.style.transform = `translate(${Math.round(Math.sin(t / 37000) * 60)}px, ${Math.round(Math.cos(t / 29000) * 80)}px)`; }   // v586 글자가 천천히 옮겨 다님(화면 자국)
  if (saverOn && t - (saverTick.at || 0) >= 1000) { saverTick.at = t; const sp = document.querySelector('#saver span'); if (sp) { const m = Math.floor((t - saverFrom.at) / 60000); sp.innerHTML = `Lv ${g.S.hero.lv}${g.S.hero.lv > saverFrom.lv ? ` (+${g.S.hero.lv - saverFrom.lv})` : ''} · 처치 +${unit((g.S.kills || 0) - saverFrom.kills)} · 은자 +${unit(Math.max(0, (g.S.wallet.gold || 0) - saverFrom.gold))}<br><small>${m}분째 홀로 사냥 중${opt.autoGrow && (agSum.pull || agSum.enh || agSum.kit || agSum.claim) ? ` · 자동 성장 — 뽑기 ${agSum.pull} · 강화 +${agSum.enh} · 무공 +${agSum.kit} · 보상 ${agSum.claim} · 하루 일 ${agSum.daily}` : ''}</small>`; } }
}
// v587 절전 들어가기 — 저절로(2분) 또는 위 「절전」 단추. 사냥 · 두목 도전 · 레벨업 · 은자는 그대로(엔진은 계속), 화면만 덜 쓴다
function saverStart(t = now()) {
  if (saverOn || !g) return;
  if (open) closeWin(); if (!$('modal').classList.contains('hidden')) closeModal();
  saverOn = true; saverFrom = { kills: g.S.kills || 0, gold: g.S.wallet.gold || 0, lv: g.S.hero.lv, exp: g.S.hero.exp, at: t, ag: { ...agSum } };
  const o = document.createElement('div'); o.id = 'saver'; o.innerHTML = `<div><b>절전 중</b><span>홀로 사냥하는 중…</span><em>누르면 돌아와요${opt.wake && wakeOK() ? ' · 화면은 켜 둔 채 홀로 사냥' : ''}</em></div>`; document.body.append(o);
  save();
}
// v590 절전에서 돌아오면 그동안 얻은 것을 한 줄로(1분 넘게 쉬었을 때) — 알림 + 왼쪽 기록
let saverSum = '';
function saverOff() {
  const F = saverFrom, was = saverOn; saverOn = false; saverForce = false; document.querySelector('#saver')?.remove();
  if (was && F && g && now() - F.at >= 60000) {
    const m = Math.floor((now() - F.at) / 60000), dl = g.S.hero.lv - F.lv;
    saverSum = `절전 ${m}분 — ${[dl > 0 && `Lv +${dl}`, `처치 +${unit((g.S.kills || 0) - F.kills)}`, `은자 +${unit(Math.max(0, (g.S.wallet.gold || 0) - F.gold))}`].filter(Boolean).join(' · ')}`;
    addLog(saverSum);
    // 10분 넘게 절전했으면 작은 돌아옴 카드(아니면 알림 한 줄). 깨운 손가락이 카드 단추를 누르지 않게 조금 뒤에
    const ms = now() - F.at, rows = [['silver', '은자', Math.max(0, (g.S.wallet.gold || 0) - F.gold)], ['realm', '레벨', Math.max(0, dl)], ['atk', '처치', Math.max(0, (g.S.kills || 0) - F.kills)]], ag = agLine(F.ag);
    if (ms < 600000) toast(saverSum);
    else setTimeout(() => { if (!$('modal').classList.contains('hidden') || saverOn || open) { toast(saverSum); return; } retCard('절전 끝', { small: true, ms, sub: '동안 화면을 쉬며 사냥했어요', rows, ag }, [['확인', null]]); }, 350);
  }
}
// v586 화면 켜 두기(방치) — 손전화가 저절로 화면을 끄면 브라우저가 게임을 멈춘다 → 화면 꺼짐 막기(Screen Wake Lock).
//   화면이 보이는 동안만 잡고, 앱이 뒤로 가면 브라우저가 풀었다가 돌아오면 다시 잡는다. 못 쓰는 브라우저면 조용히(방치 보상은 그대로).
let wakeLock = null, wakeWant = false;
const wakeOK = () => typeof navigator !== 'undefined' && !!navigator.wakeLock;
async function wakeSync() {
  wakeWant = !!(opt.wake && g);
  try {
    if (wakeWant && !document.hidden && !wakeLock && wakeOK()) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    else if (!wakeWant && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }   // 배터리 절약 모드 · 권한 · 지원 안 함
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeSync(); });
addEventListener('pointerdown', () => { if (wakeWant && !wakeLock) wakeSync(); }, { passive: true });   // 일부 브라우저는 손댄 뒤에만 허락
let dashAt = -1e9, dashTrail = [], perfAt = -1e9;   // v546 회피 잔상 · 완벽 회피
// v564 연속 처치 — 2.5초 안에 이어 잡으면 콤보 · 오른쪽에 「N 연속」 · 10 · 30 · 50 · 100 · 200마다 큰 글자(능력치와 상관없는 연출)
const COMBO_MS = 2500, COMBO_MILES = [10, 30, 50, 100, 200, 500];
let combo = 0, comboAt = -1e9, comboBest = 0;
function comboHit(t) {
  combo = t - comboAt <= COMBO_MS ? combo + 1 : 1; comboAt = t; comboBest = Math.max(comboBest, combo);
  const el = $('combo'); if (!el) return;
  if (combo >= 3) { el.className = `on${combo >= 50 ? ' hot' : combo >= 10 ? ' warm' : ''}`; el.innerHTML = `<b>${combo}</b><span>연속 처치</span><i></i>`; el.style.setProperty('--cm', COMBO_MS + 'ms'); }
  if (combo === 30 || combo === 100 || combo === 300) g.comboMark(combo);   // v571 업적 · 최고 기록
  if (COMBO_MILES.includes(combo)) { chbBanner(`${combo} 연속!`, combo >= 100 ? '멈출 수 없다' : combo >= 50 ? '무아지경' : '기세가 오른다', combo >= 50 ? 'win' : 'stun'); play(combo >= 50 ? 'rare' : 'loot', 4); buzz(30); }
}
function comboTick(t) { const el = $('combo'); if (el && el.classList.contains('on') && t - comboAt > COMBO_MS) { el.className = ''; if (combo >= 10) { addLog(`${combo} 연속 처치`); if (combo > (g.S.comboBest || 0)) g.S.comboBest = combo; } combo = 0; } }
const pals = [];           // 화면 위 동료(무인 뒤를 따라감)
const JOB_COL = { sword: '#ffe9a8', spear: '#ffb27a', fist: '#ffd56a', bow: '#b6f0ff', mage: '#d4b8ff' };
const PAL_COL = ['#7dd3fc', '#86efac', '#fde68a', '#f9a8d4', '#c4b5fd'];
const rels = [];            // 화면 위 영물(무인 뒤를 따라감)
const palRing = [0, 1, 2, 3, 4].map(() => ({ on: false, x: 0, y: 0, q: 0 }));   // 동료 공격 빛 고리(몹 위에 나중에 그림)
const followerN = { pals: 0, relics: 0 };   // 시험용 — 이 프레임에 그린 수
for (const kk in RELIC_EXTRA) CREATURES[kk] ??= RELIC_EXTRA[kk];
const palLooks = [];
function palLook(kd) {   // 동료 번호 → 무인 모습(한 번 만들어 둔다)
  if (palLooks[kd]) return palLooks[kd];
  const d = PAL_FIELD[kd % PAL_FIELD.length], L = { robe: d.robe, band: d.band, head: d.head || 'topknot' };
  if (d.hair) L.hair = d.hair;
  if (!hasBodyArt(d.robe)) L.robeTint = d.robe;
  if (d.f) { L.female = true; L.fstyle = d.f; L.hairK = d.hk || 'black'; if (artReadyNow()) L.fhead = femaleHeadKey(d.f, L.hairK, d.band); else return L; }   // 그림이 오기 전엔 다시 만든다
  return (palLooks[kd] = L);
}
function followStep(p, wantX, wantY, fdt, face) {   // 고무줄처럼 붙지 않고 달리듯(최고 속도 · 서서히 섬) · 너무 멀면(장면이 바뀜) 바로 그 자리
  const dx = wantX - p.x;
  if (Math.abs(dx) > 6000) { p.x = wantX; p.y = wantY; p.v = 0; p.mv = false; p.face = face; return; }
  p.mv = Math.abs(dx) > 60; p.v += ((Math.abs(dx) > 120 ? Math.sign(dx) * 4800 : dx * 8) - p.v) * Math.min(1, fdt / 160); p.x += p.v * fdt / 1000; p.y += (wantY - p.y) * Math.min(1, fdt / 90);
  p.face = p.mv ? Math.sign(dx) : face;
}
const PAL_GAP = [650, 1060, 1470, 1880, 2290], PAL_BACK = [0, 150, 40, 190, 80];   // 동료 i: 무인 뒤 거리 · 살짝 뒤(높이) — 느슨한 활 모양
const REL_GAP = [900, 1750, 2600];
function drawFollowers(cx, F, H, k, sc, t, ts, fdt, W, SX, SY, lx, ly) {
  followerN.pals = 0; followerN.relics = 0;
  const low = opt.gfx === 'low', crowd = !!(g.bossFight || g.dg);   // 두목전 · 던전은 예고 범위가 넓어 둘 · 하나만
  const pe = g.S.colls?.pal?.eq || [], re = g.S.colls?.relic?.eq || [];
  const maxP = low || crowd ? 2 : 5, maxR = low || crowd ? 1 : 3, face = H.face || 1, hx0 = lx(H), hy0 = ly(H);
  // 영물 — 뒤 판(땅 위 조금 높이) · 나는 것은 공중에서 떠다님
  let nr = 0;
  for (let j = 0; j < re.length && nr < maxR; j++) {
    const kd = re[j]; if (kd === null || kd === undefined) continue;
    const R = RELIC_FIELD[kd % RELIC_FIELD.length], fly = R[2], wantX = hx0 - face * REL_GAP[nr], wantY = hy0 + (fly ? 1000 : 260);
    const p = (rels[nr] ??= { x: wantX, y: wantY, v: 0, mv: false, face, o: { t: 0, moving: false, flip: false, scale: 1 } });
    followStep(p, wantX, wantY, fdt, face);
    const px = SX(p.x); nr++;
    if (px < -90 || px > W + 90) continue;
    const bob = fly ? Math.sin(ts * 1.7 + j * 2) * 4 * k : p.mv ? -Math.abs(Math.sin(ts * 9 + j)) * 3 * k : 0;
    const o = p.o; o.t = ts + j * 1.3; o.moving = p.mv; o.flip = p.face < 0; o.scale = 0.95 * k * R[1];
    drawCreature(cx, R[0], px, SY(p.y) + bob, o); followerN.relics++;
  }
  rels.length = nr;
  // 동료 — 작은 무인(무인의 0.55) · 뒤에 선 것부터
  let np = 0;
  for (let i = 0; i < pe.length && np < maxP; i++) if (pe[i] !== null && pe[i] !== undefined) np++;
  pals.length = np;
  for (let pass = 0; pass < 2; pass++) {
    let n = 0;
    for (let i = 0; i < pe.length && n < np; i++) {
      const kd = pe[i]; if (kd === null || kd === undefined) continue;
      const slot = n++; if ((PAL_BACK[slot] > 100 ? 0 : 1) !== pass) continue;   // 뒤에 선 것(높이 큰 것) 먼저
      const wantX = hx0 - face * PAL_GAP[slot], wantY = hy0 + PAL_BACK[slot];
      const look = palLook(kd), d = PAL_FIELD[kd % PAL_FIELD.length];
      const p = (pals[slot] ??= { x: wantX, y: wantY, v: 0, mv: false, face, o: { t: 0, weapon: 'sword', run: false, flip: false, turn: null, lunge: 0, scale: 1, pose: null } });
      followStep(p, wantX, wantY, fdt, face);
      // 동료 공격: 표적 쪽으로 튀어 나갔다 돌아옴(0.35초) · 무기를 내지른다 · 표적에 빛 고리
      const pa = palAtk[slot]; let ox = 0, lunge = 0;
      if (pa && t - pa.at < 350) { const pt = F.mobs.find((m) => m.id === pa.mid);
        if (pt) { const q = (t - pa.at) / 350, lg = Math.sin(q * Math.PI), tx = lx(pt); ox = (tx - p.x) * 0.45 * lg; lunge = lg; p.face = Math.sign(tx - p.x) || p.face;
          if (!low) { const Rg = palRing[slot]; Rg.on = true; Rg.q = q; Rg.x = SX(tx); Rg.y = SY(ly(pt) + 700); } } }
      const px = SX(p.x + ox), py = SY(p.y);
      if (px < -60 || px > W + 60) continue;
      const o = p.o; o.t = ts + slot * 0.7; o.weapon = d.w; o.run = p.mv && !lunge; o.flip = p.face < 0; o.lunge = lunge; o.scale = 0.55 * sc;
      const hop = p.mv ? -Math.abs(Math.sin(ts * 9 + slot)) * 3 * k : 0;   // 따라 뛸 때 통통
      drawFighter(cx, px, py + hop, look, o); followerN.pals++;
      if (!low && t - lastCastAt < 300) { cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.4 * (1 - (t - lastCastAt) / 300); cx.fillStyle = '#ffe9a8'; cx.beginPath(); cx.arc(px, py - 26 * sc, 18 * sc, 0, 7); cx.fill(); cx.restore(); }
    }
  }
}
let lastCastAt = 0;
const palAtk = [];          // 동료 i → { at, mid } 마지막 공격
const tells = new Map();    // 두목 id → 예고 { pat, x, y, w, at, dur }
const dust = [];   // 발밑 흙먼지
const heroAnim = new PoseAnim();
let lastAtkPose = 0, lastFreeze = 0, stanceMix = 0, runMix = 0, heroHurtAt = -1e9, heroDownAt = -1e9;
// v507 싸우는 중 겨눔 자세(평타 사이에 차렷으로 서 있지 않게) — 직업마다 무기를 겨눈 채 낮게
const STANCE = {
  sword: { lean: 0.1, crouch: 0.24, lift: 0, dx: 0, hand: [1.15, 19], blade: -0.3, stretch: 0, alpha: 1, wscale: 1.15 },
  spear: { lean: 0.08, crouch: 0.22, lift: 0, dx: 0, hand: [0.45, 24], blade: -0.12, stretch: 0, alpha: 1, wscale: 1.1 },
  fist: { lean: 0.14, crouch: 0.32, lift: 0, dx: 0, hand: [-0.25, 20], blade: -0.6, stretch: 0, alpha: 1, wscale: 1.1 },
  bow: { lean: 0.04, crouch: 0.12, lift: 0, dx: 0, hand: [-0.08, 26], blade: 0, stretch: 0, alpha: 1, wscale: 1 },
  mage: { lean: 0.02, crouch: 0.1, lift: 0, dx: 0, hand: [-0.55, 22], blade: -1.0, stretch: 0, alpha: 1, wscale: 1 },
};
// 무인 공격 자세(지금 게임 자세 도감) — 평타는 짧게, 무공은 크게. 권사 평타는 정권 · 훅 · 올려치기를 번갈아
// v597 평타는 직업마다 두세 가지를 번갈아(검: 가로 긋기 · 올려 베기 · 내려 베기) — 예비 동작 → 한 번에 긋기 → 끝동작(조금 더 따라감)까지.
const WS = 1.7;
const COMBO = {
  sword: [
    [[0, '발도준비'], [0.07, '일섬', 'snap'], [0.17, { ...POSES.일섬, lean: 0.26, dx: 8, hand: [0.45, 25], blade: 0.5 }]],
    [[0, { lean: 0.18, crouch: 0.42, hand: [1.2, 22], blade: 1.3, wscale: WS }], [0.07, { lean: 0.2, crouch: 0.1, lift: 3, dx: 8, hand: [-1.0, 29], blade: -1.1, stretch: 0.05, wscale: WS }, 'snap'], [0.17, { lean: 0.1, crouch: 0.08, dx: 6, hand: [-1.35, 27], blade: -1.5, wscale: WS }]],
    [[0, '검거양'], [0.08, '내려베기', 'snap'], [0.18, { ...POSES.내려베기, crouch: 0.52, hand: [1.05, 25], blade: 1.2 }]],
  ],
  spear: [
    [[0, '찌르기준비'], [0.06, '찌르기', 'snap'], [0.16, { ...POSES.찌르기, lean: 0.32, dx: 12, hand: [0.0, 28] }]],
    [[0, { lean: -0.1, crouch: 0.3, dx: -4, hand: [-1.9, 24], blade: -1.2, wscale: WS }], [0.08, { lean: 0.36, crouch: 0.36, dx: 12, hand: [0.5, 30], blade: 0.35, stretch: 0.06, wscale: WS }, 'snap'], [0.18, { lean: 0.3, crouch: 0.4, dx: 10, hand: [0.8, 27], blade: 0.7, wscale: WS }]],
  ],
  fist: [
    [[0, { lean: -0.06, crouch: 0.3, dx: -3, hand: [2.2, 14], blade: 0, wscale: WS }], [0.05, '정권', 'snap'], [0.14, { ...POSES.정권, lean: 0.3, dx: 9, hand: [-0.05, 28] }]],
    [[0, { lean: 0.05, crouch: 0.28, hand: [-2.0, 18], blade: 0.6, wscale: WS }], [0.06, '훅', 'snap'], [0.15, { ...POSES.훅, lean: 0.3, hand: [0.2, 24] }]],
    [[0, { lean: 0.2, crouch: 0.5, hand: [1.3, 16], blade: -1.0, wscale: WS }], [0.06, '올려치기', 'snap'], [0.16, { ...POSES.올려치기, lift: 6, hand: [-1.45, 28] }]],
  ],
  bow: [
    [[0, '투척준비'], [0.08, '투척', 'snap'], [0.16, { lean: 0.1, crouch: 0.14, dx: 2, hand: [-0.5, 26], blade: -0.6, wscale: WS }]],
  ],
  mage: [
    [[0, '펼치기'], [0.08, '휘두르기', 'snap'], [0.17, { ...POSES.휘두르기, lean: 0.18, hand: [0.4, 28], blade: -0.1 }]],
    [[0, { lean: 0.1, crouch: 0.14, hand: [0.6, 26], blade: 0.3, wscale: WS }], [0.08, { lean: 0.2, crouch: 0.12, dx: 5, hand: [-0.9, 30], blade: -1.2, wscale: WS }, 'snap'], [0.17, { lean: 0.12, crouch: 0.1, dx: 4, hand: [-1.2, 28], blade: -1.45, wscale: WS }]],
  ],
};
// 무공(큰 동작): 크게 모았다가 → 한 번에 → 끝자세로 잠깐 버틴 뒤 거둔다
const BIG = {
  sword: [[0, '검거양'], [0.12, '내려베기', 'snap'], [0.26, { ...POSES.내려베기, crouch: 0.55, hand: [1.05, 25], blade: 1.2 }], [0.4, '납도']],
  spear: [[0, '찌르기준비'], [0.12, '찌르기', 'snap'], [0.28, { ...POSES.찌르기, lean: 0.34, dx: 13, hand: [0.0, 29] }]],
  fist: [[0, '마보'], [0.12, '쌍장', 'snap'], [0.28, { ...POSES.쌍장, lean: 0.24, dx: 8 }]],
  bow: [[0, '투척준비'], [0.14, '투척', 'snap'], [0.28, { lean: 0.1, crouch: 0.14, dx: 2, hand: [-0.5, 26], blade: -0.6, wscale: WS }]],
  mage: [[0, '펼치기'], [0.14, '장타', 'snap'], [0.3, { ...POSES.장타, lean: 0.26, dx: 9 }]],
};
// v599 평타 궤적 — 무기가 지나간 자리에 초승달 빛(검 · 창 휘두르기 · 권 훅/올려치기) 또는 곧은 줄기(찌르기 · 정권). [시작각, 끝각, 반지름] 또는 ['thrust', 길이]
const SWING = {
  sword: [[-1.15, 0.75, 44], [1.1, -1.25, 44], [-1.5, 1.0, 46]],
  spear: [['thrust', 70], [-1.3, 0.8, 56]],
  fist: [['thrust', 34], [-1.0, 0.7, 28], [1.2, -1.2, 30]],
};
let swing = null;
function drawSwing(cx, hx, hy, k, face, t) {
  if (!swing || opt.gfx === 'low') return;
  const p = (t - swing.at) / 150; if (p < 0) return; if (p >= 1) { swing = null; return; }
  const [a0, a1, R] = swing.a, head = Math.min(1, p / 0.4), tail = Math.max(0, (p - 0.3) / 0.7), al = (1 - p) * 0.85;
  cx.save(); cx.translate(hx, hy - 44 * k); cx.scale(face * k, k); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = al;
  if (a0 === 'thrust') {
    const L = a1, x0 = 14 + L * tail, x1 = 14 + L * head, gr = cx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(255,247,214,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    cx.fillStyle = gr; cx.beginPath(); cx.moveTo(x0, 0); cx.lineTo(x1 - 6, -3.2); cx.lineTo(x1, 0); cx.lineTo(x1 - 6, 3.2); cx.closePath(); cx.fill();
  } else {
    const s0 = a0 + (a1 - a0) * tail, s1 = a0 + (a1 - a0) * head, ccw = a1 < a0;
    const gr = cx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 1.04); gr.addColorStop(0, 'rgba(255,247,214,0)'); gr.addColorStop(0.75, 'rgba(255,250,225,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(4, 0, R * 1.04, s0, s1, ccw); cx.arc(4 + (ccw ? 0 : 0) + 5, 0, R * 0.74, s1, s0, !ccw); cx.closePath(); cx.fill();   // 안쪽 호를 조금 앞으로 밀어 끝이 가늘어지는 초승달
  }
  cx.restore();
}
function heroAttackPose(job, big) {
  if (big) { heroAnim.play(BIG[job] || BIG.sword, 0.26); return; }
  const C = COMBO[job] || COMBO.sword, vi = fistN++ % C.length;
  heroAnim.play(C[vi], 0.2);
  swing = SWING[job]?.[vi] ? { at: now() + 55, a: SWING[job][vi] } : null;   // 예비 동작 뒤에 긋는다
}
let lookDir = 1, lastPoseT = 0, fistN = 0;
const FIELD_ZOOM = 1.22; let fieldZoom = null;   // 낮은 가로 화면 사냥터 당겨 보기(1 = 그대로)
let lastFight = null, lastDraw = 0, lookAhead = 0, levelAt = -1e9, heroAirAt = 0, heroLandAt = -1e9, heroFace = 1, heroTurnFrom = 1, heroTurnAt = -1e9;
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
  const r = { width: cv.clientWidth, height: cv.clientHeight }, dpr = opt.gfx === 'low' ? 1 : Math.min(2, pxr());
  if (opt.gfx === 'low') { dust.length = 0; coins.length = 0; }
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const t = now(), KH = bossFeel.kill, held = !!(KH && KH.F && t - KH.at < 560);   // 두목 마지막 일격: 0.56초 동안은 끝난 두목전 장면을 그대로 둔다(바로 사냥터로 넘어가면 쓰러지는 모습 · 파편이 안 보인다) — 엔진은 그대로 다음 싸움을 돈다
  const F = held ? KH.F : g.ensureFight(); if (!F) return;
  const W = r.width, Hh = r.height, ts = t / 1000, map = F.def.map;
  const fdt = Math.min(100, Math.max(1, t - (lastDraw || t - 16))); lastDraw = t;
  const zLv = held && F.def.boss && !F.def.raid ? F.def.lv : g.zoneLv();   // 붙잡아 둔 두목전 장면은 그 칸의 배경 · 몹 그림으로(장 두목을 잡으면 칸이 먼저 다음 장으로 넘어가 있다)
  const z = zoneFor(zLv);
  // 가까이 당겨 본다: 화면 너비에 약 15미터 — 무인을 가로 · 세로로 따라감(맵은 화면보다 넓고 높다)
  // 세로 화면이면 아래 조작 받침(168px)을 빼고, 가로로 너무 당겨지지 않게 넓게 본다
  const port = Hh > W * 1.1, dock = port ? 150 : 0;   // 아래 창 단추 줄 · 무공 줄
  const s0 = port ? Math.max(W / 8500, (Hh - dock) / 13000) : Math.max(W / 15000, Hh / 9000);
  // 낮은 가로 화면(폰)에서는 사냥터를 더 당겨 본다 — 무인 · 몹 · 발판이 같은 비율로 커진다(거리는 그대로, 보이는 폭만 줄어듦).
  // 두목 · 던전은 예고 범위가 넓어 그대로 두고, 오갈 때는 0.3초쯤 걸쳐 부드럽게 바뀐다
  const zWant = !port && Hh < 450 && !g.bossFight && !g.dg ? FIELD_ZOOM : 1;
  if (fieldZoom === null) fieldZoom = zWant; else fieldZoom += (zWant - fieldZoom) * (1 - Math.exp(-fdt / 90));
  if (Math.abs(zWant - fieldZoom) < 0.002) fieldZoom = zWant;
  const s = s0 * fieldZoom, k = Math.min(1.25, Math.max(0.7, s0 / 0.05)) * fieldZoom;
  const viewW = W / s, viewH = Hh / s;
  const al = held ? 1 : Math.max(0, Math.min(1, acc / 50));
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
  // 차수가 높을수록 크게(1차 2% … 5차 6%) — 빠르게 당겼다(0.2) 느리게 풀린다. 0.16초(4 · 5차 0.24초)
  const zp = punchNow(t);
  if (opt.shake && zp > 0) { const [zx, zy] = P(lx(F.hero), ly(F.hero) + 900), zz = 1 + zp; cx.translate(zx, zy); cx.scale(zz, zz); cx.translate(-zx, -zy); }
  const ch = chapterOf(zLv); preloadChapter(ch); preloadMobs(ch);
  if (held) { const c2 = chapterOf(g.zoneLv()); if (c2 !== ch) { preloadChapter(c2); preloadMobs(c2); } }   // 넘어갈 장 그림은 붙잡아 둔 동안 미리 불러 둔다
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
  if (F !== lastFight) { if (lastFight) { stageFadeAt = t; const T2 = g.stage(); stageBanner = g.bossFight ? '두목전' : `Stage ${((T2.idx - 1) % 10) + 1}/10`; } lastFight = F; firstSeen.clear(); lastNext.clear(); atkAt.clear(); hpLag.clear(); corpses.length = 0; mobHit.clear(); mobCrit.clear(); impacts.length = 0; debris.length = 0; shocks.length = 0; mobSk.clear(); }   // 싸움이 바뀌면(두목전 · 칸 이동) 몹 번호가 새로 시작
  // 쓰러지는 몹(처치된 뒤 0.5초) — 뒤로 넘어가며 흐려지고 가라앉는다
  drawShocks(cx, P, k, t);
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i], bossC = c.m.kind === 'boss', a = (t - c.at) / (bossC ? 900 : 560); if (a > 1) { corpses.splice(i, 1); continue; }
    const [x, y] = P(c.x, c.y); if (x < -120 || x > W + 120) continue;
    // v597 맞은 반대쪽으로 튕겨 올랐다가(포물선) 떨어지며 넘어가고, 끝 0.4에서 흐려진다 — 두목은 뜨지 않고 무겁게 무너진다
    const ce = 1 - (1 - a) * (1 - a), fa = a < 0.6 ? 1 : 1 - ((a - 0.6) / 0.4) ** 2;
    cx.save(); cx.globalAlpha = fa; cx.translate(x - c.dir * ce * (bossC ? 8 : 30) * k, y - (bossC ? 0 : Math.sin(Math.min(1, a * 1.3) * Math.PI) * 16 * k) + (a > 0.75 ? (a - 0.75) * 24 * k : 0)); cx.rotate(-c.dir * ce * (bossC ? 1.1 : 1.4)); cx.translate(-x, -y);
    const cf = opt.gfx === 'low' ? 99 : t - c.at, filt = cf < -12 ? 'brightness(0) invert(1)' : cf < 50 ? 'brightness(2.4) saturate(0.3)' : '';   // 막타 — 첫 두 프레임은 새하얗게, 이어 밝게
    drawMob(cx, x, y, c.m, z, { t: ts + c.m.id, flip: c.dir < 0, ch, hurt: 1, scale: sc * (c.m.kind === 'boss' ? 1.3 : 1), filt });
    cx.restore();
  }
  // v6xx 따르는 무리 — 동료(사람)는 작은 무인으로 무인 뒤 땅에, 영물(짐승)은 그 뒤 조금 높이(나는 것은 공중에). 몹 · 무인보다 먼저 그려 체력 줄 · 무인을 가리지 않는다
  drawFollowers(cx, F, H, k, sc, t, ts, fdt, W, (x) => (x - camX) * s, (y) => baseY - (y - camY) * s, lx, ly);
  for (const m of F.mobs) {
    const [x, y] = P(lx(m), ly(m)); if (x < -120 || x > W + 120) continue;   // 화면 밖은 안 그린다
    // 나타남: 0.3초 동안 흐릿하게 내려앉음(먼지)
    let seen = firstSeen.get(m.id); if (seen === undefined) { seen = m.bornAt > 0 ? t : t - 1000; firstSeen.set(m.id, seen); if (m.bornAt > 0) dust.push({ x: m.x, y: m.y, at: t, land: 1 }); }
    const sa = Math.min(1, (t - seen) / 300);
    // 공격 몸짓: 엔진이 다음 공격 시각을 미루는 순간 = 방금 쳤다
    const pn = lastNext.get(m.id); if (pn !== undefined && m.nextAtk > pn) atkAt.set(m.id, t); lastNext.set(m.id, m.nextAtk);
    const aa = (t - (atkAt.get(m.id) ?? -1e9)) / 380, atk = aa >= 0 && aa < 1 ? aa : 0;
    // 맞음: 번쩍(0.07초) · 뒤로 젖혀짐 · 반대쪽으로 밀림
    const ha = t - (mobHit.get(m.id) || -1e9), crq = Math.abs(t - (mobCrit.get(m.id) || -1e9) - Math.max(0, ha)) < 60 ? 1.7 : 1, hurt = ha >= 0 && ha < 200 ? Math.min(1.6, (1 - ha / 200) * crq) : 0, skv = mobSk.get(m.id), skT = skv && Math.abs(skv[0] - (t - ha)) < 60 ? skv[1] : 0, kd = 140 + skT * 16, kx = ha >= 0 && ha < kd ? Math.sign(m.x - H.x || 1) * (m.kind === 'boss' ? 2 : m.kind === 'elite' ? 4 : 7) * Math.min(3.4, crq * (1 + skT * 0.35)) * k * (1 - ha / kd) ** (skT ? 2 : 1) : 0;   // 두목 · 정예는 덜 밀린다 · 무공은 차수만큼 더 멀리(1차 ×1.35 … 5차 ×2.75), 튕겼다 서서히 돌아온다
    const mw = m.moving && m.plat >= 0 && !(m.vy);
    cx.save();
    if (sa < 1) { cx.globalAlpha = sa; cx.translate(0, -(1 - sa) * 14 * k); }
    else { const ls = t - seen - 300; if (ls >= 0 && ls < 170) { const q = Math.sin((ls / 170) * Math.PI) * 0.1; cx.translate(x, y); cx.scale(1 + q * 0.8, 1 - q); cx.translate(-x, -y); } }   // v597 내려앉으며 한 번 납작
    if (mw) { cx.translate(x + kx, y); cx.rotate(Math.sin((ts + m.id) * 11) * 0.05); cx.translate(-(x + kx), -y); }   // 걸음마다 발을 축으로 몸이 좌우로 실린다
    const flash = ha >= 0 && ha < 70;
    drawMob(cx, x + kx, y, m, z, { t: ts + m.id, flip: m.dir < 0, moving: !!m.moving, ch, atk, hurt, scale: sc * (m.kind === 'boss' ? 1.3 : 1), filt: flash ? 'brightness(2.2) saturate(0.4)' : '' });
    // 무력화 · 약점 노출 동안 두목 몸에 흰 금빛 기운이 맥동한다(상태가 끝나면 사라짐)
    const bst = m.kind === 'boss' && opt.gfx !== 'low' && (m.stunUntil > F.t || !!(F.def.wb && F.wbW));
    if (bst) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha *= 0.3 + 0.22 * Math.sin(t * 0.012); drawMob(cx, x + kx, y, m, z, { t: ts + m.id, flip: m.dir < 0, moving: !!m.moving, ch, atk, hurt, scale: sc * 1.3, filt: 'sepia(1) saturate(2.4) brightness(1.5)' }); }
    cx.restore();
    if (m.kind === 'boss' && opt.gfx !== 'low') {
      const hh = mobHeight(m, ch) * sc * 1.3 * 0.5;
      if (bst) { const pu = (t % 900) / 900; cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = '#ffe9a8'; cx.globalAlpha = (1 - pu) * 0.7; cx.lineWidth = 2.5 * k; cx.beginPath(); cx.ellipse(x, y, (30 + pu * 46) * k, (9 + pu * 14) * k, 0, 0, 7); cx.stroke(); cx.restore(); }
      const ba = (t - bossFeel.burstAt) / 380;
      if (ba >= 0 && ba < 1) {   // 터지는 순간 — 두목에게서 사방으로 빛줄기
        const e = 1 - Math.pow(1 - ba, 3); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.translate(x, y - hh); cx.lineCap = 'round';
        for (let j = 0; j < 18; j++) { const ang = (j / 18) * Math.PI * 2 + 0.17, r1 = (26 + e * (150 + (j * 53 % 70))) * k, r0 = Math.max(18 * k, r1 - (1 - ba) * 70 * k); cx.globalAlpha = (1 - ba) * (j % 2 ? 0.95 : 0.6); cx.strokeStyle = j % 2 ? '#ffffff' : '#ffd56a'; cx.lineWidth = (j % 2 ? 3.2 : 2) * k * (1 - ba * 0.5); cx.beginPath(); cx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); cx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); cx.stroke(); }
        cx.globalAlpha = (1 - ba) * 0.8; cx.strokeStyle = '#fff6dc'; cx.lineWidth = (1 - ba) * 6 * k + 0.5; cx.beginPath(); cx.arc(0, 0, (20 + e * 90) * k, 0, 7); cx.stroke(); cx.restore();
      }
    }
    if (mw && m.kind !== 'mob' && t - (m.dustAt || 0) > 260) { m.dustAt = t; dust.push({ x: lx(m) - (m.dir || 1) * 250, y: ly(m), at: t }); }
    const top = (mobHeight(m, ch) + 10) * sc * (m.kind === 'boss' ? 1.3 : 1), bw = (m.kind === 'boss' ? 90 : 34) * k;
    if (m.hp < m.st.hp || m.kind !== 'mob') {
      // 체력 줄: 잃은 몫은 흰 줄로 남았다가 천천히 따라 줄어든다
      // 깎인 몫은 흰 줄로 0.25초 머물다(그래픽 낮음이면 바로) 금빛으로 바뀌며 따라 줄어든다. 두목 줄은 맞을 때 떨리고 큰 타격엔 테두리가 번쩍
      const r = Math.max(0, m.hp / m.st.hp), low = opt.gfx === 'low', isB = m.kind === 'boss' && !low;
      let L = hpLag.get(m.id); if (!L) hpLag.set(m.id, L = { v: 1, r: 1, hold: 0 });
      if (r < L.r - 1e-9 && t >= L.hold && L.v - L.r < 0.004 && !low) L.hold = t + 250;
      L.r = r; if (L.v < r) L.v = r; const held = t < L.hold;
      if (!held) L.v = Math.max(r, L.v - Math.max(0.012, (L.v - r) * 0.1) * (fdt / 16));
      const sa = isB ? t - bossFeel.shakeAt : -1, q = sa >= 0 && sa < 120 && opt.shake ? bossFeel.amp * (1 - sa / 120) : 0, bx = x - bw / 2 + (q ? Math.sin(sa * 0.16) * q : 0), by = y - top + (q ? Math.cos(sa * 0.21) * q * 0.5 : 0), bh = isB ? 5 : 4;
      cx.fillStyle = '#000a'; cx.fillRect(bx, by, bw, bh); cx.fillStyle = low ? '#fff8' : held ? '#ffffff' : '#ffd56ad0'; cx.fillRect(bx, by, bw * L.v, bh);
      cx.fillStyle = m.kind === 'boss' ? '#f59e0b' : '#e0436a'; cx.fillRect(bx, by, bw * r, bh);
      if (isB) { const fa = (t - bossFeel.flashAt) / 150; if (fa >= 0 && fa < 1) { cx.save(); cx.globalAlpha = 1 - fa; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3); cx.restore(); } }
    }
    if (m.kind !== 'mob') { const nm = mobName(m, z, ch); cx.font = 'bold 11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = m.kind === 'boss' ? '#fde68a' : '#e9d5ff'; cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.strokeText(nm, x, y - top - 4); cx.fillText(nm, x, y - top - 4); }
  }
  // 무공 연출 — 모양마다(일직선 검기 · 부채꼴 베기 · 주변 폭발 · 하늘에서 쏟아짐 · 버프 기운)
  const [hx, hy] = P(lx(H), ly(H));
  window.__cam = [camX, camY, hx, hy, t, s, H.plat, H.face || 1];   // 시험용(모션 측정)
  heroAt = [hx + cv.offsetLeft, hy - 100 * sc + cv.offsetTop];   // v624 레벨 업 「Lv n!」 자리(머리 위)
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
  // 동료 공격 빛 고리 — 몹 위에(따르는 무리는 몹 뒤에 그렸다)
  if (opt.gfx !== 'low') for (let i = 0; i < 5; i++) { const R = palRing[i]; if (!R.on) continue; R.on = false; const ring = tintImg('art/fx/fx-burst.png', PAL_COL[i]); if (!ring) continue; const w = 90 * k * (0.6 + R.q); cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - R.q; cx.drawImage(ring, R.x - w / 2, R.y - w / 2, w, w); cx.restore(); }
  drawImpacts(cx, P, k, t);   // v600
  if (debris.length) drawDebris(cx, P, k, t, fdt);
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
  // v597 달리기 — 걸음마다 다리가 벌어졌다 모이고(swing) · 벌어질 때 살짝 뜨고 · 팔과 무기가 걸음에 맞춰 흔들린다. 서고 달리는 사이는 0.12초에 걸쳐 잇는다
  runMix = Math.max(0, Math.min(1, runMix + (hw ? 1 : -1) * fdt / 120));
  if (!heroAnim.active && H.plat >= 0) {
    // 서 있기(겨누지 않을 때) — 숨 쉬며 팔 · 무기가 느리게 흔들린다
    if (!pose) pose = { ...IDLE, crouch: 0.02 + Math.sin(ts * 2.2) * 0.02, hand: [2.5 + Math.sin(ts * 1.7) * 0.07, 22], blade: -0.6 + Math.sin(ts * 1.7 + 0.8) * 0.06, swing: 0 };
    if (runMix > 0) {
      const ph = Math.sin(ts * 14), ab = Math.abs(ph);
      const run = { lean: 0.2, crouch: 0.06 + (1 - ab) * 0.1, lift: ab * 2.6, dx: 0, hand: [2.5 - ph * 0.75, 22], blade: -0.6 + ph * 0.3, stretch: 0.03, alpha: 1, wscale: 1, swing: ph * 8 };
      pose = runMix >= 1 ? run : mixPose(pose, run, runMix * runMix * (3 - 2 * runMix));
    }
  }
  // v598 맞으면 움찔(0.18초 — 뒤로 젖혀지고 살짝 밀림) · 쓰러지면 무릎을 꿇고 칼을 짚는다(1.2초)
  const hurtF = Math.max(0, 1 - (t - heroHurtAt) / 180), downA = (t - heroDownAt) / 1200;
  if (downA >= 0 && downA < 1 && H.plat >= 0) { const kq = Math.min(1, downA / 0.2), ke = 1 - (1 - kq) ** 3; pose = mixPose(pose || IDLE, { lean: 0.34, crouch: 0.9, lift: 0, dx: 2, hand: [1.45, 20], blade: 1.57, stretch: 0, alpha: 1, wscale: 1.2, swing: 0 }, ke); }
  else if (hurtF > 0 && pose) pose = { ...pose, lean: pose.lean - hurtF * 0.16, dx: pose.dx - hurtF * 4, crouch: pose.crouch + hurtF * 0.08 };
  if (t - pillarAt < 1500) {   // v534 좋은 장비를 주웠을 때 무인 자리에 빛기둥
    const a2 = (t - pillarAt) / 1500, al = a2 < 0.15 ? a2 / 0.15 : 1 - (a2 - 0.15) / 0.85, bw = 46 * k * (1 + a2 * 0.4);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.75 * al;
    const gr = cx.createLinearGradient(hx - bw, 0, hx + bw, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, pillarCol); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(hx - bw, 0, bw * 2, hy + 6 * k);
    cx.globalAlpha = 0.5 * al; cx.fillStyle = '#fff'; cx.fillRect(hx - bw * 0.12, 0, bw * 0.24, hy);
    cx.restore();
  }
  // v562 칭호 오라 — 단 칭호의 빛깔로 발밑에 은은한 빛 · 위로 오르는 불티(그래픽 낮음이면 끔) · 그리기는 titleAura(칭호 창 미리 보기와 같은 것)
  if (g.S.titleOn && opt.gfx !== 'low') titleAura(cx, hx, hy, k, ts, titleByName(g.S.titleOn)?.col || '#fde68a');
  // v546 회피 잔상 — 대시하는 0.3초 동안 지나온 자리에 옅은 그림자
  if (t - dashAt < 300) dashTrail.push({ x: hx, y: hy, at: t });
  dashTrail = dashTrail.filter((d) => t - d.at < 240);
  // v614 filter 건 무인은 작은 판에 그려 filter를 한 번만(선마다 걸면 폰이 뜨거워진다)
  const heroF = (filt, x, y, o) => { if (filtered(cx, filt, x, y, 150 * sc, 240 * sc, 40 * sc, (c) => drawHero(c, x, y, g.S.hero.job, g.S.hero.lv, o))) return; cx.save(); cx.filter = filt; drawHero(cx, x, y, g.S.hero.job, g.S.hero.lv, o); cx.restore(); };
  for (const d of dashTrail) { cx.save(); cx.globalAlpha = 0.35 * (1 - (t - d.at) / 240); heroF('brightness(1.8) saturate(0.3)', d.x, d.y, { t: ts, run: true, turn, pose, scale: sc, eq: g.lookEq() }); cx.restore(); }
  // 3차 이상 무공 — 내지르는 0.2초 동안 뒤에서 따라붙는 잔상(3차 2겹 · 4차부터 3겹)
  if (t - ghostAt < 200 && opt.gfx !== 'low') { const ga = (t - ghostAt) / 200, gn = lastCastTier >= 4 ? 3 : 2; cx.save(); for (let i = gn; i >= 1; i--) { cx.globalAlpha = 0.42 * (1 - ga) / i; heroF('brightness(1.8) saturate(0.3)', hx - heroFace * i * 15 * k * (1 - ga * ga), hy, { t: ts, run: false, turn, pose, scale: sc, eq: g.lookEq() }); } cx.restore(); }
  const hflash = t - heroHurtAt < 60 && opt.gfx !== 'low', heroO = { t: ts, run: heroRun > 0, turn, pose, lunge: pose ? 0 : Math.max(0, 1 - (t - lastHitAt) / 160), scale: sc, eq: g.lookEq() };   // v598 맞는 순간 번쩍
  if (hflash) heroF('brightness(1.9) saturate(0.5)', hx, hy, heroO); else drawHero(cx, hx, hy, g.S.hero.job, g.S.hero.lv, heroO);
  drawSwing(cx, hx, hy, sc, heroFace, t);   // v599
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
  drawBossFeel(cx, W, Hh, k, t); bossBarFx(t, fdt); heroBarFx(t, fdt, F);
  // 연속 처치 10+ — 잡을 때마다 가장자리가 금빛으로 0.2초 숨 쉰다(30 · 50부터 조금 더). 그라디언트는 화면 크기마다 한 번만
  if (t - vigAt < 200 && opt.gfx !== 'low') {
    const key = W + 'x' + Hh; if (vigKey !== key) { vigKey = key; vigGr = cx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.42, W / 2, Hh / 2, Math.max(W, Hh) * 0.72); vigGr.addColorStop(0, 'rgba(255,200,90,0)'); vigGr.addColorStop(1, 'rgba(255,200,90,1)'); }
    const va = (t - vigAt) / 200; cx.save(); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = [0, 0.14, 0.2, 0.27][vigLv] * (va < 0.2 ? va / 0.2 : 1 - (va - 0.2) / 0.8); cx.fillStyle = vigGr; cx.fillRect(0, 0, W, Hh); cx.restore();
  }
  // 두목 패턴에 맞음 — 화면 가장자리 붉게(0.4초)
  if (t - hurtFlash < 400) { const key = W + 'x' + Hh; if (hurtKey !== key) { hurtKey = key; hurtGr = cx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.3, W / 2, Hh / 2, Math.max(W, Hh) * 0.7); hurtGr.addColorStop(0, 'rgba(220,20,20,0)'); hurtGr.addColorStop(1, 'rgba(220,20,20,0.45)'); } cx.save(); cx.globalAlpha = 1 - (t - hurtFlash) / 400; cx.fillStyle = hurtGr; cx.fillRect(0, 0, W, Hh); cx.restore(); }   // v614 그라디언트는 화면 크기마다 한 번 · 옅어짐은 globalAlpha로
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
  if (mobSk.size > 300) mobSk.clear();
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
    let castShape = null, castCol = null, castTier = 0, skRings = 0;
    for (const e of (saverOn ? [] : g.lastEvents || [])) {   // v587 절전 중엔 타격 연출 · 소리 건너뜀
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
        if (m.kind === 'boss' && e[5] !== 2) { const sh = e[3] / Math.max(1, m.st.hp), bf = bossFeel; bf.shakeAt = t + fly; bf.amp = Math.min(5, 1.2 + sh * 90); if (sh >= 0.03 || e[4]) bf.flashAt = t + fly; }   // 두목 체력 줄: 피해 몫만큼 떨리고(최대 5px), 큰 타격(한 번에 3% 이상) · 치명타엔 테두리 번쩍
        const skT = e[5] === 1 && opt.gfx !== 'low' ? (castTier || (t - lastCastAt < 900 ? lastCastTier : 0) || 1) : 0;   // 무공 타격 — 차수만큼 더 밀리고, 3차부터는 충격 고리(한 번 쓸 때 여섯까지)
        if (skT) mobSk.set(m.id, [t + fly, skT]);
        const skRing = skT >= 3 && !e[4] && skRings < 6; if (skRing) skRings++;
        if (e[5] !== 2 && opt.gfx !== 'low' && impacts.length < 40 && (e[4] || e[5] === 0 || skRing)) impacts.push({ x: m.x, y: m.y + 650, at: t + fly, crit: !!e[4] || skRing, dir: Math.sign(m.x - H0.x) || 1, seed: (m.id * 31 + (e[6] || 0) * 17 + (t | 0)) % 1000 });
        if (e[4] && e[5] !== 2) {
          mobCrit.set(m.id, t + fly);
          setTimeout(() => { const n2 = now(); shakeUntil = Math.max(shakeUntil, n2 + 110); vib('crit'); if ((g.bossFight || g.dg) && n2 - lastCritStop > 500) { lastCritStop = n2; freezeUntil = Math.max(freezeUntil, n2 + 30); } }, fly);
        }
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
      else if (e[0] === 'cast') { castShape = e[6]; castCol = skillById(e[2])?.col; castTier = skillById(e[2])?.tier || 1; skRings = 0; skillFx.push({ at: t + 90, id: e[2], face: e[3], x: e[4], y: e[5], shape: e[6], R: e[7], hero: 1 }); }   // v507 휘두르는 순간(자세가 끝까지 가는 때)에 맞춰 터진다
      else if (e[0] === 'buff') { skillFx.push({ at: t, id: e[2], shape: 'buff', hero: 1 }); play('loot'); }
      else if (e[0] === 'pal') palAtk[e[2]] = { at: t, mid: e[3] };
      else if (e[0] === 'tell') { tells.set(e[2], { pat: e[3], x: e[4], y: e[5], w: e[6], at: t, dur: e[7], safe: e[8] != null ? [e[8], e[9]] : null }); play('tell'); }
      else if (e[0] === 'phase') { shakeUntil = t + 500; play('tense'); chbBanner(e[3] === 2 ? '필살 국면' : '분노', e[3] === 2 ? '붉은 땅 밖 — 빛나는 자리로 피하라!' : '두목이 빨라졌다', e[3] === 2 ? 'ult' : 'rage'); buzz(80); }
      else if (e[0] === 'stun') { play('rare', 4); bossFeel.stFlashAt = bossFeel.burstAt = t; shakeUntil = Math.max(shakeUntil, t + 260); chbBanner('무력화!', `${Math.round(e[3] / 1000)}초 기절 · 받는 피해 ×${CB.stunDmgX}`, 'stun'); }
      else if (e[0] === 'summon') addLog('두목이 졸개를 불렀다');
      else if (e[0] === 'wbw') { if (e[2]) { chbBanner('약점 노출!', `10초 · 받는 피해 ×${WBF.weakX} — 무공을 몰아 쓰세요`, 'stun'); play('rare', 4); shakeUntil = Math.max(shakeUntil, t + 300); bossFeel.stFlashAt = bossFeel.burstAt = t; } else chbBanner('방어 자세', `받는 피해 ×${WBF.guardX}`, 'rage'); }
      else if (e[0] === 'hurt') { play('hurt'); if (t - heroHurtAt > 260) heroHurtAt = t; }   // v598 맞으면 움찔
      else if (e[0] === 'dash') { dashAt = t; play('swish'); }
      else if (e[0] === 'perfect') { perfAt = t; slowUntil = t + 650; shakeUntil = t + 160; play('rare', 5); buzz([30, 40, 30]); chbBanner('완벽 회피!', `${DASH.buffMs / 1000}초 동안 주는 피해 ×${DASH.buffX}`, 'stun'); addLog('완벽 회피!'); }
      else if (e[0] === 'die') { play('down'); vib('die'); heroDownAt = t; }   // v598 쓰러지면 무릎을 꿇는다
      else if (e[0] === 'burst') { tells.delete(e[2]); skillFx.push({ at: t, shape: 'boss', pat: e[3], x: e[4], y: e[5], w: e[6] }); shakeUntil = t + (e[7] ? 420 : 220); if (e[7]) { hurtFlash = t; vib('bossHurt'); } play('burst'); }
      else if (e[0] === 'kill') {
        comboHit(t);
        if (e[3] === 'boss') {   // 마지막 일격 — 흰 번쩍(0.08초) → 느린 화면(0.5초 · 장 두목은 0.9초, 더하지 않고 긴 쪽) → 파편 · 충격 고리
          const chb = !!g.lastFight?.def?.chb, bm = mobs.get(e[2]), c = window.__cam;
          slowUntil = Math.max(slowUntil, t + (chb ? 900 : 500)); shakeUntil = Math.max(shakeUntil, t + (chb ? 700 : 420));
          if (chb) chbBanner('BOSS DEFEATED', '', 'win');
          if (opt.gfx !== 'low') { bossFeel.whiteAt = t; if (bm && c) bossFeel.kill = { at: t + 40, F: F0, x: c[2] + (bm.x - F0.hero.x) * c[5], y: c[3] - (bm.y - F0.hero.y) * c[5], seed: (bm.id * 31 + (t | 0)) % 1000 }; }
          vib('bossKill');
        } else if (e[3] === 'elite') vib('elite');
        play('kill'); if (killLog.length < 500) killLog.push(t); const m = mobs.get(e[2]); if (m && coins.length < 40) { const cw = m.kind === 'boss' ? 1.7 : m.kind === 'elite' ? 1.4 : 1, ch2 = m.kind === 'boss' ? 1.55 : m.kind === 'elite' ? 1.3 : 1; for (let j = 0; j < (m.kind === 'mob' ? 2 : 6); j++) coins.push({ x: m.x, y: m.y + 600, vx: (((j % 3) - 1) * 900 + ((m.id * 7 + j * 13) % 9 - 4) * 120) * cw, vy: (5200 + (j % 2) * 1500) * ch2, at: t, j }); }   // 정예 · 두목은 은자가 더 높이 · 넓게 튄다
        if (m && corpses.length < 30) corpses.push({ m: { id: m.id, kind: m.kind }, x: m.x, y: m.y, dir: m.dir || 1, at: t + 40 });
        if (m && opt.gfx !== 'low') {   // 막타 — 파편이 맞은 쪽으로 튀고, 정예 · 두목은 땅 고리 + 흔들림(장 두목은 제 느린 화면이 있어 흔들림을 더하지 않는다)
          spawnDebris(m, Math.sign(m.x - F0.hero.x) || 1, t + 40);
          if (m.kind !== 'mob') { if (shocks.length < 12) shocks.push({ x: m.x, y: m.y, at: t + 40, R: m.kind === 'boss' ? 120 : 78, dur: m.kind === 'boss' ? 420 : 320, col: m.kind === 'boss' ? '#fde68a' : '#e9d5ff' }); if (!(m.kind === 'boss' && g.lastFight?.def?.chb)) shakeUntil = Math.max(shakeUntil, t + (m.kind === 'boss' ? 260 : 180)); }
          if (combo >= 10) { vigAt = t; vigLv = combo >= 50 ? 3 : combo >= 30 ? 2 : 1; }
        } firstSeen.delete(e[2]); lastNext.delete(e[2]); atkAt.delete(e[2]); hpLag.delete(e[2]); if (m && skillFx.length < 90) skillFx.push({ at: t, shape: 'ring', x: m.x, y: m.y });
      }
      if (e[0] === 'cast') { heroAttackPose(g.S.hero.job, true); lastAtkPose = t; play('skill'); lastCastAt = t; const tr = skillById(e[2])?.tier || 0; if (tr >= 3 && t - lastFreeze > 700) { freezeUntil = t + 45; lastFreeze = t; } if (tr >= 3) vib(`sk${Math.min(5, tr)}`); lastCastTier = tr;
        if (tr >= 4 || opt.gfx !== 'low') { const amp = 0.01 + 0.01 * Math.min(5, tr); if (amp >= punchNow(t)) punch = { at: t, amp, dur: tr >= 4 ? 240 : 160 }; }   // 당김 — 더 큰 당김이 도는 중이면 덮지 않는다
        if (opt.gfx !== 'low') { if (tr >= 2 && shocks.length < 12) shocks.push({ x: F0.hero.x, y: F0.hero.y, at: t + 60, R: 44 + tr * 16, dur: 250, col: skillById(e[2])?.col || '#ffe9a8' }); if (tr >= 3) ghostAt = t; }
        flashSlot(e[2]); }   // 큰 무공은 맞는 순간 0.06초 멈칫
      if (e[0] === 'cast' && skillById(e[2])?.tier === 5) { cutIn = { at: t, id: e[2] }; shakeUntil = t + 450; }
    }
    // 두목 고비 — 체력이 75 · 50 · 25%를 넘어 내려가는 순간: 가장자리 번쩍 + 흔들림 +0.2초 + 막대 눈금 튐 + 진동
    { const bf = bossFeel, bm = F0.mobs.find((m) => m.kind === 'boss'), r = bm ? Math.max(0, bm.hp / bm.st.hp) : null;
      if (bf.lastF === F0 && r !== null && bf.lastR !== null && r > 0 && !saverOn && BOSS_MS.some((th) => bf.lastR > th && r <= th)) { if (opt.gfx !== 'low') { bf.msAt = bf.popAt = t; } shakeUntil = Math.max(shakeUntil, t) + 200; vib('bossMs'); }
      bf.lastF = F0; bf.lastR = r; }
  }
  if (t - lastMin >= 60000) { lastMin = t; g.minute(); }
  for (const f of g.feed.splice(0)) {
    if (f.k === 'level') { play('level'); levelAt = now(); addLog(`레벨 업 — Lv ${f.lv}`); }   // v520 알림 대신 무인 위 LEVEL UP(v519)
    else if (f.k === 'guide') addLog('길잡이 완료 — 왼쪽 위에서 받기');
    else if (f.k === 'advance') { jbBanner(f.n); addLog(`${f.n}차 전직 — ${jbTitle(g.S.hero.job, f.n)}`); }
    else if (f.k === 'boss') addLog('사냥터 두목 처치!');
    else if (f.k === 'bounty') { toast(f.all ? '현상수배 완료! — 셋 다 끝, 상자를 열어요' : '현상수배 완료!'); addLog('현상수배 하나 끝 — 임무 창 「현상수배」에서 받기'); navDots(); }
    else if (f.k === 'retreat') { addLog(`몹이 세서 ${Math.ceil(f.idx / 10)}장 ${((f.idx - 1) % 10) + 1}칸으로 물러났어요 — 더 강해지면 다시 나아가요`); toast('앞 칸으로 물러났어요 — 강해지면 다시 나아가요'); }
    else if (f.k === 'fate') { if (!opt.autoGrow) toast('기연이 찾아왔어요 — 왼쪽 위 「기연」을 눌러요'); addLog('기연이 찾아왔어요'); }
    else if (f.k === 'sudden') toast(`돌발 미션: 10분 안에 ${f.need}마리`);
    else if (f.k === 'realm') addLog(`경지 ${f.lv}`);
    else if (f.k === 'gacha-lv') addLog(`뽑기 레벨 ${f.lv}`);
    else if (f.k === 'tree') { const sk = skillById(f.id); toast(`${sk?.name} 강화 완료`); }
    else if (f.k === 'challenge') { play('boss'); addLog(f.practice ? `연습 — ${CHBOSS[f.chb].name}` : f.raid ? `토벌 — ${CHBOSS[f.chb].name} · Lv ${f.idx}` : `${Math.ceil(f.idx / 10)}장 ${((f.idx - 1) % 10) + 1}칸 ${f.chb ? '장 두목' : '두목'} 도전`); if (f.chb) chbIntro(f.chb); }
    else if (f.k === 'raid-end') showRaidResult(f);
    else if (f.k === 'stage-clear' || f.k === 'stage-fail') { const K = bossFeel.kill; if (f.k === 'stage-clear' && K && K.F === g.lastFight && now() - K.at < 200) setTimeout(() => showResult(f), g.lastFight?.def?.chb ? 850 : 600); else showResult(f); }   // 마지막 일격 연출(파편 · 느린 화면)이 보이도록 결과 창은 그 뒤에
    else if (f.k === 'dungeon-start') { closeWin(); play('tense'); if (f.type === 'wboss') wbIntro(); else if (f.type === 'graid') chbIntro(g.graidBoss()); else dgBanner(f.title, g.dgStatus()); addLog(`${f.title} 입장`); }
    else if (f.k === 'dungeon-end') {
      // v616 탑을 깨면 들판에 「n층 돌파!」 · 이정표면 「n층 상자!」 — 결과 창은 그 뒤에
      if (f.type === 'tower' && f.cleared) { chbBanner(`${f.floor}층 돌파!`, '영구 보너스', 'win'); buzz(40); if (f.chest) setTimeout(() => { chbBanner(`${f.chest}층 상자!`, '이정표 상자', 'win'); play('rare', 4); }, 1000); setTimeout(() => showDgResult(f), f.chest ? 2300 : 1300); }
      else showDgResult(f);
      if (f.type === 'wboss') wbPush(f.score);
      if (f.type === 'graid' && net.online && g.S.guildId && f.dmg > 0) { ensureNick(); net.graidHit(g.S.guildId, wkStr(Date.now()), g.S.nick, f.dmg, g.S.hero.lv).then((RD) => { guildState.raid = RD; net.guildSay(g.S.guildId, g.S.nick, `${g.S.nick} — 문파 토벌에 피해 ${unit(f.dmg)}를 보탰어요`, 'system').catch(() => {}); toast(`문파 토벌 — 피해 ${unit(f.dmg)} 보탬`); if (open === 'social') paintWin(); }).catch((e) => { console.warn('[s2net] graid', e?.code || e); toast('문파 토벌 기록을 올리지 못했어요'); }); }   // v550
    }
    else if (f.k === 'loot') lootFx(f);
    else if (f.k === 'ach') achFx(achById.get(f.id));
  }
  // v578 절전 — 2분 동안 손대지 않으면 어둡게 · 다섯 번에 한 번만 그림(엔진은 그대로) · 누르면 돌아옴
  saverTick(t);
  if (!document.hidden && !saverOn) draw();   // 안 보이는 동안 · 절전 중엔 그리지 않는다(엔진은 돈다) — v587 절전은 아예 안 그림(발열)
  if (dust.length > 60) dust.splice(0, dust.length - 60);
  if (!saverOn && t - lastHud > 200) { lastHud = t; paintHud(); }
  if (t - lastSave > 10000) { lastSave = t; save(); cloudPush(false); }
  if (resTimer && t > resTimer) closeResult();
  comboTick(t);   // v564
  // v588 자동 성장 — 켜 두면 1분마다(두목전 · 던전 · 창이 열려 있을 땐 쉼)
  if (opt.autoGrow && g && t - (frame.ag || 0) > 60000 && !g.bossFight && !g.dg && !open) agRun(t);
  if (saverOn) setTimeout(frame, SAVER_TICK); else requestAnimationFrame(frame);   // v587 절전: 초당 4번만(엔진은 50ms 틱으로 따라잡는다 — 한 번에 최대 1초)
}
// v588 자동 성장 한 번 — 1분마다(frame) · 돌아왔을 때 카드 앞에서도 한 번(returnQueue)
function agRun(t) {
  frame.ag = t; const r = g.autoGrow(opt.agGold ? {} : { kit: false, enh: false, train: false });   // v593 은자 아끼기
  // v589 문파 출석(서버) — 문파에 들었고 오늘 안 했으면
  if (net.online && g.S.guildId && guildState.g && g.S.gChk !== dayKey(now())) { const G = guildState.g, gr = g.guildCheckin(Game.guildLvOf(G.exp)); if (gr) { r.daily.push('문파 출석'); net.guildCheckin(G).catch(() => {}); } }
  if (r.daily.length) agSum.daily += r.daily.length;
  if (r.claim || r.pull || r.coll || r.equip || r.kit || r.enh || r.train || r.daily.length) {
    agSum.claim += r.claim; agSum.pull += r.pull + r.coll; agSum.kit += r.kit; agSum.enh += r.enh; save();
    addLog(`자동 성장 — ${[r.daily.length && r.daily.join(' · '), r.claim && `보상 ${r.claim}`, r.pull && `뽑기 ${r.pull}`, r.coll && `병기·동료·영물 ${r.coll}`, r.equip && '장비 바꿈', r.kit && `무공 +${r.kit}`, r.enh && `강화 +${r.enh}`, r.train && `수련 +${r.train}`].filter(Boolean).join(' · ')}`);
  }
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
//   지금 장 배경(어둡게) 위에 내 무인(왼쪽) · 상대(오른쪽) · 위에 이름판 + 체력 막대 · 3·2·1 비무 시작!(0.9초) · 피해 숫자 · 충격 고리 · 막타는 0.4초 느리게
//   → 결과 카드(승/패 · 점수 · 등급 막대 · 다시/닫기) · 누르면 건너뛰기. 그래픽 낮음이면 3·2·1 · 느린 막타 · 고리 없이
const lookEqOf = (lk, lv) => Object.fromEntries(SLOTS.map((sl) => [sl, { slot: sl, g: lk && lk[sl] != null ? lk[sl] : Math.min(6, Math.floor((lv || 1) / 25)), up: 0, subs: [] }]));
const duelHard = (my, op) => { const x = op / Math.max(1, my); return x < 0.9 ? ['쉬움', 'easy'] : x > 1.1 ? ['어려움', 'hard'] : ['비슷', 'even']; };
function duelTier(sc) {   // 엔진 등급표(하수 → 현경) — 지금 등급 · 다음 등급까지 몇 점 · 막대 비율
  const i = Math.max(0, PVP_TIERS.filter((t) => sc >= t.min).length - 1), cur = PVP_TIERS[i], nx = PVP_TIERS[i + 1];
  return { name: cur.name, next: nx ? nx.name : '', need: nx ? nx.min - sc : 0, p: nx ? Math.max(0, Math.min(1, (sc - cur.min) / (nx.min - cur.min))) : 1 };
}
// 대결 칸의 작은 모습들 — 창이 열려 있는 동안만 초당 열다섯 번쯤(창을 닫으면 저절로 멈춤)
let duelCvLoop = 0;
function duelCvRun() {
  if (duelCvLoop) return;
  let last = 0;
  const step = (ts) => {
    const cvs = document.querySelectorAll('#wb canvas.duel-cv'); if (!cvs.length) { duelCvLoop = 0; return; }
    if (ts - last > 66) {
      last = ts;
      for (const cv of cvs) { const d = cv._d; if (!d || !JOBS[d.job]) continue; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); drawHero(x, cv.width / 2, cv.height - 10, d.job, d.lv || 1, { t: (opt.gfx === 'low' ? 0 : ts / 1000) + d.ph, scale: 2.05, eq: d.eq, flip: true }); }
    }
    duelCvLoop = requestAnimationFrame(step);
  };
  duelCvLoop = requestAnimationFrame(step);
}
// 상대 하나와 겨루기(대결 칸 「도전」 · 결과 카드 「다시」)
function duelGo(i) {
  const r = g.pvpFight(i);
  if (r) { if (r.oppUid) net.pvpLog(r.oppUid, { name: g.S.nick, win: r.win, d: r.defD, seed: r.d }).catch(() => {}); rankPush(); closeWin(); duelShow(r, i); }
  return r;
}
function duelShow(r, again = -1) {
  for (const o of document.querySelectorAll('.duel')) o.remove();
  const low = opt.gfx === 'low', me = { name: g.S.nick || '나', job: g.S.hero.job, lv: g.S.hero.lv };
  const ov = document.createElement('div'); ov.className = `duel${low ? ' duel-low' : ''}`;
  const plate = (cls, w) => `<div class="dl-side ${cls}"><div class="duel-nm"><b>${esc(w.name)}</b><small>${esc(JOBS[w.job]?.name || '')} · Lv ${w.lv}</small></div><div class="dl-bar"><em></em><i></i></div><small class="duel-hp"></small></div>`;
  ov.innerHTML = `<canvas></canvas><div class="dl-top">${plate('me', me)}<div class="dl-vs">VS</div>${plate('op', r.opp)}</div><div class="dl-mid"></div><div class="duel-res"></div><div class="dl-skip">누르면 건너뛰기</div>`;
  $('battle').append(ov);
  const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), mid = ov.querySelector('.dl-mid'), res = ov.querySelector('.duel-res');
  const bars = ov.querySelectorAll('.dl-bar i'), trails = ov.querySelectorAll('.dl-bar em'), txt = ov.querySelectorAll('.duel-hp');
  const DPR = low ? 1 : Math.min(2, pxr()), speed = Math.max(1, r.ms / 9000), lead = low ? 0 : 900, SLOW = 400, SLOW_X = 0.22;
  const hp = [r.myHp, r.opp.hp], left = [r.myHp, r.opp.hp], floats = [], imps = [], atk = [-1e9, -1e9], hurt = [-1e9, -1e9];
  const opEq = lookEqOf(r.opp.lk, r.opp.lv), myEq = g.lookEq(), ch = chapterOf(g.zoneLv()), z = zoneFor(g.zoneLv());
  // 막타 — 진 쪽 체력이 처음 0이 되는 공격(시간이 다 되면 마지막 공격)
  let fin = r.log.length - 1;
  { const L = [...hp]; for (let j = 0; j < r.log.length; j++) { const e = r.log[j]; L[e[1]] -= e[2]; if (L[e[1]] <= 0) { fin = j; break; } } }
  let i = 0, done = false, t0 = now(), last = t0, debt = 0, vt = 0, pt = 0, slowAt = -1, shakeT = -1e9, shakeA = 0, flashT = -1e9, phase = low ? 'fight' : 'intro', introStep = -1;
  ov.dataset.phase = phase;
  const setPhase = (p) => { phase = p; ov.dataset.phase = p; };
  const say = (h, cls) => { mid.className = `dl-mid ${cls || ''}`; mid.innerHTML = h; };
  if (!low) { say('<b>3</b>'); play('tense'); }
  const close = () => { ov.remove(); paintHud(); };
  const showRes = () => {
    const P = g.S.pvp || {}, used = P.day === String(dayKey(now())) ? P.used || 0 : 0, can = again >= 0 && !r.friendly && used < 5;
    const s0 = r.score - (r.d || 0), T0 = duelTier(s0), T1 = duelTier(r.score), up = T1.name !== T0.name;
    res.className = `duel-res on ${r.win ? 'win' : 'lose'}`;
    res.innerHTML = `<div class="duel-wl">${r.win ? '승' : '패'}<small>${r.win ? 'WIN' : 'LOSE'}</small></div>
      <div class="duel-vs">${esc(me.name)} <i>vs</i> ${esc(r.opp.name)}</div>
      ${r.friendly ? '<div class="duel-dd">친선 대결 — 점수 그대로</div>' : `<div class="duel-dd"><b class="${r.d >= 0 ? 'w' : 'l'}">${r.d >= 0 ? '+' : ''}${r.d}</b> 점수 ${s0} → <b>${r.score}</b></div>`}
      <div class="duel-tr"><span>${esc(T1.name)}${up ? ` <em>${r.d >= 0 ? '오름!' : '내림'}</em>` : ''}</span><div class="duel-tp"><i style="width:${Math.round((up ? (r.d >= 0 ? 0 : 1) : T0.p) * 100)}%"></i></div><span>${T1.next ? `${esc(T1.next)}까지 ${T1.need}` : '최고 등급'}</span></div>
      <div class="duel-acts">${can ? `<button class="btn primary duel-again">다시 <small>${5 - used}번 남음</small></button>` : ''}<button class="btn duel-close">닫기</button></div>`;
    requestAnimationFrame(() => { const b = res.querySelector('.duel-tp i'); if (b) b.style.width = `${Math.round(T1.p * 100)}%`; });
    res.onclick = (ev) => ev.stopPropagation();
    res.querySelector('.duel-close').onclick = (ev) => { ev.stopPropagation(); play('click'); close(); };
    const ag = res.querySelector('.duel-again'); if (ag) ag.onclick = (ev) => { ev.stopPropagation(); play('click'); if (!duelGo(again)) toast('할 수 없어요'); save(); paintHud(); };
  };
  const finish = () => {
    if (done) return; done = true; setPhase('result');
    while (i < r.log.length) { const e = r.log[i++]; left[e[1]] -= e[2]; }
    say(''); showRes();
    play(r.win ? 'clear' : 'fail'); if (r.win) buzz(80);
    addLog(r.friendly ? `친선 대결 ${r.win ? '승리' : '패배'} — ${r.opp.name}` : `대결 ${r.win ? '승리' : '패배'} — ${r.opp.name} · 점수 ${r.d >= 0 ? '+' : ''}${r.d}`);
  };
  ov.onclick = () => { if (!done) finish(); else close(); };
  ov._st = () => ({ pt: Math.round(pt), ms: r.ms, phase, el: Math.round(now() - t0), i, n: r.log.length, fin });   // 시험이 보는 진행
  const tick = () => {
    if (!ov.isConnected) return;
    const n = now(), dt = n - last; last = n;
    const W = ov.clientWidth, H = ov.clientHeight; if (cv.width !== Math.round(W * DPR) || cv.height !== Math.round(H * DPR)) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
    const gy = H * 0.8, k = Math.min(1.5, H / 330), pos = [W * 0.37, W * 0.63];
    // 시계 — vt: 그리는 시계(느린 막타에 함께 느려짐) · pt: 기록 시계(대결 ms)
    const slowing = slowAt >= 0 && n - slowAt < SLOW, rate = slowing ? SLOW_X : 1;
    debt += dt * (1 - rate); vt = n - t0 - debt;   // 실제 시각에 묶는다(틀이 늦어도 길어지지 않게) — 느린 막타 동안 덜 간 만큼만 빼고
    if (phase === 'intro') {
      const el = n - t0, st = el < 220 ? 0 : el < 440 ? 1 : el < 660 ? 2 : 3;
      if (st !== introStep) { introStep = st; if (st === 1) say('<b>2</b>'); else if (st === 2) say('<b>1</b>'); else if (st === 3) { say('<b>비무 시작!</b>', 'go'); play('boss'); } }
      if (el >= lead) setPhase('fight');
    } else if (!done) {
      if (introStep === 3 && n - t0 > lead + 350) { introStep = 4; say(''); }
      pt = Math.max(pt, (n - t0 - lead - debt) * speed);
      while (i < r.log.length && r.log[i][0] <= pt) {
        const e = r.log[i], who = e[1];   // who = 맞는 쪽(0 나 · 1 상대)
        left[who] -= e[2]; atk[1 - who] = vt; hurt[who] = vt;
        const big = i === fin; i++;
        floats.push({ who, d: e[2], crit: e[3], big: e[4] || big, at: vt });
        if (!low && imps.length < 24 && (e[3] || e[4] || big)) imps.push({ x: pos[who], y: gy - 55 * k, at: vt, crit: !!(e[3] || big), dir: who ? 1 : -1, seed: (i * 37) % 1000 });
        play(e[4] ? 'skill' : 'hit');
        if (opt.shake && (e[3] || e[4] || big)) { shakeT = vt; shakeA = big ? 7 : e[3] ? 4 : 2.5; }
        if (big) { flashT = vt; if (!low && slowAt < 0) { slowAt = n; setPhase('final'); } vib('crit'); }
      }
      const slow2 = slowAt >= 0 && n - slowAt < SLOW;   // 막 느려지기 시작한 틀에서 바로 끝내지 않게
      if (phase === 'final' && !slow2) setPhase('fight');
      if (pt > r.ms + 300 && !slow2) finish();
    }
    // 그리기 — 배경(지금 장 · 어둡게) · 흔들림 · 막타 당김
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, H);
    const sa = vt - shakeT, q = opt.shake && sa < 160 ? shakeA * (1 - sa / 160) : 0;
    const fz = !low && slowAt >= 0 ? Math.max(0, 1 - Math.abs(n - slowAt - SLOW * 0.45) / (SLOW * 0.9)) * 0.1 : 0;   // 막타 — 맞는 쪽으로 살짝 당겼다 풂
    cx.save();
    if (q) cx.translate(Math.sin(vt * 0.09) * q, Math.cos(vt * 0.113) * q * 0.7);
    drawPaintedBack(cx, W, H, ch, 0, z, 0);
    cx.fillStyle = 'rgba(6,4,2,.58)'; cx.fillRect(-10, -10, W + 20, H + 20);
    const vg = cx.createRadialGradient(W / 2, gy - 40, 20, W / 2, gy - 40, W * 0.6); vg.addColorStop(0, 'rgba(255,214,140,.10)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); cx.fillStyle = vg; cx.fillRect(-10, -10, W + 20, H + 20);
    const grd = cx.createLinearGradient(0, gy - 40, 0, H); grd.addColorStop(0, 'rgba(30,20,10,0)'); grd.addColorStop(1, 'rgba(30,20,10,.9)'); cx.fillStyle = grd; cx.fillRect(-10, gy - 40, W + 20, H);
    cx.strokeStyle = 'rgba(253,230,138,.18)'; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(W / 2, gy + 2, W * 0.3, 10 * k, 0, 0, 7); cx.stroke();   // 비무대 테두리
    const tw = fin >= 0 && r.log[fin] ? r.log[fin][1] : 1;
    if (fz) { const zx = pos[tw], zy = gy - 50 * k, zz = 1 + fz; cx.translate(zx, zy); cx.scale(zz, zz); cx.translate(-zx, -zy); }
    for (const side of [0, 1]) {
      const a = Math.max(0, 1 - (vt - atk[side]) / 260), lunge = a > 0 ? Math.sin((1 - a) * Math.PI) : 0;
      const ha = Math.max(0, 1 - (vt - hurt[side]) / 180), dead = done && ((side === 0 && !r.win) || (side === 1 && r.win));
      const x = pos[side] + (side ? -1 : 1) * lunge * 26 * k - (side ? -1 : 1) * ha * 5 * k;
      cx.save(); if (dead) cx.globalAlpha = 0.45; else if (ha > 0.6 && !low) cx.filter = 'brightness(1.8) saturate(0.5)';
      cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(x, gy + 2, 22 * k, 5 * k, 0, 0, 7); cx.fill();
      drawHero(cx, x, gy + (dead ? 4 * k : 0), side ? r.opp.job : me.job, side ? r.opp.lv : me.lv, { t: vt / 1000, scale: 1.25 * k, eq: side ? opEq : myEq, flip: side === 1, lunge: lunge * 0.8 });
      cx.restore();
    }
    if (!low) drawImpacts(cx, (x, y) => [x, y], k, vt, imps);
    // 피해 숫자
    for (let j = floats.length - 1; j >= 0; j--) {
      const f = floats[j], a = (vt - f.at) / 900; if (a > 1) { floats.splice(j, 1); continue; }
      const x = pos[f.who] + (f.who ? 1 : -1) * 6, y = gy - 120 * k - a * 40 * k, pop = a < 0.12 ? 1 + (0.12 - a) * 4 : 1;
      cx.save(); cx.globalAlpha = 1 - a * a; cx.font = `900 ${(f.big ? 22 : 16) * k * (f.crit ? 1.2 : 1) * pop}px system-ui`; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#000';
      cx.fillStyle = f.who ? (f.crit ? '#fde047' : '#fff') : '#fca5a5'; const s2 = unit(f.d); cx.strokeText(s2, x, y); cx.fillText(s2, x, y); cx.restore();
    }
    cx.restore();
    const fa = (vt - flashT) / 140; if (!low && fa >= 0 && fa < 1) { cx.fillStyle = `rgba(255,248,225,${(1 - fa) * 0.45})`; cx.fillRect(0, 0, W, H); }   // 막타 번쩍
    if (phase === 'final') { cx.fillStyle = 'rgba(0,0,0,.28)'; cx.fillRect(0, 0, W, 22 * k); cx.fillRect(0, H - 22 * k, W, 22 * k); }   // 느린 막타 — 위아래 검은 띠
    for (const side of [0, 1]) { const rr = Math.max(0, left[side] / hp[side]); bars[side].style.width = trails[side].style.width = `${rr * 100}%`; txt[side].textContent = `${unit(Math.max(0, left[side]))} / ${unit(hp[side])}`; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// v538 업적 달성 — 맨 위 가운데 금빛 띠(트로피 · 이름) · 소리. 결과 창 · 뽑기 · 대결 화면이 떠 있으면 닫힌 뒤에, 여럿이면 차례로(결과 창 단추를 가렸다)
const achQ = []; let achBusy = false, achWait = 0;
function achFx(a) {
  if (!a) return;
  addLog(`업적 달성 — ${a.name}`);
  achQ.push(a); if (achQ.length > 3) achQ.shift();
  setTimeout(achPump, 250);   // 같은 순간에 뜨는 뽑기 · 결과 화면이 먼저 자리 잡게
}
function achPump() {
  if (achBusy || !achQ.length) return;
  if ($('res').classList.contains('open') || document.querySelector('.gx, .duel') || document.body.classList.contains('bossing')) { if (!achWait) achWait = setTimeout(() => { achWait = 0; achPump(); }, 400); return; }
  const a = achQ.shift(), ms = achQ.length ? 1500 : 2600; achBusy = true;
  const d = document.createElement('div'); d.className = 'achpop'; d.style.animationDuration = `${ms}ms`;
  d.innerHTML = `<i>🏆</i><div><small>업적 달성!</small><b>${esc(a.name)}</b><span>임무 → 업적에서 받기</span></div>`;
  document.body.append(d); play('rare', 4);
  setTimeout(() => { d.remove(); achBusy = false; achPump(); }, ms);
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
// v6xx 월드보스 위 띠 — 넣은 피해가 굴러 올라가는 큰 수 · 90초 시계 고리(싸움의 제한 시간) · 약점이면 빛남
const wbHudSt = { on: false, shown: 0, raf: 0 };
function wbHud(on) {
  const H = $('contest-hud'); H.classList.toggle('wbf', on);
  if (!on) { wbHudSt.on = false; return; }
  if (!document.querySelector('#wb-ring')) {
    const ring = document.createElement('div'); ring.id = 'wb-ring'; ring.className = 'wb-ring';
    ring.innerHTML = '<svg viewBox="0 0 40 40"><circle class="wb-rbg" cx="20" cy="20" r="17"/><circle class="wb-rfg" cx="20" cy="20" r="17" pathLength="100"/></svg><b>90</b>';
    const dm = document.createElement('div'); dm.id = 'wb-dmg'; dm.className = 'wb-dmg'; dm.innerHTML = '<small>넣은 피해</small><b>0</b>';
    H.prepend(ring); H.querySelector('.ch-h').after(dm);
  }
  if (!wbHudSt.on) { wbHudSt.on = true; wbHudSt.shown = 0; cancelAnimationFrame(wbHudSt.raf); wbHudSt.raf = requestAnimationFrame(wbHudTick); }
}
function wbHudTick() {
  const d = g?.dg; if (!wbHudSt.on || !d || d.type !== 'wboss') { wbHudSt.on = false; return; }
  const F = d.F, dmg = Math.round(F.dmgOut * WBF.sideX), lim = d.limitMs || F.limitMs || WBOSS.fightMs, left = Math.max(0, lim - F.t);
  const S = wbHudSt; S.shown = opt.gfx === 'low' ? dmg : S.shown + Math.max(1, (dmg - S.shown) * 0.18); if (S.shown > dmg) S.shown = dmg;
  const ring = document.querySelector('#wb-ring'), dm = document.querySelector('#wb-dmg');
  if (ring && dm) {
    ring.querySelector('.wb-rfg').style.strokeDashoffset = String(100 - (left / lim) * 100);
    ring.querySelector('b').textContent = String(Math.ceil(left / 1000)); ring.classList.toggle('late', left < 10000);
    dm.querySelector('b').textContent = unit(Math.round(S.shown)); dm.classList.toggle('weak', !!F.wbW);
  }
  S.raf = requestAnimationFrame(wbHudTick);
}
// 전직 이름 — 무리마다 차수 이름(화면에만 쓰는 이름)
const JB_TITLE = { sword: ['검사', '검협', '검호', '검성', '검신'], spear: ['창객', '창협', '창호', '창성', '창신'], fist: ['권객', '권협', '권호', '권성', '권신'], bow: ['궁객', '궁협', '궁호', '신궁', '궁신'], mage: ['방사', '도사', '진인', '선인', '천존'] };
const jbTitle = (job, n) => (JB_TITLE[job] || [])[n - 1] || `${n}차`;
// 전직 순간 — 화면 가득 「n차 전직 — 이름」 + 빛 터짐(1.6초 · 누르면 바로 닫힘 · 낮은 그래픽은 움직임 없이)
function jbBanner(n) {
  for (const o of document.querySelectorAll('.jb-ban')) o.remove();
  const d = document.createElement('div'); d.className = `jb-ban${opt.gfx === 'low' ? ' jb-low' : ''}`;
  d.innerHTML = `<i class="jb-burst"></i><small>JOB ADVANCE</small><b>${n}차 전직 — ${esc(jbTitle(g.S.hero.job, n))}</b><span>${esc(JOBS[g.S.hero.job].name)} · 공격 · 체력 +${JOB_ADV[n].atkP / 10}% · 새 무공이 열렸어요</span>`;
  const off = () => d.remove(); d.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); }; d.onclick = (e) => { e.preventDefault(); e.stopPropagation(); off(); }; $('battle').append(d);   // 누른 손이 아래 결과 창 단추로 새지 않게(누름은 막고 뗄 때 닫기) setTimeout(off, 1600); buzz([30, 40, 60]);
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
  // v6xx 월드보스 결과 카드 — 붉은 판 · 보스 그림 · 넣은 피해 큰 수 · 점수 · 이번 주 서열(알면) · 받는 것(패스 점수 · 공동 토벌 몫 · 주간 보상 예상)
  const R = $('res'), auto = opt.autoNext; play('clear');
  const rkKey = `wb:${wkStr(Date.now())}`, rkOf = () => rankCache[rkKey]?.r?.me || 0;
  const rkTxt = () => { const rk = rkOf(); return rk ? `${rk}위 · 주간 보상 뽑기권 ${g.wbRankReward(rk)}` : net.online ? '불러오는 중…' : '오프라인 — 주간 보상 적어도 뽑기권 ' + WEEK_REW.wb.at(-1)[1]; };
  R.className = 'open win wbr';
  R.innerHTML = `<div class="rp wb-res"><div class="wb-rsky"></div><img class="wb-rart" src="art/s2/chb/wb1.webp" alt="${esc(WBF.name)}">
      <div class="wb-rbody"><div class="rsub">월드보스 · ${esc(WBF.name)}</div>
      <div class="rtitle">${f.gaveUp ? '물러났어요' : 'WORLD BOSS'}</div>
      <div class="wb-rdmg"><small>넣은 피해</small><b data-n="${f.dmg}">0</b></div>
      <div class="wb-rgrid"><div><small>보스 점수</small><b>${unit(f.score)}</b></div><div><small>한 번 최고</small><b>${fmt(f.best)}</b></div><div><small>이번 주 합</small><b>${fmt(f.total)}</b></div><div><small>싸운 시간</small><b>${(f.ms / 1000).toFixed(0)}초${f.deaths ? ` · 쓰러짐 ${f.deaths}` : ''}</b></div></div>
      <div class="wb-rrew"><span>강호 패스 <b>+${PASS_PTS.wboss}</b></span><span>공동 토벌 <b>+${unit(f.score)}</b></span><span>이번 주 서열 <b id="wb-rrk">${rkTxt()}</b></span></div>
      ${f.score >= f.best && f.score > 0 ? '<div class="rnew">이번 주 최고 기록!</div>' : ''}
      <div class="racts"><button class="btn primary rgo" id="rout"><span>사냥터로</span><i class="rbar"></i></button></div>
      <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div></div>`;
  const t0 = now(), b = R.querySelector('.wb-rdmg b'), n = f.dmg;
  const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - 250) / 1100)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick();
  if (net.online) { delete rankCache[rkKey]; setTimeout(() => rankLoad('wb').then(() => { const e = document.querySelector('#wb-rrk'); if (e) e.textContent = rkTxt(); }).catch(() => { const e = document.querySelector('#wb-rrk'); if (e) e.textContent = '불러오지 못했어요'; }), 1500); }   // 점수가 서버에 올라간 뒤에 센다
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
  const chestCan = f.type === 'tower' && win && f.chest && g.towerMsState().find((m) => m.floor === f.chest)?.state === 'can';
  const extra = f.type === 'tower' && win ? `<div class="rnew">무한의 탑 ${f.floor}층 돌파 — 영구 보너스</div>${f.chest ? `<div class="rnew">${f.chest}층 상자${chestCan ? '' : ' — 받았어요'}</div>` : ''}` : f.type === 'job' && win ? `<div class="rnew">${f.n}차 전직!</div>` : '';
  R.className = `open ${win ? 'win' : 'lose'}`;
  R.innerHTML = `<div class="rp">${win ? '<div class="rays"></div>' : ''}
      <div class="rsub">${esc(f.title)}</div>
      <div class="rtitle">${win ? 'DUNGEON CLEAR' : f.gaveUp ? '나왔어요' : '던전 실패'}</div>
      <div class="rmeta"><span>걸린 시간 <b>${(f.ms / 1000).toFixed(1)}초</b></span><span>처치 <b>${f.kills}</b></span>${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
      ${win ? `${extra}<div class="rtiles">${tiles}</div>` : `<div class="rtip">${f.gaveUp ? '입장권은 이미 썼어요.' : '전투력을 올리고 다시 — 장비 강화 · 무공 · 동료'}</div>`}
      <div class="racts">${win ? '' : '<button class="btn" id="rgrow">강해지기</button>'}${chestCan ? '<button class="btn" id="rchest">상자 받기</button>' : ''}<button class="btn primary rgo" id="rout"><span>사냥터로</span><i class="rbar"></i></button></div>
      <label class="rauto"><input type="checkbox" id="rautochk" ${auto ? 'checked' : ''}> 3초 뒤 자동 진행</label></div>`;
  const t0 = now();
  for (const b of R.querySelectorAll('.rt b')) { const n = +b.dataset.n, d = parseFloat(b.parentNode.style.getPropertyValue('--d')) * 1000; const tick = () => { const a = Math.min(1, Math.max(0, (now() - t0 - d) / 500)); b.textContent = unit(Math.round(n * (1 - (1 - a) ** 3))); if (a < 1 && R.classList.contains('open')) requestAnimationFrame(tick); }; tick(); }
  const arm = (on) => { resTimer = on ? now() + RES_MS : 0; R.classList.toggle('timed', on); };
  arm(auto);
  $('rautochk').onchange = (e) => { opt.autoNext = e.target.checked; saveOpt(); arm(opt.autoNext); };
  $('rout').onclick = () => { play('click'); closeResult(); };
  if (!win) $('rgrow').onclick = () => { play('click'); closeResult(); openWin('char', 0); };
  if (chestCan) document.querySelector('#rchest').onclick = (e) => { const r = g.towerMsClaim(f.chest); if (r) { play('coin'); toast(`${f.chest}층 상자 — 뽑기권 ${r.give['ticket:gear']} · 강화석 ${r.give['item:stone']}${r.give['ticket:pal'] ? ' · 병기 · 동료 · 영물 뽑기권 1씩' : ''}`); save(); paintHud(); } e.currentTarget.disabled = true; e.currentTarget.textContent = '받았어요'; };
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
      <div class="rsub">${f.practice ? '두목 연습' : '장 두목 토벌'} · ${f.ch}장 ${esc(f.name)} · Lv ${f.lv}</div>
      <div class="rtitle">${win ? 'BOSS DEFEATED' : '토벌 실패'}</div>
      ${win ? `<div class="rdstars">${stars}</div>` : ''}
      <div class="rmeta"><span>걸린 시간 <b>${(f.ms / 1000).toFixed(1)}초</b></span>${win ? `<span>최고 <b>${(f.best / 1000).toFixed(1)}초</b>${f.best === f.ms ? ' <em class="rdnew">새 기록</em>' : ''}</span>` : `<span>두목 남은 체력 <b>${f.bossLeft}%</b></span>`}${f.deaths ? `<span>쓰러짐 <b>${f.deaths}</b></span>` : ''}</div>
      ${f.practice ? `<div class="rtip">연습이라 보상 · 기록은 없어요${f.perfects ? ` · 완벽 회피 ${f.perfects}번` : ''}</div>` : win ? `${f.newStars ? `<div class="rnew">새 별 ${f.newStars}개 — 별 보상</div>` : ''}<div class="rtiles">${tiles}</div>` : '<div class="rtip">토벌은 지금 칸 강함으로 나와요 — 전투력을 올리고 다시</div>'}
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
// v614 첫 화면 — 게임 이름 · 한 줄 소개 · 큰 무인 그림 · 역할 꼬리표 · 「추천」 하나(궁사: 다섯 직업 체력 · 방어는 같고 사거리가 가장 길어, 처음 30분 쓰러짐이 가장 적은 쪽)
const JOB_INFO = {
  sword: ['곧은 검으로 앞의 적을 벤다', '근접 · 고르게 센 기본형', '근접 · 균형'],
  spear: ['긴 창으로 멀찍이 찌르고 쓸어낸다', '근접 · 사거리 길고 여럿을 친다', '근접 · 여럿 베기'],
  fist: ['맨주먹 연타로 몰아친다', '근접 · 가장 빠른 연타', '근접 · 연타'],
  bow: ['멀리서 화살을 쏜다', '원거리 · 안전하게 먼저 친다', '원거리 · 선공'],
  mage: ['지팡이로 기운을 날린다', '원거리 · 넓은 무공', '원거리 · 광역'],
};
const JOB_REC = 'bow';
const STAT_KO = { str: '힘', agi: '민첩', ene: '기운' };
function pickJob() {
  const cards = Object.entries(JOBS).map(([k, j]) => `<button class="btn jobcard${k === JOB_REC ? ' rec' : ''}" data-job="${k}">${k === JOB_REC ? '<i class="jrec">추천</i>' : ''}<canvas width="160" height="200"></canvas><b>${j.name}</b><span class="jtag">${JOB_INFO[k]?.[2] || ''}</span><small>${JOB_INFO[k]?.[0] || ''}</small><em>주 능력치 ${STAT_KO[j.main] || j.main}</em></button>`).join('');
  pop(document.title || '무인 고르기', `<p class="jp-lead">무인 하나를 골라 강호로 — 싸움은 저절로, 키우기만 하면 돼요</p><div class="jobgrid">${cards}</div><p class="note jp-note">직업은 고른 뒤 바꿀 수 없어요(「설정 → 새로 시작」은 진행을 지워요) · 다른 기기 진행은 <a href="#" id="pj-g" class="pj-g">Google로 이어하기</a></p>`, []);
  const sh = $('modal').querySelector('.sheet'); sh.classList.add('wide', 'jobpick'); $('modal').classList.add('first');
  for (const b of sh.querySelectorAll('.jobcard')) b.onclick = () => { play('click'); closeModal(); sh.classList.remove('wide', 'enhs', 'jobpick'); start(b.dataset.job); };
  const pg = sh.querySelector('#pj-g');
  if (pg) pg.onclick = async (e) => { e.preventDefault(); play('click'); try { await net.init(); if (!net.online) { toast('인터넷에 연결되면 다시 눌러 주세요'); return; } const d = await net.switchTo(null); if (d) applyCloud(d); else toast('그 계정에는 새 시즌 진행이 없어요 — 무인을 골라 시작하세요(그 계정에 저장돼요)'); } catch (err) { toast(err?.code === 'auth/popup-closed-by-user' ? '취소했어요' : (err?.message || '이어하지 못했어요')); } };
  const t0 = now();
  const paint = () => {
    if (!sh.querySelector('.jobcard')) return;
    for (const b of sh.querySelectorAll('.jobcard')) { const c = b.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, 160, 200); drawHero(x, 80, 194, b.dataset.job, 1, { t: (now() - t0) / 1000, scale: 2.05 }); }
    if (now() - t0 < 60000) requestAnimationFrame(paint);   // 그림이 늦게 오면 받는 대로 · 숨 쉬는 움직임
  };
  paint();
}
// v614 첫 판 길 안내 — 무인을 고른 바로 그 판에 세 걸음(들판 · 길잡이 · 장비). 어둡게 깔고 그 자리만 구멍(box-shadow) · 말풍선 · 「다음」/「건너뛰기」 · 밝힌 곳을 눌러도 다음.
//   끝내거나 건너뛰면 이 기기에 적어(ifu.s2.coach = done) 다시 안 띄운다. 이미 하던 세이브(Lv 2 이상 · 처치 1 이상)로 열면 보이지 않고 끝낸 것으로.
//   자동 시험(webdriver)에서는 window.__s2coach 가 켜져 있을 때만(다른 시험 흐름을 막지 않게)
const COACH_KEY = 'ifu.s2.coach';
let firstRun = false, coachStep = -1;
const coachDone = () => { try { return localStorage.getItem(COACH_KEY) === 'done'; } catch { return true; } };
const coachMark = () => { try { localStorage.setItem(COACH_KEY, 'done'); } catch { /* 저장 못 해도 이 판에선 끝 */ } };
const COACH = [
  { t: '싸움은 저절로 — 지켜보기만 해도 강해져요', el: () => $('cv'), field: true },
  { t: '길잡이를 따라가면 보상', el: () => $('qc') },
  { t: '장비 뽑기로 전투력을 올려요', el: () => document.querySelector('#mb .nb[data-tab="bag"]') },
];
const coachAllowed = () => !navigator.webdriver || !!window.__s2coach;
function coachMaybe() {
  if (coachDone() || !coachAllowed()) return;
  if (!firstRun && (g.S.hero.lv > 1 || (g.S.kills || 0) > 0)) { coachMark(); return; }   // 이미 하던 세이브
  setTimeout(() => { if (coachStep < 0 && !coachDone() && $('modal').classList.contains('hidden') && !open) coachShow(0); }, 700);
}
// 화면 위 사각형 — 손전화를 세로로 들어 body가 90° 돌았으면 body 안 좌표로 바꾼다
function coachRect(st) {
  const el = st.el(); if (!el || !el.offsetHeight) return null;
  let r = el.getBoundingClientRect();
  if (st.field) {   // 들판 — 무인이 서 있는 곳(가로 20~80%는 늘 무인이 있는 띠) · 위 진행 줄 아래부터 발밑까지
    const tc = $('tc').getBoundingClientRect(), cam = window.__cam, hy = r.top + (cam ? cam[3] : r.height * 0.75);
    const top = Math.max(tc.bottom + 8, hy - 150), bot = Math.max(top + 60, Math.min(r.bottom - 8, hy + 16));
    r = { left: r.left + r.width * 0.2, top, right: r.right - r.width * 0.2, bottom: bot };
  }
  const B = document.body;
  if (B.classList.contains('rot')) { const hb = B.offsetHeight; r = { left: r.top, top: hb - r.right, right: r.bottom, bottom: hb - r.left }; }
  return { l: r.left, t: r.top, w: r.right - r.left, h: r.bottom - r.top };
}
function coachShow(i) {
  let box = document.querySelector('#coach');
  while (i < COACH.length && !coachRect(COACH[i])) i++;   // 숨은 것(길잡이 다 끝냄 등)은 건너뜀
  if (i >= COACH.length) { coachEnd(); return; }
  coachStep = i;
  if (!box) {
    box = document.createElement('div'); box.id = 'coach';
    box.innerHTML = '<div class="co-hole"></div><div class="co-bub"><span class="co-n"></span><p class="co-t"></p><div class="co-acts"><button class="btn co-skip">건너뛰기</button><button class="btn primary co-next">다음</button></div></div>';
    document.body.append(box);
    box.querySelector('.co-next').onclick = (e) => { e.stopPropagation(); play('click'); coachShow(coachStep + 1); };
    box.querySelector('.co-skip').onclick = (e) => { e.stopPropagation(); play('click'); coachEnd(); };
    box.addEventListener('click', (e) => {   // 밝힌 곳을 누르면 다음 · 어두운 곳은 그냥 막는다
      if (e.target.closest('.co-bub')) return;
      const r = box.querySelector('.co-hole').getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { play('click'); coachShow(coachStep + 1); }
    });
    addEventListener('resize', coachPlace);
  }
  box.querySelector('.co-n').textContent = `${i + 1} / ${COACH.length}`;
  box.querySelector('.co-t').textContent = COACH[i].t;
  box.dataset.step = String(i + 1);
  coachPlace();
  clearInterval(coachShow.iv); if (COACH[i].field) coachShow.iv = setInterval(coachPlace, 400);   // 무인이 발판을 오르내리면 따라감
}
function coachPlace() {
  const box = document.querySelector('#coach'); if (!box || coachStep < 0) return;
  const r = coachRect(COACH[coachStep]); if (!r) return;
  const pad = 6, h = box.querySelector('.co-hole'), b = box.querySelector('.co-bub');
  const H = { l: r.l - pad, t: r.t - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  Object.assign(h.style, { left: `${H.l}px`, top: `${H.t}px`, width: `${H.w}px`, height: `${H.h}px` });
  const VW = box.clientWidth, VH = box.clientHeight, bw = b.offsetWidth, bh = b.offsetHeight, gap = 10;
  let x, y;
  if (COACH[coachStep].field && H.t >= bh + gap + 8) { y = H.t - bh - gap; x = H.l + H.w / 2 - bw / 2; }   // 들판 — 구멍 위(무인이 가려지지 않게)
  else if (COACH[coachStep].field) { const cam = window.__cam, hx = (cam ? cam[2] : 0) + ($('cv').getBoundingClientRect().left); x = hx < H.l + H.w / 2 ? H.l + H.w - bw - 8 : H.l + 8; y = H.t + 8; }   // 위에 자리가 없으면 구멍 안 위쪽 — 무인 반대편
  else if (VH - (H.t + H.h) >= bh + gap + 8) { y = H.t + H.h + gap; x = H.l + H.w / 2 - bw / 2; }   // 아래
  else if (H.t >= bh + gap + 8) { y = H.t - bh - gap; x = H.l + H.w / 2 - bw / 2; }   // 위
  else if (VW - (H.l + H.w) >= bw + gap + 8) { x = H.l + H.w + gap; y = H.t + H.h / 2 - bh / 2; }   // 오른쪽
  else { x = H.l - bw - gap; y = H.t + H.h / 2 - bh / 2; }   // 왼쪽
  b.style.left = `${Math.round(Math.max(8, Math.min(VW - bw - 8, x)))}px`; b.style.top = `${Math.round(Math.max(8, Math.min(VH - bh - 8, y)))}px`;
}
function coachEnd() { clearInterval(coachShow.iv); coachStep = -1; coachMark(); document.querySelector('#coach')?.remove(); removeEventListener('resize', coachPlace); }
// v614 처음 몇 걸음(길잡이 1~5) — 20초 동안 아무것도 안 누르면 길잡이 칸이 살짝 빛난다(20초마다). 절전 · 두목전 · 던전 · 창 · 알림 · 그래픽 낮음이면 안 함
const NUDGE_MS = 20000;
let nudgeAt = 0;
function nudgeTick() {
  const qc = $('qc');
  if (!g || coachStep >= 0 || opt.gfx === 'low' || saverOn || g.bossFight || g.dg || open || !$('modal').classList.contains('hidden') || qc.classList.contains('hidden')) return false;
  const cur = guideCurrent(g.S.q.guide), i = cur ? GUIDE.indexOf(cur) : -1;
  if (i < 0 || i >= 5) return false;
  const t = Date.now(); if (t - lastInput < NUDGE_MS || t - nudgeAt < NUDGE_MS) return false;
  nudgeAt = t; qc.classList.remove('nudge'); void qc.offsetWidth; qc.classList.add('nudge');
  setTimeout(() => qc.classList.remove('nudge'), 2600);
  return true;
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
// 돌아왔을 때 카드(ret-) — 비운 시간 · 얻은 것을 크게 세어 올림(0.8초 · 누르면 바로) · 무인이 칼을 들어 올림. 그래픽 낮음이면 움직임 없이
let retAg = { ...agSum };   // 자리를 비울 때(앱이 뒤로 갈 때)의 자동 성장 합 — 돌아와서 그 뒤로 한 일만 보인다
const hmm = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
function agLine(base) {
  if (!opt.autoGrow) return '';
  const d = (k) => Math.max(0, (agSum[k] || 0) - (base?.[k] || 0));
  return [d('pull') && `뽑기 ${d('pull')}`, d('enh') && `강화 +${d('enh')}`, d('kit') && `무공 +${d('kit')}`, d('claim') && `보상 ${d('claim')}`, d('daily') && `하루 일 ${d('daily')}`].filter(Boolean).join(' · ');
}
function lvGain(exp) {   // 받으면 오를 레벨(경험치 덤까지 — 엔진 addExp와 같은 셈)
  const st = g.fighter().st, n = Math.floor(Math.round(exp * (1000 + (st.expP || 0)) / 1000));
  let lv = g.S.hero.lv, e = g.S.hero.exp + n, ups = 0;
  while (lv < LEVEL_MAX && e >= expToNext(lv)) { e -= expToNext(lv); lv++; ups++; }
  return ups;
}
// rows: [[그림, 이름, 수, 앞글자]] — 0인 것은 빼고 보인다
function retCard(title, o, acts) {
  const rows = o.rows.filter((r) => r[2] > 0);
  const tile = ([ic, name, n, pre = '+']) => `<div class="ret-i"><img alt="" src="art/s2/ui/${ic}.webp"><b class="ret-n" data-n="${n}" data-p="${pre}">${pre}${opt.gfx === 'low' ? unit(n) : 0}</b><small>${name}</small></div>`;
  pop(title, `<div class="ret${o.small ? ' ret-s' : ''}"><canvas class="ret-hero" aria-hidden="true"></canvas><div class="ret-m"><div class="ret-t"><img alt="" src="art/s2/ui/time.webp"><b>${hmm(o.ms)}</b><span>${o.sub}</span></div>${o.bar != null ? `<div class="ret-bar"><i style="width:${o.bar}%"></i></div>` : ''}<div class="ret-g">${rows.map(tile).join('')}</div>${o.ag ? `<div class="ret-ag"><img alt="" src="art/s2/ui/auto.webp"><b>자동 성장</b><span>${o.ag}</span></div>` : ''}${o.note ? `<p class="ret-note">${o.note}</p>` : ''}</div></div>`, acts);
  const sh = $('modal').querySelector('.sheet'), box = sh.querySelector('.ret');
  sh.classList.add('rets'); sh.classList.toggle('retsm', !!o.small); box.classList.toggle('ret-still', opt.gfx === 'low');
  retHero(box.querySelector('.ret-hero'), o.small);
  retCount(box);
}
function retCount(box) {
  const els = [...box.querySelectorAll('.ret-n')];
  const fin = () => { stop = true; for (const e of els) e.textContent = e.dataset.p + unit(+e.dataset.n); box.classList.add('ret-done'); };
  let stop = false;
  if (opt.gfx === 'low' || !els.length) return fin();
  const t0 = performance.now(), D = 800;
  const step = (t) => {
    if (stop || !box.isConnected) return;
    const a = Math.min(1, (t - t0) / D), e = 1 - (1 - a) ** 3;
    for (const el of els) el.textContent = el.dataset.p + unit(Math.round(+el.dataset.n * e));
    if (a < 1) requestAnimationFrame(step); else fin();
  };
  requestAnimationFrame(step);
  box.addEventListener('pointerdown', fin, { once: true });   // 누르면 바로 다 보임
}
function retHero(cv, small) {
  const D = Math.min(2, pxr()), w = small ? 84 : 110, h = small ? 100 : 132, x = cv.getContext('2d');
  cv.width = w * D; cv.height = h * D; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const job = g.S.hero.job, lv = g.S.hero.lv, eq = g.lookEq(), to = POSES[job === 'fist' ? '올려치기' : '검거양'], t0 = performance.now(), low = opt.gfx === 'low';
  const paint = (t) => {
    const s = (t - t0) / 1000, k = low ? 1 : Math.min(1, s / 0.45), pose = mixPose(POSES.기모으기, to, 1 - (1 - k) ** 3);
    if (k >= 1 && !low) pose.lift += Math.sin(s * 3) * 1.6;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(D, 0, 0, D, 0, 0);
    const gr = x.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, w * 0.62); gr.addColorStop(0, `rgba(232,194,106,${0.42 * k})`); gr.addColorStop(1, 'rgba(232,194,106,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    if (!low) for (let i = 0; i < 5; i++) { const a = (s * 0.9 + i / 5) % 1, px = w / 2 + Math.sin(i * 2.4) * w * 0.34, py = h * 0.8 - a * h * 0.6; x.globalAlpha = Math.sin(a * Math.PI) * 0.8; x.fillStyle = '#ffe6a0'; x.beginPath(); x.arc(px, py, 1.6, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    drawHero(x, w / 2, h - 6, job, lv, { t: s, scale: small ? 0.88 : 1.12, eq, pose });
  };
  if (low) { paint(t0); setTimeout(() => cv.isConnected && paint(t0), 400); return; }   // 그림이 늦게 오면 한 번 더
  const loop = (t) => { if (!cv.isConnected || $('modal').classList.contains('hidden')) return; paint(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function returnQueue() {
  const p = g.returnCheck(now());
  const q = buildQueue([...(p ? [{ kind: 'offline', p }] : [])]);
  if (!q.length && g.canAttend() && !firstRun) setTimeout(() => attendPop(), 600);   // v536 방치 보상이 없으면 바로 출석 · v616 무인을 막 고른 판은 띄우지 않음(임무 → 출석 · 빨간 점으로)
  if (p && opt.autoGrow && !g.bossFight && !g.dg && !open && now() - (frame.ag || 0) > 60000) agRun(now());   // 돌아오자마자 자동 성장 한 번 — 카드에 함께 보인다
  for (const it of q) if (it.kind === 'offline') {
    const p2 = it.p;
    retCard('돌아오셨군요', { ms: p2.ms, sub: `동안 홀로 사냥했어요${p2.capped ? ' · 최대 12시간' : ''}`, bar: Math.min(100, (p2.ms / (12 * 3600000)) * 100),
      rows: [['silver', '은자', p2.gold], ['mastery', '경험치', p2.exp], ['realm', '레벨', lvGain(p2.exp)], ['atk', '처치', p2.kills]],
      ag: agLine(retAg), note: '광고를 보면 두 배(하루 정해진 횟수)' },
    [['받기', () => { g.claimOffline(false); save(); if (g.canAttend()) setTimeout(() => attendPop(), 350); }], ['광고 보고 ×2', () => { const r = g.claimOffline(true); toast(r?.x === 2 ? '×2 받음' : '오늘 광고 ×2는 다 썼어요'); save(); if (g.canAttend()) setTimeout(() => attendPop(), 350); }]]);
    retAg = { ...agSum };
  }
}
// v560 업데이트 소식 — 들어올 때 다른 창(방치 보상 · 출석)이 다 닫힌 뒤 한 번 · 설정에서 다시
function newsPop(list = NEWS.slice(0, 8), all = false) {
  if (!list.length) return;
  pop(all ? '업데이트 소식' : '새로 생긴 것', `<div class="news">${list.map((n) => `<div class="news-i"><b>${esc(n.title)}</b>${n.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`).join('')}</div>`);
}
function newsCheck() {
  if (!g) return;
  const list = newsSince(g.S.newsV ?? 0);
  if (!list.length) { g.S.newsV = NEWS_V; return; }
  const t0 = now(), iv = setInterval(() => {
    const busy = !$('modal').classList.contains('hidden') || document.querySelector('.gx, .duel') || $('res').classList.contains('open');
    if (busy && now() - t0 < 120000) return;
    clearInterval(iv); if (busy) return;
    g.S.newsV = NEWS_V; save(); newsPop(list.slice(0, 8));
  }, 800);
}
function boot() {
  closeModal();
  setTimeout(() => net.init(), 1500);   // v525 계정 연결은 화면이 뜬 뒤
  paintNav(); paintHud();
  returnQueue();
  setTimeout(newsCheck, 1500);   // v560
  inviteCheck();   // v596
  coachMaybe();   // v614 첫 판 길 안내
  setInterval(nudgeTick, 1000);   // v614 길잡이 살짝 빛남
  wakeSync();   // v586 화면 켜 두기
  last = now(); lastMin = now();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!g) return; if (document.hidden) { save(); cloudPush(true); retAg = { ...agSum }; } else { returnQueue(); last = now(); } });
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
  D.toggle('w800', ew <= 800); D.toggle('w720', ew <= 720); D.toggle('w640up', ew >= 640); D.toggle('h500', eh <= 500); D.toggle('h420', eh <= 420); D.toggle('h340', eh <= 340);
}
addEventListener('resize', fitLand); addEventListener('orientationchange', () => setTimeout(fitLand, 120));
fitLand();
// v519 전체 화면 — 손전화는 첫 터치에 저절로(주소창이 사라져 가로 화면이 더 넓다) · 가로 잠금은 전체 화면이어야 되는 브라우저가 많다
function goFull(on) {
  try {
    if (pcFramed) { window.parent.postMessage({ ifu: 'full', on: !!on }, location.origin); return; }   // v629 틀 안: 틀 바깥(pc.html)을 전체 화면으로
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
window.__s2 = { get g() { return g; }, lowGfx: () => opt.gfx === 'low', dgIv: () => dgIv, ptRaf: () => ptRaf, followers: () => ({ ...followerN }), agTest: () => { frame.ag = 0; }, saverStart, saverOff, saverOn: () => saverOn, saverAge: (ms) => { if (saverFrom) saverFrom.at -= ms; }, saverSum: () => saverSum, retTest: (ms) => { const O = g.S.offline; O.lastSeen -= ms; O.clockMax -= ms; returnQueue(); }, impacts: () => impacts.length, motion: () => ({ hurt: heroHurtAt, down: heroDownAt, run: runMix, anim: heroAnim.active }), inviteTest: (c) => { inviteCode = c; inviteCheck(); }, shareGame, shareLast: () => shareLast, saverAutoTest: (on) => { saverAuto = !!on; }, wake: () => ({ lock: !!wakeLock, want: wakeWant, ok: wakeOK() }), wakeSync, wakeOpt: (on) => { opt.wake = !!on; return wakeSync(); }, saverTest: () => { saverForce = true; lastInput = -1e9; }, newsCheck, coachStep: () => coachStep, coachRect: () => (coachStep >= 0 ? coachRect(COACH[coachStep]) : null), nudgeTest: () => { lastInput = -1e9; nudgeAt = 0; return nudgeTick(); }, guildState, guildLoad, chatSend, worldSend, worldMsgs: () => worldState.msgs.map((m) => ({ uid: m.uid, nick: m.nick, text: m.text, lv: m.lv, job: m.job })), worldOn: () => !!worldState.unsub, worldReset: () => { worldState.lastAt = 0; worldState.lastText = ''; }, save, dayKey, attendPop, freeze: () => { frozen = true; }, net, cloudPush, rankPush, wbPush, wkStr, pvpInbox, pvpFetch, resetNetTimers: () => { pvpAt = 0; inboxAt = 0; },
  // v525 팝업 대신 에뮬레이터용 가짜 Google 토큰으로 잇기 · 겹치면 그 계정으로
  linkTest: async (tok) => { const r = await net.linkGoogle(tok); if (r.conflict) { const d = await net.switchTo(r.cred); if (d) applyCloud(d); return 'switched'; } await cloudPush(true); return 'linked'; } };
Object.assign(window.__s2, { toast });   // v630 시험용 — 알림을 바로 띄워 결과 창 단추와 겹치는지 본다
