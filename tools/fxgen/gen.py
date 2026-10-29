# 무공 빛 그림 만들기 (v133) — OpenAI gpt-image-2.5-sunburst. 키는 코드에 없다: 작업 환경의 네트워크 시크릿(api.openai.com)이 붙여 준다.
# 쓰는 법: cd tools/fxgen && python3 gen.py [이름…]  (Q=medium 이면 중간 품질 — 정사각 고품질은 가끔 중간 서버에서 끊긴다)
#         python3 fit.py  → out/에 옛 그림과 같은 크기·자리로 맞춘 흑백 그림, art/fx/로 옮긴다 (그 뒤 LA로 줄였다)
import json, base64, subprocess, sys, concurrent.futures as cf, os
STYLE = ("Single game VFX sprite for a 2D wuxia martial-arts mobile game, painterly ink-brush energy with soft glow, wisps and fine sparks. "
         "Pure white and light grey only — absolutely no color — so the game can tint it. Fully transparent background, nothing else in the image: "
         "no ground, no character, no text, no frame. ")
JOBS = {
 'fx-ring': ("A flat circular shockwave ring of qi energy seen from directly above: one thick glowing ring with brush-stroke texture, faint inner ripple, empty transparent center. Perfectly round, centered, filling most of the canvas.", "1024x1024"),
 'fx-slash': ("A single crescent sword-slash arc, bright sharp leading edge fading into ink wisps, a few sparks. Crescent bulges to the left, tips pointing up and down. Centered.", "1024x1536"),
 'fx-field': ("A circular martial-arts seal on the ground seen from directly above: concentric rings, eight radial spokes, faint trigram-like brush marks, mystical. Perfectly round and centered.", "1024x1024"),
 'fx-burst': ("A radiant impact hit-flash: bright core with sharp star rays in all directions and a soft ink splash halo. Centered, symmetric-ish.", "1024x1024"),
 'fx-bolt': ("A single vertical lightning bolt striking downward from top to bottom, jagged with thin branching forks and a soft glow. Tall and narrow, centered.", "1024x1536"),
 'fx-beam': ("A long horizontal sword-qi beam: a thin intensely bright core line with a lens-flare center and streaky energy fading at both ends, horizontally centered.", "1536x1024"),
 'fx-blink': ("A dash afterimage: a bright crescent on the left edge with long horizontal speed streaks trailing to the right, like a body blinking forward. Centered.", "1536x1024"),
 'fx-aura': ("A rising aura of qi: wavy flame-like wisps and smoke rising upward from a bright base at the bottom center, tapering to the top.", "1024x1536"),
 'fx-swirl': ("A whirlwind tornado of wind qi: spiral bands twisting upward, wide at top, narrow at a bright base at the bottom center.", "1024x1536"),
}
def gen(name):
    prompt, size = JOBS[name]
    req = {"model": "gpt-image-2.5-sunburst", "prompt": STYLE + prompt, "size": size, "background": "transparent", "output_format": "png", "quality": os.environ.get("Q", "high"), "n": 1}
    f = f'gen/{name}.req.json'; json.dump(req, open(f, 'w'))
    out = subprocess.run(['curl', '-sS', '-m', '300', 'https://api.openai.com/v1/images/generations', '-H', 'Content-Type: application/json', '-d', '@' + f], capture_output=True, text=True)
    try: d = json.loads(out.stdout)
    except Exception: return name, ('bad', out.stdout[:200], out.stderr[:300])
    if 'error' in d: return name, d['error']
    open(f'gen/{name}.png', 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return name, 'ok'
names = sys.argv[1:] or list(JOBS)
with cf.ThreadPoolExecutor(int(os.environ.get("PAR", "1"))) as ex:
    for r in ex.map(gen, names): print(*r)
