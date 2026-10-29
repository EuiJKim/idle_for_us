// 게임 수치·세계관 테이블. 모든 공식은 여기에서만 정의한다. (무협 회귀 테마)

// 지금 돌고 있는 빌드. 설정 창에 적어 둔다 — 기기가 옛 판을 들고 있는지
// 한눈에 보려고 둔다. sw.js의 CACHE와 같은 값으로 맞춘다.
import { Big, big } from './big.js';
import { mx } from './fmt.js';

// ---------- 수치 눌러 담기 (2026-10-23) ----------
// 공격력이 관문 2000에서 10^56, 적 체력이 10^77이었다 — 숫자가 말이 안 되게 컸다.
// 적의 성장, 그리고 장비·보너스 합·회귀·무공 레벨·영수 레벨처럼 **쌓이며 커지는 배수**를
// 지수 1/8로 눌러 담는다(POWER_K).
//
// 수련은 다르게 다룬다. 한 칸의 값(+4%)을 눌러 담았더니 **사도 아무 일이 없었다** —
// 15분 동안 공격력이 10에서 18이 되고 두목마다 죽었다. 그래서 한 칸은 그대로 두고
// **은자가 관문마다 느는 비율을 낮춰** 덜 사게 한다(STAGE_GOLD_RATE). 한 칸이 곧 체감이다.
// 줄어든 성장 몫은 **치명 단계**(치명 → 슈퍼 → 하이퍼 …)가 곱으로 메운다.
export const POWER_K = 1 / 8;
export const kpow = (x) => (x > 0 ? Math.pow(x, POWER_K) : x);
export const kbig = (b) => {
  const v = big(b);
  if (!v.gt(0)) return v;
  const l = v.log10();
  return Number.isFinite(l) ? Big.pow10(l * POWER_K) : v;
};

// ---------- 치명 단계 ----------
// 치명 확률에 **상한이 없다.** 100%를 채우면 그다음 100%는 '슈퍼 치명' 확률이 된다.
//   치명 확률 C = 2.35 → 모든 타격이 슈퍼 치명(2단) + 35% 확률로 하이퍼 치명(3단)
// 치명은 ×D(치명 피해), 그 위로는 단계마다 **고정 배수 CRIT_STEP**을 더 곱한다:
//   치명 ×D · 슈퍼 ×D·2.5 · 하이퍼 ×D·2.5² …
// 단계마다 D를 거듭 곱하면(D, D², D³) D도 확률도 관문 따라 크니 **제곱으로** 커져서
// 적이 영영 못 따라왔다(시뮬 30분에 관문 1,300). 고정 배수면 곧게 큰다.
export const CRIT_STEP = 2.5;
export const critTierMult = (n, D) => (n <= 0 ? 1 : D * Math.pow(CRIT_STEP, n - 1));
export const CRIT_TIERS = ['', '치명', '슈퍼 치명', '하이퍼 치명', '울트라 치명', '레전드 치명', '미식 치명', '갓 치명'];
export const critTierName = (t) => (t <= 0 ? '' : CRIT_TIERS[t] || `치명 ${t}단`);
// 확률 C로 한 대를 굴린다 → 몇 단 치명인가
export const rollCritTier = (C, rng) => {
  const t = Math.floor(Math.max(0, C));
  return t + (rng() < C - t ? 1 : 0);
};
// 평균 배수 (초당 피해 어림·시험 체력에 쓴다)
export const critExpect = (C, D) => {
  const t = Math.floor(Math.max(0, C));
  const now = critTierMult(t, D);
  return now + (C - t) * (critTierMult(t + 1, D) - now);
};

// 아래 곡선 가운데 **관문·레벨을 따라 끝없이 오르는 것**은 전부 Big으로
// 돌려준다. 보통 숫자로 두면 1.8e308에서 Infinity가 되고, 거기서 빼는 순간
// NaN이 된다 — 재 보니 적 체력이 관문 8467에서 그 선을 넘었다.
// 반대로 상한이 있는 값(경지 배수·초월 단계처럼)은 보통 숫자 그대로 둔다.

export const BUILD = 'ifu-v124';

export const SAVE_VERSION = 4;
export const OFFLINE_CAP_SEC = 12 * 3600;
// ---------- 방치 ----------
//
// '방치형'인데 **자리를 비우면 관문이 안 밀렸다.** 돌아오면 은자와 경험치만
// 쥐여 주고 관문은 그대로였다. 화면이 꺼지면 아무 일도 안 일어나니,
// 켜 놓고 기다린다는 말이 성립하지 않았다.
//
// 이제 비운 시간만큼 관문을 민다. 다만 **수련 중(farming)이면 제자리**다 —
// 밀지 말고 벌라고 켜 두는 자리이므로 그 뜻을 지킨다.
//
// 미는 속도는 평타만 센다(무공·영수는 안 센다). 그래서 실제로 앉아 있을
// 때보다 느리다 — 방치가 직접 하는 것보다 나아지면 게임을 켤 이유가 없다.
// **얼마나 빨리 미는지는 추측하지 않고 잰다.**
// 처음엔 평타로 어림했는데 무공·영수를 빼먹어서 274배가 느렸다
// (어림 7690초 vs 실제 28초). 그래서 관문을 깰 때마다 실제 걸린 시간을
// 적어 두고(s.pace), 따라잡을 때 그 값을 쓴다.
// 번 속도를 재는 창. 짧으면 들쭉날쭉하고 길면 관문을 옮겨도 옛 값이 남는다.
export const EARN_WINDOW_SEC = 10;
// 재는 것. 원보는 뺀다 — 관문당 10/100씩 고정이라 시간에 비례하지 않는다.
export const EARN_KEYS = ['gold', 'exp', 'books', 'stones', 'food', 'merit'];
// 앱을 **껐던** 동안 주는 것.
//
// 한때 은자·경험치만 줬다. 그랬더니 받은 게 은자뿐이라 수련 한 축에만
// 몰아 넣게 되고, 재 보니 **앱을 끈 쪽이 2만 배 더 세졌다.** 켜 둘 이유가
// 없어진다. 기준이 갈리면 반드시 한쪽이 이득이 된다.
//
// 그래서 받는 것은 양쪽이 같다. 켜 둔 것과 끈 것의 차이는 **관문을 미느냐
// 마느냐 하나**로 남긴다. 나중에 값을 맞출 때 여기를 줄이면 된다.
export const OFFLINE_KEYS = EARN_KEYS;
export const EARN_EMA = 0.25;

export const PACE_EMA = 0.25;           // 새로 잰 값을 이만큼 섞는다
export const PACE_MAX_SEC = 3600;       // 한 관문에 한 시간을 넘게 잡지는 않는다
// 서 있는 동안에도 적은 세진다. 따라잡을수록 한 관문이 이만큼씩 길어진다.
export const OFFLINE_PACE_DRIFT = 1.02;
export const OFFLINE_STAGE_MAX = 400;   // 한 번에 이보다 많이는 안 민다
// '몇 대 버티나'로 막는 빗장은 **뺐다.** 느려지는 건 OFFLINE_PACE_DRIFT가
// 이미 셈하는데 거기에 또 걸었더니, 몇 시간을 비워도 스물세 관문에서 딱
// 멈췄다 — 같은 자리에서 실제로 앉아 있으면 시간당 예순 관문을 민다.
// 막힌 사람은 잰 pace 자체가 크므로 저절로 조금만 민다.
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
  // 물결 몫. 한 관문의 물결을 다 합치면 stageXxx(stage) 한 번치가 되게 나눈다 —
  // 물결 수는 관문마다 다르므로(waveCount) 그때그때 총합으로 나눈다.
  const sum = total + 0.45 * (total * (total - 1)) / 2 + 0.8;
  const share = k / Math.max(1, sum);
  return {
    gold: monsterGold(stage) * 4 * k,
    stones: Math.max(1, Math.round(stageStones(stage) * share)),
    books: Math.max(1, Math.round(stageBooks(stage) * share)),
    food: Math.max(1, Math.round(stageFood(stage) * share)),
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
  relicShards: Math.ceil(stageShards(bestStage) * 10),
  books: Math.ceil(stageBooks(bestStage) * 6),
});
export const huntReward = (bestStage) => ({
  gold: monsterGold(bestStage) * 900,
  stones: Math.ceil(stageStones(bestStage) * 8),
  accBox: 1,
});

export const RAID_TIME = 30;
export const RAID_TICKETS = 3;
export const RAID_HP_SECONDS = 60; // 토벌 두목 HP = 문파원 DPS 합 × 이 값
export const MERGE_COUNT = 4;
export const GACHA_COST = 100;
export const GACHA10_COST = 900;
// 한 번에 많이 뽑을수록 싸다. 열 번이 10% 싼 것과 같은 결로 백 번은 20% 싸다.
// 값을 두 군데(게임 쪽·화면 쪽)에 따로 적어 두면 반드시 어긋난다 — 여기 하나만 본다.
export const GACHA100_COST = 8000;
export const GACHA_BULK = [1, 10, 100];
export const gachaCost = (n) => (n === 100 ? GACHA100_COST : n === 10 ? GACHA10_COST : GACHA_COST * n);
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
export const UP_VALUE_RATE = 1.0408;
export const UP_COST_RATE = 1.057;
// 내공만 증가율이 따로다.
//
// 넷(적 체력·적 공격·내 DPS·내 체력)이 같은 속도로 자라야 하는데, 재 보니
// 내 DPS는 관문당 x1.0816인데 **내 체력만 x1.0677**이었다. 치명·연격은 차수가
// 오를수록 곱해지는데 체력은 더하기뿐이라 혼자 뒤처진 것이다.
// 그 결과 관문 898에서 초당 받는 피해가 체력의 0.0008%(안 죽음), 관문 1033에서
// 311%(즉사)로 **절벽**이 생겼다. 체력 쪽 증가율을 올려 보폭을 맞춘다.
export const UP_HP_VALUE_RATE = 1.0408;

// ---------- 수련 차수 ----------
//
// 전에는 치명 확률이 50레벨, 공격 속도가 100레벨에서 **끝났다.** 다 찍으면
// 그 축은 그걸로 죽은 축이 됐고, 실측에서도 2시간을 넘기면 성장이 꺾였다.
//
// 이제 축마다 **차수**가 있다. 한 차수를 다 채우면 다음 차수가 열린다 —
// 혈도 찌르기 -> 극혈도 -> 현혈도 -> 천혈도 ... 끝이 없다.
// 상한이 있는 통계(치명 확률 CRIT_CAP, 공격 속도 SPEED_CAP)는 다음 차수에서
// **상한이 없는 짝 통계로 갈아탄다.** 그래야 올려도 버려지지 않는다.
export const UP_GROUPS = [
  { id: 'atk', name: '때리는 힘' },
  { id: 'def', name: '버티는 힘' },
  { id: 'mu', name: '무공 다루기' },
  { id: 'etc', name: '벌이' },
];
// 차수 배율. 처음엔 2.4로 뒀는데 **플레이어 피해가 1e7배로 불었다** —
// 관문 898에서 치명 피해가 6450만 배, 연격이 1.5만 배가 되어 적이 때리기도
// 전에 죽었다(초당 맞는 횟수 0.0 / 패치 전 4.6). 체력 축이 통째로 죽는다.
export const UP_TIER_GAIN = 1.5;
export const UP_TIER_NAMES = ['', '극', '현', '천', '신', '무극', '혼원', '태초'];
export const upTierName = (base, t) => (t <= 0 ? base
  : t < UP_TIER_NAMES.length ? `${UP_TIER_NAMES[t]}${base}` : `${base} ${t + 1}중`);

// 가산 통계가 레벨 하나에 주는 기본값. 차수마다 여기에 UP_TIER_GAIN^t가 곱해진다.
export const UP_STAT_PER = {
  crit: 0.015,      // 치명 확률 +1.5%p (상한이 없다 — 100%마다 한 단계)
  critDmg: 0.02,    // 치명 피해 +2%p — 치명 단계마다 거듭 곱해지므로 작게(차수 덤도 없다)
  speed: 0.02,      // 공격 속도 +2%p
  gold: 0.05,       // 은자 +5%p
  guard: 0.01,      // 받는 피해 -1%p
  hpAdd: 0.03,      // 체력 +3%p
  hitMul: 0.02,     // 연격 피해 +2%p
  boss: 0.04,       // 두목 피해 +4%p
  exp: 0.03,        // 경험치 +3%p
  skillDmg: 0.03,   // 무공 피해 +3%p
  skillCd: 0.004,   // 무공 쿨 -0.4%p
  ccDur: 0.03,      // 상태이상 지속 +3%p
  bleed: 0.05,      // 출혈 피해 +5%p
  offline: 0.04,    // 방치 보상 +4%p
};
export const UP_STAT_LABEL = {
  crit: '치명 확률', critDmg: '치명 피해', speed: '공격 속도', gold: '은자',
  guard: '받는 피해 감소', hpAdd: '체력', hitMul: '연격 피해',
  boss: '두목 피해', exp: '경험치', skillDmg: '무공 피해',
  skillCd: '무공 쿨 감소', ccDur: '상태이상 지속', bleed: '출혈 피해',
  offline: '방치 보상',
};
// 차수가 올라도 한 칸의 값이 안 커지는 통계 (치명 확률 — 단계 자체가 곱이다)
export const UP_FLAT = { crit: true, critDmg: true };
const tierGain = (stat, t) => (UP_FLAT[stat] ? big(1) : Big.pow(UP_TIER_GAIN, t));
// 그 통계가 더하기로 쌓이는가(=차수 계산이 필요한가)
export const UP_IS_ADD = (stat) => stat in UP_STAT_PER;
// 받침이 있으면 '으로', 없으면 '로'. "체력로 바뀌어요"가 화면에 떴다.
export function josaRo(word) {
  const c = (word || '').charCodeAt((word || '').length - 1);
  if (Number.isNaN(c) || c < 0xac00 || c > 0xd7a3) return '로';
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';   // 받침 없음 또는 ㄹ
}

