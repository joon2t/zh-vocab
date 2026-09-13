# BUILD LOG

zh-vocab(단일 파일 앱 `index.html`)의 변경 이력을 기록한다. 여러 작업기(에이전트)가 순차적으로 작업하므로,
각 항목에 날짜·변경 요지·검증 결과를 남겨 다음 작업기가 맥락을 빠르게 파악할 수 있게 한다.

형식:
```
## YYYY-MM-DD 변경 제목
- 요지: 무엇을 왜 바꿨는지
- 변경 지점: index.html 줄번호/함수명
- 검증: 실행한 테스트와 결과
- 타협/미해결: 있으면 기록
```

---

## 2026-09-13 통합 리뷰 수정: 동기화 로드 병합·id 이스케이프·듣기 2건·수정 중 렌더 가드 + 손글씨 획순 안내

- 요지: 커밋 e33f384 상태를 독립 리뷰(앱 스크립트 전체 정독)와 헤드리스 크롬 실동작 점검(Playwright, 49항목)으로
  재점검했다. 실동작 점검·단위 테스트는 전부 통과했고, 리뷰에서 나온 🔴2·🟡4건 중 5건을 고쳤다. 사용자 요청으로
  손글씨 복습 카드에 "획순에 따라 인식된다"는 안내 문구를 추가했다.
- 🔴1 (동기화 로드가 로컬 상태를 통째로 교체, `load`) — 원격에 단어가 있으면 `S = remote`로 교체해 로컬에만 있던
  단어·오늘 기록·주차 설정을 잃었다(푸시 실패·오프라인 뒤 재실행 등). 설정 화면의 "연결"(`connectSync`)은 이미
  `mergeStates`로 합치고 있어 같은 규칙으로 맞췄다: 로컬에 단어가 있으면 `mergeStates(S, remote)` 후 결과가 원격과
  다르면 `syncPush`. `applyRemote`(실시간 수신)는 손대지 않았다 — 거기서까지 합치면 다른 기기의 삭제가 이 기기의
  로컬 사본 때문에 되살아나므로, 실시간 경로는 "서버가 진실"을 유지한다.
- 🔴2 (단어 id가 속성에 이스케이프 없이 보간, `wordItemHtml` 5곳 + `importIo`) — `esc(w.id)`로 감쌌고, JSON
  가져오기는 붙여넣은 `id`를 버리고 항상 `uid()`로 새로 만든다(`Object.assign({...}, w, { id: uid() })`). 단어
  매칭은 hz 기준이라 id 재생성은 동작에 영향이 없다.
- 🟡4 (듣기: 반복·항목 구성 칩이 재생 위치를 1번으로 되돌림) — `[data-lnset]` 핸들러에서 `listenReset()`은
  `order` 변경일 때만 부른다. `repeat`·`itemMode`는 큐 구성과 무관.
- 🟡5 (듣기: 반복 꺼짐으로 끝나면 "4 / 3" 표시 + 빈 카드) — `listenAdvance`가 큐 끝에 도달하면 반복 여부와 무관하게
  `idx = 0`으로 되돌린 뒤, 반복 꺼짐이면 정지하고 "끝까지 들었어요" 토스트를 띄운다. 다시 재생하면 처음부터(기존과
  같은 복구 동작).
- 🟡6 (원격 수신 렌더가 단어장 수정 중 입력을 버림, `applyRemote`) — 기존 `typing` 가드를 review 탭뿐 아니라
  list 탭에도 적용했다.
- 손글씨 획순 안내(`renderReview` write 분기) — 인식기(HanziLookupJS)에 합성 획을 넣어 실험한 결과, 획순·획 방향이
  표준과 다르면 후보에서 밀린다(十 세로→가로: 후보 없음, 가로를 오른쪽→왼쪽: 18위 / 口 역순: 15위 / 三은 획이 다
  비슷해 순서 무관). 획 수가 하나 늘어나는 정도는 관대하다. 카드 하단에 "획순·획 방향까지 맞춰서 써야 후보에 잘
  잡혀요" 문구를 두었다.
- 변경 지점: `load`(원격 병합), `wordItemHtml`(esc 5곳), `importIo`(id 재생성), `renderListen`의 `[data-lnset]`
  핸들러, `listenAdvance`, `applyRemote`(렌더 가드), `renderReview` write 분기(안내 문구), `APP_VERSION`.
- 검증:
  - `node --test tests/*.test.mjs` 8파일 전부 통과. 신규 `tests/review-fixes-0913.test.mjs`(7건)가 🔴1·🔴2·🟡5를
    고정한다 — 함수를 이름으로 잘라 와 의존성을 주입하는 방식(문자열 속 홑 중괄호 때문에 중괄호 짝 맞춤 대신
    "다음 최상위 선언 직전까지" 잘라 온다).
  - Playwright + 시스템 Chrome 헤드리스 스모크(저장소 스크립트, 저장소에 미포함) 49/49 통과: 추가·중복·사전 대조·
    일괄 추가·새로고침 복원·단어장 검색/편집/삭제·획순 모달·recog/read/write 카드·override·듣기·JSON/TSV 백업
    복원·전체 삭제·400px 가로 스크롤·런타임 에러 없음.
- 타협/미해결:
  - 🟡3 (URL 해시 `#sync=`의 동기화 주소를 확인 없이 수락) — 손대지 않았다. 홈 화면 추가·북마크로 주소를 들고 다니는
    현재 UX의 핵심이라, "처음 보는 주소면 확인" 같은 절차를 넣으려면 설계 결정이 필요하다.
  - 🔴1의 병합 규칙은 `mergeStates`(hz 기준 합집합, reps 많은 쪽 우선)를 그대로 쓴다. 다른 기기에서 삭제한 단어가
    이 기기의 옛 로컬 사본에 남아 있으면 로드 시 되살아날 수 있다 — `applyRemote`가 수신 때마다 로컬 저장소에
    덮어쓰므로 사본이 낡아 있는 경우는 드물다고 보고 유실 방지 쪽을 택했다.
  - 헤드리스 환경에는 TTS 음성·음성 인식이 없어 듣기 재생 체인과 말하기 카드는 예외 없음까지만 확인했다.

## 2026-09-12 통합 리뷰 수정: HanziWriter 인스턴스 누수 외 3건 + 저비용 5건

- 요지: 위 "예문 빈칸 채우기(cloze)"·"획순 연습 기능 추가"(둘 다 아직 미커밋) 커밋에 대한 리뷰에서 지적된
  🟡3건과 저비용 💡5건을 수정했다.
- 🟡1 (HanziWriter 인스턴스 누수, `mountStrokeWriter`) — 리뷰 재현(모달 20회 열닫 → 20개 전부 생존)의
  원인은 라이브러리 내부 `Ct` 생성자가 `_setupListeners()`에서 `document`에 `mouseup`/`touchend`
  리스너를 달고(`addPointerEndListener`), `HanziWriter.create()`를 부를 때마다(모달을 열 때, 글자 탭을
  바꿀 때, 모드를 바꿀 때, "다시 재생"할 때) 매번 새 `Ct` 인스턴스가 생겨 리스너가 계속 쌓이는 구조였다.
  라이브러리에 `setCharacter(char)`가 있고 이건 리스너를 다시 달지 않는 걸 라이브러리 소스에서 직접
  확인한 뒤(생성자와 별개 메서드), 리뷰가 제시한 "인스턴스 1개 유지 + setCharacter 재사용"을 그대로
  채택했다. 다만 `HanziWriter.create(target, ...)`의 `target`은 인스턴스가 계속 붙잡고 있는 실제 DOM
  노드라, 모달이 재렌더될 때마다(`m.innerHTML = strokeModalHtml()`) `#strokeStage` placeholder가 매번
  새로 생기는 기존 구조에서는 target 노드 자체도 함께 유지해야 재사용이 실제로 의미가 있었다(그렇지
  않으면 writer는 살아있어도 화면에 그려지지 않는 detached 노드에 그리게 된다) — 그래서 리뷰의 폴백
  옵션("target div 재사용")도 함께 적용했다: `strokeUi.stageEl`(영구 DOM 노드)을 앱 생애주기 동안 하나
  유지하고, 렌더마다 새로 생기는 placeholder를 `replaceWith()`로 그 자리에서 `stageEl`로 바꿔치기한다.
  `openStrokeModal`/`closeStrokeModal`이 하던 `strokeUi.writer = null` 리셋을 제거해 모달을 닫아도
  인스턴스가 죽지 않게 했다.
  - **재현 테스트 고정**(`tests/stroke-writer-reuse.test.mjs`, 신규): 실제 HanziWriter/document 대신
    `create()` 호출 횟수를 세는 가짜 객체를 주입해 (1) 20회 열닫 후 `create()` 호출 1회, (2) 글자 탭
    전환·모드 전환·"다시 재생" 모두 `create()` 없이 `setCharacter()`로만 처리, (3) 재사용 시 실제 그리는
    target 노드도 계속 같은 노드를 가리키는지 3개 테스트로 고정
