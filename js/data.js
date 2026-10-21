// 게임 수치·세계관 테이블. 모든 공식은 여기에서만 정의한다. (무협 회귀 테마)

// 지금 돌고 있는 빌드. 설정 창에 적어 둔다 — 기기가 옛 판을 들고 있는지
// 한눈에 보려고 둔다. sw.js의 CACHE와 같은 값으로 맞춘다.
export const BUILD = 'ifu-v37';

export const SAVE_VERSION = 4;
export const OFFLINE_CAP_SEC = 12 * 3600;
export const KILLS_PER_STAGE = 20;
// 한 번에 나오는 적 수(최대). 관문이 오를수록 더 몰려온다.
// 근거: Blade Idle은 한 스테이지에 적 그룹(wavegroup)이 보통 4개씩 잡혀 있고 47초 안에 정리된다.
export const MOB_GROUP_MAX = 80;
// 평면 사냥: 무인이 들판을 사방으로 돌아다니며 적을 찾아 벤다.
// 근거: Blade Idle은 카메라가 X축 90도(수직 하향) 직교 투영이고 배경 60장이 전부
// 위에서 내려다본 바닥이다. 즉 전투는 1축이 아니라 X·Y 평면에서 일어난다.
// (docs/BladeIdle_화면구조.md)
// 사거리는 화면 폭의 약 1/4. Blade Idle 기준(가로 5.625유닛, 인물 약 1유닛)으로 맞췄다.
// 이보다 좁으면 인물끼리 그림이 겹쳐서 누가 누군지 안 보인다.
export const MELEE_RANGE = 96;        // 이 거리(화면 기준) 안에 들어와야 벨 수 있다
export const HERO_SPEED = 185;        // 걸어가는 속도(초당)
export const MOB_SPEED = 46;          // 적이 무인 쪽으로 다가오는 속도
export const MOB_SPAWN_NEAR = 170;    // 적이 생기는 가장 가까운 거리
export const MOB_SPAWN_FAR = 320;     // 적이 생기는 가장 먼 거리
// ---------- 젠 속도 ----------
// 기준: "광역기 한 방에 빈 자리를 몇 초 안에 메울 것인가". 우리는 2~3초로 잡는다.
// 그보다 느리면 광역기 쓰고 나서 들판이 휑하고, 더 빠르면 광역기를 쓴 보람이 없다.
//
// 평시 처치 속도는 관문 10마리 / 45초 = 0.22마리/초라 고정 간격으로도 충분하다.
// 문제는 광역기다. 만검귀종(반경 300)은 한 방에 최대 62마리, 뇌정검(210)은 30마리를
// 동시에 지운다. 그래서 고정 간격이 아니라 '빈 자리에 비례'해서 채운다.
export const MOB_REFILL_BASE = 3;     // 가득 찬 상태에서도 초당 이만큼은 채운다
export const MOB_REFILL_BURST = 34;   // 자리가 전부 비면 여기까지 빨라진다
// 빈 자리 비율에 따라 초당 몇 마리를 채울지
export const refillRate = (missing, want) =>
  MOB_REFILL_BASE + MOB_REFILL_BURST * (want > 0 ? missing / want : 0);
export const MOB_SEPARATION = 72;     // 적끼리 이만큼(화면 기준)은 떨어져 선다
// 화면 비율: Blade Idle은 직교 size 5 → 세로 10유닛, 가로 10×(720/1280)=5.625유닛.
// 세로로 긴 평면이라 적이 위아래에서 더 많이 들어온다.
export const FIELD_ASPECT = 720 / 1280;
// 월드 Y는 화면에서 이만큼 눌러 그린다. 사거리·간격은 전부 '화면에서 보이는 거리'로
// 재므로, 적이 위아래에 서도 좌우에 선 것과 똑같이 떨어져 보인다.
export const FIELD_SQUASH = 0.62;
// 관문이 오를수록 몰려오는 수가 는다. 196관문에서 상한에 닿는다.
export const mobGroupSize = (stage) => Math.min(MOB_GROUP_MAX, 2 + Math.floor(stage / 2));
// 들판은 몰려오는 수에 맞춰 넓어진다. 안 그러면 100마리가 한 점에 뭉친다.
// 크기는 '다 들어가되 화면을 벗어나진 않을 만큼'으로 잡는다 — 육각 밀집 기준
// 한 마리가 MOB_SEPARATION^2 x 0.866 의 자리를 차지하므로, n마리가 들어갈
// 타원 넓이에서 역산한다. 넓게 잡으면 100마리를 만들어놔도 화면엔 몇 마리 안 보인다.
export const FIELD_WIDE = 0.55;   // 가로는 좁게
export const FIELD_TALL = 1.35;   // 세로는 길게 (세로로 긴 화면에 맞춘다)
export const fieldRadius = (n) => {
  const need = n * MOB_SEPARATION * MOB_SEPARATION * 0.866;  // 필요한 화면 넓이
  const r = Math.sqrt(need / (Math.PI * FIELD_WIDE * FIELD_TALL));
  return Math.max(MOB_SPAWN_FAR, r);
};
// 한 번에 무인을 때릴 수 있는 적 수. 없으면 100마리가 동시에 때려서 즉사한다.
export const MAX_ATTACKERS = 6;
// ---------- 물결(웨이브) ----------
// 근거: StageTable의 wavegroup1~20. 메인 스테이지 19,950개 중 19,010개가
// 정확히 4웨이브다. 그리고 처음 네 챕터만 1→2→3→4로 늘어난다.
//   ch1 1웨이브 25초 / ch2 2웨이브 30초 / ch3 3웨이브 40초 / ch4~399 4웨이브 47초
// (docs/BladeIdle_진행구조.md 2절)
//
// 우리는 관문 단위로 같은 모양을 만든다. 한 관문의 처치 수(KILLS_PER_STAGE)를
// 물결로 나누고, 뒤쪽 물결일수록 더 몰려오게 한다.
export const WAVE_MAX = 4;
export const waveCount = (stage) => Math.min(WAVE_MAX, 1 + Math.floor(stage / 20));
// 그 물결에서 잡아야 하는 수 (합이 KILLS_PER_STAGE가 되게 나눈다)
export function waveKills(stage, wave) {
  const n = waveCount(stage);
  const base = Math.floor(KILLS_PER_STAGE / n);
  const extra = KILLS_PER_STAGE - base * n;
  return base + (wave >= n - extra ? 1 : 0);   // 남는 건 뒤쪽 물결에 얹는다
}
// 물결이 뒤로 갈수록 더 몰려온다
export const waveDensity = (wave, total) => 0.7 + 0.3 * (total <= 1 ? 1 : wave / (total - 1));

// 물결을 넘길 때 주는 것. 저쪽은 WaveRewardTable이 따로 있다.
// 물결만 넣고 보상을 안 두면 한 관문 안의 작은 성취가 비어 버린다.
// 뒤쪽 물결일수록 크고, 마지막 물결은 관문지기로 이어지므로 더 준다.
export function waveReward(stage, wave, total) {
  const last = wave >= total - 1;
  const k = 1 + wave * 0.45 + (last ? 0.8 : 0);
  return {
    gold: monsterGold(stage) * 4 * k,
    stones: Math.max(1, Math.round((1 + stage * 0.035) * k)),
    books: last ? Math.max(1, Math.round((0.6 + stage * 0.02) * k)) : 0,
  };
}

// 한 물결이 최소 이만큼은 걸린다.
//
// 전에는 바닥이 없어서 한 관문이 **10초**에 끝났다. 설계 목표는 45초인데,
// 광역기 한 방에 들판의 80마리가 지워지고 그게 20처치를 한꺼번에 채웠기
// 때문이다. Blade Idle은 `monsterrespawntime`으로 한 판을 **47초에 고정**한다
// (docs/BladeIdle_진행구조.md 2절).
//
// 처치 수를 다 채워도 이 시간이 안 지났으면 다음 물결로 안 넘어간다.
// 그동안 잡는 적은 그대로 은자가 되니 시간이 버려지지는 않는다.
export const WAVE_MIN_SEC = 4;
// 11초 -> 6초 -> **4초**.
// 처음엔 한 관문이 10초라 너무 빠르다고 해서 바닥을 깔았는데, 막상 돌려
// 보니 회귀하고 다시 뚫는 게 답답하다는 쪽으로 판단이 바뀌었다.
// '빠르고 도파민 있게'가 지금 방향이다. 4물결 x 4초 + 관문지기 = 한 관문 18초쯤.
// 바닥을 아예 없애지는 않는다 — 없으면 광역기 한 방에 관문이 끝나서
// 한 판이라는 감각 자체가 사라진다(그게 처음 상태였다).      // 4물결 x 11초 + 관문지기 = 45초쯤

// **이미 깬 길은 빨리 지나간다.**
//
// 바닥 시간을 넣고 나니 회귀가 못 쓸 물건이 됐다. 관문 350에서 회귀하면
// 1관문부터 다시 올라와야 하는데 한 관문이 47초라 되돌아가는 데만 4시간 반이다.
// 그래서 하루가 지나면 24시간당 +10관문으로 납작해졌다.
// Blade Idle에도 같은 장치가 있다 — 하단 우측 줄의 LoopAndGo(반복 이동).
// 회귀해서 강해지는 게 이 게임의 축이다. 되돌아가는 길이 비싸면 그 축이 죽는다.
// 0.22로 뒀더니 72시간에 회귀가 31번 돌았는데도 도달 관문이 안 올랐다.
export const WAVE_RECLIMB = 0.03;
export const waveMinSec = (stage, best) => WAVE_MIN_SEC * (stage < (best || 0) ? WAVE_RECLIMB : 1);

export const BOSS_TIME = 30;
export const SPAWN_DELAY = 0.45;
// ---------- 그림자 무림 (저쪽의 '도플갱어') ----------
// 근거: DoppelgangerTable, DoppelTierTable, DoppelTierRewardTable.
// 공략: "매주 컨텐츠를 꼬박꼬박 진행만 해주셔도 골드티어까지는 확정적으로
// 가실 수 있어서 매주 신화4·갓4·갓3등급 선택상자를 하나씩 받을 수 있습니다.
// 매주 티어가 초기화되어 월요일에는 처음부터 다시 보상을 획득하실 수 있으니
// 꼭 잊지 마세요!"  그리고 "랭킹이 오를수록 난이도가 낮은 도플갱어가 등장할
// 확률이 높아지는 구조" — 즉 올라갈수록 쉬워지는 역-난이도 곡선이다.
export const SHADOW_TIERS = [
  { id: 'iron', name: '무명', need: 1, reward: { stones: 2000, books: 300 } },
  { id: 'bronze', name: '삼류', need: 2, reward: { stones: 6000, books: 900, accBox: 1 } },
  { id: 'silver', name: '이류', need: 5, reward: { stones: 18000, books: 2500, accBox: 2 } },
  { id: 'gold', name: '일류', need: 9, reward: { stones: 55000, books: 7000, accBox: 3, gems: 3000 } },
  { id: 'jade', name: '절정', need: 14, reward: { stones: 160000, books: 20000, accBox: 5, accPick: 1, gems: 8000 } },
  { id: 'black', name: '초절정', need: 20, reward: { stones: 480000, books: 60000, accBox: 8, accPick: 3, gems: 20000 } },
];
export const SHADOW_TRIES = 3;        // 하루에 쓸 수 있는 도전 수
export const SHADOW_TRY_CAP = 12;     // 쌓이는 상한
export const SHADOW_TIME = 40;
// 이긴 횟수로 티어가 정해진다. 한 번도 못 이겼으면 -1(아직 티어 없음).
export const shadowTierOf = (wins) => {
  let i = -1;
  SHADOW_TIERS.forEach((t2, idx) => { if (wins >= t2.need) i = idx; });
  return i;
};
export const shadowTierName = (i) => (i < 0 ? '무위' : SHADOW_TIERS[i].name);
export const nextShadowTier = (wins) => SHADOW_TIERS.find((t2) => wins < t2.need) ?? null;
// 상대 세기. 이길수록 조금씩 세지지만, 티어가 오르면 되레 완만해진다.
// 공략의 "랭킹이 오를수록 난이도가 낮은 도플갱어가 나온다"를 옮긴 것.
export const shadowStage = (bestStage, wins) =>
  Math.max(1, Math.round(bestStage * (0.62 + wins * 0.035) * (1 - Math.max(0, shadowTierOf(wins)) * 0.045)));
