// 세력과 고수 (v148) — 지도를 무림맹 · 사파 · 마교 · 십이지왕으로 나누고, 세력마다 고수들과 비무한다.
//
// 사냥터는 세 세력에 나눠 담되 **세력마다 낮은 곳부터 높은 곳까지 섞여 있다** — 어느 세력을 골라도 클 수 있게.
// 고수마다 두목 방이 있다(wdata 지역 41~): 수하 졸개가 늘 있고 고수가 45초마다 다시 나서 눌러앉아 파밍한다.
// 고수·십이지왕은 설정집의 독문무공(skills)으로 바닥 경고를 깐다 — 직접 끌어 피하거나, 방치 중엔 조금 늦게 피한다.
//
// 강함(레벨) — 십이지왕은 99~150, 제1왕 검왕이 가장 세다(146~150).
//   정파·사파 칠대고수  45 → 135 (세력 안에서 차례로 오른다)
//   마교 팔마존         100 → 150 (십이지왕급)
//   무림맹주 진패천 160 · 사도맹주 백자강 162 — 검왕보다 세다
//   천마 검우진 175 — 두 맹주보다 세다
// 체력·공격은 두목 공식(그 레벨) 그대로, 맹주·천마는 LORD_HP·LORD_ATK배 — 레벨 150이 끝이라 맹주·천마는 장비로 넘어야 한다.
//
// 이야기는 원작(절대회귀)의 인물을 빌려 줄여 썼고, 원작에 자리만 있고 이야기가 없는 정파 고수 몇은 이 게임에서 지었다.
import { mobGold, expToNext, LEVEL_MAX } from './wdata.js';
import { zoneForLv, TOWER_MAX } from './wdgn.js';
import { FACTIONS, FAC_ZONES, MASTERS, OTHER_LORE, KING_STORY, KING_SKILLS } from './wmasters_data.js';
export { FACTIONS, FAC_ZONES, MASTERS, OTHER_LORE, KING_STORY, KING_SKILLS };

export const factionOf = (id) => FACTIONS.find((f) => f.id === id) || null;
export function factionOfZone(z) {
  for (const [f, list] of Object.entries(FAC_ZONES)) if (list.includes(z)) return f;
  return null;
}
export const masterOf = (id) => MASTERS.find((m) => m.id === id) || null;
export const mastersOf = (fac) => MASTERS.filter((m) => m.fac === fac);
// ---------- 숫자 ----------
// 탑의 층으로 치면 몇 층쯤 (경고가 얼마나 빨리 터지나 · 얼마나 아프나)
export const floorOf = (lv) => Math.max(1, Math.min(TOWER_MAX, Math.round((lv - 2) / 1.24)));
// 처음 쓰러뜨리면: 은자 · 그 레벨 재료와 증표 · 경험치, 그리고 영구히 공격력·체력 (고수 +1% · 맹주·천마 +3%)
export const MASTER_BONUS = 0.01;
export const LORD_BONUS = 0.03;
export const masterBonusOf = (m) => (m.lord ? LORD_BONUS : MASTER_BONUS);
export function masterReward(m) {
  const z = zoneForLv(Math.min(m.lv, 150));
  const k = m.lord ? 3 : 1;
  return {
    gold: Math.round(mobGold(m.lv) * 600 * k),
    exp: Math.round(expToNext(Math.min(m.lv, LEVEL_MAX)) * 0.25 * k),
    mats: { [z]: 200 * k, [`b${z}`]: 10 * k },
  };
}
