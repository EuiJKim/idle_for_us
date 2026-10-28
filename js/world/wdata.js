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
export const expToNext = (L) => Math.round(27 * L ** 2.3 * (1 + (L / 30) ** 2.2));   // v110: 스킬 레벨·옵션으로 사냥이 빨라져 ×1.35
export const STAT_PER_LEVEL = 3;
export const STATS = [
  { id: 'str', name: '힘', desc: '공격력 +3 · 공격력 +0.3%' },
  { id: 'dex', name: '민첩', desc: '치명 +0.4%p · 공격 속도 +1%' },
  { id: 'vit', name: '체력', desc: '최대 체력 +20 · 최대 체력 +0.3% · 방어 +0.2' },
  { id: 'int', name: '내공', desc: '스킬 피해 +3% · 체력 회복 +0.12/초' },
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
// 바람의나라처럼 **칸** 위를 움직인다 — 사냥터 하나가 9×19칸, 화면 한 장에 통째로 들어온다
// (그리는 쪽이 이 크기에 맞춰 카메라를 물린다). 무인·몹은 한 칸씩 미끄러지듯 옮겨 가고,
// 한 칸에는 하나만 선다. 근접은 앞뒤좌우 바로 옆 칸에서 친다.
// (처음엔 1300×1700 자유 이동이었다 — 화면에 사냥터 한 귀퉁이만 보였다)
export const TILE = 64;
export const COLS = 9;
export const ROWS = 19;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;
export const tileCenter = (c) => (c + 0.5) * TILE;
export const MOBS_ALIVE = 18;
export const RESPAWN_SEC = 5;

// ---------- 지역과 구역 ----------
// 사냥터(지역)마다 구역 셋(1·2·3 — 뒤로 갈수록 몹 레벨이 높다)과 맨 끝 **두목 구역**이 있다.
// 두목 구역에는 정예 몇과 그 지역 두목이 늘 있고, 잡히면 BOSS_RESPAWN초 뒤에 다시 난다.
// 두목 증표(상급 조합 재료)는 두목 구역에서만 나온다. 들판 구역에는 두목이 없다.
// (전에는 사냥터마다 4분에 한 번 두목이 들판 가운데 났다)
//
// 지역 1~15: 옛 지역 그림을 쓰는 보통 사냥터, 레벨 1~98.
// 지역 16~27: **십이지왕**(레벨 99부터). 제12왕 권왕이 가장 약하고 제1왕 검왕이 가장 강하다.
//   왕마다 떨구는 재료·증표가 다르다. 왕은 등장 연출이 따로 있고, 그 지역 장비를 더 자주 떨군다.
export const BOSS_RESPAWN = 45;
export const KING_INTRO_SEC = 3.2;   // 십이지왕 등장 연출 길이
export const BOSS_INTRO_SEC = 2.2;   // 보통 두목 등장 연출 길이
export const BOSS_ROOM_MOBS = 8;
export const NORMAL_ZONES = 15;
// 십이지왕 — 약한 순(제12왕 → 제1왕). art: 그림을 빌려 올 옛 지역. desc는 줄거리 한두 줄.
export const KINGS = [
  { no: 12, title: '권왕', real: '강후', art: 9, mat: '유혼석', prefix: '유혼', hanja: '拳王', skill: '유혼절명권',
    desc: '십이지왕의 마지막 왕. 타고난 살기로 수많은 이를 죽인 주먹 — 유혼절명권.',
    look: { robe: '#1c1917', trim: '#dc2626', head: 'band', band: '#7f1d1d', weapon: 'fist', aura: '#ef4444', scale: 1.5 } },
  { no: 11, title: '철왕', real: '기사후', art: 13, mat: '기관 부품', prefix: '기관', hanja: '鐵王', skill: '기관술',
    desc: '천재 기관 장인. 철가면 아래에서 죽은 왕들의 인형을 빚는다.',
    look: { robe: '#374151', trim: '#9ca3af', head: 'mask', weapon: 'axe', scale: 1.45 } },
  { no: 10, title: '음왕', real: '신류', art: 5, mat: '귀혼현', prefix: '귀혼', hanja: '音王', skill: '귀혼음',
    desc: '앞을 못 보는 음공의 천재. 귀혼음으로 죽은 혼을 불러낸다.',
    look: { robe: '#312e81', trim: '#a5b4fc', head: 'hat', weapon: 'fan', scale: 1.45 } },
  { no: 9, title: '혈왕', real: '', art: 4, mat: '혈정', prefix: '혈해', hanja: '血王', skill: '혈해마공',
    desc: '북해에서 음모를 꾸미는 잔혹한 왕. 핏물에 잠긴 채 나타난다.',
    look: { robe: '#7f1d1d', trim: '#fecaca', head: 'topknot', weapon: 'claw', aura: '#dc2626', scale: 1.5 } },
  { no: 8, title: '목왕', real: '백천경', art: 1, mat: '천혼목', prefix: '천혼', hanja: '木王', skill: '목형천혼술',
    desc: '목형천혼술의 주인. 무림맹주 가문의 옛 일과 얽혀 있다.',
    look: { robe: '#14532d', trim: '#86efac', head: 'topknot', weapon: 'sword', beard: true, scale: 1.45 } },
  { no: 7, title: '화왕', real: '차이란', art: 10, mat: '야우 꽃잎', prefix: '야우', hanja: '華王', skill: '천녀야우장',
    desc: '살수 조직 가인교의 주인. 천하제일미 대회에 모습을 드러낸다 — 천녀야우장.',
    look: { robe: '#be185d', trim: '#fbcfe8', head: 'topknot', weapon: 'fan', scale: 1.4 } },
  { no: 6, title: '암왕', real: '흑사린', art: 7, mat: '암야석', prefix: '암야', hanja: '暗王', skill: '암천야신공',
    desc: '낮에는 가장 약하고 밤에는 가장 강한 왕 — 암천야신공.',
    look: { robe: '#0a0a0a', trim: '#6b21a8', head: 'hood', weapon: 'dagger', aura: '#7c3aed', scale: 1.45 } },
  { no: 5, title: '환왕', real: '', art: 6, mat: '환영 비단', prefix: '환영', hanja: '幻王', skill: '환영술',
    desc: '혈교의 후예인 쌍둥이 중 사내. 교주의 곁에 조언자로 숨어든 화공.',
    look: { robe: '#4c1d95', trim: '#c4b5fd', head: 'mask', weapon: 'fan', scale: 1.45 } },
  { no: 4, title: '살왕', real: '', art: 8, mat: '명부 영패', prefix: '명부', hanja: '殺王', skill: '명부살법',
    desc: '최고의 살수 단체 명부의 일인자.',
    look: { robe: '#18181b', trim: '#991b1b', head: 'mask', weapon: 'dagger', scale: 1.45 } },
  { no: 3, title: '투왕', real: '천야', art: 2, mat: '투신 철편', prefix: '투신', hanja: '鬪王', skill: '권갑 투신',
    desc: '이기는 것만이 값이라 여기는 왕. 권갑 투신과 호신갑을 두른다.',
    look: { robe: '#78350f', trim: '#fbbf24', head: 'bald', weapon: 'fist', scale: 1.55 } },
  { no: 2, title: '도왕', real: '냉무상', art: 11, mat: '일월 도편', prefix: '일월', hanja: '刀王', skill: '일월암혈도법',
    desc: '도법의 최고수. 검왕에 버금간다 — 일월암혈도법.',
    look: { robe: '#1e293b', trim: '#f8fafc', head: 'band', band: '#111', weapon: 'saber', scale: 1.5 } },
  { no: 1, title: '검왕', real: '악군학', art: 15, mat: '무형 검편', prefix: '무형', hanja: '劍王', skill: '무형신검',
    desc: '십이지왕 시대의 천하제일인. 가장 강한 왕 — 무형신검.',
    look: { robe: '#f8fafc', trim: '#fbbf24', head: 'topknot', hair: '#e5e7eb', weapon: 'sword', beard: true, aura: '#fde68a', scale: 1.6 } },
];
export const ZONE_COUNT = NORMAL_ZONES + KINGS.length;
export const kingOf = (z) => (z > NORMAL_ZONES ? KINGS[z - NORMAL_ZONES - 1] : null);
// 지역 레벨: 보통 1~98 (지역마다 일곱 레벨), 십이지왕 99~150 (왕마다 다섯 레벨 남짓)
export function zoneLv(z) {
  if (z <= NORMAL_ZONES) { const lo = 1 + Math.round((z - 1) * 6.5); return [lo, lo + 6]; }
  const lo = 99 + Math.round((z - NORMAL_ZONES - 1) * 4.25);
  return [lo, lo + 4];
}
export const ZONES_W = [null];
for (let z = 1; z <= ZONE_COUNT; z++) {
  const k = kingOf(z);
  const art = k ? k.art : z;
  ZONES_W.push({
    id: z, art, king: k,
    name: k ? `제${k.no}왕 ${k.title}` : ZONES[z].name,
    lv: zoneLv(z),
    mobs: ZONES[art].mobs,
    boss: k ? { name: `${k.title}${k.real ? ` ${k.real}` : ''}`, look: k.look } : ZONES[z].boss,
  });
}
export const zoneOfW = (z) => ZONES_W[z] || null;
// 구역 번호: 지역 z의 a구역 = z×10 + a (a=1·2·3 들판, 4 두목). 0은 마을.
export const mapId = (z, a) => z * 10 + a;
export const BOSS_AREA = 4;
function areaLv(zl, a) {
  const [lo, hi] = zl;
  if (a === BOSS_AREA) return [lo + Math.round((hi - lo) * 2 / 3), hi];
  return [lo + Math.round((hi - lo) * (a - 1) / 3), lo + Math.round((hi - lo) * a / 3)];
}
export const MAPS = [{ id: 0, name: '객잔 마을', town: true, zone: 0, area: 0, art: 0, lv: [0, 0], mobs: ZONES[0].mobs, boss: ZONES[0].boss }];
for (let z = 1; z <= ZONE_COUNT; z++) {
  const zn = ZONES_W[z];
  for (let a = 1; a <= BOSS_AREA; a++) {
    MAPS.push({
      id: mapId(z, a), zone: z, area: a, art: zn.art, king: zn.king,
      name: a === BOSS_AREA ? `${zn.name} · 두목` : `${zn.name} ${a}`,
      zoneName: zn.name,
      bossRoom: a === BOSS_AREA,
      lv: areaLv(zn.lv, a),
      mobs: zn.mobs, boss: zn.boss,
    });
  }
}
const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));
export const mapOf = (id) => MAP_BY_ID[id] || MAPS[0];
export const hasMap = (id) => !!MAP_BY_ID[id];
// 옛 세이브(사냥터 번호 1~15)를 새 구역 번호로
export const oldMapToNew = (k) => (k >= 1 && k <= NORMAL_ZONES ? mapId(k, 1) : 0);

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
export const MOB_AGGRO = 200;      // 이만큼(세 칸 남짓) 붙으면 쫓아온다
export const MOB_SPEED = 70;       // 쫓을 때 한 칸에 0.9초
export const MOB_REACH = 70;       // 몹은 바로 옆 칸(앞뒤좌우)에서 친다 — 두목은 대각선까지

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
  { id: 5, name: '지왕', color: '#f43f5e', mult: 4.2, w: 0 },     // 십이지왕 장비 빛깔
];
export const BAG_SIZE = 30;
// 아이템 기본 수치 (등급·강화 전)
// v110: 장비가 강함의 2/3 남짓, 레벨·스탯이 1/3 남짓 — 공격력 레벨당 3·힘 3, 체력 레벨당 25·체력 20,
// 장비 기본치 ×GEAR. 대신 장비는 등급(레어~신화 ×1~2)·강화·돌파(×3.2)로 크게 자란다.
export const GEAR = 0.5;
export const itemBase = (slot, ilv) => {
  switch (slot) {
    case 'weapon': return { atk: (5 + 3.2 * ilv) * GEAR };
    case 'armor': return { hp: (22 + 13 * ilv) * GEAR };
    case 'hat': return { hp: (10 + 6 * ilv) * GEAR, def: 1 + ilv * 0.35 };
    case 'acc': return { crit: 0.01 + ilv * 0.0006, atkPct: 0.02 + ilv * 0.0012 };
    default: return {};
  }
};
// ---------- 재료와 조합 ----------
// 장비는 뽑기(드랍)로 얻지 않는다. 바람의나라 조합처럼 — 몹이 사냥터마다 정해진 재료를,
// 두목이 증표를 떨구고, 마을 대장장이가 **아래 장비 + 재료 + 은자**로 위 장비를 만든다.
// 장비 사다리: 사냥터마다 둘 — 하급(그 사냥터 재료) · 상급(하급 + 재료 + 두목 증표).
// 다음 사냥터 하급은 앞 사냥터 장비(하급이든 상급이든)를 재료로 먹는다. 1번 하급은 재료만.
// 재료는 지역 번호로 든다(지역의 구역 셋·두목 구역이 같은 재료를 떨군다). 십이지왕은 왕마다 다르다.
export const MATS = [null, '청죽 마디', '사막 철편', '설원 빙정', '혈석', '귀화석', '운모 조각', '마철',
  '수정 비늘', '금강석', '야명주', '매화철', '독초 정수', '현빙옥', '산호', '천외운철', ...KINGS.map((k) => k.mat)];
