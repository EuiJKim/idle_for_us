// 바람식 개편 — 창 다섯: 캐릭터 · 가방 · 지도 · 마을 · 무림.
// 창 하나는 { root, update } 를 돌려준다. update는 0.2초마다 불린다(열려 있을 때만).
import * as W from './world/wdata.js';
import { playGacha } from './gacha.js';
import * as D from './world/wdgn.js';
import * as L from './world/wland.js';
import * as G from './world/wgear.js';
import * as Q from './world/wquest.js';
import { h, toast, openModal, closeModal, subTabs, popUp, holdRepeat, modalGen, ctxMenu } from './ui/common.js';
import { fmt, duration } from './fmt.js';
import { dayKey, WORLD_MAX } from './net.js';
import { drawCreature, CREATURES, crArt } from './creatures.js';
import { skinImg } from './icons.js';
import * as MS from './world/wmaster.js';
import * as LN from './world/wline.js';
import * as IM from './world/wimprint.js';
import * as PT from './world/wpath.js';
import * as TD from './world/wtoday.js';
import { drawFighter } from './battle.js';
import { JOBS as JOBS_LIST } from './data.js';
import { VAULT_ITEMS as VAULT_MAX } from './vault.js';

// 애완동물·탈것 그림 아이콘 (창 목록용) — 들판과 같은 그림을 작게
export function creatureIcon(kind, size = 44) {
  // v136: 그린 그림이 있으면 그것을 (없거나 못 받으면 벡터로)
  const src = crArt(kind);
  if (src) {
    const im = h('img', { class: 'creature-ico', src, alt: '', style: `width:${size}px;height:${size}px;object-fit:contain` });
    im.onerror = () => im.replaceWith(creatureCanvas(kind, size));
    return im;
  }
  return creatureCanvas(kind, size);
}
function creatureCanvas(kind, size) {
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

// 강화·각인 연출 건너뛰기 (v200) — 설정에서 켜면 늘, 아니면 연출을 눌러서 그 한 번만
export const skipFx = () => { try { return localStorage.getItem('ifu.skipFx') === '1'; } catch { return false; } };
export const setSkipFx = (v) => { try { localStorage.setItem('ifu.skipFx', v ? '1' : '0'); } catch { /* 이번만 */ } };
function afterAnim(sheet, sec, done) {
  let fired = false;
  // v254: 연출 중 창을 닫으면(배경 탭) 취소 — 전엔 닫힌 뒤에 강화가 돌아 재료가 들고, 그새 연 다른 창이 결과 화면으로 덮였다
  const gen = modalGen();
  const go = () => { if (fired) return; fired = true; clearTimeout(t); anim?.removeEventListener('click', go); if (modalGen() !== gen) return; done(); };
  const anim = sheet.querySelector('.enh-anim');
  if (!sec) { done(); return; }
  anim?.addEventListener('click', go);
  const t = setTimeout(go, sec * 1000);
}
const pct = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, '')}%`;
// v256 은자 값에 기대는 단추(만들기·합성·초기화·비급·보호부)를 위해 — 은자가 바뀌면 3초에 한 번까지 그 창을 다시 그린다.
// 전엔 은자를 뭉텅이(로그 눈금)로만 보거나 아예 안 봐서, 은자가 모여도 단추가 잠긴 채였다.
const goldTicks = {};
const goldSig = (game, key) => {
  const e = goldTicks[key] || (goldTicks[key] = { v: -1, t: 0 });
  const now = Date.now();
  if (game.s.gold !== e.v && now - e.t > 3000) { e.v = game.s.gold; e.t = now; }
  return e.v;
};
// 조합 장비는 등급(레어·유니크·전설·신화) 빛깔, 옛 드랍 장비는 옛 등급 빛깔
const gradeOf = (it) => (it.rar != null ? W.RARITY[it.rar] : W.GRADES[it.grade]);
export const optLines = (it) => (it.opts || []).map(W.optText);

// 아이템 한 줄 요약 — '공격력 +123' 같은 것
// v317 끼면 어떻게 되나 — 온 능력치 한 줄(오르면 초록 ▲ · 내리면 빨강 ▼). 세트·공명·각인까지 든 값
export function equipCompare(game, it) {
  const { now, then, sets0 = {}, sets1 = {} } = game.previewEquip(it);
  const parts = [];
  // v378 세트 — 끼면 몇 조각이 되고 무엇이 켜지나(빠지는 세트는 무엇이 꺼지나)
  const setLines = [];
  for (const id of new Set([...Object.keys(sets0), ...Object.keys(sets1)])) {
    const st = G.setOf(id);
    const a = sets0[id] || 0, b = sets1[id] || 0;
    if (!st || a === b || (st.job && st.job !== game.s.job)) continue;
    const ons = Object.keys(st.bonus).map(Number).filter((n) => (b > a ? n > a && n <= b : n > b && n <= a));
    setLines.push(h('div', { class: `cmp-set ${b > a ? 'up' : 'down'}` }, `〈${st.name}〉 ${a}→${b}조각`,
      ...ons.map((n) => h('small', {}, ` · ${n}조각 ${b > a ? '켜짐' : '꺼짐'}: ${G.setBonusText(st.bonus[n])}`))));
  }
  const add = (label, a, b, kind = 'num') => {
    const d = b - a;
    if (kind === 'num' ? Math.abs(d) < Math.max(0.5, Math.abs(a) * 0.0005) : Math.abs(d) < 0.0005) return;
    const txt = kind === 'pp' ? `${d > 0 ? '+' : '−'}${(Math.abs(d) * 100).toFixed(1)}%p` : kind === 'pct' ? `${d > 0 ? '+' : '−'}${(Math.abs(d / (a || 1)) * 100).toFixed(1)}%` : `${d > 0 ? '+' : '−'}${fmt(Math.round(Math.abs(d)))}`;
    parts.push(h('span', { class: `cmp ${d > 0 ? 'up' : 'down'}` }, `${label} ${d > 0 ? '▲' : '▼'} ${txt}`));
  };
  add('공격력', now.atk, then.atk);
  add('체력', now.hp, then.hp);
  add('방어', now.def, then.def);
  add('치명', now.crit, then.crit, 'pp');
  add('공속', now.speed, then.speed, 'pct');
  const dp = (then.power - now.power) / (now.power || 1);
  const verdict = Math.abs(dp) < 0.0005 ? h('b', { class: 'cmp same' }, '전투력 그대로')
    : h('b', { class: `cmp ${dp > 0 ? 'up' : 'down'}` }, `전투력 ${dp > 0 ? '▲' : '▼'} ${fmt(Math.round(Math.abs(then.power - now.power)))} (${dp > 0 ? '+' : '−'}${(Math.abs(dp) * 100).toFixed(1)}%)`);
  return h('div', { class: `equip-cmp ${dp > 0.0005 ? 'better' : dp < -0.0005 ? 'worse' : ''}` }, h('small', {}, '끼면 →'), verdict, ...parts, ...setLines);
}
// v320 출석부 칸 일곱 — 받은 칸 ✓ · 오늘 받을 칸 빛남
export function attGrid(game) {
  const n = game.s.att?.n || 0, can = game.canAttend(), next = game.attNext();
  return h('div', { class: 'att-grid' }, ...Array.from({ length: TD.ATT_DAYS }, (_, i) => {
    const d = i + 1, r = TD.attReward(d, game.s.level);
    const got = can ? d < next && n < TD.ATT_DAYS : d <= n;
    const today = can && d === next;
    return h('div', { class: `att-cell${got ? ' got' : ''}${today ? ' today' : ''}${d === TD.ATT_DAYS ? ' big' : ''}` },
      h('b', {}, `${d}일`), h('span', {}, r.gold && !r.prot ? `은자 ${fmt(r.gold)}` : r.text), got ? h('i', {}, '✓') : null);
  }));
}
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
  const ln = it.line ? LN.lineOf(it.line) : null;
  const sp = game.sharedPlus ? game.sharedPlus(it) : 0;
  const ep = Math.max(it.plus || 0, sp);
  return `${ln && ln.id !== 'base' ? `[${ln.name}] ` : ''}${W.itemName(it, game.s.job)}${ep ? ` +${ep}${sp > (it.plus || 0) ? '(공유)' : ''}` : ''}`;
}
// v230: 장비 아이콘 — 칸 그림(무기·옷·모자…)을 등급 빛깔 테두리 안에. 가방·대장장이에서 글 대신 그림으로 고른다
function itemIcon(it, size = 44) {
  const g = gradeOf(it);
  return skinImg(h('span', { class: `it-ico${it.rar === 3 ? ' mythic' : ''}`, style: `--gc:${g.color};width:${size}px;height:${size}px` }), `slot-${it.slot}`);
}
// 가방 칸 — 그림 하나 + 강화 수치 · 낀 것보다 좋은지 화살표 · 이름 한 줄
function itemTile(game, it, d, onclick, oncontextmenu) {
  const g = gradeOf(it);
  const up = d > 0.005, down = d < -0.005;
  return h('button', { class: `inv-tile${it.rar === 3 ? ' mythic' : ''}${it.set ? ' set' : ''}${up ? ' up' : ''}`, style: `--gc:${g.color}`, onclick, oncontextmenu,
    title: itemHover(game, it, d) },
    itemIcon(it, 46),
    it.plus ? h('i', { class: 'inv-plus' }, `+${it.plus}`) : null,
    up ? h('i', { class: 'inv-d up' }, '▲') : down ? h('i', { class: 'inv-d down' }, '▼') : null,
    it.set ? h('i', { class: 'inv-set' }, '세트') : null,
    h('b', {}, itemTitle(game, it)),
    h('small', {}, `Lv.${it.ilv} · ${g.name}`));
}
// v349 마우스를 올리면 — 이름 · 등급 · 능력치 · 끼면 얼마나 바뀌나 · 오른쪽 클릭 안내
function itemHover(game, it, d) {
  const g = gradeOf(it);
  const lines = [`${itemTitle(game, it)}${it.plus ? ` +${it.plus}` : ''}`, `${g.name} · Lv.${it.ilv}${it.set ? ` · 세트 ${G.setOf(it.set)?.name || ''}` : ''}`, itemLines(game, it)];
  if (d != null && Math.abs(d) > 0.0005) lines.push(`끼면 전투력 ${d > 0 ? '▲' : '▼'} ${(Math.abs(d) * 100).toFixed(1)}%`);
  if (it.imps?.some(Boolean)) { const im = IM.imprintOf(it.imps.find(Boolean), it.rar || 1); if (im) lines.push(`각인 ${im.boss} ${IM.DAN_NAME(im.d)} · ${IM.skillModText(im.skill)}`); }
  lines.push('오른쪽 클릭: 끼기 · 강화 · 각인 · 팔기');
  return lines.join('\n');
}
function itemChip(game, it, extra = {}, withOpts = false) {
  const g = gradeOf(it);
  const u = game.itemUnique(it);
  const st = it.set ? G.setOf(it.set) : null;
  return h('div', { class: `item-chip g${it.grade}${it.rar === 3 ? ' mythic' : ''}${st ? ' set' : ''}`, style: `--gc:${g.color}`, ...extra },
    h('b', {}, itemTitle(game, it)),
    h('small', {}, `${it.rar != null ? `${g.name} · ` : ''}Lv.${it.ilv} · ${itemLines(game, it)}`),
    u ? h('small', { class: 'uniq' }, `고유 ${G.gearKeyText(u.k, u.v)}`) : null,
    st ? h('small', { class: 'set-tag', style: `--sc:${st.col}` }, `세트 ${st.name}${st.job && st.job !== game.s.job ? ' (다른 직업)' : ''}`) : null,
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
    if (game.s.gold >= game.statResetCost() && !confirm(`찍은 스탯을 모두 돌려받고 처음부터 다시 찍어요.\n은자 ${fmt(game.statResetCost())}이 들어요. 되돌릴까요?`)) return;
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
  // ---------- 길잡이 (v139) ----------
  // 들판 띠는 하나만 띄운다. 여기서는 어디까지 왔는지 전부 본다.
  const questCard = h('div', { class: 'card quest-card' });
  let qSig = '';
  function quests() {
    const cur = game.questNow();
    const nsig = `${game.s.quest}|${cur ? `${cur.now}/${cur.need}|${cur.done}|${cur.stuck}` : 'end'}|${game.s.level}`;
    if (nsig === qSig) return;
    qSig = nsig;
    const done = game.s.quest;
    // 조건이 이미 찬 단계가 둘 이상이면 한꺼번에 받는다
    let ready = 0;
    {
      const probe = new Set();
      let i = done;
      while (i < Q.QUEST_COUNT && !probe.has(i)) {
        probe.add(i);
        const q = Q.questAt(i);
        const gg = q.goal(game);
        if ((gg.now || 0) < (gg.need || 1)) break;
        ready++; i++;
      }
    }
    questCard.replaceChildren(h('h3', {}, '길잡이',
      h('small', {}, ` ${done}/${Q.QUEST_COUNT}`),
      ready > 1 ? h('button', { class: 'buy', style: 'float:right', onclick: () => {
        const got = game.claimAllQuests();
        if (!got.length) return;
        app.save(); qSig = ''; upd(); app.refresh();
        toast(`길잡이 ${got.length}단계를 한꺼번에 받았어요 — ${rewardText(got[got.length - 1].reward)} 외`);
      } }, `다 받기 (${ready})`) : null));
    if (!cur) {
      questCard.append(h('p', { class: 'muted' }, '길잡이를 다 마쳤어요. 이제는 가고 싶은 데로 가세요.'));
      return;
    }
    // 끝낸 것은 한 줄로 접는다 — 열여섯 줄을 그대로 깔면 끝낸 줄로만 가득 찬다
    if (done > 0) {
      questCard.append(h('p', { class: 'muted quest-past' }, `✓ ${done}단계 마침`));
    }
    const rows = [];
    for (let i = done; i < Q.QUEST_COUNT; i++) {
      const q = Q.questAt(i);
      const isNow = i === done;
      // 앞으로 올 것은 셋까지만 — 더 보여 주면 '해야 할 일'이 쌓여 보인다
      if (!isNow && i > done + 3) break;
      const rw = Q.questReward(q, game.s.level);
      const bits = [rw.gold ? `은자 ${fmt(rw.gold)}` : '', rw.exp ? `경험치 ${fmt(rw.exp)}` : ''].filter(Boolean);
      rows.push(h('div', { class: `row quest-row${isNow ? ' now' : ''}${isNow && cur.done ? ' ready' : ''}` },
        h('div', { class: 'ico' }, isNow ? (cur.done ? '✓' : '▸') : `${i + 1}`),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, q.title,
            isNow && !q.tip ? h('small', {}, ` ${fmt(cur.now)}/${fmt(cur.need)}`) : null, q.tip ? h('small', { class: 'muted' }, ' · 알아두기') : null),
          h('div', { class: 'desc' }, q.why),
          bits.length ? h('div', { class: 'desc quest-rw' }, `보상 ${bits.join(' · ')}`) : null),
        isNow && cur.done
          ? h('button', { class: 'buy', onclick: () => {
            const got = game.claimQuest();
            if (!got) return;
            app.save(); qSig = ''; upd(); app.refresh();
            toast(`길잡이 — ${q.title} ✓ ${rewardText(got)}`);
          } }, '받기')
          // 서버가 있어야 하는 단계는 건너뛸 수 있다 (보상 없이) · v260: 두 시간 넘게 막힌 단계도(보상 절반)
          : isNow && (q.skip || cur.stuck)
            ? h('button', { class: 'buy ghost', onclick: () => {
              if (cur.stuck && !confirm(`'${q.title}'을(를) 건너뛰고 보상을 절반만 받아요. 건너뛸까요?`)) return;
              const r = game.skipQuest();
              if (!r) return;
              app.save(); qSig = ''; upd(); app.refresh();
              toast(r === true ? `길잡이 — '${q.title}'은(는) 건너뛰었어요. 나중에 언제든 할 수 있어요`
                : `길잡이 — '${q.title}' 건너뛰기 · 절반 보상 ${rewardText(r)}`);
            } }, cur.stuck ? '건너뛰기 (보상 절반)' : '건너뛰기')
            : null));
    }
    questCard.append(...rows);
    if (done + 4 < Q.QUEST_COUNT) {
      questCard.append(h('p', { class: 'muted quest-past' }, `… 그 뒤로 ${Q.QUEST_COUNT - done - 4}단계 더`));
    }
  }
  // 스킬 레벨 — 레벨 15부터 레벨마다 점수 1, n→n+1에 점수 n
  const skillCard = h('div', { class: 'card' });
  let skSig = '';
  function skills() {
    const s = game.s;
    const nsig = `${s.skillPts}|${JSON.stringify(s.skillLv)}|${s.jobTier}|${game.statSig()}|${goldSig(game, 'skills')}|${JSON.stringify(s.enl || {})}|${JSON.stringify(s.awakens || {})}`;
    if (nsig === skSig) return;
    skSig = nsig;
    const rc = game.skillResetCost();
    skillCard.replaceChildren(...[h('h3', {}, '스킬', h('small', {}, `스킬 점수 ${s.skillPts} · 레벨 ${W.SKILL_PT_FROM}부터 레벨마다 1점 · 📜 비급 조각 ${s.frag || 0}/${W.fragNeed(s.fragPts)}(모으면 1점${s.fragPts ? ` · 지금까지 +${s.fragPts}` : ''}) · 만렙 ${W.SKILL_LV_MAX}`)),
      // 무공 초기화 (v205)
      game.skillSpentAll() > 0 ? h('div', { class: 'sk-reset' },
        h('small', {}, `무공·심법을 처음으로 — 쓴 점수 ${game.skillSpentAll()}점을 다 돌려받아요 · ${rc ? `은자 ${fmt(rc)}` : '처음 한 번은 공짜'}`),
        h('button', { class: 'btn', style: 'padding:4px 10px;font-size:12px', disabled: game.canResetSkills() ? null : true, onclick: () => {
          if (!confirm(`무공 레벨과 심법을 모두 처음으로 되돌릴까요?\n쓴 점수 ${game.skillSpentAll()}점을 돌려받아요${rc ? ` · 은자 ${fmt(rc)}` : ''}.`)) return;
          const n = game.resetSkills();
          if (n) { toast(`무공 초기화 — 점수 ${n}점을 돌려받았어요`); app.save(); skSig = ''; psSig = ''; upd(); app.refresh(); }
        } }, '무공 초기화')) : null].filter(Boolean));   // v211: null이 'null' 글자로 찍히던 것
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
          h('div', { class: 'name' }, sk.name, h('small', {}, `${W.SKILL_ORDINAL[sk.slot]} · Lv.${lv}`), max ? h('span', { class: 'sk-max' }, '極 만렙') : null),
          h('div', { class: 'desc' }, skillText(game, sk)),
          bits.length ? h('div', { class: 'desc', style: 'color:#fde68a' }, `레벨·장비: ${bits.join(' · ')}`) : null),
        h('button', { class: 'buy', disabled: game.canSkillUp(sk.id) ? null : true, onclick: () => {
          if (game.skillUp(sk.id)) { popUp(skillCard, `Lv.${game.skillLevel(sk.id)}`); app.save(); skSig = ''; upd(); }
        } }, max ? '최대' : `+1 · ${W.skillLvCost(lv)}점`)),
        // v263 깨달음 — 만렙 뒤 경험치로 무공마다 단계를 올린다
        ...(game.s.level >= W.LEVEL_MAX || game.enlLevel(sk.id) ? [h('div', { class: 'enl-row' },
          h('small', {}, `깨달음 ${game.enlLevel(sk.id)}/${W.ENL_MAX} · 피해 +${pct(game.enlLevel(sk.id) * W.ENL_STEP.dmg, 0)} · 숨 -${pct(game.enlLevel(sk.id) * W.ENL_STEP.cd, 0)}`),
          h('button', { class: 'buy', disabled: game.canEnlUp(sk.id) ? null : true, onclick: () => { if (game.enlUp(sk.id)) { app.save(); skSig = ''; upd(); } } }, `깨달음 +1 · ${W.enlCost(game.enlLevel(sk.id))}점`))] : []));
    }
    // v263 각성 — 레벨 55부터 1~3차 무공 하나에 변형 하나
    if (game.s.level >= W.AWAKEN_LV) {
      // v311 무공마다 하나 · 누르기 전에 드는 것 · 누르면 무엇인지 설명하고 묻는다
      const slots = game.awakenSlots();
      const cost = game.awakenCost();
      const card = h('div', { class: 'awaken-box' },
        h('div', { class: 'aw-head' }, h('b', {}, '무공 각성'),
          h('span', { class: `aw-cost${cost ? '' : ' free'}` }, cost ? `한 번에 은자 ${fmt(cost)}` : '첫 각성은 공짜')),
        h('small', { class: 'muted' }, '1~3차 무공마다 변형 하나씩 붙여요. 눌러서 무엇인지 보고 붙여요 — 바꾸면 전 변형은 사라져요.'));
      for (const sl of slots) {
        const sk = list.find((k) => k.id === sl);
        const cur = game.awakenOf(sl);
        const curK = W.AWAKEN_KINDS.find((k) => k.id === cur);
        card.append(h('div', { class: 'aw-line' },
          h('div', { class: 'aw-skill' }, h('b', {}, sk?.name || sl), h('small', { class: curK ? 'on' : '' }, curK ? `${curK.name} · ${curK.desc}` : '아직 없음')),
          h('div', { class: 'aw-chips' }, ...W.AWAKEN_KINDS.map((k) => h('button', {
            class: `chip aw-chip${cur === k.id ? ' on' : ''}`, disabled: cur === k.id ? true : null,
            onclick: () => askAwaken(sl, sk, k, curK),
          }, h('b', {}, k.name), h('small', {}, k.desc))))));
      }
      skillCard.append(card);
    }
    if (game.s.level >= W.LEVEL_MAX) skillCard.append(h('p', { class: 'muted' }, `깨달음 점수 ${fmt(game.s.enl?.pts || 0)} · 다음까지 ${Math.min(99, Math.floor((game.s.enl?.exp || 0) / W.enlExp() * 100))}% — 만렙 뒤 경험치가 깨달음이 돼요`));
  }
  // v311 각성 묻기 — 무엇이 되는지 · 드는 것 · 바뀌는 것을 보여 주고 붙인다
  function askAwaken(sl, sk, k, curK) {
    const cost = game.awakenCost();
    const lack = game.s.gold < cost;
    openModal((s) => s.append(...[
      h('h2', {}, `${sk?.name || sl} — ${k.name}`),
      h('p', { class: 'aw-long' }, k.long || k.desc),
      h('div', { class: 'aw-ask' },
        h('div', {}, h('b', {}, '붙는 것'), h('span', {}, k.desc)),
        curK ? h('div', {}, h('b', {}, '사라지는 것'), h('span', { class: 'warn' }, `${curK.name} · ${curK.desc}`)) : null,
        h('div', {}, h('b', {}, '드는 것'), h('span', { class: lack ? 'warn' : '' }, cost ? `은자 ${fmt(cost)} (가진 것 ${fmt(game.s.gold)})` : '없음 — 첫 각성은 공짜')),
        !cost ? h('small', { class: 'muted' }, `그 뒤로는 새로 붙이거나 바꿀 때마다 은자 ${fmt(W.awakenSwapCost(game.s.level))}쯤(레벨에 따라)`) : null),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: closeModal }, '그만두기'),
        h('button', { class: 'btn primary', disabled: game.canAwaken(sl, k.id) ? null : true, onclick: () => {
          if (!game.awaken(sl, k.id)) return toast('은자가 모자라요');
          closeModal(); toast(`각성 — ${sk?.name} ${k.name}: ${k.desc}`); app.save(); skSig = ''; upd();
        } }, lack ? '은자가 모자라요' : curK ? '바꾸기' : '붙이기')),
    ].filter(Boolean)));
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
  // v147: 한 줄로 길게 이어지던 것을 칸 셋으로 — 정보(길잡이·이야기) | 능력치 | 무공(스킬·심법)
  // v262 오늘의 강호 — 하루 과제 셋 · 주간 상자 · 혈겁
  const todayCard = h('div', { class: 'card today-card' });
  let tdSig = '';
  function today() {
    const list = game.todayTasks();
    const wk = game.s.week;
    const bn = TD.bloodNext();
    const nsig = `${JSON.stringify(list.map((x) => [x.now, x.claimed]))}|${wk.pts}|${wk.opened}|${bn < 0}|${Math.floor(Math.abs(bn) / 600)}|${game.s.level}`;
    if (nsig === tdSig) return;
    tdSig = nsig;
    const chest = TD.weekChest(game.s.level);
    todayCard.replaceChildren(
      h('h3', {}, '오늘의 강호', h('small', {}, ` 과제 하나 = 은자 ${fmt(TD.taskGold(game.s.level))} · 주간 점수 +${TD.TASK_POINT}`)),
      ...list.map((x) => h('div', { class: `row today-row${x.done ? ' ready' : ''}${x.claimed ? ' got' : ''}` },
        h('div', { class: 'ico' }, x.claimed ? '✓' : x.done ? '!' : '·'),
        h('div', { class: 'info' }, h('div', { class: 'name' }, x.desc(x.need), h('small', {}, ` ${fmt(x.now)}/${fmt(x.need)}`))),
        x.claimed ? h('small', { class: 'muted' }, '받음') : h('button', { class: 'buy', disabled: x.done ? null : true, onclick: () => {
          const r = game.claimToday(x.id); if (r) { toast(`오늘의 강호 — ${x.name} ✓ 은자 ${fmt(r.gold)}`); app.save(); tdSig = ''; today(); }
        } }, '받기'))),
      h('div', { class: 'week-row' },
        h('div', { class: 'week-bar' }, h('i', { style: `width:${Math.min(100, Math.round(wk.pts / TD.WEEK_NEED * 100))}%` })),
        h('small', {}, `주간 ${Math.min(wk.pts, TD.WEEK_NEED)}/${TD.WEEK_NEED}`),
        h('button', { class: 'buy', disabled: game.canOpenWeek() ? null : true, onclick: () => {
          const c = game.openWeek(); if (c) { toast(`주간 상자 — 은자 ${fmt(c.gold)} · 보호부 ${c.prot}장 · 영약 ${c.elixirSec / 60}분 · 포획·탈것 조각 ${c.petShard}씩`); app.save(); tdSig = ''; today(); }
        } }, wk.opened ? '열었음' : '주간 상자')),
      h('p', { class: `muted blood-line${bn < 0 ? ' on' : ''}` }, bn < 0
        ? `🩸 혈겁 진행 중 — 사냥터 은자·재료 +${TD.BLOOD_BONUS * 100}% · 정예 두 배 (${Math.ceil(-bn / 60)}분 남음)`
        : `🩸 다음 혈겁까지 ${bn >= 3600 ? `${Math.floor(bn / 3600)}시간 ` : ''}${Math.floor(bn / 60) % 60}분 · 매일 12~14시 · 20~22시`),
      h('p', { class: 'muted', style: 'font-size:11px' }, `주간 상자: 은자 ${fmt(chest.gold)} · 보호부 ${chest.prot}장 · 영약 ${chest.elixirSec / 60}분 · 월요일 0시에 새로`));
  }
  // v263 강호 견문록 — 졸개 종마다 100마리 · 지역을 다 찍으면 경험치 +0.5%
  const dexBox = h('div');
  let dexSig = '';
  function dexView() {
    const dx = game.s.dex || {};
    const zones = W.dexZones();
    const nsig = zones.map((z) => z.names.map((n) => Math.min(W.DEX_NEED, dx[n] || 0)).join('.')).join('|') + `|m${game.huntBonus().mast}`;
    if (nsig === dexSig) return;
    dexSig = nsig;
    const done = zones.filter((z) => z.names.every((n) => (dx[n] || 0) >= W.DEX_NEED)).length;
    const stamps = zones.reduce((a, z) => a + z.names.filter((n) => (dx[n] || 0) >= W.DEX_NEED).length, 0);
    const all = zones.reduce((a, z) => a + z.names.length, 0);
    dexBox.replaceChildren(
      h('div', { class: 'card' }, h('h3', {}, '강호 견문록', h('small', {}, ` 낙관 ${stamps}/${all} · 다 찍은 지역 ${done}/${zones.length} · 경험치 +${pct(game.dexBonus(), 1)}`)),
        h('p', { class: 'muted' }, `졸개 종마다 ${W.DEX_NEED}마리를 잡으면 낙관이 찍혀요. 낙관 하나에 공격력·체력 +${pct(W.DEX_STAMP_STAT, 2)}, 한 지역을 다 찍으면 경험치 +${pct(W.DEX_ZONE_EXP, 1)} · 공격력·체력 +${pct(W.DEX_ZONE_STAT, 1)} (영구).`),
        (() => { const hb = game.huntBonus(); return h('div', { class: 'hunt-bonus' },
          h('div', {}, '견문록', h('b', {}, `+${pct(hb.d, 1)}`)),
          h('div', {}, `숙련도 ${hb.mast}단계`, h('b', {}, `+${pct(hb.m, 1)}`)),
          h('div', {}, '사냥으로 쌓은 공격력·체력', h('b', {}, `+${pct(hb.total, 1)}`))); })(),
        h('p', { class: 'muted', style: 'font-size:11px' }, `숙련도: 한 지역에서 오래 사냥하면 오른다(지역마다 최대 10단계) — 단계 하나에 공격력·체력 +${pct(W.MAST_STAT, 2)}. 여러 사냥터를 돌수록 쌓여요.`)),
      ...zones.map((z) => {
        const full = z.names.every((n) => (dx[n] || 0) >= W.DEX_NEED);
        return h('div', { class: `card dex-zone${full ? ' full' : ''}` },
          h('div', { class: 'dex-head' }, h('b', {}, z.name), h('small', {}, ` Lv.${z.lv[0]}~${z.lv[1]}${full ? ' · ✓ 완성' : ''}`)),
          h('div', { class: 'dex-grid' }, ...z.names.map((n) => {
            const c = dx[n] || 0;
            return h('div', { class: `dex-chip${c >= W.DEX_NEED ? ' on' : ''}` }, h('span', {}, n), h('small', {}, c >= W.DEX_NEED ? '印' : `${c}/${W.DEX_NEED}`));
          })));
      }));
  }
  // v262 차림 두 벌
  const loadRow = h('div', { class: 'card loadout-row' });
  let loSig = '';
  function loadouts() {
    const s = game.s;
    const nsig = `${s.loadout}|${!!s.loadouts?.[0]}|${!!s.loadouts?.[1]}|${game.canSwitchLoadout(0)}|${game.canSwitchLoadout(1)}`;
    if (nsig === loSig) return;
    loSig = nsig;
    loadRow.replaceChildren(h('b', {}, '차림'), h('small', { class: 'muted' }, ' 능력치·무공·심법을 두 벌로 — 사냥용·두목용'),
      h('div', { class: 'btn-row' }, ...[0, 1].map((i) => h('button', { class: `btn${(s.loadout || 0) === i ? ' primary' : ''}`, disabled: (s.loadout || 0) === i || (s.loadouts?.[i] && !game.canSwitchLoadout(i)) ? true : null, onclick: () => {
        if (game.switchLoadout(i)) { toast(`차림 ${i + 1}로 바꿨어요${s.loadouts[i] ? '' : ''}`); app.save(); loSig = ''; app.refresh(); }
      } }, `차림 ${i + 1}${(s.loadout || 0) === i ? ' (지금)' : ''}`))));
  }
  // v320 출석부 — 7일 한 바퀴
  const attCard = h('div', { class: 'card att-card' });
  let attSig = '';
  function attView() {
    const can = game.canAttend();
    const nsig = `${game.s.att?.day}|${game.s.att?.n}|${can}|${game.s.level}`;
    if (nsig === attSig) return;
    attSig = nsig;
    attCard.replaceChildren(h('h3', {}, '출석부', h('small', {}, ` 하루 한 칸 · 7일째가 커요 · 빠져도 끊기지 않아요 · 모두 ${game.s.att?.total || 0}일`)),
      attGrid(game),
      h('button', { class: 'btn primary', style: 'width:100%;margin-top:6px', disabled: can ? null : true, onclick: () => { const r = game.attend(); if (r) { app.save(); attSig = ''; attView(); } } }, can ? `오늘 출석 — ${game.attNext()}일째 받기` : '오늘은 받았어요 · 내일 또'));
  }
  // v427 성장 지도 — 다섯 줄(성장·장비·무공·고수·던전·천계)에 지금 어디까지 왔는지와 「다음: ○○」 하나씩. 누르면 그 자리로
  const growCard = h('div', { class: 'card road-card' });
  function growRows() {
    const s = game.s, rows = [];
    const row = (icon, title, now, next, go, hot = false, done = false) => rows.push({ icon, title, now, next, go, hot, done });
    // ① 성장(레벨·전직)
    { const t = game.nextTier(), n = (s.jobTier || 0) + 1;
      if (t) {
        const nm = t.need ? (game.fifth?.()?.needName || t.need) : null;
        const next = s.level < t.level ? `레벨 ${t.level}에 ${n}차 전직` : t.need && !s.duel?.won?.[t.need] ? `${nm} 쓰러뜨리기(5차)` : s.gold < t.cost ? `${n}차 전직 은자 ${fmt(t.cost)} 모으기` : `${n}차 전직 — 사부에게`;
        row('成', `Lv.${s.level} · ${game.tierName()}`, `다음 전직 레벨 ${t.level}`, next, game.canAdvance() ? ['town', 'master'] : t.need && s.level >= t.level ? ['map', 'masters'] : ['map'], game.canAdvance());
      } else if (s.level < W.LEVEL_MAX) row('成', `Lv.${s.level} · ${game.tierName()}`, '전직은 끝', `레벨 ${W.LEVEL_MAX} 만렙`, ['map']);
      else row('成', `Lv.${s.level} · ${game.tierName()}`, '만렙', `깨달음 — 무공마다 단계(무공 창)`, ['char', 'skill'], (s.enl?.pts || 0) > 0); }
    // ② 장비
    { const worn = W.SLOTS.map((x) => s.equip[x.id]).filter(Boolean);
      const myth = worn.filter((it) => (it.rar || 0) >= 3).length, avg = worn.length ? Math.round(worn.reduce((a, it) => a + (it.plus || 0), 0) / worn.length) : 0, tr = worn.filter((it) => it.tr > 0).length;
      const t = game.upgradeTip?.();
      const next = t ? `${t.name} (전투력 +${(t.gain * 100).toFixed(1)}%)` : worn.length < W.SLOTS.length ? '빈 칸 채우기 — 대장장이' : myth < worn.length ? '각인으로 신화 등급 만들기' : avg < W.ENHANCE_MAX ? `+${W.ENHANCE_MAX}까지 강화` : tr < worn.length ? '초월' : '장비는 끝';
      row('裝', `장비 신화 ${myth}/${W.SLOTS.length} · 평균 +${avg}${tr ? ` · 초월 ${tr}` : ''}`, `전투력 ${fmt(Math.round(game.power?.() || 0))}`, next, t && t.kind === 'imp' ? ['bag', 'imp'] : worn.length < W.SLOTS.length ? ['bag', 'smith'] : ['bag', 'gear'], !!t, !t && tr >= worn.length && worn.length >= W.SLOTS.length); }
    // ③ 무공
    { const sks = game.skillList().filter((k) => k.tier <= (s.jobTier || 0) || k.tier === 0), maxed = sks.filter((k) => game.skillLevel(k.id) >= W.SKILL_LV_MAX).length;
      const can = s.skillPts > 0 && sks.some((k) => game.canSkillUp(k.id));
      const next = can ? `무공 점수 ${s.skillPts}점 찍기` : maxed < sks.length ? '레벨이 오르면 무공 점수' : s.level >= W.LEVEL_MAX ? '깨달음 단계 올리기' : '무공은 다 올렸어요';
      row('武', `무공 만렙 ${maxed}/${sks.length}`, s.skillPts > 0 ? `남은 점수 ${s.skillPts}` : '남은 점수 없음', next, ['char', 'skill'], can, maxed >= sks.length && !can); }
    // ④ 고수(비무·각성)
    { const all = ['murim', 'sapa', 'magyo', 'apex'].flatMap((f) => MS.mastersOf(f)).filter((m) => !m.hidden || s.duel.won.hwamugi);
      const won = all.filter((m) => s.duel.won[m.id]).length, stars = all.reduce((a, m) => a + game.duelStars(m.id).n, 0);
      const nx = all.filter((m) => !s.duel.won[m.id]).sort((a, b) => a.lv - b.lv)[0];
      const awk = W.AWAKEN_IDS.filter((id) => (s.awk?.kills?.[id] || 0) > 0).length;
      const next = nx ? `${nx.title} ${nx.name} (Lv.${nx.lv})${s.level < nx.lv - 5 ? ' — 레벨을 더' : ''}` : awk < W.AWAKEN_IDS.length ? `각성 고수 ${awk}/${W.AWAKEN_IDS.length}` : '고수는 다 꺾었어요';
      row('俠', `고수 ${won}/${all.length} · 별 ${stars}/${all.length * 3}`, awk ? `각성 ${awk}/${W.AWAKEN_IDS.length}` : '', next, ['map', 'masters'], !!nx && s.level >= nx.lv - 5, !nx && awk >= W.AWAKEN_IDS.length); }
    // ⑤ 던전
    { const tw = s.tower.floor || 0, top = Math.max(0, ...D.DAILY.map((d) => game.dailyBest(d.id)));
      const next = tw < D.TOWER_MAX ? `무한의 탑 ${tw + 1}층` : `끝없는 회랑 · 극 ${s.tower.hard || 0}층`;
      row('塔', `탑 ${tw}층 · 요일 던전 ${top}단계`, s.dgn?.auto || s.dgn?.routine ? '루틴 켜짐' : '루틴 꺼짐', next, ['dgn', 'tower'], false, tw >= D.TOWER_MAX); }
    // ⑥ 천계
    { if (s.level < D.WRAID_LV) row('天', '칠대성 — 아직', `레벨 ${D.WRAID_LV}부터`, `레벨 ${D.WRAID_LV} 되기`, ['map']);
      else { const w = s.wraid, pr = game.palmaReady(), gates = game.gatesCleared();
        const next = !pr.ok ? `대성신장 ${pr.n}/7 모으기 (칠대성 토벌)` : gates < D.HEAVEN_GATES.length ? `남천문 관문 ${gates + 1}` : !(w.ok >= 1) ? '옥황상제' : !(w.sk >= 1) ? '천외천 너머 — 석가여래' : '손바닥 밖은 없다 — 끝';
        row('天', `칠대성 ${w.kills || 0}번 · 대성신장 ${pr.n}/7`, gates || w.ok ? `관문 ${gates}/4${w.ok ? ' · 옥황 ✓' : ''}${w.sk ? ' · 석가 ✓' : ''}` : '', next, ['dgn', 'wraid'], false, w.sk >= 1); } }
    return rows;
  }
  function paintGrow() {
    const rows = growRows();
    let hotDone = false;
    growCard.replaceChildren(h('h3', {}, '성장 지도', h('small', {}, ' 지금 어디까지 · 다음은 무엇')),
      ...rows.map((r) => { const hot = r.hot && !hotDone; if (hot) hotDone = true;
        return h('button', { class: `road-row${r.done ? ' done' : ''}${hot ? ' hot' : ''}`, onclick: () => app.showTab(...r.go) },
          h('i', {}, r.done ? '✓' : r.icon), h('div', { class: 'road-txt' }, h('b', {}, r.title), r.now ? h('small', {}, r.now) : null),
          h('span', { class: 'road-next' }, `${hot ? '👉 ' : ''}${r.done ? '' : '다음: '}${r.next} ›`)); }));
  }
  const infoBox = h('div', {}, head, growCard, attCard, todayCard, questCard, loreBox);
  const statBox = h('div', {}, loadRow, stats, h('div', { class: 'card' }, h('h3', {}, '능력치'), derived));
  // v291 앞으로 배울 무공 — 언제 무엇을 배우는지
  const roadCard = h('div', { class: 'card' });
  let rdSig = '';
  function road() {
    const s = game.s;
    const nsig = `${s.job}|${s.level}|${s.jobTier}|${s.path}`;
    if (nsig === rdSig) return;
    rdSig = nsig;
    roadCard.replaceChildren(h('h3', {}, '무공 미리 보기', h('small', {}, '배우는 차례 · 누르면 설명')),
      s.job ? skillRoadmap(game, s.job) : h('p', { class: 'muted' }, '직업을 고르면 볼 수 있어요.'),
      h('button', { class: 'btn', style: 'width:100%;margin-top:8px', onclick: () => openSkillPreview(game, JOBS_LIST) }, '다른 직업 무공도 보기'));
  }
  const skillBox = h('div', {}, skillCard, roadCard, passCard);
  void root;
  function upd() {
    const s = game.s;
    const st = game.stats();
    const cls = W.classOf(s.job);
    const tn = game.titleNow();
    try { paintGrow(); } catch (e) { console.warn('[road]', e); }   // v427
    head.replaceChildren(
      h('h3', {}, tn ? h('span', { class: 'title-tag', style: `--tc:${tn.col}` }, `〈${tn.name}〉 `) : null, `${s.nickname || '무명'} `,
        h('button', { class: 'btn rename-btn', id: 'rename-btn', title: '이름 바꾸기', onclick: () => app.askNickname?.() }, '✎ 이름'), h('small', {}, ` ${game.tierName()} · Lv.${s.level}`)),   // v418 이름 바꾸기를 이름 옆에
      h('p', { class: 'muted' }, cls ? `${cls.name} — ${W.CLASSES[s.job].trait}` : ''),
      // v325 1차 전직 전에는 직업을 공짜로 바꿔 본다(무공 점수는 돌려받는다)
      (s.jobTier || 0) === 0 && s.job ? h('div', { class: 'job-swap' }, h('small', {}, '1차 전직 전까지 직업을 공짜로 바꿔 볼 수 있어요'),
        h('div', { class: 'job-swap-row' }, ...W.CLASS_LIST.map((c) => h('button', { class: `chip${c.id === s.job ? ' on' : ''}`, disabled: c.id === s.job ? true : null, style: `--cc:${c.color || '#e5e7eb'}`,
          onclick: () => { if (confirm(`${c.name}(으)로 바꿀까요? 무공 점수는 다 돌려받고, 레벨·장비·은자는 그대로예요.`) && game.changeJob(c.id)) { app.save(); app.refresh(); } } }, c.name)))) : '',   // replaceChildren에 null을 주면 'null' 글자가 찍힌다
      // v305 칭호 — 가진 것 가운데 하나를 낀다
      s.titles.length ? h('div', { class: 'title-row' }, h('small', {}, '칭호'),
        ...s.titles.map((k) => { const t = W.titleOf(k); return t ? h('button', { class: `chip title-chip${s.title === k ? ' on' : ''}`, style: `--tc:${t.col}`, title: t.desc,
          onclick: () => { game.wearTitle(s.title === k ? null : k); app.save(); app.refresh(); toast(s.title ? `〈${t.name}〉 — ${t.desc}` : '칭호를 벗었어요'); } }, `〈${t.name}〉`) : null; }),
        tn?.desc ? h('span', { class: 'title-desc' }, tn.desc) : null,
        h('button', { class: 'btn itm-info', style: 'font-size:11.5px;padding:3px 8px', onclick: () => openTitles(app) }, `칭호 모음 · +${Math.round(game.titleSet().atk * 100)}% ›`)) : h('div', { class: 'title-row' }, h('small', {}, '칭호'), h('span', { class: 'title-desc' }, '아직 없어요'), h('button', { class: 'btn itm-info', style: 'font-size:11.5px;padding:3px 8px', onclick: () => openTitles(app) }, '칭호 모음 ›')),

      h('div', { class: 'bar' }, h('div', { style: `width:${Math.min(100, (s.exp / game.expNeed()) * 100)}%` }),
        h('span', {}, `경험치 ${fmt(s.exp)} / ${fmt(game.expNeed())}`)));
    if (loreJob !== s.job) {
      loreJob = s.job;
      const L = W.LORE[s.job];
      loreBox.replaceChildren(...(L ? [h('details', { class: 'lore card' }, h('summary', {}, `${L.house}의 마존 · ${L.title}${L.real ? ` (본명 ${L.real})` : ''} — ${L.house} 사람들은 '${L.men}'라 부른다`),
        h('p', {}, L.text))] : []));
    }
    skills();
    road();
    passives();
    loadouts();
    today(); attView();
    quests();
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
  const t = subTabs([
    { key: 'info', label: '정보', make: () => ({ root: infoBox, update: upd }) },
    { key: 'stat', label: '능력치', make: () => ({ root: statBox, update: upd }) },
    { key: 'skill', label: '무공', make: () => ({ root: skillBox, update: upd }) },
    { key: 'dex', label: '견문록', make: () => ({ root: dexBox, update: dexView }) },
  ], 'ifu.charsub');
  const upd0 = t.update;
  t.update = () => {
    const s = game.s;
    t.setDot('stat', s.statPts > 0 && !s.autoStat);
    t.setDot('skill', game.skills().some((k) => game.canSkillUp(k.id)) || game.passiveList().some((p) => game.canPassUp(p.id)));
    t.setDot('info', !!game.questNow()?.done);
    upd0();
  };
  return t;
}

// ---------- 가방 ----------
// v120 개편: 한 창에 셋을 줄줄이 늘어놓던 것을 하위 탭 셋으로 —
//   장비      낀 여섯 칸을 한눈에(눌러서 강화·승급) + 가방(칸별로 거르기, 낀 것보다 좋은 것은 위에 '끼기' 단추)
//   대장장이  칸을 고르면 만들 수 있는 장비가 좋은 것부터 — 재료만 있으면 어느 칸이든(아래 장비는 넣으면 이득)
//   재료      지역마다 재료·증표와 나오는 곳
const SLOT_SHORT = { weapon: '무기', armor: '옷', hat: '모자', glove: '장갑', shoe: '신발', acc: '장신구', finger: '가락지', ear: '귀걸이' };
// v348 되돌릴 수 없는 것은 무엇을 잃는지 보여 주고 묻는다(다시 굴리기가 좋은 효과를 강제로 날리던 일 뒤 전부 점검)
function sureSell(it) {
  if (!it) return false;
  const worth = (it.rar || 0) >= 1 || (it.plus || 0) > 0 || it.imps?.some(Boolean) || it.set || it.king != null;
  if (!worth) return true;
  const what = [W.RARITY[it.rar || 0].name, it.plus ? `+${it.plus}` : '', it.imps?.some(Boolean) ? '각인' : '', it.set ? '세트' : ''].filter(Boolean).join(' · ');
  return confirm(`이 장비(${what})를 팔아요. 판 장비는 되돌릴 수 없어요. 팔까요?`);
}
function surePetFeed(host, n) {
  const g = surePetFeed.game;
  const f = g ? g.starFodder(host.uid).slice(0, n) : [];
  if (!f.length) return true;
  const good = f.filter((x) => (x.rar || 0) >= 2 || (x.star || 0) > 0 || (x.lv || 1) >= 30);
  const names = f.slice(0, 4).map((x) => `${W.RARITY[x.rar || 0].name}${x.star ? `★${x.star}` : ''} Lv.${x.lv || 1}`).join(', ');
  return confirm(`같은 종 ${f.length}마리를 먹이로 써요 (${names}${f.length > 4 ? ' …' : ''}).${good.length ? `\n그 가운데 ${good.length}마리는 전설 이상·별·높은 레벨이에요.` : ''}\n먹인 것은 사라져요. 먹일까요?`);
}
function bagTab(app) {
  surePetFeed.game = app.game;
  const { game } = app;
  let ui = { slot: 'all', smith: 'weapon', useBase: true, readyOnly: false, smode: 'ladder', kz: 0, kslot: 'acc', rar: 0 };
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem('ifu.bagui') || '{}') }; } catch { /* 사생활 모드 */ }
  const keepUi = () => { try { localStorage.setItem('ifu.bagui', JSON.stringify(ui)); } catch { /* 사생활 모드 */ } };
  const sigs = { gear: '', smith: '', mats: '', imp: '', enh: '' };
  const done = () => { app.save(); sigs.gear = sigs.smith = sigs.mats = sigs.imp = sigs.enh = ''; app.refresh(); };
  // 두목 장비(두목 증표로 만든 상급 · 두목이 떨군 것)는 끼면 그 두목의 겉모습이 든다 (v116)
  function bossGearNote(it) {
    if (it.grow || it.step == null || !(it.step % 2 === 1 || it.boss)) return null;
    const b = W.zoneOfW(W.itemZone(it))?.boss;
    if (!b) return null;
    const what = { weapon: '무기에 그 기운 빛', armor: '그 도포 빛깔', hat: '그 쓰개', acc: '몸을 도는 구슬', finger: '몸을 도는 구슬', ear: '몸을 도는 구슬' }[it.slot];
    return h('p', { class: 'boss-gear' }, `두목 장비 — 끼면 ${b.name}의 ${what}`, ['weapon', 'armor', 'hat'].includes(it.slot) ? ' (무기·옷·모자를 한 두목 것으로 맞추면 발밑에 그 빛깔 고리)' : '');
  }
  // v349 오른쪽 클릭 — 바로 그 칸으로 연다
  function itemMenu(e, it, worn) {
    const at = (tab) => () => { try { localStorage.setItem('ifu.itemTab', tab); } catch { /* 이번만 */ } openItem(it, worn); };
    ctxMenu(e, [
      ['🔍 자세히', () => openItem(it, worn)],
      !worn ? ['⬆ 끼기', () => { game.equipFromBag(it.uid); done(); toast('꼈어요'); }] : null,
      ['⚒ 강화', at('enh')],
      game.canImprintItem(it) ? ['✦ 각인', at('imp')] : null,
      !worn && !it.grow ? ['💰 팔기', () => { if (!sureSell(it)) return; const p = game.sell(it); toast(`팔았어요 — 은자 +${fmt(p)}`); done(); }] : null,
      !worn && !it.grow ? ['☑ 여러 개 골라 팔기', () => { pick.on = true; pick.sel.clear(); game.mark('pickSell'); pick.sel.add(it.uid); app.showTab('bag', 'bag'); sigs.gear = ''; gearView(); toast('다른 장비도 눌러 고른 뒤 「팔기」'); }] : null,   // v398
    ]);
  }
  function openItem(it, worn, tab) {
    let useProt = true;
    game.adoptShared?.(it);   // v258: 공유 강화를 이어받은 단계로 강화 값·확률을 보여 준다(판매가에는 공유 몫을 안 넣는다)
    if (it.grow) game.mark('gearView');
    // 등급 각인에 넣을 증표 — 확률이 높은 것(센 두목)부터 (v158)
    let markPick = null;
    let spPick = 0;                          // v167: 새길 고유 효과 (셋 가운데)
    let fillPick = null;                     // v251: 빈 칸에 새길 증표
    let fillSp = 0;                          // v256: 빈 칸에 새길 고유 효과
    let itemTab = tab || (() => { try { return localStorage.getItem('ifu.itemTab') || 'enh'; } catch { return 'enh'; } })();   // v207 · v403 추천에서 오면 그 칸으로
    openModal((s) => {
      // v276 장비 창 다시 — 한눈에는 꼭 볼 것만(숫자·비용 칩·단추). 자세한 것은 눌러서 같은 창 안에서 보고 '← 돌아가기'
      const ORD = ['각인', '각인', '각인'];   // v307 장비마다 한 칸 — 옛 '첫째·둘째·셋째' 자리
      const RAR3 = ['유니크', '전설', '신화'];
      const SK_SHORT = { range: '범위', dmg: '피해', cd: '숨', echo: '한 번 더' };
      const short = (k) => W.matName(k).replace(/의 증표$/, '');
      const goldIco = () => h('span', { class: 'gold-ico' }, '銀');
      // 비용 칩 — 아이콘·필요한 수 · 아래에 가진 수. 모자라면 붉게. 누르면 가진 수를 알린다
      // v301 모자라면 바로 가는 길 — 재료는 '어디서 나와요 → 가기' 창(돌아오면 장비 창) · 보호부는 마을 상인 · 은자는 가장 센 사냥터
      const goWhere = (key) => openMatWhere(app, key, () => openItem(it, worn));
      const goShop = () => { closeModal(); app.showTab('town', 'shop'); setTimeout(() => document.querySelector('#panel .prot-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); };
      const goHunt = () => { const w = matWhere(game, W.ORE); if (!w || !game.enterMap(w.id)) return toast('지금은 갈 수 없어요'); game.s.huntMap = w.id; closeModal(); app.save(); app.closePanel(); app.refresh(); toast(`${w.map.name}으로 왔어요 — 은자·현철이 모여요`); };
      const costChip = (key, label, need, have, icon) => h('button', { class: `cost-chip${have < need ? ' lack' : ''}`, style: key ? `--mc:${W.matColor(key)}` : '',
        onclick: () => (have < need && key ? goWhere(key) : toast(`${label} — 가진 것 ${fmt(have)}${have < need ? ` · ${fmt(need - have)} 모자라요` : ''}`)) },
      icon, h('span', { class: 'cc-n' }, h('b', {}, fmt(need)), h('small', {}, `${label} ${fmt(have)}`)));
      const rateBar = (rate, cls = '') => h('div', { class: `enh-ratebar ${cls}` }, h('i', { style: `width:${Math.max(2, Math.round(rate * 100))}%` }));
      // 같은 창 안의 자세히 화면
      const sub = (title, ...nodes) => {
        s.replaceChildren(...[
          h('div', { class: 'itm-subhead' }, h('button', { class: 'btn itm-back', onclick: () => paint() }, '← 돌아가기'), h('b', {}, title)),
          ...nodes,
        ].filter(Boolean));
      };
      const paint = () => {
        const g = gradeOf(it);
        const cur = game.s.equip[it.slot];
        const breaking = (it.plus || 0) >= W.ENHANCE_NORMAL;
        const tabsAll = [['enh', breaking ? '돌파' : '강화'], game.canImprintItem(it) ? ['imp', '각인'] : null, ['info', '정보']].filter(Boolean);
        if (!tabsAll.some(([k]) => k === itemTab)) itemTab = 'enh';
        const tabRow = h('div', { class: 'item-tabs' }, ...tabsAll.map(([k, name]) => h('button', { class: `item-tab${k === itemTab ? ' on' : ''}`, onclick: () => { itemTab = k; try { localStorage.setItem('ifu.itemTab', k); } catch { /* 이번만 */ } paint(); } }, name)));
        const sp = game.sharedPlus ? game.sharedPlus(it) : 0;
        const ep = Math.max(it.plus || 0, sp);
        const head = h('div', { class: 'itm-head', style: `--gc:${g.color}` },
          itemIcon(it, 56),
          h('div', { class: 'itm-name' },
            h('h2', { style: `color:${g.color}` }, W.itemName(it, game.s.job)),
            h('small', {}, `${W.SLOTS.find((x) => x.id === it.slot).name} · Lv.${it.ilv} · `, h('b', { style: `color:${g.color}` }, g.name))),
          h('div', { class: 'itm-plus' }, `+${ep}`, sp > (it.plus || 0) ? h('small', {}, '공유') : null));
        const pane = itemTab === 'imp' ? impView() : itemTab === 'info' ? infoView(cur) : enhView();
        s.replaceChildren(...[
          head,
          h('p', { class: 'item-stat' }, itemLines(game, it)),
          !worn ? equipCompare(game, it) : null,   // v317 끼면 → 공격력 ▲ +3,200 · 체력 ▼ … · 전투력
          tabRow,
          h('div', { class: 'item-pane' }, ...pane.filter(Boolean)),
          h('div', { class: 'btn-row' },
            !worn ? h('button', { class: 'btn primary', onclick: () => { game.equipFromBag(it.uid); closeModal(); done(); } }, '끼기') : null,
            !worn && !it.grow ? h('button', { class: 'btn', onclick: () => { if (!sureSell(it)) return; const b = W.sellBack(it); const p = game.sell(it); toast(b ? `되팔기 — 은자 +${fmt(p)} · ${Object.entries(b.mats).map(([k, n]) => { const o = W.oreOf(k, n); return `${W.matName(o.key)} ${fmt(o.n)}`; }).join(' · ')}` : `은자 +${fmt(p)}`); closeModal(); done(); } },
              W.sellBack(it) ? `되팔기 (제작비 ¼)` : `팔기 ${fmt(W.sellPrice(it))}`) : null,
            h('button', { class: 'btn', onclick: closeModal }, '닫기')),
        ].filter(Boolean));   // replaceChildren은 null을 글자 'null'로 넣는다
      };
      // ---- 강화 칸: +N → +N+1 · 성공 막대 · 비용 칩 · 단추 ----
      // v300 강화 창 — 여정(+1~+15) · 무엇이 오르나 · ▶ 다음 할 일 · ⓘ 강화란?
      const STAT_KO = { atk: '공격력', hp: '체력', def: '방어', hpPct: '최대 체력', atkPct: '공격력', crit: '치명', critDmg: '치명 피해', skillDmg: '스킬 피해', bossDmg: '두목 피해', dmgRed: '피해 감소', speed: '공격 속도', drain: '흡혈' };   // v390 장신구 몫(%)도 이름으로
      const mainStat = (o) => ['atk', 'hp', 'def'].find((k) => o[k] > 0) || Object.keys(o)[0];
      const enhGain = () => {
        const lv = it.plus || 0;
        const a = game.itemStats(it), b = game.itemStats({ ...it, plus: lv + 1 });
        const k = mainStat(a);
        const flat = ['atk', 'hp', 'def'].includes(k); const show = (v) => (flat ? fmt(Math.round(v || 0)) : `${((v || 0) * 100).toFixed(1)}%`);
        return k ? h('div', { class: 'enh-gain' }, h('span', {}, STAT_KO[k] || k), h('b', {}, show(a[k])), h('i', {}, '→'), h('b', { class: 'up' }, show(b[k])), h('small', {}, ` +${pct(lv >= W.ENHANCE_NORMAL ? W.BREAK_STEP : W.ENHANCE_STEP, 0)}`)) : null;
      };
      // 여정 — 15칸. 1~6 그대로 · 7~9 실패 -1 · 10~ 돌파(-2 · 증표 · 보호부). 레벨 상한 너머는 잠김
      const enhRoad = () => {
        const lv = it.plus || 0;
        const cap = game.enhanceMax(it), capItem = game.enhanceMaxItem(it);
        const nx = W.enhanceCapNext(game.s.level);
        return h('div', { class: 'enh-road' },
          h('div', { class: 'road-pips' }, ...Array.from({ length: W.ENHANCE_MAX }, (_, j) => {
            const n = j + 1;
            const zone = n <= 6 ? 'safe' : n <= W.ENHANCE_NORMAL - 1 ? 'warn' : 'brk';
            return h('i', { class: `${zone}${n <= lv ? ' on' : ''}${n === lv + 1 && lv < cap ? ' next' : ''}${n > cap ? ' lock' : ''}`, title: `+${n}` }, n === lv + 1 && lv < cap ? `+${n}` : (n === 1 || n === 7 || n === 10 || n === 15) ? `${n}` : '');
          })),
          h('div', { class: 'road-legend' },
            h('span', { class: 'safe' }, '+1~6 실패해도 그대로'), h('span', { class: 'warn' }, '+7~9 실패 -1'), h('span', { class: 'brk' }, '+10부터 돌파 · 실패 -2 · 증표'),
            cap < capItem ? h('span', { class: 'lock' }, `🔒 +${cap + 1}부터는 ${nx ? `레벨 ${nx[0]}에` : '나중에'}`) : null));
      };
      // ▶ 다음 할 일 — 할 수 있으면 금빛, 아니면 왜 안 되는지와 어디서 구하는지
      const enhNext = () => {
        const lv = it.plus || 0;
        const cap = game.enhanceMax(it);
        let txt, hot = false, go = null, act = '';
        if (lv >= game.enhanceMaxItem(it)) { txt = '끝까지 강화했어요 — 이제 각인으로 세져요'; go = () => { itemTab = 'imp'; paint(); }; act = '각인'; }
        else if (lv >= cap) { const nx = W.enhanceCapNext(game.s.level); txt = nx ? `레벨 ${nx[0]}이 되면 +${nx[1]}까지 열려요 (지금 Lv.${game.s.level})` : '끝까지 강화했어요'; }
        else if (game.canEnhance(it)) { const f = W.enhanceFail(lv); txt = `${lv >= W.ENHANCE_NORMAL ? '돌파' : '강화'}할 수 있어요 — 성공 ${pct(game.enhanceRateOf(it), 0)} · ${f ? `실패하면 +${Math.max(0, lv + f)}` : '실패해도 그대로'}`; hot = true; go = () => askEnhance(); }
        else {
          const em = game.enhanceMats(it), bm = game.breakMarksOf(it);
          const gold = game.enhanceCost(it) - game.s.gold;
          if (gold > 0) { txt = `은자 ${fmt(gold)} 모자라요 — 사냥하면 모여요`; go = goHunt; act = '사냥터로'; }
          else if (em && game.enhanceMatHave(em) < em.n) { txt = `${W.matName(em.key)} ${fmt(em.n - game.enhanceMatHave(em))} 모자라요 — 몹·두목이 떨궈요(높은 사냥터일수록 많이)`; go = () => goWhere(em.key); act = '어디서?'; }
          else if (bm && !game.breakMarkKey(it, bm)) { const own = W.bossKey(W.itemZone(it)); txt = `돌파 증표 ${bm}개 필요 — ${W.zoneOfW(W.itemZone(it))?.name || ''} 두목 구역의 ${short(own)}${game.s.level >= 99 ? ' (십이지왕 증표도 돼요)' : ''}`; go = () => goWhere(own); act = '가기'; }
          else txt = '지금은 강화할 수 없어요';
        }
        return h(go ? 'button' : 'div', { class: `next-step${hot ? ' hot' : ''}`, onclick: go || undefined }, h('i', {}, '▶'), h('span', {}, txt), go ? h('em', {}, act ? `${act} ›` : '›') : null);
      };
      // v424 초월까지의 길 — 무엇이 모자란지 · 어디로 가면 되는지(각인 칸·강화 칸으로 바로)
      const transRoad = () => {
        const maxP = game.enhanceMaxItem(it), rarOk = (it.rar || 0) >= 3, pOk = (it.plus || 0) >= W.ENHANCE_MAX;
        const rows = [];
        rows.push([rarOk, `① 신화 등급 — ${rarOk ? '됐어요' : `지금 ${W.RARITY[it.rar || 0].name}${game.canImprintItem(it) ? ' · 각인 칸에서 두목 증표로 레어 → 유니크 → 전설 → 신화' : ' · 이 장비는 각인이 안 돼요(성장·두목·왕 장비만)'}`}`,
          !rarOk && game.canImprintItem(it) ? ['각인 칸 ›', () => { itemTab = 'imp'; try { localStorage.setItem('ifu.itemTab', 'imp'); } catch { /* 이번만 */ } paint(); }] : null]);
        if (maxP < W.ENHANCE_MAX) rows.push([false, `② +${W.ENHANCE_MAX} — 이 장비는 +${maxP}까지만이라 초월이 안 돼요(돌파가 되는 성장·두목·왕 장비로)`, null]);
        else rows.push([pOk, `② +${W.ENHANCE_MAX}까지 강화 — ${pOk ? '됐어요' : `지금 +${it.plus || 0}${(it.plus || 0) >= W.ENHANCE_NORMAL ? ' · 돌파는 두목 증표·보호부로' : ''}`}`, !pOk ? ['강화 칸 ›', () => { itemTab = 'enh'; paint(); }] : null]);
        rows.push([false, `③ 재료 — 은자 ${fmt(W.transGold(it.ilv, 0))} · ${W.ORE_NAME} ${fmt(W.transOre(0))} · 두목 증표 한 종류 ${W.transMarks(0)}개 · 성공 ${pct(W.TRANS_RATE[0], 0)}(실패해도 떨어지지 않고 다음 확률 ↑)`, null]);
        return h('div', { class: 'card tr-road' }, h('b', {}, `✦ 초월까지 — 단계마다 공격력·체력·방어 +${Math.round(W.TRANS_STEP * 100)}% (${W.TRANS_MAX}단계)`),
          ...rows.map(([ok, txt, go]) => h('div', { class: `tr-step${ok ? ' ok' : ''}` }, h('i', {}, ok ? '✓' : '○'), h('span', {}, txt), go ? h('button', { class: 'btn mini', onclick: go[1] }, go[0]) : null)));
      };
      // v393 초월 — +15까지 다 한 신화 장비
      const transBox = () => {
        const tr = it.tr || 0;
        if ((it.rar || 0) < 3 || (it.plus || 0) < game.enhanceMaxItem(it) || game.enhanceMaxItem(it) < W.ENHANCE_MAX) return transRoad();
        if (tr >= W.TRANS_MAX) return h('div', { class: 'card tr-box' }, h('b', {}, `✦ ${W.TRANS_NAME[tr]} — 끝`), h('small', { class: 'muted' }, ` 공격력·체력 +${Math.round(tr * W.TRANS_STEP * 100)}%`));
        const f = game.transInfo(it);
        const can = game.canTranscend(it);
        return h('div', { class: 'card tr-box' },
          h('div', { class: 'tr-head' }, h('b', {}, `✦ 초월 ${tr} → ${tr + 1}`), h('small', {}, ` 공격력·체력 +${Math.round(tr * W.TRANS_STEP * 100)}% → +${Math.round((tr + 1) * W.TRANS_STEP * 100)}%`)),
          h('div', { class: 'tr-cost' },
            h('span', { class: game.s.gold >= f.gold ? '' : 'lack' }, `은자 ${fmt(f.gold)}`),
            h('span', { class: (game.s.mats[W.ORE] || 0) >= f.ore ? '' : 'lack' }, `${W.ORE_NAME} ${fmt(f.ore)}`),
            h('span', { class: f.mark ? '' : 'lack' }, f.mark ? `${W.matName(f.mark)} ${f.markN}` : `두목 증표 ${f.markN}개(한 종류)`)),
          h('div', { class: 'tr-rate' }, `성공 ${pct(f.rate, 0)} · 실패해도 떨어지지 않고 다음 확률 ↑`),
          h('button', { class: 'btn primary', id: 'trans-go', style: 'width:100%', disabled: can ? null : true, onclick: () => {
            const ok = game.transcend(it.uid);
            if (ok == null) return;
            toast(ok ? `✦ ${W.TRANS_NAME[it.tr]}! 공격력·체력 +${Math.round(it.tr * W.TRANS_STEP * 100)}%` : '초월 실패 — 다음 확률이 올라요');
            app.save(); paint(); app.refresh();
          } }, can ? '✦ 초월하기' : '재료가 모자라요'));
      };
      const enhView = () => {
        const lv = it.plus || 0;
        const breaking = lv >= W.ENHANCE_NORMAL;
        if (lv >= game.enhanceMax(it)) {
          return [enhRoad(), enhNext(), h('div', { class: 'enh-box enh-max' }, h('div', { class: 'enh-hero' }, h('b', {}, `+${lv}`), it.tr ? h('em', { class: 'tr-badge' }, W.TRANS_NAME[it.tr]) : ''),
            h('div', { class: 'enh-actions' }, h('button', { class: 'btn itm-info', onclick: () => enhHelp() }, 'ⓘ 강화란?'))), transBox()];
        }
        const rate = game.enhanceRateOf(it);
        const risky = W.enhanceRisky(lv);
        const fail = W.enhanceFail(lv);
        const em = game.enhanceMats(it);
        const bm = game.breakMarksOf(it);
        const own = bm ? W.bossKey(W.itemZone(it)) : null;
        const bk = bm ? game.breakMarkKey(it, bm) || own : null;
        return [enhRoad(), enhNext(), h('div', { class: `enh-box${risky ? ' danger' : ''}` },
          h('div', { class: 'enh-hero' }, h('span', {}, `+${lv}`), h('i', {}, '→'), h('b', {}, `+${lv + 1}`)),
          enhGain(),
          rateBar(rate, risky ? 'danger' : ''),
          h('div', { class: 'enh-meta' }, h('span', {}, `성공 ${pct(rate, 0)}`),
            h('span', { class: fail ? 'warn' : 'safe' }, fail ? `실패하면 +${Math.max(0, lv + fail)}` : `실패해도 +${lv} 그대로`),
            it.epity ? h('span', {}, `실패가 쌓여 +${pct(it.epity, 0)}p`) : null),
          h('div', { class: 'cost-chips' },
            costChip(null, '은자', game.enhanceCost(it), game.s.gold, goldIco()),
            em ? costChip(em.key, W.matName(em.key), em.n, game.s.mats[em.key] || 0, matIcon(em.key, 24)) : null,
            bm ? costChip(bk, `${short(bk)} 증표`, bm, game.s.mats[bk] || 0, matIcon(bk, 24)) : null),
          risky ? (game.s.prot ? h('label', { class: 'chk prot-chk' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = useProt; c.onchange = () => { useProt = c.checked; paint(); }; return c; })(), ` 보호부 쓰기 (${game.s.prot}장) — 실패해도 +${lv} 그대로`)
            : h('button', { class: 'prot-none', onclick: goShop }, '보호부가 없어요 — 마을 상인에서 사면 실패해도 그대로예요 ', h('b', {}, '상인에게 ›'))) : null,
          h('div', { class: 'enh-actions' },
            h('button', { class: 'btn itm-info', onclick: () => enhHelp() }, 'ⓘ 강화란?'),
            h('button', { class: 'btn good enh-go', disabled: game.canEnhance(it) ? null : true, onclick: () => askEnhance() }, breaking ? '돌파' : '강화'))),
          game.enhanceMaxItem(it) >= W.ENHANCE_MAX ? foldBox('-trroad|초월까지의 길', transRoad()) : null];   // v424 +15 전에도 초월까지의 길(접힌 채)
      };
      const enhHelp = () => {
        const lv = it.plus || 0;
        const bm = game.breakMarksOf(it) || 1;
        const own = W.bossKey(W.itemZone(it));
        sub('강화는 이렇게 해요',
          h('div', { class: 'help-steps' },
            h('div', { class: 'help-step' }, h('b', {}, '① 은자와 현철로 한 단계씩'), h('p', {}, `한 단계마다 장비 기본 수치 +${pct(W.ENHANCE_STEP, 0)}(돌파는 +${pct(W.BREAK_STEP, 0)}). ${W.ORE_NAME}은 모든 몹·두목이 떨궈요 — 높은 사냥터일수록 많이.`)),
            h('div', { class: 'help-step' }, h('b', {}, '② +1~+6은 안전 · +7~+9는 실패하면 -1'), h('p', {}, '실패해도 장비는 안 사라져요. 실패할 때마다 다음 확률이 쌓여서(천장) 운이 나빠도 끝없이 막히지 않아요. 성공하면 쌓인 건 비워져요.')),
            h('div', { class: 'help-step' }, h('b', {}, '③ +10부터 돌파 — 증표와 보호부'), h('p', {}, `두목 증표가 더 들어요(+11에 1개 … +15에 5개). 이 장비는 ${W.zoneOfW(W.itemZone(it))?.name || ''} 두목 구역의 ${short(own)} 증표${game.s.level >= 99 ? ', 99부터는 십이지왕 증표도' : ''}.`), h('p', { class: 'hl' }, '실패하면 -2. 보호부(마을 상인)가 있으면 한 장을 쓰고 그대로예요.')),
            h('div', { class: 'help-step' }, h('b', {}, '④ 레벨 제한 없음'), h('p', {}, `어느 레벨이든 이 장비가 갈 수 있는 끝(+${game.enhanceMaxItem(it)})까지 올릴 수 있어요.`)),
            it.grow ? h('div', { class: 'help-step' }, h('b', {}, '⑤ 성장 장비'), h('p', {}, `레벨을 따라 저절로 자라요(지금 Lv.${it.ilv}). 강화는 그대로 이어지니 바꿔 낄 걱정 없이 올리면 돼요.`)) : null,
            h('div', { class: 'help-step' }, h('b', {}, '⚙ 자동'), h('p', {}, '설정의 \'자동 강화\'를 켜면 낮은 칸부터 알아서 올려요(레벨 상한까지 · +11부터는 보호부를 써요).'))));
        void lv; void bm;
      };
      // ---- 정보 칸 ----
      const infoView = (cur) => [
        game.itemUnique(it) ? h('div', { class: 'uniq-box' }, h('b', {}, '고유 옵션 '), G.gearKeyText(game.itemUnique(it).k, game.itemUnique(it).v)) : null,
        it.opts?.length ? h('div', { class: 'opt-box' }, ...optLines(it).map((t, i) => h('div', { class: it.opts[i].sp || it.opts[i].kp ? 'sp' : it.opts[i].pet ? 'pet' : it.opts[i].tf ? 'tf' : '' }, t))) : null,
        it.set ? setBox(game, G.setOf(it.set)) : null,
        bossGearNote(it),
        !worn && cur ? h('p', { class: 'muted' }, `지금 낀 것: ${itemTitle(game, cur)} — ${itemLines(game, cur)}`) : null,
        it.king != null ? h('p', { class: 'muted' }, `레벨 100 왕의 장비 — 강화는 ${W.matName(G.stoneFor(it))}`) : W.isDropOnly(it.slot) ? h('p', { class: 'muted' }, '두목에게서만 나와요 — 강화가 어려워요') : it.grow ? h('p', { class: 'muted' }, `성장 장비 — 레벨을 따라 자라요 (Lv.${it.ilv}, ${W.ILV_CAP}까지)`) : null,
      ];
      // ---- 각인 칸: 세 칸 타일(눌러서 자세히) + 등급 각인 ----
      // v297 전투력이 얼마나 올랐나 — 각인한 뒤 알림에 붙인다
      const qualNote = (e) => { const q = IM.qualOf(e); return q.id ? `${q.mark} ${q.name}! ` : ''; };
      const powNote = (p0) => { const p1 = game.power(); const d = p1 / Math.max(1, p0) - 1; return Math.abs(d) < 0.0005 ? '' : ` · 전투력 ${d > 0 ? '+' : ''}${(d * 100).toFixed(d * 100 >= 10 ? 0 : 1)}%`; };
      // v299 각인 요약 — 배율 하나만 크게 · 공명은 가장 가까운 둘 · 설명은 ⓘ 안으로
      const resPanel = () => {
        const rs = game.resonance();
        const core = IM.impCoreTotal(game.s.equip);
        const mul = core + (rs.extra.resAtk || 0);
        // 다음 단계가 가까운 순(공명이 있으면 그것부터)
        const list = Object.values(rs.by).sort((a, b) => (b.tier - a.tier) || (a.next || 99) - (b.next || 99) || b.n - a.n).slice(0, 2);
        return h('div', { class: 'res-box' },
          h('div', { class: 'res-head' },
            h('div', { class: 'res-big' }, h('small', {}, '각인으로 세진 만큼'), h('b', { class: 'res-mul' }, `×${(1 + mul).toFixed(3)}`), h('small', {}, '공격력·체력')),
            h('div', { class: 'res-btns' }, h('button', { class: 'btn itm-info res-info', onclick: () => helpView() }, 'ⓘ 각인이란?'), h('button', { class: 'btn itm-info res-info ig-open', onclick: () => { closeModal(); openImprintGuide(app, () => openItem(it, worn)); } }, '🔎 원하는 능력 찾기'))),
          list.length ? h('div', { class: 'res-list' }, ...list.map((r) => {
            const th = IM.THEMES[r.theme];
            const nx = r.tier < IM.RES_NEED.length - 1 ? IM.RES_NEED[r.tier + 1] : null;
            const lo = r.tier >= 0 ? IM.RES_NEED[r.tier] : 0;
            return h('div', { class: `res-row${r.tier >= 0 ? ' on' : ''}`, style: `--ic:${th.col}` },
              h('span', { class: 'res-name' }, `${th.name} 공명`, r.tier >= 0 ? h('em', {}, ` ${IM.RES_ROMAN[r.tier]}`) : null),
              h('span', { class: 'res-bar' }, h('i', { style: `width:${nx ? Math.round(((r.n - lo) / (nx - lo)) * 100) : 100}%` })),
              h('small', {}, nx ? `${nx - r.n}개 더 → ${IM.RES_ROMAN[r.tier + 1]}` : '끝까지'));
          })) : null);
      };
      // v299 다음 할 일 — 지금 이 장비에서 할 수 있는 것 하나. 누르면 그 화면으로
      const nextStep = () => {
        const ims = it.imps || [];
        const rar = it.rar || 0;
        const marks = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0);
        let txt = null, go = null, cls = '', act = '';
        // v307 한 칸: 유니크부터 칸이 열린다 · 비었으면 새기기 · 등급이 오르면 그 칸이 세진다
        const filled = !!IM.normEntry(ims[0]);
        const hole = rar >= 1 && !filled ? 0 : null;
        const gradeKey = rar < W.RARITY.length - 1 ? marks.find((k) => game.canInfuse(it, k)) : null;
        const danI = filled && game.canDanUp(it, 0) ? 0 : null;
        if (hole != null && marks.some((k) => game.canFillImp(it, hole, k))) { txt = '각인 칸이 비었어요 — 증표로 새기기'; go = () => fillView(0); cls = 'hot'; }
        else if (gradeKey) { txt = `${W.RARITY[rar + 1].name}(으)로 등급 각인할 수 있어요 — ${filled ? `성공하면 각인이 ×${IM.IMP_RAR_W[rar]} → ×${IM.IMP_RAR_W[rar + 1]}로 세져요` : '성공하면 그 두목이 각인 칸에 새겨져요'}`; go = () => document.querySelector('#modal .inf-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); cls = 'hot'; }
        else if (danI != null) { const d = game.danInfo(it, 0); txt = `단 올리기 가능 (${short(d.key)} 증표 ${d.n}개)${IM.GS_DAN.includes(d.to) ? ` — ${d.to}단에서 大成!` : ''}`; go = () => slotView(0); cls = 'hot'; }
        else if (rar >= W.RARITY.length - 1 && filled) {
          const rs = game.resonance().top;
          const near = Object.values(game.resonance().by).filter((r) => r.next > 0).sort((a, b) => a.next - b.next)[0];
          txt = near ? `${IM.THEMES[near.theme].name} 기운 ${near.next}개 더 모으면 공명 ${IM.RES_ROMAN[near.tier + 1]} — 다른 장비도 같은 기운으로` : rs ? '증표가 모이면 칸 단을 올려요 — 두목 구역에서 두목을 잡아요' : '증표가 모이면 칸 단을 올려요';
          if (!near) { go = () => goWhere(bestMarkKey(game)); act = '두목 구역'; }
        } else if (hole != null) { txt = `각인 칸이 비었어요 — 두목 증표가 ${game.impMarksN(it)}개 있으면 새길 수 있어요`; go = () => goWhere(bestMarkKey(game)); act = '두목 구역'; }
        else if (rar < W.RARITY.length - 1) { txt = `${W.RARITY[rar + 1].name} 등급 각인에 두목 증표 ${W.INFUSE_MARKS[rar + 1]}개 — 두목 구역에서 두목을 잡아요`; go = () => goWhere(bestMarkKey(game)); act = '두목 구역'; }
        else { const d = filled ? game.danInfo(it, 0) : null; txt = d && !d.max ? `${short(d.key)} 증표 ${d.n}개 모으면 단을 올려요` : '증표가 모이면 단을 올려요'; if (d && !d.max) { go = () => goWhere(d.key); act = '가기'; } }
        return h(go ? 'button' : 'div', { class: `next-step ${cls}`, onclick: go || undefined }, h('i', {}, '▶'), h('span', {}, txt), go ? h('em', {}, act ? `${act} ›` : '›') : null);
      };
      // v299 ⓘ 각인이란? — 순서대로 넷
      const helpView = () => sub('각인은 이렇게 해요',
        h('button', { class: 'btn primary', style: 'width:100%;margin-bottom:8px', onclick: () => { closeModal(); openImprintGuide(app, () => openItem(it, worn)); } }, '🔎 원하는 능력은 어느 두목에게? — 각인 안내서'),
        h('div', { class: 'help-steps' },
          h('div', { class: 'help-step' }, h('b', {}, '① 두목을 잡아 증표를 모아요'), h('p', {}, '두목 구역·고수의 두목 방에서 두목을 잡으면 그 두목의 증표가 나와요. 센 두목 증표일수록 각인 효과가 커요.')),
          h('div', { class: 'help-step' }, h('b', {}, '② 등급 각인 — 레어 → 유니크 → 전설 → 신화'), h('p', {}, `증표 ${W.INFUSE_MARKS.slice(1).join('·')}개와 은자를 넣어요. 확률이 있고(센 두목 증표일수록 높아요), 실패하면 다음 확률이 쌓여서 언젠가는 돼요.`), h('p', {}, `장비마다 각인은 한 칸. 처음 유니크가 될 때 그 두목이 새겨져요: 기운 능력치 + 스킬 변화 + 각인력(공격력·체력 %). 레벨 100 넘는 두목은 고유 효과도. 전설·신화로 오르면 그 칸이 세져요(×${IM.IMP_RAR_W[1]} → ×${IM.IMP_RAR_W[2]} → ×${IM.IMP_RAR_W[3]}).`)),
          h('div', { class: 'help-step' }, h('b', {}, '③ 단(段) 올리기 — 1단 → 10단'), h('p', {}, '새겨진 칸에 같은 두목 증표를 더 넣으면 실패 없이 한 단씩 깊어져요. 10단이면 효과가 약 3.7배.'), h('p', { class: 'hl' }, '3·6·10단에서 大成 — 그 칸 효과 하나가 랜덤으로 ×2! 마음에 안 들면 \'다시 닦기\'로 1단부터 다시 노려요(증표 절반 환급).')),
          h('div', { class: 'help-step' }, h('b', {}, '④ 공명 — 같은 기운을 모아요'), h('p', {}, `끼고 있는 장비 여덟에서 같은 기운(독·검기·빙결…)을 ${IM.RES_NEED.join('·')}개 모으면 공명 Ⅰ~Ⅳ. 그 기운 효과가 +15·35·60·100%, 각인 배율도 +3·7·12·20%.`)),
          h('div', { class: 'help-step' }, h('b', {}, '✦ 운'), h('p', {}, `새길 때 ${pct(IM.QUAL_P[0], 0)}로 ★극품(각인력 ×1.5), ${pct(IM.QUAL_P[1], 1)}로 ★천품(×2 · 기운 ×1.5)이 떠요. 마음에 안 드는 칸은 '다른 두목으로 다시 새기기'로 바꿀 수 있어요(스킬 변화는 그대로, 단은 절반).`)),
          h('div', { class: 'help-step' }, h('b', {}, '⚙ 자동'), h('p', {}, '설정의 \'자동 등급 각인\'을 켜면 등급 각인과 단 올리기를 알아서 해요. 어떤 증표·효과를 좋아하는지 고를 수 있어요.'))));
      const impView = () => [resPanel(), nextStep(), slotTiles(), infuseBox()];
      const slotTiles = () => {
        // v307 장비마다 한 칸 — 등급(유니크 ×1.5 · 전설 ×2.5 · 신화 ×4)이 칸의 세기
        const ims = it.imps || [];
        return h('div', { class: 'slot-tiles one' }, ...[0].map((i) => {
          const im = IM.normEntry(ims[0]) ? IM.imprintOf(ims[0], it.rar || 1) : null;
          const rar = it.rar || 0;
          const locked = !im && rar < 1;
          const hole = !im && !locked;
          return h('button', { class: `slot-tile${im ? ' on' : ''}${locked ? ' locked' : ''}${hole ? ' hole' : ''}${im && im.d >= IM.DAN_MAX ? ' dan-max' : ''}${im?.q.id === 2 ? ' q2' : ''}`, style: im ? `--ic:${IM.THEMES[im.theme].col}` : '',
            onclick: () => (locked ? toast('유니크 등급이 되면 각인 칸이 열려요 — 아래 등급 각인') : hole ? fillView(0) : slotView(0)) },
          h('small', {}, rar >= 1 ? `각인 · ${W.RARITY[rar].name} ×${IM.IMP_RAR_W[rar]}` : '각인 · 유니크부터'),
          im ? h('b', {}, im.q.id ? h('i', { class: `st-q q${im.q.id}`, title: im.q.name }, `${im.q.mark} `) : null, im.boss) : h('b', {}, locked ? '🔒 잠김' : '＋ 새기기'),
          !im ? h('span', { class: 'st-note' }, locked ? '유니크가 되면' : `증표 ${game.impMarksN(it)}개로`) : null,
          im ? h('span', { class: `st-dan${im.d >= IM.DAN_MAX ? ' max' : im.d >= 5 ? ' hi' : ''}` }, IM.DAN_NAME(im.d), im.gs.length ? h('em', { class: 'st-gs' }, ` 大${im.gs.length}`) : null) : null,
          im ? h('span', { class: 'st-theme' }, IM.THEMES[im.theme].name) : null,
          im ? h('span', { class: 'st-chips' }, h('span', { class: 'st-skill', style: `--gc:${IM.SK_GRADE[im.skill.g].col}` }, `${IM.SKILL_NAME[im.skill.s]} ${SK_SHORT[im.skill.k]}`), im.special ? h('i', { class: 'st-sp' }, '고유') : null) : null,
          im && game.favOf(it.imps[i]) ? h('i', { class: 'st-fav' }, '♥') : null,
          im ? h('span', { class: 'st-roll' }, '🎲 다시 굴리기 · 단 올리기 ›') : null);   // v342 칸을 누르면 무엇을 하는지
        }));
      };
      // 새겨진 칸 자세히 — 효과 · 다시 굴리기(v342 맨 위로 · 크게) · 단 올리기 · 다시 새기기
      const slotView = (i) => {
        const im = IM.imprintOf(it.imps[i], it.rar || 1);
        const c = game.reimpCost(it, i);
        const can = game.canReimp(it, i);
        const dn = game.danInfo(it, i);
        const nxt = dn && !dn.max ? IM.imprintOf({ ...IM.normEntry(it.imps[i]), d: dn.to }, it.rar || 1) : null;
        sub(`각인 · ${im.boss}`,
          h('div', { class: 'sec-head' }, '지금 효과'),
          h('div', { class: 'imp-row', style: `--ic:${IM.THEMES[im.theme].col}` },
            h('b', {}, `${IM.THEMES[im.theme].name}의 기운 `, h('span', { class: `st-dan${im.d >= IM.DAN_MAX ? ' max' : im.d >= 5 ? ' hi' : ''}` }, IM.DAN_NAME(im.d)),
              im.q.id ? h('span', { class: `q-tag q${im.q.id}` }, ` ${im.q.mark} ${im.q.name}`) : null),
            h('div', { class: 'imp-core' }, `각인력 +${pct(im.core, 2)} (공격력·체력에 곱)${im.q.id ? ` · ${im.q.name} ×${im.q.core}` : ''}`),
            im.gs.length ? h('div', { class: 'imp-gs' }, `大成 — ${IM.gsText(it.imps[i])}`) : null,
            h('div', {}, Object.entries(im.fx).map(([k, v]) => IM.FX_TEXT[k](v)).join(' · ')),
            h('div', { class: 'imp-skill', style: `--gc:${IM.SK_GRADE[im.skill.g].col}` }, IM.skillModText(im.skill)),
            im.special ? h('div', { class: 'imp-sp' }, IM.specialText(im.special, im.wp)) : null),
          // ③ 바꾸기 — 스킬 변화 다시 굴리기 · 고유 효과 바꾸기 (한 번에 아래 값)
          h('div', { class: 'sec-head reroll-head' }, '🎲 스킬 변화 다시 굴리기', h('small', {}, ' 범위·두 번·숨·피해 중 하나가 새로 뽑혀요 · 두목·단은 그대로')),
          h('div', { class: 'chg-box reroll-box' },
          h('div', { class: 'reroll-now', style: `--gc:${IM.SK_GRADE[im.skill.g].col}` }, h('small', {}, '지금'), h('b', {}, IM.skillModText(im.skill)), h('em', {}, IM.SK_GRADE[im.skill.g].name)),
          // v347 새로 뽑힌 것은 후보 — 지금 것과 견주어 고른다(전엔 굴리자마자 덮어써 좋은 효과가 날아갔다)
          (() => {
            const cand = IM.normEntry(it.imps[i])?.cand;
            if (!cand) return null;
            const cs = IM.imprintOf({ ...IM.normEntry(it.imps[i]), ...cand, cand: undefined }, it.rar || 1).skill;
            const better = cs.g > im.skill.g ? '등급 ↑' : cs.g < im.skill.g ? '등급 ↓' : '같은 등급';
            return h('div', { class: 'reroll-cand', style: `--gc:${IM.SK_GRADE[cs.g].col}` },
              h('small', {}, `새로 뽑힌 것 · ${better}`), h('b', {}, IM.skillModText(cs)), h('em', {}, IM.SK_GRADE[cs.g].name),
              h('div', { class: 'btn-row', style: 'margin-top:8px' },
                h('button', { class: 'btn', id: 'reroll-drop', onclick: () => { game.dropReroll(it.uid, i); toast('지금 효과를 지켰어요'); app.save(); app.refresh(); slotView(i); } }, '지금 것 지키기'),
                h('button', { class: 'btn good', id: 'reroll-keep', onclick: () => { const p0 = game.power(); game.keepReroll(it.uid, i); toast(`새 효과로 바꿨어요 — ${IM.skillModText(cs)}${powNote(p0)}`); app.save(); app.refresh(); slotView(i); } }, '새 것으로 바꾸기')));
          })(),
          // v294 무엇이 좋아하는 것인지
          ...(() => { const f = game.favOf(it.imps[i]); return f ? [h('div', { class: 'pref-link', style: 'cursor:default' }, `♥ 좋아하는 효과 — ${[f.skill ? '스킬 변화' : '', f.special ? '고유 효과' : '', f.fx.length ? '테마 능력치' : ''].filter(Boolean).join(' · ')}`)] : []; })(),
          c ? h('div', { class: 'cost-chips' }, costChip(c.key, '증표', c.n, game.s.mats[c.key] || 0, matIcon(c.key, 24)), costChip(null, '은자', c.gold, game.s.gold, goldIco())) : null,
          h('button', { class: 'btn primary reroll-go', disabled: can ? null : true, onclick: () => {
            // v294 좋아하는 스킬 변화면 넘길지 묻는다(등급이 높을 때와 함께)
            const e = game.rerollImpSkill(it.uid, i);
            if (!e) return toast('증표·은자가 모자라요');
            const txt = IM.skillModText(IM.imprintOf(e, it.rar || 1).skill);
            toast(game.favOf(e)?.skill ? `♥ 좋아하는 스킬 변화가 나왔어요! — ${txt} (바꿀지 골라요)` : `새로 뽑혔어요 — ${txt} · 바꿀지 골라요`); app.save(); app.refresh(); slotView(i);
          } }, !can ? '🎲 다시 굴리기 — 증표·은자가 모자라요' : IM.normEntry(it.imps[i])?.cand ? '🎲 한 번 더 굴리기' : '🎲 다시 굴리기'),
          h('p', { class: 'muted', style: 'font-size:11.5px;margin:6px 0 0' }, '굴려도 지금 효과는 그대로예요 — 새로 뽑힌 것이 마음에 들 때만 바꿔요.'),
          im.specials ? h('div', { class: 'sp-pick' }, h('small', {}, '고유 효과 — 누르면 그것으로 (초록 테두리가 지금 것)'),
            ...im.specials.map((sp, j) => h('button', { class: `chip${sp.id === im.special.id ? ' on' : ''}`, disabled: sp.id === im.special.id || !can ? true : null, title: sp.id === im.special.id ? '지금 이것' : '', onclick: () => {
              const ps = game.s.autoInfCfg?.prefSp || [];
              if (ps.includes(im.special.kind) && !ps.includes(sp.kind) && !confirm(`♥ 지금 고유 효과 【${im.special.name}】는 좋아하는 효과예요.\n좋아하지 않는 【${sp.name}】(으)로 바꿀까요?`)) return;
              if (!(ps.includes(im.special.kind) && !ps.includes(sp.kind)) && !confirm(`고유 효과를 바꿔요\n지금 【${im.special.name}】 → 【${sp.name}】\n${c ? `증표 ${c.n} · 은자 ${fmt(c.gold)}이 들어요(다시 바꾸려면 또 들어요). ` : ''}바꿀까요?`)) return;
              if (!game.changeImpSpecial(it.uid, i, j)) return toast('증표·은자가 모자라요');
              toast(`고유 효과를 【${sp.name}】(으)로 바꿨어요`); app.save(); app.refresh(); slotView(i);
            } }, h('b', {}, sp.name), h('small', {}, ` ${IM.SPECIAL_KIND[sp.kind](im.wp)}`)))) : null),
          // v297 칸 단 — 같은 두목 증표로 확률 없이 한 단
          h('div', { class: 'sec-head' }, '단 올리기', h('small', {}, ` 같은 두목(${short(im.key)}) 증표로 · 실패 없음 · 3·6·10단에 大成 · 칸 세기 ×${IM.IMP_RAR_W[it.rar || 1]}(${W.RARITY[it.rar || 1].name})`)),
          h('div', { class: 'dan-box', style: `--ic:${IM.THEMES[im.theme].col}` },
            h('div', { class: 'dan-head' }, h('b', {}, IM.DAN_NAME(im.d)), h('span', { class: 'dan-pips' }, ...Array.from({ length: IM.DAN_MAX }, (_, j) => h('i', { class: `${j < im.d ? 'on' : ''}${IM.GS_DAN.includes(j + 1) ? ' gs' : ''}` })))),
            nxt ? h('small', { class: 'muted' }, `${IM.DAN_NAME(dn.to)}이 되면: 각인력 +${pct(nxt.core, 2)} · ${Object.entries(nxt.fx).map(([k, v]) => IM.FX_TEXT[k](v)).join(' · ')}`) : h('small', { class: 'muted' }, '극(極) — 이 칸은 끝까지 깊어졌어요'),
            nxt && IM.GS_DAN.includes(dn.to) ? h('div', { class: 'gs-note' }, `✦ ${dn.to}단에서 大成이 터져요 — 효과 하나가 ×2 (무엇이 될지는 운)`) : null,
            nxt ? h('div', { class: 'cost-chips' }, costChip(dn.key, '증표', dn.n, dn.have, matIcon(dn.key, 24)), costChip(null, '은자', dn.gold, game.s.gold, goldIco())) : null,
            nxt ? h('button', { class: 'btn good dan-go', disabled: game.canDanUp(it, i) ? null : true, onclick: () => {
              const p0 = game.power();
              const e = game.danUp(it.uid, i);
              if (!e) return toast('증표·은자가 모자라요');
              const gs = IM.GS_DAN.includes(e.d) ? e.gs[e.gs.length - 1] : null;
              toast(gs ? `✦ 大成! ${IM.GS_KIND[gs]} ×${IM.gsMult(e, gs)} — ${IM.DAN_NAME(e.d)}${powNote(p0)}` : `${ORD[i]} 칸 ${IM.DAN_NAME(e.d)}!${powNote(p0)}`); app.save(); app.refresh(); slotView(i);
            } }, `단 올리기 → ${IM.DAN_NAME(dn.to)}`) : null,
            // v298 다시 닦기 — 대성을 다시 노린다
            (() => { const rs = game.danResetInfo(it, i); return rs ? h('button', { class: 'btn dan-reset', onclick: () => {
              if (!confirm(`각인을 1단으로 되돌려요.${rs.gs.length ? `\n지금 大成(${IM.gsText(it.imps[i])})이 사라지고` : '\n'} 올리는 데 든 ${short(rs.key)} 증표 ${rs.back}개를 돌려받아요.\n다시 올리면 3·6·10단에서 大成을 새로 굴려요. 되돌릴까요?`)) return;
              game.danReset(it.uid, i); toast(`각인 1단으로 · ${short(rs.key)} 증표 +${rs.back}`); app.save(); app.refresh(); slotView(i);
            } }, `다시 닦기 (1단으로 · 증표 ${rs.back}개 환급)`) : null; })()),
          // ④ 다른 두목으로
          h('div', { class: 'sec-head' }, '다시 새기기', h('small', {}, ' 다른 두목으로 바꿔요 · 스킬 변화는 그대로 · 단은 절반')),
          h('button', { class: 'btn rewrite-go', onclick: () => rewriteView(i) }, '다른 두목으로 다시 새기기 ▸'));
      };
      // v297 다시 새기기 — 다른 두목 증표로 이 칸을 덮는다(스킬 변화는 그대로 · 단은 절반)
      let rwPick = null, rwSp = 0;
      const rewriteView = (i) => {
        const cur = IM.normEntry(it.imps[i]);
        const im = IM.imprintOf(cur, it.rar || 1);
        const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0 && k !== cur.k);
        if (!keys.includes(rwPick)) { rwPick = keys.sort((a, b) => W.markLv(b) - W.markLv(a)).find((k) => game.canRewrite(it, i, k)) || keys[0] || null; rwSp = 0; }
        const f = rwPick ? game.rewriteInfo(it, i, rwPick) : null;
        const nim = rwPick ? IM.imprintOf({ ...cur, k: rwPick, sp: rwSp, d: f?.keep || 1 }, it.rar || 1) : null;
        sub('각인 다시 새기기',
          h('p', { class: 'muted', style: 'font-size:12.5px' }, `지금: ${im.boss} ${IM.DAN_NAME(im.d)} · 각인력 +${pct(im.core, 2)}. 스킬 변화는 그대로 남고, 단은 절반(${IM.DAN_NAME(f?.keep || Math.max(1, Math.floor(im.d / 2)))})을 이어받아요.`),
          markRows(rwPick, (k) => { rwPick = k; rwSp = 0; rewriteView(i); }),
          rwPick ? spRows(rwPick, it.rar || 1, rwSp, (j) => { rwSp = j; rewriteView(i); }) : null,
          nim ? h('div', { class: 'imp-core', style: 'margin:6px 0' }, `새기면: 각인력 +${pct(nim.core, 2)} (지금 +${pct(im.core, 2)}) · ${IM.THEMES[nim.theme].name}의 기운`) : null,
          f ? h('div', { class: 'cost-chips' }, costChip(rwPick, '증표', f.n, f.have, matIcon(rwPick, 24)), costChip(null, '은자', f.gold, game.s.gold, goldIco())) : null,
          f ? h('button', { class: 'btn primary rw-go', disabled: game.canRewrite(it, i, rwPick) ? null : true, onclick: () => {
            const fav = game.favOf(it.imps[i]);
            if (!(fav?.special || fav?.fx?.length || im.d >= 4 || im.q.id || im.gs.length) && !confirm(`지금 ${im.boss} ${IM.DAN_NAME(im.d)}을(를) 지우고 ${short(rwPick)}(으)로 다시 새겨요.\n단은 ${IM.DAN_NAME(f.keep)}로 줄고, 고유 효과는 새 두목 것이 돼요(스킬 변화는 그대로).\n되돌릴 수 없어요. 다시 새길까요?`)) return;
            if ((fav?.special || fav?.fx?.length || im.d >= 4 || im.q.id || im.gs.length) && !confirm(`${fav ? '♥ 좋아하는 효과가 든 칸이에요.\n' : ''}${im.q.id ? `${im.q.mark} ${im.q.name} 각인이에요 — 품질은 새로 굴려요.\n` : ''}${im.gs.length ? `大成(${IM.gsText(it.imps[i])})이 사라져요.\n` : ''}지금 ${im.boss} ${IM.DAN_NAME(im.d)}을(를) 지우고 ${short(rwPick)}(으)로 새길까요? (단은 ${IM.DAN_NAME(f.keep)})`)) return;
            const p0 = game.power();
            const e = game.rewriteImp(it.uid, i, rwPick, rwSp);
            if (!e) return toast('증표·은자가 모자라요');
            toast(`${qualNote(e)}각인 — ${short(rwPick)}(으)로 다시 새겼어요${powNote(p0)}`); app.save(); app.refresh(); slotView(i);
          } }, '다시 새기기') : h('p', { class: 'muted' }, '다른 두목 증표가 없어요.'));
      };
      // 증표 고르기 목록 (등급 각인 · 빈 칸 새기기 함께)
      const markRows = (sel, onPick, info) => {
        // v294 좋아하는 효과가 있으면 그 점수 차례로(같으면 확률 → 개수)
        const pf = game.hasPrefs() ? Object.fromEntries(Object.keys(game.s.mats).map((k) => [k, W.isMarkKey(k) ? game.markPref(k).score : 0])) : null;
        const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0)
          .sort((a, b) => (pf ? pf[b] - pf[a] : 0) || (info ? info(b) - info(a) : 0) || game.s.mats[b] - game.s.mats[a]);
        if (!keys.length) return h('button', { class: 'next-step', onclick: () => goWhere(bestMarkKey(game)) }, h('i', {}, '▶'), h('span', {}, '두목 증표가 없어요 — 두목 구역·고수의 두목 방에서 두목을 잡으면 나와요'), h('em', {}, '두목 구역 ›'));
        return h('div', { class: 'mark-list' }, h('button', { class: 'pref-link', onclick: () => openAutoInfCfg(app, () => openItem(it, worn)) }, game.hasPrefs() ? '♥ 좋아하는 효과 차례로 · 바꾸기' : '♥ 좋아하는 효과를 정하면 그 차례로 보여요'), ...keys.map((k) => {
          const z = +k.slice(1);
          return h('button', { class: `mark-row${k === sel ? ' on' : ''}`, style: `--mc:${W.matColor(k)}`, onclick: () => onPick(k) },
            matIcon(k, 30), h('span', { class: 'mr-name' }, h('b', {}, short(k), pf && pf[k] > 0 ? h('em', { class: 'pref-heart' }, ' ♥') : ''), h('small', {}, `${IM.THEMES[IM.themeOfZone(z)].name}${IM.specialOfZone(z) ? ' · ★고유' : ''}`)),
            h('span', { class: 'mr-n' }, h('b', {}, fmt(game.s.mats[k])), info ? h('small', {}, pct(info(k), 0)) : null));
        }));
      };
      const spRows = (k, rar, sel, onPick) => {   // v307 rar: 미리 보기에 쓸 장비 등급
        const pv = k ? IM.imprintOf({ k, s: 0, sk: 'range', g: 0, sp: sel }, rar) : null;
        if (!pv) return null;
        const lo = IM.skillValue('cd', 0, pv.lv), hi = IM.skillValue('dmg', 3, pv.lv);
        return h('div', { class: 'imp-row preview', style: `--ic:${IM.THEMES[pv.theme].col}` },
          h('b', {}, `${pv.boss} · ${IM.THEMES[pv.theme].name}`),
          h('div', { class: 'imp-core' }, `각인력 +${pct(pv.core, 2)}`),
          h('div', {}, Object.entries(pv.fx).map(([kk, v]) => IM.FX_TEXT[kk](v)).join(' · ')),
          h('div', { class: 'muted' }, `스킬 변화는 새길 때 굴려요 (${pct(lo, 1)}~${pct(hi, 1)})`),
          pv.specials ? h('div', { class: 'sp-pick' }, h('small', {}, '고유 효과 — 하나를 골라요'),
            ...pv.specials.map((sp, j) => h('button', { class: `chip${j === sel ? ' on' : ''}`, onclick: () => onPick(j) }, h('b', {}, sp.name), h('small', {}, ` ${IM.SPECIAL_KIND[sp.kind](pv.w)}`)))) : null);
      };
      const markPicker = () => {
        const to = (it.rar || 0) + 1;
        sub(`등급 각인 → ${W.RARITY[to].name} · 증표 고르기`,
          markRows(markPick, (k) => { markPick = k; spPick = 0; markPicker(); }, (k) => game.infuseInfo(it, k)?.chance || 0),
          spRows(markPick, to, spPick, (j) => { spPick = j; markPicker(); }),
          h('button', { class: 'btn primary itm-done', onclick: () => paint() }, '이 증표로'));
      };
      const fillView = (i) => {
        const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0);
        if (!keys.includes(fillPick)) fillPick = keys.find((k) => game.canFillImp(it, i, k)) || keys[0] || null;
        const f = fillPick ? game.fillImpInfo(it, i, fillPick) : null;
        sub('각인 새기기 (확률 없음)',
          markRows(fillPick, (k) => { fillPick = k; fillSp = 0; fillView(i); }),
          spRows(fillPick, it.rar || 1, fillSp, (j) => { fillSp = j; fillView(i); }),
          f ? h('div', { class: 'cost-chips' }, costChip(fillPick, '증표', f.n, f.have, matIcon(fillPick, 24)), costChip(null, '은자', f.gold, game.s.gold, goldIco())) : null,
          f ? h('button', { class: 'btn primary fill-go', disabled: game.canFillImp(it, i, fillPick) ? null : true, onclick: () => {
            const p0 = game.power();
            const e = game.fillImp(it.uid, i, fillPick, fillSp);
            if (!e) return toast('증표·은자가 모자라요');
            const nim = IM.imprintOf(e, it.rar || 1);
            toast(`${qualNote(e)}각인 — ${nim?.boss || ''} · ${nim ? IM.skillModText(nim.skill) : ''}${powNote(p0)}`); app.save(); app.refresh(); paint();
          } }, '새기기') : null);
      };
      // 등급 각인 — 고른 증표 하나(눌러서 바꾸기) · 성공 막대 · 비용 칩 · 단추
      const infuseBox = () => {
        const to = (it.rar || 0) + 1;
        if (to >= W.RARITY.length) return h('div', { class: 'inf-box' }, h('div', { class: 'inf-head' }, h('b', {}, '등급 각인 '), h('small', {}, '신화 — 가장 높은 등급')));
        const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0)
          .sort((a, b) => game.infuseInfo(it, b).chance - game.infuseInfo(it, a).chance);
        if (!keys.includes(markPick)) markPick = keys.find((k) => game.canInfuse(it, k)) || keys[0] || null;
        const f = markPick ? game.infuseInfo(it, markPick) : null;
        const R = W.RARITY[to];
        const pv = markPick ? IM.imprintOf({ k: markPick, s: 0, sk: 'range', g: 0, sp: spPick }, to) : null;
        const filled = !!IM.normEntry(it.imps?.[0]);   // v307 이미 새겨져 있으면 등급만 오른다(칸이 세진다)
        return h('div', { class: 'inf-box' },
          h('div', { class: 'inf-head' }, h('b', {}, '등급 각인 '), h('b', { style: `color:${R.color}` }, `→ ${R.name}`), h('small', {}, ` 기본 수치 ×${(R.mult / W.RARITY[to - 1].mult).toFixed(2)}`)),
          h('small', { class: 'inf-why' }, filled ? `성공하면 각인 칸이 ×${IM.IMP_RAR_W[to - 1]} → ×${IM.IMP_RAR_W[to]}로 세져요(새겨진 두목은 그대로 · 증표는 아무 두목 것이나) · 실패해도 다음 확률이 쌓여요` : '성공하면 고른 두목이 각인 칸에 새겨져요 · 실패해도 다음 확률이 쌓여요'),
          markPick ? h('div', { class: 'mark-pick-wrap' }, h('div', { class: 'mark-pick', style: `--mc:${W.matColor(markPick)}`, onclick: () => markPicker() },
            matIcon(markPick, 30), h('span', { class: 'mr-name' }, h('b', {}, short(markPick)), h('small', {}, `${IM.THEMES[IM.themeOfZone(+markPick.slice(1))].name}${pv?.specials ? ` · ★${pv.specials[spPick]?.name || ''}` : ''}`)),
            h('span', { class: 'mp-change' }, '바꾸기 ▸'))) : h('button', { class: 'next-step', onclick: () => goWhere(bestMarkKey(game)) }, h('i', {}, '▶'), h('span', {}, '두목 증표가 없어요 — 두목을 잡으면 나와요'), h('em', {}, '두목 구역 ›')),
          f ? rateBar(f.chance) : null,
          f ? h('div', { class: 'enh-meta' }, h('span', {}, `성공 ${pct(f.chance, 0)}`), it.pity ? h('span', {}, `쌓인 확률 +${pct(it.pity, 0)}p`) : null) : null,
          f ? h('div', { class: 'cost-chips' }, costChip(markPick, '증표', f.n, f.have, matIcon(markPick, 24)), costChip(null, '은자', f.gold, game.s.gold, goldIco())) : null,
          f ? h('button', { class: 'btn primary', disabled: game.canInfuse(it, markPick) ? null : true, onclick: () => runInfuse() }, `각인 (${pct(f.chance, 0)})`) : null);
      };
      const runInfuse = () => {
        const bar = h('i');
        s.replaceChildren(
          h('div', { class: 'enh-anim inf' },
            h('div', { class: 'enh-anvil' }, h('div', { class: 'enh-item', style: `--gc:${W.RARITY[Math.min(3, (it.rar || 0) + 1)].color}` }, itemTitle(game, it)), h('div', { class: 'enh-sparks' })),
            h('div', { class: 'enh-anim-text' }, `${W.matName(markPick)}를 새기는 중…`),
            h('div', { class: 'enh-bar' }, bar),
            h('small', { class: 'enh-skip' }, '눌러서 건너뛰기')));
        bar.style.animationDuration = '1.6s';
        afterAnim(s, skipFx() ? 0 : 1.6, () => {
          const p0 = game.power();
          const ok = game.infuse(it.uid, markPick, spPick);
          app.save(); app.refresh();
          const kept = !!game.lastInfuse?.kept;
          const nim = ok ? IM.imprintOf(it.imps[0], it.rar) : null;
          const msg = ok ? `${kept ? '' : qualNote(it.imps[0])}각인 성공! ${W.RARITY[it.rar].name} — ${kept ? `각인 칸이 ×${IM.IMP_RAR_W[it.rar]}로 세졌어요` : nim ? IM.skillModText(nim.skill) : optLines(it).join(' / ')}${powNote(p0)}` : `각인 실패 — 다음 확률 +${pct(it.pity || 0, 0)}p`;
          s.replaceChildren(
            h('div', { class: `enh-anim result ${ok ? 'ok' : 'fail'}` },
              h('div', { class: 'enh-anvil' }, h('div', { class: 'enh-item', style: `--gc:${gradeOf(it).color}` }, itemTitle(game, it))),
              h('div', { class: 'enh-anim-text' }, msg)),
            h('div', { class: 'btn-row' },
              game.infuseInfo(it, markPick) && game.canInfuse(it, markPick) ? h('button', { class: 'btn good', onclick: () => runInfuse() }, '한 번 더') : null,
              h('button', { class: 'btn', onclick: () => paint() }, '돌아가기')));
          toast(msg);
        });
      };
      // ---- 강화 (v152 · v192): 떨어질 수 있으면 묻고(+11부터는 붉게), 2초 연출 뒤 결과 ----
      const askEnhance = () => {
        if (!game.canEnhance(it)) return toast('은자나 재료가 모자라요');
        const lv = it.plus || 0;
        const rate = game.enhanceRateOf(it);
        // v254: 세트·왕의 장비는 공유 강화 아래로는 안 떨어진다 — 묻는 글도 실제 하락만큼
        const fail = W.enhanceFail(lv) ? Math.max(game.sharedPlus(it), Math.max(0, lv + W.enhanceFail(lv))) - lv : 0;
        if (rate >= 1) return runEnhance(0.9);
        const breakRisk = W.enhanceRisky(lv);
        const prot = (game.s.prot || 0) > 0 && useProt;
        if (!fail) return runEnhance(rate >= 0.9 ? 0.9 : 1.4);       // 실패해도 그대로면 묻지 않는다
        s.replaceChildren(...[
          h('h2', { class: breakRisk && !prot ? 'enh-warn-title' : '' }, breakRisk && !prot ? `⚠ 실패하면 ${fail}` : '강화할까요?'),
          h('div', { class: `enh-ask${breakRisk ? ' danger' : ''}` },
            h('div', { class: 'enh-ask-item', style: `color:${gradeOf(it).color}` }, itemTitle(game, it), ` → +${lv + 1}`),
            h('div', { class: 'enh-ask-rate' }, '성공 ', h('b', {}, pct(rate, 0)), ' · 실패 ', h('b', {}, pct(1 - rate, 0))),
            h('p', {}, breakRisk && prot
              ? `실패하면 강화 보호부 1장을 태워 그대로(+${lv}). 남은 보호부 ${game.s.prot}장.`
              : `실패하면 ${fail} (+${Math.max(0, lv + fail)})${breakRisk ? (game.s.prot ? ' — 보호부를 안 쓰기로 했어요' : ' — 보호부가 있으면 그대로예요(상인)') : ''}. 대신 다음 확률이 +${pct(game.enhanceBaseRate(it) * W.ENH_PITY_K, 0)}p 쌓여요.`)),
          h('div', { class: 'btn-row' },
            h('button', { class: `btn ${breakRisk && !prot ? 'danger' : 'good'}`, onclick: () => runEnhance(2) }, '강화한다'),
            h('button', { class: 'btn', onclick: () => paint() }, '그만두기')),
        ]);
      };
      const runEnhance = (sec) => {
        const lv = it.plus || 0;
        const bar = h('i');
        s.replaceChildren(
          h('div', { class: 'enh-anim' },
            h('div', { class: 'enh-anvil' }, h('div', { class: 'enh-item', style: `--gc:${gradeOf(it).color}` }, itemTitle(game, it)), h('div', { class: 'enh-sparks' })),
            h('div', { class: 'enh-anim-text' }, `+${lv} → +${lv + 1} 두드리는 중…`),
            h('div', { class: 'enh-bar' }, bar),
            h('small', { class: 'enh-skip' }, '눌러서 건너뛰기')));
        bar.style.animationDuration = `${sec}s`;
        // v200: 눌러서 건너뛰기 · 설정에서 연출 건너뛰기를 켜면 바로 결과
        afterAnim(s, skipFx() ? 0 : sec, () => {
          const ok = game.enhance(it.uid, useProt);
          const r = game.lastEnhance || {};
          app.save(); app.refresh();
          if (r.reset) r.broke = false;
          const kind = ok ? 'ok' : r.broke || r.reset ? 'broke' : 'fail';
          const pity = r.pity ? ` · 다음 확률 ${pct(game.enhanceRateOf(it), 0)}` : '';
          const msg = ok ? `강화 성공! +${it.plus}` : r.prot ? `실패 — 보호부가 지켜 줬어요 (+${it.plus})${pity}` : r.drop ? `실패… ${r.drop} (+${it.plus})${pity}` : `실패 (그대로)${pity}`;
          s.replaceChildren(
            h('div', { class: `enh-anim result ${kind}` },
              h('div', { class: 'enh-anvil' }, h('div', { class: 'enh-item', style: `--gc:${gradeOf(it).color}` }, r.broke ? '💥' : itemTitle(game, it))),
              h('div', { class: 'enh-anim-text' }, msg)),
            h('div', { class: 'btn-row' },
              !r.broke && game.canEnhance(it) ? h('button', { class: 'btn good', onclick: () => askEnhance() }, '한 번 더') : null,
              h('button', { class: 'btn', onclick: () => (r.broke ? closeModal() : paint()) }, r.broke ? '닫기' : '돌아가기')));
          toast(msg);
        });
      };
      paint();
    });
  }
  // 낀 것과 견준 세기 (같은 칸 점수의 몇 %)
  // v318 전투력으로 — 그 칸에 끼워 본 온 능력치(세트·공명·각인 모두)의 전투력이 지금보다 몇 % 오르나. 장비 창 '끼면 →'과 같은 값
  const vsWorn = (it) => {
    const p = game.previewEquip(it);
    if (p.same) return 0;
    return p.then.power / (p.now.power || 1) - 1;
  };
  const deltaTag = (d) => (Math.abs(d) < 0.005 ? h('span', { class: 'delta same' }, '같음')
    : h('span', { class: `delta ${d > 0 ? 'up' : 'down'}` }, `${d > 0 ? '▲' : '▼'} ${pct(Math.abs(d), 0)}`));

  // ===== 장비 =====
  const gearRoot = h('div');
  const bagRoot = h('div');
  // v385 골라 팔기 — 하나하나 눌러 팔지 않고 여러 개를 골라 한 번에
  const pick = { on: false, sel: new Set() };
  function pickBar(list, old) {
    const s = game.s;
    const chosen = s.bag.filter((it) => pick.sel.has(it.uid));
    const gold = chosen.reduce((a, it) => a + game.sellValue(it), 0);
    const add = (arr) => { for (const it of arr) if (!it.grow) pick.sel.add(it.uid); sigs.gear = ''; gearView(); };
    const shown = list.map((x) => x.it);
    return h('div', { class: 'pick-bar' },
      h('div', { class: 'pick-head' }, h('b', {}, `${chosen.length}개 골랐어요`), h('span', {}, `은자 +${fmt(gold)}`)),
      h('div', { class: 'chip-row' },
        h('button', { class: 'chip', onclick: () => add(old) }, `▼ 약한 것 ${old.length}`),
        h('button', { class: 'chip', onclick: () => add(shown.filter((it) => !(it.rar >= 1) && !it.plus && !it.set)) }, '레어만'),
        h('button', { class: 'chip', onclick: () => add(shown.filter((it) => !(it.rar >= 2) && !it.set)) }, '유니크 이하'),
        h('button', { class: 'chip', onclick: () => add(shown) }, '보이는 것 모두'),
        h('button', { class: 'chip', onclick: () => { pick.sel.clear(); sigs.gear = ''; gearView(); } }, '모두 풀기')),
      h('small', { class: 'muted' }, '장비를 눌러 고르고 풀어요 · 위 칸(무기·옷…)으로 거르면 그 칸에서만'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', id: 'pick-go', disabled: chosen.length ? null : true, onclick: () => {
          const risky = chosen.filter((it) => it.plus || it.rar >= 2 || it.set || it.imps?.some(Boolean));
          const by = {}; for (const it of chosen) { const r = W.RARITY[it.rar || 0].name; by[r] = (by[r] || 0) + 1; }
          if (!confirm(`${chosen.length}개를 팔아요 (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}) · 은자 +${fmt(gold)}${risky.length ? `\n⚠ 강화·전설 이상·세트·각인한 장비 ${risky.length}개가 들어 있어요.` : ''}\n판 장비는 되돌릴 수 없어요.`)) return;
          const r = game.sellMany([...pick.sel]);
          pick.sel.clear(); pick.on = false;
          toast(`${r.n}개를 팔아 은자 +${fmt(r.gold)}`); done();
        } }, `팔기 ${chosen.length}`),
        h('button', { class: 'btn', onclick: () => { pick.on = false; pick.sel.clear(); sigs.gear = ''; gearView(); } }, '그만')));
  }
  function gearView() {
    const s = game.s;
    // v256: 등급(rar)·각인 칸 수도 — 가방 속 장비를 각인으로 올려도 타일 색·등급이 그대로였다
    const nsig = `${game.statSig()}|${s.skillPts}|${s.bag.map((i) => `${i.uid}.${i.plus || 0}.${i.rar || 0}.${(i.imps || []).filter(Boolean).length}`).join(',')}|${s.bagSize}|${ui.slot}|${s.autoJunk ? 1 : 0}.${s.junkLog?.n || 0}|${s.gold >= game.bagUpgradeCost()}|${pick.on ? [...pick.sel].join('.') : 'x'}|${(() => { const t = game.upgradeTip(); return t ? `${t.kind}.${t.slot}.${t.gain.toFixed(3)}` : '-'; })()}|${s.autoEnh ? 1 : 0}${s.autoInf ? 1 : 0}.${JSON.stringify(s.autoEnhCfg || 0)}.${JSON.stringify(s.autoInfCfg || 0).length}`;   // v371 자동 설정이 바뀌면 다시
    if (nsig === sigs.gear) return;
    sigs.gear = nsig;
    // 낀 여섯 칸 — 셋씩 두 줄
    const tiles = W.SLOTS.map((sl) => {
      const it = s.equip[sl.id];
      if (!it) return skinImg(h('div', { class: 'gear-tile empty' }, h('small', {}, sl.name), h('b', {}, '비어 있음')), `slot-${sl.id}`);
      const g = gradeOf(it);
      return skinImg(h('button', { class: `gear-tile${it.rar === 3 ? ' mythic' : ''}${it.set ? ' set' : ''}`, style: `--gc:${g.color}${it.set ? `;--sc:${G.setOf(it.set).col}` : ''}`, onclick: () => openItem(it, true),
        title: itemHover(game, it), oncontextmenu: (e) => itemMenu(e, it, true) },
        h('small', {}, `${sl.name} · ${g.name}${it.set ? ' · 세트' : ''}`),
        h('b', {}, itemTitle(game, it)),
        h('span', {}, itemLines(game, it).split(' · ').slice(0, 2).join(' · '))), `slot-${sl.id}`);
    });
    // 가방 — 칸 거르기
    const counts = {};
    for (const it of s.bag) counts[it.slot] = (counts[it.slot] || 0) + 1;
    const chips = h('div', { class: 'chip-row' }, ...[['all', `전체 ${s.bag.length}`], ...W.SLOTS.map((x) => [x.id, `${SLOT_SHORT[x.id]} ${counts[x.id] || 0}`])].map(([k, label]) =>
      h('button', { class: `chip${ui.slot === k ? ' on' : ''}`, onclick: () => { ui.slot = k; keepUi(); sigs.gear = ''; gearView(); } }, label)));
    const list = s.bag.filter((it) => ui.slot === 'all' || it.slot === ui.slot)
      .map((it) => ({ it, d: vsWorn(it) }))
      .sort((a, b) => (b.d > 0.005) - (a.d > 0.005) || b.d - a.d || game.itemScore(b.it) - game.itemScore(a.it));
    // v230: 글 줄 대신 그림 칸 넷씩 — 누르면 자세히(끼기·팔기·강화)
    for (const u of [...pick.sel]) if (!s.bag.some((x) => x.uid === u)) pick.sel.delete(u);   // 판 것·낀 것은 빼기
    const cards = list.map(({ it, d }) => {
      // v385 골라 팔기 — 누르면 고르기/풀기
      if (!pick.on) return itemTile(game, it, d, () => openItem(it, false), (e) => itemMenu(e, it, false));
      const t = itemTile(game, it, d, () => { if (it.grow) { toast('성장 장비는 팔 수 없어요'); return; } pick.sel.has(it.uid) ? pick.sel.delete(it.uid) : pick.sel.add(it.uid); sigs.gear = ''; gearView(); }, (e) => e.preventDefault());
      t.classList.add('pickable'); if (pick.sel.has(it.uid)) t.classList.add('picked'); if (it.grow) t.classList.add('nosell');
      if (pick.sel.has(it.uid)) t.append(h('i', { class: 'inv-check' }, '✓'));
      return t;
    });
    const better = list.filter((x) => x.d > 0.005);
    // v256: 성장 장비는 팔지 않으니(sell → 0) 세지 않는다 — '+0 은자' 토스트만 되풀이됐다
    const old = s.bag.filter((x) => !x.grow && s.equip[x.slot] && game.itemScore(x) < game.itemScore(s.equip[x.slot]) && !x.plus && !(x.rar >= 2));
    const setNow = Object.entries(game.setCounts()).map(([id, n]) => ({ st: G.setOf(id), n })).filter((x) => x.st);
    // v150: 착용 | 가방을 칸으로 나눴다 — 한 화면에 낀 것·세트·가방·버튼이 다 있어 복잡했다
    gearRoot.replaceChildren(...[
      h('div', { class: 'card' }, h('h3', {}, '끼고 있는 것', h('small', {}, `전투력 ${fmt(game.stats().power)} · 눌러서 강화·승급`)),
        // v403 지금 뭘 올리면 제일 세지나 — 누르면 그 장비의 그 칸
        // v411 무공 점수는 전투력에 안 잡혀 따로 — 남았으면 한 줄
        s.skillPts > 0 && game.skillList().some((k) => game.canSkillUp(k.id)) ? h('button', { class: 'up-tip', id: 'up-tip-skill', onclick: () => app.showTab('char', 'skill') }, h('span', {}, '💡 '), h('b', {}, `무공 점수 ${s.skillPts}점`), h('span', {}, ' 남았어요 — 무공을 올려요'), h('i', {}, ' ›')) : '',
        (() => {
          const t = game.upgradeTip();
          if (!t) return '';
          const it = s.equip[t.slot];
          return h('button', { class: 'up-tip', id: 'up-tip', onclick: () => { game.mark?.('upTip'); if (it) openItem(it, true, t.kind === 'imp' ? 'imp' : 'enh'); } },
            h('span', {}, '💡 지금 올리면 가장 세져요: '), h('b', {}, t.name),
            h('span', {}, ` 전투력 +${(t.gain * 100).toFixed(t.gain < 0.01 ? 2 : 1)}%${t.p < 1 ? ` · 성공 ${Math.round(t.p * 100)}%(기대 +${(t.ev * 100).toFixed(t.ev < 0.01 ? 2 : 1)}%)` : ''} · 은자 ${fmt(t.cost)}`), h('i', {}, ' ›'));
        })(),
        h('div', { class: 'gear-grid' }, ...tiles),
        // v262 자동 강화·등급 각인
        h('div', { class: 'auto-gear' },
          h('div', { class: 'auto-inf-line' },
            h('label', {}, h('input', { type: 'checkbox', checked: s.autoEnh ? true : null, onchange: (e) => { game.s.autoEnh = e.target.checked; app.save(); if (e.target.checked) openAutoEnhCfg(app); } }), ' 자동 강화',
              h('small', {}, ` 낮은 칸부터 +${s.autoEnhCfg?.max || W.AUTO_ENH_MAX}까지`, Object.values(s.autoEnhCfg?.slots || {}).some((v) => v === false) ? ` · ${W.GROW_SLOTS.filter((k) => s.autoEnhCfg.slots[k] !== false).length}칸만` : '', s.autoEnhCfg?.keep ? ` · 은자 ${s.autoEnhCfg.keep}% 남김` : '', ` · 돌파(+${W.AUTO_ENH_MAX + 1}~)는 직접`)),
            h('button', { class: 'btn', id: 'auto-enh-cfg', style: 'padding:4px 10px;font-size:12px', onclick: () => openAutoEnhCfg(app) }, '설정')),
          h('div', { class: 'auto-inf-line' },
            h('label', {}, h('input', { type: 'checkbox', checked: s.autoInf ? true : null, onchange: (e) => { game.s.autoInf = e.target.checked; app.save(); if (e.target.checked) openAutoInfCfg(app); } }), ' 자동 등급 각인',
              h('small', {}, s.autoInfCfg?.mode === 'theme' ? ' 각인 칸에서 고른 기운대로' : s.autoInfCfg?.mode === 'pref' ? ` 좋아하는 효과 ${(s.autoInfCfg.prefFx || []).length + (s.autoInfCfg.prefSp || []).length}가지로` : s.autoInfCfg?.mode === 'pick' || s.autoInfCfg?.only ? ` 고른 증표 ${Object.keys(s.autoInfCfg.marks).length}가지만` : ' 센 증표부터', Object.values(s.autoInfCfg?.slots || {}).some((v) => v === false) ? ` · ${W.GROW_SLOTS.filter((k) => s.autoInfCfg.slots[k] !== false).length}칸만` : '', ' · 돌파용 증표는 남겨요')),
            h('button', { class: 'btn', style: 'padding:4px 10px;font-size:12px', id: 'auto-inf-cfg', onclick: () => openAutoInfCfg(app) }, '설정')))),
      ...setNow.map(({ st }) => setBox(game, st)),
    ].filter(Boolean));
    bagRoot.replaceChildren(...[
      h('div', { class: 'card' },
        h('h3', {}, '가방', h('small', {}, `${s.bag.length} / ${s.bagSize} · 넘치면 가장 나쁜 것부터 팔아요`)),
        chips,
        pick.on ? pickBar(list, old) : h('button', { class: 'btn pick-top', id: 'pick-sell-top', disabled: s.bag.length ? null : true, onclick: () => { pick.on = true; pick.sel.clear(); game.mark('pickSell'); sigs.gear = ''; gearView(); toast('장비를 눌러 고르세요 — 여러 개를 한 번에 팔아요'); } }, '☑ 골라 팔기 — 여러 개를 한 번에'),   // v398 맨 아래에만 있어 못 찾았다
        !pick.on && better.length ? h('button', { class: 'btn primary', style: 'width:100%;margin:6px 0', onclick: () => {
          let n = 0;
          // v258: 세트 조각을 세트 아닌 것으로 바꾸면 세트 효과가 깨진다 — 그런 것은 건너뛰고 알린다
          let kept = 0;
          for (const { it } of better) { const cur = s.equip[it.slot]; if (cur?.set && it.set !== cur.set) { kept++; continue; } if (vsWorn(it) > 0.005) { game.equipFromBag(it.uid); n++; } }   // v318 하나 낄 때마다 다시 견준다(전투력)
          toast(`더 좋은 장비 ${n}개를 꼈어요${kept ? ` · 세트가 깨지는 ${kept}개는 남겼어요(눌러서 직접 낄 수 있어요)` : ''}`); done();
        } }, `▲ 더 좋은 것 모두 끼기 (${better.length})`) : null,
        cards.length ? h('div', { class: 'inv-grid' }, ...cards) : h('p', { class: 'muted' }, ui.slot === 'all' ? '가방이 비었어요. 대장장이가 만든 장비는 낀 것보다 좋으면 바로 껴요.' : '이 칸 장비가 가방에 없어요.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', disabled: old.length ? null : true, onclick: () => {
            // v348 무엇을 파는지 먼저 — 등급별 몇 개
            const by = {}; for (const it of old) { const r = W.RARITY[it.rar || 0].name; by[r] = (by[r] || 0) + 1; }
            if (!confirm(`약한 장비 ${old.length}개를 팔아요 (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}).\n강화한 것·전설 이상·각인한 것은 남겨요. 판 장비는 되돌릴 수 없어요.`)) return;
            let p = 0, n = 0;
            for (const it of old) { const g = game.sell(it); if (g > 0 || !s.bag.includes(it)) { p += g; n++; } }
            toast(`약한 장비 ${n}개를 팔아 은자 +${fmt(p)} (강화·전설 이상은 남겨요)`);
            done();
          } }, `약한 것 팔기${old.length ? ` ${old.length}` : ''}`),
          h('button', { class: 'btn', id: 'pick-sell', disabled: s.bag.length ? null : true, onclick: () => { pick.on = true; pick.sel.clear(); game.mark('pickSell'); sigs.gear = ''; gearView(); } }, '☑ 골라 팔기'),
          // v321 자동 정리 — 같은 잣대로 떨어지는 대로 판다
          h('label', { class: 'btn junk-toggle', title: '낀 것보다 못하고·강화 안 했고·전설 아래인 장비는 떨어지는 대로 팔아요' },
            h('input', { type: 'checkbox', checked: s.autoJunk ? true : null, onchange: (e) => { game.s.autoJunk = e.target.checked; if (e.target.checked && old.length) { let p = 0; for (const it of old) p += game.sell(it); toast(`자동 정리를 켰어요 — 가방의 약한 장비 ${old.length}개도 팔았어요 · 은자 +${fmt(p)}`); } else toast(e.target.checked ? '자동 정리를 켰어요' : '자동 정리를 껐어요'); done(); } }),
            ` 자동 정리${s.autoJunk && s.junkLog?.n ? ` · ${fmt(s.junkLog.n)}개` : ''}`),
          h('button', { class: 'btn', disabled: game.s.gold < game.bagUpgradeCost() || s.bagSize >= 80 ? true : null, onclick: () => { if (game.buyBagSpace()) { toast('가방이 10칸 넓어졌어요'); done(); } } },
            s.bagSize >= 80 ? '가방 끝까지' : `+10칸 · ${fmt(game.bagUpgradeCost())}`)))].filter(Boolean));
  }

  // ===== 대장장이 =====
  const smithRoot = h('div');
  // key를 주면 누를 수 있다 — 모자란 걸 보고 바로 '어디서 나오지?'가 풀린다.
  // 모자란 걸 보고도 어디로 가야 할지 몰라 지도를 뒤지다 포기하던 자리다.
  function need(label, have, want, color, key) {
    const ok = have >= want;
    const cls = `need${ok ? ' ok' : ''}${key ? ' tap' : ''}`;
    const body = [label, ' ', h('b', {}, `${fmt(Math.min(have, want))}/${fmt(want)}`)];
    if (!key) return h('span', { class: cls, style: color ? `--mc:${color}` : '' }, ...body);
    return h('button', { class: cls, style: color ? `--mc:${color}` : '', onclick: () => openMatWhere(app, key) }, ...body);
  }
  function smithView() {
    const s = game.s;
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid + '.' + (i.plus || 0) + '.' + (i.rar || 0)).join(',')}|${JSON.stringify(s.mats)}|${goldSig(game, 'smith')}|${ui.smode}|${ui.kz}|${ui.kslot}|${s.level}`;
    if (nsig === sigs.smith) return;
    sigs.smith = nsig;
    // v158: 성장 장비(레벨 따라 · 100까지) | 세트(100~ · 직업 세트) | 왕의 장신구(100~ · 공용)
    if (!['ladder', 'set', 'kacc'].includes(ui.smode)) ui.smode = 'ladder';
    const modes = h('div', { class: 'seg wide smith-seg' }, ...[['ladder', `성장 장비 ~${W.ILV_CAP}`], ['set', '세트 100~'], ['kacc', '장신구 100~']].map(([k, label]) =>
      h('button', { class: ui.smode === k ? 'on' : '', onclick: () => { ui.smode = k; keepUi(); sigs.smith = ''; smithView(); } }, label)));
    if (ui.smode === 'set') return setSmith(modes);
    if (ui.smode === 'kacc') return kaccSmith(modes);
    // 칸마다 성장 장비 하나 — 누르면 강화·등급 각인
    const marks = Object.keys(s.mats).filter((k) => W.isMarkKey(k) && s.mats[k] > 0);
    const rows = W.GROW_SLOTS.map((sl) => {
      const it = game.growOf(sl);
      if (!it) return null;
      const worn = s.equip[sl] === it;
      const g = gradeOf(it);
      const canInf = marks.some((k) => game.canInfuse(it, k));
      // v230: 글 줄 대신 그림 카드 둘씩 — 할 수 있는 것은 초록 딱지로
      const canE = game.canEnhance(it);
      return h('button', { class: `grow-card${canInf || canE ? ' ready' : ''}`, style: `--gc:${g.color}`, onclick: () => openItem(it, worn), title: itemHover(game, it), oncontextmenu: (e) => itemMenu(e, it, worn) },
        h('div', { class: 'gc-top' }, itemIcon(it, 50),
          h('div', { class: 'gc-txt' },
            h('small', {}, `${SLOT_SHORT[it.slot]} · ${g.name}`),
            h('b', {}, itemTitle(game, it)),
            h('small', {}, `Lv.${it.ilv}${worn ? '' : ' · 가방'}`))),
        h('div', { class: 'gc-stat' }, itemLines(game, it).split(' · ')[0]),
        h('div', { class: 'gc-tags' },
          canE ? h('span', { class: 'ok' }, '강화') : h('span', {}, '강화'),
          canInf ? h('span', { class: 'ok' }, '각인') : h('span', {}, '각인'),
          it.pity ? h('span', { class: 'pity' }, `천장 +${pct(it.pity, 0)}p`) : null));
    }).filter(Boolean);
    const markRow = marks.length ? h('div', { class: 'mat-row' }, ...marks.sort((a, b) => W.markLv(b) - W.markLv(a)).map((k) => matChip(app, k, W.matName(k), s.mats[k]))) : null;
    smithRoot.replaceChildren(modes,
      h('div', { class: 'card' },
        h('h3', {}, '성장 장비', h('small', {}, `레벨을 따라 자란다 · ${W.ILV_CAP}까지`)),
        h('details', { class: 'smith-help' }, h('summary', {}, '도움말'),
          h('p', {}, `무기·옷·모자·장갑·신발·장신구는 칸마다 하나 — 만들지 않아요. 아이템 레벨이 내 레벨을 따라 오르고(${W.ILV_CAP}까지), 칸마다 그 레벨 지역의 고유 옵션이 붙어요.`),
          h('p', {}, '강화: 그 레벨 지역 재료 + 은자. +7까지는 실패해도 그대로, +8~10은 -1, +11부터 -2(보호부를 쓰면 그대로). 실패할수록 다음 확률이 올라요(천장). 장비는 사라지지 않아요.'),
          h('p', {}, `등급 각인: 어느 두목의 증표든 넣어 레어→유니크→전설→신화. 센 두목의 증표일수록 잘 붙고(×${W.INFUSE_F_MIN}~×${W.INFUSE_F_MAX}), 실패하면 다음 확률이 쌓여 언젠가는 반드시 붙어요. 오르면 등급 옵션이 새로 붙어요.`),
          h('p', {}, `${W.ILV_CAP}부터는 세트·왕의 장비를 만들어요.`)),
        marks.length ? h('small', { class: 'muted' }, '가진 두목 증표 — 등급 각인에 넣어요 (센 두목 것일수록 잘 붙어요)') : h('p', { class: 'muted' }, '두목 증표가 없어요 — 두목 구역·고수의 두목 방에서 모아요.'),
        markRow),
      h('div', { class: 'grow-grid' }, ...rows));
  }

  // ----- 세트 (레벨 99부터) -----
  function kingNeeds(r) {
    const parts = [];
    for (const [k0, n0] of Object.entries(r.mats)) { const { key: k, n } = W.oreOf(k0, n0); parts.push(need(W.matName(k), s0().mats[k] || 0, n, W.matColor(k), k)); }   // v273 지역 재료는 현철로
    parts.push(need('은자', s0().gold, r.gold));
    return parts;
  }
  const s0 = () => game.s;
  function setSmith(modes) {
    const s = game.s;
    // 직업 세트 둘 + 맹주·천마 세트 셋(모든 직업, v153)
    const sets = [...G.setsOfJob(s.job), ...G.LORD_SETS];
    const cards = sets.map((st) => {
      const rows = G.SET_SLOTS.map((sl) => {
        const c = game.setCheck(st.id, sl);
        const sample = game.makeKing(sl, G.SLOT_KING[sl], 0, st.id);
        const d = vsWorn(sample);
        const worn = s.equip[sl]?.set === st.id;
        return h('div', { class: `row craft-row${c.ok ? ' ready' : ''}` },
          h('div', { class: 'info' },
            h('div', { class: 'name' }, itemTitle(game, sample), ' ', worn ? h('span', { class: 'delta same' }, '끼는 중') : deltaTag(d), h('small', {}, `Lv.${G.KING_ILV} · ${SLOT_SHORT[sl]} · ${st.lord ? `${MS.masterOf(G.LORD_MATS[st.lord].master).title}의 재료` : W.kingOf(G.SLOT_KING[sl]).title}`)),
            h('div', { class: 'desc' }, `${itemLines(game, sample)} (레어 기준)`),
            h('div', { class: 'desc needs' }, ...kingNeeds(c.r))),
          h('button', { class: 'buy', disabled: c.ok ? null : true, onclick: () => {
            const it = game.craftSet(st.id, sl);
            if (it) { toast(`${itemTitle(game, it)} — ${gradeOf(it).name}!`); done(); }
          } }, '만들기'));
      });
      return h('div', {}, st.lord && st === G.LORD_SETS[0] ? h('h3', { class: 'king-head' }, '맹주·천마 세트', h('small', {}, '모든 직업 · 고수의 두목 방에서 모은다 · 천마신장이 가장 세다')) : null,
        setBox(game, st), h('div', { class: 'card' }, ...rows));
    });
    // 강화석 — 후반 일곱 왕
    const stoneRows = Object.entries(G.STONES).map(([z, stn]) => {
      const key = G.stoneKey(z);
      const can = Math.floor((s.mats[W.ORE] || 0) / game.stoneOre(z));
      return h('div', { class: 'row stone-row' },
        h('div', { class: 'info' },
          h('div', { class: 'name' }, W.matName(key), h('small', {}, ` ${fmt(s.mats[key] || 0)}개`)),
          h('div', { class: 'desc' }, `${stn.what} · ${W.zoneOfW(+z).name} 두목이 ${G.STONE_PER_BOSS}개씩 · ${W.ORE_NAME} ${fmt(game.stoneOre(z))}개로 하나 (가진 ${W.ORE_NAME} ${fmt(s.mats[W.ORE] || 0)})`)),
        // v399 몇 개 만들지 고른다 — 전엔 누르면 가진 현철로 만들 수 있는 만큼(수만 개)을 한꺼번에 만들었다
        h('div', { class: 'stone-btns' }, ...[1, 10, 100].map((n) => h('button', { class: 'buy', disabled: can >= n ? null : true, onclick: () => { const m = game.makeStone(+z, n); if (m) { toast(`${W.matName(key)} +${m} · ${W.ORE_NAME} -${fmt(game.stoneOre(z) * m)}`); done(); } } }, `${n}개`)),
          h('button', { class: 'buy ghost', disabled: can ? null : true, onclick: () => {
            if (!confirm(`${W.matName(key)} ${fmt(can)}개를 만들어요 — ${W.ORE_NAME} ${fmt(game.stoneOre(z) * can)}개를 써요. 정말 다?`)) return;
            const m = game.makeStone(+z, can); if (m) { toast(`${W.matName(key)} +${fmt(m)}`); done(); }
          } }, can ? `최대 ${fmt(can)}` : '최대'),
          game.stoneRefundable(+z) > 0 ? h('button', { class: 'buy ghost refund', style: 'grid-column:1/-1', onclick: () => {
            const r = game.stoneRefundable(+z);
            const v = prompt(`만든 ${W.matName(key)}을 ${W.ORE_NAME}으로 되돌려요(하나에 ${fmt(game.stoneOre(z))}개). 몇 개? (되돌릴 수 있는 것 ${fmt(r)}개)`, String(r));
            const n = Math.floor(Number(v) || 0); if (n <= 0) return;
            const m = game.unmakeStone(+z, n); if (m) { toast(`${W.matName(key)} -${fmt(m)} · ${W.ORE_NAME} +${fmt(game.stoneOre(z) * m)}`); done(); }
          } }, `↩ 되돌리기 ${fmt(game.stoneRefundable(+z))}`) : ''));
    });
    smithRoot.replaceChildren(modes,
      h('div', { class: 'card' }, h('h3', {}, '세트 장비', h('small', {}, `레벨 ${G.KING_LV}부터 · 레벨 100 · 무기·옷·모자·장갑·신발`)),
        h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 4px' },
          s.level < G.KING_LV ? `레벨 ${G.KING_LV}이 되면 만들 수 있어요.` : '세트 부위는 전반 다섯 왕이 하나씩 맡아요 — 그 왕의 재료·증표로 만들고, 그 왕은 내 직업 세트의 그 부위를 떨궈요.'),
        h('div', { class: 'slot-kings' }, ...G.SET_SLOTS.map((sl) => h('span', {}, h('b', {}, SLOT_SHORT[sl]), ` ${W.kingOf(G.SLOT_KING[sl]).title}`)))),
      ...cards,
      h('div', { class: 'card' }, h('h3', {}, '강화석', h('small', {}, '후반 일곱 왕 — 부위마다 그 강화석으로만')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 6px' }, '세트 장비는 그 부위의 강화석으로만 강화(+15 돌파까지)하고, 승급은 검왕의 검혼석으로 해요.'),
        ...stoneRows));
  }
  // ----- 왕의 장신구 (레벨 99부터, 공용) -----
  function kaccSmith(modes) {
    const s = game.s;
    const kings = W.ZONE_ORDER.filter((z) => z.king);
    const kz = kings.some((z) => z.id === ui.kz) ? ui.kz : kings[0].id;
    const kChips = h('div', { class: 'chip-row' }, ...kings.map((z) => h('button', { class: `chip${kz === z.id ? ' on' : ''}`, onclick: () => { ui.kz = z.id; keepUi(); sigs.smith = ''; smithView(); } },
      `${z.king.title}`, h('small', {}, ` ${fmt(s.mats[z.id] || 0)}`))));
    const rows = G.KACC_SLOTS.map((sl) => {
      const c = game.kaccCheck(kz, sl);
      const sample = game.makeKing(sl, kz, 0);
      return h('div', { class: `row craft-row${c.ok ? ' ready' : ''}` },
        h('div', { class: 'info' },
          h('div', { class: 'name' }, itemTitle(game, sample), ' ', deltaTag(vsWorn(sample)), h('small', {}, `Lv.${G.KING_ILV} · ${SLOT_SHORT[sl]}`)),
          h('div', { class: 'desc' }, `${itemLines(game, sample)} (레어 기준) · 스킬 옵션 하나 더`),
          h('div', { class: 'desc needs' }, ...kingNeeds(c.r))),
        h('button', { class: 'buy', disabled: c.ok ? null : true, onclick: () => {
          const it = game.craftKacc(kz, sl);
          if (it) { toast(`${itemTitle(game, it)} — ${gradeOf(it).name}! ${optLines(it).join(' / ')}`); done(); }
        } }, '만들기'));
    });
    smithRoot.replaceChildren(modes,
      h('div', { class: 'card' }, h('h3', {}, '왕의 장신구', h('small', {}, '모든 직업 공용 · 레벨 100')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 6px' }, `아무 십이지왕의 재료로나 만들어요. 옵션은 다섯 스킬(1~4차·보조기) 어디에든 붙고, 스킬 범위·연출을 바꾸는 변화 옵션(화염·빙결·뇌전·거대화·응축)도 나와요. 신화가 되면 그 왕의 고유 효과.`),
        kChips),
      h('div', { class: 'card' }, ...rows));
  }

  // ===== 재료 =====
  // ---------- v384 간단 각인 — 기운을 고르고 올리기만 ----------
  const impRoot = h('div');
  const SHORT_FX = { venom: '독', burn: '화상', chill: '둔화', shock: '뇌전', atkPct: '공격력', critDmg: '치명 피해', hpPct: '체력', drain: '흡혈', speed: '공속', bossDmg: '두목 피해', crit: '치명', stunHit: '기절', dmgRed: '피해 감소', cdr: '무공 숨', dodge: '회피', move: '이속' };
  const themeStats = (t) => IM.THEMES[t].fx.map(([k]) => SHORT_FX[k] || k).join('·');
  const THEME_ORDER = ['dark', 'saber', 'sword', 'blood', 'holy', 'iron', 'fire', 'poison', 'thunder', 'ice', 'petal', 'ghost', 'water', 'fist'];
  const markName = (k) => W.ZONES_W[+k.slice(1)]?.boss?.name || k;
  function openImpSlot(it) {
    openModal((el) => {
      const draw = () => {
        const nx = game.impNext(it);
        const cur = game.impThemeOf(it);
        const im = IM.imprintsOf(it)[0];
        el.replaceChildren(
          h('h3', {}, `${W.SLOTS.find((x) => x.id === it.slot)?.name} — 기운 고르기`),
          h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, '고른 기운의 두목 증표 가운데 가진 것으로 가장 센 것을 저절로 써요. 이미 새겨진 기운과 다르면 「올리기」가 바꿔 줘요(단은 절반 이어받아요).'),
          h('div', { class: 'imp-themes' }, ...THEME_ORDER.map((t) => {
            const th = IM.THEMES[t];
            const mk = game.themeMark(t, 1);
            return h('button', { class: `imp-theme${cur === t ? ' on' : ''}`, style: `--tc:${th.col}`, onclick: () => { game.setImpTheme(it.slot, t); app.save(); draw(); sigs.imp = ''; impView(); } },
              h('b', {}, th.name), h('small', {}, themeStats(t)), h('em', {}, mk ? `증표 ${fmt(game.s.mats[mk])} · ${markName(mk)}` : '증표 없음'));
          })),
          im ? h('p', { class: 'imp-now' }, `지금: ${IM.THEMES[im.theme].name} · ${im.boss} ${IM.DAN_NAME(im.d)} · `, Object.entries(im.fx).map(([k, v]) => IM.FX_TEXT[k]?.(v) || k).join(' · ')) : '',
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn primary', disabled: nx.can ? null : true, onclick: () => { const r = game.impUp(it.uid); if (r) { toast(r.ok ? `각인 — ${nx.label} 성공!` : `${nx.label} 실패 — 다음 확률이 올라요`); app.save(); draw(); sigs.imp = ''; impView(); } } }, `⬆ ${nx.label}`),
            h('button', { class: 'btn', disabled: nx.can ? null : true, onclick: () => { const r = game.impMax(it.uid); toast(`각인 ${r.n}번 — 성공 ${r.ok}${r.fail ? ` · 실패 ${r.fail}` : ''} · Lv ${game.impLv(it)}`); app.save(); draw(); sigs.imp = ''; impView(); } }, '⏫ 최대로')),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn', onclick: () => { closeModal(); openImprintGuide(app, () => openImpSlot(it)); } }, '📖 안내'),
            h('button', { class: 'btn', onclick: () => { closeModal(); openItem(it, true); } }, '⚙ 고급'),
            h('button', { class: 'btn', onclick: closeModal }, '닫기')));
      };
      draw();
    });
  }
  // ---------- v386 간단 강화 — 여덟 칸을 한 화면에 ----------
  const enhRoot = h('div');
  let enhTo = 10;
  function enhView() {
    const s = game.s;
    const worn = W.SLOTS.map((x) => ({ x, it: s.equip[x.id] })).filter((o) => o.it);
    const nsig = `${worn.map(({ it }) => `${it.uid}.${game.effPlus(it)}.${it.epity || 0}`).join(',')}|${Math.floor(s.gold / 1e3)}|${s.prot || 0}|${enhTo}|${JSON.stringify(Object.entries(s.mats).filter(([k]) => !W.isMarkKey(k)).length)}|${s.mats[W.ORE] || 0}`;
    if (nsig === sigs.enh) return;
    sigs.enh = nsig;
    const tiles = worn.map(({ x, it }) => {
      game.adoptShared(it);
      const p = it.plus || 0, mx = game.enhanceMax(it), mxi = game.enhanceMaxItem(it);
      const can = game.canEnhance(it);
      const m = game.enhanceMats(it);
      const rate = game.enhanceRateOf(it);
      const fail = W.enhanceFail(p);
      const lack = !can && p < mx ? (s.gold < game.enhanceCost(it) ? '은자 부족' : m && game.enhanceMatHave(m) < m.n ? `${W.matName(m.key)} 부족` : '증표 부족(돌파)') : '';
      return h('div', { class: 'enh-tile', style: `--gc:${gradeOf(it).color}` },
        h('button', { class: 'enh-top', onclick: () => openItem(it, true) }, h('span', { class: 'imp-slot' }, x.name), h('b', {}, `+${p}`), h('small', {}, itemTitle(game, it))),
        h('div', { class: 'imp-lv' }, h('i', { style: `width:${(p / mxi) * 100}%` }), h('span', {}, `+${p} / ${mxi}${mx < mxi ? ` (레벨 상한 +${mx})` : ''}`)),
        p >= mx ? (game.canTransItem(it) ? h('button', { class: `btn imp-up${game.canTranscend(it) ? ' primary' : ' lack'}`, onclick: () => openItem(it, true) }, `✦ 초월 ${it.tr || 0}/${W.TRANS_MAX}`, h('small', {}, ' 눌러서')) : h('div', { class: 'imp-done' }, p >= mxi ? (it.tr ? `✓ ${W.TRANS_NAME[it.tr]}` : '✓ 끝') : `레벨이 오르면 +${mx + 1}`))
          : h('button', { class: `btn imp-up${can ? ' primary' : ' lack'}`, disabled: can ? null : true, onclick: () => {
            const r = game.enhance(it.uid, true);
            if (r != null) { const L = game.lastEnhance; toast(r ? `${x.name} +${it.plus} 성공!` : `${x.name} 실패${L?.drop ? ` (${L.drop})` : L?.prot ? ' · 보호부로 그대로' : ' · 그대로'} · 다음 확률 ↑`); done(); }
          } }, can ? `⬆ +${p + 1}` : lack, h('small', {}, ` ${Math.round(rate * 100)}% · ${fmt(game.enhanceCost(it))}${m ? ` · ${W.matName(m.key)} ${m.n}` : ''}${fail ? ` · 실패 ${fail}${W.enhanceRisky(p) ? `(보호부 ${s.prot || 0})` : ''}` : ''}`)));
    });
    const tops = [5, 7, 10];
    enhRoot.replaceChildren(
      h('div', { class: 'card imp-card' },
        h('h3', {}, '강화', h('small', {}, ' 여덟 칸을 한눈에 · 누르면 한 단계')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, `+1~+6은 실패해도 그대로 · +7~+9는 실패하면 -1 · +10부터(돌파)는 실패하면 -2 — 보호부가 있으면 그대로. 실패할수록 다음 확률이 올라요. 보호부 ${s.prot || 0}개`),
        h('div', { class: 'imp-all' }, h('small', { class: 'muted' }, '모두 몇 강까지:'),
          ...tops.map((t) => h('button', { class: `chip${enhTo === t ? ' on' : ''}`, onclick: () => { enhTo = t; sigs.enh = ''; enhView(); } }, `+${t}`))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', id: 'enh-all', onclick: () => {
            if (enhTo > 7 && !confirm(`+7부터는 실패하면 한 단계 떨어질 수 있어요. 모두 +${enhTo}까지 올릴까요?`)) return;
            const r = game.enhAll(enhTo); toast(r.n ? `강화 ${r.n}번 — 성공 ${r.ok} · 실패 ${r.fail}` : '더 올릴 수 있는 칸이 없어요(은자·재료를 확인해요)'); done();
          } }, `⏫ 모두 +${enhTo}까지`),
          h('button', { class: 'btn', onclick: () => openAutoEnhCfg(app) }, '⚙ 자동 강화'))),
      h('div', { class: 'imp-grid' }, ...tiles),
      h('p', { class: 'muted', style: 'font-size:12px' }, '+10을 넘는 돌파(+11~+15)는 칸을 하나씩 눌러 올려요 — 두목 증표가 들어요.'));
  }
  function impView() {
    const s = game.s;
    const worn = W.SLOTS.map((x) => ({ x, it: s.equip[x.id] })).filter((o) => o.it && game.canImprintItem(o.it));
    const nsig = `${worn.map(({ it }) => `${it.uid}.${it.rar}.${JSON.stringify(it.imps?.[0] || 0)}.${it.pity || 0}`).join(',')}|${JSON.stringify(s.impTheme)}|${Object.entries(s.mats).filter(([k]) => W.isMarkKey(k)).map(([k, v]) => `${k}${v}`).join('')}|${Math.floor(s.gold / 1e4)}`;
    if (nsig === sigs.imp) return;
    sigs.imp = nsig;
    const rs = game.resonance();
    const top = Object.values(rs.by).sort((a, b) => b.n - a.n)[0];
    const tiles = worn.map(({ x, it }) => {
      const t = game.impThemeOf(it);
      const th = t ? IM.THEMES[t] : null;
      const lv = game.impLv(it);
      const nx = game.impNext(it);
      return h('div', { class: 'imp-tile', style: th ? `--tc:${th.col}` : '' },
        h('button', { class: 'imp-tile-top', onclick: () => openImpSlot(it) },
          h('span', { class: 'imp-slot' }, x.name),
          h('b', {}, th ? th.name : '기운 고르기 ›'), h('small', {}, th ? themeStats(t) : '누르면 골라요')),
        h('div', { class: 'imp-lv' }, h('i', { style: `width:${(lv / 12) * 100}%` }), h('span', {}, `Lv ${lv}/12`)),
        nx.kind === 'max' ? h('div', { class: 'imp-done' }, '✓ 끝(신화 10단)')
          : nx.can ? h('button', { class: 'btn primary imp-up', onclick: () => { const r = game.impUp(it.uid); if (r) toast(r.ok ? `${x.name} — ${nx.label} 성공!` : `${x.name} — ${nx.label} 실패 · 다음 확률 ↑`); done(); } }, `⬆ ${nx.label}`, h('small', {}, ` 증표 ${nx.n}${nx.chance != null && nx.chance < 1 ? ` · ${Math.round(nx.chance * 100)}%` : ''}`))
          : h('button', { class: 'btn imp-up lack', onclick: () => (nx.need === 'theme' ? openImpSlot(it) : nx.key ? openMatWhere(app, nx.key) : openImprintGuide(app)) }, nx.need === 'theme' ? '기운을 골라요 ›' : nx.key ? `증표·은자 부족 — 어디서? ›` : `${th ? th.name : ''} 증표가 없어요 — 어디서? ›`));
    });
    const canAny = worn.some(({ it }) => game.impNext(it).can);
    impRoot.replaceChildren(
      h('div', { class: 'card imp-card' },
        h('h3', {}, '각인', h('small', {}, ' 기운을 고르고 올리기만 하면 돼요')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, '① 칸마다 원하는 기운(능력)을 골라요 ② 「올리기」 — 새기기·단·등급을 알아서 차례로 ③ 여덟 칸을 같은 기운으로 모으면 공명(더 세요)'),
        h('div', { class: 'imp-all' }, h('small', { class: 'muted' }, '여덟 칸 모두 한 기운으로(공명):'),
          ...THEME_ORDER.slice(0, 8).map((t) => h('button', { class: 'chip', style: `--tc:${IM.THEMES[t].col}`, onclick: () => { if (!confirm(`여덟 칸 모두 〈${IM.THEMES[t].name}〉 기운으로 바꿀까요?\n다른 기운이 새겨진 칸은 「올리기」 때 그 기운으로 다시 새겨지고 단은 절반이 돼요.`)) return; for (const { x } of worn) game.setImpTheme(x.id, t);   /* v432 한 번 묻는다 — 범례처럼 보여 눌렀다가 여덟 칸이 통째로 바뀌었다 */ app.save(); toast(`여덟 칸 모두 ${IM.THEMES[t].name}(${themeStats(t)}) — 「모두 올리기」로 새겨요`); done(); } }, IM.THEMES[t].name))),
        // v402 고른 기운의 증표가 없는데 다른 기운 증표가 잔뜩이면 — 바꾸자고 짚는다(옛 기운에 영영 갇혔다)
        (() => {
          const st = game.impStuck();
          if (!st) return '';
          const best = [st.theme, st.have], stuck = st.slots.map((it) => ({ it }));
          return h('div', { class: 'imp-hint' }, h('span', {}, `💡 막힌 칸 ${stuck.length}개 — 가진 증표가 가장 많은 기운은 〈${IM.THEMES[best[0]].name}〉(${fmt(best[1])}개)`),
            h('button', { class: 'btn primary', id: 'imp-switch', onclick: () => { for (const { it } of stuck) game.setImpTheme(it.slot, best[0]); app.save(); toast(`막힌 칸을 ${IM.THEMES[best[0]].name} 기운으로 — 「올리기」가 다시 새겨요(단은 절반)`); done(); } }, '그 기운으로 바꾸기'));
        })(),
        top && top.n >= 2 ? h('p', { class: 'imp-res' }, `공명: ${IM.THEMES[top.theme].name} ${top.n}칸${top.tier >= 0 ? ` · ${IM.RES_ROMAN[top.tier]}` : ''}${top.next ? ` · ${top.next}칸 더 모으면 다음 단계` : ''}`) : '',
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', id: 'imp-all', disabled: canAny ? null : true, onclick: () => { const rw = worn.filter(({ it }) => { const nx = game.impNext(it); return nx.kind === 'theme' && nx.can; }).length; if (rw && !confirm(`${rw}칸은 고른 기운으로 다시 새겨져 단이 절반이 돼요. 모두 올릴까요?`)) return; const r = game.impAll();   /* v432 다시 새기는 칸이 있으면 묻는다 */ toast(`각인 ${r.n}번 — 성공 ${r.ok}${r.fail ? ` · 실패 ${r.fail}` : ''}`); done(); } }, '⏫ 모두 올리기'),
          h('button', { class: 'btn', onclick: () => openImprintGuide(app) }, '📖 안내서'))),
      h('div', { class: 'imp-grid' }, ...tiles),
      worn.length ? '' : h('p', { class: 'muted' }, '각인할 수 있는 장비를 끼면 여기 보여요.'));
  }
  const matRoot = h('div');
  function matView() {
    const s = game.s;
    const nsig = JSON.stringify(s.mats);
    if (nsig === sigs.mats) return;
    sigs.mats = nsig;
    const zones = new Set(Object.keys(s.mats).filter((k) => s.mats[k] > 0 && W.isMarkKey(k)).map((k) => parseInt(k.replace('b', ''), 10)));
    // v273 현철 — 지역 재료를 하나로. 가장 위에 한 줄
    const huntW = W.matWeight(W.mapOf(s.huntMap || 11).mz || 1);
    const oreRow = h('div', { class: 'row mat-zone' }, h('div', { class: 'info' }, h('div', { class: 'name' }, W.ORE_NAME, h('small', {}, ' 강화 · 단련 · 왕 강화석 · 세트·장신구 만들기')),
      h('div', { class: 'mat-row' }, matChip(app, W.ORE, W.ORE_NAME, s.mats[W.ORE] || 0)),
      h('div', { class: 'desc' }, `몹·두목이 떨궈요 — 높은 사냥터일수록 한 번에 많이 (지금 사냥터 한 번에 ${huntW}개 · 두목은 ${W.BOSS_MATS}배)`)));
    // v274 현철 단련 — 끝없는 소비처(강화가 레벨 상한에 막혀도 현철이 쓸모 있게)
    const tLv = s.temper || 0, tCost = game.temperCost(), tOpen = s.level >= W.TEMPER_FROM;
    let tMax = 0; { let left = s.mats[W.ORE] || 0, n = tLv; while (tMax < 999) { const c = W.temperCost(n, s.level); if (left < c) break; left -= c; n++; tMax++; } }
    const temperRow = h('div', { class: 'row mat-zone temper-row' },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, `🔨 단련 ${tLv}단계`, h('small', {}, ` 공격력·체력 +${(tLv * W.TEMPER_STEP * 100).toFixed(1)}% (영구)`)),
        h('div', { class: 'desc' }, tOpen
          ? `한 단계 +${(W.TEMPER_STEP * 100).toFixed(1)}% · 다음 단계 ${W.ORE_NAME} ${fmt(tCost)}개 — 단계마다 조금씩 비싸져요. 강화가 막혀도 현철을 여기에 쓰세요`
          : `레벨 ${W.TEMPER_FROM}부터 현철로 공격력·체력을 끝없이 올릴 수 있어요`)),
      tOpen ? h('div', { class: 'temper-btns' },
        h('button', { class: 'buy', disabled: tMax ? null : true, onclick: () => { if (game.temper(1)) done(); } }, '단련', h('small', {}, ` ${fmt(tCost)}`)),
        h('button', { class: 'buy', disabled: tMax > 1 ? null : true, onclick: () => { if (game.temper(tMax)) done(); } }, tMax > 1 ? `${tMax}번` : '여러 번', h('small', {}, ' 되는 만큼'))) : null);
    const facRow = h('div', { class: 'row mat-zone' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '세력 재료', h('small', {}, ' 레벨 100 고수 세트에 들어가요')),
      h('div', { class: 'mat-row' }, ...Object.entries(LN.FAC_MAT_INFO).map(([k, v]) => matChip(app, k, v.name, s.mats[k] || 0)),
        ...Object.entries(G.LORD_MATS).map(([k, v]) => matChip(app, k, v.name, s.mats[k] || 0)))));
    const stones = Object.keys(G.STONES).filter((z) => s.mats[G.stoneKey(z)] > 0);
    const rows = [...zones].sort((a, b) => b - a).map((z) => h('div', { class: 'row mat-zone' },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, W.zoneOfW(z)?.name || `지역 ${z}`),
        h('div', { class: 'mat-row' },
          matChip(app, W.bossKey(z), W.matName(W.bossKey(z)), s.mats[W.bossKey(z)] || 0),
          G.STONES[z] && s.mats[G.stoneKey(z)] > 0 ? matChip(app, G.stoneKey(z), G.STONES[z].name, s.mats[G.stoneKey(z)]) : null),
        h('div', { class: 'desc' }, '눌러 보면 어디서 나오는지 알려 주고 거기로 데려다 줘요')),
      null));
    for (const z of stones) if (!zones.has(+z)) rows.push(h('div', { class: 'row mat-zone' }, h('div', { class: 'info' }, h('div', { class: 'name' }, W.zoneOfW(+z)?.name || ''),
      h('div', { class: 'mat-row' }, matChip(app, G.stoneKey(z), G.STONES[z].name, s.mats[G.stoneKey(z)])))));
    matRoot.replaceChildren(h('div', { class: 'card' }, h('h3', {}, '재료', h('small', {}, '문파 창고로 나눌 수 있어요')),
      oreRow,
      temperRow,
      facRow,
      ...(rows.length ? rows : [h('p', { class: 'muted' }, '두목은 현철 한 움큼과 증표를 떨궈요 — 증표는 등급 각인·돌파에 써요.')])));
  }

  // v339 물약 — 가방에서 바로: 가진 수 · 사기(사냥터에서도) · 자동 마시기 켜기 · 몇 % 아래에서 마실지 · 자동 보충
  const potRoot = h('div');
  let potSig = '';
  function potView() {
    const s = game.s;
    const price = game.potionPrice();
    const nsig = `${s.potions}|${s.gold >= price * 200}|${s.gold >= price * 50}|${s.gold >= price * 10}|${s.autoPotion}|${game.potionAt()}|${s.autoRefill}|${price}`;
    if (nsig === potSig) return;
    potSig = nsig;
    const redo = () => { potSig = ''; app.save(); potView(); app.refresh(); };
    const maxN = Math.max(0, Math.floor(s.gold / price));
    // v432 「최대」는 가진 은자를 다 쓴다 — 보조 모양 + 한 번 묻는다(오탭 한 번에 전 재산이 물약이 됐다)
    const buy = (n, max = false) => h('button', { class: max ? 'btn buy-max' : 'buy', disabled: n <= 0 || s.gold < price * n ? true : null, onclick: () => {
      if (max && !confirm(`은자 ${fmt(price * n)}을(를) 다 써서 물약 ${fmt(n)}개를 살까요?`)) return;
      if (game.buyPotions(n)) { toast(`물약 ${fmt(n)}개를 샀어요`); redo(); }
    } }, max ? '최대' : `${n}개`, h('small', {}, max ? `${fmt(n)}개 · 은자 다` : fmt(price * n)));
    const chip = (on, label, fn) => h('button', { class: `cust-chip${on ? ' on' : ''}`, onclick: fn }, h('span', {}, label));
    potRoot.replaceChildren(
      h('div', { class: 'card shop-card pot-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'pot-ico big' }),
          h('div', { class: 'info' }, h('b', {}, '빨간 물약', h('small', {}, ` 개당 ${fmt(price)}`)),
            h('div', { class: 'desc' }, `한 병에 최대 체력의 ${pct(W.POTION_HEAL, 0)} 회복 · 아래 물약 단추(컴퓨터는 Q)로 직접 마셔요`)),
          h('div', { class: 'have' }, h('small', {}, '가진 것'), h('b', {}, fmt(s.potions)))),
        h('div', { class: 'buy-grid' }, buy(10), buy(50), buy(200), buy(Math.max(maxN, 1), true)),
        h('p', { class: 'muted', style: 'font-size:12px;margin:4px 0 0' }, '사냥터에서도 바로 사요.')),
      h('div', { class: 'card pot-auto' },
        h('h3', {}, '자동 마시기'),
        h('div', { class: 'cust-chips' }, chip(s.autoPotion, '켜기', () => { s.autoPotion = true; redo(); }), chip(!s.autoPotion, '끄기', () => { s.autoPotion = false; redo(); })),
        h('h3', { style: 'margin-top:10px' }, '체력이 몇 % 아래면 마실까요', h('small', {}, ' 높을수록 안전하지만 물약이 많이 들어요')),
        h('div', { class: 'cust-chips', id: 'pot-at' }, ...W.POTION_ATS.map((v) => chip(game.potionAt() === v, `${Math.round(v * 100)}%`, () => { s.potionAt = v; game.mark?.('potionAt'); redo(); }))),
        h('h3', { style: 'margin-top:10px' }, '자동 보충', h('small', {}, ' 물약이 10개 아래면 50개까지 알아서 사요(사냥터에서도)')),
        h('div', { class: 'cust-chips' }, chip(s.autoRefill, '켜기', () => { s.autoRefill = true; redo(); }), chip(!s.autoRefill, '끄기', () => { s.autoRefill = false; redo(); }))));
  }

  // v349 계정 창고 — 내 무인 넷이 함께 쓴다(은자 · 재료 · 장비 40칸). 빼는 쪽을 먼저 저장하고 넣는 쪽을 저장한다
  const vaultRoot = h('div');
  let vaultSig = '';
  function vaultView(force) {
    const V = app.vault?.get?.();
    const s = game.s;
    if (!V) { vaultRoot.replaceChildren(h('p', { class: 'muted' }, '창고를 열 수 없어요')); return; }
    const sig = `${V.at}|${s.gold}|${s.bag.length}|${JSON.stringify(s.mats).length}`;
    if (!force && sig === vaultSig) return;
    vaultSig = sig;
    const redo = () => { vaultSig = ''; vaultView(true); app.refresh(); };
    const moveGold = (toVault) => {
      const have = toVault ? s.gold : V.gold;
      const v = prompt(`${toVault ? '창고에 넣을' : '꺼낼'} 은자 (가진 것 ${fmt(have)})`, String(Math.floor(have)));
      const n = Math.floor(Number(String(v || '').replace(/[^0-9]/g, '')) || 0);
      if (n <= 0) return;
      if (n > have) return toast('그만큼 없어요');
      if (toVault) { s.gold -= n; app.save(); V.gold += n; app.vault.save(); }
      else { V.gold -= n; app.vault.save(); s.gold += n; app.save(); }
      toast(`은자 ${fmt(n)} ${toVault ? '넣었어요' : '꺼냈어요'}`); redo();
    };
    const matRows = Object.keys({ ...s.mats, ...V.mats }).filter((k) => (s.mats[k] || 0) > 0 || (V.mats[k] || 0) > 0)
      .sort((a, b) => (V.mats[b] || 0) - (V.mats[a] || 0)).slice(0, 40).map((k) => {
        const put = (n) => { n = Math.min(n, s.mats[k] || 0); if (n <= 0) return; s.mats[k] -= n; app.save(); V.mats[k] = (V.mats[k] || 0) + n; app.vault.save(); redo(); };
        const take = (n) => { n = Math.min(n, V.mats[k] || 0); if (n <= 0) return; V.mats[k] -= n; if (!V.mats[k]) delete V.mats[k]; app.vault.save(); s.mats[k] = (s.mats[k] || 0) + n; app.save(); redo(); };
        return h('div', { class: 'bank-row vault-row', style: `--mc:${W.matColor(k)}` }, h('b', {}, W.matName(k)),
          h('span', { class: 'n' }, `내 ${fmt(s.mats[k] || 0)} · 창고 ${fmt(V.mats[k] || 0)}`),
          h('button', { class: 'btn mini', disabled: (s.mats[k] || 0) > 0 ? null : true, onclick: () => put(s.mats[k] || 0) }, '전부 넣기'),
          h('button', { class: 'btn mini primary', disabled: (V.mats[k] || 0) > 0 ? null : true, onclick: () => take(V.mats[k] || 0) }, '전부 꺼내기'));
      });
    const myItems = s.bag.filter((it) => !it.grow);
    const itemRow = (it, inVault, idx) => h('div', { class: 'row vault-item', style: `--rc:${W.RARITY[it.rar || 0].color}` },
      h('div', { class: 'info' }, h('div', { class: 'name', style: `color:${W.RARITY[it.rar || 0].color}` }, itemTitle(game, it)), h('div', { class: 'desc' }, `${W.RARITY[it.rar || 0].name}${it.plus ? ` · +${it.plus}` : ''}${it.imps?.some(Boolean) ? ' · 각인' : ''}`)),
      inVault ? h('button', { class: 'btn mini primary', onclick: () => {
        if (s.bag.length >= s.bagSize) return toast('가방이 가득 찼어요');
        const [x] = V.items.splice(idx, 1); app.vault.save();
        game.vaultPutIn(x); app.save(); toast('가방으로 꺼냈어요'); redo();
      } }, '꺼내기')
        : h('button', { class: 'btn mini', onclick: () => {
          if (V.items.length >= VAULT_MAX) return toast(`창고 장비 칸이 가득 찼어요 (${VAULT_MAX})`);
          const x = game.vaultTakeOut(it.uid); if (!x) return; app.save();
          V.items.push(x); app.vault.save(); toast('창고에 넣었어요'); redo();
        } }, '넣기'));
    vaultRoot.replaceChildren(
      h('div', { class: 'card' }, h('h3', {}, '계정 창고', h('small', {}, ' 내 무인 넷이 함께 써요 · Google이면 다른 기기에서도')),
        h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, `은자 · 창고 ${fmt(V.gold)}`), h('div', { class: 'desc' }, `내 은자 ${fmt(s.gold)}`)),
          h('div', { class: 'btn-row', style: 'gap:6px' }, h('button', { class: 'btn mini', id: 'vault-gold-in', onclick: () => moveGold(true) }, '넣기'), h('button', { class: 'btn mini primary', id: 'vault-gold-out', onclick: () => moveGold(false) }, '꺼내기')))),
      h('div', { class: 'card' }, h('h3', {}, '재료', h('small', {}, ' 같은 재료는 무인끼리 나눠 써요')), ...(matRows.length ? matRows : [h('p', { class: 'muted' }, '재료가 없어요')])),
      h('div', { class: 'card' }, h('h3', {}, '창고 장비', h('small', {}, ` ${V.items.length}/${VAULT_MAX}`)),
        ...(V.items.length ? V.items.map((it, i) => itemRow(it, true, i)) : [h('p', { class: 'muted' }, '비어 있어요 — 아래 가방 장비를 넣어 다른 무인에게 건네요')])),
      h('div', { class: 'card' }, h('h3', {}, '내 가방', h('small', {}, ` ${myItems.length}개 · 낀 것·성장 장비는 못 넣어요`)),
        ...(myItems.length ? myItems.map((it) => itemRow(it, false)) : [h('p', { class: 'muted' }, '가방이 비었어요')])));
  }

  return subTabs([
    { key: 'gear', label: '착용', make: () => ({ root: gearRoot, update: gearView }) },
    { key: 'bag', label: '가방', make: () => ({ root: bagRoot, update: gearView }) },
    { key: 'imp', label: '각인', make: () => ({ root: impRoot, update: impView }) },   // v384
    { key: 'enh', label: '강화', make: () => ({ root: enhRoot, update: enhView }) },   // v386
    { key: 'smith', label: '대장장이', make: () => ({ root: smithRoot, update: smithView }) },
    { key: 'mats', label: '재료', make: () => ({ root: matRoot, update: matView }) },
    { key: 'pot', label: '물약', make: () => ({ root: potRoot, update: potView }) },
    { key: 'vault', label: '창고', make: () => ({ root: vaultRoot, update: vaultView }) },
  ]);
}

// 누를 수 있는 재료 알약
// v230: 재료 그림 — 빛깔 보석 안에 갈래 글자(재료 材 · 두목 증표 證 · 강화석 石 · 세력 재료 勢 · 맹주의 패 牌)
export function matKind(key) {
  const k = String(key);
  return k === W.ORE ? '鐵' : G.isLordMat(k) ? '牌' : LN.isFacMat(k) ? '勢' : G.isStoneKey(k) ? '石' : W.isMarkKey(k) ? '證' : '材';
}
export const matIcon = (key, size = 40) => h('span', { class: `mat-ico k-${matKind(key)}`, style: `--mc:${W.matColor(key)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px` }, matKind(key));
// 누르면 어디서 나오는지 · 데려다 준다. 0개는 흐리게.
export const matChip = (app, key, label, n) => h('button', {
  class: `mat-chip tap${n ? '' : ' none'}`, style: `--mc:${W.matColor(key)}`,
  onclick: () => openMatWhere(app, key),
  title: matHover(app.game, key, label, n),
}, matIcon(key), h('b', {}, fmt(n)), h('small', {}, label));
// v349 재료에 마우스를 올리면 — 이름 · 가진 수 · 어디서 · 쓰는 곳
function matHover(game, key, label, n) {
  try {
    const w = matWhere(game, key), use = matUse(game, key);
    return [`${label} ${fmt(n || 0)}개`, w?.from, use ? `쓰는 곳: ${use}` : null].filter(Boolean).join('\n');
  } catch { return label; }
}

// ---------- 재료가 어디서 나오나 (v141) ----------
// 재료 열쇠에서 지역과 '어디를 쳐야 하나'를 읽는다.
//   z → 그 지역 몹 (구역 1·2·3)
//   b{z} → 그 지역 두목 구역의 두목
//   s{z} → 그 지역 두목 (강화석)
export function matWhere(game, key) {
  const k = String(key);
  // v273 현철 — 갈 수 있는 가장 센 들판 구역(높을수록 한 번에 많이)
  if (k === W.ORE) {
    let id = null;
    for (const m of W.MAPS) if (!m.town && !m.bossRoom && !m.master && game.canEnter(m.id) && game.danger(m.id) <= 0 && (!id || m.lv[0] > W.mapOf(id).lv[0])) id = m.id;
    id = id || W.mapId(1, 1);
    const map = W.mapOf(id);
    return { key: k, z: map.zone, zone: W.zoneOfW(map.zone), boss: false, stone: false, id, map, name: W.ORE_NAME, color: W.ORE_COL,
      have: game.s.mats[k] || 0, can: true, need: map.lv[0], from: `모든 사냥터의 몹·두목이 떨궈요 — 높은 사냥터일수록 한 번에 많이(사냥터 레벨 ÷ 5). 여기서는 한 번에 ${W.matWeight(map.mz)}개` };
  }
  // 맹주의 패 (v153) — 그 맹주·천마의 두목 방으로
  if (G.isLordMat(k)) {
    const info = G.LORD_MATS[k];
    const mm = MS.masterOf(info.master);
    const id = W.mapId(W.masterZoneOf(mm.id), W.BOSS_AREA);
    const map = W.mapOf(id);
    return { key: k, z: map.zone, zone: W.zoneOfW(map.zone), boss: true, stone: false, id, map, name: info.name, color: info.col,
      have: game.s.mats[k] || 0, can: true, need: map.lv[0], from: `${mm.title} ${mm.name}이(가) 6개씩, ${MS.factionOf(info.fac).name}의 다른 고수가 가끔 하나 떨궈요` };
  }
  // 세력 재료 (v151) — 그 세력 사냥터 가운데 내 레벨에 알맞은 가장 센 구역으로
  if (LN.isFacMat(k)) {
    const info = LN.FAC_MAT_INFO[k];
    let id = null;
    for (const z of MS.FAC_ZONES[info.fac]) for (let a = 1; a < W.BOSS_AREA; a++) {
      const mid = W.mapId(z, a);
      if (W.hasMap(mid) && game.danger(mid) <= 0 && (!id || W.mapOf(mid).lv[0] > W.mapOf(id).lv[0])) id = mid;
    }
    id = id || W.mapId(MS.FAC_ZONES[info.fac][0], 1);
    const map = W.mapOf(id);
    return { key: k, z: map.zone, zone: W.zoneOfW(map.zone), boss: false, stone: false, id, map, name: info.name, color: info.col,
      have: game.s.mats[k] || 0, can: true, need: map.lv[0], from: `${MS.factionOf(info.fac).name} 사냥터의 몹(가끔)·두목, 고수의 두목 방(한 움큼)에서 나와요` };
  }
  const stone = G.isStoneKey(k);
  const boss = stone || k.startsWith('b');
  const z = parseInt(k.replace(/^(st|b|s)/, ''), 10);   // v390 강화석(st26)은 's'만 떼면 't26' — 아무 데도 안 갔다
  const zone = W.zoneOfW(z);
  if (!zone) return null;
  // 두목 것은 두목 구역으로, 몹 것은 갈 수 있는 가장 센 구역으로 (거기가 제일 잘 나온다)
  let area = W.BOSS_AREA;
  if (!boss) {
    area = 1;
    for (let a = 1; a < W.BOSS_AREA; a++) if (game.canEnter(W.mapId(z, a))) area = a;
  }
  const id = W.mapId(z, area);
  const map = W.hasMap(id) ? W.mapOf(id) : null;
  return {
    key: k, z, zone, boss, stone, id, map,
    name: W.matName(k),
    color: W.matColor(k),
    have: game.s.mats[k] || 0,
    can: game.canEnter(id),
    need: map ? map.lv[0] : 0,
    from: stone ? `${zone.name} 두목이 ${G.STONE_PER_BOSS}개씩 떨궈요 · 가방 › 대장장이(세트 장비)에서 ${W.ORE_NAME}으로 만들 수도 있어요` : boss ? `${zone.name} 두목 구역의 두목이 떨궈요` : `${zone.name} 몹이 떨궈요`,
  };
}

// 두목 구역에 들어갈 때 — 혼자 / 문파원과 함께를 고른다 (v145 십이지왕 · v339 모든 두목 구역).
// 문파가 없거나 서버에 못 닿으면 묻지 않고 혼자 들어간다. then(ok)는 들어간 뒤 부른다.
export function enterKingRoom(app, id, then) {
  const { game } = app;
  const m = W.mapOf(id);
  const coop = app.coop;
  const title = m.king ? m.king.title : `${m.zoneName || m.name || ''}`;   // v339 일반 두목 구역도
  const enter = (party) => {
    game.s.kingParty = party;
    const ok = game.enterMap(id);
    if (ok) toast(party ? `🤝 ${title} — 문파원과 함께 들어왔어요. 자동 사냥은 그대로 돌아요` : `${title} — 혼자 들어왔어요`);
    then?.(ok);
  };
  if (!m.bossRoom || !coop?.can()) { if (m.bossRoom) game.s.kingParty = false; const ok = game.enterMap(id); then?.(ok); return; }
  if (!game.canEnter(id)) { toast('지금은 갈 수 없어요'); return; }
  const who = h('p', { class: 'muted' }, '같은 구역의 문파원을 찾는 중…');
  openModal((sheet) => {
    sheet.append(
      h('h2', {}, `${title} 두목 구역`),
      h('p', {}, '어떻게 들어갈까요? 둘 다 자동 사냥(방치)으로 계속 돌아요.'),
      h('div', { class: 'party-pick' },
        h('button', { class: `party-opt${game.s.kingParty ? '' : ' on'}`, onclick: () => { closeModal(); enter(false); } },
          h('b', {}, '⚔ 혼자'), h('span', {}, '두목을 혼자 잡아요. 체력도 보상도 나만의 것.')),
        h('button', { class: `party-opt${game.s.kingParty ? ' on' : ''}`, onclick: () => { closeModal(); enter(true); } },
          h('b', {}, '🤝 문파원과 함께'), h('span', {}, '같은 구역의 문파원과 두목 체력을 나눠요. 한 대라도 치면 처치 보상을 다 받아요.'))),
      who,
      h('p', { class: 'muted', style: 'font-size:11px' }, '들어가서도 위의 단추로 바꿀 수 있어요. 앱을 끈 동안의 방치 보상은 혼자 사냥으로 셈해요.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '닫기')));
  });
  coop.peek(id).then((n) => { who.textContent = n == null ? '' : n > 0 ? `🤝 지금 이 두목 구역에 문파원 ${n}명이 사냥 중이에요` : '지금 이 두목 구역에 있는 문파원은 없어요 — 함께로 들어가 두면 나중에 온 문파원과 같이 잡아요'; });
}

// v262: 재료를 어디에 쓰나 — 쌓인 숫자가 무엇인지 알게
export function matUse(game, key) {
  const k = String(key);
  if (G.isLordMat(k)) return '맹주·천마 세트를 만들 때 (가방 → 대장장이)';
  if (LN.isFacMat(k)) return '맹주 세트(Lv160)를 만들 때 · 세력 상점에서 다른 것으로 바꿀 수 있어요 (마을 → 상인)';
  if (G.isStoneKey(k)) return '왕의 장비(세트·왕의 장신구) 강화';
  if (k.startsWith('b')) return `장비 등급 각인 · +${W.ENHANCE_NORMAL} 넘는 돌파`;
  if (k === W.ORE) return '장비 강화(장비 지역 레벨이 높을수록 많이) · 단련(영구 공격력·체력, 끝없이) · 왕 강화석 만들기 · 왕의 세트·장신구 만들기';
  const z = parseInt(k, 10);
  if (!Number.isFinite(z)) return '';
  const up = W.matUpTarget(z);
  return `장비 강화(이 지역 레벨대 장비)${up ? ` · ${W.MAT_CONVERT}개를 ${W.matName(up)} 하나로 바꿀 수 있어요` : ''}`;
}
// v301 증표를 하나도 안 가졌을 때 — 갈 수 있는 두목 구역 가운데 위험하지 않은 가장 센 곳의 증표 열쇠
// v382 각인 안내서 — 「이 능력치를 원하면 어느 두목 증표를, 그 두목은 어디에」를 한눈에.
//   ① 각인이란(세 줄) ② 원하는 능력 고르기 → 그 기운의 두목들(내 레벨에 맞는 순 · 신화로 새기면 얼마 · 가진 증표 · 사냥터로) ③ 지금 내 장비 각인
const GUIDE_STATS = [
  ['atkPct', '공격력', '⚔'], ['hpPct', '체력', '❤'], ['crit', '치명', '✦'], ['critDmg', '치명 피해', '💥'], ['bossDmg', '두목 피해', '👑'],
  ['dmgRed', '받는 피해 감소', '🛡'], ['dodge', '회피', '💨'], ['speed', '공격 속도', '⚡'], ['move', '이동 속도', '👣'], ['drain', '흡혈', '🩸'],
  ['cdr', '무공 숨(재사용)', '⏳'], ['venom', '독', '☠'], ['burn', '화상', '🔥'], ['chill', '둔화', '❄'], ['shock', '뇌전', '⚡'], ['stunHit', '기절', '💫'],
];
let guidePick = 'atkPct';
export function openImprintGuide(app, back = null) {
  const { game } = app;
  const s = game.s;
  const zones = Object.keys(W.ZONES_W).map(Number).filter((z) => W.ZONES_W[z]?.boss);
  const bossMap = (z) => W.MAPS.find((m) => m.zone === z && m.bossRoom) || W.MAPS.find((m) => m.zone === z && !m.town) || null;
  const pct = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, '')}%`;
  openModal((el) => {
    const draw = () => {
      const st = GUIDE_STATS.find((x) => x[0] === guidePick) || GUIDE_STATS[0];
      const themes = Object.entries(IM.THEMES).filter(([, t]) => t.fx.some(([k]) => k === st[0])).map(([k]) => k);
      // 그 기운의 두목들 — 갈 수 있는(레벨 +10 안) 것부터 센 순, 그 다음 멀리 있는 것
      const rows = zones.filter((z) => themes.includes(IM.themeOfZone(z))).map((z) => {
        const key = W.bossKey(z);
        const im = IM.imprintOf({ k: key, s: 0, sk: 'dmg', g: 0, sp: 0 }, 3);
        const lv = W.markLv(key);
        return { z, key, lv, v: im?.fx?.[st[0]] || 0, im, have: s.mats[key] || 0, near: lv <= s.level + 10, map: bossMap(z) };
      }).sort((a, b) => (b.near - a.near) || (a.near ? b.v - a.v : a.lv - b.lv)).slice(0, 8);
      // 지금 내 장비 각인
      const mine = W.SLOTS.map((x) => ({ x, it: s.equip[x.id] })).filter((o) => o.it).map(({ x, it }) => {
        const im = IM.imprintsOf(it)[0];
        return h('div', { class: 'ig-mine-row' }, h('b', {}, x.name),
          im ? h('span', {}, h('i', { style: `color:${IM.THEMES[im.theme].col}` }, `${IM.THEMES[im.theme].name} `), `${im.boss} ${IM.DAN_NAME(im.d)} · `, Object.entries(im.fx).map(([k, v]) => IM.FX_TEXT[k]?.(v) || k).join(' · '))
            : h('span', { class: 'muted' }, (it.rar || 0) >= 1 || it.grow || it.king != null ? '비었어요 — 등급을 올리면(유니크부터) 새겨져요' : '레어 — 유니크로 올리면 새겨져요'));
      });
      el.replaceChildren(
        h('h2', {}, '📖 각인 안내서'),
        h('div', { class: 'ig-steps' },
          h('div', {}, h('b', {}, '①'), ' 두목을 잡으면 그 두목의 ', h('b', {}, '증표'), '가 나와요'),
          h('div', {}, h('b', {}, '②'), ' 장비 등급을 올릴 때(유니크·전설·신화) 넣은 증표 두목의 ', h('b', {}, '기운'), '이 장비에 새겨져요 — 기운마다 능력치 둘 + 스킬 변화'),
          h('div', {}, h('b', {}, '③'), ' 같은 두목 증표를 더 넣으면 ', h('b', {}, '단'), '이 깊어지고(최대 10단), 장비 여덟에 같은 기운을 모으면 ', h('b', {}, '공명'))),
        h('h3', { class: 'ig-h' }, '원하는 능력을 골라요'),
        h('div', { class: 'ig-stats' }, ...GUIDE_STATS.map(([k, t, ic]) => h('button', { class: `chip${k === guidePick ? ' on' : ''}`, onclick: () => { guidePick = k; draw(); } }, `${ic} ${t}`))),
        h('p', { class: 'muted ig-note' }, `〈${st[1]}〉을(를) 주는 기운: `, ...themes.map((t) => h('b', { style: `color:${IM.THEMES[t].col}` }, `${IM.THEMES[t].name} `)),
          ` — 같은 기운의 두목은 모두 같은 능력치를 줘요(센 두목일수록 크게). 아래는 지금 레벨(${s.level})에 맞는 순이에요.`),
        h('div', { class: 'ig-list' }, ...rows.map((r) => {
          const zn = W.ZONES_W[r.z];
          const th = IM.THEMES[IM.themeOfZone(r.z)];
          return h('div', { class: `ig-row${r.near ? '' : ' far'}`, style: `--tc:${th.col}` },
            h('div', { class: 'ig-ico' }, matIcon(r.key, 30)),
            h('div', { class: 'ig-info' },
              h('b', {}, zn.boss.name, h('small', {}, ` · ${th.name} · Lv.${r.lv}${r.map ? ` · ${r.map.name}` : ''}`)),
              h('div', { class: 'ig-fx' }, `신화로 새기면 `, h('em', {}, Object.entries(r.im.fx).map(([k, v]) => IM.FX_TEXT[k]?.(v) || k).join(' · ')), IM.specialsOfZone(r.z) ? ` + 고유 효과 ${IM.specialsOfZone(r.z).map((x) => x.name).join('·')}` : ''),
              h('small', { class: 'muted' }, `증표 ${fmt(r.have)}개 가짐${r.near ? '' : ' · 아직 센 곳(레벨을 더 올려요)'}`)),
            r.map ? h('button', { class: 'btn ig-go', onclick: () => { closeModal(); openMatWhere(app, r.key, () => openImprintGuide(app, back)); } }, '어디서?') : null);
        }), rows.length ? null : h('p', { class: 'muted' }, '이 능력을 주는 두목이 없어요.')),
        h('h3', { class: 'ig-h' }, '지금 내 장비 각인'),
        h('div', { class: 'ig-mine' }, ...mine),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => { closeModal(); openAutoInfCfg(app, back); } }, '⚙ 자동 각인 설정'),
          h('button', { class: 'btn primary', onclick: () => { closeModal(); back?.(); } }, back ? '돌아가기' : '닫기')));
    };
    draw();
  });
}
export function bestMarkKey(game) {
  let id = null;
  for (const m of W.MAPS) if (m.bossRoom && !m.master && game.canEnter(m.id) && game.danger(m.id) <= 0 && (!id || m.lv[0] > W.mapOf(id).lv[0])) id = m.id;
  return W.bossKey(W.mapOf(id || W.mapId(1, W.BOSS_AREA)).zone);
}
// 누르면 뜨는 창 — 어디서 나오는지 알려 주고, 갈지 묻고, 간다
export function openMatWhere(app, key, back = null) {
  const { game } = app;
  const w = matWhere(game, key);
  if (!w) return;
  const use = matUse(game, key);
  openModal((sheet) => {
    // **append는 null을 "null" 글자로 찍는다.** h()는 걸러 주지만 append는 아니다 —
    // 화면에 null이 한 줄 뜨는 사고가 옛 판에서 세 번 났다. 걸러서 넘긴다.
    sheet.append(...[
      h('h2', {}, h('span', { style: `color:${w.color}` }, w.name)),
      h('p', {}, w.from),
      use ? h('p', { class: 'mat-use' }, `쓰는 곳: ${use}`) : null,
      h('p', { class: 'muted' }, `지금 가진 것 ${fmt(w.have)}개 · ${w.map ? `${w.map.name} (몹 Lv.${w.map.lv[0]}~${w.map.lv[1]})` : ''}`),
      w.can ? null : h('p', { class: 'dgn-warn' }, `레벨 ${w.need}부터 들어갈 수 있어요 — 지금 ${game.s.level}.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => (back ? back() : closeModal()) }, back ? '← 돌아가기' : '안 갈래요'),
        h('button', { class: 'btn primary', disabled: w.can ? null : true, onclick: () => {
          const arrived = () => {
            // 돌아갈 곳도 여기로 — 안 그러면 쓰러진 뒤 옛 사냥터로 되돌아간다
            game.s.huntMap = w.id;
            app.save();
            app.closePanel();
            app.refresh();
          };
          if (w.map?.bossRoom && app.coop?.can()) { closeModal(); enterKingRoom(app, w.id, (ok) => ok && arrived()); return; }
          if (!game.enterMap(w.id)) return toast('지금은 갈 수 없어요');
          closeModal();
          arrived();
          toast(`${w.map.name}으로 왔어요 — ${w.from}`);
        } }, w.boss ? '두목 구역으로 가기' : '그 사냥터로 가기')),
    ].filter(Boolean));
  });
}

// 세트 한 장 — 이름 · 조각(낀 것 표시) · 2·3·5조각 효과(켜진 것 밝게)
export function setBox(game, st) {
  const n = game.setCounts()[st.id] || 0;
  const mine = !st.job || st.job === game.s.job;      // 맹주·천마 세트(v153)는 모든 직업
  const from = st.lord ? `${MS.masterOf(G.LORD_MATS[st.lord].master)?.title || ''} · 모든 직업` : `${W.zoneOfW(st.king)?.name || ''} · ${W.classOf(st.job)?.name || st.job}`;
  return h('div', { class: 'card set-box', style: `--sc:${st.col}` },
    h('h3', {}, st.name, h('small', {}, ` ${from} 세트 · ${n}/5`)),
    h('p', { class: 'muted set-lore' }, st.lore),
    h('div', { class: 'set-pieces' }, ...G.SET_SLOTS.map((sl) => h('span', { class: game.s.equip[sl]?.set === st.id ? 'on' : '' }, SLOT_SHORT[sl]))),
    ...Object.entries(st.bonus).map(([need, b]) => h('div', { class: `set-bonus${mine && n >= +need ? ' on' : ''}` }, h('b', {}, `${need}세트`), ' ', G.setBonusText(b))),
    !mine ? h('p', { class: 'muted' }, '다른 직업 세트라 효과가 나지 않아요.') : null);
}

// ---------- 지도 ----------
// 지역마다 한 장: 구역 1·2·3과 두목 구역 단추. 레벨 99부터 십이지왕.
// 보상 한 줄 — '경험치 1.2만 · 은자 3,400 · 청죽 마디 300'
export function rewardText(r) {
  if (!r) return '';
  const out = [];
  if (r.exp) out.push(`경험치 ${fmt(r.exp)}`);
  if (r.gold) out.push(`은자 ${fmt(r.gold)}`);
  for (const [k, n] of Object.entries(r.mats || {})) { const o = W.oreOf(k, n); out.push(`${W.matName(o.key)} ${fmt(o.n)}`); }   // v273 지역 재료는 현철로 보인다
  if (r.petShard) out.push(`포획 조각 ${fmt(r.petShard)}`);   // v292
  if (r.mountShard) out.push(`탈것 조각 ${fmt(r.mountShard)}`);
  return out.join(' · ') || '없음';
}

// 보상을 누를 수 있는 조각으로. 재료 이름을 누르면 '어디서 나오나' 창이 뜬다.
// 글만 쓰는 자리(토스트)는 rewardText 그대로.
export function rewardNodes(app, r, lead = '') {
  const out = [];
  if (lead) out.push(lead);
  if (r?.exp) out.push(`경험치 ${fmt(r.exp)}`);
  if (r?.gold) out.push(`${out.length > (lead ? 1 : 0) ? ' · ' : ''}은자 ${fmt(r.gold)}`);
  for (const [k, n] of Object.entries(r?.mats || {})) {
    if (out.length > (lead ? 1 : 0)) out.push(' · ');
    out.push(h('button', {
      class: 'need tap', style: `--mc:${W.matColor(k)}`,
      onclick: (e) => { e.stopPropagation(); openMatWhere(app, k); },
    }, W.matName(k), ' ', h('b', {}, fmt(n))));
  }
  // v292 조각
  for (const [k, nm] of [['petShard', '포획 조각'], ['mountShard', '탈것 조각']]) if (r?.[k]) { if (out.length > (lead ? 1 : 0)) out.push(' · '); out.push(`${nm} ${fmt(r[k])}`); }
  if (!out.length || (lead && out.length === 1)) out.push('없음');
  return out;
}

// v126: 지도 창 = 사냥터 · 던전 (요일 던전 · 무한의 탑)
function mapTab(app) {
  const { game } = app;
  const go = (id) => {
    const m = W.mapOf(id);
    if (m.bossRoom) return enterKingRoom(app, id, (ok) => { if (ok) { app.save(); app.closePanel(); app.refresh(); } });
    if (!game.enterMap(id)) return; app.save(); app.closePanel(); app.refresh();
  };
  // 지역 카드 한 장 — 구역 1·2·3과 두목 구역 단추 · 기운 · 숙련
  function zoneCard(box, zn, here) {
    const s = game.s;
      const areas = W.MAPS.filter((m) => m.zone === zn.id);
      const open = game.canEnter(areas[0].id);
      // v146: 레벨과 상관없이 어디든 갈 수 있다 — 지역은 다 보여 주고, 센 곳에는 '위험'을 붙인다
      const fit = areas.some((m) => !m.bossRoom && s.level >= m.lv[0] && s.level <= m.lv[1] + 2);
      const btns = areas.map((m) => {
        const risky = game.danger(m.id) > W.DANGER_LV;
        return h('button', {
          class: `area-btn${m.bossRoom ? ' boss' : ''}${s.map === m.id ? ' here' : ''}${risky ? ' danger' : ''}`,
          disabled: !game.canEnter(m.id) ? true : null,
          title: `${m.name} · Lv.${m.lv[0]}~${m.lv[1]}${risky ? ' · 위험 — 내 레벨보다 훨씬 세요' : ''}`,
          onclick: () => go(m.id),
        }, m.bossRoom ? '두목' : String(m.area), h('small', {}, `${risky ? '⚠' : ''}Lv${m.lv[0]}`),
          (app.where?.at(m.id).length || 0) > 0 ? h('i', { class: 'who-dot', title: app.where.at(m.id).map((o) => o.n).join(', ') }, `🤝${app.where.at(m.id).length}`) : null);
      });
      // v344 이 지역에 있는 문파원 — 누가 몇 구역에
      const who = app.where?.inZone(zn.id) || [];
      const env = L.ENVS[zn.art];
      const mk = s.mast?.[zn.id] || 0;
      const ml = L.masteryLv(mk);
      const next = L.MASTERY_KILLS[ml + 1];
      const mBar = h('div', { class: 'mast-bar' }, h('i', { style: `width:${next ? Math.round(((mk - L.MASTERY_KILLS[ml]) / (next - L.MASTERY_KILLS[ml])) * 100) : 100}%` }));
      box.append(h('div', { class: `card zone-card${zn.king ? ' king' : ''}${zn.pair ? ' alt' : ''}${here.zone === zn.id ? ' me' : ''}${open ? '' : ' locked'}` },
        h('div', { class: 'zone-head' },
          h('b', {}, zn.name), zn.pair ? h('i', { class: 'new-tag' }, '새 지역') : null, fit ? h('i', { class: 'best-tag' }, '알맞음') : null,
          h('small', {}, `Lv.${zn.lv[0]}~${zn.lv[1]} · 두목 ${zn.boss.name}`)),
        env ? h('div', { class: `zone-env ${env.good ? 'good' : 'bad'}` }, h('b', {}, env.good ? `☀ ${env.name}` : `☁ ${env.name}`), ` ${env.desc}`,
          !env.good ? h('small', {}, ` · ${L.RES_TYPES[env.type]} — 저항 ${Math.round(game.resistTo(env.type, zn.id) * 100)}%`) : null) : null,
        zn.pair ? h('p', { class: 'muted king-desc' }, `재료·증표는 ${W.zoneOfW(zn.pair).name}와 같아요`) : null,
        h('div', { class: 'zone-mast' }, h('span', {}, `숙련 ${ml}${ml >= L.MASTERY_MAX ? ' (최고)' : ''}`), mBar,
          h('small', {}, ml ? `경험치 +${ml * L.MASTERY.exp * 100}% · 재료 +${ml * L.MASTERY.mat * 100}%` : next ? `${next - mk}마리 더` : '')),
        zn.king ? h('p', { class: 'muted king-desc' }, `${zn.king.hanja} · ${zn.king.desc}`) : null,
        who.length ? h('div', { class: 'zone-who' }, '🤝 ', ...who.map((o) => { const mm = W.mapOf(o.m); return h('button', { class: 'who-chip', onclick: () => go(o.m) }, `${o.n} · ${mm.bossRoom ? '두목' : `${mm.area}구역`}`); })) : null,
        h('div', { class: 'area-row' }, ...btns)));
  }
  // 고수 한 명 — 두목 방 카드 (v148). 수하 졸개가 늘 있고 고수가 10초마다(화무기는 30초) 다시 나선다. 이야기는 접어 둔다.
  function masterCard(m, fac) {
    const s = game.s;
    // v238: 히든 두목 — 화무기를 쓰러뜨리기 전에는 이름도 초식도 가린다
    if (m.hidden && !s.duel.won.hwamugi) {
      return h('div', { class: 'card master-card hidden-boss', style: `--fc:${fac.col}` },
        h('div', { class: 'master-top' }, h('div', { class: 'hb-q' }, '?'),
          h('div', { class: 'master-name' }, h('b', {}, '??? '), h('small', {}, '히든'), h('div', { class: 'muted' }, '천하제일인을 쓰러뜨린 자에게만 길이 열린다'))));
    }
    const won = !!s.duel.won[m.id];
    const room = W.mapId(W.masterZoneOf(m.id), W.BOSS_AREA);
    const here = s.map === room;
    const risky = game.danger(room) > W.DANGER_LV;
    const rw = MS.masterReward(m);
    const bonus = Math.round(MS.masterBonusOf(m) * 100);
    return h('div', { class: `card master-card${m.lord ? ' lord' : ''}${won ? ' won' : ''}${here ? ' me' : ''}`, style: `--fc:${fac.col}` },
      h('div', { class: 'master-top' },
        masterPortrait(m.look),
        h('div', { class: 'master-name' },
          h('b', {}, `${m.title} `, h('span', {}, m.name)),
          h('small', {}, `Lv.${m.lv}${risky ? ' ⚠위험' : ''} · 수하 ${m.mobs.map((x) => x.name).join('·')}`),
          h('div', { class: 'muted' }, `초식: ${m.skills.map((k) => k.name).join(' · ')}`))),
      h('details', { class: 'master-story' }, h('summary', {}, '이야기'), h('p', {}, m.story)),
      h('div', { class: 'master-rw' }, won ? `✓ 쓰러뜨렸어요 · 공격력·체력 +${Math.round(bonus * (1 + MS.STAR_BONUS * game.duelStars(m.id).extra))}% 영구 — 눌러앉아 파밍하세요` : `처음 쓰러뜨리면 ${rewardText(rw)} · 공격력·체력 +${bonus}% 영구`),
      // v262 비무 별 셋
      (() => { const st = game.duelStars(m.id); return h('div', { class: 'duel-stars' },
        h('span', { class: st.won ? 'on' : '' }, '★', h('small', {}, '쓰러뜨림')),
        h('span', { class: st.fast ? 'on' : '' }, '★', h('small', {}, `${MS.starSec(m)}초 안에`)),
        h('span', { class: st.clean ? 'on' : '' }, '★', h('small', {}, '초식에 안 맞고')),
        h('small', { class: 'muted' }, ` 별 하나마다 덤 +${MS.STAR_BONUS * 100}%`)); })(),
      h('div', { class: 'btn-row' },
        h('button', { class: `btn ${here ? '' : 'primary'}`, disabled: here ? true : null, onclick: () => go(room) }, here ? '여기서 사냥 중' : '두목 방으로 가기')));
  }
  // 세력 칸 (v148) — 사냥터와 고수. 십이지왕 칸은 왕 구역만.
  function zoneView(fac) {
    const box = h('div');
    let sig = '';
    return {
      root: box,
      update() {
        const s = game.s;
        const nsig = `${s.level}|${s.map}|${s.huntMap}|${Object.values(s.mast || {}).map((k) => L.masteryLv(k)).join(',')}|${JSON.stringify(s.duel.won)}|${!!game.inst}|${s.autoMap}|${JSON.stringify(s.awk || {})}|${JSON.stringify(app.where?.list() || [])}`;
        if (nsig === sig) return;
        sig = nsig;
        const here = W.mapOf(s.map);
        if (fac === 'king') {
          box.replaceChildren(foldBox('king', h('p', { class: 'muted' }, '권장 레벨 99 · 제12왕에서 제1왕 검왕까지. 두목 구역에 들어갈 때 혼자 또는 문파원과 함께를 골라요. 전반 다섯 왕은 직업 세트 조각, 후반 일곱 왕은 세트 강화석을 떨궈요.')));
          for (const zn of W.ZONE_ORDER) if (zn.king) zoneCard(box, zn, here);
          return;
        }
        const F = MS.factionOf(fac);
        const won = MS.mastersOf(fac).filter((m) => s.duel.won[m.id]).length;
        box.replaceChildren(
          h('div', { class: 'card fac-head', style: `--fc:${F.col}` }, h('b', {}, `${F.name} `, h('small', {}, F.hanja)), h('p', { class: 'muted' }, F.desc)),
          h('div', { class: `row map-row${here.town ? ' me' : ''}` }, h('div', { class: 'ico' }, '촌'),
            h('div', { class: 'info' }, h('div', { class: 'name' }, '객잔 마을'), h('div', { class: 'desc' }, '쉬는 곳 — 체력이 빨리 차요')),
            h('button', { class: 'buy', disabled: here.town ? true : null, onclick: () => { game.goTown(); app.save(); app.closePanel(); app.refresh(); } }, here.town ? '여기' : '가기')),
          h('h3', { class: 'king-head' }, '사냥터', h('small', {}, '레벨과 상관없이 어디든 — ⚠는 내 레벨보다 훨씬 센 곳')),
          // v260: 적정 사냥터 따라가기 — 레벨이 오르면 알맞은 다음 구역으로 저절로 옮긴다
          h('label', { class: 'row auto-map' },
            h('input', { type: 'checkbox', checked: s.autoMap ? true : null, onchange: (e) => { game.s.autoMap = e.target.checked; if (game.s.autoMap) game.followMap(true); app.save(); sig = ''; this.update(); } }),
            h('div', { class: 'info' }, h('div', { class: 'name' }, '알맞은 사냥터 따라가기'),
              h('div', { class: 'desc' }, '레벨이 사냥터보다 3 넘게 높아지면 알맞은 구역으로 저절로 옮겨요. 두목·고수·왕 구역에 있을 땐 그대로 둬요.'))));
        for (const z of MS.FAC_ZONES[fac]) { const zn = W.ZONE_ORDER.find((x) => x.id === z); if (zn) zoneCard(box, zn, here); }
        // v204: 고수(두목)는 '무림고수' 칸으로 따로 모았다
        box.append(h('button', { class: 'card fac-masters-link', style: `--fc:${F.col}`, onclick: () => app.showTab('map', 'masters') },
          h('b', {}, `${fac === 'magyo' ? '팔마존 · 천마' : fac === 'murim' ? '정파 칠대고수 · 무림맹주' : '사도 칠대고수 · 사도맹주'} → 무림고수 칸`),
          h('small', {}, ` 쓰러뜨림 ${won}/${MS.mastersOf(fac).length}`)));
      },
    };
  }
  // v407·v409 각성 고수 — 5차를 마치고 그 두목을 한 번 쓰러뜨렸으면 켤 수 있다(두목 방에 각성한 모습으로)
  function awakenCard() {
    const s = game.s;
    const rows = W.AWAKEN_IDS.map((id) => {
      const a = W.AWAKEN[id], open = game.awakenOpen(id), on = game.awakenActive(id), n = s.awk?.kills?.[id] || 0, best = s.awk?.best?.[id];
      const room = game.awakenRoom(id), here = s.map === room;
      const base = a.king ? '제1왕 검왕' : MS.masterOf(id)?.name || id;
      return h('div', { class: `awk-row${on ? ' on' : ''}` },
        h('div', { class: 'awk-info' }, h('b', {}, `覺 ${a.name}`),
          h('small', { class: 'muted' }, open
            ? ` 체력 ×${a.hp} · 공격 ×${a.atk} · ${n ? `${n}번 · 가장 빨리 ${best}초` : `처음 쓰러뜨리면 보상 ×${W.AWAKEN_FIRST_K}`} · 잡을 때마다 ${rewardText(game.awakenReward(id))} · 전용 문양 ${s.awk?.rings?.[id] ? '✓ 얻음' : `${Math.round(W.AWAKEN_RING_P * 100)}%(${W.AWAKEN_RING_PITY + 1}번째엔 꼭 · 지금 ${s.awk?.rpity?.[id] || 0})`}`
            : ` 🔒 5차 전직을 마치고 ${base}을(를) 한 번 쓰러뜨리면`)),
        h('div', { class: 'awk-btns' },
          h('button', { class: `btn ${on ? '' : 'primary'}`, id: `awk-${id}`, disabled: open ? null : true,
            onclick: () => { game.setAwaken(id, !on); app.save(); toast(on ? `${base} — 다음 두목부터 보통으로` : `覺 ${a.name} — 다음 두목부터 각성한 모습으로 서요`); app.refresh(); } }, on ? '끄기' : '각성 켜기'),
          open && room != null ? h('button', { class: 'btn', disabled: here ? true : null, onclick: () => go(room) }, here ? '여기' : '가기') : ''));
    });
    const done = W.AWAKEN_IDS.filter((id) => (s.awk?.kills?.[id] || 0) > 0).length;
    return h('div', { class: 'card awk-card' }, h('h3', {}, '覺 각성 고수', h('small', {}, ` 5차 뒤 · ${done}/${W.AWAKEN_IDS.length} 쓰러뜨림 · 칭호 〈${W.TITLES.awkAll.name}〉`)), ...rows);
  }
  // 무림고수 (v204) — 세 세력의 고수·맹주·천마를 한 칸에. 세력별로 묶고 레벨 차례.
  // v424 무림고수 — 한 줄씩 접힌 목록(얼굴·이름·레벨·별·가기), 누르면 펼친다 · 아직/쓰러뜨림 거르기 · 다음 목표 한 장 · 각성 고수는 열리기 전엔 접어 둔다
  const mOpen = new Set();
  let mFilter = 'all';
  function masterRow(m, fac) {
    const s = game.s;
    if (m.hidden && !s.duel.won.hwamugi) return masterCard(m, fac);
    const won = !!s.duel.won[m.id];
    const room = W.mapId(W.masterZoneOf(m.id), W.BOSS_AREA);
    const here = s.map === room;
    const risky = game.danger(room) > W.DANGER_LV;
    const st = game.duelStars(m.id);
    const open = mOpen.has(m.id);
    const head = h('div', { class: 'mr-head', onclick: () => { if (open) mOpen.delete(m.id); else mOpen.add(m.id); this_update(); } },
      masterPortrait(m.look),
      h('div', { class: 'master-name' },
        h('b', {}, `${m.title} `, h('span', {}, m.name)),
        h('small', {}, `Lv.${m.lv}${risky ? ' ⚠위험' : ''}${won ? ` · 공격력·체력 +${Math.round(MS.masterBonusOf(m) * 100 * (1 + MS.STAR_BONUS * st.extra))}% 영구` : ' · 아직'}`)),
      h('div', { class: 'mr-stars' }, ...[st.won, st.fast, st.clean].map((on) => h('span', { class: on ? 'on' : '' }, '★'))),
      h('button', { class: `btn mini ${here || won ? '' : 'primary'}`, disabled: here ? true : null, onclick: (e) => { e.stopPropagation(); go(room); } }, here ? '여기' : '가기'),
      h('i', { class: 'mr-arrow' }, open ? '▴' : '▾'));
    const body = open ? h('div', { class: 'mr-body' },
      h('div', { class: 'muted' }, `수하 ${m.mobs.map((x) => x.name).join('·')} · 초식: ${m.skills.map((k) => k.name).join(' · ')}`),
      h('p', { class: 'mr-story' }, m.story),
      h('div', { class: 'master-rw' }, won ? '✓ 쓰러뜨렸어요 — 눌러앉아 파밍하세요(두목 방에서 세력 재료)' : `처음 쓰러뜨리면 ${rewardText(MS.masterReward(m))} · 공격력·체력 +${Math.round(MS.masterBonusOf(m) * 100)}% 영구`),
      h('div', { class: 'duel-stars' },
        h('span', { class: st.won ? 'on' : '' }, '★', h('small', {}, '쓰러뜨림')),
        h('span', { class: st.fast ? 'on' : '' }, '★', h('small', {}, `${MS.starSec(m)}초 안에`)),
        h('span', { class: st.clean ? 'on' : '' }, '★', h('small', {}, '초식에 안 맞고')),
        h('small', { class: 'muted' }, ` 별 하나마다 덤 +${MS.STAR_BONUS * 100}%`))) : null;
    return h('div', { class: `card master-row${m.lord ? ' lord' : ''}${won ? ' won' : ''}${here ? ' me' : ''}${open ? ' open' : ''}`, style: `--fc:${fac.col}` }, head, body);
  }
  let this_update = () => {};
  function mastersView() {
    const box = h('div');
    let sig0 = '';
    const self = {
      root: box,
      update() {
        const s = game.s;
        const nsig = `${s.level}|${s.map}|${JSON.stringify(s.duel.won)}|${JSON.stringify(s.duel.stars || {})}|${!!game.inst}|${JSON.stringify(s.awk || {})}|${game.cheonmaOn()}|${mFilter}|${[...mOpen].join(',')}`;
        if (nsig === sig0) return;
        sig0 = nsig;
        const all = ['murim', 'sapa', 'magyo', 'apex'].flatMap((f) => MS.mastersOf(f)).filter((m) => !m.hidden || s.duel.won.hwamugi);
        const won = all.filter((m) => s.duel.won[m.id]).length;
        const stars = all.reduce((a, m) => a + game.duelStars(m.id).n, 0);
        const next = all.filter((m) => !s.duel.won[m.id] && !(m.hidden && !s.duel.won.hwamugi)).sort((a, b) => a.lv - b.lv)[0];
        const awkOpen = W.AWAKEN_IDS.some((id) => game.awakenOpen(id));
        box.replaceChildren(
          h('div', { class: 'mr-top' },
            h('div', { class: 'chip-row' }, ...[['all', '전체'], ['todo', '아직'], ['won', '쓰러뜨림']].map(([k, name]) => h('button', { class: `chip${mFilter === k ? ' on' : ''}`, onclick: () => { mFilter = k; sig0 = ''; self.update(); } },
              `${name} ${k === 'all' ? all.length : k === 'won' ? won : all.length - won}`))),
            h('small', { class: 'muted' }, `쓰러뜨림 ${won}/${all.length} · 별 ${stars}/${all.length * 3}`)),
          next && mFilter !== 'won' ? h('div', { class: 'card mr-next' }, h('b', {}, '🎯 다음 목표 '), h('span', {}, `${next.title} ${next.name} · Lv.${next.lv}`),
            h('button', { class: 'btn mini primary', onclick: () => go(W.mapId(W.masterZoneOf(next.id), W.BOSS_AREA)) }, '가기')) : null,
          foldBox(`${awkOpen ? '' : '-'}awkcard|覺 각성 고수`, awakenCard()));
        for (const fac of ['murim', 'sapa', 'magyo', 'apex']) {
          const F = MS.factionOf(fac);
          const ms = MS.mastersOf(fac).slice().sort((a, b) => a.lv - b.lv).filter((m) => mFilter === 'all' || (mFilter === 'won') === !!s.duel.won[m.id]);
          if (!ms.length) continue;
          const w = ms.filter((m) => s.duel.won[m.id]).length;
          box.append(h('h3', { class: 'king-head', style: `color:${F.col}` }, `${F.name} ${fac === 'apex' ? '천하제일인 · 히든' : fac === 'magyo' ? '팔마존 · 천마' : fac === 'murim' ? '칠대고수 · 무림맹주' : '칠대고수 · 사도맹주'}`,
            h('small', {}, ` ${w}/${ms.length}`)));
          for (const m of ms) box.append(masterRow(m, F));
        }
      },
    };
    this_update = () => self.update();
    return self;
  }
  return subTabs([
    { key: 'murim', label: '무림맹', make: () => zoneView('murim') },
    { key: 'sapa', label: '사파', make: () => zoneView('sapa') },
    { key: 'magyo', label: '마교', make: () => zoneView('magyo') },
    { key: 'king', label: '십이지왕', make: () => zoneView('king') },
    { key: 'masters', label: '무림고수', make: () => mastersView() },
  ], 'ifu.mapsub2');
}

// 고수 얼굴 (작은 그림) — 무인 그림을 그대로 줄여 그린다
function masterPortrait(look) {
  const cv = document.createElement('canvas');
  const q = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = 56 * q;
  cv.className = 'master-face';
  const x = cv.getContext('2d');
  x.scale(q, q);
  x.save(); x.translate(28, 55); x.scale(0.4, 0.4);
  drawFighter(x, 0, 0, { ...look, scale: 1 }, { t: 0, weapon: look.weapon || 'sword', blade: '#e5e7eb', hold: true });
  x.restore();
  return cv;
}

// ---------- 던전 창 (v147) ----------
// 지도 창 한 칸에 일일 던전 셋 · 탑 · 십이지 · 토벌이 한 줄로 쌓여 있었다(중구난방).
// 이제 따로 창 하나에 칸 넷: 일일 던전 | 무한의 탑 | 십이지 | 문파 토벌.
function dgnTab(app) {
  const { game } = app;
  const stagePick = {};
  let bump = 0;
  let wbPick = null;   // v375 펼쳐 본 마왕
  const start = (fn) => { if (!fn()) return; app.save(); app.closePanel(); app.refresh(); };
  const sigOf = () => {
    const s = game.s;
    const now = Date.now();
    const net = app.net;
    const rd = net?.raid;
    const nsig = `${s.level}|${JSON.stringify(s.dgn)}|${s.tower.floor}|${s.tower.auto}|${D.kstDay(now)}|${JSON.stringify(stagePick)}|${!!game.inst}|${!!s.job}|${JSON.stringify(s.zTickets)}|${s.mounts.length}|${net?.status}|${s.guildId}|${rd?.kind}|${rd?.total}|${rd?.maxHp}|${JSON.stringify(rd?.claimed || {})}|${JSON.stringify(s.raid)}|${JSON.stringify(s.wraid)}|${Object.values(net?.wgen || {}).map((r) => `${r?.id}:${r?.total}:${Object.keys(r?.claimed || {}).length}:${Object.keys(r?.damage || {}).length}`).join(',')}|${Object.keys(net?.wdone || {}).join(',')}|${wbPick}|${JSON.stringify(s.wraid?.gates || {})}|${JSON.stringify(s.wraid?.read || {})}.${s.wraid?.ok}.${s.wraid?.sk}|${W.SLOTS.map((x) => `${s.equip[x.id]?.set}${s.equip[x.id]?.plus}`).join('')}|${D.WRAID_IDS.map((b) => app.wbLobby?.count(b) || 0).join('')}`;
    return `${bump}|${nsig}`;
  };
  // 어느 칸이든 맨 위에 — 던전 안이거나 직업이 없으면 알린다
  const notes = () => [
    !game.s.job ? h('p', { class: 'muted' }, '캐릭터를 먼저 고르세요.') : null,
    game.inst ? h('p', { class: 'muted' }, '지금 던전 안이에요 — 끝나면 다시 고를 수 있어요.') : null,
  ];
  const views = [];
  function view(build) {
    const box = h('div');
    let sig = '';
    const v = {
      root: box,
      update() {
        const n = sigOf();
        if (n === sig) return;
        sig = n;
        box.replaceChildren(...[...notes(), ...build()].filter(Boolean));
      },
    };
    views.push(v);
    return v;
  }
  const rerender = () => { bump++; t.update(); };
  function buildDaily() {
    const s = game.s;
    const now = Date.now();
    const sweepN = D.DAILY.reduce((a, d) => a + (game.canSweep(d.id, now) ? game.dailyLeft(d.id, now) : 0), 0);
        // 자동 도전 — 켜 두면 열린 던전을 갈 수 있는 가장 높은 단계로 알아서 돈다
    const dAuto = h('input', { type: 'checkbox' });
    dAuto.checked = !!s.dgn.auto;
    dAuto.onchange = () => { s.dgn.auto = dAuto.checked; app.save(); rerender(); };
    // v283 등반 모드 — 자동은 새 단계만 오르고, 막히면 소탕하지 않고 멈춘다(남은 횟수는 그대로)
    const dClimb = h('input', { type: 'checkbox' });
    dClimb.checked = s.dgn.climb !== false;
    dClimb.onchange = () => {
      s.dgn.climb = dClimb.checked; app.save(); rerender();
      toast(s.dgn.climb ? '등반 모드 — 자동은 새 단계만 오르고, 막히면 멈춰요(남은 횟수는 그대로)' : '등반 모드를 껐어요 — 자동이 막히면 남은 횟수를 소탕해요');
    };
    // v230: 던전 루틴 — 요일 던전 모두 → 무한의 탑 → 사냥터. 켜 두면 방치 중에도 알아서 돈다.
    const leftAll = D.DAILY.reduce((a, d) => a + (D.dailyOpen(d, now) ? game.dailyLeft(d.id, now) : 0), 0);
    const twOk = game.canTower() && game.towerRetryOk();
    // v283 등반 모드면 자동이 오를 곳(아직 못 깬 단계 · 오늘 안 진 곳)만 센다
    const climbOn = s.dgn.climb !== false;
    const climbN = D.DAILY.filter((d) => {
      const mx = game.dailyMaxStage(d.id);
      return game.canDaily(d.id, mx, now) && mx > game.dailyBest(d.id) && (game.dgnToday(now).fail[d.id] || 0) < mx;
    }).length;
    const step = (ico, label, sub, on) => h('div', { class: `rt-step${on ? ' on' : ''}` }, h('i', {}, ico), h('b', {}, label), h('small', {}, sub));
    const routine = h('div', { class: `card rt-card${s.dgn.routine ? ' on' : ''}` },
      h('div', { class: 'rt-head' },
        h('div', {}, h('b', {}, '🔁 던전 루틴'), h('small', { class: 'muted' }, ' 켜 두면 방치 중에도 알아서 돌아요')),
        h('button', { class: `btn ${s.dgn.routine ? 'good' : 'primary'}`, onclick: () => {
          s.dgn.routine = !s.dgn.routine; app.save(); rerender();
          toast(s.dgn.routine ? '던전 루틴을 켰어요 — 요일 던전 → 탑 → 사냥터' : '던전 루틴을 껐어요');
          if (s.dgn.routine && game.routineNext()) start(() => game.startRoutine());
        } }, s.dgn.routine ? '켜짐' : '켜기')),
      h('div', { class: 'rt-steps' },
        step('日', '요일 던전', climbOn ? (climbN ? `${climbN}곳 오르기` : leftAll ? `막힘 · ${leftAll}번 남김` : '오늘 끝') : leftAll ? `${leftAll}번 남음` : '오늘 끝', climbOn ? climbN > 0 : leftAll > 0),
        h('span', { class: 'rt-arrow' }, '›'),
        step('塔', '무한의 탑', game.s.tower.floor >= D.TOWER_MAX ? '끝까지' : twOk ? `${game.s.tower.floor + 1}층 도전` : '더 세지면', twOk),
        h('span', { class: 'rt-arrow' }, '›'),
        step('獵', '사냥터', '돌아가 사냥', true)));
    const head = h('div', { class: 'card dgn-head' },   // v423 줄 나누기 — 제목·소탕 단추 / 설명(접기) / 목표 / 선택
      h('div', { class: 'dgn-head-top' }, h('b', {}, '일일 던전'), h('button', { class: 'btn primary', disabled: sweepN ? null : true, onclick: () => {
        const got = game.sweepAll(now);
        if (!got.length) return;
        app.save(); app.refresh();
        toast(`소탕 ${got.length}번 — ${got.map((x) => rewardText(x.reward)).join(' / ')}`);
      } }, sweepN ? `모두 소탕 (${sweepN})` : '모두 소탕')),
      foldBox('daily', h('small', { class: 'muted' }, `도전은 언제든 · 온전한 보상은 하루 ${D.DAILY_ENTRIES}번(남긴 것은 다음 날로) · 새 단계 🔑는 몫을 안 써요 · 그 뒤는 ${Math.round(D.DAILY_EXTRA * 100)}%`)),
        (() => {   // v403 높은 단계 첫 돌파 칭호 — 다음 목표
          const top = Math.max(0, ...D.DAILY.map((d) => game.dailyBest(d.id)));
          const nx = [50, 75, 100].find((n) => top < n);
          return h('div', { class: 'muted dgn-goal' }, nx ? `🏅 어느 요일이든 ${nx}단계를 처음 넘으면 칭호 〈${W.TITLES[`daily${nx}`].name}〉(${W.TITLES[`daily${nx}`].desc.split(' · ')[0]}) · 지금 가장 높이 ${top}단계` : `🏅 〈${W.TITLES.daily100.name}〉 — 요일 던전 칭호를 모두 얻었어요`);
        })(),
        game.s.dgn.pauseUntil > Date.now() ? h('div', { class: 'muted dgn-goal' }, `⏸ 나가기를 눌러 자동 던전이 쉬는 중(${Math.ceil((game.s.dgn.pauseUntil - Date.now()) / 60e3)}분) `,
          h('button', { class: 'btn', id: 'dgn-resume', style: 'padding:2px 10px;font-size:12px', onclick: () => { game.s.dgn.pauseUntil = 0; app.save(); toast('자동 던전을 다시 켰어요'); rerender(); } }, '다시 켜기')) : '',
      h('div', { class: 'dgn-opts' },
        h('label', { class: 'chk' }, dAuto, ' 요일 던전만 자동'),
        h('label', { class: 'chk', title: '자동(루틴 포함)이 새 단계만 오르고, 막히면 소탕하지 않고 멈춰요' }, dClimb, ' 등반 모드(막히면 멈춤)')));
    const cards = D.DAILY.map((d) => {
      const open = D.dailyOpen(d, now);
      const left = game.dailyLeft(d.id, now);
      const best = game.dailyBest(d.id);
      const max = game.dailyMaxStage(d.id);
      const stg = Math.max(1, Math.min(max, stagePick[d.id] ?? max));
      const rw = D.dailyReward(d.id, stg, game.levelGapMult(D.dailyLv(stg)), game.s.level);
      const step = (k) => { stagePick[d.id] = Math.max(1, Math.min(max, stg + k)); rerender(); };
      return h('div', { class: `card dgn-card dgn-${d.id}${open ? '' : ' closed'}` },
        h('div', { class: 'dgn-top' },
          skinImg(h('div', { class: 'dgn-ico' }, d.ico), `dg-${d.id}`),
          h('div', { class: 'dgn-name' }, h('b', {}, d.name), h('small', {}, ` ${d.hanja} · ${d.what}`),
            open ? h('div', { class: 'dgn-pips' }, ...Array.from({ length: Math.max(D.DAILY_ENTRIES, left) }, (_, i) => h('i', { class: i < left ? 'on' : '' })),
              h('small', {}, ` 보상 몫 ${left}번 · 깬 단계 ${best || '-'}${max > best ? ` · ${best + 1}단계 🔑` : ''}`))
              : h('div', { class: 'muted' }, `${D.dailyDaysText(d)}요일에 열려요`))),
        h('div', { class: 'dgn-stage' },
          h('button', { class: 'stp', disabled: stg <= 1 ? true : null, onclick: () => step(-1) }, '−'),
          h('div', { class: 'stg' }, h('b', {}, `${stg}단계`), h('small', {}, ` 몹 Lv.${D.dailyLv(stg)}${stg > D.DAILY_BASE ? ` · 세기 ×${D.dailyOverK(stg).toFixed(1)} · 보상 ×${D.dailyRwK(stg).toFixed(2)}` : ''}${D.dailyLv(stg) - s.level > W.DANGER_LV ? ' ⚠위험' : ''}`)),
          h('button', { class: 'stp', disabled: stg >= max ? true : null, onclick: () => step(1) }, '+'),
          h('div', { class: 'rw' }, ...rewardNodes(app, rw, '보상 '))),
        // 천공광맥은 단계마다 나오는 재료가 통째로 바뀐다 — 어느 지역인지 적는다
        d.id === 'mat'
          ? h('p', { class: 'muted dgn-where' },
            `${W.zoneOfW(D.zoneForLv(D.dailyLv(stg)))?.name || ''}의 재료·증표예요 — 이름을 누르면 그 사냥터로 갈 수 있어요`)
          : null,
        // v258: 도전을 못 할 때 왜 못 하는지 한 줄
        !game.canDaily(d.id, stg, now) && game.s.job ? h('p', { class: 'inf-why' }, game.inst ? '던전 안에서는 다른 던전에 못 들어가요' : !D.dailyOpen(d, now) ? '오늘은 열리지 않는 던전이에요' : '아직 열리지 않은 단계예요') : null,
        // v302 몫이 없고 이미 깬 단계면 — 도전은 되지만 보상 10%
        game.canDaily(d.id, stg, now) && !game.dailyFull(d.id, stg, now) ? h('p', { class: 'inf-why' }, `오늘 보상 몫을 다 썼어요 — 도전은 할 수 있지만 보상 ${Math.round(D.DAILY_EXTRA * 100)}% (${best + 1}단계를 깨면 온전히)`) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', disabled: game.canDaily(d.id, stg, now) ? null : true, onclick: () => start(() => game.startDaily(d.id, stg, now)) },
            `도전 (${D.DAILY_SEC}초 · ${D.DAILY_KILLS}마리)${stg > best ? ' 🔑' : !game.dailyFull(d.id, stg, now) ? ` · 보상 ${Math.round(D.DAILY_EXTRA * 100)}%` : ''}`),
          h('button', { class: 'btn', disabled: game.canSweep(d.id, now) ? null : true, onclick: () => {
            const r = game.sweepDaily(d.id, now);
            if (!r) return;
            app.save(); app.refresh();
            toast(`${d.name} ${best}단계 소탕 — ${rewardText(r)}`);
          } }, best ? `소탕 ${best}단계` : '소탕')));
    });
    return [routine, head, ...cards];
  }
  function buildTower() {
    const s = game.s;
    // 무한의 탑
    const tw = s.tower;
    const nf = tw.floor + 1;
    const nb = D.towerBoss(nf);
    const auto = h('input', { type: 'checkbox' });
    auto.checked = tw.auto;
    auto.onchange = () => { tw.auto = auto.checked; app.save(); };
    const tower = h('div', { class: 'card dgn-card dgn-tower' },
      h('div', { class: 'dgn-top' },
        skinImg(h('div', { class: 'dgn-ico' }, '塔'), 'dg-tower'),
        h('div', { class: 'dgn-name' }, h('b', {}, '무한의 탑'), h('small', {}, ` 無限塔 · 영구 능력치`),
          h('div', { class: 'muted' }, `오른 층 ${tw.floor} · 공격력·체력 +${(D.towerBonus(tw.floor) * 100).toFixed(1).replace(/\.0$/, '')}%`))),
      foldBox('tower',
      h('p', { class: 'muted dgn-desc' }, `${D.TOWER_MAX}층까지. 층마다 수문장 하나 — ${duration(D.TOWER_SEC)} 안에 쓰러뜨리면 다음 층. 오른 층마다 공격력·체력 +${D.TOWER_BONUS * 100}% 영구. 횟수 제한 없음.`),
      h('p', { class: 'dgn-warn' }, '⚠ 수문장은 바닥에 붉은 경고를 깔고 크게 쳐요(두 번 맞으면 거의 쓰러져요). 자동으로는 안 피해요 — 화면을 눌러 끌어서(조이스틱) 직접 피하세요. 탑에서는 물약을 못 써요.')),
      D.zodiacOf(nf) ? h('p', { class: 'dgn-zodiac' }, `${nf}층 ${D.zodiacOf(nf).god} — ${D.zodiacOf(nf).move}`) : null,
      h('div', { class: 'dgn-stage' },
        h('div', { class: 'stg' }, h('b', {}, `${nf}층`), h('small', {}, ` ${nb.name.replace(/^\d+층 수문장 /, '')} · Lv.${D.towerLv(nf)}${D.towerPow(nf) > 1 ? '+' : ''}`)),
        h('div', { class: 'rw' }, ...rewardNodes(app, D.towerReward(nf), '처음 오르면 '))),
      h('label', { class: 'chk' }, auto, ' 이기면 이어서 다음 층으로'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', disabled: game.canTower() ? null : true, onclick: () => start(() => game.startTower()) }, tw.floor >= D.TOWER_MAX ? '꼭대기까지 올랐어요' : `${nf}층 도전`)));
    const out = [tower];
    // v350 무한의 탑 · 극(極) — 하드 모드
    {
      const hf = tw.hard || 0, open = tw.floor >= D.HARD_OPEN, nh = Math.min(D.HARD_MAX, hf + 1);
      const nb2 = D.hardBoss(nh), nmd = D.hardMountOf(nh);
      const mounts = W.HARD_MOUNTS.map((m, i) => {
        const own = s.mounts.some((x) => x.kind === m.id);
        return h('div', { class: `hard-mt${own ? ' own' : ''}${hf >= (i + 1) * 10 ? ' clear' : ''}`, style: `--mc:${m.col}`, title: `${m.name} — ${m.desc} · 이동 +${W.spdPct(m.speed)}%(길들이기 최대 20) · 공격·체력 +${Math.round(m.stat * 100)}% · ${m.sp}` },
          creatureIcon(m.id, 46), h('b', {}, m.name), h('small', {}, own ? '얻음 ✓' : `극 ${(i + 1) * 10}층`));
      });
      out.push(h('div', { class: `card dgn-card hard-card${open ? '' : ' locked'}` },
        h('div', { class: 'hard-glow' }),
        h('div', { class: 'dgn-top' }, h('div', { class: 'dgn-ico hard-ico' }, '極'),
          h('div', { class: 'dgn-name' }, h('b', {}, '무한의 탑 · 극'), h('small', {}, ' 無限塔 極 · 하드 모드'),
            h('div', { class: 'muted' }, open ? `극 ${hf}층 · 덤 공격력·체력 +${(D.hardBonus(hf) * 100).toFixed(1).replace(/\.0$/, '')}%` : `보통 탑 ${D.HARD_OPEN}층을 오르면 열려요 (지금 ${tw.floor}층)`))),
        foldBox('hard', h('p', { class: 'muted dgn-desc' }, `${D.HARD_MAX}층. 수문장이 엄청나게 단단하고(같은 세기 보통 층의 체력 20배 넘게) 붙어 치는 것도 세 배, 경고가 짧고 잦고 아파요. 초식도 더 — 도는 칼날·천라지망·붕괴…. 층마다 공격력·체력 +${D.HARD_BONUS * 100}% 영구, 10층마다 신수가 몸소 지켜요 — 이기면 그 신수가 내 탈것으로.`)),
        h('div', { class: 'hard-mounts' }, ...mounts),
        open && hf < D.HARD_MAX ? h('div', { class: 'dgn-stage' },
          h('div', { class: 'stg' }, h('b', {}, `극 ${nh}층`), h('small', {}, ` ${nb2.name.replace(/^극 \d+층 (수문장|신수) /, '')} · Lv.${D.hardLv(nh)} · ${duration(D.hardSec(nh))}`)),
          h('div', { class: 'rw' }, ...rewardNodes(app, D.hardReward(nh), '처음 오르면 '), nmd && !s.mounts.some((x) => x.kind === nmd.id) ? h('span', { class: 'hard-prize' }, `+ 신수 ${nmd.name}`) : null)) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary hard-go', id: 'hard-go', disabled: game.canHard() ? null : true, onclick: () => start(() => game.startHard()) },
            !open ? `🔒 보통 ${D.HARD_OPEN}층부터` : hf >= D.HARD_MAX ? '극을 모두 올랐어요' : `⚡ 극 ${nh}층 도전`))));
    }
    // v263 주간 회랑 — 120층 위, 한 주마다 초식 조합이 바뀐다
    if (tw.floor >= D.TOWER_MAX) {
      const c = game.corridorState();
      const cf = D.TOWER_MAX + c.best + 1;
      out.push(h('div', { class: 'card dgn-card dgn-tower corridor' },
        h('div', { class: 'dgn-top' }, h('div', { class: 'dgn-ico' }, '廊'),
          h('div', { class: 'dgn-name' }, h('b', {}, '끝없는 회랑'), h('small', {}, ` 無盡回廊 · 이번 주 ${c.best}층 · 기록 ${Math.max(c.all || 0, c.best)}층 · 영구 +${(D.corridorBonus(c.all) * 100).toFixed(2).replace(/\.?0+$/, '')}%`),
            h('div', { class: 'muted' }, `이번 주 초식: ${D.corridorPats().map((p) => D.TELL_NAMES[p] || p).join(' · ')}`))),
        foldBox('corridor', h('p', { class: 'muted dgn-desc' }, `${D.TOWER_MAX}층 위로 끝없이. 층마다 수문장이 ${Math.round((D.CORRIDOR_HP_UP - 1) * 100)}%씩 단단해지고 보상도 늘어요. 기록 층마다 공격력·체력 +${D.CORRIDOR_BONUS * 100}% 영구(상한 없음) · 새 기록이면 은자 세 배 + 조각(10층마다 더). 월요일 0시(한국 시간)마다 이번 주 층은 처음부터, 초식 조합이 바뀌어요(기록·덤은 남아요).`)),
        h('div', { class: 'dgn-stage' }, h('div', { class: 'stg' }, h('b', {}, `${cf - D.TOWER_MAX}층`), h('small', {}, cf - D.TOWER_MAX > (c.all || 0) ? ` 새 기록 · 은자 ${fmt(D.corridorRecordReward(cf).gold)} + 조각 · 영구 +${D.CORRIDOR_BONUS * 100}%` : ` 이번 주 처음 오르면 은자 ${fmt(D.corridorGold(cf))}`))),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', disabled: game.canCorridor() ? null : true, onclick: () => start(() => game.startCorridor()) }, `회랑 ${cf - D.TOWER_MAX}층 도전`))));
    }
    return out;
  }
  function buildZodiac() {
    const s = game.s;
    const tw = s.tower;
    // 십이지 — 10층마다 신 하나. 뽑기권이 있으면 뽑기, 신수를 가졌으면 표시
    const zodiacCard = h('div', { class: 'card zodiac-card' },
      h('h3', {}, '십이지 탈것 뽑기', h('small', {}, ` 10층마다 그 신의 뽑기권 ${D.ZODIAC_TICKETS}장 · 신수 ${Math.round(D.ZODIAC_RATE * 100)}% (셋째에 꼭)`)),
      h('div', { class: 'zodiac-grid' }, ...D.ZODIAC.map((z) => {
        const n = s.zTickets[z.no] || 0;
        const own = game.zodiacOwned(z.no);
        const md = W.mountOf(z.mount);
        const cleared = tw.floor >= z.no * 10;
        return h('button', {
          class: `zodiac-cell${own ? ' own' : ''}${n ? ' ready' : ''}${cleared ? '' : ' locked'}`,
          disabled: n ? null : true,
          title: `${z.god} · ${md.name} (이동 +${W.spdPct(md.speed)}% · 공격·체력 +${Math.round(md.stat * 100)}%)`,
          onclick: () => { const mt = game.drawZodiac(z.no); if (!mt) return; app.save(); rerender(); app.refresh(); },
        }, creatureIcon(z.mount, 40), h('b', {}, `${z.ji} ${z.animal}`), h('small', {}, n ? `뽑기 ${n}` : own ? '신수 ✓' : `${z.no * 10}층`));
      })));
    return [zodiacCard];
  }
  // v373 월드보스 · v375 칠대성(상시 최종 두목) · 천외천 옥황상제
  const finePointer = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  function buildWraid() {
    const s = game.s;
    const now = Date.now();
    const net = app.net;
    const on = !!net?.ready?.();
    const SLOT_NAME = Object.fromEntries(W.SLOTS.map((x) => [x.id, x.name]));
    const owned = (slot) => [...Object.values(s.equip), ...s.bag].filter((it) => it && it.set === 'palma' && it.slot === slot).sort((a, b) => (b.plus || 0) - (a.plus || 0))[0] || null;
    const go = async (boss, e) => {
      if (e) e.target.disabled = true;
      try {
        let r = net.wraidOf(boss);
        if (!r || net.wraidHpLeft(r) <= 0) r = await net.ensureWraid(boss);
        if (!r) throw new Error('마왕을 깨우지 못했어요');
        start(() => { const ok = game.startWraid({ id: r.id, hpLeft: net.wraidHpLeft(r), maxHp: r.maxHp }, now); if (ok) net.seenWraid?.(r.id).catch(() => {}); return ok; });   // v432 던전 창에서 들어가도 「들어왔다」 표시(늦은 한 몫) — 전엔 다시 합류 단추만
      } catch (err) { toast(`들어가지 못했어요: ${err.message || err}`); }
      rerender();
    };
    const claimBtn = (rr, label) => h('button', { class: `btn ${game.wraidPart(rr.id) ? 'primary' : ''} wraid-claim`, onclick: async (e) => {
      // v420 이 캐릭터가 친 판이 아니면(다른 캐릭터 몫) 한 번 묻는다 — 보상(대성신장)은 받는 캐릭터 것이 된다
      if (!game.wraidPart(rr.id) && !confirm('이 캐릭터가 친 기록이 없는 판이에요(다른 캐릭터 몫일 수 있어요). 이 캐릭터로 받으면 대성신장도 이 캐릭터 것이 돼요. 받을까요?')) return;
      e.target.disabled = true;
      try {
        const got = await net.claimWraid(rr, true);
        if (got) { toast(`🌋 ${got.boss.name} 처치 보상 — ${got.rank}위 · ${rewardText(got.reward)}${got.reward.item ? ` · 〈${W.itemName(got.reward.item, s.job)}〉` : got.reward.miss ? ` · 이번엔 대성신장이 안 나왔어요(${got.reward.miss.left}번 안에 꼭)` : ''}`); app.save(); app.refresh(); }
      } catch (err) { toast(`받지 못했어요: ${err.message || err}`); }
      rerender();
    } }, label);
    const out = [];
    // 머리 — 무엇인가
    out.push(h('div', { class: 'card wraid-intro' },
      h('div', { class: 'wraid-head', style: '--wb:#f97316' }, h('img', { class: 'wraid-banner', src: 'art/ui/wb-banner.webp', alt: '' }),
        h('div', { class: 'wraid-name' }, h('small', {}, '화무기 그 너머 · 무림 전체가 함께'), h('b', {}, '칠대성(七大聖)'))),
      foldBox('wraid', h('ul', { class: 'wraid-how' },
        h('li', {}, `👹 화과산의 의형제 칠대성(우마왕~손오공)이 늘 서 있어요 — 체력은 화무기의 ${D.WRAID_HP_K}배, 무림 사람 모두가 함께 깎아요(혼자서는 한참)`),
        h('li', {}, `🎯 탄을 피하며 쳐요 — 작은 흰 점만 맞아요 · 근거리는 코앞까지 붙어야, 원거리는 멀리서 · ${finePointer ? 'WASD·화살표' : '화면을 끌어'} 움직이고 손을 떼면 자동으로 피해요`),
        h('li', {}, `🛡 쓰러지면 한 대라도 친 사람 모두 순위 보상(1위 ×3 · 2~3위 ×2 · 10위까지 ×1.5) + 확률로 그 마왕의 대성신장 한 부위(1위 ${Math.round(D.PALMA_DROP(1) * 100)}% · 3위까지 ${Math.round(D.PALMA_DROP(3) * 100)}% · 10위까지 ${Math.round(D.PALMA_DROP(10) * 100)}% · 그 밖 ${Math.round(D.PALMA_DROP(99) * 100)}% · ${D.PALMA_PITY}번 못 받으면 다음엔 꼭) · 쓰러지면 곧 다음 마왕이 일어나요`),
        h('li', {}, '☁ 대성신장 일곱 부위를 모두 끼면 천외천 천궁 — 옥황상제에게 갈 수 있어요'),
        h('li', {}, '🛡 탄은 맞으면 사라져요 — 함께 치는 무인이 앞에서 막아 주면 뒤로 안 와요(탱커가 앞에 서면 좋아요)'),
        h('li', {}, `⚠ 단계가 오를수록 탄 한 대가 아파요(체력의 ${D.WB_TIER.map((t) => Math.round(t.hit * 100)).join('→')}%) · 싸우는 동안 회복(흡혈·물약)이 잘 안 들고 물약 숨이 길어요 — 직접 피하세요`),
        h('li', {}, `⏱ 한 판 ${D.WRAID_SEC}초 · 언제든 · 참여 보상은 판마다(제한 없음) · 레벨 ${D.WRAID_LV}부터`)))));
    // v413 자동 반복 — 판이 끝나면 같은 마왕(쓰러졌으면 다음 마왕)에 다시
    if (on && s.level >= D.WRAID_LV) out.push(h('label', { class: 'chk wraid-auto' }, h('input', { type: 'checkbox', id: 'wraid-auto', checked: s.wraid.auto ? true : null, onchange: (e) => { game.s.wraid.auto = e.target.checked; app.save(); toast(e.target.checked ? '🔁 칠대성 자동 반복 — 판이 끝나면 2초 뒤 같은 마왕에 다시 들어가요(나가기를 누르면 멈춰요)' : '자동 반복을 껐어요'); } }), ' 🔁 자동 반복(판이 끝나면 다시 들어가기)'));
    if (!on) out.push(h('p', { class: 'muted dgn-desc' }, '온라인일 때 들어갈 수 있어요.'));
    else if (s.level < D.WRAID_LV) out.push(h('p', { class: 'muted dgn-desc' }, `레벨 ${D.WRAID_LV}부터 마왕에게 갈 수 있어요.`));
    // 받을 것
    const claims = on ? net.wraidClaims() : [];
    if (claims.length) out.push(h('div', { class: 'card wraid-claims' }, h('b', {}, '🎁 쓰러진 마왕 — 보상 받기'),
      ...claims.map((r) => { const b = D.wraidBossOfId(r.id); const rk = net.wraidMyRank(r); return h('div', { class: 'wraid-prev' },
        h('span', {}, `${b.name} ${r.seq}번째 · 내 순위 ${rk}위 ×${D.wraidRankK(rk)}${b.slot ? ` · ${SLOT_NAME[b.slot]} 한 부위` : ''}${game.wraidPart(r.id) ? '' : ' · ⚠ 다른 캐릭터가 친 판'}`), claimBtn(r, game.wraidPart(r.id) ? '받기' : '이 캐릭터로 받기')); })));
    // 칠대성 여덟
    const grid = h('div', { class: 'wraid-grid' });
    // v386 빠른 합류 — 지금 사람이 가장 많은 마왕으로(문파원이 있으면 그쪽 먼저)
    if (on && s.level >= D.WRAID_LV && app.wbLobby) {
      const cand = D.WRAID_IDS.filter((id) => id === D.SEOKGA.id ? game.seokgaOpen() : id === D.OKHWANG.id ? game.okhwangOpen() : D.isGate(id) ? game.gateOpen(id) : true)
        .map((id) => ({ id, n: app.wbLobby.count(id), g: app.wbLobby.guild(id) })).filter((x) => x.n > 0)
        .sort((a, b) => b.g.length - a.g.length || b.n - a.n);
      const best = cand[0];
      out.push(h('div', { class: 'card wraid-quick' },
        best ? h('button', { class: 'btn primary', id: 'wraid-quick', disabled: game.inst ? true : null, onclick: (e) => go(best.id, e) },
          `⚡ 빠른 합류 — ${D.WRAID_BOSS[best.id].name} (${best.n}명${best.g.length ? ` · 문파원 ${best.g.join('·')}` : ''})`)
          : h('p', { class: 'muted', style: 'margin:0;font-size:12.5px' }, '⚡ 지금 토벌 중인 무인이 없어요 — 먼저 들어가면 다른 무인이 합류할 수 있어요. 문파원이 들어가면 알려 드려요.')));
    }
    for (const b of D.WRAID_BOSSES) {
      const r = on ? net.wraidOf(b.id) : null;
      const left = r ? net.wraidHpLeft(r) : 0;
      const frac = r ? left / r.maxHp : 1;
      const rg = D.wraidRage(frac);
      const mine = r?.damage?.[net?.uid] || 0;
      const have = owned(b.slot);
      const open = wbPick === b.id;
      const cell = h('div', { class: `wraid-cell${open ? ' open' : ''}`, style: `--wb:${b.col}` },
        h('button', { class: 'wraid-cell-top', onclick: () => { wbPick = open ? null : b.id; rerender(); } },
          h('img', { src: `art/boss/${b.art}.png`, alt: b.name }),
          h('div', { class: 'wraid-cell-name' }, h('b', {}, b.name), h('small', {}, `${b.hanja} · ${SLOT_NAME[b.slot]}`)),
          have ? h('span', { class: 'wraid-have' }, `✓ +${have.plus || 0}`) : null,
          app.wbLobby?.count(b.id) ? h('span', { class: 'wraid-ppl' }, `👥 ${app.wbLobby.count(b.id)}`) : ''),
        h('div', { class: `raid-hp wraid-hp rage${r ? rg : 0}` }, h('i', { style: `width:${frac * 100}%` }),
          h('span', {}, !r ? '깨어나지 않음' : left > 0 ? `${(frac * 100).toFixed(1)}%${rg ? ` · ${D.WRAID_RAGE[rg].name}` : ''}` : '쓰러짐')));
      if (open) {
        const rank = r ? net.wraidRank(r) : [];
        const myRank = r ? net.wraidMyRank(r) : 0;
        cell.append(...[
          h('p', { class: 'muted', style: 'font-size:12px;margin:4px 0' }, `${b.title} · 대성신장 〈${b.slot === 'weapon' ? `${b.name}의 무기` : `${b.name}의 ${b.piece}`}〉${r ? ` · ${r.seq}번째 마왕` : ''}`),
          r ? h('div', { class: 'raid-rank' }, ...rank.slice(0, 5).map(([uid, d], i) => h('div', { class: uid === net.uid ? 'me' : '' }, h('b', {}, `${i + 1}`), ` ${r.names?.[uid] || '?'}`, h('small', {}, ` ${fmt(d)}`))),
            rank.length ? null : h('div', { class: 'muted' }, '아직 아무도 안 쳤어요 — 첫 일격을!'),
            myRank > 5 ? h('div', { class: 'me' }, h('b', {}, `${myRank}`), ' 나', h('small', {}, ` ${fmt(mine)}`)) : null) : null,
          r ? h('p', { class: 'muted', style: 'font-size:12px;margin:2px 0 6px' }, `체력 ${fmt(left)} / ${fmt(r.maxHp)} · 내 피해 ${fmt(mine)}`) : null].filter(Boolean));
      }
      if (on && s.level >= D.WRAID_LV) cell.append(h('button', { class: 'btn primary wraid-go', id: `wraid-go-${b.id}`, disabled: game.inst ? true : null, onclick: (e) => go(b.id, e) }, r && left <= 0 ? '다음 마왕 깨우기' : `토벌하러 (${D.WRAID_SEC}초)`));
      grid.append(cell);
    }
    out.push(h('div', { class: 'card' }, h('h3', {}, '칠대성', h('small', {}, ` · 대성신장 ${G.PALMA_SLOTS.filter((sl) => owned(sl)).length}/${G.PALMA_SLOTS.length} 부위`)), grid));
    // 천외천 — 옥황상제
    {
      const ok = D.OKHWANG;
      const pr = game.palmaReady();
      const r = on ? net.wraidOf(ok.id) : null;
      const left = r ? net.wraidHpLeft(r) : 0;
      const card = h('div', { class: `card wraid-card wraid-heaven${pr.ok ? '' : ' locked'}`, style: `--wb:${ok.col}` },
        h('div', { class: 'wraid-head' }, h('img', { class: 'wraid-banner', src: 'art/ui/wb-heaven.webp', alt: '' }), h('img', { class: 'wraid-boss', src: `art/boss/${ok.art}.png`, alt: ok.name }),
          h('div', { class: 'wraid-name' }, h('small', {}, '천외천(天外天) · 천궁'), h('b', {}, ok.name, h('i', {}, ` ${ok.hanja}`)))),
        h('p', { class: 'muted dgn-desc' }, pr.ok ? `대성신장을 두른 자에게 남천문이 열렸어요. 관문 넷(사대천사 → 탁탑천왕 → 나타 → 이랑진군)을 차례로 넘으면 옥황상제 — 넘은 관문마다 천계의 가호 +${Math.round(D.GATE_BONUS * 100)}%(공격력·체력, 영구).`
          : `대성신장 일곱 부위를 모두 끼면 열려요 — 지금 ${pr.n}/${G.PALMA_SLOTS.length}`),
        h('div', { class: 'wraid-slots' }, ...W.SLOTS.filter((x) => G.PALMA_SLOTS.includes(x.id)).map((x) => { const it = s.equip[x.id]; const good = it?.set === 'palma'; const by = D.WRAID_BOSSES.find((b) => b.slot === x.id); return h('span', { class: `chip${good ? ' on' : ''}`, title: `${by?.name || ''}이(가) 줘요`, style: good ? `--gc:${W.RARITY[it.rar || 0].color};border-color:var(--gc)` : '' }, `${x.name}${good ? ` ${W.RARITY[it.rar || 0].name} +${it.plus || 0}` : ` ← ${by?.name || '?'}`}`); })),
        h('p', { class: 'muted', style: 'font-size:11.5px;margin:2px 0 6px' }, '같은 부위를 더 높은 등급으로 받으면 바로 바꿔 끼고, 강화 수치는 그대로 이어받아요(대성신장끼리 바꿔 끼면 강화를 맞바꿔요).'),
        h('button', { class: 'pref-link', id: 'heaven-story-btn', onclick: () => openModal((el) => {
          const draw = () => el.replaceChildren(h('h2', {}, '☁ 천계 이야기'),
            h('p', { class: 'muted', style: 'font-size:12.5px' }, `칠대성의 막내 제천대성이 한바탕 휘젓고 간 하늘 — 이제 그 신장을 두른 무인이 남천문 앞에 섰다. 한 장씩 열리고, 처음 읽으면 보상을 받아요(${game.storyUnread()}장 읽을 것).`),
            ...D.HEAVEN_STORY.map((x, i) => {
              const open = game.storyOpen(i), read = !!s.wraid.read?.[i];
              if (!open) return h('div', { class: 'heaven-story locked' }, h('b', {}, `${i + 1}장 · ???`), h('p', {}, `🔒 ${D.STORY_NEED_TEXT[x.need]} 열려요`));
              return h('div', { class: `heaven-story${read ? '' : ' new'}` }, h('b', {}, `${i + 1}장 · ${x.who}`),
                read ? h('p', {}, x.text) : h('button', { class: 'btn primary', style: 'margin-top:6px;padding:5px 10px;font-size:12.5px', onclick: () => { const r = game.readStory(i); if (r) { toast(`📜 ${x.who} — ${rewardText(r)}`); app.save(); app.refresh(); } draw(); } }, `읽고 보상 받기 (${rewardText(D.storyReward(s.level, i))})`));
            }),
            h('div', { class: 'btn-row' }, (s.wraid.sk || 0) >= 1 ? h('button', { class: 'btn', id: 'ending-again', onclick: () => { closeModal(); app.showEnding?.(); } }, '🎬 엔딩 다시 보기') : '', h('button', { class: 'btn primary', onclick: closeModal }, '닫기')));
          draw();
        }) }, `📜 천계 이야기${game.storyUnread() ? ` — 새 이야기 ${game.storyUnread()}장 · 보상` : ' — 옥황상제 · 사대천사 · 태백금성 · 태상노군 · 이랑진군 …'}`),
        h('div', { class: 'wraid-grid wraid-gates' }, ...D.HEAVEN_GATES.map((g) => {
          const gr = on ? net.wraidOf(g.id) : null;
          const gl = gr ? net.wraidHpLeft(gr) : 0;
          const done = !!s.wraid.gates?.[g.id];
          const open = game.gateOpen(g.id);
          return h('div', { class: `wraid-cell${open ? '' : ' locked'}`, style: `--wb:${g.col}` },
            h('div', { class: 'wraid-cell-top' }, h('img', { src: `art/boss/${g.art}.png`, alt: g.name }),
              h('div', { class: 'wraid-cell-name' }, h('b', {}, `${g.gate}. ${g.name}`), h('small', {}, `${g.hanja} · ${g.title}`)),
              done ? h('span', { class: 'wraid-have' }, '✓ 넘음') : null),
            h('div', { class: 'raid-hp wraid-hp' }, h('i', { style: `width:${gr ? (gl / gr.maxHp) * 100 : 100}%` }), h('span', {}, !gr ? '아직 아무도' : gl > 0 ? `${((gl / gr.maxHp) * 100).toFixed(1)}%` : '쓰러짐')),
            on && s.level >= D.WRAID_LV ? h('button', { class: 'btn primary wraid-go', id: `wraid-go-${g.id}`, disabled: open && !game.inst ? null : true, onclick: (e) => go(g.id, e) },
              open ? (gr && gl <= 0 ? '다시 세우기' : `관문 돌파 (${D.WRAID_SEC}초)`) : !pr.ok ? '대성신장 일곱' : '앞 관문부터') : null);
        })),
        r ? h('div', { class: 'raid-hp wraid-hp' }, h('i', { style: `width:${(left / r.maxHp) * 100}%` }), h('span', {}, left > 0 ? `${fmt(left)} / ${fmt(r.maxHp)}` : '쓰러짐')) : null,
        !game.okhwangOpen() && s.level >= D.WRAID_LV && pr.n > 0 ? h('p', { class: 'muted dgn-desc heaven-lock' }, game.heavenLock('okhwang')) : null,   // v424
        on && game.okhwangOpen() && s.level >= D.WRAID_LV ? h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', id: 'wraid-go-okhwang', disabled: game.inst ? true : null, onclick: (e) => go(ok.id, e) }, r && left <= 0 ? '다시 하늘 문을 두드리기' : `천궁으로 (${D.WRAID_SEC}초)`)) : null);
      out.push(card);
    }
    // v378 천외천 너머 — 석가여래(숨은 두목)
    {
      const sk = D.SEOKGA;
      const op = game.seokgaOpen();
      const r = on && op ? net.wraidOf(sk.id) : null;
      const left = r ? net.wraidHpLeft(r) : 0;
      out.push(h('div', { class: `card wraid-card wraid-heaven${op ? '' : ' locked secret'}`, style: `--wb:${sk.col}` },
        h('div', { class: 'wraid-head' }, h('img', { class: 'wraid-banner', src: 'art/ui/wb-heaven.webp', alt: '' }), op ? h('img', { class: 'wraid-boss', src: `art/boss/${sk.art}.png`, alt: sk.name }) : null,
          h('div', { class: 'wraid-name' }, h('small', {}, op ? '천외천 너머 · 숨은 두목' : '천외천 너머'), h('b', {}, op ? sk.name : '???', op ? h('i', {}, ` ${sk.hanja}`) : null))),
        !op && s.level >= D.WRAID_LV ? h('p', { class: 'muted dgn-desc heaven-lock' }, game.heavenLock('seokga')) : null,   // v424 왜 닫혀 있나
        h('p', { class: 'muted dgn-desc' }, op ? ((s.wraid.sk || 0) >= 1 ? `몇 번을 쓰러뜨려도 — 손바닥 안이었다(${s.wraid.sk}번). 여래는 언제나 다시 손바닥을 편다.` : `하늘조차 막지 못한 제천대성을 손바닥 하나로 눌렀던 자. 손바닥 안에서 좁혀 오는 탄 — 빈틈은 한 군데뿐. 체력은 옥황상제의 ${D.SK_HP_K}배.`) : '🔒 옥황상제를 쓰러뜨리는 데 함께한 자만 — 그 너머에 무엇이 있는지 아무도 모른다.'),
        r ? h('div', { class: 'raid-hp wraid-hp' }, h('i', { style: `width:${(left / r.maxHp) * 100}%` }), h('span', {}, left > 0 ? `${fmt(left)} / ${fmt(r.maxHp)}` : '쓰러짐')) : null,
        on && op && s.level >= D.WRAID_LV ? h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', id: 'wraid-go-seokga', disabled: game.inst ? true : null, onclick: (e) => go(sk.id, e) }, r && left <= 0 ? '다시 손바닥으로' : `손바닥 안으로 (${D.WRAID_SEC}초)`)) : null));
    }
    return out;
  }
  function buildRaid() {
    const s = game.s;
    const now = Date.now();
    const net = app.net;
    const rd = net?.raid;
    // 문파 토벌 (v128)
    const raidCard = h('div', { class: 'card dgn-card dgn-raid' });
    {
      const key = D.weekKey(now);
      const boss = D.raidBossOf(key);
      const top = h('div', { class: 'dgn-top' }, skinImg(h('div', { class: 'dgn-ico' }, '討'), 'dg-raid'),
        h('div', { class: 'dgn-name' }, h('b', {}, '문파 토벌'), h('small', {}, ` 이번 주 · ${boss.title}`),
          h('div', { class: 'muted' }, `문파원이 한 주 동안 함께 쳐서 잡는 두목 — 하루 ${D.RAID_PER_DAY}번, 한 번에 ${D.RAID_SEC}초`)));
      const rows = [top];
      if (!net?.ready?.() || !s.guildId || !net.guild) {
        rows.push(h('p', { class: 'muted dgn-desc' }, !net?.ready?.() ? '온라인일 때 칠 수 있어요.' : '무림 → 문파에 들어가면 문파원과 함께 칠 수 있어요.'));
      } else if (!rd || rd.kind !== 'world') {
        rows.push(h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: async (e) => {
          e.target.disabled = true;
          try { await net.ensureWeekRaid(); } catch (err) { toast(`토벌을 못 열었어요: ${err.message || err}`); }
          rerender();
        } }, '이번 주 토벌 열기')));
      } else {
        const left = Math.max(0, rd.maxHp - rd.total);
        const mine = rd.damage?.[net.uid] || 0;
        const rank = Object.entries(rd.damage || {}).sort((a, b) => b[1] - a[1]);
        rows.push(
          h('div', { class: 'raid-hp' }, h('i', { style: `width:${(left / rd.maxHp) * 100}%` }), h('span', {}, left > 0 ? `${fmt(left)} / ${fmt(rd.maxHp)}` : '처치!')),
          h('div', { class: 'raid-rank' }, ...rank.slice(0, 5).map(([uid, d], i) => h('div', { class: uid === net.uid ? 'me' : '' },
            h('b', {}, `${i + 1}`), ` ${rd.names?.[uid] || '?'}`, h('small', {}, ` ${fmt(d)}`)))),
          h('p', { class: 'muted dgn-desc' }, `내 피해 ${fmt(mine)} · 오늘 ${game.raidLeft(now)}/${D.RAID_PER_DAY}번 남음 · 칠 때마다 참여 보상, 잡히면 친 사람 모두 큰 보상`),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn primary', disabled: game.canRaid(left, now) ? null : true, onclick: () => start(() => game.startRaid({ key: rd.id, hpLeft: left, maxHp: rd.maxHp }, now)) }, `도전 (${D.RAID_SEC}초)`),
            net.canClaimWeek() ? h('button', { class: 'btn', onclick: async (e) => {
              e.target.disabled = true;
              try { const r = await net.claimWeek(); if (r) { toast(`토벌 보상 — ${rewardText(r)}`); app.save(); app.refresh(); } } catch (err) { toast(`받지 못했어요: ${err.message || err}`); }
              rerender();
            } }, '처치 보상 받기') : null));
      }
      raidCard.append(...rows);
    }
    return [raidCard];
  }
  const t = subTabs([
    { key: 'daily', label: '일일 던전', make: () => view(buildDaily) },
    { key: 'tower', label: '무한의 탑', make: () => view(buildTower) },
    { key: 'zodiac', label: '십이지', make: () => view(buildZodiac) },
    { key: 'wraid', label: '칠대성', make: () => view(buildWraid) },
    { key: 'raid', label: '문파 토벌', make: () => view(buildRaid) },
  ], 'ifu.dgnsub');
  const upd0 = t.update;
  t.update = () => {
    t.setDot('daily', dailyWaiting(game));
    t.setDot('zodiac', Object.values(game.s.zTickets || {}).some((n) => n > 0));
    { const n = app.net; t.setDot('wraid', !!(n?.ready?.() && n.wraidClaims?.().length)); }
    upd0();
  };
  return t;
}
// 일일 던전에 오늘 남은 횟수가 있나 (던전 창 빨간 점)
export function dailyWaiting(game, now = Date.now()) {
  if (!game.s.job || game.inst) return false;
  return D.DAILY.some((d) => D.dailyOpen(d, now) && game.dailyLeft(d.id, now) > 0);
}

// ---------- 마을 ----------
// v121 개편: 마을 사람 넷(사부 · 상인 · 대장장이 · 주모)을 고르면 그 사람 일만 보인다.
// 전직할 수 있으면 사부에 붉은 점. 물약은 버튼 넷(10·50·200·살 수 있는 만큼) + 자동 보충.
const NPC_LIST = [
  { id: 'master', name: '사부', ico: '師', desc: '전직 · 무공' },
  { id: 'shop', name: '상인', ico: '商', desc: '물약 · 비급' },
  { id: 'smith', name: '대장장이', ico: '冶', desc: '강화 · 각인' },
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
    const dot = { master: game.canAdvance() || (game.canChoosePath() && !game.s.path) };
    npcRow.replaceChildren(...NPC_LIST.map((n) => h('button', { class: `npc${pick === n.id ? ' on' : ''}`, onclick: () => (n.id === 'smith' ? app.showTab?.('bag', 'smith') : choose(n.id)) },
      h('span', { class: 'npc-ico' }, n.ico), h('b', {}, n.name), h('small', {}, n.desc), dot[n.id] ? h('i', { class: 'dot' }) : null)));
  }
  function masterView() {
    const s = game.s;
    const t = game.nextTier();
    const card = h('div', { class: 'card' }, h('h3', {}, '사부', h('small', {}, `지금 ${game.tierName() || '입문'}`)));
    const F5 = W.fifthOf(s.job);
    if (!t) card.append(h('p', {}, game.cheonmaOn?.() ? `${F5.name}을 이었구나. 하늘 아래 너를 막을 자가 없다 — ${F5.soul}(${F5.soulHanja})이 깃들었다.` : '더 배울 것이 없다. 이제 네 길을 가거라.'));
    else if (t.need) {
      // v391 5차 — 직업마다(v393): 검사 천마신공 · 권마 투신 · 환마 혈마 · 독마 독존 · 극악소마 악존
      const lvOk = s.level >= t.level, goldOk = s.gold >= t.cost, won = !!s.duel?.won?.[t.need];
      const cm = W.skillsOf(s.job, true).filter((k) => k.cm).sort((a, b) => (a.form || 0) - (b.form || 0));
      card.append(h('div', { class: 'advance-box cheonma-box', style: `--fc:${F5.col}` },
        h('div', { class: 'adv-title' }, '5차 전직 → ', h('b', { style: `color:${F5.col}` }, `${F5.tierName} · ${F5.name}(${F5.hanja})`)),
        h('p', { class: 'muted', style: 'font-size:12.5px' }, `${F5.needName}을(를) 꺾은 자만이 잇는다 — 모든 무공이 ${F5.form}(${F5.formHanja}) 일곱 초식으로 바뀌고 ${F5.soul}이 깃든다. 마지막 초식을 펼치면 등 뒤로 ${F5.soul}의 형상이 선다.`),
        h('div', { class: 'checks' },
          h('span', { class: `need${won ? ' ok' : ''}` }, `${F5.needName} 격파`, ' ', h('b', {}, won ? '✓' : '✗')),
          h('span', { class: `need${lvOk ? ' ok' : ''}` }, `레벨 ${t.level}`, ' ', h('b', {}, lvOk ? '✓' : `${s.level}/${t.level}`)),
          h('span', { class: `need${goldOk ? ' ok' : ''}` }, '은자', ' ', h('b', {}, goldOk ? '✓' : `${fmt(s.gold)}/${fmt(t.cost)}`))),
        h('p', { class: 'cm-soul' }, F5.trait),
        h('div', { class: 'cm-list' }, ...cm.map((k) => h('div', {}, h('b', { style: `color:${F5.col}` }, k.name), h('small', {}, ` ${k.desc}`)))),
        h('button', { class: 'btn primary', id: 'cheonma-go', style: 'width:100%', disabled: game.canAdvance() ? null : true, onclick: () => {
          if (!confirm(`5차 전직 — ${F5.name}\n모든 무공이 ${F5.form}으로 바뀌어요(무공 레벨·각성은 그대로). 은자 ${fmt(t.cost)}.`)) return;
          if (!game.advance()) return;
          app.save(); app.refresh();
        } }, !won ? `${F5.needName}을(를) 먼저 쓰러뜨려요` : !lvOk ? `레벨 ${t.level}이 되면` : !goldOk ? '은자가 모자라요' : `${F5.name}을 잇는다`)));
    } else {
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
    // 무공의 길 — 무엇을 언제 배우는지 한눈에 (v291 누르면 설명 · 다음 무공 표시)
    return [card, pathCard(), h('div', { class: 'card' }, h('h3', {}, '배우는 무공', h('small', {}, `${W.LORE[s.job]?.title || ''} · 누르면 설명`)), skillRoadmap(game, s.job),
      h('button', { class: 'btn', style: 'width:100%;margin-top:8px', onclick: () => openSkillPreview(game, JOBS_LIST) }, '다른 직업 무공도 보기'))];
  }
  // v237: 직업의 두 갈래 길 — 2차 전직에 고른다. 경지 다섯이 레벨을 따라 열리고, 140·4차에 합일(둘 다)
  function pathCard() {
    const s = game.s;
    const P = PT.PATHS[s.job];
    if (!P) return null;
    const can = game.canChoosePath();
    const mg = PT.merged(s);
    const open = PT.nodesOpen(s.level);
    const col = (id) => {
      const pp = P[id];
      const mine = s.path === id;
      const active = mine || mg;
      const cost = PT.PATH_COST[id];
      return h('div', { class: `path-col${mine ? ' mine' : ''}${active ? ' on' : ''} p-${id}` },
        h('div', { class: 'pc-head' }, h('i', {}, pp.hanja), h('div', {}, h('b', {}, pp.name), h('small', {}, pp.style))),
        // v240: 길 무공 — 이 길을 걸으면 생기는 고유 무공
        (() => { const ps = W.PATH_SKILLS[s.job]?.[id]; return ps ? h('div', { class: 'pc-skill' }, h('b', {}, `〈${ps.name}〉`), h('small', {}, ps.desc.replace(/ — .*$/, ''))) : null; })(),
        h('div', { class: 'pc-nodes' }, ...pp.nodes.map((nd, i) => {
          const lit = active && (mg || i < open);
          return h('div', { class: `pc-node${lit ? ' lit' : ''}` }, h('span', { class: 'lv' }, mg && !mine ? '合' : `${PT.PATH_NODE_LV[i]}`), h('div', {}, h('b', {}, nd.name), h('small', {}, nd.text)));
        })),
        h('div', { class: 'pc-cost' }, mg ? '합일 — 약점 없음' : `약점: ${id === 'a' ? `평타 피해 ${Math.round(cost.basic * 100)}%` : `무공 피해 ${Math.round(cost.skill * 100)}%`}`),
        mine || mg ? h('div', { class: 'pc-tag' }, mg ? '합일' : '걷는 길')
          : h('button', { class: 'btn primary', disabled: !can || s.gold < game.pathSwitchCost() ? true : null, onclick: () => {
            const c = game.pathSwitchCost();
            if (s.path && !confirm(`${pp.name}(으)로 바꿀까요? 은자 ${fmt(c)}`)) return;
            if (game.choosePath(id)) { toast(`${pp.name}을(를) 걷기로 했어요`); app.save(); sig = ''; upd(); app.refresh(); }
          } }, !can ? '2차 전직부터' : s.path ? `바꾸기 · ${fmt(game.pathSwitchCost())}` : '이 길로'));
    };
    return h('div', { class: 'card path-card' },
      h('h3', {}, '직업의 길', h('small', {}, mg ? '두 길을 다 걷는다' : `레벨 ${PT.PATH_NODE_LV.join('·')}에 경지가 열린다 · 레벨 ${PT.MERGE_LV}·4차에 합일`)),
      !s.path && can ? h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, '둘 중 하나를 골라요 — 나중에 은자를 내고 바꿀 수 있고, 끝에는 둘 다 걷게 돼요.') : null,
      h('div', { class: 'path-cols' }, col('a'), col('b')));
  }
  function shopView() {
    const s = game.s;
    const price = game.potionPrice();
    const maxN = Math.max(0, Math.floor(s.gold / price));
    const buy = (n, max = false) => h('button', { class: max ? 'btn buy-max' : 'buy', disabled: n <= 0 || s.gold < price * n ? true : null, onclick: () => {
      if (max && !confirm(`은자 ${fmt(price * n)}을(를) 다 써서 물약 ${fmt(n)}개를 살까요?`)) return;   // v432
      if (game.buyPotions(n)) { toast(`물약 ${fmt(n)}개를 샀어요`); app.save(); app.refresh(); }
    } }, max ? '최대' : `${n}개`, h('small', {}, max ? `${fmt(n)}개 · 은자 다` : fmt(price * n)));
    const refill = h('button', { class: `btn ${s.autoRefill ? 'good' : ''}`, onclick: () => { s.autoRefill = !s.autoRefill; app.save(); sig = ''; upd(); } }, s.autoRefill ? '자동 보충 켜짐' : '자동 보충 꺼짐');
    return [
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'pot-ico big' }),
          h('div', { class: 'info' }, h('b', {}, '빨간 물약', h('small', {}, ` 개당 ${fmt(price)}`)),
            h('div', { class: 'desc' }, `최대 체력의 ${pct(W.POTION_HEAL, 0)} 회복 · 체력 ${pct(game.potionAt(), 0)} 아래면 알아서 먹어요 (가방 → 물약에서 바꿔요)`)),
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
      // v262 영약 — 30분 동안 경험치·은자 +25%(사냥 중에만 닳는다 · 3시간까지 쌓인다)
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'book-ico' }, '丹'),
          h('div', { class: 'info' }, h('b', {}, '영약', h('small', {}, (s.elixir || 0) > 0 ? ` 남은 시간 ${Math.ceil(s.elixir / 60)}분` : ' 없음')),
            h('div', { class: 'desc' }, `${W.ELIXIR_SEC / 60}분 동안 경험치·은자 +${pct(W.ELIXIR_BONUS, 0)} · 사냥 중(방치 포함)에만 닳아요 · ${W.ELIXIR_MAX / 3600}시간까지 쌓여요`))),
        h('button', { class: 'btn primary', style: 'width:100%', disabled: s.gold < game.elixirPrice() || (s.elixir || 0) + W.ELIXIR_SEC > W.ELIXIR_MAX ? true : null, onclick: () => {
          if (game.buyElixir()) { toast(`영약을 마셨어요 — ${Math.ceil(game.s.elixir / 60)}분 남음`); app.save(); app.refresh(); }
        } }, `영약 마시기 · 은자 ${fmt(game.elixirPrice())}`)),
      // v262 무관 증축 — 방치 상한·효율을 은자로
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'book-ico' }, '館'),
          h('div', { class: 'info' }, h('b', {}, '무관 증축', h('small', {}, ' 방치를 더 길게 · 더 알차게')),
            h('div', { class: 'desc' }, `지금: 방치 ${Math.round(game.offlineCapSec() / 3600)}시간까지 · 효율 +${game.hallLv('eff') * 5}%`))),
        h('div', { class: 'btn-row' }, ...Object.keys(W.HALL).map((k) => {
          const c = game.hallCost(k), n = game.hallLv(k);
          return h('button', { class: 'btn', disabled: c == null || s.gold < c ? true : null, onclick: () => {
            if (game.buyHall(k)) { toast(`무관 증축 — ${W.HALL[k].desc(game.hallLv(k))}`); app.save(); app.refresh(); }
          } }, `${W.HALL[k].name} ${n}/${W.HALL[k].max}`, h('small', {}, c == null ? ' 끝' : ` ${fmt(c)}`));
        }))),
      // v262 세력 상점 — 세력 재료를 바꾼다
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'book-ico' }, '盟'),
          h('div', { class: 'info' }, h('b', {}, '세력 상점', h('small', {}, ' 세력 재료로 바꿔요')),
            h('div', { class: 'desc' }, '세력 사냥터·고수에게서 모은 패·령·정을 쓸 곳'))),
        ...W.FAC_SHOP.map((o) => h('div', { class: 'row fac-shop-row' },
          h('div', { class: 'info' }, h('div', { class: 'name' }, o.name), h('div', { class: 'desc' }, `${o.desc} · ${LN.FAC_MAT_INFO[o.mat].name} ${fmt(o.n)}개 (가진 것 ${fmt(s.mats[o.mat] || 0)})`)),
          h('button', { class: 'buy', disabled: game.canFacBuy(o.id) ? null : true, onclick: () => {
            const r = game.buyFac(o.id);
            if (r) { toast(`세력 상점 — ${r}`); app.save(); sig = ''; upd(); }
          } }, '바꾸기')))),
      // 강화 보호부 (v150 · v192) — +11부터 실패해도 -2 대신 그대로
      h('div', { class: 'card shop-card prot-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'book-ico' }, '符'),
          h('div', { class: 'info' }, h('b', {}, '강화 보호부', h('small', {}, ` ${s.prot || 0}장 가짐`)),
            h('div', { class: 'desc' }, '+11부터는 강화에 실패하면 -2. 보호부가 있으면 하나를 태우고 그대로.'))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', disabled: s.gold < W.protPrice(s.level) ? true : null, onclick: () => { if (game.buyProt(1)) { toast('강화 보호부 1장'); app.save(); app.refresh(); } } }, `1장 · ${fmt(W.protPrice(s.level))}`),
          h('button', { class: 'btn', disabled: s.gold < W.protPrice(s.level) * 10 ? true : null, onclick: () => { if (game.buyProt(10)) { toast('강화 보호부 10장'); app.save(); app.refresh(); } } }, `10장 · ${fmt(W.protPrice(s.level) * 10)}`))),
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
    const nsig = `${pick}|${inTown}|${s.autoHunt}|${s.huntMap}|${s.jobTier}|${s.level}|${s.potions}|${s.books || 0}|${s.autoRefill}|${goldSig(game, 'town')}|${game.canAdvance()}|${s.prot || 0}|${Math.ceil((s.elixir || 0) / 60)}|${JSON.stringify(s.hall || {})}|${W.FAC_SHOP.map((o) => game.canFacBuy(o.id) ? 1 : 0).join('')}`;
    if (nsig === sig) return;
    sig = nsig;
    head.replaceChildren(h('div', { class: 'town-status' },
      h('div', {}, h('b', {}, inTown ? '객잔 마을에서 쉬는 중' : `${W.mapOf(s.map).name}에서 사냥 중`),
        h('small', {}, inTown ? '체력이 빠르게 차요' : '전직·상점·강화는 사냥터에서도 돼요')),
      inTown ? h('button', { class: 'btn primary', disabled: game.canEnter(s.huntMap) ? null : true, onclick: () => { game.enterMap(s.huntMap); app.save(); app.closePanel(); app.refresh(); } }, '사냥터로')
        : h('button', { class: 'btn', onclick: () => { game.goTown(); app.save(); app.refresh(); } }, '쉬러 가기')));
    void npcRow;
    body.replaceChildren(...(pick === 'master' ? masterView() : pick === 'inn' ? innView() : pick === 'smith' ? smithInfo() : shopView()));
  }
  // 대장장이는 가방 창의 대장장이 칸에 있다 — 여기서는 안내와 바로 가기 (v148)
  function smithInfo() {
    return [h('div', { class: 'card' }, h('h3', {}, '대장장이', h('small', {}, '강화 · 등급 각인 · 세트')),
      h('p', {}, '"재료만 가져오면 뭐든 두드려 주지. 등급은 골라서 — 위로 갈수록 재료가 확 들어."'),
      h('p', { class: 'muted' }, '사다리(~100) · 세트(99~) · 왕의 장신구(99~)를 만들고, 낀 장비를 누르면 강화·승급해요.'),
      h('button', { class: 'btn primary', style: 'width:100%', onclick: () => app.showTab?.('bag', 'smith') }, '대장장이로 가기 (가방 → 대장장이)'))];
  }
  // v148: 마을 사람 넷을 칸으로 — 사부 | 상인 | 대장장이 | 주모. 머리(쉬는 중·사냥 중)는 칸마다 위에.
  const views = NPC_LIST.map((n) => ({
    key: n.id, label: n.name,
    make: () => ({ root: root, update: () => { if (pick !== n.id) { pick = n.id; sig = ''; } upd(); } }),
  }));
  root.replaceChildren(head, body);
  const t = subTabs(views, 'ifu.townsub');
  const upd0 = t.update;
  // v256: 길을 아직 안 골랐으면 사부 칸에도 점(마을 탭엔 점이 있는데 안에서 이유를 못 찾았다)
  const pathDue = () => game.canChoosePath() && !game.s.path;
  t.update = () => { t.setDot('master', game.canAdvance() || pathDue()); upd0(); };
  // 전직할 수 있으면 사부 칸부터 (칸을 짚어 연 게 아니면)
  t.shown = (sub) => { if (!sub && (game.canAdvance() || pathDue())) t.select('master'); };
  return t;
}

// v292 자동 등급 각인 고르기 — 어떤 증표(테마·고유 효과)를 어느 칸에. 안 고르면 전처럼 센 증표부터 모두.
// v307 칭호 모음 — 저절로 얻는 칭호 전부(이룬 것 ✓ · 남은 것은 이루는 길)와 받은 칭호
export function openTitles(app) {
  const { game } = app;
  openModal((s) => {
    const row = (t, got) => h('div', { class: `title-card${got ? ' got' : ''}`, style: `--tc:${t.col}` },
      h('div', { class: 'tc-name' }, h('span', { class: 'title-tag' }, `〈${t.name}〉`), got ? h('small', { class: 'tc-got' }, game.s.title === t.id ? ' 끼는 중' : ' ✓') : null),
      h('div', { class: 'tc-desc' }, t.desc),
      t.how ? h('div', { class: 'tc-how' }, got ? (t.timed && game.s.titleUntil?.[t.id] ? `남은 기한 ${Math.max(0, Math.ceil((game.s.titleUntil[t.id] - Date.now()) / 3600e3))}시간` : '이뤘어요') : `이루는 길: ${t.how}`) : h('div', { class: 'tc-how' }, '운영자가 주는 칭호'),   // v318 기한
      got && game.s.title !== t.id ? h('button', { class: 'btn', style: 'margin-top:4px', onclick: () => { game.wearTitle(t.id); app.save(); app.refresh(); openTitles(app); } }, '끼기') : null);
    const got = (t) => game.hasTitle(t.id) || (t.id === 'founder' && game.hasTitle('개국공신'));
    const auto = W.AUTO_TITLES;
    const mine = Object.values(W.TITLES).filter((t) => !t.how && got(t));
    const ts = game.titleSet();
    s.append(h('h2', {}, '칭호 모음', h('small', {}, ` ${auto.filter(got).length}/${auto.length}`)),
      h('div', { class: 'title-set' }, h('b', {}, `모은 칭호 ${ts.n}개`), ` → 공격력·체력 +${Math.round(ts.atk * 100)}%`,
        h('small', {}, ` (칭호 하나마다 +${Math.round(W.TITLE_SET_BONUS * 100)}% · 끼지 않아도 붙어요)`)),
      h('p', { class: 'muted' }, '끼는 칭호는 하나 — 끼면 그 효과(공격력·때릴 때 글자)가 더 붙어요. 이루면 저절로 받아요.'),
      h('div', { class: 'title-list' }, ...auto.map((t) => row(t, got(t))), ...mine.map((t) => row(t, true))),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기')));
  });
}
// v371 자동 강화 설정 — 켜는 순간 열린다 · 몇 강까지 · 어느 칸 · 은자 남기기
export function openAutoEnhCfg(app, onClose) {
  const { game } = app;
  const cfg = game.s.autoEnhCfg || (game.s.autoEnhCfg = { max: W.AUTO_ENH_MAX, slots: {}, keep: 0 });
  cfg.slots = cfg.slots || {};
  const SLOT_NAME = Object.fromEntries(W.SLOTS.map((x) => [x.id, x.name]));
  const done = () => { app.save(); draw(); app.refresh(); };
  let box = null;
  const draw = () => {
    if (!box) return;
    const on = !!game.s.autoEnh;
    box.replaceChildren(...[
      h('h2', {}, '자동 강화 설정'),
      h('div', { class: 'ainf-sec' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'aenh-on', checked: on ? true : null, onchange: (e) => { game.s.autoEnh = !!e.target.checked; done(); } }), ' 자동 강화 켜기'),
        h('small', { class: 'muted' }, ' 5초마다 가장 낮은 칸부터 한 강씩 올려요')),
      h('div', { class: 'ainf-sec' }, h('b', {}, '몇 강까지'), h('small', { class: 'muted' }, ` 돌파(+${W.AUTO_ENH_MAX + 1}~)는 언제나 직접`),
        h('div', { class: 'ainf-slots' }, ...Array.from({ length: W.AUTO_ENH_MAX }, (_, i) => i + 1).map((n) => h('button', { class: `chip${(cfg.max || W.AUTO_ENH_MAX) === n ? ' on' : ''}`, onclick: () => { cfg.max = n; done(); } }, `+${n}`)))),
      h('div', { class: 'ainf-sec' }, h('b', {}, '어느 칸에'), h('small', { class: 'muted' }, ' 끈 칸은 자동이 건드리지 않아요'),
        h('div', { class: 'ainf-slots' }, ...W.GROW_SLOTS.map((k) => h('button', { class: `chip${cfg.slots[k] === false ? '' : ' on'}`, onclick: () => { if (cfg.slots[k] === false) delete cfg.slots[k]; else cfg.slots[k] = false; done(); } }, SLOT_NAME[k] || k)))),
      h('div', { class: 'ainf-sec' }, h('b', {}, '은자 남기기'), h('small', { class: 'muted' }, ' 가진 은자의 이만큼은 강화에 쓰지 않아요(물약 값은 늘 남겨요)'),
        h('div', { class: 'ainf-slots' }, ...[0, 10, 30, 50].map((n) => h('button', { class: `chip${(cfg.keep || 0) === n ? ' on' : ''}`, onclick: () => { cfg.keep = n; done(); } }, n ? `${n}%` : '안 남김')))),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기'))]);
  };
  openModal((s) => { box = s; draw(); }, { onClose });
}
export function openAutoInfCfg(app, onClose) {
  const { game } = app;
  const cfg = game.s.autoInfCfg || (game.s.autoInfCfg = { mode: 'all', only: false, marks: {}, slots: {}, prefFx: [], prefSp: [] });
  if (!cfg.mode) cfg.mode = cfg.only ? 'pick' : 'all';
  cfg.prefFx = cfg.prefFx || []; cfg.prefSp = cfg.prefSp || []; cfg.prefSk = cfg.prefSk || []; cfg.prefSkSlot = cfg.prefSkSlot || [];
  const SK_NAME = { range: '범위', dmg: '피해', cd: '숨', echo: '한 번 더' };
  const setMode = (m) => { cfg.mode = m; cfg.only = m === 'pick'; };
  // 효과 이름 — '공격력 +1%' → '공격력'
  const FX_KEYS = [...new Set(Object.values(IM.THEMES).flatMap((t) => t.fx.map(([k]) => k)))];
  const fxName = (k) => IM.FX_TEXT[k](0.01).replace(/^적중 피해의 [\d.]+% /, '').replace(/^[\d.]+% 확률로 /, '').replace(/ ?[+-]?[\d.]+%p?$/, '').replace(/ [\d.]+%$/, '');
  const SP_NAME = { echo: '한 번 더', execute: '약한 적 마무리', bane: '두목 피해', chain: '치명 번짐', nova: '둘레 폭발', rain: '쏟아짐', guard: '보호막', reap: '처치 회복',
    frenzy: '맞으면 쾌속', mirror: '반격', bleed: '출혈', berserk: '위기 광폭', phoenix: '불사', stunwave: '기절 파동', vigor: '지속 회복', surge: '스킬 뒤 강화' };
  const toggle = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); };
  const SLOT_NAME = Object.fromEntries(W.SLOTS.map((x) => [x.id, x.name]));
  const done = () => { app.save(); draw(); app.refresh(); };
  let box = null;
  // v293 좋아하는 효과 — 누른 차례가 우선순위(앞일수록 무겁다). 수치는 고르지 않고 '무엇을'만.
  const prefView = () => {
    const chipP = (arr, k, label) => {
      const i = arr.indexOf(k);
      return h('button', { class: `chip pref-chip${i >= 0 ? ' on' : ''}`, onclick: () => { toggle(arr, k); done(); } }, i >= 0 ? h('i', {}, `${i + 1}`) : null, label);
    };
    const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0);
    const match = keys.map((k) => ({ k, ...game.markPref(k, cfg) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || W.markLv(b.k) - W.markLv(a.k));
    return [
      h('div', { class: 'ainf-sec' }, h('b', {}, '능력치'), h('small', { class: 'muted' }, ' 여러 개 · 누른 차례가 우선'), h('div', { class: 'ainf-slots' }, ...FX_KEYS.map((k) => chipP(cfg.prefFx, k, fxName(k))))),
      h('div', { class: 'ainf-sec' }, h('b', {}, '고유 효과'), h('small', { class: 'muted' }, ' 레벨 100 넘는 두목의 증표에만 · 맞는 것을 골라 새겨요'), h('div', { class: 'ainf-slots' }, ...Object.keys(SP_NAME).map((k) => chipP(cfg.prefSp, k, SP_NAME[k])))),
      h('div', { class: 'ainf-sec' }, h('b', {}, '스킬 변화'), h('small', { class: 'muted' }, ' 새길 때 굴려요 — 좋아하는 것이 나오면 ♥ · 다시 굴리기 전에 물어요'),
        h('div', { class: 'ainf-slots' }, ...IM.SK_KINDS.map((k) => chipP(cfg.prefSk, k, SK_NAME[k]))),
        h('div', { class: 'ainf-slots' }, h('small', { class: 'muted', style: 'align-self:center' }, '어느 무공에(안 고르면 모두):'), ...[0, 1, 2].map((k) => chipP(cfg.prefSkSlot, k, IM.SKILL_NAME[k])))),
      h('div', { class: 'ainf-sec' }, h('b', {}, '지금 가진 증표 가운데 맞는 것'), h('small', { class: 'muted' }, ' 위에서부터 써요'),
        match.length ? h('div', { class: 'ainf-list' }, ...match.slice(0, 12).map((x) => {
          const z = +x.k.slice(1);
          const th = IM.THEMES[IM.themeOfZone(z)];
          const sp = x.spKind ? IM.specialsOfZone(z)?.[x.sp] : null;
          return h('div', { class: 'ainf-row on', style: `--ic:${th.col}` },
            h('label', {}, h('b', {}, W.matName(x.k)), h('small', {}, ` ${fmt(game.s.mats[x.k] || 0)}개`)),
            h('div', { class: 'ainf-th' }, h('span', { class: 'ainf-chip' }, th.name), x.fx.map(fxName).join(' · '), sp ? ` · ★${sp.name}(${SP_NAME[sp.kind] || ''})` : ''));
        })) : h('p', { class: 'muted', style: 'font-size:12px' }, cfg.prefFx.length || cfg.prefSp.length ? '맞는 증표가 아직 없어요 — 생기면 그때 새겨요.' : '위에서 좋아하는 효과를 고르세요(안 고르면 자동이 쉬어요).')),
    ];
  };
  // v386 고른 기운대로 — 칸마다 고른 기운과 Lv만 보여 준다(고르기는 가방 › 각인)
  const themeSummary = () => {
    const worn = W.SLOTS.map((x) => game.s.equip[x.id]).filter((it) => it && game.canImprintItem(it));
    const none = worn.filter((it) => !game.impThemeOf(it)).length;
    return h('div', { class: 'ainf-sec' }, h('b', {}, '칸마다 고른 기운'), h('small', { class: 'muted' }, ' 가방 › 각인에서 고른 기운을 「올리기」처럼 — 낮은 Lv 칸부터 · 돌파 몫 증표는 남겨요'),
      h('div', { class: 'ainf-slots' }, ...worn.map((it) => { const t = game.impThemeOf(it); return h('span', { class: `chip${t ? ' on' : ''}`, style: t ? `--tc:${IM.THEMES[t].col}` : '' }, `${SLOT_NAME[it.slot]} ${t ? IM.THEMES[t].name : '—'} · Lv ${game.impLv(it)}`); })),
      none ? h('p', { class: 'muted', style: 'font-size:12px;color:#fca5a5' }, `기운을 안 고른 칸 ${none}개는 건너뛰어요.`) : null,
      h('button', { class: 'btn', onclick: () => { closeModal(); app.showTab('bag', 'imp'); } }, '가방 › 각인에서 고르기 ›'));
  };
  const draw = () => {
    if (!box) return;
    const keys = [...new Set([...Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0), ...Object.keys(cfg.marks)])].sort((a, b) => W.markLv(b) - W.markLv(a));
    const rows = keys.map((k) => {
      const z = +k.slice(1);
      const th = IM.THEMES[IM.themeOfZone(z)];
      const sps = IM.specialsOfZone(z);
      const on = k in cfg.marks;
      return h('div', { class: `ainf-row${on ? ' on' : ''}`, style: `--ic:${th.col}` },
        h('label', {}, h('input', { type: 'checkbox', checked: on ? true : null, disabled: cfg.mode === 'pick' ? null : true, onchange: (e) => { if (e.target.checked) cfg.marks[k] = 0; else delete cfg.marks[k]; done(); } }),
          h('b', {}, W.matName(k)), h('small', {}, ` ${fmt(game.s.mats[k] || 0)}개`)),
        h('div', { class: 'ainf-th' }, h('span', { class: 'ainf-chip' }, th.name), th.fx.map(([kk, v]) => IM.FX_TEXT[kk](v)).join(' · ')),
        sps && on ? h('div', { class: 'sp-pick' }, h('small', {}, '새길 고유 효과'), ...sps.map((sp, j) => h('button', { class: `chip${(cfg.marks[k] || 0) === j ? ' on' : ''}`, onclick: () => { cfg.marks[k] = j; done(); } }, h('b', {}, sp.name), h('small', {}, ` ${IM.SPECIAL_KIND[sp.kind](1)}`)))) : null);
    });
    box.replaceChildren(...[
      h('h2', {}, '자동 등급 각인 설정'),
      h('button', { class: 'pref-link', onclick: () => { closeModal(); openImprintGuide(app, () => openAutoInfCfg(app, onClose)); } }, '🔎 어떤 두목 증표가 어떤 능력을 주는지 — 각인 안내서'),
      h('p', { class: 'muted', style: 'font-size:12.5px;margin-top:-4px' }, '등급 각인에 성공하면 그 두목의 테마 능력치와 고유 효과가 장비 칸에 새겨져요. 원하는 것만 새기도록 고를 수 있어요.'),
      h('div', { class: 'ainf-sec' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'ainf-on', checked: game.s.autoInf ? true : null, onchange: (e) => { game.s.autoInf = !!e.target.checked; done(); } }), ' 자동 등급 각인 켜기')),
      h('div', { class: 'ainf-sec' }, h('b', {}, '어떤 증표를'),
        h('div', { class: 'btn-row' },
          h('button', { class: `chip${cfg.mode === 'theme' ? ' on' : ''}`, id: 'ainf-theme', onclick: () => { setMode('theme'); done(); } }, '✨ 고른 기운대로(쉬움)'),
          h('button', { class: `chip${cfg.mode === 'all' ? ' on' : ''}`, onclick: () => { setMode('all'); done(); } }, '센 증표부터'),
          h('button', { class: `chip${cfg.mode === 'pref' ? ' on' : ''}`, onclick: () => { setMode('pref'); done(); } }, '♥ 좋아하는 효과로'),
          h('button', { class: `chip${cfg.mode === 'pick' ? ' on' : ''}`, onclick: () => { setMode('pick'); done(); } }, '증표 직접 고르기'))),
      cfg.mode === 'theme' ? themeSummary() : null,
      cfg.mode === 'theme' ? null : h('div', { class: 'ainf-sec' }, h('b', {}, '♥ 좋아하는 효과'), h('small', { class: 'muted' }, cfg.mode === 'pref' ? ' 자동이 이것으로 골라 새겨요 · 손으로 각인할 때도 이 차례로 보이고, 좋아하는 것을 넘기려 하면 물어요' : ' 손으로 각인할 때 이 차례로 보이고, 좋아하는 것을 넘기려 하면 물어요(자동은 \'좋아하는 효과로\'일 때 써요)')),
      ...(cfg.mode === 'theme' ? [] : prefView()),
      cfg.mode === 'pick' && !Object.keys(cfg.marks).length ? h('p', { class: 'muted', style: 'font-size:12px;color:#fca5a5' }, '아직 고른 증표가 없어요 — 아래에서 고르면 그것만 써요(안 고르면 자동이 쉬어요).') : null,
      cfg.mode !== 'pref' && cfg.mode !== 'theme' ? (keys.length ? h('div', { class: 'ainf-list' }, ...rows) : h('p', { class: 'muted' }, '가진 증표가 없어요 — 두목을 잡으면 나와요.')) : null,
      h('div', { class: 'ainf-sec' }, h('b', {}, '어느 칸에'), h('small', { class: 'muted' }, ' 끈 칸은 자동이 건드리지 않아요'),
        h('div', { class: 'ainf-slots' }, ...W.GROW_SLOTS.map((k) => h('button', { class: `chip${cfg.slots[k] === false ? '' : ' on'}`, onclick: () => { if (cfg.slots[k] === false) delete cfg.slots[k]; else cfg.slots[k] = false; done(); } }, SLOT_NAME[k] || k)))),
      // v297 칸 단 올리기
      cfg.mode === 'theme' ? null : h('div', { class: 'ainf-sec' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cfg.dan === true ? true : null, onchange: (e) => { cfg.dan = !!e.target.checked; cfg.danV = 2; done(); } }), ' 남는 증표로 칸 단(段) 올리기'),
        h('small', { class: 'muted' }, ' 기본은 꺼짐 — 켜면 5초마다 한 단씩만, 낮은 단부터 올려요. 다음 등급 각인 몫(12개)·돌파 몫은 남겨요')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기'))].filter(Boolean));
  };
  openModal((s) => { box = s; draw(); }, { onClose });
}
// v291 무공 미리 보기 — 한 직업의 무공을 배우는 차례대로. 언제(레벨·전직) 배우는지 · 지금 어디까지 왔는지 · 누르면 설명.
//   무공 창 · 사부 · 직업 고르기에서 같이 쓴다. 다른 직업(또는 아직 직업이 없을 때)은 레벨만 보인다.
const KIND_NAME = { single: '한 적', aoe: '둘레', daggers: '비수', field: '장판', support: '보조', awaken: '각성', clone: '분신', triple: '삼공' };
export function skillRoadmap(game, job) {
  const s = game.s;
  const mine = !!s.job && job === s.job;
  const lvOf = (k) => (k.path ? W.TIERS[2].level : k.kind === 'support' ? k.from : W.TIERS[k.tier].level);
  const all = W.skillsOf(job, mine && game.cheonmaOn?.()).sort((a, b) => lvOf(a) - lvOf(b) || (a.path ? 1 : 0) - (b.path ? 1 : 0) || a.slot - b.slot);
  const box = h('div', { class: 'sk-road' });
  let marked = false;
  for (const k of all) {
    const L = lvOf(k);
    const known = mine && game.knows(k);
    const pathName = k.path ? PT.PATHS[job]?.[k.path]?.name || '' : '';
    const when = k.path ? `레벨 ${L} · 2차 전직 뒤 '${pathName}'을 고르면` : k.kind === 'support' ? `레벨 ${L}이 되면` : `${k.tier}차 전직 · 레벨 ${L}`;
    const otherPath = mine && k.path && s.path && s.path !== k.path && !known;
    let st;
    if (known) st = '✓ 배움';
    else if (!mine) st = `Lv.${L}`;
    else if (otherPath) st = '다른 길';
    else if (s.level < L) st = `${L - s.level}레벨 뒤`;
    else st = k.path ? '길을 고르면' : '전직하면';
    const next = mine && !known && !otherPath && !marked;
    if (next) marked = true;
    const desc = h('div', { class: 'sk-road-desc' }, skillText({}, k));
    desc.hidden = true;
    const row = h('button', { class: `sk-road-row${known ? ' known' : ''}${next ? ' next' : ''}${otherPath ? ' dim' : ''}`, onclick: () => { desc.hidden = !desc.hidden; row.classList.toggle('open', !desc.hidden); } },
      h('span', { class: 'ico' }, k.icon),
      h('span', { class: 'sk-road-main' }, h('b', {}, k.name, next ? h('em', {}, ' 다음') : ''), h('small', {}, `${W.SKILL_ORDINAL[k.slot]} · ${KIND_NAME[k.kind] || ''} · ${when}`)),
      h('span', { class: 'st' }, st));
    box.append(row, desc);
  }
  return box;
}
// 직업마다 무공을 미리 보는 창 — 직업을 고르기 전에도 본다
export function openSkillPreview(game, jobs, start, onClose) {
  let cur = start || game.s.job || jobs[0].id;
  openModal((s) => {
    const tabs = h('div', { class: 'sk-prev-tabs' });
    const body = h('div');
    const draw = () => {
      tabs.replaceChildren(...jobs.map((j) => h('button', { class: `chip${j.id === cur ? ' on' : ''}`, style: j.id === cur ? `border-color:${j.color};color:${j.color}` : '', onclick: () => { cur = j.id; draw(); } }, j.name)));
      body.replaceChildren(h('p', { class: 'muted', style: 'margin:6px 0 8px;font-size:12.5px' }, W.CLASSES[cur]?.trait || ''), skillRoadmap(game, cur));
    };
    draw();
    s.append(h('h2', {}, '무공 미리 보기'), h('p', { class: 'muted', style: 'margin-top:-6px;font-size:12.5px' }, '무공을 누르면 설명이 나와요.'), tabs, body,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, onClose ? '돌아가기' : '닫기')));
  }, { onClose });
}
export function skillText(game, sk) {
  const cd = game.skillCd ? game.skillCd(sk) : sk.cd;
  const cost = sk.hpCost * (1 - (game.skillMods ? game.skillMods(sk.id).cost : 0));
  const num = sk.kind === 'field' ? `처음 ×${sk.mult} · ${sk.field.tick}초마다 ×${sk.field.mult}`
    : sk.kind === 'daggers' ? `한 자루 ×${sk.mult}` : sk.mult != null ? `공격력 ×${sk.mult}${sk.hits > 1 ? ` · ${sk.hits}번` : ''}` : '';
  // 보조기·각성처럼 배수가 없는 무공은 숫자를 빼고 숨만 (전에는 '공격력 ×undefined'가 찍혔다)
  const rg = rangeText(game, sk);
  return `${sk.desc} — ${num ? `${num} · ` : ''}숨 ${cd.toFixed(cd < 10 ? 1 : 0).replace(/\.0$/, '')}초${sk.hpCost ? ` · 체력 ${pct(cost, 0)} 소모` : ''}${rg ? ` · ${rg}` : ''}`;
}
// 무공 범위를 칸으로 (v157) — 땅 한 칸이 64. 스킬 단추를 길게 누르면 화면에 고리로도 보인다.
export function rangeText(game, sk) {
  const rc = game.skillReach?.(sk);
  if (!rc) return '';
  const t = (px) => `${(px / W.TILE).toFixed(1).replace(/\.0$/, '')}칸`;
  // v425 한 가지 꼴로 — 「범위 ○칸(내 둘레 / 과녁 둘레)」 · 과녁 하나는 「사거리 ○칸」
  if (sk.kind === 'single') return `사거리 ${t(rc.reach)}${rc.r ? ` · 범위 ${t(rc.r)}(과녁 둘레)` : ' · 과녁 하나'}`;
  if (sk.kind === 'triple') return `범위 ${t(rc.r)}(내 둘레)`;
  return `범위 ${t(rc.r)}(${rc.center === 'target' ? '과녁 둘레' : '내 둘레'})`;
}

// ---------- 무림 ----------
// 서열(레벨 순) · 문파(만들기·가입 · 출석·기부 · 문파원 · 창고 · 채팅)
function rankView(app) {
  const { net, game } = app;
  const root = h('div');
  const list = h('div');
  const status = h('p', { class: 'muted' });
  // v316 서열 | 이번 주 두목
  let mode = 'lv';
  const seg = h('div', { class: 'seg rank-seg' });
  const head = h('h3', {});
  const paintSeg = () => seg.replaceChildren(...[['lv', '서열'], ['wboss', '이번 주 두목']].map(([k, t]) => h('button', { class: `chip${mode === k ? ' on' : ''}`, onclick: () => { if (mode === k) return; mode = k; paintSeg(); load(); } }, t)));
  paintSeg();
  root.append(h('div', { class: 'card' }, seg, head, status, list));
  let loaded = 0;
  const nameOf = (p) => [p.title && W.titleOf(p.title) ? h('span', { class: 'title-tag', style: `--tc:${W.titleOf(p.title).col}` }, `〈${W.titleOf(p.title).name}〉 `) : null, p.nickname || p.name || '이름없음'];
  const medal = (i) => h('div', { class: 'rank-no' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1);
  const fmtSec = (x) => { const m = Math.floor(x / 60), r = x - m * 60; return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)}초`; };
  async function loadWeek() {
    const w = game.wbossState();
    head.replaceChildren('이번 주 두목', h('small', {}, ` ${w.key} 주 · 월요일 0시에 새로`));
    await net.pushWeekBoss(true);
    const b = await net.weekBossBoard(w.key);
    const mine = h('div', { class: 'wb-mine' }, h('b', {}, '내 기록 '), `두목 ${fmt(w.kills)}마리 · 화무기 ${w.best.hwamugi ? fmtSec(w.best.hwamugi) : '—'} · 마귀 ${w.best.magwi ? fmtSec(w.best.magwi) : '—'} · 각성 마귀 ${w.best.awk ? fmtSec(w.best.awk) : '—'}`);
    const block = (title, sub, rows, val) => h('div', { class: 'wb-block' }, h('div', { class: 'wb-head' }, h('b', {}, title), h('small', {}, ` ${sub}`)),
      ...(rows.length ? rows.map((p, i) => h('div', { class: `row rank-row${p.uid === net.uid ? ' me' : ''}` }, medal(i),
        h('div', { class: 'info' }, h('div', { class: 'name' }, ...nameOf(p)), h('div', { class: 'desc' }, `Lv.${p.lv || 1}`)),
        h('div', { style: 'font-weight:900;color:#fde68a' }, val(p)))) : [h('p', { class: 'muted', style: 'margin:4px 0 8px' }, '아직 아무도 없어요 — 첫 기록의 주인이 되어 보세요')]));
    status.textContent = '';
    list.replaceChildren(mine,
      block('두목 처치', '이번 주 실제로 잡은 두목 수(던전·방치 빼고)', b.kills, (p) => `${fmt(p.kills || 0)}마리`),
      block('⏱ 화무기 최단', '나선 때부터 쓰러질 때까지', b.hwamugi, (p) => fmtSec(p.hwamugi)),
      block('⏱ 마귀 최단', '화무기를 넘어야 열려요', b.magwi, (p) => fmtSec(p.magwi)),
      block('⏱ 覺 각성 마귀 최단', '5차 뒤 · 무림고수 칸에서 각성 켜기', b.awk || [], (p) => fmtSec(p.awk)));
  }
  async function loadLv() {
    head.replaceChildren('서열', h('small', {}, '레벨 순'));
    await net.pushProfile(true);
    const rows = (await net.ranking()).sort((a, b) => (b.level || 0) - (a.level || 0) || (b.power || 0) - (a.power || 0));
    status.textContent = rows.length ? '' : '아직 아무도 없어요.';
    list.replaceChildren(...rows.map((p, i) => h('div', { class: `row rank-row${p.uid === net.uid ? ' me' : ''}` },
      medal(i),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, ...nameOf(p), h('small', {}, `${p.tierName || ''}`)),
        h('div', { class: 'desc' }, `Lv.${p.level || 1} · ${p.mapName || ''}${p.guildName ? ` · ${p.guildName}` : ''}`)),
      h('div', { style: 'font-weight:900;color:#fde68a' }, fmt(p.power || 0)))));
  }
  async function load() {
    loaded = Date.now();
    if (!net?.ready?.()) { status.textContent = '인터넷에 연결되면 볼 수 있어요.'; list.replaceChildren(); return; }
    status.textContent = '불러오는 중…';
    try { await (mode === 'wboss' ? loadWeek() : loadLv()); }
    catch (err) {
      status.textContent = '불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.';
      console.warn('[ranking]', err);
    }
  }
  return { root, update() {}, shown() { if (Date.now() - loaded > 30000) load(); }, netChanged(what) { if (what === 'rank') load(); } };   // v308 정리 뒤 바로
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
  let chatDraft = '';
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
        findCard(),
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
      const text = `방치형키우기 문파 "${net.guild.name}" 가입 코드: ${net.guild.code}\n${location.origin}${location.pathname}`;
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
    // v256: 무림 탭을 열 때마다 창을 새로 그려 쓰던 글이 사라졌다 — 쓰던 글을 기억해 둔다
    input.value = chatDraft;
    input.addEventListener('input', () => { chatDraft = input.value; });
    const send = h('button', { class: 'btn primary' }, '전송');
    const doSend = async () => {
      const text = input.value;
      if (!text.trim()) return;
      input.value = ''; chatDraft = '';
      try { await net.sendChat(text); } catch (err) { toast(err.message); input.value = text; chatDraft = text; }
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
        net.guild.owner === net.uid ? openRow() : null,
        h('div', { class: 'btn-row' }, checkBtn, donateBtn)),
      segBtns, secs.members, secs.bank, secs.chat,
      h('div', { class: 'guild-foot' }, leave));
    pickSeg(seg);
    loadMembers();
    update();
  }

  // v339 문파 찾기 — 모집 중인 문파 목록에서 바로 가입(코드 없이)
  function findCard() {
    const list = h('div', { class: 'guild-find' }, h('p', { class: 'muted' }, '모집 중인 문파를 불러오는 중…'));
    const load = () => net.listGuilds().then((gs) => {
      if (!list.isConnected && list.parentNode == null) return;
      list.replaceChildren(...(gs.length ? gs.slice(0, 20).map((g) => {
        const lvOk = game.s.level >= (g.minLv || 0);
        const btn = h('button', { class: 'btn good', style: 'padding:6px 12px', disabled: lvOk ? null : true }, lvOk ? '가입' : `Lv${g.minLv}부터`);
        btn.onclick = busy(btn, async () => { await net.joinGuild(g.id); toast(`${g.name}에 들어갔어요!`); });
        return h('div', { class: 'row guild-row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, g.name, g.minLv ? h('small', {}, ` Lv${g.minLv} 이상`) : null),
          g.intro ? h('div', { class: 'guild-intro-line' }, `“${g.intro}”`) : null,
          h('div', { class: 'desc' }, `Lv.${W.guildLevel(g.exp)} · ${g.n}/${W.GUILD_MAX}명 · 전원 공격력 +${pct(W.guildAtk(g.exp))}`)), btn);
      }) : [h('p', { class: 'muted' }, '지금 모집 중인 문파가 없어요 — 새로 만들어 보세요')]));
    }).catch(() => list.replaceChildren(h('p', { class: 'muted' }, '문파 목록을 불러오지 못했어요 — 잠시 뒤 다시 열어 주세요')));
    load();
    return h('div', { class: 'card' }, h('h3', {}, '문파 찾기', h('small', {}, '모집 중인 문파에 바로 가입')),
      list, h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: () => { list.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…')); load(); } }, '새로 고침'));
  }
  // 문주 — 문파 찾기 목록에 보일지(모집 중 / 닫음)
  function openRow() {
    const btn = h('button', { class: 'btn', style: 'padding:4px 10px' }, '…');
    let open = true;
    const paint = () => { btn.textContent = open ? '📢 모집 중 (찾기에 보임)' : '🔒 모집 닫음'; btn.classList.toggle('primary', open); };
    net.guildOpen(net.guild.id).then((v) => { open = v; paint(); });
    btn.onclick = busy(btn, async () => { open = !open; await net.setGuildOpen(open); paint(); toast(open ? '문파 찾기 목록에 보여요' : '문파 찾기 목록에서 숨겼어요(코드로는 가입 돼요)'); });
    paint();
    const info = h('button', { class: 'btn', style: 'padding:4px 10px' }, '✎ 소개·가입 레벨');
    info.onclick = async () => {
      const cur = await net.guildInfo(net.guild.id);
      const intro = h('input', { class: 'field', id: 'guild-intro-in', maxlength: 40, placeholder: '한 줄 소개 (예: 매일 토벌 · 초보 환영)', value: cur.intro });
      const lv = h('input', { class: 'field', id: 'guild-minlv-in', type: 'number', min: 0, max: 200, value: String(cur.minLv || 0) });
      openModal((m) => m.append(h('h2', {}, '문파 소개 · 가입 레벨'),
        h('p', { class: 'muted' }, '문파 찾기 목록에 보여요. 가입 레벨보다 낮은 무인은 목록에서 가입 단추가 잠겨요(코드로는 들어와요).'),
        h('label', { class: 'muted' }, '한 줄 소개 (40자)'), intro, h('label', { class: 'muted', style: 'display:block;margin-top:8px' }, '가입 레벨 (0이면 누구나)'), lv,
        h('div', { class: 'btn-row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: closeModal }, '그만두기'),
          h('button', { class: 'btn primary', id: 'guild-info-save', onclick: async () => { try { await net.setGuildInfo(intro.value.trim(), lv.value); closeModal(); toast('문파 소개를 바꿨어요'); } catch (err) { toast(`바꾸지 못했어요 — ${err?.message || err}`); } } }, '저장'))));
    };
    return h('div', { class: 'gh-code' }, h('span', { class: 'muted' }, '문파 찾기'), btn, info);
  }

  let membersAt = 0;
  async function loadMembers() {
    membersAt = Date.now();
    const rows = await net.members().catch(() => []);
    if (!els) return;
    rows.sort((a, b) => (b.level || 0) - (a.level || 0));
    memRows = rows;
    renderMembers();
  }
  let memRows = null;
  // v344 문파원 줄 — '● 접속 중 · 어디에서'는 실시간(where)이 바뀔 때마다 다시 그린다(서버를 다시 읽지 않는다)
  function renderMembers() {
    const rows = memRows;
    if (!els || !rows) return;
    const today = dayKey();
    const gd = net.guild;
    els.members.replaceChildren(...rows.map((p) => h('div', { class: `row rank-row${p.uid === net.uid ? ' me' : ''}` },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, `${p.uid === gd?.owner ? '👑 ' : ''}${p.nickname || '이름없음'}`, h('small', {}, p.tierName || '')),
        h('div', { class: 'desc' }, ...(() => {
          const w = p.uid === net.uid ? { m: app.where?.here?.() ?? game.s.map } : app.where?.of(p.uid);
          return w ? [h('b', { class: 'who-on' }, '● 접속 중 '), `Lv.${p.level || 1} · ${app.where.placeName(w.m)}${w.m > 0 && !W.mapOf(w.m)?.town ? '에서 사냥 중' : ''}`]
            : [`Lv.${p.level || 1} · ${p.mapName || ''} · ${ago(p.updatedAt?.toMillis?.())} (접속 안 함)`];
        })())),
      // v345 따라가기 — 접속 중인 문파원이 있는 구역으로(두목 구역이면 '함께'로)
      (() => { const w = p.uid !== net.uid ? app.where?.of(p.uid) : null; return w && w.m !== -1 && w.m !== game.s.map ? h('button', { class: 'btn mini primary follow-btn', onclick: () => follow(w.m, p.nickname || '문파원') }, '따라가기') : null; })(),
      h('div', { class: `chip${gd?.checkins?.[p.uid] === today ? ' on' : ''}` }, gd?.checkins?.[p.uid] === today ? '오늘 출석' : '미출석'))));
  }
  function follow(m, name) {
    if (game.inst) return toast('던전 안에서는 따라갈 수 없어요 — 던전을 마치고 가요');
    if (m === 0 || W.mapOf(m)?.town) { game.goTown(false); app.save(); app.closePanel(); app.refresh(); return toast(`🏠 ${name}님이 있는 마을로 왔어요`); }
    const mm = W.mapOf(m);
    if (!mm || !game.canEnter(m)) return toast(`${name}님이 있는 곳(${mm?.name || '?'})은 아직 갈 수 없어요`);
    if (mm.bossRoom) game.s.kingParty = true;   // 두목 구역은 함께로
    if (!game.enterMap(m)) return toast('지금은 갈 수 없어요');
    game.s.autoHunt = true;
    app.save(); app.closePanel(); app.refresh();
    toast(`🤝 ${name}님이 있는 ${mm.name}(으)로 왔어요${mm.bossRoom ? ' — 함께 사냥' : ''}`);
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
      else if (what === 'where') renderMembers();
      else update();
    },
  };
}

// v302 전체 채팅 — 모든 무인이 한 방. 문파가 없어도 된다. 무림 소식(전직·신화 각인·천품)도 여기 흐른다.
function worldChatView(app) {
  const { game, net } = app;
  const root = h('div');
  let sig = '', draft = '';
  const box = h('div', { class: 'chat chat-world' });
  const input = h('input', { class: 'field', maxlength: WORLD_MAX, placeholder: `모두에게 한마디 (${WORLD_MAX}자)` });
  const count = h('small', { class: 'chat-count' }, '');
  const recount = () => { const n = input.value.length; count.textContent = n ? `${n}/${WORLD_MAX}` : ''; count.classList.toggle('full', n >= WORLD_MAX); };
  input.addEventListener('input', () => { draft = input.value; recount(); });
  const send = h('button', { class: 'btn primary' }, '보내기');
  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (!game.s.nickname) return toast('이름을 먼저 정해요 (캐릭터 창)');
    input.value = ''; draft = ''; recount();
    try { await net.sendWorld(text); } catch (err) { toast(err.message || '보내지 못했어요'); input.value = text; draft = text; }
  };
  send.onclick = doSend;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
  const status = h('p', { class: 'muted' });
  const muteRow = h('div', { class: 'chat-mute-row' });
  root.append(h('div', { class: 'card' }, h('h3', {}, '전체 채팅', h('small', {}, ' 무림의 모든 무인 · 이름을 누르면 가리기')), status, box, h('div', { class: 'chat-input' }, input, count, send), muteRow));
  // v315 이름을 누르면 — 그 무인 가리기(이 기기에서만 안 보인다)
  const whoMenu = (m) => {
    if (!m.uid || m.uid === net.uid) return;
    const t = m.title ? W.titleOf(m.title) : null;
    openModal((sh) => sh.append(
      h('h2', {}, t ? h('span', { class: 'title-tag', style: `--tc:${t.col}` }, `〈${t.name}〉 `) : null, m.name || '무명'),
      h('p', { class: 'muted' }, '가리면 이 무인의 말이 내 전체 채팅에 안 보여요. 상대는 몰라요. 아래 \'가린 무인\'에서 언제든 풀 수 있어요.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn danger', onclick: () => { game.muteChat(m.uid, m.name); app.save(); closeModal(); sig = ''; render(); toast(`${m.name || '무명'}의 말을 가렸어요`); } }, '이 무인 가리기'),
        // v321 신고 — 운영자에게 이 말을 보낸다
        h('button', { class: 'btn', onclick: async () => {
          if (!confirm(`'${String(m.text).slice(0, 40)}' — 이 말을 운영자에게 신고할까요?`)) return;
          try { const r = await net.report(m); toast(r === 'dup' ? '이미 신고한 말이에요' : '신고했어요 — 운영자가 살펴볼게요'); } catch (err) { toast('신고하지 못했어요'); console.warn(err); }
          closeModal();
        } }, '신고')),
      // v321 운영자 — 입막음(서버가 막는다)
      ...(isAdmin() ? [h('div', { class: 'btn-row admin-mute' }, h('small', {}, '운영자 · 입막음'),
        ...[['1시간', 3600e3], ['1일', 86400e3], ['영구', Infinity]].map(([t, ms]) => h('button', { class: 'btn', onclick: async () => {
          try { await net.mute(m.uid, m.name, ms, m.text); toast(`${m.name || '무명'} — ${t} 입막음`); } catch (err) { toast(err.message || '막지 못했어요'); }
          closeModal();
        } }, t)),
        h('button', { class: 'btn', onclick: async () => { try { await net.unmute(m.uid); toast('입막음을 풀었어요'); } catch (err) { toast(err.message || '풀지 못했어요'); } closeModal(); } }, '풀기'))] : []),
      h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: closeModal }, '닫기')));
  };
  const muteList = () => openModal((sh) => {
    const list = h('div', { class: 'mute-list' });
    const paint = () => list.replaceChildren(...(game.s.chatMute.length ? game.s.chatMute.map((x) => h('div', { class: 'row' },
      h('div', { class: 'info' }, h('div', { class: 'name' }, x.name)),
      h('button', { class: 'btn', onclick: () => { game.unmuteChat(x.uid); app.save(); sig = ''; render(); paint(); } }, '풀기'))) : [h('p', { class: 'muted' }, '가린 무인이 없어요')]));
    paint();
    sh.append(h('h2', {}, '가린 무인'), list, h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기')));
  });
  const isAdmin = () => !!net?.isAdmin?.();
  function render() {
    const on = !!net?.online;
    const muted = (net?.muteUntil || 0) > Date.now();   // v321 입막음
    status.textContent = !on ? (net?.status === 'connecting' ? '서버에 연결하는 중이에요…' : '인터넷에 연결되면 이야기할 수 있어요.')
      : muted ? (net.muteUntil - Date.now() > 1e11 ? '🔇 운영자가 입을 막았어요 — 전체 채팅을 쓸 수 없어요' : `🔇 운영자가 입을 막았어요 — ${Math.ceil((net.muteUntil - Date.now()) / 60000)}분 뒤에 말할 수 있어요`) : '';
    status.style.color = muted ? '#fca5a5' : '';
    input.disabled = send.disabled = on && !muted ? null : true;
    const all = net?.world || [];
    const msgs = all.filter((m) => m.type === 'system' || !game.isMuted(m.uid));   // v315 가린 무인
    const hid = all.length - msgs.length;
    const nsig = msgs.map((m) => m.id).join(',') + (on ? '1' : '0') + `|${game.s.chatMute.length}`;
    if (nsig === sig) return;
    sig = nsig;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.replaceChildren(...(msgs.length ? msgs.map((m) => {
      const t = m.createdAt?.toDate ? m.createdAt.toDate() : null;
      const time = t ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
      const del = isAdmin() ? h('button', { class: 'msg-del', title: '지우기', onclick: () => { if (confirm('이 말을 지울까요?')) net.deleteWorld(m.id).catch((e) => toast(e.message)); } }, '✕') : null;
      if (m.type === 'system') return h('div', { class: 'msg system' }, m.text, h('time', {}, time), del);
      const tt = m.title ? W.titleOf(m.title) : null;   // v315 낀 칭호 — 칭호 빛깔로
      return h('div', { class: `msg${m.uid === net.uid ? ' mine' : ''}` },
        h('button', { class: 'who', style: tt ? `--tc:${tt.col}` : null, onclick: () => whoMenu(m) }, tt ? h('span', { class: 'who-title' }, `〈${tt.name}〉`) : null, m.name || '무명'),
        m.text, h('time', {}, time), del);
    }) : [h('div', { class: 'muted' }, on ? '아직 아무 말도 없어요 — 첫 인사를 남겨 보세요 👋' : '')]));
    muteRow.replaceChildren(...(game.s.chatMute.length ? [h('button', { class: 'btn itm-info', style: 'font-size:11.5px;padding:3px 8px', onclick: muteList }, `가린 무인 ${game.s.chatMute.length}명${hid ? ` · 지금 ${hid}마디 가림` : ''} ›`)] : []));
    if (nearBottom) box.scrollTop = box.scrollHeight;
    net?.worldMarkSeen?.();
  }
  return {
    root,
    update() { render(); },
    shown() { input.value = draft; recount(); render(); box.scrollTop = box.scrollHeight; net?.worldMarkSeen?.(); net?.checkMute?.().then(() => { sig = ''; render(); }); },   // v321 입막음을 본다
    netChanged(what) { if (what === 'wchat' || what === 'status') render(); },
  };
}
function socialTab(app) {
  return subTabs([
    { key: 'world', label: '전체', make: () => worldChatView(app) },
    { key: 'guild', label: '문파', make: () => guildView(app) },
    { key: 'rank', label: '서열', make: () => rankView(app) },
    { key: 'lore', label: '인물록', make: () => loreView(app) },
  ], 'ifu.socialsub');
}

// ---------- 인물록 (v148) ----------
// 세력마다 고수들의 이야기 · 십이지왕 · 그 밖의 사람들. 쓰러뜨린 고수에는 ✓.
function loreView(app) {
  app.game?.mark?.('lore');
  const { game } = app;
  const root = h('div');
  let sig = '';
  const person = (name, title, story, o = {}) => h('details', { class: `card lore-person${o.won ? ' won' : ''}`, style: o.col ? `--fc:${o.col}` : '' },
    h('summary', {}, h('b', {}, `${title} `, h('span', {}, name)), o.lv ? h('small', {}, ` Lv.${o.lv}${o.won ? ' · 격파 ✓' : ''}`) : null),
    h('p', {}, story));
  return {
    root,
    update() {
      const nsig = JSON.stringify(game.s.duel.won);
      if (nsig === sig) return;
      sig = nsig;
      const out = [h('p', { class: 'muted' }, '무림의 사람들. 지도 창의 무림맹·사파·마교 칸에서 이들의 두목 방에 갈 수 있어요.')];
      for (const F of MS.FACTIONS) {
        out.push(h('h3', { class: 'king-head', style: `color:${F.col}` }, F.name, h('small', {}, ` ${F.hanja}`)));
        for (const m of MS.mastersOf(F.id)) out.push(person(m.name, m.title, m.story, { lv: m.lv, won: !!game.s.duel.won[m.id], col: F.col }));
        for (const o of MS.OTHER_LORE.filter((x) => x.fac === F.id)) out.push(person(o.name, o.title, o.story, { col: F.col }));
      }
      out.push(h('h3', { class: 'king-head' }, '십이지왕', h('small', {}, ' 화무기가 세운 열두 왕')));
      for (const o of MS.OTHER_LORE.filter((x) => !x.fac)) out.push(person(o.name, o.title, o.story));
      for (const zn of W.ZONE_ORDER.filter((z) => z.king)) {
        const k = zn.king;
        out.push(person(k.real || '', `${zn.name}`, MS.KING_STORY[k.title] || `${k.hanja ? `${k.hanja} · ` : ''}${k.desc || ''}`, { lv: zn.lv[1] }));
      }
      root.replaceChildren(...out);
    },
  };
}

// ---------- 동료: 애완동물 · 탈것 (v111) ----------
function compTab(app) {
  surePetFeed.game = app.game;
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
        h('b', {}, d.name), h('span', {}, `이동 +${W.spdPct(d.speed)}% · 공격·체력 +${Math.round(d.stat * 100)}%`), h('small', {}, d.hard ? `무한의 탑 · 극 ${d.hard * 10}층` : d.zodiac ? `무한의 탑 ${d.zodiac * 10}층 십이지 뽑기` : `${z?.name || ''} 두목부터`));
    }));
  // v147: 애완동물 | 탈것 두 칸으로 · v292 도감 칸 · 얻는 곳
  const where = (title, lines) => h('details', { class: 'card rank-card' }, h('summary', {}, h('b', {}, title), h('small', {}, ' 눌러서 보기')), ...lines.map((t) => h('div', { class: 'where-line' }, t)));
  const petWhere = where('애완동물 얻는 곳', [
    '🐉 두목 — 낮은 확률로 애완동물(높은 두목일수록 자주·위 순위까지)',
    `🧩 포획 조각 ${W.PET_SHARD_NEED}개 → 지금 지역의 애완동물 하나`,
    `  · 졸개 가끔(정예 3배) · 두목 ${W.BOSS_SHARDS.pet[0]}~${W.BOSS_SHARDS.pet[1]}개(왕·고수 2배) · 일일 던전 한 판(소탕 포함) · 무한의 탑 처음 오른 층 · 보물 원숭이 ${W.TREASURE_SHARDS}개 · 주간 상자 ${W.WEEK_SHARDS}개 · 방치 · 도감 이정표`,
    `★ 별 — 우리에 있는 같은 종을 먹이로 주면 별 하나(최대 ${W.PET_STAR_MAX}) · 별마다 버프·공격 +${Math.round(W.PET_STAR_K * 100)}%`,
    `💠 혼 — 다 큰(Lv.${W.PET_LV_MAX}) 애완동물의 경험치 · 놓아준 애완동물(레어 1 · 유니크 2 · 전설 4 · 신화 8 + 레벨 10마다 1) · 도감 이정표 → 등급 올리기`,
    `◆ 품 — 얻을 때마다 ${Math.round(W.PET_QUAL_P[0] * 100)}%로 극품(×${W.PET_QUAL[1].mult}) · ${(W.PET_QUAL_P[1] * 100).toFixed(1)}%로 천품(×${W.PET_QUAL[2].mult}) · 먹이로 주면 더 높은 품을 물려받아요`,
    `🥋 단 수련 — 다 큰(Lv.${W.PET_LV_MAX}) 애완동물을 혼으로 1~${W.PET_DAN_MAX}단 · 단마다 버프·공격 +${Math.round(W.PET_DAN_K * 100)}% · 확률이 있고 실패하면 다음 확률 +${Math.round(W.PET_DAN_PITY * 100)}%p · 성공하면 ${Math.round(W.PET_DAN_GREAT * 100)}%로 大成(두 단)`,
  ]);
  const mountWhere = where('탈것 얻는 곳', [
    '🐉 두목 — 낮은 확률로 탈것(높은 두목일수록 자주·좋은 것까지)',
    `🧩 탈것 조각 ${W.MOUNT_SHARD_NEED}개 → 지금 지역의 탈것 하나`,
    `  · 졸개 가끔(정예 3배) · 두목 ${W.BOSS_SHARDS.mount[0]}~${W.BOSS_SHARDS.mount[1]}개(왕·고수 2배) · 일일 던전 한 판 · 무한의 탑 처음 오른 층 · 보물 원숭이 · 주간 상자 · 방치 · 도감 이정표`,
    `🔮 합성 — 같은 순위 ${W.MOUNT_FUSE_N}마리 → 다음 순위 하나(길들인 레벨의 절반을 이어 간다)`,
    '🐲 십이지 신수 — 무한의 탑 10층마다 십이지 뽑기',
    `⚡ 극의 신수 여섯 — 무한의 탑 · 극(하드) 10층마다 그 층의 신수를 이기면 (이동 +90~120% · 공격·체력 크게 · 길들이기 최대 20)`,
    `🪢 길들이기 — 탈것 조각과 은자로 레벨(최대 ${W.MOUNT_LV_MAX}) · 레벨마다 이동·공격·체력 +${Math.round(W.MOUNT_LV_K * 100)}% · 극의 신수는 최대 ${W.HARD_LV_MAX} · 레벨마다 이동 +${Math.round(W.HARD_SPD_LV_K * 100)}%·공격·체력 +${Math.round(W.HARD_LV_K * 100)}%`,
  ]);
  const dexCard = h('div', { class: 'card' });
  const petBox = h('div', {}, petCard, boxCard, petWhere, rankCard);
  const mountBox = h('div', {}, mountCard, mountWhere, mountRank);
  const dexBox = h('div', {}, dexCard);
  void root;
  let mountFlt = (() => { try { return localStorage.getItem('ifu.mflt') || 'all'; } catch { return 'all'; } })();   // v380 탈것 걸러 보기
  let sig = '';
  const rarTag = (r) => h('b', { style: `color:${W.RARITY[r].color}` }, W.RARITY[r].name);
  const starTag = (p) => ((p.star || 0) ? h('span', { class: 'pet-star' }, ` ${'★'.repeat(p.star)}`) : '');   // v292
  // v316 품 · 단
  const qualTag = (p) => ((p.q || 0) ? h('span', { class: `pet-q q${p.q}`, title: `${W.PET_QUAL[p.q].name} — 버프·공격 ×${W.PET_QUAL[p.q].mult}` }, `${W.PET_QUAL[p.q].mark}${W.PET_QUAL[p.q].name} `) : '');
  const danTag = (p) => ((p.dan || 0) ? h('span', { class: 'pet-dan' }, ` ${p.dan}단`) : '');
  const petInfo = (p) => {
    const d = W.petOf(p.kind);
    const v = W.petBuff(p);
    const vt = d.buff === 'crit' ? `+${(v * 100).toFixed(1)}%p` : d.buff === 'def' ? `+${v.toFixed(0)}` : d.buff === 'regenPct' ? `+${(v * 100).toFixed(2)}%` : `+${(v * 100).toFixed(1)}%`;
    return `${d.text} ${vt} · 한 대에 무인 공격력의 ${Math.round(W.petAtkRatio(p) * 100)}% · 기술 【${W.PET_SKILL_NAME[p.kind]}】 ${W.petSkillSec(p).toFixed(1)}초마다 ${p.kind === 'yellow' ? '화면 전체' : `반지름 ${W.petSkillR(p)}`}를 ${Math.round(W.petAtkRatio(p) * W.PET_SKILL_MULT * 100)}%로 · ${W.PET_SKILL_SP[p.kind]}`;
  };
  const confirmRelease = (p, then) => openModal((m) => {
    m.append(h('h2', {}, `${W.petOf(p.kind).name}을(를) 놓아줄까요?`),
      h('p', { class: 'muted' }, `Lv.${p.lv}까지 키운 것이 사라지고 혼 ${W.petReleaseSoul(p)}이 남아요. 되돌릴 수 없어요.${game.starFodder(p.uid).length || s0().pets.some((x) => x.kind === p.kind && x.uid !== p.uid) ? ' (같은 종에게 먹이로 주면 별이 하나 올라요)' : ''}`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '그만두기'),
        h('button', { class: 'btn danger', onclick: () => { const soul = game.releasePet(p.uid); closeModal(); if (soul) toast(`놓아주었어요 — 혼 +${soul}`); then(); } }, '놓아주기')));
  });
  const s0 = () => game.s;
  function upd() {
    const s = game.s;
    const nsig = `${s.pets.map((p) => `${p.uid}.${p.lv}.${p.rar}.${p.star || 0}.${p.q || 0}.${p.dan || 0}.${p.danFail || 0}.${Math.floor(p.exp / 50)}`)}|${s.petBox.map((p) => `${p.uid}.${p.rar}.${p.star || 0}.${p.q || 0}`)}|${s.mounts.map((m) => `${m.uid}.${m.lv || 0}`)}|${s.mount}|${game.petSlots()}|${goldSig(game, 'comp')}|${s.petShard || 0}|${s.mountShard || 0}|${s.petSoul || 0}|${JSON.stringify(s.dexGoals)}|${JSON.stringify(s.petDex)}|${Object.keys(s.mountDex || {}).length}`;
    if (nsig === sig) return;
    sig = nsig;
    const done = () => { app.save(); sig = ''; app.refresh(); };
    // v362 뽑기 — 조각 100으로 한 번 · 1000으로 열 번 · 확률 보기
    const gachaRow = (kind, have, note) => h('div', { class: 'gacha-row' },
      h('div', { class: 'g-info' }, h('b', {}, have), h('small', {}, ` ${note} · 천장 ${s.gacha[kind].pity}/${kind === 'pet' ? W.GACHA_PET_PITY : W.GACHA_MOUNT_PITY}`),
        h('small', { class: 'g-pick' }, `✨ 이번 주 픽업 — ${kind === 'pet' ? `${W.petOf(W.gachaPickup().pet).emoji} ${W.petOf(W.gachaPickup().pet).name}` : `${W.mountOf(W.gachaPickup().mount).emoji} ${W.mountOf(W.gachaPickup().mount).name}`} 확률 ${W.PICKUP_K}배`)),
      h('div', { class: 'g-btns' },
        game.freeGacha(kind) ? h('button', { class: 'buy gacha-free', id: `gacha-${kind}-free`, disabled: game.canGacha(kind, 1, true) ? null : true, onclick: () => runGacha(kind, 1, true) }, '🎁 오늘 무료') : null,
        h('button', { class: 'btn mini', onclick: () => openGachaRates(kind) }, '확률'),
        h('button', { class: 'btn mini', onclick: () => openGachaLog(game, kind) }, '기록'),
        h('button', { class: 'buy gacha-1', id: `gacha-${kind}-1`, disabled: game.canGacha(kind, 1) ? null : true, onclick: () => runGacha(kind, 1) }, `소환 ×1 (${W.GACHA_COST})`),
        h('button', { class: 'buy gacha-10', id: `gacha-${kind}-10`, disabled: game.canGacha(kind, 10) ? null : true, onclick: () => runGacha(kind, 10) }, `×10 (${W.GACHA_COST * 10})`),
        h('button', { class: 'buy gacha-auto', id: `gacha-${kind}-auto`, disabled: game.canGacha(kind, 1) ? null : true, title: kind === 'pet' ? '신화가 나올 때까지 연속으로 — 나오면 멈춰 연출' : '신수가 나올 때까지 연속으로 — 나오면 멈춰 연출', onclick: () => runGachaAuto(kind) }, `🔁 연속 (${kind === 'pet' ? '신화' : '신수'}까지)`)));
    // v422 연속 소환 — 조각이 있는 동안 10연(모자라면 1연)을 빠르게 이어 가고, 신화(영수)·신수(탈것)가 나오면 멈춰 그 판의 연출을 크게 보여 준다. 「멈추기」로 언제든.
    const runGachaAuto = (kind) => {
      if (!game.canGacha(kind, 1)) return toast(game.gachaRoom(kind) < 1 ? '우리가 모자라요 — 놓아주거나 키우는 칸으로 옮겨요' : '조각이 모자라요');
      const isBig = (r) => (r.kind === 'pet' ? r.rar >= 3 : r.grade >= 3);
      const bigName = kind === 'pet' ? '신화' : '신수';
      const tally = [0, 0, 0, 0, 0]; let n = 0, stop = false, timer = 0;
      const ov = h('div', { id: 'gacha-auto' },
        h('div', { class: 'ga-box' },
          h('h3', {}, `🔁 ${kind === 'pet' ? '영수' : '탈것'} 연속 소환`, h('small', {}, ` ${bigName}가 나오면 멈춰요`)),
          h('div', { class: 'ga-n' }, '0번'), h('div', { class: 'ga-tally muted' }, ''), h('div', { class: 'ga-last' }),
          h('button', { class: 'btn ga-stop' }, '멈추기')));
      document.body.append(ov);
      const nEl = ov.querySelector('.ga-n'), tEl = ov.querySelector('.ga-tally'), lEl = ov.querySelector('.ga-last');
      const GN = kind === 'pet' ? ['레어', '유니크', '전설', '신화'] : ['일반', '좋은', '귀한', '십이지', '신수'];
      const paint = (res) => {
        nEl.textContent = `${n}번 · ${kind === 'pet' ? `포획 조각 ${fmt(s.petShard || 0)}` : `탈것 조각 ${fmt(s.mountShard || 0)}`} · 천장 ${s.gacha[kind].pity}/${kind === 'pet' ? W.GACHA_PET_PITY : W.GACHA_MOUNT_PITY}`;
        tEl.textContent = GN.map((g, i) => `${g} ${tally[i]}`).join(' · ');
        if (res) lEl.replaceChildren(...res.map((r) => h('span', { class: `ga-r g${r.kind === 'pet' ? r.rar : r.grade}` }, `${(r.kind === 'pet' ? W.petOf(r.id) : W.mountOf(r.id)).emoji}`)));
      };
      const end = () => { clearTimeout(timer); stop = true; ov.remove(); done(); };
      ov.querySelector('.ga-stop').onclick = end;
      const step = () => {
        if (stop) return;
        const k = game.canGacha(kind, 10) ? 10 : game.canGacha(kind, 1) ? 1 : 0;
        if (!k) { toast(game.gachaRoom(kind) < 1 ? `연속 소환 끝 — 우리가 가득 찼어요(${n}번)` : `연속 소환 끝 — 조각이 모자라요(${n}번)`); return end(); }
        const res = game.gacha(kind, k);
        if (!res) return end();
        n += k; for (const r of res) tally[Math.min(tally.length - 1, r.kind === 'pet' ? r.rar : r.grade)]++;
        app.save(); paint(res);
        const big = res.filter(isBig);
        if (big.length) {
          if (app.net?.announce) {
            const names = big.map((r) => (r.kind === 'pet' ? `신화 ${W.petOf(r.id).name}` : `${W.mountOf(r.id).hard ? '극의 신수' : '십이지 신수'} ${W.mountOf(r.id).name}`));
            app.net.announce(`🎊 ${s.nickname}님이 ${kind === 'pet' ? '영수' : '탈것'} 소환에서 ${names.join(' · ')}을(를) 불러냈어요!`);
          }
          clearTimeout(timer); stop = true; ov.remove();
          toast(`🔁 ${n}번째에 ${bigName}! — 연속 소환을 멈췄어요`);
          playGacha(res, kind, () => { done(); });
          return;
        }
        timer = setTimeout(step, 420);
      };
      paint(null); timer = setTimeout(step, 250);
    };
    const runGacha = (kind, n, free = false) => {
      if (!game.canGacha(kind, n, free)) return toast(game.gachaRoom(kind) < n ? '우리가 모자라요 — 놓아주거나 키우는 칸으로 옮겨요' : '조각이 모자라요');
      const res = game.gacha(kind, n, free);
      if (!res) return;
      app.save();
      // v366 자랑 — 신화 애완동물 · 신수 탈것이 나오면 문파·전체 채팅에 한 줄(열 번이어도 한 줄)
      const big = res.filter((r) => (r.kind === 'pet' ? r.rar >= 3 : r.grade >= 3));
      if (big.length && app.net?.announce) {
        const names = big.map((r) => (r.kind === 'pet' ? `신화 ${W.petOf(r.id).name}` : `${W.mountOf(r.id).hard ? '극의 신수' : '십이지 신수'} ${W.mountOf(r.id).name}`));
        app.net.announce(`🎊 ${s.nickname}님이 ${kind === 'pet' ? '영수' : '탈것'} 소환에서 ${names.join(' · ')}을(를) 불러냈어요!`);
      }
      playGacha(res, kind, () => { done(); });
    };
    const slots = game.petSlots();
    petCard.replaceChildren(h('h3', {}, '애완동물', h('small', {}, `키우는 칸 ${s.pets.length}/${slots}`)),
      // v262 포획 조각 · 혼
      h('div', { class: 'pet-extra' },
        gachaRow('pet', `포획 조각 ${fmt(s.petShard || 0)}`, `우리 ${s.petBox.length}/${W.PET_BOX}`),
        h('div', {}, h('b', {}, `혼 ${fmt(s.petSoul || 0)}`), h('small', {}, ` 다 큰(Lv.${W.PET_LV_MAX}) 애완동물이 받는 경험치가 혼이 돼요 · 등급 올리기 · 단 수련에 써요`))),
      ...(slots === 1 ? [h('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, "가락지·귀걸이에 '애완동물 +N'이 붙으면 함께 키우는 칸이 늘어요.")] : []));   // v292 null이 글자로 찍혔다
    if (!s.pets.length) petCard.append(h('p', { class: 'muted' }, '두목이 아주 가끔 애완동물을 떨궈요 — 초반 두목은 아주 드물게 아래 순위만, 높은 두목일수록 자주·위 순위까지. 데려가면 곁에서 무인 공격력에 비례해 싸우고 버프를 걸어 줘요. 무인과 함께 자라요.'));
    s.pets.forEach((p, i) => {
      const d = W.petOf(p.kind);
      const active = i < slots;
      const need = W.petExpToNext(p.lv);
      petCard.append(h('div', { class: `row pet-row${active ? '' : ' locked'}` },
        h('div', { class: 'ico pet-ico' }, creatureIcon(W.petArt(p))),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, qualTag(p), d.name, ' ', rarTag(p.rar), starTag(p), danTag(p), h('small', {}, `순위 ${d.tier} · Lv.${p.lv}${p.lv >= W.PET_LV_MAX ? ' (최대)' : ''}${active ? '' : ' · 칸이 모자라 쉬는 중'}`)),
          h('div', { class: 'desc' }, petInfo(p)),
          p.lv < W.PET_LV_MAX ? h('div', { class: 'bar thin' }, h('div', { style: `width:${Math.min(100, (p.exp / need) * 100)}%` })) : null),
        h('div', { class: 'pet-btns' },
          game.petSoulCost(p) != null ? h('button', { class: 'buy', disabled: game.canSoulUp(p.uid) ? null : true, onclick: () => { if (game.soulUp(p.uid)) { toast(`${d.name} — ${W.RARITY[p.rar].name}(으)로!`); done(); } } }, `등급 ↑`, h('small', {}, `혼 ${game.petSoulCost(p)}`)) : null,
          // v316 단 수련 — 다 큰 뒤
          game.petDanCost(p) != null ? h('button', { class: 'buy dan-btn', disabled: game.canPetDan(p.uid) ? null : true, title: `성공하면 ${(p.dan || 0) + 1}단(가끔 大成으로 두 단) · 실패해도 다음 확률이 올라요`, onclick: () => { if (game.petDan(p.uid)) done(); } },
            '단 수련', h('small', {}, `혼 ${game.petDanCost(p)} · ${Math.round(W.petDanChance(p.dan || 0, p.danFail || 0) * 100)}%`)) : null,
          (p.star || 0) < W.PET_STAR_MAX ? h('button', { class: 'buy', disabled: game.canStar(p.uid) ? null : true, title: '우리에 있는 같은 종을 먹이로', onclick: () => { if (!surePetFeed(p, 1)) return; if (game.starUp(p.uid)) done(); } }, '별 ↑', h('small', {}, `먹이 ${game.starFodder(p.uid).length}`)) : null,
          // v319 모두 먹이기 — 먹이가 둘 이상이면 한 번에
          (p.star || 0) < W.PET_STAR_MAX - 1 && game.starFodder(p.uid).length >= 2 ? h('button', { class: 'buy', title: '같은 종을 못한 것부터, 별이 찰 때까지', onclick: () => { if (!surePetFeed(p, 99)) return; const n = game.starUpAll(p.uid); if (n) { toast(`★ ${d.name} 별 ${p.star} — 먹이 ${n}마리`); done(); } } }, '모두 먹이기', h('small', {}, `★${Math.min(W.PET_STAR_MAX, (p.star || 0) + game.starFodder(p.uid).length)}까지`)) : null,
          // v312 장착 해제 — 우리로(사라지지 않는다)
          h('button', { class: 'btn', style: 'padding:6px 10px', disabled: game.canUnequipPet(p.uid) ? null : true, title: s.petBox.length >= W.PET_BOX ? '우리가 가득 찼어요' : '', onclick: () => { if (game.unequipPet(p.uid)) { toast(`${d.name}을(를) 우리로 보냈어요`); done(); } } }, '해제'),
          h('button', { class: 'btn danger', style: 'padding:6px 10px', onclick: () => confirmRelease(p, done) }, '놓아주기'))));
    });
    boxCard.replaceChildren(h('h3', {}, '우리', h('small', {}, `${s.petBox.length}/${W.PET_BOX} · 누르면 데려가기 · 칸이 꽉 차면 키우던 것과 바꿔요`)),
      // v366 우리 정리 — 모두 별 올리기 · 일괄 놓아주기(잠근 것 · 종마다 가장 좋은 하나는 남긴다)
      ...(s.petBox.length ? [h('div', { class: 'pen-tools' },
        h('button', { class: 'btn mini', id: 'pen-star-all', onclick: () => { const n = game.autoStarAll(); toast(n ? `★ 종마다 가장 좋은 것에게 먹여 별 ${n}개를 올렸어요` : '먹일 같은 종이 없어요(잠근 것 · 더 좋은 것은 먹이로 안 써요)'); if (n) done(); } }, '★ 모두 별 올리기'),
        ...[[0, '레어'], [1, '유니크까지'], [2, '전설까지']].map(([r, nm]) => h('button', { class: 'btn mini danger', onclick: () => {
          const list = game.bulkReleasePreview(r);
          if (!list.length) return toast('놓아줄 것이 없어요(잠근 것 · 종마다 가장 좋은 하나는 남겨요)');
          const soul = list.reduce((a, p) => a + W.petReleaseSoul(p), 0);
          if (!confirm(`${nm} ${list.length}마리를 놓아줄까요? (혼 +${soul})\n잠근 것과 종마다 가장 좋은 하나는 남아요. 되돌릴 수 없어요.`)) return;
          const res = game.bulkRelease(r); toast(`${res.n}마리를 놓아줬어요 — 혼 +${res.soul}`); done();
        } }, `${nm} 놓아주기`)))] : []));   // replaceChildren에 null을 넘기면 'null' 글자가 찍힌다
    if (!s.petBox.length) boxCard.append(h('p', { class: 'muted' }, '비어 있어요.'));
    // v231: 우리는 그림 칸 셋씩 — 글 줄이 길고 단추가 끼어 비좁았다. 누르면 자세히(데려가기·놓아주기)
    const openPen = (p) => openModal((m) => {
      const d = W.petOf(p.kind);
      const full = s.pets.length >= slots;
      m.append(h('div', { class: 'pen-head' }, h('div', { class: 'ico pet-ico big' }, creatureIcon(W.petArt(p))),
        h('div', {}, h('h2', {}, qualTag(p), d.name, ' ', rarTag(p.rar), danTag(p)), h('small', { class: 'muted' }, `순위 ${d.tier} · Lv.${p.lv}`))),
        h('p', { class: 'muted' }, petInfo(p)),
        // v254: 칸이 남으면 null을 넘겨 창에 'null' 글자가 찍혔다(DOM append는 null을 글자로 넣는다)
        // v312 꽉 찼으면 키우던 것과 바꿔 데려간다(바뀐 것은 우리로)
        ...(full ? [h('p', { class: 'muted', style: 'font-size:12px' }, `키우는 칸이 꽉 찼어요(${s.pets.length}/${slots}) — 아래에서 하나와 바꿔 데려가요(그 아이는 우리로).`),
          h('div', { class: 'pet-swap' }, ...s.pets.slice(0, slots).map((q) => h('button', { class: 'btn', onclick: () => { if (game.swapPet(p.uid, q.uid)) { closeModal(); toast(`${d.name}을(를) 데려가고 ${W.petOf(q.kind).name}은(는) 우리로`); done(); } } },
            h('span', { class: 'ico pet-ico' }, creatureIcon(W.petArt(q))), ` ${W.petOf(q.kind).name} 대신`)))] : []),
        // v319 우리에서도 키운다 — 등급 올리기 · 단 수련 · 별(우리의 같은 종을 먹이로)
        h('div', { class: 'pen-train' },
          game.petSoulCost(p) != null ? h('button', { class: 'buy', disabled: game.canSoulUp(p.uid) ? null : true, onclick: () => { if (game.soulUp(p.uid)) { toast(`${d.name} — ${W.RARITY[p.rar].name}(으)로!`); closeModal(); done(); openPen(p); } } }, '등급 ↑', h('small', {}, `혼 ${game.petSoulCost(p)}`)) : null,
          game.petDanCost(p) != null ? h('button', { class: 'buy dan-btn', disabled: game.canPetDan(p.uid) ? null : true, onclick: () => { if (game.petDan(p.uid)) { closeModal(); done(); openPen(p); } } }, '단 수련', h('small', {}, `혼 ${game.petDanCost(p)} · ${Math.round(W.petDanChance(p.dan || 0, p.danFail || 0) * 100)}%`)) : null,
          (p.star || 0) < W.PET_STAR_MAX && game.starFodder(p.uid).length ? h('button', { class: 'buy', onclick: () => { if (!surePetFeed(p, 99)) return; const n = game.starUpAll(p.uid); if (n) { toast(`★ ${d.name} 별 ${p.star} — 먹이 ${n}마리`); closeModal(); done(); openPen(p); } } }, '모두 먹이기', h('small', {}, `먹이 ${game.starFodder(p.uid).length}`)) : null),
        ...(p.lv < W.PET_LV_MAX ? [h('p', { class: 'muted', style: 'font-size:11.5px;margin:2px 0 6px' }, `단 수련은 Lv.${W.PET_LV_MAX}부터 — 우리에 있는 동안은 자라지 않아요(데려가면 자라요)`)] : []),   // m.append는 null을 글자로 넣는다
        // v292 같은 종 키우는 것에게 먹이로(별 하나)
        ...(() => { const host = s.pets.find((x) => x.kind === p.kind && (x.star || 0) < W.PET_STAR_MAX); return host ? [h('button', { class: 'btn', style: 'width:100%;margin-bottom:6px', onclick: () => {
          // 먹이는 가장 못한 것부터 — 이것을 먹이로 쓰려면 이것보다 못한 같은 종이 없어야 한다
          const f = game.starFodder(host.uid)[0];
          if (f && f.uid !== p.uid) { toast('같은 종 가운데 더 못한 것부터 먹이로 써요'); }
          if (!surePetFeed(host, 1)) return;
          if (game.starUp(host.uid)) { closeModal(); done(); }
        } }, `★ ${d.name}(키우는 중)에게 먹이로 — 별 ${(host.star || 0) + 1}`)] : []; })(),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', id: 'pet-lock', onclick: () => { const on = game.togglePetLock(p.uid); toast(on ? '🔒 잠갔어요 — 먹이·일괄 놓아주기에서 빠져요' : '잠금을 풀었어요'); closeModal(); done(); openPen(p); } }, p.lock ? '🔓 풀기' : '🔒 잠금'),
          h('button', { class: 'btn danger', disabled: p.lock ? true : null, onclick: () => { closeModal(); confirmRelease(p, done); } }, '놓아주기'),
          h('button', { class: 'btn primary', disabled: full ? true : null, onclick: () => { if (game.adoptPet(p.uid)) { closeModal(); toast(`${d.name}을(를) 데려갔어요`); done(); } } }, '데려가기')),
        h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: closeModal }, '닫기'));
    });
    if (s.petBox.length) boxCard.append(h('div', { class: 'pen-grid' }, ...[...s.petBox].sort((a, b) => (b.rar || 0) - (a.rar || 0) || W.petOf(b.kind).tier - W.petOf(a.kind).tier).map((p) => {
      const d = W.petOf(p.kind);
      return h('button', { class: 'pen-tile', style: `--rc:${W.RARITY[p.rar || 0].color}`, onclick: () => openPen(p) },
        h('div', { class: 'ico pet-ico' }, creatureIcon(W.petArt(p))),
        h('b', {}, p.lock ? '🔒' : '', (p.q || 0) ? h('span', { class: `pet-q q${p.q}` }, W.PET_QUAL[p.q].mark) : '', d.name, (p.star || 0) ? h('span', { class: 'pet-star' }, ` ${'★'.repeat(p.star)}`) : ''), h('small', {}, `${W.RARITY[p.rar || 0].name} · 순위 ${d.tier}${(p.dan || 0) ? ` · ${p.dan}단` : ''}`));
    })));
    const cur = game.mountNow();
    mountCard.replaceChildren(h('h3', {}, '탈것', h('small', {}, cur ? `${cur.name}을(를) 타는 중` : '걸어 다니는 중')),
      // v292 탈것 조각
      h('div', { class: 'pet-extra' }, gachaRow('mount', `탈것 조각 ${fmt(s.mountShard || 0)}`, '길들이기에도 써요')));
    if (!s.mounts.length) mountCard.append(h('p', { class: 'muted' }, '몹이 아주 드물게 탈것을 떨궈요 — 높은 두목일수록 자주·좋은 것까지. 타면 빨리 움직이고 공격력·체력이 올라요.'));
    // v380 탈것 — 한 줄씩 길게 늘어서 보기 불편했다 → 타는 중(크게) · 같은 종은 한 칸에 묶은 격자 · 걸러 보기 · 누르면 자세히
    const MG = ['일반', '좋은', '귀한', '십이지', '신수'];   // mountGachaGrade 0~4
    const MG_COL = ['#a8a29e', '#60a5fa', '#c084fc', '#f59e0b', '#f43f5e'];
    const statLine = (m) => { const d = W.mountOf(m.kind), k = game.mountK(m); return `이동 +${W.spdPct(W.mountSpeed(d, k, m.lv || 0))}% · 공격·체력 +${(d.stat * k * 100).toFixed(1).replace(/\.0$/, '')}%`; };
    const openMount = (kind) => openModal((el) => {
      const d = W.mountOf(kind);
      const draw = () => {
        const list = s.mounts.filter((m) => m.kind === kind).sort((a, b) => (b.uid === s.mount) - (a.uid === s.mount) || (b.lv || 0) - (a.lv || 0));
        if (!list.length) { closeModal(); done(); return; }
        el.replaceChildren(
          h('div', { class: 'mount-head', style: `--rc:${MG_COL[W.mountGachaGrade(d)]}` }, h('div', { class: 'ico pet-ico' }, creatureIcon(kind)),
            h('div', {}, h('h3', {}, d.name), h('small', {}, `${MG[W.mountGachaGrade(d)]} · 순위 ${d.tier}${d.zodiac ? ` · 십이지 ${d.zodiac}` : ''} · ${list.length}마리`), d.sp ? h('p', { class: 'muted', style: 'margin:4px 0 0;font-size:12.5px' }, d.sp) : null)),
          ...list.map((m) => {
            const on = s.mount === m.uid, tc = game.tameCost(m.uid);
            return h('div', { class: `row mount-copy${on ? ' me' : ''}` },
              h('div', { class: 'info' }, h('div', { class: 'name' }, on ? '🐎 타는 중' : `한 마리`, h('small', {}, ` 길들이기 ${m.lv || 0}/${W.mountLvMax(d)}`)), h('div', { class: 'desc' }, statLine(m)),
                tc ? h('div', { class: 'desc', style: 'color:#fde68a' }, `길들이기 +1: 탈것 조각 ${tc.shard} · 은자 ${fmt(tc.gold)}`) : null),
              h('div', { class: 'pet-btns' },
                tc ? h('button', { class: 'buy', disabled: game.canTame(m.uid) ? null : true, onclick: () => { if (game.tame(m.uid)) { toast(`${d.name} 길들이기 ${m.lv}`); app.save(); draw(); done(); } } }, '길들이기') : h('span', { class: 'sk-max' }, '極'),
                h('button', { class: on ? 'btn' : 'buy', onclick: () => { game.ride(on ? null : m.uid); app.save(); draw(); done(); } }, on ? '내리기' : '타기')));
          }),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기')));
      };
      draw();
    });
    // 타는 중
    const rideM = s.mounts.find((m) => m.uid === s.mount);
    if (rideM) {
      const d = W.mountOf(rideM.kind), tc = game.tameCost(rideM.uid);
      mountCard.append(h('div', { class: 'mount-now', style: `--rc:${MG_COL[W.mountGachaGrade(d)]}` },
        h('div', { class: 'ico pet-ico' }, creatureIcon(rideM.kind)),
        h('div', { class: 'info' }, h('b', {}, d.name, h('small', {}, ` · ${MG[W.mountGachaGrade(d)]} · 길들이기 ${rideM.lv || 0}/${W.mountLvMax(d)}`)), h('div', { class: 'desc' }, statLine(rideM)), d.sp ? h('div', { class: 'desc muted' }, d.sp) : null),
        h('div', { class: 'pet-btns' },
          tc ? h('button', { class: 'buy', disabled: game.canTame(rideM.uid) ? null : true, onclick: () => { if (game.tame(rideM.uid)) { toast(`${d.name} 길들이기 ${rideM.lv}`); done(); } } }, '길들이기', h('small', {}, `조각 ${tc.shard}`)) : h('span', { class: 'sk-max' }, '極'),
          h('button', { class: 'btn', onclick: () => { game.ride(null); done(); } }, '내리기'))));
    } else if (s.mounts.length) mountCard.append(h('p', { class: 'muted', style: 'font-size:12.5px' }, '걸어 다니는 중 — 아래에서 골라 타세요(빠른 것이 위에).'));
    // 묶음 — 같은 종을 한 칸에
    const groups = new Map();
    for (const m of s.mounts) { const g = groups.get(m.kind) || []; g.push(m); groups.set(m.kind, g); }
    const flt = mountFlt;
    const FLT = [['all', '전체'], ['hard', '신수'], ['zodiac', '십이지'], ['normal', '일반']];
    const pass = (d) => flt === 'all' || (flt === 'hard' ? d.hard : flt === 'zodiac' ? d.zodiac : !d.hard && !d.zodiac);
    const kinds = [...groups.keys()].map((k) => W.mountOf(k)).filter((d) => d && pass(d)).sort((a, b) => W.mountSpeed(b) - W.mountSpeed(a) || b.stat - a.stat);
    if (s.mounts.length) {
      mountCard.append(h('div', { class: 'mount-flt' }, h('small', { class: 'muted' }, `${groups.size}종 · ${s.mounts.length}마리`),
        ...FLT.map(([k, t]) => h('button', { class: `chip${flt === k ? ' on' : ''}`, onclick: () => { mountFlt = k; try { localStorage.setItem('ifu.mflt', k); } catch { /* 사생활 모드 */ } done(); } }, t))));
      mountCard.append(kinds.length ? h('div', { class: 'pen-grid mount-grid' }, ...kinds.map((d) => {
        const list = groups.get(d.id);
        const best = list.reduce((a, b) => ((b.lv || 0) > (a.lv || 0) ? b : a));
        const riding = list.some((m) => m.uid === s.mount);
        return h('button', { class: `pen-tile mount-tile${riding ? ' riding' : ''}`, style: `--rc:${MG_COL[W.mountGachaGrade(d)]}`, onclick: () => openMount(d.id) },
          list.length > 1 ? h('span', { class: 'mt-n' }, `×${list.length}`) : null,
          riding ? h('span', { class: 'mt-on' }, '타는 중') : null,
          h('div', { class: 'ico pet-ico' }, creatureIcon(d.id)),
          h('b', {}, d.name.replace('십이지 ', '')),
          h('small', {}, `이동 +${W.spdPct(W.mountSpeed(d, game.mountK(best), best.lv || 0))}%${best.lv ? ` · 길${best.lv}` : ''}`));
      })) : h('p', { class: 'muted' }, '이 갈래의 탈것이 없어요.'));
    }
    // 탈것 합성 (v204) — 같은 순위가 셋 이상 모인 순위만 · v380 접어 둔다
    const tiers = [...new Set(s.mounts.map((m) => W.mountOf(m.kind)).filter((d) => d && !d.zodiac && d.tier < W.MOUNT_TOP).map((d) => d.tier))]
      .filter((t) => game.fuseCandidates(t).length >= W.MOUNT_FUSE_N).sort((a, b) => a - b);
    if (tiers.length) {
      const fuse = h('details', { class: 'fuse-box' }, h('summary', {}, h('b', {}, `🔮 탈것 합성 — ${tiers.length}가지 할 수 있어요 `), h('small', {}, `같은 순위 ${W.MOUNT_FUSE_N}마리 → 다음 순위 하나`)));
      for (const t of tiers) {
        const a = W.mountOfTier(t), b = W.mountOfTier(t + 1);
        const cost = W.mountFuseCost(t);
        fuse.append(h('div', { class: 'row fuse-row' },
          h('div', { class: 'ico pet-ico' }, creatureIcon(a.id)),
          h('div', { class: 'info' }, h('div', { class: 'name' }, `${a.name} ×${W.MOUNT_FUSE_N} → ${b.name}`, h('small', {}, ` (가진 것 ${game.fuseCandidates(t).length})`)),
            h('div', { class: 'desc' }, `이동 +${W.spdPct(b.speed)}% · 공격력·체력 +${Math.round(b.stat * 100)}% · 은자 ${fmt(cost)}`)),
          h('button', { class: 'buy', disabled: game.canFuseMounts(t) ? null : true, onclick: () => {
            const used = game.fuseCandidates(t).sort((x, y) => (x.uid === game.s.mount) - (y.uid === game.s.mount)).slice(0, W.MOUNT_FUSE_N);
            if (!confirm(`${a.name} ${W.MOUNT_FUSE_N}마리를 합쳐 ${b.name} 한 마리로 만들어요.${used.some((m) => m.uid === game.s.mount) ? '\n지금 타고 있는 것도 들어가요.' : ''}${used.some((m) => (m.lv || 0) > 0) ? `\n길들인 정도는 절반(Lv.${Math.floor(Math.max(...used.map((m) => m.lv || 0)) / 2)})만 이어 가요.` : ''}\n은자 ${fmt(cost)} · 되돌릴 수 없어요. 합칠까요?`)) return;
            const m = game.fuseMounts(t);
            if (!m) return toast('은자가 모자라요');
            toast(`합성 성공! ${b.name}(순위 ${b.tier})`); app.save(); done();
          } }, '합성')));
      }
      mountCard.append(fuse);
    }
  }
  // v292 도감 — 모은 종 · 영구 보너스 · 이정표
  let dxSig = '';
  function dex() {
    const s = game.s;
    game.noteDex();
    const c = game.dexCounts();
    const nsig = `${JSON.stringify(s.petDex)}|${Object.keys(s.mountDex || {}).join(',')}|${JSON.stringify(s.dexGoals)}`;
    if (nsig === dxSig) return;
    dxSig = nsig;
    const goalRows = (kind, label) => game.dexGoalList(kind).map((g, i) => {
      const got = (s.dexGoals[kind] || []).includes(i);
      const ok = game.canDexGoal(kind, i);
      const prize = [g.soul ? `혼 ${g.soul}` : '', g.petShard ? `포획 조각 ${g.petShard}` : '', g.mountShard ? `탈것 조각 ${g.mountShard}` : ''].filter(Boolean).join(' · ');
      return h('div', { class: `dex-goal${got ? ' got' : ok ? ' ok' : ''}` }, h('span', {}, `${label} ${g.text}`), h('small', {}, prize),
        got ? h('b', { class: 'dg-st' }, '✓ 받음') : h('button', { class: 'buy', disabled: ok ? null : true, onclick: () => { if (game.claimDexGoal(kind, i)) { app.save(); dxSig = ''; dex(); app.refresh(); } } }, ok ? '받기' : `${c[kind]}/${g.n}`));
    });
    const petGrid = h('div', { class: 'dex-grid' }, ...W.PETS.map((d) => {
      const r = s.petDex[d.id];
      const own = r != null;
      return h('div', { class: `dex-tile${own ? ' own' : ''}`, style: own ? `--rc:${W.RARITY[r].color}` : '' },
        h('div', { class: 'ico pet-ico' }, own ? creatureIcon(d.id) : '?'), h('b', {}, own ? d.name : '???'), h('small', {}, own ? `${W.RARITY[r].name} · +${((r + 1) * W.PET_DEX_K * 100).toFixed(1)}%` : `순위 ${d.tier}`));
    }));
    const mountGrid = h('div', { class: 'dex-grid' }, ...W.MOUNTS.map((d) => {
      const own = !!s.mountDex[d.id];
      return h('div', { class: `dex-tile${own ? ' own' : ''}`, style: own ? '--rc:#e8c87a' : '' },
        h('div', { class: 'ico pet-ico' }, own ? creatureIcon(d.id) : '?'), h('b', {}, own ? d.name.replace('십이지 ', '') : '???'), h('small', {}, d.zodiac ? `십이지 ${d.zodiac}` : `순위 ${d.tier}`));
    }));
    const pb = Object.values(s.petDex).reduce((a, v) => a + (v + 1) * W.PET_DEX_K, 0), mb = c.mount * W.MOUNT_DEX_K;
    dexCard.replaceChildren(h('h3', {}, '도감', h('small', {}, `영구히 공격력·최대 체력 +${((pb + mb) * 100).toFixed(1)}%`)),
      h('p', { class: 'muted', style: 'font-size:12.5px;margin:0 0 8px' }, `한 번이라도 가진 종이 남아요(놓아줘도 그대로). 애완동물은 종마다 가장 높았던 등급만큼(레어 ${(W.PET_DEX_K * 100).toFixed(1)}% … 신화 ${(4 * W.PET_DEX_K * 100).toFixed(1)}%), 탈것은 종마다 ${(W.MOUNT_DEX_K * 100).toFixed(1)}%.`),
      h('div', { class: 'dex-head' }, h('b', {}, `애완동물 ${c.pet}/${W.PETS.length}`), h('small', {}, ` · 신화 ${c.myth} · +${(pb * 100).toFixed(1)}%`)), petGrid,
      ...goalRows('pet', '애완동물'), ...goalRows('myth', '애완동물'),
      h('div', { class: 'dex-head' }, h('b', {}, `탈것 ${c.mount}/${W.MOUNTS.length}`), h('small', {}, ` · +${(mb * 100).toFixed(1)}%`)), mountGrid,
      ...goalRows('mount', '탈것'));
  }
  const t = subTabs([
    { key: 'pet', label: '애완동물', make: () => ({ root: petBox, update: upd }) },
    { key: 'mount', label: '탈것', make: () => ({ root: mountBox, update: upd }) },
    { key: 'dex', label: '도감', make: () => ({ root: dexBox, update: dex }) },
  ], 'ifu.compsub');
  const upd0 = t.update;
  t.update = () => {
    t.setDot('pet', (game.s.petBox.length > 0 && game.s.pets.length < game.petSlots()) || game.canGacha('pet', 1) || game.canGacha('pet', 1, true) || game.s.pets.some((p) => game.canStar(p.uid)));
    t.setDot('mount', (game.s.mounts.length > 0 && game.s.mount == null) || game.canGacha('mount', 1) || game.canGacha('mount', 1, true));
    t.setDot('dex', game.dexGoalsReady() > 0);
    upd0();
  };
  return t;
}

// v423 설명 접기 — 긴 설명은 한 번 읽고 나면 접어 둘 수 있다(이 기기에 기억 · 처음엔 펼쳐져 있다)
export function foldBox(key0, ...nodes) {   // v424 key가 '-'로 시작하면 처음엔 접혀 있다 · 'key|이름'이면 단추 글을 그 이름으로
  const [key, label] = key0.split('|');
  let closed = key.startsWith('-'); try { const v = localStorage.getItem(`ifu.fold.${key}`); if (v != null) closed = v === '1'; } catch { /* 처음 */ }
  const body = h('div', { class: 'helpfold-body' }, ...nodes);
  const btn = h('button', { class: 'helpfold-btn', type: 'button' });
  const paint = () => { btn.textContent = closed ? `${label ? `✦ ${label} 보기` : 'ⓘ 설명 보기'} ▾` : `${label ? `${label} 접기` : '설명 접기'} ▴`; body.classList.toggle('hidden', closed); btn.classList.toggle('closed', closed); };
  btn.onclick = (e) => { e.stopPropagation(); closed = !closed; try { localStorage.setItem(`ifu.fold.${key}`, closed ? '1' : '0'); } catch { /* 이번만 */ } paint(); };
  paint();
  return h('div', { class: 'helpfold' }, btn, body);
}
// v366 뽑기 기록 — 최근 100번 · 좋은 것 셈
function openGachaLog(game, kind) {
  const L = (game.s.gachaLog || []).filter((e) => e.k === kind).slice().reverse();
  const GC = ['#60a5fa', '#c084fc', '#fb923c', '#f472b6', '#fde047'];
  const cnt = [0, 0, 0, 0, 0]; for (const e of L) cnt[e.g]++;
  openModal((el) => el.append(
    h('h3', {}, `${kind === 'pet' ? '영수' : '탈것'} 소환 기록`, h('small', {}, ` 최근 ${L.length}번 · 지금까지 ${game.s.gacha[kind].n}번 · 천장 ${game.s.gacha[kind].pity}`)),
    h('p', { class: 'muted' }, `빛깔별: ${['파랑', '보라', '주황', '무지개', '금빛'].map((n, i) => `${n} ${cnt[i]}`).join(' · ')}`),
    h('div', { class: 'glog' }, ...(L.length ? L.map((e) => {
      const nm = e.k === 'pet' ? `${W.RARITY[e.r].name} ${W.petOf(e.id).name}` : `${W.mountOf(e.id).name}${W.mountOf(e.id).hard ? ' (극)' : W.mountOf(e.id).zodiac ? ' (십이지)' : ''}`;
      const d = new Date(e.t);
      return h('div', { class: `glog-row g${e.g}`, style: `--gc:${GC[e.g]}` }, h('b', {}, nm), h('small', {}, `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`));
    }) : [h('p', { class: 'muted' }, '아직 없어요')])),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기'))));
}
// v362 뽑기 확률표
function openGachaRates(kind) {
  const pct = (v) => `${String(+v.toFixed(3))}%`;
  const pk = W.gachaPickup();   // v368 이번 주 픽업은 두 배로 보여 준다(나머지는 그만큼 나눠 줄어든다)
  const norm = (t, id) => { const w = W.withPickup(t, id); const sum = w.reduce((a, [, x]) => a + x, 0); return w.map(([k, x]) => [k, (x / sum) * 100]); };
  openModal((el) => {
    const rows = kind === 'pet'
      ? [h('h3', {}, '영수 소환 확률'), h('p', { class: 'muted' }, `종과 등급을 따로 뽑아요 · 10연차엔 전설 이상 하나 · ${W.GACHA_PET_PITY}번 안에 신화가 안 나오면 ${W.GACHA_PET_PITY}번째 신화`),
        h('div', { class: 'rate-grid' }, h('b', {}, '종'), h('b', {}, '확률'), ...norm(W.GACHA_PET_KIND, pk.pet).flatMap(([k, w]) => [h('span', {}, `${W.petOf(k).emoji} ${W.petOf(k).name}${k === pk.pet ? ' ✨픽업' : ''}`), h('span', {}, pct(w))])),
        h('div', { class: 'rate-grid' }, h('b', {}, '등급'), h('b', {}, '확률'), ...W.GACHA_PET_RAR.flatMap(([r, w]) => [h('span', { style: `color:${W.RARITY[r].color}` }, W.RARITY[r].name), h('span', {}, pct(w))]))]
      : [h('h3', {}, '탈것 소환 확률'), h('p', { class: 'muted' }, `10연차엔 적토마(순위 ${W.GACHA_MOUNT_TEN}) 이상 하나 · ${W.GACHA_MOUNT_PITY}번 안에 신수(십이지·극)가 안 나오면 ${W.GACHA_MOUNT_PITY}번째 신수 · 가진 신수가 또 나오면 길들이기 +1`),
        h('div', { class: 'rate-grid' }, h('b', {}, '탈것'), h('b', {}, '확률'), ...norm(W.GACHA_MOUNT, pk.mount).flatMap(([k, w]) => { const d = W.mountOf(k); return [h('span', { style: d.hard ? 'color:#fde047' : d.zodiac ? 'color:#f472b6' : '' }, `${d.emoji} ${d.name}${d.hard ? ' (극)' : ''}${k === pk.mount ? ' ✨픽업' : ''}`), h('span', {}, pct(w))]; }))];
    el.append(...rows, h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: closeModal }, '닫기')));
  });
}
export const WTABS = { char: charTab, bag: bagTab, map: mapTab, dgn: dgnTab, town: townTab, social: socialTab, comp: compTab };
export const WTAB_TITLE = { char: '캐릭터', bag: '가방', map: '지도', dgn: '던전', town: '마을', social: '무림 · 문파', comp: '동료' };
