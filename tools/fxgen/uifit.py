# 창틀(384, 9조각 52px)과 앱 아이콘 넷을 만든다
import os
from PIL import Image
R = '/home/user/idle_for_us'
if os.path.exists('ui/icon.png'):
    ic = Image.open('ui/icon.png').convert('RGB')
    for name, n in [('icon-512', 512), ('icon-maskable-512', 512), ('icon-192', 192), ('apple-touch-icon', 180)]:
        ic.resize((n, n), Image.LANCZOS).save(f'{R}/icons/{name}.png', optimize=True)
        print(name, os.path.getsize(f'{R}/icons/{name}.png'))