export const MAT_COLORS = [null, '#86efac', '#fcd34d', '#bae6fd', '#f87171', '#a5b4fc', '#e0f2fe', '#c084fc',
  '#67e8f9', '#fde68a', '#fef9c3', '#fda4af', '#bef264', '#e2e8f0', '#fb7185', '#f0abfc',
  '#fca5a5', '#cbd5e1', '#a5b4fc', '#ef4444', '#4ade80', '#f9a8d4', '#a78bfa', '#c4b5fd', '#fda4af', '#fbbf24', '#e2e8f0', '#fef3c7'];
// 두목 증표는 재료 주머니에 'b사냥터' 열쇠로 든다
export const bossKey = (k) => `b${k}`;
export const matName = (key) => (String(key)[0] === 'b' ? `${ZONES_W[+String(key).slice(1)]?.boss?.name || '두목'}의 증표` : MATS[key]);
export const matColor = (key) => (String(key)[0] === 'b' ? (kingOf(+String(key).slice(1)) ? '#f43f5e' : '#fde68a') : MAT_COLORS[key]);
export const MAT_RATE = 0.5;          // 몹 하나가 재료 하나를 떨굴 확률
export const BOSS_MATS = 12;          // 두목은 재료 한 움큼 + 증표 하나
export const TIER_COUNT = ZONE_COUNT; // 지역 수 = 장비 사다리 칸 수(×하급·상급)
const CRAFT_MATS = { weapon: 40, armor: 30, hat: 24, acc: 30 };   // 지역이 일곱 레벨이라 한 지역에 오래 안 머문다
const CRAFT_BOSS = { weapon: 4, armor: 3, hat: 3, acc: 3 };
// step: 0..53 — 지역 k = floor(step/2)+1, 홀수면 상급
export const stepMap = (step) => Math.floor(step / 2) + 1;
export const stepUpper = (step) => step % 2 === 1;
export const craftLevel = (k) => ZONES_W[k]?.lv[1] || 1;
// 조합 장비 수치 = 아이템 레벨 기본치 × 사다리 배수. 아이템 레벨만으로는 뒤로 갈수록 한 사냥터에
// 7%밖에 안 올라서(기본치가 레벨에 곧게 오른다) 사다리 한 칸마다 ×1.12^½을 더 얹는다.
// 상급은 아이템 레벨이 이 사냥터와 다음 사냥터의 가운데 — 그래서 '하급 < 상급 < 다음 하급'이 늘 선다.
export const craftIlv = (step) => {
  const k = stepMap(step);
  if (!stepUpper(step)) return craftLevel(k);
  return k < TIER_COUNT ? Math.round((craftLevel(k) + craftLevel(k + 1)) / 2) : craftLevel(k) + 4;
};
export const stepMult = (step) => 1.12 ** (step / 2);
// 빛깔(등급 색)은 지역 셋마다 한 칸씩 — 일반 · 고급 · 희귀 · 영웅 · 전설, 십이지왕 장비는 '지왕'
export const stepGrade = (step) => (stepMap(step) > NORMAL_ZONES ? 5 : Math.min(4, Math.floor((stepMap(step) - 1) / 3)));
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
const STEP_PREFIX = [null, '청죽', '사철', '빙정', '혈석', '귀화', '운모', '마철', '수정', '금강', '야명', '매화', '독룡', '현빙', '해왕', '천외', ...KINGS.map((k) => k.prefix)];
// 강화 +1~+10, 그 위로 **돌파** +11~+15(조합 장비만). 돌파는 두목 증표가 더 들고, 한 단계가 더 크다.
export const ENHANCE_MAX = 15;
export const ENHANCE_NORMAL = 10;
export const ENHANCE_STEP = 0.12;                // +1~+10: 한 단계에 기본 수치 +12%
export const BREAK_STEP = 0.2;                   // 돌파 +11~+15: 한 단계에 +20% (+15면 3.2배)
export const enhanceMult = (plus) => 1 + Math.min(plus, ENHANCE_NORMAL) * ENHANCE_STEP + Math.max(0, plus - ENHANCE_NORMAL) * BREAK_STEP;
export const breakMarks = (plus) => (plus >= ENHANCE_NORMAL ? plus - ENHANCE_NORMAL + 1 : 0);   // +10→11 증표 1 … +14→15 증표 5
// 강화에는 은자와 함께 그 장비 지역의 재료가 든다 — 재료를 넣을수록 장비가 세진다
export const enhanceMatsN = (plus) => 4 + plus * 3;
export const BOSS_ITEM_RATE = 0.12;              // 두목이 그 지역 하급 장비를 떨굴 확률
export const KING_ITEM_RATE = 0.3;               // 십이지왕은 더 자주
export const enhanceRate = (lv) => (lv < ENHANCE_NORMAL ? Math.max(0.4, 1 - lv * 0.07) : Math.max(0.12, 0.3 - (lv - ENHANCE_NORMAL) * 0.045));   // +9→10 40% · 돌파 30%→12%
// 은자가 쌓이기만 하지 않게 — 사냥터를 옮겨 새 장비를 낄 때마다 다시 강화하는 데 쓰인다(시뮬로 맞춤)
export const enhanceCost = (ilv, lv) => Math.round((50 + ilv * 15) * (lv + 1) ** 1.6);
export const sellPrice = (item) => Math.round((3 + item.ilv * 1.5) * (item.step != null ? (stepUpper(item.step) ? 2 : 1) * (1 + (item.rar || 0)) ** 2 : GRADES[item.grade].mult ** 2) * (1 + (item.plus || 0) * 0.2));
// ---------- 장비 등급과 스킬 옵션 (v110) ----------
// 같은 장비라도 등급이 넷 — 레어 · 유니크 · 전설 · 신화. 등급이 높을수록 기본 수치가 크고,
// 스킬을 키우는 옵션이 붙는다(1차 스킬 범위 · 2차 스킬 피해 …). 신화에는 사기적인 특수 효과가 하나 더.
// 얻는 길: 조합(대부분 레어) · 두목 드랍(더 잘 뜬다) · 대장장이 **승급**(재료·증표·은자로 한 등급 위, 확정).
export const RARITY = [
  { id: 0, name: '레어', color: '#60a5fa', mult: 1, opts: 1 },
  { id: 1, name: '유니크', color: '#c084fc', mult: 1.25, opts: 1 },
  { id: 2, name: '전설', color: '#fb923c', mult: 1.55, opts: 2 },
  { id: 3, name: '신화', color: '#f43f5e', mult: 2.0, opts: 2, special: true },
];
export const RARITY_GRADE = [2, 3, 4, 5];       // 칼빛·테두리 색 (옛 GRADES 자리)
export const CRAFT_RAR_W = [82, 15, 3, 0];       // 조합으로 만들 때
export const BOSS_RAR_W = [45, 38, 14, 3];       // 두목 드랍
export const KING_RAR_W = [20, 40, 30, 10];      // 십이지왕 드랍
export const rollRarity = (w, rng) => {
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
};
// 승급 비용: 그 장비 지역 재료 · 증표 · 은자
export const promoteCost = (it) => {
  const r = (it.rar || 0) + 1;
  const k = stepMap(it.step);
  return { key: k, mats: 30 * r, marks: 2 * r, gold: Math.round((30 + craftLevel(k) * 10) * 3 * r) };
};
// 스킬 옵션: s는 스킬 칸(0 1차 · 1 2차 · 2 3차). 값은 등급별.
export const SKILL_OPTS = {
  dmg: { name: '피해', fmt: 'pct', vals: [0.12, 0.22, 0.35, 0.6], slots: [0, 1, 2] },
  range: { name: '범위', fmt: 'pct', vals: [0.1, 0.18, 0.28, 0.45], slots: [1, 2] },
  splash: { name: '범위(주변 적도 맞는다)', fmt: 'pct', vals: [0.25, 0.4, 0.6, 1.0], slots: [0] },
  cd: { name: '숨', fmt: 'neg', vals: [0.08, 0.12, 0.18, 0.3], slots: [0, 1, 2] },
  cost: { name: '체력 소모', fmt: 'neg', vals: [0.15, 0.25, 0.4, 0.6], slots: [1, 2] },
  crit: { name: '치명', fmt: 'pp', vals: [0.06, 0.1, 0.16, 0.25], slots: [0, 1, 2] },
};
// 신화 특수 효과 — 하나만
export const MYTHIC = {
  echo: { name: '30% 확률로 한 번 더 터진다', slots: [0, 1, 2] },
  free: { name: '체력을 쓰지 않는다', slots: [1, 2] },
  reset: { name: '적을 쓰러뜨리면 숨이 바로 돈다', slots: [0, 1, 2] },
};
export const SKILL_ORDINAL = ['1차', '2차', '3차'];
export function rollSkillOpts(rar, rng) {
  const out = [];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  for (let i = 0; i < RARITY[rar].opts; i++) {
    const s = Math.floor(rng() * 3);
    const keys = Object.keys(SKILL_OPTS).filter((k) => SKILL_OPTS[k].slots.includes(s) && !out.some((o) => o.s === s && o.k === k));
    const k = pick(keys);
    out.push({ s, k, v: SKILL_OPTS[k].vals[rar] });
  }
  if (RARITY[rar].special) {
    const s = Math.floor(rng() * 3);
    const sp = pick(Object.keys(MYTHIC).filter((k) => MYTHIC[k].slots.includes(s)));
    out.push({ s, sp });
  }
  return out;
}
export function optText(o) {
  const sk = SKILL_ORDINAL[o.s];
  if (o.sp) return `${sk} 스킬: ${MYTHIC[o.sp].name}`;
  const d = SKILL_OPTS[o.k];
  const v = d.fmt === 'pp' ? `+${Math.round(o.v * 100)}%p` : d.fmt === 'neg' ? `-${Math.round(o.v * 100)}%` : `+${Math.round(o.v * 100)}%`;
  return `${sk} 스킬 ${d.name} ${v}`;
}

