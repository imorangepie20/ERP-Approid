# Phase 1 인증 세션 저장 결정

## 상태

- 결정일: 2026-10-01
- 적용 범위: PLT-04 인증·세션·권한 서비스
- 상태: 승인된 임시 위험수용

## 배경

현재 Core API는 로그인 성공 시 60분 수명의 HS256 access token을 응답 본문으로 반환하고,
보호 API는 `Authorization: Bearer {token}` 헤더만 지원한다. refresh token, 서버 세션,
HttpOnly 인증 쿠키는 아직 제공하지 않는다. PLT-04는 같은 브라우저 탭에서 새로고침한 뒤에도
`/auth/me`로 세션을 복원해야 한다.

Web Storage는 JavaScript에서 읽을 수 있으므로 XSS가 발생하면 저장된 토큰도 탈취될 수 있다.
OWASP는 인증 토큰을 `localStorage`나 `sessionStorage`에 저장하지 않고 HttpOnly 쿠키 또는
Backend-for-Frontend 세션을 사용하는 방식을 권고한다.

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

## 결정

Phase 1에서는 access token과 절대 만료시각만 `sessionStorage`에 저장한다.

- 비밀번호, 사용자 프로필, 역할 목록은 저장하지 않는다.
- 앱 시작 시 저장 형식과 만료시각을 검증하고 유효한 경우에만 `/auth/me`를 호출한다.
- `/auth/me`의 서버 응답으로 사용자와 현재 역할을 다시 구성한다.
- 손상되거나 만료된 저장값, 401 응답, `/auth/me` 복원 과정의 403·형식 오류는 세션 및
  사용자별 Query 캐시를 제거한다.
- 로그인 후 일반 업무 요청의 403은 권한 부족으로 처리하고 세션을 제거하지 않는다.
- access token은 Core API에만 전달하고 Analytics API에는 전달하지 않는다.
- 여러 요청에서 401이 동시에 발생해도 세션 종료 처리는 한 번만 실행한다.
- 로그인 후 복귀 경로는 React Router의 내부 location state만 사용하고 외부 URL은 거부한다.
- `localStorage` 기반 로그인 유지 기능은 제공하지 않는다.

`sessionStorage`는 탭 단위이며 새로고침에는 유지되지만 탭을 닫으면 제거된다. 이 선택은 토큰을
장기 보존하지 않는다는 점에서 `localStorage`보다 노출 기간이 짧지만, XSS로부터 토큰을 보호하는
수단은 아니다.

## 보안 경계

프런트의 메뉴·버튼 숨김은 사용자 경험을 위한 보조 장치일 뿐 권한 경계가 아니다. 모든 업무
권한은 서버의 현재 사용자 상태와 역할을 기준으로 `@PreAuthorize`에서 최종 결정한다. JWT의
역할 claim은 발급 당시 정보이므로 요청 권한 판단에는 사용하지 않고, 서버가 DB의 현재 역할과
활성 상태를 다시 조회한다.

## 후속 전환 조건

운영 인증 설계 시 다음 중 하나로 전환한다.

1. `HttpOnly; Secure; SameSite` 쿠키와 CSRF 방어를 갖춘 서버 세션
2. 브라우저에 토큰을 노출하지 않는 Backend-for-Frontend 세션

이 전환과 함께 refresh token 회전·폐기, 로그아웃 강제 무효화, 계정 잠금, 로그인 이력, CSP,
운영 CORS 제한을 설계한다. 전환이 완료되면 Web Storage의 access token 저장을 제거한다.
