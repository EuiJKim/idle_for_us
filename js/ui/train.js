// 수련 탭 — 은자로 능력치를 올린다. 묶음(공격·방어·무공·벌이)마다 하위 탭.
//
// 전에는 성장 탭 안의 한 화면에 열여섯 축이 세로로 쌓여 있어서, 아래쪽의
// 상재(은자)·좌망(방치)을 찍으려면 한참 내려가야 했고 뭐가 뭔지 안 보였다.
// 그리고 이제 **단계**가 있다 — 이번 생에 넘은 관문만큼만 올린다(data.js 수련 단계).
import { UPGRADES, UP_GROUPS, UP_STAT_LABEL, upAdds, upNext, upTierInfo, upStatAt, josaRo,
  critTierName, CRIT_STEP } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { big } from '../big.js';
import { h, fmtValue, subTabs, multSelector, popUp, holdRepeat, softRefresh, short } from './common.js';
import { iconSkin } from '../icons.js';

// 묶음 이름은 짧게(하위 탭 버튼), 설명은 머리에
const GROUP_TAB = {
  atk: { label: '공격', hint: '때리는 힘 — 외공·치명·쾌검·연격·투지' },
  def: { label: '방어', hint: '버티는 힘 — 내공·호신·역근' },
  mu: { label: '무공', hint: '무공 다루기 — 심법·토납·미혹·혈조' },
  etc: { label: '벌이', hint: '벌이 — 상재(은자)·오성(경험치)·좌망(방치)' },
};

