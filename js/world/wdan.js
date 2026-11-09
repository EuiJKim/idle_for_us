// v457 영약 — 내공을 따로 쌓는다.
// v461 영약 개편 — 품계 다섯(하품 → 신품)으로 위아래를 또렷하게 · 약재(졸개 약초 · 두목 내단) · 영약 뽑기 · 연단 사다리 · 같은 영약은 두 번째부터 ¼.
//   품계마다 「값이 멈추는 레벨」(cap)이 있다 — 하품은 레벨 40, 중품 70, 상품 100, 극품 130에서 더 크지 않다. 그래서 초반엔 작은 영약도 쏠쏠하고,
//     나중엔 큰 영약 하나가 낫다. 품계보다 한참 이른 레벨(lo 아래)에 먹으면 몸이 다 못 받아들여 EARLY_K만.
//   같은 영약을 또 먹으면 REPEAT_K(¼)만 — 같은 것을 거듭 먹기보다 뽑고 빚어 새 영약을 먹는 쪽으로.
//   얻는 길: 사냥(그 땅 졸개가 운으로) · 두목(운으로 + 약재 내단) · 영약 뽑기(약초) · 연단(아래 품계 + 내단 → 위 품계) · 보상(탑·고수 첫 승·주간 상자).
//   신품(대환단 · 천마단)은 뽑기에 없다 — 극품을 빚어 올려야 한다.
//   마교 단약은 마기(魔氣) — 그동안 받는 피해 +MAKI_TAKE. 설련·천년련·백화단은 마기를 씻는다. 대환단은 체력을 다 채운다.
import { qiMedHour, mobGold, REGIONS } from './wdata.js';

export const DAN_CATS = [
  { id: 'pill', name: '환단', hanja: '丸丹', desc: '연단으로 빚은 알약 — 아래 품계 영약과 내단으로 만든다' },
  { id: 'fruit', name: '신과', hanja: '神果', desc: '영지에서 홀로 자란 열매' },
  { id: 'herb', name: '영초', hanja: '靈草', desc: '영기를 먹고 묵은 약초' },
  { id: 'ore', name: '석유·광물', hanja: '石乳', desc: '땅의 정수가 굳은 것' },
  { id: 'mat', name: '약재', hanja: '藥材', desc: '사냥에서 모은다 — 영약 뽑기와 연단의 재료' },
];
// 품계 — cap: 값이 멈추는 레벨 · lo: 이보다 이르면 몸이 다 못 받아들인다(EARLY_K)
export const DAN_TIERS = [
  { t: 1, name: '하품', hanja: '下品', col: '#a8a29e', cap: 40, lo: 1, desc: '초반의 길잡이 — 레벨 40부터는 더 크지 않다' },
  { t: 2, name: '중품', hanja: '中品', col: '#60a5fa', cap: 70, lo: 20, desc: '레벨 20부터 온전히 · 70부터는 더 크지 않다' },
  { t: 3, name: '상품', hanja: '上品', col: '#a78bfa', cap: 100, lo: 50, desc: '레벨 50부터 온전히 · 100부터는 더 크지 않다' },
  { t: 4, name: '극품', hanja: '極品', col: '#f59e0b', cap: 130, lo: 80, desc: '레벨 80부터 온전히 · 130부터는 더 크지 않다' },
  { t: 5, name: '신품', hanja: '神品', col: '#ef4444', cap: 999, lo: 110, desc: '레벨 110부터 온전히 — 끝까지 큰다 · 연단으로만' },
];
export const tierOf = (t) => DAN_TIERS[(t | 0) - 1] || null;
export const EARLY_K = 0.5, REPEAT_K = 0.25;
export const MAKI_TAKE = 0.2;   // 마기 — 받는 피해 +20%

