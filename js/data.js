// 게임 수치 테이블. 모든 공식은 여기에서만 정의한다.

export const SAVE_VERSION = 2;
export const OFFLINE_CAP_SEC = 12 * 3600;
export const KILLS_PER_STAGE = 10;
export const BOSS_TIME = 30;
export const SPAWN_DELAY = 0.45;
export const RAID_TIME = 30;
export const RAID_TICKETS = 3;
export const RAID_HP_SECONDS = 60; // 레이드 HP = 길드원 DPS 합 × 이 값
export const MERGE_COUNT = 4;
export const GACHA_COST = 100;
export const GACHA10_COST = 900;
export const DAILY_GEMS = 300;
export const START_GEMS = 1000;
export const SPEED_CAP = 3;
export const CRIT_CAP = 0.5;

// ---------- 골드 강화 ----------
export const UPGRADES = {
  atk: {
    name: '공격력', icon: '⚔️',
    value: (l) => 10 * Math.pow(1.05, l),
    cost: (l) => 10 * Math.pow(1.06, l),
    fmt: 'num',
  },
  hp: {
    name: '체력', icon: '❤️',
    value: (l) => 100 * Math.pow(1.05, l),
    cost: (l) => 10 * Math.pow(1.06, l),
    fmt: 'num',
  },
  crit: {
    name: '치명타 확률', icon: '🎯', max: 90,
    value: (l) => 0.05 + l * 0.005,
    cost: (l) => 40 * Math.pow(1.13, l),
    fmt: 'pct',
  },
  critDmg: {
    name: '치명타 피해', icon: '💥',
    value: (l) => 1.5 + l * 0.05,
    cost: (l) => 30 * Math.pow(1.12, l),
    fmt: 'pct',
  },
  speed: {
    name: '공격 속도', icon: '💨', max: 100,
    value: (l) => 1 + l * 0.02,
    cost: (l) => 40 * Math.pow(1.11, l),
    fmt: 'x',
  },
  gold: {
    name: '골드 획득', icon: '🪙',
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
  atk: { name: '공격력', icon: '⚔️', per: 0.02, desc: (v) => `공격력 +${pctText(v)}` },
  hp: { name: '체력', icon: '❤️', per: 0.02, desc: (v) => `체력 +${pctText(v)}` },
  critDmg: { name: '치명타 피해', icon: '💥', per: 0.01, desc: (v) => `치명타 피해 +${pctText(v)}` },
  boss: { name: '보스 피해', icon: '👑', per: 0.02, desc: (v) => `보스에게 주는 피해 +${pctText(v)}` },
  gold: { name: '골드 획득', icon: '🪙', per: 0.01, desc: (v) => `골드 +${pctText(v)}` },
  exp: { name: '경험치 획득', icon: '📘', per: 0.01, desc: (v) => `경험치 +${pctText(v)}` },
};
function pctText(v) { return `${Math.round(v * 1000) / 10}%`; }

// ---------- 승급 ----------
// level: 필요 레벨, stage: 시련 보스 강함(스테이지 환산), look: 외형
export const RANKS = [
  { name: '견습생', level: 1, stage: 1, look: { body: '#3b82f6', cape: '#b91c1c', helm: '#94a3b8', trim: '#fbbf24' } },
  { name: '수련 기사', level: 15, stage: 15, look: { body: '#0ea5e9', cape: '#7c3aed', helm: '#cbd5e1', trim: '#fbbf24', plume: '#ef4444' } },
  { name: '기사', level: 35, stage: 35, look: { body: '#64748b', cape: '#1d4ed8', helm: '#e2e8f0', trim: '#facc15', plume: '#f97316' } },
  { name: '정예 기사', level: 60, stage: 60, look: { body: '#334155', cape: '#991b1b', helm: '#f1f5f9', trim: '#eab308', plume: '#fde047' } },
  { name: '성기사', level: 90, stage: 90, look: { body: '#f8fafc', cape: '#ca8a04', helm: '#fde68a', trim: '#f59e0b', plume: '#fef3c7', aura: '#fef08a' } },
  { name: '용기사', level: 130, stage: 130, look: { body: '#166534', cape: '#14532d', helm: '#86efac', trim: '#fbbf24', plume: '#22c55e', aura: '#4ade80' } },
  { name: '영웅', level: 180, stage: 180, look: { body: '#7c2d12', cape: '#dc2626', helm: '#fdba74', trim: '#fde047', plume: '#f97316', aura: '#fb923c', wings: '#fed7aa' } },
  { name: '전설', level: 240, stage: 240, look: { body: '#4c1d95', cape: '#a21caf', helm: '#e9d5ff', trim: '#f0abfc', plume: '#e879f9', aura: '#c084fc', wings: '#f5d0fe' } },
  { name: '신화', level: 310, stage: 310, look: { body: '#0f172a', cape: '#be123c', helm: '#fecdd3', trim: '#fb7185', plume: '#f43f5e', aura: '#f43f5e', wings: '#ffe4e6' } },
  { name: '초월자', level: 400, stage: 400, look: { body: '#fefce8', cape: '#0891b2', helm: '#ffffff', trim: '#22d3ee', plume: '#a5f3fc', aura: '#67e8f9', wings: '#ffffff' } },
];
export const RANK_MULT = 1.5; // 승급마다 공격력·체력 ×1.5
export const TRIAL_TIME = 40;
export const trialBoss = (r) => ({
  hp: monsterHp(RANKS[r].stage) * BOSS_HP_MULT * 2,
  atk: monsterAtk(RANKS[r].stage) * BOSS_ATK_MULT,
});

// ---------- 장비 ----------
export const GRADES = [
  { name: '일반', color: '#a3acb9' },
  { name: '고급', color: '#4ade80' },
  { name: '희귀', color: '#60a5fa' },
  { name: '영웅', color: '#c084fc' },
  { name: '전설', color: '#fb923c' },
  { name: '신화', color: '#f43f5e' },
];
export const GACHA_RATES = [0.6, 0.28, 0.09, 0.025, 0.0045, 0.0005];

// equip: 가장 좋은 등급 하나의 보너스, own: 보유한 등급마다 더해지는 보너스
export const EQUIP_TYPES = {
  weapon: { name: '무기', icon: '🗡️', stat: 'atk', label: '공격력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  armor: { name: '갑옷', icon: '🛡️', stat: 'hp', label: '체력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  ring: { name: '반지', icon: '💍', stat: 'gold', label: '골드',
    equip: [0.1, 0.25, 0.6, 1.5, 4, 10], own: [0.03, 0.06, 0.15, 0.4, 1, 2.5] },
};
export const ENHANCE_PER = 0.08; // 강화 1단계마다 해당 부위 배율에 +8%p (선형)
export const enhanceCost = (e) => 5 + e * 3; // 강화석

// ---------- 펫 ----------
export const PETS = [
  { id: 'dog', name: '멍뭉이', emoji: '🐶', grade: 0, atk: 0.3, own: ['hp', 0.03] },
  { id: 'cat', name: '냥냥이', emoji: '🐱', grade: 0, atk: 0.3, own: ['gold', 0.03] },
  { id: 'fox', name: '불여우', emoji: '🦊', grade: 1, atk: 0.5, own: ['atk', 0.03] },
  { id: 'owl', name: '지혜 부엉이', emoji: '🦉', grade: 2, atk: 0.7, own: ['exp', 0.04] },
  { id: 'panda', name: '쿵푸 판다', emoji: '🐼', grade: 2, atk: 0.8, own: ['critDmg', 0.04] },
  { id: 'unicorn', name: '유니콘', emoji: '🦄', grade: 3, atk: 1.2, own: ['boss', 0.05] },
  { id: 'tiger', name: '백호', emoji: '🐯', grade: 4, atk: 2, own: ['atk', 0.08] },
  { id: 'dragon', name: '아기 용', emoji: '🐲', grade: 5, atk: 3.5, own: ['atk', 0.12] },
];
export const PET_EGG_COST = 150;
export const PET_GRADE_WEIGHT = [45, 30, 15, 7, 2.5, 0.5];
export const petFoodCost = (lv) => 10 * lv;
export const PET_DUPLICATE_FOOD = (grade) => 15 * (grade + 1);
export const PET_ATTACK_INTERVAL = 1.2;
export const petDamageMult = (pet, lv) => pet.atk * (1 + 0.1 * (lv - 1));
export const OWN_STAT_NAMES = { atk: '공격력', hp: '체력', gold: '골드', exp: '경험치', critDmg: '치명타 피해', boss: '보스 피해' };

// ---------- 유물 ----------
export const RELICS = [
  { id: 'sword', name: '고대의 검', icon: '⚔️', stat: 'atk', per: 0.06, max: 100, text: '공격력' },
  { id: 'heart', name: '거인의 심장', icon: '🫀', stat: 'hp', per: 0.06, max: 100, text: '체력' },
  { id: 'grail', name: '황금 성배', icon: '🏆', stat: 'gold', per: 0.05, max: 100, text: '골드' },
  { id: 'orb', name: '현자의 돌', icon: '🔮', stat: 'exp', per: 0.05, max: 100, text: '경험치' },
  { id: 'fang', name: '용의 이빨', icon: '🦷', stat: 'boss', per: 0.06, max: 100, text: '보스 피해' },
  { id: 'glass', name: '모래시계', icon: '⏳', stat: 'bossTime', per: 0.5, max: 30, text: '보스 제한시간', unit: '초' },
  { id: 'moon', name: '달의 구슬', icon: '🌙', stat: 'offline', per: 0.05, max: 60, text: '방치 보상' },
  { id: 'feather', name: '폭풍의 깃털', icon: '🪶', stat: 'speed', per: 0.01, max: 50, text: '공격 속도(한계 돌파)' },
];
export const RELIC_DIG_COST = 10; // 유물 조각

// ---------- 스킬 ----------
export const SKILLS = [
  { id: 'slash', name: '회전베기', icon: '🌀', unlock: 1, cd: 6, kind: 'dmg',
    mult: (l) => 4 + l * 0.6, desc: (m) => `공격력의 ${m.toFixed(1)}배 피해` },
  { id: 'rage', name: '광폭화', icon: '🔥', unlock: 5, cd: 25, dur: 8, kind: 'buff',
    mult: (l) => 1.5 + l * 0.06, desc: (m) => `8초간 공격력 ${m.toFixed(2)}배` },
  { id: 'heal', name: '치유의 빛', icon: '💚', unlock: 12, cd: 18, kind: 'heal',
    mult: (l) => Math.min(1, 0.3 + l * 0.02), desc: (m) => `체력 ${Math.round(m * 100)}% 회복` },
  { id: 'thunder', name: '천둥', icon: '⚡', unlock: 25, cd: 15, kind: 'dmg',
    mult: (l) => 12 + l * 1.8, desc: (m) => `공격력의 ${m.toFixed(1)}배 피해` },
  { id: 'gale', name: '질풍', icon: '🌪️', unlock: 40, cd: 30, dur: 10, kind: 'buff',
    mult: (l) => 1.5 + l * 0.03, desc: (m) => `10초간 공격 속도 ${m.toFixed(2)}배 (한계 돌파)` },
  { id: 'midas', name: '황금손', icon: '🤑', unlock: 60, cd: 45, dur: 15, kind: 'buff',
    mult: (l) => 2 + l * 0.1, desc: (m) => `15초간 골드 ${m.toFixed(1)}배` },
  { id: 'frost', name: '서리 감옥', icon: '❄️', unlock: 80, cd: 20, kind: 'dmg', stun: 3,
    mult: (l) => 8 + l * 1.2, desc: (m) => `공격력의 ${m.toFixed(1)}배 피해 + 3초 빙결` },
  { id: 'meteor', name: '메테오', icon: '☄️', unlock: 100, cd: 40, kind: 'dmg',
    mult: (l) => 40 + l * 6, desc: (m) => `공격력의 ${m.toFixed(0)}배 피해` },
];
export const SKILL_SLOTS = 4;
export const skillBookCost = (l) => Math.ceil(2 * Math.pow(1.15, l - 1));

// ---------- 던전 ----------
export const DUNGEONS = [
  { id: 'gold', name: '황금 동굴', icon: '💰', unlock: 10, reward: '골드', mob: '🧌', boss: '🐲' },
  { id: 'stone', name: '수정 광산', icon: '⛏️', unlock: 20, reward: '강화석', mob: '🦇', boss: '🗿' },
  { id: 'pet', name: '짐승의 숲', icon: '🐾', unlock: 30, reward: '펫 먹이', mob: '🐗', boss: '🦍' },
  { id: 'relic', name: '고대 유적', icon: '🏺', unlock: 40, reward: '유물 조각', mob: '💀', boss: '🧟' },
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

// ---------- 일일 미션 / 업적 ----------
export const MISSIONS = [
  { id: 'kill', name: '몬스터 500마리 처치', goal: 500, reward: { gems: 50 } },
  { id: 'boss', name: '보스 5마리 처치', goal: 5, reward: { gems: 50, books: 5 } },
  { id: 'upgrade', name: '강화 30회', goal: 30, reward: { gems: 50, stones: 20 } },
  { id: 'dungeon', name: '던전 3회 도전', goal: 3, reward: { gems: 100 } },
  { id: 'gacha', name: '뽑기 10회 (장비·펫)', goal: 10, reward: { gems: 50 } },
  { id: 'pvp', name: '결투 3회', goal: 3, reward: { gems: 100 } },
  { id: 'raid', name: '길드 레이드 1회', goal: 1, reward: { gems: 100 } },
];
export const MISSION_ALL_REWARD = { gems: 300, books: 10 };
export const stageMilestone = () => ({ gems: 200, books: 10, stones: 30 }); // 25스테이지마다
export const STAGE_MILESTONE_EVERY = 25;

// ---------- 결투장 ----------
export const PVP_TICKETS = 5;
export const PVP_TIME = 30;
export const PVP_WIN = 20;
export const PVP_LOSE = -8;
export const PVP_REWARD = { win: { gems: 50 }, lose: { gems: 10 } };

// ---------- 스테이지 / 몬스터 ----------
export const ZONES = [
  { name: '고요한 들판', sky: ['#7dd3fc', '#bae6fd'], ground: '#4d7c0f', prop: 'tree', mobs: ['🐌', '🐛', '🐸', '🐭'] },
  { name: '어두운 숲', sky: ['#14532d', '#365314'], ground: '#1a2e05', prop: 'pine', mobs: ['🐺', '🐗', '🦇', '🕷️'] },
  { name: '모래 사막', sky: ['#fcd34d', '#fde68a'], ground: '#b45309', prop: 'cactus', mobs: ['🦂', '🐍', '🐪', '🦎'] },
  { name: '얼음 동굴', sky: ['#1e3a8a', '#60a5fa'], ground: '#cbd5e1', prop: 'crystal', mobs: ['🐧', '🦭', '☃️', '🐻‍❄️'] },
  { name: '화산 지대', sky: ['#7f1d1d', '#ea580c'], ground: '#292524', prop: 'rock', mobs: ['🦖', '🐊', '🔥', '🦏'] },
  { name: '유령 성', sky: ['#312e81', '#6d28d9'], ground: '#1e1b4b', prop: 'grave', mobs: ['👻', '💀', '🧟', '🦉'] },
  { name: '하늘 섬', sky: ['#a5f3fc', '#f0abfc'], ground: '#e0e7ff', prop: 'cloud', mobs: ['🦅', '🐉', '🦄', '🪽'] },
  { name: '마계', sky: ['#18181b', '#991b1b'], ground: '#0a0a0a', prop: 'spike', mobs: ['👹', '👺', '😈', '👾'] },
];
export const BOSS_MOBS = ['🐉', '👹', '🦑', '🗿', '🤖', '🐙', '🦍', '🧌'];

export const zoneOf = (stage) => ZONES[Math.floor((stage - 1) / 10) % ZONES.length];
export const monsterHp = (s) => 20 * Math.pow(1.17, s - 1);
export const monsterAtk = (s) => 6 * Math.pow(1.17, s - 1);
export const monsterGold = (s) => 5 * Math.pow(1.1, s - 1);
export const BOSS_HP_MULT = 9;
export const BOSS_ATK_MULT = 2.5;
export const BOSS_GOLD_MULT = 12;
export const bossGems = (s) => (s % 10 === 0 ? 100 : 10);
export const bossRelicShards = (s) => (s % 10 === 0 ? 5 : 1);

// ---------- 길드 ----------
export const guildLevel = (exp) => Math.min(20, 1 + Math.floor((exp || 0) / 200));
export const guildAtkBonus = (exp) => (guildLevel(exp) - 1) * 0.05;
export const GUILD_CHECKIN_EXP = 20;
export const GUILD_DONATE_GEMS = 100;
export const GUILD_DONATE_EXP = 10;
export const GUILD_MAX = 10;

export const raidReward = (maxStage) => ({ gems: 300, gold: monsterGold(maxStage) * 150, relicShards: 20 });
