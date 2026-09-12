# 획순 연습 데이터 — 재임베드 절차

> 목적: `index.html`에 임베드된 획순 애니메이션 라이브러리(Hanzi Writer)와 획순 데이터(`#stroke-data`,
> 상위 1000자)를 새 글자로 확장하거나 버전을 올릴 때 어떻게 다시 만들고 끼워 넣는지 기록한다.
> 이 앱은 단일 파일 원칙(`index.html` 하나)을 지키므로, 라이브러리·데이터 모두 **다운로드해서 인라인
> 임베드**한다(외부 CDN 참조 금지). 아래 절차는 그 임베드 블록을 재생성하는 방법이다.

## 1. 무엇이 어디에 임베드돼 있나

- **Hanzi Writer 라이브러리** (MIT, David Chanin): `<!-- 획순 애니메이션: Hanzi Writer v3.7.3 ... -->` 주석
  바로 다음 `<script>...</script>` 블록. minified JS를 통째로 넣었다. 전역 `HanziWriter`를 노출한다.
  - 원본: https://github.com/chanind/hanzi-writer
  - 배포 파일(jsdelivr, npm 미러): `https://cdn.jsdelivr.net/npm/hanzi-writer@<버전>/dist/hanzi-writer.min.js`
- **획순 데이터** (Arphic Public License, Make Me a Hanzi → hanzi-writer-data 경유): `<script id="stroke-data"
  type="application/json">{ "字": { strokes, medians, radStrokes }, ... }</script>`. 글자별 JSON을 하나로
  합친 것. 원본은 글자 하나당 파일 하나:
  `https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/data/<글자>.json`
- **글자 선정에 쓴 빈도표** (앱에는 포함되지 않음, 선정 작업에만 사용): `hanziDB.csv`
  (Rudd Fawcett, MIT — Jun Da 현대 중국어 한자 빈도 목록 기반)
  https://github.com/ruddfawcett/hanziDB.csv (`hanzi_db.csv`, 열: `frequency_rank,character,...,hsk_level,...`)

앱 쪽 사용 코드는 `index.html`의 `// ---------- stroke writer (획순 연습) ----------` 섹션
(`ensureStrokeData`, `strokeCharsOf`, `hasStrokeData`, `openStrokeModal` 등)에 있다. `ensureStrokeData()`가
`#stroke-data`의 텍스트를 **획순 기능을 처음 열 때만** `JSON.parse`한다 — 데이터가 2MB대라 앱 시작 때마다
파싱하지 않기 위한 지연 파싱이다. 새 글자를 추가해도 이 구조는 그대로 유지하면 된다.

## 2. 현재 상태 (기준: 2026-09-12 최초 구현)

- 글자 수: **1000자** (빈도 순위 1~1000위, 전부 획순 데이터 확보 — 커버리지 100%)
- HSK 레벨 분포(참고용, `hanzi_db.csv`의 `hsk_level` 열 기준): HSK1 159 · HSK2 136 · HSK3 195 · HSK4 257
  (1~4 합계 747, ~75%) · HSK5 192 · HSK6 52 · 미등재 9. 순수 빈도 기반 선정이라 HSK5/6·미등재 글자도 일부
  섞여 있다 — "HSK1~4를 대체로 커버하되 정확히 일치하지는 않음"이 의도한 동작이다.
- 파일 용량(2026-09-12 기준, `index.html` 전체): raw 약 3.36MB, **gzip 전송 시 약 1.52MB**(정적 호스팅은
  보통 gzip/br을 자동 적용하므로 실제 사용자가 받는 크기는 이쪽에 가깝다). `#stroke-data` JSON 자체만
  gzip하면 약 0.89MB — 대부분(라이브러리 포함 전체 스크립트)이 반복되는 키/구조 덕에 압축률이 높다.

## 3. 재생성 절차 (글자 수를 늘리거나 라이브러리 버전을 올릴 때)

Node 18+ 환경(내장 `fetch` 필요)에서 아래 순서로 진행한다. 네트워크 접근이 되는 환경이어야 한다.

### 3.1 빈도표에서 대상 글자 목록 뽑기

```bash
curl -sL "https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/hanzi_db.csv" -o hanzi_db.csv
```

