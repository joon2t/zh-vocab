// 등록 주차 키 생성(weekKeyOf)과 가중치 기반 복습 큐 구성(filterDueByWeight, buildSessionQueue)을 검증하는 테스트.
// index.html은 단일 파일 원칙을 지키므로, 함수를 복제하지 않고 index.html의
// "// ---------- week (등록 주차) ----------" 섹션을 그대로 뽑아 eval해서 실행한다(sandhi.test.mjs와 동일한 방식).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const start = html.indexOf('// ---------- week (등록 주차) ----------');
const end = html.indexOf('// ---------- words ----------');
assert.ok(start >= 0 && end > start, 'index.html에서 week 섹션을 찾지 못했습니다.');
const section = html.slice(start, end);

const load = new Function(`${section}\nreturn { weekKeyOf, weekLabelOf, weekLevelOf, filterDueByWeight, buildSessionQueue };`);
const { weekKeyOf, weekLabelOf, weekLevelOf, filterDueByWeight, buildSessionQueue } = load();

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}

// KST(UTC+9) 기준 특정 날짜의 epoch ms를 만든다. h는 KST 기준 시(0~23), 기본 정오(경계에서 안전).
function kst(y, m, d, h = 12){ return Date.UTC(y, m - 1, d, h, 0, 0) - 9 * 3600000; }

// ---- weekKeyOf: 주차 경계 ----
test('weekKeyOf: 2024-01-01(월)은 2024-W01', () => {
  assert.equal(weekKeyOf(kst(2024, 1, 1)), '2024-W01');
});
test('weekKeyOf: 2024-01-07(일, 같은 주)도 2024-W01', () => {
  assert.equal(weekKeyOf(kst(2024, 1, 7)), '2024-W01');
});
test('weekKeyOf: 2024-01-08(월, 다음 주)은 2024-W02', () => {
  assert.equal(weekKeyOf(kst(2024, 1, 8)), '2024-W02');
});
test('weekKeyOf: 연말 경계 — 2023-12-31(일)은 ISO상 2023-W52', () => {
  assert.equal(weekKeyOf(kst(2023, 12, 31)), '2023-W52');
});
test('weekKeyOf: KST 자정 직후(00:01)와 직전(23:59)이 다른 주로 갈린다', () => {
  assert.equal(weekKeyOf(kst(2024, 1, 7, 23)), '2024-W01'); // 일요일 밤 — 아직 그 주
  assert.equal(weekKeyOf(kst(2024, 1, 8, 0)), '2024-W02');  // 월요일 새벽 — 다음 주
});
test('weekLabelOf: 주차 키 → "N월 M주차" 라벨', () => {
  assert.equal(weekLabelOf('2024-W01'), '1월 1주차');
});

// ---- weekLevelOf: 기본값·매핑 ----
test('weekLevelOf: 가중치 미지정이면 normal', () => {
  assert.equal(weekLevelOf(kst(2024, 1, 1), {}), 'normal');
});
test('weekLevelOf: 지정된 값(high/low/off)을 그대로 반환', () => {
  const key = weekKeyOf(kst(2024, 1, 1));
  assert.equal(weekLevelOf(kst(2024, 1, 1), { [key]: 'high' }), 'high');
  assert.equal(weekLevelOf(kst(2024, 1, 1), { [key]: 'low' }), 'low');
  assert.equal(weekLevelOf(kst(2024, 1, 1), { [key]: 'off' }), 'off');
});
test('weekLevelOf: 알 수 없는 값은 normal로 취급(방어적)', () => {
  const key = weekKeyOf(kst(2024, 1, 1));
  assert.equal(weekLevelOf(kst(2024, 1, 1), { [key]: 'garbage' }), 'normal');
});

// ---- filterDueByWeight: off 제외, 기한순 정렬 ----
function mkWord(id, dueOffsetMs, addedMs){ return { id, due: dueOffsetMs, added: addedMs }; }

