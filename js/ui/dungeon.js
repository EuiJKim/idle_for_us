// 수련터 탭
import { DUNGEONS, DUNGEON_KEYS, DUNGEON_TIME, DUNGEON_MOBS, dungeonReward,
  DUNGEON_KEY_CAP, nextDungeonTier, DUNGEON_TIER_MULT,
  MINE_OPEN_STAGE, MINE_DEPTH_MAX, MINE_HAND_MAX, MINE_CAP_HOURS,
  TOWER_OPEN_STAGE, TOWER_FLOOR_MAX, TOWER_TIME, towerStage, towerReward, TOWER_PER_FLOOR,
  SEEK_CAP, RIFT_TIME, HUNT_TIME, RIFT_OPEN_STAGE, HUNT_OPEN_STAGE,
  riftStage, huntStage, riftReward, huntReward } from '../data.js';
import { fmt, pct } from '../fmt.js';
import { iconSkin } from '../icons.js';
import { h, rewardText, toast, subTabs, loopBtn } from './common.js';

function dungeonView(app) {
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
    const loop = loopBtn(app, 'dungeon', d.id);
    const card = h('div', { class: 'card dungeon-card' },
      h('div', { style: 'display:flex;gap:12px;align-items:center' },
        (() => { const e = h('div', { class: 'dg-ico' }, d.icon); iconSkin(e, 'dg', DUNGEONS.indexOf(d)); return e; })(),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'name', style: 'font-weight:900;font-size:15px' }, d.name, ' ', lvl), info)),
      h('div', { class: 'btn-row', style: 'margin-top:10px' }, sweep, go, loop));
    cards[d.id] = { card, lvl, info, go, sweep, loop };
    root.append(card);
  }

  function update() {
    for (const d of DUNGEONS) {
      const c = cards[d.id];
      const unlocked = game.dungeonUnlocked(d);
      const best = game.s.dungeons[d.id] || 0;
      const keys = game.s.daily.keys[d.id];
      c.card.style.opacity = unlocked ? '' : '0.5';
      c.loop.update();
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
  return { root, update, res: ['stones', 'food'] };
}

// ---------- 한철 광맥 ----------
// 싸우지 않는 동안에도 쌓인다. 쌓인 건 상한까지만.
// 근거: MineTable / MinerTable — 광맥을 키우고 캐는 사람을 따로 붙인다.
function mineView(app) {
  const { game } = app;
  const head = h('div', { class: 'desc' });
  const heldEl = h('div', { style: 'font-weight:900;font-size:17px;color:#93c5fd' });
  const fill = h('div');
  const bar = h('div', { class: 'bar', style: 'margin-top:6px' }, fill);
  const takeBtn = h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px' });
  takeBtn.addEventListener('click', () => {
    const got = game.collectMine();
    if (!got) return toast('아직 캔 게 없어요');
    toast(`한철 ${fmt(got)}을 거뒀어요`);
    app.refresh();
    return undefined;
  });
  const depthInfo = h('div', { class: 'desc' });
  const handInfo = h('div', { class: 'desc' });
  const depthBtn = h('button', { class: 'buy' });
  const handBtn = h('button', { class: 'buy' });
  depthBtn.addEventListener('click', () => { if (game.digDeeper()) app.refresh(); else toast('은자가 부족해요'); });
  handBtn.addEventListener('click', () => { if (game.hireMiner()) app.refresh(); else toast('은자가 부족하거나 갱도를 먼저 파야 해요'); });

  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      `싸우지 않는 동안에도 한철이 쌓여요. ${MINE_CAP_HOURS}시간치까지만 모이니 그 전에 거두세요.`),
    h('div', { class: 'card' }, head, heldEl, bar, takeBtn),
    h('div', { class: 'card' },
      h('h3', {}, '갱도 파기'), depthInfo,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, depthBtn)),
    h('div', { class: 'card' },
      h('h3', {}, '광부 들이기'), handInfo,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, handBtn)));

  function update() {
    const open = game.mineOpen();
    const mn = game.s.mine || { depth: 0, hands: 0 };
    const rate = game.mineRate();
    const cap = game.mineCap();
    const held = game.mineHeld();
    head.innerHTML = !open
      ? `관문 ${MINE_OPEN_STAGE}에 열려요`
      : `깊이 <b>${mn.depth}</b> · 광부 <b>${mn.hands}</b>명 · 초당 <b>${fmt(rate)}</b>`;
    heldEl.textContent = open ? `${fmt(Math.floor(held))} / ${fmt(Math.floor(cap))}` : '-';
    fill.style.width = cap > 0 ? `${Math.min(100, (held / cap) * 100)}%` : '0%';
    takeBtn.textContent = open ? '한철 거두기' : '아직 안 열림';
    takeBtn.disabled = !open || held < 1;
    const dc = game.mineDepthCost();
    const hc = game.mineHandCost();
    depthInfo.innerHTML = mn.depth >= MINE_DEPTH_MAX
      ? '더 팔 수 없어요'
      : `한 칸 내리면 캐는 양이 1.42배가 돼요 · 지금 깊이 ${mn.depth} / ${MINE_DEPTH_MAX}`;
    depthBtn.textContent = mn.depth >= MINE_DEPTH_MAX ? '끝까지 팠어요' : `은자 ${fmt(dc)}`;
    depthBtn.disabled = !open || mn.depth >= MINE_DEPTH_MAX || game.s.gold < dc;
    handInfo.innerHTML = mn.hands >= MINE_HAND_MAX
      ? '더 들일 수 없어요'
      : `한 명마다 캐는 양이 55%씩 늘어요 · 지금 ${mn.hands} / ${MINE_HAND_MAX}명`;
    handBtn.textContent = mn.hands >= MINE_HAND_MAX ? '다 들였어요' : `은자 ${fmt(hc)}`;
    handBtn.disabled = !open || mn.depth <= 0 || mn.hands >= MINE_HAND_MAX || game.s.gold < hc;
  }
  return { root, update, res: ['gold', 'stones'] };
}