export const UPGRADES = {
  // 곱하기 축은 이미 상한이 없다. 그래서 차수가 **증가율**을 올리게 두면
  // 초지수가 되어 곡선이 통째로 터진다(레벨 600에서 1.4만 배). 대신 2차부터
  // 덤 통계를 하나 더 얹는다 — line[0]이 null이라 1차에는 아무것도 안 붙는다.
  atk: {
    name: '외공(공격력)', icon: '외공', kind: 'mul', tier: 60, group: 'atk',
    line: [null, 'critDmg'], base: {},
    value: (l) => Big.pow(UP_VALUE_RATE, l).mul(10),
    cost: (l) => Big.pow(UP_COST_RATE, l).mul(10),
    fmt: 'num',
  },
  hp: {
    name: '내공(체력)', icon: '내공', kind: 'mul', tier: 60, group: 'def',
    line: [null, 'hpAdd'], base: {},
    value: (l) => Big.pow(UP_HP_VALUE_RATE, l).mul(100),
    cost: (l) => Big.pow(UP_COST_RATE, l).mul(10),
    fmt: 'num',
  },
  crit: {
    // 1차는 치명 확률이다. CRIT_CAP(0.75)까지 가지 않고 0.30에서 한 차수가 끝난다 —
    // 나머지 45%p는 장비 옵션·장신구·유물이 채우라고 비워 둔 자리다.
    // 2차 극혈도부터는 **치명 피해**로 간다. 이게 곧 더 센 치명타다.
    // 치명 확률은 이제 상한이 없다 — 100%를 넘기면 슈퍼 치명·하이퍼 치명으로 간다.
    // 그래서 2차부터 치명 피해로 갈아타지 않고 끝까지 치명 확률이다(한 칸 +1.5%p, 차수 덤 없음).
    name: '혈도 찌르기(치명)', icon: '혈도', kind: 'add', tier: 50, group: 'atk',
    line: ['crit'], base: { crit: 0.05 },
    cost: (l) => Big.pow(1.13, l).mul(40),
    fmt: 'pct',
  },
  critDmg: {
    name: '파괴력(치명 피해)', icon: '파괴', kind: 'add', tier: 50, group: 'atk',
    line: ['critDmg'], base: { critDmg: 1.5 },
    cost: (l) => Big.pow(1.12, l).mul(30),
    fmt: 'pct',
  },
  speed: {
    // 1차는 공격 속도. SPEED_CAP(x3)에 닿는 100레벨이 한 차수다.
    // 2차 극쾌검부터는 **연격** — 평타 한 대가 더 세게 들어간다. 상한이 없다.
    name: '쾌검(공격 속도)', icon: '쾌검', kind: 'add', tier: 100, group: 'atk',
    line: ['speed', 'hitMul'], base: { speed: 1 },
    cost: (l) => Big.pow(1.11, l).mul(40),
    fmt: 'x',
  },
  gold: {
    name: '상재(은자 획득)', icon: '상재', kind: 'add', tier: 50, group: 'etc',
    line: ['gold'], base: { gold: 1 },
    cost: (l) => Big.pow(1.12, l).mul(25),
    fmt: 'pct',
  },
  // ---- 아래 셋은 이번에 더한 축이다 ----
  guard: {
    // 체력을 늘리는 대신 **맞는 피해를 줄인다.** 받는 피해 감소는 80%가 한계라
    // 2차 극호신강기부터는 체력(가산)으로 간다.
    name: '호신강기(받는 피해)', icon: '호신', kind: 'add', tier: 50, group: 'def',
    line: ['guard', 'hpAdd'], base: {},
    cost: (l) => Big.pow(1.12, l).mul(50),
    fmt: 'pct',
  },
  hpAdd: {
    // 내공은 곱하기 축이고 이쪽은 더하기 축이다. 둘을 같이 올리는 게 이득이다.
    name: '역근경(체력)', icon: '역근', kind: 'add', tier: 50, group: 'def',
    line: ['hpAdd'], base: {},
    cost: (l) => Big.pow(1.115, l).mul(60),
    fmt: 'pct',
  },
  hitMul: {
    name: '연격(추가 타격)', icon: '연격', kind: 'add', tier: 50, group: 'atk',
    line: ['hitMul'], base: {},
    cost: (l) => Big.pow(1.125, l).mul(70),
    fmt: 'pct',
  },
  // ---- 여기부터는 '여러 갈래로 올릴 수 있게' 더한 축이다 ----
  // 아홉으로는 올릴 데가 금세 다 떨어졌다. 지금 stats()가 실제로 읽는
  // 통계 가운데 수련에 자리가 없던 것들을 모두 축으로 뺐다.
  // 안 읽는 통계를 축으로 만들면 올려도 아무 일이 없다(tests 10절이 본다).
  boss: {
    name: '투지결(두목 피해)', icon: '투지', kind: 'add', tier: 50, group: 'atk',
    line: ['boss'], base: {},
    cost: (l) => Big.pow(1.125, l).mul(55),
    fmt: 'pct',
  },
  skillDmg: {
    name: '심법(무공 피해)', icon: '심법', kind: 'add', tier: 50, group: 'mu',
    line: ['skillDmg'], base: {},
    cost: (l) => Big.pow(1.12, l).mul(65),
    fmt: 'pct',
  },
  skillCd: {
    // 쿨은 아무리 깎아도 본래의 30% 아래로는 안 내려간다. 거기 닿으면
    // 올린 은자가 그냥 버려지므로 2차부터는 무공 피해로 간다.
    name: '토납(무공 쿨)', icon: '토납', kind: 'add', tier: 50, group: 'mu',
    line: ['skillCd', 'skillDmg'], base: {},
    cost: (l) => Big.pow(1.13, l).mul(75),
    fmt: 'pct',
  },
  ccDur: {
    name: '미혹결(상태이상)', icon: '미혹', kind: 'add', tier: 50, group: 'mu',
    line: ['ccDur'], base: {},
    cost: (l) => Big.pow(1.115, l).mul(45),
    fmt: 'pct',
  },
  bleed: {
    name: '혈조(출혈 피해)', icon: '혈조', kind: 'add', tier: 50, group: 'mu',
    line: ['bleed'], base: {},
    cost: (l) => Big.pow(1.118, l).mul(50),
    fmt: 'pct',
  },
  exp: {
    name: '오성결(경험치)', icon: '오성', kind: 'add', tier: 50, group: 'etc',
    line: ['exp'], base: {},
    cost: (l) => Big.pow(1.122, l).mul(40),
    fmt: 'pct',
  },
  offline: {
    name: '좌망(방치 보상)', icon: '좌망', kind: 'add', tier: 50, group: 'etc',
    line: ['offline'], base: {},
    cost: (l) => Big.pow(1.115, l).mul(60),
    fmt: 'pct',
  },
};

// ---------- 수련 단계 (2026-10-23) ----------
// 은자가 넘쳐서 수련을 그냥 다 찍어 버렸다 — 6분에 관문 180, 20분에 830이었다.
// 이제 **이번 생(회귀 뒤)에 넘은 관문**만큼만 수련할 수 있다. 50관문마다 한 단계가
// 열리고, 한 단계는 축마다 한 차수(외공 60 · 쾌검 100 · 나머지 50레벨)다.
// 다 채우면 관문을 더 밀어야 다음 단계(극외공 · 현외공 …)가 열린다.
// 재 보니 외공은 관문 45개에 한 차수씩 오르고 있었다 — 50이면 조금 붙잡힌다.
export const UP_STAGE_EVERY = 50;
// 열린 단계 수 (1부터). maxStage는 회귀하면 1로 돌아간다.
export const upStagesOpen = (maxStage) => 1 + Math.floor(Math.max(0, (maxStage || 1) - 1) / UP_STAGE_EVERY);
// 한 단계에 오를 수 있는 레벨. 은자를 덜 벌게 된 뒤(2026-10-23) 외공은 50관문에 15레벨쯤
// 산다 — 한 단계를 차수(60레벨)로 두면 영영 안 막힌다. 차수의 1/5로 둔다.
export const upStageLv = (key) => Math.ceil(upTierLv(key) / 5);
// 이 축을 지금 몇 레벨까지 올릴 수 있나
export const upCap = (key, maxStage) => upStagesOpen(maxStage) * upStageLv(key);
// 다음 단계가 열리는 관문 (이 관문을 넘으면 열린다)
export const upNextStageAt = (maxStage) => upStagesOpen(maxStage) * UP_STAGE_EVERY;

// 지금 몇 차수인가. 레벨은 **리셋되지 않는다** — 차수는 레벨에서 읽는다.
export const upTierOf = (key, l) => Math.floor((l || 0) / (UPGRADES[key].tier || 50));
export const upTierLv = (key) => UPGRADES[key].tier || 50;
// 그 차수에서 이 축이 주는 통계
export function upStatAt(key, tier) {
  const line = UPGRADES[key].line;
  if (!line) return null;
  return line[Math.min(tier, line.length - 1)];
}
// 레벨 l까지 이 축이 쌓아 준 가산 통계. { critDmg: 3.2, crit: 0.25 } 꼴.
export function upAdds(key, l) {
  const def = UPGRADES[key];
  const out = {};
  if (!def.line) return out;
  for (const [k, v] of Object.entries(def.base || {})) out[k] = big(v);
  const step = upTierLv(key);
  // 1차가 비어 있는 축(외공·내공)은 2차를 첫 차수로 센다. 안 그러면
  // 2차가 대뜸 2.4배로 시작한다.
  const off = def.line[0] ? 0 : 1;
  let left = Math.max(0, l || 0);
  for (let tier = 0; left > 0; tier++) {
    const n = Math.min(left, step);
    const stat = upStatAt(key, tier);
    if (stat) {
      // 차수 배수는 끝없이 오른다 — Math.pow로는 1750차쯤에서 터진다.
      const add = tierGain(stat, tier - off).mul(UP_STAT_PER[stat] * n);
      out[stat] = out[stat] === undefined ? add : big(out[stat]).add(add);
    }
    left -= n;
  }
  return out;
}
// 모든 축을 합친 가산 통계
export function upTotals(upgrades) {
  const out = {};
  for (const key of Object.keys(UPGRADES)) {
    for (const [k, v] of Object.entries(upAdds(key, upgrades?.[key] || 0))) {
      out[k] = out[k] === undefined ? big(v) : out[k].add(v);
    }
  }
  // **상한이 있는 통계는 보통 숫자로 돌려준다.** 치명 확률은 0.75, 공격 속도는
  // x3, 받는 피해 감소는 80%에서 멎으므로 Big일 이유가 없고, 배수로 쓰는 쪽이
  // 훨씬 단순해진다. 나머지(치명 피해·체력 덤·두목 피해…)는 끝이 없으니 Big이다.
  for (const k of UP_SMALL_STATS) if (out[k] !== undefined) out[k] = out[k].toNumber();
  return out;
}
// 상한이 있어 보통 숫자로 둬도 되는 통계
export const UP_SMALL_STATS = ['crit', 'speed', 'guard', 'skillCd'];
// 다음 한 레벨이 주는 양 (화면에 "다음: +X" 로 적는다)
export function upNext(key, l) {
  const def = UPGRADES[key];
  if (!def.line) return null;
  const tier = upTierOf(key, l);
  const stat = upStatAt(key, tier);
  if (!stat) return null;
  const off = def.line[0] ? 0 : 1;
  const amount = tierGain(stat, tier - off).mul(UP_STAT_PER[stat]);
  return { stat, amount: UP_SMALL_STATS.includes(stat) ? amount.toNumber() : amount };
}
// 이번 차수가 끝나기까지 몇 레벨 남았나, 그리고 그 다음 차수는 뭘 주나
export function upTierInfo(key, l) {
  const step = upTierLv(key);
  const tier = upTierOf(key, l);
  const inTier = (l || 0) - tier * step;
  const nextStat = upStatAt(key, tier + 1);
  return {
    tier, step, inTier, left: step - inTier,
    name: upTierName(UPGRADES[key].name.replace(/\(.*\)$/, ''), tier),
    nextName: upTierName(UPGRADES[key].name.replace(/\(.*\)$/, ''), tier + 1),
    nextStat,
    nextAmount: nextStat
      ? (() => {
        const a = tierGain(nextStat, tier + 1 - (UPGRADES[key].line[0] ? 0 : 1)).mul(UP_STAT_PER[nextStat]);
        return UP_SMALL_STATS.includes(nextStat) ? a.toNumber() : a;
      })()
      : 0,
  };
}

