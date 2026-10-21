// 친구 탭: 서열 / 비무대 / 문파
import {
  GRADES, EQUIP_TYPES, SKILLS, RANKS, PETS, RAID_TICKETS, PVP_TICKETS,
  guildLevel, guildAtkBonus, GUILD_DONATE_GEMS, GUILD_DONATE_EXP, GUILD_CHECKIN_EXP, GUILD_MAX, raidReward,
  SHADOW_TIERS, SHADOW_TRY_CAP, nextShadowTier, shadowStage, shadowTierName,
  ACC_SLOTS,
} from '../data.js';
import { fmt, pct, ago } from '../fmt.js';
import { dayKey } from '../game.js';
import { h, toast, openModal, closeModal, subTabs, rewardText, loopBtn } from './common.js';

const lastSeen = (p) => ago(p.updatedAt?.toMillis?.());

function playerList(app, { sortKey, valueLabel, empty, onPick, action }) {
  const { net } = app;
  const list = h('div');
  const status = h('p', { class: 'muted' });
  const refreshBtn = h('button', { class: 'btn', style: 'padding:6px 10px' }, '🔄 새로고침');
  let loadedAt = 0;
  async function load() {
    if (!net.online) { status.textContent = '인터넷에 연결되면 볼 수 있어요.'; return; }
    refreshBtn.disabled = true;
    status.textContent = '불러오는 중…';
    try {
      await net.pushProfile(true);
      const rows = (await net.ranking()).sort((a, b) => sortKey(b) - sortKey(a));
      loadedAt = Date.now();
      status.textContent = rows.length ? empty.hint : empty.none;
      list.replaceChildren(...rows.map((p, i) => h('div', {
        class: `row rank-row${p.uid === net.uid ? ' me' : ''}`, onclick: () => onPick(p),
      },
      h('div', { class: 'rank-no' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, p.nickname, h('small', {}, `${RANKS[p.rank || 0]?.name || ''}${p.guildName ? ` · 🏰 ${p.guildName}` : ''}`)),
        h('div', { class: 'desc' }, `Lv.${p.level || 1} · ${p.maxStage}관문${p.regress ? ` · ${p.regress + 1}회차` : ''} · ${lastSeen(p)}`)),
      h('div', { style: 'text-align:right' },
        h('div', { style: 'font-weight:900;color:#fde68a' }, valueLabel(p)),
        action && p.uid !== net.uid ? action(p) : null))));
    } catch (err) {
      // 권한이 막힌 경우는 '인터넷이 느린 것'이 아니라 서버 설정 문제다.
      // 영어 오류를 그대로 보여주면 플레이어는 뭘 해야 할지 모른다.
      status.textContent = net.denied(err)
        ? '서버가 닫혀 있어요. 잠시 뒤에 다시 열릴 거예요.'
        : `불러오지 못했어요: ${err.message}`;
    } finally {
      refreshBtn.disabled = false;
    }
  }
  refreshBtn.onclick = load;
  return { list, status, refreshBtn, load, stale: () => Date.now() - loadedAt > 30000 };
}

function rankView(app) {
  const pl = playerList(app, {
    sortKey: (p) => p.power || 0,
    valueLabel: (p) => fmt(p.power),
    empty: { hint: '이름을 누르면 캐릭터를 구경할 수 있어요.', none: '아직 아무도 없어요.' },
    onPick: (p) => showProfile(app, p),
  });
  const root = h('div', {}, h('div', { class: 'section-title' }, h('span', {}, '전투력 순위'), pl.refreshBtn), pl.status, pl.list);
  return { root, update() {}, shown() { if (pl.stale()) pl.load(); }, netChanged(w) { if (w === 'status') pl.load(); } };
}

