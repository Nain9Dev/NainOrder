# ADR-0007 — Optimistic concurrency on the order aggregate

**Status:** Proposed

## Context

`Order` manages materialized totals (`TotalAmount`, `TotalUnits`) and a state machine (`Status`).
While individual product stock reservations are guarded by `Product.Version` (see
[ADR-0002](ADR-0002-optimistic-concurrency-on-stock.md)), the `Order` aggregate lacked a concurrency
token.

When two concurrent requests modified the same order simultaneously — for instance, removing two
different lines in separate contexts — both loaded the aggregate snapshot, updated items, and saved.
Because EF Core issued `UPDATE Orders SET TotalAmount = ..., TotalUnits = ...` without checking the
aggregate version, the second write silently overwrote the first, corrupting materialized totals
(`stored.TotalAmount != sum(stored.Items)`), as proven by `OrderAggregateConcurrencyProbe`.

## Decision

Give `Order` an integer `Version` property, incremented by the aggregate on every mutation:
- Adding an item (`AddItem`)
- Changing line quantity (`ChangeItemQuantity`)
- Removing an item (`RemoveItem`)
- All state transitions (`MarkAsPaid`, `MarkAsProcessing`, `MarkAsShipped`, `Cancel`)

Declare `builder.Property(o => o.Version).IsConcurrencyToken()` in `OrderConfiguration`.

When a concurrent modification occurs, EF Core emits an `UPDATE` with `WHERE Id = @id AND Version = @originalVersion`.
If another request already committed an update, zero rows match and EF Core raises
`DbUpdateConcurrencyException`. `UnitOfWork` translates it into `ConflictException("concurrency_conflict")`,
which the API surfaces as `409 Conflict`.

## Alternatives considered

**Pessimistic locking.** Not available in SQLite in a usable form, and would serialize concurrent
operations even when contention is low.

**Recompute on read instead of materializing totals.** Rejected: contradicts [ADR-0004](ADR-0004-materialised-order-totals.md),
preventing SQL-level filtering, pagination, and analytics aggregation.

**Do nothing and accept the race.** Rejected: preserving aggregate invariants under concurrency is a
core non-negotiable claim of NainOrder.

## Consequences

- The order aggregate invariants (`TotalAmount == sum(lines)` and `TotalUnits == sum(lines)`) cannot
  drift under concurrent operations.
- The losing concurrent request receives an actionable `409 Conflict` (`concurrency_conflict`),
  inviting the client to refresh and retry.
- An EF Core migration (`AddOrderVersion`) persists the `Version` column on the `Orders` table.

## Verification

- `OrderAggregateConcurrencyProbe` demonstrates that two concurrent line removals trigger
  `DbUpdateConcurrencyException` on the second transaction, preserving the aggregate total.
- `DomainInvariantProperties.Every_order_mutation_moves_the_concurrency_token_forward` proves that
  every domain mutation increments `Order.Version`.
