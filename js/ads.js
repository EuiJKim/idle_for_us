// 광고. **지금은 흉내만 낸다** — 5초 기다리는 가짜 화면이다.
//
// 친구끼리 하는 GitHub Pages 게임이라 실제 광고망을 붙일 수 없다
// (AdSense는 도메인·승인이 필요하고 '보면 보상' 방식은 정책 위반이다).
// 나중에 진짜로 붙일 때 **showAd 하나만** 갈아 끼우면 되게 해 뒀다.
// 부르는 쪽은 '광고 한 편 보여 주고 끝나면 알려줘'만 안다.
import { AD_SEC } from './data.js';

let el = null;
let busy = false;

// 광고를 보여주고, 끝까지 봤으면 true로 끝난다.
// 광고를 지운 사람에게는 **아예 안 띄우고 바로 true**다 — 그게 산 것이다.
export function showAd(adFree = false) {
  if (adFree) return Promise.resolve(true);
  if (busy) return Promise.resolve(false);
  busy = true;
  return new Promise((done) => {
    let left = AD_SEC;
    if (!el) {
      el = document.createElement('div');
      el.id = 'adwrap';
      document.body.appendChild(el);
    }
    const close = (ok) => {
      clearInterval(timer);
      el.classList.remove('on');
      el.innerHTML = '';
      busy = false;
      done(ok);
    };
    const paint = () => {
      el.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'adbox';
      box.innerHTML = `<div class="adtag">광고</div>
        <div class="adart">📺</div>
        <div class="adtitle">여기에 광고가 나옵니다</div>
        <div class="adsub">지금은 흉내예요 — 나중에 진짜 광고가 들어갑니다</div>
        <div class="adleft">${left}초</div>`;
      const skip = document.createElement('button');
      skip.className = 'btn';
      skip.textContent = left > 0 ? `${left}초 뒤에 닫을 수 있어요` : '보상 받기';
      skip.disabled = left > 0;
      skip.onclick = () => close(true);
      box.appendChild(skip);
      const x = document.createElement('button');
      x.className = 'adx';
      x.textContent = '✕';
      x.title = '그만 보기 (보상 없음)';
      x.onclick = () => close(false);
      box.appendChild(x);
      el.appendChild(box);
    };
    paint();
    el.classList.add('on');
    const timer = setInterval(() => {
      left--;
      if (left < 0) { clearInterval(timer); return; }
      paint();
    }, 1000);
  });
}
