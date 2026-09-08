# Traceability

**Status:** Active · last verified against a green run of `dotnet test NainOrder.slnx -c Release`

Every requirement in [10-requirements.md](10-requirements.md) and the test that demonstrates it.
A requirement with no test is not done, whatever the code says.

Test suites:

| Suite | Kind | What it exercises |
| :--- | :--- | :--- |
| `Domain.OrderStateMachineTests` | Example-based | The aggregate in isolation, with no database |
| `Domain.DomainInvariantProperties` | Property-based (FsCheck) | Hundreds of generated cases per run, searching for a counterexample |
| `Api.OrderFlowTests` | Integration over HTTP | The real application with its migrations and middleware |
| `Api.ConcurrencyTests` | Integration, concurrent | Simultaneous requests competing for the same units |

## Catalogue

| Requirement | Test |
| :--- | :--- |
| REQ-001 | `OrderFlowTests.A_duplicated_sku_is_rejected_with_a_conflict` |
| REQ-002 | `DomainInvariantProperties.Prices_are_always_stored_rounded_to_two_decimals` |
| REQ-003 | `DomainInvariantProperties.A_rejected_removal_does_not_touch_the_stock`, `Stock_never_goes_negative_whatever_the_sequence_of_removals` |
| REQ-004 | *Not covered by an automated test.* Classification lives in `StockLevels.Classify`; the panel renders it. Logged in [11-open-questions.md](11-open-questions.md). |

## Customers

| Requirement | Test |
| :--- | :--- |
| REQ-010 | `DomainInvariantProperties.A_customer_email_is_always_normalised_to_lowercase` |
| REQ-011 | *Not covered by an automated test.* Same shape as REQ-001, which is covered. Logged in [11-open-questions.md](11-open-questions.md). |
| REQ-012 | `OrderStateMachineTests.An_order_always_needs_a_customer` |

## Order basket

| Requirement | Test |
| :--- | :--- |
| REQ-020 | `OrderStateMachineTests.A_new_order_starts_pending_payment_and_is_editable` |
| REQ-021 | `OrderFlowTests.The_full_purchase_flow_moves_stock_and_state_together` |
| REQ-022 | `OrderFlowTests.Asking_for_more_units_than_available_is_a_conflict_with_actionable_data` |
| REQ-023 | `OrderStateMachineTests.The_same_product_cannot_be_added_twice`, `OrderFlowTests.Adding_the_same_product_twice_is_rejected_without_consuming_stock` |
| REQ-024 | `OrderStateMachineTests.Changing_the_quantity_reports_the_exact_stock_delta`, `OrderFlowTests.Changing_a_line_quantity_adjusts_the_stock_by_the_exact_difference` |
| REQ-025 | `OrderFlowTests.Changing_a_line_quantity_adjusts_the_stock_by_the_exact_difference` (final step), `OrderStateMachineTests.Removing_a_line_that_is_not_in_the_order_is_rejected` |
| REQ-026 | `DomainInvariantProperties.The_order_total_always_equals_the_sum_of_its_lines`, `Removing_every_line_brings_the_total_back_to_zero` |
| REQ-027 | `OrderFlowTests.The_full_purchase_flow_moves_stock_and_state_together` asserts the frozen unit price survives the round trip. |

## Order lifecycle

| Requirement | Test |
| :--- | :--- |
| REQ-030 | `OrderStateMachineTests.The_published_transition_table_matches_the_expected_contract` (5 cases), `The_happy_path_walks_pending_paid_processing_shipped` |
| REQ-031 | `OrderStateMachineTests.Shipping_without_processing_first_is_rejected`, `A_shipped_order_cannot_be_cancelled` |
| REQ-032 | `OrderStateMachineTests.An_empty_order_cannot_be_paid`, `OrderFlowTests.An_empty_order_cannot_be_paid` |
| REQ-033 | `OrderStateMachineTests.The_basket_is_frozen_once_the_order_is_paid` |
| REQ-034 | `OrderStateMachineTests.Cancelling_reports_every_unit_that_must_go_back_to_the_catalogue`, `OrderFlowTests.Cancelling_an_order_puts_the_reserved_stock_back` |
| REQ-035 | `OrderFlowTests.The_state_machine_published_by_the_api_matches_the_domain` |

## Concurrency and integrity

| Requirement | Test |
| :--- | :--- |
| REQ-040 | `ConcurrencyTests.Concurrent_reservations_never_oversell_the_available_stock`, `Concurrent_changes_to_the_same_order_keep_the_totals_consistent` |
| REQ-041 | `DomainInvariantProperties.Every_mutation_moves_the_concurrency_token_forward` covers the mechanism. The `409 concurrency_conflict` path is exercised opportunistically by `ConcurrencyTests`, which accepts it as a valid outcome but cannot force it deterministically. Logged in [11-open-questions.md](11-open-questions.md). |
| REQ-042 | `OrderFlowTests.Dashboard_metrics_stay_consistent_with_the_orders_that_produced_them` aggregates in SQL and compares against the orders that produced the figures. |

## HTTP contract

| Requirement | Test |
| :--- | :--- |
| REQ-050 | Every error-path test asserts on `code`; `OrderFlowTests.An_unknown_order_returns_a_problem_details_404` also asserts the content type. |
| REQ-051 | Covered for the `4xx` side by the error-path tests. The `500` suppression branch has no test. Logged in [11-open-questions.md](11-open-questions.md). |
| REQ-052 | `OrderFlowTests.An_unknown_api_route_returns_json_404_and_never_the_client_application`; CI additionally asserts it against the running container. |
| REQ-053 | `OrderFlowTests.Invalid_payloads_are_rejected_before_reaching_the_domain` |
| REQ-054 | `OrderFlowTests` exercises the list endpoint; the pagination metadata contract is verified in the panel but has no dedicated assertion. Logged in [11-open-questions.md](11-open-questions.md). |

## Delivery

| Requirement | Test |
| :--- | :--- |
| REQ-060 | `OrderFlowTests.The_client_application_and_the_documentation_are_both_served` |
| REQ-061 | `OrderFlowTests.Deep_links_of_the_client_application_fall_back_to_the_spa` |
| REQ-062 | `NainOrderApiFactory` boots the real application per test run; every integration test depends on migrations and seeding having succeeded. CI repeats it against the container. |
| REQ-063 | CI job `container` asserts `id -u` is not `0` inside the running image. |

## Gaps

Five requirements are honestly marked as not covered above: REQ-004, REQ-011, REQ-041 (partially),
REQ-051 (partially) and REQ-054 (partially). They are listed as open items rather than quietly
mapped to a test that does not actually demonstrate them.
