// 바람식 개편 — 창 다섯: 캐릭터 · 가방 · 지도 · 마을 · 무림.
// 창 하나는 { root, update } 를 돌려준다. update는 0.2초마다 불린다(열려 있을 때만).
import * as W from './world/wdata.js';
import { h, toast, openModal, closeModal, subTabs, popUp, holdRepeat } from './ui/common.js';
import { fmt } from './fmt.js';
import { dayKey } from './net.js';
import { drawCreature, CREATURES } from './creatures.js';

// 애완동물·탈것 그림 아이콘 (창 목록용) — 들판과 같은 그림을 작게
export function creatureIcon(kind, size = 44) {
  const cv = document.createElement('canvas');
  const q = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = size * q;
  cv.style.width = cv.style.height = `${size}px`;
  cv.className = 'creature-ico';
  const ctx = cv.getContext('2d');
  ctx.scale(q, q);
  const c = CREATURES[kind] || {};
  const big = (c.len || 30) > 50;
  const sc = (size / 44) * (c.type === 'dragon' ? (big ? 0.3 : 0.6) : big ? 0.4 : 0.9);
  drawCreature(ctx, kind, size * (big ? 0.42 : 0.5), size * (c.type === 'dragon' ? 0.8 : 0.95), { t: 0.6, scale: sc });
  return cv;
}

