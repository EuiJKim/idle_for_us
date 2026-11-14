// 새 시즌(S0~) 시험 — js/s2 엔진·표. 계획서 docs/새시즌_계획.md의 합격선을 단계마다 여기에 더한다.
import fs from 'node:fs';
import { Rng } from '../js/s2/core/rng.js';
import { P, mulP, ofP, layers, finalStat, pct, lerpTable } from '../js/s2/core/fixed.js';
import { GameClock, TICK_MS } from '../js/s2/core/clock.js';
import * as PR from '../js/s2/tables/progress.js';
import * as EX from '../js/s2/tables/exp.js';
import * as GE from '../js/s2/tables/gear.js';
import * as ST from '../js/s2/tables/star.js';
import * as OP from '../js/s2/tables/option.js';
import * as EC from '../js/s2/tables/economy.js';
import { calc, toRpn } from '../js/s2/core/expr.js';
import * as CO from '../js/s2/core/cost.js';
import { defineReward, rollReward, pityLeft } from '../js/s2/core/reward.js';
import { defineContent, isOpen, whyLocked } from '../js/s2/core/unlock.js';
import { QuestBook } from '../js/s2/core/quest.js';
import * as SS from '../js/s2/core/stats.js';
import * as SV from '../js/s2/core/save.js';
import * as FL from '../js/s2/core/flags.js';
import { tableHash, TABLE_VER } from '../js/s2/tables/version.js';
import * as DM from '../js/s2/battle/damage.js';
import * as CH from '../js/s2/tables/char.js';
import { refPlayer, makeMob, SKILL_BASE, SKILL_MAIN } from '../js/s2/battle/ref.js';
import { RoomFight, simpleRoom, replay } from '../js/s2/battle/room.js';

let fail = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK ' : '✗✗ '} ${m}${d ? `  — ${d}` : ''}`); if (!c) fail++; };

console.log('\n=== S0 결정론 난수 ===');
{
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const sa = Array.from({ length: 50 }, () => a.u32()), sb = Array.from({ length: 50 }, () => b.u32()), sc = Array.from({ length: 50 }, () => c.u32());
  ok(sa.join() === sb.join(), '같은 씨앗 → 같은 수열');
  ok(sa.join() !== sc.join(), '다른 씨앗 → 다른 수열');
  const r = new Rng(7); for (let i = 0; i < 100; i++) r.u32();
  const saved = r.state(); const next = Array.from({ length: 20 }, () => r.u32());
  const back = new Rng(saved); ok(next.join() === Array.from({ length: 20 }, () => back.u32()).join(), '상태 네 칸을 저장했다 되살리면 이어서 같은 수');
  const g = new Rng(1); let lo = Infinity, hi = -Infinity; const cnt = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) { const v = g.int(10); lo = Math.min(lo, v); hi = Math.max(hi, v); cnt[v]++; }
  ok(lo === 0 && hi === 9, 'int(10)은 0~9', `${lo}~${hi}`);
  ok(cnt.every((n) => Math.abs(n - 10000) < 500), 'int(10) 고르게(각 10000±500)', cnt.join(','));
  const h = new Rng(2); let yes = 0; for (let i = 0; i < 100000; i++) yes += h.roll(250);
  ok(Math.abs(yes - 25000) < 800, 'roll(250) ≈ 25%', yes);
  ok(new Rng(3).roll(0) === false && new Rng(3).roll(1000) === true, 'roll 끝값(0 → 거짓 · 1000 → 참)');
  const k = new Rng(4); const pc = [0, 0, 0]; for (let i = 0; i < 60000; i++) pc[k.pick([1, 2, 3])]++;
  ok(Math.abs(pc[0] - 10000) < 600 && Math.abs(pc[2] - 30000) < 900, 'pick 가중치 1:2:3', pc.join(','));
}

console.log('\n=== S0 퍼밀 계산 ===');
{
  ok(P === 1000 && mulP(1000, 250) === 1250 && ofP(2000, 125) === 250, 'mulP · ofP');
  ok(layers(1000, [100, 100]) === 1210 && layers(1000, [200]) === 1200, '층끼리 곱하기(10%+10% 두 층 = 21%, 한 층 20%)');
  ok(finalStat(100, 50, 200) === 180, '최종 = (기본+더하기) × (1+곱하기)');
  ok(pct(125) === '12.5%' && pct(1000) === '100%', '퍼밀 → % 글자');
  ok(lerpTable([{ at: 1, v: 0 }, { at: 11, v: 100 }], 6, 'v') === 50, '표 사이 직선 보간');
}

