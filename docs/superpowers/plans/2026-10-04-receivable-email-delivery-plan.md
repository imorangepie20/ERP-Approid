# 독촉 이메일 구현 계획

2026-10-04 · 기준 설계: [승인된 이메일 설계](../specs/2026-10-04-receivable-email-delivery-design.md).
상태: 2026-10-04 사용자 'ok'로 계획과 이 대화에서 순차 구현을 승인. EMAIL-01~04 완료,
EMAIL-03의 감사 ID 계약 실패는 후속 '다음' 요청에서 근본 원인 수정·재검증했다.
EMAIL-05~08 미구현. 미검증 코드는 배포하지 않는다.
후속 사용자 요청으로 기능 완료 후 배포와 ERP 경로의 테스트 이메일 1통도 승인되었다. 구현 검증은 모의 전송으로 분리한다.
각 단계의 테스트 이름은 검증 목표다. 실제 실행 결과는 아래 EMAIL-01 완료 기록과 구분한다.

## 실행 방식과 공통 경계

권장 실행 방식은 **이 대화에서 현재 작업 디렉터리·기존 개발 환경을 재사용하여 순차 구현**이다.
새 작업/환경/에이전트는 만들지 않는다. 기존 Java 21, Node/npm, Docker와 의존성을 재사용한다.
SMTP starter 추가가 필요한 단계에서만 build.gradle.kts의 관련 dependency 한 줄을 추가한다.
기존 사용자 변경을 되돌리거나 현재 미수/수납/검토 변경을 별도 기준선으로 덮어쓰지 않는다.

한 작업마다 실패하는 관련 테스트부터 만들고, 최소 구현 후 그 작업의 테스트와 diff를 검증한다.
완료 게이트는 작업당 객관적 체크 1~10개, PASS/FAIL/UNVERIFIED와 구체적 근거다.
첫 전체 검증에서 FAIL+UNVERIFIED가 3개 이상이면 가장 앞선 원인 계층에서 멈춘다.
2개 이하면 원인을 수정하고 그 작업의 전체 검증 집합을 다시 확인한다.
유효한 검증 결과를 반복하지 않으며 전체 앱 검증은 원칙적으로 8단계 마일스톤에서 수행한다.
실패나 구체적인 추가 영향 증거가 있을 때만 이유를 설명하고 검증 범위를 앞서 넓힌다.

기본 발송 비활성, 테스트는 격리 PostgreSQL·모의 SMTP만 사용한다. 운영 SMTP 접속/비밀 설정
조회/인증서 변경, 실발송, 서비스 재시작, 제품 코드 커밋·푸시·배포는 이번 실행에 포함하지 않는다.
메일 서버 접수를 실제 수신함 배달 완료로 표시하지 않는다. SMS/대량/자동 독촉은 구현하지 않는다.

## 작업 체크리스트

- [x] **EMAIL-01** 스키마·영속 모델과 큐 제약
- [x] **EMAIL-02** 수신 주소·허용/차단 관리
- [x] **EMAIL-03** preview·요청·본문·감사·이력 API
- [x] **EMAIL-04** claim·최신 검증·발송 상태 worker
- [ ] **EMAIL-05** SMTP adapter·안전한 설정
- [ ] **EMAIL-06** 재시도·중단/복구·접수 불명 처리
- [ ] **EMAIL-07** 실제 발송 모달·이력·생성 타입
- [ ] **EMAIL-08** 이메일 마일스톤 검증과 문서 정합화

## EMAIL-01: 스키마·영속 모델과 큐 제약

파일: 새 `backend-spring/src/main/resources/db/migration/V19__message_delivery_schema.sql`,
`domain/messaging/` 아래 contact/message/attempt/retry entity와 repository.
이는 생성 예정 경로이며 기존 migration은 수정하지 않는다. 착수 시 V19 충돌 여부를 확인한다.

1. `MessageSchemaIntegrationTest`로 V18→새 버전 적용, FK/unique/check 제약을 먼저 검증한다.
2. 설계의 네 테이블·연락처 version·메시지 UUID=requestId·미수 active-message partial unique
   제약·조회/claim index를 생성한다. enum 값과 64자 소문자 SHA256 저장 형식을 고정한다.
