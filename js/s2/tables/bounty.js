// 현상수배 — 날마다 사냥 목표 셋(한국 시각 자정에 새로). 하나 끝내면 작은 보상, 셋 다 끝내면 상자.
//   목록은 그날(dayKey) · 세이브 씨앗으로만 정한다(게임 난수 this.rng는 건드리지 않는다 — 다른 뽑기가 그대로).
//   목표는 늘 닿는 곳: 가장 멀리 간 칸(top)에서 back칸 안쪽부터 · 수는 보통 사냥 10~20분 몫(KILLS_PER_MIN 27마리/분).
//   stage: 그 칸부터 앞쪽(칸 번호가 from 이상)에서 몹 n마리 · kill: 아무 칸에서 몹 n마리 · boss: 칸 두목 깨기 · 사냥터 두목 처치 n번
//   정예는 장비 뽑기로만 나와(10번마다) 사냥만으로 늘 닿지 않아 목표로 쓰지 않는다 — 잡으면 몹 수에는 든다.
export const BOUNTY_T = {
  stage: { name: '토벌', min: [10, 12, 15], unit: 10, back: 9 },   // need = 분 × 27 → unit 단위로 반올림
  kill: { name: '사냥', min: [15, 18, 20], unit: 50 },
  boss: { name: '두목', n: [2, 2, 3] },                            // 사냥터 두목은 300마리(11분 남짓)마다 · 칸 두목은 칸마다
};
export const BOUNTY_SLOTS = ['stage', 'kill', 'boss'];
// 보상 — 하나마다 은자(그때 레벨 사냥 goldMin분 몫) + 장비 뽑기권 1~2 또는 강화석 10~20 · 상자: 장비 뽑기권 3 + 병기·동료·영물 뽑기권 하나
export const BOUNTY_REW = { goldMin: 10, extra: [{ k: 'ticket:gear', n: [1, 2] }, { k: 'item:stone', n: [10, 20] }] };
export const BOUNTY_CHEST = { 'ticket:gear': 3, coll: ['ticket:weapon', 'ticket:pal', 'ticket:relic'] };
// 그날 씨앗 — dayKey · 세이브 씨앗을 섞은 32비트
export const bountySeed = (dk, seed) => (Math.imul((dk | 0) ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
