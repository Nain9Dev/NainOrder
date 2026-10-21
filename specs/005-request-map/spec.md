# 005 — Live request map

**Status:** Draft — direction: "keep improving the visual architecture" (owner, 2026-10-21, decisions delegated).

## Goal

The Architecture view stops describing the layers and shows them working: every request the panel
makes travels across the four layers on screen, with the time it really took and, when it is
rejected, the layer that rejected it. A visitor understands Clean Architecture by watching a
purchase go through it, not by reading four paragraphs.

## Honesty rule

The panel must not invent what happened inside the server. Everything the map shows is a fact the
server states in the response:

- the total time and the database time, measured where they happen;
- for a rejection, the layer whose rule decided it.

What the map draws between those facts — the order Api → Application → Domain → Infrastructure —
is not a guess either: it is the dependency rule, enforced by `CleanArchitectureTests`.

## Requirements (EARS)

- **REQ-110** — Every API response shall carry a `Server-Timing` header with `app;dur=<ms>` measured for the whole request and, when the database was used, `db;dur=<ms>` summed from the real duration of every command the request executed, with the command count in its description.
- **REQ-111** — Every `application/problem+json` response shall carry a `layer` extension naming where the rejection was decided: `domain` for a domain rule, `application` for a use-case rule (not found, duplicate), `infrastructure` for a concurrency conflict detected on write, `api` for validation, routing and rate limiting.
- **REQ-112** — When the panel completes a request against the API, the Architecture view shall animate it across the layers in dependency order and show the server's `app` and `db` times; when the response is a rejection, the animation shall stop at the layer the server named and show the code.
- **REQ-113** — Where the panel runs on its in-browser engine, the map shall show a single "browser engine" node and shall not pretend the request crossed the server's layers.

## Non-goals

- Distributed tracing, OpenTelemetry or an exporter: the facts stay in the response headers.
- Per-layer durations for Application and Domain: they are not measured, so they are not shown.
