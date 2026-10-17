// 동료 탭: 펫 / 유물
import { PETS, GRADES, PET_EGG_COST, OWN_STAT_NAMES, PET_ATTACK_INTERVAL, petDamageMult, RELICS, RELIC_DIG_COST } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { h, toast, openModal, closeModal, subTabs } from './common.js';

function petView(app) {
  const { game } = app;
  const food = h('b', { style: 'color:#fdba74' });
  const b1 = h('button', { class: 'btn primary', onclick: () => hatch(1) }, `알 1개 💎${PET_EGG_COST}`);
  const b10 = h('button', { class: 'btn primary', onclick: () => hatch(10) }, `알 10개 💎${PET_EGG_COST * 10}`);
  const rows = {};
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '🥚 펫 부화', h('small', {}, '중복이면 먹이로 바뀌어요')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '🍖 펫 먹이 ', food, '개 · 짐승의 숲 던전에서 얻어요. 장착한 펫이 함께 싸우고, 가진 펫은 모두 보유 효과를 줘요.')));

  for (const pet of PETS) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const lvBtn = h('button', { class: 'buy', onclick: () => { if (game.levelPet(pet.id, 1)) app.refresh(); } });
    const eqBtn = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px', onclick: () => { game.equipPet(pet.id); app.refresh(); } });
    const icon = h('div', { class: 'ico pet-ico' }, pet.emoji);
    rows[pet.id] = { lv, desc, lvBtn, eqBtn, icon, row: null };
    rows[pet.id].row = h('div', { class: 'row' }, icon,
      h('div', { class: 'info' }, h('div', { class: 'name', style: `color:${GRADES[pet.grade].color}` }, pet.name, lv), desc),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, lvBtn, eqBtn));
    root.append(rows[pet.id].row);
  }

  function hatch(n) {
    const res = game.hatchPets(n);
    if (!res) return toast('💎 다이아가 부족해요');
    app.refresh();
    openModal((s) => {
      s.append(h('h2', {}, '부화 결과'));
      const grid = h('div', { class: 'gacha-grid' });
      res.forEach((r, i) => {
        const pet = PETS.find((p) => p.id === r.id);
        grid.append(h('div', { class: `gacha-item${pet.grade >= 3 ? ' shine' : ''}`, style: `border-color:${GRADES[pet.grade].color};animation-delay:${i * 0.06}s` },
          h('span', {}, pet.emoji), h('small', { style: `color:${GRADES[pet.grade].color}` }, r.dup ? `🍖+${r.food}` : 'NEW!')));
      });
      s.append(grid, h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '확인'));
    });
    return undefined;
  }

  function update() {
    food.textContent = fmt(game.s.food);
    b1.disabled = game.s.gems < PET_EGG_COST;
    b10.disabled = game.s.gems < PET_EGG_COST * 10;
    for (const pet of PETS) {
      const r = rows[pet.id];
      const l = game.s.pets[pet.id] || 0;
      const owned = l > 0;
      r.row.style.opacity = owned ? '' : '0.5';
      r.icon.classList.toggle('equipped', game.s.pet === pet.id);
      r.lv.textContent = owned ? `Lv.${l}` : `${GRADES[pet.grade].name} · 미보유`;
      const [stat, per] = pet.own;
      r.desc.innerHTML = `${PET_ATTACK_INTERVAL}초마다 공격력의 <b>${pct(petDamageMult(pet, Math.max(1, l)))}</b> 피해<br>보유 효과: ${OWN_STAT_NAMES[stat]} <b>+${pct(per * Math.max(1, l))}</b>`;
      r.lvBtn.textContent = `🍖 ${fmt(game.petLevelCost(pet.id))}`;
      r.lvBtn.disabled = !owned || game.s.food < game.petLevelCost(pet.id);
      r.eqBtn.textContent = game.s.pet === pet.id ? '함께하는 중' : '데려가기';
      r.eqBtn.disabled = !owned || game.s.pet === pet.id;
    }
  }
  return { root, update };
}

function relicView(app) {
  const { game } = app;
  const shards = h('b', { style: 'color:#fcd34d' });
  const b1 = h('button', { class: 'btn primary', onclick: () => dig(1) }, `발굴 1회 🧩${RELIC_DIG_COST}`);
  const b10 = h('button', { class: 'btn primary', onclick: () => dig(10) }, `발굴 10회 🧩${RELIC_DIG_COST * 10}`);
  const rows = {};
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '🏺 유물 발굴', h('small', {}, '무작위 유물 +1')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '🧩 유물 조각 ', shards, '개 · 고대 유적 던전, 보스 첫 처치, 레이드에서 얻어요.')));
  for (const r of RELICS) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const bar = h('div', { class: 'bar', style: 'height:8px;margin:4px 0 0' }, h('div'));
    rows[r.id] = { lv, desc, bar };
    root.append(h('div', { class: 'row' }, h('div', { class: 'ico' }, r.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, r.name, lv), desc, bar)));
  }

  function dig(n) {
    const got = game.digRelic(n);
    if (!got.length) return toast('🧩 유물 조각이 부족해요');
    const count = {};
    got.forEach((id) => { count[id] = (count[id] || 0) + 1; });
    toast(Object.entries(count).map(([id, c]) => `${RELICS.find((x) => x.id === id).icon}+${c}`).join(' '));
    app.refresh();
    return undefined;
  }

  function update() {
    shards.textContent = fmt(game.s.relicShards);
    b1.disabled = game.s.relicShards < RELIC_DIG_COST;
    b10.disabled = game.s.relicShards < RELIC_DIG_COST * 10;
    for (const r of RELICS) {
      const l = game.s.relics[r.id] || 0;
      const el = rows[r.id];
      el.lv.textContent = `Lv.${l} / ${r.max}`;
      const v = r.per * l;
      el.desc.innerHTML = `${r.text} <b>+${r.unit ? `${v}${r.unit}` : pct(v)}</b> (레벨당 +${r.unit ? `${r.per}${r.unit}` : pct(r.per)})`;
      el.bar.firstChild.style.width = `${(l / r.max) * 100}%`;
    }
  }
  return { root, update };
}

export function companionTab(app) {
  return subTabs([
    { key: 'pet', label: '펫', make: () => petView(app) },
    { key: 'relic', label: '유물', make: () => relicView(app) },
  ]);
}
