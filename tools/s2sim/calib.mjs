// 경험치 표 보정(v527) — 실제 엔진 봇(play.mjs, 기준: 하루 접속 20시간 + 방치 4시간)이 레벨마다 닿은 때를 재서
// 목표 곡선(진행 목표 점 → 곡선 모델)의 때와 견주고, 레벨 구간마다 「목표 걸린 시간 ÷ 실제 걸린 시간」만큼 보정(exp_corr.json)을 곱한다.
//   node tools/s2sim/calib.mjs [days=60] [rounds=1]   → exp_corr.json · exp_next.js 다시 씀(그 뒤 std.mjs로 표준 무인 표도)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const days = Number(process.argv[2] || 60), rounds = Number(process.argv[3] || 1);
const here = new URL('.', import.meta.url).pathname;
const BINS = [[1, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 100], [100, 110], [110, 120], [120, 130], [130, 140], [140, 150]];
for (let r = 0; r < rounds; r++) {
  // 새 표로 다시 불러오려고 따로 돈다
  const out = execFileSync('node', [here + 'calib_run.mjs', String(days)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const { reach, target } = JSON.parse(out.trim().split('\n').at(-1));
  const corr = JSON.parse(fs.readFileSync(here + 'exp_corr.json', 'utf8'));
  const cAt = (x) => { if (x <= corr[0][0]) return corr[0][1]; for (let i = 0; i < corr.length - 1; i++) if (x <= corr[i + 1][0]) { const [a, p] = corr[i], [b, q] = corr[i + 1]; return p + ((q - p) * (x - a)) / (b - a); } return corr.at(-1)[1]; };
  const pts = [];
  const rows = [];
  for (const [a, b] of BINS) {
    const ra = reach[a], rb = reach[b], ta = target[a], tb = target[b];
    const mid = (a + b) / 2;
    if (ra == null || rb == null || rb <= ra) { pts.push([mid, cAt(mid)]); rows.push(`${a}-${b}: 닿지 못함`); continue; }
    const k = Math.max(0.5, Math.min(2, (tb - ta) / (rb - ra)));   // 한 번에 두 배 넘게는 안 바꾼다
    pts.push([mid, +(cAt(mid) * k).toFixed(4)]);
    rows.push(`${a}-${b}: 실제 ${((rb - ra) / 60).toFixed(1)}h · 목표 ${((tb - ta) / 60).toFixed(1)}h → ×${k.toFixed(2)}`);
  }
  console.log(`— 보정 ${r + 1}회차\n` + rows.join('\n'));
  fs.writeFileSync(here + 'exp_corr.json', JSON.stringify([[1, pts[0][1]], ...pts, [150, pts.at(-1)[1]]]) + '\n');
  execFileSync('node', [here + 'fit_exp.mjs'], { stdio: 'inherit' });
}
