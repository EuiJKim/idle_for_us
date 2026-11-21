// v628 무공 동작 — 무인이 무공을 「한다」(직업 × 무공 차수마다 몸이 다르게 움직인다)
//   한 무공 = 모으기(PRE) → 내지름(REL) → 끝동작(POST). 이펙트(무공 그림)도 같은 표로 PRE가 끝나는 때에 터진다.
//   여기는 표와 계산 · 그리기만(게임 상태 없음) — 언제 부르고 어디에 얹는지는 app.js의 po… 함수들.
//
// 열쇠 자세 [u, 자세, 맛]
//   u: 0~1 모으기 · 1~2 내지름 · 2~3 끝동작(차수마다 길이가 달라도 같은 열쇠로)
//   자세는 앞 열쇠 값을 이어받고 적은 것만 바꾼다. 첫 열쇠는 무공을 쓰던 순간의 자세에서 이어진다. 마지막 열쇠 뒤에는 겨눔 자세로 돌아간다.
//   몸(js/pose.js와 같음): lean crouch lift dx hand blade stretch wscale swing — 좌표는 오른쪽을 볼 때 기준
//   활: aim(겨눔 라디안 — -는 하늘 · +는 땅) · pull(시위 0~1)
//   우리 것: ox(앞으로 옮김 px — 몸과 그림자를 함께) · spin(제자리 돌기 바퀴) · rot(온몸 기울기) · shake(떨림 px) · trail(잔상 0~1) · blur(돌기 빛 0~1) · flurry(연타) · bob(떠서 흔들림)
//   맛: o(빠르게 갔다 천천히) · i(천천히 갔다 빠르게) · io · s(칼질처럼 거의 한 번에) · l(고르게)
export const PO_PRE = [40, 60, 90, 130, 180, 240], PO_REL = [260, 320, 420, 600, 560, 820], PO_POST = [160, 200, 260, 320, 420, 600];