- 🟡2 (`korean` 캡처가 정답 노출, `clozeOf`) — 번역 캡처 정규식이 `(.+)$`로 문자열 끝까지 탐욕적으로
  잡아, ex에 예문이 두 개 이어 붙어 있으면 뒤 문장(정답 한자 포함)이 통째로 `korean`에 섞여 프롬프트
  화면(정답 공개 전)에 그대로 노출되는 문제였다. ①캡처 그룹을 `(.+)$` 대신 다음 한자(CJK, `isCJK`와
  동일한 3개 유니코드 범위)가 나오기 전까지만 잡는 문자 클래스로 제한 ②그래도 `korean`에 정답(hz)이
  그대로 남아 있으면 `＿`로 빈칸 처리하는 이중 방어를 추가했다. 실제로는 ①만으로 hz(항상 한자)가
  `korean`에 남는 경로가 없어 ②가 트리거되는 걸 관찰하지는 못했지만(hz가 등장하는 순간 문자 클래스가
  이미 매칭을 멈춘다), 리뷰가 명시한 "이중 방어" 그대로 코드에 남겨 뒀다 — 향후 정규식을 바꾸는 사람이
  실수해도 마지막 방어선이 되도록.
  - **테스트**: 예문 2문장 ex(첫 문장이 hz, 뒷 문장이 무관한 별개 문장)에서 `korean`에 뒷 문장의 한자가
    전혀 섞이지 않는지, 번역에 hz가 괄호로 병기된 경우에도 `korean`에 hz가 그대로 남지 않는지 확인
- 🟡3 (숫자·라틴 혼재 문장 조각남, `clozeChunks`) — `CLOZE_PUNCT`가 한자·중국어 문장부호만 포함해
  `我有3个苹果。`처럼 아라비아 숫자가 중간에 끼면 청크가 `个苹果。`로 잘려 앞부분(`我有3`)이 유실됐다.
  아라비아 숫자(0-9)와 반각 문장부호(`.,!?`)를 `CLOZE_PUNCT`에 추가해 청크 연결자로 취급했다. 반각
  마침표 추가는 부수적으로 다른 버그도 고쳤다 — 예문이 반각 `.`로 끝나면(전각 `。`가 아니면) 문장 뒤
  `(병음) — 번역` 매칭이 마침표 하나 때문에 실패해 병음·번역이 통째로 유실되던 문제. 순수 숫자/ASCII로만
  이뤄진 청크가 문장 후보로 잘못 채택되지 않도록 `clozeOf`의 후보 선택에 `[...c].some(isCJK)` 방어도
  덧붙였다(hz가 항상 한자라 사실상 이미 보장되지만, 리뷰 문구를 그대로 코드에 남겼다).
  - **테스트**: `我有3个苹果。` 전체가 한 문장으로 잡히는지, 반각 마침표 예문의 병음·번역이 유실되지
    않는지, `clozeChunks`가 숫자/반각 부호를 연결자로만 쓰고 한자 없는 라틴 구간까지 잇지는 않는지 확인
- 💡 저비용 5건:
  - `cz.pinyin` 미소비 — cloze 카드 정답 공개 화면에 문장 전체(`cz.sentence`)와 그 병음(`cz.pinyin`)을
    한 줄 추가해 보여주도록 소비처를 만들었다(추출 제거 대신 소비 쪽 선택 — 이미 화면에 문장 원문을
    보여주는 자리라 자연스럽게 붙었다)
  - 첫 획순 탭 2.2MB 동기 파싱 — `renderStrokeModal()`이 데이터 미로딩 상태면 "불러오는 중" 카드를 먼저
    그리고 `setTimeout(..., 0)`으로 다음 틱에 `ensureStrokeData()`(파싱)+재렌더를 미루도록 분리(파싱
    자체는 여전히 처음 한 번만 발생, 그 시점만 한 틱 늦춘 것)
  - 한자 없는 단어의 죽은 획순 버튼 — 단어 목록 상세의 "획순" 버튼을 `strokeCharsOf(w.hz).length` 조건부
    렌더로 바꿔, hz에 한자가 하나도 없는 단어에서는 버튼 자체가 안 뜨게 함(write 카드의 "획순 보기"
    버튼은 `canWrite` 조건상 이미 hz에 한자가 있을 때만 뜨는 경로라 손대지 않았다)
  - `sourceMappingURL` 주석 제거(존재하지 않는 `.map` 파일을 가리키던 죽은 참조) / `strokeDataFailed`
    (파싱 자체 실패 — 새로고침 안내)와 글자 자체의 데이터 없음(정상, "준비 중") 문구를 구분
  - `docs/STROKE_DATA.md`에 gzip 수치 기록 — `index.html` 전체 raw 약 3.36MB, gzip 약 1.52MB(정적
    호스팅은 보통 gzip/br을 자동 적용하므로 실사용 체감에 가까운 수치), `#stroke-data` JSON만 gzip하면
    약 0.89MB
- 변경 지점 (index.html): `// ---------- cloze (예문 빈칸) ----------`(`CLOZE_PUNCT`, `clozeChunks`,
  `clozeOf`), `renderReview()`의 `t === 'cloze'` 정답 공개 분기, `wordItemHtml()`의 "획순" 버튼,
  `// ---------- stroke writer (획순 연습) ----------` 섹션 전체(`strokeUi`, `openStrokeModal`,
  `closeStrokeModal`, `strokeModalHtml`, `strokeLoadingHtml`(신규), `renderStrokeModal`,
  `mountStrokeWriter`), Hanzi Writer 라이브러리 스크립트 블록 끝의 `sourceMappingURL` 주석
- 검증:
  - 기존 79개(cloze 10 포함) + 신규 `cloze.test.mjs` 5개(🟡2 2개, 🟡3 3개) + 신규
    `tests/stroke-writer-reuse.test.mjs` 3개(🟡1) = **총 87개 전부 통과**
  - `<script>` 7블록(JSON 3 + JS 4) 각각 `JSON.parse`/`new Function()`으로 파싱 — 오류 0
- 타협/미해결:
  - 🟡2의 "이중 방어"(정답 blank 처리)는 코드로는 존재하지만, 현재 정규식 설계(①만으로 hz가 항상
    차단됨)에서는 실제로 트리거되는 입력을 만들지 못해 그 경로 자체를 직접 때리는 테스트는 못 만들었다
    — 대신 관찰 가능한 계약("korean에 정답 한자가 남지 않는다")을 두 재현 시나리오로 고정했다
  - 획순 데이터 지연 파싱을 `setTimeout(0)`으로 한 틱 미루는 것의 실제 체감(모달이 얼마나 빨리 뜨는지)은
    브라우저 환경에서 직접 확인하지 못했다 — 파싱 자체의 소요 시간은 그대로이므로 "모달이 늦게 뜨는 것"을
    "불러오는 중이 잠깐 보이는 것"으로 바꾼 정도의 개선이다
  - "한자 없는 단어의 죽은 획순 버튼"은 단어 목록 상세 진입점만 고쳤다(요청·리뷰 재현이 이 지점을
    가리켰고, write 카드 진입점은 애초에 도달 불가능한 경로라 변경 대상이 아니었다)