function groupView(app, grp) {
  const { game } = app;
  const rows = {};
  const sel = multSelector(() => update());
  const head = h('span', {}, grp.hint);
  // 단계 — 이번 생에 넘은 관문만큼만 올릴 수 있다
  const stageCard = h('div', { class: 'card up-stage' });
  const root = h('div', {}, stageCard, h('div', { class: 'section-title' }, head, sel.el));

  // 이 묶음의 축만. 열여섯을 한 줄로 늘어놓으니 아래쪽(상재·좌망)까지 한참 내려가야 했다.
  const keys = Object.keys(UPGRADES);
  for (const key of keys.filter((k) => UPGRADES[k].group === grp.id)) root.append(makeRow(key));

  function makeRow(key) {
    const def = UPGRADES[key];
    const name = h('div', { class: 'name' });
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const bar = h('div', { class: 'bar', style: 'height:5px;margin:6px 0 0' }, h('div'));
    const nextTier = h('div', { class: 'tier-hint' });
    const buy = (soft) => {
      const before = game.s.upgrades[key];
      if (!game.buyUpgrade(key, sel.times())) return false;
      const got = game.s.upgrades[key] - before;
      popUp(rows[key].row, got > 1 ? `+${got}` : '+1');
      if (soft) softRefresh(app); else app.refresh();
      return true;
    };
    const btn = h('button', { class: 'buy gold-cost', onclick: () => buy(false) });
    holdRepeat(btn, () => buy(true));
    const ico = h('div', { class: 'ico' }, def.icon);
    iconSkin(ico, 'up', keys.indexOf(key));
    // 어디에 부을지가 숙제다. 값당 가장 많이 오르는 칸에 표를 달아 준다.
    const best = h('i', { class: 'best-tag' }, '이득');
    const row = h('div', { class: 'row' },
      ico,
      h('div', { class: 'info' }, h('div', {}, name, lv, best), desc, bar, nextTier), btn);
    rows[key] = { name, lv, desc, bar, nextTier, btn, def, ico, row, best };
    return row;
  }

  function planned(key) {
    const def = UPGRADES[key];
    let l = game.s.upgrades[key];
    let total = big(0);
    let n = 0;
    const want = Math.min(sel.get() === 'MAX' ? Infinity : sel.get(), Math.max(0, game.upCapOf(key) - l));
    while (n < want) {
      const c = def.cost(l);
      if (sel.get() === 'MAX' && n > 0 && total.add(c).gt(game.s.gold)) break;
      total = total.add(c); l++; n++;
      if (sel.get() === 'MAX' && total.gt(game.s.gold)) break;
      if (n > 5000) break;              // MAX가 영원히 돌지 않게
    }
    return { total, n, to: l };
  }

  // 가산 통계는 Big이다. `v * 100`을 하면 NaN이 되거나 지수가 날것으로 샌다 —
  // 화면에 "+1.0815362334304659e+24%"가 찍힌 적이 있다. fmt의 pct에 맡긴다.
  const pp = (v) => pct(v);
  // 이 축이 지금까지 준 것(기본값은 뺀다 — 수련이 준 몫만 보여 준다)
  function gaveText(key, l) {
    const def = UPGRADES[key];
    const now = upAdds(key, l);
    const base = def.base || {};
    const parts = [];
    for (const [stat, v] of Object.entries(now)) {
      const got = big(v).sub(base[stat] || 0);
      if (!got.gt(1e-9)) continue;
      parts.push(`${UP_STAT_LABEL[stat]} <b>+${pp(got)}</b>`);
    }
    return parts.join(' · ') || '아직 없음';
  }

  function update() {
    // 값당 오름폭 순위. 1등에 표를 달고, 줄마다 얼마나 오르는지 적는다.
    const gains = game.upgradeGains();
    const rank = Object.fromEntries(gains.map((g, i) => [g.key, { i, gain: g.gain }]));
    const top = gains[0];
    head.innerHTML = top
      ? `전체에서 지금 <b style="color:var(--accent-2)">${UPGRADES[top.key].name.replace(/\(.*\)$/, '')}</b>이 값당 가장 많이 올라요`
      : '열린 단계를 다 채웠어요';
    const stg = game.upStage();
    const nextAt = game.upNextStageAt();
    const full = Object.keys(rows).every((k) => game.upgradeMaxed(k));
    stageCard.innerHTML = `<b>수련 ${stg}단계</b> <small class="muted">— 이번 생에 넘은 관문만큼 열려요</small>`
      + `<div class="desc">다음 ${stg + 1}단계는 <b>제 ${nextAt}관문</b>을 넘으면 열려요 (지금 ${game.s.maxStage}관문)`
      + (full ? ` · <b style="color:var(--accent-2)">이 묶음은 다 찼어요 — 관문을 밀어요</b>` : '')
      + `</div><div class="bar" style="height:5px;margin:6px 0 0"><div style="width:${Math.min(100, ((game.s.maxStage - (nextAt - 50)) / 50) * 100)}%"></div></div>`;
    for (const [key, r] of Object.entries(rows)) {
      const l = game.s.upgrades[key];
      const cap = game.upCapOf(key);
      const maxed = l >= cap;
      // 단계 끝에 딱 맞게 멈춰 있으면 '다음 차수 0/60'이 아니라 '이번 차수 60/60'으로 보인다
      const edge = maxed && l > 0 && upTierInfo(key, l).inTier === 0;
      const ti = edge ? { ...upTierInfo(key, l - 1) } : upTierInfo(key, l);
      if (edge) { ti.inTier += 1; ti.left -= 1; }
      r.name.textContent = ti.name;
      r.name.style.color = ti.tier ? 'var(--accent-2)' : '';
      // 레벨과 차수를 같이 적는다. 차수는 이름만 바뀌는 게 아니라 효과가 커진다.
      r.lv.textContent = (ti.tier ? `Lv.${l} · ${ti.tier + 1}차 ${ti.inTier}/${ti.step}`
        : `Lv.${l} · ${ti.inTier}/${ti.step}`) + (maxed ? ' · 단계 끝' : '');
      r.row.classList.toggle('maxed', maxed);
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
      if (key === 'crit') {
        // 치명 확률에는 상한이 없다 — 100%마다 한 단계씩 올라간다
        const stc = game.stats({ buffs: false });
        const t = Math.floor(stc.crit);
        const now = critTierName(t) || '보통';
        const nx = critTierName(t + 1);
        r.nextTier.innerHTML += `<br>지금 치명 확률 <b>${Math.round(stc.crit * 100)}%</b> — 모든 타격이 <b>${now}</b>`
          + `, ${Math.round((stc.crit - t) * 100)}% 확률로 <b style="color:var(--accent-2)">${nx}</b>`
          + ` (치명 ×${stc.critDmg.toFixed(2)}, 그 위로 단계마다 ×${CRIT_STEP})`;
      }
      // 값당 얼마나 오르나. 1등은 표를 단다.
      const g2 = rank[key];
      r.best.style.display = g2 && g2.i === 0 ? '' : 'none';
      r.row.classList.toggle('best-row', !!g2 && g2.i === 0);
      if (g2 && g2.gain > 0) {
        r.lv.title = `한 칸에 전투력 +${(g2.gain * 100).toFixed(2)}%`;
      }
      if (maxed) {
        r.btn.textContent = `${game.upNextStageAt()}관문`;
        r.btn.disabled = true;
        r.nextTier.innerHTML = `이번 단계를 다 채웠어요 — <b>제 ${game.upNextStageAt()}관문</b>을 넘으면 ${game.upStage() + 1}단계가 열려요`;
      } else {
        r.btn.textContent = `${fmt(p.total)}${p.n > 1 ? ` (+${p.n})` : ''}`;
        r.btn.disabled = short(game.s.gold, game.upgradeCost(key));
      }
    }
  }
  return { root, update, res: ['gold'] };
}


export function trainTab(app) {
  return subTabs(UP_GROUPS.map((g) => ({
    key: g.id,
    label: GROUP_TAB[g.id]?.label || g.name,
    make: () => groupView(app, { ...g, hint: GROUP_TAB[g.id]?.hint || g.name }),
  })));
}
