// v436 불변식 — 몽키 봇(tests/soak.mjs) · 세이브 재현(tests/replay.cjs, 브라우저 안에서 import)이 같이 쓴다
//   깨진 것의 이름 목록을 돌려준다(비었으면 멀쩡). watch: 두목 체력 찌꺼기를 지켜보는 표(부를 때마다 같은 것을 넘긴다)
// 불변식 — 깨진 것 이름 목록
export function broken(g, watch = new Map()) {
  const s = g.s, bad = [];
  const fin = (v, n) => { if (!Number.isFinite(v)) bad.push(`${n}=${v}`); };
  fin(s.gold, 'gold'); fin(s.exp, 'exp'); fin(s.level, 'level'); fin(g.heroHp, 'heroHp');
  if (s.gold < 0) bad.push(`gold<0 (${s.gold})`);
  if (s.exp < 0) bad.push(`exp<0 (${s.exp})`);
  if (!(s.level >= 1) || s.level !== Math.floor(s.level)) bad.push(`level ${s.level}`);
  const st = g.stats();
  fin(st.atk, 'atk'); fin(st.hp, 'maxHp');
  if (g.heroHp > st.hp * 1.0001 + 1) bad.push(`heroHp>${Math.round(st.hp)} (${Math.round(g.heroHp)})`);
  if (s.bag.length > s.bagSize) bad.push(`bag ${s.bag.length}/${s.bagSize}`);
  if (s.potions < 0 || !Number.isFinite(s.potions)) bad.push(`potions ${s.potions}`);
  for (const [k, v] of Object.entries(s.mats || {})) if (!Number.isFinite(v) || v < 0) bad.push(`mats.${k}=${v}`);
  for (const m of g.mons) if (!Number.isFinite(m.hp) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) { bad.push(`mon ${m.def?.name} hp=${m.hp} x=${m.x}`); break; }
  if (g.inst) for (const [k, v] of Object.entries(g.inst)) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`inst.${k}=${v}`);
  // 두목이 체력 1 언저리에서 10초 넘게 안 죽으면(반올림 찌꺼기) 막힌 것
  const now = g.clock;
  for (const m of g.mons) {
    if (!m.boss || m.npc) continue;
    if (m.hp > 0 && m.hp <= 1) { const at = watch.get(m) ?? now; watch.set(m, at); if (now - at > 10) bad.push(`boss ${m.def?.name} hp≤1 for ${Math.round(now - at)}s`); }
    else watch.delete(m);
  }
  return bad;
}

