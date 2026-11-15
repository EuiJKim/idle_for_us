# v515 새 시즌 장비 그림 — 부위 열 × 등급 일곱(무기는 직업 다섯) = 98장
# 사용: python3 tools/s2art/eq.py → tools/charv325/jobs_s2eq.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2eq.json <그린 폴더>/eq
#       python3 tools/s2art/pack.py <그린 폴더>   (eq: 투명 여백 잘라 256 정사각 WebP)
import json, os

STYLE = ("Single game item icon for a Korean wuxia (martial arts fantasy) idle RPG. Hand-painted, rich detail, crisp clean silhouette, "
         "3/4 view, the object centered and filling about 80% of a square frame, soft studio rim light, subtle drop shadow under nothing, "
         "fully transparent background, no text, no letters, no border, no frame, no character, only the object.")

# 등급 일곱 — 재질과 기운이 오른다(색은 화면의 등급 색과 맞춤: 회 · 초록 · 파랑 · 보라 · 금 · 붉음 · 흰빛)
GRADE = [
  "Grade: common. Plain worn iron, rough undyed hemp and leather, muted grey-brown colors, simple shape, no glow at all.",
  "Grade: uncommon. Sturdy polished bronze and dyed cloth with small green jade accents, neat stitching, a very faint green shimmer.",
  "Grade: rare. Refined blue-tempered steel and silk with silver trim and cloud engravings, a cool blue aura softly surrounding it.",
  "Grade: epic. Ornate black lacquer with amethyst inlays and gilded edges, elaborate patterns, swirling violet qi energy around it.",
  "Grade: legendary. Lavish gold filigree, carved white jade and pearls, dragon motifs, radiant golden aura with small sparkles.",
  "Grade: mythic. Divine crimson and gold, phoenix feather and flame motifs, burning red-orange spirit flames wrapping around it.",
  "Grade: celestial. Heavenly white jade and platinum, cloud and star motifs, brilliant white-gold halo and floating light motes, awe-inspiring.",
]

WEAPON = {
  'sword': "a straight double-edged jian sword with a hilt tassel, shown diagonally from bottom-left to top-right",
  'spear': "a long qiang spear with a leaf-shaped blade and a red horsehair tassel under the blade, shown diagonally",
  'fist':  "a pair of martial arts gauntlets with metal knuckle plates (fist weapons), shown side by side",
  'bow':   "a recurved composite bow with a single arrow nocked, shown diagonally",
  'mage':  "a taoist magic staff with an ornamented head holding a glowing orb, shown diagonally",
}
SLOT = {
  'hat':    "a martial artist's headpiece: a topknot hair crown (guan) with a long hairpin and short ribbons",
  'top':    "a wuxia martial robe jacket (upper garment) with crossed collar and wide sleeves, laid flat and slightly turned",
  'bottom': "loose martial arts trousers with fitted ankle wraps, laid flat",
  'glove':  "a pair of martial arts bracers / wrist guards with laces",
  'shoes':  "a pair of martial arts cloth boots with thick soles",
  'cape':   "a flowing cloak (pifeng) with a clasp at the collar, billowing slightly",
  'belt':   "a wide waist sash belt with a decorated buckle and a hanging jade pendant with tassel",
  'neck':   "a necklace: a carved pendant hanging from a braided cord with small beads",
  'ring':   "a single ring with a set gemstone, shown at an angle",
}

jobs = []
for k, d in WEAPON.items():
    for g, gd in enumerate(GRADE):
        jobs.append({'name': f'w-{k}-{g}', 'prompt': f"{STYLE} Object: {d}. {gd}", 'q': 'medium'})
for k, d in SLOT.items():
    for g, gd in enumerate(GRADE):
        jobs.append({'name': f'{k}-{g}', 'prompt': f"{STYLE} Object: {d}. {gd}", 'q': 'medium'})
out = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2eq.json')
json.dump(jobs, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), 'jobs →', out)
