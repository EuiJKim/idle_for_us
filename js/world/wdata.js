// 바람식 개편 — 데이터. 설계: docs/바람식_개편.md
//
// 옛 판(관문·수련·무공 여덟 …)과 따로 선다. 그림(지역·몹 생김새·캐릭터 무기)만 옛 data.js에서 빌린다.
// **숫자는 보통 숫자다.** 레벨 150에서도 몹 체력이 몇십만이라 Big이 필요 없다.
import { ZONES, JOBS, CLASS_SKILLS, RANKS } from '../data.js';

export const SAVE_KEY = 'ifu-world-v1';
export const LEVEL_MAX = 150;

// ---------- 레벨 ----------
// 뒤로 갈수록 가파르다: 첫 시간 Lv15~20(1차 전직) · 하루 Lv50 남짓 · 일주일 Lv85 안팎 · 150은 몇 달.
// 처음엔 18·L^2.25로 두었더니 열한 시간에 Lv100을 넘었다(시뮬).
export const expToNext = (L) => Math.round(20 * L ** 2.3 * (1 + (L / 30) ** 2.2));
export const STAT_PER_LEVEL = 3;
export const STATS = [
  { id: 'str', name: '힘', desc: '공격력 +2' },
  { id: 'dex', name: '민첩', desc: '치명 +0.4%p · 공격 속도 +1%' },
  { id: 'vit', name: '체력', desc: '최대 체력 +12 · 방어 +0.2' },
  { id: 'int', name: '내공', desc: '스킬 피해 +2% · 체력 회복 +0.1/초' },
];
// 레벨이 오르면 겉모습도 한 단계씩 (옛 경지 그림 스물을 레벨에 나눠 쓴다)
export const lookTierOf = (level) => Math.min(RANKS.length - 1, Math.floor((level - 1) / 8));

// ---------- 캐릭터 ----------
// 결(class trait)은 단순하게 하나씩. 옛 JOBS의 이름·무기·사거리를 그대로 쓴다.
export const CLASSES = {
  sword: { base: { str: 6, dex: 4, vit: 5, int: 3 }, trait: '두목에게 주는 피해 +30%', boss: 1.3 },
  fist: { base: { str: 6, dex: 6, vit: 4, int: 2 }, trait: '공격 속도 +25%', speed: 1.25 },
  fan: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '멀리서 친다 · 맞은 적이 느려진다', slow: true },
  poison: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '멀리서 친다 · 맞은 적이 중독된다(3초에 걸쳐 60%)', poison: 0.6 },
  ring: { base: { str: 5, dex: 6, vit: 4, int: 3 }, trait: '치명 +8%p · 붙으면 더 아프다', crit: 0.08 },
};
export const classOf = (id) => JOBS.find((j) => j.id === id) || null;

// ---------- 전직과 스킬 ----------
export const TIERS = [
  null,
  { level: 15, cost: 200 },
  { level: 40, cost: 5000 },
  { level: 75, cost: 120000 },
];
// 스킬 셋. 이름은 옛 무공 이름을 빌린다(1차 일격기 = 옛 두목기 1차 형태 이름 …).
// role은 연출표(skillfx) 열쇠 — '캐릭터:role'. hpCost는 최대 체력 대비.
export const SKILL_DEFS = [
  { slot: 0, tier: 1, kind: 'single', role: 'frost', nameFrom: ['frost', 1], mult: 3.2, cd: 4, hpCost: 0, autoAbove: 0 },
  { slot: 1, tier: 2, kind: 'aoe', role: 'slash', nameFrom: ['slash', 2], mult: 2.4, cd: 6, hpCost: 0.10, autoAbove: 0.6, radius: 210 },
  { slot: 2, tier: 3, kind: 'aoe', role: 'thunder', nameFrom: ['thunder', 3], mult: 5.5, cd: 14, hpCost: 0.22, autoAbove: 0.75, radius: 300 },
];
export const skillsOf = (job) => SKILL_DEFS.map((d) => {
  const [r, t] = d.nameFrom;
  const name = CLASS_SKILLS[job]?.[r]?.names?.[t] || d.role;
  return { ...d, id: `s${d.slot}`, name, icon: name.slice(0, 2), fx: `${job}:${d.role}` };
});

