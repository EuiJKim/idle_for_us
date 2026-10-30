// 장비 개편 (v130) — 레벨 99까지는 조합 사다리(고유 옵션), 99부터는 직업 세트와 왕의 장신구.
// 설계: docs/바람식_개편.md 'v130'
//
// - 조합 사다리는 보통 지역 15곳(레벨 1~98)에서 끝난다. 장비 레벨은 99까지.
//   사다리 장비(무기·옷·모자·장갑·신발)마다 **고유 옵션**이 하나씩 붙는다 — 지역 × 칸으로 정해져 있다.
//   높은 지역 것이 기본 수치는 세지만 고유 옵션은 지역마다 달라서, 여러 지역 것을 섞어 끼는 맛이 있다.
// - 레벨 99부터는 십이지왕 재료·증표로 만든다(레벨 100 고정 — 그다음은 강화·돌파·승급으로만 자란다).
//   · 직업마다 세트 둘(모두 열) — 세트마다 왕 하나와 묶여, 그 왕의 재료·증표를 모아야 만든다.
//     다섯 조각(무기·옷·모자·장갑·신발), 2·3·5조각 효과(디아블로 세트처럼). 자기 직업 세트만 효과가 난다.
//   · 장신구·가락지·귀걸이는 모든 직업 공용 — 아무 왕의 재료로나 만든다. 옵션은 다섯 스킬 어디에든 붙는다.
// - 스킬 변화 옵션(화염·빙결·뇌전·거대화·응축)은 어느 장비에서나 나올 수 있다 — 범위와 연출이 바뀐다.
import { FAC_MATS } from './wline.js';

