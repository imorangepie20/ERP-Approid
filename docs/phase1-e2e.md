# Phase 1 브라우저 E2E와 CI

## 실행 범위와 격리

`hud-admin-template/e2e/phase1.spec.ts`는 실제 Chromium → React → Spring → PostgreSQL을
호출한다. HTTP 응답 모킹이나 DataContext 대체 경로를 사용하지 않는다.

- 견적 등록/발송/수주 전환 → 수주 확정/작업오더 연결 → 누적 실적/생산완료 → Lot 출하,
  현재고·Lot 잔량·수주 상태·미수/출고 연결, 중복 확정 409, 새로고침 후 영속 데이터.
  이후 해당 품목의 Spring 대시보드 매출 1,000원·생산액 1,000원·잔고 0원·완료 오더 1건을
  실제 API와 화면에서 비교하고 새로고침 후 다시 확인한다.
- MATERIAL의 부분입고(총 6, 불량 1, 양품 5)와 전체 입고 취소 역출고/현재고/발주 수량 보상.
- MATERIAL의 실제 BOM×활성 작업 MRP 22EA → 실제 발주 2200원, 현재고 불변·발주잔량 재계산·새로고침 영속성.
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
운영 대시보드는 기존 Spring core 클라이언트의 `/api/core/analytics/dashboard`를 사용한다.
별도 Analytics 서버용 설정은 여전히 미사용 loopback 38082 주소이며 FastAPI를 기동하지 않는다.

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
   committed 타입 drift 검사, Chromium 검사 5건, 보고서 업로드 및 항상 스택 정리.

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
- 당시 UNVERIFIED: 이 로컬 실행 시점에는 원격 Actions 실행과 브랜치 보호를 확인하지 않았다.
  이후 확인 결과는 아래의 원격 성공·필수 체크 적용 기록을 따른다.

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

첫 원격 실행 당시 main은 protected=false, 적용 branch rules는 빈 배열이었다.
이후 사용자의 승인을 받아 아래와 같이 필수 체크를 적용했다.

## 원격 성공과 main 필수 체크 적용 — 2026-10-04

