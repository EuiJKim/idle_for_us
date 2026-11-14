// 새 시즌 숫자 초안 — 장비(계획서 §G2 · §J4). 확률은 퍼밀 정수(1000 = 100%).
import { lerpTable } from '../core/fixed.js';

export const SLOTS = ['weapon', 'hat', 'top', 'bottom', 'glove', 'shoes', 'cape', 'belt', 'neck', 'ring'];
export const SLOT_NAME = { weapon: '무기', hat: '모자', top: '상의', bottom: '하의', glove: '장갑', shoes: '신발', cape: '망토', belt: '허리띠', neck: '목걸이', ring: '반지' };
// 등급 7 × 본·上 = 14단
export const GRADES = ['범', '양', '정', '진', '보', '신', '천'];
export const UPPER_P = 250;   // 같은 등급 안에서 「上」이 나올 확률(퍼밀) — 본:上 = 75:25

// 장비 뽑기 레벨별 등급 확률(퍼밀) — 사이 레벨은 직선 보간
export const GACHA_ROWS = [
  { at: 1, g0: 550, g1: 330, g2: 120, g3: 0, g4: 0, g5: 0, g6: 0 },
  { at: 5, g0: 350, g1: 400, g2: 220, g3: 30, g4: 0, g5: 0, g6: 0 },
  { at: 10, g0: 220, g1: 380, g2: 300, g3: 96, g4: 4, g5: 0, g6: 0 },
  { at: 15, g0: 60, g1: 260, g2: 380, g3: 262, g4: 37, g5: 1, g6: 0 },
  { at: 20, g0: 0, g1: 100, g2: 350, g3: 380, g4: 150, g5: 19, g6: 1 },
];
export const GACHA_LV_MAX = 20;
// 뽑기 레벨의 등급 가중치(합 1000 — 보간 반올림 오차는 가장 흔한 등급에 몰아준다)
export function gachaWeights(lv) {
  const w = GRADES.map((_, i) => lerpTable(GACHA_ROWS, lv, `g${i}`));
  const sum = w.reduce((a, b) => a + b, 0);
  const top = w.indexOf(Math.max(...w));
  w[top] += 1000 - sum;
  return w;
}
// 뽑기 경험치: 1회 = 1 · 레벨 n → n+1 필요 · 레벨업 대기(분, 최대 24시간)
export const gachaExpNeed = (n) => Math.round(30 * Math.pow(1.42, n));
// 시즌 시작 선물(길잡이 보상) — 장비 뽑기권. 첫날 정품 장비를 맞춰 주려고
export const START_PULL_TICKETS = 150;
export const gachaWaitMin = (n) => Math.min(24 * 60, n * n * 10);
// 정예: 뽑기 10회마다 1마리 · 행운 3%면 3마리
export const ELITE_EVERY = 10;
export const LUCKY_P = 30;
export const LUCKY_COUNT = 3;
// 부옵션 줄 수 확률(퍼밀): 0줄·1줄·2줄·3줄·4줄
export const SUBOPT_COUNT_P = [100, 350, 330, 170, 50];
// 강화 +0~+20 · 실패해도 안 깨짐
export const ENH_MAX = 20;
