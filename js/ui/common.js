import { big } from '../big.js';
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

// 올랐을 때 화면이 반응하게 한다. 그림 파일 없이 CSS만 쓴다.
//
// 근거: Blade Idle UI에 FX_UI_LevelUp 계열이 53개 있다. 저쪽은 올릴 때마다
// 뭔가 터지는데 우리는 숫자만 조용히 바뀌어서, 눌러도 올린 느낌이 없었다.
export function popUp(el, text) {
  if (!el) return;
  el.classList.remove('lvup');
  void el.offsetWidth;            // 연달아 눌러도 다시 터지게 한다
  el.classList.add('lvup');
  if (text) {
    const tag = h('span', { class: 'lvup-tag' }, text);
    el.append(tag);
    setTimeout(() => tag.remove(), 900);
  }
  setTimeout(() => el.classList.remove('lvup'), 500);
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

// v는 보통 숫자일 수도 Big일 수도 있다. 백분율·배수는 작은 값이라
// 숫자로 써도 되지만, Big이 올 수 있으니 toFixed를 쓰는 쪽만 조심한다.
export const fmtValue = (def, v) => (def.fmt === 'pct' ? pct(v)
  : def.fmt === 'x' ? (big(v).gte(1000) ? `${fmt(v)}배` : `${big(v).toFixed(2)}배`) : fmt(v));
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

// 쓰는 자원을 창 머리에 띄우기 위한 정의.
//
// 전에는 창 머리에 은자·원보만 박혀 있었다. 그런데 무공은 비급으로 올리고
// 병기는 한철로 제련한다 — **쓰는 자원이 화면에 없어서** 글 속 "비급 480"을
// 읽고도 내가 몇 개인지 알 수 없었다. 화면마다 자기가 쓰는 것만 올린다.
export const RES_DEFS = {
  gold:   { cur: 'silver', ch: '은', name: '은자', get: (g) => g.s.gold },
  gems:   { cur: 'gem',    ch: '원', name: '원보', get: (g) => g.s.gems },
  books:  { cur: 'book',   ch: '비', name: '비급', get: (g) => g.s.books },
  stones: { cur: 'stone',  ch: '철', name: '한철', get: (g) => g.s.stones },
  food:   { cur: 'food',   ch: '먹', name: '먹이', get: (g) => g.s.food },
  shards: { cur: 'shard',  ch: '조', name: '조각', get: (g) => g.s.relicShards },
  merit:  { cur: 'merit',  ch: '공', name: '공적', get: (g) => g.s.merit },
};

// 탭 안의 하위 탭(세그먼트). views: [{key, label, make: () => view}]
// 고른 화면이 res를 들고 있으면 그대로 올려 준다 — 창 머리가 그걸 띄운다.
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
    // 창 머리 자원칸이 바로 따라오게 알린다. UI 갱신은 0.2초마다라
    // 이 알림이 없으면 하위 탭을 눌러도 잠깐 옛 자원이 남아 있었다.
    document.dispatchEvent(new CustomEvent('subtab'));
    made[key].shown?.();
    made[key].update();
  }
  const root = h('div', {}, h('div', { class: 'subtabs' }, seg), body);
  select(views[0].key);
  return {
    root,
    res: () => made[cur]?.res || null,
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
  // x100을 더했다. 수련 축이 열여섯이라 x10으로는 손가락이 먼저 지친다.
  const seg = h('div', { class: 'seg' }, ...[1, 10, 100, 'MAX'].map((m) =>
    h('button', { class: m === 1 ? 'on' : '', onclick: (e) => {
      mult = m;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      onChange?.(m);
    } }, m === 'MAX' ? 'MAX' : `x${m}`)));
  return { el: seg, get: () => mult, times: () => (mult === 'MAX' ? 100000 : mult) };
}

// ---------- 꾹 누르기 ----------
//
// 올릴 게 많아지면서 한 번에 한 칸씩 누르는 게 일이 됐다. 누르고 있으면
// 알아서 계속 눌린다. 처음엔 느리게, 쥐고 있을수록 빨라진다.
//
// 포인터 사건 하나로 마우스·손가락을 같이 받는다. 손을 떼거나 버튼이
// 꺼지거나 창이 가려지면 멈춘다 — 안 멈추면 가진 걸 다 써 버린다.
// 꾹 누르는 동안은 화면을 **몰아서** 고친다. 한 번 누를 때마다 전체를
// 다시 그리면 초당 열여덟 번이라 손이 먼저 느껴진다.
let softTimer = null;
export function softRefresh(app) {
  if (softTimer) return;
  softTimer = setTimeout(() => { softTimer = null; app.refresh(); }, 90);
}

export const HOLD_FIRST_MS = 420;   // 이만큼 쥐고 있으면 되풀이가 시작된다
export const HOLD_MIN_MS = 55;      // 가장 빠를 때 간격
export function holdRepeat(btn, fn) {
  let timer = null;
  let gap = 260;
  let held = 0;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    gap = 260;
    held = 0;
    btn.classList.remove('holding');
  };
  const step = () => {
    if (btn.disabled) return stop();
    fn();
    held += 1;
    // 쥐고 있을수록 빨라진다. 열 번쯤 지나면 최고 속도다.
    gap = Math.max(HOLD_MIN_MS, gap * 0.82);
    timer = setTimeout(step, gap);
    return undefined;
  };
  btn.addEventListener('pointerdown', (e) => {
    if (btn.disabled || e.button > 0) return;
    btn.classList.add('holding');
    timer = setTimeout(step, HOLD_FIRST_MS);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return stop;
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

// Big은 `a < b`가 안 먹는다(valueOf를 일부러 안 뒀다). 모자라는지 보는
// 자리는 전부 여기를 지난다 — 안 그러면 단추가 영영 안 잠긴다.
export const short = (have, cost) => !big(have).gte(cost);
export const atLeast = (have, cost) => big(have).gte(cost);