console.log('\n=== S0 게임 시계 ===');
{
  const c = new GameClock(); let n = c.feed(16.7) + c.feed(16.7) + c.feed(16.7);
  ok(n === 1, '50ms 틱 — 16.7ms 세 번이면 1틱', n);
  ok(new GameClock().feed(10000) === 40, '한 번에 최대 40틱(멈췄다 돌아와도 폭주 없음)');
  const t = new GameClock(); t.tick(); t.tick(); ok(t.ms === 2 * TICK_MS && Number.isInteger(t.ms), '시계는 ms 정수');
}

console.log('\n=== S0 숫자 초안 표 ===');
{
  // 진행 목표
  const pr = PR.PROGRESS;
  ok(pr.every((r, i) => i === 0 || (r.day > pr[i - 1].day && r.lv[0] >= pr[i - 1].lv[1])), '진행 목표: 날짜·레벨이 앞으로만');
  ok(pr.find((r) => r.day === 1).lv.join('~') === '55~65' && pr.find((r) => r.day === 7).lv[0] === 100 && pr.at(-1).lv[0] === PR.LEVEL_MAX, '1일 55~65 · 7일 100 · 1년 만렙');
  // 경험치
  const e = (L) => EX.expToNext(L);
  ok(Array.from({ length: PR.LEVEL_MAX - 2 }, (_, i) => i + 2).every((L) => e(L) > e(L - 1)), '경험치: 레벨마다 늘어남');
  ok(e(100) / e(99) < 3.5 && e(104) / e(103) < 1.4 && e(105) / e(104) < 1.15, '100에서 벽이 갑자기 서지 않음(100~104 서서히)', `${(e(100) / e(99)).toFixed(2)} · ${(e(104) / e(103)).toFixed(2)}`);
  const pre = EX.cumExp(100) - EX.cumExp(1), post = EX.cumExp(150) - EX.cumExp(100);
  ok(post > pre * 30, '100 이후가 그 전보다 훨씬 무거움(1~100의 30배 넘게)', `${(post / pre).toFixed(0)}배`);
  // 장비 뽑기
  const ws = Array.from({ length: GE.GACHA_LV_MAX }, (_, i) => GE.gachaWeights(i + 1));
  ok(ws.every((w) => w.reduce((a, b) => a + b, 0) === 1000 && w.every((x) => x >= 0)), '장비 뽑기: 모든 레벨 확률 합 100%');
  ok(ws.every((w, i) => i === 0 || w.slice(3).reduce((a, b) => a + b, 0) >= ws[i - 1].slice(3).reduce((a, b) => a + b, 0)), '뽑기 레벨이 오르면 진품 이상 확률이 줄지 않음');
  ok(ws[19][6] === 3 && ws[0][6] === 0, '천품은 20레벨에서만 0.3%');
  ok(GE.SUBOPT_COUNT_P.reduce((a, b) => a + b, 0) === 1000, '부옵션 줄 수 확률 합 100%');
  ok(GE.gachaWaitMin(GE.GACHA_LV_MAX) <= 24 * 60 && GE.SLOTS.length === 10 && GE.GRADES.length === 7, '뽑기 대기 최대 24시간 · 10부위 · 등급 7');
  // 성혼
  let good = true, why = '';
  for (let s = 0; s < ST.STAR_MAX; s++) {
    const o = ST.starOdds(s);
    if (o.ok + o.down + o.brk > 1000 || o.ok <= 0) { good = false; why = `${s}성 합 넘침`; }
    if (s < ST.DOWN_FROM && o.down) { good = false; why = `${s}성 하락`; }
    if (s < ST.BREAK_FROM && o.brk) { good = false; why = `${s}성 파괴`; }
  }
  ok(good, '성혼: 확률 합 ≤ 100% · 11성 전 하락 없음 · 15성 전 파괴 없음', why);
  ok(ST.starOdds(0).ok === 950 && ST.starOdds(15).brk === 20 && ST.starOdds(24).ok === 200, '성혼 끝값(0성 95% · 15성 파괴 2% · 24성 20%)');
  // 무작위 옵션 · 뽑기
  ok([0, 5, 10].every((m) => OP.optWeights(m).reduce((a, b) => a + b, 0) === 1000), '무작위 옵션: 숙련 0·5·10 확률 합 100%');
  ok(OP.optWeights(10)[3] > OP.optWeights(0)[3], '굴림 숙련이 오르면 전설 확률 ↑');
  ok(OP.PULL_P.reduce((a, b) => a + b, 0) === 1000 && OP.PULL_PITY === 200, '동료·병기·영물 뽑기 합 100% · 천장 200');
  // 경제
  ok(Math.abs(Object.values(EC.GOLD_SINK_SHARE).reduce((a, b) => a + b, 0) - 1) < 1e-9, '은자 소비 몫 합 100%');
  ok(EC.OFFLINE_CAP_H === 12 && EC.OFFLINE_WEEK_CAP_H === 84, '오프라인 12시간 · 주간 84시간');
}


