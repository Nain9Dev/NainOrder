@AGENTS.md

## Claude Code

- Read `docs/README.md` and the active `specs/NNN-*/tasks.md` before any change.
- Use plan mode for changes that cross a layer boundary or touch the order state machine.
- Run `dotnet build NainOrder.slnx -c Release && dotnet test NainOrder.slnx -c Release` and show the
  output before reporting a task as done.
- The client panel has no build step. Verify changes to `NainOrder.Api/wwwroot` in a browser against
  a running instance, not by reading the source alone.
