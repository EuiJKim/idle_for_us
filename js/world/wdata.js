// 바람식 개편 — 데이터. 설계: docs/바람식_개편.md
//
// 옛 판(관문·수련·무공 여덟 …)과 따로 선다. 그림(지역·몹 생김새·캐릭터 무기)만 옛 data.js에서 빌린다.
// **숫자는 보통 숫자다.** 레벨 150에서도 몹 체력이 몇십만이라 Big이 필요 없다.
import { ZONES, JOBS, CLASS_SKILLS, RANKS } from '../data.js';
import { areaMobs } from './wmobs.js';
import { MASTERS } from './wmasters_data.js';
import { FAC_MAT_INFO, isFacMat, lineMats } from './wline.js';
import { TRANSFORMS, setOf, SET_PIECE, STONES, isStoneKey, LORD_MATS, isLordMat } from './wgear.js';

export const SAVE_KEY = 'ifu-world-v1';
export const LEVEL_MAX = 150;
// v446 만렙은 99(바람의나라) — 99 뒤의 경험치는 「수련」 단계로 쌓인다(수련 1 = 옛 레벨 100 … 수련 51 = 150).
//   수련마다 레벨처럼 능력치·무공 점수가 오르고, 수련 31에 5차 전직. 속셈(전투·사냥터·두목 비교)은 그대로 레벨 99+수련으로 센다.
export const LEVEL_SHOW = 99;
export const trainOf = (L) => Math.max(0, (L | 0) - LEVEL_SHOW);
export const lvShort = (L) => ((L | 0) <= LEVEL_SHOW ? `Lv.${L | 0}` : `Lv.99·수련${(L | 0) - LEVEL_SHOW}`);
export const lvText = (L) => ((L | 0) <= LEVEL_SHOW ? `레벨 ${L | 0}` : `수련 ${(L | 0) - LEVEL_SHOW}`);
export const lvNum = (L) => ((L | 0) <= LEVEL_SHOW ? `${L | 0}` : `수련${(L | 0) - LEVEL_SHOW}`);

// ---------- 레벨 ----------
// 뒤로 갈수록 가파르다: 첫 시간 Lv15~20(1차 전직) · 하루 Lv50 남짓 · 일주일 Lv85 안팎 · 150은 몇 달.
// 처음엔 18·L^2.25로 두었더니 열한 시간에 Lv100을 넘었다(시뮬).
// v261: 만렙을 '하루 두 시간 접속 + 방치'로 실사용 2주에 맞춘다(전엔 이틀). 레벨 구간마다 배율 — 첫 시간의 손맛(~Lv12)은 그대로.
// [레벨, 배율] 사이는 곧게 잇는다. 시뮬: tests/../audit 'simR' (1시간 접속 · 11시간 방치 × 하루 두 번)
// v372: Lv90~120 벽 — 성장 장비가 ilv 100에서 멈추고 첫 왕 세트까지 전투력이 거의 그대로라 레벨당 시간이 4배로 뛰었다(시뮬 85:6h → 120:30h).
//   그 구간 배율을 낮춰 고르게(85:5.5h · 100:9h · 110:13.5h · 120:19h) — 75→125 785h → 510h. 만렙 쪽(135~150)은 그대로.
export const EXP_SLOW = [[1, 1], [12, 1], [25, 1.8], [40, 2.6], [60, 4.5], [75, 6], [85, 6.4], [95, 5.6], [110, 4.6], [120, 5.0], [135, 7.0], [150, 7.8]];
export function expSlow(L) {
  for (let i = 1; i < EXP_SLOW.length; i++) {
    const [l1, k1] = EXP_SLOW[i];
    if (L <= l1) { const [l0, k0] = EXP_SLOW[i - 1]; return k0 + (k1 - k0) * ((L - l0) / Math.max(1, l1 - l0)); }
  }
  return EXP_SLOW[EXP_SLOW.length - 1][1];
}
export const expBase = (L) => 27 * L ** 2.3 * (1 + (L / 30) ** 2.2);   // v261 배율 없는 곡선(애완동물은 이것으로 — 무인 곡선을 늦춰도 애완동물까지 늦지 않게)
export const expToNext = (L) => Math.round(expBase(L) * expSlow(L));   // v110: 스킬 레벨·옵션으로 사냥이 빨라져 ×1.35 · v261 구간 배율
export const STAT_PER_LEVEL = 3;
// v262 스탯의 제 몫 — 점당 · 상한
export const STAT_ROLE = { strBoss: 0.0015, strBossMax: 0.6, dexMove: 0.0008, dexMoveMax: 0.3, vitRed: 0.0003, vitRedMax: 0.15, intCdr: 0.0004, intCdrMax: 0.15 };
export const STATS = [
  { id: 'str', name: '힘', desc: '공격력 +3 · 공격력 +0.3% · 두목 피해 +0.15%' },
  { id: 'dex', name: '민첩', desc: '치명 +0.4%p · 공격 속도 +1% · 걸음 +0.08%' },
  { id: 'vit', name: '체력', desc: '최대 체력 +20 · 최대 체력 +0.3% · 방어 +0.2 · 받는 피해 -0.03% · 체력을 쓰는 무공이 그만큼 세게' },   // v441
  { id: 'int', name: '내공', desc: '스킬 피해 +0.7% · 체력 회복 +0.12/초 · 무공 숨 -0.04%' },
];
// 레벨이 오르면 겉모습도 한 단계씩 (옛 경지 그림 스물을 레벨에 나눠 쓴다)
export const lookTierOf = (level) => Math.min(RANKS.length - 1, Math.floor((level - 1) / 8));

// ---------- 캐릭터 ----------
// 결(평타 특성) — v118에 다섯 마존의 설정에 맞춰 새로 짰다. 하나씩 세기가 비슷하게(시뮬 meter로 맞춤).
//  검사(일화검존): 평타 네 번째마다 꽃잎 검기가 둘레를 벤다 + 두목 피해
//  권마(불패권마): 받는 피해가 줄고 손이 빠르다 — 쓰러지지 않는다
//  환마(섭혼마존): 맞은 적이 느려지고 더 아프게 맞는다 + 준 피해로 체력을 빨아들인다
//  독마(독왕): 맞은 적이 중독 — 중독된 채 쓰러지면 독이 둘레로 번진다
//  극악소마: 붙은 적이 공포에 질려 공격을 머뭇거린다 + 붙으면 더 아프다 + 치명 피해
export const CLASSES = {
  sword: { base: { str: 6, dex: 4, vit: 5, int: 3 }, trait: '일화(一花) — 팔마존 중 가장 빠르다: 이동 속도 +15% · 평타 네 번째마다 꽃잎 검기가 둘레를 벤다(220%) · 두목에게 주는 피해 +10%',
    move: 0.15, boss: 1.1, flower: { every: 4, mult: 2.2, r: 150 }, atkK: 1.12, dmgRed: 0.1 },   // v397 근접 — 받는 피해 -10%   // v396 atkK — 전직 20·50·100·130에 만렙이 14일로 늦었다
  // 권마는 평타가 곧 무공 — 평타 피해가 레벨마다 1%씩 붙는다. 무공은 약한 편이라 초반엔 뒤지고 후반에 앞선다.
  // v277 두목 사냥꾼 — 근접 한 적이라 사냥(무리)이 남의 1/3~1/4이고 레벨이 늦다. 대신 두목을 더 빨리(싸움 시간 ×bossTime) · 두목 경험치 ×bossExp
  fist: { base: { str: 6, dex: 6, vit: 4, int: 2 }, trait: '불패(不敗) — 평타가 곧 무공: 평타가 레벨과 함께 자란다(레벨 1에 85% → 레벨 100에 150%) · 공격 속도 +25% · 받는 피해 -20% · 두목 사냥꾼: 두목 싸움 -30% · 두목 경험치 +50% · 두목에게 주는 피해 +20%',
    speed: 1.25, dmgRed: 0.2, basicBase: 0.95, basicPerLv: 0.0065, atkK: 1.25, boss: 1.2, bossTime: 0.7, bossExp: 1.5 },   // v239: 무리 사냥이 평균의 0.8 언저리 · v320 atkK 1.08 → 1.15(시뮬 Lv150 15일 넘김 → 14.5~15일)
  // v279 탐보(貪寶) — 보물을 모으는 섭혼마존. 은자 +goldUp · 보물 원숭이 ×treasureK · 두목 가락지·귀걸이·애완동물·포획 조각 ×lootK
  fan: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '섭혼(攝魂) — 멀리서 친다 · 맞은 적이 느려지고 받는 피해 +15% · 준 피해의 2%를 빨아들인다 · 탐보(貪寶): 은자 +20% · 보물 원숭이 2배 · 두목의 가락지·귀걸이·애완동물과 포획 조각 1.5배',
    slow: true, vuln: 0.15, drain: 0.02, atkK: 1.18, goldUp: 0.2, treasureK: 2, lootK: 1.5 },   // v239: 다섯 직업 가운데 가장 약했다(사냥·단일 모두 평균의 0.7~0.9)
  poison: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '독아(毒牙) — 멀리서 친다 · 맞은 적이 중독(피해의 20%가 독으로 쌓인다) · 중독된 적이 쓰러지면 독이 둘레로 번진다 · 무리 사냥에 가장 강하다(두목은 독을 절반만 받는다) · 중독된 적은 공격 -30%',
    poison: 0.2, poisonSec: 4, spread: true, venomWeak: 0.3 },   // v448 중독된 적의 공격 -30%(독이 기운을 빼앗는다 — 독으로 천천히 잡는 동안 몰려와 쓰러지던 것)
  // v278 두목은 지속 피해(독·화상·출혈)를 BOSS_DOT_K만 받는다 — 독마 무공의 독(칠보단혼침 320%·만독지옥 200%…)이 오래 버티는 두목에게 다 들어가
  //   사냥도 가장 빠른 독마가 두목 피해까지 두목 사냥꾼(권마)보다 높았다(같은 장비 검사 대비 1.24~1.75배 → 0.85~1.3배). 사냥터 몹은 그대로.
  ring: { base: { str: 5, dex: 6, vit: 4, int: 3 }, trait: '공포(恐怖) — 붙은 적이 25% 확률로 공격을 머뭇거린다 · 붙으면 피해 +20% · 치명 피해 +15% · 두목 사냥꾼: 두목 싸움 -30% · 두목 경험치 +50% · 두목에게 주는 피해 +35%',
    fear: 0.25, critDmg: 0.15, boss: 1.35, bossTime: 0.7, bossExp: 1.5, dmgRed: 0.12 },   // v397 붙어 싸운다 — 받는 피해 -12%
};

// 다섯 마존 (v118) — 3차 전직의 끝에 닿는 이름. 캐릭터를 고를 때와 캐릭터 창에 보인다.
export const LORE = {
  sword: { title: '일화검존', real: '소연랑', house: '북천검가', men: '마검',
    text: '북천검가의 마존. 팔마존 가운데 가장 빠르게 움직인다. 불혹이 넘었으나 스물로 보이는 미인으로 늘 존댓말을 쓴다. 가식을 버리고 검에만 매달린 뒤로 꽃 한 송이 같은 검이 더 날카로워졌다.' },
  fist: { title: '불패권마', real: '단우강', house: '동권문', men: '철권',
    text: '동권문의 마존. 마존 가운데 가장 무서운 얼굴. 천마와 함께 강호를 누볐고 천마가 가장 믿는 마존이다. 권법을 쓰는 이라면 모를 수 없는 절세 권갑 \'투신\'을 낀다. 한 번도 진 적이 없다.' },
  ring: { title: '극악소마', real: '', house: '악인곡', men: '무면객',
    text: '악인곡의 마존. 가면을 쓴다. 거슬리면 앞뒤 없이 죽이지만 제 사람과 사업장은 하나하나 꼼꼼히 챙기는 \'부지런한 악당\'. 마주하는 것만으로 사람의 가장 원초적인 공포를 깨운다. 혈앙지·마극광폭장·소향비술 세 무공이 어우러지면 무적에 가깝다.' },
  poison: { title: '독왕', real: '', house: '천독림', men: '독아',
    text: '천독림의 마존. 새파랗게 어린 미소년으로 보인다. 홀로 독을 빚고 연구한다. 그의 하독이 부를 대량 학살을 온 무림이 두려워한다 — 존재 자체가 전쟁 억제기. 교가 위급하면 마지막으로 교를 지킬 마존이다.' },
  fan: { title: '섭혼마존', real: '능파소', house: '풍천교', men: '혈루',
    text: '혈교의 후신 풍천교의 교주. 섭혼술 계열 무공을 쓰는 이 가운데 가장 강하고, 그 자신에게는 섭혼술이 통하지 않는다. 독문무공은 천외혈마공(天外血魔功). 욕심이 많아 보물을 모으지만 그 욕심을 내려놓고 진짜 벗을 얻었다.' },
};

export const classOf = (id) => JOBS.find((j) => j.id === id) || null;
export const CLASS_LIST = JOBS.filter((j) => CLASSES[j.id]);   // v325 직업 바꾸기 줄

// ---------- 전직과 스킬 ----------
export const TIERS = [
  null,
  { level: 10, cost: 1000 },      // v269: 15 → 5 · v395 → 20 (전직 20 · 50 · 100 · 130) · v412 10 · 30 · 70 · 100 · 130
  { level: 30, cost: 12000 },      // v415 값도 새 레벨의 벌이에 맞춰(옛 레벨 대비 은자 벌이 0.53 · 0.61 · 0.70 · 0.77배)
  { level: 70, cost: 700000 },
  { level: 99, cost: 6000000 },    // v442 4차 = 「승급」(바람의나라 99 승급) · 전엔 100 — 4차 (v121 환마 · v123 모든 직업) — 4차 무공이 있는 직업만
  { level: 130, cost: 20000000, need: 'cheonma' },   // v435 5천만 → 2천만(사냥 벌이로 4차 ~7시간 · 5차 ~45시간이던 것 → ~18시간)   // v391 5차 — 숨은 두목을 꺾으면(직업마다) · v398 레벨 150 → 130
];
// 스킬 셋 (v118 — 다섯 마존의 무공). 차수마다 자리(slot)는 같다: 1차 한 적 · 2차 둘레 · 3차 비기.
// role은 연출표(skillfx) 열쇠 — '캐릭터:role'. hpCost는 최대 체력 대비. mult는 한 번 맞을 때의 배수.
// kind: single(한 적) · aoe(둘레) · daggers(가까운 적들에게 비수 n자루) · field(장판 — tick마다)
// 덧: hits(몇 번) · bossMult · sure(반드시 치명) · stun(초) · vuln{sec,v}(받는 피해 +v) · dot{sec,mult}(독·출혈 — 맞은 피해의 mult배를 sec초에)
//     buff{sec, speed, dmgRed, cleave}(무인에게) · lifesteal(준 피해의 몫) · far(거리 제한 없음)
// 4번째(slot 3)는 보조기(v120) — 차수와 상관없이 레벨 25에 배운다. auto: fight(싸울 때) · hurt(다쳤을 때) · poisoned(중독된 적이 많을 때)
const SK = (slot, tier, role, name, kind, o) => ({ slot, tier, role, name, kind, autoAbove: [0, 0.6, 0.6, 0][slot], ...o });
export const JOB_SKILLS = {
  sword: [
    SK(0, 1, 'frost', '일화참', 'single', { mult: 3.5, cd: 4.5, hpCost: 0, bossMult: 1.25, far: true,
      desc: '가장 빠른 걸음으로 한 적을 벤다 · 두목에겐 1.25배' }),
    SK(1, 2, 'slash', '낙화유수', 'aoe', { mult: 1.6, hits: 2, cd: 5, hpCost: 0.08, radius: 224,
      desc: '꽃잎 지듯 둘레를 두 번 벤다' }),
    SK(2, 3, 'thunder', '만화귀일', 'aoe', { mult: 5.0, cd: 9, hpCost: 0.18, radius: 288, buff: { sec: 8, speed: 0.4 },
      desc: '만 송이 검화가 하나로 — 넓게 벤 뒤 8초간 공격 속도 +40%(마검 각성)' }),
    SK(3, 0, 'sup', '유운보', 'support', { cd: 24, hpCost: 0, from: 25, auto: 'fight', buff: { sec: 8, move: 0.6, speed: 0.25, dodge: 0.2 },
      desc: '흐르는 구름 같은 걸음 — 8초간 이동 속도 +60% · 공격 속도 +25% · 공격을 20% 흘린다' }),
    SK(4, 4, 'chain4', '일화천섬', 'daggers', { mult: 1.5, n: 12, targets: 12, cd: 18, hpCost: 0.15, radius: 384, autoAbove: 0.5, blink: true,
      desc: '번개처럼 적 사이를 오가며 최대 열둘을 차례로 벤다 — 적이 적으면 같은 적을 여러 번(두목 혼자면 열두 번), 지나간 자리마다 꽃이 핀다' }),
  ],
  fist: [
    SK(0, 1, 'frost', '붕산철권', 'single', { mult: 4.4, cd: 4.5, hpCost: 0, stun: 2,
      desc: '산을 무너뜨리는 한 주먹 · 2초 기절' }),
    SK(1, 2, 'slash', '투신난무', 'aoe', { mult: 1.35, hits: 4, cd: 5, hpCost: 0.08, radius: 224,
      desc: '권갑 투신으로 둘레를 네 번 두들긴다' }),
    SK(2, 3, 'thunder', '불패금신', 'aoe', { mult: 4.2, cd: 11, hpCost: 0, radius: 288, buff: { sec: 10, dmgRed: 0.5, cleave: 0.6 },
      desc: '금빛 몸 — 충격파를 낸 뒤 10초간 받는 피해 -50% · 평타가 둘레를 친다(60%) · 체력을 쓰지 않는다' }),
    SK(3, 0, 'sup', '금종조', 'support', { cd: 28, hpCost: 0, from: 25, auto: 'hurt', hurtAt: 0.7, shield: 0.3, buff: { sec: 12 },
      desc: '금종을 뒤집어쓴 듯 — 최대 체력 30%만큼 막아 주는 보호막(12초)' }),
    SK(4, 4, 'awaken', '투신강림', 'awaken', { cd: 24, hpCost: 0.1, from: 0, autoAbove: 0.5, auto: 'fight', buff: { sec: 15, speed: 0.3, triple: 2 },
      desc: '권갑 투신이 깨어난다 — 15초간 평타 한 번에 세 대(덧 두 대는 절반) · 공격 속도 +30%' }),
  ],
  ring: [
    SK(0, 1, 'frost', '혈앙지', 'single', { mult: 2.6, cd: 4, hpCost: 0, sure: true, dot: { sec: 5, mult: 0.6 },
      desc: '피의 재앙을 짚는 손가락 · 반드시 치명 · 5초 출혈' }),
    SK(1, 2, 'slash', '마극광폭장', 'aoe', { mult: 3.2, cd: 6, hpCost: 0.12, radius: 224, stun: 1.2,
      desc: '광폭한 장력이 둘레를 휩쓴다 · 맞은 적이 공포에 1.2초 굳는다' }),
    SK(2, 3, 'thunder', '소향비술', 'daggers', { mult: 0.85, n: 12, targets: 8, cd: 9, hpCost: 0.20, radius: 288, crit: 0.1,
      desc: '비수 열두 자루가 가까운 적 여덟에게 날아든다(치명 +10%p) · 세 무공을 6초 안에 이으면 삼공조화(8초간 피해 +25%)' }),
    SK(3, 0, 'sup', '무면개방', 'support', { cd: 26, hpCost: 0, from: 25, auto: 'fight', buff: { sec: 10, fear: 0.35, critDmg: 0.3 },
      desc: '가면을 벗는다 — 10초간 붙은 적의 공포 +35%p · 치명 피해 +30%' }),
    SK(4, 4, 'triple', '삼공합일', 'triple', { cd: 22, hpCost: 0.15, autoAbove: 0.5, boost: 1.3,
      desc: '세 무공이 하나로 — 혈앙지·마극광폭장·소향비술을 한꺼번에(각 1.3배) 펼치고 삼공조화가 바로 켜진다' }),
  ],
  poison: [
    SK(0, 1, 'frost', '칠보단혼침', 'single', { mult: 3.4, cd: 5, hpCost: 0, dot: { sec: 6, mult: 3.2 },
      desc: '일곱 걸음 안에 혼이 끊기는 독침 · 6초 맹독' }),
    SK(1, 2, 'slash', '화골산', 'field', { mult: 0.8, cd: 8, hpCost: 0.10, radius: 224, field: { sec: 6, tick: 0.5, mult: 0.26 },
      desc: '뼈를 녹이는 독무를 깐다 — 6초 동안 0.5초마다' }),
    SK(2, 3, 'thunder', '만독천라', 'aoe', { mult: 2.7, cd: 10, hpCost: 0.20, radius: 288, dot: { sec: 8, mult: 1.0 },
      desc: '만 가지 독이 하늘 그물처럼 — 넓게 맞히고 8초 맹독' }),
    SK(3, 0, 'sup', '만독귀원', 'support', { cd: 18, hpCost: 0, from: 25, auto: 'poisoned', radius: 288, burst: 1, healMax: 0.2,   // v448 회복 12 → 20% · 숨 22 → 18
      desc: '흩어진 독을 한데 거둔다 — 둘레 적에게 쌓인 독을 한꺼번에 터뜨리고 최대 체력의 20% 회복' }),
    // v288 두목에게 4배 — 4차 필살인데 두목 피해의 1%도 안 됐다(칠보단혼침 한 대보다 약했다). 사냥터는 원래도 한 번에 쓸어 그대로
    SK(4, 4, 'hell', '만독지옥', 'aoe', { mult: 1.0, cd: 24, hpCost: 0.2, radius: 512, autoAbove: 0.5, dot: { sec: 10, mult: 2.0 }, bossMult: 4,
      desc: '사냥터 전체에 독비가 내린다 — 보이는 모든 적을 치고 독을 크게 쌓는다(10초에 걸쳐 피해의 2배) · 두목에겐 4배' }),
  ],
  fan: [
    SK(0, 1, 'frost', '섭혼술', 'single', { mult: 4.8, cd: 5, hpCost: 0, stun: 2.5, vuln: { sec: 6, v: 0.3 },
      desc: '혼을 거두는 눈빛 · 2.5초 멎고 6초간 받는 피해 +30%' }),
    SK(1, 2, 'slash', '혈루미혼', 'aoe', { mult: 2.3, cd: 8, hpCost: 0.10, radius: 288, stun: 2,   // v445 범위 224 → 288 (주력 하나가 된 뒤 환마 사냥이 처졌다)
      desc: '핏빛 눈물이 혼을 홀린다 · 둘레가 2초 멎는다' }),
    SK(2, 3, 'thunder', '천외혈마공', 'aoe', { mult: 5.6, cd: 8, hpCost: 0.15, radius: 320, lifesteal: 0.12, vuln: { sec: 6, v: 0.2 },
      desc: '하늘 밖의 혈마공 · 준 피해의 12%를 빨아들이고 6초간 받는 피해 +20%' }),   // v441 흡혈 5 → 12%(환마 = 피를 거두어 버티는 직업) · v445 범위 288 → 320 · 숨 9 → 8
    SK(3, 0, 'sup', '시공이환술', 'support', { cd: 24, hpCost: 0, from: 25, auto: 'hurt', hurtAt: 0.5, heal: 0.4, buff: { sec: 4, dmgRed: 0.6 },   // v441 숨 30 → 24
      desc: '때와 자리를 바꿔 다친 몸을 되돌린다 — 잃은 체력의 40% 회복 · 4초간 받는 피해 -60%' }),
    SK(4, 4, 'clone', '환영분신술', 'clone', { mult: 0.28, cd: 28, hpCost: 0.12, radius: 256, n: 2, sec: 10, burst: 0.6, autoAbove: 0.5,
      desc: '시공이환술의 끝 — 분신 둘이 나와 둘레를 한 번씩 치고(×0.6) 10초 동안 곁에서 함께 싸운다(칠 때마다 공격력 ×0.28)' }),
  ],
};
export const SKILL_DEFS = JOB_SKILLS.sword;   // 옛 이름 (자리·차수만 보는 곳)
// v444 주력 무공(主功) — 바람의나라처럼 쓰는 공격 무공은 하나. 전직하면 새 차수 무공이 주력이 되고, 옛 공격 무공(과 길 무공)은
//   물러나며 힘을 물려준다(계승). 계승 = 물러난 무공들의 초당 몫을 주력 숨에 맞춰 더한 배수. 주력은 1·2·3차 사다리 —
//   보조기 · 승급(4차) 필살기 · 길의 각성형은 그대로 따로 쓴다.
export const ATTACK_KINDS = new Set(['single', 'aoe', 'daggers', 'field']);
export const INHERIT_K = 1;   // 물려받는 몫(1 = 옛 무공들의 초당 피해를 그대로)
export const MAIN_AUTO_ABOVE = 0.45;   // 주력 무공은 체력이 이만큼 넘으면 자동으로(체력을 쓰는 무공이라 바닥에선 아낀다)
export const INHERIT_SINGLE = 0.25;   // 한 적 무공 → 둘레 주력이면 이만큼(여럿을 치게 되니)
// 한 번 펼칠 때의 대략 힘(공격력 배수) — 계승 셈에만 쓴다
export const skillPower = (sk) => (sk.mult || 0) * (sk.hits || 1) * (sk.kind === 'daggers' ? (sk.n || 1) * 0.5 : 1)
  + (sk.dot ? (sk.mult || 0) * sk.dot.mult : 0) + (sk.field ? sk.field.mult * (sk.field.sec / sk.field.tick) * 0.5 : 0);
