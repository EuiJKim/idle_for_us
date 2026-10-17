// 공통 DOM 도우미, 모달, 토스트, 하위 탭
import { GRADES } from '../data.js';
import { fmt, pct } from '../fmt.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

export function toast(text) {
  const box = document.getElementById('toast');
  const el = h('div', { class: 'toast' }, text);
  box.append(el);
  setTimeout(() => el.remove(), 2700);
  while (box.children.length > 3) box.firstChild.remove();
}

let modalOnClose = null;
export function openModal(build, { dismissable = true, onClose } = {}) {
  const modal = document.getElementById('modal');
  const sheet = modal.querySelector('.sheet');
  sheet.replaceChildren();
  build(sheet);
  modal.classList.remove('hidden');
  modal.onclick = dismissable ? (e) => { if (e.target === modal) closeModal(); } : null;
  modalOnClose = onClose || null;
}
export function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  const cb = modalOnClose;
  modalOnClose = null;
  if (cb) cb();
}
export const modalOpen = () => !document.getElementById('modal').classList.contains('hidden');

export const fmtValue = (def, v) => (def.fmt === 'pct' ? pct(v) : def.fmt === 'x' ? `${v.toFixed(2)}배` : fmt(v));
export const gradeChip = (g) => h('span', { style: `color:${GRADES[g].color};font-weight:800` }, GRADES[g].name);

// 보상 묶음을 한 줄로: {gold, gems, books, stones, food, relicShards}
export function rewardText(r = {}) {
  const parts = [];
  if (r.gold) parts.push(`銀${fmt(r.gold)}`);
  if (r.gems) parts.push(`寶${fmt(r.gems)}`);
  if (r.books) parts.push(`秘${fmt(r.books)}`);
  if (r.stones) parts.push(`鐵${fmt(r.stones)}`);
  if (r.food) parts.push(`草${fmt(r.food)}`);
  if (r.relicShards) parts.push(`片${fmt(r.relicShards)}`);
  return parts.join(' ');
}

// 탭 안의 하위 탭(세그먼트). views: [{key, label, make: () => view}]
export function subTabs(views) {
  let cur = null;
  const made = {};
  const body = h('div');
  const seg = h('div', { class: 'seg wide' });
  const buttons = views.map((v) => {
    const b = h('button', { onclick: () => select(v.key) }, v.label);
    seg.append(b);
    return [v.key, b];
  });
  function select(key) {
    cur = key;
    if (!made[key]) made[key] = views.find((v) => v.key === key).make();
    body.replaceChildren(made[key].root);
    buttons.forEach(([k, b]) => b.classList.toggle('on', k === key));
    made[key].shown?.();
    made[key].update();
  }
  const root = h('div', {}, h('div', { class: 'subtabs' }, seg), body);
  select(views[0].key);
  return {
    root,
    update() { made[cur]?.update(); },
    shown() { made[cur]?.shown?.(); },
    netChanged(what) { Object.values(made).forEach((v) => v.netChanged?.(what)); },
    setDot(key, on) {
      const b = buttons.find(([k]) => k === key)?.[1];
      if (!b) return;
      let dot = b.querySelector('.dot');
      if (on && !dot) b.append(h('i', { class: 'dot' }));
      if (!on && dot) dot.remove();
    },
  };
}

// x1 / x10 / MAX 선택기
export function multSelector(onChange) {
  let mult = 1;
  const seg = h('div', { class: 'seg' }, ...[1, 10, 'MAX'].map((m) =>
    h('button', { class: m === 1 ? 'on' : '', onclick: (e) => {
      mult = m;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      onChange?.(m);
    } }, m === 'MAX' ? 'MAX' : `x${m}`)));
  return { el: seg, get: () => mult, times: () => (mult === 'MAX' ? 100000 : mult) };
}

export function busy(btn, fn) {
  return async () => {
    btn.disabled = true;
    try { await fn(); } catch (err) { toast(err.message || '실패했어요'); } finally { btn.disabled = false; }
  };
}
