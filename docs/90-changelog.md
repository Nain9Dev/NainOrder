# Changelog

**Status:** Active

Notable changes. Format loosely follows Keep a Changelog; dates come from git.

## Unreleased

### Added

- A populated first screen (`specs/next-demo-first-screen`): a fresh instance seeds six sample
  orders, one per state of the machine plus a second shipped one, dated across the last twelve
  days and built through the domain, so the dashboard opens with revenue, a distribution, a
  timeline, recent orders and best sellers instead of zeros. `Seed:SampleOrders=false` keeps the
  catalogue-only seed. The in-browser engine mirrors the same six orders, dates them relative to
  the day it is opened and replaces a database stored by an earlier version. REQ-120 to REQ-122.
- Live request map (`specs/005-request-map`): the Architecture view animates every request across
  the four layers with the server's own figures. Every response now carries `Server-Timing`
  (`app`, and `db` with the command count, measured by an EF Core interceptor and by the read
  side's raw commands), and every problem document names the `layer` that decided the rejection.
  REQ-110 to REQ-113.
- Browser tests (`e2e/`, ADR-0011): 25 Playwright tests against the real application cover the
  landing, the buyer and organizer views, the language selector, the buyer link and its QR code
  (decoded by an independent library), the offline shell and the 360 px layout. They run in their own
  CI job; the visual requirements REQ-090 to REQ-096 and REQ-101 to REQ-105 are now traced to tests.

- Mobile, install and share (`specs/004-mobile-share`, ADR-0010): the panel is an installable app
  (manifest, icons, service worker that caches the shell and never the API), shows when it is
  offline, and works at 360 px. An organizer gets a QR code, copy and share for the drop's buyer
  link (`#/d/<id>`), which opens a buyer-only page on the audience's phones. The QR encoder is
  in-repo, with no dependency. Use case documented in `docs/case-study.md`.
- Drop experience (`specs/003-drop-experience`): an animated, wordless landing for the drop, a
  buyer view and an organizer view of the same drop, and a Spanish/English selector covering the
  whole panel (dictionaries in `assets/i18n`, parity enforced by `I18nParityTests`). Drops report
  `nextHoldExpiresAt`.
- Drops (phase 1 of `specs/002-drops`, ADR-0008): a fixed number of units sold to a crowd through
  short expiring holds, with `/api/drops` endpoints, a `Drop` panel view with a crowd simulator, and
  an in-browser engine for the static demo. REQ-080 to REQ-086 and REQ-088.
- SQLite runs in WAL mode so a crowd of buyers no longer surfaces `database is locked` as a `500`
  ([ADR-0009](30-decisions/ADR-0009-sqlite-wal-mode.md)); drops get a larger rate-limit window.
- Stock race: `POST /api/demo/stock-race` and a panel view that run the "never oversell" guarantee
  live — N buyers against M units, conflicts retried, verdict computed from persisted stock
  (`specs/001-stock-race`, REQ-070 to REQ-073).
- Visual README: stock-race hero, state diagram, layered architecture figure and panel screenshots.
- Complete order lifecycle: `Processing`, `Shipped` and `Cancelled` transitions, with stock
  restitution on cancellation.
- Basket operations: change a line's quantity and remove a line, adjusting inventory by the exact
  difference in either direction.
- Optimistic concurrency on product stock, so simultaneous reservations cannot oversell
  ([ADR-0002](30-decisions/ADR-0002-optimistic-concurrency-on-stock.md)).
- CQRS read side: dashboard metrics aggregated in SQL over integer cents.
- Endpoints for customers, dashboard metrics and the published order state machine.
- Paginated order listing with filters by status, customer and reference, resolved in the database.
- Client panel served from the same origin: dashboard, catalogue, orders and architecture, with a
  live request trace ([ADR-0006](30-decisions/ADR-0006-dependency-free-client-panel.md)).
- Test suite across three levels — example-based, property-based (FsCheck) and integration over HTTP
  — including a concurrency test that demonstrates inventory cannot be oversold.
- CI as a quality gate: Release build, vulnerability audit, tests, and a smoke test against the
  container that actually gets deployed.
- Canonical documentation under `docs/`, with six ADRs and a traceability matrix that records its own
  gaps.

### Changed

- Money is persisted as integer cents instead of text
  ([ADR-0001](30-decisions/ADR-0001-money-as-integer-cents.md)). Sorting and aggregating amounts in
  SQLite previously operated on strings and returned incorrect results.
- The transactional boundary moved to `IUnitOfWork`
  ([ADR-0003](30-decisions/ADR-0003-unit-of-work-owns-the-transaction.md)). Repositories no longer
  commit on their own, so a use case touching two aggregates commits both or neither.
- Order totals are materialised on every basket mutation
  ([ADR-0004](30-decisions/ADR-0004-materialised-order-totals.md)).
- Errors are a contract: RFC 7807 with a stable `code`
  ([ADR-0005](30-decisions/ADR-0005-problem-details-error-contract.md)). Controllers no longer carry
  `try/catch`.
- The container runs as a non-root user and writes its database to a directory it owns.
- Swagger moved from `/` to `/swagger`; the client panel now occupies the root.
- [22-threat-model.md](22-threat-model.md) was rewritten to model the system that exists. The
  previous version described authentication, role-based authorisation, FluentValidation, PostgreSQL
  and audit events, none of which are implemented, and misstated the rate limiter and the
  idempotency contract. It now names its own gaps instead.
- The static deployment is labelled as what it is. The panel carries a permanent notice, and the
  dashboard no longer claims database aggregation while the browser engine is answering.

### Security

- `main` is protected. A change now reaches it through a pull request whose three CI contexts pass
  and are up to date with the base; force pushes and branch deletion are refused, and the rules
  apply to administrators. The quality gate described in `AGENTS.md` had been advisory until now,
  which is how four consecutive red runs reached `main` unnoticed. Closes G-9 in
  [22-threat-model.md](22-threat-model.md).

### Fixed

- Model-validation failures (`400`) were labelled `application/json` instead of
  `application/problem+json`, against REQ-050: the controllers' `[Produces]` filter rewrote the
  content type. They now go out as a problem document like every other failure.
- Panel: dashboard KPIs rendered `0` because the card helper read a misnamed property; the Architecture
  view printed its header button as raw markup; each navigation hid the first lines of a view under the
  sticky top bar. Buttons that start `hidden` (active order, install) showed as empty squares in the
  top bar because their `display` beat the `[hidden]` rule.
- The client no longer falls back to the in-browser engine when the device is offline: it reports
  "offline" instead of showing invented data.
- An unknown route under `/api` returned `200` with the panel's HTML instead of `404` JSON, which
  broke any client expecting a JSON body.
- A technical failure was reported as `400` with its message exposed, and was swallowed instead of
  being logged as an error.
- Paying an order with no lines was accepted.
- `SQLitePCLRaw.lib.e_sqlite3` was pulled in transitively at a version with a known high-severity
  vulnerability; a patched version is now pinned explicitly.
- The container build had been broken since central package management was introduced: the
  Dockerfile copied the four `.csproj` files but not `Directory.Build.props` or
  `Directory.Packages.props`, where `TargetFramework` and every package version now live, so
  `dotnet restore` failed with `NETSDK1013`. The container job had been red on `main` for four
  consecutive runs without blocking anything, because `main` carries no branch protection.
- The documented test count was wrong in four places (badge, README, traceability matrix and task
  log), all understating the real figure. The suite reports 76.
- The transaction sequence diagram in the README described an `If-Match`/`ETag` exchange that does
  not exist, named a command that does not exist, and reported insufficient stock as `422`. The
  endpoint answers `409`.
- Overlays and toasts leaked into the DOM when their closing animation never fired, for instance in a
  background tab.

### Removed

- Empty scaffolding files (`Class1.cs` in three projects) and a stray debug entry point at the
  repository root.
- The committed SQLite database file; it is generated on start-up and is now ignored.
- `UpdateAsync` from the repository interfaces — it did nothing and invited callers to believe
  otherwise.