// ---------- 지도 ----------
// 0번은 마을(객잔 마을). 1~15는 사냥터 — 옛 지역 그림과 몹 생김새를 쓴다.
// 한 화면(들판 약 390×1100)에 너댓 마리가 보이게. 넓으면 걷기만 하다 끝난다.
export const MAP_W = 1300;
export const MAP_H = 1700;
export const MOBS_ALIVE = 24;
export const RESPAWN_SEC = 5;
export const BOSS_EVERY = 240;
// 첫 사냥터는 좁게(1~6) — 레벨 1이 레벨 10 몹을 만나면 열 몇 대를 때려야 해서 첫 사냥이 지루했다
export const mapLevel = (k) => (k === 1 ? [1, 6] : [8 * k - 7, 8 * k + 2]);
export const MAPS = ZONES.map((z, i) => ({
  id: i,
  name: i === 0 ? '객잔 마을' : z.name,
  town: i === 0,
  zone: i,
  lv: i === 0 ? [0, 0] : mapLevel(i),
  mobs: z.mobs,
  boss: z.boss,
}));
export const mapOf = (id) => MAPS[id] || MAPS[0];

// 마을 사람 (무인 자리 기준으로 선다)
export const NPCS = [
  { name: '사부', dx: -150, dy: -120, look: { robe: '#e7e5e4', trim: '#78716c', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'sword' } },
  { name: '상인', dx: 150, dy: -90, look: { robe: '#92400e', head: 'hat', weapon: 'fan' } },
  { name: '대장장이', dx: -110, dy: 110, tab: 'bag', look: { robe: '#44403c', trim: '#f59e0b', head: 'band', band: '#7c2d12', beard: true, weapon: 'axe' } },
  { name: '주모', dx: 40, dy: -260, look: { robe: '#be185d', trim: '#fbcfe8', head: 'topknot', weapon: 'fan' } },
];

// ---------- 몹 ----------
export const mobHp = (lv) => Math.round(26 + 7 * lv ** 1.55);
// 알맞은 사냥터에서 물약이 시간당 60개 안팎이 되게(시뮬). 처음엔 1.7·lv^1.25였는데 시간당 200~400개를 먹어
// 방치 보상이 물약 때문에 1~2분 만에 멈췄다.
export const mobAtk = (lv) => Math.round(3 + 1.05 * lv ** 1.2);
export const mobDef = (lv) => Math.round(lv * 0.6);
export const mobExp = (lv) => Math.round(6 + 1.3 * lv ** 1.5);
export const mobGold = (lv) => Math.round(2 + lv * 1.4);
export const BOSS = { hp: 14, atk: 2.5, exp: 25, gold: 30 };
export const MOB_ATK_SEC = 1.6;
export const MOB_AGGRO = 200;      // 이만큼 붙으면 쫓아온다
export const MOB_SPEED = 70;

