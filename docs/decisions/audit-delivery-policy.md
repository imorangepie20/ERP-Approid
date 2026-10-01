# 감사 로그 전달 및 실패 정책

## 결정

Phase 1의 모든 인증된 업무 쓰기는 업무 데이터와 `audit_logs`를 같은 PostgreSQL 트랜잭션에서
동기 저장한다. 감사 actor 확인, snapshot 직렬화 또는 감사 저장이 실패하면 업무 트랜잭션 전체를
롤백한다.

## 이유

기존 `@Async` 감사 메서드는 같은 객체 내부 호출로 Spring proxy를 우회해 실제 비동기로 실행되지
않았다. 이를 단순 비동기 `REQUIRES_NEW`로 고치면 프로세스 종료, 큐 포화 또는 DB 장애 시 업무만
성공하고 감사 로그가 유실될 수 있다. 이는 모든 성공한 쓰기에 감사 기록이 존재해야 한다는
PLT-05 완료 조건과 맞지 않는다.

## 감사 계약

| 명령 | before | after |
| --- | --- | --- |
| CREATE | `null` | 생성 결과 snapshot |
| UPDATE 또는 상태 전이 | 변경 직전 snapshot | 변경 후 snapshot |
| DELETE | 삭제 직전 snapshot | `null` |

- actor는 인증된 `UserPrincipal.id`이며 없으면 업무 쓰기를 실패시킨다.
- 외부 `X-Trace-Id`는 검증 후 상관관계 값으로만 사용하며 보안 판정에는 사용하지 않는다.
- 금액·단가·연락처가 포함된 snapshot은 `sensitive=true`로 분류한다.
- 비밀번호, JWT, Authorization 헤더, internal key와 요청·응답 본문은 애플리케이션 로그에 남기지 않는다.
- 감사 성공/실패 metric에는 trace ID, 사용자 ID, 엔티티 번호 같은 고카디널리티 태그를 넣지 않는다.

## 향후 비동기 전환 조건

감사 저장 지연이 실제 처리량 병목으로 확인되면 업무 트랜잭션에서 outbox를 함께 저장하고 별도
worker가 재시도하는 transactional outbox 방식으로 전환한다. 단순 `@Async` 방식은 감사 전달
보장 수단으로 사용하지 않는다.