// 월요일 기준 주차 키
export function weekKey(t = Date.now()) {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;            // 월=0
  const mon = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * 86400000;
  return new Date(mon).toISOString().slice(0, 10);
}

// ---------- 혈마의 탑 / 마기 균열 / 비급 탐색 ----------
// 근거: CurseTable(저주탑), Rift*Table(균열), Treasurehunt*Table(보물찾기).
// APK에서 저주탑은 보스 수치가 들어 있는 유일한 콘텐츠였다 —
// 240층(12챕터 x 20층), 45초 고정, 층마다 HP가 3~90배로 뛴다.
// 메인과 달리 매끈한 지수가 아니라 손으로 깎은 벽이다.
// 균열은 25초, 보물찾기는 30초로 둘 다 짧다.

export const TOWER_OPEN_STAGE = 70;
export const TOWER_FLOOR_MAX = 240;      // 저쪽과 같은 층수
export const TOWER_TIME = 45;            // 저쪽과 같은 제한시간
// 층이 요구하는 관문급. 20층마다 한 단(챕터)이고 단이 바뀔 때 더 가파르다.
export const towerStage = (floor) =>
  Math.max(1, Math.round(28 + floor * 3.1 + Math.floor(floor / 20) * 14));
// 층 보상
export function towerReward(floor) {
  const band = Math.floor(floor / 20);
  // 층당 증가율을 얕게 잡는다. 1.11로 두자 12시간 도달 관문이
  // 370에서 455로 튀었다 — 탑 하나가 다른 축을 전부 눌렀다.
  const r = {
    gems: Math.ceil(200 * Math.pow(1.075, floor)),
    stones: Math.ceil(120 * Math.pow(1.07, floor)),
    books: Math.ceil(60 * Math.pow(1.07, floor)),
  };
  if (floor % 20 === 0) {
    r.accBox = 2 + band;   // 단이 바뀌는 층에서 크게
    r.accPick = 1 + Math.floor(floor / 60);   // 선택 상자는 단이 바뀔 때만
  }
  return r;
}
// 오른 층마다 영구히 붙는 효과 (탑은 한 번 오르면 내려가지 않는다)
export const TOWER_PER_FLOOR = { atk: 0.02, hp: 0.015 };

// 균열과 탐색은 '탐색패' 하나를 같이 쓴다. 자원 종류를 늘리지 않으려는 것.
export const SEEK_PER_DAY = 3;
export const SEEK_CAP = 12;
export const RIFT_TIME = 25;             // 저쪽과 같다
export const HUNT_TIME = 30;             // 저쪽과 같다
export const RIFT_OPEN_STAGE = 50;
export const HUNT_OPEN_STAGE = 60;
// 둘 다 '지금 내 최고 관문'에 맞춰 상대가 나온다
export const riftStage = (bestStage) => Math.max(1, Math.round(bestStage * 0.88));
export const huntStage = (bestStage) => Math.max(1, Math.round(bestStage * 0.8));
export const riftReward = (bestStage) => ({
  gems: Math.ceil(300 + bestStage * 6),
  relicShards: Math.ceil(8 + bestStage * 0.12),
  books: Math.ceil(80 + bestStage * 2.2),
});
export const huntReward = (bestStage) => ({
  gold: monsterGold(bestStage) * 900,
  stones: Math.ceil(150 + bestStage * 3.5),
  accBox: 1,
});

export const RAID_TIME = 30;
export const RAID_TICKETS = 3;
export const RAID_HP_SECONDS = 60; // 토벌 두목 HP = 문파원 DPS 합 × 이 값
export const MERGE_COUNT = 4;
export const GACHA_COST = 100;
export const GACHA10_COST = 900;
export const DAILY_GEMS = 300;
export const START_GEMS = 1000;
export const SPEED_CAP = 3;
// 수련만으로는 30%까지다. 나머지 45%p는 병기보·옵션 칸·세트·의복·인물도감처럼
// '갖춰야 오르는' 것들이 채운다. 그래야 그 시스템들이 숫자가 아니라 효과가 된다.
export const CRIT_CAP = 0.75;

// 재화 이름과 한자 표기 (save 키는 그대로 두고 화면 이름만 무협식)
export const CUR = {
  gold: { name: '은자', hz: '은' },
  gems: { name: '원보', hz: '원' },
  books: { name: '비급', hz: '비' },
  stones: { name: '한철', hz: '철' },
  food: { name: '영수 먹이', hz: '먹' },
  relicShards: { name: '신물 조각', hz: '조' },
};

// ---------- 은자 수련 ----------
// 수련 한 레벨이 주는 값과 드는 값. 둘의 비(ln cost / ln value)가
// **파워가 시간에 대해 몇 제곱으로 자라는지**를 정한다. 전에는 1.06/1.05라
// 비가 1.19였고, 그 위에 회귀·경지·장비·영수·유물이 겹쳐 파워가 t^14~t^26으로
// 불었다. 목표는 t^6쯤이다(3시간 150관문 · 하루 300 · 일주일 480).
export const UP_VALUE_RATE = 1.05;
export const UP_COST_RATE = 1.07;

export const UPGRADES = {
  atk: {
    name: '외공(공격력)', icon: '외공',
    value: (l) => 10 * Math.pow(UP_VALUE_RATE, l),
    cost: (l) => 10 * Math.pow(UP_COST_RATE, l),
    fmt: 'num',
  },
  hp: {
    name: '내공(체력)', icon: '내공',
    value: (l) => 100 * Math.pow(UP_VALUE_RATE, l),
    cost: (l) => 10 * Math.pow(UP_COST_RATE, l),
    fmt: 'num',
  },
  crit: {
    // 상한이 90이던 때 value(90) = 0.05 + 0.45 = 0.50 으로 CRIT_CAP과 정확히
    // 같았다. 그래서 수련을 끝내는 순간(실측 30분, 관문 175) 치명 확률을 주는
    // 다른 아홉 시스템이 전부 0이 됐다 — 8시간 차에 39.5%p가 버려지고 있었다.
    // 상한을 50(값 30%)으로 내려 CRIT_CAP까지 45%p를 비워 둔다.
    name: '혈도 찌르기(치명 확률)', icon: '혈도', max: 50,
    value: (l) => 0.05 + Math.min(l, 50) * 0.005,
    cost: (l) => 40 * Math.pow(1.13, l),
    fmt: 'pct',
  },
  critDmg: {
    name: '파괴력(치명 피해)', icon: '파괴',
    value: (l) => 1.5 + l * 0.05,
    cost: (l) => 30 * Math.pow(1.12, l),
    fmt: 'pct',
  },
  speed: {
    name: '쾌검(공격 속도)', icon: '쾌검', max: 100,
    value: (l) => 1 + l * 0.02,
    cost: (l) => 40 * Math.pow(1.11, l),
    fmt: 'x',
  },
  gold: {
    name: '상재(은자 획득)', icon: '상재',
    value: (l) => 1 + l * 0.05,
    cost: (l) => 25 * Math.pow(1.12, l),
    fmt: 'pct',
  },
};

