// 무인 자세(포즈)와 자세 사이를 잇는 움직임.
//
// 전에는 무인이 할 줄 아는 동작이 '앞으로 내밀기(lunge)' 하나뿐이었다.
// 무공이 스물넷인데 몸은 다 똑같이 움찔했다 — 초식마다 다른 건 빛뿐이었다.
// 여기 자세를 이름으로 적어 두고, 연출표(skillfx.js)가 "몇 초에 어느 자세"를
// 차례로 부르면 그 사이를 이어서 drawFighter에 넘긴다.
//
// **좌표는 무인이 오른쪽을 볼 때 기준이다.** 왼쪽을 보면 drawFighter가 통째로
// 뒤집는다. 각도는 캔버스 그대로(0 = 앞, -PI/2 = 위, +PI/2 = 아래).
//
//   lean    몸 기울기 (+ 앞으로). 발끝을 축으로 돈다.
//   crouch  웅크림 0..1. 키가 줄고 다리가 벌어진다.
//   lift    발이 뜬 높이(px)
//   dx      앞으로 내디딘 거리(px)
//   hand    [각도, 길이] 어깨에서 손까지
//   blade   칼끝이 가리키는 각도
//   stretch 가로로 늘어남 (빠르게 움직일 때)
//   alpha   몸의 진하기 (0이면 사라진 것 — 순보)
//   wscale  무기 크기. 평소 검은 그림 몸에 맞춰 작게 그려서, 초식을 쓸 때는
//           키워야 칼끝이 어디를 보는지 읽힌다 (자세 도감 tools/poses.html에서 확인)

const PI = Math.PI;
const P = (o) => ({ lean: 0, crouch: 0, lift: 0, dx: 0, hand: [2.5, 22], blade: -0.6, stretch: 0, alpha: 1, wscale: 1, ...o });
const W = 1.7;   // 초식 자세의 칼 크기

// 평소 자세. drawFighter의 기본 팔(검이 앞 위를 보고 손이 허리 뒤)과 같은 자리다 —
// 어긋나 있으면 자세가 끝날 때마다 검이 툭 튄다.
export const IDLE = P({});

export const POSES = {
  // ---- 공통 ----
  기모으기: P({ crouch: 0.2, hand: [1.3, 18], blade: 1.45, wscale: W }),
  순보: P({ lean: 0.5, crouch: 0.2, stretch: 0.45, alpha: 0 }),
  착지: P({ lean: 0.2, crouch: 0.6, hand: [1.6, 20], blade: 2.2, wscale: W }),
  마무리: P({ crouch: 0.05, hand: [1.9, 20], blade: 1.75, wscale: W }),
  // ---- 검 ----
  // 칼을 허리에 붙이고 낮게 웅크린다 — 손이 뒤로, 칼끝도 뒤로
  발도준비: P({ lean: 0.2, crouch: 0.5, dx: -4, hand: [2.25, 15], blade: PI - 0.25, wscale: W }),
  // 한 번 그은 뒤 팔이 앞으로 다 뻗어 있다
  일섬: P({ lean: 0.34, crouch: 0.32, dx: 10, hand: [0.12, 28], blade: 0.06, stretch: 0.06, wscale: W }),
  // 칼을 가슴 옆으로 당겨 칼끝을 앞에 둔다
  찌르기준비: P({ lean: -0.14, crouch: 0.38, dx: -6, hand: [PI - 0.15, 13], blade: -0.06, wscale: W }),
  찌르기: P({ lean: 0.4, crouch: 0.24, dx: 16, hand: [0.0, 32], blade: 0, stretch: 0.1, wscale: W }),
  // 칼을 하늘로 곧게 든다
  검거양: P({ lean: -0.06, crouch: 0.04, lift: 2, hand: [-PI / 2 - 0.12, 27], blade: -PI / 2, wscale: W }),
  // 위에서 비스듬히 끝까지 그어 내린 자리
  내려베기: P({ lean: 0.44, crouch: 0.45, dx: 10, hand: [0.85, 27], blade: 0.95, wscale: W }),
  // 칼을 거꾸로 잡아 허리로 거둔다
  납도: P({ lean: 0.03, crouch: 0.08, hand: [2.0, 16], blade: PI - 0.5, wscale: W }),
  // ---- 권갑 (권마) — 초식 ----
  // 마보: 말 탄 듯 깊게 앉아 두 주먹을 허리에 붙인다
  마보: P({ crouch: 0.62, dx: -2, hand: [1.7, 16], blade: 1.2, wscale: W }),
  // 진각: 한 발을 굴러 땅을 찍는다 — 몸이 뜨지 않고 아래로 박힌다
  진각: P({ lean: 0.12, crouch: 0.78, dx: 4, hand: [0.9, 24], blade: 0.4, wscale: W }),
  // 쌍장: 두 손바닥을 앞으로 민다 (그림 팔은 하나라 손을 가슴 높이로 길게 뻗는다)
  쌍장: P({ lean: 0.3, crouch: 0.34, dx: 10, hand: [-0.18, 34], blade: -1.57, stretch: 0.05, wscale: W }),
  // ---- 권갑 (권마) — 평타 연타 ----
  // 정권: 어깨에서 곧게 뻗는다
  정권: P({ lean: 0.38, crouch: 0.3, dx: 12, hand: [-0.05, 33], blade: -0.05, stretch: 0.08, wscale: W }),
  // 훅: 옆에서 둥글게 감아 친다 — 손이 몸 앞을 가로지른다
  훅: P({ lean: 0.26, crouch: 0.22, dx: 8, hand: [-0.55, 27], blade: 0.6, wscale: W }),
  // 올려치기: 낮게 웅크렸다가 위로 솟구친다
  올려치기: P({ lean: 0.14, crouch: 0.05, lift: 4, dx: 6, hand: [-1.25, 30], blade: -1.4, stretch: 0.04, wscale: W }),
  // ---- 독낭 (독마) ----
  투척준비: P({ lean: -0.18, crouch: 0.2, dx: -4, hand: [-2.3, 24], blade: -2.2, wscale: W }),
  투척: P({ lean: 0.3, crouch: 0.18, dx: 8, hand: [-0.25, 30], blade: -0.35, stretch: 0.05, wscale: W }),
  흩뿌리기: P({ lean: 0.22, crouch: 0.3, dx: 6, hand: [0.55, 30], blade: 0.7, wscale: W }),
  땅짚기: P({ lean: 0.35, crouch: 0.75, dx: 6, hand: [1.35, 30], blade: 1.5, wscale: W }),
  장타: P({ lean: 0.34, crouch: 0.32, dx: 12, hand: [0.02, 31], blade: -1.2, stretch: 0.06, wscale: W }),
  // ---- 부채 (환마) ----
  펼치기: P({ lean: -0.08, crouch: 0.1, hand: [-1.2, 22], blade: -1.4, wscale: W }),
  휘두르기: P({ lean: 0.24, crouch: 0.16, dx: 6, hand: [0.1, 30], blade: -0.4, wscale: W }),
  // ---- 지환 (극악소마) ----
  지법겨눔: P({ lean: 0.12, crouch: 0.15, dx: 4, hand: [-0.08, 32], blade: -0.08, wscale: W }),
  손가락튕김: P({ lean: -0.06, crouch: 0.12, hand: [-0.2, 30], blade: -0.5, wscale: W }),
};

