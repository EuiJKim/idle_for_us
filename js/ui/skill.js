// 무공 탭: 하위 탭 둘 — 무공(액티브) / 패시브
//
// 전에는 한 창에 계열 패시브 → 장착 칸 → 총 연마 → 출진 준비 → 무공 22줄이
// 세로로 쭉 쌓여 있었다. 비급으로 올리는 화면인데 **내 비급이 몇 개인지는
// 글 속 한 줄**이었고, 올릴 무공을 찾으려면 스크롤을 해야 했다.
// 이제 쓰는 자원(비급)은 창 머리에 붙고, 무공 목록은 상태별로 묶인다.
import { SKILLS, SKILL_PIERCE_MAX, SKILL_PIERCE_AT, SKILL_PIERCE_MULT,
  skillTotalBonus, nextSkillTotalStep, PRESET_SLOTS, nextSkillSlotAt, jobOf,
  skillTierInfo, qiOf, QI,
  PASSIVE_KINDS, PASSIVES, passivesOf, passiveId, PASSIVE_MAX, PASSIVE_STAT_NAME } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { h, openModal, closeModal, toast, popUp, subTabs, holdRepeat, softRefresh, short} from './common.js';
import { iconSkin } from '../icons.js';

// ---------- 무공(액티브) ----------
function activeView(app) {
  const { game } = app;
  const rows = {};
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

  // 총 연마·출진 준비는 자주 보지 않는다. 접어 두고 필요할 때만 펼친다 —
  // 올릴 무공을 찾는 길에 늘 끼어 있을 이유가 없다.
  const extra = h('details', { class: 'fold' },
    h('summary', {}, '무공 총 연마 · 출진 준비', totalLv),
    totalInfo,
    h('p', { class: 'muted', style: 'margin:8px 0 0' },
      '모든 무공 레벨을 더한 값에 보너스가 붙어요. 칸은 넷뿐이지만 안 쓰는 무공을 올릴 이유가 돼요.'),
    h('div', { class: 'section-title', style: 'margin:12px 2px 6px' }, '출진 준비'),
    presetWrap,
    h('p', { class: 'muted', style: 'margin:8px 0 0' },
      '무공 넷과 영수를 한 벌로 담아 두고 바꿔 끼워요. 사냥용·두목용·벌이용을 따로 두면 편해요.'));

  // 상태별 묶음. 전에는 22줄이 data.js 순서대로 한 줄이어서
  // 장착 중인 것과 아직 잠긴 것이 섞여 있었다.
  const groups = [
    { key: 'on', title: '장착 중', hint: '' },
    { key: 'free', title: '쓸 수 있는 무공', hint: '비급으로 올려요' },
    { key: 'lock', title: '아직 잠긴 무공', hint: '관문을 넘으면 열려요' },
  ].map((g) => {
    const head = h('div', { class: 'section-title', style: 'margin:14px 2px 6px' },
      h('span', {}, g.title), h('span', {}, g.hint));
    const body = h('div');
    return { ...g, head, body, wrap: h('div', {}, head, body) };
  });

  // 문파 특성 — 전직하면 **쓰는 모든 무공에** 그 문파의 기운이 실린다.
  // 전에는 전용 무공 하나만 달라져서 전직해도 달라진 게 안 보였다.
  const traitCard = h('div', { class: 'card trait-card' });
  const traitName = h('h3');
  const traitText = h('p', { class: 'desc', style: 'margin:4px 0 0' });
  const traitSub = h('p', { class: 'muted', style: 'margin:6px 0 0' });
  const traitBtn = h('button', { class: 'buy', onclick: () => {
    if (game.traitUp()) { popUp(traitCard, `${game.traitLvOf()}단`); app.refresh(); }
    else toast('공적이 모자라요 — 관문지기를 넘으면 쌓여요');
  } });
  traitCard.append(traitName, traitText,
    h('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:8px' },
      traitSub, traitBtn));

  const root = h('div', {},
    traitCard,
    h('div', { class: 'card' },
      h('h3', {}, '장착 무공', slotInfo, autoBtn),
      slotsEl,
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        '앞 무공이 남긴 기운을 다음 무공이 먹으면 ', h('b', {}, '연계'),
        '가 터져요 — 피해가 커지고 상태이상이 길어져요. 이어지게 짜 보세요.'),
      h('p', { class: 'muted', style: 'margin:4px 0 0' }, '두목을 잡거나 의뢰를 깨면 비급을 얻어요')),
    extra,
    ...groups.map((g) => g.wrap));

  SKILLS.forEach((sk) => {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const eq = h('button', { class: 'btn', style: 'padding:6px 8px;font-size:12px' });
    eq.onclick = () => toggleEquip(sk);
    const up = (soft) => {
      if (!game.upgradeSkill(sk.id)) return;
      popUp(rows[sk.id].row, `Lv.${game.s.skills[sk.id]}`);
      if (soft) softRefresh(app); else app.refresh();
    };
    const btn = h('button', { class: 'buy', onclick: () => up(false) });
    holdRepeat(btn, () => up(true));
    const pierce = h('button', { class: 'buy', style: 'font-size:11px', onclick: () => {
      if (game.skillPierce(sk.id)) { popUp(rows[sk.id].row, '초월!'); app.refresh(); }
      else toast(`${SKILL_PIERCE_AT}레벨부터 초월할 수 있고 비급이 필요해요`);
    } });
    const nm = h('span');
    // 역할 — 여덟 무공이 각자 맡은 자리 (기본기·광역·이동·두목 …)
    const role = h('small', { class: 'role-tag' }, sk.role || '');
    // 연계 — 이 무공이 남기는 기운과 먹는 기운. 칸을 짜는 기준이다.
    const q = qiOf(sk.id);
    const qiRow = q ? h('span', { class: 'qi-row' },
      h('i', { class: 'qi', style: `color:rgb(${QI[q.feeds].col});border-color:rgb(${QI[q.feeds].col})`,
        title: `${QI[q.feeds].name} 기운을 먹어요` }, QI[q.feeds].name),
      h('span', { class: 'qi-arrow' }, '→'),
      h('i', { class: 'qi', style: `color:rgb(${QI[q.leaves].col});border-color:rgb(${QI[q.leaves].col})`,
        title: `${QI[q.leaves].name} 기운을 남겨요` }, QI[q.leaves].name)) : null;
    const tierHint = h('div', { class: 'tier-hint' });
    const bar = h('div', { class: 'bar', style: 'height:4px;margin:5px 0 0' }, h('div'));
    // 아이콘은 캐릭터·차수에 따라 바뀐다 (각성한 무공은 옛 전용 무공 그림) — update에서 깐다
    const ico = h('div', { class: 'ico' }, sk.icon);
    rows[sk.id] = { lv, desc, btn, eq, pierce, nm, tierHint, bar, ico, art: '', row: null };
    rows[sk.id].row = h('div', { class: 'row' },
      ico,
      h('div', { class: 'info' }, h('div', { class: 'name' }, nm, role, lv, qiRow), desc, bar, tierHint),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:stretch' }, btn, pierce, eq));
  });

  function toggleEquip(sk) {
    const slots = game.s.skillSlots;
    const at = slots.indexOf(sk.id);
    if (at >= 0) { game.setSkillSlot(at, null); app.refresh(); return; }
    const free = slots.indexOf(null);
    if (free >= 0) { game.setSkillSlot(free, sk.id); app.refresh(); return; }
    openModal((s) => {
      const me = game.skillDef(sk.id);
      s.append(h('h2', {}, `${me.icon} ${me.name} 장착`), h('p', { class: 'muted' }, '바꿀 칸을 고르세요.'));
      const grid = h('div', { class: 'slots' });
      slots.slice(0, game.skillSlotCount()).forEach((id, i) => {
        const cur = id ? game.skillDef(id) : null;
        grid.append(h('button', { class: 'slot', onclick: () => { game.setSkillSlot(i, sk.id); closeModal(); app.refresh(); } },
          h('span', {}, cur?.icon || '＋'), h('small', {}, cur?.name || '빈 칸')));
      });
      s.append(grid, h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '취소'));
    });
  }

  // 어느 묶음에 들어갈지
  const groupOf = (sk) => {
    if (!game.skillUnlocked(sk)) return 'lock';
    if (game.s.skillSlots.includes(sk.id)) return 'on';
    return 'free';
  };

  let slotSig = '';
  let groupSig = '';
  function update() {
    autoBtn.textContent = game.s.autoSkill ? '자동 ON' : '자동 OFF';
    autoBtn.classList.toggle('good', game.s.autoSkill);
    const nSlot = game.skillSlotCount();
    const nextAt = nextSkillSlotAt(game.s.bestStage);
    slotInfo.textContent = nextAt ? `${nSlot}칸 · ${nextAt}관문에 한 칸 더` : `${nSlot}칸 (최대)`;
    // 특성 카드
    const job = jobOf(game.s.job);
    const tr = game.jobTrait();
    traitCard.style.display = tr ? '' : 'none';
    if (tr) {
      traitCard.style.borderColor = `rgb(${tr.col})`;
      traitName.innerHTML = `<span style="color:rgb(${tr.col})">〈${tr.name}〉</span>`
        + ` <small>${job?.name || ''}의 기운</small>`;
      traitText.innerHTML = `${tr.text}`
        + (tr.lv ? ` <b style="color:rgb(${tr.col})">${tr.lv}단</b> (지금 세기 ×${tr.scale.toFixed(2)})` : '');
      traitSub.innerHTML = '<span style="flex:1">공적으로 단련해요. 관문지기를 넘으면 쌓여요.</span>';
      traitSub.style.flex = '1';
      traitBtn.textContent = `공적 ${fmt(game.traitCostOf())}`;
      traitBtn.disabled = !game.canTraitUp();
    }
    for (const r of presetRows) {
      const p2 = game.s.presets[r.i];
      const on = game.presetReady(r.i);
      r.label.textContent = p2.name;
      const names = on ? p2.slots.map((id) => (id ? game.skillDef(id)?.name : null) || '빈칸').join('·') : '비어 있음';
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
    const sig = game.s.skillSlots.join(',') + ':' + game.skillSlotCount()
      + ':' + game.s.job + ':' + game.jobTier()
      + ':' + game.s.skillSlots.map((x) => (x ? game.s.skills[x] : 0)).join('|');
    if (sig !== slotSig) {
      slotSig = sig;
      const cells = Array.from({ length: game.skillSlotCount() }, (_, i) => {
        const id = game.s.skillSlots[i];
        const sk = id ? game.skillDef(id) : null;
        return h('div', { class: 'slot' }, h('span', {}, sk?.icon || '＋'), h('small', {}, sk ? `${sk.name} Lv.${game.s.skills[sk.id]}` : '빈 칸'));
      });
      slotsEl.replaceChildren(...cells);
    }
    // 묶음이 바뀌었을 때만 줄을 옮긴다. 매 갱신마다 옮기면 누르는 중에 튄다.
    const gsig = SKILLS.map((sk) => groupOf(sk)[0]).join('');
    if (gsig !== groupSig) {
      groupSig = gsig;
      for (const g of groups) {
        const mine = SKILLS.filter((sk) => groupOf(sk) === g.key);
        g.body.replaceChildren(...mine.map((sk) => rows[sk.id].row));
        g.wrap.style.display = mine.length ? '' : 'none';
      }
    }
    for (const base of SKILLS) {
      const r = rows[base.id];
      // 이 캐릭터·이 차수의 모습 (이름·설명·쿨·아이콘)
      const sk = game.skillDef(base.id);
      const l = game.s.skills[sk.id];
      const artKey = (sk.art || []).join('-');
      if (artKey !== r.art) {
        r.art = artKey;
        r.ico.textContent = sk.icon;
        r.ico.style.backgroundImage = '';
        r.ico.classList.remove('has-art');
        if (sk.art) iconSkin(r.ico, sk.art[0], sk.art[1]);
      }
      r.row.style.borderLeft = sk.formTier ? `3px solid ${jobOf(game.s.job)?.color || 'var(--accent-2)'}` : '';
      const unlocked = game.skillUnlocked(sk);
      const equipped = game.s.skillSlots.includes(sk.id);
      r.row.style.opacity = unlocked ? '' : '0.5';
      // 차수 — 50레벨마다 이름이 바뀌고 배율이 한 번 더 곱해진다
      const ti = skillTierInfo(sk, l);
      r.nm.textContent = ti.name;
      r.nm.style.color = ti.tier ? 'var(--accent-2)' : '';
      r.lv.textContent = unlocked
        ? (ti.tier ? `Lv.${l} · ${ti.tier + 1}차 ${ti.inTier}/${ti.step}` : `Lv.${l} · ${ti.inTier}/${ti.step}`)
        : `관문 ${sk.unlock} 해금`;
      r.bar.firstChild.style.width = `${(ti.inTier / ti.step) * 100}%`;
      r.bar.style.display = unlocked ? '' : 'none';
      r.tierHint.innerHTML = unlocked
        ? `${ti.left}레벨 뒤 <b>${ti.nextName}</b> — 배율 ×${ti.mult.toFixed(1)} → <b>×${ti.nextMult.toFixed(1)}</b>`
        : '';
      const pi = game.skillPierceOf(sk.id);
      const boost = 1 + SKILL_PIERCE_MULT * pi;
      const cdNow = game.skillCdOf(sk);
      r.desc.innerHTML = `${sk.desc(sk.mult(l) * boost, l)} · 쿨 ${cdNow.toFixed(1)}초`
        + (cdNow < sk.cd - 0.05 ? ` <small style="color:var(--muted)">(본디 ${sk.cd}초)</small>` : '')
        + (pi ? ` · <b style="color:var(--accent-2)">${pi}초월</b>` : '')
        + `<br>다음: <b>${sk.desc(sk.mult(l + 1) * boost, l + 1)}</b>`;
      r.btn.textContent = `비급 ${fmt(game.skillUpgradeCost(sk.id))}`;
      r.btn.disabled = !unlocked || short(game.s.books, game.skillUpgradeCost(sk.id));
      const canP = game.canSkillPierce(sk.id);
      const pcost = game.skillPierceCost(sk.id);
      r.pierce.textContent = pi >= SKILL_PIERCE_MAX ? '초월 최대'
        : l < SKILL_PIERCE_AT ? `초월 Lv.${SKILL_PIERCE_AT}`
          : `초월 비급 ${fmt(pcost)}`;
      r.pierce.disabled = !canP || short(game.s.books, pcost);
      r.eq.textContent = equipped ? '해제' : '장착';
      r.eq.disabled = !unlocked;
      r.eq.classList.toggle('good', equipped);
    }
  }
  return { root, update, res: ['books', 'merit'] };
}

