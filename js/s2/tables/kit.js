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
export const skillById = (id) => { if (!id) return null; const j = id.split('_')[0]; return KIT[j]?.find((s) => s.id === id) || null; };
// 그 차수 · 레벨이면 열린 무공
export const kitOpen = (job, adv) => (KIT[job] || KIT.sword).filter((s) => s.tier <= adv);
// 표준 무공 세트(기준 무인): 열린 공격 무공 · 버프 전부(6칸 안) · 레벨 = 상한
export function stdKit(L, job, adv) {
  const lv = kitCap(L);
  const acts = kitOpen(job, adv).filter((s) => s.kind !== 'passive').sort((a, b) => b.tier - a.tier).slice(0, SLOT_N);
  return acts.map((s) => ({ ...s, lv }));
}
// 전투에 넘길 모양 — { id, kind, shape, range, maxT, hits, coef(레벨 반영), cdMs, durMs, buff:{…} }
// s.tree: 그 무공 강화 트리 노드 레벨(있으면 반영)
export function battleKit(list) {
  return list.map((s) => {
    const e = treeEff(s, s.tree);
    const buff = s.kind === 'buff' ? Object.fromEntries(Object.entries(s.stats(s.lv)).map(([k, v]) => [k, Math.round(v * (1000 + (e.amp || 0)) / 1000)])) : null;
    return { id: s.id, kind: s.kind, shape: s.shape, range: s.range ? s.range * (1000 + (e.rng || 0)) / 1000 : s.range, maxT: (s.maxT || 0) + (e.tgt || 0), hits: (s.hits || 0) + (e.hit || 0),
      coef: s.coef ? Math.round(kitCoef(s, s.lv) * (1000 + (e.pow || 0)) / 1000) : 0, cdMs: Math.round(s.cdMs * (1000 - Math.min(400, e.cdr || 0)) / 1000),
      durMs: s.durMs ? Math.round(s.durMs * (1000 + (e.dur || 0)) / 1000) : s.durMs, buff, crit: e.cri || 0, auto: s.auto !== false };
  });
}

// ── 무공 강화 트리(v494) ── 무공마다 3단. 노드: 단계(tier) · 최대 레벨 · 점수(레벨마다) · 효과(레벨당) · 배우는 시간(분, 3단만)
// 2단은 그 무공에 5점, 3단은 12점 넘게 써야 열린다.
export const TREE_GATE = [0, 5, 12];
export const TREE = {
  active: [
    { n: 'pow', name: '위력', tier: 0, max: 5, pts: 1, eff: { pow: 50 } },          // 계수 +5%/레벨(퍼밀)
    { n: 'cdr', name: '쿨 감소', tier: 0, max: 5, pts: 1, eff: { cdr: 30 } },      // 쿨 −3%/레벨
    { n: 'rng', name: '범위', tier: 1, max: 3, pts: 2, eff: { rng: 80 } },          // 사거리 +8%/레벨
    { n: 'tgt', name: '대상 수', tier: 1, max: 3, pts: 2, eff: { tgt: 1 } },        // 최대 대상 +1/레벨
    { n: 'hit', name: '연타', tier: 2, max: 1, pts: 4, eff: { hit: 1 }, waitMin: 60 },
    { n: 'cri', name: '극의', tier: 2, max: 3, pts: 3, eff: { cri: 80 }, waitMin: 40 }, // 이 무공 치명 확률 +8%/레벨
  ],
  buff: [
    { n: 'dur', name: '지속', tier: 0, max: 5, pts: 1, eff: { dur: 100 } },        // 지속 +10%/레벨
    { n: 'cdr', name: '쿨 감소', tier: 0, max: 5, pts: 1, eff: { cdr: 40 } },
    { n: 'amp', name: '효과', tier: 1, max: 3, pts: 2, eff: { amp: 120 } },         // 효과 +12%/레벨
    { n: 'all', name: '여운', tier: 2, max: 1, pts: 4, eff: { dur: 300 }, waitMin: 90 },
  ],
};
export const treeOf = (sk) => (sk && TREE[sk.kind]) || [];
// 무공 점수: 무인 레벨마다 1점 · 10칸 깰 때마다 3점
export const kitPoints = (heroLv, stageTop = 1) => Math.max(0, heroLv - 1) + Math.floor(Math.max(0, stageTop - 1) / 10) * 3;
export const treeResetCost = (used) => [{ k: 'gold', n: 2000 + used * 800 }];
// 트리 효과 합(그 무공 하나) — { pow, cdr, rng, tgt, hit, cri, dur, amp }
export function treeEff(sk, nodes = {}) {
  const e = {};
  for (const nd of treeOf(sk)) { const lv = nodes[nd.n] || 0; if (lv) for (const [k, v] of Object.entries(nd.eff)) e[k] = (e[k] || 0) + v * lv; }
  return e;
}

// ── 동료 공격(v497) ── 장착한 동료(등급 0~4)가 쿨마다 무인의 표적(가까운 2마리)을 친다. 계수는 무인 공격력 기준(퍼밀)
export const PAL_ATK = { cdMs: 3200, maxT: 2, range: 2.4, coef: [260, 340, 450, 600, 800] };
// 표준 동료(기준 무인): Lv 1~29 한 마리 · 30마다 한 마리 더(최대 5) · 등급은 40레벨마다 하나씩
export const stdPals = (L) => Array.from({ length: Math.min(5, 1 + Math.floor(L / 30)) }, () => ({ g: Math.min(4, Math.floor(L / 40)) }));
// 두목 패턴(v497) — 예고(tellMs) 뒤 범위 안이면 맞는다. 피해 = 두목 공격 × x
export const BOSS_PATS = [
  { id: 'taiji', name: '태극진', shape: 'circle', w: 3200, tellMs: 1300, x: 2.2 },
  { id: 'petal', name: '낙화풍', shape: 'line', w: 6000, tellMs: 1100, x: 1.8 },
  { id: 'eye', name: '혈안', shape: 'target', w: 1800, tellMs: 1500, x: 2.6 },
  { id: 'orb', name: '흑뢰구', shape: 'circle', w: 2400, tellMs: 900, x: 1.6 },
];
export const BOSS_PAT_EVERY = 6500;
