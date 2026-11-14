// 새 시즌(S8) 서열 기록 · 점검(재현 검증) · 명예의 전당(계획서 §L5 · §A).
// 점검 작업(Actions)이 서버 세이브 + 입력 기록으로 **같은 엔진을 돌려** 서열 값을 다시 계산한다.
import { unpack } from '../core/save.js';
import { LEVEL_MAX } from '../tables/progress.js';
import { POWER_SLACK, COLL, SEASON } from '../tables/online.js';
import { power, stdPower } from './power.js';
import { replay } from '../battle/room.js';
import { Hero } from '../hero/hero.js';
import { gearSources } from '../gear/gear.js';

export { COLL, SEASON };
// 서열에 올리는 칸(규칙과 같은 목록 — 시험이 둘을 맞춰 본다)
export const PROFILE_KEYS = ['season', 'nickname', 'lv', 'job', 'power', 'pvpPower', 'pvpScore', 'wbScore', 'guildId', 'tv', 'signed', 'updatedAt'];
export function buildProfile(f, extra = {}) {
  return { season: SEASON, lv: f.lv, job: f.job, power: power(f, 'pve'), pvpPower: power(f, 'pvp'), ...extra };
}
// 있을 수 있는 값인가 — 이유 목록(빈 목록이면 통과)
export function checkProfile(p) {
  const why = [];
  if (!(p.lv >= 1 && p.lv <= LEVEL_MAX && Number.isInteger(p.lv))) why.push(`레벨 ${p.lv}`);
  else if (p.power > stdPower(p.lv) * POWER_SLACK) why.push(`전투력 ${p.power} > 표준×${POWER_SLACK}`);
  if (p.signed === false) why.push('세이브 서명 불일치');
  return why;
}
// 세이브 글자에서 다시 계산 — 서명 · 표 판 · 올린 전투력이 세이브와 같은지
export function verifySave(text, posted, fighterOf) {
  const u = unpack(text);
  const why = [];
  if (!u.ok) why.push('서명');
  if (!u.tableOk) why.push('표 판');
  if (u.body) {
    const f = fighterOf(u.body);
    const pw = power(f, 'pve');
    if (posted && Math.abs(pw - posted.power) > Math.max(2, pw * 0.01)) why.push(`전투력 ${posted.power} ≠ 다시 계산 ${pw}`);
    if (posted && posted.lv !== f.lv) why.push(`레벨 ${posted.lv} ≠ ${f.lv}`);
  }
  return why;
}
// 세이브 몸통 → 전투 모양(점검 작업이 서버에서 다시 센다). 지금은 무인 + 장비 — S9에서 세이브 모양을 정할 때 나머지 출처도 여기에 넣는다
export function fighterOfBody(b) {
  const h = new Hero(b.hero);
  return h.fighter(b.gear ? gearSources(b.gear, h.s.lv) : []);
}
// 전투 기록 재현 — 올린 지문과 같은지
export function verifyFight(def, hero, log, ms, digest) {
  const f = replay(def, hero, log, ms);
  return f.digest() === digest;
}
// 명예의 전당 — 옛 시즌 기록을 박제(옛 프로필 → 한 줄)
export const FAME_TITLE = '1시즌 무인';
export function fameRows(oldProfiles, n = 100) {
  const pick = (k) => [...oldProfiles].filter((p) => p && p.nickname).sort((a, b) => (b[k] || 0) - (a[k] || 0)).slice(0, n)
    .map((p, i) => ({ rank: i + 1, nickname: p.nickname, level: p.level || 0, power: p.power || 0, raidDps: p.raidDps || 0 }));
  return { level: pick('level'), power: pick('power'), raid: pick('raidDps') };
}
