# next — Plan

## Server

- `SampleOrderSeeder` (Infrastructure, `Persistence/Seeding`): called by `DatabaseSeeder.SeedAsync`
  after the catalogue and the customers are saved, only when `Orders` is empty. It builds each order
  through the aggregate (`new Order`, `AddItem`, `MarkAsPaid`, `MarkAsProcessing`, `MarkAsShipped`,
  `Cancel`) and moves stock through `Product.RemoveStock` / `AddStock`, exactly as `OrderService`
  does, so no invariant is bypassed. Dates are then backdated through the EF Core entry, the same
  trick the seeder already uses to pin `DemoCustomerId`, and the reference is rebuilt for the new
  date in the aggregate's own format (`NO-yyyyMMdd-XXXXXX`, asserted by the test).
- The sample set: six orders over the last twelve days, one per state plus a second shipped one,
  customers and products taken from the existing seed by e-mail and SKU. Cancelled restores its
  units; the catalogue figures the dashboard shows stay consistent with the orders it lists.
- `Program.cs` reads `Seed:SampleOrders` (default `true`) and passes it to the seeder. Nothing else
  in the pipeline changes; Domain and Application are untouched.

## In-browser engine

- `mock-backend.js`: `createInitialOrders` computes `createdAt`, `paidAt`, `shippedAt` and
  `cancelledAt` from the current date and derives each reference from its date; the set mirrors the
  server's six orders. The stored database carries a `version`; `load()` resets when it is missing
  or different, so a visitor who stored the engine before the sample orders existed sees them.

## Verification

- `NainOrder.Tests/Api/SampleOrdersSeedTests.cs` first (red), then the seeder.
- `e2e/tests/dashboard.spec.ts`: real API and forced in-browser engine
  (`window.__NAINORDER_FORCE_MOCK__`, as `architecture.spec.ts` does).
- Captures before and after at 1360 px and 375 px in `captures/`, for the pull request.
