# v517 그린 몸 조각(tools/s2art/wear.py)을 게임 조각 크기 · 자리로 맞춘다 → art/s2/wear/*.webp
#   도포: 276x348 · 아랫단이 바닥 · 목 가운데가 머리 자리(tools/charv334/fit_body.py와 같은 규칙)
#   머리: 지금 상투 머리(head-topknot 168x150)와 얼굴 상자(살빛)를 맞춰 같은 폭 · 같은 자리, 위로 PAD px 여유(관 · 깃털)
#         게임이 상투 머리에 하듯 아래 7%를 잘라 둔다(HEAD_FIT crop 0.93) → 높이 PAD + 140
#   무기: 투명 둘레를 잘라 참고 무기와 같은 높이로(손잡이 자리 비율은 참고 무기 것을 쓴다)
import sys, os, glob
from PIL import Image
SRC = sys.argv[1]
HERE = os.path.dirname(__file__)
HERO = os.path.join(HERE, '..', '..', 'art', 'hero')
OUT = os.path.join(HERE, '..', '..', 'art', 's2', 'wear'); os.makedirs(OUT, exist_ok=True)
PAD = 60

def trim(im, th=20):
    bb = im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
    return im.crop(bb) if bb else im
def skin_box(im):
    # 쓰개(금 · 붉은 빛)에 살빛이 섞여 잡히지 않게 — 머리 그림 아래 절반(얼굴 · 턱)에서만 잰다
    w, h = im.size; px = im.load(); xs = []; ys = []
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, w, h)
    for y in range(bb[1] + int((bb[3] - bb[1]) * 0.45), bb[3], 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 200 and r > 170 and g > 120 and b > 85 and r > g > b and r - b > 30 and r - b < 120:
                xs.append(x); ys.append(y)
    xs.sort(); ys.sort(); n = len(xs)
    return xs[n // 100], ys[n // 100], xs[n * 99 // 100], ys[n * 99 // 100]
def save(im, name):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, method=6); print(name, im.size)

# 도포
CW, CH = 276, 348; HEAD_X = 138 + 1 * 276 / 50
for f in sorted(glob.glob(f'{SRC}/body-*.png')):
    im = trim(Image.open(f).convert('RGBA'))
    im = im.resize((round(im.width * CH / im.height), CH), Image.LANCZOS)
    px = im.load(); w = im.width
    xs = [x for y in range(0, max(2, CH * 4 // 100)) for x in range(w) if px[x, y][3] > 120]
    ox = round(HEAD_X - sum(xs) / len(xs))
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cv.paste(im, (ox, 0), im)
    save(cv, os.path.basename(f)[:-4])

# 머리 — v533: 얼굴 폭(살빛 가로)으로 크기를, 턱(그림 아래 끝)과 코끝(오른쪽 끝)으로 자리를 상투 머리에 맞춘다.
#   전엔 살빛 상자의 아래 끝을 턱으로 잡았는데, 수염이 있으면 살빛이 콧수염에서 끊겨 턱 · 입이 잘려 나갔다.
def band_y(im):
    # 머리 높이의 가운데 35~75%에서만(붉은 관 · 깃털이 위에 있어도) · 가장 붉은 줄들의 가운데
    px = im.load(); w, h = im.size; bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    rows = []
    for y in range(bb[1] + int((bb[3] - bb[1]) * 0.35), bb[1] + int((bb[3] - bb[1]) * 0.75), 1):
        n = sum(1 for x in range(0, w, 2) if px[x, y][3] > 200 and px[x, y][0] > 110 and px[x, y][0] > 2 * px[x, y][1] and px[x, y][0] > 2 * px[x, y][2])
        rows.append((n, y))
    m = max(n for n, _ in rows); ys = [y for n, y in rows if n >= m * 0.6]
    return sum(ys) / len(ys)
def nose_x(im, y0, y1):
    px = im.load(); w = im.size[0]
    return max(x for y in range(int(y0), int(y1), 2) for x in range(w) if px[x, y][3] > 200)
ref = Image.open(f'{HERO}/head-topknot.png').convert('RGBA'); RW, RH = ref.size
CHIN = round(RH * 0.93)                     # 게임이 상투 머리 아래 7%를 잘라 낸 자리 = 턱
rB = band_y(ref); rN = nose_x(ref, rB, CHIN); rb = skin_box(ref)
for f in sorted(glob.glob(f'{SRC}/head-*.png')):
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    gC = bb[3]; gb = skin_box(im); gN = nose_x(im, bb[1] + (gC - bb[1]) * 0.4, gC)
    k = (rb[2] - rb[0]) / (gb[2] - gb[0])   # 얼굴 폭(귀 ~ 코끝 살빛) — 쓰개 · 수염과 상관없다
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    cv = Image.new('RGBA', (RW, PAD + CHIN), (0, 0, 0, 0))
    cv.paste(im, (round(rN - gN * k), round(PAD + CHIN - gC * k)), im)
    save(cv, os.path.basename(f)[:-4])

# 무기
REFW = {'sword': 'wp-sword', 'spear': 'wp-spear', 'fist': 'wp-fist', 'staff': 'wp-spear'}
for f in sorted(glob.glob(f'{SRC}/wp-*.png')):
    kind = os.path.basename(f).split('-')[1]
    r = Image.open(f'{HERO}/{REFW[kind]}.png'); th = r.height if kind != 'fist' else round(r.height * 0.58)
    im = trim(Image.open(f).convert('RGBA'))
    im = im.resize((max(1, round(im.width * th / im.height)), th), Image.LANCZOS)
    save(im, os.path.basename(f)[:-4])

# v518 나머지 부위(그대로 쓰는 그림) — 투명 둘레를 잘라 긴 변을 맞춘다(게임이 크기를 정한다)
SIDE = {'boot': 160, 'leg': 320, 'arm': 200, 'cape': 360, 'belt': 240, 'neck': 120, 'ring': 256, 'bow': 360}
for f in sorted(glob.glob(f'{SRC}/*.png')):
    kind = os.path.basename(f).split('-')[0]
    if kind not in SIDE: continue
    im = trim(Image.open(f).convert('RGBA'))
    k = SIDE[kind] / max(im.size)
    save(im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), os.path.basename(f)[:-4])
