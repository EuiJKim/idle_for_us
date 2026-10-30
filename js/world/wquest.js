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
  { id: 'zoom', title: '화면 거리를 바꿔 보자', tab: null, min: 1, xp: 0.1,
    why: '들판 오른쪽 위 "보통" 단추 — 누를 때마다 가까이·보통·멀리. 멀리 보면 몹 무리와 두목 경고가 한눈에 들어온다.',
    goal: flag('zoom') },
  { id: 'stat', title: '능력치를 3점 찍자', tab: 'char/stat', min: 1, xp: 0.2,
    why: '레벨이 오르면 점수가 쌓인다. 캐릭터 창에서 힘·민첩·체질·내공에 나눠 찍는다.',
    goal: (g) => ({ now: Object.values(g.s.stats).reduce((a, b) => a + b, 0), need: 3 }) },
  { id: 'lv5', mile: true, title: '레벨 5까지', tab: 'map', min: 2, xp: 0,
    why: '들판 위 사냥터 이름을 누르면 지도가 열린다. 몹 레벨이 내 레벨쯤인 곳이 가장 빠르다.',
    goal: lv(5) },
  // ---- 2. 장비 (레벨 5~10) ----
  // v158: 장비는 만들지 않는다 — 여섯 칸이 레벨을 따라 자란다. 눌러서 강화·등급·계열.
  { id: 'craft', title: '낀 무기를 눌러 살펴보자', tab: 'bag/gear', min: 2, xp: 0.2,
    why: '가방 창 → 착용. 장비 여섯 칸은 레벨을 따라 저절로 자란다 — 만들 필요 없이 강화·등급·계열로 키운다.',
    goal: flag('gearView') },
  { id: 'enh1', title: '무기를 +1 강화하자', tab: 'bag/gear', min: 2, xp: 0.2,
    why: '낀 장비를 누르면 강화. 실패해도 장비는 그대로다 — 은자·재료만 든다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 1 }) },
  { id: 'potion', title: '물약을 20개 채우자', tab: 'town/shop', min: 2, xp: 0.1,
    why: '마을 → 상점. 체력이 낮으면 물약을 알아서 마신다.',
    goal: (g) => ({ now: g.s.potions, need: 20 }) },
  { id: 'refill', title: '물약 자동 보충을 켜자', tab: 'town/shop', min: 1, xp: 0.1,
    why: '켜 두면 10개 아래로 떨어질 때 마을에 안 가도 50개까지 산다. 방치의 기본.',
    goal: (g) => ({ now: g.s.autoRefill ? 1 : 0, need: 1 }) },
  { id: 'potionAt', title: '자동 물약 체력을 정하자', tab: null, min: 1, xp: 0.1,
    why: `오른쪽 위 ⚙ 설정 → 자동 물약 체력(30~75%). 물약 한 병은 최대 체력의 ${Math.round(W.POTION_HEAL * 100)}%를 채운다. 높이면 안전하지만 물약값이 꽤 든다.`,
    goal: flag('potionAt') },
  { id: 'area2', title: '구역 2로 가 보자', tab: 'map/murim', min: 2, xp: 0.1,
    why: '지역마다 구역 1·2·3 — 뒤로 갈수록 세고 많이 준다.',
    goal: (g) => ({ now: g.s.bestMap >= W.mapId(1, 2) ? 1 : 0, need: 1 }) },
  { id: 'lv10', mile: true, title: '레벨 10까지', tab: 'map', min: 3, xp: 0,
    why: '레벨이 오르면 갈 수 있는 사냥터가 늘어난다.',
    goal: lv(10) },
  { id: 'armor', title: '옷도 +1 강화하자', tab: 'bag/gear', min: 3, xp: 0.15,
    why: '무기만 좋으면 금방 쓰러진다. 옷·모자·장갑·신발이 체력을 받친다.',
    goal: (g) => ({ now: g.s.equip.armor?.plus ? 1 : 0, need: 1 }) },
  // ---- 3. 두목과 1차 전직 (레벨 10~15) ----
  { id: 'boss', title: '두목 구역에서 두목을 잡자', tab: 'map/murim', min: 4, xp: 0.2,
    why: '지역마다 두목 구역이 있다. 두목 증표는 거기서만 나오고, 장비·애완동물도 가끔 떨군다.',
    goal: flag('boss') },
  { id: 'enh3', title: '무기를 +3까지', tab: 'bag/gear', min: 4, xp: 0.15,
    why: '강화는 등급을 올리는 것보다 싸고 확실하다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 3 }) },
  { id: 'enh5', title: '무기를 +5까지', tab: 'bag/gear', min: 4, xp: 0.15,
    why: '+7까지는 실패해도 그대로다 — 은자·재료만 들면 마음 놓고 두드리자.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 5 }) },
  { id: 'tier1', mile: true, title: '레벨 15에 1차 전직', tab: 'town/master', min: 5, xp: 0.2,
    why: '마을 → 사부. 전직하면 둘레를 쓸어 담는 무공이 열려 사냥 속도가 확 달라진다.',
    goal: tier(1) },
  { id: 'skill', title: '무공을 한 번 올리자', tab: 'char/skill', min: 4, xp: 0.15,
    why: `레벨 ${W.SKILL_PT_FROM}부터 무공 점수가 쌓인다. 무공 레벨이 곧 피해다.`,
    goal: (g) => ({ now: skillSum(g), need: 6 }) },
  { id: 'range', title: '무공 단추를 길게 눌러 범위를 보자', tab: null, min: 2, xp: 0.1,
    why: '아래 무공 단추를 꾹 누르고 있으면 맞는 자리가 금빛으로 보인다. 설정 → 스킬 범위 보기를 켜면 펼칠 때마다 보인다.',
    goal: flag('range') },
  // ---- 4. 동료 (레벨 15~20) ----
  { id: 'pet', title: '애완동물을 데려가자', tab: 'comp/pet', min: 4, xp: 0.15,
    why: '동료 창 → 우리. 선학 한 마리를 넣어 뒀다 — "데려가기"를 누르면 곁에서 함께 싸운다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.pets.length, need: 1 }),
    gift: (g) => (g.s.pets.length || g.s.petBox.length ? null : g.giftPet('crane')) },
  { id: 'mount', title: '탈것에 올라타자', tab: 'comp/mount', min: 4, xp: 0.15,
    why: '동료 창 → 탈것. 나귀 한 마리를 줬다 — "타기"를 누르면 빨라지고 공격력·체력도 붙는다. 더 좋은 것은 두목이 떨군다.',
    goal: (g) => ({ now: g.s.mount != null ? 1 : 0, need: 1 }),
    gift: (g) => (g.s.mounts.length ? null : g.giftMount('donkey')) },
  { id: 'petSkill', title: '애완동물 기술을 보자', tab: 'comp/pet', min: 3, xp: 0.1,
    why: '데려간 애완동물은 몇 초마다 제 기술(여우불·백호참…)로 둘레를 한꺼번에 친다. 등급이 높을수록 자주.',
    goal: flag('petSkill') },
  { id: 'passive', title: '심법을 하나 올리자', tab: 'char/skill', min: 4, xp: 0.15,
    why: '캐릭터 창 → 심법. 무공 점수로 올리는 늘 켜진 능력(이동 속도·받는 피해…).',
    goal: (g) => ({ now: passSum(g), need: 1 }) },
  { id: 'skill5', title: '무공 하나를 Lv5까지', tab: 'char/skill', min: 4, xp: 0.15,
    why: 'Lv5에 범위가 넓어진다(1차는 주변 적까지). 한 무공에 몰아 주면 사냥이 빨라진다.',
    goal: (g) => ({ now: Math.max(1, ...Object.values(g.s.skillLv || {})), need: 5 }) },
  { id: 'lv20', mile: true, title: '레벨 20까지', tab: 'map', min: 5, xp: 0,
    why: '이제 사냥터 셋째 지역이 열린다.',
    goal: lv(20) },
  { id: 'saver', title: '절전 화면을 켜 보자', tab: null, min: 3, xp: 0.1,
    why: '들판 오른쪽 🌙. 검은 화면에 숫자만 남기고 사냥은 계속된다 — 오래 켜 둘 때 배터리를 아낀다. 두 번 누르면 돌아온다. 설정에서 저절로 들어갈 시간을 정한다.',
    goal: flag('saver') },
  { id: 'app', title: '앱으로 설치하거나 전체 화면으로', tab: null, min: 3, xp: 0.1, skip: true,
    why: '⚙ 설정 → 앱으로 쓰기. 홈 화면에 깔면 주소창 없이 열린다. 들판의 ⛶ 단추는 지금 바로 전체 화면. (카카오톡 안에서는 안 된다 — 크롬·사파리로)',
    goal: flag('app') },
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
  { id: 'gear4', title: '장비 네 칸을 +3까지', tab: 'bag/gear', min: 5, xp: 0.15,
    why: '모자·장갑·신발도. +3까지는 실패해도 그대로다. 칸마다 그 레벨 지역의 고유 옵션이 붙는다.',
    goal: (g) => ({ now: W.GROW_SLOTS.filter((k) => (g.s.equip[k]?.plus || 0) >= 3).length, need: 4 }) },
  { id: 'mast1', title: '한 지역 숙련도 1', tab: 'map', min: 5, xp: 0.15,
    why: '한 지역에서 오래 사냥하면 숙련이 올라 경험치·재료가 늘고 나쁜 기운을 견딘다.',
    goal: (g) => ({ now: mastMax(g), need: 1 }) },
  { id: 'convert', title: '지난 사냥터 재료를 합치자', tab: 'bag/mats', min: 4, xp: 0.1,
    why: `가방 → 재료. 지난 사냥터 재료 ${W.MAT_CONVERT}개가 다음 사냥터 재료 1개가 된다. "모두"를 누르면 한꺼번에 위로 올린다.`,
    goal: flag('convert') },
  { id: 'book', title: '스탯 비급을 한 권 사자', tab: 'town/shop', min: 4, xp: 0.1,
    why: '마을 → 상인. 비급 한 권에 능력치 점수 1. 살수록 비싸진다 — 남는 은자를 넣는 곳.',
    goal: flag('book') },
  { id: 'lv30', mile: true, title: '레벨 30까지', tab: 'map', min: 6, xp: 0,
    why: '보조 무공(레벨 25)과 둘째 심법이 열려 있다 — 잊지 말고 찍자.',
    goal: lv(30) },
  // ---- 6. 문파 (서버가 있어야 한다 — 건너뛸 수 있다) ----
  { id: 'guild', title: '문파에 들어가자', tab: 'social/guild', min: 6, xp: 0.15, skip: true,
    why: '무림 창 → 문파. 만들거나 친구의 코드로 들어간다. 문파원과 토벌·창고·함께 사냥을 한다.',
    goal: (g) => ({ now: g.s.guildId ? 1 : 0, need: 1 }) },
  { id: 'checkin', title: '문파 출석을 하자', tab: 'social/guild', min: 4, xp: 0.1, skip: true,
    why: '하루 한 번. 문파 경험치가 올라 문파원 모두가 세진다.',
    goal: flag('checkin') },
  { id: 'donate', title: '문파에 은자를 기부하자', tab: 'social/guild', min: 4, xp: 0.1, skip: true,
    why: '하루 세 번까지. 문파 레벨이 오르면 문파원 모두의 능력치가 오른다.',
    goal: flag('donate') },
  // ---- 7. 2차 전직까지 (레벨 30~40) ----
  { id: 'bag', title: '가방을 한 번 늘리자', tab: 'bag/bag', min: 5, xp: 0.1,
    why: '두목이 떨군 장비가 쌓인다. 가방 칸은 은자로 늘린다.',
    goal: (g) => ({ now: g.s.bagSize > W.BAG_SIZE ? 1 : 0, need: 1 }) },
  { id: 'alt', title: '새 지역에 가 보자', tab: 'map/murim', min: 6, xp: 0.15,
    why: '도화림·황궁 금위영 같은 새 지역은 옆 지역과 같은 재료를 주지만 기운과 땅이 다르다.',
    goal: flag('alt') },
  { id: 'tower10', title: '무한의 탑 10층 — 첫 십이지신', tab: 'dgn/tower', min: 8, xp: 0.25,
    why: '10층마다 십이지신이 지킨다. 쓰러뜨리면 그 신의 탈것 뽑기권을 준다.',
    goal: floor(10) },
  { id: 'zodiac', title: '십이지 뽑기를 한 번 하자', tab: 'dgn/zodiac', min: 4, xp: 0.1,
    why: '던전 창 → 십이지. 뽑기권으로 그 신의 신수(탈것)를 노린다. 셋째에는 꼭 나온다.',
    goal: flag('zodiac') },
  { id: 'tier2', mile: true, title: '레벨 40에 2차 전직', tab: 'town/master', min: 10, xp: 0.25,
    why: '2차 무공은 한 번에 크게 때린다. 두목 앞에서 체감이 다르다.',
    goal: tier(2) },
  { id: 'duel', title: '고수 한 명을 쓰러뜨리자', tab: 'map/masters', min: 10, xp: 0.25,
    why: '지도 → 무림고수. 세 세력의 이름난 고수가 모여 있다(레벨 45부터). 처음 쓰러뜨리면 공격력·체력이 영구히 오르고 큰 보상을 준다. 고수 구역에서는 세력 재료가 나온다.',
    goal: (g) => ({ now: Object.keys(g.s.duel?.won || {}).length, need: 1 }) },
  { id: 'lore', title: '인물록을 펼쳐 보자', tab: 'social/lore', min: 3, xp: 0.1,
    why: '무림 창 → 인물록. 고수들의 내력과 쓰는 무공, 어디에 사는지가 적혀 있다.',
    goal: flag('lore') },
  // ---- 8. 키우기 (레벨 40~75) ----
  { id: 'promote', title: '두목 증표로 장비 등급을 올려 보자', tab: 'bag/gear', min: 8, xp: 0.15,
    why: '장비를 눌러 → 등급 각인. 어느 두목의 증표든 된다 — 센 두목 것일수록 잘 붙고, 실패해도 다음 확률이 올라 언젠가는 붙는다. 이번엔 증표를 챙겨 줬다.',
    goal: flag('infuse'),
    gift: (g) => { const k = W.bossKey(W.stepMap(W.stepOfLevel(g.s.level))); g.addMats(k, W.INFUSE_MARKS[1] * 2); return '두목 증표'; } },
  { id: 'reimp', title: '각인의 스킬 변화를 다시 굴려 보자', tab: 'bag/gear', min: 8, xp: 0.15,
    why: '장비를 눌러 → 각인 칸 → 다시 굴리기. 스킬 변화(범위·두 번·숨·피해)가 새로 뽑힌다 — 센 두목의 증표일수록 높은 등급이 잘 나온다. 증표를 조금 챙겨 줬다.',
    goal: flag('reimp'),
    gift: (g) => {
      const it = W.SLOTS.map((x) => g.s.equip[x.id]).find((x) => x?.imps?.length);
      const e = it?.imps?.[0]; const k = typeof e === 'string' ? e : e?.k;
      if (!k) return null;
      g.addMats(k, W.INFUSE_MARKS[1]); return '두목 증표';
    } },
  { id: 'line', title: '장비에 계열 각인을 해 보자', tab: 'bag/gear', min: 10, xp: 0.2,
    why: '장비를 눌러 → 계열. 무림맹·사파·마교 고수 구역의 세력 재료로 장비의 성질(공격·방어·속도…)을 바꾼다.',
    goal: flag('line') },
  { id: 'enh7', title: '무기를 +7까지', tab: 'bag/gear', min: 8, xp: 0.15,
    why: '+7부터 칼빛이 반짝인다. +10을 넘기려면 두목 증표가 든다.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 7 }) },
  { id: 'prot', title: '강화 보호부를 사 두자', tab: 'town/shop', min: 8, xp: 0.1,
    why: '마을 → 상인. +11부터 강화에 실패하면 -2 — 보호부가 있으면 하나를 태우고 그대로다.',
    goal: flag('prot') },
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
  { id: 'skill10', title: '무공 하나를 Lv10까지', tab: 'char/skill', min: 10, xp: 0.2,
    why: 'Lv10에 범위가 한 번 더 넓어지고 치명이 붙는다. 다시 고르고 싶으면 무공 초기화(처음 한 번 공짜).',
    goal: (g) => ({ now: Math.max(1, ...Object.values(g.s.skillLv || {})), need: 10 }) },
  { id: 'lv70', mile: true, title: '레벨 70까지', tab: 'map', min: 12, xp: 0,
    why: '혼원일기공(70)이 열린다. 3차 전직(75)이 가깝다.',
    goal: lv(70) },
  { id: 'petLv', title: '애완동물을 레벨 10까지', tab: 'comp/pet', min: 10, xp: 0.15,
    why: '데려간 애완동물은 함께 사냥하며 자란다. 레벨이 오를수록 버프가 세진다.',
    goal: (g) => ({ now: Math.max(0, ...g.s.pets.map((p) => p.lv)), need: 10 }) },
  { id: 'treasure', title: '보물 원숭이를 잡자', tab: 'map', min: 12, xp: 0.2,
    why: '사냥터에 가끔 금빛 원숭이가 나타난다. 25초 안에 잡으면 은자·재료가 쏟아진다.',
    goal: flag('treasure') },
  { id: 'raid', title: '문파 토벌에 한 번 참여하자', tab: 'dgn/raid', min: 10, xp: 0.2, skip: true,
    why: '던전 창 → 문파 토벌. 한 주에 두목 하나를 문파원 모두가 함께 깎는다.',
    goal: flag('raid') },
  { id: 'mast5', title: '한 지역 숙련도 5', tab: 'map', min: 12, xp: 0.2,
    why: '숙련 5면 그 지역의 나쁜 기운을 거의 견딘다.',
    goal: (g) => ({ now: mastMax(g), need: 5 }) },
  { id: 'tier3', mile: true, title: '레벨 75에 3차 전직', tab: 'town/master', min: 15, xp: 0.3,
    why: '3차는 비기다. 여기서부터 장비 사다리의 끝이 보인다.',
    goal: tier(3) },
  { id: 'lv80', mile: true, title: '레벨 80까지', tab: 'map', min: 14, xp: 0,
    why: '고수 구역의 세력 재료로 계열 각인을 바꿔 보자.',
    goal: lv(80) },
  { id: 'fuse', title: '탈것을 합성해 보자', tab: 'comp/mount', min: 10, xp: 0.15, skip: true,
    why: '동료 → 탈것. 같은 순위 셋 + 은자로 다음 순위 하나. 두목이 떨군 탈것이 쌓였을 때.',
    goal: flag('fuse') },
  { id: 'duel5', title: '고수 다섯을 쓰러뜨리자', tab: 'map/masters', min: 15, xp: 0.25,
    why: '고수 하나마다 영구 능력치가 쌓인다. 세력마다 무공과 경고 모양이 다르다.',
    goal: (g) => ({ now: Object.keys(g.s.duel?.won || {}).length, need: 5 }) },
  { id: 'imp2', title: '장비 하나에 각인 두 칸', tab: 'bag/gear', min: 14, xp: 0.2,
    why: '등급 각인을 두 번(전설). 같은 두목 증표 6개 — 센 두목 것일수록 잘 붙는다.',
    goal: (g) => ({ now: Math.max(0, ...W.SLOTS.map((x) => g.s.equip[x.id]?.imps?.length || 0)), need: 2 }) },
  { id: 'imp3', title: '장비 하나에 각인 세 칸을 채우자', tab: 'bag/gear', min: 15, xp: 0.25,
    why: '각인은 칸마다 그 두목의 테마 효과와 스킬 변화를 붙인다. 세 칸이 다 차면 신화 — 백 레벨 넘는 두목 증표는 고유 효과를 고를 수 있다.',
    goal: (g) => ({ now: Math.max(0, ...W.SLOTS.map((x) => g.s.equip[x.id]?.imps?.length || 0)), need: 3 }) },
  // ---- 9. 십이지왕 (레벨 75~) ----
  { id: 'tower30', title: '무한의 탑 30층까지', tab: 'dgn/tower', min: 15, xp: 0.25,
    why: '십이지신 셋을 넘긴 셈이다.',
    goal: floor(30) },
  { id: 'tower40', title: '무한의 탑 40층까지', tab: 'dgn/tower', min: 16, xp: 0.25,
    why: '넷째 십이지신. 층마다 영구 공격력·체력.',
    goal: floor(40) },
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
  { id: 'mast10', title: '한 지역 숙련도 10', tab: 'map', min: 18, xp: 0.25,
    why: '눌러앉아 파밍하는 곳의 숙련을 끝까지 — 경험치·재료가 크게 는다.',
    goal: (g) => ({ now: mastMax(g), need: 10 }) },
  { id: 'tier4', mile: true, title: '레벨 100에 4차 전직', tab: 'town/master', min: 20, xp: 0.3,
    why: '마지막 무공이다. 여기서부터는 왕의 장비를 모은다.',
    goal: tier(4) },
  { id: 'skillMax', title: '무공 하나를 만렙(極 15)', tab: 'char/skill', min: 20, xp: 0.25,
    why: `만렙 ${W.SKILL_LV_MAX}에 범위·치명이 한 번 더 붙는다. 점수는 모자라니 주력 무공에.`,
    goal: (g) => ({ now: Math.max(1, ...Object.values(g.s.skillLv || {})), need: W.SKILL_LV_MAX }) },
  { id: 'set1', title: '세트 장비를 하나 끼자', tab: 'bag/smith', min: 20, xp: 0.25,
    why: '대장장이 → 세트 99~. 그 부위 왕의 재료·증표로 만들거나 왕이 떨군 것을 낀다. 2·3·5조각 효과.',
    goal: (g) => ({ now: Object.values(g.s.equip).filter((it) => it?.set).length, need: 1 }) },
  { id: 'kacc', title: '왕의 장신구를 만들자', tab: 'bag/smith', min: 20, xp: 0.25,
    why: '대장장이 → 장신구 99~. 어느 직업이든 쓰는 공용 장신구 — 스킬 옵션이 하나 더 붙는다.',
    goal: flag('kacc') },
  { id: 'coop', title: '문파원과 함께 왕을 잡자', tab: 'map/king', min: 20, xp: 0.25, skip: true,
    why: '왕 구역에 "함께"로 들어가면 같은 구역의 문파원과 왕 체력을 나눈다. 한 대라도 치면 보상을 다 받는다.',
    goal: flag('coop') },
  { id: 'lv120', mile: true, title: '레벨 120까지', tab: 'map', min: 22, xp: 0,
    why: '후반 십이지왕과 팔마존이 기다린다.',
    goal: lv(120) },
  { id: 'tower50', title: '무한의 탑 50층까지', tab: 'dgn/tower', min: 25, xp: 0.3,
    why: '여기까지 왔으면 길잡이는 필요 없다. 탑은 120층까지.',
    goal: floor(50) },
  { id: 'enh10', title: '무기를 +10까지', tab: 'bag/gear', min: 25, xp: 0.25,
    why: '+10을 넘기면 두목 증표가 들고, 실패하면 -2. 실패할수록 다음 확률이 오르니(천장) 꾸준히 두드리자. 보호부를 챙기면 그대로.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 10 }) },
  { id: 'enh12', title: '무기를 +12까지', tab: 'bag/gear', min: 25, xp: 0.3,
    why: '돌파 구간 — 실패하면 -2지만 천장이 쌓인다. 보호부가 있으면 그대로.',
    goal: (g) => ({ now: g.s.equip.weapon?.plus || 0, need: 12 }) },
  { id: 'set5', title: '세트 다섯 조각을 맞추자', tab: 'bag/smith', min: 25, xp: 0.3,
    why: '5조각 효과가 세트의 핵심이다. 맹주들과 천마의 세트가 가장 세다.',
    goal: (g) => ({ now: Object.values(g.s.equip).filter((it) => it?.set).length, need: 5 }) },
  { id: 'lord', title: '맹주를 쓰러뜨리자', tab: 'map/masters', min: 25, xp: 0.3,
    why: '무림맹주·사도맹주는 세력의 끝이다. 처음 쓰러뜨리면 영구 능력치가 고수의 세 배. 그 너머에는 천마가 있다.',
    goal: (g) => ({ now: Object.keys(g.s.duel?.won || {}).filter((id) => MS.masterOf(id)?.lord).length, need: 1 }) },
  { id: 'lv150', mile: true, title: '레벨 150 — 강호의 끝', tab: 'map', min: 25, xp: 0,
    why: '여기까지 온 무인은 드물다. 천마에게 도전해 보자.',
    goal: lv(150) },
];

export const QUEST_COUNT = QUESTS.length;
export const QUEST_V = 4;
// v180: 판 2의 차례 — 판 3으로 옮길 때 '지금 하던 단계'를 찾는다(끼워 넣은 단계는 새로 해 보게)
export const QUEST_V3_IDS = ['job', 'kill10', 'move', 'zoom', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'potionAt', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'tier1', 'skill', 'range', 'pet', 'mount', 'passive', 'lv20', 'saver', 'app', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'convert', 'book', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'duel', 'lore', 'promote', 'reimp', 'line', 'enh7', 'prot', 'lv50', 'daily10', 'tower20', 'lv60', 'petLv', 'treasure', 'raid', 'mast5', 'tier3', 'duel5', 'imp3', 'tower30', 'gear6', 'lv90', 'king', 'kingKill', 'tier4', 'set1', 'kacc', 'coop', 'tower50', 'enh10', 'set5', 'lord'];
// v208: 판마다 차례 — 옛 판에서 옮길 때 '하던 단계'를 찾고, 새로 끼운 단계를 짚는다
export const QUEST_V2_IDS = ['job', 'kill10', 'move', 'stat', 'lv5', 'craft', 'enh1', 'potion', 'refill', 'area2', 'lv10', 'armor', 'boss', 'enh3', 'tier1', 'skill', 'pet', 'mount', 'passive', 'lv20', 'daily', 'dauto', 'sweep', 'tower3', 'gear4', 'mast1', 'lv30', 'guild', 'checkin', 'donate', 'bag', 'alt', 'tower10', 'zodiac', 'tier2', 'promote', 'enh7', 'lv50', 'daily10', 'tower20', 'lv60', 'treasure', 'raid', 'mast5', 'tier3', 'tower30', 'gear6', 'lv90', 'king', 'kingKill', 'tier4', 'set1', 'kacc', 'coop', 'tower50'];
export const questAt = (i) => QUESTS[i] || null;

// 보상 — 그 레벨에서 사냥 min분어치 은자(1분 ≈ 몹 은자 100마리, 시뮬레이션) · 그 레벨 경험치 xp할
export const GOLD_PER_MIN = 100;
export function questReward(q, level) {
  const out = {};
  if (q.min) out.gold = Math.round(W.mobGold(level) * GOLD_PER_MIN * q.min);
  if (q.xp) out.exp = Math.round(W.expToNext(level) * q.xp);
  return out;
}

export const QUEST_IDS_BY_V = { 2: QUEST_V2_IDS, 3: QUEST_V3_IDS };
