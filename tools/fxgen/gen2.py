# 새로 그리기 (images/generations). 사용: python3 gen2.py 목록.json 출력폴더
import json, base64, subprocess, sys, os, time
jobs = json.load(open(sys.argv[1])); outd = sys.argv[2]; os.makedirs(outd, exist_ok=True)
for j in jobs:
    out = f"{outd}/{j['name']}.png"
    if os.path.exists(out): continue
    req = {"model": "gpt-image-2.5-sunburst", "prompt": j['prompt'], "size": j.get('size', '1024x1024'), "background": j.get('bg', 'transparent'),
           "output_format": "png", "quality": j.get('q', 'medium'), "n": 1}
    f = f"{outd}/{j['name']}.req.json"; json.dump(req, open(f, 'w'))
    for attempt in range(4):
        r = subprocess.run(['curl', '-sS', '-m', '280', 'https://api.openai.com/v1/images/generations', '-H', 'Content-Type: application/json', '-d', '@' + f], capture_output=True, text=True)
        try: d = json.loads(r.stdout)
        except Exception: print(j['name'], 'retry', attempt, r.stdout[:80], flush=True); time.sleep(5); continue
        if 'error' in d: print(j['name'], 'ERR', d['error'].get('message', '')[:200], flush=True); break
        open(out, 'wb').write(base64.b64decode(d['data'][0]['b64_json'])); print(j['name'], 'ok', flush=True); break