// tier = 품계(0은 약재) · hours = 운기조식 몇 시간어치(품계의 cap 레벨까지 먹는 때의 레벨로) · raw:false = 그대로 못 먹는다(연단에만)
//   maki = 마기(실제 초) · cleanse = 마기를 씻는다 · heal = 체력을 다 채운다 · nogacha = 뽑기에 없다
export const DANS = [
  // 약재 — 사냥에서
  { id: 'yakcho', cat: 'mat', tier: 0, name: '약초', hanja: '藥草', hours: 0, raw: false, col: '#86efac', desc: '그 땅 졸개가 가끔 떨군다 — 영약 뽑기 · 하품 연단의 재료' },
  { id: 'naedan', cat: 'mat', tier: 0, name: '내단', hanja: '內丹', hours: 0, raw: false, col: '#fbbf24', desc: '두목의 몸에 맺힌 기운 덩어리 — 중품부터의 연단 재료' },
  // 하품
  { id: 'seollyeon', cat: 'herb', tier: 1, name: '설련', hanja: '雪蓮', hours: 4, col: '#e0f2fe', cleanse: true, desc: '마음을 맑게 하여 주화입마를 막는다(마기를 씻는다)' },
  { id: 'cheonnyeon', cat: 'herb', tier: 1, name: '천년련', hanja: '千年蓮', hours: 6, col: '#fbcfe8', cleanse: true, desc: '천 년 묵은 연 — 심신을 가라앉힌다(마기를 씻는다)' },
  { id: 'jugwa', cat: 'fruit', tier: 1, name: '주과', hanja: '朱果', hours: 8, col: '#fb923c', desc: '붉은 과실 — 먹자마자 전신에 열기가 돈다. 영약의 기초' },
  { id: 'jongnyeong', cat: 'ore', tier: 1, name: '종령석유', hanja: '鍾靈石乳', hours: 8, col: '#e5e7eb', desc: '종유석 틈에서 모인 젖빛 물' },
  { id: 'jiokhwa', cat: 'herb', tier: 1, name: '지옥화', hanja: '地獄花', hours: 0, raw: false, col: '#f87171', desc: '마도의 독초 — 그대로 먹으면 해롭다. 마교 단약의 바탕(연단에만)' },
  { id: 'hyeolan', cat: 'herb', tier: 1, name: '혈안초', hanja: '血眼草', hours: 0, raw: false, col: '#ef4444', desc: '핏빛 눈을 단 독초 — 연단으로만 쓴다' },
  { id: 'sohwan', cat: 'pill', tier: 1, sect: '소림', name: '소환단', hanja: '小還丹', hours: 12, col: '#fde68a', desc: '대환단의 아래 — 공력을 더하고 가벼운 내상을 다스린다' },
  { id: 'baekhwa', cat: 'pill', tier: 1, sect: '무당', name: '백화단', hanja: '百花丹', hours: 12, col: '#fbcfe8', cleanse: true, desc: '기혈을 돌리고 심신을 가라앉힌다(마기를 씻는다)' },
  { id: 'cheongun', cat: 'pill', tier: 1, sect: '점창', name: '청운단', hanja: '靑雲丹', hours: 14, col: '#93c5fd', desc: '점창의 심법과 맞는 비전 단약' },
  // 중품
  { id: 'bingjeong', cat: 'ore', tier: 2, name: '만년빙정', hanja: '萬年氷晶', hours: 30, col: '#bae6fd', desc: '만년설 한가운데의 얼음 결정 — 마음의 불을 가라앉힌다' },
  { id: 'jiyeol', cat: 'ore', tier: 2, name: '지열신수', hanja: '地熱神水', hours: 30, col: '#fca5a5', desc: '극양의 땅에서 흐르는 물 — 음기를 몰아내고 양기를 채운다' },
  { id: 'gongcheong', cat: 'ore', tier: 2, name: '공청석유', hanja: '空靑石乳', hours: 36, col: '#f5f5f4', desc: '수천 년에 한 방울씩 모인 우윳빛 물 — 막힌 혈도를 뚫는다' },
  { id: 'jaso', cat: 'pill', tier: 2, sect: '무당', name: '자소단', hanja: '紫霄丹', hours: 45, col: '#d8b4fe', desc: '기혈을 돌리고 공력을 더한다' },
  { id: 'jaha', cat: 'pill', tier: 2, sect: '화산', name: '자하단', hanja: '紫霞丹', hours: 54, col: '#c084fc', desc: '화산의 정수 — 내공을 맑게 거르고 키운다' },
  { id: 'gwiwon', cat: 'pill', tier: 2, sect: '공동', name: '귀원단', hanja: '歸元丹', hours: 48, col: '#a5b4fc', desc: '흩어진 기운을 근원으로 되돌린다' },
  // 상품
  { id: 'geumryeong', cat: 'fruit', tier: 3, name: '금령지과', hanja: '金鈴之菓', hours: 100, col: '#facc15', desc: '금빛 종 모양 열매 — 몸을 바꾸고 내공을 키운다' },
  { id: 'haso', cat: 'herb', tier: 3, name: '만년하수오', hanja: '萬年何首烏', hours: 110, col: '#a3e635', desc: '머리를 검게 하고 뼈를 바꾼다(환골탈태)' },
  { id: 'seolsam', cat: 'herb', tier: 3, name: '만년설삼', hanja: '萬年雪蔘', hours: 110, col: '#f8fafc', desc: '설산에서 수만 년 자란 삼 — 음유하고 순수한 공력' },
  { id: 'taecheong', cat: 'pill', tier: 3, sect: '곤륜', name: '태청단', hanja: '太淸丹', hours: 190, col: '#bae6fd', desc: '정신을 맑게 하고 도가의 기운을 북돋운다' },
  { id: 'jeokha', cat: 'pill', tier: 3, sect: '아미', name: '적하단', hanja: '赤霞丹', hours: 225, col: '#fca5a5', desc: '아미의 비전 — 붉은 노을의 기운' },
  { id: 'heukhyeol', cat: 'pill', tier: 3, sect: '마교', name: '흑혈신단', hanja: '黑血神丹', hours: 160, col: '#991b1b', maki: 7200, desc: '단숨에 마공과 공력을 얻는다 — 마기가 두 시간 남는다(받는 피해 +20%)' },
  // 극품
  { id: 'deunggwa', cat: 'fruit', tier: 4, name: '만년등과', hanja: '萬年藤菓', hours: 400, col: '#86efac', desc: '넝쿨에서 맺힌 전설의 열매 — 수 갑자의 내공' },
  { id: 'binghwa', cat: 'fruit', tier: 4, name: '빙화과', hanja: '氷火菓', hours: 450, col: '#c4b5fd', desc: '극양과 극음을 함께 품은 과일 — 두 기운을 고르게 삼키면 무시무시한 공력' },
  { id: 'yongho', cat: 'pill', tier: 4, sect: '곤륜', name: '용호단', hanja: '龍虎丹', hours: 960, col: '#fcd34d', desc: '용과 범 — 음양을 한 몸에 모은다' },
  { id: 'taecheongsin', cat: 'pill', tier: 4, sect: '무당', name: '태청신단', hanja: '太淸神丹', hours: 1100, col: '#e0f2fe', desc: '무당 최고의 영약 — 순수한 도가의 공력' },
  { id: 'maehwa', cat: 'pill', tier: 4, sect: '화산', name: '매화신단', hanja: '梅花神丹', hours: 1250, col: '#f9a8d4', desc: '화산의 정수를 담은 신단' },
  // 신품 — 연단으로만
  { id: 'daehwan', cat: 'pill', tier: 5, sect: '소림', name: '대환단', hanja: '大還丹', hours: 8000, col: '#fbbf24', heal: true, nogacha: true, desc: '영약의 대명사 — 일 갑자의 공력 · 모든 상처를 낫게 한다(체력을 다 채운다)' },
  { id: 'cheonma', cat: 'pill', tier: 5, sect: '마교', name: '천마단', hanja: '天魔丹', hours: 8500, col: '#7f1d1d', maki: 21600, nogacha: true, desc: '폭발적인 마공 — 마기가 여섯 시간 남는다(받는 피해 +20%)' },
];
export const DAN_IDS = DANS.map((d) => d.id);
export const MAT_IDS = DANS.filter((d) => d.cat === 'mat').map((d) => d.id);
export const danOf = (id) => DANS.find((d) => d.id === id) || null;
export const canEat = (id) => !!danOf(id) && danOf(id).raw !== false && danOf(id).cat !== 'mat';
// 한 알의 내공 — first: 처음 먹는 것(아니면 REPEAT_K) · 품계의 cap 레벨에서 멈춘다 · lo보다 이르면 EARLY_K
export function danQi(id, L, first = true) {
  const d = danOf(id), t = tierOf(d?.tier);
  if (!d || !t || !d.hours) return 0;
  return d.hours * qiMedHour(Math.min(L, t.cap)) * (L < t.lo ? EARLY_K : 1) * (first ? 1 : REPEAT_K);
}

