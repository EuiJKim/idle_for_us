import sys, os, glob, json
from PIL import Image, ImageDraw, ImageFont
B = '/tmp/claude-0/-home-user/84353f17-e527-5beb-94c7-4611078e970e/scratchpad/boss'
FX = {j['name'] for j in json.load(open(f'{B}/jobs-fx.json'))}
force = '-f' in sys.argv
os.makedirs(f'{B}/out/boss', exist_ok=True); os.makedirs(f'{B}/out/bfx', exist_ok=True)
report = []
for f in sorted(glob.glob(f'{B}/raw/*.png')):
    n = os.path.basename(f)[:-4]
    if n in FX:
        o = f'{B}/out/bfx/{n}.jpg'
        if os.path.exists(o) and not force and os.path.getmtime(o) > os.path.getmtime(f): continue
        Image.open(f).convert('RGB').resize((512, 512), Image.LANCZOS).save(o, quality=85)
        continue
    o = f'{B}/out/boss/{n}.png'
    if os.path.exists(o) and not force and os.path.getmtime(o) > os.path.getmtime(f): continue
    im = Image.open(f).convert('RGBA')
    a = im.split()[3]
    bb = a.point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bb)
    w, h = im.size
    nw = max(1, round(w * 400 / h))
    im = im.resize((nw, 400), Image.LANCZOS)
    # palette quantize preserving alpha: binary-ish alpha via quantize of RGBA
    q = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    q.save(o, optimize=True)
    # stats
    edge = {'L': bb[0] <= 2, 'T': bb[1] <= 2, 'R': bb[2] >= Image.open(f).size[0] - 2, 'B': bb[3] >= Image.open(f).size[1] - 2}
    report.append((n, (nw, 400), os.path.getsize(o) // 1024, ''.join(k for k, v in edge.items() if v)))
for r in report: print(*r)