// ---------- 레벨 / 스탯 포인트 ----------
// 경험치가 사실상 **성장 속도의 주 엔진**이다.
// 둘 다 1.1이면 한 관문이 언제나 정확히 1.33레벨이 된다(20처치 x 4 / 60).
// 그래서 관문 254에 레벨 293, 경지 7이 나왔다 — 세 시간 만에 생사경이다.
// 요구치를 조금 더 가파르게 두면 레벨당 관문 수가 점점 늘어난다.
export const EXP_KILL_RATE = 1.10;
export const EXP_LEVEL_RATE = 1.15;
export const expPerKill = (s) => 4 * Math.pow(EXP_KILL_RATE, s - 1);
export const expToNext = (lv) => 60 * Math.pow(EXP_LEVEL_RATE, lv - 1);
export const SP_PER_LEVEL = 2;
export const SP_RESET_GEMS = 200;
export const SP_STATS = {
  atk: { name: '근력', icon: '근력', per: 0.02, desc: (v) => `공격력 +${pctText(v)}` },
  hp: { name: '체질', icon: '체질', per: 0.02, desc: (v) => `체력 +${pctText(v)}` },
  critDmg: { name: '살기', icon: '살기', per: 0.01, desc: (v) => `치명 피해 +${pctText(v)}` },
  boss: { name: '투지', icon: '투지', per: 0.02, desc: (v) => `두목에게 주는 피해 +${pctText(v)}` },
  gold: { name: '재운', icon: '재운', per: 0.01, desc: (v) => `은자 +${pctText(v)}` },
  exp: { name: '오성', icon: '오성', per: 0.01, desc: (v) => `경험치 +${pctText(v)}` },
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
export const REGRESS_PER_POINT = 0.16;   // 1pt당 +16% (0.10 -> 0.16)
// 회귀는 이 게임에서 가장 큰 도파민이다. 돌아왔을 때 '확 세졌다'가 바로
// 느껴져야 한 번 더 돌린다. 수익을 키우고 되돌아가는 길도 거의 공짜다. // 전생의 기억 1개당 공격력·체력·은자·경험치 +10%
// 관문 몇 개마다 전생의 기억 1개인가. 관문 눈금이 촘촘해지면 여기도 같이 넓혀야
// 회귀가 공짜 가속 장치가 되지 않는다.
export const REGRESS_PER_STAGES = 5;
export const regressGain = (maxStage) => (maxStage < REGRESS_MIN_STAGE ? 0 : Math.floor((maxStage - 50) / REGRESS_PER_STAGES));

// 회귀를 '권할' 시점.
//
// 측정으로 나온 사실: 적극적으로 회귀하면 12시간 도달 관문이 452 → 540이다(+22%).
// 그런데 아무도 안 했다. 계산만 보면 손해로 보이기 때문이다 — 회귀하는 순간
// DPS가 10^19배 떨어진다. 실제로는 전생 배수가 공격력·체력·은자·경험치에
// 전부 붙어서 되돌아오는 데 얼마 안 걸리는데, 그게 화면에 안 보였다.
//
// 그래서 '지금 회귀하면 이득'을 직접 띄운다.
// 관문 눈금을 촘촘하게 바꾼 뒤 이 값이 너무 높아져서, 일주일 시뮬에서
// 회귀가 **한 번도 안 터지고** 관문 200에 사흘을 묶여 있었다.
// 회귀는 벽을 뚫는 유일한 장치라 안 터지면 게임이 멈춘다.
export const REGRESS_ADVISE_POINTS = 18;   // 이만큼 받을 수 있으면 권한다 (200관문쯤)
// 막혀 있다고 보는 시간 (초). 이만큼 최고 관문이 안 올라가면 회귀가 답이다.
export const REGRESS_STUCK_SEC = 600;

// ---------- 직업 (8계열) ----------
// 근거: 없다. Blade Idle APK에는 직업 테이블이 하나도 없다 — 이건 우리 설계다.
// (docs/직업_설계초안.md)
//
// 기존 경지 10단계에 얹는다. 구상의 다섯 단계가 거의 그대로 맞고,
// 최종 경지 이름이 이미 '천인합일'이다.
//   삼류·이류        무사 수련 (공용)
//   일류·절정·초절정  성향 탐색
//   화경             >>> 문파 선택 <<<
//   현경·생사경·자연경 한길 파기
//   천인합일          합일 (각인)
export const JOB_RANK = 5;          // 화경부터 고를 수 있다
// 첫 계열은 화경에 닿으면 바로, 나머지는 관문으로 하나씩 열린다.
export const JOB_UNLOCK = [0, 240, 280, 320, 360, 400, 440, 480];
//
// 보너스는 **따로 곱한다.** 지금 m.atk가 27쯤이라 거기에 +0.3을 더하면 1%밖에
// 안 된다 — 장신구 특기에서 그 실수를 한 번 했다(0.04로 잡아 체감이 x1.04였다).
// 곱으로 두면 적힌 숫자가 곧 체감이다.
//
// 여덟이 **서로 다른 축**을 민다. 같은 축이면 답이 하나로 정해져서
// 고르는 의미가 사라진다.
//
// 출혈도 '주'축으로는 못 쓴다. 이 게임은 적이 즉사해서 출혈이 돌 시간이 없다 —
// 재 보니 출혈 1초 피해가 6.9e+10인데 졸개 체력이 9.9e+27이었다(관문 393).
// 독마는 출혈을 색으로 남기되, 실제로 미는 축은 '경험치'다.
// 경지가 DPS의 94%를 차지하고 경지 돌파에는 레벨이 필요하니, 경험치는
// 아무도 안 쓰던 축인데 실은 가장 깊게 작동한다.
//
// 치명 '확률'은 쓰지 않는다. 상한(CRIT_CAP)에 쉽게 닿아서 보너스가 죽는다 —
// 오늘 치명을 주는 아홉 시스템이 통째로 죽어 있던 걸 고쳤는데, 여기서
// 같은 실수를 반복할 이유가 없다. 치명은 '피해' 쪽만 쓴다.
export const JOBS = [
  { id: 'sword', name: '일화검존', weapon: '검', color: '#e5e7eb',
    tag: '한 점을 꿰뚫는다',
    desc: '관문지기에게 강하다. 벽이 진행의 병목이라 가장 무난하다.',
    mult: { boss: 1.7, atk: 1.3 } },
  { id: 'blade', name: '혈천도마', weapon: '도', color: '#ef4444',
    tag: '베어 넘긴다',
    desc: '순수한 힘. 들판을 빨리 치운다.',
    mult: { atk: 1.5 } },
  { id: 'fist', name: '권마', weapon: '권갑', color: '#f59e0b',
    tag: '맞붙는다',
    desc: '때리는 속도가 빠르다. 평타와 무공이 같이 빨라진다.',
    mult: { speed: 1.45, atk: 1.3 } },
  { id: 'ring', name: '극악소마', weapon: '지환', color: '#a855f7',
    tag: '한 번에 끝낸다',
    desc: '치명 피해가 크다. 터질 때 크게 터진다.',
    mult: { critDmg: 1.8 } },
  { id: 'drunk', name: '취마', weapon: '호로', color: '#84cc16',
    tag: '비틀거리며 산다',
    desc: '은자를 많이 번다. 수련에 다시 꽂아 돌아온다.',
    mult: { gold: 2.2, hp: 1.5 } },
  { id: 'fan', name: '환마', weapon: '부채', color: '#38bdf8',
    tag: '홀린다',
    desc: '상태이상이 오래간다. 둔화·파쇄가 길게 걸린다.',
    mult: { ccDur: 1.8, critDmg: 1.45 } },
  { id: 'monk', name: '마불', weapon: '염주', color: '#fbbf24',
    tag: '버틴다',
    desc: '체력이 두텁고 방치 보상이 크다. 오래 비워 두는 사람에게.',
    mult: { hp: 2.5, offline: 1.5 } },
  { id: 'poison', name: '독마', weapon: '독낭', color: '#22c55e',
    tag: '서서히 죽인다',
    desc: '깨달음이 빠르다. 경지에 먼저 닿는다.',
    mult: { bleed: 2.0, ccDur: 1.4, exp: 1.8 } },
];
export const jobOf = (id) => JOBS.find((j) => j.id === id) || null;
export const jobUnlockStage = (i) => JOB_UNLOCK[i] ?? 0;

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

// equip: 지금 가진 것 중 가장 좋은 등급 하나의 보너스
// own:   도감에 적힌 등급마다 더해지는 보너스 — 합성에 써서 없어져도 남는다
//        근거: Blade Idle은 피규어를 '등급별로 하나씩 갖고만 있어도' 공격력이 14.78배가 된다.
//        장착 슬롯 경쟁이 없으니 모으는 것 자체가 성장이다. (docs/BladeIdle_설계원리.md)
export const EQUIP_TYPES = {
  weapon: { name: '검', icon: '검', stat: 'atk', label: '공격력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  armor: { name: '호신의', icon: '호신', stat: 'hp', label: '체력',
    equip: [0.2, 0.5, 1.2, 3, 8, 20], own: [0.05, 0.12, 0.3, 0.75, 2, 5] },
  ring: { name: '옥패', icon: '옥패', stat: 'gold', label: '은자',
    equip: [0.1, 0.25, 0.6, 1.5, 4, 10], own: [0.03, 0.06, 0.15, 0.4, 1, 2.5] },
};
export const ENHANCE_PER = 0.08; // 제련 1단계마다 해당 부위 배율에 +8%p (선형)

// 장비 초월. 근거: TranscendenceTable — 저쪽은 장비에도 초월이 따로 있다.
// 우리는 초월을 장신구와 무공에만 뒀다.
//
// 제련과 겹치지 않게 '값을 다르게' 받는다. 제련은 한철이지만 초월은
// 천품 장비 자체를 먹는다. 천품은 더 합성할 윗등급이 없어서 남는 것이
// 영원히 쌓이기만 했다 — 그 자리를 쓰는 것이다.
// 끼운 하나는 남겨야 하므로 실제로는 비용 + 1개를 들고 있어야 한다.
export const EQUIP_PIERCE_MAX = 6;
export const EQUIP_PIERCE_MULT = 0.5;   // 한 단계마다 그 부위 배율 ×(1+0.5)
export const equipPierceCost = (step) => 1 + step;   // 천품 장비 개수 (합 21)

// ---------- 심검 (저쪽의 '에고') ----------
// 근거: EgoUpgradeTable, EgoEnchantTable, EgoBonusTable.
// 공략: "여기까지 모두 완료하신 여러분은 이제 튜토리얼을 끝내셨다고 보셔도
// 됩니다. 길고 긴 튜토리얼 끝에 본게임 에고 작업을 시작하시면 됩니다."
//   - 갓3등급 이상의 장비를 '먹여서' 경험치를 채운다
//   - 다 차면 승급 도전(던전)을 깨야 다음 단계가 열린다
//   - 초과 경험치는 넘어가지 않는다. "경험치가 5 남은 상태에서 1등급 장비를
//     먹이는 건 엄청난 낭비다" — 그래서 남은 양에 맞춰 먹이는 판단이 생긴다
//   - 소드를 끝내면 아머가 열린다
export const EGO_PARTS = [
  { id: 'blade', name: '심검', stat: 'atk', label: '공격력', open: 150 },
  { id: 'robe', name: '심의', stat: 'hp', label: '체력', open: 0 },  // 심검을 끝내야 열린다
];
export const EGO_STEP_MAX = 5;        // 단계 (1~5)
// 먹일 수 있는 최소 등급. 공략은 "갓3등급 이상"이지만 그쪽은 장비가 넘쳐난다.
// 우리는 150관문에서 보품이 1개뿐이라(점검에서 측정) 진품부터 받는다.
export const EGO_FEED_MIN_GRADE = 2;
// 등급별로 주는 경험치
export const EGO_FEED_EXP = [0, 0, 3, 10, 45, 220];
// 단계를 올리는 데 필요한 경험치
// 첫 단계는 가볍게 둔다. 120으로 두면 보품 12개가 필요한데,
// 그 무렵엔 합성에 다 써버려서 열려도 못 올린다(점검에서 잡힌 문제).
export const egoNeed = (step) => Math.ceil(24 * Math.pow(4.4, step));
// 단계마다 붙는 배수
export const EGO_PER_STEP = 1.1;
export const egoPower = (step) => EGO_PER_STEP * step;
// 승급 도전 상대의 세기 (관문 기준)
export const egoTrialStage = (bestStage, step) => Math.round(bestStage * (0.8 + step * 0.12));
export const EGO_TRIAL_TIME = 45;

// ---------- 심검 강화 ----------
// 근거: EgoEnchantTableData는 mItemList(등록하는 아이템) · mAbilList(붙는 능력) ·
// specialAbil을 들고, GetRegistItemList · IsMaxEnchant · FindEnchantStep이 붙어 있다.
// 즉 **아이템을 바쳐서 영구 능력을 얻는** 축이고, 지금 우리 심검의
// '먹여서 경험치 → 승급 도전'과는 별개다.
//
// 무엇을 바칠 것인가가 설계의 전부였다. 천품 장비는 장비 초월이 쓰고,
// 비급은 무공이, 한철은 제련이 쓴다. 새 자원을 만들면 축만 는다.
//
// 그래서 **쓸 데가 없어서 남는 장신구**를 받는다. 장신구 승급은 '장착한 것과
// 같은 등급'만 재료로 받으므로, 다른 등급은 가방에서 영원히 썩는다
// (점검에서 보품 15개가 통째로 잠긴 걸 확인했다). 그 출구를 만드는 것이다.
export const EGO_ENCHANT_MAX = 6;
// 등급별로 쳐주는 값. 낮은 등급도 받되 윗등급이 훨씬 쳐준다.
export const EGO_ENCHANT_WORTH = [1, 2, 5, 14, 40, 120];
// 단계마다 필요한 값
export const egoEnchantNeed = (step) => Math.ceil(12 * Math.pow(3.2, step));
// 단계마다 붙는 능력. 심검과 심의가 서로 다른 것을 준다.
export const EGO_ENCHANT_ABIL = {
  blade: { stat: 'boss', label: '두목 피해', per: 0.18 },
  robe: { stat: 'offline', label: '방치 보상', per: 0.12 },
};
export const egoEnchantPower = (id, step) => (EGO_ENCHANT_ABIL[id]?.per || 0) * step;
// ---------- 장비 세트 / 총 제련 ----------
// 근거: SetTable, SetAbilTable, SetComponentsTable (세트),
// EquipmentTotalLevelTable, GradeTotalLevelTable (총 레벨).
// 세트는 '세 부위를 같은 등급으로 맞추면' 붙고, 총 레벨은 부위별 제련을
// 전부 더한 값으로 붙는다. 한 부위에 몰아 쓰는 것과 고르게 쓰는 것이
// 서로 다른 보상을 주게 만드는 장치다.
//
// 세트: 세 부위의 '가장 좋은 등급' 중 제일 낮은 것을 기준으로 삼는다.
export const EQUIP_SET_STEPS = [
  { grade: 2, atk: 0.25, hp: 0.2 },
  { grade: 3, atk: 0.6, hp: 0.45, crit: 0.02 },
  { grade: 4, atk: 1.3, hp: 0.9, crit: 0.03, critDmg: 0.4 },
  { grade: 5, atk: 2.6, hp: 1.8, crit: 0.05, critDmg: 0.9 },
];
export const equipSetBonus = (lowGrade) => {
  const out = { atk: 0, hp: 0, crit: 0, critDmg: 0 };
  for (const s of EQUIP_SET_STEPS) {
    if (lowGrade < s.grade) break;
    for (const k of Object.keys(out)) if (s[k]) out[k] = s[k];
  }
  return out;
};
export const nextEquipSetStep = (lowGrade) => EQUIP_SET_STEPS.find((s) => lowGrade < s.grade) ?? null;

// 총 제련: 세 부위의 제련 단계를 더한 값
export const EQUIP_TOTAL_STEPS = [
  { at: 15, gold: 0.2 },
  { at: 40, gold: 0.5, atk: 0.3 },
  { at: 80, gold: 1, atk: 0.7, speed: 0.05 },
  { at: 150, gold: 1.8, atk: 1.4, speed: 0.1 },
  { at: 260, gold: 3, atk: 2.6, speed: 0.16 },
  { at: 420, gold: 5, atk: 4.5, speed: 0.24 },
];
export const equipTotalBonus = (total) => {
  const out = { atk: 0, gold: 0, speed: 0 };
  for (const s of EQUIP_TOTAL_STEPS) {
    if (total < s.at) break;
    for (const k of Object.keys(out)) if (s[k]) out[k] = s[k];
  }
  return out;
};
export const nextEquipTotalStep = (total) => EQUIP_TOTAL_STEPS.find((s) => total < s.at) ?? null;

// ---------- 장비 옵션 칸 ----------
// 근거: Blade Idle의 아이템 테이블은 abil{N}_type / abil{N}_value 쌍을 가지고,
// special_abil_open{0}으로 칸이 하나씩 열리며, specialabil_slotmax가 칸 수,
// special_abil_min/max가 값의 범위다. 즉 "칸마다 {종류, 값}이고 칸은 차차 열린다".
// 공략에서는 분량의 1/3이 이것이다 — 좋은 옵션 하나보다 '네 칸을 신품 이상으로
// 채워서 보유 효과를 켜는 것'이 먼저다. (docs/BladeIdle_설계원리.md)
export const OPTION_SLOTS = 4;
// 제련 단계가 오르면 칸이 하나씩 열린다 (저쪽은 장비 레벨 50단위)
export const OPTION_SLOT_AT = [4, 10, 18, 28];
export const optionSlotCount = (enhanceLv) => OPTION_SLOT_AT.filter((v) => enhanceLv >= v).length;
export const nextOptionSlotAt = (enhanceLv) => OPTION_SLOT_AT.find((v) => enhanceLv < v) ?? null;

// 칸에 붙을 수 있는 능력. per는 등급별 수치(범품~천품).
export const OPTION_STATS = [
  { id: 'atk', name: '공격력', per: [0.06, 0.12, 0.25, 0.5, 1.0, 2.0] },
  { id: 'hp', name: '체력', per: [0.06, 0.12, 0.25, 0.5, 1.0, 2.0] },
  { id: 'critDmg', name: '치명 피해', per: [0.08, 0.16, 0.3, 0.6, 1.2, 2.4] },
  { id: 'crit', name: '치명 확률', per: [0.01, 0.02, 0.03, 0.05, 0.08, 0.12] },
  { id: 'speed', name: '공격 속도', per: [0.02, 0.04, 0.07, 0.12, 0.2, 0.32] },
  { id: 'gold', name: '은자 획득', per: [0.05, 0.1, 0.2, 0.4, 0.8, 1.6] },
  { id: 'boss', name: '두목 피해', per: [0.06, 0.12, 0.25, 0.5, 1.0, 2.0] },
];
export const OPTION_GRADE_RATES = [0.40, 0.28, 0.18, 0.09, 0.04, 0.01];
// 같은 등급이라도 값이 조금씩 다르다 (special_abil_min/max)
export const OPTION_ROLL_MIN = 0.8;
export const OPTION_ROLL_MAX = 1.2;

// 다시 굴리는 값. 잠근 칸이 많을수록 비싸다 —
// 공략: "처음 아무 옵션도 자물쇠가 안 잠겨있을 때 비용이 제일 저렴하다"
export const optionRerollCost = (enhanceLv, locked) =>
  Math.ceil((40 + enhanceLv * 25) * Math.pow(2.2, locked));

// 네 칸을 전부 이 등급 이상으로 채우면 보유 효과가 켜진다
export const OPTION_SET_GRADE = 4;          // 신품
export const OPTION_SET = { crit: 0.06, critDmg: 0.4 };
export const OPTION_SET_FULL_GRADE = 5;     // 천품
export const OPTION_SET_FULL = { crit: 0.06, critDmg: 0.6 };

// ---------- 병기보(도감) ----------
// 한 부위의 모든 등급을 한 번씩 손에 쥐면 그 부위의 보법을 익힌 것으로 친다.
// 근거: Blade Idle은 무기 4슬롯이 전부 신화 이상이면 치명타 보유효과가 켜진다.
// 좋은 옵션 하나보다 '빈칸 없이 채우기'가 먼저가 되는 장치다.
export const CODEX_PER_TYPE = { crit: 0.05 };  // 부위 하나 완성마다 치명타 확률 +5%p
export const CODEX_ALL = { critDmg: 0.5 };     // 세 부위 모두 완성하면 치명타 피해 +50%p
// 제련 비용. 선형이면 한철이 조금만 많이 들어와도 제련이 무한히 올라간다.
// (광맥을 넣자 제련이 208,458단계까지 치솟아서 드러난 문제다)
export const enhanceCost = (e) => Math.ceil((5 + e * 3) * Math.pow(1.06, e)); // 한철

// ---------- 영수 ----------
export const PETS = [
  { id: 'dog', name: '백학', emoji: '🦢', grade: 0, atk: 0.3, own: ['hp', 0.03] },
  { id: 'cat', name: '영묘', emoji: '🐈', grade: 0, atk: 0.3, own: ['gold', 0.03] },
  { id: 'fox', name: '구미호', emoji: '🦊', grade: 1, atk: 0.5, own: ['atk', 0.03] },
  { id: 'owl', name: '영원', emoji: '🐒', grade: 2, atk: 0.7, own: ['exp', 0.04] },
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
  { id: 'sword', name: '만년한철', icon: '만년', stat: 'atk', per: 0.06, max: 100, text: '공격력' },
  { id: 'heart', name: '천년설삼', icon: '설삼', stat: 'hp', per: 0.06, max: 100, text: '체력' },
  { id: 'grail', name: '금두꺼비', icon: '금두', stat: 'gold', per: 0.05, max: 100, text: '은자' },
  { id: 'orb', name: '공청석유', icon: '석유', stat: 'exp', per: 0.05, max: 100, text: '경험치' },
  { id: 'fang', name: '탈혼비수', icon: '비수', stat: 'boss', per: 0.06, max: 100, text: '두목 피해' },
  { id: 'glass', name: '선향', icon: '선향', stat: 'bossTime', per: 0.5, max: 30, text: '두목 제한시간', unit: '초' },
  { id: 'moon', name: '월광옥패', icon: '월광', stat: 'offline', per: 0.05, max: 60, text: '방치 보상' },
  { id: 'feather', name: '능공허도 비급', icon: '능공', stat: 'speed', per: 0.01, max: 50, text: '공격 속도(한계 돌파)' },
];
// ---------- 장신구 ----------
// 근거: AccessoryTable의 컬럼은 accessoryid, accessorymaterial{N},
// accessorymaterial{N}_count, accessoryspecialabilid 다. 즉 장신구는
// '재료를 모아 승급'하고 '특수 능력'을 따로 가진다.
// 공략: 승급(성)과 초월은 별개다. "장신구는 초월을 하느냐 안 하느냐의
// 스펙 차이가 어마어마하다. 현재 6초월 = 한 등급 위 3초월 = 두 등급 위 1초월."
// (docs/BladeIdle_설계원리.md)
// 특기(특수 능력)의 근거: AccessoryTableData가 mAbilDataList(보통 능력)와
// mSpecialAbilList(특기)를 따로 들고, AccessorySpecialAbillTableData에
// IsSpecialAbilCheck · mStar · mWithAccessoryIDList가 있다.
// 즉 "성 수가 조건이 되어 켜지는, 기본 능력과 다른 두 번째 능력"이다.
//
// 저쪽의 mWithAccessoryIDList(다른 장신구를 같이 껴야 켜짐)는 안 옮겼다.
// 공략이 말하는 올바른 수는 "가락지만 집중해서 올린다"인데, 조합을 요구하면
// 그 수를 깎는다. 우리는 '자기 자리에 쏟은 만큼 세지는' 쪽으로만 간다.
//
// 특기가 필요한 진짜 이유: 세 자리가 공격력·치명 피해·체력이라
// 선택 상자를 넣어도 답은 언제나 가락지였다. 고르는 칸만 만들고
// 고를 이유는 안 만든 셈이다. 특기로 세 자리를 서로 다른 축에 세운다.
export const ACC_SLOTS = [
  { id: 'ring', name: '가락지', stat: 'atk', label: '공격력', per: 0.25,
    // 벽(관문지기)이 진행의 병목이다. 거기를 직접 뚫는다.
    special: { name: '파옥', stat: 'boss', label: '두목 피해', per: 0.22 } },
  // '치명 피해는 더하기로 들어가니 작게' 라며 0.04로 뒀었는데, 6분의 1은 너무 깎은
  // 값이었다. 실제로 재 보니 귀걸이에 12단을 전부 쏟아도 DPS가 x1.04였다(8시간 기준).
  // 공격력 1을 더할 때와 치명 피해 1을 더할 때의 기여가 실측으로 거의 같다 —
  //   공격력:   1 / (1 + m.atk)      = 1/28.3 = 0.035
  //   치명 피해: crit / (1 + crit x (critDmg - 1)) = 0.5/13.9 = 0.036
  // 그래서 가락지와 비슷한 값으로 맞춘다.
  { id: 'ear', name: '귀걸이', stat: 'critDmg', label: '치명 피해', per: 0.22,
    // 원래 치명 확률이었다. 그런데 치명 수련이 90레벨에서 상한 50%에 그대로 닿아,
    // 30분 차부터 게임이 끝날 때까지 이 특기가 0을 더하고 있었다.
    // 이름 그대로 '연이어 친다' — 공격 속도로 바꾼다. 여기엔 상한이 없다.
    special: { name: '연격', stat: 'speed', label: '공격 속도', per: 0.03 } },
  { id: 'pin', name: '비녀', stat: 'hp', label: '체력', per: 0.25,
    // 체력은 그 자체로는 진행을 못 민다. 은자로 바꿔 수련에 꽂게 한다.
    special: { name: '축재', stat: 'gold', label: '은자 획득', per: 0.30 } },
];
// 특기가 열리는 성. 여기부터 성과 초월이 1단씩 특기를 키운다.
export const ACC_SPECIAL_STAR = 3;
// 특기 단수 — 3성 0초월이 1단, 6성 6초월이 10단
export const accSpecialStep = (star, pierce) =>
  (star >= ACC_SPECIAL_STAR ? star - ACC_SPECIAL_STAR + 1 : 0) + (star >= ACC_SPECIAL_STAR ? pierce : 0);
export const accSpecialPower = (def, star, pierce) =>
  (def.special ? def.special.per : 0) * accSpecialStep(star, pierce);
export const ACC_STAR_MAX = 6;      // 승급(성)
export const ACC_PIERCE_MAX = 6;    // 초월
// 같은 등급 장신구 이만큼을 모으면 한 성 오른다
export const ACC_MERGE = 3;
// 초월은 한철을 쓴다. 단계가 오를수록 가파르게 비싸진다.
export const accPierceCost = (step) => Math.ceil(300 * Math.pow(3.1, step));
// 승급 1성마다, 초월 1단계마다 붙는 배수.
// 공략의 '6초월 = 한 등급 위 3초월 = 두 등급 위 1초월'이 성립하도록 맞췄다.
export const ACC_STAR_MULT = 0.35;    // 성 하나에 +35%p
export const ACC_PIERCE_MULT = 0.55;  // 초월 하나에 +55%p
// 장신구 하나가 주는 배수
// 등급 배수. 공략의 "6초월 = 한 등급 위 3초월 = 두 등급 위 1초월"이 성립하려면
//   G x (1+0.55x3) = (1+0.55x6)  ->  G = 4.3 / 2.65 = 1.62
//   G x (1+0.55x1) = (1+0.55x3)  ->  G = 2.65 / 1.55 = 1.71
// 둘의 가운데인 1.66으로 잡는다.
export const ACC_GRADE_MULT = 1.66;
export const accPower = (def, grade, star, pierce) =>
  def.per * Math.pow(ACC_GRADE_MULT, grade) * (1 + ACC_STAR_MULT * star) * (1 + ACC_PIERCE_MULT * pierce);
// 세 자리를 전부 채우고 전부 이 등급 이상이면 보유 효과
export const ACC_SET_GRADE = 3;
export const ACC_SET = { boss: 0.5, gold: 0.3 };
// 장신구 상자는 두목과 비경에서 나온다
export const ACC_BOX_RATES = [0.42, 0.27, 0.17, 0.09, 0.04, 0.01];

// 선택 상자. 근거: SelectionBoxTable, 그리고 공략에서 가장 자주 나온 보상이
// "전설 장신구 선택상자"였다. 무작위 상자만 있으면 공략의 핵심 판단인
// "가락지만 집중해서 올린다"가 성립하지 않는다 — 자리를 못 고르니까.
// 그래서 무작위 상자와 따로, 더 드물게 주되 자리를 고르고 등급 바닥을 보장한다.
export const ACC_PICK_MIN = 3;        // 보품 이상만 나온다
export const ACC_PICK_RATES = [0.62, 0.28, 0.10];   // 보품 / 신품 / 천품

// ---------- 인물도감 (저쪽의 '피규어') ----------
// 근거: 공략에서 가장 큰 한 줄. "모든 등급 몬스터·마스터·코스튬 피규어를 하나씩
// 보유만 하고 레벨을 하나도 안 올렸을 때, 공격력 14.78배 · 생명력 6.13배 ·
// 방어력 4배." 장착 슬롯 경쟁이 없어서 모으는 것 자체가 성장이고,
// 그래서 뽑기를 돌릴 이유가 영구히 생긴다. (docs/BladeIdle_설계원리.md 2절)
//
// 우리는 '한 번 쓰러뜨린 상대를 기록한다'로 옮긴다. 병기보가 장비 쪽이라면
// 이건 사람 쪽이다. 기록은 회귀해도 남는다.
// 수치는 공략의 결과(공격력 14.78배 / 생명력 6.13배)에서 역산했다.
// 등급 배수 합이 11.55이므로, 종류별 합 x 11.55 + 전체완성 보너스 = 목표 - 1.
export const CODEX_KINDS = [
  { id: 'mob', name: '잡졸', mult: { atk: 0.16, hp: 0.07 } },
  { id: 'boss', name: '관문지기', mult: { atk: 0.29, hp: 0.11 } },
  { id: 'lord', name: '패왕', mult: { atk: 0.57, hp: 0.18 } },
];
// 등급이 높을수록 한 칸이 크다 (범품~천품)
export const CODEX_GRADE_MULT = [0.35, 0.6, 1, 1.7, 2.9, 5];
// 한 종류를 등급까지 빠짐없이 채우면 보유 효과
export const CODEX_KIND_FULL = { crit: 0.04, boss: 0.25 };
// 세 종류를 전부 채우면 한 번 더
export const CODEX_ALL_FULL = { atk: 2, hp: 1, gold: 0.5 };

// 인물 한 칸이 주는 값
export const codexEntryPower = (kind, grade) => {
  const out = {};
  for (const [k, v] of Object.entries(kind.mult)) out[k] = v * CODEX_GRADE_MULT[grade];
  return out;
};
// 적이 어느 종류·등급으로 기록되는가 — 관문이 오를수록 높은 등급이 나온다
export const codexGradeOf = (stage) => Math.min(5, Math.floor(stage / 40));

// ---------- 의복 (저쪽의 '코스튬') ----------
// 근거: SkinInfoTable / SkinOptionTable / skinoptionid / skinslotnum.
// 공략: "'보유' 효과 입니다. 갖고만 있어도 적용되는 효과들이니 일단 구매할 수
// 있는 건 전부 구매하시는 게 좋습니다." 다이아 27.5만으로 코어공격력 +210%,
// 골드 +30%, 경험치 +20%. (docs/BladeIdle_설계원리.md 2절)
//
// 입는 것은 하나지만 효과는 가진 것 전부가 더해진다. 그래서 '사 모으는' 축이 된다.
// 의복은 원보로만 살 수 있었는데, 원보는 뽑기에도 쓴다. 그리고 뽑기 쪽이
// 압도적으로 이득이라(병기보를 끄면 43%가 떨어진다) 아무도 의복을 사지 않았다.
// 실측: 4시간에 번 원보 36,450 중 33,300이 뽑기로 갔고, 8시간 세이브가
// 12종 중 1종만 갖고 있었다. 끄고 재 보니 체감 0.7%.
//
// 그래서 '뽑기냐 의복이냐'를 고르게 하는 대신, **뽑는 행위가 의복도 모아 준다**로
// 바꿨다. 병기 소환 레벨이 아래 값에 닿을 때마다 아직 없는 의복이 하나씩 온다.
// 원보 구매는 '먼저 갖고 싶으면'으로 남기되 값을 3분의 1로 내렸다.
// (Blade Idle도 코스튬은 뽑기에서 나온다)
export const OUTFIT_GACHA_LVS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18];
// 그 레벨에 의복을 하나 주는가
export const isOutfitGachaLv = (lv) => OUTFIT_GACHA_LVS.includes(lv);
// 아직 안 받은 의복이 몇 레벨에 오는가
export const nextOutfitGachaLv = (lv) => OUTFIT_GACHA_LVS.find((v) => v > lv) ?? null;