const W = 1.8;   // 초식 무기 크기(그림 무기는 이 몫의 1/4만 커진다)
const SEQ = {
  sword: [
    // 0 일섬 — 칼을 허리에 붙여 낮게(발도) → 앞으로 미끄러지며 한 번에 긋고 → 뻗은 채 버티다 미끄러져 돌아온다
    { k: [[1, { lean: 0.22, crouch: 0.52, dx: -4, hand: [2.25, 15], blade: 2.89, wscale: 1.7, swing: 4, ox: -4 }],
      [1.22, { lean: 0.36, crouch: 0.3, dx: 10, hand: [0.1, 29], blade: 0.05, stretch: 0.16, wscale: W, ox: 34, trail: 1, swing: 7 }, 's'],
      [1.6, { lean: 0.3, stretch: 0.04, ox: 36, trail: 0 }], [2, { ox: 32 }, 'io'],
      [2.6, { lean: 0.16, crouch: 0.3, dx: 4, hand: [0.6, 24], blade: 0.3, wscale: 1.3, swing: 3, ox: 4 }, 'io']] },
    // 1 낙엽검 — 칼을 등 뒤 위로 들었다가 엇갈려 두 번(내려 긋고 · 올려 긋고) · 한 걸음씩 나아간다
    { k: [[1, { lean: -0.05, crouch: 0.26, hand: [-2.0, 24], blade: -2.3, wscale: W, ox: -3 }],
      [1.27, { lean: 0.32, crouch: 0.38, dx: 8, hand: [0.9, 27], blade: 1.0, ox: 10, trail: 0.8, swing: 6 }, 's'],
      [1.42, { lean: 0.26, crouch: 0.44, hand: [1.7, 22], blade: 2.3, trail: 0.2 }],
      [1.62, { lean: 0.22, crouch: 0.12, lift: 4, dx: 10, hand: [-1.2, 28], blade: -1.4, ox: 18, trail: 0.8, swing: 3 }, 's'],
      [2, { lift: 1, trail: 0 }], [2.5, { ox: 4, lift: 0, crouch: 0.26 }, 'io']] },
    // 2 회선참 — 칼끝을 뒤로 두고 낮게 웅크렸다가 → 팔을 뻗은 채 두 바퀴 돈다(돌기 빛) → 낮게 마무리
    { k: [[1, { lean: 0.26, crouch: 0.62, hand: [2.4, 18], blade: 2.75, wscale: 1.7, swing: 6 }],
      [1.1, { lean: 0.06, crouch: 0.36, lift: 3, hand: [0.05, 30], blade: 0, wscale: 1.9, spin: 0.3, blur: 1, trail: 0.6, swing: 4 }, 's'],
      [1.72, { spin: 2, lift: 4 }, 'l'],
      [1.84, { lean: 0.32, crouch: 0.62, dx: 6, lift: 0, hand: [0.7, 28], blade: 0.5, blur: 0, trail: 0, swing: 7 }, 'o'],
      [2.3, { crouch: 0.56 }]] },
    // 3 만검귀종 — 칼을 하늘로 들어 한 박자(떨림) → 칼끝으로 앞 땅을 가리키면 칼비가 쏟아진다
    { k: [[0.6, { lean: -0.08, crouch: 0.06, lift: 3, hand: [-1.69, 27], blade: -1.57, wscale: 1.9 }],
      [1, { lift: 4, shake: 1.2 }, 'io'],
      [1.09, { lean: 0.24, crouch: 0.34, dx: 4, lift: 0, hand: [0.5, 30], blade: 0.6, wscale: W, shake: 0, trail: 0.7, swing: 5 }, 's'],
      [1.3, { trail: 0 }], [2, { lean: 0.2, crouch: 0.36 }, 'io']] },
    // 4 천지일검 — 웅크렸다 살짝 뛰어올라 칼을 머리 뒤로 → 내리꽂으며 큰 칼질 · 낮게 내려앉아 버틴다
    { k: [[0.32, { lean: 0.15, crouch: 0.6, hand: [2.2, 18], blade: 2.6, wscale: W, swing: 6 }],
      [0.8, { lean: -0.12, crouch: 0.12, lift: 28, hand: [-1.95, 26], blade: -2.15, wscale: 2, ox: 12, swing: 2, trail: 0.5 }, 'o'],
      [1, { lean: 0.5, crouch: 0.7, dx: 10, lift: 0, hand: [0.95, 30], blade: 1.15, wscale: 2.2, ox: 22, swing: 7, trail: 1 }, 'i'],
      [1.18, { crouch: 0.62, trail: 0 }], [2, { lean: 0.46, crouch: 0.6, ox: 22 }],
      [2.55, { lean: 0.2, crouch: 0.38, dx: 4, hand: [0.7, 24], blade: 0.5, wscale: 1.4, ox: 4, swing: 4 }, 'io']],
      fx: { dust: [1] } },
    // 5 일검파천 — 칼을 뒤로 둔 채 길게 모으고(떨림) → 온몸으로 하늘을 가르듯 올려 긋고 떠오른다 → 크게 내리그어 땅에
    { k: [[0.4, { lean: 0.08, crouch: 0.58, dx: -3, hand: [2.6, 20], blade: 3.0, wscale: 1.9, swing: 6 }],
      [1, { lean: 0.12, crouch: 0.64, hand: [2.7, 19], blade: 3.05, shake: 1.6 }, 'io'],
      [1.06, { lean: -0.16, crouch: 0, lift: 12, dx: 0, hand: [-1.6, 30], blade: -1.57, stretch: -0.14, wscale: 2.3, shake: 0, trail: 1, swing: 0 }, 's'],
      [1.2, { lift: 16, trail: 0 }, 'o'], [1.3, { lift: 17 }],
      [1.42, { lean: 0.5, crouch: 0.66, dx: 10, lift: 0, hand: [0.95, 30], blade: 1.15, stretch: 0.06, wscale: 2.2, trail: 1, swing: 7 }, 'i'],
      [1.56, { stretch: 0, trail: 0 }], [2.2, { lean: 0.44, crouch: 0.6 }]],
      fx: { dust: [1.42], kick2: [1.42, 0.4, 7] } },
  ],
  spear: [
    // 0 돌창 — 창을 가슴 옆으로 당겼다가 → 내지르며 앞으로 미끄러진다
    { k: [[1, { lean: -0.14, crouch: 0.4, dx: -6, hand: [3.0, 13], blade: -0.06, wscale: 1.7, swing: 4, ox: -4 }],
      [1.2, { lean: 0.42, crouch: 0.26, dx: 16, hand: [0, 32], blade: 0, stretch: 0.14, wscale: W, ox: 30, trail: 1, swing: 7 }, 's'],
      [1.6, { stretch: 0.04, trail: 0, ox: 32 }], [2, { ox: 30 }],
      [2.6, { lean: 0.2, crouch: 0.3, dx: 6, hand: [0.4, 26], ox: 4, swing: 3 }, 'io']] },
    // 1 횡소천군 — 창을 등 뒤 위로 감았다가 → 머리 위를 지나 앞 아래까지 크게 쓸어 내린다
    { k: [[1, { lean: -0.12, crouch: 0.32, dx: -4, hand: [-2.2, 24], blade: -2.6, wscale: W, ox: -3 }],
      [1.3, { lean: 0.38, crouch: 0.42, dx: 10, hand: [0.8, 30], blade: 0.6, wscale: 1.9, ox: 12, trail: 0.8, swing: 6 }, 's'],
      [1.55, { trail: 0 }], [2, {}], [2.5, { ox: 3, crouch: 0.32 }, 'io']] },
    // 2 선풍창 — 창을 머리 위로 눕혀 들고 → 두 바퀴 휘돌리고(돌기 빛) → 앞 땅을 내리친다
    { k: [[0.7, { lean: 0, crouch: 0.4, hand: [-1.45, 26], blade: 0, wscale: W, swing: 5 }],
      [1, { crouch: 0.3, lift: 2 }],
      [1.72, { blade: 12.57, lift: 4, blur: 1, trail: 0.4 }, 'l'],
      [1.86, { lean: 0.36, crouch: 0.56, dx: 8, lift: 0, hand: [0.6, 30], blade: 12.57 + 0.55, wscale: 1.9, blur: 0, trail: 0.8, swing: 7 }, 's'],
      [2, { trail: 0 }], [2.4, { crouch: 0.5 }]],
      fx: { dust: [1.86] } },
    // 3 유성낙창 — 웅크렸다 높이 뛰어 창끝을 아래로 → 내리꽂으며 땅에 박는다
    { k: [[0.35, { lean: 0.1, crouch: 0.6, hand: [1.2, 20], blade: 1.0, wscale: W, swing: 6 }],
      [0.8, { lean: 0.05, crouch: 0.1, lift: 34, hand: [-1.2, 24], blade: 1.3, ox: 10, swing: 2, trail: 0.4 }, 'o'],
      [1, { lean: 0.42, crouch: 0.66, dx: 8, lift: 0, hand: [1.0, 30], blade: 1.2, wscale: 1.9, ox: 16, swing: 7, trail: 1 }, 'i'],
      [1.16, { trail: 0 }], [2, { crouch: 0.6 }], [2.5, { ox: 3, crouch: 0.4 }, 'io']],
      fx: { dust: [1] } },
    // 4 관일창 — 깊게 당겨 모으고(떨림) → 온몸으로 길게 꿰뚫고 나아가 버틴다
    { k: [[0.5, { lean: -0.22, crouch: 0.5, dx: -8, hand: [3.05, 12], blade: 0, wscale: 1.9, swing: 6, ox: -5 }],
      [1, { crouch: 0.54, shake: 1.4 }, 'io'],
      [1.12, { lean: 0.52, crouch: 0.32, dx: 18, hand: [0, 34], blade: 0, stretch: 0.22, wscale: 2.1, ox: 34, trail: 1, swing: 8, shake: 0 }, 's'],
      [1.5, { stretch: 0.06, trail: 0, ox: 36 }], [2, { ox: 34 }],
      [2.6, { lean: 0.2, crouch: 0.3, dx: 6, hand: [0.4, 26], wscale: 1.4, ox: 4, swing: 3 }, 'io']] },
    // 5 천붕창 — 창을 뒤로 감아 모으고 → 용처럼 휘돌며 솟구치고(두 바퀴) → 내리꽂아 꿰뚫는다
    { k: [[0.5, { lean: 0.1, crouch: 0.6, hand: [2.6, 16], blade: 2.9, wscale: 1.9, swing: 6 }],
      [1, { crouch: 0.64, shake: 1.2 }, 'io'],
      [1.3, { lean: -0.1, crouch: 0, lift: 24, hand: [-1.5, 30], blade: -1.57, stretch: -0.12, wscale: 2, spin: 2, blur: 1, shake: 0, trail: 0.6, swing: 0 }, 'o'],
      [1.45, { lean: 0.46, crouch: 0.62, dx: 10, lift: 0, hand: [0.7, 32], blade: 0.8, wscale: 2.1, stretch: 0.08, blur: 0, trail: 1, ox: 14, swing: 7 }, 'i'],
      [1.58, { stretch: 0, trail: 0 }], [2.2, { crouch: 0.56 }]],
      fx: { dust: [1.45], kick2: [1.45, 0.3, 7] } },
  ],
  fist: [
    // 0 붕권 — 주먹을 허리로 당겼다가 → 곧게 뻗으며 앞으로 미끄러진다
    { k: [[1, { lean: -0.06, crouch: 0.42, dx: -3, hand: [2.6, 14], blade: 0, wscale: 1.7, swing: 5, ox: -3 }],
      [1.18, { lean: 0.4, crouch: 0.3, dx: 12, hand: [-0.05, 35], blade: -0.05, stretch: 0.12, wscale: W, ox: 22, trail: 1, swing: 7 }, 's'],
      [1.6, { stretch: 0.03, trail: 0 }], [2, {}], [2.6, { ox: 3, lean: 0.2, crouch: 0.34 }, 'io']] },
    // 1 연환각 — 몸을 감았다가 한 바퀴 휘돌며 팔을 뻗어 후려친다(돌기 빛)
    { k: [[1, { lean: -0.05, crouch: 0.36, hand: [2.0, 20], blade: 0.6, wscale: 1.7, swing: 5 }],
      [1.45, { lean: 0.15, crouch: 0.28, lift: 4, hand: [0, 33], blade: 0, wscale: W, spin: 1, blur: 0.8, trail: 0.5, ox: 8 }, 'o'],
      [1.56, { lean: 0.3, crouch: 0.34, lift: 0, hand: [-0.1, 34], blur: 0, trail: 0 }],
      [2, {}], [2.5, { ox: 2 }, 'io']] },
    // 2 금강진천 — 무릎을 들어 올렸다가 땅을 구르고(진각 · 흙먼지) → 두 손바닥으로 민다
    { k: [[0.6, { lean: -0.05, crouch: 0.05, lift: 7, hand: [-1.3, 24], blade: -1.4, wscale: 1.7, swing: 0 }],
      [1, { lean: 0.12, crouch: 0.82, dx: 4, lift: 0, hand: [0.9, 24], blade: 0.4, swing: 8 }, 'i'],
      [1.14, {}],
      [1.34, { lean: 0.32, crouch: 0.36, dx: 10, hand: [-0.18, 35], blade: -1.57, stretch: 0.06, wscale: W, ox: 10, trail: 0.7, swing: 6 }, 's'],
      [1.55, { trail: 0, stretch: 0 }], [2, {}], [2.5, { ox: 2 }, 'io']],
      fx: { dust: [1] } },
    // 3 백보신권 — 웅크렸다 주먹을 치켜들고 뛰어올라 → 땅을 내리친다
    { k: [[0.35, { lean: 0.1, crouch: 0.62, hand: [2.4, 16], blade: 0.3, wscale: 1.7, swing: 6 }],
      [0.8, { lean: -0.1, crouch: 0.1, lift: 32, hand: [-1.6, 28], blade: -1.6, wscale: W, ox: 8, swing: 1, trail: 0.4 }, 'o'],
      [1, { lean: 0.46, crouch: 0.78, dx: 8, lift: 0, hand: [1.25, 30], blade: 1.3, wscale: 1.9, ox: 14, swing: 8, trail: 1 }, 'i'],
      [1.16, { trail: 0 }], [2, {}], [2.5, { ox: 2, crouch: 0.5 }, 'io']],
      fx: { dust: [1] } },
    // 4 항룡십팔장 — 마보로 깊게 앉아 모으고(떨림) → 짧고 세게 터지는 장(掌) · 뻗은 채 버틴다
    { k: [[0.5, { lean: 0, crouch: 0.64, dx: -2, hand: [1.7, 16], blade: 1.2, wscale: 1.7, swing: 7 }],
      [1, { crouch: 0.68, dx: -4, shake: 1.5 }, 'io'],
      [1.08, { lean: 0.46, crouch: 0.42, dx: 14, hand: [-0.1, 37], blade: -1.57, stretch: 0.2, wscale: 2, ox: 20, trail: 1, swing: 9, shake: 0 }, 's'],
      [1.3, { stretch: 0.04, trail: 0, ox: 18 }], [2, {}], [2.6, { ox: 3, lean: 0.2, crouch: 0.4 }, 'io']] },
    // 5 천마멸권 — 허리에 모았다가 → 수없이 번갈아 지르는 주먹(잔상) → 마지막 큰 장
    { k: [[0.5, { lean: 0.05, crouch: 0.56, hand: [2.4, 15], blade: 0.3, wscale: W, swing: 6 }],
      [1, { shake: 1.4 }, 'io'],
      [1.03, { lean: 0.32, crouch: 0.38, dx: 10, hand: [-0.1, 34], blade: -0.2, ox: 10, flurry: 1, trail: 1, shake: 0, swing: 7 }, 's'],
      [1.36, { ox: 14 }, 'l'],
      [1.44, { lean: 0.46, crouch: 0.44, dx: 14, hand: [-0.05, 37], blade: -1.57, stretch: 0.16, wscale: 2, ox: 18, flurry: 0, trail: 1 }, 's'],
      [1.6, { stretch: 0.04, trail: 0 }], [2.2, {}]],
      fx: { kick2: [1.44, 0.7, 0] } },
  ],
  bow: [
    // 0 관일시 — 시위를 끝까지 당겼다가 → 쏘며 몸이 살짝 뒤로 튄다
    { k: [[1, { lean: -0.04, crouch: 0.2, pull: 1, aim: -0.05, swing: 3 }],
      [1.12, { lean: -0.14, dx: -3, pull: 0, aim: -0.12, ox: -4 }, 's'],
      [1.6, { lean: -0.05, dx: -1, pull: 0.3, ox: -2 }], [2, {}]] },
    // 1 연주전 — 앞으로 숙여 겨누고 · 활을 위에서 아래로 쓸며 세 번 연달아(부채꼴)
    { k: [[1, { lean: 0.18, crouch: 0.32, pull: 1, aim: -0.3, swing: 5 }],
      [1.1, { pull: 0, aim: -0.28 }, 's'], [1.28, { pull: 1, aim: 0 }, 'o'],
      [1.36, { pull: 0 }, 's'], [1.54, { pull: 1, aim: 0.28 }, 'o'],
      [1.62, { pull: 0, lean: 0.05, dx: -2 }, 's'], [2, { pull: 0.2 }]] },
    // 2 산화시 — 낮게 당겨 겨누고 → 한 바퀴 돌며 사방으로(돌기 빛) → 앞을 겨눠 마무리
    { k: [[1, { lean: 0.05, crouch: 0.4, pull: 1, aim: -0.15, swing: 5 }],
      [1.7, { spin: 1, pull: 0.5, lift: 3, blur: 0.7, trail: 0.5 }, 'io'],
      [1.84, { pull: 0, crouch: 0.38, lean: -0.1, lift: 0, blur: 0, trail: 0 }], [2, {}]] },
    // 3 만궁낙우 — 몸을 젖혀 하늘로 겨누고(떨림) → 하늘로 세 번 쏘아 올린다(화살비)
    { k: [[0.8, { lean: -0.26, crouch: 0.32, pull: 1, aim: -1.15, swing: 5 }, 'o'],
      [1, { shake: 0.8 }],
      [1.08, { lean: -0.32, dx: -3, pull: 0, aim: -1.2, shake: 0 }, 's'],
      [1.28, { lean: -0.26, dx: 0, pull: 1 }], [1.35, { lean: -0.3, dx: -2, pull: 0 }, 's'],
      [1.55, { lean: -0.26, dx: 0, pull: 1 }], [1.62, { lean: -0.3, dx: -2, pull: 0 }, 's'],
      [2, { lean: -0.2, pull: 0.2, aim: -0.9 }]] },
    // 4 파천시 — 깊게 당겨 모으고(떨림) → 꿰뚫는 한 발 · 되튀어 한 걸음 물러난다
    { k: [[0.6, { lean: -0.14, crouch: 0.44, pull: 1, aim: -0.04, swing: 6 }, 'o'],
      [1, { shake: 1.2 }],
      [1.1, { lean: -0.24, crouch: 0.36, dx: -4, pull: 0, aim: -0.16, ox: -20, shake: 0, trail: 0.6 }, 's'],
      [1.4, { trail: 0, ox: -22 }], [2, { lean: -0.1, ox: -20 }], [2.6, { ox: -3, aim: -0.05 }, 'io']] },
    // 5 유성우 — 웅크렸다 높이 뛰어올라 아래로 겨누고 → 공중에서 세 번(쏠 때마다 몸이 튀어 오름) → 내려앉는다
    { k: [[0.3, { lean: 0.1, crouch: 0.6, pull: 0.5, swing: 6 }],
      [0.85, { lean: 0.25, crouch: 0.12, lift: 36, pull: 1, aim: 0.85, ox: -6, swing: 2 }, 'o'],
      [1, { lift: 38, shake: 0.6 }],
      [1.06, { lift: 41, pull: 0, shake: 0 }, 's'], [1.14, { lift: 39, pull: 1 }],
      [1.18, { lift: 41, pull: 0 }, 's'], [1.26, { lift: 38, pull: 1 }],
      [1.3, { lift: 40, pull: 0 }, 's'], [1.36, { lift: 38, pull: 0.3 }],
      [1.5, { lean: 0.1, crouch: 0.55, lift: 0, aim: 0.2, ox: -4, swing: 7 }, 'i'], [2.1, { crouch: 0.4 }]],
      fx: { dust: [1.5] } },
  ],
  mage: [
    // 0 장풍 — 손을 뒤로 모았다가 → 손바닥으로 밀어낸다
    { k: [[1, { lean: -0.08, crouch: 0.32, hand: [2.4, 16], blade: 1.2, wscale: 1.1, swing: 4 }],
      [1.18, { lean: 0.36, crouch: 0.32, dx: 12, hand: [0.02, 31], blade: -1.2, stretch: 0.08, wscale: 1.15, ox: 10, trail: 0.8, swing: 6 }, 's'],
      [1.6, { trail: 0, stretch: 0.02 }], [2, {}], [2.5, { ox: 2 }, 'io']] },
    // 1 빙백장 — 팔을 등 뒤 위로 들었다가 → 앞으로 크게 쓸어 낸다
    { k: [[1, { lean: -0.1, crouch: 0.22, hand: [-2.2, 26], blade: -2.0, wscale: 1.15 }],
      [1.3, { lean: 0.26, crouch: 0.28, dx: 6, hand: [0.7, 30], blade: 0.4, ox: 8, trail: 0.8, swing: 5 }, 's'],
      [1.55, { trail: 0 }], [2, {}], [2.5, { ox: 2 }, 'io']] },
    // 2 뇌전진 — 지팡이를 높이 들었다가 → 땅에 내리꽂아 세우고 버틴다
    { k: [[0.7, { lean: -0.06, crouch: 0.06, lift: 4, hand: [-1.5, 26], blade: -1.57, wscale: 1.2 }],
      [1, { lean: 0.18, crouch: 0.44, dx: 6, lift: 0, hand: [1.3, 23], blade: -1.5, wscale: 1.2, swing: 5 }, 'i'],
      [1.2, { crouch: 0.4 }], [1.9, { shake: 0.5 }], [2.1, { shake: 0 }]],
      fx: { dust: [1] } },
    // 3 오뢰정법 — 두 팔을 하늘로 들어 벼락을 부른다(떨림) → 앞으로 가리켜 내리게 한다
    { k: [[0.7, { lean: -0.16, crouch: 0, lift: 5, hand: [-1.6, 31], blade: -1.57, wscale: 1.3 }],
      [1, { lift: 6, shake: 1 }],
      [1.06, { lift: 7, stretch: -0.06, shake: 1.4 }, 's'],
      [1.6, { lean: 0.2, crouch: 0.25, lift: 0, hand: [0.35, 30], blade: -0.3, shake: 0, stretch: 0, swing: 4 }, 'o'],
      [2, {}]] },
    // 4 태을신뢰 — 손을 가슴에 모아 길게 기를 모으며 살짝 떠오르고 → 두 팔로 내뻗어 빛줄기 · 되밀리며 버틴다
    { k: [[0.6, { lean: 0, crouch: 0.36, lift: 6, hand: [1.2, 14], blade: -0.3, wscale: 1.2, shake: 0.8 }],
      [1, { lift: 8, shake: 1.4 }],
      [1.08, { lean: 0.3, crouch: 0.3, dx: 8, lift: 3, hand: [0, 34], blade: 0, stretch: 0.1, wscale: 1.3, shake: 1, ox: -8, swing: 5 }, 's'],
      [1.9, { ox: -10 }], [2, { lift: 0, shake: 0, stretch: 0 }], [2.5, { ox: -2 }, 'io']] },
    // 5 천뢰강림 — 두 팔을 벌리고 떠오른다 → 하늘을 부르며 높이 떠서 흔들리다 → 내려앉는다
    { k: [[0.6, { lean: -0.05, crouch: -0.05, lift: 14, hand: [-0.8, 30], blade: -1.2, wscale: 1.3 }],
      [1, { lift: 20, shake: 0.8 }],
      [1.08, { lift: 24, hand: [-1.25, 32], blade: -1.57, stretch: -0.06, shake: 1.2 }, 's'],
      [1.5, { lift: 22, shake: 0.6, bob: 1 }],
      [1.7, { lean: 0.05, crouch: 0.42, lift: 0, hand: [1.0, 22], blade: 1.2, shake: 0, stretch: 0, bob: 0, swing: 6 }, 'io'], [2.2, { crouch: 0.36 }]],
      fx: { dust: [1.7] } },
  ],
};
// 버프(2 · 4차) — 숨을 들이쉬며 어깨가 오르고 → 힘주어 낮게 버틴다(4차는 살짝 떴다가 땅을 누른다 · 흙먼지)
const BUFF_HAND = { sword: [[1.6, 16], 1.4, [1.95, 22], 1.2], spear: [[1.5, 16], -1.4, [1.4, 20], -1.57], fist: [[1.9, 14], 0.4, [1.7, 16], 1.2], bow: [[1.6, 16], 0, [1.6, 16], 0], mage: [[1.3, 16], -1.5, [1.3, 22], -1.57] };
function buffSeq(job, tier) {
  const [h0, b0, h1, b1] = BUFF_HAND[job] || BUFF_HAND.sword, big = tier >= 4, bow = job === 'bow';
  return { k: [[0.8, { lean: -0.1, crouch: -0.06, lift: 2, hand: h0, blade: b0, wscale: 1.3, swing: 0, ...(bow ? { pull: 0.2, aim: -0.15 } : {}) }, 'io'],
    [1, { lift: big ? 7 : 3 }, 'o'],
    [1.1, { lean: 0.06, crouch: big ? 0.62 : 0.5, lift: 0, hand: h1, blade: b1, wscale: 1.5, swing: 8, shake: 1.4, ...(bow ? { pull: 0, aim: 0.3 } : {}) }, 'i'],
    [1.45, { shake: 0, crouch: big ? 0.56 : 0.46 }], [2, {}]], fx: big ? { dust: [1.1] } : {} };
}

