// v451 비동기 대결(비무첩) — 다른 무인의 「대결 기록」(서열 문서의 pvp 칸)과 겨룬다. 상대는 그 기록대로 AI가 싸우고, 나는 직접 움직인다.
//
// 공정하게 — 양쪽의 실제 숫자(공격력·체력)를 그대로 부딪치면 직업·레벨마다 몇 초 만에 끝나거나 끝나지 않는다.
//   그래서 「나」를 기준으로 상대를 잰다(체력 비 · 화력 비). 나와 똑같은 상대면:
//   - 상대 체력 = 내 화력 추정 × PVP_HP_SEC 초 (내가 그만큼 쳐야 쓰러진다)
//   - 상대 평타 한 대 = 내 최대 체력 × PVP_BASIC · 상대 초식(피할 수 있는 바닥 경고) 한 번 = × PVP_SKILL
//   상대가 체력이 두 배면 두 배 오래 버티고, 화력이 두 배면 두 배 아프다(비는 RATIO_LO~RATIO_HI로 묶는다).
// 직접 조작 — 대결에서는 자동 다가가기·자동 무공·자동 피하기·물약이 없다. 조이스틱(또는 화면 찍기)으로 움직이고,
//   닿는 거리면 평타는 저절로 나간다. 무공은 단추로. 상대 초식은 바닥 경고가 깔린 뒤 터진다 — 비켜 서면 안 맞는다.
import { mobGold } from './wdata.js';

export const PVP_LV = 20;            // 열리는 레벨
export const PVP_PER_DAY = 5;        // 하루 도전 (한국 시간 자정에 다시)
export const PVP_SEC = 45;           // 한 판 (게임 초 · PACE 0.75면 실제 60초)
export const PVP_HP_SEC = 20;        // 나와 같은 상대를 쓰러뜨리는 데 드는 시간(내 화력 추정 기준)
export const PVP_BASIC = 0.03;       // 상대 평타 한 대 = 내 최대 체력의 몫
export const PVP_SKILL = 0.11;       // 상대 초식 한 번 = 내 최대 체력의 몫 (오의는 ×PVP_ULT)
export const PVP_ULT = 1.7;
export const PVP_CAST = 4.2;         // 상대 초식 사이(게임 초)
export const PVP_TELL = 1.15;        // 경고가 깔리고 터지기까지(게임 초) — 오의는 ×1.3
export const RATIO_LO = 0.25, RATIO_HI = 4;
export const PVP_HEAL = 0.25;       // 대결 중 회복(흡혈·재생·애완동물·무공)은 이만큼만 — 상대 기록에는 회복이 없다
export const PVP_STUN = 3;          // 상대는 기절·묶임에서 이만큼 빨리 풀린다(기절 무공으로 내내 묶지 못하게)
export const PVP_STUN_IMM = 2.5;    // 풀린 뒤 이만큼은 다시 기절하지 않는다
export const PVP_RED_MIN = 0.5;     // 받는 피해 감소는 합쳐 50%까지(금종·호신강기가 상대를 무력하게 만들지 않게)
export const PVP_FEAR_MAX = 0.15;   // 공포(극악소마·환마)로 상대 평타를 끊는 확률 상한
// 내 직업마다 받는 몫 — 돌진·밀치기가 많은 직업(권사·선객)은 상대가 덜 붙고, 체력을 쓰는 직업(검객)은 더 깎인다. 시뮬로 고르게(v451)
export const PVP_TAKE = { sword: 0.75, fist: 1.3, fan: 1.2, poison: 0.72, ring: 0.8 };
export const takeK = (job) => PVP_TAKE[job] || 1;
export const START = 1000;           // 처음 점수
export const ELO_K = 32;
export const LOG_MAX = 12;

// 직업마다 상대가 쓰는 초식 — 피하는 법이 다르다(평소 둘 · 세 번째마다 오의)
export const JOB_PATS = {
  sword: { list: ['line', 'charge'], ult: 'cross', how: '찌르기 — 옆으로 비켜요' },
  fist: { list: ['nova', 'cone'], ult: 'ring3', how: '둘레 치기 — 멀어지거나 고리 틈으로' },
  fan: { list: ['star', 'cone'], ult: 'xcross', how: '부채꼴·세 갈래 — 갈래 사이로' },
  poison: { list: ['aim', 'chase'], ult: 'rain', how: '발밑 독 — 계속 움직여요' },
  ring: { list: ['chase', 'aim'], ult: 'cage', how: '쫓는 고리 — 빈 틈으로' },
};
const JOB_NAME = { sword: '검객', fist: '권사', fan: '선객', poison: '독객', ring: '소마' };
const JOB_LOOK = {
  sword: { robe: '#1e3a8a', trim: '#93c5fd', head: 'topknot', weapon: 'sword' },
  fist: { robe: '#7c2d12', trim: '#fdba74', head: 'band', band: '#7c2d12', weapon: 'fist' },
  fan: { robe: '#0f766e', trim: '#99f6e4', head: 'topknot', weapon: 'fan' },
  poison: { robe: '#365314', trim: '#bef264', head: 'hood', weapon: 'claw' },
  ring: { robe: '#581c87', trim: '#d8b4fe', head: 'mask', weapon: 'dagger' },
};
const NPC_TAG = ['떠돌이', '낭인', '무명', '외팔이', '흑의'];