// ---------- 장비 ----------
export const SLOTS = [
  { id: 'weapon', name: '무기' },
  { id: 'armor', name: '옷' },
  { id: 'hat', name: '모자' },
  { id: 'acc', name: '장신구' },
];
export const GRADES = [
  { id: 0, name: '일반', color: '#d6d3d1', mult: 1, w: 70 },
  { id: 1, name: '고급', color: '#4ade80', mult: 1.35, w: 22 },
  { id: 2, name: '희귀', color: '#60a5fa', mult: 1.8, w: 6.5 },
  { id: 3, name: '영웅', color: '#c084fc', mult: 2.4, w: 1.3 },
  { id: 4, name: '전설', color: '#fb923c', mult: 3.2, w: 0.2 },
];
export const BAG_SIZE = 30;
// 아이템 기본 수치 (등급·강화 전)
export const itemBase = (slot, ilv) => {
  switch (slot) {
    case 'weapon': return { atk: 5 + 3.2 * ilv };
    case 'armor': return { hp: 22 + 13 * ilv };
    case 'hat': return { hp: 10 + 6 * ilv, def: 1 + ilv * 0.35 };
    case 'acc': return { crit: 0.01 + ilv * 0.0006, atkPct: 0.02 + ilv * 0.0012 };
    default: return {};
  }
};
// ---------- 재료와 조합 ----------
// 장비는 뽑기(드랍)로 얻지 않는다. 바람의나라 조합처럼 — 몹이 사냥터마다 정해진 재료를,
// 두목이 증표를 떨구고, 마을 대장장이가 **아래 장비 + 재료 + 은자**로 위 장비를 만든다.
// 장비 사다리: 사냥터마다 둘 — 하급(그 사냥터 재료) · 상급(하급 + 재료 + 두목 증표).
// 다음 사냥터 하급은 앞 사냥터 장비(하급이든 상급이든)를 재료로 먹는다. 1번 하급은 재료만.
export const MATS = [null, '청죽 마디', '사막 철편', '설원 빙정', '혈석', '귀화석', '운모 조각', '마철',
  '수정 비늘', '금강석', '야명주', '매화철', '독초 정수', '현빙옥', '산호', '천외운철'];
export const MAT_COLORS = [null, '#86efac', '#fcd34d', '#bae6fd', '#f87171', '#a5b4fc', '#e0f2fe', '#c084fc',
  '#67e8f9', '#fde68a', '#fef9c3', '#fda4af', '#bef264', '#e2e8f0', '#fb7185', '#f0abfc'];
