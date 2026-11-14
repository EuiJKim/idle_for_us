// 새 시즌(S8) 문파 — 건물(회관 → 인원) · 연구(대기 시간) · 도움 요청 · 콘텐츠 3개(토벌 · 대항 · 수련)를 같은 7창 세트로.
import { GUILD, WINDOW_SET } from '../tables/online.js';

export const maxMembers = (hallLv) => GUILD.baseMembers + GUILD.membersPerHall * Math.min(GUILD.hallMax, hallLv);
export const newGuild = (id, owner) => ({ id, owner, hall: 1, members: [owner], research: {}, helps: {}, train: { week: '', pts: {} }, war: { week: '', pts: 0 }, raid: { week: '', dmg: {} } });
export function join(G, uid) {
  if (G.members.includes(uid) || G.members.length >= maxMembers(G.hall)) return false;
  G.members.push(uid); return true;
}

// ── 연구: 시작하면 대기 시간 → 끝나면 레벨 +1 ──
export function startResearch(G, key, nowMs) {
  const r = (G.research[key] ??= { lv: 0, endMs: 0 });
  if (r.endMs || r.lv >= GUILD.research.maxLv) return false;
  r.endMs = nowMs + GUILD.research.waitH(r.lv + 1) * 3600e3;
  return true;
}
export function tickResearch(G, nowMs) {
  const done = [];
  for (const [k, r] of Object.entries(G.research)) if (r.endMs && nowMs >= r.endMs) { r.lv++; r.endMs = 0; done.push(k); }
  return done;
}

// ── 도움 요청: 내 대기(타이머 { endMs })에 문파원이 도움 → 남은 시간 1% 또는 3분 중 큰 것만큼 당김 ──
//   한 요청에 최대 10번 · 같은 사람은 한 요청에 한 번 · 하루에 남을 도와줄 수 있는 횟수 10
export function askHelp(G, reqId, owner, timer) { G.helps[reqId] = { owner, timer, by: [] }; }
export function giveHelp(G, reqId, helper, nowMs, day) {
  const h = G.helps[reqId];
  if (!h || h.owner === helper || h.by.includes(helper) || h.by.length >= GUILD.help.maxHelps) return false;
  if (!G.members.includes(helper)) return false;
  const gv = (G.giveCount ??= {});
  const key = `${helper}:${day}`;
  if ((gv[key] || 0) >= GUILD.help.perDayGive) return false;
  const left = Math.max(0, h.timer.endMs - nowMs);
  if (left <= 0) return false;
  h.timer.endMs -= Math.min(left, Math.max(GUILD.help.minMs, Math.round((left * GUILD.help.perHelpP) / 1000)));
  h.by.push(helper); gv[key] = (gv[key] || 0) + 1;
  return true;
}

// ── 콘텐츠 3개: 같은 틀(주간 키가 바뀌면 새로) ──
const weekly = (o, week, blank) => { if (o.week !== week) Object.assign(o, { week }, blank()); return o; };
// 문파 토벌: 문파원 피해 합으로 단계(체력 ×1.4씩)
export function raidHit(G, week, uid, dmg) { const R = weekly(G.raid, week, () => ({ dmg: {} })); R.dmg[uid] = (R.dmg[uid] || 0) + dmg; return raidTotal(G); }
export const raidTotal = (G) => Object.values(G.raid.dmg).reduce((a, b) => a + b, 0);
export function raidPhase(total, hp0) { let k = 0, hp = hp0, left = total; while (left >= hp) { left -= hp; hp = Math.round(hp * GUILD.raid.phaseX); k++; } return { phase: k, hp, done: left }; }
// 문파 대항: 주간 짝 둘의 점수(문파원 대결·토벌 기여)를 견줘 승점
export function warResult(a, b) { return a === b ? [GUILD.war.drawPts, GUILD.war.drawPts] : a > b ? [GUILD.war.winPts, 0] : [0, GUILD.war.winPts]; }
// 문파 수련: 문파원 기여가 막대를 채우면 모두 보상
export function trainAdd(G, week, uid, pts) { const T = weekly(G.train, week, () => ({ pts: {} })); T.pts[uid] = (T.pts[uid] || 0) + pts; return trainProgress(G); }
export function trainProgress(G) {
  const sum = Object.values(G.train.pts).reduce((a, b) => a + b, 0), goal = GUILD.train.goalPerMember * G.members.length;
  return { sum, goal, full: sum >= goal };
}
// 7창 세트 — 콘텐츠마다 같은 창 이름(화면이 이 목록으로 창을 만든다)
export const CONTENTS = ['raid', 'war', 'train'];
export const windowsOf = (content) => WINDOW_SET.map((w) => `${content}.${w}`);