console.log('\n=== S1 계산식 ===');
{
  const v = { lv: 30, kills: 7, job: 2, boss: 1 };
  const c = (e) => calc(e, (n) => v[n] ?? 0);
  ok(c('1 + 2 * 3') === 7 && c('(1 + 2) * 3') === 9 && c('2 ^ 3 ^ 2') === 512, '우선순위 · 괄호 · 거듭제곱은 오른쪽부터');
  ok(c('7 / 2') === 3 && c('7 % 4') === 3 && c('5 / 0') === 0, '정수 나눗셈 · 나머지 · 0으로 나누면 0');
  ok(c('lv >= 30 && kills > 5') === 1 && c('lv < 10 || job == 3') === 0, '비교 · 그리고 · 또는 · 이름(변수)');
  ok(c('job in [1, 2, 3]') === 1 && c('job in [4, 5]') === 0, '포함(in) 목록');
  ok(c('-kills + 10') === 3 && c('!boss') === 0, '단항 빼기 · 아님');
  ok(c('kills * (1 + boss)') === 14, '사건 값으로 진행 수 계산(두목이면 두 배)');
  let threw = 0; for (const bad of ['(1 + 2', '1 +', '1 $ 2']) { try { calc(bad, () => 0); } catch { threw++; } }
  ok(threw === 3, '틀린 식은 오류(괄호 · 덜 쓴 식 · 모르는 글자)');
  ok(toRpn('a + b').length === 3, '역폴란드 표기로 바꿈');
}

console.log('\n=== S1 비용 ===');
{
  const w = { gold: 1000, 'item:stone': 3 };
  ok(CO.canPay(w, [{ k: 'gold', n: 500 }, { k: 'item:stone', n: 3 }]), '낼 수 있음');
  const sf = CO.shortfall(w, [{ k: 'gold', n: 1500 }, { k: 'item:scroll', n: 1 }]);
  ok(sf.length === 2 && sf[0].need === 1500 && sf[0].have === 1000, '모자란 것 목록(얻는 곳 바로가기용)');
  ok(!CO.pay(w, [{ k: 'gold', n: 2000 }]) && w.gold === 1000, '모자라면 아무것도 안 뺌');
  ok(CO.pay(w, [{ k: 'gold', n: 300 }, { k: 'gold', n: 200 }]) && w.gold === 500, '같은 종류는 합쳐서 냄');
  ok(CO.merge([{ k: 'gold', n: 1 }], { k: 'gold', n: 2 }, null)[0].n === 3 && CO.scale([{ k: 'gold', n: 10 }], 1.5)[0].n === 15, '합치기 · 배율');
}

console.log('\n=== S1 보상 ===');
{
  defineReward('t_all', { roll: 'all', items: [{ k: 'gold', n: 100 }, { k: 'item:a', n: 1, p: 500 }] });
  defineReward('t_one', { roll: 'one', items: [{ k: 'g:low', n: 1, p: 9 }, { k: 'g:high', n: 1, p: 1 }], pity: { need: 50, item: { k: 'g:high', n: 1 } } });
  defineReward('t_dupe', { roll: 'all', items: [{ k: 'costume:x', n: 1 }], dupe: { 'costume:x': { max: 1, to: { k: 'gold', n: 77 } } } });
  const r = new Rng(9);
  let a = 0; for (let i = 0; i < 2000; i++) { const g = rollReward('t_all', r); a += g.find((x) => x.k === 'item:a')?.n || 0; if (!g.find((x) => x.k === 'gold')) a = -1e9; }
  ok(Math.abs(a - 1000) < 100, "'all': 확정 줄은 늘 · 확률 줄은 그만큼", a);
  const st = {}; let maxGap = 0, gap = 0;
  for (let i = 0; i < 3000; i++) { const g = rollReward('t_one', r, st); gap++; if (g.some((x) => x.k === 'g:high')) { maxGap = Math.max(maxGap, gap); gap = 0; } }
  ok(maxGap <= 50, '천장: 50번 안에 반드시 한 번', maxGap);
  ok(pityLeft('t_one', st) <= 50, '천장 남은 횟수(게이지)');
  const d1 = rollReward('t_dupe', r, {}, () => 0), d2 = rollReward('t_dupe', r, {}, () => 1);
  ok(d1[0].k === 'costume:x' && d2[0].k === 'gold' && d2[0].n === 77, '중복 대체: 이미 가진 건 다른 보상으로');
  const r1 = new Rng(5), r2 = new Rng(5);
  ok(JSON.stringify(Array.from({ length: 30 }, () => rollReward('t_one', r1))) === JSON.stringify(Array.from({ length: 30 }, () => rollReward('t_one', r2))), '같은 씨앗이면 같은 보상(결정론)');
}