3. 금액·시도 번호·메일 목적/채널·모든 상태를 DB에서도 제한한다. FK는 cascade delete하지 않는다.
4. 기존 수납/미수 데이터와 일반 연락처를 자동 이관하지 않는다.

검증: 마이그레이션/잘못된 row 거절/active 미수 중복/기존 데이터 불변을 같은 통합 클래스에서 확인.
통합 테스트는 기존 [IntegrationTestSupport](../../../backend-spring/src/test/java/com/erpapproid/core/support/IntegrationTestSupport.java)의
격리 Testcontainers 패턴을 재사용한다.

### EMAIL-01 완료 기록 (2026-10-04)

추가: V19 네 테이블, enum 5종, entity/repository 각 4종. 발송 service/worker/SMTP/API는 아직 없다.
기존 V15→V18 회귀 테스트에는 target("18")만 명시해 역사적 검증 구간을 유지했다.

명령 (`backend-spring/`, exit 0):
`.\gradlew.bat test --tests com.erpapproid.core.api.messaging.MessageSchemaIntegrationTest --tests com.erpapproid.core.api.sales.ReceivableMigrationIntegrationTest`

- PASS 마이그레이션: `upgrades_v18_without_changing_financial_or_generic_contact_data`,
  V18→V19 1건·반복 0건, 미수/수납/일반 연락처 전체 row 정확히 일치, 신규 테이블 초기 0건.
- PASS DB 제약: 연락처/메시지/active·서울 날짜/시도·retry 제약 테스트 4건.
  UNKNOWN 포함 active 중복과 하루 접수 중복 거절, FK 삭제 보호·채널/허용/금액/해시/시도 범위 확인.
- PASS JPA: 네 모델 저장·조회 및 `contact_version_rejects_a_stale_detached_update` 2건.
  초기 version 0, 동시 갱신 후 1, stale merge 거절.
- PASS 회귀·범위 보존: 기존 미수 migration 테스트 1건, 총 8건 실패/오류/skip 0.
  착수 시 SHA256 대비 기존 migration 18/18·작업 외 기존 변경 파일 32/32 동일.
  신규/미추적 관련 파일 17개 whitespace 위반 0, `git diff --check` exit 0.

증거: `backend-spring/build/test-results/test/TEST-com.erpapproid.core.api.messaging.MessageSchemaIntegrationTest.xml`
(7건) 및 `TEST-com.erpapproid.core.api.sales.ReceivableMigrationIntegrationTest.xml` (1건).
실제 SMTP/TLS·운영 활성화·UI는 이 작업의 검증 범위 밖이며 이메일 기능 전체 완료가 아니다.
운영/개발 DB 변경, 기존 서비스 재시작, 실발송, 제품 코드 커밋·푸시·배포는 수행하지 않았다.
다음 작업은 EMAIL-02 수신 주소·허용/차단 관리다.

## EMAIL-02: 수신 주소·허용/차단 관리

파일: `api/messaging/MessageContactController.java`, `MessageContactDto.java`,
`MessageContactService.java`, EMAIL-01 repository, 기존 PartnerController/PartnerRepository.

1. `MessageContactIntegrationTest`로 미등록 null, 일반 contact 미추정, ADMIN/ACCOUNTING 쓰기와
   SALES 조회만 허용, 다른 역할/무인증 403/401을 먼저 검증한다.
2. 설계의 `GET/PUT /partners/{id}/message-contacts/receivable-reminder`를 구현한다.
   ASCII 단일 주소·CR/LF 차단·도메인만 소문자화·동의 확인 근거·버전 충돌을 서버에서 검증한다.
3. 거래처→연락처 잠금 순서와 최초 생성 경합을 처리한다. 주소 변경은 새 확인을 요구한다.
4. 필수 감사와 연락처 변경을 같은 트랜잭션에 둔다. Partner 삭제 시 신규 FK 참조를 409로 처리한다.

검증: 해당 클래스와 기존 PartnerIntegrationTest의 삭제/권한 근접 검사만 수행한다.
허용→차단·동시 version 갱신·감사 실패 롤백·가짜 이메일 추정 0건을 근거로 남긴다.