export const OUTFITS = [
  { id: 'student', name: '청의 서생', cost: 5000, own: { atk: 0.4 }, color: '#60a5fa' },
  { id: 'cat', name: '흑묘 야행의', cost: 10000, own: { atk: 0.2, gold: 0.2 }, color: '#a3a3a3' },
  { id: 'royal', name: '금수 궁장', cost: 10000, own: { atk: 0.2, critDmg: 0.3 }, color: '#f59e0b' },
  { id: 'teacher', name: '백록 도포', cost: 10000, own: { atk: 0.2, exp: 0.2 }, color: '#e5e7eb' },
  { id: 'slayer', name: '적룡 전포', cost: 10000, own: { atk: 0.2, boss: 0.2 }, color: '#ef4444' },
  { id: 'chick', name: '황조 경장', cost: 10000, own: { atk: 0.2, speed: 0.08 }, color: '#fde047' },
  // 무기 치장
  { id: 'moonblade', name: '월하검 장식', cost: 3300, own: { atk: 0.2 }, color: '#bae6fd' },
  { id: 'grass', name: '초결 매듭', cost: 6700, own: { atk: 0.1, gold: 0.1 }, color: '#86efac' },
  { id: 'doom', name: '흑철 검집', cost: 6700, own: { atk: 0.1, critDmg: 0.15 }, color: '#71717a' },
  { id: 'love', name: '홍매 수실', cost: 6700, own: { atk: 0.1, exp: 0.1 }, color: '#f9a8d4' },
  { id: 'dragon', name: '용린 손잡이', cost: 6700, own: { atk: 0.1, boss: 0.1 }, color: '#fb923c' },
  { id: 'bell', name: '은방울 끈', cost: 6700, own: { atk: 0.1, speed: 0.04 }, color: '#fcd34d' },
];
// 전부 모으면 한 번 더
export const OUTFIT_ALL = { atk: 0.5, crit: 0.03 };
export const outfitTotalCost = () => OUTFITS.reduce((a, o) => a + o.cost, 0);

