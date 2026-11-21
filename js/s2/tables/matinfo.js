// v631 장비 재료 안내 — 강화 · 성혼 · 복구 · 부옵션 바꾸기 · 분해에 쓰는 것과 얻는 곳(엔진 표에서 숫자를 그대로 가져온다).
//   name · icon(art/s2/ui/<icon>.webp) · use(어디에 쓰나) · src: [{ t: 얻는 곳, d: 한 줄, go: 창 열쇠('content:0' 같은) }]
import { DAILY_DUNGEONS, DAILY_RUNS, TOWER_MS } from './content.js';
import { dismantle, SHARD_PER_TICKET } from './gearstat.js';
import { SHOP } from './shop.js';
import { EXCHANGE, EX_CUR } from './exchange.js';
import { BOUNTY_REW } from './bounty.js';
import { CB_REPEAT, CB_RAID } from './chboss.js';
import { ATTEND } from './attend.js';
import { PASS_REWARDS } from './pass.js';
import { DAILY_MISSIONS } from './missions.js';

const dayOf = (k) => ATTEND.map((r, i) => (r && r[k] ? i : 0)).filter(Boolean);
const passHas = (k) => PASS_REWARDS.some((r) => r && r[k]);
const shopStone = SHOP.find((s) => s.id === 'stone');
const dis = (i) => dismantle(i)[0].n, stoneBox = (DAILY_DUNGEONS.stone || {}).reward?.stones || 0;
const starMis = DAILY_MISSIONS.find((m) => m.items && m.items['item:restore']);
const rsDays = dayOf('item:restore');
// v635 교환소 — 그 재료를 파는 진열대(재화 이름 · 값 · 주간 한도)
const exOf = (k) => Object.entries(EXCHANGE).flatMap(([c, L]) => L.filter((x) => x.give[k]).map((x) => ({ t: `교환소 · ${EX_CUR[c].name}`, d: `${EX_CUR[c].name} ${x.price}에 ${x.give[k]}${k === 'item:restore' ? '장' : '개'} · 주 ${x.limit}번`, go: 'shop:1' })));
const bountyStone = BOUNTY_REW.extra.find((x) => x.k === 'item:stone')?.n || [0, 0];
const raidStone = (CB_RAID.starRew || []).reduce((a, r) => a + (r['item:stone'] || 0), 0);

export const MATS = {
  gold: { name: '은자', icon: 'silver', use: '강화 · 성혼에 써요', src: [
    { t: '사냥', d: '몹을 잡을수록 쌓여요 · 칸이 높을수록 많이', go: 'content:3' },
    { t: '수련동 은자굴', d: `하루 ${DAILY_RUNS}번 · Lv ${DAILY_DUNGEONS.gold?.unlockLv || 20}부터`, go: 'content:0' },
    { t: '원정', d: '보내 두면 시간만큼', go: 'content:2' },
    { t: '일일 · 주간 임무', d: '끝내면 사냥 몇 분 몫', go: 'mission:1' },
    { t: '출석', d: '날마다 한 번', go: 'attend:0' },
    ...(passHas('goldMin') ? [{ t: '강호 패스', d: '단마다', go: 'pass:0' }] : []),
    { t: '오늘 할 일 상자', d: '할 일을 다 하면', go: 'today:0' },
  ] },
  'item:stone': { name: '강화석', icon: 'stone', use: '장비 강화 · 부옵션 바꾸기에 써요', src: [
    { t: '장비 분해', d: `가방에서 분해 · 등급마다 ${dis(0)}~${dis(6)}개`, go: 'gear:3' },
    { t: '수련동 단련동', d: `한 번에 ${stoneBox}개 · Lv ${DAILY_DUNGEONS.stone?.unlockLv || 30}부터`, go: 'content:0' },
    { t: '장 두목 다시 깨기', d: `장마다 하루 한 번 ${CB_REPEAT.stones}개`, go: 'content:3' },
    { t: '토벌', d: `이기면 ${CB_RAID.stones}개 · 별 상자 ${raidStone}개`, go: 'raid:0' },
    { t: '무한 탑 이정표', d: `${TOWER_MS.every}층마다 상자`, go: 'content:1' },
    { t: '동행 토벌', d: '단계를 깨면', go: 'party:0' },
    { t: '상점', d: `${shopStone?.name || '강화석 꾸러미'} ${shopStone?.give['item:stone'] || 0}개 · 하루 ${shopStone?.limit || 0}번`, go: 'shop:0' },
    { t: '현상수배', d: `덤으로 ${bountyStone[0]}~${bountyStone[1]}개`, go: 'bounty:0' },
    { t: '업적', d: '단계마다', go: 'ach:0' },
    { t: '출석', d: '여러 날에', go: 'attend:0' },
    ...(passHas('item:stone') ? [{ t: '강호 패스', d: '단마다', go: 'pass:0' }] : []),
    { t: '기연', d: '강화석 카드를 고르면', go: 'content:3' },
  ] },
  'item:restore': { name: '복구 주문서', icon: 'reset', use: '파괴된 칸을 되살려요(성혼)', src: [
    ...(starMis ? [{ t: '일일 임무', d: `성혼 ${starMis.need}번 하면 ${starMis.items['item:restore']}장`, go: 'mission:1' }] : []),
    ...(rsDays.length ? [{ t: '출석', d: `${rsDays.join(' · ')}일째`, go: 'attend:0' }] : []),
    ...exOf('item:restore'),
  ] },
  'item:shard': { name: '뽑기 조각', icon: 'shard', use: `${SHARD_PER_TICKET}개 = 장비 뽑기권 1장`, src: [
    { t: '장비 분해', d: `하나에 1~${dismantle(6)[1].n}개(등급이 높을수록)`, go: 'gear:3' },
    ...exOf('item:shard'),
  ] },
};
export const MAT_KEYS = Object.keys(MATS);
