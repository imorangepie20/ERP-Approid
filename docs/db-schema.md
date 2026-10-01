# ERP-Approid DB 스키마 설계 (ERD)

| 항목 | 내용 |
| --- | --- |
| 문서 버전 | v1.0 |
| 작성일 | 2026-09-20 |
| 선행 문서 | `docs/superpowers/specs/2026-09-20-erp-approid-backend-design.md` (아키텍처 v1.0) |
| DB | PostgreSQL 16, UTF-8, `Asia/Seoul` |
| 스키마 | `public` (Phase 1 단일 스키마) |
| 범위 | Phase 1 MVP — 마스터, 영업, 생산, 구매/재고, 공통 |

---

## 1. 설계 규약

### 1.1 식별자

- 내부 PK: `id BIGSERIAL` (자체 증가, 조인용)
- 도메인 번호: `*_no VARCHAR(32) UNIQUE NOT NULL` (화면 표시용, 예: `SO-2609-001`)
- 외래 참조는 도메인 번호가 아닌 `id`를 사용 (성능 + 재번호 부여 대응)

### 1.2 감사 컬럼 (모든 테이블)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | 트리거로 갱신 |
| `created_by` | `BIGINT REFERENCES users(id)` | |
| `updated_by` | `BIGINT REFERENCES users(id)` | |
| `version` | `INTEGER NOT NULL DEFAULT 0` | 낙관적 잠금 (`@Version`) |

감사 컬럼은 본 문서의 각 테이블 정의에서 생략한다 (공통 적용).

### 1.3 도메인 타입 매핑

| 개념 | Postgres 타입 | 이유 |
| --- | --- | --- |
| 금액 | `BIGINT` | 원화 정수, 부동소수 오차 차단 |
| 수량 | `NUMERIC(18,4)` | BOM 소요량(0.4, 1.2) 등 소수 대응 |
| 단가 | `BIGINT` | 원화 |
| 비율/진행률 | `NUMERIC(5,2)` | 0.00 ~ 100.00 |
| 시간 | `TIMESTAMPTZ` | KST 입력/출력, 저장은 UTC |
| 날짜(달력) | `DATE` | 납기일, 입고일 등 |
| 상태 | `VARCHAR(16)` | 체크 제약으로 허용값 고정 |
| 코드(불량코드 등) | `VARCHAR(32)` | Phase 2 공통 코드 테이블로 이관 예정 |

### 1.4 삭제 정책

- 논리 삭제 없음 (`desc.md` 5절 감사: 변경 이력 3년 보존)
- 폐기/취소는 상태 전이(`status = '취소'`)로 표현
- 마스터 참조는 `ON DELETE RESTRICT` — 참조 중인 마스터 삭제 금지

### 1.5 인덱스

- 모든 `*_no` 유니크 인덱스 (자동)
- 외래키 컬럼: 복합 쿼리 패턴에 따라 `CREATE INDEX`
- 상태별 조회가 빈번한 테이블(`sales_orders`, `work_orders`,
  `purchase_orders`)은 `(status)` + `(created_at DESC)` 인덱스
- 목록 조회 1초 이내(`desc.md` 5절) → 페이지네이션 필수, `EXPLAIN` 검증

---

## 2. ERD (Phase 1)

```
users ──< audit_logs
users >── user_roles ──> roles

items ──< boms (parent_id) ──> items (child_id)
items ──< routings
items ──< lots
items ──< inventory_transactions

partners >── quotations
quotations ──< sales_orders
partners >── sales_orders
sales_orders ──< shipments
sales_orders ──< receivables
sales_orders ──< work_orders

purchase_orders >── receivings
partners >── purchase_orders
receivings ──< inventory_transactions
shipments ──< inventory_transactions
work_orders ──< inventory_transactions
lots ──< inventory_transactions

production_plans ──> items
```

> Phase 2 이후: `inspections`, `defects`, `equipment`, `maintenances`,
> `subcontracts`, `employees`, `costs`, `ledger_entries`, `notices`, `notifies`

---

## 3. 테이블 정의

### 3.1 공통 (인증·권한·감사)