function pvpView(app) {
  const { game } = app;
  const score = h('b', { style: 'font-size:20px;color:#fde68a' });
  const record = h('div', { class: 'muted' });
  const tickets = h('b');
  const pl = playerList(app, {
    sortKey: (p) => p.pvp?.score ?? 1000,
    valueLabel: (p) => `${p.pvp?.score ?? 1000}점`,
    empty: { hint: '친구를 골라 비무하세요. 상대가 접속하지 않아도 돼요.', none: '아직 상대가 없어요.' },
    onPick: (p) => showProfile(app, p),
    action: (p) => h('button', { class: 'btn primary', style: 'padding:5px 10px;margin-top:4px;font-size:12px', onclick: (e) => { e.stopPropagation(); app.startPvp(p); } }, '⚔️ 비무'),
  });
  const root = h('div', {},
    h('div', { class: 'card', style: 'text-align:center' },
      h('div', { class: 'muted' }, '내 비무 점수'), score, record,
      h('p', { class: 'muted', style: 'margin:6px 0 0' }, '오늘 남은 비무 ', tickets, ` / ${PVP_TICKETS} · 이기면 +20점 원보 50, 지면 -8점 원보 10`)),
    h('div', { class: 'section-title' }, h('span', {}, '비무 순위'), pl.refreshBtn), pl.status, pl.list);
  function update() {
    score.textContent = game.s.pvp.score;
    record.textContent = `${game.s.pvp.wins}승 ${game.s.pvp.losses}패`;
    tickets.textContent = game.s.daily.pvpTickets;
  }
  return { root, update, shown() { if (pl.stale()) pl.load(); }, netChanged(w) { if (w === 'status' || w === 'pvp') pl.load(); } };
}

export function showProfile(app, p) {
  openModal((s) => {
    const rank = RANKS[p.rank || 0];
    s.append(h('h2', {}, `${p.nickname}`, p.uid === app.net.uid ? h('small', { class: 'muted' }, ' (나)') : null));
    s.append(h('p', { class: 'muted' }, `${rank.name} · Lv.${p.level || 1}${p.guildName ? ` · 🏰 ${p.guildName}` : ''} · 접속 ${lastSeen(p) || '-'}`));
    s.append(h('div', { class: 'stat-grid' },
      h('div', {}, '전투력', h('b', { style: 'color:#fde68a' }, fmt(p.power))),
      h('div', {}, '현재 / 역대 관문', h('b', {}, `${p.maxStage} / ${p.bestStage || p.maxStage}`)),
      h('div', {}, '회귀', h('b', {}, `${p.regress || 0}회`)),
      h('div', {}, '공격력', h('b', {}, fmt(p.atk))),
      h('div', {}, '체력', h('b', {}, fmt(p.hp))),
      h('div', {}, '치명타', h('b', {}, `${pct(p.crit || 0)} / ${pct(p.critDmg || 1.5)}`)),
      h('div', {}, '비무 점수', h('b', {}, `${p.pvp?.score ?? 1000}점`))));
    const eq = h('div', { class: 'stat-grid' });
    for (const [type, def] of Object.entries(EQUIP_TYPES)) {
      const g = p.best?.[type] ?? -1;
      eq.append(h('div', {}, `${def.icon} ${def.name} +${p.enhance?.[type] || 0}`, g >= 0 ? h('b', { style: `color:${GRADES[g].color}` }, GRADES[g].name) : h('b', { class: 'muted' }, '없음')));
    }
    const pet = PETS.find((x) => x.id === p.pet);
    eq.append(h('div', {}, '🐾 영수', h('b', {}, pet ? `${pet.emoji} ${pet.name} Lv.${p.petLv || 1}` : '없음')));
    s.append(h('div', { class: 'section-title' }, '병기 · 영수'), eq);
    s.append(h('div', { class: 'section-title' }, '장착 무공'),
      h('div', { class: 'members' }, ...(p.skillSlots || []).filter(Boolean).map((id) => {
        const sk = SKILLS.find((x) => x.id === id);
        return sk ? h('span', { class: 'chip' }, `${sk.icon} ${sk.name} Lv.${p.skills?.[id] ?? 1}`) : null;
      })));
    const btns = h('div', { class: 'btn-row', style: 'margin-top:14px' }, h('button', { class: 'btn', onclick: closeModal }, '닫기'));
    if (p.uid !== app.net.uid) btns.append(h('button', { class: 'btn primary', onclick: () => { closeModal(); app.startPvp(p); } }, '⚔️ 비무'));
    s.append(btns);
  });
}

