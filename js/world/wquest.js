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
import * as MS from './wmaster.js';

const did = (g, k) => g.s.did?.[k] || 0;
const mastMax = (g) => Math.max(0, ...Object.values(g.s.mast || {}).map((k) => L.masteryLv(k)));
const passSum = (g) => Object.values(g.s.passLv || {}).reduce((a, b) => a + b, 0);
const skillSum = (g) => Object.values(g.s.skillLv).reduce((a, b) => a + b, 0);
const dailyMax = (g) => Math.max(0, ...D.DAILY.map((d) => g.dailyBest(d.id)));
const lv = (n) => (g) => ({ now: g.s.level, need: n });
const tier = (n) => (g) => ({ now: g.s.jobTier, need: n });
const floor = (n) => (g) => ({ now: g.s.tower.floor, need: n });
const flag = (k, n = 1) => (g) => ({ now: did(g, k), need: n });
// v263: 조작을 알려 주는 단계는 읽고 바로 받는다(해 보면 좋고, 안 해도 막히지 않는다) — 첫 10분이 조작 숙제였다
const tip = (k) => (g) => ({ now: 1, need: 1, tried: did(g, k) > 0 });

// goal(g) → { now, need } · tab: 눌렀을 때 열 화면 'char/stat'처럼 창/칸 (wui WTABS 열쇠 · 칸은 그 창 subTabs 열쇠)
// gift(g): 이 단계가 처음 뜰 때 한 번 — 받은 것을 글로 돌려준다(없으면 null)
// skip: 건너뛸 수 있다(서버가 있어야 하는 것)
export const QUESTS = [
  // v454 첫 30분 점검 — 97단계 → 35단계. 자동이 기본이 된 것(능력치·무공 점수·강화·각인·물약 보충)과 「눌러 보기」 단계는 뺐다.
  //   남긴 것: 이정표(레벨·전직) · 직접 해야 하는 것(직업·두목·애완·탈것·소환·수련장·탑·문파·고수·각인 기운·십이지왕·칠대성·맹주·대결)
  // ---- 첫걸음 ----
  { id: 'job', title: '직업을 고르자', tab: 'char', min: 1, xp: 0,
    why: '직업마다 쓰는 무공이 다르다. 고르면 수련용 무기도 하나 받는다.',
    goal: (g) => ({ now: g.s.job ? 1 : 0, need: 1 }) },
  { id: 'kill10', title: '몹 10마리를 잡자', tab: 'map', min: 1, xp: 0.3,
    why: '사냥은 저절로 돈다. 가만히 두어도 가장 가까운 적을 친다.',
    goal: (g) => ({ now: g.s.kills, need: 10 }) },
  { id: 'move', title: '화면을 눌러 직접 움직여 보자', tab: null, min: 1, xp: 0.2,
    why: '빈 땅을 톡 누르면 그리로 걷고, 누른 채 끌면 조이스틱이 된다. 손을 떼면 다시 자동 사냥.',
    tip: true, goal: tip('move') },
  { id: 'lv5', mile: true, title: '레벨 5까지', tab: 'map', min: 2, xp: 0,
    why: '들판 위 사냥터 이름을 누르면 지도가 열린다. 몹 레벨이 내 레벨쯤인 곳이 가장 빠르다.',
    goal: lv(5) },
  { id: 'craft', title: '낀 무기를 눌러 살펴보자', tab: 'bag/gear', min: 2, xp: 0.2,
    why: '가방 창 → 착용. 장비는 레벨을 따라 저절로 자라고, 강화·각인도 알아서 돌아간다(가방 → 강화에서 끌 수 있다). 눌러서 지금 낀 무기를 보자.',
    goal: flag('gearView') },
  { id: 'area2', title: '구역 2로 가 보자', tab: 'map/murim', min: 2, xp: 0.1,
    why: '지역마다 구역 1·2·3 — 뒤로 갈수록 세고 많이 준다.',
    goal: (g) => ({ now: g.s.bestMap >= W.mapId(1, 2) ? 1 : 0, need: 1 }) },
  { id: 'lv10', mile: true, title: '레벨 10까지', tab: 'map', min: 3, xp: 0,
    why: '레벨이 오르면 갈 수 있는 사냥터가 늘어난다.',
    goal: lv(10) },
  { id: 'pet', title: '애완동물을 데려가자', tab: 'comp/pet', min: 4, xp: 0.15,
    why: '동료 창 → 우리. 선학 한 마리를 넣어 뒀다 — "데려가기"를 누르면 곁에서 함께 싸운다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.pets.length, need: 1 }),
    gift: (g) => (g.s.pets.length || g.s.petBox.length ? null : g.giftPet('crane')) },
  { id: 'mount', title: '탈것에 올라타자', tab: 'comp/mount', min: 4, xp: 0.15,
    why: '동료 창 → 탈것. 나귀 한 마리를 줬다 — "타기"를 누르면 빨라지고 공격력·체력도 붙는다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.mount != null ? 1 : 0, need: 1 }),
    gift: (g) => (g.s.mounts.length ? null : g.giftMount('donkey')) },
  { id: 'gacha', title: '영수·탈것을 소환해 보자', tab: 'comp/pet', min: 6, xp: 0.2,
    why: '동료 창 맨 위 "소환" — 조각 100개로 한 번, 1000개로 열 번. 🎁 오늘 무료는 하루 한 번 공짜! 좋은 영수·탈것일수록 크게 세진다(신화·신수는 문파·전체에 알려진다).',
    goal: flag('gacha') },
  { id: 'lv20', mile: true, title: '레벨 20까지', tab: 'map', min: 5, xp: 0,
    why: '이제 사냥터 셋째 지역이 열린다.',
    goal: lv(20) },
  { id: 'pvp', title: '비무첩에서 한 판 겨루자', tab: 'social/pvp', min: 5, xp: 0.15,
    why: '무림 창 → 대결. 다른 무인의 기록과 직접 겨룬다 — 화면을 끌어서 움직이고 무공은 단추로, 빨간 바닥이 깔리면 비켜 서자. 하루 5번.',
    goal: (g) => ({ now: (g.s.pvp?.win || 0) + (g.s.pvp?.lose || 0), need: 1 }) },
  { id: 'tier1', mile: true, title: `${W.lvText(W.TIERS[1].level)}에 1차 전직`, tab: 'town/master', min: 5, xp: 0.2,
    why: '마을 → 사부. 전직하면 둘레를 쓸어 담는 무공이 열려 사냥 속도가 확 달라진다.',
    goal: tier(1) },
  { id: 'boss', title: '두목 구역에서 두목을 잡자', tab: 'map/murim', min: 4, xp: 0.2,
    why: '지역마다 두목 구역이 있다. 두목 증표는 거기서만 나오고, 장비·애완동물도 가끔 떨군다. 지금 사냥터 지역의 두목이 벅차면 지도에서 앞 지역의 두목 구역도 된다.',
    goal: flag('boss') },
  { id: 'daily', title: '수련장에서 한 판 깨자', tab: 'town/train', min: 5, xp: 0.2,
    why: `마을 › 수련장(교두를 누르거나 마을 창 「수련장」) — 문으로 걸어 들어가면 요일 던전. ${D.DAILY_SEC}초에 ${D.DAILY_KILLS}마리. 수련동(경험치)·금광굴(은자)·천공광맥(재료) — 새 단계는 처음 깨면 조각, 깬 단계에서 하루 ${D.DAILY_ENTRIES}번 보상(소탕도) · 들어갈 수 있는 단계는 몹이 내 레벨+${D.DAILY_LV_OVER}까지.`,
    goal: (g) => ({ now: dailyMax(g), need: 1 }) },
  { id: 'tower3', title: '무한의 탑 3층까지', tab: 'dgn/tower', min: 5, xp: 0.2,
    why: '오른 층마다 공격력·체력이 영구히 오른다. 바닥의 붉은 경고는 화면을 끌어 직접 피한다.',
    goal: floor(3) },
  { id: 'lv30', mile: true, title: '레벨 30까지', tab: 'map', min: 6, xp: 0,
    why: '보조 무공(레벨 25)과 둘째 심법이 열려 있다 — 잊지 말고 찍자.',
    goal: lv(30) },
  { id: 'guild', title: '문파에 들어가자', tab: 'social/guild', min: 6, xp: 0.15, skip: true,
    why: '무림 창 → 문파. 만들거나 친구의 코드로 들어간다. 문파원과 토벌·창고·함께 사냥을 한다.',
    goal: (g) => ({ now: g.s.guildId ? 1 : 0, need: 1 }) },
  { id: 'duel', title: '고수 한 명을 쓰러뜨리자', tab: 'map/masters', min: 10, xp: 0.25,
    why: '지도 → 무림고수. 세 세력의 이름난 고수가 모여 있다(레벨 45부터). 처음 쓰러뜨리면 공격력·체력이 영구히 오르고 큰 보상을 준다. 고수 구역에서는 세력 재료가 나온다.',
    goal: (g) => ({ now: Object.keys(g.s.duel?.won || {}).length, need: 1 }) },
  { id: 'impTheme', title: '각인 칸에서 기운을 골라 올리자', tab: 'bag/imp', min: 8, xp: 0.15,
    why: '가방 → 각인. 장비마다 기운(능력)을 하나 고르고 「⬆ 올리기」만 누르면 된다 — 새기기·단·등급을 알아서 차례로. 자동 각인은 「고른 기운대로」로 켜 두자.',
    goal: (g) => ({ now: Math.max(0, ...W.SLOTS.map((x) => (g.s.equip[x.id] ? g.impLv(g.s.equip[x.id]) : 0))) >= 1 && Object.keys(g.s.impTheme || {}).length ? 1 : 0, need: 1 }) },
  { id: 'lv50', mile: true, title: '레벨 50까지', tab: 'map', min: 10, xp: 0,
    why: '이제 하루에 몇 레벨씩이다 — 방치가 일을 한다.',
    goal: lv(50) },
  { id: 'tier2', mile: true, title: `${W.lvText(W.TIERS[2].level)}에 2차 전직`, tab: 'town/master', min: 10, xp: 0.25,
    why: '2차 무공은 한 번에 크게 때린다. 두목 앞에서 체감이 다르다.',
    goal: tier(2) },
  { id: 'tower20', title: '무한의 탑 20층까지', tab: 'dgn/tower', min: 12, xp: 0.25,
    why: '둘째 십이지신. 수문장마다 경고 모양이 다르다 — 원·고리·줄.',
    goal: floor(20) },
  { id: 'lv70', mile: true, title: '레벨 70까지', tab: 'map', min: 12, xp: 0,
    why: `혼원일기공(70)이 열린다. 3차 전직은 ${W.lvText(W.TIERS[3].level)}.`,
    goal: lv(70) },
  { id: 'lv90', mile: true, title: '레벨 90까지', tab: 'map', min: 15, xp: 0,
    why: '레벨 99부터 십이지왕 구역이 열린다.',
    goal: lv(90) },
  { id: 'king', title: '십이지왕 구역에 들어가자', tab: 'map/king', min: 15, xp: 0.2,
    why: '지도 창 → 십이지왕. 들어갈 때 혼자 또는 문파원과 함께를 고른다.',
    goal: flag('kingRoom') },
  { id: 'kingKill', title: '십이지왕을 쓰러뜨리자', tab: 'map/king', min: 20, xp: 0.3,
    why: '전반 다섯 왕은 직업 세트 조각을, 후반 일곱 왕은 세트 강화석을 떨군다.',
    goal: flag('king') },
  { id: 'tier3', mile: true, title: `${W.lvText(W.TIERS[3].level)}에 3차 전직`, tab: 'town/master', min: 15, xp: 0.3,
    why: '3차는 비기다. 여기서부터 장비 사다리의 끝이 보인다.',
    goal: tier(3) },
  { id: 'tier4', mile: true, title: `${W.lvText(W.TIERS[4].level)}에 승급`, tab: 'town/master', min: 20, xp: 0.3,
    why: '승급 — 4차 무공을 배우고 최대 체력이 크게 오른다. 여기서부터는 왕의 장비를 모은다.',
    goal: tier(4) },
  { id: 'wraid', title: '칠대성 토벌에 한 번 들어가자', tab: 'dgn/wraid', min: 22, xp: 0.25, skip: true,
    why: '던전 → 칠대성. 무림 모두가 함께 깎는 거대한 마왕 — 탄을 피하며 친다. 쓰러지면 대성신장 한 부위를 받는다. 「⚡ 빠른 합류」로 사람 많은 곳에.',
    goal: flag('wraid') },
  { id: 'tower50', title: '무한의 탑 50층까지', tab: 'dgn/tower', min: 25, xp: 0.3,
    why: '여기까지 왔으면 길잡이는 필요 없다. 탑은 120층까지.',
    goal: floor(50) },
  { id: 'lord', title: '맹주를 쓰러뜨리자', tab: 'map/masters', min: 25, xp: 0.3,
    why: '무림맹주·사도맹주는 세력의 끝이다. 처음 쓰러뜨리면 영구 능력치가 고수의 세 배. 그 너머에는 천마가 있다.',
    goal: (g) => ({ now: Object.keys(g.s.duel?.won || {}).filter((id) => MS.masterOf(id)?.lord).length, need: 1 }) },
  { id: 'fifthBoss', title: '5차 전직의 숨은 두목을 쓰러뜨리자', tab: 'town/master', min: 25, xp: 0,
    why: '검사는 천마 · 권마·독마는 무림맹주 · 환마·극악소마는 사도맹주. 마을 → 사부에서 내 직업의 두목을 볼 수 있다.',
    goal: (g) => ({ now: g.s.duel?.won?.[W.fifthOf(g.s.job)?.need] ? 1 : 0, need: 1 }) },
  { id: 'tier5', mile: true, title: '5차 전직', tab: 'town/master', min: 25, xp: 0,
    why: '모든 무공이 일곱 초식으로 바뀌고 혼(魂)이 깃든다. 마지막 초식을 펼치면 등 뒤로 혼의 형상이 선다.',
    goal: tier(5) },
  { id: 'tower120', title: '무한의 탑 120층 — 꼭대기', tab: 'dgn/tower', min: 25, xp: 0,
    why: '층마다 영구 공격력·체력. 꼭대기 위로는 극(極)의 층이 이어진다.',
    goal: floor(120) },
];

