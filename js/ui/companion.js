// 동료 탭: 영수 / 신물
import { PETS, GRADES, PET_EGG_COST, OWN_STAT_NAMES, PET_ATTACK_INTERVAL, petDamageMult, RELICS, RELIC_DIG_COST,
  BOND_PER_LV, BOND_MAX, bondProgress, ENGRAVE_MIN_LV, engraveCost,
  CODEX_KINDS, codexEntryPower, OUTFITS, OUTFIT_ALL, outfitTotalCost,
  OUTFIT_GACHA_LVS } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { h, toast, openModal, closeModal, subTabs, gachaLevelBar } from './common.js';

function petView(app) {
  const { game } = app;
  const lvBar = gachaLevelBar(app, 'pet');
  const food = h('b', { style: 'color:#fdba74' });
  const b1 = h('button', { class: 'btn primary', onclick: () => hatch(1) }, `알 1개 원보 ${PET_EGG_COST}`);
  const b10 = h('button', { class: 'btn primary', onclick: () => hatch(10) }, `알 10개 원보 ${PET_EGG_COST * 10}`);
  const rows = {};
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '🥚 영수 부화', h('small', {}, '중복이면 먹이로 바뀌어요')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '영수 먹이 ', food, '개 · 짐승의 숲 수련터에서 얻어요. 데려간 영수가 함께 싸우고, 가진 영수는 모두 보유 효과를 줘요. 데리고 다니면 교감이 쌓여 그 영수의 효과가 커지고, 각인하면 데려가지 않아도 그 효과가 남아요.')),
    lvBar.root);

  for (const pet of PETS) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const lvBtn = h('button', { class: 'buy', onclick: () => { if (game.levelPet(pet.id, 1)) app.refresh(); } });
    const eqBtn = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px', onclick: () => { game.equipPet(pet.id); app.refresh(); } });
    const icon = h('div', { class: 'ico pet-ico' }, pet.emoji);
    const bond = h('div', { class: 'desc', style: 'margin-top:4px' });
    const engBtn = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px', onclick: () => {
      if (game.engravePet(pet.id)) { toast(`${pet.name} 각인 완료`); app.refresh(); } else toast('각인 조건이 안 돼요');
    } });
    rows[pet.id] = { lv, desc, lvBtn, eqBtn, icon, bond, engBtn, row: null };
    rows[pet.id].row = h('div', { class: 'row' }, icon,
      h('div', { class: 'info' }, h('div', { class: 'name', style: `color:${GRADES[pet.grade].color}` }, pet.name, lv), desc, bond),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, lvBtn, eqBtn, engBtn));
    root.append(rows[pet.id].row);
  }

  function hatch(n) {
    const res = game.hatchPets(n);
    if (!res) return toast('원보가 부족해요');
    app.refresh();
    openModal((s) => {
      s.append(h('h2', {}, '부화 결과'));
      const grid = h('div', { class: 'gacha-grid' });
      res.forEach((r, i) => {
        const pet = PETS.find((p) => p.id === r.id);
        grid.append(h('div', { class: `gacha-item${pet.grade >= 3 ? ' shine' : ''}`, style: `border-color:${GRADES[pet.grade].color};animation-delay:${i * 0.06}s` },
          h('span', {}, pet.emoji), h('small', { style: `color:${GRADES[pet.grade].color}` }, r.dup ? `먹이+${r.food}` : 'NEW!')));
      });
      s.append(grid, h('button', { class: 'btn primary', style: 'width:100%', onclick: closeModal }, '확인'));
    });
    return undefined;
  }

  function update() {
    lvBar.update();
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
      r.lvBtn.textContent = `먹이 ${fmt(game.petLevelCost(pet.id))}`;
      r.lvBtn.disabled = !owned || game.s.food < game.petLevelCost(pet.id);
      r.eqBtn.textContent = game.s.pet === pet.id ? '함께하는 중' : '데려가기';
      r.eqBtn.disabled = !owned || game.s.pet === pet.id;

      // 교감 / 각인
      const bp = bondProgress(game.s.bond?.[pet.id] || 0);
      const eng = game.s.engrave?.[pet.id] || 0;
      const applied = game.s.pet === pet.id ? Math.max(bp.lv, eng) : eng;
      if (!owned) {
        r.bond.textContent = '';
        r.engBtn.style.display = 'none';
      } else {
        const gauge = bp.lv >= BOND_MAX ? '교감 최고 단계' : `${fmt(bp.cur)} / ${fmt(bp.need)}`;
        r.bond.innerHTML = `교감 <b>${bp.lv}단계</b> <span class="muted">${gauge}</span>`
          + (eng ? ` · 각인 <b>${eng}단계</b>` : '')
          + `<br>지금 적용: 고유 효과 <b>+${pct(BOND_PER_LV * applied)}</b>`;
        r.engBtn.style.display = '';
        const cost = engraveCost(bp.lv);
        if (bp.lv < ENGRAVE_MIN_LV) {
          r.engBtn.textContent = `각인 ${ENGRAVE_MIN_LV}단계부터`;
          r.engBtn.disabled = true;
        } else if (eng >= bp.lv) {
          r.engBtn.textContent = '각인 완료';
          r.engBtn.disabled = true;
        } else {
          r.engBtn.textContent = `각인 먹이 ${fmt(cost)}`;
          r.engBtn.disabled = game.s.food < cost;
        }
      }
    }
  }
  return { root, update };
}

