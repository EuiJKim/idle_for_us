// 성장 탭: 은자 수련 / 레벨(스탯 포인트) / 경지
import { UPGRADES, SP_STATS, SP_RESET_GEMS, RANKS, RANK_MULT, expToNext, REGRESS_MIN_STAGE, REGRESS_PER_POINT,
  CRIT_CAP, REGRESS_ADVISE_POINTS, JOBS, JOB_RANK, JOB_UNLOCK, RANK_SUBS, rankSubLevel,
  TASTE_RANK, jobSkillOf, jobTestOf, jobTestStage } from '../data.js';
import { fmt } from '../fmt.js';
import { drawFighter } from '../battle.js';
import { h, toast, openModal, closeModal, fmtValue, subTabs, multSelector, popUp } from './common.js';
import { iconSkin } from '../icons.js';

function upgradeView(app) {
  const { game } = app;
  const rows = {};
  const sel = multSelector(() => update());
  const root = h('div', {}, h('div', { class: 'section-title' }, h('span', {}, '은자로 능력치를 올려요'), sel.el));

  for (const [key, def] of Object.entries(UPGRADES)) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy gold-cost', onclick: () => {
      const before = game.s.upgrades[key];
      if (!game.buyUpgrade(key, sel.times())) return;
      const got = game.s.upgrades[key] - before;
      popUp(rows[key].row, got > 1 ? `+${got}` : '+1');
      app.refresh();
    } });
    const ico = h('div', { class: 'ico' }, def.icon);
    iconSkin(ico, 'up', Object.keys(UPGRADES).indexOf(key));
    const row = h('div', { class: 'row' },
      ico,
      h('div', { class: 'info' }, h('div', { class: 'name' }, def.name, lv), desc), btn);
    rows[key] = { lv, desc, btn, def, row };
    root.append(row);
  }

  function planned(key) {
    const def = UPGRADES[key];
    let l = game.s.upgrades[key];
    let total = 0;
    let n = 0;
    const want = sel.get() === 'MAX' ? Infinity : sel.get();
    while (n < want && (def.max === undefined || l < def.max)) {
      const c = def.cost(l);
      if (sel.get() === 'MAX' && n > 0 && total + c > game.s.gold) break;
      total += c; l++; n++;
      if (sel.get() === 'MAX' && total > game.s.gold) break;
    }
    return { total, n, to: l };
  }

  function update() {
    for (const [key, r] of Object.entries(rows)) {
      const l = game.s.upgrades[key];
      r.lv.textContent = `Lv.${l}`;
      if (game.upgradeMaxed(key)) {
        // 치명은 수련으로 30%까지고 나머지는 갖춘 것들이 채운다.
        // 그걸 안 적어 두면 '30%가 천장'으로 읽혀서, 치명을 주는 시스템을
        // 전부 쓸모없는 것으로 지나친다.
        const extra = key === 'crit'
          ? ` <small>· 지금 <b>${Math.round(game.stats({ buffs: false }).crit * 100)}%</b>`
            + ` (상한 ${Math.round(CRIT_CAP * 100)}% — 나머지는 병기보·옵션 칸·세트·의복에서)</small>`
          : '';
        r.desc.innerHTML = `<b>${fmtValue(r.def, r.def.value(l))}</b> (수련 최대)${extra}`;
        r.btn.textContent = 'MAX';
        r.btn.disabled = true;
        continue;
      }
      const p = planned(key);
      r.desc.innerHTML = `${fmtValue(r.def, r.def.value(l))} → <b>${fmtValue(r.def, r.def.value(p.to))}</b>`;
      r.btn.textContent = `${fmt(p.total)}${p.n > 1 ? ` (+${p.n})` : ''}`;
      r.btn.disabled = game.s.gold < game.upgradeCost(key);
    }
  }
  return { root, update, res: ['gold'] };
}

