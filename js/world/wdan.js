// v457 영약 — 내공을 따로 쌓는다.
//   네 갈래: 환단(丸丹 · 연단으로 빚은 알약) · 신과(神果 · 열매) · 영초(靈草 · 약초) · 석유·광물(石乳 · 땅의 정수)
//   신과·영초·석유는 그 땅의 졸개·두목 · 탑 · 던전 · 칠대성에서 **운으로** 얻는다(DAN_SRC).
//   환단은 **연단**(RECIPES)으로 만든다 — 드문 재료를 모으고, 실패하면 재료를 잃는다(실패할 때마다 그 단약 성공률 +5%, 30%까지).
//     몇 가지(소환단 · 흑혈신단 · 대환단)는 두목이 아주 가끔 떨군다.
//   먹으면 운기조식 몇 시간어치 내공 — qiMedHour(먹는 때의 레벨) × hours. 독초(지옥화·혈안초)는 그대로 못 먹고 연단에만.
//   마교 단약은 마기(魔氣) — 그동안 받는 피해 +MAKI_TAKE. 설련·천년련·백화단은 마기를 씻는다. 대환단은 체력을 다 채운다.
import { qiMedHour, mobGold, REGIONS } from './wdata.js';

export const DAN_CATS = [
  { id: 'pill', name: '환단', hanja: '丸丹', desc: '연단으로 빚은 알약 — 재료를 모아 만든다(실패하면 재료를 잃는다)' },
  { id: 'fruit', name: '신과', hanja: '神果', desc: '영지에서 홀로 자란 열매 — 운으로 얻는다' },
  { id: 'herb', name: '영초', hanja: '靈草', desc: '영기를 먹고 묵은 약초 — 운으로 얻는다' },
  { id: 'ore', name: '석유·광물', hanja: '石乳', desc: '땅의 정수가 굳은 것 — 운으로 얻는다' },
];
export const MAKI_TAKE = 0.2;   // 마기 — 받는 피해 +20%

