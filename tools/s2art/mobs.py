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

# 칸 두목(v502) — 장마다 하나, 옆보기 전신 · 크고 위엄 있게
BOSS_STYLE = STYLE.replace('enemy character sprite', 'BOSS enemy character sprite (imposing, powerful, ornate, larger-than-life presence, dramatic aura effects around the body)')
BOSSES = {
  'b1': 'the Twin Swords of the Bamboo Forest, a tall lean master swordsman in layered dark green robes with bamboo leaf patterns, holding two long swords crossed, green sword qi swirling',
  'b2': 'the Mad Demon of the Western Desert, a huge bearded warrior in brown and gold desert armor with a wide fur cape, wielding a giant crescent glaive, sand whirling around',
  'b3': 'the Ice Palace Mistress, a regal queen in white and pale blue silk robes with a crystal crown, long silver hair, holding a frost sword, snowflakes and ice shards floating',
  'b4': 'the Lord of Blood Valley, a grim veteran warlord in crimson and black armor with a torn red cape, holding a massive blood-red broadsword, red mist',
  'b5': 'the Imperial Guard Commander, a towering general in ornate golden lacquered armor with lion-head pauldrons and red cape, holding a long guandao halberd',
  'b6': 'the Dragon King of the Yangtze, a powerful river lord in deep blue scaled armor with dragon horns on the helmet, holding a trident, water swirling around',
  'b7': 'the Night Market Mastermind, an elegant sinister crime lord in black and dark gold robes with a fan and hidden blades, lantern light, smug expression',
  'b8': 'the High Priest of the Southern Jungle, a huge tribal chieftain with a carved beast mask crown, feathered cloak, bone ornaments, holding a giant totem staff, green spirit flames',
  'b9': 'the Immortal of Kunlun, an ancient taoist sage with long white beard and hair, flowing white and jade robes, floating flying sword beside him, holding a horsehair whisk, glowing clouds',
  'b10': 'the Master of the Tang Clan, a stern Sichuan clan leader in dark green and black robes, mechanical gauntlet, fanned out throwing knives and darts hovering around him',
  'b11': 'the Heavenly Demon, the supreme leader of the dark sect, black and crimson imperial robes with flame patterns, long black hair, intense red glowing eyes, dark purple and red demonic aura, holding a black sword',
  'b12': 'the Poison King, a gaunt master in green and black robes with a centipede and snake coiled on his arms, a large venom gourd, toxic green mist around',
  'b13': 'the Sword Empress of Mount Hua, a graceful swordswoman in pink and white robes with plum blossom embroidery, holding a long sword, a storm of plum petals around her',
  'b14': 'the Fire God, a colossal fire demon warlord with molten rock armor, flaming hair and beard, wielding a burning spear, embers and flames',
  'b15': 'the Jade Emperor, a majestic celestial emperor in gold and white imperial robes with a jeweled crown with hanging beads, holding a golden jade scepter, radiant halo and clouds',
}
jobs += [{'name': k, 'prompt': BOSS_STYLE + v + '.', 'size': '1024x1536', 'bg': 'transparent', 'q': 'high'} for k, v in BOSSES.items()]
only = sys.argv[1:]
if only: jobs = [j for j in jobs if j['name'] in only]
print(json.dumps(jobs, ensure_ascii=False, indent=1))
