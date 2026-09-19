# ERP-Approid 백엔드 아키텍처 설계 스펙

| 항목 | 내용 |
| --- | --- |
| 프로젝트 | ERP-Approid (중소 제조업 ERP) |
| 문서 버전 | v1.0 |
| 작성일 | 2026-09-20 |
| 선행 문서 | `docs/desc.md` (기능정의서 v0.3) |
| 범위 | Phase 1 MVP (대시보드, 수주/영업, 품목·BOM, 생산계획/작업오더, 자재·구매, 재고, 출하) |

---

## 1. 시스템 구성

```
┌──────────────────────────────────────────────────────┐
│  프론트엔드 (hud-admin-template)                     │
│  React 18 + TypeScript + Vite + Tailwind             │
│  react-query(서버 상태) + openapi-generator(타입)    │
└───────────────┬───────────────────────┬──────────────┘
                │ /api/core/*           │ /api/analytics/*
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ backend-spring (38080)   │  │ backend-fastapi (38000)  │
│ Spring Boot 3.5 / Java21 │  │ FastAPI 0.115 / Py3.12   │
│                          │  │                          │
│ 도메인 쓰기/트랜잭션     │  │ 조회·연산·분석           │
│ - 견적/수주/출하/미수    │  │ - 대시보드 KPI           │
│ - 품목/BOM/공정          │  │ - 운영분석               │
│ - 생산계획/작업오더      │  │ - MRP 발주제안 연산      │
│ - 발주/입고/재고/Lot     │  │ - 재고 분석              │
│ - 사용자/권한/감사       │  │                          │
└─────────────┬────────────┘  └────────────┬─────────────┘
              │                            │
              │  내부 호출 (마스터/재고)   │
              └───────────────────────────►│
                          (RestClient)
              ▼                            ▼
┌──────────────────────────────────────────────────────┐
│  PostgreSQL 16 (공유 스키마, UTF-8, KST)              │
└──────────────────────────────────────────────────────┘
```

### 1.1 역할 분담 원칙

| 구분 | Spring (core) | FastAPI (analytics) |
| --- | --- | --- |
| 책임 | 도메인 상태 변경, 트랜잭션, 권한, 감사 로그 | 읽기 집계, 파생 연산, 분석 리포트 |
| DB 접근 | 읽기 + 쓰기 | 읽기 전용 (동일 스키마, 읽기 전용 계정) |
| 예시 | `POST /api/core/sales-orders` | `GET /api/analytics/mrp/suggestions` |
| 정규화 | 정규화된 도메인 테이블 | 동일 테이블 + 뷰/함수로 파생 |

**원칙**: FastAPI는 쓰기를 하지 않는다. MRP 제안을 "발주로 전환"할 때는
Spring의 `POST /api/core/purchase-orders`를 호출한다.

### 1.2 FastAPI → Spring 내부 호출

FastAPI가 집계에 필요한 마스터/재고 데이터를 가져올 때:
- **HTTP 내부 호출** (Spring `GET /api/core/internal/*` — `X-Internal-Key` 헤더 인증)
- **실패 정책**: fallback 불가능한 집계는 503 + 프론트 재시도 유도. 마스터 동기화는
  최종 일관성을 허용하므로 TTL 60s 로컬 캐시(Spring Data Cache 없이 FastAPI `cachetools`).

Phase 1에서는 호출 빈도가 낮아 메시지 큐는 도입하지 않는다 (YAGNI).

---

## 2. 기술 스택 (확정)

### 2.1 backend-spring

| 항목 | 선택 | 비고 |
| --- | --- | --- |
| 언어/프레임워크 | Java 21 LTS + Spring Boot 3.5 | 가상 스레드 off (Phase 1) |
| 빌드 | Gradle 8 (Kotlin DSL) + wrapper | 로컬 Gradle 미설치 환경 대응 |
| DB | Spring Data JPA + Hibernate | |
| 마이그레이션 | Flyway | 버전 관리 DDL (`db/migration/V1__`) |
| 검증 | Jakarta Bean Validation | DTO 레벨 |
| API 문서 | springdoc-openapi 2.x | OpenAPI 3.1 자동 생성 |
| 보안 | Spring Security + JWT (HS256) | RS256은 Phase 3 |
| 로깅 | SLF4J + Logback (JSON) | 감사 로그는 별도 appender |
| 테스트 | JUnit 5 + Testcontainers (PostgreSQL) | 통합 테스트 |
| 매핑 | MapStruct | Entity ↔ DTO |

### 2.2 backend-fastapi

