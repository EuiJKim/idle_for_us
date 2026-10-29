// 사냥터의 땅 (v127) — 지형(막힌 칸) · 기운(지역 고유 환경) · 숙련도 · 보물 원숭이.
// 설계: docs/바람식_개편.md 'v127'
import { COLS, ROWS, mapOf } from './wdata.js';

// ---------- 기운 (지역 고유 환경) ----------
// 지역마다 하나. 나쁜 기운은 저항(숙련도 · 갑옷·모자의 저항 옵션)만큼 약해진다. 좋은 기운은 그대로.
// 효과 키: move 이동 · speed 공격 속도 · regen 회복 · drain 초당 최대 체력 잃음 · mobAtk 몹 공격력
//          dodge 회피 · gold 은자 · exp 경험치 · cd 스킬 숨 · crit 치명(%p)
export const RES_TYPES = { cold: '한기', heat: '열기', poison: '독기', dark: '마기' };
export const ENVS = {
  1: { name: '대숲 바람', good: true, eff: { move: 0.1 }, desc: '이동 +10%' },
  2: { name: '열사', type: 'heat', eff: { regen: -0.5, mobAtk: 0.1 }, desc: '회복 -50% · 몹 공격 +10%' },
  3: { name: '혹한', type: 'cold', eff: { move: -0.2, speed: -0.1 }, desc: '이동 -20% · 공격 속도 -10%' },
  4: { name: '혈독', type: 'poison', eff: { drain: 0.006 }, desc: '초당 체력 -0.6%' },
  5: { name: '음기', type: 'dark', eff: { mobAtk: 0.2, regen: -0.3 }, desc: '몹 공격 +20% · 회복 -30%' },
  6: { name: '운무', good: true, eff: { dodge: 0.1 }, desc: '10% 확률로 공격을 흘린다' },
  7: { name: '마기', type: 'dark', eff: { mobAtk: 0.25 }, desc: '몹 공격 +25%' },
  8: { name: '물살', type: 'cold', eff: { move: -0.15 }, desc: '이동 -15%' },
  9: { name: '불광', good: true, eff: { regen: 0.5 }, desc: '회복 +50%' },
  10: { name: '야시장', good: true, eff: { gold: 0.25 }, desc: '은자 +25%' },
  11: { name: '벼랑 바람', type: 'cold', eff: { speed: -0.12 }, desc: '공격 속도 -12%' },
  12: { name: '독무', type: 'poison', eff: { drain: 0.008 }, desc: '초당 체력 -0.8%' },
  13: { name: '시독', type: 'poison', eff: { drain: 0.004, mobAtk: 0.15 }, desc: '초당 체력 -0.4% · 몹 공격 +15%' },
  14: { name: '해풍', good: true, eff: { exp: 0.1 }, desc: '경험치 +10%' },
  15: { name: '허공', type: 'dark', eff: { cd: 0.2 }, desc: '스킬 숨 +20%' },
  16: { name: '도화향', good: true, eff: { crit: 0.05 }, desc: '치명 +5%p' },
  17: { name: '황명', good: true, eff: { gold: 0.2, exp: 0.05 }, desc: '은자 +20% · 경험치 +5%' },
  18: { name: '당문 독안개', type: 'poison', eff: { drain: 0.01 }, desc: '초당 체력 -1%' },
  19: { name: '극한', type: 'cold', eff: { move: -0.25, speed: -0.15 }, desc: '이동 -25% · 공격 속도 -15%' },
  20: { name: '열화', type: 'heat', eff: { regen: -0.6, drain: 0.005 }, desc: '회복 -60% · 초당 체력 -0.5%' },
  21: { name: '선기', good: true, eff: { cd: -0.1 }, desc: '스킬 숨 -10%' },
};
export const envOf = (map) => (map && !map.town && !map.inst ? ENVS[map.art] || null : null);
// 저항을 셈한 실제 효과 — 나쁜 쪽(음수인 좋은 효과 · 양수인 나쁜 효과)만 줄인다
const BAD_UP = new Set(['mobAtk', 'drain', 'cd']);
export function envEffect(env, res = 0) {
  const out = {};
  if (!env) return out;
  for (const [k, v] of Object.entries(env.eff)) {
    const bad = BAD_UP.has(k) ? v > 0 : v < 0;
    out[k] = bad ? v * (1 - Math.min(0.9, res)) : v;
  }
  return out;
}
// 갑옷·모자 저항 옵션 (조합·두목 드랍 때 40%로 붙는다). 등급별 값
export const RES_OPT_CHANCE = 0.4;
export const RES_OPT_VALS = [0.2, 0.3, 0.45, 0.6];

