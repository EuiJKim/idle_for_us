// v320 저장 코드 — 세이브 전부를 글자 한 줄로(복사해 두었다가 다른 기기·지운 뒤에 붙여 넣어 되살린다)
//   IFU1.<gzip을 base64url로>  · 압축을 못 하는 브라우저는 IFU0.<그대로 base64url>
//   gzip에는 CRC가 있어 한 글자라도 틀리면 열리지 않는다. 열린 뒤에도 캐릭터(직업·레벨)가 있는지 본다.
export const CODE_PREFIX = 'IFU1.';
const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (str) => {
  let t = str.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
async function pipe(bytes, stream) {
  const r = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(r).arrayBuffer());
}
export async function encodeSave(obj) {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') return CODE_PREFIX + b64(await pipe(json, new CompressionStream('gzip')));
  return 'IFU0.' + b64(json);
}
export async function decodeSave(code) {
  const c = String(code || '').replace(/\s+/g, '');
  let bytes;
  try {
    if (c.startsWith('IFU1.')) {
      if (typeof DecompressionStream !== 'function') throw new Error('nozip');
      bytes = await pipe(unb64(c.slice(5)), new DecompressionStream('gzip'));
    } else if (c.startsWith('IFU0.')) bytes = unb64(c.slice(5));
    else throw new Error('prefix');
  } catch (err) {
    if (err?.message === 'nozip') throw new Error('이 브라우저는 압축된 코드를 열 수 없어요 — 크롬·사파리 최신판에서 열어 주세요');
    if (err?.message === 'prefix') throw new Error('저장 코드가 아니에요 — IFU로 시작하는 글을 통째로 붙여 넣어 주세요');
    throw new Error('코드가 잘렸거나 틀렸어요 — 처음부터 끝까지 빠짐없이 붙여 넣어 주세요');
  }
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('코드가 망가져 있어요'); }
  if (!obj || typeof obj !== 'object' || typeof obj.job !== 'string' || !(Number(obj.level) >= 1)) throw new Error('캐릭터가 들어 있지 않은 코드예요');
  return obj;
}
