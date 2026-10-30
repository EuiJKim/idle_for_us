import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
B = '/tmp/claude-0/-home-user/84353f17-e527-5beb-94c7-4611078e970e/scratchpad/boss'
kind = sys.argv[1]
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except Exception: font = ImageFont.load_default()
if kind == 'boss':
    order = lambda p: (os.path.basename(p)[0], int(os.path.basename(p).split('-')[1][:-4]) if os.path.basename(p).split('-')[1][:-4].isdigit() else 0, p)
    files = sorted(glob.glob(f'{B}/out/boss/*.png'), key=order)
    if len(sys.argv) > 2: files = [f for f in files if os.path.basename(f)[:-4] in sys.argv[2].split(',')]
    cw, ch, cols = 300, 430, 10
    out = sys.argv[3] if len(sys.argv) > 3 else f'{B}/out/sheet-boss.jpg'
else:
    files = sorted(glob.glob(f'{B}/out/bfx/*.jpg'))
    cw, ch, cols = 260, 280, 4
    out = f'{B}/out/sheet-bfx.jpg'
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cw * cols, ch * rows), (52, 56, 64))
d = ImageDraw.Draw(S)
for i, f in enumerate(files):
    x, y = (i % cols) * cw, (i // cols) * ch
    im = Image.open(f).convert('RGBA')
    if kind != 'boss': im = im.resize((256, 256))
    else: im.thumbnail((cw - 6, 400))
    # checker-ish bg tint per cell to reveal halos
    d.rectangle([x + 2, y + 2, x + cw - 3, y + ch - 3], fill=(70, 110, 80) if kind == 'boss' else (0, 0, 0))
    S.paste(im, (x + (cw - im.width) // 2, y + 4), im)
    d.text((x + 6, y + ch - 20), os.path.basename(f), fill=(255, 255, 255), font=font)
S.save(out, quality=82)
print(out, S.size, len(files))
