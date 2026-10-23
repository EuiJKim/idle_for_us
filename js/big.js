// 10^308에서 안 멎는 수.
//
// 자바스크립트 숫자는 1.8e308이 끝이다. 그 위로 한 번만 곱해도 Infinity가
// 되고, 거기서 빼면 NaN이 된다 — 적 체력이 Infinity면 아무것도 못 죽인다.
// 재 보니 **관문 8467**에서 적 체력이 그 선을 넘었다(8시간쯤).
//
// 글자만 알파벳으로 바꾸는 걸로는 안 된다. 알파벳은 이미 쓰고 있고(1e300 →
// 1.00bk), 터지는 건 보이는 글자가 아니라 속이다.
//
// 그래서 수를 **가수와 지수로 쪼개** 들고 다닌다. 1.2345e500이면
// m=1.2345, e=500이다. 지수는 그냥 숫자라 1e308까지 가므로, 관문이
// 10^300쯤 돼야 다시 걸린다 — 사실상 끝이 없다.
//
// **보통 숫자와 섞어 쓸 수 있다.** 모든 셈이 숫자든 Big이든 다 받는다.
// 안 그러면 한 번에 전부를 바꿔야 하고, 그러면 반드시 어디 한 군데가 샌다.

const LOG10 = Math.log10;

export class Big {
  // 바로 부르지 말고 Big.of / big()을 쓴다. 여기서는 정리를 안 한다.
  constructor(m, e) {
    this.m = m;
    this.e = e;
  }

  // ---- 만들기 ----

  static of(v) {
    if (v instanceof Big) return v;
    return Big.fromNumber(v);
  }

  static fromNumber(n) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) {
      // Infinity가 들어오면 0으로 떨어뜨리지 않는다 — 그건 터진 걸 숨기는 짓이다.
      if (n === Infinity) return new Big(1, 1e308);
      if (n === -Infinity) return new Big(-1, 1e308);
      return ZERO;
    }
    return norm(n, 0);
  }

  // 10^x. x는 보통 숫자여도 된다(1e5처럼 큰 값도 괜찮다).
  static pow10(x) {
    if (!Number.isFinite(x)) return x > 0 ? new Big(1, 1e308) : ZERO;
    const e = Math.floor(x);
    return new Big(Math.pow(10, x - e), e);
  }

  // base^exp. base는 보통 숫자, exp도 보통 숫자다 — 곡선이 전부 이 꼴이다.
  // Math.pow(1.085, 8000)은 Infinity지만 이건 안 터진다.
  static pow(base, exp) {
    if (base <= 0) return ZERO;
    return Big.pow10(LOG10(base) * exp);
  }

  // ---- 셈 ----

  add(o) {
    const b = Big.of(o);
    if (this.m === 0) return b;
    if (b.m === 0) return this;
    const [hi, lo] = this.e >= b.e ? [this, b] : [b, this];
    const d = hi.e - lo.e;
    // 자릿수가 17이나 벌어지면 더해도 티가 안 난다. 안 더하는 게 아니라
    // 더해도 같은 수다 — double이 그만큼밖에 못 담는다.
    if (d > 17) return hi;
    return norm(hi.m + lo.m * Math.pow(10, -d), hi.e);
  }

  sub(o) {
    const b = Big.of(o);
    return this.add(new Big(-b.m, b.e));
  }

  mul(o) {
    const b = Big.of(o);
    if (this.m === 0 || b.m === 0) return ZERO;
    return norm(this.m * b.m, this.e + b.e);
  }

  div(o) {
    const b = Big.of(o);
    if (b.m === 0) return ZERO;          // 0으로 나누면 0. NaN을 흘리지 않는다.
    if (this.m === 0) return ZERO;
    return norm(this.m / b.m, this.e - b.e);
  }

  neg() { return this.m === 0 ? ZERO : new Big(-this.m, this.e); }

  abs() { return this.m < 0 ? new Big(-this.m, this.e) : this; }

  // this^n (n은 보통 숫자)
  powNum(n) {
    if (this.m === 0) return n === 0 ? ONE : ZERO;
    if (this.m < 0) return ZERO;          // 음수의 거듭제곱은 이 게임에 없다
    return Big.pow10(this.log10() * n);
  }

  log10() {
    if (this.m <= 0) return -Infinity;
    return this.e + LOG10(this.m);
  }

  // ---- 견주기 ----

  cmp(o) {
    const b = Big.of(o);
    if (this.m === 0 && b.m === 0) return 0;
    if (this.m === 0) return b.m > 0 ? -1 : 1;
    if (b.m === 0) return this.m > 0 ? 1 : -1;
    const s1 = this.m > 0;
    const s2 = b.m > 0;
    if (s1 !== s2) return s1 ? 1 : -1;
    // 둘 다 음수면 지수가 큰 쪽이 더 작다
    if (this.e !== b.e) return (this.e > b.e) === s1 ? 1 : -1;
    if (this.m === b.m) return 0;
    return this.m > b.m ? 1 : -1;
  }

  gt(o) { return this.cmp(o) > 0; }

  gte(o) { return this.cmp(o) >= 0; }

  lt(o) { return this.cmp(o) < 0; }

  lte(o) { return this.cmp(o) <= 0; }

  eq(o) { return this.cmp(o) === 0; }

  isZero() { return this.m === 0; }

  isPos() { return this.m > 0; }

  max(o) { return this.gte(o) ? this : Big.of(o); }

  min(o) { return this.lte(o) ? this : Big.of(o); }

  // 0 아래로는 안 내려간다. 체력·재화에 쓴다.
  clampPos() { return this.m < 0 ? ZERO : this; }

  // ---- 내보내기 ----

  // 보통 숫자로. **너무 크면 Infinity다** — 작다는 걸 아는 자리에서만 쓴다.
  toNumber() {
    if (this.m === 0) return 0;
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -308) return 0;
    return this.m * Math.pow(10, this.e);
  }

  // 세이브에 넣을 글자. "1.2345e500" 꼴이라 사람이 읽어도 안다.
  toString() {
    if (this.m === 0) return '0';
    if (this.e >= -6 && this.e <= 15) return String(this.toNumber());
    return `${this.m}e${this.e}`;
  }

  toJSON() { return this.toString(); }

  // 보통 숫자와 같은 이름으로 불러 쓸 수 있게 해 둔다 — 시험과 기록에서
  // `x.toExponential(2)`를 그대로 쓰던 자리가 많다.
  toExponential(d = 2) {
    if (this.m === 0) return (0).toExponential(d);
    return `${this.m.toFixed(d)}e${this.e >= 0 ? '+' : ''}${this.e}`;
  }

  toFixed(d = 0) {
    if (this.e > 20 || this.e < -20) return this.toExponential(d);
    return this.toNumber().toFixed(d);
  }

  // **valueOf는 일부러 안 둔다.** 그게 있으면 `big * 2` 같은 실수가 조용히
  // 숫자로 떨어져 큰 수에서 Infinity가 된다. 없으면 바로 NaN이 되어
  // tests/nan.mjs가 그 자리를 짚어 준다 — 시끄러운 쪽이 낫다.

  // 글자를 되읽는다. 옛 세이브의 보통 숫자도 그대로 받는다.
  static parse(v) {
    if (v instanceof Big) return v;
    if (typeof v === 'number') return Big.fromNumber(v);
    // 어딘가에서 {m, e}로 흩어진 채 저장된 적이 있다(slimSave가 꾸러미로 보고
    // 쪼갰다). 그 세이브도 살려서 읽는다 — 안 그러면 재화가 0이 된다.
    if (v && typeof v === 'object'
      && Number.isFinite(v.m) && Number.isFinite(v.e)) return norm(v.m, v.e);
    if (typeof v !== 'string' || !v) return ZERO;
    const i = v.indexOf('e');
    if (i < 0) return Big.fromNumber(Number(v) || 0);
    const m = Number(v.slice(0, i));
    const e = Number(v.slice(i + 1));
    if (!Number.isFinite(m) || !Number.isFinite(e)) return ZERO;
    return norm(m, e);
  }
}