console.log('\n=== S1 열림 조건 · 진행 조건 ===');
{
  defineContent('t_gacha', { lv: 10, clear: 'r1-3' });
  defineContent('t_pvp', { lv: 50, job: 2, seasonDay: 3, expr: 'power >= 1000' });
  const ctx = { lv: 12, job: 1, cleared: new Set(['r1-3']), seasonDay: 1, vars: (n) => ({ power: 500 })[n] };
  ok(isOpen('t_gacha', ctx) && !isOpen('t_pvp', ctx), '조건 모두 맞아야 열림');
  ok(whyLocked('t_pvp', ctx).map((w) => w.k).join() === 'lv,job,seasonDay,expr', '잠긴 까닭을 모두 알려 줌(화면 안내용)');
  const qb = new QuestBook([
    { id: 'kill100', ev: 'kill', add: 'n', need: 100, reward: 'r_k' },
    { id: 'boss3', ev: 'kill', cond: 'boss', need: 3, reward: 'r_b' },
    { id: 'lv20', ev: 'level', cond: 'lv >= 20', need: 1 },
  ]);
  for (let i = 0; i < 9; i++) qb.on('kill', { n: 10, boss: 0 });
  ok(qb.get('kill100').p === 90 && !qb.get('kill100').done, '진행 수 = 식(n)으로 올림');
  qb.on('kill', { n: 10, boss: 1 }); qb.on('kill', { n: 1, boss: 1 }); const fin = qb.on('kill', { n: 1, boss: 1 });
  ok(qb.get('kill100').done && fin.includes('boss3'), '조건 식(boss)으로 거르기 · 끝나면 알림');
  ok(qb.on('level', { lv: 19 }).length === 0 && qb.on('level', { lv: 20 })[0] === 'lv20', '레벨 조건');
  ok(qb.claim('kill100') === 'r_k' && qb.claim('kill100') === null, '받기는 한 번만');
  qb.reset(['kill100']); ok(qb.get('kill100').p === 0 && !qb.get('kill100').got, '일일 초기화');
}

console.log('\n=== S1 스탯 체계 ===');
{
  ok(Object.keys(SS.STATS).length >= 40, '스탯 40개 넘음(오행 약점·강인 포함)', Object.keys(SS.STATS).length);
  const t = SS.sumStats([{ src: '기본', stats: { atk: 1000, hp: 5000 } }, { src: '장비', stats: { atk: 200, atkP: 100, atkL1: 100 } }, { src: '경지', stats: { atkL2: 100 } }]);
  const f = SS.finalize(t);
  ok(f.atk === 1320, '최종 공격 = (1000+200) × (1+10%)', f.atk);
  ok(Math.abs(SS.layerMul(t, ['atkL1', 'atkL2']) - 1.21) < 1e-9, '공격%① 10% × 공격%② 10% = 1.21배(층끼리 곱)');
  ok(SS.LAYERS.every((l) => SS.LAYER_OWNER[l]), '층마다 주인 시스템이 정해져 있다(§D3)');
  let threw = false; try { SS.sumStats([{ stats: { nope: 1 } }]); } catch { threw = true; }
  ok(threw, '없는 스탯 이름은 오류');
}

