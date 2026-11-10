// 전투력 전후 비교 — 세이브·만든 상태 여럿의 공격력·체력·전투력을 적어 둔다(패치 앞뒤로 한 번씩 돌려 견준다)
//   node famecmp.mjs before.json [세이브.json …]     → before.json에 적는다
//   node famecmp.mjs after.json  [세이브.json …]      → after.json에 적는다
//   node famecmp.mjs cmp before.json after.json       → 둘을 견준다(비 · 기하평균)
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const fs = await import('node:fs');
const [, , out, ...files] = process.argv;
if (out === 'cmp') {
  const a = JSON.parse(fs.readFileSync(files[0], 'utf-8')), b = JSON.parse(fs.readFileSync(files[1], 'utf-8'));
  const rows = []; let la = 0, lh = 0, n = 0;
  for (const k of Object.keys(a)) {
    if (!b[k]) continue;
    const ra = b[k].atk / a[k].atk, rh = b[k].hp / a[k].hp, rp = b[k].power / a[k].power;
    rows.push({ 상태: k, L: a[k].L, '공격 전': Math.round(a[k].atk), '공격 뒤': Math.round(b[k].atk), '공격 ×': +ra.toFixed(3), '체력 ×': +rh.toFixed(3), '전투력 ×': +rp.toFixed(3), 명성: b[k].fame ?? '-', '명성 %': b[k].famePct != null ? +(b[k].famePct * 100).toFixed(1) : '-' });
    la += Math.log(ra); lh += Math.log(rh); n++;
  }
  console.table(rows);
  console.log(`기하평균 — 공격 ×${Math.exp(la / n).toFixed(3)} · 체력 ×${Math.exp(lh / n).toFixed(3)} (${n}개)`);
  process.exit(0);
}
const { WorldGame, migrateWorld } = await import(`${root}/js/world/wgame.js`);
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const MS = await import(`${root}/js/world/wmaster.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
const res = {};
const note = (name, g) => { g._stats = null; g._huntB = null; g._dexZ = null; g._fame = null; const st = g.stats(); const f = g.fame?.(); res[name] = { L: g.s.level, atk: st.atk, hp: st.hp, power: st.power, fame: f?.pts, famePct: f?.pct }; };
// 세이브 파일
for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
  const g = new WorldGame(migrateWorld(raw.save ? JSON.parse(raw.save) : raw, Date.now()), Date.now());
  note(f.split('/').pop().replace(/\.json$/, ''), g);
}
// 만든 상태 — 기준 무인(mobsim) + 무림·동료 차림
const W_L = await import(`${root}/js/world/wland.js`);
const kills = (lv) => { let k = 0; while (W_L.masteryLv(k) < lv && k < 1e9) k = k ? k * 1.3 + 50 : 50; return Math.ceil(k); };
function dress(g, o) {
  const s = g.s;
  s.tower = { ...(s.tower || {}), floor: o.tower || 0, hard: o.hard || 0, cor: { key: '', best: 0, all: o.cor || 0 } };
  s.duel = { won: {}, stars: {} };
  const ms = MS.MASTERS.filter((m) => !m.hidden);
  const lords = ms.filter((m) => m.lord), plain = ms.filter((m) => !m.lord);
  for (const m of [...plain.slice(0, o.masters || 0), ...lords.slice(0, o.lords || 0)]) { s.duel.won[m.id] = 1; s.duel.stars[m.id] = o.stars === 2 ? 3 : o.stars === 1 ? 1 : 0; }
  s.wraid.gates = {}; for (const x of D.HEAVEN_GATES.slice(0, o.gates || 0)) s.wraid.gates[x.id] = 1;
  s.titles = Object.keys(W.TITLES).filter((k) => W.TITLES[k].how).slice(0, o.titles || 0);
  s.mast = {}; { let left = o.mast || 0; for (let z = 1; left > 0 && W.zoneOfW(z); z++) { const lv = Math.min(10, left); s.mast[z] = kills(lv); left -= lv; } }
  s.dex = {}; { const zs = W.dexZones(); let st = o.stamps || 0; zs.slice(0, o.zones || 0).forEach((z) => z.names.forEach((n) => { s.dex[n] = W.DEX_NEED; st--; })); for (const z of zs.slice(o.zones || 0)) for (const n of z.names.slice(0, -1)) if (st > 0) { s.dex[n] = W.DEX_NEED; st--; } }
  if (o.guild) { s.guildId = 'g'; g.guildExp = (o.guild - 1) * W.GUILD_LV_EXP; }
  g.petSlots = () => (o.pets || []).length || 1;
  s.pets = (o.pets || []).map(([kind, rar, lv], i) => ({ uid: 1e9 + i, kind, rar, lv, exp: 0, q: 0, dan: 0, star: 2 }));
  if (W.petFromOld) for (const p of s.pets) { p.lv = W.petFromOld(p).lv; delete p.star; delete p.q; delete p.dan; }   // v470 별 → 레벨(같은 몫)
  if (o.mount) { g.gainMount(o.mount); s.mount = s.mounts.find((m) => m.kind === o.mount).uid; }
}
const PROF = {
  'Lv30 첫날': [30, { tower: 9, titles: 2, mast: 6, stamps: 6, pets: [['turtle', 1, 10]], mount: 'horse' }],
  'Lv60 초반': [60, { tower: 28, titles: 5, mast: 25, stamps: 30, zones: 2, pets: [['qilin', 2, 20], ['turtle', 2, 20]], mount: 'tigerm' }],
  'Lv75 하루(뽑기)': [75, { tower: 69, titles: 6, mast: 35, stamps: 40, zones: 3, pets: [['turtle', 2, 29], ['fox', 2, 29]], mount: 'redhare' }],
  'Lv99 중반': [99, { tower: 75, masters: 8, stars: 1, titles: 10, mast: 120, stamps: 110, zones: 14, guild: 5, pets: [['tiger', 2, 30], ['qilin', 2, 30]], mount: 'azure' }],
  'Lv115 문파 없음': [115, { tower: 100, hard: 5, masters: 14, stars: 1, titles: 14, mast: 200, stamps: 170, zones: 22, pets: [['tiger', 2, 30], ['dragon', 2, 30], ['qilin', 2, 30]], mount: 'azure' }],
  'Lv130 후반': [130, { tower: 120, hard: 20, cor: 10, masters: 20, lords: 1, stars: 2, gates: 2, titles: 20, mast: 350, stamps: 250, zones: 35, guild: 10, pets: [['yellow', 3, 30], ['tiger', 2, 30], ['dragon', 2, 30]], mount: 'z12' }],
  'Lv150 끝': [150, { tower: 120, hard: 60, cor: 40, masters: 24, lords: 3, stars: 2, gates: 4, titles: 30, mast: 600, stamps: 369, zones: 60, guild: 20, pets: [['yellow', 3, 30], ['tiger', 3, 30], ['dragon', 3, 30]], mount: 'h6' }],
  'Lv150 무림만(동료 없음)': [150, { tower: 120, hard: 60, cor: 40, masters: 24, lords: 3, stars: 2, gates: 4, titles: 30, mast: 600, stamps: 369, zones: 60, guild: 20 }],
  'Lv150 동료만(무림 없음)': [150, { pets: [['yellow', 3, 30], ['tiger', 3, 30], ['dragon', 3, 30]], mount: 'h6' }],
};
for (const [name, [L, o]] of Object.entries(PROF)) { const g = make(L); dress(g, o); note(name, g); }
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.table(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { L: v.L, atk: Math.round(v.atk), hp: Math.round(v.hp), power: Math.round(v.power), 명성: v.fame ?? '-' }])));
