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
import * as PS from '../js/s2/sim/progress.js';
import { Hero, newHero } from '../js/s2/hero/hero.js';
import * as SK from '../js/s2/tables/skills.js';
import * as GR from '../js/s2/gear/gear.js';
import * as GC from '../js/s2/gear/gacha.js';
import * as GS from '../js/s2/tables/gearstat.js';
import * as RL from '../js/s2/core/roller.js';
import { simGear } from '../js/s2/sim/econ.js';
import { simS5 } from '../js/s2/sim/s5.js';
import { heroAt, buildStd } from '../js/s2/sim/std.js';
import { STD } from '../js/s2/tables/std.js';
import * as CL from '../js/s2/grow/collect.js';
import * as RM from '../js/s2/grow/realm.js';
import * as S5T from '../js/s2/tables/s5.js';
import * as CT from '../js/s2/tables/content.js';
import { runDungeon, canSweep } from '../js/s2/content/dungeon.js';
import * as OF from '../js/s2/content/offline.js';
import * as MS from '../js/s2/tables/missions.js';
import * as ON from '../js/s2/tables/online.js';
import * as PW from '../js/s2/online/power.js';
import * as WB from '../js/s2/online/wboss.js';
import * as PV from '../js/s2/online/pvp.js';
import * as GU from '../js/s2/online/guild.js';
import * as RK from '../js/s2/online/rank.js';
import { Game, newGame, dayKey, weekKey } from '../js/s2/game.js';
import * as ID from '../js/s2/content/idle.js';

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
  ok(e(100) / e(99) < 1.8 && e(104) / e(103) < 1.6 && e(105) / e(104) < 1.15, '100에서 벽이 갑자기 서지 않음(100~104 서서히)', `${(e(100) / e(99)).toFixed(2)} · ${(e(104) / e(103)).toFixed(2)}`);
  const pre = EX.cumExp(100) - EX.cumExp(1), post = EX.cumExp(150) - EX.cumExp(100);
  ok(post > pre * 15, '100 이후가 그 전보다 훨씬 무거움(1~100의 15배 넘게)', `${(post / pre).toFixed(0)}배`);
  // 장비 뽑기
  const ws = Array.from({ length: GE.GACHA_LV_MAX }, (_, i) => GE.gachaWeights(i + 1));
  ok(ws.every((w) => w.reduce((a, b) => a + b, 0) === 1000 && w.every((x) => x >= 0)), '장비 뽑기: 모든 레벨 확률 합 100%');
  ok(ws.every((w, i) => i === 0 || w.slice(3).reduce((a, b) => a + b, 0) >= ws[i - 1].slice(3).reduce((a, b) => a + b, 0)), '뽑기 레벨이 오르면 진품 이상 확률이 줄지 않음');
  ok(ws[19][6] === 1 && ws[0][6] === 0, '천품은 20레벨에서만 0.1%');
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
  ok(/^[0-9a-f]{8}$/.test(tableHash()) && TABLE_VER === 's2-0.4', '표 해시 · 판 번호', tableHash());
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
  const near = (F) => F.mobs.reduce((b, m) => (!b || Math.hypot(m.x - F.hero.x, m.y - F.hero.y) < Math.hypot(b.x - F.hero.x, b.y - F.hero.y) ? m : b), null);
  for (let i = 0; i < 1200; i++) { if (i % 140 === 0) a.press('skill'); if (i % 40 === 0) { const m = near(a); if (m) a.press({ move: [m.x, m.y + 300] }); } a.step(); }
  const b = replay(def, refPlayer(80, 'spear'), a.log, a.t, { auto: false });
  ok(a.log.actions.length > 5 && a.digest() === b.digest(), '수동 조작을 기록해 두면 같은 결과로 재현', `${a.digest()} / ${b.digest()}`);
  const c = replay(def, refPlayer(80, 'spear'), { ...a.log, seed: 100 }, a.t, { auto: false });
  ok(c.digest() !== a.digest(), '씨앗이 다르면 결과도 다름');
  ok(a.kills > 0, '수동: 눌러 걸어가 싸운다', a.kills);
  const x = new RoomFight(def, refPlayer(80, 'bow'), 5).run(60000), y = new RoomFight(def, refPlayer(80, 'bow'), 5).run(60000);
  ok(x.digest() === y.digest() && Number.isInteger(x.hero.x) && Number.isInteger(x.t), '자동 사냥도 결정론(위치·시간 정수)');
}


console.log('\n=== S3 진행 시뮬 합격선(§J1) ===');
{
  const l30 = PS.levelAt30min();
  ok(l30 >= 13 && l30 <= 17, '30분 Lv13~17', l30.toFixed(1));
  const bad = [];
  for (const r of PR.PROGRESS.filter((x) => x.day >= 1)) {
    const b = PS.levelAtDay(r.day), f = PS.levelAtDay(r.day, 'full'), i = PS.levelAtDay(r.day, 'idle');
    if (b < r.lv[0] - 0.5 || b > r.lv[1] + 0.5) bad.push(`기준 ${r.day}일 Lv${b.toFixed(1)}`);
    if (f > b * PR.POLICY_BAND.full.max) bad.push(`꽉 채움 ${r.day}일 ${(f / b).toFixed(2)}배`);
    if (i < b * PR.POLICY_BAND.idle.min) bad.push(`방치만 ${r.day}일 ${(i / b).toFixed(2)}배`);
  }
  ok(bad.length === 0, '기준: 1일 55~65 · 7일 100 · 30일 112~115 · 90일 125~128 · 180일 137~140 · 1년 150 / 꽉 채움 1.3배 이내 · 방치만 0.6배 이상', bad.join(' '));
  // 표준 방에서 실제로 분당 몇 마리 잡나 — 곡선이 기대는 값(27)과 맞는지
  const kpm = Object.keys(CH.JOBS).map((job) => new RoomFight(simpleRoom(60, EX.STD_ROOM), refPlayer(60, job), 3).run(300000).kills / 5);
  ok(kpm.every((k) => Math.abs(k / EX.KILLS_PER_MIN - 1) < 0.15), '표준 방 분당 처치 ≈ 27(±15%) — 다섯 직업', kpm.map((k) => k.toFixed(1)).join(' '));
}

