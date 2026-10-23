// 성장 탭: 은자 수련 / 레벨(스탯 포인트) / 경지
import { UPGRADES, UP_GROUPS, UP_STAT_LABEL, upAdds, upNext, upTierInfo, upStatAt, josaRo,
  SP_STATS, SP_RESET_GEMS, RANKS, RANK_MULT, expToNext, REGRESS_MIN_STAGE,
  CRIT_CAP, REGRESS_WORTH_MULT, JOBS, RANK_SUBS, rankSubLevel,
  jobTraitOf, jobTestOf, jobTestStage, TIER_AT, TIER_MAX, TIER_SKILL_MULT, SKILLS, skillFor,
  CLASS_CHANGE_GEMS } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { big } from '../big.js';
import { drawFighter } from '../battle.js';
import { h, toast, openModal, closeModal, fmtValue, subTabs, multSelector, popUp,
  holdRepeat, softRefresh, short} from './common.js';
import { iconSkin } from '../icons.js';

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
    bar.firstChild.style.width = `${Math.min(100, big(s.exp).div(need).toNumber() * 100)}%`;
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
    drawFighter(ctx, 70, 136, RANKS[game.s.rank].look, { t: performance.now() / 1000, blade: '#e5e7eb', weapon: game.job()?.look || 'sword' });
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

// 캐릭터 — 처음에 고른 넷 중 하나. 여기서는 전직(1차·2차·3차)을 올리고,
// 원보를 내면 다른 캐릭터로 바꾼다.
export const JOB_WORD = {
  atk: '공격력', hp: '체력', speed: '공격 속도', gold: '은자 획득',
  boss: '두목 피해', offline: '방치 보상', bleed: '출혈 피해',
  ccDur: '상태이상 지속', critDmg: '치명 피해', exp: '경험치',
};
export const jobBonusText = (j) => Object.entries({ ...(j.mult || {}), ...(j.add || {}) })
  .map(([k, v]) => `${JOB_WORD[k] || k} <b>×${v}</b>`).join(' · ');

// 전직 시험 창. 성장 탭과 들판 안내가 같이 쓴다.
export function openJobTest(app) {
  const { game } = app;
  const j = game.job();
  const d = j && jobTestOf(j.id);
  if (!d) return;
  const next = game.jobTier() + 1;
  openModal((s) => s.append(
    h('h2', {}, `${next}차 전직 — ${d.name}(${d.hanja})`),
    h('p', {}, h('b', { style: `color:${j.color}` }, d.ask)),
    h('p', { class: 'muted' }, d.why),
    h('p', { class: 'muted' },
      `제 ${jobTestStage(game.s.bestStage)} 관문의 힘으로 겨룹니다 · 제한 ${d.time}초`,
      h('br'), '떨어져도 잃는 건 없어요. 몇 번이든 다시 볼 수 있어요.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: () => {
        if (game.startJobTest()) { closeModal(); app.closePanel?.(); }
        else toast('들판에서만 시험을 볼 수 있어요');
      } }, '시험 보기'),
      h('button', { class: 'btn', onclick: closeModal }, '나중에'))));
}

