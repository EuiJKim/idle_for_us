// 새 시즌 숫자 초안 — 보상량 · 대기 시간 · 방치(계획서 §I · §J5 · §J6).
// 보상량 단위: 「적정 사냥터 1시간」 = 1. 실제 양은 레벨별 사냥 1시간 벌이(S2 시뮬로 확정)에 곱한다.
export const REWARD_UNITS = {
  hunt1h: { gold: 1, exp: 1 },
  offline1h: { gold: 0.7, exp: 0.7 },
  dailyDungeons: { gold: 1.5, exp: 1 },      // 수련동 4종 × 3회(은자 던전·성장 던전 몫, 장비·강화석 던전은 재료)
  dailyMissions: { gold: 0.5, exp: 0.3 },
  worldBossDay: { gold: 0.3, exp: 0 },
  pvpDay: { gold: 0.2, exp: 0 },
  expedition8h: { gold: 2, exp: 1 },
};
// 은자 소비 몫(하루 수입 대비) — 비용을 이 몫에 맞춘다
export const GOLD_SINK_SHARE = { gearGacha: 0.5, starEnhance: 0.3, skill: 0.1, realm: 0.1 };

// 오프라인
export const OFFLINE_CAP_H = 12;
export const OFFLINE_WEEK_CAP_H = 84;
export const OFFLINE_AD_X = 2, OFFLINE_AD_PER_DAY = 3;

// 대기 시간(분)
export const realmWaitMin = (n) => Math.min(12 * 60, n * 20);
export const MASTERY_NODE_WAIT_MIN = [5, 8 * 60];      // 노드 깊이에 따라 사이
export const GUILD_RESEARCH_WAIT_MIN = [60, 24 * 60];
export const JOURNEY_STEP_WAIT_MIN = [30, 6 * 60];
// 시간 티켓: 하루 미션으로 60분 · 광고 15분 × 하루 4번
export const TIME_TICKET_DAILY_MIN = 60, TIME_TICKET_AD_MIN = 15, TIME_TICKET_AD_PER_DAY = 4;

// 처치 시간 목표(초) — 몹 체력 = 기준 무인 기대 DPS × 목표 초 (§J3)
export const KILL_SEC = { mob: 1.2, elite: 8, boss: 45, worldBossStage: 180 };
export const SURVIVE_HITS = { mob: 40, boss: 8 };
export const TIER_HP_X = [1, 1.6, 2.5];      // 공격은 이 배율의 절반만 더한다