// ---------- 숙련도 ----------
// 한 지역에서 잡은 수만큼 오른다(레벨 0~10). 레벨마다 경험치 +2% · 재료 +3% · 그 지역 나쁜 기운 저항 +8%.
export const MASTERY_KILLS = [0, 150, 450, 1000, 2000, 3500, 6000, 9500, 14000, 20000, 28000];
export const MASTERY_MAX = MASTERY_KILLS.length - 1;
export function masteryLv(kills) {
  let lv = 0;
  while (lv < MASTERY_MAX && kills >= MASTERY_KILLS[lv + 1]) lv++;
  return lv;
}
export const MASTERY = { exp: 0.02, mat: 0.03, res: 0.08 };

// ---------- 보물 원숭이 ----------
// 들판(두목 구역 말고)에서 몹을 잡으면 가끔 황금 원숭이가 나타나 달아난다. 25초 안에 잡으면 은자·재료가 쏟아진다.
export const TREASURE_RATE = 1 / 300;
export const TREASURE_LIFE = 25;
export const TREASURE_HP = 8;          // 같은 레벨 몹 체력의 몇 배
export const TREASURE_GOLD = 150;      // 같은 레벨 몹 은자의 몇 배
export const TREASURE_MATS = 20;
export const TREASURE_MARK = 0.3;      // 두목 증표 하나가 붙을 확률
export const TREASURE_DEF = { name: '황금 원숭이', beast: 'gape', bscale: 1.7 };

