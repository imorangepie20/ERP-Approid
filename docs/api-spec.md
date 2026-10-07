# ERP-Approid API 명세서 (OpenAPI 3.1)

| 항목 | 내용 |
| --- | --- |
| 문서 버전 | v1.0 |
| 작성일 | 2026-09-20 |
| 선행 문서 | 아키텍처 v1.0, `docs/db-schema.md` (ERD v1.0) |
| 명세 형식 | OpenAPI 3.1 (JSON/YAML) |
| 범위 | Phase 1 MVP |

---

## 1. 서버 (Servers)

2026-10-04 실행 계약: Phase 1 대시보드/MRP는 **Spring `/api/core/analytics`**에서 기존 JWT로 제공한다.
아래 별도 FastAPI 주소/타입 생성 예시는 원래 설계이며 실행 서버가 아니다. 실제 Core 타입은
`hud-admin-template`에서 `npm run generate:api-types`로 `src/api/generated/core.ts`에 생성한다.

| 환경 | Spring (core) | FastAPI (analytics) |
| --- | --- | --- |
| 로컬 | `http://localhost:38080/api/core` | `http://localhost:38000/api/analytics` |
| 프론트 env | `VITE_API_CORE_URL` | `VITE_API_ANALYTICS_URL` |

두 서비스는 각각 독립된 OpenAPI 문서를 노출한다:
- Spring: `http://localhost:38080/v3/api-docs` (springdoc-openapi)
- FastAPI: `http://localhost:38000/openapi.json` (내장)

프론트는 `openapi-typescript`로 각 문서에서 타입을 생성한다:
```bash
npx openapi-typescript http://localhost:38080/v3/api-docs -o src/api/core.d.ts
npx openapi-typescript http://localhost:38000/openapi.json -o src/api/analytics.d.ts
```

---

## 2. 공통 규약

### 2.1 요청 헤더

| 헤더 | 필수 | 비고 |
| --- | --- | --- |
| `Authorization: Bearer {JWT}` | 보호 자원 | HS256, 만료 60분 |
| `X-Internal-Key: {key}` | `/internal/*` 전용 | FastAPI → Spring 내부 호출 |
| `X-Trace-Id` | 선택 | 안전한 문자(`[A-Za-z0-9._:-]`) 1~64자는 보존, 그 외에는 서버가 32자 ID로 교체 |

`X-Trace-Id`는 API 로그와 감사 로그의 상관관계 조회에만 사용하며 인증·인가나 보안 판정의
식별자로 사용하지 않는다. 모든 응답은 실제 적용된 값을 같은 헤더로 반환한다.

### 2.2 공통 오류 응답

```json
{
  "code": "SALES_ORDER_NOT_FOUND",
  "message": "수주를 찾을 수 없습니다: SO-2609-009",
  "timestamp": "2026-09-20T14:30:00+09:00",
  "traceId": "a1b2c3d4"
}
```

| HTTP | code | 의미 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Bean/Pydantic 검증 실패. `errors[]` 필드 포함 |
| 401 | `UNAUTHORIZED` | 토큰 없음/만료 |
| 403 | `FORBIDDEN` | 권한 부족 (롤 불일치) |
| 404 | `*_NOT_FOUND` | 리소스 없음 |
| 409 | `INVALID_STATE_TRANSITION` | 도메인 상태 충돌 (예: 출하완료 수주 재확정) |
| 422 | `BUSINESS_RULE_VIOLATION` | 도메인 규칙 위반 (예: 양품 0건인 작업오더 완료) |
| 503 | `UPSTREAM_UNAVAILABLE` | FastAPI → Spring 내부 호출 실패 |

### 2.3 페이지네이션

요청:
| 파라미터 | 기본 | 제약 |
| --- | --- | --- |
| `page` | 0 | 0-base |
| `size` | 20 | 최대 200 |
| `sort` | (없음) | `field,direction` (예: `createdAt,desc`) |

응답 (Spring 표준 페이지):
```json
{
  "content": [ /* DTO 배열 */ ],
  "pageable": { "pageNumber": 0, "pageSize": 20 },
  "totalElements": 8,
  "totalPages": 1
}
```

FastAPI 집계 엔드포인트는 페이지네이션 없이 전체 집계를 반환한다.

---

## 3. 인증 (Spring)

### POST /auth/login
로그인 및 JWT 발급.

요청:
```json
{ "username": "admin", "password": "string" }
```

응답 `200`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": 1, "username": "admin", "name": "김대표",
    "roles": ["ADMIN"]
  }
}
```

오류: `401 UNAUTHORIZED`

### GET /auth/me
현재 사용자 정보. 응답 `200`: `UserResponse` (위 `user` 객체).

서버는 JWT의 서명·만료·subject를 검증한 뒤 DB에서 현재 사용자 상태와 역할을 다시 읽는다.
비활성·삭제 사용자는 `401 UNAUTHORIZED`이며, 발급 뒤 변경된 역할은 다음 요청부터 반영된다.

**롤 정의** (`desc.md` 1.4 대상 사용자):

| 롤 | 코드 | Phase 1 접근 |
| --- | --- | --- |
| 대표이사 | `ADMIN` | 전 모듈 조회 + 승인 |
| 영업 담당자 | `SALES` | 견적/수주/출하/미수 |
| 생산관리자 | `PRODUCTION` | 생산계획/작업오더 |
| 자재/구매 담당자 | `MATERIAL` | 발주/입고/재고 |
| 품질 담당자 | `QUALITY` | Phase 2 (Phase 1 조회만) |
| 회계 담당자 | `ACCOUNTING` | Phase 3 |

---

## 4. 마스터 (Spring)

### 4.1 품목 — /items

#### GET /items
품목 목록. 권한: 인증된 사용자.

쿼리: `page`, `size`, `sort`, `itemType`(제품/반제품/자재), `keyword`(품번/품명)

응답 `200`: `Page<ItemResponse>`
```json
{
  "id": 5, "itemNo": "M-S001", "name": "강판 3.0mm",
  "spec": "SS400 1200×2400", "category": "소재", "itemType": "자재",
  "unit": "SHT", "price": 78000, "stock": 210, "safetyStock": 80,
  "leadTimeDays": 10
}
```

#### POST /items
권한: `ADMIN`. 응답 `201`: `ItemResponse`. 오류: `400`, `409 ITEM_NO_DUPLICATE`.

요청:
```json
{
  "itemNo": "M-S001", "name": "강판 3.0mm", "spec": "SS400 1200×2400",
  "category": "소재", "itemType": "자재", "unit": "SHT",
  "price": 78000, "safetyStock": 80, "leadTimeDays": 10
}
```

#### GET /items/{id}
응답 `200`: `ItemResponse`. 오류: `404 ITEM_NOT_FOUND`.

#### PATCH /items/{id}
권한: `ADMIN`. 부분 수정 (가격/안전재고/리드타임 등). 응답 `200`: `ItemResponse`.

> 가격 변경은 `audit_logs.sensitive = true`로 기록 (`desc.md` 3.12).

#### DELETE /items/{id}
권한: `ADMIN`. 오류: `409 ITEM_IN_USE` (BOM/재고 참조 중).

> `db-schema.md`의 `ON DELETE RESTRICT`는 DB 최후 방어선이다.
> 서비스는 삭제 전 참조 존재 여부를 검사하여 도메인 예외
> (`409 ITEM_IN_USE`)로 변환한다 (DataIntegrityViolationException 노출 금지).

### 4.2 거래처 — /partners

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/partners` | 인증 | 목록. 쿼리: `partnerType`, `keyword` |
| POST | `/partners` | `ADMIN`, `SALES` | 생성 |
| GET | `/partners/{id}` | 인증 | 상세 |
| PATCH | `/partners/{id}` | `ADMIN`, `SALES` | 수정 |
| DELETE | `/partners/{id}` | `ADMIN` | `409 PARTNER_IN_USE` |

