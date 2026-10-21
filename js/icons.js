// 창 안의 아이콘을 그림으로 바꾼다. 없으면 지금 쓰는 글자·이모지 그대로 둔다.
//
// 지금은 영수가 🦢 같은 이모지고 유물·수련은 '만년'·'외공' 같은 두 글자다.
// 기기마다 이모지 생김새가 달라서 우리 그림체와 따로 논다.
//
// **읽는 파일은 아래 KINDS로 고정이다.** 다른 이름으로 그려 넣어도 안 뜬다.
// 늘리려면 여기를 먼저 늘려야 한다 — 그림만 늘리는 건 돈만 버리는 일이다.
export const KINDS = {
  pet: 8,        // 영수 — PETS 차례대로
  relic: 8,      // 유물 — RELICS 차례대로
  up: 6,         // 수련 — UPGRADES 차례대로(외공·내공·혈도·파괴·쾌검·상재)
  // 장비는 **등급까지 그림이 다르다.** 여섯 칸에 같은 글자가 들어가고
  // 테두리 색만 달랐다 — 범품과 천품이 똑같이 생겼었다.
  eqweapon: 6,   // 검   범품~천품
  eqarmor: 6,    // 호신의
  eqring: 6,     // 옥패
  acc: 3,        // 장신구 — ACC_SLOTS 차례대로(가락지·귀걸이·비녀)
  ego: 2,        // 심검·심의
  dg: 4,         // 수련터 — DUNGEONS 차례대로
};

const have = {};   // 'pet-0' → true/false, 아직 모르면 undefined

// 한 장씩 따로 본다. 하나가 없어도 나머지는 쓴다 —
// 사람 그림과 달리 섞여 있어도 이상하지 않다(아이콘은 서로 독립이다).
function probe(key) {
  if (have[key] !== undefined) return;
  have[key] = false;
  const im = new Image();
  im.onload = () => { have[key] = true; };
  im.src = `art/icon/${key}.png`;
}

export function loadIcons() {
  for (const [kind, n] of Object.entries(KINDS)) {
    for (let i = 0; i < n; i++) probe(`${kind}-${i}`);
  }
}

// 아이콘 자리에 그림을 깐다. 없으면 글자가 그대로 보인다.
export function iconSkin(el, kind, i) {
  if (!el) return;
  const key = `${kind}-${i}`;
  if (!have[key]) return;
  el.style.backgroundImage = `url('art/icon/${key}.png')`;
  el.classList.add('has-art');
}
