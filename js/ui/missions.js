// 일일 의뢰 / 업적 모달
import { MISSIONS, MISSION_ALL_REWARD, STAGE_MILESTONE_EVERY, stageMilestone,
  ATTEND_CYCLE, attendReward, BOOST_PER_DAY, BOOST_SEC, BOOST_MULT } from '../data.js';
import { h, toast, openModal, closeModal, rewardText } from './common.js';

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
      body.append(h('div', { class: 'card' },
        h('h3', {}, '⚡ 기연', h('small', {}, `${BOOST_SEC / 60}분 동안 공격력 ${BOOST_MULT}배`)),
        boostBtn));

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
