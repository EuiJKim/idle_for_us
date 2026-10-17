// 하단 탭 화면과 모달·토스트. 각 탭은 한 번 그리고, update()로 숫자만 갱신한다.
import {
  UPGRADES, GRADES, EQUIP_TYPES, SKILLS, MERGE_COUNT, GACHA_COST, GACHA10_COST, RAID_TICKETS,
  guildLevel, guildAtkBonus, GUILD_DONATE_GEMS, GUILD_DONATE_EXP, GUILD_CHECKIN_EXP, GUILD_MAX, raidReward,
} from './data.js';
import { fmt, pct, ago, escapeHtml } from './fmt.js';
import { dayKey } from './game.js';

// ---------- 작은 DOM 도우미 ----------
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

export function toast(text) {
  const box = document.getElementById('toast');
  const el = h('div', { class: 'toast' }, text);
  box.append(el);
  setTimeout(() => el.remove(), 2700);
  while (box.children.length > 3) box.firstChild.remove();
}

let modalOnClose = null;
export function openModal(build, { dismissable = true, onClose } = {}) {
  const modal = document.getElementById('modal');
  const sheet = modal.querySelector('.sheet');
  sheet.replaceChildren();
  build(sheet);
  modal.classList.remove('hidden');
  modal.onclick = dismissable ? (e) => { if (e.target === modal) closeModal(); } : null;
  modalOnClose = onClose || null;
}
export function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  const cb = modalOnClose;
  modalOnClose = null;
  if (cb) cb();
}
export const modalOpen = () => !document.getElementById('modal').classList.contains('hidden');

const fmtValue = (def, v) => (def.fmt === 'pct' ? pct(v) : def.fmt === 'x' ? `${v.toFixed(2)}배` : fmt(v));
const gradeChip = (g) => h('span', { style: `color:${GRADES[g].color};font-weight:800` }, GRADES[g].name);

// ---------- 강화 ----------
function upgradeTab(app) {
  const { game } = app;
  let mult = 1;
  const rows = {};
  const seg = h('div', { class: 'seg' }, ...[1, 10, 'MAX'].map((m) =>
    h('button', { class: m === 1 ? 'on' : '', onclick: (e) => {
      mult = m;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      update();
    } }, m === 'MAX' ? 'MAX' : `x${m}`)));

  const root = h('div', {},
    h('div', { class: 'section-title' }, h('span', {}, '골드로 캐릭터를 강화하세요'), seg));

  for (const [key, def] of Object.entries(UPGRADES)) {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy gold-cost', onclick: () => {
      const n = game.buyUpgrade(key, mult === 'MAX' ? 10000 : mult);
      if (n) app.refresh();
    } });
    rows[key] = { lv, desc, btn, def };
    root.append(h('div', { class: 'row' },
      h('div', { class: 'ico' }, def.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, def.name, lv), desc),
      btn));
  }

  function plannedCost(key) {
    const def = UPGRADES[key];
    let l = game.s.upgrades[key];
    let total = 0;
    let n = 0;
    const want = mult === 'MAX' ? Infinity : mult;
    while (n < want && (def.max === undefined || l < def.max)) {
      const c = def.cost(l);
      if (mult === 'MAX' && total + c > game.s.gold && n > 0) break;
      total += c; l++; n++;
      if (mult === 'MAX' && total > game.s.gold) break;
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
      const p = plannedCost(key);
      r.desc.innerHTML = `${fmtValue(r.def, r.def.value(l))} → <b>${fmtValue(r.def, r.def.value(p.to))}</b>`;
      r.btn.textContent = `${fmt(p.total)}${p.n > 1 ? ` (+${p.n})` : ''}`;
      r.btn.disabled = game.s.gold < game.upgradeCost(key);
    }
  }
  return { root, update };
}