---

## 2026-09-12 예문 빈칸 채우기(cloze) 복습 카드 추가

- 요지: ex(예문) 필드에 단어의 hz가 원형 그대로 포함된 단어에 한해, 예문의 중국어 문장부를 빈칸(＿)
  처리하고 병음을 입력해 채우는 새 복습 카드 유형 'cloze'를 추가했다. ex는 두 형식이 공존한다는 전제
  그대로 지원한다 — 규격형 "中文例句 (pīnyīn) — 한국어 번역"(docs/EXAMPLE_WORKER.md 워커 생성)과
  자유 텍스트(사용자 수동 입력, 중국어 문장 유무 자유). 판정은 순수 함수 `clozeOf(w)`로 분리해 ex 파싱
  로직이 렌더링·SRS 로직과 섞이지 않게 했다.
- 변경 지점 (index.html):
  - `// ---------- cloze (예문 빈칸) ----------` 섹션 신설("reading check" 섹션 다음, "week" 섹션
    앞): `CLOZE_PUNCT`(중국어 문장부호 화이트리스트), `clozeChunks(text)`(ex 전체에서 한자+중국어
    문장부호로만 이어진 연속 구간들을 추출 — 괄호 안 병음은 라틴 문자, 번역은 한글이라 이 문자 집합에
    없어 자연히 끊긴다), `clozeOf(w)`(순수 함수 — hz가 포함된 구간을 문장으로 채택하고, 이어지는
    "(병음) — 번역"이 있으면 함께 추출. hz 미포함/ex 없음이면 `null`)
  - `pickType(w)`: `canCloze = !!clozeOf(w)` 추가. `mode==='cloze'`면 `canCloze ? 'cloze' : 'recog'`
    (기존 write/speak와 동일한 폴백 패턴). mix 모드 pool에도 `canCloze && settings.clozeCards!==false`일
    때만 'cloze' 추가(다른 유형과 동률 — 균등 무작위 pool에 한 항목만 늘어남)
  - `reviewModeBarHtml()`: chipDefs에 `['cloze','예문']` 추가. `S.words.some(w=>!!clozeOf(w))`로
    전체 단어장에 cloze 가능 단어가 있는지 계산해 0개면 칩 disabled + 사유 문구(clozeHint) 표시. mix
    모드 토글에도 "예문 카드 포함"(`#rvClozeCards`) 추가(기존 손글씨/발음 토글과 동일 패턴).
    `bindReviewModeBar()`에 리스너 추가
  - `renderReview()`: `t === 'cloze'` 분기 신설(read/produce 분기 바로 앞) — 빈칸 문장(`cz.blanked`,
    `.cloze-sentence.hz-inline`) + (있으면) 문장 한국어 번역 표시 → 병음 입력(`#ans`)은 read/produce와
    완전히 동일한 answer-row UI 재사용. `checkAnswer()`는 수정 없이 그대로 재사용(session.cur가 채점
    대상 단어 자체라 변조 관대화 등 기존 로직이 그대로 적용됨). 정답 공개 시 `answer(true)`로 완성
    문장(raw ex 텍스트)·병음·뜻을 보여주고, "문장 듣기"(`data-act="speakCloze"`) 버튼으로 `cz.sentence`
    전체를 TTS 재생
  - `$('#view')` 클릭 위임에 `case 'speakCloze'` 추가(기존 `[data-act]` 선택자 그대로 재사용)
  - 듣기(연속 재생) 모드: `listenSpeakCurrent()`에 "한자→뜻→예문"(`itemMode==='hzMeanEx'`) 체인 추가 —
    한자 발음 후 뜻(한국어 TTS) 재생이 끝나면 `clozeOf(w)`로 얻은 문장을 중국어로 이어 재생(없으면
    조용히 건너뜀, 새 파싱 없이 기존 판정 재사용이라 저비용). `renderListen()`의 "항목 구성" 칩 행에
    "한자→뜻→예문" 칩 추가
  - CSS: `.cloze-sentence`(신규, 예문 빈칸 프롬프트용 — 기존 `.example`은 보조 캡션 크기라 재사용하지
    않고, `.prompt-mean`과 `.example` 사이 크기로 신설) + 기존 `.hz-inline`을 함께 적용해 중국어 폰트로
    표시
- 검증:
  - 기존 5개 테스트 파일 69개 전부 그대로 통과. 단, `session-queue.test.mjs`는 `pickType`이 새로
    `clozeOf`를 참조하게 되면서 그 함수를 로드하지 않는 이 테스트 파일에서 `ReferenceError`가 나 깨졌다
    — `clozeOf` 로직 자체(=cloze.test.mjs가 검증)와 무관한 최소 스텁(`function clozeOf(){return null;}`)
    한 줄을 기존 `toast`/`save`/`render` 스텁과 같은 자리에 추가해 해결
  - 신규 `tests/cloze.test.mjs` 10개(규격형 2, 자유 텍스트 2, hz 미포함 1, ex 없음/undefined/null 3,
    괄호 없는 중국어만 1, 다중 출현 hz 1) 전부 통과 — 총 79개
  - `<script>` 7블록(JSON 3 + JS 4) 각각 `JSON.parse`/`new Function()`으로 파싱 — 오류 0
- 타협/미해결:
  - "정답 보기"(빈칸을 안 풀고 바로 정답 확인)는 recog 카드처럼 별도 버튼을 새로 만들지 않고, 기존
    read/produce의 "모르겠어요"(`data-act="giveup"`) 버튼을 그대로 재사용했다 — 결과적으로 동일하게
    채점 없이 정답을 공개하는 동작이라, 계획의 "입력 UI·checkAnswer 재사용" 원칙을 "버튼도 그대로
    재사용"으로 해석했다. 문구가 "정답 보기"가 아니라 "모르겠어요"인 점만 계획과 다르다.
  - `clozeOf`의 "중국어 문장부" 판정은 정규식 기반 문자 집합 매칭이라, ex에 괄호 안 병음이 아닌 다른
    라틴 문자 텍스트(예: 영어 단어가 섞인 메모)가 낀 자유 텍스트에서도 규격형처럼 오인해 pinyin/korean을
    억지로 채우려 시도할 수 있다 — 다만 정규식이 실패하면 조용히 undefined로 남기므로(cloze.test.mjs의
    "자유 텍스트: 괄호가 있어도…" 케이스로 확인) 안전하게 실패한다.
  - 듣기 모드 "한자→뜻→예문"에서 예문 재생 목소리는 한자 단어 재생과 같은 `pickZhVoice()`를 그대로
    쓴다 — 문장이라고 다른 음색/속도를 쓰지는 않는다(요청에 없었고, 저비용 원칙에 맞춰 최소 변경).

---

## 2026-09-12 획순 연습 기능 추가 (Hanzi Writer 임베드)

- 요지: 단어 상세와 손글씨(write) 카드에서 한자 획순 애니메이션을 보고(보기 모드) 따라 써 볼 수 있게(연습
  모드, quiz) 했다. 라이브러리(Hanzi Writer)와 데이터(hanzi-writer-data, 빈도 상위 1000자)는 기존 원칙대로
  다운로드해서 index.html에 통째로 인라인 임베드했다(외부 CDN 참조 없음).