console.log('\n=== S1 세이브 서명 · 표 판 · 차단 깃발 ===');
{
  const body = { lv: 12, gold: 3400, gear: [{ g: 2, s: 'weapon' }] };
  const txt = SV.pack(body, 1700000000000);
  const u = SV.unpack(txt);
  ok(u.ok && u.tableOk && u.body.gold === 3400, '쓰고 읽으면 서명 맞음 · 표 판 같음');
  const forged = txt.replace('"gold":3400', '"gold":9999999');
  ok(forged !== txt && SV.unpack(forged).ok === false, '손으로 은자를 고치면 서명이 안 맞음');
  ok(SV.canon({ b: 1, a: [2, { d: 1, c: 2 }] }) === SV.canon({ a: [2, { c: 2, d: 1 }], b: 1 }), '키 순서가 달라도 같은 글자(기기마다 같음)');
  ok(SV.unpack('나쁜 글자').ok === false && SV.SAVE_KEY.startsWith('ifu.s2.'), '깨진 글자 · 새 시즌 열쇠는 옛 세이브와 다름');
  ok(/^[0-9a-f]{8}$/.test(tableHash()) && TABLE_VER === 's2-0.1', '표 해시 · 판 번호', tableHash());
  FL.setFlags({ off: ['pvp', 'gacha', 'nope'], msg: '점검 중' });
  ok(FL.blocked('pvp') && FL.blocked('gacha') && !FL.blocked('nope') && !FL.blocked('guild') && FL.blockedMsg() === '점검 중', '차단 깃발(모르는 이름은 무시)');
  FL.setFlags(null); ok(FL.blockedList().length === 0, '서버를 못 읽으면 모두 열림');
}


console.log('\n=== S2 데미지 본체(§E) ===');
{
  const A = { lv: 50, st: { atk: 10000 } }, D = { lv: 50, st: { def: 0 } };
  const base = DM.expected(A, D, { coef: 1000, base: true });
  const two = DM.expected({ lv: 50, st: { atk: 10000, atkL1: 100, atkL2: 100 } }, D, { coef: 1000, base: true });
  const one = DM.expected({ lv: 50, st: { atk: 10000, atkL1: 200 } }, D, { coef: 1000, base: true });
  ok(Math.abs(two / base - 1.21) < 1e-6 && Math.abs(one / base - 1.2) < 1e-6, '층: 공격%① 10% + 공격%② 10% = 1.21배 · 한 층 20% = 1.2배');
  const fin = DM.expected({ lv: 50, st: { atk: 10000, final1: 100, final2: 100, final3: 100, final4: 100, final5: 100 } }, D, { coef: 1000, base: true });
  ok(Math.abs(fin / base - Math.pow(1.1, 5)) < 1e-6, '최종 피해 다섯 층은 서로 곱(1.1⁵)');
  ok(Math.abs(DM.defMul(A, { lv: 50, st: { def: CH.defK(50) } }) - 0.5) < 1e-9, '방어 = 레벨 계수만큼이면 절반');
  ok(DM.defMul({ lv: 50, st: { pierce: 1000 } }, { lv: 50, st: { def: 99999 } }) === 1, '관통 100%면 방어 무시');
  ok(DM.elemP({ st: { weak_fire: 100 } }, { elem: 'fire', st: { tough_fire: 900 } }) === -500, '오행 하한 −50%');
  ok(DM.takenDownP([300, 300, 300, 300]) === 700 && DM.takenDownP([100, 50]) === 150, '받는 피해 감소: 앞의 3개 · 상한 70%');
  ok(CH.levelGapP(50, 60) === -200 && CH.levelGapP(50, 200) === -600 && CH.levelGapP(60, 50) === 0, '레벨 차: 1당 −2% · 최대 −60% · 낮은 몹엔 보너스 없음');
  ok(DM.hit({ lv: 1, st: { atk: 1 } }, { lv: 150, st: { def: 1e9, takenDownF: 1e9 } }, SKILL_BASE, new Rng(1)).dmg === 1, '최소 1');
  const sh = { lv: 50, st: { def: 0 }, shield: 1e9 };
  const hs = DM.hit(A, sh, SKILL_BASE, new Rng(1)); ok(hs.dmg === 0 && hs.absorbed > 0, '보호막이 먼저 막음');
  // 기대값 ≈ 실제 평균
  const r = new Rng(3); let sum = 0; const N = 20000;
  const A2 = { lv: 50, st: { atk: 10000, crit: 200, critDmg: 500 } }, D2 = { lv: 50, st: { def: 500 } };
  for (let i = 0; i < N; i++) sum += DM.hit(A2, D2, SKILL_BASE, r).dmg;
  const ex = DM.expected(A2, D2, SKILL_BASE);
  ok(Math.abs(sum / N / ex - 1) < 0.01, '기대 데미지 = 실제 평균(±1%)', `${(sum / N).toFixed(0)} vs ${ex.toFixed(0)}`);
  ok(CH.gapP(CH.GAP_EVADE, -50) === 0 && CH.gapP(CH.GAP_EVADE, 200) === 150 && CH.gapP(CH.GAP_CC, 1000) === 900, '격차표(회피 · 상태이상)');
}

