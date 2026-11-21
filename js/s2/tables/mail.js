// v635 전서구 함(우편) — 놓친 보상 · 한 번 주는 선물을 한곳에. 기한 MAIL_KEEP(14일) · 많아야 MAIL_MAX통(넘으면 오래된 것부터 버린다)
//   받은 우편은 지운다. 자동 성장은 우편을 받지 않는다(빨간 점 → 직접 연다).
export const MAIL_KEEP = 14 * 24 * 3600e3, MAIL_MAX = 60;
// 선물 — 아직 안 받은 id는 모든 세이브(새 · 옛)에 한 번씩 온다. 더할 땐 줄만 늘린다(id는 바꾸지 않는다)
export const MAIL_GIFTS = [
  { id: 'welcome', title: '우편함이 생겼어요', rew: { 'ticket:gear': 5, 'item:stone': 30 } },
];
// 놓친 보상 우편 제목(n = 개수)
export const MAIL_TXT = {
  daily: (n) => `어제 일일 임무 — 못 받은 보상 ${n}개`,
  weekly: (n) => `지난주 주간 임무 — 못 받은 보상 ${n}개`,
  bounty: (n) => `어제 현상수배 — 못 받은 보상 ${n}개`,
  pvp: (tier) => `대결 주간 보상 — ${tier} 등급(못 받은 것)`,
};