// ---------- 레벨 / 스탯 포인트 ----------
// 경험치가 사실상 **성장 속도의 주 엔진**이다.
// 둘 다 1.1이면 한 관문이 언제나 정확히 1.33레벨이 된다(20처치 x 4 / 60).
// 그래서 관문 254에 레벨 293, 경지 7이 나왔다 — 세 시간 만에 생사경이다.
// 요구치를 조금 더 가파르게 두면 레벨당 관문 수가 점점 늘어난다.
export const EXP_KILL_RATE = 1.0812;
export const EXP_LEVEL_RATE = 1.1214;
export const expPerKill = (s) => Big.pow(EXP_KILL_RATE, s - 1).mul(4);
export const expToNext = (lv) => Big.pow(EXP_LEVEL_RATE, lv - 1).mul(60);
export const SP_PER_LEVEL = 2;
export const SP_RESET_GEMS = 200;
// 자동 뽑기가 원보를 바닥까지 긁으면 공격력 다시 찍기(원보 200)가 영영 막힌다.
// 그만큼은 남겨 둔다.
export const AUTO_GACHA_KEEP = SP_RESET_GEMS;
export const AUTO_GACHA_SEC = 2;

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
  // ---- 2026-10-23: 열을 더했다 ----
  { name: '탈태환골', level: 500, stage: 500, look: { robe: '#7f1d1d', trim: '#fde68a', sash: '#fbbf24', band: '#fbbf24', aura: '#f87171', swords: 4, halo: true } },
  { name: '반박귀진', level: 610, stage: 610, look: { robe: '#f1e8d6', trim: '#78716c', sash: '#57534e', band: '#57534e', aura: '#e7e5e4', swords: 4, halo: true, hair: '#d6d3d1' } },
  { name: '등봉조극', level: 730, stage: 730, look: { robe: '#1e3a8a', trim: '#93c5fd', sash: '#bfdbfe', band: '#60a5fa', aura: '#93c5fd', swords: 5, halo: true } },
  { name: '입신', level: 860, stage: 860, look: { robe: '#fffbeb', trim: '#a855f7', sash: '#e9d5ff', band: '#c084fc', aura: '#d8b4fe', swords: 5, halo: true, hair: '#ffffff' } },
  { name: '신화경', level: 1000, stage: 1000, look: { robe: '#0b0b0d', trim: '#fde68a', sash: '#f59e0b', band: '#fde68a', aura: '#fde68a', swords: 6, halo: true } },
  { name: '조화경', level: 1150, stage: 1150, look: { robe: '#134e4a', trim: '#fde68a', sash: '#99f6e4', band: '#fde68a', aura: '#99f6e4', swords: 6, halo: true, hair: '#ffffff' } },
  { name: '현천', level: 1310, stage: 1310, look: { robe: '#4c1d5f', trim: '#fde68a', sash: '#f0abfc', band: '#fde68a', aura: '#f0abfc', swords: 7, halo: true } },
  { name: '무극', level: 1480, stage: 1480, look: { robe: '#f8f4ea', trim: '#0b0b0d', sash: '#0b0b0d', band: '#0b0b0d', aura: '#f5f5f4', swords: 7, halo: true, hair: '#0b0b0d' } },
  { name: '태허', level: 1660, stage: 1660, look: { robe: '#0c4a6e', trim: '#e0f2fe', sash: '#bae6fd', band: '#e0f2fe', aura: '#e0f2fe', swords: 8, halo: true, hair: '#ffffff' } },
  { name: '천외천', level: 1850, stage: 1850, look: { robe: '#fffbeb', trim: '#ef4444', sash: '#fde68a', band: '#ef4444', aura: '#fde68a', swords: 8, halo: true, hair: '#ffffff' } },
];
// 경지마다 공격력·체력 ×RANK_MULT. 경지가 스물로 늘고 수치를 눌러 담으면서 1.5 → 1.2.
export const RANK_MULT = 1.2;

// 경지 안의 **소단계**. 큰 경지 열 개는 그대로 두고(이름·도포·심마),
// 그 안을 마흔으로 쪼갠다 — 10 x 40 = 400단계.
//
// 왜 쪼개나: 큰 경지는 한참 만에 한 번 오른다. 그 사이에는 레벨을 올려도
// 아무 일도 안 일어난다. 자주 오르는 맛이 없다.
// 왜 심마는 그대로 두나: 400번 싸우게 할 수는 없다. 소단계는 레벨만 차면
// 바로 오르고, **큰 경지를 넘을 때만** 심마와 겨룬다.
export const RANK_SUBS = 40;
// 소단계 하나가 요구하는 레벨. 이 경지와 다음 경지 사이를 마흔으로 나눈다.
export const rankSubLevel = (r, sub) => {
  const a = RANKS[r]?.level ?? 1;
  const b = RANKS[r + 1]?.level ?? (a + Math.max(50, a * 0.3));
  return Math.round(a + ((b - a) * sub) / RANK_SUBS);
};
// 경지 + 소단계가 주는 배율. 소단계 마흔을 다 채우면 다음 경지와 같아진다.
export const rankPower = (r, sub = 0) =>
  Math.pow(RANK_MULT, (r || 0) + Math.min(RANK_SUBS, sub || 0) / RANK_SUBS);
// 화면에 쓰는 이름 — '현경 23단'
export const rankName = (r, sub = 0) =>
  `${RANKS[r]?.name ?? ''}${sub ? ` ${sub}단` : ''}`;
export const TRIAL_TIME = 40;
export const trialBoss = (r) => ({
  hp: monsterHp(RANKS[r].stage).mul(BOSS_HP_MULT * 2),
  atk: monsterAtk(RANKS[r].stage).mul(BOSS_ATK_MULT),
});

// ---------- 회귀 ----------
export const REGRESS_MIN_STAGE = 80;
// **배수가 더하기면 후반에 회귀가 손해다.**
// 1 + 0.16 x pt 였다. 관문 600에서 x18.6, 900에서 x28.2 — 재서 돌아오는 데
// 드는 힘은 관문당 1.085배씩 느는데 돌려받는 건 300관문에 1.5배뿐이었다.
// 그래서 시뮬에서 여덟 시간에 회귀가 0~1번밖에 안 터졌고, 2시간을 넘기면
// 관문이 꺾였다. 회귀는 벽을 뚫는 유일한 장치인데 그게 안 돌았다.
//
// 곱하기로 바꾼다. 기억 하나가 x REGRESS_BASE다 — 쌓을수록 지수로 는다.
export const REGRESS_BASE = 1.08;
export const regressMult = (points) => Big.pow(REGRESS_BASE, points || 0);
// 옛 글(+N%)을 그대로 쓰는 자리가 있어서 남겨 둔다. 화면 문구에만 쓴다.
export const REGRESS_PER_POINT = 0.16;
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
// 회귀를 권하는 기준을 '포인트 수'가 아니라 **몇 배 세지는가**로 바꾼다.
// 포인트로 재면 관문 눈금을 바꿀 때마다 같이 틀어진다 — 실제로 한 번 틀어져
// 일주일 시뮬에서 회귀가 한 번도 안 터진 적이 있다.
export const REGRESS_WORTH_MULT = 1.7;     // 이만큼 세지면 권한다
export const REGRESS_ADVISE_POINTS = 18;   // 옛 화면 문구가 쓰는 값
// ---------- 회귀하면 관문을 건너뛴다 ----------
//
// 회귀는 관문을 1로 되돌린다. 전생 배수가 붙어 있어 금방 돌아오지만,
// **이미 깬 관문을 하나씩 다시 밟는 건 그냥 기다리는 시간**이다.
// 전생의 기억이 많을수록 한 번에 여러 관문을 건너뛴다.
//
// 기억 스무 개마다 한 관문씩 더 — 기억 100이면 다섯 관문씩 간다.
// **이미 넘어 본 곳(bestStage)까지만** 건너뛴다. 그 너머를 건너뛰면
// 안 싸우고 관문을 버는 셈이라 곡선이 통째로 깨진다.
export const REGRESS_SKIP_PER = 20;
export const REGRESS_SKIP_MAX = 25;
export const stageStep = (points) =>
  1 + Math.min(REGRESS_SKIP_MAX, Math.floor((points || 0) / REGRESS_SKIP_PER));

// 막혀 있다고 보는 시간 (초). 이만큼 최고 관문이 안 올라가면 회귀가 답이다.
export const REGRESS_STUCK_SEC = 90;

// ---------- 캐릭터 (4계열) ----------
// 처음 시작할 때 하나를 고른다. 전에는 여덟 계열이 화경(경지 6단계)에서야
// 열렸고, 그 전까지는 모두가 똑같은 무인이었다 — 고른 뒤에도 바뀌는 건
// 전용 무공 셋뿐이라 "내가 바뀌었다"는 느낌이 약했다. 여덟은 서로 겹치기도 했다.
//
// 이제 다섯이고, 처음부터 그 캐릭터의 기초 무공 여덟을 쓴다.
//
// range: 평타 사거리(화면 px). 없으면 근접(MELEE_RANGE). 환마·독마·극악소마는
//   멀리서 쏜다 — 광역·장판·연쇄도 무인 발밑이 아니라 **겨눈 적 자리**에 떨어진다.
// closeMult: 적이 근접 거리 안에 붙었을 때 평타 배수 (극악소마 — 붙어도 세다)
// 관문을 넘고 전직 시험에 붙을 때마다(1차·2차·3차) 여덟이 한꺼번에 각성한다 —
// 이름·연출이 바뀌고, 차수마다 대표 초식 하나가 완전히 다른 무공이 된다.
//
// mult(능력치 배수)와 특성은 **1차 전직부터** 붙는다. 처음부터 붙이면
// 첫 관문부터 x1.3~x1.8이 얹혀 앞쪽 균형이 통째로 바뀐다.
//
// 치명 '확률'은 쓰지 않는다. 상한(CRIT_CAP)에 쉽게 닿아서 보너스가 죽는다.
export const JOBS = [
  { id: 'sword', name: '검사', weapon: '검', look: 'sword', color: '#e5e7eb',
    tag: '한 점을 꿰뚫는다',
    desc: '관문지기에게 강하다. 벽이 진행의 병목이라 가장 무난하다.',
    tiers: ['검사', '마검', '북천검가 검호', '검마', '일화검존'],
    mult: { boss: 1.7, atk: 1.3 } },
  { id: 'fist', name: '권마', weapon: '권갑', look: 'fist', color: '#f59e0b',
    tag: '맞붙는다',
    desc: '때리는 속도가 빠르다. 평타와 무공이 같이 빨라진다.',
    tiers: ['권사', '철권', '동권문 패권', '동권문주', '불패권마'],
    mult: { speed: 1.45, atk: 1.3 } },
  { id: 'fan', name: '환마', weapon: '부채', look: 'fan', color: '#38bdf8', range: 230,
    tag: '홀린다',
    desc: '멀리서 부채 바람을 날린다. 상태이상이 오래간다 — 둔화·파쇄가 길게 걸린다.',
    tiers: ['환술사', '혈루객', '풍천교 섭혼사', '풍천교주', '섭혼마존'],
    mult: { ccDur: 1.8, critDmg: 1.45 } },
  { id: 'poison', name: '독마', weapon: '독낭', look: 'dagger', color: '#22c55e', range: 240,
    tag: '서서히 죽인다',
    desc: '멀리서 독을 던진다. 깨달음이 빠르다 — 경지에 먼저 닿는다.',
    tiers: ['독술사', '독아', '천독림 독군', '천독림주', '독왕'],
    mult: { bleed: 2.0, ccDur: 1.4, exp: 1.8 } },
  // 지풍으로 멀리서 쏘지만, 적이 붙으면 손가락으로 직접 혈을 짚어 더 아프다.
  // 사거리를 환마·독마보다 짧게 둬서 적이 금방 붙고, 붙은 뒤가 진짜다.
  { id: 'ring', name: '극악소마', weapon: '지환', look: 'claw', color: '#a855f7', range: 180, closeMult: 1.35,
    tag: '한 번에 끝낸다',
    desc: '지풍으로 멀리서 쏘고, 붙으면 혈을 짚어 더 세다. 치명 피해가 크다.',
    tiers: ['지객', '무면객', '악인곡 소마', '악인곡주', '극악소마'],
    mult: { critDmg: 1.8, atk: 1.1 } },
];
export const jobOf = (id) => JOBS.find((j) => j.id === id) || null;
// 없어진 계열(혈천도마·극악소마·취마·마불). 옛 세이브에 남아 있으면 다시 고르게 한다.
export const OLD_JOBS = ['blade', 'drunk', 'monk'];
export const heroRangeOf = (jobId) => jobOf(jobId)?.range || MELEE_RANGE;

// ---------- 전직 (1차·2차·3차) ----------
// 관문을 넘으면 시험이 열리고, 붙으면 한 차수 오른다. 차수가 오르면
// 무공 여덟이 전부 각성하고 무공 피해가 TIER_SKILL_MULT만큼 커진다.
export const TIER_AT = [0, 150, 280, 420];
export const TIER_MAX = TIER_AT.length - 1;
export const TIER_SKILL_MULT = [1, 1.4, 2, 2.8];
export const tierName = (jobId, tier) => jobOf(jobId)?.tiers?.[tier] || '';
// 관문만 보고 닿을 수 있는 차수 (옛 세이브가 처음 고를 때 이만큼 주고 시작한다)
export const tiersByStage = (best) => TIER_AT.filter((v, i) => i > 0 && (best || 0) >= v).length;
// 캐릭터를 바꾸는 값. 차수·무공 레벨은 그대로 들고 간다.
export const CLASS_CHANGE_GEMS = 3000;

