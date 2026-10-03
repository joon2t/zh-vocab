// 단어 연습 모드(v6) 테스트 — practice 섹션 순수 로직 + gradePinyin/writeVerdict 동등성 + 정적 격리 + 이스케이프.
// 다른 테스트와 같은 방식으로 index.html 섹션을 잘라 new Function으로 실행한다(함수 복제 없음).
// 주의: 잘라 온 소스에 백틱 템플릿이 있으므로 바깥 템플릿 리터럴에 끼우지 말고 배열 join만 쓴다.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function sectionOf(src, startMark, endMark){
  const s = src.indexOf(startMark);
  const e = src.indexOf(endMark, s);
  assert.ok(s >= 0 && e > s, `섹션을 찾지 못했습니다: ${startMark} ~ ${endMark}`);
  return src.slice(s, e);
}
const section = (a, b) => sectionOf(html, a, b);
function fnSrc(name, src = html){
  const m = new RegExp(`\\n(async )?function ${name}\\(`).exec(src);
  assert.ok(m, `function ${name}을 찾지 못했습니다.`);
  const head = m.index + 1;
  const tail = /\n(?:async function |function |const |let |\/\/ ----------)/g;
  tail.lastIndex = head + m[0].length;
  const e = tail.exec(src);
  return src.slice(head, e ? e.index : src.length);
}
const lineOf = (mark) => { const s = html.indexOf(mark); assert.ok(s >= 0, mark); return html.slice(s, html.indexOf('\n', s)); };
const isCjkLine = lineOf('const isCJK = ch =>');
const escLine = lineOf('const esc = ');

const practiceSrc = section('// ---------- practice ----------', '// ---------- practice ui ----------');
const practiceUiSrc = section('// ---------- practice ui ----------', '// ---------- handwriting pad ----------');

let pass = 0, fail = 0, skipped = 0;
function test(name, fn){
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.log(`FAIL - ${name}\n  ${e.message}`); }
}
const lcg = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

const load = new Function([
  "'use strict';", isCjkLine,
  'let S = { words: [], log: {}, settings: {} };',
  'function save(){ throw new Error("save() 호출됨 — 연습 섹션은 저장하지 않아야 한다"); }',
  practiceSrc,
  'return { setS: v => { S = v; }, getPractice: () => practice, practiceSel, practiceTargetOf, practiceComboMsg, practiceChoices, practiceKindOf, meanClash, practiceNewRound, practiceRecord, practiceSummary, practiceStart, practiceNext, practiceFinishCard, practiceReset };'
].join('\n'));
const M = load();

const W = (id, hz, py, mean, extra) => Object.assign({ id, hz, py, mean, stage: 2, due: 123, reps: 3, lapses: 1, last: 99 }, extra || {});
const BIG = [
  W('a', '你好', 'ni3 hao3', '안녕하세요'), W('b', '谢谢', 'xie4 xie5', '감사합니다'), W('c', '不是', 'bu4 shi4', '아니다'),
  W('d', '一月', 'yi1 yue4', '1월'), W('e', '茶', 'cha2', '차'), W('f', '喝茶', 'he1 cha2', '차를 마시다'),
  W('g', '走', 'zou3', '가다, 걷다'), W('h', '去', 'qu4', '가다'), W('i', '书', 'shu1', '책', { noWrite: true }),
  W('j', '百闻不如一见', 'bai3 wen2 bu4 ru2 yi1 jian4', '백문이 불여일견'), W('k', '一', 'yi1', '하나'),
  W('l', '再见', 'zai4 jian4', '안녕히 가세요'), W('m', '朋友', 'peng2 you5', '친구'),
];
const clone = o => JSON.parse(JSON.stringify(o));

// 1
test('practiceTargetOf: 8조합 — 하나만 해제하면 그 키, 아니면 null', () => {
  const T = M.practiceTargetOf;
  assert.equal(T({ py:false, mean:true, hz:true }), 'py');
  assert.equal(T({ py:true, mean:false, hz:true }), 'mean');
  assert.equal(T({ py:true, mean:true, hz:false }), 'hz');
  assert.equal(T({ py:true, mean:true, hz:true }), null);
  assert.equal(T({ py:false, mean:false, hz:true }), null);
  assert.equal(T({ py:false, mean:true, hz:false }), null);
  assert.equal(T({ py:true, mean:false, hz:false }), null);
  assert.equal(T({ py:false, mean:false, hz:false }), null);
});
test('practiceComboMsg: 유효 3종 서로 다름, 전부 체크/둘 이상 해제 문구도 서로 다름', () => {
  const m = [
    M.practiceComboMsg({ py:false, mean:true, hz:true }), M.practiceComboMsg({ py:true, mean:false, hz:true }),
    M.practiceComboMsg({ py:true, mean:true, hz:false }), M.practiceComboMsg({ py:true, mean:true, hz:true }),
    M.practiceComboMsg({ py:false, mean:false, hz:true }),
  ];
  assert.equal(new Set(m).size, 5, m.join(' | '));
});

