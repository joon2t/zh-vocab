// clozeOf() 단위 테스트 — 예문 빈칸 채우기 복습 카드용 판정 순수 함수.
// index.html은 단일 파일 원칙을 지키므로 함수를 복제하지 않고 관련 섹션을 그대로 뽑아 eval해서 실행한다
// (week-queue.test.mjs·checkword-checkanswer.test.mjs와 동일한 방식). clozeOf는 DOM·세션 상태에
// 의존하지 않는 순수 함수라 isCJK 한 줄만 곁들이면 바로 로드된다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function section(startMark, endMark){
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark, s);
  assert.ok(s >= 0 && e > s, `섹션을 찾지 못했습니다: ${startMark} ~ ${endMark}`);
  return html.slice(s, e);
}

const isCjkStart = html.indexOf('const isCJK = ch =>');
const isCjkEnd = html.indexOf('\n', isCjkStart);
assert.ok(isCjkStart >= 0, 'isCJK를 찾지 못했습니다.');
const isCjkSource = html.slice(isCjkStart, isCjkEnd);

const clozeSection = section('// ---------- cloze (예문 빈칸) ----------', '// ---------- week (등록 주차) ----------');

const source = [
  isCjkSource,
  clozeSection,
  'return { clozeOf, clozeChunks };'
].join('\n');

const load = new Function(source);
const M = load();

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}

// ============ 규격형 "中文例句 (pīnyīn) — 한국어 번역" (docs/EXAMPLE_WORKER.md) ============

