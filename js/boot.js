// v266 로딩 · 로그인 화면 — index.html의 #boot를 움직인다.
//
// 로딩: 막대를 단계마다 채운다(글꼴 → 그림 → 서버). 오래 걸려도 정해 둔 시간이 지나면 넘어간다 — 서버가 안 되면 오프라인으로 한다.
// 로그인: Google로 한 번 들어오면 Firebase가 그 로그인을 기기에 기억한다(다음부터는 이 화면이 안 뜬다).
//   손님으로 고르면 그것도 기억한다(설정 → 앱·계정에서 언제든 Google을 이을 수 있다).
import { h } from './ui/common.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TIPS = [
  '앱을 꺼 두어도 무인은 사냥을 이어 가요 — 돌아오면 방치 보상을 받아요.',
  '두목은 체력이 낮을수록 위험해요. 자동 물약 체력을 높여 두면 든든해요.',
  '혈겁(12~14시 · 20~22시)엔 은자와 재료가 더 나와요.',
  '증표로 각인하면 두목의 힘이 장비에 깃들어요.',
  '문파에 들면 함께 십이지왕을 잡을 수 있어요.',
  '일일 던전은 하루 세 번 — 소탕으로도 돌 수 있어요.',
  'Google로 들어오면 기기를 바꿔도 진행이 이어져요.',
];

let pct = 0;
let tipTimer = 0;
export const LOGIN_KEY = 'ifu.login';
export function loginPref() { try { return localStorage.getItem(LOGIN_KEY) || ''; } catch { return ''; } }
export function setLoginPref(v) { try { if (v) localStorage.setItem(LOGIN_KEY, v); else localStorage.removeItem(LOGIN_KEY); } catch { /* 사생활 모드 */ } }

export function bootStart(ver) {
  window.__bootTaken = true;
  clearInterval(window.__bootCreep);
  if ($('boot-ver')) $('boot-ver').textContent = ver || '';
  let i = Math.floor(Math.random() * TIPS.length);
  const tip = $('boot-tip');
  const show = () => {
    if (!tip) return;
    tip.style.opacity = '0';
    setTimeout(() => { tip.textContent = `💡 ${TIPS[i++ % TIPS.length]}`; tip.style.opacity = '1'; }, 250);
  };
  show();
  tipTimer = setInterval(show, 3600);
}
export function bootProgress(p, msg) {
  pct = Math.max(pct, Math.min(1, p));
  const f = $('boot-fill');
  if (f) f.style.width = `${Math.round(8 + 92 * pct)}%`;
  if (msg != null && $('boot-msg')) $('boot-msg').textContent = msg;
}
// 조건이 맞을 때까지(또는 ms가 지날 때까지) 기다린다
export async function waitFor(fn, ms, step = 80) {
  const t0 = performance.now();
  while (!fn() && performance.now() - t0 < ms) await sleep(step);
  return fn();
}
export function bootHide() {
  clearInterval(tipTimer);
  const b = $('boot');
  if (!b) return;
  b.classList.add('out');
  setTimeout(() => b.classList.add('gone'), 500);
}
export function bootShown() { const b = $('boot'); return !!b && !b.classList.contains('out'); }

// ---------- 로그인 ----------
const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

// 앱 안 브라우저(카카오톡·인스타·페이스북·네이버·라인)에선 Google이 로그인을 막는다
export function inAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return 'other';
  return '';
}
export function standalone() {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
}
function openOutside() {
  const url = location.href.split('#')[0];
  if (inAppBrowser() === 'kakao') { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`; return; }
  if (/Android/i.test(navigator.userAgent)) {
    location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  }
}
function outsideHint() {
  const kind = inAppBrowser();
  if (!kind) return null;
  const canJump = kind === 'kakao' || /Android/i.test(navigator.userAgent);
  return h('p', { class: 'login-hint' }, '앱 안 브라우저(카카오톡 등)에선 Google 로그인이 막혀요. 크롬·사파리로 열어 주세요. ',
    canJump ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); openOutside(); } }, '바깥 브라우저로 열기') : '');
}

// opts: { onGoogle(), onGuest(), online }
// 돌려주는 것: { busy(msg), error(msg, help, code), pick(nodes...), reset() }
export function showLogin(opts) {
  const box = $('boot-login');
  $('boot-load')?.classList.add('hidden');
  box.classList.remove('hidden');
  const gBtn = h('button', { class: 'login-google', id: 'login-google', disabled: opts.online ? null : true });
  gBtn.innerHTML = `${G_LOGO}<span>Google로 시작하기</span>`;
  const guestBtn = h('button', { class: 'login-guest', id: 'login-guest' }, '손님으로 시작하기');
  const msg = h('div', {});
  const note = h('p', { class: 'login-note' }, opts.online
    ? 'Google로 들어오면 진행이 서버에도 저장돼, 기기를 바꾸거나 브라우저를 지워도 이어 해요. 한 번 들어오면 다음부턴 바로 시작해요.'
    : '지금은 오프라인이라 Google로 들어올 수 없어요. 손님으로 시작하고, 나중에 설정 → 앱·계정에서 이을 수 있어요.');
  const base = [gBtn, guestBtn, note];
  const hint = outsideHint();
  box.replaceChildren(...(hint ? [hint] : []), msg, ...base);
  gBtn.onclick = () => opts.onGoogle();
  guestBtn.onclick = () => opts.onGuest();
  const ctl = {
    busy(text) {
      gBtn.disabled = true; guestBtn.disabled = true;
      msg.replaceChildren(h('p', { class: 'login-busy' }, text));
    },
    error(text, help, code) {
      gBtn.disabled = !opts.online; guestBtn.disabled = false;
      msg.replaceChildren(h('p', { class: 'login-err' }, text,
        help ? h('small', {}, help) : '',
        code ? h('small', {}, '오류 코드: ', h('code', {}, code)) : ''));
    },
    // 고르기(이미 다른 진행에 이어진 Google 등) — 버튼 줄을 이 내용으로 바꾼다
    pick(...nodes) { box.replaceChildren(...nodes); },
    reset() { box.replaceChildren(...(hint ? [hint] : []), msg, ...base); gBtn.disabled = !opts.online; guestBtn.disabled = false; msg.replaceChildren(); },
  };
  return ctl;
}
