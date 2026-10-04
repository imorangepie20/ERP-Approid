# 독촉 이메일 발송 설계

2026-10-04 · TODO-004 및 TODO-047의 이메일 범위.
상태: 대화에서 승인한 설계를 문서화했으며, 이 문서의 사용자 검토 전이다.
실행 코드·DB 마이그레이션·SMTP 설정·운영 배포·실제 발송의 완료 기록이 아니다.

## 1. 목적과 범위

미납관리의 기존 독촉 검토 모달에서 담당자가 한 건의 미수를 확인하고 이메일을
요청하면, Spring 서버가 권한·최신 미수·수신 권한을 검증해 영속 큐에 저장한다.
기존 `mail.approid.team`을 사용하며 요청, 발송 시도, 결과를 실제 DB에서 조회한다.
모달 확인이나 큐 저장을 발송 성공으로 표시하지 않는다.

- 포함: 단일 미수/단일 수신자/일반 텍스트 이메일, 등록 수신 주소·허용/차단 관리,
  DB 큐, 제한된 재시도, 중복방지, 감사, 결과 조회와 기존 모달 연결.
- 제외: SMS/LMS, 자동 정기 독촉, 대량 발송, 견적/PDF·첨부파일, 임의 제목/발신자,
  반송메일 수집·최종 배달/열람 추적, 새 브로커·외부 유료 공급사.
- 이번 구현 검증은 모의 SMTP만 사용한다. 거래처에 실제 메시지를 보내거나 메일 서버를
  변경하지 않는다. 운영 활성화·실제 테스트 메일은 별도 운영 요청으로 수행한다.
- TODO-004는 이메일 기능의 검증 결과를 명시하고, TODO-047 전체는 SMS 등 후속 범위가
  남으므로 전체 완료로 체크하지 않는다. 이 설계만으로 어느 체크박스도 변경하지 않는다.

## 2. 현행 근거와 선택

현재 [독촉 검토 계약](../../receivables-reminders.md)은 미발송 읽기 흐름이다.
[ReceivableController](../../../backend-spring/src/main/java/com/erpapproid/core/api/sales/ReceivableController.java)는
조회와 preview를 ADMIN/SALES/ACCOUNTING에 허용하지만 발송 endpoint는 없다.
[PartnerEntity](../../../backend-spring/src/main/java/com/erpapproid/core/domain/partner/PartnerEntity.java)의
`contact`는 일반 문자열이며 이메일 등록·수신 권한의 근거가 아니다.
[수납 서비스](../../../backend-spring/src/main/java/com/erpapproid/core/api/sales/ReceivableCollectionService.java)의
미수 잠금·요청 UUID·필수 감사 패턴을 이어 사용한다.

선택은 기존 Spring + PostgreSQL의 영속 큐다. HTTP 요청 안에서 SMTP를 호출하는 방식은
네트워크 장애·재전송·재시작 이력을 다루기 어렵고, 별도 브로커는 첫 단일 채널 범위에
필수적이지 않다. 기존 개발 환경, JWT client, Flyway, 공통 오류/Trace ID를 재사용한다.

