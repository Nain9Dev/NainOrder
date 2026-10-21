# 004 — Plan

## PWA

- `manifest.webmanifest` with colours from the design tokens; icons generated from `favicon.svg`
  (192, 512, 512 maskable, 180 for iOS) and committed as PNG.
- `sw.js` at the site root so its scope covers the panel. Strategy ([ADR-0010](../../docs/30-decisions/ADR-0010-service-worker-shell-cache.md)):
  precache the shell and static assets; network-first for HTML so a deploy is picked up; never touch
  `/api`, `/health` or `/swagger`. The precache list is a literal array so a test can verify that every
  entry exists.
- Registration in `app.js` after load; an **Install** button appears when the browser fires
  `beforeinstallprompt`; offline state shown in the sidebar status and the top bar.

## Buyer link

- The router learns one parametrised route, `/d/<id>`. The view marks the shell as `standalone`, which
  hides the sidebar and top bar by CSS, so the same code serves the full app and the minimal page.
- The buyer page reuses the buyer lens of the drop view: countdown, one action, own hold. The buyer
  token already lives in `localStorage` (Q-005).

## QR

`qr.js`: a compact QR encoder (byte mode, error-correction level M, versions 1 to 10, mask 0). No
dependency. Verified at development time by decoding generated codes with an independent decoder
(`jsQR`, installed outside the repository). The organizer view renders it as SVG next to Copy and
Share (`navigator.share` where available).

## Mobile

Audit at 360 and 375 px: sidebar as a drawer (exists), organizer grid and stats stacking, 44 px touch
targets for primary buttons, `env(safe-area-inset-*)` padding on the top bar and standalone page.

## Use-case document

`docs/case-study.md`: the pop-up scenario step by step, with the commands and what each guarantee
means for the seller. No invented customer figures: it states what the repository proves.
