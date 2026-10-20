# Open questions

**Status:** Open (Q-005 to Q-007); earlier questions resolved

## Open

These block the requirements of [specs/002-drops](../specs/002-drops/spec.md).

- **Q-005 — Buyer identity without accounts.** The charter excludes authentication. Options:
  (a) an anonymous per-visitor token in a cookie, limits enforced per token and per IP;
  (b) an email address entered at checkout. Blocks REQ-088 and the webhooks.
- **Q-006 — Payment.** Keep `confirm` as the existing `MarkAsPaid` transition (no gateway), or add a
  payment provider in test mode. Blocks any claim of real commerce.
- **Q-007 — Hold persistence.** Holds survive a restart (persisted, recommended) or are in-memory only.
  Blocks the migration design.

## Resolved

### Q-001 — Test coverage gaps recorded in traceability

**Resolution:** Resolved via automated test suite expansion.
- `REQ-004` is covered by `StockLevelsTests.Classify_maps_stock_quantities_to_expected_classification`.
- `REQ-011` is covered by `OrderFlowTests.A_duplicated_customer_email_is_rejected_with_a_conflict`.
- `REQ-041` is covered deterministically by `OrderAggregateConcurrencyProbe.Two_concurrent_modifications_to_the_same_order_trigger_optimistic_concurrency_conflict_and_prevent_lost_updates` and property tests in `DomainInvariantProperties`.
- `REQ-051` is covered by `GlobalExceptionHandlerTests` asserting status 500, code `internal_error`, and internal exception message suppression outside development.
- `REQ-054` is covered by `OrderFlowTests.Order_list_endpoint_honors_pagination_contract_and_filters`.

### Q-002 — Business rule: a repeated product in an order

**Resolution:** Option (a) approved by owner.
`Order.AddItem` continues to strictly enforce line uniqueness within an order (`DuplicateOrderItemException`), keeping the domain invariant explicit. Quantity modifications are performed via `ChangeItemQuantity`.

### Q-003 — Stock is reserved on adding a line, not on payment

**Resolution:** Option (a) approved by owner.
Units continue to be reserved immediately upon line addition within the transaction, demonstrating deterministic reservation and restitution upon cancellation for this bounded scope.

### Q-004 — Where money is rounded

**Resolution:** Option (b) approved by owner.
Keep both domain rounding on entity construction and `MoneyConverter` rounding as defense in depth, ensuring exact integer cent representation across all boundaries.
