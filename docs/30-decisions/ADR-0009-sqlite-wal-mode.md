# ADR-0009 — SQLite in WAL mode

**Status:** Proposed

## Context

Drops bring many buyers writing to one database at once, plus a background sweeper. With SQLite's
default rollback journal a committing writer blocks readers, and under a 40-buyer crowd the
application answered `500` with `SQLite Error 5: database is locked`. That breaks the rule that a
business outcome is `4xx` and only a technical failure is `500`: a busy database is not the
buyer's fault and should not reach them at all.

## Decision

Run `PRAGMA journal_mode=WAL` at start-up, after migrations. Readers then proceed while a writer
commits; writers still serialise, and optimistic concurrency keeps resolving conflicts as `409`.
The mode is stored in the database file, so repeating the statement on later starts changes nothing.

## Alternatives considered

- **Raise the busy timeout.** Rejected as the only fix: it hides contention behind latency and does
  not remove the reader/writer block.
- **Move to PostgreSQL.** Right for sustained production load, rejected here: it breaks the charter's
  single-process, zero-cost deployment. The runbook already records this as the known limit.

## Consequences

- Two extra files, `-wal` and `-shm`, appear beside the database. Back up and move all three together.
- WAL needs a local filesystem; it is not supported on network shares.
- Sustained write traffic still needs a different engine (see the runbook).
