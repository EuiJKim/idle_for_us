# v532 장 두목 그림 일감 — 장(10칸)마다 하나, 칸 두목(b1~b15)과 다른 새 얼굴. 옆보기 전신 · 크고 위엄 있게.
# python3 tools/s2art/chb.py > /tmp/jobs_chb.json ; python3 tools/charv325/run.py /tmp/jobs_chb.json tools/s2art/chb_raw
import json

STYLE = ("2D side-view BOSS character sprite for a wuxia (Chinese martial arts fantasy) side-scrolling action RPG. "
         "An imposing, powerful, ornate, larger-than-life chapter boss with dramatic aura effects around the body. "
         "Full body from head to feet, standing in a menacing combat stance, body and face turned toward the RIGHT side of the image "
         "(right-facing three-quarter profile), feet at the bottom edge, whole figure inside the frame with a small margin. "
         "Hand-painted semi-realistic anime mobile game art, clean dark outline, soft cel shading, rich saturated colors, readable silhouette. "
         "Isolated on a fully transparent background: no ground, no cast shadow, no scenery, no text, no frame, no border, only ONE character. Character: ")

# 장 → 그림 설명(이름 · 칭호는 js/s2/tables/chboss.js)
CHB = {
  1: 'the Green Forest Bandit Overlord, a giant hulking bandit king in a cloak of bamboo leaves and rough fur, wild beard, wielding a colossal guandao with a bamboo-green blade, green wind swirling',
  2: 'the Sand Sovereign, a tall desert sorcerer-king in layered gold and ochre robes with a jeweled turban and veil, a giant scorpion tail of sand rising behind him, holding a golden khopesh, sand storm aura',
  3: 'the Frost Wolf General, a towering warrior in white wolf-pelt armor with an ice-blue lacquered breastplate and a wolf-head helmet, wielding a huge frost glaive, a spectral ice wolf aura behind him',
  4: 'the Blood Serpent Demon Lord, a pale sinister demon martial lord in black and crimson robes, long white hair, holding a long segmented blood-red chain whip shaped like a serpent, red mist and blood serpents coiling',
  5: 'the Golden Guard Grand Commander, a massive imperial general in heavy golden dragon armor with a tall plumed helmet and a flowing red cape, holding two enormous golden maces',
  6: 'the River Fortress Dragon Chief, a broad river pirate warlord in sea-green scale armor and a tattered blue cape, braided beard, wielding a giant iron ship anchor on a chain, waves crashing around him',
  7: 'the Masked Gambling King of the night market, a flamboyant sinister lord in black and crimson silk with gold coin embroidery, a grinning demon mask, juggling huge iron dice on chains, floating lanterns and gold coins',
  8: 'the Beast King of the Southern Jungle, a colossal half-tiger shaman giant with striped fur, bone and jade ornaments, a feathered headdress, huge claws, green spirit flames and a phantom tiger roaring behind him',
  9: 'the Cloud Immortal of Kunlun, an ethereal immortal swordsman in flowing white and celestial blue robes with cloud patterns, long silver hair, a ring of glowing flying swords circling behind him, soft clouds',
  10: 'the Iron-Winged Hawk Master of the Sichuan cliffs, a fierce martial artist with great mechanical iron wings on his back, dark brown leather and steel armor, a hawk-feather headdress, steel talon gauntlets',
  11: 'the Left Guardian of the Demon Cult, a terrifying tall demonic warrior in black lacquered armor with crimson flame patterns, horned demon helmet, wielding a giant black-flame scythe, purple and red demonic fire aura',
  12: 'the Poison Matriarch of the Poison Valley, a sinister beautiful older woman in dark green and violet robes with jade ornaments, long nails, a giant venomous centipede coiling around her, toxic green mist',
  13: 'the Fallen Sword Demon of Mount Hua, a once-righteous swordsman turned demon, torn white and black robes with withered dark plum blossom embroidery, wild hair, glowing red eyes, a cracked dark sword, black plum petals storm',
  14: 'the Lava Demon Colossus, a hulking demon giant made of black volcanic rock with glowing molten cracks, flaming horns, a massive magma hammer, embers and lava dripping',
  15: 'the Lord Beyond the Heavens, a godlike cosmic martial deity with six arms each holding a different glowing weapon, white and gold celestial armor, a starry cosmic cape, a radiant halo of runes behind his head',
}
jobs = [{'name': f'chb{n}', 'prompt': STYLE + v + '.', 'size': '1024x1536', 'bg': 'transparent', 'q': 'high'} for n, v in CHB.items()]
print(json.dumps(jobs, ensure_ascii=False, indent=1))
