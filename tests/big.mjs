// 큰 수 그릇을 시험한다. 여기가 틀리면 게임 전체가 틀린다.
// node tests/big.mjs
import { Big, big, ZERO, ONE } from '../js/big.js';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '  OK  ' : '  !!  '} ${label}${extra ? '  — ' + extra : ''}`);
};
// 작은 수는 보통 숫자와 거의 같아야 한다
const near = (a, b, tol = 1e-9) => {
  const x = a instanceof Big ? a.toNumber() : a;
  return Math.abs(x - b) <= tol * Math.max(1, Math.abs(b));
};

console.log('=== 1. 보통 숫자와 똑같이 센다 ===');
{
  ok(near(big(0), 0), '0');
  ok(near(big(1), 1), '1');
  ok(near(big(12345), 12345), '12345');
  ok(near(big(2).add(3), 5), '2 + 3 = 5');
  ok(near(big(10).sub(3), 7), '10 - 3 = 7');
  ok(near(big(6).mul(7), 42), '6 × 7 = 42');
  ok(near(big(84).div(2), 42), '84 ÷ 2 = 42');
  ok(near(big(0.1).add(0.2), 0.3, 1e-12), '0.1 + 0.2 = 0.3');
  ok(near(big(3).sub(5), -2), '3 - 5 = -2 (음수도 된다)');
  ok(big(5).sub(5).isZero(), '5 - 5 = 0');
  // 무작위로 1000번 맞춰 본다 — 손으로 고른 수만 맞는 건 안 맞는 것이다
  let bad = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 1000; i++) {
    const a = (rnd() - 0.5) * Math.pow(10, Math.floor(rnd() * 12));
    const b = (rnd() - 0.5) * Math.pow(10, Math.floor(rnd() * 12));
    if (!near(big(a).add(b), a + b, 1e-10)) bad++;
    if (!near(big(a).sub(b), a - b, 1e-10)) bad++;
    if (!near(big(a).mul(b), a * b, 1e-10)) bad++;
    if (b !== 0 && !near(big(a).div(b), a / b, 1e-10)) bad++;
  }
  ok(bad === 0, '아무 수나 4000번 넣어도 보통 셈과 같다', `${bad}건 어긋남`);
}

console.log('');
console.log('=== 2. 1e308을 넘어도 안 터진다 ===');
{
  const huge = Big.pow10(500);
  ok(huge.log10() === 500, '10^500', `지수 ${huge.e}`);
  ok(huge.mul(huge).log10() === 1000, '10^500 × 10^500 = 10^1000');
  ok(Big.pow10(100000).log10() === 100000, '10^100000도 된다');
  // 이게 이번 공사의 이유다
  const hp = Big.pow(1.085, 20000);
  ok(Number.isFinite(hp.log10()) && hp.log10() > 600,
    '1.085^20000이 안 터진다 (보통 숫자로는 Infinity)',
    `10^${hp.log10().toFixed(0)}`);
  ok(!Number.isFinite(Math.pow(1.085, 20000)), '같은 걸 보통 숫자로 하면 터진다');
  // 큰 수끼리 빼기 — Infinity - Infinity = NaN 이 나오면 안 된다
  const a = Big.pow10(800);
  const b = Big.pow10(799);
  ok(near(a.sub(b).div(Big.pow10(799)), 9, 1e-9), '10^800 - 10^799 = 9×10^799',
    a.sub(b).toString());
  ok(a.sub(a).isZero(), '같은 큰 수끼리 빼면 0 (NaN 아님)');
}

console.log('');
console.log('=== 3. 자릿수가 한참 벌어져도 괜찮다 ===');
{
  const big1 = Big.pow10(300);
  ok(big1.add(1).eq(big1), '10^300 + 1 = 10^300 (더해도 티가 안 난다)');
  ok(big1.sub(1).eq(big1), '10^300 - 1 = 10^300');
  ok(big(1).add(big1).eq(big1), '순서를 바꿔도 같다');
  // 피해가 체력보다 한참 작을 때 체력이 안 줄어드는 건 맞다.
  // 하지만 **같은 자릿수면 반드시 줄어야 한다** — 안 줄면 못 죽인다.
  const hp = Big.pow10(400);
  const dmg = Big.pow10(399);
  let cur = hp;
  for (let i = 0; i < 10; i++) cur = cur.sub(dmg);
  ok(cur.lte(ZERO) || cur.log10() < 390, '같은 자릿수 피해 열 번이면 죽는다',
    cur.toString());
}

console.log('');
console.log('=== 4. 견주기 ===');
{
  ok(big(5).gt(3) && big(3).lt(5), '보통 수 견주기');
  ok(Big.pow10(500).gt(Big.pow10(499)), '큰 수도 견준다');
  ok(big(-5).lt(big(-3)), '음수는 거꾸로');
  ok(big(-5).lt(0) && big(5).gt(0), '0과 견준다');
  ok(big(0).eq(0) && big(0).eq(ZERO), '0끼리 같다');
  // 같은 수인데 다르게 적힌 경우 — 정리가 안 돼 있으면 여기서 깨진다
  ok(new Big(10, 5).m !== undefined, '그릇은 만들어진다');
  ok(big(1e6).eq(big(1000000)), '같은 수는 같다');
  ok(Big.pow10(6).eq(big(1e6)), '10^6 = 1000000');
  ok(big(5).max(3).toNumber() === 5 && big(5).min(3).toNumber() === 3, '크고 작은 쪽 고르기');
  ok(big(-5).clampPos().isZero(), '음수는 0으로 막는다');
}

console.log('');
console.log('=== 5. 세이브에 넣었다 꺼내기 ===');
{
  const vals = [0, 1, 1234, 0.5, 1e20, -42];
  let bad = 0;
  for (const v of vals) {
    const r = Big.parse(JSON.parse(JSON.stringify(big(v))));
    if (!near(r, v, 1e-12)) bad++;
  }
  ok(bad === 0, '보통 수는 넣었다 꺼내도 그대로', `${bad}건`);
  const h = Big.pow10(777).mul(3.5);
  const back = Big.parse(JSON.parse(JSON.stringify(h)));
  ok(Math.abs(back.log10() - h.log10()) < 1e-9, '큰 수도 그대로',
    `${h.toString()} → ${back.toString()}`);
  // 옛 세이브에는 보통 숫자가 들어 있다. 그대로 읽혀야 한다.
  ok(near(Big.parse(12345), 12345), '옛 세이브의 보통 숫자를 읽는다');
  ok(Big.parse(null).isZero() && Big.parse(undefined).isZero() && Big.parse('').isZero(),
    '빈 값은 0');
  ok(Big.parse('쓰레기').isZero(), '말이 안 되는 글자는 0');
}

console.log('');
console.log('=== 6. 터진 값을 숨기지 않는다 ===');
{
  // Infinity가 들어오면 0으로 떨어뜨리면 안 된다 — 그건 고장을 감추는 짓이다
  ok(big(Infinity).log10() > 1e300, 'Infinity는 아주 큰 수로 받는다');
  ok(big(NaN).isZero(), 'NaN은 0으로 (셈이 안 샌다)');
  ok(big(0).div(0).isZero(), '0 ÷ 0 = 0 (NaN 아님)');
  ok(big(5).div(0).isZero(), '5 ÷ 0 = 0 (Infinity 아님)');
}

console.log('');
console.log('=== 7. 빠른가 ===');
{
  // 싸움은 30분의 1초마다 돈다. 적이 여든이면 한 틱에 수백 번 셈한다.
  const t0 = Date.now();
  let acc = big(1);
  const d = Big.pow10(400);
  for (let i = 0; i < 200000; i++) acc = acc.add(d).mul(1.0001);
  const ms = Date.now() - t0;
  ok(ms < 2000, '20만 번 셈이 2초 안', `${ms}ms`);
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