// 연단 — need: 재료 · p: 성공률 · 은자는 레벨에 맞춰(danGold). 실패하면 재료를 잃고 그 단약 성공률 +PITY_STEP(PITY_MAX까지 · 성공하면 처음으로)
//   하품은 약초 + 하품 영초 · 중품부터는 아래 품계 영약 + 내단 — 한 품씩 빚어 올린다
//   빚은 것의 기대 내공(시간값 × 성공률)은 재료를 처음 먹는 것보다도 크다(×1.05 넘게) — 같은 영약이 남으면(¼) 빚는 편이 훨씬 낫다
export const RECIPES = {
  sohwan: { need: { yakcho: 20, seollyeon: 1 }, p: 0.9 },
  baekhwa: { need: { yakcho: 20, cheonnyeon: 1 }, p: 0.9 },
  cheongun: { need: { yakcho: 25, jugwa: 1 }, p: 0.85 },
  jaso: { need: { baekhwa: 2, cheonnyeon: 1, naedan: 2 }, p: 0.75 },
  jaha: { need: { cheongun: 2, jugwa: 1, naedan: 2 }, p: 0.75 },
  gwiwon: { need: { sohwan: 2, jongnyeong: 1, naedan: 2 }, p: 0.75 },
  taecheong: { need: { jaso: 1, bingjeong: 1, gongcheong: 1, naedan: 5 }, p: 0.65 },
  jeokha: { need: { jaha: 1, jiyeol: 1, gwiwon: 1, naedan: 5 }, p: 0.65 },
  heukhyeol: { need: { hyeolan: 3, jiokhwa: 2, gwiwon: 1, naedan: 5 }, p: 0.6 },
  yongho: { need: { taecheong: 1, jeokha: 1, bingjeong: 1, jiyeol: 1, naedan: 12 }, p: 0.55 },
  taecheongsin: { need: { taecheong: 2, seolsam: 1, naedan: 12 }, p: 0.5 },
  maehwa: { need: { jeokha: 2, geumryeong: 1, naedan: 12 }, p: 0.5 },
  daehwan: { need: { taecheongsin: 1, maehwa: 1, haso: 1, deunggwa: 1, naedan: 30 }, p: 0.4 },
  cheonma: { need: { heukhyeol: 3, binghwa: 1, yongho: 1, naedan: 30 }, p: 0.35 },
};
export const PITY_STEP = 0.05, PITY_MAX = 0.3;
export const danGold = (id, L) => Math.round(mobGold(Math.max(1, L)) * 60 * Math.max(1, (danOf(id)?.hours || 0) / 10) ** 0.6);   // v461 큰 단약은 시간값이 커서 ^0.6
export const recipeHours = (id) => Object.entries(RECIPES[id]?.need || {}).reduce((a, [k, n]) => a + (danOf(k)?.hours || 0) * n, 0);

