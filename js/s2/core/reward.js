// 새 시즌(S1) 보상 — 모든 보상은 「보상 번호」 하나(계획서 §C). 뽑기·상자·던전·미션이 같은 길로.
// 표: { roll:'all'|'one', items:[{k, n, p}], pity?:{need, item}, dupe?:{k: {max, to:{k,n}}} }
//   roll 'all' : 줄마다 p(퍼밀) 확률로 따로 굴림(p 없으면 확정)
//   roll 'one' : p를 가중치로 하나만 고름
//   pity      : 이 보상을 need번 굴리는 동안 item이 안 나오면 need번째에 item 확정(나오면 0부터)
//   dupe      : 이미 max개 넘게 가진 것이 나오면 to로 바꿔 줌(중복 대체)
import { merge } from './cost.js';

const TABLES = new Map();
export const defineReward = (id, t) => { TABLES.set(id, t); return id; };
export const rewardTable = (id) => TABLES.get(id);

// st: 보상 상태 { pity: { [id]: 횟수 } } · owned(k): 지금 가진 개수 · rng: core/rng.js
export function rollReward(id, rng, st = {}, owned = () => 0) {
  const t = TABLES.get(id);
  if (!t) throw new Error(`없는 보상: ${id}`);
  let got = [];
  if (t.roll === 'one') {
    const i = rng.pick(t.items.map((x) => x.p ?? 1));
    if (i >= 0) got.push(t.items[i]);
  } else {
    for (const x of t.items) if (x.p == null || rng.roll(x.p)) got.push(x);
  }
  got = got.map((x) => ({ k: x.k, n: Array.isArray(x.n) ? rng.range(x.n[0], x.n[1]) : x.n }));
  if (t.pity) {
    st.pity ??= {};
    const hit = got.some((x) => x.k === t.pity.item.k);
    const c = (st.pity[id] || 0) + 1;
    if (hit) st.pity[id] = 0;
    else if (c >= t.pity.need) { got.push({ ...t.pity.item }); st.pity[id] = 0; }
    else st.pity[id] = c;
  }
  if (t.dupe) {
    got = got.map((x) => {
      const d = t.dupe[x.k];
      return d && owned(x.k) >= d.max ? { ...d.to, from: x.k } : x;
    });
  }
  return merge(got);
}
// 천장까지 남은 횟수(화면 게이지)
export const pityLeft = (id, st = {}) => { const t = TABLES.get(id); return t?.pity ? t.pity.need - (st.pity?.[id] || 0) : null; };
