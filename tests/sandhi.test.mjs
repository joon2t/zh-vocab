// 병음 변조(tone sandhi) 안내 함수 sandhiInfo()를 검증하는 테스트.
// index.html은 단일 파일 원칙을 지키므로, 함수를 복제하지 않고
// index.html의 "// ---------- pinyin ----------" 섹션을 그대로 뽑아 eval해서 실행한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const start = html.indexOf('// ---------- pinyin ----------');
const end = html.indexOf('// ---------- storage ----------');
assert.ok(start >= 0 && end > start, 'index.html에서 pinyin 섹션을 찾지 못했습니다.');
const section = html.slice(start, end);

// 같은(현재) 렐름에서 실행해야 배열/객체가 assert.deepEqual과 정상 비교된다 (vm의 별도 컨텍스트는 피함).
const load = new Function(`${section}\nreturn { sandhiInfo, canon, marks };`);
const { sandhiInfo, canon, marks } = load();

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}
function tones(info){ return info.spoken.map(x => x.t); }

// 3성 연쇄 — 2연쇄: 你好 (ni3 hao3) → ní hǎo (앞만 2성)
test('3성 2연쇄: ni3 hao3 → 앞 글자만 2성', () => {
  const info = sandhiInfo('ni3 hao3', '你好');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [2, 3]);
  assert.equal(marks(info.spoken.map(x => x.l + x.t).join(' ')), 'ní hǎo');
  assert.ok(info.notes.length > 0);
});

// 3성 연쇄 — 3연쇄: 我很好 (wo3 hen3 hao3) → 마지막만 3성, 앞 둘은 2성
test('3성 3연쇄: wo3 hen3 hao3 → 앞 두 글자 2성, 마지막만 3성', () => {
  const info = sandhiInfo('wo3 hen3 hao3', '我很好');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [2, 2, 3]);
});

// 不 + 4성 → bú (2성)
test('不+4성: bu4 shi4 (不是) → bú shi4', () => {
  const info = sandhiInfo('bu4 shi4', '不是');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [2, 4]);
});

// 不 + 비4성 → 변화 없음
test('不+비4성: bu4 lai2 (不来) → 변화 없음', () => {
  const info = sandhiInfo('bu4 lai2', '不来');
  assert.equal(info.changed, false);
  assert.deepEqual(tones(info), [4, 2]);
});

// 一 + 4성 → yí (2성)
test('一+4성: yi1 ding4 (一定) → yí ding4', () => {
  const info = sandhiInfo('yi1 ding4', '一定');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [2, 4]);
});

// 一 + 2성 → yì (4성)
test('一+2성: yi1 nian2 (一年) → yì nian2', () => {
  const info = sandhiInfo('yi1 nian2', '一年');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [4, 2]);
});

// 一 단독 → 변화 없음
test('一 단독: yi1 (一 혼자) → 변화 없음', () => {
  const info = sandhiInfo('yi1', '一');
  assert.equal(info.changed, false);
  assert.deepEqual(tones(info), [1]);
});

// 一이 단어 끝자리 → 변화 없음 (예: 第一의 一, 위치상 끝자리)
test('一 끝자리: di4 yi1 (第一, 끝자리) → 변화 없음', () => {
  const info = sandhiInfo('di4 yi1', '第一');
  assert.equal(info.changed, false);
  assert.deepEqual(tones(info), [4, 1]);
});

// 변조 없는 단어: 谢谢 (xie4 xie5) → 변화 없음
test('변조 없음: xie4 xie5 (谢谢) → 변화 없음', () => {
  const info = sandhiInfo('xie4 xie5', '谢谢');
  assert.equal(info.changed, false);
  assert.deepEqual(tones(info), [4, 0]);
  assert.deepEqual(info.notes, []);
});

// 빈 입력
test('빈 입력: 빈 문자열 → changed=false, spoken=[]', () => {
  const info = sandhiInfo('', '');
  assert.equal(info.changed, false);
  assert.deepEqual(info.spoken, []);
  assert.deepEqual(info.notes, []);
});

// 한자 없이 병음만 줘도 3성 연쇄(R1)는 동작해야 함 (한자 정렬이 필요 없는 규칙)
test('한자 없이도 3성 연쇄는 감지: ni3 hao3 (hz 없음)', () => {
  const info = sandhiInfo('ni3 hao3', '');
  assert.equal(info.changed, true);
  assert.deepEqual(tones(info), [2, 3]);
});

// 글자 수와 음절 수가 안 맞으면 不/一 규칙은 건너뛴다 (정렬 불가능 — 보수적으로 미적용)
test('글자-음절 수 불일치 시 不/一 규칙 미적용', () => {
  const info = sandhiInfo('bu4 shi4', '不');
  assert.equal(info.changed, false);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
