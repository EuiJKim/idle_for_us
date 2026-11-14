// 새 시즌 숫자 초안 — 장비(계획서 §G2 · §J4). 확률은 퍼밀 정수(1000 = 100%).
import { lerpTable } from '../core/fixed.js';

export const SLOTS = ['weapon', 'hat', 'top', 'bottom', 'glove', 'shoes', 'cape', 'belt', 'neck', 'ring'];
export const SLOT_NAME = { weapon: '무기', hat: '모자', top: '상의', bottom: '하의', glove: '장갑', shoes: '신발', cape: '망토', belt: '허리띠', neck: '목걸이', ring: '반지' };
// 등급 7 × 본·上 = 14단
export const GRADES = ['범', '양', '정', '진', '보', '신', '천'];
export const UPPER_P = 250;   // 같은 등급 안에서 「上」이 나올 확률(퍼밀) — 본:上 = 75:25

// 장비 뽑기 레벨별 등급 확률(퍼밀) — 사이 레벨은 직선 보간
export const GACHA_ROWS = [
  { at: 1, g0: 700, g1: 250, g2: 50, g3: 0, g4: 0, g5: 0, g6: 0 },
  { at: 5, g0: 400, g1: 380, g2: 180, g3: 40, g4: 0, g5: 0, g6: 0 },
  { at: 10, g0: 150, g1: 350, g2: 330, g3: 140, g4: 30, g5: 0, g6: 0 },
  { at: 15, g0: 0, g1: 200, g2: 380, g3: 300, g4: 110, g5: 10, g6: 0 },
  { at: 20, g0: 0, g1: 0, g2: 300, g3: 420, g4: 230, g5: 47, g6: 3 },
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
export const gachaExpNeed = (n) => Math.round(40 * Math.pow(1.35, n));
export const gachaWaitMin = (n) => Math.min(24 * 60, n * n * 10);
// 정예: 뽑기 10회마다 1마리 · 행운 3%면 3마리
export const ELITE_EVERY = 10;
export const LUCKY_P = 30;
export const LUCKY_COUNT = 3;
// 부옵션 줄 수 확률(퍼밀): 0줄·1줄·2줄·3줄·4줄
export const SUBOPT_COUNT_P = [100, 350, 330, 170, 50];
// 강화 +0~+20 · 실패해도 안 깨짐
export const ENH_MAX = 20;
