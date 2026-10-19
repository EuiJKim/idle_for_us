// 병기 탭: 뽑기·합성·제련
import { GRADES, EQUIP_TYPES, MERGE_COUNT, GACHA_COST, GACHA10_COST, ENHANCE_PER, CODEX_PER_TYPE, CODEX_ALL,
  OPTION_SLOTS, OPTION_STATS, OPTION_SET_GRADE, OPTION_SET, OPTION_SET_FULL_GRADE, OPTION_SET_FULL,
  nextOptionSlotAt,
  ACC_SLOTS, ACC_STAR_MAX, ACC_PIERCE_MAX, ACC_MERGE, accPower, ACC_PICK_MIN,
  ACC_SET_GRADE, ACC_SET,
  equipSetBonus, nextEquipSetStep, equipTotalBonus, nextEquipTotalStep,
  EQUIP_PIERCE_MAX, EQUIP_PIERCE_MULT,
  EGO_PARTS, EGO_STEP_MAX, EGO_FEED_MIN_GRADE, EGO_FEED_EXP, egoPower } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { h, toast, openModal, closeModal, gradeChip, gachaLevelBar } from './common.js';

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

  const lvBar = gachaLevelBar(app, 'equip');
  const setInfo = h('div', { class: 'desc' });
  const totInfo = h('div', { class: 'desc' });
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
    lvBar.root,
    h('div', { class: 'card' },
      h('h3', {}, '한 벌 갖춤'),
      setInfo,
      h('h3', { style: 'margin-top:10px' }, '총 제련'),
      totInfo,
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        '세 부위를 고르게 맞출수록 커져요. 한 부위에만 몰아 쓰면 둘 다 안 붙어요.')),
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
    const prcBtn = h('button', { class: 'buy', onclick: () => {
      if (game.equipPierceUp(type)) app.refresh();
      else toast(`${GRADES[GRADES.length - 1].name} 병기가 더 필요해요 (끼운 하나는 남겨둬요)`);
    } });
    const prcTxt = h('span', { class: 'muted', style: 'flex:1' });
    const enhBtn = h('button', { class: 'buy', onclick: () => { if (game.enhanceEquip(type, 1)) app.refresh(); } });
    const enh10 = h('button', { class: 'buy', style: 'min-width:56px', onclick: () => { if (game.enhanceEquip(type, 10)) app.refresh(); } }, 'x10');
    cards[type] = { cells, bonus, def, enhLv, enhBtn, enh10, prcBtn, prcTxt, codexLv, optCells, optInfo, rerollBtn, optWrap };
    root.append(h('div', { class: 'card' },
      h('h3', {}, def.name, codexLv, enhLv), grid, bonus,
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;align-items:center' },
        h('span', { class: 'muted', style: 'flex:1' }, `제련 1단계마다 ${def.label} 배율 +${pct(ENHANCE_PER)}`), enhBtn, enh10),
      h('div', { style: 'display:flex;gap:6px;margin-top:6px;align-items:center' }, prcTxt, prcBtn),
      h('div', { class: 'section-title', style: 'margin:12px 2px 6px' }, h('span', {}, '옵션 칸'), optInfo),
      optWrap,
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;align-items:center' },
        h('span', { class: 'muted', style: 'flex:1' },
          `네 칸을 ${GRADES[OPTION_SET_GRADE].name} 이상으로 채우면 치명 확률 +${pct(OPTION_SET.crit)} · 치명 피해 +${pct(OPTION_SET.critDmg)}`),
        rerollBtn)));
  }

  // ---------- 심검 ----------
  // 장비를 먹여 키우는 전용 무기. 남은 양보다 많이 먹이면 그대로 버려진다.
  const egoCards = {};
  root.append(h('div', { class: 'section-title', style: 'margin-top:14px' }, h('span', {}, '심검')));
  root.append(h('p', { class: 'muted', style: 'margin:0 2px 8px' },
    `${GRADES[EGO_FEED_MIN_GRADE].name} 이상 장비를 먹여 키워요. 다 차면 승급에 도전하고, `
    + '남은 양보다 많이 먹이면 넘치는 만큼은 그냥 사라져요.'));

  for (const e of EGO_PARTS) {
    const title = h('div', { style: 'font-weight:900;font-size:14px' });
    const info = h('div', { class: 'desc' });
    const fill = h('div');
    const bar = h('div', { class: 'bar', style: 'margin-top:6px' }, fill);
    const feedRow = h('div', { class: 'btn-row', style: 'margin-top:8px' });
    const feeds = {};
    for (let gr = EGO_FEED_MIN_GRADE; gr < GRADES.length; gr++) {
      const b = h('button', { class: 'buy', style: 'font-size:11px' });
      const grade = gr;
      b.addEventListener('click', () => {
        const n = game.feedEgo(e.id, grade, 999);
        if (!n) return toast('먹일 장비가 없거나 이미 꽉 찼어요');
        toast(`${GRADES[grade].name} ${n}개를 먹였어요`);
        app.refresh();
        return undefined;
      });
      feedRow.append(b);
      feeds[gr] = b;
    }
    const upBtn = h('button', { class: 'btn primary', style: 'margin-top:8px;width:100%' });
    upBtn.addEventListener('click', () => {
      if (game.startEgoTrial(e.id)) app.refresh();
      else toast('아직 경험치가 모자라거나 다른 싸움 중이에요');
    });
    root.append(h('div', { class: 'card' }, title, info, bar, feedRow, upBtn));
    egoCards[e.id] = { title, info, fill, feeds, upBtn, def: e };
  }

  function updateEgo() {
    for (const e of EGO_PARTS) {
      const c = egoCards[e.id];
      const open = game.egoOpen(e.id);
      const cur = game.egoOf(e.id);
      const need = game.egoNeed(e.id);
      const done = cur.step >= EGO_STEP_MAX;
      c.title.textContent = `${e.name} ${cur.step}단계${done ? ' (끝)' : ''}`;
      c.info.innerHTML = !open
        ? (e.open ? `관문 ${e.open}에 열려요` : `${EGO_PARTS[0].name}을 끝내면 열려요`)
        : `${e.label} <b>+${pct(egoPower(cur.step))}</b>`
          + (done ? '' : ` · 다음 단계 <b>+${pct(egoPower(cur.step + 1))}</b> · ${fmt(cur.exp)}/${fmt(need)}`);
      c.fill.style.width = done ? '100%' : `${Math.min(100, (cur.exp / need) * 100)}%`;
      for (let gr = EGO_FEED_MIN_GRADE; gr < GRADES.length; gr++) {
        const b = c.feeds[gr];
        const have = Object.keys(EQUIP_TYPES).reduce((a, k) => a + game.s.equips[k][gr], 0);
        const want = open && !done ? game.egoFeedCount(e.id, gr) : 0;
        b.textContent = `${GRADES[gr].name} ${Math.min(have, want || have)}/${have}`;
        b.style.color = GRADES[gr].color;
        b.disabled = !open || done || !have;
      }
      c.upBtn.textContent = done ? '끝까지 올렸어요'
        : !open ? '아직 안 열림'
          : game.egoReady(e.id) ? `${cur.step + 1}단계 승급 도전` : '경험치를 더 채우세요';
      c.upBtn.disabled = !open || done || !game.egoReady(e.id) || game.mode !== 'stage';
    }
  }

  // ---------- 장신구 ----------
  const accCards = {};
  const accSetInfo = h('div', { class: 'desc' });
  root.append(h('div', { class: 'section-title', style: 'margin-top:14px' },
    h('span', {}, '장신구'), accSetInfo));
  root.append(h('p', { class: 'muted', style: 'margin:0 2px 8px' },
    `관문지기를 넘으면 장신구 상자가 나와요. 같은 등급 ${ACC_MERGE}개로 한 성, `
    + `${ACC_STAR_MAX}성이 되면 다음 등급으로 올라가요. 초월은 한철을 쓰고 성과 따로 쌓여요.`));

  // 선택 상자
  const pickInfo = h('div', { class: 'desc' });
  const pickBtns = ACC_SLOTS.map((a) => h('button', { class: 'buy', onclick: () => {
    const got = game.openAccPick(a.id, 1);
    if (!got) return toast('선택 상자가 없어요');
    app.refresh();
    toast(`${a.name} ${GRADES[got[0].grade].name}`);
  } }, a.name));
  const pickCard = h('div', { class: 'card' },
    h('div', { style: 'font-weight:900;font-size:14px' }, '선택 상자'),
    pickInfo,
    h('div', { class: 'btn-row', style: 'margin-top:8px' }, ...pickBtns));
  root.append(pickCard);

  for (const a of ACC_SLOTS) {
    const title = h('div', { style: 'font-weight:900;font-size:14px' });
    const info = h('div', { class: 'desc' });
    const bag = h('div', { class: 'desc' });
    const starBtn = h('button', { class: 'buy', onclick: () => {
      if (game.accStarUp(a.id)) app.refresh(); else toast(`같은 등급 ${ACC_MERGE}개가 필요해요`);
    } });
    const gradeBtn = h('button', { class: 'buy', onclick: () => {
      if (game.accGradeUp(a.id)) app.refresh(); else toast(`${ACC_STAR_MAX}성이 된 뒤 같은 등급 1개가 더 필요해요`);
    } });
    const pierceBtn = h('button', { class: 'buy', onclick: () => {
      if (game.accPierce(a.id)) app.refresh(); else toast('한철이 부족하거나 초월이 끝났어요');
    } });
    root.append(h('div', { class: 'card' },
      title, info, bag,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, starBtn, gradeBtn, pierceBtn)));
    accCards[a.id] = { title, info, bag, starBtn, gradeBtn, pierceBtn, def: a };
  }

  function updateAcc() {
    const np = game.s.accPick || 0;
    pickCard.style.display = np > 0 ? '' : 'none';
    pickInfo.innerHTML = `<b>${np}개</b> — 자리를 골라서 열어요. `
      + `<span style="color:${GRADES[ACC_PICK_MIN].color}">${GRADES[ACC_PICK_MIN].name}</span> 이상만 나와요.`;
    for (const b of pickBtns) b.disabled = np <= 0;
    for (const a of ACC_SLOTS) {
      const c = accCards[a.id];
      const cur = game.s.acc?.[a.id];
      const bag = game.s.accBag?.[a.id] || [];
      if (!cur) {
        c.title.textContent = `${a.name} — 아직 없음`;
        c.info.textContent = `관문지기에게서 장신구 상자를 얻어요`;
      } else {
        c.title.innerHTML = `${a.name} <span style="color:${GRADES[cur.grade].color}">${GRADES[cur.grade].name}</span>`
          + ` <small>${cur.star}성 · ${cur.pierce}초월</small>`;
        c.info.innerHTML = `${a.label} <b>+${pct(accPower(a, cur.grade, cur.star, cur.pierce))}</b>`;
      }
      c.bag.textContent = '쌓인 것 ' + GRADES.map((g, i) => `${g.name} ${bag[i] || 0}`).join(' · ');
      c.starBtn.textContent = cur && cur.star >= ACC_STAR_MAX ? '성 최대' : `승급 (${a.name} ${ACC_MERGE}개)`;
      c.starBtn.disabled = !game.canAccStar(a.id);
      c.gradeBtn.textContent = '등급 올리기';
      c.gradeBtn.disabled = !game.canAccGrade(a.id);
      const pc = cur ? game.accPierceCost(a.id) : Infinity;
      c.pierceBtn.textContent = cur && cur.pierce >= ACC_PIERCE_MAX ? '초월 최대' : `초월 한철 ${fmt(pc)}`;
      c.pierceBtn.disabled = !cur || cur.pierce >= ACC_PIERCE_MAX || game.s.stones < pc;
    }
    const low = game.accSetGrade();
    accSetInfo.innerHTML = low >= ACC_SET_GRADE
      ? `<b style="color:${GRADES[ACC_SET_GRADE].color}">보유 효과 켜짐</b>`
      : `세 자리를 ${GRADES[ACC_SET_GRADE].name} 이상으로 채우면 두목 피해 +${pct(ACC_SET.boss)} · 은자 +${pct(ACC_SET.gold)}`;
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
      const pr = game.s.equipPierce?.[type] || 0;
      c.enhLv.textContent = pr > 0 ? `+${e} 제련 · ${pr}초월` : `+${e} 제련`;
      c.bonus.innerHTML = best < 0
        ? '아직 병기가 없어요'
        : `장착(${GRADES[best].name}) <b>+${pct(c.def.equip[best])}</b> · 병기보 <b>+${pct(own)}</b> · 제련 <b>×${(1 + ENHANCE_PER * e).toFixed(2)}</b>`
          + (pr > 0 ? ` · 초월 <b>×${(1 + EQUIP_PIERCE_MULT * pr).toFixed(2)}</b>` : '')
          + ` → ${c.def.label} <b>×${fmt(game.equipMult(type))}</b>`;
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

      const top = GRADES.length - 1;
      const pcost = game.equipPierceCost(type);
      const held = game.s.equips[type]?.[top] || 0;
      if (pr >= EQUIP_PIERCE_MAX) {
        c.prcTxt.innerHTML = `<b>초월 최대</b> — ${c.def.label} 배율 ×${(1 + EQUIP_PIERCE_MULT * pr).toFixed(2)}`;
        c.prcBtn.textContent = '초월 최대';
        c.prcBtn.disabled = true;
      } else {
        c.prcTxt.innerHTML = `초월 1단계마다 ${c.def.label} 배율 ×${(1 + EQUIP_PIERCE_MULT).toFixed(2)}`
          + ` · 가진 <b style="color:${GRADES[top].color}">${GRADES[top].name}</b> ${fmt(held)}개`;
        c.prcBtn.textContent = `초월 ${GRADES[top].name} ${pcost}개`;
        c.prcBtn.disabled = !game.canEquipPierce(type);
      }
    }
    const low = game.equipSetGrade();
    const sb = low >= 0 ? equipSetBonus(low) : { atk: 0, hp: 0, crit: 0, critDmg: 0 };
    const ns = nextEquipSetStep(Math.max(0, low));
    setInfo.innerHTML = low < 0
      ? '세 부위를 다 갖추면 붙어요'
      : `지금 <b style="color:${GRADES[low].color}">${GRADES[low].name}</b> 한 벌 — 공격력 <b>+${pct(sb.atk)}</b> · 체력 <b>+${pct(sb.hp)}</b>`
        + (sb.crit ? ` · 치명 <b>+${pct(sb.crit)}</b>` : '')
        + (sb.critDmg ? ` · 치명 피해 <b>+${pct(sb.critDmg)}</b>` : '')
        + (ns ? `<br><span class="tier-hint">세 부위를 ${GRADES[ns.grade].name} 이상으로 맞추면 공격력 +${pct(ns.atk)}</span>` : '');
    const tot = game.equipTotalEnhance();
    const tb = equipTotalBonus(tot);
    const nt = nextEquipTotalStep(tot);
    totInfo.innerHTML = `제련 합 <b>${tot}</b> — 은자 <b>+${pct(tb.gold)}</b>`
      + (tb.atk ? ` · 공격력 <b>+${pct(tb.atk)}</b>` : '')
      + (tb.speed ? ` · 공격 속도 <b>+${pct(tb.speed)}</b>` : '')
      + (nt ? `<br><span class="tier-hint">합 ${nt.at}에서 은자 +${pct(nt.gold)} — ${nt.at - tot} 남음</span>` : '');
    updateEgo();
    updateAcc();
    lvBar.update();
  }
  return { root, update };
}
