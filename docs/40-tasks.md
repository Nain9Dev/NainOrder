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
| T-015 | Test suite: example-based, property-based and integration | `[A]` | ✅ 76 tests green in Release |
| T-016 | CI as a quality gate: build, vulnerability audit, tests, container smoke test | `[A]` | ✅ Green run on the pull request |
| T-017 | Canonical documentation under `docs/` with ADRs and traceability | `[A]` | ✅ Every requirement mapped to an automated test |
| T-018 | Resolve Q-001: cover the five gaps in [50-traceability.md](50-traceability.md) | `[A]` | ✅ All 5 gaps covered with automated tests; 100% requirements traceability |
| T-019 | Resolve Q-002: confirm repeated-product rule in `AddItem` | `[M]` | ✅ Explicit domain invariant retained; verified by tests |
| T-020 | Resolve Q-003: confirm reservation policy | `[M]` | ✅ Immediate reservation on line addition confirmed for bounded scope |
| T-023 | Optimistic concurrency on `Order` aggregate ([ADR-0007](30-decisions/ADR-0007-optimistic-concurrency-on-order-aggregate.md)) | `[A]` | ✅ `Order.Version` concurrency token + probe test passing |
| T-024 | Pin local dev port 8170 per `dev-ports.json` | `[A]` | ✅ Port 8170 pinned in `launchSettings.json` |
| T-025 | Align every documented claim with the code: test count, transaction diagram, threat model, repository description, and the nature of the static deployment | `[A]` | ✅ No claim in `README.md` or `docs/` asserts behaviour the code does not implement |
| T-030 | Protect `main`: require a pull request and a green pipeline before merge | `[M]` | ✅ `main` reports `protected: true`. A pull request is required, the three CI contexts must pass and be up to date with the base, force pushes and deletion are refused, and the rules apply to administrators |

Feature [001 — stock race](../specs/001-stock-race/tasks.md) (T-031 to T-036) is done: 82 tests green.

Feature [next — demo first screen](../specs/next-demo-first-screen/tasks.md) (T-080 to T-084) is
done: 135 .NET and 32 browser tests green. Q-008 (the entry route) stays with the owner.

## Next

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-021 | Promote the `docs/` set from `Draft` to `Approved` after review | `[H]` | Statuses updated in [README.md](README.md) |
| T-022 | Publish a live instance and link it from the README | `[H]` | The URL responds `200` on `/health` |
| T-026 | Remove the two third-party resources from `index.html`, or self-host them with Subresource Integrity, and correct the zero-dependency claim until then | `[A]` | The panel loads no remote origin, or every remote reference carries `integrity`. Closes G-3 in [22-threat-model.md](22-threat-model.md) |
| T-027 | Make `dom.js` compose templates safely so nested `html` does not need `raw()` | `[A]` | The architecture view renders its markup instead of printing it, and a test asserts it. Closes G-4 |
| T-028 | Emit security response headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, HSTS) | `[A]` | An integration test asserts the headers. Closes G-5 |
| T-029 | Restrict trusted proxies so the rate limiter partition key cannot be spoofed via `X-Forwarded-For` | `[A]` | Closes G-1 |

## Handoff

State: 76 automated tests green in Release, `AddOrderVersion` EF Core migration added, optimistic concurrency on `Order` preventing aggregate lost updates, all 5 traceability gaps closed, and port 8170 pinned per developer registry.

T-025 closed: the documented claims now match the code. The threat model was rewritten against the
real system and records ten known gaps (G-1 to G-10) instead of describing controls that do not
exist. T-026 to T-029 are those gaps turned into tasks; none is started. No code in `Domain`,
`Application`, `Infrastructure` or the controllers was touched, so the suite is unchanged at 76.

Verified: `dotnet build && dotnet test` green (0 warnings, 76/76), and the panel exercised in a
browser against both engines — the real API on `:8170` (no notice, database copy) and the static
fallback with no API behind it (notice visible, browser-engine copy), at desktop and 375 px.
