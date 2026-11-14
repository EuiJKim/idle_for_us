// 새 시즌(S0) 결정론 난수 — 같은 씨앗이면 어느 기기·서버에서 돌려도 같은 결과(계획서 §L3).
// sfc32: 32비트 정수만 쓴다(Math.random 금지). 상태 네 칸을 그대로 저장·복원할 수 있다(입력 기록·재현 검증).
export class Rng {
  constructor(seed = 1) {
    if (Array.isArray(seed)) { [this.a, this.b, this.c, this.d] = seed.map((v) => v >>> 0); return; }
    // 씨앗 하나를 네 칸으로 펼친다(splitmix32)
    let s = seed >>> 0;
    const mix = () => { s = (s + 0x9e3779b9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
    this.a = mix(); this.b = mix(); this.c = mix(); this.d = mix();
    for (let i = 0; i < 12; i++) this.u32();
  }
  // 0 ~ 2³²-1
  u32() {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }
  // 0 ~ n-1 (치우침 없이 — 남는 꼬리는 다시 뽑는다)
  int(n) {
    n = n >>> 0;
    if (n <= 1) return 0;
    const lim = 0x100000000 - (0x100000000 % n);
    let v;
    do { v = this.u32(); } while (v >= lim);
    return v % n;
  }
  // lo ~ hi (둘 다 포함)
  range(lo, hi) { return lo + this.int(hi - lo + 1); }
  // 퍼밀 판정: p/1000 확률로 참 (p ≤ 0 거짓 · p ≥ 1000 참)
  roll(p) { return p >= 1000 ? true : p <= 0 ? false : this.int(1000) < p; }
  // 가중치 고르기: [{w, ...}] → 고른 칸의 번호. 가중치는 정수.
  pick(weights) {
    let sum = 0;
    for (const w of weights) sum += w;
    if (sum <= 0) return -1;
    let r = this.int(sum);
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
  state() { return [this.a, this.b, this.c, this.d]; }
}
