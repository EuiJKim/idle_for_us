// 게임 수치 테이블. 모든 공식은 여기에서만 정의한다.

export const SAVE_VERSION = 1;
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

export const SKILLS = [
  { id: 'slash', name: '회전베기', icon: '🌀', unlock: 1, cd: 6,
    mult: (l) => 4 + l * 0.6, desc: (m) => `공격력의 ${m.toFixed(1)}배 피해` },
  { id: 'rage', name: '광폭화', icon: '🔥', unlock: 5, cd: 25, dur: 8,
    mult: (l) => 1.5 + l * 0.06, desc: (m) => `8초간 공격력 ${m.toFixed(2)}배, 공속 1.5배` },
  { id: 'heal', name: '치유의 빛', icon: '💚', unlock: 12, cd: 18,
    mult: (l) => Math.min(1, 0.3 + l * 0.02), desc: (m) => `체력 ${Math.round(m * 100)}% 회복` },
  { id: 'thunder', name: '천둥', icon: '⚡', unlock: 25, cd: 15,
    mult: (l) => 12 + l * 1.8, desc: (m) => `공격력의 ${m.toFixed(1)}배 피해` },
];
export const skillCost = (idx, l) => 60 * Math.pow(4, idx) * Math.pow(1.2, l - 1);

export const ZONES = [
  { name: '고요한 들판', sky: ['#7dd3fc', '#bae6fd'], ground: '#4d7c0f', mobs: ['🐌', '🐛', '🐸', '🐭'] },
  { name: '어두운 숲', sky: ['#14532d', '#365314'], ground: '#1a2e05', mobs: ['🐺', '🐗', '🦇', '🕷️'] },
  { name: '모래 사막', sky: ['#fcd34d', '#fde68a'], ground: '#b45309', mobs: ['🦂', '🐍', '🐪', '🦎'] },
  { name: '얼음 동굴', sky: ['#1e3a8a', '#60a5fa'], ground: '#cbd5e1', mobs: ['🐧', '🦭', '☃️', '🐻‍❄️'] },
  { name: '화산 지대', sky: ['#7f1d1d', '#ea580c'], ground: '#292524', mobs: ['🦖', '🐊', '🔥', '🦏'] },
  { name: '유령 성', sky: ['#312e81', '#6d28d9'], ground: '#1e1b4b', mobs: ['👻', '💀', '🧟', '🦉'] },
  { name: '하늘 섬', sky: ['#a5f3fc', '#f0abfc'], ground: '#e0e7ff', mobs: ['🦅', '🐲', '🦄', '🪽'] },
  { name: '마계', sky: ['#18181b', '#991b1b'], ground: '#0a0a0a', mobs: ['👹', '👺', '😈', '👾'] },
];
export const BOSS_MOBS = ['🐉', '👹', '🦑', '🗿', '🤖', '🐙', '🦍', '🧌'];

export const zoneOf = (stage) => ZONES[Math.floor((stage - 1) / 10) % ZONES.length];
export const monsterHp = (s) => 20 * Math.pow(1.15, s - 1);
export const monsterAtk = (s) => 6 * Math.pow(1.15, s - 1);
export const monsterGold = (s) => 5 * Math.pow(1.1, s - 1);
export const BOSS_HP_MULT = 9;
export const BOSS_ATK_MULT = 2.5;
export const BOSS_GOLD_MULT = 12;
export const bossGems = (s) => (s % 10 === 0 ? 100 : 10);

export const guildLevel = (exp) => Math.min(20, 1 + Math.floor((exp || 0) / 200));
export const guildAtkBonus = (exp) => (guildLevel(exp) - 1) * 0.05;
export const GUILD_CHECKIN_EXP = 20;
export const GUILD_DONATE_GEMS = 100;
export const GUILD_DONATE_EXP = 10;
export const GUILD_MAX = 10;

export const raidReward = (maxStage) => ({ gems: 300, gold: monsterGold(maxStage) * 150 });
