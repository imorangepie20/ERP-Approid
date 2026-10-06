# 미수금 이메일 발송 구현 기록 (EMAIL-01~07)

2026-10-06. TODO-003 검토 모달에 이어 실제 이메일 요청·발송·이력을 로컬에 구현한 기록이다.
설계는 [이메일 발송 설계](superpowers/specs/2026-10-04-receivable-email-delivery-design.md),
작업 계획은 [이메일 발송 계획](superpowers/plans/2026-10-04-receivable-email-delivery-plan.md)을 따른다.
검토 전용 계약은 [독촉 검토 모달](receivables-reminders.md), 목록/수납 계약은
[목록](receivables-list.md)·[수납](receivables-collections.md)을 따른다.

## 구현 범위

- 연락처: `PUT /partners/{id}/message-contacts/receivable-reminder` — 최초 등록(null 허용),
  ALLOWED 허용 근거(확인 메모 256자·수신 확인 체크 필수), 버전 낙관 잠금(409), BLOCKED 차단.
  역할은 ADMIN/ACCOUNTING 쓰기, SALES 읽기. 삭제 없음·FK 이력 보존·감사 실패 롤백.
- 요청: `POST /receivables/{id}/reminders` — 서버 템플릿(부분수납 잔액 본문)·`{requestId,contactId,
  expectedSnapshotHash,note,acknowledged}` 검증·15분 만료·UUID/actor/Trace 감사 원자 저장.
  신규 202, 동일 키·입력 재조회 200, 다른 입력/처리자·오래된 hash·당일 접수 중복 409,
  비연체/미허용 422, 설정 비활성 503.
- 큐: EMAIL-04 worker — QUEUED 단건 skip-locked 확보·120초 lease/token, 5초 poll 최대 10건.
  발송 직전 미수→거래처→연락처→메시지 잠금 순서로 잔액/hash·허용·만료·요청자 활성/역할 재확인.
  변경/만료 STALE, 권한 회수 FAILED. 시도·감사·DISPATCHING 커밋 후 트랜잭션 밖 transport 호출.
- SMTP: EMAIL-05 adapter — authenticated submission·587 STARTTLS required·hostname 검증,
  연결 5초/읽기 3초/쓰기 5초, 고정 from/envelope-from·Message-ID, ACCEPTED/일시/영구/UNKNOWN 분류.
  설정 미비·TLS 실패는 fail-closed. 테스트 profile은 모의 전송만 사용한다.
- 복구: EMAIL-06 — 명시적 미접수 30/120초·3회 자동 재시도, poll 시 만료 CLAIMED 재확보·
  DISPATCHING→UNKNOWN, 수동 `POST /messages/{id}/retry`(FAILED+미접수·3회 미만·hash 일치·
  ADMIN/ACCOUNTING), UNKNOWN 재시도 차단·동일 토큰 늦은 접수 1회 확정.
- 화면: EMAIL-07 — `src/api/messages.ts` 신규, `MessageContactForm`(등록·버전 충돌 안내·SALES 읽기전용),
  `MessageDeliveryHistory`(실제 상태 문구·재시도·UNKNOWN 재발송 금지·SALES 읽기전용),
  `ReceivableReminderDialog`에 실제 요청 연결(검토→UUID/hash/확인→202/200 표시·
  sessionStorage 키/입력 해시 복원·중단 시 `GET /messages/{uuid}` 우선 조회). SMS 채널은 검토용 선택만이며
  발송 요청은 EMAIL·허용된 등록 연락처·발송 설정 활성 시에만 가능하다.
- 설정: `erp.messaging.email.enabled=false` 기본. SMTP bean·스케줄러는 `enabled=true`에서만 존재하며
  설정 미비 시 기동 실패한다. 근거: `EmailDeliveryConfiguration.java:20`,
  `EmailDeliveryProperties.java:11`, `MessageDispatchScheduler.java:14`.

