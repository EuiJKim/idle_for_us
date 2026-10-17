// 병기 탭: 뽑기·합성·제련
import { GRADES, EQUIP_TYPES, MERGE_COUNT, GACHA_COST, GACHA10_COST, ENHANCE_PER } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { h, toast, openModal, closeModal, gradeChip } from './common.js';

export function equipTab(app) {
  const { game } = app;
  const cards = {};
  const b1 = h('button', { class: 'btn primary', onclick: () => doGacha(1) });
  const b10 = h('button', { class: 'btn primary', onclick: () => doGacha(10) });
  const mergeBtn = h('button', { class: 'btn good', onclick: () => {
    const n = game.mergeAll();
    toast(n ? `합성 ${n}회 완료!` : `같은 등급 병기가 ${MERGE_COUNT}개 있어야 합성돼요`);
    app.refresh();
  } }, '⚒️ 모두 합성');
  const stones = h('b', { style: 'color:#93c5fd' });

  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '병기 뽑기', h('small', {}, '가장 좋은 병기 자동 장착')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, mergeBtn),
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        `같은 등급 ${MERGE_COUNT}개 → 상위 1개. 보유한 등급마다 보유 효과가 더해져요.`)),
    h('div', { class: 'section-title' }, h('span', {}, '鐵 제련석 ', stones), h('span', {}, '비경·두목·의뢰에서 획득')));

  for (const [type, def] of Object.entries(EQUIP_TYPES)) {
    const grid = h('div', { class: 'grades' });
    const cells = GRADES.map((g, i) => {
      const cnt = h('span', { class: 'g-cnt' });
      const cell = h('div', { class: 'grade', style: `border-color:${g.color}` },
        h('span', { class: 'g-ico' }, def.icon), h('span', { style: `color:${g.color};font-weight:800` }, g.name), h('br'), cnt);
      grid.append(cell);
      return { cell, cnt, i };
    });
    const bonus = h('div', { class: 'equip-bonus' });
    const enhLv = h('small');
    const enhBtn = h('button', { class: 'buy', onclick: () => { if (game.enhanceEquip(type, 1)) app.refresh(); } });
    const enh10 = h('button', { class: 'buy', style: 'min-width:56px', onclick: () => { if (game.enhanceEquip(type, 10)) app.refresh(); } }, 'x10');
    cards[type] = { cells, bonus, def, enhLv, enhBtn, enh10 };
    root.append(h('div', { class: 'card' },
      h('h3', {}, `${def.icon} ${def.name}`, enhLv), grid, bonus,
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;align-items:center' },
        h('span', { class: 'muted', style: 'flex:1' }, `제련 1단계마다 ${def.label} 배율 +${pct(ENHANCE_PER)}`), enhBtn, enh10)));
  }

  function doGacha(n) {
    const res = game.gacha(n);
    if (!res) return toast('寶 원보가 부족해요');
    app.refresh();
    res.sort((a, b) => b.grade - a.grade);
    openModal((s) => {
      s.append(h('h2', {}, `뽑기 결과 (${n}회)`));
      const grid = h('div', { class: 'gacha-grid' });
      res.forEach((r, i) => grid.append(h('div', {
        class: `gacha-item${r.grade >= 3 ? ' shine' : ''}`, style: `border-color:${GRADES[r.grade].color};animation-delay:${i * 0.05}s`,
      }, h('span', {}, EQUIP_TYPES[r.type].icon), h('small', { style: `color:${GRADES[r.grade].color}` }, GRADES[r.grade].name))));
      s.append(grid);
      const best = res[0];
      if (best.grade >= 3) s.append(h('p', { style: 'text-align:center' }, '✨ ', gradeChip(best.grade), ` ${EQUIP_TYPES[best.type].name} 획득!`));
      s.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: closeModal }, '닫기'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); doGacha(n); } }, `한 번 더 (寶${n === 10 ? GACHA10_COST : GACHA_COST * n})`)));
    });
    return undefined;
  }

  function update() {
    b1.textContent = `1회 寶${GACHA_COST}`;
    b10.textContent = `10회 寶${GACHA10_COST}`;
    b1.disabled = game.s.gems < GACHA_COST;
    b10.disabled = game.s.gems < GACHA10_COST;
    stones.textContent = fmt(game.s.stones);
    for (const [type, c] of Object.entries(cards)) {
      const arr = game.s.equips[type];
      const best = game.bestGrade(type);
      for (const { cell, cnt, i } of c.cells) {
        cnt.textContent = arr[i];
        cell.classList.toggle('none', arr[i] === 0);
        cell.classList.toggle('best', i === best);
      }
      const own = arr.reduce((acc, n, g) => acc + (n > 0 ? c.def.own[g] : 0), 0);
      const e = game.s.enhance[type] || 0;
      c.enhLv.textContent = `+${e} 제련`;
      c.bonus.innerHTML = best < 0
        ? '아직 병기가 없어요'
        : `장착(${GRADES[best].name}) <b>+${pct(c.def.equip[best])}</b> · 보유 <b>+${pct(own)}</b> · 제련 <b>×${(1 + ENHANCE_PER * e).toFixed(2)}</b> → ${c.def.label} <b>×${fmt(game.equipMult(type))}</b>`;
      c.enhBtn.textContent = `鐵 ${fmt(game.enhanceCost(type))}`;
      c.enhBtn.disabled = game.s.stones < game.enhanceCost(type);
      c.enh10.disabled = c.enhBtn.disabled;
    }
  }
  return { root, update };
}
