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
  iron: { name: '철갑', col: '#cbd5e1', fx: [['thorns', 0.04], ['dmgRed', 0.005]] },
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
export const SKILL_CAP = { range: 0.9, dmg: 2, cd: 0.6, echo: 0.8 };
export const SKILL_NAME = ['1차', '2차', '3차'];
const SKILL_TXT = { range: '범위', dmg: '피해', cd: '숨', echo: '한 번 더' };

// 두목 이름·생김새로 테마를 고른다 — 앞에 있을수록 먼저
const BY_NAME = [
  [/독|당가|오독|만독/, 'poison'], [/빙|설|한빙|북해/, 'ice'], [/염|화운|화염|불/, 'fire'], [/혈/, 'blood'],
  [/뇌|번개|벽력|광섬|섬/, 'thunder'], [/천마|마존|마교|마불|섭혼|극악|사도|흑/, 'dark'], [/귀|강시|고묘|명부|살왕|음왕/, 'ghost'],
  [/교룡|동해|장강|수로|해/, 'water'], [/철왕|기관|철/, 'iron'], [/소림|달마|혜공|금강|마불|불/, 'holy'],
  [/매화|도화|화왕|일화|꽃|야우/, 'petal'], [/권|투|불패|대취|거력/, 'fist'], [/도|참마|패도/, 'saber'],
];
const BY_WEAPON = { sword: 'sword', saber: 'saber', fist: 'fist', fan: 'petal', claw: 'ghost', dagger: 'poison', axe: 'iron', spear: 'water' };
export function themeOfZone(z) {
  const zn = ZONES_W[z];
  if (!zn) return 'sword';
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
  echo: (p) => `${Math.round(6 * p)}% 확률로 같은 적을 한 번 더 (×1.5)`,
  execute: (p) => `체력 30% 아래 적에게 피해 +${Math.round(25 * p)}%`,
  bane: (p) => `두목에게 주는 피해 +${Math.round(12 * p)}%`,
  chain: (p) => `치명타가 둘레 적 둘에게 번진다 (×${(0.6 * p).toFixed(1)})`,
  nova: (p) => `${Math.max(4, 10 - Math.round(2 * p))}초마다 둘레를 터뜨린다 (공격력 ×${(2 * p).toFixed(1)})`,
  rain: (p) => `${Math.max(5, 11 - Math.round(2 * p))}초마다 둘레 적 다섯에게 쏟아진다 (×${(1.2 * p).toFixed(1)})`,
  guard: (p) => `12초마다 최대 체력 ${Math.round(6 * p)}% 보호막`,
  reap: (p) => `적을 쓰러뜨리면 체력 ${(2 * p).toFixed(1)}% 회복`,
  frenzy: (p) => `맞을 때 ${Math.round(8 * p)}% 확률로 4초간 공격 속도 +30%`,
  mirror: (p) => `받은 피해의 ${Math.round(15 * p)}%를 되돌린다`,
};
// 십이지왕(번호) · 고수(id) → [kind, 이름]
const KING_SP = {
  1: ['echo', '무형신검'], 2: ['execute', '일월암혈도'], 3: ['bane', '권갑 투신'], 4: ['chain', '명부살법'],
  5: ['mirror', '환영술'], 6: ['rain', '암천야신공'], 7: ['nova', '천녀야우장'], 8: ['reap', '목형천혼술'],
  9: ['frenzy', '혈해마공'], 10: ['nova', '귀혼음'], 11: ['guard', '기관 갑주'], 12: ['frenzy', '유혼절명권'],
};
const MASTER_SP = {
  guryeong: ['execute', '참마도법'], jingwang: ['echo', '태을신검'], imsanggon: ['guard', '대정무적'], jinpaecheon: ['rain', '패천신검'],
  yayulhan: ['chain', '한빙마장'], bisain: ['reap', '혈로개천'], baekmanggi: ['echo', '검황무적'], baekjagang: ['bane', '사도천패'],
  seophon: ['mirror', '섭혼대법'], mabul: ['guard', '황금불광'], dokwang: ['rain', '만독귀종'], geugak: ['execute', '혈앙지'],
  ilhwa: ['nova', '일화천섬'], bulpae: ['bane', '붕산철권'], hyeolcheon: ['chain', '혈천마도'], daechwi: ['frenzy', '혈루취권'],
  cheonma: ['nova', '천마군림'],
};
export function specialOfZone(z) {
  const zn = ZONES_W[z];
  if (!zn || markLv(`b${z}`) < 100) return null;
  let sp = null;
  if (zn.king) sp = KING_SP[zn.king.no];
  else if (zn.master) sp = MASTER_SP[zn.master];
  return sp ? { id: `${zn.king ? `k${zn.king.no}` : zn.master}`, kind: sp[0], name: sp[1], boss: zn.boss?.name || '' } : null;
}

