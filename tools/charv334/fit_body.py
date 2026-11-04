# v334 다시 그린 도포(3/4 시점·목 포함)를 게임 조각(276x348 · 아랫단이 바닥 · 목 가운데가 머리 자리)으로 맞춘다.
#   머리는 FIT.head x=1(뼈대 칸) → 캔버스 가운데(138)에서 5.5px 오른쪽. 목 가운데를 거기에 둔다. 높이는 목 꼭대기~아랫단 = 348.
import glob, os
from PIL import Image
OUT = '../../art/hero'
CW, CH = 276, 348
HEAD_X = 138 + 1 * 276 / 50
def trim(im, th=20):
    bb = im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
    return im.crop(bb)
for f in sorted(glob.glob('gen/body-*.png')):
    n = os.path.basename(f)
    im = trim(Image.open(f).convert('RGBA'))
    k = CH / im.height
    im = im.resize((round(im.width * k), CH), Image.LANCZOS)
    px = im.load(); w = im.width
    # 목 가운데 — 위 4% 줄의 불투명 x 평균
    xs = [x for y in range(0, max(2, CH * 4 // 100)) for x in range(w) if px[x, y][3] > 120]
    ncx = sum(xs) / len(xs)
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    ox = round(HEAD_X - ncx)
    cv.alpha_composite(im, (ox, 0)) if 0 <= ox and ox + w <= CW else cv.paste(im, (ox, 0), im)
    cv.save(f'{OUT}/{n}', optimize=True)
    print(n, im.size, 'neck cx %.0f → ox %d' % (ncx, ox))