### 4.3 BOM — /boms

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/boms` | 인증 | Page 응답. `parentId`, `keyword`, `page`, `size`, `sort` |
| POST | `/boms` | `ADMIN`, `PRODUCTION` | 생성. `409 BOM_DUPLICATE` (번호 또는 parent+child), `409 BOM_CYCLE` |
| PATCH | `/boms/{id}` | `ADMIN`, `PRODUCTION` | `qty`, `lossRate`, `substituteNo` 부분 수정. 번호/구성 불변 |
| DELETE | `/boms/{id}` | `ADMIN` | 삭제. 없는 ID는 `404 BOM_NOT_FOUND` |

`page`는 0~10000, `size`는 1~100(기본 20), `sort`는 `속성,asc/desc`다. 기본 `bomNo,asc`이며
허용 속성은 `bomNo`, `parent.itemNo`, `child.itemNo`, `qty`, `lossRate`, `substituteNo`다.
검색은 BOM 번호와 모/자품목 품번·품명에 적용하며 `%`, `_`를 리터럴로 처리한다.
소요량은 양수/소수 4자리, 손실률은 0~100%/소수 2자리, 번호/대체 품번은 32자 이하다.
모품목은 제품/반제품이다. 대체자재는 선택적 품번 문자열이며 `""`로 지운다. 빈 PATCH는 400이다.
동시 graph 쓰기는 트랜잭션 advisory lock으로 직렬화해 순환 검사를 보장한다.
분석용 `/internal/boms`는 같은 DB의 소요량·손실률·대체자재 품번을 반환한다.

### 4.4 공정 — /routings

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/routings` | 인증 | Page 응답. `itemId`, `keyword`, `page`, `size`, `sort` |
| POST | `/routings` | `ADMIN`, `PRODUCTION` | 생성. `409 ROUTING_SEQ_DUPLICATE`, `409 ROUTING_NO_DUPLICATE` |
| PATCH | `/routings/{id}` | `ADMIN`, `PRODUCTION` | `seq`, `process`, `workCenter`, `stdTime`, `isSubcontract` 부분 수정 |
| DELETE | `/routings/{id}` | `ADMIN` | `409 ROUTING_IN_USE` |

페이지 범위는 BOM과 같다. 기본 정렬은 `routingNo,asc`, 허용 속성은 `routingNo`, `item.itemNo`,
`seq`, `process`, `workCenter`, `stdTime`, `isSubcontract`다. 검색은 번호·품번·품명·공정명·작업장이다.
번호/품목은 불변, 순서는 양수, 표준시간은 품목 1단위당 시간(h), 0 이상/소수 3자리다.
공정 번호/작업장은 32자, 공정명은 64자 이하다. 제품/반제품만 등록할 수 있다.
빈 PATCH는 400, 없는 ID는 `404 ROUTING_NOT_FOUND`, 작업오더 스냅샷 참조 중 삭제는 409다.

---

## 5. 영업·수주 (Spring)

