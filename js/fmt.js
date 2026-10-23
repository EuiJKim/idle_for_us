// 큰 수는 **알파벳 단위**로 쓴다 (2026-10-23).
// 전에는 만·억·조·경 … 극까지 한글로 세고 그 위를 알파벳으로 셌다. 한글 단위는
// 어느 쪽이 큰지 바로 안 들어오고(경과 해 중 뭐가 크지?) 칸도 들쭉날쭉했다.
//
//   1,000 = 1a · 100a = 1b · 100b = 1c … z 다음은 aa · ab … 끝이 없다.
//
// **한 글자가 100배다** (보통 방치형은 1000배). 앞자리가 늘 1~99.9라
// 짧고, 글자만 보고도 몇 칸 차이인지 바로 센다.
export const UNIT_BASE = 3;   // 1a = 10^3
export const UNIT_STEP = 2;   // 한 글자 = 10^2

// 0→a, 25→z, 26→aa, 27→ab … 엑셀 열 이름과 같은 셈법이다.
export function alphaUnit(i) {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
export const bigUnit = (idx) => alphaUnit(idx);

// 자릿수 L(= log10)짜리 수를 '앞자리 + 글자'로. 앞자리는 내림한다 —
// 반올림하면 99.96a가 '100.0a'로 찍혀 '100a 다음은 1b'가 깨진다.
// log10을 거쳐 오면 99000이 98.9999…로 와서 내림하면 98.9a가 된다. 아주 조금 얹는다.
function unitText(L0) {
  const L = L0 + 1e-9;
  const idx = Math.floor((L - UNIT_BASE) / UNIT_STEP);
  const v = Math.pow(10, L - UNIT_BASE - idx * UNIT_STEP);
  const s = v < 10 ? (Math.floor(v * 100 + 1e-6) / 100).toFixed(2) : (Math.floor(v * 10 + 1e-6) / 10).toFixed(1);
  return s + alphaUnit(idx);
}

// 큰 수를 읽기 좋게: 999 → 999, 1,500 → 1.50a, 250,000 → 25.0b
//
// 보통 숫자도 Big도 받는다. Big은 10^308 위로도 가므로 **자릿수부터 본다** —
// toNumber()를 먼저 부르면 거기서 Infinity가 되어 버린다.
export function fmt(n) {
  if (n && typeof n === 'object' && typeof n.e === 'number') return fmtBig(n);
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 100 && n % 1 >= 0.05) return (Math.floor(n * 10) / 10).toString();
  if (n < 1000) return Math.floor(n).toString();
  return unitText(Math.log10(n));
}

// 가수·지수로 쪼개 든 수. 작으면 보통 길로 넘기고, 크면 자릿수로 센다.
function fmtBig(b) {
  if (b.m === 0) return '0';
  if (b.m < 0) return '-' + fmtBig({ m: -b.m, e: b.e });
  if (b.e < 300) return fmt(b.m * Math.pow(10, b.e));
  return unitText(b.e + Math.log10(b.m));
}

// 무공 설명의 배율. 작으면 소수 자리까지, 1000을 넘으면 알파벳 단위로.
export const mx = (m, d = 0) => (m >= 1000 ? fmt(m) : m.toFixed(d));

// 백분율. **큰 수가 들어오면 지수가 날것으로 샌다** — 화면에
// "+1.0815362334304659e+24%"가 찍힌 적이 있다. 100을 넘으면 fmt에 맡긴다.
export function pct(x) {
  if (x && typeof x === 'object' && typeof x.e === 'number') {
    return x.e >= 2 ? `${fmt(x.mul(100))}%` : pct(x.toNumber());
  }
  if (!Number.isFinite(x)) return '∞%';
  const v = x * 100;
  if (Math.abs(v) >= 1e5) return `${fmt(v)}%`;
  return `${v.toFixed(Math.abs(x) < 0.1 ? 1 : 0)}%`;
}

export function duration(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}시간 ${m}분`;
  if (m) return `${m}분`;
  return `${sec}초`;
}

export function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
