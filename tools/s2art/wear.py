# v517 새 시즌 — 장비를 끼면 모양이 바뀌는 몸 조각(등급 일곱마다)
#   상의 → 도포(몸통 그림) 7 · 모자 → 머리(같은 얼굴 + 쓰개) 7 · 무기 → 손에 쥔 무기(검 · 창 · 권갑 · 지팡이) 28
#   그림은 지금 몸 조각(art/hero)을 참고로 같은 시점 · 같은 틀로 다시 그리게 한다(tools/charv334 방식)
# 사용: python3 tools/s2art/wear.py → tools/charv325/jobs_s2wear.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2wear.json <그린 폴더>
#       python3 tools/s2art/wear_fit.py <그린 폴더>   (art/s2/wear/에 게임 조각 크기로)
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..', 'art', 'hero')
ref = lambda n: os.path.normpath(os.path.join(R, n + '.png'))

STYLE = ("Use EXACTLY the same hand-painted Korean wuxia (murim) manhwa illustration style as the references: crisp clean dark outlines, rich soft cel shading. ")
BODY = ("The FIRST reference is a robe/torso piece seen from a 3/4 PROFILE VIEW FACING RIGHT, with a short bare neck at the top. Draw a NEW outfit in EXACTLY the same pose, "
        "same 3/4 view facing right, same scale and same framing: the outfit fills the canvas from the neck at the very top to the hem at the very bottom, a short bare NECK (skin colored, "
        "cut cleanly at the top where a head would sit) rising out of the collar. NO head, NO hands, NO feet — sleeves end at the wrists with nothing beyond, the hem covers the legs. "
        "Transparent background, nothing else, no text. The new outfit: ")
TOPS = [
  "a plain, worn, patched hemp robe of a poor wanderer with a simple rope belt and a frayed hem, muted grey-brown, very simple shape.",
  "a neat practical martial-artist outfit: a short belted jacket over a long robe skirt, forest-green cloth with bronze toggles, a cloth sash belt with a small jade token, fitted sleeves.",
  "a refined sect disciple's uniform: layered blue and white silk robes with silver cloud-embroidered trims, a structured high collar, a wide dark-blue belt with a silver buckle, wide sleeves.",
  "an elite outfit with armor: black lacquered leather armor plates over a deep purple robe, one articulated pauldron on the near shoulder, amethyst studs and gilded edges, a plated waist guard.",
  "a legendary sect master's regalia: a white and gold dragon-brocade robe with golden dragon-head shoulder guards, carved jade belt plaques, long flowing gold-trimmed sleeves.",
  "a mythic phoenix war armor: crimson and gold scale armor over red robes, phoenix-feather shaped shoulder plates and layered skirt tassets, flame motifs on the trims.",
  "a celestial immortal's raiment: layered white jade-silk robes with platinum cloud and star ornaments, an ornate high collar, short floating ribbons kept inside the canvas.",
]
HEAD = ("The reference is a character's HEAD (same 3/4 view facing right). Redraw EXACTLY the same head — same face, same eyes, same expression, same hair and topknot bun, same skin, "
        "and only ADD the following headwear on the head. Nothing else changes. No body, no shoulders. "
        "Transparent background, no text. "
        # v585 턱이 화폭에 잘리지 않게 — 턱 · 수염 · 목 윗부분까지 다 보이고 아래에 빈 자리(tools/s2art/head_fit2.py로 맞춘다)
        "IMPORTANT FRAMING: show the COMPLETE head — the whole jaw, the full chin and the full beard tip must be entirely visible, followed by the top of the neck. "
        "Leave clear empty transparent space below the neck; nothing may be cut off by the bottom edge of the canvas. The head should occupy roughly the upper 75% of the canvas height. Headwear: ")
HATS = [
  "a plain wooden hairpin pushed through the topknot bun and a thin undyed cloth band around the bun.",
  "a small bronze topknot crown (guan) wrapping the bun, with a bronze hairpin and two short green ribbons.",
  "a silver topknot crown with cloud engravings, a long silver hairpin, and two flowing light-blue silk ribbons behind the head.",
  "a black lacquered tall guan with amethyst inlays and gold edges, a gold hairpin, and purple tassels hanging behind.",
  "an ornate golden crown with a coiled dragon motif and white jade, a long gold hairpin with pearl ends.",
  "a crimson-gold phoenix crown with upswept phoenix tail feathers rising behind the head, small flame ornaments.",
  "a white-jade and platinum celestial crown with star and cloud ornaments and a faint halo of light motes around it.",
]
WPN_REF = {'sword': 'wp-sword', 'spear': 'wp-spear', 'fist': 'wp-fist', 'staff': 'wp-spear'}
WPN_OBJ = {
  'sword': "a single straight double-edged jian sword, blade pointing straight up, handle and pommel at the bottom, a tassel hanging from the pommel",
  'spear': "a single long spear held vertically, the leaf-shaped spearhead at the top with a horsehair tassel under it, the long shaft running to the bottom",
  'fist':  "a single martial-arts gauntlet (a fist weapon worn on the hand) seen upright, metal knuckle plates on top, the cuff at the bottom, NO blade",
  'staff': "a single long taoist staff held vertically, an ornamented head at the top holding a glowing orb, the long shaft running to the bottom",
}
WPN_G = [
  "plain dark iron and worn wood, simple shape, no glow.",
  "polished bronze fittings with green jade accents and dark green wraps, a faint green shimmer.",
  "blue-tempered steel with silver cloud engravings and blue silk wraps, a soft blue glow.",
  "black lacquer with amethyst inlays and gold edges, swirling violet glow.",
  "gold filigree and carved white jade with a coiled dragon motif, radiant golden glow.",
  "crimson and gold with phoenix feather motifs, wrapped in red-orange spirit flames.",
  "white jade and platinum with cloud and star motifs, brilliant white-gold light.",
]
WPN = ("The reference is a weapon piece for a character rig: ONE object drawn vertically, centered, filling the canvas from top to bottom. Draw a NEW weapon in EXACTLY the same "
       "orientation (vertical, upright), same framing and similar proportions, transparent background, nothing else, no text, no hand. The weapon: ")

jobs = []
for g, d in enumerate(TOPS):
    jobs.append({'name': f'body-{g}', 'refs': [ref('body-r0'), ref('head-topknot')], 'size': '1024x1536', 'q': 'medium', 'prompt': STYLE + BODY + d})
for g, d in enumerate(HATS):
    jobs.append({'name': f'head-{g}', 'refs': [ref('head-topknot')], 'size': '1024x1024', 'q': 'medium', 'prompt': STYLE + HEAD + d})
for k, obj in WPN_OBJ.items():
    for g, d in enumerate(WPN_G):
        jobs.append({'name': f'wp-{k}-{g}', 'refs': [ref(WPN_REF[k])], 'size': '1024x1536', 'q': 'medium', 'prompt': STYLE + WPN + obj + '. Materials: ' + d})
out = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2wear.json')
json.dump(jobs, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), 'jobs →', out)
