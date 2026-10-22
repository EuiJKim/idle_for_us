// 의뢰 모달 — 하위 탭 넷: 오늘 / 의뢰 / 업적 / 상점
//
// 전에는 연공 일지 → 기연 → 광고 제거 → 일일 의뢰 다섯 줄 → 모두 완료 →
// 업적이 한 창에 세로로 쌓여 있었다. 받을 게 있어서 열었는데 스크롤을 해야
// 찾았고, 광고 제거 안내가 매일 보는 의뢰 사이에 끼어 있었다.
import { MISSIONS, MISSION_ALL_REWARD, STAGE_MILESTONE_EVERY, stageMilestone,
  ATTEND_CYCLE, attendReward, BOOST_PER_DAY, BOOST_SEC, BOOST_MULT,
  NOADS_ATK, NOADS_HP } from '../data.js';
import { h, toast, openModal, closeModal, rewardText } from './common.js';
import { showAd } from '../ads.js';

// 어느 탭에 받을 게 있는지. **claimableCount()는 업적까지 합친 수**라
// 그대로 쓰면 업적이 준비됐을 뿐인데 의뢰 쪽에 점이 찍힌다.
const READY = {
  today: (g) => g.canAttend() || (g.boostLeft() > 0 && !(g.buffs.boost > 0)) || g.adBoostLeft() > 0,
  daily: (g) => MISSIONS.some((m) => { const st = g.missionState(m.id); return st.done && !st.claimed; })
    || (!g.s.daily.allClaimed && g.allMissionsClaimed()),
  badge: (g) => !!g.milestonesReady(),
  shop: () => false,
};

