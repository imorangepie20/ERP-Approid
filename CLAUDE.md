# Project Instructions

## Project Scope

ERP-Approid is a manufacturing ERP MVP. The repository contains a React admin UI and a
Spring Boot core API. Treat `docs/desc.md` as product scope, but verify all design documents
against code: the PostgreSQL/Spring/Nginx Compose baseline exists; Phase 1 analytics uses Spring and FastAPI separation is deferred.

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
- `/sales/receivables` reads real paged Spring receivables and global document-principal summary, with customer/status/
  date-derived overdue filters. Date calculations use Asia/Seoul today, not stale stored overdue days. Unlinked orders
  remain explicit nulls. ADMIN/ACCOUNTING record full/partial collections with locked balances, per-document request UUIDs,
  immutable actor/date/balance history and atomic sensitive audit. V16–V18 carry legacy completed amounts forward without
  inventing historical payments; response-loss retries retain the same key in browser session storage. Journals, reversals,
  cross-device external-payment reconciliation and reminder delivery remain follow-up. See `docs/receivables-list.md`
  and `docs/receivables-collections.md`. The reminder dialog reads real overdue targets/current contact and rechecks
  balances/contact before review confirmation; confirmation alone stays unsent and unsaved. After confirmation,
  ADMIN/ACCOUNTING can request actual EMAIL delivery against the registered ALLOWED contact, current snapshot hash
  and dispatch flag, with per-receivable UUID/key resumption in session storage and real history/retry display
  (SALES read-only). Generic partner contact does not establish a channel, consent, or delivery authority.
  SMS remains a review-only channel choice; supplier/policy work remains TODO-047.
  The local EMAIL-03 backend now persists reviewed EMAIL requests and sensitive audit atomically, with immutable
  snapshots, original UUID/actor/trace, idempotent replay and real request history. MESSAGE audit entity_no uses the
  lossless 32-hex UUID form to respect the existing column; API/queue/snapshot retain the canonical UUID.
  Delivery stays disabled by default. The local EMAIL-04 worker uses skip-locked single-row claims, retained actor/trace,
  current business/role preflight, separate short transactions and token-matched results. Mock-transport tests verify
  that collections can commit during transport. EMAIL-05 added the SMTP adapter with safe configuration,
  EMAIL-06 retry/recovery/UNKNOWN handling, and EMAIL-07 the actual request/history UI. All verification is local
  mock-transport only with no production SMTP use. This is not an operational reminder-delivery certification.
  See `docs/receivables-reminders.md`, `docs/receivables-email-delivery.md` and
  `docs/superpowers/plans/2026-10-04-receivable-email-delivery-plan.md`.
  These local receivables changes are not deployed yet.
- Quotations support draft editing/sending and unexpired sent-quotation conversion. Sales confirmation creates
  a persistent work order. Simple cancellation is waiting-only; confirmed-order compensation is follow-up work.
- New sales documents snapshot customer payment/lead-time terms; V12 reconstructs existing terms from current
  customer masters (and linked quotations), not historical values. Sending marks status only, not email delivery.
- New standalone and sales-confirmed work orders persist ordered routing snapshots. Existing orders retain
  empty snapshots; routing capacity/cost consumers remain follow-up work. MRP uses BOM quantities, not routing capacity.
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
- Phase 1 analytics uses Spring (confirmed 2026-10-04), under `/api/core/analytics` with the existing JWT/core client.
  Dashboard KPI/trend/current-risk reads use a repeatable-read DB snapshot, not DataContext. Revenue requires actual
  shipment confirmation/ledger/receivable links; production value uses current item standard price, not actual cost.
  Historical undated documents are counted as excluded coverage. Inventory turnover remains unavailable until
  cost/average-inventory history exists. MRP reads multilevel BOM, active work, usable stock and open PO remainders
  under the same snapshot policy. Shared components are netted once; late supply reduces quantity but is flagged.
  Reviewed proposals create real purchase orders through the existing audited POST. Component issue history is absent,
  so whole active work quantities are conservative planning demand, not an actual consumption ledger. See
  `docs/analytics-mrp.md`. FastAPI separation is deferred.
- `/analytics` reads Spring production progress/delay by due-date cohort, current actuals and item units.
  Means are per-order, not mixed-unit quantity totals; legacy over-actual rates are null/excluded. It does not
  reconstruct historical status or infer machine utilization. Inventory turnover/site analysis remains follow-up.
  Contract and drill-down boundaries: `docs/analytics-production.md`.
- `/analytics/sales` reads period orders/confirmed shipments separately from current backlog and open receivable
  document principal. It preserves ADMIN/SALES/ACCOUNTING receivable authority; other roles receive 403.
  Unknown historical backlog is null/excluded, orphan receivables are counted as exclusions, not guessed.
  Recorded partial collections do not change this principal metric; period cash-flow analysis remains follow-up.
  Contract: `docs/analytics-sales.md`.
- `/analytics/inventory` and `/inventory/stock` share real current stock/ledger/Lot analysis, not DataContext.
  Signed period movement is separate from current balances. Ledger/Lot differences are warnings, never automatic repairs.
  Lot aging is manufacturing/receiving-date elapsed time, not last movement. Turnover stays null without cost/average
  inventory history; site/warehouse balance reconstruction and Lot writes remain follow-up. See `docs/analytics-inventory.md`.
- `backend-fastapi/` is not implemented. Root Compose, `src/api/`, and generated Spring OpenAPI types exist.
- `/inventory/lots` reads paged `/lot-traces` and linked signed movements with actual receiving/work-order/shipment
  drill-downs. Original `/lots` arrays remain compatible with shipment selectors. Stored source links are checked;
  historical sources are never guessed. Lot write UI/disposal stock compensation remain follow-up. See `docs/lot-tracing.md`.
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