### 5.1 견적 — /quotations

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/quotations` | 인증 | 페이지 응답. `status`, `customerId`, `keyword`, `page`, `size`, `sort` |
| POST | `/quotations` | `ADMIN`, `SALES` | 생성. 상태 `작성중` |
| GET | `/quotations/{id}` | 인증 | 상세 |
| PATCH | `/quotations/{id}` | `ADMIN`, `SALES` | 부분 PATCH. `작성중`만 수정 가능 |
| DELETE | `/quotations/{id}` | `ADMIN`, `SALES` | `작성중`만 |
| POST | `/quotations/{id}/send` | `ADMIN`, `SALES` | `작성중` → `발송완료`. 이메일 전송 아님 |

목록은 `Page<QuotationResponse>`, 기본 정렬은 `quotationNo,desc`다. 정렬 허용값은
`quotationNo`, `customer.name`, `item.itemNo`, `qty`, `unitPrice`, `amount`, `dueDate`, `validUntil`, `status`다.
두 영업 목록은 page 0~10000/size 1~100, 상태·고객사 필터와 번호/고객사 코드·이름/품번·품명 검색을 지원한다.
검색의 `%`/`_`는 와일드카드가 아닌 문자로 취급한다. 지원하지 않는 정렬/상태/페이지는 400이다.

생성은 `quotationNo`, `customerId`, `itemId`, `qty`, `unitPrice`, `dueDate`, `validUntil`을 받는다.
고객사/제품 유형만 허용하며 번호는 32자, 수량은 양수/소수 4자리, 단가는 양의 정수 원화다.
단가·계산 금액은 9,007,199,254,740,991원 이하다. 금액은 수량×단가, 원 미만 버림이다.
수정은 `QuotationUpdateRequest`의 `qty`, `unitPrice`, `dueDate`, `validUntil`만 받으며 빈 PATCH는 400이다.
번호·고객사·품목은 불변이고 단일 수량/단가 수정에도 금액을 재계산한다.
번호 중복은 `QUOTATION_NO_DUPLICATE` 409, 유효기간(KST)이 지난 발송/전환은 `QUOTATION_EXPIRED` 409다.
응답에는 문서 생성 당시 `paymentTerms`, `leadTimeDays`가 포함된다.

### 5.2 수주 — /sales-orders

#### GET /sales-orders
쿼리: `status`, `customerId`, `keyword`, `page`, `size`, `sort`

`Page<SalesOrderResponse>`, 기본 `salesOrderNo,desc`. 정렬 허용값은 `salesOrderNo`, `customer.name`,
`item.itemNo`, `qty`, `unitPrice`, `amount`, `dueDate`, `orderedAt`, `status`다.
응답은 원견적 ID/번호, 조건 스냅샷 `paymentTerms`/`leadTimeDays`, 연결 `workOrderNos` 배열을 포함한다.

#### POST /sales-orders
권한: `ADMIN`, `SALES`. 신규 수주 (견적 없이 직접 등록). 응답 `201`: `SalesOrderResponse`.
`salesOrderNo`, `customerId`, `itemId`, `qty`, `unitPrice`, `dueDate`, 선택적 `orderedAt`을 받는다.
검증/금액 규칙은 견적과 같고 번호 중복은 `SALES_ORDER_NO_DUPLICATE` 409다.
직접 등록의 `quotationId`는 400이며 견적 전환 전용 endpoint를 사용해야 한다.

#### POST /sales-orders/from-quotation/{quotationId}
권한: `ADMIN`, `SALES`. **흐름 1: 견적 → 수주**.

응답 `201`: `SalesOrderResponse`. 오류:
- `404 QUOTATION_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION` (견적이 `작성중`/`만료`/`수주완료`인 경우)
- `409 QUOTATION_EXPIRED` (발송 상태라도 유효기간이 지난 경우)

견적은 `수주완료`로, 수주는 `대기`로 생성된다. 견적의 조건을 복사하며 원본 행 잠금으로 중복 전환을 방지한다.

#### POST /sales-orders/{id}/confirm
권한: `SALES`, `ADMIN`. **흐름 2: 수주 확정 → 작업오더 생성**.

응답 `200`:
```json
{ "salesOrder": { /* SalesOrderResponse */ }, "workOrderNo": "WO-2610-007", "workOrderId": 7 }
```

오류:
- `404 SALES_ORDER_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION` (status !== `대기`)
- `422 BUSINESS_RULE_VIOLATION` (`ITEM_NOT_PRODUCIBLE` — 품목 유형이 제품이 아님)

수주 `대기` → `확정`, 작업오더가 `지시` 상태로 생성된다.

#### 기타
| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/sales-orders/{id}` | 인증 | 상세 |
| PATCH | `/sales-orders/{id}` | `SALES`, `ADMIN` | `대기`만. `SalesOrderUpdateRequest`: qty/unitPrice/dueDate |
| DELETE | `/sales-orders/{id}` | `SALES`, `ADMIN` | 연결 견적·작업오더 없는 직접 대기 수주만. 참조는 `409 IN_USE` |
| POST | `/sales-orders/{id}/cancel` | `SALES`, `ADMIN` | 작업오더 없는 `대기` → `취소`. 작업 전 `확정`은 연결 작업오더와 함께 보상 취소. 진척·출하 건은 `409 IN_USE` |

번호·고객사·품목·수주일·원견적은 수정하지 않는다. 빈 PATCH는 400이다. 확정/수정/취소/삭제는
원본 행 잠금을 사용한다. 확정 취소는 출하가 없고 연결 작업오더가 모두 빈 `지시`(무실적·무불출·미착수)일 때만
허용하며 작업오더도 함께 `취소`한다(행 보존). 출하완료 수주와 확정 출하의 반품·역매출 보상은 후속 범위다.
V12 이전 문서의 조건은 현재 거래처/원견적 기준으로 보완한 값이며 역사적 조건을 재구성한 값은 아니다.

### 5.3 출하 — /shipments

#### GET /shipments
권한: 인증 사용자. 쿼리: `status`, `customerId`, `salesOrderId`, `itemId`, `keyword`, `page`, `size`, `sort`.
검색은 출하번호·고객사 코드/이름·품번/품명이다. page=0~10000, size=1~100.
정렬 허용: `shipmentNo`, `salesOrder.salesOrderNo`, `customer.name`, `item.itemNo`, `qty`, `amount`, `deliveryDate`, `status`.
기본 정렬 `shipmentNo,desc`. 응답은 Spring Page이며 상세와 함께 Lot·출고·미수 번호를 제공한다.

#### POST /shipments
권한: `SALES`, `ADMIN`. 출하 지시 생성. 응답 `201`: `ShipmentResponse`.
요청:
```json
{
  "salesOrderId": 4, "lotId": 1, "qty": 60, "deliveryDate": "2026-10-15",
  "vehicle": "화물차 11T", "trackingNo": "운송장번호"
}
```
수량은 양수·소수 4자리·정수부 14자리 이하다. 차량/송장은 각각 64자 이하.
확정/생산중 수주만 허용한다. 취소 제외 누적 출하 지시량은 수주량 이하다.
한 출하에 같은 품목의 Lot 하나를 선택한다. 정상/유통기한임박·미만료·양수 잔량 Lot만 허용한다.
품목 현재고와 선택 Lot 잔량을 함께 검증한다. 지시/배차/출발은 재고를 예약하거나 차감하지 않는다.
오류: `400 INVALID_INPUT`, `409 INVALID_STATE_TRANSITION`/`IN_USE`,
`422 BUSINESS_RULE_VIOLATION`/`INSUFFICIENT_STOCK`, 없는 수주/품목/Lot는 404.

#### POST /shipments/{id}/confirm
권한: `SALES`, `ADMIN`. **흐름 5: 출하 확정 → 매출 반영**.

응답 `200`:
```json
{
  "shipment": { /* ShipmentResponse */ },
  "inventoryTxnNo": "IVT-2610-0005",
  "receivableNo": "RV-2610-001"
}
```

