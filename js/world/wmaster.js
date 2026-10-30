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
import { FACTIONS, FAC_ZONES, MASTERS, OTHER_LORE, KING_STORY, KING_SKILLS, BOSS_PATTERNS } from './wmasters_data.js';
export { FACTIONS, FAC_ZONES, MASTERS, OTHER_LORE, KING_STORY, KING_SKILLS, BOSS_PATTERNS };
// v168 두목 초식 꼴 — 십이지왕(번호)과 레벨 100 넘는 고수(id). 없으면 null(옛 방식: 최대 체력의 몇 할)
export function bossPatterns(map) {
  if (map?.king) return BOSS_PATTERNS[map.king.no] || null;
  if (map?.master) { const m = MASTERS.find((x) => x.id === map.master); return m && m.lv >= 100 ? BOSS_PATTERNS[m.id] || null : null; }
  return null;
}
// 초식 한 대의 고정 피해 — 그 레벨 기준 무인(REF_HP)의 PAT_K배 × 배수. 오의는 PAT_ULT배, 맹주·천마는 PAT_LORD배.
// 기준 무인은 보통 초식에 반쯤, 오의에 거의 다 깎인다 — 체력·방어를 올린 무인은 버티고, 아니면 쓰러진다.
export const PAT_K = 0.5, PAT_ULT = 1.8, PAT_LORD = 1.2;
// v170: 초식 두목(십이지왕 · 레벨 100 넘는 고수)은 체력 ×PAT_HP — 흔한 차림이 13초쯤에 잡아 초식을 한두 번밖에 못 썼다.
// 맹주·천마는 이미 LORD_HP로 단단해서 그대로.
export const PAT_HP = 4;
export const patternHpMult = (map) => (bossPatterns(map) && !map.lord ? PAT_HP : 1);

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
