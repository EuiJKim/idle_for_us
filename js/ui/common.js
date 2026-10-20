// 공통 DOM 도우미, 모달, 토스트, 하위 탭
import { GRADES, GACHA_LV_MAX, GACHA_GRADE_OPEN, gachaLvNeed, gachaMaxGrade } from '../data.js';
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

// 연속 도전 토글. 켜 두면 한 판이 끝날 때마다 알아서 다시 들어간다.
// (지면 끊긴다 — game.js retryLoop)
export function loopBtn(app, kind, id = null) {
  const b = h('button', { class: 'btn loop-btn' });
  b.addEventListener('click', () => {
    const on = app.game.setLoop(kind, id);
    app.refresh();
    toast(on ? '연속 도전을 켰어요 — 질 때까지 이어서 해요' : '연속 도전을 껐어요');
  });
  b.update = () => {
    const on = app.game.loopOn(kind, id);
    b.textContent = on ? '연속 ON' : '연속';
    b.classList.toggle('good', on);
  };
  b.update();
  return b;
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
  if (r.gold) parts.push(`은자 ${fmt(r.gold)}`);
  if (r.gems) parts.push(`원보 ${fmt(r.gems)}`);
  if (r.books) parts.push(`비급 ${fmt(r.books)}`);
  if (r.stones) parts.push(`한철 ${fmt(r.stones)}`);
  if (r.food) parts.push(`먹이 ${fmt(r.food)}`);
  if (r.relicShards) parts.push(`조각 ${fmt(r.relicShards)}`);
  return parts.join(' ');
}

// 탭 안의 하위 탭(세그먼트). views: [{key, label, make: () => view}]
export function subTabs(views) {
  let cur = null;
  const made = {};
  const body = h('div');
  const seg = h('div', { class: 'seg wide' });
  const buttons = views.map((v) => {
    const b = h('button', { 'data-key': v.key, onclick: () => select(v.key) }, v.label);
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

// 소환 레벨 막대. 레벨이 상위 등급을 열고, 레벨 자체가 보상이 된다.
// 근거: GachaLvUpTable + 공략 "갓1등급은 소환 12레벨 이후" / "6레벨 달성보상 선택상자 8개"
export function gachaLevelBar(app, kind) {
  const { game } = app;
  const title = h('div', { style: 'font-weight:800;font-size:13px' });
  const sub = h('div', { class: 'desc' });
  const fill = h('div');
  const bar = h('div', { class: 'bar' }, fill);
  const btn = h('button', { class: 'buy', onclick: () => {
    const got = game.claimGachaRewards(kind);
    if (!got) return toast('아직 받을 보상이 없어요');
    toast(`소환 레벨 보상을 받았어요`);
    app.refresh();
    return undefined;
  } });
  const root = h('div', { class: 'card gacha-lv' },
    h('div', { style: 'display:flex;gap:8px;align-items:center' },
      h('div', { style: 'flex:1;min-width:0' }, title, sub), btn),
    bar);

  function update() {
    const g = game.gachaInfo(kind);
    const need = gachaLvNeed(g.lv);
    const cap = gachaMaxGrade(g.lv);
    title.textContent = `소환 레벨 ${g.lv} / ${GACHA_LV_MAX}`;
    const nextOpen = GACHA_GRADE_OPEN.findIndex((v, i) => i > cap && v > g.lv);
    sub.innerHTML = `지금은 <b style="color:${GRADES[cap].color}">${GRADES[cap].name}</b>까지 나와요`
      + (nextOpen > 0 ? ` · ${GACHA_GRADE_OPEN[nextOpen]}레벨에 <b style="color:${GRADES[nextOpen].color}">${GRADES[nextOpen].name}</b>` : '');
    fill.style.width = `${g.lv >= GACHA_LV_MAX ? 100 : Math.min(100, (g.cnt / need) * 100)}%`;
    const ready = game.gachaRewardReady(kind);
    btn.textContent = ready ? '보상 받기' : `다음까지 ${Math.max(0, need - g.cnt)}회`;
    btn.disabled = !ready;
    btn.classList.toggle('ready', ready);
  }
  return { root, update };
}