실행 결과 (단일 트랜잭션):
1. 배차/출발만 확정한다. 출하→`출하완료`, `confirmedDate`=KST 오늘. 배송 예정일은 유지한다.
2. 누적 확정량=수주량일 때만 수주→`출하완료`. 부분 출하는 기존 확정/생산중 상태를 유지한다.
3. 같은 품목의 Lot 잔량과 `items.stock`을 차감하고, 실제 Lot/창고의 음수 출하 이력을 생성한다.
4. 출하별 `receivables`를 생성한다. 수납기일은 KST 확정일+수주 문서의 `paymentTerms` 스냅샷이다.
5. 출하에 Lot·출고·미수 FK를 보관한다. 금액은 수량×수주 단가의 원 미만 버림이며,
   마지막 출하는 수주 금액−기존 확정 금액으로 정수 원화 차이를 정산한다.
6. SHIPMENT/SALES_ORDER/ITEM/LOT/INVENTORY_TRANSACTION/RECEIVABLE 감사 6건을 같은 트랜잭션에 저장한다.
   출하→수주→품목→Lot 행 잠금으로 중복 확정·재고 유실/초과 출하를 막으며 감사 실패도 전체 롤백한다.

회계 전표 생성은 아직 구현하지 않는다. 출하 금액과 미수 원금을 매출 원천으로 사용하고 전표 연계는 ACC 후속 범위다.
V15 이전 Lot/출고/미수 연결은 추정하지 않는다. 과거 지시/배차는 실제 Lot을 확인해 PATCH한 후 진행할 수 있다.
과거 확정 출하는 읽기 전용이며 재확정/취소하지 않는다. FIFO/FEFO 자동 선택, 다중 Lot 문서,
확정 이후 반품·역매출·재고 보상, idempotency key는 후속 범위다.

오류: `409 INVALID_STATE_TRANSITION`, `422 INSUFFICIENT_STOCK`

#### 기타
| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/shipments/{id}` | 인증 | 상세 |
| PATCH | `/shipments/{id}` | `SALES`, `ADMIN` | `지시`/`배차`만. qty/Lot/예정일/차량/송장 부분 수정, 수주 불변. 빈 요청 400 |
| DELETE | `/shipments/{id}` | `SALES`, `ADMIN` | 이력 보존을 위해 항상 409 IN_USE (없는 ID 404) |
| POST | `/shipments/{id}/dispatch` | `SALES`, `ADMIN` | `지시` → `배차` |
| POST | `/shipments/{id}/depart` | `SALES`, `ADMIN` | `배차` → `출발`, KST 출발일 저장 |
| POST | `/shipments/{id}/cancel` | `SALES`, `ADMIN` | `지시`/`배차` → `취소`, 이력 보존·누적 지시량 해제 |

### 5.4 미수금 — /receivables

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/receivables` | `SALES`, `ACCOUNTING`, `ADMIN` | 고객/상태/한국 날짜 연체/리터럴 검색, 서버 정렬·페이지 |
| GET | `/receivables/summary` | `SALES`, `ACCOUNTING`, `ADMIN` | 전체 문서 원금과 현재 미수/연체 잔액 요약 |
| GET | `/receivables/{id}` | `SALES`, `ACCOUNTING`, `ADMIN` | 현재 미수와 최신순 서버 페이지 수납 이력 |
| GET | `/receivables/{id}/reminder-preview` | `SALES`, `ACCOUNTING`, `ADMIN` | 동일 읽기 스냅샷의 현재 미수·거래처 연락처. 검토 전용이며 발송하지 않음 |
| POST | `/receivables/{id}/reminders` | `ACCOUNTING`, `ADMIN` | 등록·허용된 EMAIL 연락처와 최신 snapshotHash 확인 후 QUEUED 저장. 신규 202, 동일 처리자·키·입력 재조회 200 |
| GET | `/receivables/{id}/reminders` | `SALES`, `ACCOUNTING`, `ADMIN` | 요청 이력 서버 페이지, 기본 20·최대 100 |
| GET | `/messages/{uuid}` | `SALES`, `ACCOUNTING`, `ADMIN` | 저장한 수신자·본문·잔액 스냅샷과 실제 상태·시도 이력 |
| POST | `/receivables/{id}/collect` | `ACCOUNTING`, `ADMIN` | `{amount,collectedOn,requestId}` 필수, 전액·부분수납; 동일 요청 재전송 중복 방지 |

한국 기준일보다 기일이 이전이고 양수 미수 잔액인 경우만 날짜 연체다. 본문 없는 이전 collect는 400이며
새 응답은 `{receivable,collection,replayed}`다. 상세 필터는 [목록 계약](receivables-list.md),
금액/키/이력/오류/마이그레이션은 [수납 계약](receivables-collections.md)을 따른다.
[독촉 검토 모달](receivables-reminders.md)은 TODO-003이며 확인은 미발송/미저장이다. 실제 이메일 요청·발송·이력은 TODO-004로 EMAIL-01~07에 구현했다. SMS 실제 발송과 공통 공급사 기반은 TODO-047 후속이다.

