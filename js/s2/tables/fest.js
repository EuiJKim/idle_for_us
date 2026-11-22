// v636 강호 축제 — 날짜(한국 시각 dayKey)만으로 도는 축제 달력. 21일 한 칸: 앞 14일 축제(사냥 물건 · 임무 · 두목) · 뒤 7일 쉬는 주(교환소만 · 다음 축제 기다림)
//   네 축제가 차례로 돈다(84일 한 바퀴) · 축제 물건은 그 칸이 끝나면(다음 축제가 열리면) 사라진다.
//   주말(토 · 일, 한국 시각)은 「강호 대란」 — 사냥 축제 물건 +20%(축제 때) · 사냥 은자 +10%(언제나).
//   보상은 작게 — 교환소를 다 사도 장비 뽑기권 12 · 병기 · 동료 · 영물 뽑기권 1씩 · 강화석 160 · 시간 티켓 1 · 원정권 2(3주에 · 다 사려면 축제 14일을 거의 다 놀아야 한다).
import { QuestBook } from '../core/quest.js';
import { CHBOSS } from './chboss.js';

export const FEST = {
  epoch: 20773,          // 첫 축제가 열린 날(dayKey · 2026-11-16 월요일)
  len: 21, on: 14,       // 한 칸 21일 중 앞 14일이 축제
  dropPer: 40,           // 사냥 몹 40마리(정예 5 · 두목 20마리 몫)마다 축제 물건 하나
  dayCap: 60,            // 사냥으로 얻는 축제 물건은 하루 60개까지
  wkDrop: 200,           // 주말 대란 — 축제 물건 +20%(‰)
  wkGold: 100,           // 주말 대란 — 사냥 은자 +10%(‰)
};
// 축제 넷 — 물건 이름 · 글자(HUD · 그림이 안 뜰 때) · 그림(art/s2/ui/<pic>.webp) · 빛깔 · 두목(ch장 두목이 축제에 다시 나온다)
export const FESTS = [
  { id: 'lantern', name: '등불 축제', short: '등불', item: '연등', gly: '燈', pic: 'lantern', col: '#fbbf24', bossTitle: '등불 밤거리에 돌아온 가면 노름꾼', ch: 7 },
  { id: 'dragon', name: '단오 용선제', short: '단오', item: '쑥떡', gly: '粽', pic: 'wboss', col: '#4ade80', bossTitle: '용선을 막아서는 장강의 주인', ch: 6 },
  { id: 'moon', name: '중추 월병제', short: '중추', item: '월병', gly: '月', pic: 'moon', col: '#fde68a', bossTitle: '보름달 아래 내려온 검선', ch: 9 },
  { id: 'tourney', name: '무림대회', short: '대회', item: '대회패', gly: '武', pic: 'medal', col: '#f87171', bossTitle: '대회 마지막 자리를 지키는 자', ch: 15 },
];
for (const f of FESTS) f.boss = CHBOSS[f.ch].name;   // 두목은 그 장 두목(그림 · 무늬 · 이름) — 축제마다 다른 얼굴
const DAY = 24 * 3600e3, KST = 9 * 3600e3;
const mod = (a, n) => ((a % n) + n) % n;
export const festSlot = (dk) => Math.floor((dk - FEST.epoch) / FEST.len);
// 그날의 축제 칸 — { slot, fest, day(칸 안 몇째 날 0~20), on(축제 중), endDk(축제 끝나는 날 · 그날 자정 전까지), nextDk(다음 축제 첫날) }
export function festAt(dk) {
  const slot = festSlot(dk), start = FEST.epoch + slot * FEST.len, day = dk - start;
  return { slot, fest: FESTS[mod(slot, FESTS.length)], day, on: day < FEST.on, startDk: start, endDk: start + FEST.on, nextDk: start + FEST.len, next: FESTS[mod(slot + 1, FESTS.length)] };
}
export const dkMs = (dk) => dk * DAY - KST;   // 그 dayKey가 시작되는 때(한국 시각 자정)
// 주말 대란 — 토(dayKey % 7 === 2) · 일(=== 3)
export const festWeekend = (dk) => { const w = mod(dk, 7); return w === 2 || w === 3; };

