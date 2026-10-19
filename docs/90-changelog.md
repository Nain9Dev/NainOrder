# Changelog

**Status:** Active

Notable changes. Format loosely follows Keep a Changelog; dates come from git.

## Unreleased

### Added

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