function levelView(app) {
  const { game } = app;
  const lvl = h('b', { style: 'font-size:18px' });
  const bar = h('div', { class: 'bar' }, h('div'), h('span'));
  const spText = h('b', { style: 'color:#fde68a' });
  const resetBtn = h('button', { class: 'btn', style: 'padding:6px 10px' }, `초기화 원보 ${SP_RESET_GEMS}`);
  resetBtn.onclick = () => openModal((s) => {
    s.append(h('h2', {}, '스탯 포인트 초기화'), h('p', { class: 'muted' }, `원보 ${SP_RESET_GEMS}을 쓰고 모든 포인트를 돌려받아요.`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '취소'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); toast(game.resetSp() ? '초기화했어요' : '원보가 부족하거나 쓴 포인트가 없어요'); app.refresh(); } }, '초기화')));
  });
  const rows = {};
  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, h('span', {}, '레벨 ', lvl), h('small', {}, '적를 잡으면 경험치')),
      bar,
      h('div', { class: 'members', style: 'justify-content:space-between;align-items:center;margin-top:6px' },
        h('span', {}, '남은 스탯 포인트 ', spText), resetBtn)),
    h('p', { class: 'muted', style: 'margin:0 2px 8px' }, `레벨이 오를 때마다 포인트 2개. 원하는 능력치에 투자하세요.`));

  // 줄마다 버튼 셋(+1/+10/전부)이면 여섯 줄에 열여덟 개다. 화면이 버튼으로 덮인다.
  // 수련 화면처럼 **위에서 한 번 고르고** 줄마다 버튼은 하나만 둔다.
  let spMul = 1;   // 1 · 10 · 전부
  const mulBtns = [1, 10, 0].map((v) => {
    const b = h('button', { class: 'seg-btn' }, v === 0 ? '전부' : `+${v}`);
    b.onclick = () => { spMul = v; paintMul(); update(); };
    return b;
  });
  const paintMul = () => mulBtns.forEach((b, i) => b.classList.toggle('on', [1, 10, 0][i] === spMul));
  paintMul();
  root.append(h('div', { class: 'seg sp-seg' }, ...mulBtns));

  let i = 0;
  for (const [key, def] of Object.entries(SP_STATS)) {
    const pts = h('small');
    const desc = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy', style: 'min-width:60px',
      onclick: () => { game.allocSp(key, spMul === 0 ? game.s.sp : spMul); app.refresh(); } });
    const ico = h('div', { class: 'ico' }, def.icon);
    iconSkin(ico, 'sp', i++);
    rows[key] = { pts, desc, btns: [btn], btn, def };
    root.append(h('div', { class: 'row' }, ico,
      h('div', { class: 'info' }, h('div', { class: 'name' }, def.name, pts), desc), btn));
  }

  function update() {
    const s = game.s;
    lvl.textContent = `Lv.${s.level}`;
    const need = expToNext(s.level);
    bar.firstChild.style.width = `${Math.min(100, (s.exp / need) * 100)}%`;
    bar.lastChild.textContent = `${fmt(s.exp)} / ${fmt(need)}`;
    spText.textContent = s.sp;
    for (const [key, r] of Object.entries(rows)) {
      const n = s.spAlloc[key] || 0;
      r.pts.textContent = `${n}pt`;
      if (r.btn) r.btn.textContent = spMul === 0 ? '전부' : `+${spMul}`;
      r.desc.textContent = r.def.desc(n * r.def.per);
      r.btns.forEach((b) => { b.disabled = s.sp <= 0; });
    }
  }
  return { root, update, res: ['gold', 'gems'] };
}

