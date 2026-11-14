// 새 시즌(S1) 진행 조건 — 미션·길잡이·돌발 미션·패스·업적이 같은 엔진(계획서 §C).
// 할 일 하나: { id, ev:'사건 종류', cond:'식'(사건 값으로 거를 때), add:'식'(한 번에 올릴 양, 기본 1), need:수, reward:'보상 번호' }
// 사건이 오면 → 맞는 할 일의 진행을 올리고 → need에 닿으면 「끝남」(보상은 받기 단추로)
import { calc } from './expr.js';

export class QuestBook {
  constructor(defs = [], st = {}) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
    this.st = st;            // { [id]: { p: 진행, done: 끝, got: 받음 } } — 세이브에 그대로
  }
  get(id) { return (this.st[id] ??= { p: 0, done: false, got: false }); }
  // 사건: ev 종류 + 값 묶음(v). 끝난 할 일 id 목록을 돌려준다
  on(ev, v = {}) {
    const ctx = (n) => v[n] ?? 0;
    const fin = [];
    for (const d of this.defs.values()) {
      if (d.ev !== ev) continue;
      const s = this.get(d.id);
      if (s.done) continue;
      if (d.cond && !calc(d.cond, ctx)) continue;
      s.p = Math.min(d.need, s.p + calc(d.add, ctx, 1));
      if (s.p >= d.need) { s.done = true; fin.push(d.id); }
    }
    return fin;
  }
  claimable() { return [...this.defs.keys()].filter((id) => this.get(id).done && !this.get(id).got); }
  // 받기 — 보상 번호를 돌려주고 받음 표시(실제 지급은 부르는 쪽이 reward.js로)
  claim(id) {
    const s = this.get(id), d = this.defs.get(id);
    if (!d || !s.done || s.got) return null;
    s.got = true;
    return d.reward ?? null;
  }
  // 초기화(일일·주간) — 해당 id들만
  reset(ids) { for (const id of ids) this.st[id] = { p: 0, done: false, got: false }; }
}
