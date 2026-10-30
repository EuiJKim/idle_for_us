// 증표 각인 효과 (v163) — 등급을 올릴 때 넣은 두목 증표가 그 두목의 성질을 장비에 남긴다.
//
//   테마   두목마다 성질 하나(독수마군=독, 빙백궁주=빙결, 혈교 장로=혈…). 효과 종류는 테마, 크기는
//          (그 두목 레벨) × (장비 등급)에 비례한다 — 같은 테마라도 센 두목 증표일수록 크다.
//   고유   레벨 100 넘는 특별 두목(십이지왕 · 100 넘는 고수 · 맹주 · 천마)은 테마에 더해 제 독문무공의
//          고유 효과가 붙는다. 유니크 < 전설 < 신화로 갈수록 발동률·위력이 커진다.
//
// **장비 하나에 각인 세 칸** — 레어→유니크→전설→신화로 오를 때마다 넣은 증표의 두목이 한 칸씩 새겨진다
// (it.imps = ['b<지역>', …]). 같은 두목을 셋 다 넣으면 그 성질이 세 겹으로 쌓인다.
// 칸마다 무게 STEPK(유니크 칸 1 · 전설 칸 1.3 · 신화 칸 1.6).
import { ZONES_W, isMarkKey, markLv } from './wdata.js';
import { MASTERS } from './wmasters_data.js';

// ---------- 테마 ----------
// fx: [능력치 키, 기본값] — 값 = 기본 × RSTEP[등급] × lvScale(두목 레벨)
// venom·burn: 적중 피해의 몇 할을 독·불로 · chill: 적중 시 둔화 확률 · shock: 적중 시 옆 적에게 뇌전 확률
export const THEMES = {
  poison: { name: '독', col: '#84cc16', fx: [['venom', 0.03], ['atkPct', 0.01]] },
  fire: { name: '화염', col: '#f97316', fx: [['burn', 0.035], ['critDmg', 0.02]] },
  ice: { name: '빙결', col: '#7dd3fc', fx: [['chill', 0.03], ['hpPct', 0.012]] },
  blood: { name: '혈', col: '#dc2626', fx: [['drain', 0.003], ['atkPct', 0.012]] },
  thunder: { name: '뇌전', col: '#fde047', fx: [['shock', 0.03], ['speed', 0.01]] },
  dark: { name: '마기', col: '#a855f7', fx: [['bossDmg', 0.025], ['critDmg', 0.025]] },
  sword: { name: '검기', col: '#93c5fd', fx: [['crit', 0.008], ['critDmg', 0.025]] },
  saber: { name: '도기', col: '#fca5a5', fx: [['atkPct', 0.015], ['crit', 0.005]] },
  fist: { name: '권경', col: '#fbbf24', fx: [['stunHit', 0.01], ['hpPct', 0.01]] },
  holy: { name: '금강', col: '#fde68a', fx: [['dmgRed', 0.008], ['hpPct', 0.015]] },
  petal: { name: '화풍', col: '#f9a8d4', fx: [['cdr', 0.01], ['dodge', 0.008]] },
  ghost: { name: '귀기', col: '#5eead4', fx: [['dodge', 0.01], ['drain', 0.0015]] },
  water: { name: '수류', col: '#22d3ee', fx: [['move', 0.015], ['hpPct', 0.012]] },
  iron: { name: '철갑', col: '#cbd5e1', fx: [['dmgRed', 0.01], ['hpPct', 0.012]] },
};
export const STEPK = [1, 1.3, 1.6];                          // 첫째(유니크) · 둘째(전설) · 셋째(신화) 칸
export const lvScale = (lv) => 0.4 + lv / 100;               // 레벨 9 ×0.49 · 99 ×1.39 · 175 ×2.15
// 더해도 넘지 않는 끝 (여섯 칸을 한 테마로 맞춰도 게임이 깨지지 않게)
export const IMP_CAP = { venom: 0.6, burn: 0.6, chill: 0.3, shock: 0.3 };
// 스킬 변화 — 테마마다 어떤 변화인지, 두목(지역 번호)마다 몇 차 스킬인지. 같은 스킬에 겹치면 더해진다(그림도 커지고 두 번 펼친다).
//   range 범위 +(그림이 커진다) · echo 한 번 더 펼칠 확률(그림도 두 번) · cd 숨 - · dmg 피해 +
export const SKILL_KIND = { poison: 'range', fire: 'dmg', ice: 'range', blood: 'dmg', thunder: 'echo', dark: 'dmg', sword: 'echo', saber: 'dmg',
  fist: 'range', holy: 'cd', petal: 'cd', ghost: 'echo', water: 'cd', iron: 'range' };
