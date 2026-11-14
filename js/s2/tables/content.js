// 새 시즌(S6) 콘텐츠 숫자 — 던전 깃발 · 클리어 조건 · 수련동 · 전직 던전 · 성혼 필드 · 무한 탑 · 원정 · 돌발 미션 · 스태미나(계획서 §H · §I).
// 보상량은 「사냥 분 상당」으로 적는다 — 실제 경험치·은자는 그 레벨 사냥 벌이에 곱한다(경험치 곡선의 하루 +138분 가정과 맞춘다).

// 던전 규칙 깃발 — 던전마다 켜고 끔
export const FLAGS = ['noDie', 'noRepeat', 'forceAuto', 'noPal', 'noPotion', 'bossMeter', 'rush', 'killScore', 'noSkillSlot'];
// 클리어 조건 8종
export const CLEAR = ['kills', 'boss', 'wipe', 'survive', 'collect', 'reach', 'score', 'timeoutWin'];

// 스태미나 — 수련동·성혼 필드 입장권(종류 둘)
export const STAMINA = {
  daily: { max: 12, regenMin: 120, start: 12, overflow: 24 },   // 2시간마다 1 · 최대 12(충전으로 24까지 넘침 허용)
  field: { max: 6, regenMin: 240, start: 6, overflow: 12 },
};
export const STAMINA_RECHARGE_PER_DAY = 3;            // 하루 충전 한도(광고·미션 보상)

// 수련동 4종 — 하루 입장 3회씩(입장권 1) · 단계 = 무인 레벨 따라 · 보상은 사냥 분 상당
export const DAILY_DUNGEONS = {
  gold: { name: '은자굴', clear: 'kills', need: 60, timeMs: 90000, reward: { goldMin: 30 }, unlockLv: 20 },
  gear: { name: '병장고', clear: 'boss', timeMs: 120000, reward: { gearTickets: 6 }, unlockLv: 25 },
  stone: { name: '단련동', clear: 'survive', timeMs: 60000, reward: { stones: 40 }, unlockLv: 30 },
  growth: { name: '수련장', clear: 'wipe', timeMs: 90000, reward: { expMin: 15 }, unlockLv: 35 },
};
export const DAILY_RUNS = 3;
// 전직 던전 — 차수마다(레벨은 progress.js JOB_LV) · 두목 처치 · 보스 체력 배율
export const JOB_DUNGEON = [null, { hpX: 0.6 }, { hpX: 0.8 }, { hpX: 1 }, { hpX: 1.2 }, { hpX: 1.4 }];
// 성혼 필드 — 칸 별 합(10칸)이 기준 이상이면 들어감 · 경험치 배율
export const STAR_FIELDS = [
  { need: 50, lv: 90, expX: 1.15 }, { need: 120, lv: 105, expX: 1.25 }, { need: 160, lv: 120, expX: 1.35 }, { need: 190, lv: 135, expX: 1.5 },
];
// 무한 탑 — 층마다 몹 강함 ×1.06 · 층 보상(영구 보너스 작게: 공격%① +1 · 체력% +1 · 10층마다 뽑기권)
export const TOWER_MAX = 300, TOWER_STEP_X = 1.06, TOWER_BONUS = { atkL1: 1, hpP: 1 };
// 원정 — 티켓(4·8·12시간) · 시간 × 효율 · 하루 티켓 1장
export const EXPEDITION = { hours: [4, 8, 12], rate: 0.15, ticketsPerDay: 1 };   // 1시간 = 사냥 9분 상당
// 돌발 미션 — 사냥 중 분당 확률(퍼밀) · 시간 제한 · 보상(사냥 분 상당)
export const SUDDEN = { perMinP: 8, limitMin: 10, extendMin: 5, rewardMin: 6 };
// 일일 미션 묶음(전부) — 보상 사냥 분 상당
export const DAILY_MISSION_MIN = 15;
// 하루 콘텐츠 몫(사냥 분 상당) — 경험치 곡선의 「둘째 날부터 +138」과 맞아야 한다(시험이 본다)
export function dailyContentMin() {
  const dd = DAILY_DUNGEONS.growth.reward.expMin * DAILY_RUNS;          // 수련장(경험치)
  const exped = 8 * 60 * EXPEDITION.rate;                                // 8시간 원정
  const sudden = (SUDDEN.perMinP / 1000) * 120 * SUDDEN.rewardMin;       // 접속 2시간 중 돌발 미션
  return dd + exped + sudden + DAILY_MISSION_MIN;
}
