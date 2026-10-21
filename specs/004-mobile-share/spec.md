# 004 — Mobile, install and share

**Status:** Draft — direction requested by the owner (2026-10-21): usable on a phone, installable as an app, and useful in a real case. Requirements below become approved when the owner approves this spec.

## Real use it serves

A small brand runs a limited release at a pop-up, a launch party or a livestream. The organizer opens
NainOrder on a laptop, starts a drop and shows a **QR code**. The audience scans it with their phones
and lands on a minimal **buyer page**: one button, one countdown, no menu. Units are held for a
short window and sell once. The organizer watches the grid fill on the laptop.

This is the flow no generic shop platform gives a small seller: exact units, no oversell, no stock
stuck in abandoned carts, and nothing for the audience to install or sign up for.

## Requirements (EARS)

- **REQ-100** — The panel shall be installable as an application: a web manifest with name, start URL, standalone display, theme colour and icons of 192 and 512 px, one of them maskable.
- **REQ-101** — While the network is unavailable, the panel shall open its interface from a cache and say that it is offline; it shall never serve a cached API response.
- **REQ-102** — The panel shall be usable at 360 px width: no horizontal page scroll, touch targets of at least 44 px for the primary actions, and safe-area insets respected.
- **REQ-103** — When a visitor opens a drop's buyer link (`#/d/<id>`), the panel shall show only the buyer page — no navigation, no top bar — and remember the visitor's token across visits.
- **REQ-104** — When the organizer opens a drop, the panel shall offer its buyer link as a QR code and as copy and share actions.
- **REQ-105** — The QR code shall be generated in the browser without any third-party library or service, and shall encode the drop's buyer link exactly.

- **REQ-106** — The service worker's precache list shall name every static asset of the panel and no file that does not exist, and the service worker shall never handle `/api` or a non-GET request. (Added during implementation: it is the part of REQ-101 a test can enforce.)

## Verification status

Every requirement has an automated test: REQ-100 and REQ-106 in the .NET suite, REQ-101 to REQ-105
in the browser suite (`e2e/`), where the QR code is decoded by `jsQR` from a capture of the screen.
Installing on a physical phone is not automated (T-066, T-067).

## Non-goals

- Push notifications and background sync.
- A native app-store build.
- Offline purchases: a purchase needs the server, so the panel disables the action offline.
- Making the buyer link work across the internet by itself: the instance must be reachable by the phones (same Wi-Fi, a tunnel or a deployment). The runbook says how.
