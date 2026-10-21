# 005 — Tasks

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-070 | `RequestObservabilityTests` first: `Server-Timing` and `layer` | `[A]` | ✅ Red, then green (REQ-110, REQ-111) |
| T-071 | Database timing accumulator and interceptor, middleware, `layer` in problems | `[A]` | ✅ 130 tests green; no change in Domain or Application |
| T-072 | Request map in the Architecture view, fed by the trace bus | `[A]` | ✅ Verified in a browser on both engines (REQ-112, REQ-113) |
| T-073 | Browser test for the map | `[A]` | ✅ `e2e/tests/architecture.spec.ts`, 4 tests, 29/29 green |
| T-074 | README: architecture section shows the live map | `[A]` | ✅ Two captures (a success, a rejection) replace the static figure, kept under a fold |

## Handoff

Found on the way: the read side runs raw ADO.NET commands that EF Core's interceptor never sees, so
the repository records them itself (or the dashboard would look free); and model-validation `400`s
were served as `application/json`, now fixed (REQ-050). The .NET host crashed once during development
from a self-recursive helper introduced by a bulk replace — a reminder that `replace_all` needs a
look at every hit. Nothing is left open in this spec.