export const clampR = (r) => Math.max(RATIO_LO, Math.min(RATIO_HI, Number.isFinite(r) && r > 0 ? r : 1));
// 화력 추정 — 양쪽이 같은 셈을 쓴다(실제 싸움에서 무공을 잘 쓰면 그만큼 앞선다)
//   (게임의 두목 체력 셈 heroDpsEst의 기본식과 같다 — 전직 차수·무공 배수만큼 무공 몫)
//   + 직업·레벨마다 실제로 잰 몫(DPS_K — 같은 무인이 허수아비를 60초 칠 때 실제 초당 피해 ÷ 기본식, v451 시뮬)
export const DPS_LV = [25, 50, 80, 110, 140];
export const DPS_K = {
  sword: [0.46, 0.61, 0.76, 0.95, 1.12],
  fist: [0.36, 0.54, 0.5, 0.67, 0.88],
  fan: [0.49, 0.63, 0.64, 0.73, 0.95],
  poison: [1.04, 0.99, 1.18, 1.33, 1.51],
  ring: [0.87, 0.91, 1.56, 2.31, 2.68],
};
export function dpsK(job, lv) {
  const k = DPS_K[job]; if (!k) return 1;
  if (lv <= DPS_LV[0]) return k[0];
  for (let i = 1; i < DPS_LV.length; i++) if (lv <= DPS_LV[i]) { const f = (lv - DPS_LV[i - 1]) / (DPS_LV[i] - DPS_LV[i - 1]); return k[i - 1] + (k[i] - k[i - 1]) * f; }
  return k[k.length - 1];
}
export const dpsEst = (st, tier = 0, job = null, lv = 0) => (st.atk / Math.max(0.3, st.atkSec || 1)) * (1 + (st.crit || 0) * ((st.critDmg || 1.5) - 1)) * (2.5 + (tier || 0) * 0.8) * (st.skillMult || 1) * (job ? dpsK(job, lv) : 1);
export const eloWin = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
export function eloDelta(me, opp, win) {
  const e = eloWin(me, opp);
  return Math.round(ELO_K * ((win ? 1 : 0) - e));
}
// 이긴 판 보상 · 진 판은 조금(나간 것은 없음)
export const winReward = (lv) => ({ gold: Math.round(mobGold(lv) * 220), petShard: 6, mountShard: 6 });
export const loseReward = (lv) => ({ gold: Math.round(mobGold(lv) * 40) });

// 대결 기록 → 상대 한 명 (모자라거나 이상한 값은 고친다)
export function oppOf(raw, uid = null, score = START) {
  let o = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const n = Number(o.hp), d = Number(o.dps);
  if (!(n > 0) || !(d > 0) || !JOB_PATS[o.j]) return null;
  return {
    uid, npc: !!o.npc, n: String(o.n || '무명').slice(0, 12), j: o.j, t: Math.max(0, Math.min(9, o.t | 0)), lv: Math.max(1, Math.min(300, o.lv | 0)),
    tn: String(o.tn || '').slice(0, 24), sk: String(o.sk || '').slice(0, 12), hp: n, dps: d, pw: Math.max(0, Number(o.pw) || 0),
    lk: o.lk && typeof o.lk === 'object' ? o.lk : null, sc: Math.max(0, Math.round(Number(score) || START)),
  };
}
// 오프라인이거나 겨룰 사람이 모자라면 — 내 기록을 바탕으로 떠돌이 무인(약하게·비슷하게·세게)
export function npcOpps(me, seed = 0) {
  const jobs = Object.keys(JOB_PATS);
  return [0.8, 1, 1.25].map((k, i) => {
    const j = jobs[(seed + i * 2) % jobs.length];
    return oppOf({ npc: 1, n: `${NPC_TAG[(seed + i) % NPC_TAG.length]} ${JOB_NAME[j]}`, j, t: me.t, lv: me.lv, tn: '', sk: '', hp: me.hp * k, dps: me.dps * k, pw: me.pw * k,
      lk: { look: { ...JOB_LOOK[j] } } }, `npc${i}`, Math.round((me.sc || START) + (k - 1) * 300));
  });
}
// 서열에서 고른 상대 셋 — 전투력이 가까운 사람부터: 조금 약한 · 비슷한 · 조금 센 (모자라면 떠돌이 무인으로 채운다)
export function pickOpps(me, rows, seed = 0) {
  const near = (o) => Math.abs(Math.log(Math.max(1, o.pw) / Math.max(1, me.pw)));
  const pool = rows.filter((o) => o && o.uid && o.pw > 0).sort((a, b) => near(a) - near(b)).slice(0, 9);
  const out = [];
  const take = (f) => { const i = pool.findIndex(f); if (i >= 0) out.push(...pool.splice(i, 1)); };
  take((o) => o.pw < me.pw * 0.97);
  take(() => true);
  take((o) => o.pw > me.pw * 1.03);
  while (out.length < 3 && pool.length) out.push(pool.shift());
  const npc = npcOpps(me, seed);
  for (let i = 0; out.length < 3; i++) out.push(npc[i]);
  return out.sort((a, b) => a.pw - b.pw);
}
// 대결 판 — 비무대(지역 그림은 내 레벨 쪽)
export function pvpMap(z, art, opp) {
  return { id: -3, inst: true, name: `비무대 · ${opp.n}`, zoneName: '비무대', zone: z, mz: z, area: 0, art,
    lv: [opp.lv, opp.lv], mobs: [], boss: { name: opp.n, look: lookOf(opp) }, scene: 'trial', bossFirst: true, pvp: true };
}
export function lookOf(opp) {
  const L = opp.lk?.look ? { ...opp.lk.look } : { ...JOB_LOOK[opp.j] };
  if (opp.lk?.opts?.weapon && !L.weapon) L.weapon = opp.lk.opts.weapon;
  return L;
}
