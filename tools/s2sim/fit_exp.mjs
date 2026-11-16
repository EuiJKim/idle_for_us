// 새 시즌 경험치 표 만들기(v527) — 진행 목표 점(progress.js CURVE_PTS: [레벨, 날])을 매끈하게 이어 레벨마다 다음까지 경험치를 역산한다.
//   node tools/s2sim/fit_exp.mjs           → js/s2/tables/exp_next.js 다시 씀
//   node tools/s2sim/fit_exp.mjs --check   → 다시 계산해 지금 표와 같은지만 봄
//   보정(CORR): 실제 엔진 봇(play.mjs)이 목표보다 빠르거나 느린 레벨 구간에 곱하는 배율 — [레벨, 배율] 점을 이어서 쓴다.
import fs from 'node:fs';
const root = new URL('../../js/s2/', import.meta.url).href;
const { CURVE_PTS, LEVEL_MAX } = await import(root + 'tables/progress.js');
const { mobExp, KILLS_PER_MIN } = await import(root + 'tables/exp.js');
const { minutesAtDay } = await import(root + 'sim/progress.js');
export const CORR = JSON.parse(fs.readFileSync(new URL('./exp_corr.json', import.meta.url), 'utf8'));

const lin = (pts) => (x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (x <= pts[i + 1][0]) { const [a, p] = pts[i], [b, q] = pts[i + 1]; return p + ((q - p) * (x - a)) / (b - a); } return pts.at(-1)[1]; };
// 기준 레벨(CURVE_PTS의 레벨)마다 「다음까지 경험치」를 정하고 그 사이는 기하로 잇는다(늘 늘어나게).
// 앞에서부터 하나씩: 그 기준 레벨의 값을 이분 탐색으로 골라 목표 날(사냥 분)에 닿게 한다.
export function buildNext(corrPts = CORR) {
  const corr = lin(corrPts), base = (L) => KILLS_PER_MIN * mobExp(L);
  const [L0, d0] = CURVE_PTS[0];
  const anchors = [[1, (minutesAtDay(d0) / (L0 - 1)) * base(1)]];   // [레벨, 다음까지 경험치] — 첫 점까지는 고르게
  const nextOf = (L, A) => { for (let i = 0; i < A.length - 1; i++) if (L <= A[i + 1][0]) { const [a, p] = A[i], [b, q] = A[i + 1]; return p * Math.pow(q / p, (L - a) / (b - a)); } return A.at(-1)[1]; };
  const minutesTo = (Lt, A) => { let m = 0; for (let L = 1; L < Lt; L++) m += nextOf(L, A) / base(L); return m; };
  for (const [Lt, day] of CURVE_PTS.slice(1)) {
    const want = minutesAtDay(day), prev = anchors.at(-1)[1];
    let lo = prev * 1e-3, hi = prev * 1e6;
    for (let k = 0; k < 200; k++) { const mid = Math.sqrt(lo * hi); if (minutesTo(Lt, [...anchors, [Lt, mid]]) < want) lo = mid; else hi = mid; }
    anchors.push([Lt, Math.sqrt(lo * hi)]);
  }
  const next = [0];
  for (let L = 1; L <= LEVEL_MAX; L++) next[L] = Math.max(1, Math.round(nextOf(L, anchors) * corr(L)));
  if (process.argv.includes('-v')) console.log(anchors.map(([l, v]) => `${l}:${Math.round(v)}`).join(' '));
  return next;
}
if (import.meta.url === `file://${process.argv[1]}`) {
const corrOf = lin(CORR), C = [0]; for (let L = 1; L <= LEVEL_MAX; L++) C[L] = +corrOf(L).toFixed(4);
const out = `// 새 시즌 레벨마다 다음까지 경험치 — tools/s2sim/fit_exp.mjs가 만든다(손으로 고치지 말 것). [0]은 비움.\n// EXP_CORR: 실제 엔진 보정(calib.mjs) — 그 레벨에서 엔진이 곡선 모델보다 몇 배 빨리 버는지. 곡선 모델(sim/progress)이 이걸로 엔진과 같은 때를 낸다.\nexport const EXP_NEXT = ${JSON.stringify(buildNext())};\nexport const EXP_CORR = ${JSON.stringify(C)};\n`;
const file = new URL('../../js/s2/tables/exp_next.js', import.meta.url);
if (process.argv.includes('--check')) { const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; console.log(cur === out ? '같음' : '다름'); process.exit(cur === out ? 0 : 1); }
fs.writeFileSync(file, out);
console.log('경험치 표 다시 만듦');
}
