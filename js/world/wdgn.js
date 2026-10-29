// 던전 (v126) — 요일 던전 · 무한의 탑. 들판 엔진을 그대로 쓰는 '잠깐 들어가는 구역'이다.
// 설계: docs/바람식_개편.md 'v126'
//
// 요일 던전: 하루 종류마다 세 번(일요일은 셋 다 열린다). 75초 안에 몹 KILLS를 잡으면 그 단계를 깬다.
//   깬 단계는 '소탕'으로 바로 보상을 받는다(들어가지 않고 한 번 쓴다) — 방치형이라 매일 누르기만 해도 된다.
//   못 깨도 잡은 만큼 절반은 준다.
// 무한의 탑: 층마다 수문장 하나, 30초. 이기면 다음 층(자동으로 이어 오른다), 오른 층마다 공격력·체력이 영구히 오른다.
import { ZONES_W, ZONE_COUNT, MAPS, mapId, BOSS, mobHp, mobAtk, mobGold, expToNext } from './wdata.js';

// 한국 시간 하루 — 'YYYY-MM-DD'와 요일(0 일요일)
export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
export const kstWeekday = (now = Date.now()) => new Date(now + 9 * 3600e3).getUTCDay();
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export const DAILY_ENTRIES = 3;
export const DAILY_SEC = 75;
export const DAILY_KILLS = 40;           // 이만큼 잡으면 깬다
export const DAILY_ALIVE = 14;
export const DAILY_RESPAWN = 0.7;
export const DAILY_STAGES = 30;
export const DAILY_FAIL = 0.5;           // 못 깨면 잡은 만큼의 절반

export const DAILY = [
  { id: 'exp', name: '수련동', hanja: '修鍊洞', ico: '修', days: [1, 4], scene: 'relic', what: '경험치',
    desc: '옛 고수들의 수련 동굴. 쓰러뜨린 만큼 깨달음을 얻는다.' },
  { id: 'gold', name: '금광굴', hanja: '金鑛窟', ico: '金', days: [2, 5], scene: 'gold', what: '은자',
    desc: '흑도 무리가 숨겨 둔 금광. 은자가 쏟아진다.' },
  { id: 'mat', name: '천공광맥', hanja: '天工鑛脈', ico: '鑛', days: [3, 6], scene: 'stone', what: '재료 · 두목 증표',
    desc: '대장장이들이 탐내는 광맥. 그 단계 지역의 재료와 증표.' },
];
export const dailyOf = (id) => DAILY.find((d) => d.id === id) || null;
export const dailyOpen = (d, now = Date.now()) => kstWeekday(now) === 0 || d.days.includes(kstWeekday(now));
export const dailyDaysText = (d) => `${d.days.map((x) => DAY_NAMES[x]).join('·')}·일`;

// 단계 s의 몹 레벨 (1단계 5 … 30단계 150) · 들어갈 수 있는 레벨
export const dailyLv = (s) => Math.min(150, 5 * s);
export const dailyNeed = (s) => Math.max(1, dailyLv(s) - 5);
// 레벨 lv 몹이 사는 지역 (재료·몹 모습을 거기서 빌린다)
export function zoneForLv(lv) {
  let best = 1;
  for (let z = 1; z <= ZONE_COUNT; z++) if (ZONES_W[z].lv[0] <= lv) best = z;
  return best;
}
// 보상 — kind별. gap: 무인 레벨에 비해 너무 낮은 단계면 경험치가 깎인다(들판과 같은 식)
export function dailyReward(kind, s, gapMult = 1) {
  const lv = dailyLv(s);
  const z = zoneForLv(lv);
  // 한 판 ≈ 들판 10분~한 시간어치 (경험치 그 레벨 0.2 · 은자 몹 1000마리 · 재료 300 · 증표 8)
  if (kind === 'exp') return { exp: Math.round(expToNext(lv) * 0.2 * gapMult) };
  if (kind === 'gold') return { gold: Math.round(mobGold(lv) * 1000) };
  return { mats: { [z]: 300, [`b${z}`]: 8 } };
}
// 던전 구역 — 그 단계 지역의 들판 몹을 빌린다
export function dailyMap(kind, s) {
  const d = dailyOf(kind);
  const lv = dailyLv(s);
  const z = zoneForLv(lv);
  const src = MAPS.find((m) => m.id === mapId(z, 4));
  return { id: -1, inst: true, name: `${d.name} ${s}단계`, zoneName: d.name, zone: z, mz: z, area: 0, art: ZONES_W[z].art,
    lv: [lv, lv], mobs: src.mobs, boss: src.boss, scene: d.scene };
}