// ── 계산 ──
const DEF = { lean: 0, crouch: 0, lift: 0, dx: 0, hand: [2.5, 22], blade: -0.6, stretch: 0, alpha: 1, wscale: 1, swing: 0, aim: 0, pull: 0.7, ox: 0, spin: 0, rot: 0, shake: 0, trail: 0, blur: 0, flurry: 0, bob: 0 };
const KEYS = Object.keys(DEF);
const EASE = { o: (p) => 1 - (1 - p) ** 3, i: (p) => p * p * p, io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2), s: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)), l: (p) => p };
const full = (p) => { const o = { ...DEF, ...p }; o.hand = [(p?.hand || DEF.hand)[0], (p?.hand || DEF.hand)[1]]; return o; };
export const poFull = full;   // 빠진 값을 채운 자세(우리 것은 0 · 시위 0.7)
const lerp = (a, b, k) => a + (b - a) * k;
export function poMix(a, b, k) {
  const o = {};
  for (const n of KEYS) o[n] = n === 'hand' ? [lerp(a.hand[0], b.hand[0], k), lerp(a.hand[1], b.hand[1], k)] : lerp(a[n] ?? DEF[n], b[n] ?? DEF[n], k);
  return o;
}
// 돌아가는 값(칼 각 · 바퀴)은 가까운 쪽으로 — 두 바퀴 돈 뒤 겨눔 자세로 돌아갈 때 거꾸로 감기지 않게
const near = (v, to, per) => v - Math.round((v - to) / per) * per;
function unwrap(a, b) { const o = { ...a }; o.blade = near(a.blade, b.blade, Math.PI * 2); o.spin = near(a.spin, b.spin, 1); o.aim = near(a.aim, b.aim, Math.PI * 2); return o; }
// 직업 · 차수 · 종류 → 열쇠를 다 채운 순서(한 번 만들어 둔다)
const cache = new Map();
export function poSeq(job, tier, kind) {
  const key = `${job}|${tier}|${kind}`; let S = cache.get(key);
  if (S) return S;
  const src = kind === 'buff' ? buffSeq(job, tier) : (SEQ[job] || SEQ.sword)[Math.max(0, Math.min(5, tier))];
  let prev = full({});
  const keys = src.k.map(([u, p, e]) => { const o = full({ ...prev, ...p, hand: p.hand || prev.hand }); prev = o; return [u, o, EASE[e || 'o']]; });
  S = { keys, fx: src.fx || {}, tier, kind, job };
  cache.set(key, S); return S;
}
// 지난 ms(쓴 때부터) → u(0~3)
export const poU = (ms, pre, rel, post) => (ms < pre ? ms / pre : ms < pre + rel ? 1 + (ms - pre) / rel : Math.min(3, 2 + (ms - pre - rel) / post));
// 지금 자세 — from: 쓰던 순간의 자세(다 채운 것) · live: 지금 겨눔 자세(돌아갈 곳)
export function poSample(S, from, u, ms, live) {
  const K = S.keys, last = K[K.length - 1];
  let o;
  if (u >= last[0]) {
    const L = full(live), q = Math.min(1, (u - last[0]) / Math.max(1e-6, 3 - last[0]));
    o = poMix(unwrap(last[1], L), L, EASE.io(q));
  } else {
    let i = 0; while (i < K.length && K[i][0] <= u) i++;
    const A = i === 0 ? unwrap(from, K[0][1]) : K[i - 1][1], a0 = i === 0 ? 0 : K[i - 1][0], B = K[i];
    const p = B[0] - a0 > 0 ? Math.max(0, Math.min(1, (u - a0) / (B[0] - a0))) : 1;
    o = poMix(A, B[1], B[2](p));
  }
  // 떨림 · 연타 · 떠서 흔들림(시간으로 정해진 값 — 같은 때면 같은 그림)
  if (o.shake > 0.01) { o.dx += Math.sin(ms * 0.9) * o.shake; o.lift += Math.abs(Math.cos(ms * 1.3)) * o.shake * 0.5; }
  if (o.flurry > 0.01) { const f = Math.sin(ms * Math.PI / 42); o.hand = [o.hand[0] + (f > 0 ? -0.32 : 0.26) * o.flurry, o.hand[1] + (f > 0 ? 3 : -4) * o.flurry]; o.lean += (f > 0 ? 0.06 : -0.03) * o.flurry; o.dx += (f > 0 ? 3 : -1) * o.flurry; }
  if (o.bob > 0.01) o.lift += Math.sin(ms * 0.011) * 3 * o.bob;
  return o;
}
// drawFighter에 넘길 자세(우리 것은 빼고)
export const poBody = (o) => ({ lean: o.lean, crouch: o.crouch, lift: o.lift, dx: o.dx, hand: o.hand, blade: o.blade, stretch: o.stretch, alpha: 1, wscale: o.wscale, swing: o.swing, aim: o.aim, pull: o.pull });

