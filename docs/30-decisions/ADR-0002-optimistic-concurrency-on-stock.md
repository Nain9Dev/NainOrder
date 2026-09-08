# ADR-0002 — Optimistic concurrency on product stock

**Status:** Proposed

## Context

Reserving stock is a read-then-write: the use case loads a product, asks the aggregate to remove
units, and saves. Between the read and the write, another request can do the same. Without a guard,
two requests that each see one unit available will both succeed, and the catalogue ends up selling
inventory that does not exist.

This is the single strongest claim the project makes about itself, so it cannot rest on the domain
check alone — the domain check runs against a stale snapshot.

## Decision

Give `Product` an integer `Version` property, incremented by the aggregate on every mutation and
declared to EF Core as `IsConcurrencyToken()`.

EF Core then emits `UPDATE Products SET ... WHERE Id = @id AND Version = @originalVersion`. If
another request already moved the version, zero rows match and EF raises
`DbUpdateConcurrencyException`. `UnitOfWork` translates it into a `ConflictException`, which the API
surfaces as `409` with code `concurrency_conflict`.

## Alternatives considered

**Pessimistic locking (`SELECT ... FOR UPDATE`).** Not available in SQLite in a useful form, and it
would serialise the catalogue under load for a conflict that is rare in practice.

**A conditional `UPDATE` with the quantity in the predicate** (`SET Stock = Stock - @n WHERE Stock >= @n`).
Correct and cheaper, but it moves the invariant out of the domain and into a SQL string. The rule
"stock never goes negative" would then live in Infrastructure, which contradicts the layering.

**Rely on the transaction alone.** A transaction gives atomicity, not isolation from a lost update at
the default isolation level. It does not solve this.

**Do nothing and accept the race.** Rejected: the whole point of the project is that this class of
bug cannot happen.

## Consequences

- A losing request receives `409` rather than silently overselling. Clients must be prepared to
  retry; the panel surfaces it as a normal business rejection.
- Every write to `Product` bumps the version, including a price edit. Two concurrent price edits also
  conflict. That is acceptable and arguably correct.
- The guarantee is per-row. It does not extend to invariants spanning multiple products; none exist.

## Verification

`ConcurrencyTests.Concurrent_reservations_never_oversell_the_available_stock` releases sixteen
simultaneous reservations against six units and asserts that granted units plus remaining stock
equal the initial stock exactly, that nothing is rejected for a technical reason, and that at least
one reservation succeeded so the assertions cannot pass vacuously.
