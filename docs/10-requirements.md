# Requirements

**Status:** Draft — pending owner approval

Requirements are written in EARS notation. Each one maps to a passing test in
[50-traceability.md](50-traceability.md). A requirement with no test is not done, whatever the code
says.

## Catalogue

| ID | Requirement |
| :--- | :--- |
| REQ-001 | When a product is created with a SKU that already exists, the system shall reject the request with `409 duplicate_sku` and shall not create the product. |
| REQ-002 | When a product is created, the system shall normalise its SKU to upper case and round its price to two decimals. |
| REQ-003 | When a stock adjustment would leave the quantity below zero, the system shall reject it and shall leave the stock unchanged. |
| REQ-004 | Where a product's stock is at or below five units, the system shall report its stock status as `low_stock`, and as `out_of_stock` when it reaches zero. |

## Customers

| ID | Requirement |
| :--- | :--- |
| REQ-010 | When a customer is created, the system shall normalise the email to lower case and trim surrounding whitespace. |
| REQ-011 | When a customer is created with an email that already exists, the system shall reject it with `409 duplicate_email`. |
| REQ-012 | When an order is opened without a customer, the system shall reject it. |

## Order basket

| ID | Requirement |
| :--- | :--- |
| REQ-020 | When an order is opened, the system shall place it in `PendingPayment` and assign a unique human-readable reference. |
| REQ-021 | When a line is added to an order, the system shall reserve the requested units from the product's stock within the same transaction. |
| REQ-022 | When the requested quantity exceeds available stock, the system shall reject the request with `409 insufficient_stock`, reporting the requested and available amounts, and shall leave the stock unchanged. |
| REQ-023 | When a product already present in the order is added again, the system shall reject it with `409 duplicate_order_item` and shall not reserve further stock. |
| REQ-024 | When the quantity of an existing line changes, the system shall adjust the stock by exactly the difference, in either direction. |
| REQ-025 | When a line is removed, the system shall return its units to the catalogue. |
| REQ-026 | The order total shall at all times equal the sum of its lines, and its unit count the sum of their quantities. |
| REQ-027 | When a line is added, the system shall record the product's name, SKU and unit price as they stand at that moment, and a later catalogue change shall not alter the issued order. |

## Order lifecycle

| ID | Requirement |
| :--- | :--- |
| REQ-030 | The system shall permit only these transitions: `PendingPayment → Paid \| Cancelled`, `Paid → Processing \| Cancelled`, `Processing → Shipped \| Cancelled`. `Shipped` and `Cancelled` shall be terminal. |
| REQ-031 | When a transition not permitted by REQ-030 is requested, the system shall reject it with `409 invalid_order_state`. |
| REQ-032 | When payment is requested for an order with no lines, the system shall reject it. |
| REQ-033 | While an order is not in `PendingPayment`, the system shall reject any modification of its basket. |
| REQ-034 | When an order is cancelled, the system shall return every reserved unit to the catalogue. |
| REQ-035 | The system shall publish the transitions available for an order alongside the order itself, and the full transition table at `/api/meta/order-state-machine`. |

## Concurrency and integrity

| ID | Requirement |
| :--- | :--- |
| REQ-040 | When several requests reserve stock from the same product simultaneously, the system shall never grant more units than were available, and the granted units plus the remaining stock shall equal the initial stock. |
| REQ-041 | When a concurrent modification is detected, the system shall reject the losing request with `409 concurrency_conflict` rather than applying a lost update. |
| REQ-042 | The system shall persist monetary amounts in a form that supports exact ordering and aggregation in the database. |

## Stock race (demonstration)

| ID | Requirement |
| :--- | :--- |
| REQ-070 | When a stock race is requested with `buyers` and `units`, the system shall create a throwaway product with `units` in stock and have `buyers` independent buyers each try to reserve one unit simultaneously, each in its own order and transaction. |
| REQ-071 | When a buyer loses a write race (`concurrency_conflict`), the system shall retry it with a fresh transaction, and shall report per buyer whether the unit was `won` or `rejected`, the rejection `code` (`insufficient_stock`) and the number of attempts. |
| REQ-072 | The system shall report `sold + remaining = units`, `sold <= units` and `remaining >= 0` as a `balanced` verdict computed from the persisted product, not from the buyers' answers. |
| REQ-073 | If `buyers` is outside 2..64 or `units` is outside 1..32, then the system shall reject the request with `400` before any data is created. |

## Drops

Phase 1 of [specs/002-drops](../specs/002-drops/spec.md). REQ-087 (live stream) is specified there and
enters this table when it is implemented and tested.

| ID | Requirement |
| :--- | :--- |
| REQ-080 | When a shop owner creates a drop with a product, a number of units, an opening time and a per-buyer limit, the system shall publish it as `Scheduled` until it opens. |
| REQ-081 | While a drop is not `Live`, the system shall reject any attempt to take a unit with `409 drop_not_live`. |
| REQ-082 | When a buyer takes units from a live drop, the system shall create a hold of at most the per-buyer limit, reserving those units atomically. |
| REQ-083 | When a hold is not confirmed within its time window, the system shall expire it and return its units to the drop. |
| REQ-084 | When a buyer confirms an unexpired hold, the system shall turn it into a paid order for that buyer. |
| REQ-085 | The system shall never hold or sell more units than the drop contains, whatever the concurrency. |
| REQ-086 | When a drop's units are all sold or held, the system shall report it `SoldOut`; when expired holds free units again, it shall report it `Live`. |
| REQ-088 | If a buyer exceeds the per-buyer limit across holds and orders of one drop, then the system shall reject the request with `409 buyer_limit_reached`. |

## Drop experience

From [specs/003-drop-experience](../specs/003-drop-experience/spec.md). The visual requirements
(REQ-090 to REQ-094, REQ-096) live in that spec until browser-level tests exist; only what is
verified by an automated test is listed here.

| ID | Requirement |
| :--- | :--- |
| REQ-095 | Every user-visible string of the panel shall exist in both Spanish and English with the same placeholders, and a missing or empty one shall fail the build. |
| REQ-097 | The system shall report, with each drop, when its soonest live hold ends, or nothing when no hold is live. |

## HTTP contract

| ID | Requirement |
| :--- | :--- |
| REQ-050 | When a request fails, the system shall respond in `application/problem+json` with a stable machine-readable `code`. |
| REQ-051 | The system shall answer a business-rule failure with `4xx` and a technical failure with `500`, and shall not disclose internal detail of a `500` outside Development. |
| REQ-052 | When a route under `/api` or `/swagger` matches no endpoint, the system shall respond `404` in `application/problem+json` and shall not return the client panel. |
| REQ-053 | When a payload violates its declared validation constraints, the system shall reject it with `400` before it reaches the domain. |
| REQ-054 | The system shall serve a paginated order list with filters by status, customer and reference, resolved in the database. |

## Delivery

| ID | Requirement |
| :--- | :--- |
| REQ-060 | The system shall serve the client panel and the OpenAPI documentation from the same origin as the API. |
| REQ-061 | When a client-panel route is requested directly, the system shall return the panel so its own router can resolve it. |
| REQ-062 | On start-up the system shall apply pending migrations and seed demonstration data idempotently, requiring no manual step. |
| REQ-063 | The container image shall run the application as a non-root user. |
