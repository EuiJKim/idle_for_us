// 길잡이 (v139 · v146 다시 짬) — **지금 할 일 하나**를 짚어 준다.
//
// 이 게임은 열 몇 가지가 한꺼번에 열려 있다: 전직·능력치·스킬·심법·강화·승급·
// 요일 던전·무한의 탑·애완동물·탈것·문파·토벌. 처음 온 사람은 어디부터
// 손대야 하는지 모른다. 목록을 더 보여 주면 더 헷갈린다.
//
// 그래서 **한 번에 하나만** 띄운다. 끝내면 다음 하나가 나온다.
//
// v146: 열여섯 단계는 너무 성겼다(레벨 15에서 40까지 사이에 할 일이 넷뿐).
// 그리고 **운에 막히는 단계**가 있었다 — '애완동물을 데리고 다니자'는 두목이 떨궈야만
// 깨져서, 안 떨어지면 뒤 단계가 전부 멈췄다. 이제:
//   · 기능 하나에 한 단계 — 쉰 남짓, 레벨 흐름(사냥 시뮬레이션: 15≈40분, 40≈5시간, 75≈하루, 100≈사흘)에 맞춰 깐다
//   · 가지고 해 봐야 하는 것은 **그 단계가 뜰 때 준다**(gift): 첫 무기 재료, 가장 아래 등급 애완동물·탈것
//   · 서버가 있어야 하는 것(문파·토벌·함께 사냥)은 건너뛸 수 있다(skip)
//   · 보상은 '그 레벨에서 사냥 몇 분어치'로 고르게(min: 분 · xp: 그 레벨 경험치의 몇 할)
//     — 전에는 레벨 1 단계가 1분어치, 레벨 100 단계가 세 시간어치였다
//
// 보상은 **받을 때의 레벨로** 센다. 고정값으로 두면 뒤로 갈수록 먼지가 된다.
import * as W from './wdata.js';
import * as D from './wdgn.js';
import * as L from './wland.js';

const did = (g, k) => g.s.did?.[k] || 0;
const worn = (g) => Object.values(g.s.equip).filter(Boolean).length;
const mastMax = (g) => Math.max(0, ...Object.values(g.s.mast || {}).map((k) => L.masteryLv(k)));
const passSum = (g) => Object.values(g.s.passLv || {}).reduce((a, b) => a + b, 0);
const skillSum = (g) => Object.values(g.s.skillLv).reduce((a, b) => a + b, 0);
const dailyMax = (g) => Math.max(0, ...D.DAILY.map((d) => g.dailyBest(d.id)));
const lv = (n) => (g) => ({ now: g.s.level, need: n });
const tier = (n) => (g) => ({ now: g.s.jobTier, need: n });
const floor = (n) => (g) => ({ now: g.s.tower.floor, need: n });
const flag = (k, n = 1) => (g) => ({ now: did(g, k), need: n });