// ---------- 고유 옵션 (사다리 장비) ----------
// 키: 그 수치를 무인 능력에 더한다 (wgame stats). 값은 하급 기준 — 상급 ×1.3, 지역이 높을수록 조금씩(지역마다 +5%), 등급 배수.
export const GEAR_KEYS = {
  atkPct: { name: '공격력', fmt: 'pct' }, hpPct: { name: '최대 체력', fmt: 'pct' }, crit: { name: '치명', fmt: 'pp' }, critDmg: { name: '치명 피해', fmt: 'pct' },
  speed: { name: '공격 속도', fmt: 'pct' }, regenPct: { name: '초당 체력 회복', fmt: 'pct2' }, def: { name: '방어', fmt: 'num' }, skill: { name: '스킬 피해', fmt: 'pct' },
  exp: { name: '경험치', fmt: 'pct' }, mat: { name: '재료 드랍', fmt: 'pct' }, gold: { name: '은자', fmt: 'pct' },
  dodge: { name: '회피', fmt: 'pct' }, move: { name: '이동 속도', fmt: 'pct' }, bossDmg: { name: '두목에게 피해', fmt: 'pct' }, drain: { name: '피해 흡수', fmt: 'pct' },
  dmgRed: { name: '받는 피해 감소', fmt: 'pct' }, cdr: { name: '스킬 숨', fmt: 'neg' }, range: { name: '스킬 범위', fmt: 'pct' },
  thorns: { name: '받은 피해 되돌림', fmt: 'pct' }, stunHit: { name: '때리면 기절', fmt: 'pct' },
};
export const gearKeyText = (k, v) => {
  const d = GEAR_KEYS[k];
  if (!d) return `${k} ${v}`;
  const t = d.fmt === 'pp' ? `+${(v * 100).toFixed(1).replace(/\.0$/, '')}%p` : d.fmt === 'neg' ? `-${Math.round(v * 100)}%`
    : d.fmt === 'num' ? `+${v.toFixed(1).replace(/\.0$/, '')}` : d.fmt === 'pct2' ? `+${(v * 100).toFixed(2)}%` : `+${(v * 100).toFixed(1).replace(/\.0$/, '')}%`;
  return `${d.name} ${t}`;
};
export const UNIQ_SLOTS = ['weapon', 'armor', 'hat', 'glove', 'shoe'];
// 지역 1~15 × [무기, 옷, 모자, 장갑, 신발]
const U = (k, v) => ({ k, v });
export const UNIQUE = [null,
  [U('speed', 0.06), U('move', 0.06), U('dodge', 0.03), U('crit', 0.03), U('move', 0.08)],            // 죽림 — 바람
  [U('critDmg', 0.12), U('regenPct', 0.002), U('gold', 0.1), U('atkPct', 0.04), U('def', 3)],          // 황사 서역
  [U('stunHit', 0.03), U('hpPct', 0.05), U('dmgRed', 0.03), U('critDmg', 0.1), U('move', 0.06)],      // 천산 설원
  [U('drain', 0.01), U('thorns', 0.1), U('hpPct', 0.04), U('drain', 0.008), U('regenPct', 0.002)],    // 혈사곡
  [U('skill', 0.06), U('dodge', 0.03), U('exp', 0.06), U('cdr', 0.03), U('dodge', 0.03)],             // 귀곡
  [U('cdr', 0.04), U('regenPct', 0.003), U('skill', 0.05), U('speed', 0.05), U('move', 0.07)],        // 무당 운해
  [U('atkPct', 0.06), U('dmgRed', 0.04), U('critDmg', 0.1), U('bossDmg', 0.06), U('thorns', 0.1)],    // 십만대산 마교
  [U('range', 0.08), U('hpPct', 0.06), U('mat', 0.08), U('speed', 0.05), U('move', 0.08)],            // 장강 수로
  [U('bossDmg', 0.08), U('dmgRed', 0.05), U('regenPct', 0.003), U('atkPct', 0.05), U('def', 6)],      // 소림 사원
  [U('crit', 0.04), U('gold', 0.12), U('gold', 0.12), U('crit', 0.04), U('dodge', 0.03)],             // 낙양 야시장
  [U('critDmg', 0.15), U('dodge', 0.04), U('crit', 0.03), U('skill', 0.06), U('move', 0.08)],         // 화산 절벽
  [U('drain', 0.012), U('hpPct', 0.06), U('cdr', 0.04), U('stunHit', 0.03), U('regenPct', 0.003)],   // 남만 독림
  [U('skill', 0.08), U('dmgRed', 0.05), U('exp', 0.08), U('critDmg', 0.12), U('thorns', 0.15)],      // 고묘 지하
  [U('range', 0.1), U('hpPct', 0.07), U('mat', 0.1), U('cdr', 0.04), U('move', 0.09)],               // 동해 해안
  [U('atkPct', 0.08), U('dodge', 0.05), U('skill', 0.07), U('bossDmg', 0.08), U('move', 0.1)],       // 천외천
];
// 사다리 장비 하나의 고유 옵션 { k, v } (없으면 null). zone: 지역 1~15, upper: 상급, rarMult: 등급 배수
export function uniqueOf(slot, zone, upper, rarMult = 1) {
  const i = UNIQ_SLOTS.indexOf(slot);
  const row = UNIQUE[zone];
  if (i < 0 || !row) return null;
  const u = row[i];
  return { k: u.k, v: u.v * (upper ? 1.3 : 1) * (1 + (zone - 1) * 0.05) * rarMult };
}

