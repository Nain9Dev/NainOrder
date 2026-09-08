# ADR-0006 — The client panel ships with no build step and no dependencies

**Status:** Proposed

## Context

The project needed a client interface. Swagger demonstrates the endpoints but not the product: it
cannot show that cancelling an order returns stock, or that the available transitions come from the
domain.

The constraint that shaped the choice is the deployment: one container, ephemeral storage, and a
reader who should be able to run the whole thing with `dotnet run`.

## Decision

Write the panel as native ES modules and CSS custom properties, served as static files from
`NainOrder.Api/wwwroot` by the same application, on the same origin.

No framework, no bundler, no `npm install`, no CDN at runtime. Around 190 KB of source, served
compressed.

## Alternatives considered

**React or Vue with Vite.** Better ergonomics for a large application. It would add a Node stage to
the Dockerfile, a `node_modules` tree, a lockfile to keep audited, and a build that can break
independently of the .NET build. For an interface of four views the cost outweighs the benefit.

**Blazor WebAssembly.** Stays in C# and shares the DTOs, which is genuinely attractive. Rejected on
first-load weight: the runtime download is the first thing a visitor experiences, and the panel is
meant to feel immediate.

**Server-rendered Razor pages.** Simplest of all, but the panel needs live client state — an active
basket, a live request trace — that fits an SPA better.

**Swagger only.** Rejected: it documents the API, it does not demonstrate the product.

## Consequences

- Deployment stays a single `dotnet publish`. The container has no Node in it.
- No supply-chain surface from front-end packages, and nothing to keep updated.
- Same origin means no CORS configuration and no preflight requests.
- The cost is ours to pay: no type checking on the client, and patterns — templating, routing,
  delegated events — are hand-rolled in `wwwroot/assets/js`. Written down here so a future
  contributor knows it was a decision rather than an omission.
- Growing the panel much beyond its current scope would justify revisiting this. That would be a new
  ADR superseding this one, not a silent `npm init`.

## Verification

`OrderFlowTests.The_client_application_and_the_documentation_are_both_served` and
`Deep_links_of_the_client_application_fall_back_to_the_spa`; CI additionally fetches `/` from the
running container.
