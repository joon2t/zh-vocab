// checkWord()·checkAnswer()의 변조(tone sandhi) 리뷰 지적 재현 테스트 (2차 사이클).
// index.html은 단일 파일 원칙을 지키므로 함수를 복제하지 않고 관련 섹션을 그대로 뽑아 eval해서 실행한다.
// checkWord/checkAnswer는 내장 사전(#py-dict script)과 DOM($)에 의존하므로, index.html에서
// 사전 JSON을 직접 추출해 로드하고 document/$/session/render는 최소 스텁으로 대체한다.
//
// 주의: readingCheckSection·checkAnswerSource는 백틱 템플릿 리터럴을 담고 있으므로,
// 이 파일에서 그 텍스트를 outer 템플릿 리터럴(`${...}`) 안에 끼워 넣으면 안 된다(중첩 백틱이 깨짐).
// 반드시 배열 join으로 순수 문자열 이어붙이기만 한다.
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

const dictMatch = html.match(/<script id="py-dict" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(dictMatch, 'py-dict 사전 JSON을 찾지 못했습니다.');
const dictJson = dictMatch[1];

const pinyinSection = section('// ---------- pinyin ----------', '// ---------- storage ----------');
const readingCheckSection = section('// ---------- reading check ----------', '// ---------- words ----------');

const checkAnswerStart = html.indexOf('function checkAnswer(){');
const checkAnswerEnd = html.indexOf('\nfunction renderAdd(', checkAnswerStart);
assert.ok(checkAnswerStart >= 0 && checkAnswerEnd > checkAnswerStart, 'checkAnswer 함수를 찾지 못했습니다.');
const checkAnswerSource = html.slice(checkAnswerStart, checkAnswerEnd);

const source = [
  'const esc = s => String(s==null?"":s).replace(/[&<>"\']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]));',
  'const $ = (s, r) => (r||document).querySelector(s);',
  pinyinSection,
  'let session = { cur:null, pending:null };',
  'function render(){}',
  readingCheckSection,
  checkAnswerSource,
  'return { sandhiInfo, canon, marks, loose, checkWord, issuesHtml, sandhiHintHtml, checkAnswer, session, sandhiGradableCanon, sandhiGradableChanged, sandhiSpokenCanon, r3ExcludeSet, pyd };'
].join('\n');

const ansBox = { value: '' };
const documentStub = {
  getElementById(id){ return id === 'py-dict' ? { textContent: dictJson } : null; },
  querySelector(sel){ return sel === '#ans' ? ansBox : null; }
};

const load = new Function('document', source);
const M = load(documentStub);

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}
function plain(s){ return String(s).replace(/<[^>]+>/g, ''); }
function answer(word, typed){
  M.session.cur = word;
  ansBox.value = typed;
  M.checkAnswer();
  return M.session.pending;
}

// ============ checkWord ============

// 🔴1 의도 케이스: 3성 연쇄 변조로 입력한 你好(ni2 hao3)는 이슈 없이 통과, sandhiNotes로만 안내해야 한다.
test('checkWord: 你好 ni2 hao3 → 변조 관대화 동작 (이슈 0, sandhiNotes 1)', () => {
  const issues = M.checkWord('你好', M.canon('ni2 hao3'));
  assert.equal(issues.length, 0);
  assert.equal(issues.sandhiNotes.length, 1);
});

// 🔴1 역효과 재현: 洗手间의 변조(洗 3성 연쇄)와 무관하게 间을 jian2로 잘못 적으면 이슈가 그대로 남아야 한다.
test('checkWord: 洗手间 xi3 shou3 jian2 → 间 오류는 변조와 무관하게 이슈 유지', () => {
  const issues = M.checkWord('洗手间', M.canon('xi3 shou3 jian2'));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ch, '间');
  assert.ok(!plain(issues[0].msg).includes('2성'), '间에는 2성 독음이 없으므로 거짓 문구가 나오면 안 된다');
});

test('checkWord: 很好吃 hen2 hao3 chi2 → 很의 변조는 관대, 吃 오류는 이슈 유지', () => {
  const issues = M.checkWord('很好吃', M.canon('hen2 hao3 chi2'));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ch, '吃');
  assert.equal(issues.sandhiNotes.length, 1);
});

test('checkWord: 一起 yi1 qi1 → 起 오류는 一 변조와 무관하게 이슈 유지', () => {
  const issues = M.checkWord('一起', M.canon('yi1 qi1'));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ch, '起');
});

test('checkWord: 一样 yi1 yang2 → 样 오류는 一 변조와 무관하게 이슈 유지', () => {
  const issues = M.checkWord('一样', M.canon('yi1 yang2'));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ch, '样');
});

