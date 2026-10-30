// 앱처럼 (v159) — 링크로 들어와도 주소창 없이 게임 화면만 보이게, 오래 켜 두어도 배터리를 덜 먹게.
//
//   설치      안드로이드 크롬은 'beforeinstallprompt'를 잡아 두었다가 단추로 띄운다. 아이폰 사파리는
//             띄울 수가 없어서 '공유 → 홈 화면에 추가'를 알려 준다. 설치한 앱은 manifest의 fullscreen으로 열린다.
//   전체 화면  설치하지 않은 브라우저에서도 단추 하나로 (아이폰 사파리는 막혀 있어 홈 화면 추가를 권한다).
//   절전      검은 화면에 숫자만. 그리기를 멈추고 계산은 1초에 다섯 번만 한다. 화면이 꺼지지 않게 잡아 두고(Wake Lock),
//             글자는 1분마다 자리를 옮긴다(화면 자국). 손대지 않은 채 정해 둔 시간이 지나면 저절로 들어간다.
const KEY_SAVER = 'ifu.saver';            // 저절로 절전까지 분 (0 = 끔)
const KEY_HINT = 'ifu.installHint';       // 설치 안내를 닫은 때
export const SAVER_MINS = [0, 1, 3, 10];

let deferred = null;                      // 안드로이드 설치 창
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; });