// ---------- 계열 패시브 ----------
//
// 지금까지 무공은 **액티브뿐**이었다. Blade Idle은 SkillGet_Active /
// SkillGet_Passive로 갈라져 있는데(docs/BladeIdle_스킬구조.md 58행) 우리는
// 액티브만 가져왔다. 강해지는 갈래가 하나 통째로 비어 있었다.
//
// 무협이니 갈래 이름도 그쪽으로 간다:
//   내공 — 버틴다 (체력·재생·피해 감소)
//   외공 — 때린다 (공격력·치명·속도)
//   무공 — 무공을 키운다 (쿨타임·무공 피해)
//
// **계열마다 값이 다르다.** 같은 '내공'이라도 마불의 내공은 두텁고
// 일화검존의 내공은 얕다 — 고른 계열이 패시브에서도 드러나야 한다.
// 지금 들어간 계열의 패시브만 켜진다.
export const PASSIVE_KINDS = [
  { id: 'nei', name: '내공', desc: '버틴다' },
  { id: 'wai', name: '외공', desc: '때린다' },
  { id: 'mu', name: '무공', desc: '무공을 키운다' },
  { id: 'qing', name: '경공', desc: '빨라진다' },
  { id: 'yan', name: '안력', desc: '급소를 본다' },
  { id: 'xin', name: '심법', desc: '번다' },
];
// 비급으로 올린다. 무공과 같은 자원이라 '무공에 쓸까 패시브에 쓸까'가 생긴다.
export const PASSIVE_MAX = 50;
export const passiveCost = (lv) => Big.pow(1.11, lv).mul(80);
// per는 1레벨당 붙는 값. 50레벨이면 per x 50이다.
// 경공·안력·심법은 2026-10-23에 더했다 — 무공이 여덟으로 줄면서 운기조식(회복)·
// 천금수(은자)가 빠졌고, 그 자리를 패시브가 받는다.
export const PASSIVES = [
  // 검사 — 한 점을 꿰뚫는다
  { job: 'sword', kind: 'nei', name: '단전', stat: 'hp', per: 0.02 },
  { job: 'sword', kind: 'wai', name: '검심', stat: 'boss', per: 0.03 },
  { job: 'sword', kind: 'mu', name: '일점귀일', stat: 'skillDmg', per: 0.025 },
  { job: 'sword', kind: 'qing', name: '유운보', stat: 'speed', per: 0.012 },
  { job: 'sword', kind: 'yan', name: '혜안', stat: 'critDmgAdd', per: 0.04 },
  { job: 'sword', kind: 'xin', name: '청심', stat: 'gold', per: 0.03 },
  // 권마 — 맞붙는다
  { job: 'fist', kind: 'nei', name: '철피', stat: 'guard', per: 0.004 },
  { job: 'fist', kind: 'wai', name: '연환권', stat: 'speed', per: 0.02 },
  { job: 'fist', kind: 'mu', name: '육합', stat: 'skillDmg', per: 0.02 },
  { job: 'fist', kind: 'qing', name: '섬전보', stat: 'skillCd', per: 0.003 },
  { job: 'fist', kind: 'yan', name: '견식', stat: 'boss', per: 0.02 },
  { job: 'fist', kind: 'xin', name: '호흡', stat: 'hp', per: 0.02 },
  // 환마 — 홀린다
  { job: 'fan', kind: 'nei', name: '허보', stat: 'guard', per: 0.0045 },
  { job: 'fan', kind: 'wai', name: '환영보', stat: 'critDmgAdd', per: 0.05 },
  { job: 'fan', kind: 'mu', name: '미혹', stat: 'ccDur', per: 0.02 },
  { job: 'fan', kind: 'qing', name: '능공허도', stat: 'speed', per: 0.012 },
  { job: 'fan', kind: 'yan', name: '간파', stat: 'boss', per: 0.025 },
  { job: 'fan', kind: 'xin', name: '현묘', stat: 'gold', per: 0.04 },
  // 독마 — 서서히 죽인다
  { job: 'poison', kind: 'nei', name: '만독불침', stat: 'guard', per: 0.0045 },
  { job: 'poison', kind: 'wai', name: '산공', stat: 'bleed', per: 0.04 },
  { job: 'poison', kind: 'mu', name: '적공', stat: 'exp', per: 0.04 },
  { job: 'poison', kind: 'qing', name: '사행보', stat: 'skillCd', per: 0.003 },
  { job: 'poison', kind: 'yan', name: '독안', stat: 'critDmgAdd', per: 0.04 },
  { job: 'poison', kind: 'xin', name: '독경', stat: 'gold', per: 0.03 },
  // 극악소마 — 한 번에 끝낸다
  { job: 'ring', kind: 'nei', name: '혈맥', stat: 'hp', per: 0.015 },
  { job: 'ring', kind: 'wai', name: '지환', stat: 'critDmgAdd', per: 0.06 },
  { job: 'ring', kind: 'mu', name: '일격필살', stat: 'skillDmg', per: 0.03 },
  { job: 'ring', kind: 'qing', name: '탄지보', stat: 'speed', per: 0.012 },
  { job: 'ring', kind: 'yan', name: '혈안', stat: 'boss', per: 0.025 },
  { job: 'ring', kind: 'xin', name: '탐심', stat: 'gold', per: 0.03 },
];
export const passivesOf = (job) => PASSIVES.filter((p) => p.job === job);
export const passiveId = (p) => `${p.job}-${p.kind}`;
// 패시브가 미는 축을 사람 말로
export const PASSIVE_STAT_NAME = {
  hp: '체력', atk: '공격력', speed: '공격 속도', gold: '은자', exp: '경험치',
  boss: '두목 피해', bleed: '출혈 피해', ccDur: '상태이상 지속',
  critDmgAdd: '치명 피해', guard: '받는 피해 감소', skillDmg: '무공 피해',
  skillCd: '무공 쿨타임 감소',
};


// ---------- 전직 시험 ----------
// 고르면 그냥 되는 게 허전했다. 여덟 장 카드에서 하나를 누르면 끝이라
// "왜 이 계열인가"가 아니라 "고르면 된다"만 남았다. 사이에 관문 하나를 둔다.
//
// **계열마다 다른 걸 요구한다.** 시험이 곧 그 계열의 설명이 되게 한다 —
// 일화검존은 한 점을 빨리 꿰뚫고, 마불은 그냥 버틴다. 읽지 않아도 몸이 안다.
//
// 판정은 **이미 집계되고 있는 값으로만** 한다(처치 수·단일 타격·받은 피해·
// 체력 바닥·시간). 새로 세는 축을 만들면 그 축이 또 어딘가에서 죽는다.
export const JOB_TESTS = [
  { job: 'sword', name: '일점', hanja: '一點', boss: '검을 시험하는 자',
    goal: 'quick', time: 20, hpSec: 48, atkHpFrac: 0.04,
    ask: '관문지기를 20초 안에 벤다',
    why: '한 점을 꿰뚫는 자리다. 오래 걸리면 그 자리가 아니다.' },
  { job: 'ring', name: '일격', hanja: '一擊', boss: '단단한 바위',
    goal: 'burst', time: 30, need: 0.25, hpSec: 78, atkHpFrac: 0.03,
    ask: '한 번의 타격으로 적 체력의 25%를 깎는다',
    why: '한 번에 끝내는 자리다. 벨 필요도 없다 — 한 방이면 된다.' },
  { job: 'fist', name: '육합', hanja: '六合', boss: '맨손으로 맞는 자',
    goal: 'noskill', time: 30, hpSec: 16, atkHpFrac: 0.03,
    ask: '무공 없이 평타만으로 벤다',
    why: '맞붙는 자리다. 무공은 이 시험 동안 나가지 않는다.' },
  // hpSec = **지금 이 사람의 초당 피해 x 이 초**가 적 체력이다.
  // 절대 체력(monsterHp x 배수)으로 두면 사람이 세질수록 시험이 쉬워진다 —
  // 재 보니 여덟이 전부 0.4초에 끝나서, 적이 때려 보지도 못하고 죽는 바람에
  // '맞아 가며 이겨라'와 '버텨라'는 아무도 못 붙었다.
  //
  // 시험 상대의 공격은 전부 **내 최대 체력의 몇 %**로 못박는다(atkHpFrac).
  // 처음엔 아래 셋만 그랬고 나머지는 monsterAtk였다 — 3차 시험쯤엔 벽 바로 앞이라
  // 그 상대가 4초 만에 무인을 눕혀서, 20초 안에 베라는 시험이 '죽지 마라'가 됐다.
  // 버티라는 시험이 아니면 한 판 내내 맞아도 절반쯤 남게 둔다.
  // monsterAtk로 두면 세기가 사람마다 제멋대로다 — 재 보니 관문 200에서는
  // 한 대에 죽고 관문 390에서는 한 대도 안 아팠다. 같은 시험이 아니게 된다.
  { job: 'fan', name: '환영', hanja: '幻影', boss: '헛손질하는 자',
    goal: 'keephp', time: 30, need: 0.8, hpSec: 49, atkHpFrac: 0.07,
    ask: '체력 80% 위를 지킨 채로 벤다',
    why: '홀리는 자리다. 오래 끌면 손이 닿는다 — 닿기 전에 끝내라.' },
  { job: 'poison', name: '적공', hanja: '積功', boss: '쉬이 죽지 않는 것',
    goal: 'grind', time: 90, hpSec: 200, atkHpFrac: 0.012,
    ask: '90초 안에 아주 단단한 것을 눕힌다',
    why: '서서히 죽이는 자리다. 한 방은 없다.' },
];
// 시험은 **이미 넘은 관문**에서 치른다. 지금 서 있는 벽에서 보면 관문지기보다
// 센 상대가 되어 아무도 못 붙는다 — 관문 200에서 재 보니 0/8이었다.
export const JOB_TEST_BACK = 20;
export const jobTestStage = (best) => Math.max(1, (best || 1) - JOB_TEST_BACK);
export const jobTestOf = (id) => JOB_TESTS.find((t) => t.job === id) || null;


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
export const enhanceCost = (e) => Big.pow(1.06, e).mul(5 + e * 3); // 한철

