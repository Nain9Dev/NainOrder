# Open questions

**Status:** Resolved

Historical log of design questions and their resolved decisions.

## Q-001 — Test coverage gaps recorded in traceability

**Resolution:** Resolved via automated test suite expansion.
- `REQ-004` is covered by `StockLevelsTests.Classify_maps_stock_quantities_to_expected_classification`.
- `REQ-011` is covered by `OrderFlowTests.A_duplicated_customer_email_is_rejected_with_a_conflict`.
- `REQ-041` is covered deterministically by `OrderAggregateConcurrencyProbe.Two_concurrent_modifications_to_the_same_order_trigger_optimistic_concurrency_conflict_and_prevent_lost_updates` and property tests in `DomainInvariantProperties`.
- `REQ-051` is covered by `GlobalExceptionHandlerTests` asserting status 500, code `internal_error`, and internal exception message suppression outside development.
- `REQ-054` is covered by `OrderFlowTests.Order_list_endpoint_honors_pagination_contract_and_filters`.

## Q-002 — Business rule: a repeated product in an order

**Resolution:** Option (a) approved by owner.
`Order.AddItem` continues to strictly enforce line uniqueness within an order (`DuplicateOrderItemException`), keeping the domain invariant explicit. Quantity modifications are performed via `ChangeItemQuantity`.

## Q-003 — Stock is reserved on adding a line, not on payment

**Resolution:** Option (a) approved by owner.
Units continue to be reserved immediately upon line addition within the transaction, demonstrating deterministic reservation and restitution upon cancellation for this bounded scope.

## Q-004 — Where money is rounded

**Resolution:** Option (b) approved by owner.
Keep both domain rounding on entity construction and `MoneyConverter` rounding as defense in depth, ensuring exact integer cent representation across all boundaries.