// ---------- 직업 세트 (레벨 100) ----------
// v132: 십이지왕 열둘을 둘로 —
//   전반 다섯(권왕·철왕·음왕·혈왕·목왕)이 **세트 부위**를 하나씩 맡는다(SLOT_KING). 그 왕은 내 직업 세트의 그 부위를 떨구고, 그 왕의 재료·증표로 만든다.
//   후반 일곱(화왕·암왕·환왕·살왕·투왕·도왕·검왕)은 **부위별 강화석**을 떨군다(STONES) — 그 부위만 강화한다. 검왕은 승급석.
// king: 세트의 결(이름·겉모습)을 준 왕 — 재료와는 상관없다.
// 2·3조각: 능력치, 5조각: 직업 무공을 바꾸는 효과. 키는 GEAR_KEYS(능력치)이거나 아래 SET_FX(무공) 이름.
export const SET_SLOTS = ['weapon', 'armor', 'hat', 'glove', 'shoe'];
export const SET_FX = {
  flowerUp: (v) => `꽃잎 검기 피해 +${Math.round(v * 100)}%`, flowerR: (v) => `꽃잎 검기 범위 +${Math.round(v * 100)}%`,
  flowerEvery: (v) => `꽃잎 검기가 평타 ${v}번째마다`, flowerBleed: (v) => `꽃잎에 맞은 적이 피해의 ${Math.round(v * 100)}%만큼 피 흘린다`,
  formlessProc: (v) => `1~3차 무공이 맞을 때 ${Math.round(v * 100)}% 확률로 숨은 기관검(×150%)이 한 번 더`,
  cd4: (v) => `4차 무공 숨 -${Math.round(v * 100)}%`,
  basicUp: (v) => `평타 피해 +${Math.round(v * 100)}%`, cleaveAlways: (v) => `평타가 늘 둘레 적을 함께 친다(${Math.round(v * 100)}%)`,
  tripleUp: (v) => `투신강림 동안 평타 한 번에 ${3 + v}대`,
  vulnUp: (v) => `섭혼 취약 +${Math.round(v * 100)}%p`, killHeal: (v) => `적을 쓰러뜨리면 체력 ${Math.round(v * 100)}% 회복`,
  echo0: () => '1차 무공이 늘 두 번 터진다', cloneUp: (v) => `환영분신 +${v}기`, cloneSec: (v) => `분신이 ${v}초 더 남는다`,
  poisonUp: (v) => `독 쌓임 +${Math.round(v * 100)}%`, fieldUp: (v) => `독무 장판 범위 +${Math.round(v * 100)}% · 3초 더`,
  spreadUp: () => '중독된 적이 쓰러질 때 번지는 독 두 배 · 번진 적 둔화', dotUp: (v) => `모든 독·출혈 피해 +${Math.round(v * 100)}%`,
  bossDot: () => '두목에게 쌓이는 독 두 배',
  fearUp: (v) => `공포 확률 +${Math.round(v * 100)}%p`, fearVuln: (v) => `공포에 걸린 적은 3초간 받는 피해 +${Math.round(v * 100)}%`,
  maskAlways: (v) => `공포가 걸릴 때마다 가면의 일격(×${v * 100}%)`, harmonyUp: (v) => `삼공조화 피해 +${Math.round(v * 100)}%p`,
  daggersUp: (v) => `소향비술 비수 +${v}자루`, killCdr: (v) => `적을 쓰러뜨릴 때마다 모든 무공 숨 ${v}초 감소`,
};
export const SETS = [
  { id: 'plum', job: 'sword', king: 21, name: '매화검진', short: '매화', col: '#f9a8d4',
    lore: '화왕의 천녀야우장에서 꽃잎을 얻은 검진. 평타마다 꽃이 핀다.',
    bonus: { 2: { speed: 0.15 }, 3: { flowerUp: 0.8, flowerR: 0.3 }, 5: { flowerEvery: 2, flowerBleed: 0.5 } } },
  // v131: 검왕(가장 센 왕)을 잡아야 하던 것을 철왕으로 — 직업마다 초반 왕 하나 + 중반 왕 하나 (id는 옛 세이브 때문에 그대로)
  { id: 'formless', job: 'sword', king: 17, name: '천기검갑', short: '천기', col: '#cbd5e1',
    lore: '철왕 기사후가 빚은 기관 검갑. 칼집 속에 숨은 기관검이 한 번 더 뻗는다.',
    bonus: { 2: { critDmg: 0.4 }, 3: { skill: 0.35 }, 5: { cd4: 0.4, formlessProc: 0.35 } } },
  { id: 'ironfist', job: 'fist', king: 16, name: '철권투혼', short: '철권', col: '#ef4444',
    lore: '권왕 강후의 유혼절명권을 새긴 권갑. 맞는 만큼 단단해지고 주먹이 둘레를 쓴다.',
    bonus: { 2: { dmgRed: 0.1 }, 3: { basicUp: 0.2 }, 5: { cleaveAlways: 0.7 } } },
  { id: 'wargod', job: 'fist', king: 25, name: '투신무쌍', short: '투신', col: '#fbbf24',
    lore: '투왕 천야의 권갑 투신. 이기는 것만이 값이다.',
    bonus: { 2: { hpPct: 0.1 }, 3: { speed: 0.1 }, 5: { tripleUp: 1 } } },
  { id: 'bloodsea', job: 'fan', king: 19, name: '혈해마공', short: '혈해', col: '#dc2626',
    lore: '혈왕의 혈해마공. 피를 마셔 혼을 거둔다.',
    bonus: { 2: { drain: 0.02, skill: 0.1 }, 3: { vulnUp: 0.15 }, 5: { killHeal: 0.03, echo0: 1 } } },
  { id: 'phantom', job: 'fan', king: 23, name: '환영미혼', short: '환영', col: '#c4b5fd',
    lore: '환왕의 환영술. 분신이 분신을 낳는다.',
    bonus: { 2: { skill: 0.2 }, 3: { skill: 0.2, dodge: 0.1 }, 5: { cloneUp: 2, cloneSec: 5 } } },
  { id: 'woodvenom', job: 'poison', king: 20, name: '만목독림', short: '천혼', col: '#4ade80',
    lore: '목왕의 목형천혼술로 기른 독목. 독무가 숲처럼 번진다.',
    bonus: { 2: { poisonUp: 0.5 }, 3: { fieldUp: 0.4 }, 5: { spreadUp: 1 } } },
  { id: 'darknight', job: 'poison', king: 22, name: '암천독야', short: '암야', col: '#7c3aed',
    lore: '암왕 흑사린의 밤. 어둠 속의 독은 두목도 녹인다.',
    bonus: { 2: { crit: 0.1, skill: 0.15 }, 3: { dotUp: 0.6 }, 5: { cd4: 0.4, bossDot: 1 } } },
  { id: 'ghostsound', job: 'ring', king: 18, name: '귀혼소음', short: '귀혼', col: '#a5b4fc',
    lore: '음왕 신류의 귀혼음. 웃음소리만 들어도 몸이 굳는다.',
    bonus: { 2: { fearUp: 0.1, critDmg: 0.3 }, 3: { fearVuln: 0.4 }, 5: { maskAlways: 2 } } },
  { id: 'netherkill', job: 'ring', king: 24, name: '명부살겁', short: '명부', col: '#991b1b',
    lore: '살왕의 명부살법. 하나를 죽일 때마다 다음 칼이 빨라진다.',
    bonus: { 2: { critDmg: 0.5, crit: 0.05 }, 3: { harmonyUp: 0.35 }, 5: { daggersUp: 8, killCdr: 1 } } },
];
export const setOf = (id) => SETS.find((x) => x.id === id) || null;
export const setsOfJob = (job) => SETS.filter((x) => x.job === job);
// 세트 부위를 맡은 전반 다섯 왕
export const SLOT_KING = { weapon: 16, armor: 17, hat: 18, glove: 19, shoe: 20 };
export const KING_SLOT = Object.fromEntries(Object.entries(SLOT_KING).map(([k, v]) => [v, k]));
// 후반 일곱 왕의 강화석 — 재료 열쇠 'st{지역}'. slot: 강화하는 부위('acc'는 장신구·가락지·귀걸이), 'promote'는 승급석
export const STONES = {
  21: { slot: 'shoe', name: '야우 화정석', what: '세트 신발 강화석' },
  22: { slot: 'glove', name: '암야 흑요석', what: '세트 장갑 강화석' },
  23: { slot: 'hat', name: '환영 몽석', what: '세트 모자 강화석' },
  24: { slot: 'armor', name: '명부 혼석', what: '세트 옷 강화석' },
  25: { slot: 'acc', name: '투신 철혼석', what: '왕의 장신구·가락지·귀걸이 강화석' },
  26: { slot: 'weapon', name: '일월 도혼석', what: '세트 무기 강화석' },
  27: { slot: 'promote', name: '무형 검혼석', what: '세트·왕의 장신구 승급석' },
};
export const stoneKey = (z) => `st${z}`;
export const isStoneKey = (k) => /^st2[1-7]$/.test(String(k));
// 이 장비를 강화하는 강화석 열쇠 (왕의 장비만)
export function stoneFor(it) {
  if (!it || it.king == null) return null;
  const sl = KACC_SLOTS.includes(it.slot) ? 'acc' : it.slot;
  const z = Object.keys(STONES).find((k) => STONES[k].slot === sl);
  return z ? stoneKey(z) : null;
}
// 강화 한 번에 드는 강화석 — +1에 3개 … 돌파(+11~)는 더
export const stoneN = (plus) => 3 + plus + (plus >= 10 ? (plus - 9) * 3 : 0);
// 승급: 검혼석 등급마다 5 · 은자
export const promoteStones = (rar) => 10 * (rar + 1) ** 2;   // v153: 5·10·15 → 10·40·90 (신화 승급이 쉬웠다)
export const STONE_PER_BOSS = 3;        // 후반 왕 한 번에 그 강화석
export const STONE_FROM_MATS = 40;      // 그 왕 재료 40 → 강화석 하나 (들판 재료도 쓸모 있게)
export const SET_PIECE = { armor: '포', hat: '관', glove: '수투', shoe: '운혜' };
// 세트 효과 한 줄
export function setBonusText(b) {
  return Object.entries(b).map(([k, v]) => (SET_FX[k] ? SET_FX[k](v) : gearKeyText(k, v))).join(' · ');
}

