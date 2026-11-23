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
import { Game, newGame, dayKey, weekKey, STAGE_KILLS } from '../js/s2/game.js';
import { SideFight, sideRoom, makeSideMap, replaySide } from '../js/s2/battle/side.js';
import * as KT from '../js/s2/tables/kit.js';
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
  ok(pr.find((r) => r.day === 1).lv.join('~') === '29~31' && pr.find((r) => r.day === 7).lv[0] === 69 && pr.find((r) => r.day === 30).lv[0] === 99 && pr.at(-1).day === 60 && pr.at(-1).lv[0] === PR.LEVEL_MAX, 'v527 1일 30 · 7일 70 · 30일 100 · 60일 만렙');
  ok(PR.JOB_LV.join() === '1,20,50,80,100,120', 'v527 전직 20 · 50 · 80 · 100 · 120');
  // 경험치
  const e = (L) => EX.expToNext(L);
  ok(Array.from({ length: PR.LEVEL_MAX - 2 }, (_, i) => i + 2).every((L) => e(L) > e(L - 1)), '경험치: 레벨마다 늘어남');
  ok(e(100) / e(99) < 1.8 && e(104) / e(103) < 1.6 && e(105) / e(104) < 1.15, '100에서 벽이 갑자기 서지 않음(100~104 서서히)', `${(e(100) / e(99)).toFixed(2)} · ${(e(104) / e(103)).toFixed(2)}`);
  const pre = EX.cumExp(100) - EX.cumExp(1), post = EX.cumExp(150) - EX.cumExp(100);
  ok(post > pre * 3, 'v527 100 이후(30일)가 1~100(30일)보다 무거움 — 사냥 경험치 ×3(Lv100~)을 넣고도', `${(post / pre).toFixed(1)}배`);
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
  ok(/^[0-9a-f]{8}$/.test(tableHash()) && TABLE_VER === 's2-0.7', '표 해시 · 판 번호(v529 s2-0.7)', tableHash());
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
  // v493 일반 몹은 무공이 여러 마리를 함께 쳐서(맞기 시작해 죽기까지가 길어진다) 처치 수(분당)가 기준 — 한 마리 시간은 0.9~3.2초(높은 차수일수록 넓게 쳐서 길어짐)
  const band = { mob: [0.9, 3.3], elite: [5.5, 10], boss: [36, 54] };   // v527 표준 무인 표를 다시 만들어 일반 위끝 3.2 → 3.3
  const bad = [];
  for (const kind of ['mob', 'elite', 'boss']) for (const L of [5, 60, 120, 150]) for (const job of Object.keys(CH.JOBS)) {
    const f = new RoomFight(simpleRoom(L, { n: kind === 'mob' ? 8 : 1, kind, coolMs: 3000 }), refPlayer(L, job), 11).run(kind === 'boss' ? 300000 : 90000);
    const first = {}, ttk = [];
    for (const e of f.events) { if (e[0] === 'hit' && first[e[2]] == null) first[e[2]] = e[1]; if (e[0] === 'kill') ttk.push((e[1] - first[e[2]]) / 1000); }
    const avg = ttk.reduce((a, b) => a + b, 0) / Math.max(1, ttk.length);
    if (!(avg >= band[kind][0] && avg <= band[kind][1]) || (kind === 'boss' && f.deaths > 2)) bad.push(`${kind}/${L}/${job}:${avg.toFixed(2)}s 사망${f.deaths}`);
  }
  ok(bad.length === 0, '다섯 직업 × 레벨 4 × 몹 셋: 일반 0.9~3.3초(무공이 여러 마리) · 정예 5.5~10초(동료 몫 포함) · 두목 36~54초(두목전 사망 2번 이하)', bad.slice(0, 4).join(' '));
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
  const r30 = PR.PROGRESS[0].lv; ok(l30 >= r30[0] && l30 <= r30[1] + 1, `30분 Lv${r30[0]}~${r30[1]}`, l30.toFixed(1));
  const bad = [];
  for (const r of PR.PROGRESS.filter((x) => x.day >= 1)) {
    const b = PS.levelAtDay(r.day), f = PS.levelAtDay(r.day, 'full'), i = PS.levelAtDay(r.day, 'idle');
    if (b < r.lv[0] - 0.5 || b > r.lv[1] + 0.5) bad.push(`기준 ${r.day}일 Lv${b.toFixed(1)}`);
    if (f > b * PR.POLICY_BAND.full.max) bad.push(`꽉 채움 ${r.day}일 ${(f / b).toFixed(2)}배`);
    if (i < b * PR.POLICY_BAND.idle.min) bad.push(`방치만 ${r.day}일 ${(i / b).toFixed(2)}배`);
  }
  ok(bad.length === 0, '기준(접속 20시간 + 방치 4시간): 1일 30 · 7일 70 · 30일 100 · 60일 150 / 꽉 채움 1.3배 이내 · 방치만 0.6배 이상', bad.join(' '));
  // 표준 방에서 실제로 분당 몇 마리 잡나 — 곡선이 기대는 값(27)과 맞는지
  const kpm = Object.keys(CH.JOBS).map((job) => new RoomFight(simpleRoom(60, EX.STD_ROOM), refPlayer(60, job), 3).run(300000).kills / 5);
  ok(kpm.every((k) => Math.abs(k / EX.KILLS_PER_MIN - 1) < 0.2), '표준 방 분당 처치 ≈ 27(±20%) — 다섯 직업', kpm.map((k) => k.toFixed(1)).join(' '));
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
  ok(h.learn('m1', 0, w) && h.s.mastery.done.includes('m1') && !h.s.mastery.learning, 'v505 마스터리는 값을 내면 바로 배운다(기다림 없음)');
  ok(h.learn('m2', 0, { gold: 1e6 }) && h.s.mastery.done.includes('m2'), '다음 것도 바로');
  h.s.mastery.learning = { id: 'm3', endMs: 9e15 }; ok(h.tickMastery(0) === 'm3', '예전 세이브의 「배우는 중」도 바로 끝남');
  ok(!h.canLearn('m4'), '선행 노드·레벨이 모자라면 못 배움');
  const st = h.stats();
  ok(st.final1 === 45 && st.atk > 0 && st.crit === 4, '스탯: 마스터리(셋) → 최종 피해① · 고유 스탯 → 치명');
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
  const r = new Rng(5), G = GR.newGearState(), w = { gold: 1e12, 'item:stone': 1e9, 'item:restore': 5 };   // v528 강화에 강화석
  for (let i = 0; i < 200; i++) GR.enhance(G, 'weapon', r, w, 100);
  ok(G.slots.weapon.enh === GE.ENH_MAX && GR.enhance(G, 'weapon', r, w, 100) === null, '강화 +20까지 · 실패해도 안 깨짐');
  { const G2 = GR.newGearState(), w2 = { gold: 1e12 }; ok(GR.enhance(G2, 'weapon', new Rng(1), w2, 50) === null && w2.gold === 1e12, 'v528 강화석이 없으면 강화 안 됨(은자도 안 듦)'); }
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
  ok(GC.startLevelUp(GA, 0) && GA.lv === 2 && !GA.wait, 'v505 뽑기 레벨업은 바로(기다림 없음)');
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
  ok(RM.realmStart(R, 0, w, 100) && R.lv === 1 && !R.wait, 'v505 경지는 값을 내면 바로 오른다');
  R.wait = { endMs: 9e15 }; ok(RM.realmTick(R) && R.lv === 2, '예전 세이브의 대기도 바로 끝남');
  ok(!RM.heartRoll(R, new Rng(1), w), '심법은 경지 10부터');
  R.lv = 25; ok(RM.heartRoll(R, new Rng(2), w) && R.heart.lines.slice(0, 2).every(Boolean) && !R.heart.lines[2], '경지 25 → 심법 2줄만 굴림');
  const st = RM.realmSources(R)[0].stats; ok(st.atkL2 >= 25 * S5T.REALM_ATK_P && st.hpP >= 25 * S5T.REALM_HP_P, '경지 → 공격%② · 체력%');
  const J = RM.newJourney(); const jw = { gold: 1e15 };
  ok(!RM.journeyStart(J, 0, jw, new Rng(1)), '강호행: 두목을 이기기 전엔 못 엶');
  J.cleared = 2; ok(RM.journeyStart(J, 0, jw, new Rng(1)) && J.step === 1 && !J.wait && J.opts[0].length === 2, 'v505 두목 이김 → 열기(바로) → 단계 옵션 2줄');
  ok(RM.journeySources(J)[0].stats.final3 >= S5T.JOURNEY_STEP_P && [1000, 1300, 1700, 2500].includes(RM.blessX(J, 0)), '강호행 → 최종 피해③ · 축복 상자 배율');
  ok(RM.cosmeticSources(9).length === 0 && RM.cosmeticSources(25)[0].stats.hpP === 10, '꾸미기 10개마다 합계 보너스');
}

console.log('\n=== S5 표준 무인 · 시스템 몫 ===');
{
  ok(JSON.stringify(buildStd()) === JSON.stringify(STD), '표준 무인 표가 시뮬과 같다(숫자를 바꾸면 node tools/s2sim/std.mjs로 다시 만든다)');
  { const { buildNext } = await import('../tools/s2sim/fit_exp.mjs'), { EXP_NEXT } = await import('../js/s2/tables/exp_next.js');
    ok(JSON.stringify(buildNext()) === JSON.stringify(EXP_NEXT), 'v527 경험치 표가 목표 점 · 보정으로 만든 것과 같다(바꾸면 node tools/s2sim/fit_exp.mjs)'); }
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
  ok(Object.values(CT.DAILY_DUNGEONS).every((d) => CT.CLEAR.includes(d.clear)) && CT.JOB_DUNGEON.length === PR.JOB_LV.length, '수련동 5종 · 전직 던전 차수마다');
}

console.log('\n=== S7 방치 · 대기열 · 시간 티켓 · 길잡이 · 미션 ===');
{
  const H = 3600e3, O = OF.newOffline();
  ok(OF.checkReturn(O, 1000, 'w1', 30) === null, '처음 접속은 받을 몫 없음');
  ok(OF.checkReturn(O, 1000 + 30000, 'w1', 30) === null, '1분 안 된 자리 비움은 없음');
  const p = OF.checkReturn(O, 31000 + 20 * H, 'w1', 30);
  ok(p && p.ms === 12 * H && p.capped && Math.abs(p.huntMin - 12 * 60 * 0.7) < 1e-9, '12시간에서 멈춤 · ×70%', p?.huntMin);
  ok(p.kills === Math.floor(p.huntMin * EX.KILLS_PER_MIN) && p.exp > p.kills * EX.mobExp(30) && p.gold > p.kills * GS.goldPerMob(30), 'v526 레벨을 오르며 센 사냥 벌이(떠날 때 레벨로만 센 것보다 많다)');
  { const w = OF.walk(p.kills, 30);
    const h = new Hero(newHero('sword')); h.addExp(EX.cumExp(30)); h.addExp(w.exp);
    ok(Math.abs(h.s.lv - w.lv) <= 1 && w.exp === p.exp, '방치 몫 = 오른 레벨까지(무인에 넣으면 같은 레벨)', `${h.s.lv} / ${w.lv}`); }
  ok(OF.walk(100, 150).exp === 100 * EX.mobExp(150), '만렙에서는 그 레벨 그대로');
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
  // 길잡이 — 한 줄 · 레벨 조건이 오름차순 · 첫 30분(Lv10)에 g12 앞까지
  const lvs = MS.GUIDE.filter((g) => g.ev === 'level').map((g) => +g.cond.split('>=')[1]);
  ok(lvs.every((v, i) => i === 0 || v > lvs[i - 1]) && new Set(MS.GUIDE.map((g) => g.id)).size === MS.GUIDE.length, '길잡이 레벨 단계 오름차순 · id 겹침 없음');
  const st = {}; let lv = 1;
  const evs = (cur) => ({ kill: [['kill', { n: 5 }]], level: [['level', { lv }]], equip: [['equip', {}]], gacha: [['gacha', { n: 10 }]], skill: [['skill', {}]], enhance: [['enhance', {}], ['enhance', {}], ['enhance', {}]], dungeon: [['dungeon', { job: 1, kind: 1 }]], pull: [['pull', { sys: cur.ev === 'pull' ? +cur.cond.split('==')[1] : 0, n: 10 }]] })[cur.ev];
  const elite = [['kill', { elite: 1 }]];
  // 첫 30분: 레벨은 10까지만 오른다(v527)
  for (let step = 0; step < 40; step++) {
    const cur = MS.guideCurrent(st); if (!cur) break;
    const b = new QuestBook([cur], st);
    lv = Math.min(10, lv + 2);
    for (const [e, v] of (cur.cond === 'elite' ? elite : evs(cur) || [])) b.on(e, v);
    if (!st[cur.id]?.done) break;
    b.claim(cur.id);
  }
  ok(MS.guideCurrent(st)?.id === 'g12', 'Lv10 · 첫 30분 할 일로 길잡이 g10까지 · g12(두목)에서 기다림', MS.guideCurrent(st)?.id);
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
  ok(AB.claimable().sort().join() === 'a_level_0,a_level_1,a_level_2,a_level_3,a_level_4', '레벨 업적은 그 레벨까지 한꺼번에(v538 30 · 50 · 70 · 100 · 120)');
  const SB = new QuestBook(A, {}); for (let i = 0; i < 100; i++) SB.on('star', { s: 3 }); SB.on('enhance'); SB.on('dungeon', { stage: 12 }); SB.on('dungeon', { kind: 1 });
  ok(SB.claimable().includes('a_star_0') && SB.get('a_enhance_0').p === 1 && SB.get('a_dungeon_0').p === 1, 'v538 수가 없는 사건(성혼 · 강화 · 던전)도 한 번에 1 · 칸 클리어는 던전이 아님(전엔 성혼 업적이 오르지 않았다)');
  { const T0 = 1.8e12, g = new Game(newGame('sword', T0, 2), T0); g.feed.length = 0; g.emit('kill', { n: 1000 }); ok(g.feed.some((f) => f.k === 'ach' && f.id === 'a_kill_0'), 'v538 업적을 깨면 알림'); }
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
  ok(RK.checkProfile(p).length === 0 && RK.checkProfile({ ...p, power: p.power * 10 }).length === 1 && RK.checkProfile({ ...p, lv: 151 }).length === 1, '서열 값 점검: 표준의 6배 넘는 전투력 · 없는 레벨은 걸림');
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
  const lv = g.S.hero.lv, gc = MS.guideCurrent(g.S.q.guide), gi = gc ? MS.GUIDE.indexOf(gc) : MS.GUIDE.length;   // v527 몇 번째 단계(id 순서와 다름)
  ok(lv >= 8 && lv <= 12, 'v527 30분 플레이 → Lv 8~12(목표 10)', `Lv ${lv} · 처치 ${g.S.kills}`);
  ok(g.S.kills / 30 >= 10 && g.S.kills / 30 <= 32 && g.stage().idx >= 8, '30분: 분당 처치 10~32(칸 두목 · v532 장 두목전 시간 포함) · 8칸 넘게 전진(v527 느린 곡선)', `${(g.S.kills / 30).toFixed(1)}/분 · ${g.stage().idx}칸`);
  ok(gi >= 6, 'v527 길잡이 6단계 이상(Lv10 단계 앞까지)', `${gi}단계 · ${gc?.id}`);
  ok(g.S.hero.adv === 0 && g.fight.deaths <= 2, 'v527 1차 전직 전(Lv20에) · 사냥 중 거의 죽지 않음(30분에 2번 이하)', `전직 ${g.S.hero.adv} · 죽음 ${g.fight.deaths}`);
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

console.log('\n=== S9 옆보기 사냥(층층 발판 · 점프 · 스테이지) ===');
{
  // 맵: 위층 발판은 늘 바로 아래층과 1.5미터 넘게 겹친다(어디든 뛰어 오를 수 있음)
  let bad = 0;
  for (let sd = 1; sd <= 60; sd++) { const m = makeSideMap(sd); for (const p of m.plats) if (p.y > 0 && !m.plats.some((b) => b.y === p.y - 2300 && Math.min(b.x1, p.x1) - Math.max(b.x0, p.x0) >= 1500)) bad++; }
  ok(bad === 0, '맵 60개: 모든 위층 발판 아래에 디딤 발판', bad);
  const rates = ['sword', 'spear', 'fist', 'bow', 'mage'].map((job) => { const F = new SideFight(sideRoom(60, 3, { n: 18, coolMs: 1000 }), refPlayer(60, job), 7).run(120000); return F.kills / 2; });
  ok(rates.every((r) => r >= 22 && r <= 45), '자동 사냥(기준 무인, 2분): 분당 처치 22~45 — 다섯 직업', rates.join(' '));
  // 손 조작: 오른쪽으로 달리기 · 점프해서 위층 · 내려가기
  const F = new SideFight(sideRoom(30, 5), refPlayer(30), 3, { auto: false });
  F.mobs = [];  F.famState.a.keep = 0;
  const x0 = F.hero.x; F.press({ dir: 1 }); F.run(1000);
  ok(F.hero.x - x0 > 3500 && F.hero.plat === 0, '수동: ▶ 누르면 오른쪽으로 달린다', F.hero.x - x0);
  F.press({ dir: 0 });
  const up = F.def.map.plats.findIndex((p) => p.y === 2300);
  F.hero.x = F.def.map.plats[up].x0 + 800; F.press({ jump: 1 }); F.run(1500);
  ok(F.hero.plat === up && F.hero.y === 2300, '점프로 위층 발판에 올라선다');
  F.press({ down: 1 }); F.run(1500);
  ok(F.hero.plat === 0 && F.hero.y === 0, '▼ 로 아래층으로 내려간다');
  // 재현: 같은 입력 기록 = 같은 결과
  const a = new SideFight(sideRoom(40, 9), refPlayer(40), 11, { auto: false });
  for (let i = 0; i < 1200; i++) { if (i % 100 === 0) a.press({ dir: i % 200 ? -1 : 1 }); if (i % 70 === 0) a.press({ jump: 1 }); if (i % 130 === 0) a.press('skill'); a.step(); }
  const b = replaySide(sideRoom(40, 9), refPlayer(40), a.log, a.t, { auto: false });
  ok(a.digest() === b.digest() && a.log.actions.length > 20, '옆보기 손 조작 기록 → 같은 결과로 재현', a.digest());
  // 스테이지: 20마리 → 도전 → 이기면 다음 칸 · 지면 다시 채운 뒤
  const T0 = 1.9e12, gg = new Game(newGame('sword', T0, 3), T0); gg.addExp(5e6);
  gg.stage().auto = false;
  ok(!gg.canChallenge() && !gg.challenge(), `칸 몹 ${STAGE_KILLS}마리 전엔 도전 못 함`);
  let t = T0; while (gg.stage().kills < STAGE_KILLS && t < T0 + 600e3) { t += 1000; gg.tick(t); gg.hunt(1000); }
  ok(gg.canChallenge() && gg.challenge() && !!gg.bossFight, '20마리 잡으면 도전 → 두목전');
  let res = null; while (!res && t < T0 + 900e3) { t += 1000; gg.tick(t); gg.hunt(1000); res = gg.feed.find((f) => f.k === 'stage-clear' || f.k === 'stage-fail'); }
  ok(res?.k === 'stage-clear' && gg.stage().idx === 2 && gg.stage().kills === 0 && !gg.bossFight, '센 무인은 이기고 다음 칸으로', res?.k);
}

console.log('\n=== S9 무공 세트(직업마다 공격 6 · 상시 3 · 버프 2 · 6칸 · 자동) ===');
{
  ok(Object.values(KT.KIT).every((k) => k.length === 11 && k.filter((x) => x.kind === 'active').length === 6 && k.filter((x) => x.kind === 'passive').length === 3 && k.filter((x) => x.kind === 'buff').length === 2), '다섯 직업 × 무공 11(공격 6 · 상시 3 · 버프 2)');
  const h = new Hero(newHero('spear')); h.addExp(EX.cumExp(60));
  ok(Object.keys(h.s.kit.lv).length === 1 && h.s.kit.slots[0] === 'spear_0', '처음엔 0차 무공 하나 · 칸에 저절로');
  h.clearDungeon('job1'); h.advance(); h.clearDungeon('job2'); h.advance();
  ok(Object.keys(h.s.kit.lv).length === 5 && h.s.kit.slots.length === 4 && KT.skillById(h.s.kit.slots[0]).tier === 2, '2차 전직 → 무공 5개(공격 3 · 버프 1 · 상시 1) · 높은 차수가 앞 칸');
  const st0 = h.stats().atk; const w = { gold: 1e9 };
  ok(h.kitUp('spear_2', w) && h.s.kit.lv.spear_2 === 2 && h.stats().atk > st0, '상시 무공 레벨업 → 스탯 오름');
  ok(h.kitSlot(0, 'spear_0') && h.s.kit.slots[0] === 'spear_0', '칸 바꾸기(맞바꿈)');
  h.kitAuto('spear_4', false); ok(h.battleKit().find((k) => k.id === 'spear_4').auto === false, '칸마다 자동 끄기');
  // 표준 세트: 레벨이 오를수록 무공 몫이 커짐 · 몹 체력은 그에 맞춰
  const dp = [20, 60, 120, 150].map((L) => { const p = refPlayer(L); return p.kit.length; });
  ok(dp.join() === '2,4,6,6', '기준 무인 무공 칸 수: Lv20(1차) 2 · 60 4 · 120 6 · 150 6(v527 전직 레벨)', dp.join());
  // 전투: 자동이면 칸 무공을 쓰고 · 버프가 스탯을 올리고 · 수동이면 누른 칸만
  const F = new SideFight(sideRoom(60, 4), refPlayer(60), 5); F.run(20000);
  const casts = F.digest() && F.events.length;
  const F2 = new SideFight(sideRoom(60, 4), refPlayer(60), 5); let nCast = 0, nBuff = 0, critUp = false;
  for (let i = 0; i < 600; i++) { F2.step(); for (const e of F2.events) { if (e[0] === 'cast') nCast++; if (e[0] === 'buff') { nBuff++; critUp = F2.hero.st.crit > F2.hero.st0.crit; } } F2.events = []; }
  ok(nCast >= 5 && nBuff >= 1 && critUp, '자동: 30초에 무공 여러 번 · 버프로 치명 오름', `무공 ${nCast} · 버프 ${nBuff}`);
  const M = new SideFight(sideRoom(60, 4), refPlayer(60), 5, { auto: false }); let mc = 0;
  M.hero.x = M.mobs[0].x - 800; M.hero.y = M.mobs[0].y; M.hero.plat = M.mobs[0].plat;
  for (let i = 0; i < 100; i++) { M.step(); for (const e of M.events) if (e[0] === 'cast') mc++; M.events = []; }
  ok(mc === 0, '수동이면 무공을 저절로 쓰지 않는다');
  M.hero.x = M.mobs[0].x - 800; M.hero.y = M.mobs[0].y; M.hero.plat = M.mobs[0].plat; M.hero.target = -1;
  M.press({ slot: 0 }); for (let i = 0; i < 4; i++) { M.step(); for (const e of M.events) if (e[0] === 'cast') mc++; M.events = []; }
  ok(mc === 1, '누른 칸 무공을 쓴다');
}

console.log('\n=== S9 장마다 몹 모습(v501) ===');
{
  const { ROSTER, mobLook } = await import('../js/s2/tables/mobs.js');
  const fs = await import('node:fs');
  const miss = [];
  for (const R of ROSTER) for (const [, a] of [...R.mobs, R.elite, R.boss]) { const [src, key] = a.split(':'); const f = src === 'cr' ? (fs.existsSync(`art/cr/${key}.png`) ? `art/cr/${key}.png` : `art/cr/${key}.webp`) : src === 's2' ? `art/s2/mob/${key}.webp` : `art/boss/${key}.png`; if (!fs.existsSync(f)) miss.push(a); }
  ok(ROSTER.length === 15 && ROSTER.every((R) => R.mobs.length === 4 && R.elite && R.boss) && miss.length === 0, '장 15 × 일반 넷 · 정예 · 두목 — 그림 파일 전부 있음', miss.join(' '));
  const seen = new Set(Array.from({ length: 40 }, (_, i) => mobLook(3, { id: i + 1, kind: 'mob' })[0]));
  ok(seen.size === 4 && mobLook(11, { id: 1, kind: 'boss' })[0] === '천마', '한 장 안에서 넷이 고루 나온다 · 11장 두목 천마', [...seen].join(','));
}

console.log('\n=== S9 동료 공격 · 두목 패턴(v497) ===');
{
  // 동료: 장착한 만큼 따로 친다(피해 숫자 종류 2)
  const F = new SideFight(sideRoom(60, 4), { ...refPlayer(60), pals: [{ g: 0 }, { g: 2 }] }, 5); let ph = 0, pe = 0;
  for (let i = 0; i < 1200; i++) { F.step(); for (const e of F.events) { if (e[0] === 'hit' && e[5] === 2) ph++; if (e[0] === 'pal') pe++; } F.events = []; }
  ok(ph >= 20 && pe >= 20, '동료 둘이 60초에 여러 번 친다', `동료 타격 ${ph} · 시전 ${pe}`);
  const N = new SideFight(sideRoom(60, 4), { ...refPlayer(60), pals: [] }, 5); let nh = 0;
  for (let i = 0; i < 600; i++) { N.step(); for (const e of N.events) if (e[0] === 'hit' && e[5] === 2) nh++; N.events = []; }
  ok(nh === 0, '동료가 없으면 동료 타격도 없다');
  ok(KT.stdPals(10).length === 1 && KT.stdPals(150).length === 5 && KT.stdPals(150)[0].g === 3, '표준 동료: Lv10 1마리 · Lv150 5마리(등급 3)');
  // 두목 패턴: 예고 → 터짐. 수동으로 범위 밖으로 나가면 안 맞는다
  const B = new SideFight(sideRoom(60, 4), refPlayer(60), 9, { auto: false });
  B.mobs = []; B.spawn('b', B.def.map.spots[0]); const boss = B.mobs[0]; boss.angry = true;
  B.hero.x = boss.x; B.hero.y = boss.y; B.hero.plat = boss.plat;
  let tell = null, burst = null;
  for (let i = 0; i < 200 && !tell; i++) { B.step(); for (const e of B.events) if (e[0] === 'tell') tell = e; B.events = []; }
  B.hero.x = tell[4] + (tell[6] / 2 + 2500) * (B.hero.x > tell[4] ? 1 : -1); B.hero.y = boss.y - 2300 * 3; B.hero.plat = -1;
  for (let i = 0; i < 100 && !burst; i++) { B.step(); for (const e of B.events) if (e[0] === 'burst') burst = e; B.events = []; }
  ok(tell && burst && burst[7] === 0 && burst[1] - tell[1] === tell[7], '두목: 예고 뒤 정해진 시간에 터짐 · 피하면 안 맞음', tell && tell[3]);
  const C = new SideFight(sideRoom(60, 4), refPlayer(60), 9, { auto: false });
  C.mobs = []; C.spawn('b', C.def.map.spots[0]); const b2 = C.mobs[0]; b2.angry = true; let hit2 = null;
  for (let i = 0; i < 400 && !hit2; i++) { C.hero.x = b2.x; C.hero.y = b2.y; C.hero.plat = b2.plat; C.hero.vy = 0; C.step(); for (const e of C.events) if (e[0] === 'burst') hit2 = e; C.events = []; }
  ok(hit2 && hit2[7] === 1, '두목: 가만히 있으면 맞는다', hit2 && hit2[3]);
  // v505 자동이면 예고 범위 밖으로 비킨다
  const A = new SideFight(sideRoom(60, 4), refPlayer(60), 9); let dodged = 0, burstN = 0;
  A.mobs = []; A.spawn('b', A.def.map.spots[0]); const b3 = A.mobs[0]; b3.angry = true; A.hero.x = b3.x + 300; A.hero.y = b3.y; A.hero.plat = b3.plat;
  for (let i = 0; i < 1200 && burstN < 4; i++) { A.step(); for (const e of A.events) if (e[0] === 'burst') { burstN++; if (!e[7]) dodged++; } A.events = []; }
  ok(burstN >= 3 && dodged >= burstN - 1, 'v505 자동: 두목 패턴 범위 밖으로 비킨다', `${dodged}/${burstN}`);
}

console.log('\n=== S9 무공 강화 트리(무공마다 3단 · 점수 · 배우는 시간 · 초기화) ===');
{
  const h = new Hero(newHero('sword')); h.addExp(EX.cumExp(61)); h.clearDungeon('job1'); h.advance(); h.clearDungeon('job2'); h.advance();
  const P0 = h.treePts(31);
  ok(P0.total === 60 + 9 && P0.left === P0.total, '무공 점수 = 레벨마다 1 · 10칸마다 3(Lv61 · 31칸 → 69)', P0.total);
  ok(!h.canTreeUp('sword_1', 'rng', 31), '2단(범위)은 그 무공에 5점 쓰기 전엔 잠김');
  for (let i = 0; i < 5; i++) h.treeUp('sword_1', 'pow', 0, 31);
  const k1 = h.battleKit().find((k) => k.id === 'sword_1'), base = KT.battleKit([{ ...KT.skillById('sword_1'), lv: 1 }])[0];
  ok(k1.coef === Math.round(base.coef * 1.25) && h.canTreeUp('sword_1', 'rng', 31), '위력 5 → 계수 +25% · 2단 열림');
  for (let i = 0; i < 3; i++) h.treeUp('sword_1', 'tgt', 0, 31);
  for (let i = 0; i < 2; i++) h.treeUp('sword_1', 'rng', 0, 31);
  ok(h.battleKit().find((k) => k.id === 'sword_1').maxT === 7, '대상 수 +3 → 4마리가 7마리');
  ok(h.treeSpent('sword_1') === 15 && h.treeUp('sword_1', 'hit', 1000, 31) === true && h.canTreeUp('sword_1', 'cri', 31), 'v505 3단 연타도 바로 배운다(기다림 없음) · 다른 3단도 곧장');
  ok(h.battleKit().find((k) => k.id === 'sword_1').hits === 3, '연타 +1(2연타 → 3연타)');
  const bf = h.s.kit.slots.find((id) => KT.skillById(id).kind === 'buff');
  h.treeUp(bf, 'amp', 0, 31) || true; for (let i = 0; i < 5; i++) h.treeUp(bf, 'dur', 0, 31); h.treeUp(bf, 'amp', 0, 31);
  const b1 = h.battleKit().find((k) => k.id === bf);
  ok(b1.durMs === 30000 && b1.buff.crit > KT.skillById(bf).stats(1).crit, '버프 트리: 지속 +50% · 효과 ↑', `${b1.durMs}ms`);
  const used = h.treePts(31).used, w = { gold: 1e9 };
  ok(used > 0 && h.treeReset(w, 31) && h.treePts(31).used === 0 && w.gold < 1e9, '초기화 — 점수 돌려받음 · 은자');
}

console.log('\n=== v527 성장 곡선 — 실제 엔진 2일(봇: 접속 20시간 + 방치 4시간) ===');
{
  const { play } = await import('../tools/s2sim/play.mjs');
  const days = [1, 2], r = play({ days: 2, active: 1200, job: 'sword', seed: 3, marks: days.map((d) => d * 1440) }).out;
  const at = (d) => r[days.indexOf(d)];
  ok(Math.abs(at(1).lv - 30) <= 3, 'v527 1일 Lv30(±3) — 진행 목표 J1', at(1).lv);
  ok(Math.abs(at(2).lv - PS.levelAtDay(2)) <= 4, '2일: 곡선 모델 ±4', `${at(2).lv} / ${PS.levelAtDay(2).toFixed(1)}`);
  ok(at(2).adv >= 1, '1차 전직(Lv20)을 했다', `${at(2).adv}차`);
  ok(at(2).bossFail <= 60, '칸 두목 자동 재도전은 더 강해진 뒤 — 이틀에 진 횟수 60번 아래', `${at(2).bossWin}승 ${at(2).bossFail}패`);
}
{
  // 자동 재도전 조건
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 1), T0), T = g.stage();
  T.idx = 80; T.kills = STAGE_KILLS; g.challenge(); g.endChallenge(false); T.kills = STAGE_KILLS;
  ok(T.failIdx === 80 && !g.autoReady() && g.canChallenge(), '진 칸: 자동 도전은 기다림(손 「도전」은 됨)');
  g.S.hero.lv++; ok(g.autoReady(), '레벨이 오르면 다시 자동 도전');
  g.S.hero.lv--; T.failPw = Math.floor(g.power() / 1.06); ok(g.autoReady(), '전투력 +5% 넘으면 다시 자동 도전');
  // v527 남은 두목 예고(붉은 범위)에 묶여 제자리에서 흔들리지 않는다 — 쓰러지면 예고를 거두고, 끝난 예고는 피하지 않는다
  { const g3 = new Game(newGame('sword', T0, 2), T0); g3.S.hero.lv = 30; g3.stage().idx = 20; const F = g3.ensureFight(), H = F.hero;
    F.mobs[0].pat = { id: 'eye', at: 0, end: F.t - 1, x: H.x, y: H.y, w: 1800, dmgX: 1, shape: 'target' };
    let k = 0; for (let i = 0; i < 60; i++) { g3.tick(T0 + i * 1000); k += g3.hunt(1000); }
    ok(k > 0, 'v527 끝난 두목 예고가 남아 있어도 사냥을 이어 간다', `처치 ${k}`); }
  // v527 물러나기: 한 칸에서 3번 쓰러지면 앞 칸 · 다시 나아가기는 더 강해진 뒤
  { const g4 = new Game(newGame('sword', T0, 1), T0), T4 = g4.stage(); T4.idx = 60; T4.top = 60;
    for (let i = 0; i < 300; i++) { g4.tick(T0 + i * 1000); g4.hunt(1000); }
    ok(T4.idx < 60 && T4.top === 60 && T4.failIdx === T4.idx && !g4.autoReady(), 'v527 Lv1이 60칸에서 계속 쓰러지면 앞 칸으로 물러남(가장 멀리 간 칸은 그대로)', `칸 ${T4.idx}`); }
  // 칸 클리어는 「던전 n번」 미션이 아니다
  const g2 = new Game(newGame('sword', T0, 1), T0); g2.endChallenge(true);
  ok((g2.books.daily.get('d_dungeon').p || 0) === 0 && (g2.books.weekly.get('w_dungeon').p || 0) === 0, 'v526 칸 클리어는 일일 · 주간 「던전」 미션에 세지 않음');
}

console.log('\n=== v531 실제 던전(옆보기 엔진) ===');
{
  const T0 = 1.8e12, mk = () => { const g = new Game(newGame('sword', T0, 9), T0); g.addExp(EX.cumExp(40)); g.tick(T0); g.S.wallet['ticket:gear'] = 300; g.S.wallet.gold = 1e9; g.S.wallet['item:stone'] = 1e5; for (let i = 0; i < 30; i++) g.pullGear(10); GR.equipBest(g.S.gear, 40); for (const s of GE.SLOTS) for (let i = 0; i < 12; i++) g.enhance(s); g.dirtyStats = true; return g; };   // 장비를 갖춘 Lv40
  const g = mk();
  ok(new Game(newGame('sword', T0, 9), T0).canDungeon('daily', 'gold').includes('Lv 20'), '레벨이 모자라면 못 들어감(이유를 알려 줌)');
  const st0 = g.S.dungeons.runs.gold || 0;
  ok(g.enterDungeon('daily', 'gold') && g.dg && g.ensureFight() === g.dg.F && (g.S.dungeons.runs.gold || 0) === st0 + 1 && !g.canChallenge(), '입장: 입장권 · 횟수를 쓰고 사냥터 대신 던전이 싸움판(칸 두목 도전은 멈춤)');
  ok(!g.enterDungeon('daily', 'gear') && g.canDungeon('daily', 'gear') === '다른 싸움 중이에요', '던전 안에서 또 못 들어감');
  for (let i = 0; i < 20; i++) g.hunt(1000);
  const s1 = g.dgStatus();
  ok(s1 && s1.p > 0 && s1.leftMs < 90000 && /처치 \d+ \/ 50/.test(s1.label), '진행 상황: 목표 · 남은 시간', s1?.label);
  ok(g.leaveDungeon() && !g.dg && g.feed.some((f) => f.k === 'dungeon-end' && f.gaveUp && !f.cleared), '나가기 → 실패로 끝 · 사냥터로');
  const a = mk(), b = mk();
  const ra = a.runNow('daily', 'growth'), rb = b.runNow('daily', 'growth');
  ok(ra && ra.cleared && ra.ms === rb.ms && ra.kills === rb.kills && ra.exp > 0, '소탕(바로 끝까지) — 같은 씨앗 = 같은 결과 · 깨면 보상', `${ra?.ms}ms · 처치 ${ra?.kills}`);
  ok(a.S.dungeons.best?.growth === true && !a.dg && !a.feed.some((f) => f.k === 'dungeon-end'), '한 번 깨면 소탕 가능 표시 · 소탕은 결과 창을 띄우지 않음');
  const t = mk(), f0 = t.S.tower.best, rt = t.towerFight();
  ok(rt && (rt.cleared ? t.S.tower.best === f0 + 1 : t.S.tower.best === f0), '무한의 탑도 같은 엔진', `${f0} → ${t.S.tower.best}`);
}

console.log('\n=== v532 장 두목(10칸마다) ===');
{
  const CBT = await import('../js/s2/tables/chboss.js');
  ok(CBT.CHBOSS.length === 16 && CBT.CHBOSS.slice(1).every((d) => d.name && d.title && d.pats.length >= 2 && d.pats.every((p) => CBT.CB_PATS[p])), '장 두목 15 — 이름 · 칭호 · 패턴 둘 이상');
  ok(CBT.CHBOSS.slice(1).every((_, i) => fs.existsSync(new URL(`../art/s2/chb/chb${i + 1}.webp`, import.meta.url))), '장 두목 그림 15장');
  const T0 = 1.8e12, mk = (lv) => { const g = new Game(newGame('sword', T0, 4), T0); g.addExp(EX.cumExp(lv)); g.tick(T0); g.S.wallet['ticket:gear'] = 600; g.S.wallet.gold = 1e12; g.S.wallet['item:stone'] = 1e6; for (let i = 0; i < 60; i++) g.pullGear(10); GR.equipBest(g.S.gear, lv); for (const s of GE.SLOTS) for (let i = 0; i < 14; i++) g.enhance(s); g.dirtyStats = true; return g; };
  const fight = (g, idx) => { const T = g.stage(); T.idx = idx; T.top = idx; T.kills = STAGE_KILLS; g.challenge(); const ev = {}; let t = T0; while (g.bossFight) { t += 1000; g.tick(t); g.hunt(1000); for (const e of g.lastEvents || []) { const k = e[0] === 'tell' ? e[3] : e[0]; ev[k] = (ev[k] || 0) + 1; } } return { ev, f: g.feed.filter((x) => x.k === 'stage-clear' || x.k === 'stage-fail').at(-1) }; };
  const g = mk(18), T = g.stage(); T.idx = 10; T.top = 10; T.kills = STAGE_KILLS; g.challenge();
  const bm = g.bossFight.mobs.find((m) => m.cb);
  ok(g.isChapterBoss(10) && !g.isChapterBoss(9) && bm && bm.cb.ch === 1 && g.bossFight.limitMs === CBT.CB.limitMs && g.bossFight.def.chb === 1, '10칸 = 장 두목(전용 무대 · 150초) · 9칸은 보통 두목');
  g.bossFight = null;
  const r = fight(mk(18), 10);
  ok(r.f.k === 'stage-clear' && r.ev.phase >= 2 && r.ev.ult >= 1, '1장 두목: 국면 두 번(분노 · 필살) · 필살이 나오고 이긴다', JSON.stringify(r.ev));
  ok(r.f.chb?.first && r.f.chb.gear && r.f.chb.gear.g === CBT.cbGearGrade(1), '첫 처치: 확정 장비(그 장 등급) · 칭호', JSON.stringify(r.f.chb));
  const g2 = mk(18); fight(g2, 10); const r2 = fight(g2, 10), r3 = fight(g2, 10);
  ok(g2.S.titles?.length === 1 && !r2.f.chb.first && r2.f.chb.stones === CBT.CB_REPEAT.stones && r3.f.chb.stones === 0, '다시 깨면 강화석 · 뽑기권 — 장마다 하루 한 번', `${r2.f.chb.stones} / ${r3.f.chb.stones}`);
  // 무력화: 무공을 맞히면 게이지 → 기절(피해 ×2 · 패턴 없음)
  const g3 = mk(18), T3 = g3.stage(); T3.idx = 10; T3.top = 10; T3.kills = STAGE_KILLS; g3.challenge();
  const F3 = g3.bossFight, m3 = F3.mobs.find((m) => m.cb); m3.cb.gg = 990; F3.strike(m3, { coef: 100, base: false });
  ok(m3.stunUntil > F3.t && m3.cb.gg === 0 && !m3.pat, '무력화 게이지가 차면 기절');
  m3.hp = m3.st.hp = 1e12; const su = m3.stunUntil; let h0 = m3.hp; for (let i = 0; i < 30; i++) F3.strike(m3, { coef: 100, base: true }); const d2 = h0 - m3.hp; m3.stunUntil = 0; h0 = m3.hp; for (let i = 0; i < 30; i++) F3.strike(m3, { coef: 100, base: true }); const d1 = h0 - m3.hp; void su;   // 30번씩 평균(치명 · 흔들림)
  ok(d2 > d1 * 1.5, '기절한 두목은 피해 ×2', `${d2} / ${d1}`);
  // 필살: 안전 지대 밖이면 맞고, 자동이면 안전 지대로 피한다
  const g4 = mk(18), T4 = g4.stage(); T4.idx = 10; T4.top = 10; T4.kills = STAGE_KILLS; g4.challenge();
  const F4 = g4.bossFight, m4 = F4.mobs.find((m) => m.cb); m4.cb.phase = 2; m4.nextUlt = 0; m4.nextPat = 0; m4.angry = true;
  let safe = null; for (let i = 0; i < 40 && !safe; i++) { F4.step(); safe = m4.pat?.safe; }
  for (let i = 0; i < 60 && m4.pat; i++) F4.step();
  ok(safe && F4.hero.x >= safe[0] && F4.hero.x <= safe[1], '필살: 자동이면 안전 지대로 피한다', `${F4.hero.x} in ${safe}`);
}

console.log('\n=== v534 장비 줍기 알림 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 6), T0);
  g.feed.length = 0; g.obtain([GR.makeGear(g.rng, 'weapon', 4), GR.makeGear(g.rng, 'ring', 1)]);
  const L = g.feed.filter((f) => f.k === 'loot');
  ok(L.length === 1 && L[0].g === 4 && L[0].slot === 'weapon' && L[0].equipped, '진품 이상을 주우면 알림(낀 것인지) · 낮은 등급은 조용히');
  g.feed.length = 0; g.S.wallet['ticket:gear'] = 10; g.pullGear(10);
  ok(!g.feed.some((f) => f.k === 'loot'), '뽑기는 제 연출이 있어 줍기 알림 없음');
}

console.log('\n=== v535 월드보스 실제 싸움 ===');
{
  const WBT = await import('../js/s2/online/wboss.js'), CBT = await import('../js/s2/tables/chboss.js');
  ok(fs.existsSync(new URL('../art/s2/chb/wb1.webp', import.meta.url)), '월드보스 그림');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 8), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(g.enterDungeon('wboss') && g.dg.type === 'wboss' && g.dg.limitMs === 90000 && g.ensureFight().mobs.some((m) => m.cb?.wb), '도전 → 실제 싸움(쓰러지지 않는 거대 두목 · 90초)');
  const F = g.dg.F, m = F.mobs.find((x) => x.cb?.wb);
  F.t = 1000; m.hp = 1e15; let h = m.hp; for (let i = 0; i < 30; i++) F.strike(m, { coef: 100, base: true }); const dGuard = h - m.hp;
  F.t = 25000; h = m.hp; for (let i = 0; i < 30; i++) F.strike(m, { coef: 100, base: true }); const dWeak = h - m.hp;
  ok(dWeak > dGuard * 2.4, '약점 노출(20~30초) 피해가 방어 자세의 세 배', `${dWeak} / ${dGuard}`);
  F.t = 0; F.dmgOut = 0;
  for (let i = 0; i < 200 && g.dg; i++) g.hunt(1000);
  const r = g.feed.find((f) => f.k === 'dungeon-end' && f.type === 'wboss');
  ok(r && r.cleared && r.dmg > 0 && r.score === WBT.bossScore(r.dmg, 40) && g.S.wb.used === 1 && g.S.wb.total === r.score, '90초 뒤 끝 — 넣은 피해 → 보스 점수(구간표) · 하루 횟수 · 주간 합', `피해 ${r?.dmg} · 점수 ${r?.score}`);
  g.runNow('wboss'); g.runNow('wboss');
  ok(g.canDungeon('wboss') === '오늘은 다 했어요' && !g.enterDungeon('wboss'), '하루 3번');
}

console.log('\n=== v536 출석 ===');
{
  const AT = await import('../js/s2/tables/attend.js');
  ok(AT.ATTEND.length === AT.ATTEND_DAYS + 1 && [7, 14, 21, 28].every((d) => AT.ATTEND[d].big), '28칸 · 7 · 14 · 21 · 28일은 큰 보상');
  const DAY = 86400e3, T0 = Date.UTC(2026, 0, 5, 3), g = new Game(newGame('sword', T0, 2), T0); g.tick(T0);
  const t0 = g.S.wallet['ticket:gear'] || 0;
  ok(g.canAttend() && g.attend()?.day === 1 && !g.canAttend() && g.attend() === null, '하루 한 번');
  for (let d = 1; d < 7; d++) { g.tick(T0 + d * DAY); g.attend(); }
  ok(g.attendState().n === 7 && (g.S.wallet['ticket:gear'] || 0) >= t0 + 5 + 20, '7일째 — 장비 뽑기권 20(큰 보상)', g.S.wallet['ticket:gear']);
  for (let d = 7; d < 28; d++) { g.tick(T0 + d * DAY); g.attend(); }
  ok(g.attendState().cycle === 1 && g.S.titles?.includes('28일 개근') && g.attendNext() === 1, '28일을 채우면 칭호 · 다시 1일부터');
  g.tick(T0 + 40 * DAY); const r = g.attend();
  ok(r?.day === 1, '빠진 날이 있어도 다음 칸(건너뛰지 않음)');
}

console.log('\n=== v537 칭호 ===');
{
  const TT = await import('../js/s2/tables/titles.js');
  ok(TT.TITLES.filter((t) => !/^mx\d+$/.test(t.id)).length === 17 && new Set(TT.TITLES.map((t) => t.name)).size === TT.TITLES.length, '칭호 17(장 두목 15 · 28일 개근 · v555 두목 도감 완성) + v636 요괴록 15 · 이름은 서로 다르다');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 3), T0); g.addExp(EX.cumExp(60)); const p0 = g.power();   // Lv1은 공격이 작아 2%가 반올림에 묻힌다
  g.S.titles = ['녹림대왕 격파', '28일 개근', '없는 칭호']; g.dirtyStats = true;
  const st = g.fighter().st;
  ok(g.titleSources()[0]?.stats.atkP === 20 && g.power() > p0, '얻은 칭호마다 수집 효과(모르는 이름은 빼고) · 전투력이 오른다', `${p0} → ${g.power()}`);
  ok(g.setTitle('28일 개근') && g.S.titleOn === '28일 개근' && !g.setTitle('사왕 격파') && g.setTitle(null) && g.S.titleOn === null, '얻은 칭호만 달 수 있음 · 떼기');
  void st;
}

console.log('\n=== v539 대결 화면(기록 다시 보기) ===');
{
  const T0 = 1.8e12, g = new Game(newGame('bow', T0, 4), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  let okAll = true, wins = 0;
  for (let i = 0; i < 3; i++) {
    const r = g.pvpFight(i); if (!r) { okAll = false; break; }
    const left = [r.myHp, r.opp.hp]; for (const e of r.log) left[e[1]] -= e[2];
    const ra = Math.max(0, left[0]) / r.myHp, rd = Math.max(0, left[1]) / r.opp.hp;
    if (Math.abs(ra - r.ra) > 1e-9 || Math.abs(rd - r.rd) > 1e-9 || r.log.some((e) => e[0] > r.ms)) okAll = false;
    if (r.win) wins++;
  }
  ok(okAll, '기록을 그대로 다시 깎으면 엔진의 남은 체력과 같다(화면 = 결과)');
}

console.log('\n=== v540 두목 패턴 자동 피하기 설정 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 1), T0); g.tick(T0);
  ok(g.ensureFight().autoDodge === true, '처음엔 켜짐(자동 전투 때 피한다)');
  const T = g.stage(); T.idx = 9; T.kills = STAGE_KILLS; g.challenge();
  g.setDodge(false);
  ok(g.fight.autoDodge === false && g.bossFight.autoDodge === false, '끄면 지금 들판 · 두목전에도 바로');
  const g2 = Game.load(g.save(), T0); g2.endChallenge?.(false);
  ok(g2.S.dodge === false && g2.ensureFight().autoDodge === false, '저장했다 불러도 꺼진 채');
  g2.setDodge(true); ok(g2.ensureFight().autoDodge === true, '다시 켜면 피한다');
}

console.log('\n=== v541 장 두목 토벌(다시 치기 · 별) ===');
{
  const CBT = await import('../js/s2/tables/chboss.js');
  const T0 = 1.8e12, mk = (lv) => { const g = new Game(newGame('sword', T0, 4), T0); g.addExp(EX.cumExp(lv)); g.tick(T0); g.S.wallet['ticket:gear'] = 600; g.S.wallet.gold = 1e12; g.S.wallet['item:stone'] = 1e6; for (let i = 0; i < 60; i++) g.pullGear(10); GR.equipBest(g.S.gear, lv); for (const s of GE.SLOTS) for (let i = 0; i < 14; i++) g.enhance(s); g.dirtyStats = true; return g; };
  const run = (g) => { let t = g.now; while (g.bossFight) { t += 1000; g.tick(t); g.hunt(1000); } return g.feed.filter((x) => x.k === 'raid-end').at(-1); };
  const g = mk(18), T = g.stage(); T.idx = 12; T.top = 12;
  ok(!g.canRaid(1), '깨지 않은 두목은 토벌 못 함');
  g.S.chb = { 1: 1 };
  const w0 = { ...g.S.wallet }, k0 = T.kills;
  ok(g.raidLv(1) === 12 && g.raid(1) && g.bossFight.def.raid && g.bossFight.def.lv === 12, '토벌: 지금 칸 강함(12)으로 — 장 두목 무대');
  const f = run(g);
  ok(f && f.win && f.stars >= 1 && T.idx === 12 && T.kills === k0, '이기면 별 · 칸 진행은 그대로', JSON.stringify({ stars: f?.stars, ms: f?.ms }));
  const gotT = g.S.wallet['ticket:gear'] - w0['ticket:gear'], want = CBT.CB_RAID.tix + CBT.CB_RAID.starRew.slice(0, f.stars).reduce((a, r) => a + (r['ticket:gear'] || 0), 0);
  ok(gotT === want && g.S.raid.star[1] === f.stars && g.S.raid.best[1] === f.ms, '보상: 뽑기권 · 강화석 + 처음 딴 별 보상', `${gotT} / ${want}`);
  g.raid(1); const f2 = run(g);
  ok(f2.newStars === Math.max(0, f2.stars - f.stars) && f2.left === 0 && !g.canRaid(1), '별 보상은 처음만 · 하루 2번(다 쓰면 못 함)');
  g.tick(T0 + 86400000); ok(g.raidLeft() === CBT.CB_RAID.perDay && g.canRaid(1), '다음 날 다시 2번');
  ok(CBT.raidStars(true, 50000, 0) === 3 && CBT.raidStars(true, 50000, 1) === 2 && CBT.raidStars(true, 90000, 0) === 2 && CBT.raidStars(true, 140000, 0) === 1 && CBT.raidStars(false, 1, 0) === 0, '별: ★3 60초 안 · 안 쓰러짐 · ★2 100초 안 · ★1 깸');
  const g2 = Game.load(g.save(), g.now); ok(g2.S.raid?.star[1] === g.S.raid.star[1], '토벌 기록은 저장된다');
}

console.log('\n=== v543 모두 강화 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 2), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  const W = g.S.wallet; W.gold = 0; W['item:stone'] = 0;
  ok(g.enhanceAll() === null, '재료가 없으면 아무것도 안 함');
  W.gold = 1e9; W['item:stone'] = 3000;
  const r = g.enhanceAll(), E = GE.SLOTS.map((s) => g.S.gear.slots[s].enh);
  ok(r && r.ok > 0 && r.stones > 0 && r.stones <= 3000 && Math.max(...E) - Math.min(...E) <= 2, '낮은 칸부터 고르게 — 칸 차이 2 안', JSON.stringify(E));
  ok(r.per.every((x) => g.S.gear.slots[x.slot].enh === x.to && x.to > x.from) && r.pw1 >= r.pw0, '결과: 칸마다 전 → 후 · 전투력');
  const lo = Math.min(...E), cost = GS.enhCost(lo, g.S.hero.lv);
  ok(cost.some((c) => (W[c.k] || 0) < c.n), '멈춘 때는 가장 낮은 칸 재료가 모자랄 때', `${W['item:stone']} 남음`);
}

console.log('\n=== v544 오늘 할 일 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 3), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  const by = (id) => g.today().find((x) => x.id === id);
  ok(g.today().length === 9 && g.today().every((x) => x.go && /^[a-z]+:\d$/.test(x.go)), '아홉 가지(v549 문파 출석) · 가는 곳(창 키)');
  ok(!by('attend').done && (g.attend(), by('attend').done), '출석하면 끝');
  ok(!by('raid').open && (g.S.chb = { 1: 1 }, by('raid').open && by('raid').n === 0), '토벌은 장 두목을 깬 뒤 열림');
  const p0 = by('pvp').n; g.pvpFight(0); ok(by('pvp').n === p0 + 1 && by('pvp').of === 5, '대결 한 번 → 1/5');
  ok(!by('exped').done && (g.startExped(12), by('exped').done), '원정 보내면 끝');
  const dg = by('dungeon'); ok(dg.open && dg.of > 0, '수련동: 열린 던전 × 하루 횟수', `${dg.n}/${dg.of}`);
  g.tick(T0 + 86400000); ok(!by('attend').done && by('pvp').n === 0, '다음 날 다시');
}

console.log('\n=== v545 하루 상자 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 3), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(!g.todayChest().can && g.claimToday() === null, '다 하기 전엔 못 엶');
  // 다 한 것처럼: 출석 · 임무 받음 · 던전 3 · 월드보스 3 · 대결 5 · 원정
  g.attend(); const dm = g.books.daily; for (const id of dm.defs.keys()) { const st = dm.get(id); st.done = true; st.got = true; }
  const dk = String(Math.floor((g.now + 9 * 3600e3) / 86400e3));   // 한국 날
  g.S.dungeons.runs = { gold: 3 }; g.S.wb = { ...(g.S.wb || {}), day: dk, used: 3 }; for (let i = 0; i < 5; i++) g.pvpFight(0); g.startExped(12);
  for (const id of g.books.ach.claimable()) g.claimMission('ach', id);
  const T = g.todayChest(); ok(T.can, '열린 것을 다 하면 열 수 있음', JSON.stringify(g.today().filter((x) => x.open && !x.done).map((x) => x.id)));
  const t0 = g.S.wallet['ticket:gear'] || 0, l0 = g.S.hero.lv, e0 = g.S.hero.exp;
  const r = g.claimToday();
  ok(r && g.S.wallet['ticket:gear'] === t0 + 3 && r.gold > 0 && g.S.hero.exp === e0 && g.S.hero.lv === l0, '뽑기권 3 · 은자 · 경험치는 그대로');
  ok(g.claimToday() === null && g.todayChest().got, '하루 한 번');
}

console.log('\n=== v546 회피(대시) · 완벽 회피 ===');
{
  const SD = await import('../js/s2/battle/side.js');
  const T0 = 1.8e12, mk = () => { const g = new Game(newGame('sword', T0, 4), T0); g.addExp(EX.cumExp(18)); g.tick(T0); g.S.dodge = false; const T = g.stage(); T.idx = 10; T.top = 10; T.kills = STAGE_KILLS; g.challenge(); return g; };
  // 회피: 3미터 · 쿨타임
  { const g = mk(), F = g.bossFight, H = F.hero; F.press({ auto: false }); const x0 = H.x; g.dash(); for (let i = 0; i < 8; i++) F.step();
    const d1 = Math.abs(H.x - x0); g.dash(); F.step(); F.step();
    ok(d1 >= SD.DASH.dist * 0.9 && F.events.filter((e) => e[0] === 'dash').length === 1, '회피: 3미터 · 쿨타임 동안 다시 못 함', `${d1}mm`); }
  // 붉은 범위가 터지기 직전 회피 → 안 맞고 완벽 회피(피해 ×1.3)
  const setPat = (F, m, H, ms) => { m.angry = true; m.pat = { id: 'slam', at: F.t, end: F.t + ms, x: H.x, y: H.y, w: 3000, dmgX: 3, shape: 'circle', safe: null, dir: 1 }; m.nextPat = 1e12; };
  { const g = mk(), F = g.bossFight, H = F.hero, m = F.mobs.find((x) => x.cb); F.press({ auto: false }); m.x = H.x + 8000; setPat(F, m, H, 300);
    const hp0 = H.hp; g.dash(); for (let i = 0; i < 8; i++) F.step();
    const per = F.events.some((e) => e[0] === 'perfect'), hurt = F.events.some((e) => e[0] === 'burst' && e[7] === 1);
    ok(per && !hurt && H.perfUntil > F.t, '터지기 직전 회피 → 안 맞음 · 완벽 회피', `hp ${hp0} → ${H.hp}`);
    m.hp = m.st.hp = 1e13; m.stunUntil = 0; const h0 = m.hp; F.strike(m, { coef: 100, base: true }); const dBuff = h0 - m.hp;
    H.perfUntil = 0; const h1 = m.hp; F.strike(m, { coef: 100, base: true }); const dN = h1 - m.hp;
    ok(dBuff > dN * 1.15, '완벽 회피 뒤 주는 피해 ×1.3', `${dBuff} / ${dN}`); }
  // 안 피하면 맞는다(자동 피하기 끔)
  { const g = mk(), F = g.bossFight, H = F.hero, m = F.mobs.find((x) => x.cb); F.press({ auto: false }); m.x = H.x + 8000; setPat(F, m, H, 300);
    for (let i = 0; i < 8; i++) F.step();
    ok(F.events.some((e) => e[0] === 'burst' && e[7] === 1) && !F.events.some((e) => e[0] === 'perfect'), '안 피하면 맞는다'); }
  // 자동 피하기를 끄고 처음 깬 장 두목 → 강화석 50(장마다 한 번)
  { const g = mk(), F = g.bossFight, m = F.mobs.find((x) => x.cb); m.hp = 0; F.killsBy.boss = 1; const s0 = g.S.wallet['item:stone'] || 0; g.endChallenge(true);
    const f = g.feed.filter((x) => x.k === 'stage-clear').at(-1);
    ok(f.chb.manual === 50 && g.S.wallet['item:stone'] - s0 >= 50 && g.S.chbMan[1] === 1, '자동 피하기 끄고 처음 깨면 강화석 50'); }
}

console.log('\n=== v547 서열 프로필 ===');
{
  const RK = await import('../js/s2/online/rank.js');
  const T0 = 1.8e12, g = new Game(newGame('bow', T0, 5), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  ok(!g.setNick('   ') && g.setNick('  <b>검은바람</b>의 궁수입니다  ') && g.S.nick.length <= 12 && !/[<>]/.test(g.S.nick), '이름: 빈 칸 거부 · 12자 · 꺾쇠 빼기', g.S.nick);
  const P = g.rankProfile();
  ok(Object.keys(P).every((k) => RK.PROFILE_KEYS.includes(k)) && P.season === 's2' && P.lv === g.S.hero.lv && P.power === Math.round(g.power()) && RK.checkProfile(P).length === 0, '프로필 칸 = 규칙 칸 · 값 범위 · 점검 통과', JSON.stringify(P));
}

console.log('\n=== v548 진짜 대결 상대 ===');
{
  const T0 = 1.8e12, A = new Game(newGame('sword', T0, 6), T0); A.addExp(EX.cumExp(40)); A.tick(T0);
  const B = new Game(newGame('spear', T0, 7), T0); B.addExp(EX.cumExp(42)); B.tick(T0);
  const deck = JSON.parse(A.pvpDeck());
  ok(A.pvpDeck().length <= 3000 && deck.lv === A.S.hero.lv && deck.job === 'sword' && deck.st.hp > 0, '방어 덱: 레벨 · 직업 · 능력치(3000자 안)', `${A.pvpDeck().length}자`);
  const bad = [{ uid: 'x1', name: 'h', f: { lv: 40, job: 'sword', st: { ...deck.st, atk: deck.st.atk * 1000 } } }, { uid: 'x2', f: { lv: 999, job: 'sword', st: deck.st } }, { uid: 'x3', f: { lv: 40, job: 'nope', st: deck.st } }, { uid: 'x4', f: { lv: 40, job: 'sword', st: { ...deck.st, hp: 'a' } } }];
  ok(B.setPvpReal([...bad, { uid: 'A', name: '검은바람', score: 1000, f: deck }]) === 1 && B.pvpOpponents()[0].real && B.pvpOpponents()[0].uid === 'A' && B.pvpOpponents().length === 3, '있을 수 없는 덱은 빼고 진짜 상대가 맨 앞 · 나머지는 연습 상대');
  const r = B.pvpFight(0);
  ok(r && r.oppUid === 'A' && r.opp.real && r.defD === (r.win ? -8 : 3), '진짜 상대와 겨루면 상대 우편함에 남길 점수(이기면 -8 · 지면 +3)', JSON.stringify({ win: r.win, defD: r.defD }));
  const s0 = A.S.pvp?.score ?? 1000, d = A.pvpDefend([{ name: '창객', win: r.win, d: r.defD }, { name: '해킹', win: true, d: -999 }]);
  ok(A.S.pvp.score === Math.max(0, s0 + d) && d === r.defD - 20 && A.S.pvp.log[0].def === 1 && A.S.pvp.log.length === 2, '받은 기록을 점수에 · 범위 밖(-999)은 -20으로 · 지난 대결에 방어로');
}

console.log('\n=== v549 문파 출석 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('fist', T0, 8), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const by = (id) => g.today().find((x) => x.id === id);
  ok(g.guildCheckin() === null && !by('guild').open, '문파가 없으면 출석 없음 · 오늘 할 일에서 잠김');
  g.setGuild('ABC234'); const t0 = g.S.wallet['ticket:gear'] || 0, r = g.guildCheckin();
  ok(r && g.S.wallet['ticket:gear'] === t0 + 2 && r.gold > 0 && by('guild').done && g.guildCheckin() === null, '문파 출석: 뽑기권 2 · 은자 · 하루 한 번');
  ok(g.rankProfile().guildId === 'ABC234', '서열 프로필에 문파 코드');
  g.tick(T0 + 86400000); ok(!!g.guildCheckin(), '다음 날 다시');
}

console.log('\n=== v550 문파 토벌 ===');
{
  const GM = await import('../js/s2/game.js'), GDm = await import('../js/s2/online/guild.js');
  const T0 = 1.8e12, g = new Game(newGame('mage', T0, 9), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(g.canDungeon('graid') === '문파에 들면' && !g.enterDungeon('graid'), '문파가 없으면 토벌 못 함');
  g.setGuild('ABC234');
  ok(g.enterDungeon('graid') && g.dg.type === 'graid' && g.dg.F.mobs.find((m) => m.cb)?.cb.ch === g.graidBoss() && g.graidState().used === 1, '토벌: 이번 주 장 두목 · 쓰러지지 않음 · 도전 1');
  let t = T0; while (g.dg) { t += 1000; g.tick(t); g.hunt(1000); }
  const f = g.feed.filter((x) => x.k === 'dungeon-end').at(-1);
  ok(f.type === 'graid' && f.cleared && f.dmg > 0 && f.ms >= GM.GRAID.fightMs, '90초 → 넣은 피해', `${f.dmg}`);
  const hp0 = GM.graidHp0(40), tot = hp0 * 2.5, ph = GDm.raidPhase(tot, hp0).phase, t0 = g.S.wallet['ticket:gear'] || 0;
  const r = g.graidClaim(tot, 40);
  ok(ph === 2 && r.n === 2 && g.S.wallet['ticket:gear'] === t0 + 4 && g.graidClaim(tot, 40) === null, '단계 보상: 깬 단계만큼 한 번씩(1단계 체력 ×1.4씩)');
  for (let i = 1; i < GM.GRAID.weekTries; i++) { g.enterDungeon('graid'); g.leaveDungeon(); }
  ok(g.canDungeon('graid') === '이번 주는 다 했어요', '한 주 7번');
  g.tick(T0 + 7 * 86400000); ok(g.graidState().used === 0 && g.graidState().claimed === 0 && !g.canDungeon('graid'), '다음 주 새로');
}

console.log('\n=== v552 문파 수련 ===');
{
  const GM = await import('../js/s2/game.js');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 10), T0); g.addExp(EX.cumExp(40)); g.tick(T0); g.setGuild('ABC234');
  const p0 = g.gtrainPts(); g.attend(); g.startExped(12); const p1 = g.gtrainPts();
  ok(p1 === p0 + 2, '오늘 할 일을 끝내면 수련 점수가 오른다', `${p0} → ${p1}`);
  g.attend(); ok(g.gtrainPts() === p1, '같은 날 다시 세도 그대로(하루 최대)');
  g.tick(T0 + 86400000); ok(g.gtrainPts() >= p1, '다음 날은 더해 간다(이번 주 합)');
  ok(g.gtrainClaim(10, 3) === null, '목표(문파원 × 25)를 못 채우면 못 받음');
  const t0 = g.S.wallet['ticket:gear'] || 0, r = g.gtrainClaim(75, 3);
  ok(r && g.S.wallet['ticket:gear'] === t0 + GM.GTRAIN.rew.tix && g.gtrainClaim(75, 3) === null, '다 차면 보상 한 번(한 주)');
  g.tick(T0 + 8 * 86400000); ok(!g.gtrainState().got && Object.keys(g.gtrainState().days).length === 0, '다음 주 새로');
}

console.log('\n=== v553 주간 보상 ===');
{
  const GM = await import('../js/s2/game.js');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 11), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(g.pvpWeekReward() === null, '대결 기록이 없으면 주간 보상 없음');
  g.S.pvp = { score: 1300, day: '', used: 0, log: [] }; g.pvpMark();
  g.tick(T0 + 7 * 86400000);
  const r = g.pvpWeekReward();
  ok(r && r.tier === '고수' && r.tix === GM.WEEK_REW.pvp[2], '다음 주: 지난주 최고 등급(고수) → 뽑기권', JSON.stringify(r));
  const t0 = g.S.wallet['ticket:gear'] || 0; g.claimPvpWeek();
  ok(g.S.wallet['ticket:gear'] === t0 + r.tix && g.claimPvpWeek() === null, '한 번만');
  ok(g.wbRankReward(1) === 30 && g.wbRankReward(7) === 15 && g.wbRankReward(500) === 3 && g.wbRankReward(0) === 0, '월드보스 순위 → 뽑기권(1위 30 · 10위 안 15 · 친 사람 3)');
  const w = g.claimWbWeek('2026-11-09', 2); ok(w && w.tix === 20 && g.claimWbWeek('2026-11-09', 1) === null, '지난주 월드보스 보상 한 번');
}

console.log('\n=== v555 두목 도감 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 12), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  const d0 = g.dex();
  ok(d0.list.length === 15 && d0.three === 0 && !d0.can && g.claimDex() === null, '15명 · 처음엔 보상 없음');
  g.S.raid = { day: 0, n: 0, star: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 }, best: {} }; g.S.chb = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
  const t0 = g.S.wallet['ticket:gear'] || 0, r = g.claimDex();
  ok(r && r.n === 5 && g.S.wallet['ticket:gear'] === t0 + 10 && g.claimDex() === null && g.dex().next.n === 10, '★3 다섯 → 뽑기권 10 · 다음은 10명');
  for (let c = 1; c <= 15; c++) { g.S.raid.star[c] = 3; g.S.chb[c] = 1; }
  g.claimDex(); const r3 = g.claimDex();
  ok(r3 && r3.title === '두목 도감 완성' && g.S.titles.includes('두목 도감 완성') && g.dex().next === null, '15명 → 칭호까지 · 끝');
}

console.log('\n=== v557 장비 뽑기 천장 ===');
{
  const GT = await import('../js/s2/tables/gear.js'), GCm = await import('../js/s2/gear/gacha.js');
  ok(GT.pityGrade(1) === 2 && GT.pityGrade(10) === 3 && GT.pityGrade(20) === 5, '천장 목표: Lv1 정 · Lv10 진 · Lv20 신(1% 넘는 가장 높은 등급)');
  const GA = GCm.newGacha(); GA.lv = 20; const W = { 'ticket:gear': 5000 }, rng = new Rng(77);
  let maxGap = 0, gap = 0, hits = 0;
  for (let k = 0; k < 40; k++) { const out = GCm.pull(GA, 100, rng, W, 100, { ticket: true }); for (const it of out) { if (it.g >= 5) { maxGap = Math.max(maxGap, gap); gap = 0; } else gap++; } }
  hits = GA.pityHits || 0;
  ok(maxGap < GT.PITY_N && GA.pity < GT.PITY_N, `150번 안에 반드시 신품 이상(가장 긴 틈 ${maxGap})`);
  GA.pity = GT.PITY_N - 1; const one = GCm.pull(GA, 1, new Rng(1), W, 100, { ticket: true })[0];
  ok(one.g >= 5 && GA.pity === 0, '149번 안 나왔으면 다음은 확정 · 천장 0으로');
}

console.log('\n=== v559 무공 모두 올리기 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('spear', T0, 13), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  const K = g.hero.kitState(); for (const id of Object.keys(K.lv)) if (!K.lv[id]) delete K.lv[id];
  g.S.wallet.gold = 0; ok(g.kitUpAll() === null, '은자가 없으면 아무것도 안 함');
  g.S.wallet.gold = 3e6; const r = g.kitUpAll(), L = Object.values(g.hero.kitState().lv).filter((v) => v > 0);
  ok(r && r.n > 0 && r.gold > 0 && r.gold <= 3e6 && Math.max(...L) - Math.min(...L) <= 2 && r.pw1 >= r.pw0, '낮은 무공부터 고르게(차이 2 안) · 은자 · 전투력', JSON.stringify(L));
  g.S.wallet.gold = 1e15; g.kitUpAll(); ok(Object.keys(g.hero.kitState().lv).every((id) => !g.hero.canKitUp(id) || g.hero.kitState().lv[id] === 0), '은자가 넉넉하면 상한까지');
}

console.log('\n=== v563 대결 복수 ===');
{
  const T0 = 1.8e12, A = new Game(newGame('sword', T0, 14), T0); A.addExp(EX.cumExp(40)); A.tick(T0);
  const B = new Game(newGame('fist', T0, 15), T0); B.addExp(EX.cumExp(30)); B.tick(T0);
  A.pvpDefend([{ name: '권객', win: true, d: -8, by: 'uidB' }]);
  const deckB = { uid: 'uidB', name: '권객', score: 1000, f: JSON.parse(B.pvpDeck()) };
  ok(A.pvpRevenge(0, { ...deckB, uid: 'other' }) === null, '다른 무인 덱으로는 복수 못 함');
  const r = A.pvpRevenge(0, deckB);
  ok(r && r.revenge && r.oppUid === 'uidB' && A.S.pvp.log.some((l) => l.def && l.by === 'uidB' && l.rev), '진 방어 → 그 덱과 겨룸 · 복수 표시', JSON.stringify({ win: r?.win }));
  const li = A.S.pvp.log.findIndex((l) => l.by === 'uidB'); ok(A.pvpRevenge(li, deckB) === null, '한 번만');
}

console.log('\n=== v565 외형 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 16), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const seen = g.lookSeen().hat ?? -1;
  ok(!g.setLook('hat', seen + 1) && !g.setLook('nope', 0), '얻어 본 등급보다 높은 외형 · 없는 부위는 못 고름');
  g.obtain([GR.makeGear(new Rng(3), 'hat', 5)]);
  ok(g.lookSeen().hat === 5 && g.setLook('hat', 5) && g.lookEq().hat.g === 5, '얻으면 그 등급까지 고를 수 있다 · 보이는 모습만 바뀜');
  const pw = g.power(), hat2 = g.S.gear.eq.hat; g.dirtyStats = true; g.setLook('hat', 0); g.dirtyStats = true; ok(g.power() === pw && g.S.gear.eq.hat === hat2 && hat2 !== undefined, '능력치 · 낀 장비는 그대로');
  g.setLook('hat', null); ok(g.lookEq() === g.S.gear.eq, '장비대로 되돌리기');
}

console.log('\n=== v566 대결 상대 외형 ===');
{
  const T0 = 1.8e12, A = new Game(newGame('sword', T0, 17), T0); A.addExp(EX.cumExp(40)); A.tick(T0);
  const B = new Game(newGame('bow', T0, 18), T0); B.addExp(EX.cumExp(40)); B.tick(T0);
  B.obtain([GR.makeGear(new Rng(5), 'hat', 6)]); B.setLook('hat', 6);
  const deck = JSON.parse(B.pvpDeck());
  ok(deck.lk && deck.lk.hat === 6 && B.pvpDeck().length <= 3000, '방어 덱에 외형(고른 모습)');
  A.setPvpReal([{ uid: 'B', name: '궁', score: 1000, f: { ...deck, lk: { ...deck.lk, ring: 99, nope: 1 } } }]);
  const r = A.pvpFight(0);
  ok(r.opp.lk && r.opp.lk.hat === 6 && !('ring' in r.opp.lk && r.opp.lk.ring === 99) && !('nope' in r.opp.lk), '받은 외형은 있는 칸 · 0~6만 · 대결 화면으로');
}

console.log('\n=== v569 즐겨찾기 · 친선 대결 ===');
{
  const T0 = 1.8e12, A = new Game(newGame('sword', T0, 19), T0); A.addExp(EX.cumExp(40)); A.tick(T0);
  const B = new Game(newGame('mage', T0, 20), T0); B.addExp(EX.cumExp(40)); B.tick(T0);
  ok(A.toggleFav('B', '법사') === true && A.isFav('B') && A.toggleFav('B') === false && !A.isFav('B'), '즐겨찾기 넣기 · 빼기');
  for (let i = 0; i < 20; i++) A.toggleFav(`u${i}`, 'x'); ok(A.toggleFav('u99', 'x') === null, '20명까지');
  const s0 = A.S.pvp?.score ?? 1000, used0 = A.S.pvp?.used ?? 0;
  const r = A.pvpFriendly({ uid: 'B', name: '법사', score: 1000, f: JSON.parse(B.pvpDeck()) });
  ok(r && r.friendly && r.d === 0 && (A.S.pvp?.score ?? 1000) === s0 && (A.S.pvp?.used ?? 0) === used0 && r.log.length > 0, '친선 대결: 점수 · 횟수 그대로 · 화면 기록 있음');
  ok(A.pvpFriendly({ uid: 'X', f: { lv: 999, job: 'sword', st: {} } }) === null, '있을 수 없는 덱은 못 겨룸');
}

console.log('\n=== v571 업적: 연속 처치 · 복수 · 친선 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 21), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const B = g.books.ach;
  g.comboMark(30); ok(B.get('a_combo_0').done && !B.get('a_combo_1').done && g.S.comboBest === 30, '30 연속 → 첫 단계 · 최고 기록');
  g.comboMark(100); ok(B.get('a_combo_1').done && !B.get('a_combo_2').done, '100 연속 → 둘째 단계');
  const Bg = new Game(newGame('fist', T0, 22), T0); Bg.addExp(EX.cumExp(30)); Bg.tick(T0);
  for (let i = 0; i < 5; i++) g.pvpFriendly({ uid: 'B', name: 'b', score: 1000, f: JSON.parse(Bg.pvpDeck()) });
  ok(B.get('a_friendly_0').done, '친선 대결 5번 → 업적');
}

console.log('\n=== v575 문파 Lv 출석 보너스 ===');
{
  ok(Game.guildLvOf(0) === 1 && Game.guildLvOf(1000) === 3 && Game.guildBonus(1) === 0 && Game.guildBonus(3) === 1 && Game.guildBonus(5) === 2 && Game.guildBonus(20) === 3, '문파 Lv(500마다) · 보너스(2 Lv마다 +1 · 최대 3)');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 23), T0); g.addExp(EX.cumExp(30)); g.tick(T0); g.setGuild('ABC234');
  const t0 = g.S.wallet['ticket:gear'] || 0, r = g.guildCheckin(7); ok(r.tix === 5 && g.S.wallet['ticket:gear'] === t0 + 5, '문파 Lv 7 출석 → 뽑기권 2 + 3');
}

console.log('\n=== v576 무림 공동 토벌 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 24), T0); g.tick(T0);
  ok(g.wbCommunityClaim(1000) === null, '첫 단계 전엔 없음');
  const t0 = g.S.wallet['ticket:gear'] || 0, r = g.wbCommunityClaim(300000);
  ok(r && r.n === 2 && g.S.wallet['ticket:gear'] === t0 + 8 && g.wbCommunityClaim(300000) === null, '두 단계 넘으면 3 + 5 한 번에 · 다시는 없음');
  ok(g.wbCommunityClaim(2e6).tix === 10, '다음 단계만 더');
  g.tick(T0 + 7 * 86400000); ok(g.wbCommunityGot() === 0, '다음 주 새로');
}

console.log('\n=== v579 무공 칸 묶음 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 25), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  const K = g.hero.kitState(), s0 = [...K.slots];
  ok(!g.kitPresetLoad(0) && g.kitPresetSave(0) && !g.kitPresetSave(2), '비어 있으면 못 불러옴 · 둘만');
  K.off = [...K.slots]; g.kitPresetSave(1); K.off = [];
  ok(g.kitPresetLoad(1) && K.off.length === K.slots.length && g.kitPresetLoad(0) && K.off.length === 0 && K.slots.join() === s0.join(), '적은 순서 · 자동/수동을 불러온다');
}

console.log('\n=== v580 시간 티켓 바로 쓰기 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 26), T0); g.addExp(EX.cumExp(20)); g.tick(T0);
  g.S.wallet['ticket:time'] = 0; ok(g.timeHunt(1) === null, '없으면 못 씀');
  g.S.wallet['ticket:time'] = 3; const e0 = EX.cumExp(g.S.hero.lv) + g.S.hero.exp, r = g.timeHunt(5);
  ok(r && r.n === 3 && r.min === 45 && r.gold > 0 && g.S.wallet['ticket:time'] === 0 && EX.cumExp(g.S.hero.lv) + g.S.hero.exp > e0, '있는 만큼만(3장) · 45분 몫 경험치 · 은자');
}

console.log('\n=== v581 수련동 모두 소탕 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 27), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  ok(g.sweepAll() === null, '깬 던전이 없으면 못 함');
  g.S.dungeons.best = { gold: true, stone: true };
  const r = g.sweepAll();
  ok(r && r.n >= 1 && Object.keys(g.S.dungeons.runs).every((k) => ['gold', 'stone'].includes(k)) && g.sweepAll() === null, '깬 던전만 · 입장권 · 횟수가 되는 만큼', JSON.stringify({ n: r?.n, runs: g.S.dungeons.runs }));
  g.tick(T0 + 86400000); ok(g.S.dungeons.best?.gold && g.S.dungeons.best?.stone && Object.keys(g.S.dungeons.runs).length === 0, '날이 바뀌어도 소탕 열림은 남고 횟수만 새로');
}

console.log('\n=== v582 탑 연속 오르기 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 28), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  let n = 0; g.towerFight = () => { n++; if (n <= 3) { g.S.tower.best++; return { cleared: true }; } return { cleared: false }; };   // 세 층 이기고 넷째에서 짐
  const r = g.towerClimb(30);
  ok(r && r.up === 3 && r.tries === 4 && r.stopped && r.to === 3, '질 때까지 오른다 · 오른 층 · 진 판까지 센다', JSON.stringify(r));
  n = -100; const r2 = g.towerClimb(5); ok(r2.tries === 5 && !r2.stopped, '최대 층에서 멈춤(다시 누르면 계속)');
}

console.log('\n=== v583 두목 연습 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 29), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(!g.practice(1), '깨지 않은 두목은 연습 못 함');
  g.S.chb = { 1: 1 }; const w0 = JSON.stringify(g.S.wallet), left0 = g.raidLeft(), T = g.stage(), idx0 = T.idx;
  ok(g.practice(1) && g.bossFight.def.practice && g.bossFight.def.lv === 10, '연습: 그 장 레벨로');
  let t = T0; while (g.bossFight) { t += 1000; g.tick(t); g.hunt(1000); }
  const f = g.feed.filter((x) => x.k === 'raid-end').at(-1);
  ok(f && f.practice && Object.keys(f.rew).length === 0 && g.raidLeft() === left0 && !g.S.raid?.star?.[1] && T.idx === idx0, '보상 · 토벌 횟수 · 별 · 칸 그대로', JSON.stringify({ win: f?.win }));
}

console.log('\n=== 분해 → 뽑기 조각 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 77), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const W = g.S.wallet, G = g.S.gear, mk = (gr) => { const it = GR.makeGear(g.rng, 'weapon', gr); G.bag.push(it); return it; };
  ok((W['item:shard'] || 0) === 0 && g.shardExchange() === null, '옛 저장(조각 없음)은 0 · 모자라면 못 바꿈');
  const a = mk(0), b = mk(3);
  ok(GR.dismantleItem(G, a.uid, W) && W['item:shard'] === 1 && GR.dismantleItem(G, b.uid, W) && W['item:shard'] === 5, '하나씩 분해: 한 개에 1 · 등급마다 +1', String(W['item:shard']));
  const many = [mk(0), mk(1), mk(2)], r = GR.dismantleMany(G, many.map((x) => x.uid), W);
  ok(r.n === 3 && r.out['item:shard'] === 6 && W['item:shard'] === 11, '일괄 분해도 조각을 준다', JSON.stringify(r.out));
  G.eq.weapon = GR.makeGear(g.rng, 'weapon', 6); G.autoDis = 1; const sh0 = W['item:shard'];
  g.obtain([GR.makeGear(g.rng, 'weapon', 0), GR.makeGear(g.rng, 'weapon', 1)]); G.autoDis = -1;
  ok(W['item:shard'] === sh0 + 3, '주우면 바로 분해도 조각을 준다', String(W['item:shard'] - sh0));
  W['item:shard'] = 2 * GS.SHARD_PER_TICKET + 3; const t0 = W['ticket:gear'] || 0, x = g.shardExchange();
  ok(x && x.tickets === 2 && x.left === 3 && W['item:shard'] === 3 && W['ticket:gear'] === t0 + 2, `조각 ${GS.SHARD_PER_TICKET}개 = 장비 뽑기권 1장 · 나머지는 남는다`, JSON.stringify(x));
  W['item:shard'] = GS.SHARD_PER_TICKET; W['ticket:gear'] = 0; const p0 = g.S.gacha.pulls, ag = g.autoGrow({ claim: false, daily: false });
  ok(ag.pull >= 1 && g.S.gacha.pulls > p0 && W['item:shard'] < GS.SHARD_PER_TICKET, '자동 성장이 조각을 바꿔 뽑는다');
}

console.log('\n=== v588 자동 성장 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 31), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  const W = g.S.wallet; W['ticket:gear'] = 25; W.gold = 1e9; W['item:stone'] = 2000; const gold0 = W.gold, pw0 = g.power(), pulls0 = g.S.gacha.pulls;
  const r = g.autoGrow();
  ok(r.pull >= 25 && W['ticket:gear'] === 0 && g.S.gacha.pulls === pulls0 + r.pull, '뽑기권을 모두 쓴다(받은 보상의 뽑기권까지 · 은자로는 안 뽑음)', JSON.stringify(r));
  ok(r.enh > 0 && r.kit >= 0 && g.power() > pw0, '최고 장비 · 무공 · 강화로 전투력이 오른다');
  const r2 = g.autoGrow({ claim: false }); ok(r2.pull === 0 && W['ticket:gear'] === 0, '뽑기권이 없으면 뽑지 않음(은자 그대로 쓰지 않음)');   // v612 첫 번에 찍은 스탯 · 모은 가지 업적이 끝나 있어 받으면 뽑기권이 생긴다 — 받기는 끄고 본다
  W['ticket:gear'] = 5; const r3 = g.autoGrow({ pull: false, enh: false, kit: false, claim: false }); ok(r3.pull === 0 && W['ticket:gear'] === 5, '끈 것은 하지 않음');
}

console.log('\n=== 스탯 배분 — 레벨마다 1점 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 31), T0);
  ok(g.statPts() === 0 && g.statUp('atk') === 0, '1레벨은 점수가 없다');
  g.S.hero.lv = 21; g.hero.autoSpend(); g.dirtyStats = true;
  ok(g.statPts() === 20, '레벨 − 1 만큼 받는다', g.statPts());
  const p0 = g.power(), a0 = g.fighter().st.atk;
  ok(g.statUp('atk', 3) === 3 && g.S.hero.sp.atk === 3 && g.statPts() === 17, '찍으면 남은 점수가 준다');
  ok(g.fighter().st.atk > a0 && g.power() > p0, '공격이 오른다', `${a0} → ${g.fighter().st.atk}`);
  ok(g.statUp('luck', 1) === 0 && g.statUp('hp', -5) === 0 && g.statPts() === 17, '없는 스탯 · 음수는 안 된다');
  ok(g.statUp('hp', 999) === 17 && g.statPts() === 0 && g.statUp('def') === 0, '남은 점수까지만');
  ok(g.statReset() === 20 && g.statPts() === 20 && g.power() === p0, '되돌리면 처음 전투력', `${p0} / ${g.power()}`);
  ok(g.statAuto() === 20 && JSON.stringify(g.S.hero.sp) === JSON.stringify({ atk: 5, hp: 5, def: 5, crit: 5 }), '고르게 찍기', JSON.stringify(g.S.hero.sp));
  g.S.hero.lv = 23; ok(g.statAuto() === 2 && g.S.hero.sp.atk === 6 && g.S.hero.sp.hp === 6 && g.S.hero.sp.def === 5, '고르게는 공격부터', JSON.stringify(g.S.hero.sp));
  // 상한 · 균형 — 만렙에서 다 찍어도 전투력 +5% 안쪽
  const m = new Game(newGame('sword', T0, 32), T0); m.S.hero.lv = 150; m.hero.autoSpend();
  const mp = m.power(), mv = m.power('pvp');
  ok(m.statUp('atk', 999) === 40 && m.statUp('atk') === 0, '스탯마다 상한 40점', m.S.hero.sp.atk);
  m.statReset(); m.statAuto();
  ok(m.statPts() === 0 && m.power() > mp && m.power() <= mp * 1.05 && m.power('pvp') <= mv * 1.05, '다 찍어도 전투력 +5% 안쪽', `${(m.power() / mp).toFixed(4)} / ${(m.power('pvp') / mv).toFixed(4)}`);
  // 옛 세이브(sp 없음) · 자동 성장
  const S = newGame('sword', T0, 33); delete S.hero.sp; S.hero.lv = 11;
  const o = new Game(JSON.parse(JSON.stringify(S)), T0);
  ok(o.statPts() === 10 && o.S.hero.sp.atk === 0 && o.power() > 0, '옛 세이브는 0점부터', JSON.stringify(o.S.hero.sp));
  const r = o.autoGrow({ claim: false, daily: false, pull: false, coll: false, kit: false, enh: false });
  ok(r.train >= 10 && o.statPts() === 0, '자동 성장이 남은 점수를 찍는다', r.train);
  const o2 = new Game(JSON.parse(JSON.stringify(S)), T0); o2.autoGrow({ train: false, stat: false, claim: false, daily: false });
  ok(o2.statPts() === 10, '스탯 찍기를 끄면 안 찍는다');
}

console.log('\n=== v589 자동 성장 — 하루 일 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 32), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  g.S.dungeons.best = { gold: true };
  const r = g.autoGrow();
  ok(r.daily.includes('출석') && !g.canAttend() && r.daily.some((x) => /^소탕/.test(x)) && r.daily.includes('원정 보냄') && g.S.exped.run, '출석 · 소탕 · 원정 보내기', JSON.stringify(r.daily));
  g.tick(T0 + 13 * 3600e3); const r2 = g.autoGrow(); ok(r2.daily.includes('원정 받음') && r2.daily.includes('원정 보냄'), '원정이 끝나면 받고 다시 보냄', JSON.stringify(r2.daily));
  const r3 = g.autoGrow({ daily: false }); ok(r3.daily.length === 0, '하루 일을 끄면 안 함');
}

console.log('\n=== 기연 — 사냥 중 고르는 보상 ===');
{
  const { FATE_NEED, FATE_CAP, FATE_MIN, FATE_CARDS } = await import('../js/s2/game.js');
  const { KILLS_PER_MIN: KPM } = await import('../js/s2/tables/exp.js');
  const { goldPerMob: GPM } = await import('../js/s2/tables/gearstat.js');
  const T0 = 1.8e12, mk = (seed) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(40)); g.tick(T0); return g; };
  const g = mk(41), f0 = g.fateState();
  ok(FATE_NEED === 300 && FATE_CAP === 3 && f0.g === 0 && f0.need === 300 && f0.ready === 0 && f0.cards === null, '처음: 칸 0 / 300 · 고를 것 없음');
  ok(g.fateOpen() === null && g.fatePick(0) === null, '차기 전엔 열리지 않음');
  let k = 0; for (let i = 0; i < 20; i++) { g.tick(T0 + i * 1000); k += g.hunt(1000); }
  ok(k > 0 && g.fateState().g === k, '사냥 처치가 칸을 채운다', `처치 ${k}`);
  g.fateKill(FATE_NEED - k + 7);
  ok(g.fateState().ready === 1 && g.fateState().g === 7 && g.feed.some((x) => x.k === 'fate'), '300마리 → 기연 1번 · 넘친 처치는 이어짐 · 알림');
  const cards = g.fateOpen();
  ok(cards.length === 3 && new Set(cards.map((c) => c.k)).size === 3 && cards.every((c) => c.n > 0 && FATE_CARDS.some((d) => d.k === c.k)), '카드 셋 — 서로 다름', cards.map((c) => `${c.k}×${c.n}`).join(' '));
  ok(g.fateOpen() === cards && JSON.stringify(Game.load(g.save(), T0).fateState().cards) === JSON.stringify(cards), '다시 열어도 · 저장했다 불러도 같은 카드(다시 굴리지 않음)');
  { const a = mk(77), b = mk(77); a.fateKill(300); b.fateKill(300); ok(JSON.stringify(a.fateOpen()) === JSON.stringify(b.fateOpen()), '같은 씨앗이면 같은 카드(결정론)'); }
  // 카드마다 주는 것
  const L = g.S.hero.lv, W = g.S.wallet, give = (kk) => { g.S.fate.ready = 1; g.S.fate.cards = [{ k: kk, n: g.fateAmount(kk) }, { k: 'gold', n: 1 }, { k: 'exp', n: 1 }]; return g.fatePick(0); };
  const n0 = g.S.fate.n, gold0 = W.gold, c1 = give('gold');
  ok(c1.n === Math.round(FATE_MIN * KPM * GPM(L)) && W.gold === gold0 + c1.n && FATE_MIN === 10, '은자 = 그 레벨 사냥 10분 몫', c1.n);
  ok(g.S.fate.n === n0 + 1 && g.S.fate.cards === null && g.fateState().ready === 0, '고르면 카드가 사라지고 횟수가 준다');
  const tot = () => EX.cumExp(g.S.hero.lv) + g.S.hero.exp, x0 = tot(), c2 = give('exp');
  ok(c2.n === Math.round(FATE_MIN * KPM * EX.mobExp(L)) && tot() > x0, '경험치 = 그 레벨 사냥 10분 몫', c2.n);
  const t0 = W['ticket:gear'] || 0, s0 = W['item:stone'] || 0, tt0 = W['ticket:time'] || 0, p0 = W['ticket:pal'] || 0;
  give('ticket:gear'); give('item:stone'); give('ticket:time'); give('ticket:pal');
  ok(W['ticket:gear'] === t0 + 2 && W['item:stone'] === s0 + 5 + Math.floor(g.S.hero.lv / 10) && W['ticket:time'] === tt0 + 1 && W['ticket:pal'] === p0 + 1, '장비 뽑기권 2 · 강화석 5 + 레벨/10 · 시간 티켓 1 · 동료 뽑기권 1');
  ok(g.fatePick(0) === null, '카드가 없으면 고를 수 없음');
  // 쌓임 상한
  g.S.fate.g = 0; g.S.fate.ready = 0; g.fateKill(FATE_NEED * 5 + 20);
  ok(g.fateState().ready === FATE_CAP && g.fateState().g === 0, '3번까지 쌓이고 그동안 칸은 멈춤', JSON.stringify(g.fateState()));
  g.fateKill(100); ok(g.fateState().g === 0, '다 쌓였으면 더 잡아도 그대로');
  g.fateOpen(); g.fatePick(1); g.fateKill(100); ok(g.fateState().ready === 2 && g.fateState().g === 100, '하나 고르면 다시 차오름');
  // 나오는 무게 · 값이 작다
  const sum = FATE_CARDS.reduce((a, c) => a + c.w, 0), wOf = (kk) => FATE_CARDS.find((c) => c.k === kk).w;
  ok(sum === 100 && wOf('ticket:time') <= 5 && ['weapon', 'pal', 'relic'].every((x) => wOf(`ticket:${x}`) < wOf('ticket:gear')), '무게 합 100 · 시간 티켓은 드묾 · 병기/동료/영물은 장비 뽑기권보다 드묾');
  { const h = mk(5), cnt = {}; for (let i = 0; i < 600; i++) { h.fate().ready = 1; for (const c of h.fateOpen()) cnt[c.k] = (cnt[c.k] || 0) + 1; h.fatePick(0); }
    ok(cnt.gold > cnt['ticket:gear'] && cnt['ticket:gear'] > cnt['ticket:time'] * 2 && Object.keys(cnt).length === FATE_CARDS.length, '600번: 자주 나오는 순서가 무게대로 · 여덟 가지 모두 나옴', JSON.stringify(cnt)); }
  // 옛 세이브 · 자동 성장
  { const o = mk(9); delete o.S.fate; const o2 = Game.load(o.save(), T0); ok(o2.fateState().g === 0 && o2.fateState().ready === 0 && o2.hunt(1000) >= 0, '기연 칸이 없는 옛 세이브도 불러온다'); }
  { const a = mk(13); a.fateKill(FATE_NEED * 2); const r = a.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false });
    ok(a.fateState().ready === 0 && a.S.fate.n === 2 && r.claim >= 2, '자동 성장: 쌓인 기연은 첫 카드로 받는다', JSON.stringify(r));
    a.fateKill(FATE_NEED); a.autoGrow({ claim: false, daily: false }); ok(a.fateState().ready === 1, '보상 받기를 끄면 그대로 둔다'); }
}

console.log('\n=== v591 자동 성장 — 병기 · 동료 · 영물 뽑기권 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 33), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const W = g.S.wallet; W['ticket:weapon'] = 13; W['ticket:pal'] = 2; W['ticket:relic'] = 0;
  const own0 = Object.values(g.S.colls.weapon.own).reduce((a, o) => a + o.n, 0);
  const r = g.autoGrow({ claim: false, daily: false });
  const own1 = Object.values(g.S.colls.weapon.own).reduce((a, o) => a + o.n, 0);
  ok(W['ticket:weapon'] === 0 && W['ticket:pal'] === 0 && own1 > own0 && r.coll === 15, '병기 · 동료 뽑기권을 모두 쓴다', JSON.stringify({ coll: r.coll, own0, own1 }));
  W['ticket:pal'] = 4; const r2 = g.autoGrow({ coll: false, claim: false, daily: false }); ok(r2.coll === 0 && W['ticket:pal'] === 4, '끄면 쓰지 않음');
}

console.log('\n=== 상점 — 날마다 은자로 사기 ===');
{
  const { SHOP } = await import('../js/s2/tables/shop.js');
  const { goldPerMob: gpm } = await import('../js/s2/tables/gearstat.js');
  const { dayKey: dkOf } = await import('../js/s2/game.js');
  const T0 = 1.8e12, DAYMS = 86400e3, g = new Game(newGame('sword', T0, 36), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  const W = g.S.wallet, by = (id) => g.shopState().find((x) => x.id === id), lv = g.S.hero.lv;
  const all = SHOP.reduce((a, s) => a + s.mobs * s.limit, 0);
  ok(SHOP.length >= 8 && all >= 1620 && all <= 3240 && SHOP.every((s) => s.limit >= 1 && s.cost(lv) === s.mobs * gpm(lv)), '물건 8개쯤 · 다 사면 사냥 한두 시간 몫', `${SHOP.length}개 · ${all}마리 몫`);
  ok(SHOP.filter((s) => s.mobs === 0).length === 1 && by('free').cost === 0, '값 없는 덤은 하나');
  W.gold = 0; const t0 = W['ticket:gear'] || 0;
  ok(!by('gear').can && g.shopBuy('gear') === null && (W['ticket:gear'] || 0) === t0 && W.gold === 0, '은자가 없으면 못 산다');
  ok(g.shopFreeCan() && !!g.shopBuy('free') && W['ticket:gear'] === t0 + 1 && !g.shopFreeCan() && g.shopBuy('free') === null && W['ticket:gear'] === t0 + 1, '덤은 하루 한 번');
  const price = by('gear').cost; W.gold = price * 10;
  const r = g.shopBuy('gear');
  ok(r && r.gold === price && r.give['ticket:gear'] === 1 && W.gold === price * 9 && W['ticket:gear'] === t0 + 2 && by('gear').left === 4, '사면 은자가 줄고 물건을 받는다', JSON.stringify(r));
  ok(g.shopBuy('gear', 5) === null && W.gold === price * 9, '남은 수보다 많이는 못 산다(하나도 안 삼)');
  const r4 = g.shopBuy('gear', 4);
  ok(r4 && r4.n === 4 && r4.gold === price * 4 && W.gold === price * 5 && by('gear').left === 0 && !by('gear').can && g.shopBuy('gear') === null && W.gold === price * 5, '하루 살 수 있는 수를 넘지 않는다');
  ok(g.shopBuy('없는것') === null && g.shopBuy('stone', 0) === null && g.shopBuy('stone', -1) === null, '없는 물건 · 0개는 안 됨');
  const s0 = W['item:stone'] || 0; W.gold = 1e12; g.shopBuy('stone', 3); ok((W['item:stone'] || 0) === s0 + 60, '강화석 꾸러미 3개', `${s0} → ${W['item:stone']}`);
  const g1 = new Game(JSON.parse(JSON.stringify(g.S)), T0); ok(g1.shopState().find((x) => x.id === 'gear').left === 0 && !g1.shopFreeCan(), '저장했다 불러도 오늘 산 것은 그대로');
  g.tick(T0 + DAYMS);
  ok(by('gear').left === 5 && by('gear').can && g.shopFreeCan() && by('stone').left === 3, '다음 날이면 새로');
  const old = newGame('sword', T0, 37); delete old.shop; const g2 = new Game(old, T0);
  ok(g2.shopState().length === SHOP.length && g2.shopFreeCan() && g2.S.shop.day === dkOf(T0), '옛 세이브(상점 칸 없음)도 열린다');
  const g3 = new Game(newGame('sword', T0, 38), T0); g3.tick(T0); g3.S.wallet.gold = 1e12;
  const a1 = g3.autoGrow({ pull: false, kit: false, enh: false, train: false }), bought = Object.keys(g3.S.shop.bought);
  ok(a1.daily.includes('상점 덤') && bought.length === 1 && bought[0] === 'free', '자동 성장은 덤만 받는다(은자로 사지 않음)', JSON.stringify(g3.S.shop.bought));
  ok(!g3.autoGrow({ pull: false, kit: false, enh: false, train: false }).daily.includes('상점 덤'), '덤은 다시 받지 않음');
}

console.log('\n=== v592 자동 성장 — 마스터리 · 경지 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 34), T0); g.addExp(EX.cumExp(60)); g.tick(T0);
  g.S.wallet.gold = 1e13; const m0 = g.S.hero.mastery.done.length, r0 = g.S.realm.lv;
  const r = g.autoGrow({ claim: false, daily: false });
  ok(r.train > 0 && (g.S.hero.mastery.done.length > m0 || g.S.realm.lv > r0), '마스터리 · 경지를 올린다', JSON.stringify({ train: r.train, m: [m0, g.S.hero.mastery.done.length], realm: [r0, g.S.realm.lv] }));
  const g2 = new Game(newGame('sword', T0, 35), T0); g2.addExp(EX.cumExp(60)); g2.tick(T0); g2.S.wallet.gold = 1e13;
  const r2 = g2.autoGrow({ train: false, stat: false, claim: false, daily: false }); ok(r2.train === 0 && g2.S.realm.lv === r0, '끄면 안 함');
}

console.log('\n=== 동행 토벌 — 다른 무인의 덱과 함께 두목 ===');
{
  const GM = await import('../js/s2/game.js');
  const T0 = 1.8e12, DAYMS = 24 * 3600e3;
  // 그 레벨 기준 무인으로 싸우는 판(장비 없이 레벨만 올린 무인은 기준보다 한참 약하다)
  const mk = (L, seed = 3, best = 0) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(L)); g.tick(T0); g.fighter = () => refPlayer(L, 'sword'); g.S.party = { day: GM.dayKey(T0), runs: 0, best }; return g; };
  const deck = (L, job = 'spear', name = '벗') => ({ uid: `u${L}${job}`, name, f: { lv: L, job, st: { ...refPlayer(L, job).st }, lk: { weapon: 3 } } });
  ok(GM.PARTY.runsPerDay === 2 && GM.PARTY.allies === 2 && GM.PARTY.timeMs === 60000, '하루 2번 · 동행 둘 · 60초');
  ok(GM.partyLv(1) === 15 && GM.partyLv(6) === 40 && GM.partyLv(999) === PR.LEVEL_MAX && GM.partyHpX(40) > GM.partyHpX(28), '단계 → 두목 Lv(만렙 뒤로는 체력만)');
  // 제 단계: 혼자는 못 깨고 둘을 데려가면 깬다
  const g = mk(40, 3, 5), st0 = g.partyState();
  ok(st0.left === 2 && st0.best === 5 && st0.tier === 6, '상태: 남은 횟수 · 최고 · 다음 단계', JSON.stringify(st0));
  const W0 = { ...g.S.wallet };
  const solo = mk(40, 3, 5).partyFight(6, []);
  ok(solo && !solo.cleared && solo.rewards === null && solo.share[0] === 100, '제 단계는 혼자서 못 깸 · 보상 없음', JSON.stringify(solo.share));
  const r = g.partyFight(6, [deck(40, 'spear'), deck(40, 'bow')]);
  ok(r && r.cleared && r.timeMs < 60000 && r.allies.length === 2, '센 동행 둘과는 깸', `${r.timeMs}ms`);
  ok(r.share.length === 3 && Math.abs(r.share.reduce((a, b) => a + b, 0) - 100) < 0.5 && r.share.every((x) => x > 0), '피해 몫 셋 · 합 100', JSON.stringify(r.share));
  ok(r.rewards.first && r.rewards.tix === GM.PARTY.rew.first.tix && g.S.wallet['ticket:gear'] === (W0['ticket:gear'] || 0) + r.rewards.tix && g.S.wallet['item:stone'] === (W0['item:stone'] || 0) + r.rewards.stones && g.S.wallet['ticket:pal'] === (W0['ticket:pal'] || 0) + r.rewards.pal, '처음 깬 보상이 지갑에');
  ok(g.S.wallet.gold === W0.gold && g.S.hero.lv === 40, '은자 · 경험치는 주지 않음');
  ok(g.S.party.best === 6 && g.partyState().tier === 7 && g.partyState().left === 1, '최고 단계 +1 · 횟수 하나');
  // 단계: 최고 + 1까지만 · 깬 단계는 다시(작은 보상)
  ok(g.partyFight(8, [deck(40)]) === null && g.partyFight(0, []) === null && g.partyState().left === 1, '최고 + 2 단계 · 0 단계는 못 감(횟수 그대로)');
  const r2 = g.partyFight(3, [deck(40), deck(40, 'bow')]);
  ok(r2.cleared && !r2.rewards.first && r2.rewards.tix === GM.PARTY.rew.again.tix && r2.rewards.pal === 0 && g.S.party.best === 6, '깬 단계 다시 — 작은 보상 · 최고는 그대로');
  // 하루 횟수 · 다음 날
  ok(g.partyState().left === 0 && g.partyFight(3, []) === null, '하루 2번 뒤로는 못 감');
  g.now = T0 + DAYMS; ok(g.partyState().left === 2 && g.S.party.best === 6, '다음 날 횟수가 돌아옴 · 최고는 남음');
  // 동행 상한: 한참 위 단계에 만렙 동행 둘 — 동행 하나의 피해는 내 피해를 넘지 못해 업혀 가지 못함
  const gc = mk(40, 3, 8), rc = gc.partyFight(9, [deck(150, 'spear'), deck(150, 'mage')]);
  ok(rc && !rc.cleared && rc.dmg[1] <= rc.dmg[0] && rc.dmg[2] <= rc.dmg[0] && rc.dmg[1] > rc.dmg[0] * 0.95, '동행 한 명 ≤ 내 피해의 100%', JSON.stringify(rc.dmg));
  ok(rc.dmg.reduce((a, b) => a + b, 0) <= rc.dmg[0] * 3 && rc.rewards === null && gc.partyState().left === 1, '셋이 합쳐 내 세 배까지 · 져도 횟수는 하나');
  // 있을 수 없는 덱은 빠짐 · 셋째부터는 버림
  const gb = mk(40, 3, 5), bad = deck(40); bad.f.st.atk *= 1e6;
  const rb = gb.partyFight(6, [bad, { uid: 'x' }, deck(40), deck(40), deck(40)]);
  ok(rb && rb.allies.length === 0 && rb.share[1] === 0 && !rb.cleared, '있을 수 없는 덱은 동행으로 안 침 · 앞의 둘만 봄', JSON.stringify(rb.share));
  // 결정론: 같은 씨앗 → 같은 결과 / 연습 동행
  const a = mk(40, 11, 5).partyFight(6, [deck(40), deck(40, 'bow')]), b = mk(40, 11, 5).partyFight(6, [deck(40), deck(40, 'bow')]);
  ok(JSON.stringify(a) === JSON.stringify(b), '같은 씨앗 · 같은 동행 → 같은 결과');
  const bots = g.partyBots();
  ok(bots.length === 3 && bots.every((o) => o.bot && g.deckClean(o) && o.pw > 0) && JSON.stringify(bots) === JSON.stringify(g.partyBots()), '연습 동행 셋(덱 모양 그대로)');
  ok(mk(40, 3, 5).partyFight(6, bots.slice(0, 2)).cleared, '연습 동행 둘과도 제 단계를 깸');
  // 옛 저장(S.party 없음)
  const go = new Game(newGame('sword', T0, 3), T0); delete go.S.party;
  const so = go.partyState(); ok(so.left === 2 && so.best === 0 && so.tier === 1 && go.S.party.runs === 0, '옛 저장도 그대로 열림');
  const g2 = new Game(JSON.parse(JSON.stringify(g.S)), g.now); ok(g2.partyState().best === 6, '저장 → 불러오기');
  ok(g.today().length === 9, '오늘 할 일 목록은 그대로(동행 토벌은 넣지 않음)');
}

console.log('\n=== v607 모음 그림 — 병기 · 동료 · 영물 그림이 다 있다 ===');
{
  const { COLLECT } = await import('../js/s2/tables/s5.js'); const { existsSync } = await import('node:fs');
  const miss = []; for (const [sys, D] of Object.entries(COLLECT)) for (let k = 0; k < D.kinds; k++) if (!existsSync(new URL(`../art/s2/coll/${sys}-${k}.webp`, import.meta.url))) miss.push(`${sys}-${k}`);
  ok(miss.length === 0, '모음 그림 75장', miss.join(' '));
}

console.log('\n=== 새 기능 점검 — 기연 · 동행 · 옛 세이브 · 날 바뀜 ===');
{
  const GM = await import('../js/s2/game.js');
  const T0 = 1.8e12, DAYMS = 24 * 3600e3;
  const mk = (L, seed = 3) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(L)); g.tick(T0); return g; };
  // 기연: 카드는 번호(0~2)로만 고른다 — 배열의 이름('length')으로 고르면 횟수만 날아가고 지갑에 이상한 칸이 생겼다
  { const g = mk(40); g.fateKill(GM.FATE_NEED); g.fateOpen(); const w0 = JSON.stringify(g.S.wallet);
    ok(g.fatePick('length') === null && g.fatePick('0') === null && g.fatePick(1.5) === null && g.fatePick(-1) === null && g.fatePick(3) === null, '기연: 번호가 아니면 못 고름');
    ok(g.fateState().ready === 1 && g.fateState().cards && JSON.stringify(g.S.wallet) === w0 && !('undefined' in g.S.wallet), '기연: 못 고르면 횟수 · 카드 · 지갑 그대로', JSON.stringify(g.S.wallet));
    ok(g.fatePick(2) && g.fatePick(2) === null && g.fateState().ready === 0, '기연: 한 번 고르면 끝(두 번 못 받음)'); }
  // 기연: 만렙이면 경험치 카드가 나오지 않는다(받아도 0 — 자동 성장이 첫 카드로 받아 기연을 날렸다)
  { const g = mk(PR.LEVEL_MAX); let exp = 0; const kinds = new Set();
    for (let i = 0; i < 200; i++) { g.fate().ready = 1; const c = g.fateOpen(); if (c.some((x) => x.k === 'exp')) exp++; for (const x of c) kinds.add(x.k); g.fatePick(0); }
    ok(exp === 0 && kinds.size === GM.FATE_CARDS.length - 1, '기연: 만렙에는 경험치 카드 없음 · 나머지 일곱은 그대로', `경험치 ${exp}번 · ${kinds.size}가지`);
    const h = mk(40); let seen = 0; for (let i = 0; i < 100; i++) { h.fate().ready = 1; if (h.fateOpen().some((x) => x.k === 'exp')) seen++; h.fatePick(1); }
    ok(seen > 0, '기연: 만렙 전에는 경험치 카드가 나온다', seen); }
  // 동행 토벌: 같은 무인을 두 번 데려가도 한 명 몫
  { const pg = () => { const g = mk(40); g.fighter = () => refPlayer(40, 'sword'); g.S.party = { day: GM.dayKey(T0), runs: 0, best: 5 }; return g; };
    const deck = (uid, job = 'spear') => ({ uid, name: '벗', f: { lv: 40, job, st: { ...refPlayer(40, job).st } } });
    const one = pg().partyFight(6, [deck('a')]), twice = pg().partyFight(6, [deck('a'), deck('a')]), two = pg().partyFight(6, [deck('a'), deck('b')]);
    ok(twice.allies.length === 1 && twice.dmg[2] === 0 && JSON.stringify(twice.dmg) === JSON.stringify(one.dmg) && twice.cleared === one.cleared, '동행: 같은 무인 둘 = 한 명', JSON.stringify(twice.dmg));
    ok(two.allies.length === 2 && two.dmg[2] > 0, '동행: 다른 무인 둘은 둘 다 싸운다', JSON.stringify(two.dmg));
    // 못 가는 단계 · 싸움 중에는 횟수 · 난수를 쓰지 않는다
    const g = pg(), r0 = JSON.stringify(g.rng.state());
    ok([NaN, -1, 0, 7, 1e99, 'x', undefined].every((t) => g.partyFight(t, []) === null) && g.partyState().left === 2 && JSON.stringify(g.rng.state()) === r0, '동행: 못 가는 단계는 횟수 · 난수 그대로');
    g.fateState(); g.shopState(); g.partyBots(); g.statPts(); g.fateKill(GM.FATE_NEED); g.statAuto(); g.shopBuy('free'); g.shardExchange();
    ok(JSON.stringify(g.rng.state()) === r0, '기연 칸 · 상점 · 스탯 · 조각은 난수를 쓰지 않는다(열 때 · 싸울 때만)');
    // 자정(KST) — 23:59에 다 쓰고 00:00에 돌아온다
    const mid = (GM.dayKey(T0) + 1) * DAYMS - 9 * 3600e3, h = pg(); h.S.wallet.gold = 1e12;
    h.tick(mid - 1000); h.partyFight(1, []); h.partyFight(1, []); h.shopBuy('stone', 3); h.shopBuy('free');
    ok(h.partyState().left === 0 && h.shopState().find((x) => x.id === 'stone').left === 0 && !h.shopFreeCan(), '23:59 — 오늘 것을 다 씀');
    h.tick(mid - 1); ok(h.partyState().left === 0 && !h.shopFreeCan(), '23:59:59.999 — 아직 그대로');
    h.tick(mid); ok(h.partyState().left === 2 && h.S.party.best === 5 && h.shopFreeCan() && h.shopState().find((x) => x.id === 'stone').left === 3, '00:00 — 새로(최고 단계는 남음)');
    h.tick(mid + 5000); h.shopBuy('free'); h.tick(mid + 9000); ok(!h.shopFreeCan(), '같은 날 안에서는 다시 열리지 않는다'); }
  // 옛 세이브(새 칸이 하나도 없음) — 불러와서 모두 써 본다 · 새 칸을 채운 세이브는 그대로 돌아온다
  { const g = mk(40, 8); g.S.wallet['item:shard'] = 45; g.fateKill(GM.FATE_NEED + 100); const cards = g.fateOpen(); g.shopBuy('free'); g.statUp('crit', 3); g.S.party = { day: GM.dayKey(T0), runs: 1, best: 3 };
    const b = Game.load(g.save(), T0);
    ok(b.signed && JSON.stringify(b.fateState().cards) === JSON.stringify(cards) && b.fateState().g === 100 && !b.shopFreeCan() && b.S.hero.sp.crit === 3 && b.partyState().left === 1 && b.partyState().best === 3 && b.S.wallet['item:shard'] === 45 && b.power() === g.power(), '저장 → 불러오기: 기연 카드 · 상점 · 스탯 · 동행 · 조각 그대로');
    const S = JSON.parse(JSON.stringify(g.S)); delete S.hero.sp; delete S.fate; delete S.shop; delete S.party; delete S.wallet['item:shard'];
    const o = new Game(S, T0); let err = '';
    try { o.tick(T0 + 1000); o.hunt(2000); o.autoGrow(); o.statReset(); o.statAuto(); o.fateOpen(); o.fatePick(0); o.shopState(); o.shopBuy('gear'); o.shardExchange(); o.partyBots(); o.partyFight(1, []); Game.load(o.save(), T0 + 2000).autoGrow(); } catch (e) { err = e.message; }
    ok(!err && o.statPts() === 0 && o.partyState().left === 1 && Number.isFinite(o.power()) && Object.values(o.S.wallet).every((v) => Number.isFinite(v)), '옛 세이브: 새 기능이 모두 돈다 · 지갑에 이상한 값 없음', err); }
  // 스탯: 치명(0.2‰씩)이 소수여도 전투력 · 서열 칸은 정수 · 되돌렸다 다시 찍어도 레벨 − 1점
  { const g = mk(21); g.statUp('crit', 3); const p = g.rankProfile();
    ok(Number.isInteger(g.power()) && Number.isInteger(g.power('pvp')) && Number.isInteger(p.power) && Number.isInteger(p.pvpPower), '스탯: 치명이 소수여도 전투력은 정수');
    for (let i = 0; i < 5; i++) { g.statReset(); g.statUp('atk', 999); g.statUp('hp', 2.9); g.statAuto(); }
    ok(g.hero.spUsed() === 20 && g.statPts() === 0, '스탯: 되돌리고 다시 찍어도 레벨 − 1점', JSON.stringify(g.S.hero.sp)); }
}

console.log('\n=== 강호 패스 — 4주 시즌 · 놀면 점수 · 서른 단 ===');
{
  const { PASS, PASS_PTS, PASS_REWARDS, passTotal } = await import('../js/s2/tables/pass.js');
  const { passSeason } = await import('../js/s2/game.js');
  const DAYMS = 86400e3, T0 = Date.UTC(2026, 10, 19, 3);   // 시즌 첫 주 목요일 낮(한국 시각)
  const fresh = (seed = 4) => { const g = new Game(newGame('sword', T0, seed), T0); g.tick(T0); return g; };
  const mk = () => { const g = fresh(); g.addExp(EX.cumExp(40)); g.tick(T0); g.S.wallet['ticket:gear'] = 600; g.S.wallet.gold = 1e12; g.S.wallet['item:stone'] = 1e6; for (let i = 0; i < 60; i++) g.pullGear(10); GR.equipBest(g.S.gear, 40); for (const s of GE.SLOTS) for (let i = 0; i < 14; i++) g.enhance(s); g.dirtyStats = true; return g; };
  // 표: 서른 단 · 다 받아도 적게
  const tot = passTotal(), coll = (tot['ticket:weapon'] || 0) + (tot['ticket:pal'] || 0) + (tot['ticket:relic'] || 0);
  ok(PASS.weeks === 4 && PASS.tiers === 30 && PASS.need === 100 && PASS_REWARDS.length === 30 && PASS_REWARDS.every((r) => Object.values(r).every((n) => Number.isInteger(n) && n > 0)), '표: 서른 단 · 단마다 보상 하나');
  ok(tot['ticket:gear'] <= 80 && coll <= 12 && tot['ticket:time'] <= 3 && tot.goldMin <= 120, '표: 다 받아도 적다(장비 뽑기권 80 · 모음 뽑기권 12 · 시간 티켓 3 안)', JSON.stringify(tot));
  ok([5, 15, 25].every((t) => Object.keys(PASS_REWARDS[t - 1]).some((k) => /weapon|pal|relic/.test(k))) && [10, 20].every((t) => PASS_REWARDS[t - 1]['ticket:time'] === 1) && PASS_REWARDS[29]['ticket:gear'] === 10, '표: 다섯째 단은 모음 뽑기권 · 10 · 20단은 시간 티켓 · 30단은 큰 보상');
  // 점수 — 놀이마다
  { const g = mk(), p = () => g.passState().pts; let p0 = p();
    const gotPts = (fn) => { p0 = p(); fn(); return p() - p0; };
    ok(p0 === 0 && g.passState().tier === 0 && g.passState().rewards.every((r) => r.state === 'lock'), '처음은 0점 · 모두 잠김');
    g.books.daily.get('d_kill').done = true; g.books.weekly.get('w_pvp').done = true; g.books.ach.get('a_kill_0').done = true;
    ok(gotPts(() => g.claimMission('daily', 'd_kill')) === PASS_PTS.daily && PASS_PTS.daily === 10, '일일 임무 받기 +10');
    ok(gotPts(() => g.claimMission('daily', 'd_kill')) === 0, '이미 받은 임무는 점수 없음');
    ok(gotPts(() => g.claimMission('weekly', 'w_pvp')) === 30, '주간 임무 받기 +30');
    ok(gotPts(() => g.claimMission('ach', 'a_kill_0')) === 0, '업적 받기는 점수 없음');
    ok(gotPts(() => g.attend()) === 10 && gotPts(() => g.attend()) === 0, '출석 +10(하루 한 번)');
    const dr = []; for (const k of Object.keys(CT.DAILY_DUNGEONS)) { let r = null; const d = gotPts(() => { r = g.dailyDungeon(k); }); if (r) dr.push([r.cleared, d]); }
    ok(dr.some((x) => x[0]) && dr.every((x) => x[1] === (x[0] ? 5 : 0)), '수련동을 깨면 +5(못 깨면 없음)', JSON.stringify(dr));
    ok(gotPts(() => g.emit('dungeon', { job: 1 })) === 0 && gotPts(() => g.emit('kill', { n: 1, boss: 1 })) === 0 && gotPts(() => g.emit('login')) === 0, '전직 시험 · 사냥 · 날 바뀜은 점수 없음');
    const T = g.stage(), i0 = T.idx; T.kills = STAGE_KILLS; g.challenge(); const d1 = gotPts(() => { for (let i = 0; i < 200 && g.bossFight; i++) g.hunt(1000); });
    ok(g.stage().idx === i0 + 1 && d1 === 5, '스테이지 두목을 깨면 +5', `${i0} → ${g.stage().idx} · +${d1}`);
    ok(gotPts(() => g.runNow('wboss')) === 10, '월드보스 한 번 +10');
    ok(gotPts(() => g.pvpFight(0)) === 5, '대결 한 번 +5');
    ok(gotPts(() => g.partyFight(1, [])) === 10 && gotPts(() => g.partyFight(99, [])) === 0, '동행 토벌 한 번 +10(못 가는 단계는 없음)');
    ok(g.passState().dayPts === p() && p() > 0 && p() <= PASS.dayCap, '오늘 점수 = 모은 점수(첫날)', `${p()}`); }
  // 하루 상한 · 다음 날 · 단 계산
  { const g = fresh();
    ok(g.passAdd(120) === 120 && g.passAdd(100) === 30 && g.passAdd(10) === 0 && g.passState().dayPts === 150 && g.passState().pts === 150, '하루 150점까지');
    ok(g.passAdd(-5) === 0 && g.passAdd(NaN) === 0 && g.passState().pts === 150, '이상한 값은 0점');
    const mid = (dayKey(T0) + 1) * DAYMS - 9 * 3600e3;
    g.tick(mid - 1); ok(g.passAdd(10) === 0, '23:59:59 — 아직 오늘');
    g.tick(mid); ok(g.passState().dayPts === 0 && g.passState().pts === 150 && g.passAdd(100) === 100, '자정(한국 시각)에 오늘 점수만 새로');
    const s = g.passState();
    ok(s.pts === 250 && s.tier === 2 && s.into === 50 && s.need === 100 && s.dayCap === 150 && s.rewards.length === 30 && s.rewards.map((r) => r.state).join(',') === ['can', 'can', ...Array(28).fill('lock')].join(','), '250점 = 2단 · 다음 단까지 50/100');
    // 받기 — 한 번만 · 잠긴 단은 안 됨
    const W = g.S.wallet, t0 = W['ticket:gear'] || 0, r0 = JSON.stringify(g.rng.state()), lv0 = g.S.hero.lv, exp0 = g.S.hero.exp;
    const c1 = g.passClaim(1);
    ok(c1 && c1.tier === 1 && c1.give['ticket:gear'] === 2 && W['ticket:gear'] === t0 + 2 && g.passClaim(1) === null && W['ticket:gear'] === t0 + 2, '1단 받기 — 한 번만');
    ok([3, 30, 0, -1, 31, 1.5, '2', NaN, undefined].every((t) => g.passClaim(t) === null) && g.passState().rewards[2].state === 'lock', '잠긴 단 · 없는 단은 받지 못한다');
    ok(g.passState().rewards[0].state === 'got' && g.passState().rewards[1].state === 'can' && g.passCan() === 1, '받음 · 받을 수 있음 표시');
    g.tick(mid + DAYMS); g.passAdd(150); const gold0 = W.gold, st0 = W['item:stone'] || 0, all = g.passClaimAll();   // 400점 = 4단
    const wantGold = Math.round(10 * EX.KILLS_PER_MIN * GS.goldPerMob(g.S.hero.lv));
    ok(all.map((x) => x.tier).join(',') === '2,3,4' && W['item:stone'] === st0 + 20 && all[1].gold === wantGold && W.gold === gold0 + wantGold && W['ticket:gear'] === t0 + 4, '모두 받기 — 2 · 3 · 4단(강화석 20 · 은자 10분 몫 · 뽑기권 2)', JSON.stringify(all));
    ok(g.passClaimAll().length === 0 && g.passCan() === 0, '다시 누르면 받을 것이 없다');
    ok(JSON.stringify(g.rng.state()) === r0 && g.S.hero.lv === lv0 && g.S.hero.exp === exp0, '패스는 난수를 쓰지 않는다 · 경험치를 주지 않는다');
    // 저장 → 불러오기
    const b = Game.load(g.save(), g.now), sb = b.passState();
    ok(b.signed && sb.pts === 400 && sb.tier === 4 && sb.dayPts === 150 && sb.rewards.filter((r) => r.state === 'got').length === 4 && b.passClaim(4) === null && JSON.stringify(b.S.pass) === JSON.stringify(g.S.pass), '저장 → 불러오기(점수 · 받은 단 그대로)'); }
  // 시즌 — 4주(월요일 한국 시각 자정에 바뀜) · 바뀌면 처음부터
  { const g = fresh(), s0 = g.passState(), end = T0 + s0.endsInMs;
    ok(s0.season === passSeason(T0) && s0.no === 1 && new Date(end + 9 * 3600e3).getUTCDay() === 1 && (end + 9 * 3600e3) % DAYMS === 0 && s0.endsInMs > 24 * DAYMS && s0.endsInMs <= 28 * DAYMS, '시즌은 월요일 자정에 끝난다 · 지금은 1시즌', `${(s0.endsInMs / DAYMS).toFixed(2)}일 남음`);
    ok(passSeason(end - 1) === s0.season && passSeason(end) === s0.season + 1 && passSeason(end + 28 * DAYMS - 1) === s0.season + 1 && passSeason(end + 28 * DAYMS) === s0.season + 2 && passSeason(end - 28 * DAYMS) === s0.season && passSeason(end - 28 * DAYMS - 1) === s0.season - 1, '한 시즌 = 꼭 28일');
    g.passAdd(150); g.passClaim(1); g.tick(end - 1);
    ok(g.passState().pts === 150 && g.passState().endsInMs === 1 && g.passState().rewards[0].state === 'got', '끝나기 1ms 전 — 그대로');
    g.tick(end); const s1 = g.passState();
    ok(s1.season === s0.season + 1 && s1.no === 2 && s1.pts === 0 && s1.tier === 0 && s1.dayPts === 0 && s1.rewards.every((r) => r.state === 'lock') && s1.endsInMs === 28 * DAYMS, '새 시즌 — 점수 · 받은 단이 처음부터');
    // 서른 단 끝 — 더 쌓이지 않는다
    let t = end; for (let d = 0; d < 25; d++) { g.tick(t); g.passAdd(150); t += DAYMS; }
    const sf = g.passState();
    ok(sf.pts === 3000 && sf.tier === 30 && sf.into === 100 && g.passAdd(10) === 0 && sf.rewards.every((r) => r.state === 'can'), '3000점 = 서른 단(스무 날) · 더 쌓이지 않는다');
    const W = g.S.wallet, w0 = { ...W }, all = g.passClaimAll();
    ok(all.length === 30 && W['ticket:gear'] - (w0['ticket:gear'] || 0) === passTotal()['ticket:gear'] && W['ticket:time'] - (w0['ticket:time'] || 0) === 2 && W['ticket:relic'] - (w0['ticket:relic'] || 0) === 3 && Object.values(W).every((v) => Number.isFinite(v)), '서른 단 모두 받기 = 표의 합', JSON.stringify(passTotal())); }
  // 옛 세이브(S.pass 없음 · 깨진 칸)
  { const g = fresh(); delete g.S.pass; const o = new Game(JSON.parse(JSON.stringify(g.S)), T0); let err = '';
    try { o.tick(T0 + 1000); o.hunt(2000); o.passClaimAll(); o.autoGrow(); } catch (e) { err = e.message; }
    ok(!err && o.S.pass && o.passState().tier === 0 && Array.isArray(o.S.pass.got), '옛 세이브: 패스 칸이 생긴다', err);
    o.S.pass = { season: o.S.pass.season, pts: 100, day: o.S.pass.day, dayPts: 0 }; ok(o.passState().rewards[0].state === 'can' && !!o.passClaim(1), '받은 단 칸이 없어도 돈다'); }
  // 자동 성장 — 받을 단을 받는다(보상 받기를 끄면 그대로)
  { const g = fresh(); g.passAdd(150); const off = g.autoGrow({ claim: false, daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
    ok(off.claim === 0 && g.passCan() === 1, '자동 성장: 보상 받기를 끄면 그대로');
    const t0 = g.S.wallet['ticket:gear'] || 0, on = g.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
    ok(on.claim >= 1 && g.passCan() === 0 && g.S.wallet['ticket:gear'] === t0 + 2 && g.passState().rewards[0].state === 'got', '자동 성장: 패스 단을 받는다', JSON.stringify(on)); }
  ok(mk().today().length === 9, '오늘 할 일 목록은 그대로(패스는 넣지 않음)');
}

console.log('\n=== v612 새 기능 업적 · 길잡이(스탯 · 기연 · 모음 · 동행 · 패스 · 상점 · 뽑기 조각) ===');
{
  const GM = await import('../js/s2/game.js');
  const T0 = Date.UTC(2026, 10, 19, 3);
  const NEW = ['stat', 'fate', 'coll', 'party', 'pass', 'shop', 'shard'];
  const A = MS.achievements(), OLD = A.filter((a) => !NEW.includes(a.ev)), NA = A.filter((a) => NEW.includes(a.ev));
  ok(NEW.every((k) => MS.ACHIEVE[k] && MS.ACHIEVE[k].steps.length >= 4 && MS.ACHIEVE[k].steps.length <= 5 && MS.ACHIEVE[k].steps.every((v, i, s) => i === 0 || v > s[i - 1])), '새 업적 일곱 · 단계 넷~다섯 · 오름차순');
  ok(A.length === 85 && OLD.length === 53 && NA.length === 32, '업적 단계 수 53 → 85(새 32)', `${A.length}`);
  ok(MS.ACHIEVE.stat.steps.at(-1) === 149 && MS.ACHIEVE.coll.steps.at(-1) === 75 && MS.ACHIEVE.pass.steps.at(-1) === 30, '끝 단계 = 닿을 수 있는 끝(스탯 149 · 모음 75 · 패스 30단)');
  const mx = (L, f) => Math.max(...L.map(f));
  ok(mx(NA, (a) => a.huntMin) <= mx(OLD, (a) => a.huntMin) / 2 && mx(NA, (a) => a.items['ticket:gear']) <= 13 && mx(NA, (a) => a.items['item:stone']) <= 75, '새 업적 보상은 옛 것의 절반(한 단계 최대 사냥 25분 · 뽑기권 13 · 강화석 75)', `${mx(NA, (a) => a.huntMin)}분`);
  ok(OLD.every((a) => a.huntMin === 10 * (a.step + 1) && a.items['ticket:gear'] === 5 * (a.step + 1)), '옛 업적 보상은 그대로');
  // 길잡이 — g21 뒤에 일곱 · 모두 바로가기 · 바로가기 열쇠가 창에 있다
  const gi = MS.GUIDE.findIndex((q) => q.id === 'g21'), NG = MS.GUIDE.slice(gi + 1);
  ok(NG.map((q) => q.id).join() === 'g22,g23,g24,g25,g26,g27,g28' && NG.map((q) => q.ev).join() === 'stat,fate,shop,shard,party,pass,coll', '길잡이 g22~g28: 스탯 → 기연 → 덤 → 조각 → 동행 → 패스 → 모음', NG.map((q) => q.ev).join());
  const app = fs.readFileSync(new URL('../js/s2/ui/app.js', import.meta.url), 'utf8');
  const gk = Object.fromEntries([...app.match(/const goKey = \(go\) => \(\{([^}]*)\}/)[1].matchAll(/(\w+): '([a-z]+:\d)'/g)].map((m) => [m[1], m[2]]));
  const tabKeys = new Set([...app.match(/const TABS = \[([\s\S]*?)\n\];/)[1].matchAll(/'([a-z]+:\d)'/g)].map((m) => m[1]));
  ok(NG.every((q) => q.go && gk[q.go] && tabKeys.has(gk[q.go])) && MS.GUIDE.filter((q) => q.go).every((q) => tabKeys.has(gk[q.go])), '길잡이 바로가기 열쇠가 모두 창 칸으로 풀린다', NG.map((q) => `${q.go}→${gk[q.go]}`).join(' '));
  ok(gk.stat === 'hero:0' && gk.shop === 'shop:0' && gk.pass === 'pass:0' && gk.party === 'party:0', '스탯 · 상점 · 패스 · 동행 열쇠');
  const mk = (seed = 7, L = 40) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(L)); g.tick(T0); return g; };
  const B = (g) => g.books.ach, dn = (g, id) => !!B(g).get(id).done;
  const prefix = (g, ev) => { const L = A.filter((a) => a.ev === ev).map((a) => dn(g, a.id)), k = L.indexOf(false); return k === -1 || L.slice(k).every((x) => !x); };
  // 스탯
  { const g = mk(); ok(!dn(g, 'a_stat_0'), '스탯: 찍기 전에는 아님');
    g.statUp('atk', 9); ok(!dn(g, 'a_stat_0'), '스탯 9점 — 아직'); g.statUp('hp', 1); ok(dn(g, 'a_stat_0') && !dn(g, 'a_stat_1'), '스탯 10점 찍으면 첫 단계');
    g.statAuto(); ok(g.hero.spUsed() === 39 && dn(g, 'a_stat_1') && !dn(g, 'a_stat_2') && prefix(g, 'stat'), '고르게 찍기로 39점 → 30점 단계까지(차례대로)');
    const ag = g.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false });
    ok(B(g).get('a_stat_0').got && B(g).get('a_stat_1').got && ag.claim >= 2, '자동 성장이 받는다', `${ag.claim}`); }
  // 기연
  { const g = mk(); for (let i = 0; i < 9; i++) { g.fateKill(GM.FATE_NEED); g.fateOpen(); g.fatePick(1); }
    ok(g.S.fate.n === 9 && !dn(g, 'a_fate_0'), '기연 9번 — 아직');
    g.feed.length = 0; g.fateKill(GM.FATE_NEED); g.fateOpen(); g.fatePick(2); ok(dn(g, 'a_fate_0') && !dn(g, 'a_fate_1') && g.feed.some((f) => f.k === 'ach' && f.id === 'a_fate_0'), '기연 10번 고르면 첫 단계 · 알림'); }
  // 모음
  { const g = mk(); for (const s of GM.COLLECTS) g.S.wallet[`ticket:${s}`] = 500;
    let i = 0; while (g.collKinds() < 10 && i++ < 50) g.pullCollect(GM.COLLECTS[i % 3], 1);
    ok(g.collKinds() >= 10 && dn(g, 'a_coll_0') && dn(g, 'a_coll_1') === g.collKinds() >= 25, '모음 10가지 → 첫 단계', `${g.collKinds()}가지`);
    for (let j = 0; j < 30; j++) for (const s of GM.COLLECTS) g.pullCollect(s, 10);
    const k = g.collKinds(); ok(MS.ACHIEVE.coll.steps.every((v, j) => dn(g, `a_coll_${j}`) === k >= v) && g.achBest('coll') === k, '모음 가지 수 = 단계(차례대로) · 창 진행 값', `${k}가지`); }
  // 동행 토벌
  { const g = mk(3, 60); g.fighter = () => refPlayer(60, 'sword'); g.S.party = { day: GM.dayKey(T0), runs: 0, best: 2 }; g.minute();
    ok(!dn(g, 'a_party_0') && g.achBest('party') === 2, '동행 2단계 — 아직');
    const r = g.partyFight(3, []); ok(r && r.cleared && g.S.party.best === 3 && dn(g, 'a_party_0') && !dn(g, 'a_party_1'), '동행 3단계를 깨면 첫 단계', JSON.stringify(r && r.cleared)); }
  // 강호 패스(한 시즌 단)
  { const g = mk(); const P = g.passSt(); P.pts = 495; g.minute(); ok(!dn(g, 'a_pass_0') && g.achBest('pass') === 4, '패스 4단 — 아직');
    g.books.daily.get('d_kill').done = true; g.claimMission('daily', 'd_kill'); ok(g.passState().tier === 5 && dn(g, 'a_pass_0') && !dn(g, 'a_pass_1'), '임무 받기로 5단 → 첫 단계(단이 오를 때 바로)'); }
  // 상점
  { const g = mk(); g.S.wallet.gold = 1e12; g.shopBuy('free'); g.shopBuy('gear', 5); g.shopBuy('stone', 3);
    ok(B(g).get('a_shop_0').p === 9 && !dn(g, 'a_shop_0'), '상점 9개 — 아직', `${B(g).get('a_shop_0').p}`);
    g.shopBuy('exped'); ok(dn(g, 'a_shop_0') && B(g).get('a_shop_1').p === 10 && !dn(g, 'a_shop_1'), '10개 사면 첫 단계 · 다음 단계도 10부터');
    g.minute(); ok(B(g).get('a_shop_1').p === 10, '분마다 맞추기는 산 수를 늘리지 않는다'); }
  // 뽑기 조각
  { const g = mk(); g.S.wallet['item:shard'] = GS.SHARD_PER_TICKET * 9; g.shardExchange(); ok(B(g).get('a_shard_0').p === 9 && !dn(g, 'a_shard_0'), '조각 → 뽑기권 9장 — 아직');
    g.S.wallet['item:shard'] = GS.SHARD_PER_TICKET * 3; g.shardExchange(); ok(dn(g, 'a_shard_0') && B(g).get('a_shard_1').p === 12, '12장 → 첫 단계'); }
  // 길잡이 g22 ~ g28을 실제로 해 보기
  { const g = mk(5, 60); g.fighter = () => refPlayer(60, 'sword');
    for (const q of MS.GUIDE.slice(0, gi + 1)) g.S.q.guide[q.id] = { p: q.need, done: true, got: true };
    const cur = () => MS.guideCurrent(g.S.q.guide)?.id, done = () => !!g.S.q.guide[cur()]?.done, steps = [];
    const step = (want, fn) => { const c = cur(), d0 = done(); fn(); const d1 = done(); steps.push(`${c}:${d0 ? 1 : 0}${d1 ? 1 : 0}`); return c === want && !d0 && d1 && !!g.claimGuide(); };
    g.minute();
    ok(cur() === 'g22' && !done(), '길잡이 g21 다음은 g22(스탯) · 안 했으면 기다림');
    ok(step('g22', () => g.statUp('atk', 1)), 'g22 스탯 찍기');
    ok(step('g23', () => { g.fateKill(GM.FATE_NEED); g.fateOpen(); g.fatePick(0); }), 'g23 기연 고르기');
    ok(step('g24', () => g.shopBuy('free')), 'g24 상점 덤');
    ok(step('g25', () => { g.S.wallet['item:shard'] = GS.SHARD_PER_TICKET; g.shardExchange(); }), 'g25 조각 바꾸기');
    ok(step('g26', () => g.partyFight(1, [])), 'g26 동행 1단계');
    ok(step('g27', () => { g.passSt().pts = 100; g.passClaim(1); }), 'g27 패스 보상 받기');
    for (const s of GM.COLLECTS) g.S.wallet[`ticket:${s}`] = 400;
    ok(step('g28', () => { for (let j = 0; j < 30 && g.collKinds() < 30; j++) for (const s of GM.COLLECTS) g.pullCollect(s, 10); }), 'g28 모음 30가지');
    ok(cur() === undefined, '길잡이 끝', steps.join(' ')); }
  // 이미 해 둔 무인 — 길잡이를 받자마자 상태로 끝난 다음 단계가 끝나고 자동 성장이 줄줄이 받는다
  { const g = mk(6, 60); g.statAuto(); g.S.fate = { n: 12 }; g.S.party = { day: GM.dayKey(T0), runs: 0, best: 9 }; g.passSt().pts = 1000; g.passClaim(1); g.shopBuy('free');
    for (const q of MS.GUIDE.slice(0, gi + 1)) g.S.q.guide[q.id] = { p: q.need, done: true, got: true };
    g.S.q.guide.g21 = { p: 1, done: true, got: false };
    g.claimGuide(); ok(MS.guideCurrent(g.S.q.guide)?.id === 'g22' && g.S.q.guide.g22?.done, '길잡이를 받으면 상태로 이미 한 다음 단계가 바로 끝남');
    const ag = g.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false });
    ok(['g22', 'g23', 'g24'].every((id) => g.S.q.guide[id]?.got) && MS.guideCurrent(g.S.q.guide)?.id === 'g25', '자동 성장: g22 · g23 · g24를 받고 g25(조각 — 바꿔야 끝)에서 기다림', `지금 ${MS.guideCurrent(g.S.q.guide)?.id}`);
    ok(['a_stat_1', 'a_fate_0', 'a_party_1', 'a_pass_1'].every((id) => B(g).get(id).got) && !B(g).get('a_party_2').done && !B(g).get('a_stat_2').done, '자동 성장이 새 업적(스탯 30 · 기연 10 · 동행 8 · 패스 10)을 받는다 — 스탯 59점은 60 단계 아님', `${ag.claim}`); }
  // 옛 세이브 — 새 칸이 없어도 열리고 · 저장 → 불러오기
  { const S = newGame('sword', T0, 8); delete S.fate; delete S.party; delete S.pass; delete S.shop; delete S.hero.sp; S.q = { guide: {}, daily: {}, weekly: {}, ach: { a_kill_0: { p: 5, done: false, got: false } } };
    const g = new Game(S, T0); let err = null; try { g.tick(T0); g.minute(); g.autoGrow(); g.achBest('pass'); } catch (e) { err = e; }
    const g2 = Game.load(g.save(), T0 + 1000);
    ok(!err && g2.signed && g2.books.ach.get('a_kill_0').p >= 5 && g2.achBest('fate') === 0 && g2.achBest('party') === 0, '옛 세이브(새 칸 없음)도 돌고 저장 · 불러오기', String(err)); }
}

console.log('\n=== 현상수배 — 날마다 사냥 목표 셋 · 상자 ===');
{
  const BT = await import('../js/s2/tables/bounty.js');
  const DAYMS = 86400e3, T0 = Date.UTC(2026, 10, 19, 3);   // 한국 시각 낮
  const mk = (seed = 5, top = 1) => { const g = new Game(newGame('sword', T0, seed), T0); g.tick(T0); if (top > 1) { g.addExp(EX.cumExp(Math.min(140, top))); const T = g.stage(); T.idx = top; T.top = top; } return g; };
  const sig = (g) => JSON.stringify(g.bountySt().list.map((x) => [x.kind, x.target, x.need, x.rew]));
  // 표
  ok(BT.BOUNTY_SLOTS.join() === 'stage,kill,boss' && BT.BOUNTY_REW.goldMin === 10 && BT.BOUNTY_CHEST['ticket:gear'] === 3 && BT.BOUNTY_CHEST.coll.length === 3, '표: 셋(칸 · 아무 칸 · 두목) · 은자 10분 몫 · 상자 뽑기권 3 + 모음 뽑기권 하나');
  ok(Object.values(BT.BOUNTY_T).filter((T) => T.min).every((T) => T.min.every((m) => m >= 10 && m <= 20)) && BT.BOUNTY_T.boss.n.every((n) => n >= 2 && n <= 3), '표: 몹 수는 사냥 10~20분 몫 · 두목 2~3번');
  // 결정론 — 같은 날 · 같은 씨앗이면 같다 · this.rng를 쓰지 않는다
  { const a = mk(5, 37), b = mk(5, 37), r0 = JSON.stringify(a.rng.state());
    ok(sig(a) === sig(b), '같은 날 · 같은 씨앗 → 같은 목록', sig(a));
    a.bountyState(); a.bountyCan(); ok(JSON.stringify(a.rng.state()) === r0, '목록을 만들어도 게임 난수(this.rng)는 그대로');
    const sigs = new Set(); for (let s2 = 1; s2 <= 12; s2++) sigs.add(sig(mk(s2, 37))); ok(sigs.size >= 4, '씨앗마다 목록이 다르다', `${sigs.size}/12`);
    const c = mk(5, 37); c.tick(T0 + DAYMS); ok(sig(c) !== sig(a) || c.bountySt().day === a.bountySt().day + 1, '다음 날 다른 날 목록'); }
  // 닿을 수 있는 목표 — 가장 멀리 간 칸을 넘지 않는다 · 수는 10~20분 몫
  { let bad = []; for (let s2 = 1; s2 <= 30; s2++) for (const top of [1, 5, 23, 80, 150]) { const g = mk(s2, top); for (let d = 0; d < 3; d++) { g.tick(T0 + d * DAYMS); for (const x of g.bountySt().list) {
      const mins = x.kind === 'boss' ? 0 : x.need / EX.KILLS_PER_MIN;
      if (x.kind === 'stage' && (x.target < 1 || x.target > top || x.target < top - 9)) bad.push(`stage ${x.target}/${top}`);
      if (x.kind !== 'boss' && (mins < 9.5 || mins > 21)) bad.push(`${x.kind} ${x.need}`);
      if (x.kind === 'boss' && (x.need < 2 || x.need > 3)) bad.push(`boss ${x.need}`);
      if (!['ticket:gear', 'item:stone'].includes(x.rew.k) || !(x.rew.n >= 1 && x.rew.n <= 20)) bad.push(JSON.stringify(x.rew)); } } }
    ok(!bad.length, '목표는 늘 닿는다(칸 ≤ 가장 멀리 간 칸 · 9칸 안 · 몹 수 10~20분 몫)', bad.slice(0, 5).join(' '));
    const s = mk(3, 23).bountyState().list[0]; ok(s.kind === 'stage' && s.ch === Math.ceil(s.target / 10) && s.mob && /^s2:c/.test(s.art), '칸 목표는 그 장 몹 이름 · 그림', JSON.stringify(s)); }
  // 진짜 사냥으로 찬다 → 받기 한 번 → 셋 다 끝내면 상자
  { const g = mk(7, 1), W = g.S.wallet; g.S.wallet['ticket:gear'] = 0;
    const L0 = g.bountySt().list; const want = L0.map((x) => x.need);
    let feed = 0, sec = 0; for (let i = 0; i < 3600 && !g.bountySt().list.every((x) => x.done); i++) { g.hunt(1000); sec++; feed += g.feed.splice(0).filter((f) => f.k === 'bounty').length; }
    const L = g.bountySt().list;
    ok(L.every((x) => x.done && x.n === x.need), '사냥(g.hunt)으로 셋 다 찬다', JSON.stringify(L.map((x) => [x.kind, x.n, x.need])) + ` · 몹 ${g.S.kills}`);
    ok(feed === 3, '끝날 때마다 화면 알림 하나(셋)', `${feed}`);
    ok(sec <= 3600 && g.S.kills <= Math.max(...want) + 300, '장비 없는 Lv1도 한 시간 안에 셋 다(몹 수는 가장 큰 목표 + 두목 몫)', `${(sec / 60).toFixed(1)}분 · 몹 ${g.S.kills}`);
    const t0 = W['ticket:gear'] || 0, s0 = W['item:stone'] || 0, gold0 = W.gold, r0 = JSON.stringify(g.rng.state()), exp0 = g.S.hero.exp;
    const c0 = g.bountyClaim(0), gold = Math.round(10 * EX.KILLS_PER_MIN * GS.goldPerMob(g.S.hero.lv));
    ok(c0 && c0.gold === gold && W.gold === gold0 + gold && (W['ticket:gear'] - t0) + (W['item:stone'] - s0) === L[0].rew.n && g.bountyClaim(0) === null, '받기 — 은자 10분 몫 + 뽑기권 · 강화석 · 한 번만', JSON.stringify(c0));
    ok([3, -1, 1.5, '1', NaN, undefined].every((i) => g.bountyClaim(i) === null), '없는 번호는 받지 못한다');
    const t1 = W['ticket:gear']; const ch = g.bountyChest(); const ck = Object.keys(ch.give).find((k) => k !== 'ticket:gear');
    ok(ch && W['ticket:gear'] === t1 + 3 && ['ticket:weapon', 'ticket:pal', 'ticket:relic'].includes(ck) && g.bountyChest() === null, '셋 다 끝 → 상자(뽑기권 3 + 모음 뽑기권 하나) · 한 번만', JSON.stringify(ch));
    ok(g.bountyClaim(1) && g.bountyClaim(2) && g.bountyCan() === 0 && JSON.stringify(g.rng.state()) === r0 && g.S.hero.exp === exp0, '나머지 받기 · 받기는 난수 · 경험치를 쓰지 않는다');
    // 다음 날 새로
    const mid = (dayKey(T0) + 1) * DAYMS - 9 * 3600e3; g.tick(mid - 1); ok(g.bountySt().list.every((x) => x.got), '23:59:59 — 아직 오늘');
    g.tick(mid); const N = g.bountyState(); ok(N.day === dayKey(T0) + 1 && N.list.every((x) => x.n === 0 && !x.done && !x.got) && !N.chest.got && !N.chest.can && N.left === 3, '자정에 새 목록'); }
  // 상자는 셋 다 끝나야
  { const g = mk(9, 1); g.bountySt().list[0].n = 0; for (let i = 0; i < 60; i++) g.hunt(1000); ok(g.bountyChest() === null && !g.bountyState().chest.can, '셋이 안 끝나면 상자 없음'); }
  // 칸 목표는 그 칸 앞쪽에서만 센다
  { const g = mk(11, 40), x = g.bountySt().list[0]; const T = g.stage(); T.idx = Math.max(1, x.target - 1); T.auto = false; g.fight = null; for (let i = 0; i < 30; i++) g.hunt(1000);
    const y = g.bountySt().list; ok(x.target === 1 || (y[0].n === 0 && y[1].n > 0), '앞 칸(목표보다 낮은 칸)에서는 칸 목표가 안 찬다 · 아무 칸 목표는 찬다', JSON.stringify(y.map((z) => z.n))); }
  // 칸 두목을 깨면 두목 목표
  { const g = mk(12, 1), T = g.stage(); T.kills = STAGE_KILLS; g.challenge(); for (let i = 0; i < 200 && g.bossFight; i++) g.hunt(1000);
    ok(g.stage().idx === 2 && g.bountySt().list[2].n === 1, '칸 두목을 깨면 두목 목표 +1'); }
  // 자동 성장이 받는다(보상 받기를 끄면 그대로)
  { const g = mk(13, 1); for (const x of g.bountySt().list) { x.n = x.need; x.done = true; }
    g.autoGrow({ claim: false, daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false }); ok(g.bountyCan() === 4, '자동 성장: 보상 받기를 끄면 그대로(셋 + 상자)');
    const t0 = g.S.wallet['ticket:gear'] || 0, r = g.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
    const ex = g.bountySt().list.filter((x) => x.rew.k === 'ticket:gear').reduce((a, x) => a + x.rew.n, 0);
    ok(r.claim >= 4 && g.bountyCan() === 0 && g.S.bounty.chest && g.S.wallet['ticket:gear'] === t0 + ex + 3, '자동 성장: 셋 · 상자를 받는다', JSON.stringify(r)); }
  // 옛 세이브 · 깨진 칸 · 저장 → 불러오기
  { const S = newGame('sword', T0, 14); delete S.bounty; const g = new Game(S, T0); let err = '';
    try { g.tick(T0); g.hunt(3000); g.bountyState(); g.bountyClaim(0); g.bountyChest(); g.autoGrow(); } catch (e) { err = e.message; }
    ok(!err && g.S.bounty && g.S.bounty.list.length === 3, '옛 세이브: 현상수배 칸이 생긴다', err);
    g.S.bounty = { day: g.S.bounty.day }; let e2 = ''; try { g.bountyState(); g.hunt(1000); } catch (e) { e2 = e.message; } ok(!e2 && g.S.bounty.list.length === 3, '깨진 칸이면 다시 만든다', e2);
    const s0 = JSON.stringify(g.S.bounty), b = Game.load(g.save(), g.now); ok(b.signed && JSON.stringify(b.S.bounty) === s0 && JSON.stringify(b.bountySt()) === s0, '저장 → 불러오기(진행 그대로)'); }
  ok(mk().today().length === 9, '오늘 할 일 목록은 그대로(현상수배는 넣지 않음)');
}

console.log('\n=== v609 자동 성장 — 은자 아끼기여도 스탯은 찍는다 ===');
{
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 41), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const p0 = g.statPts(); const r = g.autoGrow({ kit: false, enh: false, train: false, claim: false, daily: false, pull: false });
  ok(p0 > 0 && g.statPts() === 0 && r.train === p0, '은자 쓰기를 꺼도 남은 스탯 점수는 찍는다', JSON.stringify({ p0, left: g.statPts(), train: r.train }));
  const g2 = new Game(newGame('sword', T0, 42), T0); g2.addExp(EX.cumExp(30)); g2.tick(T0); const q0 = g2.statPts(); g2.autoGrow({ stat: false, claim: false, daily: false, pull: false });
  ok(g2.statPts() === q0, 'stat을 끄면 안 찍는다');
}

console.log('\n=== v634 강함 진맥 — 표준 무인 층별 견줌 ===');
{
  const PZ = await import('../js/s2/grow/pulse.js'), { STD_SRC } = await import('../js/s2/tables/stdsrc.js'), { buildStdSrc } = await import('../js/s2/sim/std.js');
  ok(JSON.stringify(buildStdSrc()) === JSON.stringify(STD_SRC), '층별 출처 표가 시뮬과 같다(바꾸면 node tools/s2sim/std.mjs)');
  ok(STD_SRC.length === STD.length && STD_SRC.slice(1).every((r) => r.gear && r.pal), '층별 출처 — 레벨마다 한 줄(장비 · 동료 늘 있음)');
  const T0 = 1.8e12, mk = (L, idx, seed = 51) => { const g = new Game(newGame('sword', T0, seed), T0); if (L > 1) g.addExp(EX.cumExp(L)); g.tick(T0); const T = g.stage(); T.idx = T.top = idx; return g; };
  const g = mk(45, 45), s0 = JSON.stringify(g.S), p0 = PZ.pulse(g);
  ok(JSON.stringify(g.S) === s0 && JSON.stringify(PZ.pulse(g)) === JSON.stringify(p0), '계산만 한다(세이브 그대로 · 두 번 불러도 같다)');
  const by = (p) => Object.fromEntries(p.rows.map((r) => [r.k, r.pct]));
  const b0 = by(p0);
  ok(p0.L === 45 && ['level', 'gear', 'kit', 'mastery', 'adv', 'stat', 'weapon', 'pal', 'relic', 'realm'].every((k) => k in b0), 'Lv 45 — 층 줄(레벨 · 장비 · 무공 · 마스터리 · 전직 · 스탯 · 병기 · 동료 · 영물 · 경지)', JSON.stringify(b0));
  ok(b0.level === 100 && b0.gear === 0 && b0.pal === 0 && p0.low && p0.low.pct === 0, '빈손 — 장비 · 동료 0% · 가장 뒤처진 것 0%', JSON.stringify(p0.low));
  for (let i = 0; i < 30; i++) g.autoGrow({});
  const p1 = PZ.pulse(g), b1 = by(p1);
  ok(b1.gear > 30 && b1.pal > 30 && b1.kit === 100 && b1.stat === 100, '자동 성장 뒤 — 장비 · 동료가 오르고 무공 · 스탯은 꽉 참', JSON.stringify(b1));
  ok(p1.low && p1.rows.every((r) => r.pct >= p1.low.pct) && p1.low.pct < PZ.PULSE_OK && typeof p1.low.go === 'string' && /^[a-z]+:\d$/.test(p1.low.go), '가장 뒤처진 것 = 가장 낮은 줄 · 가는 칸', `${p1.low.name} ${p1.low.pct}% → ${p1.low.go}`);
  const g2 = mk(30, 60); ok(by(PZ.pulse(g2)).level === 50, '레벨 — 무인 Lv 30 · 스테이지 60이면 50%');
  // 표준 무인 자신과 견주면 전투력 층은 100%
  const sd = PZ.stdHero(80, 'sword'), fake = { S: { hero: sd.hero.s, gear: { slots: {}, eq: {} } }, hero: sd.hero, zoneLv: () => 80, sources: () => sd.src.map((x) => ({ src: { gear: '장비:weapon', weapon: '병기', pal: '동료', relic: '영물', realm: '경지', journey: '강호행', look: '꾸미기' }[x.layer], stats: x.stats })), palList: () => sd.pals };
  const pf = by(PZ.pulse(fake));
  ok(['gear', 'weapon', 'pal', 'relic', 'realm', 'journey', 'level', 'kit', 'mastery', 'adv'].every((k) => pf[k] === 100), '표준 무인 자신 — 층마다 100%', JSON.stringify(pf));
  const g3 = mk(1, 1); ok(PZ.pulse(g3).rows.every((r) => r.k !== 'adv' && r.k !== 'mastery'), 'Lv 1 — 아직 없는 층(전직 · 마스터리)은 줄이 없다');
}

console.log('\n=== v635 병기 · 동료 · 영물 고유 기질 · 손으로 끼기 ===');
{
  const TR = await import('../js/s2/tables/traits.js'), GM = await import('../js/s2/game.js');
  const T0 = 1.8e12;
  // 표: 종류마다 기질 하나 · 있는 스탯 · 모든 기질이 어딘가에 쓰인다
  const bad = GM.COLLECTS.flatMap((s) => Array.from({ length: S5T.COLLECT[s].kinds }, (_, k) => [s, k]).filter(([s2, k]) => !TR.TRAIT[TR.traitOf(s2, k)]));
  ok(!bad.length && GM.COLLECTS.every((s) => TR.TRAIT_OF[s].length === S5T.COLLECT[s].kinds), '종류마다 기질 하나(20 · 25 · 30)', JSON.stringify(bad));
  ok(Object.values(TR.TRAIT).every((t) => SS.STATS[t.stat]) && Object.keys(TR.TRAIT).every((id) => GM.COLLECTS.some((s) => TR.TRAIT_OF[s].includes(id))), '기질 스탯은 STATS에 있고 14가지가 모두 쓰인다');
  // 값: 등급 · 각성 · 레벨 · 칸 몫
  const C = CL.newCollect('weapon'); C.own[0] = { n: 1, awk: 0, lv: 1 }; C.own[19] = { n: 1, awk: 0, lv: 1 };
  ok(CL.traitVal(C, 0) === 150 && CL.traitVal(C, 19) === 35, '보품 천뢰신검 무력화 +15% · 범품 새총 은자 +3.5%', `${CL.traitVal(C, 0)} ${CL.traitVal(C, 19)}`);
  C.own[0].awk = 5; C.own[0].lv = 30; ok(CL.traitVal(C, 0) === Math.round(150 * 1.5 * 1.29), '각성 5 · Lv30 → ×1.5 × 1.29', CL.traitVal(C, 0));
  const P2 = CL.newCollect('pal'); P2.own[0] = { n: 1, awk: 0, lv: 1 }; ok(CL.traitVal(P2, 0, 0) === 90 && CL.traitVal(P2, 0, 1) === 31, '동료 주 칸 100% · 부 칸 35%(90 → 31)');
  const R2 = CL.newCollect('relic'); R2.own[0] = { n: 1, awk: 0, lv: 1 }; ok(CL.traitVal(R2, 0) === 30, '영물은 60%(칸 셋)');
  ok(CL.traitSources(C).length === 0, '안 끼면 기질 없음(보유 효과만)');
  C.eq[0] = 0; ok(CL.traitSources(C)[0].stats.stunGg === CL.traitVal(C, 0), '끼면 그 스탯으로');
  // 끝까지 키워도 작게
  const maxOne = (s) => Math.round(Math.max(...Object.values(TR.TRAIT).map((t) => t.v)) * 1.5 * 1.29 * TR.TRAIT_SYS_P[s] / 1000);
  ok(maxOne('weapon') <= 500 && TR.TRAIT.crit.v * 1.5 * 1.29 * (1 + 0.35 * 4) <= 120 && TR.TRAIT.boss.v * 1.5 * 1.29 <= 100, '끝까지 키워도: 두목 피해 한 칸 ≤ 10% · 동료 치명 5칸 ≤ 12%', `${maxOne('weapon')}`);
  // 게임: 뽑으면 추천 자동(섞은 값) · 손으로 끼면 뽑아도 그대로 · 추천 자동으로 되돌리기
  const g = new Game(newGame('sword', T0, 77), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  g.S.wallet['ticket:pal'] = 200; g.pullCollect('pal', 100); const P = g.S.colls.pal;
  const bv = P.eq.map((k) => CL.blendVal(P, k));
  ok(!CL.isManual(P) && bv.every((v, i) => i === 0 || v <= bv[i - 1]) && Object.keys(P.own).every((k) => P.eq.includes(+k) || CL.blendVal(P, +k) <= Math.min(...bv)), '추천 자동: 섞은 값(장착 값 + 기질 무게) 큰 차례', JSON.stringify(bv.map(Math.round)));
  const out = Object.keys(P.own).map(Number).find((k) => !P.eq.includes(k)), main0 = P.eq[0];
  const eqSnap = JSON.stringify(P.eq), pv = g.collPreview('pal', 0, out);
  ok(pv.pw0 === g.power() && pv.pw1 > 0 && !CL.isManual(P) && JSON.stringify(P.eq) === eqSnap, '미리 보기는 상태를 바꾸지 않는다', JSON.stringify(pv));
  ok(g.collEquip('pal', 0, out) && P.eq[0] === out && CL.isManual(P) && g.power() === pv.pw1, '손으로 끼기 → 직접 고름 · 미리 본 전투력 그대로');
  const sw = P.eq[2]; ok(g.collEquip('pal', 0, sw) && P.eq[0] === sw && P.eq[2] === out, '이미 낀 것을 다른 칸에 → 자리 바꿈');
  g.pullCollect('pal', 100); ok(P.eq[0] === sw && P.eq[2] === out, '직접 고름이면 뽑아도 낀 것 그대로');
  ok(g.collEquip('pal', 4, null) && P.eq[4] === null && !g.collEquip('pal', 9, out) && !g.collEquip('pal', 0, 999), '빼기 · 없는 칸/없는 것은 안 됨');
  g.collAuto('pal', true); ok(!CL.isManual(P) && P.eq.every((k) => k != null) && CL.blendVal(P, P.eq[0]) >= CL.blendVal(P, main0), '추천 자동으로 되돌리면 다시 좋은 것부터');
  // 무공 쿨 기질 → 무공 쿨이 준다(상한 30%)
  { const f0 = g.hero.fighter(g.sources(), g.palList()), f1 = g.traitKit({ ...f0, st: { ...f0.st, cdr: 100 } }), f2 = g.traitKit({ ...f0, st: { ...f0.st, cdr: 900 } });
    const k0 = f0.kit.find((k) => k.cdMs), i = f0.kit.indexOf(k0);
    ok(k0 && f1.kit[i].cdMs === Math.round(k0.cdMs * 0.9) && f2.kit[i].cdMs === Math.round(k0.cdMs * 0.7), '무공 쿨 −10% · 상한 −30%', `${k0?.cdMs} → ${f1.kit[i]?.cdMs} / ${f2.kit[i]?.cdMs}`); }
  // 싸움: 평타 옆 하나 더 · 처치 회복 · 무력화 게이지
  { const run = (st) => { const H = refPlayer(60, 'sword'); H.kit = []; Object.assign(H.st, st); const F = new SideFight(sideRoom(60, 4), H, 5); F.run(30000); return F; };
    const a = run({}), b = run({ splash: 300 });
    const side = (F) => F.events.filter((e) => e[0] === 'hit' && e[5] === 0 && e[6] === 1).length;
    ok(side(a) === 0 && side(b) > 10 && b.dmgOut > a.dmgOut, '평타가 옆 적 하나 더(30% 피해 · 무공 없이 평타만)', `${side(a)} → ${side(b)} · 피해 ${a.dmgOut} → ${b.dmgOut}`);
    const F = run({ killHeal: 50, stunGg: 500 }); F.hero.hp = 100; F.killHeal(); ok(F.hero.hp === 100 + Math.floor(F.hero.st.hp * 0.05), '처치마다 체력 5% 회복');
    F.hero.st.killHeal = 900; F.hero.hp = 1; F.killHeal(); ok(F.hero.hp === 1 + Math.floor(F.hero.st.hp * TR.KILL_HEAL_CAP / 1000), '처치 회복 상한 10%');
    ok(F.stunAdd(100) === 150 && a.stunAdd(100) === 100, '무력화 게이지 +50%'); }
  // 크기: 키운 상태에서 기질을 빼면 전투력이 얼마나 주나(작게)
  { const h = new Game(newGame('sword', T0, 78), T0); h.addExp(EX.cumExp(60)); h.tick(T0);
    for (const s of GM.COLLECTS) { h.S.wallet[`ticket:${s}`] = 400; h.pullCollect(s, 400); }
    const p1 = h.power(), src0 = h.sources; h.sources = () => src0.call(h).filter((x) => !/기질$/.test(x.src)); const p0 = h.power(); h.sources = src0;
    ok(p1 > p0 && p1 / p0 < 1.12, '뽑기 400번씩 · 자동 — 기질이 더하는 전투력 < 12%', `${p0} → ${p1} (+${((p1 / p0 - 1) * 100).toFixed(1)}%)`); }
  // 옛 세이브 · 저장 → 불러오기(직접 고름 그대로)
  { const h = new Game(newGame('sword', T0, 79), T0); h.S.wallet['ticket:relic'] = 30; h.pullCollect('relic', 30); const R = h.S.colls.relic, k = Object.keys(R.own).map(Number).find((x) => !R.eq.includes(x)) ?? R.eq[2];
    h.collEquip('relic', 1, k); const b = Game.load(h.save(), h.now); ok(b.S.colls.relic.man === true && b.S.colls.relic.eq[1] === k, '저장 → 불러오기: 직접 고름 · 낀 것 그대로');
    const old = new Game(newGame('sword', T0, 80), T0); let err = ''; try { old.pullCollect('weapon', 5); old.power(); old.hunt(2000); } catch (e) { err = e.message; } ok(!err && !CL.isManual(old.S.colls.weapon), '옛 세이브(man 없음) = 추천 자동', err); }
}

console.log('\n=== v636 방치 쌓임 — 읽기 전용 모음(idleState) ===');
{
  const T0 = 1.8e12, H = 3600e3, g = new Game(newGame('sword', T0, 41), T0); g.tick(T0);
  const s0 = JSON.stringify(g.S);
  const I0 = g.idleState();
  ok(I0.run === null && I0.tix >= 1 && I0.canSend && I0.capH === EC.OFFLINE_CAP_H && I0.capMs === EC.OFFLINE_CAP_H * H && I0.weekLeftMs === EC.OFFLINE_WEEK_CAP_H * H && I0.adLeft === EC.OFFLINE_AD_PER_DAY && I0.rate > 0 && I0.rate < 1, '처음: 원정 없음 · 보낼 수 있음 · 자리 비움 12시간 · 주 84시간 · 광고 셋', JSON.stringify(I0));
  ok(JSON.stringify(g.S) === s0, '읽기만 한다(세이브가 그대로)');
  ok(g.startExped(4), '원정 4시간 보냄');
  g.now = T0 + H; const I1 = g.idleState();
  ok(I1.run && I1.run.hours === 4 && I1.run.leftMs === 3 * H && Math.abs(I1.run.p - 0.25) < 1e-9 && !I1.run.done && !I1.canSend, '1시간 뒤: 남은 3시간 · 25% · 아직', JSON.stringify(I1.run));
  g.now = T0 + 5 * H; const I2 = g.idleState();
  ok(I2.run.done && I2.run.leftMs === 0 && I2.run.p === 1, '4시간 넘으면 도착 · 100%');
  const r = g.claimExped(); ok(r && g.idleState().run === null, '받으면 원정 없음');
  // 이번 주에 자리 비움을 80시간 썼으면 한 번에 4시간만
  const O = g.S.offline; O.week = String(weekKey(g.now)); O.weekUsedMs = 80 * H;
  ok(g.idleState().capMs === 4 * H && g.idleState().weekLeftMs === 4 * H, '주 몫이 4시간 남으면 한 번에 4시간', g.idleState().capMs / H);
  O.week = 'old'; ok(g.idleState().capMs === 12 * H, '지난주 몫은 세지 않는다');
  O.adDay = String(dayKey(g.now)); O.adUsed = 2; ok(g.idleState().adLeft === 1, '광고 ×2 오늘 남은 수');
  // 옛 세이브(원정 · 자리 비움 칸 없음)도 읽힌다
  const old = new Game(newGame('sword', T0, 42), T0); delete old.S.exped.run; old.S.wallet['ticket:exped'] = 0;
  const I3 = Game.load(old.save(), T0).idleState(); ok(I3.run === null && !I3.canSend && I3.capMs === 12 * H, '원정권 없으면 보낼 수 없음 · 옛 세이브 그대로');
}
console.log('\n=== v610 창 줄 그림 아이콘 ===');
{
  const UI = await import('../js/s2/tables/uiicons.js');
  const miss = UI.UI_ICONS.filter((n) => !fs.existsSync(new URL(`../art/s2/ui/${n}.webp`, import.meta.url)));
  ok(UI.UI_ICONS.length >= 36 && !miss.length, `그림 아이콘 ${UI.UI_ICONS.length}개가 모두 art/s2/ui에 있다`, miss.join(' '));
  const bad = Object.entries(UI.GLY_ICON).filter(([, n]) => !UI.UI_ICONS.includes(n)).map(([g2, n]) => `${g2}→${n}`);
  ok(!bad.length, '글자 → 그림 표는 있는 그림만 가리킨다', bad.join(' '));
  const used = new Set(Object.values(UI.GLY_ICON)); const app = fs.readFileSync(new URL('../js/s2/ui/app.js', import.meta.url), 'utf8');
  const direct = [...app.matchAll(/'i:([a-z]+):/g), ...app.matchAll(/`i:([a-z]+):/g)].map((m) => m[1]); for (const n of direct) used.add(n);
  ok(direct.every((n) => UI.UI_ICONS.includes(n)), '줄에서 바로 고른 그림(i:이름)도 있는 그림이다', direct.filter((n) => !UI.UI_ICONS.includes(n)).join(' '));
  ok(UI.UI_ICONS.every((n) => used.has(n)), '안 쓰는 그림이 없다', UI.UI_ICONS.filter((n) => !used.has(n)).join(' '));
  ok(UI.uiIcon('塔')[0] === 'tower' && UI.uiIcon('i:def:防').join() === 'def,防' && UI.uiIcon('✓').join() === ',✓' && UI.uiIcon('i:nope:x').join() === ',x', '글자 → 그림 풀이(없는 그림 · 표에 없는 글자는 글자 그대로)');
}

console.log('\n=== v634 차림 셋 — 장비 · 무공 · 동료를 한 벌로 · 두목 싸움 저절로 갈아입기 ===');
{
  const T0 = 1.8e12, mk = (seed) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(30)); g.tick(T0); g.S.wallet['ticket:gear'] = 300; g.S.wallet['ticket:pal'] = 30; g.S.wallet['ticket:relic'] = 30; g.S.hero.adv = 2; g.hero.kitUnlock();
    for (let i = 0; i < 30; i++) g.pullGear(10); g.pullCollect('pal', 30); g.pullCollect('relic', 30); return g; };
  const g = mk(71), G = g.S.gear, O = g.outfitSt(), uidOf = () => GE.SLOTS.map((s) => G.eq[s]?.uid ?? null).join();
  ok(O.sets.length === 3 && O.sets.every((x) => x === null) && O.names.join() === '차림 1,차림 2,차림 3' && O.hunt === -1 && O.boss === -1 && O.cur === -1 && !g.outfitHold(), '처음: 빈 칸 셋 · 걸린 것 없음 · 입은 것 없음');
  ok(!g.outfitLoad(0) && !g.outfitSave(3) && !g.outfitSave(-1) && !g.outfitName(0, '   ') && !g.outfitUse('hunt', 0) && !g.outfitUse('x', -1), '빈 칸 입기 · 없는 칸 · 빈 이름 · 빈 차림 걸기는 안 된다');
  // 차림 1 = 지금(최고) · 차림 2 = 가방의 다른 장비 + 무공 칸 순서 바꿈 + 동료 다른 줄
  const best = uidOf(), K = g.hero.kitState();
  ok(g.outfitSave(0) && G.presets[0] && G.presets[0].weapon === G.eq.weapon?.uid && g.S.outfit.cur === 0 && g.outfitHold(), '적기: 장비는 gear.js 프리셋 칸에도 · 입은 차림이 된다');
  const alt = {}; for (const s of GE.SLOTS) { const it = G.bag.find((x) => x.slot === s); if (it) { alt[s] = it.uid; GR.equip(G, it.uid); } }
  const ks0 = [...K.slots]; K.slots = [...K.slots].reverse(); K.off = K.slots.slice(0, 1);
  const P = g.S.colls.pal, pal0 = [...P.eq], own = Object.keys(P.own).map(Number), palAlt = own.filter((k) => !pal0.includes(k)).slice(0, 2); P.eq = [palAlt[0] ?? null, ...pal0.slice(1)];
  g.outfitSave(1); g.outfitName(1, '  벌이   차림 길게 쓴 이름 ');
  ok(g.S.outfit.names[1] === '벌이 차림 길게' && Object.keys(alt).length >= 5 && ks0.length >= 2 && palAlt.length >= 1, '이름: 공백 정리 · 8자까지', `${g.S.outfit.names[1]} alt ${Object.keys(alt).length} kit ${ks0.length} pal ${palAlt.length}`);
  const pw1 = g.power(); let r = g.outfitLoad(0);
  ok(r && r.miss === 0 && uidOf() === best && K.slots.join() === ks0.join() && K.off.length === 0 && P.eq.join() === pal0.join() && g.S.outfit.cur === 0, '차림 1 입기: 장비 · 무공 칸 · 자동/수동 · 동료 모두 그대로', JSON.stringify(r));
  ok(g.power() !== pw1 && g.dirtyStats, '입으면 전투력이 다시 셈해진다');
  r = g.outfitLoad(1);
  ok(r.miss === 0 && GE.SLOTS.every((s) => !alt[s] || G.eq[s]?.uid === alt[s]) && K.slots.join() === [...ks0].reverse().join() && K.off.length === 1 && P.eq[0] === (palAlt[0] ?? null), '차림 2 입기');
  // 지운(분해한) 장비 — 건너뛰고 지금 것을 둔다
  g.outfitLoad(0); const gone = GE.SLOTS.find((s) => alt[s]); const nb = G.bag.length; G.bag = G.bag.filter((x) => x.uid !== alt[gone]);
  const keep = G.eq[gone].uid; r = g.outfitLoad(1);
  ok(nb - G.bag.length >= 1 && r.miss === 1 && G.eq[gone].uid === keep && GE.SLOTS.filter((s) => s !== gone && alt[s]).every((s) => G.eq[s].uid === alt[s]), '없어진 장비 하나: 그 칸만 그대로(miss 1)', JSON.stringify(r));
  // 일괄 분해 후보에서 차림 장비는 빠진다
  const uids = g.outfitUids(); ok(uids.size >= 10 && g.gearJunk(6).every((it) => !uids.has(it.uid)), '일괄 분해 후보에 차림 장비는 없다', uids.size);
  // 입고 있으면 저절로 끼기 쉼 — 벗으면 다시
  const AG = { daily: false, claim: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false };
  g.outfitLoad(1); const before = uidOf(); g.autoGrow(AG);
  ok(uidOf() === before, '차림을 입고 있으면 자동 성장이 장비를 바꾸지 않는다');
  const strong = GR.makeGear(new Rng(5), gone, 6); g.obtain([strong]);
  ok(G.eq[gone] !== strong && G.bag.includes(strong), '입고 있으면 주운 장비도 가방으로(빈 칸만 채움)');
  ok(g.outfitOff() && !g.outfitHold() && !g.outfitOff(), '벗기');
  g.autoGrow(AG); ok(uidOf() !== before, '벗으면 다시 저절로 낀다');
  // 두목 차림 — 칸 두목 들어갈 때 갈아입고 끝나면 사냥 차림으로
  g.outfitSave(0); g.outfitOff(); ok(g.outfitUse('hunt', 0) && g.outfitUse('boss', 1) && g.S.outfit.cur === 0, '걸기: 사냥 1 · 두목 2(사냥을 걸면 바로 입음)');
  const huntU = uidOf(), T = g.stage(); T.kills = STAGE_KILLS; g.ensureFight();
  ok(g.challenge() && g.S.outfit.cur === 1 && GE.SLOTS.every((s) => !alt[s] || s === gone || G.eq[s].uid === alt[s]) && !!g.S.outfit.ret, '칸 두목 도전 → 두목 차림');
  ok(g.bossFight.hero.st.atk === g.fighter().st.atk, '두목 싸움은 두목 차림 스탯으로');
  ok(g.outfitLoad(0) === null, '두목 싸움 중에는 손으로 못 갈아입는다');
  let t = T0; while (g.bossFight && t < T0 + 400e3) { t += 1000; g.tick(t); g.hunt(1000); }
  ok(!g.bossFight && g.S.outfit.cur === 0 && uidOf() === huntU && !g.S.outfit.ret, '끝나면 사냥 차림으로');
  // 탑(화면 없이) — 들어갈 때 두목 · 끝나면 사냥
  let seen = -1; const ap = g.outfitApply.bind(g); g.outfitApply = (p2) => { if (g.S.outfit.ret && g.dg == null && seen < 0) seen = 1; return ap(p2); };
  const tr = g.towerFight(); delete g.outfitApply;
  ok(tr && seen === 1 && g.S.outfit.cur === 0 && uidOf() === huntU && !g.S.outfit.ret, '무한 탑: 두목 차림으로 싸우고 사냥으로 돌아온다');
  // 사냥 차림이 없으면 들어가기 전 그대로
  g.outfitUse('hunt', -1); g.outfitOff(); g.equipBest(); const freeU = uidOf(); g.towerFight();
  ok(uidOf() === freeU && g.S.outfit.cur === -1 && !g.S.outfit.ret, '사냥 차림이 없으면 들어가기 전 차림으로(벗은 채)');
  // 저장 → 불러오기 · 싸움 도중 저장(ret 남음)도 다음 사냥에서 되돌린다
  T.kills = STAGE_KILLS; g.challenge(); const s0 = JSON.stringify({ ...g.S.outfit, ret: null }); const b = Game.load(g.save(), g.now);
  ok(b.signed && b.S.outfit.ret && JSON.stringify({ ...b.S.outfit, ret: null }) === s0, '저장 → 불러오기(차림 그대로)');
  b.stage().kills = 0; b.tick(g.now + 1000); b.hunt(1000);
  ok(!b.S.outfit.ret && b.S.outfit.cur === -1 && GE.SLOTS.map((s) => b.S.gear.eq[s]?.uid ?? null).join() === freeU, '싸움 도중 저장한 세이브: 다음 사냥에서 되돌린다');
  // 옛 세이브 · 깨진 칸
  { const S = newGame('sword', T0, 72); delete S.outfit; const g2 = new Game(S, T0); let err = ''; try { g2.tick(T0); g2.hunt(2000); g2.autoGrow(); g2.towerFight(); } catch (e) { err = e.message; }
    ok(!err && !g2.S.outfit, '옛 세이브: 차림을 안 쓰면 칸도 안 생긴다', err);
    g2.S.outfit = { sets: [null], names: 5, hunt: 7, boss: 'x', cur: 2 }; const O2 = g2.outfitSt();
    ok(O2.sets.length === 3 && O2.names.length === 3 && O2.hunt === -1 && O2.boss === -1 && O2.cur === -1, '깨진 칸이면 고친다', JSON.stringify(O2)); }
  // 결정론 — 같은 씨앗 · 같은 조작이면 같은 결과
  const run = () => { const h = mk(73); h.outfitSave(0); h.outfitOff(); h.outfitUse('boss', 0); for (let i = 0; i < 3; i++) h.towerFight(); return JSON.stringify([h.S.tower.best, h.S.outfit.cur, h.S.outfit.ret, h.S.outfit.sets[0].kit, h.S.outfit.sets[0].coll, GE.SLOTS.map((s) => h.S.gear.eq[s]?.g), h.power()]); };   // uid는 모듈 셈(실행마다 다름)이라 빼고
  ok(run() === run(), '결정론');
  // 동료 — 없는 것 · 겹친 것은 빼고 좋은 것부터 채운다
  const g3 = mk(74), P3 = g3.S.colls.pal; g3.outfitSave(0); const w1 = P3.eq[1]; g3.S.outfit.sets[0].coll.pal = [999, w1, w1, null, null]; g3.outfitLoad(0);
  const nn = P3.eq.filter((k) => k != null);
  ok(P3.eq.every((k) => k == null || P3.own[k]) && new Set(nn).size === nn.length && P3.eq[1] === w1 && nn.length === Math.min(5, Object.keys(P3.own).length), '동료: 없는 것 · 겹친 것은 빼고 좋은 것부터 채움', P3.eq.join());
}

console.log('\n=== v635 교환소 — 명성 · 공적 · 혈전패 ===');
{
  const XT = await import('../js/s2/tables/exchange.js');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 11), T0); g.addExp(EX.cumExp(30)); g.tick(T0);
  const coin = (c) => g.S.wallet[XT.EX_CUR[c].key] || 0;
  ok(XT.EX_IDS.join() === 'fame,merit,blood' && XT.EX_IDS.every((c) => XT.EXCHANGE[c].length >= 4 && XT.EXCHANGE[c].every((x) => x.price > 0 && x.limit >= 1 && Object.keys(x.give).every((k) => XT.EX_GIVE_NAME[k]))), '재화 셋 · 진열대마다 넷 이상 · 값 · 주간 한도 · 이름');
  ok(XT.EX_EARN.fame.week.length === ON.PVP_TIERS.length, '명성 주간 보상은 대결 등급 수만큼', XT.EX_EARN.fame.week.length);
  // 처음: 재화 0 · S.ex 없음(옛 세이브와 같음) → 상태를 물으면 생긴다
  ok(!g.S.ex && XT.EX_IDS.every((c) => g.exCoin(c) === 0) && g.exState('fame').every((x) => !x.can && x.left === x.limit) && g.S.ex?.wk === weekKey(g.now), '처음 0 · 상태를 물으면 이번 주 기록이 생긴다');
  // 대결 — 이기면 12 · 지면 5
  const r = [0, 1, 2, 0, 1].map((i) => g.pvpFight(i)), fame = r.reduce((a, x) => a + (x.win ? XT.EX_EARN.fame.win : XT.EX_EARN.fame.lose), 0);
  ok(r.every(Boolean) && r.every((x) => x.fame === (x.win ? 12 : 5)) && coin('fame') === fame, '대결 한 판마다 명성(이김 12 · 짐 5)', `${r.filter((x) => x.win).length}승 · 명성 ${coin('fame')}`);
  const fr = g.pvpFriendly({ uid: 'B', name: '벗', score: 1000, f: JSON.parse(g.pvpDeck()) }); ok(coin('fame') === fame, '친선 대결은 명성 없음', fr ? 'ok' : 'null');
  // 월드보스 — 한 번에 8
  const w = [1, 2, 3].map(() => g.wbossFight());
  ok(w.every(Boolean) && coin('blood') === 3 * XT.EX_EARN.blood.try && g.lastDg.blood === XT.EX_EARN.blood.try, '월드보스 한 번마다 혈전패 8', coin('blood'));
  const b0 = coin('blood'), wr = g.claimWbWeek(5, 2); ok(wr && wr.blood === 45 && coin('blood') === b0 + 45 && g.claimWbWeek(5, 2) === null, '지난주 월드보스 2위 → 혈전패 45 · 한 번', wr?.blood);
  ok(g.exWbRank(1) === 60 && g.exWbRank(100) === 15 && g.exWbRank(9999) === 10 && g.exWbRank(0) === 0, '순위 → 혈전패(1위 60 · 100위 15 · 그 밖 10)');
  const b1 = coin('blood'), cr = g.wbCommunityClaim(300000); ok(cr && cr.n === 2 && cr.blood === 20 && coin('blood') === b1 + 20 && g.wbCommunityClaim(300000) === null, '공동 토벌 두 단계 → 혈전패 20', cr?.blood);
  // 문파 — 출석 15 · 토벌 단계마다 10 · 수련 40 (문파가 없으면 없음)
  ok(g.guildCheckin() === null && coin('merit') === 0, '문파가 없으면 공적 없음');
  g.setGuild('ABC234'); const gc = g.guildCheckin(); ok(gc && gc.merit === 15 && coin('merit') === 15, '문파 출석 → 공적 15');
  const gr = g.graidClaim(1e15, 30); ok(gr && gr.merit === gr.n * 10 && coin('merit') === 15 + gr.merit, '문파 토벌 단계 보상 → 단계마다 공적 10', `${gr?.n}단계`);
  const m1 = coin('merit'), gt = g.gtrainClaim(999, 1); ok(gt && gt.merit === 40 && coin('merit') === m1 + 40, '문파 수련 보상 → 공적 40');
  // 지난주 대결 등급 보상 → 명성
  g.S.pvp.lastWk = weekKey(g.now) - 7; g.S.pvp.lastBest = 99999; g.S.pvp.lastGot = null; const f0 = coin('fame'), pw = g.claimPvpWeek();
  ok(pw && pw.fame === XT.EX_EARN.fame.week.at(-1) && coin('fame') === f0 + pw.fame, '지난주 대결 최고 등급 → 명성 60', pw?.fame);
  // 바꾸기 — 값 · 한도 · 모자라면 아무것도 안 바뀜 · 난수를 쓰지 않는다
  const rs = JSON.stringify(g.rng), t0 = g.S.wallet['ticket:gear'] || 0, fh = coin('fame');
  const b = g.exBuy('fame', 'gear', 2); ok(b && b.paid === 80 && coin('fame') === fh - 80 && g.S.wallet['ticket:gear'] === t0 + 2 && JSON.stringify(g.rng) === rs, '명성 80 → 장비 뽑기권 2 · 난수 그대로');
  ok(g.exBuy('fame', 'gear', 4) === null && g.exState('fame').find((x) => x.id === 'gear').left === 3, '주간 한도를 넘으면 하나도 안 바꿈(남은 3)');
  ok(g.exBuy('fame', 'nope') === null && g.exBuy('nope', 'gear') === null && g.exBuy('fame', 'gear', 0) === null && g.exBuy('fame', 'gear', NaN) === null, '없는 것 · 0개 · NaN은 거절');
  g.S.wallet['coin:blood'] = 10; const w1 = JSON.stringify(g.S.wallet);
  ok(g.exBuy('blood', 'restore') === null && JSON.stringify(g.S.wallet) === w1 && !g.exState('blood').find((x) => x.id === 'restore').can, '혈전패가 모자라면 아무것도 안 바뀜');
  g.S.wallet['coin:merit'] = 1000; const h0 = g.S.wallet['item:heart'] || 0, mb = g.exBuy('merit', 'heart', 5);
  ok(mb && g.S.wallet['item:heart'] === h0 + 10 && g.exBuy('merit', 'heart') === null, '공적 → 심법 구슬 2 × 5 · 다 바꾸면 품절');
  // 주가 바뀌면 한도는 새로 · 재화는 넘어간다
  const keep = coin('merit'); g.tick(g.now + 7 * 86400e3);
  ok(g.exState('merit').find((x) => x.id === 'heart').left === 5 && coin('merit') === keep && g.S.ex.wk === weekKey(g.now), '다음 주: 한도 새로 · 남은 공적 그대로', keep);
  // 저장 → 불러오기(서명) · 옛 세이브(ex 없음)
  const L2 = Game.load(g.save(), g.now); ok(L2.signed && L2.exCoin('merit') === keep && L2.exState('merit')[0].left === L2.exState('merit')[0].limit, '저장 → 불러오기: 재화 · 이번 주 기록');
  const old = new Game(newGame('bow', T0, 3), T0); delete old.S.ex; ok(old.exState('blood').length === XT.EXCHANGE.blood.length && old.exCoin('blood') === 0, '옛 세이브도 읽힌다');
  // 크기: 세 진열대를 한 주에 다 사도 장비 뽑기권으로 치면 열 장 남짓(하루 상점 5장 × 7일보다 훨씬 작다)
  const tixAll = XT.EX_IDS.reduce((a, c) => a + XT.EXCHANGE[c].reduce((s, x) => s + (x.give['ticket:gear'] || 0) * x.limit, 0), 0);
  const weekFame = 35 * XT.EX_EARN.fame.win + XT.EX_EARN.fame.week.at(-1), weekBlood = 21 * XT.EX_EARN.blood.try + 60 + 3 * XT.EX_EARN.blood.community;
  ok(tixAll <= 12 && weekFame <= 500 && weekBlood <= 300, '한 주 최대: 장비 뽑기권 12장 이하 · 명성 500 · 혈전패 300 이하', `뽑기권 ${tixAll} · 명성 ${weekFame} · 혈전패 ${weekBlood}`);
  // 자동 성장은 교환소에서 사지 않는다(고르는 것은 사람)
  const g3 = new Game(newGame('sword', T0, 12), T0); g3.addExp(EX.cumExp(30)); g3.tick(T0); g3.S.wallet['coin:fame'] = 999; g3.autoGrow(); ok(g3.S.wallet['coin:fame'] === 999, '자동 성장은 재화를 쓰지 않는다');
}

console.log('\n=== v636 기세동 — 기세 쌓기 · 두목 시간 별 ===');
{
  const T0 = 1.9e12, SG = CT.SURGE, D = CT.DAILY_DUNGEONS.surge;
  ok(D && D.clear === 'score' && CT.CLEAR.includes(D.clear) && D.unlockLv >= 35 && D.timeMs === SG.phaseMs * 2, '표: 기세동 — 30초 사냥 + 30초 두목 · Lv 40', JSON.stringify(D));
  { const [a3, a2, a1] = SG.starMs; ok(a3 < a2 && a2 < a1 && a1 === SG.phaseMs && [[0, 3], [a3, 3], [a3 + 1, 2], [a2, 2], [a2 + 1, 1], [a1, 1], [a1 + 1, 0], [null, 0]].every(([ms, n]) => CT.surgeStar(ms) === n), `별: ${a3 / 1000}초 ★3 · ${a2 / 1000}초 ★2 · 30초 ★1 · 그 밖 0`); }
  ok(SG.cap * SG.per === 1000 && SG.goldMin[2] <= CT.DAILY_DUNGEONS.gold.reward.goldMin && SG.heart.every((h, i) => h >= 1 && h <= 2 && (!i || h >= SG.heart[i - 1])), '기세 끝 = 피해 +100% · 보상은 은자굴 이하 + 심법 구슬 1~2');
  const mk = (seed = 3, L = 45) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(L)); g.tick(T0); g.fighter = () => refPlayer(L, 'sword'); return g; };
  { const g = mk(); g.S.hero.lv = 30; ok(g.canDungeon('daily', 'surge') === `Lv ${D.unlockLv}부터`, 'Lv 40 전에는 잠김'); }
  // 한 판 — 앞 30초 기세가 처치 수만큼 쌓이고(끝 cap) · 피해 배율에 얹힌다 · 30초에 몹이 물러나고 두목
  { const g = mk(); const S0 = JSON.stringify(g.S.surge ?? null);
    ok(S0 === 'null', '옛 세이브: 기세동 기록 칸은 처음 깰 때 생긴다');
    ok(g.enterDungeon('daily', 'surge') && g.dg.sg && g.dg.sg.phase === 0, '입장 — 기세 0단');
    const F = g.dg.F; let maxDiff = 0, sawMeter = null;
    while (g.dg && g.dg.sg.phase === 0) { g.huntDungeon(500); if (!g.dg) break; const G = g.dg.sg; maxDiff = Math.max(maxDiff, Math.abs(G.stack - Math.min(SG.cap, F.kills))); sawMeter = g.dgStatus().sg; }
    ok(maxDiff === 0 && sawMeter && sawMeter.cap === SG.cap && sawMeter.dmgP === sawMeter.stack * SG.per / 10, '기세 = 처치 수(끝 50단) · 들판 막대 값', JSON.stringify(sawMeter));
    ok(g.dg && g.dg.sg.at >= SG.phaseMs && g.dg.sg.at < SG.phaseMs + 100 && F.mobs.length === 1 && F.mobs[0].kind === 'boss' && Math.abs(F.dmgX - (1 + g.dg.sg.stack * SG.per / 1000)) < 1e-9, '30초 — 몹이 물러나고 두목 하나 · 피해 배율 = 1 + 단 × 2%', `${g.dg?.sg.at} ${F.mobs.length} ${F.dmgX}`);
    const st = g.dg.sg.stack, gold0 = g.S.wallet.gold, h0 = g.S.wallet['item:heart'] || 0;
    while (g.dg) g.huntDungeon(1000);
    const r = g.lastDg, star = CT.surgeStar(r.bossMs);
    ok(r.cleared && r.star === star && star >= 1 && r.stack === st, '두목을 잡으면 클리어 · 두목 시간으로 별', `${r.bossMs}ms ★${r.star} 기세 ${r.stack}`);
    ok(r.gold === g.S.wallet.gold - gold0 && r.gold > 0 && r.heart === SG.heart[star - 1] && (g.S.wallet['item:heart'] || 0) - h0 === r.heart, '보상: 별 따라 은자 · 심법 구슬', `은자 ${r.gold} 구슬 ${r.heart}`);
    ok(g.S.surge.best === r.bossMs && g.S.surge.star === star && r.record === 1 && g.S.dungeons.best.surge, '최고 기록 · 소탕 열림');
    // 소탕(화면 없이) — 같은 엔진으로 끝까지 · 모두 소탕에 심법 구슬 합
    const sw = g.dailyDungeon('surge'); ok(sw && typeof sw.star === 'number' && sw.bossMs > 0, '소탕도 실제로 싸운다', JSON.stringify({ c: sw?.cleared, s: sw?.star, ms: sw?.bossMs }));
    const sa = g.sweepAll(); ok(!sa || sa.heart >= 0, '모두 소탕 합에 심법 구슬 칸');
    const b = Game.load(g.save(), g.now); ok(b.signed && b.S.surge.best === g.S.surge.best, '저장 → 불러오기'); }
  // 기세가 실제로 피해를 올린다 — 같은 씨앗 · 기세를 0으로 막으면 두목이 더 오래
  { const run = (noStack) => { const g = mk(9); g.enterDungeon('daily', 'surge'); if (noStack) { g.dg.sg.stack = 0; const st0 = g.sgStep.bind(g); g.sgStep = () => { const F = g.dg.F, k = F.kills; F.kills = 0; st0(); F.kills = k; }; } while (g.dg) g.huntDungeon(1000); return g.lastDg; };
    const a = run(false), z = run(true);
    ok(a.stack > 0 && z.stack === 0 && (z.cleared ? z.bossMs : 1e9) > a.bossMs, '기세 없이 두목은 더 오래(기세 효과)', `기세 ${a.stack}: ${a.bossMs}ms · 0단: ${z.cleared ? z.bossMs : '못 잡음'}`); }
  // 못 잡으면 실패 · 보상 없음 / 나가기
  { const g = mk(4); g.enterDungeon('daily', 'surge'); g.dg.F.dmgX = 0; const st0 = g.sgStep.bind(g); g.sgStep = () => { st0(); g.dg.F.dmgX = 1e-9; };
    const gold0 = g.S.wallet.gold; while (g.dg) g.huntDungeon(1000); const r = g.lastDg;
    ok(!r.cleared && r.ms >= D.timeMs && g.S.wallet.gold === gold0 && !r.heart && !g.S.dungeons.best?.surge, '60초 안에 못 잡으면 실패 · 보상 없음', `${r.ms}`);
    g.enterDungeon('daily', 'surge'); ok(g.leaveDungeon() && g.lastDg.gaveUp && !g.lastDg.cleared, '나가기'); }
  // 결정론
  { const run = () => { const g = mk(11); const r = g.dailyDungeon('surge'); return JSON.stringify([r.cleared, r.ms, r.bossMs, r.stack, r.star, r.gold, r.heart]); };
    ok(run() === run(), '결정론'); }
}

console.log('\n=== v613 두목 도감 — 첫 처치 때 · 드러난 수 ===');
{
  const BL = await import('../js/s2/tables/bosslore.js');
  ok(BL.BOSS_LORE.length === 16 && BL.BOSS_LORE.slice(1).every((t) => typeof t === 'string' && t.length >= 10 && t.length <= 60), '두목 한 줄 이야기 15');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 4), T0); g.addExp(EX.cumExp(18)); g.tick(T0); g.S.wallet['ticket:gear'] = 600; g.S.wallet.gold = 1e12; g.S.wallet['item:stone'] = 1e6;
  for (let i = 0; i < 60; i++) g.pullGear(10); GR.equipBest(g.S.gear, 18); for (const s of GE.SLOTS) for (let i = 0; i < 14; i++) g.enhance(s); g.dirtyStats = true;
  const d0 = g.dex(); ok(d0.found === d0.list.filter((x) => x.seen || x.beat).length && d0.list.every((x) => x.at === 0), '처음: 첫 처치 때 없음 · found = 만났거나 깬 수', d0.found);
  const T = g.stage(); T.idx = 10; T.top = 10; T.kills = STAGE_KILLS; g.challenge(); let t = T0 + 5000; while (g.bossFight) { t += 1000; g.tick(t); g.hunt(1000); }
  const at1 = g.S.chbAt?.[1], d1 = g.dex();
  ok(g.S.chb?.[1] && at1 > T0 && d1.list[0].at === at1 && d1.found >= 1, '1장 두목 첫 처치 → 그때(ms)를 적는다', at1 - T0);
  T.idx = 10; T.kills = STAGE_KILLS; g.challenge(); while (g.bossFight) { t += 1000; g.tick(t); g.hunt(1000); }
  ok(g.S.chb[1] === 2 && g.S.chbAt[1] === at1, '다시 깨도 첫 처치 때는 그대로');
  const old = new Game(newGame('sword', T0, 5), T0); old.S.chb = { 2: 1 }; delete old.S.chbAt;
  ok(old.dex().list[1].beat && old.dex().list[1].at === 0 && old.dex().found >= 1, '옛 저장(때 없음)도 읽힌다 — 0');
}

console.log('\n=== v632 자동 움직임(표적 값 · 붙들기 · 포기 시간 · 회피로 좁히기) ===');
{
  const SD = await import('../js/s2/battle/side.js'), { JOBS } = await import('../js/s2/tables/char.js');
  const room = (L, ms = 1060) => ({ lv: L, map: makeSideMap(ms), fams: { a: { mobs: [{ lv: L, kind: 'mob', w: 1 }], keep: 18, coolMs: 1000 } } });
  // 3분 자동 사냥을 재며 — 돌아섬 · 가던 길 뒤집기 · 포기 · 몹이 있는데 할 일 없이 섬(무공 쓰는 제자리 빼고) · 분당 처치
  const watch = (job, L, ms = 1060, seed = 7, min = 3) => {
    const F = new SideFight(room(L, ms), refPlayer(L, job), seed), H = F.hero, J = JOBS[job];
    let turns = 0, rev = 0, idle = 0, face = H.face, md0 = 0;
    for (let i = 0; i < min * 1200; i++) {
      const x0 = H.x, y0 = H.y; F.step();
      if (H.face !== face) { turns++; face = H.face; }
      const md = Math.sign(H.x - x0); if (md && md0 && md !== md0 && H.act !== 'hop') rev++; if (md) md0 = md;
      if (H.x === x0 && H.y === y0 && H.plat >= 0 && F.t >= (H.lockUntil || 0) && F.mobs.length && !F.mobs.some((m) => Math.abs(m.y - H.y) <= SD.SAME_Y && Math.abs(m.x - H.x) <= J.range)) idle++;
    }
    return { kpm: F.kills / min, turns: turns / min, rev: rev / min, give: (F.giveUps || 0) / min, idleS: (idle * 0.05) / min, hops: F.hops || 0, dashes: F.autoDashes || 0, dg: F.digest() };
  };
  const R = ['sword', 'spear', 'fist', 'bow', 'mage'].flatMap((job) => [1, 60, 150].map((L) => ({ job, L, ...watch(job, L) })));
  const avg = (k) => R.reduce((a, r) => a + r[k], 0) / R.length;
  console.log('    ' + R.map((r) => `${r.job}${r.L} ${r.kpm.toFixed(0)}/${r.turns.toFixed(0)}/${r.rev.toFixed(0)}`).join(' · '));
  // 예전(v631, 같은 재기 · 3맵 5분 평균): 돌아섬 24.6 · 뒤집기 20.8 · 포기 0.84 · 분당 처치 29.2
  ok(avg('turns') <= 18 && avg('rev') <= 15, '자동: 분당 돌아섬 18번 · 가던 길 뒤집기 15번 아래(다섯 직업 × Lv 1 · 60 · 150 평균, 예전 24.6 · 20.8)', `돌아섬 ${avg('turns').toFixed(1)} · 뒤집기 ${avg('rev').toFixed(1)}`);
  ok(avg('give') <= 0.2 && R.every((r) => r.give <= 0.7), '자동: 쫓다 포기는 거의 없다(분당 0.2 아래 · 예전 0.84 — 먼 표적은 닿을 만한 시간을 준다)', avg('give').toFixed(2));
  ok(R.every((r) => r.idleS <= 0.5), '자동: 몹이 있는데 할 일 없이 서 있는 시간 — 분당 0.5초 아래(무공 쓰는 제자리 빼고)', Math.max(...R.map((r) => r.idleS)).toFixed(2));
  ok(avg('kpm') >= 26 && avg('kpm') <= 32.5, '자동: 분당 처치 평균은 예전(29.2)에서 조금만 — 26~32.5', avg('kpm').toFixed(1));
  ok(R.filter((r) => r.job === 'bow' || r.job === 'mage').every((r) => r.hops > 0), '자동: 원거리는 붙으면 여전히 뒤로 뛴다(v628)', R.filter((r) => r.job === 'bow' || r.job === 'mage').map((r) => r.hops).join(','));
  ok(R.some((r) => r.dashes > 0), '자동: 같은 발판 먼 표적은 회피로 좁힌다(일반 사냥)', R.map((r) => r.dashes).join(','));
  ok(watch('sword', 60, 1030, 3, 1).dg === watch('sword', 60, 1030, 3, 1).dg && watch('bow', 60, 1030, 3, 1).dg === watch('bow', 60, 1030, 3, 1).dg, '자동 움직임도 같은 씨앗 = 같은 결과(근접 · 원거리)');
  // 지나치지 않기: 먼 몹을 쫓는 중에 같은 층 사거리 안에 몹이 들어오면 0.6초 안에 그 몹으로
  const F = new SideFight(room(60), refPlayer(60, 'sword'), 5); F.famState.a.keep = 0;
  F.mobs = []; F.spawn('a', { p: 0, x: F.hero.x + 15000 }); const far = F.mobs[0];
  F.run(1000);
  ok(F.hero.target === far.id && F.hero.chaseMax > 4000, '먼 표적(15m)은 포기 시간이 4초보다 길다', F.hero.chaseMax);
  F.spawn('a', { p: 0, x: F.hero.x + 900 }); const nearM = F.mobs[1]; nearM.x = F.hero.x + 900; F.run(600);
  ok(F.hero.target === nearM.id, '쫓는 길에 사거리 안으로 들어온 몹부터 친다');
  // 붙들기: 조금 더 가까운 몹이 생겨도(1.2초 넘게 낫지 않으면) 가던 표적 그대로
  const G = new SideFight(room(60), refPlayer(60, 'sword'), 5); G.famState.a.keep = 0;
  G.mobs = []; G.spawn('a', { p: 0, x: G.hero.x + 9000 }); const a1 = G.mobs[0]; a1.x = G.hero.x + 9000; G.run(300);
  G.spawn('a', { p: 0, x: G.hero.x + 7000 }); G.mobs[1].x = G.hero.x - 2500; const b1 = G.mobs[1]; ok(G.autoCost(b1) < G.autoCost(a1), "(붙들기 확인: 뒤 몹이 조금 더 싸다)"); G.run(1500);
  ok(G.hero.target === a1.id, '조금 더 가까운 몹이 뒤에 생겨도 가던 표적을 붙든다(뒤돌아 오가지 않게)');
  // 두목 · 던전에선 저절로 회피를 쓰지 않는다 · 수동도
  const B = new SideFight({ ...room(60), boss: true }, refPlayer(60, 'sword'), 5); B.famState.a.keep = 0; B.mobs = []; B.spawn('a', { p: 0, x: B.hero.x + 15000 }); B.run(4000);
  const M = new SideFight(room(60), refPlayer(60, 'sword'), 5, { auto: false }); M.run(4000);
  const N = new SideFight(room(60), refPlayer(60, 'sword'), 5); N.famState.a.keep = 0; N.mobs = []; N.spawn('a', { p: 0, x: N.hero.x + 15000 }); N.run(4000);
  ok(!B.events.some((e) => e[0] === 'dash') && !M.events.some((e) => e[0] === 'dash') && N.events.some((e) => e[0] === 'dash'), '두목전 · 수동에선 저절로 회피 안 씀(일반 사냥만)', `${B.autoDashes || 0} · ${M.autoDashes || 0} · ${N.autoDashes || 0}`);
}

console.log('\n=== v634 뜻대로 굴리기 · 전투력 미리보기 ===');
{
  const WI = await import('../js/s2/core/wish.js');
  const T0 = 1.8e12, mk = (seed = 41) => { const g = new Game(newGame('sword', T0, seed), T0); g.tick(T0); g.addExp(5e6); return g; };
  const g = mk(), W = g.S.wallet;
  ok(g.wishTarget('heart') === null && !g.wishList().length && g.wishRoll('heart', { g: 2 }, 10) === null, '경지 10 전에는 심법 줄이 없어 굴릴 수 없다');
  g.S.realm.lv = 30; W['item:heart'] = 40;
  ok(g.wishList().join() === 'heart' && g.wishTarget('heart').lines.length === 3, '경지 30 → 심법 3줄이 대상');
  const want = { keys: ['bossDmg'], g: 2, n: 1 }, r = g.wishRoll('heart', want, 30);
  ok(r.why === 'hit' && r.n >= 1 && r.spent === r.n && W['item:heart'] === 40 - r.spent && r.spent <= 30, '멈출 때까지 굴리기 — 맞으면 멈추고 쓴 만큼만 구슬이 빠진다', `${r.n}번`);
  ok(WI.wishMet(g.wishTarget('heart').lines, want) && r.now.some((l) => l.k === 'bossDmg' && l.g >= 2), '멈춘 줄에 바라는 스탯 · 등급이 있다');
  const g2 = mk(); g2.S.realm.lv = 30; g2.S.wallet['item:heart'] = 40; const r2 = g2.wishRoll('heart', want, 30);
  ok(JSON.stringify(r2) === JSON.stringify(r), '같은 씨앗 = 같은 굴림(결정적)');
  const before = JSON.stringify(g.S.realm.heart.lines);
  ok(g.wishUndo(r) && JSON.stringify(g.S.realm.heart.lines.map((l) => l && l.k)) === JSON.stringify(r.old.map((l) => l && l.k)) && !g.wishUndo(r), '되돌리기 — 이전 줄로 한 번만(구슬은 안 돌아옴)', before.length);
  // 한도: 나올 수 없는 바람 → 한도에서 멈춤
  W['item:heart'] = 40; const rb = g.wishRoll('heart', { keys: ['-'], g: 9, n: 1 }, 5);
  ok(rb.why === 'budget' && rb.n === 5 && rb.spent === 5 && W['item:heart'] === 35, '쓸 한도(구슬 5)에 닿으면 멈춤', rb.why);
  // 잠금: 잠근 줄 그대로 · 값은 ×2
  g.wishLock('heart', 0); const l0 = JSON.stringify(g.S.realm.heart.lines[0]), rl = g.wishRoll('heart', { keys: ['-'], g: 9, n: 1 }, 6);
  ok(rl.n === 3 && rl.spent === 6 && JSON.stringify(g.S.realm.heart.lines[0]) === l0, '잠근 줄은 그대로 · 잠금 1줄이면 한 번 구슬 2', `${rl.n}번 ${rl.spent}`);
  g.wishLock('heart', 1); g.wishLock('heart', 2);
  ok(g.wishRoll('heart', { keys: ['-'], g: 9, n: 1 }, 99).why === 'locked', '다 잠그면 굴리지 않는다');
  W['item:heart'] = 0; g.wishLock('heart', 2);
  ok(g.wishRoll('heart', { keys: ['-'], g: 9, n: 1 }, 99).why === 'short', '구슬이 없으면 멈춤(아무것도 안 빠짐)');
  ok(g.wishRoll('heart', { keys: [], g: 0, n: 1 }, 99).why === 'already', '이미 맞으면 굴리지 않는다');
  // 강호행 단계 줄
  const J = g.S.journey; J.opts.push([{ g: 0, k: 'hpP', v: 5 }, { g: 0, k: 'final3', v: 2 }]); J.step = 1; W['item:heart'] = 20;
  const rj = g.wishRoll('jour:0', { keys: ['final3'], g: 2, n: 1 }, 20);
  ok(rj && rj.spent <= 20 && (rj.why === 'hit' ? J.opts[0].some((l) => l.k === 'final3' && l.g >= 2) : rj.why === 'budget'), '강호행 단계 옵션 2줄도 같은 부품(구슬 1)', `${rj.why} ${rj.n}`);
  // 장비 부옵션
  const it = GR.makeGear(g.rng, 'ring', 4); while (it.subs.length < 3) it.subs.push({ k: 'crit', v: 5 }); g.S.gear.bag.push(it); W['item:stone'] = 1000;
  const SP = GS.SUB_POOL.find((p) => p.k === 'crit'), X = GS.SUB_TIER_X(GR.gearTier(it));
  ok(WI.subGrade(it, { k: 'crit', v: Math.round(SP.v[0] * X) }) === 0 && WI.subGrade(it, { k: 'crit', v: Math.round(SP.v[1] * X) }) === 3, '부옵션 등급 — 범위 맨 아래 일반 · 맨 위 전설');
  g.wishLock(`sub:${it.uid}`, 1); const k1 = JSON.stringify(it.subs[1]), rs = g.wishRoll(`sub:${it.uid}`, { keys: ['-'], g: 9, n: 1 }, 20);
  ok(rs.n === 2 && rs.spent === 5 + 8 && W['item:stone'] === 987 && it.rr === 2 && JSON.stringify(it.subs[1]) === k1, '부옵션 — 잠근 줄 그대로 · 강화석 5 → 8(바꾼 수만큼 ↑) · 한도 20에서 멈춤', `${rs.n} ${rs.spent}`);
  ok(g.wishUndo(rs) && JSON.stringify(it.subs) === JSON.stringify(rs.old.map((s) => ({ k: s.k, v: s.v }))), '부옵션 되돌리기');
  // 전투력 미리보기 — 복사본에만 · 실제로 해 본 것과 같은 값
  const s0 = JSON.stringify(g.S), free = g.statPts(), pv = g.powerIf((G) => G.statUp('atk', 10));
  ok(free > 0 && pv && pv.d > 0 && JSON.stringify(g.S) === s0, '미리보기는 이 게임을 바꾸지 않는다', `${pv?.p0} → ${pv?.p1}`);
  g.statUp('atk', 10); ok(Math.round(g.power()) === pv.p1, '미리본 값 = 실제로 찍은 뒤 전투력', `${pv.p1} · ${Math.round(g.power())}`);
  ok(g.powerIf(() => false) === null && g.powerIf(() => { throw new Error('x'); }) === null, '못 하는 일은 미리보기 없음');
  // 옛 세이브: 새 칸 없이도 읽힌다
  const old = mk(); old.S.realm.lv = 12; delete old.S.journey.wlk;
  ok(old.wishTarget('heart').lines.length === 1 && old.wishList().length === 1, '옛 세이브도 그대로(잠금 칸은 쓸 때 만든다)');
}

console.log('\n=== v635 문파 연공실 · 품앗이 · 겨루기 ===');
{
  const GDm = await import('../js/s2/online/guild.js'), ONm = await import('../js/s2/tables/online.js'), GU2 = ONm.GUILD;
  // 연공실 문서 — 막대 5번이면 연구 시작(3시간) · 연구 중 막대는 그다음 레벨 몫 · 끝나면 Lv +1
  const D = GDm.newResDoc(), t0 = 1.8e12;
  for (let i = 0; i < 4; i++) GDm.resDonate(D, 'gold', 'u1', '갑', t0);
  ok(!D.run && D.pts.gold === 4 && GDm.resDonate(D, 'gold', 'u2', '을', t0) && D.run?.k === 'gold' && D.run.endMs === t0 + GU2.research.waitH(1) * 3600e3 && D.pts.gold === 0, 'gd 연공실: 막대 5 → 연구 시작(3시간) · 막대 비움');
  for (let i = 0; i < 8; i++) GDm.resDonate(D, 'gold', 'u1', '갑', t0);
  ok(D.pts.gold === 8 && !GDm.resCan(D, 'gold') && !GDm.resDonate(D, 'gold', 'u1', '갑', t0) && GDm.resDonate(D, 'exp', 'u1', '갑', t0) && D.by.u1 === 13, 'gd 연공실: 연구 중엔 그다음 막대(8)까지만 · 다른 연구는 따로');
  GDm.resTick(D, t0 + 3 * 3600e3 - 1); const lv0 = D.lv.gold || 0; GDm.resTick(D, t0 + 3 * 3600e3);
  ok(lv0 === 0 && D.lv.gold === 1 && D.run?.k === 'gold' && D.run.endMs === t0 + 3 * 3600e3 + GU2.research.waitH(2) * 3600e3 && D.pts.gold === 0, 'gd 연공실: 대기 끝 → Lv 1 · 찬 막대는 바로 다음 연구(5시간)');
  const RS = GDm.resStats({ gold: 3, exp: 1, atk: 2, idle: 5 });
  ok(RS.st.goldP === 30 && RS.st.expP === 10 && RS.st.atkP === 10 && RS.idle === 50 && GDm.resStats({ gold: 99 }).st.goldP === 100, 'gd 연공실 값: 은자·경험치 Lv당 1% · 공격 0.5% · 방치 1% · Lv 10까지', JSON.stringify(RS));
  ok([0, 9].map(GDm.gresNeed).join() === '5,32' && GU2.research.waitH(10) === 21, 'gd 연공실 막대 5~32 · 대기 3~21시간');
  // 엔진 — 그 문파에 있을 때만 붙는다 · 저장에 남는다 · 옛 저장(칸 없음)도 된다
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 4), T0); g.addExp(EX.cumExp(40)); g.tick(T0);
  ok(g.gresSources().length === 0 && g.gresIdle() === 0 && g.gresPay() === null, 'gd 문파가 없으면 연구도 바치기도 없음');
  g.setGuild('ABC234'); const p0 = g.power(), gp0 = g.fighter().st.goldP || 0;
  ok(g.gresSet('ABC234', { gold: 3, exp: 1, atk: 2, idle: 5, bad: 9 }) && !g.gresSet('ABC234', { gold: 3, exp: 1, atk: 2, idle: 5 }), 'gd 연구 레벨 받기(같으면 안 바뀜)');
  g.dirtyStats = true; const p1 = g.power(), gp1 = g.fighter().st.goldP || 0;
  ok(p1 > p0 && p1 < p0 * 1.02 && gp1 - gp0 === 30 && g.gresIdle() === 50, 'gd 연구가 몸에 붙음(공격 +1% · 은자 +3%)', `${Math.round(p0)} → ${Math.round(p1)}`);
  g.setGuild('ZZZ999'); ok(g.gresSources().length === 0 && g.gresIdle() === 0, 'gd 다른 문파로 가면 안 붙음'); g.setGuild('ABC234');
  { const g2 = Game.load(g.save(), T0); ok(g2.gresIdle() === 50 && g2.gresSources()[0]?.stats.goldP === 30, 'gd 연구 레벨은 저장에 남는다'); }
  { const S = JSON.parse(JSON.stringify(g.S)); delete S.gres; delete S.ghelp; delete S.gwar; const g3 = new Game(S, T0); ok(g3.gresIdle() === 0 && g3.gresLeft() === 3 && g3.helpGiveLeft() === 10 && g3.gwarPts() >= 0, 'gd 옛 저장(칸 없음)도 그대로'); }
  // 방치 보상 +5%
  { const mk = (lvs) => { const x = new Game(newGame('sword', T0, 4), T0); x.addExp(EX.cumExp(40)); x.setGuild('ABC234'); x.gresSet('ABC234', lvs); x.tick(T0); return x.returnCheck(T0 + 2 * 3600e3); };
    const a = mk({}), b = mk({ idle: 5 }); ok(b.gres === 50 && b.exp === Math.round(a.exp * 1.05) && b.gold === Math.round(a.gold * 1.05), 'gd 좌공 비결 — 방치 보상 +5%', `${a.exp} → ${b.exp}`); }
  // 바치기 — 하루 3번 · 은자 사냥 10분 몫 · 되돌림 · 다음 날 새로
  g.S.wallet.gold = 1e9; const c = g.gresCost(), w0 = g.S.wallet.gold;
  const d1 = g.gresPay(); g.gresPay(); g.gresPay();
  ok(d1.gold === c && g.S.wallet.gold === w0 - 3 * c && g.gresLeft() === 0 && g.gresPay() === null && g.gwarSt().don === 3, 'gd 바치기 하루 3번 · 한 번 = 사냥 10분 몫 은자', String(c));
  g.gresRefund(d1); ok(g.gresLeft() === 1 && g.S.wallet.gold === w0 - 2 * c && g.gwarSt().don === 2, 'gd 서버가 안 받으면 되돌림');
  g.tick(T0 + 86400e3); ok(g.gresLeft() === 3, 'gd 다음 날 다시 3번');
  // 품앗이 — 원정 12시간 → 요청(하나만) → 문파원 도움(서버 셈) → 내 대기에 한 번만 · 최대 10번 몫
  const t1 = g.now; g.S.wallet['ticket:exped'] = 2; ok(g.startExped(12) && g.helpable().some((x) => x.k === 'exped'), 'gd 품앗이: 원정이 당길 수 있는 대기로 보임');
  const q = g.helpAsk('exped'), end0 = g.S.exped.run.endMs;
  ok(q && q.end0 === end0 && g.helpAsk('exped') === null && g.helpReq() === q, 'gd 품앗이: 요청은 한 번에 하나');
  const H = GDm.helpPrune({}, t1, 'd'); GDm.askHelp(H, q.id, 'me', { endMs: q.end0, end0: q.end0 });
  ok(GDm.giveHelp({ ...H, members: ['me', 'u1'] }, q.id, 'u1', t1, 'd') && GDm.helpCut(H.helps[q.id]) === Math.round(12 * 3600e3 * 0.01) && H.giveCount['u1:d'] === 1, 'gd 품앗이: 서버 셈 — 12시간의 1%(7분 12초)');
  const cut = GDm.helpCut(H.helps[q.id]);
  ok(g.helpSync(cut) === cut && g.S.exped.run.endMs === end0 - cut && g.helpSync(cut) === 0, 'gd 품앗이: 내 대기에 한 번만 넣음');
  const cap = GU2.help.maxHelps * Math.round(12 * 3600e3 * 0.01);
  ok(g.helpSync(1e12) === cap - cut && g.S.exped.run.endMs === end0 - cap, 'gd 품앗이: 한 요청 최대 10번 몫까지만', `${cap / 60000}분`);
  g.S.exped.run.endMs = g.now - 1; ok(g.helpReq() === null && g.ghelpSt().req === null, 'gd 품앗이: 대기가 끝나면 요청도 치움');
  ok(GDm.helpPrune(H, t1 + 13 * 3600e3, 'e') && !Object.keys(H.helps).length && !Object.keys(H.giveCount).length, 'gd 품앗이: 끝난 요청 · 지난 날 횟수는 서버 문서에서 치움');
  const gw0 = g.S.wallet.gold; let n = 0; while (g.helpGave()) n++;
  ok(n === 10 && g.S.wallet.gold > gw0 && g.helpGiveLeft() === 0 && g.gwarSt().help === 10, 'gd 품앗이: 하루 10번 도와줌 · 은자 조금', String((g.S.wallet.gold - gw0) / 10));
  // 겨루기 — 맞수는 문파 코드 · 주로 정해진다 · 지난주 마감 · 보상 한 번
  const R1 = GDm.rival('ABC234', '2026-11-16', 2), R2 = GDm.rival('ABC234', '2026-11-16', 2), R3 = GDm.rival('ABC234', '2026-11-23', 2);
  ok(R1.name === R2.name && R1.final === R2.final && R1.final >= 520 && R1.final < 1000 && (R3.name !== R1.name || R3.final !== R1.final), 'gd 겨루기: 맞수는 같은 문파·같은 주면 늘 같음(사람 둘 520~998)', `${R1.name} ${R1.final} / ${R3.name} ${R3.final}`);
  ok(GDm.rivalNow(R1, 0) === 0 && GDm.rivalNow(R1, 1) === R1.final && GDm.rivalNow(R1, 0.5) > R1.final / 2, 'gd 겨루기: 맞수 점수는 주 내내 오른다');
  const Wd = GDm.newWarDoc('2026-11-16'); Wd.n = 2; Wd.pts = { me: 900, u1: 400 };
  ok(!GDm.warRoll(Wd, '2026-11-16', 'ABC234') && GDm.warRoll(Wd, '2026-11-23', 'ABC234') && Wd.last.res === 'win' && Wd.last.us === 1300 && Wd.last.them === R1.final && Wd.rec.w === 1 && Wd.rec.pts === 3 && Wd.week === '2026-11-23' && !Object.keys(Wd.pts).length, 'gd 겨루기: 주가 바뀌면 지난주 마감 · 이기면 승점 3');
  GDm.warRoll(Wd, '2026-11-30', 'ABC234'); ok(Wd.last.week === '2026-11-16' && Wd.rec.w + Wd.rec.d + Wd.rec.l === 1, 'gd 겨루기: 아무도 점수를 안 낸 주는 판이 없음');
  const tx0 = g.S.wallet['ticket:gear'] || 0, cl = g.gwarClaim(Wd.last, 'me');
  ok(cl?.tix === 4 && g.S.wallet['ticket:gear'] === tx0 + 4 && g.gwarClaim(Wd.last, 'me') === null && g.gwarClaim({ ...Wd.last, week: 'x', pts: {} }, 'me') === null, 'gd 겨루기 보상: 이기면 뽑기권 4 · 한 번 · 점수 안 낸 사람은 없음');
  ok(g.gwarClaim({ week: 'y', res: 'lose', pts: { me: 5 } }, 'me')?.tix === 2, 'gd 겨루기 보상: 져도 낸 사람은 뽑기권 2');
  const W2 = g.gwarSt(); ok(g.gwarPts() === g.gtrainPts() * 10 + g.graidState().used * 20 + W2.help * 5 + W2.don * 5 && g.gwarPts() >= 60, 'gd 겨루기 내 점수 = 수련×10 + 토벌×20 + 돕기×5 + 바치기×5', g.gwarPts());
  g.tick(T0 + 8 * 86400e3); ok(g.gwarSt().help === 0 && g.gwarSt().don === 0 && g.gwarSt().got === 'y', 'gd 겨루기: 다음 주 내 몫 새로(받은 표시는 남음)');
}

console.log('\n=== v643 서열 점검 상한 — 꽉 채운 무인도 걸리지 않게 ===');
{
  const ON2 = await import('../js/s2/tables/online.js'), PW = await import('../js/s2/online/power.js'), { play: botPlay } = await import('../tools/s2sim/play.mjs');
  // 하루 6시간 · 광고(꽉 채운 쪽) 3일 — 표준 대비가 가장 높은 때(Lv 48 · ×3.5) · 손으로 하는 성장(스탯 · 내공 · 갈래 · 공명)까지 · 운 몫 ×1.5를 얹어도 상한 아래
  const { g: bg } = botPlay({ days: 3, job: 'fist', seed: 1, active: 360, ad: true, marks: [] });
  bg.statAuto(); bg.stat2Auto(); bg.collAuto('relic', true); bg.dirtyStats = true;
  const r = bg.power() / PW.stdPower(bg.S.hero.lv);
  ok(r * 1.5 < ON2.RANK_POWER_SLACK && RK.checkProfile({ lv: bg.S.hero.lv, power: Math.round(bg.power()) }).length === 0, `꽉 채운 권사 3일 — 표준의 ×${r.toFixed(2)} · 운 몫 ×1.5를 얹어도 서열 점검 상한(×${ON2.RANK_POWER_SLACK}) 아래`);
}
console.log('\n=== v642 전직 갈래 ===');
{
  const SK = await import('../js/s2/tables/skills.js');
  ok(['sword', 'spear', 'fist', 'bow', 'mage'].every((j) => SK.JOB_PATH[j].length === 2 && new Set(SK.JOB_PATH[j].map((p) => p.id)).size === 2 && SK.JOB_PATH[j].every((p) => p.name && Object.keys(p.stats).length >= 2)) && SK.PATH_ADV === 3, '직업마다 갈래 둘 · 3차 전직부터');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 13), T0); g.tick(T0); g.S.hero.lv = 85; g.S.hero.adv = 2; g.dirtyStats = true;
  ok(!g.pathState().open && g.pathPick('swift') === null && !g.hero.sources().some((x) => /^갈래/.test(x.src)), '2차까지는 못 고른다');
  g.S.hero.adv = 3; g.dirtyStats = true; const P0 = g.pathState(), pw0 = g.power(), gold0 = (g.S.wallet.gold = 1e9);
  ok(P0.open && !P0.cur && P0.cost === 0 && P0.list.length === 2, '3차 — 열림 · 아직 안 고름 · 처음은 공짜');
  const r1 = g.pathPick('swift');
  ok(r1 && r1.cost === 0 && g.S.wallet.gold === gold0 && g.pathState().cur === 'swift' && g.hero.sources().some((x) => x.src === '갈래 · 쾌검' && x.stats.baseP === 150) && g.power() > pw0, '고르면 출처 「갈래 · 쾌검」 · 전투력 오름', `${pw0} → ${g.power()}`);
  ok(g.pathPick('swift') === null && g.pathPick('nope') === null && g.pathPick('rapid') === null, '같은 갈래 · 없는 갈래 · 남의 직업 갈래는 안 됨');
  const c = g.pathState().cost; ok(c > 0, '바꾸기는 은자', c);
  g.S.wallet.gold = c - 1; ok(g.pathPick('heavy') === null && g.pathState().cur === 'swift', '은자가 모자라면 못 바꾼다');
  g.S.wallet.gold = c; const r2 = g.pathPick('heavy');
  ok(r2 && r2.cost === c && g.S.wallet.gold === 0 && g.pathState().cur === 'heavy' && g.hero.sources().filter((x) => /^갈래/.test(x.src)).length === 1, '바꾸면 은자가 빠지고 갈래는 하나만');
  const g2 = new Game(newGame('mage', T0, 14), T0); g2.tick(T0); g2.S.hero.lv = 85; g2.S.hero.adv = 3; g2.dirtyStats = true; g2.autoGrow();
  ok(g2.pathState().cur === 'frost', '자동 성장 — 안 골랐으면 둘째를 고른다(공짜)');
  g2.S.hero.path = 'zzz'; g2.dirtyStats = true; ok(g2.pathState().cur === null && Number.isFinite(g2.power()), '모르는 값은 안 고른 것으로');
}
console.log('\n=== v641 지킬 옵션 · 칠파 회전 ===');
{
  const GR2 = await import('../js/s2/gear/gear.js'), GD2 = await import('../js/s2/online/guild.js');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 11), T0); g.tick(T0);
  const G = g.S.gear; let u = 8e6; const mk = (subs, gr = 0) => ({ uid: ++u, slot: 'ring', g: gr, up: 0, subs, rr: 0, lock: false });
  g.obtain([mk([{ k: 'atkL1', v: 20 }], 3)]);
  ok(G.eq.ring && !G.keepSub, '처음엔 지킬 옵션 없음');
  G.bag.push(mk([{ k: 'goldP', v: 20 }]), mk([{ k: 'hpP', v: 10 }]));
  ok(g.gearJunk(6).length === 2, '낀 것보다 약한 둘은 일괄 분해 대상');
  ok(g.gearKeepSub('goldP') === true && g.gearKeepSub('nope') === null && G.keepSub.join() === 'goldP', '지킬 옵션 켜기 · 없는 옵션은 안 됨');
  ok(g.gearJunk(6).length === 1 && g.gearJunk(6)[0].subs[0].k === 'hpP', '지킬 옵션이 붙은 것은 일괄 분해에서 빠진다');
  G.autoDis = 3; g.obtain([mk([{ k: 'goldP', v: 11 }]), mk([{ k: 'defP', v: 11 }])]);
  ok(G.bag.filter((x) => x.subs.some((s2) => s2.k === 'goldP')).length === 2 && !G.bag.some((x) => x.subs.some((s2) => s2.k === 'defP' || s2.k === 'hpP')), '자동 분해 — 지킬 옵션은 남고 나머지는 분해');
  ok(g.gearKeepSub('goldP') === false && G.keepSub.length === 0 && g.gearJunk(6).length === 2, '끄면 다시 분해 대상');
  // 칠파 회전
  const F = GD2.leagueFoes('K7Q2MX', '2026-W47', 3), F2 = GD2.leagueFoes('K7Q2MX', '2026-W47', 3);
  ok(F.length === 6 && new Set(F.map((x) => x.name)).size === 6 && JSON.stringify(F) === JSON.stringify(F2) && F[0].name === GD2.rival('K7Q2MX', '2026-W47', 3).name && F[0].final === GD2.rival('K7Q2MX', '2026-W47', 3).final, '여섯 문파 — 이름이 다 다르고 · 같은 문파 · 같은 주면 같은 값 · 첫째는 겨루기 맞수');
  ok(JSON.stringify(GD2.leagueFoes('K7Q2MX', '2026-W48', 3)) !== JSON.stringify(F), '주가 바뀌면 조가 바뀐다');
  const top = GD2.leagueTable('K7Q2MX', '2026-W47', 3, 1e9), bot = GD2.leagueTable('K7Q2MX', '2026-W47', 3, 0), mid = GD2.leagueTable('K7Q2MX', '2026-W47', 3, 0, 0);
  ok(top.rank === 1 && bot.rank === 7 && top.rows.length === 7 && mid.rank === 1 && mid.rows.every((r) => r.pts === 0), '순위 1~7 · 주 처음엔 모두 0(같으면 우리가 앞)');
  ok(GD2.GLEAGUE.rew.length === 7 && GD2.GLEAGUE.rew.every((r, i, a) => !i || (r.tix <= a[i - 1].tix && r.merit < a[i - 1].merit)), '보상은 순위대로 내려간다');
  const W = GD2.newWarDoc('2026-W47'); W.n = 3; W.pts = { me: 500, x: 900 }; GD2.warRoll(W, '2026-W48', 'K7Q2MX');
  ok(W.last && W.last.n === 3 && W.last.us === 1400, '주 마감 기록에 문파원 수(n)');
  g.S.guildId = 'K7Q2MX'; const t0 = g.S.wallet['ticket:gear'] || 0, m0 = g.S.wallet['coin:merit'] || 0, rk = GD2.leagueTable('K7Q2MX', W.last.week, 3, 1400).rank, z = g.gleagueClaim(W.last, 'me');
  ok(z && z.rank === rk && (g.S.wallet['ticket:gear'] || 0) === t0 + GD2.GLEAGUE.rew[rk - 1].tix && (g.S.wallet['coin:merit'] || 0) > m0, '지난주 순위 보상 — 뽑기권 · 공적', JSON.stringify(z));
  ok(g.gleagueClaim(W.last, 'me') === null && g.gleagueClaim(W.last, 'nobody') === null, '한 번만 · 점수를 안 낸 사람은 없음');
  g.S.gwar.lgot = ''; g.S.guildId = null; ok(g.gleagueClaim(W.last, 'me') === null, '문파가 없으면 없음');
}
console.log('\n=== v640 병법 상극 · 실제 적용값 ===');
{
  const ON = await import('../js/s2/tables/online.js'), PV2 = await import('../js/s2/online/pvp.js'), CH = await import('../js/s2/tables/char.js'), TR = await import('../js/s2/tables/traits.js');
  const jobs = ['sword', 'spear', 'fist', 'bow', 'mage'];
  ok(jobs.every((j) => jobs.includes(ON.PVP_COUNTER[j]) && ON.PVP_COUNTER[j] !== j) && new Set(jobs.map((j) => ON.PVP_COUNTER[j])).size === 5, '상극 고리 — 다섯 직업이 하나씩 누르고 하나씩 눌린다');
  ok(ON.pvpEdge('sword', 'spear') === 1 && ON.pvpEdge('spear', 'sword') === -1 && ON.pvpEdge('sword', 'sword') === 0 && ON.pvpEdge('sword', 'fist') === 0, '유리 1 · 불리 −1 · 그 밖 0');
  const A = refPlayer(100), mk = (j) => ({ ...A, job: j }), W = (a, d) => { let w = 0; for (let s = 1; s <= 200; s++) w += PV2.duel(mk(a), mk(d), s).win ? 1 : 0; return w; };
  const even = W('sword', 'sword'), up = W('sword', 'spear'), dn = W('spear', 'sword'), none = W('sword', 'fist');
  ok(up > even + 10 && dn < up - 15, `같은 힘이면 누르는 쪽이 더 이긴다(200판)`, `같은 직업 ${even} · 유리 ${up} · 불리 ${dn} · 무관 ${none}`);
  // v643 직업 5×5 — 같은 레벨 표준 무인끼리: 상극 없는 짝은 반쯤(평타 간격이 직업 없이 같다) · 누르는 짝은 55~72%
  { const { refPlayer: RP } = await import('../js/s2/battle/ref.js'), M = {}, bad = [];
    for (const L of [40, 100]) for (const a of jobs) for (const d of jobs) { let w = 0; for (let s = 1; s <= 100; s++) w += PV2.duel(RP(L, a), RP(L, d), s).win ? 1 : 0; const e = ON.pvpEdge(a, d); M[`${L}${a}>${d}`] = w; if (e > 0 ? w < 55 || w > 72 : e < 0 ? w > 55 : w < 38 || w > 62) bad.push(`Lv${L} ${a}→${d} ${w}%`); }
    ok(bad.length === 0, '직업 5×5 대결 — 상극 없는 짝 38~62% · 누르는 짝 55~72% · 눌리는 짝 55% 아래', bad.join(' · ') || `Lv40 검→창 ${M['40sword>spear']}% · 창→검 ${M['40spear>sword']}% · 검→권 ${M['40sword>fist']}%`); }
  { const PW = await import('../js/s2/online/power.js'); ok(new Set(jobs.map((j) => PW.stdPower(70, 'pvp', j))).size === 1, '같은 레벨 표준 무인의 대결 전투력은 직업 없이 같다(평타 간격 맞춤)'); }
  const strong = { ...mk('spear'), st: { ...A.st, atk: A.st.atk * 2, hp: A.st.hp * 2 } }; let sw = 0; for (let s = 1; s <= 40; s++) sw += PV2.duel(strong, mk('sword'), s).win ? 1 : 0;
  ok(sw >= 38, '상극은 작다 — 두 배 센 쪽은 불리해도 이긴다', sw);
  const l1 = [], l2 = []; PV2.duel(mk('sword'), mk('spear'), 5, l1); PV2.duel(mk('sword'), mk('spear'), 5, l2);
  ok(JSON.stringify(l1) === JSON.stringify(l2) && l1.length > 0, '상극이 있어도 결정론');
  // 실제 적용값
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 9), T0); g.tick(T0); g.S.hero.lv = 40; g.statAuto(); g.dirtyStats = true;
  const R = Object.fromEntries(g.statReal().map((r) => [r.k, r])), st = g.fighter(false).st;
  ok(g.statReal().length === 7 && R.crit.real === Math.min(1000, CH.BASE_CRIT + (st.crit || 0)) && R.crit.real > R.crit.shown, '치명 확률 — 기본 5%를 더한 값', `${R.crit.shown} → ${R.crit.real}`);
  ok(R.critDmg.real === 1000 + CH.BASE_CRIT_DMG + (st.critDmg || 0) && R.critDmg.mul, '치명 한 대 = ×(1 + 기본 50% + 표기)');
  const k = CH.defK(40); ok(R.def.real === Math.round(1000 * st.def / (k + st.def)) && R.def.real > 0 && R.def.real < 1000, '방어 → 받는 피해 감소(같은 레벨)', `${st.def} → ${R.def.real / 10}%`);
  const fin = ['final1', 'final2', 'final3', 'final4', 'final5'].reduce((a, n) => a * (1000 + (st[n] || 0)) / 1000, 1);
  ok(R.final.real === Math.round(fin * 1000), '최종 피해 합은 곱');
  ok(!R.cdr.capped && !R.killHeal.capped && R.cdr.cap === TR.CDR_CAP && R.killHeal.cap === TR.KILL_HEAL_CAP && R.takenDownP.cap === CH.TAKEN_DOWN_CAP, '상한 값 — 쿨 30% · 처치 회복 10% · 받는 피해 감소 70%');
  g.S.hero.sp2 = { cdr: 8 }; const C = g.S.colls.relic; for (const kk of [2, 13, 23]) C.own[kk] = { lv: 30, awk: 5, n: 0 }; g.collAuto('relic', true); g.dirtyStats = true;
  const g3 = g.statReal().find((r) => r.k === 'cdr'); ok(g3.shown > 0 && g3.real === Math.min(TR.CDR_CAP, g3.shown), '쿨 감소 표기 → 실제(상한까지)', `${g3.shown} → ${g3.real}`);
}
console.log('\n=== v639 영물 공명 · 내공 단계 ===');
{
  const TR = await import('../js/s2/tables/traits.js'), CL2 = await import('../js/s2/grow/collect.js'), HH = await import('../js/s2/hero/hero.js');
  const all = TR.RESO.flatMap((R) => R.ks);
  ok(new Set(all).size === 30 && all.length === 30 && TR.RESO.every((R) => R.ks.length >= TR.RESO_NEED && Object.keys(R.stats).every((k) => TR.RESO_W[k] > 0)), '공명 무리 아홉 — 영물 30종이 하나씩 · 무리마다 셋 이상 · 값마다 무게');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 7), T0); g.tick(T0);
  const C = g.S.colls.relic, own = (ks) => { for (const k of ks) C.own[k] = { lv: 1, awk: 0, n: 0 }; };
  ok(g.resoState().on.length === 0 && CL2.resoSources(C).length === 0, '처음엔 공명 없음');
  own([21, 22, 29]); g.collAuto('relic', true);
  ok(g.resoState().on.join() === 'tteul' && C.eq.slice().sort((a, b) => a - b).join() === '21,22,29' && g.sources().some((x) => x.src === '영물 공명' && x.stats.mobDmg === 40), '같은 무리 셋을 끼면 공명 — 몹 피해 +4%');
  const pw1 = g.power(); g.collEquip('relic', 0, null);
  ok(g.resoState().on.length === 0 && g.power() < pw1, '하나 빼면 꺼진다 · 전투력이 내려간다');
  g.collAuto('relic', true);
  // 추천 자동 — 조금 센 하나 때문에 공명을 깨지 않는다 · 훨씬 센 셋이면 공명을 버린다
  own([20]); g.collAuto('relic', true);
  ok(g.resoState().on.join() === 'tteul', '추천 자동: 같은 등급 하나가 더 있어도 공명을 지킨다', JSON.stringify(C.eq));
  own([0, 1, 3]); g.collAuto('relic', true);
  ok(g.resoState().on.length === 0 && C.eq.slice().sort((a, b) => a - b).join() === '0,1,3', '추천 자동: 훨씬 센 셋(보 · 보 · 진)이면 공명보다 그쪽', JSON.stringify(C.eq));
  ok(g.resoEquip('tteul') && g.resoState().on.join() === 'tteul' && CL2.isManual(C), '「이 무리로 끼기」 → 공명 · 직접 고름');
  ok(!g.resoEquip('samryeong') && !g.resoEquip('nope'), '셋이 안 되는 무리 · 없는 무리는 못 낀다');
  own([4, 5, 6]); ok(g.resoEquip('sasin') && g.resoState().on.join() === 'sasin' && C.eq.length === 3, '넷짜리 무리는 그중 센 셋');
  // 내공 단계
  const g2 = new Game(newGame('sword', T0, 8), T0); g2.tick(T0);
  ok(g2.stat2Pts() === 0 && g2.hero.sp2Total() === 0 && g2.stat2Up('bossDmg') === 0, '처음엔 0단 · 특수점 없음');
  g2.S.hero.lv = 36; g2.statAuto();
  ok(g2.hero.spUsed() === 35 && g2.hero.sp2Total() === 3 && g2.stat2Pts() === 3, `스탯 ${HH.SP2_EVERY}점마다 1단 — 35점 → 3단 · 특수점 3`);
  const p0 = g2.power();
  ok(g2.stat2Up('bossDmg') === 1 && g2.stat2Up('nope') === 0 && g2.stat2Pts() === 2 && g2.hero.sources().some((x) => x.src === '내공 단계' && x.stats.bossDmg === HH.SP2_EACH.bossDmg), '특수점 찍기 → 출처 「내공 단계」');
  ok(g2.stat2Auto() === 2 && g2.stat2Pts() === 0 && g2.hero.sp2State().critDmg === 1 && g2.hero.sp2State().skillP === 1 && g2.stat2Up('critDmg') === 0, '고르게 — 두목 피해 · 치명 피해 · 무공 피해에 · 남은 점이 없으면 못 찍는다');
  ok(g2.power() > p0, '전투력이 오른다', `${p0} → ${g2.power()}`);
  g2.S.hero.sp2.cdr = 99; ok(g2.hero.sp2State().cdr === HH.SP2_CAP, `스탯마다 ${HH.SP2_CAP}점까지`); g2.S.hero.sp2.cdr = 0;
  g2.statReset();
  ok(g2.hero.sp2Used() === 0 && g2.hero.sp2Total() === 0 && g2.stat2Pts() === 0 && !g2.hero.sources().some((x) => x.src === '내공 단계'), '스탯을 되돌리면 특수점도 함께');
  const r = g2.autoGrow(); ok(g2.statPts() === 0 && g2.stat2Pts() === 0 && g2.hero.sp2Used() === 3, '자동 성장이 스탯과 특수점을 찍는다', JSON.stringify(r));
  // 옛 저장(sp2 없음)
  delete g2.S.hero.sp2; ok(g2.hero.sp2Used() === 0 && g2.stat2Pts() === 3 && Number.isFinite(g2.power()), '옛 저장(sp2 없음)도 그대로');
}
console.log('\n=== v636 요괴록(몹 도감) ===');
{
  const MB = await import('../js/s2/tables/mobs.js'), TT = await import('../js/s2/tables/titles.js');
  ok(MB.ROSTER.length === 15 && MB.MX.slots === 6 && MB.MX.steps.mob.join() === '100,1000,10000' && MB.MX.steps.elite.join() === '10,100,1000' && MB.MX.steps.boss.join() === '10,100,1000', '장 15 × 칸 여섯(일반 넷 · 정예 · 칸 두목) · 별 셋(일반 100/1,000/10,000 · 정예 · 두목 10/100/1,000)');
  // 칸 번호는 그림(mobLook)과 같은 셈
  let same = true; for (let ch = 1; ch <= 15; ch++) for (let id = 1; id <= 12; id++) for (const kind of ['mob', 'elite', 'boss']) if (MB.mxEntry(ch, MB.mxSlot(ch, kind, id))[0] !== MB.mobLook(ch, { id, kind })[0]) same = false;
  ok(same, '칸 번호 → 이름이 사냥터 몹 그림 이름과 같다');
  ok(TT.TITLES.filter((t) => /^mx\d+$/.test(t.id)).length === 15 && TT.titleByName(MB.mxTitle(3))?.id === 'mx3', '장마다 요괴록 칭호(15)');
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 41), T0); g.tick(T0);
  ok(g.mxCan() === 0 && g.mxGotStars() === 0 && g.mxSources().length === 0 && g.mxList().filter((c) => c.seen).length === 1, '처음엔 별 없음 · 1장만 보인다');
  // 사냥터에서 잡으면 센다(그 장 칸)
  const k0 = g.S.kills; let now = T0; for (let i = 0; i < 120; i++) { now += 1000; g.tick(now); g.hunt(1000); }
  const sum = Object.values(g.mxSt().k).reduce((a, b) => a + b, 0), ks = Object.keys(g.mxSt().k).map(Number);
  ok(sum > 0 && sum === g.S.kills - k0 && ks.every((id) => id >= 10 && id % 10 < 6 && Math.floor(id / 10) <= Math.ceil(g.stage().top / 10)), '사냥터 처치 = 요괴록 처치 수 합 · 간 장의 칸으로', `${sum} · ${g.S.kills - k0} · ${ks}`);
  // 별 닿음 → 받기 → 효과
  const X = g.mxSt(); for (const id of Object.keys(X.k)) delete X.k[id];
  X.k[10] = 99; X.k[11] = 1000; X.k[14] = 10; X.k[35] = 1000;
  ok(g.mxCan() === 2 + 1 + 3 && g.mxClaim(10) === null, '닿은 별 수만큼 받을 수 있다(99마리는 아직)', g.mxCan());
  const W0 = JSON.stringify(g.S.wallet), p0 = g.fighter().st.mobDmg || 0, r = g.mxClaim(11);
  ok(r && r.add === 2 && r.star === 2 && !r.title && g.mxClaim(11) === null && JSON.stringify(g.S.wallet) === W0, '칸 하나 — 닿은 별 모두 새김(지갑은 그대로) · 두 번은 없음');
  ok((g.fighter().st.mobDmg || 0) - p0 === 2 * MB.MX.each.mobDmg && g.mxSources()[0].stats.goldP === 2, '새긴 별마다 일반 몹 피해 · 은자 +0.1%');
  ok(g.mxClaimAll().length === 2 && g.mxGotStars() === 2 + 1 + 3 && g.mxCan() === 0, '모두 받기');
  // 한 장 여섯 칸 ★3 → 칭호
  for (let s = 0; s < 6; s++) X.k[20 + s] = s < 4 ? 10000 : 1000;
  const t0 = (g.S.titles || []).length, rs = g.mxClaimAll(), tt = rs.find((x) => x.title);
  ok(tt && tt.title === '2장 요괴록' && g.S.titles.length === t0 + 1 && g.titleSources()[0].stats.atkP === 10 * g.S.titles.length && g.mxList()[1].full, '2장 여섯 칸 ★3 → 「2장 요괴록」 칭호(칭호 수집 효과도)');
  // 장 두목 무대 · 토벌은 세지 않는다
  ok(g.mxHunt({ def: { lv: 10, chb: 1 } }) === null && g.mxHunt({ def: { lv: 10, boss: true, raid: 1 } }) === null && g.mxHunt({ def: { lv: 15, boss: true } })?.ch === 2, '장 두목 · 토벌은 빼고 칸 두목전은 센다');
  // 저장 · 옛 세이브
  const g2 = Game.load(g.save(), now); ok(g2.mxGotStars() === g.mxGotStars() && g2.mxSt().k[11] === 1000, '처치 수 · 새긴 별은 저장된다');
  const o = new Game(newGame('sword', T0, 42), T0); delete o.S.mx; ok(o.mxCan() === 0 && o.mxList().length === 15 && o.S.mx && !o.mxSources().length, '옛 세이브(칸 없음)도 그대로');
  // 자동 성장이 받는다
  o.mxSt().k[12] = 150; o.mxSt().k[15] = 12;
  const out = o.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
  ok(o.mxCan() === 0 && o.mxGotStars() === 2 && out.claim >= 2, '자동 성장이 요괴록 별을 받는다', out.claim);
  // 균형 — 별 270개 전부 = 일반 몹 피해 · 은자 +27%(별 하나 0.1%)
  ok(15 * 6 * 3 * MB.MX.each.mobDmg === 270 && MB.MX.each.goldP === 1, '모두 모아도 일반 몹 피해 · 은자 +27%(별 하나 0.1%)');
}

console.log('\n=== v616 무한 탑 이정표 상자 ===');
{
  const CT = await import('../js/s2/tables/content.js');
  const r10 = CT.towerMsReward(10), r50 = CT.towerMsReward(50);
  ok(r10['ticket:gear'] === 3 && r10['item:stone'] === 20 && !r10['ticket:pal'] && r50['item:stone'] === 60 && r50['ticket:weapon'] === 1 && r50['ticket:pal'] === 1 && r50['ticket:relic'] === 1, '10층마다 뽑기권 3 · 강화석 층+10 · 50층마다 병기 · 동료 · 영물 뽑기권 1씩', JSON.stringify([r10, r50]));
  ok(CT.towerMsReward(15) === null && CT.towerMsReward(0) === null && CT.towerMsReward(310) === null && CT.towerMsFloors().length === 30, '10의 배수 · 300층까지만(이정표 30)');
  const tot = CT.towerMsFloors().filter((f) => f <= 70).reduce((a, f) => a + CT.towerMsReward(f)['item:stone'], 0);
  ok(tot <= 360, '70층까지 상자 강화석 합은 작다(단련동 사흘치 360 안)', tot);
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 31), T0); g.tick(T0);
  ok(g.towerMsCan() === 0 && g.towerMsClaim(10) === null && g.towerMsState().every((m) => m.state === 'lock'), '처음엔 받을 상자 없음');
  g.S.tower.best = 24; const W = g.S.wallet, t0 = W['ticket:gear'] || 0, s0 = W['item:stone'] || 0;
  ok(g.towerMsCan() === 2 && g.towerMsClaim(30) === null && g.towerMsClaim(15) === null, '깬 층까지만 · 10의 배수만');
  const c = g.towerMsClaim(10);
  ok(c && c.floor === 10 && W['ticket:gear'] - t0 === 3 && W['item:stone'] - s0 === 20, '10층 상자 → 뽑기권 3 · 강화석 20', JSON.stringify(c));
  ok(g.towerMsClaim(10) === null && W['ticket:gear'] - t0 === 3 && g.towerMsCan() === 1, '한 번만');
  ok(g.towerMsState().find((m) => m.floor === 10).state === 'got' && g.towerMsState().find((m) => m.floor === 20).state === 'can' && g.towerMsState().find((m) => m.floor === 30).state === 'lock', '상태: 받음 · 받기 · 잠김');
  const g2 = Game.load(g.save(), T0); ok(g2.S.tower.ms.join() === '10' && g2.towerMsCan() === 1, '받은 층은 저장된다');
  // 자동 성장이 받는다
  const a = new Game(newGame('sword', T0, 32), T0); a.tick(T0); a.S.tower.best = 55;
  const o = a.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
  ok(a.S.tower.ms.slice().sort((x, y) => x - y).join() === '10,20,30,40,50' && a.towerMsCan() === 0 && o.claim >= 5, '자동 성장이 받을 상자를 모두 받는다', `${a.S.tower.ms} · claim ${o.claim}`);
  ok((a.S.wallet['ticket:pal'] || 0) >= 1 && (a.S.wallet['ticket:relic'] || 0) >= 1, '50층 상자 — 동료 · 영물 뽑기권(뽑기를 끄면 남아 있다)');
  const a2 = a.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false }); ok(a.S.tower.ms.length === 5, '다시 돌려도 두 번 받지 않는다', a2.claim);
  // 옛 세이브 — tower에 ms가 없다 · tower 자체가 없다
  const old = new Game(newGame('sword', T0, 33), T0); old.S.tower = { best: 32 }; const o2 = Game.load(old.save(), T0);
  ok(o2.towerMsCan() === 3 && Array.isArray(o2.S.tower.ms) && o2.towerMsClaim(30) && o2.S.tower.best === 32, '옛 세이브(이정표 칸 없음): 이미 깬 층의 상자도 받을 수 있다');
  const old2 = new Game(newGame('sword', T0, 34), T0); delete old2.S.tower; ok(old2.towerMsCan() === 0 && old2.towerSt().best === 0, '탑 칸이 아예 없어도 생긴다');
  // 실제 싸움: 10층을 깨면 결과에 상자 표시(받기 전)
  const f = new Game(newGame('sword', T0, 35), T0); f.addExp(EX.cumExp(60)); f.tick(T0); f.S.tower.best = 9; const fo = f.fighter.bind(f); f.fighter = () => { const x = fo(); x.st = { ...x.st, atk: x.st.atk * 1000 }; return x; };
  const fr = f.towerFight();
  ok(fr.cleared && (fr.chest === 10 && f.S.tower.best === 10 && f.towerMsCan() === 1), '10층을 깨면 결과에 chest: 10 · 받을 상자 하나', JSON.stringify({ c: fr.cleared, chest: fr.chest }));
  const fr2 = f.towerFight(); ok(fr2.cleared && !fr2.chest && f.S.tower.best === 11, '11층은 상자 없음');
}

console.log('\n=== v628 원거리(궁사 · 술사) — 뒤로 뛰기 · 화살 밀어내기 · 기탄 느려짐 · 물러나기 ===');
{
  const R = CH.RANGED, mr0 = R.minRange;
  const off = (fn) => { R.minRange = Infinity; try { return fn(); } finally { R.minRange = mr0; } };   // 끔 = 예전 엔진 그대로
  // 자동 사냥 3분 — 표적 거리 · 뛰기(발판 안에서만) · 몹은 늘 발판 안(밀려도) · 밀림 · 느려짐
  const hunt3 = (job, L, seed) => {
    const F = new SideFight(sideRoom(L, seed, { n: 18, coolMs: 1000 }), refPlayer(L, job), seed * 13 + 5), map = F.def.map;
    const s = { n: 0, sum: 0, in24: 0, lt15: 0, hops: 0, badHop: 0, badMob: 0, kb: 0, slow: 0 };
    while (F.t < 180000) {
      const H = F.hero, p0 = H.plat;
      F.step();
      for (const e of F.events) if (e[0] === 'hop') { s.hops++; const p = map.plats[H.plat], land = H.hopX0 + H.hopDir * H.hopLen; const eg = Math.min(R.hop.edge, Math.round(map.w * R.hop.edgeX)); if (H.plat !== p0 || land < p.x0 + R.hop.margin || land > p.x1 - R.hop.margin || land < eg || land > map.w - eg || H.hopLen < R.hop.min) s.badHop++; }
      F.events.length = 0;
      if (F.t > (H.hopAt ?? -1) && F.t < (H.hopUntil || 0) + 50) { const p = map.plats[H.plat]; if (!p || H.x < p.x0 || H.x > p.x1) s.badHop++; }
      for (const m of F.mobs) { const p = map.plats[m.plat]; if (m.x < p.x0 + 200 || m.x > p.x1 - 200) s.badMob++; if (m.kbHit === F.t) s.kb++; if (m.slowUntil > F.t && F.t >= m.slowAt) s.slow++; }
      const tg = F.mobs.find((m) => m.id === H.target);
      if (tg && Math.abs(tg.y - H.y) <= SAME_Y_T && H.plat >= 0) { const d = Math.abs(tg.x - H.x); s.n++; s.sum += d; if (d >= 2000 && d <= 4000) s.in24++; if (d < 1500) s.lt15++; }
    }
    return { F, ...s, avg: s.sum / s.n, p24: s.in24 / s.n, p15: s.lt15 / s.n };
  };
  const SAME_Y_T = 500;
  const B0 = off(() => [1, 2].map((sd) => hunt3('bow', 60, sd))), B1 = [1, 2].map((sd) => hunt3('bow', 60, sd));
  const mean = (a, k) => a.reduce((x, r) => x + r[k], 0) / a.length, pc = (v) => `${(v * 100).toFixed(0)}%`;
  const b0 = { avg: mean(B0, 'avg'), p24: mean(B0, 'p24'), p15: mean(B0, 'p15') }, b1 = { avg: mean(B1, 'avg'), p24: mean(B1, 'p24'), p15: mean(B1, 'p15') };
  ok(b1.avg >= b0.avg + 500 && b1.p24 >= b0.p24 * 1.6 && b1.p15 <= b0.p15 * 0.6, '궁사 자동 사냥 3분(Lv60 · 씨앗 둘): 표적과 평균 거리 · 2~4m · 1.5m 안 — 예전 → 지금',
    `평균 ${(b0.avg / 1000).toFixed(2)}m → ${(b1.avg / 1000).toFixed(2)}m · 2~4m ${pc(b0.p24)} → ${pc(b1.p24)} · 1.5m 안 ${pc(b0.p15)} → ${pc(b1.p15)}`);
  const M0s = off(() => [1, 2].map((sd) => hunt3('mage', 60, sd))), M1s = [1, 2].map((sd) => hunt3('mage', 60, sd)), M1 = M1s[0];
  const m0 = { avg: mean(M0s, 'avg'), p24: mean(M0s, 'p24'), p15: mean(M0s, 'p15') }, m1 = { avg: mean(M1s, 'avg'), p24: mean(M1s, 'p24'), p15: mean(M1s, 'p15') };
  ok(m1.p24 >= m0.p24 * 1.6 && m1.p15 <= m0.p15 * 0.7, '술사도 멀리서(Lv60 · 씨앗 둘) — 2~4m가 늘고 1.5m 안이 준다(평균은 4m 밖 시간도 줄어 비슷)', `평균 ${(m0.avg / 1000).toFixed(2)}m → ${(m1.avg / 1000).toFixed(2)}m · 2~4m ${pc(m0.p24)} → ${pc(m1.p24)} · 1.5m 안 ${pc(m0.p15)} → ${pc(m1.p15)}`);
  const all = [...B1, ...M1s];
  ok(B1.every((r) => r.hops >= 10) && M1s.every((r) => r.hops >= 10) && B0.every((r) => r.hops === 0) && M0s.every((r) => r.hops === 0), '뒤로 뛰기가 일어난다(3분에 10번 넘게) · 끄면 없음', `궁사 ${B1.map((r) => r.hops).join('/')} · 술사 ${M1s.map((r) => r.hops).join('/')}`);
  ok(all.every((r) => r.badHop === 0), '뛰기는 늘 발판 안 — 내려설 자리는 발판 끝에서 0.3m 안쪽 · 뛰는 동안 발판을 벗어나지 않음', all.map((r) => r.badHop).join(','));
  ok(all.every((r) => r.badMob === 0) && B1.every((r) => r.kb > 50) && M1s.every((r) => r.slow > 50 && r.kb === 0) && B1.every((r) => r.slow === 0), '밀려도 몹은 제 발판 안 · 궁사는 밀고 술사는 느리게(서로 섞이지 않음)', `밀림 ${B1.map((r) => r.kb).join('/')} · 느려진 틱 ${M1.slow}`);
  // 같은 레벨 기준 무인 — 분당 처치는 그대로(±5%) · 받는 피해는 줄어듦
  const rate = (job) => { let k0 = 0, k1 = 0, d0 = 0, d1 = 0; for (const L of [45, 90]) for (let sd = 1; sd <= 3; sd++) { const a = off(() => new SideFight(sideRoom(L, sd, { n: 18, coolMs: 1000 }), refPlayer(L, job), sd * 13 + 5).run(180000)), b = new SideFight(sideRoom(L, sd, { n: 18, coolMs: 1000 }), refPlayer(L, job), sd * 13 + 5).run(180000); k0 += a.kills; k1 += b.kills; d0 += a.dmgIn; d1 += b.dmgIn; } return { x: k1 / k0, h: d1 / d0 }; };
  const rb = rate('bow'), rm = rate('mage');
  ok(Math.abs(rb.x - 1) <= 0.05 && Math.abs(rm.x - 1) <= 0.05 && rb.h < 0.8 && rm.h < 0.9, '같은 조건 분당 처치 그대로(±5%) · 받는 피해 ↓ — Lv45 · 90 씨앗 셋', `궁사 처치 ×${rb.x.toFixed(3)} 피해 ×${rb.h.toFixed(2)} · 술사 처치 ×${rm.x.toFixed(3)} 피해 ×${rm.h.toFixed(2)}`);
  // 근접 셋은 그대로 — 켜든 끄든 같은 사건 흐름(난수 · 위치 하나도 안 바뀜)
  //   지문은 v627 엔진(원거리 손대기 전)으로 잰 값 — 근접 싸움을 일부러 바꾸면 여기도 새로 잰다(v632 자동 움직임으로 새로 잼)
  const GOLD = { 'sword:30:2': '4ff6c032:59:420108', 'sword:90:5': '77566043:56:15877089', 'spear:30:2': '1684c9a:57:391263', 'spear:90:5': '9ebf9ab:56:16138927', 'fist:30:2': '2c48a84c:56:430104', 'fist:90:5': '4baf9544:56:16390233' };
  const dg = (job, L, sd) => new SideFight(sideRoom(L, sd, { n: 18, coolMs: 1000 }), refPlayer(L, job), sd).run(120000).digest();
  const mel = ['sword', 'spear', 'fist'].flatMap((j) => [[30, 2], [90, 5]].map(([L, sd]) => [`${j}:${L}:${sd}`, dg(j, L, sd), off(() => dg(j, L, sd))]));
  ok(mel.every(([k, a, b]) => a === b && a === GOLD[k]), '근접(검객 · 창수 · 권사)은 그대로 — v627 엔진과 같은 사건 흐름 · 켜든 끄든 같음', mel.filter(([k, a, b]) => a !== b || a !== GOLD[k]).map((x) => `${x[0]} ${x[1]}`).join(' '));
  { const T0 = 1.8e12, play = () => { const g = new Game(newGame('sword', T0, 31), T0); g.tick(T0); let t = T0; for (let i = 0; i < 240; i++) { t += 1000; g.tick(t); g.hunt(1000); } return g.save(); };
    ok(play() === off(play), '근접 게임(사냥 · 칸 두목 · 물러나기 4분)도 세이브까지 그대로'); }
  // 결정론 — 같은 씨앗이면 뛰기 · 밀림 · 느려짐까지 같다
  for (const job of ['bow', 'mage']) { const a = new SideFight(sideRoom(60, 3, { n: 18, coolMs: 1000 }), refPlayer(60, job), 9).run(120000), b = new SideFight(sideRoom(60, 3, { n: 18, coolMs: 1000 }), refPlayer(60, job), 9).run(120000);
    ok(a.digest() === b.digest() && a.hops > 0 && a.events.some((e) => e[0] === 'hop') && Number.isInteger(a.hero.x) && a.mobs.every((m) => Number.isInteger(m.x)), `${job === 'bow' ? '궁사' : '술사'}: 같은 씨앗 → 같은 결과(뛰기 포함) · 위치는 mm 정수`, a.digest()); }
  // 밀림 — 일반 250 · 정예 반 · 두목은 안 밀림 · 화살이 닿는 때부터 미끄러지고 그동안 멈칫 · 발판 끝에서 멈춤
  { const F = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 5, { auto: false }), g0 = F.def.map.plats[0];
    F.mobs = []; F.famState.a.keep = 0; F.hero.x = 6000; F.hero.y = 0; F.hero.plat = 0;
    F.spawn('a', { p: 0, x: 9000 }); F.spawn('e', { p: 0, x: 9500 }); F.spawn('b', { p: 0, x: 10000 });
    const [mo, el, bo] = F.mobs; for (const m of F.mobs) { m.x = { mob: 9000, elite: 9500, boss: 10000 }[m.kind]; m.angry = true; }
    for (const m of F.mobs) m.hp = m.st.hp = 1e12;
    F.strike(mo, SKILL_BASE); F.strike(el, SKILL_BASE); F.strike(bo, SKILL_BASE);
    F.hero.x = 500;   // 손 조작이어도 사거리 안 몹은 저절로 친다 — 더 맞지 않게 멀리
    ok(mo.kbN === R.kb.base && el.kbN === Math.round(R.kb.base * R.kb.eliteX) && bo.kbX === undefined && bo.kbN === undefined && mo.kbAt > F.t, '궁사 평타: 일반 250 · 정예 반 · 두목은 안 밀림 · 화살이 닿는 때(조금 뒤)부터', `일반 ${mo.kbN} · 정예 ${el.kbN} · 닿기까지 ${mo.kbAt - F.t}ms`);
    let xs = null, stag = true; while (F.t < mo.kbAt || mo.kbX) { if (F.t + 50 === mo.kbAt) xs = mo.x; F.step(); if (F.t >= mo.kbAt && mo.moving) stag = false; }
    ok(xs !== null && mo.x - xs === R.kb.base && stag && mo.kbX === 0, '밀린 거리만큼 무인 반대쪽으로 미끄러진다 · 그동안 걷지 않는다', `${mo.x - xs}mm`);
    const F2 = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 5, { auto: false }); F2.mobs = []; F2.famState.a.keep = 0; F2.hero.x = 20000; F2.hero.y = 0; F2.hero.plat = 0;
    F2.spawn('a', { p: 0, x: 25000 }); const m2 = F2.mobs[0]; m2.x = g0.x1 - 260; m2.angry = true; m2.hp = m2.st.hp = 1e12;
    F2.strike(m2, { coef: 1, base: false }, 0); F2.strike(m2, { coef: 1, base: false }, 1); F2.hero.x = 9000;
    while (F2.t + 50 < m2.stagUntil) F2.step();   // 멈칫이 끝나기 전까지(끝나면 다시 걸어온다)
    ok(m2.x === g0.x1 - 200 && m2.kbN === R.kb.skill && m2.kbX === 0, '무공(한 번 쓸 때 몹마다 첫 대만 400) · 발판 끝에 닿으면 거기서 멈춘다', `x ${m2.x} / 끝 ${g0.x1 - 200}`);
    // 두목전(자동 · 30초) — 화살을 많이 맞아도 두목은 밀리지 않는다
    const B = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 6); B.mobs = []; B.famState.a.keep = 0; B.spawn('b', B.def.map.spots[0]); const bb = B.mobs[0]; bb.hp = bb.st.hp = 1e12;
    let bh = 0; for (let i = 0; i < 600; i++) { B.step(); bh += B.events.filter((e) => e[0] === 'hit' && e[2] === bb.id && e[5] !== 2).length; B.events = []; }
    ok(bh > 30 && bb.kbX === undefined && bb.kbHit === undefined, '두목전 30초 — 두목은 여러 번 맞아도 밀리지 않는다', `맞음 ${bh}번`); }
  // 술사 기탄 — 닿으면 걸음 ×0.6 · 두목은 아님
  { const F = new SideFight(sideRoom(60, 4), refPlayer(60, 'mage'), 5, { auto: false }); F.mobs = []; F.famState.a.keep = 0; F.hero.x = 6000; F.hero.y = 0; F.hero.plat = 0;
    F.spawn('a', { p: 0, x: 9000 }); F.spawn('b', { p: 0, x: 12000 }); const [m, b] = F.mobs; m.x = 9000; m.angry = true; b.angry = true; m.hp = m.st.hp = b.hp = b.st.hp = 1e12;
    F.strike(m, SKILL_BASE); F.strike(b, SKILL_BASE); F.hero.x = 500;   // 더 맞지 않게 사거리 밖으로
    while (F.t < m.slowAt) F.step();
    m.spd = 1000; m.chase = true; const x0 = m.x; F.step(); const slowStep = x0 - m.x;
    while (F.t < m.slowUntil) F.step(); m.spd = 1000; m.chase = true; m.nextAtk = F.t + 9999; const x1 = m.x; F.step(); const fullStep = x1 - m.x;
    ok(m.slowUntil - m.slowAt === R.slow.ms && slowStep === Math.round(fullStep * R.slow.x) && fullStep > 0 && b.slowUntil === undefined && m.kbX === undefined, '술사 평타 기탄: 맞은 몹 걸음 ×0.6(0.8초) · 밀지는 않음 · 두목은 그대로', `걸음 ${slowStep}mm / 보통 ${fullStep}mm`); }
  // 수동이면 뛰지 않는다 · 두목 패턴 피하기가 먼저 · 붉은 범위 안으로는 안 뜀
  { const mk = (auto) => { const F = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 7, { auto }); F.mobs = []; F.famState.a.keep = 0; F.hero.x = 9000; F.hero.y = 0; F.hero.plat = 0; F.spawn('a', { p: 0, x: 10000 }); const m = F.mobs[0]; m.x = 10000; m.angry = true; m.hp = m.st.hp = 1e12; m.nextAtk = 1e12; return F; };
    const hopsIn = (F, n) => { let h = 0; for (let i = 0; i < n; i++) { F.step(); for (const e of F.events) if (e[0] === 'hop') h++; F.events = []; } return h; };
    const A = mk(true), M = mk(false);
    const xw = (hopsIn(A, 3), A.hero.x);   // 웅크림(0.1초) 동안은 제자리
    ok(xw === 9000 && hopsIn(A, 6) === 0 && A.hero.x === 9000 - R.hop.dist && A.hops === 1 && A.hero.face === 1 && hopsIn(M, 40) === 0, '자동이면 웅크렸다(0.1초) 붙은 몹 반대쪽으로 2.2m 뛴다(몹을 본 채 · 0.28초) · 수동이면 안 뜀', `자동 ${A.hero.x - 9000}mm`);
    const T = mk(true); T.spawn('b', { p: 0, x: 20000 }); const bs = T.mobs.find((x) => x.kind === 'boss'); bs.nextPat = 1e12;
    bs.pat = { id: 'taiji', at: T.t, end: T.t + 5000, x: 9000 - 2200, y: 0, w: 2400, dmgX: 1, shape: 'circle', safe: null };
    ok(hopsIn(T, 6) === 0, '내려설 자리가 두목 붉은 범위 안이면 안 뜀');
    bs.pat = { id: 'taiji', at: T.t, end: T.t + 5000, x: T.hero.x, y: 0, w: 2400, dmgX: 1, shape: 'circle', safe: null };
    ok(hopsIn(T, 1) === 0 && T.hero.x !== 9000, '무인이 붉은 범위 안이면 피하기가 먼저(뛰지 않고 비킨다)', `${T.hero.x - 9000}mm`); }
  // 몰리면 안 뜀(발판 끝) · 자리가 모자라면 짧게(0.9m 이상)
  { const F = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 7); F.mobs = []; F.famState.a.keep = 0; F.hero.x = R.hop.edge + 500; F.hero.y = 0; F.hero.plat = 0; F.spawn('a', { p: 0, x: R.hop.edge + 1500 }); const m = F.mobs[0]; m.x = R.hop.edge + 1500; m.angry = true; m.hp = m.st.hp = 1e12;
    let h = 0; for (let i = 0; i < 10; i++) { F.step(); h += F.events.filter((e) => e[0] === 'hop').length; F.events = []; }
    const G = new SideFight(sideRoom(60, 4), refPlayer(60, 'bow'), 7); G.mobs = []; G.famState.a.keep = 0; const eg = R.hop.edge; G.hero.x = eg + 1700; G.hero.y = 0; G.hero.plat = 0; G.spawn('a', { p: 0, x: eg + 2700 }); const m2 = G.mobs[0]; m2.x = eg + 2700; m2.angry = true; m2.hp = m2.st.hp = 1e12;
    for (let i = 0; i < 10; i++) G.step();
    ok(h === 0 && G.hops === 1 && G.hero.hopLen === 1700 && G.hero.x === R.hop.edge, '발판 · 맵 끝에 몰리면 안 뜀 · 자리가 모자라면 짧게(맵 끝에선 5m 앞까지 — 맵 끝에 붙으면 무인이 HP 상자 · 무공 칸 밑에 깔린다)', `짧게 ${G.hero.hopLen}mm → x ${G.hero.x}`); }
  // 뛰는 도중 저장 → 불러와도 이어서 사냥(싸움은 저장하지 않고 새로 연다)
  { const T0 = 1.8e12, g = new Game(newGame('bow', T0, 21), T0); g.addExp(EX.cumExp(40)); g.tick(T0); const T = g.stage(); T.idx = T.top = 40; T.auto = false;
    let t = T0, mid = false;
    for (let i = 0; i < 6000 && !mid; i++) { t += 50; g.tick(t); g.hunt(50); const F = g.fight, H = F.hero; mid = F.t > (H.hopAt ?? -1) && F.t < (H.hopUntil || 0); }
    const txt = g.save(), g2 = Game.load(txt, t), k0 = g2.S.kills, S2 = g2.S.stage;
    for (let i = 0; i < 90; i++) { t += 1000; g2.tick(t); g2.hunt(1000); }
    const F2 = g2.fight;
    ok(mid && g2.signed && S2.idx === 40 && g2.S.kills > k0 && F2.hops > 0 && Number.isInteger(F2.hero.x) && F2.hero.plat >= -1, 'v628 뛰는 도중 저장 → 불러오면 새 싸움으로 이어서 사냥(뛰기도 다시)', `처치 +${g2.S.kills - k0} · 뛰기 ${F2.hops}`); }
  // 자동 물러나기(game.js rgSlow) — 원거리는 칸이 레벨보다 앞선 채 처치가 느리면 쓰러지지 않아도 물러난다 · 근접 · 낮은 칸은 아님
  { const T0 = 1.8e12, mk = (job, lv, idx, stx) => { const g = new Game(newGame(job, T0, 41), T0); if (lv > 1) g.addExp(EX.cumExp(lv)); g.tick(T0); const T = g.stage(); T.idx = idx; T.top = idx; T.kills = 0; T.auto = true; const fo = g.fighter.bind(g); g.fighter = () => { const x = fo(); x.st = { ...x.st, hp: x.st.hp * 1e4, ...stx(x.st) }; return x; }; g.dirtyStats = true; return g; };
    const go = (g, sec) => { let t = T0, ret = null; for (let i = 0; i < sec && !ret; i++) { t += 1000; g.tick(t); g.hunt(1000); ret = g.feed.find((f) => f.k === 'retreat') || null; g.feed.length = 0; if (g.bossFight) g.endChallenge(false); } return ret; };
    const bw = mk('bow', 20, 40, () => ({})), rb2 = go(bw, 400);
    ok(rb2 && rb2.from === 40 && bw.stage().idx === 39 && bw.fight.deaths === 0, '궁사: 앞선 칸(Lv20 · 40칸)에서 처치가 느리면 쓰러지지 않아도 물러난다(40초 창 셋)', rb2 ? `${rb2.from} → ${rb2.idx}` : '안 물러남');
    const sw = mk('sword', 20, 40, () => ({}));
    ok(!go(sw, 400) && sw.stage().rgMs === undefined, '근접은 예전대로 — 쓰러지지 않으면 안 물러난다(새 칸 없음)');
    const low = mk('bow', 60, 30, (st) => ({ atk: Math.max(1, Math.round(st.atk * 0.02)) }));
    ok(!go(low, 300), '레벨보다 낮은 칸이면 처치가 느려도 물러나지 않는다'); }
}

console.log('\n=== v631 장비 — 자동 장착은 종합(전투력 × 보스 피해) · 새로 낀 것 · 재료 안내 ===');
{
  const { MATS } = await import('../js/s2/tables/matinfo.js'), { GEAR_BOSS } = await import('../js/s2/game.js');
  const T0 = 1.8e12, mk = (seed, lv = 80) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(lv)); g.tick(T0); return g; };
  // 예전 점수(gearScore)는 보스 피해를 크게 쳐서 사냥 전투력이 내려가는 망토로 바꿨다 — 이제는 안 바꾼다
  { const g = mk(3), G = g.S.gear;
    const cur = { uid: 7e8, slot: 'cape', g: 0, up: 0, subs: [{ k: 'atkL1', v: 14 }], rr: 0, lock: false };
    const it = { uid: 7e8 + 1, slot: 'cape', g: 0, up: 0, subs: [{ k: 'critDmg', v: 18 }, { k: 'bossDmg', v: 16 }, { k: 'bossDmg', v: 22 }], rr: 0, lock: false };
    G.eq.cape = cur;
    const oldSays = GR.gearScore(it, 80) > GR.gearScore(cur, 80), pw = [g.gearPw(cur), g.gearPw(it)];
    const got = g.obtain([it]);
    ok(oldSays && !!got.length === pw[1] > pw[0] && (G.eq.cape === it) === pw[1] > pw[0], '보스 피해 망토 — 끼는지는 예전 점수가 아니라 종합으로 정한다', `점수 ${GR.gearScore(cur, 80).toFixed(0)}→${GR.gearScore(it, 80).toFixed(0)} · 종합 ${pw[0]}→${pw[1]} · ${got.length ? '낌' : '가방'}`);
    // 종합 = 사냥 전투력 × (1 + w × 보스 피해‰) — 보스 피해만 다른 두 반지: 전투력은 같고 종합은 보스 피해 쪽이 높다
    const b0 = { uid: 7e8 + 5, slot: 'ring', g: 2, up: 0, subs: [], rr: 0, lock: false }, b1 = { ...b0, uid: 7e8 + 6, subs: [{ k: 'bossDmg', v: 40 }] };
    const pp = [b0, b1].map((x) => { const pv = G.eq.ring; G.eq.ring = x; try { return g.power(); } finally { G.eq.ring = pv; } });
    ok(GEAR_BOSS.w > 0 && pp[0] === pp[1] && g.gearPw(b1) > g.gearPw(b0), `종합은 보스 피해를 센다(w ${GEAR_BOSS.w}) — 전투력 같음 · 종합 ↑`, `전투력 ${pp.join('/')} · 종합 ${g.gearPw(b0)}→${g.gearPw(b1)}`);
    // 예전 점수가 무시하던 몹 피해 반지 → 전투력이 오르면 낀다 · 오른 만큼(dp) · 알림 · NEW 표시
    const r0 = { uid: 7e8 + 2, slot: 'ring', g: 0, up: 0, subs: [{ k: 'defP', v: 17 }, { k: 'bossDmg', v: 13 }, { k: 'critDmg', v: 32 }, { k: 'atkL1', v: 16 }], rr: 0, lock: false };
    const r1 = { uid: 7e8 + 3, slot: 'ring', g: 1, up: 0, subs: [{ k: 'mobDmg', v: 29 }, { k: 'mobDmg', v: 16 }, { k: 'mobDmg', v: 29 }], rr: 0, lock: false };
    G.eq.ring = r0; g.feed.length = 0; delete g.S.gearNew;
    const p0 = g.gearVal(), miss = GR.gearScore(r1, 80) <= GR.gearScore(r0, 80), g2 = g.obtain([r1]), p1 = g.gearVal();
    const fe = g.feed.find((f) => f.k === 'gear-eq'), nw = g.gearNews().ring;
    ok(miss && G.eq.ring === r1 && p1 > p0 && g2[0]?.equipped && g2[0].dp === p1 - p0, '예전 점수로는 놓치던 몹 피해 반지 → 종합이 오르니 낀다 · 오른 만큼을 돌려줌', `${p0} → ${p1} · dp ${g2[0]?.dp}`);
    ok(fe && fe.slot === 'ring' && fe.dp === p1 - p0 && fe.fg === 0 && nw && nw.g === 1 && nw.fg === 0 && nw.dp === p1 - p0, '새로 낀 것: 알림(gear-eq · 칸 · 전 등급 · 전투력) · 칸에 NEW 기록(전 → 새)', JSON.stringify({ fe, nw })); }
  // 뽑기를 많이 해도: 줍는 판단마다 전투력이 내려가지 않고 · 모두 끼기 뒤 가방에 더 센 것이 남지 않는다 · ▲(일괄 분해 대상 아님)과 같은 잣대
  for (const job of ['sword', 'bow']) {
    const g = new Game(newGame(job, T0, 11), T0); g.addExp(EX.cumExp(60)); g.tick(T0); g.S.wallet['ticket:gear'] = 300; g.S.wallet.gold = 1e12; g.S.wallet['item:stone'] = 1e6;
    for (const s of GE.SLOTS) for (let i = 0; i < 6; i++) g.enhance(s);
    let down = 0, n = 0;
    for (let i = 0; i < 30; i++) { const a = g.gearVal(); g.pullGear(10, true); const b = g.gearVal(); n++; if (b < a) down++; }
    const nb = g.equipBest(); const G = g.S.gear;
    const left = GE.SLOTS.filter((sl) => G.bag.some((x) => x.slot === sl && g.gearPw(x, sl) > g.gearVal())).length;
    const junk = g.gearJunk(), junkOk = junk.every((x) => g.gearPw(x, x.slot) <= g.gearVal()), keep = G.bag.filter((x) => !junk.includes(x) && !x.lock);
    ok(!down && !left && junkOk && keep.every((x) => g.gearPw(x, x.slot) > g.gearVal() || !G.eq[x.slot]), `${job} 뽑기 300번 — 줍기로 종합이 내려간 적 없음 · 모두 끼기 뒤 더 센 것 없음 · 분해 대상은 모두 낀 것보다 약함`, `줍기 ${n}번 · 내려감 ${down} · 끼기 ${nb}칸 · 남은 칸 ${left} · 분해 대상 ${junk.length}`);
  }
  // 모두 끼기 — 바뀐 칸마다 NEW(전 → 새 · 전투력 합) · 두 번 바뀌면 처음 것 → 마지막 것
  { const g = mk(5), G = g.S.gear; delete g.S.gearNew;
    const a = { uid: 7e8 + 10, slot: 'hat', g: 1, up: 0, subs: [], rr: 0, lock: false }, b = { uid: 7e8 + 11, slot: 'hat', g: 3, up: 0, subs: [], rr: 0, lock: false }, c = { uid: 7e8 + 12, slot: 'hat', g: 5, up: 1, subs: [], rr: 0, lock: false };
    G.eq.hat = a; G.bag.push(b);
    const p0 = g.gearVal(); g.feed.length = 0; const n1 = g.equipBest('best'), p1 = g.gearVal();
    G.bag.push(c); const n2 = g.equipBest('best'), p2 = g.gearVal(), N = g.gearNews().hat;
    ok(n1 === 1 && n2 === 1 && G.eq.hat === c && N.fg === 1 && N.g === 5 && N.up === 1 && N.dp === p2 - p0 && g.feed.filter((f) => f.k === 'gear-eq' && f.src === 'best').length === 2, '모두 끼기 → NEW(처음 것 → 마지막 것 · 전투력 합) · 알림 둘', JSON.stringify({ N, p: [p0, p1, p2] }));
    ok(g.equipBest() === 0, '더 좋은 것이 없으면 0칸'); }
  // 옛 세이브(gearNew 없음)도 · 결정론(같은 씨앗이면 같은 장비)
  { const g = mk(6); delete g.S.gearNew; const o = Game.load(g.save(), T0); ok(o.gearNews() && typeof o.gearNews() === 'object' && o.S.gearNew === o.gearNews(), '옛 세이브 — 새로 낀 것 칸이 저절로 생긴다');
    const run = () => { const x = mk(9, 40); x.S.wallet['ticket:gear'] = 100; for (let i = 0; i < 10; i++) x.pullGear(10, true); x.equipBest(); return JSON.stringify(Object.values(x.S.gear.eq).map((it) => it && [it.slot, it.g, it.up, it.subs])); };
    ok(run() === run(), '같은 씨앗 → 같은 장착(결정론)'); }
  // 재료 안내 — 강화 · 성혼 · 복구 · 부옵션 · 분해에 드는 재료가 모두 있고 · 얻는 곳마다 창 열쇠
  { const used = new Set([...GS.enhCost(3, 50), ...GS.starCost(3, 50), ...GS.subRerollCost(0), ...GS.dismantle(3), { k: 'item:restore' }].map((c) => c.k));
    const miss = [...used].filter((k) => !MATS[k]), bad = Object.entries(MATS).flatMap(([k, M]) => (!M.name || !M.icon || !M.use || !M.src.length ? [k] : M.src.filter((x) => !x.t || !x.d || !/^[a-z]+:\d$/.test(x.go)).map((x) => `${k}/${x.t}`)));
    ok(!miss.length && !bad.length, '재료 안내 — 강화 · 성혼 · 복구 · 부옵션 · 분해 재료가 다 있다 · 얻는 곳마다 이름 · 한 줄 · 창 열쇠', `${[...used].join(',')} · 없음 ${miss} · 틀림 ${bad}`);
    const st = MATS['item:stone'].src.map((x) => x.t).join('/');
    ok(MATS['item:stone'].src.length >= 8 && /분해/.test(st) && /단련동/.test(st) && /상점/.test(st) && MATS['item:restore'].src.some((x) => /출석/.test(x.t)) && MATS['item:restore'].src.some((x) => /임무/.test(x.t)), '강화석 · 복구 주문서 얻는 곳(분해 · 단련동 · 상점 … / 출석 · 일일 임무)', st);
    ok(/40개/.test(MATS['item:stone'].src.find((x) => /단련동/.test(x.t)).d) && /1~64개/.test(MATS['item:stone'].src[0].d), '숫자는 엔진 표 그대로(단련동 40 · 분해 1~64)'); }
}

console.log('\n=== v632 무공 변형(4단) ===');
{
  const FA = 2;   // battle/ref.js FARM_AOE — 표준 예산이 보는 사냥 몰린 수
  // 표: 모양마다 둘(무리 쪽 · 두목 쪽) · 다섯 직업 · 레벨 1/30 — 몰린 수 1 · FARM_AOE에서 1.05배 이하 · 어딘가는 손해(또는 사거리 ↓)
  const rows = [], bad = [];
  for (const job of Object.keys(KT.KIT)) for (const sk of KT.KIT[job]) {
    const vs = KT.varsOf(sk); if (sk.kind === 'passive') { if (vs.length) bad.push(`${sk.id} 상시인데 변형`); continue; }
    if (vs.length !== 2 || vs.map((v) => v.tag).sort().join() !== '두목,무리') bad.push(`${sk.id} 변형 ${vs.map((v) => v.v)}`);
    for (const lv of [1, 30]) {
      const b = KT.battleKit([{ ...sk, lv }])[0];
      for (const v of vs) {
        const k = KT.battleKit([{ ...sk, lv, vr: v.v }])[0], r = (a) => KT.varBudget(k, a) / KT.varBudget(b, a);
        const worse = [1, 2, 3, 5, 8, 12, 20, 30].some((a) => r(a) < 0.97) || (k.range || 0) < (b.range || 0) || (k.kind === 'buff' && (k.durMs < b.durMs || Object.values(k.buff).reduce((x, y) => x + y, 0) < Object.values(b.buff).reduce((x, y) => x + y, 0)));   // 버프: 짧아지거나 · 약해지거나
        if (k.vr !== v.v || r(1) > 1.05 || r(FA) > 1.05 || !worse) bad.push(`${sk.id}/${v.v} lv${lv} ×${r(1).toFixed(3)}/${r(FA).toFixed(3)}`);
        if (job === 'sword' && lv === 30) rows.push(`${sk.id}:${v.v} 대상 ${b.maxT}→${k.maxT} 연타 ${b.hits}→${k.hits} 계수 ${b.coef}→${k.coef}${k.kind === 'buff' ? ` 지속 ${b.durMs}→${k.durMs}` : ''}`);
      }
    }
  }
  ok(!bad.length, '변형 표 — 공격 모양 넷 · 버프마다 둘(무리 · 두목 쪽) · 몰린 수 1 · FARM_AOE에서 1.05배 이하 · 공짜로 좋은 것 없음', bad.slice(0, 4).join(' | ') || rows.slice(0, 4).join(' · '));
  // 고르기 — 그 무공에 15점 넘게 써야 · 하나만 · 점수 안 듦 · 초기화하면 풀림 · 저장 · 불러오기
  const T0 = 1.8e12, g = new Game(newGame('sword', T0, 5), T0); g.addExp(EX.cumExp(80)); g.tick(T0);
  g.S.hero.adv = 2; g.hero.kitUnlock(); g.S.wallet.gold = 1e9;
  const H = g.hero, id = 'sword_0';
  const early = H.canTreeVar(id, 'fork'), K = H.kitState();
  for (const nd of KT.treeOf(KT.skillById(id))) while (H.treeSpent(id) < KT.VAR_GATE && g.treeUp(id, nd.n));
  const p0 = g.treePts().used, sp = H.treeSpent(id);
  const picked = g.treeVar(id, 'fork'), again = g.treeVar(id, 'back'), wrong = g.treeVar('sword_1', 'fork');
  const bk = g.hero.battleKit().find((k) => k.id === id);
  ok(!early && sp >= KT.VAR_GATE && picked && !again && !wrong && K.var[id] === 'fork' && g.treePts().used === p0 && bk.vr === 'fork' && bk.fx === 'fork' && bk.maxT === 3,
    `4단은 그 무공에 ${KT.VAR_GATE}점 넘게 써야 열림 · 하나만(다시 고르기 · 다른 모양 변형은 안 됨) · 점수 안 듦 · 전투 무공에 실림`, JSON.stringify({ early, sp, picked, again, wrong, maxT: bk.maxT, coef: bk.coef }));
  const txt = g.save(), g2 = Game.load(txt, T0 + 1000);
  ok(g2.signed && g2.hero.kitState().var?.[id] === 'fork' && g2.hero.battleKit().find((k) => k.id === id).vr === 'fork', '고른 변형은 저장 · 불러오기에 남는다');
  const old = JSON.parse(JSON.stringify(g.S)); delete old.hero.kit.var; const g3 = new Game(old, T0);
  ok(g3.hero.treeVarOf(id) === null && g3.hero.battleKit().every((k) => !k.vr) && typeof g3.hero.varSt() === 'object', '예전 세이브(변형 칸 없음)는 변형 없이 · 칸은 쓸 때 생김');
  const pw0 = g.power(), w0 = g.S.wallet.gold, rs = g.treeReset();
  ok(rs && !Object.keys(K.var || {}).length && g.S.wallet.gold < w0 && H.canTreeVar(id, 'back') === false && g.hero.battleKit().every((k) => !k.vr), '트리 초기화(값은 예전 그대로)하면 변형도 풀린다 · 다시 15점 써야 고름');
  for (const nd of KT.treeOf(KT.skillById(id))) while (H.treeSpent(id) < KT.VAR_GATE && g.treeUp(id, nd.n));
  const pwA = g.power(); g.treeVar(id, 'back'); g.dirtyStats = true; const pwB = g.power();
  ok(g.hero.battleKit().find((k) => k.id === id).vr === 'back' && pwA === pwB, '초기화 뒤 다른 변형을 고를 수 있다 · 전투력은 변형과 무관(오르내리지 않음)', `${pw0} · ${pwA} → ${pwB}`);
  // 움직임 — 대상 고르기(kitTargets) · 끌어당김(kbX) · 나눠 친 연타(kitPend)
  const p = refPlayer(130, 'sword'), F = new SideFight(sideRoom(130, 1, { n: 0 }), p, 1), Hh = F.hero;
  const mob = (i, x, y, kind = 'mob') => ({ id: 900 + i, x, y, kind, plat: 0, hp: 1e12, st: { hp: 1e12 } });
  Hh.x = 10000; Hh.y = 0; Hh.face = 1;
  const kOf = (sid, v) => KT.varApply(KT.battleKit([{ ...KT.skillById(sid), lv: 30 }])[0], v), base = (sid) => KT.battleKit([{ ...KT.skillById(sid), lv: 30 }])[0];
  F.mobs = [mob(1, 11000, 0), mob(2, 12000, 2300), mob(3, 12500, 4600), mob(4, 8800, 0), mob(5, 13000, 0, 'boss')];
  const ids = (k, R, t) => F.kitTargets(k, R, 1, t).map((m) => m.id - 900).join('');
  const lb = base('sword_7'), lf = kOf('sword_7', 'fork'), lk = kOf('sword_7', 'back'), R7 = 5000;
  const tB = ids(lb, R7), tF = ids(lf, R7), tK = ids(lk, R7);
  const ab = base('sword_1'), aw = kOf('sword_1', 'twin'), tA = ids(ab, 3000), tW = ids(aw, 3000);
  const fc = kOf('sword_5', 'focus'), tFo = ids(fc, 6000, F.mobs[4]);
  ok(!tB.includes('2') && tF.includes('2') && !tF.includes('3') && tK[0] === '5' && !tA.includes('4') && tW.includes('4') && tFo[0] === '5',
    'fork 한 층 위까지(두 층 위는 아님) · back 두목 먼저 · twin 뒤도 · focus 표적 먼저', JSON.stringify({ tB, tF, tK, tA, tW, tFo }));
  F.mobs = [mob(1, 10500, 0), mob(2, 13500, 0), mob(3, 6800, 0, 'boss'), mob(4, 14500, 0)];
  const cb = base('sword_3'), cp = kOf('sword_3', 'pull'), Rc = 3000, inB = F.kitTargets(cb, Rc, 1).length, inP = F.kitTargets(cp, Rc, 1);
  F.kitPull(inP, Rc);
  const kb = Object.fromEntries(F.mobs.map((m) => [m.id - 900, m.kbX || 0]));
  ok(inB === 1 && inP.length === 3 && kb[2] < 0 && kb[1] === 0 && !kb[3] && !kb[4] && 13500 + kb[2] === 10000 + Math.round(Rc * 0.35),
    'pull 둘레 +30%(1.5m까지)에서 골라 무인 둘레(사거리 35%)까지 끌어당김 · 두목은 버팀 · 밖은 그대로', JSON.stringify({ inB, inP: inP.length, kb }));
  // spin · wave — 실제 싸움에서 연타가 0.3초 × 3 · 0.7초 뒤에 다시 나온다(그때 고른 대상에게)
  const waveHits = (sid, v) => {
    const pp = { ...refPlayer(130, 'sword'), kit: [kOf(sid, v)] }, G = new SideFight(sideRoom(130, 2, { n: 18, coolMs: 1000 }), pp, 3);
    let c = null; const ts = new Set();
    for (let i = 0; i < 4000; i++) { G.step(); for (const e of G.events) { if (!c && e[0] === 'cast' && e[8] === v) c = e[1]; if (c && e[0] === 'hit' && e[5] === 1 && e[1] - c <= 1000) ts.add(e[1] - c); } G.events = []; if (c && G.t - c > 1000) break; }
    return [...ts].sort((a, b) => a - b).join(',');
  };
  const sw = waveHits('sword_3', 'spin'), wv = waveHits('sword_5', 'wave');
  ok(sw === '0,300,600,900' && wv === '0,700', 'spin 네 번(0 · 0.3 · 0.6 · 0.9초) · wave 두 번(0 · 0.7초) — 엔진 연타 때', `spin ${sw} · wave ${wv}`);
  // 결정론 · 사건 — 같은 씨앗 같은 결과 · 변형은 cast [8]에 · 변형 없으면 예전 사건 그대로(위 근접 지문)
  const pv = { ...p, kit: p.kit.map((k) => { const v = KT.varsOf(KT.skillById(k.id))[0]; return v ? KT.varApply(k, v.v) : k; }) };
  const d1 = new SideFight(sideRoom(130, 4, { n: 18, coolMs: 1000 }), pv, 9).run(60000), d2 = new SideFight(sideRoom(130, 4, { n: 18, coolMs: 1000 }), pv, 9).run(60000);
  const tags = new Set(d1.events.filter((e) => e[0] === 'cast' || e[0] === 'buff').map((e) => (e[0] === 'cast' ? e[8] : e[3])));
  ok(d1.digest() === d2.digest() && ['fork', 'pull', 'wave', 'burst'].every((v) => tags.has(v)) && d1.hero.kit.every((k) => k.kind === 'passive' || k.vr), '변형 싸움도 같은 씨앗 → 같은 사건 · cast[8] / buff[3]에 변형', `${d1.digest()} · ${[...tags].join(',')}`);
  // 실제 싸움 예산 — 표준 무인 · 무리 방(18마리 · 3분) 처치 · 두목 허수아비(체력 ×1000 · 공격 0 · 2분) 피해. 씨앗 셋
  const bossRoom = (L, sd) => ({ lv: L, map: makeSideMap(sd), fams: { a: { mobs: [{ lv: L, kind: 'mob', w: 1 }], keep: 0, coolMs: 1000 }, b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 1, coolMs: 500 } } });
  const dummy = (pp, L, sd) => { const G = new SideFight(bossRoom(L, sd), pp, sd); const s0 = G.spawn.bind(G); G.spawn = (f, s) => { s0(f, s); const m = G.mobs[G.mobs.length - 1]; m.st = { ...m.st, hp: m.st.hp * 1000, atk: 0 }; m.hp = m.st.hp; }; G.run(1000); for (const m of G.mobs) { m.angry = true; m.nextPat = 1e12; } return G.run(120000).dmgOut; };
  const withTag = (pp, tag) => ({ ...pp, kit: pp.kit.map((k) => { const v = KT.varsOf(KT.skillById(k.id)).find((x) => x.tag === tag); return v ? KT.varApply(k, v.v) : k; }) });
  const out = [], fails = [];
  for (const [job, L] of [['sword', 60], ['sword', 130], ['bow', 130], ['mage', 130]]) {
    const p1 = refPlayer(L, job), r = {};
    for (const [nm, pp] of [['none', p1], ['pack', withTag(p1, '무리')], ['boss', withTag(p1, '두목')]]) { let k = 0, d = 0; for (let sd = 1; sd <= 3; sd++) { k += new SideFight(sideRoom(L, sd, { n: 18, coolMs: 1000 }), pp, sd * 7 + 1).run(180000).kills; d += dummy(pp, L, sd * 5 + 2); } r[nm] = { k, d }; }
    const x = (nm, f) => r[nm][f] / r.none[f], s = `${job}${L} 무리쪽 처치×${x('pack', 'k').toFixed(2)} 두목×${x('pack', 'd').toFixed(2)} · 두목쪽 처치×${x('boss', 'k').toFixed(2)} 두목×${x('boss', 'd').toFixed(2)}`;
    out.push(s);
    if (x('boss', 'd') > 1.07 || x('pack', 'k') > 1.12 || x('pack', 'd') > 0.9 || x('boss', 'k') > 1.08 || x('pack', 'k') < 0.85) fails.push(s);
  }
  ok(!fails.length, '실제 싸움 — 두목 쪽은 두목에 +7% 안 · 무리 쪽은 두목에 −10% 넘게 손해 · 사냥 처치는 −15%~+12% 안(무리 쪽) · 두목 쪽 +8% 안', (fails.length ? fails : out).join(' | '));
  console.log('    ' + out.join('\n    '));
}

console.log('\n=== v634 단약(무료 시간 버프) · 성장 봇짐(레벨 상자) ===');
{
  const { DANYAK, LVBOX, lvBoxReward, lvBoxLevels } = await import('../js/s2/game.js');
  const T0 = 1.8e12, MIN = 60e3, mk = (seed, lv = 30) => { const g = new Game(newGame('sword', T0, seed), T0); g.tick(T0); if (lv > 1) g.addExp(EX.cumExp(lv)); g.tick(T0); return g; };
  // ── 단약 ──
  ok(DANYAK.uses === 3 && DANYAK.ms === 30 * MIN && DANYAK.list.map((d) => d.id).join() === 'exp,gold,atk', '단약 셋(경험치 · 은자 · 공격) · 하루 3번 · 30분');
  const g = mk(41), st0 = g.bfState();
  ok(!('bf' in newGame('sword', T0, 1)) && st0.every((s) => !s.on && s.uses === 3) && g.bfSources().length === 0, '새 판: 세이브 칸은 처음 쓸 때 생김 · 셋 다 꺼짐 · 3번씩');
  const pw0 = g.power(), x0 = g.fighter().st;
  const e1 = g.bfEat('exp'), s1 = g.bfState().find((s) => s.id === 'exp');
  ok(e1 && e1.endMs === T0 + 30 * MIN && s1.on && s1.leftMs === 30 * MIN && s1.uses === 2, '먹으면 30분 · 남은 수 2', JSON.stringify(e1));
  ok(g.fighter().st.expP - (x0.expP || 0) === 500 && (g.fighter(false).st.expP || 0) === (x0.expP || 0) && g.power() === pw0, '청심단 — 경험치 +50%(싸움 스탯) · 전투력 숫자는 그대로', `${g.power()} / ${pw0}`);
  const e2 = g.bfEat('exp');
  ok(e2 && e2.endMs === T0 + 60 * MIN && g.bfState()[0].uses === 1, '같은 단약을 또 먹으면 끝나는 때에 30분을 더한다(60분)');
  ok(g.bfEat('exp') && g.bfEat('exp') === null && g.bfState()[0].uses === 0 && g.bfLeftMs('exp') === 90 * MIN, '하루 3번까지(네 번째는 안 됨)');
  ok(g.bfEat('nope') === null, '없는 단약은 안 됨');
  // 경험치 · 은자 · 공격이 실제 파이프라인에 붙는다
  { const a = mk(42), b = mk(42); a.bfEat('exp'); const ea0 = EX.cumExp(a.S.hero.lv) + a.S.hero.exp, eb0 = EX.cumExp(b.S.hero.lv) + b.S.hero.exp; a.addExp(100000); b.addExp(100000);
    const da = EX.cumExp(a.S.hero.lv) + a.S.hero.exp - ea0, db = EX.cumExp(b.S.hero.lv) + b.S.hero.exp - eb0;
    ok(Math.abs(da / db - 1.5) < 0.01, '청심단 — 같은 경험치가 1.5배로 들어간다(addExp)', `${da} / ${db}`); }
  { const a = mk(43), b = mk(43); a.bfEat('gold'); const ga = a.S.wallet.gold, gb = b.S.wallet.gold; a.hunt(60000); b.hunt(60000);
    const ra = (a.S.wallet.gold - ga) / Math.max(1, b.S.wallet.gold - gb);
    ok(a.S.kills === b.S.kills && a.S.kills > 5 && ra > 1.4 && ra < 1.6, '재물부 — 사냥 1분 은자 약 1.5배(처치는 같다)', `${ra.toFixed(3)} · 처치 ${a.S.kills}`); }
  { const a = mk(44), b = mk(44), pa = a.power(); a.bfEat('atk');
    ok(a.fighter().st.final5 - (b.fighter().st.final5 || 0) === 100 && a.power() === pa, '혈기단 — 최종 피해⑤ +10%(싸움에만) · 전투력 그대로');
    a.stage().idx = b.stage().idx = 40; a.hunt(60000); b.hunt(60000);
    ok(a.S.kills >= b.S.kills, '혈기단 — 같은 칸 1분 처치가 줄지 않는다', `${a.S.kills} / ${b.S.kills}`); }
  // 방치 보상엔 안 붙는다
  { const a = mk(45), b = mk(45); a.bfEat('exp'); a.S.bf.end.exp = T0 + 10 * 3600e3; const t1 = T0 + 3 * 3600e3;
    for (const x of [a, b]) { x.returnCheck(t1); x.tick(t1); x.claimOffline(); }
    ok(a.S.hero.lv === b.S.hero.lv && a.S.hero.exp === b.S.hero.exp && a.bfOff === false, '방치 보상(claimOffline)엔 단약 경험치가 붙지 않는다', `${a.S.hero.exp} / ${b.S.hero.exp}`); }
  // 끝나면 꺼짐 · 날이 바뀌면 수만 다시 3
  { const a = mk(46); a.bfEat('atk'); a.ensureFight(); a.tick(T0 + 10 * MIN); a.dirtyStats = false;
    a.tick(T0 + 31 * MIN); ok(a.bfSources().length === 0 && a.dirtyStats === true && !a.bfState()[2].on, '30분이 지나면 꺼지고 싸움 스탯을 다시 셈(dirtyStats)');
    a.bfEat('atk'); a.bfEat('atk'); ok(a.bfState()[2].uses === 0, '오늘 다 씀');
    const nd = T0 + 24 * 3600e3; a.tick(nd); ok(a.bfState()[2].uses === 3 && a.bfState()[0].uses === 3, '다음 날 — 다시 3번씩'); }
  // 모두 먹기 — 꺼진 것만
  { const a = mk(47); a.bfEat('gold'); const r = a.bfEatAll();
    ok(r.map((x) => x.id).join() === 'exp,atk' && a.bfState().every((s) => s.on) && a.bfState()[1].uses === 2 && a.bfLeftMs('gold') === 30 * MIN, '모두 먹기 — 꺼진 것만 하나씩(켜진 재물부는 늘이지 않음)');
    ok(a.bfEatAll().length === 0, '다 켜져 있으면 모두 먹기는 아무것도 안 함'); }
  // 자동 성장 — 기본은 안 먹는다 · buff: true일 때만
  { const a = mk(48), off = { daily: false, claim: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false };
    const o1 = a.autoGrow(off); ok(!o1.buff && a.bfState().every((s) => !s.on && s.uses === 3), '자동 성장(기본) — 단약은 먹지 않는다(고르는 건 무인)');
    const o2 = a.autoGrow({ ...off, buff: true }); ok(o2.buff === 3 && a.bfState().every((s) => s.on && s.uses === 2), '단약 자동(buff: true) — 꺼진 셋을 먹는다', o2.buff);
    ok(a.autoGrow({ ...off, buff: true }).buff === 0, '켜져 있는 동안은 또 먹지 않는다');
    const l = Game.load(a.save(), T0 + 5 * MIN); ok(l.bfState().every((s) => s.on && s.uses === 2) && l.bfLeftMs('exp') === 25 * MIN, '세이브에 남는다(불러온 뒤 남은 25분)'); }
  // ── 성장 봇짐 ──
  const r5 = lvBoxReward(5), r10 = lvBoxReward(10), r50 = lvBoxReward(50), r150 = lvBoxReward(150);
  ok(r5.give['ticket:gear'] === LVBOX.small.tix && r5.gear === -1 && !r5.give['ticket:pal'] && r10.give['ticket:gear'] === LVBOX.large.tix && r10.gear >= 0 && r50.give['ticket:pal'] === 1 && r50.give['ticket:weapon'] === 1 && r50.give['ticket:relic'] === 1 && r150.gear <= 4,
    '5레벨 작은 봇짐(뽑기권 · 강화석) · 10레벨 큰 봇짐(+확정 장비) · 50레벨마다 병기 · 동료 · 영물 뽑기권 1씩', JSON.stringify([r5, r10, r50]));
  ok(lvBoxReward(7) === null && lvBoxReward(0) === null && lvBoxReward(155) === null && lvBoxLevels().length === 30, '5의 배수 · Lv150까지(봇짐 30)');
  { const upTo = (L) => lvBoxLevels().filter((v) => v <= L).map(lvBoxReward), sum = (L, k) => upTo(L).reduce((a, r) => a + (r.give[k] || 0), 0);
    ok(sum(50, 'ticket:gear') <= 25 && sum(50, 'item:stone') <= 250 && sum(150, 'ticket:gear') <= 70, '봇짐은 작다 — Lv50까지 뽑기권 25 · 강화석 250 안 · 끝까지 뽑기권 70 안', `${sum(50, 'ticket:gear')} · ${sum(50, 'item:stone')} · ${sum(150, 'ticket:gear')}`); }
  { const a = mk(51, 1); ok(a.lvBoxCan() === 0 && a.lvBoxNext() === 5 && a.lvBoxClaim(5) === null && a.lvBoxState().every((x) => x.state === 'lock'), 'Lv1: 받을 봇짐 없음 · 다음은 Lv5');
    const b = mk(52, 23), W = b.S.wallet, t0 = W['ticket:gear'] || 0, s0 = W['item:stone'] || 0;
    ok(b.lvBoxCan() === 4 && b.lvBoxNext() === 25 && b.lvBoxClaim(25) === null && b.lvBoxClaim(12) === null, 'Lv23: 5 · 10 · 15 · 20 받기 · 25는 아직', b.lvBoxCan());
    const c = b.lvBoxClaim(10);
    ok(c && c.lv === 10 && W['ticket:gear'] - t0 === r10.give['ticket:gear'] && W['item:stone'] - s0 === r10.give['item:stone'] && c.gear && c.gear.g === r10.gear, 'Lv10 봇짐 → 뽑기권 · 강화석 · 장비 한 점', JSON.stringify(c));
    ok(b.lvBoxClaim(10) === null && b.lvBoxCan() === 3, '한 번만');
    const S = b.lvBoxState(); ok(S.find((x) => x.lv === 10).state === 'got' && S.find((x) => x.lv === 5).state === 'can' && S.find((x) => x.lv === 25).state === 'lock', '상태: 받음 · 받기 · 잠김');
    const l = Game.load(b.save(), T0); ok(l.S.lvBox.got.join() === '10' && l.lvBoxCan() === 3, '받은 봇짐은 저장된다');
    const o = b.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false });
    ok(b.lvBoxCan() === 0 && b.S.lvBox.got.length === 4 && o.claim >= 3, '자동 성장이 남은 봇짐을 받는다', o.claim);
    const old = mk(53, 42); delete old.S.lvBox; const ol = Game.load(old.save(), T0);
    ok(ol.lvBoxCan() === 8 && Array.isArray(ol.S.lvBox.got) && ol.lvBoxClaimAll().length === 8, '옛 세이브(봇짐 칸 없음) Lv42: 이미 지난 8개를 받을 수 있다'); }
}

console.log('\n=== v635 전서구 함(우편) — 선물 · 놓친 임무 · 현상수배 · 대결 주간 · 기한 · 개수 ===');
{
  const GM = await import('../js/s2/game.js'), ML = await import('../js/s2/tables/mail.js');
  const DAYMS = 24 * 3600e3, T0 = (GM.weekKey(1.8e12) + 7) * DAYMS - 9 * 3600e3 + 10 * 3600e3;   // 어느 월요일 10시(한국 시각)
  const mk = (seed = 5) => { const g = new Game(newGame('sword', T0, seed), T0); g.addExp(EX.cumExp(30)); g.tick(T0); return g; };
  const sumOf = (g, book, ids) => { const o = {}; for (const id of ids) for (const [k, n] of Object.entries(g.missionRew(book, id))) o[k] = (o[k] || 0) + n; return o; };
  const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  // 선물 — 한 번만(저장 · 불러오기 뒤에도) · 옛 세이브도 받는다
  { const g = mk(), L = g.mailList();
    ok(L.length === 1 && L[0].kind === 'gift' && same(L[0].rew, ML.MAIL_GIFTS[0].rew) && L[0].exp - L[0].at === 14 * DAYMS, '우편: 새 세이브에 환영 선물 한 통(14일)', JSON.stringify(L[0]));
    const w0 = { ...g.S.wallet }, r = g.mailClaim(L[0].id);
    ok(r && g.S.wallet['ticket:gear'] === w0['ticket:gear'] + 5 && g.S.wallet['item:stone'] === (w0['item:stone'] || 0) + 30 && g.mailCan() === 0, '우편: 받으면 지갑에 들어가고 지워진다');
    ok(g.mailClaim(L[0].id) === null && g.mailClaimAll() === null, '우편: 두 번 못 받음');
    const b = Game.load(g.save(), T0 + 1000); ok(b.signed && b.mailCan() === 0, '우편: 받은 선물은 불러와도 다시 오지 않는다');
    const S = JSON.parse(JSON.stringify(g.S)); delete S.mail; const o = new Game(S, T0);
    ok(o.mailCan() === 1 && o.mailList()[0].title === ML.MAIL_GIFTS[0].title, '우편: 우편함 없는 옛 세이브도 선물을 받는다');
    const c = Game.load(mk().save(), T0); ok(c.mailCan() === 1, '우편: 안 받은 선물은 불러와도 한 통 그대로'); }
  // 못 받은 일일 · 주간 임무 → 날 · 주가 바뀔 때 한 통씩(claimMission과 같은 셈)
  { const g = mk(); g.mailClaimAll(); g.emit('kill', { n: 600 }); for (let i = 0; i < 5; i++) g.emit('login');
    const dIds = g.books.daily.claimable(), wIds = g.books.weekly.claimable(), dSum = sumOf(g, 'daily', dIds), wSum = sumOf(g, 'weekly', wIds);
    ok(dIds.includes('d_kill') && dIds.includes('d_login') && wIds.includes('w_login'), '우편: 끝내고 안 받은 임무 준비', `${dIds} · ${wIds}`);
    // 같은 때 손으로 받았다면 — 은자 · 아이템이 셈과 같다
    { const h = Game.load(g.save(), g.now), w0 = { ...h.S.wallet }; for (const id of dIds) h.claimMission('daily', id);
      ok(h.S.wallet.gold - w0.gold === dSum.gold && Object.entries(dSum).filter(([k]) => k !== 'gold' && k !== 'exp').every(([k, n]) => h.S.wallet[k] - (w0[k] || 0) === n), 'missionRew = claimMission이 주는 은자 · 아이템', JSON.stringify(dSum)); }
    g.tick(T0 + 7 * DAYMS);   // 다음 주 월요일 — 날도 주도 바뀐다
    const L = g.mailList(), md = L.find((m) => m.title === ML.MAIL_TXT.daily(dIds.length)), mw = L.find((m) => m.title === ML.MAIL_TXT.weekly(wIds.length));
    ok(L.length === 2 && md && mw && same(md.rew, dSum) && same(mw.rew, wSum), '우편: 일일 · 주간 한 통씩 · 보상 = 그때 받았을 것', JSON.stringify(L.map((m) => m.rew)));
    ok(mw.rew['ticket:weapon'] === 5 && mw.rew.exp > 0 && mw.rew.gold > 0 && g.books.daily.claimable().every((id) => id === 'd_login'), '우편: 주간은 병기 뽑기권 5 · 경험치 · 은자 / 임무는 새로');
    const e0 = g.S.hero.exp, lv0 = g.S.hero.lv, w0 = { ...g.S.wallet }, all = g.mailClaimAll();
    ok(all && all.n === 2 && all.rew.gold === dSum.gold + wSum.gold && g.S.wallet.gold - w0.gold === all.rew.gold && (g.S.hero.lv > lv0 || g.S.hero.exp > e0) && g.mailCan() === 0, '우편: 모두 받기 = 합(경험치도 들어간다)', JSON.stringify(all));
    g.tick(T0 + 8 * DAYMS); ok(g.mailList().length === 1 && g.mailList()[0].rew.gold === g.missionRew('daily', 'd_login').gold, '우편: 다음 날 — 오늘 접속(받지 않음) 한 통'); }
  // 현상수배 — 끝내고 안 받은 것 · 상자 → 다음 날 한 통
  { const g = mk(); g.mailClaimAll(); const B = g.bountySt(); for (const x of B.list) { x.n = x.need; x.done = true; } g.bountyClaim(0);
    const exp = {}; const add = (k, n) => { exp[k] = (exp[k] || 0) + n; };
    for (const x of B.list.slice(1)) { add('gold', g.bountyGold()); add(x.rew.k, x.rew.n); } for (const [k, n] of Object.entries(g.bountyChestGive(B))) add(k, n);
    g.tick(T0 + DAYMS); g.bountySt(); const m = g.mailList().find((x) => x.title === ML.MAIL_TXT.bounty(3));
    ok(m && same(m.rew, exp), '우편: 현상수배 남은 둘 + 상자 → 한 통(같은 셈)', JSON.stringify(m?.rew));
    g.mailClaimAll(); g.tick(T0 + 2 * DAYMS); g.bountySt(); ok(!g.mailList().some((x) => x.title.includes('현상수배')), '우편: 아무것도 안 끝낸 날은 현상수배 우편 없음'); }
  // 대결 주간 — 지난주 보상을 안 받은 채 한 주가 더 지나면(덮어쓰기 전) 우편으로
  { const g = mk(), wk = GM.weekKey(T0); g.mailClaimAll();
    g.S.pvp = { score: 1000, day: '', used: 0, log: [], wk: wk - 7, wkBest: 1100, lastWk: wk - 14, lastBest: 1500 };
    const want = g.pvpTierRew(1500); g.pvpMark(); const m = g.mailList()[0];
    ok(m && m.kind === 'week' && m.rew['ticket:gear'] === want.tix && m.title === ML.MAIL_TXT.pvp(want.tier), '우편: 못 받은 지난 대결 주간 → 우편', JSON.stringify(m));
    const r = g.claimPvpWeek(); ok(r && r.wk === wk - 7 && r.tix === g.pvpTierRew(1100).tix && g.mailCan() === 1, '우편: 바로 지난주 것은 대결 창에서 그대로 받는다');
    g.mailClaimAll(); g.S.pvp.wk = wk - 7; g.pvpMark(); ok(g.mailCan() === 0, '우편: 받은 주는 다시 오지 않는다'); }
  // 기한 · 개수 · 자동 성장
  { const g = mk(); const id = g.mailList()[0].id;
    g.now = T0 + 14 * DAYMS; ok(g.mailCan() === 1, '우편: 14일째까지는 남는다');
    g.now = T0 + 14 * DAYMS + 1; ok(g.mailCan() === 0 && g.mailClaim(id) === null, '우편: 14일이 지나면 사라진다(보상도)');
    g.now = T0; for (let i = 0; i < 70; i++) g.mailPush('gift', `t${i}`, { gold: 1 });
    const L = g.mailList(); ok(L.length === ML.MAIL_MAX && L[0].title === 't69' && L[L.length - 1].title === 't10', '우편: 60통까지 — 오래된 것부터 버린다', `${L.length} · ${L[L.length - 1].title}`);
    ok(g.mailPush('gift', '빈', { gold: 0 }) === null && g.mailCan() === 60, '우편: 빈 보상은 보내지 않는다');
    const h = mk(); h.S.wallet['ticket:gear'] = 0; const n0 = h.mailCan(); h.autoGrow(); ok(n0 === 1 && h.mailCan() === 1, '우편: 자동 성장은 우편을 받지 않는다'); }
  // 결정론 — 우편은 난수를 쓰지 않는다 · 같은 세이브는 같은 우편
  { const a = mk(7), b = mk(7), r0 = JSON.stringify(a.rng.state()); a.mailList(); a.mailClaimAll(); a.mailMissed('daily'); a.mailBounty(a.bountySt());
    ok(JSON.stringify(a.rng.state()) === r0, '우편: 난수를 쓰지 않는다');
    for (const x of [a, b]) { x.emit('kill', { n: 600 }); x.tick(T0 + DAYMS); }
    ok(JSON.stringify(a.S.mail.list.slice(-1)) === JSON.stringify(b.S.mail.list.slice(-1)), '우편: 같은 놀이는 같은 우편');
    const src = fs.readFileSync(new URL('../js/s2/tables/mail.js', import.meta.url), 'utf8'); ok(!/Math\.random|Date\.now/.test(src), '우편 표: Math.random · Date.now 없음'); }
}

console.log('\n=== v636 강호 축제 — 달력 · 축제 물건 · 임무 · 교환소 · 축제 두목 · 주말 대란 ===');
{
  const FT = await import('../js/s2/tables/fest.js'), { FEST, FESTS, festAt, festWeekend, dkMs, FEST_SHOP, FEST_DAILY, FEST_TOTAL, FEST_BOSS, festGrade } = FT;
  const DAYMS = 86400e3, SAT = Date.UTC(2026, 10, 21, 3), MON = Date.UTC(2026, 10, 23, 3);   // 한국 낮 12시
  const mk = (t, seed = 1, lv = 0) => { const a = new Game(newGame('sword', t, seed), t); if (lv) { a.S.hero.lv = lv; a.dirtyStats = true; } return a; };
  // 달력 — 날마다 축제 중이거나 다음 축제까지 남은 날이 있다 · 21일 중 14일 · 네 축제가 차례로 · 주말은 토 · 일(한국 시각)
  { let onN = 0, gap = 0, rot = true; const d0 = dayKey(SAT);
    for (let d = d0 - 400; d < d0 + 400; d++) { const A = festAt(d); if (A.on) onN++; else if (!(A.nextDk > d && A.nextDk - d <= FEST.len - FEST.on)) gap++; if (A.day < 0 || A.day >= FEST.len) gap++;
      if (A.day === 0 && FESTS.indexOf(festAt(d - 1).next) !== FESTS.indexOf(A.fest)) rot = false; }
    ok(gap === 0 && Math.abs(onN / 800 - FEST.on / FEST.len) < 0.02 && rot, '달력 — 늘 축제 중이거나 다음 축제까지 7일 안 · 21일 중 14일 · 네 축제가 차례로', `${onN}/800`);
    let wk = true; for (let i = 0; i < 14; i++) { const t = SAT + i * DAYMS, w = new Date(t + 9 * 3600e3).getUTCDay(); if (festWeekend(dayKey(t)) !== (w === 0 || w === 6)) wk = false; }
    ok(wk && festWeekend(dayKey(SAT)) && !festWeekend(dayKey(MON)), '주말 대란 = 토 · 일(한국 시각)');
    ok(festAt(dayKey(SAT)).on && festAt(dayKey(SAT)).fest.id === 'lantern', '2026-11-21: 등불 축제 중'); }
  // 옛 세이브 — fest 칸이 없어도 열린다 · 처음 부를 때 생긴다
  { const a = mk(SAT, 61); delete a.S.fest; const l = Game.load(a.save(), SAT);
    ok(!l.S.fest && l.festInfo().on && l.S.fest && l.S.fest.fc === 0 && l.festCan() === 0, '옛 세이브(축제 칸 없음) — 처음 부를 때 생긴다'); }
  // 사냥 축제 물건 — 같은 씨앗이면 같은 수(무작위 없음) · 하루 상한 · 주말 +20%
  const huntMin = (a, t, min) => { for (let m = 0; m < min; m++) { a.tick(t + m * 60e3); a.hunt(60e3); } };
  { const a = mk(MON, 62, 30), b = mk(MON, 62, 30); let pts = 0; const fk = a.festKill.bind(a); a.festKill = (kind) => { pts += kind === 'boss' ? 20 : kind === 'elite' ? 5 : 1; return fk(kind); };
    huntMin(a, MON, 20); huntMin(b, MON, 20);
    const k = a.S.kills, fc = a.festSt().fc;
    ok(fc === b.festSt().fc && fc === Math.floor(pts / FEST.dropPer) && fc > 0, `사냥 — 몹 ${FEST.dropPer}마리 몫(정예 5 · 두목 20)마다 축제 물건 하나 · 같은 씨앗 같은 수`, `처치 ${k} · 몫 ${pts} · 물건 ${fc}`);
    const m2 = mk(MON, 69, 30), w = mk(SAT, 69, 30); let pm = 0, pw = 0; for (const [x, f] of [[m2, (v) => { pm += v; }], [w, (v) => { pw += v; }]]) { const fk2 = x.festKill.bind(x); x.festKill = (kind) => { f(kind === 'boss' ? 20 : kind === 'elite' ? 5 : 1); return fk2(kind); }; }
    huntMin(m2, MON, 50); huntMin(w, SAT, 50); const r = (w.festSt().fc / pw) / (m2.festSt().fc / pm);
    ok(w.festSt().fc < FEST.dayCap && Math.abs(w.festSt().fc - Math.floor(pw * 1.2 / FEST.dropPer)) <= 1 && r > 1.1 && r < 1.3, '주말 대란 — 축제 물건 +20%', `${r.toFixed(3)} · ${m2.festSt().fc} / ${w.festSt().fc}`);
    const c = mk(MON, 63, 30); huntMin(c, MON, 150); ok(c.festSt().fc === FEST.dayCap && c.festSt().hn === FEST.dayCap, `하루 상한 ${FEST.dayCap}개`, `${c.festSt().fc} · 처치 ${c.S.kills}`);
    c.tick(MON + DAYMS); ok(c.festSt().hn === 0 && c.festSt().fc === FEST.dayCap, '다음 날 — 오늘 상한은 다시 0 · 모은 물건은 그대로'); }
  // 주말 대란 은자 +10% — 같은 처치면 은자가 1.1배
  { const a = mk(SAT, 64, 30), b = mk(MON, 64, 30); for (const x of [a, b]) Object.assign(x.stage(), { idx: 30, top: 30 }); ok(a.festGoldP() === FEST.wkGold && b.festGoldP() === 0, '대란 은자 ‰ — 토요일 100 · 월요일 0');
    const g0 = a.S.wallet.gold, g1 = b.S.wallet.gold; huntMin(a, SAT, 5); huntMin(b, MON, 5);
    const pa = (a.S.wallet.gold - g0) / a.S.kills, pb = (b.S.wallet.gold - g1) / b.S.kills; ok(pa / pb > 1.08 && pa / pb < 1.12, '몹 하나 은자 — 주말 ≈ ×1.1', (pa / pb).toFixed(3)); }
  // 쉬는 주 — 물건이 안 떨어지고 두목은 닫힘 · 교환소는 열림 · 다음 축제가 열리면 물건 · 교환 수가 새로
  { const A0 = festAt(dayKey(SAT)), rest = dkMs(A0.endDk) + 3 * 3600e3, a = mk(SAT, 65, 30);
    a.festSt().fc = 500; a.festBuy('gear', 2); a.tick(rest); const fc0 = a.festSt().fc, L0 = FEST_SHOP[0].limit, C0 = FEST_SHOP[0].cost; huntMin(a, rest, 10);
    ok(!a.festInfo().on && a.festSt().fc === fc0 && a.canDungeon('fest') === '축제 때만 나와요' && a.festShopState()[0].left === L0 - 2 && a.festBuy('gear') && a.festSt().fc === fc0 - C0, '쉬는 주 — 물건 안 떨어짐 · 두목 닫힘 · 교환소 열림(산 수 이어짐)');
    a.tick(dkMs(A0.nextDk) + 3600e3); ok(a.festInfo().on && a.festInfo().fest.id === A0.next.id && a.festSt().fc === 0 && a.festShopState()[0].left === L0, '다음 축제 — 새 물건 · 교환 수 새로', a.festInfo().fest.name); }
  // 교환소 — 값 · 한 축제 살 수 · 모자라면 안 됨
  { const a = mk(SAT, 66, 30), W = a.S.wallet; ok(a.festBuy('gear') === null, '물건이 없으면 못 산다');
    const SG = FEST_SHOP.find((x) => x.id === 'gear'), SW = FEST_SHOP.find((x) => x.id === 'weapon');
    a.festSt().fc = 10000; const t0 = W['ticket:gear'] || 0, r = a.festBuy('gear', SG.limit);
    ok(r && W['ticket:gear'] - t0 === SG.limit && a.festSt().fc === 10000 - SG.cost * SG.limit && a.festBuy('gear') === null, `장비 뽑기권 ${SG.limit}장까지(${SG.cost}개씩)`);
    ok(a.festBuy('weapon', SW.limit + 1) === null && a.festBuy('weapon', SW.limit) && a.festBuy('nope') === null && a.festBuy('stone', 0) === null, '살 수를 넘기거나 없는 물건 · 0개는 안 됨');
    const tot = FEST_SHOP.reduce((s, x) => { for (const [k, n] of Object.entries(x.give)) s[k] = (s[k] || 0) + n * x.limit; return s; }, {}), cost = FEST_SHOP.reduce((s, x) => s + x.cost * x.limit, 0);
    ok(tot['ticket:gear'] <= 12 && tot['ticket:weapon'] <= 1 && tot['ticket:pal'] <= 1 && tot['ticket:relic'] <= 1 && tot['item:stone'] <= 160 && (tot['ticket:time'] || 0) <= 1, '교환소를 다 사도 작다 — 축제(3주)마다 장비 뽑기권 12 · 병기 · 동료 · 영물 1씩 · 강화석 160 · 시간 티켓 1', JSON.stringify(tot) + ` · ${cost}개`);
    const l = Game.load(a.save(), SAT); ok(l.festShopState().find((x) => x.id === 'gear').left === 0 && l.festSt().fc === a.festSt().fc, '산 수 · 물건은 저장된다'); }
  // 축제 두목 — 하루 한 번 · 쓰러지지 않음 · 점수 · 등급 보상 · 내일 다시
  { const a = mk(SAT, 67, 40), fc0 = a.festSt().fc; ok(a.canDungeon('fest') === '', '축제 중 — 두목 열림');
    const r = a.runNow('fest');
    ok(r && r.cleared && r.dmg > 0 && r.score > 0 && FEST_BOSS.grades.some((x) => x.g === r.grade) && a.festSt().fc - fc0 === r.fc && r.fc === festGrade(r.dmg / a.festBossRef(40)).fc, '두목 — 60초 · 넣은 피해 = 점수 · 등급마다 축제 물건', `피해 ${r.dmg} · 점수 ${r.score} · ${r.grade} · +${r.fc}`);
    ok(r.ms >= FEST_BOSS.ms && a.festSt().best === r.score && a.festSt().bestG === r.grade, '시간 끝까지 싸움 · 최고 점수 기록');
    ok(a.canDungeon('fest') === '오늘은 다 했어요' && a.runNow('fest') === null, '하루 한 번');
    a.tick(SAT + DAYMS); ok(a.canDungeon('fest') === '' && a.festInfo().bossLeft === 1, '다음 날 다시');
    ok(festGrade(0).g === 'C' && festGrade(1).g === 'B' && festGrade(99).g === 'SS' && FEST_BOSS.grades.every((x) => x.fc <= 30 && (x.tix || 0) <= 1), '등급 C~SS · 보상은 축제 물건 30개 · 뽑기권 1장 안'); }
  // 축제 임무 — 엔진 사건으로 오른다 · 받으면 축제 물건 · 날마다 새로 · 자동 성장이 받는다
  { const a = mk(MON, 68, 30); a.emit('login'); huntMin(a, MON, 15); const B = a.festBk();
    ok(B.fd.get('fd1').done && a.festCan() >= 1, '몹 300마리 → 일일 축제 임무 끝', `${a.S.kills}`);
    ok(B.ft.get('ft3').p === Math.min(5000, a.S.kills) && B.ft.get('ft4').p === a.festSt().got, '축제 내내 임무 — 처치 · 사냥으로 얻은 물건 수가 그대로 쌓인다');
    const fc0 = a.festSt().fc, r = a.festClaim('fd', 'fd1'); ok(r && a.festSt().fc - fc0 === FEST_DAILY[0].rew.fc && a.festClaim('fd', 'fd1') === null, `받기 — 축제 물건 ${FEST_DAILY[0].rew.fc} · 한 번만`);
    a.runNow('fest'); ok(B.fd.get('fd3').done && B.ft.get('ft2').p === 1, '두목 도전 → 일일 · 축제 내내 임무');
    const o = a.autoGrow({ daily: false, pull: false, coll: false, kit: false, enh: false, train: false, stat: false }); ok(a.festCan() === 0 && o.claim >= 1, '자동 성장이 축제 임무를 받는다', o.claim);
    a.tick(MON + DAYMS); ok(!a.festBk().fd.get('fd1').done && a.festBk().fd.get('fd1').p === 0 && a.festBk().ft.get('ft3').p > 0, '다음 날 — 일일은 새로 · 축제 내내는 그대로');
    a.attend(); ok(a.festBk().ft.get('ft1').p === 2, '접속 날 수 — 하루 한 번(출석과 날 바뀜이 겹쳐도)', a.festBk().ft.get('ft1').p);
    const dSum = FEST_DAILY.reduce((s, x) => s + x.rew.fc, 0), tSum = FEST_TOTAL.reduce((s, x) => s + (x.rew['ticket:gear'] || 0), 0);
    const earn = FEST.on * (FEST.dayCap + dSum + FEST_BOSS.grades[2].fc) + FEST_TOTAL.reduce((s, x) => s + x.rew.fc, 0), cost = FEST_SHOP.reduce((s, x) => s + x.cost * x.limit, 0);
    ok(dSum <= 40 && tSum <= 3, '임무 보상은 작다 — 일일 합 40개 안 · 축제 내내 뽑기권 3장 안', `${dSum} · ${tSum}`);
    ok(earn >= cost * 0.9 && earn <= cost * 1.3, '교환소를 다 사려면 축제 14일을 꽉 채워야 한다(하루 상한 · 임무 · 두목 A)', `벌이 ${earn} · 값 ${cost}`); }
  // 결정론 — js/s2 안에서 Math.random · Date.now를 쓰지 않는다(축제 표 · 엔진)
  { const src = fs.readFileSync(new URL('../js/s2/tables/fest.js', import.meta.url), 'utf8'); ok(!/Math\.random|Date\.now/.test(src), '축제 표에 Math.random · Date.now 없음'); }
}

console.log('\n=== S0 규칙 ===');
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('../js/s2', import.meta.url).pathname);
  const code = (p) => fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 주석은 빼고
  const bad = files.filter((p) => !p.includes('/js/s2/ui/')).filter((p) => /Math\.random|Date\.now|performance\.now/.test(code(p)));
  ok(bad.length === 0, 'js/s2 엔진(화면 js/s2/ui 빼고)은 Math.random·Date.now·performance.now를 쓰지 않는다(결정론)', bad.join(' '));
  const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), old = fs.readFileSync(new URL('../classic.html', import.meta.url), 'utf8');
  ok(/js\/s2\/ui\/app\.js/.test(idx) && /js\/wmain\.js|js\/boot\.js/.test(old) && !/js\/s2\//.test(old), 'v524 교체: 첫 화면(index.html)은 새 시즌 · 옛 게임은 classic.html');
  ok(/location\.replace\('\.\/'/.test(fs.readFileSync(new URL('../s2.html', import.meta.url), 'utf8')), '옛 주소 s2.html(?s2=1)은 첫 화면으로 이어 준다');
  ok(/정한 것 \(2026-11-14\)/.test(fs.readFileSync(new URL('../docs/새시즌_계획.md', import.meta.url), 'utf8')), '계획서가 있다');
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail ? 1 : 0);
