# 새 시즌 몹 그림 일감(v501) — 장마다 사람 · 요괴 몹 둘(또는 셋)을 옆보기 전신으로.
# python3 tools/s2art/mobs.py > tools/charv325/jobs_s2mob.json
import json, sys

STYLE = ("2D side-view enemy character sprite for a wuxia (Chinese martial arts fantasy) side-scrolling action RPG. "
         "Full body from head to feet, standing in a ready combat stance, body and face turned toward the RIGHT side of the image "
         "(right-facing three-quarter profile), feet flat at the bottom edge, whole figure inside the frame with a small margin. "
         "Hand-painted semi-realistic anime mobile game art, clean dark outline, soft cel shading, rich saturated colors, readable silhouette. "
         "Isolated on a fully transparent background: no ground, no cast shadow, no scenery, no text, no frame, no border, only ONE character. Character: ")

MOBS = {
  'c1a': 'a bamboo forest bandit, ragged green-brown hemp clothes, headband, holding a broad machete, rough beard',
  'c1b': 'a wandering ronin swordsman in a wide straw hat (conical), faded grey robe, drawn single-edged sabre held low',
  'c2a': 'a western desert raider, sand-colored turban and face veil, loose layered robes, curved scimitar in hand',
  'c2b': 'a desert shaman sorcerer, dark skin paint, bone necklace, ragged red and ochre robes, holding a skull-topped staff',
  'c3a': 'an ice palace female swordswoman, pale blue and white silk robes with frost patterns, long black hair, slim crystal sword',
  'c3b': 'an ice palace spear guard, white fur-trimmed armor with blue lacquer plates, holding a long spear with icy blade',
  'c4a': 'a blood valley outlaw brute, crimson leather armor, muscular, shaved head with scars, holding a heavy battle axe',
  'c4b': 'a blood cult assassin, black and deep red tight clothes, red mask over the lower face, twin curved daggers',
  'c5a': 'an imperial palace guard spearman, golden-red lacquered armor and helmet with red tassel, holding a halberd',
  'c5b': 'an imperial secret police swordsman, embroidered red flying-fish robe, black official hat, straight sword (xiuchun dao)',
  'c5c': 'a palace eunuch martial master, pale face, purple court robe with long sleeves, holding a horsehair whisk, sinister smile',
  'c6a': 'a Yangtze river pirate, bare arms with tattoos, blue cloth wrapped head, holding a hooked boat pole',
  'c6b': 'a river boatman fighter, straw rain cape over brown clothes, wielding a heavy wooden oar as a weapon',
  'c7a': 'a night market pickpocket thief, small and wiry, dark patched clothes, hood, holding a short knife, sly grin',
  'c7b': 'a drunken fist brawler, open loose robe, red face, holding a wine gourd in one hand and a fist raised',
  'c8a': 'a southern jungle tribal warrior, wooden demon mask, feathers, body paint, leaf skirt, holding a bamboo spear',
  'c8b': 'a southern jungle tribal herbalist mystic, colorful bead necklaces, feather headdress, green and gold face paint, holding a carved wooden staff with a small green snake coiled on it',
  'c9a': 'a Kunlun taoist priest, white and light blue taoist robe, hair in a topknot with a jade crown, holding a horsehair whisk and a talisman',
  'c9b': 'a celestial guardian spirit warrior, translucent glowing jade armor, floating ribbons, holding a halberd, serene face',
  'c10a': 'a Sichuan Tang clan hidden weapon expert, dark green tight clothes, belt full of throwing darts, holding darts between fingers',
  'c10b': 'a Qingcheng sect swordsman, sky blue taoist outfit, straight sword, calm young face',
  'c11a': 'a dark sect swordsman disciple, black and purple robes with flame embroidery, long untied hair, intense stare, holding a serrated sword',
  'c11b': 'a demonic cult armored enforcer, heavy black armor with red trim, horned helmet, wielding a large mace',
  'c12a': 'a poison valley corpse puppet (jiangshi-like zombie), green rotting skin, tattered official robe, arms outstretched, toxic mist',
  'c12b': 'a poison master, green and black robes, gourd of venom at the belt, gauntlet with poisoned claws, sickly pale face',
  'c13a': 'a Mount Hua sect male sword disciple, white robe with plum blossom embroidery, pink sash, straight sword',
  'c13b': 'a Mount Hua female plum blossom swordswoman, pink and white flowing robes, plum petals around, elegant sword',
  'c14a': 'a lava cave fire demon warrior, molten cracked rock skin with glowing orange veins, horns, holding a burning blade',
  'c14b': 'a small fire imp ghost, floating flame body with a mischievous face, carrying a flaming lantern, glowing embers',
  'c15a': 'a heavenly soldier, ornate golden celestial armor, white and red robes, cloud-patterned helmet, holding a halberd',
  'c15b': 'a celestial fairy warrior maiden, flowing white and gold silk ribbons floating, holding a jade sword, halo glow',
}

jobs = [{'name': k, 'prompt': STYLE + v + '.', 'size': '1024x1536', 'bg': 'transparent', 'q': 'high'} for k, v in MOBS.items()]
only = sys.argv[1:]
if only: jobs = [j for j in jobs if j['name'] in only]
print(json.dumps(jobs, ensure_ascii=False, indent=1))