// ---------- 스킬 레벨 (v110) ----------
// 1차 전직(레벨 15)부터 레벨이 오를 때마다 스킬 점수 1. 스킬 레벨 n → n+1에 점수 n.
// 한 레벨에 피해 +7% · 숨 -2%. 5레벨에 범위 +15%(1차는 주변 적 20%), 10레벨에 범위 +30%(1차 40%) · 치명 +10%p.
export const SKILL_LV_MAX = 10;
export const SKILL_PT_FROM = 15;
export const skillLvCost = (lv) => lv;
export function skillLvMods(slot, lv) {
  const m = { dmg: (lv - 1) * 0.07, cd: (lv - 1) * 0.02, range: 0, splash: 0, crit: 0 };
  if (lv >= 5) { if (slot === 0) m.splash += 0.2; else m.range += 0.15; }
  if (lv >= 10) { if (slot === 0) m.splash += 0.2; else m.range += 0.15; m.crit += 0.1; }
  return m;
}

// 이름: 지역마다 무기 결이 다르면 좋겠지만 단순하게 — 등급·칸 이름
const SLOT_NOUN = {
  weapon: { sword: '검', fist: '권갑', fan: '부채', poison: '독낭', ring: '지환' },
  armor: '도포', hat: '두건', acc: '옥패',
};
export const itemName = (item, job) => {
  const n = item.slot === 'weapon' ? (SLOT_NOUN.weapon[job] || '검') : SLOT_NOUN[item.slot];
  if (item.starter) return `수련용 ${n}`;
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
export const HERO_SPEED = 200;      // 한 칸에 0.32초 (칸 길은 비스듬히 못 가서 자유 이동보다 조금 빠르게)
export const MELEE_RANGE = 70;
export const DEATH_EXP_LOSS = 0.05;
export const RETURN_SEC = 3;

// ---------- 방치 ----------
export const OFFLINE_CAP_SEC = 10 * 3600;
export const RATE_WINDOW_SEC = 300;

// ---------- 문파 ----------
// 코드로 만들고 들어간다(최대 10명). 문파 레벨은 출석·기부로 오르고, 레벨마다 전원 공격력 +2%.
// 문파 창고에 재료를 넣어 두면 문파원이 꺼내 쓴다(조합 재료 나눔 — 같이 하는 맛).
export const GUILD_MAX = 10;
export const GUILD_LV_EXP = 200;
export const GUILD_LV_MAX = 20;
export const guildLevel = (exp) => Math.min(GUILD_LV_MAX, 1 + Math.floor((exp || 0) / GUILD_LV_EXP));
export const guildAtk = (exp) => (guildLevel(exp) - 1) * 0.02;
export const GUILD_CHECKIN_EXP = 20;
export const GUILD_DONATE_EXP = 10;
export const GUILD_DONATE_PER_DAY = 3;
export const guildDonateCost = (level) => Math.round(300 + level * 40);
