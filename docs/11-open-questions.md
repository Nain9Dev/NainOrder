# Open questions

**Status:** Open

Unresolved items. Each blocks the requirement it references until it is answered.

## Q-001 — Test coverage gaps recorded in traceability

**Blocks:** REQ-004, REQ-011, REQ-041, REQ-051, REQ-054 (partially)

Five requirements have no test that demonstrates them, or only a partial one. They are listed
explicitly in [50-traceability.md](50-traceability.md) rather than mapped to a test that does not
actually cover them.

The one worth deciding first is **REQ-041**: the `409 concurrency_conflict` path is reachable but not
deterministically forcible from an integration test, because it depends on real interleaving. Making
it deterministic means either injecting a hook into `SaveChangesAsync` or testing `UnitOfWork`
against a stubbed `DbContext`. Both add a seam to production code purely for a test.

**Options:** (a) accept the gap and document it, (b) add the seam, (c) test the translation of
`DbUpdateConcurrencyException` in isolation without simulating the race.

**Owner decision required.**

## Q-002 — Business rule: a repeated product in an order

**Blocks:** REQ-023

`Order.AddItem` rejects a product already present in the basket. From a domain standpoint this is
coherent — a line is a unique entry — but from a shopping standpoint the expected behaviour is
usually "increase the quantity".

The current rule was inherited and has been preserved deliberately: changing it would alter business
behaviour, which is not an agent's call. The panel works around it by directing the user to the order
detail, where the quantity can be changed.

**Options:** (a) keep the rule as an explicit domain invariant, (b) have `AddItem` accumulate onto
the existing line.

**Owner decision required.**

## Q-003 — Stock is reserved on adding a line, not on payment

**Blocks:** nothing today; affects REQ-021

Units leave the catalogue as soon as a line is added to an unpaid order. An abandoned basket
therefore holds inventory indefinitely, because nothing expires it.

For the current scope this is the simplest correct behaviour and it is what the tests assert. At real
scale it needs either a reservation expiry or a move to reserving at payment time.

**Options:** (a) leave as is and document the limitation, (b) add a TTL with a background sweeper,
(c) reserve at payment and accept the risk of a payment failing for lack of stock.

**Owner decision required before any production use.**

## Q-004 — Where money is rounded

**Blocks:** nothing; affects REQ-002 and REQ-042

Rounding happens in two places: the domain rounds a price on construction, and `MoneyConverter`
rounds again on the way to the database. Both use `MidpointRounding.AwayFromZero`, so they agree, but
two rounding sites is one more than necessary.

**Options:** (a) leave the domain as the only rounding authority and make the converter a pure cast,
(b) keep both as defence in depth and document why.