test('filterDueByWeight: 기한이 안 된 단어는 빠진다', () => {
  const now = 1000000;
  const words = [mkWord('a', now - 1, kst(2024,1,1)), mkWord('b', now + 1, kst(2024,1,1))];
  const out = filterDueByWeight(words, {}, now);
  assert.deepEqual(out.map(w => w.id), ['a']);
});
test('filterDueByWeight: off로 지정된 주차의 단어는 기한이 됐어도 제외된다', () => {
  const now = 1000000;
  const wkA = kst(2024, 1, 1), wkB = kst(2024, 2, 1);
  const words = [mkWord('a', now - 1, wkA), mkWord('b', now - 1, wkB)];
  const weights = { [weekKeyOf(wkA)]: 'off' };
  const out = filterDueByWeight(words, weights, now);
  assert.deepEqual(out.map(w => w.id), ['b']);
});
test('filterDueByWeight: 기한 오름차순으로 정렬된다', () => {
  const now = 1000000;
  const wk = kst(2024, 1, 1);
  const words = [mkWord('late', now - 1, wk), mkWord('early', now - 100, wk)];
  const out = filterDueByWeight(words, {}, now);
  assert.deepEqual(out.map(w => w.id), ['early', 'late']);
});
test('filterDueByWeight: 빈 목록이면 빈 배열', () => {
  assert.deepEqual(filterDueByWeight([], {}, 1000000), []);
});

// ---- buildSessionQueue: high 우선 배치 + 재출현, low 후순위, off 제외 ----
test('buildSessionQueue: high는 앞에 오고 low는 뒤로 밀린다', () => {
  const now = 1000000;
  const wkHigh = kst(2024, 1, 1), wkNorm = kst(2024, 2, 1), wkLow = kst(2024, 3, 1);
  const words = [
    mkWord('n', now - 1, wkNorm),
    mkWord('l', now - 1, wkLow),
    mkWord('h', now - 1, wkHigh),
  ];
  const weights = { [weekKeyOf(wkHigh)]: 'high', [weekKeyOf(wkLow)]: 'low' };
  const out = buildSessionQueue(words, weights, now);
  // high, normal, low 순 + high가 세션 내 재출현으로 맨 뒤에 한 번 더
  assert.deepEqual(out.map(w => w.id), ['h', 'n', 'l', 'h']);
});
test('buildSessionQueue: off는 큐에서 완전히 제외된다', () => {
  const now = 1000000;
  const wkOff = kst(2024, 1, 1), wkNorm = kst(2024, 2, 1);
  const words = [mkWord('off1', now - 1, wkOff), mkWord('norm1', now - 1, wkNorm)];
  const weights = { [weekKeyOf(wkOff)]: 'off' };
  const out = buildSessionQueue(words, weights, now);
  assert.deepEqual(out.map(w => w.id), ['norm1']);
});
test('buildSessionQueue: high가 없으면 재출현도 없다(중복 없음)', () => {
  const now = 1000000;
  const wk = kst(2024, 1, 1);
  const words = [mkWord('a', now - 1, wk), mkWord('b', now - 2, wk)];
  const out = buildSessionQueue(words, {}, now);
  assert.deepEqual(out.map(w => w.id), ['b', 'a']);
});
test('buildSessionQueue: 빈 단어장이면 빈 큐(startSession이 false를 반환하게 되는 전제)', () => {
  assert.deepEqual(buildSessionQueue([], {}, 1000000), []);
});
test('buildSessionQueue: 기존 SRS 필드(due 등)를 변형하지 않는다(원본 객체 참조 그대로 반환)', () => {
  const now = 1000000;
  const wk = kst(2024, 1, 1);
  const w = mkWord('a', now - 1, wk);
  const out = buildSessionQueue([w], {}, now);
  assert.equal(out[0], w); // 같은 객체 참조 — 복제·변형 없음
  assert.equal(out[0].due, now - 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
