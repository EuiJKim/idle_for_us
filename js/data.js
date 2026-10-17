// 게임 수치·세계관 테이블. 모든 공식은 여기에서만 정의한다. (무협 회귀 테마)

export const SAVE_VERSION = 4;
export const OFFLINE_CAP_SEC = 12 * 3600;
export const KILLS_PER_STAGE = 10;
// 한 번에 나오는 적 수(최대). 관문이 오를수록 더 몰려온다.
// 근거: Blade Idle은 한 스테이지에 적 그룹(wavegroup)이 보통 4개씩 잡혀 있고 47초 안에 정리된다.
export const MOB_GROUP_MAX = 4;
export const mobGroupSize = (stage) => Math.min(MOB_GROUP_MAX, 1 + Math.floor(stage / 8));
export const BOSS_TIME = 30;
export const SPAWN_DELAY = 0.45;
export const RAID_TIME = 30;
export const RAID_TICKETS = 3;
export const RAID_HP_SECONDS = 60; // 토벌 두목 HP = 문파원 DPS 합 × 이 값
export const MERGE_COUNT = 4;
export const GACHA_COST = 100;
export const GACHA10_COST = 900;
export const DAILY_GEMS = 300;
export const START_GEMS = 1000;
export const SPEED_CAP = 3;
export const CRIT_CAP = 0.5;

// 재화 이름과 한자 표기 (save 키는 그대로 두고 화면 이름만 무협식)
export const CUR = {
  gold: { name: '은자', hz: '銀' },
  gems: { name: '원보', hz: '寶' },
  books: { name: '비급', hz: '秘' },
  stones: { name: '한철', hz: '鐵' },
  food: { name: '영수 먹이', hz: '草' },
  relicShards: { name: '신물 조각', hz: '片' },
};

// ---------- 은자 수련 ----------
export const UPGRADES = {
  atk: {
    name: '외공(공격력)', icon: '拳',
    value: (l) => 10 * Math.pow(1.05, l),
    cost: (l) => 10 * Math.pow(1.06, l),
    fmt: 'num',
  },
  hp: {
    name: '내공(체력)', icon: '氣',
    value: (l) => 100 * Math.pow(1.05, l),
    cost: (l) => 10 * Math.pow(1.06, l),
    fmt: 'num',
  },
  crit: {
    name: '혈도 찌르기(치명 확률)', icon: '穴', max: 90,
    value: (l) => 0.05 + l * 0.005,
    cost: (l) => 40 * Math.pow(1.13, l),
    fmt: 'pct',
  },
  critDmg: {
    name: '파괴력(치명 피해)', icon: '破',
    value: (l) => 1.5 + l * 0.05,
    cost: (l) => 30 * Math.pow(1.12, l),
    fmt: 'pct',
  },
  speed: {
    name: '쾌검(공격 속도)', icon: '快', max: 100,
    value: (l) => 1 + l * 0.02,
    cost: (l) => 40 * Math.pow(1.11, l),
    fmt: 'x',
  },
  gold: {
    name: '상재(은자 획득)', icon: '銀',
    value: (l) => 1 + l * 0.05,
    cost: (l) => 25 * Math.pow(1.12, l),
    fmt: 'pct',
  },
};

// ---------- 레벨 / 스탯 포인트 ----------
export const expPerKill = (s) => 4 * Math.pow(1.1, s - 1);
export const expToNext = (lv) => 60 * Math.pow(1.1, lv - 1);
export const SP_PER_LEVEL = 2;
export const SP_RESET_GEMS = 200;
export const SP_STATS = {
  atk: { name: '근력', icon: '力', per: 0.02, desc: (v) => `공격력 +${pctText(v)}` },
  hp: { name: '체질', icon: '體', per: 0.02, desc: (v) => `체력 +${pctText(v)}` },
  critDmg: { name: '살기', icon: '殺', per: 0.01, desc: (v) => `치명 피해 +${pctText(v)}` },
  boss: { name: '투지', icon: '鬪', per: 0.02, desc: (v) => `두목에게 주는 피해 +${pctText(v)}` },
  gold: { name: '재운', icon: '財', per: 0.01, desc: (v) => `은자 +${pctText(v)}` },
  exp: { name: '오성', icon: '悟', per: 0.01, desc: (v) => `경험치 +${pctText(v)}` },
};
function pctText(v) { return `${Math.round(v * 1000) / 10}%`; }