// ---------- 소환 레벨 ----------
// 근거: GachaLvUpTable. 공략의 두 줄이 핵심이다.
//  "갓4,3등급은 무기소환 5레벨 이후부터, 갓2등급은 11레벨, 갓1등급은 12레벨 이후 나온다"
//   -> 소환 레벨이 '상위 등급을 연다'. 돈만 쓴다고 최상위가 나오지 않는다.
//  "장신구 소환 6레벨 달성보상은 전설 선택상자 8개 (누적 21개)"
//   -> 레벨 자체가 보상이다. 그래서 뽑는 행위에 바닥이 생긴다.
// (docs/BladeIdle_설계원리.md)
export const GACHA_KINDS = [
  { id: 'equip', name: '병기 소환' },
  { id: 'pet', name: '영수 알' },
  { id: 'relic', name: '신물 발굴' },
];
export const GACHA_LV_MAX = 20;
// 다음 레벨까지 더 뽑아야 하는 횟수
export const gachaLvNeed = (lv) => Math.ceil(10 * Math.pow(1.32, lv));
// 등급마다 열리는 소환 레벨. 공략의 "갓1등급은 12레벨 이후"를 그대로 옮겼다.
export const GACHA_GRADE_OPEN = [0, 0, 2, 5, 9, 12];
export const gachaMaxGrade = (lv) => {
  let cap = 0;
  GACHA_GRADE_OPEN.forEach((need, g) => { if (lv >= need) cap = g; });
  return cap;
};
// 레벨이 오를수록 윗등급 쪽으로 무게가 쏠린다
export const GACHA_LV_TILT = 0.055;

