# ADR-0003 — The unit of work owns the transactional boundary

**Status:** Proposed
**Supersedes:** `SaveChangesAsync` and no-op `UpdateAsync` on each repository

## Context

The original repositories each exposed `SaveChangesAsync` and an `UpdateAsync` that did nothing,
because EF Core already tracks loaded entities. That shape had three problems:

- Adding a line to an order mutates two aggregates — the order and the product's stock. With commit
  logic spread across repositories, nothing in the code said those two writes must land together.
- `UpdateAsync` was dead API surface that invited callers to believe it did something. An earlier
  bug came from exactly that: calling `context.Update()` on a tracked graph made EF issue an
  `UPDATE` for a brand-new line instead of an `INSERT`.
- Every repository could commit independently, so a partially applied use case was expressible.

## Decision

Introduce `IUnitOfWork` in the Application layer with `SaveChangesAsync` and
`ExecuteInTransactionAsync`. Repositories declare intent only — `AddAsync`, queries — and never
commit. The use case decides when the change is durable.

`UnitOfWork` lives in Infrastructure over the EF Core `DbContext`, reuses an already-open transaction
instead of nesting (SQLite does not nest), and translates `DbUpdateConcurrencyException` into the
Application-level `ConflictException` so no EF Core type escapes into a use case.

## Alternatives considered

**Keep `SaveChangesAsync` per repository.** Status quo; leaves the multi-aggregate write unguarded.

**A transaction filter or middleware wrapping every request.** Uniform, but it opens a transaction
for reads too and hides the boundary from the code that actually needs it. The boundary is a design
decision of the use case and should be visible there.

**A generic `IRepository<T>` base with a shared `SaveChanges`.** Reintroduces the same coupling with
more indirection.

## Consequences

- `AddItemToOrderAsync`, `ChangeItemQuantityAsync`, `RemoveItemFromOrderAsync` and `CancelOrderAsync`
  are explicitly atomic across both aggregates.
- Repository interfaces shrank; there is no method that pretends to persist.
- The use case, not the repository, is the unit of failure. A test that observes a rejected operation
  can assert that inventory was untouched.
- Anyone adding a repository must remember it cannot commit. `AGENTS.md` states this.

## Verification

`OrderFlowTests.Asking_for_more_units_than_available_is_a_conflict_with_actionable_data` and
`Adding_the_same_product_twice_is_rejected_without_consuming_stock` both assert that after a rejected
operation the stock is byte-for-byte what it was before.
