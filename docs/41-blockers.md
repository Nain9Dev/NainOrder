# Blockers

**Status:** Active

External dependencies the work needs. Listed before writing code, per the constitution.

## Resolved

| Item | What it is | Where it lives | Unblocks | Verified by |
| :--- | :--- | :--- | :--- | :--- |
| .NET 10 SDK | Build and test toolchain | Local install; `actions/setup-dotnet` in CI | Everything | `dotnet --version` reports 10.x |
| NuGet access | Package restore | public `api.nuget.org` | Build | `dotnet restore` succeeds |
| Docker | Image build and smoke test | Local daemon; `ubuntu-latest` in CI | Deployment | `docker build` succeeds |
| GitHub Actions | Quality gate | `.github/workflows/ci.yml` | Documented evidence | Green run on the pull request |

## Open

| Item | What it is | Where to get it | Unblocks | Label |
| :--- | :--- | :--- | :--- | :--- |
| Public deployment | A host running the container so the panel has a live URL | Any container host with a free tier | A shareable demonstration link in the README | `[H]` |
| Persistent volume | Durable storage for the SQLite file | Host-dependent | Data surviving a redeploy | `[H]` |

## Notes

Neither open item blocks development. The application deliberately requires no external service: it
generates its own database, applies its migrations and seeds its catalogue on start-up, so a fresh
clone is usable with a single `dotnet run`.

There are no credentials, API keys or paid services anywhere in the stack. Nothing here needs a
secret, so nothing here can leak one.