// ---------- 경지 ----------
// level: 필요 레벨, stage: 심마 강함(스테이지 환산), look: 무복 외형
export const RANKS = [
  { name: '삼류', level: 1, stage: 1, look: { robe: '#6b5640', trim: '#3b2f22', sash: '#2a2118', band: '#7f1d1d' } },
  { name: '이류', level: 15, stage: 15, look: { robe: '#344563', trim: '#1e293b', sash: '#a16207', band: '#1e3a8a' } },
  { name: '일류', level: 35, stage: 35, look: { robe: '#1f5f8b', trim: '#f1f5f9', sash: '#f1f5f9', band: '#0c4a6e' } },
  { name: '절정', level: 60, stage: 60, look: { robe: '#1c1917', trim: '#d4a64a', sash: '#d4a64a', band: '#b91c1c', aura: '#d4a64a' } },
  { name: '초절정', level: 90, stage: 90, look: { robe: '#f5f0e6', trim: '#94a3b8', sash: '#475569', band: '#334155', aura: '#cbd5e1' } },
  { name: '화경', level: 130, stage: 130, look: { robe: '#f8f4ea', trim: '#d4a64a', sash: '#b45309', band: '#b45309', aura: '#fcd34d', hair: '#e5e7eb' } },
  { name: '현경', level: 180, stage: 180, look: { robe: '#4c1d5f', trim: '#e9d5ff', sash: '#e9d5ff', band: '#a855f7', aura: '#c084fc', swords: 1 } },
  { name: '생사경', level: 240, stage: 240, look: { robe: '#0b0b0d', trim: '#dc2626', sash: '#7f1d1d', band: '#dc2626', aura: '#ef4444', swords: 2 } },
  { name: '자연경', level: 310, stage: 310, look: { robe: '#134e4a', trim: '#99f6e4', sash: '#ccfbf1', band: '#5eead4', aura: '#5eead4', swords: 3, hair: '#f1f5f9' } },
  { name: '천인합일', level: 400, stage: 400, look: { robe: '#fffbeb', trim: '#f59e0b', sash: '#fde68a', band: '#f59e0b', aura: '#fde68a', swords: 4, halo: true, hair: '#ffffff' } },
];
export const RANK_MULT = 1.5; // 경지마다 공격력·체력 ×1.5
export const TRIAL_TIME = 40;
export const trialBoss = (r) => ({
  hp: monsterHp(RANKS[r].stage) * BOSS_HP_MULT * 2,
  atk: monsterAtk(RANKS[r].stage) * BOSS_ATK_MULT,
});

// ---------- 회귀 ----------
export const REGRESS_MIN_STAGE = 80;
export const REGRESS_PER_POINT = 0.1; // 전생의 기억 1개당 공격력·체력·은자·경험치 +10%
export const regressGain = (maxStage) => (maxStage < REGRESS_MIN_STAGE ? 0 : Math.floor((maxStage - 50) / 5));

// ---------- 병기 ----------
export const GRADES = [
  { name: '범품', color: '#a8a29e' },
  { name: '양품', color: '#4ade80' },
  { name: '진품', color: '#60a5fa' },
  { name: '보품', color: '#c084fc' },
  { name: '신품', color: '#f59e0b' },
  { name: '천품', color: '#ef4444' },
];
export const GACHA_RATES = [0.6, 0.28, 0.09, 0.025, 0.0045, 0.0005];

