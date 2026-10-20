# Traceability

**Status:** Active · verified against a green run of `dotnet test NainOrder.slnx -c Release` (116/116 tests)

Every requirement in [10-requirements.md](10-requirements.md) and the test that demonstrates it.
A requirement with no test is not done, whatever the code says.

Test suites:

| Suite | Kind | What it exercises |
| :--- | :--- | :--- |
| `Domain.OrderStateMachineTests` | Example-based | The aggregate in isolation, with no database |
| `Domain.DomainInvariantProperties` | Property-based (FsCheck) | Hundreds of generated cases per run, searching for a counterexample |
| `Application.StockLevelsTests` | Theory/Boundary | Stock level classification and threshold boundaries |
| `Api.OrderFlowTests` | Integration over HTTP | The real application with its migrations and middleware |
| `Api.ConcurrencyTests` | Integration, concurrent | Simultaneous requests competing for the same units |
| `Api.OrderAggregateConcurrencyProbe` | Concurrency, aggregate | Multi-context concurrent aggregate mutations and optimistic concurrency conflict enforcement |
| `Domain.DropTests` | Example-based + property-based | The drop aggregate with an explicit clock: holds, expiry, limits, the held-plus-sold invariant |
| `Api.DropFlowTests` | Integration, concurrent | Drops over HTTP with a hand-moved clock, a 40-buyer crowd and UTC serialisation |
| `Api.I18nParityTests` | Contract | Both panel languages define the same keys and placeholders |
| `Api.StockRaceTests` | Integration, concurrent | The on-demand race: many buyers, few units, verdict from persisted stock |
| `Api.GlobalExceptionHandlerTests` | Contract/Unit | RFC 7807 error translation and production 500 detail sanitization |

## Catalogue

| Requirement | Test |
| :--- | :--- |
| REQ-001 | `OrderFlowTests.A_duplicated_sku_is_rejected_with_a_conflict` |
| REQ-002 | `DomainInvariantProperties.Prices_are_always_stored_rounded_to_two_decimals` |
| REQ-003 | `DomainInvariantProperties.A_rejected_removal_does_not_touch_the_stock`, `Stock_never_goes_negative_whatever_the_sequence_of_removals` |
| REQ-004 | `StockLevelsTests.Classify_maps_stock_quantities_to_expected_classification` |

## Customers

| Requirement | Test |
| :--- | :--- |
| REQ-010 | `DomainInvariantProperties.A_customer_email_is_always_normalised_to_lowercase` |
| REQ-011 | `OrderFlowTests.A_duplicated_customer_email_is_rejected_with_a_conflict` |
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
| REQ-040 | `ConcurrencyTests.Concurrent_reservations_never_oversell_the_available_stock`, `ConcurrencyTests.Concurrent_changes_to_the_same_order_keep_the_totals_consistent` |
| REQ-041 | `DomainInvariantProperties.Every_mutation_moves_the_concurrency_token_forward`, `DomainInvariantProperties.Every_order_mutation_moves_the_concurrency_token_forward`, and `OrderAggregateConcurrencyProbe.Two_concurrent_modifications_to_the_same_order_trigger_optimistic_concurrency_conflict_and_prevent_lost_updates` |
| REQ-042 | `OrderFlowTests.Dashboard_metrics_stay_consistent_with_the_orders_that_produced_them` aggregates in SQL and compares against the orders that produced the figures. |

## Stock race

| Requirement | Test |
| :--- | :--- |
| REQ-070 | `StockRaceTests.A_race_never_sells_more_units_than_exist_and_balances_to_the_unit` |
| REQ-071 | `StockRaceTests.A_race_with_more_units_than_buyers_sells_to_everyone` (conflicts are retried until every buyer has a final answer) and the `insufficient_stock` assertion in the 24-vs-5 race |
| REQ-072 | `StockRaceTests.A_race_never_sells_more_units_than_exist_and_balances_to_the_unit` |
| REQ-073 | `StockRaceTests.A_race_outside_the_allowed_range_is_rejected_with_400` (four boundary cases) |

## Drops

