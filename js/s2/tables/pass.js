// 강호 패스 — 4주짜리 긴 목표 줄(값 없이 누구나 · 현금은 없다). 놀면 패스 점수가 쌓이고 100점마다 한 단, 서른 단.
//   점수는 하루 150점까지(꾸준히 하면 3주쯤) · 4주가 지나면 새 시즌(안 받은 보상은 사라진다).
//   보상은 적게 — 다 받아도 장비 뽑기권 40 · 병기·동료·영물 뽑기권 9 · 시간 티켓 2(4주 벌이에 견주면 작다 · 성장 곡선은 그대로).
//   goldMin = 사냥 n분 몫 은자(그때 무인 레벨로 · 경험치는 주지 않는다)
export const PASS = { weeks: 4, tiers: 30, need: 100, dayCap: 150, first: 742 };   // first: 처음 연 시즌 번호(화면에는 1시즌부터)
// 점수 — 일일 임무 받기 · 주간 임무 받기 · 출석 · 수련동 깨기 · 스테이지 두목 · 월드보스 · 대결 · 동행 토벌
export const PASS_PTS = { daily: 10, weekly: 30, attend: 10, dungeon: 5, stage: 5, wboss: 10, duel: 5, party: 10 };
const G = (n) => ({ 'ticket:gear': n }), ST = (n) => ({ 'item:stone': n }), M = (n) => ({ goldMin: n });
export const PASS_REWARDS = [
  G(2), ST(20), M(10), G(2), { 'ticket:weapon': 2 },
  G(2), ST(20), M(10), G(3), { 'ticket:time': 1 },
  G(2), ST(30), M(15), G(3), { 'ticket:pal': 2 },
  G(2), ST(30), { 'ticket:exped': 1 }, G(3), { 'ticket:time': 1 },
  G(2), ST(40), M(20), G(3), { 'ticket:relic': 2 },
  G(3), ST(40), { 'ticket:exped': 1 }, G(3),
  { 'ticket:gear': 10, 'ticket:weapon': 1, 'ticket:pal': 1, 'ticket:relic': 1 },
];
// 다 받았을 때 합(시험 · 화면 안내)
export const passTotal = () => PASS_REWARDS.reduce((a, r) => { for (const [k, n] of Object.entries(r)) a[k] = (a[k] || 0) + n; return a; }, {});