// 2
test('practiceChoices(mean): 4개·정답 1개·정답 라벨=trim된 뜻·중복 없음·결정적', () => {
  const w = W('a', '你好', 'ni3 hao3', ' 안녕하세요 ');
  const run = () => M.practiceChoices(w, BIG.concat([w]).filter(x => x.id !== 'a' || x === w), 'mean', lcg(7));
  const c = run();
  assert.equal(c.length, 4);
  assert.equal(c.filter(x => x.correct).length, 1);
  assert.equal(c.find(x => x.correct).label, '안녕하세요');
  assert.equal(new Set(c.map(x => x.label.toLowerCase())).size, 4);
  assert.deepEqual(run(), c);
});
// 3
test('practiceChoices(mean): 같은 뜻(공백·괄호)·토큰 겹침은 오답으로 안 나온다, 오답끼리 같은 뜻은 하나만', () => {
  const w = W('s', '走', 'zou3', '가다');
  const words = [w, W('x1', '去', 'qu4', '가다, 오다'), W('x2', 'A', 'a', ' 가다 '), W('x3', 'B', 'b', '가다(이동)'), W('x4', 'C', 'c', '걷다; 가다'),
    W('y1', 'D', 'd', '책'), W('y2', 'E', 'e', '책 '), W('y3', 'F', 'f', '차'), W('y4', 'G', 'g', '물'), W('y5', 'H', 'h', '불')];
  for (let seed = 1; seed <= 40; seed++) {
    const c = M.practiceChoices(w, words, 'mean', lcg(seed));
    assert.ok(c, 'seed ' + seed);
    const wrong = c.filter(x => !x.correct).map(x => x.label.trim());
    assert.ok(!wrong.some(l => /가다/.test(l)), `겹치는 뜻이 오답으로 나옴: ${wrong} (seed ${seed})`);
    assert.equal(new Set(wrong).size, 3, `오답 중복: ${wrong}`);
  }
  assert.ok(M.meanClash('안녕하세요', ' 안녕하세요 '));
  assert.ok(M.meanClash('안녕하세요', '안녕하세요(인사)'));
  assert.ok(M.meanClash('가다, 걷다', '가다'));
  assert.ok(!M.meanClash('가다', '오다'));
});
// 4
test('뜻 보기 폴백: 유효 오답 후보 2개뿐이면 null → kind self + why', () => {
  const w = W('s', '走', 'zou3', '가다');
  const words = [w, W('x1', '去', 'qu4', '가다, 오다'), W('y1', 'D', 'd', '책'), W('y2', 'F', 'f', '차')];
  assert.equal(M.practiceChoices(w, words, 'mean', lcg(1)), null);
  const k = M.practiceKindOf(w, 'mean', words, lcg(1));
  assert.equal(k.kind, 'self');
  assert.equal(typeof k.why, 'string'); assert.ok(k.why.length > 0);
});
// 5
test('practiceChoices: words 비변형(동결 배열·객체여도 예외 없음, 순서·내용 동일)', () => {
  const words = BIG.map(x => Object.freeze({ ...x })); Object.freeze(words);
  const before = JSON.stringify(words);
  for (const f of ['mean', 'hz']) M.practiceChoices(words[0], words, f, lcg(3));
  assert.equal(JSON.stringify(words), before);
});
// 6
test('practiceChoices(hz): 같은 글자 수 후보가 3개 이상이면 오답 모두 같은 글자 수', () => {
  const w = W('t', '你好', 'ni3 hao3', 'x');
  const words = [w, W('p1', '谢谢', 'a', '1'), W('p2', '朋友', 'a', '2'), W('p3', '再见', 'a', '3'), W('p4', '茶', 'a', '4'), W('p5', '书', 'a', '5'), W('p6', '去', 'a', '6'), W('p7', '走', 'a', '7')];
  for (let s = 1; s <= 30; s++) {
    const c = M.practiceChoices(w, words, 'hz', lcg(s));
    assert.equal(c.length, 4);
    assert.ok(c.filter(x => !x.correct).every(x => [...x.label].length === 2), JSON.stringify(c));
  }
});
test('practiceChoices(hz): 같은 글자 수 후보가 1개뿐이면 그것 + 다른 길이로 채움', () => {
  const w = W('t', '你好', 'ni3 hao3', 'x');
  const words = [w, W('p1', '谢谢', 'a', '1'), W('p4', '茶', 'a', '4'), W('p5', '书', 'a', '5'), W('p6', '去', 'a', '6')];
  for (let s = 1; s <= 20; s++) {
    const c = M.practiceChoices(w, words, 'hz', lcg(s));
    const wrong = c.filter(x => !x.correct).map(x => x.label);
    assert.ok(wrong.includes('谢谢'));
    assert.equal(wrong.length, 3);
  }
});
// 7
test('practiceKindOf: 카드 방식 분기', () => {
  const g = id => BIG.find(x => x.id === id);
  assert.equal(M.practiceKindOf(g('a'), 'py', BIG, lcg(1)).kind, 'type');
  assert.equal(M.practiceKindOf(g('a'), 'mean', BIG, lcg(1)).kind, 'choice');
  const wr = M.practiceKindOf(g('a'), 'hz', BIG, lcg(1));
  assert.equal(wr.kind, 'write'); assert.ok(wr.alt && wr.alt.length === 4);
  assert.equal(M.practiceKindOf(g('i'), 'hz', BIG, lcg(1)).kind, 'choice');       // noWrite
  assert.equal(M.practiceKindOf(g('j'), 'hz', BIG, lcg(1)).kind, 'choice');       // 6자 성어
  const noHz = W('z', 'abc', 'a', '없음');
  assert.ok(['choice', 'self'].includes(M.practiceKindOf(noHz, 'hz', BIG.concat([noHz]), lcg(1)).kind)); // 한자 0자는 write 아님
  assert.notEqual(M.practiceKindOf(noHz, 'hz', BIG.concat([noHz]), lcg(1)).kind, 'write');
  const lone = W('n', '书', 'shu1', '책', { noWrite: true });
  assert.equal(M.practiceKindOf(lone, 'hz', [lone, BIG[0]], lcg(1)).kind, 'self');
});
// 8
test('practiceNewRound: 중복 id 제거, retry:false 큐', () => {
  const r = M.practiceNewRound(['a', 'b', 'a', 'c'], 'py', lcg(1));
  assert.equal(r.queue.length, 3);
  assert.deepEqual(new Set(r.queue.map(q => q.id)), new Set(['a', 'b', 'c']));
  assert.ok(r.queue.every(q => q.retry === false));
  assert.deepEqual(r.ids, ['a', 'b', 'c']);
});
// 9
test('practiceRecord: 첫 오답만 큐 끝에 retry 1회, 재출제 오답은 더 안 들어감, 정답은 재출제 없음', () => {
  const st = M.practiceNewRound(['a', 'b'], 'py', lcg(1));
  st.queue.length = 0;
  M.practiceRecord(st, 'a', false, false);
  assert.deepEqual(st.queue, [{ id: 'a', retry: true }]);
  M.practiceRecord(st, 'a', true, false);
  assert.equal(st.queue.length, 1, '재출제 오답이 다시 큐에 들어감');
  M.practiceRecord(st, 'b', false, true);
  assert.equal(st.queue.length, 1);
  assert.equal(st.ok, 1); assert.deepEqual(st.wrong, ['a']); assert.equal(st.retryRes.a, 'fail');
  const s = M.practiceSummary(st);
  assert.equal(s.total, 2); assert.equal(s.ok, 1); assert.equal(s.rate, 50); assert.equal(s.retryOk, 0);
  const st2 = M.practiceNewRound(['a', 'b', 'c'], 'py', lcg(1)); st2.queue.length = 0;
  M.practiceRecord(st2, 'a', false, true); M.practiceRecord(st2, 'b', false, true); M.practiceRecord(st2, 'c', false, false);
  M.practiceRecord(st2, 'c', true, true);
  const s2 = M.practiceSummary(st2);
  assert.equal(s2.rate, 67); assert.equal(s2.retryOk, 1);
  assert.deepEqual(M.practiceSummary({ firstTry: {}, retryRes: {}, wrong: [], ok: 0 }), { total: 0, ok: 0, rate: 0, wrong: [], retryOk: 0 });
});
// 10
test('전체 루프 3종: 모든 객체 동결 상태에서 예외 없이 끝나고 S 불변(SRS·log·settings)', () => {
  for (const target of ['py', 'mean', 'hz']) {
    for (const pattern of ['allpass', 'allfail', 'alt']) {
      const S = { words: BIG.map(x => Object.freeze({ ...x })), log: Object.freeze({ '2026-10-03': Object.freeze({ n: 2 }) }), settings: Object.freeze({ practiceFields: Object.freeze({ py: false }) }) };
      Object.freeze(S.words);
      M.setS(S);
      const before = JSON.stringify(S);
      assert.equal(M.practiceStart(S.words.map(w => w.id), target, lcg(5)), true);
      let n = 0, guard = 0;
      while (M.getPractice().active && guard++ < 100) {
        const res = pattern === 'allpass' ? 'pass' : pattern === 'allfail' ? 'fail' : (n++ % 2 ? 'pass' : 'fail');
        M.practiceFinishCard(res);
      }
      const p = M.getPractice();
      assert.equal(p.finished, true, `${target}/${pattern} 종료 안 함`);
      const s = M.practiceSummary(p);
      assert.equal(s.total, BIG.length);
      if (pattern === 'allfail') assert.equal(s.ok, 0);
      assert.equal(JSON.stringify(S), before, `${target}/${pattern}: S가 변함`);
    }
  }
  M.practiceReset();
});
// 11
test('라운드 중 단어 삭제: 다음 카드가 건너뛰고 예외 없음, total은 실제 푼 수', () => {
  const S = { words: BIG.slice(0, 5).map(x => ({ ...x })), log: {}, settings: {} };
  M.setS(S);
  M.practiceStart(S.words.map(w => w.id), 'py', lcg(2));
  const p0 = M.getPractice();
  const firstId = p0.cur.id, nextId = p0.queue[0].id;
  M.setS({ words: S.words.filter(w => w.id !== nextId), log: {}, settings: {} });
  M.practiceFinishCard('pass');
  const p = M.getPractice();
  assert.notEqual(p.cur && p.cur.id, nextId);
  let guard = 0; while (M.getPractice().active && guard++ < 50) M.practiceFinishCard('pass');
  assert.equal(M.practiceSummary(M.getPractice()).total, 4);
  assert.ok(firstId);
  M.practiceReset();
});
// 12
test('practiceStart: 존재하지 않는 id만 / target null → false, 상태 불변', () => {
  M.setS({ words: BIG.map(x => ({ ...x })), log: {}, settings: {} });
  M.practiceReset();
  const before = JSON.stringify(M.getPractice());
  assert.equal(M.practiceStart(['nope'], 'py'), false);
  assert.equal(M.practiceStart(['a'], null), false);
  assert.equal(JSON.stringify(M.getPractice()), before);
});