// v413 전직 10·30·70·100(v412)에 맞춰 전직 단계를 그 레벨 바로 뒤로 — 3차가 레벨 70에 열리는데 길잡이는 왕 사냥·숙련 뒤(레벨 110~140)에야 짚었다
for (const [id, after] of [['tier1', 'lv10'], ['tier2', 'lv30'], ['tier3', 'lv70'], ['tier4', 'kingKill']]) {   // v421 4차(레벨 100)는 왕 사냥 뒤(레벨 90에 바로 짚으면 열 레벨 동안 할 수 없는 단계가 앞을 막았다)
  const i = QUESTS.findIndex((q) => q.id === id);
  const [q] = QUESTS.splice(i, 1);
  QUESTS.splice(QUESTS.findIndex((x) => x.id === after) + 1, 0, q);
}
export const QUEST_COUNT = QUESTS.length;
export const QUEST_V = 12;   // v454 97 → 35단계 (v398: 5차 단계를 맹주 뒤로 · v413 전직 단계를 그 레벨 바로 뒤로)
export const QUEST_V11_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'pickSell', 'enh3', 'enh5', 'enhAll', 'pet', 'mount', 'petSkill', 'gacha', 'passive', 'lv20', 'tier1', 'boss', 'skill', 'range', 'skill5', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'autoEnh', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'duel', 'lore', 'promote', 'impTheme', 'reimp', 'enh7', 'prot', 'lv50', 'tier2', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'lv80', 'fuse', 'duel5', 'impLv6', 'res3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier3', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tier4', 'wraid', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'fifthBoss', 'tier5', 'lv150', 'trans1', 'tower120', 'trans5'];
export const QUEST_V10_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'pickSell', 'enh3', 'enh5', 'enhAll', 'pet', 'mount', 'petSkill', 'gacha', 'passive', 'lv20', 'tier1', 'boss', 'skill', 'range', 'skill5', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'autoEnh', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'duel', 'lore', 'promote', 'impTheme', 'reimp', 'enh7', 'prot', 'lv50', 'tier2', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'lv80', 'fuse', 'duel5', 'impLv6', 'res3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier3', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tier4', 'wraid', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'fifthBoss', 'tier5', 'lv150', 'trans1', 'tower120', 'trans5'];
export const QUEST_V9_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'pickSell', 'enh3', 'enh5', 'enhAll', 'pet', 'mount', 'petSkill', 'gacha', 'passive', 'lv20', 'tier1', 'boss', 'skill', 'range', 'skill5', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'autoEnh', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'duel', 'lore', 'promote', 'impTheme', 'reimp', 'enh7', 'prot', 'lv50', 'tier2', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'lv80', 'fuse', 'duel5', 'impLv6', 'res3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier3', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tier4', 'wraid', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150', 'fifthBoss', 'tier5', 'trans1', 'tower120', 'trans5'];
// v395   // v395: 전직 20·50·100·130 — 전직·무공 단계를 그 레벨 뒤로 옮겼다
export const QUEST_V8_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'tier1', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'pickSell', 'boss', 'enh3', 'enh5', 'enhAll', 'skill', 'range', 'pet', 'mount', 'petSkill', 'gacha', 'passive', 'skill5', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'autoEnh', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'impTheme', 'reimp', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'lv80', 'fuse', 'duel5', 'impLv6', 'res3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier4', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'wraid', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150', 'fifthBoss', 'tier5', 'trans1', 'tower120', 'trans5'];
// v394   // v394: 각인 두·세 칸(못 깨던 단계)을 각인 Lv·공명으로 · 강화 칸·골라 팔기·자동 강화·기운·칠대성·5차·초월·탑 꼭대기를 끼웠다
export const QUEST_V7_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'tier1', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'enh5', 'skill', 'range', 'pet', 'mount', 'petSkill', 'gacha', 'passive', 'skill5', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'lv80', 'fuse', 'duel5', 'imp2', 'imp3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier4', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150'];
// v369: 소환 단계를 끼웠다(애완동물 기술 다음)   // v269: 1차 전직 단계를 레벨 5 뒤로 옮겼다 (v213: 계열 각인 단계를 뺐다)
// v180: 판 2의 차례 — 판 3으로 옮길 때 '지금 하던 단계'를 찾는다(끼워 넣은 단계는 새로 해 보게)
export const QUEST_V3_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'tier1', 'skill', 'range', 'pet', 'mount', 'passive', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'line', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'duel5', 'imp3', 'tower30', 'gear6', 'lv90', 'king', 'kingKill', 'tier4', 'set1', 'kacc', 'coop', 'tower50', 'enh10', 'set5', 'lord'];
// v208: 판마다 차례 — 옛 판에서 옮길 때 '하던 단계'를 찾고, 새로 끼운 단계를 짚는다
export const QUEST_V2_IDS = ['job', 'kill10', 'move', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'tier1', 'skill', 'pet', 'mount', 'passive', 'lv20', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'promote', 'enh7', 'lv50', 'daily10', 'tower20', 'lv60', 'treasure', 'raid', 'mast5', 'tier3', 'tower30', 'gear6', 'lv90', 'king', 'kingKill', 'tier4', 'set1', 'kacc', 'coop', 'tower50'];
export const questAt = (i) => QUESTS[i] || null;

