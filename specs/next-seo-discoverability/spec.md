# next-seo-discoverability — Search and AI-engine discoverability

**Status:** Draft — requested by the owner (2026-11-09) as a baseline for all public demo sites.

## Goal

A crawler or an AI engine that fetches `https://order.naindev.com/` learns what the product is,
who made it and where the source lives, without executing the panel's JavaScript.

## Requirements (EARS)

- **REQ-064** — The public page shall declare one canonical URL, a 70 to 160 character description, Open Graph and Twitter card metadata and `SoftwareApplication` JSON-LD naming its author, and the application shall serve `/robots.txt`, `/sitemap.xml` and `/llms.txt` as real files from the site root.

## Notes

- The static HTML has no `<h1>` outside `<noscript>`: the panel is rendered by JavaScript. The
  markup is not restructured by this change (the visual design is out of scope).
- The production site is published from `NainOrder.Api/wwwroot` to GitHub Pages and fronted by a
  CDN that may prepend its own content-signal block to `robots.txt`. The repository file stays the
  source of truth.
- The service worker precaches only `assets/*`; the discovery files are deliberately not cached.

## Non-goals

- Changing the panel's design, copy or routing.
- Per-route metadata: the panel has a single public entry URL.