export function openMissions(app) {
  const { game } = app;
  // 받을 게 있는 쪽을 먼저 보여 준다. 열자마자 눌러 받는 게 보통이다.
  let cur = ['daily', 'badge', 'today'].find((k) => READY[k](game)) || 'daily';
  openModal((s) => {
    const body = h('div');
    const seg = h('div', { class: 'seg wide' });
    const TABS = [
      { key: 'today', label: '오늘' },
      { key: 'daily', label: '의뢰' },
      { key: 'badge', label: '업적' },
      { key: 'shop', label: '상점' },
    ];
    const segBtns = TABS.map((t) => {
      const b = h('button', { onclick: () => { cur = t.key; render(); } }, t.label);
      seg.append(b);
      return [t.key, b];
    });
    s.append(h('h2', {}, '📜 의뢰'),
      h('p', { class: 'muted', style: 'margin-top:0' }, '매일 0시(한국 시간)에 초기화돼요.'),
      h('div', { class: 'subtabs', style: 'position:static;padding:0 0 10px' }, seg),
      body,
      h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '닫기'));

    // ---------- 오늘: 연공 일지 · 기연 ----------
    function renderToday() {
      const today = game.attendDay();
      const days = h('div', { style: 'display:flex;gap:4px;margin:8px 0' });
      for (let d = 1; d <= ATTEND_CYCLE; d++) {
        const done = d < today || (d === today && !game.canAttend());
        days.append(h('div', {
          style: `flex:1;text-align:center;padding:6px 2px;border-radius:8px;font-size:11px;`
            + `background:${done ? '#2f4f3a' : d === today ? '#3b3426' : '#26262b'};`
            + `border:1px solid ${d === today ? '#d4a64a' : 'transparent'};`
            + `color:${done ? '#86efac' : '#d4d4d8'}`,
        }, h('div', { style: 'font-weight:700' }, `${d}일`), h('div', {}, done ? '✓' : d === ATTEND_CYCLE ? '큰 보상' : '')));
      }
      const attendBtn = h('button', { class: `btn ${game.canAttend() ? 'good' : ''}`, style: 'width:100%' },
        game.canAttend() ? `📖 ${today}일째 연공 받기 — ${rewardText(attendReward(today))}` : '오늘 연공은 마쳤어요');
      attendBtn.disabled = !game.canAttend();
      attendBtn.onclick = () => { const r = game.claimAttend(Date.now()); if (r) toast(rewardText(r.reward)); app.refresh(); render(); };
      body.append(h('div', { class: 'card' },
        h('h3', {}, '📖 연공 일지', h('small', {}, `${ATTEND_CYCLE}일마다 큰 보상`)),
        days, attendBtn,
        h('p', { class: 'muted', style: 'margin:8px 0 0' }, '하루라도 건너뛰면 처음부터 다시 쌓여요.')));

      // 기연 — 하루 몇 번 쓰는 공격력 버프
      const left = game.boostLeft();
      const on = (game.buffs.boost || 0) > 0;
      const boostBtn = h('button', { class: `btn ${left > 0 && !on ? 'primary' : ''}`, style: 'width:100%' },
        on ? `기연이 흐르는 중 — ${Math.ceil(game.buffs.boost / 60)}분 남음`
          : left > 0 ? `⚡ 기연 받기 (오늘 ${left}/${BOOST_PER_DAY}회)` : '오늘 기연을 다 썼어요');
      boostBtn.disabled = left <= 0 || on;
      boostBtn.onclick = () => { if (game.takeBoost()) { toast(`${BOOST_SEC / 60}분 동안 공격력 ${BOOST_MULT}배`); app.refresh(); render(); } };
      // 광고로 더 받는 기연. **공짜 횟수는 그대로 둔다** — 덤이다.
      const adLeft = game.adBoostLeft();
      const adBtn = h('button', { class: `btn ${adLeft > 0 && !on ? 'good' : ''}`, style: 'width:100%;margin-top:6px' },
        adLeft <= 0 ? '오늘 다 받았어요'
          : game.s.noAds ? `⚡ 기연 한 번 더 (광고 없이)` : `📺 광고 보고 기연 한 번 더`);
      adBtn.disabled = adLeft <= 0 || on;
      adBtn.onclick = async () => {
        adBtn.disabled = true;
        const ok = await showAd(game.s.noAds);
        if (!ok) { adBtn.disabled = false; return toast('끝까지 봐야 받을 수 있어요'); }
        if (game.takeAdBoost()) { toast(`${BOOST_SEC / 60}분 동안 공격력 ${BOOST_MULT}배`); app.refresh(); }
        render();
        return undefined;
      };
      body.append(h('div', { class: 'card' },
        h('h3', {}, '⚡ 기연', h('small', {}, `${BOOST_SEC / 60}분 동안 공격력 ${BOOST_MULT}배`)),
        boostBtn, adBtn));
    }

    // ---------- 의뢰: 일일 다섯 + 모두 완료 ----------
    function renderDaily() {
      for (const m of MISSIONS) {
        const st = game.missionState(m.id);
        const btn = h('button', { class: `btn ${st.done && !st.claimed ? 'good' : ''}`, style: 'padding:6px 10px;min-width:64px' },
          st.claimed ? '완료' : st.done ? '받기' : `${st.cur}/${st.goal}`);
        btn.disabled = !st.done || st.claimed;
        btn.onclick = () => { const r = game.claimMission(m.id); if (r) toast(rewardText(r)); app.refresh(); render(); };
        body.append(h('div', { class: 'row', style: st.claimed ? 'opacity:0.5' : '' },
          h('div', { class: 'info' }, h('div', { class: 'name' }, m.name), h('div', { class: 'desc' }, rewardText(m.reward)),
            h('div', { class: 'bar', style: 'height:6px;margin:6px 0 0' }, h('div', { style: `width:${(st.cur / st.goal) * 100}%` }))),
          btn));
      }
      const allBtn = h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px' },
        game.s.daily.allClaimed ? '오늘 보너스 받음' : `🎁 모두 완료 보너스 ${rewardText(MISSION_ALL_REWARD)}`);
      allBtn.disabled = game.s.daily.allClaimed || !game.allMissionsClaimed();
      allBtn.onclick = () => { const r = game.claimAllBonus(); if (r) toast(rewardText(r)); app.refresh(); render(); };
      body.append(allBtn);
    }

    // ---------- 업적 ----------
    function renderBadge() {
      const ready = game.milestonesReady();
      const next = (game.s.milestone + 1) * STAGE_MILESTONE_EVERY + 1;
      const msBtn = h('button', { class: `btn ${ready ? 'good' : ''}`, style: 'padding:6px 10px' }, ready ? `받기 (${ready})` : '진행 중');
      msBtn.disabled = !ready;
      msBtn.onclick = () => { const r = game.claimMilestone(); if (r) toast(rewardText(r)); app.refresh(); render(); };
      body.append(h('div', { class: 'row' }, h('div', { class: 'info' },
        h('div', { class: 'name' }, `관문 ${next} 도달`), h('div', { class: 'desc' }, `${STAGE_MILESTONE_EVERY}관문마다 ${rewardText(stageMilestone())}`)), msBtn));
    }

    // ---------- 상점: 광고 제거 ----------
    function renderShop() {
      const nf = game.s.noAds;
      const shop = app.net?.shop;
      const card = h('div', { class: 'card' },
        h('h3', {}, nf ? '✅ 광고 없음' : '🚫 광고 제거'),
        h('p', { class: 'desc' },
          `공격력 ×${NOADS_ATK} · 체력 ×${NOADS_HP} 영구 · 기연·방치 보상을 광고 없이 바로 받아요.`));
      if (nf) {
        card.append(h('p', { class: 'muted' }, '이미 켜져 있어요. 고맙습니다.'));
      } else {
        // **보이는 것과 쓰이는 것이 같아야 한다.** 앞 8자만 보여 주고 복사는
        // 28자를 하고 있었다 — 복사를 안 쓰고 보이는 대로 적어 보내면
        // 운영자가 만든 문서 ID가 안 맞아 영영 안 켜진다.
        const idRow = h('p', { class: 'muted' },
          '신청 번호', h('span', { class: 'uidbox' }, app.net?.uid || '서버에 연결되면 나와요'));
        const copy = h('button', { class: 'btn', onclick: () => {
          const u = app.net?.uid;
          if (!u) return toast('서버에 연결된 뒤에 눌러 주세요');
          navigator.clipboard?.writeText(u).then(() => toast('신청 번호를 복사했어요'))
            .catch(() => toast(u));
          return undefined;
        } }, '신청 번호 복사');
        // **append는 null을 "null" 글자로 넣는다.** h()는 걸러 주지만 append는
        // 아니다 — 화면에 null이 한 줄 찍혔다. 걸러서 넘긴다.
        card.append(...[
          h('p', {}, shop?.price ? h('b', {}, shop.price) : h('span', { class: 'muted' }, '값은 운영자에게 물어보세요')),
          h('p', { class: 'desc' }, shop?.bank || '계좌 정보가 아직 등록되지 않았어요.'),
          shop?.note ? h('p', { class: 'muted' }, shop.note) : null,
          idRow,
          h('p', { class: 'muted' }, '입금하고 이 번호를 운영자에게 보내면 켜 드려요. 켜지면 다음 접속 때 바로 적용돼요.'),
          h('div', { class: 'btn-row' }, copy),
        ].filter(Boolean));
      }
      body.append(card);
    }

    const MAKE = { today: renderToday, daily: renderDaily, badge: renderBadge, shop: renderShop };
    function render() {
      body.replaceChildren();
      segBtns.forEach(([k, b]) => {
        b.classList.toggle('on', k === cur);
        // 받을 게 있는 탭에 점을 찍는다. 창을 열어 놓고도 놓치던 것이다.
        const want = READY[k](game);
        const dot = b.querySelector('.dot');
        if (want && !dot) b.append(h('i', { class: 'dot' }));
        if (!want && dot) dot.remove();
      });
      MAKE[cur]();
    }
    render();
  });
}
