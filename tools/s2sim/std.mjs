// 새 시즌 표준 무인 표 만들기 — 기준 플레이어(접속 2시간 + 방치)가 그 레벨에 닿은 날의 실제 스탯.
// 장비 시뮬(sim/econ) + S5 시뮬(sim/s5) + 무인(전직·마스터리)을 합쳐 레벨마다 한 줄. 몹은 이 표에 맞춰 강해진다.
// v634: 같은 날의 층별 출처(장비 · 병기 · 동료 · 영물 · 경지 · 강호행 · 꾸미기)도 js/s2/tables/stdsrc.js로(강함 진맥)
//   node tools/s2sim/std.mjs            → js/s2/tables/std.js · stdsrc.js 다시 씀
//   node tools/s2sim/std.mjs --check    → 다시 계산해 지금 표와 같은지만 봄
import fs from 'node:fs';
const root = new URL('../../js/s2/', import.meta.url).href;
const { buildStd, buildStdSrc } = await import(root + 'sim/std.js');
const rows = buildStd(), srcRows = buildStdSrc();
const out = `// 새 시즌 표준 무인 표 — tools/s2sim/std.mjs가 만든다(손으로 고치지 말 것).\n// 레벨 L에 기준 플레이어(접속 2시간 + 방치)가 가진 실제 스탯. 몹 강함(battle/ref.js)이 이 표를 기준으로 한다.\nexport const STD = ${JSON.stringify(rows)};\n`;
const outSrc = `// v634 표준 무인 층별 출처 — tools/s2sim/std.mjs가 만든다(손으로 고치지 말 것).\n// 레벨 L에 기준 플레이어가 층마다(장비 · 병기 · 동료 · 영물 · 경지 · 강호행 · 꾸미기) 가진 출처 스탯. 강함 진맥(grow/pulse.js)이 쓴다.\nexport const STD_SRC = ${JSON.stringify(srcRows)};\n`;
const file = new URL('../../js/s2/tables/std.js', import.meta.url), fileSrc = new URL('../../js/s2/tables/stdsrc.js', import.meta.url);
if (process.argv.includes('--check')) {
  const same = [[file, out], [fileSrc, outSrc]].every(([f, o]) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '') === o);
  console.log(same ? '같음' : '다름');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(file, out);
fs.writeFileSync(fileSrc, outSrc);
console.log(`표준 무인 ${rows.length - 1}줄 · 층별 출처 ${srcRows.length - 1}줄`);