#### users
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| username | VARCHAR(64) | UNIQUE NOT NULL | 로그인 ID |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt (강도 10) |
| name | VARCHAR(64) | NOT NULL | 성명 |
| email | VARCHAR(128) | | |
| employee_no | VARCHAR(32) | | Phase 3 `employees` 조인 대비 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'활성'`, CHECK `활성`/`잠김`/`퇴사` | `활성` / `잠김` / `퇴사` |
| last_login_at | TIMESTAMPTZ | | |

#### roles
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| code | VARCHAR(32) | UNIQUE NOT NULL | `ADMIN` / `SALES` / `PRODUCTION` / `MATERIAL` / `QUALITY` / `ACCOUNTING` |
| name | VARCHAR(64) | NOT NULL | 화면 표시 |

#### user_roles
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| user_id | BIGINT | PK, FK→users, `ON DELETE CASCADE` | |
| role_id | BIGINT | PK, FK→roles | |

#### audit_logs
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| actor_id | BIGINT | FK→users | 미인증 시스템 작업은 NULL |
| action | VARCHAR(32) | NOT NULL | `CREATE` / `UPDATE` / `DELETE` / `CONFIRM` / `COMPLETE` |
| entity_type | VARCHAR(64) | NOT NULL | `SALES_ORDER` 등 |
| entity_no | VARCHAR(32) | NOT NULL | 도메인 번호 |
| before_json | JSONB | | 변경 전 스냅샷 |
| after_json | JSONB | | 변경 후 스냅샷 |
| sensitive | BOOLEAN | NOT NULL DEFAULT false | 원가/단가/결산 = true (별도 보존) |
| trace_id | VARCHAR(64) | | 분산 추적 |
| occurred_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

인덱스: `(entity_type, entity_no)`, `(occurred_at DESC)`, `(sensitive) WHERE sensitive`,
`(trace_id) WHERE trace_id IS NOT NULL`

---

### 3.2 마스터

#### items — 품목 마스터
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| item_no | VARCHAR(32) | UNIQUE NOT NULL | `P-A001` / `M-S001` |
| name | VARCHAR(128) | NOT NULL | |
| spec | VARCHAR(128) | | 규격 `1000×500×200` |
| category | VARCHAR(64) | | 조립/절삭/사출/소재/원료 |
| item_type | VARCHAR(16) | NOT NULL | CHECK `제품`/`반제품`/`자재` |
| unit | VARCHAR(16) | NOT NULL | `EA`/`SHT`/`M`/`KG` |
| price | BIGINT | NOT NULL DEFAULT 0 | 표준 단가(원) |
| stock | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 현재고 (집계 일관성은 트랜잭션으로 보장) |
| safety_stock | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 안전재고 |
| lead_time_days | INTEGER | NOT NULL DEFAULT 0 | 발주~입고 소요일 (자재만) |

인덱스: `(item_type)`, `(name)`

> `stock`은 `inventory_transactions`의 합과 주기적 정합(Phase 1은 트랜잭션 내 증감).
> 재고실사 차이 처리는 Phase 2.

#### boms — BOM
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| bom_no | VARCHAR(32) | UNIQUE NOT NULL | `BOM-001` |
| parent_id | BIGINT | NOT NULL FK→items, `ON DELETE RESTRICT` | 모품목 |
| child_id | BIGINT | NOT NULL FK→items, `ON DELETE RESTRICT` | 자품목 |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | 소요량 |
| loss_rate | NUMERIC(5,2) | NOT NULL DEFAULT 0 | 손실율 % |
| substitute_no | VARCHAR(32) | | 대체자재 품번 (Phase 1은 텍스트 보관) |

유니크: `(parent_id, child_id)`

#### routings — 공정
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| routing_no | VARCHAR(32) | UNIQUE NOT NULL | `RT-001` |
| item_id | BIGINT | NOT NULL FK→items, `ON DELETE RESTRICT` | |
| seq | INTEGER | NOT NULL CHECK `seq > 0` | 공정순서 (10, 20, …) |
| process | VARCHAR(64) | NOT NULL | 절단/용접/사출/검사 |
| work_center | VARCHAR(32) | NOT NULL | `WC-CUT` |
| std_time | NUMERIC(10,3) | NOT NULL DEFAULT 0 | 표준시간(h) |
| is_subcontract | BOOLEAN | NOT NULL DEFAULT false | 외주 여부 |

유니크: `(item_id, seq)`

#### partners — 거래처
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| partner_no | VARCHAR(32) | UNIQUE NOT NULL | `C-001` / `V-001` |
| name | VARCHAR(128) | NOT NULL | |
| contact | VARCHAR(64) | | |
| payment_terms | INTEGER | NOT NULL DEFAULT 30 | 수납기일(일) |
| partner_type | VARCHAR(16) | NOT NULL | CHECK `고객사`/`발주처`/`외주처` |

---

### 3.3 영업·수주

#### quotations — 견적
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| quotation_no | VARCHAR(32) | UNIQUE NOT NULL | `QT-2609-001` |
| customer_id | BIGINT | NOT NULL FK→partners | |
| item_id | BIGINT | NOT NULL FK→items | |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | |
| unit_price | BIGINT | NOT NULL | |
| amount | BIGINT | NOT NULL | `qty × unit_price` |
| due_date | DATE | NOT NULL | 납기 |
| valid_until | DATE | NOT NULL | 유효기일 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'작성중'` | CHECK `작성중`/`발송완료`/`수주완료`/`만료` |