| Requirement | Test |
| :--- | :--- |
| REQ-080 | `DropTests.A_drop_is_scheduled_until_it_opens_and_live_afterwards`, `A_drop_rejects_invalid_configuration`; `DropFlowTests.A_new_drop_reports_its_units_and_goes_live`, `An_invalid_drop_configuration_is_rejected_with_400` |
| REQ-081 | `DropTests.Taking_from_a_drop_that_is_not_live_is_rejected`; `DropFlowTests.A_scheduled_drop_rejects_takes_until_it_opens` |
| REQ-082 | `DropTests.Taking_units_creates_a_hold_that_reduces_availability`, `Asking_for_more_than_is_available_is_rejected_and_leaves_the_drop_untouched`; `DropFlowTests.Taking_and_confirming_turns_a_hold_into_a_paid_order` |
| REQ-083 | `DropTests.An_unconfirmed_hold_returns_its_units_when_its_window_ends`, `Sweeping_marks_expired_holds_and_reports_how_many`; `DropFlowTests.An_unconfirmed_hold_expires_and_returns_its_units`, `Sweeping_persists_the_expiry_of_due_holds` |
| REQ-084 | `DropTests.Confirming_a_hold_in_time_sells_the_units_for_good`, `Confirming_after_the_window_is_rejected`, `Only_the_owner_can_confirm_a_hold`, `A_hold_cannot_be_confirmed_twice`; `DropFlowTests.Taking_and_confirming_turns_a_hold_into_a_paid_order`, `A_hold_of_another_buyer_cannot_be_confirmed` |
| REQ-085 | `DropTests.Held_plus_sold_never_exceeds_the_units_of_the_drop` (property); `DropFlowTests.A_crowd_never_holds_or_sells_more_units_than_the_drop_contains` (40 concurrent buyers) |
| REQ-086 | `DropTests.An_unconfirmed_hold_returns_its_units_when_its_window_ends`; `DropFlowTests.An_unconfirmed_hold_expires_and_returns_its_units` |
| REQ-088 | `DropTests.A_buyer_cannot_exceed_the_per_buyer_limit_across_holds`, `Expired_units_do_not_count_against_the_buyer_limit`; `DropFlowTests.A_buyer_over_the_limit_is_rejected_with_409` |

## Drop experience

| Requirement | Test |
| :--- | :--- |
| REQ-095 | `I18nParityTests.Spanish_and_English_define_exactly_the_same_keys`, `No_string_is_empty`, `Placeholders_match_between_languages` |
| REQ-097 | `DropTests.The_next_expiry_is_the_soonest_live_hold_and_null_when_none_is_live`; `DropFlowTests.A_drop_reports_when_its_next_hold_expires` |

## HTTP contract

| Requirement | Test |
| :--- | :--- |
| REQ-050 | Every error-path test asserts on `code`; `OrderFlowTests.An_unknown_order_returns_a_problem_details_404` also asserts the content type. |
| REQ-051 | `GlobalExceptionHandlerTests.Unexpected_exception_in_production_is_sanitized_to_generic_500` and `GlobalExceptionHandlerTests.Business_exception_maps_to_4xx_with_machine_readable_context`. |
| REQ-052 | `OrderFlowTests.An_unknown_api_route_returns_json_404_and_never_the_client_application`; CI additionally asserts it against the running container. |
| REQ-053 | `OrderFlowTests.Invalid_payloads_are_rejected_before_reaching_the_domain` |
| REQ-054 | `OrderFlowTests.Order_list_endpoint_honors_pagination_contract_and_filters` exercises pagination parameters, count metadata, and database filters. |

## Delivery

| Requirement | Test |
| :--- | :--- |
| REQ-060 | `OrderFlowTests.The_client_application_and_the_documentation_are_both_served` |
| REQ-061 | `OrderFlowTests.Deep_links_of_the_client_application_fall_back_to_the_spa` |
| REQ-062 | `NainOrderApiFactory` boots the real application per test run; every integration test depends on migrations and seeding having succeeded. CI repeats it against the container. |
| REQ-063 | CI job `container` asserts `id -u` is not `0` inside the running image. |

## Gaps

Every requirement declared in [10-requirements.md](10-requirements.md) is covered by an automated test passing in the Release suite.

One known gap, deliberately outside that file: the visual behaviour of the panel in
[specs/003-drop-experience](../specs/003-drop-experience/spec.md) (REQ-090 to REQ-094, REQ-096:
landing story, role lenses, language selector, reduced motion). It was verified by hand in a browser
against the real API and the in-browser engine, in both languages, with no console errors or missing
translation keys; there is no browser-level test yet (task T-056).
