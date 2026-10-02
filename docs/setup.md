# 로컬 통합 환경 실행

루트 Compose는 PostgreSQL 16, Spring Boot API, React 정적 프런트를 함께 실행한다. Spring Boot가 시작될 때 Flyway가 데이터베이스 마이그레이션 V1~V13을 적용하며, 각 서비스의 healthcheck가 통과한 뒤 다음 서비스가 시작된다.

> `.env.example`의 값은 로컬 개발 전용 공개 예시다. 운영 또는 공유 환경에서는 DB 비밀번호, JWT secret, internal key를 각각 새로 생성해야 한다.
> 이 Compose는 로컬 개발 전용이다. 공유 서버나 운영 환경에 그대로 배포해서는 안 된다.

## 사전 조건

- Docker Desktop 또는 Docker Engine과 Compose 플러그인
- Windows에서 검증 스크립트를 실행할 PowerShell 5.1 이상

## 최초 실행

저장소 루트에서 환경 파일을 만든 뒤 서비스를 빌드하고 시작한다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build --detach --wait
```

Linux/macOS:

```bash
cp .env.example .env
docker compose up --build --detach --wait
```

기본 접속 주소는 다음과 같다. 모든 호스트 포트는 외부 인터페이스가 아닌 `127.0.0.1`에만 바인딩된다.

| 서비스 | 주소 |
| --- | --- |
| 프런트 | http://127.0.0.1:3000 |
| Spring API | http://127.0.0.1:38080 |
| Actuator health | http://127.0.0.1:38080/actuator/health |
| Swagger UI | http://127.0.0.1:38080/swagger-ui.html |
| PostgreSQL | `127.0.0.1:15432` |

포트가 이미 사용 중이면 `.env`의 `DB_HOST_PORT`, `BACKEND_HOST_PORT`, `FRONTEND_HOST_PORT`를 변경한다.
`BACKEND_HOST_PORT`를 변경할 때는 브라우저가 접근할 `VITE_API_CORE_URL`의 포트도 같은 값으로
맞춘 뒤 `docker compose up --build --detach --wait`로 프런트를 다시 빌드해야 한다. 컨테이너 내부
PostgreSQL 포트는 항상 5432다.

## 상태 검증

세 컨테이너의 health 상태, Flyway V13 적용, 공개 Actuator health, 보안 헤더, 허용·거부 CORS,
개발 관리자 로그인, 관리자 전용 metrics, 프런트 HTTP 응답을 한 번에 검증한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-local-compose.ps1
```

## 프런트 API 환경과 타입 생성

프런트의 `VITE_*` 값은 브라우저에 공개되고 빌드 시점에 번들에 포함된다. 비밀번호, JWT secret,
internal key 같은 비밀값을 넣지 않는다. 직접 개발할 때는 `hud-admin-template/.env.example`을
`hud-admin-template/.env.local`로 복사하고, Compose 빌드는 루트 `.env`의 다음 값을 사용한다.

```dotenv
VITE_API_CORE_URL=http://127.0.0.1:38080/api/core
VITE_API_ANALYTICS_URL=http://127.0.0.1:38000/api/analytics
```

Spring 컨테이너가 실행 중일 때 실제 OpenAPI에서 Core API 타입을 다시 생성한다.

```powershell
Set-Location hud-admin-template
npm run generate:api-types
```

기본 OpenAPI 주소는 `http://127.0.0.1:38080/v3/api-docs`다. 다른 주소를 쓰려면
`OPENAPI_CORE_URL` 환경 변수를 지정한다. 생성 결과 `src/api/generated/core.ts`는 프런트와
백엔드 계약 변경을 코드 리뷰에서 확인할 수 있도록 저장소에 포함한다. Analytics 서비스의
OpenAPI 타입 생성과 실제 호출 검증은 ANL-04에서 추가한다.

대체 포트와 프로젝트명을 사용하려면 별도 환경 파일을 만든 뒤 현재 PowerShell 세션에서 검증 스크립트를 호출한다.

```powershell
Copy-Item .env.example .env.compose-test
# .env.compose-test의 DB_HOST_PORT, BACKEND_HOST_PORT, FRONTEND_HOST_PORT를 빈 포트로 변경하고,
# VITE_API_CORE_URL 포트를 BACKEND_HOST_PORT와 같은 값(아래 예시는 48080)으로 맞추고,
# CORS_ALLOWED_ORIGINS를 프런트 주소 목록(아래 예시는 http://127.0.0.1:43080)으로 맞춘다.
docker compose --project-name erp-test --env-file .env.compose-test up --build --detach --wait
& .\scripts\verify-local-compose.ps1 `
  -ProjectName erp-test `
  -EnvFile .env.compose-test `
  -BackendBaseUrl http://127.0.0.1:48080 `
  -FrontendBaseUrl http://127.0.0.1:43080
```

PowerShell이 없는 Linux/macOS에서는 Compose 상태와 동일한 계약을 다음 명령으로 확인할 수 있다.

```bash
docker compose ps
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COALESCE(MAX(version::integer), 0) FROM flyway_schema_history WHERE success = true;"'
curl --fail --silent http://127.0.0.1:38080/actuator/health >/dev/null
curl --fail --silent --header 'Content-Type: application/json' \
  --data '{"username":"admin","password":"admin123"}' \
  http://127.0.0.1:38080/api/core/auth/login | grep '"accessToken"'
curl --fail --silent http://127.0.0.1:3000/ >/dev/null
```

개발용 초기 계정은 `admin` / `admin123`이다. 로그인 뒤 받은 access token으로
`GET /api/core/auth/me`를 호출하면 현재 사용자와 역할을 확인할 수 있다. 운영 배포 전 초기 계정을
반드시 제거하거나 비밀번호를 변경해야 한다.

Spring Boot를 Compose 밖에서 직접 실행할 때는 안전을 위해 기본 활성 프로필이 없다. 로컬 실행은
`SPRING_PROFILES_ACTIVE=local`, 자동화 테스트는 `test`, 운영은 `prod`를 명시한다. `prod`는 DB 연결값,
서로 다른 32바이트 이상의 JWT/internal key, 정확한 `CORS_ALLOWED_ORIGINS`가 없거나 공개 예제값이면
기동을 중단하며 Swagger/OpenAPI를 노출하지 않는다.

## 운영 명령

```powershell
# 상태
docker compose ps

# 전체 로그
docker compose logs --follow

# 백엔드 로그만 확인
docker compose logs --follow backend-spring

# 서비스 종료(데이터 유지)
docker compose down
```

데이터베이스 백업·안전 복원·격리 복구훈련과 운영 체크리스트는
[운영 정책](operations.md)에 정리되어 있다.

## 데이터 초기화

다음 명령은 로컬 PostgreSQL named volume과 그 안의 모든 데이터를 삭제한다. 복구할 수 없으므로 초기화가 필요한 경우에만 실행한다.

```powershell
docker compose down --volumes
docker compose up --build --detach --wait
```
