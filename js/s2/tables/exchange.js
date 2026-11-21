// v635 교환소 — 대결은 「명성」, 문파는 「공적」, 월드보스는 「혈전패」. 모은 만큼 원하는 것과 바꾼다(상점 → 교환소).
//   재화는 지갑에 그대로 남는다(다음 주로 넘어감). 물건마다 주간 한도 · 월요일에 새로(weekKey).
//   버는 양(대략 한 주): 명성 5판 × 7일 ≈ 300~420 · 공적 출석 · 토벌 · 수련 ≈ 250 · 혈전패 3번 × 7일 + 지난주 순위 ≈ 180~230
//   다 사도 뽑기권 열 장 남짓 · 강화석 · 복구 주문서 몇 장 — 하루 상점보다 작다(성장 곡선은 그대로).
export const EX_CUR = {
  fame: { key: 'coin:fame', name: '명성', icon: 'fame', gly: '譽', from: '대결', go: 'rival:1' },
  merit: { key: 'coin:merit', name: '공적', icon: 'merit', gly: '勳', from: '문파', go: 'rival:2' },
  blood: { key: 'coin:blood', name: '혈전패', icon: 'blood', gly: '血', from: '월드보스', go: 'rival:0' },
};
export const EX_IDS = Object.keys(EX_CUR);
// 버는 곳 — 이미 보상을 주는 자리에서 조금씩
export const EX_EARN = {
  fame: { win: 12, lose: 5, week: [10, 15, 20, 30, 40, 50, 60] },   // 대결 한 판(이김 · 짐) · 지난주 최고 등급(하수 → 현경) 받을 때
  merit: { checkin: 15, graidTry: 10, graidPhase: 10, gtrain: 40 },   // 문파 출석 · 토벌 한 번 · 토벌 단계 보상마다 · 수련 보상
  blood: { try: 8, community: 10, week: [[1, 60], [3, 45], [10, 35], [50, 25], [100, 15], [Infinity, 10]] },   // 한 번 칠 때 · 공동 토벌 단계마다 · 지난주 순위
};
// 진열대 — { id, name, give, price, limit(주간) }
export const EXCHANGE = {
  fame: [
    { id: 'gear', name: '장비 뽑기권', give: { 'ticket:gear': 1 }, price: 40, limit: 5 },
    { id: 'weapon', name: '병기 뽑기권', give: { 'ticket:weapon': 1 }, price: 80, limit: 1 },
    { id: 'stone', name: '강화석 꾸러미', give: { 'item:stone': 20 }, price: 15, limit: 6 },
    { id: 'time', name: '시간 티켓', give: { 'ticket:time': 1 }, price: 120, limit: 1 },
  ],
  merit: [
    { id: 'pal', name: '동료 뽑기권', give: { 'ticket:pal': 1 }, price: 60, limit: 2 },
    { id: 'relic', name: '영물 뽑기권', give: { 'ticket:relic': 1 }, price: 60, limit: 1 },
    { id: 'gear', name: '장비 뽑기권', give: { 'ticket:gear': 1 }, price: 40, limit: 3 },
    { id: 'heart', name: '심법 구슬', give: { 'item:heart': 2 }, price: 20, limit: 5 },
    { id: 'exped', name: '원정권', give: { 'ticket:exped': 1 }, price: 30, limit: 2 },
  ],
  blood: [
    { id: 'restore', name: '복구 주문서', give: { 'item:restore': 1 }, price: 25, limit: 3 },
    { id: 'stone', name: '강화석 상자', give: { 'item:stone': 30 }, price: 20, limit: 4 },
    { id: 'shard', name: '뽑기 조각', give: { 'item:shard': 10 }, price: 12, limit: 5 },
    { id: 'gear', name: '장비 뽑기권', give: { 'ticket:gear': 1 }, price: 40, limit: 2 },
    { id: 'time', name: '시간 티켓', give: { 'ticket:time': 1 }, price: 90, limit: 1 },
  ],
};
export const exItem = (cur, id) => (EXCHANGE[cur] || []).find((x) => x.id === id) || null;
// 받는 물건 이름(화면 · 알림)
export const EX_GIVE_NAME = { 'ticket:gear': '장비 뽑기권', 'ticket:weapon': '병기 뽑기권', 'ticket:pal': '동료 뽑기권', 'ticket:relic': '영물 뽑기권', 'ticket:time': '시간 티켓', 'ticket:exped': '원정권',
  'item:stone': '강화석', 'item:restore': '복구 주문서', 'item:shard': '뽑기 조각', 'item:heart': '심법 구슬' };