// 두목 증표는 재료 주머니에 'b사냥터' 열쇠로 든다
export const bossKey = (k) => `b${k}`;
export const matName = (key) => (String(key)[0] === 'b' ? `${MAPS[+String(key).slice(1)]?.boss?.name || '두목'}의 증표` : MATS[key]);
export const matColor = (key) => (String(key)[0] === 'b' ? '#fde68a' : MAT_COLORS[key]);
export const MAT_RATE = 0.4;          // 몹 하나가 재료 하나를 떨굴 확률
export const BOSS_MATS = 12;          // 두목은 재료 한 움큼 + 증표 하나
export const TIER_COUNT = 15;         // 사냥터 수 = 장비 사다리 칸 수(×하급·상급)
const CRAFT_MATS = { weapon: 80, armor: 60, hat: 48, acc: 60 };
const CRAFT_BOSS = { weapon: 4, armor: 3, hat: 3, acc: 3 };
// step: 0..29 — 사냥터 k = floor(step/2)+1, 홀수면 상급
export const stepMap = (step) => Math.floor(step / 2) + 1;
export const stepUpper = (step) => step % 2 === 1;
export const craftLevel = (k) => MAPS[k]?.lv[1] || 1;
// 조합 장비 수치 = 아이템 레벨 기본치 × 사다리 배수. 아이템 레벨만으로는 뒤로 갈수록 한 사냥터에
// 7%밖에 안 올라서(기본치가 레벨에 곧게 오른다) 사다리 한 칸마다 ×1.12^½을 더 얹는다.
// 상급은 아이템 레벨이 이 사냥터와 다음 사냥터의 가운데 — 그래서 '하급 < 상급 < 다음 하급'이 늘 선다.
export const craftIlv = (step) => {
  const k = stepMap(step);
  if (!stepUpper(step)) return craftLevel(k);
  return k < TIER_COUNT ? Math.round((craftLevel(k) + craftLevel(k + 1)) / 2) : craftLevel(k) + 4;
};
export const stepMult = (step) => 1.12 ** (step / 2);
// 빛깔(등급 색)은 사냥터 셋마다 한 칸씩 — 일반 · 고급 · 희귀 · 영웅 · 전설
export const stepGrade = (step) => Math.min(4, Math.floor((stepMap(step) - 1) / 3));
// 조합법: 무엇을 내면 이것이 되나
export function recipeOf(slot, step) {
  const k = stepMap(step);
  const up = stepUpper(step);
  const mats = { [k]: Math.round(CRAFT_MATS[slot] * (up ? 1.5 : 1)) };
  if (up) mats[bossKey(k)] = CRAFT_BOSS[slot];
  // 받는 장비: 상급은 같은 사냥터 하급, 하급은 앞 사냥터 하급이나 상급 (1번 하급은 없음)
  const from = up ? [step - 1] : k > 1 ? [step - 1, step - 2] : [];
  return { slot, step, mats, from, gold: Math.round((30 + craftLevel(k) * 10) * (up ? 2 : 1)) };
}
// 장비 이름 — 사냥터 머리말 + 칸 이름 (상급은 앞에 '상급')
const STEP_PREFIX = [null, '청죽', '사철', '빙정', '혈석', '귀화', '운모', '마철', '수정', '금강', '야명', '매화', '독룡', '현빙', '해왕', '천외'];
export const ENHANCE_MAX = 10;
export const ENHANCE_STEP = 0.1;                 // 한 단계에 기본 수치 +10%
export const enhanceRate = (lv) => Math.max(0.4, 1 - lv * 0.07);   // +0→1 100%, +9→10 40%
// 은자가 쌓이기만 하지 않게 — 사냥터를 옮겨 새 장비를 낄 때마다 다시 강화하는 데 쓰인다(시뮬로 맞춤)
export const enhanceCost = (ilv, lv) => Math.round((50 + ilv * 15) * (lv + 1) ** 1.6);
export const sellPrice = (item) => Math.round((3 + item.ilv * 1.5) * (item.step != null ? (stepUpper(item.step) ? 2 : 1) : GRADES[item.grade].mult ** 2) * (1 + (item.plus || 0) * 0.2));
// 이름: 지역마다 무기 결이 다르면 좋겠지만 단순하게 — 등급·칸 이름
const SLOT_NOUN = {
  weapon: { sword: '검', fist: '권갑', fan: '부채', poison: '독낭', ring: '지환' },
  armor: '도포', hat: '두건', acc: '옥패',
};
export const itemName = (item, job) => {
  const n = item.slot === 'weapon' ? (SLOT_NOUN.weapon[job] || '검') : SLOT_NOUN[item.slot];
  if (item.step != null) return `${stepUpper(item.step) ? '상급 ' : ''}${STEP_PREFIX[stepMap(item.step)]}${n}`;
  return `${GRADES[item.grade].name} ${n}`;
};

// ---------- 물약 ----------
export const POTION_HEAL = 0.35;
export const potionPrice = (level) => 5 + level;
export const POTION_AT = 0.45;        // 체력이 이 아래면 자동으로 먹는다
export const POTION_GAP = 0.8;
export const REST_HEAL = 0.25;        // 마을에서는 초당 최대 체력의 25%

// 비급 — 은자로 스탯 점수 +1. 살 때마다 18%씩 비싸진다. 강화를 다 한 뒤로 은자가 쌓이기만 했다(시뮬).
export const statBookCost = (n) => Math.round(5000 * 1.18 ** n);

// ---------- 무인 수치 ----------
export const CRIT_DMG = 1.8;
export const BASE_ATK_SEC = 0.85;     // 평타 간격(초)
export const HERO_SPEED = 170;
export const MELEE_RANGE = 70;
export const DEATH_EXP_LOSS = 0.05;
export const RETURN_SEC = 3;

// ---------- 방치 ----------
export const OFFLINE_CAP_SEC = 10 * 3600;
export const RATE_WINDOW_SEC = 300;
