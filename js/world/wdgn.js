// 던전 (v126) — 요일 던전 · 무한의 탑. 들판 엔진을 그대로 쓰는 '잠깐 들어가는 구역'이다.
// 설계: docs/바람식_개편.md 'v126'
//
// 요일 던전: 하루 종류마다 세 번(일요일은 셋 다 열린다). 75초 안에 몹 KILLS를 잡으면 그 단계를 깬다.
//   깬 단계는 '소탕'으로 바로 보상을 받는다(들어가지 않고 한 번 쓴다) — 방치형이라 매일 누르기만 해도 된다.
//   못 깨도 잡은 만큼 절반은 준다.
// 무한의 탑: 층마다 수문장 하나, 30초. 이기면 다음 층(자동으로 이어 오른다), 오른 층마다 공격력·체력이 영구히 오른다.
import { ZONES_W, ZONE_COUNT, MAPS, mapId, BOSS, KINGS, mobHp, mobAtk, mobGold, expToNext, dailyShards, TOWER_SHARDS, MOUNTS } from './wdata.js';

// 한국 시간 하루 — 'YYYY-MM-DD'와 요일(0 일요일)
export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
export const kstWeekday = (now = Date.now()) => new Date(now + 9 * 3600e3).getUTCDay();
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// v302: 들어가는 횟수 제한을 없앴다 — 언제든 도전한다. DAILY_ENTRIES는 '온전한 보상 몫'(하루 종류마다, 남긴 것은 다음 날로).
//   몫이 있으면 도전·소탕에 온전한 보상. 새 단계를 깨면 몫을 안 쓴다(끝없이 오른다 · 경험치·은자는 내 레벨+5로 막혀 있다).
//   몫이 없으면 도전은 되지만 보상 DAILY_EXTRA(10%) — 소탕은 몫이 있을 때만(눌러서 무한히 받을 수 없게).
export const DAILY_ENTRIES = 3;
export const DAILY_EXTRA = 0.1;
export const DAILY_SEC = 75;
// 마흔 마리는 너무 많았다 — 한 판이 '잡는 일'이 되어 버린다.
// 시간은 그대로 두고 수만 줄인다. 덜 조이는 대신 끝까지 안 끌린다.
export const DAILY_KILLS = 24;           // 이만큼 잡으면 깬다
export const DAILY_ALIVE = 10;
export const DAILY_RESPAWN = 0.7;
export const DAILY_STAGES = 999;   // v401 30에서 끝나지 않는다 — 계속 오른다(DAILY_BASE 위로는 단계마다 더 세게)
export const DAILY_BASE = 30;      // 몹 레벨이 150에 닿는 단계
export const DAILY_OVER_K = 1.12;  // 30단계 위로 한 단계마다 몹 체력·공격 ×1.12
export const DAILY_OVER_RW = 0.06; // 보상 +6%씩
export const dailyOverK = (s) => (s > DAILY_BASE ? DAILY_OVER_K ** (s - DAILY_BASE) : 1);
export const dailyRwK = (s) => 1 + Math.max(0, s - DAILY_BASE) * DAILY_OVER_RW;
export const DAILY_FAIL = 0.5;

export const DAILY = [
  { id: 'exp', name: '수련동', hanja: '修鍊洞', ico: '修', days: [1, 4], scene: 'relic', what: '경험치',
    desc: '옛 고수들의 수련 동굴. 쓰러뜨린 만큼 깨달음을 얻는다.' },
  { id: 'gold', name: '금광굴', hanja: '金鑛窟', ico: '金', days: [2, 5], scene: 'gold', what: '은자',
    desc: '흑도 무리가 숨겨 둔 금광. 은자가 쏟아진다.' },
  { id: 'mat', name: '천공광맥', hanja: '天工鑛脈', ico: '鑛', days: [3, 6], scene: 'stone', what: '재료 · 두목 증표',
    desc: '대장장이들이 탐내는 광맥. 그 단계 지역의 재료와 증표.' },
];
export const dailyOf = (id) => DAILY.find((d) => d.id === id) || null;
// v147: 요일 제한을 없앴다 — 셋 다 매일 열린다(하루 DAILY_ENTRIES번씩). days는 옛 세이브·문서용으로만 남는다.
export const dailyOpen = () => true;
export const dailyDaysText = () => '매일';

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
// v260: 경험치·은자는 '단계 레벨'과 '내 레벨 + DAILY_LV_OVER' 중 낮은 쪽으로 센다 — 장비가 앞선 Lv84가
// 30단계(몹 150)를 깨고 하루 만에 84→100이 되던 것을 막는다. 재료는 그 단계 지역 것 그대로(장비에 쓴다).
export const DAILY_LV_OVER = 5;
export function dailyReward(kind, s, gapMult = 1, myLv = 999) {
  const z = zoneForLv(dailyLv(s));
  const lv = Math.max(1, Math.min(dailyLv(s), myLv + DAILY_LV_OVER));
  // 한 판 ≈ 들판 10분~한 시간어치 (경험치 그 레벨 0.2 · 은자 몹 1000마리 · 재료 300 · 증표 8)
  // v292 한 판마다 포획·탈것 조각도(단계가 높을수록 더)
  const sh = { petShard: dailyShards(s), mountShard: dailyShards(s) };
  const rk = dailyRwK(s);   // v401 30단계 위로는 보상도 오른다
  if (kind === 'exp') return { exp: Math.round(expToNext(lv) * 0.2 * gapMult * rk), ...sh };
  if (kind === 'gold') return { gold: Math.round(mobGold(lv) * 1000 * rk), ...sh };
  return { mats: { [z]: Math.round(300 * rk), [`b${z}`]: Math.round(8 * rk) }, ...sh };
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

// 같은 레벨 무인의 두목 딜(초당) — 99 아래는 그 지역 상급 +6 유니크 여섯 칸, 99부터는 자기 직업 세트 다섯 + 왕의 장신구(강화 6 → 145에 +9, v150),
// 심법·스킬 다 찍은 다섯 직업 평균(시뮬로 잼).
// 몹 체력(mobHp)은 레벨에 곧게 오르지만 무인은 장비 사다리로 훨씬 빨리 세진다 — 던전 몹·탑 수문장은 이것에 맞춘다.
const REF = [[1, 100], [5, 147], [15, 926], [25, 2050], [40, 7980], [55, 19495], [70, 60044], [85, 203535], [100, 617504], [115, 641550], [130, 794590], [145, 1167676]];   // v154: 다섯 직업 평균을 다시 잼(사다리 스무 칸 · 강화 · 등급 1.2/1.4/1.7 · 강화 +15%) — 예전 표는 v143 전 것이라 55~100에서 무인이 표보다 1.1~1.85배 셌다
export function refDps(lv) {
  if (lv >= 145) return REF[REF.length - 1][1] * 1.07 ** (lv - 145);
  let i = 0;
  while (REF[i + 1][0] < lv) i++;
  const [l0, d0] = REF[i], [l1, d1] = REF[i + 1];
  return Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * ((lv - l0) / (l1 - l0)));
}
// 같은 레벨 기준 무인의 최대 체력 (refDps와 같은 장비로 잼, v149)
const REF_HP = [[1, 356], [5, 514], [15, 1421], [25, 2520], [40, 4612], [55, 9686], [70, 16647], [85, 26776], [100, 40794], [115, 41100], [130, 43000], [145, 46025]];   // v154: 다시 잼 (115·130은 들쭉날쭉해 고르게)
export function refHp(lv) {
  if (lv >= 145) return REF_HP[REF_HP.length - 1][1] * 1.03 ** (lv - 145);
  let i = 0;
  while (REF_HP[i + 1][0] < lv) i++;
  const [l0, h0] = REF_HP[i], [l1, h1] = REF_HP[i + 1];
  return Math.exp(Math.log(h0) + (Math.log(h1) - Math.log(h0)) * ((lv - l0) / (l1 - l0)));
}
// v271 두목 기준 체력 — 지금 무인(시뮬 v270 검사·권사 중앙값)의 체력. REF_HP(v154)는 레벨 100 뒤로 평평해
//   Lv100 무인 체력의 1/4~1/5밖에 안 됐다 — 왕·고수 초식(그 레벨 무인 체력의 반)이 5~10%만 깎았다.
//   사냥터 몹은 REF_HP 그대로(진행 속도를 흔들지 않게) — 두목 공격·초식만 이것을 쓴다.
const BOSS_REF_HP = [[1, 356], [5, 514], [15, 1421], [25, 2520], [30, 4000], [40, 7500], [50, 16500], [60, 25000], [70, 50000], [80, 80000],
  [90, 135000], [100, 190000], [110, 225000], [120, 235000], [130, 270000], [140, 306000], [150, 314000]];
