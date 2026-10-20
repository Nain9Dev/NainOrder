# 002 — Tasks

Spec and [ADR-0008](../../docs/30-decisions/ADR-0008-drops-with-expiring-holds.md) approved; Q-005 to Q-007
resolved. Phase 1 is T-040 to T-045. Labels: `[A]` agent alone, `[M]` mixed, `[H]` owner only.

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-040 | Approve scope change, ADR-0008 and Q-005 to Q-007 | `[H]` | ✅ Statuses updated in `docs/` |
| T-041 | `Drop` and `Hold` domain with `TimeProvider`, property tests first | `[A]` | Invariant REQ-085 holds for generated sequences |
| T-042 | `DropService` and persistence, migration `AddDrops` | `[A]` | Concurrency test: never more than `TotalUnits` held plus sold |
| T-043 | Hold expiry, lazy plus background sweeper | `[A]` | Clock-controlled test returns units after the window |
| T-044 | Drop endpoints and error codes | `[A]` | `openapi.json` regenerated, error contract tests green |
| T-045 | Drop view in the panel, minimal text | `[A]` | Verified in a browser against a running API |
| T-046 | Live stream and crowd simulator | `[A]` | Page updates without polling |
| T-047 | Webhooks and embeddable widget | `[M]` | Needs Q-005; receiver URL supplied by the owner |
| T-048 | README rebuilt around the drop, with an animated capture | `[A]` | Product understood from the first screen |
