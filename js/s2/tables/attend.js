// v536 출석 — 28일 달력(하루 한 번 · 빠진 날은 건너뛰지 않고 다음 칸) · 28일을 다 채우면 처음부터 다시.
// 보상 칸: gold(사냥 n분 상당 은자) · 물건(k: 개수) · gear(확정 장비 등급 g, up 1이면 上) · title(칭호)
export const ATTEND_DAYS = 28;
const G = (m) => ({ goldMin: m });
export const ATTEND = [
  null,
  G(30), { 'item:stone': 40 }, { 'ticket:gear': 5 }, { 'ticket:weapon': 3 }, { 'ticket:time': 4 }, { 'item:stone': 60 }, { 'ticket:gear': 20, big: 1 },
  G(40), { 'item:stone': 50 }, { 'ticket:pal': 3 }, { 'ticket:gear': 8 }, { 'item:restore': 1 }, { 'item:stone': 80 }, { gear: { g: 3, up: 1 }, big: 1 },
  G(50), { 'item:stone': 60 }, { 'ticket:relic': 3 }, { 'ticket:gear': 10 }, { 'ticket:time': 8 }, { 'item:stone': 100 }, { 'item:stone': 200, 'ticket:gear': 20, big: 1 },
  G(60), { 'item:stone': 80 }, { 'ticket:weapon': 5 }, { 'ticket:gear': 12 }, { 'ticket:pal': 5 }, { 'item:stone': 120 }, { gear: { g: 4, up: 0 }, title: '28일 개근', big: 1 },
];
export const ATTEND_NAME = { 'item:stone': '강화석', 'ticket:gear': '장비 뽑기권', 'ticket:weapon': '병기 뽑기권', 'ticket:pal': '동료 뽑기권', 'ticket:relic': '영물 뽑기권', 'ticket:time': '시간 티켓', 'item:restore': '복구 주문서' };
