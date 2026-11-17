// v532 장 두목 — 장(10칸)마다 마지막 칸(10 · 20 · … 150)의 두목. 칸 두목(b1~b15)과 다른 얼굴 · 전용 무대 · 국면 3단 · 무력화.
// 그림: art/s2/chb/chb{장}.webp (tools/s2art/chb.py → sunburst)
// 패턴 틀(CB_PATS) 중 둘~셋을 두목마다 고른다. 30% 아래(필살 국면)에서는 필살(ult)이 끼어든다.
export const CHBOSS = [
  null,
  { name: '녹림대왕', title: '죽림을 삼킨 산적왕', col: '#4ade80', pats: ['dash', 'slam'] },
  { name: '사왕', title: '모래를 부리는 서역의 왕', col: '#fbbf24', pats: ['barrage', 'slam', 'summon'] },
  { name: '설랑장군', title: '빙궁의 흰 늑대', col: '#7dd3fc', pats: ['dash', 'barrage'] },
  { name: '혈사마군', title: '피의 뱀을 부리는 자', col: '#f87171', pats: ['mark', 'dash', 'summon'] },
  { name: '금위대도독', title: '황궁을 지키는 황금 철벽', col: '#facc15', pats: ['slam', 'dash'] },
  { name: '수룡채주', title: '장강 열여덟 채의 주인', col: '#38bdf8', pats: ['slam', 'barrage', 'summon'] },
  { name: '귀면도왕', title: '야시장의 가면 쓴 노름꾼', col: '#fb7185', pats: ['mark', 'barrage'] },
  { name: '만수왕', title: '남만 밀림의 짐승 왕', col: '#a3e635', pats: ['dash', 'slam', 'summon'] },
  { name: '운중선', title: '구름 위의 검선', col: '#e0f2fe', pats: ['barrage', 'mark'] },
  { name: '철익응', title: '절벽을 나는 쇠날개', col: '#d6d3d1', pats: ['dash', 'mark', 'barrage'] },
  { name: '마교 좌호법', title: '검은 불꽃의 낫', col: '#c084fc', pats: ['slam', 'mark', 'summon'] },
  { name: '독모', title: '독곡의 어머니', col: '#86efac', pats: ['barrage', 'summon', 'mark'] },
  { name: '화산 검마', title: '꺾인 매화', col: '#f9a8d4', pats: ['dash', 'barrage', 'mark'] },
  { name: '염마', title: '용암에서 깨어난 거인', col: '#fb923c', pats: ['slam', 'dash', 'summon'] },
  { name: '천외천주', title: '하늘 밖의 하늘', col: '#fde68a', pats: ['mark', 'barrage', 'slam', 'dash'] },
];
// 패턴 틀 — shape: line(두목에서 무인 쪽으로 곧게) · circle(두목 둘레) · target(무인 자리) · summon(졸개) · ult(화면 전체 — 안전 지대만 피함)
//   art: 예고 · 터짐 그림(ui/look.js BOSS_ART 열쇠) · x: 두목 공격의 몇 배 · move: 터질 때 두목이 범위 끝으로 돌진
export const CB_PATS = {
  dash: { id: 'dash', name: '돌진', shape: 'line', w: 7000, tellMs: 1000, x: 2.0, move: true, art: 'petal' },
  slam: { id: 'slam', name: '내려찍기', shape: 'circle', w: 3600, tellMs: 1200, x: 2.4, art: 'taiji' },
  barrage: { id: 'barrage', name: '탄막', shape: 'line', w: 9000, tellMs: 900, x: 1.5, art: 'orb' },
  mark: { id: 'mark', name: '표적', shape: 'target', w: 2000, tellMs: 1300, x: 2.8, art: 'eye' },
  summon: { id: 'summon', name: '졸개 부르기', shape: 'summon', w: 2400, tellMs: 900, x: 0, n: 3, art: 'orb' },
  ult: { id: 'ult', name: '필살', shape: 'ult', w: 0, tellMs: 2600, x: 6, safe: 2800, art: 'eye' },
};
export const CB = {
  hpX: 1.5,            // 두목 체력 — 일반 두목 ×1.5(칸 두목은 ×0.5) · 막대 세 줄
  bars: 3,
  limitMs: 150000,     // 150초
  phase: [0.7, 0.3],   // 이 체력 아래로 내려가면 분노 · 필살 국면
  patEveryX: [1, 0.7, 0.55],   // 국면마다 패턴 간격 배율
  ultEveryMs: 12000,   // 필살 국면에서 필살 간격
  ggPerHit: 55,        // 무공 한 번 맞을 때마다 무력화 게이지(1000이면 기절)
  stunMs: 5000,        // 기절 — 공격 · 패턴 멈춤 · 받는 피해 ×2
  stunDmgX: 2,
  arena: { w: 12000, tiers: 1 },
};
// 첫 처치 보상 — 그 장 확정 장비 하나(등급: 1~3장 정 · 4~6 진 · 7~9 보 · 10~15 신) + 칭호 · 다시 깨면 강화석 · 뽑기권(장마다 하루 한 번)
export const cbGearGrade = (ch) => Math.min(5, 2 + Math.floor((ch - 1) / 3));
export const CB_REPEAT = { stones: 60, tix: 5 };
// v555 두목 도감 — 토벌 ★3 두목 수가 5 · 10 · 15가 되면 한 번씩(장비 뽑기권 · 칭호)
export const DEX_REW = [{ n: 5, tix: 10 }, { n: 10, tix: 20 }, { n: 15, tix: 30, title: '두목 도감 완성' }];
// v541 장 두목 토벌 — 깬 장 두목을 다시 친다(지금 칸 강함으로 · 하루 2번 함께 씀). 빨리 깨면 별(★1 깸 · ★2 100초 안 · ★3 60초 안 · 안 쓰러짐)
//   보상: 처치 은자 · 경험치(사냥과 같은 셈) + 뽑기권 · 강화석 조금(60일 곡선을 흔들지 않게 — 하루 강화석 +20 정도)
//   별 보상(두목마다 단계마다 한 번): ★1 뽑기권 5 · ★2 강화석 30 · ★3 뽑기권 10
export const CB_RAID = { perDay: 2, tix: 2, stones: 10, starMs: [100000, 60000],
  starRew: [{ 'ticket:gear': 5 }, { 'item:stone': 30 }, { 'ticket:gear': 10 }] };
export const raidStars = (win, ms, deaths) => !win ? 0 : 1 + (ms <= CB_RAID.starMs[0] ? 1 : 0) + (ms <= CB_RAID.starMs[1] && !deaths ? 1 : 0);
// v535 월드보스(실제 싸움) — 쓰러지지 않는 거대 두목 · 90초. 30초마다 방어 자세(20초 · 받는 피해 ×0.6) → 약점 노출(10초 · ×1.8) — 평균 ×1이라 점수표(구간표)는 그대로.
//   sideX: 옆보기 싸움(움직이고 피함)에서 넣은 피해를 점수표가 기대는 기준 피해(방 사냥 계산)에 맞추는 배율(tools/s2sim 봇으로 맞춤)
export const WBF = { name: '혈해마룡왕', title: '피바다에서 깨어난 마룡', col: '#f87171', pats: ['slam', 'barrage', 'mark', 'dash', 'summon'], cycleMs: 30000, guardMs: 20000, guardX: 0.6, weakX: 1.8, sideX: 1 };