## EMAIL-03: preview·요청·본문·감사·이력 API

EMAIL-02 완료 기록 (2026-10-04): 주소·허용 근거·최초/기존 version·역할·동시 등록/갱신·
감사 롤백·FK 삭제 보호 테스트 5건과 기존 Partner 권한/삭제 회귀 2건, 실패/오류/skip 0.
targeted Gradle exit 0, 신규 파일 5개 whitespace 검사와 `git diff --check` exit 0.
GET 연락처는 타입이 명확한 `{contact: null 또는 MessageContactResponse}`로 미등록을 표시한다.
PUT 최초 201/변경 200이며 `acknowledged`는 ALLOWED 저장 때 새로 확인한다.
DB·서버·메일은 변경하지 않았으며 이 기록은 EMAIL-03 또는 발송 기능 완료를 의미하지 않는다.

파일: 기존 ReceivableController/ReceivableDto, 새 `ReceivableReminderService.java`,
`ReminderSnapshot.java`, `ReminderEmailTemplate.java`, `api/messaging/MessageController.java`,
기존 AuditService의 내부용 명시적 actor/Trace ID 진입점.

1. `ReceivableReminderRequestIntegrationTest`로 부분수납 잔액·역할·불가능한 미수/수신자·
   hash 변경·동일 키 재응답/다른 입력 충돌·다중 키 경합·감사 롤백을 먼저 검증한다.
2. [기존 preview DTO](../../../backend-spring/src/main/java/com/erpapproid/core/api/sales/ReceivableDto.java)에
   필드를 추가하되 기존 미수/contact 필드를 삭제하거나 의미를 바꾸지 않는다.
3. 스냅샷의 명시적 필드 순서 JSON을 UTF-8 SHA256 소문자로 계산한다. 전용 Clock을 주입해
   서버 업무 날짜는 Asia/Seoul로 일관되게 계산하고 테스트에서 시간을 고정한다.
4. 최초 요청은 미수→거래처→연락처 순서로 잠그고 최신 조건과 expected hash를 확인한다.
   서버 텍스트 템플릿·스냅샷·요청 actor/Trace ID·QUEUED·필수 감사를 원자적으로 저장한다.
5. 같은 키의 재조회는 최신 업무 변경 뒤에도 원래 actor/입력이 같으면 기존 요청을 돌려준다.
   새 요청 키에 대한 active/UNKNOWN 및 서울 날짜 하루 접수 제한은 잠금 아래서 확인한다.
6. `GET /messages/{uuid}`와 미수별 메시지/시도 이력을 구현한다. worker 감사 진입점은 REST에서
   actor를 받지 않으며 기존 요청 감사의 인증 요구·실패 롤백을 유지한다.

검증: 새 요청 클래스, 기존 ReceivableReminderPreviewIntegrationTest/ReceivableCollectionIntegrationTest,
worker 명시적 actor 감사 단위 테스트. SMTP adapter 호출은 아직 0회여야 한다.

### 첫 검증 실패 기록

EMAIL-03 첫 검증 기록 (2026-10-04): targeted Gradle exit 1, 요청 테스트 6/6 실패.
기존 preview 3건·수납 6건·감사 6건은 통과했다 (전체 21건, 실패 6건).
FAIL 최신 잔액 스냅샷 요청, FAIL UUID 재응답/경합, FAIL 감사·큐 원자 저장의 성공 경로.
모두 앞선 감사 저장 계층에서 `value too long for type character varying(32)`로 막혔다.
`V1__init_common.sql:74`의 `audit_logs.entity_no`는 32자지만
`ReceivableReminderService.java:105`는 36자 UUID 문자열을 전달한다.
실패 시 큐는 롤백되었고 409로 반환되었다. 요청 기능 완료로 표시하지 않는다.
AGENTS의 첫 검증 비통과 3개 이상 게이트에 따라 개별 증상 수정/다음 구현/배포/실발송을 중지했다.
다음 조치는 감사 식별자 표현/컬럼 계약의 근본 원인을 먼저 해결하고 전체 EMAIL-03 검증을 다시 실행하는 것이다.
이 실패 기록을 위해 제품 코드를 추가 수정하지 않았다. `git diff --check` exit 0.

