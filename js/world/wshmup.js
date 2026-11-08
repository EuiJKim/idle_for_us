// 칠대성·천외천 — 마왕 판 자리표 (v374~v442 탄막 슈팅 → v443 강타 한 방으로 바뀌며 탄막 코드는 걷어 냈다)
//   남은 것: 마왕 자리 · 칠십이변 분신 방패 주기 · 마왕 초식 이름표(PATTERNS — 데이터 검사용) · 근접 직업 판별
import * as W from './wdata.js';

export const ARENA = { x0: 40, x1: W.COLS * W.TILE - 40, y1: W.ROWS * W.TILE - 80 };
export const BOSS_C = Math.floor(W.COLS / 2), BOSS_R = 7;          // 두목 자리(칸)
export const HERO_R = 13;
// v378 칠십이변(대성신장 7) — 강타를 대신 맞는 분신 방패: WK_SEC마다 하나 · WK_MAX까지
export const WK_SEC = 15;
export const WK_MAX = 2;
// 붙어 싸우는 직업(사거리 200 아래)
export const closeIn = (g) => (W.classOf(g.s.job)?.range || 0) < 200;
// 마왕 초식 이름표의 모양 열쇠 — v443부터 모양은 쓰지 않고 이름만 외친다(wdgn의 pats 검사용)
export const PATTERNS = ["ring","spiral","fan","rain","wave","burst","cross","homing","palm"];