// ---------- 각인 하나 ----------
// key 증표 · step 몇째 칸(0~2) → { key, boss, theme, fx: {능력치: 값}, skill: { s, k, v }, special, w }
export function imprintOf(key, step = 0) {
  if (!isMarkKey(key)) return null;
  const z = +String(key).slice(1);
  const zn = ZONES_W[z];
  if (!zn) return null;
  const t = themeOfZone(z);
  const w = STEPK[Math.max(0, Math.min(2, step))];
  const k = w * lvScale(markLv(key));
  const fx = {};
  for (const [kk, v] of THEMES[t].fx) fx[kk] = v * k;
  const sk = SKILL_KIND[t];
  return { key, boss: zn.boss?.name || '', theme: t, fx, skill: { s: z % 3, k: sk, v: SKILL_BASE[sk] * k }, special: specialOfZone(z), w };
}
// 장비의 각인들 (새겨진 차례대로)
export const imprintsOf = (it) => (Array.isArray(it?.imps) ? it.imps.map((k, i) => imprintOf(k, i)).filter(Boolean) : []);

// 글로 — '독 묻힘 7.4%' 꼴
const PCT = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, '')}%`;
export const FX_TEXT = {
  venom: (v) => `적중 피해의 ${PCT(v)} 독`, burn: (v) => `적중 피해의 ${PCT(v)} 화상`, chill: (v) => `${PCT(v)} 확률로 둔화`,
  shock: (v) => `${PCT(v)} 확률로 옆 적에게 뇌전`, atkPct: (v) => `공격력 +${PCT(v)}`, critDmg: (v) => `치명 피해 +${PCT(v)}`,
  hpPct: (v) => `체력 +${PCT(v)}`, drain: (v) => `흡혈 ${PCT(v, 2)}`, speed: (v) => `공격 속도 +${PCT(v)}`, bossDmg: (v) => `두목 피해 +${PCT(v)}`,
  crit: (v) => `치명 +${PCT(v)}p`, stunHit: (v) => `${PCT(v)} 확률로 기절`, dmgRed: (v) => `받는 피해 -${PCT(v)}`,
  cdr: (v) => `숨 -${PCT(v)}`, dodge: (v) => `회피 +${PCT(v)}`, move: (v) => `이동 속도 +${PCT(v)}`, thorns: (v) => `받은 피해 ${PCT(v)} 되돌림`,
};
export const skillModText = (m) => (m.k === 'echo' ? `${SKILL_NAME[m.s]} 스킬 ${PCT(m.v)} 확률로 한 번 더` : `${SKILL_NAME[m.s]} 스킬 ${SKILL_TXT[m.k]} ${m.k === 'cd' ? '-' : '+'}${PCT(m.v)}`);
export function imprintText(im) {
  if (!im) return '';
  return [...Object.entries(im.fx).map(([k, v]) => (FX_TEXT[k] ? FX_TEXT[k](v) : `${k} ${v}`)), skillModText(im.skill)].join(' · ');
}
export const specialText = (sp, p = 1) => (sp ? `【${sp.name}】 ${SPECIAL_KIND[sp.kind](p)}` : '');
export const MASTER_IDS = MASTERS.map((m) => m.id);
