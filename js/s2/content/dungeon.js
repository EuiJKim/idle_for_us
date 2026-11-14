// 새 시즌(S6) 던전 실행 — 방 사냥 엔진(battle/room.js) 위에 클리어 조건 8종 · 규칙 깃발 · 소탕.
// 정의: { clear, need?, timeMs, flags?:[], mobLv, kind:'mob'|'elite'|'boss', n?, hpX? }
import { RoomFight, simpleRoom } from '../battle/room.js';
import { CLEAR } from '../tables/content.js';

export function runDungeon(def, hero, seed = 1) {
  if (!CLEAR.includes(def.clear)) throw new Error(`모르는 클리어 조건: ${def.clear}`);
  const n = def.n ?? (def.clear === 'boss' ? 1 : 8);
  const kind = def.kind ?? (def.clear === 'boss' ? 'boss' : 'mob');
  const room = simpleRoom(def.mobLv, { n, kind, coolMs: def.clear === 'wipe' ? 1e12 : 2000 });
  const F = new RoomFight(room, hero, seed, { auto: true });
  if (def.hpX) for (const m of F.mobs) { m.hp = Math.round(m.hp * def.hpX); m.st.hp = m.hp; }
  const flags = new Set(def.flags || []);
  let collected = 0, dist = 0, score = 0;
  const lastX = { x: F.hero.x, y: F.hero.y };
  let done = false, cleared = false;
  // 도착형: 방 먼 구석이 목표 — 무인은 싸우지 않고 그쪽으로 걷는다(초당 4000mm)
  const goal = def.clear === 'reach' ? { x: room.w - 500, y: room.h - 500 } : null;
  while (F.t < def.timeMs && !done) {
    const k0 = F.kills;
    if (goal) {
      F.t += 50;
      const H = F.hero, d = Math.hypot(goal.x - H.x, goal.y - H.y), st = Math.min(d, 200);
      if (d > 0) { H.x += Math.round(((goal.x - H.x) / d) * st); H.y += Math.round(((goal.y - H.y) / d) * st); }
      if (Math.hypot(goal.x - H.x, goal.y - H.y) <= 500) { done = cleared = true; }
      continue;
    }
    F.step();
    const nk = F.kills - k0;
    collected += nk;                                       // 아이템 모으기: 처치마다 하나 떨어진다고 본다
    score += nk * (kind === 'boss' ? 100 : 10);
    dist += Math.hypot(F.hero.x - lastX.x, F.hero.y - lastX.y); lastX.x = F.hero.x; lastX.y = F.hero.y;
    if (flags.has('noDie') && F.deaths > 0) { done = true; cleared = false; break; }
    switch (def.clear) {
      case 'kills': if (F.kills >= def.need) { done = cleared = true; } break;
      case 'boss': if ((F.killsBy.boss || 0) >= 1) { done = cleared = true; } break;
      case 'wipe': if (F.mobs.length === 0) { done = cleared = true; } break;
      case 'collect': if (collected >= def.need) { done = cleared = true; } break;
      case 'score': if (score >= def.need) { done = cleared = true; } break;
      default: break;
    }
  }
  if (!done) {
    if (def.clear === 'survive') cleared = F.deaths === 0;          // 버티기: 시간 끝까지 안 죽으면
    else if (def.clear === 'timeoutWin') cleared = true;             // 시간 끝나면 승리
  }
  return { cleared, timeMs: F.t, kills: F.kills, deaths: F.deaths, score, meter: flags.has('bossMeter') ? F.dmgOut : null, digest: F.digest() };
}
// 소탕 — 한 번 깬 단계는 싸우지 않고 보상만(입장권은 똑같이 씀)
export const canSweep = (record, stage) => (record?.best ?? 0) >= stage;
