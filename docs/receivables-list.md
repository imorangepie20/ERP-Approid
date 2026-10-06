# 미수금 목록 조회 계약 (TODO-001)

2026-10-04. TODO-001의 목록 계약이며 TODO-002 수납 확장은 [수납 계약](receivables-collections.md)을 따른다. FIN-01 전체 완료는 아니다.

## API

- `GET /api/core/receivables`: 기존 Spring Page 응답을 유지한다.
- `GET /api/core/receivables/summary`: 목록 필터와 무관한 **전체** 미수/연체 문서 원금과 실제 잔액 요약이다.
- 두 읽기 API는 ADMIN/SALES/ACCOUNTING만 허용한다. 무인증 401, 다른 역할 403이다.
- 목록 필터: `customerId` 양수 (없는 양수 ID는 빈 목록), 저장 `status` = 미수/수납완료/연체,
  날짜 기준 `overdue=true|false`, `keyword` 128자 이하. 빈 상태/검색은 전체다.
- 검색은 청구번호/고객명/실제 연결 수주번호에 대소문자 무시 부분 일치하며 `%`, `_`, `!`는 리터럴이다.
- `page=0..10000`, `size=1..100`; 기본 0/20. `sort=receivableNo|amount|dueDate|status,asc|desc`.
  기본 `receivableNo,asc`, 동일 값은 ID 오름차순으로 구분한다. 잘못된 입력은 INVALID_INPUT/400과 Trace ID다.
- 목록 조회와 요약 각각 REPEATABLE_READ 읽기 전용 트랜잭션이다. 두 요청 사이 동시 변경까지 같은 스냅샷이라고 보장하지 않는다.
- `referenceDate`는 서버의 Asia/Seoul 오늘이다. 미수납이고 양수 잔액이며 수납기일이 기준일보다 이전일 때만 연체다.
  연체일은 두 날짜 차이, 그 외 0이다. 기일 당일/미래일/수납완료는 비연체다.
  오래된 저장 `overdue_days`와 상태를 자동 수정하지 않는다. 저장 상태 '연체'와 날짜 연체는 다를 수 있다.
- 수주 없는 과거 미수도 포함한다. `salesOrderId`/`salesOrderNo`는 명시적 null이며 원천을 추정하지 않는다.
- 원금은 정수 KRW다. 기존 `openAmount`/`overdueAmount`는 해당 문서의 원금 합계를 유지한다.
  TODO-002의 `openBalance`/`overdueBalance`는 총 수납을 차감한 현재 잔액이며 기간별 현금흐름이 아니다.
  행은 `collectedAmount`/`openingCollectedAmount`/`remainingAmount`를 함께 제공한다.

## 화면과 후속 범위

`/sales/receivables`는 공통 JWT 클라이언트와 TanStack Query로 실제 API만 읽는다.
고객 마스터 필터, 저장 상태, 날짜 연체, 서버 검색/정렬/페이지를 제공한다.
필터/페이지 크기/정렬 변경 시 첫 페이지로 돌아가고, 마지막 페이지가 사라지면 유효 페이지로 보정한다.
목록·전체 요약·고객 선택 오류는 각각 Trace ID와 재시도를 표시한다. 요청 취소 신호를 전달하며 예시 배열로 대체하지 않는다.
명시적 연결 수주는 실제 수주 검색으로 이동하고 null은 '미연결'로 표시한다.
안전한 정수 범위를 벗어난 금액, 잘못된 날짜/상태/연체일/응답은 오류로 처리한다.
독촉 검토 버튼은 [대상·수신자 확인 모달](receivables-reminders.md)을 연다. 실제 발송은 비활성 '준비 중'이며 구현하지 않은 내보내기는 숨긴다.

TODO-002 전액/부분수납·잔액 이력은 [새 필수 POST 본문·수납 계약](receivables-collections.md)으로 확장했다.
TODO-003은 화면 검토만 제공하며 TODO-004/047 실제 메시지 발송은 미완료다.

## 검증 경로

- `ReceivableListIntegrationTest`: 리터럴 검색/필터/페이지/수주 null·실제 연결/한국 날짜/전체 요약/권한/400/읽기 불변성/OpenAPI.
- 기존 `ShipmentIntegrationTest`, `SalesSummaryIntegrationTest`: 출하 미수 연결과 분석 소비자 회귀.
- `src/api/receivables.test.ts`: JWT/취소/응답 경계·잘못된 금액/날짜/상태/요약.
- `src/pages/sales/SalesReceivables.test.tsx`: 실제 조회, 필터·페이지, 오류·재시도, 역할 차단, 미연결, 접근성.
- `src/components/common/DataTable.test.tsx`: 기존 기본 동작과 선택적 내보내기·검색 라벨.

자동 생성 타입은 통합 테스트가 실제 Springdoc에서 저장한 `backend-spring/build/openapi-receivables.json`으로 생성한다.
생성 후 TypeScript/변경 파일 ESLint/문서 diff를 검증한다. 이 변경은 아직 배포된 `156f2a6` 릴리스에 포함되지 않는다.
