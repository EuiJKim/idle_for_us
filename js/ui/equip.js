// 병기 탭: 뽑기·합성·제련
import { GRADES, EQUIP_TYPES, MERGE_COUNT, GACHA_COST, GACHA10_COST, ENHANCE_PER, CODEX_PER_TYPE, CODEX_ALL,
  OPTION_SLOTS, OPTION_STATS, OPTION_SET_GRADE, OPTION_SET, OPTION_SET_FULL_GRADE, OPTION_SET_FULL,
  nextOptionSlotAt } from '../data.js';
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
        `같은 등급 ${MERGE_COUNT}개 → 상위 1개. 한 번 손에 쥔 등급은 병기보에 남아서, `
        + '합성에 써도 보유 효과는 그대로예요.'),
      h('p', { class: 'muted', style: 'margin:4px 0 0' },
        `한 부위를 빠짐없이 채우면 치명타 확률 +${pct(CODEX_PER_TYPE.crit)}, `
        + `세 부위 모두 채우면 치명타 피해 +${pct(CODEX_ALL.critDmg)}`)),
    h('div', { class: 'section-title' }, h('span', {}, '제련석 ', stones), h('span', {}, '수련터·두목·의뢰에서 획득')));

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
    const codexLv = h('small', { class: 'codex-tag' });
    const enhLv = h('small');
    const optWrap = h('div', { class: 'opt-wrap' });
    const optCells = Array.from({ length: OPTION_SLOTS }, (_, i) => {
      const txt = h('span', { class: 'opt-txt' });
      const lock = h('button', { class: 'opt-lock', onclick: () => { game.toggleOptionLock(type, i); app.refresh(); } }, '잠금');
      const cell = h('div', { class: 'opt-cell' }, txt, lock);
      optWrap.append(cell);
      return { cell, txt, lock, i };
    });
    const optInfo = h('div', { class: 'desc' });
    const rerollBtn = h('button', { class: 'buy', onclick: () => {
      const r = game.rerollOptions(type);
      if (!r) return toast('한철이 부족하거나 아직 칸이 안 열렸어요');
      app.refresh();
      return undefined;
    } });
    const enhBtn = h('button', { class: 'buy', onclick: () => { if (game.enhanceEquip(type, 1)) app.refresh(); } });
    const enh10 = h('button', { class: 'buy', style: 'min-width:56px', onclick: () => { if (game.enhanceEquip(type, 10)) app.refresh(); } }, 'x10');
    cards[type] = { cells, bonus, def, enhLv, enhBtn, enh10, codexLv, optCells, optInfo, rerollBtn, optWrap };
    root.append(h('div', { class: 'card' },
      h('h3', {}, `${def.icon} ${def.name}`, codexLv, enhLv), grid, bonus,
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;align-items:center' },
        h('span', { class: 'muted', style: 'flex:1' }, `제련 1단계마다 ${def.label} 배율 +${pct(ENHANCE_PER)}`), enhBtn, enh10),
      h('div', { class: 'section-title', style: 'margin:12px 2px 6px' }, h('span', {}, '옵션 칸'), optInfo),
      optWrap,
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;align-items:center' },
        h('span', { class: 'muted', style: 'flex:1' },
          `네 칸을 ${GRADES[OPTION_SET_GRADE].name} 이상으로 채우면 치명 확률 +${pct(OPTION_SET.crit)} · 치명 피해 +${pct(OPTION_SET.critDmg)}`),
        rerollBtn)));
  }

  function doGacha(n) {
    const res = game.gacha(n);
    if (!res) return toast('원보가 부족해요');
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
        h('button', { class: 'btn primary', onclick: () => { closeModal(); doGacha(n); } }, `한 번 더 (원보 ${n === 10 ? GACHA10_COST : GACHA_COST * n})`)));
    });
    return undefined;
  }

  function update() {
    b1.textContent = `1회 원보 ${GACHA_COST}`;
    b10.textContent = `10회 원보 ${GACHA10_COST}`;
    b1.disabled = game.s.gems < GACHA_COST;
    b10.disabled = game.s.gems < GACHA10_COST;
    stones.textContent = fmt(game.s.stones);
    for (const [type, c] of Object.entries(cards)) {
      const arr = game.s.equips[type];
      const seen = game.s.codex?.[type] || [];
      const best = game.bestGrade(type);
      for (const { cell, cnt, i } of c.cells) {
        // 지금 없어도 병기보에 적혀 있으면 표시를 남긴다
        cnt.textContent = arr[i] ? arr[i] : (seen[i] ? '기록' : 0);
        cell.classList.toggle('none', arr[i] === 0 && !seen[i]);
        cell.classList.toggle('noted', arr[i] === 0 && !!seen[i]);
        cell.classList.toggle('best', i === best);
      }
      const done = game.codexCount(type);
      c.codexLv.textContent = `병기보 ${done}/${GRADES.length}`;
      c.codexLv.classList.toggle('full', done === GRADES.length);
      const own = seen.reduce((acc, v, g) => acc + (v ? c.def.own[g] : 0), 0);
      const e = game.s.enhance[type] || 0;
      c.enhLv.textContent = `+${e} 제련`;
      c.bonus.innerHTML = best < 0
        ? '아직 병기가 없어요'
        : `장착(${GRADES[best].name}) <b>+${pct(c.def.equip[best])}</b> · 병기보 <b>+${pct(own)}</b> · 제련 <b>×${(1 + ENHANCE_PER * e).toFixed(2)}</b> → ${c.def.label} <b>×${fmt(game.equipMult(type))}</b>`;
      // ----- 옵션 칸 -----
      const slots = game.optionSlots(type);
      const opts = game.s.options?.[type] || [];
      const lock = game.s.optionLock?.[type] || [];
      for (const o of c.optCells) {
        const open = o.i < slots;
        const v = open ? opts[o.i] : null;
        o.cell.classList.toggle('closed', !open);
        o.cell.classList.toggle('locked', open && !!lock[o.i]);
        if (!open) {
          const need = nextOptionSlotAt(game.s.enhance?.[type] || 0);
          o.txt.innerHTML = `<i>제련 ${need ?? '-'} 단계에 열려요</i>`;
        } else if (!v) {
          o.txt.innerHTML = '<i>비어 있음</i>';
        } else {
          const sd = OPTION_STATS.find((x) => x.id === v.stat);
          const amount = sd ? sd.per[v.grade] * (v.roll || 1) : 0;
          o.txt.innerHTML = `<b style="color:${GRADES[v.grade].color}">${GRADES[v.grade].name}</b> ${sd ? sd.name : v.stat} <b>+${pct(amount)}</b>`;
        }
        o.lock.classList.toggle('on', open && !!lock[o.i]);
        o.lock.disabled = !open || !v;
        o.lock.textContent = lock[o.i] ? '잠김' : '잠금';
      }
      const low = game.optionSetGrade(type);
      c.optInfo.innerHTML = slots === 0
        ? '아직 안 열림'
        : low >= OPTION_SET_FULL_GRADE
          ? `<b style="color:${GRADES[OPTION_SET_FULL_GRADE].color}">보유 효과 (천품) 켜짐</b>`
          : low >= OPTION_SET_GRADE
            ? `<b style="color:${GRADES[OPTION_SET_GRADE].color}">보유 효과 켜짐</b>`
            : `${slots}/${OPTION_SLOTS}칸`;
      const rc = game.optionRerollCost(type);
      c.rerollBtn.textContent = `다시 굴리기 한철 ${fmt(rc)}`;
      c.rerollBtn.disabled = slots === 0 || game.s.stones < rc;

      c.enhBtn.textContent = `한철 ${fmt(game.enhanceCost(type))}`;
      c.enhBtn.disabled = game.s.stones < game.enhanceCost(type);
      c.enh10.disabled = c.enhBtn.disabled;
    }
  }
  return { root, update };
}
