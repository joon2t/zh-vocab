// 2026-09-13 통합 리뷰 수정 4건의 재현 케이스 고정:
//   1. wordItemHtml — 단어 id가 HTML 속성에 이스케이프 없이 들어가던 문제(속성 탈출)
//   2. importIo — 붙여넣은 JSON의 id를 그대로 받아 1의 진입 경로가 되던 문제
//   3. listenAdvance — 반복 꺼짐으로 끝까지 들으면 idx가 큐 길이와 같게 남아 "4 / 3"·빈 카드가 되던 문제
//   4. load — 원격에 단어가 있으면 로컬 상태를 통째로 교체해 로컬 고유 단어·기록을 잃던 문제
// index.html은 단일 파일 원칙을 지키므로 필요한 함수만 이름으로 잘라 와(다음 최상위 선언 직전까지) Function 파라미터로
// 의존성을 주입해 실행한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function fnSrc(name){
  // 함수 본문 안의 문자열에 홑 중괄호가 있을 수 있어 중괄호 짝 맞춤 대신 "다음 최상위 선언"까지를 잘라 온다.
  const m = new RegExp(`\\n(async )?function ${name}\\(`).exec(html);
  assert.ok(m, `index.html에서 function ${name}을 찾지 못했습니다.`);
  const head = m.index + 1;
  const tail = /\n(?:async function |function |const |let |\/\/ ----------)/g;
  tail.lastIndex = head + m[0].length;
  const e = tail.exec(html);
  return html.slice(head, e ? e.index : html.length);
}
const escLine = html.slice(html.indexOf('const esc = '), html.indexOf('\n', html.indexOf('const esc = ')));

// ---------- 1. wordItemHtml 속성 이스케이프 ----------
test('wordItemHtml: id에 따옴표가 있어도 data-* 속성을 탈출하지 못한다', () => {
  const src = [escLine, fnSrc('stageText'), fnSrc('stagebar'), fnSrc('wordItemHtml'), 'return wordItemHtml;'].join('\n');
  const wordItemHtml = new Function('listState', 'confirmDelete', 'INTERVALS', 'ttsOK', 'marks', 'relTime', 'sandhiHintHtml', 'strokeCharsOf', 'issuesHtml', 'Date', src)(
    { open: null, edit: null }, null, [0, 1, 3], false, x => x, () => '', () => '', () => [], () => '', Date);
  const evil = 'EVIL" autofocus onfocus="alert(1)';
  const out = wordItemHtml({ id: evil, hz: '你好', py: 'ni3 hao3', mean: '안녕', ex: '', stage: 0, due: 0, added: 0 }, () => []);
  assert.ok(!out.includes('onfocus="'), '속성이 탈출됐습니다: ' + out.slice(0, 200));
  assert.ok(out.includes('data-open="EVIL&quot; autofocus onfocus=&quot;alert(1)"'), '이스케이프된 id가 속성값 안에 그대로 남아야 합니다');
});

// ---------- 2. importIo는 붙여넣은 id를 받지 않는다 ----------
test('importIo(JSON): 붙여넣은 단어의 id는 버리고 새 id를 만든다', () => {
  const S = { words: [], log: {} };
  const io = { value: JSON.stringify({ words: [{ id: 'EVIL"', hz: '你好', py: 'ni3 hao3', mean: '안녕' }] }) };
  const src = [fnSrc('importIo'), 'return importIo;'].join('\n');
  const importIo = new Function('S', '$', 'findByHz', 'uid', 'save', 'toast', 'setStatus', 'addWord', 'pinyinLooksValid', 'checkWord', src)(
    S, () => io, hz => S.words.find(w => w.hz === hz), () => 'fresh-id', () => {}, () => {}, () => {}, () => {}, () => true, () => []);
  importIo();
  assert.equal(S.words.length, 1);
  assert.equal(S.words[0].id, 'fresh-id');
  assert.equal(S.words[0].hz, '你好');
});

// ---------- 3. listenAdvance 끝 처리 ----------
test('listenAdvance: 반복 꺼짐으로 마지막 단어를 지나면 idx가 0으로 돌아가고 정지한다(큐 길이와 같게 남지 않는다)', () => {
  const calls = { pause: 0, speak: 0, render: 0, toast: [] };
  const listen = { idx: 2, queue: ['a', 'b', 'c'], playing: true };
  const src = [fnSrc('listenAdvance'), 'return listenAdvance;'].join('\n');
  const listenAdvance = new Function('listen', 'listenPrefs', 'listenPause', 'render', 'listenSpeakCurrent', 'toast', src)(
    listen, () => ({ repeat: false }), () => { calls.pause++; listen.playing = false; }, () => calls.render++, () => calls.speak++, m => calls.toast.push(m));
  listenAdvance();
  assert.equal(listen.idx, 0, 'idx가 큐 길이(3)로 남으면 "4 / 3" 표시·빈 카드가 된다');
  assert.equal(calls.pause, 1);
  assert.equal(calls.speak, 0, '정지했으므로 다음 발화를 시작하면 안 된다');
  assert.ok(calls.toast.length === 1);
});

