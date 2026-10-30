import json, sys
D = sys.argv[1] if len(sys.argv) > 1 else '.'

STYLE = (" Art style: polished hand-painted 2D game sprite like a premium fantasy mobile RPG, rich painterly detail, "
         "clean dark ink outline, soft shading, vivid but tasteful colors, imposing boss presence, slightly heroic "
         "proportions (realistic adult proportions, NOT chibi). Composition: exactly ONE character, full body from the top "
         "of the head down to both feet, the whole figure inside the frame with a small margin, standing in a battle-ready "
         "stance, three-quarter view with the body and face turned toward the RIGHT side of the image. "
         "Isolated on a fully transparent background: no ground, no floor, no cast shadow, no scenery, no text, no "
         "lettering, no frame, no border. Non-gory.")

PRE = "Full-body character sprite of a single Korean/Chinese wuxia martial-arts boss: "

ZB = {
 0: "the chief of the Black Wind bandit fortress, a burly brutal mountain bandit lord with a bushy black beard, black robe with dark blood-red trim and a shaggy fur mantle over one shoulder, black cloth headband, leather bracers, gripping a huge double-bladed battle axe, grinning menacingly.",
 1: "the Poison-Hand Demon Lord, a gaunt sinister poison master with sallow skin, dark forest-green robe with acid lime-green trim, hair in a tight topknot, long iron claw talons on both hands dripping glowing green venom, wisps of lime-green toxic mist aura around him.",
 2: "the Blood-Sand Saber King of the western desert, a scarred desert warlord with a dark beard, deep crimson robe with gold trim, a sand-colored hooded desert headwrap and veil scarf, heavy curved broad dao saber with a golden guard, swirling sand and crimson qi.",
 3: "the Master of the Ice-White Palace, a cold aloof handsome middle-aged man with long silver-white hair tied in a topknot with an ice-crystal crown pin, flowing pure white robe with sky-blue trim and frost patterns, holding an open steel war fan rimmed with ice, frost-blue aura with drifting snowflakes and ice crystals.",
 4: "an elder of the Blood Cult, an ancient sinister old man with white topknot hair and a long white beard, very dark maroon robe with bright red trim, glowing red eyes, long crimson-lacquered claw nails, a swirling blood-red qi aura.",
 5: "the Jiangshi King, a hopping Qing-dynasty Chinese jiangshi (vampire zombie): rigid stiff pose with both arms stretched straight forward toward the right, feet together as if mid-hop, wearing an ornate dark navy-black Qing official robe with gold trim and a gold embroidered mandarin square badge, a Qing official hat with a yellow paper talisman with red brush marks hanging over the face, pale grey-green skin, long black fingernails, faint eerie green ghost mist. Spooky but not gory.",
 6: "the Taiji Sword Immortal of Wudang, a serene elderly Taoist master with white hair in a topknot under a small jade crown and a long flowing white beard, pure white Taoist robe with black trim and a black-and-white taiji yin-yang emblem on the back, holding a straight jian sword held in a graceful stance, soft silver-white aura swirling like mist.",
 7: "the Heavenly Demon, supreme lord of the demonic cult, a young terrifying handsome man with long loose black hair partly tied in a topknot, jet-black robe with crimson trim and black lacquered shoulder armor, glowing red eyes, holding a black straight jian sword wreathed in crimson flame, crimson demonic aura.",
 8: "the Lord of the Eighteen River Fortresses, a muscular river pirate king with a thick beard and bare muscular chest, deep navy robe with sky-blue trim tied at the waist, bright blue headband, gripping a giant boarding axe, splashing water and blue qi aura.",
 9: "the head monk of the Bodhidharma Hall of Shaolin, a massive muscular bald warrior monk with a short beard, saffron golden kasaya robe with brown trim, large wooden prayer beads around the neck, bare fists wrapped in cloth, golden Buddhist glow aura behind him.",
 10: "the underworld boss of the Luoyang night market, a heavyset crime lord with a groomed beard and gold rings, black silk robe with amber-gold trim, amber headband, a gold-handled dao saber, a cold smug look, golden aura and coins glinting.",
 11: "the Plum Blossom Sword Venerable of Mount Hua, a dignified elder with white topknot hair and a white beard, pale blush-white robe with crimson trim and red plum blossom embroidery, holding a straight jian sword, swirling pink plum petals aura.",
 12: "the Lord of the Five Poisons Cult of the southern jungles, a wild exotic sorcerer with a beard and a topknot with a bone pin, dark green robe with bright green trim, centipede, snake and scorpion motifs, long venomous claws, glowing pale green eyes, a green venom snake coiling around one arm, green poison aura.",
 13: "the Master of the Ancient Tomb, a pale ghostly sinister old figure with grey hair in a topknot, deep indigo robe with lime-green trim, glowing lime-green eyes, long bony claws, eerie green ghost-fire wisps floating around.",
 14: "the Flood Dragon King of the East Sea, a regal sea-dragon lord with cyan-tinted hair in a topknot and small dragon horns, deep navy robe with cyan trim over blue-green dragon scale armor, glowing cyan eyes, wielding a long trident spear, swirling sea water aura.",
 15: "the Venerable Beyond the Heavens, a godlike celestial martial sage with flowing white hair and white beard, radiant pure white robe with gold trim and golden celestial armor plates, a golden halo ring behind his head, holding a shining straight jian sword, pale golden divine aura - the most grand and majestic.",
 16: "the Master of Peach Blossom Island, an elegant scholar-hermit with black hair in a topknot and a neat black beard, pale pink robe with deep pink trim, a jade flute tucked in the sash, holding a straight jian sword, swirling peach blossom petals aura.",
 17: "the Admiral of the Eastern Depot, a sinister Ming dynasty eunuch commander, beardless pale face, black gauze official hat (wushamao), dark navy-black court robe with gold python embroidery and gold trim, long golden claw nail guards on his fingers, glowing pale yellow eyes, golden aura.",
 18: "Tang Cheon, head of the Sichuan Tang clan of hidden weapons, a shrewd man with a topknot and beard, dark green robe with green trim, leather straps and pouches holding throwing knives, a fan of glowing throwing daggers between his fingers, green aura.",
 19: "Seolhwa, Mistress of the North Sea Ice Palace, a beautiful cold woman with long silver-white hair in an elegant updo with ice crystal ornaments, white robe with deep blue trim and a frosted cape, glowing ice-blue eyes, holding a crystalline ice jian sword, pale icy blue aura with snowflakes.",
 20: "Hwaun, the Flame Emperor, a towering muscular fire martial artist with blazing orange flame-like hair in a topknot, dark ember-brown robe with orange trim open at the chest, glowing yellow eyes, both fists engulfed in fire inside iron gauntlets, roaring orange fire aura.",
 21: "the Jade Void Taoist Immortal of Mount Kunlun, an ancient serene immortal sage with flowing white hair under a jade lotus crown and a very long white beard, white robe with gold trim and cloud patterns, a horsetail fly-whisk over one arm and a straight jian in the other hand, pale yellow cloud-like aura.",
}

