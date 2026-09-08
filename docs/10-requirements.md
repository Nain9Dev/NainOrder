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
