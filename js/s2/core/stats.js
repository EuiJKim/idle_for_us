// 새 시즌(S1) 스탯 체계(계획서 §D). 비율 스탯은 퍼밀(1000 = 100%).
// 출처(장비·경지·병기…)마다 { 스탯: 값 } 묶음을 내면, 여기서 모아 최종 스탯을 만든다.
//   kind 'flat' : 그냥 더하는 수(공격·체력·방어…)
//   kind 'rate' : 퍼밀 — 같은 층끼리 더하고, 층끼리는 곱한다(공격%①②, 최종 피해①~⑤ …)
//   base       : 'atk' 같은 flat 스탯에 곱해지는 비율 스탯(예: atkP → atk)
export const STATS = {
  // 주 스탯 (직업 환산표로 공격·체력에)
  str: { name: '근골', kind: 'flat' }, agi: { name: '신법', kind: 'flat' }, ene: { name: '내력', kind: 'flat' }, wis: { name: '오성', kind: 'flat' },
  // 기본
  atk: { name: '공격', kind: 'flat' }, hp: { name: '체력', kind: 'flat' }, def: { name: '방어', kind: 'flat' }, mp: { name: '내공', kind: 'flat' },
  atkP: { name: '공격%', kind: 'rate', base: 'atk' }, hpP: { name: '체력%', kind: 'rate', base: 'hp' }, defP: { name: '방어%', kind: 'rate', base: 'def' },
  aspd: { name: '공격 속도', kind: 'rate' }, mspd: { name: '이동 속도', kind: 'rate' },
  // 공격 층(§D3)
  atkL1: { name: '공격%①', kind: 'rate', layer: 'atkL1' }, atkL2: { name: '공격%②', kind: 'rate', layer: 'atkL2' },
  baseP: { name: '평타 피해', kind: 'rate' }, skillP: { name: '무공 피해', kind: 'rate' }, mainDmg: { name: '주 피해', kind: 'rate', layer: 'mainDmg' },
  bossDmg: { name: '보스 피해', kind: 'rate' }, mobDmg: { name: '일반 몹 피해', kind: 'rate' },
  final1: { name: '최종 피해①', kind: 'rate', layer: 'final1' }, final2: { name: '최종 피해②', kind: 'rate', layer: 'final2' },
  final3: { name: '최종 피해③', kind: 'rate', layer: 'final3' }, final4: { name: '최종 피해④', kind: 'rate', layer: 'final4' },
  final5: { name: '최종 피해⑤', kind: 'rate', layer: 'final5' },
  // 치명 · 피해 폭
  crit: { name: '치명 확률', kind: 'rate' }, critDmg: { name: '치명 피해', kind: 'rate' }, critRes: { name: '치명 저항', kind: 'rate' },
  dmgMin: { name: '최소 피해', kind: 'rate' }, dmgMax: { name: '최대 피해', kind: 'rate' },
  // 방어 쪽
  pierce: { name: '관통', kind: 'rate' }, takenDownP: { name: '받는 피해 감소', kind: 'rate' }, takenDownF: { name: '받는 피해 감소(고정)', kind: 'flat' },
  // 격차 판정(§E3) — 수치끼리 빼서 표로
  acc: { name: '명중', kind: 'flat' }, eva: { name: '회피', kind: 'flat' }, ccHit: { name: '상태이상 걸기', kind: 'flat' }, ccRes: { name: '상태이상 저항', kind: 'flat' },
  // 유틸
  leech: { name: '흡혈', kind: 'rate' }, cdr: { name: '쿨 감소', kind: 'rate' }, mpCost: { name: '내공 소모 감소', kind: 'rate' }, regen: { name: '체력 회복', kind: 'flat' },
  expP: { name: '경험치', kind: 'rate' }, goldP: { name: '은자', kind: 'rate' }, dropP: { name: '아이템 드롭', kind: 'rate' },
};
// 오행(金木水火土) — 약점(주는 쪽) · 강인(받는 쪽)
export const ELEMS = ['metal', 'wood', 'water', 'fire', 'earth'];
export const ELEM_NAME = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
for (const e of ELEMS) {
  STATS[`weak_${e}`] = { name: `${ELEM_NAME[e]} 약점`, kind: 'rate' };
  STATS[`tough_${e}`] = { name: `${ELEM_NAME[e]} 강인`, kind: 'rate' };
}
export const LAYERS = ['atkL1', 'atkL2', 'mainDmg', 'final1', 'final2', 'final3', 'final4', 'final5'];
// 어떤 출처가 어떤 층을 주는가(§D3) — 화면 설명 · 시험용
export const LAYER_OWNER = { atkL1: '장비', atkL2: '경지', mainDmg: '병기', final1: '무공 마스터리', final2: '영물', final3: '강호행', final4: '동료', final5: '이벤트·문파' };

// 출처 목록 [{ src:'장비', stats:{…} }, …] → 합계 { 스탯: 값 } (같은 스탯은 더함)
export function sumStats(sources) {
  const t = {};
  for (const s of sources) for (const [k, v] of Object.entries(s.stats || s)) {
    if (!STATS[k]) throw new Error(`없는 스탯: ${k}`);
    t[k] = (t[k] || 0) + v;
  }
  return t;
}
// 최종 스탯 — flat 스탯에 그 base 비율을 곱한다(층 스탯은 데미지 계산에서 따로 곱한다)
export function finalize(total) {
  const out = { ...total };
  for (const [k, d] of Object.entries(STATS)) {
    if (d.kind === 'rate' && d.base && total[k]) out[d.base] = Math.floor(((total[d.base] || 0) * (1000 + total[k])) / 1000);
  }
  return out;
}
// 층 곱 — 데미지 계산에서 한 번에(§E1 ②④⑩)
export function layerMul(total, names = LAYERS) {
  let x = 1;
  for (const n of names) x *= (1000 + (total[n] || 0)) / 1000;
  return x;
}