// 약재 — 졸개는 약초(한 마리마다 YAK_P) · 두목은 약초 + 내단(1보다 작은 몫은 그 확률로 하나)
//   시뮬(pace/dan.mjs · 실제 1시간): 지역 두목 방은 두목이 한 시간에 85~120번 나와 내단 1개씩이면 100개 넘게 쌓였다 → 지역 두목은 반 확률
export const YAK_P = 0.05;
export const MAT_DROP = { zone: { yakcho: 2, naedan: 0.5 }, king: { yakcho: 6, naedan: 3 }, master: { yakcho: 5, naedan: 2 }, lord: { yakcho: 10, naedan: 5 } };

// 영약 뽑기 — 약초 GACHA_COST개에 한 번 · 하루 한 번 공짜 · 품계 확률 · GACHA_PITY번 안에 극품 · 10연엔 중품 이상 하나 · 신품은 없다
export const GACHA_COST = 30;
export const GACHA_RATES = [[1, 72], [2, 22], [3, 5], [4, 1]];   // [품계, 퍼센트]
export const GACHA_PITY = 100, GACHA_TEN = 2;
export const gachaPool = (t) => DANS.filter((d) => d.tier === t && d.cat !== 'mat' && !d.nogacha);

// 얻는 곳(운) — kind: mob(그 지역 졸개 · 한 마리마다) · boss(그 지역 두목 · 별채 두목 포함) · king(십이지왕) · master(고수)
//   daily(요일 던전 한 판 — kind) · wraid(칠대성 처치) · 그 밖(탑 십이지신 층 · 주간 상자 · 고수 첫 승)은 보상표에 박혀 있다
//   v461 환단의 운 떨굼(소환단 · 흑혈신단 · 대환단)은 뺐다 — 환단은 뽑기와 연단으로
export const DAN_SRC = [
  { id: 'seollyeon', kind: 'mob', region: 3, p: 0.0002 }, { id: 'seollyeon', kind: 'boss', region: 3, p: 0.0015 },
  { id: 'cheonnyeon', kind: 'mob', region: 11, p: 0.00015 }, { id: 'cheonnyeon', kind: 'mob', region: 9, p: 0.0001 },
  { id: 'jugwa', kind: 'mob', region: 12, p: 0.00012 }, { id: 'jugwa', kind: 'boss', region: 12, p: 0.0012 },
  { id: 'jiokhwa', kind: 'boss', region: 4, p: 0.0012 }, { id: 'jiokhwa', kind: 'boss', region: 7, p: 0.0006 },
  { id: 'hyeolan', kind: 'boss', region: 5, p: 0.0012 }, { id: 'hyeolan', kind: 'boss', region: 7, p: 0.0006 },
  { id: 'haso', kind: 'boss', region: 6, p: 0.0002 },
  { id: 'seolsam', kind: 'boss', region: 3, p: 0.0002 },
  { id: 'jongnyeong', kind: 'boss', region: 8, p: 0.0006 }, { id: 'jongnyeong', kind: 'daily', daily: 'mat', p: 0.1 },
  { id: 'bingjeong', kind: 'boss', region: 3, p: 0.00025 }, { id: 'bingjeong', kind: 'boss', region: 14, p: 0.0004 },
  { id: 'jiyeol', kind: 'boss', region: 2, p: 0.0004 }, { id: 'jiyeol', kind: 'boss', region: 4, p: 0.0002 },
  { id: 'gongcheong', kind: 'boss', region: 13, p: 0.0003 },
  { id: 'deunggwa', kind: 'king', p: 0.002 },
  { id: 'binghwa', kind: 'boss', region: 15, p: 0.0001 }, { id: 'binghwa', kind: 'wraid', p: 0.05 },
  { id: 'jugwa', kind: 'master', p: 0.003 }, { id: 'cheonnyeon', kind: 'master', p: 0.003 },
];
// 내 레벨보다 한참 낮은 곳은 덜 나온다 — 경험치처럼(5레벨 넘게 낮으면 1레벨마다 -8% · 10%까지). 높은 레벨이 낮은 두목 방을 돌며 쓸어 담지 않게
export const dropGapK = (myLv, mobLv) => { const gap = myLv - mobLv; return gap <= 5 ? 1 : Math.max(0.1, 1 - (gap - 5) * 0.08); };
// 보상표에 박힌 것 — 글로만(얻는 곳 보이기)
export const DAN_FIXED = { geumryeong: '무한의 탑 십이지신 층(층마다 하나)', gongcheong: '주간 상자 · 고수 첫 승', daehwan: '맹주·천마 첫 승' };
const pctTxt = (p) => (p >= 0.01 ? `${+(p * 100).toFixed(1)}%` : `${+(p * 100).toFixed(2)}%`);
// 얻는 길 다섯 — 화면은 이 갈래로 묶어 보인다
export const DAN_HOWS = [
  { id: 'hunt', name: '사냥', icon: '🌿', desc: '그 땅 졸개가 운으로' },
  { id: 'boss', name: '두목', icon: '👹', desc: '지역 두목 · 십이지왕 · 고수가 운으로(약재는 언제나)' },
  { id: 'gacha', name: '뽑기', icon: '🎲', desc: `약초 ${GACHA_COST}개에 한 번 · 하루 한 번 공짜` },
  { id: 'craft', name: '연단', icon: '🔥', desc: '아래 품계 영약 + 내단으로 빚는다' },
  { id: 'reward', name: '보상', icon: '🎁', desc: '탑 · 던전 · 칠대성 · 고수 첫 승 · 주간 상자' },
];
// [{ how, text }] — how는 DAN_HOWS의 id
export function danSources(id) {
  const d = danOf(id); if (!d) return [];
  const out = [];
  if (id === 'yakcho') out.push({ how: 'hunt', text: `사냥터 졸개 ${pctTxt(YAK_P)}` }, { how: 'boss', text: `두목 ${MAT_DROP.zone.yakcho}개 · 십이지왕 ${MAT_DROP.king.yakcho}개 · 고수 ${MAT_DROP.master.yakcho}개` });
  if (id === 'naedan') out.push({ how: 'boss', text: `지역 두목 ${MAT_DROP.zone.naedan < 1 ? `${pctTxt(MAT_DROP.zone.naedan)} 확률로 1개` : `${MAT_DROP.zone.naedan}개`} · 십이지왕 ${MAT_DROP.king.naedan}개 · 고수 ${MAT_DROP.master.naedan}개 · 맹주·천마 ${MAT_DROP.lord.naedan}개` });
  for (const s of DAN_SRC) {
    if (s.id !== id) continue;
    const rg = s.region ? REGIONS[s.region]?.name || '' : '';
    if (s.kind === 'mob') out.push({ how: 'hunt', text: `${rg} 졸개 ${pctTxt(s.p)}` });
    else if (s.kind === 'boss') out.push({ how: 'boss', text: `${rg} 두목 ${pctTxt(s.p)}` });
    else if (s.kind === 'king') out.push({ how: 'boss', text: `십이지왕 ${pctTxt(s.p)}` });
    else if (s.kind === 'master') out.push({ how: 'boss', text: `고수 ${pctTxt(s.p)}` });
    else if (s.kind === 'daily') out.push({ how: 'reward', text: `요일 던전 천공광맥 ${pctTxt(s.p)}` });
    else if (s.kind === 'wraid') out.push({ how: 'reward', text: `칠대성 ${pctTxt(s.p)}` });
  }
  if (d.cat !== 'mat' && !d.nogacha && d.tier) { const r = GACHA_RATES.find(([t]) => t === d.tier)?.[1] || 0; out.push({ how: 'gacha', text: `${tierOf(d.tier).name} ${r}% 가운데 ${gachaPool(d.tier).length}가지` }); }
  if (RECIPES[id]) out.push({ how: 'craft', text: Object.entries(RECIPES[id].need).map(([k, n]) => `${danOf(k).name} ${n}`).join(' + ') });
  if (DAN_FIXED[id]) out.push({ how: 'reward', text: DAN_FIXED[id] });
  return out;
}
export const danWhere = (id) => danSources(id).map((x) => x.text).join(' · ');
