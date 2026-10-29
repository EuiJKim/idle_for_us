# 짐승 그림 다듬기: 내용 상자로 자르고 (상자 크기 x5, 최대 384) 256색 PNG로. 만든 것만 js/crbox.js에 적는다.
import sys, os, json
from PIL import Image
src, art, js = sys.argv[1], sys.argv[2], sys.argv[3]
boxes = json.load(open('cr_src/boxes.json'))
os.makedirs(art, exist_ok=True)
out = {}
for k, b in boxes.items():
    f = os.path.join(src, k + '.png')
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    im = im.crop(bb)
    x0, y0, x1, y1 = b['box']
    W = min(384, round((x1 - x0) * 5)); H = round(W * (y1 - y0) / (x1 - x0))
    if H > 384: H = 384; W = round(H * (x1 - x0) / (y1 - y0))
    im = im.resize((W, H), Image.LANCZOS)
    im.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(os.path.join(art, k + '.png'), optimize=True)
    out[k] = b['box']
lines = ',\n'.join(f'  {k}: [{", ".join(str(v) for v in b)}]' for k, b in out.items())
open(js, 'w').write("// 짐승 그림(art/cr/)을 놓을 상자 — 벡터 모습의 내용 상자 [x0, y0, x1, y1] (발밑 (0,0), 오른쪽을 봄, 크기 1).\n"
                    "// tools/fxgen/crender.cjs가 재고 crfit.py가 적는다. 여기 없는 짐승은 벡터로 그린다.\nexport const CR_BOX = {\n" + lines + ",\n};\n")
print(len(out))