console.log('\n=== S3 무인 ===');
{
  const h = new Hero(newHero('bow'));
  ok(h.addExp(EX.cumExp(30)) === 29 && h.s.lv === 30, '경험치로 레벨업(1 → 30)');
  ok(h.s.pts.agi === 145 && h.ptsUsed() === h.ptsTotal(), '자동 찍기: 주 스탯(궁사=신법)에 전부');
  ok(h.s.skills.main === 1 && h.s.skills.inner === 1 && h.s.skills.guard === 1, '무공은 레벨이 되면 열림');
  ok(h.uniqTotal() === 2 && h.uniqUsed() === 2 && h.s.uniq.crit === 1, '고유 스탯 50점마다 1점 · 자동으로 고르게');
  const w = { gold: 1e6 };
  let ups = 0; while (h.skillUp('main', w)) ups++;
  ok(h.s.skills.main === SK.skillCap(30) && ups === SK.skillCap(30) - 1 && w.gold < 1e6, '무공 레벨업 — 무인 레벨에 따른 상한까지 · 은자 소모');
  ok(!h.canAdvance(), '전직: 던전을 안 깨면 못 함');
  h.clearDungeon('job1'); ok(h.advance() && h.s.adv === 1, '레벨 + 전직 던전 → 1차 전직');
  h.clearDungeon('job2'); ok(!h.advance(), '2차는 레벨 50부터');
  // 마스터리 대기 시간
  ok(h.learn('m1', 0, w) && !h.learn('m2', 0, w), '마스터리 하나씩 배움(배우는 중엔 다른 것 못 함)');
  ok(h.tickMastery(5 * 60000 - 50) === null && h.tickMastery(5 * 60000) === 'm1', '5분 지나야 끝남(ms 정수)');
  ok(h.learn('m2', 0, { gold: 1e6 }) && (h.rushMastery(10 * 60000), h.tickMastery(1) === 'm2'), '시간 티켓으로 당기기');
  ok(!h.canLearn('m4'), '선행 노드·레벨이 모자라면 못 배움');
  const st = h.stats();
  ok(st.final1 === 30 && st.atk > 0 && st.crit === 4, '스탯: 마스터리 → 최종 피해① · 고유 스탯 → 치명');
  // 맨몸 무인은 기준 무인(장비 몫 자리표시 포함)보다 약하고, 기본보다는 강하다
  const H = new Hero(newHero('sword')); H.addExp(EX.cumExp(100));
  for (let n = 1; n <= 3; n++) { H.clearDungeon(`job${n}`); H.advance(); }
  const ref = refPlayer(100, 'sword'), hs = H.stats();
  ok(hs.atk < ref.st.atk && hs.atk > CH.baseAtk(100) && hs.hp < ref.st.hp * 1.2, 'Lv100 맨몸 무인: 기본 < 맨몸 < 기준 무인(장비·성장 몫은 S4~)', `${hs.atk} / ${ref.st.atk}`);
}


console.log('\n=== S4 장비 · 칸 ===');
{
  const r = new Rng(21);
  const items = Array.from({ length: 20000 }, () => GR.makeGear(r, 'weapon', 3));
  const cnt = [0, 0, 0, 0, 0]; let up = 0;
  for (const it of items) { cnt[it.subs.length]++; up += it.up; }
  ok(cnt.every((c, i) => Math.abs(c / 20000 * 1000 - GE.SUBOPT_COUNT_P[i]) < 15) && Math.abs(up / 20000 - 0.25) < 0.015, '부옵션 줄 수 · 上 확률이 표대로', cnt.join(','));
  const S0 = GR.newSlot();
  const lo = GR.itemStats({ slot: 'weapon', g: 1, up: 0, subs: [] }, S0, 100), hi = GR.itemStats({ slot: 'weapon', g: 4, up: 1, subs: [] }, S0, 100);
  ok(hi.atk > lo.atk * 2, '등급이 높을수록 주옵션이 큼', `${lo.atk} → ${hi.atk}`);
  ok(GR.itemStats({ slot: 'weapon', g: 0, up: 0, subs: [] }, S0, 150).atk === GR.itemStats({ slot: 'weapon', g: 0, up: 0, subs: [] }, S0, 30).atk, '범품은 Lv30에서 멈춤(레벨 따라감 상한)');
  const S1 = { ...GR.newSlot(), enh: 10, star: 10 };
  ok(GR.itemStats({ slot: 'weapon', g: 2, up: 0, subs: [] }, S1, 80).atk > GR.itemStats({ slot: 'weapon', g: 2, up: 0, subs: [] }, S0, 80).atk * 1.5, '칸의 강화·별이 주옵션을 키움');
  const G = GR.newGearState(); const w = { gold: 0 };
  GR.obtain(G, ['weapon', 'hat', 'top', 'bottom'].map((sl) => ({ uid: 9000 + sl.length, slot: sl, g: 3, up: 0, subs: [] })), 80, w);
  ok(GR.gearSources(G, 80).some((x) => x.src.startsWith('세트:')), '같은 등급 이상 4부위 → 세트 효과');
  const better = { uid: 9100, slot: 'weapon', g: 4, up: 0, subs: [] }, worse = { uid: 9101, slot: 'weapon', g: 0, up: 0, subs: [] };
  GR.obtain(G, [worse, better], 80, w);
  ok(G.eq.weapon.uid === 9100 && G.bag.some((x) => x.uid === 9101), '더 좋은 건 자동 장착 · 나쁜 건 가방으로');
  GR.savePreset(G, 0); GR.unequip(G, 'weapon'); GR.equip(G, 9101);
  ok(G.eq.weapon.uid === 9101 && GR.loadPreset(G, 0) && G.eq.weapon?.uid === 9100 && G.bag.some((x) => x.uid === 9101), '장착 해제·손으로 장착 · 프리셋 저장·불러오기');
  G.autoDis = 1; const w2 = {}; GR.obtain(G, [{ uid: 9200, slot: 'ring', g: 0, up: 0, subs: [] }, { uid: 9201, slot: 'ring', g: 0, up: 0, subs: [], lock: true }], 80, w2);
  ok(!G.bag.some((x) => x.uid === 9200) && G.bag.some((x) => x.uid === 9201) && w2['item:stone'] >= 1, '자동 분해(잠근 건 남김) → 강화석');
}

