# 옛 그림을 넣고 같은 모양으로 다시 그리게 한다 (images/edits). 사용: python3 edit.py 목록.json 출력폴더
import json, base64, subprocess, sys, os, time
jobs = json.load(open(sys.argv[1])); outd = sys.argv[2]; os.makedirs(outd, exist_ok=True)
for j in jobs:
    out = f"{outd}/{j['name']}.png"
    if os.path.exists(out): continue
    for attempt in range(4):
        args = ['curl', '-sS', '-m', '280', 'https://api.openai.com/v1/images/edits', '-F', 'model=gpt-image-2.5-sunburst',
                '-F', f"image[]=@{j['src']}", '-F', f"background={j.get('bg', 'transparent')}", '-F', f"quality={j.get('q', 'medium')}",
                '-F', f"size={j.get('size', '1024x1024')}", '-F', f"prompt={j['prompt']}"]
        r = subprocess.run(args, capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
        except Exception:
            print(j['name'], 'retry', attempt, r.stdout[:80], flush=True); time.sleep(5); continue
        if 'error' in d: print(j['name'], 'ERR', d['error'].get('message', '')[:200], flush=True); break
        open(out, 'wb').write(base64.b64decode(d['data'][0]['b64_json'])); print(j['name'], 'ok', flush=True); break