- 데이터: `hanziDB.csv`(Rudd Fawcett, MIT — Jun Da 현대 중국어 한자 빈도 목록 기반)에서 빈도 순위 1~1000위
  글자를 뽑아 `hanzi-writer-data`(Make Me a Hanzi 경유, Arphic Public License)에서 글자별 획순 JSON을
  전부 내려받았다. **1000/1000자 전부 확보(커버리지 100%)** — 준비 중인 글자 없음. HSK 레벨 분포는
  HSK1 159·HSK2 136·HSK3 195·HSK4 257(1~4 합계 747, ~75%)·HSK5 192·HSK6 52·미등재 9 — 순수 빈도 기반이라
  HSK1~4를 "대체로" 커버하지만 정확히 일치하지는 않는다(의도한 동작).
- 변경 지점 (index.html):
  - 파일 상단 라이선스 주석: Hanzi Writer(MIT)·hanzi-writer-data(Arphic)·빈도표 출처(hanziDB.csv, 재현용,
    앱 미포함) 3줄 추가
  - 임베드: `#stroke-data`(JSON, ~2.2MB, 1000자) — 기존 py-dict/mmah-data 옆. Hanzi Writer v3.7.3 minified
    JS — 기존 HanziLookup 라이브러리 스크립트 바로 앞
  - `// ---------- stroke writer (획순 연습) ----------` 섹션 신설(`padPick` 다음, `events` 앞):
    `ensureStrokeData`(지연 파싱 — 획순 기능을 처음 열 때만 `#stroke-data`를 `JSON.parse`), `strokeCharsOf`
    (단어→중복 제거된 한자 배열, 순수 함수), `hasStrokeData`(순수 함수), `strokeUi` 상태,
    `openStrokeModal`/`closeStrokeModal`/`strokeModalHtml`/`renderStrokeModal`/`mountStrokeWriter`
    (HanziWriter.create + animateCharacter/quiz)
  - 진입점 ①: `wordItemHtml()`의 단어 상세 버튼 행에 "획순" 버튼 추가(`data-act="strokeOpen"
    data-strokehz="..."`) — 버튼 4개로 늘어나 `.wbody .row`에 `flex-wrap:wrap` 추가(좁은 화면에서 2x2로
    줄바꿈, 기존 3버튼 레이아웃과 호환)
  - 진입점 ②: `write` 카드 정답 공개 화면(`t === 'write' && p`)에 "획순 보기" 버튼 추가
  - `$('#view')` 클릭 위임의 `switch(d.act)`에 `case 'strokeOpen'` 추가(기존 선택자에 이미 `[data-act]`가
    있어 선택자 목록 변경 불필요)
  - `#strokeModal`(고정 오버레이, `#app` 안 `#toast` 다음) 전용 클릭 위임 신설 — `#view` 밖이라 탭 전환과
    무관하게 별도로 둠(닫기/글자 탭/보기·연습 모드 전환/다시 재생·시작)
  - CSS: `.strokemodal`/`.modalcard`/`.modalhead`/`.strokestage` 신설(그 외 모달 내부는 기존
    `.chiprow`/`.chip`/`.card.empty`/`.padmsg`/`.iconbtn` 재사용 — 새 클래스 최소화)
  - 설정 화면에 `<details>` 접이식 "오픈소스 고지" 섹션 신설("데이터" 섹션 다음) — HanziLookup·Hanzi
    Writer·hanzi-writer-data·pinyin-pro 4건 + docs/STROKE_DATA.md 포인터
  - 신규 문서: `docs/STROKE_DATA.md` — 획순 데이터/라이브러리 재임베드 절차(빈도표에서 글자 선정 →
    hanzi-writer-data 일괄 다운로드 → index.html 치환 → 검증)
- 파일 크기: 1,199,142 → 3,514,853 bytes (+2.21MB, 대부분 `#stroke-data` JSON)
- 검증:
  - 기존 `node tests/sandhi.test.mjs` 12, `checkword-checkanswer.test.mjs` 23, `session-queue.test.mjs` 5,
    `week-queue.test.mjs` 18 = 58개 그대로 통과
  - 신규 `node tests/stroke-chars.test.mjs` 11개(strokeCharsOf 중복 제거·공백/비한자 제외·null 안전,
    hasStrokeData 존재/부재/미로딩/prototype 오염 방지) 전부 통과 — 총 69개
  - `<script>` 7블록(설정 스크립트·py-dict·mmah-data·stroke-data·Hanzi Writer 라이브러리·HanziLookup
    라이브러리·본문 앱 스크립트) 각각 잘라내 `new Function()`/`JSON.parse`로 파싱 — 오류 0
  - 전역 이름 충돌 확인: `HanziWriter`(라이브러리가 노출하는 전역)가 라이브러리 정의 이전 어디서도
    쓰이지 않음을 확인 — 기존 `HanziLookup`(별개 손글씨 인식 라이브러리)과 이름공간 겹치지 않음
- 타협/미해결:
  - 실제 iOS Safari에서의 로드 체감(파싱 지연 유무)은 이 환경에서 직접 확인할 수 없었다 — `#stroke-data`
    JSON.parse를 획순 기능 최초 사용 시점으로 미뤄 두었지만(요청사항), 브라우저가 2.2MB 텍스트 노드
    자체를 HTML 파싱 단계에서 들고 있어야 하는 비용은 그대로다(기존 mmah-data/py-dict와 동일한 방식이라
    새로운 문제는 아님)
  - 퀴즈(연습) 모드의 "힌트"는 별도 버튼 대신 라이브러리 내장 `showHintAfterMisses:1`(1회 틀리면 자동
    힌트) + `markStrokeCorrectAfterMisses:3`(3회 틀리면 관대하게 통과)로 처리했다 — 계획 문구("힌트")는
    수동 버튼을 뜻할 수도 있었으나, "라이브러리 내장 기능 사용"이라는 계획의 명시적 제약과 앱의 기존
    관대화 기조(성조 변조 채점 등)에 맞춰 자동 힌트 쪽을 택했다
  - 모달은 배경 탭 또는 닫기 버튼으로만 닫힌다 — Esc 키 닫기는 계획에 없어 추가하지 않았다

---

## 2026-09-12 병음 변조(tone sandhi) 안내 및 채점 관대화

- 요지: 표기(성조 정서법 표준)는 그대로 두고, 실제 발음이 표기와 달라지는 3가지 규칙(3성 연쇄, 不+4성, 一 성조 변화)을
  화면에 안내하고, 퀴즈/사전 검증에서 변조 발음으로 입력해도 정답·통과 처리되도록 관대화했다.
- 변경 지점 (index.html):
  - `sandhiInfo(pyCanon, hz)` 신설 — 순수 함수, "// ---------- pinyin ----------" 섹션 (parsePinyin 등과 같은 구역)
  - `sandhiSpokenCanon(info)`, `sandhiHintHtml(pyCanon, hz, key)`, `sandhiSeen` — UI 안내 헬퍼, `issuesHtml` 바로 다음
  - `checkWord()` — 성조 불일치가 변조로 설명되면 `issues`에 넣지 않고 `issues.sandhiNotes`에 안내만 남기도록 수정
  - `checkAnswer()` — 변조 발음으로 입력해도 정답 처리 + `session.pending.sandhiNote` 안내 추가
  - 퀴즈 정답 카드(`answer()` 클로저), write 모드 프롬프트, 단어 목록 상세, 단어 추가 미리보기(`#pyPreview`)에
    `sandhiHintHtml()` 호출 추가
  - `saveOne()`, 단어 수정(`d.save`/`d.saveForce`) 핸들러 — 저장/수정 성공 토스트에 `sandhiNotes` 안내 덧붙임
- 검증:
  - `node tests/sandhi.test.mjs` — 12개 케이스(3성 2/3연쇄, 不+4성/비4성, 一+4성/2성/단독/끝자리, 변조 없음,
    빈 입력, 한자 없는 입력, 글자-음절 수 불일치) 전부 통과 (`12 passed, 0 failed`)
  - `<script>` 블록 전체를 `new Function()`으로 파싱 — 문법 오류 0
  - `python3 -m http.server`로 기동 후 `curl`로 `index.html` 응답 확인 (HTTP 200, 원본과 동일) — 실제 브라우저
    콘솔 확인은 이 환경에서 불가능해 위 방식으로 대체
