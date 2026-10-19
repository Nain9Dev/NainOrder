# 001 — Stock race

**Status:** Draft — pending owner approval

## Problem

The project's strongest claim, "a stock unit can never be sold twice", is only visible to someone
who reads `ConcurrencyTests`. A recruiter or client opening the panel has no way to see it hold.

## Goal

One button that runs the claim live: *N* buyers race for *M* units at the same instant, and the
panel shows who got a unit, who was turned away, and that the stock balanced to the unit.

## Requirements (EARS)

- **REQ-070** — When a stock race is requested with `buyers` and `units`, the system shall create a
  throwaway product with `units` in stock and have `buyers` independent buyers each try to reserve
  one unit simultaneously, each in its own order and its own transaction.
- **REQ-071** — When a buyer loses a write race (`concurrency_conflict`), the system shall retry it
  with a fresh transaction; when the race ends, it shall report per buyer whether the unit was
  `won` or `rejected`, the stable error code of a rejection (`insufficient_stock`) and the number
  of attempts.
- **REQ-072** — The system shall report `sold + remaining = units`, `sold <= units` and
  `remaining >= 0` as an explicit `balanced` verdict computed from the persisted product, not from
  the buyers' answers.
- **REQ-073** — If `buyers` is outside 2..64 or `units` is outside 1..32, then the system shall
  reject the request with `400` before any data is created.
## Design note (not a requirement)

On the in-browser engine the race is sequential and the panel says so; it must never be presented
as proof of concurrency safety. This is UI honesty, verified by eye in the browser, and has no
automated test, so it is deliberately not a `REQ`.

## Non-goals

- Load testing. The race is bounded (64 buyers) and exists to be seen, not to benchmark.
- Cleaning the throwaway product: it follows the existing demo scenario, which also leaves its data.