// ---------- 영수 ----------
// 영수.
//
// 여덟이 전부 **같은 짓**을 했다 — 1.2초마다 지금 상대를 한 번 때린다.
// 다른 건 퍼센트뿐이라, 좋은 걸 데려가면 끝이고 고를 일이 없었다.
// 이제 **하는 일이 다르다.** act가 그걸 정한다.
//
// 보유 효과도 키웠다(+3~12% → +12~50%). 전투력이 10^20을 넘는 판에서
// +3%는 눈에 안 띈다 — 모으는 보람이 느껴져야 모은다.
export const PETS = [
  { id: 'dog', name: '백학', emoji: '🦢', grade: 0, atk: 0.3, own: ['hp', 0.12],
    act: 'heal', actVal: 0.03, actText: '때리는 대신 체력을 3% 회복해요' },
  { id: 'cat', name: '영묘', emoji: '🐈', grade: 0, atk: 0.3, own: ['gold', 0.12],
    act: 'gold', actVal: 3, actText: '때릴 때마다 은자를 3배로 더 떨궈요' },
  { id: 'fox', name: '구미호', emoji: '🦊', grade: 1, atk: 0.5, own: ['atk', 0.12],
    act: 'aoe', actVal: 170, actText: '한 마리가 아니라 주변 전부를 때려요' },
  { id: 'owl', name: '영원', emoji: '🐒', grade: 2, atk: 0.7, own: ['exp', 0.16],
    act: 'triple', actVal: 3, actText: '한 번에 세 대씩 때려요' },
  { id: 'panda', name: '식철수', emoji: '🐼', grade: 2, atk: 0.8, own: ['critDmg', 0.16],
    act: 'shield', actVal: 0.25, actText: '받는 피해를 25% 줄여요' },
  { id: 'unicorn', name: '기린', emoji: '🦌', grade: 3, atk: 1.2, own: ['boss', 0.2],
    act: 'boss', actVal: 4, actText: '관문지기에게 4배로 때려요' },
  { id: 'tiger', name: '백호', emoji: '🐯', grade: 4, atk: 2, own: ['atk', 0.3],
    act: 'crit', actVal: 1, actText: '반드시 치명타로 때려요' },
  { id: 'dragon', name: '청룡', emoji: '🐲', grade: 5, atk: 3.5, own: ['atk', 0.5],
    act: 'storm', actVal: 220, actText: '주변 전부를 반드시 치명타로 때려요' },
];
// 데려가는 칸. 하나로는 고를 일이 없다 — 둘·셋이 되어야 조합이 생긴다.
// 벽 자리에 맞춘다(관문 120·220).
export const PET_SLOTS_AT = [120, 220];
export const petSlotCount = (bestStage) => 1 + PET_SLOTS_AT.filter((v) => (bestStage || 0) >= v).length;
export const PET_EGG_COST = 150;
export const PET_GRADE_WEIGHT = [45, 30, 15, 7, 2.5, 0.5];
// 먹이 수입을 관문에 맞춰 지수로 올리고 나니, 비용이 선형이라 영수가
// 2시간에 3164레벨까지 올라 다른 축을 전부 눌렀다(실측). 비용도 지수로 둔다 —
// 초반 50레벨까지는 오히려 전보다 싸고(10x50=500 -> 184), 그 뒤로 가팔라진다.
export const petFoodCost = (lv) => Big.pow(1.06, lv).mul(10);
export const PET_DUPLICATE_FOOD = (grade) => 15 * (grade + 1);
export const PET_ATTACK_INTERVAL = 1.2;
// 레벨로 느는 몫은 눌러 담는다 (POWER_K)
export const petDamageMult = (pet, lv) => pet.atk * kpow(1 + 0.1 * (lv - 1));

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
export const engraveCost = (lv) => big(300 * lv);  // 각인에 드는 영수 먹이
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
// 소환 레벨은 GACHA_LV_MAX에서 멎는다 — 끝이 있으니 보통 숫자로 둔다.
// 세는 쪽(g.cnt)도 '뽑은 횟수'라 보통 숫자다.
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
  // 무공은 여덟 자리(역할)다. 캐릭터마다 이름·연출이 다르고(CLASS_SKILLS),
  // 여기 적힌 건 그 뼈대 — 판정 모양과 기본 배율이다. id는 옛 세이브의
  // 무공 레벨이 그대로 이어지도록 옛 공용 무공 id를 쓴다.
  // art: 아이콘 그림 [종류, 번호] (icons.js KINDS 차례)
  { id: 'slash', role: '기본기', name: '선풍검', icon: '선풍', unlock: 1, cd: 5, kind: 'dmg', motion: 'aoe', target: 'all', radius: 150,
    cc: 'bleed', ccSec: 4, art: ['skill', 0],
    mult: (l) => 4 + l * 0.6, desc: (m) => `발밑 반경 150 안의 적 전체에게 공격력의 ${mx(m, 1)}배` },
  { id: 'rage', role: '강화', name: '혈마해방', icon: '혈마', unlock: 10, cd: 18, dur: 8, kind: 'buff', buff: 'atk', art: ['skill', 1],
    mult: (l) => 1.5 + l * 0.06, desc: (m) => `8초간 공격력 ${mx(m, 2)}배` },
  { id: 'thunder', role: '광역', name: '뇌정검', icon: '뇌정', unlock: 30, cd: 11, kind: 'dmg', motion: 'aoe', target: 'all', radius: 210,
    cc: 'slow', ccSec: 5, art: ['skill', 3],
    mult: (l) => 12 + l * 1.8, desc: (m) => `발밑 반경 210 안의 적 전체에게 공격력의 ${mx(m, 1)}배` },
  { id: 'frost', role: '두목', name: '빙백신장', icon: '빙백', unlock: 50, cd: 14, kind: 'dmg', motion: 'single', stun: 3, cc: 'freeze', ccSec: 3, target: 'single', bossMult: 1.8, radius: 70,
    art: ['skill', 6],
    mult: (l) => 8 + l * 1.2, desc: (m) => `한 명에게 공격력의 ${mx(m, 1)}배 + 3초 빙결 · 두목에겐 1.8배` },
  { id: 'blink', role: '이동', name: '축지참', icon: '축지', unlock: 70, cd: 18, kind: 'dmg', motion: 'blink', bossMult: 2.2, art: ['skill', 10],
    mult: (l) => 55 + l * 8,
    desc: (m) => `가장 먼 적(두목 우선)에게 순간이동해 공격력의 ${mx(m)}배 · 두목에겐 2.2배` },
  { id: 'chain', role: '연쇄', name: '연환벽력', icon: '연환', unlock: 90, cd: 13, kind: 'dmg', motion: 'chain',
    chainRange: 190, chainFalloff: 0.88, chain: (l) => 5 + Math.floor(l / 3), cc: 'slow', ccSec: 4, art: ['skill', 8],
    mult: (l) => 18 + l * 2.4,
    desc: (m, l) => `가까운 적부터 ${5 + Math.floor(l / 3)}명에게 옮겨타며 공격력의 ${mx(m)}배 · 옮길수록 12%씩 약해져요` },
  { id: 'plum', role: '장판', name: '매화검진', icon: '매화', unlock: 110, cd: 24, kind: 'dmg', motion: 'field',
    radius: 190, fieldSec: 6, tickSec: 0.5, cc: 'weak', ccSec: 4, art: ['skill', 11],
    mult: (l) => 9 + l * 1.2,
    desc: (m) => `그 자리에 6초간 진을 남겨 0.5초마다 반경 190의 적에게 공격력의 ${mx(m, 1)}배` },
  { id: 'pierce', role: '관통', name: '일자검기', icon: '일자', unlock: 130, cd: 20, kind: 'dmg', motion: 'pierce',
    pierceLen: 520, pierceWidth: 90, cc: 'bleed', ccSec: 5, art: ['skill', 13],
    mult: (l) => 35 + l * 5,
    desc: (m) => `바라보는 방향 520 거리의 일직선상 적 전부에게 공격력의 ${mx(m)}배` },
];
export const skillOf = (id) => SKILLS.find((s) => s.id === id) || null;

// ---------- 캐릭터별 무공 ----------
// names: [기초, 1차, 2차, 3차] — 전직할 때마다 여덟 이름이 전부 바뀐다.
// forms: { 차수: 바뀌는 것 } — 그 차수부터 판정까지 다른 무공이 된다(대표 초식).
//   옛 계열 전용 무공 열둘이 여기로 왔다. 숫자는 옮기기만 했다(밸런스는 나중에).
//   fx:   연출표(skillfx.js CHOREO) 열쇠. 없으면 옛 skillEffect가 look으로 그린다.
//   look: 옛 skillEffect가 쓰던 무공 id (그림을 그대로 쓰려고)
export const CLASS_SKILLS = {
  sword: {
    slash: { names: ['삼재검', '유운검', '낙화검', '일검파천'] },
    rage: { names: ['검기', '검심통명', '심검합일', '검의통천'] },
    thunder: { names: ['뇌전검', '뇌정검강', '천뢰검우', '만검귀종'],
      forms: { 3: { motion: 'aoe', target: 'all', radius: 300, cd: 26, cc: 'weak', ccSec: 8, look: 'meteor', art: ['skill', 7],
        mult: (l) => 40 + l * 6, desc: (m) => `발밑 반경 300 안의 적 전체에게 검 비 · 공격력의 ${mx(m)}배` } } },
    frost: { names: ['일격', '혈영참', '단혼검', '천하제일검'],
      forms: { 3: { cd: 21, motion: 'blink', behind: true, target: 'single', sure: true, bossMult: 4.0, stun: 0, cc: null,
        fx: 'sword:frost', look: 'jsword3', art: ['jskill', 16],
        mult: (l) => 90 + l * 13,
        desc: (m) => `가장 먼 적(두목 우선)을 베어 공격력의 ${mx(m)}배 · 반드시 치명 · 두목에겐 4배` } } },
    blink: { names: ['축지보', '일점혈로', '혈로무흔', '섬광일점'],
      forms: { 1: { cd: 15, behind: true, bossMult: 2.6, fx: 'sword:blink', look: 'jsword', art: ['jskill', 0],
        mult: (l) => 50 + l * 7,
        desc: (m) => `가장 먼 적(두목 우선)의 등 뒤로 꿰뚫고 지나가 공격력의 ${mx(m)}배 · 두목에겐 2.6배` } } },
    chain: { names: ['연환검', '유성검', '만류검', '성하검류'] },
    plum: { names: ['매화검진', '매화난무', '이십사수매화검', '매화검해'] },
    pierce: { names: ['일자검기', '검강', '만류귀종', '일검관천'],
      forms: { 2: { cd: 17, pierceLen: 620, pierceWidth: 120, bossMult: 2.0, cc: 'bleed', ccSec: 5,
        fx: 'sword:pierce', look: 'jsword2', art: ['jskill', 8],
        mult: (l) => 44 + l * 6,
        desc: (m) => `바라보는 방향 620 거리를 꿰뚫어 공격력의 ${mx(m)}배 · 두목에겐 2배` } } },
  },
  fist: {
    slash: { names: ['정권', '붕권', '백보신권', '패왕권'],
      forms: { 1: { cd: 4, radius: 170, cc: null, look: 'jfist', art: ['jskill', 2],
        mult: (l) => 24 + l * 3.4,
        desc: (m) => `4초마다 반경 170을 내지른다 · 공격력의 ${mx(m, 1)}배` } } },
    // 권마의 강화는 공격력이 아니라 손이 빨라진다 (옛 질풍보)
    rage: { names: ['기합', '금강체', '투귀', '권마강림'],
      base: { buff: 'speed', dur: 10, cd: 22, art: ['skill', 4], look: 'gale',
        mult: (l) => 1.5 + l * 0.03, desc: (m) => `10초간 공격 속도 ${mx(m, 2)}배 (한계 돌파)` } },
    thunder: { names: ['진각', '진산권', '붕천권', '천수나한'],
      forms: { 3: { cd: 5, radius: 190, look: 'jfist3', art: ['jskill', 18],
        mult: (l) => 36 + l * 5,
        desc: (m) => `쉴 틈 없이 반경 190을 두들긴다 · 공격력의 ${mx(m)}배` } } },
    frost: { names: ['철산고', '파갑권', '쇄골권', '멸천권'] },
    blink: { names: ['돌진', '섬전보', '비호권', '신행백변'] },
    chain: { names: ['연타', '쌍룡권', '난격', '천라권우'],
      forms: { 2: { cd: 7, chainRange: 170, chainFalloff: 0.94, chain: (l) => 8 + Math.floor(l / 2), look: 'jfist2', art: ['jskill', 10],
        mult: (l) => 16 + l * 2.2,
        desc: (m, l) => `가까운 적부터 ${8 + Math.floor(l / 2)}명을 연달아 내지른다 · 공격력의 ${mx(m)}배 · 6%씩만 약해져요` } } },
    plum: { names: ['권풍', '선풍각', '패왕각', '권강진'] },
    pierce: { names: ['장풍', '벽공장', '백보신장', '천붕장'] },
  },
  fan: {
    slash: { names: ['선풍', '환영선', '미혹선', '천환선'] },
    rage: { names: ['허보', '허실보', '분신술', '천변만화'] },
    thunder: { names: ['홍선', '환영란', '몽환진', '천환만상'],
      forms: { 3: { cd: 19, radius: 300, cc: 'weak', ccSec: 16, stun: 2, look: 'jfan3', art: ['jskill', 21],
        mult: (l) => 40 + l * 5.4,
        desc: (m) => `반경 300에 환영을 흩뿌린다 · 공격력의 ${mx(m)}배 · 16초 파쇄 · 2초 묶임` } } },
    frost: { names: ['미혼향', '혼백선', '섭혼술', '탈혼대법'], base: { stun: 2, cc: 'weak', ccSec: 6,
      desc: (m) => `한 명을 홀려 공격력의 ${mx(m, 1)}배 + 2초 묶고 6초 파쇄 · 두목에겐 1.8배` } },
    blink: { names: ['환영보', '이형환위', '환영분신', '천리환형'] },
    chain: { names: ['미혹', '연환미혹', '혼란선', '만혼유희'] },
    // 환마의 장판은 차수마다 바뀐다 — 깔리는 환영에서 떠도는 바람으로
    plum: { names: ['환술진', '환영진', '미혼선풍', '환몽천지'],
      forms: {
        1: { cd: 20, radius: 210, fieldSec: 7, tickSec: 0.6, cc: 'weak', ccSec: 12, bossMult: 0.6, look: 'jfan', art: ['jskill', 5],
          mult: (l) => 5 + l * 0.7,
          desc: (m) => `반경 210에 7초짜리 환영을 깔아 0.6초마다 공격력의 ${mx(m, 1)}배` },
        2: { cd: 18, motion: 'tornado', radius: 190, fieldSec: 8, tickSec: 0.5, moveSpeed: 100, cc: 'slow', ccSec: 10, bossMult: null,
          look: 'jfan2', art: ['jskill', 13],
          mult: (l) => 8 + l * 1.1,
          desc: (m) => `홀리는 바람이 8초간 돈다 · 0.5초마다 공격력의 ${mx(m, 1)}배 · 10초 둔화` },
      } },
    pierce: { names: ['선풍인', '파공선', '단혼선', '천선일섬'] },
  },
  ring: {
    slash: { names: ['지풍', '탄지풍', '무형지풍', '천라지풍'] },
    rage: { names: ['응지', '금강지', '혈지마공', '극악지체'] },
    thunder: { names: ['산화지', '난화지', '천화지우', '만화멸천'] },
    frost: { names: ['점혈', '단지멸', '파혼지', '절혼지'],
      forms: {
        1: { cd: 10, stun: 0, cc: null, sure: true, bossMult: null, look: 'jring', art: ['jskill', 3],
          mult: (l) => 13 + l * 1.7,
          desc: (m) => `한 명에게 공격력의 ${mx(m, 1)}배 · 반드시 치명으로 들어간다` },
        2: { cd: 13, sure: true, bossMult: 3.0, look: 'jring2', art: ['jskill', 11],
          mult: (l) => 22 + l * 3,
          desc: (m) => `한 명에게 공격력의 ${mx(m, 1)}배 · 반드시 치명 · 두목에겐 3배` },
      } },
    blink: { names: ['환지보', '섬지', '귀영지', '무영지'] },
    chain: { names: ['연지', '연환지', '사혼지', '멸절지'],
      forms: { 3: { cd: 17, chainRange: 200, chainFalloff: 1, sure: true, chain: (l) => 6 + Math.floor(l / 4),
        look: 'jring3', art: ['jskill', 19],
        mult: (l) => 34 + l * 4.6,
        desc: (m, l) => `${6 + Math.floor(l / 4)}명에게 옮겨타며 공격력의 ${mx(m)}배 · 반드시 치명 · 약해지지 않아요` } } },
    plum: { names: ['지력장', '지강진', '혈지진', '극악지옥'] },
    pierce: { names: ['일지', '일지선', '관혼지', '극악일지'] },
  },
  // 독마는 여덟 무공 전부에 연출표가 있다 (skillFx 'poison:역할') — 차수마다 독이 짙어진다
  poison: {
    slash: { names: ['독장', '부식장', '화골장', '만독장'] },
    rage: { names: ['독기', '독공', '독체', '만독불괴'] },
    thunder: { names: ['독무', '독우', '산공독', '천독만발'],
      forms: { 2: { cd: 15, radius: 240, cc: 'bleed', ccSec: 14, look: 'jpoison2', art: ['jskill', 15],
        mult: (l) => 20 + l * 2.8,
        desc: (m) => `반경 240에 독을 뿌려 공격력의 ${mx(m)}배 · 14초간 중독` } } },
    // 독침은 얼리지 않는다 — 박혀서 중독시킨다
    frost: { names: ['독침', '칠보독침', '단장독', '절명독'], base: { stun: 0, cc: 'bleed', ccSec: 8,
      desc: (m) => `한 명에게 독침 · 공격력의 ${mx(m, 1)}배 + 8초 중독 · 두목에겐 1.8배` } },
    blink: { names: ['사행보', '독영보', '귀영독보', '독룡잠행'] },
    chain: { names: ['독사', '연환독사', '백사독류', '만사독림'] },
    plum: { names: ['독무진', '만독강림', '독림', '천독무'],
      forms: {
        1: { cd: 26, radius: 210, fieldSec: 8, tickSec: 0.5, cc: 'weak', ccSec: 6, look: 'jpoison', art: ['jskill', 7],
          boon: { stat: 'exp', dur: 12, mult: (l) => 2 + l * 0.09 },
          mult: (l) => 6 + l * 0.9,
          desc: (m, l) => `반경 210에 8초간 독무를 깔아 0.5초마다 공격력의 ${mx(m, 1)}배 · 그동안 경험치 ${(2 + l * 0.09).toFixed(1)}배` },
        3: { cd: 25, motion: 'tornado', radius: 220, fieldSec: 10, tickSec: 0.4, moveSpeed: 95, cc: 'bleed', ccSec: 12,
          look: 'jpoison3', art: ['jskill', 23],
          boon: { stat: 'exp', dur: 15, mult: (l) => 2.6 + l * 0.12 },
          mult: (l) => 11 + l * 1.5,
          desc: (m, l) => `독무가 10초간 들판을 돈다 · 0.4초마다 공격력의 ${mx(m, 1)}배 · 그동안 경험치 ${(2.6 + l * 0.12).toFixed(1)}배` },
      } },
    pierce: { names: ['독시', '독전', '부골독전', '천독관'] },
  },
};

