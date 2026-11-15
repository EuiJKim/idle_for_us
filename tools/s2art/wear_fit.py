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

# 머리
ref = Image.open(f'{HERO}/head-topknot.png').convert('RGBA'); RW, RH = ref.size
rb = skin_box(ref)
for f in sorted(glob.glob(f'{SRC}/head-*.png')):
    im = Image.open(f).convert('RGBA'); gb = skin_box(im)
    k = ((rb[2] - rb[0]) / (gb[2] - gb[0]) + (rb[3] - rb[1]) / (gb[3] - gb[1])) / 2
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    gx, gy = gb[2] * k, gb[3] * k   # 코끝(오른쪽) · 턱(아래)을 맞춘다
    cv = Image.new('RGBA', (RW, RH + PAD), (0, 0, 0, 0))
    cv.paste(im, (round(rb[2] - gx), round(rb[3] - gy) + PAD), im)
    cv = cv.crop((0, 0, RW, PAD + round(RH * 0.93)))
    save(cv, os.path.basename(f)[:-4])

# 무기
REFW = {'sword': 'wp-sword', 'spear': 'wp-spear', 'fist': 'wp-fist', 'staff': 'wp-spear'}
for f in sorted(glob.glob(f'{SRC}/wp-*.png')):
    kind = os.path.basename(f).split('-')[1]
    r = Image.open(f'{HERO}/{REFW[kind]}.png'); th = r.height if kind != 'fist' else round(r.height * 0.58)
    im = trim(Image.open(f).convert('RGBA'))
    im = im.resize((max(1, round(im.width * th / im.height)), th), Image.LANCZOS)
    save(im, os.path.basename(f)[:-4])