// 축제 두목 — 하루 한 번 · 60초 · 쓰러지지 않음 · 넣은 피해 = 점수. 등급은 기준 무인 60초 피해와의 비(r)로
export const FEST_BOSS = { ms: 60000, grades: [
  { g: 'C', r: 0, fc: 10 }, { g: 'B', r: 1, fc: 15 }, { g: 'A', r: 2, fc: 20 }, { g: 'S', r: 3.5, fc: 25 }, { g: 'SS', r: 6, fc: 30, tix: 1 },
] };
export const festGrade = (r) => { let G = FEST_BOSS.grades[0]; for (const x of FEST_BOSS.grades) if (r >= x.r) G = x; return G; };

// 축제 임무 — 날마다(자정에 새로) · 축제 내내. ev는 엔진 사건(game.emit)과 축제 안 사건(fboss 두목 도전 · fget 사냥으로 얻은 축제 물건)
//   보상 fc = 축제 물건
export const FEST_DAILY = [
  { id: 'fd1', ev: 'kill', add: 'n', need: 300, rew: { fc: 8 }, label: '몹 300마리 잡기' },
  { id: 'fd2', ev: 'dungeon', cond: 'kind == 1', need: 2, rew: { fc: 6 }, label: '수련동 2번 깨기' },
  { id: 'fd3', ev: 'fboss', need: 1, rew: { fc: 6 }, label: '축제 두목 도전' },
  { id: 'fd4', ev: 'gacha', add: 'n', need: 10, rew: { fc: 5 }, label: '장비 뽑기 10번' },
  { id: 'fd5', ev: 'pvp', need: 2, rew: { fc: 5 }, label: '대결 2번' },
];
export const FEST_TOTAL = [
  { id: 'ft1', ev: 'fday', need: 7, rew: { fc: 30, 'ticket:exped': 1 }, label: '축제 동안 7일 접속' },
  { id: 'ft2', ev: 'fboss', need: 7, rew: { fc: 40, 'ticket:gear': 2 }, label: '축제 두목 7번 도전' },
  { id: 'ft3', ev: 'kill', add: 'n', need: 10000, rew: { fc: 40, 'item:stone': 20 }, label: '몹 10,000마리 잡기' },
  { id: 'ft4', ev: 'fget', add: 'n', need: 500, rew: { fc: 30, 'ticket:gear': 1 }, label: '사냥으로 축제 물건 500개' },
  { id: 'ft5', ev: 'dungeon', cond: 'kind == 1', need: 20, rew: { fc: 30 }, label: '수련동 20번 깨기' },
];
export const festBooks = (F) => ({ fd: new QuestBook(FEST_DAILY, F.qd), ft: new QuestBook(FEST_TOTAL, F.qt) });

// 축제 교환소 — 축제 한 칸(21일) 동안 살 수 있는 수 · 값은 축제 물건
export const FEST_SHOP = [
  { id: 'gear', give: { 'ticket:gear': 1 }, cost: 45, limit: 12 },
  { id: 'stone', give: { 'item:stone': 20 }, cost: 30, limit: 8 },
  { id: 'weapon', give: { 'ticket:weapon': 1 }, cost: 150, limit: 1 },
  { id: 'pal', give: { 'ticket:pal': 1 }, cost: 150, limit: 1 },
  { id: 'relic', give: { 'ticket:relic': 1 }, cost: 150, limit: 1 },
  { id: 'time', give: { 'ticket:time': 1 }, cost: 180, limit: 1 },
  { id: 'exped', give: { 'ticket:exped': 1 }, cost: 70, limit: 2 },
];
export const festShopById = (id) => FEST_SHOP.find((s) => s.id === id) || null;
