# Spring 재고 원천 분석 계약

ANL-03의 현재고·수불 정합성 및 Lot 상태/제조·입고일 경과 조회다.
`/analytics/inventory`와 기존 `/inventory/stock`은 같은 실제 API 화면을 사용한다.
분석 조회 자체는 읽기 전용이며 Lot 쓰기·원가·평균재고·사업장 서비스는 추가하지 않는다.
재고 조정은 TODO-012의 별도 `POST /api/core/inventory/adjustments`(실사 수불·감사)로 처리한다.

## API와 필터

`GET /api/core/analytics/inventory/summary`는 모든 인증 역할에 허용하며 비로그인은401이다.
READ_ONLY/REPEATABLE_READ로 요약/행을 같은 스냅샷에서 읽고 재고·감사·상태를 바꾸지 않는다.

| 매개변수 | 규칙 |
| --- | --- |
| from, to | 포함 수불일 기간; 기본 서울 이번 달1일~오늘; 과거부터 오늘까지 최대366일 |
| ageDays | 제조·입고일로부터 경과한 일수 이상, 1~3650, 기본90 |
| itemId | 생략 전체, 양수 품목 PK, 미존재404 |
| itemType | all(기본)/제품/반제품/자재 |
| risk | all(기본)/low(현재고 안전재고 미달)/ledger(수불 차이)/lots(Lot 차이)/aged(경과 Lot 보유) |
| keyword | 최대128자, 품번/품명 부분 검색, 대소문자 무시, `%_!` 문자 그대로 |
| sort | itemNo,asc(기본); itemNo/currentStock/stockLedgerDelta/agedLotQty + asc/desc |
| page, size | page0~10000, size1~100(기본20), 범위 밖 페이지 빈 행 |

유효하지 않은 입력400 INVALID_INPUT/trace ID, 미존재 품목404 ITEM_NOT_FOUND, 쓰기405다.
정렬 동률은 품번/ID로 안정화한다. `asOf`는 UTC 조회시각, `timeZone`은 Asia/Seoul이다.
요약은 위험을 포함한 **모든 필터의 전체 품목 결과**이며 페이지에 영향받지 않는다.

## 계산과 해석

- 현재고는 `items.stock`다. 안전재고 미달은 현재고 `< safety_stock`; 같으면 미달이 아니다.
  기존 `/inventory/stock` API는 수불 합계를 stock으로 반환하므로 이번 화면은 그 API를 사용하지 않는다.
- 수불 합계는 품목별 저장된 모든 `inventory_transactions.qty`의 부호 있는 합이다.
  현재고−수불 합계가 `stockLedgerDelta`이며0이 아니면 정합성 확인 대상으로 표시한다.
  초기잔액·과거 누락을 복원하거나 자동 보정하지 않는다. 미래일 수불도 저장 합계에는 포함하며 별도 건수로 경고한다.
- 기간 증가량은 기간 내 양수 수불 합, 감소량은 음수 합의 절댓값, 순증감은 증가−감소다.
  입고 취소 보상도 부호대로 반영한다. 문서 유형별 총입고/총출고·기간말 재고·원가가 아니다.
  현재고/전체 수불 합계/Lot에는 날짜 필터를 적용하지 않으므로 과거 종료일 잔액을 복원하지 않는다.
- Lot 기록량은 폐기 상태 제외 양수 잔량 합이다. 현재고와 다른 경우 별도 차이 경고한다.
  확인 사용가능 Lot은 정상/유통기한임박, 제조·입고일이 서울 오늘 이하, 만료일 없음 또는 오늘 이상인 양수 잔량이다.
  현재고/예약과 대사되지 않은 참고 원천량이며 확정 출하 가능량이 아니다. 실제 출하 API가 최종 검사한다.
- 보류는 양수 보류 Lot, 만료는 폐기 제외 양수 Lot의 만료일 `< 서울 오늘`이다.
  장기는 폐기 제외 양수 Lot의 `produced_at <= 서울 오늘-ageDays`; 기준일 당일 포함한다.
  `produced_at`은 생산에서는 제조일, 구매입고에서는 입고일이다. 무출고/마지막 이동일로 해석하지 않는다.
  보류·만료·장기는 겹칠 수 있어 합산하지 않는다. 음수 Lot 또는 미래 제조·입고일은 별도 오류 건수다.
- 수불과 Lot은 품목별 별도 사전 집계해 여러 수불×여러 Lot 조인 중복을 방지한다.
  전체 수량 합계/재고 금액/추정 창고는 제공하지 않는다. 행마다 품목 기본 단위를 유지한다.
- 회전율은 매출원가·평균재고 원가 이력이 없어 `inventoryTurnover=null`과 이유를 표시한다.
  기준단가·출하 매출·현재고로 대체하지 않는다. 사업장/창고별 초기잔액과 원가 기반 회전율은 후속 범위다.

## 화면과 연결

공통 달력, 품목 선택, 품번/명 검색, 경과 일수, 유형/위험/정렬/페이지, 현재값 새로고침을 제공한다.
현재값/기간 수불을 구분하고 로딩/빈 결과/trace 오류·재시도, 정합성·이력 경고를 표시한다.
DataContext나 하드코딩 재고/창고 fallback은 없다. 숫자 정렬은 단위가 다를 수 있음을 표시한다.
대시보드에서 품목 ID만 전달하며, 품목 마스터는 `/items?keyword=품번`, 실제 MRP는
`/purchase/mrp?itemId=PK`로 연결한다. 후속 INV-02 읽기 전환으로 실제 `/inventory/lots?itemId=PK`의
Lot 원천 추적에도 연결한다. [Lot 추적 계약](lot-tracing.md)을 따른다.

검증 대상은 `InventorySummaryIntegrationTest`, `inventoryAnalysis.test.ts`, `InventoryAnalysis.test.tsx`,
대시보드/MRP 필터 회귀 및 실제 구매입고/취소 후 브라우저 조회다. 실행 결과는 `phase1-e2e.md`에 기록한다.
이 범위는 INV-01 전체 정합성 복구, INV-02 Lot 상태 쓰기, ANL-03 사업장/회전율의 완료를 뜻하지 않는다.