// ---------- 심법 (패시브, v119) ----------
// 스킬 점수로 올린다. 공용 여섯은 누구나(점수 1씩), 독문 심법은 직업마다 하나(무공처럼 n→n+1에 n점).
// 레벨이 닿아야 배운다(from). 바람의나라의 보호·무장(버프)·체력 증강 같은 몫을 늘 켜진 심법으로 단순하게.
export const PASSIVES = [
  { id: 'p_move', name: '초상비', hanja: '草上飛', from: 15, max: 10, cost: 'flat', eff: { move: 0.03 }, text: (l) => `이동 속도 +${3 * l}%` },
  { id: 'p_guard', name: '호신강기', hanja: '護身罡氣', from: 20, max: 10, cost: 'flat', eff: { dmgRed: 0.02 }, text: (l) => `받는 피해 -${2 * l}%` },
  { id: 'p_regen', name: '운기조식', hanja: '運氣調息', from: 25, max: 10, cost: 'flat', eff: { regen: 0.1 }, text: (l) => `체력 회복 +${10 * l}%` },
  { id: 'p_hp', name: '금강불괴', hanja: '金剛不壞', from: 35, max: 10, cost: 'flat', eff: { hpPct: 0.03 }, text: (l) => `최대 체력 +${3 * l}%` },
  { id: 'p_eye', name: '심안', hanja: '心眼', from: 50, max: 10, cost: 'flat', eff: { critDmg: 0.04 }, text: (l) => `치명 피해 +${4 * l}%` },
  { id: 'p_atk', name: '혼원일기공', hanja: '混元一氣功', from: 70, max: 10, cost: 'flat', eff: { atkPct: 0.015 }, text: (l) => `공격력 +${(1.5 * l).toFixed(1).replace(/\.0$/, '')}%` },
];
// 독문 심법 — 그 마존의 길. 5레벨에 덧이 하나 붙는다.
export const OWN_PASSIVE = {
  sword: { id: 'p_own', name: '일화심법', hanja: '一花心法', from: 30, max: 10, cost: 'grow', eff: { flowerUp: 0.1 },
    text: (l) => `꽃잎 검기 피해 +${10 * l}%${l >= 5 ? ' · 세 번째 평타마다 핀다' : ' (5레벨: 세 번째 평타마다)'}` },
  fist: { id: 'p_own', name: '투신심법', hanja: '鬪神心法', from: 30, max: 10, cost: 'grow', eff: { basicUp: 0.03 },
    text: (l) => `평타 피해 +${3 * l}%${l >= 5 ? ' · 다섯 번째 평타마다 투신일격(×3, 둘레 50%)' : ' (5레벨: 다섯 번째 평타마다 투신일격)'}` },
  fan: { id: 'p_own', name: '섭혼대법', hanja: '攝魂大法', from: 30, max: 10, cost: 'grow', eff: { vulnUp: 0.015, drainUp: 0.002 },
    text: (l) => `섭혼 취약 +${(1.5 * l).toFixed(1).replace(/\.0$/, '')}%p · 흡혈 +${(0.2 * l).toFixed(1)}%p${l >= 5 ? ' · 섭혼 걸린 적을 치면 10% 확률로 1초 멎는다' : ' (5레벨: 가끔 멎게 한다)'}` },
  poison: { id: 'p_own', name: '만독불침', hanja: '萬毒不侵', from: 30, max: 10, cost: 'grow', eff: { poisonUp: 0.02, dmgRed: 0.01 },
    text: (l) => `독 쌓임 +${2 * l}%p · 받는 피해 -${l}%${l >= 5 ? ' · 독에 쓰러진 적의 독이 두 배로 번진다' : ' (5레벨: 독이 두 배로 번진다)'}` },
  ring: { id: 'p_own', name: '무면귀', hanja: '無面鬼', from: 30, max: 10, cost: 'grow', eff: { fearUp: 0.015, critDmg: 0.04 },
    text: (l) => `공포 확률 +${(1.5 * l).toFixed(1).replace(/\.0$/, '')}%p · 치명 피해 +${4 * l}%${l >= 5 ? ' · 머뭇거린 적에게 가면의 일격(×1.5)' : ' (5레벨: 머뭇거린 적에게 반격)'}` },
};
export const passivesOf = (job) => [...PASSIVES, ...(OWN_PASSIVE[job] ? [OWN_PASSIVE[job]] : [])];
export const passiveCost = (p, lv) => (p.cost === 'flat' ? 1 : Math.max(1, lv));

export const HARMONY = { sec: 6, buffSec: 8, dmgUp: 0.25 };   // 극악소마 삼공조화
// v240: 길 무공 — 길마다 고유 무공 하나(자리 5). 무공의 길은 넓게 쓰는 큰 초식, 평타의 길은 평타를 바꾸는 자세(10초).
// 합일(레벨 140·4차)이면 둘 다 쓴다. 연출은 역할(role)의 기본 연출을 쓴다.
const PK = (path, role, name, kind, o) => ({ slot: 5, tier: 2, path, role, name, kind, ...o });
export const PATH_SKILLS = {
  sword: {
    a: PK('a', 'thunder', '검기종횡', 'aoe', { mult: 2.4, hits: 2, cd: 7, hpCost: 0.1, radius: 256, autoAbove: 0.5,
      desc: '검기를 가로세로로 뿌려 둘레를 두 번 벤다 — 검기의 길' }),
    b: PK('b', 'awaken', '전광석화', 'awaken', { cd: 20, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 10, speed: 0.5, triple: 1, move: 0.3 },
      desc: '번개처럼 — 10초간 공격 속도 +50% · 평타 한 번에 두 대(덧 한 대는 절반) · 이동 +30% — 쾌검의 길' }),
  },
  fist: {
    a: PK('a', 'thunder', '벽공장풍', 'aoe', { mult: 2.8, cd: 7, hpCost: 0.1, radius: 256, stun: 0.8, autoAbove: 0.5,
      desc: '허공을 가르는 장풍 — 둘레를 충격파로 치고 0.8초 기절 — 장풍의 길' }),
    b: PK('b', 'awaken', '전광연타', 'awaken', { cd: 22, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 10, speed: 0.45, triple: 2, cleave: 0.3 },
      desc: '붙어서 두들긴다 — 10초간 공격 속도 +45% · 평타 한 번에 세 대 · 평타가 둘레를 친다(30%) — 연타의 길' }),
  },
  fan: {
    a: PK('a', 'thunder', '미혼환무', 'aoe', { mult: 2.2, hits: 2, cd: 7, hpCost: 0.1, radius: 256, vuln: { sec: 5, v: 0.2 }, autoAbove: 0.5,
      desc: '환영이 춤추며 둘레를 두 번 — 맞은 적은 5초간 받는 피해 +20% — 섭혼의 길' }),
    b: PK('b', 'awaken', '선풍난무', 'awaken', { cd: 22, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 10, speed: 0.4, triple: 1, cleave: 0.5 },
      desc: '부채가 회오리친다 — 10초간 공격 속도 +40% · 평타 두 대 · 평타가 둘레를 친다(50%) — 선풍의 길' }),
  },
  ring: {
    a: PK('a', 'thunder', '육맥신검', 'daggers', { mult: 1.1, n: 6, targets: 6, cd: 7, hpCost: 0.1, radius: 256, crit: 0.3, autoAbove: 0.5,
      desc: '여섯 손가락에서 검기 여섯이 날아간다(치명 +30%p) — 지력의 길' }),
    b: PK('b', 'awaken', '귀영난무', 'awaken', { cd: 22, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 10, speed: 0.45, triple: 2, critDmg: 0.3 },
      desc: '그림자처럼 — 10초간 공격 속도 +45% · 평타 세 대 · 치명 피해 +30% — 귀영의 길' }),
  },
  poison: {
    a: PK('a', 'thunder', '독룡출동', 'field', { mult: 1.0, cd: 9, hpCost: 0.1, radius: 256, field: { sec: 6, tick: 0.5, mult: 0.3 }, dot: { sec: 5, mult: 0.8 }, autoAbove: 0.5,
      desc: '독룡이 땅을 기어 독무를 넓게 깐다 — 6초 동안 0.5초마다 · 맞은 적은 5초 맹독 — 독무의 길' }),
    b: PK('b', 'awaken', '만천화우', 'awaken', { cd: 22, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 10, speed: 0.45, triple: 2 },
      desc: '독침이 비처럼 — 10초간 공격 속도 +45% · 평타 한 번에 세 침 — 독침의 길' }),
  },
};
// cm: 5차 천마신공(v391) — 같은 자리(id·연출)에 천마신공의 무공을 덮어쓴다
export const skillsOf = (job, cm = false) => {
  const over = cm ? CHEONMA_SKILLS[job] : null;
  const pick = (d, k) => (over?.[k] ? { ...d, ...over[k], cm: true } : d);
  return [
    ...(JOB_SKILLS[job] || []).map((d) => pick(d, d.slot)).map((d) => ({ ...d, id: `s${d.slot}`, icon: d.icon || d.name.slice(0, 2), fx: `${job}:m${d.slot}` })),   // 연출: skillfx_majon.js
    ...Object.values(PATH_SKILLS[job] || {}).map((d) => pick(d, d.path)).map((d) => ({ ...d, id: `p${d.path}`, icon: d.icon || d.name.slice(0, 2), fx: `${job}:p${d.path}` })),
  ];
};
// ---------- v391 5차 전직 · 천마신공(天魔神功) ----------
// 천마 검우진을 쓰러뜨린 검사가 레벨 150에 — 절대회귀의 천마신공. 모든 무공이 천마신공으로 바뀌고 천마혼(天魔魂)이 깃든다.
export const CHEONMA = {
  name: '천마신공', hanja: '天魔神功', soul: '천마혼', soulHanja: '天魔魂', tierName: '천마', col: '#dc2626',
  form: '구화마도식', formHanja: '九華魔刀式',
  trait: '천마혼(天魔魂) — 공격력 ×1.52 · 최대 체력 ×1.6(따로 곱한다) · 무공 피해 +40% · 두목 피해 +40% · 받는 피해 -20% · 꽃잎 검기가 천마검강으로(세 번째 평타마다 · 400% · 더 넓게) · 칠초식 심마도를 펼치면 천마혼 발현(15초 모든 피해 2배)',
  atkMul: 1.52, hpMul: 1.6,   // v392 더 세게(1.5 · 1.3 → 2.2 · 1.6) · v397 2.2 → 1.6(탄막·두목에서 남의 2.5배였다) · v404 1.52(끝까지 올린 최종 상태 1등 — 검사 ≥ 소마 > 환마 > 독마 > 권마)
  mods: { skill: 0.4, bossDmg: 0.4, dmgRed: 0.2 },   // v397 다른 직업과 같게
  flower: { every: 3, mult: 4.0, r: 240 },
  soulSec: 15, soulDmg: 1.0,   // 천마혼 발현 — 심마도 뒤 이 초 동안 모든 피해 +soulDmg · 무인 뒤에 천마의 형상
};
// 구화마도식(九華魔刀式) 일곱 초식 — 자리마다 하나씩(1차 한 적 · 2차 둘레 · 3차 비기 · 보조 · 4차 · 두 갈래 길)
export const CHEONMA_SKILLS = {
  sword: {
    0: { name: '직단결', icon: '직단', form: 1, role: 'frost', kind: 'single', mult: 5.6, cd: 4, hpCost: 0, bossMult: 1.5, sure: true, far: true,
      desc: '일초식 直斷決 — 직선의 파괴력을 극대화해 앞을 가로막는 모든 것을 곧게 베어 가른다 · 반드시 치명 · 두목에겐 1.5배' },
    3: { name: '방원결', icon: '방원', form: 2, role: 'sup', kind: 'support', cd: 22, hpCost: 0, from: 25, auto: 'hurt', hurtAt: 0.75, shield: 0.4, buff: { sec: 10, dmgRed: 0.25, dodge: 0.2 },
      desc: '이초식 防圓決 — 마도의 기운을 둥글게 펼쳐 막는다. 최대 체력 40% 보호막 · 10초간 받는 피해 -25% · 공격을 20% 흘린다(다치면 저절로)' },
    1: { name: '만환결', icon: '만환', form: 3, role: 'slash', kind: 'aoe', mult: 1.8, hits: 4, cd: 4.5, hpCost: 0.06, radius: 224, vuln: { sec: 5, v: 0.2 },
      desc: '삼초식 萬幻決 — 수많은 환영 속에 치명의 검격을 숨겨 둘레를 네 번 찌른다 · 맞은 적은 5초간 받는 피해 +20%' },
    2: { name: '망월참', icon: '망월', form: 4, role: 'thunder', kind: 'aoe', mult: 8.0, cd: 8, hpCost: 0.12, radius: 288, buff: { sec: 10, speed: 0.5 },
      desc: '사초식 望月斬 — 달을 바라보듯 높고 거대한 궤적으로 내려친다 · 넓게 · 10초간 공격 속도 +50%' },
    b: { name: '귀영참', icon: '귀영', form: 5, role: 'awaken', kind: 'awaken', cd: 18, hpCost: 0.05, auto: 'fight', autoAbove: 0.4, buff: { sec: 12, speed: 0.7, triple: 2, move: 0.4 },
      desc: '오초식 鬼影斬 — 귀신의 그림자처럼 사각을 파고든다. 12초간 공격 속도 +70% · 평타 한 번에 세 대 · 이동 +40% — 쾌검의 길' },
    a: { name: '절혼참', icon: '절혼', form: 6, role: 'thunder', kind: 'aoe', mult: 2.6, hits: 3, cd: 6, hpCost: 0.08, radius: 256, autoAbove: 0.5, bossMult: 1.3,
      desc: '육초식 絶魂斬 — 살기와 마기를 극한으로 끌어올려 혼백까지 끊는다 · 세 번 · 두목에겐 1.3배 — 검기의 길' },
    4: { name: '심마도', icon: '심마', form: 7, role: 'chain4', kind: 'daggers', mult: 2.2, n: 14, targets: 14, cd: 15, hpCost: 0.1, radius: 384, autoAbove: 0.5, blink: true, soul: true,
      desc: '칠초식 心魔刀 — 구화마도식의 최종장. 정·사·선·악의 경계를 무너뜨리고 제 마음의 마(魔)를 검에 담아 열네 번 가른다 · 천마혼 발현(15초 모든 피해 2배)' },
  },
};
// ---------- v393 다른 직업도 5차 — 숨은 두목을 꺾으면(직업마다 다르다) ----------
//   fx·자리는 그대로 두고 이름·설명을 바꾸고 배수를 키운다(FIFTH_K · 숨 FIFTH_CD). 마지막 초식(4차 자리)이 혼(魂)을 깨운다.
export const FIFTH_K = 1.6, FIFTH_CD = 0.85;
export const SOUL_CD = 40;   // v397 혼 발현 숨 — 15초 켜지고 40초마다(직업 무공 숨과 상관없이 같은 몫)
const F5 = (o) => ({ atkMul: 2.0, hpMul: 1.5, mods: { skill: 0.4, bossDmg: 0.4, dmgRed: 0.2 }, soulSec: 15, soulDmg: 1.0, ...o });
export const FIFTH = {
  sword: { ...CHEONMA, need: 'cheonma', needName: '천마 검우진', seal: '魔', sealCol: '220,38,38', aura: '#b91c1c', soulArt: 'soul-sword', banner: '天魔' },
  fist: F5({ name: '투신불패공', hanja: '鬪神不敗功', soul: '투신혼', soulHanja: '鬪神魂', tierName: '투신', col: '#f59e0b', form: '투신칠권', formHanja: '鬪神七拳',
    need: 'jinpaecheon', needName: '무림맹주 진패천', seal: '鬪',   // v435 화무기(Lv190) → 무림맹주(Lv160) — 5차 관문이 직업마다 Lv160~200으로 40레벨이나 벌어져 있었다
    sealCol: '245,158,11', aura: '#d97706', soulArt: 'soul-fist', banner: '鬪神',
    atkMul: 1.25, hpMul: 1.25,   // v404 최종 5등 — 1등과 1.4배 안
    trait: '투신혼(鬪神魂) — 공격력 ×1.25 · 최대 체력 ×1.25(따로 곱한다) · 무공 피해 +40% · 두목 피해 +40% · 받는 피해 -20% · 칠권 투신현신을 펼치면 투신혼 발현(15초 모든 피해 2배)' }),
  fan: F5({ name: '혈마대법', hanja: '血魔大法', soul: '혈마혼', soulHanja: '血魔魂', tierName: '혈마', col: '#be123c', form: '혈마칠법', formHanja: '血魔七法',
    need: 'baekjagang', needName: '사도맹주 백자강', seal: '血', sealCol: '190,18,60', aura: '#9f1239', soulArt: 'soul-fan', banner: '血魔',
    atkMul: 2.13, hpMul: 1.3,   // v404 최종 3등
    trait: '혈마혼(血魔魂) — 공격력 ×2.13 · 최대 체력 ×1.3(따로 곱한다) · 무공 피해 +40% · 두목 피해 +40% · 받는 피해 -20% · 칠법 혈마강림을 펼치면 혈마혼 발현(15초 모든 피해 2배)' }),
  poison: F5({ name: '만독귀종공', hanja: '萬毒歸宗功', soul: '독룡혼', soulHanja: '毒龍魂', tierName: '독존', col: '#65a30d', form: '만독칠식', formHanja: '萬毒七式',
    need: 'jinpaecheon', needName: '무림맹주 진패천', seal: '毒', sealCol: '101,163,13', aura: '#4d7c0f', soulArt: 'soul-poison', banner: '毒尊',
    atkMul: 1.2, hpMul: 1.5, bossDot: 0.9, slow: true, mods: { skill: 0.4, bossDmg: 0.4, dmgRed: 0.2, drain: 0.03 },   // v404 공격력 1.95 → 1.2 — 끝까지 올리면 두목 독이 공격력 따라 불어나 1등(남의 2.3배)이었다 → 4등 · v398 독을 빨아들여 흡혈 3%   // v398 두목이 독을 덜 받는 규칙(×0.5)을 독존은 ×0.9로
    trait: '독룡혼(毒龍魂) — 공격력 ×1.2 · 최대 체력 ×1.5(따로 곱한다) · 무공 피해 +40% · 두목 피해 +40% · 받는 피해 -20% · 두목에게도 독이 깊이(두목 독 피해 ×0.5 → ×0.9) · 준 피해의 3%를 빨아들인다 · 맞은 적이 독에 굼떠진다(공격 박자 ×1.5) · 칠식 만독귀종을 펼치면 독룡혼 발현(15초 모든 피해 2배)' }),
  ring: F5({ name: '무면천악공', hanja: '無面天惡功', soul: '무면귀', soulHanja: '無面鬼', tierName: '악존', col: '#7c3aed', form: '천악칠지', formHanja: '天惡七指',
    need: 'baekjagang', needName: '사도맹주 백자강', seal: '惡',   // v435 히든 마귀(Lv200 · 화무기 먼저) → 사도맹주(Lv162)
    sealCol: '124,58,237', aura: '#6d28d9', soulArt: 'soul-ring', banner: '惡尊',
    atkMul: 1.7, hpMul: 1.5,   // v404 최종 2등(검사 바로 아래)
    trait: '무면귀(無面鬼) — 공격력 ×1.7 · 최대 체력 ×1.5(따로 곱한다) · 무공 피해 +40% · 두목 피해 +40% · 받는 피해 -20% · 칠지 삼공악림을 펼치면 무면귀 발현(15초 모든 피해 2배)' }),
};
export const CHEONMA_JOBS = Object.keys(FIFTH);
export const fifthOf = (job) => FIFTH[job] || null;
// 초식 이름 — 자리(0~4)·길(a·b). 마지막(4) 초식이 혼을 깨운다(soul).
const FORMS = {
  fist: { 0: ['일권 붕천권', '崩天拳', '하늘을 무너뜨리는 한 주먹'], 3: ['이권 금강불괴', '金剛不壞', '금강의 몸으로 막아 낸다'], 1: ['삼권 백열난무', '百裂亂舞', '백 번 찢는 난무'],
    2: ['사권 패왕진천', '霸王震天', '패왕의 일격이 하늘을 울린다'], b: ['오권 섬전연환', '閃電連環', '번개처럼 이어 치는 연환권'], a: ['육권 파산신권', '破山神拳', '산을 깨는 신권의 충격파'], 4: ['칠권 투신현신', '鬪神顯身', '투신이 몸에 내려선다 — 투신혼 발현'] },
  fan: { 0: ['일법 혈영섭혼', '血影攝魂', '핏빛 그림자로 혼을 홀린다'], 3: ['이법 혈마불사', '血魔不死', '죽음 직전 피로 되살아난다'], 1: ['삼법 혈우난무', '血雨亂舞', '피의 비가 둘레를 휩쓴다'],
    2: ['사법 혈해천망', '血海天網', '피의 바다가 하늘 그물이 된다'], b: ['오법 혈영보', '血影步', '핏빛 그림자 걸음'], a: ['육법 혈마수라장', '血魔修羅掌', '수라의 장력'], 4: ['칠법 혈마강림', '血魔降臨', '혈마의 분신이 내려선다 — 혈마혼 발현'] },
  poison: { 0: ['일식 단혼독룡침', '斷魂毒龍針', '혼을 끊는 독룡의 침'], 3: ['이식 만독불침', '萬毒不侵', '만 가지 독이 몸을 지킨다'], 1: ['삼식 부골화혈산', '腐骨化血散', '뼈를 삭이고 피를 녹이는 독무'],
    2: ['사식 만독천라', '萬毒天羅', '만독의 하늘 그물'], b: ['오식 만천독우', '滿天毒雨', '하늘 가득 독의 비'], a: ['육식 독룡출해', '毒龍出海', '독룡이 바다를 뚫고 나온다'], 4: ['칠식 만독귀종', '萬毒歸宗', '만 가지 독이 하나로 돌아간다 — 독룡혼 발현'] },
  ring: { 0: ['일지 혈앙멸혼지', '血殃滅魂指', '혼을 지우는 재앙의 손가락'], 3: ['이지 무면현신', '無面顯身', '가면 아래 얼굴 없는 공포'], 1: ['삼지 공포광란장', '恐怖狂亂掌', '공포가 미쳐 날뛰는 장력'],
    2: ['사지 만비수라', '萬匕修羅', '만 자루 비수의 수라장'], b: ['오지 귀영무흔', '鬼影無痕', '흔적 없는 귀신 그림자'], a: ['육지 육맥멸혼', '六脈滅魂', '여섯 맥으로 혼을 멸한다'], 4: ['칠지 삼공악림', '三功惡臨', '세 무공이 악으로 임한다 — 무면귀 발현'] },
};
for (const [job, forms] of Object.entries(FORMS)) {
  const out = {};
  for (const [k, [full, hanja, line]] of Object.entries(forms)) {
    const base = k === 'a' || k === 'b' ? PATH_SKILLS[job][k] : JOB_SKILLS[job].find((d) => String(d.slot) === k);
    const name = full.split(' ')[1];
    const o = { name, icon: name.slice(0, 2), form: '일이삼사오육칠'.indexOf(full[0]) + 1, cd: Math.round(base.cd * FIFTH_CD * 10) / 10,
      desc: `${full.split(' ')[0]} ${hanja} — ${line} · ${base.desc.replace(/ — [^—]*의 길$/, '')}${k === 'a' || k === 'b' ? base.desc.match(/ — [^—]*의 길$/)?.[0] || '' : ''}` };
    if (base.mult) o.mult = Math.round(base.mult * FIFTH_K * 100) / 100;
    if (base.bossMult) o.bossMult = Math.round(base.bossMult * 1.2 * 100) / 100;
    if (k === '4') o.soul = true;
    out[k] = o;
  }
  CHEONMA_SKILLS[job] = out;
}
// v398 독존 — 마비독: 두목 초식을 끊는다(환마의 섭혼술·혈루미혼처럼). 무공 설명에도.
Object.assign(CHEONMA_SKILLS.poison[0], { stun: 2 }); CHEONMA_SKILLS.poison[0].desc += ' · 마비독 2초 기절';
Object.assign(CHEONMA_SKILLS.poison[2], { stun: 1.5 }); CHEONMA_SKILLS.poison[2].desc += ' · 마비독 1.5초 기절';