```js
// pick-chars.mjs — 상위 N자를 뽑아 chars.json으로 저장
import fs from 'node:fs';
const N = 1000; // 늘리고 싶으면 이 값만 바꾼다
const csv = fs.readFileSync('hanzi_db.csv', 'utf8');
function parseCSV(text){ // definition, pinyin 등 필드에 콤마가 섞여 있어 단순 split은 위험 — 따옴표 인식 파서 사용
  const rows=[]; let row=[]; let field=''; let inQuotes=false;
  for (let i=0;i<text.length;i++){ const c=text[i];
    if (inQuotes){ if (c==='"'){ if (text[i+1]==='"'){field+='"';i++;} else inQuotes=false; } else field+=c; }
    else if (c==='"') inQuotes=true;
    else if (c===',') { row.push(field); field=''; }
    else if (c==='\n') { row.push(field); rows.push(row); row=[]; field=''; }
    else if (c!=='\r') field+=c;
  }
  if (field.length||row.length) { row.push(field); rows.push(row); }
  return rows;
}
const rows = parseCSV(csv);
const chars = rows.slice(1).filter(r=>r.length>1).slice(0, N).map(r=>r[1]);
fs.writeFileSync('chars.json', JSON.stringify(chars));
console.log('선정 글자 수:', chars.length);
```

### 3.2 hanzi-writer-data에서 글자별 획순 데이터 받기

```js
// fetch-stroke-data.mjs — chars.json의 글자마다 획순 JSON을 받아 하나로 합친다
import fs from 'node:fs';
const chars = JSON.parse(fs.readFileSync('chars.json', 'utf8'));
const BASE = 'https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/data/';
const CONCURRENCY = 12;
const result = {};
const missing = [];
let idx = 0;
async function worker(){
  while (idx < chars.length) {
    const ch = chars[idx++];
    try {
      const res = await fetch(BASE + encodeURIComponent(ch) + '.json', { signal: AbortSignal.timeout(15000) });
      if (res.status === 200) result[ch] = await res.json();
      else missing.push(ch);
    } catch (e) { missing.push(ch); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log('받음:', Object.keys(result).length, '/', chars.length, '누락:', missing);
fs.writeFileSync('stroke_data.json', JSON.stringify(result)); // 공백 없이 — 파일 크기 절약
```

실행: `node fetch-stroke-data.mjs`. 콘솔에 누락 글자가 나오면(오탈자·희귀자 등) `missing` 배열을 확인하고
필요하면 개별 재시도하거나 목록에서 제외한다.

### 3.3 index.html에 다시 끼워 넣기

`stroke_data.json`(글자당 2~3KB 정도, 1000자 기준 약 2.2MB)을 index.html의 기존
`<script id="stroke-data" type="application/json">...</script>` 블록 **내용만** 통째로 교체한다. 파일이
너무 커서 텍스트 에디터로 손으로 붙여넣기보다는 스크립트로 치환하는 걸 권장한다:

```js
// splice.mjs — index.html의 #stroke-data 블록 내용을 새 데이터로 교체
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const newData = fs.readFileSync('stroke_data.json', 'utf8');
const re = /(<script id="stroke-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error('#stroke-data 블록을 찾지 못했습니다');
fs.writeFileSync('index.html', html.replace(re, `$1${newData}$2`));
console.log('교체 완료. 새 index.html 크기:', fs.statSync('index.html').size, 'bytes');
```

Hanzi Writer 라이브러리 자체를 올릴 때도 같은 방식(정규식으로 라이브러리 `<script>` 블록만 찾아 교체)을
쓴다. 버전은 https://www.jsdelivr.com/package/npm/hanzi-writer 에서 확인.

### 3.4 검증

- `node -e "JSON.parse(require('fs').readFileSync('index.html','utf8').match(/<script id=\"stroke-data\"[^>]*>([\s\S]*?)<\/script>/)[1])"` — JSON 파싱 확인
- `node --check`로 라이브러리·본문 `<script>` 블록 문법 검사 (BUILD_LOG의 기존 검증 방식과 동일)
- `node tests/stroke-chars.test.mjs` — `strokeCharsOf`/`hasStrokeData` 순수 로직 회귀 확인
- 브라우저(또는 `run` 스킬)로 실제로 열어 단어 상세의 "획순" 버튼과 손글씨 카드의 "획순 보기" 버튼이
  뜨는지, 새로 추가한 글자가 "준비 중" 문구 없이 애니메이션이 뜨는지 확인

## 4. 커버리지가 낮아졌다면

`hasStrokeData(ch, strokeData)`가 `false`를 반환하는 글자는 모달에 "이 글자의 획순 데이터는 아직 준비
중이에요"로 조용히 실패하지 않고 안내된다. 특정 글자가 계속 빠진다면 hanzi-writer-data 저장소에 그 글자
파일이 없는 것 — Make Me a Hanzi 원본 폰트에 없는 극히 드문 글자이거나 이체자일 수 있다. 이런 경우
`§3.2`의 `missing` 배열에 남으므로, 필요하면 수동으로 다른 소스(예: Make Me a Hanzi 원본 저장소)에서
같은 포맷(`{ strokes, medians, radStrokes }`)의 데이터를 찾아 `stroke_data.json`에 직접 추가한 뒤 `§3.3`을
반복한다.
