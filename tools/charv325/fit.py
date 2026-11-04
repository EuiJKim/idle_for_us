# v325 새 그림을 게임 조각으로 맞춘다 — 잘라 내고(빈 둘레) 줄여서 art/hero2/에, 자리 값은 js/art2.js에.
#   머리: 살빛 픽셀로 얼굴 상자를 재서 남자 머리 그림(head-topknot)의 얼굴 크기·턱 선·얼굴 가운데에 맞춘다.
#   무기: 손잡이 자리(grip)·길이(h)는 종류마다 정한 값. 문양·낟알·얼굴 덧그림은 잘라서 줄이기만.
# 사용: python3 fit.py   (gen/ → ../../art/hero2/ · ../../js/art2.js)
import os, json, glob
from PIL import Image
G, OUT, JS = 'gen', '../../art/hero2', '../../js/art2.js'
os.makedirs(OUT, exist_ok=True)
PX = 168 / 25            # 뼈대 1칸에 몇 픽셀로 굽나(남자 머리 그림과 같은 해상도)
FIT_HEAD = {'w': 25, 'x': 1, 'y': -4 - 50 * 116 / 92 + 4}   # art.js FIT.head와 같다

def trim(im, th=20):
    bb = im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
    return im.crop(bb) if bb else im
def skin_box(im):
    w, h = im.size; px = im.load(); xs = []; ys = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 200 and r > 170 and g > 120 and b > 85 and r > g > b and r - b > 30 and r - b < 120:
                xs.append(x); ys.append(y)
    ys.sort(); xs.sort()
    n = len(ys)
    # 맨 끝 몇 점은 귀걸이·잡티일 수 있다 — 1%·99% 자리
    return xs[n // 100], ys[n // 100], xs[n * 99 // 100], ys[n * 99 // 100]

# 남자 머리 기준(게임에 쓰는 자른 모양 — art.js HEAD_FIT head-topknot crop 0.93)
m = Image.open('../../art/hero/head-topknot.png').convert('RGBA')
m = m.crop((0, 0, m.width, round(m.height * 0.93)))
ml, mt, mr, mb = skin_box(m)
m_skinH = (mb - mt) / PX                         # 뼈대 칸
m_cx = FIT_HEAD['x'] - FIT_HEAD['w'] / 2 + ((ml + mr) / 2) / PX
print('male skin', (ml, mt, mr, mb), 'skinH units %.1f' % m_skinH)

heads, weapons, sprites = {}, {}, []
# v328 여협 복면(두건) — 살빛이 눈가뿐이라 얼굴 상자로 못 맞춘다. 남자 두건(head-hood)과 같은 턱 선, 높이 97%로 (tools/charv326/gen/fh-hood.png)
_hood = '../charv326/gen/fh-hood.png'
if os.path.exists(_hood):
    _m = Image.open('../../art/hero/head-hood.png'); _f = trim(Image.open(_hood).convert('RGBA'))
    _h = 25 * _m.height / _m.width * 0.97; _w = _f.width * _h / _f.height
    _f.resize((round(_w * PX * 1.5), round(_h * PX * 1.5)), Image.LANCZOS).save(f'{OUT}/fh-hood.png', optimize=True)
    heads['fh-hood'] = {'w': round(_w, 2), 'x': round(13.5 - _w / 2 - 0.5, 2), 'y': round(FIT_HEAD['y'], 2), 'eye': 0.55, 'eyeX': 0.75, 'brow': 0.4}
for f in sorted(glob.glob(f'{G}/fh-*.png')):
    name = os.path.basename(f)[:-4]
    im = trim(Image.open(f).convert('RGBA'))
    sl, st, sr, sb = skin_box(im)
    k = m_skinH / (sb - st)                       # 그림 1px → 뼈대 칸
    w = im.width * k
    cx_rel = ((sl + sr) / 2) / im.width
    x = m_cx - (cx_rel - 0.5) * w
    y = FIT_HEAD['y'] + (im.height - sb) * k        # 턱이 남자 머리 턱 자리에
    out = im.resize((max(8, round(w * PX * 1.5)), max(8, round(im.height * k * PX * 1.5))), Image.LANCZOS)
    out.save(f'{OUT}/{name}.png', optimize=True)
    faceH = sb - st
    eye_y = st + faceH * 0.44
    heads[name] = {'w': round(w, 2), 'x': round(x, 2), 'y': round(y, 2),
                   'eye': round((im.height - eye_y) / im.height, 3), 'eyeX': round((sl + (sr - sl) * 0.74) / im.width, 3),
                   'brow': round((st + faceH * 0.2) / im.height, 3)}
    print(name, im.size, '->', out.size, heads[name])

WFIT = {  # 손잡이 자리(위에서) · 그려지는 길이(뼈대 칸) · 맨손(손을 따로 안 그린다)
    'wp-fist-': (0.5, 19, True), 'wp-ring-': (0.82, 21, True), 'wp-fan-crane': (0.88, 32, False), 'wp-fan-': (0.92, 30, False),
    'wp-needle': (0.88, 28, False), 'wp-gourd': (0.86, 24, False), 'wp-sickle': (0.86, 30, False),
}
for f in sorted(glob.glob(f'{G}/wp-*.png')):
    name = os.path.basename(f)[:-4]
    im = trim(Image.open(f).convert('RGBA'))
    grip, hh, bare = next(v for k, v in WFIT.items() if name.startswith(k))
    out = im.resize((max(8, round(im.width * hh * PX / im.height)), round(hh * PX)), Image.LANCZOS)
    out.save(f'{OUT}/{name}.png', optimize=True)
    weapons[name] = {'grip': grip, 'h': hh, **({'bare': True} if bare else {})}
    print(name, out.size)
for f in sorted(glob.glob(f'{G}/ring-*.png')) + sorted(glob.glob(f'{G}/pt-*.png')) + sorted(glob.glob(f'{G}/face-*.png')):
    name = os.path.basename(f)[:-4]
    im = trim(Image.open(f).convert('RGBA'))
    side = 256 if name.startswith('ring-') else 96 if name.startswith('face-') else 64
    im.thumbnail((side, side), Image.LANCZOS)
    im.save(f'{OUT}/{name}.png', optimize=True)
    sprites.append(name)
    print(name, im.size)
js = ("// v325 tools/charv325/fit.py가 만든다 — 손으로 고치지 않는다.\n"
      "// 여협 머리(art/hero2/fh-*): 남자 머리 그림의 얼굴 크기·턱 선에 맞춘 자리 · 무기: 손잡이·길이 · 그 밖: 문양·낟알·얼굴 덧그림\n"
      f"export const ART2_HEADS = {json.dumps(heads, ensure_ascii=False)};\n"
      f"export const ART2_WEAPONS = {json.dumps(weapons, ensure_ascii=False)};\n"
      f"export const ART2_SPRITES = {json.dumps(sprites, ensure_ascii=False)};\n")
open(JS, 'w').write(js)
print('heads', len(heads), 'weapons', len(weapons), 'sprites', len(sprites))
