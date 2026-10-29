# 직업 무공 그림 다듬기: 투명 여백 자르고 최대 512px, 256색 PNG. cut-*은 1024폭 JPG.
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    n = f[:-4]
    im = Image.open(os.path.join(src, f))
    if n.startswith('cut-'):
        im = im.convert('RGB'); im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
        im.save(os.path.join(dst, n + '.jpg'), quality=74, optimize=True); continue
    im = im.convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    bb = a.getbbox()
    if bb:
        pad = 6
        im = im.crop((max(0, bb[0]-pad), max(0, bb[1]-pad), min(im.width, bb[2]+pad), min(im.height, bb[3]+pad)))
    M = {'plum-petal':128,'dagger':192,'soul-orb':192,'fist-gold':256,'skull':256,'serpent-head':256,'mask':256,'poison-cloud':256,'blood-eye':256,'plum-flower':256,'gold-aura':320,'gold-bell':256,'blood-moon':320,'crack-grey':384}.get(n, 512)
    im.thumbnail((M, M), Image.LANCZOS)
    if n == 'crack-grey': n = 'crack'
    q = im.quantize(256, method=Image.FASTOCTREE, dither=Image.NONE)
    q.save(os.path.join(dst, n + '.png'), optimize=True)
    print(n, im.size, os.path.getsize(os.path.join(dst, n + '.png')))
