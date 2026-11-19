// v6xx 사냥터 위 따르는 무리 — 동료(사람)는 무인 모습으로, 영물(짐승)은 동물 그림으로(화면 전용, 능력치와 상관없다).
// 번호는 collnames.js 차례 그대로(0 = 가장 높은 등급).

// 영물 → 그릴 동물 [모양, 크기(애완동물 기준 1), 떠다님]
//   모양은 creatures.js CREATURES의 이름 — 그림(art/cr)이 있으면 그림, 없으면 벡터. 아래 RELIC_EXTRA는 여기서 더하는 모양
export const RELIC_FIELD = [
  ['yellow_m', 0.8, 1],   // 황룡
  ['phoenix_m', 1, 1],    // 봉황
  ['qilin_m', 1, 0],      // 기린
  ['tiger_m', 1, 0],      // 백호
  ['turtle_m', 1, 0],     // 현무
  ['dragon_m', 0.8, 1],   // 청룡
  ['phoenix', 1, 1],      // 주작
  ['fox_m', 1, 0],        // 구미호(아홉 꼬리)
  ['cloud', 0.5, 0],      // 천마
  ['sleopard', 0.95, 0],  // 설표
  ['gcarp', 0.8, 1],      // 금빛 잉어
  ['wdeer', 1, 0],        // 흰 사슴
  ['ffox', 1, 0],         // 불여우
  ['crane', 1, 0],        // 푸른 학
  ['turtle', 0.85, 0],    // 자라
  ['goat', 1, 0],         // 산양
  ['eagle', 1, 1],        // 수리
  ['raccoon', 0.9, 0],    // 너구리
  ['owl', 1, 1],          // 올빼미
  ['boar', 0.9, 0],       // 멧돼지
  ['weasel', 0.9, 0],     // 족제비
  ['sparrow', 0.9, 1],    // 참새
  ['squirrel', 1, 0],     // 다람쥐
  ['rabbit', 1, 0],       // 토끼
  ['frog', 1, 0],         // 개구리
  ['turtle', 0.75, 0],    // 거북
  ['cat', 0.85, 0],       // 고양이
  ['jackal', 0.8, 0],     // 강아지
  ['chick', 0.9, 0],      // 병아리
  ['butterfly', 1, 1],    // 나비
];

