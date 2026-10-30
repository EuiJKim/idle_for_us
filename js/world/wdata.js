// 바람식 개편 — 데이터. 설계: docs/바람식_개편.md
//
// 옛 판(관문·수련·무공 여덟 …)과 따로 선다. 그림(지역·몹 생김새·캐릭터 무기)만 옛 data.js에서 빌린다.
// **숫자는 보통 숫자다.** 레벨 150에서도 몹 체력이 몇십만이라 Big이 필요 없다.
import { ZONES, JOBS, CLASS_SKILLS, RANKS } from '../data.js';
import { areaMobs } from './wmobs.js';
import { MASTERS } from './wmasters_data.js';
import { FAC_MAT_INFO, isFacMat, lineMats } from './wline.js';
import { TRANSFORMS, setOf, SET_PIECE, STONES, isStoneKey, promoteStones, LORD_MATS, isLordMat } from './wgear.js';

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
  { id: 'int', name: '내공', desc: '스킬 피해 +0.7% · 체력 회복 +0.12/초' },
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
    move: 0.15, boss: 1.1, flower: { every: 4, mult: 2.2, r: 150 } },
  // 권마는 평타가 곧 무공 — 평타 피해가 레벨마다 1%씩 붙는다. 무공은 약한 편이라 초반엔 뒤지고 후반에 앞선다.
  fist: { base: { str: 6, dex: 6, vit: 4, int: 2 }, trait: '불패(不敗) — 평타가 곧 무공: 평타가 레벨과 함께 자란다(레벨 1에 85% → 레벨 100에 150%) · 공격 속도 +25% · 받는 피해 -20%',
    speed: 1.25, dmgRed: 0.2, basicBase: 0.95, basicPerLv: 0.0065, atkK: 1.08 },   // v239: 무리 사냥이 평균의 0.8 언저리
  fan: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '섭혼(攝魂) — 멀리서 친다 · 맞은 적이 느려지고 받는 피해 +15% · 준 피해의 2%를 빨아들인다',
    slow: true, vuln: 0.15, drain: 0.02, atkK: 1.18 },   // v239: 다섯 직업 가운데 가장 약했다(사냥·단일 모두 평균의 0.7~0.9)
  poison: { base: { str: 4, dex: 4, vit: 4, int: 6 }, trait: '독아(毒牙) — 멀리서 친다 · 맞은 적이 중독(피해의 20%가 독으로 쌓인다) · 중독된 적이 쓰러지면 독이 둘레로 번진다',
    poison: 0.2, poisonSec: 4, spread: true },
  ring: { base: { str: 5, dex: 6, vit: 4, int: 3 }, trait: '공포(恐怖) — 붙은 적이 25% 확률로 공격을 머뭇거린다 · 붙으면 피해 +20% · 치명 피해 +15%',
    fear: 0.25, critDmg: 0.15 },
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