export function bossRefHp(lv) {
  // 무인은 150이 끝 — 그 위 두목(맹주·천마·화무기·마귀)은 이 기준을 더 키우지 않는다(맹주 배수·레벨 차이로 이미 세다)
  if (lv >= 150) return BOSS_REF_HP[BOSS_REF_HP.length - 1][1];
  let i = 0;
  while (BOSS_REF_HP[i + 1][0] < lv) i++;
  const [l0, h0] = BOSS_REF_HP[i], [l1, h1] = BOSS_REF_HP[i + 1];
  return Math.exp(Math.log(h0) + (Math.log(h1) - Math.log(h0)) * ((lv - l0) / Math.max(1, l1 - l0)));
}
export const BOSS_HIT_FRAC = 0.09;   // 두목 한 대 = 같은 레벨 무인 체력의 9% 이상
// 사냥터 몹 (v149) — 옛 공식(mobHp·mobAtk)은 레벨에 곧게 올라 장비로 크는 무인을 못 따라갔다(레벨 100 몹이 0.03초에 녹았다).
// 이제 무인 성장을 따른다: 체력 = 같은 레벨 무인이 FIELD_HP_SEC초 칠 만큼 · 한 대 = 같은 레벨 무인 체력의 FIELD_ATK_FRAC.
// 같은 레벨에서는 비슷하게 잡히고, 한참 높은 곳(레벨 60이 십이지왕 99~)은 몹 하나에 몇 초, 몇 대면 쓰러진다.
export const FIELD_HP_SEC = 0.5;
export const FIELD_ATK_FRAC = 0.04;
// v242: 장비 기대치 곡선 — 높은 사냥터일수록 무인이 강화·등급 장비를 갖췄다고 보고 몹이 단단·아프다.
// +10 전설 차림 시뮬로 맞췄다: 레벨 30까지 그대로, 92에 체력 ×2.5·공격 ×1.6, 145에 ×4.3·×2.1
export const gearHp = (lv) => 1 + 7 * (Math.max(0, lv - 30) / 120) ** 1.3;
export const gearAtk = (lv) => 1 + 1.8 * (Math.max(0, lv - 30) / 120);
export const fieldMobHp = (lv) => Math.round(Math.max(mobHp(lv), refDps(lv) * FIELD_HP_SEC) * gearHp(lv));
export const fieldMobAtk = (lv) => Math.round(Math.max(mobAtk(lv), refHp(lv) * FIELD_ATK_FRAC) * gearAtk(lv));
// 던전 몹 하나 = 같은 레벨 무인이 1.2초 칠 체력 (초반은 광역 무공이 적어 덜 단단하게 — 레벨 5에 0.5초)
export const dailyHpSec = (lv) => 0.45 + 0.75 * Math.min(1, lv / 60);
export const dailyMobHp = (lv) => Math.max(mobHp(lv) * 0.7, refDps(lv) * dailyHpSec(lv));
export const dailyMobAtk = (lv) => mobAtk(lv) * 1.5;

