# 이음매 없는 바닥 타일: 반 칸 민 그림과 가운데가 진한 가중치로 섞는다 → 가장자리는 민 그림의 가운데라 이어진다
import sys, os
import numpy as np
from PIL import Image
src, dst, size = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 512
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    im = np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    sh = np.roll(np.roll(im, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    dy = 1 - np.abs(yy / (h - 1) * 2 - 1); dx = 1 - np.abs(xx / (w - 1) * 2 - 1)
    m = np.clip(np.minimum(dx, dy) * 3.2, 0, 1)[..., None]   # 가장자리 ~15%만 섞는다
    out = im * m + sh * (1 - m)
    o = Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    o.save(os.path.join(dst, f.replace('.png', '.jpg')), quality=82, optimize=True)
    print(f, os.path.getsize(os.path.join(dst, f.replace('.png', '.jpg'))))
