// 극(10^48)에서 끊겨 있었다. 그 위로 가면 '1.00e60'이 떠서 읽을 수가 없다.
// 항하사·아승기·나유타까지 늘려 10^60까지 한글로 읽힌다 — 몇 주를 해도 안 깨진다.
// 이름이 길어지는 그 위(불가사의·무량대수)는 칸을 넘치므로 안 쓴다.
const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극',
  '항하사', '아승기', '나유타'];

// 큰 수를 한국식 단위로: 12,345 → 1.23만, 1.5e9 → 15.0억
export function fmt(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 100 && n % 1 >= 0.05) return (Math.floor(n * 10) / 10).toString();
  if (n < 10000) return Math.floor(n).toLocaleString('ko-KR');
  const idx = Math.floor(Math.log10(n) / 4);
  if (idx >= UNITS.length) return n.toExponential(2).replace('e+', 'e');
  const v = n / Math.pow(10, idx * 4);
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString();
  return s + UNITS[idx];
}

export const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

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