export const SKILL_BASE = { range: 0.08, dmg: 0.08, cd: 0.04, echo: 0.06 };
// v167: 스킬 변화는 새길 때 굴린다 — 몇 차 스킬(1·2·3차) · 어떤 변화(넷) · 효과 등급(레어~신화)이 모두 랜덤.
// 크기 = 기본 × 효과 등급 배수 × (0.4 + 두목 레벨/100). 낮은 두목도 높은 등급이 뜨면 바로 위 두목의 낮은 등급보다 크다
// (독수마군 레전드 2차 범위 > 혈사도왕 레어 2차 범위 > 독수마군 레어 2차 범위).
export const SK_KINDS = ['range', 'dmg', 'cd', 'echo'];
export const SK_GRADE = [{ name: '레어', col: '#60a5fa', w: 55, mult: 1 }, { name: '유니크', col: '#c084fc', w: 28, mult: 1.35 },
  { name: '레전드', col: '#fb923c', w: 13, mult: 1.8 }, { name: '신화', col: '#f43f5e', w: 4, mult: 2.5 }];
export function rollSkillChange(rng) {
  const s = Math.floor(rng() * 3);
  const k = SK_KINDS[Math.floor(rng() * SK_KINDS.length)];
  let r = rng() * SK_GRADE.reduce((a, g) => a + g.w, 0), g = 0;
  for (; g < SK_GRADE.length - 1; g++) { r -= SK_GRADE[g].w; if (r <= 0) break; }
  return { s, sk: k, g };
}
export const skillValue = (k, g, lv) => SKILL_BASE[k] * SK_GRADE[g].mult * lvScale(lv);
export const SKILL_CAP = { range: 0.9, dmg: 2, cd: 0.6, echo: 0.8 };
export const SKILL_NAME = ['1차', '2차', '3차'];
const SKILL_TXT = { range: '범위', dmg: '피해', cd: '숨', echo: '한 번 더' };

// 두목 이름·생김새로 테마를 고른다 — 앞에 있을수록 먼저
const BY_NAME = [
  [/독|당가|오독|만독/, 'poison'], [/빙|설|한빙|북해/, 'ice'], [/염|화운|화염/, 'fire'], [/혈/, 'blood'],
  [/뇌|번개|벽력|광섬|섬/, 'thunder'], [/천마|마존|마교|마불|섭혼|극악|사도|흑/, 'dark'], [/귀|강시|고묘|명부|살왕|음왕/, 'ghost'],
  [/교룡|동해|장강|수로|십팔채/, 'water'], [/철왕|기관|철/, 'iron'], [/소림|달마|혜공|금강|마불|불/, 'holy'],
  [/매화|도화|화왕|일화|꽃|야우/, 'petal'], [/권|투|불패|대취|거력/, 'fist'], [/도|참마|패도/, 'saber'],
];
const BY_WEAPON = { sword: 'sword', saber: 'saber', fist: 'fist', fan: 'petal', claw: 'ghost', dagger: 'poison', axe: 'iron', spear: 'water' };
// 이름 글자로는 틀리는 두목 — 직접 정한다 ('금강불괴'의 '불'이 화염, '제독'의 '독'이 독으로 읽혔다)
const THEME_BY_BOSS = {
  '금강불괴 혜공대사': 'holy', '마불 저라반': 'holy', '불패권마 단우강': 'fist', '동창 제독': 'dark', '태극검선': 'sword',
  '사도맹 이인자 야율한': 'ice', '음왕 신류': 'ghost', '목왕 백천경': 'holy', '거력귀창 거력귀창': 'saber',
};
export function themeOfZone(z) {
  const zn = ZONES_W[z];
  if (!zn) return 'sword';
  if (THEME_BY_BOSS[zn.boss?.name]) return THEME_BY_BOSS[zn.boss.name];
  const name = `${zn.boss?.name || ''} ${zn.name || ''}`;
  for (const [re, t] of BY_NAME) if (re.test(name)) return t;
  return BY_WEAPON[zn.boss?.look?.weapon] || 'sword';
}