// ── 그리기 ──
// 돌기 빛 — 손 높이(o.hand · lift)에 납작한 고리(도는 쪽으로 밝은 꼬리가 흐른다). x, y = 발(화면) · 몸을 돌리면 그 바퀴, 무기만 돌리면 무기 각을 따라
export function poBlurPaint(cx, x, y, sc, col, o, face) {
  const amt = o.blur, ang = o.spin ? o.spin * Math.PI * 2 : o.blade, R = (o.spin ? 46 : 40) * sc, yy = y + (-67 + Math.sin(o.hand[0]) * o.hand[1] - o.lift) * sc;
  cx.save(); cx.globalCompositeOperation = 'lighter'; cx.translate(x, yy); cx.scale(1, 0.32); cx.lineCap = 'round';
  for (let j = 0; j < 3; j++) {
    const a0 = (ang * face) + j * 2.1, len = 1.5;
    cx.globalAlpha = amt * (j ? 0.35 : 0.75); cx.strokeStyle = j ? col : '#ffffff'; cx.lineWidth = (j ? 7 : 3.5) * sc;
    cx.beginPath(); cx.arc(0, 0, R * (1 - j * 0.08), a0 - len, a0); cx.stroke();
  }
  cx.restore();
}
// 5차 컷인 — 화면 위쪽 띠(무인 · 이펙트를 가리지 않게) · 모으는 동안 들어와 내지르는 순간 칼금처럼 접혀 사라진다
//   o: { W, y0, bh, ms, pre, name, pal{c,c2,glow}, bg(그림|null), dir(들어오는 쪽), low, portrait(cx, x, y, s) | null, see(띠 진하기 0~1) }
export const poCutEnd = (pre) => pre + 110;
export function poCutPaint(cx, o) {
  const { W, y0, bh, ms, pre } = o, inMs = 90, outA = pre - 40, outB = poCutEnd(pre);
  if (ms < 0 || ms > outB) return false;
  const ein = ms < inMs ? 1 - (1 - ms / inMs) ** 3 : 1, ex = ms < outA ? 0 : Math.min(1, (ms - outA) / (outB - outA));
  const shift = (1 - ein) * W * 0.6 * o.dir, sy = Math.max(0.02, 1 - ex * ex), yc = y0 + bh / 2, al = ein * (1 - ex * 0.6);
  cx.save();
  cx.translate(shift, yc); cx.scale(1, sy); cx.translate(0, -yc);
  cx.beginPath(); cx.moveTo(-12, y0 + 7); cx.lineTo(W + 12, y0 - 5); cx.lineTo(W + 12, y0 + bh - 7); cx.lineTo(-12, y0 + bh + 5); cx.closePath();
  cx.save(); cx.clip();
  cx.globalAlpha = al * (o.see ?? 1);
  if (o.bg) { const dh = W * o.bg.height / o.bg.width; cx.drawImage(o.bg, 0, yc - dh * 0.42, W, dh); } else { cx.fillStyle = '#0d0b09'; cx.fillRect(0, y0 - 8, W, bh + 16); }
  cx.fillStyle = 'rgba(8,6,4,.5)'; cx.fillRect(0, y0 - 8, W, bh + 16);
  if (!o.low) {   // 띠를 따라 흐르는 빛줄(속도선)
    cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
    for (let j = 0; j < 8; j++) {
      const yy = y0 + bh * (0.12 + ((j * 37) % 76) / 100), sp = 1.3 + (j % 3) * 0.5, xx = ((ms * sp + j * 211) % (W + 260)) - 130, ln = 60 + (j % 4) * 34;
      cx.globalAlpha = al * (j % 2 ? 0.28 : 0.45); cx.strokeStyle = j % 3 ? o.pal.c : '#ffffff'; cx.lineWidth = j % 3 ? 1.6 : 1;
      cx.beginPath(); cx.moveTo(W - xx * o.dir - ln * o.dir, yy); cx.lineTo(W - xx * o.dir, yy); cx.stroke();
    }
    cx.globalCompositeOperation = 'source-over';
    if (o.portrait) { cx.globalAlpha = al; o.portrait(cx, W * 0.87, y0, bh); }
  }
  cx.restore();
  // 위아래 테두리 빛줄
  cx.globalAlpha = al; cx.lineWidth = 2.2; cx.strokeStyle = o.pal.c; cx.shadowColor = o.pal.glow; cx.shadowBlur = o.low ? 0 : 8;
  cx.beginPath(); cx.moveTo(-12, y0 + 7); cx.lineTo(W + 12, y0 - 5); cx.moveTo(W + 12, y0 + bh - 7); cx.lineTo(-12, y0 + bh + 5); cx.stroke();
  cx.shadowBlur = 0;
  // 무공 이름 — 붓글씨(오른쪽 가운데: 왼쪽 위 창들에 안 가리게)
  const fs = Math.round(bh * 0.6), tx = W * 0.6, ty = yc + fs * 0.36 + (1 - ein) * 6;
  cx.font = `900 ${fs}px "Nanum Brush Script", "Gowun Batang", serif`; cx.textAlign = 'center';
  cx.lineWidth = 6; cx.strokeStyle = 'rgba(0,0,0,.9)'; cx.strokeText(o.name, tx, ty);
  const gr = cx.createLinearGradient(0, ty - fs, 0, ty); gr.addColorStop(0, o.pal.c2); gr.addColorStop(1, o.pal.c);
  cx.fillStyle = gr; cx.fillText(o.name, tx, ty);
  cx.restore();
  // 내지르는 순간 — 띠가 접히는 자리에 흰 칼금
  if (ex > 0 && ex < 1) {
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - ex; cx.lineCap = 'round';
    const gr2 = cx.createLinearGradient(0, 0, W, 0); gr2.addColorStop(0, 'rgba(255,255,255,0)'); gr2.addColorStop(0.5, '#ffffff'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
    cx.strokeStyle = gr2; cx.lineWidth = 3 + (1 - ex) * 5; cx.beginPath(); cx.moveTo(-12, yc + 6); cx.lineTo(W + 12, yc - 6); cx.stroke();
    cx.restore();
  }
  return true;
}