// ---------- 장비 ----------
function equipTab(app) {
  const { game } = app;
  const cards = {};
  const b1 = h('button', { class: 'btn primary', onclick: () => doGacha(1) });
  const b10 = h('button', { class: 'btn primary', onclick: () => doGacha(10) });
  const mergeBtn = h('button', { class: 'btn good', onclick: () => {
    const n = game.mergeAll();
    toast(n ? `합성 ${n}회 완료!` : `같은 등급 장비가 ${MERGE_COUNT}개 있어야 합성돼요`);
    app.refresh();
  } }, '⚒️ 모두 합성');

  const root = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, '장비 뽑기', h('small', {}, '가장 좋은 장비가 자동 장착돼요')),
      h('div', { class: 'btn-row' }, b1, b10),
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, mergeBtn),
      h('p', { class: 'muted', style: 'margin:8px 0 0' },
        `같은 등급 ${MERGE_COUNT}개 → 상위 등급 1개. 보유한 등급마다 보유 효과가 더해져요.`)));

  for (const [type, def] of Object.entries(EQUIP_TYPES)) {
    const grid = h('div', { class: 'grades' });
    const cells = GRADES.map((g, i) => {
      const cnt = h('span', { class: 'g-cnt' });
      const cell = h('div', { class: 'grade', style: `border-color:${g.color}` },
        h('span', { class: 'g-ico' }, def.icon), h('span', { style: `color:${g.color};font-weight:800` }, g.name), h('br'), cnt);
      grid.append(cell);
      return { cell, cnt, i };
    });
    const bonus = h('div', { class: 'equip-bonus' });
    cards[type] = { cells, bonus, def };
    root.append(h('div', { class: 'card' }, h('h3', {}, `${def.icon} ${def.name}`, h('small', {}, `${def.label} 증가`)), grid, bonus));
  }

  function doGacha(n) {
    const res = game.gacha(n);
    if (!res) return toast('💎 다이아가 부족해요');
    app.refresh();
    res.sort((a, b) => b.grade - a.grade);
    openModal((s) => {
      s.append(h('h2', {}, `뽑기 결과 (${n}회)`));
      const grid = h('div', { class: 'gacha-grid' });
      res.forEach((r, i) => grid.append(h('div', {
        class: 'gacha-item', style: `border-color:${GRADES[r.grade].color};animation-delay:${i * 0.05}s`,
      }, h('span', {}, EQUIP_TYPES[r.type].icon), h('small', { style: `color:${GRADES[r.grade].color}` }, GRADES[r.grade].name))));
      s.append(grid);
      const best = res[0];
      if (best.grade >= 3) s.append(h('p', { style: 'text-align:center' }, '✨ ', gradeChip(best.grade), ` ${EQUIP_TYPES[best.type].name} 획득!`));
      s.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: closeModal }, '닫기'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); doGacha(n); } }, `한 번 더 (💎${n === 10 ? GACHA10_COST : GACHA_COST * n})`)));
    });
  }

  function update() {
    b1.textContent = `1회 💎${GACHA_COST}`;
    b10.textContent = `10회 💎${GACHA10_COST}`;
    b1.disabled = game.s.gems < GACHA_COST;
    b10.disabled = game.s.gems < GACHA10_COST;
    for (const [type, c] of Object.entries(cards)) {
      const arr = game.s.equips[type];
      const best = game.bestGrade(type);
      for (const { cell, cnt, i } of c.cells) {
        cnt.textContent = arr[i];
        cell.classList.toggle('none', arr[i] === 0);
        cell.classList.toggle('best', i === best);
      }
      const own = arr.reduce((acc, n, g) => acc + (n > 0 ? c.def.own[g] : 0), 0);
      c.bonus.innerHTML = best < 0
        ? '아직 장비가 없어요'
        : `장착(${GRADES[best].name}) <b>+${pct(c.def.equip[best])}</b> · 보유 효과 <b>+${pct(own)}</b> → ${c.def.label} <b>×${(game.equipMult(type)).toFixed(2)}</b>`;
    }
  }
  return { root, update };
}