// 레벨 달성 보상. 짝수 레벨마다 조금, 5·10·15·20에서 크게.
export function gachaLvReward(kind, lv) {
  const big = lv % 5 === 0;
  const r = {};
  if (kind === 'equip') {
    r.stones = Math.ceil((big ? 400 : 90) * Math.pow(1.5, lv));
    if (big) r.gems = 500 * lv;
  } else if (kind === 'pet') {
    r.food = Math.ceil((big ? 350 : 80) * Math.pow(1.5, lv));
    if (big) r.gems = 400 * lv;
  } else {
    r.relicShards = Math.ceil((big ? 40 : 10) * Math.pow(1.42, lv));
    if (big) r.gems = 400 * lv;
  }
  // 5레벨마다 장신구 상자 — 공략의 '달성보상 선택상자'에 해당
  if (big) r.accBox = Math.max(1, Math.floor(lv / 5) * 3);
  if (big && lv % 10 === 0) r.accPick = Math.floor(lv / 10);
  return r;
}

// ---------- 한철 광맥 (저쪽의 '광산') ----------
// 근거: MineTable, MinerTable. 광맥 자체를 키우고, 캐는 사람을 따로 붙인다.
// 방치형에서 이게 하는 일은 분명하다 — 싸우지 않는 동안에도 자원이 쌓이고,
// 그 자원이 다른 축(제련·옵션 다시 굴리기·장신구 초월)의 연료가 된다.
// 우리는 한철이 이미 세 군데(제련·옵션·장신구 초월)에서 쓰이므로 광맥을
// 한철에 붙인다. 쓰임이 많은 자원일수록 '아껴 쓰는' 판단이 생긴다.
export const MINE_OPEN_STAGE = 40;   // 벽 자리에 맞춘다
export const MINE_DEPTH_MAX = 50;      // 갱도 깊이
export const MINE_HAND_MAX = 20;       // 광부 수
export const MINE_CAP_HOURS = 8;       // 이만큼 지나면 더 안 쌓인다
// 깊이를 한 칸 내리는 값 (은자)
export const mineDepthCost = (d) => Math.ceil(5e4 * Math.pow(1.55, d));
// 광부를 한 명 더 쓰는 값 (은자)
export const mineHandCost = (h) => Math.ceil(2e5 * Math.pow(1.9, h));
// 초당 캐는 한철. 지수를 얕게 잡는다 — 한철은 귀한 자원이라
// 광맥이 다른 수급을 압도하면 제련이 통째로 망가진다.
export const mineRate = (depth, hands) =>
  (depth <= 0 ? 0 : 0.02 * Math.pow(1.075, depth) * (1 + hands * 0.55));
export const mineCap = (depth, hands) => mineRate(depth, hands) * MINE_CAP_HOURS * 3600;

export const RELIC_DIG_COST = 10; // 신물 조각

// ---------- 상태이상 ----------
// 근거: CrowdControlTable. 우리는 빙결 하나뿐이라, 동작은 여섯 가지로
// 갈라놨는데 효과는 전부 '피해'였다. 무공을 고르는 이유가 수치밖에 없었다.
export const CC = {
  freeze: { id: 'freeze', name: '빙결', color: '#bae6fd', desc: (s) => `${s}초간 멈춤` },
  slow: { id: 'slow', name: '둔화', color: '#a5b4fc', desc: (s) => `${s}초간 걸음 절반` },
  bleed: { id: 'bleed', name: '출혈', color: '#fca5a5', desc: (s) => `${s}초간 초당 피해` },
  weak: { id: 'weak', name: '파쇄', color: '#fcd34d', desc: (s) => `${s}초간 받는 피해 증가` },
};
export const CC_SLOW_MULT = 0.45;     // 둔화 때 걸음
export const CC_BLEED_PER = 0.22;     // 출혈 1초당 그 일격의 이만큼
export const CC_WEAK_MULT = 1.35;     // 파쇄 중에는 받는 피해가 이만큼

// ---------- 무공 ----------
// motion = 어떻게 맞히는가. 근거: Blade Idle의 SkillTable에는 skillmovespeed,
// skillmovetime, skillmovestopintervaldistance가 있다. 즉발이 아니라 날아가고
// 번지는 게 기본이다. 주인공 이펙트 프리팹에서 뽑은 동작이 아래 여섯 가지다.
// (docs/BladeIdle_스킬구조.md)
//
//   aoe     발밑 원형 장판 (기본)
//   single  한 명
//   chain   가까운 적부터 옮겨탄다        ← ChainLighting
//   dash    직선으로 관통하며 벤다        ← SkillDash
//   blink   가장 먼 적에게 순간이동 일격   ← TeleportSlash
//   field   그 자리에 남아 계속 벤다      ← SkillField
//   tornado 장판이 스스로 굴러다닌다      ← Tornado
//   pierce  직선상의 적 전부             ← SwordProjectile
export const SKILLS = [
  { id: 'slash', name: '선풍검', icon: '선풍', unlock: 1, cd: 5, kind: 'dmg', motion: 'aoe', target: 'all', radius: 150,
    cc: 'bleed', ccSec: 4,
    mult: (l) => 4 + l * 0.6, desc: (m) => `발밑 반경 150 안의 적 전체에게 공격력의 ${m.toFixed(1)}배` },
  { id: 'rage', name: '혈마해방', icon: '혈마', unlock: 10, cd: 18, dur: 8, kind: 'buff',
    mult: (l) => 1.5 + l * 0.06, desc: (m) => `8초간 공격력 ${m.toFixed(2)}배` },
  { id: 'heal', name: '운기조식', icon: '조식', unlock: 30, cd: 14, kind: 'heal',
    mult: (l) => Math.min(1, 0.3 + l * 0.02), desc: (m) => `체력 ${Math.round(m * 100)}% 회복` },
  { id: 'thunder', name: '뇌정검', icon: '뇌정', unlock: 50, cd: 11, kind: 'dmg', motion: 'aoe', target: 'all', radius: 210,
    cc: 'slow', ccSec: 5,
    mult: (l) => 12 + l * 1.8, desc: (m) => `발밑 반경 210 안의 적 전체에게 공격력의 ${m.toFixed(1)}배 낙뢰` },
  { id: 'gale', name: '질풍보', icon: '질풍', unlock: 70, cd: 22, dur: 10, kind: 'buff',
    mult: (l) => 1.5 + l * 0.03, desc: (m) => `10초간 공격 속도 ${m.toFixed(2)}배 (한계 돌파)` },
  { id: 'midas', name: '천금수', icon: '천금', unlock: 90, cd: 30, dur: 15, kind: 'buff',
    mult: (l) => 2 + l * 0.1, desc: (m) => `15초간 은자 ${m.toFixed(1)}배` },
  { id: 'frost', name: '빙백신장', icon: '빙백', unlock: 100, cd: 14, kind: 'dmg', motion: 'single', stun: 3, cc: 'freeze', ccSec: 3, target: 'single', bossMult: 1.8, radius: 70,
    mult: (l) => 8 + l * 1.2, desc: (m) => `한 명에게 공격력의 ${m.toFixed(1)}배 + 3초 빙결 · 두목에겐 1.8배` },
  { id: 'meteor', name: '만검귀종', icon: '만검', unlock: 110, cd: 26, kind: 'dmg', motion: 'aoe', target: 'all', radius: 300,
    cc: 'weak', ccSec: 8,
    mult: (l) => 40 + l * 6, desc: (m) => `발밑 반경 300 안의 적 전체에게 검 비 · 공격력의 ${m.toFixed(0)}배` },

  // --- 여기부터 동작이 다른 무공 ---
  { id: 'chain', name: '연환벽력', icon: '연환', unlock: 120, cd: 13, kind: 'dmg', motion: 'chain',
    chainRange: 190, chainFalloff: 0.88, chain: (l) => 5 + Math.floor(l / 3), cc: 'slow', ccSec: 4,
    mult: (l) => 18 + l * 2.4,
    desc: (m, l) => `가까운 적부터 ${5 + Math.floor(l / 3)}명에게 옮겨타며 공격력의 ${m.toFixed(0)}배 · 옮길수록 12%씩 약해져요` },
  { id: 'dash', name: '발도돌격', icon: '발도', unlock: 130, cd: 16, kind: 'dmg', motion: 'dash',
    dashDist: 300, dashWidth: 110, cc: 'bleed', ccSec: 6,
    mult: (l) => 30 + l * 4,
    desc: (m) => `앞으로 300만큼 파고들며 지나간 길의 적 전부에게 공격력의 ${m.toFixed(0)}배` },
  { id: 'blink', name: '축지참', icon: '축지', unlock: 140, cd: 18, kind: 'dmg', motion: 'blink', bossMult: 2.2,
    mult: (l) => 55 + l * 8,
    desc: (m) => `가장 먼 적(두목 우선)에게 순간이동해 공격력의 ${m.toFixed(0)}배 · 두목에겐 2.2배` },
  { id: 'plum', name: '매화검진', icon: '매화', unlock: 150, cd: 24, kind: 'dmg', motion: 'field',
    radius: 190, fieldSec: 6, tickSec: 0.5, cc: 'weak', ccSec: 4,
    mult: (l) => 9 + l * 1.2,
    desc: (m) => `그 자리에 6초간 검진을 남겨 0.5초마다 반경 190의 적에게 공격력의 ${m.toFixed(1)}배` },
  { id: 'tornado', name: '선풍장', icon: '회선', unlock: 160, cd: 28, kind: 'dmg', motion: 'tornado',
    radius: 150, fieldSec: 8, tickSec: 0.4, moveSpeed: 90, cc: 'slow', ccSec: 3,
    mult: (l) => 7 + l * 1,
    desc: (m) => `회오리가 8초간 들판을 돌아다니며 0.4초마다 공격력의 ${m.toFixed(1)}배` },
  { id: 'pierce', name: '일자검기', icon: '일자', unlock: 170, cd: 20, kind: 'dmg', motion: 'pierce',
    pierceLen: 520, pierceWidth: 90, cc: 'bleed', ccSec: 5,
    mult: (l) => 35 + l * 5,
    desc: (m) => `바라보는 방향 520 거리의 일직선상 적 전부에게 공격력의 ${m.toFixed(0)}배` },

  // --- 계열 전용 무공 ---
  // 여덟 계열마다 하나씩. 일반 칸을 먹지 않고 **문파 칸**에 따로 들어간다.
  // unlock은 안 쓴다 — 문파(또는 맛보기)가 곧 해금이다.
  // 각자 1차에서 잰 자기 축을 그대로 민다. 축이 겹치면 고르는 의미가 사라진다.
  { id: 'jsword', name: '일점혈로', icon: '일점', job: 'sword', unlock: 0, cd: 15,
    kind: 'dmg', motion: 'blink', bossMult: 2.6,
    mult: (l) => 50 + l * 7,
    desc: (m) => `가장 먼 적(두목 우선)에게 파고들어 공격력의 ${m.toFixed(0)}배 · 두목에겐 2.6배` },
  { id: 'jblade', name: '혈풍참', icon: '혈풍', job: 'blade', unlock: 0, cd: 9,
    kind: 'dmg', motion: 'dash', dashDist: 380, dashWidth: 220, cc: 'bleed', ccSec: 6,
    bossMult: 0.5,
    mult: (l) => 80 + l * 11,
    desc: (m) => `앞으로 380만큼 베어 나가며 지나간 길 폭 220의 적 전부에게 공격력의 ${m.toFixed(0)}배`
      + ` · 혼자 선 두목에게는 절반만` },
  { id: 'jfist', name: '붕권', icon: '붕권', job: 'fist', unlock: 0, cd: 4,
    kind: 'dmg', motion: 'aoe', target: 'all', radius: 170,
    mult: (l) => 24 + l * 3.4,
    desc: (m) => `5초마다 반경 170을 내지른다 · 공격력의 ${m.toFixed(1)}배` },
  { id: 'jring', name: '단지멸', icon: '단지', job: 'ring', unlock: 0, cd: 10,
    kind: 'dmg', motion: 'single', target: 'single', sure: true,
    mult: (l) => 13 + l * 1.7,
    desc: (m) => `한 명에게 공격력의 ${m.toFixed(1)}배 · **반드시 치명**으로 들어간다` },
  { id: 'jdrunk', name: '취보난무', icon: '취보', job: 'drunk', unlock: 0, cd: 24,
    kind: 'dmg', motion: 'tornado', radius: 160, fieldSec: 8, tickSec: 0.4, moveSpeed: 110,
    cc: 'slow', ccSec: 3,
    boon: { stat: 'gold', dur: 10, mult: (l) => 2 + l * 0.08 },
    mult: (l) => 8 + l * 1.1,
    desc: (m, l) => `비틀대며 8초간 들판을 돌아 0.4초마다 공격력의 ${m.toFixed(1)}배 · 그동안 은자 ${(2 + l * 0.08).toFixed(1)}배` },
  { id: 'jfan', name: '환영진', icon: '환영', job: 'fan', unlock: 0, cd: 20,
    kind: 'dmg', motion: 'field', radius: 210, fieldSec: 7, tickSec: 0.6, cc: 'weak', ccSec: 12,
    bossMult: 0.6,
    mult: (l) => 5 + l * 0.7,
    desc: (m) => `반경 210에 7초짜리 환영을 깔아 0.6초마다 공격력의 ${m.toFixed(1)}배`
      + ` · 걸린 적은 12초간 파쇄(맞는 피해 1.35배)` },
  { id: 'jmonk', name: '금강부동', icon: '금강', job: 'monk', unlock: 0, cd: 12,
    kind: 'dmg', motion: 'aoe', target: 'all', radius: 220, selfHeal: 0.35,
    hpScale: (l) => 45 + l * 3.2,
    mult: (l) => 18 + l * 2.4,
    desc: (m, l) => `반경 220을 쓸고 체력을 35% 회복한다 · 공격력의 ${m.toFixed(1)}배`
      + ` + 내 체력의 ${(45 + l * 3.2).toFixed(0)}배` },
  { id: 'jpoison', name: '만독강림', icon: '만독', job: 'poison', unlock: 0, cd: 26,
    kind: 'dmg', motion: 'field', radius: 210, fieldSec: 8, tickSec: 0.5, cc: 'weak', ccSec: 6,
    boon: { stat: 'exp', dur: 12, mult: (l) => 2 + l * 0.09 },
    mult: (l) => 6 + l * 0.9,
    desc: (m, l) => `반경 210에 8초간 독무를 깔아 0.5초마다 공격력의 ${m.toFixed(1)}배 · 그동안 경험치 ${(2 + l * 0.09).toFixed(1)}배` },
];