// ---------- 계열 패시브 ----------
// 무공은 지금까지 액티브뿐이었다. 패시브는 칸을 안 먹는다 —
// 올려 두면 늘 켜져 있다. **지금 들어간 계열 것만** 켜진다.
function passiveView(app) {
  const { game } = app;
  const pvHead = h('p', { class: 'muted', style: 'margin:0 0 8px' });
  const pvRows = {};
  // 같은 계열(내공·외공·무공)끼리 묶는다. 전에는 셋이 섞여 한 줄이었다.
  const kindWrap = {};
  const kindCards = PASSIVE_KINDS.map((k) => {
    const body = h('div');
    kindWrap[k.id] = body;
    return h('div', { class: 'card' }, h('h3', {}, k.name, h('small', {}, k.desc)), body);
  });
  for (const pv of PASSIVES) {
    const id = passiveId(pv);
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const up = (soft) => {
      if (!game.passiveUp(id, 1)) { if (!soft) toast('비급이 모자라거나 최고 단계예요'); return; }
      popUp(pvRows[id].row, `Lv.${game.passiveLv(id)}`);
      if (soft) softRefresh(app); else app.refresh();
    };
    const btn = h('button', { class: 'buy', style: 'min-width:76px', onclick: () => up(false) });
    holdRepeat(btn, () => up(true));
    const bar = h('div', { class: 'bar', style: 'height:5px;margin:6px 0 0' }, h('div'));
    const row = h('div', { class: 'row' },
      h('div', { class: 'info' }, h('div', { class: 'name' }, pv.name, lv), desc, bar), btn);
    pvRows[id] = { row, lv, desc, btn, bar, def: pv };
    kindWrap[pv.kind].append(row);
  }
  const root = h('div', {}, pvHead, ...kindCards);

  function update() {
    const job = jobOf(game.s.job);
    pvHead.innerHTML = job
      ? `<b style="color:${job.color}">${job.name}</b>의 패시브 여섯이에요. 칸을 안 먹고 늘 켜져 있어요.`
        + `<br>캐릭터를 바꾸면 그쪽 패시브로 갈아타요 — 올려 둔 건 안 없어져요.`
      : '캐릭터를 고르면 그 캐릭터의 패시브가 열려요.';
    const mine = game.s.job ? passivesOf(game.s.job) : [];
    for (const [id, r] of Object.entries(pvRows)) {
      const on = mine.includes(r.def);
      r.row.style.display = on ? '' : 'none';
      if (!on) continue;
      const l = game.passiveLv(id);
      const nm = PASSIVE_STAT_NAME[r.def.stat] || r.def.stat;
      r.lv.textContent = `Lv.${l}/${PASSIVE_MAX}`;
      r.desc.innerHTML = `${nm} <b>+${pct(r.def.per * l)}</b>`
        + (l < PASSIVE_MAX ? ` <span class="muted">→ +${pct(r.def.per * (l + 1))}</span>` : ' <span class="muted">(최고)</span>');
      r.bar.firstChild.style.width = `${(l / PASSIVE_MAX) * 100}%`;
      r.btn.textContent = l >= PASSIVE_MAX ? '최고' : `비급 ${fmt(game.passiveCostOf(id))}`;
      r.btn.disabled = l >= PASSIVE_MAX || short(game.s.books, game.passiveCostOf(id));
    }
    // 계열 카드 자체도, 그 안이 다 비면 숨긴다 (문파에 안 든 동안)
    for (const k of PASSIVE_KINDS) {
      const any = PASSIVES.some((pv) => pv.kind === k.id && mine.includes(pv));
      kindWrap[k.id].parentElement.style.display = any ? '' : 'none';
    }
  }
  return { root, update, res: ['books'] };
}

export function skillTab(app) {
  return subTabs([
    { key: 'active', label: '무공', make: () => activeView(app) },
    { key: 'passive', label: '패시브', make: () => passiveView(app) },
  ]);
}