EMAIL-03의 서버 요청 API는 독촉 모달에 연결했다.
preview는 기존 필드에 `messageContact`, `snapshotHash`, `emailDispatchEnabled`, `emailSubject`, `emailBody`를 추가한다.
요청 입력은 `{requestId,contactId,expectedSnapshotHash,note,acknowledged}`다. 서버가 단일 수신자와
잔액 본문을 생성하고 UUID·요청 actor/Trace ID·15분 만료·필수 감사를 같은 트랜잭션에 저장한다.
같은 키에 다른 입력/처리자는 409, 최신 스냅샷 변경·active/UNKNOWN·서울 날짜 당일 접수 중복도 409,
비연체/미허용 연락처는 422, 설정 비활성은 503이다. 기본 발송은 비활성이며 SMTP adapter·자동/수동 재시도·
lease 복구·화면 연결은 EMAIL-05~07에 구현했다. 상세 기록은 [이메일 발송 구현 기록](receivables-email-delivery.md)을 따른다.
`MESSAGE` 감사의 `entity_no`는 UUID 하이픈만 제거한 32자 소문자 hex다. UUID 비트는 손실되지 않으며
API/메시지 PK와 감사 `after_json.id`에는 원래 UUID를 유지한다. 기존 VARCHAR(32)와 migration은 변경하지 않는다.
큐 저장은 발송 성공이 아니다. EMAIL-04 worker는 한 번에 한 건의 QUEUED 메시지를 skip-locked로
확보하고 120초 lease/token을 저장한다. 5초 간격 poll은 최대 10건이다. 발송 직전 미수→거래처→연락처→
메시지 잠금 순서로 최신 잔액/hash·허용·만료·현재 요청자의 활성 계정과 ADMIN/ACCOUNTING 역할을 확인한다.
변경/만료는 STALE, 권한 회수는 FAILED다. 시도와 감사·DISPATCHING을 커밋한 뒤 트랜잭션 밖에서
transport를 호출하므로 그동안 수납을 예약하거나 막지 않는다. 같은 token의 결과만 한 번 저장한다.
불명확한 오류는 UNKNOWN이며 재전송하지 않는다. 명시적 미접수는 자동 재시도(30/120초·3회) 후에도
남으면 FAILED로 두고 수동 retry는 FAILED+미접수·3회 미만에서만 받는다.
SMTP adapter·자동/수동 재시도·lease 복구·화면 연결은
[이메일 구현 계획](superpowers/plans/2026-10-04-receivable-email-delivery-plan.md)의 EMAIL-05~07에 구현했다.
worker 검증은 격리 DB·모의 transport이며 실제 SMTP 제출/최종 수신 또는 운영 활성화의 증거가 아니다.

---

## 6. 생산 (Spring)

### 6.1 생산계획 — /production-plans

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/production-plans` | 인증 | 쿼리: `planMonth`, `status` |
| POST | `/production-plans` | `PRODUCTION`, `ADMIN` | `409 PLAN_DUPLICATE` (item+month) |
| PATCH | `/production-plans/{id}` | `PRODUCTION`, `ADMIN` | |
| POST | `/production-plans/{id}/confirm` | `PRODUCTION`, `ADMIN` | `계획` → `확정` |
| POST | `/production-plans/{id}/close` | `PRODUCTION`, `ADMIN` | `확정` → `종결` |

### 6.2 작업오더 — /work-orders

#### GET /work-orders
인증 조회. 쿼리: `status`, `itemId`, `salesOrderId`, `keyword`, `page`(0부터), `size`(1~100), `sort`.
상태는 지시/진행중/완료/마감/취소, ID는 양수다. 검색은 오더/연결 수주/품번/품명/담당자에 적용한다.
정렬 허용: `workOrderNo`, `item.itemNo`, `qty`, `goodQty`, `defectQty`, `progress`, `startDate`, `dueDate`,
`status`, `assignee`, `priority`. 기본 `workOrderNo,desc`, 잘못된 필터/정렬/페이지는 400이다.

#### POST /work-orders
권한: `PRODUCTION`, `ADMIN`. 수주 연결 없는 독립 작업오더 생성.

필수: `workOrderNo`(최대 32자), `itemId`(제품/반제품), `qty`(양수, 정수 14/소수 4자리), `dueDate`.
선택: `startDate`(기본 한국 오늘), `assignee`(최대 64자, 기본 빈 문자열), `priority`(1~3, 기본 1).
`salesOrderId` 직접 전달은 400이며 수주 확정 경로에서만 연결 생성한다. 중복 번호는 409다.
응답에 담당자/우선순위와 nullable `salesOrderId`/`salesOrderNo`를 제공한다.

독립 생성과 수주 확정 생성 모두 당시 라우팅을 `seq` 오름차순으로 조회해 `routingSteps`에 보관한다.
각 step은 `routingId`, `routingNo`, `seq`, `process`, `workCenter`, `stdTime`, `isSubcontract`를 포함한다.
작업오더 조회/쓰기 응답과 생성 감사에 스냅샷을 제공하며 마스터 변경 후에도 기존 값을 유지한다.
`plannedTimeHours = Σ(stdTime) × qty`, `subcontractTimeHours = Σ(외주 stdTime) × qty`다.
공정 없는 품목과 과거 작업오더는 빈 배열과 시간 0을 반환한다. 일정/원가 계산 서비스는 후속 범위다.

#### POST /work-orders/{id}/complete
권한: `PRODUCTION`, `ADMIN`. **흐름 4: 작업오더 완료**.

요청 (선택):
```json
{ "goodQty": 234, "defectQty": 6 }
```
미전달 필드는 기존 누적 실적 값을 사용한다. 지시/진행중만 가능하며 양품>0,
양품+불량=지시수량이어야 한다. 모든 실적은 0 이상, 정수 14/소수 4자리다.

응답 `200`:
```json
{
  "workOrder": { /* WorkOrderResponse */ },
  "lotNo": "LOT-2610-008",
  "inventoryTxnNo": "IVT-2610-0008"
}
```

실행 결과 (단일 트랜잭션):
1. 작업오더 `완료`, `progress = 100`
2. 완제품 Lot 생성 (warehouse = 품목 유형에 따른 창고)
3. `inventory_transactions` 생산입고 (양수), `items.stock` 증가
4. 누적 양품/불량 생산 실적 저장 (재료비/노무비 계산은 아님)
5. WORK_ORDER/LOT/INVENTORY_TRANSACTION/ITEM 감사를 동일 trace로 저장

작업오더·품목 행 잠금으로 같은 오더의 중복 완료와 같은 품목의 재고 갱신 유실을 방지한다.
감사 저장 실패도 전체 롤백한다. 불량은 Lot/현재고에 포함하지 않는다.

> 원가 집계(`costs` 테이블, 표준 vs 실제)는 Phase 3. Phase 1은 실적까지만.

오류: `404`, `409 INVALID_STATE_TRANSITION`, `422 GOOD_QTY_ZERO`,
`422 WORK_ORDER_QTY_EXCEEDED`, `422 WORK_ORDER_QTY_MISMATCH`.

#### POST /work-orders/{id}/progress
권한: `PRODUCTION`, `ADMIN`. 지시/진행중의 누적 실적 교체. 요청:
```json
{ "goodQty": 96, "defectQty": 4 }
```
한 필드만 전달하면 다른 실적은 유지하며 빈 요청은 400이다. 양품+불량<=지시수량을 검증한다.
`progress = (goodQty + defectQty) / qty * 100` (소수 2자리 HALF_UP), 지시→진행중.
실적 입력만으로 Lot·재고를 변경하지 않는다. 오류: `422`, `409`.

#### 기타
| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/work-orders/{id}` | 인증 | 상세 |
| PATCH | `/work-orders/{id}` | `PRODUCTION`, `ADMIN` | `지시`만. qty/startDate/dueDate/assignee/priority 부분 수정. 연결 오더 수량은 불변 |
| DELETE | `/work-orders/{id}` | `PRODUCTION`, `ADMIN` | 실적 없는 독립 `지시`만. 연결/실적 참조는 `409 IN_USE` |
| POST | `/work-orders/{id}/close` | `PRODUCTION`, `ADMIN` | `완료` → `마감` |
| POST | `/work-orders/{id}/cancel` | `PRODUCTION`, `ADMIN` | 실적 없는 독립 `지시` → `취소`. 연결/실적 참조는 `409 IN_USE` |

