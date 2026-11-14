// 새 시즌(S1) 비용 — 모든 비용은 「종류 + 양」 목록 하나(계획서 §C).
// 종류: 'gold' · 'item:<id>' · 'stamina:<id>' · 'ticket:<id>' … 지갑(wallet)은 { 종류: 양 } 한 묶음.
export const norm = (cost) => (Array.isArray(cost) ? cost : cost ? [cost] : []).filter((c) => c && c.n > 0).map((c) => ({ k: String(c.k), n: Math.floor(c.n) }));
// 같은 종류는 합친다
export function merge(...costs) {
  const m = new Map();
  for (const c of costs.flatMap(norm)) m.set(c.k, (m.get(c.k) || 0) + c.n);
  return [...m].map(([k, n]) => ({ k, n }));
}
export const scale = (cost, x) => norm(cost).map((c) => ({ k: c.k, n: Math.floor(c.n * x) }));
// 모자란 것 목록(없으면 빈 목록) — 화면은 이걸로 「얻는 곳」 바로가기를 띄운다
export const shortfall = (wallet, cost) => merge(cost).filter((c) => (wallet[c.k] || 0) < c.n).map((c) => ({ k: c.k, need: c.n, have: wallet[c.k] || 0 }));
export const canPay = (wallet, cost) => shortfall(wallet, cost).length === 0;
// 낸다 — 모자라면 아무것도 빼지 않고 거짓
export function pay(wallet, cost) {
  if (!canPay(wallet, cost)) return false;
  for (const c of merge(cost)) wallet[c.k] -= c.n;
  return true;
}
export function gain(wallet, items) {
  for (const c of merge(items)) wallet[c.k] = (wallet[c.k] || 0) + c.n;
  return wallet;
}
