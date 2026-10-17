// 던전 탭
import { DUNGEONS, DUNGEON_KEYS, DUNGEON_TIME, DUNGEON_MOBS, dungeonReward } from '../data.js';
import { h, rewardText } from './common.js';

export function dungeonTab(app) {
  const { game } = app;
  const cards = {};
  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 10px' },
      `던전마다 하루 ${DUNGEON_KEYS}번. ${DUNGEON_TIME}초 안에 몬스터 ${DUNGEON_MOBS}마리와 보스를 잡으면 클리어, 다음 단계가 열려요. 실패하면 열쇠는 그대로예요. 깬 단계는 "소탕"으로 바로 보상을 받을 수 있어요.`));

  for (const d of DUNGEONS) {
    const lvl = h('small');
    const info = h('div', { class: 'desc' });
    const go = h('button', { class: 'btn primary', onclick: () => app.startDungeon(d.id) });
    const sweep = h('button', { class: 'btn', onclick: () => app.sweepDungeon(d.id) });
    const card = h('div', { class: 'card dungeon-card' },
      h('div', { style: 'display:flex;gap:12px;align-items:center' },
        h('div', { class: 'dg-ico' }, d.icon),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'name', style: 'font-weight:900;font-size:15px' }, d.name, ' ', lvl), info)),
      h('div', { class: 'btn-row', style: 'margin-top:10px' }, sweep, go));
    cards[d.id] = { card, lvl, info, go, sweep };
    root.append(card);
  }

  function update() {
    for (const d of DUNGEONS) {
      const c = cards[d.id];
      const unlocked = game.dungeonUnlocked(d);
      const best = game.s.dungeons[d.id] || 0;
      const keys = game.s.daily.keys[d.id];
      c.card.style.opacity = unlocked ? '' : '0.5';
      c.lvl.textContent = unlocked ? `· 열쇠 ${keys}/${DUNGEON_KEYS}` : `· STAGE ${d.unlock} 해금`;
      c.info.innerHTML = `보상: ${d.reward} · 최고 <b>${best}단계</b><br>다음 ${best + 1}단계 보상 ${rewardText(dungeonReward(d.id, best + 1))}`;
      c.go.textContent = `⚔️ ${best + 1}단계 도전`;
      c.go.disabled = !unlocked || keys <= 0 || game.mode !== 'stage';
      c.sweep.textContent = best ? `⚡ 소탕 (${best}단계)` : '소탕 (클리어 후)';
      c.sweep.disabled = !unlocked || !best || keys <= 0 || game.mode !== 'stage';
    }
  }
  return { root, update };
}