PATCH 번호/품목/수주 연결은 수정하지 않는다. `assignee: ""`는 담당자 해제다. 담당자는 직원 ID가 아닌 라벨이다.
V13 이전 초과 실적 마감 행은 보존하며 합계 제약은 신규/변경 행에 적용한다. 과거 라우팅을 소급 생성하지 않는다.
실제원가 집계는 후속 범위다. 공정별 실적은 TODO-014의 보관 스냅샷 공정 착수·완료와 헤더 대사 규칙을 따른다.
완료 작업오더 취소는 완료 Lot 원상태·무출하·충분 재고일 때만 입고 역보상(출고 수불·Lot 폐기)으로 `취소`하며
마감·소진 건은 차단한다. 불출된 원자재는 복원하지 않는다.

---

## 7. 자재·구매·재고 (Spring)

### 7.1 발주 — /purchase-orders

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/purchase-orders` | 인증 | 쿼리: `status`, `vendorId`, `page`, `size`, `sort`. 실제 입고 선택 목록에 사용 |
| POST | `/purchase-orders` | `MATERIAL`, `ADMIN` | 생성. `발주` |
| GET | `/purchase-orders/{id}` | 인증 | 상세 |
| PATCH | `/purchase-orders/{id}` | `MATERIAL` | `발주`만 |
| DELETE | `/purchase-orders/{id}` | `MATERIAL` | `발주`만 |
| POST | `/purchase-orders/{id}/cancel` | `MATERIAL`, `ADMIN` | → `취소` |

MRP 전환도 기존 POST를 사용한다. 실제 `발주처` 거래처만 허용하며 발주번호 32자, 양수 수량 정수14/소수4자리,
양수 단가와 합계는 9,007,199,254,740,991원 이하다. 합계는 원 미만 절사하며 overflow를 거부한다(400).
발주 생성은 현재고를 변경하지 않고 기존 actor/trace 감사를 저장한다.

### 7.2 입고 — /receivings

인증 조회. 목록 쿼리: `purchaseOrderId`, `vendorId`, `itemId`(양수), `status`, `keyword`, `page`(0~10000),
`size`(1~100), `sort`(기본 `receivingNo,desc`). 검색은 입고/발주번호·공급사·품번·품명에 적용한다.
정렬 허용: `receivingNo`, `purchaseOrder.purchaseOrderNo`, `vendor.name`, `item.itemNo`, `orderQty`,
`receivedQty`, `defectQty`, `receivedDate`, `status`. 잘못된 필터·정렬·페이지는 400이다.
발주 선택 목록은 `purchaseOrderNo`, `qty`, `dueDate`, `receivedQty`, `status` 정렬을 지원한다.

#### POST /receivings
권한: `MATERIAL`, `ADMIN`. **흐름 3: 발주 → 입고**.

요청:
```json
{ "purchaseOrderId": 2, "receivedQty": 1000, "defectQty": 12, "receivedDate": "2026-10-06" }
```

`receivedQty`는 불량을 포함한 총 입고수량(양수), `defectQty`는 0 이상/총량 이하다.
각 수량은 정수 14/소수 4자리까지다. 불량 생략은 0, 입고일 생략은 한국 오늘이다.
발주/부분입고만 입고할 수 있고 총 입고수량은 발주 잔량 이하여야 한다.

응답 `201`:
```json
{
  "receiving": { /* ReceivingResponse */ },
  "lotNo": "LOT-2610-008",
  "inventoryTxnNo": "IVT-2610-0009"
}
```

실행 결과 (단일 트랜잭션):
1. 입고 이력 생성 (`합격`/`부분합격`/전량 불량은 `불합격`)
2. 발주서 `receivedQty`에 **총량** 누적, `부분입고`/`입고완료` 상태 전이
3. 양품 Lot 생성 (자재창고)
4. `inventory_transactions` 입고 (양품 = received - defect), `items.stock`에 양품 증가
5. RECEIVING/PURCHASE_ORDER/LOT/INVENTORY_TRANSACTION/ITEM 감사를 같은 trace로 저장

전량 불량은 Lot·재고 이동을 생성하지 않고 관련 결과 번호를 생략한다(입고/발주/품목 감사 3개).
발주·품목 잠금으로 동시 초과입고와 동일 품목 재고 유실을 막고 감사 실패도 전체 롤백한다.
응답은 `goodQty`, `lotNo`, 원 `inventoryTxnNo`, `reversalTxnNo`, `cancelledDate`, `stockApplied`를 제공한다.
연결/취소 정보가 없으면 생략할 수 있다. 매입 전표·매입채무는 아직 생성하지 않는다.

오류:
- `404 PURCHASE_ORDER_NOT_FOUND`
- `422 RECEIVED_QTY_EXCEEDS_ORDER` (잔량 초과)
- `409 PURCHASE_ORDER_CLOSED` (`입고완료`/`취소`)
- `400 INVALID_INPUT` (수량/정밀도), `422 BUSINESS_RULE_VIOLATION` (불량>총량/재고 저장범위 초과)

#### POST /receivings/{id}/cancel
권한: `MATERIAL`, `ADMIN`. 본문 없음. 전체 입고 단위 취소만 지원한다.
새 입고의 미사용 정상 Lot에 한해 양품 역출고(`refType=RECEIVING_CANCEL`)를 생성하고 Lot 잔량을 0·폐기로 만든다.
현재고 양품 차감, 발주 누적입고 총량 차감, 발주/부분입고 복원, 입고 취소일/상태/역출고 연결 및 감사를 함께 저장한다.
원 발주가 취소 상태면 취소를 유지한다. 전량 불량 취소는 재고 이동 없이 누적입고만 복원한다.
200 응답은 생성 결과와 같은 형태이며 `inventoryTxnNo`는 역출고 번호, 입고 응답 내부 `inventoryTxnNo`는 원 번호다.
입고/발주/품목/Lot 잠금으로 중복 보상을 차단한다. 감사 실패 시 전체 롤백한다.
오류: `409 INVALID_STATE_TRANSITION`(중복/미처리), `409 IN_USE`(사용·변경·보류·폐기 Lot, 재고 부족, 과거 연결 불명확).
V14 이전 이력은 `stockApplied=false`이며 재고나 연결을 추정하지 않아 자동 취소할 수 없다.
부분 반품·사용 이후 보상·품질 승인·요청 idempotency key는 후속 범위다.

#### 기타
| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/receivings` | 인증 | 위 목록 필터·검색·정렬·페이지 |
| GET | `/receivings/{id}` | 인증 | 상세 |
| DELETE | `/receivings/{id}` | `MATERIAL`, `ADMIN` | 이력 삭제 금지: 존재하면 `409 IN_USE`. 취소 보상 API 사용 |