### EMAIL-03 완료 기록 (2026-10-04)

사용자 후속 '다음' 요청으로 감사 저장 계층을 수정했다. MESSAGE `entity_no`는 UUID 하이픈만
제거한 32자 소문자 hex로 저장한다. 잘라내기/해시가 아니므로 UUID 비트 손실·충돌 추가가 없고,
API/메시지 PK 및 감사 `after_json.id`는 원래 UUID를 보존한다. V1~V19 migration은 수정하지 않았다.
필수 감사의 MANDATORY 트랜잭션과 요청 actor/Trace ID를 우회하지 않았다.

- PASS 요청·중복/경합: `ReceivableReminderRequestIntegrationTest` 8건. 부분수납 잔액 70원,
  변경 hash/입력/처리자 충돌, 경합 202/409·큐 1건, UNKNOWN·서울 당일 접수 제한,
  등록/권한/무인증 경계와 disabled 503·저장 0건을 확인했다.
- PASS 감사 ID·인증 정보: `queues_server_generated_partial_balance_snapshot_and_replays_without_writes`
  에서 32자 entity_no·원래 UUID JSON·요청 actor·`message-request-trace`·sensitive=true,
  동일 요청 재조회 후 감사 1건·발송 시도 0건을 확인했다. Clock과 접수 fixture 시각/서울 날짜는 고정했다.
- PASS 감사 실패 원자성: `audit_failure_rolls_back_the_queue`에서 강제 DB 감사 실패 500·큐 0건.
- PASS 근접 회귀: 기존 preview 3건·수납 6건·감사 6건, 총 15건 실패/오류/skip 0.
- PASS 범위·문서: 기존 migration 19/19·작업 외 기존 변경 파일 67/67 SHA256 동일,
  관련 문서 경로 검사와 `git diff --check` 및 신규 소스 whitespace 검사 exit 0.

실행 (`backend-spring/`): 먼저 새 감사 검증을 포함한 요청 단일 테스트로 기존 409 실패를 재현했다(exit 1).
수정 후 `.\gradlew.bat test --tests com.erpapproid.core.api.sales.ReceivableReminderRequestIntegrationTest
--tests com.erpapproid.core.api.sales.ReceivableReminderPreviewIntegrationTest
--tests com.erpapproid.core.api.sales.ReceivableCollectionIntegrationTest
--tests com.erpapproid.core.domain.audit.AuditServiceTest`는 exit 0, 23건 실패/오류/skip 0이다.
접수 fixture의 시각도 고정하는 마지막 테스트 보완 뒤 요청 클래스 8건을 다시 실행해 exit 0을 확인했다.
변경하지 않은 근접 회귀 15건은 앞선 유효한 결과를 재사용했다.
최종 증거 XML 4개는 `backend-spring/build/verification/email03-20261004/`에 보존했다.

서버 요청 저장·조회만 완료했다. SMTP worker/adapter·재시도·UI 연결·전체 마일스톤은 아직 아니다.
TODO-004/047는 미완료로 유지하며 운영 배포·추가 실발송·커밋/푸시는 하지 않았다.

## EMAIL-04: claim·최신 검증·발송 상태 worker

파일: `MessageDispatchService.java`, `MessageClaimRepository.java`, `MessageDispatchScheduler.java`,
`MessageDispatchTransactions.java`, `EmailTransport.java`, `EmailSubmission.java`, `EmailSubmissionResult.java`.

1. `MessageDispatchIntegrationTest`에서 모의 EmailTransport로 다중 worker의 한 번 claim,
   잠금 순서·만료/변경·역할 회수·필수 감사 실패를 먼저 검증한다.
2. 한 poll 최대 10건/5초, 한 건 처리 직전 claim, 120초 lease/token을 적용한다.
   skip-locked claim 트랜잭션을 종료한 뒤 별도 preflight로 최신 상태를 확인한다.
