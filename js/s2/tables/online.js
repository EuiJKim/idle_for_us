// 새 시즌(S8) 온라인 숫자 — 전투력 · 월드보스 · 대결 · 문파 · 서열(계획서 §F · §H6~8 · §L5).

// 전투력(§F1): 같은 레벨 기준 상대에게 기대 DPS와 유효 체력을 가중 곱. 사냥은 DPS 쪽, 대결은 반반.
//   「전투력 10% 오르면 처치 시간 약 9% 줄어듦」이 합격선(시험이 본다).
export const POWER_W = { pve: { dps: 0.92, ehp: 0.08 }, pvp: { dps: 0.5, ehp: 0.5 } };
export const POWER_K = 10;          // 보기 좋게 곱하는 수

// 월드보스: 단계마다 체력(기준 무인이 3분) × 1.5배씩 · 하루 3번 · 한 번 90초
export const WBOSS = { tries: 3, fightMs: 90000, phaseSec: 180, phaseX: 1.5, phases: 12 };
// 보스 점수 구간표 — 피해(기준 무인 90초 피해 대비 배수 r)를 점수로. 큰 피해일수록 제곱근으로 덜 오름
//   [r 위쪽 끝, 지수 e] : 구간 안에서 점수 ∝ r^e(1 그대로 · 0.5 제곱근 · 0.25 네제곱근) — 이음매에서 기울기를 이어 붙인다
export const WB_SEG = [[1, 1], [16, 0.5], [Infinity, 0.25]];
export const WB_SCORE_UNIT = 10000;  // r = 1이면 1만 점
// 입힌 체력 비율 보상(서버 전체가 깎은 비율) — 단계 깰 때마다 모두에게
export const WB_PHASE_REWARD_MIN = 6;        // 사냥 분 상당(계획서 하루 0.3 + 재료)

// 대결: 하루 공격 5번 · 점수식 · 티어
export const PVP = { triesPerDay: 5, start: 1000, win: 20, lose: 12, defWin: 3, defLose: 8, gapK: 0.5, gapMax: 12, fightMs: 60000 };
export const PVP_TIERS = [
  { min: 0, name: '하수' }, { min: 1100, name: '중수' }, { min: 1250, name: '고수' }, { min: 1400, name: '절정' },
  { min: 1600, name: '초절정' }, { min: 1850, name: '화경' }, { min: 2150, name: '현경' },
];
export const PVP_MATCH = { range: 120, widen: 80, maxTries: 4 };

// 문파: 콘텐츠 3개를 같은 7창 세트로
export const WINDOW_SET = ['enter', 'info', 'reward', 'rank', 'log', 'shop', 'result'];
export const GUILD = {
  baseMembers: 20, membersPerHall: 2, hallMax: 10,
  research: { maxLv: 10, waitH: (lv) => Math.min(24, lv * 2 + 1) },   // 1~21시간(최대 24)
  help: { perHelpP: 10, minMs: 3 * 60000, maxHelps: 10, perDayGive: 10 },  // 도움 한 번 = 남은 시간 1% 또는 3분 중 큰 것
  raid: { phaseX: 1.4, weekTries: 7 },        // 문파 토벌(주간 공동 두목)
  war: { winPts: 3, drawPts: 1 },             // 문파 대항(주간 짝 · 점수 합)
  train: { goalPerMember: 100, rewardMin: 20 }, // 문파 수련(문파원 기여 막대)
};
// 서열·검사
export const SEASON = 's2';
export const COLL = { players: 's2_players', wboss: 's2_wboss', pvp: 's2_pvp', guilds: 's2_guilds', fame: 'fame' };
export const POWER_SLACK = 3;   // 표준 무인 전투력의 몇 배까지를 「있을 수 있음」으로