console.log('\n=== S2 방 사냥 · 처치 시간 합격선(§J3) ===');
{
  const band = { mob: [0.9, 1.5], elite: [6, 10], boss: [36, 54] };
  const bad = [];
  for (const kind of ['mob', 'elite', 'boss']) for (const L of [5, 60, 120, 150]) for (const job of Object.keys(CH.JOBS)) {
    const f = new RoomFight(simpleRoom(L, { n: kind === 'mob' ? 8 : 1, kind, coolMs: 3000 }), refPlayer(L, job), 11).run(kind === 'boss' ? 300000 : 90000);
    const first = {}, ttk = [];
    for (const e of f.events) { if (e[0] === 'hit' && first[e[2]] == null) first[e[2]] = e[1]; if (e[0] === 'kill') ttk.push((e[1] - first[e[2]]) / 1000); }
    const avg = ttk.reduce((a, b) => a + b, 0) / Math.max(1, ttk.length);
    if (!(avg >= band[kind][0] && avg <= band[kind][1]) || (kind === 'boss' && f.deaths > 2)) bad.push(`${kind}/${L}/${job}:${avg.toFixed(2)}s 사망${f.deaths}`);
  }
  ok(bad.length === 0, '다섯 직업 × 레벨 4 × 몹 셋: 일반 0.9~1.5초 · 정예 6~10초 · 두목 36~54초(두목전 사망 2번 이하)', bad.slice(0, 4).join(' '));
  const m1 = makeMob(100, 'mob', 0), m3 = makeMob(100, 'mob', 2);
  ok(m3.st.hp / m1.st.hp > 2.4 && m3.st.hp / m1.st.hp < 2.6 && m3.st.atk > m1.st.atk, '몹 티어: 3티어 체력 2.5배 · 공격도 셈');
}

console.log('\n=== S2 결정론 · 입력 기록 재현(§L3) ===');
{
  const def = simpleRoom(80, { n: 6 });
  const a = new RoomFight(def, refPlayer(80, 'spear'), 99, { auto: false });
  for (let i = 0; i < 1200; i++) { if (i % 140 === 0) a.press('skill'); a.step(); }
  const b = replay(def, refPlayer(80, 'spear'), a.log, a.t, { auto: false });
  ok(a.log.actions.length > 5 && a.digest() === b.digest(), '수동 조작을 기록해 두면 같은 결과로 재현', `${a.digest()} / ${b.digest()}`);
  const c = new RoomFight(def, refPlayer(80, 'spear'), 100, { auto: false }).run(a.t);
  ok(c.digest() !== a.digest(), '씨앗이 다르면 결과도 다름');
  const x = new RoomFight(def, refPlayer(80, 'bow'), 5).run(60000), y = new RoomFight(def, refPlayer(80, 'bow'), 5).run(60000);
  ok(x.digest() === y.digest() && Number.isInteger(x.hero.x) && Number.isInteger(x.t), '자동 사냥도 결정론(위치·시간 정수)');
}

console.log('\n=== S0 규칙 ===');
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('../js/s2', import.meta.url).pathname);
  const code = (p) => fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 주석은 빼고
  const bad = files.filter((p) => /Math\.random|Date\.now|performance\.now/.test(code(p)));
  ok(bad.length === 0, 'js/s2 엔진은 Math.random·Date.now·performance.now를 쓰지 않는다(결정론)', bad.join(' '));
  const shipped = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8') + fs.readFileSync(new URL('../js/wmain.js', import.meta.url), 'utf8');
  ok(!/s2\//.test(shipped), '지금 게임은 아직 새 시즌 코드를 부르지 않는다(교체 전)');
  ok(/정한 것 \(2026-11-14\)/.test(fs.readFileSync(new URL('../docs/새시즌_계획.md', import.meta.url), 'utf8')), '계획서가 있다');
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail ? 1 : 0);
