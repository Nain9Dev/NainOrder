# next — A populated first screen for the demo

**Status:** Draft — requested by the owner after the portfolio audit of 2026-10-27 (the demos must
show value on their first screen). Number assigned by the merge train.

## Problem

What a visitor sees first, recorded on 2026-10-27 before any change:

| Surface | First screen | What it shows |
| :--- | :--- | :--- |
| `order.naindev.com` (static, in-browser engine) | `#/drop` landing | The wordless story and two buttons. No figures. |
| `order.naindev.com` → `#/panel` | Dashboard | Four sample orders dated 10 to 15 October 2026, fixed. The 14-day revenue chart already shows only two of them and will be flat from 30 October on. |
| Any instance of the .NET API (local, container, PaaS) → `#/panel` | Dashboard | Revenue `0,00 €`, every state at `0`, "Todavía no hay pedidos", "Sin ventas registradas todavía". Only the catalogue and the customers are seeded. |

The first data screen of the product is the dashboard. Against the real API it is empty until the
visitor runs the guided scenario or builds an order by hand, so nothing demonstrates the order
engine at once. The in-browser engine has sample orders, but their dates do not move with the
calendar, so its chart decays, and a browser that stored the engine's database before the sample
orders existed keeps an empty one forever.

## Goal

Both engines open the dashboard on a small, meaningful, consistent set of sample orders, with no
manual step, on the day the visitor opens it. An instance someone has already used is never touched.

## Requirements (EARS)

- **REQ-120** — When the application starts and the database holds no orders, the system shall
  seed sample orders covering every state of the order machine (`PendingPayment`, `Paid`,
  `Processing`, `Shipped`, `Cancelled`), dated across the dashboard's timeline window, built through
  the domain so that stock is reserved and restored by the same rules as a real order and every
  total equals the sum of its lines; the seed shall not run when any order exists.
- **REQ-121** — Where the configuration sets `Seed:SampleOrders` to `false`, the system shall seed
  the catalogue and the customers only, as before.
- **REQ-122** — The in-browser engine shall date its sample orders relative to the day it is
  opened, so that they fall inside the dashboard's timeline window on any date, and shall replace a
  stored database written by an earlier version of the engine with the current sample set.

## Honesty rule

Sample orders use only the customers and products the seed already defines. No new person, company
or product name is invented. The orders are visibly synthetic (`demo@naindev.com`,
`example.com` addresses) and the threat model already states that the seeded data is synthetic.

## Non-goals

- Changing the panel's entry route. `#/drop` is the landing the owner chose in spec 003 (REQ-090);
  whether the dashboard should be the first screen instead is Q-008 in
  [11-open-questions.md](../../docs/11-open-questions.md), for the owner.
- Seeding drops or holds. The landing's list of recent drops stays empty until someone starts one.
- A persistent volume or any change to how the public instance is deployed.
- Refreshing the portfolio capture in `nain9dev.github.io` (`public/assets/images/demos/nainorder-ecommerce-api.webp`): a separate task after this one is merged.

## Verification

- `SampleOrdersSeedTests` (integration, written first): after boot the dashboard reports orders in
  every state, confirmed revenue above zero and best sellers; a second seed run adds nothing; the
  stock of every product equals its catalogue figure minus the units held by non-cancelled sample
  orders; with `Seed:SampleOrders=false` the order count is zero.
- `e2e/tests/dashboard.spec.ts`: against the API, the dashboard's first paint lists recent orders and
  a revenue figure; on the in-browser engine, the sample orders fall inside the 14-day window and a
  stale stored database is replaced.
