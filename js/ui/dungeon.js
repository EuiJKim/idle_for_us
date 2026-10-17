// 수련터 탭
import { DUNGEONS, DUNGEON_KEYS, DUNGEON_TIME, DUNGEON_MOBS, dungeonReward,
  DUNGEON_KEY_CAP, nextDungeonTier, DUNGEON_TIER_MULT } from '../data.js';
import { h, rewardText } from './common.js';

export function dungeonTab(app) {
  const { game } = app;
  const cards = {};
  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 10px' },
      `열쇠는 하루 ${DUNGEON_KEYS}개씩 들어오고 ${DUNGEON_KEY_CAP}개까지 쌓여요. `
      + `${DUNGEON_TIME}초 안에 적 ${DUNGEON_MOBS}마리와 두목을 잡으면 다음 단계가 열려요. 실패해도 열쇠는 그대로예요.`),
    h('p', { class: 'muted', style: 'margin:0 2px 10px' },
      `소탕은 내가 깬 최고 단계 보상을 줘요. 보상은 ${DUNGEON_TIER_MULT}배씩 뛰는 구간이 있으니, `
      + '구간을 넘긴 뒤에 몰아서 소탕하는 쪽이 이득이에요.'));

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
      c.lvl.textContent = unlocked ? `· 열쇠 ${keys}/${DUNGEON_KEY_CAP}` : `· 관문 ${d.unlock} 해금`;
      c.lvl.classList.toggle('full', keys >= DUNGEON_KEY_CAP);
      const tier = nextDungeonTier(best);
      const tierLine = tier
        ? `<br><span class="tier-hint">${tier}단계를 깨면 보상 ×${DUNGEON_TIER_MULT} — ${tier - best}단계 남음</span>`
        : '<br><span class="tier-hint">마지막 구간까지 돌파했어요</span>';
      c.info.innerHTML = `보상: ${d.reward} · 최고 <b>${best}단계</b><br>다음 ${best + 1}단계 보상 ${rewardText(dungeonReward(d.id, best + 1))}${tierLine}`;
      c.go.textContent = `⚔️ ${best + 1}단계 도전`;
      c.go.disabled = !unlocked || keys <= 0 || game.mode !== 'stage';
      c.sweep.textContent = best ? `⚡ 소탕 (${best}단계)` : '소탕 (클리어 후)';
      c.sweep.disabled = !unlocked || !best || keys <= 0 || game.mode !== 'stage';
    }
  }
  return { root, update };
}