#### sales_orders — 수주
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| sales_order_no | VARCHAR(32) | UNIQUE NOT NULL | `SO-2609-001` |
| quotation_id | BIGINT | FK→quotations | 견적 연결 (NULL 허용: 신규 수주) |
| customer_id | BIGINT | NOT NULL FK→partners | |
| item_id | BIGINT | NOT NULL FK→items | |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | |
| unit_price | BIGINT | NOT NULL | |
| amount | BIGINT | NOT NULL | |
| due_date | DATE | NOT NULL | |
| status | VARCHAR(16) | NOT NULL DEFAULT `'대기'` | CHECK `대기`/`확정`/`생산중`/`출하완료`/`취소` |
| ordered_at | DATE | NOT NULL | 수주일 |

인덱스: `(status, ordered_at DESC)`, `(customer_id)`

#### shipments — 출하
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| shipment_no | VARCHAR(32) | UNIQUE NOT NULL | `SH-2610-001` |
| sales_order_id | BIGINT | NOT NULL FK→sales_orders | |
| customer_id | BIGINT | NOT NULL FK→partners | |
| item_id | BIGINT | NOT NULL FK→items | |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | |
| amount | BIGINT | NOT NULL | |
| delivery_date | DATE | NOT NULL | 출하(배송)일 |
| vehicle | VARCHAR(64) | | 차량 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'지시'` | CHECK `지시`/`배차`/`출하완료`/`매출반영` |

#### receivables — 미수금
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| receivable_no | VARCHAR(32) | UNIQUE NOT NULL | `RV-2609-001` |
| customer_id | BIGINT | NOT NULL FK→partners | |
| sales_order_id | BIGINT | FK→sales_orders | |
| amount | BIGINT | NOT NULL | |
| due_date | DATE | NOT NULL | 수납기일 |
| overdue_days | INTEGER | NOT NULL DEFAULT 0 | 연체일 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'미수'` | CHECK `미수`/`수납완료`/`연체` |

> `overdue_days`/연체 여부는 Phase 1에서 조회 시점에 계산한다
> (`due_date < CURRENT_DATE AND status = '미수'` → 연체 표시).
> 배치 갱신 스케줄러는 Phase 2에 도입.

인덱스: `(status, due_date)`, `(customer_id)`

---

### 3.4 생산

#### production_plans — 생산계획 (MPS)
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| plan_no | VARCHAR(32) | UNIQUE NOT NULL | `PL-2610-001` |
| item_id | BIGINT | NOT NULL FK→items | |
| plan_month | VARCHAR(7) | NOT NULL | `2026-10` |
| plan_qty | NUMERIC(18,4) | NOT NULL | 계획수량 |
| order_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 수주수량 |
| stock_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 계획 시점 현재고 |
| gap_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 생산필요량 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'계획'` | CHECK `계획`/`확정`/`종결` |

유니크: `(item_id, plan_month)`

#### work_orders — 작업오더
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| work_order_no | VARCHAR(32) | UNIQUE NOT NULL | `WO-2610-001` |
| sales_order_id | BIGINT | FK→sales_orders | |
| item_id | BIGINT | NOT NULL FK→items | |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | 지시수량 |
| good_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 양품 (Phase 1 실적 입력 대상) |
| defect_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 불량 |
| progress | NUMERIC(5,2) | NOT NULL DEFAULT 0 | 0.00~100.00 |
| start_date | DATE | NOT NULL | 착수일 |
| due_date | DATE | NOT NULL | 완료예정 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'지시'` | CHECK `지시`/`진행중`/`완료`/`마감`/`취소` |

인덱스: `(status, due_date)`, `(item_id)`

> 재료비/노무비 실적은 Phase 1에서 `good_qty`/`defect_qty` 확보까지만.
> 상세 원가 집계(`costs` 테이블)는 Phase 3.