// 같은 레벨 무인의 두목 딜(초당) — 그 지역 장비 +6 유니크, 심법·스킬 다 찍은 다섯 직업 평균(시뮬로 잼).
// 몹 체력(mobHp)은 레벨에 곧게 오르지만 무인은 장비 사다리로 훨씬 빨리 세진다 — 던전 몹·탑 수문장은 이것에 맞춘다.
const REF = [[1, 100], [5, 147], [15, 923], [25, 1613], [40, 5042], [55, 9844], [70, 23199], [85, 56792], [100, 162450], [115, 355759], [130, 942378], [145, 2556818]];
export function refDps(lv) {
  if (lv >= 145) return REF[REF.length - 1][1] * 1.07 ** (lv - 145);
  let i = 0;
  while (REF[i + 1][0] < lv) i++;
  const [l0, d0] = REF[i], [l1, d1] = REF[i + 1];
  return Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * ((lv - l0) / (l1 - l0)));
}
// 던전 몹 하나 = 같은 레벨 무인이 1.2초 칠 체력 (초반은 광역 무공이 적어 덜 단단하게 — 레벨 5에 0.5초)
export const dailyHpSec = (lv) => 0.45 + 0.75 * Math.min(1, lv / 60);
export const dailyMobHp = (lv) => Math.max(mobHp(lv) * 0.7, refDps(lv) * dailyHpSec(lv));
export const dailyMobAtk = (lv) => mobAtk(lv) * 1.5;

// ---------- 무한의 탑 (v126: 120층 · 10층마다 십이지신) ----------
// 층마다 수문장 하나. 수문장은 바닥에 붉은 경고를 깔고 잠깐 뒤 크게 친다(최대 체력의 몇 할) — **직접 움직여 피해야 한다.**
// 자동 사냥은 피하지 않는다(조이스틱·화면 누르기로). 층이 오를수록 경고가 짧고, 자주, 아프다.
// 10층마다 십이지신이 지킨다 — 이기면 그 신의 '십이지 뽑기권' 셋(그 신수 탈것이 나온다, 셋째에는 꼭).
export const TOWER_MAX = 120;
export const TOWER_SEC = 35;
export const TOWER_ZODIAC_SEC = 50;
export const TOWER_BONUS = 0.005;        // 오른 층마다 공격력·체력 +0.5% (120층 +60%)
export const towerBonus = (floor) => Math.min(TOWER_MAX, floor || 0) * TOWER_BONUS;
export const isZodiacFloor = (f) => f % 10 === 0;
export const towerSec = (f) => (isZodiacFloor(f) ? TOWER_ZODIAC_SEC : TOWER_SEC);
// 층 f 수문장 레벨: 1층 3 … 120층 150
export const towerLv = (f) => Math.min(150, 2 + Math.round(f * 1.24));
export const towerPow = () => 1;
// 수문장 체력: 같은 레벨 무인이 16초 칠 만큼(피하느라 못 치는 시간을 셈해 넉넉히), 십이지신은 1.6배
export const TOWER_HIT_SEC = 16;
export const towerHp = (f) => Math.round(Math.max(mobHp(towerLv(f)) * BOSS.hp, refDps(towerLv(f)) * TOWER_HIT_SEC) * (isZodiacFloor(f) ? 1.6 : 1));
export const towerAtk = (f) => mobAtk(towerLv(f)) * BOSS.atk * 0.6;   // 붙어 치는 건 약하게 — 무서운 건 바닥 경고

