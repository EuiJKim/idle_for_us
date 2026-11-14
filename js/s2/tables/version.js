// 새 시즌(S1) 표 판 번호 · 해시(계획서 §L7). 세이브에 「어느 판으로 계산했나」를 적고,
// 점검 작업이 판이 맞는지 본다. 숫자를 바꾸면 해시가 저절로 바뀐다(판 번호는 사람이 올림).
import { TABLE_VER as PV, PROGRESS, JOB_LV, LEVEL_MAX } from './progress.js';
import { expToNext } from './exp.js';
import { GACHA_ROWS, SUBOPT_COUNT_P, gachaWeights, GACHA_LV_MAX } from './gear.js';
import { starOdds, STAR_MAX } from './star.js';
import { optWeights, PULL_P, PULL_PITY, MASTERY_MAX } from './option.js';
import { REWARD_UNITS, KILL_SEC, TIER_HP_X } from './economy.js';

export const TABLE_VER = PV;

let cached = null;
export function tableHash() {
  if (cached) return cached;
  const dump = JSON.stringify({
    PROGRESS, JOB_LV, LEVEL_MAX, GACHA_ROWS, SUBOPT_COUNT_P, PULL_P, PULL_PITY, REWARD_UNITS, KILL_SEC, TIER_HP_X,
    exp: Array.from({ length: LEVEL_MAX }, (_, i) => expToNext(i + 1)),
    gacha: Array.from({ length: GACHA_LV_MAX }, (_, i) => gachaWeights(i + 1)),
    star: Array.from({ length: STAR_MAX }, (_, i) => starOdds(i)),
    opt: Array.from({ length: MASTERY_MAX + 1 }, (_, i) => optWeights(i)),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < dump.length; i++) h = Math.imul(h ^ dump.charCodeAt(i), 0x01000193) >>> 0;
  cached = h.toString(16).padStart(8, '0');
  return cached;
}