KG = {
 1: "the Sword King, Ak Gunhak, strongest of the Twelve Kings and the greatest martial artist under heaven: an imposing majestic master with silver-grey hair in a topknot with a gold crown and a long grey beard, flowing white robe with gold trim and gold embroidered dragons, holding a straight jian; several faint translucent spectral 'formless' swords float around him, radiant pale gold aura. The most grand and majestic of all.",
 2: "the Saber King, Naeng Musang, a cold expressionless master of the saber, lean and tall, slate dark navy robe with white trim, black headband with long tails, long heavy dao saber with sun and moon engravings, icy white qi trailing from the blade.",
 3: "the Battle King, Cheonya, a hulking bald brawler who only values winning, scarred muscular body, brown robe with gold trim and bronze protective armor plates, wearing massive ornate bronze war gauntlets, golden fighting qi aura.",
 4: "the Killer King, leader of the Myeongbu assassin guild, a slender deadly assassin in a black robe with dark red trim, wearing an expressionless white underworld judge mask with red markings, a reverse-grip dagger in each hand, black hood scarf, faint dark red mist.",
 5: "the Illusion King, a mysterious painter-advisor, violet robe with lavender trim, a half porcelain theatrical mask with painted patterns, holding a large painted folding fan and a calligraphy brush, ghostly mirage afterimages of himself in pale violet.",
 6: "the Dark King, Heuk Sarin, a night assassin lord in a jet-black robe with deep purple trim, deep hood shadowing his face with glowing violet eyes, twin curved daggers, swirling violet-black night aura with crescent moon motif.",
 7: "the Flower King, Cha Iran, a breathtakingly beautiful woman who leads an assassin guild, magenta robe with pale pink trim and flowing sleeves, black hair in an ornate updo with gold hairpins and flowers, holding an open folding fan with hidden blades, swirling pink petals.",
 8: "the Wood King, Baek Cheongyeong, a stern elder with a topknot and a beard, dark green robe with pale green trim and leaf patterns, a straight jian with a wooden scabbard, living vines and green leaves swirling around him.",
 9: "the Blood King, a cruel tyrant from the North Sea, dark red robe with pale pink trim, topknot, long crimson claws, emerging wreathed in a swirling crimson blood-mist aura, cruel smile (not gory).",
 10: "the Sound King, Sin Ryu, a blind master of sonic martial arts, wearing a dark cloth blindfold under a wide bamboo hat, indigo robe with periwinkle trim, a guqin zither strapped to his back and a folding fan in hand, pale glowing sound-wave rings and ghostly wisps around him.",
 11: "the Iron King, Gi Sahu, a genius mechanist hidden under an iron mask, grey robe with silver trim over riveted iron armor and brass gears, one mechanical iron arm, wielding a huge mechanical axe, small puppet parts hanging from his belt.",
 12: "the Fist King, Gang Hu, a murderous fist fighter with natural killing intent, black robe with red trim, dark red headband, scarred knuckles in black iron fist gauntlets, menacing red eyes, crackling red murderous aura.",
}

