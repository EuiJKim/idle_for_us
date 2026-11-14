// 새 시즌(S1) 열림 조건 — 모든 기능은 「콘텐츠 이름」 하나로 잠긴다(계획서 §C).
// 조건 칸(모두 만족해야 열림): lv · job(전직 차수) · clear('지역-방') · quest(길잡이 번호) · mission · seasonDay(시즌 며칠 뒤) · expr(식)
import { calc } from './expr.js';

const CONTENTS = new Map();
export const defineContent = (name, cond) => { CONTENTS.set(name, cond || {}); return name; };
export const contentCond = (name) => CONTENTS.get(name);

// ctx: { lv, job, cleared:Set, quest, missions:Set, seasonDay, vars(name) }
export function whyLocked(name, ctx) {
  const c = CONTENTS.get(name);
  if (!c) return [`없는 콘텐츠: ${name}`];
  const why = [];
  if (c.lv && (ctx.lv || 0) < c.lv) why.push({ k: 'lv', need: c.lv });
  if (c.job && (ctx.job || 0) < c.job) why.push({ k: 'job', need: c.job });
  if (c.clear && !ctx.cleared?.has(c.clear)) why.push({ k: 'clear', need: c.clear });
  if (c.quest && (ctx.quest || 0) < c.quest) why.push({ k: 'quest', need: c.quest });
  if (c.mission && !ctx.missions?.has(c.mission)) why.push({ k: 'mission', need: c.mission });
  if (c.seasonDay && (ctx.seasonDay || 0) < c.seasonDay) why.push({ k: 'seasonDay', need: c.seasonDay });
  if (c.expr && !calc(c.expr, (n) => ctx.vars?.(n) ?? 0)) why.push({ k: 'expr', need: c.expr });
  return why;
}
export const isOpen = (name, ctx) => whyLocked(name, ctx).length === 0;
