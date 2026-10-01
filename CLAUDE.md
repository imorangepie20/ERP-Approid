# Project Instructions

## Project Scope

ERP-Approid is a manufacturing ERP MVP. The repository contains a React admin UI and a
Spring Boot core API. Treat `docs/desc.md` as product scope, but verify all design documents
against code: the PostgreSQL/Spring/Nginx Compose baseline exists, while FastAPI analytics is planned.

## Tech Stack

- Frontend: React 18, TypeScript 5.6, Vite 6, React Router 6, Tailwind 3
- Backend: Java 21, Spring Boot 3.5, Spring Security, JPA, Flyway
- Database: PostgreSQL; money is integer KRW, quantities are decimal
- Tests: JUnit 5 + Testcontainers, Vitest + Testing Library

## Project Structure

- `hud-admin-template/src/App.tsx`: frontend routes
- `hud-admin-template/src/store/`: in-memory DataContext, types, seed fixtures
- `hud-admin-template/src/pages/`: ERP and template pages
- `backend-spring/src/main/java/com/erpapproid/core/api/`: controllers and DTOs
- `backend-spring/src/main/java/com/erpapproid/core/domain/`: entities and repositories
- `backend-spring/src/main/java/com/erpapproid/core/security/`: JWT and authorization
- `backend-spring/src/main/resources/db/migration/`: schema source of truth
- `backend-spring/src/test/`: Testcontainers integration flow
- `docs/PROJECT_HANDOVER.md`: verified current-state analysis and priorities
- `docs/SERVICE_IMPLEMENTATION_ROADMAP.md`: future service inventory, dependencies, and completion gates

## Build and Run

Frontend, from `hud-admin-template/`:

- Install: `npm ci`
- Dev: `npm run dev` (port 3000)
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm run test`

Backend, from `backend-spring/`:

- Run: `.\gradlew.bat bootRun` (API port 38080)
- Test: `.\gradlew.bat test` (requires Docker)
- Java toolchain: 21
- Local DB default: PostgreSQL at `localhost:15432/erp_approid`

## Current Caveats

- Authentication and the item list read path call the Spring API; item writes and the remaining business screens still use prototypes or memory-only DataContext.
- Login, session restoration/expiry, protected routes, logout, and role-controlled item/BOM action boundaries are implemented.
- Many pages use hardcoded local arrays rather than DataContext.
- `backend-fastapi/` is not implemented. Root Compose, `src/api/`, and generated Spring OpenAPI types exist.
- Springdoc is pinned to 2.8.14 because 2.8.17 breaks Spring MVC resource path initialization;
  `OpenApiIntegrationTest` guards the OpenAPI JSON and Swagger UI entry points.
- Preserve user changes in `backend-spring/build.gradle.kts`; do not revert them implicitly.

## Code Conventions

- Frontend component/page files use PascalCase; hooks and utilities use camelCase.
- Backend packages are grouped by API feature and domain.
- REST resources use plural kebab-case under `/api/core`.
- Use action POST endpoints for state transitions (`/confirm`, `/complete`, `/collect`).
- Validate request DTOs with Jakarta Validation.
- Return domain failures through `DomainException` and the common `ErrorResponse` shape.
- Keep Flyway migrations append-only after they have been shared; do not use JPA schema generation.
- Keep server state transitions authoritative; do not duplicate new business rules in React.
- Follow the existing Conventional Commit style: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`.

## Testing Expectations

- Run the closest relevant checks after each change.
- For frontend changes, at minimum run `npm run build`; add tests when introducing API state.
- For backend changes, run `.\gradlew.bat test` with Docker available.
- Add or update the integration flow for changes to the five core state transitions.
- Do not describe a design document item as implemented without confirming its source files.

## Security and Data

- Never use the development DB password, JWT secret, internal key, or seeded admin password in production.
- Restrict CORS and Swagger by environment before deployment.
- Preserve trace IDs and authenticated actor IDs when changing async audit behavior.
- Treat inventory, receiving, production completion, and shipment confirmation as transactional flows.