// 계열 무공만 따로. 문파 칸에 들어가고 일반 칸에는 절대 안 들어간다.
export const JOB_SKILLS = SKILLS.filter((s) => s.job);
export const jobSkillOf = (jobId) => SKILLS.find((s) => s.job === jobId) || null;
// 보너스(은자·경험치)를 거는 계열 무공만 추려 둔다. stats()가 매 프레임 도는 곳이다.
export const BOON_SKILLS = SKILLS.filter((s) => s.boon);
// ---------- 무공 초월 / 총 레벨 ----------
// 근거: SkillTranscendenceTable, SkillTotalLevelTable, ActiveSkillTranscendence.
// 레벨 위에 한 겹(초월)이 더 있고, '모든 무공 레벨의 합'이 따로 보너스를 준다.
// 총 레벨 보너스가 있으면 안 쓰는 무공도 올릴 이유가 생긴다 —
// 슬롯이 넷뿐인데 무공이 열넷이라 이게 없으면 열 개는 영영 1레벨이다.
export const SKILL_PIERCE_MAX = 5;
export const SKILL_PIERCE_AT = 20;   // 이 레벨부터 초월할 수 있다
// 초월 한 단계에 그 무공의 배율이 이만큼 더 붙는다
export const SKILL_PIERCE_MULT = 0.25;
// 초월 비용은 비급으로 낸다
export const skillPierceCost = (step) => Math.ceil(400 * Math.pow(3.4, step));

// 모든 무공 레벨을 더한 값에 따라 붙는 보너스
export const SKILL_TOTAL_STEPS = [
  { at: 20, atk: 0.15 },
  { at: 60, atk: 0.35, crit: 0.02 },
  { at: 140, atk: 0.7, critDmg: 0.3 },
  { at: 280, atk: 1.3, crit: 0.03, critDmg: 0.5 },
  { at: 500, atk: 2.2, crit: 0.04, critDmg: 0.8 },
  { at: 900, atk: 4, crit: 0.05, critDmg: 1.2 },
];
export const skillTotalBonus = (total) => {
  const out = { atk: 0, crit: 0, critDmg: 0 };
  for (const s of SKILL_TOTAL_STEPS) {
    if (total < s.at) break;
    for (const k of Object.keys(out)) if (s[k]) out[k] = s[k];
  }
  return out;
};
export const nextSkillTotalStep = (total) => SKILL_TOTAL_STEPS.find((s) => total < s.at) ?? null;

// ---------- 출진 준비 (저쪽의 '장비 프리셋') ----------
// 근거: ItemEquipPresetTable, PresetGroupTable.
// 공략 13절이 통째로 '골드·경험치 작업(골경작)'이고, 그 전제가
// "장비의 옵션작에 골드·경험치 옵션을 도배해둔 별도의 세팅"이다.
//
// 다만 옵션 칸까지 프리셋에 넣지는 않는다. 넣으면 다시 굴려서 망해도
// 되돌릴 수 있게 되어, '잠근 칸이 많을수록 비싸진다'는 장치가 무의미해진다.
// 대신 무공 넷과 영수를 한 벌로 묶는다 — 무공이 열넷인데 칸이 넷이라
// 사냥용·두목용·벌이용을 바꿔 끼우는 것만으로도 충분히 다르다.
export const PRESET_SLOTS = 3;
export const PRESET_NAMES = ['사냥', '두목', '벌이'];

// 무공 칸. 저쪽은 SkillSlotTable이 따로 있어 칸 자체가 성장한다.
// 우리는 무공이 열넷인데 칸이 넷이라 열 개를 못 썼다.
export const SKILL_SLOTS = 6;          // 끝까지 열었을 때
export const SKILL_SLOT_BASE = 4;      // 처음 열려 있는 칸
export const SKILL_SLOT_AT = [180, 260];   // 다섯째·여섯째 칸이 열리는 관문 (벽 자리)
export const skillSlotCount = (bestStage) =>
  SKILL_SLOT_BASE + SKILL_SLOT_AT.filter((v) => bestStage >= v).length;
export const nextSkillSlotAt = (bestStage) => SKILL_SLOT_AT.find((v) => bestStage < v) ?? null;
export const skillBookCost = (l) => Math.ceil(2 * Math.pow(1.15, l - 1));

// 무공을 올려도 '더 자주 나간다'는 느낌이 없었다. 배율만 오르고 쿨은 그대로라
// 뒤에 열리는 센 무공일수록(쿨 40~45초) 손이 비는 시간이 늘었다.
// Blade Idle에는 ActiveSkillGrowth라는 성장 단계가 따로 있다(docs/BladeIdle_스킬구조.md 3절).
// 우리는 레벨과 초월에 쿨 감소를 얹는다.
export const SKILL_CD_PER_LV = 0.006;    // 레벨 1당 0.6%
export const SKILL_CD_PER_PIERCE = 0.04; // 초월 1단당 4%
export const SKILL_CD_MIN = 0.45;        // 아무리 올려도 절반 아래로는 안 간다
export const skillCd = (base, lv = 1, pierce = 0) => base * Math.max(
  SKILL_CD_MIN,
  1 - SKILL_CD_PER_LV * Math.max(0, lv - 1) - SKILL_CD_PER_PIERCE * pierce,
);

// 맛보기 — 일류에 오르면 화경 전까지 여덟 계열 무공을 하나씩 써 볼 수 있다.
// 공짜로 몇 번이든 바꾼다. 올린 레벨은 남아서, 그 계열로 입문하면 이어진다.
export const TASTE_RANK = 2;

// ---------- 적 무인 외형 ----------
// head: band(머리띠) topknot(상투) hat(삿갓) hood(두건) mask(복면) bald(민머리) jiangshi(강시 관)
// weapon: sword(검) saber(도) spear(창) axe(도끼) fan(부채) fist(맨손) claw(조법) dagger(비수)
const F = (name, look) => ({ name, look });
const B = (name, emoji) => ({ name, emoji }); // 짐승은 이모지

// ---------- 수련터 ----------
export const DUNGEONS = [
  { id: 'gold', name: '흑도 전장', icon: '전장', unlock: 20, base: 10, reward: '은자',
    mob: F('전장 호위', { robe: '#3f3a36', head: 'band', band: '#111', weapon: 'saber' }),
    boss: F('전장주', { robe: '#78350f', trim: '#d4a64a', head: 'topknot', weapon: 'axe', beard: true, scale: 1.35 }) },
  { id: 'stone', name: '한철 광산', icon: '광산', unlock: 40, base: 20, reward: '한철',
    mob: F('광산 파수꾼', { robe: '#44403c', head: 'hood', weapon: 'axe' }),
    boss: F('철갑 거한', { robe: '#1f2937', trim: '#9ca3af', head: 'bald', weapon: 'fist', scale: 1.5 }) },
  { id: 'pet', name: '영수 계곡', icon: '계곡', unlock: 60, base: 30, reward: '영수 먹이',
    mob: B('계곡 늑대', '🐺'), boss: B('산군', '🐅') },
  { id: 'relic', name: '고수의 동부', icon: '동부', unlock: 80, base: 40, reward: '신물 조각',
    mob: F('동부 강시', { robe: '#1e3a5f', head: 'jiangshi', skin: '#a3b8a0', weapon: 'claw', jiangshi: true }),
    boss: F('천년 강시', { robe: '#0f172a', trim: '#d4a64a', head: 'jiangshi', skin: '#8fa08a', weapon: 'claw', jiangshi: true, scale: 1.45 }) },
];
// ---------- 벽에서 열리는 것 ----------
// 벽은 그냥 어려워지는 자리가 아니라 뭔가 열리는 자리여야 한다.
// 근거: Blade Idle의 해금 13곳이 전부 난이도 벽과 같은 자리에 있다.
// (docs/BladeIdle_설계원리.md)
let _unlockMap = null;
function unlockMap() {
  if (_unlockMap) return _unlockMap;
  _unlockMap = new Map();
  const add = (stage, text) => {
    if (stage <= 1) return;
    if (!_unlockMap.has(stage)) _unlockMap.set(stage, []);
    _unlockMap.get(stage).push(text);
  };
  for (const sk of SKILLS) add(sk.unlock, `무공 〈${sk.name}〉`);
  for (const d of DUNGEONS) add(d.unlock, `비경 〈${d.name}〉`);
  return _unlockMap;
}
// 그 관문을 깨면 열리는 것들
export const unlocksAt = (stage) => unlockMap().get(stage) || [];
// 아직 안 열린 것 중 가장 가까운 것 {stage, items}
export function nextUnlock(bestStage) {
  let best = null;
  for (const [stage, items] of unlockMap()) {
    if (stage <= bestStage) continue;
    if (!best || stage < best.stage) best = { stage, items };
  }
  return best;
}

