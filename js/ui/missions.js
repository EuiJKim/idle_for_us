// 일일 의뢰 / 업적 모달
import { MISSIONS, MISSION_ALL_REWARD, STAGE_MILESTONE_EVERY, stageMilestone,
  ATTEND_CYCLE, attendReward, BOOST_PER_DAY, BOOST_SEC, BOOST_MULT,
  NOADS_ATK, NOADS_HP, AD_BOOST_EXTRA, AD_OFFLINE_MULT } from '../data.js';
import { h, toast, openModal, closeModal, rewardText } from './common.js';
import { showAd } from '../ads.js';

export function openMissions(app) {
  const { game } = app;
  openModal((s) => {
    const body = h('div');
    s.append(h('h2', {}, '📜 일일 의뢰'), h('p', { class: 'muted', style: 'margin-top:0' }, '매일 0시(한국 시간)에 초기화돼요.'), body,
      h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '닫기'));
    const render = () => {
      body.replaceChildren();

      // 연공 일지(출석) — 7일 주기
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
      };
      body.append(h('div', { class: 'card' },
        h('h3', {}, '⚡ 기연', h('small', {}, `${BOOST_SEC / 60}분 동안 공격력 ${BOOST_MULT}배`)),
        boostBtn, adBtn));

      // ---------- 광고 제거 ----------
      const nf = game.s.noAds;
      const shop = app.net?.shop;
      const card = h('div', { class: 'card' },
        h('h3', {}, nf ? '✅ 광고 없음' : '🚫 광고 제거'),
        h('p', { class: 'desc' },
          `공격력 ×${NOADS_ATK} · 체력 ×${NOADS_HP} 영구 · 기연·방치 보상을 광고 없이 바로 받아요.`));
      if (nf) {
        card.append(h('p', { class: 'muted' }, '이미 켜져 있어요. 고맙습니다.'));
      } else {
        const idRow = h('p', { class: 'muted' },
          '신청 번호 ', h('b', { id: 'ad-uid' }, app.net?.uid ? app.net.uid.slice(0, 8) : '연결 중…'));
        const copy = h('button', { class: 'btn', onclick: () => {
          const u = app.net?.uid;
          if (!u) return toast('서버에 연결된 뒤에 눌러 주세요');
          navigator.clipboard?.writeText(u).then(() => toast('신청 번호를 복사했어요'))
            .catch(() => toast(u));
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
      const allBtn = h('button', { class: 'btn primary', style: 'width:100%' },
        game.s.daily.allClaimed ? '오늘 보너스 받음' : `🎁 모두 완료 보너스 ${rewardText(MISSION_ALL_REWARD)}`);
      allBtn.disabled = game.s.daily.allClaimed || !game.allMissionsClaimed();
      allBtn.onclick = () => { const r = game.claimAllBonus(); if (r) toast(rewardText(r)); app.refresh(); render(); };
      body.append(allBtn);

      const ready = game.milestonesReady();
      const next = (game.s.milestone + 1) * STAGE_MILESTONE_EVERY + 1;
      const msBtn = h('button', { class: `btn ${ready ? 'good' : ''}`, style: 'padding:6px 10px' }, ready ? `받기 (${ready})` : '진행 중');
      msBtn.disabled = !ready;
      msBtn.onclick = () => { const r = game.claimMilestone(); if (r) toast(rewardText(r)); app.refresh(); render(); };
      body.append(h('div', { class: 'section-title', style: 'margin-top:14px' }, '🏅 업적'),
        h('div', { class: 'row' }, h('div', { class: 'info' },
          h('div', { class: 'name' }, `관문 ${next} 도달`), h('div', { class: 'desc' }, `${STAGE_MILESTONE_EVERY}관문마다 ${rewardText(stageMilestone())}`)), msBtn));
    };
    render();
  });
}