// ---------- 지도 ----------
// 0번은 마을(객잔 마을). 1~15는 사냥터 — 옛 지역 그림과 몹 생김새를 쓴다.
// 바람의나라처럼 **칸** 위를 움직인다 — 사냥터 하나가 9×19칸, 화면 한 장에 통째로 들어온다
// (그리는 쪽이 이 크기에 맞춰 카메라를 물린다). 무인·몹은 한 칸씩 미끄러지듯 옮겨 가고,
// 한 칸에는 하나만 선다. 근접은 앞뒤좌우 바로 옆 칸에서 친다.
// (처음엔 1300×1700 자유 이동이었다 — 화면에 사냥터 한 귀퉁이만 보였다)
export const TILE = 64;
// v425 무공 범위 표 — 직업 공통: 2차 광역 3.5칸(224) · 2차 갈래 4칸(256) · 3차 4.5칸(288) · 4차 6칸(384) · 독마 4차 8칸(512, 전엔 22칸). 직업 차이는 피해·숨·타수로만
export const MOVE_CAST_R = 420;   // v157: 걷는 중 자동 무공이 과녁을 잡는 거리
// v241: 9×19 → 11×25 — 들판이 좁아 센 무인은 금세 비웠다. 카메라가 따라가니(보통·가까이) 넓어도 글자는 그대로다
export const COLS = 11;
export const ROWS = 25;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;
export const tileCenter = (c) => (c + 0.5) * TILE;
// v176: 18마리·5초 → 24마리·3초. 센 무인은 들판을 비우고 몹을 기다리는 시간이 길었다.
// 들판에 반도 안 남으면 두 배 빨리 다시 난다.
// v241: 들판이 1.6배 넓어져 36마리·2.5초 (칸당 밀도는 비슷하게)
// v242: 밀도 ↑ — 48마리·2.2초 (들판 11×25)
export const MOBS_ALIVE = 48;
export const RESPAWN_SEC = 2.2;

