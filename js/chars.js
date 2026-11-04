// v328 캐릭터 칸 — 한 계정(한 기기)에 무인을 넷까지.
//   지금 하는 캐릭터의 세이브는 늘 W.SAVE_KEY(전과 같은 자리 — 저장·백업·서버 맞추기가 그대로 돈다).
//   쉬는 캐릭터는 `${SAVE_KEY}.c{칸}`에, 칸 목록(이름·레벨·직업·꾸미기)은 ifu.chars에.
//   바꿀 때: 지금 세이브를 제 칸에 넣고 → 고른 칸의 세이브를 W.SAVE_KEY로 → 새로 연다.
//   Google 계정이면 쉬는 캐릭터도 서버(saves/{uid}/chars/{칸})에 올려 다른 기기에서 고를 수 있다.
import * as W from './world/wdata.js';

export const MAX_CHARS = 4;
const IDX = 'ifu.chars';
const SKIP = 'ifu.skipSelect';
const TRIAL = 'ifu.trial';
export const slotKey = (i) => `${W.SAVE_KEY}.c${i}`;
const BAK = [`${W.SAVE_KEY}.bak1`, `${W.SAVE_KEY}.bak2`];

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 사생활 모드 */ } },
};
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 이번만 */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* 이번만 */ } },
};

// 칸 하나의 짧은 모습 — 고르기 창에 그린다(세이브 전체를 읽지 않아도)
export function summarize(s, slot) {
  return { slot, n: String(s?.nickname || '').slice(0, 16), lv: Math.floor(Number(s?.level) || 1), job: s?.job || null,
    tier: Math.floor(Number(s?.jobTier) || 0), at: Number(s?.lastSeen) || Date.now() };
}
export function readIndex() {
  try {
    const o = JSON.parse(ls.get(IDX) || 'null');
    if (o && Array.isArray(o.list) && Number.isInteger(o.act)) {
      o.list = o.list.filter((e) => e && Number.isInteger(e.slot) && e.slot >= 0 && e.slot < MAX_CHARS);
      if (o.act < 0 || o.act >= MAX_CHARS) o.act = 0;
      return o;
    }
  } catch { /* 망가졌으면 새로 */ }
  return { act: 0, list: [] };
}
export function writeIndex(o) { ls.set(IDX, JSON.stringify(o)); }
function upsert(o, e) {
  const i = o.list.findIndex((x) => x.slot === e.slot);
  if (i >= 0) o.list[i] = { ...o.list[i], ...e }; else o.list.push(e);
  o.list.sort((a, b) => a.slot - b.slot);
}
// 켤 때 — 지금 세이브(이름이 있으면)를 목록에 반영한다. 옛 판(칸이 없던 때)의 세이브는 0번 칸이 된다.
export function syncActive(s) {
  const o = readIndex();
  if (s && (s.nickname || s.job)) upsert(o, summarize(s, o.act));
  writeIndex(o);
  return o;
}
export function freeSlot(o) { for (let i = 0; i < MAX_CHARS; i++) if (!o.list.some((x) => x.slot === i)) return i; return -1; }
export function slotJSON(slot) { return ls.get(slotKey(slot)); }

// 지금 캐릭터를 제 칸에 넣고 slot으로 바꾼다. json이 없으면 새 캐릭터(빈 세이브). 성공하면 true — 부른 쪽이 새로 연다.
export function switchTo(slot, curJSON, json) {
  const o = readIndex();
  if (curJSON) {
    try { upsert(o, summarize(JSON.parse(curJSON), o.act)); } catch { /* 이름 없는 세이브 */ }
    if (!ls.set(slotKey(o.act), curJSON)) return false;
  }
  if (json) { if (!ls.set(W.SAVE_KEY, json)) return false; ls.del(slotKey(slot)); }
  else ls.del(W.SAVE_KEY);
  for (const k of BAK) ls.del(k);   // 백업은 지금 캐릭터 것 — 다른 캐릭터로 되살아나지 않게
  o.act = slot;
  writeIndex(o);
  ss.set(SKIP, '1');   // 새로 열면 고르기 창을 건너뛴다(방금 골랐다)
  return true;
}
// 쉬는 캐릭터 지우기(지금 하는 캐릭터는 못 지운다)
export function removeChar(slot) {
  const o = readIndex();
  if (slot === o.act) return false;
  o.list = o.list.filter((x) => x.slot !== slot);
  ls.del(slotKey(slot));
  writeIndex(o);
  return true;
}
// 서버 진행으로 바꿀 때(다른 기기에서 다른 칸을 하던 중) — 지금 세이브를 제 칸에 남기고 그 칸을 지금으로
export function adoptSlot(slot, curJSON) {
  const o = readIndex();
  if (!Number.isInteger(slot) || slot === o.act) return;
  if (curJSON) { try { upsert(o, summarize(JSON.parse(curJSON), o.act)); ls.set(slotKey(o.act), curJSON); } catch { /* */ } }
  o.act = slot;
  writeIndex(o);
}
export function takeSkip() { const v = ss.get(SKIP) === '1'; ss.del(SKIP); return v; }
export function setSkip() { ss.set(SKIP, '1'); }
// 체험 모드 — 이번 탭에서만(저장 안 함)
export function trialJob() { return ss.get(TRIAL); }
export function startTrial(job) { ss.set(TRIAL, job); }
export function endTrial() { ss.del(TRIAL); }
// 다른 기기에서 하던 다른 캐릭터(서버의 '지금 캐릭터')를 그 칸으로 받아 둔다 — 이 기기 것보다 새것일 때만
export function storeSlot(slot, json) {
  const o = readIndex();
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARS || slot === o.act) return false;
  let s;
  try { s = JSON.parse(json); } catch { return false; }
  let mine = 0;
  try { mine = Number(JSON.parse(slotJSON(slot) || 'null')?.lastSeen) || 0; } catch { /* 없음 */ }
  if ((Number(s.lastSeen) || 0) < mine) return false;
  if (!ls.set(slotKey(slot), json)) return false;
  upsert(o, summarize(s, slot));
  writeIndex(o);
  return true;
}