console.log('\n=== S4 강화 · 성혼 ===');
{
  const r = new Rng(5), G = GR.newGearState(), w = { gold: 1e12, 'item:restore': 5 };
  for (let i = 0; i < 200; i++) GR.enhance(G, 'weapon', r, w, 100);
  ok(G.slots.weapon.enh === GE.ENH_MAX && GR.enhance(G, 'weapon', r, w, 100) === null, '강화 +20까지 · 실패해도 안 깨짐');
  let downEarly = 0, brkEarly = 0, ok15 = true;
  for (let t = 0; t < 400; t++) {
    const g = GR.newGearState(); const rr = new Rng(t);
    for (let k = 0; k < 60 && g.slots.hat.star < 15 && !g.slots.hat.broken; k++) {
      const before = g.slots.hat.star, res = GR.starForce(g, 'hat', rr, w, 100);
      if (res === 'down' && before < ST.DOWN_FROM) downEarly++;
      if (res === 'break' && before < ST.BREAK_FROM) brkEarly++;
    }
  }
  ok(downEarly === 0 && brkEarly === 0, '성혼: 11성 전엔 하락 없음 · 15성 전엔 파괴 없음');
  const P = GR.newGearState(); P.slots.cape.star = 16; const rp = new Rng(77); let broke = 0;
  for (let i = 0; i < 300; i++) { if (GR.starForce(P, 'cape', rp, w, 100, { noBreak: true }) === 'break') broke++; if (P.slots.cape.star > 18) P.slots.cape.star = 16; }
  ok(broke === 0, '파괴 방지를 켜면 15~19성에서 깨지지 않음');
  const Q = GR.newGearState(); Q.slots.belt.star = 22; Q.slots.belt.pity = ST.PITY_POINTS;
  ok(GR.starForce(Q, 'belt', new Rng(1), w, 100) === 'ok' && Q.slots.belt.star === 23 && Q.slots.belt.pity === 0, '실패 포인트가 차면 다음 한 번 성공 확정');
  const B = GR.newGearState(); B.slots.ring.broken = 18; B.slots.ring.star = 0;
  ok(GR.starForce(B, 'ring', new Rng(1), w, 100) === null && GR.restoreSlot(B, 'ring', w) && B.slots.ring.star === 15 && !B.slots.ring.broken, '파괴된 칸은 성혼 불가 · 복구 주문서로 되살림(−3성)');
  const it = GR.makeGear(new Rng(3), 'neck', 3); while (it.subs.length < 2) it.subs.push({ k: 'crit', v: 5 });
  const keep = JSON.stringify(it.subs[0]), sw = { 'item:stone': 1000 };
  ok(GR.rerollSubs(it, new Rng(4), sw, [0]) && JSON.stringify(it.subs[0]) === keep && it.rr === 1 && sw['item:stone'] === 995, '부옵션 다시 굴리기 — 잠근 줄 유지 · 강화석');
}

console.log('\n=== S4 장비 뽑기 레벨 · 무작위 옵션 틀 ===');
{
  ok(GS.gachaCost(100, 10)[0].n > GS.gachaCost(100, 1)[0].n, '뽑기 레벨이 오를수록 비쌈');
  const GA = GC.newGacha(), w = { gold: 1e12, 'ticket:gear': 30 };
  const got = GC.pull(GA, 30, new Rng(2), w, 50, { ticket: true });
  ok(got.length === 30 && w['ticket:gear'] === 0 && w.gold === 1e12 && GA.eliteQ >= 3, '뽑기권으로 30번 · 10번마다 정예');
  while (!GC.canLevelUp(GA)) GC.pull(GA, 10, new Rng(3), w, 50);
  ok(GC.startLevelUp(GA, 0) && !GC.tickGacha(GA, 1000) && GC.tickGacha(GA, GE.gachaWaitMin(1) * 60000) && GA.lv === 2, '뽑기 레벨업은 대기 시간 뒤');
  ok(GC.eliteDrop(GA, new Rng(9)).length === 3, '정예 처치 → 장비 셋');
  const pool = [{ k: 'atkL1', v: [10, 20, 40, 80], w: 1 }, { k: 'crit', v: [5, 10, 20, 40], w: 1 }];
  const R = RL.newRoller(3), rw = { gold: 1e9 };
  RL.reroll(R, pool, new Rng(1), rw, [{ k: 'gold', n: 100 }]);
  ok(rw.gold === 1e9 - 100 && R.lines.every(Boolean), '다시 굴리기(잠금 0 → 기본 비용)');
  RL.toggleLock(R, 0); const l0 = JSON.stringify(R.lines[0]);
  RL.reroll(R, pool, new Rng(2), rw, [{ k: 'gold', n: 100 }]);
  ok(rw.gold === 1e9 - 300 && JSON.stringify(R.lines[0]) === l0, '잠금 1줄 → 비용 ×2 · 잠근 줄 유지');
  const R2 = RL.newRoller(3); const rr = new Rng(8);
  for (let i = 0; i < 3000; i++) RL.reroll(R2, pool, rr, rw, [{ k: 'gold', n: 1 }]);
  ok(R2.mastery >= 3, '굴릴수록 숙련이 오름', R2.mastery);
  const R3 = RL.newRoller(2); const n = RL.autoRoll(R3, pool, new Rng(4), rw, [{ k: 'gold', n: 1 }], (ls) => ls.some((l) => l && l.g >= 2), 500);
  ok(R3.lines.some((l) => l.g >= 2) && n > 0, '자동 굴리기 — 목표 등급이 나오면 멈춤', n);
}

console.log('\n=== S4 경제 시뮬 합격선(§J1 장비·성혼) ===');
{
  const TIER = { 범: 0, 양: 2, 정: 4, 진: 6, 보: 8, 신: 10, 천: 12 };
  const tierOfName = (nm) => TIER[nm[0]] + (nm.endsWith('上') ? 1 : 0);
  const bad = [];
  for (const seed of [3, 7, 11]) {
    const { log } = simGear(365, { seed });
    for (const r of PR.PROGRESS.filter((x) => x.day >= 1)) {
      const g = log[r.day - 1];
      if (Math.abs(g.tierMedian - tierOfName(r.gear)) > 1) bad.push(`씨앗${seed} ${r.day}일 등급 ${g.tierMedian}/${tierOfName(r.gear)}`);
      if (Math.abs(g.starAvg - r.star) > 2) bad.push(`씨앗${seed} ${r.day}일 별 ${g.starAvg.toFixed(1)}/${r.star}`);
    }
  }
  ok(bad.length === 0, '씨앗 셋 × 진행 목표: 장비 등급(가운데 칸) ±1단 · 평균 별 ±2', bad.slice(0, 4).join(' '));
}

console.log('\n=== S5 수집형(병기·동료·영물) ===');
{
  const C = CL.newCollect('pal'), w = { 'ticket:pal': 400 }, r = new Rng(12);
  const got = CL.pullCollect(C, 200, r, w);
  ok(got.length === 200 && w['ticket:pal'] === 200 && got.some((x) => x.g === 4), '뽑기권 200장 — 천장(200번 안에 보 하나)');
  const ten = Array.from({ length: 300 }, (_, i) => { const c = CL.newCollect('relic'); return CL.pullCollect(c, 10, new Rng(i), { 'ticket:relic': 10 }); });
  ok(ten.every((g) => g.some((x) => x.g >= 2)), '10연이면 정품 이상 하나 보장');
  const aw = CL.autoAwaken(C); CL.autoEquip(C);
  ok(aw > 0 && C.eq.every((k) => k != null) && CL.kindGrade('pal', C.eq[0]) >= CL.kindGrade('pal', C.eq[4]), '겹친 것으로 각성 · 좋은 것부터 장착');
  const before = CL.collectSources(C)[0].stats.final4;
  const k = C.eq[0]; const ew = { 'item:essence': 1e6 }; for (let i = 0; i < 10; i++) CL.levelUp(C, k, ew);
  ok(C.own[k].lv === 11 && CL.collectSources(C)[0].stats.final4 > before, '정수로 레벨업 → 장착 값 ↑(동료 → 최종 피해④)');
  ok(CL.collectSources(CL.newCollect('weapon'))[0].stats.mainDmg === 0, '없으면 0');
}

