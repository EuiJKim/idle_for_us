// 벡터 짐승을 크게 그려 원본(편집 입력)과 내용 상자를 뽑는다
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8123/index.html?nofb=1').catch(() => {});
  const res = await p.evaluate(async () => {
    const m = await import('/js/creatures.js');
    const S = 6, out = {};
    for (const k of Object.keys(m.CREATURES)) {
      const c = document.createElement('canvas'); c.width = 1400; c.height = 1000;
      const x = c.getContext('2d');
      const ox = 700, oy = 820;
      x.save(); x.translate(ox, oy); x.scale(S, S);
      m.drawCreature(x, k, 0, 0, { t: 0.3 });
      x.restore();
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
        if (d[(yy * c.width + xx) * 4 + 3] > 90) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      // 원본: 내용 상자 + 여백을 잘라 낸다
      const pad = 30;
      const cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad), cw = Math.min(c.width, x1 + pad) - cx0, ch = Math.min(c.height, y1 + pad) - cy0;
      const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
      c2.getContext('2d').drawImage(c, cx0, cy0, cw, ch, 0, 0, cw, ch);
      out[k] = { png: c2.toDataURL('image/png'), box: [(x0 - ox) / S, (y0 - oy) / S, (x1 + 1 - ox) / S, (y1 + 1 - oy) / S], saddle: m.saddleY(k, 0) };
    }
    return out;
  });
  const boxes = {};
  for (const [k, v] of Object.entries(res)) {
    fs.writeFileSync(`${OUT}/${k}.png`, Buffer.from(v.png.split(',')[1], 'base64'));
    boxes[k] = { box: v.box.map((n) => Math.round(n * 10) / 10), saddle: Math.round(v.saddle * 10) / 10 };
  }
  fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 0));
  console.log(Object.keys(boxes).length);
  await b.close();
})();