3. preflight는 메시지 CLAIMED/token/lease, 현재 미수·연락처 hash, ALLOWED,
   원래 요청 actor의 현재 활성 계정/ADMIN 또는 ACCOUNTING 역할을 확인한다.
   [UserEntity](../../../backend-spring/src/main/java/com/erpapproid/core/domain/user/UserEntity.java)의
   상태/role 관계를 사용하고 JWT의 오래된 역할만으로 dispatch를 허용하지 않는다.
4. 15분 만료/기준일·잔액·주소·허용 변경은 STALE, 권한 회수는 FAILED로 저장한다.
5. 시도·감사·DISPATCHING 커밋 뒤 트랜잭션 밖에서만 EmailTransport를 호출한다.
   클래스 내부 호출로 @Transactional이 무시되지 않도록 별도 bean/TransactionTemplate 경계를 둔다.
6. 같은 token의 결과만 확정한다. SMTP 동안 다른 수납 트랜잭션이 진행 가능함을 검증한다.

검증: 다중 worker·외부 호출 전 커밋·SMTP 중 DB 잠금 비보유·actor/Trace ID 유지·
최신 검증 실패의 외부 호출 0회를 해당 통합 클래스에서 확인한다.

### EMAIL-04 완료 기록 (2026-10-04)

별도 Spring bean의 REQUIRES_NEW 트랜잭션으로 claim/preflight/finalize를 분리했다.
JdbcTemplate은 매개변수 바인딩을 사용하며 기존 JpaTransactionManager와 같은 트랜잭션에 참여한다.
HTTP 호출/인증 컨텍스트가 없는 worker도 저장된 요청 actor/Trace ID로 필수 감사를 기록한다.
transport에는 불변 본문 스냅샷만 전달하고 toString은 메시지 ID만 표시한다.
오류는 enum의 안전한 코드만 저장하며 전송 예외 원문·수신자·본문·비밀값을 로그에 싣지 않는다.

- PASS 다중 worker: `multiple_workers_submit_a_single_committed_attempt_without_request_authentication`,
  동시 두 worker는 true/false·전송 1회·시도 1건·SMTP_ACCEPTED. `locked_queue_rows_are_skipped_instead_of_blocking_other_workers`
  는 잠긴 첫 행을 건너뛰고 두 번째만 claim하며 lease=120초다. poll 10+1건 및 scheduler 5초 테스트도 통과했다.
- PASS 최신 조건: `changed_business_snapshots_are_stale_without_transport_calls` 6개(잔액/주소/허용/고객/만료/서울 기준일),
  현재 역할/잠김/퇴사 3개, 잘못된 token·만료 lease 검사. 변경/만료 STALE, 권한 FAILED·전송 0회.
- PASS 커밋·잠금 경계: transport 진입 시 실제 트랜잭션 없음·DISPATCHING·시도/감사 1건 확인.
  `collections_can_commit_while_the_transport_is_running`은 전송 중 실제 수납 API 200·수납액 30→50,
  발송 본문은 최종 검증 당시 잔액 70원 스냅샷을 유지한다. 네트워크/수납의 원자성을 주장하지 않는다.
- PASS 결과/token: `result_finalization_requires_the_matching_token_and_is_single_use`에서 잘못된 token false,
  같은 token 첫 결과 true/반복 false. 예기치 않은 transport 예외는 UNKNOWN·안전 코드·추가 전송 0회다.
- PASS 비활성·감사 실패: 비활성 poll/claim/전송 0회·큐 QUEUED 유지, scheduler의 두 플래그 검증,
  preflight 감사 실패 시 CLAIMED 유지·시도 0건·외부 호출 0회. 외부 호출을 감싼 ambient 트랜잭션도 거절한다.
- PASS 회귀·범위: 기존 요청 8건·감사 6건 통과. migration 19/19·기존 변경 파일 69/69·build.gradle.kts
  SHA256 동일, 신규 파일 9개 whitespace·관련 문서 경로 및 `git diff --check` 통과.

