# next — Tasks

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-080 | Record the first screen of both engines before any change | `[A]` | ✅ Table in `spec.md`; captures `before-*` in `captures/` (API: zeros and two empty states; engine: fixed October dates) |
| T-081 | `SampleOrdersSeedTests` first: every state, revenue, idempotence, stock consistency, opt-out | `[A]` | ✅ Three of five red (no orders), then green (REQ-120, REQ-121) |
| T-082 | `SampleOrderSeeder` through the domain, backdated; `Seed:SampleOrders` in `Program.cs` | `[A]` | ✅ 135 .NET tests green in Release, 0 warnings; Domain and Application untouched |
| T-083 | In-browser engine: relative dates, versioned storage, same six orders | `[A]` | ✅ `e2e/tests/dashboard.spec.ts`, 3 tests, 32/32 green on Edge (REQ-120 on the panel, REQ-122) |
| T-084 | Docs: requirements, traceability, runbook, changelog, Q-008; captures `after-*` | `[A]` | ✅ REQ-120 to REQ-122 traced; runbook names `Seed__SampleOrders`; Q-008 open for the owner |

## Handoff

Done and verified: both engines open `#/panel` on the same six sample orders (confirmed revenue
5434,10 €, pending 528,00 €, 166 units in stock, one order per state and two shipped), checked in a
browser at 1360 px and 375 px (no horizontal scroll, six rows, no empty state) and by the two
suites. Captures before and after sit in `captures/`.

Not done, by design: the entry route stays `#/drop` (Q-008, owner's call); drops are not seeded;
the portfolio capture `public/assets/images/demos/nainorder-ecommerce-api.webp` in
`nain9dev.github.io` is a separate task once this is merged. Known: a visitor of the static demo
loses the orders they built in an older engine version once, when the stored database is replaced
(`STORAGE_VERSION` 2); the engine's reset button already offered the same.
