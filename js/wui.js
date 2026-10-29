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
  // 마존 설정 — 머리 칸은 자주 다시 그려서(경험치 막대) 펼친 게 닫히므로 따로 둔다
  const loreBox = h('div');
  let loreJob = null;
  // 심법 — 늘 켜진 패시브. 공용 여섯(점수 1씩)과 독문 심법 하나(무공처럼 n점)
  const passCard = h('div', { class: 'card' });
  let psSig = '';
  function passives() {
    const s = game.s;
    const nsig = `${s.skillPts}|${JSON.stringify(s.passLv)}|${s.level}|${s.job}`;
    if (nsig === psSig) return;
    psSig = nsig;
    passCard.replaceChildren(h('h3', {}, '심법', h('small', {}, `늘 켜진 패시브 · 스킬 점수 ${s.skillPts}`)));
    for (const p of game.passiveList()) {
      const lv = game.passLevel(p.id);
      const max = lv >= p.max;
      const locked = s.level < p.from;
      const own = p.id === 'p_own';
      passCard.append(h('div', { class: `row${locked ? ' locked' : ''}${own ? ' own' : ''}` },
        h('div', { class: 'ico' }, p.name.slice(0, 2)),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, p.name, h('small', {}, `${p.hanja}${own ? ' · 독문' : ''} · ${locked ? `레벨 ${p.from}부터` : `Lv.${lv}${max ? ' (최대)' : ''}`}`)),
          h('div', { class: 'desc' }, lv ? p.text(lv) : `1레벨: ${p.text(1)}`)),
        h('button', { class: 'buy', disabled: game.canPassUp(p.id) ? null : true, onclick: () => {
          if (game.passUp(p.id)) { popUp(passCard, `${p.name} Lv.${game.passLevel(p.id)}`); app.save(); psSig = ''; skSig = ''; upd(); }
        } }, max ? '최대' : locked ? '잠김' : `+1 · ${W.passiveCost(p, lv)}점`)));
    }
  }
  root.append(head, loreBox, stats, skillCard, passCard, h('div', { class: 'card' }, h('h3', {}, '능력치'), derived));
  function upd() {
    const s = game.s;
    const st = game.stats();
    const cls = W.classOf(s.job);
    head.replaceChildren(
      h('h3', {}, `${s.nickname || '무명'} `, h('small', {}, `${game.tierName()} · Lv.${s.level}`)),
      h('p', { class: 'muted' }, cls ? `${cls.name} — ${W.CLASSES[s.job].trait}` : ''),

      h('div', { class: 'bar' }, h('div', { style: `width:${Math.min(100, (s.exp / game.expNeed()) * 100)}%` }),
        h('span', {}, `경험치 ${fmt(s.exp)} / ${fmt(game.expNeed())}`)));
    if (loreJob !== s.job) {
      loreJob = s.job;
      const L = W.LORE[s.job];
      loreBox.replaceChildren(...(L ? [h('details', { class: 'lore card' }, h('summary', {}, `${L.house}의 마존 · ${L.title}${L.real ? ` (본명 ${L.real})` : ''} — ${L.house} 사람들은 '${L.men}'라 부른다`),
        h('p', {}, L.text))] : []));
    }
    skills();
    passives();
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
// v120 개편: 한 창에 셋을 줄줄이 늘어놓던 것을 하위 탭 셋으로 —
//   장비      낀 여섯 칸을 한눈에(눌러서 강화·승급) + 가방(칸별로 거르기, 낀 것보다 좋은 것은 위에 '끼기' 단추)
//   대장장이  칸을 고르면 만들 수 있는 장비가 좋은 것부터 — 재료만 있으면 어느 칸이든(아래 장비는 넣으면 이득)
//   재료      지역마다 재료·증표와 나오는 곳
const SLOT_SHORT = { weapon: '무기', armor: '옷', hat: '모자', acc: '장신구', finger: '가락지', ear: '귀걸이' };
function bagTab(app) {
  const { game } = app;
  let ui = { slot: 'all', smith: 'weapon', useBase: true, readyOnly: false };
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem('ifu.bagui') || '{}') }; } catch { /* 사생활 모드 */ }
  const keepUi = () => { try { localStorage.setItem('ifu.bagui', JSON.stringify(ui)); } catch { /* 사생활 모드 */ } };
  const sigs = { gear: '', smith: '', mats: '' };
  const done = () => { app.save(); sigs.gear = sigs.smith = sigs.mats = ''; app.refresh(); };
  // 두목 장비(두목 증표로 만든 상급 · 두목이 떨군 것)는 끼면 그 두목의 겉모습이 든다 (v116)
  function bossGearNote(it) {
    if (it.step == null || !(it.step % 2 === 1 || it.boss)) return null;
    const b = W.zoneOfW(W.stepMap(it.step))?.boss;
    if (!b) return null;
    const what = { weapon: '무기에 그 기운 빛', armor: '그 도포 빛깔', hat: '그 쓰개', acc: '몸을 도는 구슬', finger: '몸을 도는 구슬', ear: '몸을 도는 구슬' }[it.slot];
    return h('p', { class: 'boss-gear' }, `두목 장비 — 끼면 ${b.name}의 ${what}`, ['weapon', 'armor', 'hat'].includes(it.slot) ? ' (무기·옷·모자를 한 두목 것으로 맞추면 발밑에 그 빛깔 고리)' : '');
  }
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
          bossGearNote(it),
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
  // 낀 것과 견준 세기 (같은 칸 점수의 몇 %)
  const vsWorn = (it) => {
    const cur = game.s.equip[it.slot];
    const a = game.itemScore(it), b = game.itemScore(cur);
    if (!cur || b <= 0) return a > 0 ? 1 : 0;
    return a / b - 1;
  };
  const deltaTag = (d) => (Math.abs(d) < 0.005 ? h('span', { class: 'delta same' }, '같음')
    : h('span', { class: `delta ${d > 0 ? 'up' : 'down'}` }, `${d > 0 ? '▲' : '▼'} ${pct(Math.abs(d), 0)}`));

  // ===== 장비 =====
  const gearRoot = h('div');
  function gearView() {
    const s = game.s;
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid + '.' + (i.plus || 0)).join(',')}|${s.bagSize}|${ui.slot}|${s.gold >= game.bagUpgradeCost()}`;
    if (nsig === sigs.gear) return;
    sigs.gear = nsig;
    // 낀 여섯 칸 — 셋씩 두 줄
    const tiles = W.SLOTS.map((sl) => {
      const it = s.equip[sl.id];
      if (!it) return h('div', { class: 'gear-tile empty' }, h('small', {}, sl.name), h('b', {}, '비어 있음'));
      const g = gradeOf(it);
      return h('button', { class: `gear-tile${it.rar === 3 ? ' mythic' : ''}`, style: `--gc:${g.color}`, onclick: () => openItem(it, true) },
        h('small', {}, `${sl.name} · ${g.name}`),
        h('b', {}, itemTitle(game, it)),
        h('span', {}, itemLines(game, it).split(' · ').slice(0, 2).join(' · ')));
    });
    // 가방 — 칸 거르기
    const counts = {};
    for (const it of s.bag) counts[it.slot] = (counts[it.slot] || 0) + 1;
    const chips = h('div', { class: 'chip-row' }, ...[['all', `전체 ${s.bag.length}`], ...W.SLOTS.map((x) => [x.id, `${SLOT_SHORT[x.id]} ${counts[x.id] || 0}`])].map(([k, label]) =>
      h('button', { class: `chip${ui.slot === k ? ' on' : ''}`, onclick: () => { ui.slot = k; keepUi(); sigs.gear = ''; gearView(); } }, label)));
    const list = s.bag.filter((it) => ui.slot === 'all' || it.slot === ui.slot)
      .map((it) => ({ it, d: vsWorn(it) }))
      .sort((a, b) => (b.d > 0.005) - (a.d > 0.005) || b.d - a.d || game.itemScore(b.it) - game.itemScore(a.it));
    const cards = list.map(({ it, d }) => {
      const chip = itemChip(game, it, { onclick: () => openItem(it, false) });
      chip.prepend(h('div', { class: 'chip-top' }, h('small', {}, SLOT_SHORT[it.slot]), deltaTag(d)));
      if (d > 0.005) chip.append(h('button', { class: 'btn primary mini', onclick: (e) => { e.stopPropagation(); game.equipFromBag(it.uid); toast(`${itemTitle(game, it)}을(를) 꼈어요`); done(); } }, '끼기'));
      return chip;
    });
    const old = s.bag.filter((x) => s.equip[x.slot] && game.itemScore(x) < game.itemScore(s.equip[x.slot]) && !x.plus && !(x.rar >= 2));
    gearRoot.replaceChildren(
      h('div', { class: 'card' }, h('h3', {}, '끼고 있는 것', h('small', {}, `전투력 ${fmt(game.stats().power)} · 눌러서 강화·승급`)),
        h('div', { class: 'gear-grid' }, ...tiles)),
      h('div', { class: 'card' },
        h('h3', {}, '가방', h('small', {}, `${s.bag.length} / ${s.bagSize} · 넘치면 가장 나쁜 것부터 팔아요`)),
        chips,
        cards.length ? h('div', { class: 'bag-grid' }, ...cards) : h('p', { class: 'muted' }, ui.slot === 'all' ? '가방이 비었어요. 대장장이가 만든 장비는 낀 것보다 좋으면 바로 껴요.' : '이 칸 장비가 가방에 없어요.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', disabled: old.length ? null : true, onclick: () => {
            let p = 0;
            for (const it of old) p += game.sell(it);
            toast(`약한 장비 ${old.length}개를 팔아 은자 +${fmt(p)} (강화·전설 이상은 남겨요)`);
            done();
          } }, `약한 것 팔기${old.length ? ` ${old.length}` : ''}`),
          h('button', { class: 'btn', disabled: game.s.gold < game.bagUpgradeCost() || s.bagSize >= 80 ? true : null, onclick: () => { if (game.buyBagSpace()) { toast('가방이 10칸 넓어졌어요'); done(); } } },
            s.bagSize >= 80 ? '가방 끝까지' : `+10칸 · ${fmt(game.bagUpgradeCost())}`))));
  }

  // ===== 대장장이 =====
  const smithRoot = h('div');
  function need(label, have, want, color) {
    const ok = have >= want;
    return h('span', { class: `need${ok ? ' ok' : ''}`, style: color ? `--mc:${color}` : '' }, label, ' ', h('b', {}, `${fmt(Math.min(have, want))}/${fmt(want)}`));
  }
  function smithView() {
    const s = game.s;
    const steps = game.craftSteps();
    const slot = ui.smith;
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid).join(',')}|${JSON.stringify(s.mats)}|${Math.floor(Math.log10(s.gold + 1) * 20)}|${slot}|${ui.useBase}|${ui.readyOnly}|${steps.length}`;
    if (nsig === sigs.smith) return;
    sigs.smith = nsig;
    const cur = s.equip[slot];
    const chips = h('div', { class: 'chip-row' }, ...W.CRAFT_SLOTS.map((x) =>
      h('button', { class: `chip${slot === x.id ? ' on' : ''}`, onclick: () => { ui.smith = x.id; keepUi(); sigs.smith = ''; smithView(); } }, x.name)));
    const toggles = h('div', { class: 'chip-row' },
      h('button', { class: `chip${ui.useBase ? ' on' : ''}`, onclick: () => { ui.useBase = !ui.useBase; keepUi(); sigs.smith = ''; smithView(); } }, ui.useBase ? '✓ 아래 장비 넣기' : '아래 장비 안 넣기'),
      h('button', { class: `chip${ui.readyOnly ? ' on' : ''}`, onclick: () => { ui.readyOnly = !ui.readyOnly; keepUi(); sigs.smith = ''; smithView(); } }, ui.readyOnly ? '✓ 만들 수 있는 것만' : '전부 보기'));
    const rows = [];
    // 만들 수 있는 것부터(좋은 것 먼저), 그다음 아직 못 만드는 것
    const order = steps.slice().reverse().map((st) => [st, game.craftCheck(slot, st, ui.useBase).ok]).sort((a, b) => b[1] - a[1]).map(([st]) => st);
    for (const step of order) {
      const { r, src, ok } = game.craftCheck(slot, step, ui.useBase);
      if (ui.readyOnly && !ok) continue;
      const sample = game.makeCrafted(slot, step);
      const d = vsWorn(sample);
      const parts = [];
      for (const [k, n] of Object.entries(r.mats)) parts.push(need(W.matName(k), s.mats[k] || 0, n, W.matColor(k)));
      parts.push(need('은자', s.gold, r.gold));
      rows.push(h('div', { class: `row craft-row${ok ? ' ready' : ''}${d <= 0.005 ? ' weaker' : ''}` },
        h('div', { class: 'info' },
          h('div', { class: 'name' }, itemTitle(game, sample), ' ', deltaTag(d), h('small', {}, `Lv.${sample.ilv} · ${W.zoneOfW(W.stepMap(step))?.name || ''} ${W.stepUpper(step) ? '상급' : '하급'}`)),
          h('div', { class: 'desc' }, `${itemLines(game, sample)} (레어 기준)`),
          h('div', { class: 'desc needs' }, ...parts),
          h('div', { class: 'desc base' }, src ? `넣을 장비: ${itemTitle(game, src)} — 강화 ${Math.floor(Math.min(src.plus || 0, W.ENHANCE_NORMAL) / 2)}·${gradeOf(src).name} 이어받음`
            : ui.useBase ? `넣을 아래 장비가 없어 재료 ${W.NO_BASE_MULT}배` : `아래 장비 없이 — 재료 ${W.NO_BASE_MULT}배`)),
        h('button', { class: 'buy', disabled: ok ? null : true, onclick: () => {
          const it = game.craft(slot, step, ui.useBase);
          if (it) { toast(`${itemTitle(game, it)} — ${gradeOf(it).name}!`); done(); }
        } }, '조합')));
    }
    smithRoot.replaceChildren(
      h('div', { class: 'card' },
        h('h3', {}, '대장장이', h('small', {}, '재료만 있으면 어느 칸이든')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 6px' },
          `아래 장비를 넣으면 재료가 덜 들고 강화 절반·등급·옵션을 이어받아요. 안 넣으면 재료 ${W.NO_BASE_MULT}배. 만들면 레어 ${W.CRAFT_RAR_W[0]}% · 유니크 ${W.CRAFT_RAR_W[1]}% · 전설 ${W.CRAFT_RAR_W[2]}%.`),
        chips, toggles,
        h('div', { class: 'smith-cur' }, cur ? ['지금 낀 것: ', h('b', { style: `color:${gradeOf(cur).color}` }, itemTitle(game, cur)), ` — ${itemLines(game, cur)}`] : '지금 낀 것이 없어요')),
      h('div', { class: 'card' }, ...(rows.length ? rows : [h('p', { class: 'muted' }, '지금 만들 수 있는 것이 없어요 — 재료를 더 모아요.')])));
  }

  // ===== 재료 =====
  const matRoot = h('div');
  function matView() {
    const s = game.s;
    const nsig = JSON.stringify(s.mats);
    if (nsig === sigs.mats) return;
    sigs.mats = nsig;
    const zones = new Set(Object.keys(s.mats).filter((k) => s.mats[k] > 0).map((k) => parseInt(k.replace('b', ''), 10)));
    const rows = [...zones].sort((a, b) => b - a).map((z) => h('div', { class: 'row mat-zone' },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, W.zoneOfW(z)?.name || `지역 ${z}`),
        h('div', { class: 'mat-row' },
          h('span', { class: 'mat-chip', style: `--mc:${W.matColor(z)}` }, h('b', {}, W.matName(z)), h('small', {}, fmt(s.mats[z] || 0))),
          h('span', { class: 'mat-chip', style: `--mc:${W.matColor(W.bossKey(z))}` }, h('b', {}, W.matName(W.bossKey(z))), h('small', {}, fmt(s.mats[W.bossKey(z)] || 0)))),
        h('div', { class: 'desc' }, `재료: 그 지역 몹 · 증표: 그 지역 두목 구역의 두목`))));
    matRoot.replaceChildren(h('div', { class: 'card' }, h('h3', {}, '재료', h('small', {}, '문파 창고로 나눌 수 있어요')),
      ...(rows.length ? rows : [h('p', { class: 'muted' }, '몹은 그 사냥터 재료를, 두목은 재료 한 움큼과 증표를 떨궈요.')])));
  }

  return subTabs([
    { key: 'gear', label: '장비', make: () => ({ root: gearRoot, update: gearView }) },
    { key: 'smith', label: '대장장이', make: () => ({ root: smithRoot, update: smithView }) },
    { key: 'mats', label: '재료', make: () => ({ root: matRoot, update: matView }) },
  ]);
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
// v121 개편: 마을 사람 넷(사부 · 상인 · 대장장이 · 주모)을 고르면 그 사람 일만 보인다.
// 전직할 수 있으면 사부에 붉은 점. 물약은 버튼 넷(10·50·200·살 수 있는 만큼) + 자동 보충.
const NPC_LIST = [
  { id: 'master', name: '사부', ico: '師', desc: '전직 · 무공' },
  { id: 'shop', name: '상인', ico: '商', desc: '물약 · 비급' },
  { id: 'smith', name: '대장장이', ico: '冶', desc: '조합 · 강화' },
  { id: 'inn', name: '주모', ico: '酒', desc: '쉬기' },
];
function townTab(app) {
  const { game } = app;
  const root = h('div');
  const head = h('div', { class: 'card town-head' });
  const npcRow = h('div', { class: 'npc-row' });
  const body = h('div');
  root.append(head, npcRow, body);
  let pick = null;
  let sig = '';
  const choose = (id) => { pick = id; sig = ''; upd(); };
  function npcButtons() {
    const dot = { master: game.canAdvance() };
    npcRow.replaceChildren(...NPC_LIST.map((n) => h('button', { class: `npc${pick === n.id ? ' on' : ''}`, onclick: () => (n.id === 'smith' ? app.showTab?.('bag', 'smith') : choose(n.id)) },
      h('span', { class: 'npc-ico' }, n.ico), h('b', {}, n.name), h('small', {}, n.desc), dot[n.id] ? h('i', { class: 'dot' }) : null)));
  }
  function masterView() {
    const s = game.s;
    const t = game.nextTier();
    const card = h('div', { class: 'card' }, h('h3', {}, '사부', h('small', {}, `지금 ${game.tierName() || '입문'}`)));
    if (!t) card.append(h('p', {}, '더 배울 것이 없다. 이제 네 길을 가거라.'));
    else {
      const sk = W.skillsOf(s.job).find((k) => k.tier === s.jobTier + 1);
      const lvOk = s.level >= t.level, goldOk = s.gold >= t.cost;
      card.append(
        h('div', { class: 'advance-box' },
          h('div', { class: 'adv-title' }, `${s.jobTier + 1}차 전직 → `, h('b', {}, game.tierName(s.jobTier + 1))),
          h('div', { class: 'checks' },
            h('span', { class: `need${lvOk ? ' ok' : ''}` }, `레벨 ${t.level}`, ' ', h('b', {}, lvOk ? '✓' : `${s.level}/${t.level}`)),
            h('span', { class: `need${goldOk ? ' ok' : ''}` }, '은자', ' ', h('b', {}, goldOk ? '✓' : `${fmt(s.gold)}/${fmt(t.cost)}`))),
          h('p', { class: 'muted' }, '배우는 무공: ', h('b', {}, sk.name), ` — ${skillText(game, sk)}`),
          h('button', { class: 'btn primary', style: 'width:100%', disabled: game.canAdvance() ? null : true, onclick: () => {
            if (!game.advance()) return;
            toast(`${game.tierName()}(으)로 전직했어요 — 〈${sk.name}〉`);
            app.save(); app.refresh();
          } }, !lvOk ? `레벨 ${t.level}이 되면` : !goldOk ? '은자가 모자라요' : '전직하기')));
    }
    // 무공의 길 — 무엇을 언제 배우는지 한눈에
    const lvOf = (k) => (k.kind === 'support' ? k.from : W.TIERS[k.tier].level);
    const all = W.skillsOf(s.job).sort((a, b) => lvOf(a) - lvOf(b));
    const steps = all.map((k) => {
      const when = k.kind === 'support' ? `레벨 ${k.from}` : `${k.tier}차 · 레벨 ${W.TIERS[k.tier].level}`;
      const known = game.knows(k);
      return h('div', { class: `path-step${known ? ' known' : ''}` }, h('span', { class: 'ico' }, k.icon), h('div', {}, h('b', {}, k.name), h('small', {}, `${when}${k.kind === 'support' ? ' · 보조기' : ''}`)), h('span', { class: 'st' }, known ? '배움' : '—'));
    });
    return [card, h('div', { class: 'card' }, h('h3', {}, '무공의 길', h('small', {}, W.LORE[s.job]?.title || '')), ...steps)];
  }
  function shopView() {
    const s = game.s;
    const price = game.potionPrice();
    const maxN = Math.max(0, Math.floor(s.gold / price));
    const buy = (n, max = false) => h('button', { class: 'buy', disabled: n <= 0 || s.gold < price * n ? true : null, onclick: () => {
      if (game.buyPotions(n)) { toast(`물약 ${fmt(n)}개를 샀어요`); app.save(); app.refresh(); }
    } }, max ? '최대' : `${n}개`, h('small', {}, max ? `${fmt(n)}개` : fmt(price * n)));
    const refill = h('button', { class: `btn ${s.autoRefill ? 'good' : ''}`, onclick: () => { s.autoRefill = !s.autoRefill; app.save(); sig = ''; upd(); } }, s.autoRefill ? '자동 보충 켜짐' : '자동 보충 꺼짐');
    return [
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'pot-ico big' }),
          h('div', { class: 'info' }, h('b', {}, '빨간 물약', h('small', {}, ` 개당 ${fmt(price)}`)),
            h('div', { class: 'desc' }, `최대 체력의 ${pct(W.POTION_HEAL, 0)} 회복 · 체력 ${pct(W.POTION_AT, 0)} 아래면 알아서 먹어요`)),
          h('div', { class: 'have' }, h('small', {}, '가진 것'), h('b', {}, fmt(s.potions)))),
        h('div', { class: 'buy-grid' }, buy(10), buy(50), buy(200), buy(Math.max(maxN, 1), true)),
        h('div', { class: 'refill-row' }, h('span', { class: 'muted' }, '물약이 10개 아래면 50개까지 알아서 사요 (사냥터에서도)'), refill)),
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'book-ico' }, '書'),
          h('div', { class: 'info' }, h('b', {}, '무공 비급', h('small', {}, ` ${s.books || 0}권 읽음`)),
            h('div', { class: 'desc' }, '읽으면 스탯 점수 +1 · 한 권 읽을 때마다 값이 올라요'))),
        h('button', { class: 'btn primary', style: 'width:100%', disabled: s.gold < game.statBookCost() ? true : null, onclick: () => {
          if (game.buyStatBook()) { toast('스탯 점수 +1 — 캐릭터 창에서 찍어요'); app.save(); app.refresh(); }
        } }, `비급 읽기 · 은자 ${fmt(game.statBookCost())}`)),
    ];
  }
  function innView() {
    const s = game.s;
    const inTown = game.map.town;
    return [h('div', { class: 'card' }, h('h3', {}, '주모', h('small', {}, '객잔')),
      h('p', {}, inTown ? '"푹 쉬다 가요. 여기선 체력이 금방 차요."' : '"다쳤으면 들어와 쉬어요. 마을에선 체력이 금방 차요."'),
      h('p', { class: 'muted' }, `쓰러지면 마을로 실려 와 체력이 다 차면 ${W.mapOf(s.huntMap).name}(으)로 돌아가요(자동 사냥일 때). 앱을 꺼 두어도 고른 사냥터에서 사냥한 만큼이 쌓여요.`),
      inTown ? h('button', { class: 'btn primary', style: 'width:100%', disabled: game.canEnter(s.huntMap) ? null : true, onclick: () => { game.enterMap(s.huntMap); app.save(); app.closePanel(); app.refresh(); } }, `${W.mapOf(s.huntMap).name}(으)로 나가기`)
        : h('button', { class: 'btn primary', style: 'width:100%', onclick: () => { game.goTown(); app.save(); app.refresh(); } }, '쉬러 가기'))];
  }
  function upd() {
    const s = game.s;
    if (!pick) pick = game.canAdvance() ? 'master' : 'shop';
    const inTown = game.map.town;
    const nsig = `${pick}|${inTown}|${s.autoHunt}|${s.huntMap}|${s.jobTier}|${s.level}|${s.potions}|${s.books || 0}|${s.autoRefill}|${Math.floor(Math.log10(s.gold + 1) * 30)}|${game.canAdvance()}`;
    if (nsig === sig) return;
    sig = nsig;
    head.replaceChildren(h('div', { class: 'town-status' },
      h('div', {}, h('b', {}, inTown ? '객잔 마을에서 쉬는 중' : `${W.mapOf(s.map).name}에서 사냥 중`),
        h('small', {}, inTown ? '체력이 빠르게 차요' : '전직·상점·조합은 사냥터에서도 돼요')),
      inTown ? h('button', { class: 'btn primary', disabled: game.canEnter(s.huntMap) ? null : true, onclick: () => { game.enterMap(s.huntMap); app.save(); app.closePanel(); app.refresh(); } }, '사냥터로')
        : h('button', { class: 'btn', onclick: () => { game.goTown(); app.save(); app.refresh(); } }, '쉬러 가기')));
    npcButtons();
    body.replaceChildren(...(pick === 'master' ? masterView() : pick === 'inn' ? innView() : shopView()));
  }
  return { root, update: upd };
}