// ---------- 무한의 탑 (v126: 120층 · 10층마다 십이지신) ----------
// 층마다 수문장 하나. 수문장은 바닥에 붉은 경고를 깔고 잠깐 뒤 크게 친다(최대 체력의 몇 할) — **직접 움직여 피해야 한다.**
// 자동 사냥은 피하지 않는다(조이스틱·화면 누르기로). 층이 오를수록 경고가 짧고, 자주, 아프다.
// 10층마다 십이지신이 지킨다 — 이기면 그 신의 '십이지 뽑기권' 셋(그 신수 탈것이 나온다, 셋째에는 꼭).
export const TOWER_MAX = 120;
export const TOWER_SEC = 300;   // v361 5분(전엔 35초)
export const TOWER_ZODIAC_SEC = 300;   // v361 5분(전엔 50초)
export const TOWER_BONUS = 0.005;        // 오른 층마다 공격력·체력 +0.5% (120층 +60%)
export const towerBonus = (floor) => Math.min(TOWER_MAX, floor || 0) * TOWER_BONUS;
export const isZodiacFloor = (f) => f % 10 === 0;
export const towerSec = (f) => (isZodiacFloor(f) ? TOWER_ZODIAC_SEC : TOWER_SEC);
// 층 f 수문장 레벨: 1층 3 … 120층 150
export const towerLv = (f) => Math.min(150, 2 + Math.round(f * 1.24));
export const towerPow = () => 1;
// 수문장 체력: 같은 레벨 무인이 16초 칠 만큼(피하느라 못 치는 시간을 셈해 넉넉히), 십이지신은 1.6배
export const TOWER_HIT_SEC = 20;   // v154: 16→20 — 기준표를 다시 잰 뒤 피하는 무인이 목표 층보다 열 층쯤 더 올랐다
// v359 보통 탑(회랑 포함)을 열 배 세게 — 체력 ×10 · 붙어 치기 ×2. 극은 따로 정한 세기(아래 towerHpBase × 22) 그대로
export const TOWER_HP_K = 10, TOWER_ATK_K = 2;
export const towerHp = (f) => towerHpBase(f) * TOWER_HP_K;
export const towerHpBase = (f) => Math.round(Math.max(mobHp(towerLv(f)) * BOSS.hp, refDps(towerLv(f)) * TOWER_HIT_SEC) * (isZodiacFloor(f) ? 1.6 : 1) * (f > TOWER_MAX ? CORRIDOR_HP_UP ** (f - TOWER_MAX) : 1));
export const towerAtkBase = (f) => mobAtk(towerLv(f)) * BOSS.atk * 0.6;
export const towerAtk = (f) => towerAtkBase(f) * TOWER_ATK_K;   // 붙어 치는 건 약하게 — 무서운 건 바닥 경고

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
// v263 주간 회랑 — 120층 위. 한 주(월요일 0시, 한국 시간)마다 초식 조합이 바뀌고 층마다 수문장이 7%씩 단단해진다.
//   이번 주 가장 높이 오른 층만 적는다(영구 덤 없음 · 층마다 처음 오를 때 은자).
export const corridorWeek = (now = Date.now()) => kstDay(now - ((kstWeekday(now) + 6) % 7) * 86400e3);
export function corridorPats(week = corridorWeek()) {
  let h = 2166136261; for (const c of week) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const pool = PAT_UNLOCK.map(([, p]) => p);
  const out = [];
  while (out.length < 4) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
export const CORRIDOR_HP_UP = 1.07;
export const corridorGold = (f) => Math.round(mobGold(150) * 60 * (1 + (f - TOWER_MAX) * 0.05));
// v403 120층 너머 — 끝없이. 지금껏 가장 높이 오른 회랑 층(all)마다 공격력·체력 +0.25% 영구(상한 없음),
//   새 기록 층을 처음 넘으면 은자 세 배 + 조각(10층마다 더 크게)
export const CORRIDOR_BONUS = 0.0025;
export const corridorBonus = (all) => Math.max(0, all || 0) * CORRIDOR_BONUS;
export const corridorRecordReward = (f) => {
  const n = f - TOWER_MAX, big = n % 10 === 0;
  return { gold: corridorGold(f) * 3, petShard: TOWER_SHARDS * (big ? 10 : 2), mountShard: TOWER_SHARDS * (big ? 10 : 2) };
};
export function towerPatterns(f) {
  if (f > TOWER_MAX) return corridorPats();
  const z = zodiacOf(f);
  if (z) return z.pat;
  return PAT_UNLOCK.filter(([at]) => f >= at).map(([, p]) => p).slice(-4);
}
const k120 = (f) => Math.min(1, f / TOWER_MAX);
export const tellDelay = (f) => 1.6 - 0.55 * k120(f);              // 경고 → 터짐 (1.6초 → 1.05초)
export const castGap = (f) => (5.0 - 2.2 * k120(f)) * (isZodiacFloor(f) ? 0.85 : 1);   // 초식 사이 (5초 → 2.8초)
export const tellDmg = (f) => (0.5 + 0.3 * k120(f)) * (isZodiacFloor(f) ? 1.15 : 1);   // 맞으면 최대 체력의 몇 할 (두 대면 거의 쓰러진다)
export const TOWER_NO_POTION = true;   // 탑에서는 물약을 못 쓴다 — 피하는 수밖에
export const TELL_NAMES = { cone: '부채꼴', ring3: '파동', grid: '그물', aim: '노림수', nova: '폭쇄', line: '일직선 참격', donut: '바깥 고리', cross: '십자참', chase: '추격', rain: '낙뢰우', star: '세 갈래', xcross: '팔방참', twin: '쌍선 돌격', charge: '돌진', spiral: '도는 칼날', cage: '천라지망', collapse: '붕괴', lead: '앞지른 노림', blame: '자책', quad: '도박', haze: '환각' };

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
  const out = { gold: Math.round(mobGold(lv) * 30), petShard: TOWER_SHARDS, mountShard: TOWER_SHARDS };   // v292 조각
  if (isZodiacFloor(f)) {
    out.petShard *= 5; out.mountShard *= 5;
    const z = zoneForLv(lv);
    out.gold += Math.round(mobGold(lv) * 300);
    out.mats = { [z]: 150, [`b${z}`]: 5 };
    out.tickets = { [f / 10]: ZODIAC_TICKETS };
  }
  return out;
}
export function towerMap(f) {
  const z = zoneForLv(towerLv(f));
  return { id: -2, inst: true, name: f > TOWER_MAX ? `주간 회랑 ${f - TOWER_MAX}층` : `무한의 탑 ${f}층`, zoneName: '무한의 탑', zone: z, mz: z, area: 0, art: ZONES_W[z].art,
    lv: [towerLv(f), towerLv(f)], mobs: [], boss: towerBoss(f), scene: isZodiacFloor(f) ? 'raid' : 'trial', bossFirst: true };
}
// ---------- v350 무한의 탑 · 극(極) — 하드 모드 ----------
// 보통 탑 60층을 오르면 열린다. 60층. 극 h층 수문장 = 보통 (60+h)층의 그것보다 체력 ×22(v357 열 배로 · 전엔 ×2.2) · 붙어 치기 ×3 · 경고가 짧고(×0.82) · 자주(×0.75) · 아프다(×1.25),
//   초식 하나가 더(천라지망·도는 칼날·붕괴…). 10층마다 신수(HARD_MOUNTS)가 몸소 지킨다 — 처음 이기면 그 신수가 내 탈것으로.
//   극의 층마다 공격력·체력 +0.4% 영구(60층 +24%).
export const HARD_OPEN = 60;
export const HARD_MAX = 60;
export const HARD_BONUS = 0.008;   // v359 열 배 어려워진 만큼 0.4% → 0.8% (60층 +48%)
export const hardBonus = (h) => Math.min(HARD_MAX, h || 0) * HARD_BONUS;
export const hardF = (h) => Math.min(TOWER_MAX, HARD_OPEN + h);   // 같은 세기의 보통 층
export const isHardBossFloor = (h) => h % 10 === 0;
export const hardSec = () => 300;   // v361 5분(전엔 40초 · 신수 층 60초)
export const hardLv = (h) => Math.min(150, towerLv(hardF(h)) + 4);
export const HARD_HP_K = 220;   // v357 극을 열 배(2.2 → 22) · v359 백 배(→ 220)
export const hardHp = (h) => Math.round(towerHpBase(hardF(h)) * HARD_HP_K * (isHardBossFloor(h) ? 1.5 : 1) * (1 + h * 0.012));
export const hardAtk = (h) => towerAtkBase(hardF(h)) * 6;   // v359 붙어 치기 1.3 → 3 → 6   // v357 붙어 치는 것도 아프게(1.3 → 3)
export const hardDelay = (h) => tellDelay(hardF(h)) * 0.82;
export const hardGap = (h) => castGap(hardF(h)) * 0.75 * (isHardBossFloor(h) ? 0.9 : 1);
export const HARD_DMG = 1.25;
const HARD_EXTRA = [[1, 'spiral'], [11, 'cage'], [21, 'collapse'], [31, 'quad'], [41, 'lead'], [51, 'ring3']];
// 신수 층의 고유 초식 — 그 기운대로
const HARD_BOSS_PAT = { 1: ['rain', 'nova', 'spiral', 'chase'], 2: ['ring3', 'donut', 'cage', 'aim'], 3: ['xcross', 'rain', 'lead', 'chase'],
  4: ['collapse', 'chase', 'spiral', 'quad'], 5: ['ring3', 'twin', 'cage', 'donut'], 6: ['xcross', 'spiral', 'collapse', 'cage', 'quad'] };