export const DUNGEON_KEYS = 2;      // 하루에 이만큼 들어온다
// ---------- 아껴 쓰는 자원 ----------
// 열쇠와 패는 날마다 초기화되지 않고 쌓인다. 안 그러면 '아꼈다 쓴다'는 판단 자체가
// 성립하지 않는다 — 어차피 자정에 사라지니 지금 써야 하는 것이다.
// 근거: Blade Idle 공략의 핵심 판단은 전부 "지금 쓰면 손해, 나중에 쓰면 이득"이다.
// 레이드 티켓은 1단계에서 쓰지 말고 2단계(20-50)에서, 펫 소탕권은 전설 펫을
// 클리어한 뒤에 쓴다. (docs/BladeIdle_설계원리.md 4절)
// 상한을 두는 이유: 무한히 모으면 반대로 '영원히 안 쓰는 게 이득'이 된다.
export const DUNGEON_KEY_CAP = 10;  // 비경 열쇠는 닷새치까지 쌓인다
export const RAID_TICKET_CAP = 9;   // 토벌 패는 사흘치
export const PVP_TICKET_CAP = 10;   // 결투 패는 닷새치

// 비경 보상은 단계마다 조금씩 오르다가, 이 단계들에서 한 번씩 크게 뛴다.
// 선형 증가만 있으면 지금 쓰나 나중에 쓰나 같아서 아낄 이유가 없다.
export const DUNGEON_TIERS = [5, 10, 15, 20];
export const dungeonTierOf = (lv) => DUNGEON_TIERS.filter((t) => lv >= t).length;
export const DUNGEON_TIER_MULT = 1.8;  // 구간 하나 넘을 때마다 보상 배수
export const DUNGEON_TIME = 40;
export const DUNGEON_MOBS = 12;
// 비경 난이도는 예전 기준(base)을 쓴다. 개방 관문(unlock)을 벽으로 옮기면서
// 난이도까지 같이 밀리면 보상이 뒤집힌다.
export const dungeonStage = (d, lv) => d.base + (lv - 1) * 4;
export function dungeonReward(id, lv) {
  const eq = dungeonStage(DUNGEONS.find((d) => d.id === id), lv);
  const step = Math.pow(DUNGEON_TIER_MULT, dungeonTierOf(lv));
  const r = (v) => Math.max(1, Math.floor(v * step));
  switch (id) {
    case 'gold': return { gold: monsterGold(eq) * 400 * step };
    case 'stone': return { stones: r(30 + lv * 8) };
    case 'pet': return { food: r(20 + lv * 6) };
    case 'relic': return { relicShards: r(10 + lv * 2) };
    default: return {};
  }
}

// 다음 구간까지 몇 단계 남았나 (없으면 null)
export const nextDungeonTier = (lv) => DUNGEON_TIERS.find((t) => lv < t) ?? null;

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
    boss: F('천마', { robe: '#050505', trim: '#dc2626', head: 'topknot', hair: '#111', weapon: 'sword', aura: '#dc2626', eyes: '#ef4444', scale: 1.55 }) },
];
export const RAID_BOSS = F('혈마', { robe: '#1a0505', trim: '#ef4444', head: 'topknot', hair: '#7f1d1d', weapon: 'saber', aura: '#dc2626', eyes: '#fca5a5', scale: 2.1 });

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
// ---------- 난이도 곡선: 톱니 ----------
// 근거: Blade Idle은 적 HP 증가율이 주기 안에서 2.55%→1.63%로 체감하다가
// 주기 끝에서 ×1.39로 한 번 크게 뛴다(벽). 로그로 보면 벽이 주기 전체 성장의
// 약 40%를 혼자 차지한다. 그리고 그 벽 자리마다 새 콘텐츠가 열린다.
// (docs/BladeIdle_진행구조.md · docs/BladeIdle_설계원리.md)
//
// 우리는 10관문이 한 주기다 — 지역이 바뀌는 자리와 같다.
// 주기 전체 배수는 예전 공식(×1.17^10)과 똑같이 두고 모양만 바꿨으므로,
// 10관문 경계에서는 예전 값과 정확히 일치한다. 밸런스 총량은 그대로다.
export const WALL_CYCLE = 10;
export const isWallStage = (s) => s % WALL_CYCLE === 0;
export const nextWall = (s) => Math.ceil((s + 1) / WALL_CYCLE) * WALL_CYCLE;

const WALL_SHARE = 0.4;   // 벽이 한 주기 성장에서 차지하는 비중(로그 기준)
const DECAY = 0.64;       // 주기 안에서 증가율이 이만큼까지 떨어진다

// 주기 안 k번째(0~8) 평범한 관문의 로그 증가율. k가 커질수록 완만해진다.
function stepLog(cycleLog, k) {
  const mean = (cycleLog * (1 - WALL_SHARE)) / (WALL_CYCLE - 1);
  const a = (2 * mean) / (1 + DECAY);
  const b = a * DECAY;
  return a + (b - a) * (k / (WALL_CYCLE - 2));
}

// 1관문부터 s관문까지의 누적 로그 배수. 어느 10구간을 잘라도 합은 cycleLog라
// 예전 지수 공식과 10관문마다 다시 만난다.
function cumLog(s, base) {
  if (s <= 1) return 0;
  const cycleLog = WALL_CYCLE * Math.log(base);
  let total = 0;
  for (let c = 0; c < WALL_CYCLE; c++) {
    let first = c + 1;
    if (first < 2) first += WALL_CYCLE;      // c=0은 11관문부터
    if (s < first) continue;
    const n = Math.floor((s - first) / WALL_CYCLE) + 1;
    total += n * (c === WALL_CYCLE - 1 ? cycleLog * WALL_SHARE : stepLog(cycleLog, c));
  }
  return total;
}

// 관문 하나가 몇 배씩 세지는가. **성장 속도의 주 손잡이**다.
//
// 전에는 끝까지 x1.17 고정이었다. 그런데 고정이면 후반이 막힌다 —
// 일주일 시뮬에서 회귀를 31번 돌려 능력을 165배로 쌓고도 관문 349에서
// 더 못 갔다. 관문 하나에 +18%가 필요한데 165배는 29관문어치뿐이다.
//
// Blade Idle은 **증가율 자체가 체감한다**(한 주기 안에서 x1.0255 -> x1.0163).
// 우리는 그 모양을 10관문 주기 안에서만 만들어 뒀고 주기 총합은 어디서나
// 같았다. 이제 총합도 관문이 오를수록 완만해진다.
// (docs/BladeIdle_진행구조.md 3절)
export const STAGE_HP_RATE = 1.18;        // 첫 관문
export const STAGE_HP_RATE_LATE = 1.13;   // 다 완만해졌을 때
export const STAGE_EASE_AT = 800;         // 여기쯤에서 끝 값에 닿는다
// 맞춘 과정: x1.10/400관문으로 먼저 풀었더니 후반 벽은 뚫렸는데(사흘 349 -> 630)
// 하루에 511관문까지 가서 콘텐츠(480)를 하루에 다 열어 버렸다.
// 끝 값을 올리고 완만해지는 지점을 멀리 밀어 세 조합을 재 봤다:
//   x1.14/600 -> 3시간 165 · x1.15/500 -> 173 · x1.13/800 -> **151**
export const stageRate = (s) => STAGE_HP_RATE
  + (STAGE_HP_RATE_LATE - STAGE_HP_RATE) * Math.min(1, Math.max(0, s - 1) / STAGE_EASE_AT);

// 증가율이 관문마다 다르면 닫힌 식으로 못 센다. 1관문부터 쌓아 두고 꺼내 쓴다.
// (monsterHp는 매 프레임 불린다 — 매번 수백 번 더하면 안 된다)
const _cum = [0, 0];
function cumEase(s) {
  const n = Math.max(1, Math.floor(s));
  for (let k = _cum.length; k <= n; k++) {
    const c = (k - 1) % WALL_CYCLE;                  // 주기 안 자리. 9가 벽이다.
    const cycleLog = WALL_CYCLE * Math.log(stageRate(k));
    _cum[k] = _cum[k - 1]
      + (c === WALL_CYCLE - 1 ? cycleLog * WALL_SHARE : stepLog(cycleLog, c));
  }
  return _cum[n];
}

// 이 관문으로 넘어올 때 적이 몇 배 세지는가 (화면에 보여주려고 따로 둔다)
export const stageJump = (s) => (s <= 1 ? 1 : Math.exp(cumEase(s) - cumEase(s - 1)));

export const monsterHp = (s) => 20 * Math.exp(cumEase(s));
// 적 공격력.
//
// 전에는 끝까지 x1.19였다. 그런데 **플레이어 체력은 관문당 x1.14로밖에 안 자란다** —
// 재 보니 85→493관문 구간에서 x1.126~x1.162였다. 공격력에만 붙는 배수(치명·속도·
// 영수·심검·무공 총연마·문파)가 체력에는 하나도 안 붙기 때문이다.
// 두 곡선의 격차가 관문 400개 동안 3천만 배로 벌어져서, 관문 150을 넘으면
// 졸개 한 대에 죽었다. 관문 387에서는 한 대가 내 체력의 **1878배**였다.
// 체력 수련·호신의·심의·운기조식·마불의 체력 x2.5가 통째로 죽어 있었다.
//
// 그래서 **150관문부터는 플레이어 체력과 같은 속도(x1.14)로** 올린다.
// 150관문은 한 대가 체력의 10%쯤 되는 지점이다 — 거기서 평탄해진다.
// 150관문 전까지는 예전 곡선 그대로라 초반 체감은 안 바뀐다.
export const ATK_FLAT_AT = 150;
export const ATK_RATE_EARLY = 1.09;
export const ATK_RATE_LATE = 1.07;
const ATK_ANCHOR = cumLog(15, ATK_RATE_EARLY);
const ATK_AT_FLAT = 6 * Math.exp(cumLog(ATK_FLAT_AT, ATK_RATE_EARLY) - ATK_ANCHOR);
const ATK_LATE_ANCHOR = cumLog(ATK_FLAT_AT, ATK_RATE_LATE);
export const monsterAtk = (s) => (s <= 15 ? 6
  : s <= ATK_FLAT_AT ? 6 * Math.exp(cumLog(s, ATK_RATE_EARLY) - ATK_ANCHOR)
    : ATK_AT_FLAT * Math.exp(cumLog(s, ATK_RATE_LATE) - ATK_LATE_ANCHOR));
// 보상은 톱니로 만들지 않는다. 벽에서 보상까지 튀면 벽 앞에서 버티는 게 이득이 된다.
// 벌이가 관문당 몇 배씩 느는가. 적 체력보다 느려야 한 관문에 머무는 시간이
// 길어진다 — 이 차이가 곧 감속 장치다.
export const STAGE_GOLD_RATE = 1.06;
export const monsterGold = (s) => 5 * Math.pow(STAGE_GOLD_RATE, s - 1);
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
