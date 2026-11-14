# 새 시즌 장 그림 → 웹용(WebP). 그림은 tools/charv325/run.py로 그린다(jobs_s2bg.json · jobs_s2ledge.json).
# 사용: python3 tools/s2art/pack.py <그린 폴더(bg/ ledge/ 들어 있음)>
#   배경: 1536×1024 → WebP 품질 78
#   발판: 투명 여백을 잘라 내고 가로 1024로 → WebP(투명 유지) 품질 85
#   무공 효과(fx): 검은 바탕 → 가로 768 WebP 품질 80(jobs_s2fx.json)
import sys, os
from PIL import Image
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), '..', '..', 'art', 's2')
for kind in ('bg', 'ledge', 'fx'):
    if not os.path.isdir(f'{src}/{kind}'): continue
    os.makedirs(f'{out}/{kind}', exist_ok=True)
    for f in sorted(os.listdir(f'{src}/{kind}')):
        if not f.endswith('.png'): continue
        im = Image.open(f'{src}/{kind}/{f}')
        if kind == 'fx':
            # 무공 효과: 검은 바탕 그대로(화면에서 빛을 더하는 방식으로 겹친다) · 가로 768
            im = im.convert('RGB'); im = im.resize((768, round(im.height * 768 / im.width)), Image.LANCZOS)
            im.save(f'{out}/{kind}/{f[:-4]}.webp', 'WEBP', quality=80, method=6)
        elif kind == 'bg':
            im = im.convert('RGB')
            im.save(f'{out}/{kind}/{f[:-4]}.webp', 'WEBP', quality=78, method=6)
        else:
            im = im.convert('RGBA'); bb = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if bb: im = im.crop(bb)
            if im.width > 1024: im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
            im.save(f'{out}/{kind}/{f[:-4]}.webp', 'WEBP', quality=85, method=6)
        print(kind, f, os.path.getsize(f'{out}/{kind}/{f[:-4]}.webp') // 1024, 'KB')