function rankView(app) {
  const { game } = app;
  const cv = h('canvas', { width: 160, height: 160, style: 'width:120px;height:120px;flex:none' });
  const name = h('div', { style: 'font-size:18px;font-weight:900' });
  const bonus = h('div', { class: 'muted' });
  // 소단계 막대 — 자주 차오르는 것이라 눈에 보여야 한다
  const subBar = h('div', { class: 'bar', style: 'margin-top:6px' }, h('div'), h('span'));
  const next = h('div', { style: 'margin-top:8px' });
  const btn = h('button', { class: 'btn primary', style: 'margin-top:8px;width:100%' });
  btn.onclick = () => app.startTrial();
  const list = h('div');
  const root = h('div', {},
    h('div', { class: 'card', style: 'display:flex;gap:12px;align-items:center' }, cv,
      h('div', { style: 'flex:1;min-width:0' }, name, bonus, subBar, next, btn)),
    h('div', { class: 'section-title' }, '경지 단계'), list);
  let drawn = -1;

  function drawPreview() {
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 160, 160);
    ctx.setTransform(1.1, 0, 0, 1.1, 0, 0);
    drawFighter(ctx, 70, 136, RANKS[game.s.rank].look, { t: performance.now() / 1000, blade: '#e5e7eb', weapon: 'sword' });
  }

  function update() {
    const s = game.s;
    const r = RANKS[s.rank];
    const nx = game.nextRank();
    // 소단계가 생겼다. 큰 경지는 한참 만에 한 번 오르지만 소단계는 자주 오른다 —
    // 그 '자주 오르는 것'이 화면에 보여야 한다.
    name.textContent = game.rankLabel();
    const sub = s.rankSub || 0;
    bonus.innerHTML = `공격력·체력 <b>×${fmt(game.rankMult())}</b>`
      + `<br><span class="muted">${RANK_SUBS}단을 채우면 ${nx ? nx.name : '끝'}</span>`;
    subBar.firstChild.style.width = `${(sub / (RANK_SUBS - 1)) * 100}%`;
    const needLv = rankSubLevel(s.rank, sub + 1);
    subBar.lastChild.textContent = sub >= RANK_SUBS - 1
      ? `${RANK_SUBS}단 — 다 찼어요`
      : `${sub + 1}단까지 레벨 ${needLv} (지금 ${s.level})`;
    if (!nx) {
      next.textContent = '천인합일, 무의 끝에 이르렀어요!';
      btn.classList.add('hidden');
    } else {
      btn.classList.remove('hidden');
      next.innerHTML = `다음 경지: <b>${nx.name}</b> (${RANK_SUBS}단 + 레벨 ${nx.level}) → 공격력·체력 <b>×${RANK_MULT}</b>`;
      btn.textContent = game.canTrial() ? '심마와 대결 · 경지 돌파'
        : sub < RANK_SUBS - 1 ? `${RANK_SUBS}단을 먼저 채워요 (지금 ${sub}단)`
          : `레벨 ${nx.level}에 도전 가능 (현재 ${s.level})`;
      btn.disabled = !game.canTrial();
    }
    drawPreview();
    if (drawn !== s.rank) {
      drawn = s.rank;
      list.replaceChildren(...RANKS.map((rk, i) => h('div', { class: `row${i === s.rank ? ' me' : ''}`, style: i > s.rank ? 'opacity:0.55' : '' },
        h('div', { class: 'ico' }, i < s.rank ? '✅' : i === s.rank ? '⭐' : '🔒'),
        h('div', { class: 'info' }, h('div', { class: 'name' }, rk.name, h('small', {}, `Lv.${rk.level}`)),
          h('div', { class: 'desc' }, `공격력·체력 ×${fmt(Math.pow(RANK_MULT, i))}${rk.look.halo ? ' · 광배' : ''}${rk.look.swords ? ` · 비검 ${rk.look.swords}자루` : rk.look.aura ? ' · 기운' : ''}`)))));
    }
  }
  return { root, update };
}

