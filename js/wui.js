// 바람식 개편 — 창 다섯: 캐릭터 · 가방 · 지도 · 마을 · 무림.
// 창 하나는 { root, update } 를 돌려준다. update는 0.2초마다 불린다(열려 있을 때만).
import * as W from './world/wdata.js';
import * as D from './world/wdgn.js';
import * as L from './world/wland.js';
import * as G from './world/wgear.js';
import * as Q from './world/wquest.js';
import { h, toast, openModal, closeModal, subTabs, popUp, holdRepeat } from './ui/common.js';
import { fmt } from './fmt.js';
import { dayKey } from './net.js';
import { drawCreature, CREATURES, crArt } from './creatures.js';
import { skinImg } from './icons.js';
import * as MS from './world/wmaster.js';
import * as LN from './world/wline.js';
import * as IM from './world/wimprint.js';
import * as PT from './world/wpath.js';
import { drawFighter } from './battle.js';

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
  const go = () => { if (fired) return; fired = true; clearTimeout(t); anim?.removeEventListener('click', go); done(); };
  const anim = sheet.querySelector('.enh-anim');
  if (!sec) { done(); return; }
  anim?.addEventListener('click', go);
  const t = setTimeout(go, sec * 1000);
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
  const ln = it.line ? LN.lineOf(it.line) : null;
  return `${ln && ln.id !== 'base' ? `[${ln.name}] ` : ''}${W.itemName(it, game.s.job)}${it.plus ? ` +${it.plus}` : ''}`;
}
// v230: 장비 아이콘 — 칸 그림(무기·옷·모자…)을 등급 빛깔 테두리 안에. 가방·대장장이에서 글 대신 그림으로 고른다
function itemIcon(it, size = 44) {
  const g = gradeOf(it);
  return skinImg(h('span', { class: `it-ico${it.rar === 3 ? ' mythic' : ''}`, style: `--gc:${g.color};width:${size}px;height:${size}px` }), `slot-${it.slot}`);
}
// 가방 칸 — 그림 하나 + 강화 수치 · 낀 것보다 좋은지 화살표 · 이름 한 줄
function itemTile(game, it, d, onclick) {
  const g = gradeOf(it);
  const up = d > 0.005, down = d < -0.005;
  return h('button', { class: `inv-tile${it.rar === 3 ? ' mythic' : ''}${it.set ? ' set' : ''}${up ? ' up' : ''}`, style: `--gc:${g.color}`, onclick },
    itemIcon(it, 46),
    it.plus ? h('i', { class: 'inv-plus' }, `+${it.plus}`) : null,
    up ? h('i', { class: 'inv-d up' }, '▲') : down ? h('i', { class: 'inv-d down' }, '▼') : null,
    it.set ? h('i', { class: 'inv-set' }, '세트') : null,
    h('b', {}, itemTitle(game, it)),
    h('small', {}, `Lv.${it.ilv} · ${g.name}`));
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
    const nsig = `${game.s.quest}|${cur ? `${cur.now}/${cur.need}|${cur.done}` : 'end'}|${game.s.level}`;
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
            isNow ? h('small', {}, ` ${fmt(cur.now)}/${fmt(cur.need)}`) : null),
          h('div', { class: 'desc' }, q.why),
          bits.length ? h('div', { class: 'desc quest-rw' }, `보상 ${bits.join(' · ')}`) : null),
        isNow && cur.done
          ? h('button', { class: 'buy', onclick: () => {
            const got = game.claimQuest();
            if (!got) return;
            app.save(); qSig = ''; upd(); app.refresh();
            toast(`길잡이 — ${q.title} ✓ ${rewardText(got)}`);
          } }, '받기')
          // 서버가 있어야 하는 단계는 건너뛸 수 있다 (보상 없이)
          : isNow && q.skip
            ? h('button', { class: 'buy ghost', onclick: () => {
              if (!game.skipQuest()) return;
              app.save(); qSig = ''; upd(); app.refresh();
              toast(`길잡이 — '${q.title}'은(는) 건너뛰었어요. 나중에 언제든 할 수 있어요`);
            } }, '건너뛰기')
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
    const nsig = `${s.skillPts}|${JSON.stringify(s.skillLv)}|${s.jobTier}|${game.statSig()}`;
    if (nsig === skSig) return;
    skSig = nsig;
    const rc = game.skillResetCost();
    skillCard.replaceChildren(...[h('h3', {}, '스킬', h('small', {}, `스킬 점수 ${s.skillPts} · 레벨 ${W.SKILL_PT_FROM}부터 레벨마다 1점 · 만렙 ${W.SKILL_LV_MAX}`)),
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
  // v147: 한 줄로 길게 이어지던 것을 칸 셋으로 — 정보(길잡이·이야기) | 능력치 | 무공(스킬·심법)
  const infoBox = h('div', {}, head, questCard, loreBox);
  const statBox = h('div', {}, stats, h('div', { class: 'card' }, h('h3', {}, '능력치'), derived));
  const skillBox = h('div', {}, skillCard, passCard);
  void root;
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
function bagTab(app) {
  const { game } = app;
  let ui = { slot: 'all', smith: 'weapon', useBase: true, readyOnly: false, smode: 'ladder', kz: 0, kslot: 'acc', rar: 0 };
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem('ifu.bagui') || '{}') }; } catch { /* 사생활 모드 */ }
  const keepUi = () => { try { localStorage.setItem('ifu.bagui', JSON.stringify(ui)); } catch { /* 사생활 모드 */ } };
  const sigs = { gear: '', smith: '', mats: '' };
  const done = () => { app.save(); sigs.gear = sigs.smith = sigs.mats = ''; app.refresh(); };
  // 두목 장비(두목 증표로 만든 상급 · 두목이 떨군 것)는 끼면 그 두목의 겉모습이 든다 (v116)
  function bossGearNote(it) {
    if (it.grow || it.step == null || !(it.step % 2 === 1 || it.boss)) return null;
    const b = W.zoneOfW(W.itemZone(it))?.boss;
    if (!b) return null;
    const what = { weapon: '무기에 그 기운 빛', armor: '그 도포 빛깔', hat: '그 쓰개', acc: '몸을 도는 구슬', finger: '몸을 도는 구슬', ear: '몸을 도는 구슬' }[it.slot];
    return h('p', { class: 'boss-gear' }, `두목 장비 — 끼면 ${b.name}의 ${what}`, ['weapon', 'armor', 'hat'].includes(it.slot) ? ' (무기·옷·모자를 한 두목 것으로 맞추면 발밑에 그 빛깔 고리)' : '');
  }
  function openItem(it, worn) {
    let useProt = true;
    if (it.grow) game.mark('gearView');
    // 등급 각인에 넣을 증표 — 확률이 높은 것(센 두목)부터 (v158)
    let markPick = null;
    let spPick = 0;                          // v167: 새길 고유 효과 (셋 가운데)
    let itemTab = (() => { try { return localStorage.getItem('ifu.itemTab') || 'enh'; } catch { return 'enh'; } })();   // v207
    openModal((s) => {
      const paint = () => {
        const g = gradeOf(it);
        const cur = game.s.equip[it.slot];
        const cost = game.enhanceCost(it);
        const max = (it.plus || 0) >= game.enhanceMax(it);
        const em = game.enhanceMats(it);
        const bm = game.breakMarksOf(it);
        const breaking = (it.plus || 0) >= W.ENHANCE_NORMAL;
        const pc = null;                     // v173: 승급 없음 — 증표 각인으로
        // v207: 한 줄로 길게 늘어서던 것을 칸으로 나눈다 — 강화 · 각인 · 정보. 위에는 늘 이름·등급·수치.
        const tabsAll = [['enh', breaking ? '돌파' : '강화'], game.canImprintItem(it) ? ['imp', '각인'] : null, ['info', '정보']].filter(Boolean);   // v213: 계열 칸 없앰
        if (!tabsAll.some(([k]) => k === itemTab)) itemTab = 'enh';
        const tabRow = h('div', { class: 'item-tabs' }, ...tabsAll.map(([k, name]) => h('button', { class: `item-tab${k === itemTab ? ' on' : ''}`, onclick: () => { itemTab = k; try { localStorage.setItem('ifu.itemTab', k); } catch { /* 이번만 */ } paint(); } }, name)));
        const infoPane = [
          game.itemUnique(it) ? h('div', { class: 'uniq-box' }, h('b', {}, '고유 옵션 '), G.gearKeyText(game.itemUnique(it).k, game.itemUnique(it).v),
            h('small', {}, ` — ${W.zoneOfW(W.itemZone(it))?.name || ''} ${SLOT_SHORT[it.slot]}에만 붙는 옵션`)) : null,
          it.opts?.length ? h('div', { class: 'opt-box' }, ...optLines(it).map((t, i) => h('div', { class: it.opts[i].sp || it.opts[i].kp ? 'sp' : it.opts[i].pet ? 'pet' : it.opts[i].tf ? 'tf' : '' }, t))) : null,
          it.set ? setBox(game, G.setOf(it.set)) : null,
          bossGearNote(it),
          !worn && cur ? h('p', { class: 'muted' }, `지금 낀 것: ${itemTitle(game, cur)} — ${itemLines(game, cur)}`) : null,
          it.king != null ? h('p', { class: 'muted' }, `레벨 100 왕의 장비 (${W.zoneOfW(it.king)?.name || ''}) — 더 높은 단계는 없고 강화·돌파·증표 각인으로 자라요. 강화는 ${W.matName(G.stoneFor(it))}(후반 왕의 그 부위 강화석 — 모자라면 검왕의 검혼석이 대신), 등급은 두목 증표로 각인해요.${W.isDropOnly(it.slot) ? ' 가락지·귀걸이는 강화가 어려워요.' : ''}`)
          : W.isDropOnly(it.slot) ? h('p', { class: 'muted' }, `${W.zoneOfW(W.itemZone(it))?.name || ''} 두목에게서만 나와요 — 강화가 어려워요(성공률 절반·은자 ×3·돌파 없음). 등급은 두목 증표로 각인해요.`)
            : it.grow ? h('p', { class: 'muted' }, `성장 장비 — 레벨을 따라 저절로 자라요(지금 Lv.${it.ilv}, ${W.ILV_CAP}까지). 강화 재료는 그 레벨 지역(${W.zoneOfW(W.itemZone(it))?.name || ''}) 것.`)
            : it.step != null ? h('p', { class: 'muted' }, `Lv.${it.ilv} 옛 사다리 장비 (${W.zoneOfW(W.itemZone(it))?.name || ''})`) : null,
        ];
        const enhPane = [
          max ? h('p', { class: 'muted' }, '강화를 다 했어요') : h('div', { class: `enh-box${W.enhanceRisky(it.plus || 0) ? ' danger' : ''}` },
            h('div', { class: 'enh-head' }, h('b', {}, `${breaking ? '돌파' : '강화'} +${it.plus || 0} → +${(it.plus || 0) + 1}`), h('span', { class: 'enh-rate' }, `성공 ${pct(game.enhanceRateOf(it), 0)}${it.epity ? ` (천장 +${pct(it.epity, 0)}p)` : ''}`)),
            h('div', { class: 'enh-fail' }, W.enhanceFailText(it.plus || 0),
              W.enhanceFail(it.plus || 0) ? ` · 실패하면 다음 확률 +${pct(game.enhanceBaseRate(it) * W.ENH_PITY_K, 0)}p` : null,
              W.enhanceRisky(it.plus || 0) ? h('span', {}, ` · 보호부 ${game.s.prot || 0}장${game.s.prot ? (useProt ? ' — 쓰면 실패해도 그대로' : ' — 안 씀') : ' — 상인에서 사요'}`) : null),
            h('div', { class: 'enh-cost' }, `기본 수치 +${pct(breaking ? W.BREAK_STEP : W.ENHANCE_STEP, 0)} · 은자 ${fmt(cost)}${em ? ` · ${W.matName(em.key)} ${em.n}개 (가진 것 ${fmt(game.s.mats[em.key] || 0)})` : ''}${bm ? ` · ${W.matName(W.bossKey(em.key))} ${bm}개 (가진 것 ${fmt(game.s.mats[W.bossKey(em.key)] || 0)})` : ''}`),
            W.enhanceRisky(it.plus || 0) && game.s.prot ? h('label', { class: 'chk' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = useProt; c.onchange = () => { useProt = c.checked; paint(); }; return c; })(), ' 보호부 쓰기') : null,
            h('button', { class: 'btn good enh-go', disabled: game.canEnhance(it) ? null : true, onclick: () => askEnhance() }, breaking ? '돌파' : '강화')),
        ];
        const impPane = game.canImprintItem(it) ? [infuseBox(), impBox()] : [];
        const pane = { enh: enhPane, imp: impPane, info: infoPane }[itemTab] || enhPane;
        s.replaceChildren(...[
          h('h2', { style: `color:${g.color}` }, itemTitle(game, it)),
          h('p', { class: 'item-sub' }, `${W.SLOTS.find((x) => x.id === it.slot).name} · Lv.${it.ilv} · `, h('b', { style: `color:${g.color}` }, g.name), ` · +${it.plus || 0}`),
          h('p', { class: 'item-stat' }, h('b', {}, itemLines(game, it))),
          tabRow,
          h('div', { class: 'item-pane' }, ...pane.filter(Boolean)),
          h('div', { class: 'btn-row' },
            !worn ? h('button', { class: 'btn primary', onclick: () => { game.equipFromBag(it.uid); closeModal(); done(); } }, '끼기') : null,
            !worn && !it.grow ? h('button', { class: 'btn', onclick: () => { const b = W.sellBack(it); const p = game.sell(it); toast(b ? `되팔기 — 은자 +${fmt(p)} · ${Object.entries(b.mats).map(([k, n]) => `${W.matName(k)} ${fmt(n)}`).join(' · ')}` : `은자 +${fmt(p)}`); closeModal(); done(); } },
              W.sellBack(it) ? `되팔기 (제작비 ¼)` : `팔기 ${fmt(W.sellPrice(it))}`) : null,
            h('button', { class: 'btn', onclick: closeModal }, '닫기')),
        ].filter(Boolean));   // replaceChildren은 null을 글자 'null'로 넣는다
      };
      // ---- 등급 각인 (v158): 어느 두목의 증표든 — 센 두목 것일수록 잘 붙고, 실패하면 다음 확률이 쌓인다 ----
      const infuseBox = () => {
        const to = (it.rar || 0) + 1;
        if (to >= W.RARITY.length) return h('div', { class: 'inf-box' }, h('b', {}, '등급 각인'), h('p', { class: 'muted' }, '신화 — 가장 높은 등급이에요.'));
        const keys = Object.keys(game.s.mats).filter((k) => W.isMarkKey(k) && game.s.mats[k] > 0)
          .sort((a, b) => game.infuseInfo(it, b).chance - game.infuseInfo(it, a).chance);
        if (!keys.includes(markPick)) markPick = keys.find((k) => game.canInfuse(it, k)) || keys[0] || null;
        const f = markPick ? game.infuseInfo(it, markPick) : null;
        const R = W.RARITY[to];
        return h('div', { class: 'inf-box' },
          h('div', { class: 'inf-head' }, h('b', {}, '등급 각인 → '), h('b', { style: `color:${R.color}` }, R.name),
            h('small', {}, ` 기본 수치 ×${(R.mult / W.RARITY[to - 1].mult).toFixed(2)} · 등급 옵션 새로${it.pity ? ` · 쌓인 확률 +${pct(it.pity, 0)}p` : ''}`)),
          keys.length ? h('div', { class: 'chip-row inf-marks' }, ...keys.slice(0, 8).map((k) => {
            const i2 = game.infuseInfo(it, k);
            return h('button', { class: `chip${k === markPick ? ' on' : ''}`, style: `--mc:${W.matColor(k)}`, onclick: () => { markPick = k; paint(); } },
              W.matName(k).replace(/의 증표$/, ''), h('small', {}, ` ${IM.THEMES[IM.themeOfZone(+k.slice(1))].name}${IM.specialOfZone(+k.slice(1)) ? '★' : ''} · ${fmt(game.s.mats[k])}개 · ${pct(i2.chance, 0)}`));
          })) : h('p', { class: 'muted' }, '두목 증표가 없어요 — 사냥터의 두목 구역·고수의 두목 방에서 두목을 잡으면 나와요.'),
          f ? (() => {
            const pv = IM.imprintOf({ k: markPick, s: 0, sk: 'range', g: 0, sp: spPick }, to - 1);
            if (!pv) return null;
            const lo = IM.skillValue('cd', 0, pv.lv), hi = IM.skillValue('dmg', 3, pv.lv);
            return h('div', { class: 'imp-row preview', style: `--ic:${IM.THEMES[pv.theme].col}` },
              h('b', {}, `${['첫째', '둘째', '셋째'][to - 1]} 각인 · ${pv.boss} (${IM.THEMES[pv.theme].name})`),
              h('div', {}, Object.entries(pv.fx).map(([k, v]) => IM.FX_TEXT[k](v)).join(' · ')),
              h('div', { class: 'muted' }, `스킬 변화: 1~3차 중 하나에 범위·피해·숨·한 번 더 가운데 하나 — 효과 등급 레어~신화가 랜덤 (이 두목이면 ${pct(lo, 1)}~${pct(hi, 1)})`),
              pv.specials ? h('div', { class: 'sp-pick' }, h('small', {}, '고유 효과 — 하나를 골라 새겨요 (나중에 바꿀 수 있어요)'),
                ...pv.specials.map((sp, i) => h('button', { class: `chip${i === spPick ? ' on' : ''}`, onclick: () => { spPick = i; paint(); } },
                  h('b', {}, sp.name), h('small', {}, ` ${IM.SPECIAL_KIND[sp.kind](pv.w)}`)))) : null);
          })() : null,
          f ? h('p', { class: 'muted' }, `증표 ${f.n}개 · 은자 ${fmt(f.gold)} · 성공 ${pct(f.chance, 0)} — 실패하면 다음 확률 +${pct(W.INFUSE_BASE[to] * W.INFUSE_PITY_K, 1)}p (천장)`) : null,
          // v198: 못 할 때 왜 못 하는지 — 전에는 단추만 흐려져서 '각인이 안 된다'로만 보였다
          f && !game.canInfuse(it, markPick) ? h('p', { class: 'inf-why' }, f.have < f.n
            ? `${W.matName(markPick)}가 ${f.n - f.have}개 모자라요 — 같은 두목의 증표가 ${f.n}개 있어야 해요(지금 ${f.have}개). 두목 구역에서 그 두목을 더 잡거나 다른 증표를 골라요.`
            : `은자가 ${fmt(f.gold - game.s.gold)} 모자라요.`) : null,
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
          const ok = game.infuse(it.uid, markPick, spPick);
          app.save(); app.refresh();
          const nim = ok ? IM.imprintOf(it.imps[it.rar - 1], it.rar - 1) : null;
          const msg = ok ? `각인 성공! ${W.RARITY[it.rar].name} — ${nim ? IM.skillModText(nim.skill) : optLines(it).join(' / ')}` : `각인 실패 — 다음 확률 +${pct(it.pity || 0, 0)}p`;
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
      // ---- 증표 각인 세 칸 (v163) ----
      const impBox = () => {
        const ims = (it.imps || []);
        return h('div', { class: 'imp-box' }, h('b', {}, '증표 각인 '), h('small', {}, '등급이 오를 때마다 넣은 증표의 두목이 한 칸씩'),
          ...[0, 1, 2].map((i) => {
            const im = ims[i] ? IM.imprintOf(ims[i], i) : null;
            if (!im) return h('div', { class: 'imp-row empty' }, `${['첫째(유니크)', '둘째(전설)', '셋째(신화)'][i]} — ${i < (it.rar || 0) ? '각인 없이 올렸어요' : '비어 있어요'}`);
            const c = game.reimpCost(it, i);
            const can = game.canReimp(it, i);
            const costTxt = c ? `${W.matName(c.key).replace(/의 증표$/, '')} 증표 ${c.n} · 은자 ${fmt(c.gold)}` : '';
            return h('div', { class: 'imp-row', style: `--ic:${IM.THEMES[im.theme].col}` },
              h('b', {}, `${im.boss} · ${IM.THEMES[im.theme].name}`),
              h('div', {}, Object.entries(im.fx).map(([k, v]) => IM.FX_TEXT[k](v)).join(' · ')),
              h('div', { class: 'imp-skill', style: `--gc:${IM.SK_GRADE[im.skill.g].col}` }, IM.skillModText(im.skill)),
              im.special ? h('div', { class: 'imp-sp' }, IM.specialText(im.special, im.w)) : null,
              h('div', { class: 'imp-act' },
                h('button', { class: 'chip', disabled: can ? null : true, onclick: () => {
                  // v200: 레전드·신화를 다시 돌리면 잃는다 — 한 번 묻는다
                  if (im.skill.g >= 2 && !confirm(`지금 스킬 변화가 ${IM.SK_GRADE[im.skill.g].name}예요\n(${IM.skillModText(im.skill)})\n\n다시 돌리면 이 효과는 사라져요. 다시 돌리겠습니까?`)) return;
                  const e = game.rerollImpSkill(it.uid, i);
                  if (!e) return toast('증표·은자가 모자라요');
                  toast(`스킬 변화 다시 — ${IM.skillModText(IM.imprintOf(e, i).skill)}`); app.save(); paint(); app.refresh();
                } }, '🎲 스킬 변화 다시'),
                im.specials ? h('span', { class: 'muted' }, ' 🔒 스킬 변화는 그대로 두고 고유만 바꾸기:') : null),
              im.specials ? h('div', { class: 'sp-pick' }, ...im.specials.map((sp, j) => h('button', { class: `chip${sp.id === im.special.id ? ' on' : ''}`, disabled: sp.id === im.special.id || !can ? true : null, onclick: () => {
                if (!game.changeImpSpecial(it.uid, i, j)) return toast('증표·은자가 모자라요');
                toast(`고유 효과를 【${sp.name}】(으)로 바꿨어요`); app.save(); paint(); app.refresh();
              } }, h('b', {}, sp.name), h('small', {}, ` ${IM.SPECIAL_KIND[sp.kind](im.w)}`)))) : null,
              h('small', { class: 'muted' }, `다시 새기는 값: ${costTxt}`));
          }));
      };
      // ---- 강화 (v152 · v192): 떨어질 수 있으면 묻고(+11부터는 붉게), 2초 연출 뒤 결과 ----
      const askEnhance = () => {
        if (!game.canEnhance(it)) return toast('은자나 재료가 모자라요');
        const lv = it.plus || 0;
        const rate = game.enhanceRateOf(it);
        const fail = W.enhanceFail(lv);
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
  const bagRoot = h('div');
  function gearView() {
    const s = game.s;
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid + '.' + (i.plus || 0)).join(',')}|${s.bagSize}|${ui.slot}|${s.gold >= game.bagUpgradeCost()}`;
    if (nsig === sigs.gear) return;
    sigs.gear = nsig;
    // 낀 여섯 칸 — 셋씩 두 줄
    const tiles = W.SLOTS.map((sl) => {
      const it = s.equip[sl.id];
      if (!it) return skinImg(h('div', { class: 'gear-tile empty' }, h('small', {}, sl.name), h('b', {}, '비어 있음')), `slot-${sl.id}`);
      const g = gradeOf(it);
      return skinImg(h('button', { class: `gear-tile${it.rar === 3 ? ' mythic' : ''}${it.set ? ' set' : ''}`, style: `--gc:${g.color}${it.set ? `;--sc:${G.setOf(it.set).col}` : ''}`, onclick: () => openItem(it, true) },
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
    const cards = list.map(({ it, d }) => itemTile(game, it, d, () => openItem(it, false)));
    const better = list.filter((x) => x.d > 0.005);
    const old = s.bag.filter((x) => s.equip[x.slot] && game.itemScore(x) < game.itemScore(s.equip[x.slot]) && !x.plus && !(x.rar >= 2));
    const setNow = Object.entries(game.setCounts()).map(([id, n]) => ({ st: G.setOf(id), n })).filter((x) => x.st);
    // v150: 착용 | 가방을 칸으로 나눴다 — 한 화면에 낀 것·세트·가방·버튼이 다 있어 복잡했다
    gearRoot.replaceChildren(...[
      h('div', { class: 'card' }, h('h3', {}, '끼고 있는 것', h('small', {}, `전투력 ${fmt(game.stats().power)} · 눌러서 강화·승급`)),
        h('div', { class: 'gear-grid' }, ...tiles)),
      ...setNow.map(({ st }) => setBox(game, st)),
    ].filter(Boolean));
    bagRoot.replaceChildren(...[
      h('div', { class: 'card' },
        h('h3', {}, '가방', h('small', {}, `${s.bag.length} / ${s.bagSize} · 넘치면 가장 나쁜 것부터 팔아요`)),
        chips,
        better.length ? h('button', { class: 'btn primary', style: 'width:100%;margin:6px 0', onclick: () => {
          let n = 0;
          for (const { it } of better) { const cur = s.equip[it.slot]; if (!cur || game.itemScore(it) > game.itemScore(cur)) { game.equipFromBag(it.uid); n++; } }
          toast(`더 좋은 장비 ${n}개를 꼈어요`); done();
        } }, `▲ 더 좋은 것 모두 끼기 (${better.length})`) : null,
        cards.length ? h('div', { class: 'inv-grid' }, ...cards) : h('p', { class: 'muted' }, ui.slot === 'all' ? '가방이 비었어요. 대장장이가 만든 장비는 낀 것보다 좋으면 바로 껴요.' : '이 칸 장비가 가방에 없어요.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', disabled: old.length ? null : true, onclick: () => {
            let p = 0;
            for (const it of old) p += game.sell(it);
            toast(`약한 장비 ${old.length}개를 팔아 은자 +${fmt(p)} (강화·전설 이상은 남겨요)`);
            done();
          } }, `약한 것 팔기${old.length ? ` ${old.length}` : ''}`),
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
    const nsig = `${game.statSig()}|${s.bag.map((i) => i.uid + '.' + (i.plus || 0) + '.' + (i.rar || 0)).join(',')}|${JSON.stringify(s.mats)}|${Math.floor(Math.log10(s.gold + 1) * 20)}|${ui.smode}|${ui.kz}|${ui.kslot}|${s.level}`;
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
      return h('button', { class: `grow-card${canInf || canE ? ' ready' : ''}`, style: `--gc:${g.color}`, onclick: () => openItem(it, worn) },
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
    for (const [k, n] of Object.entries(r.mats)) parts.push(need(W.matName(k), s0().mats[k] || 0, n, W.matColor(k), k));
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
      const can = Math.floor((s.mats[z] || 0) / G.STONE_FROM_MATS);
      return h('div', { class: 'row stone-row' },
        h('div', { class: 'info' },
          h('div', { class: 'name' }, W.matName(key), h('small', {}, ` ${fmt(s.mats[key] || 0)}개`)),
          h('div', { class: 'desc' }, `${stn.what} · ${W.zoneOfW(+z).name} 두목이 ${G.STONE_PER_BOSS}개씩 · ${W.matName(z)} ${G.STONE_FROM_MATS}개로 하나 (가진 재료 ${fmt(s.mats[z] || 0)})`)),
        h('button', { class: 'buy', disabled: can ? null : true, onclick: () => { const n = game.makeStone(+z, can); if (n) { toast(`${W.matName(key)} +${n}`); done(); } } }, can ? `만들기 ${can}` : '만들기'));
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
  const matRoot = h('div');
  function matView() {
    const s = game.s;
    const nsig = JSON.stringify(s.mats);
    if (nsig === sigs.mats) return;
    sigs.mats = nsig;
    const zones = new Set(Object.keys(s.mats).filter((k) => s.mats[k] > 0 && !G.isStoneKey(k) && !LN.isFacMat(k)).map((k) => parseInt(k.replace('b', ''), 10)));
    const facRow = h('div', { class: 'row mat-zone' }, h('div', { class: 'info' }, h('div', { class: 'name' }, '세력 재료', h('small', {}, ' 레벨 100 고수 세트에 들어가요')),
      h('div', { class: 'mat-row' }, ...Object.entries(LN.FAC_MAT_INFO).map(([k, v]) => matChip(app, k, v.name, s.mats[k] || 0)),
        ...Object.entries(G.LORD_MATS).map(([k, v]) => matChip(app, k, v.name, s.mats[k] || 0)))));
    const stones = Object.keys(G.STONES).filter((z) => s.mats[G.stoneKey(z)] > 0);
    const rows = [...zones].sort((a, b) => b - a).map((z) => h('div', { class: 'row mat-zone' },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, W.zoneOfW(z)?.name || `지역 ${z}`),
        h('div', { class: 'mat-row' },
          matChip(app, z, W.matName(z), s.mats[z] || 0),
          matChip(app, W.bossKey(z), W.matName(W.bossKey(z)), s.mats[W.bossKey(z)] || 0),
          G.STONES[z] && s.mats[G.stoneKey(z)] > 0 ? matChip(app, G.stoneKey(z), G.STONES[z].name, s.mats[G.stoneKey(z)]) : null),
        h('div', { class: 'desc' }, '눌러 보면 어디서 나오는지 알려 주고 거기로 데려다 줘요')),
      // 재료 올리기 (v174) — 둘을 다음 지역 하나로
      W.matUpTarget(z) && (s.mats[z] || 0) >= W.MAT_CONVERT ? h('button', { class: 'buy mat-up', onclick: () => {
        const m = game.convertMats(z);
        if (m) { toast(`${W.matName(z)} ${fmt(m * W.MAT_CONVERT)} → ${W.matName(W.matUpTarget(z))} ${fmt(m)}`); done(); }
      } }, `→ ${W.matName(W.matUpTarget(z))} ${fmt(Math.floor((s.mats[z] || 0) / W.MAT_CONVERT))}`, h('small', {}, ` ${W.MAT_CONVERT}:1`)) : null));
    for (const z of stones) if (!zones.has(+z)) rows.push(h('div', { class: 'row mat-zone' }, h('div', { class: 'info' }, h('div', { class: 'name' }, W.zoneOfW(+z)?.name || ''),
      h('div', { class: 'mat-row' }, matChip(app, G.stoneKey(z), G.STONES[z].name, s.mats[G.stoneKey(z)])))));
    const topZ = W.stepMap(W.stepOfLevel(Math.min(s.level, W.ILV_CAP)));
    const canUp = [...zones].some((z) => z < topZ && W.matUpTarget(z) && (s.mats[z] || 0) >= W.MAT_CONVERT);
    matRoot.replaceChildren(h('div', { class: 'card' }, h('h3', {}, '재료', h('small', {}, '문파 창고로 나눌 수 있어요')),
      h('div', { class: 'mat-up-all' }, h('small', { class: 'muted' }, `지난 지역 재료는 둘을 다음 지역 하나로 올릴 수 있어요 — 강화에는 지금 레벨 지역(${W.matName(topZ)}) 재료가 들어요`),
        canUp ? h('button', { class: 'btn primary', onclick: () => {
          const got = game.convertAllUp();
          const t = Object.entries(got).map(([k, n]) => `${W.matName(k)} +${fmt(n)}`).join(' · ');
          if (t) { toast(`재료 올리기 — ${t}`); done(); }
        } }, `낮은 재료 모두 ${W.matName(topZ)}까지 올리기`) : null),
      facRow,
      ...(rows.length ? rows : [h('p', { class: 'muted' }, '몹은 그 사냥터 재료를, 두목은 재료 한 움큼과 증표를 떨궈요.')])));
  }

  return subTabs([
    { key: 'gear', label: '착용', make: () => ({ root: gearRoot, update: gearView }) },
    { key: 'bag', label: '가방', make: () => ({ root: bagRoot, update: gearView }) },
    { key: 'smith', label: '대장장이', make: () => ({ root: smithRoot, update: smithView }) },
    { key: 'mats', label: '재료', make: () => ({ root: matRoot, update: matView }) },
  ]);
}

// 누를 수 있는 재료 알약
// v230: 재료 그림 — 빛깔 보석 안에 갈래 글자(재료 材 · 두목 증표 證 · 강화석 石 · 세력 재료 勢 · 맹주의 패 牌)
export function matKind(key) {
  const k = String(key);
  return G.isLordMat(k) ? '牌' : LN.isFacMat(k) ? '勢' : G.isStoneKey(k) ? '石' : W.isMarkKey(k) ? '證' : '材';
}
export const matIcon = (key, size = 40) => h('span', { class: `mat-ico k-${matKind(key)}`, style: `--mc:${W.matColor(key)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px` }, matKind(key));
// 누르면 어디서 나오는지 · 데려다 준다. 0개는 흐리게.
export const matChip = (app, key, label, n) => h('button', {
  class: `mat-chip tap${n ? '' : ' none'}`, style: `--mc:${W.matColor(key)}`,
  onclick: () => openMatWhere(app, key),
}, matIcon(key), h('b', {}, fmt(n)), h('small', {}, label));

// ---------- 재료가 어디서 나오나 (v141) ----------
// 재료 열쇠에서 지역과 '어디를 쳐야 하나'를 읽는다.
//   z → 그 지역 몹 (구역 1·2·3)
//   b{z} → 그 지역 두목 구역의 두목
//   s{z} → 그 지역 두목 (강화석)
export function matWhere(game, key) {
  const k = String(key);
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
  const z = parseInt(k.replace(/^[bs]/, ''), 10);
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
    from: stone ? `${zone.name} 두목이 떨궈요` : boss ? `${zone.name} 두목 구역의 두목이 떨궈요` : `${zone.name} 몹이 떨궈요`,
  };
}

// 십이지왕 두목 구역에 들어갈 때 — 혼자 / 문파원과 함께를 고른다 (v145).
// 문파가 없거나 서버에 못 닿으면 묻지 않고 혼자 들어간다. then(ok)는 들어간 뒤 부른다.
export function enterKingRoom(app, id, then) {
  const { game } = app;
  const m = W.mapOf(id);
  const coop = app.coop;
  const enter = (party) => {
    game.s.kingParty = party;
    const ok = game.enterMap(id);
    if (ok) toast(party ? `🤝 ${m.king.title} — 문파원과 함께 들어왔어요. 자동 사냥은 그대로 돌아요` : `${m.king.title} — 혼자 들어왔어요`);
    then?.(ok);
  };
  if (!m.bossRoom || !m.king || !coop?.can()) { if (m.bossRoom && m.king) game.s.kingParty = false; const ok = game.enterMap(id); then?.(ok); return; }
  if (!game.canEnter(id)) { toast('지금은 갈 수 없어요'); return; }
  const who = h('p', { class: 'muted' }, '같은 구역의 문파원을 찾는 중…');
  openModal((sheet) => {
    sheet.append(
      h('h2', {}, `${m.king.title} 두목 구역`),
      h('p', {}, '어떻게 들어갈까요? 둘 다 자동 사냥(방치)으로 계속 돌아요.'),
      h('div', { class: 'party-pick' },
        h('button', { class: `party-opt${game.s.kingParty ? '' : ' on'}`, onclick: () => { closeModal(); enter(false); } },
          h('b', {}, '⚔ 혼자'), h('span', {}, '왕을 혼자 잡아요. 체력도 보상도 나만의 것.')),
        h('button', { class: `party-opt${game.s.kingParty ? ' on' : ''}`, onclick: () => { closeModal(); enter(true); } },
          h('b', {}, '🤝 문파원과 함께'), h('span', {}, '같은 구역의 문파원과 왕 체력을 나눠요. 한 대라도 치면 처치 보상을 다 받아요.'))),
      who,
      h('p', { class: 'muted', style: 'font-size:11px' }, '들어가서도 위의 단추로 바꿀 수 있어요. 앱을 끈 동안의 방치 보상은 혼자 사냥으로 셈해요.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '닫기')));
  });
  coop.peek(id).then((n) => { who.textContent = n == null ? '' : n > 0 ? `🤝 지금 이 왕 구역에 문파원 ${n}명이 사냥 중이에요` : '지금 이 왕 구역에 있는 문파원은 없어요 — 함께로 들어가 두면 나중에 온 문파원과 같이 잡아요'; });
}

// 누르면 뜨는 창 — 어디서 나오는지 알려 주고, 갈지 묻고, 간다
export function openMatWhere(app, key) {
  const { game } = app;
  const w = matWhere(game, key);
  if (!w) return;
  openModal((sheet) => {
    // **append는 null을 "null" 글자로 찍는다.** h()는 걸러 주지만 append는 아니다 —
    // 화면에 null이 한 줄 뜨는 사고가 옛 판에서 세 번 났다. 걸러서 넘긴다.
    sheet.append(...[
      h('h2', {}, h('span', { style: `color:${w.color}` }, w.name)),
      h('p', {}, w.from),
      h('p', { class: 'muted' }, `지금 가진 것 ${fmt(w.have)}개 · ${w.map ? `${w.map.name} (몹 Lv.${w.map.lv[0]}~${w.map.lv[1]})` : ''}`),
      w.can ? null : h('p', { class: 'dgn-warn' }, `레벨 ${w.need}부터 들어갈 수 있어요 — 지금 ${game.s.level}.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: closeModal }, '안 갈래요'),
        h('button', { class: 'btn primary', disabled: w.can ? null : true, onclick: () => {
          const arrived = () => {
            // 돌아갈 곳도 여기로 — 안 그러면 쓰러진 뒤 옛 사냥터로 되돌아간다
            game.s.huntMap = w.id;
            app.save();
            app.closePanel();
            app.refresh();
          };
          if (w.map?.king && w.map.bossRoom && app.coop?.can()) { closeModal(); enterKingRoom(app, w.id, (ok) => ok && arrived()); return; }
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
  for (const [k, n] of Object.entries(r.mats || {})) out.push(`${W.matName(k)} ${fmt(n)}`);
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
  if (!out.length || (lead && out.length === 1)) out.push('없음');
  return out;
}

// v126: 지도 창 = 사냥터 · 던전 (요일 던전 · 무한의 탑)
function mapTab(app) {
  const { game } = app;
  const go = (id) => {
    const m = W.mapOf(id);
    if (m.bossRoom && m.king) return enterKingRoom(app, id, (ok) => { if (ok) { app.save(); app.closePanel(); app.refresh(); } });
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
        }, m.bossRoom ? '두목' : String(m.area), h('small', {}, `${risky ? '⚠' : ''}Lv${m.lv[0]}`));
      });
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
        h('div', { class: 'area-row' }, ...btns)));
  }
  // 고수 한 명 — 두목 방 카드 (v148). 수하 졸개가 늘 있고 고수가 45초마다 다시 나선다. 이야기는 접어 둔다.
  function masterCard(m, fac) {
    const s = game.s;
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
      h('div', { class: 'master-rw' }, won ? `✓ 쓰러뜨렸어요 · 공격력·체력 +${bonus}% 영구 — 눌러앉아 파밍하세요` : `처음 쓰러뜨리면 ${rewardText(rw)} · 공격력·체력 +${bonus}% 영구`),
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
        const nsig = `${s.level}|${s.map}|${s.huntMap}|${Object.values(s.mast || {}).map((k) => L.masteryLv(k)).join(',')}|${JSON.stringify(s.duel.won)}|${!!game.inst}`;
        if (nsig === sig) return;
        sig = nsig;
        const here = W.mapOf(s.map);
        if (fac === 'king') {
          box.replaceChildren(h('p', { class: 'muted' }, '권장 레벨 99 · 제12왕에서 제1왕 검왕까지. 두목 구역에 들어갈 때 혼자 또는 문파원과 함께를 골라요. 전반 다섯 왕은 직업 세트 조각, 후반 일곱 왕은 세트 강화석을 떨궈요.'));
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
          h('h3', { class: 'king-head' }, '사냥터', h('small', {}, '레벨과 상관없이 어디든 — ⚠는 내 레벨보다 훨씬 센 곳')));
        for (const z of MS.FAC_ZONES[fac]) { const zn = W.ZONE_ORDER.find((x) => x.id === z); if (zn) zoneCard(box, zn, here); }
        // v204: 고수(두목)는 '무림고수' 칸으로 따로 모았다
        box.append(h('button', { class: 'card fac-masters-link', style: `--fc:${F.col}`, onclick: () => app.showTab('map', 'masters') },
          h('b', {}, `${fac === 'magyo' ? '팔마존 · 천마' : fac === 'murim' ? '정파 칠대고수 · 무림맹주' : '사도 칠대고수 · 사도맹주'} → 무림고수 칸`),
          h('small', {}, ` 쓰러뜨림 ${won}/${MS.mastersOf(fac).length}`)));
      },
    };
  }
  // 무림고수 (v204) — 세 세력의 고수·맹주·천마를 한 칸에. 세력별로 묶고 레벨 차례.
  function mastersView() {
    const box = h('div');
    let sig = '';
    return {
      root: box,
      update() {
        const s = game.s;
        const nsig = `${s.level}|${s.map}|${JSON.stringify(s.duel.won)}|${!!game.inst}`;
        if (nsig === sig) return;
        sig = nsig;
        const all = ['murim', 'sapa', 'magyo'].flatMap((f) => MS.mastersOf(f));
        const won = all.filter((m) => s.duel.won[m.id]).length;
        box.replaceChildren(h('p', { class: 'muted' }, `세력마다 이름난 고수가 산다 — 처음 쓰러뜨리면 큰 보상과 영구 공격력·체력, 두목 방에서는 세력 재료가 나온다. 쓰러뜨림 ${won}/${all.length}`));
        for (const fac of ['murim', 'sapa', 'magyo']) {
          const F = MS.factionOf(fac);
          const ms = MS.mastersOf(fac).slice().sort((a, b) => a.lv - b.lv);
          const w = ms.filter((m) => s.duel.won[m.id]).length;
          box.append(h('h3', { class: 'king-head', style: `color:${F.col}` }, `${F.name} ${fac === 'magyo' ? '팔마존 · 천마' : fac === 'murim' ? '칠대고수 · 무림맹주' : '칠대고수 · 사도맹주'}`,
            h('small', {}, ` ${w}/${ms.length}`)));
          for (const m of ms) box.append(masterCard(m, F));
        }
      },
    };
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
  const start = (fn) => { if (!fn()) return; app.save(); app.closePanel(); app.refresh(); };
  const sigOf = () => {
    const s = game.s;
    const now = Date.now();
    const net = app.net;
    const rd = net?.raid;
    const nsig = `${s.level}|${JSON.stringify(s.dgn)}|${s.tower.floor}|${s.tower.auto}|${D.kstDay(now)}|${JSON.stringify(stagePick)}|${!!game.inst}|${!!s.job}|${JSON.stringify(s.zTickets)}|${s.mounts.length}|${net?.status}|${s.guildId}|${rd?.kind}|${rd?.total}|${rd?.maxHp}|${JSON.stringify(rd?.claimed || {})}|${JSON.stringify(s.raid)}`;
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
    // v230: 던전 루틴 — 요일 던전 모두 → 무한의 탑 → 사냥터. 켜 두면 방치 중에도 알아서 돈다.
    const leftAll = D.DAILY.reduce((a, d) => a + (D.dailyOpen(d, now) ? game.dailyLeft(d.id, now) : 0), 0);
    const twOk = game.canTower() && game.towerRetryOk();
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
        step('日', '요일 던전', leftAll ? `${leftAll}번 남음` : '오늘 끝', leftAll > 0),
        h('span', { class: 'rt-arrow' }, '›'),
        step('塔', '무한의 탑', game.s.tower.floor >= D.TOWER_MAX ? '끝까지' : twOk ? `${game.s.tower.floor + 1}층 도전` : '더 세지면', twOk),
        h('span', { class: 'rt-arrow' }, '›'),
        step('獵', '사냥터', '돌아가 사냥', true)));
    const head = h('div', { class: 'card dgn-head' },
      h('div', {}, h('b', {}, '일일 던전'), h('small', { class: 'muted' }, ` · 하루 ${D.DAILY_ENTRIES}번 · 새 단계 🔑는 한 번 더`),
        h('label', { class: 'chk' }, dAuto, ' 요일 던전만 자동')),
      h('button', { class: 'btn primary', disabled: sweepN ? null : true, onclick: () => {
        const got = game.sweepAll(now);
        if (!got.length) return;
        app.save(); app.refresh();
        toast(`소탕 ${got.length}번 — ${got.map((x) => rewardText(x.reward)).join(' / ')}`);
      } }, sweepN ? `모두 소탕 (${sweepN})` : '모두 소탕'));
    const cards = D.DAILY.map((d) => {
      const open = D.dailyOpen(d, now);
      const left = game.dailyLeft(d.id, now);
      const best = game.dailyBest(d.id);
      const max = game.dailyMaxStage(d.id);
      const stg = Math.max(1, Math.min(max, stagePick[d.id] ?? max));
      const rw = D.dailyReward(d.id, stg, game.levelGapMult(D.dailyLv(stg)));
      const step = (k) => { stagePick[d.id] = Math.max(1, Math.min(max, stg + k)); rerender(); };
      return h('div', { class: `card dgn-card dgn-${d.id}${open ? '' : ' closed'}` },
        h('div', { class: 'dgn-top' },
          skinImg(h('div', { class: 'dgn-ico' }, d.ico), `dg-${d.id}`),
          h('div', { class: 'dgn-name' }, h('b', {}, d.name), h('small', {}, ` ${d.hanja} · ${d.what}`),
            open ? h('div', { class: 'dgn-pips' }, ...Array.from({ length: D.DAILY_ENTRIES }, (_, i) => h('i', { class: i < left ? 'on' : '' })),
              h('small', {}, ` 깬 단계 ${best || '-'}${max > best ? ` · ${best + 1}단계 🔑` : ''}`))
              : h('div', { class: 'muted' }, `${D.dailyDaysText(d)}요일에 열려요`))),
        h('div', { class: 'dgn-stage' },
          h('button', { class: 'stp', disabled: stg <= 1 ? true : null, onclick: () => step(-1) }, '−'),
          h('div', { class: 'stg' }, h('b', {}, `${stg}단계`), h('small', {}, ` 몹 Lv.${D.dailyLv(stg)}${D.dailyLv(stg) - s.level > W.DANGER_LV ? ' ⚠위험' : ''}`)),
          h('button', { class: 'stp', disabled: stg >= max ? true : null, onclick: () => step(1) }, '+'),
          h('div', { class: 'rw' }, ...rewardNodes(app, rw, '보상 '))),
        // 천공광맥은 단계마다 나오는 재료가 통째로 바뀐다 — 어느 지역인지 적는다
        d.id === 'mat'
          ? h('p', { class: 'muted dgn-where' },
            `${W.zoneOfW(D.zoneForLv(D.dailyLv(stg)))?.name || ''}의 재료·증표예요 — 이름을 누르면 그 사냥터로 갈 수 있어요`)
          : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', disabled: game.canDaily(d.id, stg, now) ? null : true, onclick: () => start(() => game.startDaily(d.id, stg, now)) },
            `도전 (${D.DAILY_SEC}초 · ${D.DAILY_KILLS}마리)${stg > best ? ' 🔑' : ''}`),
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
      h('p', { class: 'muted dgn-desc' }, `${D.TOWER_MAX}층까지. 층마다 수문장 하나 — ${D.TOWER_SEC}초(십이지신 ${D.TOWER_ZODIAC_SEC}초) 안에 쓰러뜨리면 다음 층. 오른 층마다 공격력·체력 +${D.TOWER_BONUS * 100}% 영구. 횟수 제한 없음.`),
      h('p', { class: 'dgn-warn' }, '⚠ 수문장은 바닥에 붉은 경고를 깔고 크게 쳐요(두 번 맞으면 거의 쓰러져요). 자동으로는 안 피해요 — 화면을 눌러 끌어서(조이스틱) 직접 피하세요. 탑에서는 물약을 못 써요.'),
      D.zodiacOf(nf) ? h('p', { class: 'dgn-zodiac' }, `${nf}층 ${D.zodiacOf(nf).god} — ${D.zodiacOf(nf).move}`) : null,
      h('div', { class: 'dgn-stage' },
        h('div', { class: 'stg' }, h('b', {}, `${nf}층`), h('small', {}, ` ${nb.name.replace(/^\d+층 수문장 /, '')} · Lv.${D.towerLv(nf)}${D.towerPow(nf) > 1 ? '+' : ''}`)),
        h('div', { class: 'rw' }, ...rewardNodes(app, D.towerReward(nf), '처음 오르면 '))),
      h('label', { class: 'chk' }, auto, ' 이기면 이어서 다음 층으로'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', disabled: game.canTower() ? null : true, onclick: () => start(() => game.startTower()) }, tw.floor >= D.TOWER_MAX ? '꼭대기까지 올랐어요' : `${nf}층 도전`)));
    return [tower];
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
          title: `${z.god} · ${md.name} (이동 +${Math.round(md.speed * 100)}% · 공격·체력 +${Math.round(md.stat * 100)}%)`,
          onclick: () => { const mt = game.drawZodiac(z.no); if (!mt) return; app.save(); rerender(); app.refresh(); },
        }, creatureIcon(z.mount, 40), h('b', {}, `${z.ji} ${z.animal}`), h('small', {}, n ? `뽑기 ${n}` : own ? '신수 ✓' : `${z.no * 10}층`));
      })));
    return [zodiacCard];
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
    { key: 'raid', label: '문파 토벌', make: () => view(buildRaid) },
  ], 'ifu.dgnsub');
  const upd0 = t.update;
  t.update = () => {
    t.setDot('daily', dailyWaiting(game));
    t.setDot('zodiac', Object.values(game.s.zTickets || {}).some((n) => n > 0));
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
    return [card, pathCard(), h('div', { class: 'card' }, h('h3', {}, '배우는 무공', h('small', {}, W.LORE[s.job]?.title || '')), ...steps)];
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
    const buy = (n, max = false) => h('button', { class: 'buy', disabled: n <= 0 || s.gold < price * n ? true : null, onclick: () => {
      if (game.buyPotions(n)) { toast(`물약 ${fmt(n)}개를 샀어요`); app.save(); app.refresh(); }
    } }, max ? '최대' : `${n}개`, h('small', {}, max ? `${fmt(n)}개` : fmt(price * n)));
    const refill = h('button', { class: `btn ${s.autoRefill ? 'good' : ''}`, onclick: () => { s.autoRefill = !s.autoRefill; app.save(); sig = ''; upd(); } }, s.autoRefill ? '자동 보충 켜짐' : '자동 보충 꺼짐');
    return [
      h('div', { class: 'card shop-card' },
        h('div', { class: 'shop-item' },
          h('span', { class: 'pot-ico big' }),
          h('div', { class: 'info' }, h('b', {}, '빨간 물약', h('small', {}, ` 개당 ${fmt(price)}`)),
            h('div', { class: 'desc' }, `최대 체력의 ${pct(W.POTION_HEAL, 0)} 회복 · 체력 ${pct(game.potionAt(), 0)} 아래면 알아서 먹어요 (설정에서 바꿔요)`)),
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
      // 강화 보호부 (v150 · v192) — +11부터 실패해도 -2 대신 그대로
      h('div', { class: 'card shop-card' },
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
    const nsig = `${pick}|${inTown}|${s.autoHunt}|${s.huntMap}|${s.jobTier}|${s.level}|${s.potions}|${s.books || 0}|${s.autoRefill}|${Math.floor(Math.log10(s.gold + 1) * 30)}|${game.canAdvance()}|${s.prot || 0}`;
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
  t.update = () => { t.setDot('master', game.canAdvance()); upd0(); };
  // 전직할 수 있으면 사부 칸부터 (칸을 짚어 연 게 아니면)
  t.shown = (sub) => { if (!sub && game.canAdvance()) t.select('master'); };
  return t;
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
  if (sk.kind === 'single') return `과녁 하나 · 사거리 ${t(rc.reach)}${rc.r ? ` · 둘레 ${t(rc.r)}도 맞음` : ''}`;
  if (sk.kind === 'triple') return `내 둘레 ${t(rc.r)}`;
  return rc.center === 'target' ? `과녁 둘레 반경 ${t(rc.r)}` : `내 둘레 반경 ${t(rc.r)}`;
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
        h('b', {}, d.name), h('span', {}, `이동 +${Math.round(d.speed * 100)}% · 공격·체력 +${Math.round(d.stat * 100)}%`), h('small', {}, d.zodiac ? `무한의 탑 ${d.zodiac * 10}층 십이지 뽑기` : `${z?.name || ''} 두목부터`));
    }));
  // v147: 애완동물 | 탈것 두 칸으로
  const petBox = h('div', {}, petCard, boxCard, rankCard);
  const mountBox = h('div', {}, mountCard, mountRank);
  void root;
  let sig = '';
  const rarTag = (r) => h('b', { style: `color:${W.RARITY[r].color}` }, W.RARITY[r].name);
  const petInfo = (p) => {
    const d = W.petOf(p.kind);
    const v = W.petBuff(p);
    const vt = d.buff === 'crit' ? `+${(v * 100).toFixed(1)}%p` : d.buff === 'def' ? `+${v.toFixed(0)}` : d.buff === 'regenPct' ? `+${(v * 100).toFixed(2)}%` : `+${(v * 100).toFixed(1)}%`;
    return `${d.text} ${vt} · 한 대에 무인 공격력의 ${Math.round(W.petAtkRatio(p) * 100)}% · 기술 【${W.PET_SKILL_NAME[p.kind]}】 ${(W.PET_SKILL_SEC * (1 - (p.rar || 0) * 0.1)).toFixed(1)}초마다 둘레를 ${Math.round(W.petAtkRatio(p) * W.PET_SKILL_MULT * 100)}%로`;
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
    // v231: 우리는 그림 칸 셋씩 — 글 줄이 길고 단추가 끼어 비좁았다. 누르면 자세히(데려가기·놓아주기)
    const openPen = (p) => openModal((m) => {
      const d = W.petOf(p.kind);
      const full = s.pets.length >= slots;
      m.append(h('div', { class: 'pen-head' }, h('div', { class: 'ico pet-ico big' }, creatureIcon(p.kind)),
        h('div', {}, h('h2', {}, d.name, ' ', rarTag(p.rar)), h('small', { class: 'muted' }, `순위 ${d.tier} · Lv.${p.lv}`))),
        h('p', { class: 'muted' }, petInfo(p)),
        full ? h('p', { class: 'muted', style: 'font-size:12px' }, `키우는 칸이 꽉 찼어요(${s.pets.length}/${slots}) — 위에서 하나를 놓아주면 데려갈 수 있어요.`) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn danger', onclick: () => { closeModal(); confirmRelease(p, done); } }, '놓아주기'),
          h('button', { class: 'btn primary', disabled: full ? true : null, onclick: () => { if (game.adoptPet(p.uid)) { closeModal(); toast(`${d.name}을(를) 데려갔어요`); done(); } } }, '데려가기')),
        h('button', { class: 'btn', style: 'width:100%;margin-top:6px', onclick: closeModal }, '닫기'));
    });
    if (s.petBox.length) boxCard.append(h('div', { class: 'pen-grid' }, ...[...s.petBox].sort((a, b) => (b.rar || 0) - (a.rar || 0) || W.petOf(b.kind).tier - W.petOf(a.kind).tier).map((p) => {
      const d = W.petOf(p.kind);
      return h('button', { class: 'pen-tile', style: `--rc:${W.RARITY[p.rar || 0].color}`, onclick: () => openPen(p) },
        h('div', { class: 'ico pet-ico' }, creatureIcon(p.kind)),
        h('b', {}, d.name), h('small', {}, `${W.RARITY[p.rar || 0].name} · 순위 ${d.tier}`));
    })));
    const cur = game.mountNow();
    mountCard.replaceChildren(h('h3', {}, '탈것', h('small', {}, cur ? `${cur.name}을(를) 타는 중` : '걸어 다니는 중')));
    if (!s.mounts.length) mountCard.append(h('p', { class: 'muted' }, '몹이 아주 드물게 탈것을 떨궈요 — 높은 두목일수록 자주·좋은 것까지. 타면 빨리 움직이고 공격력·체력이 올라요.'));
    // 탈것 합성 (v204) — 같은 순위가 셋 이상 모인 순위만 보인다
    const tiers = [...new Set(s.mounts.map((m) => W.mountOf(m.kind)).filter((d) => d && !d.zodiac && d.tier < W.MOUNT_TOP).map((d) => d.tier))]
      .filter((t) => game.fuseCandidates(t).length >= W.MOUNT_FUSE_N).sort((a, b) => a - b);
    if (tiers.length) {
      const fuse = h('div', { class: 'fuse-box' }, h('b', {}, '🔮 탈것 합성 '), h('small', {}, `같은 순위 ${W.MOUNT_FUSE_N}마리 → 다음 순위 하나`));
      for (const t of tiers) {
        const a = W.mountOfTier(t), b = W.mountOfTier(t + 1);
        const cost = W.mountFuseCost(t);
        fuse.append(h('div', { class: 'row fuse-row' },
          h('div', { class: 'ico pet-ico' }, creatureIcon(a.id)),
          h('div', { class: 'info' }, h('div', { class: 'name' }, `${a.name} ×${W.MOUNT_FUSE_N} → ${b.name}`, h('small', {}, ` (가진 것 ${game.fuseCandidates(t).length})`)),
            h('div', { class: 'desc' }, `이동 +${Math.round(b.speed * 100)}% · 공격력·체력 +${Math.round(b.stat * 100)}% · 은자 ${fmt(cost)}`)),
          h('button', { class: 'buy', disabled: game.canFuseMounts(t) ? null : true, onclick: () => {
            const m = game.fuseMounts(t);
            if (!m) return toast('은자가 모자라요');
            toast(`합성 성공! ${b.name}(순위 ${b.tier})`); app.save(); done();
          } }, '합성')));
      }
      mountCard.append(fuse);
    }
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
  const t = subTabs([
    { key: 'pet', label: '애완동물', make: () => ({ root: petBox, update: upd }) },
    { key: 'mount', label: '탈것', make: () => ({ root: mountBox, update: upd }) },
  ], 'ifu.compsub');
  const upd0 = t.update;
  t.update = () => {
    t.setDot('pet', game.s.petBox.length > 0 && game.s.pets.length < game.petSlots());
    t.setDot('mount', game.s.mounts.length > 0 && game.s.mount == null);
    upd0();
  };
  return t;
}

export const WTABS = { char: charTab, bag: bagTab, map: mapTab, dgn: dgnTab, town: townTab, social: socialTab, comp: compTab };
export const WTAB_TITLE = { char: '캐릭터', bag: '가방', map: '지도', dgn: '던전', town: '마을', social: '무림', comp: '동료' };