첫 실패 재현은 미구현 dispatch의 단일 테스트였다(exit 1).
구현 후 첫 검증은 총 33건 중 2건 실패: 테스트가 users_status_check에서 허용하지 않는 상태를 넣었다.
근거는 `V1__init_common.sql:40`의 활성/잠김/퇴사 계약이다. worker/migration을 변경하지 않고
fixture를 잠김/퇴사로 수정했으며, AGENTS의 비통과 2개 이하 규칙에 따라 동일 검증 집합을 전부 재실행했다.

명령 (`backend-spring/`, exit 0):
`.\gradlew.bat test --tests com.erpapproid.core.api.messaging.MessageDispatchIntegrationTest
--tests com.erpapproid.core.api.messaging.MessageDispatchSchedulerTest
--tests com.erpapproid.core.api.sales.ReceivableReminderRequestIntegrationTest
--tests com.erpapproid.core.domain.audit.AuditServiceTest`

최종 33건: worker 18·scheduler 1·요청 8·감사 6, 실패/오류/skip 0.
XML 4개는 `backend-spring/build/verification/email04-20261004/`에 보존한다.
worker가 호출할 실제 SMTP adapter는 없다. 기본 비활성·모의 transport만 검증했으며 운영 설정/서비스를
변경하거나 메일을 보내지 않았다. 자동/수동 재시도 및 만료 CLAIMED/DISPATCHING 복구는 EMAIL-06 후속이다.
필수 결과 저장 실패 시 DISPATCHING을 재claim하지 않아 중복 호출을 막지만, 복구 완료로 표현하지 않는다.
TODO-004/047는 미완료 유지, 커밋·푸시·배포 없음. 다음은 EMAIL-05 SMTP adapter·안전한 설정이다.

## EMAIL-05: SMTP adapter·안전한 설정

파일: `SmtpEmailTransport.java`, `EmailDeliveryProperties.java`, `EmailDeliveryConfiguration.java`,
application.yml/test 설정의 관련 항목, build.gradle.kts의 mail starter 추가만.

1. `EmailDeliveryConfigurationTest`와 `SmtpEmailTransportTest`를 먼저 만든다.
   loopback 모의 SMTP 또는 test double로만 테스트한다. 새 외부 메일 서비스는 만들지 않는다.
2. 기본 enabled=false, 활성 시 고정 sender/envelope-from·SMTP 인증·587 STARTTLS required·
   hostname verification·필요한 truststore를 검증한다. 누락/인증/TLS 실패는 fail-closed다.
3. 연결/읽기/쓰기 5/3/5초 timeout, debug=false, 단일 recipient·고정 Message-ID를 적용한다.
4. ACCEPTED/명시적 미접수 일시/명시적 미접수 영구/UNKNOWN으로 결과를 분류한다.
   예외의 중첩 원인은 검사하지만 원문·주소·비밀값을 로그/응답에 싣지 않는다.
5. 최초 구현은 본문 제출 전에 연결이 실패했다는 증거 또는 단일 수신자에 대한 명시적
   SMTP 4xx/5xx 응답만 미접수로 분류한다. 불명확한 일반 timeout은 UNKNOWN이다.

검증: 모의 서버가 받은 제목/본문/recipient/Message-ID, 분류와 TLS/누락/비활성 테스트.
기본 비활성 컨텍스트에서는 운영 SMTP 연결이나 worker 전송이 0회임을 확인한다.

## EMAIL-06: 재시도·중단/복구·접수 불명 처리

파일: EMAIL-04 worker/service/repository, `MessageRetryService.java`, MessageController,
필요한 복구 상태 predicate와 시도/재시도 기록.

1. `MessageRecoveryIntegrationTest`와 `MessageRetryIntegrationTest`로 crash 지점을 재현한다.
   Clock/모의 adapter를 사용하고 긴 실제 sleep로 시간 테스트를 만들지 않는다.
2. 확실한 미접수 일시 실패만 30/120초 지연, 최초 포함 총 3회 한도를 적용한다.
   자동·수동 재시도 모두 새 preflight를 거치며 TTL/hash/허용/계정 조건을 다시 검사한다.
3. 수동 retryRequestId와 actor/message의 immutable 기록을 QUEUED 전이/감사와 원자 저장한다.
   같은 키 재요청은 기록을 재사용하고 다른 actor/message 입력은 409다.
