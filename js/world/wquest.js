// 길잡이 (v139) — **지금 할 일 하나**를 짚어 준다.
//
// 이 게임은 열 몇 가지가 한꺼번에 열려 있다: 전직·능력치·스킬·심법·강화·승급·
// 요일 던전·무한의 탑·애완동물·탈것·문파·토벌. 처음 온 사람은 어디부터
// 손대야 하는지 모른다. 목록을 더 보여 주면 더 헷갈린다.
//
// 그래서 **한 번에 하나만** 띄운다. 끝내면 다음 하나가 나온다.
// 목록으로도 볼 수 있지만 띄우는 건 늘 하나다.
//
// 보상은 **받을 때의 레벨로** 센다. 고정값으로 두면 뒤로 갈수록 먼지가 된다 —
// 옛 판에서 일일 의뢰 보상이 그렇게 죽었다(data.js 주석에 그 자국이 남아 있다).
import * as W from './wdata.js';
import * as D from './wdgn.js';

// goal(g) → { now, need }  — now이 need에 닿으면 끝난 것
// tab: 눌렀을 때 열 화면 (wui의 WTABS 열쇠)
// gold/exp: 받을 때의 레벨로 센 배수 (몹 은자 몇 마리치 · 그 레벨 경험치의 몇 할)
export const QUESTS = [
  {
    id: 'job', title: '문파를 정해 무공을 익히자', tab: 'char',
    why: '직업마다 쓰는 무공이 다르다. 고르면 수련용 무기도 하나 받는다.',
    goal: (g) => ({ now: g.s.job ? 1 : 0, need: 1 }),
    gold: 60, exp: 0,
  },
  {
    id: 'lv5', title: '레벨 5까지 사냥하자', tab: 'map',
    why: '사냥은 자동으로 돈다. 화면을 눌러 끌면 직접 움직일 수도 있다.',
    goal: (g) => ({ now: g.s.level, need: 5 }),
    gold: 120, exp: 0.1,
  },
  {
    id: 'stat', title: '능력치를 찍자', tab: 'char',
    why: '레벨이 오르면 점수가 쌓인다. 안 찍으면 그냥 놀고 있는 것이다.',
    // '남은 점수가 0이면 끝'으로 두면 **한 번도 안 찍은 레벨 1도 끝난 것**이 된다.
    // 찍은 점수를 직접 센다.
    goal: (g) => ({ now: Object.values(g.s.stats).reduce((a, b) => a + b, 0), need: 3 }),
    gold: 150, exp: 0.1,
  },
  {
    id: 'potion', title: '물약을 채우자', tab: 'town',
    why: '물약이 떨어지면 쓰러진다. 마을에서 산다 — 자동 보충도 켤 수 있다.',
    goal: (g) => ({ now: g.s.potions, need: 20 }),
    gold: 200, exp: 0.1,
  },
  {
    id: 'tier1', title: '레벨 15에 1차 전직', tab: 'char',
    why: '전직하면 둘레를 쓸어 담는 무공이 열린다. 사냥 속도가 확 달라진다.',
    goal: (g) => ({ now: g.s.jobTier, need: 1 }),
    gold: 400, exp: 0.15,
  },
  {
    id: 'skill', title: '무공을 한 번 올리자', tab: 'char',
    why: `레벨 ${W.SKILL_PT_FROM}부터 무공 점수가 쌓인다. 무공 레벨이 곧 피해다.`,
    goal: (g) => ({ now: Object.values(g.s.skillLv).reduce((a, b) => a + b, 0), need: 6 }),
    gold: 500, exp: 0.15,
  },
  {
    id: 'enhance', title: '무기를 +3까지 강화하자', tab: 'bag',
    why: '강화는 등급을 올리는 것보다 싸고 확실하다. 재료는 사냥터에서 나온다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 3 }),
    gold: 700, exp: 0.2,
  },
  {
    id: 'daily', title: '요일 던전을 한 판 깨자', tab: 'dgn',
    why: `${D.DAILY_SEC}초에 ${D.DAILY_KILLS}마리. 하루 ${D.DAILY_ENTRIES}번씩 — 자동 도전을 켜 두면 알아서 돈다.`,
    goal: (g) => ({ now: Math.max(...D.DAILY.map((d) => g.dailyBest(d.id))), need: 1 }),
    gold: 900, exp: 0.2,
  },
  {
    id: 'tower5', title: '무한의 탑 5층까지', tab: 'dgn',
    why: '오른 층마다 공격력·체력이 영구히 오른다. 바닥의 붉은 경고는 직접 피해야 한다.',
    goal: (g) => ({ now: g.s.tower.floor, need: 5 }),
    gold: 1200, exp: 0.25,
  },
  {
    id: 'pet', title: '애완동물을 하나 데리고 다니자', tab: 'comp',
    why: '함께 싸운다. 사냥터에서 떨어지고, 우리에서 꺼내 장착한다.',
    goal: (g) => ({ now: (g.s.pets || []).length, need: 1 }),
    gold: 1500, exp: 0.25,
  },
  {
    id: 'tier2', title: '레벨 40에 2차 전직', tab: 'char',
    why: '2차 무공은 한 번에 크게 때린다. 두목 앞에서 체감이 다르다.',
    goal: (g) => ({ now: g.s.jobTier, need: 2 }),
    gold: 2500, exp: 0.3,
  },
  {
    id: 'mount', title: '탈것을 하나 얻자', tab: 'comp',
    why: '이동이 빨라지고 공격력·체력도 붙는다. 탑 10층 십이지신이 뽑기권을 준다.',
    goal: (g) => ({ now: (g.s.mounts || []).length, need: 1 }),
    gold: 3000, exp: 0.3,
  },
  {
    id: 'guild', title: '문파에 들어가자', tab: 'social',
    why: '문파원과 함께 주마다 십이지왕 하나를 친다. 혼자서는 못 잡는다.',
    goal: (g) => ({ now: g.s.guildId ? 1 : 0, need: 1 }),
    gold: 4000, exp: 0.3,
  },
  {
    id: 'tier3', title: '레벨 75에 3차 전직', tab: 'char',
    why: '3차는 비기다. 여기서부터 장비 사다리의 끝이 보인다.',
    goal: (g) => ({ now: g.s.jobTier, need: 3 }),
    gold: 8000, exp: 0.35,
  },
  {
    id: 'tower30', title: '무한의 탑 30층까지', tab: 'dgn',
    why: '십이지신 셋을 넘긴 셈이다. 탈것이 갖춰지면 사냥터가 넓어진다.',
    goal: (g) => ({ now: g.s.tower.floor, need: 30 }),
    gold: 12000, exp: 0.35,
  },
  {
    id: 'tier4', title: '레벨 100에 4차 전직', tab: 'char',
    why: '마지막 무공이다. 여기서부터는 왕의 장비를 모은다.',
    goal: (g) => ({ now: g.s.jobTier, need: 4 }),
    gold: 30000, exp: 0.4,
  },
];

export const QUEST_COUNT = QUESTS.length;
export const questAt = (i) => QUESTS[i] || null;

// 받을 때의 레벨로 센다 — 고정값은 뒤로 갈수록 먼지가 된다
export function questReward(q, level) {
  const out = {};
  if (q.gold) out.gold = Math.round(W.mobGold(level) * q.gold);
  if (q.exp) out.exp = Math.round(W.expToNext(level) * q.exp);
  return out;
}