MS = {
 'namgung': "Namgung Cheong, the young upright head of the Namgung sword family, handsome and straight-backed, navy blue robe with light blue trim, hair in a neat topknot with a silver crown, holding a straight jian pointed forward, light blue sky qi aura.",
 'hyegong': "Great Master Hyegong, the elderly abbot of Shaolin who achieved the Diamond Indestructible Body, bald with long white eyebrows, orange-red kasaya robe with pale gold trim, large prayer beads, faintly golden glowing skin, palms raised in a fighting stance, golden Buddhist aura.",
 'cheongheo': "Cheongheo, the Taoist head of Wudang, an old sage with grey-white hair in a topknot and a long beard, pale grey-white Taoist robe with slate trim and a taiji emblem, a horsetail whisk and a straight jian, soft white circular qi swirl.",
 'jinhagun': "Jin Hagun, the young captain of the Demon-Slaying Squad, determined and fierce, royal blue robe with bright yellow trim over a light armored vest, dark navy headband, holding a straight jian, light blue aura.",
 'guryeong': "Guryeong, a female saber master of the orthodox sects, wearing a wide bamboo hat with a grey veil, slate grey robe with pale silver trim, slim and strong, holding a long dao saber, cool grey aura.",
 'jingwang': "Jin Gwang, the hidden blade of the Jin family, an elder swordsman with grey hair in a topknot and a beard, pale sky-blue robe with deep blue trim, holding a straight jian, eight sky-blue sword qi rays radiating behind him.",
 'imsanggon': "Im Sanggon, the Great Righteous Hero, a stout heroic broad-shouldered warrior with black hair in a topknot and a full black beard, black-navy robe with bright yellow trim, a big heavy dao saber, bright yellow righteous qi aura.",
 'jinpaecheon': "Jin Paecheon, the Lord of the Murim Alliance, a domineering powerful old grandmaster with white hair in a topknot under a gold crown and a long white beard, royal blue robe with gold trim, gold armored pauldrons and a flowing gold-lined cape, glowing golden eyes, holding a magnificent straight jian, overwhelming golden aura. Extremely grand and majestic, a supreme leader.",
 'gwangseom': "Gwangseom, the Mad Lightning, the fastest saber of the unorthodox faction, a lean wild desert swordsman, rust-brown robe with amber trim, black headband, crouched low ready for a quick-draw, curved saber crackling with yellow lightning.",
 'georyeok': "the Giant-Strength Ghost Spear, a huge hulking brute with a rough beard, dark stone-grey robe with red trim, dark red headband, wielding a heavy long iron spear, red aura.",
 'yeomcheon': "the Yeomra-Cheonsu Twin Swords, a hooded swordsman in a black robe with blood-red trim, glowing red eyes under the hood, dual-wielding two straight swords crossed in front, red aura.",
 'goeak': "Goeak, a grotesque eerie fighter wearing a grotesque demon mask, hunched crooked posture, dark grey robe with lime-green trim, long hooked claws, lime-green aura.",
 'yayulhan': "Yayul Han, the ambitious second-in-command of the unorthodox alliance, a cold handsome schemer with black hair in a topknot, black robe with purple trim, holding a black iron fan, frosty purple ice palm aura, arrogant smirk.",
 'bisain': "Bi Sain, the young heir of the unorthodox alliance, a fierce young man with many scars on his face and a scary look, dark maroon robe with light red trim, black headband, holding a dao saber, red aura.",
 'baekmanggi': "Baek Manggi, the Sword Emperor, an extremely ancient grandmaster over 130 years old with very long flowing white hair and a long white beard, off-white robe with warm grey trim, thin but upright, holding a straight jian, pale white aura with subtle sword lights.",
 'baekjagang': "Baek Jagang, the Lord of the Unorthodox Alliance, a suspicious overwhelmingly powerful elder with white hair in a topknot and white beard, black robe with crimson trim and a black fur-collared cloak, black armor plates, pale red glowing eyes, a huge heavy dao saber, crimson aura. Extremely grand, imposing and menacing.",
 'seophon': "Cheongseon, the Soul-Seizing Demon Venerable, a young female sorceress in a hooded violet robe with pink trim, glowing pink eyes, holding a folding fan, hypnotic purple swirling aura with ghostly wisps.",
 'mabul': "Jeo Raban, the Demon Buddha, a short stocky bald monk with golden glowing skin, ochre robe with bright yellow trim, big prayer beads, bare fists, blazing golden Buddhist light aura, cunning expression.",
 'dokwang': "the Poison King, a pretty youthful boy-like poison master with black hair in a topknot, dark green robe with light green trim, glowing green eyes, holding poisoned daggers and needles, green toxic aura.",
 'geugak': "the Ultimate-Evil Demon, a masked demonic fighter in a black robe with red trim, a fierce red-and-black demon mask, glowing red eyes, daggers in both hands, red aura.",
 'ilhwa': "So Yeonrang, the One-Flower Sword Venerable, a stunningly beautiful swordswoman with long black hair in an elegant topknot, pale pink robe with pink trim, holding a straight jian, swirling pink flower petal aura.",
 'bulpae': "Dan Ugang, the Undefeated Fist Demon, a terrifying giant muscular fist master with a fierce beard and scarred face, brown robe with amber trim, dark red headband, enormous spiked iron war gauntlets, amber-gold fighting aura.",
 'hyeolcheon': "Gu Cheonpa, the Blood Heaven Saber Demon, a tall fierce saber master with black hair in a topknot, red robe with pale pink trim, glowing pale red eyes, a massive demonic dao saber, a book tucked in his sash, red aura.",
 'daechwi': "Song Sahyeok, the Great Drunken Demon, a jolly drunk brawler with red cheeks, rust-brown robe with pale yellow trim worn loose, ochre headband, a big gourd wine bottle in one hand and an axe in the other, swaying drunken-fist stance, orange aura.",
 'cheonma': "Geom Ujin, the Heavenly Demon, absolute master of the Demonic Cult, the strongest of all: a sneering supremely confident handsome man with long black hair in a topknot under a black-and-red demon crown, jet-black robe with crimson trim and embroidered demonic patterns, a flowing black-and-crimson cape, glowing red eyes, holding a black jian, overwhelming crimson and black demonic flame aura. Extremely grand, majestic, and terrifying.",
}

