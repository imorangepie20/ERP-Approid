# Phase 1 브라우저 E2E와 CI

## 실행 범위와 격리

`hud-admin-template/e2e/phase1.spec.ts`는 실제 Chromium → React → Spring → PostgreSQL을
호출한다. HTTP 응답 모킹이나 DataContext 대체 경로를 사용하지 않는다.

- 견적 등록/발송/수주 전환 → 수주 확정/작업오더 연결 → 누적 실적/생산완료 → Lot 출하,
  현재고·Lot 잔량·수주 상태·미수/출고 연결, 중복 확정 409, 새로고침 후 영속 데이터.
- MATERIAL의 부분입고(총 6, 불량 1, 양품 5)와 전체 입고 취소 역출고/현재고/발주 수량 보상.
- 비로그인 401, 잘못된 로그인 추적 ID, 보호 경로 복귀, 세션 복원, 로그아웃.
- MATERIAL의 영업/생산 쓰기 UI 비노출 및 출하 API 403, SALES의 입고 UI 비노출/API 403.

기존 개발 DB에서는 실행하지 않는다. Compose 프로젝트는 명령의
`--project-name erp-approid-e2e`로 고정한다. YAML `name`만 지정하면 개발 `.env`의
`COMPOSE_PROJECT_NAME`이 덮어쓸 수 있으므로 반드시 CLI 옵션을 사용한다.
DB `erp_approid_e2e`는 tmpfs이고 DB 포트를 공개하지 않는다. Spring은 loopback 38081,
Vite는 3001을 사용한다. 개발 포트 15432/38080/3000 및 named volume과 분리된다.
공개 테스트 secret/비밀번호와 역할 계정은 격리 DB 전용이며 운영에서 사용하지 않는다.
계정 SQL은 다른 DB에서 예외를 발생시켜 입력을 거부한다.

## Windows 로컬 실행

기존 의존성과 백엔드 이미지를 재사용한다. 최초 Playwright 사용 시에만
`hud-admin-template`에서 `npm ci`, `npx playwright install chromium`을 실행한다.

```powershell
# 저장소 루트: 기본은 --no-build, 종료 시 격리 테스트 스택 정리
& .\scripts\run-phase1-e2e.ps1
# 백엔드 이미지가 없거나 백엔드 코드가 바뀐 경우만 다시 빌드
& .\scripts\run-phase1-e2e.ps1 -Build
# 실패 분석용 DB를 보존할 때(메모리 저장소이므로 컨테이너 재시작 시 데이터가 사라짐)
& .\scripts\run-phase1-e2e.ps1 -KeepStack
docker compose --project-name erp-approid-e2e -f docker-compose.e2e.yml down
```

`E2E_ISOLATED=true` 없이 Playwright를 직접 실행하면 구성 단계에서 중단한다.
이 변수만 설정하는 것은 DB 격리 증명이 아니므로 준비/계정 guard를 수행하는 위 스크립트를 권장한다.
테스트는 고유 문서번호·품목을 만들고 workers=1, retries=0으로 실행한다.
실패를 재시도로 숨기지 않는다. 새 DB의 Flyway 버전은 V15여야 한다.
Analytics는 아직 구현 전이며 필수 프런트 설정에만 미사용 loopback 38082 주소를 제공한다.

## 결과물과 실패 분석

`hud-admin-template/playwright-report/index.html`은 HTML 보고서,
`hud-admin-template/test-results/e2e.xml`은 JUnit 보고서다.
거래 성공 시 새로고침한 상세 화면 스크린샷이 test-results에 남는다.
실패 시 screenshot/video/trace와 오류 컨텍스트를 보존한다.

```powershell
Set-Location hud-admin-template
npx playwright show-report
npx playwright show-trace <test-results의-trace.zip>
```

trace에는 테스트 JWT·요청/응답이 포함될 수 있다. 보고서·영상·trace는 Git에서 제외하고
CI artifact 보관 기간은 7일로 제한한다. 외부 공유 전 민감 정보를 검토한다.

## CI와 필수 체크

`.github/workflows/phase1.yml`은 main push, PR, 수동 실행에서 다음 세 작업을 실행한다.

1. Frontend: npm ci, lint, E2E TypeScript, OpenAPI 생성 순서 회귀 테스트, Vitest 전체, production build.
2. Backend: Java 21, Gradle 전체 통합 테스트(Testcontainers), 테스트 보고서 업로드.
3. E2E: 격리 Compose를 새로 빌드/기동, 테스트 역할/V15 확인, 실제 OpenAPI 타입 재생성 후
   committed 타입 drift 검사, Chromium 거래 4건, 보고서 업로드 및 항상 스택 정리.