console.log('\n=== S5 경지 · 강호행 · 꾸미기 ===');
{
  const R = RM.newRealm(), w = { gold: 1e15, 'item:heart': 100 };
  ok(RM.realmStart(R, 0, w, 100) && !RM.realmStart(R, 0, w, 100), '경지 레벨업 시작(하나씩)');
  ok(!RM.realmTick(R, 1000) && RM.realmTick(R, 20 * 60000) && R.lv === 1, '대기 시간이 지나야 오름');
  ok(!RM.heartRoll(R, new Rng(1), w), '심법은 경지 10부터');
  R.lv = 25; ok(RM.heartRoll(R, new Rng(2), w) && R.heart.lines.slice(0, 2).every(Boolean) && !R.heart.lines[2], '경지 25 → 심법 2줄만 굴림');
  const st = RM.realmSources(R)[0].stats; ok(st.atkL2 >= 25 * S5T.REALM_ATK_P && st.hpP >= 25 * S5T.REALM_HP_P, '경지 → 공격%② · 체력%');
  const J = RM.newJourney(); const jw = { gold: 1e15 };
  ok(!RM.journeyStart(J, 0, jw, new Rng(1)), '강호행: 두목을 이기기 전엔 못 엶');
  J.cleared = 2; ok(RM.journeyStart(J, 0, jw, new Rng(1)) && RM.journeyTick(J, 6 * 3600e3, new Rng(2)) && J.step === 1 && J.opts[0].length === 2, '두목 이김 → 열기(대기 시간) → 단계 옵션 2줄');
  ok(RM.journeySources(J)[0].stats.final3 >= S5T.JOURNEY_STEP_P && [1000, 1300, 1700, 2500].includes(RM.blessX(J, 0)), '강호행 → 최종 피해③ · 축복 상자 배율');
  ok(RM.cosmeticSources(9).length === 0 && RM.cosmeticSources(25)[0].stats.hpP === 10, '꾸미기 10개마다 합계 보너스');
}

console.log('\n=== S5 표준 무인 · 시스템 몫 ===');
{
  ok(JSON.stringify(buildStd()) === JSON.stringify(STD), '표준 무인 표가 시뮬과 같다(숫자를 바꾸면 node tools/s2sim/std.mjs로 다시 만든다)');
  ok(STD.slice(2).every((r, i) => r.atk >= STD[i + 1].atk && r.hp >= STD[i + 1].hp), '표준 무인: 레벨이 오를수록 공격·체력이 줄지 않음');
  const bad = [];
  for (const d of [7, 30, 90, 365]) {
    let G, S, L;
    simGear(d, { seed: 3, onDay: (dd, l, g) => { if (dd === d) { G = g; L = l; } } });
    simS5(d, { seed: 3, onDay: (dd, l, f) => { if (dd === d) S = f(); } });
    const h = heroAt(L), mob = makeMob(L);
    const P = (ex) => { const st = h.stats(ex); return Math.log(DM.expected({ lv: L, st }, mob, SKILL_BASE) * Math.sqrt(st.hp)); };
    const gs = GR.gearSources(G, L), naked = P([]), gear = P(gs), all = P([...gs, ...S]), tot = all - naked;
    const gShare = (gear - naked) / tot;
    if (gShare < 0.35 || gShare > 0.65) bad.push(`${d}일 장비 ${(gShare * 100).toFixed(0)}%`);
    for (const s of S.filter((x) => x.src !== '꾸미기')) { const sh = (P([...gs, s]) - gear) / tot; if (sh < 0.05 || sh > 0.2) bad.push(`${d}일 ${s.src} ${(sh * 100).toFixed(0)}%`); }
  }
  ok(bad.length === 0, '성장 몫: 장비 35~65% · 병기·동료·영물·경지·강호행 각 5~20%(7·30·90·365일)', bad.join(' '));
}


console.log('\n=== S6 던전 · 클리어 조건 8종 · 깃발 ===');
{
  const hero = refPlayer(80, 'bow');
  const res = {};
  for (const [clear, need, kind, timeMs] of [['kills', 20, 'mob', 120000], ['boss', 0, 'boss', 120000], ['wipe', 0, 'mob', 120000], ['survive', 0, 'mob', 30000], ['collect', 15, 'mob', 120000], ['reach', 0, 'mob', 120000], ['score', 150, 'mob', 120000], ['timeoutWin', 0, 'mob', 20000]]) {
    res[clear] = runDungeon({ clear, need, kind, mobLv: 80, timeMs }, hero, 4);
  }
  const bad = Object.entries(res).filter(([, r]) => !r.cleared).map(([k]) => k);
  ok(bad.length === 0, '클리어 조건 8종 모두 깰 수 있음(처치 수 · 두목 · 전멸 · 버티기 · 모으기 · 도착 · 점수 · 시간 끝 승리)', bad.join(','));
  ok(res.kills.kills >= 20 && res.wipe.kills === 8 && res.boss.kills === 1, '조건에 맞춰 끝남(20마리 · 8마리 전멸 · 두목 하나)');
  const strong = runDungeon({ clear: 'boss', mobLv: 120, timeMs: 30000 }, refPlayer(40, 'sword'), 4);
  ok(!strong.cleared, '너무 센 두목은 시간 안에 못 깸');
  const nd = runDungeon({ clear: 'kills', need: 999, mobLv: 140, timeMs: 120000, flags: ['noDie'] }, refPlayer(60, 'sword'), 4);
  ok(!nd.cleared && nd.deaths >= 1, '깃발 「죽지 않음」: 한 번 죽으면 실패');
  ok(runDungeon({ clear: 'boss', mobLv: 80, timeMs: 120000, flags: ['bossMeter'] }, hero, 4).meter > 0, '깃발 「보스 피해 측정기」');
  const a = runDungeon({ clear: 'kills', need: 30, mobLv: 70, timeMs: 120000 }, hero, 9), b = runDungeon({ clear: 'kills', need: 30, mobLv: 70, timeMs: 120000 }, hero, 9);
  ok(a.digest === b.digest, '던전도 결정론');
  ok(canSweep({ best: 5 }, 5) && !canSweep({ best: 5 }, 6) && !canSweep(null, 1), '소탕은 깬 단계까지');
}