export const isStandalone = () => !!(window.matchMedia?.('(display-mode: fullscreen)').matches
  || window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canInstall = () => !!deferred;
// 앱 안 브라우저(카카오톡·네이버·인스타·밴드…)는 웹앱을 설치할 수 없다 — 친구에게 카톡으로 보낸 링크가 대개 이렇게 열린다 (v174)
export const inAppName = () => {
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  if (/NAVER\(inapp|NAVER\//i.test(ua)) return '네이버 앱';
  if (/Instagram/i.test(ua)) return '인스타그램';
  if (/FBAN|FBAV/i.test(ua)) return '페이스북';
  if (/BAND\//i.test(ua)) return '밴드';
  if (/Line\//i.test(ua)) return '라인';
  if (/DaumApps/i.test(ua)) return '다음 앱';
  if (/everytimeApp/i.test(ua)) return '에브리타임';
  return null;
};
// 바깥 브라우저로 다시 열기 — 카카오톡은 제 주소로, 안드로이드는 크롬으로. 아이폰 다른 앱은 직접(… → Safari로 열기)
export function openExternal() {
  const url = location.href;
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`; return true; }
  if (/Android/i.test(ua)) { location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`; return true; }
  return false;
}
export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  return r?.outcome === 'accepted';
}

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
export const canFullscreen = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export const isFullscreen = () => !!fsEl();
export async function toggleFullscreen() {
  try {
    if (fsEl()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return false; }
    const el = document.documentElement;
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen());
    try { await screen.orientation?.lock?.('portrait'); } catch { /* 안 되는 기기 */ }
    return true;
  } catch { return false; }
}

// ---------- 화면 켜 두기 ----------
let lock = null;
let wantAwake = false;
export async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener?.('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
// 다른 앱에 다녀오면 풀린다 — 돌아오면 다시 잡는다
document.addEventListener('visibilitychange', () => { if (!document.hidden && wantAwake) keepAwake(true); });

export function saverMins() { try { const v = Number(localStorage.getItem(KEY_SAVER)); return SAVER_MINS.includes(v) && localStorage.getItem(KEY_SAVER) != null ? v : 3; } catch { return 3; } }
export function setSaverMins(v) { try { localStorage.setItem(KEY_SAVER, String(v)); } catch { /* 이번만 */ } }
export function hintClosed() { try { return !!localStorage.getItem(KEY_HINT); } catch { return true; } }
export function closeHint() { try { localStorage.setItem(KEY_HINT, String(Date.now())); } catch { /* 이번만 */ } }

// ---------- 절전 화면 ----------
// info(): 1초마다 다시 읽는다 (v179)
//   { clock, date, who, where, bars: [[이름, 0~1, 글, 색]], rates: [[이름, 값]], session: [[이름, 값]], loot: [글], warns: [글] }
// 주머니 속에서 저절로 깨지 않게 **두 번 눌러야** 돌아간다(한 번 누르면 안내가 밝아진다).
export class Saver {
  constructor(root, info) {
    this.on = false;
    this.idle = 0;
    this.info = info;
    this.armT = 0;
    this.onEnter = null;
    this.el = document.createElement('div');
    this.el.id = 'saver';
    this.el.className = 'hidden';
    this.box = document.createElement('div');
    this.box.className = 'saver-box';
    this.tip = document.createElement('div');
    this.tip.className = 'saver-tip';
    this.el.append(this.box, this.tip);
    root.append(this.el);
    // 두 번 누르면 깬다 (눌림이 아래 들판으로 새지 않게 여기서 멈춘다)
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (this.armT > 0) { this.exit(); return; }
      this.armT = 2;
      this.paintTip();
    });
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { this.idle = 0; }, { capture: true, passive: true });
    this.t = 0;
    this.moveT = 0;
  }
  enter() {
    if (this.on) return;
    this.on = true;
    this.armT = 0;
    this.onEnter?.();
    this.el.classList.remove('hidden');
    this.box.style.transform = '';
    this.paint();
    this.paintTip();
    keepAwake(true);
    navigator.getBattery?.().then((b) => { this.battery = b; }).catch(() => {});
  }
  exit() {
    if (!this.on) return;
    this.on = false;
    this.idle = 0;
    this.el.classList.add('hidden');
    keepAwake(false);
  }
  // 바깥 고리가 dt마다 부른다. 저절로 들어갈 때가 되면 true
  tick(dt, canAuto) {
    if (this.on) {
      this.t += dt; this.moveT += dt;
      if (this.armT > 0) { this.armT -= dt; if (this.armT <= 0) this.paintTip(); }
      if (this.t >= 1) { this.t = 0; this.paint(); }
      if (this.moveT >= 60) { this.moveT = 0; this.drift(); }
      return false;
    }
    this.idle += dt;
    const m = saverMins();
    // 자동 시험(브라우저를 프로그램이 몰 때)에서는 저절로 들어가지 않는다 — 검은 막이 누름을 가로챈다
    if (m && canAuto && !navigator.webdriver && this.idle >= m * 60) { this.enter(); return true; }
    return false;
  }
  paintTip() {
    this.tip.classList.toggle('armed', this.armT > 0);
    this.tip.textContent = this.armT > 0 ? '한 번 더 누르면 돌아가요' : '절전 중 · 사냥은 계속돼요 — 두 번 누르면 돌아가요';
  }
  paint() {
    const d = this.info();
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const kv = (rows, cls = 'saver-row') => rows.map(([k, v]) => { const r = el('div', cls); r.append(el('span', '', k), el('b', '', v)); return r; });
    const out = [];
    const top = el('div', 'saver-top');
    top.append(el('div', 'saver-clock', d.clock));
    const bat = this.battery ? ` · 🔋${Math.round(this.battery.level * 100)}%${this.battery.charging ? '⚡' : ''}` : '';
    top.append(el('div', 'saver-date', `${d.date || ''}${bat}`));
    out.push(top, el('div', 'saver-who', d.who), el('div', 'saver-where', d.where));
    for (const [k, r, v, col] of d.bars || []) {
      const b = el('div', 'saver-bar');
      const lab = el('div', 'saver-bar-lab'); lab.append(el('span', '', k), el('b', '', v));
      const tr = el('div', 'saver-bar-tr'); const fill = el('i'); fill.style.width = `${Math.max(0, Math.min(1, r)) * 100}%`; fill.style.background = col; tr.append(fill);
      b.append(lab, tr); out.push(b);
    }
    if (d.rates?.length) out.push(...kv(d.rates));
    if (d.session?.length) { out.push(el('div', 'saver-sec', '이번 절전 동안')); out.push(...kv(d.session, 'saver-row sess')); }
    if (d.loot?.length) { const l = el('div', 'saver-loot'); for (const t of d.loot) l.append(el('div', '', t)); out.push(l); }
    for (const w of d.warns || []) out.push(el('div', 'saver-warn', w));
    this.box.replaceChildren(...out);
  }
  drift() {
    const x = Math.round((Math.random() - 0.5) * 60), y = Math.round((Math.random() - 0.5) * 160);
    this.box.style.transform = `translate(${x}px, ${y}px)`;
  }
}