// ---------- 레벨 100 (왕의 장비) ----------
export const KING_ILV = 100;
export const KING_MULT = 6.5;          // 사다리 끝(천외천 상급, ×5.2)보다 조금 세다 — 그다음은 강화·돌파·승급·세트 효과
export const KING_LV = 99;             // 이 레벨부터 만든다
const SET_MATS = { weapon: 120, armor: 90, hat: 70, glove: 70, shoe: 70 };
const SET_MARKS = { weapon: 6, armor: 5, hat: 4, glove: 4, shoe: 4 };
export function setRecipe(setId, slot) {
  const lst = LORD_SETS.find((x) => x.id === setId);
  if (lst) return lordRecipe(lst, slot);
  const z = SLOT_KING[slot];
  return { mats: { [z]: SET_MATS[slot], [`b${z}`]: SET_MARKS[slot] }, gold: 6000 + (SET_MATS[slot] * 50) };
}
// 공용 장신구 — 아무 왕의 재료로 (그 왕의 신화 효과가 붙을 수 있다)
export const KACC_SLOTS = ['acc', 'finger', 'ear'];
export function kaccRecipe(z, slot) {
  return { mats: { [z]: slot === 'acc' ? 90 : 70, [`b${z}`]: slot === 'acc' ? 5 : 4 }, gold: 5000 };
}

