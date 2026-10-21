# 004 — Tasks

| ID | Task | Label | Done when |
| :--- | :--- | :--- | :--- |
| T-060 | `PwaAssetsTests` first: manifest fields, icons exist with the declared sizes, precache entries exist | `[A]` | ✅ Written first; green with REQ-100 and REQ-106 |
| T-061 | Manifest, icons, service worker, install button, offline state | `[A]` | ✅ Service worker active with 35 precached files; offline reload shows the shell and a notice |
| T-062 | Router parameter and standalone buyer page | `[A]` | ✅ `#/d/<id>` shows the buyer page alone on a phone profile (REQ-103) |
| T-063 | QR encoder and the share card | `[A]` | ✅ Seven inputs (v2 to v10) and an on-screen code decode with an independent decoder (REQ-104, REQ-105) |
| T-064 | Mobile layout audit at 360 and 375 px | `[A]` | ✅ No horizontal scroll at 360 and 390 px; primary targets 44 px or more (REQ-102) |
| T-065 | `docs/case-study.md` and README section | `[A]` | ✅ The pop-up scenario is reproducible from the document |
| T-066 | Publish the instance so phones can reach it (LAN, tunnel or host) | `[H]` | The buyer link opens on a phone off the laptop |
| T-067 | Install check on a real phone (Android Chrome, iOS Safari "Add to Home Screen") | `[H]` | The icon appears and the app opens standalone; verified here only with a Chromium phone profile |

## Handoff

Done and verified: PWA assets and tests, offline shell, buyer link, QR, mobile layout, use-case
document. Not verified: installation on a physical phone and over HTTPS (T-066, T-067 need the owner:
a reachable HTTPS address and a device). Known limits: the third-party ecosystem bar and brand CSS
(`naindev.com`) are not cached, so offline they are simply absent; static files refresh in the
background, so a returning visitor may see the previous version once after a deploy.