const lerp = (a, b, k) => a + (b - a) * k;

export function mixPose(a, b, k) {
  return {
    lean: lerp(a.lean, b.lean, k),
    crouch: lerp(a.crouch, b.crouch, k),
    lift: lerp(a.lift, b.lift, k),
    dx: lerp(a.dx, b.dx, k),
    hand: [lerp(a.hand[0], b.hand[0], k), lerp(a.hand[1], b.hand[1], k)],
    blade: lerp(a.blade, b.blade, k),
    stretch: lerp(a.stretch, b.stretch, k),
    alpha: lerp(a.alpha, b.alpha, k),
    wscale: lerp(a.wscale ?? 1, b.wscale ?? 1, k),
  };
}

// 넘어가는 맛. 'snap'은 칼질처럼 처음에 거의 다 가 버린다.
const EASE = {
  lin: (p) => p,
  out: (p) => 1 - (1 - p) ** 3,
  in: (p) => p * p * p,
  inout: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  snap: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  step: (p) => (p >= 1 ? 1 : 0),
};

const poseOf = (x) => (typeof x === 'string' ? POSES[x] || IDLE : { ...IDLE, ...x });

// 자세 이음. play([[0, '발도준비'], [0.25, '일섬', 'snap'], [0.7, '납도']], 0.3)
// — 각 줄은 [그 자세에 닿는 시각, 자세, 그리로 가는 맛]. 마지막 자세에 닿은 뒤
// `out`초에 걸쳐 평소 자세로 돌아간다. 첫 줄이 0초가 아니면 평소 자세에서 출발한다.
export class PoseAnim {
  constructor() { this.keys = null; this.t = 0; this.out = 0.3; }

  play(keys, out = 0.3) {
    const ks = keys.map(([at, pose, ease]) => ({ at, pose: poseOf(pose), ease: EASE[ease] || EASE.out }));
    if (ks[0].at > 0) ks.unshift({ at: 0, pose: this.sample() || IDLE, ease: EASE.out });
    this.keys = ks;
    this.t = 0;
    this.out = out;
  }

  stop() { this.keys = null; }
  get active() { return !!this.keys; }

  tick(dt) {
    if (!this.keys) return;
    this.t += dt;
    const last = this.keys[this.keys.length - 1];
    if (this.t > last.at + this.out) this.keys = null;
  }

  // 지금 자세. 이음이 없으면 null (drawFighter가 원래대로 그린다)
  sample() {
    const ks = this.keys;
    if (!ks) return null;
    const t = this.t;
    const last = ks[ks.length - 1];
    if (t >= last.at) {
      const k = this.out > 0 ? Math.min(1, (t - last.at) / this.out) : 1;
      return mixPose(last.pose, IDLE, EASE.inout(k));
    }
    let i = 0;
    while (i < ks.length - 1 && ks[i + 1].at <= t) i++;
    const a = ks[i];
    const b = ks[i + 1];
    const span = b.at - a.at;
    const p = span > 0 ? (t - a.at) / span : 1;
    return mixPose(a.pose, b.pose, b.ease(Math.max(0, Math.min(1, p))));
  }
}