// hours = 운기조식 몇 시간어치 · raw:false = 그대로 못 먹는다(연단에만) · maki = 마기(실제 초) · cleanse = 마기를 씻는다 · heal = 체력을 다 채운다
export const DANS = [
  // 영초
  { id: 'seollyeon', cat: 'herb', name: '설련', hanja: '雪蓮', hours: 4, col: '#e0f2fe', cleanse: true, desc: '마음을 맑게 하여 주화입마를 막고 내공의 불순물을 걷어 낸다(마기를 씻는다)' },
  { id: 'cheonnyeon', cat: 'herb', name: '천년련', hanja: '千年蓮', hours: 8, col: '#fbcfe8', cleanse: true, desc: '천 년 묵은 연 — 심신을 가라앉히고 내공을 맑게 한다(마기를 씻는다)' },
  { id: 'jiokhwa', cat: 'herb', name: '지옥화', hanja: '地獄花', hours: 24, raw: false, col: '#f87171', desc: '독문·마도의 독초 — 그대로 먹으면 해롭다. 제독(연단)하면 마공의 바탕' },
  { id: 'hyeolan', cat: 'herb', name: '혈안초', hanja: '血眼草', hours: 24, raw: false, col: '#ef4444', desc: '핏빛 눈을 단 독초 — 연단으로만 쓴다' },
  { id: 'haso', cat: 'herb', name: '만년하수오', hanja: '萬年何首烏', hours: 72, col: '#a3e635', desc: '머리를 검게 하고 뼈를 바꾼다(환골탈태)' },
  { id: 'seolsam', cat: 'herb', name: '만년설삼', hanja: '萬年雪蔘', hours: 72, col: '#f8fafc', desc: '설산에서 수만 년 자란 삼 — 음유하고 순수한 공력' },
  // 신과
  { id: 'jugwa', cat: 'fruit', name: '주과', hanja: '朱果', hours: 10, col: '#fb923c', desc: '붉은 과실 — 먹자마자 전신에 열기가 돈다. 영약의 기초' },
  { id: 'geumryeong', cat: 'fruit', name: '금령지과', hanja: '金鈴之菓', hours: 60, col: '#facc15', desc: '금빛 종 모양 열매 — 몸을 바꾸고 내공을 키운다' },
  { id: 'deunggwa', cat: 'fruit', name: '만년등과', hanja: '萬年藤菓', hours: 150, col: '#86efac', desc: '넝쿨에서 맺힌 전설의 열매 — 수 갑자의 내공' },
  { id: 'binghwa', cat: 'fruit', name: '빙화과', hanja: '氷火菓', hours: 200, col: '#c4b5fd', desc: '극양과 극음을 함께 품은 과일 — 두 기운을 고르게 삼키면 무시무시한 공력' },
  // 석유·광물
  { id: 'jongnyeong', cat: 'ore', name: '종령석유', hanja: '鍾靈石乳', hours: 24, col: '#e5e7eb', desc: '종유석 틈에서 모인 젖빛 물' },
  { id: 'bingjeong', cat: 'ore', name: '만년빙정', hanja: '萬年氷晶', hours: 36, col: '#bae6fd', desc: '만년설 한가운데의 얼음 결정 — 마음의 불을 가라앉힌다' },
  { id: 'jiyeol', cat: 'ore', name: '지열신수', hanja: '地熱神水', hours: 36, col: '#fca5a5', desc: '극양의 땅에서 흐르는 물 — 음기를 몰아내고 양기를 채운다' },
  { id: 'gongcheong', cat: 'ore', name: '공청석유', hanja: '空靑石乳', hours: 48, col: '#f5f5f4', desc: '수천 년에 한 방울씩 모인 우윳빛 물 — 막힌 혈도를 뚫는다' },
  // 환단 — 연단(RECIPES)으로
  { id: 'sohwan', cat: 'pill', sect: '소림', name: '소환단', hanja: '小還丹', hours: 24, col: '#fde68a', desc: '대환단의 아래 — 공력을 더하고 가벼운 내상을 다스린다' },
  { id: 'baekhwa', cat: 'pill', sect: '무당', name: '백화단', hanja: '百花丹', hours: 32, col: '#fbcfe8', cleanse: true, desc: '기혈을 돌리고 심신을 가라앉힌다(마기를 씻는다)' },
  { id: 'cheongun', cat: 'pill', sect: '점창', name: '청운단', hanja: '靑雲丹', hours: 40, col: '#93c5fd', desc: '점창의 심법과 맞는 비전 단약' },
  { id: 'jaso', cat: 'pill', sect: '무당', name: '자소단', hanja: '紫霄丹', hours: 54, col: '#d8b4fe', desc: '기혈을 돌리고 공력을 더한다' },
  { id: 'jaha', cat: 'pill', sect: '화산', name: '자하단', hanja: '紫霞丹', hours: 66, col: '#c084fc', desc: '화산의 정수 — 내공을 맑게 거르고 키운다' },
  { id: 'gwiwon', cat: 'pill', sect: '공동', name: '귀원단', hanja: '歸元丹', hours: 78, col: '#a5b4fc', desc: '흩어진 기운을 근원으로 되돌린다' },
  { id: 'taecheong', cat: 'pill', sect: '곤륜', name: '태청단', hanja: '太淸丹', hours: 108, col: '#bae6fd', desc: '정신을 맑게 하고 도가의 기운을 북돋운다' },
  { id: 'jeokha', cat: 'pill', sect: '아미', name: '적하단', hanja: '赤霞丹', hours: 116, col: '#fca5a5', desc: '아미의 비전 — 붉은 노을의 기운' },
  { id: 'yongho', cat: 'pill', sect: '곤륜', name: '용호단', hanja: '龍虎丹', hours: 160, col: '#fcd34d', desc: '용과 범 — 음양을 한 몸에 모은다' },
  { id: 'heukhyeol', cat: 'pill', sect: '마교', name: '흑혈신단', hanja: '黑血神丹', hours: 160, col: '#991b1b', maki: 7200, desc: '단숨에 마공과 공력을 얻는다 — 마기가 두 시간 남는다(받는 피해 +20%)' },
  { id: 'daehwan', cat: 'pill', sect: '소림', name: '대환단', hanja: '大還丹', hours: 520, col: '#fbbf24', heal: true, desc: '영약의 대명사 — 일 갑자의 공력 · 모든 상처를 낫게 한다(체력을 다 채운다)' },
  { id: 'taecheongsin', cat: 'pill', sect: '무당', name: '태청신단', hanja: '太淸神丹', hours: 520, col: '#e0f2fe', desc: '무당 최고의 영약 — 순수한 도가의 공력' },
  { id: 'maehwa', cat: 'pill', sect: '화산', name: '매화신단', hanja: '梅花神丹', hours: 520, col: '#f9a8d4', desc: '화산의 정수를 담은 신단' },
  { id: 'cheonma', cat: 'pill', sect: '마교', name: '천마단', hanja: '天魔丹', hours: 860, col: '#7f1d1d', maki: 21600, desc: '폭발적인 마공 — 마기가 여섯 시간 남는다(받는 피해 +20%)' },
];
export const DAN_IDS = DANS.map((d) => d.id);
export const danOf = (id) => DANS.find((d) => d.id === id) || null;
export const danQi = (id, L) => (danOf(id)?.hours || 0) * qiMedHour(L);
export const canEat = (id) => !!danOf(id) && danOf(id).raw !== false;