// 회귀: 변조 없는 단어의 실제 오류·정답 판정은 참조 기준 계산으로 바뀌어도 그대로 동작해야 한다.
test('회귀 - checkWord: 苹果 ping2 guo2 (변조 없음, 果 오타) → 이슈 1개', () => {
  const issues = M.checkWord('苹果', M.canon('ping2 guo2'));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ch, '果');
  assert.equal(issues.sandhiNotes.length, 0);
});
test('회귀 - checkWord: 苹果 ping2 guo3 (정답) → 이슈 없음', () => {
  const issues = M.checkWord('苹果', M.canon('ping2 guo3'));
  assert.equal(issues.length, 0);
  assert.equal(issues.sandhiNotes.length, 0);
});

// ============ checkAnswer ============

test('checkAnswer: 你好 ni2 hao3 → 3성 연쇄 변조 관대화로 정답 처리(회귀 유지)', () => {
  const p = answer({ hz:'你好', py:'ni3 hao3' }, 'ni2 hao3');
  assert.equal(p.result, 'pass');
  assert.ok(p.sandhiNote);
});

test('checkAnswer: 不是 bu2 shi4 → 不 변조 관대화로 정답 처리(회귀 유지)', () => {
  const p = answer({ hz:'不是', py:'bu4 shi4' }, 'bu2 shi4');
  assert.equal(p.result, 'pass');
});

// 🔴2 一月/一号: 숫자·순서·날짜의 一은 표준 발음이 yī 그대로라, 一 변조(R3) 입력을 정답 처리하면 안 된다.
test('checkAnswer: 一月 yi2 yue4 → 一 변조는 채점 관대화 대상 아님(오답 처리)', () => {
  const p = answer({ hz:'一月', py:'yi1 yue4' }, 'yi2 yue4');
  assert.equal(p.result, 'fail');
});
test('checkAnswer: 一号 yi2 hao4 → 一 변조는 채점 관대화 대상 아님(오답 처리)', () => {
  const p = answer({ hz:'一号', py:'yi1 hao4' }, 'yi2 hao4');
  assert.equal(p.result, 'fail');
});
test('checkAnswer: 一月 yi1 yue4 (표기 그대로 입력) → 정답 처리', () => {
  const p = answer({ hz:'一月', py:'yi1 yue4' }, 'yi1 yue4');
  assert.equal(p.result, 'pass');
});

// 회귀: 변조 없는 단어는 그대로 채점된다.
test('회귀 - checkAnswer: 苹果 ping2 guo2 (변조 없음, 오타) → 오답 처리', () => {
  const p = answer({ hz:'苹果', py:'ping2 guo3' }, 'ping2 guo2');
  assert.equal(p.result, 'fail');
});
test('회귀 - checkAnswer: 苹果 ping2 guo3 (정답) → 정답 처리', () => {
  const p = answer({ hz:'苹果', py:'ping2 guo3' }, 'ping2 guo3');
  assert.equal(p.result, 'pass');
});

// ============ sandhiHintHtml 라벨 완화 (🔴2) ============
test('sandhiHintHtml: 一이 섞인 변조는 "발음 참고" 라벨(단정형 금지)', () => {
  const html2 = M.sandhiHintHtml('yi1 yue4', '一月', 'hint-yiyue');
  assert.ok(html2.includes('발음 참고'));
  assert.ok(!html2.includes('실제 발음'));
});
test('sandhiHintHtml: 3성 연쇄 변조는 기존대로 "실제 발음" 라벨', () => {
  const html2 = M.sandhiHintHtml('ni3 hao3', '你好', 'hint-nihao');
  assert.ok(html2.includes('실제 발음'));
});

// ============ 🔴 유령 3성 연쇄 차단 (3차 사이클) ============
// refCanon이 사전에 없는 단어의 대표 독음(다음자의 첫 reading)으로 조립될 때, 실제로는 없는
// 3-3 연쇄가 생겨 R1 면제가 잘못 발동하는 문제. 放暑假(暑는 3성 하나뿐, 假의 표준 발음은 4성 jià라
// 연쇄가 없음)와 美少女(少는 이 단어에서 4성 shào, 연쇄 없음) 모두 실제로는 성조 오류가 있어야 한다.
test('checkWord: 放暑假 fang4 shu2 jia4 → 유령 3-3 연쇄로 면제되면 안 됨(이슈 발생)', () => {
  const issues = M.checkWord('放暑假', M.canon('fang4 shu2 jia4'));
  assert.ok(issues.length > 0, '暑의 성조 오류가 유령 연쇄로 면제되지 않아야 한다');
  assert.equal(issues[0].ch, '暑');
  assert.equal(issues.sandhiNotes.length, 0);
});
test('checkWord: 美少女 mei2 shao4 nv3 → 유령 3-3 연쇄로 면제되면 안 됨(이슈 발생)', () => {
  const issues = M.checkWord('美少女', M.canon('mei2 shao4 nv3'));
  assert.ok(issues.length > 0, '美의 성조 오류가 유령 연쇄로 면제되지 않아야 한다');
  assert.equal(issues[0].ch, '美');
  assert.equal(issues.sandhiNotes.length, 0);
});
// 회귀: 진짜 3-3 연쇄(你好)는 계속 관대화돼야 한다 — 기존 71번째 줄 테스트와 동일 취지의 재확인.
test('회귀 - checkWord: 你好 ni2 hao3 → 진짜 3성 연쇄는 계속 관대화', () => {
  const issues = M.checkWord('你好', M.canon('ni2 hao3'));
  assert.equal(issues.length, 0);
  assert.equal(issues.sandhiNotes.length, 1);
});

