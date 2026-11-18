# v585 머리 조각 다시 맞춤 — 새로 그린 머리(턱 · 수염 · 목 윗부분까지 다 보이게)를 게임 머리 조각으로.
#   전 그림(tools/s2art/wear.py)은 참고 머리처럼 턱 아래가 화폭에 잘려 있어 장비 창처럼 크게 그리면 턱이 일자로 끊겨 보였다.
#   크기: 머리띠 가운데 ~ 코끝 높이 · 가로: 코끝 · 세로: 머리띠(붉은 띠)의 가운데를 참고 상투 머리에 맞춘다.
#   화폭: 168 x (PAD + CHIN + BOT) — 위 PAD(관 · 깃털) · 아래 BOT(턱 · 목). 게임은 BOT만큼 내려 그린다(js/s2/ui/look.js WEAR_BOT).
#   사용: python3 tools/s2art/head_fit2.py <새 머리 png 폴더>   → art/s2/wear/head-*.webp
import sys, os, glob
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
SRC = sys.argv[1]
HERE = os.path.dirname(__file__)
HERO = os.path.join(HERE, '..', '..', 'art', 'hero')
OUT = os.path.join(HERE, '..', '..', 'art', 's2', 'wear')
PAD, BOT = 60, 40
BAND_AT = 107   # 머리띠 가운데 높이 — 전 머리(v533, 턱을 화폭 아래에 맞춘 것)들의 자리와 같게(참고 머리 그대로면 11px 낮아 턱이 옷깃 뒤로 숨었다)

def skin_box(im):
    w, h = im.size; px = im.load(); xs = []; ys = []
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, w, h)
    for y in range(bb[1] + int((bb[3] - bb[1]) * 0.45), bb[3], 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 200 and r > 170 and g > 120 and b > 85 and r > g > b and r - b > 30 and r - b < 120:
                xs.append(x); ys.append(y)
    xs.sort(); ys.sort(); n = len(xs)
    return xs[n // 100], ys[n // 100], xs[n * 99 // 100], ys[n * 99 // 100]
def band_y(im, lo=0.2, hi=0.75):
    px = im.load(); w, h = im.size; bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    rows = []
    for y in range(bb[1] + int((bb[3] - bb[1]) * lo), bb[1] + int((bb[3] - bb[1]) * hi), 1):
        n = sum(1 for x in range(0, w, 2) if px[x, y][3] > 200 and px[x, y][0] > 110 and px[x, y][0] > 2 * px[x, y][1] and px[x, y][0] > 2 * px[x, y][2])
        rows.append((n, y))
    m = max(n for n, _ in rows); ys = [y for n, y in rows if n >= m * 0.6]
    return sum(ys) / len(ys)
def nose_x(im, y0, y1):
    px = im.load(); w = im.size[0]
    return max(x for y in range(int(y0), int(y1), 2) for x in range(w) if px[x, y][3] > 200)
def nose_tip(im, y0, y1):   # 머리띠 아래 가장 오른쪽 점(코끝) — (x, y)
    px = im.load(); w = im.size[0]; best = (-1, 0)
    for y in range(int(y0), int(y1)):
        for x in range(w - 1, -1, -1):
            if px[x, y][3] > 200:
                if x > best[0]: best = (x, y)
                break
    return best

ref = Image.open(f'{HERO}/head-topknot.png').convert('RGBA'); RW, RH = ref.size
CHIN = round(RH * 0.93)
rB = band_y(ref, 0.35, 0.75); rN, rNy = nose_tip(ref, rB + 6, CHIN - 10); rb = skin_box(ref)
for f in sorted(glob.glob(f'{SRC}/head-*.png')):
    im = Image.open(f).convert('RGBA')
    # 크기: 머리띠 가운데 ~ 코끝 높이(쓰개 · 턱 · 목과 상관없다) — 전엔 아래 얼굴 살빛 폭이라 목까지 그린 그림에서 머리가 작아졌다
    gB = band_y(im); bb = im.getchannel('A').getbbox()
    gN, gNy = nose_tip(im, gB + 20, gB + (bb[3] - gB) * 0.5)
    k = (rNy - rB) / (gNy - gB)
    gb = skin_box(im); k2 = (rb[2] - rb[0]) / (gb[2] - gb[0])   # 얼굴 폭으로 잰 값 — 코끝을 잘못 잡으면(쓰개 비녀가 오른쪽 끝) 이것으로
    if abs(k / k2 - 1) > 0.15: k, gN = k2, nose_x(im, gB, gB + (bb[3] - gB) * 0.45)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    cv = Image.new('RGBA', (RW, PAD + CHIN + BOT), (0, 0, 0, 0))
    cv.paste(im, (round(rN - gN * k), round(BAND_AT - gB * k)), im)
    cv.save(f'{OUT}/{os.path.basename(f)[:-4]}.webp', 'WEBP', quality=90, method=6); print(os.path.basename(f), cv.size, 'k', round(k, 4))