// 보상 — 그 레벨에서 사냥 min분어치 은자(1분 ≈ 몹 은자 100마리, 시뮬레이션) · 그 레벨 경험치 xp할
export const GOLD_PER_MIN = 100;
// v260: 이만큼 막혀 있으면 절반 보상으로 건너뛸 수 있다(레벨·서버 단계 빼고)
export const QUEST_STUCK_MS = 2 * 3600 * 1000;
export function questReward(q, level) {
  const out = {};
  if (q.min) out.gold = Math.round(W.mobGold(level) * GOLD_PER_MIN * q.min);
  if (q.xp) out.exp = Math.round(W.expToNext(level) * q.xp);
  return out;
}

// v213: 판 4의 차례 — 계열 각인('line')을 빼기 전
export const QUEST_V4_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'enh5', 'tier1', 'skill', 'range', 'pet', 'mount', 'petSkill', 'passive', 'skill5', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'line', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'lv80', 'fuse', 'duel5', 'imp2', 'imp3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier4', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150'];
// v269: 판 5의 차례 — 1차 전직(tier1)을 레벨 5 뒤로 옮기기 전
export const QUEST_V5_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'enh5', 'tier1', 'skill', 'range', 'pet', 'mount', 'petSkill', 'passive', 'skill5', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'lv80', 'fuse', 'duel5', 'imp2', 'imp3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier4', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150'];
export const QUEST_V6_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'tier1', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'enh5', 'skill', 'range', 'pet', 'mount', 'petSkill', 'passive', 'skill5', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'skill10', 'lv70', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'lv80', 'fuse', 'duel5', 'imp2', 'imp3', 'tower30', 'tower40', 'gear6', 'lv90', 'king', 'kingKill', 'mast10', 'tier4', 'skillMax', 'set1', 'kacc', 'coop', 'lv120', 'tower50', 'enh10', 'enh12', 'set5', 'lord', 'lv150'];
export const QUEST_IDS_BY_V = { 2: QUEST_V2_IDS, 3: QUEST_V3_IDS, 4: QUEST_V4_IDS, 5: QUEST_V5_IDS, 6: QUEST_V6_IDS, 7: QUEST_V7_IDS, 8: QUEST_V8_IDS, 9: QUEST_V9_IDS, 10: QUEST_V10_IDS, 11: QUEST_V11_IDS };