export function hardPatterns(h) {
  if (isHardBossFloor(h)) return HARD_BOSS_PAT[h / 10] || HARD_BOSS_PAT[6];
  return [...towerPatterns(hardF(h)).slice(-3), ...HARD_EXTRA.filter(([at]) => h >= at).map(([, p]) => p).slice(-2)];
}
export const hardMountOf = (h) => (isHardBossFloor(h) ? MOUNTS.find((m) => m.hard === h / 10) || null : null);
export function hardBoss(h) {
  const md = hardMountOf(h);
  if (md) return { name: `극 ${h}층 신수 ${md.name}`, beast: md.id, bscale: 1.7, hardBeast: md.hard };
  const b = ZONES_W[zoneForLv(hardLv(h))].boss;
  return { name: `극 ${h}층 수문장 ${b.name}`, look: b.look };
}
export function hardReward(h) {
  const lv = hardLv(h);
  // v359 보상 크게(은자 스물다섯 배 · 조각 두 배 · 신수 층 재료 두 배)
  const out = { gold: Math.round(mobGold(lv) * 2000), petShard: TOWER_SHARDS * 4, mountShard: TOWER_SHARDS * 6 };
  if (isHardBossFloor(h)) {
    const z = zoneForLv(lv);
    out.gold += Math.round(mobGold(lv) * 15000); out.mountShard *= 4; out.petShard *= 4;
    out.mats = { [z]: 600, [`b${z}`]: 20 };
  }
  return out;
}
export function hardMap(h) {
  const z = zoneForLv(hardLv(h));
  return { id: -2, inst: true, hard: true, name: `무한의 탑 · 극 ${h}층`, zoneName: '무한의 탑 · 극', zone: z, mz: z, area: 0, art: ZONES_W[z].art,
    lv: [hardLv(h), hardLv(h)], mobs: [], boss: hardBoss(h), scene: isHardBossFloor(h) ? 'raid' : 'trial', bossFirst: true };
}
// 십이지 뽑기 — 그 신수가 35%(이미 가졌으면 안 나온다), 셋째 뽑기까지 안 나오면 셋째에 꼭.
// 신수가 아니면 보통 탈것(10층에 3단 … 뒤로 갈수록 좋은 것)
export const ZODIAC_RATE = 0.35;
export const zodiacTopTier = (no) => Math.min(12, 2 + no);
// 경고 판정 — 무인 자리(x, y)가 이 경고 안인가 (들판 좌표 그대로, 그리는 쪽은 납작하게 그린다)
export function tellCovers(tl, x, y) {
  if (tl.kind === 'circle') return Math.hypot(x - tl.x, y - tl.y) <= tl.r;
  if (tl.kind === 'donut') { const d = Math.hypot(x - tl.x, y - tl.y); return d >= tl.r0 && d <= tl.r1; }
  // 부채꼴 (v168): 중심에서 r 안, 방향 a에서 ±half
  if (tl.kind === 'cone') {
    const d = Math.hypot(x - tl.x, y - tl.y);
    if (d > tl.r) return false;
    let da = Math.atan2(y - tl.y, x - tl.x) - tl.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    return d < 30 || Math.abs(da) <= tl.half;
  }
  if (tl.kind === 'line') {
    const dx = tl.x1 - tl.x0, dy = tl.y1 - tl.y0;
    const L2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((x - tl.x0) * dx + (y - tl.y0) * dy) / L2));
    return Math.hypot(x - (tl.x0 + dx * k), y - (tl.y0 + dy * k)) <= tl.w / 2;
  }
  return false;
}