// ---------- 스킬 변화 옵션 ----------
// 어느 장비에서나 나온다(전설 이상 더 잘). s: 스킬 칸(0 1차 · 1 2차 · 2 3차 · 4 4차 — 보조기는 빼고).
export const TRANSFORMS = {
  fire: { name: '화염', desc: '맞은 적이 불탄다(피해의 30% · 3초)', col: '251,146,60' },
  ice: { name: '빙결', desc: '20% 확률로 1초 얼린다', col: '186,230,253' },
  thunder: { name: '뇌전', desc: '맞을 때마다 둘레 적 하나에 번개(40%)', col: '253,224,71' },
  giant: { name: '거대화', desc: '범위 +50% · 연출도 커진다', col: '216,180,254' },
  focus: { name: '응축', desc: '범위 -35% · 피해 +40%', col: '248,113,113' },
};
export const TF_CHANCE = [0.08, 0.15, 0.25, 0.4];       // 등급별 (레어 … 신화)
export const TF_SLOTS = [0, 1, 2, 4];

// ---------- 맹주·천마 세트 (v153) ----------
// 모든 직업이 쓰는 세트 셋 — 고수의 두목 방에서 모은다. 천마 세트가 가장 세다.
//   패천신갑(무림맹주 진패천의 맹주금패 + 협의패) · 사도천패(사도맹주 백자강의 사도흑패 + 흑도령) · 천마신장(천마 검우진의 천마혈옥 + 세 세력 재료 모두)
// 맹주의 패는 맹주 두목이 6개씩, 그 세력의 다른 고수 두목도 30%로 하나 떨군다.
// 수치는 왕의 장비 × mult(1.25 · 1.25 · 1.45), 세트 효과는 능력치(직업 무공을 바꾸는 직업 세트와 달리).
export const LORD_MATS = {
  lm: { name: '맹주금패', col: '#fde047', fac: 'murim', master: 'jinpaecheon' },
  ls: { name: '사도흑패', col: '#ef4444', fac: 'sapa', master: 'baekjagang' },
  lc: { name: '천마혈옥', col: '#dc2626', fac: 'magyo', master: 'cheonma' },
};
export const isLordMat = (k) => Object.prototype.hasOwnProperty.call(LORD_MATS, k);
export const LORD_KEY = { murim: 'lm', sapa: 'ls', magyo: 'lc' };
export const LORD_SETS = [
  { id: 'paecheon', job: null, lord: 'lm', fac: ['murim'], name: '패천신갑', short: '패천', col: '#fde047', mult: 1.25,
    lore: '무림맹주 진패천이 맹의 금패를 녹여 두른 갑주. 역대 가장 패도적인 맹주의 것답게 단단하고 무겁다.',
    bonus: { 2: { hpPct: 0.2, dmgRed: 0.08 }, 3: { atkPct: 0.2, def: 30 }, 5: { bossDmg: 0.4, regenPct: 0.01, dmgRed: 0.1 } } },
  { id: 'sadocheon', job: null, lord: 'ls', fac: ['sapa'], name: '사도천패', short: '사도', col: '#ef4444', mult: 1.25,
    lore: '사도맹주 백자강의 흑패로 짠 갑주. 의심 많은 자의 칼처럼 빈틈이 없고, 한 번 물면 놓지 않는다.',
    bonus: { 2: { crit: 0.1, critDmg: 0.3 }, 3: { speed: 0.15, atkPct: 0.15 }, 5: { bossDmg: 0.4, critDmg: 0.5, drain: 0.02 } } },
  { id: 'cheonmaset', job: null, lord: 'lc', fac: ['murim', 'sapa', 'magyo'], name: '천마신장', short: '천마', col: '#dc2626', mult: 1.45,
    lore: '천마 검우진의 피를 머금은 혈옥과 세 세력의 재료로 빚었다. 구화마공 십이성의 기운이 흐른다 — 무림에서 가장 센 세트.',
    bonus: { 2: { atkPct: 0.25, hpPct: 0.15 }, 3: { skill: 0.35, crit: 0.1 }, 5: { atkPct: 0.3, bossDmg: 0.5, drain: 0.03, dmgRed: 0.12, cdr: 0.15 } } },
];
SETS.push(...LORD_SETS);
const LORD_W = { weapon: 1.3, armor: 1.1, hat: 0.9, glove: 0.9, shoe: 0.9 };
export function lordRecipe(st, slot) {
  const w = LORD_W[slot] || 1;
  const mats = { [st.lord]: Math.round(25 * w) };
  const per = st.fac.length === 3 ? 260 : 420;
  for (const f of st.fac) mats[FAC_MATS[f]] = Math.round(per * w);
  return { mats, gold: Math.round((st.fac.length === 3 ? 90000 : 60000) * w) };
}