function regressView(app) {
  const { game } = app;
  const count = h('b');
  const points = h('b');
  const bonus = h('b');
  const gain = h('div', { class: 'regress-gain' });
  const btn = h('button', { class: 'btn primary', style: 'width:100%;margin-top:10px' });
  btn.onclick = () => openModal((s) => {
    const g = game.regressPreview();
    s.append(
      h('div', { class: 'regress-hz' }, '회귀'),
      h('p', { style: 'text-align:center;line-height:1.7', html: `회귀하면 1관문, 레벨 1로 돌아가요.<br>전생의 기억 <b>+${g}</b> → 모든 능력 <b>+${Math.round(g * REGRESS_PER_POINT * 100)}%</b>` }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '아직'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); app.regress(); } }, '회귀한다')));
  });
  // **이득을 맨 위로.** 전에는 '회귀란 무엇인가' 글이 먼저고 이득이 맨 아래였다.
  // 회귀는 누르는 순간 약해 보이는 선택이라, 얼마나 세지는지를 못 보면 아무도 안 한다.
  const keepRow = (lose, keep) => h('div', { class: 'keeprow' },
    h('div', { class: 'lose' }, lose), h('div', { class: 'keep' }, keep));
  // 설명은 처음 한 번만. 두 번째부터는 접어 둔다 — 아는 걸 매번 읽힐 이유가 없다.
  const firstTime = () => (game.s.regress?.count || 0) === 0;
  const lore = h('details', { class: 'card lore' },
    h('summary', {}, '회귀란 무엇인가'),
    h('p', { style: 'margin:6px 0 0;line-height:1.6' },
      '죽음 직전, 눈을 뜨니 강호에 첫발을 디딘 그날이었다. ',
      '회귀하면 처음부터 다시 시작하지만, 전생의 기억이 남아 더 빨리 강해진다.'),
    h('p', { class: 'muted', style: 'line-height:1.7;margin:8px 0 0' },
      '누르는 순간 약해 보이지만 금방 돌아와요. 전생의 기억이 공격력·체력·은자·경험치에 ',
      '전부 붙어서, 돌아오는 길이 처음보다 훨씬 빨라요.', h('br'),
      h('b', {}, `전생의 기억을 ${REGRESS_ADVISE_POINTS} 넘게 받을 수 있고 관문이 한동안 안 올라가면, 그때가 회귀할 때예요.`)));
  const root = h('div', {},
    h('div', { class: 'card regress-card' },
      h('div', { class: 'regress-hz small' }, '회귀'),
      gain, btn,
      h('div', { class: 'stat-grid', style: 'margin-top:10px' },
        h('div', {}, '회귀 횟수', count),
        h('div', {}, '전생의 기억', points),
        h('div', { style: 'grid-column:1/3' }, '기억의 힘 (공격력·체력·은자·경험치)', bonus))),
    // 글로 나열하면 안 읽는다. 두 칸 표로 보여 준다.
    h('div', { class: 'card' },
      h('h3', {}, '회귀하면'),
      h('div', { class: 'keeprow head' }, h('div', { class: 'lose' }, '사라짐'), h('div', { class: 'keep' }, '남음')),
      keepRow('관문', '경지'),
      keepRow('은자 · 은자 수련', '병기 · 제련 · 초월'),
      keepRow('레벨 · 스탯 포인트', '무공 · 영수 · 신물'),
      keepRow('', '원보 · 비급 · 한철 · 먹이 · 조각'),
      keepRow('', '수련터 기록 · 문파')),
    lore);
  function update() {
    const s = game.s;
    const g = game.regressPreview();
    count.textContent = `${s.regress.count}회`;
    points.textContent = `${s.regress.points}`;
    bonus.textContent = `+${Math.round(s.regress.points * REGRESS_PER_POINT * 100)}%`;
    const worth = game.regressWorth();
    const stuck = Math.floor(game.stuckFor() / 60);
    gain.innerHTML = g
      ? `지금 회귀하면 전생의 기억 <b>+${g}</b> → 모든 능력 <b>+${Math.round((s.regress.points + g) * REGRESS_PER_POINT * 100)}%</b>`
        + ` (최고 ${s.maxStage}관문 기준)`
        + (worth ? `<br><b style="color:var(--accent-2)">지금이 그때예요 — ${stuck}분째 관문이 안 올라갔어요</b>` : '')
      : `${REGRESS_MIN_STAGE}관문을 넘으면 회귀할 수 있어요. (지금 ${s.maxStage}관문)`;
    btn.textContent = g ? `회귀한다 (+${g})` : `${REGRESS_MIN_STAGE}관문 이후 가능`;
    btn.classList.toggle('primary', !!worth);
    btn.disabled = !g || game.mode !== 'stage';
    // 첫 회귀 전에는 펴 두고, 한 번 해 봤으면 접는다
    lore.open = firstTime();
  }
  return { root, update };
}

