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
- Browser E2E: root `scripts/run-phase1-e2e.ps1` (isolated DB only; see `docs/phase1-e2e.md`)

Backend, from `backend-spring/`:

- Run: `.\gradlew.bat bootRun` (API port 38080)
- Test: `.\gradlew.bat test` (requires Docker)
- Java toolchain: 21
- Local DB default: PostgreSQL at `localhost:15432/erp_approid`

## Current Caveats

- Authentication, item/partner/BOM/routing master CRUD, quotations, sales orders, work orders, receivings, and shipments call the Spring API.
  Purchase-order editing and the remaining business screens still use prototypes or memory-only DataContext.
- Login, session restoration/expiry, protected routes, logout, and role-controlled item/BOM action boundaries are implemented.
- Many pages use hardcoded local arrays rather than DataContext.
- Quotations support draft editing/sending and unexpired sent-quotation conversion. Sales confirmation creates
  a persistent work order. Simple cancellation is waiting-only; confirmed-order compensation is follow-up work.
- New sales documents snapshot customer payment/lead-time terms; V12 reconstructs existing terms from current
  customer masters (and linked quotations), not historical values. Sending marks status only, not email delivery.
- New standalone and sales-confirmed work orders persist ordered routing snapshots. Existing orders retain
  empty snapshots; planning/cost consumers and the MRP calculation UI remain follow-up work.
- Work orders support cumulative actuals, assignment/priority, completion and closing. Completion atomically
  creates the good-quantity Lot/receipt, increases item stock, and records audits under work-order/item locks.
  Actuals cannot exceed the order quantity; completion requires the whole quantity accounted for. Linked orders
  cannot change quantity or be deleted/simply cancelled. Component consumption and cost aggregation remain planned.
- V13 preserves historical over-quantity closed orders with a NOT VALID total-actuals constraint; new/changed rows
  are checked. Assignment is a label until employee/user linking is implemented.
- Receiving uses gross quantity for purchase-order progress and good quantity for Lot/current stock. Creation
  and full-receipt cancellation are atomic under receipt/order/item/Lot locks; cancellation preserves history
  and creates a reversal, rejecting used/held/disposed Lots. All-defective receipts have no Lot/movement.
  V14 links new receipts to their Lot/original/reversal transactions; historical receipts are not reconstructed
  or automatically cancelled. Purchase-order selection reads the real API; purchase-order CRUD UI is still planned.
- `backend-fastapi/` is not implemented. Root Compose, `src/api/`, and generated Spring OpenAPI types exist.
- Shipments select one explicit Lot per document. Non-cancelled allocations cannot exceed the sales order;
  draft/dispatch do not reserve stock. Confirmation rechecks stock/Lot under order/item/Lot locks, decreases both,
  creates a linked movement/receivable, and closes the order only when cumulative shipments cover its quantity.
  Receivables use the order's payment-term snapshot; the final shipment reconciles integer-KRW rounding.
  V15 preserves historical unlinked shipments without guessing Lots/revenue. Cancellation is instruction/dispatch-only;
  returns, post-departure compensation, multi-Lot documents, FIFO/FEFO, and accounting journals remain follow-up work.
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
- Use the common `DateInput` calendar control for editable dates; use `type: 'date'`
  in `FormModal` fields. Keep date-only values in `YYYY-MM-DD` format.
- Follow the existing Conventional Commit style: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`.

## Testing Expectations

- Follow the proportionate verification policy in `AGENTS.md`.
- For small, scoped changes, run only the closest relevant tests or checks; target frontend
  test files or backend test classes/methods instead of running the full suite.
- Run full verification only at milestone completion or immediately before committing,
  for the affected areas. Documentation-only changes require diff checks, not app tests.
- Broaden verification earlier only for failures or concrete evidence of wider impact;
  briefly explain why. Reuse still-valid results instead of repeating successful checks.
- Add or update meaningful tests when introducing API state or changing business behavior.
- Add or update the integration flow for changes to the five core state transitions.
- Do not describe a design document item as implemented without confirming its source files.

## Security and Data

- Never use the development DB password, JWT secret, internal key, or seeded admin password in production.
- Restrict CORS and Swagger by environment before deployment.
- Preserve trace IDs and authenticated actor IDs when changing async audit behavior.
- Treat inventory, receiving, production completion, and shipment confirmation as transactional flows.
