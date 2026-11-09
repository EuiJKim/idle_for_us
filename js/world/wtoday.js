// 오늘의 강호 (v262) — 돌아올 까닭. 서버 없이 되는 것만.
//
// · 하루 과제 셋: 한국 시간 하루마다 아래 묶음에서 셋을 고른다(날짜로 정해지는 씨앗 — 같은 날엔 같은 셋).
//   다 하면 '받기' — 그 레벨에서 사냥 몇 분어치 은자 + 주간 점수.
// · 주간 상자: 한 주(월요일 0시, 한국 시간) 동안 모은 점수가 WEEK_NEED가 되면 한 번 연다.
// · 혈겁: 하루 두 번(12~14시, 20~22시, 한국 시간) 두 시간 — 사냥터 은자·재료 +30%, 정예가 더 자주 나온다.
import { kstDay, kstWeekday } from './wdgn.js';
import { mobGold } from './wdata.js';

// counter: 그날 센 것(wgame.tday로 올린다) · need(level): 얼마나
export const TASKS = [
  { id: 'kill', name: '몹 처치', counter: 'kill', need: () => 1500, desc: (n) => `몹 ${n}마리를 잡자` },
  { id: 'elite', name: '정예 처치', counter: 'elite', need: () => 30, desc: (n) => `정예 ${n}마리를 잡자` },
  { id: 'boss', name: '두목 처치', counter: 'boss', need: () => 5, desc: (n) => `두목을 ${n}번 쓰러뜨리자` },
  { id: 'treasure', name: '보물 원숭이', counter: 'treasure', need: () => 1, desc: () => '보물 원숭이를 잡자' },
  { id: 'daily', name: '일일 던전', counter: 'daily', need: () => 3, desc: (n) => `일일 던전을 ${n}번 돌자(소탕 포함)` },
  { id: 'enhance', name: '강화', counter: 'enhance', need: () => 5, desc: (n) => `장비를 ${n}번 강화하자` },
  { id: 'tower', name: '무한의 탑', counter: 'tower', need: () => 1, desc: () => '무한의 탑에 한 번 오르자' },
  { id: 'potion', name: '보약', counter: 'elixir', need: () => 1, desc: () => '보약을 한 번 마시자' },
];
export const TASKS_PER_DAY = 3;
export const WEEK_NEED = 15;          // 하루 셋 × 닷새
export const TASK_POINT = 1;
export const TASK_GOLD_MIN = 12;      // 과제 하나 = 그 레벨 사냥 12분어치 은자

// 날짜로 정해지는 씨앗 — 같은 날엔 같은 과제
function seedOf(day) { let h = 2166136261; for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function tasksOf(day) {
  let s = seedOf(day) || 1;
  const rnd = () => ((s = Math.imul(s, 1103515245) + 12345 >>> 0) / 4294967296);
  const pool = TASKS.slice();
  const out = [];
  while (out.length < TASKS_PER_DAY && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
export const taskGold = (level) => Math.round(mobGold(level) * 100 * TASK_GOLD_MIN);
// 주(週) 열쇠 — 그 주 월요일의 날짜
export function weekKey(now = Date.now()) {
  const wd = kstWeekday(now);
  return kstDay(now - ((wd + 6) % 7) * 86400e3);
}
// 주간 상자 — 사냥 두 시간어치 은자 · 보호부 셋 · 영약 한 시간
export const weekChest = (level) => ({ gold: Math.round(mobGold(level) * 100 * 120), prot: 3, elixirSec: 3600 });

// 혈겁 — [시작 시, 끝 시) 한국 시간
export const BLOOD_HOURS = [[12, 14], [20, 22]];
export const BLOOD_BONUS = 0.3;
export const BLOOD_ELITE = 2;          // 정예가 나올 확률 배수
export function kstHour(now = Date.now()) { const d = new Date(now + 9 * 3600e3); return d.getUTCHours() + d.getUTCMinutes() / 60; }
export function bloodOn(now = Date.now()) { const hr = kstHour(now); return BLOOD_HOURS.some(([a, b]) => hr >= a && hr < b); }
// 다음 혈겁까지 남은 초(지금이 혈겁이면 끝날 때까지 남은 초를 음수로)
export function bloodNext(now = Date.now()) {
  const hr = kstHour(now);
  for (const [a, b] of BLOOD_HOURS) if (hr >= a && hr < b) return -Math.round((b - hr) * 3600);
  for (const [a] of BLOOD_HOURS) if (hr < a) return Math.round((a - hr) * 3600);
  return Math.round((24 - hr + BLOOD_HOURS[0][0]) * 3600);
}

// v320 출석부 — 7일이 한 바퀴(빠져도 끊기지 않는다 · 하루에 한 칸). 7일째가 크다
export const ATT_DAYS = 7;
export function attReward(day, level) {
  const g = weekChest(level).gold;
  switch (day) {
    case 1: return { gold: Math.round(g * 0.15), text: '은자' };
    case 2: return { potions: 100, text: '물약 100' };
    case 3: return { prot: 1, text: '보호부 1' };
    case 4: return { petShard: 20, mountShard: 20, text: '조각 20씩' };
    case 5: return { elixirSec: 1800, text: '보약 30분' };
    case 6: return { gold: Math.round(g * 0.3), text: '은자' };
    default: return { gold: Math.round(g * 0.5), prot: 3, soul: 15, text: '은자·보호부 3·혼 15' };
  }
}
