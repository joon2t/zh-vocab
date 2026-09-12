// 획순 연습 기능의 순수 로직(strokeCharsOf·hasStrokeData)을 검증하는 테스트.
// index.html은 단일 파일 원칙을 지키므로, 함수를 복제하지 않고
// index.html의 "// ---------- stroke writer (획순 연습) ----------" 섹션을 그대로 뽑아 eval해서 실행한다.
// strokeCharsOf는 isCJK에 의존하는데, isCJK는 다른 섹션("// ---------- reading check ----------")에
// 정의돼 있어 그 섹션 전체를 끌어오면 무관한 의존성(pyd, ensureDict 등)까지 딸려온다 — 그래서 이 파일에서는
// isCJK를 index.html과 동일한 한 줄 정의로 다시 선언한다(sandhi.test.mjs가 esc/$ 스텁을 쓰는 것과 같은 방식).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const start = html.indexOf('// ---------- stroke writer (획순 연습) ----------');
const end = html.indexOf('// ---------- events ----------');
assert.ok(start >= 0 && end > start, 'index.html에서 stroke writer 섹션을 찾지 못했습니다.');
const section = html.slice(start, end);

const isCJKLine = "const isCJK = ch => { const c = ch.codePointAt(0); return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF) || (c >= 0xF900 && c <= 0xFAFF); };";

const source = [
  isCJKLine,
  'const esc = s => String(s==null?"":s);', // strokeModalHtml 등에서 참조되지만 이 테스트는 호출하지 않음(로드만 됨)
  'const $ = () => null;',
  section,
  'return { strokeCharsOf, hasStrokeData };'
].join('\n');

const load = new Function('document', source);
const { strokeCharsOf, hasStrokeData } = load({ getElementById: () => null });

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}

// ============ strokeCharsOf ============

test('strokeCharsOf: 한 글자 단어 → 글자 1개', () => {
  assert.deepEqual(strokeCharsOf('你'), ['你']);
});

test('strokeCharsOf: 두 글자 단어 → 순서대로 2개', () => {
  assert.deepEqual(strokeCharsOf('你好'), ['你', '好']);
});

test('strokeCharsOf: 같은 글자가 반복되면 중복 제거(谢谢 → 谢 1개)', () => {
  assert.deepEqual(strokeCharsOf('谢谢'), ['谢']);
});

test('strokeCharsOf: 공백은 무시한다', () => {
  assert.deepEqual(strokeCharsOf('你 好'), ['你', '好']);
});

test('strokeCharsOf: 한자가 아닌 문자(영문·숫자·문장부호)는 제외한다', () => {
  assert.deepEqual(strokeCharsOf('你好! 123 abc'), ['你', '好']);
});

test('strokeCharsOf: 빈 문자열/한자 없음 → 빈 배열', () => {
  assert.deepEqual(strokeCharsOf(''), []);
  assert.deepEqual(strokeCharsOf('hello'), []);
});

test('strokeCharsOf: null/undefined 입력에도 죽지 않고 빈 배열', () => {
  assert.deepEqual(strokeCharsOf(null), []);
  assert.deepEqual(strokeCharsOf(undefined), []);
});

// ============ hasStrokeData ============

test('hasStrokeData: 데이터에 있는 글자 → true', () => {
  assert.equal(hasStrokeData('你', { '你': {} }), true);
});

test('hasStrokeData: 데이터에 없는 글자 → false', () => {
  assert.equal(hasStrokeData('你', { '好': {} }), false);
});

test('hasStrokeData: 데이터가 아직 없음(null, 파싱 전/실패) → false', () => {
  assert.equal(hasStrokeData('你', null), false);
});

test('hasStrokeData: Object.prototype 체인의 값과 혼동하지 않는다(예: "toString")', () => {
  assert.equal(hasStrokeData('toString', { '你': {} }), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
