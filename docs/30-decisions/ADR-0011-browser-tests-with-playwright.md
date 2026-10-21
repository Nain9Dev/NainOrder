# ADR-0011 — Browser tests with Playwright, outside the panel

**Status:** Approved (2026-10-21, by the owner delegating the decision to the agent's best judgement)

## Context

The panel's visual behaviour — the landing story, the buyer and organizer views, the language
selector, the QR code, the offline shell, the phone layout — was verified by hand and listed as a gap
in [50-traceability.md](../50-traceability.md). A gap that depends on someone remembering to look is
not a guarantee. The panel itself has no build step and no dependency
([ADR-0006](ADR-0006-dependency-free-client-panel.md)), so any test tooling must stay out of it.

## Decision

Add a self-contained `e2e/` folder with its own `package.json`, using Playwright Test:

- **Dev-only.** Nothing in `e2e/` ships, and the panel gains no dependency or build step. The .NET
  solution does not reference it.
- **Real application.** Playwright starts `NainOrder.Api` itself against a throwaway SQLite file and
  drives a real browser: the same path a visitor takes.
- **Independent QR decoder.** `jsQR` decodes the QR code captured from the screen, so the in-repo
  encoder is checked by code it does not share.
- **Own CI job**, separate from the .NET job, so a browser flake never hides a unit-test result.
- **Pinned and audited.** Dependencies are pinned by `package-lock.json`; Dependabot watches `e2e/`
  and CI runs `npm audit` on it.

## Alternatives considered

- **Keep verifying by hand.** Rejected: it is how a regression ships unnoticed.
- **A .NET browser-test library (Playwright for .NET).** Considered; rejected because the JavaScript
  runner has better tracing and a lighter CI setup, and the tests describe a JavaScript panel.
- **Unit-testing the panel's modules in Node.** Rejected: the panel's risk is in the browser
  (service worker, layout, touch), which a DOM shim does not reproduce.

## Consequences

- Contributors need Node only to run `e2e/`; `dotnet test` stays the whole story for the backend.
- CI installs a browser for this job (a few minutes) and uploads Playwright's trace on failure.
- The service-worker and offline tests need a secure context; `localhost` qualifies, so no TLS setup
  is needed.
- Tests must wait on observable state, never on fixed sleeps, to stay stable.
