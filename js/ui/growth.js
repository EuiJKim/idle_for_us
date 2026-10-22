// 성장 탭: 은자 수련 / 레벨(스탯 포인트) / 경지
import { UPGRADES, UP_GROUPS, UP_STAT_LABEL, upAdds, upNext, upTierInfo, upStatAt, josaRo,
  SP_STATS, SP_RESET_GEMS, RANKS, RANK_MULT, expToNext, REGRESS_MIN_STAGE,
  CRIT_CAP, REGRESS_WORTH_MULT, JOBS, JOB_RANK, JOB_UNLOCK, RANK_SUBS, rankSubLevel,
  TASTE_RANK, jobSkillOf, jobSkillsOf, JOB_SKILL_OPEN, jobTraitOf, traitCost,
  jobTestOf, jobTestStage } from '../data.js';
import { fmt } from '../fmt.js';
import { drawFighter } from '../battle.js';
import { h, toast, openModal, closeModal, fmtValue, subTabs, multSelector, popUp } from './common.js';
import { iconSkin } from '../icons.js';

function upgradeView(app) {
  const { game } = app;
  const rows = {};
  const sel = multSelector(() => update());
  const root = h('div', {}, h('div', { class: 'section-title' }, h('span', {}, '은자로 능력치를 올려요'), sel.el));

  // 아홉 축을 계열로 묶는다. 한 줄로 늘어놓으면 뭘 올려야 할지 안 보인다.
  const keys = Object.keys(UPGRADES);
  for (const grp of UP_GROUPS) {
    const mine = keys.filter((k) => UPGRADES[k].group === grp.id);
    if (!mine.length) continue;
    root.append(h('div', { class: 'section-title', style: 'margin:14px 2px 6px' }, h('span', {}, grp.name)));
    for (const key of mine) root.append(makeRow(key));
  }

  function makeRow(key) {
    const def = UPGRADES[key];
    const name = h('div', { class: 'name' });
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const bar = h('div', { class: 'bar', style: 'height:5px;margin:6px 0 0' }, h('div'));
    const nextTier = h('div', { class: 'tier-hint' });
    const btn = h('button', { class: 'buy gold-cost', onclick: () => {
      const before = game.s.upgrades[key];
      if (!game.buyUpgrade(key, sel.times())) return;
      const got = game.s.upgrades[key] - before;
      popUp(rows[key].row, got > 1 ? `+${got}` : '+1');
      app.refresh();
    } });
    const ico = h('div', { class: 'ico' }, def.icon);
    iconSkin(ico, 'up', keys.indexOf(key));
    const row = h('div', { class: 'row' },
      ico,
      h('div', { class: 'info' }, h('div', {}, name, lv), desc, bar, nextTier), btn);
    rows[key] = { name, lv, desc, bar, nextTier, btn, def, ico, row };
    return row;
  }

  function planned(key) {
    const def = UPGRADES[key];
    let l = game.s.upgrades[key];
    let total = 0;
    let n = 0;
    const want = sel.get() === 'MAX' ? Infinity : sel.get();
    while (n < want) {
      const c = def.cost(l);
      if (sel.get() === 'MAX' && n > 0 && total + c > game.s.gold) break;
      total += c; l++; n++;
      if (sel.get() === 'MAX' && total > game.s.gold) break;
      if (n > 5000) break;              // MAX가 영원히 돌지 않게
    }
    return { total, n, to: l };
  }

  const pp = (v) => `${(Math.abs(v * 100) < 10 ? (v * 100).toFixed(1) : Math.round(v * 100))}%`;
  // 이 축이 지금까지 준 것(기본값은 뺀다 — 수련이 준 몫만 보여 준다)
  function gaveText(key, l) {
    const def = UPGRADES[key];
    const now = upAdds(key, l);
    const base = def.base || {};
    const parts = [];
    for (const [stat, v] of Object.entries(now)) {
      const got = v - (base[stat] || 0);
      if (got <= 1e-9) continue;
      parts.push(`${UP_STAT_LABEL[stat]} <b>+${pp(got)}</b>`);
    }
    return parts.join(' · ') || '아직 없음';
  }

  function update() {
    for (const [key, r] of Object.entries(rows)) {
      const l = game.s.upgrades[key];
      const ti = upTierInfo(key, l);
      r.name.textContent = ti.name;
      r.name.style.color = ti.tier ? 'var(--accent-2)' : '';
      // 레벨과 차수를 같이 적는다. 차수는 이름만 바뀌는 게 아니라 효과가 커진다.
      r.lv.textContent = ti.tier ? `Lv.${l} · ${ti.tier + 1}차 ${ti.inTier}/${ti.step}`
        : `Lv.${l} · ${ti.inTier}/${ti.step}`;
      r.bar.firstChild.style.width = `${(ti.inTier / ti.step) * 100}%`;
      const p = planned(key);
      if (r.def.kind === 'mul') {
        const extra = gaveText(key, l);
        r.desc.innerHTML = `${fmtValue(r.def, r.def.value(l))} → <b>${fmtValue(r.def, r.def.value(p.to))}</b>`
          + (extra === '아직 없음' ? '' : `<br><span class="muted">덤: ${extra}</span>`);
      } else {
        const nx = upNext(key, l);
        r.desc.innerHTML = `${gaveText(key, l)}`
          + `<br><span class="muted">다음 한 칸: ${UP_STAT_LABEL[nx.stat]} +${pp(nx.amount)}</span>`;
      }
      // 다음 차수 예고. **올리면 뭐가 되는지를 먼저 보여 준다** — 50레벨을
      // 다 찍고서야 다음이 있다는 걸 알면 그때까지는 죽은 축으로 읽힌다.
      if (ti.nextStat) {
        const now = upStatAt(key, ti.tier);
        const label = UP_STAT_LABEL[ti.nextStat];
        r.nextTier.innerHTML = `${ti.left}레벨 뒤 <b>${ti.nextName}</b> — `
          + (ti.nextStat === now ? `한 칸당 ${label} +${pp(ti.nextAmount)}`
            : now ? `${label}${josaRo(label)} 바뀌어요 (한 칸당 +${pp(ti.nextAmount)})`
              : `${label}가 덤으로 붙어요 (한 칸당 +${pp(ti.nextAmount)})`);
      } else {
        r.nextTier.innerHTML = `${ti.left}레벨 뒤 <b>${ti.nextName}</b>`;
      }
      // 치명 확률만은 상한이 있다. 1차가 끝나면 치명 피해로 넘어가므로
      // '30%가 천장'으로 읽히지 않게 지금 값과 상한을 같이 적는다.
      if (key === 'crit' && ti.tier === 0) {
        r.nextTier.innerHTML += `<br>지금 치명 <b>${Math.round(game.stats({ buffs: false }).crit * 100)}%</b>`
          + ` (상한 ${Math.round(CRIT_CAP * 100)}% — 나머지는 병기보·옵션 칸·세트·의복에서)`;
      }
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
      h('p', { style: 'text-align:center;line-height:1.7', html: `회귀하면 1관문, 레벨 1로 돌아가요.<br>전생의 기억 <b>+${g}</b> → 모든 능력 <b>×${fmt(game.regressWorthMult())}</b>` }),
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
      h('b', {}, `지금보다 ${REGRESS_WORTH_MULT}배 넘게 세질 수 있고 관문이 한동안 안 올라가면, 그때가 회귀할 때예요.`),
      h('br'),
      '기억의 힘은 ', h('b', {}, '더하기가 아니라 곱하기'),
      '예요 — 기억 하나마다 곱해지니, 쌓을수록 크게 벌어져요.'));
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
    bonus.textContent = `×${fmt(game.regressMult())}`;
    const worth = game.regressWorth();
    const stuck = Math.floor(game.stuckFor() / 60);
    gain.innerHTML = g
      ? `지금 회귀하면 전생의 기억 <b>+${g}</b> → 기억의 힘이 <b>×${fmt(game.regressMult())}</b>에서`
        + ` <b style="color:var(--accent-2)">×${fmt(game.regressMult() * game.regressWorthMult())}</b>로`
        + ` (지금보다 ${game.regressWorthMult() < 100 ? `${game.regressWorthMult().toFixed(1)}배` : fmt(game.regressWorthMult()) + '배'} 세져요)`
        + `<br><span class="muted">최고 ${s.maxStage}관문 기준</span>`
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
    const trait = h('div', { class: 'desc', style: 'margin-top:2px' });
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
        h('div', { style: 'flex:1;min-width:0' }, title, tag, eff, art, trait, test, note), btn));
    root.append(row);
    cards[j.id] = { title, eff, art, trait, test, btn, row, def: j };
  }

  function update() {
    const open = game.jobOpen();
    const taste = game.tasteOpen();
    const at = game.nextJobAt();
    head.innerHTML = open
      ? `여덟 중 하나를 골라요. <b>처음 드는 건 공짜</b>지만, 바꿀 때마다 공적이 들어요.`
        + `<br><b>특성 단련은 문파마다 따로 쌓여요</b> — 갈아타면 들인 공적은 두고 가요.`
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
      const mine = jobSkillsOf(j.id);
      const openN = taste ? 1 : game.jobSlotCount();
      c.art.innerHTML = mine.length
        ? '전용 무공 ' + mine.map((s2, i2) => (i2 < openN
          ? `<b style="color:${j.color}">${s2.name}</b>`
          : `<span class="muted">${s2.name}(${JOB_SKILL_OPEN[i2]}관문)</span>`)).join(' · ')
        : '';
      // 특성 — 전직하면 쓰는 모든 무공에 실린다. 레벨은 문파마다 따로 쌓인다.
      const tr = jobTraitOf(j.id);
      const tlv = game.traitLvOf(j.id);
      c.trait.innerHTML = tr
        ? `특성 <b style="color:rgb(${tr.col})">〈${tr.name}〉</b> ${tr.text}`
          + (tlv ? ` <b>${tlv}단</b>` : '')
        : '';
      c.eff.innerHTML = taste ? '<span class="muted">문파에 들면 능력치 보너스가 붙어요</span>' : bonusText(j);
      // 시험 줄 — 뭘 해야 하는지 카드에 적어 둔다. 눌러 보고서야 알면 늦다.
      const d = jobTestOf(j.id);
      c.test.innerHTML = taste || !d ? ''
        : passed ? `<span style="color:var(--accent-2)">입문 시험 〈${d.name}〉 통과</span>`
          : stageOpen ? `입문 시험 <b>〈${d.name}〉</b> — ${d.ask}`
            : `<span class="muted">입문 시험 〈${d.name}〉</span>`;
      c.row.style.opacity = stageOpen ? '' : '0.5';
      c.row.style.outline = picked ? `1px solid ${j.color}` : '';
      const cost = taste ? 0 : game.jobSwitchCost(j.id);
      c.btn.textContent = tasting ? '내려놓기' : taste ? '맛보기'
        : picked ? '그만두기' : unlocked ? (cost ? `공적 ${fmt(cost)}` : '입문')
          : stageOpen ? '시험 보기' : (!open ? '경지 부족' : `${need}관문`);
      // 값이 모자라면 못 누른다. 누르고 나서 안 된다고 알려 주면 늦다.
      c.btn.disabled = (!stageOpen && !picked) || (unlocked && !picked && cost > game.s.merit);
    }
  }
  return { root, update, res: ['merit'] };
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