// ---------- v373 월드보스 · v374 칠대성(七大聖) 탄막 · v375 최종 두목 ----------
// v375 칠대성은 날마다 바뀌지 않는다 — 일곱 모두 늘 서 있는 최종 두목(화무기 그 위). 마왕마다 서버 체력 하나를 무림 전체가 함께 깎는다.
//   서버: wbp/{마왕} = {seq} 지금 몇 번째 마왕인가 · wraid/{마왕}_{seq} = 그 마왕의 체력·피해·받음. 쓰러지면 누구든 다음 마왕(seq+1)을 바로 세운다.
//   체력 = 화무기 기본 체력 × WRAID_HP_K(4) — 혼자서는 한참, 같이 쳐야 잡힌다. 옥황상제는 그 × OK_HP_K.
//   쓰러지면 한 대라도 친 사람은 모두 그 마왕이 맡은 **대성신장 한 부위**(등급은 굴린다) + 순위대로 은자·조각.
//   대성신장 일곱 부위를 모두 끼면(강화와 상관없이) 천외천 천궁의 **옥황상제**에게 갈 수 있다.
// 한 판 WRAID_SEC초 · 언제든 · 참여 보상은 하루 WRAID_PAID판까지 · 같은 마왕 판에 든 무인이 서로 보인다(wbcoop.js).
export const WRAID_SEC = 120;
export const WRAID_PAID = Infinity;   // v408 참여 보상 제한 없음(옛 5판)
export const WRAID_PER_DAY = WRAID_PAID;     // 옛 이름(저장 다듬기) — 참여 보상 몫
export const WRAID_HP_K = 1500;              // 화무기 기본 체력의 몇 배 · v387 4 → 300(만렙 전설+12 혼자 한 판에 ~5%, 여럿이 여러 판) · v388에 1000으로 올렸다가 v389 다시 300 · v403 1500(5차 천마가 한 판에 거의 혼자 잡았다 — 이제 한 판 ~15~35%)
export const WRAID_PARTS = 7;                // 칠대성 — 대성신장 일곱 부위(귀걸이는 없다)
export const OK_HP_K = 8;                    // 옥황상제 = 마왕 × 이것
export const WRAID_LV = 120;                 // 이 레벨부터
export const OK_PLUS = 0;                    // v375 옥황상제 — 대성신장 일곱 부위를 모두 끼기만 하면(강화 요구 없음)
// v375 칠대성(七大聖) — 화과산에서 의형제를 맺은 일곱 요괴 왕(우마왕이 맏형, 손오공이 막내). 생김새·빛깔·탄(shot)·패턴 차례 · 맡은 세트 부위(slot)와 이름(piece)
//   shot: fire 불덩이 · water 물방울 · feather 깃 · gold 금빛 포효 · shade 그림자 혼 · bolt 번개 · cloud 근두운 금빛 · heaven 천광
const P = (p, name, o = {}) => ({ p, name, ...o });
export const WRAID_BOSSES = [
  { id: 'umawang', name: '우마왕', hanja: '牛魔王', title: '평천대성(平天大聖)', art: 'wb-umawang', col: '#f97316', shot: 'fire', slot: 'weapon', piece: null,
    pats: [P('fan', '화염 돌진'), P('burst', '파초선 불덩이'), P('ring', '화염산 폭발'), P('rain', '삼매진화')] },
  { id: 'gyomawang', name: '교마왕', hanja: '蛟魔王', title: '복해대성(覆海大聖)', art: 'wb-gyomawang', col: '#22d3ee', shot: 'water', slot: 'armor', piece: '비늘갑',
    pats: [P('wave', '해일'), P('spiral', '소용돌이', { arms: 3 }), P('ring', '물기둥'), P('fan', '용의 숨')] },
  { id: 'bungmawang', name: '붕마왕', hanja: '鵬魔王', title: '혼천대성(混天大聖)', art: 'wb-bungmawang', col: '#facc15', shot: 'feather', slot: 'hat', piece: '금시관',
    pats: [P('fan', '금시 깃털'), P('rain', '깃털 폭풍'), P('cross', '구만리 회오리'), P('spiral', '날개 바람', { arms: 4 })] },
  { id: 'satawang', name: '사타왕', hanja: '獅駝王', title: '이산대성(移山大聖)', art: 'wb-satawang', col: '#eab308', shot: 'gold', slot: 'glove', piece: '사자수투',
    pats: [P('ring', '사자후', { big: true }), P('burst', '산 옮기기'), P('fan', '금빛 발톱'), P('homing', '포효의 혼')] },
  { id: 'mihuwang', name: '미후왕', hanja: '獼猴王', title: '통풍대성(通風大聖)', art: 'wb-mihuwang', col: '#a78bfa', shot: 'shade', slot: 'shoe', piece: '통풍혜',
    pats: [P('homing', '육이 분신'), P('fan', '철봉 난타'), P('burst', '털 한 줌'), P('ring', '통풍(通風)')] },
  { id: 'uyungwang', name: '우융왕', hanja: '禺狨王', title: '구신대성(驅神大聖)', art: 'wb-uyungwang', col: '#60a5fa', shot: 'bolt', slot: 'acc', piece: '뇌정패',
    pats: [P('cross', '뇌정 십자'), P('fan', '긴 팔 번개'), P('rain', '벼락비'), P('ring', '천둥 고리')] },
  { id: 'sonogong', name: '손오공', hanja: '孫悟空', title: '제천대성(齊天大聖)', art: 'wb-sonogong', col: '#fbbf24', shot: 'cloud', slot: 'finger', piece: '긴고환',
    pats: [P('cross', '여의봉 팔방'), P('homing', '칠십이변 분신'), P('spiral', '근두운', { arms: 6 }), P('rain', '천궁 대소동'), P('burst', '화안금정')] },
];
// 천외천 천궁의 주인 — 대성신장 일곱을 모두 낀 자만. 칠대성의 패턴을 섞어 쓴다
export const OKHWANG = { id: 'okhwang', name: '옥황상제', hanja: '玉皇上帝', title: '천외천 천궁의 주인', art: 'wb-okhwang', col: '#fde68a', shot: 'heaven', final: true,
  pats: [P('ring', '남천문 천광', { big: true }), P('cross', '사대천사의 진'), P('homing', '천병천장'), P('fan', '탁탑천왕의 보탑'), P('spiral', '나타 풍화륜', { arms: 6 }),
    P('rain', '이랑진군의 천안'), P('burst', '태상노군의 팔괘로'), P('wave', '반도원 은하수'), P('spiral', '구룡승천', { arms: 9 })] };