---

### 3.5 자재·구매·재고

#### purchase_orders — 발주
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| purchase_order_no | VARCHAR(32) | UNIQUE NOT NULL | `PO-2610-001` |
| vendor_id | BIGINT | NOT NULL FK→partners | |
| item_id | BIGINT | NOT NULL FK→items | |
| qty | NUMERIC(18,4) | NOT NULL CHECK `qty > 0` | |
| unit_price | BIGINT | NOT NULL | |
| amount | BIGINT | NOT NULL | |
| due_date | DATE | NOT NULL | 납기 |
| status | VARCHAR(16) | NOT NULL DEFAULT `'발주'` | CHECK `발주`/`부분입고`/`입고완료`/`취소` |
| received_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 누적 입고 |

#### receivings — 입고
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| receiving_no | VARCHAR(32) | UNIQUE NOT NULL | `RC-2610-001` |
| purchase_order_id | BIGINT | NOT NULL FK→purchase_orders | |
| vendor_id | BIGINT | NOT NULL FK→partners | |
| item_id | BIGINT | NOT NULL FK→items | |
| order_qty | NUMERIC(18,4) | NOT NULL | |
| received_qty | NUMERIC(18,4) | NOT NULL CHECK `received_qty >= 0` | |
| defect_qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | |
| received_date | DATE | NOT NULL | |
| status | VARCHAR(16) | NOT NULL | CHECK `검수중`/`합격`/`부분합격`/`반품` |

#### lots — Lot
| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| lot_no | VARCHAR(32) | UNIQUE NOT NULL | `LOT-2610-001` |
| item_id | BIGINT | NOT NULL FK→items | |
| warehouse | VARCHAR(32) | NOT NULL | 자재창고/반제품창고/완제품창고 |
| qty | NUMERIC(18,4) | NOT NULL DEFAULT 0 | 가용 수량 |
| produced_at | DATE | NOT NULL | 제조일 |
| expiry | DATE | | 유통기한 (무기한은 `9999-12-31` 관례 유지) |
| status | VARCHAR(16) | NOT NULL DEFAULT `'정상'` | CHECK `정상`/`보류`/`유통기한임박`/`폐기` |

인덱스: `(item_id, status)`, `(expiry) WHERE expiry < '9999-12-31'`

#### inventory_transactions — 입출고 이력
모든 재고 증감의 단일 진실 원천. `items.stock`은 이 테이블의 합과
정합되어야 한다 (Phase 1: 같은 트랜잭션 내 증감).

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | BIGSERIAL | PK | |
| txn_no | VARCHAR(32) | UNIQUE NOT NULL | `IVT-2610-0001` |
| item_id | BIGINT | NOT NULL FK→items | |
| lot_id | BIGINT | FK→lots | |
| warehouse | VARCHAR(32) | NOT NULL | |
| txn_type | VARCHAR(16) | NOT NULL | CHECK `입고`/`생산입고`/`출고`/`출하`/`이동`/`실사` |
| qty | NUMERIC(18,4) | NOT NULL | 양수=입고, 음수=출고 |
| ref_type | VARCHAR(32) | | `RECEIVING`/`WORK_ORDER`/`SHIPMENT` |
| ref_no | VARCHAR(32) | | 참조 도메인 번호 |
| txn_date | DATE | NOT NULL | |

인덱스: `(item_id, txn_date DESC)`, `(ref_type, ref_no)`

> 설계 규약 1.4(논리 삭제 없음)와 일관되게, 재고 정합은 역방향 보상
> 트랜잭션(`실사`/`이동`)으로 처리한다.

---

## 4. 시퀀스/번호 생성

도메인 번호 규칙 (화면 + API 출력용):

| 컬럼 | 패턴 | 예 |
| --- | --- | --- |
| quotation_no | `QT-{yyMM}-{seq3}` | `QT-2609-001` |
| sales_order_no | `SO-{yyMM}-{seq3}` | `SO-2609-001` |
| shipment_no | `SH-{yyMM}-{seq3}` | `SH-2610-001` |
| receivable_no | `RV-{yyMM}-{seq3}` | `RV-2609-001` |
| plan_no | `PL-{yyMM}-{seq3}` | `PL-2610-001` |
| work_order_no | `WO-{yyMM}-{seq3}` | `WO-2610-001` |
| purchase_order_no | `PO-{yyMM}-{seq3}` | `PO-2610-001` |
| receiving_no | `RC-{yyMM}-{seq3}` | `RC-2610-001` |
| lot_no | `LOT-{yyMM}-{seq3}` | `LOT-2610-001` |
| inventory txn_no | `IVT-{yyMM}-{seq4}` | `IVT-2610-0001` |

