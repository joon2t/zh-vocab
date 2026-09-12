// 리뷰 🟡1 재현 케이스 고정: mountStrokeWriter가 HanziWriter 인스턴스를 재사용하는지 검증한다.
// HanziWriter 라이브러리는 생성 시(Ct 생성자 → _setupListeners) document에 mouseup/touchend 리스너를
// 달고, 해제 API가 없다(index.html의 stroke writer 섹션 주석 참고). 그래서 모달을 열고 닫거나 글자
// 탭·모드를 바꿀 때마다 HanziWriter.create()를 새로 부르면 리스너가 계속 쌓인다(리뷰 재현: 20회 열닫 후
// 20개 전부 생존). 이 테스트는 실제 document/HanziWriter 대신 create() 호출 횟수를 세는 가짜 객체로
// 대체해, 반복 열닫·글자 탭 전환·모드 전환·"다시 재생" 전부 create()를 한 번만 부르고 이후에는
// setCharacter()로 재사용하는지 확인한다.
//
// index.html은 단일 파일 원칙을 지키므로, stroke-chars.test.mjs와 동일하게
// "// ---------- stroke writer (획순 연습) ----------" 섹션을 그대로 뽑아 eval해서 실행한다.
// 이 섹션이 참조하는 document/$/HanziWriter는 실제 라이브러리 대신 가짜 구현을 Function 파라미터로 주입한다.
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

// 실제 DOM 없이 렌더 사이클을 흉내낸다: #strokeModal의 innerHTML을 새로 대입할 때마다(실제 브라우저가
// 매번 새 자식 노드를 만드는 것과 동일하게) #strokeStage/#strokeMsg에 해당하는 "새" placeholder를
// registry에 등록한다. replaceWith(node)는 그 자리를 node로 교체한 것처럼 registry를 갱신한다.
function makeEnv(){
  const registry = {};
  function makePlaceholder(id, className){
    return { id, className, replaceWith(node){ registry['#' + id] = node; } };
  }
  const modal = {
    hidden: true,
    set innerHTML(htmlStr){
      registry['#strokeStage'] = /id="strokeStage"/.test(htmlStr) ? makePlaceholder('strokeStage', 'strokestage') : null;
      registry['#strokeMsg'] = /id="strokeMsg"/.test(htmlStr) ? { textContent: '' } : null;
    },
    get innerHTML(){ return ''; }
  };
  registry['#strokeModal'] = modal;
  const $ = sel => registry[sel] || null;
  const fakeDocument = { createElement: () => ({}) };

  let createCalls = 0;
  const instances = [];
  const fakeHanziWriter = {
    create(target, ch, opts){
      createCalls++;
      const inst = {
        target, opts, char: ch,
        setCharacter(c){ this.char = c; },
        animateCharacter(){ this.lastAction = 'view'; },
        quiz(){ this.lastAction = 'quiz'; }
      };
      instances.push(inst);
      return inst;
    }
  };

  const source = [
    isCJKLine,
    'const esc = s => String(s==null?"":s);',
    section,
    'function setStrokeData(d){ strokeData = d; strokeDataFailed = false; }',
    'return { openStrokeModal, closeStrokeModal, renderStrokeModal, mountStrokeWriter, strokeUi, setStrokeData };'
  ].join('\n');
  const load = new Function('document', '$', 'HanziWriter', source);
  const M = load(fakeDocument, $, fakeHanziWriter);
  return { M, registry, instances, getCreateCalls: () => createCalls };
}

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}

test('모달을 20번 열고 닫아도 HanziWriter.create()는 처음 한 번만 호출된다(누수 재현 고정)', () => {
  const { M, getCreateCalls } = makeEnv();
  M.setStrokeData({ '你': {} });
  for (let i = 0; i < 20; i++) {
    M.openStrokeModal('你');
    M.closeStrokeModal();
  }
  assert.equal(getCreateCalls(), 1, 'HanziWriter.create()가 20번 호출되면(=인스턴스 20개 생존) 리스너 누수가 재현된 것입니다.');
});

test('글자 탭 전환·모드 전환·"다시 재생" 모두 새 인스턴스를 만들지 않고 setCharacter로 재사용한다', () => {
  const { M, instances, getCreateCalls } = makeEnv();
  M.setStrokeData({ '你': {}, '好': {} });
  M.openStrokeModal('你好'); // strokeCharsOf('你好') === ['你','好']
  assert.equal(getCreateCalls(), 1);

  M.strokeUi.active = 1; // 글자 탭 전환(你 → 好)
  M.renderStrokeModal();
  assert.equal(getCreateCalls(), 1, '글자 탭 전환이 새 인스턴스를 만들면 안 됩니다.');
  assert.equal(instances[0].char, '好', 'setCharacter로 글자가 갱신돼야 합니다.');

  M.strokeUi.mode = 'quiz'; // 모드 전환(보기 → 연습)
  M.renderStrokeModal();
  assert.equal(getCreateCalls(), 1, '모드 전환이 새 인스턴스를 만들면 안 됩니다.');

  M.mountStrokeWriter(); // "다시 재생"(strokeReplay) — renderStrokeModal을 거치지 않고 직접 호출된다
  assert.equal(getCreateCalls(), 1, '다시 재생이 새 인스턴스를 만들면 안 됩니다.');
});

test('재사용 시 HanziWriter가 실제로 그리는 대상(target) DOM 노드도 계속 같은 노드를 가리킨다', () => {
  const { M, registry, instances } = makeEnv();
  M.setStrokeData({ '你': {} });
  M.openStrokeModal('你');
  const firstTarget = instances[0].target;
  M.closeStrokeModal();
  M.openStrokeModal('你'); // 다시 열어도 같은 인스턴스·같은 target을 재사용해야 한다
  assert.equal(instances.length, 1, '두 번째 열기에서 새 인스턴스가 생기면 안 됩니다.');
  assert.equal(registry['#strokeStage'], firstTarget, '재렌더된 placeholder는 기존 target 노드로 바꿔치기돼야 합니다.');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
