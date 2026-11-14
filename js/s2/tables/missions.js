// 새 시즌(S7) 길잡이 · 일일/주간 미션 · 업적 — 전부 진행 조건 엔진(core/quest.js) 한 벌로(계획서 §C · §H).
// 사건 종류: kill(n, boss, elite) · level(lv) · gacha(n) · enhance · star(s) · dungeon(kind) · equip · skill · realm(lv) · pull(sys, n) · login · offline · sweep · pvp · wboss
// 보상은 보상 번호(core/reward.js) — 여기선 사냥 분 상당(huntMin)과 물건 몇 개로 적는다.

// 길잡이 — 한 줄로 이어짐(지금 단계만 진행). 첫 30분(Lv15)에 1~11, 첫날 안에 전부. 정예 잡기는 뽑기 바로 다음(뽑기 10번마다 정예가 나오니까).
// 길잡이 보상은 은자(huntMin = 사냥 n분 상당 은자) · 물건 — 경험치는 주지 않는다: 첫 30분 레벨은 사냥이 정한다(곡선 J1) 강조할 화면(ui)과 바로가기(go)를 같이 적는다
export const GUIDE = [
  { id: 'g1', ev: 'kill', add: 'n', need: 5, ui: 'hunt', go: 'hunt', huntMin: 0.3 },
  { id: 'g2', ev: 'level', cond: 'lv >= 3', need: 1, ui: 'exp', huntMin: 0.3 },
  { id: 'g3', ev: 'equip', need: 1, ui: 'gearPanel', go: 'gear', huntMin: 0.3 },
  { id: 'g4', ev: 'gacha', add: 'n', need: 10, ui: 'gachaPanel', go: 'gacha', huntMin: 0.5, items: { 'ticket:gear': 10 } },
  { id: 'g5', ev: 'kill', cond: 'elite', need: 1, ui: 'elite', huntMin: 0.5 },
  { id: 'g6', ev: 'skill', need: 1, ui: 'skill', go: 'skill', huntMin: 0.5 },
  { id: 'g7', ev: 'level', cond: 'lv >= 10', need: 1, huntMin: 0.5 },
  { id: 'g8', ev: 'enhance', need: 3, ui: 'enhance', go: 'slot', huntMin: 0.5 },
  { id: 'g9', ev: 'dungeon', cond: 'job == 1', need: 1, ui: 'jobDungeon', go: 'job', huntMin: 0.5 },
  { id: 'g10', ev: 'pull', cond: "sys == 2", add: 'n', need: 10, ui: 'pal', go: 'pal', huntMin: 0.5 },
  { id: 'g11', ev: 'level', cond: 'lv >= 15', need: 1, huntMin: 0.5 },
  { id: 'g12', ev: 'kill', cond: 'boss', need: 1, ui: 'boss', huntMin: 1 },
  { id: 'g13', ev: 'pull', cond: "sys == 1", add: 'n', need: 10, ui: 'weapon', go: 'weapon', huntMin: 1 },
  { id: 'g14', ev: 'star', need: 1, ui: 'star', go: 'slot', huntMin: 1 },
  { id: 'g15', ev: 'offline', need: 1, ui: 'offline', huntMin: 1 },
  { id: 'g16', ev: 'level', cond: 'lv >= 20', need: 1, huntMin: 2 },
  { id: 'g17', ev: 'dungeon', cond: 'kind == 1', need: 1, ui: 'daily', go: 'daily', huntMin: 3 },
  { id: 'g18', ev: 'realm', cond: 'lv >= 1', need: 1, ui: 'realm', go: 'realm', huntMin: 3 },
  { id: 'g19', ev: 'level', cond: 'lv >= 30', need: 1, huntMin: 4 },
  { id: 'g20', ev: 'pull', cond: "sys == 3", add: 'n', need: 10, ui: 'relic', go: 'relic', huntMin: 4 },
  { id: 'g21', ev: 'level', cond: 'lv >= 50', need: 1, huntMin: 6 },
];
// 일일 미션(전부 하면 사냥 15분 상당 — tables/content.js DAILY_MISSION_MIN과 같음)
export const DAILY_MISSIONS = [
  { id: 'd_login', ev: 'login', need: 1, huntMin: 1 },
  { id: 'd_kill', ev: 'kill', add: 'n', need: 500, huntMin: 3 },
  { id: 'd_dungeon', ev: 'dungeon', need: 3, huntMin: 3, items: { 'ticket:time': 4 } },
  { id: 'd_gacha', ev: 'gacha', add: 'n', need: 30, huntMin: 2, items: { 'ticket:pal': 2 } },
  { id: 'd_star', ev: 'star', need: 3, huntMin: 2, items: { 'item:restore': 1 } },
  { id: 'd_boss', ev: 'kill', cond: 'boss', need: 2, huntMin: 2, items: { 'item:heart': 2 } },
  { id: 'd_offline', ev: 'offline', need: 1, huntMin: 2, items: { 'ticket:exped': 1 } },
];
export const WEEKLY_MISSIONS = [
  { id: 'w_login', ev: 'login', need: 5, huntMin: 20, items: { 'ticket:weapon': 5 } },
  { id: 'w_dungeon', ev: 'dungeon', need: 15, huntMin: 20, items: { 'ticket:relic': 5 } },
  { id: 'w_wboss', ev: 'wboss', need: 5, huntMin: 20 },
  { id: 'w_pvp', ev: 'pvp', need: 10, huntMin: 20 },
];
// 업적 — 단계형(같은 사건, 목표만 커짐)
export const ACHIEVE_STEPS = { kill: [1e3, 1e4, 1e5, 1e6], level: [50, 100, 120, 140, 150], star: [100, 500, 2000], pull: [100, 1000, 5000] };
export function achievements() {
  const out = [];
  for (const [ev, steps] of Object.entries(ACHIEVE_STEPS)) steps.forEach((need, i) => out.push({ id: `a_${ev}_${i}`, ev, add: ev === 'level' ? null : 'n', cond: ev === 'level' ? `lv >= ${need}` : null, need: ev === 'level' ? 1 : need, huntMin: 10 * (i + 1) }));
  return out;
}
export const dailyMissionMin = () => DAILY_MISSIONS.reduce((a, m) => a + m.huntMin, 0);
// 길잡이 지금 단계 — 받지 않은 첫 단계(다 받았으면 null)
export const guideCurrent = (st) => GUIDE.find((g) => !st[g.id]?.got) ?? null;