- `{yyMM}`는 생성 시점(UTC가 아닌 KST) 기준
- 월별 시퀀스: `seq_{table}_no` 시퀀스 + 애플리케이션에서 `yyMM` 조합
- 중복 방지: 유니크 제약 + 재시도 (동시성이 낮아 DB 시퀀스 1개로 충분)

---

## 5. 시드 데이터 (Seed)

`desc.md` v0.3 seed와 호환되도록 마이그레이션:

| 대상 | 소스 | 비고 |
| --- | --- | --- |
| `items` | `seed.ts seedItems` (8건) | |
| `partners` | `seedPartners` (7건) | |
| `boms` | `seedBom` (6건) | |
| `routings` | `seedRoutings` (9건) | |
| `quotations` | `seedQuotations` (5건) | |
| `sales_orders` | `seedSalesOrders` (8건) | |
| `shipments` | `seedShipments` (4건) | |
| `receivables` | `seedReceivables` (6건) | |
| `production_plans` | `seedPlans` (6건) | |
| `work_orders` | `seedWorkOrders` (6건) | |
| `purchase_orders` | `seedPurchaseOrders` (6건) | |
| `receivings` | `seedReceivings` (5건) | `seed2.ts` |
| `lots` | `seedLots` (7건) | |
| `users` / `roles` | 신규 | `admin`(ADMIN) 1건 + 롤 6종 |

프론트 시드의 ID 규칙(LOT-2610-001)과 DB 도메인 번호 패턴이 동일하므로
1:1 마이그레이션이 가능하다. `inventory_transactions`는 시드 재고 상태와
정합되도록 역산하여 최초 1회 보상 레코드를 삽입한다.

---

## 6. 접근 권한 (DB 계정)

| 계정 | 권한 | 사용 |
| --- | --- | --- |
| `erp_app` | 스키마 `public` 읽기 + 쓰기 + 시퀀스 사용 | Spring (core) |
| `erp_ro` | 읽기 전용 | FastAPI (analytics) |
| `erp_migrate` | DDL + 쓰기 | Flyway 마이그레이션 전용 |

```sql
CREATE USER erp_app WITH PASSWORD 'erp_dev_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;

CREATE USER erp_ro WITH PASSWORD 'erp_ro_pw';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO erp_ro;
```

> Phase 1에서는 `public` 단일 스키마. 다공장 확장(Phase 4) 시
> 스키마/RLS 정책으로 분리한다.

---

## 7. 마이그레이션 구성 (Flyway)

```
backend-spring/src/main/resources/db/migration/
├── V1__init_common.sql          # users, roles, user_roles, audit_logs
├── V2__init_master.sql          # items, boms, routings, partners
├── V3__init_sales.sql           # quotations, sales_orders, shipments, receivables
├── V4__init_production.sql      # production_plans, work_orders
├── V5__init_inventory.sql       # purchase_orders, receivings, lots, inventory_transactions
├── V6__seed_users.sql           # users + roles (로그인 필수)
├── V7__seed_domain.sql          # desc.md 시드 데이터
└── V8__audit_trace_index.sql    # trace_id 기반 감사 상관관계 조회 인덱스
```

- `updated_at` 자동 갱신: `V1`에 공통 트리거 함수 `set_updated_at()` 생성
- 체크 제약은 도메인 타입과 일치 (`item_type`, `status` 등)
- rollback은 스키마 버전 단위 (Flyway `undo`는 Community 미지원이므로
  수정은 신규 `V{n}__` 파일로만)

---

## 8. 검증 기준

1. **DDL 실행**: Flyway `V1~V8` 실행 시 오류 없이 14개 테이블 + 인덱스 생성
2. **제약 검증**: 시드 데이터 삽입 시 체크/유니크/FK 위반 0건
3. **정합 검증**: `items.stock` = `SUM(inventory_transactions.qty)` 일치 (14개 품목)
4. **권한 검증**: `erp_ro`로 INSERT 시도 → 거부, `erp_app`은 성공
5. **성능**: 시드 기준 주요 목록 쿼리(`sales_orders`, `work_orders`,
   `inventory_transactions`) 100ms 이하 (10만 건은 Phase 2 부하 테스트)
6. **Testcontainers**: `V1~V8` 적용 후 통합 테스트 통과
