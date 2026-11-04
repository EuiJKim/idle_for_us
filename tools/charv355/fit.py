# v355 sunburst가 다시 그린 한 장(gen2/, 1024×1536 틀)을 원래 조각 자리에 맞춰 놓는다.
#   1) 아랫몸(도포) 실루엣이 원본(src2/)과 가장 겹치도록 배율·이동을 찾는다(머리카락 길이가 달라도 몸은 맞게)
#   2) 그림을 알파 상자로 잘라 webp(높이 HOUT)로, 놓을 자리(무인 좌표)를 js/mergebox.js에
#   python3 fit.py
import json, os, sys
import numpy as np
from PIL import Image
HOUT = 640
meta = json.load(open('src/meta.json'))
X0, Y0, X1, Y1 = json.load(open('src2/frame.json'))['frame']
FW = (X1 - X0) / 1024.0                     # src2 1px = src FW px
OX, OY, S = 512, 984, 8.0                   # src 틀: 발밑 (512, 984), 1 = 8px
OUT = '../../art/hero3'
os.makedirs(OUT, exist_ok=True)

def mask(im, k=4):
    a = np.asarray(im.getchannel('A').resize((im.width // k, im.height // k), Image.BILINEAR)) > 100
    return a

def best_fit(src, gen):
    ms, mg = mask(src), mask(gen)
    ys = np.where(ms.any(1))[0]
    top, bot = ys.min(), ys.max()
    cut = int(top + (bot - top) * 0.38)        # 어깨 아래(도포)만 견준다
    msb = ms.copy(); msb[:cut] = False
    best = (-1, 1, 0, 0)
    H, W = ms.shape
    for s in np.arange(0.90, 1.105, 0.01):
        # gen을 s배 → 원본 틀에
        gw, gh = int(round(mg.shape[1] * s)), int(round(mg.shape[0] * s))
        g = np.asarray(Image.fromarray(mg.astype(np.uint8) * 255).resize((gw, gh), Image.NEAREST)) > 0
        for dy in range(-14, 15, 2):
            for dx in range(-14, 15, 2):
                # 바닥 가운데 기준: gen의 (0,0)을 원본 (dx + (W - gw)/2, dy + (H - gh))에
                ox, oy = int(round(dx + (W - gw) / 2)), int(round(dy + (H - gh)))
                canvas = np.zeros_like(ms)
                ys0, xs0 = max(0, oy), max(0, ox)
                ys1, xs1 = min(H, oy + gh), min(W, ox + gw)
                if ys1 <= ys0 or xs1 <= xs0: continue
                canvas[ys0:ys1, xs0:xs1] = g[ys0 - oy:ys1 - oy, xs0 - ox:xs1 - ox]
                cb = canvas.copy(); cb[:cut] = False
                inter = (cb & msb).sum(); uni = (cb | msb).sum()
                iou = inter / max(1, uni)
                if iou > best[0]: best = (iou, s, ox * 4, oy * 4)
    return best

boxes = {}
bad = []
keys = sorted(meta) if len(sys.argv) < 2 else sys.argv[1:]
for k in keys:
    f = f'gen2/{k}.png'
    if not os.path.exists(f): continue
    gen = Image.open(f).convert('RGBA')
    src = Image.open(f'src2/{k}.png').convert('RGBA')
    iou, s, ox, oy = best_fit(src, gen)
    # gen 픽셀 (u,v) → src2 (ox + u*s, oy + v*s) → src (X0 + ·*FW, Y0 + ·*FW) → 무인 ((·-OX)/S, (·-OY)/S)
    a = gen.getchannel('A').point(lambda v: 255 if v > 12 else 0)
    bb = a.getbbox()
    crop = gen.crop(bb)
    def world(u, v):
        x2, y2 = ox + u * s, oy + v * s
        return ((X0 + x2 * FW - OX) / S, (Y0 + y2 * FW - OY) / S)
    wx0, wy0 = world(bb[0], bb[1]); wx1, wy1 = world(bb[2], bb[3])
    w = round(crop.width * HOUT / crop.height)
    crop.resize((w, HOUT), Image.LANCZOS).save(f'{OUT}/m-{k}.webp', 'WEBP', quality=90, method=6)
    boxes[k] = [round(wx0, 2), round(wy0, 2), round(wx1, 2), round(wy1, 2), meta[k]['neckY']]
    if iou < 0.86: bad.append((k, round(float(iou), 3)))
    print(k, round(float(iou), 3), round(float(s), 2), ox, oy, flush=True)
old = {}
try:
    import re
    txt = open('../../js/mergebox.js').read()
    for m in re.finditer(r"'([^']+)': \[([^\]]+)\]", txt): old[m.group(1)] = [float(x) for x in m.group(2).split(',')]
except Exception: pass
old.update(boxes)
lines = ',\n'.join(f"  '{k}': [{', '.join(str(v) for v in b)}]" for k, b in sorted(old.items()))
open('../../js/mergebox.js', 'w').write("// 머리+옷 한 장 그림(art/hero3/) 놓을 자리 — [x0, y0, x1, y1, 목 줄 y] (무인 발밑 (0,0) · 오른쪽을 봄 · 크기 1). tools/charv355/fit.py가 적는다.\nexport const MERGE_BOX = {\n" + lines + ",\n};\n")
json.dump(bad, open('bad.json', 'w'))
print('fitted', len(boxes), 'low-iou', bad)