// ---------- 스킬 ----------
function skillTab(app) {
  const { game } = app;
  const rows = {};
  const autoBtn = h('button', { class: 'btn', onclick: () => { game.s.autoSkill = !game.s.autoSkill; app.refresh(); } });
  const root = h('div', {},
    h('div', { class: 'section-title' }, h('span', {}, '스킬은 스테이지를 깨면 열려요'), autoBtn));
  SKILLS.forEach((sk) => {
    const lv = h('small');
    const desc = h('div', { class: 'desc' });
    const btn = h('button', { class: 'buy gold-cost', onclick: () => { if (game.upgradeSkill(sk.id)) app.refresh(); } });
    rows[sk.id] = { lv, desc, btn };
    root.append(h('div', { class: 'row' },
      h('div', { class: 'ico' }, sk.icon),
      h('div', { class: 'info' }, h('div', { class: 'name' }, sk.name, lv), desc), btn));
  });
  function update() {
    autoBtn.textContent = game.s.autoSkill ? '자동 사용 ON' : '자동 사용 OFF';
    autoBtn.classList.toggle('good', game.s.autoSkill);
    for (const sk of SKILLS) {
      const r = rows[sk.id];
      const l = game.s.skills[sk.id];
      const unlocked = game.skillUnlocked(sk);
      r.lv.textContent = unlocked ? `Lv.${l}` : `STAGE ${sk.unlock} 해금`;
      r.desc.innerHTML = `${escapeHtml(sk.desc(sk.mult(l)))} · 쿨타임 ${sk.cd}초<br>다음 레벨: <b>${escapeHtml(sk.desc(sk.mult(l + 1)))}</b>`;
      r.btn.textContent = fmt(game.skillUpgradeCost(sk.id));
      r.btn.disabled = !unlocked || game.s.gold < game.skillUpgradeCost(sk.id);
    }
  }
  return { root, update };
}

// ---------- 랭킹 ----------
function rankTab(app) {
  const { net } = app;
  const list = h('div');
  const status = h('p', { class: 'muted' });
  const refreshBtn = h('button', { class: 'btn', onclick: () => load() }, '🔄 새로고침');
  const root = h('div', {}, h('div', { class: 'section-title' }, h('span', {}, '친구들 전투력 순위'), refreshBtn), status, list);
  let loadedAt = 0;

  async function load() {
    if (!net.online) {
      status.textContent = '인터넷에 연결되면 랭킹을 볼 수 있어요.';
      return;
    }
    refreshBtn.disabled = true;
    status.textContent = '불러오는 중…';
    try {
      await net.pushProfile(true);
      const rows = await net.ranking();
      loadedAt = Date.now();
      status.textContent = rows.length ? '이름을 누르면 캐릭터를 구경할 수 있어요.' : '아직 아무도 없어요.';
      list.replaceChildren(...rows.map((p, i) => h('div', {
        class: `row rank-row${p.uid === net.uid ? ' me' : ''}`, onclick: () => showProfile(app, p),
      },
      h('div', { class: 'rank-no' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, p.nickname, p.guildName ? h('small', {}, `🏰 ${p.guildName}`) : null),
        h('div', { class: 'desc' }, `STAGE ${p.maxStage} · ${ago(p.updatedAt?.toMillis?.())}`)),
      h('div', { style: 'font-weight:900;color:#fde68a' }, fmt(p.power)))));
    } catch (err) {
      status.textContent = `랭킹을 불러오지 못했어요: ${err.message}`;
    } finally {
      refreshBtn.disabled = false;
    }
  }
  return {
    root,
    update() {},
    shown() { if (Date.now() - loadedAt > 30000) load(); },
    netChanged(what) { if (what === 'status') load(); },
  };
}

export function showProfile(app, p) {
  openModal((s) => {
    s.append(h('h2', {}, `${p.nickname}`, p.uid === app.net.uid ? h('small', { class: 'muted' }, ' (나)') : null));
    s.append(h('p', { class: 'muted' }, `${p.guildName ? `🏰 ${p.guildName} · ` : ''}마지막 접속 ${ago(p.updatedAt?.toMillis?.()) || '-'}`));
    s.append(h('div', { class: 'stat-grid' },
      h('div', {}, '전투력', h('b', { style: 'color:#fde68a' }, fmt(p.power))),
      h('div', {}, '최고 스테이지', h('b', {}, `STAGE ${p.maxStage}`)),
      h('div', {}, '공격력', h('b', {}, fmt(p.atk))),
      h('div', {}, '체력', h('b', {}, fmt(p.hp))),
      h('div', {}, '초당 피해', h('b', {}, fmt(p.dps)))));
    const eq = h('div', { class: 'stat-grid' });
    for (const [type, def] of Object.entries(EQUIP_TYPES)) {
      const g = p.best?.[type] ?? -1;
      eq.append(h('div', {}, `${def.icon} ${def.name}`, g >= 0 ? h('b', { style: `color:${GRADES[g].color}` }, GRADES[g].name) : h('b', { class: 'muted' }, '없음')));
    }
    s.append(h('div', { class: 'section-title' }, '장비'), eq);
    s.append(h('div', { class: 'section-title' }, '스킬'),
      h('div', { class: 'members' }, ...SKILLS.map((sk) => h('span', { class: 'chip' }, `${sk.icon} Lv.${p.skills?.[sk.id] ?? 1}`))));
    s.append(h('div', { class: 'btn-row', style: 'margin-top:14px' }, h('button', { class: 'btn', onclick: closeModal }, '닫기')));
  });
}

