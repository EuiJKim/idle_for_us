// 새 시즌(S0~) 시험 — js/s2 엔진·표. 계획서 docs/새시즌_계획.md의 합격선을 단계마다 여기에 더한다.
import fs from 'node:fs';
import { Rng } from '../js/s2/core/rng.js';
import { P, mulP, ofP, layers, finalStat, pct, lerpTable } from '../js/s2/core/fixed.js';
import { GameClock, TICK_MS } from '../js/s2/core/clock.js';
import * as PR from '../js/s2/tables/progress.js';
import * as EX from '../js/s2/tables/exp.js';
import * as GE from '../js/s2/tables/gear.js';
import * as ST from '../js/s2/tables/star.js';
import * as OP from '../js/s2/tables/option.js';
import * as EC from '../js/s2/tables/economy.js';

let fail = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK ' : '✗✗ '} ${m}${d ? `  — ${d}` : ''}`); if (!c) fail++; };

console.log('\n=== S0 결정론 난수 ===');
{
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const sa = Array.from({ length: 50 }, () => a.u32()), sb = Array.from({ length: 50 }, () => b.u32()), sc = Array.from({ length: 50 }, () => c.u32());
  ok(sa.join() === sb.join(), '같은 씨앗 → 같은 수열');
  ok(sa.join() !== sc.join(), '다른 씨앗 → 다른 수열');
  const r = new Rng(7); for (let i = 0; i < 100; i++) r.u32();
  const saved = r.state(); const next = Array.from({ length: 20 }, () => r.u32());
  const back = new Rng(saved); ok(next.join() === Array.from({ length: 20 }, () => back.u32()).join(), '상태 네 칸을 저장했다 되살리면 이어서 같은 수');
  const g = new Rng(1); let lo = Infinity, hi = -Infinity; const cnt = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) { const v = g.int(10); lo = Math.min(lo, v); hi = Math.max(hi, v); cnt[v]++; }
  ok(lo === 0 && hi === 9, 'int(10)은 0~9', `${lo}~${hi}`);
  ok(cnt.every((n) => Math.abs(n - 10000) < 500), 'int(10) 고르게(각 10000±500)', cnt.join(','));
  const h = new Rng(2); let yes = 0; for (let i = 0; i < 100000; i++) yes += h.roll(250);
  ok(Math.abs(yes - 25000) < 800, 'roll(250) ≈ 25%', yes);
  ok(new Rng(3).roll(0) === false && new Rng(3).roll(1000) === true, 'roll 끝값(0 → 거짓 · 1000 → 참)');
  const k = new Rng(4); const pc = [0, 0, 0]; for (let i = 0; i < 60000; i++) pc[k.pick([1, 2, 3])]++;
  ok(Math.abs(pc[0] - 10000) < 600 && Math.abs(pc[2] - 30000) < 900, 'pick 가중치 1:2:3', pc.join(','));
}

console.log('\n=== S0 퍼밀 계산 ===');
{
  ok(P === 1000 && mulP(1000, 250) === 1250 && ofP(2000, 125) === 250, 'mulP · ofP');
  ok(layers(1000, [100, 100]) === 1210 && layers(1000, [200]) === 1200, '층끼리 곱하기(10%+10% 두 층 = 21%, 한 층 20%)');
  ok(finalStat(100, 50, 200) === 180, '최종 = (기본+더하기) × (1+곱하기)');
  ok(pct(125) === '12.5%' && pct(1000) === '100%', '퍼밀 → % 글자');
  ok(lerpTable([{ at: 1, v: 0 }, { at: 11, v: 100 }], 6, 'v') === 50, '표 사이 직선 보간');
}

console.log('\n=== S0 게임 시계 ===');
{
  const c = new GameClock(); let n = c.feed(16.7) + c.feed(16.7) + c.feed(16.7);
  ok(n === 1, '50ms 틱 — 16.7ms 세 번이면 1틱', n);
  ok(new GameClock().feed(10000) === 40, '한 번에 최대 40틱(멈췄다 돌아와도 폭주 없음)');
  const t = new GameClock(); t.tick(); t.tick(); ok(t.ms === 2 * TICK_MS && Number.isInteger(t.ms), '시계는 ms 정수');
}

