// 상점 — 날마다 은자로 사는 물건(하루 살 수 있는 수가 정해져 있다 · 자정에 새로). 현금은 없다.
// 값은 「몹 몇 마리 몫 은자」(mobs × goldPerMob(무인 레벨)) — 레벨이 올라도 사냥 시간으로 치면 같은 값.
//   사냥 한 시간 = 1620마리 몫. 다 사면 3200마리 몫(두 시간이 조금 안 됨) · 하루에 얻는 양은 적게(성장 곡선은 그대로).
//   덤(free)은 값 없이 하루 한 번.
import { goldPerMob } from './gearstat.js';
export const SHOP = [
  { id: 'free', name: '오늘의 덤', give: { 'ticket:gear': 1 }, mobs: 0, limit: 1 },
  { id: 'gear', name: '장비 뽑기권', give: { 'ticket:gear': 1 }, mobs: 300, limit: 5 },
  { id: 'weapon', name: '병기 뽑기권', give: { 'ticket:weapon': 1 }, mobs: 240, limit: 1 },
  { id: 'pal', name: '동료 뽑기권', give: { 'ticket:pal': 1 }, mobs: 240, limit: 1 },
  { id: 'relic', name: '영물 뽑기권', give: { 'ticket:relic': 1 }, mobs: 240, limit: 1 },
  { id: 'stone', name: '강화석 꾸러미', give: { 'item:stone': 20 }, mobs: 100, limit: 3 },
  { id: 'time', name: '시간 티켓', give: { 'ticket:time': 1 }, mobs: 480, limit: 1 },
  { id: 'exped', name: '원정권', give: { 'ticket:exped': 1 }, mobs: 200, limit: 1 },
];
for (const s of SHOP) s.cost = (lv) => s.mobs * goldPerMob(lv);
export const SHOP_FREE = 'free';
export const shopById = (id) => SHOP.find((s) => s.id === id);