4. CLAIMED 만료는 미호출이므로 재확보, DISPATCHING 만료는 UNKNOWN으로만 변경한다.
   응답 유실·접수 후 DB/감사 실패·token 변경 뒤 늦은 결과를 다르게 처리한다.
5. UNKNOWN은 새 요청·자동/수동 retry를 차단한다. 같은 token의 확실한 늦은 결과만
   한 번 확정하며 잘못된 token이나 이미 확정된 상태로 덮어쓰지 않는다.

검증: 한도/지연/무한 재시도 없음, SMTP 성공 뒤 DB 실패의 재발송 0회, stale token 거절,
same-token late finalize 단일 처리, 최초 요청·수동 retry 각각의 키 재사용.

## EMAIL-07: 실제 발송 모달·이력·생성 타입

파일: 기존 `src/api/receivables.ts`, 새 `src/api/messages.ts`, 기존 ReceivableReminderDialog,
새 MessageContactForm/MessageDeliveryHistory, 실제 `src/api/generated/core.ts`와 관련 테스트.

1. `messages.test.ts`, 연락처/이력 컴포넌트 테스트, 기존 독촉 모달 테스트에 신규 흐름을 추가한다.
2. 등록 연락처/허용 상태 저장 구역, 이메일-only 선택, SALES 읽기/검토만 허용하는 UI를 연결한다.
3. 기대 hash·등록 연락처·확인 체크로 요청한다. 필터/대상/입력 변경 시 검토를 해제한다.
4. actor/미수별 sessionStorage에는 UUID/입력 해시만 저장한다. 응답 유실/복원 시 먼저
   `GET /messages/{uuid}`로 조회하고 404 외 오류를 미저장으로 추정하지 않는다.
   메모리에서 원래 입력을 잃은 경우 새 확인 없이 옛 키로 변경된 입력을 보내지 않는다.
5. 요청 접수/메일 서버 접수/실패/STALE/UNKNOWN을 실제 응답으로 표시하고 이력을 재조회한다.
   UNKNOWN retry 금지와 서버 조건을 UI에서도 안내한다. 주소/본문은 브라우저 영속 저장하지 않는다.
6. 기존 [타입 생성 스크립트](../../../hud-admin-template/scripts/generate-api-types.mjs)를
   실제 변경된 Springdoc JSON에 사용한다. 손으로 생성 타입을 조작하지 않는다.

검증: 관련 API/컴포넌트/기존 미수·수납 모달 테스트, TypeScript·변경 파일 ESLint,
OpenAPI 타입 생성 반복 일치. 실제 브라우저 색상 대비를 JSDOM 결과로 인증하지 않는다.

## EMAIL-08: 이메일 마일스톤 검증과 문서 정합화

파일: CLAUDE.md, docs/api-spec.md, docs/receivables-reminders.md, 새
`docs/receivables-email-delivery.md`, roadmap, 필요 시 기존 isolated E2E/CI의 migration guard.

1. 전체 backend test, frontend test/lint/build, OpenAPI 생성 일치와 기존 수납·핵심 거래 회귀를 실행한다.
2. [현재 E2E 실행 스크립트](../../../scripts/run-phase1-e2e.ps1)와
   [CI](../../../.github/workflows/phase1.yml)는 V15를 고정 확인한다. 새 migration을 포함한
   실제 버전과 일치하도록 관련 guard/문서만 갱신한다. DB 이름/격리/secret guard는 완화하지 않는다.
3. backend 변경을 반영한 isolated E2E 이미지만 필요한 경우 빌드한다. 메일은 disabled이며
   실제 SMTP endpoint/계정을 주입하지 않는다. [기존 격리 원칙](../../phase1-e2e.md)을 유지한다.
4. 구현 검증 기준별 테스트 이름/개수·명령 exit·일치 비교를 기록한다. 실패를 재시도로 숨기지 않는다.
5. 이메일 구현/모의 검증만 문서에 표시한다. 운영 활성화·실발송·최종 배달·원격 CI는 별개다.
   TODO-004는 이메일 완료 근거와 제외 채널을 명시하고 TODO-047 전체는 후속 범위를 남긴다.

