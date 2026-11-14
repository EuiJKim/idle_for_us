// 새 시즌 무공 세트(S9) — 직업마다 공격 6 · 상시 3 · 버프 2. 전직 단계(0~5차)마다 열린다.
// 공격 무공: 모양(arc 앞 부채꼴 · circle 주변 · line 앞 일직선 · rain 앞쪽 하늘에서) · 사거리 배율 · 최대 대상 · 연타 수 · 한 대 계수(퍼밀) · 쿨(ms)
// 버프: 지속(ms) · 쿨 · 그동안 더하는 스탯 / 상시: 배운 레벨만큼 스탯
// 계수는 「차수가 오를수록 한 대상에게 초당 넣는 무공 몫」이 일정하게 늘도록 맞춘다(표준 무공 세트 = 몹 체력 기준 — battle/ref.js).
export const SLOT_N = 6;
export const KIT_LV_MAX = 30;
export const kitCap = (heroLv) => Math.min(KIT_LV_MAX, 1 + Math.floor(heroLv / 5));
export const kitCost = (lv, tier) => [{ k: 'gold', n: Math.round(150 * Math.pow(lv, 1.7) * (1 + tier * 0.6)) }];
export const kitCoef = (sk, lv) => Math.round(sk.coef * (1 + 0.04 * (Math.max(1, lv) - 1)));

// 직업 공통 틀(차수 · 종류 · 모양 · 수치) — 이름 · 빛깔만 직업마다 다르다
const FRAME = [
  { tier: 0, kind: 'active', shape: 'line', range: 1.2, maxT: 1, hits: 1, coef: 2200, cdMs: 4000 },
  { tier: 1, kind: 'active', shape: 'arc', range: 1.3, maxT: 4, hits: 2, coef: 1100, cdMs: 6000 },
  { tier: 1, kind: 'passive', stats: (lv) => ({ atkP: 12 * lv }) },
  { tier: 2, kind: 'active', shape: 'circle', range: 1.4, maxT: 6, hits: 3, coef: 900, cdMs: 9000 },
  { tier: 2, kind: 'buff', durMs: 20000, cdMs: 60000, stats: (lv) => ({ crit: 100 + 5 * lv, critDmg: 200 + 10 * lv }) },
  { tier: 3, kind: 'active', shape: 'rain', range: 2.0, maxT: 8, hits: 4, coef: 1000, cdMs: 12000 },
  { tier: 3, kind: 'passive', stats: (lv) => ({ critDmg: 15 * lv, skillP: 8 * lv }) },
  { tier: 4, kind: 'active', shape: 'line', range: 2.6, maxT: 10, hits: 5, coef: 1100, cdMs: 16000 },
  { tier: 4, kind: 'buff', durMs: 25000, cdMs: 90000, stats: (lv) => ({ final5: 150 + 8 * lv }) },
  { tier: 5, kind: 'active', shape: 'circle', range: 2.4, maxT: 15, hits: 8, coef: 1400, cdMs: 30000 },
  { tier: 5, kind: 'passive', stats: (lv) => ({ bossDmg: 20 * lv, final1: 4 * lv }) },
];
const NAMES = {
  sword: { col: '#ffe9a8', n: ['일섬', '낙엽검', '검기심법', '회선참', '검심통명', '만검귀종', '태극검결', '천지일검', '검혼각성', '일검파천', '검선지경'] },
  spear: { col: '#ffb27a', n: ['돌창', '횡소천군', '창술심법', '선풍창', '패왕기', '유성낙창', '창룡결', '관일창', '투신각성', '천붕창', '창신지경'] },
  fist: { col: '#ffd56a', n: ['붕권', '연환각', '외공심법', '금강진천', '철포삼', '백보신권', '금강결', '항룡십팔장', '불괴각성', '천마멸권', '권왕지경'] },
  bow: { col: '#b6f0ff', n: ['관일시', '연주전', '궁술심법', '산화시', '응안', '만궁낙우', '신궁결', '파천시', '귀궁각성', '유성우', '궁신지경'] },
  mage: { col: '#d4b8ff', n: ['장풍', '빙백장', '내공심법', '뇌전진', '호신강기', '오뢰정법', '현문결', '태을신뢰', '선천각성', '천뢰강림', '도선지경'] },
};
export const KIT = Object.fromEntries(Object.entries(NAMES).map(([job, d]) => [job, FRAME.map((f, i) => ({ ...f, id: `${job}_${i}`, name: d.n[i], col: d.col }))]));
export const skillById = (id) => { const j = id.split('_')[0]; return KIT[j]?.find((s) => s.id === id) || null; };
// 그 차수 · 레벨이면 열린 무공
export const kitOpen = (job, adv) => (KIT[job] || KIT.sword).filter((s) => s.tier <= adv);
// 표준 무공 세트(기준 무인): 열린 공격 무공 · 버프 전부(6칸 안) · 레벨 = 상한
export function stdKit(L, job, adv) {
  const lv = kitCap(L);
  const acts = kitOpen(job, adv).filter((s) => s.kind !== 'passive').sort((a, b) => b.tier - a.tier).slice(0, SLOT_N);
  return acts.map((s) => ({ ...s, lv }));
}
// 전투에 넘길 모양 — { id, kind, shape, range, maxT, hits, coef(레벨 반영), cdMs, durMs, buff:{…} }
export function battleKit(list) {
  return list.map((s) => ({ id: s.id, kind: s.kind, shape: s.shape, range: s.range, maxT: s.maxT, hits: s.hits, coef: s.coef ? kitCoef(s, s.lv) : 0, cdMs: s.cdMs, durMs: s.durMs, buff: s.kind === 'buff' ? s.stats(s.lv) : null, auto: s.auto !== false }));
}