console.log('\n=== S6 스태미나 · 원정 · 돌발 미션 · 탑 · 성혼 필드 ===');
{
  const S = ID.newStamina('daily', 0);
  for (let i = 0; i < 12; i++) ID.useStamina(S, 0);
  ok(!ID.useStamina(S, 0) && ID.staminaNow(S, 0) === 0, '입장권 12장 다 쓰면 못 들어감');
  ok(ID.staminaNow(S, 2 * 3600e3) === 1 && ID.staminaNow(S, 30 * 3600e3) === 12, '2시간마다 1장 · 최대 12에서 멈춤');
  ok(ID.nextRegenMs(S, 3600e3) === 3600e3, '다음 1장까지 남은 시간');
  const S2 = ID.newStamina('daily', 0);
  ok(ID.recharge(S2, 0, 1, 12) && ID.staminaNow(S2, 0) === 24, '충전은 최대를 넘어 24까지');
  ok(ID.recharge(S2, 0, 1, 1) && ID.recharge(S2, 0, 1, 1) && !ID.recharge(S2, 0, 1, 1) && ID.recharge(S2, 0, 2, 1), '충전 하루 3번 · 다음 날 다시');
  const E = {}, w = { 'ticket:exped': 1 };
  ok(ID.startExpedition(E, 8, 0, w) && !ID.claimExpedition(E, 7 * 3600e3) && ID.claimExpedition(E, 8 * 3600e3).huntMin === 72, '원정 8시간 → 사냥 72분 상당');
  const M = { cur: null, done: 0, failed: 0 }, r = new Rng(3);
  let t = 0; while (!M.cur && t < 1e9) { t += 60000; ID.suddenTick(M, r, t); }
  ok(!!M.cur && ID.suddenExtend(M) && !ID.suddenExtend(M), '돌발 미션이 뜸 · 연장은 한 번');
  ok(ID.suddenProgress(M, 999, t + 60000)?.huntMin === CT.SUDDEN.rewardMin && M.done === 1, '돌발 미션 완료 → 보상');
  ok(Math.abs(ID.towerX(11) - Math.pow(1.06, 10)) < 1e-9 && ID.towerSources(50)[0].stats.atkL1 === 50, '무한 탑: 층마다 ×1.06 · 깬 층만큼 영구 보너스');
  const G = GR.newGearState(); for (const s of GE.SLOTS) G.slots[s].star = 13;
  ok(ID.starSum(G) === 130 && ID.bestStarField(130, 110).need === 120 && ID.bestStarField(130, 95).need === 50 && ID.bestStarField(10, 150) === null, '성혼 필드: 별 합 · 레벨 둘 다 맞아야');
}

console.log('\n=== S6 콘텐츠 보상 = 경험치 곡선 가정 ===');
{
  const m = CT.dailyContentMin();
  ok(Math.abs(m - (EX.DAY_MIN - EX.DAY1_MIN)) <= 5, '수련장 + 원정 + 돌발 미션 + 일일 미션 = 하루 +138 사냥분(±5) — 곡선 가정과 같다', m.toFixed(1));
  ok(Object.values(CT.DAILY_DUNGEONS).every((d) => CT.CLEAR.includes(d.clear)) && CT.JOB_DUNGEON.length === PR.JOB_LV.length, '수련동 4종 · 전직 던전 차수마다');
}

