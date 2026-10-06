# Lot 원천 추적 — INV-02 읽기 범위

`/inventory/lots`의 하드코딩 목록을 Spring 조회로 전환한다. 등록·보류·해제 UI는
별도 후속 단위다(TODO-011). 폐기는 TODO-010에서 연결했다. INV-02 전체 완료가 아니다.

## API

- `GET /api/core/lot-traces`: Spring Page 응답. `itemId`(양수 PK), `status`(정상/보류/유통기한임박/폐기,
  생략 또는 빈 값 전체), `warehouse`(최대32자, 앞뒤 공백 제거 후 정확 일치), `keyword`(최대128자,
  Lot 번호/품번/품명 부분 검색, `%_!` 문자 그대로), `sort`(lotNo/qty/producedAt/expiry + asc/desc,
  기본 lotNo,asc), `page`0~10000, `size`1~100(기본20). 동률은 Lot 번호/ID, NULL 만료일은 마지막이다.
- `GET /api/core/lot-traces/{id}`: Lot·기준시각·서울 날짜·연결 수불 Page·계산 제약의 단일 응답.
  수불 `page`0~10000/`size`1~100(기본20), 수불일 내림차순/ID 내림차순. 과거 페이지를 조회해도 Lot은 현재 잔량이다.
- 모든 인증 역할은 읽을 수 있으며 비로그인은401, 잘못된 입력400 INVALID_INPUT/trace,
  미존재 Lot404 LOT_NOT_FOUND·필터 품목404 ITEM_NOT_FOUND, 지원하지 않는 쓰기405다.
- 두 조회는 REPEATABLE_READ 읽기 전용 트랜잭션이다. 기존 `/lots` 배열 API는 출하 선택 호환성을 위해
  그대로 유지하며 기존 `/lots/{id}/hold|release|dispose` 계약/동작을 이번 단위에서 변경하지 않는다.
  마이그레이션·과거 데이터 복원·재고/감사 쓰기는 없다.

## 원천 정의

Lot의 잔량·창고·상태·제조/입고일·만료일은 저장된 값이다. 수량은 품목 기본 단위이며 혼합 단위 총량은 없다.
예약/현재고 대사 후 출하 가용량, FIFO/FEFO 자동 선택, 창고별 초기잔액/원가는 제공하지 않는다.

서울 오늘보다 만료일이 이전이면 `expired`, 오늘부터30일 이내(양 끝 포함)이면 `expiringSoon`이다.
만료일 없음은 둘 다 false다. 저장된 상태를 날짜로 덮어쓰지 않는다. 음수 잔량 또는 미래 제조/입고일은
`invalid` 경고이며 자동 보정하지 않는다. 9999-12-31 같은 기존 sentinel도 원천값 그대로 표시한다.

수불은 `inventory_transactions.lot_id`의 명시적 연결만 읽는다. 수불별 품목 ID/단위와 부호를 보존하며
Lot 품목과 다르면 화면에서 경고한다. 입출고 총량이나 원가로 바꾸어 해석하지 않는다.

| sourceType | 연결 근거 |
| --- | --- |
| RECEIVING | 동일 Lot·품목의 `receivings.inventory_txn_id` 또는 `reversal_txn_id` |
| WORK_ORDER | 저장된 ref_type=WORK_ORDER/ref_no=작업오더 번호, 동일 Lot/수불/오더 품목, 양수 생산입고 |
| SHIPMENT | 동일 Lot·품목의 `shipments.inventory_txn_id` |
| UNLINKED | 위 근거가 없음; sourceId/sourceNo 명시적 null, 저장된 refType/refNo는 그대로 제공 |

입고/출하 FK와 작업오더 번호는 각각 유일한 원천을 가리킨다. Lot 번호 접두사, 날짜, 품명, 비슷한 수량으로
과거 원천을 추정하지 않는다. 연결 수불이 없는 과거 Lot은 빈 수불과 안내를 제공한다.
작업오더 연결은 직접 FK가 아닌 저장된 참조 번호라는 한계를 유지한다.

## UI와 검증

공통 원격 DataTable의 검색/정렬/페이지, 실제 품목 선택, 상태/기록 창고 필터, 새로고침,
로딩/빈 상태/공통 오류·trace/재시도와 접근 가능한 상세 Dialog를 제공한다.
재고 분석→Lot 목록은 itemId를 전달하고, 상세의 확인 원천만 실제 입고/작업오더/출하 화면의 keyword로 연결한다.
명시적 sourceId/sourceNo가 없는 원천에는 링크를 만들지 않는다. 메모리/하드코딩 fallback과 작동하지 않는 쓰기 버튼은 없다.

검증 대상: `LotTraceIntegrationTest`, `lotTraces.test.ts`, `LotTracePage.test.tsx`, 입고/출하 URL 검색 및
재고 분석 연결 회귀, 실제 Chromium의 생산→출하/입고→취소 추적. 실행 결과는 `phase1-e2e.md`에 기록한다.
