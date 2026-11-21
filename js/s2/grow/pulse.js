// v634 강함 진맥 — 무인의 층(레벨 · 장비 · 무공 · 마스터리 · 전직 · 스탯 · 병기 · 동료 · 영물 · 경지 · 강호행)을
//   지금 스테이지의 표준 무인(tables/std.js · stdsrc.js — 기준 플레이어가 그 레벨에 가진 것)과 견준다. 「기준의 n%」 · 가장 뒤처진 층 하나.
//   전투력 층(장비 · 병기 · 동료 · 영물 · 경지 · 강호행)은 「그 층이 전투력을 몇 % 올리나」를 서로 견준다(곱으로 붙는 층은 다른 층과 상관없이 같은 값).
//   계산만 한다(세이브 · 난수 · 시각을 건드리지 않는다).
import { Hero, newHero, SP_KEYS, SP_CAP } from '../hero/hero.js';
import { cumExp } from '../tables/exp.js';
import { JOB_LV, LEVEL_MAX } from '../tables/progress.js';
import { MASTERY } from '../tables/skills.js';
import { kitCap, stdPals } from '../tables/kit.js';
import { STD_SRC } from '../tables/stdsrc.js';
import { power } from '../online/power.js';

const SRC_LAYER = { 병기: 'weapon', 동료: 'pal', 영물: 'relic', 경지: 'realm', 강호행: 'journey', 꾸미기: 'look' };
// 출처 이름 → 층(장비 칸 · 세트는 장비) — sim/std.js가 표를 만들 때도 같은 것을 쓴다
export const stdLayerOf = (src) => (/^(장비|세트):/.test(src) ? 'gear' : SRC_LAYER[src] || null);
// 층 — 이름 · 가는 칸(app.js openKey) · 전투력 층이면 pw
export const PULSE = [
  { k: 'level', name: '레벨', go: 'content:0' },
  { k: 'gear', name: '장비', go: 'gear:2', pw: true },
  { k: 'kit', name: '무공', go: 'hero:1' },
  { k: 'mastery', name: '마스터리', go: 'hero:2' },
  { k: 'adv', name: '전직', go: 'hero:3' },
  { k: 'stat', name: '스탯 배분', go: 'hero:0' },
  { k: 'weapon', name: '병기', go: 'grow:0', pw: true },
  { k: 'pal', name: '동료', go: 'grow:1', pw: true },
  { k: 'relic', name: '영물', go: 'grow:2', pw: true },
  { k: 'realm', name: '경지', go: 'grow:3', pw: true },
  { k: 'journey', name: '강호행', go: 'grow:4', pw: true },
];
export const PULSE_MIN_GAIN = 0.01;   // 기준 무인에게도 전투력 +1%가 안 되는 층은 아직 견주지 않는다(첫 몇 레벨)
export const PULSE_OK = 100;          // 이만큼이면 「기준 이상」

