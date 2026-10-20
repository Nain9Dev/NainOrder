# ADR-0008 — Drops with expiring holds

**Status:** Approved

## Context

NainOrder reserves stock when a line is added to an order and never releases it unless the order is
cancelled. That is correct for a basket, but a limited launch needs the opposite pressure: units must
be held only briefly while the buyer decides, then return to the crowd. Without expiry, abandoned
carts lock stock and the drop never sells out honestly.

## Decision

Introduce a `Drop` aggregate that owns a fixed number of units, and a `Hold` that reserves some of
them for a short window. A confirmed hold becomes an order through the existing `OrderService`;
an unconfirmed one expires and its units return to the drop.

- **Where the stock lives.** The drop owns its units; it does not borrow from `Product.StockQuantity`
  while the drop is live. This keeps catalogue stock and drop stock from interfering.
- **Concurrency.** `Drop.Version` is an optimistic concurrency token, the same pattern as
  [ADR-0007](ADR-0007-optimistic-concurrency-on-order-aggregate.md). A losing writer gets
  `concurrency_conflict` and retries, as in the stock race.
- **Expiry.** Checked lazily on every read and write of the drop, and swept every second by a
  background service. Correctness depends only on the lazy check; the sweeper keeps the live state fresh.
- **Time.** All decisions use an injected `TimeProvider`, so expiry is tested without sleeping.

## Alternatives considered

- **Reuse `Product.StockQuantity` for drops.** Rejected: a drop would race the catalogue's own
  reservations and could not guarantee "exactly N units".
- **Expiry only in a background job.** Rejected: a stopped job would make units unavailable forever.
- **Redis with key TTLs.** Rejected for now: adds a service and breaks the single-process,
  zero-cost deployment constraint in the charter.

## Consequences

- Scope grows from a basket engine to a launch engine; the charter's objective needs a matching update.
- A new aggregate, migration and background service to maintain and test.
- Restarting the process must not lose holds, so they are persisted, not kept in memory (Q-007).