### 7.3 재고 — /inventory

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/inventory/stock` | 인증 | 품목별 가용재고 + 안전재고 대비 |
| GET | `/inventory/transactions` | 인증 | 입출고 이력. 쿼리: `itemId`, `txnType`, `from`, `to` |
| GET | `/inventory/low-stock` | 인증 | 안전재고 미달 목록 (대시보드/알림용) |

### 7.4 Lot — /lots

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/lots` | 인증 | 쿼리: `itemId`, `status`, `warehouse` |
| POST | `/lots/{id}/hold` | `MATERIAL`, `QUALITY`, `ADMIN` | → `보류` |
| POST | `/lots/{id}/release` | `MATERIAL`, `QUALITY`, `ADMIN` | `보류` → `정상` |
| POST | `/lots/{id}/dispose` | `QUALITY`, `ADMIN` | → `폐기` (보상 출고 트랜잭션) |

실제 `/inventory/lots` UI는 읽기 전용 `GET /api/core/lot-traces`(검색·필터·정렬·Spring Page)와
`GET /api/core/lot-traces/{id}`(Lot/기준시각/연결 수불 Page/확인 원천/제약)을 사용한다.
모든 인증 역할에 허용하며 기존 `/lots` 배열 응답/쓰기 API는 유지한다. 원천은 저장된 입고/출하 수불 FK와
동일 품목 WORK_ORDER 생산입고 참조로만 확인하며 미연결은 null로 보존한다.
보류·해제·폐기 UI와 폐기 현재고/잔량 정합성은 후속 범위다. 상세 계약: [Lot 추적](lot-tracing.md).

---

## 8. 분석 — 실제 Spring 계약과 보류된 FastAPI 설계

### 8.0 현재 실행 API (2026-10-04)

| 메서드 | 실제 경로 | 조회 조건/응답 |
| --- | --- | --- |
| GET | `/api/core/analytics/dashboard` | `from`, `to`, `itemId`; `metadata`, `kpis`, `trends`, `alerts`, `coverage` |
| GET | `/api/core/analytics/mrp/suggestions` | `through`, `itemId`, `page`, `size`; 품목별 소요·가용재고·발주/예정생산·부족·제안·기일·제약 |
| GET | `/api/core/analytics/production/progress` | `from`, `to`, `itemId`, `status`, `keyword`, `sort`, `page`, `size`; 실제 누적 수량·진척·수율·현재 지연, 전체 필터 요약 |
| GET | `/api/core/analytics/sales/summary` | `from`, `to`, `itemId`, `customerId`, `keyword`, `scope`, `sort`, `page`, `size`; 기간 수주/확정 출하·현재 잔고/미수 원금, 이력 제외 |
| GET | `/api/core/analytics/inventory/summary` | `from`, `to`, `ageDays`, `itemId`, `itemType`, `risk`, `keyword`, `sort`, `page`, `size`; 현재고·수불/Lot 비교·Lot 경과·기간 부호 증감 |

다섯 API는 REPEATABLE_READ 읽기 전용 스냅샷과 기존 Core 클라이언트/생성 타입을 쓴다.
영업 요약은 기존 미수 상세와 같은 ADMIN/SALES/ACCOUNTING만 허용하고 다른 분석은 모든 인증 사용자에게 허용한다.
재고회전율은 원가·평균재고 이력이 없어 null과 이유를 반환한다. 실제 계산식·역사 이력 제외·기간/단위/한도·
오류·검토 후 발주 정책은 [대시보드](analytics-dashboard.md), [MRP](analytics-mrp.md),
[생산 진척](analytics-production.md), [영업 요약](analytics-sales.md), [재고 원천](analytics-inventory.md)을 따른다.
8.1~8.8의 분리 FastAPI 엔드포인트·표본 숫자는 보류된 설계이며 현재 제공되지 않는다.

### 8.1 GET /analytics/dashboard/kpi
대시보드 KPI. 캐시: 없음 (실시간).

응답 `200`:
```json
{
  "monthlySales": 43850000,
  "monthlyProduction": 31200000,
  "backlogQty": 680,
  "onTimeRate": 92.5,
  "defectRate": 1.8,
  "inventoryTurnover": 3.2,
  "lowStockCount": 3,
  "activeWorkOrderCount": 4,
  "overdueReceivableCount": 3,
  "asOf": "2026-09-20"
}
```

### 8.2 GET /analytics/dashboard/trends
생산 추이 (계획 vs 실적, 월별 6개월).

응답 `200`:
```json
{
  "labels": ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
  "series": [
    { "name": "계획", "values": [180, 200, 210, 190, 220, 200] },
    { "name": "실적", "values": [172, 196, 205, 188, 214, 0] }
  ]
}
```

### 8.3 GET /analytics/dashboard/alerts
알림 목록 (납기 지연 위험, 안전재고 미달, 설비 점검 예정).