// ---------- 고유 효과 (레벨 100 넘는 두목) ----------
// kind는 엔진(wgame)이 아는 꼴 — echo 한 번 더 · execute 약한 적 · bane 두목 · chain 치명 번개 · nova 둘레 폭발(쿨)
//   rain 쏟아짐(쿨) · guard 보호막(쿨) · reap 처치 회복 · frenzy 맞으면 쾌속 · mirror 되돌림
// 위력 = SP[등급] (같은 효과를 여럿 끼면 가장 높은 것 + 하나마다 0.3)
// 위력 p = 그 고유 효과가 새겨진 칸들의 STEPK 합 (한 칸 1 → 세 칸 3.9) — 끼고 있는 장비 모두 더한다
export const SPECIAL_KIND = {
  echo: (p) => `${Math.round(Math.min(60, 10 * p))}% 확률로 같은 적을 한 번 더 (×2)`,
  execute: (p) => `체력 30% 아래 적에게 피해 +${Math.round(Math.min(150, 25 * p))}%`,
  bane: (p) => `두목에게 주는 피해 +${Math.round(Math.min(80, 12 * p))}%`,
  chain: (p) => `치명타가 둘레 적 둘에게 번진다 (×${Math.min(1, 0.25 * p).toFixed(2)})`,
  nova: (p) => `${Math.max(4, 10 - Math.round(2 * p))}초마다 둘레를 터뜨린다 (공격력 ×${(2 * p).toFixed(1)})`,
  rain: (p) => `${Math.max(5, 11 - Math.round(2 * p))}초마다 둘레 적 다섯에게 쏟아진다 (×${(1.2 * p).toFixed(1)})`,
  guard: (p) => `8초마다 최대 체력 ${Math.round(Math.min(40, 10 * p))}% 보호막`,
  reap: (p) => `적을 쓰러뜨리면 체력 ${Math.min(15, 3 * p).toFixed(1)}% 회복`,
  frenzy: (p) => `맞을 때 ${Math.round(Math.min(60, 12 * p))}% 확률로 4초간 공격 속도 +40% · 피해 +15%`,
  // 되돌림을 받은 피해로 셈하면 쓸모가 없다 — 몹 한 대가 제 체력의 1/200쯤이라. 무인 공격력으로 반격한다 (v167)
  mirror: (p) => `맞을 때마다 그 적에게 반격 (공격력 ×${Math.min(5, 1.5 * p).toFixed(1)})`,
  bleed: (p) => `적중 피해의 ${Math.round(Math.min(80, 12 * p))}%가 4초에 걸쳐 피로 흐른다`,
  berserk: (p) => `체력이 절반 아래면 피해 +${Math.round(Math.min(100, 20 * p))}%`,
  phoenix: (p) => `쓰러질 피해를 받으면 체력 ${Math.round(Math.min(80, 30 * p))}%로 일어나 2초간 무적 (40초에 한 번)`,
  stunwave: (p) => `${Math.max(4, Math.round(8 - 1.5 * p))}초마다 둘레 적을 2초 멈추고 친다 (×${(1.5 * p).toFixed(1)})`,
  vigor: (p) => `싸우는 동안 매초 최대 체력 ${Math.min(5, 1.2 * p).toFixed(1)}% 회복`,
  surge: (p) => `스킬을 쓰면 3초간 피해 +${Math.round(Math.min(60, 15 * p))}%`,
};
// 레벨 100 넘는 두목마다 고유 효과 셋 — 새길 때 하나를 고른다 · 나중에 바꿀 수 있다 [kind, 이름]
const KING_SP = {
  12: [['frenzy', '유혼절명권'], ['chain', '유혼추명'], ['berserk', '살기 폭주']],
  11: [['guard', '기관 갑주'], ['rain', '천기 기관포'], ['stunwave', '철인 돌격']],
  10: [['nova', '귀혼음'], ['echo', '음살 일선'], ['reap', '혼백 흡음']],
  9: [['bleed', '혈해만장'], ['rain', '혈우'], ['phoenix', '혈신 불사']],
  8: [['vigor', '목형천혼술'], ['chain', '천목삼지'], ['phoenix', '천혼 재생']],
  7: [['nova', '천녀야우장'], ['execute', '가인일침'], ['rain', '야우 꽃비']],
  6: [['rain', '암천야신공'], ['execute', '흑야십자'], ['berserk', '야신 광폭']],
  5: [['echo', '환영분신'], ['mirror', '혈교 환술'], ['frenzy', '환영 보법']],
  4: [['chain', '명부살법'], ['execute', '명부일섬'], ['reap', '사신의 낫']],
  3: [['bane', '권갑 투신'], ['stunwave', '투신돌격'], ['guard', '호신갑']],
  2: [['execute', '일월암혈도'], ['echo', '일월쌍참'], ['bleed', '암혈']],
  1: [['echo', '무형신검'], ['nova', '무형검기'], ['surge', '검의 극의']],
};
const MASTER_SP = {
  seophon: [['mirror', '섭혼대법'], ['stunwave', '귀술진'], ['reap', '혼백 흡수']],
  guryeong: [['execute', '참마도법'], ['chain', '삼재참'], ['bane', '마를 끊는 칼']],
  yayulhan: [['nova', '한빙마장'], ['stunwave', '빙혼지'], ['guard', '한빙호체']],
  mabul: [['guard', '황금불광'], ['rain', '광승난무'], ['phoenix', '금강불괴']],
  dokwang: [['rain', '만독귀종'], ['bleed', '독아삼침'], ['vigor', '독인지체']],
  jingwang: [['echo', '태을신검'], ['nova', '태을검기'], ['chain', '검기 연환']],
  bisain: [['reap', '혈로개천'], ['echo', '사도십삼랑'], ['berserk', '혈기 광폭']],
  geugak: [['execute', '혈앙지'], ['nova', '마극광폭장'], ['surge', '소향비술']],
  ilhwa: [['rain', '일화천섬'], ['chain', '낙화유수'], ['execute', '꽃의 일섬']],
  imsanggon: [['guard', '대정무적도'], ['echo', '정협쌍도'], ['vigor', '협의지심']],
  baekmanggi: [['echo', '검황무적'], ['chain', '검황쌍류'], ['surge', '팔십 년 검기']],
  bulpae: [['bane', '붕산철권'], ['berserk', '투신강림'], ['stunwave', '투신난무']],
  hyeolcheon: [['bleed', '혈천마도'], ['execute', '멸천마도식'], ['rain', '도귀난참']],
  daechwi: [['frenzy', '혈루취권'], ['mirror', '취팔선보'], ['berserk', '대취광란']],
  jinpaecheon: [['nova', '패천신검'], ['bane', '패천일격'], ['echo', '천하일검']],
  baekjagang: [['bane', '사도천패'], ['rain', '흑우'], ['mirror', '맹주의 의심']],
  cheonma: [['nova', '천마군림'], ['phoenix', '구화마공'], ['surge', '천마멸세']],
  hwamugi: [['nova', '무극'], ['surge', '천하일통'], ['echo', '일점']],      // v238
  magwi: [['berserk', '자책'], ['frenzy', '도박'], ['mirror', '환각']],
};
// 그 두목의 고유 효과 셋 (없으면 null)
export function specialsOfZone(z) {
  const zn = ZONES_W[z];
  if (!zn || markLv(`b${z}`) < 100) return null;
  const list = zn.king ? KING_SP[zn.king.no] : zn.master ? MASTER_SP[zn.master] : null;
  if (!list) return null;
  const id = zn.king ? `k${zn.king.no}` : zn.master;
  return list.map(([kind, name], i) => ({ id: `${id}.${i}`, kind, name, boss: zn.boss?.name || '' }));
}
export const specialOfZone = (z, i = 0) => specialsOfZone(z)?.[i] || null;
export const ALL_SPECIALS = () => Object.keys(ZONES_W).flatMap((z) => specialsOfZone(+z) || []);

