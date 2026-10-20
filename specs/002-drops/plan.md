# 002 — Plan

## Domain (no packages)

- `Drop` aggregate: `Id`, `ProductId`, `TotalUnits`, `OpensAt`, `PerBuyerLimit`, `HoldSeconds`, `Version`.
  Status is derived from the clock and the counters, never stored.
- `Hold` entity: `DropId`, `BuyerToken`, `Quantity`, `ExpiresAt`, `State` (`Active`, `Confirmed`, `Expired`).
- Invariant: `active holds + confirmed units <= TotalUnits`, enforced inside `Drop`.

## Application

`DropService`: create, get, take (creates a hold), confirm (creates and pays the order through the
existing `OrderService`), and `ExpireHolds`. One unit of work per use case, like the rest.

## Infrastructure

- EF Core mapping, migration `AddDrops`, `Drop.Version` as concurrency token (same pattern as ADR-0007).
- `HoldExpiryService : BackgroundService` sweeps expired holds every second. Expiry is also checked
  lazily when a drop is read, so correctness never depends on the sweeper running.

## Api

`POST /api/drops`, `GET /api/drops/{id}`, `POST /api/drops/{id}/holds`,
`POST /api/drops/{id}/holds/{holdId}/confirm`, `GET /api/drops/{id}/stream` (SSE, phase 2).
Errors keep the RFC 7807 contract with new codes: `drop_not_live`, `buyer_limit_reached`, `hold_expired`.

## Panel

New `Drop` view with the layout in the spec's visual contract. Renders API state only; computes
nothing (AGENTS.md rule). The existing stock race becomes the crowd simulator of a drop.

## Verification

Test first, per task: a concurrency test with many buyers taking from one drop (never more than
`TotalUnits` held plus sold), a clock-controlled test for hold expiry (inject `TimeProvider`),
and property tests for the invariant in `Drop`.
