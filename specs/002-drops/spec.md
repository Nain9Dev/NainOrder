# 002 — Drops

**Status:** Approved by the owner. Changes the product scope: see [ADR-0008](../../docs/30-decisions/ADR-0008-drops-with-expiring-holds.md); Q-005 to Q-007 are resolved in `docs/11-open-questions.md`.

## Problem

Limited-stock launches (sneakers, merch, tickets) fail in one predictable way: when thousands arrive at
the same second, the shop oversells, or locks stock behind abandoned carts. Shops with a generic
platform have no tool that guarantees *exactly N units, no more, no stuck stock*.

## Product

NainOrder becomes a **drop engine**: a headless service plus a live page that sells a fixed number of
units to a crowd, fairly and without overselling. The existing guarantees (reservation, optimistic
concurrency, state machine) are the engine; this feature adds the commercial surface.

## Users

- **Shop owner** — configures a drop and watches it sell out.
- **Buyer** — takes a unit, then has a short window to confirm it.

## Requirements (EARS)

- **REQ-080** — When a shop owner creates a drop with a product, a number of units, an opening time and a per-buyer limit, the system shall publish it as `Scheduled` until it opens.
- **REQ-081** — While a drop is not `Live`, the system shall reject any attempt to take a unit with `409 drop_not_live`.
- **REQ-082** — When a buyer takes units from a live drop, the system shall create a hold of at most the per-buyer limit, reserving those units atomically.
- **REQ-083** — When a hold is not confirmed within its time window, the system shall expire it and return its units to the drop.
- **REQ-084** — When a buyer confirms an unexpired hold, the system shall turn it into a paid order for that buyer.
- **REQ-085** — The system shall never hold or sell more units than the drop contains, whatever the concurrency.
- **REQ-086** — When a drop's units are all sold or held, the system shall report it `SoldOut`; when expired holds free units again, it shall report it `Live`.
- **REQ-087** — The system shall publish the live state of a drop (available, held, sold) as a stream that clients can subscribe to.
- **REQ-088** — If a buyer exceeds the per-buyer limit across holds and orders of one drop, then the system shall reject the request with `409 buyer_limit_reached`.

## Visual contract (panel)

One page per drop: a countdown, a grid with one cell per unit coloured *available / held / sold*,
and a single button. No explanatory text beyond labels. It updates from the stream (REQ-087).

## Phases

1. **MVP** — REQ-080 to REQ-086, REQ-088; live page polling the drop state.
2. **Live** — REQ-087 (stream); crowd simulator on the page (extends the stock race).
3. **Integrate** — webhooks (`drop.sold_out`, `hold.expired`) and an embeddable widget. Needs Q-005.

## Non-goals

- Real payment capture: `confirm` stays the existing `MarkAsPaid` transition (Q-006).
- Accounts and login. Buyers are identified by a per-visitor token (Q-005).
- Queues ordered by arrival (waiting-room fairness). Revisit after MVP.