SMTP adapter는 [Spring Boot 3.5의 JavaMailSender](https://docs.spring.io/spring-boot/3.5/reference/io/email.html)를
사용한다. 유한한 연결/읽기/쓰기 timeout을 명시한다.
[RFC 5321 §4.2.5·§6.1](https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.5)에 따라
SMTP 접수와 최종 배달을 구분하고, 완료 응답 유실의 중복 위험을 보수적으로 처리한다.
이는 애플리케이션 정책이며 SMTP의 exactly-once 보장으로 설명하지 않는다.

## 3. 구성과 데이터 경계

서버 구성은 책임별로 나눈다.

- `api/messaging`: 연락처·메시지 이력 DTO/controller, 검증과 권한 경계.
- `domain/messaging`: 연락처, 메시지, 시도 entity/repository.
- `ReceivableReminderService`: 미수 검증·서버 본문 생성·요청 중복 판정·감사.
- `MessageDispatchService`: 짧은 DB claim/preflight/finalize 트랜잭션과 상태 전이.
- `EmailTransport`: 외부 전송 interface와 SMTP adapter. 업무 금액을 계산하지 않는다.
- React의 기존 `ReceivableReminderDialog`: 등록 연락처·내용 검토·요청·실제 결과 조회.

Flyway는 현재 V18 뒤 새 migration을 추가한다. 기존 migration·미수·수납을 재작성하지 않는다.
다음 네 테이블을 새로 만든다.

| 테이블 | 저장 데이터와 제약 |
| --- | --- |
| `partner_message_contacts` | partner FK, purpose=`RECEIVABLE_REMINDER`, channel=`EMAIL`, 단일 email, permission=`PENDING/ALLOWED/BLOCKED`, version, 확인 근거/처리자/시각. partner+purpose+channel unique. |
| `outbound_messages` | UUID id/requestId, 미수/거래처/연락처 FK, 요청 actor/Trace ID, 입력 해시, 미수·연락처 스냅샷 해시, 제목/본문·잔액·기준일·수신자 스냅샷, template version, 상태, 만료/재시도/claim 시각·토큰. requestId unique. |
| `message_delivery_attempts` | message FK, attempt 번호, worker claim token, 시작/종료 시각, 안전한 결과 코드, SMTP Message-ID, 요청 actor/Trace ID. message+attempt 번호 unique. |
| `message_retry_requests` | retryRequestId UUID unique, message FK, retry 요청 actor/Trace ID·입력 해시·시각. 재시도 요청 재전송을 시도 번호와 별도로 판정하는 불변 기록. |

원금/잔액은 기존 integer KRW를 사용한다. 업무 날짜는 Asia/Seoul, 처리 시각은 Instant다.
FK는 이력을 보존하며 연쇄 삭제하지 않는다. 등록 연락처가 참조하는 거래처 삭제는 409로
차단하고 기존 Partner 삭제 검증에 이 관계만 추가한다. 채널/목적/상태·금액·시도 번호는
DB 제약으로도 검증한다. 일반 연락처를 자동 이관하거나 ALLOWED로 초기화하지 않는다.

제목·본문·주소는 권한이 필요한 업무 데이터로 DB에만 보존한다. 일반 로그/metrics에는
본문·주소·인증값·SMTP 원문 오류를 기록하지 않고 메시지 ID와 안전한 코드만 남긴다.
SMTP 비밀값은 메시지/시도/감사 객체에 넣지 않는다. Hindsight에 업무 데이터를 업로드하지 않는다.

## 4. 권한과 수신자 관리

- 조회/검토/이력: 기존 ADMIN/SALES/ACCOUNTING. 무인증 401, 다른 역할 403.
- 이메일 주소의 등록·허용/차단 변경, 발송 요청·안전한 재시도: ADMIN/ACCOUNTING.
  기존 SALES의 거래처 master 수정 권한을 발송 권한으로 확대하지 않는다.
- 수신자 관리는 독촉 모달의 별도 구역에서 명시적으로 저장한다. 기존 일반 `contact`는
  참고값일 뿐 저장/선택/허용 상태를 자동 결정하지 않는다.
- ALLOWED에는 담당자의 수신자·업무 안내 수신 권한 확인 체크와 1~256자의 근거가 필요하다.
  확인 actor/시각을 서버가 저장한다. 이는 담당자의 확인 기록이며 시스템이 주소 소유권이나
  법적 동의를 자동 인증했다는 뜻이 아니다. 주소 변경 시 허용 확인을 다시 요구한다.
- PENDING/BLOCKED는 발송 불가다. 차단·변경 시 version을 올린다. 예상 version이 다르면
  409로 갱신을 요구한다. 거래처당 이 목적의 활성 이메일은 하나다.
- 주소는 단일 ASCII mailbox, 최대 254자이며 CR/LF·복수 주소·display name을 거절한다.
  도메인만 소문자로 정규화하고 local-part는 임의로 소문자로 바꾸지 않는다.
  클라이언트 입력 형식 검사는 보조이며 서버 검증이 권위다.

## 5. API와 화면 계약

모든 endpoint는 `/api/core` 아래에 둔다. Jakarta Validation, DomainException,
공통 ErrorResponse/Trace ID, 실제 Springdoc 생성 타입을 사용한다.

| Endpoint | 입력/응답·권한 |
| --- | --- |
| `GET /partners/{id}/message-contacts/receivable-reminder` | 등록 연락처 또는 명시적 null, version·허용 상태. 조회 권한. |
| `PUT /partners/{id}/message-contacts/receivable-reminder` | email, permission, expectedVersion(최초 null), confirmationNote/acknowledged. ADMIN/ACCOUNTING. 최초 생성 201, 변경 200. |
| `GET /receivables/{id}/reminder-preview` | 기존 필드를 유지하고 messageContact, snapshotHash, emailDispatchEnabled를 추가. 기존 읽기 계약은 유지한다. |
| `POST /receivables/{id}/reminders` | requestId UUID, contactId, expectedSnapshotHash, note(최대 1,000자), acknowledged=true. EMAIL/발신자/제목/본문은 서버 결정. 신규 202, 동일 요청 재조회 200. |
| `GET /receivables/{id}/reminders` | page/size와 id 내림차순의 실제 메시지·시도 요약. 기본 size 20, 최대 100. 조회 권한. |
| `GET /messages/{uuid}` | 해당 메시지의 권한 보호된 내용·상태·시도 이력. 조회 권한. |
| `POST /messages/{uuid}/retry` | retryRequestId UUID. 확실히 미접수인 재시도 가능 실패만 허용, ADMIN/ACCOUNTING. 신규 202/동일 재요청 200. |

preview hash는 미수 ID/고객명/기일/상태/원금/수납액/잔액/서울 기준일 및 등록 연락처
ID/주소/version/permission을 서버가 정해진 형식으로 SHA256 계산한다. 해시는 권한 증명이
아니라 검토한 스냅샷과 서버의 최신 값을 비교하는 concurrency guard다.

POST는 미수와 등록 연락처를 다시 잠금·조회한다. 양수 잔액의 날짜 연체 미수만 허용하며,
연락처의 거래처/목적/EMAIL/ALLOWED를 검증한다. 미수·연락처 변경은 409, 입력 오류는 400,
없음은 404, 미납/허용 조건 위반은 422, 발송 설정 비활성은 503이다.
서버는 예상 hash가 같을 때만 서버 템플릿으로 내용과 요청 이력을 원자적으로 저장한다.

템플릿 `RECEIVABLE_REMINDER_EMAIL_V1`은 기존 검토 내용의 청구번호·고객명·기일·현재 잔액·
서울 기준일·추가 안내를 사용한다. 계좌/연체료/법적 조치를 만들어 넣지 않는다.
note는 trim 후 최대 1,000자, HTML이 아닌 일반 텍스트다. 제목은 서버가 생성하고 줄바꿈을
허용하지 않는다. SMTP From/Return-Path는 외부 설정의 고정 승인 주소다.

UI는 SALES에 읽기·검토·이력만 보여 주고 발송/등록 변경을 비활성화한다. 이메일만 활성 채널이며
SMS는 준비 중이다. ALLOWED 연락처를 선택한 후 내용 확인 체크를 요구한다. 필터/대상/연락처/
추가 안내 변경은 체크를 해제한다. 통신 오류 재시도는 동일 requestId를 보존하며 버튼을 중복
클릭해 새 키를 만들지 않는다. sessionStorage에 ID·입력 해시만 보관하고 주소/본문은 저장하지 않는다.
저장 직후는 '발송 요청 접수', SMTP 성공은 '메일 서버 접수'로 표시한다. UNKNOWN은 '접수 여부 확인 필요'다.

## 6. 중복방지·감사·발송 상태

message UUID는 최초 requestId와 동일하게 저장한다. 응답 유실/세션 복원 시 이 UUID로
`GET /messages/{uuid}`를 먼저 조회해 이미 저장된 요청을 확인하며 새 요청 키를 만들지 않는다.
미저장 404인 경우만 원래 입력·키로 재요청한다. 다른 오류는 미저장으로 추정하지 않는다.
동일 requestId의 actor/미수/연락처/expected hash/note/확인 입력이 같으면 기존 메시지를
돌려주고 DB 쓰기·SMTP 호출을 추가하지 않는다. 다르면 409다. 새 키여도 같은 미수의
QUEUED/CLAIMED/DISPATCHING/RETRY_WAIT/UNKNOWN 메시지가 있으면 차단한다.
같은 미수는 서울 날짜 하루에 SMTP_ACCEPTED 한 건으로 제한한다. 동시 요청은 미수 잠금과
DB active-message unique 제약으로 직렬화한다. SMTP Message-ID는 메시지 UUID에서 한 번
생성해 시도마다 유지하지만, 수신 서버가 이것으로 중복을 제거한다고 가정하지 않는다.

| 상태 | 의미·다음 동작 |
| --- | --- |
| `QUEUED` | 요청/감사 저장 완료, 외부 전송 전. worker claim 가능. |
| `CLAIMED` | worker가 claimToken과 120초 lease로 확보. SMTP 호출은 아직 금지. |
| `DISPATCHING` | 최신 업무 검증·시도/감사가 커밋됐고 외부 전송 시작 허용. 자동 재claim 금지. |
| `RETRY_WAIT` | 확실한 미접수 일시 실패, nextAttemptAt 도래 후 QUEUED로 이동. |
| `SMTP_ACCEPTED` | SMTP 제출 성공을 DB에 기록. 최종 배달/열람은 알 수 없음. 재발송 불가. |
| `FAILED` | 확실한 미접수 실패 또는 시도 한도. 안전한 사유만 표시. 허용된 경우 수동 재시도. |
| `STALE` | 만료·수납/연락처/기준일 등 변경. 기존 내용을 보내지 않고 새 검토를 요구. |
| `UNKNOWN` | 호출 이후 timeout/응답 유실/worker 중단/결과 DB 저장 실패. 자동·수동 재발송 금지. |

worker는 5초 간격으로 한 번의 poll에서 최대 10건을 한 건씩 claim·처리한다.
claim은 skip-locked와 토큰으로 다중 worker가 같은 메시지를 중복 실행하지 못하게 한다.
preflight 진입 시 CLAIMED 상태·claimToken 일치·lease 유효를 다시 확인하며, 이미 회수되었거나
만료된 claim으로 SMTP를 시작하지 않는다. 한 건 처리 직전에 claim해 대기 중 lease 만료를 피한다.
claim 트랜잭션을 끝낸 뒤, preflight는 미수→거래처→등록 연락처→메시지 순서로 잠근다.
연락처 변경은 거래처→등록 연락처 순서를 사용하며 잠금 순환을 만들지 않는다.
preflight는 현재 actor의 계정/발송 역할도 확인하고 권한 회수 시 외부 호출 없이 FAILED로 종료한다.
요청 후 15분 경과 또는 최초 hash와 최신 값의 차이는 STALE로 종료한다.

preflight에서 시도/감사와 DISPATCHING을 커밋한 다음 DB 트랜잭션 밖에서 SMTP를 호출한다.
SMTP 동안 미수 수납을 잠그지 않는다. 따라서 검증 직후 수납이나 연락처 차단이 발생하는
아주 짧은 경합을 완전히 제거할 수 없으며, 본문 금액은 표시한 기준일과 최종 검증 시점의
스냅샷이다. 네트워크 제출과 DB 변경을 하나의 원자적 거래로 표현하지 않는다.
외부 호출 직전에 발송 활성 플래그를 다시 확인한다.

SMTP adapter는 ACCEPTED, DEFINITELY_NOT_ACCEPTED_TRANSIENT,
DEFINITELY_NOT_ACCEPTED_PERMANENT, UNKNOWN을 구분한다.
자동 재시도는 DATA 제출 전 연결 실패 또는 단일 수신자 제출의 명시적인 SMTP 4xx
미접수를 확인한 경우에만 허용한다. 5xx·인증/TLS 실패는 자동 재시도하지 않는다.
일반 예외/timeout을 안전한 미접수로 추정하지 않는다. 최초 포함 최대 3회,
일시 실패는 30초/120초 지연하며 매번 preflight를 반복한다.
수동 retry도 명시적 미접수·설정 활성·현재 hash 일치·총 3회 미만이 모두 필요하다.
재시도 요청과 QUEUED 전이는 한 트랜잭션이다. 동일 retryRequestId의 actor/message 입력이
같으면 현재 메시지를 돌려주고 시도를 추가하지 않으며, 다르면 409다.
UNKNOWN에는 retry endpoint를 허용하지 않는다.

CLAIMED lease 만료는 SMTP 미호출 상태이므로 QUEUED로 회수한다. DISPATCHING 만료는
UNKNOWN으로만 바꾼다. 완료 저장은 claimToken을 비교하며, UNKNOWN으로 회수한 뒤에도
원래 worker의 확실한 결과가 도착하면 같은 토큰의 결과만 한 번 확정할 수 있다.
UNKNOWN의 운영 확인은 Message-ID로 제출 서버 기록을 대조하는 별도 절차이며 이번에
관리자 강제 재발송·임의 상태 수정 API를 만들지 않는다.

요청/연락처 변경/재시도는 기존 필수 감사와 같은 DB 트랜잭션이며 감사 실패 시 롤백한다.
worker 시도·상태 이력은 불변 기록으로 저장하고 요청 actor/Trace ID를 명시적으로 전달한다.
현재 AuditService가 요청 인증 컨텍스트를 필요로 하므로, 비동기 audit용 명시적 actor/Trace ID
진입점만 추가한다. 별도 시스템 actor를 꾸며 내거나 인증 컨텍스트를 가짜로 만들지 않는다.
preflight 감사 실패는 SMTP 호출 0회다. SMTP 접수 후 DB 실패는 외부 발송을 롤백했다고
주장하지 않고 DISPATCHING/UNKNOWN 이력으로 보존해 재전송을 차단한다.

## 7. 설정과 운영 활성화 경계

`erp.messaging.email.enabled=false`가 기본이다. 설정이 꺼지면 연락처/이력 읽기는
가능하지만 요청/retry/dispatch는 불가다. 테스트 profile은 모의 전송만 사용한다.
활성 설정에는 host, port, SMTP username/password, 고정 from/envelope-from, TLS 방식과
필요한 신뢰 저장소 경로가 모두 필요하다. 값은 저장소 밖의 기존 비밀 설정으로 주입한다.
프로덕션에서 빠진 설정이나 TLS 검증 실패는 fail-closed하며 mail debug는 끈다.

초기 전송 방식은 authenticated submission + 587 STARTTLS required,
hostname verification이다. 기존 `mail.approid.team`의 올바른 DNS/경로·인증서 신뢰·계정
준비가 충족되어야 운영 활성화할 수 있다. 자체 인증서가 필요하면 정확한 CA/서버 인증서를
별도 truststore로 지정하며 trust-all/검증 해제/IP로 hostname 우회를 하지 않는다.
timeout은 연결 5초/읽기 3초/쓰기 5초다. 테스트의 무인증 모의 SMTP는 test profile에만 허용한다.

기존 서버 로컬 MTA 테스트는 ERP 컨테이너의 SMTP 인증/TLS 준비를 증명하지 않는다.
이번 구현은 계정 생성, 인증서/메일 서버/Cloudflare 변경, 기존 서비스 재시작, 운영 메일
설정 읽기/출력, 커밋·푸시·배포 또는 실제 발송 권한을 자동으로 포함하지 않는다.
설계 문서 자체의 로컬 단독 커밋은 제품 코드의 커밋/푸시/배포와 구분한다.

## 8. 구현 검증 기준

1. 연락처: 최초 미등록/일반 contact 미추정, 허용 근거·버전 충돌, 주소 변경 재확인,
   역할별 401/403, 차단, FK 이력 보존, 감사 실패 롤백.
2. 요청: 부분수납 잔액으로 서버 템플릿 생성, 완료/비연체/미등록/차단 거절,
   오래된 hash 409, 동일 키 재응답·다른 입력 충돌, 다중 키 동시 요청 한 건, 하루 접수 제한.
3. 큐: Testcontainers PostgreSQL 다중 worker claim, 외부 호출 전 감사 커밋,
   최신 잔액/주소/동의/권한/기준일 변경과 만료 차단, SMTP 중 DB 잠금 비보유.
4. SMTP: 모의 서버 수신 내용·단일 recipient/Message-ID, 접수 상태 구분,
   명시적 4xx 지연/3회 한도, 5xx·인증/TLS 실패, 응답 유실 UNKNOWN·중복 호출 차단.
5. 복구: CLAIMED 재확보·DISPATCHING 만료 UNKNOWN, SMTP 성공 후 DB/감사 실패,
   이전 claimToken 결과 차단·동일 토큰 늦은 결과 단일 확정, 무한 재시도 없음.
6. UI: 등록/차단·최신 정보 변경·역할 제한·요청 UUID 유지·이력 재조회·오류/Trace ID,
   요청 접수와 SMTP 접수/UNKNOWN의 문구 차이, 미구현 SMS 비활성, 기존 수납 회귀.
7. 계약/설정: 실제 Springdoc 타입 재생성 일치, TypeScript와 변경 파일 lint,
   enabled=false/누락/TLS fail-closed, 모의 SMTP 외 네트워크 전송 0회.
8. 문서: source 링크·diff 검사, TODO-004 이메일과 TODO-047 남은 범위 구분,
   운영 활성화·실배달 등 검증하지 않은 사항을 완료로 표시하지 않음.

작은 변경은 해당 테스트 클래스/파일만 실행한다. 영향 범위의 전체 검증은 이메일
마일스톤 완료 또는 제품 코드 커밋 직전에 실행하고 여전히 유효한 결과는 재사용한다.
기존 미커밋 미수/수납/검토 변경과 build.gradle.kts의 사용자 변경을 보존한다.

## 9. 문서 검토와 다음 단계

이 문서의 범위·경합 한계·UNKNOWN 처리·권한/수신 허용 정책을 사용자에게 검토받는다.
승인 후 구현 계획을 작성하고 그 계획과 실행 방식의 확인 뒤 제품 코드 작업을 시작한다.
개발 순서는 연락처/큐 schema → 요청/감사 → worker/SMTP → 모달/이력 → 이메일 마일스톤 검증이다.
설계 작성은 발송 기능 구현이나 roadmap 항목 완료를 의미하지 않는다.
