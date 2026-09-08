# ADR-0001 — Money is persisted as integer cents

**Status:** Proposed
**Supersedes:** the original `HasColumnType("decimal(18,2)")` mapping

## Context

The domain works in `decimal`, which is the correct type for money in .NET. SQLite, however, has no
decimal type. EF Core's default mapping stores it as `TEXT`, and that has consequences that only
surface once there is enough data to notice:

- `ORDER BY TotalAmount` sorts lexicographically. `"9.00"` comes after `"10.00"`.
- `SUM(TotalAmount)` coerces text to a floating-point value, so aggregated revenue accumulates
  representation error.

Both were live in the original implementation. The dashboard aggregates revenue and the order list
sorts by amount, so neither is hypothetical.

## Decision

Persist every monetary property as an integer number of cents, through a
`ValueConverter<decimal, long>` applied to `Product.Price` and `OrderItem.UnitPrice` (and, since
[ADR-0004](ADR-0004-materialised-order-totals.md), `Order.TotalAmount`).

The conversion happens at the persistence boundary. The domain never sees cents and keeps operating
in `decimal`.

## Alternatives considered

**Map to `double`.** Simple and sortable, but reintroduces binary floating-point error into money —
the exact defect the change is meant to remove.

**Keep `TEXT` and aggregate in memory.** Correct arithmetic, but the read side would have to
materialise every order to compute a total. The cost grows with the data, which defeats the purpose
of having a read model.

**Store as `TEXT` with fixed-width zero padding.** Makes sorting work; leaves `SUM` broken and adds a
format nobody else reading the database would expect.

## Consequences

- Sorting and aggregation are exact and happen in the engine.
- Analytical queries can be written as plain SQL over integers — see `AnalyticsRepository`.
- The maximum representable amount is bounded by `long` in cents, far beyond any realistic order.
- Reading the database by hand shows `189900` instead of `1899.00`. Documented here and in
  [21-data-model.md](../21-data-model.md) so it is not mistaken for a bug.
- Migrating to a real decimal engine (PostgreSQL, SQL Server) is a converter change, not a domain
  change.

## Verification

`DomainInvariantProperties.Prices_are_always_stored_rounded_to_two_decimals` and the integration
tests, which assert exact amounts returned over HTTP after a full round trip through the database.