console.log('\n=== S7 방치 · 대기열 · 시간 티켓 · 길잡이 · 미션 ===');
{
  const H = 3600e3, O = OF.newOffline();
  ok(OF.checkReturn(O, 1000, 'w1', 30) === null, '처음 접속은 받을 몫 없음');
  ok(OF.checkReturn(O, 1000 + 30000, 'w1', 30) === null, '1분 안 된 자리 비움은 없음');
  const p = OF.checkReturn(O, 31000 + 20 * H, 'w1', 30);
  ok(p && p.ms === 12 * H && p.capped && Math.abs(p.huntMin - 12 * 60 * 0.7) < 1e-9, '12시간에서 멈춤 · ×70%', p?.huntMin);
  ok(p.kills === Math.floor(p.huntMin * EX.KILLS_PER_MIN) && p.exp === p.kills * EX.mobExp(30) && p.gold === p.kills * GS.goldPerMob(30), '그 레벨 사냥 벌이로');
  const c1 = OF.claimOffline(O, 'd1', true);
  ok(c1.x === 2 && c1.exp === 2 * p.exp && OF.claimOffline(O, 'd1') === null, '광고 ×2 · 두 번 받기 없음');
  let t = 31000 + 20 * H;
  for (let i = 0; i < 2; i++) { t += 2 * H; OF.checkReturn(O, t, 'w1', 30); OF.claimOffline(O, 'd1', true); }
  t += 2 * H; OF.checkReturn(O, t, 'w1', 30);
  ok(OF.claimOffline(O, 'd1', true).x === 1, '광고 ×2는 하루 3번');
  t += 2 * H; OF.checkReturn(O, t, 'w1', 30);
  ok(OF.claimOffline(O, 'd2', true).x === 2, '다음 날 다시 ×2');
  // 시계를 뒤로 돌렸다가 다시 앞으로 — 본 가장 늦은 시각부터만
  const O2 = OF.newOffline(); OF.checkReturn(O2, 100 * H, 'w1', 30);
  ok(OF.checkReturn(O2, 50 * H, 'w1', 30) === null, '시계를 뒤로 돌리면 받을 몫 없음');
  ok(OF.checkReturn(O2, 102 * H, 'w1', 30).ms === 2 * H, '다시 앞으로 와도 본 가장 늦은 시각부터만(미래 몫 두 번 없음)');
  // 주간 84시간
  const O3 = OF.newOffline(); let u = 1; OF.checkReturn(O3, u, 'w1', 30); let sum = 0;
  for (let i = 0; i < 10; i++) { u += 12 * H; const q = OF.checkReturn(O3, u, 'w1', 30); sum += q ? q.ms : 0; OF.claimOffline(O3, 'd'); }
  ok(sum === EC.OFFLINE_WEEK_CAP_H * H, '일주일 84시간까지', sum / H);
  u += 12 * H; ok(OF.checkReturn(O3, u, 'w2', 30).ms === 12 * H, '다음 주는 다시');
  // 대기열
  const q = OF.buildQueue([{ kind: 'sudden', at: 1 }, { kind: 'timer', at: 5 }, { kind: 'offline' }, { kind: 'timer', at: 2 }, { kind: 'attendance' }]);
  ok(q.map((x) => x.kind + (x.at ?? '')).join(',') === 'offline,attendance,timer2,timer5,sudden1', '돌아왔을 때 대기열 순서');
  // 시간 티켓
  const tm = { endMs: 10 * H }, wl = { 'ticket:time': 3 };
  ok(OF.useTimeTicket(tm, wl, 40) && tm.endMs === 10 * H - 45 * 60000 && wl['ticket:time'] === 0, '시간 티켓: 15분 단위로 당김');
  ok(!OF.useTimeTicket(tm, wl, 15) && !OF.useTimeTicket(null, { 'ticket:time': 9 }, 15), '티켓 없거나 타이머 없으면 못 씀');
  // 방치만 하면(12시간) 접속 사냥 2시간의 몇 배 — 계획서 「방치만은 덜」
  ok(12 * 60 * OF.OFF_RATE < EX.DAY1_MIN, '하루 방치 몫은 접속 하루 몫보다 작다');
  // 길잡이 — 한 줄 · 레벨 조건이 오름차순 · 첫 30분(Lv15)에 g11까지
  const lvs = MS.GUIDE.filter((g) => g.ev === 'level').map((g) => +g.cond.split('>=')[1]);
  ok(lvs.every((v, i) => i === 0 || v > lvs[i - 1]) && new Set(MS.GUIDE.map((g) => g.id)).size === MS.GUIDE.length, '길잡이 레벨 단계 오름차순 · id 겹침 없음');
  const st = {}; let lv = 1;
  const evs = (cur) => ({ kill: [['kill', { n: 5 }]], level: [['level', { lv }]], equip: [['equip', {}]], gacha: [['gacha', { n: 10 }]], skill: [['skill', {}]], enhance: [['enhance', {}], ['enhance', {}], ['enhance', {}]], dungeon: [['dungeon', { job: 1, kind: 1 }]], pull: [['pull', { sys: cur.ev === 'pull' ? +cur.cond.split('==')[1] : 0, n: 10 }]] })[cur.ev];
  const elite = [['kill', { elite: 1 }]];
  // 첫 30분: 레벨은 15까지만 오른다
  for (let step = 0; step < 40; step++) {
    const cur = MS.guideCurrent(st); if (!cur) break;
    const b = new QuestBook([cur], st);
    lv = Math.min(15, lv + 2);
    for (const [e, v] of (cur.cond === 'elite' ? elite : evs(cur) || [])) b.on(e, v);
    if (!st[cur.id]?.done) break;
    b.claim(cur.id);
  }
  ok(MS.guideCurrent(st)?.id === 'g12', 'Lv15·첫 30분 할 일로 길잡이 g11까지 · g12(두목)에서 기다림', MS.guideCurrent(st)?.id);
  ok(MS.GUIDE.slice(0, 11).reduce((a, g) => a + g.huntMin, 0) <= 6, '첫 30분 길잡이 경험치 몫 ≤ 사냥 6분 상당(레벨은 사냥이 정한다)');
  // 미션
  ok(MS.dailyMissionMin() === CT.DAILY_MISSION_MIN, '일일 미션 합 = 콘텐츠 표의 15분', MS.dailyMissionMin());
  const D = new QuestBook(MS.DAILY_MISSIONS, {});
  D.on('login'); D.on('kill', { n: 300 }); D.on('kill', { n: 300, boss: 1 }); D.on('kill', { n: 1, boss: 1 });
  ok(D.claimable().sort().join() === 'd_boss,d_kill,d_login', '일일 미션 진행 · 끝남');
  D.reset(MS.DAILY_MISSIONS.map((m) => m.id)); ok(D.claimable().length === 0, '일일 초기화');
  const A = MS.achievements();
  ok(A.length === Object.values(MS.ACHIEVE_STEPS).flat().length && new Set(A.map((a) => a.id)).size === A.length, '업적 단계 전부 · id 겹침 없음');
  const AB = new QuestBook(A, {}); AB.on('level', { lv: 120 });
  ok(AB.claimable().sort().join() === 'a_level_0,a_level_1,a_level_2', '레벨 업적은 그 레벨까지 한꺼번에');
}

