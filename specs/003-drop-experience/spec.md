# 003 — Drop experience

**Status:** Approved direction by the owner (interview of 2026-10-20). Requirements below are drafts until each has its test.

## Goal

A shop owner or a recruiter opens the app and understands within ten seconds what it does and why it
matters, without reading: the product explains itself through motion and the result.

## Decisions taken in the interview

| Question | Answer |
| :--- | :--- |
| Who must understand it fast | A shop owner or client (recruiters benefit too) |
| First piece to build | An animated landing for the drop |
| Roles a visitor can try | Both, one click apart: buyer and organizer |
| Language of the public panel | ES and EN with a selector |

## Requirements (EARS)

- **REQ-090** — When the panel opens on the Drop view with no drop selected, the system shall play a short wordless story — a crowd arrives, units are held, an unconfirmed hold expires, units are sold — and offer one action per role.
- **REQ-091** — Where the visitor chooses the buyer role, the panel shall show only what a buyer needs: the countdown, one action, and their own hold.
- **REQ-092** — Where the visitor chooses the organizer role, the panel shall show the drop's units, the sales rhythm and the holds about to expire, and shall let the organizer release a simulated crowd.
- **REQ-093** — The panel shall let the visitor switch between buyer and organizer on the same drop without losing it.
- **REQ-094** — The panel shall offer Spanish and English, remember the choice, and default to the browser's language.
- **REQ-095** — Every user-visible string shall exist in both languages: a string missing from one dictionary is a build failure.
- **REQ-096** — Where the visitor prefers reduced motion, the landing story shall show its end state without animation.
- **REQ-097** — The system shall report, with each drop, when its soonest live hold ends, or nothing when no hold is live. (Added during implementation: REQ-092's "holds about to expire" needs it from the server, since the panel must not compute it.)

## Status of verification

Every requirement has an automated test: REQ-095 and REQ-097 in the .NET suite, REQ-090 to REQ-096
in the browser suite (`e2e/`, [ADR-0011](../../docs/30-decisions/ADR-0011-browser-tests-with-playwright.md)).

## Non-goals

- Translating API error messages: they are machine-readable (`code`) and the panel maps the codes it needs.
- Right-to-left languages.
- A marketing site separate from the panel.
