// 새 시즌(S1) 작은 계산식 — 미션 진행·조건·점수 같은 「식」 칸을 코드 없이 바꾸려고(계획서 §C).
// 글자 → 토큰 → 역폴란드 표기(RPN) → 계산. 한 번 바꾼 식은 저장해 두고 다시 쓴다.
// 연산(우선순위 낮은 것부터): ||  &&  == != > >= < <= in  | &  + -  * / %  ^(거듭제곱, 오른쪽부터)  단항 - !
// 이름(변수)은 ctx 함수로 값을 받는다. 목록은 [1, 2, 3] (in 오른쪽에만). 나눗셈은 정수 나눗셈(내림, 0으로 나누면 0).
const OPS = {
  '||': [1, 'L'], '&&': [2, 'L'],
  '==': [3, 'L'], '!=': [3, 'L'], '>': [3, 'L'], '>=': [3, 'L'], '<': [3, 'L'], '<=': [3, 'L'], in: [3, 'L'],
  '|': [4, 'L'], '&': [4, 'L'],
  '+': [5, 'L'], '-': [5, 'L'],
  '*': [6, 'L'], '/': [6, 'L'], '%': [6, 'L'],
  '^': [7, 'R'],
  'u-': [8, 'R'], '!': [8, 'R'],
};
const TOK = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.]*|\|\||&&|==|!=|>=|<=|[-+*/%^()<>!|&\[\],])/y;

export function tokenize(src) {
  const out = [];
  TOK.lastIndex = 0;
  let m;
  const s = String(src);
  while (TOK.lastIndex < s.length && (m = TOK.exec(s))) out.push(m[1]);
  if (TOK.lastIndex < s.trimEnd().length) throw new Error(`식을 읽을 수 없음: ${s.slice(TOK.lastIndex, TOK.lastIndex + 10)}`);
  return out;
}

export function toRpn(src) {
  const toks = tokenize(src);
  const out = [], st = [];
  let prev = null;
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i];
    if (t === '[') {   // 목록 [a, b, c] — 숫자만
      const list = [];
      while (toks[++i] !== ']') { if (toks[i] !== ',') list.push(Number(toks[i])); if (i >= toks.length) throw new Error('목록이 닫히지 않음'); }
      out.push({ list }); prev = 'v'; continue;
    }
    if (/^\d/.test(t)) { out.push({ num: Number(t) }); prev = 'v'; continue; }
    if (t === 'in') { /* 연산자 */ }
    else if (/^[A-Za-z_]/.test(t)) { out.push({ name: t }); prev = 'v'; continue; }
    if (t === '(') { st.push(t); prev = '('; continue; }
    if (t === ')') {
      while (st.length && st.at(-1) !== '(') out.push({ op: st.pop() });
      if (!st.length) throw new Error('괄호가 맞지 않음');
      st.pop(); prev = 'v'; continue;
    }
    if (t === '-' && prev !== 'v') t = 'u-';
    if (!OPS[t]) throw new Error(`모르는 연산: ${t}`);
    const [p, a] = OPS[t];
    while (st.length && st.at(-1) !== '(') {
      const [q] = OPS[st.at(-1)];
      if (q > p || (q === p && a === 'L')) out.push({ op: st.pop() }); else break;
    }
    st.push(t); prev = 'op';
  }
  while (st.length) { const o = st.pop(); if (o === '(') throw new Error('괄호가 맞지 않음'); out.push({ op: o }); }
  return out;
}

const BIN = {
  '||': (a, b) => (a || b ? 1 : 0), '&&': (a, b) => (a && b ? 1 : 0),
  '==': (a, b) => (a === b ? 1 : 0), '!=': (a, b) => (a !== b ? 1 : 0),
  '>': (a, b) => (a > b ? 1 : 0), '>=': (a, b) => (a >= b ? 1 : 0), '<': (a, b) => (a < b ? 1 : 0), '<=': (a, b) => (a <= b ? 1 : 0),
  in: (a, b) => (Array.isArray(b) && b.includes(a) ? 1 : 0),
  '|': (a, b) => a | b, '&': (a, b) => a & b,
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b,
  '/': (a, b) => (b === 0 ? 0 : Math.floor(a / b)), '%': (a, b) => (b === 0 ? 0 : a % b),
  '^': (a, b) => Math.pow(a, b),
};
export function evalRpn(rpn, ctx = () => 0) {
  const st = [];
  for (const t of rpn) {
    if ('num' in t) st.push(t.num);
    else if ('list' in t) st.push(t.list);
    else if ('name' in t) { const v = ctx(t.name); st.push(typeof v === 'boolean' ? (v ? 1 : 0) : Array.isArray(v) ? v : Number(v) || 0); }
    else if (t.op === 'u-' || t.op === '!') {
      if (st.length < 1) throw new Error('식이 완성되지 않음');
      const a = st.pop();
      st.push(t.op === 'u-' ? -a : a ? 0 : 1);
    } else {
      if (st.length < 2) throw new Error('식이 완성되지 않음');
      const b = st.pop(), a = st.pop();
      st.push(BIN[t.op](a, b));
    }
  }
  if (st.length !== 1) throw new Error('식이 완성되지 않음');
  return st[0];
}
const CACHE = new Map();
// 식 계산 — 글자가 비었으면 기본값
export function calc(src, ctx, dflt = 0) {
  if (src == null || src === '') return dflt;
  if (typeof src === 'number') return src;
  let r = CACHE.get(src);
  if (!r) { r = toRpn(src); CACHE.set(src, r); }
  return evalRpn(r, ctx);
}
