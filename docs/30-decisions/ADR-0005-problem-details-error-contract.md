# ADR-0005 — Errors are a contract, not prose

**Status:** Proposed
**Supersedes:** per-action `try/catch (Exception)` returning `BadRequest(new { Error = ex.Message })`

## Context

Every controller action wrapped its body in `catch (Exception ex)` and returned `400` with the
exception message. Three defects followed from that shape:

- A technical fault — a null reference, a broken connection — was reported to the client as a `400`,
  as if the caller had sent something wrong. It was also swallowed, so it never reached the logs as
  an error.
- The client had only a human-readable string to work with. Distinguishing "out of stock" from
  "order not found" meant matching on message text.
- Services threw bare `Exception`, so nothing in the type system separated a business rule violation
  from a bug.

## Decision

Two exception hierarchies and one translator.

`DomainException` (in Domain) for invariant violations, `AppException` (in Application) for use-case
failures. Both carry a stable, machine-readable `Code`. A single `IExceptionHandler` maps each type
to its status and renders RFC 7807 `application/problem+json`, adding the data the client needs to
react:

```jsonc
{
  "type": "https://httpstatuses.io/409",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Insufficient stock: 99 requested but only 3 available.",
  "code": "insufficient_stock",
  "requested": 99,
  "available": 3,
  "traceId": "0HNO2OBO3BIE3:00000001"
}
```

Anything unrecognised is a `500`, logged with its stack trace, and its detail is suppressed outside
Development. Controllers carry no `try/catch` at all.

## Alternatives considered

**A `Result<T>` type instead of exceptions.** Makes failure explicit in every signature and avoids
exceptions for control flow. Rejected for this codebase: it would thread a wrapper through every
method for failures that are genuinely exceptional, and the domain would lose the ability to fail
fast inside a constructor.

**Keep exceptions but map them in a filter per controller.** Same result, repeated per controller.

**Return the exception type name as the code.** Couples the public contract to internal class names,
so renaming a class becomes a breaking API change.

## Consequences

- `code` is part of the public contract and must stay stable across versions.
- The client panel branches on `code`, never on message text — for instance, offering to change the
  quantity when it sees `duplicate_order_item`.
- A `500` genuinely means a bug, so it is worth alerting on.
- An unknown `/api` route also answers in this format rather than falling through to the panel's
  HTML.

## Verification

`OrderFlowTests.An_unknown_order_returns_a_problem_details_404`,
`An_unknown_api_route_returns_json_404_and_never_the_client_application`, and every error-path test
asserts on `code` and on the `application/problem+json` content type.
