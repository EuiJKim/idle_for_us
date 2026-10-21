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

console.log(`\n${fail === 0 ? '짝이 전부 맞는다' : `짝이 안 맞는 것 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
