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
  up: 16,        // 수련 — UPGRADES 차례대로(외공·내공·혈도·파괴·쾌검·상재·호신·역근·연격·투지·심법·토납·미혹·혈조·오성·좌망)
  // 장비는 **등급까지 그림이 다르다.** 여섯 칸에 같은 글자가 들어가고
  // 테두리 색만 달랐다 — 범품과 천품이 똑같이 생겼었다.
  eqweapon: 6,   // 검   범품~천품
  eqarmor: 6,    // 호신의
  eqring: 6,     // 옥패
  acc: 3,        // 장신구 — ACC_SLOTS 차례대로(가락지·귀걸이·비녀)
  ego: 2,        // 심검·심의
  dg: 4,         // 수련터 — DUNGEONS 차례대로
  sp: 6,         // 스탯 포인트 — SP_STATS 차례대로(근력·체질·살기·투지·재운·오성)
  codex: 3,      // 인물도감 — CODEX_KINDS 차례대로(잡졸·관문지기·패왕)
  // 계열 전용 무공 스물넷. **차례는 JOB_SKILLS 차례와 같다** —
  // 1차 여덟 · 2차 여덟 · 3차 여덟이지 계열별로 묶여 있지 않다.
  jskill: 24,
  // 누구나 쓰는 무공 열넷. 차례는 GEN_SKILLS 차례와 같다.
  skill: 14,
};

const have = {};     // 'pet-0' → true/false, 아직 모르면 undefined
const waiting = {};  // 그림이 오기 전에 자리를 달라고 한 칸들

// **그림이 오기 전에 부르면 그냥 지나가 버렸다.**
// 들판 무공 바는 시작하자마자 한 번 만들어지는데 그때는 아직 그림이 안 와서,
// 창 안에는 그림이 뜨고 들판 바에는 글자가 남았다. 나중에 와도 붙게 적어 둔다.
function apply(el, key) {
  el.style.backgroundImage = `url('art/icon/${key}.png')`;
  el.classList.add('has-art');
}

// 한 장씩 따로 본다. 하나가 없어도 나머지는 쓴다 —
// 사람 그림과 달리 섞여 있어도 이상하지 않다(아이콘은 서로 독립이다).
function probe(key) {
  if (have[key] !== undefined) return;
  have[key] = false;
  const im = new Image();
  im.onload = () => {
    have[key] = true;
    for (const el of waiting[key] || []) apply(el, key);
    delete waiting[key];
  };
  im.onerror = () => { delete waiting[key]; };
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
  if (have[key]) { apply(el, key); return; }
  // 아직 안 왔으면 줄을 세워 둔다. 와서 붙는다.
  (waiting[key] = waiting[key] || []).push(el);
  probe(key);
}

// v136: 이름으로 그림 한 장(art/icon/<key>.png)을 깐다 — 무공 단추·창 단추·장비 칸·던전.
// 그림이 오면 has-art가 붙고 css가 글자를 줄이거나 감춘다. 안 오면 글자 그대로. el을 그대로 돌려준다.
const skinHave = {};
const skinWait = {};
export function skinImg(el, key) {
  if (!el) return el;
  // css 변수 속 url()은 그 변수를 쓰는 css 파일(css/) 기준으로 풀린다 — 절대 주소로 넣는다
  const put = () => { el.style.setProperty('--art', `url('${new URL(`art/icon/${key}.png`, document.baseURI).href}')`); el.classList.add('has-art'); };
  if (skinHave[key]) { put(); return el; }
  if (skinHave[key] === false) return el;
  (skinWait[key] = skinWait[key] || []).push(put);
  if (skinWait[key].length === 1) {
    const im = new Image();
    im.onload = () => { skinHave[key] = true; for (const f of skinWait[key]) f(); delete skinWait[key]; };
    im.onerror = () => { skinHave[key] = false; delete skinWait[key]; };
    im.src = `art/icon/${key}.png`;
  }
  return el;
}
