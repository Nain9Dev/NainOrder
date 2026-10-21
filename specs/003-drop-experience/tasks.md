# 003 — Tasks

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-050 | i18n core, JSON dictionaries, selector; parity test first | `[A]` | ✅ `I18nParityTests` green (REQ-094, REQ-095) |
| T-051 | Translate the shell and the Drop, Race and Architecture views | `[A]` | ✅ No hardcoded user-visible string in those files |
| T-052 | Animated landing story | `[A]` | ✅ Plays in a browser; static end state under reduced motion (REQ-090, REQ-096) |
| T-053 | Buyer and organizer lenses | `[A]` | ✅ Verified in a browser on the real API (REQ-091 to REQ-093, REQ-097) |
| T-054 | Translate Dashboard, Catalogue, Orders and the order panel | `[A]` | ✅ Every route in both languages: no console errors, no missing keys |
| T-055 | README capture (animated) | `[A]` | ✅ `docs/assets/drop-story.gif` and a live-drop capture |
| T-056 | Browser-level tests for the visual requirements | `[M]` | ✅ `e2e/` with Playwright (ADR-0011, Proposed); REQ-090 to REQ-094, REQ-096 and REQ-101 to REQ-105 are in `docs/10-requirements.md` with their tests |
| T-057 | Animated request map in the Architecture view (a purchase travelling through the layers) | `[A]` | The four layers light up in order for a real request |

## Handoff

Done: i18n (ES/EN, 352 keys per language, parity test), landing story, buyer and organizer lenses, `nextHoldExpiresAt`.
Not done: T-056 needs the owner's call on adding Playwright; T-057 is the next visual piece. Open drawers
and modals do not re-render on a language switch, only on the next open.