// ---------- 혈마의 탑 ----------
// 한 번 오른 층은 내려가지 않고 영구 효과가 붙는다.
// 근거: CurseTable — APK에서 보스 수치가 들어 있던 유일한 콘텐츠.
// 240층, 45초 고정, 층마다 벽이 가파르다.
function towerView(app) {
  const { game } = app;
  const head = h('div', { class: 'desc' });
  const rew = h('div', { class: 'desc' });
  const perk = h('div', { class: 'desc' });
  const goBtn = h('button', { class: 'btn primary' });
  const towerLoop = loopBtn(app, 'tower');
  goBtn.addEventListener('click', () => {
    if (game.startTower()) app.refresh();
    else toast('아직 안 열렸거나 다른 싸움 중이에요');
  });
  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      `${TOWER_TIME}초 안에 수문장을 잡으면 한 층 올라요. 오른 층은 내려가지 않고 영구 효과가 붙어요.`),
    h('div', { class: 'card' }, head, rew, perk,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, goBtn, towerLoop)));

  function update() {
    towerLoop.update();
    const open = game.towerOpen();
    const f = game.towerFloor();
    const nx = game.towerNext();
    const done = game.towerDone();
    head.innerHTML = !open
      ? `관문 ${TOWER_OPEN_STAGE}에 열려요`
      : done ? `<b>${TOWER_FLOOR_MAX}층 — 끝까지 올랐어요</b>`
        : `지금 <b>${f}층</b> / ${TOWER_FLOOR_MAX} · 다음 ${nx}층은 <b>${towerStage(nx)}관문급</b>`;
    rew.innerHTML = open && !done ? `${nx}층 보상 ${rewardText(towerReward(nx))}`
      + (towerReward(nx).accBox ? ` · 장신구 상자 ${towerReward(nx).accBox}` : '') : '';
    perk.innerHTML = f
      ? `지금까지 오른 ${f}층 — 공격력 <b>+${pct(TOWER_PER_FLOOR.atk * f)}</b> · 체력 <b>+${pct(TOWER_PER_FLOOR.hp * f)}</b>`
      : '';
    goBtn.textContent = done ? '끝까지 올랐어요' : !open ? '아직 안 열림' : `${nx}층 오르기`;
    goBtn.disabled = !open || done || game.mode !== 'stage';
  }
  return { root, update, res: ['gems'] };
}

// ---------- 마기 균열 / 비급 탐색 ----------
// 둘 다 짧고, 패 하나를 같이 쓴다.
function seekView(app) {
  const { game } = app;
  const seekEl = h('div', { class: 'desc' });
  const cards = {};
  const root = h('div', {},
    h('p', { class: 'muted', style: 'margin:2px 2px 8px' },
      `짧은 도전이에요. 균열은 ${RIFT_TIME}초, 탐색은 ${HUNT_TIME}초. 탐색패를 같이 써요.`),
    seekEl);

  for (const k of [
    { id: 'rift', name: '마기 균열', open: RIFT_OPEN_STAGE, time: RIFT_TIME, stage: riftStage, reward: riftReward,
      desc: '원보와 신물 조각, 비급을 줘요' },
    { id: 'hunt', name: '비급 탐색', open: HUNT_OPEN_STAGE, time: HUNT_TIME, stage: huntStage, reward: huntReward,
      desc: '은자와 한철, 장신구 상자를 줘요' },
  ]) {
    const info = h('div', { class: 'desc' });
    const btn = h('button', { class: 'btn primary' });
    const loop = loopBtn(app, k.id);
    btn.addEventListener('click', () => {
      if (game.startSeek(k.id)) app.refresh();
      else toast('탐색패가 없거나 아직 안 열렸어요');
    });
    root.append(h('div', { class: 'card' }, h('h3', {}, k.name), info,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, btn, loop)));
    cards[k.id] = { info, btn, loop, def: k };
  }

  function update() {
    seekEl.innerHTML = `남은 탐색패 <b>${game.s.seek || 0}</b> / ${SEEK_CAP}`;
    for (const id of Object.keys(cards)) cards[id].loop.update();
    for (const id of Object.keys(cards)) {
      const c = cards[id];
      const k = c.def;
      const open = id === 'rift' ? game.riftOpen() : game.huntOpen();
      const r = k.reward(game.s.bestStage);
      const boxes = r.accBox || 0;
      const shown = { ...r };
      delete shown.accBox;
      c.info.innerHTML = !open
        ? `관문 ${k.open}에 열려요`
        : `${k.stage(game.s.bestStage)}관문급 · ${k.time}초<br>${rewardText(shown)}`
          + (boxes ? ` · 장신구 상자 ${boxes}` : '');
      c.btn.textContent = open ? `${k.name} 들어가기` : '아직 안 열림';
      c.btn.disabled = !open || !game.canSeek();
    }
  }
  return { root, update, res: ['books', 'shards'] };
}

export function dungeonTab(app) {
  return subTabs([
    { key: 'dungeon', label: '수련터', make: () => dungeonView(app) },
    { key: 'mine', label: '광맥', make: () => mineView(app) },
    { key: 'tower', label: '탑', make: () => towerView(app) },
    { key: 'seek', label: '탐색', make: () => seekView(app) },
  ]);
}