test('규격형: 문장·빈칸·병음·번역을 모두 분리한다', () => {
  const w = { hz: '图书馆', ex: '我们明天一起去图书馆。(wǒmen míngtiān yìqǐ qù túshūguǎn.) — 우리 내일 같이 도서관에 가.' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我们明天一起去图书馆。');
  assert.equal(cz.blanked, '我们明天一起去＿＿＿。');
  assert.equal(cz.pinyin, 'wǒmen míngtiān yìqǐ qù túshūguǎn.');
  assert.equal(cz.korean, '우리 내일 같이 도서관에 가.');
});

test('규격형: hz가 문장 맨 앞에 있어도 동일하게 동작한다', () => {
  const w = { hz: '喜欢', ex: '喜欢你的猫。(xǐhuan nǐ de māo.) — 네 고양이가 좋아.' };
  const cz = M.clozeOf(w);
  assert.equal(cz.sentence, '喜欢你的猫。');
  assert.equal(cz.blanked, '＿＿你的猫。');
  assert.equal(cz.korean, '네 고양이가 좋아.');
});

// ============ 자유 텍스트(사용자 수동 입력) ============

test('자유 텍스트: 한국어 메모에 중국어 문장이 섞여도 문장부만 뽑는다(병음·번역 없음)', () => {
  const w = { hz: '一起', ex: '메모: 我们一起吃饭吧。 나중에 또 씀' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我们一起吃饭吧。');
  assert.equal(cz.blanked, '我们＿＿吃饭吧。');
  assert.equal(cz.pinyin, undefined);
  assert.equal(cz.korean, undefined);
});

test('자유 텍스트: 괄호가 있어도 병음 규격이 아니면 pinyin/korean을 억지로 채우지 않는다', () => {
  const w = { hz: '猫', ex: '我家有一只猫。(예전에 산 고양이)' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我家有一只猫。');
  assert.equal(cz.blanked, '我家有一只＿。');
  assert.equal(cz.pinyin, undefined);
  assert.equal(cz.korean, undefined);
});

// ============ hz 미포함 ============

test('hz가 예문에 포함되지 않으면 null', () => {
  const w = { hz: '苹果', ex: '我们明天一起去看电影。(wǒmen míngtiān yìqǐ qù kàn diànyǐng.) — 우리 내일 같이 영화 보러 가.' };
  assert.equal(M.clozeOf(w), null);
});

// ============ ex 없음 ============

test('ex가 빈 문자열이면 null', () => {
  assert.equal(M.clozeOf({ hz: '你好', ex: '' }), null);
});
test('ex가 없으면(undefined) null', () => {
  assert.equal(M.clozeOf({ hz: '你好' }), null);
});
test('단어 자체가 없으면(null) null', () => {
  assert.equal(M.clozeOf(null), null);
});

// ============ 괄호 없는 중국어만 ============

test('괄호·구분자 없이 중국어 문장만 있어도 사용 가능(병음·번역 없음)', () => {
  const w = { hz: '电影', ex: '我们一起去看电影。' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我们一起去看电影。');
  assert.equal(cz.blanked, '我们一起去看＿＿。');
  assert.equal(cz.pinyin, undefined);
  assert.equal(cz.korean, undefined);
});

// ============ 다중 출현 hz ============

test('문장에 hz가 두 번 나오면 두 곳 모두 빈칸 처리한다', () => {
  const w = { hz: '喜欢', ex: '我喜欢你，你也喜欢我吗？' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我喜欢你，你也喜欢我吗？');
  assert.equal(cz.blanked, '我＿＿你，你也＿＿我吗？');
});

// ============ 리뷰 🟡2: korean 캡처가 정답 노출 (탐욕적 (.+)$ 매칭) ============

test('규격형: ex에 예문이 두 개 이어 붙어 있어도 korean에 뒤 문장(정답 포함)이 섞이지 않는다(정답 노출 방지)', () => {
  const w = {
    hz: '图书馆',
    ex: '我们明天一起去图书馆。(wǒmen míngtiān yìqǐ qù túshūguǎn.) — 우리 내일 같이 도서관에 가. 他去公司上班。(tā qù gōngsī shàngbān.) — 그는 회사에 출근해.'
  };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我们明天一起去图书馆。');
  assert.equal(cz.pinyin, 'wǒmen míngtiān yìqǐ qù túshūguǎn.');
  assert.equal(cz.korean, '우리 내일 같이 도서관에 가.');
  assert.ok(!cz.korean.includes('他'), 'korean에 뒤 문장의 한자가 섞이면 안 됩니다(정답 노출)');
  assert.ok(!cz.korean.includes('公司'), 'korean에 뒤 문장의 정답 한자가 섞이면 안 됩니다(정답 노출)');
});

test('번역에 정답 한자가 괄호로 병기돼 있어도 korean에 그대로 남지 않는다(이중 방어)', () => {
  const w = { hz: '图书馆', ex: '我们去图书馆。(wǒmen qù túshūguǎn.) — 우리는 도서관(图书馆)에 가요.' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.ok(!cz.korean.includes('图书馆'), 'korean에 정답 한자가 그대로 남아있으면 안 됩니다(정답 노출)');
});

// ============ 리뷰 🟡3: 숫자·라틴 혼재 문장 조각남 ============

test('숫자가 문장 중간에 섞여도(전각 마침표) 문장 전체가 하나로 잡힌다', () => {
  const w = { hz: '苹果', ex: '我有3个苹果。(wǒ yǒu sān gè píngguǒ.) — 나는 사과 3개가 있어.' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我有3个苹果。');
  assert.equal(cz.blanked, '我有3个＿＿。');
  assert.equal(cz.pinyin, 'wǒ yǒu sān gè píngguǒ.');
  assert.equal(cz.korean, '나는 사과 3개가 있어.');
});

test('반각(ASCII) 마침표로 끝나는 예문도 병음·번역이 유실되지 않는다', () => {
  const w = { hz: '图书馆', ex: '我们去图书馆.(wǒmen qù túshūguǎn.) — 우리는 도서관에 가.' };
  const cz = M.clozeOf(w);
  assert.ok(cz);
  assert.equal(cz.sentence, '我们去图书馆.');
  assert.equal(cz.blanked, '我们去＿＿＿.');
  assert.equal(cz.pinyin, 'wǒmen qù túshūguǎn.');
  assert.equal(cz.korean, '우리는 도서관에 가.');
});

test('clozeChunks: 숫자·반각 문장부호는 한자 청크의 연결자일 뿐, 한자 없이 라틴 문자에 둘러싸이면 청크를 잇지 않는다', () => {
  assert.deepEqual(M.clozeChunks('我有3个苹果. (test) 你好'), ['我有3个苹果.', '你好']);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