// ---------- 각인 하나 ----------
// 장비에 든 칸: { k: 증표, s: 몇 차 스킬, sk: 변화, g: 효과 등급, sp: 고른 고유(0~2) } — 옛 판(v163)은 증표 글자만 들어 있다
export function normEntry(e) {
  if (!e) return null;
  if (typeof e === 'string') {
    const z = +e.slice(1);
    return { k: e, s: z % 3, sk: SKILL_KIND[themeOfZone(z)] || 'dmg', g: 0, sp: 0 };
  }
  return e.k ? e : null;
}
// step 몇째 칸(0~2) → { key, boss, theme, fx, skill: { s, k, g, v }, special, specials, w }
export function imprintOf(entry, step = 0) {
  const e = normEntry(entry);
  if (!e || !isMarkKey(e.k)) return null;
  const z = +String(e.k).slice(1);
  const zn = ZONES_W[z];
  if (!zn) return null;
  const t = themeOfZone(z);
  const w = STEPK[Math.max(0, Math.min(2, step))];
  const lv = markLv(e.k);
  const k = w * lvScale(lv);
  const fx = {};
  for (const [kk, v] of THEMES[t].fx) fx[kk] = v * k;
  const sps = specialsOfZone(z);
  const g = Math.max(0, Math.min(SK_GRADE.length - 1, e.g | 0));
  return { key: e.k, boss: zn.boss?.name || '', theme: t, fx, skill: { s: e.s | 0, k: e.sk, g, v: skillValue(e.sk, g, lv) },
    special: sps ? sps[Math.max(0, Math.min(2, e.sp | 0))] : null, specials: sps, w, lv };
}
export const imprintsOf = (it) => (Array.isArray(it?.imps) ? it.imps.map((e, i) => imprintOf(e, i)).filter(Boolean) : []);