export function skillText(game, sk) {
  const cd = game.skillCd ? game.skillCd(sk) : sk.cd;
  const cost = sk.hpCost * (1 - (game.skillMods ? game.skillMods(sk.id).cost : 0));
  const num = sk.kind === 'field' ? `처음 ×${sk.mult} · ${sk.field.tick}초마다 ×${sk.field.mult}`
    : sk.kind === 'daggers' ? `한 자루 ×${sk.mult}` : `공격력 ×${sk.mult}${sk.hits > 1 ? ` · ${sk.hits}번` : ''}`;
  return `${sk.desc} — ${num} · 숨 ${cd.toFixed(cd < 10 ? 1 : 0).replace(/\.0$/, '')}초${sk.hpCost ? ` · 체력 ${pct(cost, 0)} 소모` : ''}`;
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
        h('div', { class: 'card guild-intro' }, h('h3', {}, '문파', h('small', {}, `최대 ${W.GUILD_MAX}명`)),
          h('ul', { class: 'perks' },
            h('li', {}, h('b', {}, '공격력'), ` 문파 레벨마다 전원 +${pct(W.guildAtk(W.GUILD_LV_EXP))}`),
            h('li', {}, h('b', {}, '창고'), ' 남는 조합 재료를 넣고 꺼내 써요'),
            h('li', {}, h('b', {}, '채팅'), ' 문파원끼리 이야기'),
            h('li', {}, h('b', {}, '레벨'), ' 날마다 출석·은자 기부로 올라요'))),
        h('div', { class: 'card' }, h('h3', {}, '새 문파 만들기'), h('div', { class: 'chat-input' }, nameIn, createBtn)),
        h('div', { class: 'card' }, h('h3', {}, '코드로 가입', h('small', {}, '문파원에게 6자리 코드를 받아요')), h('div', { class: 'chat-input' }, codeIn, joinBtn)));
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
    const leave = h('button', { class: 'btn danger mini' }, '문파 탈퇴');
    leave.onclick = () => openModal((m) => {
      m.append(h('h2', {}, '문파를 떠날까요?'), h('p', { class: 'muted' }, '문파 버프가 사라지고, 다시 코드로 들어올 수 있어요.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '취소'),
          h('button', { class: 'btn danger', onclick: async () => { closeModal(); await net.leaveGuild().catch((e) => toast(e.message)); } }, '탈퇴')));
    });
    const checkBtn = h('button', { class: 'btn good' });
    checkBtn.onclick = busy(checkBtn, async () => { if (await net.checkin()) { toast(`출석! 문파 경험치 +${W.GUILD_CHECKIN_EXP}`); loadMembers(); } });
    const donateBtn = h('button', { class: 'btn primary' });
    donateBtn.onclick = busy(donateBtn, async () => { if (await net.donate()) { toast(`기부! 문파 경험치 +${W.GUILD_DONATE_EXP}`); app.save(); app.refresh(); } });
    // 문파원
    const members = h('div');
    // 창고
    const bankBox = h('div', { class: 'bank-in' });
    const myBox = h('div', { class: 'bank-mine' });
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
    const seal = h('div', { class: 'guild-seal' });
    const count = h('small');
    els = { title, lvl, bar, buff, code, checkBtn, donateBtn, members, bankBox, myBox, chatBox, seal, count };
    // 아래는 칸 셋 — 문파원 · 창고 · 채팅 (고른 칸을 기억한다)
    let seg = 'chat';
    try { seg = localStorage.getItem('ifu.guildseg') || 'chat'; } catch { /* 사생활 모드 */ }
    const secs = {
      members: h('div', { class: 'card' }, h('h3', {}, '문파원', count), members),
      bank: h('div', { class: 'card' }, h('h3', {}, '문파 창고', h('small', {}, '눌러서 꺼내기')), bankBox,
        h('h3', { style: 'margin-top:12px' }, '내 재료', h('small', {}, '눌러서 넣기')), myBox),
      chat: h('div', { class: 'card' }, h('h3', {}, '문파 채팅'), chatBox, h('div', { class: 'chat-input' }, input, send)),
    };
    const segBtns = h('div', { class: 'seg wide guild-seg' });
    const pickSeg = (k) => {
      seg = k;
      try { localStorage.setItem('ifu.guildseg', k); } catch { /* 사생활 모드 */ }
      for (const [key, el] of Object.entries(secs)) el.style.display = key === k ? '' : 'none';
      for (const b of segBtns.children) b.classList.toggle('on', b.dataset.key === k);
      if (k === 'chat') els.chatBox.scrollTop = els.chatBox.scrollHeight;
    };
    for (const [k, label] of [['members', '문파원'], ['bank', '창고'], ['chat', '채팅']]) segBtns.append(h('button', { 'data-key': k, onclick: () => pickSeg(k) }, label));
    root.append(
      h('div', { class: 'card guild-head' },
        h('div', { class: 'gh-top' }, seal, h('div', { class: 'gh-name' }, h('h3', {}, title, lvl), buff)),
        bar,
        h('div', { class: 'gh-code' }, h('span', { class: 'muted' }, '가입 코드'), code, share),
        h('div', { class: 'btn-row' }, checkBtn, donateBtn)),
      segBtns, secs.members, secs.bank, secs.chat,
      h('div', { class: 'guild-foot' }, leave));
    pickSeg(seg);
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
    // 재료 한 줄 — 이름·개수와 단추 둘(반 · 전부)
    const row = (k, n, verb, fn) => {
      const half = h('button', { class: 'btn mini' }, `반 ${verb}`);
      const all = h('button', { class: 'btn mini primary' }, `전부 ${verb}`);
      half.onclick = busy(half, () => fn(Math.max(1, Math.floor(n / 2))));
      all.onclick = busy(all, () => fn(n));
      return h('div', { class: 'bank-row', style: `--mc:${W.matColor(k)}` },
        h('b', {}, W.matName(k)), h('span', { class: 'n' }, fmt(n)), half, all);
    };
    const inBank = Object.keys(bank).filter((k) => bank[k] > 0).sort(order);
    els.bankBox.replaceChildren(...(inBank.length ? inBank.map((k) => row(k, bank[k], '꺼내기', async (n) => {
      const got = await net.takeMats(k, n);
      if (got) { toast(`${W.matName(k)} ${got}개를 꺼냈어요`); app.save(); }
    })) : [h('p', { class: 'muted' }, '비어 있어요. 남는 재료를 넣어 두면 문파원이 조합에 써요.')]));
    const mine = Object.keys(mats).filter((k) => mats[k] > 0).sort(order);
    els.myBox.replaceChildren(...(mine.length ? mine.map((k) => row(k, mats[k], '넣기', async (n) => {
      const put = await net.putMats(k, n);
      if (put) { toast(`${W.matName(k)} ${put}개를 넣었어요`); app.save(); }
    })) : [h('p', { class: 'muted' }, '가진 재료가 없어요.')]));
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
    els.seal.textContent = (gd.name || '?').slice(0, 1);
    els.count.textContent = `${gd.memberIds.length}/${W.GUILD_MAX}명`;
    els.lvl.textContent = `Lv.${lv}${top ? ' (최대)' : ''}`;
    els.bar.firstChild.style.width = `${top ? 100 : (into / W.GUILD_LV_EXP) * 100}%`;
    els.bar.lastChild.textContent = top ? 'MAX' : `문파 경험치 ${into} / ${W.GUILD_LV_EXP}`;
    els.buff.textContent = `전원 공격력 +${pct(W.guildAtk(gd.exp))} · ${gd.memberIds.length}/${W.GUILD_MAX}명`;
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