// goal(g) → { now, need } · tab: 눌렀을 때 열 화면 'char/stat'처럼 창/칸 (wui WTABS 열쇠 · 칸은 그 창 subTabs 열쇠)
// gift(g): 이 단계가 처음 뜰 때 한 번 — 받은 것을 글로 돌려준다(없으면 null)
// skip: 건너뛸 수 있다(서버가 있어야 하는 것)
export const QUESTS = [
  // ---- 1. 첫걸음 (레벨 1~5) ----
  { id: 'job', title: '직업을 고르자', tab: 'char', min: 1, xp: 0,
    why: '직업마다 쓰는 무공이 다르다. 고르면 수련용 무기도 하나 받는다.',
    goal: (g) => ({ now: g.s.job ? 1 : 0, need: 1 }) },
  { id: 'kill10', title: '몹 10마리를 잡자', tab: 'map', min: 1, xp: 0.3,
    why: '사냥은 저절로 돈다. 가만히 두어도 가장 가까운 적을 친다.',
    goal: (g) => ({ now: g.s.kills, need: 10 }) },
  { id: 'move', title: '화면을 눌러 직접 움직여 보자', tab: null, min: 1, xp: 0.2,
    why: '빈 땅을 톡 누르면 그리로 걷고, 누른 채 끌면 조이스틱이 된다. 손을 떼면 다시 자동 사냥.',
    goal: flag('move') },
  { id: 'stat', title: '능력치를 3점 찍자', tab: 'char/stat', min: 1, xp: 0.2,
    why: '레벨이 오르면 점수가 쌓인다. 캐릭터 창에서 힘·민첩·체질·내공에 나눠 찍는다.',
    goal: (g) => ({ now: Object.values(g.s.stats).reduce((a, b) => a + b, 0), need: 3 }) },
  { id: 'lv5', mile: true, title: '레벨 5까지', tab: 'map', min: 2, xp: 0,
    why: '들판 위 사냥터 이름을 누르면 지도가 열린다. 몹 레벨이 내 레벨쯤인 곳이 가장 빠르다.',
    goal: lv(5) },
  // ---- 2. 장비 (레벨 5~10) ----
  { id: 'craft', title: '대장장이에서 무기를 만들자', tab: 'bag/smith', min: 2, xp: 0.2,
    why: '가방 창 → 대장장이. 재료는 사냥터에서 모인다 — 이번 한 번은 재료를 챙겨 줬다.',
    goal: flag('craft'),
    gift: (g) => {
      const { r } = g.recipeFor('weapon', 0, false, 0);
      for (const [k, n] of Object.entries(r.mats)) g.addMats(k, Math.max(0, n - (g.s.mats[k] || 0)));
      g.s.gold += Math.max(0, r.gold - g.s.gold);
      return '첫 무기 재료';
    } },
  { id: 'enh1', title: '무기를 +1 강화하자', tab: 'bag/gear', min: 2, xp: 0.2,
    why: '낀 장비를 누르면 강화. 실패해도 장비는 그대로다 — 은자·재료만 든다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 1 }) },
  { id: 'potion', title: '물약을 20개 채우자', tab: 'town', min: 2, xp: 0.1,
    why: '마을 → 상점. 체력이 낮으면 물약을 알아서 마신다.',
    goal: (g) => ({ now: g.s.potions, need: 20 }) },
  { id: 'refill', title: '물약 자동 보충을 켜자', tab: 'town', min: 1, xp: 0.1,
    why: '켜 두면 10개 아래로 떨어질 때 마을에 안 가도 50개까지 산다. 방치의 기본.',
    goal: (g) => ({ now: g.s.autoRefill ? 1 : 0, need: 1 }) },
  { id: 'area2', title: '구역 2로 가 보자', tab: 'map/field', min: 2, xp: 0.1,
    why: '지역마다 구역 1·2·3 — 뒤로 갈수록 세고 많이 준다.',
    goal: (g) => ({ now: g.s.bestMap >= W.mapId(1, 2) ? 1 : 0, need: 1 }) },
  { id: 'lv10', mile: true, title: '레벨 10까지', tab: 'map', min: 3, xp: 0,
    why: '레벨이 오르면 갈 수 있는 사냥터가 늘어난다.',
    goal: lv(10) },
  { id: 'armor', title: '옷도 만들어 입자', tab: 'bag/smith', min: 3, xp: 0.15,
    why: '무기만 좋으면 금방 쓰러진다. 옷·모자·장갑·신발이 체력을 받친다.',
    goal: (g) => ({ now: g.s.equip.armor ? 1 : 0, need: 1 }) },
  // ---- 3. 두목과 1차 전직 (레벨 10~15) ----
  { id: 'boss', title: '두목 구역에서 두목을 잡자', tab: 'map/field', min: 4, xp: 0.2,
    why: '지역마다 두목 구역이 있다. 두목 증표는 거기서만 나오고, 장비·애완동물도 가끔 떨군다.',
    goal: flag('boss') },
  { id: 'enh3', title: '무기를 +3까지', tab: 'bag/gear', min: 4, xp: 0.15,
    why: '강화는 등급을 올리는 것보다 싸고 확실하다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 3 }) },
  { id: 'tier1', mile: true, title: '레벨 15에 1차 전직', tab: 'town', min: 5, xp: 0.2,
    why: '마을 → 사부. 전직하면 둘레를 쓸어 담는 무공이 열려 사냥 속도가 확 달라진다.',
    goal: tier(1) },
  { id: 'skill', title: '무공을 한 번 올리자', tab: 'char/skill', min: 4, xp: 0.15,
    why: `레벨 ${W.SKILL_PT_FROM}부터 무공 점수가 쌓인다. 무공 레벨이 곧 피해다.`,
    goal: (g) => ({ now: skillSum(g), need: 6 }) },
  // ---- 4. 동료 (레벨 15~20) ----
  { id: 'pet', title: '애완동물을 데려가자', tab: 'comp/pet', min: 4, xp: 0.15,
    why: '동료 창 → 우리. 선학 한 마리를 넣어 뒀다 — "데려가기"를 누르면 곁에서 함께 싸운다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.pets.length, need: 1 }),
    gift: (g) => (g.s.pets.length || g.s.petBox.length ? null : g.giftPet('crane')) },
  { id: 'mount', title: '탈것에 올라타자', tab: 'comp/mount', min: 4, xp: 0.15,
    why: '동료 창 → 탈것. 나귀 한 마리를 줬다 — "타기"를 누르면 빨라지고 공격력·체력도 붙는다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.mount != null ? 1 : 0, need: 1 }),
    gift: (g) => (g.s.mounts.length ? null : g.giftMount('donkey')) },
  { id: 'passive', title: '심법을 하나 올리자', tab: 'char/skill', min: 4, xp: 0.15,
    why: '캐릭터 창 → 심법. 무공 점수로 올리는 늘 켜진 능력(이동 속도·받는 피해…).',
    goal: (g) => ({ now: passSum(g), need: 1 }) },
  { id: 'lv20', mile: true, title: '레벨 20까지', tab: 'map', min: 5, xp: 0,
    why: '이제 사냥터 셋째 지역이 열린다.',
    goal: lv(20) },
  // ---- 5. 던전 (레벨 20~30) ----
  { id: 'daily', title: '일일 던전을 한 판 깨자', tab: 'dgn/daily', min: 5, xp: 0.2,
    why: `던전 창 → 일일 던전. ${D.DAILY_SEC}초에 ${D.DAILY_KILLS}마리. 수련동(경험치)·금광굴(은자)·천공광맥(재료) 셋 다 매일 ${D.DAILY_ENTRIES}번씩.`,
    goal: (g) => ({ now: dailyMax(g), need: 1 }) },
  { id: 'dauto', title: '일일 던전 자동 도전을 켜자', tab: 'dgn/daily', min: 2, xp: 0.1,
    why: '켜 두면 사냥하다가 남은 횟수만큼 알아서 들어가 가장 높은 단계를 돈다.',
    goal: (g) => ({ now: g.s.dgn.auto ? 1 : 0, need: 1 }) },
  { id: 'sweep', title: '소탕을 한 번 써 보자', tab: 'dgn/daily', min: 3, xp: 0.1,
    why: '한 번 깬 단계는 들어가지 않고 보상만 받을 수 있다(남은 횟수를 쓴다).',
    goal: flag('sweep') },
  { id: 'tower3', title: '무한의 탑 3층까지', tab: 'dgn/tower', min: 5, xp: 0.2,
    why: '오른 층마다 공격력·체력이 영구히 오른다. 바닥의 붉은 경고는 화면을 끌어 직접 피한다.',
    goal: floor(3) },
  { id: 'gear4', title: '장비 네 칸을 채우자', tab: 'bag/smith', min: 5, xp: 0.15,
    why: '대장장이에서 모자·장갑·신발도. 칸마다 지역 고유 옵션이 붙는다 — 섞어 끼면 좋다.',
    goal: (g) => ({ now: worn(g), need: 4 }) },
  { id: 'mast1', title: '한 지역 숙련도 1', tab: 'map', min: 5, xp: 0.15,
    why: '한 지역에서 오래 사냥하면 숙련이 올라 경험치·재료가 늘고 나쁜 기운을 견딘다.',
    goal: (g) => ({ now: mastMax(g), need: 1 }) },
  { id: 'lv30', mile: true, title: '레벨 30까지', tab: 'map', min: 6, xp: 0,
    why: '보조 무공(레벨 25)과 둘째 심법이 열려 있다 — 잊지 말고 찍자.',
    goal: lv(30) },
  // ---- 6. 문파 (서버가 있어야 한다 — 건너뛸 수 있다) ----
  { id: 'guild', title: '문파에 들어가자', tab: 'social', min: 6, xp: 0.15, skip: true,
    why: '무림 창 → 문파. 만들거나 친구의 코드로 들어간다. 문파원과 토벌·창고·함께 사냥을 한다.',
    goal: (g) => ({ now: g.s.guildId ? 1 : 0, need: 1 }) },
  { id: 'checkin', title: '문파 출석을 하자', tab: 'social', min: 4, xp: 0.1, skip: true,
    why: '하루 한 번. 문파 경험치가 올라 문파원 모두가 세진다.',
    goal: flag('checkin') },
  { id: 'donate', title: '문파에 은자를 기부하자', tab: 'social', min: 4, xp: 0.1, skip: true,
    why: '하루 세 번까지. 문파 레벨이 오르면 문파원 모두의 능력치가 오른다.',
    goal: flag('donate') },
  // ---- 7. 2차 전직까지 (레벨 30~40) ----
  { id: 'bag', title: '가방을 한 번 늘리자', tab: 'bag/gear', min: 5, xp: 0.1,
    why: '두목이 떨군 장비가 쌓인다. 가방 칸은 은자로 늘린다.',
    goal: (g) => ({ now: g.s.bagSize > W.BAG_SIZE ? 1 : 0, need: 1 }) },
  { id: 'alt', title: '새 지역에 가 보자', tab: 'map/field', min: 6, xp: 0.15,
    why: '도화림·황궁 금위영 같은 새 지역은 옆 지역과 같은 재료를 주지만 기운과 땅이 다르다.',
    goal: flag('alt') },
  { id: 'tower10', title: '무한의 탑 10층 — 첫 십이지신', tab: 'dgn/tower', min: 8, xp: 0.25,
    why: '10층마다 십이지신이 지킨다. 쓰러뜨리면 그 신의 탈것 뽑기권을 준다.',
    goal: floor(10) },
  { id: 'zodiac', title: '십이지 뽑기를 한 번 하자', tab: 'dgn/zodiac', min: 4, xp: 0.1,
    why: '던전 창 → 십이지. 뽑기권으로 그 신의 신수(탈것)를 노린다. 셋째에는 꼭 나온다.',
    goal: flag('zodiac') },
  { id: 'tier2', mile: true, title: '레벨 40에 2차 전직', tab: 'town', min: 10, xp: 0.25,
    why: '2차 무공은 한 번에 크게 때린다. 두목 앞에서 체감이 다르다.',
    goal: tier(2) },
  // ---- 8. 키우기 (레벨 40~75) ----
  { id: 'promote', title: '장비 하나를 승급하자', tab: 'bag/smith', min: 8, xp: 0.15,
    why: '대장장이 → 승급. 레어→유니크→전설→신화. 등급이 오르면 스킬 옵션이 새로 붙는다.',
    goal: flag('promote') },
  { id: 'enh7', title: '무기를 +7까지', tab: 'bag/gear', min: 8, xp: 0.15,
    why: '+7부터 칼빛이 반짝인다. +10을 넘기려면 두목 증표가 든다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 7 }) },
  { id: 'lv50', mile: true, title: '레벨 50까지', tab: 'map', min: 10, xp: 0,
    why: '이제 하루에 몇 레벨씩이다 — 방치가 일을 한다.',
    goal: lv(50) },
  { id: 'daily10', title: '일일 던전 10단계를 깨자', tab: 'dgn/daily', min: 10, xp: 0.2,
    why: '단계가 높을수록 보상이 크다. 자동 도전은 갈 수 있는 가장 높은 단계로 간다.',
    goal: (g) => ({ now: dailyMax(g), need: 10 }) },
  { id: 'tower20', title: '무한의 탑 20층까지', tab: 'dgn/tower', min: 12, xp: 0.25,
    why: '둘째 십이지신. 수문장마다 경고 모양이 다르다 — 원·고리·줄.',
    goal: floor(20) },
  { id: 'lv60', mile: true, title: '레벨 60까지', tab: 'map', min: 12, xp: 0,
    why: '심안(레벨 50)·혼원일기공(70) 같은 심법도 차례로 열린다.',
    goal: lv(60) },
  { id: 'treasure', title: '보물 원숭이를 잡자', tab: 'map', min: 12, xp: 0.2,
    why: '사냥터에 가끔 금빛 원숭이가 나타난다. 25초 안에 잡으면 은자·재료가 쏟아진다.',
    goal: flag('treasure') },
  { id: 'raid', title: '문파 토벌에 한 번 참여하자', tab: 'dgn/raid', min: 10, xp: 0.2, skip: true,
    why: '던전 창 → 문파 토벌. 한 주에 두목 하나를 문파원 모두가 함께 깎는다.',
    goal: flag('raid') },
  { id: 'mast5', title: '한 지역 숙련도 5', tab: 'map', min: 12, xp: 0.2,
    why: '숙련 5면 그 지역의 나쁜 기운을 거의 견딘다.',
    goal: (g) => ({ now: mastMax(g), need: 5 }) },
  { id: 'tier3', mile: true, title: '레벨 75에 3차 전직', tab: 'town', min: 15, xp: 0.3,
    why: '3차는 비기다. 여기서부터 장비 사다리의 끝이 보인다.',
    goal: tier(3) },
  // ---- 9. 십이지왕 (레벨 75~) ----
  { id: 'tower30', title: '무한의 탑 30층까지', tab: 'dgn/tower', min: 15, xp: 0.25,
    why: '십이지신 셋을 넘긴 셈이다.',
    goal: floor(30) },
  { id: 'gear6', title: '장비 여섯 칸을 다 채우자', tab: 'bag/gear', min: 12, xp: 0.2,
    why: '장신구까지. 가락지·귀걸이는 두목만 떨군다.',
    goal: (g) => ({ now: Math.min(6, ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc'].filter((k) => g.s.equip[k]).length), need: 6 }) },
  { id: 'lv90', mile: true, title: '레벨 90까지', tab: 'map', min: 15, xp: 0,
    why: '레벨 99부터 십이지왕 구역이 열린다.',
    goal: lv(90) },
  { id: 'king', title: '십이지왕 구역에 들어가자', tab: 'map/king', min: 15, xp: 0.2,
    why: '지도 창 → 십이지왕. 들어갈 때 혼자 또는 문파원과 함께를 고른다.',
    goal: flag('kingRoom') },
  { id: 'kingKill', title: '십이지왕을 쓰러뜨리자', tab: 'map/king', min: 20, xp: 0.3,
    why: '전반 다섯 왕은 직업 세트 조각을, 후반 일곱 왕은 세트 강화석을 떨군다.',
    goal: flag('king') },
  { id: 'tier4', mile: true, title: '레벨 100에 4차 전직', tab: 'town', min: 20, xp: 0.3,
    why: '마지막 무공이다. 여기서부터는 왕의 장비를 모은다.',
    goal: tier(4) },
  { id: 'set1', title: '세트 장비를 하나 끼자', tab: 'bag/smith', min: 20, xp: 0.25,
    why: '대장장이 → 세트 99~. 그 부위 왕의 재료·증표로 만들거나 왕이 떨군 것을 낀다. 2·3·5조각 효과.',
    goal: (g) => ({ now: Object.values(g.s.equip).filter((it) => it?.set).length, need: 1 }) },
  { id: 'kacc', title: '왕의 장신구를 만들자', tab: 'bag/smith', min: 20, xp: 0.25,
    why: '대장장이 → 장신구 99~. 어느 직업이든 쓰는 공용 장신구 — 스킬 옵션이 하나 더 붙는다.',
    goal: flag('kacc') },
  { id: 'coop', title: '문파원과 함께 왕을 잡자', tab: 'map/king', min: 20, xp: 0.25, skip: true,
    why: '왕 구역에 "함께"로 들어가면 같은 구역의 문파원과 왕 체력을 나눈다. 한 대라도 치면 보상을 다 받는다.',
    goal: flag('coop') },
  { id: 'tower50', title: '무한의 탑 50층까지', tab: 'dgn/tower', min: 25, xp: 0.3,
    why: '여기까지 왔으면 길잡이는 필요 없다. 탑은 120층까지.',
    goal: floor(50) },
];

export const QUEST_COUNT = QUESTS.length;
export const QUEST_V = 2;
export const questAt = (i) => QUESTS[i] || null;

// 보상 — 그 레벨에서 사냥 min분어치 은자(1분 ≈ 몹 은자 100마리, 시뮬레이션) · 그 레벨 경험치 xp할
export const GOLD_PER_MIN = 100;
export function questReward(q, level) {
  const out = {};
  if (q.min) out.gold = Math.round(W.mobGold(level) * GOLD_PER_MIN * q.min);
  if (q.xp) out.exp = Math.round(W.expToNext(level) * q.xp);
  return out;
}