const pct = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, '')}%`;
// 조합 장비는 등급(레어·유니크·전설·신화) 빛깔, 옛 드랍 장비는 옛 등급 빛깔
const gradeOf = (it) => (it.rar != null ? W.RARITY[it.rar] : W.GRADES[it.grade]);
export const optLines = (it) => (it.opts || []).map(W.optText);

// 아이템 한 줄 요약 — '공격력 +123' 같은 것
export function itemLines(game, it) {
  const st = game.itemStats(it);
  const out = [];
  if (st.atk) out.push(`공격력 +${fmt(st.atk)}`);
  if (st.hp) out.push(`체력 +${fmt(st.hp)}`);
  if (st.def) out.push(`방어 +${st.def.toFixed(1)}`);
  if (st.crit) out.push(`치명 +${pct(st.crit)}`);
  if (st.atkPct) out.push(`공격력 +${pct(st.atkPct)}`);
  if (st.speed) out.push(`공격 속도 +${pct(st.speed)}`);
  if (st.hpPct) out.push(`최대 체력 +${pct(st.hpPct)}`);
  if (st.regenPct) out.push(`초당 체력 +${pct(st.regenPct, 1)}`);
  if (st.skill) out.push(`스킬 피해 +${pct(st.skill)}`);
  if (st.critDmg) out.push(`치명 피해 +${pct(st.critDmg)}`);
  if (st.exp) out.push(`경험치 +${pct(st.exp)}`);
  return out.join(' · ');
}
export function itemTitle(game, it) {
  return `${W.itemName(it, game.s.job)}${it.plus ? ` +${it.plus}` : ''}`;
}
function itemChip(game, it, extra = {}, withOpts = false) {
  const g = gradeOf(it);
  return h('div', { class: `item-chip g${it.grade}${it.rar === 3 ? ' mythic' : ''}`, style: `--gc:${g.color}`, ...extra },
    h('b', {}, itemTitle(game, it)),
    h('small', {}, `${it.rar != null ? `${g.name} · ` : ''}Lv.${it.ilv} · ${itemLines(game, it)}`),
    withOpts && it.opts?.length ? h('small', { class: 'opt-lines' }, ...optLines(it).map((t, i) => h('span', { class: it.opts[i].sp || it.opts[i].kp ? 'sp' : it.opts[i].pet ? 'pet' : '' }, t))) : null);
}

// ---------- 캐릭터 ----------
function charTab(app) {
  const { game } = app;
  const root = h('div');
  const head = h('div', { class: 'card' });
  const statRows = {};
  const ptsEl = h('b');
  const autoBtn = h('button', { class: 'btn', onclick: () => { game.s.autoStat = !game.s.autoStat; if (game.s.autoStat) game.autoStats(); app.save(); upd(); } });
  const resetBtn = h('button', { class: 'btn', onclick: () => {
    if (!game.resetStats()) return toast('은자가 모자라요');
    game.s.autoStat = false;
    toast('스탯을 되돌렸어요 — 다시 찍어 주세요');
    app.save(); upd();
  } });
  const stats = h('div', { class: 'card' },
    h('h3', {}, '스탯', h('small', {}, '레벨이 오를 때마다 3점')),
    h('div', { class: 'stat-head' }, h('span', {}, '남은 점수 ', ptsEl), autoBtn, resetBtn));
  for (const s of W.STATS) {
    const val = h('b');
    const btn = h('button', { class: 'buy', onclick: () => { if (game.addStat(s.id, 1)) { game.s.autoStat = false; popUp(row, '+1'); app.save(); upd(); } } }, '+1');
    holdRepeat(btn, () => { if (!game.addStat(s.id, 1)) return false; game.s.autoStat = false; upd(); return true; });
    const row = h('div', { class: 'row' }, h('div', { class: 'ico' }, s.name),
      h('div', { class: 'info' }, h('div', { class: 'name' }, s.name, ' ', val), h('div', { class: 'desc' }, s.desc)), btn);
    statRows[s.id] = { val, btn };
    stats.append(row);
  }
  const derived = h('div', { class: 'stat-grid' });
  // 스킬 레벨 — 레벨 15부터 레벨마다 점수 1, n→n+1에 점수 n
  const skillCard = h('div', { class: 'card' });
  let skSig = '';
  function skills() {
    const s = game.s;
    const nsig = `${s.skillPts}|${JSON.stringify(s.skillLv)}|${s.jobTier}|${game.statSig()}`;
    if (nsig === skSig) return;
    skSig = nsig;
    skillCard.replaceChildren(h('h3', {}, '스킬', h('small', {}, `스킬 점수 ${s.skillPts} · 레벨 ${W.SKILL_PT_FROM}부터 레벨마다 1점`)));
    const list = game.skills();
    if (!list.length) { skillCard.append(h('p', { class: 'muted' }, `1차 전직(레벨 ${W.TIERS[1].level})을 하면 스킬을 배워요.`)); return; }
    for (const sk of list) {
      const lv = game.skillLevel(sk.id);
      const md = game.skillMods(sk.id);
      const bits = [];
      if (md.dmg) bits.push(`피해 +${pct(md.dmg, 0)}`);
      if (md.range) bits.push(`범위 +${pct(md.range, 0)}`);
      if (md.splash) bits.push(`주변 적 ${pct(Math.min(md.splash, 9), 0)}`);
      if (md.cd) bits.push(`숨 -${pct(md.cd, 0)}`);
      if (md.cost && sk.hpCost) bits.push(md.free ? '체력 소모 없음' : `체력 소모 -${pct(md.cost, 0)}`);
      if (md.crit) bits.push(`치명 +${pct(md.crit, 0)}p`);
      if (md.echo) bits.push('30% 한 번 더');
      if (md.reset) bits.push('처치하면 숨 초기화');
      const max = lv >= W.SKILL_LV_MAX;
      skillCard.append(h('div', { class: 'row' },
        h('div', { class: 'ico' }, sk.icon),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, sk.name, h('small', {}, `${W.SKILL_ORDINAL[sk.slot]} · Lv.${lv}${max ? ' (최대)' : ''}`)),
          h('div', { class: 'desc' }, skillText(game, sk)),
          bits.length ? h('div', { class: 'desc', style: 'color:#fde68a' }, `레벨·장비: ${bits.join(' · ')}`) : null),
        h('button', { class: 'buy', disabled: game.canSkillUp(sk.id) ? null : true, onclick: () => {
          if (game.skillUp(sk.id)) { popUp(skillCard, `Lv.${game.skillLevel(sk.id)}`); app.save(); skSig = ''; upd(); }
        } }, max ? '최대' : `+1 · ${W.skillLvCost(lv)}점`)));
    }
  }
  root.append(head, stats, skillCard, h('div', { class: 'card' }, h('h3', {}, '능력치'), derived));
  function upd() {
    const s = game.s;
    const st = game.stats();
    const cls = W.classOf(s.job);
    head.replaceChildren(
      h('h3', {}, `${s.nickname || '무명'} `, h('small', {}, `${game.tierName()} · Lv.${s.level}`)),
      h('p', { class: 'muted' }, cls ? `${cls.name} — ${W.CLASSES[s.job].trait}` : ''),
      h('div', { class: 'bar' }, h('div', { style: `width:${Math.min(100, (s.exp / game.expNeed()) * 100)}%` }),
        h('span', {}, `경험치 ${fmt(s.exp)} / ${fmt(game.expNeed())}`)));
    skills();
    ptsEl.textContent = s.statPts;
    autoBtn.textContent = s.autoStat ? '자동 분배 켬' : '자동 분배 끔';
    autoBtn.classList.toggle('good', s.autoStat);
    resetBtn.textContent = `되돌리기 은자 ${fmt(game.statResetCost())}`;
    for (const k of Object.keys(statRows)) {
      statRows[k].val.textContent = `${game.totalStat(k)}`;
      statRows[k].btn.disabled = s.statPts <= 0;
    }
    derived.replaceChildren(
      h('div', {}, '공격력', h('b', {}, fmt(st.atk))),
      h('div', {}, '최대 체력', h('b', {}, fmt(st.hp))),
      h('div', {}, '방어', h('b', {}, st.def.toFixed(1))),
      h('div', {}, '치명', h('b', {}, `${pct(st.crit)} · ×${st.critDmg}`)),
      h('div', {}, '공격 속도', h('b', {}, `초당 ${(1 / st.atkSec).toFixed(2)}번`)),
      h('div', {}, '스킬 피해', h('b', {}, `×${st.skillMult.toFixed(2)}`)),
      h('div', {}, '체력 회복', h('b', {}, `초당 ${st.regen.toFixed(1)}`)),
      h('div', {}, '전투력', h('b', { style: 'color:var(--gold)' }, fmt(st.power))));
  }
  return { root, update: upd };
}

// ---------- 가방 ----------
// 맨 위 대장장이(조합: 아래 장비 + 재료 + 은자 → 위 장비), 끼고 있는 것, 가방.
function bagTab(app) {
  const { game } = app;
  const root = h('div');
  const smithCard = h('div', { class: 'card' });
  const equipCard = h('div', { class: 'card' });
  const bagCard = h('div', { class: 'card' });
  root.append(smithCard, equipCard, bagCard);
  let sig = '';
  const done = () => { app.save(); sig = ''; app.refresh(); };
  function openItem(it, worn) {
    openModal((s) => {
      const paint = () => {
        const g = gradeOf(it);
        const cur = game.s.equip[it.slot];
        const cost = game.enhanceCost(it);
        const max = (it.plus || 0) >= game.enhanceMax(it);
        const em = game.enhanceMats(it);
        const bm = game.breakMarksOf(it);
        const breaking = (it.plus || 0) >= W.ENHANCE_NORMAL;
        const pc = it.step != null && (it.rar || 0) < W.RARITY.length - 1 ? W.promoteCost(it) : null;
        s.replaceChildren(...[
          h('h2', { style: `color:${g.color}` }, itemTitle(game, it)),
          h('p', {}, `${W.SLOTS.find((x) => x.id === it.slot).name} · 아이템 레벨 ${it.ilv} · `, h('b', { style: `color:${g.color}` }, g.name)),
          h('p', {}, h('b', {}, itemLines(game, it))),
          it.opts?.length ? h('div', { class: 'opt-box' }, ...optLines(it).map((t, i) => h('div', { class: it.opts[i].sp || it.opts[i].kp ? 'sp' : it.opts[i].pet ? 'pet' : '' }, t))) : null,
          !worn && cur ? h('p', { class: 'muted' }, `지금 낀 것: ${itemTitle(game, cur)} — ${itemLines(game, cur)}`) : null,
          W.isDropOnly(it.slot) ? h('p', { class: 'muted' }, `${W.zoneOfW(W.stepMap(it.step))?.name || ''} 두목에게서만 나와요 — 강화가 어려워요(성공률 절반·은자 ×3·돌파 없음)`)
            : it.step != null ? h('p', { class: 'muted' }, `${W.zoneOfW(W.stepMap(it.step))?.name || ''} ${W.stepUpper(it.step) ? '상급' : '하급'} — 대장장이에서 위 장비의 조합 재료가 돼요 (강화는 절반을 이어받아요)`) : null,
          h('p', { class: 'muted' }, max ? '강화를 다 했어요' : `${breaking ? '돌파' : '강화'} +${(it.plus || 0) + 1} (기본 수치 +${pct(breaking ? W.BREAK_STEP : W.ENHANCE_STEP, 0)}) — 성공률 ${pct(game.enhanceRateOf(it), 0)} · 은자 ${fmt(cost)}${em ? ` · ${W.matName(em.key)} ${em.n}개 (가진 것 ${fmt(game.s.mats[em.key] || 0)})` : ''}${bm ? ` · ${W.matName(W.bossKey(em.key))} ${bm}개 (가진 것 ${fmt(game.s.mats[W.bossKey(em.key)] || 0)})` : ''} — 실패해도 깨지지 않아요`),
          pc ? h('p', { class: 'muted' }, `승급 → `, h('b', { style: `color:${W.RARITY[it.rar + 1].color}` }, W.RARITY[it.rar + 1].name),
            ` (기본 수치 ×${(W.RARITY[it.rar + 1].mult / W.RARITY[it.rar].mult).toFixed(2)}, 스킬 옵션 새로) — ${W.matName(pc.key)} ${pc.mats} · ${W.matName(W.bossKey(pc.key))} ${pc.marks} · 은자 ${fmt(pc.gold)}`) : null,
          h('div', { class: 'btn-row' },
            !worn ? h('button', { class: 'btn primary', onclick: () => { game.equipFromBag(it.uid); closeModal(); done(); } }, '끼기') : null,
            h('button', { class: 'btn good', disabled: game.canEnhance(it) ? null : true, onclick: () => {
              const ok = game.enhance(it.uid);
              if (ok === null) return toast('은자나 재료가 모자라요');
              toast(ok ? `강화 성공! +${it.plus}` : '강화 실패… (깨지지는 않아요)');
              app.save(); paint(); app.refresh();
            } }, breaking ? '돌파' : '강화'),
            pc ? h('button', { class: 'btn primary', disabled: game.canPromote(it) ? null : true, onclick: () => {
              if (!game.promote(it.uid)) return toast('재료·증표·은자가 모자라요');
              toast(`승급! ${W.RARITY[it.rar].name} — ${optLines(it).join(' / ')}`);
              app.save(); paint(); app.refresh();
            } }, '승급') : null,
            !worn ? h('button', { class: 'btn', onclick: () => { const p = game.sell(it); toast(`은자 +${fmt(p)}`); closeModal(); done(); } }, `팔기 ${fmt(W.sellPrice(it))}`) : null,
            h('button', { class: 'btn', onclick: closeModal }, '닫기')),
        ].filter(Boolean));   // replaceChildren은 null을 글자 'null'로 넣는다
      };
      paint();
    });
  }
  // 대장장이 — 칸마다 다음에 만들 수 있는 것과 그 조합법. 모자란 것은 붉게.
  function need(label, have, want, color) {
    const ok = have >= want;
    return h('span', { class: `need${ok ? ' ok' : ''}`, style: color ? `--mc:${color}` : '' }, label, ' ', h('b', {}, `${fmt(Math.min(have, want))}/${fmt(want)}`));
  }
  function smith() {
    const s = game.s;
    const keys = Object.keys(s.mats).filter((k) => s.mats[k] > 0)
      .sort((a, b) => (parseInt(a.replace('b', ''), 10) - parseInt(b.replace('b', ''), 10)) || (a[0] === 'b') - (b[0] === 'b'));
    smithCard.replaceChildren(h('h3', {}, '대장장이', h('small', {}, '아래 장비 + 재료 + 은자 → 위 장비')),
      h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 6px' },
        `만들면 레어 ${W.CRAFT_RAR_W[0]}% · 유니크 ${W.CRAFT_RAR_W[1]}% · 전설 ${W.CRAFT_RAR_W[2]}% — 넣는 장비의 등급·옵션은 이어받아요. 신화는 두목 드랍이나 승급(장비를 눌러서)으로.`),
      keys.length ? h('div', { class: 'mat-row' }, ...keys.map((k) => h('span', { class: 'mat-chip', style: `--mc:${W.matColor(k)}` },
        h('b', {}, W.matName(k)), h('small', {}, fmt(s.mats[k])))))
        : h('p', { class: 'muted' }, '몹은 그 사냥터 재료를, 두목은 재료 한 움큼과 증표를 떨궈요. 모아서 장비를 조합해요.'));
    for (const sl of W.CRAFT_SLOTS) {
      for (const step of game.nextSteps(sl.id)) {
        const { r, src, ok } = game.craftCheck(sl.id, step);
        const sample = game.makeCrafted(sl.id, step);
        const parts = [];
        if (r.from.length) {
          const want = { slot: sl.id, step: r.from[0], grade: W.stepGrade(r.from[0]) };
          parts.push(h('span', { class: `need${src ? ' ok' : ''}` }, src ? itemTitle(game, src) : `${W.itemName(want, s.job)}${r.from.length > 1 ? ' (또는 상급)' : ''}`, ' ', h('b', {}, src ? '✓' : '없음')));
        }
        for (const [k, n] of Object.entries(r.mats)) parts.push(need(W.matName(k), s.mats[k] || 0, n, W.matColor(k)));
        parts.push(need('은자', s.gold, r.gold));
        smithCard.append(h('div', { class: `row craft-row${ok ? ' ready' : ''}` },
          h('div', { class: 'ico', style: sl.name.length > 2 ? 'font-size:13px' : '' }, sl.name),
          h('div', { class: 'info' },
            h('div', { class: 'name' }, itemTitle(game, sample), h('small', {}, `Lv.${sample.ilv} · ${itemLines(game, sample)} (레어 기준)`)),
            h('div', { class: 'desc needs' }, ...parts)),
          h('button', { class: 'buy', disabled: ok ? null : true, onclick: () => {
            const it = game.craft(sl.id, step);
            if (it) done();
          } }, '조합')));
      }
    }
  }
  function upd() {
    const s = game.s;
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid + '.' + i.plus).join(',')}|${s.bagSize}|${JSON.stringify(s.mats)}|${W.CRAFT_SLOTS.map((x) => game.nextSteps(x.id).map((st) => game.craftCheck(x.id, st).ok))}|${s.gold >= game.bagUpgradeCost()}`;
    if (nsig === sig) return;
    sig = nsig;
    smith();
    equipCard.replaceChildren(h('h3', {}, '끼고 있는 것', h('small', {}, '눌러서 강화')));
    for (const sl of W.SLOTS) {
      const it = s.equip[sl.id];
      equipCard.append(h('div', { class: 'equip-slot' }, h('span', { class: 'slot-name' }, sl.name),
        it ? itemChip(game, it, { onclick: () => openItem(it, true) }, true) : h('div', { class: 'item-chip empty' }, '비어 있음')));
    }
    // 같은 것(칸·레벨·등급·강화)은 한 칸에 ×n으로 묶는다 — 셋이 모이면 합성할 수 있다는 게 보이게
    const groups = new Map();
    for (const it of s.bag) {
      const k = `${it.slot}|${it.ilv}|${it.grade}|${it.plus || 0}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const sorted = [...groups.values()].sort((a, b) => b[0].grade - a[0].grade || b[0].ilv - a[0].ilv);
    const grid = h('div', { class: 'bag-grid' }, ...sorted.map((g) => {
      const chip = itemChip(game, g[0], { onclick: () => openItem(g[0], false) });
      if (g.length > 1) chip.append(h('i', { class: 'cnt' }, `×${g.length}`));
      return chip;
    }));
    // 낀 것보다 약한 것 (조합은 가진 가장 높은 장비로 하니 쓸 일이 없다)
    const old = s.bag.filter((x) => s.equip[x.slot] && game.itemScore(x) < game.itemScore(s.equip[x.slot]) && !x.plus);
    bagCard.replaceChildren(
      h('h3', {}, '가방', h('small', {}, `${s.bag.length} / ${s.bagSize} · 넘치면 가장 나쁜 것부터 팔아요`)),
      grid.childElementCount ? grid : h('p', { class: 'muted' }, '가방이 비었어요. 대장장이가 만든 장비는 낀 것보다 좋으면 바로 껴요.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', disabled: old.length ? null : true, onclick: () => {
          let p = 0;
          for (const it of old) p += game.sell(it);
          toast(`약한 장비 ${old.length}개를 팔아 은자 +${fmt(p)}`);
          done();
        } }, `약한 것 팔기${old.length ? ` ${old.length}` : ''}`),
        h('button', { class: 'btn', disabled: game.s.gold < game.bagUpgradeCost() || s.bagSize >= 80 ? true : null, onclick: () => { if (game.buyBagSpace()) { toast('가방이 10칸 넓어졌어요'); done(); } } },
          s.bagSize >= 80 ? '가방 끝까지' : `+10칸 · ${fmt(game.bagUpgradeCost())}`)));
  }
  return { root, update: upd };
}

// ---------- 지도 ----------
// 지역마다 한 장: 구역 1·2·3과 두목 구역 단추. 레벨 99부터 십이지왕.
function mapTab(app) {
  const { game } = app;
  const root = h('div');
  let sig = '';
  const go = (id) => { if (!game.enterMap(id)) return; app.save(); app.closePanel(); app.refresh(); };
  function upd() {
    const s = game.s;
    const nsig = `${s.level}|${s.map}|${s.huntMap}`;
    if (nsig === sig) return;
    sig = nsig;
    const here = W.mapOf(s.map);
    root.replaceChildren(h('p', { class: 'muted' }, '지역마다 구역 1·2·3(뒤로 갈수록 세다)과 두목 구역이 있어요. 두목 증표는 두목 구역에서만 나와요.'),
      h('div', { class: `row map-row${here.town ? ' me' : ''}` }, h('div', { class: 'ico' }, '촌'),
        h('div', { class: 'info' }, h('div', { class: 'name' }, '객잔 마을'), h('div', { class: 'desc' }, '쉬는 곳 — 체력이 빨리 차요')),
        h('button', { class: 'buy', disabled: here.town ? true : null, onclick: () => { game.goTown(); app.save(); app.closePanel(); app.refresh(); } }, here.town ? '여기' : '가기')));
    let kingHead = false;
    for (const zn of W.ZONES_W.slice(1)) {
      const areas = W.MAPS.filter((m) => m.zone === zn.id);
      const open = game.canEnter(areas[0].id);
      if (zn.king && !kingHead) {
        kingHead = true;
        root.append(h('h3', { class: 'king-head' }, '십이지왕', h('small', {}, '레벨 99부터 · 제12왕에서 제1왕 검왕까지')));
      }
      // 아직 먼 지역은 다음 하나만 보여 준다(목록이 길어지지 않게)
      if (!open && s.level < zn.lv[0] - 12 && !(zn.king && s.level >= 90)) continue;
      const fit = areas.some((m) => !m.bossRoom && s.level >= m.lv[0] && s.level <= m.lv[1] + 2);
      const btns = areas.map((m) => h('button', {
        class: `area-btn${m.bossRoom ? ' boss' : ''}${s.map === m.id ? ' here' : ''}`,
        disabled: !game.canEnter(m.id) ? true : null,
        title: `${m.name} · Lv.${m.lv[0]}~${m.lv[1]}`,
        onclick: () => go(m.id),
      }, m.bossRoom ? '두목' : String(m.area), h('small', {}, `Lv${m.lv[0]}`)));
      root.append(h('div', { class: `card zone-card${zn.king ? ' king' : ''}${here.zone === zn.id ? ' me' : ''}${open ? '' : ' locked'}` },
        h('div', { class: 'zone-head' },
          h('b', {}, zn.name), fit ? h('i', { class: 'best-tag' }, '알맞음') : null,
          h('small', {}, `Lv.${zn.lv[0]}~${zn.lv[1]} · 두목 ${zn.boss.name}`)),
        zn.king ? h('p', { class: 'muted king-desc' }, `${zn.king.hanja} · ${zn.king.desc}`) : null,
        h('div', { class: 'area-row' }, ...btns)));
    }
  }
  return { root, update: upd };
}

// ---------- 마을 ----------
function townTab(app) {
  const { game } = app;
  const root = h('div');
  const status = h('div', { class: 'card' });
  const shop = h('div', { class: 'card' });
  const master = h('div', { class: 'card' });
  root.append(status, master, shop);
  let sig = '';
  function upd() {
    const s = game.s;
    const inTown = game.map.town;
    // 바뀐 것이 있을 때만 다시 그린다 — 0.2초마다 단추를 갈아 끼우면 누르는 사이에 단추가 바뀌어 눌림이 사라진다
    const nsig = `${inTown}|${s.autoHunt}|${s.huntMap}|${s.jobTier}|${s.level}|${s.potions}|${s.books || 0}|${[10, 50, 200].map((n) => s.gold >= game.potionPrice() * n)}|${s.gold >= game.statBookCost()}|${game.canAdvance()}`;
    if (nsig === sig) return;
    sig = nsig;
    // 전직·상점·조합은 어디서나 된다. 마을은 쉬는 곳(체력이 빨리 찬다).
    status.replaceChildren(inTown
      ? h('div', { class: 'btn-row' }, h('span', { class: 'muted', style: 'flex:2;align-self:center' }, '마을에서 쉬는 중 — 체력이 빠르게 차요.'),
        h('button', { class: 'btn primary', disabled: game.canEnter(s.huntMap) ? null : true, onclick: () => { game.enterMap(s.huntMap); app.save(); app.closePanel(); app.refresh(); } }, `${W.mapOf(s.huntMap).name}(으)로`))
      : h('div', { class: 'btn-row' }, h('span', { class: 'muted', style: 'flex:2;align-self:center' }, '전직·상점·조합은 사냥터에서도 돼요. 마을에서는 체력이 빨리 차요.'),
        h('button', { class: 'btn', style: 'white-space:nowrap', onclick: () => { game.goTown(); app.save(); app.refresh(); } }, '쉬러 가기')));
    status.append(h('div', { class: 'row', style: 'margin-top:8px' },
      h('div', { class: 'ico' }, '대장'),
      h('div', { class: 'info' }, h('div', { class: 'name' }, '대장장이'),
        h('div', { class: 'desc' }, '아래 장비 + 사냥터 재료 + 두목 증표로 위 장비를 조합해요. 사냥터에서도 돼요.')),
      h('button', { class: 'buy', onclick: () => app.showTab?.('bag') }, '조합')));
    // 사부 — 전직
    const t = game.nextTier();
    const sk = t && W.skillsOf(s.job).find((k) => k.tier === s.jobTier + 1);
    master.replaceChildren(h('h3', {}, '사부', h('small', {}, `지금 ${game.tierName()}`)));
    if (!t) master.append(h('p', {}, '더 배울 것이 없다. 이제 네 길을 가거라.'));
    else {
      master.append(
        h('p', {}, `${s.jobTier + 1}차 전직 — ${game.tierName(s.jobTier + 1)}`),
        h('p', { class: 'muted' }, `배우는 스킬: `, h('b', {}, sk.name), ` — ${skillText(game, sk)}`),
        h('p', { class: 'muted' }, `레벨 ${t.level} · 은자 ${fmt(t.cost)}`),
        h('button', { class: 'btn primary', style: 'width:100%', disabled: game.canAdvance() ? null : true, onclick: () => {
          if (!game.advance()) return;
          app.save(); app.refresh();
        } }, s.level < t.level ? `레벨 ${t.level}이 되면` : s.gold < t.cost ? '은자가 모자라요' : '전직하기'));
    }
    // 상점 — 물약
    const price = game.potionPrice();
    shop.replaceChildren(h('h3', {}, '상점', h('small', {}, `물약 ${s.potions}개`)),
      h('p', { class: 'muted' }, `빨간 물약 — 최대 체력의 ${pct(W.POTION_HEAL, 0)} 회복 · 체력이 ${pct(W.POTION_AT, 0)} 아래면 알아서 먹어요. 방치 중에도 먹으니, 떨어지면 방치 사냥이 멈춰요.`),
      h('div', { class: 'btn-row' }, ...[10, 50, 200].map((n) => h('button', { class: 'buy', disabled: s.gold < price * n ? true : null, onclick: () => {
        if (game.buyPotions(n)) { toast(`물약 ${n}개를 샀어요`); app.save(); app.refresh(); }
      } }, `${n}개 · ${fmt(price * n)}`))),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('div', { class: 'ico' }, '비급'),
        h('div', { class: 'info' }, h('div', { class: 'name' }, '무공 비급', h('small', {}, `${s.books || 0}권 읽음`)),
          h('div', { class: 'desc' }, '읽으면 스탯 점수 +1. 한 권 읽을 때마다 값이 오른다.')),
        h('button', { class: 'buy', disabled: s.gold < game.statBookCost() ? true : null, onclick: () => {
          if (game.buyStatBook()) { toast('스탯 점수 +1'); app.save(); app.refresh(); }
        } }, `은자 ${fmt(game.statBookCost())}`)));
  }
  return { root, update: upd };
}

export function skillText(game, sk) {
  const where = sk.kind === 'single' ? '한 적에게' : game.ranged() ? '겨눈 자리 둘레 모두에게' : '둘레 모두에게';
  const cd = game.skillCd ? game.skillCd(sk) : sk.cd;
  const cost = sk.hpCost * (1 - (game.skillMods ? game.skillMods(sk.id).cost : 0));
  return `${where} 공격력 ×${sk.mult} · 숨 ${cd.toFixed(cd < 10 ? 1 : 0).replace(/\.0$/, '')}초${sk.hpCost ? ` · 체력 ${pct(cost, 0)} 소모` : ''}`;
}

// ---------- 무림 ----------
// 서열(레벨 순) · 문파(만들기·가입 · 출석·기부 · 문파원 · 창고 · 채팅)
function rankView(app) {
  const { net } = app;
  const root = h('div');
  const list = h('div');
  const status = h('p', { class: 'muted' });
  root.append(h('div', { class: 'card' }, h('h3', {}, '서열', h('small', {}, '레벨 순')), status, list));
  let loaded = 0;
  async function load() {
    loaded = Date.now();
    if (!net?.ready?.()) { status.textContent = '인터넷에 연결되면 볼 수 있어요.'; return; }
    status.textContent = '불러오는 중…';
    try {
      await net.pushProfile(true);
      const rows = (await net.ranking()).sort((a, b) => (b.level || 0) - (a.level || 0) || (b.power || 0) - (a.power || 0));
      status.textContent = rows.length ? '' : '아직 아무도 없어요.';
      list.replaceChildren(...rows.map((p, i) => h('div', { class: `row rank-row${p.uid === net.uid ? ' me' : ''}` },
        h('div', { class: 'rank-no' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, p.nickname || '이름없음', h('small', {}, `${p.tierName || ''}`)),
          h('div', { class: 'desc' }, `Lv.${p.level || 1} · ${p.mapName || ''}${p.guildName ? ` · ${p.guildName}` : ''}`)),
        h('div', { style: 'font-weight:900;color:#fde68a' }, fmt(p.power || 0)))));
    } catch (err) {
      status.textContent = '불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.';
      console.warn('[ranking]', err);
    }
  }
  return { root, update() {}, shown() { if (Date.now() - loaded > 30000) load(); } };
}

const ago = (ms) => {
  if (!ms) return '';
  const m = Math.floor((Date.now() - ms) / 60000);
  return m < 2 ? '지금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
};

function guildView(app) {
  const { game, net } = app;
  const root = h('div');
  let view = null;
  let els = null;
  let chatSig = '';
  const busy = (btn, fn) => async () => {
    btn.disabled = true;
    try { await fn(); } catch (err) { toast(err.message || '실패했어요'); } finally { btn.disabled = false; }
  };

  function render() {
    root.replaceChildren();
    els = null;
    chatSig = '';
    if (!net?.online) {
      view = 'offline';
      root.append(h('div', { class: 'card' }, h('h3', {}, '문파'),
        h('p', { class: 'muted' }, net?.blocked ? '서버가 요청을 거부하고 있어요(인터넷 문제가 아니에요). Firestore 규칙을 확인해 주세요.'
          : net?.status === 'connecting' ? '서버에 연결하는 중이에요…' : '인터넷에 연결되면 문파·채팅을 할 수 있어요.'),
        net?.status === 'offline' ? h('button', { class: 'btn primary', onclick: () => { net.status = 'connecting'; render(); net.init(); } }, '다시 연결') : null));
      return;
    }
    if (!game.s.guildId || !net.guild) {
      view = game.s.guildId ? 'loading' : 'none';
      if (view === 'loading') { root.append(h('p', { class: 'muted' }, '문파 정보를 불러오는 중…')); return; }
      const nameIn = h('input', { class: 'field', maxlength: 16, placeholder: '문파 이름 (예: 우리끼리)' });
      const codeIn = h('input', { class: 'field', maxlength: 6, placeholder: '친구에게 받은 6자리 코드', style: 'text-transform:uppercase' });
      const createBtn = h('button', { class: 'btn primary' }, '만들기');
      createBtn.onclick = busy(createBtn, async () => {
        const name = nameIn.value.trim();
        if (name.length < 2) throw new Error('문파 이름은 2글자 이상이에요');
        await net.createGuild(name);
        toast('문파를 만들었어요! 코드를 친구에게 보내 주세요');
      });
      const joinBtn = h('button', { class: 'btn good' }, '가입');
      joinBtn.onclick = busy(joinBtn, async () => {
        if (codeIn.value.trim().length !== 6) throw new Error('코드는 6자리예요');
        await net.joinGuild(codeIn.value);
        toast('문파에 들어갔어요!');
      });
      root.append(
        h('div', { class: 'card' }, h('h3', {}, '문파', h('small', {}, `최대 ${W.GUILD_MAX}명`)),
          h('p', { class: 'muted' }, `문파 레벨마다 전원 공격력 +${pct(W.guildAtk(W.GUILD_LV_EXP))}. 출석·기부로 오르고, 창고로 조합 재료를 나눠 써요.`),
          h('div', { class: 'chat-input' }, nameIn, createBtn)),
        h('div', { class: 'card' }, h('h3', {}, '코드로 가입'), h('div', { class: 'chat-input' }, codeIn, joinBtn)));
      return;
    }
    view = 'guild';
    // 머리: 이름·레벨·버프·코드
    const title = h('span'); const lvl = h('small');
    const bar = h('div', { class: 'bar' }, h('div'), h('span'));
    const buff = h('p', { class: 'muted', style: 'margin:4px 0' });
    const code = h('b', { style: 'letter-spacing:2px;color:#fde68a' });
    const share = h('button', { class: 'btn', style: 'padding:6px 10px' }, '복사');
    share.onclick = async () => {
      const text = `우리끼리 무림 문파 "${net.guild.name}" 가입 코드: ${net.guild.code}\n${location.origin}${location.pathname}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('코드를 복사했어요'); } } catch { /* 취소 */ }
    };
    const leave = h('button', { class: 'btn danger', style: 'padding:6px 10px' }, '탈퇴');
    leave.onclick = () => openModal((m) => {
      m.append(h('h2', {}, '문파를 떠날까요?'), h('p', { class: 'muted' }, '문파 버프가 사라지고, 다시 코드로 들어올 수 있어요.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '취소'),
          h('button', { class: 'btn danger', onclick: async () => { closeModal(); await net.leaveGuild().catch((e) => toast(e.message)); } }, '탈퇴')));
    });
    const checkBtn = h('button', { class: 'btn good' });
    checkBtn.onclick = busy(checkBtn, async () => { if (await net.checkin()) toast(`출석! 문파 경험치 +${W.GUILD_CHECKIN_EXP}`); });
    const donateBtn = h('button', { class: 'btn primary' });
    donateBtn.onclick = busy(donateBtn, async () => { if (await net.donate()) { toast(`기부! 문파 경험치 +${W.GUILD_DONATE_EXP}`); app.save(); app.refresh(); } });
    // 문파원
    const members = h('div');
    // 창고
    const bankBox = h('div');
    const myBox = h('div');
    // 채팅
    const chatBox = h('div', { class: 'chat' });
    const input = h('input', { class: 'field', maxlength: 200, placeholder: '메시지 보내기' });
    const send = h('button', { class: 'btn primary' }, '전송');
    const doSend = async () => {
      const text = input.value;
      if (!text.trim()) return;
      input.value = '';
      try { await net.sendChat(text); } catch (err) { toast(err.message); input.value = text; }
    };
    send.onclick = doSend;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) doSend(); });
    els = { title, lvl, bar, buff, code, checkBtn, donateBtn, members, bankBox, myBox, chatBox };
    root.append(
      h('div', { class: 'card' }, h('h3', {}, title, lvl), bar, buff,
        h('div', { class: 'members', style: 'margin:8px 0;align-items:center' }, '코드 ', code, share, leave),
        h('div', { class: 'btn-row' }, checkBtn, donateBtn)),
      h('div', { class: 'card' }, h('h3', {}, '문파원'), members),
      h('div', { class: 'card' }, h('h3', {}, '문파 창고', h('small', {}, '재료를 넣고 꺼내 써요')), bankBox,
        h('p', { class: 'muted', style: 'margin:10px 0 4px' }, '내 재료 넣기'), myBox),
      h('div', { class: 'card' }, h('h3', {}, '문파 채팅'), chatBox, h('div', { class: 'chat-input' }, input, send)));
    loadMembers();
    update();
  }

  let membersAt = 0;
  async function loadMembers() {
    membersAt = Date.now();
    const rows = await net.members().catch(() => []);
    if (!els) return;
    const today = dayKey();
    const gd = net.guild;
    rows.sort((a, b) => (b.level || 0) - (a.level || 0));
    els.members.replaceChildren(...rows.map((p) => h('div', { class: `row rank-row${p.uid === net.uid ? ' me' : ''}` },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, `${p.uid === gd?.owner ? '👑 ' : ''}${p.nickname || '이름없음'}`, h('small', {}, p.tierName || '')),
        h('div', { class: 'desc' }, `Lv.${p.level || 1} · ${p.mapName || ''} · ${ago(p.updatedAt?.toMillis?.())}`)),
      h('div', { class: `chip${gd?.checkins?.[p.uid] === today ? ' on' : ''}` }, gd?.checkins?.[p.uid] === today ? '오늘 출석' : '미출석'))));
  }

  let bankSig = '';
  function renderBank() {
    const bank = net.bank();
    const mats = game.s.mats;
    const sig = JSON.stringify(bank) + JSON.stringify(mats);
    if (sig === bankSig) return;
    bankSig = sig;
    const order = (a, b) => parseInt(a.replace('b', ''), 10) - parseInt(b.replace('b', ''), 10) || (a[0] === 'b') - (b[0] === 'b');
    const chip = (k, n, label, fn) => {
      const b = h('button', { class: 'mat-chip', style: `--mc:${W.matColor(k)}` }, h('b', {}, W.matName(k)), h('small', {}, `${fmt(n)} · ${label}`));
      b.onclick = busy(b, fn);
      return b;
    };
    const inBank = Object.keys(bank).filter((k) => bank[k] > 0).sort(order);
    els.bankBox.replaceChildren(inBank.length ? h('div', { class: 'mat-row' }, ...inBank.map((k) => chip(k, bank[k], '눌러서 꺼내기', async () => {
      const n = await net.takeMats(k, bank[k]);
      if (n) { toast(`${W.matName(k)} ${n}개를 꺼냈어요`); app.save(); }
    }))) : h('p', { class: 'muted' }, '비어 있어요. 남는 재료를 넣어 두면 문파원이 조합에 써요.'));
    const mine = Object.keys(mats).filter((k) => mats[k] > 0).sort(order);
    els.myBox.replaceChildren(mine.length ? h('div', { class: 'mat-row' }, ...mine.map((k) => chip(k, mats[k], '눌러서 반 넣기', async () => {
      const n = await net.putMats(k, Math.max(1, Math.floor(mats[k] / 2)));
      if (n) { toast(`${W.matName(k)} ${n}개를 넣었어요`); app.save(); }
    }))) : h('p', { class: 'muted' }, '가진 재료가 없어요.'));
  }

  function renderChat() {
    const sig = net.messages.map((m) => m.id).join(',');
    if (sig === chatSig) return;
    chatSig = sig;
    const box = els.chatBox;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.replaceChildren(...(net.messages.length ? net.messages.map((m) => {
      const t = m.createdAt?.toDate ? m.createdAt.toDate() : null;
      const time = t ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
      if (m.type === 'system') return h('div', { class: 'msg system' }, m.text, h('time', {}, time));
      return h('div', { class: `msg${m.uid === net.uid ? ' mine' : ''}` }, h('span', { class: 'who' }, m.name), m.text, h('time', {}, time));
    }) : [h('div', { class: 'muted' }, '첫 메시지를 남겨 보세요 👋')]));
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  function update() {
    if (view !== 'guild' || !net.guild || !els) return;
    const gd = net.guild;
    const lv = W.guildLevel(gd.exp);
    const into = (gd.exp || 0) % W.GUILD_LV_EXP;
    const top = lv >= W.GUILD_LV_MAX;
    els.title.textContent = gd.name;
    els.lvl.textContent = `Lv.${lv}${top ? ' (최대)' : ''}`;
    els.bar.firstChild.style.width = `${top ? 100 : (into / W.GUILD_LV_EXP) * 100}%`;
    els.bar.lastChild.textContent = top ? 'MAX' : `문파 경험치 ${into} / ${W.GUILD_LV_EXP}`;
    els.buff.textContent = `문파 버프: 전원 공격력 +${pct(W.guildAtk(gd.exp))} · 인원 ${gd.memberIds.length}/${W.GUILD_MAX}`;
    els.code.textContent = gd.code;
    const checked = net.checkedInToday();
    els.checkBtn.textContent = checked ? '오늘 출석함' : `출석 +${W.GUILD_CHECKIN_EXP}`;
    els.checkBtn.disabled = checked ? true : null;
    const left = net.donatesLeft();
    els.donateBtn.textContent = left ? `기부 은자 ${fmt(net.donateCost())} (${left}/${W.GUILD_DONATE_PER_DAY})` : '오늘 기부 끝';
    els.donateBtn.disabled = !left || game.s.gold < net.donateCost() ? true : null;
    renderBank();
    renderChat();
    if (Date.now() - membersAt > 60000) loadMembers();
  }

  return {
    root,
    update,
    shown() { render(); },
    netChanged(what) {
      const want = !net?.online ? 'offline' : !game.s.guildId ? 'none' : net.guild ? 'guild' : 'loading';
      if (want !== view || what === 'status') render();
      else update();
    },
  };
}

