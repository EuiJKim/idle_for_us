# v607 모음 그림 — 병기 20 · 동료 25 · 영물 30 = 75장(이름 · 차례는 js/s2/tables/collnames.js와 같다)
# 사용: python3 tools/s2art/coll.py → tools/charv325/jobs_s2coll.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2coll.json <그린 폴더>/coll
#       python3 tools/s2art/pack.py <그린 폴더>   (coll: 투명 여백 잘라 160 정사각 WebP)
import json, os

BASE = ("for a Korean wuxia (martial arts fantasy) idle RPG. Hand-painted, rich detail, crisp clean silhouette, soft studio rim light, "
        "fully transparent background, no text, no letters, no border, no frame.")
ITEM = f"Single game item icon {BASE} 3/4 view, the object centered and filling about 80% of a square frame, no character, only the object."
FACE = (f"Single character portrait icon {BASE} Head and shoulders bust of one person in traditional Korean/East Asian martial-world clothing, "
        "facing slightly to the right, expressive face, centered and filling about 85% of a square frame, only this one person.")
BEAST = (f"Single creature icon {BASE} One cute but majestic spirit animal, full body, side-on 3/4 view facing right, "
         "centered and filling about 80% of a square frame, only this one animal.")

# 등급 다섯(보 4 · 진 3 · 정 2 · 양 1 · 범 0) — 재질과 기운
GRADE = [
  "Grade: common. Plain, worn and humble, muted grey-brown colors, no glow at all.",
  "Grade: uncommon. Sturdy and neat with small green jade accents, a very faint green shimmer.",
  "Grade: rare. Refined, silver trim and cloud patterns, a cool blue aura softly surrounding it.",
  "Grade: epic. Ornate with amethyst and gilded details, swirling violet qi energy around it.",
  "Grade: legendary. Lavish gold and white jade, radiant golden aura with small sparkles, awe-inspiring.",
]
def grade(i, n):
    f = i / n
    return 4 if f < 0.1 else 3 if f < 0.3 else 2 if f < 0.5 else 1 if f < 0.7 else 0

WEAPON = [
  "a divine straight jian sword crackling with thunder and lightning along the blade",
  "a huge heavy dao sabre with a dark world-ending aura, jagged spine",
  "a crescent-blade guandao polearm with an azure dragon coiled around the shaft",
  "a slender sword made of translucent ice crystal, frost mist around it",
  "a spear with a crimson wolf-fang blade and blood-red tassel",
  "a pair of heavy mountain-breaking gauntlets with stone and steel plates",
  "a traditional martial arts meteor hammer: a round bronze weight on a long coiled chain, museum display piece",
  "an elegant recurve bow shaped like a swallow in flight, with one arrow",
  "a cold-iron straight sword, dark blue-grey blade, simple strong guard",
  "a folding fan painted with black ink bamboo, steel ribs",
  "a steel single-edged sabre with a ring pommel",
  "a bronze-headed spear with a short red tassel",
  "a hardwood fighting staff with iron caps on both ends",
  "a hunter's bow with eagle feathers tied to it and a small quiver",
  "an old rusty chipped sword with a frayed cloth-wrapped hilt",
  "a wooden practice sword",
  "a simple long bamboo training pole with a cloth-wrapped grip",
  "a crude stone axe tied with rope to a wooden handle",
  "a pair of worn leather fighting gloves",
  "a small wooden slingshot with a pouch of pebbles",
]
PAL = [
  "a serene white-haired sword saint in flowing white robes, a sword hilt over his shoulder",
  "a sinister poison master woman in black with a black lotus hairpin, purple mist",
  "an elderly sect grandmaster in blue-grey Taoist robes with a long white beard and horsehair whisk",
  "a young swordswoman from the snowy mountains in white fur-trimmed robes, cold gaze",
  "a battle-scarred general in dark iron armor with a red cape",
  "a red-nosed drunken old master grinning with a wine gourd",
  "a nimble young woman in red with throwing knives between her fingers",
  "a bald muscular warrior monk with prayer beads and golden-bronze skin",
  "a stern escort-agency chief with a headband and travelling cloak",
  "a kind herbalist physician with a medicine box and herb basket",
  "a wandering swordsman with a straw hat, stubble and a weathered cloak",
  "a burly bandit chief with an eyepatch and fur collar, smirking",
  "a cheerful tavern hostess with her hair in a bun holding a wine jar",
  "a village guard warrior in simple padded armor",
  "a hunter with a fur cap and a bow on his back",
  "a woodcutter with a headcloth and an axe over his shoulder",
  "a fisherman with a wide bamboo hat and a fishing rod",
  "a young scholar in a black horsehair hat holding a book",
  "a little boy in a straw hat with rosy cheeks",
  "a travelling peddler with a big bundle on his back",
  "a tavern waiter boy with a towel over his shoulder, smiling",
  "a ragged beggar with messy hair, a patched robe and a wooden bowl",
  "a farmer with a straw hat and a hoe",
  "a shepherd boy playing a bamboo flute",
  "an old ferryman with a conical hat and an oar",
]
RELIC = [
  "an imperial yellow dragon with golden scales, coiled",
  "a phoenix with flaming red-gold tail feathers",
  "a qilin with deer body, dragon head, single horn and flowing mane",
  "a white tiger with black stripes and blue glowing eyes",
  "a black tortoise entwined with a snake (xuanwu)",
  "an azure blue dragon among clouds",
  "a vermilion bird with fiery wings spread",
  "a nine-tailed fox with pale golden fur",
  "a winged white celestial horse",
  "a snow leopard with thick spotted fur",
  "a shimmering golden koi carp leaping from a splash of water",
  "a white stag with branching antlers",
  "a fox with fur like flickering flames",
  "a blue-grey crane with a red crown, one leg raised",
  "a soft-shelled turtle with a mossy shell",
  "a mountain goat with curved horns standing on a rock",
  "an eagle with wings half spread",
  "a raccoon dog (tanuki) with a round belly",
  "an owl with big round eyes",
  "a wild boar with small tusks",
  "a slender weasel standing upright",
  "a plump sparrow",
  "a squirrel holding an acorn",
  "a white rabbit",
  "a green frog sitting",
  "a small pond turtle",
  "a calico cat sitting",
  "a fluffy puppy with a curled tail",
  "a yellow chick",
  "a butterfly with patterned wings",
]

jobs = []
for i, d in enumerate(WEAPON): jobs.append({'name': f'weapon-{i}', 'prompt': f"{ITEM} Object: {d}. {GRADE[grade(i, len(WEAPON))]}", 'q': 'medium'})
for i, d in enumerate(PAL): jobs.append({'name': f'pal-{i}', 'prompt': f"{FACE} Person: {d}. {GRADE[grade(i, len(PAL))]}", 'q': 'medium'})
for i, d in enumerate(RELIC): jobs.append({'name': f'relic-{i}', 'prompt': f"{BEAST} Animal: {d}. {GRADE[grade(i, len(RELIC))]}", 'q': 'medium'})
out = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2coll.json')
json.dump(jobs, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), 'jobs →', out)
