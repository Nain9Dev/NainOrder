# ADR-0010 — Service worker that caches the shell, never the API

**Status:** Proposed

## Context

The panel must be installable and open with no network, so that an organizer or a buyer on a weak
connection still gets the interface. At the same time every figure the panel shows (units, holds,
countdowns) comes from the server and is only meaningful when fresh. A cached answer to
`GET /api/drops/{id}` would show a unit as available when it is gone, which breaks the product's one
promise.

## Decision

Register one service worker, `sw.js`, at the site root:

- **Precache** the shell: `index.html`, the CSS, the JavaScript modules, the i18n dictionaries, the
  icons and the manifest. The list is a literal array in the file, verified by a test.
- **Network-first for navigations** (`index.html`), falling back to the cached copy, so a new deploy
  reaches users on their next visit.
- **Stale-while-revalidate for other static files** under the same origin.
- **Never handle** requests under `/api`, `/health` or `/swagger`, and never any non-GET request: they
  go straight to the network and fail honestly when offline.
- A cache name carries a version; activation deletes older caches.

## Alternatives considered

- **No service worker (manifest only).** Rejected: installable in some browsers but blank offline.
- **Workbox.** Rejected: a dependency and a build step for about fifty lines, against the panel's
  zero-dependency rule ([ADR-0006](ADR-0006-dependency-free-client-panel.md)).
- **Cache API responses briefly.** Rejected: a stale unit count is a wrong answer, not a slow one.

## Consequences

- A change to a static file needs the cache version bumped or the precache list updated; the test
  catches a list that names a file that no longer exists, not one that omits a new file.
- The panel must handle offline explicitly: it shows the state and disables purchases.
- The service worker needs a secure context: `localhost` and HTTPS only. On a LAN over plain HTTP the
  buyer page works but is not installable.