test('listenAdvance: 반복 켜짐이면 처음으로 돌아가 계속 재생한다(회귀)', () => {
  const calls = { pause: 0, speak: 0 };
  const listen = { idx: 2, queue: ['a', 'b', 'c'], playing: true };
  const src = [fnSrc('listenAdvance'), 'return listenAdvance;'].join('\n');
  const listenAdvance = new Function('listen', 'listenPrefs', 'listenPause', 'render', 'listenSpeakCurrent', 'toast', src)(
    listen, () => ({ repeat: true }), () => calls.pause++, () => {}, () => calls.speak++, () => {});
  listenAdvance();
  assert.equal(listen.idx, 0);
  assert.equal(calls.pause, 0);
  assert.equal(calls.speak, 1);
});

// ---------- 4. load는 원격과 로컬을 합친다 ----------
async function runLoad({ local, remote }){
  const calls = { push: 0 };
  const ctx = { S: null, storageOK: false, sync: { url: 'https://x.firebaseio.com/vocab/k.json', status: '', lastError: '' }, storageInfo: {}, inIframe: true };
  const src = [
    fnSrc('mergeStates'), fnSrc('readStore'), fnSrc('load'),
    // load()는 모듈 스코프의 S/storageOK/sync에 대입하므로 실행 후 값을 돌려받는다
    'return async () => { await load(); return { S, storageOK, sync }; };'
  ].join('\n');
  const window = { storage: { get: async (k, shared) => (shared ? null : (local ? { value: JSON.stringify(local) } : null)) } };
  const run = new Function('window', 'S', 'storageOK', 'sync', 'storageInfo', 'inIframe', 'KEY', 'currentSyncUrl', 'waitForStorage', 'fresh', 'syncFetch', 'syncPush', 'Date', src)(
    window, ctx.S, ctx.storageOK, ctx.sync, ctx.storageInfo, ctx.inIframe, 'k', () => ctx.sync.url, async () => true,
    () => ({ version: 1, words: [], log: {}, settings: { mode: 'mix', autoAudio: true, weekWeights: {} } }),
    async () => remote, async () => { calls.push++; }, Date);
  const out = await run();
  return { ...out, calls };
}
const w = (hz, extra = {}) => ({ id: hz, hz, py: 'x', mean: hz, added: 1, stage: 0, due: 0, reps: 0, ...extra });

test('load: 원격에 단어가 있어도 로컬 고유 단어·오늘 기록·주차 설정을 잃지 않고 합친 뒤 올린다', async () => {
  const local = { version: 1, words: [w('你好'), w('谢谢'), w('不是')], log: { '2026-09-13': { n: 3, ok: 2 } }, settings: { mode: 'mix', autoAudio: true, weekWeights: { '2026-W37': 'high' } }, updated: 200 };
  const remote = { version: 1, words: [w('你好', { reps: 5 })], log: {}, settings: { mode: 'mix', autoAudio: true, weekWeights: {} }, updated: 100 };
  const { S, calls } = await runLoad({ local, remote });
  assert.deepEqual(S.words.map(x => x.hz).sort(), ['不是', '你好', '谢谢']);
  assert.equal(S.words.find(x => x.hz === '你好').reps, 5, '같은 단어는 복습 횟수가 많은 쪽(원격)을 택한다');
  assert.equal(S.log['2026-09-13'].n, 3, '오늘 기록이 남아야 한다');
  assert.equal(S.settings.weekWeights['2026-W37'], 'high', 'updated가 최신인 로컬 설정이 남아야 한다');
  assert.equal(calls.push, 1, '합친 결과를 원격에 올려 두 쪽을 맞춰야 한다');
});

test('load: 로컬이 비어 있으면 원격을 그대로 쓰고 올리지 않는다(회귀)', async () => {
  const remote = { version: 1, words: [w('你好')], log: {}, settings: { mode: 'mix', autoAudio: true, weekWeights: {} }, updated: 100 };
  const { S, calls } = await runLoad({ local: null, remote });
  assert.equal(S.words.length, 1);
  assert.equal(calls.push, 0);
});

test('load: 원격이 비어 있으면 로컬을 올린다(회귀)', async () => {
  const local = { version: 1, words: [w('你好')], log: {}, settings: { mode: 'mix', autoAudio: true, weekWeights: {} }, updated: 200 };
  const { S, calls } = await runLoad({ local, remote: { version: 1, words: [], log: {}, settings: {} } });
  assert.equal(S.words.length, 1);
  assert.equal(calls.push, 1);
});