// 십이지신 — 자축인묘진사오미신유술해. mount: 그 신수 탈것(wdata MOUNTS의 z1~z12), pat: 고유 초식
export const ZODIAC = [
  { no: 1, ji: '子', animal: '쥐', god: '자신 금서대왕', mount: 'z1', pat: ['rain', 'aim'], move: '천서난무 — 작은 불길이 비처럼' },
  { no: 2, ji: '丑', animal: '소', god: '축신 철우역사', mount: 'z2', pat: ['charge', 'nova'], move: '철우돌격 — 넓은 길을 들이받는다' },
  { no: 3, ji: '寅', animal: '범', god: '인신 백호장군', mount: 'z3', pat: ['nova', 'aim', 'line'], move: '백호포효 — 둘레를 찢는다' },
  { no: 4, ji: '卯', animal: '토끼', god: '묘신 옥토선녀', mount: 'z4', pat: ['chase', 'donut'], move: '월하도약 — 뛰는 자리를 쫓아온다' },
  { no: 5, ji: '辰', animal: '용', god: '진신 황룡천왕', mount: 'z5', pat: ['cross', 'aim', 'nova'], move: '황룡십자 — 가로세로를 가른다' },
  { no: 6, ji: '巳', animal: '뱀', god: '사신 청사요희', mount: 'z6', pat: ['star', 'donut'], move: '청사만독 — 세 갈래 독기' },
  { no: 7, ji: '午', animal: '말', god: '오신 천마도령', mount: 'z7', pat: ['twin', 'charge', 'aim'], move: '천마질주 — 나란히 달린다' },
  { no: 8, ji: '未', animal: '양', god: '미신 운양도사', mount: 'z8', pat: ['donut', 'rain', 'nova'], move: '운양진 — 품 안만 안전하다' },
  { no: 9, ji: '申', animal: '원숭이', god: '신신 금강대성', mount: 'z9', pat: ['rain', 'chase', 'cross'], move: '여의난타 — 사방에 몽둥이' },
  { no: 10, ji: '酉', animal: '닭', god: '유신 금계천녀', mount: 'z10', pat: ['xcross', 'cross', 'aim'], move: '금계팔방 — 여덟 갈래 빛' },
  { no: 11, ji: '戌', animal: '개', god: '술신 천구장군', mount: 'z11', pat: ['chase', 'star', 'nova'], move: '천구추혼 — 끝까지 쫓는다' },
  { no: 12, ji: '亥', animal: '돼지', god: '해신 흑저마왕', mount: 'z12', pat: ['nova', 'donut', 'rain', 'xcross'], move: '흑저멸천 — 판 전체가 무너진다' },
];
export const zodiacOf = (f) => (isZodiacFloor(f) ? ZODIAC[f / 10 - 1] || null : null);
// 보통 층의 초식 — 오를수록 하나씩 는다
const PAT_UNLOCK = [[1, 'aim'], [11, 'nova'], [21, 'line'], [31, 'donut'], [41, 'cross'], [51, 'chase'], [61, 'rain'], [71, 'star'], [81, 'xcross'], [91, 'twin']];
export function towerPatterns(f) {
  const z = zodiacOf(f);
  if (z) return z.pat;
  return PAT_UNLOCK.filter(([at]) => f >= at).map(([, p]) => p).slice(-4);
}
const k120 = (f) => Math.min(1, f / TOWER_MAX);
export const tellDelay = (f) => 1.6 - 0.55 * k120(f);              // 경고 → 터짐 (1.6초 → 1.05초)
export const castGap = (f) => (5.0 - 2.2 * k120(f)) * (isZodiacFloor(f) ? 0.85 : 1);   // 초식 사이 (5초 → 2.8초)
export const tellDmg = (f) => (0.5 + 0.3 * k120(f)) * (isZodiacFloor(f) ? 1.15 : 1);   // 맞으면 최대 체력의 몇 할 (두 대면 거의 쓰러진다)
export const TOWER_NO_POTION = true;   // 탑에서는 물약을 못 쓴다 — 피하는 수밖에
export const TELL_NAMES = { aim: '노림수', nova: '폭쇄', line: '일직선 참격', donut: '바깥 고리', cross: '십자참', chase: '추격', rain: '낙뢰우', star: '세 갈래', xcross: '팔방참', twin: '쌍선 돌격', charge: '돌진' };

// 수문장 — 보통 층은 지역 두목들을 돌려 쓰고, 10층마다 십이지신(그 짐승의 큰 모습)
export function towerBoss(f) {
  const zd = zodiacOf(f);
  if (zd) return { name: `${f}층 ${zd.god}`, beast: zd.mount, bscale: 1.6, zodiac: zd.no };
  const z = ((Math.ceil(f / 10) - 1) % ZONE_COUNT) + 1;
  const b = ZONES_W[z].boss;
  return { name: `${f}층 수문장 ${b.name}`, look: b.look };
}
// 처음 오른 층에만 주는 것 — 층마다 은자, 10층마다 재료·증표 보따리 + 그 신의 뽑기권 셋
export const ZODIAC_TICKETS = 3;
export function towerReward(f) {
  const lv = towerLv(f);
  const out = { gold: Math.round(mobGold(lv) * 30) };
  if (isZodiacFloor(f)) {
    const z = zoneForLv(lv);
    out.gold += Math.round(mobGold(lv) * 300);
    out.mats = { [z]: 150, [`b${z}`]: 5 };
    out.tickets = { [f / 10]: ZODIAC_TICKETS };
  }
  return out;
}
export function towerMap(f) {
  const z = zoneForLv(towerLv(f));
  return { id: -2, inst: true, name: `무한의 탑 ${f}층`, zoneName: '무한의 탑', zone: z, mz: z, area: 0, art: ZONES_W[z].art,
    lv: [towerLv(f), towerLv(f)], mobs: [], boss: towerBoss(f), scene: isZodiacFloor(f) ? 'raid' : 'trial', bossFirst: true };
}
// 십이지 뽑기 — 그 신수가 35%(이미 가졌으면 안 나온다), 셋째 뽑기까지 안 나오면 셋째에 꼭.
// 신수가 아니면 보통 탈것(10층에 3단 … 뒤로 갈수록 좋은 것)
export const ZODIAC_RATE = 0.35;
export const zodiacTopTier = (no) => Math.min(12, 2 + no);
// 경고 판정 — 무인 자리(x, y)가 이 경고 안인가 (들판 좌표 그대로, 그리는 쪽은 납작하게 그린다)
export function tellCovers(tl, x, y) {
  if (tl.kind === 'circle') return Math.hypot(x - tl.x, y - tl.y) <= tl.r;
  if (tl.kind === 'donut') { const d = Math.hypot(x - tl.x, y - tl.y); return d >= tl.r0 && d <= tl.r1; }
  if (tl.kind === 'line') {
    const dx = tl.x1 - tl.x0, dy = tl.y1 - tl.y0;
    const L2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((x - tl.x0) * dx + (y - tl.y0) * dy) / L2));
    return Math.hypot(x - (tl.x0 + dx * k), y - (tl.y0 + dy * k)) <= tl.w / 2;
  }
  return false;
}