// ---------- 전직과 스킬 ----------
export const TIERS = [
  null,
  { level: 15, cost: 200 },
  { level: 40, cost: 5000 },
  { level: 75, cost: 120000 },
  { level: 100, cost: 3000000 },   // 4차 (v121 환마 · v123 모든 직업) — 4차 무공이 있는 직업만
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
    SK(1, 2, 'slash', '낙화유수', 'aoe', { mult: 1.6, hits: 2, cd: 5, hpCost: 0.08, radius: 240,
      desc: '꽃잎 지듯 둘레를 두 번 벤다' }),
    SK(2, 3, 'thunder', '만화귀일', 'aoe', { mult: 5.0, cd: 9, hpCost: 0.18, radius: 300, buff: { sec: 8, speed: 0.4 },
      desc: '만 송이 검화가 하나로 — 넓게 벤 뒤 8초간 공격 속도 +40%(마검 각성)' }),
    SK(3, 0, 'sup', '유운보', 'support', { cd: 24, hpCost: 0, from: 25, auto: 'fight', buff: { sec: 8, move: 0.6, speed: 0.25, dodge: 0.2 },
      desc: '흐르는 구름 같은 걸음 — 8초간 이동 속도 +60% · 공격 속도 +25% · 공격을 20% 흘린다' }),
    SK(4, 4, 'chain4', '일화천섬', 'daggers', { mult: 1.5, n: 12, targets: 12, cd: 18, hpCost: 0.15, radius: 420, autoAbove: 0.5, blink: true,
      desc: '번개처럼 적 사이를 오가며 최대 열둘을 차례로 벤다 — 적이 적으면 같은 적을 여러 번(두목 혼자면 열두 번), 지나간 자리마다 꽃이 핀다' }),
  ],
  fist: [
    SK(0, 1, 'frost', '붕산철권', 'single', { mult: 4.4, cd: 4.5, hpCost: 0, stun: 2,
      desc: '산을 무너뜨리는 한 주먹 · 2초 기절' }),
    SK(1, 2, 'slash', '투신난무', 'aoe', { mult: 1.35, hits: 4, cd: 5, hpCost: 0.08, radius: 230,
      desc: '권갑 투신으로 둘레를 네 번 두들긴다' }),
    SK(2, 3, 'thunder', '불패금신', 'aoe', { mult: 4.2, cd: 11, hpCost: 0, radius: 260, buff: { sec: 10, dmgRed: 0.5, cleave: 0.6 },
      desc: '금빛 몸 — 충격파를 낸 뒤 10초간 받는 피해 -50% · 평타가 둘레를 친다(60%) · 체력을 쓰지 않는다' }),
    SK(3, 0, 'sup', '금종조', 'support', { cd: 28, hpCost: 0, from: 25, auto: 'hurt', hurtAt: 0.7, shield: 0.3, buff: { sec: 12 },
      desc: '금종을 뒤집어쓴 듯 — 최대 체력 30%만큼 막아 주는 보호막(12초)' }),
    SK(4, 4, 'awaken', '투신강림', 'awaken', { cd: 24, hpCost: 0.1, from: 0, autoAbove: 0.5, auto: 'fight', buff: { sec: 15, speed: 0.3, triple: 2 },
      desc: '권갑 투신이 깨어난다 — 15초간 평타 한 번에 세 대(덧 두 대는 절반) · 공격 속도 +30%' }),
  ],
  ring: [
    SK(0, 1, 'frost', '혈앙지', 'single', { mult: 2.6, cd: 4, hpCost: 0, sure: true, dot: { sec: 5, mult: 0.6 },
      desc: '피의 재앙을 짚는 손가락 · 반드시 치명 · 5초 출혈' }),
    SK(1, 2, 'slash', '마극광폭장', 'aoe', { mult: 3.2, cd: 6, hpCost: 0.12, radius: 250, stun: 1.2,
      desc: '광폭한 장력이 둘레를 휩쓴다 · 맞은 적이 공포에 1.2초 굳는다' }),
    SK(2, 3, 'thunder', '소향비술', 'daggers', { mult: 0.85, n: 12, targets: 8, cd: 9, hpCost: 0.20, radius: 340, crit: 0.1,
      desc: '비수 열두 자루가 가까운 적 여덟에게 날아든다(치명 +10%p) · 세 무공을 6초 안에 이으면 삼공조화(8초간 피해 +25%)' }),
    SK(3, 0, 'sup', '무면개방', 'support', { cd: 26, hpCost: 0, from: 25, auto: 'fight', buff: { sec: 10, fear: 0.35, critDmg: 0.3 },
      desc: '가면을 벗는다 — 10초간 붙은 적의 공포 +35%p · 치명 피해 +30%' }),
    SK(4, 4, 'triple', '삼공합일', 'triple', { cd: 22, hpCost: 0.15, autoAbove: 0.5, boost: 1.3,
      desc: '세 무공이 하나로 — 혈앙지·마극광폭장·소향비술을 한꺼번에(각 1.3배) 펼치고 삼공조화가 바로 켜진다' }),
  ],
  poison: [
    SK(0, 1, 'frost', '칠보단혼침', 'single', { mult: 3.4, cd: 5, hpCost: 0, dot: { sec: 6, mult: 3.2 },
      desc: '일곱 걸음 안에 혼이 끊기는 독침 · 6초 맹독' }),
    SK(1, 2, 'slash', '화골산', 'field', { mult: 0.8, cd: 8, hpCost: 0.10, radius: 200, field: { sec: 6, tick: 0.5, mult: 0.26 },
      desc: '뼈를 녹이는 독무를 깐다 — 6초 동안 0.5초마다' }),
    SK(2, 3, 'thunder', '만독천라', 'aoe', { mult: 2.7, cd: 10, hpCost: 0.20, radius: 340, dot: { sec: 8, mult: 1.0 },
      desc: '만 가지 독이 하늘 그물처럼 — 넓게 맞히고 8초 맹독' }),
    SK(3, 0, 'sup', '만독귀원', 'support', { cd: 22, hpCost: 0, from: 25, auto: 'poisoned', radius: 320, burst: 1, healMax: 0.12,
      desc: '흩어진 독을 한데 거둔다 — 둘레 적에게 쌓인 독을 한꺼번에 터뜨리고 최대 체력의 12% 회복' }),
    SK(4, 4, 'hell', '만독지옥', 'aoe', { mult: 1.0, cd: 24, hpCost: 0.2, radius: 1400, autoAbove: 0.5, dot: { sec: 10, mult: 2.0 },
      desc: '사냥터 전체에 독비가 내린다 — 보이는 모든 적을 치고 독을 크게 쌓는다(10초에 걸쳐 피해의 2배)' }),
  ],
  fan: [
    SK(0, 1, 'frost', '섭혼술', 'single', { mult: 4.8, cd: 5, hpCost: 0, stun: 2.5, vuln: { sec: 6, v: 0.3 },
      desc: '혼을 거두는 눈빛 · 2.5초 멎고 6초간 받는 피해 +30%' }),
    SK(1, 2, 'slash', '혈루미혼', 'aoe', { mult: 2.3, cd: 8, hpCost: 0.10, radius: 200, stun: 2,
      desc: '핏빛 눈물이 혼을 홀린다 · 둘레가 2초 멎는다' }),
    SK(2, 3, 'thunder', '천외혈마공', 'aoe', { mult: 5.6, cd: 9, hpCost: 0.15, radius: 300, lifesteal: 0.05, vuln: { sec: 6, v: 0.2 },
      desc: '하늘 밖의 혈마공 · 준 피해의 5%를 빨아들이고 6초간 받는 피해 +20%' }),
    SK(3, 0, 'sup', '시공이환술', 'support', { cd: 30, hpCost: 0, from: 25, auto: 'hurt', hurtAt: 0.5, heal: 0.4, buff: { sec: 4, dmgRed: 0.6 },
      desc: '때와 자리를 바꿔 다친 몸을 되돌린다 — 잃은 체력의 40% 회복 · 4초간 받는 피해 -60%' }),
    SK(4, 4, 'clone', '환영분신술', 'clone', { mult: 0.28, cd: 28, hpCost: 0.12, radius: 240, n: 2, sec: 10, burst: 0.6, autoAbove: 0.5,
      desc: '시공이환술의 끝 — 분신 둘이 나와 둘레를 한 번씩 치고(×0.6) 10초 동안 곁에서 함께 싸운다(칠 때마다 공격력 ×0.28)' }),
  ],
};
export const SKILL_DEFS = JOB_SKILLS.sword;   // 옛 이름 (자리·차수만 보는 곳)
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
export const skillsOf = (job) => (JOB_SKILLS[job] || []).map((d) => ({ ...d, id: `s${d.slot}`, icon: d.name.slice(0, 2), fx: `${job}:m${d.slot}` }));   // 연출: skillfx_majon.js

