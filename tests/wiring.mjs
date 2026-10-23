// **한쪽만 만들고 반대쪽을 안 만든 것**을 찾는다.
//
// 오늘 하루에만 이 유형이 네 번 나왔다:
//   · 도포를 폭으로 맞춰 구워 놓고 머리는 고정 좌표에 뒀다 (머리가 20px 떴다)
//   · art.js에 body-r0..r9를 적어 놓고 파일을 안 구웠다 (전부 벡터로 떨어졌다)
//   · game.fields에 장판을 쌓아 놓고 그리는 쪽을 안 만들었다
//   · jobTest 사건을 보내 놓고 받는 쪽을 안 만들었다 (결과가 안 떴다)
//
// 사람 눈으로는 매번 놓친다. 짝이 맞는지 기계가 본다.
import fs from 'node:fs';
import path from 'node:path';

const R = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf-8');
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const JS_FILES = walk('js').filter((f) => f.endsWith('.js'));
const ALL = JS_FILES.map(read).join('\n') + read('index.html') + read('sw.js');

let fail = 0;
const ok = (c, name, info = '') => {
  if (!c) fail++;
  console.log(`  ${c ? 'OK  ' : '!!  '} ${name}${info ? `  — ${info}` : ''}`);
};

console.log('=== 1. 보내는 사건 ↔ 받는 쪽 ===');
{
  const sent = new Set();
  for (const f of JS_FILES) {
    for (const m of read(f).matchAll(/\bemit\(\s*'([a-zA-Z]+)'/g)) sent.add(m[1]);
  }
  // 받는 쪽: case 'x': / ev.type === 'x' / on('x'
  const heard = new Set();
  for (const f of JS_FILES) {
    const s = read(f);
    for (const m of s.matchAll(/case\s+'([a-zA-Z]+)'\s*:/g)) heard.add(m[1]);
    for (const m of s.matchAll(/type\s*===\s*'([a-zA-Z]+)'/g)) heard.add(m[1]);
    for (const m of s.matchAll(/\bon\(\s*'([a-zA-Z]+)'/g)) heard.add(m[1]);
  }
  const deaf = [...sent].filter((e) => !heard.has(e)).sort();
  ok(deaf.length === 0, '보내는 사건을 전부 누가 받는다',
    deaf.length ? `안 받는 것: ${deaf.join(', ')}` : `${sent.size}종`);
}

console.log('\n=== 2. 코드가 찾는 그림 파일 ↔ 실제 파일 ===');
{
  // art/...png, art/...jpg 를 문자열로 짓는 곳을 모은다
  const want = new Set();
  const lit = /['"`](art\/[a-z0-9/_-]+\.(?:png|jpg|webp))['"`]/g;
  for (const m of ALL.matchAll(lit)) want.add(m[1]);
  // 템플릿으로 짓는 것 — art/icon/${key}.png 꼴
  const tpl = [...ALL.matchAll(/`(art\/[a-z0-9/_-]*)\$\{([^}]+)\}([a-z0-9._-]*)`/g)];
  const have = new Set(walk('art'));
  const missing = [...want].filter((f) => !have.has(f)).sort();
  ok(missing.length === 0, '코드가 적어 둔 그림이 전부 있다',
    missing.length ? `없음: ${missing.join(', ')}` : `${want.size}장`);

  // art.js가 읽는 목록. **재구성하지 말고 FILES를 그대로 읽는다** —
  // 손으로 다시 만들면 의복처럼 나중에 더한 것을 놓친다(실제로 놓쳤다).
  const art = read('js/art.js');
  const grab = (re) => (art.match(re) || ['', ''])[1];
  const names = [...grab(/const FILES = \[([\s\S]*?)\n\];/).matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const spread = [
    ...[...grab(/const HEADS = \[([^\]]+)\]/).matchAll(/'([a-z]+)'/g)].map((m) => `head-${m[1]}`),
    ...[...grab(/const WEAPONS = \[([^\]]+)\]/).matchAll(/'([a-z]+)'/g)].map((m) => `wp-${m[1]}`),
    ...[...grab(/const BODIES = \{([\s\S]*?)\};/).matchAll(/(\w+)\s*:/g)].map((m) => `body-${m[1]}`),
    ...[...grab(/const RANK_ROBES = \{([\s\S]*?)\};/).matchAll(/'(body-r\d)'/g)].map((m) => m[1]),
    ...[...art.matchAll(/'(body-o\d|wp-s\d)'/g)].map((m) => m[1]),
  ];
  const wantArt = [...new Set([...names, ...spread, 'head'])];
  const miss2 = wantArt.filter((n) => !have.has(`art/hero/${n}.png`));
  ok(miss2.length === 0, 'art.js가 읽는 조각이 전부 구워져 있다',
    miss2.length ? `없음: ${miss2.join(', ')}` : `${wantArt.length}장`);

  // **의복 검 장식 여섯은 같은 검이다.** 길이가 제각각일 이유가 없다.
  // 폭만 맞춰 구웠더니 80~194px이 됐고(기본 검은 65px), 입으면 칼이 키보다
  // 길었다 — 도포에서 배운 걸 무기에 안 쓴 것이다.
  const skinH = [...have].filter((f) => /art\/hero\/wp-s\d\.png$/.test(f)).map((f) => {
    const b = fs.readFileSync(path.join(R, f));
    const i = b.indexOf('IHDR');
    return b.readUInt32BE(i + 8);
  });
  ok(skinH.length > 0 && new Set(skinH).size === 1,
    '의복 검 장식이 전부 같은 길이다', `${skinH.length}자루 / ${[...new Set(skinH)].join(', ')}px`);
  // 기본 무기보다 지나치게 길면 안 된다
  const swordB = fs.readFileSync(path.join(R, 'art/hero/wp-sword.png'));
  const swordH = swordB.readUInt32BE(swordB.indexOf('IHDR') + 8);
  ok(skinH.every((h2) => h2 <= swordH * 1.5),
    '검 장식이 기본 검보다 많이 길지 않다', `${skinH[0]}px / 기본 ${swordH}px`);

  // **도포는 전부 같은 크기여야 한다** — 다르면 머리가 뜬다 (오늘 그 일)
  const bodyFiles = [...have].filter((f) => /art\/hero\/body-/.test(f));
  const sizes = new Set();
  for (const f of bodyFiles) {
    const b = fs.readFileSync(path.join(R, f));
    const i = b.indexOf('IHDR');
    sizes.add(`${b.readUInt32BE(i + 4)}x${b.readUInt32BE(i + 8)}`);
  }
  ok(sizes.size === 1, '도포 그림이 전부 같은 크기다 (아니면 머리가 뜬다)',
    `${bodyFiles.length}장 / ${[...sizes].join(', ')}`);
}

console.log('\n=== 3. 서비스워커가 받아 두는 것 ↔ 실제 파일 ===');
{
  const sw = read('sw.js');
  const listed = [...sw.matchAll(/'((?:js|css|art|index|sw|manifest)[a-zA-Z0-9/._-]*)'/g)].map((m) => m[1]);
  const miss = listed.filter((f) => f !== 'sw.js' && !fs.existsSync(path.join(R, f)));
  ok(miss.length === 0, 'sw.js가 적어 둔 파일이 전부 있다',
    miss.length ? `없음: ${miss.join(', ')}` : `${listed.length}개`);
  // **js 파일도 sw가 알아야 한다.** 빠지면 오프라인에서 그 모듈만 못 받아
  // 게임이 통째로 안 뜬다. icons.js가 실제로 빠져 있었다 — 그림 검사는
  // 있었는데 코드 파일 검사가 없었다.
  const jsFiles = walk('js').filter((f) => f.endsWith('.js'));
  const noSw = jsFiles.filter((f) => !sw.includes(`'${f}'`));
  ok(noSw.length === 0, 'js 파일을 sw.js가 전부 알고 있다',
    noSw.length ? `모름: ${noSw.join(', ')}` : `${jsFiles.length}개`);
  const cssFiles = walk('css');
  const noCss = cssFiles.filter((f) => !sw.includes(`'${f}'`));
  ok(noCss.length === 0, 'css 파일을 sw.js가 전부 알고 있다',
    noCss.length ? `모름: ${noCss.join(', ')}` : `${cssFiles.length}개`);

  // 반대 — art에 있는데 sw가 모르는 것 (받아 두지 않으면 오프라인에서 빠진다)
  const artFiles = walk('art');
  const unlisted = artFiles.filter((f) => !sw.includes(`'${f}'`));
  ok(unlisted.length === 0, '구워 둔 그림을 sw.js가 전부 알고 있다',
    unlisted.length ? `모름: ${unlisted.slice(0, 6).join(', ')}${unlisted.length > 6 ? ` 외 ${unlisted.length - 6}` : ''}` : `${artFiles.length}장`);
  // 판 번호가 둘 다 같아야 한다
  const a = (sw.match(/CACHE = '([\w.-]+)'/) || [])[1];
  const b = (read('js/data.js').match(/BUILD = '([\w.-]+)'/) || [])[1];
  ok(a === b, 'sw.js와 data.js의 판 번호가 같다', `${a} / ${b}`);
}

console.log('\n=== 4. 아이콘 개수 ↔ 데이터 개수 ===');
{
  // icons.js의 KINDS가 데이터보다 적으면 **뒤쪽 몇 개만 글자로 남는다.**
  // 장신구를 넷으로 늘리면서 여기를 안 늘리면 네 번째만 조용히 글자다.
  const D = await import('../js/data.js');
  const K = (await import('../js/icons.js')).KINDS;
  const want = {
    pet: D.PETS.length, relic: D.RELICS.length,
    up: Object.keys(D.UPGRADES).length,
    eqweapon: D.GRADES.length, eqarmor: D.GRADES.length, eqring: D.GRADES.length,
    acc: D.ACC_SLOTS.length, ego: D.EGO_PARTS.length, dg: D.DUNGEONS.length,
    sp: Object.keys(D.SP_STATS).length, codex: D.CODEX_KINDS.length,
    jskill: D.JOB_SKILLS.length, skill: D.GEN_SKILLS.length,
  };
  for (const [k, n] of Object.entries(want)) {
    ok(K[k] === n, `${k} 아이콘 수가 데이터와 같다`, `${K[k]} / ${n}`);
  }
  ok(Object.keys(K).every((k) => k in want), 'KINDS에 데이터 없는 묶음이 없다',
    Object.keys(K).filter((k) => !(k in want)).join(',') || '없음');
}

console.log('\n=== 5. index.html의 id ↔ 코드가 찾는 id ===');
{
  const html = read('index.html');
  const have = new Set([...html.matchAll(/\bid="([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]));
  const wanted = new Set();
  for (const f of JS_FILES) {
    for (const m of read(f).matchAll(/(?:\$\(|getElementById\(\s*)'([a-zA-Z0-9_-]+)'/g)) wanted.add(m[1]);
  }
  // 코드가 만들어 붙이는 것은 뺀다
  const made = new Set([...ALL.matchAll(/\{\s*id:\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]));
  const miss = [...wanted].filter((i) => !have.has(i) && !made.has(i)).sort();
  ok(miss.length === 0, '코드가 찾는 id가 화면에 전부 있다',
    miss.length ? `없음: ${miss.join(', ')}` : `${wanted.size}개`);
}


console.log('');
console.log('=== 6. 문파 특성 ↔ 그리는 쪽 ===');
{
  // 특성의 fx 이름이 battle.js가 실제로 그리는 kind로 이어지는가.
  // 오타 하나면 그 문파만 **아무 빛도 안 난다** — 눈으로는 영영 못 잡는다.
  const bat = read('js/battle.js');
  const dat = read('js/data.js');
  const kinds = new Set([...bat.matchAll(/e\.kind === '([a-z]+)'/g)].map((m) => m[1]));
  // skillEffect가 fx 이름을 kind로 바꾸는 표 (battle.js의 그 줄과 같아야 한다)
  const MAP = { slash: 'burst', pierce: 'beam', field: 'area', swirl: 'swirl', aura: 'aura', burst: 'burst' };
  const used = [...dat.matchAll(/fx: '([a-z]+)'/g)].map((m) => m[1]);
  ok(used.length > 0, '특성에 fx가 적혀 있다', `${used.length}개`);
  const bad = [...new Set(used)].filter((f) => !MAP[f] || !kinds.has(MAP[f]));
  ok(bad.length === 0, '특성 fx가 전부 그려지는 kind로 이어진다',
    bad.length ? `안 그려짐: ${bad.join(', ')}` : [...new Set(used)].join(', '));
  // 보내는 쪽과 받는 쪽
  ok(read('js/game.js').includes("this.emit('skill', { id, target:"), 'game.js가 무공 사건을 보낸다');
  ok(/skillEffect\(ev\.id, ev\.job\)/.test(bat), 'battle.js가 그 사건에서 문파를 집어간다');
  ok(bat.includes('JOB_TRAITS'), 'battle.js가 특성 표를 읽는다');
  // 취마의 은자는 사건으로 나간다 — 받는 쪽이 없으면 안 보인다
  ok(read('js/game.js').includes("this.emit('gold', { amount: got, fromSkill: true })"), '취마가 은자 사건을 보낸다');
  ok(/case 'gold':/.test(bat), 'battle.js가 은자 사건을 받는다');
  // 계열 무공이 셋인데 화면이 하나만 그리면 둘은 영영 안 보인다
  ok(read('js/ui/skill.js').includes('JOB_SLOTS'), '무공 화면이 문파 칸 수를 읽는다');
  ok(read('js/ui/skill.js').includes('game.jobSkills()'), '무공 화면이 계열 무공 전부를 그린다');
}

console.log('\n=== 7. 화면이 올린 자원 ↔ RES_DEFS ===');
{
  // 화면이 res: ['books'] 하고 올려도 RES_DEFS에 그 이름이 없으면
  // 창 머리에서 **조용히 사라진다**. 오타 하나면 끝이라 기계가 본다.
  const defs = new Set([...read('js/ui/common.js')
    .matchAll(/^\s{2}([a-z]+):\s*\{\s*cur:/gm)].map((m) => m[1]));
  const used = new Set();
  for (const f of JS_FILES) {
    for (const m of read(f).matchAll(/\bres:\s*\[([^\]]*)\]/g)) {
      for (const n of m[1].matchAll(/'([a-z]+)'/g)) used.add(n[1]);
    }
  }
  const miss = [...used].filter((k) => !defs.has(k)).sort();
  ok(defs.size > 0, 'RES_DEFS를 읽었다', `${defs.size}종`);
  ok(miss.length === 0, '화면이 올린 자원이 전부 정의돼 있다',
    miss.length ? `없음: ${miss.join(', ')}` : `${used.size}종 사용`);
  // 창 머리를 채우는 쪽도 있어야 한다
  ok(read('js/main.js').includes('RES_DEFS[id].get('), 'main.js가 자원칸을 채운다');
  ok(read('js/ui/common.js').includes("res: () => made[cur]?.res"), '하위 탭이 자원을 위로 올린다');
}

console.log('');
console.log('=== 8. 새 판이 기기에 들어가는 길 ===');
{
  // 배포는 멀쩡한데 기기에만 안 들어간 일이 실제로 났다. 길이 끊기면
  // 쓰는 사람은 영영 옛 화면을 본다 — 눈으로는 절대 못 잡는 종류다.
  const sw = read('sw.js');
  const mn = read('js/main.js');

  // 1) 설치가 통째로 실패하면 안 된다. addAll은 한 장만 빠져도 전부 실패다.
  ok(!/c\.addAll\(SHELL\)/.test(sw), '설치가 addAll(통째로)이 아니다');
  ok(/allSettled/.test(sw), '한 장씩 담아서 한 장이 빠져도 판이 올라간다');
  ok(/skipWaiting/.test(sw) && /clients\.claim/.test(sw), '새 워커가 바로 주도권을 잡는다');

  // 2) 온라인이면 늘 새 파일을 본다 (cache-first로 돌아가면 또 묶인다)
  ok(/cache: 'no-cache'/.test(sw), '브라우저 HTTP 캐시를 건너뛴다');
  ok(sw.indexOf('fetch(req)') < sw.indexOf('caches.match'), '네트워크를 먼저 본다');

  // 3) 판이 다르면 알린다 — 워커가 꼬여 있어도 도는 길이 있어야 한다
  ok(/function checkBuild/.test(mn), '서버 판과 지금 판을 직접 견준다');
  ok(/const CACHE = '\(\[\^'\]\+\)'|const CACHE = '\(\.\*\?\)'|CACHE = '\(\[\^'\]\*\)'/.test(mn)
    || /match\(\/const CACHE/.test(mn), 'sw.js에서 판을 읽어 온다');
  ok(/showUpdate\(/.test(mn), '다르면 화면에 띄운다');
  ok(/updatefound/.test(mn), '새 워커가 설치되면 알아챈다');
  ok(/visibilitychange/.test(mn), '돌아올 때마다 다시 본다');

  // 4) 꼬였을 때 손으로 푸는 길 — 이게 없으면 쓰는 사람이 할 수 있는 게 없다
  ok(/async function hardReload/.test(mn), '워커·캐시를 통째로 버리는 길이 있다');
  ok(/unregister\(\)/.test(mn) && /caches\.delete/.test(mn), '워커와 캐시를 둘 다 지운다');
  ok(/새로 받기/.test(mn), '설정에 버튼이 있다');

  // 5) 띄우는 쪽과 꾸미는 쪽이 짝이 맞는가
  ok(read('css/style.css').includes('.update-bar'), '알림 띠에 꾸밈이 있다');

  // 6) sw.js의 판과 data.js의 판이 같아야 알림이 엉뚱하게 안 뜬다 (3절과 같은 약속)
  const a = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
  const b = (read('js/data.js').match(/BUILD = '([^']+)'/) || [])[1];
  ok(a === b, '두 판 번호가 같다', `${a} / ${b}`);
}


console.log('');
console.log('=== 9. append(null)이 "null" 글자로 찍히는 자리 ===');
{
  // h()는 null을 걸러 주지만 **Element.append는 "null" 글자를 넣는다.**
  // 화면에 null이 한 줄 보이는 사고가 세 번 났다(상점 카드, 설정, 닉네임 창).
  //
  // **맨 바깥 인자만 본다.** 안쪽 h(...)에 든 null은 h()가 걸러 주므로 괜찮다 —
  // 통째로 봤더니 멀쩡한 다섯 군데가 잘못 잡혔다.
  // [...]로 싸서 .filter(Boolean)을 거는 꼴도 괜찮으므로 같이 건너뛴다.
  const bad = [];
  for (const f of JS_FILES) {
    const src = read(f);
    const re = /\.append\(/g;
    let m;
    while ((m = re.exec(src))) {
      let i = m.index + m[0].length;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
        i++;
      }
      let top = '';
      let par = 1;
      let br = 0;
      for (let k = m.index + m[0].length; k < i - 1; k++) {
        const ch = src[k];
        if (ch === '(') par++;
        else if (ch === ')') par--;
        else if (ch === '[') br++;
        else if (ch === ']') br--;
        top += (par === 1 && br === 0) ? ch : ' ';
      }
      if (/(^|[,(\s])null\s*(,|$)/.test(top.trim())) {
        bad.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
  }
  ok(bad.length === 0, 'append에 null을 넘기는 곳이 없다',
    bad.length ? bad.join(', ') : `${JS_FILES.length}개 파일 깨끗`);
}

console.log('');
console.log('=== 10. 자리마다 소품이 있는가 ===');
{
  // 열여섯 자리인데 대나무와 눈만 따로 그려지고 나머지 열넷은 전부 같은
  // 돌멩이였다. 바닥 그림은 달라도 위에 깔린 게 똑같으면 어딘가 본 데 같다.
  // 자리를 늘리면서 소품을 안 더하면 조용히 돌멩이로 떨어진다.
  const D2 = await import('../js/data.js');
  const bat = read('js/battle.js');
  const body = bat.slice(bat.indexOf('propShape(ctx'), bat.indexOf('drawWeather(z, dt)'));
  ok(body.length > 100, 'propShape가 있다');
  const drawn = new Set([...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]));
  const props = [...new Set(D2.ZONES.map((z) => z.prop))];
  const miss = props.filter((p) => !drawn.has(p));
  ok(miss.length === 0, '자리마다 제 소품이 그려진다',
    miss.length ? `돌멩이로 떨어짐: ${miss.join(', ')}` : `${props.length}종`);
  // 자리마다 소품 이름이 적혀 있어야 한다
  const noProp = D2.ZONES.filter((z) => !z.prop).map((z) => z.name);
  ok(noProp.length === 0, '소품 이름이 빠진 자리가 없다', noProp.join(', ') || '없음');
}

console.log('');
console.log('=== 11. 큰 수를 보통 셈으로 다루는 곳 ===');
{
  // Big에는 valueOf를 일부러 안 뒀다. 그래서
  //   s.gold < cost   -> 늘 false (단추가 영영 안 잠긴다)
  //   s.gold + 10     -> 글자가 붙는다
  //   st.atk * 2      -> NaN (적이 안 죽는다)
  // 셋 다 **에러가 안 난다.** 눈으로는 못 찾으니 여기서 잡는다.
  //
  // 이 공사에서 실제로 난 사고들이다: 여섯 시간에 140관문 가던 게 80관문이
  // 됐고(가장 싼 수련을 `c < Infinity`로 고르고 있었다), 화면에 지수가
  // 날것으로 샜고, 저장했다 읽으면 재화가 전부 0이 됐다.
  //
  // 정규식은 안 쓴다 — 한 번 탈출이 꼬여서 **일부러 심은 사고를 놓쳤다.**
  // 글자 그대로 찾는 편이 거짓 통과를 안 만든다.
  const FIELDS = ['s.gold', 's.books', 's.stones', 's.food', 's.relicShards', 's.merit', 's.exp',
    'st.atk', 'st.hp', 'st.dps', 'st.goldMul', 'st.expMul', 'st.critDmg', 'st.hitMul'];
  const OPS = [' < ', ' > ', ' <= ', ' >= ', ' + ', ' * ', ' - ', ' / '];
  const bad = [];
  for (const f of JS_FILES) {
    if (f.endsWith('big.js')) continue;
    read(f).split('\n').forEach((ln, i) => {
      const code = ln.replace(/\/\/.*$/, '');
      for (const fld of FIELDS) {
        let at = code.indexOf(fld);
        while (at >= 0) {
          const rest = code.slice(at + fld.length);
          // 'st.hp' 가 'st.hpAdd' 의 일부면 넘어간다
          if (!/^[A-Za-z0-9_$]/.test(rest)) {
            for (const op of OPS) {
              if (rest.startsWith(op) && !rest.startsWith(op.trimEnd() + '= ')) {
                bad.push(`${f}:${i + 1}${op}| ${code.trim().slice(0, 52)}`);
              }
            }
          }
          at = code.indexOf(fld, at + 1);
        }
      }
    });
  }
  ok(bad.length === 0, '큰 수에 <, +, *, / 를 직접 쓰는 곳이 없다',
    bad.length ? bad.slice(0, 4).join(' || ') : `${JS_FILES.length}개 파일 깨끗`);

  // big.js를 서비스워커가 안다 — 빠지면 오프라인에서 앱이 통째로 안 뜬다
  ok(/js\/big\.js/.test(read('sw.js')), '서비스워커가 big.js를 받아 둔다');
}

console.log(`\n${fail === 0 ? '짝이 전부 맞는다' : `짝이 안 맞는 것 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
