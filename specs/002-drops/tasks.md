# 002 — Tasks

Spec and [ADR-0008](../../docs/30-decisions/ADR-0008-drops-with-expiring-holds.md) approved; Q-005 to Q-007
resolved. Phase 1 is T-040 to T-045. Labels: `[A]` agent alone, `[M]` mixed, `[H]` owner only.

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-040 | Approve scope change, ADR-0008 and Q-005 to Q-007 | `[H]` | ✅ Statuses updated in `docs/` |
| T-041 | `Drop` and `Hold` domain with the clock supplied by the caller, tests first | `[A]` | ✅ Invariant REQ-085 holds for generated sequences |
| T-042 | `DropService` and persistence, migration `AddDrops` | `[A]` | ✅ 40-buyer test: never more than `TotalUnits` held plus sold |
| T-043 | Hold expiry, lazy plus background sweeper | `[A]` | ✅ Clock-controlled tests return units after the window |
| T-044 | Drop endpoints and error codes | `[A]` | ✅ `openapi.json` regenerated, error contract tests green |
| T-045 | Drop view in the panel, minimal text, crowd simulator | `[A]` | ✅ Verified in a browser against the real API and the in-browser engine |
| T-046 | Live stream (SSE) instead of 1 s polling | `[A]` | Page updates without polling |
| T-047 | Webhooks and embeddable widget | `[M]` | Receiver URL supplied by the owner |
| T-048 | README rebuilt around the drop | `[A]` | ✅ Product understood from the first screen |

## Handoff

Phase 1 is done: 110 tests green, REQ-080 to REQ-086 and REQ-088 traced. Found and fixed while
verifying in a browser: timestamps serialised without UTC (countdowns off by the timezone offset),
`database is locked` under a crowd (ADR-0009, WAL), and the 120/min rate limit starving the crowd
simulator (larger window for `/api/drops`). Next: T-046 (SSE) — REQ-087 enters
`docs/10-requirements.md` with its test.
