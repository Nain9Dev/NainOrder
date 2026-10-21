# 005 — Plan

## Server facts

- `RequestDatabaseTiming` (Infrastructure, scoped): accumulates the duration and count of the EF
  Core commands a request executes, fed by a `DbCommandInterceptor` registered per scope.
- `ServerTimingMiddleware` (Api): a stopwatch around the pipeline; on response start writes
  `Server-Timing: app;dur=…[, db;dur=…;desc="n commands"]`. It reads the accumulator from the
  request's services, so Api still knows nothing of EF Core.
- `GlobalExceptionHandler` adds `layer` from the exception type; `CustomizeProblemDetails` in
  `Program.cs` fills `layer: "api"` for problems the handler never sees (validation, 404 route, 429).

## Panel

- `api.js` parses `Server-Timing` and the problem's `layer` into the trace entry (the body is read
  before the trace is published).
- `views/architecture.js` gains a request map: an SVG with four nodes in dependency order and a
  travelling dot per trace. Success: Api → Application → Domain → Infrastructure and back, with the
  `db` segment shown on the Infrastructure node and `app` on the Api node. Rejection: the dot stops
  at the named layer, turns red and shows the code. In demo mode: one node, "browser engine".
- The trace console stays; the map sits above it as the view's first thing to see.

## Verification

- `RequestObservabilityTests` (integration, written first): header present with `app`; `db` present
  on a catalogue read and absent on the state-machine read; `layer` per rejection type.
- `e2e/tests/architecture.spec.ts`: a request lights the map and shows the server's times; a
  rejection stops at the named layer.
