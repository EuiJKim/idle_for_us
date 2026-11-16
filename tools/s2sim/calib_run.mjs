// calib.mjs가 부른다 — 봇을 돌려 레벨마다 처음 닿은 때(분)와 목표 때(분)를 JSON 한 줄로
const days = Number(process.argv[2] || 60);
const root = new URL('../../js/s2/', import.meta.url).href;
const { play } = await import('./play.mjs');
const { cumExp, DAY1_MIN, DAY_MIN } = await import(root + 'tables/exp.js');
const { levelAfterMinutes, minutesAtDay } = await import(root + 'sim/progress.js');
const { LEVEL_MAX } = await import(root + 'tables/progress.js');
void cumExp;
const reach = {};
play({ days, active: 1200, seed: 3, job: 'sword', marks: Array.from({ length: days * 24 * 6 }, (_, i) => (i + 1) * 10), onMark: (r) => { for (let L = 1; L <= r.lv; L++) if (reach[L] == null) reach[L] = r.min; } });
// 목표: 보정 없는 표(진행 목표 점 그대로)로 곡선 모델이 그 레벨에 닿는 때(분) — 보정이 목표를 움직이지 않게
const { buildNext } = await import('./fit_exp.mjs');
const { mobExp, KILLS_PER_MIN } = await import(root + 'tables/exp.js');
const N0 = buildNext([[1, 1], [150, 1]]);
const huntMinToDay = (m) => { let lo = 0, hi = 400; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (minutesAtDay(mid) < m) lo = mid; else hi = mid; } return hi; };
const target = { 1: 0 };
let M = 0;
for (let L = 1; L < LEVEL_MAX; L++) { M += Math.max(N0[L], 1) / (KILLS_PER_MIN * mobExp(L)); target[L + 1] = huntMinToDay(M) * 1440; }
void levelAfterMinutes;
void DAY1_MIN; void DAY_MIN;
console.log(JSON.stringify({ reach, target }));