// 연단 — need: 재료 · p: 성공률 · 은자는 레벨에 맞춰(danGold). 실패하면 재료를 잃고 그 단약 성공률 +PITY_STEP(PITY_MAX까지 · 성공하면 처음으로)
//   단약 하나 = 재료 운기 시간 ÷ 성공률 × 1.35 남짓 — 만들어 먹는 편이 그냥 먹기보다 낫다
export const RECIPES = {
  sohwan: { need: { seollyeon: 2, cheonnyeon: 1 }, p: 0.8 },
  baekhwa: { need: { cheonnyeon: 2, seollyeon: 1 }, p: 0.8 },
  cheongun: { need: { seollyeon: 3, jugwa: 1 }, p: 0.75 },
  jaso: { need: { jugwa: 2, cheonnyeon: 1 }, p: 0.7 },
  jaha: { need: { jugwa: 1, jongnyeong: 1 }, p: 0.7 },
  gwiwon: { need: { cheonnyeon: 2, jongnyeong: 1 }, p: 0.7 },
  taecheong: { need: { cheonnyeon: 2, bingjeong: 1 }, p: 0.65 },
  jeokha: { need: { jugwa: 2, jiyeol: 1 }, p: 0.65 },
  yongho: { need: { bingjeong: 1, jiyeol: 1 }, p: 0.6 },
  heukhyeol: { need: { hyeolan: 2, jiokhwa: 1 }, p: 0.6 },
  daehwan: { need: { sohwan: 3, haso: 1, gongcheong: 1 }, p: 0.5 },
  taecheongsin: { need: { jaso: 2, seolsam: 1, cheonnyeon: 2 }, p: 0.5 },
  maehwa: { need: { jaha: 2, geumryeong: 1 }, p: 0.5 },
  cheonma: { need: { heukhyeol: 1, jiokhwa: 2, hyeolan: 2 }, p: 0.4 },
};
export const PITY_STEP = 0.05, PITY_MAX = 0.3;
export const danGold = (id, L) => Math.round(mobGold(Math.max(1, L)) * 60 * Math.max(1, (danOf(id)?.hours || 0) / 10));
export const recipeHours = (id) => Object.entries(RECIPES[id]?.need || {}).reduce((a, [k, n]) => a + (danOf(k)?.hours || 0) * n, 0);

// 얻는 곳 — kind: mob(그 지역 졸개 · 한 마리마다) · boss(그 지역 두목 · 별채 두목 포함) · anyBoss(어느 지역 두목이든) · king(십이지왕 — region이 있으면 그 지역 심처의 왕)
//   master(고수) · daily(요일 던전 한 판 — kind) · wraid(칠대성 처치) · 그 밖(탑 십이지신 층 · 주간 상자 · 고수 첫 승)은 보상표에 박혀 있다
// v457 시뮬(pace/dan.mjs · 실제 1시간): 알맞은 레벨의 두목 방 운기 6~8시간어치 · 졸개 방 2~3시간어치(그 지역 졸개 영약이 있으면) — 운기조식 ×3(한 시간 3시간어치)과 비슷하게
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
  { id: 'sohwan', kind: 'anyBoss', p: 0.0005 }, { id: 'sohwan', kind: 'boss', region: 9, p: 0.0015 },
  { id: 'heukhyeol', kind: 'boss', region: 7, p: 0.00015 },
  { id: 'daehwan', kind: 'king', region: 9, p: 0.001 },
  { id: 'jugwa', kind: 'master', p: 0.003 }, { id: 'cheonnyeon', kind: 'master', p: 0.003 },
];
// 내 레벨보다 한참 낮은 곳은 덜 나온다 — 경험치처럼(5레벨 넘게 낮으면 1레벨마다 -8% · 10%까지). 높은 레벨이 낮은 두목 방을 돌며 쓸어 담지 않게
export const dropGapK = (myLv, mobLv) => { const gap = myLv - mobLv; return gap <= 5 ? 1 : Math.max(0.1, 1 - (gap - 5) * 0.08); };
// 보상표에 박힌 것 — 글로만(얻는 곳 보이기)
export const DAN_FIXED = { geumryeong: '무한의 탑 십이지신 층(층마다 하나)', gongcheong: '주간 상자 · 고수 첫 승', daehwan: '맹주·천마 첫 승' };
const pctTxt = (p) => (p >= 0.01 ? `${+(p * 100).toFixed(1)}%` : `${+(p * 100).toFixed(2)}%`);
export function danWhere(id) {
  const out = [];
  for (const s of DAN_SRC) {
    if (s.id !== id) continue;
    const rg = s.region ? REGIONS[s.region]?.name || '' : '';
    out.push(s.kind === 'mob' ? `${rg} 졸개 ${pctTxt(s.p)}` : s.kind === 'boss' ? `${rg} 두목 ${pctTxt(s.p)}` : s.kind === 'anyBoss' ? `지역 두목 ${pctTxt(s.p)}`
      : s.kind === 'king' ? `${rg ? `${rg} 심처의 ` : ''}십이지왕 ${pctTxt(s.p)}` : s.kind === 'master' ? `고수 ${pctTxt(s.p)}` : s.kind === 'daily' ? `요일 던전 천공광맥 ${pctTxt(s.p)}` : s.kind === 'wraid' ? `칠대성 ${pctTxt(s.p)}` : '');
  }
  if (DAN_FIXED[id]) out.push(DAN_FIXED[id]);
  if (RECIPES[id]) out.push('연단');
  return out.filter(Boolean).join(' · ');
}
