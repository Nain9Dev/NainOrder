# Project constitution

NainOrder is an order engine for e-commerce built on **.NET 10** with Clean Architecture, tactical
DDD and a CQRS read side. Persistence is Entity Framework Core over SQLite. The client panel is a
dependency-free JavaScript application served as static files by the API itself.

This file is the operational contract for any AI agent working on this repository. Read
`docs/README.md` before proposing anything.

## Authority

- `docs/` is the canonical source of truth for the product. Code that contradicts an `Approved`
  document is a defect, not a decision.
- Only the owner approves a decision. An agent may draft one as `Proposed`; never record it as
  `Approved`.
- A document marked `Superseded` or `Draft` never drives an implementation.

## Non-negotiable architecture

Dependencies point inwards. Every arrow below is enforced by the project references and must stay
that way:

```
Api ──▶ Application ──▶ Domain
 └────▶ Infrastructure ──▶ Application ──▶ Domain
```

1. **`NainOrder.Domain`** holds entities, invariants and the order state machine. It references **no
   package at all** — not EF Core, not ASP.NET, not dependency injection. This restriction is what
   keeps the business model verifiable in isolation; do not weaken it.
2. **`NainOrder.Application`** holds use cases, DTOs and the persistence contracts. It orchestrates
   aggregates and owns the transactional boundary. It must not know which database engine exists.
3. **`NainOrder.Infrastructure`** implements the interfaces declared by Application. It is the only
   project allowed to touch EF Core or SQL.
4. **`NainOrder.Api`** exposes HTTP, translates errors and serves the client panel. It must not
   contain business rules.

The client panel (`NainOrder.Api/wwwroot`) presents and captures input. It must not compute business
figures. Anything a user sees derived from a rule — allowed transitions, totals, stock status —
comes from the API, never from a duplicated rule in JavaScript.

## Invariants that must never regress

These are the claims the project makes about itself. Each has a test; breaking one without changing
its test is a defect:

- Stock can never go negative, whatever the sequence or concurrency of operations.
- A rejected reservation leaves the inventory untouched.
- Cancelling an order returns every reserved unit to the catalogue.
- An order total always equals the sum of its lines.
- A paid order's basket is frozen; a shipped order is terminal.
- Money is persisted as integer cents, never as text or floating point.
- A business failure is `4xx`; a technical failure is `500`. Never the reverse.
- An unknown `/api` route answers `404` with `application/problem+json`, never the panel's HTML.

## Stack

Locked unless an approved ADR says otherwise:

| Concern | Choice |
| :--- | :--- |
| Language / runtime | C# 13, .NET 10 |
| Web | ASP.NET Core, controllers, Swashbuckle |
| Persistence | EF Core 10, SQLite |
| Tests | xUnit, FsCheck (property-based), `WebApplicationFactory` (integration) |
| Client panel | Native ES modules, CSS custom properties. **No build step, no npm, no runtime dependency.** |

Do not introduce frameworks, services or dependencies as a side effect of another task. The panel's
zero-dependency constraint is deliberate: it keeps the deployment a single `dotnet publish`.

## Workflow

1. Any change starts in a specification, never in the code. A new feature gets
   `specs/NNN-feature-name/` with `spec.md`, `plan.md` and `tasks.md`.
2. Stable requirements get a `REQ-###` entry in `docs/10-requirements.md`. Ambiguities go to
   `docs/11-open-questions.md` and block the requirement they reference.
3. Significant decisions become ADRs under `docs/30-decisions/` with status `Proposed`.
4. One task at a time, test first. Run the suite and show the output before calling a task done.
5. Map every requirement to its test in `docs/50-traceability.md`. A requirement with no test is not
   done, whatever the code says.

**Fast lane** — a change that adds no requirement, touches no public contract and fits in one task
with existing coverage (typo, small fix, doc fix) may skip spec and plan. Anything larger follows the
full cycle. When in doubt, full cycle.

## Quality gate

`dotnet build` runs with `TreatWarningsAsErrors` in all four projects. CI additionally audits
dependencies for known vulnerabilities and smoke-tests the container that actually gets deployed. A
red pipeline blocks the change that broke it.

Before reporting any task as done:

```bash
dotnet build NainOrder.slnx -c Release && dotnet test NainOrder.slnx -c Release
```

## Diagrams

Design documents carry their diagrams as Mermaid and both are updated in the same commit:
`docs/20-architecture.md` a `flowchart`, `docs/21-data-model.md` an `erDiagram` kept in sync with the
real schema and its migration. A diagram that contradicts the code is a defect in one of the two —
flag it, do not ignore it.

## Language

Everything that lands in the repository is written in English: code, identifiers, file and folder
names, branches, commits, comments, documentation, tests and configuration. End-user facing copy in
the client panel is Spanish, which is the product's approved locale.