// ---------- 지형 ----------
// 사냥터마다 막힌 칸(나무·바위·물·기둥 …). 지역 그림(art)으로 생김새를 고르고, 구역마다 씨앗이 달라 모양이 다르다.
// 들어서는 자리(아래 가운데)와 두목이 나서는 자리는 비워 두고, 빈 칸끼리는 늘 이어지게(갇힌 칸이 없게) 놓는다.
// kind: 그리는 쪽(js/obstacles.js)이 그림을 고른다. low: 바닥에 납작하게(물·용암)
export const OBSTACLES = {
  tree: {}, bamboo: {}, peach: {}, rock: {}, ice: {}, tomb: {}, pillar: {}, stall: {}, cliff: {}, crystal: {}, cactus: {}, brazier: {}, coral: {}, pine: {},
  water: { low: true }, lava: { low: true },
};
// 그림별 땅 모양 — style: clusters(덩이) · river(물줄기와 다리) · pillars(좌우 대칭 기둥) · grid(줄 맞춘 비석) · rows(가판 줄) · walls(벼랑)
const THEMES = {
  1: { style: 'clusters', kinds: ['bamboo', 'bamboo', 'rock'], n: 6 },
  2: { style: 'clusters', kinds: ['cactus', 'rock', 'rock'], n: 5 },
  3: { style: 'clusters', kinds: ['pine', 'ice', 'ice'], n: 6 },
  4: { style: 'walls', kinds: ['rock'], n: 3 },
  5: { style: 'grid', kinds: ['tomb'], n: 0 },
  6: { style: 'pillars', kinds: ['pillar'], n: 0 },
  7: { style: 'pillars', kinds: ['brazier', 'pillar'], n: 0 },
  8: { style: 'river', kinds: ['water'], deco: ['rock'], n: 2 },
  9: { style: 'pillars', kinds: ['pillar'], n: 0 },
  10: { style: 'rows', kinds: ['stall'], n: 0 },
  11: { style: 'walls', kinds: ['cliff'], n: 3 },
  12: { style: 'clusters', kinds: ['tree', 'tree', 'rock'], n: 7 },
  13: { style: 'grid', kinds: ['tomb', 'pillar'], n: 0 },
  14: { style: 'river', kinds: ['water'], deco: ['coral', 'rock'], n: 3 },
  15: { style: 'clusters', kinds: ['crystal'], n: 6 },
  16: { style: 'clusters', kinds: ['peach', 'peach', 'rock'], n: 7 },
  17: { style: 'pillars', kinds: ['pillar', 'brazier'], n: 0 },
  18: { style: 'clusters', kinds: ['tree', 'bamboo'], n: 7 },
  19: { style: 'clusters', kinds: ['ice', 'ice', 'pillar'], n: 7 },
  20: { style: 'river', kinds: ['lava'], deco: ['rock'], n: 3 },
  21: { style: 'pillars', kinds: ['pine', 'pillar'], n: 0 },
};
const ENTRY = { c: Math.floor(COLS / 2), r: ROWS - 3 };
function seeded(seed) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const idx = (c, r) => r * COLS + c;
// 비워 둘 칸 — 들어서는 자리 둘레, 두목 자리 둘레, 맨 아래 줄
function reserved(c, r, boss) {
  if (Math.abs(c - ENTRY.c) <= 1 && r >= ROWS - 5) return true;
  if (boss && Math.abs(c - ENTRY.c) <= 2 && r >= 2 && r <= 8) return true;
  return false;
}
// 빈 칸이 모두 이어져 있나 (들어서는 자리에서 넓이 우선)
function connected(grid) {
  const seen = new Uint8Array(COLS * ROWS);
  const q = [idx(ENTRY.c, ENTRY.r)];
  seen[q[0]] = 1;
  let n = 0;
  for (let i = 0; i < q.length; i++) {
    n++;
    const k = q[i], c = k % COLS, r = (k - c) / COLS;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const j = idx(nc, nr);
      if (seen[j] || grid[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  let free = 0;
  for (let i = 0; i < grid.length; i++) if (!grid[i]) free++;
  return n === free;
}
const KIND_ID = Object.keys(OBSTACLES);
const _cache = new Map();
// 지도 하나의 지형 — { grid: Uint8Array(칸마다 0 빈칸 / 1+ 그림 번호), list: [{ c, r, kind, seed }] }
export function terrainOf(id) {
  if (_cache.has(id)) return _cache.get(id);
  const m = mapOf(id);
  let out = null;
  const th = !m.town && !m.inst && THEMES[m.art];
  if (th) {
    const rng = seeded(id * 7919 + 13);
    const grid = new Uint8Array(COLS * ROWS);
    const boss = m.bossRoom;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    // 놓아 보고, 길이 끊기면 거둔다
    const put = (c, r, kind) => {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || reserved(c, r, boss)) return false;
      const k = idx(c, r);
      if (grid[k]) return false;
      grid[k] = KIND_ID.indexOf(kind) + 1;
      if (!connected(grid)) { grid[k] = 0; return false; }
      return true;
    };
    const scale = boss ? 0.5 : 1;     // 두목 구역은 넓게 (싸울 자리)
    const area = m.area || 1;
    if (th.style === 'clusters') {
      const n = Math.round((th.n + area - 1) * scale);
      for (let i = 0; i < n; i++) {
        let c = Math.floor(rng() * COLS), r = 1 + Math.floor(rng() * (ROWS - 5));
        const kind = pick(th.kinds);
        const size = 1 + Math.floor(rng() * 3);
        for (let j = 0; j < size; j++) { put(c, r, kind); if (rng() < 0.5) c += rng() < 0.5 ? 1 : -1; else r += rng() < 0.5 ? 1 : -1; }
      }
    } else if (th.style === 'river') {
      // 가로 물줄기 하나(두목 구역은 위쪽 짧게) — 다리 둘
      const r0 = boss ? 10 : 6 + Math.floor(rng() * 5);
      const gaps = new Set([Math.floor(rng() * 3), 3 + Math.floor(rng() * 3), 6 + Math.floor(rng() * 3)].slice(0, boss ? 3 : 2 + Math.floor(rng() * 2)));
      for (let c = 0; c < COLS; c++) if (!gaps.has(c)) { put(c, r0, th.kinds[0]); if (!boss && area >= 2) put(c, r0 + 1, th.kinds[0]); }
      for (let i = 0; i < Math.round(th.n * scale); i++) put(Math.floor(rng() * COLS), 1 + Math.floor(rng() * (ROWS - 5)), pick(th.deco));
    } else if (th.style === 'pillars') {
      const rowsP = boss ? [3, 9] : [3, 7, 11].concat(area >= 2 ? [5, 9] : []);
      for (const r of rowsP) {
        const k = pick(th.kinds);
        const cc = area === 3 || boss ? [1, 7] : rng() < 0.5 ? [1, 7] : [2, 6];
        for (const c of cc) put(c, r, k);
      }
    } else if (th.style === 'grid') {
      for (let r = 2; r < ROWS - 4; r += 3) for (let c = (r % 2) ? 1 : 2; c < COLS; c += 3) if (rng() < (boss ? 0.35 : 0.7)) put(c, r, pick(th.kinds));
    } else if (th.style === 'rows') {
      for (const r of boss ? [3, 10] : [3, 7, 11]) {
        const len = 2 + Math.floor(rng() * 2);
        const c0 = rng() < 0.5 ? 0 : COLS - len;
        for (let c = c0; c < c0 + len; c++) put(c, r, th.kinds[0]);
      }
    } else if (th.style === 'walls') {
      // 벼랑이 좌우에서 번갈아 튀어나온다 — 지그재그 길
      const rowsW = boss ? [4] : [4, 8, 12].slice(0, th.n);
      rowsW.forEach((r, i) => {
        const len = 3 + Math.floor(rng() * 2);
        const left = (i + area) % 2 === 0;
        for (let k = 0; k < len; k++) put(left ? k : COLS - 1 - k, r, th.kinds[0]);
      });
    }
    const list = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[idx(c, r)]) { const kind = KIND_ID[grid[idx(c, r)] - 1]; list.push({ c, r, kind, low: !!OBSTACLES[kind].low, seed: (c * 31 + r * 17 + id) % 97 / 97 }); }
    out = { grid, list };
  }
  _cache.set(id, out);
  return out;
}
export const isLow = (kind) => !!OBSTACLES[kind]?.low;