// 문파 — 화경에 닿으면 여덟 계열 중 하나를 고른다. 언제든 바꿀 수 있다.
function jobView(app) {
  const { game } = app;
  const head = h('p', { class: 'muted', style: 'margin:2px 2px 10px;line-height:1.7' });
  const root = h('div', {}, head);
  const cards = {};

  // 보너스를 사람 말로 적는다
  const WORD = {
    atk: '공격력', hp: '체력', speed: '공격 속도', gold: '은자 획득',
    boss: '두목 피해', offline: '방치 보상', bleed: '출혈 피해',
    ccDur: '상태이상 지속', critDmg: '치명 피해',
  };
  const bonusText = (j) => Object.entries({ ...(j.mult || {}), ...(j.add || {}) })
    .map(([k, v]) => `${WORD[k] || k} <b>×${v}</b>`).join(' · ');

  for (const j of JOBS) {
    const title = h('div', { style: `font-weight:900;font-size:15px;color:${j.color}` });
    const tag = h('div', { class: 'desc', style: 'margin-top:1px' }, j.tag);
    const eff = h('div', { class: 'desc', style: 'margin-top:4px' });
    const note = h('div', { class: 'desc', style: 'margin-top:2px' }, j.desc);
    const art = h('div', { class: 'desc', style: 'margin-top:4px' });
    // 전직 시험 — 문이 열렸는데 아직 안 붙었으면 여기 뭘 해야 하는지 적힌다
    const test = h('div', { class: 'desc', style: 'margin-top:4px' });
    const btn = h('button', { class: 'buy', onclick: () => {
      // 화경 전에는 맛보기 — 공짜로 몇 번이든 바꾼다
      if (game.tasteOpen()) {
        const off = game.s.taste === j.id;
        game.setTaste(off ? null : j.id);
        app.refresh();
        toast(off ? '맛보기를 내려놨어요' : `${jobSkillOf(j.id)?.name}을 써 봐요`);
        return;
      }
      if (game.s.job === j.id) { game.setJob(null); app.refresh(); return; }
      // 문은 열렸는데 시험을 안 봤으면 시험부터
      if (game.canJobTest(j.id)) {
        const d = jobTestOf(j.id);
        openModal((s) => s.append(
          h('h2', {}, `${d.name}(${d.hanja}) — ${j.name} 입문 시험`),
          h('p', {}, h('b', { style: `color:${j.color}` }, d.ask)),
          h('p', { class: 'muted' }, d.why),
          h('p', { class: 'muted' },
            `제 ${jobTestStage(game.s.bestStage)} 관문의 힘으로 겨룹니다 · 제한 ${d.time}초`,
            h('br'), '떨어져도 잃는 건 없어요. 몇 번이든 다시 볼 수 있어요.'),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn primary', onclick: () => {
              if (game.startJobTest(j.id)) { closeModal(); app.closePanel?.(); }
              else toast('들판에서만 시험을 볼 수 있어요');
            } }, '시험 보기'),
            h('button', { class: 'btn', onclick: closeModal }, '나중에'))));
        return;
      }
      if (game.setJob(j.id)) { app.refresh(); toast(`${j.name}이 되었어요`); }
      else toast('아직 안 열린 문파예요');
    } });
    const row = h('div', { class: 'card' },
      h('div', { style: 'display:flex;align-items:flex-start;gap:8px' },
        h('div', { style: 'flex:1;min-width:0' }, title, tag, eff, art, test, note), btn));
    root.append(row);
    cards[j.id] = { title, eff, art, test, btn, row, def: j };
  }

  function update() {
    const open = game.jobOpen();
    const taste = game.tasteOpen();
    const at = game.nextJobAt();
    head.innerHTML = open
      ? `여덟 중 하나를 골라요. <b>언제든 바꿀 수 있고, 바꿔도 잃는 게 없어요.</b>`
        + `<br>문 열림 ${game.jobStageOpenCount()}/${JOBS.length} · 시험 통과 ${game.jobTestsPassed()}`
        + (at ? ` · 다음은 <b>${at}관문</b>` : ' · 전부 열림')
      : taste
        ? `<b>맛보기</b> — 계열 무공을 하나씩 써 볼 수 있어요. 공짜로 몇 번이든 바꿔요.`
          + `<br>올린 무공 레벨은 그대로 남아요. <b>${RANKS[JOB_RANK].name}</b>에서 하나를 정합니다.`
        : `<b>${RANKS[TASTE_RANK].name}</b>에 오르면 계열 무공을 맛볼 수 있어요.`
          + ` <b>${RANKS[JOB_RANK].name}</b>에서 문파를 정해요. (지금 ${game.rankLabel()})`;
    for (const j of JOBS) {
      const c = cards[j.id];
      const tasting = taste && game.s.taste === j.id;
      const picked = game.s.job === j.id || tasting;
      const stageOpen = taste ? true : game.jobStageOpen(j.id);
      const passed = game.jobTestPassed(j.id);
      const unlocked = taste ? true : (stageOpen && passed);
      const need = JOB_UNLOCK[JOBS.indexOf(j)] || 0;
      c.title.innerHTML = `${j.name} <small style="color:var(--muted)">${j.weapon}</small>`
        + (picked ? ` <b style="color:var(--accent-2)">· ${tasting ? '써 보는 중' : '지금 이것'}</b>` : '');
      const sk = jobSkillOf(j.id);
      c.art.innerHTML = sk ? `전용 무공 <b style="color:${j.color}">${sk.name}</b> · 쿨 ${sk.cd}초` : '';
      c.eff.innerHTML = taste ? '<span class="muted">문파에 들면 능력치 보너스가 붙어요</span>' : bonusText(j);
      // 시험 줄 — 뭘 해야 하는지 카드에 적어 둔다. 눌러 보고서야 알면 늦다.
      const d = jobTestOf(j.id);
      c.test.innerHTML = taste || !d ? ''
        : passed ? `<span style="color:var(--accent-2)">입문 시험 〈${d.name}〉 통과</span>`
          : stageOpen ? `입문 시험 <b>〈${d.name}〉</b> — ${d.ask}`
            : `<span class="muted">입문 시험 〈${d.name}〉</span>`;
      c.row.style.opacity = stageOpen ? '' : '0.5';
      c.row.style.outline = picked ? `1px solid ${j.color}` : '';
      c.btn.textContent = tasting ? '내려놓기' : taste ? '맛보기'
        : picked ? '그만두기' : unlocked ? '입문'
          : stageOpen ? '시험 보기' : (!open ? '경지 부족' : `${need}관문`);
      c.btn.disabled = !stageOpen && !picked;
    }
  }
  return { root, update };
}

export function growthTab(app) {
  return subTabs([
    { key: 'upgrade', label: '수련', make: () => upgradeView(app) },
    { key: 'level', label: '레벨', make: () => levelView(app) },
    { key: 'rank', label: '경지', make: () => rankView(app) },
    { key: 'job', label: '문파', make: () => jobView(app) },
    { key: 'regress', label: '회귀', make: () => regressView(app) },
  ]);
}