function relicView(app) {
  const { game } = app;
  const lvBar = gachaLevelBar(app, 'relic');
  const shards = h('b', { style: 'color:#fcd34d' });
  const b1 = h('button', { class: 'btn primary', onclick: () => dig(1) }, `발굴 1회 조각 ${RELIC_DIG_COST}`);
  const b10 = h('button', { class: 'btn primary', onclick: () => dig(10) }, `발굴 10회 조각 ${RELIC_DIG_COST * 10}`);
  const rows = {};
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '🏺 신물 발굴', h('small', {}, '무작위 신물 +1')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '신물 조각 ', shards, '개 · 고대 유적 수련터, 두목 첫 처치, 토벌에서 얻어요.')),
    lvBar.root);
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
    if (!got.length) return toast('신물 조각이 부족해요');
    const count = {};
    got.forEach((id) => { count[id] = (count[id] || 0) + 1; });
    toast(Object.entries(count).map(([id, c]) => `${RELICS.find((x) => x.id === id).icon}+${c}`).join(' '));
    app.refresh();
    return undefined;
  }

  function update() {
    lvBar.update();
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
    { key: 'pet', label: '영수', make: () => petView(app) },
    { key: 'relic', label: '신물', make: () => relicView(app) },
    { key: 'lore', label: '인물도감', make: () => loreCard(app) },
    { key: 'outfit', label: '의복', make: () => outfitView(app) },
  ]);
}

const OWN_LABEL = { atk: '공격력', hp: '체력', gold: '은자', exp: '경험치',
  crit: '치명 확률', critDmg: '치명 피해', boss: '두목 피해', speed: '공격 속도' };
const ownText = (own) => Object.entries(own)
  .map(([k, v]) => `${OWN_LABEL[k] || k} +${pct(v)}`).join(' · ');