검증: 설계 §8의 8개 기준군을 아래 표와 대조하고 모든 필수 항목 PASS일 때만 이메일
마일스톤 완료로 보고한다. UNVERIFIED는 이유와 후속을 별도로 적고 PASS로 간주하지 않는다.

## 설계 검증 기준 대응표

| 설계 §8 기준 | 구현 작업·주요 검증 |
| --- | --- |
| 1 연락처 | EMAIL-01/02: schema·역할·version·차단·FK·감사 롤백 |
| 2 요청 | EMAIL-03: 서버 템플릿·잔액/hash·UUID·동시 요청·하루 접수 제한 |
| 3 큐 | EMAIL-04: claim·preflight·외부 호출 전 commit·잠금 경계 |
| 4 SMTP | EMAIL-05/06: 모의 수신·TLS/timeout·미접수/UNKNOWN 분류·시도 한도 |
| 5 복구 | EMAIL-06: lease·crash·DB 실패·token·late finalize·재발송 차단 |
| 6 UI | EMAIL-07: 실제 API·권한·키 복원·실제 상태/이력·기존 수납 회귀 |
| 7 계약/설정 | EMAIL-05/07/08: enabled=false·fail-closed·실제 OpenAPI·타입/lint |
| 8 문서 | EMAIL-08: source/diff·이메일/SMS·운영/실배달의 분리 |

## 검증 명령과 증거

아래 명령은 구현 후 실행할 명령이며 이번 계획 작성 중 실행하지 않는다.
새 테스트 클래스는 각 작업에서 만들고 그 뒤 targeted 명령으로 실행한다.

```powershell
# backend-spring: 작업별 근접 테스트 예시
.\gradlew.bat test --tests com.erpapproid.core.api.messaging.MessageContactIntegrationTest
.\gradlew.bat test --tests com.erpapproid.core.api.sales.ReceivableReminderRequestIntegrationTest
.\gradlew.bat test --tests com.erpapproid.core.api.messaging.MessageDispatchIntegrationTest
.\gradlew.bat test --tests com.erpapproid.core.api.messaging.MessageRecoveryIntegrationTest

# hud-admin-template: 작업별 근접 테스트/검사
npm run test -- src/api/messages.test.ts src/pages/sales/ReceivableReminderDialog.test.tsx
npx tsc -b
npx eslint src/api/messages.ts src/pages/sales/ReceivableReminderDialog.tsx
# 변경된 코드가 실행 중인 격리 E2E API 예시. 미기동/옛 이미지에는 실행하지 않음
$env:OPENAPI_CORE_URL = 'http://127.0.0.1:38081/v3/api-docs'
npm run generate:api-types

# 마일스톤에서만: backend-spring / hud-admin-template / 저장소 루트 각각 실행
.\gradlew.bat test
npm run test -- --maxWorkers=2
npm run test:api-types
npm run lint
npm run build
& .\scripts\run-phase1-e2e.ps1 -Build
git diff --check
```

OpenAPI는 변경된 코드가 실제 실행 중인 endpoint 또는 격리 통합 테스트에서 저장한 JSON을
사용한다. 실행되지 않은 옛 API에 타입을 맞추지 않는다. 이미 실행 중인 다른 개발/운영 서비스는
재시작하지 않으며 임시 실행이 필요하면 기존 포트/DB와 분리된 test 환경만 사용한다.
보고서 증거는 backend `build/test-results/test/*.xml`, frontend Vitest 결과와
`test-results/e2e.xml`이다. 민감한 trace/메일 내용을 Git이나 Hindsight에 올리지 않는다.

## 계획 작성 검증과 인계

계획 작성의 완료 체크는 설계 대응 8/8, source 경로·명령 확인, 기존 변경 파일의 SHA256
보존 및 문서 diff 검사다. 앱 기능 테스트/실제 SMTP 검증은 이 문서 작성의 완료 조건이 아니다.
계획 승인과 **이 대화에서 순차 구현** 선택 후 EMAIL-01의 관련 테스트부터 시작한다.
새 에이전트/별도 작업으로의 전환은 사용자가 명시적으로 요청할 때만 한다.