// 영물 열다섯 — 그림은 art/cr/<모양>.webp(상자는 js/crbox.js CR_BOX). 아래 벡터 모습은 그림이 오기 전(또는 못 받았을 때)만 쓰고,
//   몸꼴(네발 · 새 · 용) · 떠다님(fly) · 걸음(gait) · 그림자 폭(len)도 여기서 읽는다
const SMALLQ = { type: 'quad', legW: 3.2, gait: 12 };
const SMALLB = { type: 'bird', plumes: 3, legCol: '#44403c' };
export const RELIC_EXTRA = {
  sleopard: { ...SMALLQ, len: 36, bh: 13, leg: 13, legW: 4.2, col: '#e5e7eb', belly: '#ffffff', spots: '#475569', ear: 'round', tail: 'tiger', tailLen: 22, tailW: 4, neck: [6, -0.8], head: [13, 10], whisker: true, eye: '#0ea5e9', gait: 11 },
  wdeer: { ...SMALLQ, len: 34, bh: 13, leg: 17, col: '#f8fafc', belly: '#ffffff', spots: '#e2e8f0', horn: 'antler', hornCol: '#fde68a', ear: 'pointy', tail: 'tuft', tailLen: 5, neck: [12, -1.1], head: [12, 7], eye: '#0f172a', gait: 11 },
  ffox: { ...SMALLQ, len: 30, bh: 12, leg: 11, legW: 3.4, col: '#dc2626', belly: '#fde68a', ear: 'pointy', tail: 'flame', tailLen: 20, neck: [8, -1.0], head: [12, 8], muzzle: '#fef3c7', eye: '#facc15' },
  raccoon: { ...SMALLQ, len: 30, bh: 14, leg: 8, legW: 4, col: '#78716c', belly: '#d6d3d1', patch: '#1c1917', ear: 'round', tail: 'brush', tailLen: 14, neck: [4, -0.5], neckW: 11, head: [11, 9], muzzle: '#e7e5e4', eye: '#111', gait: 13 },
  weasel: { ...SMALLQ, len: 34, bh: 8, leg: 6, legW: 2.6, col: '#b45309', belly: '#fef3c7', ear: 'round', tail: 'long', tailLen: 18, tailW: 3, neck: [8, -0.4], neckW: 7, head: [10, 6], muzzle: '#fef3c7', eye: '#111', gait: 15 },
  cat: { ...SMALLQ, len: 28, bh: 11, leg: 10, legW: 3.2, col: '#f59e0b', belly: '#fff7ed', stripes: '#b45309', ear: 'pointy', tail: 'long', tailLen: 18, tailW: 2.6, neck: [5, -0.9], head: [10, 8], whisker: true, eye: '#16a34a' },
  frog: { ...SMALLQ, len: 20, bh: 11, leg: 5, legW: 4, col: '#4d7c0f', belly: '#d9f99d', spots: '#365314', ear: 'round', earCol: '#4d7c0f', tail: 'tuft', tailLen: 1, neck: [2, -0.2], neckW: 12, head: [10, 9], muzzle: '#bef264', eye: '#111', gait: 6 },
  owl: { ...SMALLB, fly: 20, len: 20, bh: 16, leg: 6, col: '#78350f', wing: '#a16207', tail: '#57534e', tail2: '#78350f', tailLen: 8, neck: 3, neckW: 7, headR: 7, crown: '#fef3c7', beak: 3, beakCol: '#facc15', eye: '#facc15' },
  sparrow: { ...SMALLB, fly: 16, len: 16, bh: 10, leg: 8, col: '#92400e', wing: '#78350f', tail: '#57534e', tail2: '#a16207', tailLen: 8, neck: 4, neckW: 4, headR: 4, crown: '#78350f', beak: 3, beakCol: '#3f3f46' },
  chick: { ...SMALLB, len: 14, bh: 12, leg: 7, col: '#fde047', wing: '#facc15', tail: '#fde047', tail2: '#fef08a', tailLen: 4, plumes: 1, neck: 3, neckW: 6, headR: 5.5, beak: 3, beakCol: '#f97316', legCol: '#f97316' },
  gcarp: { type: 'dragon', snake: true, len: 40, thick: 6, lift: 8, amp: 5, col: '#f59e0b', belly: '#fef3c7', fin: '#b45309', bands: null, eye: '#111' },
  goat: { ...SMALLQ, len: 30, bh: 13, leg: 13, col: '#f5f5f4', belly: '#ffffff', fur: '#e7e5e4', horn: 'two', hornCol: '#a16207', ear: 'round', tail: 'tuft', tailLen: 5, neck: [8, -0.8], neckW: 9, head: [11, 8], muzzle: '#d6d3d1', eye: '#111', gait: 9 },
  squirrel: { ...SMALLQ, len: 18, bh: 9, leg: 6, legW: 2.6, col: '#b45309', belly: '#fde68a', ear: 'round', tail: 'brush', tailLen: 14, neck: [4, -0.7], neckW: 7, head: [8, 7], muzzle: '#fde68a', eye: '#111', gait: 15 },
  rabbit: { ...SMALLQ, len: 20, bh: 11, leg: 7, col: '#f8fafc', belly: '#ffffff', ear: 'long', earCol: '#fda4af', tail: 'tuft', tailLen: 3, neck: [5, -0.9], neckW: 8, head: [9, 8], muzzle: '#fce7f3', eye: '#e11d48', gait: 14 },
  butterfly: { ...SMALLB, fly: 28, len: 8, bh: 5, leg: 0, col: '#1e1b4b', wing: '#60a5fa', tail: '#f472b6', tail2: '#a78bfa', tailLen: 10, plumes: 2, neck: 2, neckW: 2, headR: 2.4, beak: 1, beakCol: '#1e1b4b' },
};

