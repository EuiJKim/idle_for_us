// 무공 탭: 비급으로 연마, 4칸 장착
import { SKILLS, SKILL_SLOTS } from '../data.js';
import { fmt } from '../fmt.js';
import { h, openModal, closeModal } from './common.js';

export function skillTab(app) {
  const { game } = app;
  const rows = {};
  const books = h('b', { style: 'color:#fca5a5' });
  const autoBtn = h('button', { class: 'btn', style: 'padding:6px 10px', onclick: () => { game.s.autoSkill = !game.s.autoSkill; app.refresh(); } });
  const slotsEl = h('div', { class: 'slots' });
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '장착 무공', autoBtn),
      slotsEl,
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '비급 ', books, '개 · 두목를 잡거나 의뢰을 깨면 얻어요')));

  SKILLS.forEach((sk) => {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const eq = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px' });
    eq.onclick = () => toggleEquip(sk);
    const btn = h('button', { class: 'buy', onclick: () => { if (game.upgradeSkill(sk.id)) app.refresh(); } });
    rows[sk.id] = { lv, desc, btn, eq, row: null };
    rows[sk.id].row = h('div', { class: 'row' },
      h('div', { class: 'ico' }, sk.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, sk.name, lv), desc),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:stretch' }, btn, eq));
    root.append(rows[sk.id].row);
  });

  function toggleEquip(sk) {
    const slots = game.s.skillSlots;
    const at = slots.indexOf(sk.id);
    if (at >= 0) { game.setSkillSlot(at, null); app.refresh(); return; }
    const free = slots.indexOf(null);
    if (free >= 0) { game.setSkillSlot(free, sk.id); app.refresh(); return; }
    openModal((s) => {
      s.append(h('h2', {}, `${sk.icon} ${sk.name} 장착`), h('p', { class: 'muted' }, '바꿀 칸을 고르세요.'));
      const grid = h('div', { class: 'slots' });
      slots.forEach((id, i) => {
        const cur = SKILLS.find((x) => x.id === id);
        grid.append(h('button', { class: 'slot', onclick: () => { game.setSkillSlot(i, sk.id); closeModal(); app.refresh(); } },
          h('span', {}, cur?.icon || '＋'), h('small', {}, cur?.name || '빈 칸')));
      });
      s.append(grid, h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '취소'));
    });
  }

  let slotSig = '';
  function update() {
    autoBtn.textContent = game.s.autoSkill ? '자동 ON' : '자동 OFF';
    autoBtn.classList.toggle('good', game.s.autoSkill);
    books.textContent = fmt(game.s.books);
    const sig = game.s.skillSlots.join(',');
    if (sig !== slotSig) {
      slotSig = sig;
      slotsEl.replaceChildren(...Array.from({ length: SKILL_SLOTS }, (_, i) => {
        const sk = SKILLS.find((x) => x.id === game.s.skillSlots[i]);
        return h('div', { class: 'slot' }, h('span', {}, sk?.icon || '＋'), h('small', {}, sk ? `${sk.name} Lv.${game.s.skills[sk.id]}` : '빈 칸'));
      }));
    }
    for (const sk of SKILLS) {
      const r = rows[sk.id];
      const l = game.s.skills[sk.id];
      const unlocked = game.skillUnlocked(sk);
      const equipped = game.s.skillSlots.includes(sk.id);
      r.row.style.opacity = unlocked ? '' : '0.5';
      r.lv.textContent = unlocked ? `Lv.${l}` : `관문 ${sk.unlock} 해금`;
      r.desc.innerHTML = `${sk.desc(sk.mult(l))} · 쿨 ${sk.cd}초<br>다음: <b>${sk.desc(sk.mult(l + 1))}</b>`;
      r.btn.textContent = `비급 ${game.skillUpgradeCost(sk.id)}`;
      r.btn.disabled = !unlocked || game.s.books < game.skillUpgradeCost(sk.id);
      r.eq.textContent = equipped ? '해제' : '장착';
      r.eq.disabled = !unlocked;
      r.eq.classList.toggle('good', equipped);
    }
  }
  return { root, update };
}