| 항목 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | FastAPI 0.115 + Uvicorn | |
| DB | SQLAlchemy 2.0 (비동기, AsyncPG) | 읽기 전용 세션 |
| 마이그레이션 | 관리 안 함 | 읽기 전용이므로 스키마는 Spring/Flyway가 단독 관리 |
| 검증 | Pydantic v2 | 응답 스키마 |
| API 문서 | FastAPI 내장 OpenAPI 3.1 | `/openapi.json` |
| 캐시 | cachetools (TTL 60s) | 마스터 데이터 |
| 테스트 | pytest + httpx + Testcontainers | |
| 클라이언트 | httpx (Spring 내부 호출) | |

### 2.3 프론트엔드 변경

| 항목 | 현재 | 변경 |
| --- | --- | --- |
| 서버 상태 | 없음 (Context 시드) | @tanstack/react-query |
| API 타입 | 없음 | openapi-typescript (코드젠) |
| 데이터 공급 | `DataContext` 시드 + flow 액션 | API 호출 레이어로 교체 |

`DataContext`의 흐름 액션 5종(견적→수주→작업오더→입고→완료→출하)은
서버 POST 엔드포인트로 옮겨가고, 프론트는 mutation + 캐시 무효화만 담당한다.

---

## 3. 리포지토리 레이아웃

```
ERP-Approid/
├── docs/                          # 기존 + 신규 문서
├── hud-admin-template/            # 기존 프론트
├── backend-spring/
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradlew / gradlew.bat      # wrapper (커밋)
│   └── src/
│       ├── main/
│       │   ├── java/com/erpapproid/core/
│       │   │   ├── CoreApplication.java
│       │   │   ├── domain/        # JPA Entity
│       │   │   ├── repository/    # JpaRepository
│       │   │   ├── service/       # 도메인 서비스 + 트랜잭션
│       │   │   ├── api/           # REST Controller
│       │   │   ├── dto/           # 요청/응답 DTO + MapStruct
│       │   │   ├── security/      # JWT 필터, 인증 설정
│       │   │   └── common/        # 예외, 페이지네이션, 감사
│       │   └── resources/
│       │       ├── application.yml
│       │       └── db/migration/  # Flyway V1__init.sql …
│       └── test/
├── backend-fastapi/
│   ├── pyproject.toml
│   ├── uv.lock (또는 requirements.txt)
│   └── app/
│       ├── main.py
│       ├── api/                   # 라우터 (analytics)
│       ├── schemas/               # Pydantic 응답 모델
│       ├── service/               # 집계/연산 로직
│       ├── infra/                 # DB 세션, httpx 클라이언트
│       └── tests/
├── docker-compose.yml             # postgres + spring + fastapi
└── openapi/                       # 생성된 명세 스냅샷 (공유용)
```

---

## 4. 데이터 모델 개요

상세 스키마는 `docs/db-schema.md`에서 정의한다. Phase 1 대상 테이블:

| 그룹 | 테이블 |
| --- | --- |
| 마스터 | `items`, `partners`, `boms`, `routings` |
| 영업 | `quotations`, `sales_orders`, `receivables`, `shipments` |
| 생산 | `production_plans`, `work_orders` |
| 구매/재고 | `purchase_orders`, `receivings`, `lots`, `inventory_transactions` |
| 공통 | `users`, `roles`, `user_roles`, `audit_logs` |

공통 컬럼 규약:
- `id`: `BIGSERIAL` (내부 PK) + 도메인 번호(`item_no` 등)는 유니크 비즈니스 키
- 감사: `created_at`, `updated_at`, `created_by`, `updated_by` (BIGSERIAL + 인덱스)
- 시간: `TIMESTAMPTZ`, 애플리케이션은 Asia/Seoul
- 금액: `BIGINT` (원화 정수, 오차 방지)
- 수량: `NUMERIC(18,4)` (BOM 소요량 0.4, 1.2 등 소수 대응)
- 삭제: 논리 삭제 없음 (감사 요구사항). 폐기/취소는 상태로 표현.
- 잠금: 동시성이 높은 집계 테이블(재고)은 버전 컬럼(`@Version`)으로 낙관적 잠금

---

## 5. API 설계

### 5.1 URL 규칙

상태 전이는 `PATCH .../status` 대신 행위 기반 POST 엔드포인트를 사용한다
(6절 흐름 매핑 참조).

- Spring: `/api/core/{resource}` — 복수형, kebab-case
  - `GET /api/core/items?page=0&size=20&sort=name,asc`
  - `POST /api/core/sales-orders`
  - `POST /api/core/shipments/{id}/confirm`
- FastAPI: `/api/analytics/{topic}`
  - `GET /api/analytics/dashboard/kpi`
  - `GET /api/analytics/mrp/suggestions`
- 내부 전용: `/api/core/internal/{resource}` — `X-Internal-Key` 헤더 필수

### 5.2 공통 응답/오류

