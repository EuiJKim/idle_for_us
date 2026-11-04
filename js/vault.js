// v349 계정 창고 — 내 무인 넷(캐릭터 칸)이 함께 쓰는 창고. 은자 · 재료 · 장비(40칸).
//   기기에는 ifu.vault, Google이면 서버 saves/{uid}/vault/main 에도(무인 칸과 같은 곳). 더 새것(at)을 쓴다.
//   옮길 때는 늘 '빼는 쪽 먼저 저장 → 넣는 쪽 저장' — 도중에 꺼져도 하나가 둘이 되지는 않는다(잃을 수는 있어도 늘지 않게).
export const VAULT_ITEMS = 40;
const KEY = 'ifu.vault';
const empty = () => ({ gold: 0, mats: {}, items: [], at: 0 });
function clean(v) {
  const o = empty();
  if (!v || typeof v !== 'object') return o;
  o.gold = Math.max(0, Math.floor(Number(v.gold) || 0));
  for (const [k, n] of Object.entries(v.mats || {})) { const x = Math.floor(Number(n) || 0); if (x > 0 && k.length <= 24) o.mats[k] = x; }
  o.items = Array.isArray(v.items) ? v.items.filter((x) => x && typeof x === 'object' && x.slot).slice(0, VAULT_ITEMS) : [];
  o.at = Number(v.at) || 0;
  return o;
}
export function loadVault() { try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return empty(); } }
export function saveVault(v) { v.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } }
export function adoptVault(json) { const v = clean(JSON.parse(json)); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 자리가 없다 */ } return v; }
