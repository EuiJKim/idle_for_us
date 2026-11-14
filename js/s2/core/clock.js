// 새 시즌(S0) 게임 시계 — 엔진 안의 시간은 ms 정수로만 흐른다(계획서 §L3).
// 화면 프레임 시간(실수)을 그대로 쓰지 않고, 고정 틱(50ms)으로 잘라 엔진에 넘긴다 → 같은 입력이면 같은 결과.
export const TICK_MS = 50;

export class GameClock {
  constructor(ms = 0) { this.ms = ms | 0; this.acc = 0; }
  // 프레임마다 흐른 실제 시간(ms, 실수)을 넣으면, 돌려야 할 틱 수를 준다(한 번에 최대 maxTicks)
  feed(dtMs, maxTicks = 40) {
    this.acc += Math.max(0, dtMs);
    let n = Math.floor(this.acc / TICK_MS);
    if (n > maxTicks) { n = maxTicks; this.acc = 0; } else this.acc -= n * TICK_MS;
    return n;
  }
  tick() { this.ms += TICK_MS; return this.ms; }
}
