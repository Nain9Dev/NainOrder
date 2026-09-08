# Tasks

**Status:** Active

## Done

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-001 | Remove dead scaffolding (`Class1.cs`, `TestBug.cs`, committed database file) | `[A]` | ✅ The solution builds with no orphan file |
| T-002 | Typed domain exceptions with a stable `code` | `[A]` | ✅ No `throw new Exception` remains in Domain or Application |
| T-003 | Complete the order state machine: `Processing`, `Shipped`, `Cancelled` with stock restitution | `[A]` | ✅ `OrderStateMachineTests` covers every transition and every rejection |
| T-004 | Basket operations: change quantity, remove line, with exact stock adjustment | `[A]` | ✅ `Changing_a_line_quantity_adjusts_the_stock_by_the_exact_difference` passes |
| T-005 | `IUnitOfWork` as the transactional boundary ([ADR-0003](30-decisions/ADR-0003-unit-of-work-owns-the-transaction.md)) | `[A]` | ✅ Repositories no longer commit |
| T-006 | Money as integer cents ([ADR-0001](30-decisions/ADR-0001-money-as-integer-cents.md)) | `[A]` | ✅ Migration shows `INTEGER` columns |
| T-007 | Optimistic concurrency on stock ([ADR-0002](30-decisions/ADR-0002-optimistic-concurrency-on-stock.md)) | `[A]` | ✅ `Concurrent_reservations_never_oversell_the_available_stock` passes |
| T-008 | Materialised order totals ([ADR-0004](30-decisions/ADR-0004-materialised-order-totals.md)) | `[A]` | ✅ Listing and metrics aggregate in SQL |
| T-009 | RFC 7807 error contract ([ADR-0005](30-decisions/ADR-0005-problem-details-error-contract.md)) | `[A]` | ✅ No controller carries a `try/catch` |
| T-010 | CQRS read side for dashboard metrics | `[A]` | ✅ `AnalyticsRepository` aggregates in SQL over cents |
| T-011 | Client panel: dashboard, catalogue, orders, architecture ([ADR-0006](30-decisions/ADR-0006-dependency-free-client-panel.md)) | `[A]` | ✅ Four views operate the full lifecycle end to end |
| T-012 | Pin a patched `SQLitePCLRaw` — the transitive version carried a known high-severity vulnerability | `[A]` | ✅ `dotnet list package --vulnerable` is clean |
| T-013 | Container hardening: non-root user, writable data directory, layer caching | `[A]` | ✅ `id -u` inside the image is not `0` |
| T-014 | An unknown `/api` route must return `404` JSON, not the panel's HTML | `[A]` | ✅ `An_unknown_api_route_returns_json_404_and_never_the_client_application` passes |
| T-015 | Test suite: example-based, property-based and integration | `[A]` | ✅ 40 tests green in Release |
| T-016 | CI as a quality gate: build, vulnerability audit, tests, container smoke test | `[A]` | ✅ Green run on the pull request |
| T-017 | Canonical documentation under `docs/` with ADRs and traceability | `[A]` | ✅ Every requirement mapped, or its gap declared |

## Next

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-018 | Resolve Q-001: decide how to cover the five gaps in [50-traceability.md](50-traceability.md) | `[M]` | Every requirement maps to a test, or its gap is accepted in writing |
| T-019 | Resolve Q-002: keep or change the repeated-product rule | `[H]` | The decision is recorded as an ADR |
| T-020 | Resolve Q-003: reservation expiry policy | `[H]` | The decision is recorded as an ADR |
| T-021 | Promote the `docs/` set from `Draft` to `Approved` after review | `[H]` | Statuses updated in [README.md](README.md) |
| T-022 | Publish a live instance and link it from the README | `[H]` | The URL responds `200` on `/health` |

## Handoff

Latest state: the pull request contains T-001 to T-017. Build and tests are green in Release, the
container has been verified running, and the panel has been exercised in a browser across the four
views and the full order lifecycle. Nothing is in progress. What is pending is the owner's decision
on T-018 to T-022 — three of them are business or ownership calls that an agent must not make alone.
