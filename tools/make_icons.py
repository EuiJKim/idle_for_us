# 앱 아이콘 생성: python3 tools/make_icons.py
from PIL import Image, ImageDraw

def icon(size, pad_ratio):
    s = 1024
    img = Image.new('RGB', (s, s), '#0b1020')
    d = ImageDraw.Draw(img)
    for i in range(s):  # 세로 그라데이션 배경
        t = i / s
        d.line([(0, i), (s, i)], fill=(int(49 + 50 * t), int(46 + 10 * t), int(129 - 40 * t)))
    p = int(s * pad_ratio)
    c = s // 2
    k = (s - 2 * p) / 1024
    def P(x, y): return (c + x * k, c + y * k)
    # 검 (대각선)
    blade = [P(-40, 300), P(-10, -380), P(0, -420), P(10, -380), P(40, 300)]
    import math
    a = math.radians(-35)
    def rot(pt):
        x, y = pt[0] - c, pt[1] - c
        return (c + x * math.cos(a) - y * math.sin(a), c + x * math.sin(a) + y * math.cos(a))
    d.polygon([rot(q) for q in blade], fill='#e2e8f0', outline='#94a3b8')
    guard = [P(-170, 290), P(170, 290), P(170, 340), P(-170, 340)]
    d.polygon([rot(q) for q in guard], fill='#fbbf24')
    grip = [P(-28, 340), P(28, 340), P(28, 480), P(-28, 480)]
    d.polygon([rot(q) for q in grip], fill='#78350f')
    r = 50 * k
    pc = rot(P(0, 520))
    d.ellipse([pc[0] - r, pc[1] - r, pc[0] + r, pc[1] + r], fill='#fbbf24')
    # 별 장식
    for (x, y, rr) in [(-300, -250, 26), (280, -330, 18), (300, 200, 22), (-320, 260, 16)]:
        q = P(x, y)
        d.ellipse([q[0] - rr * k, q[1] - rr * k, q[0] + rr * k, q[1] + rr * k], fill='#fde68a')
    return img.resize((size, size), Image.LANCZOS)

icon(192, 0.08).save('icons/icon-192.png')
icon(512, 0.08).save('icons/icon-512.png')
icon(512, 0.2).save('icons/icon-maskable-512.png')
icon(180, 0.1).save('icons/apple-touch-icon.png')
print('ok')
