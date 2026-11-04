# v325 꾸미기 그림 — gpt-image-2.5-sunburst. 키는 코드에 없다(작업 환경의 네트워크 시크릿이 api.openai.com에 붙인다).
# 사용: python3 run.py jobs.json 출력폴더   (PAR=4 동시에 · 있으면 건너뜀)
#   stream=true — 고품질은 30초를 넘겨 중간 서버가 끊는다. 흘려 받으면(부분 그림 이벤트) 연결이 살아 있다. 마지막 completed 이벤트의 그림을 쓴다.
#   job: {name, prompt, size?, q?, bg?, refs?:[그림 경로…]}  refs가 있으면 images/edits(그 그림의 화풍·틀을 따라), 없으면 images/generations
import json, base64, subprocess, sys, os, time, concurrent.futures as cf
jobs = json.load(open(sys.argv[1])); outd = sys.argv[2]; os.makedirs(outd, exist_ok=True)
def run(j):
    out = f"{outd}/{j['name']}.png"
    if os.path.exists(out): return j['name'], 'have'
    for attempt in range(4):
        if j.get('refs'):
            args = ['curl', '-sS', '-N', '-m', '400', 'https://api.openai.com/v1/images/edits', '-F', 'model=gpt-image-2.5-sunburst', '-F', 'stream=true', '-F', 'partial_images=2',
                    *sum([['-F', f'image[]=@{r}'] for r in j['refs']], []), '-F', f"background={j.get('bg', 'transparent')}",
                    '-F', f"quality={j.get('q', 'high')}", '-F', f"size={j.get('size', '1024x1024')}", '-F', f"prompt={j['prompt']}"]
        else:
            req = {"model": "gpt-image-2.5-sunburst", "prompt": j['prompt'], "size": j.get('size', '1024x1024'), "background": j.get('bg', 'transparent'), "output_format": "png", "quality": j.get('q', 'high'), "n": 1, "stream": True, "partial_images": 2}
            f = f"{outd}/{j['name']}.req.json"; json.dump(req, open(f, 'w'))
            args = ['curl', '-sS', '-N', '-m', '400', 'https://api.openai.com/v1/images/generations', '-H', 'Content-Type: application/json', '-d', '@' + f]
        r = subprocess.run(args, capture_output=True, text=True)
        d = None
        if r.stdout.lstrip().startswith('{'):
            try: d = json.loads(r.stdout)
            except Exception: d = None
        else:
            # 흘려 받은 이벤트 — completed의 그림
            for line in r.stdout.splitlines():
                if line.startswith('data: ') and '"completed"' in line[:200].replace('.completed', '"completed"'):
                    try:
                        e = json.loads(line[6:])
                        if e.get('type', '').endswith('completed') and e.get('b64_json'): d = {'data': [{'b64_json': e['b64_json']}]}
                    except Exception: pass
                elif line.startswith('data: ') and '"error"' in line[:300]:
                    try: d = json.loads(line[6:])
                    except Exception: pass
        if d is None: print(j['name'], 'retry', attempt, r.stdout[:100].replace(chr(10), '|'), flush=True); time.sleep(5); continue
        if 'error' in d:
            msg = d['error'].get('message', '')[:160]
            if 'safety' in msg.lower() or 'invalid' in msg.lower(): return j['name'], 'ERR ' + msg
            time.sleep(8); continue
        open(out, 'wb').write(base64.b64decode(d['data'][0]['b64_json'])); return j['name'], 'ok'
    return j['name'], 'FAIL'
with cf.ThreadPoolExecutor(int(os.environ.get('PAR', '4'))) as ex:
    for r in ex.map(run, jobs): print(*r, flush=True)
