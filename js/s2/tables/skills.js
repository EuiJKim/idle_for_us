// 새 시즌(S3) 무공 · 마스터리 트리 · 전직 숫자(계획서 §G 4·3).
// 무공 셋: 평타 · 주력(쿨마다 자동) · 내공심법(패시브) · 호신기(버프). 마스터리 트리는 최종 피해①(final1) 층을 준다.
export const SKILL_LV_MAX = 20;
export const SKILLS = {
  base: { name: '평타', kind: 'base', coef: (lv) => 1000 + 20 * (lv - 1) },
  main: { name: '주력 무공', kind: 'active', coef: (lv) => 2600 + 90 * (lv - 1), cdMs: 6000, unlockLv: 5 },
  inner: { name: '내공심법', kind: 'passive', stats: (lv) => ({ atkP: 15 * lv, hpP: 10 * lv }), unlockLv: 10 },
  guard: { name: '호신기', kind: 'buff', stats: (lv) => ({ takenDownP: 5 * lv, defP: 10 * lv }), unlockLv: 30 },
};
// 무공 레벨업 비용(은자) — 무공 레벨 l → l+1, 무인 레벨 L 기준 사냥 벌이에 맞춰 S4에서 다시 맞춤
export const skillCost = (l) => [{ k: 'gold', n: Math.round(120 * Math.pow(l, 1.7)) }];
// 무공 레벨 상한 = 무인 레벨에 따라(레벨 5마다 1)
export const skillCap = (heroLv) => Math.min(SKILL_LV_MAX, 1 + Math.floor(heroLv / 5));

// 마스터리 트리 — 깊이 1~4, 노드 12개(직업 공통 모양). 배우는 데 대기 시간(분) · 필요 무인 레벨
export const MASTERY = [
  { id: 'm1', depth: 1, need: null, lv: 20, final1: 15, waitMin: 5 },
  { id: 'm2', depth: 1, need: null, lv: 25, final1: 15, waitMin: 10 },
  { id: 'm3', depth: 1, need: null, lv: 30, final1: 15, waitMin: 15 },
  { id: 'm4', depth: 2, need: 'm1', lv: 45, final1: 20, waitMin: 30 },
  { id: 'm5', depth: 2, need: 'm2', lv: 55, final1: 20, waitMin: 45 },
  { id: 'm6', depth: 2, need: 'm3', lv: 65, final1: 20, waitMin: 60 },
  { id: 'm7', depth: 3, need: 'm4', lv: 80, final1: 25, waitMin: 120 },
  { id: 'm8', depth: 3, need: 'm5', lv: 95, final1: 25, waitMin: 180 },
  { id: 'm9', depth: 3, need: 'm6', lv: 105, final1: 25, waitMin: 240 },
  { id: 'm10', depth: 4, need: 'm7', lv: 120, final1: 30, waitMin: 360 },
  { id: 'm11', depth: 4, need: 'm8', lv: 135, final1: 30, waitMin: 420 },
  { id: 'm12', depth: 4, need: 'm9', lv: 145, final1: 30, waitMin: 480 },
];
export const masteryCost = (node) => [{ k: 'gold', n: 500 * node.depth * node.depth * Math.round(node.lv / 10 + 1) }];

// 전직 — 차수마다 보상 스탯(퍼밀) · 전직 던전 이름(S6에서 실제 던전)
export const JOB_ADV = [
  null,
  { atkP: 50, hpP: 50, dungeon: 'job1' },
  { atkP: 80, hpP: 80, dungeon: 'job2' },
  { atkP: 120, hpP: 120, dungeon: 'job3' },
  { atkP: 160, hpP: 160, dungeon: 'job4' },
  { atkP: 200, hpP: 200, dungeon: 'job5' },
];
// 고유 스탯 — 스탯 50점마다 1점, 치명·치명 피해·보스 피해 중 하나에 넣는다(한 점에 얼마)
export const UNIQUE_EVERY = 50;
export const UNIQUE_STATS = { crit: 4, critDmg: 15, bossDmg: 10 };
