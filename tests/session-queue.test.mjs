// 통합 리뷰 🔴1 재현 테스트: "재출현(high 세션 내 두 번째 노출)이 finishCard→applyGrade를 그대로 타면서
// stage/reps가 이중으로 오르고 오늘 복습 로그도 두 번 찍히는" 문제를 세션 큐 "소비 루프"(startSession →
// nextCard → finishCard 반복) 그대로 재현해서 고정한다. index.html은 단일 파일 원칙을 지키므로 함수를
// 복제하지 않고 관련 섹션을 그대로 뽑아 eval해서 실행한다(week-queue.test.mjs·checkword-checkanswer.test.mjs와
// 동일한 방식). DOM에 의존하는 save()/render()/toast()만 최소 스텁으로 대체한다.
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

const weekSection = section('// ---------- week (등록 주차) ----------', '// ---------- words ----------');
const wordsSection = section('// ---------- words ----------', '// ---------- tiles ----------');
const sessionSection = section('// ---------- session ----------', '// ---------- render ----------');

const isCjkStart = html.indexOf('const isCJK = ch =>');
const isCjkEnd = html.indexOf('\n', isCjkStart);
assert.ok(isCjkStart >= 0, 'isCJK를 찾지 못했습니다.');
const isCjkSource = html.slice(isCjkStart, isCjkEnd);

// 실제 앱의 helpers 섹션(uid/today/shuffle 등)은 DOM·전역 시계에 의존하므로, checkword-checkanswer.test.mjs와
// 같은 방식으로 이 파일에서 최소한만 재선언한다(session/week/words 섹션 자체는 절대 복제하지 않는다).
const source = [
  'const DAY = 86400000;',
  'const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];',
  'let uidSeq = 0;',
  'const uid = () => "id" + (uidSeq++);',
  'const today = () => "2024-01-01";', // 로그 버킷 키 고정 — 테스트 내내 하루 취급
  'function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }',
  'function toast(){}',
  'function save(){}',
  'function render(){}',
  'const speechOK = false;',
  'const ttsOK = false;',
  'let speakUnsupportedNotified = false;',
  'function clozeOf(){ return null; }', // pickType이 참조 — 이 테스트는 cloze 판정 자체를 다루지 않으므로(cloze.test.mjs 참고) 최소 스텁
  isCjkSource,
  'let S = { words: [], log: {}, settings: { mode:"recog", weekWeights:{} } };', // mode:'recog' — pickType이 mix 랜덤 없이 결정적으로 동작
  'let session = { active:false, finished:false, extra:false, queue:[], cur:null, curExtra:false, type:null, revealed:false, pending:null, done:0, ok:0 };',
  weekSection,
  wordsSection,
  sessionSection,
  'return { S: () => S, setS: v => { S = v; }, session: () => session, buildSessionQueue, filterDueByWeight, weekKeyOf, startSession, nextCard, finishCard, applyGrade };'
].join('\n');

const load = new Function(source);
const M = load();

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}

function kst(y, m, d, h = 12){ return Date.UTC(y, m - 1, d, h, 0, 0) - 9 * 3600000; }
function mkWord(id, addedMs, dueMs){
  return { id, hz: '你好', py: 'ni3hao3', mean: '안녕', ex: '', added: addedMs, stage: 0, due: dueMs, reps: 0, lapses: 0, last: 0 };
}

// ---- 리뷰 재현 시나리오: high 1개 + normal 2개, 전부 기한 도래 ----
// buildSessionQueue는 [high, normal1, normal2, high] 순으로 큐를 짠다(재출현 1회). 세션을 끝까지 소비했을 때
// high 단어가 "채점 두 번"을 받아서는 안 된다 — 이게 바로 리뷰가 지적한 이중 채점 버그의 재현 조건이다.
function setupTripleWordSession(){
  const now = 1000000;
  const wkHigh = kst(2024, 1, 1), wkNorm = kst(2024, 2, 1);
  const high = mkWord('h', wkHigh, now - 1);
  const n1 = mkWord('n1', wkNorm, now - 3); // n1이 n2보다 기한이 더 지나 있어 정렬상 먼저 나온다
  const n2 = mkWord('n2', wkNorm, now - 2);
  M.setS({ words: [high, n1, n2], log: {}, settings: { mode: 'recog', weekWeights: { [M.weekKeyOf(wkHigh)]: 'high' } } });
  return { now, high, n1, n2 };
}

test('buildSessionQueue: 사전 조건 확인 — high 1개면 재출현으로 큐 길이 4(대기 단어는 3개뿐)', () => {
  const { now } = setupTripleWordSession();
  const queue = M.buildSessionQueue(M.S().words, M.S().settings.weekWeights, now);
  assert.deepEqual(queue.map(w => w.id), ['h', 'n1', 'n2', 'h']);
  // 배지·"대기 카드 수"에 쓰이는 filterDueByWeight는 재출현을 세지 않는다 — 세션 큐 길이(4)와 다른 게 정상.
  assert.equal(M.filterDueByWeight(M.S().words, M.S().settings.weekWeights, now).length, 3);
});

