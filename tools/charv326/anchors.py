# v327 머리 그림마다 눈·눈썹·정수리·턱 자리를 픽셀로 잰다 — 덧그림(안대·면사·칼자국·삿갓)을 그 머리에 맞춰 놓으려고.
#   눈: 살빛에 둘러싸인 어두운 점들(눈동자·속눈썹)의 무게중심 — 얼굴 오른쪽(앞) 절반 · 위 15~65%에서
#   눈썹: 눈 위쪽 어두운 줄 · 정수리: 얼굴 가운데 줄에서 그림이 시작하는 곳 · 턱: 살빛이 끝나는 맨 아래
# 값은 모두 그림 높이·너비에 대한 비(위에서·왼쪽에서). 사용: python3 anchors.py → anchors.json
import json, glob, os
from PIL import Image
def is_skin(p):
    r, g, b, a = p
    return a > 200 and r > 160 and g > 110 and b > 80 and r > g > b and 25 < r - b < 130
def measure(path, crop=1.0):
    im = Image.open(path).convert('RGBA')
    if crop < 1: im = im.crop((0, 0, im.width, round(im.height * crop)))
    w, h = im.size; px = im.load()
    sk = [(x, y) for y in range(0, h, 1) for x in range(0, w, 1) if is_skin(px[x, y])]
    xs = sorted(x for x, _ in sk); ys = sorted(y for _, y in sk)
    n = len(sk)
    sl, sr, st, sb = xs[n // 100], xs[n * 99 // 100], ys[n // 100], ys[n * 99 // 100]
    skin = set(sk)
    # 눈 후보 — 어둡고 둘레(반지름 5)의 살빛이 35% 넘는 점
    cand = []
    for y in range(st + int((sb - st) * 0.12), st + int((sb - st) * 0.62)):
        for x in range(sl + int((sr - sl) * 0.45), sr + 1):
            r, g, b, a = px[x, y]
            if a < 200 or (r + g + b) / 3 > 75: continue
            k = 0; t = 0
            for dy in range(-5, 6, 2):
                for dx in range(-5, 6, 2):
                    t += 1
                    if (x + dx, y + dy) in skin: k += 1
            if k / t > 0.35: cand.append((x, y))
    if not cand: return None
    # 가장 촘촘한 덩어리(눈) — 눈썹이 같이 잡히면 아래쪽(눈)을 고른다: y로 두 덩어리를 나눠 아래 것
    cy = sorted(y for _, y in cand)
    mid = cy[len(cy) // 2]
    low = [(x, y) for x, y in cand if y >= mid - 2]
    ex = sum(x for x, _ in low) / len(low); ey = sum(y for _, y in low) / len(low)
    high = [(x, y) for x, y in cand if y < ey - 4]
    by = (sum(y for _, y in high) / len(high)) if high else ey - (sb - st) * 0.1
    # 정수리 — 얼굴 가운데 세로줄에서 처음 불투명한 곳
    cx = (sl + sr) // 2
    top = next((y for y in range(h) if px[cx, y][3] > 120), 0)
    # 턱 — 눈 아래에서 살빛 오른쪽 끝(얼굴 앞선)이 목으로 쑥 들어가기 직전 줄
    def rr(y):
        xs_ = [x for x in range(w) if (x, y) in skin]
        return max(xs_) if xs_ else None
    rows = [(y, rr(y)) for y in range(int(ey), sb + 1)]
    rows = [(y, r) for y, r in rows if r is not None]
    neck = sorted(r for _, r in rows[-max(3, len(rows) // 12):])[0]
    fw = sr - sl
    jaw = max((y for y, r in rows if r > neck + fw * 0.1), default=sb)
    # 뒤통수 — 눈 줄·눈썹 줄에서 그림이 시작하는 왼쪽 끝 · 눈썹 줄의 머리 오른쪽 끝
    def lx(y): return next((x for x in range(w) if px[x, int(y)][3] > 120), 0)
    def rx(y): return next((x for x in range(w - 1, -1, -1) if px[x, int(y)][3] > 120), w - 1)
    return {'jawY': round(jaw / h, 3), 'backX': round(lx(ey) / w, 3), 'browL': round(lx(by) / w, 3), 'browR': round(rx(by) / w, 3),
            'w': w, 'h': h, 'eyeX': round(ex / w, 3), 'eyeY': round(ey / h, 3), 'browY': round(by / h, 3), 'topY': round(top / h, 3),
            'chinY': round(sb / h, 3), 'skinTop': round(st / h, 3), 'faceL': round(sl / w, 3), 'faceR': round(sr / w, 3)}
out = {}
CROP = {'head': 0.88, 'head-topknot': 0.93, 'head-band': 0.95, 'head-hat': 1, 'head-hood': 1, 'head-bald': 0.72}
for k, c in CROP.items(): out[k] = measure(f'../../art/hero/{k}.png', c)
for f in sorted(glob.glob('../../art/hero2/fh-*.png')): out[os.path.basename(f)[:-4]] = measure(f)
json.dump(out, open('anchors.json', 'w'), indent=1)
FIX = {'head-bald': {'eyeY': 0.07}}   # 민머리는 짙은 눈썹이 눈으로 잡힌다 — 눈은 그만큼 아래
for k, f in FIX.items():
    for q, d in f.items(): out[k][q] = round(out[k][q] + d, 3)
out = {k: v for k, v in out.items() if v and k in ('head', 'head-topknot', 'head-bald') or k.startswith('fh-')}
keep = ('eyeX', 'eyeY', 'browY', 'topY', 'jawY', 'faceL', 'faceR', 'backX', 'browL', 'browR')
js = ("// v327 tools/charv326/anchors.py가 잰다 — 손으로 고치지 않는다.\n"
      "// 머리 그림(자른 뒤)마다 눈·눈썹·정수리·턱·얼굴 좌우·뒤통수 자리. 모두 그림 너비·높이에 대한 비(위·왼쪽에서)\n"
      "export const HEAD_ANCHOR = " + json.dumps({k: {q: v[q] for q in keep} for k, v in out.items()}) + ";\n")
open('../../js/headanchor.js', 'w').write(js)
for k, v in out.items(): print(k, v)

from PIL import ImageDraw
tiles=[]
for k,v in out.items():
    if k.startswith('fh-') and not k.endswith('-black') and k!='fh-pony-red' and k!='fh-twin-white': continue
    p = f'../../art/hero/{k}.png' if not k.startswith('fh-') else f'../../art/hero2/{k}.png'
    im = Image.open(p).convert('RGBA')
    c = CROP.get(k, 1)
    if c < 1: im = im.crop((0, 0, im.width, round(im.height * c)))
    im = im.resize((300, round(im.height * 300 / im.width)))
    W,H = im.size; d = ImageDraw.Draw(im)
    d.ellipse((v['eyeX']*W-4, v['eyeY']*H-4, v['eyeX']*W+4, v['eyeY']*H+4), outline=(0,255,0,255), width=2)
    for key,col in (('browY',(0,128,255,255)),('jawY',(255,0,255,255)),('topY',(255,255,0,255))): d.line((0, v[key]*H, W, v[key]*H), fill=col)
    for key,col in (('faceL',(255,128,0,255)),('faceR',(255,128,0,255)),('backX',(255,0,0,255))): d.line((v[key]*W, 0, v[key]*W, H), fill=col)
    tiles.append(im)
T=Image.new('RGBA',(sum(t.width for t in tiles),max(t.height for t in tiles)),(80,80,80,255)); x=0
for t in tiles: T.alpha_composite(t,(x,0)); x+=t.width
T.save('/tmp/claude-0/-home-user/84353f17-e527-5beb-94c7-4611078e970e/scratchpad/shots/anch.png')