응답 `200`:
```json
{
  "alerts": [
    { "type": "납기지연위험", "level": "danger", "title": "WO-2610-003 납기 지연 위험",
      "refNo": "WO-2610-003", "dueDate": "2026-10-12" },
    { "type": "안전재고미달", "level": "warning", "title": "ABS 펠릿 안전재고 미달",
      "refNo": "M-C001", "current": 480, "safety": 600 }
  ]
}
```

### 8.4 GET /analytics/mrp/suggestions
**MRP 발주 제안**. 입력: 진행중 작업오더 + BOM 전개 + 재고/리드타임.

쿼리: `warehouse`(기본 전체)

응답 `200`:
```json
{
  "asOf": "2026-09-20",
  "suggestions": [
    {
      "itemNo": "M-C001", "itemName": "ABS 펠릿", "unit": "KG",
      "requirement": 260, "onHand": 480, "shortfall": 380,
      "reorderPoint": 600, "leadTimeDays": 10,
      "suggestedQty": 418, "reason": "안전재고 600 + 소요 260 대비 부족 (380KG)"
    }
  ]
}
```

오류: `503 UPSTREAM_UNAVAILABLE` (Spring 마스터 동기화 실패)

### 8.5 GET /analytics/mrp/coverage
자재 소요량 vs 재고 커버리지 (운영분석 화면용).

응답 `200`:
```json
{
  "materials": [
    { "itemNo": "M-S001", "requirement": 180, "onHand": 210,
      "coverageDays": 35, "status": "충분" }
  ]
}
```

### 8.6 GET /analytics/production/progress
작업오더 진척 현황 + 공정별 가동 요약.

응답 `200`:
```json
{
  "workOrders": [
    { "workOrderNo": "WO-2610-001", "item": "프레임 가조립품 A",
      "qty": 120, "goodQty": 96, "progress": 80.0,
      "dueDate": "2026-10-05", "status": "진행중", "delayed": false }
  ]
}
```

### 8.7 GET /analytics/sales/summary
영업 요약 (수주 잔량, 출하 현황, 미수 현황).

응답 `200`:
```json
{
  "openOrderQty": 680, "openOrderAmount": 88700000,
  "shippedAmount": 21000000, "receivableAmount": 74250000,
  "overdueAmount": 48100000
}
```

### 8.8 GET /analytics/inventory/turnover
재고 회전율 및 창고별 현황.

---

## 9. 내부 전용 (Spring)

FastAPI → Spring 내부 호출. `X-Internal-Key` 헤더 필수.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/internal/items` | 품목 전체 (캐시 동기화용) |
| GET | `/internal/inventory/stock` | 현재고 전체 |
| GET | `/internal/work-orders/active` | 진행중/지시 작업오더 |
| GET | `/internal/boms` | BOM 전개용 |

- `X-Internal-Key` 불일치 → `401`
- 응답은 페이지네이션 없는 전체 목록 (캐시 적재 목적)
- Phase 1에서는 FastAPI 기동 시 1회 + TTL 60s 갱신

---

## 10. 권한 매트릭스 (Phase 1)

| 리소스 | ADMIN | SALES | PRODUCTION | MATERIAL | QUALITY |
| --- | --- | --- | --- | --- | --- |
| items | RWD | R | R | R | R |
| partners | RWD | RW | R | R | R |
| boms | RWD | R | RW | R | R |
| routings | RWD | R | RW | R | R |
| quotations | R | RWD | R | R | R |
| sales-orders | RW + 승인 | RWD | R | R | R |
| shipments | RW + 승인 | RWD | R | R | R |
| receivables | R + 수납 | R | - | - | - |
| production-plans | RW + 승인 | R | RWD | R | R |
| work-orders | RW + 완료 | R | RWD | R | R |
| purchase-orders | RWD | R | R | RWD | R |
| receivings | RW | R | R | RWD | R |
| inventory | R | R | R | R | R |
| lots | R + 처분 | R | R | R + 보류/해제 | R + 보류/해제 |
| analytics/* | R | R | R | R | R |
| analytics/sales/summary (미수 상세 예외) | R | R | - | - | - |

(`R`=조회, `W`=생성/수정, `D`=삭제, 승인=상태 전이 확정)
ACCOUNTING은 미수 상세와 영업 요약 조회를 허용한다. `analytics/*`의 영업 요약은 별도 행의 권한이 우선한다.

---

## 11. 프론트엔드 연동

### 11.1 DataContext → API 교체 매핑

| 프론트 현재 | 변경 후 |
| --- | --- |
| `useCollection('items')` | `useQuery(['items'], fetchItems)` |
| `create('items', x)` | `useMutation(createItem)` + 캐시 무효화 |
| `quotationToOrder(id)` | `POST /sales-orders/from-quotation/{id}` |
| `confirmSalesOrder(id)` | `POST /sales-orders/{id}/confirm` |
| `receivePurchaseOrder(...)` | `POST /receivings` |
| `completeWorkOrder(id)` | `POST /work-orders/{id}/complete` |
| `confirmShipment(id)` | `POST /shipments/{id}/confirm` |

### 11.2 코드 생성

```bash
# 타입
npx openapi-typescript http://localhost:38080/v3/api-docs -o src/api/core.d.ts
npx openapi-typescript http://localhost:38000/openapi.json -o src/api/analytics.d.ts

# 호출기(선택) — 또는 fetch 직접 래핑
npx openapi-fetch --client core --output src/api/core-client.ts
```

- `src/api/http.ts`: baseURL, JWT 인터셉터, traceId 주입, 에러 정규화
- 환경변수: `VITE_API_CORE_URL`, `VITE_API_ANALYTICS_URL`

---

## 12. 검증 기준

1. **명세 생성**: Spring/FastAPI 기동 시 `/v3/api-docs`, `/openapi.json` 노출
2. **스키마 일치**: 응답 스키마가 `db-schema.md`와 1:1 (시드 기준)
3. **권한 검증**: 롤별 호출 시 `403`/`200` 분기가 매트릭스와 일치
4. **흐름 E2E**: 견적 → 수주 → 확정(작업오더) → 완료(Lot) → 출하 확정(매출+미수)
   각 단계 응답에 도메인 번호 포함
5. **오류 코드**: 422/409 사례가 각 엔드포인트에 정의된 코드와 일치
6. **타입 생성**: 프론트 `core.d.ts`/`analytics.d.ts` 생성 후 `tsc` 통과