// 13 정적 격리
const stripped = (practiceSrc + '\n' + practiceUiSrc).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
test('정적 격리: 복습·SRS·저장·동기화 함수/필드 쓰기가 연습 섹션에 없다', () => {
  const bad = [
    /\b(applyGrade|logToday|finishCard|nextCard|startSession|checkAnswer|checkWrite|focusAdd|syncPush|doSave|doSaveSync|updateFocusBar)\s*\(/,
    /\bsession\b/, /\bS\.log\b/,
    /\.(stage|due|reps|lapses|last|focus|noWrite)\s*(=(?!=)|\+\+|--|\+=|-=)/,
    /\bdelete\s+[\w.$\[\]'"]+\.(focus|noWrite)\b/,
    /\bS\.words\.(sort|push|splice|reverse)\s*\(/, /\bpad\.on\s*=/,
  ];
  for (const re of bad) assert.ok(!re.test(stripped), `금지 패턴 발견: ${re} → ${(stripped.match(re) || [])[0]}`);
});
test('정적 격리: save( 호출은 정확히 1곳(practiceSetField 본문)', () => {
  const all = stripped.match(/\bsave\s*\(/g) || [];
  assert.equal(all.length, 1);
  const body = fnSrc('practiceSetField', '\n' + stripped);
  assert.ok(/\bsave\s*\(/.test(body), 'practiceSetField 안이 아님');
});

// 14 gradePinyin — 복습 세션 비의존 + 기존 checkAnswer와 동일 판정
const dictJson = html.match(/<script id="py-dict" type="application\/json">([\s\S]*?)<\/script>/)[1];
const docStub = { getElementById: id => id === 'py-dict' ? { textContent: dictJson } : null };
const pySecNew = section('// ---------- pinyin ----------', '// ---------- storage ----------');
const rcSecNew = section('// ---------- reading check ----------', '// ---------- words ----------');
const GP = new Function('document', [escLine, pySecNew, rcSecNew, 'return { gradePinyin, marks };'].join('\n'))(docStub);
test('gradePinyin: 복습 세션·render·$ 없이 호출 가능, 기본 판정', () => {
  const nh = { id: 1, hz: '你好', py: 'ni3 hao3' };
  const r = GP.gradePinyin(nh, 'ni2 hao3');
  assert.equal(r.result, 'pass'); assert.ok(r.sandhiNote.length > 0);
  assert.equal(GP.gradePinyin(nh, 'nǐ hǎo').result, 'pass');   // 부호 입력(띄어쓰기 있음)
  assert.equal(GP.gradePinyin(nh, 'ni3 hao3').result, 'pass');
  assert.equal(GP.gradePinyin({ hz: '一月', py: 'yi1 yue4' }, 'yi2 yue4').result, 'fail');
  assert.equal(GP.gradePinyin({ hz: '苹果', py: 'ping2 guo3' }, 'ping2 guo2').result, 'fail');
  const bad = GP.gradePinyin({ hz: '苹果', py: 'ping2 guo3' }, 'ping2 guo2');
  assert.equal(bad.typed, GP.marks('ping2 guo2'));
  assert.equal(bad.gaveUp, false);
});

// 14b 동등성: 변경 전(git HEAD) checkAnswer 와 gradePinyin 의 출력이 같은 입력에서 동일해야 한다.
let headHtml = null;
try { headHtml = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 28 }).toString('utf8'); } catch (e) {}
if (!headHtml || !headHtml.includes('function checkAnswer(){')) {
  skipped++; console.log('SKIP - gradePinyin 동등성: git HEAD의 index.html을 읽을 수 없어 건너뜀(전제 미충족)');
} else if (/function gradePinyin\(/.test(headHtml)) {
  skipped++; console.log('SKIP - gradePinyin 동등성: HEAD에 이미 gradePinyin이 있어 "변경 전" 기준이 아님(전제 미충족)');
} else {
  const s0 = headHtml.indexOf('function checkAnswer(){'), e0 = headHtml.indexOf('\nfunction renderAdd(', s0);
  const oldSrc = [
    escLine, "const $ = (s, r) => (r||document).querySelector(s);",
    sectionOf(headHtml, '// ---------- pinyin ----------', '// ---------- storage ----------'),
    'let session = { cur:null, pending:null };', 'function render(){}',
    sectionOf(headHtml, '// ---------- reading check ----------', '// ---------- words ----------'),
    headHtml.slice(s0, e0), 'return { checkAnswer, session };'
  ].join('\n');
  const box = { value: '' };
  const OLD = new Function('document', oldSrc)({ getElementById: docStub.getElementById, querySelector: s => s === '#ans' ? box : null });
  const words = [['你好', 'ni3 hao3'], ['不是', 'bu4 shi4'], ['一月', 'yi1 yue4'], ['一起', 'yi4 qi3'], ['苹果', 'ping2 guo3'], ['很好吃', 'hen3 hao3 chi1'], ['洗手间', 'xi3 shou3 jian1'], ['一', 'yi1'], ['谢谢', 'xie4 xie5'], ['朋友', 'peng2 you5'], ['不对', 'bu4 dui4']];
  const typedList = ['ni3 hao3', 'ni2 hao3', 'nǐhǎo', 'ni hao', 'nihao', 'ni3hao3', 'NI3 HAO3', 'ni2hao3', 'bu2 shi4', 'bu4 shi4', 'bushi', 'bú shì', 'yi2 yue4', 'yi1 yue4', 'yi4 qi3', 'yi2 qi3', 'ping2 guo3', 'ping2 guo2', 'pingguo', 'hen2 hao3 chi1', 'hen3 hao3 chi1', 'xi2 shou3 jian1', 'xi3 shou3 jian2', 'yi1', 'yi4', 'xie4 xie', 'xie4 xie5', 'peng2 you', 'pengyou', 'bu2 dui4', 'bu4 dui4', 'zzz', '12', 'ni3  hao3', 'ni3 hao'];
  let n = 0, passes = 0, notes = 0;
  test('gradePinyin: 변경 전 checkAnswer(git HEAD)와 모든 입력에서 판정·typed·sandhiNote·gaveUp 동일', () => {
    for (const [hz, py] of words) for (const t of typedList) {
      const w = { id: 'x', hz, py }; box.value = t; OLD.session.cur = w; OLD.session.pending = null; OLD.checkAnswer();
      const o = OLD.session.pending, g = GP.gradePinyin(w, t.trim());
      assert.deepEqual(g, o, `${hz} ${py} 입력 "${t}"`);
      n++; if (o.result === 'pass') passes++; if (o.sandhiNote) notes++;
    }
    // 전제 확인: 비교가 의미 있으려면 정답·오답·변조 안내가 모두 실제로 나와야 한다.
    assert.ok(passes > 5 && passes < n - 20 && notes > 0, `비교 분포 이상: n=${n} pass=${passes} notes=${notes}`);
  });
}

// 15 writeVerdict
test('writeVerdict: 일치 → pass/typed 빈 문자열, 불일치 → fail/typed 입력', () => {
  const wv = new Function(fnSrc('writeVerdict') + '\nreturn writeVerdict;')();
  assert.deepEqual(wv('你好', ['你', '好']), { result: 'pass', typed: '', gaveUp: false });
  assert.deepEqual(wv('你', ['你', '好']), { result: 'fail', typed: '你', gaveUp: false });
  assert.deepEqual(wv('', ['你']), { result: 'fail', typed: '', gaveUp: false });
});

// 16 이스케이프
test('이스케이프: data-psel 속성 탈출 불가, 보기 라벨 HTML 이스케이프', () => {
  const sel = new Set();
  const src = [escLine, fnSrc('practiceCheckHtml'), fnSrc('practiceRowClass'), fnSrc('practiceChoicesHtml'),
    'return { practiceCheckHtml, practiceRowClass, practiceChoicesHtml };'].join('\n');
  const X = new Function('practiceSel', 'practice', src)(sel, { choices: [{ label: '<img src=x onerror=alert(1)>', correct: true }, { label: 'b', correct: false }] });
  const evil = 'EVIL" autofocus onfocus="alert(1)';
  sel.add(evil);
  const out = X.practiceCheckHtml({ id: evil, hz: '你"好' });
  assert.ok(!out.includes('onfocus="'), out);
  assert.ok(out.includes('data-psel="EVIL&quot; autofocus onfocus=&quot;alert(1)"'));
  assert.ok(X.practiceRowClass({ id: evil }).includes('psel'));
  const ch = X.practiceChoicesHtml('mean', null);
  assert.ok(ch.includes('&lt;img') && !ch.includes('<img'), ch);
});
test('wordItemHtml: pick 모드는 data-psel(집중 data-focus 없음), 기본 모드는 반대', () => {
  const sel = new Set(['w1']);
  const mk = state => new Function('listState', 'confirmDelete', 'INTERVALS', 'ttsOK', 'marks', 'relTime', 'sandhiHintHtml', 'strokeCharsOf', 'issuesHtml', 'practiceSel', 'isCJK', 'Date',
    [escLine, fnSrc('stageText'), fnSrc('stagebar'), fnSrc('practiceCheckHtml'), fnSrc('practiceRowClass'), fnSrc('wordItemHtml'), 'return wordItemHtml;'].join('\n'))(
    state, null, [0, 1, 3], false, x => x, () => '', () => '', () => [], () => '', sel, ch => /[一-鿿]/.test(ch), Date);
  const w = { id: 'w1', hz: '你好', py: 'ni3 hao3', mean: '안녕', ex: '', stage: 0, due: 0, added: 0, focus: true };
  const a = mk({ pick: true, open: null, edit: null })(w, () => []);
  const b = mk({ open: null, edit: null })(w, () => []);
  assert.ok(a.includes('data-psel="w1"') && !a.includes('data-focus'), a.slice(0, 400));
  assert.ok(b.includes('data-focus') && !b.includes('data-psel'), b.slice(0, 400));
});

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped(전제 미충족)` : ''}`);
if (fail > 0) process.exit(1);
