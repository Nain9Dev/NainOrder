# Charter

**Status:** Draft — pending owner approval

## Objective

Build the financial and logistical core of an e-commerce system: a service that owns the order
lifecycle and the inventory reservation that goes with it, where a stock unit can never be sold
twice and an order can never reach a state its rules forbid.

The secondary objective is demonstrative. The repository must let a reader verify those claims
rather than take them on trust — by running the tests, by reading the traceability matrix, or by
operating the system through its own client panel.

## Scope

- Product catalogue with SKU, price, category and stock.
- Customers who can open orders.
- Order lifecycle: basket, payment, preparation, shipping and cancellation, with inventory
  reservation and restitution tied to each transition.
- Aggregated business metrics computed in the database.
- A client panel served by the same application, covering every operation above.
- A public HTTP contract with a stable, machine-readable error format.

## Non-goals

These are deliberately out of scope. Their absence is a decision, not an oversight:

- **Authentication and authorisation.** The deployment is a public demonstration. Adding accounts
  would obscure the domain, which is the subject.
- **Payment gateway integration.** `MarkAsPaid` is the domain transition; wiring a real processor
  adds an external dependency without adding a domain rule.
- **Multi-warehouse or partial fulfilment.** Stock is a single global counter per product.
- **Order history / event sourcing.** Timestamps per transition are kept; the full audit trail is
  not modelled.
- **Internationalisation.** The panel's copy is Spanish; the API is locale-neutral.

## Constraints

- Must run with a single `dotnet run`, no database server to install, no Node toolchain.
- Must deploy as one container on ephemeral storage and be usable from the first minute without
  manual steps.
- No paid services and no licence cost anywhere in the stack.

## Success criteria

| Criterion | How it is verified |
| :--- | :--- |
| Stock cannot be oversold under concurrency | `ConcurrencyTests` fires simultaneous reservations and asserts the inventory balances |
| Domain invariants hold for arbitrary inputs | `DomainInvariantProperties` (FsCheck) generates hundreds of cases per run |
| The HTTP contract behaves as documented | `OrderFlowTests` exercises the real application over HTTP |
| The deployed artifact works | CI builds the image and smoke-tests the running container |
| No known vulnerable dependency ships | CI fails on `dotnet list package --vulnerable` |
| The build carries no warning debt | `TreatWarningsAsErrors` in all four projects |
