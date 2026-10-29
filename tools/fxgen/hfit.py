# 새로 그린 무인 조각을 옛 그림 틀에 맞춘다: 옛 그림의 내용 상자(bbox)에 새 내용 상자를 맞춰 S배 캔버스에 붙인다.
import sys, os
from PIL import Image
S = 3
gen, old, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
def bbox(im, th=24):
    return im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
for f in sorted(os.listdir(gen)):
    if not f.endswith('.png'): continue
    o = Image.open(os.path.join(old, f)).convert('RGBA')
    n = Image.open(os.path.join(gen, f)).convert('RGBA')
    ob, nb = bbox(o), bbox(n)
    if not ob or not nb: print('skip', f); continue
    c = n.crop(nb)
    tw, th = (ob[2] - ob[0]) * S, (ob[3] - ob[1]) * S
    c = c.resize((tw, th), Image.LANCZOS)
    cv = Image.new('RGBA', (o.width * S, o.height * S), (0, 0, 0, 0))
    cv.alpha_composite(c, (ob[0] * S, ob[1] * S))
    cv.save(os.path.join(out, f), optimize=True)
    ra = (nb[2]-nb[0])/(nb[3]-nb[1]); oa = (ob[2]-ob[0])/(ob[3]-ob[1])
    print(f, o.size, '->', cv.size, 'aspect old %.2f new %.2f' % (oa, ra), os.path.getsize(os.path.join(out, f)))
