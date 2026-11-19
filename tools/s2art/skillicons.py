# 무공 아이콘(무공 창 · 무공 강화 창) — 무공 id마다 하나(js/s2/tables/kit.js KIT: 직업 다섯 × 열하나)
# 한 장에 여섯 칸(3×2)으로 그려 잘라 쓴다 — 직업마다 두 장(공격 여섯 · 버프와 상시 다섯) = 열 장
# 사용: python3 tools/s2art/skillicons.py                 → tools/charv325/jobs_s2skill.json
#       PAR=6 python3 tools/charv325/run.py tools/charv325/jobs_s2skill.json <그린 폴더>/sheet
#       python3 tools/s2art/skillicons.py cut <그린 폴더>   → <그린 폴더>/skill/<id>.png (칸마다 투명 여백 안의 그림)
#       python3 tools/s2art/pack.py <그린 폴더>             (skill: 128 정사각 WebP → art/s2/skill/)
import json, os, sys

COLS, ROWS = 3, 2
BASE = ("Sprite sheet of six separate game skill icons for a Korean wuxia (martial arts fantasy) idle RPG, arranged in a neat grid of "
        "3 columns and 2 rows with wide empty gaps between them, every icon the same size and centered in its own cell, nothing crossing into another cell. "
        "Each icon is a round painted emblem: a dark lacquer disc with a thick polished rim, the motif inside glowing strongly. Hand-painted, crisp, "
        "bold chunky shapes, strong light-dark contrast, few large details, no thin lines, readable at 40 pixels. "
        "Fully transparent background around the discs, no text, no letters, no numbers, no calligraphy, no labels, no frame around the sheet.")
JOB = {
  'sword': ('straight sword swordsman', 'pale gold and warm white', 'pale gold'),
  'spear': ('long spear lancer', 'orange and ember red', 'orange'),
  'fist':  ('bare-handed fist and palm fighter', 'bright golden yellow and bronze', 'golden yellow'),
  'bow':   ('bow and arrow archer', 'icy cyan and white', 'icy cyan'),
  'mage':  ('taoist qi and thunder sorcerer', 'violet and lilac', 'violet'),
}
# 무공 순서는 kit.js FRAME과 같다(0 일직선 · 1 부채꼴 · 2 상시 · 3 주변 · 4 버프 · 5 하늘에서 · 6 상시 · 7 일직선 · 8 버프 · 9 주변 · 10 상시)
MOTIF = {
  'sword': ['a single bright horizontal sword slash streak', 'a sword swinging an arc through swirling falling leaves', 'an open sword manual book with a sword qi glow',
            'a sword spinning in a full circle of blade light', 'a sword standing upright inside a bright ring of clear light (enlightened heart)', 'many small swords raining down from above',
            'a taiji yin-yang symbol with a sword across it', 'one huge sword thrust beam piercing forward', 'a glowing sword with a ghostly sword spirit rising from it',
            'a giant sword splitting the sky with a vertical crack of light', 'a sword floating above a cloud and a mountain peak (immortal realm)'],
  'spear': ['a spear tip thrusting forward with a burst', 'a spear sweeping sideways in a wide fiery arc', 'an open spear manual book with an ember glow',
            'a spear spinning like a whirlwind', 'a roaring fiery aura around a crossed spear and helmet (overlord)', 'flaming spears falling like meteors',
            'a dragon coiled around a spear shaft', 'a spear piercing straight through a red sun', 'a war god helmet with a blazing spear behind it',
            'a spear smashing down, the sky cracking with fire', 'a spear crowned by a golden halo above clouds'],
  'fist':  ['a clenched fist punching forward with a shock ring', 'a kicking foot with two motion arcs (chain kicks)', 'a wrapped training fist and wooden dummy arm',
            'a fist slamming the ground with a round shockwave', 'a bronze bell-shaped iron shirt torso shield glowing', 'many golden fists falling from the sky',
            'a vajra (diamond thunderbolt) emblem glowing gold', 'an open palm releasing a golden dragon wave', 'a golden statue-like torso radiating unbreakable light',
            'a dark red demon fist crushing down with shockwaves', 'a crowned fist on a cloud (king of fists)'],
  'bow':   ['one arrow flying straight with a bright trail', 'three arrows fanning out from a bow', 'an open archery manual book with a cyan glow',
            'arrows bursting outward in a ring like scattered petals', 'a sharp hawk eye glowing cyan', 'a rain of many arrows falling from the sky',
            'a divine longbow drawn with a glowing string', 'a huge arrow beam breaking through the sky', 'a ghostly spirit bow with a pale flame',
            'meteors streaking down in a shower', 'a bow crowned by a halo above clouds'],
  'mage':  ['an open palm pushing a gust of wind', 'a palm releasing a fan of ice shards', 'a glowing qi orb swirling in a meditation hand seal',
            'a ring of lightning around a taoist array circle', 'a translucent dome shield of protective qi', 'five lightning bolts striking down from clouds',
            'a mystic bagua octagon talisman glowing', 'one divine lightning beam striking forward', 'a third eye opening with violet light (awakening)',
            'a massive thunderstorm crashing down from the heavens', 'a taoist immortal crane flying over a cloud peak'],
}
SHEETS = [('a', [0, 1, 3, 5, 7, 9]), ('b', [2, 4, 6, 8, 10])]