console.log('\n=== S0 숫자 초안 표 ===');
{
  // 진행 목표
  const pr = PR.PROGRESS;
  ok(pr.every((r, i) => i === 0 || (r.day > pr[i - 1].day && r.lv[0] >= pr[i - 1].lv[1])), '진행 목표: 날짜·레벨이 앞으로만');
  ok(pr.find((r) => r.day === 1).lv.join('~') === '55~65' && pr.find((r) => r.day === 7).lv[0] === 100 && pr.at(-1).lv[0] === PR.LEVEL_MAX, '1일 55~65 · 7일 100 · 1년 만렙');
  // 경험치
  const e = (L) => EX.expToNext(L);
  ok(Array.from({ length: PR.LEVEL_MAX - 2 }, (_, i) => i + 2).every((L) => e(L) > e(L - 1)), '경험치: 레벨마다 늘어남');
  ok(e(100) / e(99) < 3.5 && e(104) / e(103) < 1.4 && e(105) / e(104) < 1.15, '100에서 벽이 갑자기 서지 않음(100~104 서서히)', `${(e(100) / e(99)).toFixed(2)} · ${(e(104) / e(103)).toFixed(2)}`);
  const pre = EX.cumExp(100) - EX.cumExp(1), post = EX.cumExp(150) - EX.cumExp(100);
  ok(post > pre * 30, '100 이후가 그 전보다 훨씬 무거움(1~100의 30배 넘게)', `${(post / pre).toFixed(0)}배`);
  // 장비 뽑기
  const ws = Array.from({ length: GE.GACHA_LV_MAX }, (_, i) => GE.gachaWeights(i + 1));
  ok(ws.every((w) => w.reduce((a, b) => a + b, 0) === 1000 && w.every((x) => x >= 0)), '장비 뽑기: 모든 레벨 확률 합 100%');
  ok(ws.every((w, i) => i === 0 || w.slice(3).reduce((a, b) => a + b, 0) >= ws[i - 1].slice(3).reduce((a, b) => a + b, 0)), '뽑기 레벨이 오르면 진품 이상 확률이 줄지 않음');
  ok(ws[19][6] === 3 && ws[0][6] === 0, '천품은 20레벨에서만 0.3%');
  ok(GE.SUBOPT_COUNT_P.reduce((a, b) => a + b, 0) === 1000, '부옵션 줄 수 확률 합 100%');
  ok(GE.gachaWaitMin(GE.GACHA_LV_MAX) <= 24 * 60 && GE.SLOTS.length === 10 && GE.GRADES.length === 7, '뽑기 대기 최대 24시간 · 10부위 · 등급 7');
  // 성혼
  let good = true, why = '';
  for (let s = 0; s < ST.STAR_MAX; s++) {
    const o = ST.starOdds(s);
    if (o.ok + o.down + o.brk > 1000 || o.ok <= 0) { good = false; why = `${s}성 합 넘침`; }
    if (s < ST.DOWN_FROM && o.down) { good = false; why = `${s}성 하락`; }
    if (s < ST.BREAK_FROM && o.brk) { good = false; why = `${s}성 파괴`; }
  }
  ok(good, '성혼: 확률 합 ≤ 100% · 11성 전 하락 없음 · 15성 전 파괴 없음', why);
  ok(ST.starOdds(0).ok === 950 && ST.starOdds(15).brk === 20 && ST.starOdds(24).ok === 200, '성혼 끝값(0성 95% · 15성 파괴 2% · 24성 20%)');
  // 무작위 옵션 · 뽑기
  ok([0, 5, 10].every((m) => OP.optWeights(m).reduce((a, b) => a + b, 0) === 1000), '무작위 옵션: 숙련 0·5·10 확률 합 100%');
  ok(OP.optWeights(10)[3] > OP.optWeights(0)[3], '굴림 숙련이 오르면 전설 확률 ↑');
  ok(OP.PULL_P.reduce((a, b) => a + b, 0) === 1000 && OP.PULL_PITY === 200, '동료·병기·영물 뽑기 합 100% · 천장 200');
  // 경제
  ok(Math.abs(Object.values(EC.GOLD_SINK_SHARE).reduce((a, b) => a + b, 0) - 1) < 1e-9, '은자 소비 몫 합 100%');
  ok(EC.OFFLINE_CAP_H === 12 && EC.OFFLINE_WEEK_CAP_H === 84, '오프라인 12시간 · 주간 84시간');
}

console.log('\n=== S0 규칙 ===');
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('../js/s2', import.meta.url).pathname);
  const code = (p) => fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 주석은 빼고
  const bad = files.filter((p) => /Math\.random|Date\.now|performance\.now/.test(code(p)));
  ok(bad.length === 0, 'js/s2 엔진은 Math.random·Date.now·performance.now를 쓰지 않는다(결정론)', bad.join(' '));
  const shipped = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8') + fs.readFileSync(new URL('../js/wmain.js', import.meta.url), 'utf8');
  ok(!/s2\//.test(shipped), '지금 게임은 아직 새 시즌 코드를 부르지 않는다(교체 전)');
  ok(/정한 것 \(2026-11-14\)/.test(fs.readFileSync(new URL('../docs/새시즌_계획.md', import.meta.url), 'utf8')), '계획서가 있다');
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail ? 1 : 0);