// 천계 이야기 — 천궁 카드의 '이야기'에서 읽는다(서유기의 천계를 이 무림의 말로)
// v378 이야기 한 장씩 — need가 이뤄지면 열리고(palma 대성신장 일곱 · 관문 id 넘기 · okhwang/seokga 처치에 함께), 처음 읽으면 보상
export const STORY_NEED_TEXT = { palma: '대성신장 일곱 부위를 끼면', sadae: '사대천사의 관문을 넘으면', takap: '탁탑천왕의 관문을 넘으면', nata: '나타의 관문을 넘으면', irang: '이랑진군의 관문을 넘으면', okhwang: '옥황상제를 쓰러뜨리면', seokga: '석가여래를 쓰러뜨리면', sk3: '석가여래의 손바닥에 세 번 오르면' };
export const storyReward = (lv, i) => ({ gold: Math.round(mobGold(lv) * 1500 * (1 + i * 0.5)), petShard: 30 + i * 10, mountShard: 30 + i * 10 });
export const HEAVEN_STORY = [
  { who: '옥황상제(玉皇上帝)', need: 'palma', text: '하늘의 임금. 돌원숭이가 태어나며 쏜 빛에 놀란 날부터, 벼슬을 내려도 연회를 엎고 천궁을 휘젓는 제천대성 때문에 편할 날이 없었다. 이제 칠대성의 신장을 두른 무인이 남천문을 두드리자, 하늘은 다시 시험한다 — 그 힘이 하늘을 지킬 힘인지, 무너뜨릴 힘인지.' },
  { who: '사대천사(四大天師)', need: 'sadae', text: '장도릉·갈선옹·허정양·구홍제. 옥황상제 곁에서 하늘의 법을 받드는 네 천사가 진을 펼쳐 문 앞을 막는다.' },
  { who: '태백금성(太白金星)', need: 'sadae', text: '천계에서 가장 너그러운 어른. 토벌보다 벼슬을 주자 했던 이 — 무인이 천궁에 오르는 것도 그가 옥황상제를 설득한 덕이다. 손오공조차 그 앞에서는 예를 갖춘다.' },
  { who: '태상노군(太上老君)', need: 'takap', text: '단약을 굽다 손오공에게 몽땅 털린 신선. 팔괘로에 가두어 태우려다 화로만 뒤집혔다. 이번엔 그 팔괘로의 불을 그대로 쏟아낸다.' },
  { who: '탁탑천왕 이정 · 나타', need: 'nata', text: '보탑을 든 천병의 대장과 풍화륜을 탄 그의 셋째 아들. 제천대성을 잡으러 내려왔다 물러난 적이 있다 — 그 설욕을 무인에게 갚으려 한다.' },
  { who: '현성 이랑진군', need: 'irang', text: '이마의 세 번째 눈으로 모든 변신을 꿰뚫는 신장. 칠십이변의 손오공과 맞붙어 끝내 사로잡았던 하늘 최강의 무장.' },
  { who: '서왕모(西王母)', need: 'okhwang', text: '반도대회를 열었다가 손오공에게 복숭아 잔치를 통째로 망친 여신. 그 원망이 반도원의 은하수가 되어 흐른다.' },
  { who: '석가여래 — 손바닥 안', need: 'seokga', text: '쓰러뜨렸다 — 고 생각한 순간, 무인 앞에 다섯 개의 하늘 기둥이 솟아 있었다. 기둥에는 제 손으로 새긴 글자가 남아 있었다. 그것은 기둥이 아니라 여래의 다섯 손가락. 오백 년 전 제천대성이 그랬듯, 무인도 처음부터 끝까지 그 손바닥 안을 뛰어다녔을 뿐이다. 여래는 웃으며 손을 거두었다 — 「다시 오너라. 손바닥은 언제나 여기 있으니.」' },
  // v386 후일담 — 손바닥에서 내려온 뒤
  { who: '후일담 — 오행산(五行山) 아래', need: 'seokga', text: '여래가 손을 거두자 그 손은 다섯 봉우리의 산이 되어 땅에 내려앉았다. 오백 년 전 제천대성이 깔렸던 바로 그 산. 무인은 그 산을 내려오며 처음으로 웃었다 — 이긴 것도 진 것도 아니었다. 다만 하늘이 얼마나 넓은지, 그리고 그 넓은 하늘조차 누군가의 손바닥이라는 것을 알았을 뿐.' },
  { who: '후일담 — 다시 길 위에', need: 'sk3', text: '서천으로 가는 길목에서 무인은 한 스님과 원숭이 하나, 돼지 하나, 사오정 하나를 스쳐 지나갔다. 원숭이가 무인을 알아보고 씩 웃었다. 「너도 그 손바닥에 올라 봤구나.」 강호로 돌아온 무인의 이름은 이제 무림 끝까지 퍼졌다 — 그러나 무인은 안다. 길은 끝나지 않는다. 손바닥은 언제나 그 자리에 있고, 오늘도 누군가 그 위를 달린다.' },
  // v413 이어지는 이야기 — 각성 고수와 손바닥 밖
  { who: '후일담 — 각성(覺醒)', need: 'awk1', text: '강호로 돌아오니 이상한 소문이 돌았다. 쓰러졌던 고수들이 다시 일어섰다는 것이다 — 그것도 전보다 더 강하게. 무인이 천계의 문을 여닫는 동안 하늘의 기운이 조금씩 새어 내려와, 강호의 이름난 자들 몸에 스며든 것이다. 첫 번째 각성자를 꺾은 날, 무인은 깨달았다. 이 일은 제 손으로 연 문에서 시작됐다는 것을.' },
  { who: '후일담 — 천하의 이름', need: 'awkAll', text: '검왕, 두 맹주, 천마, 화무기, 그리고 마귀. 하늘의 기운을 머금은 여섯을 모두 꺾자 강호에 새어 내리던 빛이 멎었다. 각성자들은 하나둘 무인을 찾아와 고개를 숙였다. 「그대가 문을 열었고, 그대가 닫았다.」 그날 이후 강호의 누구도 무인을 이름으로 부르지 않았다 — 다만 〈천하〉라고만 불렀다.' },
  { who: '종장 — 손바닥 밖', need: 'sk10', text: '열 번째로 손바닥 위에 섰을 때, 여래는 손을 펴지 않았다. 「몇 번을 와도 같다는 것을 알면서 왜 또 오느냐.」 무인은 대답 대신 칼을 내려놓았다. 여래가 처음으로 웃었다. 「이제야 손바닥 밖으로 나왔구나.」 — 이기려고 오른 하늘은 끝이 없었다. 그러나 오르기를 멈추지 않는 자에게는 손바닥도 길이 된다. 무인의 이야기는 여기서 한 장을 덮는다. 다음 장은 이 길을 걷는 다른 누군가의 몫이다.' },
];
// v377 남천문 관문 — 옥황상제 앞에서 차례로 막아선다. 대성신장 일곱을 낀 자만 · 앞 관문을 넘어야(처치에 함께해야) 다음으로.
//   처음 넘으면 천계의 가호(공격력·체력 +GATE_BONUS 영구) · 넷을 모두 넘어야 옥황상제.
export const GATE_HP_K = 3;       // 대성의 몇 배 (v387 1.5 → 2)
export const GATE_BONUS = 0.06;
export const HEAVEN_GATES = [
  { id: 'sadae', gate: 1, name: '사대천사', hanja: '四大天師', title: '장도릉 · 갈선옹 · 허정양 · 구홍제', art: 'wb-sadae', col: '#e0f2fe', shot: 'heaven',
    pats: [P('cross', '팔괘진'), P('homing', '부적 비'), P('ring', '사방 결계', { big: true }), P('rain', '천뢰부')] },
  { id: 'takap', gate: 2, name: '탁탑천왕', hanja: '托塔天王', title: '천병의 대장 이정(李靖)', art: 'wb-takap', col: '#fbbf24', shot: 'gold',
    pats: [P('burst', '보탑 낙하'), P('ring', '보탑의 빛'), P('fan', '천병 돌격'), P('wave', '천하 진압')] },
  { id: 'nata', gate: 3, name: '나타', hanja: '哪吒', title: '삼태자 · 풍화륜', art: 'wb-nata', col: '#f43f5e', shot: 'fire',
    pats: [P('spiral', '풍화륜', { arms: 4 }), P('fan', '화첨창'), P('homing', '건곤권'), P('cross', '혼천릉')] },
  { id: 'irang', gate: 4, name: '이랑진군', hanja: '二郞眞君', title: '천안(天眼)의 신장', art: 'wb-irang', col: '#93c5fd', shot: 'bolt',
    pats: [P('fan', '삼첨양인도'), P('homing', '효천견'), P('cross', '천안 개안'), P('rain', '관강구의 비'), P('spiral', '칠십삼변', { arms: 5 })] },
];
// v378 천외천 너머 — 석가여래(숨은 두목). 옥황상제를 쓰러뜨리는 데 함께한 자만. 손바닥 안에서 좁혀 오는 탄을 빈틈으로 빠져나간다
export const SEOKGA = { id: 'seokga', name: '석가여래', hanja: '釋迦如來', title: '손바닥 밖은 없다', art: 'wb-seokga', col: '#fcd34d', shot: 'heaven', final: true, secret: true,
  pats: [P('palm', '여래신장(如來神掌)'), P('ring', '만(卍)자 광명', { big: true }), P('homing', '오백 나한'), P('palm', '손바닥 안'), P('spiral', '천엽 연화', { arms: 8 }), P('rain', '오행산 낙하'), P('burst', '대일여래의 빛')] };