def jobs():
  out = []
  for job, (who, pal, rim) in JOB.items():
    for tag, idx in SHEETS:
      cells = '; '.join(f"cell {n + 1} ({'top' if n < COLS else 'bottom'} row, {['left', 'middle', 'right'][n % COLS]}): {MOTIF[job][i]}" for n, i in enumerate(idx))
      extra = ' The sixth cell (bottom right) is completely empty.' if len(idx) < COLS * ROWS else ''
      out.append({'name': f'{job}_{tag}', 'size': '1536x1024', 'q': 'medium',
                  'prompt': f"{BASE} All six share one style for a {who}: palette of {pal}, rim in {rim}. Icons in reading order — {cells}.{extra}"})
  return out

# 옆 칸 패가 살짝 넘어온 조각 떼기 — 가장 넓은 줄이 든, 빈 줄로 끊기지 않은 덩어리만(가로 · 세로)
def main_run(c):
  a = c.getchannel('A').point(lambda v: 1 if v > 160 else 0); w, h = c.size; px = a.load()
  def run(counts):
    m = max(range(len(counts)), key=lambda i: counts[i]); lo = hi = m
    while lo > 0 and counts[lo - 1] > 0: lo -= 1
    while hi < len(counts) - 1 and counts[hi + 1] > 0: hi += 1
    return lo, hi + 1
  y0, y1 = run([sum(px[x, y] for x in range(w)) for y in range(h)])
  x0, x1 = run([sum(px[x, y] for y in range(y0, y1)) for x in range(w)])
  return c.crop((x0, y0, x1, y1))

def cut(root):
  from PIL import Image
  os.makedirs(f'{root}/skill', exist_ok=True)
  for job in JOB:
    for tag, idx in SHEETS:
      p = f'{root}/sheet/{job}_{tag}.png'
      if not os.path.exists(p): print('없음', p); continue
      im = Image.open(p).convert('RGBA'); cw, ch = im.width // COLS, im.height // ROWS
      for n, i in enumerate(idx):
        c = im.crop(((n % COLS) * cw, (n // COLS) * ch, (n % COLS + 1) * cw, (n // COLS + 1) * ch))
        bb = c.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
        if bb: c = c.crop(bb)
        c = main_run(c)
        c.save(f'{root}/skill/{job}_{i}.png'); print(f'{job}_{i}', c.size)

if __name__ == '__main__':
  if len(sys.argv) > 2 and sys.argv[1] == 'cut': cut(sys.argv[2])
  else:
    J = jobs(); f = os.path.join(os.path.dirname(__file__), '..', 'charv325', 'jobs_s2skill.json')
    json.dump(J, open(f, 'w'), ensure_ascii=False, indent=1); print(len(J), 'jobs →', f)
