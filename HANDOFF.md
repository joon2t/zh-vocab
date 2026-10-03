# HANDOFF — zh-vocab

## 현재 상태
- 날짜: 2026-10-03
- 작업 기기: Mac
- 상태: v6 단어 연습 모드 main 병합·GitHub Pages 배포 완료(https://joon2t.github.io/zh-vocab/).
- 다음 할 일:
  - 휴대폰에서 연습 모드 직접 확인(손글씨 인식, 터치, 키보드가 카드 가림 여부, 음성)
  - 🟢 결과 화면에서 "그만하기" 누르면 방금 푼 카드가 집계에서 빠짐 (`practiceAct` prQuit)
  - 🟢 연습 중 원격에서 단어 삭제 시 요약의 "풀지 않았어요"/"틀린 N개" 숫자 불일치 (`practiceSummaryHtml`)
  - 기존 테스트 실패 2건 정리: review-fixes-0913 wordItemHtml(isCJK 미주입), stroke-chars hasStrokeData("toString")

## 참고
- 변경 이력: `docs/BUILD_LOG.md`