jobs = []
for i, d in ZB.items(): jobs.append({'name': f'zb-{i}', 'prompt': PRE + d + STYLE, 'size': '1024x1536', 'bg': 'transparent', 'q': 'medium'})
for i, d in KG.items(): jobs.append({'name': f'king-{i}', 'prompt': PRE + d + STYLE, 'size': '1024x1536', 'bg': 'transparent', 'q': 'medium'})
for i, d in MS.items(): jobs.append({'name': f'm-{i}', 'prompt': PRE + d + STYLE, 'size': '1024x1536', 'bg': 'transparent', 'q': 'medium'})

FXS = " Bright glowing magical visual effect for a game, centered in the frame, on a PURE BLACK background (#000000), the effect fades smoothly into black at the edges, high contrast, luminous, painterly game VFX. No characters, no text, no frame."
FX = {
 'slash-gold': "a huge golden crescent sword slash arc with sparks and light trails",
 'slash-azure': "a sweeping sky-blue azure sword qi crescent slash with wind streaks",
 'slash-crimson': "a blood-red crimson saber slash crescent with dark red energy trails and embers",
 'sword-rain': "dozens of glowing spectral blue-white flying swords raining down diagonally from above",
 'palm-wave': "a giant golden Buddhist palm print shockwave, glowing translucent golden hand print with radiating rings and sanskrit-like light glyphs",
 'fist-quake': "a ground-shattering fist impact shockwave seen from the front, radial glowing orange cracks, rock debris lit by light, dust ring",
 'blood-burst': "a blood-red demonic qi explosion, swirling crimson energy burst with dark red sparks (energy, not gore)",
 'ice-burst': "an ice crystal explosion, shards of glowing blue-white ice bursting outward with frost mist",
 'poison-cloud': "a swirling toxic green poison miasma cloud with glowing bubbles and wisps",
 'fire-pillar': "a tall roaring pillar of flame erupting upward, orange and yellow fire with embers",
 'thunder': "a powerful lightning strike bolt from top to bottom with branching electric arcs and a bright impact flash",
 'dark-orb': "a purple-black demonic energy orb crackling with violet lightning and dark swirling wisps",
 'petal-storm': "a swirling vortex storm of glowing pink plum and peach blossom petals",
 'sound-ring': "concentric glowing sonic shockwave rings radiating outward in pale indigo-cyan, with faint ghostly translucent faces in the rings",
 'ghost-hand': "a giant spectral ghostly grasping hand made of pale cyan-green ethereal ghost fire reaching forward",
 'taiji': "a glowing yin-yang taiji circle of white and blue-white light with swirling qi and faint bagua trigram ring",
}
fx = [{'name': k, 'prompt': 'Game skill effect sprite: ' + v + '.' + FXS, 'size': '1024x1024', 'bg': 'opaque', 'q': 'medium'} for k, v in FX.items()]
json.dump(jobs, open(f'{D}/jobs-boss.json', 'w'), ensure_ascii=False, indent=1)
json.dump(fx, open(f'{D}/jobs-fx.json', 'w'), ensure_ascii=False, indent=1)
print(len(jobs), len(fx))