// 무공 여덟 전부에 연출표가 있는 계열 (skillfx.js CHOREO['계열:역할'])
// 계열 전체 연출(역할마다 연출표가 있다). 전에는 독마뿐이라 나머지 넷은 각성한 형태 몇만 연출이 붙고
// 기초 무공은 그림 한 장이 떴다 — skillfx_class.js에 넷 몫을 마저 짰다.
export const FX_ALL = ['poison', 'sword', 'fist', 'fan', 'ring'];

// 이 캐릭터·이 차수에서 무공 하나가 실제로 어떻게 생겼나.
// 화면·판정이 전부 이걸 본다. (id, 계열, 차수)마다 한 번만 만든다.
const skillCache = new Map();
export function skillFor(id, job = null, tier = 0) {
  const key = `${id}|${job || ''}|${tier}`;
  const hit = skillCache.get(key);
  if (hit) return hit;
  const base = skillOf(id);
  if (!base) return null;
  const cs = job ? CLASS_SKILLS[job]?.[id] : null;
  const def = { ...base, ...(cs?.base || {}), tier, jobId: job || null, formTier: 0 };
  for (let t = 1; t <= tier; t++) {
    const f = cs?.forms?.[t];
    if (f) Object.assign(def, f, { formTier: t });
  }
  // 연출표 열쇠: 형태가 적은 것 → 계열 전체 연출(FX_ALL) → 없음.
  // 앞 차수 형태의 열쇠가 다음 형태에 남지 않게 형태 것만 본다.
  def.fx = (def.formTier ? cs.forms[def.formTier].fx : null) || (FX_ALL.includes(job) ? `${job}:${id}` : null);
  if (cs?.names?.[tier]) {
    def.name = cs.names[tier];
    def.icon = def.name.slice(0, 2);
  }
  // 차수가 오르면 무공 피해가 커진다. 강화(buff)는 배수 자체가 효과라 건드리지 않는다.
  if (def.kind === 'dmg' && TIER_SKILL_MULT[tier] !== 1) {
    const m0 = def.mult;
    const k = TIER_SKILL_MULT[tier];
    def.mult = (l) => m0(l) * k;
  }
  skillCache.set(key, def);
  return def;
}

// ---------- 무공 연계 ----------
//
// 무공이 서른여덟 개가 됐는데 고르는 기준은 여전히 "센 것 여덟 개"뿐이었다.
// 칸이 여덟인데 고민이 없으면 칸이 여덟일 이유도 없다.
//
// 그래서 무공마다 **남기는 기운**과 **먹는 기운**을 둔다.
// 앞선 무공이 남긴 기운을 다음 무공이 먹으면 연계가 터진다 —
// 피해가 커지고 상태이상이 길어진다. 연달아 이으면 더 커진다.
//
// 이러면 '센 것 여덟'이 아니라 '이어지는 여덟'을 고르게 된다.
export const QI = {
  blade: { name: '인', hanja: '刃', col: '226,232,240' },   // 베는 기운
  bolt: { name: '뇌', hanja: '雷', col: '254,240,138' },    // 뇌전
  frost: { name: '한', hanja: '寒', col: '186,230,253' },   // 한기
  wind: { name: '풍', hanja: '風', col: '167,243,208' },    // 바람
  venom: { name: '독', hanja: '毒', col: '134,239,172' },   // 독
  inner: { name: '기', hanja: '氣', col: '252,211,77' },    // 내공
};
export const QI_KEYS = Object.keys(QI);
export const COMBO_SEC = 3;        // 남긴 기운이 머무는 시간
export const COMBO_MULT = 1.9;     // 연계가 터지면 피해 배수
export const COMBO_CC = 1.6;       // 상태이상도 이만큼 길어진다
export const COMBO_STREAK_ADD = 0.35;  // 연달아 이으면 한 번마다 더 붙는다
export const COMBO_STREAK_MAX = 6;
export const comboMult = (streak) =>
  COMBO_MULT + COMBO_STREAK_ADD * Math.min(COMBO_STREAK_MAX - 1, Math.max(0, streak - 1));

// 무공마다 남기는 기운 / 먹는 기운. 생김새를 보고 정했다 —
// 뇌정검은 뇌를 남기고, 빙백신장은 한을 남긴다.
// **고리가 막히면 안 된다.** 여섯 기운이 모두 남겨지고 모두 먹혀야 한다
// (tests/check.mjs 29절이 본다).
export const SKILL_QI = {
  slash: { leaves: 'blade', feeds: 'wind' },
  rage: { leaves: 'inner', feeds: 'blade' },
  thunder: { leaves: 'bolt', feeds: 'inner' },
  frost: { leaves: 'frost', feeds: 'bolt' },
  blink: { leaves: 'wind', feeds: 'blade' },
  chain: { leaves: 'bolt', feeds: 'frost' },
  // 독 기운은 무공이 여덟으로 줄면서 남기는 쪽·먹는 쪽이 다 빠졌다 — 장판·관통이 받는다
  plum: { leaves: 'venom', feeds: 'frost' },
  pierce: { leaves: 'blade', feeds: 'venom' },
};
export const qiOf = (id) => SKILL_QI[id] || null;

// ---------- 무공 차수 ----------
//
// 수련과 같은 수법이다. 무공도 레벨만 오르면 이름이 그대로라 "올리고 있다"는
// 느낌이 안 났다. 한 차수를 채우면 이름이 바뀌고 배율이 한 번 더 곱해진다 —
// 선풍검 -> 극선풍검 -> 현선풍검 -> ... 끝이 없다.
//
// 배율은 일부러 작게 잡았다. 무공 레벨은 관문의 0.18배쯤이라 차수가
// 관문당 0.0036개씩 오른다 — x1.8이어도 관문당 x1.002밖에 안 된다.
// 네 곡선(적 체력·적 공격·내 DPS·내 체력)을 흔들지 않는 크기다.
export const SKILL_TIER_LV = 50;
export const SKILL_TIER_GAIN = 1.8;
export const skillTierOf = (l) => Math.floor((l || 0) / SKILL_TIER_LV);
export const skillTierMult = (l) => Math.pow(SKILL_TIER_GAIN, skillTierOf(l));
export const skillTierName = (sk, l) => upTierName(sk.name, skillTierOf(l));
export function skillTierInfo(sk, l) {
  const tier = skillTierOf(l);
  const inTier = (l || 0) - tier * SKILL_TIER_LV;
  return {
    tier, inTier, step: SKILL_TIER_LV, left: SKILL_TIER_LV - inTier,
    name: upTierName(sk.name, tier),
    nextName: upTierName(sk.name, tier + 1),
    mult: Math.pow(SKILL_TIER_GAIN, tier),
    nextMult: Math.pow(SKILL_TIER_GAIN, tier + 1),
  };
}

// ---------- 문파 특성 ----------
//
// 전직을 해도 바뀌는 게 **전용 무공 하나와 배수 몇 개**뿐이었다. 들판에서
// 보이는 그림은 똑같았고, 쓰던 무공 여덟 개도 똑같이 생겼다.
// 이제 전직하면 **쓰는 모든 무공에** 그 문파의 기운이 실린다 —
// 효과도 붙고 빛깔도 그 문파 색으로 바뀐다.
//
// cc: 모든 무공이 이 상태이상을 같이 건다 (무공 본래 것에 더해서)
// 나머지는 무공을 쓸 때마다 붙는 덤이다.
export const JOB_TRAITS = {
  sword: {
    name: '검의', hanja: '劍意', col: '229,231,235', fx: 'pierce',
    text: '모든 무공이 관문지기에게 더 아프게 들어가요',
    bossBonus: 0.45,
  },
  fist: {
    name: '강기', hanja: '罡氣', col: '245,158,11', fx: 'burst',
    text: '무공을 쓸 때마다 다른 무공의 쿨이 조금 줄어요',
    cdCut: 0.7,
  },
  ring: {
    name: '지력', hanja: '指力', col: '168,85,247', fx: 'burst',
    text: '모든 무공이 치명으로 들어갈 수 있어요',
    critChance: 0.35,
  },
  fan: {
    name: '환기', hanja: '幻氣', col: '56,189,248', fx: 'field',
    text: '모든 무공이 파쇄를 걸어요 (맞는 피해가 커져요)',
    cc: 'weak', ccSec: 6,
  },
  poison: {
    name: '독기', hanja: '毒氣', col: '34,197,94', fx: 'field',
    text: '모든 무공이 중독을 걸어요 (시간이 갈수록 아파요)',
    cc: 'bleed', ccSec: 9, bleedMult: 1.6,
  },
};
export const jobTraitOf = (id) => JOB_TRAITS[id] || null;

// ---------- 특성 단련 / 문파 교체 ----------
//
// 전직하면 특성이 붙기는 하는데 **값이 고정**이라, 전직한 날 이후로는
// 문파가 성장의 축이 아니었다. 그리고 바꾸는 데 아무것도 안 들어서
// 상황마다 갈아타는 게 늘 이득이었다 — 고르는 게 고르는 일이 아니었다.
//
// 둘 다 '공적'으로 푼다. 관문지기를 넘으면 쌓이고, 쓰는 곳은 이 둘뿐이다.
// **특성 레벨은 문파마다 따로 쌓인다.** 그래서 갈아타는 진짜 값은 은자가
// 아니라 '그 문파에 들인 공적을 두고 간다'는 것이다.
export const MERIT_RATE = 1.034;                // 관문당 느는 비율
export const stageMerit = (s) => Big.pow(MERIT_RATE, Math.max(0, s - 1)).mul(0.8);
export const bossMerit = (s) => Math.ceil(stageMerit(s) * (s % 10 === 0 ? 3 : 1));
// 특성 한 단계에 드는 공적. 끝이 없다.
export const traitCost = (lv) => Big.pow(1.13, lv || 0).mul(30);
// 특성이 레벨당 얼마나 세지나 — 1레벨마다 처음 값의 이만큼이 더 붙는다.
export const TRAIT_PER_LV = 0.22;
export const traitScale = (lv) => 1 + TRAIT_PER_LV * (lv || 0);
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
export const SKILL_SLOTS = 8;          // 끝까지 열었을 때
export const SKILL_SLOT_BASE = 4;      // 처음 열려 있는 칸
// 다섯째~여덟째 칸이 열리는 관문 (전부 벽 자리에 맞춘다)
export const SKILL_SLOT_AT = [180, 260, 340, 420];
export const skillSlotCount = (bestStage) =>
  SKILL_SLOT_BASE + SKILL_SLOT_AT.filter((v) => bestStage >= v).length;
