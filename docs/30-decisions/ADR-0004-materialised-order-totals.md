# ADR-0004 — Order totals are materialised, not derived on read

**Status:** Proposed

## Context

`Order.TotalAmount` was a computed property summing its lines. Correct in memory, but it meant the
total existed nowhere the database could see. Two consequences:

- The order list could not sort or filter by amount without loading every line of every order.
- Dashboard revenue could not be aggregated in SQL. Combined with the `TEXT` decimal storage of the
  time (see [ADR-0001](ADR-0001-money-as-integer-cents.md)), aggregation was both slow and wrong.

## Decision

Persist `TotalAmount` and `TotalUnits` on `Order`, recalculated by the aggregate itself in
`RecalculateTotals()` after every basket mutation — `AddItem`, `ChangeItemQuantity`, `RemoveItem`.

The values are never set from outside the aggregate. They are a materialisation of a rule the
aggregate owns, not a cache another layer maintains.

## Alternatives considered

**Compute on read and accept the cost.** Fine at demo scale, wrong as a design. A list endpoint would
issue one query per order.

**A database view or computed column.** SQLite computed columns cannot aggregate a child table. A
view would work for reads but leaves writes unguarded.

**Let the Application layer update the totals.** Puts an invariant of the aggregate outside it, so a
future caller could persist an order whose total disagrees with its lines.

## Consequences

- `GET /api/orders` projects straight to a summary DTO with no line loaded; `AnalyticsRepository`
  aggregates with a plain `SUM` over an integer column.
- The totals are denormalised, so they can in principle drift. The mitigation is structural: only the
  aggregate can write them, and it always writes them together with the mutation that changed them.
- Any future path that modifies lines must go through the aggregate. Bypassing it — a raw SQL update
  on `OrderItems`, for example — would break the invariant. `AGENTS.md` lists it among the ones that
  must never regress.

## Verification

`DomainInvariantProperties.The_order_total_always_equals_the_sum_of_its_lines` generates arbitrary
baskets and compares the materialised total against an independently computed sum;
`Removing_every_line_brings_the_total_back_to_zero` covers the shrinking direction.