// 가수를 1 이상 10 미만으로 맞춘다. 여기를 안 거치면 비교가 어긋난다 —
// 10e5와 1e6은 같은 수인데 지수가 달라서 다른 수로 보인다.
function norm(m, e) {
  if (!Number.isFinite(m) || m === 0) {
    if (m === Infinity) return new Big(1, 1e308);
    if (m === -Infinity) return new Big(-1, 1e308);
    return ZERO;
  }
  const sign = m < 0 ? -1 : 1;
  const a = sign < 0 ? -m : m;
  let d = Math.floor(LOG10(a));
  let mm = a / Math.pow(10, d);
  // log10이 경계에서 한 칸 어긋나는 일이 있다(0.9999999 → 10.0000001)
  if (mm >= 10) { mm /= 10; d += 1; } else if (mm < 1) { mm *= 10; d -= 1; }
  return new Big(sign * mm, e + d);
}

export const ZERO = new Big(0, 0);
export const ONE = new Big(1, 0);

// 짧게 쓰는 이름. big(5), big('1.2e400'), big(otherBig) 다 된다.
export function big(v) {
  if (v instanceof Big) return v;
  if (typeof v === 'string') return Big.parse(v);
  return Big.fromNumber(v);
}

// 수인지 Big인지 모를 때 log10을 얻는다. 비율을 잴 때 쓴다.
export const log10Of = (v) => (v instanceof Big ? v.log10() : (v > 0 ? LOG10(v) : -Infinity));

// 숫자여도 Big이어도 되는 견줌 — 섞여 있는 동안 쓴다.
export const gte = (a, b) => big(a).gte(b);
export const lt = (a, b) => big(a).lt(b);