// ---------- 지역과 구역 ----------
// 사냥터(지역)마다 구역 셋(1·2·3 — 뒤로 갈수록 몹 레벨이 높다)과 맨 끝 **두목 구역**이 있다.
// 두목 구역에는 정예 몇과 그 지역 두목이 늘 있고, 잡히면 BOSS_RESPAWN초 뒤에 다시 난다.
// 두목 증표(상급 조합 재료)는 두목 구역에서만 나온다. 들판 구역에는 두목이 없다.
// (전에는 사냥터마다 4분에 한 번 두목이 들판 가운데 났다)
//
// 지역 1~15: 옛 지역 그림을 쓰는 보통 사냥터, 레벨 1~98.
// 지역 16~27: **십이지왕**(레벨 99부터). 제12왕 권왕이 가장 약하고 제1왕 검왕이 가장 강하다.
//   왕마다 떨구는 재료·증표가 다르다. 왕은 등장 연출이 따로 있고, 그 지역 장비를 더 자주 떨군다.
export const BOSS_RESPAWN = 10;   // v290 45 → 30 · v313 30 → 10 — 두목 방에서 기다리는 시간이 길었다
export const BOSS_RESPAWN_SLOW = { hwamugi: 30 };   // v313 화무기만 예전처럼 30초
// 몹 레벨이 내 레벨보다 이만큼 넘게 위면 '위험' (v146 — 레벨 제한 대신)
export const DANGER_LV = 5;
// 레벨 차이 (v149): 한 레벨 높을 때마다 내 피해 -1.5%(최소 25%) · 받는 피해 +2% — 40레벨 위면 ×0.4 · ×1.8
export const GAP_OUT = 0.015;
export const GAP_OUT_MIN = 0.25;
export const GAP_IN = 0.02;
export const KING_INTRO_SEC = 3.2;   // 십이지왕 등장 연출 길이
export const BOSS_INTRO_SEC = 2.2;   // 보통 두목 등장 연출 길이
export const BOSS_ROOM_MOBS = 14;   // v241: 8 → 12 · v242: 14
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
    mobs: areaMobs(z, 4, art),
    // art: 두목 그림 (art/boss/<art>.png · v160)
    boss: k ? { name: `${k.title}${k.real ? ` ${k.real}` : ''}`, look: k.look, art: `king-${k.no}` } : { ...ZONES[z].boss, art: `zb-${z}` },
  });
}
// v127 새 지역 여섯 — 같은 레벨대 지역(pair)과 재료·증표·장비 사다리를 나눠 쓴다(지역 번호 31~36, 그림 16~21).
// 모습·몹·땅(지형)·기운이 달라 같은 레벨에 고를 데가 둘이 된다.
export const ALT_ZONES = [
  { id: 31, art: 16, pair: 3 }, { id: 32, art: 17, pair: 5 }, { id: 33, art: 18, pair: 7 },
  { id: 34, art: 19, pair: 9 }, { id: 35, art: 20, pair: 11 }, { id: 36, art: 21, pair: 13 },
];
for (const a of ALT_ZONES) {
  ZONES_W[a.id] = { id: a.id, art: a.art, king: null, pair: a.pair, name: ZONES[a.art].name, lv: zoneLv(a.pair),
    mobs: areaMobs(a.id, 4, a.art), boss: { ...ZONES[a.art].boss, art: `zb-${a.art}` } };
}
// v148 고수의 두목 방 — 고수 하나에 지역 하나(번호 41~), 구역은 두목 방 하나뿐.
// 그 고수의 수하(정예)가 늘 있고 고수가 BOSS_RESPAWN초마다 다시 나선다 — 십이지왕 두목 구역처럼 눌러앉아 파밍한다.
// 두목 레벨 = 고수 레벨(졸개는 둘 아래). 재료·증표·장비는 그 레벨의 보통 지역(짝, 99부터는 천외천) 것.
// 맹주·천마는 체력·공격이 더 세다(LORD_HP·LORD_ATK).
export const MASTER_ZONE0 = 41;
export const LORD_HP = 2.5;
export const LORD_ATK = 1.3;
// 두목 방 초식 (십이지왕·고수): 사이(초) · 맞으면 최대 체력의 몇 할(탑 경고 피해 × 이것) · 방치 중 피하기 반응(경고 시간의 몇 할이 지나서야 움직이나)
export const FIELD_CAST = 7;
export const FIELD_CAST_LORD = 5;
export const FIELD_TELL = 0.35;
export const FIELD_TELL_LORD = 0.55;
export const FIELD_REACT = 0.45;
const pairForLv = (lv) => { let best = 1; for (let z = 1; z <= NORMAL_ZONES; z++) if (zoneLv(z)[0] <= lv) best = z; return best; };
MASTERS.forEach((m, i) => {
  const id = MASTER_ZONE0 + i;
  ZONES_W[id] = { id, art: m.art, king: null, master: m.id, fac: m.fac, lord: !!m.lord, pair: pairForLv(m.lv - 2), name: `${m.title} ${m.name}`,
    lv: [m.lv - 4, m.lv - 2], mobs: m.mobs, boss: { name: `${m.title} ${m.name}`, look: m.look, art: `m-${m.id}`, lord: !!m.lord } };
});
export const masterZoneOf = (mid) => MASTER_ZONE0 + MASTERS.findIndex((m) => m.id === mid);
// 재료를 셈하는 지역 번호 (새 지역은 짝 지역)
export const matZone = (z) => ZONES_W[z]?.pair || z;
// 지도에 늘어놓는 차례 — 레벨 순 (새 지역은 짝 지역 바로 뒤)
export const ZONE_ORDER = ZONES_W.filter(Boolean).slice().sort((a, b) => a.lv[0] - b.lv[0] || (a.pair ? 1 : 0) - (b.pair ? 1 : 0) || a.id - b.id);
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
for (const zn of ZONE_ORDER) {
  const z = zn.id;
  for (let a = zn.master ? BOSS_AREA : 1; a <= BOSS_AREA; a++) {
    MAPS.push({
      id: mapId(z, a), zone: z, mz: zn.pair || z, area: a, art: zn.art, king: zn.king, master: zn.master || null, lord: !!zn.lord,
      name: a === BOSS_AREA ? `${zn.name} · 두목` : `${zn.name} ${a}`,
      zoneName: zn.name,
      bossRoom: a === BOSS_AREA,
      lv: areaLv(zn.lv, a),
      mobs: areaMobs(z, a, zn.art), boss: zn.boss,
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
  { name: '사부', dx: -150, dy: -120, tab: 'town/master', look: { robe: '#e7e5e4', trim: '#78716c', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'sword' } },
  { name: '상인', dx: 150, dy: -90, tab: 'town/shop', look: { robe: '#92400e', head: 'hat', weapon: 'fan' } },
  { name: '대장장이', dx: -110, dy: 110, tab: 'bag/smith', look: { robe: '#44403c', trim: '#f59e0b', head: 'band', band: '#7c2d12', beard: true, weapon: 'axe' } },
  { name: '주모', dx: 40, dy: -260, tab: 'town/inn', look: { robe: '#be185d', trim: '#fbcfe8', head: 'topknot', weapon: 'fan' } },
];

// ---------- 몹 ----------
export const mobHp = (lv) => Math.round(26 + 7 * lv ** 1.55);
// 알맞은 사냥터에서 물약이 시간당 60개 안팎이 되게(시뮬). 처음엔 1.7·lv^1.25였는데 시간당 200~400개를 먹어
// 방치 보상이 물약 때문에 1~2분 만에 멈췄다.
export const mobAtk = (lv) => Math.round(3 + 1.05 * lv ** 1.2);
export const mobDef = (lv) => Math.round(lv * 0.6);
export const mobExp = (lv) => Math.round(6 + 1.3 * lv ** 1.5);
export const mobGold = (lv) => Math.round(2 + lv * 1.4);
export const BOSS = { hp: 15, atk: 2.8, exp: 25, gold: 30 };   // v241: 14·2.5 → 15·2.8
// v241: 지역 두목도 레벨 30부터 바닥 경고 초식을 쓴다(단순한 넷) — 전엔 왕·고수만 썼다
export const ZONE_BOSS_PATS = ['aim', 'line', 'cone', 'nova'];
export const ZONE_BOSS_FROM = 30;
// v241: 두목은 최소 이만큼은 버틴다 — 무인의 초당 피해(무공 몫 ×1.5)로 셈한 체력이 기본보다 크면 그만큼(최대 3배). 함께 사냥(문파원과 왕)·던전은 그대로
export const BOSS_MIN_SEC = { zone: 45, king: 100, lord: 150 };
export const BOSS_REPEAT_K = 0.4;   // v262 한 번 잡은 두목은 최소 싸움 시간의 이만큼만
export const BRAVE_PER = 0.04, BRAVE_MAX = 0.4;   // v262 패기
export const OVERPOWER_MAX = 4;   // v242: 3 → 4
// v271 두목 맞춤 — 싸움 첫 몇 초에 실제로 들어간 피해로 다시 잰다. 들어갈 때의 어림(평타 몫)이 무공·각인·애완동물을 못 따라가
//   Lv100 왕·고수가 10초(최소 100초인데)에 쓰러졌다. 끝은 기본 체력의 이만큼까지.
export const BOSS_CALIB_SEC = 6;
// v272 위의 두목 강화(맞춤·공격 하한·회복 줄임)는 이 레벨 두목부터 — 초반(길잡이가 Lv10쯤 두목을 시킨다)은 배우는 구간이라 예전대로
export const BOSS_HARD_FROM = 30;
export const BOSS_REGEN_K = 0.25;
export const BOSS_DRAIN_CAP = 0.01;  // v271 두목과 싸우는 동안 흡혈 회복은 초당 최대 체력의 1%까지   // v271 두목과 싸우는 동안 자연 회복
// v271 두목 한 대(무인 체력 몫) — 지역 두목 · 왕·고수(초식이 따로 있다)
//   초식을 쓰는 두목(레벨 95 넘는 왕·고수)은 더 아프다 — 물약 한두 개로 끝나던 싸움
export const BOSS_HIT_FRAC_K = (m) => ((m.king || m.master) && m.lv[0] >= 95 ? 0.12 : m.king || m.master ? 0.08 : 0.09);
export const BOSS_CALIB_MAX = 40;
// v407 각성 고수 — 5차 전직을 마친 무인만. 두목 방에서 켜면 그 고수가 각성한 모습으로 선다(전직 길의 보통 고수는 그대로).
//   체력·공격은 「5차 + 대성신장 전설 +12」가 천마 ~30초 · 화무기 ~1분 · 마귀 ~2분 반에 잡게 맞췄다(전투력 보정·다시 맞추기 없음 — 세질수록 빨리).
//   보상: 은자 · 대성신장 강화석 · 그 고수 증표 · 조각 — 마귀(2분 반)와 칠대성(혼자 몇 판) 사이 디딤돌
export const AWAKEN = {
  // v409 맹주 둘 · 십이지 검왕도(디딤돌 앞쪽) — 검왕은 고수가 아니라 왕이라 map으로 찾는다
  geomwang: { name: '각성 검왕', hanja: '覺醒劍王', hp: 400, atk: 1.6, gold: 1500, stone: 4, mark: 12, shard: 15, king: 1 },
  jinpaecheon: { name: '각성 진패천', hanja: '覺醒武林盟主', hp: 600, atk: 1.7, gold: 2000, stone: 5, mark: 15, shard: 20 },
  baekjagang: { name: '각성 백자강', hanja: '覺醒邪道盟主', hp: 600, atk: 1.7, gold: 2000, stone: 5, mark: 15, shard: 20 },
  cheonma: { name: '각성 천마', hanja: '覺醒天魔', hp: 220, atk: 1.8, gold: 3000, stone: 8, mark: 20, shard: 30 },
  hwamugi: { name: '각성 화무기', hanja: '覺醒天下第一', hp: 95, atk: 1.9, gold: 5000, stone: 12, mark: 30, shard: 45 },
  magwi: { name: '각성 마귀', hanja: '覺醒魔鬼', hp: 62, atk: 1.8, gold: 8000, stone: 20, mark: 40, shard: 60 },
};
export const AWAKEN_IDS = Object.keys(AWAKEN);
export const AWAKEN_FIRST_K = 5;   // v409 처음 쓰러뜨리면 보상 다섯 배
// v413 각성 고수마다 전용 발밑 문양(꾸미기) — 잡을 때마다 6% · 그 고수에게서 14번 못 받으면 15번째엔 꼭
export const AWAKEN_RING_P = 0.06, AWAKEN_RING_PITY = 14;
export const AWAKEN_RINGS = Object.keys(AWAKEN).map((id) => [`awk-${id}`, `${AWAKEN[id].name} 문양`, id]);
// 두목 방 → 각성 열쇠(고수 id · 검왕은 'geomwang')
export const awakenKeyOf = (m) => (m?.master && AWAKEN[m.master] ? m.master : m?.king && m.bossRoom ? AWAKEN_IDS.find((k) => AWAKEN[k].king === m.king.no) || null : null);
// 몹 등급 (v116): 0 졸개 · 1 정예 · 2 두목 · 3 십이지왕 — 등급마다 겉모습·기운이 다르다.
// 들판 정예는 드물게(4%) 섞여 나고 세다(체력 ×3 · 공격 ×1.4) — 대신 경험치·은자 ×2.5, 재료를 두 번 굴린다.
// 두목 구역의 졸개도 정예로 그리지만 세기는 그대로(이미 그 지역 위끝 레벨이다).
export const MOB_GRADES = ['졸개', '정예', '두목', '왕'];
export const ELITE_RATE = 0.04;
export const ELITE = { hp: 3, atk: 1.4, exp: 2.5, gold: 2.5 };
export const MOB_ATK_SEC = 1.6;
export const MOB_AGGRO = 200;      // 이만큼(세 칸 남짓) 붙으면 쫓아온다
export const MOB_SPEED = 70;       // 쫓을 때 한 칸에 0.9초
export const MOB_REACH = 70;       // 몹은 바로 옆 칸(앞뒤좌우)에서 친다 — 두목은 대각선까지

// ---------- 장비 ----------
export const SLOTS = [
  { id: 'weapon', name: '무기' },
  { id: 'armor', name: '옷' },
  { id: 'hat', name: '모자' },
  { id: 'glove', name: '장갑' },     // v130
  { id: 'shoe', name: '신발' },      // v130
  { id: 'acc', name: '장신구' },
  { id: 'finger', name: '가락지', dropOnly: true },
  { id: 'ear', name: '귀걸이', dropOnly: true },
];
// 대장장이가 만드는 칸 (가락지·귀걸이는 두목만 떨군다 — 조합 사다리가 없다)
export const CRAFT_SLOTS = SLOTS.filter((x) => !x.dropOnly);
// v120: 아래 장비 없이도 조합한다 — 재료만 있으면 어느 칸이든. 아래 장비를 넣으면 재료가 덜 들고 강화·등급을 이어받는다.
export const isDropOnly = (slot) => slot === 'finger' || slot === 'ear';
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
    // v130 장갑: 공격력 · 치명 피해 / 신발: 체력 · 방어 (무기·옷보다 작게)
    case 'glove': return { atk: (2 + 1.2 * ilv) * GEAR, critDmg: 0.02 + ilv * 0.0005 };
    case 'shoe': return { hp: (8 + 5 * ilv) * GEAR, def: 0.5 + ilv * 0.15 };
    // 가락지: 공격력% · 치명 피해 / 귀걸이: 최대 체력% · 스킬 피해 (두목만 떨군다, 강화가 어렵다)
    // (% 수치도 사다리 배수를 따라 커지니 바탕은 작게)
    case 'finger': return { atkPct: 0.015 + ilv * 0.0006, critDmg: 0.03 + ilv * 0.001 };
    case 'ear': return { hpPct: 0.015 + ilv * 0.0006, skill: 0.015 + ilv * 0.0006 };
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
// v132 강화석 'st21'~'st27' — '살왕의 명부 혼석'
const stoneName = (key) => { const z = +String(key).slice(2); return `${kingOf(z)?.title || ''}의 ${STONES[z]?.name || '강화석'}`; };
export const matName = (key) => (key === ORE ? ORE_NAME : isLordMat(key) ? LORD_MATS[key].name : isFacMat(key) ? FAC_MAT_INFO[key].name : isStoneKey(key) ? stoneName(key) : String(key)[0] === 'b' ? `${ZONES_W[+String(key).slice(1)]?.boss?.name || '두목'}의 증표` : MATS[key]);
export const matColor = (key) => (key === ORE ? ORE_COL : isLordMat(key) ? LORD_MATS[key].col : isFacMat(key) ? FAC_MAT_INFO[key].col : isStoneKey(key) ? '#f0abfc' : String(key)[0] === 'b' ? (kingOf(+String(key).slice(1)) ? '#f43f5e' : '#fde68a') : MAT_COLORS[key]);
export const MAT_RATE = 0.5;          // 몹 하나가 재료 하나를 떨굴 확률
// v273 현철(玄鐵) — 지역 재료를 하나로. 지역마다 재료가 달라 레벨이 오르면 모아 둔 재료가 2:1 변환으로 반 토막 났다.
//   이제 몹·두목이 떨구는 지역 재료는 들어오는 순간 현철 × 가중치(그 지역 레벨 ÷ 5)가 된다. 강화·강화석·제작에 드는
//   지역 재료도 같은 가중치로 현철을 쓴다 — 제 레벨 사냥터에서 모으는 속도는 그대로, 낮은 사냥터는 덜 준다(쓸어 담기 막기).
export const ORE = 'hc';
export const ORE_NAME = '현철';
export const ORE_COL = '#9ca3af';
// v274 현철 단련(鍛鍊) — 강화가 레벨 상한에 막히면 현철이 썩어 남았다(시뮬 15일에 7천만 개). 끝없는 소비처:
//   한 단계마다 영구 공격력·체력 +TEMPER_STEP, 값은 단계마다 ×TEMPER_GROW · 내 레벨 몫(레벨÷5)만큼.
// v275 몹 사냥으로 강해지는 길 둘 더 — 숙련도·견문록이 경험치만 주던 것에 영구 공격력·체력을 더한다
//   숙련도 단계(지역마다 최대 10, 60곳) 하나마다 · 견문록 낙관(몹 종 하나) 하나마다 · 견문록 지역을 다 채우면 하나마다
export const MAST_STAT = 0.0005;
export const DEX_STAMP_STAT = 0.0002;
export const DEX_ZONE_STAT = 0.005;
// v275 무공 비급 조각 — 몹이 드물게 떨군다(정예 ×5 · 두목 ×20 · 방치에도). FRAG_NEED개면 무공 점수 1
export const FRAG_RATE = 1 / 15000;
export const FRAG_NEED = 20;
// 점수를 하나 받을 때마다 다음 비급에 조각이 이만큼 더 — 처치 수가 2.5배인 직업이 무공 점수를 2.5배 받지 않게(시뮬 권마 77점 → 26점쯤)
export const FRAG_NEED_UP = 2;
export const fragNeed = (got) => FRAG_NEED + FRAG_NEED_UP * Math.max(0, got | 0);
export const BOSS_DOT_K = 0.5;
// v280 꾸미기 — 처음 캐릭터를 고른 뒤 · 프로필(왼쪽 위 얼굴)을 눌러 바꾼다. null은 '기본'(경지·장비를 따른다)
export const CUSTOM_HEADS = [['plain', '맨머리'], ['topknot', '상투 머리띠'], ['bald', '민머리']];
// v323 쓰개 — 머리와 따로 고른다(삿갓은 어느 머리에나 얹는 덧씌우기 · 두건은 머리를 통째로 감싼다)
export const CUSTOM_HATS = [['straw', '삿갓'], ['hood', '두건']];
// v323 신발 빛깔
export const CUSTOM_BOOTS = ['#2a1f18', '#111111', '#6b3a1e', '#8b1f22', '#1e3a5f', '#e7e0d0'];
export const CUSTOM_ROBES = ['#14120f', '#f1e8d6', '#8b1f22', '#32486b', '#1f5f4a', '#5b3a7a', '#6b5640', '#b08d57', '#0f3b3a', '#7c2d12', '#be7c8b', '#1e293b', '#9ca3af', '#c9a227'];   // v325 +6
export const CUSTOM_BANDS = ['#7f1d1d', '#e8c87a', '#1e3a8a', '#f1f5f9', '#14120f', '#15803d', '#c026d3', '#f59e0b', '#0ea5e9', '#f9a8d4'];   // v325 +4
// v306 눈 — 안대(띠 색으로). 민머리와 함께 눈을 가린 무승 차림이 된다
export const CUSTOM_FACES = [['blind', '안대'], ['patch', '외눈 안대'], ['veil', '면사'], ['scar', '칼자국']];   // v325 +3
// v325 성별 · 여협 머리 · 머리 빛깔(여협) — 여협 머리는 그림 조각이 없어 js/femhead.js가 그린다(FHEAD_STYLES와 같은 순서)
export const CUSTOM_GENDERS = [['m', '남'], ['f', '여']];
export const CUSTOM_FHEADS = [['long', '긴 생머리'], ['bun', '쪽머리 비녀'], ['pony', '높은 말총'], ['twin', '양갈래'], ['short', '단발']];
export const CUSTOM_HAIRS = [['black', '흑발', '#1c1612'], ['brown', '갈발', '#6b4226'], ['white', '백발', '#e5e7eb'], ['red', '적발', '#7f1d1d'], ['blue', '청발', '#1e3a5f']];   // 그림 art/hero2/fh-<머리>-<빛깔>
// v325 직업마다 무기 모양 — art: 그림 조각(art/hero 또는 art/hero2, sunburst). 그림이 아직 안 왔으면 그 직업 기본 무기
export const WEAPON_SKINS = {
  sword: [
    { id: 'jian', name: '장검', art: 'wp-sword' }, { id: 'moon', name: '월하검', art: 'wp-s0' }, { id: 'grass', name: '초결검', art: 'wp-s1' },
    { id: 'doom', name: '흑철검', art: 'wp-s2' }, { id: 'plum', name: '홍매검', art: 'wp-s3' }, { id: 'dragon', name: '용린검', art: 'wp-s4' },
    { id: 'bell', name: '은방울검', art: 'wp-s5' }, { id: 'saber', name: '환도', art: 'wp-saber' }, { id: 'spear', name: '장창', art: 'wp-spear' },
  ],
  fist: [
    { id: 'gauntlet', name: '철권갑', art: 'wp-fist' }, { id: 'gold', name: '금강권', art: 'wp-fist-gold' }, { id: 'jade', name: '비취권', art: 'wp-fist-jade' },
    { id: 'wrap', name: '붕대 맨주먹', art: 'wp-fist-wrap' }, { id: 'tiger', name: '호조', art: 'wp-fist-tiger' }, { id: 'claw', name: '쌍구조', art: 'wp-claw' },
  ],
  fan: [
    { id: 'white', name: '산수선', art: 'wp-fan-white' }, { id: 'black', name: '흑룡선', art: 'wp-fan-black' }, { id: 'red', name: '홍매선', art: 'wp-fan-red' },
    { id: 'blue', name: '청파선', art: 'wp-fan-blue' }, { id: 'iron', name: '철선', art: 'wp-fan-iron' }, { id: 'crane', name: '학우선', art: 'wp-fan-crane' },
  ],
  dagger: [
    { id: 'dagger', name: '비수', art: 'wp-dagger' }, { id: 'needle', name: '독침', art: 'wp-needle' }, { id: 'gourd', name: '독호로', art: 'wp-gourd' },
    { id: 'sickle', name: '독낫', art: 'wp-sickle' }, { id: 'claw', name: '독조', art: 'wp-claw' },
  ],
  jihwan: [
    { id: 'violet', name: '자지환', art: 'wp-ring-violet' }, { id: 'blood', name: '혈지환', art: 'wp-ring-blood' }, { id: 'jade', name: '옥지환', art: 'wp-ring-jade' },
    { id: 'gold', name: '금지환', art: 'wp-ring-gold' }, { id: 'shadow', name: '흑지환', art: 'wp-ring-shadow' }, { id: 'moon', name: '월지환', art: 'wp-ring-moon' },
  ],
};
export const weaponSkinOf = (look, id) => (WEAPON_SKINS[look] || []).find((x) => x.id === id) || null;
// v325 기믹 — 몸을 도는 기운 · 발밑 문양 · 칼빛
export const CUSTOM_AURAS = [['petals', '꽃잎'], ['firefly', '반딧불'], ['snow', '눈송이'], ['ember', '불티'], ['spark', '번개'], ['ink', '먹물'], ['gold', '금가루'], ['leaf', '낙엽']];
export const CUSTOM_RINGS = [['taiji', '태극'], ['lotus', '연꽃'], ['bagua', '팔괘'], ['flame', '불꽃 고리'], ['frost', '서리 문양']];
export const CUSTOM_GLOWS = ['#7dd3fc', '#f87171', '#fcd34d', '#c084fc', '#f8fafc', '#4ade80'];
// v306 차림 — 한 번에 어울리게(머리·눈·도포·띠). 따로따로 고르면 따로 놀던 것을 묶었다
export const CUSTOM_PRESETS = [
  { id: 'monk', name: '맹인 무승', head: 'bald', hat: null, face: 'blind', robe: '#b08d57', band: '#7f1d1d', boot: '#6b3a1e' },
  { id: 'black', name: '흑의 검객', head: 'topknot', hat: null, face: null, robe: '#14120f', band: '#14120f', boot: '#111111' },
  { id: 'white', name: '백의 도사', head: 'topknot', hat: null, face: null, robe: '#f1e8d6', band: '#1e3a8a', boot: '#2a1f18' },
  { id: 'red', name: '홍의 협객', head: 'topknot', hat: null, face: null, robe: '#8b1f22', band: '#e8c87a', boot: '#2a1f18' },
  { id: 'wanderer', name: '삿갓 낭인', head: 'plain', hat: 'straw', face: null, robe: '#6b5640', band: '#14120f', boot: '#111111' },   // v323
  { id: 'swordmaiden', name: '백의 여협', gender: 'f', fhead: 'long', hair: 'black', head: null, hat: null, face: null, robe: '#f1e8d6', band: '#7f1d1d', boot: '#2a1f18' },   // v325
  { id: 'poisonlady', name: '독문 여인', gender: 'f', fhead: 'bun', hair: 'blue', head: null, hat: null, face: 'veil', robe: '#1f5f4a', band: '#c026d3', boot: '#111111' },
  { id: 'redfox', name: '홍호 낭자', gender: 'f', fhead: 'pony', hair: 'red', head: null, hat: null, face: null, robe: '#8b1f22', band: '#e8c87a', boot: '#2a1f18' },
  { id: 'shadow', name: '두건 자객', head: 'topknot', hat: 'hood', face: null, robe: '#32486b', band: '#1e3a8a', boot: '#111111' },
];
export const TEMPER_STEP = 0.003;   // 시뮬 15일 118~143단계 → +35~43%
export const TEMPER_BASE = 150;
export const TEMPER_GROW = 1.06;
export const TEMPER_FROM = 20;   // 이 레벨부터
export const temperCost = (n, level) => Math.round(TEMPER_BASE * Math.max(1, Math.round(level / 5)) * TEMPER_GROW ** n);
export const isZoneMatKey = (k) => /^\d+$/.test(String(k)) && !!MATS[k];
export function matWeight(z) {
  const zn = zoneOfW(+z);
  const lv = zn?.lv ? (zn.lv[0] + zn.lv[1]) / 2 : 5;
  return Math.max(1, Math.round(lv / 5));
}
// 지역 재료 n개 → 현철 몇 (그 외 열쇠는 그대로)
export const oreOf = (k, n) => (isZoneMatKey(k) ? { key: ORE, n: Math.round(n * matWeight(k)) } : { key: k, n });
// v174 재료 올리기 — 보통 지역 재료 둘을 바로 다음 지역 재료 하나로. 지역마다 1분에 모이는 개수가 비슷해서
// 아래로 내려가 모아 올리면 손해(악용 없음)이고, 지난 재료는 반값으로 쓰인다. 두 지역 아래면 4:1, 세 지역이면 8:1.
export const MAT_CONVERT = 2;
export const matUpTarget = (k) => (Number.isInteger(+k) && +k >= 1 && +k < NORMAL_ZONES ? +k + 1 : null);
export const BOSS_MATS = 12;          // 두목은 재료 한 움큼 + 증표 하나
// v130: 사다리는 보통 지역 15곳에서 끝난다(장비 레벨 99까지). 십이지왕부터는 세트·왕의 장신구(wgear.js).
// ---------- 사다리 (v143) ----------
// **레벨 5마다 한 칸, 100까지 스무 칸.** 전에는 지역마다 하급·상급 둘이라
// 서른 칸이었고 레벨이 7·11·14·17·20·24…로 들쭉날쭉했다. 지금 뭘 만들 수
// 있는지 셈이 안 되고, 한 칸 오르는 데 레벨 서넛이라 만들자마자 또 만들었다.
export const STEP_LV = 5;
export const STEP_COUNT = 20;                    // 레벨 5 … 100
export const ILV_CAP = STEP_LV * STEP_COUNT;     // 100
export const stepLevel = (step) => (step + 1) * STEP_LV;
export const stepOfLevel = (lv) => Math.max(0, Math.min(STEP_COUNT - 1, Math.ceil(lv / STEP_LV) - 1));
// 그 칸의 재료는 어느 지역에서 나오나 — 그 레벨이 사는 지역
export function stepMap(step) {
  const lv = stepLevel(step);
  let best = 1;
  for (let z = 1; z <= NORMAL_ZONES; z++) if (ZONES_W[z] && ZONES_W[z].lv[0] <= lv) best = z;
  return best;
}
// 하급·상급은 없앴다. 옛 세이브와 옛 코드가 부르는 자리가 있어 거짓만 돌려준다.
// 한 칸이 레벨 다섯이라 전보다 오래 머문다 — 그만큼 한 번에 더 든다
const CRAFT_MATS = { weapon: 70, armor: 54, hat: 42, glove: 42, shoe: 42, acc: 54 };
const CRAFT_BOSS = { weapon: 5, armor: 4, hat: 3, glove: 3, shoe: 3, acc: 4 };
// **등급은 뽑는 게 아니라 고른다.** 위로 갈수록 재료가 확 는다 —
// 신화 하나가 레어 스물넷이다. 그래야 신화를 노리고 모을 이유가 생긴다.
export const RAR_MATS = [1, 3, 8, 30];           // 재료 배수 (v153 신화 24→30)
export const RAR_BOSS = [0, 1, 4, 16];           // 두목 증표 배수 (레어는 안 든다 · v153 신화 12→16)
export const RAR_GOLD = [1, 2.5, 7, 20];
export const craftLevel = (k) => ZONES_W[k]?.lv[1] || 1;
// 조합 장비 수치 = 아이템 레벨 기본치 × 사다리 배수. 아이템 레벨만으로는 뒤로 갈수록 한 사냥터에
// 7%밖에 안 올라서(기본치가 레벨에 곧게 오른다) 사다리 한 칸마다 ×1.12^½을 더 얹는다.
// 상급은 아이템 레벨이 이 사냥터와 다음 사냥터의 가운데 — 그래서 '하급 < 상급 < 다음 하급'이 늘 선다.
export const craftIlv = (step) => stepLevel(step);
// **장비가 어느 지역 것인가.** 전에는 step에서 읽었는데(지역 = floor(step/2)+1),
// 사다리가 레벨 기준이 되면서 그 셈이 성립하지 않는다. 지역은 서른셋, 칸은
// 스물이고 레벨 100 위 지역은 칸이 없다. 그래서 지역을 따로 싣고(it.z),
// 없으면 옛 세이브로 보고 칸에서 읽는다.
export const itemZone = (it) => (it?.z ?? it?.king ?? (it?.step != null ? stepMap(it.step) : 0));
// 아이템 레벨만으로는 한 칸에 수치가 얼마 안 오른다(기본치가 레벨에 곧게 오른다).
// 칸마다 배수를 한 번 더 얹어 '다음 칸이 확실히 세다'를 만든다.
export const stepMult = (step) => 1.12 ** step;
// ---------- 성장 장비 (v158) ----------
// 대장장이 사다리(레벨 5마다 새로 만들기)를 없앴다. 무기·옷·모자·장갑·신발·장신구는 칸마다 하나씩이고
// **레벨을 따라 저절로 자란다**(아이템 레벨 = 내 레벨, 100까지). 그 장비를 강화하고,
// 두목 증표로 등급(레어→유니크→전설→신화)을 각인하고, 세력 재료로 계열을 붙인다. 100부터는 세트·왕의 장비.
export const GROW_SLOTS = ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc'];
export const growIlv = (lv) => Math.max(1, Math.min(ILV_CAP, lv));
// 사다리 배수(칸마다 ×1.12)를 레벨에 매끈하게 — 레벨 5에 1, 100에 ×8.6
export const growMult = (ilv) => 1.12 ** (ilv / STEP_LV - 1);
// 등급 각인 — 어느 두목의 증표든 된다. 한 번에 INFUSE_MARKS[다음 등급]개를 넣고 INFUSE_BASE 확률로 오른다.
// 센 두목(증표 레벨이 장비 레벨보다 높을수록)의 증표일수록 잘 붙는다(×0.5~×2). 실패하면 다음 확률이 기본의 절반씩 쌓여(천장) 언젠가는 붙는다.
export const INFUSE_MARKS = [0, 3, 6, 12];
export const INFUSE_BASE = [0, 0.35, 0.15, 0.05];
export const INFUSE_PITY_K = 0.5;
export const INFUSE_F_MIN = 0.5, INFUSE_F_MAX = 2;
export const isMarkKey = (k) => /^b\d+$/.test(String(k));
export const markLv = (k) => (ZONES_W[+String(k).slice(1)]?.lv[1] || 1) + 2;      // 그 두목의 레벨
export const infuseFactor = (key, ilv) => Math.max(INFUSE_F_MIN, Math.min(INFUSE_F_MAX, markLv(key) / Math.max(10, ilv)));
export const infuseGold = (ilv, r) => Math.round((30 + ilv * 10) * RAR_GOLD[r] * 2);
// 빛깔(등급 색)은 지역 셋마다 한 칸씩 — 일반 · 고급 · 희귀 · 영웅 · 전설, 십이지왕 장비는 '지왕'
// 빛깔(테두리 색)은 네 칸마다 한 단계 — 스무 칸이 다섯 빛깔
// 조합법: 무엇을 내면 이것이 되나
// 조합법: 무엇을 내면 이것이 되나. rar를 주면 그 등급짜리 값이다.
export function recipeOf(slot, step, rar = 0, line = 'base') {
  const k = stepMap(step);
  const r = Math.max(0, Math.min(RARITY.length - 1, rar | 0));
  const mats = { [k]: Math.round(CRAFT_MATS[slot] * RAR_MATS[r]) };
  if (RAR_BOSS[r]) mats[bossKey(k)] = CRAFT_BOSS[slot] * RAR_BOSS[r];
  // 계열(v151): 세력 재료 — 등급이 높을수록 같은 배수로 더 든다
  for (const [fk, n] of Object.entries(lineMats(line, slot, step))) mats[fk] = Math.round(n * RAR_MATS[r]);
  // 받는 장비: 바로 앞 칸 (첫 칸은 없다)
  const from = step > 0 ? [step - 1] : [];
  return { slot, step, rar: r, line, mats, from, gold: Math.round((30 + stepLevel(step) * 10) * RAR_GOLD[r]) };
}
// 장비 이름 — 사냥터 머리말 + 칸 이름 (상급은 앞에 '상급')
const STEP_PREFIX = [null, '청죽', '사철', '빙정', '혈석', '귀화', '운모', '마철', '수정', '금강', '야명', '매화', '독룡', '현빙', '해왕', '천외', ...KINGS.map((k) => k.prefix)];
// 강화 +1~+10, 그 위로 **돌파** +11~+15(조합 장비만). 돌파는 두목 증표가 더 들고, 한 단계가 더 크다.
export const ENHANCE_MAX = 15;
export const ENHANCE_NORMAL = 10;
export const AUTO_ENH_MAX = 10;   // v324 자동 강화 상한 — 여기까지만 저절로, 돌파는 직접
// v261: 강화 상한을 레벨에 묶는다 — 6칸 +10이 2.8시간(Lv32)에 끝나 중반에 이정표가 없었다. [이 레벨부터, 여기까지]
// v408 레벨 제한을 풀었다 — 어느 레벨이든 장비가 갈 수 있는 끝(+10 · 돌파 +15)까지. (옛 표: Lv1 +5 · 12 +7 · 30 +9 · 45 +10 · 65 +11 · 80 +12 · 95 +13 · 110 +14 · 125 +15)
export const ENHANCE_LV_CAP = [[1, ENHANCE_MAX]];
export function enhanceLvCap(level) { let c = ENHANCE_LV_CAP[0][1]; for (const [lv, m] of ENHANCE_LV_CAP) if (level >= lv) c = m; return c; }
export function enhanceCapNext(level) { return ENHANCE_LV_CAP.find(([lv]) => lv > level) || null; }
export const ENHANCE_STEP = 0.15;                // +1~+10: 한 단계에 기본 수치 +15% (v153: 12%에서 — 강화가 어려워진 만큼 크게)
export const BREAK_STEP = 0.3;                   // 돌파 +11~+15: 한 단계에 +30% (+10 2.5배 · +15 4배, v153)
export const enhanceMult = (plus) => 1 + Math.min(plus, ENHANCE_NORMAL) * ENHANCE_STEP + Math.max(0, plus - ENHANCE_NORMAL) * BREAK_STEP;
export const breakMarks = (plus) => (plus >= ENHANCE_NORMAL ? plus - ENHANCE_NORMAL + 1 : 0);   // +10→11 증표 1 … +14→15 증표 5
// 강화에는 은자와 함께 그 장비 지역의 재료가 든다 — 재료를 넣을수록 장비가 세진다
export const enhanceMatsN = (plus) => 4 + plus * 3;
// ---------- v393 초월(超越) — +15까지 다 한 신화 장비를 그 너머로(만렙 뒤 장비 목표) ----------
// 열 단계 · 단계마다 기본 능력치 +TRANS_STEP(곱) · 은자·현철·가장 센 두목 증표 · 실패해도 떨어지지 않고 천장이 쌓인다
export const TRANS_MAX = 10;
export const TRANS_STEP = 0.08;
export const TRANS_FLAT = ['atk', 'hp', 'def'];   // v410 초월이 키우는 기본 수치(% 능력치는 그대로)
export const TRANS_RATE = [0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2];
export const TRANS_PITY_K = 0.5;
export const transGold = (ilv, tr) => Math.round(enhanceCost(ilv, 15) * 4 * (tr + 1) ** 1.5);
export const transOre = (tr) => (4 + 15 * 3) * 3 * (tr + 1);
export const transMarks = (tr) => 3 + tr * 2;
export const TRANS_NAME = ['', '초월 一', '초월 二', '초월 三', '초월 四', '초월 五', '초월 六', '초월 七', '초월 八', '초월 九', '초월 十'];
export const BOSS_ITEM_RATE = 0.12;              // 두목이 그 지역 하급 장비를 떨굴 확률
export const KING_ITEM_RATE = 0.3;               // 십이지왕은 더 자주
// 가락지·귀걸이: 강화가 어렵다 — 성공률 절반, 은자 ×3, 돌파 없음
export const ACC2_RATE = 0.5;
export const ACC2_COST = 3;
// 두목이 가락지·귀걸이를 떨굴 확률 — 높은 두목일수록 자주 (죽림 3% … 천외천 10% · 왕 12~17%)
export const acc2DropRate = (z) => (z > NORMAL_ZONES ? 0.12 + (z - NORMAL_ZONES - 1) * 0.0045 : 0.03 + (z - 1) * 0.005);
// v150 던전앤파이터식 강화 — 지금 강화 수치(lv)에서 한 단계 올릴 성공률. 전에는 +9→10이 40%, 실패해도 잃는 게 없어 너무 빨리 셌다.
//   +1~3 100% · +4 95 · +5 90 · +6 80 · +7 75 · +8 62 · +9 53 · +10 41 · +11 32 · +12 24 · +13 18 · +14 12 · +15 8%
export const ENH_RATE = [1, 1, 1, 0.95, 0.9, 0.8, 0.75, 0.62, 0.53, 0.41, 0.32, 0.24, 0.18, 0.12, 0.08];
export const enhanceRate = (lv) => ENH_RATE[lv] ?? 0.05;
// 실패하면: +4~7을 노리다 실패 -1 · +8~10은 -3 · +11부터는 장비가 부서진다(강화 보호부를 쓰면 대신 -1)
// v192: 덜 괴롭게 — 전에는 +4~7 -1 · +8~10 -3 · +11부터 부서짐(성장 장비는 +0). 이제 +7까지 그대로 · +8~10 -1 ·
// +11부터 -2(보호부를 쓰면 그대로). 장비는 사라지지 않는다. 대신 **천장**: 실패할 때마다 그 장비의 다음 확률이
// 그 칸 확률의 절반만큼 쌓이고(성공하면 비운다) — 운이 아주 나빠도 끝없이 막히지 않는다.
export const enhanceFail = (lv) => (lv < 7 ? 0 : lv < ENHANCE_NORMAL ? -1 : -2);
export const enhanceRisky = (lv) => lv >= ENHANCE_NORMAL;      // 보호부를 쓸 수 있는 자리
export const ENH_PITY_K = 0.5;
export const enhanceFailText = (lv) => { const f = enhanceFail(lv); return f === 0 ? '실패해도 그대로' : `실패하면 ${f}`; };
// 강화 보호부 — 상인이 판다. +11부터 실패할 때 하나를 써서 -2 대신 그대로 (v192: 전에는 부서지는 대신 -1). 값은 그 레벨 사냥 20분어치 은자쯤.
// v204: 너무 싸서 늘 쌓아 두고 썼다 — 네 배(그 레벨 사냥 한 시간 남짓어치)
export const protPrice = (level) => Math.round(mobGold(level) * 8000);
// 은자가 쌓이기만 하지 않게 — 사냥터를 옮겨 새 장비를 낄 때마다 다시 강화하는 데 쓰인다(시뮬로 맞춤)
export const enhanceCost = (ilv, lv) => Math.round((50 + ilv * 15) * (lv + 1) ** 1.6);
// v153: 조합 장비를 팔면 만들 때 든 재료·은자의 1/4을 돌려받는다(it.cost, 옛 장비는 그 칸 레어 조합값으로 셈)
export const SELL_BACK = 0.25;
export function sellBack(item) {
  if (item.step == null) return null;
  const c = item.cost || recipeOf(item.slot, item.step, 0, item.line || 'base');
  const mats = {};
  for (const [k, n] of Object.entries(c.mats || {})) { const v = Math.floor(n * SELL_BACK); if (v > 0) mats[k] = v; }
  return { mats, gold: Math.floor((c.gold || 0) * SELL_BACK) };
}
// v425 떨어진 장비(레어·유니크·전설·신화) 파는 값 — 레어 ×1 → ×5 · 유니크 ×4 → ×14(「약한 것 팔기」·자동 정리로 파는 레어·유니크가 몹 한 마리 은자의 두세 배뿐이었다)
export const SELL_RAR_K = [5, 14, 27, 48];
export const sellPrice = (item) => Math.round((3 + item.ilv * 1.5) * (item.step != null ? SELL_RAR_K[Math.min(3, item.rar || 0)] : GRADES[item.grade].mult ** 2) * (1 + (item.plus || 0) * 0.2));
// ---------- 장비 등급과 스킬 옵션 (v110) ----------
// 같은 장비라도 등급이 넷 — 레어 · 유니크 · 전설 · 신화. 등급이 높을수록 기본 수치가 크고,
// 스킬을 키우는 옵션이 붙는다(1차 스킬 범위 · 2차 스킬 피해 …). 신화에는 사기적인 특수 효과가 하나 더.
// 얻는 길: 조합(대부분 레어) · 두목 드랍(더 잘 뜬다) · 대장장이 **승급**(재료·증표·은자로 한 등급 위, 확정).
export const RARITY = [
  { id: 0, name: '레어', color: '#60a5fa', mult: 1, opts: 1 },
  // v153: 등급 배수를 줄였다(1.25·1.55·2.0 → 1.2·1.4·1.7) — 신화 +0이 레어 +15만큼 셌다. 강화와 비슷한 무게로.
  { id: 1, name: '유니크', color: '#c084fc', mult: 1.2, opts: 1 },
  { id: 2, name: '전설', color: '#fb923c', mult: 1.4, opts: 2 },
  { id: 3, name: '신화', color: '#f43f5e', mult: 1.7, opts: 2, special: true },
];
export const RARITY_GRADE = [2, 3, 4, 5];       // 칼빛·테두리 색 (옛 GRADES 자리)
export const CRAFT_RAR_W = [70, 22, 7, 1];
export const BOSS_RAR_W = [45, 38, 14, 3];       // 두목 드랍
export const KING_RAR_W = [25, 42, 28, 5];       // 십이지왕 드랍 (v153 신화 10%→5%)
export const rollRarity = (w, rng) => {
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
};
// 스킬 옵션: s는 스킬 칸(0 1차 · 1 2차 · 2 3차). 값은 등급별.
export const SKILL_OPTS = {
  // v130: 보조기(3)·4차(4)에도 붙는다 — 보조기의 '피해'는 세기
  // v153: 신화 쪽을 줄였다(피해 +60%→+35% · 숨 -30%→-20% · 치명 +25%p→+18%p …)
  dmg: { name: '피해', fmt: 'pct', vals: [0.1, 0.16, 0.24, 0.35], slots: [0, 1, 2, 3, 4] },
  range: { name: '범위', fmt: 'pct', vals: [0.1, 0.15, 0.22, 0.32], slots: [1, 2, 4] },
  splash: { name: '범위(주변 적도 맞는다)', fmt: 'pct', vals: [0.25, 0.35, 0.5, 0.7], slots: [0] },
  cd: { name: '숨', fmt: 'neg', vals: [0.06, 0.09, 0.13, 0.2], slots: [0, 1, 2, 3, 4] },
  cost: { name: '체력 소모', fmt: 'neg', vals: [0.15, 0.25, 0.4, 0.6], slots: [1, 2, 4] },
  crit: { name: '치명', fmt: 'pp', vals: [0.05, 0.08, 0.12, 0.18], slots: [0, 1, 2, 4] },
};
// 신화 특수 효과 — 하나만
export const MYTHIC = {
  echo: { name: '30% 확률로 한 번 더 터진다', slots: [0, 1, 2] },
  free: { name: '체력을 쓰지 않는다', slots: [1, 2] },
  reset: { name: '적을 쓰러뜨리면 숨이 바로 돈다', slots: [0, 1, 2] },
};
// 십이지왕의 신화 — 왕마다 고유 효과 (그 왕 지역 장비가 신화가 되면 보통 특수 효과 대신 이것)
export const KING_MYTHIC = {
  12: { id: 'combo', name: '유혼절명권 — 평타 세 번째마다 피해 ×3' },
  11: { id: 'reflect', name: '기관 갑주 — 받은 피해의 40%를 되돌린다' },
  10: { id: 'stun', name: '귀혼음 — 스킬에 맞은 적이 1.5초 멎는다' },
  9: { id: 'drain', name: '혈해 — 준 피해의 4%만큼 체력을 빨아들인다' },
  8: { id: 'revive', name: '목형천혼술 — 체력 30% 아래로 떨어지면 절반을 되찾는다(60초에 한 번)' },
  7: { id: 'petal', name: '천녀야우장 — 치명타가 둘레 적에게 꽃잎으로 60% 번진다' },
  6: { id: 'execute', name: '암천야신공 — 체력 40% 아래 적에게 피해 +60%' },
  5: { id: 'dodge', name: '환영 — 25% 확률로 공격을 흘린다' },
  4: { id: 'frenzy', name: '명부살법 — 적을 쓰러뜨리면 4초간 공격 속도 +50%' },
  3: { id: 'bossbane', name: '투신 — 두목에게 주는 피해 +50%' },
  2: { id: 'crimson', name: '일월암혈도법 — 치명 피해 +80%' },
  1: { id: 'formless', name: '무형신검 — 평타가 둘레 모든 적을 벤다(70%) · 스킬 피해 +30%' },
};
export const SKILL_ORDINAL = ['1차', '2차', '3차', '보조기', '4차', '길'];
// 가락지·귀걸이에만 붙을 수 있는 '애완동물 +N' (함께 키울 수 있는 수가 는다)
export const PET_SLOT_OPT = [0, 1, 2, 3];      // 등급별 (레어는 없음)
export const PET_SLOT_CHANCE = 0.35;
// v390 애완동물 칸 — 장비 옵션 운만이 아니라 레벨로도(50 · 100에 하나씩) · 모두 합쳐 다섯까지
export const PET_SLOT_LV = [50, 100];
export const PET_SLOT_MAX = 5;
export function rollSkillOpts(rar, rng, extra = 0) {
  const out = [];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  for (let i = 0; i < RARITY[rar].opts + extra; i++) {
    let s = 0, keys = [];
    for (let t = 0; t < 20 && !keys.length; t++) {
      s = Math.floor(rng() * 5);
      keys = Object.keys(SKILL_OPTS).filter((k) => SKILL_OPTS[k].slots.includes(s) && !out.some((o) => o.s === s && o.k === k));
    }
    if (!keys.length) continue;
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
  if (o.kp) return `【${KINGS.find((k) => k.no === o.kp)?.title}】 ${KING_MYTHIC[o.kp].name}`;
  if (o.pet) return `애완동물 +${o.pet} (함께 키우는 수)`;
  if (o.tf) return `${SKILL_ORDINAL[o.s]} 스킬 ${TRANSFORMS[o.tf].name} — ${TRANSFORMS[o.tf].desc}`;
  if (o.res) return `${{ cold: '한기', heat: '열기', poison: '독기', dark: '마기' }[o.res]} 저항 +${Math.round(o.v * 100)}% (그 기운의 사냥터)`;
  const sk = SKILL_ORDINAL[o.s];
  if (o.sp) return `${sk} 스킬: ${MYTHIC[o.sp].name}`;
  const d = SKILL_OPTS[o.k];
  const v = d.fmt === 'pp' ? `+${Math.round(o.v * 100)}%p` : d.fmt === 'neg' ? `-${Math.round(o.v * 100)}%` : `+${Math.round(o.v * 100)}%`;
  return `${sk} 스킬 ${d.name} ${v}`;
}

// ---------- 스킬 레벨 (v110) ----------
// 레벨 5부터(v270 — 전엔 15) 레벨이 오를 때마다 스킬 점수 1. 스킬 레벨 n → n+1에 점수 n.
// 한 레벨에 피해 +7% · 숨 -2%. 5레벨에 범위 +15%(1차는 주변 적 20%), 10레벨에 범위 +30%(1차 40%) · 치명 +10%p.
// v205: 만렙 10 → 15(極). 값은 1·1·2·2·3·3·4·4·5(10까지 25점) · 11~15는 6점씩(15까지 55점) — 전에는 n점씩(10까지 45점).
// 레벨 150이면 점수 146(v270) — 무공 둘셋을 만렙으로, 나머지와 심법은 골라서. 다시 고르려면 무공 초기화.
export const SKILL_LV_MAX = 15;
export const SKILL_PT_FROM = 5;    // v270: 15 → 5 (1차 전직을 레벨 5로 당기면서 함께)
export const SKILL_PT_FROM_OLD = 15;   // 옛 세이브 보정용
export const skillLvCost = (lv) => (lv < 10 ? Math.ceil(lv / 2) : 6);
export const skillLvCostOld = (lv) => lv;                  // v205 전 값 — 옛 세이브에 차이를 돌려줄 때만
export const skillSpent = (lv, cost = skillLvCost) => { let n = 0; for (let l = 1; l < lv; l++) n += cost(l); return n; };
// 무공 초기화 — 처음 한 번은 공짜, 그다음은 그 레벨 사냥 10분쯤 은자
export const skillResetCost = (level, n) => (n ? Math.round(mobGold(level) * 1000) : 0);
export function skillLvMods(slot, lv) {
  const m = { dmg: (lv - 1) * 0.07, cd: Math.min(0.3, (lv - 1) * 0.02), range: 0, splash: 0, crit: 0 };
  if (lv >= 5) { if (slot === 0) m.splash += 0.2; else m.range += 0.15; }
  if (lv >= 10) { if (slot === 0) m.splash += 0.2; else m.range += 0.15; m.crit += 0.1; }
  if (lv >= 15) { if (slot === 0) m.splash += 0.2; else m.range += 0.15; m.crit += 0.1; }   // 極
  return m;
}

// 이름: 지역마다 무기 결이 다르면 좋겠지만 단순하게 — 등급·칸 이름
const SLOT_NOUN = {
  weapon: { sword: '검', fist: '권갑', fan: '부채', poison: '독낭', ring: '지환' },
  armor: '도포', hat: '두건', acc: '옥패', glove: '수투', shoe: '운혜',
};
// v112: 두목마다 가락지·귀걸이가 다르다 — 이름과 덤 능력(그 두목의 결). 높은 두목일수록 덤도 크다.
const ACC2_NAMES = [null,
  ['청죽환', '죽엽 귀걸이'], ['사막옥 가락지', '모래별 귀걸이'], ['빙정 반지', '서리꽃 귀걸이'], ['혈석 지환', '핏방울 귀걸이'],
  ['귀화 반지', '도깨비불 귀걸이'], ['운모환', '구름 귀걸이'], ['마철 지환', '마령 귀걸이'], ['수정 가락지', '물비늘 귀걸이'],
  ['금강 지환', '보리 귀걸이'], ['야명주 반지', '등불 귀걸이'], ['매화환', '매화 귀걸이'], ['독룡 지환', '독초 귀걸이'],
  ['현빙 반지', '현빙 귀걸이'], ['해왕 가락지', '진주 귀걸이'], ['천외 지환', '별빛 귀걸이'],
  ['유혼 권환', '절명 귀걸이'], ['기관 반지', '톱니 귀걸이'], ['귀혼 반지', '음율 귀걸이'], ['혈해 지환', '혈왕 귀걸이'],
  ['천혼 목환', '목령 귀걸이'], ['야우 반지', '천녀 귀걸이'], ['암야 지환', '흑린 귀걸이'], ['환영 반지', '쌍영 귀걸이'],
  ['명부 지환', '명부 귀걸이'], ['투신 권환', '투신 귀걸이'], ['일월 지환', '암혈 귀걸이'], ['무형 검환', '검왕 귀걸이'],
];
// 덤 능력: 지역마다 하나 (가락지 · 귀걸이 다르게) — 값은 지역이 높을수록 크다
const ACC2_TRAITS = ['crit', 'speed', 'hpPct', 'regenPct', 'def', 'exp', 'mat', 'skill', 'critDmg', 'atkPct'];
const TRAIT_BASE = { crit: 0.012, speed: 0.015, hpPct: 0.02, regenPct: 0.0008, def: 4, exp: 0.02, mat: 0.03, skill: 0.025, critDmg: 0.04, atkPct: 0.02 };
export const TRAIT_TEXT = { crit: '치명', speed: '공격 속도', hpPct: '최대 체력', regenPct: '초당 체력 회복', def: '방어', exp: '경험치', mat: '재료 드랍', skill: '스킬 피해', critDmg: '치명 피해', atkPct: '공격력' };
export function acc2Trait(z, slot) {
  const k = ACC2_TRAITS[(z * 3 + (slot === 'ear' ? 5 : 0)) % ACC2_TRAITS.length];
  return { [k]: TRAIT_BASE[k] * (1 + z * 0.22) };
}
const ACC2_NOUN = { finger: '가락지', ear: '귀걸이' };
// v375 대성신장 부위 이름 — 맡은 마왕(wdgn.WRAID_BOSSES와 같게)
export const PALMA_BY_SLOT = { weapon: { name: '우마왕' }, armor: { name: '교마왕', piece: '비늘갑' }, hat: { name: '붕마왕', piece: '금시관' }, glove: { name: '사타왕', piece: '사자수투' },
  shoe: { name: '미후왕', piece: '통풍혜' }, acc: { name: '우융왕', piece: '뇌정패' }, finger: { name: '손오공', piece: '긴고환' } };
export const itemName = (item, job) => {
  // v130 왕의 장비 (레벨 100) — 세트 조각 · 공용 장신구
  if (item.king != null) {
    const st = item.set ? setOf(item.set) : null;
    const wn = SLOT_NOUN.weapon[st?.job || job] || '검';
    if (st?.palma) { const b = PALMA_BY_SLOT[item.slot]; return b ? `${b.name}의 ${item.slot === 'weapon' ? wn : b.piece}` : `팔마${wn}`; }   // v375
    if (st) return `${st.short}${item.slot === 'weapon' ? wn : SET_PIECE[item.slot]}`;
    if (ACC2_NOUN[item.slot]) return ACC2_NAMES[item.king]?.[item.slot === 'ear' ? 1 : 0] || ACC2_NOUN[item.slot];
    return `${STEP_PREFIX[item.king] || ''} 옥패`;
  }
  if (ACC2_NOUN[item.slot]) return ACC2_NAMES[itemZone(item)]?.[item.slot === 'ear' ? 1 : 0] || ACC2_NOUN[item.slot];
  const n = item.slot === 'weapon' ? (SLOT_NOUN.weapon[job] || '검') : SLOT_NOUN[item.slot];
  if (item.starter) return `수련용 ${n}`;
  if (item.step != null) return `${STEP_PREFIX[itemZone(item)]}${n}`;
  return `${GRADES[item.grade].name} ${n}`;
};

// ---------- 물약 ----------
export const POTION_HEAL = 0.35;
// v175: 몹 은자 5.5마리어치(레벨 45까지는 1배에서 차츰). 전에는 한 마리어치도 안 돼 벌이의 1~13%였다 —
// 센 무인이 물약을 들이부으며 한참 위에서 방치하는 게 이득이었다. 이제 내 레벨 사냥터는 벌이의 10%쯤,
// 두 지역 위는 절반~거의 다(위에서 방치하기가 부담스럽다).
export const POTION_KILLS = 5.5;
export const potionPrice = (level) => Math.round(mobGold(level) * Math.min(POTION_KILLS, 1 + level / 10));
// v176: 자동 물약을 먹는 체력 — 설정에서 고른다 (s.potionAt)
export const POTION_ATS = [0.3, 0.45, 0.6, 0.75];
export const POTION_AT = 0.45;        // 체력이 이 아래면 자동으로 먹는다
export const POTION_GAP = 0.8;
export const REST_HEAL = 0.25;        // 마을에서는 초당 최대 체력의 25%

// 비급 — 은자로 스탯 점수 +1. 살 때마다 18%씩 비싸진다. 강화를 다 한 뒤로 은자가 쌓이기만 했다(시뮬).
// v204: 한 권마다 18%씩 올라 마흔 권째가 375만·여든 권째가 28억이었다 — 3000에서 9%씩(마흔 권째 9만 · 여든 권째 290만)
export const statBookCost = (n) => Math.round(3000 * 1.09 ** n);

// ---------- 무인 수치 ----------
export const CRIT_DMG = 1.8;
export const BASE_ATK_SEC = 0.85;     // 평타 간격(초)
// v438 바람의나라 걸음 — 게임 안 시간이 실제의 PACE배로 흐른다(걷기·평타·무공 숨·몹·다시 나기·장판 모두 같이 느려진다 · 칠대성 탄막은 그대로).
//   느려진 만큼 한 마리 벌이(경험치·은자·재료·조각)를 1/PACE배로 — 실제 한 시간 벌이·방치 보상은 전과 같다.
export const PACE = 0.75;
export const PACE_REWARD = 1 / PACE;
// v438 평타는 민첩·장비·칭호로 빨라질수록 「더 빨리」 대신 「더 세게」 — 실제 휘두르는 간격은 빨라짐^SWING_K만, 남은 몫은 한 대 피해로(초당 피해는 같다).
//   민첩을 많이 찍어 평타가 초에 너댓 번 나가던 것(정신없음)이 한 번 남짓으로 · 바람의나라처럼 한 대 한 대
export const SWING_K = 0.35;
// v439 바람식 몹 — 사냥터 졸개는 먼저 덤비지 않는다(치면 그때 덤빈다) · 정예·두목·던전 몹은 그대로 다가온다
export const PASSIVE_MOBS = true;
//   몹이 찾아오지 않아 걸어가 잡는 시간만큼 사냥터 한 마리 벌이 ×PASSIVE_REWARD(시뮬: 처치 -10~30%)
export const PASSIVE_REWARD = 1.05;   // v444 1.15 → 1.05 — 주력 무공(숨이 짧아져 자주 쓴다)으로 사냥이 빨라진 만큼
// v439 사냥터 두목·왕·고수의 초식은 바닥 경고(피하기) 대신 이름을 외치고 STRIKE_WIND초 뒤 무인에게 바로 내리꽂는 「강타」 하나 —
//   피할 수 없으니 세기는 옛 초식이 실제로 맞던 몫(방치 자동 피하기로 10~30%)에 맞춰 STRIKE_K배. 버티는 건 체력·방어·물약·회복 무공.
export const STRIKE_WIND = 1.2, STRIKE_K = 0.25, STRIKE_ULT_K = 0.4;
// v440 던전(무한의 탑 · 극 · 문파 토벌) 수문장도 강타 한 방 — 방치로는 못 피하던 경고를 다 맞던 것 대비 ×STRIKE_INST_K
//   (여러 갈래가 겹쳐 두세 번 맞기도 했다 → 한 방으로). 직접 피하던 사람에겐 조금 아프고, 방치하던 사람에겐 덜 아프다.
export const STRIKE_INST_K = 0.85;
// v439 무공이 중요하게 — 평타(와 평타에서 나가는 꽃잎·쪼개기 같은 덤) 피해 ×BASIC_K, 무공 피해 ×SKILL_K(초당 피해는 비슷하게)
export const BASIC_K = 0.6, SKILL_K = 1.2;
// v441 체력이 곧 힘 — 체력을 소모하는 무공은 소모한 체력 × HP_DMG_K 만큼 피해가 더해진다(바람의나라: 체력을 올려 체력을 쓰고 그만큼 세게).
//   한 번 맞을 때 더해지는 몫 = 소모 체력 × K ÷ 공격력 ÷ (맞는 횟수). 최대 체력이 오를수록 소모도·피해도 같이 오른다.
export const HP_DMG_K = 2;
// v442 전직·승급마다 최대 체력 보너스 — 체력이 곧 힘(v441)이라 전직이 곧 화력이다. 4차(99)는 「승급」이라 부른다
export const TIER_HP = [0, 0.03, 0.06, 0.10, 0.25, 0.32];   // v447 승급 18 → 25% · 5차 25 → 32%(수련 몫을 전직으로)
export const tierHp = (t) => TIER_HP[Math.max(0, Math.min(TIER_HP.length - 1, t | 0))];
// v447 99 뒤 힘은 전직으로 — 승급(4차)부터 공격력 +TIER_ATK(5차는 천마신공 배수가 따로 크다) · 수련 한 단계의 몫은 레벨의 TRAIN_K만큼(기본 공격력·체력) · 능력치 점수 STAT_PER_TRAIN
export const TIER_ATK = [0, 0, 0, 0, 0.15, 0.15];
export const tierAtk = (t) => TIER_ATK[Math.max(0, Math.min(TIER_ATK.length - 1, t | 0))];
export const TRAIN_K = 0.4;
export const STAT_PER_TRAIN = 1;
export const baseLv = (L) => Math.min(L, 99) + Math.max(0, L - 99) * TRAIN_K;   // 기본 공격력·체력에 쓰는 레벨
export const tierLabel = (t) => (t === 4 ? '승급(4차)' : `${t}차 전직`);
export const swingSec = (atkSec) => BASE_ATK_SEC * Math.pow(atkSec / BASE_ATK_SEC, SWING_K);
export const KILL_RECOVER = 0.15;     // v303 과녁을 쓰러뜨리면 평타 쿨을 이만큼으로 — 다음 몹까지 걸어가 또 한 박자 쉬지 않게 (v305 0.3 → 0.15)
export const MANUAL_HOLD = 0.3;       // v305 손으로 움직인 직후 과녁을 쫓아가지 않는 시간(닿는 적은 친다) — 전엔 0.6~1.2초를 서 있었다
// v305 칭호 — 운영자가 우편으로 준다. 끼면 능력치·연출. 옛 '개국공신'은 글자 그대로 저장돼 있다(효과 없음).
//   atkMul: 공격력 배수 · hitFx: 때릴 때마다 과녁 위에 뜨는 글자 · col: 빛깔 · (v322) spdMul 공격 속도 · goldMul 은자 · expMul 경험치 배수
export const TITLES = {
  founder: { id: 'founder', name: '개국공신', desc: '옛 판에서 온 무인', col: '#fde68a' },
  okheir: { id: 'okheir', name: '이미옥의 후예', desc: '공격력 ×2 · 때릴 때마다 〈옥〉', atkMul: 2, hitFx: '옥', col: '#6ee7b7' },
  // v322 운영자만 보낼 수 있다(얻는 길 없음 — how가 없다) · spdMul 공격 속도 · goldMul 은자 · expMul 경험치 · fxSize 글자 크기
  yoon: { id: 'yoon', name: '윤석열의 가호', desc: '공격력 ×3 · 공격 속도 ×1.5 · 은자 ×2 · 경험치 ×2 · 때릴 때마다 〈Yoon Again〉', atkMul: 3, spdMul: 1.5, goldMul: 2, expMul: 2, hitFx: 'Yoon Again', fxSize: 22, col: '#f87171' },
  // v307 저절로 얻는 칭호 — how: 이루는 길(글). 조건은 wgame.titleDone
  lv100: { id: 'lv100', name: '초절정', desc: '공격력 +2%', how: '레벨 100', atkMul: 1.02, col: '#a5b4fc' },
  lv150: { id: 'lv150', name: '천하제일', desc: '공격력 +5% · 때릴 때마다 〈天〉', how: '레벨 150', atkMul: 1.05, hitFx: '天', col: '#fde68a' },
  quest: { id: 'quest', name: '길잡이 졸업', desc: '공격력 +2%', how: '길잡이를 끝까지', atkMul: 1.02, col: '#86efac' },
  tower50: { id: 'tower50', name: '탑의 주인', desc: '공격력 +3%', how: '무한의 탑 50층', atkMul: 1.03, col: '#93c5fd' },
  hard30: { id: 'hard30', name: '극의 도전자', desc: '공격력 +4%', how: '무한의 탑 · 극 30층', atkMul: 1.04, col: '#f59e0b' },
  hard60: { id: 'hard60', name: '극을 넘은 자', desc: '공격력 +8% · 때릴 때마다 〈極〉', how: '무한의 탑 · 극 60층(끝)', atkMul: 1.08, hitFx: '極', col: '#fbbf24' },
  tower120: { id: 'tower120', name: '탑을 넘은 자', desc: '공격력 +6% · 때릴 때마다 〈塔〉', how: '무한의 탑 120층(끝)', atkMul: 1.06, hitFx: '塔', col: '#60a5fa' },
  kings: { id: 'kings', name: '십이지 제압', desc: '공격력 +6% · 때릴 때마다 〈王〉', how: '십이지왕 열둘을 모두 잡기', atkMul: 1.06, hitFx: '王', col: '#fbbf24' },
  cheonma: { id: 'cheonma', name: '천마를 꺾은 자', desc: '공격력 +5% · 때릴 때마다 〈魔〉', how: '천마 비무 승리', atkMul: 1.05, hitFx: '魔', col: '#c084fc' },
  hwamugi: { id: 'hwamugi', name: '화무기의 호적수', desc: '공격력 +8% · 때릴 때마다 〈極〉', how: '화무기 비무 승리', atkMul: 1.08, hitFx: '極', col: '#f97316' },
  magwi: { id: 'magwi', name: '마귀 사냥꾼', desc: '공격력 +10% · 때릴 때마다 〈鬼〉', how: '숨은 두목 마귀 격파', atkMul: 1.1, hitFx: '鬼', col: '#f43f5e' },
  dan10: { id: 'dan10', name: '각인의 극', desc: '공격력 +3%', how: '각인 한 칸을 10단(극)까지', atkMul: 1.03, col: '#fcd34d' },
  res4: { id: 'res4', name: '공명의 주인', desc: '공격력 +4% · 때릴 때마다 〈鳴〉', how: '공명 Ⅳ(장비 여덟 모두 같은 기운)', atkMul: 1.04, hitFx: '鳴', col: '#7dd3fc' },
  okq: { id: 'okq', name: '옥안(玉眼)', desc: '공격력 +3%', how: '천품(天品) 각인을 끼기', atkMul: 1.03, col: '#fcd34d' },
  k100k: { id: 'k100k', name: '십만 처치', desc: '공격력 +2%', how: '몹 10만 마리', atkMul: 1.02, col: '#d6d3d1' },
  petdan: { id: 'petdan', name: '영수의 주인', desc: '공격력 +3% · 때릴 때마다 〈獸〉', how: '애완동물 하나를 10단까지', atkMul: 1.03, hitFx: '獸', col: '#fb923c' },
  petq: { id: 'petq', name: '천품 영수', desc: '공격력 +3%', how: '천품(天品) 애완동물을 얻기', atkMul: 1.03, col: '#fcd34d' },
  wking: { id: 'wking', name: '주간 패왕', desc: '공격력 +6% · 때릴 때마다 〈霸〉 · 한 주 동안', how: '이번 주 두목 순위 1위 → 다음 주 내내', atkMul: 1.06, hitFx: '霸', col: '#f87171', timed: true },
  // v319 새 칭호
  wb100: { id: 'wb100', name: '두목 사냥꾼', desc: '공격력 +3%', how: '한 주에 두목 100마리', atkMul: 1.03, col: '#fca5a5' },
  wbfast: { id: 'wbfast', name: '일각(一刻)', desc: '공격력 +4% · 때릴 때마다 〈刻〉', how: '화무기를 1분 안에 쓰러뜨리기', atkMul: 1.04, hitFx: '刻', col: '#fb7185' },
  pet5q: { id: 'pet5q', name: '영수 수집가', desc: '공격력 +3%', how: '극품 이상 애완동물 다섯', atkMul: 1.03, col: '#c4b5fd' },
  titles15: { id: 'titles15', name: '천하의 이름', desc: '공격력 +5% · 때릴 때마다 〈名〉', how: '칭호 열다섯 모으기', atkMul: 1.05, hitFx: '名', col: '#fef08a' },
  // v373 월드보스
  wraid10: { id: 'wraid10', name: '강호의 방패', desc: '공격력 +3%', how: '월드보스 처치에 열 번 함께하기', atkMul: 1.03, col: '#f472b6' },
  palma8: { id: 'palma8', name: '대성신장을 두른 자', desc: '공격력 +8% · 때릴 때마다 〈魔〉', how: '대성신장 일곱 부위를 모두 끼기', atkMul: 1.08, hitFx: '魔', col: '#f97316' },
  seokga: { id: 'seokga', name: '손바닥 안의 무인', desc: '공격력 +20% · 때릴 때마다 〈佛〉', how: '석가여래를 쓰러뜨리기 — 그래도 손바닥 안이었다', atkMul: 1.2, hitFx: '佛', col: '#fcd34d' },
  okhwang: { id: 'okhwang', name: '천외천(天外天)', desc: '공격력 +15% · 때릴 때마다 〈天〉', how: '천궁의 옥황상제 쓰러뜨리기', atkMul: 1.15, hitFx: '天', col: '#fde68a' },
  wraid1: { id: 'wraid1', name: '천하 토벌 일인자', desc: '공격력 +6% · 때릴 때마다 〈討〉', how: '월드보스 피해 순위 1위로 처치', atkMul: 1.06, hitFx: '討', col: '#ef4444' },
  // v403 요일 던전 높은 단계 — 어느 요일이든 처음 닿으면
  daily50: { id: 'daily50', name: '요일의 고수', desc: '공격력 +3%', how: '요일 던전 한 곳 50단계', atkMul: 1.03, col: '#a7f3d0' },
  daily75: { id: 'daily75', name: '요일의 절정', desc: '공격력 +5% · 때릴 때마다 〈曜〉', how: '요일 던전 한 곳 75단계', atkMul: 1.05, hitFx: '曜', col: '#5eead4' },
  daily100: { id: 'daily100', name: '칠요(七曜)의 주인', desc: '공격력 +8% · 때릴 때마다 〈日〉', how: '요일 던전 한 곳 100단계', atkMul: 1.08, hitFx: '日', col: '#2dd4bf' },
  // v409 각성 고수
  awk1: { id: 'awk1', name: '각성을 꺾은 자', desc: '공격력 +4%', how: '각성 고수 하나를 쓰러뜨리기', atkMul: 1.04, col: '#fca5a5' },
  awkMagwi: { id: 'awkMagwi', name: '각성 마귀 사냥꾼', desc: '공격력 +6% · 때릴 때마다 〈鬼〉', how: '각성 마귀를 쓰러뜨리기', atkMul: 1.06, hitFx: '鬼', col: '#f43f5e' },
  awkAll: { id: 'awkAll', name: '각성 천하', desc: '공격력 +10% · 때릴 때마다 〈覺〉', how: '각성 고수 여섯을 모두 쓰러뜨리기', atkMul: 1.1, hitFx: '覺', col: '#ef4444' },
  k1m: { id: 'k1m', name: '백만 처치', desc: '공격력 +4% · 때릴 때마다 〈萬〉', how: '몹 100만 마리', atkMul: 1.04, hitFx: '萬', col: '#e7e5e4' },
};
export const AUTO_TITLES = Object.values(TITLES).filter((t) => t.how);
// v316 주간 두목 순위 — 빨리 잡기를 겨루는 두목 · 기록의 가장 짧은 초(꾸민 값 거르기 — 서버 규칙도 같은 값)
export const WBOSS_RACE = ['hwamugi', 'magwi', 'awk'];   // v409 awk = 각성 마귀 최단(두목 방 고수 id가 아니다)
export const WBOSS_MIN_SEC = 3;
// v318 지난주 순위 보상 — 세 순위표(처치·화무기·마귀) 가운데 가장 좋은 자리 하나로 한 번. 1위는 〈주간 패왕〉 한 주 동안
export const WB_REWARD = [
  { soul: 30, shard: 60, goldK: 2 },     // 1위
  { soul: 20, shard: 40, goldK: 1.5 },   // 2위
  { soul: 10, shard: 25, goldK: 1 },     // 3위
];
export const WB_TITLE_DAYS = 7;
export const TITLE_SET_BONUS = 0.01;   // v315 칭호 모음 — 가진 칭호 하나마다 공격력·체력 +1% (끼지 않아도)
export const titleOf = (k) => (k === '개국공신' ? TITLES.founder : TITLES[k] || null);      // v303 과녁을 쓰러뜨리면 평타 쿨을 이만큼으로 줄인다 — 다음 몹까지 걸어가 또 한 박자 쉬지 않게
export const HERO_SPEED = 200;      // 한 칸에 0.32초 (칸 길은 비스듬히 못 가서 자유 이동보다 조금 빠르게)
export const MELEE_RANGE = 70;
export const DEATH_EXP_LOSS = 0.05;
export const RETURN_SEC = 3;

// ---------- 방치 ----------
export const OFFLINE_CAP_SEC = 10 * 3600;
export const RATE_WINDOW_SEC = 300;
// v261: 처치 포화 — 분당 처치가 이만큼을 넘으면 한 마리 경험치가 (기준/분당)^0.8로 준다.
// 광역 직업(환마·독마)이 다시 나는 속도 상한(분당 2,100)에 닿아 다른 직업보다 세 배 빨리 올랐다(시뮬 7일 vs 16일). 은자는 그대로.
export const EXP_SAT_KPM = 800;
export const CHALLENGE_K = 0.05, CHALLENGE_MAX = 4;   // v425 도전 경험치 — 나보다 높은 몹 레벨 차 1마다 +5% · 네 배까지
export const expSat = (kpm) => (kpm > EXP_SAT_KPM ? (EXP_SAT_KPM / kpm) ** 0.8 : 1);
export const FOLLOW_GAP = 3;   // v260: 알맞은 사냥터 따라가기 — 구역 최고 레벨보다 이만큼 넘게 높으면 옮긴다
// v260: 방치 효율 — 오래 비울수록 덜 번다(앞 두 시간은 그대로). [이 시각(초)까지, 그 구간 효율]
// 만렙을 실사용 2주에 맞추며 '열 시간 방치 = 레벨 +20'이던 것을 누른다.
export const OFFLINE_TIERS = [[2 * 3600, 1], [6 * 3600, 0.7], [14 * 3600, 0.4]];   // v262 무관 증축으로 상한이 14시간까지 늘 수 있다
// v262: 은자 쓸 곳 — 무관 증축(방치 상한 +1시간씩 · 방치 효율 +5%씩) · 영약(30분 경험치·은자 +25%)
export const HALL = {
  cap: { name: '방치 상한', max: 4, desc: (n) => `방치를 ${10 + n}시간까지 쳐요` },
  eff: { name: '방치 효율', max: 5, desc: (n) => `방치 벌이 +${n * 5}%` },
};
// 지금 레벨에서 사냥 한 시간 은자(시뮬: 분당 몹 100마리) × 단계마다 커지는 배수
export const hallCost = (kind, n, level) => Math.round(mobGold(level) * 100 * 60 * (kind === 'cap' ? 4 : 3) * (n + 1) ** 1.6);
export const ELIXIR_SEC = 30 * 60;
export const ELIXIR_MAX = 3 * 3600;
export const ELIXIR_BONUS = 0.25;
export const elixirPrice = (level) => Math.round(mobGold(level) * 100 * 20);   // 사냥 20분어치
// v262 세력 상점 — 세력 재료를 바꾼다. 협의패 → 보호부 · 흑도령 → 애완동물 영단 · 마혈정 → 십이지 뽑기권(무작위 신)
export const FAC_SHOP = [
  { id: 'prot', mat: 'fm', n: 150, name: '강화 보호부 1장', desc: '+11부터 실패해도 그대로' },
  { id: 'petfood', mat: 'fs', n: 100, name: '애완동물 영단', desc: '데려간 애완동물이 경험치를 크게 얻어요' },
  { id: 'ticket', mat: 'fg', n: 800, name: '십이지 뽑기권 1장', desc: '열두 신 가운데 하나(무작위)' },
];
export function offlineEffSec(t) {
  let out = 0, from = 0;
  for (const [to, k] of OFFLINE_TIERS) { if (t <= from) break; out += (Math.min(t, to) - from) * k; from = to; }
  return out;
}

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


// ---------- 애완동물 (v111 · v112 순위) ----------
// 두목만 떨군다. 장착하면 무인 곁에서 무인 공격력에 비례해 사냥하고, 무인에게 버프를 건다.
// 무인과 함께 경험치를 받아 자란다(레벨 30까지). 한 번에 한 마리 — 가락지·귀걸이의 '애완동물 +N'만큼 더.
// 바꾸려면 키우던 것을 놓아줘야 한다(버리기). 떨군 것은 우리(최대 10)에 들어가 기다린다.
//
// v112: **순위**(tier 1 아래 … 10 위). 위일수록 한 대가 세고 버프가 크다. 초반 두목은 아주 낮은 확률로
// 아래 것만, 높은 두목일수록 자주·위 것까지 떨군다(지역 → 나올 수 있는 가장 높은 순위).
export const PETS = [
  { id: 'crane', tier: 1, name: '선학', emoji: '🦢', buff: 'regenPct', base: 0.003, text: '초당 체력 회복' },
  { id: 'fox', tier: 2, name: '구미호', emoji: '🦊', buff: 'mat', base: 0.1, text: '재료 드랍' },
  { id: 'qilin', tier: 3, name: '기린', emoji: '🦄', buff: 'exp', base: 0.08, text: '경험치' },
  { id: 'turtle', tier: 4, name: '현무', emoji: '🐢', buff: 'hpPct', base: 0.1, text: '최대 체력' },
  { id: 'haetae', tier: 5, name: '해태', emoji: '🦁', buff: 'def', base: 25, text: '방어' },
  { id: 'phoenix', tier: 6, name: '주작', emoji: '🦅', buff: 'crit', base: 0.04, text: '치명' },
  { id: 'monkey', tier: 7, name: '손오공', emoji: '🐒', buff: 'speed', base: 0.08, text: '공격 속도' },
  { id: 'dragon', tier: 8, name: '청룡', emoji: '🐉', buff: 'skill', base: 0.14, text: '스킬 피해' },
  { id: 'tiger', tier: 9, name: '백호', emoji: '🐯', buff: 'atkPct', base: 0.12, text: '공격력' },
  { id: 'yellow', tier: 10, name: '황룡', emoji: '🐲', buff: 'atkPct', base: 0.18, also: { hpPct: 0.18 }, text: '공격력·최대 체력' },
];
export const petOf = (id) => PETS.find((p) => p.id === id) || PETS[0];
export const petArt = (p, rar) => ((rar ?? p?.rar) >= 3 ? `${p?.kind ?? p}_m` : (p?.kind ?? p));   // v366 신화는 따로 그린 겉모습
// 애완동물 기술 (v206) — 몇 초마다 과녁 둘레를 한 번에 친다(평타의 PET_SKILL_MULT배 · 반지름 PET_SKILL_R). 등급이 높을수록 자주.
// v365 더 넓게 · 세게 · 자주 + 종마다 고유 효과 — 6초(등급마다 12% 짧게 · 신화 3.8초) · 평타의 7배 · 반지름 240 + 등급 30 + 순위 6(황룡은 화면 전체)
export const PET_SKILL_SEC = 6;
export const PET_SKILL_MULT = 7;
export const PET_SKILL_R = 240;
export const petSkillSec = (p) => PET_SKILL_SEC * (1 - (p.rar || 0) * 0.12);
export const petSkillR = (p) => (p.kind === 'yellow' ? 620 : PET_SKILL_R + (p.rar || 0) * 30 + petOf(p.kind).tier * 6);
export const PET_SKILL_SP = {
  crane: '무인 체력 8% 회복', fox: '3초 동안 불태움(80%)', qilin: '기절(두목은 짧게)', turtle: '무인에게 보호막(체력 10% · 6초)', haetae: '크게 둔화(3초)',
  phoenix: '거센 불태움(120% · 4초)', monkey: '분신 셋이 연타(1.5배)', dragon: '번개가 둘레 적 다섯에게 튄다(60%)', tiger: '반드시 치명타 · 1.3배', yellow: '화면 전체 · 무인 피해 +20%(6초)',
};
export const PET_SKILL_NAME = { crane: '학익진', fox: '여우불', qilin: '기린각', turtle: '현무파', haetae: '해태충', phoenix: '주작염', monkey: '분신봉', dragon: '청룡뇌', tiger: '백호참', yellow: '황룡진' };
// 지역 → 두목 애완동물 확률과 나올 수 있는 가장 높은 순위
export const petDropRate = (z) => (z > NORMAL_ZONES ? 0.02 + (z - NORMAL_ZONES) * 0.0015 : 0.0008 + (z - 1) * 0.0006);   // 죽림 0.08% … 천외천 0.92% · 왕 2.15~3.8%
export const petMaxTier = (z) => (z > NORMAL_ZONES ? Math.min(10, 8 + Math.floor((z - NORMAL_ZONES - 1) / 4)) : Math.min(7, 1 + Math.floor((z - 1) / 2.33)));   // 죽림 1 … 천외천 7 · 권왕 8 … 검왕 10
// 나올 수 있는 순위 가운데 아래 것이 더 잘 (한 칸 위마다 ×0.55)
export function rollPetKind(z, rng) {
  const top = petMaxTier(z);
  const pool = PETS.filter((p) => p.tier <= top);
  const w = pool.map((p) => 0.55 ** (top - p.tier) * (p.tier === top ? 0.5 : 1));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].id; }
  return pool[0].id;
}
// v263 강호 견문록 — 몹 종마다 DEX_NEED마리를 잡으면 낙관. 한 지역을 다 찍으면 경험치 +DEX_ZONE_EXP.
export const DEX_NEED = 100;
export const DEX_ZONE_EXP = 0.005;
// 지역마다 그 지역 졸개 이름들(두목 구역·마을·던전 빼고)
let DEX_Z = null;
export function dexZones() {
  if (DEX_Z) return DEX_Z;
  const out = (DEX_Z = []);
  for (const zn of ZONE_ORDER) {
    const names = [];
    for (const m of MAPS) if (m.zone === zn.id && !m.town && !m.inst) for (const k of m.mobs || []) if (k?.name && !names.includes(k.name)) names.push(k.name);
    if (names.length) out.push({ id: zn.id, name: zn.name, lv: zn.lv, names });
  }
  return out;
}
// v263 무공 각성(Lv55) — v311부터 1~3차 무공마다 변형 하나씩. 맨 처음 하나는 공짜, 그 뒤(새로 붙이기·바꾸기)는 은자
export const AWAKEN_LV = 55;
export const AWAKEN_KINDS = [
  { id: 'twin', name: '쌍(雙)', desc: '30% 확률로 한 번 더', long: '펼칠 때마다 30% 확률로 같은 무공이 한 번 더 터져요(그림도 두 번). 운이 좋으면 피해가 두 배.', mods: { echoP: 0.3 } },
  { id: 'wide', name: '광(廣)', desc: '범위 +40%', long: '무공이 닿는 둘레가 40% 넓어져요. 몹이 많이 몰린 사냥터에서 한 번에 더 많이 잡아요.', mods: { range: 0.4 } },
  { id: 'swift', name: '속(速)', desc: '숨 -25%', long: '다시 쓰기까지 기다리는 시간(숨)이 25% 줄어요. 같은 시간에 더 자주 펼쳐요.', mods: { cd: 0.25 } },
  { id: 'heavy', name: '중(重)', desc: '피해 +60% · 숨 +15%', long: '한 방이 60% 세지는 대신 숨이 15% 길어져요. 두목처럼 오래 때리는 상대에게 좋아요.', mods: { dmg: 0.6, cd: -0.15 } },
];
export const awakenSwapCost = (level) => Math.round(mobGold(level) * 100 * 30);
// v263 깨달음(만렙) — 만렙 뒤 경험치가 깨달음 점수가 된다. 무공 칸마다 깨달음 단계(피해 +3% · 숨 -1%), 단계가 오를수록 비싸진다.
export const ENL_STEP = { dmg: 0.03, cd: 0.01 };
export const ENL_MAX = 50;
export const enlCost = (lv) => 1 + Math.floor(lv / 5);
export const enlExp = () => Math.round(expToNext(149) * 0.25);
export const PET_LV_MAX = 30;
// v262 애완동물 — 포획 조각(졸개가 가끔 떨군다 → 모으면 그 지역 애완동물 하나) · 혼(Lv30 뒤 경험치 → 등급 올리기)
export const PET_SHARD_RATE = 1 / 150;   // v364 두 배
export const PET_SHARD_NEED = 100;
export const PET_SOUL_COST = [6, 18, 45];   // 레어→영웅 · 영웅→전설 · 전설→신화
export const PET_BOX = 300;   // v362 우리 10 → 30칸 · v389 → 300칸
// 무인 경험치의 절반을 받는다. 무인 레벨 10+4×(애완 레벨)의 60% — 무인과 함께 오래 자란다
export const petExpToNext = (lv) => Math.round(expBase(10 + lv * 4) * 0.6);
// 순위·등급(레어~신화)·레벨로 버프·공격이 커진다
// v316 품(品) — 얻을 때 굴린다(극품 5% · 천품 0.5%) · 단(段) — 다 큰 뒤 혼으로 수련(성공 확률 · 실패하면 다음 확률 +10% · 大成은 두 단)
export const PET_QUAL = [{ id: 0, name: '', mark: '', mult: 1 }, { id: 1, name: '극품', mark: '◆', mult: 1.25, col: '#c4b5fd' }, { id: 2, name: '천품', mark: '✦', mult: 1.6, col: '#fcd34d' }];
export const PET_QUAL_P = [0.05, 0.005];   // 극품 · 천품
export const rollPetQual = (rng) => { const r = rng(); return r < PET_QUAL_P[1] ? 2 : r < PET_QUAL_P[0] + PET_QUAL_P[1] ? 1 : 0; };
export const PET_DAN_MAX = 10;
export const PET_DAN_K = 0.08;                // 단마다 버프·공격 +8% → 10단 +80%
export const petDanSoul = (d) => 3 + 2 * d;   // 0→1단 혼 3 … 9→10단 혼 21
export const PET_DAN_P = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3];
export const PET_DAN_PITY = 0.1;              // 실패할 때마다 다음 확률 +10%p (성공하면 0)
export const PET_DAN_GREAT = 0.12;            // 성공하면 12%로 大成 — 한 번에 두 단
export const petDanChance = (d, fails = 0) => Math.min(1, (PET_DAN_P[d] ?? 0) + fails * PET_DAN_PITY);
export const petQualMult = (pet) => PET_QUAL[pet.q || 0]?.mult || 1;
export const petDanMult = (pet) => 1 + (pet.dan || 0) * PET_DAN_K;
// v364 뽑기 운이 곧 강함 — 애완동물 효과 1.3배 · 등급 차를 크게(레어 1 · 유니크 1.35 · 전설 1.8 · 신화 2.5)
export const PET_POWER_K = 1.3;
export const PET_RAR_MULT = [1, 1.35, 1.8, 2.5];
export const petScale = (pet) => PET_POWER_K * PET_RAR_MULT[pet.rar] * (1 + (pet.lv - 1) * 0.05) * (1 + (pet.star || 0) * PET_STAR_K) * petQualMult(pet) * petDanMult(pet);   // v292 별 · v316 품·단
// v390 다 키운 신화(별 5 · 단 10 · Lv30)는 ×23까지 커져 백호 하나가 공격력 +275%, 황룡이 공격·체력 +412%였다 — 칸 운(1~5마리)이 곧 강함(두 배)이었다.
//   버프만 ×3 위로는 완만하게(×23 → ×9.2). 처음 몇 마리(×3 아래)는 그대로. 애완동물이 치는 힘(petAtkRatio)은 그대로.
export const PET_BUFF_SOFT = 3;
export const petBuffScale = (pet) => { const sc = petScale(pet); return sc <= PET_BUFF_SOFT ? sc : PET_BUFF_SOFT * (sc / PET_BUFF_SOFT) ** 0.55; };
export const petBuff = (pet) => petOf(pet.kind).base * petBuffScale(pet);
export const petAtkRatio = (pet) => (0.1 + petOf(pet.kind).tier * 0.025 + (pet.lv - 1) * 0.012) * PET_POWER_K * PET_RAR_MULT[pet.rar] * (1 + (pet.star || 0) * PET_STAR_K) * petQualMult(pet) * petDanMult(pet);   // 무인 공격력 대비 한 대 · v292 별 · v316 품·단
export const PET_ATK_SEC = 1.6;

// ---------- v292 동료 키우기 — 얻는 곳 늘리기 · 별 · 도감 · 길들이기 ----------
// 탈것 조각: 졸개가 가끔(정예 ×3) · 모으면 지금 지역의 탈것 하나(포획 조각과 같은 꼴)
export const MOUNT_SHARD_RATE = 1 / 250;   // v364 두 배
export const MOUNT_SHARD_NEED = 100;
// 조각을 주는 곳 — 두목(왕·고수 ×2) · 일일 던전 한 판(소탕 포함) · 탑(처음 오른 층, 10층마다 ×5) · 보물 원숭이 · 주간 상자 · 방치(두목 처치만큼)
export const BOSS_SHARDS = { pet: [6, 12], mount: [4, 8] };   // v364 두 배
export const dailyShards = (stage) => 2 * (3 + Math.floor(stage / 3));   // v364 두 배
export const TOWER_SHARDS = 8;   // v364 두 배
export const TREASURE_SHARDS = 12;   // v364 두 배
export const WEEK_SHARDS = 80;   // v364 두 배
// 별 — 같은 종을 먹이로 주면 별 하나(최대 다섯) · 별마다 버프·공격 +12%
export const PET_STAR_MAX = 5;
export const PET_STAR_K = 0.12;
// 놓아주면 혼이 남는다(등급별 + 레벨 10마다 1) — 전엔 그냥 사라졌다
export const petReleaseSoul = (p) => [1, 2, 4, 8][p.rar || 0] + Math.floor((p.lv || 1) / 10);
// 도감 — 한 번이라도 가진 종(애완은 그 종의 가장 높은 등급까지)만큼 공격력·최대 체력이 영구히 오른다
export const PET_DEX_K = 0.003;     // 종마다 (가장 높은 등급 + 1) × 0.3% → 열 종 모두 신화면 +12%
export const MOUNT_DEX_K = 0.002;   // 탈것 종마다 0.2% → 서른 모두 +6%
// 도감 이정표 — 모은 만큼 상을 받는다(한 번씩)
export const PET_DEX_GOALS = [
  { n: 2, soul: 5, text: '두 종' }, { n: 4, soul: 12, petShard: 50, text: '네 종' }, { n: 6, soul: 25, petShard: 100, text: '여섯 종' },
  { n: 8, soul: 40, petShard: 150, text: '여덟 종' }, { n: 10, soul: 80, petShard: 300, text: '열 종 모두' },
];
export const PET_DEX_MYTH_GOALS = [{ n: 1, soul: 20, text: '신화 한 종' }, { n: 5, soul: 60, text: '신화 다섯 종' }, { n: 10, soul: 150, text: '신화 열 종' }];
export const MOUNT_DEX_GOALS = [
  { n: 3, mountShard: 50, text: '세 종' }, { n: 6, mountShard: 100, text: '여섯 종' }, { n: 9, mountShard: 150, text: '아홉 종' },
  { n: 12, mountShard: 250, text: '열두 종' }, { n: 18, mountShard: 400, text: '열여덟 종' }, { n: 24, mountShard: 800, text: '스물넷 종' },
  { n: 30, mountShard: 1500, text: '서른 모두' },   // v435 탈것은 서른 종(보통 12 · 십이지 12 · 극 6) — 「스물넷 모두」라 적혀 있었다(뒤에 붙여 받은 기록은 그대로)
];
// 길들이기 — 탈것마다 레벨(최대 10). 레벨마다 이동·공격·체력 +6% · 조각과 은자
export const MOUNT_LV_MAX = 10;
export const HARD_LV_MAX = 20, HARD_LV_K = 0.04, HARD_SPD_LV_K = 0.02;
export const mountLvMax = (d) => (d?.hard ? HARD_LV_MAX : MOUNT_LV_MAX);
export const mountLvK = (d) => (d?.hard ? HARD_LV_K : MOUNT_LV_K);
export const MOUNT_LV_K = 0.06;
export const mountTameCost = (tier, lv, hard = false) => (hard ? { shard: 20 + lv * 10, gold: Math.round(3000 * 2.1 ** 12 * (lv + 1)) } : { shard: 10 + lv * 6, gold: Math.round(2000 * 2.1 ** Math.min(12, tier) * (lv + 1)) });

// ---------- 탈것 (v111 · v112 열둘) ----------
// 이동 속도 +%와 공격력·체력 +%. 아주 드물게 — 졸개는 2만 마리에 하나 꼴, 두목은 지역이 높을수록 자주.
// 지역이 높을수록 좋은 탈것까지 나온다(나올 수 있는 가장 높은 순위). 좋은 탈것일수록 훨씬 빠르다.
export const MOUNTS = [
  { id: 'donkey', tier: 1, name: '나귀', emoji: '🫏', speed: 0.15, stat: 0.01 },
  { id: 'mule', tier: 2, name: '노새', emoji: '🫏', tint: '#92400e', speed: 0.22, stat: 0.02 },
  { id: 'horse', tier: 3, name: '조랑말', emoji: '🐴', speed: 0.3, stat: 0.03 },
  { id: 'camel', tier: 4, name: '사막 낙타', emoji: '🐫', speed: 0.38, stat: 0.04 },
  { id: 'deer', tier: 5, name: '설원 순록', emoji: '🦌', speed: 0.46, stat: 0.05 },
  { id: 'warhorse', tier: 6, name: '흑풍마', emoji: '🐎', speed: 0.55, stat: 0.07 },
  { id: 'white', tier: 7, name: '백운마', emoji: '🐎', tint: '#f8fafc', speed: 0.65, stat: 0.08 },
  { id: 'tigerm', tier: 8, name: '맹호', emoji: '🐅', speed: 0.75, stat: 0.1 },
  { id: 'redhare', tier: 9, name: '적토마', emoji: '🐎', tint: '#b91c1c', speed: 0.9, stat: 0.12 },
  { id: 'ochu', tier: 10, name: '오추마', emoji: '🐎', tint: '#111827', speed: 1.05, stat: 0.14 },
  { id: 'cloud', tier: 11, name: '천리운', emoji: '🦄', speed: 1.3, stat: 0.17 },
  { id: 'azure', tier: 12, name: '청룡마', emoji: '🐉', speed: 1.7, stat: 0.22 },
  // 십이지 신수 (v126) — 무한의 탑 10층마다 십이지 뽑기권 · 세력 상점 뽑기권 · 탈것 소환(하나에 0.1% · 300번 보장)으로 (사냥터에서 떨구지 않는다). 뒤 신일수록 세다.
  ...[['z1', '금서', '🐀'], ['z2', '철우', '🐂'], ['z3', '백호', '🐅'], ['z4', '옥토', '🐇'], ['z5', '황룡', '🐉'], ['z6', '청사', '🐍'],
    ['z7', '천마', '🐎'], ['z8', '운양', '🐏'], ['z9', '금강원', '🐒'], ['z10', '금계', '🐓'], ['z11', '천구', '🐕'], ['z12', '흑저', '🐗']]
    .map(([id, nm, emoji], i) => ({ id, tier: 13, zodiac: i + 1, name: `십이지 ${nm}`, emoji, speed: +(0.45 + (i + 1) * 0.11).toFixed(2), stat: +(0.04 + (i + 1) * 0.017).toFixed(3) })),
];
// v157: 이동 속도 증가폭을 절반으로 — 60%만 돼도 너무 빨랐다 (청룡마 +170% → +85%)
export const MOUNT_SPEED_K = 0.5;
for (const m of MOUNTS) m.speed = +(m.speed * MOUNT_SPEED_K).toFixed(3);
// v350 극(極)의 신수 — 무한의 탑 하드 모드 10층마다 그 층을 지키는 신수(처음 깨면 꼭). 이동은 고정(길들여도 그대로 · v360 층 따라 +90%~+120%),
//   대신 공격력·체력이 크게 오른다. 합성·떨굼 없음(극 층을 처음 깨면 꼭 · 탈것 소환 하나에 0.05%). fx: 탈 때 둘레에 이는 기운(battle.js drawMountAura)
export const HARD_MOUNTS = [
  { id: 'h1', name: '염화주작', emoji: '🔥', stat: 0.27, fx: 'flame', col: '#f97316', desc: '불꽃 깃이 흩날리는 남방의 신조', sp: '불길 — 1초마다 둘레 적에게 공격력 35% 불 피해' },
  { id: 'h2', name: '빙백설린', emoji: '❄️', stat: 0.31, fx: 'frost', col: '#7dd3fc', desc: '서리꽃을 밟고 달리는 얼음 기린', sp: '서리 — 둘레 적이 느려진다(이동·공격 둔화)' },
  { id: 'h3', name: '뇌령기린', emoji: '⚡', stat: 0.35, fx: 'thunder', col: '#c084fc', desc: '발굽마다 벼락이 튀는 천둥 기린', sp: '벼락 — 2.2초마다 가장 센 적에게 공격력 220% 벼락' },
  { id: 'h4', name: '야천흑표', emoji: '🌑', stat: 0.39, fx: 'void', col: '#a855f7', desc: '그림자 불꽃을 두른 밤하늘의 표범', sp: '그림자 — 회피 +8%' },
  { id: 'h5', name: '창해교룡', emoji: '🌊', stat: 0.44, fx: 'tide', col: '#22d3ee', desc: '물결 비늘로 허공을 헤엄치는 교룡', sp: '물결 — 1초마다 최대 체력 1.5% 회복' },
  { id: 'h6', name: '혼원금룡', emoji: '🐲', stat: 0.5, fx: 'gold', col: '#fbbf24', desc: '금빛 법륜을 이고 하늘을 가르는 태초의 용', sp: '법륜 — 두목 피해 +10% · 은자 +15%' },
];
for (const [i, m] of HARD_MOUNTS.entries()) MOUNTS.push({ ...m, tier: 14, hard: i + 1, speed: 1 });
// v360 이동 줄 세우기 — 극의 신수는 층 따라 차등(염화주작 +90% … 창해교룡 +112% · 혼원금룡 +120%),
//   보통 탈것·십이지는 신수 아래로 같은 비율(×0.85 — 청룡마 +72% · 적토마 +38% · 나귀 +6%)
export const HARD_SPEED = [0.9, 0.96, 1.01, 1.06, 1.12, 1.2];
// v364 탈것 공격·체력 1.8배 — 좋은 탈것을 뽑으면 그만큼 세게(청룡마 +40% · 십이지 흑저 +44% · 혼원금룡 +90%)
export const MOUNT_STAT_K = 1.8;
export const MOUNT_SPEED_K2 = 0.85;
for (const m of MOUNTS) { m.speed = m.hard ? HARD_SPEED[m.hard - 1] : +(m.speed * MOUNT_SPEED_K2).toFixed(4); m.stat = +(m.stat * MOUNT_STAT_K).toFixed(4); }
for (const h of HARD_MOUNTS) { const m = MOUNTS.find((x) => x.id === h.id); h.stat = m.stat; h.speed = m.speed; }   // v437 이동도 — 없어서 극 카드에 「이동 +NaN%」(화면 몽키) · 극 카드·얻는 창 표시도 같은 값
// 길들인 이동 — 보통 탈것은 길들여도 극의 신수 가장 낮은 것(염화주작) 아래까지만(줄 순서가 뒤집히지 않게)
export const mountSpeed = (d, k = 1, lv = 0) => (!d ? 0 : d.hard ? d.speed * (1 + lv * HARD_SPD_LV_K) : Math.min(HARD_SPEED[0] - 0.02, d.speed * k));
// v361 극의 신수 길들이기 — 최대 20 · 레벨마다 이동 +2%(혼원금룡 20이면 +168%) · 공격·체력 +4% · 값은 보통 탈것 맨 위의 1.5배
// ---------- v362 뽑기(소환) — 조각 100으로 한 번 · 1000으로 열 번. 좋은 것부터 % (합 100) ----------
//   애완동물은 종과 등급을 따로 뽑는다. 10연차는 상위 하나 보장 · 천장(그 횟수 안에 맨 위가 안 나오면 꼭)
export const GACHA_COST = 100;
export const GACHA_PET_KIND = [['yellow', 0.5], ['tiger', 1], ['dragon', 2], ['monkey', 3.5], ['phoenix', 5], ['haetae', 8], ['turtle', 12], ['qilin', 18], ['fox', 22], ['crane', 28]];
export const GACHA_PET_RAR = [[3, 0.5], [2, 4.5], [1, 20], [0, 75]];   // 신화 · 전설 · 유니크 · 레어
export const GACHA_PET_PITY = 300;    // v363 300번 안에 신화가 안 나오면 300번째 신화(전엔 80)
export const GACHA_PET_TEN = 2;       // 10연차엔 전설 이상 하나
export const GACHA_MOUNT = [
  ...['h6', 'h5', 'h4', 'h3', 'h2', 'h1'].map((k) => [k, 0.05]),
  ...['z12', 'z11', 'z10', 'z9', 'z8', 'z7', 'z6', 'z5', 'z4', 'z3', 'z2', 'z1'].map((k) => [k, 0.1]),
  ['azure', 0.5], ['cloud', 1], ['ochu', 2], ['redhare', 3.5], ['tigerm', 5], ['white', 7], ['warhorse', 9], ['deer', 11], ['camel', 12.5], ['horse', 13.5], ['mule', 15.5], ['donkey', 18],
];
export const GACHA_MOUNT_PITY = 300;  // v363 300번 안에 신수(십이지·극)가 안 나오면 300번째 신수(전엔 100)
export const GACHA_MOUNT_TEN = 9;     // 10연차엔 적토마(순위 9) 이상 하나
export const GACHA_DUP_SHARD = 300;   // 가진 신수가 또 나오면 길들이기 +1 · 다 길들였으면 조각
// v368 오늘의 무료 소환(하루 한 번 · 종류마다) · 이번 주 픽업(확률 두 배 — 월요일 0시 한국 시간마다 바뀐다)
export const gachaDay = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
export const gachaWeek = (now = Date.now()) => Math.floor((now + 9 * 3600e3 - 4 * 86400e3) / (7 * 86400e3));   // 1970-01-05(월)부터 센 주
export const PICKUP_K = 2;
const PICK_PET = ['yellow', 'tiger', 'dragon', 'monkey', 'phoenix'];
const PICK_MOUNT = ['azure', 'cloud', 'ochu', 'z12', 'z7', 'z5', 'z3', 'redhare'];
export const gachaPickup = (now = Date.now()) => { const w = gachaWeek(now); return { pet: PICK_PET[w % PICK_PET.length], mount: PICK_MOUNT[(w * 3 + 1) % PICK_MOUNT.length] }; };
export const withPickup = (table, id) => table.map(([k, w]) => [k, k === id ? w * PICKUP_K : w]);
export function pickW(table, rng, filter = null) {
  const t = filter ? table.filter(filter) : table;
  let r = rng() * t.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of t) { r -= w; if (r <= 0) return k; }
  return t[t.length - 1][0];
}
// 연출 등급 0 파랑 · 1 보라 · 2 주황 · 3 무지개(최상) · 4 금빛 하늘(극의 신수)
export const mountGachaGrade = (d) => (d.hard ? 4 : d.zodiac ? 3 : d.tier >= 11 ? 2 : d.tier >= 8 ? 1 : 0);
export const petGachaGrade = (kind, rar) => Math.min(3, Math.max(rar, petOf(kind).tier >= 9 ? 2 : petOf(kind).tier >= 7 ? 1 : 0) + (rar >= 2 && petOf(kind).tier >= 9 ? 1 : 0));
export const spdPct = (v) => (v * 100).toFixed(1).replace(/\.0$/, '');   // 이동 +몇 %(소수 한 자리)
// 어느 탈것이 더 좋은가(새로 얻으면 갈아탈지) — 이동과 공격·체력을 함께 본다
export const mountRank = (d) => (d ? d.speed + d.stat : -1);
export const mountOf = (id) => MOUNTS.find((m) => m.id === id) || null;
// 탈것 합성 (v204) — 같은 순위 셋 + 은자 → 다음 순위 하나. 십이지 신수(순위 13)와 맨 위(청룡마 12)는 합성하지 않는다.
export const MOUNT_FUSE_N = 3;
export const MOUNT_TOP = 12;
// v415 최고 등급(합성할 데가 없는) 탈것이 같은 종으로 MOUNT_KEEP_TOP마리를 넘으면 더 얻은 것은 탈것 조각으로 — 60일 세이브에 청룡마 1,374마리(51KB)가 쌓였다
export const MOUNT_KEEP_TOP = 10, MOUNT_SPARE_SHARD = 5;
export const mountFuseCost = (tier) => Math.round(1000 * 1.9 ** tier);   // v350 크게 내림 (청룡마 합성 4,570만 → 116만)
export const mountOfTier = (tier) => MOUNTS.find((m) => m.tier === tier && !m.zodiac) || null;
// **졸개는 더 이상 안 떨군다.** 0.005%였다 — 2만 마리에 하나, 하루 꼬박
// 사냥해 한두 번이다. 사실상 없는 것인데 '어디서나 나온다'는 착각만 줬다.
// 탈것은 두목에게로 몬다.
export const MOUNT_DROP_MOB = 0;
// 모든 두목이 떨군다. 전에는 곧은 금(0.05% → 0.47%)이라 어디를 쳐도 비슷했다.
// 제곱으로 휘어 **낮은 사냥터는 더 귀하고, 뒤로 갈수록 확실히 는다.**
//   죽림 0.02% · 장강 0.28% · 천외천 1.2% · 권왕 2% … 검왕 6.4%
export const MOUNT_BOSS_MIN = 0.0002;
export const MOUNT_BOSS_MAX = 0.012;
export const MOUNT_BOSS_BEND = 2.2;
export const mountBossRate = (z) => (z > NORMAL_ZONES
  ? 0.02 + (z - NORMAL_ZONES - 1) * 0.004
  : MOUNT_BOSS_MIN + (MOUNT_BOSS_MAX - MOUNT_BOSS_MIN) * ((z - 1) / (NORMAL_ZONES - 1)) ** MOUNT_BOSS_BEND);
export const mountMaxTier = (z) => (z > NORMAL_ZONES ? Math.min(12, 10 + Math.floor((z - NORMAL_ZONES - 1) / 5)) : Math.min(10, 2 + Math.floor((z - 1) / 2)));
export const rollMount = (rng, z, boss) => {
  // 졸개는 한 칸 아래까지, 두목은 그 지역 끝까지 — 아래 것이 더 잘 (한 칸 위마다 ×0.6)
  const top = Math.max(1, mountMaxTier(z) - (boss ? 0 : 1));
  const pool = MOUNTS.filter((m) => m.tier <= top);
  const w = pool.map((m) => 0.6 ** (top - m.tier));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].id; }
  return pool[0].id;
};