// ---------- 지도 ----------
// 0번은 마을(객잔 마을). 1~15는 사냥터 — 옛 지역 그림과 몹 생김새를 쓴다.
// 바람의나라처럼 **칸** 위를 움직인다 — 사냥터 하나가 9×19칸, 화면 한 장에 통째로 들어온다
// (그리는 쪽이 이 크기에 맞춰 카메라를 물린다). 무인·몹은 한 칸씩 미끄러지듯 옮겨 가고,
// 한 칸에는 하나만 선다. 근접은 앞뒤좌우 바로 옆 칸에서 친다.
// (처음엔 1300×1700 자유 이동이었다 — 화면에 사냥터 한 귀퉁이만 보였다)
export const TILE = 64;
export const MOVE_CAST_R = 420;   // v157: 걷는 중 자동 무공이 과녁을 잡는 거리
export const COLS = 9;
export const ROWS = 19;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;
export const tileCenter = (c) => (c + 0.5) * TILE;
// v176: 18마리·5초 → 24마리·3초. 센 무인은 들판을 비우고 몹을 기다리는 시간이 길었다.
// 들판에 반도 안 남으면 두 배 빨리 다시 난다.
export const MOBS_ALIVE = 24;
export const RESPAWN_SEC = 3;

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
// 몹 레벨이 내 레벨보다 이만큼 넘게 위면 '위험' (v146 — 레벨 제한 대신)
export const DANGER_LV = 5;
// 레벨 차이 (v149): 한 레벨 높을 때마다 내 피해 -1.5%(최소 25%) · 받는 피해 +2% — 40레벨 위면 ×0.4 · ×1.8
export const GAP_OUT = 0.015;
export const GAP_OUT_MIN = 0.25;
export const GAP_IN = 0.02;
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
export const BOSS = { hp: 14, atk: 2.5, exp: 25, gold: 30 };
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
export const NO_BASE_MULT = 1.5;
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
export const matName = (key) => (isLordMat(key) ? LORD_MATS[key].name : isFacMat(key) ? FAC_MAT_INFO[key].name : isStoneKey(key) ? stoneName(key) : String(key)[0] === 'b' ? `${ZONES_W[+String(key).slice(1)]?.boss?.name || '두목'}의 증표` : MATS[key]);
export const matColor = (key) => (isLordMat(key) ? LORD_MATS[key].col : isFacMat(key) ? FAC_MAT_INFO[key].col : isStoneKey(key) ? '#f0abfc' : String(key)[0] === 'b' ? (kingOf(+String(key).slice(1)) ? '#f43f5e' : '#fde68a') : MAT_COLORS[key]);
export const MAT_RATE = 0.5;          // 몹 하나가 재료 하나를 떨굴 확률
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
export const stepUpper = () => false;
export const TIER_COUNT = STEP_COUNT;            // 옛 이름 (칸 수)
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
export const stepGrade = (step) => Math.min(4, Math.floor(step / 4));
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
export const ENHANCE_STEP = 0.15;                // +1~+10: 한 단계에 기본 수치 +15% (v153: 12%에서 — 강화가 어려워진 만큼 크게)
export const BREAK_STEP = 0.3;                   // 돌파 +11~+15: 한 단계에 +30% (+10 2.5배 · +15 4배, v153)
export const enhanceMult = (plus) => 1 + Math.min(plus, ENHANCE_NORMAL) * ENHANCE_STEP + Math.max(0, plus - ENHANCE_NORMAL) * BREAK_STEP;
export const breakMarks = (plus) => (plus >= ENHANCE_NORMAL ? plus - ENHANCE_NORMAL + 1 : 0);   // +10→11 증표 1 … +14→15 증표 5
// 강화에는 은자와 함께 그 장비 지역의 재료가 든다 — 재료를 넣을수록 장비가 세진다
export const enhanceMatsN = (plus) => 4 + plus * 3;
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
export const sellPrice = (item) => Math.round((3 + item.ilv * 1.5) * (item.step != null ? (1 + (item.rar || 0)) ** 2 : GRADES[item.grade].mult ** 2) * (1 + (item.plus || 0) * 0.2));
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
// 승급 비용: 그 장비 지역 재료 · 증표 · 은자
export const promoteCost = (it) => {
  const r = (it.rar || 0) + 1;
  // v132 왕의 장비: 검왕의 무형 검혼석 (증표 없음)
  if (it.king != null) return { key: 'st27', mats: promoteStones(it.rar || 0), marks: 0, gold: Math.round((30 + 100 * 10) * 3 * r) };
  // v153: 승급은 그 등급으로 바로 만들 때와 같은 차이만큼 든다 — 전에는 전설→신화가 재료 90·증표 6이라 신화가 너무 쉬웠다
  const k = itemZone(it);
  const sl = CRAFT_MATS[it.slot] ? it.slot : 'weapon';
  // v157: 계열 장비는 세력 재료도 같은 차이만큼 — 전에는 지역 재료만 들어서 기본 장비를 신화로 올리는 값이 삼파와 같았다
  const fac = {};
  if (it.line && it.line !== 'base' && it.step != null) for (const [fk, n] of Object.entries(lineMats(it.line, sl, it.step))) fac[fk] = Math.round(n * (RAR_MATS[r] - RAR_MATS[r - 1]));
  return { key: k, mats: Math.round(CRAFT_MATS[sl] * (RAR_MATS[r] - RAR_MATS[r - 1])), marks: CRAFT_BOSS[sl] * (RAR_BOSS[r] - RAR_BOSS[r - 1]),
    gold: Math.round((30 + craftLevel(k) * 10) * (RAR_GOLD[r] - RAR_GOLD[r - 1]) * 1.5), fac };
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
export const SKILL_ORDINAL = ['1차', '2차', '3차', '보조기', '4차'];
// 가락지·귀걸이에만 붙을 수 있는 '애완동물 +N' (함께 키울 수 있는 수가 는다)
export const PET_SLOT_OPT = [0, 1, 2, 3];      // 등급별 (레어는 없음)
export const PET_SLOT_CHANCE = 0.35;
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
// 1차 전직(레벨 15)부터 레벨이 오를 때마다 스킬 점수 1. 스킬 레벨 n → n+1에 점수 n.
// 한 레벨에 피해 +7% · 숨 -2%. 5레벨에 범위 +15%(1차는 주변 적 20%), 10레벨에 범위 +30%(1차 40%) · 치명 +10%p.
// v205: 만렙 10 → 15(極). 값은 1·1·2·2·3·3·4·4·5(10까지 25점) · 11~15는 6점씩(15까지 55점) — 전에는 n점씩(10까지 45점).
// 레벨 150이면 점수 136 — 무공 둘셋을 만렙으로, 나머지와 심법은 골라서. 다시 고르려면 무공 초기화.
export const SKILL_LV_MAX = 15;
export const SKILL_PT_FROM = 15;
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
export const itemName = (item, job) => {
  // v130 왕의 장비 (레벨 100) — 세트 조각 · 공용 장신구
  if (item.king != null) {
    const st = item.set ? setOf(item.set) : null;
    const wn = SLOT_NOUN.weapon[st?.job || job] || '검';
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
// 애완동물 기술 (v206) — 몇 초마다 과녁 둘레를 한 번에 친다(평타의 PET_SKILL_MULT배 · 반지름 PET_SKILL_R). 등급이 높을수록 자주.
export const PET_SKILL_SEC = 8;
export const PET_SKILL_MULT = 4;
export const PET_SKILL_R = 170;
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
export const PET_LV_MAX = 30;
export const PET_BOX = 10;
// 무인 경험치의 절반을 받는다. 무인 레벨 10+4×(애완 레벨)의 60% — 무인과 함께 오래 자란다
export const petExpToNext = (lv) => Math.round(expToNext(10 + lv * 4) * 0.6);
// 순위·등급(레어~신화)·레벨로 버프·공격이 커진다
export const petScale = (pet) => RARITY[pet.rar].mult * (1 + (pet.lv - 1) * 0.05);
export const petBuff = (pet) => petOf(pet.kind).base * petScale(pet);
export const petAtkRatio = (pet) => (0.1 + petOf(pet.kind).tier * 0.025 + (pet.lv - 1) * 0.012) * RARITY[pet.rar].mult;   // 무인 공격력 대비 한 대
export const PET_ATK_SEC = 1.6;

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
  // 십이지 신수 (v126) — 무한의 탑 10층마다 십이지 뽑기로만 (떨구지 않는다). 뒤 신일수록 세다.
  ...[['z1', '금서', '🐀'], ['z2', '철우', '🐂'], ['z3', '백호', '🐅'], ['z4', '옥토', '🐇'], ['z5', '황룡', '🐉'], ['z6', '청사', '🐍'],
    ['z7', '천마', '🐎'], ['z8', '운양', '🐏'], ['z9', '금강원', '🐒'], ['z10', '금계', '🐓'], ['z11', '천구', '🐕'], ['z12', '흑저', '🐗']]
    .map(([id, nm, emoji], i) => ({ id, tier: 13, zodiac: i + 1, name: `십이지 ${nm}`, emoji, speed: +(0.45 + (i + 1) * 0.11).toFixed(2), stat: +(0.04 + (i + 1) * 0.017).toFixed(3) })),
];
// v157: 이동 속도 증가폭을 절반으로 — 60%만 돼도 너무 빨랐다 (청룡마 +170% → +85%)
export const MOUNT_SPEED_K = 0.5;
for (const m of MOUNTS) m.speed = +(m.speed * MOUNT_SPEED_K).toFixed(3);
export const mountOf = (id) => MOUNTS.find((m) => m.id === id) || null;
// 탈것 합성 (v204) — 같은 순위 셋 + 은자 → 다음 순위 하나. 십이지 신수(순위 13)와 맨 위(청룡마 12)는 합성하지 않는다.
export const MOUNT_FUSE_N = 3;
export const MOUNT_TOP = 12;
export const mountFuseCost = (tier) => Math.round(3000 * 2.4 ** tier);
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