export const SK_HP_K = 3;    // 옥황상제의 몇 배 (v387 1.5 → 2.4)
// v383 쓰러뜨려도 — 모두 여래의 손바닥 안이었다(서유기의 오지산). 처치하면 이 반전이 뜨고, 여래는 다시 손바닥을 편다
export const PALM_REVEAL = ['쓰러뜨렸다 — 고 생각한 순간.', '눈앞에 다섯 개의 하늘 기둥이 솟아 있었다. 기둥에는 제 손으로 새긴 글자가 남아 있다.', '기둥이 아니었다. 여래의 다섯 손가락이었다.', '오백 년 전 제천대성처럼 — 처음부터 끝까지, 손바닥 안이었다.', '「다시 오너라. 손바닥은 언제나 여기 있으니.」'];
export const WRAID_BOSS = Object.fromEntries([...WRAID_BOSSES, ...HEAVEN_GATES, OKHWANG, SEOKGA].map((b) => [b.id, b]));
export const WRAID_IDS = [...WRAID_BOSSES.map((b) => b.id), ...HEAVEN_GATES.map((b) => b.id), OKHWANG.id, SEOKGA.id];
export const isGate = (id) => HEAVEN_GATES.some((b) => b.id === id);
export const wraidDocId = (boss, seq) => `${boss}_${seq}`;
export const wraidBossOfId = (id) => WRAID_BOSS[String(id).split('_')[0]] || WRAID_BOSSES[0];
// v374 옛 이름 — 날짜로 고르던 것(이제는 문서 이름에서)
export const wraidBossOf = (id) => WRAID_BOSS[String(id).split('_')[0]] || WRAID_BOSSES[((Math.floor(Date.parse(id) / 86400e3) % 8) + 8) % 8] || WRAID_BOSSES[0];
// 체력 — hwamugiHp: 화무기 두목의 기본 체력(wgame.hwamugiHp)
export const wraidMaxHp = (hwamugiHp, boss) => Math.round(Math.max(1e6, hwamugiHp) * WRAID_HP_K * (boss === SEOKGA.id ? OK_HP_K * SK_HP_K : boss === OKHWANG.id ? OK_HP_K : isGate(boss) ? GATE_HP_K : 1));
// 광폭 — 남은 체력 몫(0~1)으로. 0: 보통 · 1: 분노(50%↓) · 2: 광폭(20%↓)
export const wraidRage = (frac) => (frac <= 0.2 ? 2 : frac <= 0.5 ? 1 : 0);
// atk: 탄 피해 · spd: 탄 빠르기 · dens: 탄 수(빽빽함). 옥황상제는 한 단 더(final)
export const WRAID_RAGE = [{ atk: 1, spd: 1, dens: 1, gap: 1, name: '' }, { atk: 1.15, spd: 1.12, dens: 1.25, gap: 0.85, name: '분노' }, { atk: 1.3, spd: 1.25, dens: 1.5, gap: 0.7, name: '광폭' }];
export const OK_K = { atk: 1.25, spd: 1.12, dens: 1.2 };
// v387 단계마다 더 세게 — 0 칠대성 · 1 남천문 관문 · 2 옥황상제 · 3 석가여래
//   hit: 탄 한 대 = 최대 체력의 몇 몫(큰 탄 ×2) · heal: 싸우는 동안 회복이 이만큼만(천계의 기운) · dens·spd: 탄 수·빠르기 · pot: 물약 숨 배수
export const WB_TIER = [
  { hit: 0.12, heal: 0.32, dens: 1.2, spd: 1.08, pot: 3, name: '' },          // v403 한 단씩 더 세게(5차 이후)
  { hit: 0.14, heal: 0.27, dens: 1.35, spd: 1.15, pot: 4, name: '관문' },
  { hit: 0.17, heal: 0.22, dens: 1.5, spd: 1.21, pot: 5, name: '천궁' },
  { hit: 0.20, heal: 0.18, dens: 1.65, spd: 1.28, pot: 6, name: '손바닥' },
];
export const wbTierOf = (id) => (id === 'seokga' ? 3 : id === 'okhwang' ? 2 : HEAVEN_GATES.some((b) => b.id === id) ? 1 : 0);
// 한 판마다 — 친 몫이 클수록 조금 더(0~+100%)
export const wraidJoinReward = (lv, share = 0) => {
  const k = 1 + Math.min(1, Math.max(0, share) * 20);
  return { gold: Math.round(mobGold(lv) * 600 * k), petShard: Math.round(10 * k), mountShard: Math.round(10 * k) };
};
// 잡혔을 때 — 순위로 배율(1위 ×3 · 2~3위 ×2 · 10위까지 ×1.5 · 그 밖 ×1). 옥황상제 ×3
export const wraidRankK = (rank) => (rank === 1 ? 3 : rank <= 3 ? 2 : rank <= 10 ? 1.5 : 1);
export const wraidKillReward = (lv, rank, boss) => {
  const k = wraidRankK(rank) * (boss === SEOKGA.id ? 5 : boss === OKHWANG.id ? 3 : isGate(boss) ? 1.5 : 1);
  return { gold: Math.round(mobGold(lv) * 6000 * k), petShard: Math.round(60 * k), mountShard: Math.round(60 * k) };
};
// 대성신장 부위 등급 — 1위일수록 좋게(전설 이상이 잘 뜬다)
//   [레어 · 유니크 · 전설 · 신화] 가중치
export const PALMA_RAR_W = [0, 0, 60, 40];
// v409 부위는 확률로 — 순위가 높을수록 잘 나온다 · 그 마왕에게서 PALMA_PITY번 연달아 못 받으면 다음엔 꼭(천장)
export const PALMA_DROP = (rank) => (rank === 1 ? 0.6 : rank <= 3 ? 0.45 : rank <= 10 ? 0.35 : 0.25);
export const PALMA_PITY = 4;
export const palmaRarW = (rank) => (rank === 1 ? [0, 0, 30, 70] : rank <= 3 ? [0, 0, 45, 55] : PALMA_RAR_W);
// 캔버스 빛(putGlow)은 'r,g,b' 꼴을 받는다
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
export function wraidMap(boss, lv, z) {
  const fin = !!boss.final || !!boss.gate;
  return { id: -4, inst: true, name: `${boss.secret ? '천외천 너머 · ' : boss.gate ? '남천문 · ' : fin ? '천외천 · ' : '칠대성 토벌 · '}${boss.name}`, zoneName: fin ? '천외천 천궁' : '칠대성', zone: z, mz: z, area: 0, art: ZONES_W[z]?.art || 1,
    lv: [lv, lv], mobs: [], boss: { name: boss.name, look: { aura: boss.col }, art: boss.art }, scene: fin ? 'heaven' : 'raid', bossFirst: true, wb: boss.id, wbCol: hexRgb(boss.col), wbHex: boss.col, final: fin };
}