// 동료 → 무인 모습 { w: 무기, robe: 옷 빛깔, band: 머리띠, head: 머리 모양, hair, f: 여협 머리(긴 생머리 등), hk: 머리 빛깔 }
//   robe가 경지 도포 빛깔(data.js RANKS)이면 그 그림, 아니면 흰 도포에 빛깔을 곱한다
export const PAL_FIELD = [
  { w: 'sword', robe: '#f8f4ea', band: '#b45309', hair: '#e5e7eb' },                   // 검성 백운 — 흰 도포 · 검 · 백발
  { w: 'fan', robe: '#0b0b0d', band: '#4d7c0f' },                                      // 독왕 흑련 — 검은 옷 · 부채
  { w: 'staff', robe: '#344563', band: '#94a3b8', hair: '#e5e7eb' },                   // 장문인 청허 — 청회색 · 지팡이
  { w: 'sword', robe: '#f5f0e6', band: '#7dd3fc', f: 'long', hk: 'white' },            // 설산 검희 — 흰 털옷 · 검
  { w: 'spear', robe: '#8b1f22', band: '#111111', head: 'band' },                      // 철혈 장군 — 붉은 갑옷 · 창
  { w: 'fist', robe: '#6b5640', band: '#a16207', head: 'band', hair: '#9ca3af' },      // 취권 노인 — 갈색 · 맨주먹
  { w: 'dagger', robe: '#b91c1c', band: '#fde68a', f: 'pony', hk: 'black' },           // 비도 낭자 — 붉은 옷 · 비도
  { w: 'fist', robe: '#d97706', band: '#d97706', head: 'bald' },                       // 금강 나한 — 주황 가사 · 맨주먹
  { w: 'saber', robe: '#1f5f8b', band: '#0c4a6e' },                                    // 표국 표두 — 남빛 · 도
  { w: 'staff', robe: '#5b6b4a', band: '#365314', head: 'hat' },                       // 약초 의원 — 쑥빛 · 지팡이 · 삿갓
  { w: 'sword', robe: '#3f3a36', band: '#57534e', head: 'hat' },                       // 떠돌이 검객 — 짙은 옷 · 삿갓
  { w: 'axe', robe: '#4a3426', band: '#b91c1c', head: 'band' },                        // 산적 두령 — 고동 · 도끼
  { w: 'dagger', robe: '#9a5b3a', band: '#7f1d1d', f: 'bun', hk: 'black' },            // 객잔 주모 — 적갈 · 칼
  { w: 'spear', robe: '#32486b', band: '#1e3a8a' },                                    // 마을 무사 — 푸른 옷 · 창
  { w: 'bow', robe: '#5f5a3a', band: '#3f6212', head: 'band' },                        // 사냥꾼 — 올리브 · 활
  { w: 'axe', robe: '#6b5640', band: '#57534e', head: 'band' },                        // 나무꾼 — 갈색 · 도끼
  { w: 'spear', robe: '#5c6f7a', band: '#334155', head: 'hat' },                       // 어부 — 물빛 회색 · 작살 · 삿갓
  { w: 'fan', robe: '#d6d3c4', band: '#1e293b' },                                      // 서생 — 옅은 옷 · 부채
  { w: 'fist', robe: '#b08a5a', band: '#7c2d12', head: 'hat' },                        // 초립동 — 누런 옷 · 초립
  { w: 'staff', robe: '#7c5a3a', band: '#57534e', head: 'hat' },                       // 봇짐장수 — 갈색 · 지팡이 · 삿갓
  { w: 'fist', robe: '#8a8a80', band: '#e7e5e4', head: 'band' },                       // 점소이 — 잿빛 · 맨손
  { w: 'staff', robe: '#6e665a', band: '#44403c', head: 'band', hair: '#57534e' },     // 걸인 — 해진 옷 · 막대
  { w: 'spear', robe: '#7a6a48', band: '#57534e', head: 'hat' },                       // 농부 — 흙빛 · 쇠스랑 · 삿갓
  { w: 'staff', robe: '#9b8a5c', band: '#3f6212' },                                    // 목동 — 짚빛 · 막대
  { w: 'spear', robe: '#55606a', band: '#1e293b', head: 'hat' },                       // 뱃사공 — 짙은 회청 · 노 · 삿갓
];