// 글로 — '독 묻힘 7.4%' 꼴
const PCT = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, '')}%`;
export const FX_TEXT = {
  venom: (v) => `적중 피해의 ${PCT(v)} 독`, burn: (v) => `적중 피해의 ${PCT(v)} 화상`, chill: (v) => `${PCT(v)} 확률로 둔화`,
  shock: (v) => `${PCT(v)} 확률로 옆 적에게 뇌전`, atkPct: (v) => `공격력 +${PCT(v)}`, critDmg: (v) => `치명 피해 +${PCT(v)}`,
  hpPct: (v) => `체력 +${PCT(v)}`, drain: (v) => `흡혈 ${PCT(v, 2)}`, speed: (v) => `공격 속도 +${PCT(v)}`, bossDmg: (v) => `두목 피해 +${PCT(v)}`,
  crit: (v) => `치명 +${PCT(v)}p`, stunHit: (v) => `${PCT(v)} 확률로 기절`, dmgRed: (v) => `받는 피해 -${PCT(v)}`,
  cdr: (v) => `숨 -${PCT(v)}`, dodge: (v) => `회피 +${PCT(v)}`, move: (v) => `이동 속도 +${PCT(v)}`, thorns: (v) => `받은 피해 ${PCT(v)} 되돌림`,
};
export const skillModText = (m) => `[${SK_GRADE[m.g || 0].name}] ` + (m.k === 'echo' ? `${SKILL_NAME[m.s]} 스킬 ${PCT(m.v)} 확률로 한 번 더` : `${SKILL_NAME[m.s]} 스킬 ${SKILL_TXT[m.k]} ${m.k === 'cd' ? '-' : '+'}${PCT(m.v)}`);
export function imprintText(im) {
  if (!im) return '';
  return [...Object.entries(im.fx).map(([k, v]) => (FX_TEXT[k] ? FX_TEXT[k](v) : `${k} ${v}`)), skillModText(im.skill)].join(' · ');
}
export const specialText = (sp, p = 1) => (sp ? `【${sp.name}】 ${SPECIAL_KIND[sp.kind](p)}` : '');
export const MASTER_IDS = MASTERS.map((m) => m.id);
