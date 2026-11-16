# v518 새 시즌 — 나머지 부위도 모양 그림으로(등급 일곱마다)
#   신발 → 장화 · 하의 → 다리(바지 · 각반 · 정강이받이) · 장갑 → 앞팔 보호대 · 망토(몸 뒤) · 허리띠(띠 + 노리개)
#   목걸이 → 가슴 노리개 · 반지 → 발밑 문양 · 궁사 활 = 56장
# 사용: python3 tools/s2art/wear2.py → tools/charv325/jobs_s2wear2.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2wear2.json <그린 폴더>
#       python3 tools/s2art/wear_fit.py <그린 폴더>   (art/s2/wear/에)
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..', 'art', 'hero')
ref = lambda n: os.path.normpath(os.path.join(R, n + '.png'))
STYLE = ("Hand-painted Korean wuxia (murim) manhwa illustration style: crisp clean dark outlines, rich soft cel shading, game-ready 2D character rig piece. "
         "Transparent background, only the object, no text, no character, no hands, no body unless stated. ")
G = [
  "Grade common: plain worn materials, rough undyed hemp and dark leather, muted grey-brown, simple shape, no glow.",
  "Grade uncommon: neat dyed forest-green cloth with bronze fittings and small green jade accents.",
  "Grade rare: refined blue silk and blue-tempered steel with silver cloud trims.",
  "Grade epic: black lacquered plates with amethyst studs and gold edges, faint violet glow.",
  "Grade legendary: white brocade and gold filigree with dragon motifs and white jade, golden glow.",
  "Grade mythic: crimson and gold with phoenix feather and flame motifs, red-orange glow.",
  "Grade celestial: white jade and platinum with cloud and star motifs, soft white-gold light.",
]
OBJ = {
  'boot': ("ONE single martial-arts boot seen exactly from the SIDE, the toe pointing to the RIGHT, the flat sole at the bottom, the boot shaft rising to just above the ankle "
           "(cut cleanly at the top). Compact, chunky proportions for a small game character."),
  'leg': ("ONE single trouser leg piece for a 2D rig, drawn perfectly VERTICAL: from the thigh (top edge, cut straight) down to the ankle (bottom edge, cut straight), "
          "slightly tapered, as seen from the side. No foot, no body. It shows the trouser cloth and any wraps, bindings or armored greave on the shin."),
  'arm': ("ONE single forearm piece for a 2D rig, drawn perfectly HORIZONTAL: from the elbow (left edge, cut straight) to the wrist (right edge, cut straight), "
          "wearing a vambrace / bracer over the sleeve. No hand, no upper arm."),
  'belt': ("ONE waist sash belt seen from the front at a slight 3/4 angle, laid HORIZONTALLY as a wide band (slightly curved), a decorated buckle right of center, "
           "and a hanging pendant with a short tassel dangling below the buckle."),
  'neck': ("ONE necklace seen from the front: a short cord forming a U at the top and a carved pendant hanging at the bottom center. Small and compact."),
  'ring': ("ONE glowing magic circle (a martial sect rune seal) seen from DIRECTLY ABOVE, perfectly round, intricate concentric rings of runes and symbols, "
           "glowing lines on transparent background, no ground."),
  'bow': ("ONE recurve composite bow laid HORIZONTALLY, the grip at the center, both limbs curving UPWARD toward the ends like a shallow U, NO bowstring, no arrow."),
}
CAPE = ("The reference is a robe/torso piece of a character seen from a 3/4 PROFILE VIEW FACING RIGHT. Draw ONLY a CAPE (cloak) as it would hang BEHIND this character from the "
        "shoulders, in EXACTLY the same view, scale and framing as the reference (shoulders at the same height, the cape falling down behind to about knee-to-ankle height and "
        "flaring out to the LEFT, the back side). Do NOT draw the robe, body, neck or head — only the parts of the cape, as one piece, transparent everywhere else. ")
# 범급 활은 낱말이 안전 검사에 걸렸다 — 장식 아이템으로 순하게
BOW0 = ("Hand-painted Korean fantasy manhwa game item art: crisp clean dark outlines, soft cel shading. Transparent background, only the object, no text. "
        "Object: a simple traditional wooden recurve bow as a decorative game item, laid horizontally, grip at the center, both ends curving upward like a shallow U, no string. "
        "Plain natural wood and dark leather grip, muted brown colors.")
jobs = []
for k, d in OBJ.items():
    for g, gd in enumerate(G):
        p = BOW0 if (k, g) == ('bow', 0) else STYLE + 'Object: ' + d + ' ' + gd
        jobs.append({'name': f'{k}-{g}', 'size': '1024x1536' if k == 'leg' else '1536x1024' if k in ('arm', 'belt', 'bow') else '1024x1024', 'q': 'medium',
                     'bg': 'transparent', 'prompt': p})
for g, gd in enumerate(G):
    jobs.append({'name': f'cape-{g}', 'refs': [ref('body-r0')], 'size': '1024x1536', 'q': 'medium',
                 'prompt': "Use EXACTLY the same hand-painted Korean wuxia manhwa illustration style as the reference: crisp clean dark outlines, rich soft cel shading. " + CAPE + gd})
out = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2wear2.json')
json.dump(jobs, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), 'jobs →', out)