function jobView(app) {
  const { game } = app;
  const card = h('div', { class: 'card' });
  const title = h('div', { style: 'font-weight:900;font-size:17px' });
  const tag = h('div', { class: 'desc', style: 'margin-top:2px' });
  const eff = h('div', { class: 'desc', style: 'margin-top:6px' });
  const trait = h('div', { class: 'desc', style: 'margin-top:2px' });
  const ladder = h('div', { class: 'tier-ladder' });
  const testBtn = h('button', { class: 'btn primary', style: 'width:100%;margin-top:10px', onclick: () => openJobTest(app) });
  card.append(title, tag, eff, trait, ladder, testBtn);

  // 다음 전직에서 무공 여덟이 어떻게 바뀌는지 — 각성은 미리 보여야 기대가 생긴다
  const awakeCard = h('div', { class: 'card' });
  const awakeHead = h('h3');
  const awakeBody = h('div', { class: 'awake-list' });
  awakeCard.append(awakeHead, awakeBody);

  // 다른 캐릭터로 바꾸기
  const swapCard = h('div', { class: 'card' },
    h('h3', {}, '캐릭터 바꾸기', h('small', {}, `원보 ${fmt(CLASS_CHANGE_GEMS)}`)),
    h('p', { class: 'muted', style: 'margin:4px 0 8px' }, '전직 차수·무공 레벨·장비는 그대로 들고 가요. 특성 단련과 패시브는 캐릭터마다 따로 쌓여요.'));
  const swapBtns = {};
  for (const j of JOBS) {
    const b = h('button', { class: 'btn', style: `border-color:${j.color}`, onclick: () => {
      if (game.s.job === j.id) return;
      openModal((s) => s.append(
        h('h2', {}, `${j.name}(으)로 바꿀까요?`),
        h('p', {}, `원보 ${fmt(CLASS_CHANGE_GEMS)}이 들어요. 지금 원보 ${fmt(game.s.gems)}.`),
        h('p', { class: 'muted' }, j.desc),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', onclick: () => {
            if (game.setJob(j.id)) { closeModal(); app.refresh(); toast(`${game.tierName()}이(가) 되었어요`); }
            else toast('원보가 모자라요');
          } }, '바꾸기'),
          h('button', { class: 'btn', onclick: closeModal }, '그만두기'))));
    } }, j.name);
    swapBtns[j.id] = b;
  }
  swapCard.append(h('div', { class: 'btn-row' }, ...Object.values(swapBtns)));
  const root = h('div', {}, card, awakeCard, swapCard);

  let sig = '';
  function update() {
    const j = game.job();
    if (!j) { title.textContent = '캐릭터를 아직 안 골랐어요'; return; }
    const t = game.jobTier();
    const at = game.nextTierAt();
    card.style.borderColor = j.color;
    title.innerHTML = `<span style="color:${j.color}">${game.tierName()}</span>`
      + ` <small style="color:var(--muted)">${j.name} · ${j.weapon}${t ? ` · ${t}차 전직` : ' · 기초'}</small>`;
    tag.textContent = `${j.tag} — ${j.desc}`;
    eff.innerHTML = t >= 1 ? `능력치 ${jobBonusText(j)}`
      : `<span class="muted">1차 전직하면 능력치 ${jobBonusText(j)}</span>`;
    const tr = jobTraitOf(j.id);
    trait.innerHTML = tr
      ? `특성 <b style="color:rgb(${tr.col})">〈${tr.name}〉</b> ${tr.text}${t >= 1 ? '' : ' <span class="muted">(1차 전직부터)</span>'}`
      : '';
    // 전직 사다리 — 기초 → 1차 → 2차 → 3차
    const s2 = `${j.id}:${t}:${game.s.bestStage >= (at || 0)}`;
    if (s2 !== sig) {
      sig = s2;
      ladder.replaceChildren(...j.tiers.map((nm, i) => h('div', {
        class: `tier-step${i <= t ? ' done' : ''}${i === t + 1 ? ' next' : ''}`,
        style: i <= t ? `border-color:${j.color};color:${j.color}` : '',
      }, h('b', {}, nm), h('small', {}, i === 0 ? '기초' : `${i}차 · ${TIER_AT[i]}관문`))));
      // 각성 미리보기
      const nt = Math.min(TIER_MAX, t + 1);
      awakeHead.innerHTML = t >= TIER_MAX ? '무공 여덟 — 끝까지 각성했어요'
        : `${nt}차 전직하면 <small>무공 피해 ×${TIER_SKILL_MULT[t]} → ×${TIER_SKILL_MULT[nt]}</small>`;
      awakeBody.replaceChildren(...SKILLS.map((base) => {
        const now = skillFor(base.id, j.id, t);
        const nx = skillFor(base.id, j.id, nt);
        const big2 = nx.formTier === nt && nt > t;   // 이 차수에 판정까지 바뀌는 대표 초식
        return h('div', { class: 'awake-row' },
          h('small', { class: 'role-tag' }, base.role),
          h('span', {}, now.name),
          t < TIER_MAX ? h('span', { class: 'muted' }, ' → ') : '',
          t < TIER_MAX ? h('b', { style: big2 ? `color:${j.color}` : '' }, nx.name + (big2 ? ' ✦' : '')) : '');
      }));
    }
    testBtn.style.display = at == null ? 'none' : '';
    const open = game.tierOpen();
    const d = jobTestOf(j.id);
    testBtn.textContent = open ? `${t + 1}차 전직 시험 〈${d?.name || ''}〉 보기` : `${at}관문을 넘으면 ${t + 1}차 전직 시험이 열려요`;
    testBtn.disabled = !open;
    for (const jj of JOBS) {
      const b = swapBtns[jj.id];
      b.disabled = game.s.job === jj.id || game.s.gems < CLASS_CHANGE_GEMS;
      b.textContent = game.s.job === jj.id ? `${jj.name} (지금)` : jj.name;
    }
  }
  return { root, update, res: ['gems', 'merit'] };
}

export function growthTab(app) {
  return subTabs([
    { key: 'level', label: '레벨', make: () => levelView(app) },
    { key: 'rank', label: '경지', make: () => rankView(app) },
    { key: 'job', label: '전직', make: () => jobView(app) },
    { key: 'regress', label: '회귀', make: () => regressView(app) },
  ]);
}
