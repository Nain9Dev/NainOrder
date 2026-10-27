# Traceability

**Status:** Active · verified against green runs of `dotnet test NainOrder.slnx -c Release` (130/130 tests) and `npx playwright test` in `e2e/` (29/29 browser tests)

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
| `e2e/tests/*.spec.ts` | Browser (Playwright), real application | Landing, roles, language, buyer link and QR, offline shell, 360 px layout |
| `Api.PwaAssetsTests` | Contract | Manifest, icons and service-worker precache list match the files served |
| `Api.RequestObservabilityTests` | Integration over HTTP | `Server-Timing` and the `layer` of every rejection: the facts the request map draws |
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
| REQ-090 | `e2e/tests/landing.spec.ts` › the landing plays the story and offers one action per role |
| REQ-091 | `e2e/tests/roles.spec.ts` › the buyer view shows the count, one action and no organizer tools |
| REQ-092 | `e2e/tests/roles.spec.ts` › the organizer view shows the grid, the figures and releases a crowd (also asserts available + held + sold = 48 as the panel shows it) |
| REQ-093 | `e2e/tests/roles.spec.ts` › switching between buyer and organizer keeps the same drop; a buyer's purchase appears as a sold unit for the organizer |
| REQ-094 | `e2e/tests/language.spec.ts` › defaults to English, switches to Spanish and remembers the choice; defaults to Spanish |
| REQ-095 | `I18nParityTests.Spanish_and_English_define_exactly_the_same_keys`, `No_string_is_empty`, `Placeholders_match_between_languages`; at run time `e2e/tests/language.spec.ts` › every route renders in es / en with no missing keys or errors |
| REQ-096 | `e2e/tests/landing.spec.ts` › reduced motion › the story does not animate and shows only its last caption |
| REQ-097 | `DropTests.The_next_expiry_is_the_soonest_live_hold_and_null_when_none_is_live`; `DropFlowTests.A_drop_reports_when_its_next_hold_expires` |

## Installable app

| Requirement | Test |
| :--- | :--- |
| REQ-100 | `PwaAssetsTests.The_manifest_declares_what_a_browser_needs_to_install_the_panel`, `The_manifest_has_192_and_512_icons_and_one_of_them_is_maskable`, `Every_icon_exists_and_is_a_png_of_the_declared_size`, `The_page_links_the_manifest_and_declares_its_colours_and_touch_icon` |
| REQ-101 | `e2e/tests/offline.spec.ts` › offline, the shell opens from the cache and says it is offline; going offline mid-session disables purchases and the API is never faked |
| REQ-102 | `e2e/tests/mobile.spec.ts` › every route does not scroll sideways at 360 px; the buyer page and the organizer view fit and have large touch targets; primary buttons reach 44 px on a touch screen |
| REQ-103 | `e2e/tests/buyer-link.spec.ts` › the buyer link shows the buyer page alone and remembers the visitor; a buyer link to a drop that does not exist says so |
| REQ-104 | `e2e/tests/buyer-link.spec.ts` › the QR code decodes to the buyer link; copy puts the buyer link on the clipboard |
| REQ-105 | `e2e/tests/buyer-link.spec.ts` › the QR code decodes to the buyer link (decoded by `jsQR`, independent of the encoder); the encoder is `assets/js/qr.js`, with no dependency |
| REQ-106 | `PwaAssetsTests.Every_precache_entry_points_at_a_file_that_exists`, `Every_static_asset_of_the_panel_is_precached`, `The_service_worker_never_handles_the_api_or_non_get_requests` |

## Live request map

| Requirement | Test |
| :--- | :--- |
| REQ-110 | `RequestObservabilityTests.A_catalogue_read_reports_the_whole_request_and_its_database_time`, `The_read_side_that_runs_raw_sql_is_timed_too`, `A_read_that_never_touches_the_database_reports_no_db_segment` |
| REQ-111 | `RequestObservabilityTests.A_domain_rule_names_the_domain_layer`, `A_missing_resource_names_the_application_layer`, `A_validation_failure_names_the_api_layer`, `An_unknown_route_names_the_api_layer` |
| REQ-112 | `e2e/tests/architecture.spec.ts` › a request crosses the map and shows the server's timings; a rejection stops at the layer the server named; a domain rule shows as rejected in Domain |
| REQ-113 | `e2e/tests/architecture.spec.ts` › on the in-browser engine the map shows a single node |

## A populated first screen

| Requirement | Test |
| :--- | :--- |
| REQ-120 | `SampleOrdersSeedTests.A_fresh_instance_reports_orders_in_every_state_with_revenue_and_best_sellers`, `Sample_orders_are_built_through_the_domain`, `Sample_orders_reserve_stock_by_the_same_rules_as_a_real_order`, `Seeding_again_adds_nothing`; `e2e/tests/dashboard.spec.ts` › against the API the dashboard opens populated |
| REQ-121 | `SampleOrdersSeedTests.The_sample_orders_can_be_switched_off_by_configuration` |
| REQ-122 | `e2e/tests/dashboard.spec.ts` › the sample orders fall inside the timeline window; a stale stored database is replaced by the sample set |

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

Every requirement declared in [10-requirements.md](10-requirements.md) is covered by an automated test:
the .NET suite (`dotnet test`) or the browser suite (`e2e/`, CI job `Browser tests`).

What is still not automated, and honestly so:

- **Installation on a physical phone and over HTTPS** (Android Chrome, iOS "Add to Home Screen").
  The suite proves the manifest, the icons, the service worker and the offline shell; it cannot
  press the install button of a real device (tasks T-066 and T-067, which need the owner).
- **The QR encoder across every version.** The suite decodes the codes the panel actually shows
  (a link of about 65 characters, version 5); seven inputs from version 2 to 10 were also decoded by `jsQR`
  during development. A property test over many inputs is possible and not yet written.
