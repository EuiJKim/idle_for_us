// 새 시즌(S8) 대결 — 비동기 방어 덱 · 결정론 대결 · 점수식 · 티어 · 짝 찾기.
import { hit } from '../battle/damage.js';
import { SKILL_BASE, SKILL_MAIN } from '../battle/ref.js';
import { JOBS } from '../tables/char.js';
import { Rng } from '../core/rng.js';
import { hash64, canon } from '../core/save.js';
import { PVP, PVP_TIERS, PVP_MATCH } from '../tables/online.js';
import { power } from './power.js';

// 방어 덱 = 그때 스탯 묶음 사진 + 무공 순서. 지문(hash)으로 손댄 것을 알아본다
export function makeDeck(f, skills = ['main']) {
  const body = { lv: f.lv, job: f.job, st: { ...f.st }, skills };
  return { ...body, pw: power(f, 'pvp'), h: hash64(canon(body)) };
}
export const deckOk = (d) => d && d.h === hash64(canon({ lv: d.lv, job: d.job, st: d.st, skills: d.skills }));

// 대결 한 판(결정론): 둘 다 평타 + 주력 무공(쿨마다). 시간 끝나면 남은 체력 비율이 큰 쪽
export function duel(A, D, seed) {
  const rng = new Rng(seed);
  const side = (f) => ({ f: { lv: f.lv, job: f.job, kind: 'hero', st: f.st }, hp: f.st.hp, nb: 0, nm: SKILL_MAIN.cdMs / 2, ms: (JOBS[f.job] || JOBS.sword).baseMs });
  const a = side(A), d = side(D);
  let t = 0;
  for (; t < PVP.fightMs && a.hp > 0 && d.hp > 0; t += 50) {
    for (const [me, op] of [[a, d], [d, a]]) {
      if (me.hp <= 0) continue;
      if (t >= me.nb) { op.hp -= hit(me.f, op.f, SKILL_BASE, rng).dmg; me.nb = t + me.ms; }
      if (t >= me.nm) { op.hp -= hit(me.f, op.f, SKILL_MAIN, rng).dmg; me.nm = t + SKILL_MAIN.cdMs; }
    }
  }
  const ra = Math.max(0, a.hp) / A.st.hp, rd = Math.max(0, d.hp) / D.st.hp;
  return { win: ra > rd, ms: t, ra, rd };
}
// 점수식: 이기면 +win, 지면 −lose. 전투력 차(상대/나)가 크면 더 주고 덜 뺌(±gapMax)
export function scoreDelta(win, myPw, opPw) {
  const g = Math.max(-PVP.gapMax, Math.min(PVP.gapMax, Math.round((opPw / Math.max(1, myPw) - 1) * 100 * PVP.gapK)));
  return win ? { atk: PVP.win + g, def: -PVP.defLose } : { atk: -Math.max(1, PVP.lose - g), def: PVP.defWin };
}
export const tierOf = (score) => PVP_TIERS.filter((t) => score >= t.min).at(-1);
// 짝 찾기: 내 점수 ±range에서, 못 찾으면 widen씩 넓혀 maxTries번
export function findOpp(list, me, rng) {
  for (let i = 0; i < PVP_MATCH.maxTries; i++) {
    const r = PVP_MATCH.range + i * PVP_MATCH.widen;
    const c = list.filter((o) => o.uid !== me.uid && Math.abs(o.score - me.score) <= r);
    if (c.length) return c[rng.int(c.length)];
  }
  return null;
}
// 하루 횟수
export function useTry(V, dayKey) {
  if (V.day !== dayKey) { V.day = dayKey; V.used = 0; }
  if (V.used >= PVP.triesPerDay) return false;
  V.used++; return true;
}