- 타협/미해결:
  - 一의 서수(예: "제1"류 순서를 나타내는 一) 용법은 한자만으로 구분이 어려워 별도 규칙을 만들지 않았다.
    현재는 "단독으로 쓰이거나 단어 끝자리"만 예외 처리하고, 그 외 위치에서는 뒤 성조 규칙을 그대로 적용한다.
  - "첫 노출 시에만 이유 설명" 규칙은 저장소에 남기지 않고 메모리 내 `Set`(`sandhiSeen`)으로만 판단한다.
    새로고침하면 다시 처음 노출로 취급된다.
  - 저장 값(원형 성조 표기) 결정 로직은 그대로 두었다 — 사용자가 입력한 대로 저장하는 기존 동작 유지.

### 리뷰 사이클 (2026-09-12, 3회)
- 1차: 관대화가 입력 기준으로 계산돼 정반대 동작(무관 음절 오류 침묵) + 一 서수 오적용 → 참조 독음 기준 재계산·一 채점 제외
- 2차: 다음자 폴백의 유령 3성 연쇄(사전 101단어 재현)·발음 표기 모순·一 전면 제외 과잉 → 연쇄 구간 typed-ref 대조 가드·spoken 단일 소스·R3 제외를 사전 등재 기준으로 축소
- 3차(최종): 승인. 사전 4,083단어 × 성조 섭동 58,160건 퍼징 예외 0. 잔여 🟡(R3 문구 완화·테스트 실단어 교체)는 PM 직접 반영
- 최종 테스트: sandhi 12 + 통합 23 = 35개 통과

---

## 2026-09-12 1차 개선 4건: 복습 중메뉴·발음 채점 정직화·손글씨 인식률·저장 방식 토글

- 요지: ① 복습 방식(mode)을 설정 화면에서만 바꿀 수 있던 것을 복습 화면 상단 칩 메뉴로 옮겨 세션 도중에도 즉시
  바꿀 수 있게 했다. ② speak 카드의 발음 채점이 실제보다 정확해 보이지 않도록 상시 문구를 추가하고, speak를
  명시 선택했는데 기기가 미지원이면 조용히 대체하지 않고 1회 안내하며, 음성이 외부 서버로 전송될 수 있음을
  설정 화면에 고지했다. ③ 손글씨 인식 후보 폭을 넓혔다(매처 limit·표시 후보 수·캔버스 크기). ④ 설정에 "로컬
  전용 / 서버 연동" 저장 방식 토글을 신설해 연동 모드를 명시적으로 선택했을 때만 동기화 주소 UI가 보이게 했다.
- 변경 지점 (index.html):
  - CSS: `.modebar`, `.chiprow`, `.chip`, `.chiptoggles`, `.chiptoggle` 신설 — `.progress` 규칙 바로 다음
  - 상태: `settingsUi = { storageMode:null }`, `speakUnsupportedNotified = false` 신설 — 기존 `addState`/
    `confirmDelete` 선언부 옆
  - `pickType(w)` — `m === 'speak'`인데 `!speechOK`면 `speakUnsupportedNotified` 플래그로 1회만
    `toast('이 기기는 음성 인식을 지원하지 않아 다른 방식으로 보여드려요')` 후 `recog`로 대체(기존엔 조용히 대체)
  - `reviewModeBarHtml()`, `bindReviewModeBar()` 신설 — `render()` 바로 다음, `renderReview()` 앞. 모드 칩 6개
    (mix/recog/read/produce/write/speak, speak는 `!speechOK`면 disabled+사유 문구) + mix일 때만 보이는
    손글씨·발음 확인 포함 체크박스(옛 `writeCards`/`speakCards`를 그대로 옮김)
  - `renderReview()` — 세 갈래(세션 없음/대기 카드 없음/완료 화면/진행 중 `head`) 모두에 `reviewModeBarHtml()`을
    선두에 붙이고 렌더 후 `bindReviewModeBar()` 호출. "단어가 아예 없음" 빈 상태에는 붙이지 않음(고를 모드가
    의미 없어서 의도적으로 제외)
  - `$('#view')` 클릭 위임 — 셀렉터에 `[data-mode]` 추가, `d.mode` 처리 시 `S.settings.mode = d.mode; save();
    toast('복습 방식 변경됨'); render();` (설정 화면의 기존 라디오 change 핸들러와 동일한 저장 경로 재사용)
  - speak 카드 결과 화면(`t === 'speak'`, `p` 있을 때) — `.verdict`/`.heard` 다음에 상시 문구
    `"음성 인식은 성조 실수를 관대하게 알아들을 수 있어요 — 참고용이에요."` 추가
  - `renderSettings()` 전면 재작성:
    - "기기 간 동기화" 카드를 "저장 방식" 카드로 교체 — `storageMode` 라디오(local/server), server일 때만
      기존 동기화 주소 입력·연결 버튼·상태·복사 버튼과 EXAMPLE_WORKER.md 안내 문구 노출. local 선택 시
      `sync.url`이 있으면 기존 `disconnectSync()` 재사용(별도 `clearSyncUrl` 함수는 없었음)
    - "복습 방식" 카드에서 모드 라디오 6개·writeCards·speakCards 체크박스 제거, "복습 화면 위쪽 칩에서 바로
      바꿀 수 있어요" 안내로 대체(중복 UI 제거). `autoAudio` 체크박스는 그대로 유지
    - `speechOK`일 때 "말하기 카드는… Apple, Google 등 서버로 전송될 수 있고, 로컬 처리를 보장할 수 없다"는
      상시 고지 문구 추가
  - 손글씨 인식 튜닝: `hl.matcher.match(ac, 12, …)` → `25`; 후보 슬라이스 두 곳(`recognizeLocal`의
    `.slice(0, 8)`, `padRecognize`의 `.slice(0, 8)`) → `.slice(0, 12)`; 캔버스 크기 상한
    `Math.min(300, (box.clientWidth||300)-4)` → `Math.min(340, (box.clientWidth||340)-4)`; 초기 `pad.size`
    기본값도 300→340으로 맞춤. 획수 힌트(`${pad.strokes.length}획 — …`)는 이미 `padMsg`에 있어 추가 작업 없음
- 검증:
  - `node tests/checkword-checkanswer.test.mjs` 23 passed, `node tests/sandhi.test.mjs` 12 passed — 총 35개
    유지(이번 변경은 sandhi/checkWord 로직을 건드리지 않음)
  - `<script>` 3블록 전체를 `new Function()`으로 파싱 — 문법 오류 0
  - 브라우저 실행 불가 환경 — 렌더 함수가 반환하는 HTML 문자열의 태그 짝(`<section>`/`</section>` 개수),
    `data-mode`/`data-act` 바인딩, id 중복(`#rvWriteCards`/`#rvSpeakCards` vs 옛 `#writeCards`/`#speakCards`
    잔존 여부)을 grep으로 대조하는 방식으로 자가 점검
