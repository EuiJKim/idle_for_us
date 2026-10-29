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
// king: 그 세트 재료·증표를 떨구는 십이지왕 지역 번호(16 권왕 … 27 검왕).
// 직업마다 초반 왕(16 권왕 ~ 20 목왕) 하나 + 중반 왕(21 화왕 ~ 25 투왕) 하나. 가장 센 도왕·검왕은 세트 없이 공용 장신구만(가장 좋은 신화 효과).
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
export const setOfKing = (z, job) => SETS.find((x) => x.king === z && (!job || x.job === job)) || null;
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
  const st = setOf(setId);
  return { mats: { [st.king]: SET_MATS[slot], [`b${st.king}`]: SET_MARKS[slot] }, gold: 6000 + (SET_MATS[slot] * 50) };
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
