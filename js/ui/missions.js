// 일일 미션 / 업적 모달
import { MISSIONS, MISSION_ALL_REWARD, STAGE_MILESTONE_EVERY, stageMilestone } from '../data.js';
import { h, toast, openModal, closeModal, rewardText } from './common.js';

export function openMissions(app) {
  const { game } = app;
  openModal((s) => {
    const body = h('div');
    s.append(h('h2', {}, '📜 일일 미션'), h('p', { class: 'muted', style: 'margin-top:0' }, '매일 0시(한국 시간)에 초기화돼요.'), body,
      h('button', { class: 'btn', style: 'width:100%;margin-top:10px', onclick: closeModal }, '닫기'));
    const render = () => {
      body.replaceChildren();
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
          h('div', { class: 'name' }, `STAGE ${next} 도달`), h('div', { class: 'desc' }, `${STAGE_MILESTONE_EVERY}스테이지마다 ${rewardText(stageMilestone())}`)), msBtn));
    };
    render();
  });
}