console.log('\n=== S8 전투력 · 월드보스 · 대결 · 문파 · 서열 ===');
{
  // 전투력: 레벨이 오를수록 표준 전투력이 오름 · 10% 오르면 처치 시간 약 9% 줄어듦
  const sp = [1, 15, 60, 100, 127, 150].map((L) => PW.stdPower(L));
  ok(sp.every((v, i) => i === 0 || v > sp[i - 1]), '표준 전투력이 레벨 따라 오른다', sp.join(' '));
  const f = refPlayer(100), mob = makeMob(100, 'mob');
  const up = { ...f, st: { ...f.st, atk: Math.round(f.st.atk * 1.1) } };
  const pr = PW.power(up) / PW.power(f), tr = PW.dpsVs(f, mob) / PW.dpsVs(up, mob);
  const per10 = (1 - Math.pow(tr, Math.log(1.1) / Math.log(pr)));
  ok(per10 > 0.07 && per10 < 0.11, '전투력 10% ↑ → 처치 시간 약 9% ↓', (per10 * 100).toFixed(1) + '%');
  const tank = { ...f, st: { ...f.st, hp: f.st.hp * 2 } };
  ok(PW.power(tank, 'pvp') / PW.power(f, 'pvp') > PW.power(tank) / PW.power(f) + 0.2, '대결 전투력은 체력을 더 친다');
  // 월드보스 점수
  const L = 100, R = WB.refTryDmg(L), sc = [0.5, 1, 2, 4, 9, 16, 50].map((r) => WB.bossScore(R * r, L));
  ok(sc.every((v, i) => i === 0 || v > sc[i - 1]) && sc[1] === ON.WB_SCORE_UNIT, '보스 점수는 피해 따라 오르고 기준 피해 = 1만 점', sc.join(' '));
  ok((sc[3] - sc[2]) / 2 < (sc[2] - sc[1]) && (sc[6] - sc[5]) / 34 < (sc[5] - sc[4]) / 7, '큰 피해일수록 덜 오른다(제곱근 구간)');
  const e = R * 1e-6; ok(Math.abs(WB.bossScore(R + e, L) - WB.bossScore(R, L)) <= 1 && Math.abs(WB.bossScore(4 * R + e, L) - WB.bossScore(4 * R, L)) <= 1, '구간 이음매에서 끊기지 않음');
  const h0 = WB.phaseHp(L, 0);
  ok(Math.abs(WB.phaseHp(L, 1) / h0 - 1.5) < 0.001 && WB.phaseOf(h0 * 1.2, L).phase === 1 && WB.phaseOf(0, L).phase === 0, '단계 체력 ×1.5 · 누적 피해로 단계');
  const W = {}; ok([1, 2, 3].every(() => WB.useTry(W, 'd1')) && !WB.useTry(W, 'd1') && WB.useTry(W, 'd2'), '월드보스 하루 3번');
  ok(WB.maxTryDmg(f, L) > R && WB.maxTryDmg(f, L) < R * 2, '한 번 피해 상한 = 기준 × 여유');
  // 대결
  const A = refPlayer(100), B = refPlayer(100), strong = { ...A, st: { ...A.st, atk: A.st.atk * 3, hp: A.st.hp * 3 } };
  const d1 = PV.duel(A, B, 7), d2 = PV.duel(A, B, 7);
  ok(JSON.stringify(d1) === JSON.stringify(d2), '대결은 결정론(같은 씨앗 = 같은 결과)');
  let wins = 0; for (let s = 1; s <= 20; s++) wins += PV.duel(strong, B, s).win ? 1 : 0;
  ok(wins === 20, '훨씬 센 쪽은 이긴다', wins);
  let ew = 0; for (let s = 1; s <= 40; s++) ew += PV.duel(A, B, s).win ? 1 : 0;
  ok(ew > 8 && ew < 32, '같은 힘이면 반쯤', ew);
  const deck = PV.makeDeck(A); ok(PV.deckOk(deck) && !PV.deckOk({ ...deck, st: { ...deck.st, atk: deck.st.atk * 9 } }), '방어 덱 지문 — 손대면 들킴');
  const up1 = PV.scoreDelta(true, 1000, 1500), up0 = PV.scoreDelta(true, 1000, 1000), dn = PV.scoreDelta(false, 1000, 500);
  ok(up1.atk > up0.atk && up0.atk === ON.PVP.win && dn.atk < -ON.PVP.lose + 1 && up0.def < 0 && PV.scoreDelta(false, 1, 1).def > 0, '점수식: 센 상대를 이기면 더 · 약한 상대에게 지면 더 깎임');
  ok(PV.tierOf(1000).name === '하수' && PV.tierOf(1450).name === '절정' && PV.tierOf(9999).name === '현경', '티어');
  const pool = [{ uid: 'a', score: 1000 }, { uid: 'b', score: 1500 }, { uid: 'me', score: 1010 }];
  ok(PV.findOpp(pool, { uid: 'me', score: 1010 }, new Rng(1)).uid === 'a' && PV.findOpp([{ uid: 'x', score: 3000 }], { uid: 'me', score: 1000 }, new Rng(1)) === null, '짝 찾기: 점수 가까운 상대 · 넓혀도 없으면 없음');
  // 문파
  const G = GU.newGuild('g1', 'u0');
  for (let i = 1; i < 30; i++) GU.join(G, `u${i}`);
  ok(G.members.length === GU.maxMembers(1) && GU.maxMembers(99) === 40, '회관 레벨 따라 인원', G.members.length);
  ok(GU.startResearch(G, 'atk', 0) && !GU.startResearch(G, 'atk', 0) && GU.tickResearch(G, 3 * 3600e3 - 1).length === 0 && GU.tickResearch(G, 3 * 3600e3)[0] === 'atk' && G.research.atk.lv === 1, '연구: 대기 시간 뒤 레벨 +1');
  const tm = { endMs: 10 * 3600e3 }; GU.askHelp(G, 'r1', 'u0', tm);
  ok(GU.giveHelp(G, 'r1', 'u1', 0, 'd') && tm.endMs === 10 * 3600e3 - 360000 && !GU.giveHelp(G, 'r1', 'u1', 0, 'd') && !GU.giveHelp(G, 'r1', 'u0', 0, 'd'), '도움: 남은 1%(또는 3분) · 같은 사람 한 번 · 자기 것은 못 도움');
  for (let i = 2; i <= 12; i++) GU.giveHelp(G, 'r1', `u${i}`, 0, 'd');
  ok(G.helps.r1.by.length === 10, '한 요청에 도움 10번까지');
  GU.raidHit(G, 'w1', 'u1', 150); GU.raidHit(G, 'w1', 'u2', 100);
  ok(GU.raidTotal(G) === 250 && GU.raidPhase(250, 100).phase === 2 && GU.raidHit(G, 'w2', 'u1', 5) === 5, '토벌: 문파원 피해 합 · 주가 바뀌면 새로');
  ok(GU.warResult(5, 3).join() === '3,0' && GU.warResult(2, 2).join() === '1,1', '대항 승점');
  for (const u of G.members) GU.trainAdd(G, 'w1', u, ON.GUILD.train.goalPerMember);
  ok(GU.trainProgress(G).full, '수련 막대가 차면 모두 보상');
  ok(GU.CONTENTS.every((c) => GU.windowsOf(c).length === 7), '문파 콘텐츠 셋 다 같은 7창 세트');
  // 서열 · 재현 검증 · 명예의 전당
  const p = RK.buildProfile(refPlayer(100), { nickname: '무인' });
  ok(RK.checkProfile(p).length === 0 && RK.checkProfile({ ...p, power: p.power * 10 }).length === 1 && RK.checkProfile({ ...p, lv: 151 }).length === 1, '서열 값 점검: 표준의 3배 넘는 전투력 · 없는 레벨은 걸림');
  const body = { lv: 100, job: 'sword' }, text = SV.pack(body, 1);
  const fo = (b) => refPlayer(b.lv, b.job);
  ok(RK.verifySave(text, p, fo).length === 0, '세이브로 다시 계산 = 올린 값');
  ok(RK.verifySave(text, { ...p, power: p.power * 2 }, fo).length === 1 && RK.verifySave(text.replace('"lv":100', '"lv":120'), p, fo).includes('서명'), '부풀린 전투력 · 고친 세이브는 걸림');
  { const h = heroAt(60), G = GR.newGearState(); const b2 = { hero: h.s, gear: G }, t2 = SV.pack(b2, 1), f2 = RK.fighterOfBody(JSON.parse(t2).body);
    ok(RK.verifySave(t2, RK.buildProfile(f2), RK.fighterOfBody).length === 0 && f2.lv === 60, '세이브 몸통(무인 + 장비)에서 서버가 같은 전투력을 다시 센다'); }
  const room = simpleRoom(30), hero = refPlayer(30), F = new RoomFight(room, hero, 9); F.run(20000);
  ok(RK.verifyFight(room, hero, F.log, 20000, F.digest()) && !RK.verifyFight(room, hero, { ...F.log, seed: 10 }, 20000, F.digest()), '전투 기록 재현 — 같으면 통과 · 씨앗 바꾸면 걸림');
  const fame = RK.fameRows([{ nickname: 'a', level: 99, power: 5 }, { nickname: 'b', level: 120, power: 3 }, null]);
  ok(fame.level[0].nickname === 'b' && fame.power[0].nickname === 'a' && fame.level.length === 2, '명예의 전당: 레벨·전투력 위');
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const m = rules.match(/function s2Keys\(\) \{\s*return \[([^\]]*)\]/);
  ok(m && m[1].split(',').map((x) => x.trim().replace(/'/g, '')).sort().join() === [...RK.PROFILE_KEYS].sort().join(), '서버 규칙의 새 시즌 서열 칸 = 엔진 목록');
}

console.log('\n=== S9 게임 층 — 첫 30분을 실제로 해 보기 ===');
{
  const play = (seed, min = 30) => {
    const T0 = 1.8e12, g = new Game(newGame('sword', T0, seed), T0);
    let t = T0;
    for (let s = 0; s < min * 60; s++) {
      t += 1000; g.tick(t); g.hunt(1000);
      if (s % 60 === 0) g.minute();
      while (g.claimGuide());
      const cur = MS.guideCurrent(g.S.q.guide);
      if (g.S.wallet['ticket:gear'] >= 10 && (cur?.ev === 'gacha' || cur?.ev === 'equip' || s > 600)) g.pullGear(10);
      if (cur?.ev === 'pull') { const sys = ['weapon', 'pal', 'relic'][+cur.cond.split('==')[1] - 1]; if (g.S.wallet[`ticket:${sys}`] >= 10) g.pullCollect(sys, 10); }
      if (cur?.cond === 'elite' && g.S.gacha.eliteQ === 0) g.pullGear(10);   // 정예가 필요하면 은자로 뽑기
      if (cur?.ev === 'enhance' || s % 30 === 0) g.enhance(GE.SLOTS[s % 10]);
      if (cur?.ev === 'skill') g.skillUp('main') || g.skillUp('base');
      if (cur?.ev === 'star') g.star('weapon');
      if (cur?.ev === 'dungeon' && cur.cond === 'job == 1') g.jobDungeon();
    }
    return { g, t };
  };
  const { g, t } = play(5), b = play(5).g;
  const lv = g.S.hero.lv, gi = +(MS.guideCurrent(g.S.q.guide)?.id || 'g99').slice(1);
  ok(lv >= 14 && lv <= 17, '30분 플레이 → Lv 14~17(목표 15)', `Lv ${lv} · 처치 ${g.S.kills}`);
  ok(Math.abs(g.S.kills / 30 - EX.KILLS_PER_MIN) <= 4, '분당 처치 ≈ 곡선 가정(27)', (g.S.kills / 30).toFixed(1));
  ok(gi >= 11, '길잡이 11단계 이상', `g${gi}`);
  ok(g.S.hero.adv === 1 && g.fight.deaths === 0, '1차 전직 · 사냥 중 죽지 않음');
  ok(b.S.hero.lv === lv && b.S.kills === g.S.kills && b.S.wallet.gold === g.S.wallet.gold, '같은 씨앗 = 같은 30분(결정론)');
  const txt = g.save(), g2 = Game.load(txt, t);
  ok(g2.signed && g2.tableOk && g2.S.hero.lv === lv && g2.power() === g.power(), '저장 → 불러오기: 서명 · 표 판 · 같은 전투력');
  ok(!Game.load(txt.replace(/"gold":\d+/, '"gold":999999999'), t).signed, '은자를 손으로 고친 세이브는 서명이 안 맞음');
  // 경쟁(미리보기): 월드보스 하루 3번 · 점수 = 구간표 · 대결 하루 5번 · 점수 오르내림
  { const w = [1, 2, 3].map(() => g2.wbossFight());
    ok(w.every((x) => x && x.score === WB.bossScore(x.dmg, g2.S.hero.lv)) && g2.wbossFight() === null && g2.S.wb.total === w.reduce((a, x) => a + x.score, 0), '월드보스 한 번 = 구간표 점수 · 하루 3번', w.map((x) => x.score).join(' '));
    const r = [0, 1, 2, 0, 1].map((i) => g2.pvpFight(i));
    ok(r.every(Boolean) && g2.pvpFight(0) === null && g2.S.pvp.score === ON.PVP.start + r.reduce((a, x) => a + x.d, 0), '대결 하루 5번 · 점수 = 시작 + 변화 합', `${g2.S.pvp.score} ${PV.tierOf(g2.S.pvp.score).name}`); }
  // 돌아오기: 3시간 자리 비움 → 방치 몫
  const p = g2.returnCheck(t + 3 * 3600e3);
  const lv0 = g2.S.hero.lv; g2.claimOffline(true);
  ok(p && p.ms === 3 * 3600e3 && g2.S.hero.lv > lv0, '3시간 뒤 돌아오면 방치 보상(광고 ×2)', `Lv ${lv0} → ${g2.S.hero.lv}`);
  ok(dayKey(Date.UTC(2026, 10, 14, 15, 0)) === dayKey(Date.UTC(2026, 10, 15, 14, 59)) && dayKey(Date.UTC(2026, 10, 14, 14, 59)) !== dayKey(Date.UTC(2026, 10, 14, 15, 0)), '날 바뀜은 한국 시각 자정');
  ok(new Date((weekKey(Date.UTC(2026, 10, 18)) * 864e5)).getUTCDay() === 1, '주 키는 월요일');
  const src = fs.readFileSync(new URL('../js/s2/game.js', import.meta.url), 'utf8');
  const sent = new Set([...src.matchAll(/\bemit\(\s*['"]([a-z]+)['"]/g)].map((m) => m[1]));
  const heard = new Set([...MS.GUIDE, ...MS.DAILY_MISSIONS, ...MS.WEEKLY_MISSIONS, ...MS.achievements()].map((q) => q.ev));
  const tableEv = [...heard].filter((e) => !sent.has(e) && !['wboss', 'pvp', 'sweep'].includes(e));
  ok([...sent].every((e) => heard.has(e)) && tableEv.length === 0, '게임이 보내는 사건 = 길잡이·미션이 받는 사건(온라인 셋 빼고)', `보냄 ${[...sent].join(',')} · 받기만 ${tableEv.join(',')}`);
}

console.log('\n=== S0 규칙 ===');
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('../js/s2', import.meta.url).pathname);
  const code = (p) => fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 주석은 빼고
  const bad = files.filter((p) => !p.includes('/js/s2/ui/')).filter((p) => /Math\.random|Date\.now|performance\.now/.test(code(p)));
  ok(bad.length === 0, 'js/s2 엔진(화면 js/s2/ui 빼고)은 Math.random·Date.now·performance.now를 쓰지 않는다(결정론)', bad.join(' '));
  const shipped = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8') + fs.readFileSync(new URL('../js/wmain.js', import.meta.url), 'utf8');
  ok(!/s2\//.test(shipped), '지금 게임은 아직 새 시즌 코드를 부르지 않는다(교체 전)');
  ok(/s2=1[\s\S]*s2\.html/.test(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')), 'index.html?s2=1 → 새 시즌 미리보기(s2.html)');
  ok(/정한 것 \(2026-11-14\)/.test(fs.readFileSync(new URL('../docs/새시즌_계획.md', import.meta.url), 'utf8')), '계획서가 있다');
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail ? 1 : 0);
