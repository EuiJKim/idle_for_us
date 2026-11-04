// v355 머리+옷 조합마다 지금 조각을 이어 붙인 그림(편집 입력)을 1024×1024 틀에 그린다.
//   틀: 무인 발밑 (0,0)이 (512, 984), 1 = 8px. sunburst가 같은 틀로 다시 그린 것을 fit.py가 이 틀 그대로 되읽는다.
//   NO_PROXY=127.0.0.1,localhost PLAYWRIGHT=$(npm root -g)/playwright node render.cjs src
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'src';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8123/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.char-card', { timeout: 20000 });
  if (process.env.FONLY) await p.evaluate(() => { window.__FONLY = true; });
  if (process.env.HONLY) await p.evaluate((h) => { window.__HONLY = h; }, process.env.HONLY);
  const res = await p.evaluate(async () => {
    const A = await import('/js/art.js');
    await new Promise((r) => { if (A.artReady()) r(); else A.loadArt(r); });
    A.loadArt2?.();
    await new Promise((r) => setTimeout(r, 4000));
    const { drawBodyHeadParts } = await import('/js/battle.js');
    const ROBES = ['black', 'blue', 'brown', 'dark', 'red', 'white', 'o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'];
    const MHEAD = [['head', {}], ['head-topknot', { head: 'topknot' }], ['head-bald', { head: 'bald' }], ['head-hood', { head: 'hood' }], ['head-band', { head: 'band' }], ['head-hat', { head: 'hat' }]];
    const FHEAD = ['long', 'bun', 'pony', 'twin', 'short'].map((s) => [`fh-${s}-black`, { female: true, fstyle: s, fhead: `fh-${s}-black` }]).concat([['fh-hood', { female: true, head: 'hood', fstyle: 'long' }]]);
    const out = {};
    const S = 8, OX = 512, OY = 984;
    for (const fem of (window.__FONLY ? [true] : window.__HONLY ? [false] : [false, true])) for (const r of ROBES) for (const [hk, lk] of (fem ? FHEAD : MHEAD)) {
      if (window.__HONLY && hk !== window.__HONLY) continue;
      A.OUTFIT_BODY[0] = `body-${r}`;
      const look = { outfitBody: 0, ...lk };
      const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
      const x = c.getContext('2d');
      x.translate(OX, OY); x.scale(S, S);
      const info = drawBodyHeadParts(x, look);
      if (info.hk !== hk) { out[`ERR ${hk}`] = info.hk; continue; }
      const d = x.getImageData(0, 0, 1024, 1024).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let yy = 0; yy < 1024; yy++) for (let xx = 0; xx < 1024; xx++) if (d[(yy * 1024 + xx) * 4 + 3] > 60) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      out[`${info.bk}--${hk}`] = { png: c.toDataURL('image/png'), px: [x0, y0, x1 + 1, y1 + 1], neckY: info.neckY };
    }
    return out;
  });
  const meta = {};
  for (const [k, v] of Object.entries(res)) {
    if (k.startsWith('ERR')) { console.log(k, v); continue; }
    fs.writeFileSync(`${OUT}/${k}.png`, Buffer.from(v.png.split(',')[1], 'base64'));
    meta[k] = { px: v.px, neckY: v.neckY };
  }
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta));
  console.log(Object.keys(meta).length);
  await b.close();
})();
