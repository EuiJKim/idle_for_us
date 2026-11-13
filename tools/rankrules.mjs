// v476 서열 점검 기준 — 서버(GitHub Actions의 tools/rankcheck.mjs)와 시험(tests/world.mjs)이 같이 쓴다.
// 기기가 올린 서열 값(players · wboss)을 서버 쪽 사실(계정 만든 때 · 서버 세이브 · 같은 레벨 기준 무인)과 견준다.
// 걸리면 서열에서만 숨긴다(게임은 그대로 한다). 운영자가 「무인 정리 → 되살리기」로 풀면 다시 숨기지 않는다.
// 기준은 넉넉하게 — 옛 판(하루 Lv140까지 가던 때)에 큰 무인, 신화 동료를 갖춘 무인도 걸리지 않게.

export const POWER_K = 8;       // 같은 레벨 기준 무인 전투력의 8배 넘게 (지금 판 하루 꽉 채워도 1.45배 · 옛 판 신화 동료 2.3배)
export const PROFILE_K = 2;     // 서버 세이브로 다시 센 전투력의 2배 넘게
export const LV_SLACK = 3;      // 서버 세이브보다 레벨이 이만큼 넘게 높으면
export const SAVE_FRESH = 30 * 60e3;   // 세이브와 서열 값이 이만큼 안에 올라왔을 때만 견준다(세이브는 몇 분에 한 번 올라간다)
export const WB_MIN_SEC = 3;    // 주간 두목 하나 잡는 데 가장 짧은 초(js/world/wdata.js WBOSS_MIN_SEC)

// 계정 나이(시간)로 닿을 수 있는 가장 높은 레벨
export function maxLvAt(ageH) {
  if (!(ageH >= 0)) return Infinity;   // 모르면 보지 않는다
  if (ageH < 1) return 60;
  if (ageH < 6) return 110;
  return Infinity;   // 옛 판엔 하루면 만렙 가까이 갔다 — 그 뒤로는 만렙(lvMax)만 본다
}

// p: 서열 문서 · ageH: 계정 나이(시간, 모르면 null) · ref: 같은 레벨 기준 무인 전투력(모르면 null)
// save: 서버 세이브로 다시 센 값 { lv, power, at(ms) } (없으면 null) · profAt: 서열 문서 올린 때(ms)
// 돌려주는 것: 걸린 까닭 글자 목록(비면 깨끗)
// lvMax: 게임 만렙(js/world/wdata.js LEVEL_MAX) — 넘으면 바로 걸린다
export function judgePlayer({ p, ageH = null, ref = null, save = null, profAt = null, lvMax = Infinity }) {
  const why = [];
  const lv = Number(p.level) || 0, power = Number(p.power) || 0;
  if (lv > lvMax) why.push(`lv>max:${lv}`);
  const cap = maxLvAt(ageH ?? NaN);
  if (lv > cap) why.push(`age:Lv${lv}>${cap}@${Math.round(ageH)}h`);
  if (ref > 0 && power > ref * POWER_K) why.push(`power:${(power / ref).toFixed(1)}x`);
  if (save && profAt && Math.abs(profAt - save.at) <= SAVE_FRESH) {
    if (lv > save.lv + LV_SLACK) why.push(`save-lv:${lv}>${save.lv}`);
    if (save.power > 0 && power > save.power * PROFILE_K) why.push(`save-power:${(power / save.power).toFixed(1)}x`);
  }
  return why;
}

// 주간 두목 기록 — weekSec: 이번 주가 열린 뒤 지난 초
export function judgeWeekBoss({ r, weekSec }) {
  const why = [];
  const kills = Number(r.kills) || 0;
  if (weekSec > 0 && kills > 1 + weekSec / WB_MIN_SEC) why.push(`wb-kills:${kills}`);
  for (const k of ['hwamugi', 'magwi', 'awk']) if (r[k] != null && !(r[k] >= WB_MIN_SEC)) why.push(`wb-${k}:${r[k]}`);
  return why;
}