// ---------- 문파 ----------
function guildView(app) {
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
      // **막힌 것과 끊긴 것은 다르다.** 전에는 둘 다 "인터넷에 연결되면"이라고
      // 적었는데, 서버가 거부하는 경우에는 거짓말이다 — 인터넷은 멀쩡하다.
      // 친구들이 자기 연결을 탓하게 된다. 다시 눌러도 될 리가 없고.
      if (net.blocked) {
        root.append(h('div', { class: 'card' },
          h('h3', {}, '🏰 문파'),
          h('p', {}, '서버가 요청을 거부하고 있어요. ', h('b', {}, '인터넷 문제가 아니에요.')),
          h('p', { class: 'muted' },
            'Firestore 보안 규칙이 아직 안 올라갔어요. 만든 사람이 한 번만 올리면 바로 열려요 — ',
            h('b', {}, '저장소의 firestore.rules'), '를 Firebase 콘솔 → Firestore Database → 규칙에 붙여넣고 게시하면 돼요.')));
        return;
      }
      root.append(h('div', { class: 'card' },
        h('h3', {}, '🏰 문파'),
        h('p', { class: 'muted' }, net.status === 'connecting' ? '서버에 연결하는 중이에요…' : '인터넷에 연결되면 문파·토벌·채팅을 할 수 있어요.'),
        net.status === 'offline' ? h('button', { class: 'btn primary', onclick: () => { net.status = 'connecting'; render(); net.init(); } }, '다시 연결') : null));
      return;
    }
    if (!game.s.guildId || !net.guild) {
      view = game.s.guildId ? 'loading' : 'none';
      if (view === 'loading') { root.append(h('p', { class: 'muted' }, '문파 정보를 불러오는 중…')); return; }
      const nameIn = h('input', { class: 'field', maxlength: 16, placeholder: '문파 이름 (예: 우리끼리)' });
      const codeIn = h('input', { class: 'field', maxlength: 6, placeholder: '친구에게 받은 6자리 코드', style: 'text-transform:uppercase' });
      const busy = (btn, fn) => async () => {
        btn.disabled = true;
        try { await fn(); } catch (err) { toast(err.message || '실패했어요'); } finally { btn.disabled = false; }
      };
      const createBtn = h('button', { class: 'btn primary' }, '문파 만들기');
      createBtn.onclick = busy(createBtn, async () => {
        const name = nameIn.value.trim();
        if (name.length < 2) throw new Error('문파 이름은 2글자 이상이에요');
        await net.createGuild(name);
        toast('문파를 만들었어요! 코드를 친구들에게 보내 주세요');
      });
      const joinBtn = h('button', { class: 'btn good' }, '가입하기');
      joinBtn.onclick = busy(joinBtn, async () => {
        if (codeIn.value.trim().length !== 6) throw new Error('코드는 6자리예요');
        await net.joinGuild(codeIn.value);
        toast('문파에 가입했어요!');
      });
      root.append(
        h('div', { class: 'card' }, h('h3', {}, '🏰 새 문파'),
          h('p', { class: 'muted' }, '한 명이 문파를 만들고, 나온 코드를 친구들에게 보내 주세요.'),
          h('div', { class: 'chat-input' }, nameIn, createBtn)),
        h('div', { class: 'card' }, h('h3', {}, '🤝 코드로 가입'),
          h('div', { class: 'chat-input' }, codeIn, joinBtn)));
      return;
    }
    view = 'guild';
    root.append(infoCard(), raidCard(), chatCard());
    update();
  }

  // 문파 정보
  let infoEls;
  function infoCard() {
    const lvl = h('small');
    const bar = h('div', { class: 'bar' }, h('div'), h('span'));
    const buff = h('p', { class: 'muted', style: 'margin:4px 0' });
    const members = h('div', { class: 'members' });
    const checkBtn = h('button', { class: 'btn good' });
    checkBtn.onclick = async () => {
      checkBtn.disabled = true;
      try { if (await net.checkin()) toast(`출석 완료! 문파 경험치 +${GUILD_CHECKIN_EXP}`); } catch (err) { toast(err.message); }
    };
    const donateBtn = h('button', { class: 'btn primary' }, `기부 원보 ${GUILD_DONATE_GEMS}`);
    donateBtn.onclick = async () => {
      donateBtn.disabled = true;
      try { if (await net.donate()) { toast(`기부 완료! 문파 경험치 +${GUILD_DONATE_EXP}`); app.refresh(); } } catch (err) { toast(err.message); }
      donateBtn.disabled = false;
    };
    const code = h('b', { style: 'letter-spacing:2px;color:#fde68a' });
    const share = h('button', { class: 'btn', style: 'padding:6px 10px' }, '복사');
    share.onclick = async () => {
      const text = `우리끼리 키우기 문파 "${net.guild.name}" 가입 코드: ${net.guild.code}\n${location.origin}${location.pathname}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); toast('코드를 복사했어요'); }
      } catch { /* 공유 취소 */ }
    };
    const leave = h('button', { class: 'btn danger', style: 'padding:6px 10px' }, '탈퇴');
    leave.onclick = () => openModal((s) => {
      s.append(h('h2', {}, '문파를 떠날까요?'), h('p', { class: 'muted' }, '문파 버프가 사라지고, 다시 코드로 가입할 수 있어요.'),
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

  // 토벌
  let raidEls;
  function raidCard() {
    const body = h('div');
    raidEls = { body, sig: '' };
    return h('div', { class: 'card' }, h('h3', {}, '🐲 오늘의 문파 토벌', h('small', {}, '매일 0시 새 두목')), body);
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
      body.append(h('p', { class: 'muted' }, '아직 아무도 오늘의 두목를 깨우지 않았어요. 첫 공격으로 소환돼요. 문파원 모두의 피해를 합쳐서 잡는 두목예요.'), attackBtn);
      return;
    }
    const ratio = r.total / r.maxHp;
    body.append(h('div', { class: 'bar red' }, h('div', { style: `width:${Math.min(100, ratio * 100)}%` }),
      h('span', {}, `${fmt(Math.max(0, r.maxHp - r.total))} / ${fmt(r.maxHp)}`)));
    const killed = r.total >= r.maxHp;
    if (killed) {
      const reward = raidReward(game.s.maxStage);
      if (net.canClaimRaid()) {
        const claim = h('button', { class: 'btn good' }, `🎁 보상 받기 (${rewardText(reward)})`);
        claim.onclick = async () => {
          claim.disabled = true;
          try {
            const got = await net.claimRaid();
            if (got) { toast(`토벌 보상! ${rewardText(got)}`); app.refresh(); }
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
    return h('div', { class: 'card' }, h('h3', {}, '💬 문파 채팅'), chatBox, h('div', { class: 'chat-input' }, input, send));
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
    infoEls.buff.textContent = `문파 버프: 전원 공격력 +${pct(guildAtkBonus(gd.exp))} · 인원 ${gd.memberIds.length}/${GUILD_MAX}`;
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



// ---------- 그림자 무림 ----------
// 주마다 티어가 초기화된다. 올라갈수록 상대가 되레 완만해진다.
// 근거: DoppelTierTable + 공략 "랭킹이 오를수록 난이도가 낮은 도플갱어가
// 등장할 확률이 높아지는 구조", "매주 티어가 초기화되어 월요일에 다시 받는다"
function shadowView(app) {
  const { game } = app;
  const head = h('div', { class: 'desc' });
  const tierWrap = h('div', {});
  const rows = SHADOW_TIERS.map((tier, i) => {
    const mark = h('span', { class: 'g-cnt' });
    const name = h('b');
    const rew = h('span', { class: 'desc' });
    const row = h('div', { class: 'row shadow-row' },
      h('div', { class: 'ico' }, mark),
      h('div', { style: 'flex:1;min-width:0' }, name, rew));
    tierWrap.append(row);
    return { row, mark, name, rew, tier, i };
  });
  const goBtn = h('button', { class: 'btn primary' });
  const shadowLoop = loopBtn(app, 'shadow');
  goBtn.addEventListener('click', () => {
    if (game.startShadow()) app.refresh();
    else toast('오늘 도전이 남아있지 않거나 다른 싸움 중이에요');
  });
  const claimBtn = h('button', { class: 'buy', style: 'width:100%;margin-top:8px' });
  claimBtn.addEventListener('click', () => {
    const got = game.claimShadowRewards();
    if (!got) return toast('아직 받을 보상이 없어요');
    toast('티어 보상을 받았어요');
    app.refresh();
    return undefined;
  });

  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      '내 그림자와 겨뤄요. 이길수록 티어가 오르고, 티어가 오를수록 상대가 되레 완만해져요. '
      + '월요일마다 처음부터 다시 시작해요.'),
    h('div', { class: 'card' }, head,
      h('div', { class: 'btn-row' }, goBtn, shadowLoop), claimBtn),
    h('div', { class: 'section-title', style: 'margin-top:12px' }, h('span', {}, '티어 보상')),
    tierWrap);

  function update() {
    const s = game.s.shadow || { wins: 0, tries: 0, taken: -1 };
    const cur = game.shadowTier();
    const nx = nextShadowTier(s.wins || 0);
    head.innerHTML = `이번 주 <b>${s.wins || 0}승</b> · 지금 <b style="color:var(--accent-2)">${shadowTierName(cur)}</b>`
      + (nx ? ` · ${nx.name}까지 ${nx.need - (s.wins || 0)}승` : ' · 끝까지 올랐어요')
      + `<br>남은 도전 ${s.tries || 0} / ${SHADOW_TRY_CAP} · 상대는 ${shadowStage(game.s.bestStage, s.wins || 0)}관문급`;
    goBtn.textContent = `그림자와 겨루기 (${s.tries || 0}회 남음)`;
    goBtn.disabled = !game.canShadow();
    shadowLoop.update();
    const ready = game.shadowRewardReady();
    claimBtn.textContent = ready ? '티어 보상 받기' : '받을 보상 없음';
    claimBtn.disabled = !ready;
    claimBtn.classList.toggle('ready', ready);
    for (const r of rows) {
      const reached = cur >= r.i;
      const taken = (s.taken ?? -1) >= r.i;
      r.row.style.opacity = reached ? '' : '0.5';
      r.mark.textContent = taken ? '받음' : reached ? '대기' : `${r.tier.need}승`;
      r.name.textContent = r.tier.name;
      r.rew.innerHTML = '<br>' + rewardText(r.tier.reward)
        + (r.tier.reward.accBox ? ` · 장신구 상자 ${r.tier.reward.accBox}` : '');
    }
  }
  return { root, update };
}


// ---------- 문파 창고 ----------
// 둘이 하는 게임이라 사고파는 시장이 설 수 없다. 대신 남는 것을 서로 넘긴다.
// 근거: 공략에서 피규어를 거래소에서 사 모으는 장면이 핵심이었다.
function stashView(app) {
  const { game } = app;
  const head = h('div', { class: 'desc' });
  const listEl = h('div', {});
  const putWrap = h('div', {});

  // 넣기: 부위·등급마다 버튼 하나
  const putRows = [];
  for (const [type, def] of Object.entries(EQUIP_TYPES)) {
    const row = h('div', { class: 'stash-put' });
    const cells = GRADES.map((g2, gi) => {
      const b = h('button', { class: 'buy', style: `font-size:11px;color:${g2.color}` });
      b.addEventListener('click', async () => {
        const net = app.net;
        if (!net?.online || !net.guild) return toast('문파에 들어가야 써요');
        const okd = await net.putEquip(type, gi);
        toast(okd ? `${def.name} ${g2.name}을 넣었어요` : '넣지 못했어요');
        app.refresh();
        return undefined;
      });
      row.append(b);
      return { b, gi };
    });
    putWrap.append(h('div', { class: 'section-title', style: 'margin:8px 2px 4px' }, h('span', {}, def.name)), row);
    putRows.push({ type, def, cells });
  }
  const accRows = [];
  for (const a of ACC_SLOTS) {
    const row = h('div', { class: 'stash-put' });
    const cells = GRADES.map((g2, gi) => {
      const b = h('button', { class: 'buy', style: `font-size:11px;color:${g2.color}` });
      b.addEventListener('click', async () => {
        const net = app.net;
        if (!net?.online || !net.guild) return toast('문파에 들어가야 써요');
        const okd = await net.putAcc(a.id, gi);
        toast(okd ? `${a.name} ${g2.name}을 넣었어요` : '넣지 못했어요');
        app.refresh();
        return undefined;
      });
      row.append(b);
      return { b, gi };
    });
    putWrap.append(h('div', { class: 'section-title', style: 'margin:8px 2px 4px' }, h('span', {}, a.name)), row);
    accRows.push({ slot: a.id, def: a, cells });
  }

  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      '남는 병기와 장신구를 문파에 넣어 두면 문파원이 꺼내 쓸 수 있어요. 넣은 것도 병기보에는 그대로 남아요.'),
    h('div', { class: 'card' }, h('h3', {}, '창고에 든 것'), head, listEl),
    h('div', { class: 'card' }, h('h3', {}, '넣기'), putWrap));

  function update() {
    const net = app.net;
    const on = !!(net?.online && net.guild);
    const items = (net?.stash) || [];
    head.textContent = !on ? '문파에 들어가면 쓸 수 있어요' : items.length ? `${items.length}개` : '아직 비어 있어요';
    listEl.replaceChildren(...items.slice(0, 30).map((it) => {
      const g2 = GRADES[it.grade] || GRADES[0];
      const what = it.kind === 'equip'
        ? (EQUIP_TYPES[it.type]?.name || it.type)
        : (ACC_SLOTS.find((a) => a.id === it.slot)?.name || it.slot);
      const take = h('button', { class: 'buy', style: 'font-size:11px' }, '꺼내기');
      take.addEventListener('click', async () => {
        const okd = await net.takeStash(it);
        toast(okd ? `${what} ${g2.name}을 꺼냈어요` : '누가 먼저 가져갔어요');
        app.refresh();
      });
      return h('div', { class: 'row' },
        h('div', { class: 'ico', style: `color:${g2.color}` }, g2.name.slice(0, 1)),
        h('div', { style: 'flex:1;min-width:0' },
          h('div', { class: 'name', style: 'font-weight:800' }, `${what} `, h('span', { style: `color:${g2.color}` }, g2.name)),
          h('div', { class: 'desc' }, `${it.name || '무명'}이 넣음`)),
        take);
    }));
    for (const r of putRows) {
      for (const c of r.cells) {
        const n = game.s.equips?.[r.type]?.[c.gi] || 0;
        c.b.textContent = `${GRADES[c.gi].name} ${n}`;
        c.b.disabled = !on || n <= 0;
      }
    }
    for (const r of accRows) {
      for (const c of r.cells) {
        const n = game.s.accBag?.[r.slot]?.[c.gi] || 0;
        c.b.textContent = `${GRADES[c.gi].name} ${n}`;
        c.b.disabled = !on || n <= 0;
      }
    }
  }
  return { root, update, netChanged: () => update() };
}

export function socialTab(app) {
  return subTabs([
    { key: 'rank', label: '서열', make: () => rankView(app) },
    { key: 'pvp', label: '비무대', make: () => pvpView(app) },
    { key: 'guild', label: '문파', make: () => guildView(app) },
    { key: 'shadow', label: '그림자', make: () => shadowView(app) },
    { key: 'stash', label: '창고', make: () => stashView(app) },
  ]);
}
