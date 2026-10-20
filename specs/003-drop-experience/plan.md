# 003 — Plan

## i18n

- Dictionaries as static JSON, `wwwroot/assets/i18n/es.json` and `en.json`, flat dotted keys. JSON
  (not JS) so a plain .NET test can read both and assert identical key sets (REQ-095) without a
  Node toolchain.
- `i18n.js`: `t(key, params)`, `getLocale()`, `setLocale()`; loads both files once before the first
  render (works on the static host); persists in `localStorage`; default from `navigator.language`.
- Selector in the top bar. Changing it re-renders the current view.
- Missing key: `t` returns the key and logs once, so a gap is visible rather than silent.

## Landing story

A single SVG scene driven by CSS animation, no library: crowd dots stream in, a grid of units fills
with *held*, one hold drains and returns, others turn *sold*. Under 20 s, looped, no text beyond the
two role buttons. `prefers-reduced-motion` renders the final frame (REQ-096).

## Roles

One drop, two lenses over the same polled state:

- **Buyer**: product, big countdown or "live", one action, own hold with its bar.
- **Organizer**: unit grid, sales-rate sparkline computed from polled `sold` deltas, list of holds
  expiring soon, crowd button. The sparkline plots figures the API returned; it applies no rule.

A tab control switches lens without reloading the drop (REQ-093).

## Verification

- `I18nParityTests` reads both JSON files and asserts equal key sets and non-empty values.
- Browser check of both locales and both roles against the real API and the in-browser engine.