```json
{
  "code": "SALES_ORDER_NOT_FOUND",
  "message": "수주를 찾을 수 없습니다: SO-2609-009",
  "timestamp": "2026-09-20T14:30:00+09:00",
  "traceId": "a1b2c3d4"
}
```

- 페이지네이션: `page`(0-base), `size`(기본 20, 최대 200), 응답은
  `content[]`, `totalElements`, `totalPages`, `number`, `size`
- HTTP 상태: 200 / 201 / 204 / 400(검증) / 401 / 403 / 404 / 409(상태 충돌) / 503
- 도메인 규칙 위반(예: 이미 출하 완료된 수주 확정)은 409 + 도메인 코드

### 5.3 인증/인가

- Phase 1: JWT (HS256), 만료 60분, refresh는 Phase 3
- Spring Security가 발급/검증. FastAPI는 공유 시크릿으로 JWT 클레임만 검증 (DB 조회 없음)
- 권한: `ROLE_ADMIN`, `ROLE_SALES`, `ROLE_PRODUCTION`, `ROLE_MATERIAL`, `ROLE_QUALITY`,
  `ROLE_ACCOUNTING` — `desc.md` 1.4 대상 사용자 매핑
- 메서드 단위: `@PreAuthorize("hasRole('SALES')")`

### 5.4 감사

- 모든 쓰기 엔드포인트는 `audit_logs`에 기록 (actor, action, entityType, entityId,
  before/after JSON, traceId)
- desc.md 3.12 요구: 원가/단가/결산 변경은 민감 변경으로 분류하여 별도 보존

---

## 6. 도메인 흐름 → 엔드포인트 매핑

`desc.md` 4절의 5개 흐름을 API로 옮긴다:

| 흐름 | 프론트 현재 구현 | 변경 후 엔드포인트 (Spring) |
| --- | --- | --- |
| 견적 → 수주 | `quotationToOrder()` | `POST /api/core/sales-orders/from-quotation/{quotationId}` |
| 수주 확정 → 작업오더 | `confirmSalesOrder()` | `POST /api/core/sales-orders/{id}/confirm` |
| 발주 → 입고 | `receivePurchaseOrder()` | `POST /api/core/receivings` |
| 작업오더 완료 | `completeWorkOrder()` | `POST /api/core/work-orders/{id}/complete` |
| 출하 확정 → 매출 | `confirmShipment()` | `POST /api/core/shipments/{id}/confirm` |

FastAPI는 이 흐름에 참여하지 않고 결과만 집계한다.

---

## 7. 로컬 개발 환경

`docker-compose.yml` 한 번으로 전체 구동:

| 서비스 | 포트 | 비고 |
| --- | --- | --- |
| postgres | 15432 | `erp / erp_dev_pw`, DB `erp_approid`, UTF-8 |
| backend-spring | 38080 | `/swagger-ui.html` |
| backend-fastapi | 38000 | `/docs` |
| (옵션) pgadmin | 35050 | 개발 편의 |

- 프론트는 기존 `npm run dev` (5173) 그대로. `.env`에
  `VITE_API_CORE_URL=http://localhost:38080/api/core`,
  `VITE_API_ANALYTICS_URL=http://localhost:38000/api/analytics` 추가
- Spring/FastAPI 개별 기동 스크립트는 `docs/setup.md`에 정리

---

## 8. 범위 밖 (Phase 1 제외)

desc.md Phase 2~4 항목은 본 스펙에서 제외:

- 품질(검사/불량), 공정·설비, 외주, 게시판·알림, 인사, 원가·회계 정산
- 다공장, 현장/거래처 포털, 세무·은행 연동, SMS/LMS
- 리프레시 토큰, RS256, SSO
- 메시지 큐, 분산 캐시(Redis), 읽기 복제본
- 다국어

> 예외: `work_orders`의 재료비/노무비 실적 확보는 Phase 1에 포함
> (desc.md 7절 비고 반영) — 원가 집계(정산)가 아닌 실적 입력까지만.

---

## 9. 검증 기준

각 단계의 완료 조건 (spec 작성 → 구현 → 확인):

1. **스펙 완료**: 본 문서 + `docs/db-schema.md` + `docs/api-spec.md` 리뷰 통과
2. **스키마 완료**: Flyway `V1__init.sql` 실행 시 모든 테이블/인덱스 생성,
   Testcontainers 통합 테스트 통과
3. **API 완료 (Spring)**: desc.md Phase 1 흐름 5종에 대한 통합 테스트 통과,
   OpenAPI 생성 확인
4. **API 완료 (FastAPI)**: 대시보드 KPI + MRP 제안 엔드포인트 테스트 통과
5. **프론트 연동**: `DataContext` 시드 경로를 API 경유로 교체 후
   `tsc` + 주요 화면 동작 확인
6. **E2E**: docker-compose 전체 기동 후 수주→생산→출하 시나리오 1회 완료
