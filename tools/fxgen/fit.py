from PIL import Image
OLD='../../art/fx/'
names=['fx-ring','fx-slash','fx-field','fx-burst','fx-bolt','fx-beam','fx-blink','fx-aura','fx-swirl']
def bbox(im, th=24):
    a=im.split()[3].point(lambda v:255 if v>th else 0); return a.getbbox()
for n in names:
    old=Image.open(OLD+n+'.png').convert('RGBA'); new=Image.open(f'gen/{n}.png').convert('RGBA')
    # 흑백으로 (밝기만), 알파 그대로
    r,g,b,a=new.split(); L=Image.merge('RGB',(r,g,b)).convert('L')
    new=Image.merge('RGBA',(L,L,L,a))
    ob=bbox(old); nb=bbox(new)
    ow,oh=old.size
    fw=(ob[2]-ob[0])/ow; fh=(ob[3]-ob[1])/oh
    cxf=((ob[0]+ob[2])/2)/ow; cyf=((ob[1]+ob[3])/2)/oh
    crop=new.crop(nb); bw,bh=crop.size
    # 옛 그림과 같은 비율·같은 자리에 오도록 캔버스를 잡는다 (가로세로 비율도 옛 그림을 따른다)
    W=bw/fw; H=bh/fh
    # 비율이 다르면 큰 쪽에 맞춰 옛 가로세로 비율로
    sc=max(W/ow, H/oh); W=ow*sc; H=oh*sc
    canvas=Image.new('RGBA',(round(W),round(H)),(0,0,0,0))
    x=round(cxf*W-bw/2); y=round(cyf*H-bh/2)
    canvas.alpha_composite(crop,(max(0,x),max(0,y)))
    canvas=canvas.resize((ow,oh),Image.LANCZOS)
    canvas.save(f'out/{n}.png', optimize=True)
    print(n, old.size, 'old frac', round(fw,2), round(fh,2), '->', canvas.size)