// equip: 가장 좋은 등급 하나의 보너스, own: 보유한 등급마다 더해지는 보너스
export const EQUIP_TYPES = {
  weapon: { name: '검', icon: '劍', stat: 'atk', label: '공격력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  armor: { name: '호신의', icon: '衣', stat: 'hp', label: '체력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  ring: { name: '옥패', icon: '玉', stat: 'gold', label: '은자',
    equip: [0.1, 0.25, 0.6, 1.5, 4, 10], own: [0.03, 0.06, 0.15, 0.4, 1, 2.5] },
};
export const ENHANCE_PER = 0.08; // 제련 1단계마다 해당 부위 배율에 +8%p (선형)
export const enhanceCost = (e) => 5 + e * 3; // 한철

// ---------- 영수 ----------
export const PETS = [
  { id: 'dog', name: '백학', emoji: '🦢', grade: 0, atk: 0.3, own: ['hp', 0.03] },
  { id: 'cat', name: '영묘', emoji: '🐈', grade: 0, atk: 0.3, own: ['gold', 0.03] },
  { id: 'fox', name: '구미호', emoji: '🦊', grade: 1, atk: 0.5, own: ['atk', 0.03] },
  { id: 'owl', name: '영원(靈猿)', emoji: '🐒', grade: 2, atk: 0.7, own: ['exp', 0.04] },
  { id: 'panda', name: '식철수', emoji: '🐼', grade: 2, atk: 0.8, own: ['critDmg', 0.04] },
  { id: 'unicorn', name: '기린', emoji: '🦌', grade: 3, atk: 1.2, own: ['boss', 0.05] },
  { id: 'tiger', name: '백호', emoji: '🐯', grade: 4, atk: 2, own: ['atk', 0.08] },
  { id: 'dragon', name: '청룡', emoji: '🐲', grade: 5, atk: 3.5, own: ['atk', 0.12] },
];
export const PET_EGG_COST = 150;
export const PET_GRADE_WEIGHT = [45, 30, 15, 7, 2.5, 0.5];
export const petFoodCost = (lv) => 10 * lv;
export const PET_DUPLICATE_FOOD = (grade) => 15 * (grade + 1);
export const PET_ATTACK_INTERVAL = 1.2;
export const petDamageMult = (pet, lv) => pet.atk * (1 + 0.1 * (lv - 1));

// ---------- 영수 교감 / 각인 ----------
// 근거: Blade Idle은 펫에 친밀도(PetIntimacyTable)와 각인(PetEngraveLevelTable)을 따로 두어
// "오래 데리고 다닌 것"과 "한 번 키워둔 것"을 모두 보상한다. 그래서 모든 펫을 키울 이유가 생긴다.
export const BOND_PER_SEC = 1;                     // 데리고 싸우는 1초당 교감
export const BOND_MAX = 10;                        // 교감 최고 단계
export const BOND_PER_LV = 0.12;                   // 교감 한 단계마다 그 영수의 고유 효과 +12%
export const bondNeed = (lv) => Math.round(900 * Math.pow(1.55, lv)); // 다음 단계까지 필요한 교감
export const bondLevel = (bond) => {
  let lv = 0; let rest = bond || 0;
  while (lv < BOND_MAX && rest >= bondNeed(lv)) { rest -= bondNeed(lv); lv += 1; }
  return lv;
};
export const bondProgress = (bond) => {
  let lv = 0; let rest = bond || 0;
  while (lv < BOND_MAX && rest >= bondNeed(lv)) { rest -= bondNeed(lv); lv += 1; }
  return lv >= BOND_MAX ? { lv, cur: 0, need: 0 } : { lv, cur: Math.floor(rest), need: bondNeed(lv) };
};
// ---------- 출석(연공 일지) / 기연 ----------
// 근거: Blade Idle은 AttendanceTable(출석)과 AdBuffTable(광고 버프)로 매일 들어올 이유를 만든다.
export const ATTEND_CYCLE = 7;              // 7일 주기
export const attendReward = (day) => {      // day: 1~7
  if (day >= ATTEND_CYCLE) return { gems: 500, books: 5, stones: 20, food: 300 };
  if (day % 3 === 0) return { gems: 200, stones: 10, food: 150 };
  return { gems: 100, food: 80 };
};
export const BOOST_PER_DAY = 3;             // 기연은 하루 3번
export const BOOST_SEC = 1800;              // 30분 동안
export const BOOST_MULT = 2;                // 공격력 2배

export const ENGRAVE_MIN_LV = 3;                   // 이 교감 단계부터 각인할 수 있다
export const engraveCost = (lv) => 300 * lv;       // 각인에 드는 영수 먹이
export const OWN_STAT_NAMES = { atk: '공격력', hp: '체력', gold: '은자', exp: '경험치', critDmg: '치명 피해', boss: '두목 피해' };

// ---------- 신물 ----------
export const RELICS = [
  { id: 'sword', name: '만년한철', icon: '鐵', stat: 'atk', per: 0.06, max: 100, text: '공격력' },
  { id: 'heart', name: '천년설삼', icon: '蔘', stat: 'hp', per: 0.06, max: 100, text: '체력' },
  { id: 'grail', name: '금두꺼비', icon: '蟾', stat: 'gold', per: 0.05, max: 100, text: '은자' },
  { id: 'orb', name: '공청석유', icon: '乳', stat: 'exp', per: 0.05, max: 100, text: '경험치' },
  { id: 'fang', name: '탈혼비수', icon: '匕', stat: 'boss', per: 0.06, max: 100, text: '두목 피해' },
  { id: 'glass', name: '선향', icon: '香', stat: 'bossTime', per: 0.5, max: 30, text: '두목 제한시간', unit: '초' },
  { id: 'moon', name: '월광옥패', icon: '月', stat: 'offline', per: 0.05, max: 60, text: '방치 보상' },
  { id: 'feather', name: '능공허도 비급', icon: '飛', stat: 'speed', per: 0.01, max: 50, text: '공격 속도(한계 돌파)' },
];
export const RELIC_DIG_COST = 10; // 신물 조각

// ---------- 무공 ----------
export const SKILLS = [
  { id: 'slash', name: '선풍검', hz: '旋風劍', icon: '旋', unlock: 1, cd: 6, kind: 'dmg', target: 'all',
    mult: (l) => 4 + l * 0.6, desc: (m) => `적 전체에게 공격력의 ${m.toFixed(1)}배 검기` },
  { id: 'rage', name: '혈마해방', hz: '血魔解放', icon: '血', unlock: 5, cd: 25, dur: 8, kind: 'buff',
    mult: (l) => 1.5 + l * 0.06, desc: (m) => `8초간 공격력 ${m.toFixed(2)}배` },
  { id: 'heal', name: '운기조식', hz: '運氣調息', icon: '息', unlock: 12, cd: 18, kind: 'heal',
    mult: (l) => Math.min(1, 0.3 + l * 0.02), desc: (m) => `체력 ${Math.round(m * 100)}% 회복` },
  { id: 'thunder', name: '뇌정검', hz: '雷霆劍', icon: '雷', unlock: 25, cd: 15, kind: 'dmg', target: 'all',
    mult: (l) => 12 + l * 1.8, desc: (m) => `적 전체에게 공격력의 ${m.toFixed(1)}배 낙뢰` },
  { id: 'gale', name: '질풍보', hz: '疾風步', icon: '疾', unlock: 40, cd: 30, dur: 10, kind: 'buff',
    mult: (l) => 1.5 + l * 0.03, desc: (m) => `10초간 공격 속도 ${m.toFixed(2)}배 (한계 돌파)` },
  { id: 'midas', name: '천금수', hz: '千金手', icon: '金', unlock: 60, cd: 45, dur: 15, kind: 'buff',
    mult: (l) => 2 + l * 0.1, desc: (m) => `15초간 은자 ${m.toFixed(1)}배` },
  { id: 'frost', name: '빙백신장', hz: '氷魄神掌', icon: '氷', unlock: 80, cd: 20, kind: 'dmg', stun: 3, target: 'single', bossMult: 1.8,
    mult: (l) => 8 + l * 1.2, desc: (m) => `한 명에게 공격력의 ${m.toFixed(1)}배 + 3초 빙결 · 두목에겐 1.8배` },
  { id: 'meteor', name: '만검귀종', hz: '萬劍歸宗', icon: '萬', unlock: 100, cd: 40, kind: 'dmg', target: 'all',
    mult: (l) => 40 + l * 6, desc: (m) => `적 전체에게 검 비 · 공격력의 ${m.toFixed(0)}배` },
];
export const SKILL_SLOTS = 4;
export const skillBookCost = (l) => Math.ceil(2 * Math.pow(1.15, l - 1));

// ---------- 적 무인 외형 ----------
// head: band(머리띠) topknot(상투) hat(삿갓) hood(두건) mask(복면) bald(민머리) jiangshi(강시 관)
// weapon: sword(검) saber(도) spear(창) axe(도끼) fan(부채) fist(맨손) claw(조법) dagger(비수)
const F = (name, look) => ({ name, look });
const B = (name, emoji) => ({ name, emoji }); // 짐승은 이모지

// ---------- 수련터 ----------
export const DUNGEONS = [
  { id: 'gold', name: '흑도 전장', icon: '錢', unlock: 10, reward: '은자',
    mob: F('전장 호위', { robe: '#3f3a36', head: 'band', band: '#111', weapon: 'saber' }),
    boss: F('전장주', { robe: '#78350f', trim: '#d4a64a', head: 'topknot', weapon: 'axe', beard: true, scale: 1.35 }) },
  { id: 'stone', name: '한철 광산', icon: '鐵', unlock: 20, reward: '한철',
    mob: F('광산 파수꾼', { robe: '#44403c', head: 'hood', weapon: 'axe' }),
    boss: F('철갑 거한', { robe: '#1f2937', trim: '#9ca3af', head: 'bald', weapon: 'fist', scale: 1.5 }) },
  { id: 'pet', name: '영수 계곡', icon: '獸', unlock: 30, reward: '영수 먹이',
    mob: B('계곡 늑대', '🐺'), boss: B('산군(山君)', '🐅') },
  { id: 'relic', name: '고수의 동부', icon: '洞', unlock: 40, reward: '신물 조각',
    mob: F('동부 강시', { robe: '#1e3a5f', head: 'jiangshi', skin: '#a3b8a0', weapon: 'claw', jiangshi: true }),
    boss: F('천년 강시', { robe: '#0f172a', trim: '#d4a64a', head: 'jiangshi', skin: '#8fa08a', weapon: 'claw', jiangshi: true, scale: 1.45 }) },
];
export const DUNGEON_KEYS = 2;
export const DUNGEON_TIME = 40;
export const DUNGEON_MOBS = 12;
export const dungeonStage = (d, lv) => d.unlock + (lv - 1) * 4;
export function dungeonReward(id, lv) {
  const eq = dungeonStage(DUNGEONS.find((d) => d.id === id), lv);
  switch (id) {
    case 'gold': return { gold: monsterGold(eq) * 400 };
    case 'stone': return { stones: 30 + lv * 8 };
    case 'pet': return { food: 20 + lv * 6 };
    case 'relic': return { relicShards: 10 + lv * 2 };
    default: return {};
  }
}

// ---------- 일일 의뢰 / 업적 ----------
export const MISSIONS = [
  { id: 'kill', name: '적 500명 처치', goal: 500, reward: { gems: 50 } },
  { id: 'boss', name: '두목 5명 처치', goal: 5, reward: { gems: 50, books: 5 } },
  { id: 'upgrade', name: '수련·제련 30회', goal: 30, reward: { gems: 50, stones: 20 } },
  { id: 'dungeon', name: '수련터 3회 도전', goal: 3, reward: { gems: 100 } },
  { id: 'gacha', name: '뽑기 10회 (병기·영수)', goal: 10, reward: { gems: 50 } },
  { id: 'pvp', name: '비무 3회', goal: 3, reward: { gems: 100 } },
  { id: 'raid', name: '문파 토벌 1회', goal: 1, reward: { gems: 100 } },
];
export const MISSION_ALL_REWARD = { gems: 300, books: 10 };
export const stageMilestone = () => ({ gems: 200, books: 10, stones: 30 }); // 25관문마다
export const STAGE_MILESTONE_EVERY = 25;

// ---------- 비무대 ----------
export const PVP_TICKETS = 5;
export const PVP_TIME = 30;
export const PVP_WIN = 20;
export const PVP_LOSE = -8;
export const PVP_REWARD = { win: { gems: 50 }, lose: { gems: 10 } };

// ---------- 강호 지역 / 적 ----------
// ink: 수묵 배경 팔레트 [하늘 위, 하늘 아래, 먼 산, 땅], sun: 해·달, prop: 배경 소품
export const ZONES = [
  { name: '객잔 마을', ink: ['#efe4cc', '#dccaa6', '#6b6155', '#5b4b3a'], sun: '#c0392b', prop: 'village',
    mobs: [
      F('왈패', { robe: '#6b5b4b', head: 'band', band: '#8b0000', weapon: 'fist' }),
      F('좀도둑', { robe: '#3f3f46', head: 'hood', weapon: 'dagger' }),
      F('산적', { robe: '#7c5c3c', head: 'band', band: '#422006', weapon: 'saber', beard: true }),
      F('낭인', { robe: '#57534e', head: 'hat', weapon: 'sword' }),
    ],
    boss: F('흑풍채 채주', { robe: '#1c1917', trim: '#7f1d1d', head: 'band', band: '#111', weapon: 'axe', beard: true, scale: 1.4 }) },
  { name: '죽림', ink: ['#e3e8da', '#c3cfb4', '#4b5e48', '#3a4a33'], sun: '#b91c1c', prop: 'bamboo',
    mobs: [
      F('흑의 자객', { robe: '#18181b', head: 'mask', weapon: 'sword' }),
      F('독문 제자', { robe: '#365314', trim: '#a3e635', head: 'topknot', weapon: 'claw' }),
      F('죽림 도적', { robe: '#57534e', head: 'hat', weapon: 'spear' }),
      F('비수 살수', { robe: '#27272a', head: 'mask', weapon: 'dagger' }),
    ],
    boss: F('독수마군', { robe: '#14532d', trim: '#bef264', head: 'topknot', weapon: 'claw', aura: '#84cc16', scale: 1.4 }) },
  { name: '황사 서역', ink: ['#f3d9a4', '#d9a95e', '#8a5a2b', '#7a4f22'], sun: '#9a3412', prop: 'dune',
    mobs: [
      F('사막 도적', { robe: '#a16207', head: 'hood', weapon: 'saber' }),
      F('서역 무승', { robe: '#c2410c', head: 'bald', weapon: 'fist' }),
      F('창기병', { robe: '#78350f', head: 'band', band: '#7f1d1d', weapon: 'spear' }),
      F('사막 낭인', { robe: '#92400e', head: 'hat', weapon: 'sword' }),
    ],
    boss: F('혈사도왕', { robe: '#7f1d1d', trim: '#fbbf24', head: 'hood', weapon: 'saber', beard: true, scale: 1.45 }) },
  { name: '천산 설원', ink: ['#eef2f6', '#cfd9e4', '#7b8a9c', '#e6ebf0'], sun: '#c0392b', prop: 'snowpine', snow: true,
    mobs: [
      F('빙궁 제자', { robe: '#f8fafc', trim: '#60a5fa', head: 'topknot', weapon: 'sword' }),
      F('설산 야인', { robe: '#78716c', head: 'bald', weapon: 'axe', beard: true, scale: 1.15 }),
      F('천산 검객', { robe: '#64748b', head: 'hat', weapon: 'sword' }),
      F('빙궁 호법', { robe: '#e0f2fe', trim: '#0284c7', head: 'band', band: '#0284c7', weapon: 'spear' }),
    ],
    boss: F('빙백궁주', { robe: '#f0f9ff', trim: '#38bdf8', head: 'topknot', hair: '#e2e8f0', weapon: 'fan', aura: '#7dd3fc', scale: 1.4 }) },
  { name: '혈사곡', ink: ['#e8c3b0', '#b8644e', '#5b2a22', '#3b1a15'], sun: '#7f1d1d', prop: 'rock',
    mobs: [
      F('혈교 무사', { robe: '#991b1b', head: 'band', band: '#111', weapon: 'saber' }),
      F('혈귀', { robe: '#450a0a', head: 'topknot', skin: '#e7d4d4', weapon: 'claw', eyes: '#ef4444' }),
      F('혈교 사자', { robe: '#1c1917', trim: '#dc2626', head: 'mask', weapon: 'spear' }),
      F('혈교 술사', { robe: '#7f1d1d', head: 'hood', weapon: 'fan' }),
    ],
    boss: F('혈교 장로', { robe: '#450a0a', trim: '#ef4444', head: 'topknot', hair: '#e5e7eb', weapon: 'claw', beard: true, aura: '#dc2626', eyes: '#ef4444', scale: 1.45 }) },
  { name: '귀곡', ink: ['#5b6273', '#2f3542', '#1b1f29', '#14171f'], sun: '#e5e7eb', moon: true, prop: 'grave', night: true,
    mobs: [
      F('강시', { robe: '#1e3a5f', head: 'jiangshi', skin: '#a3b8a0', weapon: 'claw', jiangshi: true }),
      F('원귀 검객', { robe: '#9ca3af', head: 'topknot', hair: '#111', weapon: 'sword', ghost: true }),
      F('사술사', { robe: '#4c1d95', head: 'hood', weapon: 'fan' }),
      F('묘지기', { robe: '#3f3f46', head: 'hat', weapon: 'spear' }),
    ],
    boss: F('강시왕', { robe: '#0f172a', trim: '#d4a64a', head: 'jiangshi', skin: '#8fa08a', weapon: 'claw', jiangshi: true, scale: 1.5 }) },
  { name: '무당 운해', ink: ['#f1f5f9', '#d6e2ee', '#8aa0b6', '#a9b8c8'], sun: '#c0392b', prop: 'pavilion', clouds: true,
    mobs: [
      F('무당 도사', { robe: '#e2e8f0', trim: '#1e3a8a', head: 'topknot', weapon: 'fan' }),
      F('검진 제자', { robe: '#f8fafc', trim: '#334155', head: 'topknot', weapon: 'sword' }),
      F('무당 장로', { robe: '#cbd5e1', trim: '#0f172a', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'sword' }),
      F('태극 권사', { robe: '#1e293b', trim: '#f8fafc', head: 'band', band: '#f8fafc', weapon: 'fist' }),
    ],
    boss: F('태극검선', { robe: '#f8fafc', trim: '#0f172a', head: 'topknot', hair: '#f1f5f9', beard: true, weapon: 'sword', aura: '#e2e8f0', scale: 1.45 }) },
  { name: '십만대산 마교', ink: ['#3a2a35', '#1d1418', '#0d0a0c', '#0a0708'], sun: '#dc2626', prop: 'banner', night: true,
    mobs: [
      F('마교 교도', { robe: '#2e1065', trim: '#a21caf', head: 'band', band: '#a21caf', weapon: 'saber' }),
      F('천마 친위대', { robe: '#0a0a0a', trim: '#dc2626', head: 'mask', weapon: 'spear' }),
      F('마교 사자', { robe: '#450a0a', head: 'hood', weapon: 'claw', eyes: '#ef4444' }),
      F('마교 장로', { robe: '#1c1917', trim: '#a855f7', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'fan' }),
    ],
    boss: F('천마(天魔)', { robe: '#050505', trim: '#dc2626', head: 'topknot', hair: '#111', weapon: 'sword', aura: '#dc2626', eyes: '#ef4444', scale: 1.55 }) },
];
export const RAID_BOSS = F('혈마(血魔)', { robe: '#1a0505', trim: '#ef4444', head: 'topknot', hair: '#7f1d1d', weapon: 'saber', aura: '#dc2626', eyes: '#fca5a5', scale: 2.1 });

// 지역 티어 — 8지역(80관문)을 한 바퀴 돌 때마다 같은 땅이 더 험해진다.
// 근거: Blade Idle은 배경 8종을 S·T 티어로 재활용해 23개 구간을 만든다(에셋 추가 없이 볼륨 3배).
export const ZONE_TIERS = [
  { prefix: '', sun: null },
  { prefix: '흉지 ', sun: '#7f1d1d' },
  { prefix: '마경 ', sun: '#4c1d95' },
  { prefix: '구천 ', sun: '#0c4a6e' },
  { prefix: '무간 ', sun: '#18181b' },
];
export const ZONE_CYCLE = 10 * ZONES.length; // 한 바퀴 = 80관문
export const zoneTierOf = (stage) => Math.min(Math.floor((stage - 1) / ZONE_CYCLE), ZONE_TIERS.length - 1);
const _zoneCache = new Map();
export const zoneOf = (stage) => {
  const i = Math.floor((stage - 1) / 10) % ZONES.length;
  const t = zoneTierOf(stage);
  const key = i * 100 + t;
  let z = _zoneCache.get(key);
  if (!z) {
    const base = ZONES[i];
    const tier = ZONE_TIERS[t];
    z = t === 0 ? base : { ...base, name: tier.prefix + base.name, sun: tier.sun || base.sun, tier: t };
    _zoneCache.set(key, z);
  }
  return z;
};

// 관문 하나를 깨는 데 목표로 삼는 시간(초). 밸런스를 고칠 때 이 값에서 크게 벗어나는지 본다.
// 근거: Blade Idle은 메인 스테이지 19,010개가 전부 클리어 시간 47초로 고정돼 있다.
export const TARGET_STAGE_SEC = 45;
// 밸런스 근거: Blade Idle 1.82.0 분석 (2026-10-17)
// - 적 ATK가 HP보다 2배 빠르게 증가 (2%/관문 vs 1%/관문) → 체력 관리 압박
// - 초반 15관문은 ATK 고정, HP만 증가 → 초반 이탈 방지
// - 보상 증가율이 적 체력 증가율에 너무 뒤처지면 구매력이 붕괴한다
export const monsterHp = (s) => 20 * Math.pow(1.17, s - 1);
export const monsterAtk = (s) => (s <= 15 ? 6 : 6 * Math.pow(1.19, s - 15));
export const monsterGold = (s) => 5 * Math.pow(1.105, s - 1);
export const BOSS_HP_MULT = 9;
export const BOSS_ATK_MULT = 2.5;
export const BOSS_GOLD_MULT = 12;
export const bossGems = (s) => (s % 10 === 0 ? 100 : 10);
export const bossRelicShards = (s) => (s % 10 === 0 ? 5 : 1);

// ---------- 문파 ----------
export const guildLevel = (exp) => Math.min(20, 1 + Math.floor((exp || 0) / 200));
export const guildAtkBonus = (exp) => (guildLevel(exp) - 1) * 0.05;
export const GUILD_CHECKIN_EXP = 20;
export const GUILD_DONATE_GEMS = 100;
export const GUILD_DONATE_EXP = 10;
export const GUILD_MAX = 10;

export const raidReward = (maxStage) => ({ gems: 300, gold: monsterGold(maxStage) * 150, relicShards: 20 });
