# Runbook

**Status:** Draft — pending owner approval

## Start locally

```bash
cd NainOrder.Api
dotnet run
```

Listens on `http://localhost:8170` (pinned in `Properties/launchSettings.json` per developer port registry). No database server to install. SQLite creates the file, the application applies its migrations and seeds the catalogue on start-up.

| Route | Contents |
| :--- | :--- |
| `/` | Client panel |
| `/swagger` | Interactive API documentation |
| `/health` | Service status |

## Verify a change

```bash
dotnet build NainOrder.slnx -c Release && dotnet test NainOrder.slnx -c Release
```

`TreatWarningsAsErrors` is on in all four projects, so a new warning fails the build. Changes to
`NainOrder.Api/wwwroot` have no build step; the browser suite checks them against the real
application:

```bash
cd e2e && npm ci && npx playwright install chromium && npx playwright test
```

Playwright starts the API itself on port 8180 with a throwaway database. To reuse an installed
browser, set `PW_CHANNEL=msedge` (or `chrome`). On a failure, `npx playwright show-trace` opens the
recorded trace ([ADR-0011](30-decisions/ADR-0011-browser-tests-with-playwright.md)).

## Container

```bash
docker build -t nainorder .
docker run -p 8080:8080 nainorder
```

The image runs as a non-root user (`uid 1654`) and writes the database to `/app/data`. Override the
location with `ConnectionStrings__DefaultConnection`.

## Reach it from phones

The buyer link and its QR code encode the address the panel was opened with, so open the panel with
an address phones can reach, not `localhost`:

```bash
cd NainOrder.Api && dotnet run --urls http://0.0.0.0:8170
```

Then open `http://<computer-IP>:8170` on the laptop. Allow the port in the firewall if Windows asks.
**Installing the panel as an app and the offline cache need a secure origin** (HTTPS, or
`localhost`): on plain HTTP over the network the buyer page works but is not installable. Put any
HTTPS reverse proxy or tunnel in front for that ([ADR-0010](30-decisions/ADR-0010-service-worker-shell-cache.md)).
The service worker never caches `/api`, so an offline phone sees the interface but no invented
units. After a deploy, static files refresh in the background: a returning visitor may see the
previous version once.

## Configuration

| Setting | Environment variable | Default |
| :--- | :--- | :--- |
| Database | `ConnectionStrings__DefaultConnection` | `Data Source=nainorder.db` (`/app/data/nainorder.db` in the image) |
| Listening port | `ASPNETCORE_HTTP_PORTS` | `8080` in the image |
| CORS origins | `Cors__AllowedOrigins__0`, `__1`… | empty — the middleware is not registered at all |

## Behind a reverse proxy

`UseForwardedHeaders` is enabled and trusts `X-Forwarded-For` and `X-Forwarded-Proto` from any proxy,
because a PaaS assigns the proxy's address dynamically. TLS is expected to terminate at that proxy;
the application does not redirect to HTTPS itself.

**This is a deliberate trade-off for a public demonstration and is not a production posture.** Any
deployment that is not behind a trusted proxy must restrict `KnownProxies` or `KnownIPNetworks`,
because the rate limiter partitions by client address and a spoofed header would let a caller
bypass it.

## Known limits

- **Ephemeral data.** With no persistent volume the database is recreated on every deploy. The seed
  makes the instance usable immediately, so this is acceptable for a demonstration and not for
  production.
- **WAL files.** The database runs in WAL mode ([ADR-0009](30-decisions/ADR-0009-sqlite-wal-mode.md)),
  so `nainorder.db-wal` and `-shm` sit beside it: copy all three together.
- **Drops have a larger rate limit** (1,200 requests per minute per address on `/api/drops`, 120
  elsewhere) because a drop page polls every second and its crowd simulator bursts.
- **Unconfirmed drop holds expire** after their window and a background service sweeps them every
  second; reads also apply the clock, so a stopped sweeper never leaves units locked.
- **SQLite serialises writes.** Fine at demonstration load. Sustained concurrent write traffic needs
  a different engine; that is a `UseSqlite` change plus a migration, not a domain change.
- **No authentication.** Every endpoint is public by design — see the non-goals in
  [00-charter.md](00-charter.md). The only protection is a fixed-window rate limit of 120 requests
  per minute per address.
- **Stock is reserved when a line is added**, not at payment, and nothing expires an abandoned
  basket. See Q-003 in [11-open-questions.md](11-open-questions.md).

## Recovery

The application has no state worth recovering beyond its database file.

| Symptom | Cause | Action |
| :--- | :--- | :--- |
| `503` / container restarting | Migration failed on start-up | Read the logs: start-up logs the failure as `Critical` and refuses to serve rather than run against a broken schema |
| `429` on every request | Rate limit reached | Expected under load; the window is one minute |
| Empty catalogue | Seed did not run | Restart: the seeder is idempotent and inserts only what is missing |
| Database file corrupt or locked | Ephemeral storage or an interrupted write | Delete the file and restart; migrations and seed rebuild it |
