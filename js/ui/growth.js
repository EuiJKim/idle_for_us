// 성장 탭: 은자 수련 / 레벨(스탯 포인트) / 경지
import { UPGRADES, SP_STATS, SP_RESET_GEMS, RANKS, RANK_MULT, expToNext, REGRESS_MIN_STAGE, REGRESS_PER_POINT } from '../data.js';
import { fmt } from '../fmt.js';
import { drawFighter } from '../battle.js';
import { h, toast, openModal, closeModal, fmtValue, subTabs, multSelector } from './common.js';

function upgradeView(app) {
  const { game } = app;
  const rows = {};
  const sel = multSelector(() => update());
  const root = h('div', {}, h('div', { class: 'section-title' }, h('span', {}, '은자로 능력치를 올려요'), sel.el));

  for (const [key, def] of Object.entries(UPGRADES)) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy gold-cost', onclick: () => { if (game.buyUpgrade(key, sel.times())) app.refresh(); } });
    rows[key] = { lv, desc, btn, def };
    root.append(h('div', { class: 'row' },
      h('div', { class: 'ico' }, def.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, def.name, lv), desc), btn));
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
        r.desc.innerHTML = `<b>${fmtValue(r.def, r.def.value(l))}</b> (최대)`;
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
  return { root, update };
}

function levelView(app) {
  const { game } = app;
  const lvl = h('b', { style: 'font-size:18px' });
  const bar = h('div', { class: 'bar' }, h('div'), h('span'));
  const spText = h('b', { style: 'color:#fde68a' });
  const resetBtn = h('button', { class: 'btn', style: 'padding:6px 10px' }, `초기화 寶${SP_RESET_GEMS}`);
  resetBtn.onclick = () => openModal((s) => {
    s.append(h('h2', {}, '스탯 포인트 초기화'), h('p', { class: 'muted' }, `寶${SP_RESET_GEMS}을 쓰고 모든 포인트를 돌려받아요.`),
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

  for (const [key, def] of Object.entries(SP_STATS)) {
    const pts = h('small');
    const desc = h('div', { class: 'desc' });
    const b1 = h('button', { class: 'buy', style: 'min-width:48px', onclick: () => { game.allocSp(key, 1); app.refresh(); } }, '+1');
    const b10 = h('button', { class: 'buy', style: 'min-width:48px', onclick: () => { game.allocSp(key, 10); app.refresh(); } }, '+10');
    const bAll = h('button', { class: 'buy', style: 'min-width:48px', onclick: () => { game.allocSp(key, game.s.sp); app.refresh(); } }, '전부');
    rows[key] = { pts, desc, btns: [b1, b10, bAll], def };
    root.append(h('div', { class: 'row' }, h('div', { class: 'ico' }, def.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, def.name, pts), desc),
      h('div', { style: 'display:flex;gap:4px' }, b1, b10, bAll)));
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
      r.desc.textContent = r.def.desc(n * r.def.per);
      r.btns.forEach((b) => { b.disabled = s.sp <= 0; });
    }
  }
  return { root, update };
}

function rankView(app) {
  const { game } = app;
  const cv = h('canvas', { width: 160, height: 160, style: 'width:120px;height:120px;flex:none' });
  const name = h('div', { style: 'font-size:18px;font-weight:900' });
  const bonus = h('div', { class: 'muted' });
  const next = h('div', { style: 'margin-top:8px' });
  const btn = h('button', { class: 'btn primary', style: 'margin-top:8px;width:100%' });
  btn.onclick = () => app.startTrial();
  const list = h('div');
  const root = h('div', {},
    h('div', { class: 'card', style: 'display:flex;gap:12px;align-items:center' }, cv,
      h('div', { style: 'flex:1;min-width:0' }, name, bonus, next, btn)),
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
    name.textContent = `${r.name}`;
    bonus.textContent = `공격력·체력 ×${fmt(Math.pow(RANK_MULT, s.rank))}`;
    if (!nx) {
      next.textContent = '천인합일, 무의 끝에 이르렀어요!';
      btn.classList.add('hidden');
    } else {
      btn.classList.remove('hidden');
      next.innerHTML = `다음: <b>${nx.name}</b> (레벨 ${nx.level} 필요) → 공격력·체력 <b>×${RANK_MULT}</b>`;
      btn.textContent = s.level >= nx.level ? '심마(心魔)와 대결 · 경지 돌파' : `레벨 ${nx.level}에 도전 가능 (현재 ${s.level})`;
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
      h('div', { class: 'regress-hz' }, '回歸'),
      h('p', { style: 'text-align:center;line-height:1.7', html: `회귀하면 1관문, 레벨 1로 돌아가요.<br>전생의 기억 <b>+${g}</b> → 모든 능력 <b>+${Math.round(g * REGRESS_PER_POINT * 100)}%</b>` }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '아직'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); app.regress(); } }, '회귀한다')));
  });
  const root = h('div', {},
    h('div', { class: 'card regress-card' },
      h('div', { class: 'regress-hz small' }, '回歸'),
      h('p', { style: 'margin:4px 0 10px;line-height:1.6' },
        '죽음 직전, 눈을 뜨니 강호에 첫발을 디딘 그날이었다. ',
        '회귀하면 처음부터 다시 시작하지만, 전생의 기억이 남아 더 빨리 강해진다.'),
      h('div', { class: 'stat-grid' },
        h('div', {}, '회귀 횟수', count),
        h('div', {}, '전생의 기억', points),
        h('div', { style: 'grid-column:1/3' }, '기억의 힘 (공격력·체력·은자·경험치)', bonus)),
      gain, btn),
    h('div', { class: 'card' },
      h('h3', {}, '무엇이 남고 무엇이 사라지나'),
      h('p', { class: 'muted', style: 'line-height:1.7;margin:0' },
        '사라짐: 관문, 은자, 은자 수련, 레벨·스탯 포인트', h('br'),
        '남음: 경지, 병기·제련, 무공, 영수, 신물, 비경 기록, 원보·비급·한철·영초·신물 조각, 문파')));
  function update() {
    const s = game.s;
    const g = game.regressPreview();
    count.textContent = `${s.regress.count}회`;
    points.textContent = `${s.regress.points}`;
    bonus.textContent = `+${Math.round(s.regress.points * REGRESS_PER_POINT * 100)}%`;
    gain.innerHTML = g
      ? `지금 회귀하면 전생의 기억 <b>+${g}</b> (최고 ${s.maxStage}관문 기준)`
      : `${REGRESS_MIN_STAGE}관문을 넘으면 회귀할 수 있어요. (지금 ${s.maxStage}관문)`;
    btn.textContent = g ? `회귀한다 (+${g})` : `${REGRESS_MIN_STAGE}관문 이후 가능`;
    btn.disabled = !g || game.mode !== 'stage';
  }
  return { root, update };
}

export function growthTab(app) {
  return subTabs([
    { key: 'upgrade', label: '수련', make: () => upgradeView(app) },
    { key: 'level', label: '레벨', make: () => levelView(app) },
    { key: 'rank', label: '경지', make: () => rankView(app) },
    { key: 'regress', label: '회귀', make: () => regressView(app) },
  ]);
}
