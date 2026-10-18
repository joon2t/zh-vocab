# HANDOFF — zh-vocab

## 현재 상태
- 날짜: 2026-10-18
- 작업 기기: Mac
- 상태: v7 연습 중 "이 단어 한 번 더"(같은 단어 반복) main 병합·GitHub Pages 배포 완료(https://joon2t.github.io/zh-vocab/).
- 다음 할 일:
  - 휴대폰에서 연습 모드 직접 확인(손글씨 인식·반복 직후 터치 획, iOS 키보드 포커스, 결과 화면 두 버튼 구분, 음성)
  - 🟢 연습 중 원격에서 단어 삭제 시 요약의 "풀지 않았어요"/"틀린 N개" 숫자 불일치 (`practiceSummaryHtml`)
  - 🟢 같은 패드 안 시도 변경(`padPick` 다음 글자, `padClear`) 시 늦은 Claude 인식 응답이 빈 패드에 후보로 뜸 — gen 증가 시 busy 리셋·버튼 재활성화 함께 필요
  - e2e `practice.e2e` [11] 날짜 기대값 고정 필요(실제 시계 의존)
  - 기존 테스트 실패 2건 정리: review-fixes-0913 wordItemHtml(isCJK 미주입), stroke-chars hasStrokeData("toString")

## 참고
- 변경 이력: `docs/BUILD_LOG.md`