export const nextSkillSlotAt = (bestStage) => SKILL_SLOT_AT.find((v) => bestStage < v) ?? null;
export const skillBookCost = (l) => Big.pow(1.15, l - 1).mul(2);

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
    // 전에는 단계(lv)에 선형이라 관문이 오를수록 먼지가 됐다.
    // 그 비경의 환산 관문(eq)을 기준으로 관문치를 준다.
    case 'stone': return { stones: r(stageStones(eq) * 9) };
    case 'pet': return { food: r(stageFood(eq) * 11) };
    case 'relic': return { relicShards: r(stageShards(eq) * 8) };
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
  // ---- 여기부터 더한 여덟 자리 ----
  // 앞말과 빛깔만 돌리는 걸로는 바닥 그림 여덟 장이 계속 반복되는 게 보인다.
  // 자리를 열여섯으로 늘려 한 바퀴를 160관문으로 넓힌다.
  // 바닥 그림(art/zone/zone-N.jpg)도 자리마다 한 장씩 있어야 한다.
  { name: '장강 수로', ink: ['#cfd8dc', '#8aa2ad', '#44555e', '#2c3a42'], sun: '#0e7490', prop: 'dock',
    mobs: [
      F('수적', { robe: '#1e3a5f', head: 'band', band: '#0c4a6e', weapon: 'saber' }),
      F('뱃사공', { robe: '#64748b', head: 'hat', weapon: 'spear' }),
      F('물귀신', { robe: '#134e4a', head: 'hood', skin: '#9fb8b0', weapon: 'claw', ghost: true }),
      F('장강 호위', { robe: '#334155', trim: '#38bdf8', head: 'band', band: '#0284c7', weapon: 'sword' }),
    ],
    boss: F('십팔채주', { robe: '#082f49', trim: '#38bdf8', head: 'band', band: '#0ea5e9', weapon: 'axe', beard: true, aura: '#0ea5e9', scale: 1.45 }) },
  { name: '소림 사원', ink: ['#f4ead7', '#ddc9a3', '#8a7355', '#6b573e'], sun: '#b45309', prop: 'temple',
    mobs: [
      F('소림 무승', { robe: '#d97706', head: 'bald', weapon: 'fist' }),
      F('봉술 제자', { robe: '#b45309', head: 'bald', weapon: 'spear' }),
      F('나한당 승', { robe: '#92400e', trim: '#fcd34d', head: 'bald', weapon: 'fist', scale: 1.1 }),
      F('계율원 승', { robe: '#78350f', trim: '#fde68a', head: 'bald', weapon: 'sword', beard: true }),
    ],
    boss: F('달마원 수좌', { robe: '#fbbf24', trim: '#78350f', head: 'bald', weapon: 'fist', beard: true, aura: '#fcd34d', scale: 1.5 }) },
  { name: '낙양 야시장', ink: ['#4a3b2a', '#2e2419', '#1a1410', '#120d0a'], sun: '#f59e0b', prop: 'lantern', night: true,
    mobs: [
      F('저잣거리 건달', { robe: '#57534e', head: 'band', band: '#a16207', weapon: 'dagger' }),
      F('암상인', { robe: '#422006', trim: '#fbbf24', head: 'hood', weapon: 'dagger' }),
      F('야행 자객', { robe: '#1c1917', head: 'mask', weapon: 'sword' }),
      F('취객 무인', { robe: '#713f12', head: 'topknot', weapon: 'saber', beard: true }),
    ],
    boss: F('낙양 흑도주', { robe: '#1c1917', trim: '#f59e0b', head: 'band', band: '#f59e0b', weapon: 'saber', beard: true, aura: '#fbbf24', scale: 1.45 }) },
  { name: '화산 절벽', ink: ['#e7e5e4', '#b8b3ad', '#6b6761', '#4a4743'], sun: '#be123c', prop: 'cliff',
    mobs: [
      F('화산 제자', { robe: '#e11d48', trim: '#fecdd3', head: 'topknot', weapon: 'sword' }),
      F('매화 검수', { robe: '#fda4af', trim: '#9f1239', head: 'topknot', weapon: 'sword' }),
      F('절벽 산적', { robe: '#57534e', head: 'hat', weapon: 'axe' }),
      F('화산 장로', { robe: '#9f1239', trim: '#fecdd3', head: 'topknot', hair: '#e5e7eb', weapon: 'sword', beard: true }),
    ],
    boss: F('매화검존', { robe: '#fff1f2', trim: '#e11d48', head: 'topknot', hair: '#f1f5f9', weapon: 'sword', aura: '#fb7185', beard: true, scale: 1.45 }) },
  { name: '남만 독림', ink: ['#cfe3c0', '#8aa86f', '#3f5a33', '#2b3d23'], sun: '#65a30d', prop: 'vine',
    mobs: [
      F('남만 전사', { robe: '#4d7c0f', head: 'band', band: '#365314', weapon: 'spear' }),
      F('독충 술사', { robe: '#365314', trim: '#a3e635', head: 'hood', weapon: 'fan' }),
      F('만독 교도', { robe: '#166534', head: 'mask', weapon: 'claw', eyes: '#86efac' }),
      F('밀림 사냥꾼', { robe: '#3f6212', head: 'hat', weapon: 'dagger' }),
    ],
    boss: F('오독교주', { robe: '#14532d', trim: '#4ade80', head: 'topknot', weapon: 'claw', aura: '#4ade80', eyes: '#86efac', beard: true, scale: 1.5 }) },
  { name: '고묘 지하', ink: ['#6b7280', '#3f4654', '#23272f', '#15181d'], sun: '#a3e635', prop: 'tomb', night: true,
    mobs: [
      F('고묘 수호귀', { robe: '#1f2937', trim: '#84cc16', head: 'mask', weapon: 'spear' }),
      F('도굴꾼', { robe: '#44403c', head: 'hood', weapon: 'dagger' }),
      F('석상 무사', { robe: '#57534e', trim: '#a8a29e', head: 'bald', skin: '#9ca3af', weapon: 'axe', scale: 1.2 }),
      F('고묘 검귀', { robe: '#312e81', head: 'topknot', hair: '#111', weapon: 'sword', ghost: true }),
    ],
    boss: F('고묘주', { robe: '#1e1b4b', trim: '#a3e635', head: 'topknot', hair: '#d1d5db', weapon: 'claw', aura: '#84cc16', eyes: '#bef264', scale: 1.5 }) },
  { name: '동해 해안', ink: ['#dbeafe', '#a5c4dd', '#5b7e99', '#3d5a70'], sun: '#0284c7', prop: 'shore',
    mobs: [
      F('해적 검객', { robe: '#1e40af', head: 'band', band: '#1e3a8a', weapon: 'saber' }),
      F('동해 무사', { robe: '#0c4a6e', trim: '#7dd3fc', head: 'topknot', weapon: 'spear' }),
      F('조개 갑사', { robe: '#475569', trim: '#e0f2fe', head: 'mask', weapon: 'axe', scale: 1.15 }),
      F('파도 술사', { robe: '#075985', head: 'hood', weapon: 'fan' }),
    ],
    boss: F('동해 교룡왕', { robe: '#082f49', trim: '#22d3ee', head: 'topknot', hair: '#a5f3fc', weapon: 'spear', aura: '#22d3ee', eyes: '#67e8f9', scale: 1.55 }) },
  { name: '천외천', ink: ['#eef2ff', '#c7d2fe', '#818cf8', '#4338ca'], sun: '#fde68a', prop: 'void', clouds: true,
    mobs: [
      F('천외 수문장', { robe: '#e0e7ff', trim: '#4338ca', head: 'topknot', weapon: 'spear' }),
      F('선학 검사', { robe: '#f8fafc', trim: '#6366f1', head: 'topknot', weapon: 'sword' }),
      F('허공 보살', { robe: '#c7d2fe', trim: '#fbbf24', head: 'bald', weapon: 'fist' }),
      F('천외 도인', { robe: '#a5b4fc', trim: '#fde68a', head: 'topknot', hair: '#f1f5f9', weapon: 'fan', beard: true }),
    ],
    boss: F('천외천존', { robe: '#ffffff', trim: '#fbbf24', head: 'topknot', hair: '#ffffff', weapon: 'sword', aura: '#fde68a', beard: true, scale: 1.6 }) },
];
export const RAID_BOSS = F('혈마', { robe: '#1a0505', trim: '#ef4444', head: 'topknot', hair: '#7f1d1d', weapon: 'saber', aura: '#dc2626', eyes: '#fca5a5', scale: 2.1 });

// 지역 티어 — 8지역(80관문)을 한 바퀴 돌 때마다 같은 땅이 더 험해진다.
// 근거: Blade Idle은 배경 8종을 S·T 티어로 재활용해 23개 구간을 만든다(에셋 추가 없이 볼륨 3배).
// 자리 이름 앞에 붙는 말. **다섯에서 멈춰 있었다** — 관문 321부터는 끝까지
// 전부 '무간 OO'라, 한 시간이면 1500관문을 가는 지금은 눈에 보이는 게
// 영영 안 바뀌었다. 열로 늘리고, 다 쓰면 처음부터 다시 돈다(몇 순인지 적는다).
export const ZONE_TIERS = [
  { prefix: '', sun: null, tint: null },
  { prefix: '흉지 ', sun: '#7f1d1d', tint: '#7f1d1d' },
  { prefix: '마경 ', sun: '#4c1d95', tint: '#6d28d9' },
  { prefix: '구천 ', sun: '#0c4a6e', tint: '#0369a1' },
  { prefix: '무간 ', sun: '#18181b', tint: '#27272a' },
  { prefix: '나락 ', sun: '#431407', tint: '#9a3412' },
  { prefix: '황천 ', sun: '#064e3b', tint: '#047857' },
  { prefix: '적멸 ', sun: '#4a044e', tint: '#a21caf' },
  { prefix: '혼돈 ', sun: '#422006', tint: '#a16207' },
  { prefix: '허무 ', sun: '#0c0a09', tint: '#e5e7eb' },
];
export const ZONE_CYCLE = 10 * ZONES.length; // 한 바퀴 = 80관문
// 몇 번째 앞말인가. 다 쓰면 처음으로 돌아간다 — 끝에서 멈추지 않는다.
export const zoneTierOf = (stage) => Math.floor((stage - 1) / ZONE_CYCLE) % ZONE_TIERS.length;
// 앞말을 몇 바퀴 돌았나 (0이면 첫 바퀴)
export const zoneLoopOf = (stage) => Math.floor(Math.floor((stage - 1) / ZONE_CYCLE) / ZONE_TIERS.length);