// ---------- 의복 ----------
// 입는 것은 하나지만 효과는 가진 것 전부가 더해진다.
// 근거: 공략 "'보유' 효과입니다. 갖고만 있어도 적용되는 효과들이니
// 일단 구매할 수 있는 건 전부 구매하시는 게 좋습니다."
function outfitView(app) {
  const { game } = app;
  const rows = {};
  const sum = h('div', { class: 'desc' });
  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      `입는 건 하나지만 효과는 가진 것 전부가 더해져요. `
      + `병기 소환 레벨이 오르면 하나씩 와요 (${OUTFIT_GACHA_LVS.join('·')}레벨). `
      + `먼저 갖고 싶으면 원보로 사도 돼요. `
      + `전부 모으면 공격력 +${pct(OUTFIT_ALL.atk)} · 치명 확률 +${pct(OUTFIT_ALL.crit)}가 더 붙어요.`),
    h('div', { class: 'section-title' }, h('span', {}, '가진 의복'), sum));

  for (const o of OUTFITS) {
    const name = h('div', { class: 'name', style: 'font-weight:800' });
    const eff = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy' });
    btn.addEventListener('click', () => {
      if (game.hasOutfit(o.id)) { game.wearOutfit(game.s.outfit === o.id ? null : o.id); app.refresh(); return; }
      if (game.buyOutfit(o.id)) app.refresh(); else toast('원보가 부족해요');
    });
    const row = h('div', { class: 'row' },
      h('div', { class: 'ico', style: `color:${o.color}` }, o.name.slice(0, 1)),
      h('div', { style: 'flex:1;min-width:0' }, name, eff), btn);
    root.append(row);
    rows[o.id] = { name, eff, btn, def: o, row };
  }

  function update() {
    const have = game.outfitCount();
    const at = game.nextOutfitAt();
    sum.innerHTML = game.outfitAll()
      ? '<b style="color:var(--accent-2)">전부 모음</b>'
      : `${have}/${OUTFITS.length}`
        + (at ? ` · 다음은 병기 소환 <b>${at}레벨</b>` : '')
        + ` · 전부 사면 원보 ${fmt(outfitTotalCost())}`;
    for (const o of OUTFITS) {
      const r = rows[o.id];
      const owned = game.hasOutfit(o.id);
      const worn = game.s.outfit === o.id;
      r.name.textContent = o.name + (worn ? ' (입는 중)' : '');
      r.eff.textContent = ownText(o.own);
      r.row.style.opacity = owned ? '' : '0.62';
      r.btn.textContent = owned ? (worn ? '벗기' : '입기') : `원보 ${fmt(o.cost)}`;
      r.btn.disabled = !owned && game.s.gems < o.cost;
    }
  }
  return { root, update };
}

// ---------- 인물도감 ----------
// 쓰러뜨린 상대가 기록으로 남아 상시 효과를 준다. 장착하지 않는다.
// 근거: 공략의 "모든 등급 피규어를 하나씩 보유만 해도 공격력 14.78배".
function loreCard(app) {
  const { game } = app;
  const rows = {};
  const total = h('div', { class: 'desc' });
  const root = h('div', {},
    h('div', { class: 'section-title', style: 'margin-top:14px' }, h('span', {}, '인물도감'), total),
    h('p', { class: 'muted', style: 'margin:0 2px 8px' },
      '한 번 쓰러뜨린 상대는 기록에 남아요. 끼우지 않아도 효과가 붙고, 회귀해도 지워지지 않아요.'));

  for (const k of CODEX_KINDS) {
    const grid = h('div', { class: 'grades' });
    const cells = GRADES.map((g, i) => {
      const mark = h('span', { class: 'g-cnt' });
      const cell = h('div', { class: 'grade', style: `border-color:${g.color}` },
        h('span', { style: `color:${g.color};font-weight:800` }, g.name), h('br'), mark);
      grid.append(cell);
      return { cell, mark, i };
    });
    const sub = h('div', { class: 'desc' });
    root.append(h('div', { class: 'card' },
      h('h3', {}, k.name, h('small', { class: 'codex-tag' })), grid, sub));
    rows[k.id] = { cells, sub, def: k, tag: root.lastChild.querySelector('.codex-tag') };
  }

  function update() {
    let done = 0;
    for (const k of CODEX_KINDS) {
      const r = rows[k.id];
      const row = game.s.lore?.[k.id] || [];
      for (const c of r.cells) {
        const got = !!row[c.i];
        c.mark.textContent = got ? '기록' : '—';
        c.cell.classList.toggle('none', !got);
        c.cell.classList.toggle('noted', got);
      }
      const n = game.loreCount(k.id);
      const full = game.loreFull(k.id);
      if (full) done++;
      r.tag.textContent = `${n}/${GRADES.length}`;
      r.tag.classList.toggle('full', full);
      const sum = { atk: 0, hp: 0 };
      row.forEach((v, g) => {
        if (!v) return;
        const add = codexEntryPower(k, g);
        for (const kk in add) sum[kk] += add[kk];
      });
      r.sub.innerHTML = `공격력 <b>+${pct(sum.atk)}</b> · 체력 <b>+${pct(sum.hp)}</b>`
        + (full ? ` · <b style="color:var(--accent-2)">완성 효과 켜짐</b>` : '');
    }
    total.innerHTML = done === CODEX_KINDS.length
      ? '<b style="color:var(--accent-2)">전부 완성</b>'
      : `${done}/${CODEX_KINDS.length} 종류 완성`;
  }
  return { root, update };
}
