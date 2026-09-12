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