- PASS: main `15cf5a56063bc36b8a52e1f0aa3d9e773ba82fbc`의
  [원격 실행 37166236437](https://github.com/imorangepie20/ERP-Approid/actions/runs/37166236437)이 success다.
  Frontend, Backend, Phase 1 Chromium transactions, Phase 1 required의 네 작업이 모두 success이며
  브라우저 로그에서 4 passed, 생성 순서 회귀 로그에서 3 pass를 확인했다.
- PASS: 성공한 `Phase 1 required` check-run의 제공자가 github-actions(app ID 15368)임을 확인하고
  동일 이름·app ID를 main required_status_checks.checks에 등록했다.
  보호 설정 PUT HTTP 200 후 별도 GET에서도 protected=true와 동일 체크를 확인했다.
- PASS: required_status_checks.strict=true, enforce_admins.enabled=false다.
  리뷰 승인·사용자 push 제한·선형 이력·대화 해결·브랜치 잠금 규칙은 추가하지 않았다.
  allow_force_pushes와 allow_deletions는 false다. 적용 중 main SHA는 변경되지 않았다.
- PASS: 로드맵 백로그 14와 원격 검증 기록을 갱신하고 문서 diff 및 `git diff --check`를 확인했다.

이는 비관리자에 대한 필수 체크 설정이다. 관리자 강제 적용은 요청 범위에 추가하지 않았으므로
관리자는 우회할 수 있다. 모든 관리자에게도 강제하려면 별도 승인 후 enforce_admins를 켜야 한다.
리뷰 승인 요구와는 별개다. API 필드 의미는
[GitHub 보호 브랜치 API](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)를 참고한다.

네 작업이 모두 성공했고 필수 체크 설정도 조회로 확인했으므로 백로그 14는 완료로 표시한다.
실패 체크가 있는 PR의 실제 병합 거부를 실험하기 위해 테스트 PR이나 실패 커밋을 만들지는 않았다.

## Spring 분석 추가 로컬 검증 — 2026-10-04

- PASS: `gradlew.bat test` 종료 0, 29클래스/194개, 실패·오류·스킵 0.
  대시보드 통합 5개와 MRP 계산/통합 8개 포함. 다단계 공유 소요 63.55kg → 실제 발주51.55kg/5155원,
  발주 후 제안0·현재고 불변·보류/만료 Lot 제외·권한/오류/감사를 검증했다.
- PASS: `npm run test -- --maxWorkers=2` 종료 0, 221개/35파일.
  마지막 조회 필터 CSS 수정 뒤 관련 화면 10개와 변경 파일 ESLint를 재검증했다(각 종료 0).
  원래 전체 lint는 오류0/기존 경고48, host/Docker TypeScript·Vite production build 종료 0.
- PASS: `run-phase1-e2e.ps1 -KeepStack` 마지막 실행 종료 0, 실제 Chromium 5개/53.4초,
  실패·오류·스킵0. 대시보드 실제 매출/생산/잔고, BOM×작업×손실률22EA → 발주2200원 및
  현재고 불변/영속성, 조회 필터 실제 배경·글자색을 확인했다.
  `dashboard-persisted.png`, `mrp-purchase-persisted.png`와 기존 거래 상세 PNG를 보존한다.
- PASS: 실제 Spring OpenAPI 반복 생성 SHA256
  `A2931D3711A217F21C1CA09CDD47A3642EA5EBDB8929759C713263AFC9D36779` 동일.
  생성 순서 회귀3개 및 E2E 타입 검사 종료0. 새로운 분석도 기존 Core 클라이언트/인증을 사용한다.
- 첫 브라우저 MRP 검사는 품번+품명이 한 셀인데 품번만 정확 일치시킨 선택자 때문에 실패했다.
  실패 snapshot에서 기대22EA가 표시된 것을 확인하고 행 머리글 선택자로 수정한 뒤 전체5개를 재실행했다.
  성공 PNG에서 추가로 정의되지 않은 필터 스타일을 발견해 테마 유틸리티로 수정하고 실제 CSS 검사를 추가했다.
  API/계산 규칙·테스트 timeout을 바꾸거나 실패를 자동 재시도로 숨기지 않았다.
- 이전 전체 프런트 검사를 여러 빌더와 동시 실행했을 때 timeout이 있었다. 자원 경합 단계로 진단해
  빌더/전체 검사를 분리하고 workers2로 실행했다. 애플리케이션 로직/timeout을 수정하지 않았다.
- 기존 경고: JS 단일 청크 약520kB, 오래된 Browserslist 데이터. Docker의 기존 lockfile 설치 시
  npm audit는23건(low2/moderate6/high15)을 보고했다. 의존성 파일은 이번 작업에서 변경하지 않았다.
  배포 전 직접/간접 및 운영/개발 영향 분류와 업그레이드 검증이 별도 필요하며 자동 audit fix는 하지 않았다.
- PASS: 기존 개발 Compose의 Spring·프런트만 갱신했다(`--no-deps --no-build --wait`).
  두 서비스 healthy, health/프런트/OpenAPI/인증된 dashboard·MRP 조회 HTTP200.
  프런트 `/assets/index-DwItaA0J.js`에 실제 MRP 호출이 있고 미정의 `hud-input`은 없다.
  개발 PostgreSQL은 재생성하지 않았고 `erp-approid_postgres-data` 마운트를 유지한다.
  개발 DB의 E2E 사용자0명이며 테스트 거래는 격리 tmpfs DB에만 입력했다.
- UNVERIFIED: 현재 분석 변경의 원격 GitHub Actions. 이번 작업은 커밋/푸시하지 않았으므로
  위 `15cf5a5` 원격 성공을 새 코드의 검증으로 사용하지 않는다. ANL-02의 원격 완료 표시는 보류한다.
  재고회전율 원가·평균재고 이력과 구성품 실제 소비/예약은 각각 문서화된 후속 업무다.

## Spring 생산 진척 분석 로컬 검증 — 2026-10-04

- PASS: 백엔드 전체 `gradlew.bat test` 종료0, 30클래스/197개, 실패·오류·스킵0.
  생산 분석 통합3개는 실제 수량/진척/수율·지연 경계, 전체 필터 요약/페이지/품목 단위,
  문자 그대로의 검색, 과거 초과 실적 제외, 현재고·감사 불변과 인증/입력/404/405/OpenAPI를 검사한다.
- PASS: 프런트 전체 `npm run test -- --maxWorkers=2` 종료0, 37파일/241개.
  생산 API14개·화면6개 및 대시보드 품목 drill-down을 포함한다. 화면 axe 위반0이며
  JSDOM의 색상 대비/랜드마크는 제외한다. 실제 Chromium에서는 테마 배경색도 확인했다.
- PASS: TypeScript/Vite host build 종료0, lint 오류0/기존 경고48, 생성 순서 회귀3개.
  실제 격리 Spring `/v3/api-docs`에서 반복 생성 SHA256
  `644E22D300989DA3F80DC36230AF233F14996F5955D136652626BB3972CB310B` 동일.
- PASS: `run-phase1-e2e.ps1 -KeepStack` 종료0, 실제 Chromium6개/56.0초, 자동 재시도0.
  새 생산 시나리오는 대시보드 품목 전달→현재 진척/수율50%/80%→실적 변경 후80%/75%,
  지연·잔량·현재고 불변→읽기 역할의 실제 작업오더 이동을 확인한다.
  `test-results/phase1-production-analysis-964be--drills-into-persisted-work-chromium/production-analysis-current.png`
  화면을 확인했고 보고서/PNG는 로컬 산출물로 보존한다.
- 이전 첫 통합 검증은3개가 실패해 AGENTS 중단 규칙에 따라 해당 턴을 멈췄다.
  이번 후속 작업에서 검색어 nullable JDBC 바인딩의 PostgreSQL 타입 미결정과 테스트 String URI의
  이중 인코딩을 수정했다. 이후 실제 URI literal 검색을 포함한3개 모두 통과했다.
  첫 타입 검사에서는 Testing Library에 Playwright 선택자 옵션을 사용한 오류를 발견해
  해당 테스트 옵션만 수정한 뒤 빌드와 전체241개를 다시 통과했다. 업무 규칙/timeout은 변경하지 않았다.
- PASS: Docker frontend build 및 기존 개발 Spring/프런트의 `--no-deps --no-build --wait` 갱신 종료0.
  세 서비스 healthy, health/로그인/인증된 생산 진척/OpenAPI/`/analytics`/JS asset HTTP200.
  `/assets/index-BubdR7bw.js`에 실제 생산 분석 API 호출이 있다. PostgreSQL 재생성 없이
  `erp-approid_postgres-data`를 유지했고 개발 DB의 E2E 사용자0명을 확인했다.
  격리 프로젝트의 tmpfs 테스트 DB/컨테이너만 정리했으며 보고서/스크린샷은 보존한다.
- PASS: 문서/API 계약 diff 확인, `git diff --check` 종료0 및 새 소스/문서29개 후행 공백 없음.
- UNVERIFIED: 새 변경의 원격 CI는 미커밋/미푸시이므로 실행하지 않았다.
  ANL-03은 생산 진척 범위만 로컬 검증했으며 영업/재고/사업장 분석은 후속 범위다.

## Spring 영업 요약 로컬 검증 — 2026-10-04

- PASS: 백엔드 전체 `gradlew.bat test` 종료0, 31클래스/200개, XML 합산 실패·오류·스킵0.
  신규 `SalesSummaryIntegrationTest` 3개는 기간 수주2000원/확정 출하1300원과 현재 확인 잔고500원/
  미수 문서 원금750원/연체250원을 검증한다. 다중 출하×미수의 중복 합산, 과거 미연결 이력,
  날짜/문자 그대로 검색/범위/정렬/페이지, 현재고·감사 불변을 검사했다.
- PASS: 비로그인401, ADMIN/SALES/ACCOUNTING200, MATERIAL/PRODUCTION/QUALITY403,
  지원하지 않는 쓰기405 및 공통 입력400/미존재404/OpenAPI 검사를 통과했다.
  대시보드 통합까지 포함한 근접 백엔드8개와 근접 프런트6파일/56개도 각각 종료0이다.
- PASS: 프런트 전체 `npm run test -- --maxWorkers=2` 종료0, 39파일/265개, 91.24초.
  신규 영업 API14개·화면8개와 수주/출하 URL 필터 회귀를 포함한다. 화면 axe 위반0이며
  JSDOM 색상 대비/랜드마크는 제외한다. 실제 브라우저에서는 필터 배경색을 확인했다.
- PASS: 실제 Spring `/v3/api-docs` 반복 타입 생성 SHA256
  `736855A35ACB7CB38BD1D8694BB1F92EECC3FF3891DC9AA97ED794F3F1762884` 동일.
  생성 순서 회귀3개, E2E TypeScript, host/Docker TypeScript·Vite build 종료0.
  lint 오류0/기존 경고48. 기존 오래된 Browserslist/500kB 초과 단일 청크 경고는 유지되며 의존성은 변경하지 않았다.
- PASS: `run-phase1-e2e.ps1 -KeepStack` 종료0, Chromium6개/1.3분, 자동 재시도0.
  실제 수주→생산→출하 뒤 품목을 전달한 영업 화면에서 기간 수주1000원/출하1000원/
  현재 잔고0원/미수1000원/연체0원과 연결 수주/출하 이동을 확인했다.
  자재 역할은 분석 링크가 없고 직접 페이지 접근은 권한 안내, API는403이다.
  `test-results/phase1-quotation-→-sales-c-62d95-ists-stock-and-revenue-once-chromium/sales-analysis-persisted.png`
  화면을 직접 확인했으며 HTML 보고서와 PNG를 로컬 산출물로 보존한다.
- 첫 근접 백엔드 검사는 고객 필터 없는 미연결 미수 제외 건수에 기존 시드3건도 포함되어
  기대1/실제4였다. 문서화한 제외 범위에 맞게 고객 필터 fixture와 전체 baseline+1 검사를 추가했고
  전체 근접8개를 다시 통과했다. 첫 화면 검사2개는 지시/출하 수량이 한 셀에 있는데 개별 텍스트로
  찾은 선택자 오류였다. 셀 기준으로 고친 뒤 근접56개를 다시 통과했다. 계산/권한/timeout은 바꾸지 않았다.
- PASS: 개발 Spring/프런트만 `--no-deps --no-build --wait`로 갱신(종료0).
  세 서비스 healthy, health/로그인/인증된 영업 요약/OpenAPI/`/analytics/sales`/JS asset HTTP200.
  `/assets/index-CYOsTYOH.js`에 실제 영업 API 호출이 있다. PostgreSQL 컨테이너 ID를 전후 비교해 동일함을
  확인했고 `erp-approid_postgres-data`를 유지했다. 개발 DB의 E2E 사용자0명이다.
  격리 프로젝트명·tmpfs·DB명·host DB port/volume 부재를 확인한 뒤 테스트 컨테이너/임시 DB만 정리했다.
  개발 데이터와 로컬 검증 보고서/스크린샷은 보존한다. 임시 테스트 거래는 스크립트로 재생성할 수 있다.
- PASS: 계약/로드맵/운영 문서 diff 확인, `git diff --check` 종료0 및 새 소스/문서40개 후행 공백 없음.
- UNVERIFIED: 이번 로컬 변경의 원격 CI는 미커밋/미푸시이므로 실행하지 않았다.
  미수는 부분수납 이력이 없는 열린 문서 원금이지 실제 잔액/기간 수납액이 아니다.
  재고회전율·사업장 분석이 남아 있어 ANL-03 전체 완료로 표시하지 않는다.

## Spring 재고 원천 분석 로컬 검증 — 2026-10-04

- PASS: 백엔드 전체 `gradlew.bat test` 종료0, 32클래스/203개, XML 합산 실패·오류·스킵0.
  신규 `InventorySummaryIntegrationTest` 3개는 현재고30kg/전체 부호 수불104kg/차이−74kg,
  기간 증가10kg/감소7kg/순증감3kg을 검증한다. 여러 수불×Lot 중복 집계를 방지하고
  만료 당일 사용가능, 경과90/91일 경계, 보류·만료 중첩, 폐기/음수/미래일을 확인했다.
  조회 후 현재고·감사 불변, 문자 그대로 검색/위험/유형/페이지/정렬, 인증 역할200/비로그인401,
  잘못된 입력400/미존재404/쓰기405/OpenAPI도 통과했다.
- PASS: 프런트 전체 `npm run test -- --maxWorkers=2` 종료0, 41파일/287개.
  신규 재고 API16개·화면5개와 대시보드/MRP 품목 전달 회귀를 포함한다.
  화면 axe 위반0(JSDOM 색상 대비/랜드마크 제외), 실제 Chromium 필터 테마 배경색 확인.
  근접 프런트5파일/38개도 종료0이며 DataContext/추정 창고·회전율 fallback은 없다.
- PASS: 실제 Spring `/v3/api-docs` 반복 타입 생성 SHA256
  `591F0A309E9076C8E3B3A8CBC32B6C4F6325032496226C2CF044E4E461ACCB96` 동일.
  생성 순서 회귀3개, E2E TypeScript 및 host TypeScript·Vite build 종료0.
  lint 오류0/기존 경고48. 기존 Browserslist/500kB 초과 청크 경고는 유지하며 의존성은 변경하지 않았다.
- PASS: `run-phase1-e2e.ps1 -KeepStack` 종료0, Chromium6개/63.24초, 자동 재시도0.
  실제 구매입고 양품5EA→대시보드 품목 전달→재고/수불/Lot5EA·차이0→실제 MRP/품목 마스터 이동을 확인했다.
  전체 입고 취소 후 기존 `/inventory/stock`에서도 현재고/수불/Lot0EA, 기간 증가5EA/감소5EA/순증감0EA다.
  `test-results/phase1-material-browser-pa-5e84d-ion-reverse-only-good-stock-chromium/inventory-received.png`와
  같은 폴더의 `inventory-reversed.png` 화면을 직접 확인했다. HTML 보고서/PNG는 로컬 산출물로 보존한다.
- PASS: Docker frontend build 및 기존 개발 Spring/프런트의 `--no-deps --no-build --wait` 갱신 종료0.
  세 서비스 healthy, health UP, 로그인/인증된 재고 요약/OpenAPI와 `/analytics/inventory`·`/inventory/stock` HTTP200.
  응답의 현재고2행을 품목 마스터와 비교해 일치했고 서울 기준/근거6개/회전율 명시적 null을 확인했다.
  `/assets/index-_5xYmjNw.js` HTTP200 및 실제 재고 API 호출 포함을 확인했다.
  PostgreSQL 컨테이너 ID `d84555010f54decd8477eb5f769cfc0c903a5be4d2d182b290437e5e435e028a`는 전후 동일하며
  `erp-approid_postgres-data` 볼륨을 유지했다. 개발 DB의 E2E 사용자0명이다.
  격리 프로젝트/DB명/tmpfs/host DB port·volume 부재를 확인한 뒤 테스트 컨테이너와 임시 DB만 정리했다.
  개발 DB와 로컬 보고서/스크린샷은 보존하며 임시 테스트 거래는 스크립트로 재생성할 수 있다.
- PASS: 계약/로드맵/운영 문서 diff 확인, `git diff --check` 종료0 및 새 소스/문서50개 후행 공백 없음.
- UNVERIFIED: 이번 변경의 원격 CI는 미커밋/미푸시이므로 실행하지 않았다.
  제조·입고일 경과는 마지막 이동/무출고 재고가 아니며 확인 사용가능 Lot은 확정 출하 가용량이 아니다.
  원가/평균재고 이력 기반 회전율·사업장/창고별 잔액·Lot 쓰기는 후속 범위로 ANL-03 전체 완료는 아니다.

## Lot 원천 추적 읽기 로컬 검증 — 2026-10-04

- PASS: 근접 백엔드 `gradlew.bat test --tests com.erpapproid.core.api.inventory.LotTraceIntegrationTest`
  종료0, 통합4개, 실패·오류·스킵0. 검색/상태/창고/정렬/페이지, 서울 만료 당일·31일,
  음수/미래 제조일, 현재고·감사 불변과 기존 `/lots` 배열 호환성을 확인했다.
  실제 구매입고5kg/취소 역수불−5kg과 원 입고 문서, 실제 생산완료의 WORK_ORDER 참조를 검증했다.
  미연결 수불·다른 품목 참조는 UNLINKED/null로 보존하며 과거 Lot 원천을 추정하지 않는다.
  모든 인증 역할200/비로그인401, 입력400/미존재404/미지원 쓰기405/OpenAPI도 통과했다.
- PASS: 근접 프런트5파일/48개 종료0. 신규 Lot API14개·화면4개와 재고→Lot/입고·출하 URL 검색을 포함한다.
  상세 Dialog axe 위반0(JSDOM 색상 대비/랜드마크 제외), Escape 닫기·수불 페이지·부호/단위·미연결 안내·trace 재시도를 확인했다.
  실제 Spring `/v3/api-docs` 반복 타입 생성 SHA256
  `6A0C8D0561E62C13A1A473A2238673E329E5C5F8674A8546F0CD4EBB032D6173` 동일, TypeScript 검사 종료0.
- PASS: 마일스톤 백엔드 전체 `gradlew.bat test` 종료0, 33클래스/207개, XML 합산 실패·오류·스킵0.
  Lot 임박의30일 포함 경계 assertion도 추가해 전체 회귀에서 통과했다.
  프런트 전체 `npm run test -- --maxWorkers=2` 종료0, 43파일/307개, 75.98초.
  host TypeScript·Vite build 종료0, lint 오류0/기존 경고48. 기존 Browserslist/500kB 초과 청크 경고는 유지하며 의존성은 변경하지 않았다.
- PASS: `run-phase1-e2e.ps1 -KeepStack` 종료0, 실제 Chromium6개/59.69초, 자동 재시도0, E2E TypeScript 종료0.
  생산완료→확정 출하 후 실제 Lot 잔량0EA/생산입고+10EA/출하−10EA와 WORK_ORDER·SHIPMENT 연결,
  출하 문서 URL 검색/완료 상태를 확인했다. 구매입고→재고→Lot 품목 전달·필터 실제 테마·잔량5EA·원 입고 이동,
  취소 후 폐기/잔량0EA·원/역수불과 동일 입고 연결2건도 통과했다.
  `test-results/phase1-quotation-→-sales-c-62d95-ists-stock-and-revenue-once-chromium/lot-production-shipment.png`,
  `test-results/phase1-material-browser-pa-5e84d-ion-reverse-only-good-stock-chromium/lot-receiving-source.png`와
  같은 폴더의 `lot-receiving-reversed.png`를 직접 확인했다. HTML 보고서/PNG를 로컬 산출물로 보존한다.
- PASS: 최종 검토에서 Headless UI 포털을 포함하도록 접근성 검사 대상을 실제 Dialog로 명확히 했다.
  변경한 화면 테스트4개와 해당 파일 ESLint를 다시 실행해 종료0, Dialog axe 위반0을 확인했다.
  애플리케이션 코드는 바뀌지 않았으므로 전체307개/빌드/브라우저 결과 중 여전히 유효한 검증을 재사용했다.
- PASS: Docker frontend build 및 개발 Spring/프런트만 `--no-deps --no-build --wait`로 갱신(종료0).
  세 서비스 healthy, health UP, 로그인/인증된 Lot 목록·상세/OpenAPI 및 `/inventory/lots` HTTP200.
  현재 Lot2개의 잔량을 기존 `/lots` 배열 조회와 비교해 일치했고 서울 기준/근거3개/실제 단위를 확인했다.
  `/assets/index-DjMpaXjO.js` HTTP200 및 실제 lot-traces 호출·상세 UI 포함을 확인했다.
  PostgreSQL 컨테이너 ID `d84555010f54decd8477eb5f769cfc0c903a5be4d2d182b290437e5e435e028a`는 전후 동일하며
  `erp-approid_postgres-data` 볼륨을 유지했다. 개발 DB의 E2E 사용자0명이다.
  격리 프로젝트명/DB/tmpfs/host DB port·volume 부재를 확인한 뒤 테스트 컨테이너/임시 DB만 정리했다.
  개발 데이터와 로컬 검증 산출물은 보존하며 임시 테스트 거래는 스크립트로 재생성할 수 있다.
- PASS: 계약/로드맵/운영 문서 diff 검토, `git diff --check` 종료0 및 새 소스/문서60개 후행 공백 없음.
- UNVERIFIED: 이번 변경의 원격 CI는 미커밋/미푸시이므로 실행하지 않았다.
  Lot 보류·해제·폐기 UI/기존 폐기 현재고·잔량 보상은 후속 범위이며 INV-02 전체 완료로 표시하지 않는다.
