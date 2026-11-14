// 새 시즌(S1) 세이브 — 값 + 검사값(서명) · 표 판(계획서 §L2 · §L7).
// 목적: 세이브 글자를 손으로 고치면 검사값이 안 맞아 들킨다. 서명이 안 맞는 세이브는 게임은 계속하되
//   「서열에 못 올림」 표시를 단다(남과 견주는 곳만 지킨다). 열쇠가 코드에 있으니 마음먹은 사람은 뚫는다 — 대충 고치기를 막는 층.
// 시즌이 다르면 열쇠(ifu.s2.*)가 달라 옛 시즌 세이브와 섞이지 않는다.
import { TABLE_VER, tableHash } from '../tables/version.js';

export const SAVE_KEY = 'ifu.s2.save';
export const SAVE_VER = 1;
const SALT = 'ifu-s2-무협-2026';

// 순서를 고정한 JSON(키 정렬) — 같은 값이면 어느 기기에서도 같은 글자
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// 64비트 FNV-1a(32비트 둘) → 16자 16진수
export function hash64(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c ^ (h1 >>> 7), 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
export const sign = (body) => hash64(SALT + canon(body));

// 쓸 때: { v, tv, th, at, body, sig }
export function pack(body, at) {
  const head = { v: SAVE_VER, tv: TABLE_VER, th: tableHash(), at };
  return JSON.stringify({ ...head, body, sig: sign({ ...head, body }) });
}
// 읽을 때: { body, ok:서명 맞음, tableOk:표 판 같음, why }
export function unpack(text) {
  let o;
  try { o = JSON.parse(text); } catch { return { body: null, ok: false, tableOk: false, why: 'json' }; }
  if (!o || typeof o !== 'object' || !o.body) return { body: null, ok: false, tableOk: false, why: 'empty' };
  const { sig, ...rest } = o;
  const ok = sig === sign(rest);
  return { body: o.body, ok, tableOk: o.tv === TABLE_VER && o.th === tableHash(), at: o.at, why: ok ? '' : 'sig' };
}