function socialTab(app) {
  return subTabs([
    { key: 'guild', label: '문파', make: () => guildView(app) },
    { key: 'rank', label: '서열', make: () => rankView(app) },
  ]);
}

// ---------- 동료: 애완동물 · 탈것 (v111) ----------
function compTab(app) {
  const { game } = app;
  const root = h('div');
  const petCard = h('div', { class: 'card' });
  const boxCard = h('div', { class: 'card' });
  const mountCard = h('div', { class: 'card' });
  // 순위표 — 어떤 것이 더 좋은지, 어디서부터 나오는지
  const firstZone = (fn, tier) => W.ZONES_W.find((z, i) => i && fn(i) >= tier);
  const rankCard = h('details', { class: 'card rank-card' }, h('summary', {}, h('b', {}, '애완동물 순위'), h('small', {}, ' 위일수록 세다 — 눌러서 보기')),
    ...W.PETS.slice().sort((a, b) => b.tier - a.tier).map((d) => {
      const z = firstZone(W.petMaxTier, d.tier);
      const v = d.buff === 'crit' ? `+${(d.base * 100).toFixed(0)}%p` : d.buff === 'def' ? `+${d.base}` : d.buff === 'regenPct' ? `+${(d.base * 100).toFixed(1)}%` : `+${(d.base * 100).toFixed(0)}%`;
      return h('div', { class: 'rank-line' }, h('span', { class: 'rk' }, `${d.tier}`), h('span', { class: 'em' }, creatureIcon(d.id, 34)),
        h('b', {}, d.name), h('span', {}, `${d.text} ${v} · 한 대 ${Math.round((0.1 + d.tier * 0.025) * 100)}%`), h('small', {}, `${z?.name || ''} 두목부터`));
    }));
  const mountRank = h('details', { class: 'card rank-card' }, h('summary', {}, h('b', {}, '탈것 순위'), h('small', {}, ' 위일수록 빠르다 — 눌러서 보기')),
    ...W.MOUNTS.slice().sort((a, b) => b.tier - a.tier).map((d) => {
      const z = firstZone(W.mountMaxTier, d.tier);
      return h('div', { class: 'rank-line' }, h('span', { class: 'rk' }, `${d.tier}`), h('span', { class: 'em' }, creatureIcon(d.id, 34)),
        h('b', {}, d.name), h('span', {}, `이동 +${Math.round(d.speed * 100)}% · 공격·체력 +${Math.round(d.stat * 100)}%`), h('small', {}, `${z?.name || ''} 두목부터`));
    }));
  root.append(petCard, boxCard, rankCard, mountCard, mountRank);
  let sig = '';
  const rarTag = (r) => h('b', { style: `color:${W.RARITY[r].color}` }, W.RARITY[r].name);
  const petInfo = (p) => {
    const d = W.petOf(p.kind);
    const v = W.petBuff(p);
    const vt = d.buff === 'crit' ? `+${(v * 100).toFixed(1)}%p` : d.buff === 'def' ? `+${v.toFixed(0)}` : d.buff === 'regenPct' ? `+${(v * 100).toFixed(2)}%` : `+${(v * 100).toFixed(1)}%`;
    return `${d.text} ${vt} · 한 대에 무인 공격력의 ${Math.round(W.petAtkRatio(p) * 100)}%`;
  };
  const confirmRelease = (p, then) => openModal((m) => {
    m.append(h('h2', {}, `${W.petOf(p.kind).name}을(를) 놓아줄까요?`),
      h('p', { class: 'muted' }, `Lv.${p.lv}까지 키운 것이 사라져요. 되돌릴 수 없어요.`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '그만두기'),
        h('button', { class: 'btn danger', onclick: () => { game.releasePet(p.uid); closeModal(); then(); } }, '놓아주기')));
  });
  function upd() {
    const s = game.s;
    const nsig = `${s.pets.map((p) => `${p.uid}.${p.lv}.${Math.floor(p.exp / 50)}`)}|${s.petBox.map((p) => p.uid)}|${s.mounts.map((m) => m.uid)}|${s.mount}|${game.petSlots()}`;
    if (nsig === sig) return;
    sig = nsig;
    const done = () => { app.save(); sig = ''; app.refresh(); };
    const slots = game.petSlots();
    petCard.replaceChildren(h('h3', {}, '애완동물', h('small', {}, `키우는 칸 ${s.pets.length}/${slots}`)),
      slots === 1 ? h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, "가락지·귀걸이에 '애완동물 +N'이 붙으면 함께 키우는 칸이 늘어요.") : null);
    if (!s.pets.length) petCard.append(h('p', { class: 'muted' }, '두목이 아주 가끔 애완동물을 떨궈요 — 초반 두목은 아주 드물게 아래 순위만, 높은 두목일수록 자주·위 순위까지. 데려가면 곁에서 무인 공격력에 비례해 싸우고 버프를 걸어 줘요. 무인과 함께 자라요.'));
    s.pets.forEach((p, i) => {
      const d = W.petOf(p.kind);
      const active = i < slots;
      const need = W.petExpToNext(p.lv);
      petCard.append(h('div', { class: `row pet-row${active ? '' : ' locked'}` },
        h('div', { class: 'ico pet-ico' }, creatureIcon(p.kind)),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, d.name, ' ', rarTag(p.rar), h('small', {}, `순위 ${d.tier} · Lv.${p.lv}${p.lv >= W.PET_LV_MAX ? ' (최대)' : ''}${active ? '' : ' · 칸이 모자라 쉬는 중'}`)),
          h('div', { class: 'desc' }, petInfo(p)),
          p.lv < W.PET_LV_MAX ? h('div', { class: 'bar thin' }, h('div', { style: `width:${Math.min(100, (p.exp / need) * 100)}%` })) : null),
        h('button', { class: 'btn danger', style: 'padding:6px 10px', onclick: () => confirmRelease(p, done) }, '놓아주기')));
    });
    boxCard.replaceChildren(h('h3', {}, '우리', h('small', {}, `${s.petBox.length}/${W.PET_BOX} · 키우던 것을 놓아줘야 데려갈 수 있어요`)));
    if (!s.petBox.length) boxCard.append(h('p', { class: 'muted' }, '비어 있어요.'));
    for (const p of s.petBox) {
      const d = W.petOf(p.kind);
      boxCard.append(h('div', { class: 'row pet-row' },
        h('div', { class: 'ico pet-ico' }, creatureIcon(p.kind)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, d.name, ' ', rarTag(p.rar), h('small', {}, `순위 ${d.tier} · Lv.${p.lv}`)), h('div', { class: 'desc' }, petInfo(p))),
        h('div', { class: 'btn-col' },
          h('button', { class: 'buy', disabled: s.pets.length < slots ? null : true, onclick: () => { if (game.adoptPet(p.uid)) { toast(`${d.name}을(를) 데려갔어요`); done(); } } }, '데려가기'),
          h('button', { class: 'btn', style: 'padding:4px 8px;font-size:12px', onclick: () => { game.releasePet(p.uid); done(); } }, '놓아주기'))));
    }
    const cur = game.mountNow();
    mountCard.replaceChildren(h('h3', {}, '탈것', h('small', {}, cur ? `${cur.name}을(를) 타는 중` : '걸어 다니는 중')));
    if (!s.mounts.length) mountCard.append(h('p', { class: 'muted' }, '몹이 아주 드물게 탈것을 떨궈요 — 높은 두목일수록 자주·좋은 것까지. 타면 빨리 움직이고 공격력·체력이 올라요.'));
    const sorted = s.mounts.slice().sort((a, b) => W.mountOf(b.kind).speed - W.mountOf(a.kind).speed);
    for (const m of sorted) {
      const d = W.mountOf(m.kind);
      const on = s.mount === m.uid;
      mountCard.append(h('div', { class: `row${on ? ' me' : ''}` },
        h('div', { class: 'ico pet-ico' }, creatureIcon(m.kind)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, d.name, h('small', {}, `순위 ${d.tier}`)), h('div', { class: 'desc' }, `이동 속도 +${Math.round(d.speed * 100)}% · 공격력·체력 +${Math.round(d.stat * 100)}%`)),
        h('button', { class: on ? 'btn' : 'buy', onclick: () => { game.ride(on ? null : m.uid); done(); } }, on ? '내리기' : '타기')));
    }
  }
  return { root, update: upd };
}

export const WTABS = { char: charTab, bag: bagTab, map: mapTab, town: townTab, social: socialTab, comp: compTab };
export const WTAB_TITLE = { char: '캐릭터', bag: '가방', map: '지도', town: '마을', social: '무림', comp: '동료' };
