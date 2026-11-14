// 새 시즌 표준 무인 표 만들기 — 기준 플레이어(접속 2시간 + 방치)가 그 레벨에 닿은 날의 실제 스탯.
// 장비 시뮬(sim/econ) + S5 시뮬(sim/s5) + 무인(전직·마스터리)을 합쳐 레벨마다 한 줄. 몹은 이 표에 맞춰 강해진다.
//   node tools/s2sim/std.mjs            → js/s2/tables/std.js 다시 씀
//   node tools/s2sim/std.mjs --check    → 다시 계산해 지금 표와 같은지만 봄
import fs from 'node:fs';
const root = new URL('../../js/s2/', import.meta.url).href;
const { buildStd } = await import(root + 'sim/std.js');
const rows = buildStd();
const out = `// 새 시즌 표준 무인 표 — tools/s2sim/std.mjs가 만든다(손으로 고치지 말 것).\n// 레벨 L에 기준 플레이어(접속 2시간 + 방치)가 가진 실제 스탯. 몹 강함(battle/ref.js)이 이 표를 기준으로 한다.\nexport const STD = ${JSON.stringify(rows)};\n`;
const file = new URL('../../js/s2/tables/std.js', import.meta.url);
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  console.log(cur === out ? '같음' : '다름');
  process.exit(cur === out ? 0 : 1);
}
fs.writeFileSync(file, out);
console.log(`표준 무인 ${rows.length - 1}줄`);