- 타협/미해결:
  - "음성 서버 전송 고지"는 세션당 1회 토스트가 아니라 설정 화면의 상시 문구로 구현했다(플랜의 "설정 또는
    speak 첫 사용 시 1회 고지" 중 "설정" 쪽을 택함) — 토스트는 사라지면 다시 확인할 수단이 없어 항상 볼 수
    있는 위치가 더 정직하다고 판단.
  - "권한 거부 시 조용한 대체" 항목은 런타임에서 이미 `session.speakMsg`로 매 시도마다 사유를 보여주고 있어
    (조용한 대체가 아님) 별도 수정하지 않았다 — 수정한 것은 `pickType()`의 "speak 모드 명시 선택 + 기기
    미지원" 케이스뿐이다.
  - `speakUnsupportedNotified`는 새로고침하면 다시 알림이 뜬다(메모리 상태, `sandhiSeen`과 동일한 패턴).
  - 모드 칩 순서/라벨은 기존 설정 화면 라디오 순서를 그대로 따랐고, 화면 폭 문제로 라벨을 짧게 줄였다
    (예: "한자 보고 떠올리기" → "한자→기억").

---

## 2026-09-12 신규 기능 2건: 등록 주차별 복습 노출 조절 · 연속 듣기 모드

- 요지: ① 단어를 추가한 ISO 주차 단위로 복습 노출 강도(집중/보통/여유/쉬는 주차)를 지정할 수 있게 했다.
  기존 SRS 필드(stage/due/reps)는 전혀 건드리지 않고, 세션 큐를 짜는 시점의 필터·정렬만으로 구현했다.
  ② 단어를 순서대로 이어 들려주는 "듣기" 탭을 신설했다 — 기존 TTS(speechSynthesis) 인프라를 재사용해
  한자(zh 음성)·뜻(ko 음성)을 자동 간격을 두고 연속 재생한다.
- 변경 지점 (index.html):
  - CSS: `.weekgrp`, `.weekhead`, `.weeklabel`, `.weekarrow`, `.weekchips` 신설 — `.chiptoggle input` 규칙
    바로 다음
  - 신규 순수 함수 섹션 `// ---------- week (등록 주차) ----------` (words 섹션 바로 앞, DOM/전역 상태 참조
    없음 — 테스트에서 이 섹션만 통째로 뽑아 실행):
    - `weekKeyOf(ms)` — KST(UTC+9, 서머타임 없음) 기준 ISO 8601 주차 키('YYYY-Www') 계산. Date의 UTC
      게터를 그대로 쓰되 시각을 9시간 밀어 "UTC 자정"이 "KST 자정"이 되게 하는 방식(브라우저 시간대 무관)
    - `weekMondayFromKey(key)`, `weekLabelOf(key)` — 주차 키 → "N월 M주차" 표시용 라벨
    - `weekLevelOf(added, weights)` — 가중치 맵에서 해당 주차의 레벨(high/normal/low/off) 조회, 미지정·
      알 수 없는 값은 normal
    - `filterDueByWeight(words, weights, now)` — 기한이 된 단어 중 off만 제외하고 기한순 정렬(배지·문구용,
      순서 재배치는 하지 않음)
    - `buildSessionQueue(words, weights, now)` — 실제 세션 큐: high 우선 배치 + 세션 내 재출현(큐 맨 뒤에
      한 번 더 포함), normal, low(후순위) 순. 단어 객체를 그대로 반환(복제·필드 변형 없음)
  - `S.settings.weekWeights = {}` 기본값 추가 — `fresh()`, `load()`의 `S.settings` 병합, `normalizeState()`
    세 곳 모두
  - `dueCards()` → `filterDueByWeight(S.words, S.settings.weekWeights||{}, Date.now())` 호출로 교체(배지·
    "대기 카드 N개"·`nextDueText()`가 자동으로 off 제외를 따름)
  - `startSession(false)` → `buildSessionQueue(...)`로 교체(extra=true 랜덤 10개 경로는 그대로 — 이 경로는
    due 기반이 아니라 가중치 적용 대상이 아니라고 판단)
  - `nextDueText()` — off 주차 단어는 "다음 복습" 계산에서도 제외(안 그러면 실제로는 계속 숨겨질 단어의
    시각을 안내하게 되는 모순이 생겨 함께 수정)
  - `reviewModeBarHtml()` 끝에 `offExcludedHint()` 호출 추가 — 지금 기한이 됐지만 쉬는 주차라 큐에서 빠진
    단어 수를 항상 한 줄로 보여준다("쉬는 주차 단어 N개는 복습 대기열에서 제외됐어요") — 복습 시작/진행/완료
    화면 전부에 표시(조용한 제외 금지 요구사항)
  - `listState.weekOpen = {}`, `WEEK_LEVELS` 상수 신설
  - `listHtml()` 전면 개편: 검색어가 있을 때는 기존처럼 평평한 목록, 없을 때는 `weekKeyOf`로 그룹핑해
    최근 주차가 위로 오도록 정렬 + 그룹 헤더(주차 라벨·단어 수 + `WEEK_LEVELS` 4단계 칩)를 접이식으로.
    단어 1개짜리 아이템 렌더링은 `wordItemHtml(w, issueOf)`로 분리해 재사용(기존 로직 그대로 이동, 변경 없음)
  - `$('#view')` 클릭 위임 — 셀렉터에 `[data-wktoggle],[data-wklvl]` 추가. `data-wktoggle`은 그룹 접기/펴기
    (버튼의 `aria-expanded`로 현재 상태 판별), `data-wklvl`+`data-lvl`은 해당 주차의 가중치 저장(`normal`이면
    맵에서 삭제해 객체를 깔끔하게 유지)
  - 신규 탭 "듣기"(`data-tab="listen"`) 추가 — 단어장과 설정 사이
  - TTS 섹션에 `pickZhVoice()`/`pickKoVoice()` 분리(기존 `speak()`의 인라인 보이스 탐색 로직을 재사용 가능하게
    뽑아냄, 동작 변화 없음) + `speak()`는 `pickZhVoice()` 호출로 교체
  - 신규 섹션 `// ---------- 듣기(연속 재생) 모드 ----------`: `listen` 상태 객체, `listenPrefs()`(설정 기본값
    지연 초기화 — `S.settings.listenPrefs`에 저장), `listenWeekOptions()`, `listenBuildQueue()`, `listenReset()`,
    `listenCur()`, `listenRequestWakeLock()`/`listenReleaseWakeLock()`(`navigator.wakeLock` 시도, 실패는
    조용히 무시), `listenSpeakCurrent()`(zh 발화 → itemMode가 'hzMean'이면 ko 보이스 탐색 후 뜻 발화, ko
    보이스가 없으면 1회 토스트 안내 후 건너뜀 → `onend` 체이닝으로 다음 단어까지 간격(`gapMs`, 0.5/1.0/1.5초
    설정 가능) 대기), `listenAdvance()`, `listenPlay()`, `listenPause()`(진행 중이던 발화 체인을 `curTurn`
    카운터로 무효화 — 고아 콜백 방지), `listenGoto(delta)`(이전/다음)
  - `renderListen(v)` 신설 — 순서(최근순/무작위)·항목 구성(한자만/한자→뜻)·반복(전체 반복 on/off)·범위(전체 또는
    `weekKeyOf` 기준 특정 주차) 컨트롤 + 현재 단어(한자 타일·병음·뜻) 표시 + 재생/일시정지/이전/다음 버튼 +
    "iOS는 화면이 잠기면 재생이 멈출 수 있어요" 상시 안내 문구. 범위 안에 단어가 0개면 "이 범위에는 단어가
    없어요" 안내로 대체. `ttsOK`가 false면 애초에 설정 화면 없이 미지원 안내만 표시
  - `render()` 디스패치에 `tab === 'listen'` 분기 추가, `.tabs` 클릭 핸들러에서 `listen` 탭으로 들어갈 때
    재생 중이 아니면 `listenReset()`으로 큐를 최신 단어 목록으로 다시 짬
  - `$('#view')` 클릭 위임 스위치에 `lnPlayPause`/`lnPrev`/`lnNext` 케이스 추가
  - `applyRemote()` — 재생 중(`listen.active`)에 동기화로 단어 목록이 바뀌면 현재 재생 중이던 단어 id가
    사라졌는지 확인해 사라졌으면 `listenPause()` + 안전 정지(고아 utterance 방지) + 토스트 안내, 살아있으면
    큐에서 삭제된 항목만 걸러내고 인덱스를 다시 맞춤
  - `document.visibilitychange` 리스너 신설 — 탭 전환/백그라운드 전환 시 재생 중이면 `listenPause()`
  - "모든 단어 삭제"(`wipe`) 액션에 `listenPause(); listen.active=false; listen.queue=[]` 추가(단어장을
    통째로 비웠는데 듣기 큐가 죽은 id를 들고 있는 상태 방지)
- 검증:
  - 신규 `tests/week-queue.test.mjs` 18개 케이스(주차 경계 5, 라벨 1, weekLevelOf 3, filterDueByWeight
    4 — 기한 미도래 제외/off 제외/기한순 정렬/빈 목록, buildSessionQueue 5 — high 우선+재출현/off 제외/
    high 없을 때 중복 없음/빈 큐/SRS 필드 원본 보존) 전부 통과. index.html의 week 섹션을 그대로
    `new Function()`으로 추출해 실행하는 기존 sandhi.test.mjs 방식을 그대로 따름
  - 기존 `node tests/sandhi.test.mjs` 12 passed, `node tests/checkword-checkanswer.test.mjs` 23 passed —
    총 35개 그대로 유지(이번 변경은 sandhi/checkWord 로직을 건드리지 않음). 신규 18개 포함 총 53개
  - `<script>` 3블록(설정 스크립트·손글씨 라이브러리·본문 앱 스크립트) 전체를 `node --check`로 파싱 —
    문법 오류 0
  - 템플릿 문자열 태그 짝(`div`/`section`/`button`/`span`/`label`/`select`) 개수를 grep으로 대조해
    `renderListen()`, `listHtml()`+`wordItemHtml()` 자가 점검 — 브라우저 실행이 불가능한 환경이라 채택한
    기존 방식(1차 개선 로그와 동일)
- 타협/미해결:
  - "high 세션 내 재출현"은 플랜의 두 옵션(재출현 허용 vs due 앞당김) 중 재출현 쪽을 택했다 — due를 당기면
    "기존 SRS 필드는 절대 수정하지 않는다"는 제약과 정면으로 충돌하기 때문에 다른 선택지가 없었다. 재출현은
    `finishCard()`가 오답 카드를 큐 끝에 다시 넣는 기존 패턴(`session.queue.push(w.id)`)과 정확히 같은
    메커니즘이라 자연스럽게 들어맞았다.
  - "쉬는 주차 제외"는 `startSession(false)`(일반 복습)에만 적용했다. "랜덤으로 10개 더 복습"(extra 모드)은
    기한과 무관하게 전체 단어에서 뽑는 별도 경로라 플랜이 명시한 "세션 시작 시 due 단어 선별" 훅과 다르다고
    보고 그대로 뒀다 — off 주차 단어가 미리 복습에는 여전히 나올 수 있다는 뜻이라 완전한 "쉬는 주차"는
    아니다. 필요하면 추가 확인 후 반영해야 한다.
  - 주차 라벨("N월 M주차")은 ISO 주차와 달력상 "몇째 주"가 완전히 일치하지는 않는다(그 주 월요일이 속한
    달의 1~7일=1주차 식 근사). 주차 키 자체(가중치 저장·비교 기준)는 ISO 8601로 정확하지만, 화면 표시는
    참고용이다.
  - 듣기 모드의 순서·항목 구성·반복·간격 설정은 `S.settings.listenPrefs`에 저장해 기기 동기화 시 함께
    넘어가지만(`mode`/`autoAudio`와 동일한 병합 규칙 — 더 최근에 저장된 기기의 `settings` 전체가 이긴다),
    재생 진행 위치(`listen.idx`)는 저장하지 않는다(메모리 상태, 새로고침하면 처음부터).
  - iOS Safari의 화면 잠금 시 재생 중단은 실제로 우회할 방법이 없다(Screen Wake Lock도 화면이 꺼지는 것 자체를
    막을 뿐, 백그라운드 탭/잠금화면에서의 JS 타이머·speechSynthesis 정지는 iOS 정책상 앱이 통제할 수 없다) —
    플레이어 화면에 상시 문구로 정직하게 고지하고, 우회 가능하다는 인상을 주는 문구는 넣지 않았다.
  - `navigator.wakeLock`은 인증서 있는 https 환경에서만 동작한다 — 이 앱이 배포되는 방식(로컬 파일/사설
    페이지 등)에 따라 조용히 실패할 수 있고, 실패해도 사용자에게 별도 알리지 않는다(플랜의 "실패는 조용히
    무시" 지시를 그대로 따름).

---

## 2026-09-12 통합 리뷰 수정: 재출현 이중 채점 외 4건

- 요지: 위 "등록 주차별 복습 노출 조절 · 연속 듣기 모드" 커밋(아직 미커밋 상태)에 대한 통합 리뷰에서 지적된
  🔴1건·🟡4건·🟢2건을 수정했다. 가장 심각한 건 high 단어의 "세션 내 재출현"이 `finishCard()`를 그대로 타면서
  `applyGrade`가 두 번 호출돼 stage/reps가 이중으로 오르고("집중" 주차가 의도와 반대로 간격이 2배로 밀림) 오늘
  복습 로그도 두 번 찍히던 문제다. 위 항목의 "타협/미해결"에 적어 둔 "재출현은 finishCard가 오답 카드를 다시
  큐에 넣는 패턴과 같은 메커니즘이라 자연스럽게 들어맞았다"는 서술은 틀렸다 — 정확히는 그 재사용이 버그의
  원인이었다.
- 🔴1 (재출현 이중 채점) — 리뷰가 제시한 두 옵션 중 (a) "채점 없는 한 번 더 보기" 채택:
  - 이유: (b)(재출현 제거, high는 우선 배치만)는 "세션 안에서 노출을 2배로 늘린다"는 원래 기능 의도 자체를
    없애 버린다. (a)는 노출 2배는 유지하면서 채점만 분리하면 돼서 변경 범위가 작고, 기존 `finishCard`
    단일 진입점 구조를 그대로 살릴 수 있었다.
  - `buildSessionQueue(index.html)`는 그대로 두고(반환 계약을 바꾸면 기존 week-queue.test.mjs의 참조 동일성
    검증이 깨진다), `startSession()`에서 큐를 `{id, extraView}`로 변환할 때 `Set`으로 "이미 나온 id"를
    추적해 두 번째 등장에만 `extraView:true`를 붙였다(버전 순서에 의존하지 않는 방식 — high가 몇 번째에
    다시 나오든 정확히 동작).
  - `nextCard()`가 꺼낸 항목의 `extraView`를 `session.curExtra`에 반영하고, `finishCard()`는 `curExtra`면
    `applyGrade`·`logToday` 호출 없이 `session.done`만 올리고(진행률 표시용) `session.ok`·SRS·오늘 통계는
    건드리지 않는다.
  - `renderReview()`에 `session.curExtra` 전용 분기 추가 — 채점 버튼 대신 "한 번 더 보기 — 채점하지
    않아요" 안내 + "다음" 버튼(`data-act="extraNext"`) 하나만 렌더. 오답 재시도 큐 push도
    `{id, extraView:false}`로 통일(재시도 카드는 항상 진짜 채점 대상).
  - `filterDueByWeight`/`buildSessionQueue` 위 주석을 실제 동작에 맞게 정정: "대기 카드 수(배지)"와
    "세션 큐 길이"가 다른 건 버그가 아니라 의도된 차이(재출현은 서로 다른 단어 수에 포함되지 않음)라고
    명시했다.
  - **세션 큐 소비 루프 테스트**(`tests/session-queue.test.mjs`, 리뷰 재현 그대로): high 1개 + normal 2개를
    등록해 `buildSessionQueue`가 `[h, n1, n2, h]`를 만드는 걸 먼저 확인한 뒤, `startSession→nextCard→
    finishCard`를 큐가 빌 때까지 그대로 반복 호출해 (1) 채점 횟수(`session.ok`=3, `session.done`=4),
    (2) high 단어 최종 stage(1 — 이중 상승이면 2가 됨), (3) 오늘 로그 횟수(3 — 이중이면 4)를 단언한다.
- 🟡2 (로컬 삭제 시 듣기 큐 미정리) — `applyRemote`의 정리 로직을 `listenPruneQueue()`로 뽑아 로컬 삭제
  (`data-del` 핸들러)에서도 호출하도록 공유. 요청대로 죽은 id를 만나면 **정지 대신 다음 곡으로 건너뛰게**
  동작을 바꿨다(기존엔 현재 곡이 사라지면 무조건 `listenPause()`했다) — 큐가 완전히 빌 때만 멈춘다.
  `listenSpeakCurrent()`의 방어적 `!w` 분기도 동일하게 스킵으로 변경. 재생 전(활성화 안 된 상태) 원격/로컬
  변경 어긋남은 `renderListen()`에 `listenQueueStale()` 검사를 추가해 해결 — 재생 중이 아닐 때 렌더될
  때마다 큐 구성(순서 무시, 집합만 비교)을 현재 범위 설정과 비교해 어긋나면 다시 짠다(단순 이전/다음 탐색
  때 idx가 불필요하게 리셋되지 않도록 "구성"만 비교했다).
- 🟡3 (speechSynthesis 충돌) — 세 지점 모두 처리: ① 탭 전환 핸들러에서 듣기 탭을 벗어나는데 재생 중이면
  `listenPause()`, ② `speak()`, ③ `startListening()` 시작 시 `listen.playing`이면 먼저 `listenPause()`.
  이제 소리를 내는 쪽이 항상 하나로 좁혀진다(듣기 재생 중 복습 탭으로 가면 자동 정지, 복습 중 발음 듣기·
  말하기를 누르면 듣기 재생이 자동 정지).
- 🟡4 ("로컬 전용" 라디오 선택 시 sync 주소 폐기) — 라디오 change 핸들러에 `confirm('연결 주소가 삭제돼요.
  다시 연결하려면 주소가 필요하니 먼저 복사해 두세요.')` 게이트 추가. 취소하면 `settingsUi.storageMode`를
  바꾸지 않고 `render()`만 호출해 라디오가 다시 "서버 연동" 쪽으로 표시되게 했다(원복).
- 🟡5 (extra에도 off 주차 제외) — `startSession(true)`의 후보 배열을
  `shuffle(S.words.filter(w => weekLevelOf(...) !== 'off'))`로 바꿔 off 주차 단어를 애초에 뽑지 않게
  했다. 이전엔 off 단어가 미리 복습에 나와서 오답 처리되면 `applyGrade`의 `result==='fail'` 분기가
  무조건 `stage=0`으로 리셋했는데(휴식 의도와 정반대), 후보에서 빠지므로 그 경로 자체가 막힌다. 새
  `tests/session-queue.test.mjs` 케이스로 "off 단어가 extra 큐에 없다"를 고정.
- 🟢 저비용 2건: ① `listenRequestWakeLock()` — `await` 도중 이미 일시정지됐으면(빠르게 재생→정지) 받은
  wake lock을 즉시 반납하도록 경쟁 상태를 막았다(안 그러면 정지했는데 화면이 계속 켜져 있는 상태가 될 수
  있었다). ② `listenReset()` — 재생 중에 설정(순서/항목 구성/반복/범위)을 바꿀 때 이전 발화 체인을
  끊고(`curTurn` 무효화 + `speechSynthesis.cancel()`) 새 큐의 첫 항목부터 다시 재생하도록 수정(이전엔 재생
  중에 큐만 바뀌고 체인은 안 끊겨 옛 인덱스 기준 콜백이 새 큐 위에서 엉뚱하게 동작할 수 있었다). ③
  (계획엔 없었지만 같은 함수를 만지는 김에) `renderListen()`에서 `scope`가 더 이상 존재하지 않는 주차 키를
  가리키면 "전체"로 되돌리도록 정규화(그 주차 단어가 전부 삭제된 경우 등) — 화면은 "전체"를 보여주는데
  실제 큐는 조용히 비어 있던 불일치를 없앴다.
- 변경 지점 (index.html): `applyRemote()`(session/listen 큐 필터를 `{id,...}` 항목 기준으로), `speak()`,
  `listen` 섹션(`listenReset`, `listenRequestWakeLock`, `listenPruneQueue` 신설, `listenSpeakCurrent`,
  `listenQueueStale` 신설), `filterDueByWeight`/`buildSessionQueue` 주석, `startSession`/`nextCard`/
  `finishCard`, `renderReview()`의 `curExtra` 분기, `renderListen()`, 저장 방식 라디오 핸들러,
  `startListening()`, `.tabs` 클릭 핸들러, `$('#view')` 클릭 위임의 `data-act="extraNext"` 케이스,
  로컬 삭제(`d.del`) 핸들러.
- 검증:
  - 신규 `tests/session-queue.test.mjs` 5개 케이스(사전 조건 확인, 재출현 무채점 소비 루프, high 없는
    정상 소비, 오답 재시도 경로, extra의 off 제외) 전부 통과. index.html의 week/words/session 섹션을
    그대로 `new Function()`으로 추출해 실행(기존 방식 그대로, DOM 의존 `save`/`render`/`toast`만 스텁).
  - 기존 `node tests/sandhi.test.mjs` 12, `node tests/checkword-checkanswer.test.mjs` 23,
    `node tests/week-queue.test.mjs` 18 그대로 통과 — 총 53 + 신규 5 = 58개 전부 통과.
  - `<script>` 3블록(설정 스크립트 16-20줄·손글씨 라이브러리 9728-9738줄·본문 앱 스크립트 9739-11327줄)을
    각각 잘라내 `node --check`로 파싱 — 문법 오류 0.
- 타협/미해결:
  - 재출현 카드의 "다음" 클릭은 `session.done`은 올리지만 `session.ok`는 올리지 않는다 — "복습 N개, M개
    맞았어요" 최종 화면에서 N에는 재출현 노출도 포함되고 M에는 포함되지 않는다. 완전히 노출을 통계에서
    빼는 방안도 고려했지만, 그러면 "남은 카드 N개" 진행률 표시(큐 길이 기반)와 `session.done`이 어긋나
    진행률 바가 100%에 못 미친 채 세션이 끝나 보이는 문제가 생겨 이 쪽을 택했다.
  - 로컬 삭제 시 현재 진행 중인 복습 세션(`session.queue`/`session.cur`)의 정리는 이번에 손대지 않았다 —
    리뷰 🟡2가 명시한 범위는 `listen.queue`뿐이었고, 세션 큐는 `nextCard()`가 존재하지 않는 id를 만나면
    조용히 건너뛰는 기존 방어 로직이 있어 크래시는 나지 않는다(다만 `session.cur`가 삭제된 단어를 가리킨
    채로 남는 이론적 허점은 있다 — 범위 밖이라 그대로 뒀다).
  - `listenQueueStale()`은 순서를 무시하고 "구성(집합)"만 비교한다 — 예를 들어 무작위 순서를 다시 섞고
    싶어서 새로고침한 게 아니라 단순히 화면을 재렌더링했을 뿐인데 순서가 다시 섞이는 일은 없다(의도적:
    이전/다음 탐색 중 idx가 매번 리셋되면 오히려 사용성이 나빠진다).

### 최종 확인 리뷰 반영 (2026-09-12, PM)
- 만점 스탬프 好 도달 불가 해소: session.graded(채점 카운터) 분리 — 스탬프·완료 요약은 채점 기준, 진행률 바는 노출(done) 기준 유지. 재출현 노출 수는 "(한 번 더 보기 N개)"로 표기
- 잔여 💡 2건은 후속: 재출현 카드 autoAudio 미재생 / listenPruneQueue 마지막 항목 삭제 시 직전 단어 1회 재재생 / (기존 결함) wordItemHtml id 보간 esc 미처리 — importIo 자가 XSS 이론 경로
