# 001 — Plan

## Backend

`POST /api/demo/stock-race` in `DemoController` (the demo scenario already lives there).

1. Validate the request (`[Range]` on both fields, REQ-073).
2. Create the product and the buyers' orders through `IProductService` / `IOrderService`.
3. Release all buyers at once from a `TaskCompletionSource` barrier. Each buyer resolves its own
   `IOrderService` from a fresh `IServiceScope` (`IServiceScopeFactory`), so each has its own
   `DbContext` and transaction, exactly like separate HTTP requests.
4. Classify each outcome from the exception `Code` (`AppException` / `DomainException`). Any other
   exception is not swallowed: it propagates and the API answers `500`.
5. Re-read the product and compute `balanced` from persisted stock (REQ-072).

No change to Domain, Application or Infrastructure.

## Panel

New view `Race` (`#/carrera`): two sliders, one button, a grid with one cell per buyer
(green = won, red = rejected), and a verdict line. The panel renders what the API returns and
computes no figure itself. On the in-browser engine the mock answers the same shape,
sequentially, and the view shows a notice (see the design note in `spec.md`).

## Verification

`StockRaceTests` over the real application: 24 buyers vs 5 units must yield `sold == 5`,
`rejected == 19`, `remaining == 0`, `balanced == true`; invalid ranges answer `400`.
