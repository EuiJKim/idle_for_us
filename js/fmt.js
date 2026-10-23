// 한글 단위는 **극(10^48)까지만** 쓴다.
// 그 위는 항하사·아승기·나유타처럼 이름이 세 글자라 칸을 넘치고, 읽어도
// 어느 쪽이 큰지 바로 안 온다. 그 위부터는 알파벳으로 센다 —
// a · b · c … z 다음은 aa · ab · ac … 끝이 없다.
const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극'];

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

// 한 칸이 만(10^4)씩이다. 한글 단위가 끝나면 알파벳이 그 자리를 이어받는다.
export const bigUnit = (idx) => (idx < UNITS.length ? UNITS[idx] : alphaUnit(idx - UNITS.length));

// 큰 수를 읽기 좋게: 12,345 → 1.23만, 1.5e9 → 15.0억, 1e56 → 1.00b
//
// 보통 숫자도 Big도 받는다. Big은 10^308 위로도 가므로 **자릿수부터 본다** —
// toNumber()를 먼저 부르면 거기서 Infinity가 되어 버린다.
export function fmt(n) {
  if (n && typeof n === 'object' && typeof n.e === 'number') return fmtBig(n);
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 100 && n % 1 >= 0.05) return (Math.floor(n * 10) / 10).toString();
  if (n < 10000) return Math.floor(n).toLocaleString('ko-KR');
  const idx = Math.floor(Math.log10(n) / 4);
  const v = n / Math.pow(10, idx * 4);
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString();
  return s + bigUnit(idx);
}

// 가수·지수로 쪼개 든 수. 작으면 보통 길로 넘기고, 크면 자릿수로 센다.
function fmtBig(b) {
  if (b.m === 0) return '0';
  if (b.m < 0) return '-' + fmtBig({ m: -b.m, e: b.e });
  if (b.e < 300) return fmt(b.m * Math.pow(10, b.e));
  const L = b.e + Math.log10(b.m);           // 전체 자릿수
  const idx = Math.floor(L / 4);
  const v = Math.pow(10, L - idx * 4);
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString();
  return s + bigUnit(idx);
}

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
