# v610 창 줄 그림 아이콘 — 한자 한 글자 딱지 대신 그림(이름은 js/s2/tables/uiicons.js의 UI_ICONS와 같다)
# 사용: python3 tools/s2art/uiicons.py → tools/charv325/jobs_s2ui.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2ui.json <그린 폴더>/ui
#       python3 tools/s2art/pack.py <그린 폴더>   (ui: 투명 여백 잘라 96 정사각 WebP)
# 화풍은 coll.py의 ITEM과 한 집안 — 다만 36px로 보이므로 덩어리가 크고 자잘한 무늬가 적다.
import json, os

BASE = ("for a Korean wuxia (martial arts fantasy) idle RPG. Hand-painted, crisp clean silhouette, soft studio rim light, "
        "fully transparent background, no text, no letters, no numbers, no calligraphy, no border, no frame.")
ITEM = (f"Single game menu icon {BASE} 3/4 view, one object or emblem centered and filling about 85% of a square frame, no character, only the object. "
        "It will be shown very small (36 pixels): bold chunky shape, thick forms, strong light-dark contrast, few large details, no tiny ornaments, "
        "no thin lines. Warm palette of gold, jade green, crimson and dark lacquer wood, with a thin soft light outline so it reads on a dark background.")

ICON = {
  # 뽑기 · 가게
  'pull':     "a red and gold lucky ticket token: a thick rectangular lacquered tag with a gold coin emblem and a red tassel",
  'pullw':    "a wooden weapon rack holding one sword and one spear crossed, training display piece, small gold sparkle",
  'pullp':    "one big conical bamboo travelling hat with a wide brim and a bright red chin ribbon, seen from slightly above, golden straw colour",
  'pullr':    "a glowing jade egg with a small cute dragon-shaped cloud curling around it, spirit beast egg",
  'stone':    "a pile of three chunky blue-teal enhancement gemstones, faceted, softly glowing",
  'chest':    "an open wooden treasure chest with gold trim, overflowing with gold coins and one red gem",
  'silver':   "a stack of three boat-shaped silver sycee ingots (traditional East Asian silver money), shiny",
  # 던전 · 나들이
  'training': "a wooden martial arts training dummy post with three arms, on a small round base",
  'sweep':    "one big straw broom with a thick red-banded wooden handle, standing diagonally, with a small puff of white dust at the bristles, nothing else",
  'raid':     "a dark horned demon-warlord helmet with three big gold stars arched above it",
  'tower':    "a tall five-story pagoda tower with red roofs, a small cloud at its base",
  'exped':    "a covered travelling wagon cart with a red pennant flag, seen from the side",
  'time':     "a chunky hourglass with gold sand in a red lacquer wooden frame",
  'map':      "a half-unrolled parchment map scroll with a red dotted path and a big red X mark",
  'auto':     "two thick curved gold arrows chasing each other in a circle around a small upright sword",
  'dex':      "a thick closed book with a dark leather cover, gold corners and a demon mask emblem on the cover",
  'wboss':    "a fierce dark purple dragon head with glowing red eyes and horns, facing right, bust only",
  'duel':     "two straight swords crossed in an X, display pieces, a small spark where the blades meet",
  'gate':     "a traditional East Asian wooden gate with a curved tiled roof, its two red doors half open with warm light inside",
  # 오늘 · 임무
  'stamp':    "a square jade seal stamp with a carved lion knob next to a round red ink pad",
  'mission':  "a rolled paper scroll tied with a red ribbon and a wax seal, slightly unrolled, blank paper",
  'medal':    "a round gold medal with a star embossed in the centre hanging from a wide red ribbon",
  'realm':    "a pink lotus flower in full bloom with a bright golden light pillar rising from its centre",
  # 문파 · 벗
  'guild':    "a tall crimson war banner on a pole with a gold cloud emblem (no writing), waving",
  'letter':   "a sealed folded letter envelope with a red wax seal and a white dove feather",
  'friend':   "two porcelain wine cups clinking together with a small splash, symbol of friendship",
  # 캐릭터
  'atk':      "one thick short broadsword standing upright with the tip pointing up, wide shiny steel blade, gold guard, red grip, a red flame aura behind the blade, museum display piece, no stand",
  'hp':       "a big round red heart-shaped gourd bottle of healing elixir with a cork, glossy",
  'def':      "a round bronze shield with a big central boss and a jade rim",
  'crit':     "a bright yellow starburst impact flash with a small red centre, like a critical strike spark",
  'scale':    "a brass balance scale with two round pans hanging level from a red lacquer beam, chunky",
  'lock':     "a heavy traditional East Asian brass padlock with a thick shackle and a jade stud, closed",
  'reset':    "a thick jade ring with a single big gold arrow curving counter-clockwise around it, undo symbol",
  'skill':    "a thick blue-covered secret martial arts manual book, thread-bound, with a blank white title strip, faint blue glow",
  'mastery':  "a glowing golden orb of inner energy (qi) hovering above an open palm-shaped jade stand, concentric swirl",
  'job':      "a golden crown-like topknot headpiece (guan) with a hairpin on a red cushion, with rays of light",
  'title':    "a big round red wax seal medallion with a gold rim and two short red ribbons, blank emblem of a cloud",
  # 장비
  'equip':    "a suit of lamellar chest armor on a wooden stand, dark iron with gold trim and red cords",
  'enhance':  "a blacksmith anvil with a hammer striking it and three big orange sparks",
  'starsoul': "a large five-pointed gold star with a blue-white spirit flame burning around it",
  'dismantle': "a heavy wooden mallet smashing a round iron helmet that splits into two big halves, a few chunky fragments and one orange spark",
  'shard':    "three jagged gold-edged crystal fragments of a broken token, glittering",
  'bag':      "a plump brown cloth travelling bundle pouch tied with a red cord",
  # 설정
  'shake':    "a small red pellet drum toy on a wooden stick (rattle drum) with two beads swinging on cords, tilted, with motion arcs",
  'meter':    "a chunky wooden abacus with a dark red frame and big gold and jade beads on three rods",
  'dodge':    "one martial arts cloth boot with a thick white sole, leaping, with two bold jade-green wind swirl trails behind it",
  'cloud':    "one fat auspicious swirl cloud in cream and gold with a thick gold arrow rising up out of it",
  'key':      "one large ornate bronze key with a round jade ring head and a short red tassel, diagonal",
  'vib':      "a bronze temple bell with bold curved shock waves on both sides, ringing",
  'screen':   "a small three-panel folding screen painted with a simple mountain and red sun, no writing",
  'moon':     "a fat yellow crescent moon with one small star and a wisp of cloud",
  'lantern':  "a glowing red paper lantern with a gold cap and tassel, warm light",
  # v635 교환소 재화(명성 · 공적 · 혈전패)
  'fame':     "a round bright gold medallion token with a wreath of leaves around a blank centre, hanging from a short blue ribbon, shiny",
  'merit':    "a rectangular jade green token plaque with a gold rim and a small crimson banner-flag emblem in the centre, red tassel at the bottom",
  'blood':    "a hexagonal dark iron battle token with a crimson enamel centre showing a small dragon claw mark, glowing red edge",
}

jobs = [{'name': k, 'prompt': f"{ITEM} Object: {d}.", 'q': 'medium'} for k, d in ICON.items()]
out = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2ui.json')
json.dump(jobs, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), 'jobs →', out)