// 빛깔 섞기. 같은 적이라도 자리마다 다른 빛을 띠게 한다.
function mixHex(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const q = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${q(r1, r2)}${q(g1, g2)}${q(b1, b2)}`;
}

const _zoneCache = new Map();
export const zoneOf = (stage) => {
  const i = Math.floor((stage - 1) / 10) % ZONES.length;
  const t = zoneTierOf(stage);
  const loop = zoneLoopOf(stage);
  const key = (i * 100 + t) * 100 + Math.min(9, loop);
  let z = _zoneCache.get(key);
  if (!z) {
    const base = ZONES[i];
    const tier = ZONE_TIERS[t];
    // idx는 바닥 그림(art/zone/zone-N.png)을 찾는 데 쓴다
    if (t === 0 && loop === 0) {
      z = { ...base, idx: i };
    } else {
      // 적 옷·터럭에도 그 자리의 빛을 섞는다. 이름만 바뀌면 똑같아 보인다.
      const k = tier.tint ? 0.42 + Math.min(0.25, loop * 0.08) : 0;
      const paint = (f) => (!tier.tint ? f : {
        ...f,
        look: {
          ...f.look,
          robe: mixHex(f.look.robe || '#57534e', tier.tint, k),
          trim: f.look.trim ? mixHex(f.look.trim, tier.tint, k * 0.6) : f.look.trim,
        },
      });
      z = {
        ...base,
        idx: i,
        name: tier.prefix + base.name + (loop > 0 ? ` ${loop + 1}순` : ''),
        sun: tier.sun || base.sun,
        tier: t,
        loop,
        mobs: base.mobs.map(paint),
        boss: paint(base.boss),
      };
    }
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
// 적 체력이 관문당 몇 배씩 세지는가.
//
// **내 DPS보다 느려야 한다.** 재 보니 적 체력 x1.16 대 내 DPS x1.15로
// 적이 더 빨랐다. 관문당 0.9%씩 벌어져서 200관문이면 한 관문에 5.6배가
// 걸린다 — 뒤로 갈수록 안 넘어가고, 그게 제일 큰 스트레스였다.
//
// 이제 적을 **더 느리게** 둔다. 관문마다 조금씩 쉬워져서 가속이 붙는다.
// 숫자도 같이 작아진다: 관문 400에서 1.36e28 → 1e18 언저리.
// 관문이 빨리 넘어가는 건 괜찮다 — 관문은 얼마든지 늘리면 된다.
export const STAGE_HP_RATE = 1.13;        // 첫 관문
export const STAGE_HP_RATE_LATE = 1.085;  // 다 완만해졌을 때
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

// cumEase는 자연로그 누적이라 그 자체는 안 터진다. 터지는 건 exp()다.
// 적 체력 = 옛 곡선을 1/8로 눌러 담은 것 + 관문마다 조금씩 더 (진행 속도를 늦추는 몫).
// MON_EXTRA는 시뮬로 맞췄다(30분 관문 ~280 · 2시간 ~870 · 8시간 ~1,600). 늘리면 느려진다.
// 수련이 단계로 묶여 관문당 오르는 몫이 정해져 있다 — 적이 그보다 확실히 빨리 커야
// 벽이 생기고 회귀가 돈다. 0.0075 아래로 내리면 벽이 없어져 끝없이 달린다(시뮬 실측).
export const MON_EXTRA = 0.0085;
// 무릎 뒤로는 덤을 줄인다. 앞쪽 벽은 경지·전직처럼 끝이 있는 성장이 넘겨 주는데, 그게 다 떨어진
// 뒤에는 눌러 담은 성장(회귀·병기·영수)만 남아서 2시간 뒤로 관문이 거의 멎었다(4시간 871 → 8시간 1,000).
export const MON_EXTRA_KNEE = 800;
export const MON_EXTRA_LATE = 0.0045;
export const monExtra = (n) => (n <= 0 ? 0
  : MON_EXTRA * Math.min(n, MON_EXTRA_KNEE) + MON_EXTRA_LATE * Math.max(0, n - MON_EXTRA_KNEE));
export const monsterHp = (s) => Big.pow10(POWER_K * cumEase(s) / Math.LN10 + monExtra(s - 1)).mul(20);
// 적 공격력.
//
// **내 체력과 같은 속도로 올린다.** 그래야 비율이 평평해진다.
//
// 재 본 것(실제 세이브 셋, 각자의 제 관문에서 초당 받는 피해 / 내 체력):
//   관문 188  5.25e-3%     관문 252  9.28e-5%     관문 375  1.81e-8%
// 관문당 x0.935씩 떨어진다 — 적 공격력 x1.07 대 내 체력 x1.145의 차이다.
// 관문 375에서는 졸개 한 대가 내 체력의 **1천만분의 1**이고, 초당 2% 재생이
// 그걸 통째로 지운다. 체력 수련·호신의·심의·마불 x2.5·광고 제거 x4가
// 전부 여기서 죽어 있었다 — 안 죽는 캐릭터의 체력을 올려 봐야 소용이 없다.
//
// 내 체력이 관문당 x1.145로 자란다(85~493관문 구간 실측). 적 공격력도
// 같은 값으로 두면 **어느 관문에서든 같은 비율**로 맞는다.
// 하나의 값으로 끝까지 간다 — 구간을 나눌 이유가 없어졌다.
export const ATK_RATE = 1.11;             // 첫 관문
// 기준점. 적 체력을 낮추니 **같은 관문에 훨씬 일찍·약한 채로** 도착한다 —
// 공격력은 그대로라 관문 236에서 초당 158%를 맞고 2초에 한 번씩 쓰러졌다.
// 10분에 308번 죽고 65%를 수련 상태로 보냈다. 그게 '관문이 안 넘어간다'의 정체였다.
//
// 다시 재서 맞춘다(관문 203·236·306 실측):
//   비율이 관문당 x1.0091씩 나빠졌다 → 배율을 그만큼 늦춘다
//   203관문에서 1/10이 필요하다 → 시작을 18관문 뒤로 민다
export const ATK_BASE = 3.5;
export const ATK_FROM = 52;
// 적 체력처럼 **완만해지는 꼴**이다. 한 비율로 쭉 가면 둘 중 하나가 된다:
// 1.11로 두면 후반에 한 대가 내 체력의 3500배가 되어 손도 못 쓰고 죽고(실측),
// 1.068로 평평하게 깔면 거꾸로 5e10대를 버티는 불사신이 된다(이것도 실측).
// 초반 기울기는 그대로 두고 **뒤로 갈수록만** 완만하게 한다.
export const ATK_RATE_LATE = 1.060;
export const ATK_EASE_AT = 800;
export const atkRate = (s) => ATK_RATE
  + (ATK_RATE_LATE - ATK_RATE) * Math.min(1, Math.max(0, s - ATK_FROM) / ATK_EASE_AT);
// 관문마다 비율이 달라 닫힌 식으로 못 센다. 쌓아 두고 꺼내 쓴다(monsterHp와 같은 수법).
const _atkCum = [0];
function atkCum(s) {
  const n = Math.max(0, Math.floor(s) - ATK_FROM);
  for (let k = _atkCum.length; k <= n; k++) _atkCum[k] = _atkCum[k - 1] + Math.log(atkRate(ATK_FROM + k));
  return _atkCum[n];
}
// 적 공격의 덤은 체력의 덤과 따로 간다. 같은 0.0085로 두었더니 내 체력이 관문당 그만큼 못 따라와서
// 졸개 한 대가 내 체력의 3%(15분) → 4.8배(1시간) → 41배(3시간)가 됐다 — 한 시간 뒤로는
// 전부 한 방에 쓰러지고 체력 수련이 통째로 죽었다. 한 대가 체력의 1/10쯤 되는 관문 280
// 언저리까지만 같이 오르고, 그 뒤로는 체력이 자라는 만큼만 오른다.
export const ATK_EXTRA_KNEE = 230;
export const ATK_EXTRA_LATE = 0.004;
export const atkExtra = (n) => (n <= 0 ? 0
  : MON_EXTRA * Math.min(n, ATK_EXTRA_KNEE) + ATK_EXTRA_LATE * Math.max(0, n - ATK_EXTRA_KNEE));
export const monsterAtk = (s) => (s <= ATK_FROM
  ? big(ATK_BASE)
  : Big.pow10(POWER_K * atkCum(s) / Math.LN10 + atkExtra(s - ATK_FROM)).mul(ATK_BASE));

// 보상은 톱니로 만들지 않는다. 벽에서 보상까지 튀면 벽 앞에서 버티는 게 이득이 된다.
// 벌이가 관문당 몇 배씩 느는가. 적 체력보다 느려야 한 관문에 머무는 시간이
// 길어진다 — 이 차이가 곧 감속 장치다.
// 2026-10-23: 1.0489 → 1.017. 수치를 눌러 담으면서 은자를 덜 벌게 했다 —
// 수련 한 칸(+4%)은 그대로 두고 덜 사게 해야 한 칸이 체감된다(위 POWER_K 설명).
export const STAGE_GOLD_RATE = 1.017;
export const monsterGold = (s) => Big.pow(STAGE_GOLD_RATE, s - 1).mul(5);

// ---------- 보조 자원도 관문을 따라 지수로 늘린다 ----------
//
// 은자만 관문에 맞춰 지수로 늘고 비급·한철·먹이는 **관문에 선형**이었다.
// 쓰는 쪽은 전부 지수다(무공 1.15^lv · 제련 1.06^e). 그래서 3시간을 재 보면
// 관문은 68 -> 283으로 4.2배가 되는데 제련 합은 76 -> 130(1.7배)에 멈추고
// 비급 보유는 **내내 0**이었다. 넷이 전부 말라붙어 성장이 급격히 꺾였다.
//
// 비율은 각자 쓰는 쪽에서 거꾸로 뽑았다. 무공을 관문의 0.25배 레벨까지
// 올리려면 1.15^(0.25s) = 1.036^s 만큼 비급이 들어와야 한다. 한철·먹이도 같은 식.
export const STAGE_BOOK_RATE = 1.036;
export const STAGE_STONE_RATE = 1.042;
export const STAGE_FOOD_RATE = 1.030;
export const STAGE_SHARD_RATE = 1.012;
// 한 관문을 깨면 은자가 얼마나 들어오나. 처치 + 물결 + 관문지기를 **다 센다**.
// 처치만 세면 실제의 1/4이다 — 방치 따라잡기가 그만큼 가난해진다.
export function stageGold(s) {
  const total = waveCount(s);
  const sumK = total + 0.45 * (total * (total - 1)) / 2 + 0.8;
  return monsterGold(s).mul(KILLS_PER_STAGE + 4 * sumK + BOSS_GOLD_MULT);
}

// 한 관문을 깨는 동안 들어오는 양(물결 전부를 합친 값)
// 기본값(관문 1에서 나오는 양)은 **옛 값과 비슷해야 한다.** 처음에 12/16/14로
// 뒀더니 관문 100에서 옛 수입의 15~40배가 들어와, 초반 성장이 관문당 23%로
// 폭주했다(적 체력은 13%다). 그러면 적이 때려 보지도 못하고 죽는다.
// 기울기만 지수로 두고 시작점은 옛 값의 두 배쯤에 맞춘다.
export const stageBooks = (s) => Big.pow(STAGE_BOOK_RATE, Math.max(0, s - 1)).mul(1.5);
export const stageStones = (s) => Big.pow(STAGE_STONE_RATE, Math.max(0, s - 1)).mul(3);
export const stageFood = (s) => Big.pow(STAGE_FOOD_RATE, Math.max(0, s - 1)).mul(3);
export const stageShards = (s) => Big.pow(STAGE_SHARD_RATE, Math.max(0, s - 1)).mul(1.2);

// 고정 보상(일일 의뢰·업적·연공·토벌)은 관문이 오르면 금세 먼지가 된다.
// 그래서 **고정값이 아니라 '몇 관문치'로 적는다.** books: 5 는 비급 5관문치다.
// 원보·상자는 쓰는 곳도 고정값이라 그대로 둔다.
export function scaleReward(r, s) {
  const at = Math.max(1, s || 1);
  const out = {};
  if (r.gold) out.gold = Math.ceil(monsterGold(at) * r.gold);
  if (r.books) out.books = Math.ceil(stageBooks(at) * r.books);
  if (r.stones) out.stones = Math.ceil(stageStones(at) * r.stones);
  if (r.food) out.food = Math.ceil(stageFood(at) * r.food);
  if (r.relicShards) out.relicShards = Math.ceil(stageShards(at) * r.relicShards);
  if (r.gems) out.gems = r.gems;
  if (r.accBox) out.accBox = r.accBox;
  if (r.accPick) out.accPick = r.accPick;
  return out;
}
// ---------- 광고 / 광고 제거 ----------
//
// 지금 광고는 **흉내만** 낸다(5초 기다리는 가짜 화면). 나중에 진짜 광고망을
// 붙일 때 js/ads.js의 showAd 하나만 갈아 끼우면 되게 해 뒀다.
//
// 광고가 막는 건 **덤으로 더 주는 것**뿐이다. 원래 공짜이던 걸 광고 뒤로
// 옮기지 않는다 — 있던 걸 빼앗으면 그건 개악이다.
export const AD_SEC = 5;              // 흉내 광고를 보는 시간
export const AD_BOOST_EXTRA = 1;      // 광고로 더 받는 기연 횟수 (하루)
export const AD_OFFLINE_MULT = 2;     // 광고 보면 방치 보상 2배

// 광고를 지우면 붙는 영구 보너스.
//
// **x4는 어떤 문파 보너스보다도 크다**(가장 큰 것이 혈천도마의 공격력 x1.5).
// 즉 돈이 계열 선택을 덮는다 — 처음엔 x1.2로 뒀다가 운영자가 x4로 정했다.
// 모르고 둔 게 아니라 알고 둔 값이라는 뜻으로 적어 둔다.
export const NOADS_ATK = 4;
export const NOADS_HP = 4;
export const BOSS_HP_MULT = 7;
export const BOSS_ATK_MULT = 2.5;
// 들판 관문지기만 따로 더 세게 때린다.
//
// 관문지기 직행을 켜면 **졸개 떼를 건너뛴다.** 전에는 들판의 여든 마리가
// 초당 서너 대를 때려서 그게 위협이었는데, 직행하면 적이 하나뿐이라
// 초당 맞는 횟수가 0에 가까워진다 — 체력·호신강기·역근경이 통째로 죽는다.
// 떼를 건너뛴 만큼 관문지기가 그 몫을 져야 한다.
// (수련터·탑·심검 같은 겨루기는 그대로 둔다 — 거긴 직행이 없다)
// **그냥 30을 곱하면 첫 관문지기가 새 사람을 한 방에 죽인다**
// (적 공격 6 x 30 = 180 vs 시작 체력 100). 검사에서 바로 잡혔다.
// 떼가 줄어드는 건 뒤로 갈수록이므로 배수도 뒤로 갈수록 올린다.
export const STAGE_BOSS_ATK_MIN = 2.5;
export const STAGE_BOSS_ATK_MAX = 30;
export const STAGE_BOSS_ATK_AT = 220;   // 여기쯤에서 끝 값에 닿는다
export const stageBossAtkMult = (s) => STAGE_BOSS_ATK_MIN
  + (STAGE_BOSS_ATK_MAX - STAGE_BOSS_ATK_MIN)
    * Math.min(1, Math.max(0, (s || 1) - 1) / STAGE_BOSS_ATK_AT);
export const BOSS_GOLD_MULT = 12;
export const bossGems = (s) => (s % 10 === 0 ? 100 : 10);
// 두목은 한 관문에서 한 번뿐이라 **관문치를 통째로** 준다. 물결 보상과 합쳐
// 한 관문에서 비급 2관문치·한철 2관문치쯤이 들어온다.
export const bossRelicShards = (s) => Math.ceil(stageShards(s) * (s % 10 === 0 ? 5 : 1));
export const bossBooks = (s) => Math.ceil(stageBooks(s) * (s % 10 === 0 ? 2.5 : 1));
export const bossStones = (s) => Math.ceil(stageStones(s) * (s % 10 === 0 ? 2.5 : 1));
// 먹이는 물결에서만 나왔다. 관문지기 직행을 켜면 물결을 건너뛰므로
// 영수가 굶는다 — 관문지기도 먹이를 떨어뜨리게 한다.
export const bossFood = (s) => Math.ceil(stageFood(s) * (s % 10 === 0 ? 2.5 : 1));

// ---------- 문파 ----------
export const guildLevel = (exp) => Math.min(20, 1 + Math.floor((exp || 0) / 200));
export const guildAtkBonus = (exp) => (guildLevel(exp) - 1) * 0.05;
export const GUILD_CHECKIN_EXP = 20;
export const GUILD_DONATE_GEMS = 100;
export const GUILD_DONATE_EXP = 10;
export const GUILD_MAX = 10;

export const raidReward = (maxStage) => ({ gems: 300, gold: monsterGold(maxStage) * 150, relicShards: 20 });
