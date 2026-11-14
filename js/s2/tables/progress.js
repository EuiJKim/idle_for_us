// 새 시즌 숫자 초안 — 진행 목표(계획서 §J1). 시뮬(tools/s2sim)이 이 표를 합격선으로 쓴다.
// 기준 플레이어: 하루 접속 2시간 + 나머지 방치, 광고 안 봄.
export const TABLE_VER = 's2-0.4';   // S3 경험치 곡선 · S4 장비 경제 · S5 성장 축 · 표준 무인 표

// day: 시작부터 지난 날 · lv: [아래, 위] · job: 전직 차수 · star: 성혼 목표
export const PROGRESS = [
  { day: 1 / 48, lv: [13, 17], job: 1, gear: '양', star: 0 },     // 30분
  { day: 1, lv: [55, 65], job: 2, gear: '정', star: 5 },
  { day: 7, lv: [100, 100], job: 3, gear: '진', star: 12 },
  { day: 30, lv: [112, 115], job: 3, gear: '진上', star: 15 },
  { day: 90, lv: [125, 128], job: 4, gear: '보', star: 17 },
  { day: 180, lv: [137, 140], job: 4, gear: '보上', star: 19 },
  { day: 365, lv: [150, 150], job: 5, gear: '신', star: 20 },
];
// 정책별 허용 폭: 꽉 채움은 기준의 1.3배 이내, 방치만은 0.6배 이상(레벨이 아니라 「진행 속도」 기준)
export const POLICY_BAND = { full: { max: 1.3 }, idle: { min: 0.6 } };
// 전직 레벨
export const JOB_LV = [1, 10, 50, 99, 120, 145];   // 0차(시작) · 1차 · 2차 · 3차(99 승급) · 4차 · 5차
export const LEVEL_MAX = 150;
