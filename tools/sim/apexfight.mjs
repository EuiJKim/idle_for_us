// 끝판 두목 — 화무기(고수 · 두목 방) 한 판 · 칠대성(서버 공동 체력) 한 판에 깎는 몫
//   node apexfight.mjs [레벨들 JSON]   — 기준 무인(mobsim) · 「하루 차림」(자동 강화 +10 · 전설 둘 · 적토마 · 탑 60층)
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const MS = await import(`${root}/js/world/wmaster.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
let T = Date.UTC(2026, 10, 9, 3, 0); Date.now = () => T;
const LS = JSON.parse(process.argv[2] || '[75,99,120,135,150]');
const room = W.mapId(W.masterZoneOf('hwamugi'), W.BOSS_AREA);
function dressDay(g) {   // 하루 동안 자동이 닿는 차림
  for (const it of Object.values(g.s.equip)) if (it) it.plus = Math.max(it.plus || 0, 10);
  g.petSlots = () => 2;
  g.s.pets = [{ uid: 1e9, kind: 'turtle', rar: 2, lv: 30, exp: 0, q: 0, dan: 0, star: 2 }, { uid: 1e9 + 1, kind: 'tiger', rar: 2, lv: 30, exp: 0, q: 0, dan: 0, star: 2 }];
  if (W.petFromOld) for (const p of g.s.pets) { p.lv = W.petFromOld(p).lv; delete p.star; delete p.q; delete p.dan; }   // v470
  g.gainMount('redhare'); g.s.mount = g.s.mounts.find((m) => m.kind === 'redhare').uid;
  g.s.tower.floor = 60; g._stats = null;
}
function hwamugi(g, sec = 600) {
  g.s.dgn.routine = false; g.s.dgn.auto = false; g.enterMap(room); g.heroHp = g.stats().hp; g.s.potions = 1e6; g.s.autoPotion = true;
  const d0 = g.s.deaths; let boss = null, t = 0, hp0 = null, killed = false;
  for (; t < sec && !killed; t += 0.1) {
    T += 100; g.tick(0.1); g.events.length = 0; g.freezeT = 0;
    if (g.map.town) g.enterMap(room);
    const b = g.mons.find((m) => m.isBoss && m.alive);
    if (b && !boss) { boss = b; hp0 = b.maxHp; }
    if (boss && !boss.alive) killed = true;
  }
  return { killed, sec: Math.round(t), deaths: g.s.deaths - d0, left: boss && !killed ? `${Math.round(100 * boss.hp / boss.maxHp)}%` : '-', bossHp: hp0 ? hp0.toExponential(2) : '-', op: boss?.op ? +boss.op.toFixed(2) : '-' };
}
const out = [];
for (const L of LS) {
  for (const [tag, dress] of [['기준', null], ['하루 차림', dressDay]]) {
    const g = make(L); if (dress) dress(g);
    const st = g.stats();
    const r = hwamugi(g);
    out.push({ L, 차림: tag, 공격: Math.round(st.atk), 체력: Math.round(st.hp), '화무기': r.killed ? `✓ ${r.sec}초` : `✗ 남은 ${r.left}`, 쓰러짐: r.deaths, '두목 체력': r.bossHp, '맞춤 ×': r.op });
    console.error(L, tag, JSON.stringify(r));
  }
}
console.log(`화무기 Lv${MS.masterOf('hwamugi').lv} · 칠대성은 Lv${D.WRAID_LV}부터(서버 체력 = 화무기 기본 × ${D.WRAID_HP_K})`);
console.table(out);