// ---------- 문파 토벌 (v128) ----------
// 한 주(한국 시간 월요일부터)에 두목 하나를 문파원이 함께 친다. 체력은 문파 문서(guilds/{id}/raids/wk-…)에 하나.
// 한 사람 하루 두 번, 한 번에 40초. 친 만큼 서버의 체력이 깎인다. 칠 때마다 참여 보상, 잡히면 친 사람 모두 큰 보상.
// 두목 체력 = 문파원 저마다의 40초 딜 × 하루 두 번 × 이레 × 절반 — 다들 절반쯤만 나와도 주 안에 잡힌다.
export const RAID_SEC = 40;
export const RAID_PER_DAY = 10;   // v428 2 → 4 · v431 → 10(두목 체력도 그만큼 — raidMaxHp가 이 수를 곱한다)
export const RAID_HP_SHARE = 0.5;
export function weekKey(now = Date.now()) {
  const d = new Date(now + 9 * 3600e3);
  const back = (d.getUTCDay() + 6) % 7;          // 월요일까지 며칠 뒤로
  return `wk-${new Date(d.getTime() - back * 86400e3).toISOString().slice(0, 10)}`;
}
// 주마다 십이지왕 하나가 돌아가며 (거대한 모습)
export function raidBossOf(key) {
  const n = Math.floor(Date.parse(key.slice(3)) / (7 * 86400e3));
  const k = KINGS[((n % KINGS.length) + KINGS.length) % KINGS.length];
  return { no: k.no, name: `토벌 · ${k.title}${k.real ? ` ${k.real}` : ''}`, title: k.title, look: { ...k.look, scale: 2.2 } };
}
export const raidMaxHp = (dpsSum) => Math.max(5000, Math.round(dpsSum * RAID_SEC * RAID_PER_DAY * 7 * RAID_HP_SHARE));
// 보상 — lv: 무인 레벨, z: 재료 지역(사냥하던 곳)
export const raidJoinReward = (lv, z) => ({ gold: Math.round(mobGold(lv) * 200), mats: { [z]: 40 } });
export const raidKillReward = (lv, z) => ({ gold: Math.round(mobGold(lv) * 2000), mats: { [z]: 250, [`b${z}`]: 6 } });
export function raidMap(boss, lv, z) {
  return { id: -3, inst: true, name: boss.name, zoneName: '문파 토벌', zone: z, mz: z, area: 0, art: ZONES_W[z]?.art || 1,
    lv: [lv, lv], mobs: [], boss: { name: boss.name, look: boss.look }, scene: 'raid', bossFirst: true };
}
