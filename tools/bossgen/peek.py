import sys
from PIL import Image
B='/tmp/claude-0/-home-user/84353f17-e527-5beb-94c7-4611078e970e/scratchpad/boss'
ns=sys.argv[1].split(','); out=sys.argv[2]
ims=[]
for n in ns:
    im=Image.open(f'{B}/raw/{n}.png').convert('RGBA'); bg=Image.new('RGBA',im.size,(200,60,200,255)); bg.alpha_composite(im); ims.append(bg.resize((340,510)))
S=Image.new('RGB',(350*len(ims),515),(0,0,0))
for i,im in enumerate(ims): S.paste(im.convert('RGB'),(i*350,0))
S.save(out)