const advAt = (L) => JOB_LV.filter((lv, n) => n > 0 && L >= lv).length;
const stdCache = new Map();
// 표준 무인(레벨 L · 직업) — 레벨 · 그 레벨까지의 전직 · 마스터리 · 무공 상한(sim/std.js heroAt과 같은 셈) + 층별 출처 + 동료
export function stdHero(L0, job = 'sword') {
  const L = Math.max(1, Math.min(LEVEL_MAX, STD_SRC.length - 1, Math.round(L0) || 1)), key = `${job}:${L}`;
  if (stdCache.has(key)) return stdCache.get(key);
  const h = new Hero(newHero(job));
  h.addExp(cumExp(L));
  for (let n = 1; n < JOB_LV.length; n++) if (L >= JOB_LV[n]) { h.clearDungeon(`job${n}`); h.advance(); }
  for (const m of MASTERY) if (L >= m.lv) h.s.mastery.done.push(m.id);
  h.kitUnlock(); for (const id of Object.keys(h.s.kit.lv)) h.s.kit.lv[id] = kitCap(L);
  const src = Object.entries(STD_SRC[L] || {}).map(([k, stats]) => ({ src: `std:${k}`, layer: k, stats }));
  const o = { L, hero: h, src, pals: stdPals(L).map((p) => ({ ...p })) };
  if (stdCache.size > 64) stdCache.clear();
  stdCache.set(key, o);
  return o;
}
// 층 하나가 전투력을 몇 배로 올리나 − 1(없으면 0) — 동료 층은 싸움에 끼는 동료도 함께 뺀다
function gainOf(hero, src, pals, layer, ofLayer) {
  const all = power(hero.fighter(src, pals));
  const rest = src.filter((x) => ofLayer(x) !== layer);
  const without = power(hero.fighter(rest, layer === 'pal' ? [] : pals));
  return without > 0 ? Math.max(0, all / without - 1) : 0;
}
const ratio = (a, b) => (b > 0 ? Math.round((a / b) * 100) : PULSE_OK);
// g: Game. 돌려줌 { L(스테이지 레벨), lv, rows: [{ k, name, go, pct, have, std, desc }], low(가장 뒤처진 줄 — 모두 기준 이상이면 null) }
export function pulse(g) {
  const S = g.S, h = S.hero, H = g.hero, L = Math.max(1, Math.min(LEVEL_MAX, g.zoneLv ? g.zoneLv() : h.lv)), std = stdHero(L, h.job);
  const mine = g.sources(), pals = g.palList(), rows = [];
  const add = (D, pct, desc) => rows.push({ k: D.k, name: D.name, go: D.go, pct: Math.max(0, pct), desc });
  for (const D of PULSE) {
    if (D.pw) {
      const gs = gainOf(std.hero, std.src, std.pals, D.k, (x) => x.layer);
      if (gs < PULSE_MIN_GAIN) continue;
      const gm = gainOf(H, mine, pals, D.k, (x) => stdLayerOf(x.src));
      add(D, ratio(gm, gs), D.k === 'gear' ? gearDesc(S.gear) : `전투력 +${Math.round(gm * 100)}% · 기준 +${Math.round(gs * 100)}%`);
      if (D.k === 'gear' && !Object.values(S.gear?.eq || {}).some(Boolean)) rows.at(-1).go = 'gear:0';   // 낀 것이 없으면 장착 칸으로
    } else if (D.k === 'level') add(D, ratio(h.lv, L), `Lv ${h.lv} · 이 스테이지 기준 Lv ${L}`);
    else if (D.k === 'kit') {
      const K = H.kitState(), ids = Object.keys(K.lv || {}).filter((id) => K.lv[id] > 0), cap = kitCap(h.lv);
      if (!ids.length) continue;
      const sum = ids.reduce((a, id) => a + Math.min(cap, K.lv[id]), 0);
      add(D, ratio(sum, ids.length * cap), `배운 ${ids.length}개 · 평균 Lv ${(sum / ids.length).toFixed(1).replace(/\.0$/, '')} / 상한 ${cap}`);
    } else if (D.k === 'mastery') {
      const can = MASTERY.filter((m) => m.lv <= h.lv).length;
      if (!can) continue;
      const got = MASTERY.filter((m) => h.mastery.done.includes(m.id) && m.lv <= h.lv).length;
      add(D, ratio(got, can), `익힌 ${got} / 지금 익힐 수 있는 ${can}`);
    } else if (D.k === 'adv') {
      const can = advAt(h.lv);
      if (!can) continue;
      add(D, ratio(Math.min(h.adv || 0, can), can), `${h.adv || 0}차 / Lv ${h.lv}이면 ${can}차까지`);
    } else if (D.k === 'stat') {
      const used = H.spUsed(), room = Math.min(h.lv - 1, SP_KEYS.length * SP_CAP);
      if (room <= 0) continue;
      add(D, ratio(Math.min(used, room), room), `찍은 ${used}점 · 남은 ${H.spFree()}점`);
    }
  }
  let low = null;
  for (const r of rows) if (r.pct < PULSE_OK && (!low || r.pct < low.pct)) low = r;
  return { L, lv: h.lv, rows, low };
}
// 장비 줄 설명 — 낀 칸 · 평균 강화 · 평균 성혼
function gearDesc(G) {
  const slots = Object.keys(G.slots || {}), on = slots.filter((s) => G.eq?.[s]);
  if (!on.length) return '낀 장비 없음';
  const avg = (f) => (on.reduce((a, s) => a + f(G.slots[s]), 0) / on.length).toFixed(1).replace(/\.0$/, '');
  return `낀 ${on.length}/${slots.length}칸 · 강화 평균 +${avg((x) => x.enh || 0)} · 성혼 평균 ${avg((x) => (x.broken ? 0 : x.star || 0))}성`;
}
