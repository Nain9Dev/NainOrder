# Runbook

**Status:** Draft — pending owner approval

## Start locally

```bash
cd NainOrder.Api
dotnet run
```

No database server to install. SQLite creates the file, the application applies its migrations and
seeds the catalogue on start-up.

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
`NainOrder.Api/wwwroot` have no build step and must be checked in a browser against a running
instance.

## Container

```bash
docker build -t nainorder .
docker run -p 8080:8080 nainorder
```

The image runs as a non-root user (`uid 1654`) and writes the database to `/app/data`. Override the
location with `ConnectionStrings__DefaultConnection`.

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