// ============ 🟡2 R3 채점 제외 범위 축소 (등재된 一만 제외) ============
// 一起는 pyd.w에 등재돼 있지 않으므로, 一(R3) 변조 발음(yì qǐ)을 그대로 입력하면 정답 처리해야 한다.
// 반대로 一月/一号는 등재돼 있고 등재 병음이 一를 1성으로 표기하므로 기존처럼 오답 유지.
test('checkAnswer: 一起 yi4 qi3 → 등재 안 된 一 변조는 정답 처리', () => {
  const p = answer({ hz:'一起', py:'yi1 qi3' }, 'yi4 qi3');
  assert.equal(p.result, 'pass');
});
test('회귀 - checkAnswer: 一月 yi2 yue4 → 등재된 一 변조는 여전히 오답 처리', () => {
  const p = answer({ hz:'一月', py:'yi1 yue4' }, 'yi2 yue4');
  assert.equal(p.result, 'fail');
});
test('r3ExcludeSet: 一起는 미등재라 제외 대상 없음, 一月은 등재된 一(인덱스0) 제외', () => {
  assert.equal(M.r3ExcludeSet('一起').size, 0);
  assert.ok(M.r3ExcludeSet('一月').has(0));
});

// ============ 🟡1 sandhiNote와 sandhiHintHtml의 발음 불일치 해소 ============
// 같은 화면에 함께 뜨는 checkAnswer()의 sandhiNote와 answer()의 sandhiHintHtml은 항상 같은 실제
// 발음(sandhiSpokenCanon, R3 포함)을 보여줘야 한다. 채점용 gradableCanon(등재된 一만 되돌린 값)을
// 안내 문구에 그대로 쓰면, 一가 포함된 단어에서 서로 다른 성조를 "발음"이라고 동시에 보여주는 모순이 생긴다.
// 杀一儆百: 사전에 실제 등재된(sha1 yi1 jing3 bai3) 一(R3 제외 대상)+3성 연쇄(R1) 단어 — 합성 없이
// 실단어로 gradable(채점값)과 spoken(실제 발음)의 차이를 검증한다(3차 리뷰 지적 반영: 합성 케이스 교체).
test('checkAnswer: sandhiNote는 gradableCanon이 아니라 실제 발음(spokenCanon)을 보여준다', () => {
  const hz = '杀一儆百', py = M.pyd.w[hz];
  assert.ok(py, '테스트 전제: 杀一儆百가 사전에 등재되어 있어야 한다');
  const info = M.sandhiInfo(py, hz);
  const excludeIdx = M.r3ExcludeSet(hz);
  const gradableCanon = M.sandhiGradableCanon(info, excludeIdx);
  const spokenCanon = M.sandhiSpokenCanon(info);
  assert.notEqual(gradableCanon, spokenCanon, '테스트 전제: 一의 채점값과 실제 발음값이 달라야 한다');

  const p = answer({ hz, py }, gradableCanon); // 채점 관대화 대상인 R1(你好)만 반영해 입력
  assert.equal(p.result, 'pass');
  assert.ok(p.sandhiNote.includes(M.marks(spokenCanon)), 'sandhiNote는 실제 발음(spokenCanon)을 보여줘야 한다');
  assert.ok(!p.sandhiNote.includes(M.marks(gradableCanon)) || gradableCanon === spokenCanon, 'sandhiNote가 채점용 되돌린 값(gradableCanon)을 발음이라고 보여주면 안 된다');

  const hintHtml = M.sandhiHintHtml(py, hz, 'test-shayijingbai');
  assert.ok(hintHtml.includes(M.marks(spokenCanon)), 'sandhiHintHtml도 같은 실제 발음을 보여줘야 한다(모순 해소 확인)');
  // R3 포함 통과 시 sandhiNote 라벨도 완화형이어야 한다(최종 리뷰 🟡 반영).
  assert.ok(p.sandhiNote.includes('발음 참고'), 'R3 포함 단어의 sandhiNote는 단정형이 아닌 완화형이어야 한다');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