마이그레이션은 V16(수납 스키마)·V17(기초 수납 이월)·V18(수납 제약)·V19(메시지 발송 스키마)이며
append-only다. CI·E2E guard는 Flyway V19를 확인한다.

## 검증 증거 (2026-10-06, main `8aaaaff`)

- CI run `37402332428` 전체 성공: Backend integration tests, Phase 1 Chromium transactions,
  Frontend lint/types/tests/build, Phase 1 required. E2E job은 현 소스 빌드 이미지로
  Flyway V19·OpenAPI 타입 재생성 일치(`git diff --exit-code`)·Chromium 거래를 통과했다.
- 백엔드 전체: `./gradlew.bat cleanTest test` BUILD SUCCESSFUL (5m 52s, 46개 클래스 281개·실패/오류/건너뜀 0).
  메시지·독촉 10개 클래스 58개 포함:
  `EmailDeliveryConfigurationTest` 3, `MessageContactIntegrationTest` 5,
  `MessageDispatchIntegrationTest` 12, `MessageDispatchSchedulerTest` 1,
  `MessageRecoveryIntegrationTest` 5, `MessageRetryIntegrationTest` 7,
  `MessageSchemaIntegrationTest` 7, `SmtpEmailTransportTest` 6,
  `ReceivableReminderPreviewIntegrationTest` 3, `ReceivableReminderRequestIntegrationTest` 9).
- 프론트: 50개 파일 365개 GREEN, `tsc -b`·`eslint`(0 error)·`vite build` PASS,
  `test:api-types` 3개 PASS. 신규 16건: `messages.test.ts` 6, `MessageContactForm` 4,
  `MessageDeliveryHistory` 3, 다이얼로그 요청/재개/실패 3.
- 네트워크 전송: 모의 transport 외 실제 SMTP 제출 0회. 운영 SMTP endpoint·계정을 주입하지 않았다.

## 설계 §8 기준 대응

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 1 연락처 | PASS | `MessageContactIntegrationTest` 5 (미등록·근거·충돌·차단·감사 롤백·역할) |
| 2 요청 | PASS | `ReceivableReminderRequestIntegrationTest` 9 (잔액 템플릿·거절·hash·키 재응답·동시·당일 제한) |
| 3 큐 | PASS | `MessageDispatchIntegrationTest` 12·스케줄러 1 (claim·감사 커밋·preflight·잠금 경계) |
| 4 SMTP | PASS | `SmtpEmailTransportTest` 6·설정 3 (모의 수신·분류·한도·TLS/timeout·UNKNOWN) |
| 5 복구 | PASS | `MessageRecoveryIntegrationTest` 5·`MessageRetryIntegrationTest` 7 (재확보·차단·단일 확정) |
| 6 UI | PASS | 프론트 16건 + 기존 수납 회귀 (등록·역할·키 복원·이력·Trace ID·SMS 비발송) |
| 7 계약/설정 | PASS | CI OpenAPI drift PASS·`test:api-types`·lint·`enabled=false`·모의 외 전송 0회 |
| 8 문서 | PASS | 본 문서·api-spec·reminders·CLAUDE·roadmap 정합화, `git diff --check` PASS |

## 검증하지 않은 사항 (완료로 표시하지 않음)

- 운영 SMTP 활성화·실제 수신자 배달·최종 수신 확인: 모의 검증만 했으며 운영 메일 설정·계정·
  인증서·DNS 준비는 별도다. 설계 §7의 활성화 조건이 충족되어야 한다.
- SMS/LMS 실제 발송: 검토용 채널 선택만 존재하며 공급사·발송 정책은 미정이다.
- 배포된 데모(`https://erp.approid.team`)는 main보다 오래된 버전이며 DB V1–V15다. V16–V19·본 기능은 미배포다.
- 크로스 디바이스 외부 입금 대사·회계 전표 연동은 후속이다.