test('세션 소비 루프: 재출현 카드는 finishCard에서 채점되지 않는다(stage/reps 단일 상승, 로그 3회)', () => {
  const { high, n1, n2 } = setupTripleWordSession();
  assert.equal(M.startSession(false), true);
  const session = M.session();
  assert.equal(session.total, 4); // 큐 길이(재출현 포함)

  // 카드 1: high, 첫 노출 — 채점됨
  assert.equal(session.cur.id, 'h'); assert.equal(session.curExtra, false);
  M.finishCard('pass');
  // 카드 2: normal 1 — 채점됨
  assert.equal(session.cur.id, 'n1'); assert.equal(session.curExtra, false);
  M.finishCard('pass');
  // 카드 3: normal 2 — 채점됨
  assert.equal(session.cur.id, 'n2'); assert.equal(session.curExtra, false);
  M.finishCard('pass');
  // 카드 4: high 재출현 — 채점 버튼이 없는 "한 번 더 보기"라 result 없이 finishCard 호출(data-act="extraNext")
  assert.equal(session.cur.id, 'h'); assert.equal(session.curExtra, true);
  M.finishCard();

  // 세션 종료: 큐를 전부 소비했다
  assert.equal(session.finished, true);
  assert.equal(session.active, false);

  // 채점 횟수: 실제로 grade가 반영된 카드는 3장(정답 집계 ok)뿐, done은 노출 4회 전부 포함
  assert.equal(session.done, 4);
  assert.equal(session.ok, 3);

  // stage/reps: high 단어도 다른 두 단어와 똑같이 "한 번"만 올라야 한다(이중 상승이면 stage=2가 된다)
  assert.equal(high.reps, 1);
  assert.equal(high.stage, 1);
  assert.equal(n1.reps, 1); assert.equal(n1.stage, 1);
  assert.equal(n2.reps, 1); assert.equal(n2.stage, 1);

  // 로그 횟수: 오늘 복습 기록은 실제 채점 3회만 — 재출현까지 찍히면 4가 된다(통계 부풀림 재현 조건)
  assert.equal(M.S().log['2024-01-01'].n, 3);
});

test('세션 소비 루프: high가 없으면 재출현도 없고, 모든 카드가 정상 채점된다', () => {
  const now = 1000000;
  const wk = kst(2024, 1, 1);
  const a = mkWord('a', wk, now - 1), b = mkWord('b', wk, now - 2);
  M.setS({ words: [a, b], log: {}, settings: { mode: 'recog', weekWeights: {} } });
  assert.equal(M.startSession(false), true);
  const session = M.session();
  assert.equal(session.total, 2);
  M.finishCard('pass');
  assert.equal(session.curExtra, false);
  M.finishCard('pass');
  assert.equal(session.finished, true);
  assert.equal(session.done, 2); assert.equal(session.ok, 2);
  assert.equal(a.stage, 1); assert.equal(b.stage, 1);
  assert.equal(M.S().log['2024-01-01'].n, 2);
});

test('세션 소비 루프: 오답(fail)은 재출현이 아닌 한 이 세션 끝에 다시 채점 대상으로 들어간다', () => {
  const now = 1000000;
  const wk = kst(2024, 1, 1);
  const a = mkWord('a', wk, now - 1);
  M.setS({ words: [a], log: {}, settings: { mode: 'recog', weekWeights: {} } });
  M.startSession(false);
  const session = M.session();
  M.finishCard('fail'); // 큐 끝에 다시 들어가야 함(extraView:false로)
  assert.equal(session.finished, false);
  assert.equal(session.cur.id, 'a'); assert.equal(session.curExtra, false);
  M.finishCard('pass');
  assert.equal(session.finished, true);
  assert.equal(a.reps, 2); // 실패 1회 + 성공 1회
  assert.equal(a.lapses, 1);
  assert.equal(M.S().log['2024-01-01'].n, 2); // 실패도 로그는 남는다(오늘 복습 횟수에는 포함)
});

// ---- 🟡5 재현: extra(미리 복습)에도 off 주차 제외가 적용돼야 한다 ----
test('startSession(extra=true): 쉬는 주차(off) 단어는 미리 복습 대상에서도 제외된다', () => {
  const now = 1000000;
  const wkOff = kst(2024, 1, 1), wkNorm = kst(2024, 2, 1);
  const offWord = mkWord('off1', wkOff, now + 999999); // 기한도 안 됐고 off 주차 — extra는 기한 무관하게 뽑으므로 off 배제 여부만 검증
  const normWord = mkWord('norm1', wkNorm, now + 999999);
  M.setS({ words: [offWord, normWord], log: {}, settings: { mode: 'recog', weekWeights: { [M.weekKeyOf(wkOff)]: 'off' } } });
  assert.equal(M.startSession(true), true);
  const ids = M.session().queue.map(item => item.id).concat(M.session().cur ? [M.session().cur.id] : []);
  assert.ok(!ids.includes('off1'), 'off 주차 단어가 미리 복습 큐에 들어갔습니다');
  assert.ok(ids.includes('norm1'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