`Phase 1 required`는 세 작업 결과가 전부 success일 때만 성공한다. 상위 작업의 실패/취소/skip을
성공으로 처리하지 않는다. 저장소 GitHub Settings의 branch protection/ruleset에서 이 체크를
required status check로 등록해야 병합을 실제 차단한다. 워크플로 파일만으로 보호 설정은 생기지 않는다.

로컬 검사와 원격 실행은 별개다. 로컬 통과만으로 GitHub Actions 성공이나
브랜치 보호 적용을 확인한 것으로 취급하지 않는다. 백로그 14는 원격 실행 성공 및 required 설정 확인 전까지
완료로 표시하지 않는다. 로컬에서는 actionlint, 동일 lint/types/tests/build, 격리 E2E를 검증한다.

## 로컬 검증 기록 — 2026-10-04

- PASS: Chromium 거래 흐름 2건(견적→출하와 구매입고→취소), 인증/권한 2건, 총 4건 통과.
  실행 스크립트 `run-phase1-e2e.ps1 -KeepStack` 종료 0; JUnit tests=4, failures/errors/skipped=0.
- PASS: lint 종료 0(기존 경고 48), E2E 타입 종료 0, Vitest 190개/31파일 통과, build 종료 0.
  Gradle test 종료 0(UP-TO-DATE 결과 재사용), 보고서 26클래스/181개, 실패·오류 0.
  actionlint 1.7.12 종료 0, V15 OpenAPI 타입 반복 생성 SHA256 동일.
- PASS: 개발 DB의 E2E 사용자 0명/격리 DB 3명, 개발 named volume과 격리 tmpfs 분리.
  계정 guard를 개발 DB에서 호출하면 예상 psql 종료 3으로 거부하며 데이터 입력 단계에 진입하지 않는다.
  JUnit/HTML/상세 화면 PNG 2개 생성과 결과물 Git 제외를 확인했다.
- PASS: 문서·설정 diff 검토, `git diff --check`, 신규 파일 후행 공백 검사.
- UNVERIFIED: 원격 Actions 실행 및 브랜치 보호 — 워크플로를 아직 커밋/푸시하지 않았고
  저장소 보호 설정을 변경하거나 확인하지 않았다. 백로그 14 전체 완료는 보류한다.

이번 실행 중 `.env` 프로젝트명 우선순위로 개발 컨테이너가 일시적으로 재생성됐다.
업무 테스트 입력 전 발견해 명시적 프로젝트명으로 수정하고 기존 개발 DB named volume으로
복원했으며, 개발 세 서비스의 healthy와 V15를 확인했다. 개발 DB 볼륨은 삭제하지 않았다.
E2E 정리는 격리 컨테이너와 임시 DB만 제거하며 보고서/스크린샷은 호스트에 남는다.
남은 경고는 단일 JS 청크 약 518kB와 오래된 Browserslist 데이터다. 코드 분할·의존성 정비는 별도 범위다.

## 원격 첫 실행과 생성 순서 보정 — 2026-10-04

`2627fbd`를 main에 푸시한 [첫 실행](https://github.com/imorangepie20/ERP-Approid/actions/runs/37165928970)에서
Frontend와 Backend는 success였다. E2E는 브라우저 실행 전 OpenAPI 타입 diff 검사에서 실패했다.
로그에서 Page의 first/last 및 Pageable의 paged 필드 위치만 달라진 것을 확인했다.
Spring/Jackson의 필드 열거 순서에 의존하지 않도록 생성 CLI에 `--alphabetize`를 적용했다.
키 순서 변경의 결과 동일성과 실제 타입 변경의 diff 유지 여부를 Node 회귀 테스트로 검사한다.
CI의 `git diff --exit-code`는 유지하며 실제 계약 변경을 무시하지 않는다.
수정 로컬 검증: 생성 순서 회귀 3건, 실제 타입 재생성, E2E 타입 검사, 프런트 build,
lint(오류 0/기존 경고 48), actionlint와 diff 검사 모두 통과했다.

GitHub main 조회 결과 protected=false, 적용 branch rules는 빈 배열이었다.
필수 체크 설정은 아직 없으며 이 작업에서는 보호 설정을 변경하지 않는다.
