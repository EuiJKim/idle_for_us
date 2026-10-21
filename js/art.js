// 그림 조각을 쓸 수 있으면 쓰고, 없으면 지금 그대로 벡터로 그린다.
//
// 우리 뼈대(battle.js drawFighter)는 이미 머리·몸통·팔·무기를 따로 그리고
// 각자 회전시킨다. 그래서 조각 그림만 있으면 그 자리에 그대로 얹을 수 있다.
// 뼈대 치수: 발끝 y=0, 머리 꼭대기 y=-99, 몸통 폭 24, 머리 지름 22.
//
// 파일은 art/hero/ 에 둔다. **저장소에 같이 올린다** — GitHub Pages로
// 서빙하므로 커밋해야 화면에 뜬다. (한때 .gitignore에 있었는데 2026-10-20에 뺐다)
// 없으면 조용히 벡터로 간다 — 그림이 없다고 게임이 안 돌면 안 된다.
//
// **읽는 파일은 아래 FILES 열아홉 장으로 고정이다.**
// 다른 이름으로 아무리 많이 그려 넣어도 화면은 1픽셀도 안 바뀐다.
// 조각을 늘리려면 HEADS·BODIES·WEAPONS를 먼저 늘리고 그 키로 저장해야 한다.
//
// **외형 키는 이미 있는 것을 그대로 쓴다.** look.head(머리 모양) ·
// look.robe(옷 색) · look.weapon(무기 종류). 몬스터 60종이 이 셋으로
// 서로 다르게 생겼으므로, 그림도 같은 키로 갈라야 그 다양함이 유지된다.

// 머리 — look.head 값 그대로. mask·jiangshi는 그림이 마땅치 않아 벡터로 둔다.
const HEADS = ['band', 'topknot', 'hat', 'hood', 'bald'];
// 무기 — look.weapon 값 그대로. fan은 그림이 마땅치 않아 벡터로 둔다.
const WEAPONS = ['sword', 'saber', 'spear', 'axe', 'claw', 'dagger', 'fist'];
// 몸통 — 옷 색에 가장 가까운 것을 고른다
const BODIES = {
  dark: [0x3f, 0x3a, 0x36],
  white: [0xf1, 0xe8, 0xd6],
  red: [0x8b, 0x1f, 0x22],
  blue: [0x32, 0x48, 0x6b],
  brown: [0x6b, 0x56, 0x40],
  black: [0x14, 0x12, 0x10],
};

// 경지 전용 도포. 열 단계 중 초절정·화경·천인합일이 전부 흰색이라
// 옷 색으로만 고르면 셋이 똑같이 보인다. 색이 정확히 맞으면 전용 옷을 쓴다.
// (RANKS[i].look.robe 값과 같아야 한다 — data.js를 고치면 여기도 고친다)
const RANK_ROBES = {
  '#6b5640': 'body-r0', '#344563': 'body-r1', '#1f5f8b': 'body-r2',
  '#1c1917': 'body-r3', '#f5f0e6': 'body-r4', '#f8f4ea': 'body-r5',
  '#4c1d5f': 'body-r6', '#0b0b0d': 'body-r7', '#134e4a': 'body-r8',
  '#fffbeb': 'body-r9',
};

const FILES = [
  ...HEADS.map((h) => `head-${h}`), 'head',
  ...Object.keys(BODIES).map((b) => `body-${b}`),
  ...new Set(Object.values(RANK_ROBES)),
  ...WEAPONS.map((w) => `wp-${w}`),
];

// 그림을 어디에 얼마만큼 그릴지. 뼈대 좌표계 그대로다.
// w는 폭(높이는 그림 비율대로), (x, y)는 **그림의 가운데 아래**가 놓일 자리.
// 처음엔 몸통 46·검 11로 넣었는데 화면에서 재 보니 사람이 뚱뚱하고 검이 몸만 했다.
// 도포 열여섯 장이 전부 92x116으로 구워져 있다(높이를 맞춰 어깨선을 한 줄에
// 세운다). 그래서 아래 숫자 하나가 열여섯 장 전부에 같이 맞는다.
// 폭만 맞춰 굽던 때는 높이가 98~131이라 어깨가 제각각이었고, 머리를 고정
// 좌표(-72)에 두니 **20px 떠 있었다.** 그게 '몸이 깨졌다'의 정체다.
export const BODY_W = 50;                    // 그려지는 높이는 50 x 116/92 = 63
export const BODY_TOP = -4 - BODY_W * 116 / 92;   // 어깨선 (= -67)
export const FIT = {
  body: { w: BODY_W, x: 0, y: -4 },          // 아랫자락이 발목을 덮는다
  head: { w: 25, x: 1, y: BODY_TOP + 4 },    // 턱을 옷깃 안으로 4px 넣는다
  weapon: { w: 13, x: 0, y: 2 },             // 손 기준(앞팔 회전 안에서 그린다)
};
// 그림 몸통의 어깨 — 소매가 이미 그려져 있어 벡터 뼈대(-70)와 자리가 다르다
export const ART_SHOULDER = { x: 9, y: BODY_TOP + 9 };
// 머리끈 꼬리가 나오는 자리. 벡터 머리는 -90이었는데 그림 머리는 -63에서
// 시작해 21px이라 -90이면 **정수리 위 허공**에서 끈이 뻗어 나왔다.
export const ART_BAND = { x: -5, y: BODY_TOP + 4 - 14 };

const img = {};
let ready = false;
let tried = false;

export function artReady() { return ready; }

// 옷 색에 가장 가까운 몸통. 색 차이는 그냥 제곱합으로 잰다 — 여섯 중 고르는 일이라 충분하다.
const bodyCache = new Map();
function bodyFor(robe) {
  if (!robe) return 'body-dark';
  let hit = bodyCache.get(robe);
  if (hit) return hit;
  // 경지 옷이 먼저다 — 색이 정확히 같으면 그 단계 전용 도포
  const rk = RANK_ROBES[String(robe).toLowerCase()];
  if (rk) { bodyCache.set(robe, rk); return rk; }
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(robe);
  if (!m) return 'body-dark';
  const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
  let best = 'body-dark';
  let bd = Infinity;
  for (const [k, v] of Object.entries(BODIES)) {
    const d = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2 + (c[2] - v[2]) ** 2;
    if (d < bd) { bd = d; best = `body-${k}`; }
  }
  hit = best;
  bodyCache.set(robe, hit);
  return hit;
}

export function headKey(look) {
  const h = look?.head;
  return HEADS.includes(h) ? `head-${h}` : 'head';
}
export function bodyKey(look) { return bodyFor(look?.robe); }
export function weaponKey(w) { return WEAPONS.includes(w) ? `wp-${w}` : null; }

// 한 장이라도 없으면 전부 벡터로 간다 — 머리만 그림이고 몸은 벡터면 더 이상해 보인다.
export function loadArt(onDone) {
  if (tried) return;
  tried = true;
  let left = FILES.length;
  let bad = false;
  for (const n of FILES) {
    const im = new Image();
    im.onload = () => { img[n] = im; if (--left === 0 && !bad) { ready = true; onDone?.(); } };
    im.onerror = () => { bad = true; left--; };
    im.src = `art/hero/${n}.png`;
  }
}

// 그림 한 장을 '가운데 아래' 기준으로 놓는다
export function putArt(ctx, key, fit) {
  const im = img[key];
  if (!im) return false;
  const h = (im.height * fit.w) / im.width;
  ctx.drawImage(im, fit.x - fit.w / 2, fit.y - h, fit.w, h);
  return true;
}