// ---------- 길드 ----------
function guildTab(app) {
  const { game, net } = app;
  const root = h('div');
  let view = null;
  let chatBox = null;
  let renderedMsgs = '';

  function render() {
    root.replaceChildren();
    chatBox = null;
    renderedMsgs = '';
    if (!net.online) {
      view = 'offline';
      root.append(h('div', { class: 'card' },
        h('h3', {}, '🏰 길드'),
        h('p', { class: 'muted' }, net.status === 'connecting' ? '서버에 연결하는 중이에요…' : '인터넷에 연결되면 길드·레이드·채팅을 할 수 있어요.'),
        net.status === 'offline' ? h('button', { class: 'btn primary', onclick: () => { net.status = 'connecting'; render(); net.init(); } }, '다시 연결') : null));
      return;
    }
    if (!game.s.guildId || !net.guild) {
      view = game.s.guildId ? 'loading' : 'none';
      if (view === 'loading') { root.append(h('p', { class: 'muted' }, '길드 정보를 불러오는 중…')); return; }
      const nameIn = h('input', { class: 'field', maxlength: 16, placeholder: '길드 이름 (예: 우리끼리)' });
      const codeIn = h('input', { class: 'field', maxlength: 6, placeholder: '친구에게 받은 6자리 코드', style: 'text-transform:uppercase' });
      const busy = (btn, fn) => async () => {
        btn.disabled = true;
        try { await fn(); } catch (err) { toast(err.message || '실패했어요'); } finally { btn.disabled = false; }
      };
      const createBtn = h('button', { class: 'btn primary' }, '길드 만들기');
      createBtn.onclick = busy(createBtn, async () => {
        const name = nameIn.value.trim();
        if (name.length < 2) throw new Error('길드 이름은 2글자 이상이에요');
        await net.createGuild(name);
        toast('길드를 만들었어요! 코드를 친구들에게 보내 주세요');
      });
      const joinBtn = h('button', { class: 'btn good' }, '가입하기');
      joinBtn.onclick = busy(joinBtn, async () => {
        if (codeIn.value.trim().length !== 6) throw new Error('코드는 6자리예요');
        await net.joinGuild(codeIn.value);
        toast('길드에 가입했어요!');
      });
      root.append(
        h('div', { class: 'card' }, h('h3', {}, '🏰 새 길드'),
          h('p', { class: 'muted' }, '한 명이 길드를 만들고, 나온 코드를 친구들에게 보내 주세요.'),
          h('div', { class: 'chat-input' }, nameIn, createBtn)),
        h('div', { class: 'card' }, h('h3', {}, '🤝 코드로 가입'),
          h('div', { class: 'chat-input' }, codeIn, joinBtn)));
      return;
    }
    view = 'guild';
    root.append(infoCard(), raidCard(), chatCard());
    update();
  }

  // 길드 정보
  let infoEls;
  function infoCard() {
    const lvl = h('small');
    const bar = h('div', { class: 'bar' }, h('div'), h('span'));
    const buff = h('p', { class: 'muted', style: 'margin:4px 0' });
    const members = h('div', { class: 'members' });
    const checkBtn = h('button', { class: 'btn good' });
    checkBtn.onclick = async () => {
      checkBtn.disabled = true;
      try { if (await net.checkin()) toast(`출석 완료! 길드 경험치 +${GUILD_CHECKIN_EXP}`); } catch (err) { toast(err.message); }
    };
    const donateBtn = h('button', { class: 'btn primary' }, `기부 💎${GUILD_DONATE_GEMS}`);
    donateBtn.onclick = async () => {
      donateBtn.disabled = true;
      try { if (await net.donate()) { toast(`기부 완료! 길드 경험치 +${GUILD_DONATE_EXP}`); app.refresh(); } } catch (err) { toast(err.message); }
      donateBtn.disabled = false;
    };
    const code = h('b', { style: 'letter-spacing:2px;color:#fde68a' });
    const share = h('button', { class: 'btn', style: 'padding:6px 10px' }, '복사');
    share.onclick = async () => {
      const text = `우리끼리 키우기 길드 "${net.guild.name}" 가입 코드: ${net.guild.code}\n${location.origin}${location.pathname}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); toast('코드를 복사했어요'); }
      } catch { /* 공유 취소 */ }
    };
    const leave = h('button', { class: 'btn danger', style: 'padding:6px 10px' }, '탈퇴');
    leave.onclick = () => openModal((s) => {
      s.append(h('h2', {}, '길드를 떠날까요?'), h('p', { class: 'muted' }, '길드 버프가 사라지고, 다시 코드로 가입할 수 있어요.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: closeModal }, '취소'),
          h('button', { class: 'btn danger', onclick: async () => { closeModal(); await net.leaveGuild().catch((e) => toast(e.message)); } }, '탈퇴')));
    });
    const title = h('span');
    infoEls = { lvl, bar, buff, members, checkBtn, code, title };
    return h('div', { class: 'card' },
      h('h3', {}, title, lvl),
      bar, buff,
      h('div', { class: 'members', style: 'margin:8px 0' }, '코드 ', code, share, leave),
      members,
      h('div', { class: 'btn-row', style: 'margin-top:10px' }, checkBtn, donateBtn));
  }

  // 레이드
  let raidEls;
  function raidCard() {
    const body = h('div');
    raidEls = { body, sig: '' };
    return h('div', { class: 'card' }, h('h3', {}, '🐲 오늘의 길드 레이드', h('small', {}, '매일 0시 새 보스')), body);
  }

  function renderRaid() {
    const r = net.raid;
    const myDmg = r?.damage?.[net.uid] || 0;
    const tickets = game.s.daily.raidTickets;
    const sig = JSON.stringify([r?.total, r?.maxHp, r?.claimed?.[net.uid], tickets, game.mode, myDmg]);
    if (sig === raidEls.sig) return;
    raidEls.sig = sig;
    const { body } = raidEls;
    body.replaceChildren();
    const attackBtn = h('button', { class: 'btn primary' }, `⚔️ 공격하기 (도전 ${tickets}/${RAID_TICKETS})`);
    attackBtn.disabled = tickets <= 0 || game.mode === 'raid';
    attackBtn.onclick = () => app.startRaid(attackBtn);
    if (!r) {
      body.append(h('p', { class: 'muted' }, '아직 아무도 오늘의 보스를 깨우지 않았어요. 첫 공격으로 소환돼요. 길드원 모두의 피해를 합쳐서 잡는 보스예요.'), attackBtn);
      return;
    }
    const ratio = r.total / r.maxHp;
    body.append(h('div', { class: 'bar red' }, h('div', { style: `width:${Math.min(100, ratio * 100)}%` }),
      h('span', {}, `${fmt(Math.max(0, r.maxHp - r.total))} / ${fmt(r.maxHp)}`)));
    const killed = r.total >= r.maxHp;
    if (killed) {
      const reward = raidReward(game.s.maxStage);
      if (net.canClaimRaid()) {
        const claim = h('button', { class: 'btn good' }, `🎁 보상 받기 (💎${reward.gems} + 🪙${fmt(reward.gold)})`);
        claim.onclick = async () => {
          claim.disabled = true;
          try {
            const got = await net.claimRaid();
            if (got) { toast(`레이드 보상! 💎${got.gems} 🪙${fmt(got.gold)}`); app.refresh(); }
          } catch (err) { toast(err.message); claim.disabled = false; }
        };
        body.append(h('p', {}, '🎉 처치 완료!'), claim);
      } else {
        body.append(h('p', { class: 'muted' }, r.claimed?.[net.uid] ? '🎉 처치 완료! 보상을 받았어요. 내일 또 만나요.' : '🎉 처치 완료! 오늘 공격하지 않아서 보상은 없어요.'));
      }
    } else {
      body.append(attackBtn);
    }
    const contrib = Object.entries(r.damage || {}).sort((a, b) => b[1] - a[1]);
    if (contrib.length) {
      const grid = h('div', { class: 'contrib' });
      contrib.forEach(([uid, dmg], i) => grid.append(
        h('span', {}, `${i + 1}. ${r.names?.[uid] || '?'}${uid === net.uid ? ' (나)' : ''}`),
        h('b', {}, `${fmt(dmg)} (${pct(dmg / r.maxHp)})`)));
      body.append(h('div', { class: 'section-title', style: 'margin-top:10px' }, '기여도'), grid);
    }
  }

  // 채팅
  function chatCard() {
    chatBox = h('div', { class: 'chat' });
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
    return h('div', { class: 'card' }, h('h3', {}, '💬 길드 채팅'), chatBox, h('div', { class: 'chat-input' }, input, send));
  }

  function renderChat() {
    if (!chatBox) return;
    const sig = net.messages.map((m) => m.id).join(',');
    if (sig === renderedMsgs) return;
    renderedMsgs = sig;
    const nearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 60;
    chatBox.replaceChildren(...(net.messages.length ? net.messages.map((m) => {
      const t = m.createdAt?.toDate ? m.createdAt.toDate() : null;
      const time = t ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
      if (m.type === 'system') return h('div', { class: 'msg system' }, m.text, h('time', {}, time));
      return h('div', { class: `msg${m.uid === net.uid ? ' mine' : ''}` }, h('span', { class: 'who' }, m.name), m.text, h('time', {}, time));
    }) : [h('div', { class: 'muted' }, '첫 메시지를 남겨 보세요 👋')]));
    if (nearBottom || renderedMsgs.split(',').length <= 1) chatBox.scrollTop = chatBox.scrollHeight;
  }

  function update() {
    if (view !== 'guild' || !net.guild) return;
    const gd = net.guild;
    const lv = guildLevel(gd.exp);
    const into = (gd.exp || 0) % 200;
    infoEls.title.textContent = `🏰 ${gd.name}`;
    infoEls.lvl.textContent = `Lv.${lv}${lv >= 20 ? ' (최대)' : ''}`;
    infoEls.bar.firstChild.style.width = `${lv >= 20 ? 100 : (into / 200) * 100}%`;
    infoEls.bar.lastChild.textContent = lv >= 20 ? 'MAX' : `${into} / 200`;
    infoEls.buff.textContent = `길드 버프: 전원 공격력 +${pct(guildAtkBonus(gd.exp))} · 인원 ${gd.memberIds.length}/${GUILD_MAX}`;
    infoEls.code.textContent = gd.code;
    const names = Object.entries(gd.members || {});
    const membersSig = names.map(([u, n]) => u + n + (gd.checkins?.[u] || '')).join('|');
    if (infoEls.members.dataset.sig !== membersSig) {
      infoEls.members.dataset.sig = membersSig;
      const today = dayKey();
      infoEls.members.replaceChildren(...names.map(([uid, name]) => h('span', {
        class: `chip${gd.checkins?.[uid] === today ? ' on' : ''}`, style: 'cursor:pointer',
        onclick: async () => { const p = await net.player(uid).catch(() => null); if (p) showProfile(app, p); },
      }, `${uid === gd.owner ? '👑 ' : ''}${name}${uid === net.uid ? ' (나)' : ''}`)));
    }
    const checked = net.checkedInToday();
    infoEls.checkBtn.textContent = checked ? '✅ 오늘 출석함' : `📅 출석 (+${GUILD_CHECKIN_EXP})`;
    infoEls.checkBtn.disabled = checked;
    renderRaid();
    renderChat();
  }

  return {
    root,
    update,
    shown() { render(); },
    netChanged(what) {
      const want = !net.online ? 'offline' : !game.s.guildId ? 'none' : net.guild ? 'guild' : 'loading';
      if (want !== view || what === 'status') render();
      else update();
    },
  };
}

export const TABS = { upgrade: upgradeTab, equip: equipTab, skill: skillTab, rank: rankTab, guild: guildTab };
