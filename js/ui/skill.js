// 무공 탭: 비급으로 연마, 4칸 장착
import { SKILLS, SKILL_SLOTS, SKILL_PIERCE_MAX, SKILL_PIERCE_AT, SKILL_PIERCE_MULT,
  skillTotalBonus, nextSkillTotalStep, PRESET_SLOTS, nextSkillSlotAt, jobOf } from '../data.js';
import { fmt } from '../fmt.js';
import { h, openModal, closeModal, toast, popUp } from './common.js';

export function skillTab(app) {
  const { game } = app;
  const rows = {};
  const books = h('b', { style: 'color:#fca5a5' });
  const autoBtn = h('button', { class: 'btn', style: 'padding:6px 10px', onclick: () => { game.s.autoSkill = !game.s.autoSkill; app.refresh(); } });
  const slotsEl = h('div', { class: 'slots' });
  const slotInfo = h('small');
  const totalLv = h('small');
  const totalInfo = h('div', { class: 'desc' });
  // 출진 준비: 무공 넷 + 영수를 한 벌로 담아 두고 바꿔 끼운다
  const presetWrap = h('div', { class: 'preset-wrap' });
  const presetRows = Array.from({ length: PRESET_SLOTS }, (_, i) => {
    // prompt()는 PWA·웹뷰에서 막히는 곳이 있다(점검에서 잡혔다). 모달로 받는다.
    const label = h('button', { class: 'preset-name', onclick: () => {
      openModal((s) => {
        const input = h('input', { class: 'field', maxlength: '8', value: game.s.presets[i].name });
        s.append(
          h('h2', {}, '준비 이름'),
          h('p', { class: 'muted' }, '여덟 글자까지 쓸 수 있어요.'),
          input,
          h('div', { class: 'btn-row', style: 'margin-top:10px' },
            h('button', { class: 'btn', onclick: closeModal }, '취소'),
            h('button', { class: 'btn primary', onclick: () => {
              game.renamePreset(i, input.value);
              closeModal();
              app.refresh();
            } }, '바꾸기')),
        );
        setTimeout(() => input.focus(), 30);
      });
    } });
    const load = h('button', { class: 'buy', style: 'font-size:11px', onclick: () => {
      if (game.loadPreset(i)) { toast(`${game.s.presets[i].name} 준비로 바꿨어요`); app.refresh(); }
      else toast('아직 담아둔 게 없어요');
    } });
    const save = h('button', { class: 'btn', style: 'padding:5px 9px;font-size:11px', onclick: () => {
      game.savePreset(i); toast(`${game.s.presets[i].name}에 담았어요`); app.refresh();
    } }, '담기');
    presetWrap.append(h('div', { class: 'preset-row' }, label, load, save));
    return { label, load, save, i };
  });
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '장착 무공', slotInfo, autoBtn),
      slotsEl,
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '비급 ', books, '개 · 두목을 잡거나 의뢰를 깨면 얻어요')),
    h('div', { class: 'card' },
      h('h3', {}, '무공 총 연마', totalLv),
      totalInfo,
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        '모든 무공 레벨을 더한 값에 보너스가 붙어요. 칸은 넷뿐이지만 안 쓰는 무공을 올릴 이유가 돼요.')),
    h('div', { class: 'card' },
      h('h3', {}, '출진 준비'),
      presetWrap,
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        '무공 넷과 영수를 한 벌로 담아 두고 바꿔 끼워요. 사냥용·두목용·벌이용을 따로 두면 편해요.')));

  SKILLS.forEach((sk) => {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const eq = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px' });
    eq.onclick = () => toggleEquip(sk);
    const btn = h('button', { class: 'buy', onclick: () => {
      if (!game.upgradeSkill(sk.id)) return;
      popUp(rows[sk.id].row, `Lv.${game.s.skills[sk.id]}`);
      app.refresh();
    } });
    const pierce = h('button', { class: 'buy', style: 'font-size:11px', onclick: () => {
      if (game.skillPierce(sk.id)) { popUp(rows[sk.id].row, '초월!'); app.refresh(); }
      else toast(`${SKILL_PIERCE_AT}레벨부터 초월할 수 있고 비급이 필요해요`);
    } });
    rows[sk.id] = { lv, desc, btn, eq, pierce, row: null };
    rows[sk.id].row = h('div', { class: 'row' },
      h('div', { class: 'ico' }, sk.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, sk.name, lv), desc),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:stretch' }, btn, pierce, eq));
    root.append(rows[sk.id].row);
  });

  function toggleEquip(sk) {
    if (sk.job) { toast('계열 무공은 문파 칸에만 들어가요'); return; }
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
    const nSlot = game.skillSlotCount();
    const nextAt = nextSkillSlotAt(game.s.bestStage);
    slotInfo.textContent = nextAt ? `${nSlot}칸 · ${nextAt}관문에 한 칸 더` : `${nSlot}칸 (최대)`;
    for (const r of presetRows) {
      const p2 = game.s.presets[r.i];
      const on = game.presetReady(r.i);
      r.label.textContent = p2.name;
      const names = on ? p2.slots.map((id) => SKILLS.find((x) => x.id === id)?.name || '빈칸').join('·') : '비어 있음';
      r.load.textContent = '꺼내기';
      r.load.disabled = !on;
      r.load.title = names;
    }
    const tot = game.skillTotalLevel();
    const tb = skillTotalBonus(tot);
    const nx = nextSkillTotalStep(tot);
    totalLv.textContent = `합계 ${tot}`;
    totalInfo.innerHTML = `공격력 <b>+${Math.round(tb.atk * 100)}%</b>`
      + (tb.crit ? ` · 치명 확률 <b>+${(tb.crit * 100).toFixed(0)}%p</b>` : '')
      + (tb.critDmg ? ` · 치명 피해 <b>+${Math.round(tb.critDmg * 100)}%p</b>` : '')
      + (nx ? `<br><span class="tier-hint">합계 ${nx.at}에서 공격력 +${Math.round(nx.atk * 100)}% — ${nx.at - tot} 남음</span>` : '');
    const jsk = game.jobSkill();
    const sig = game.s.skillSlots.join(',') + ':' + game.skillSlotCount() + ':' + (jsk?.id || '-')
      + ':' + (jsk ? game.s.skills[jsk.id] : 0) + ':' + (game.s.job ? 1 : 0);
    if (sig !== slotSig) {
      slotSig = sig;
      const cells = Array.from({ length: game.skillSlotCount() }, (_, i) => {
        const sk = SKILLS.find((x) => x.id === game.s.skillSlots[i]);
        return h('div', { class: 'slot' }, h('span', {}, sk?.icon || '＋'), h('small', {}, sk ? `${sk.name} Lv.${game.s.skills[sk.id]}` : '빈 칸'));
      });
      // 문파 칸 — 일반 칸을 먹지 않고 하나 더 붙는다
      if (jsk || game.tasteOpen() || game.jobOpen()) {
        const col = jobOf(game.s.job || game.s.taste)?.color || 'var(--muted)';
        cells.push(h('div', { class: 'slot', style: `outline:1px solid ${col}` },
          h('span', {}, jsk?.icon || '문파'),
          h('small', {}, jsk ? `${jsk.name} Lv.${game.s.skills[jsk.id]}` : '문파 칸')));
      }
      slotsEl.replaceChildren(...cells);
    }
    for (const sk of SKILLS) {
      const r = rows[sk.id];
      const l = game.s.skills[sk.id];
      const unlocked = game.skillUnlocked(sk);
      const equipped = game.s.skillSlots.includes(sk.id);
      r.row.style.opacity = unlocked ? '' : '0.5';
      r.lv.textContent = unlocked ? `Lv.${l}`
        : sk.job ? `${jobOf(sk.job)?.name || ''} 전용` : `관문 ${sk.unlock} 해금`;
      const pi = game.skillPierceOf(sk.id);
      const boost = 1 + SKILL_PIERCE_MULT * pi;
      const cdNow = game.skillCdOf(sk);
      r.desc.innerHTML = `${sk.desc(sk.mult(l) * boost, l)} · 쿨 ${cdNow.toFixed(1)}초`
        + (cdNow < sk.cd - 0.05 ? ` <small style="color:var(--muted)">(본디 ${sk.cd}초)</small>` : '')
        + (pi ? ` · <b style="color:var(--accent-2)">${pi}초월</b>` : '')
        + `<br>다음: <b>${sk.desc(sk.mult(l + 1) * boost, l + 1)}</b>`;
      r.btn.textContent = `비급 ${game.skillUpgradeCost(sk.id)}`;
      r.btn.disabled = !unlocked || game.s.books < game.skillUpgradeCost(sk.id);
      const canP = game.canSkillPierce(sk.id);
      const pcost = game.skillPierceCost(sk.id);
      r.pierce.textContent = pi >= SKILL_PIERCE_MAX ? '초월 최대'
        : l < SKILL_PIERCE_AT ? `초월 Lv.${SKILL_PIERCE_AT}`
          : `초월 비급 ${fmt(pcost)}`;
      r.pierce.disabled = !canP || game.s.books < pcost;
      if (sk.job) {
        r.eq.textContent = unlocked ? '문파 칸' : '잠김';
        r.eq.disabled = true;
        r.eq.classList.toggle('good', unlocked);
      } else {
        r.eq.textContent = equipped ? '해제' : '장착';
        r.eq.disabled = !unlocked;
        r.eq.classList.toggle('good', equipped);
      }
    }
  }
  return { root, update };
}

